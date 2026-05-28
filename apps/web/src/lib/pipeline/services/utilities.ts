import { readFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'
import { FORMATS, ReferenceContentUpsertSchema } from '@/lib/pipeline/schemas'
import type { Format } from '@/lib/pipeline/schemas'
import { WORKFLOWS, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'
import type { WorkflowStage, ChecklistItem } from '@/lib/pipeline/workflows'
import { API_REGISTRY } from '@/lib/pipeline/api-registry'
import type { CapabilityDomain } from '@/lib/pipeline/api-registry'
import { sanitizeForLike, sanitizeForFilter, sanitizeForTsquery } from '@/lib/pipeline/sanitize'
import { fetchUpNextData } from '@/lib/pipeline/up-next-fetcher'
import { buildScheduledAt } from '@/lib/pipeline/build-scheduled-at'
import { SITE_TIMEZONE } from '@/lib/pipeline/up-next-constants'
import type { UpNextApiResponse } from '@/lib/pipeline/up-next-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchFilters {
  limit?: number
}

export interface SearchResult {
  pipeline: PipelineSearchHit[]
  blog_posts: BlogSearchHit[]
  newsletters: NewsletterSearchHit[]
}

interface PipelineSearchHit {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  priority: number
  tags: string[]
  updated_at: string
}

interface BlogSearchHit {
  id: string
  title: string
  slug: string
  status: string
  category: string | null
  locale: string | null
}

interface NewsletterSearchHit {
  id: string
  subject: string
  status: string
}

export interface StatsResult {
  total: number
  archived: number
  by_format: Record<string, { total: number; byStage: Record<string, number> }>
  recently_updated_7d: number
  by_priority: { critical: number; high: number; medium: number; low: number }
}

export interface ContextListFilters {
  format?: 'md' | 'compact'
  group?: string
  skill?: string
}

export interface ContextListItem {
  key: string
  title: string
  content: string | Record<string, unknown> | null
  ref_group: string | null
  sort_order: number
  version: number
  updated_at: string
}

export interface ContextDetail {
  id: string
  site_id: string
  key: string
  title: string
  content_md: string | null
  content_compact: Record<string, unknown> | null
  ref_group: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContextUpsertData {
  title: string
  content_md?: string | null
  content_compact?: Record<string, unknown>
  ref_group?: string
  sort_order?: number
}

export interface TopicAggregation {
  topic: string
  pipeline_items: PipelineSearchHit[]
  blog_posts: Array<{ id: string; title: string; slug: string; status: string; category: string | null }>
}

export interface WorkflowsResult {
  workflows: Record<Format, WorkflowStage[]>
  default_checklists: Record<Format, ChecklistItem[]>
}

export interface DomainDocsResult {
  domain: string
  name: string
  description: string
  guide: string
}

export interface UpNextOptions {
  maxCards?: number
  tz?: string
}

export interface AssignSlotData {
  itemId: string
  slotDay: string
  slotHour: string | null
  previousItemId?: string
}

// ---------------------------------------------------------------------------
// Validation schemas (reused from route files)
// ---------------------------------------------------------------------------

const UpNextParamsSchema = z.object({
  maxCards: z.coerce.number().int().min(1).max(10).default(5),
  tz: z.string().refine((val) => {
    try { Intl.DateTimeFormat(undefined, { timeZone: val }); return true }
    catch { return false }
  }, 'Invalid IANA timezone').default(SITE_TIMEZONE),
})

const AssignSlotSchema = z.object({
  itemId: z.string().uuid(),
  slotDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slotHour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null),
  previousItemId: z.string().uuid().optional(),
})

// ---------------------------------------------------------------------------
// Domain docs cache (module-level singleton, same as original route)
// ---------------------------------------------------------------------------

let DOMAIN_DOCS: Map<string, string> | null = null

async function loadDocs(): Promise<Map<string, string>> {
  const dir = join(process.cwd(), 'data', 'pipeline-docs')
  const docs = new Map<string, string>()
  for (const cap of API_REGISTRY.capabilities) {
    const fp = join(dir, `cowork-docs-${cap.domain}.md`)
    try {
      await access(fp, constants.R_OK)
      docs.set(cap.domain, await readFile(fp, 'utf-8'))
    } catch { /* file not found, skip */ }
  }
  return docs
}

async function getCachedDocs(): Promise<Map<string, string>> {
  if (!DOMAIN_DOCS) DOMAIN_DOCS = await loadDocs()
  return DOMAIN_DOCS
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/** Cross-entity search across pipeline items, blog posts, and newsletters. */
export async function searchContent(
  ctx: ServiceContext,
  query: string,
  filters: SearchFilters = {},
): Promise<ServiceResult<SearchResult>> {
  if (!query || query.trim().length < 2) {
    return err('VALIDATION_ERROR', 'Query must be at least 2 characters', 400)
  }

  const trimmedQ = query.trim().slice(0, 200)
  const safeQ = sanitizeForFilter(sanitizeForLike(trimmedQ))
  const limit = Math.min(filters.limit ?? 20, 50)

  const [pipelineRes, blogRes, newsletterRes] = await Promise.all([
    ctx.supabase
      .from('content_pipeline')
      .select('id, code, title_pt, title_en, format, stage, priority, tags, updated_at')
      .eq('site_id', ctx.siteId)
      .textSearch('search_vector', sanitizeForTsquery(trimmedQ), { type: 'plain' })
      .limit(limit),

    ctx.supabase
      .from('blog_posts')
      .select('id, title, slug, status, category, locale')
      .eq('site_id', ctx.siteId)
      .or(`title.ilike.%${safeQ}%,slug.ilike.%${safeQ}%`)
      .limit(10),

    ctx.supabase
      .from('newsletter_editions')
      .select('id, subject, status')
      .eq('site_id', ctx.siteId)
      .ilike('subject', `%${safeQ}%`)
      .limit(10),
  ])

  return ok({
    pipeline: (pipelineRes.data ?? []) as PipelineSearchHit[],
    blog_posts: (blogRes.data ?? []) as BlogSearchHit[],
    newsletters: (newsletterRes.data ?? []) as NewsletterSearchHit[],
  })
}

/** Aggregate pipeline statistics by format, stage, and priority. */
export async function getStats(ctx: ServiceContext): Promise<ServiceResult<StatsResult>> {
  const { data: items } = await ctx.supabase
    .from('content_pipeline')
    .select('format, stage, priority, is_archived, updated_at')
    .eq('site_id', ctx.siteId)

  const allItems = items ?? []
  const active = allItems.filter((i) => !i.is_archived)

  const byFormat = FORMATS.reduce<Record<string, { total: number; byStage: Record<string, number> }>>((acc, format) => {
    const formatItems = active.filter((i) => i.format === format)
    const byStage: Record<string, number> = {}
    WORKFLOWS[format].forEach((s) => { byStage[s.stage] = formatItems.filter((i) => i.stage === s.stage).length })
    acc[format] = { total: formatItems.length, byStage }
    return acc
  }, {})

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentlyUpdated = active.filter((i) => i.updated_at > sevenDaysAgo).length

  return ok({
    total: active.length,
    archived: allItems.length - active.length,
    by_format: byFormat,
    recently_updated_7d: recentlyUpdated,
    by_priority: {
      critical: active.filter((i) => i.priority === 5).length,
      high: active.filter((i) => i.priority === 4).length,
      medium: active.filter((i) => i.priority === 3).length,
      low: active.filter((i) => i.priority <= 2).length,
    },
  })
}

/** List reference content with optional group, skill, and format filtering. */
export async function listContext(
  ctx: ServiceContext,
  filters: ContextListFilters = {},
): Promise<ServiceResult<ContextListItem[]>> {
  const { format, group, skill } = filters

  if (format && format !== 'md' && format !== 'compact') {
    return err('INVALID_PARAM', 'format must be "md" or "compact"', 400)
  }

  if (group && !/^[a-z][a-z0-9_]{0,29}$/.test(group)) {
    return err('INVALID_PARAM', 'Invalid group id format', 400)
  }

  if (skill && !/^[a-z][a-z0-9_]{0,49}$/.test(skill)) {
    return err('INVALID_PARAM', 'Invalid skill id format', 400)
  }

  // If filtering by skill, resolve keys from _system/skill-mappings
  let skillKeys: string[] | null = null
  if (skill) {
    const { data: mappingRow } = await ctx.supabase
      .from('reference_content')
      .select('content_compact')
      .eq('site_id', ctx.siteId)
      .eq('key', '_system/skill-mappings')
      .single()
    const raw = mappingRow?.content_compact
    const mappings = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null
    const resolved = mappings?.[skill]
    skillKeys = Array.isArray(resolved) ? resolved.filter((k): k is string => typeof k === 'string') : []
  }

  let query = ctx.supabase
    .from('reference_content')
    .select('key, title, content_md, content_compact, ref_group, sort_order, version, updated_at')
    .eq('site_id', ctx.siteId)

  if (group) {
    query = query.eq('ref_group', group)
  } else {
    // Exclude _system/* entries from default context calls
    query = query.not('key', 'like', '_system/%')
  }

  if (skillKeys !== null) {
    if (skillKeys.length === 0) {
      return ok([])
    }
    query = query.in('key', skillKeys)
  }

  query = query.order('ref_group').order('sort_order').order('key')

  const { data, error } = await query
  if (error) return err('QUERY_ERROR', 'Failed to load references', 400)

  const mapped: ContextListItem[] = (data ?? []).map((d) => {
    let content: string | Record<string, unknown> | null
    if (format === 'md') {
      content = d.content_md
    } else if (d.content_compact && typeof d.content_compact === 'object' && !Array.isArray(d.content_compact)) {
      content = d.content_compact as Record<string, unknown>
    } else {
      content = d.content_md
    }
    return {
      key: d.key,
      title: d.title,
      content,
      ref_group: d.ref_group,
      sort_order: d.sort_order,
      version: d.version,
      updated_at: d.updated_at,
    }
  })

  return ok(mapped)
}

/** Get a single reference document by key. */
export async function getContextByKey(
  ctx: ServiceContext,
  key: string,
): Promise<ServiceResult<ContextDetail>> {
  const { data, error } = await ctx.supabase
    .from('reference_content')
    .select('id, site_id, key, title, content_md, content_compact, ref_group, sort_order, created_at, updated_at')
    .eq('site_id', ctx.siteId)
    .eq('key', key)
    .single()

  if (error || !data) return err('NOT_FOUND', `Reference "${key}" not found`, 404)
  return ok(data as ContextDetail)
}

/** Upsert a reference document with optimistic locking support. */
export async function upsertContext(
  ctx: ServiceContext,
  key: string,
  data: ContextUpsertData,
  _expectedVersion?: number,
): Promise<ServiceResult<ContextDetail>> {
  const parsed = ReferenceContentUpsertSchema.safeParse(data)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const upsertData: Record<string, unknown> = {
    site_id: ctx.siteId,
    key,
    title: parsed.data.title,
    content_md: parsed.data.content_md ?? null,
    content_compact: parsed.data.content_compact ?? {},
    updated_at: new Date().toISOString(),
  }
  if (parsed.data.ref_group !== undefined) upsertData.ref_group = parsed.data.ref_group
  if (parsed.data.sort_order !== undefined) upsertData.sort_order = parsed.data.sort_order

  const { data: row, error } = await ctx.supabase
    .from('reference_content')
    .upsert(upsertData, { onConflict: 'site_id,key' })
    .select('id, site_id, key, title, content_md, content_compact, ref_group, sort_order, created_at, updated_at')
    .single()

  if (error) return err('VALIDATION_ERROR', 'Failed to save reference content', 400)
  return ok(row as ContextDetail)
}

/** Delete a reference document by key. */
export async function deleteContext(
  ctx: ServiceContext,
  key: string,
): Promise<ServiceResult<{ deleted: true }>> {
  await ctx.supabase.from('reference_content').delete().eq('site_id', ctx.siteId).eq('key', key)
  return ok({ deleted: true as const })
}

/** Aggregate pipeline items and blog posts that match a topic/tag code. */
export async function getTopicAggregation(
  ctx: ServiceContext,
  code: string,
): Promise<ServiceResult<TopicAggregation>> {
  const [pipelineRes, blogRes] = await Promise.all([
    ctx.supabase
      .from('content_pipeline')
      .select('id, code, title_pt, title_en, format, stage, priority, tags, updated_at')
      .eq('site_id', ctx.siteId)
      .contains('tags', [code])
      .eq('is_archived', false)
      .order('priority', { ascending: false }),

    ctx.supabase
      .from('blog_posts')
      .select('id, title, slug, status, category')
      .eq('site_id', ctx.siteId)
      .eq('category', code),
  ])

  return ok({
    topic: code,
    pipeline_items: (pipelineRes.data ?? []) as PipelineSearchHit[],
    blog_posts: (blogRes.data ?? []) as Array<{ id: string; title: string; slug: string; status: string; category: string | null }>,
  })
}

/** Return static workflow definitions and default checklists. */
export function getWorkflows(): ServiceResult<WorkflowsResult> {
  return ok({ workflows: WORKFLOWS, default_checklists: DEFAULT_CHECKLISTS })
}

/** Read domain documentation file from data/pipeline-docs/. */
export async function getDomainDocs(domain: string): Promise<ServiceResult<DomainDocsResult>> {
  const guide = (await getCachedDocs()).get(domain)
  const capability: CapabilityDomain | undefined = API_REGISTRY.capabilities.find((c) => c.domain === domain)

  if (!guide || !capability) {
    const available = API_REGISTRY.capabilities.map((c) => c.domain)
    return err(
      'DOC_NOT_FOUND',
      `Domain "${domain}" not found. Available: ${available.join(', ')}`,
      404,
    )
  }

  return ok({
    domain: capability.domain,
    name: capability.name,
    description: capability.description,
    guide,
  })
}

/** Get Up Next command center data (today actions, week grid, streak, suggestions). */
export async function getUpNext(
  ctx: ServiceContext,
  options: UpNextOptions = {},
): Promise<ServiceResult<UpNextApiResponse>> {
  const parsed = UpNextParamsSchema.safeParse(options)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.message, 400)
  }

  const { maxCards, tz } = parsed.data
  const response = await fetchUpNextData(ctx.supabase, ctx.siteId, tz, new Date(), maxCards)

  return ok(response)
}

