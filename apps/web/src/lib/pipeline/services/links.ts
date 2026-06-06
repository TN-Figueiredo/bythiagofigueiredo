/**
 * Shared service layer for tracked links (the Links / go-links engine).
 *
 * Additive and self-contained: mirrors the conventions of `services/research-focos.ts`
 * (ServiceContext, supabase from ctx, Zod validation, ServiceResult ok/err return
 * shape, site scoping) and replicates the business logic of the web server action
 * `cms/(authed)/links/actions.ts` (CreateLinkSchema fields, short-code generation,
 * per-site code uniqueness) — without calling that action, which is auth-bound to a
 * session. Every link created here is scoped to ctx.siteId and source_type 'manual'.
 *
 * Links resolve at `/go/{code}` (or `https://{LINKS_SHORT_DOMAIN}/{code}`).
 */
import { z } from 'zod'
import { normalizeUtmValue } from '@tn-figueiredo/links'
import { buildShortUrl } from '@/lib/links/short-url'
import { UUID_REGEX } from '@/lib/pipeline/auth'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'

// ---------------------------------------------------------------------------
// Result shapes
// ---------------------------------------------------------------------------

interface TrackedLinkRow {
  id: string
  site_id: string
  code: string
  slug: string | null
  destination_url: string
  title: string | null
  tags: string[]
  source_type: string
  source_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  utm_id: string | null
  redirect_type: number
  active: boolean
  total_clicks: number
  unique_visitors: number
  last_clicked_at: string | null
  expires_at: string | null
  activates_at: string | null
  pass_click_ids: boolean
  created_at: string
  updated_at: string
}

interface TrackedLinkWithUrl extends TrackedLinkRow {
  short_url: string
}

interface LinkListResult {
  data: TrackedLinkWithUrl[]
  meta: { total: number; has_next: boolean; next_cursor?: string; limit: number }
}

const LINK_SELECT =
  'id, site_id, code, slug, destination_url, title, tags, source_type, source_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, redirect_type, active, total_clicks, unique_visitors, last_clicked_at, expires_at, activates_at, pass_click_ids, created_at, updated_at'

function withShortUrl(row: TrackedLinkRow): TrackedLinkWithUrl {
  return { ...row, short_url: buildShortUrl(row.code) }
}

// ---------------------------------------------------------------------------
// Zod schemas (mirror cms/links CreateLinkSchema / UpdateLinkSchema)
// ---------------------------------------------------------------------------

const REDIRECT_TYPES = ['301', '302', '307', '308'] as const

const CreateTrackedLinkSchema = z.object({
  destination_url: z.string().url('Invalid destination_url'),
  title: z.string().max(500).optional(),
  code: z.string().max(64).optional(),
  slug: z.string().max(255).optional(),
  redirect_type: z.enum(REDIRECT_TYPES).optional(),
  utm_source: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_source', v)),
  utm_medium: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_medium', v)),
  utm_campaign: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_campaign', v)),
  utm_term: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_term', v)),
  utm_content: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_content', v)),
  utm_id: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_id', v)),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().optional(),
  activates_at: z.string().datetime().optional(),
  pass_click_ids: z.boolean().optional(),
})

