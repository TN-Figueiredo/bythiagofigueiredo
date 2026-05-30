'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { generateQrSvg } from '@tn-figueiredo/links/qr'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { buildShortUrl } from '@/lib/links/short-url'
import { normalizeUtmValue, normalizeAllUtmFields } from '@tn-figueiredo/links'

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

// ─── Auth helper ────────────────────────────────────────────────────────────

async function requireEditScope(siteId: string): Promise<{ userId: string }> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
  return { userId: res.user.id }
}

// ─── Cache invalidation ─────────────────────────────────────────────────────

function revalidateLinksHub(siteId?: string): void {
  revalidateTag('links-hub')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/links')
  if (siteId) revalidateTag(`links:${siteId}`)
}

// ─── Zod schemas ────────────────────────────────────────────────────────────

const sourceTypes = ['manual', 'campaign', 'newsletter', 'blog', 'social', 'print'] as const

const CreateLinkSchema = z.object({
  destination_url: z.string().url('invalid_url'),
  title: z.string().optional(),
  code: z.string().max(64).optional(),
  slug: z.string().max(255).optional(),
  redirect_type: z.enum(['301', '302', '307', '308']).optional(),
  source_type: z.enum(sourceTypes).optional(),
  source_id: z.string().uuid().optional(),
  utm_source: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_source', v)),
  utm_medium: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_medium', v)),
  utm_campaign: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_campaign', v)),
  utm_term: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_term', v)),
  utm_content: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_content', v)),
  utm_id: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_id', v)),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().optional(),
  activates_at: z.string().datetime().optional(),
  pass_click_ids: z.boolean().optional(),
})

const UpdateLinkSchema = z.object({
  destination_url: z.string().url('invalid_url').optional(),
  title: z.string().optional(),
  slug: z.string().max(255).nullable().optional(),
  redirect_type: z.enum(['301', '302', '307', '308']).optional(),
  source_type: z.enum(sourceTypes).optional(),
  utm_source: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_source', v)),
  utm_medium: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_medium', v)),
  utm_campaign: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_campaign', v)),
  utm_term: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_term', v)),
  utm_content: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_content', v)),
  utm_id: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_id', v)),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  activates_at: z.string().datetime().nullable().optional(),
  pass_click_ids: z.boolean().optional(),
})

const AlertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  link_id: z.string().uuid(),
  metric: z.enum(['clicks', 'unique_visitors', 'bounce_rate']),
  operator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  threshold: z.number().positive(),
  window_minutes: z.number().int().min(5).max(10080),
  notify_email: z.string().email().optional(),
  active: z.boolean().optional(),
})

const GetLinksFiltersSchema = z.object({
  search: z.string().optional(),
  source_type: z.enum(sourceTypes).optional(),
  active: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
  sort_by: z.enum(['created_at', 'total_clicks', 'title']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
})

// ─── Short code generation ──────────────────────────────────────────────────

function generateShortCode(length = 7): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const maxUnbiased = 248
  const result: string[] = []
  while (result.length < length) {
    const bytes = new Uint8Array(length * 2)
    crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (b >= maxUnbiased) continue
      result.push(alphabet[b % alphabet.length]!)
      if (result.length === length) break
    }
  }
  return result.join('')
}

// ─── CRUD Actions ───────────────────────────────────────────────────────────

export async function createLink(
  input: z.input<typeof CreateLinkSchema>,
): Promise<ActionResult<{ linkId: string }>> {
  const parsed = CreateLinkSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const firstError = firstIssue?.message ?? 'validation_failed'
    return { ok: false, error: firstError }
  }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()
  const code = parsed.data.code || generateShortCode()

  const insertData: Record<string, unknown> = {
    site_id: siteId,
    destination_url: parsed.data.destination_url,
    code,
    slug: parsed.data.slug ?? null,
    title: parsed.data.title ?? null,
    redirect_type: Number(parsed.data.redirect_type ?? '307') as 301 | 302 | 307 | 308,
    source_type: parsed.data.source_type ?? 'manual',
    source_id: parsed.data.source_id ?? null,
    utm_source: parsed.data.utm_source ?? null,
    utm_medium: parsed.data.utm_medium ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    utm_term: parsed.data.utm_term ?? null,
    utm_content: parsed.data.utm_content ?? null,
    utm_id: parsed.data.utm_id ?? null,
    tags: parsed.data.tags ?? [],
    expires_at: parsed.data.expires_at ?? null,
    active: true,
    activates_at: parsed.data.activates_at ?? null,
    pass_click_ids: parsed.data.pass_click_ids ?? true,
  }

  const { data, error } = await supabase
    .from('tracked_links')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'code_taken' }
    return { ok: false, error: error.message }
  }

  revalidateLinksHub(siteId)
  return { ok: true, linkId: data.id as string }
}