/** Assign or swap a pipeline item into a week slot. */
export async function assignUpNextSlot(
  ctx: ServiceContext,
  rawData: AssignSlotData,
): Promise<ServiceResult<{ id: string; scheduled_at: string }>> {
  const parsed = AssignSlotSchema.safeParse(rawData)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.message, 400)
  }

  const { itemId, slotDay, slotHour, previousItemId } = parsed.data
  const now = new Date().toISOString()

  const scheduledAt = buildScheduledAt(slotDay, slotHour, SITE_TIMEZONE)
  const { data, error } = await ctx.supabase
    .from('content_pipeline')
    .update({ scheduled_at: scheduledAt, updated_at: now })
    .eq('id', itemId)
    .eq('site_id', ctx.siteId)
    .select('id, scheduled_at')
    .single()

  if (error || !data) {
    return err('NOT_FOUND', 'Item not found or not accessible', 404)
  }

  if (previousItemId && previousItemId !== itemId) {
    const { error: clearError } = await ctx.supabase
      .from('content_pipeline')
      .update({ scheduled_at: null, updated_at: now })
      .eq('id', previousItemId)
      .eq('site_id', ctx.siteId)

    if (clearError) {
      // Rollback: restore new item to unscheduled so both aren't in the same slot
      await ctx.supabase
        .from('content_pipeline')
        .update({ scheduled_at: null, updated_at: now })
        .eq('id', itemId)
        .eq('site_id', ctx.siteId)

      return err('SWAP_FAILED', 'Falha ao trocar item do slot', 500)
    }
  }

  return ok(data as { id: string; scheduled_at: string })
}