const UpdateTrackedLinkSchema = z.object({
  destination_url: z.string().url('Invalid destination_url').optional(),
  title: z.string().max(500).nullable().optional(),
  slug: z.string().max(255).nullable().optional(),
  redirect_type: z.enum(REDIRECT_TYPES).optional(),
  utm_source: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_source', v)),
  utm_medium: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_medium', v)),
  utm_campaign: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_campaign', v)),
  utm_term: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_term', v)),
  utm_content: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_content', v)),
  utm_id: z.string().max(255).optional().transform((v) => normalizeUtmValue('utm_id', v)),
  tags: z.array(z.string()).optional(),
  expires_at: z.string().datetime().nullable().optional(),
  activates_at: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
  pass_click_ids: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// Short code generation (replicated from cms/links/actions.ts — crypto-grade,
// unbiased rejection sampling so codes are URL-safe and collision-resistant)
// ---------------------------------------------------------------------------

export function generateShortCode(length = 7): string {
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

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

interface ListLinksOptions {
  utm_campaign?: string
  active?: boolean
  search?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** List tracked links for a site, newest first, with optional filters + offset pagination. */
export async function listTrackedLinks(
  ctx: ServiceContext,
  opts: ListLinksOptions = {},
): Promise<ServiceResult<LinkListResult>> {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = Math.max(opts.offset ?? 0, 0)
  const { supabase, siteId } = ctx

  let query = supabase
    .from('tracked_links')
    .select(LINK_SELECT, { count: 'exact' })
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit) // limit + 1 to detect has_next

  if (opts.utm_campaign) query = query.eq('utm_campaign', opts.utm_campaign)
  if (opts.active !== undefined) query = query.eq('active', opts.active)
  if (opts.search) {
    const escaped = opts.search.replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(`title.ilike.%${escaped}%,code.ilike.%${escaped}%`)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[links/list]', error.message)
    return err('DB_ERROR', 'Failed to load links', 500)
  }

  const rows = (data ?? []) as unknown as TrackedLinkRow[]
  const hasNext = rows.length > limit
  const page = (hasNext ? rows.slice(0, limit) : rows).map(withShortUrl)

  return ok({
    data: page,
    meta: {
      total: count ?? 0,
      has_next: hasNext,
      next_cursor: hasNext ? String(offset + limit) : undefined,
      limit,
    },
  })
}

/** Get a single tracked link (site-scoped). */
export async function getTrackedLink(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<TrackedLinkWithUrl>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid link ID', 400)
  }

  const { supabase, siteId } = ctx
  const { data, error } = await supabase
    .from('tracked_links')
    .select(LINK_SELECT)
    .eq('id', id)
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    return err('NOT_FOUND', 'Link not found', 404)
  }

  return ok(withShortUrl(data as unknown as TrackedLinkRow))
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Create a tracked link scoped to the site.
 * Generates a short code if none supplied; enforces per-site code uniqueness
 * (DB unique (site_id, code) → 23505 mapped to a VALIDATION_ERROR).
 */
export async function createTrackedLink(
  ctx: ServiceContext,
  input: unknown,
): Promise<ServiceResult<TrackedLinkWithUrl>> {
  const parsed = CreateTrackedLinkSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx
  const d = parsed.data
  const code = d.code || generateShortCode()

  const insertData = {
    site_id: siteId,
    destination_url: d.destination_url,
    code,
    slug: d.slug ?? null,
    title: d.title ?? null,
    redirect_type: Number(d.redirect_type ?? '307'),
    source_type: 'manual' as const,
    utm_source: d.utm_source ?? null,
    utm_medium: d.utm_medium ?? null,
    utm_campaign: d.utm_campaign ?? null,
    utm_term: d.utm_term ?? null,
    utm_content: d.utm_content ?? null,
    utm_id: d.utm_id ?? null,
    tags: d.tags ?? [],
    expires_at: d.expires_at ?? null,
    activates_at: d.activates_at ?? null,
    pass_click_ids: d.pass_click_ids ?? true,
    active: true,
  }

  const { data, error } = await supabase
    .from('tracked_links')
    .insert(insertData)
    .select(LINK_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return err('VALIDATION_ERROR', `Code "${code}" is already taken for this site`, 409)
    }
    console.error('[links/create]', error?.message)
    return err('DB_ERROR', error?.message ?? 'Failed to create link', 500)
  }

  return ok(withShortUrl(data as unknown as TrackedLinkRow), 201)
}

/** Update a tracked link's scalar fields (site-scoped). */
export async function updateTrackedLink(
  ctx: ServiceContext,
  id: string,
  input: unknown,
): Promise<ServiceResult<TrackedLinkWithUrl>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid link ID', 400)
  }

  const parsed = UpdateTrackedLinkSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx

  // Verify ownership before mutating.
  const { data: owned } = await supabase
    .from('tracked_links')
    .select('id')
    .eq('id', id)
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .single()

  if (!owned) return err('NOT_FOUND', 'Link not found', 404)

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const d = parsed.data
  if (d.destination_url !== undefined) updateData.destination_url = d.destination_url
  if (d.title !== undefined) updateData.title = d.title
  if (d.slug !== undefined) updateData.slug = d.slug
  if (d.redirect_type !== undefined) updateData.redirect_type = Number(d.redirect_type)
  if (d.utm_source !== undefined) updateData.utm_source = d.utm_source
  if (d.utm_medium !== undefined) updateData.utm_medium = d.utm_medium
  if (d.utm_campaign !== undefined) updateData.utm_campaign = d.utm_campaign
  if (d.utm_term !== undefined) updateData.utm_term = d.utm_term
  if (d.utm_content !== undefined) updateData.utm_content = d.utm_content
  if (d.utm_id !== undefined) updateData.utm_id = d.utm_id
  if (d.tags !== undefined) updateData.tags = d.tags
  if (d.expires_at !== undefined) updateData.expires_at = d.expires_at
  if (d.activates_at !== undefined) updateData.activates_at = d.activates_at
  if (d.active !== undefined) updateData.active = d.active
  if (d.pass_click_ids !== undefined) updateData.pass_click_ids = d.pass_click_ids

  const { data, error } = await supabase
    .from('tracked_links')
    .update(updateData)
    .eq('id', id)
    .eq('site_id', siteId)
    .select(LINK_SELECT)
    .single()

  if (error || !data) {
    console.error('[links/update]', error?.message)
    return err('DB_ERROR', error?.message ?? 'Failed to update link', 500)
  }

  return ok(withShortUrl(data as unknown as TrackedLinkRow))
}

/** Archive a tracked link: active false (soft — the link stops resolving but is retained). */
export async function archiveTrackedLink(
  ctx: ServiceContext,
  id: string,
): Promise<ServiceResult<{ id: string; active: boolean }>> {
  if (!UUID_REGEX.test(id)) {
    return err('VALIDATION_ERROR', 'Invalid link ID', 400)
  }

  const { supabase, siteId } = ctx
  const { data: updated, error } = await supabase
    .from('tracked_links')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)
    .is('deleted_at', null)
    .select('id, active')
    .single()

  if (error || !updated) {
    return err('NOT_FOUND', 'Link not found', 404)
  }

  return ok(updated as { id: string; active: boolean })
}
