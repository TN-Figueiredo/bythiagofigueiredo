'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

// ─── Auth helper ────────────────────────────────────────────────────────────

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
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
  redirect_type: z.enum(['301', '302']).optional(),
  source_type: z.enum(sourceTypes).optional(),
  source_id: z.string().uuid().optional(),
  utm_source: z.string().max(255).optional(),
  utm_medium: z.string().max(255).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().optional(),
})

const UpdateLinkSchema = z.object({
  destination_url: z.string().url('invalid_url').optional(),
  title: z.string().optional(),
  slug: z.string().max(255).nullable().optional(),
  source_type: z.enum(sourceTypes).optional(),
  utm_source: z.string().max(255).optional(),
  utm_medium: z.string().max(255).optional(),
  utm_campaign: z.string().max(255).optional(),
  utm_term: z.string().max(255).optional(),
  utm_content: z.string().max(255).optional(),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().nullable().optional(),
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
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
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
    redirect_type: parsed.data.redirect_type === '301' ? 301 : 302,
    source_type: parsed.data.source_type ?? 'manual',
    source_id: parsed.data.source_id ?? null,
    utm_source: parsed.data.utm_source ?? null,
    utm_medium: parsed.data.utm_medium ?? null,
    utm_campaign: parsed.data.utm_campaign ?? null,
    utm_term: parsed.data.utm_term ?? null,
    utm_content: parsed.data.utm_content ?? null,
    tags: parsed.data.tags ?? [],
    expires_at: parsed.data.expires_at ?? null,
    active: true,
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
  if (d.source_type !== undefined) updateData.source_type = d.source_type
  if (d.utm_source !== undefined) updateData.utm_source = d.utm_source
  if (d.utm_medium !== undefined) updateData.utm_medium = d.utm_medium
  if (d.utm_campaign !== undefined) updateData.utm_campaign = d.utm_campaign
  if (d.utm_term !== undefined) updateData.utm_term = d.utm_term
  if (d.utm_content !== undefined) updateData.utm_content = d.utm_content
  if (d.tags !== undefined) updateData.tags = d.tags
  if (d.expires_at !== undefined) updateData.expires_at = d.expires_at

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
    .select('destination_url, title, source_type, tags, utm_source, utm_medium, utm_campaign, utm_term, utm_content, redirect_type, expires_at')
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
      utm_source: original.utm_source,
      utm_medium: original.utm_medium,
      utm_campaign: original.utm_campaign,
      utm_term: original.utm_term,
      utm_content: original.utm_content,
      redirect_type: original.redirect_type,
      expires_at: original.expires_at,
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
): Promise<ActionResult<{ links: unknown[]; total: number }>> {
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
    query = query.ilike('title', `%${parsed.data.search}%`)
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
): Promise<ActionResult<{ link: unknown }>> {
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

  if (process.env.LINKS_AI_INSIGHTS_ENABLED === 'false') {
    return { ok: false, error: 'feature_disabled' }
  }

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const shortUrl = `${appUrl}/go/${link.code}`
  const size = config.size ?? 256
  const fg = config.foreground ?? '#000000'
  const bg = config.background ?? '#FFFFFF'

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
  if (!HEX_COLOR.test(fg) || !HEX_COLOR.test(bg)) {
    return { ok: false, error: 'invalid_color_format' }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect fill="${bg}" width="${size}" height="${size}"/><text x="50%" y="50%" fill="${fg}" text-anchor="middle" dominant-baseline="central" font-size="10">${shortUrl}</text></svg>`

  const path = `${siteId}/qr/${id}.svg`
  const { error: uploadError } = await supabase.storage
    .from('link-assets')
    .upload(path, Buffer.from(svg), { contentType: 'image/svg+xml', upsert: true })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('link-assets').getPublicUrl(path)

  await supabase
    .from('tracked_links')
    .update({ qr_storage_path: path, has_qr: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  revalidateTag(`link:${id}`)
  return { ok: true, qrUrl: publicUrl }
}

export async function validateDestinationUrl(
  url: string,
): Promise<ActionResult<{ status: number; finalUrl: string; durationMs: number }>> {
  try {
    new URL(url)
  } catch {
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

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('link_settings')
    .upsert(
      {
        site_id: siteId,
        default_redirect_type: input.default_redirect_type ?? 302,
        default_code_length: input.default_code_length ?? 6,
        auto_qr: input.auto_qr ?? false,
        bot_filtering: input.bot_filtering ?? true,
        config: { default_utm_source: input.default_utm_source },
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

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('link_utm_presets')
    .insert({
      site_id: siteId,
      name: input.name,
      utm_source: input.utm_source || null,
      utm_medium: input.utm_medium || null,
      utm_campaign: input.utm_campaign || null,
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