export async function updateLink(
  id: string,
  input: z.input<typeof UpdateLinkSchema>,
): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const parsed = UpdateLinkSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const firstError = firstIssue?.message ?? 'validation_failed'
    return { ok: false, error: firstError }
  }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const d = parsed.data
  if (d.destination_url !== undefined) updateData.destination_url = d.destination_url
  if (d.title !== undefined) updateData.title = d.title
  if (d.slug !== undefined) updateData.slug = d.slug
  if (d.redirect_type !== undefined) updateData.redirect_type = Number(d.redirect_type)
  if (d.source_type !== undefined) updateData.source_type = d.source_type
  if (d.utm_source !== undefined) updateData.utm_source = d.utm_source
  if (d.utm_medium !== undefined) updateData.utm_medium = d.utm_medium
  if (d.utm_campaign !== undefined) updateData.utm_campaign = d.utm_campaign
  if (d.utm_term !== undefined) updateData.utm_term = d.utm_term
  if (d.utm_content !== undefined) updateData.utm_content = d.utm_content
  if (d.utm_id !== undefined) updateData.utm_id = d.utm_id
  if (d.tags !== undefined) updateData.tags = d.tags
  if (d.expires_at !== undefined) updateData.expires_at = d.expires_at
  if (d.activates_at !== undefined) updateData.activates_at = d.activates_at
  if (d.pass_click_ids !== undefined) updateData.pass_click_ids = d.pass_click_ids

  const { error } = await supabase
    .from('tracked_links')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  revalidateTag(`link:${id}`)
  return { ok: true }
}

export async function deleteLink(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // Soft delete
  const { error } = await supabase
    .from('tracked_links')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  revalidateTag(`link:${id}`)
  return { ok: true }
}

export async function duplicateLink(id: string): Promise<ActionResult<{ linkId: string }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: original, error: fetchErr } = await supabase
    .from('tracked_links')
    .select('destination_url, title, source_type, tags, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, redirect_type, expires_at, pass_click_ids, custom_params, activates_at')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !original) return { ok: false, error: 'not_found' }

  const newCode = generateShortCode()
  const { data, error } = await supabase
    .from('tracked_links')
    .insert({
      site_id: siteId,
      destination_url: original.destination_url,
      code: newCode,
      title: original.title ? `${original.title} (copy)` : null,
      source_type: original.source_type,
      tags: original.tags,
      ...normalizeAllUtmFields({
        utm_source: original.utm_source,
        utm_medium: original.utm_medium,
        utm_campaign: original.utm_campaign,
        utm_term: original.utm_term,
        utm_content: original.utm_content,
        utm_id: original.utm_id,
      }),
      redirect_type: original.redirect_type,
      expires_at: original.expires_at,
      pass_click_ids: original.pass_click_ids ?? true,
      custom_params: original.custom_params ?? null,
      activates_at: original.activates_at ?? null,
      active: true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  return { ok: true, linkId: data.id as string }
}

export async function toggleLinkActive(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: current, error: fetchError } = await supabase
    .from('tracked_links')
    .select('id, active')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !current) return { ok: false, error: 'not_found' }

  const { error } = await supabase
    .from('tracked_links')
    .update({ active: !current.active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  revalidateTag(`link:${id}`)
  return { ok: true }
}

export async function bulkDeleteLinks(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: 'ids_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('tracked_links')
    .update({ deleted_at: new Date().toISOString(), active: false })
    .in('id', ids)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  return { ok: true }
}

export async function bulkToggleLinks(ids: string[], active: boolean): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: 'ids_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('tracked_links')
    .update({ active, updated_at: new Date().toISOString() })
    .in('id', ids)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateLinksHub(siteId)
  return { ok: true }
}

export async function checkCodeAvailable(code: string): Promise<ActionResult<{ available: boolean }>> {
  if (!code) return { ok: false, error: 'code_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('tracked_links')
    .select('id')
    .eq('site_id', siteId)
    .eq('code', code)
    .maybeSingle()

  return { ok: true, available: !data }
}

export async function updateQrConfig(
  id: string,
  config: { foreground?: string; background?: string; logo?: boolean; error_correction?: string; size?: number },
): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('tracked_links')
    .update({ qr_config: config, has_qr: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${id}`)
  return { ok: true }
}

export async function createAnnotation(input: {
  link_id: string
  label: string
  icon?: string
  color?: string
  annotated_at?: string
}): Promise<ActionResult<{ annotationId: string }>> {
  if (!input.link_id || !input.label) return { ok: false, error: 'validation_failed' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_annotations')
    .insert({
      link_id: input.link_id,
      site_id: siteId,
      label: input.label,
      icon: input.icon ?? null,
      color: input.color ?? null,
      annotated_at: input.annotated_at ?? new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${input.link_id}`)
  return { ok: true, annotationId: data.id as string }
}

export async function createGoal(input: {
  link_id: string
  metric: string
  target_value: number
  deadline?: string
}): Promise<ActionResult<{ goalId: string }>> {
  if (!input.link_id || !input.metric) return { ok: false, error: 'validation_failed' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_goals')
    .insert({
      link_id: input.link_id,
      site_id: siteId,
      metric: input.metric,
      target_value: input.target_value,
      deadline: input.deadline ?? null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${input.link_id}`)
  return { ok: true, goalId: data.id as string }
}

export async function createAlert(input: {
  link_id: string
  alert_type: string
  metric: string
  condition: Record<string, unknown>
}): Promise<ActionResult<{ alertId: string }>> {
  if (!input.link_id || !input.metric) return { ok: false, error: 'validation_failed' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('link_alerts')
    .insert({
      link_id: input.link_id,
      site_id: siteId,
      alert_type: input.alert_type,
      metric: input.metric,
      condition: input.condition,
      active: true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag(`link:${input.link_id}`)
  revalidateTag('link-alerts')
  return { ok: true, alertId: data.id as string }
}

export async function saveAlertRule(
  input: z.input<typeof AlertRuleSchema>,
): Promise<ActionResult<{ ruleId?: string }>> {
  const parsed = AlertRuleSchema.safeParse(input)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const firstError = firstIssue?.message ?? 'validation_failed'
    return { ok: false, error: firstError }
  }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  if (parsed.data.id) {
    const { error } = await supabase
      .from('link_alerts')
      .update({
        metric: parsed.data.metric,
        condition: {
          operator: parsed.data.operator,
          threshold: parsed.data.threshold,
          window_minutes: parsed.data.window_minutes,
        },
        notify_channels: parsed.data.notify_email
          ? [{ type: 'email', address: parsed.data.notify_email }]
          : [],
        active: parsed.data.active ?? true,
      })
      .eq('id', parsed.data.id)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message }
    revalidateTag('link-alerts')
    return { ok: true, ruleId: parsed.data.id }
  }

  const { data, error } = await supabase
    .from('link_alerts')
    .insert({
      site_id: siteId,
      link_id: parsed.data.link_id,
      alert_type: 'threshold',
      metric: parsed.data.metric,
      condition: {
        operator: parsed.data.operator,
        threshold: parsed.data.threshold,
        window_minutes: parsed.data.window_minutes,
      },
      notify_channels: parsed.data.notify_email
        ? [{ type: 'email', address: parsed.data.notify_email }]
        : [],
      active: parsed.data.active ?? true,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }

  revalidateTag('link-alerts')
  return { ok: true, ruleId: data.id as string }
}

export async function toggleAlert(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: current, error: fetchErr } = await supabase
    .from('link_alerts')
    .select('id, active')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !current) return { ok: false, error: 'not_found' }

  const { error } = await supabase
    .from('link_alerts')
    .update({ active: !current.active })
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('link-alerts')
  return { ok: true }
}

export async function deleteAlertRule(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { error } = await supabase
    .from('link_alerts')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('link-alerts')
  return { ok: true }
}

// ─── Read Actions ───────────────────────────────────────────────────────────

export async function getLinks(
  siteId: string,
  filters: z.input<typeof GetLinksFiltersSchema>,
): Promise<ActionResult<{ links: Record<string, unknown>[]; total: number }>> {
  const parsed = GetLinksFiltersSchema.safeParse(filters)
  if (!parsed.success) return { ok: false, error: 'invalid_filters' }

  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  const page = parsed.data.page ?? 1
  const perPage = parsed.data.per_page ?? 20
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabase
    .from('tracked_links')
    .select('*', { count: 'exact' })
    .eq('site_id', siteId)
    .is('deleted_at', null)

  if (parsed.data.search) {
    const escaped = parsed.data.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.ilike('title', `%${escaped}%`)
  }
  if (parsed.data.source_type) {
    query = query.eq('source_type', parsed.data.source_type)
  }
  if (parsed.data.active !== undefined) {
    query = query.eq('active', parsed.data.active)
  }

  const sortBy = parsed.data.sort_by ?? 'created_at'
  const sortOrder = parsed.data.sort_order ?? 'desc'
  query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to)

  const { data, error, count } = await query

  if (error) return { ok: false, error: error.message }
  return { ok: true, links: data ?? [], total: count ?? 0 }
}

export async function getLinkDetail(
  id: string,
): Promise<ActionResult<{ link: Record<string, unknown> }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'not_found' }

  return { ok: true, link: data }
}

export async function getAiInsights(
  id: string,
): Promise<ActionResult<{ insights: unknown[] }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, title, destination_url, created_at, total_clicks, unique_visitors')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) return { ok: false, error: 'not_found' }

  const { data: metrics } = await supabase
    .from('link_daily_metrics')
    .select('date, clicks, unique_visitors')
    .eq('link_id', id)
    .order('date', { ascending: false })
    .limit(30)

  const insights: unknown[] = []
  const metricRows = metrics ?? []

  if (metricRows.length >= 7) {
    const recent7 = metricRows.slice(0, 7)
    const prior7 = metricRows.slice(7, 14)
    if (prior7.length >= 7) {
      const recentSum = recent7.reduce((s, r) => s + ((r.clicks as number) ?? 0), 0)
      const priorSum = prior7.reduce((s, r) => s + ((r.clicks as number) ?? 0), 0)
      if (priorSum > 0) {
        const change = ((recentSum - priorSum) / priorSum) * 100
        if (Math.abs(change) > 20) {
          insights.push({
            type: change > 0 ? 'trending_up' : 'trending_down',
            message: `Click traffic ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(change))}% vs prior 7 days`,
            severity: Math.abs(change) > 50 ? 'high' : 'medium',
          })
        }
      }
    }
  }

  return { ok: true, insights }
}

export async function generateQr(
  id: string,
  config: { size?: number; foreground?: string; background?: string; logo?: boolean },
): Promise<ActionResult<{ qrUrl: string }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, code')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) return { ok: false, error: 'not_found' }

  const shortUrl = buildShortUrl(link.code)
  const size = config.size ?? 256
  const fg = config.foreground ?? '#000000'
  const bg = config.background ?? '#FFFFFF'

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
  if (!HEX_COLOR.test(fg) || !HEX_COLOR.test(bg)) {
    return { ok: false, error: 'invalid_color_format' }
  }

  const { svg } = await generateQrSvg({
    url: shortUrl,
    size,
    darkColor: fg,
    lightColor: bg,
    errorCorrection: 'M',
  })

  const svgFile = new File([svg], `qr-${link.code}.svg`, { type: 'image/svg+xml' })
  const { uploadMediaAsset } = await import('@/lib/media/upload')
  const result = await uploadMediaAsset({
    file: svgFile,
    filename: `qr-${link.code}.svg`,
    folder: 'links',
    siteId,
    uploadedBy: 'system',
    tags: ['qr', `link:${id}`],
  })
  if (!result.ok) return { ok: false, error: result.error }
  await supabase
    .from('tracked_links')
    .update({ qr_storage_path: result.asset.blobPathname, has_qr: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)
  revalidateTag(`link:${id}`)
  return { ok: true, qrUrl: result.asset.blobUrl }
}

const SSRF_PRIVATE_IP_RE =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|localhost|\[?::1\]?|\[?::ffff:[^\]]*\]?|\[?fe80:[^\]]*\]?|\[?fc[0-9a-f]{2}:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?)/i

export async function validateDestinationUrl(
  url: string,
): Promise<ActionResult<{ status: number; finalUrl: string; durationMs: number }>> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, error: 'invalid_url' }
  }

  const host = parsed.hostname.toLowerCase()
  if (
    SSRF_PRIVATE_IP_RE.test(host) ||
    host === 'metadata.google.internal'
  ) {
    return { ok: false, error: 'invalid_url' }
  }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  try {
    const start = Date.now()
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })
    const durationMs = Date.now() - start
    return { ok: true, status: res.status, finalUrl: res.url, durationMs }
  } catch {
    return { ok: false, error: 'unreachable' }
  }
}

// ─── Settings Actions ───────────────────────────────────────────────────────

export async function saveLinkSettings(input: {
  default_redirect_type?: number
  default_utm_source?: string
  default_code_length?: number
  auto_qr?: boolean
  bot_filtering?: boolean
}): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const normalizedUtmSource = input.default_utm_source
    ? normalizeUtmValue('utm_source', input.default_utm_source)
    : input.default_utm_source

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('link_settings')
    .upsert(
      {
        site_id: siteId,
        default_redirect_type: input.default_redirect_type ?? 307,
        default_code_length: input.default_code_length ?? 6,
        auto_qr: input.auto_qr ?? false,
        bot_filtering: input.bot_filtering ?? true,
        config: { default_utm_source: normalizedUtmSource },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'site_id' },
    )

  if (error) return { ok: false, error: error.message }
  revalidateTag('links-settings')
  return { ok: true }
}

export async function saveUtmPreset(input: {
  name: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
}): Promise<ActionResult<{ id: string }>> {
  if (!input.name) return { ok: false, error: 'name_required' }
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const normalized = normalizeAllUtmFields({
    utm_source: input.utm_source,
    utm_medium: input.utm_medium,
    utm_campaign: input.utm_campaign,
  })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('link_utm_presets')
    .insert({
      site_id: siteId,
      name: input.name,
      ...normalized,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateTag('links-settings')
  return { ok: true, id: data.id }
}

export async function deleteUtmPreset(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('link_utm_presets')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('links-settings')
  return { ok: true }
}

export async function saveQrTemplate(input: {
  name: string
  config: Record<string, unknown>
}): Promise<ActionResult<{ id: string }>> {
  if (!input.name) return { ok: false, error: 'name_required' }
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('link_qr_templates')
    .insert({
      site_id: siteId,
      name: input.name,
      config: input.config,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateTag('links-settings')
  return { ok: true, id: data.id }
}

export async function deleteQrTemplate(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('link_qr_templates')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  revalidateTag('links-settings')
  return { ok: true }
}

// ─── Batch Operations ───────────────────────────────────────────────────────

const BatchFiltersSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  utm_campaign: z.string().optional(),
  source_type: z.enum(sourceTypes).optional(),
  active: z.boolean().optional(),
})

const BatchUpdateSchema = z.object({
  utm_source: z
    .string()
    .max(255)
    .nullish()
    .transform(v => (v ? normalizeUtmValue('utm_source', v) : v)),
  utm_medium: z
    .string()
    .max(255)
    .nullish()
    .transform(v => (v ? normalizeUtmValue('utm_medium', v) : v)),
  utm_campaign: z
    .string()
    .max(255)
    .nullish()
    .transform(v => (v ? normalizeUtmValue('utm_campaign', v) : v)),
  expires_at: z.string().datetime().nullish(),
  activates_at: z.string().datetime().nullish(),
  active: z.boolean().optional(),
  pass_click_ids: z.boolean().optional(),
})

export async function previewBatchUpdate(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
): Promise<
  ActionResult<{
    links: Array<{ id: string; code: string; title: string | null; utm_campaign: string | null }>
    total: number
  }>
> {
  const { siteId: ctxSiteId } = await getSiteContext()
  if (siteId !== ctxSiteId) return { ok: false, error: 'forbidden' }
  await requireEditScope(siteId)
  const parsed = BatchFiltersSchema.safeParse(filters)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('tracked_links')
    .select('id, code, title, utm_campaign', { count: 'exact' })
    .eq('site_id', siteId)
    .is('deleted_at', null)
  if (parsed.data.ids) query = query.in('id', parsed.data.ids)
  if (parsed.data.tags) query = query.overlaps('tags', parsed.data.tags)
  if (parsed.data.utm_campaign) query = query.eq('utm_campaign', parsed.data.utm_campaign)
  if (parsed.data.source_type) query = query.eq('source_type', parsed.data.source_type)
  if (parsed.data.active !== undefined) query = query.eq('active', parsed.data.active)
  const { data, count, error } = await query.limit(100)
  if (error) return { ok: false, error: error.message }
  return { ok: true, links: data ?? [], total: count ?? 0 }
}

export async function batchUpdateLinks(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
  updates: z.input<typeof BatchUpdateSchema>,
): Promise<ActionResult<{ updated: number }>> {
  const { siteId: ctxSiteId } = await getSiteContext()
  if (siteId !== ctxSiteId) return { ok: false, error: 'forbidden' }
  const { userId } = await requireEditScope(siteId)
  const filtersParsed = BatchFiltersSchema.safeParse(filters)
  if (!filtersParsed.success) return { ok: false, error: filtersParsed.error.message }
  const updatesParsed = BatchUpdateSchema.safeParse(updates)
  if (!updatesParsed.success) return { ok: false, error: updatesParsed.error.message }
  const updateObj: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updatesParsed.data)) {
    if (value !== undefined) updateObj[key] = value
  }
  if (Object.keys(updateObj).length === 0) return { ok: false, error: 'No updates provided' }
  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('tracked_links')
    .update(updateObj)
    .eq('site_id', siteId)
    .is('deleted_at', null)
  if (filtersParsed.data.ids) query = query.in('id', filtersParsed.data.ids)
  if (filtersParsed.data.tags) query = query.overlaps('tags', filtersParsed.data.tags)
  if (filtersParsed.data.utm_campaign) query = query.eq('utm_campaign', filtersParsed.data.utm_campaign)
  if (filtersParsed.data.source_type) query = query.eq('source_type', filtersParsed.data.source_type)
  if (filtersParsed.data.active !== undefined) query = query.eq('active', filtersParsed.data.active)
  const { data: updated, error } = await query.select('id')
  if (error) return { ok: false, error: error.message }
  if (updated && updated.length > 0) {
    const label = `batch_update: ${Object.keys(updateObj).join(', ')}`
    await supabase.from('link_annotations').insert(
      updated.map((row) => ({
        link_id: row.id,
        site_id: siteId,
        label,
        created_by: userId,
      })),
    )
  }
  return { ok: true, updated: updated?.length ?? 0 }
}

export async function batchExtendExpiry(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
  hours: number,
): Promise<ActionResult<{ extended: number }>> {
  const { siteId: ctxSiteId } = await getSiteContext()
  if (siteId !== ctxSiteId) return { ok: false, error: 'forbidden' }
  const { userId } = await requireEditScope(siteId)
  const parsed = BatchFiltersSchema.safeParse(filters)
  if (!parsed.success) return { ok: false, error: parsed.error.message }
  if (hours < 1 || hours > 8760) return { ok: false, error: 'Hours must be 1-8760' }
  const supabase = getSupabaseServiceClient()
  let affectedQuery = supabase
    .from('tracked_links')
    .select('id')
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .eq('active', true)
    .not('expires_at', 'is', null)
  if (parsed.data.utm_campaign) affectedQuery = affectedQuery.eq('utm_campaign', parsed.data.utm_campaign)
  if (parsed.data.tags) affectedQuery = affectedQuery.overlaps('tags', parsed.data.tags)
  const { data: affectedLinks } = await affectedQuery
  const { data: count, error } = await supabase.rpc('batch_extend_link_expiry', {
    p_site_id: siteId,
    p_campaign: parsed.data.utm_campaign ?? null,
    p_tags: parsed.data.tags ?? null,
    p_hours: hours,
  })
  if (error) return { ok: false, error: error.message }
  if (affectedLinks && affectedLinks.length > 0) {
    await supabase.from('link_annotations').insert(
      affectedLinks.map((row) => ({
        link_id: row.id,
        site_id: siteId,
        label: `batch_extend: +${hours}h`,
        created_by: userId,
      })),
    )
  }
  return { ok: true, extended: count ?? 0 }
}

export async function batchActivateNow(siteId: string, campaign: string): Promise<ActionResult<{ updated: number }>> {
  return batchUpdateLinks(siteId, { utm_campaign: campaign }, { active: true, activates_at: null })
}

// ─── CSV Export ────────────────────────────────────────────────────────────

export async function exportAnalyticsCsv(): Promise<ActionResult<{ csv: string }>> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('tracked_links')
    .select('id, code, title, destination_url, source_type, active, total_clicks, unique_visitors, health_status, redirect_type, pass_click_ids, created_at, expires_at')
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .order('total_clicks', { ascending: false })

  if (error) return { ok: false, error: error.message }

  const { buildLinksCsv } = await import('@/lib/links/csv-builder')
  const { SOURCE_LABELS } = await import('@tn-figueiredo/links-admin')

  const links = (data ?? []).map((l) => ({
    id: l.id as string,
    title: (l.title as string) ?? (l.code as string),
    slug: `/${l.code as string}`,
    source: (['newsletter', 'social', 'blog', 'qr', 'campaign'].includes(l.source_type as string) ? l.source_type : 'manual') as 'newsletter' | 'social' | 'blog' | 'qr' | 'campaign' | 'manual',
    badge: SOURCE_LABELS[(['newsletter', 'social', 'blog', 'qr', 'campaign'].includes(l.source_type as string) ? l.source_type : 'manual') as keyof typeof SOURCE_LABELS] ?? 'Manual',
    dest: (l.destination_url as string) ?? '',
    status: (l.active as boolean) ? 'active' as const : 'paused' as const,
    clicks: (l.total_clicks as number) ?? 0,
    last30: 0,
    unique: (l.unique_visitors as number) ?? 0,
    scans: 0,
    topCountry: '',
    ctr: 0,
    created: new Date((l.created_at as string) ?? '').toLocaleDateString('pt-BR'),
    health: ((l.health_status as string) === 'broken' ? 'broken' : (l.health_status as string) === 'warn' ? 'warn' : 'ok') as 'ok' | 'warn' | 'broken',
    redirect: 301 as const,
    clickIds: (l.pass_click_ids as boolean) ?? false,
    spark: [],
  }))

  const csv = buildLinksCsv(links)
  return { ok: true, csv }
}

// ─── Linktree Actions (async wrappers — 'use server' requires async exports) ──

import {
  saveLinktreeConfig as _saveLinktreeConfig,
  loadLinktreeConfig as _loadLinktreeConfig,
} from '../linktree/actions'

export async function saveLinktreeConfig(
  ...args: Parameters<typeof _saveLinktreeConfig>
) {
  return _saveLinktreeConfig(...args)
}

export async function loadLinktreeConfig(
  ...args: Parameters<typeof _loadLinktreeConfig>
) {
  return _loadLinktreeConfig(...args)
}
