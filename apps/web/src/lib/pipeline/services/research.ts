import { UUID_REGEX } from '@/lib/pipeline/auth'
import {
  ResearchItemCreateSchema,
  ResearchItemUpdateSchema,
  ResearchImportSchema,
  ResearchTopicCreateSchema,
  ResearchTopicUpdateSchema,
  ResearchLinkSchema,
} from '@/lib/pipeline/research-schemas'
import { validateTopicSlugDepth, resolveOrCreateTopics } from '@/lib/pipeline/research-topics'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'
import type { ServiceContext, ServiceResult } from './types'
import { ok, err } from './types'

// ---------------------------------------------------------------------------
// Internal row shapes (untyped Supabase — no generated DB types)
// ---------------------------------------------------------------------------

interface ResearchRow {
  id: string
  title: string
  topic_id: string
  theme_id: string | null
  takeaways: string[] | null
  pinned: boolean | null
  read_min: number | null
  source: string | null
  summary: string | null
  status: string
  word_count: number | null
  sources: unknown
  version: number
  created_at: string
  updated_at: string
  content_md?: string | null
  research_topics?: { path: string; name: string; icon: string | null } | null
}

interface ResearchItemWithTopic {
  id: string
  title: string
  topic_id: string
  theme_id: string | null
  takeaways: string[] | null
  pinned: boolean | null
  read_min: number | null
  source: string | null
  content_json: unknown
  content_html: string | null
  content_md: string | null
  summary: string | null
  sources: unknown
  status: string
  word_count: number | null
  version: number
  created_at: string
  updated_at: string
  site_id: string
  research_topics: { path: string; name: string; icon: string | null } | null
}

// ---------------------------------------------------------------------------
// Public result shapes
// ---------------------------------------------------------------------------

interface ResearchListItem {
  id: string
  title: string
  topic_id: string
  theme_id: string | null
  takeaways: string[]
  pinned: boolean
  read_min: number | null
  source: string
  topic_path: string | undefined
  topic_name: string | undefined
  topic_icon: string | null | undefined
  summary: string | null
  status: string
  word_count: number | null
  sources_count: number
  version: number
  created_at: string
  updated_at: string
  content_md?: string | null
}

interface ResearchListResult {
  data: ResearchListItem[]
  meta: { total: number; has_next: boolean; next_cursor?: string; limit: number }
}

interface ResearchDetailLinkedItem {
  link_id: string
  pipeline_item_id: string
  note: string | null
  title: string
  format: string | undefined
  stage: string | undefined
}

interface ResearchDetailResult {
  id: string
  title: string
  topic_id: string
  topic_path: string | undefined
  topic_name: string | undefined
  topic_icon: string | null | undefined
  theme_id: string | null
  takeaways: string[]
  pinned: boolean
  read_min: number | null
  source: string
  content_json: unknown
  content_html: string | null
  content_md: string | null
  summary: string | null
  sources: unknown
  status: string
  word_count: number | null
  version: number
  created_at: string
  updated_at: string
  linked_items: ResearchDetailLinkedItem[]
}

interface ResearchCreateResult {
  id: string
  title: string
  topic_id: string
  status: string
  word_count: number | null
  version: number
  created_at: string
  updated_at: string
  upserted: boolean
}

interface ResearchUpdateResult {
  data: Record<string, unknown>
  meta: { version: number; updated_at: string }
}

interface ImportItemResult {
  id?: string
  title: string
  ok: boolean
  error?: string
}

interface ImportResult {
  results: ImportItemResult[]
  success_count: number
  failure_count: number
}

interface TopicRow {
  id: string
  parent_id: string | null
  name: string
  slug: string
  path: string
  depth: number
  color: string
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

interface ListResearchOptions {
  limit?: number
  cursor?: string
  includeContent?: boolean
  topicId?: string
  topicSlug?: string
  status?: string[]
  search?: string
  pipelineItemId?: string
}

// ---------------------------------------------------------------------------
// Research Items
// ---------------------------------------------------------------------------

/** List research items with cursor pagination, filtering, and full-text search. */
export async function listResearchItems(
  ctx: ServiceContext,
  opts: ListResearchOptions = {},
): Promise<ServiceResult<ResearchListResult>> {
  const limit = Math.min(opts.limit ?? 50, 200)
  const { supabase, siteId } = ctx

  const selectFields = opts.includeContent
    ? 'id, title, topic_id, theme_id, takeaways, pinned, read_min, source, summary, status, word_count, sources, version, created_at, updated_at, content_md, research_topics(path, name, icon)'
    : 'id, title, topic_id, theme_id, takeaways, pinned, read_min, source, summary, status, word_count, sources, version, created_at, updated_at, research_topics(path, name, icon)'

  let query = supabase
    .from('research_items')
    .select(selectFields, { count: 'exact' })
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (opts.topicId && UUID_REGEX.test(opts.topicId)) {
    query = query.eq('topic_id', opts.topicId)
  }

  if (opts.topicSlug && /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(opts.topicSlug)) {
    const safeSlug = sanitizeForFilter(opts.topicSlug)
    query = query.or(`research_topics.path.eq.${safeSlug},research_topics.path.like.${safeSlug}/%`)
  }

  if (opts.status && opts.status.length > 0) {
    query = query.in('status', opts.status)
  }

  if (opts.search) {
    query = query.textSearch('search_vector', opts.search, { type: 'websearch', config: 'portuguese' })
  }

  if (opts.pipelineItemId && UUID_REGEX.test(opts.pipelineItemId)) {
    const { data: linkedIds } = await supabase
      .from('research_links')
      .select('research_id')
      .eq('pipeline_item_id', opts.pipelineItemId)
    const ids = (linkedIds ?? []).map((r) => (r as { research_id: string }).research_id)
    if (ids.length === 0) {
      return ok({ data: [], meta: { total: 0, has_next: false, limit } })
    }
    query = query.in('id', ids)
  }

  if (opts.cursor && UUID_REGEX.test(opts.cursor)) {
    const { data: cursorItem } = await supabase
      .from('research_items')
      .select('created_at')
      .eq('id', opts.cursor)
      .single()
    if (cursorItem) {
      const safeTs = sanitizeForFilter(String(cursorItem.created_at))
      query = query.or(`created_at.lt.${safeTs},and(created_at.eq.${safeTs},id.lt.${opts.cursor})`)
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[research/list]', error.message)
    return err('DB_ERROR', 'Failed to load research items', 500)
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = (data?.slice(0, limit) ?? []) as unknown as ResearchRow[]
  const lastItem = items[items.length - 1]

  const mapped: ResearchListItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    topic_id: item.topic_id,
    theme_id: item.theme_id ?? null,
    takeaways: (item.takeaways as string[] | null) ?? [],
    pinned: item.pinned ?? false,
    read_min: item.read_min ?? null,
    source: item.source ?? 'thiago',
    topic_path: item.research_topics?.path,
    topic_name: item.research_topics?.name,
    topic_icon: item.research_topics?.icon,
    summary: item.summary,
    status: item.status,
    word_count: item.word_count,
    sources_count: Array.isArray(item.sources) ? (item.sources as unknown[]).length : 0,
    version: item.version,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(opts.includeContent ? { content_md: item.content_md } : {}),
  }))

  return ok({
    data: mapped,
    meta: {
      total: count ?? 0,
      has_next: hasNext,
      next_cursor: hasNext && lastItem ? lastItem.id : undefined,
      limit,
    },
  })
}

/** Create or upsert a research item by topic+title. Returns 201 for new, 200 for upsert. */
export async function createResearchItem(
  ctx: ServiceContext,
  input: unknown,
  dryRun?: boolean,
): Promise<ServiceResult<ResearchCreateResult>> {
  const parsed = ResearchItemCreateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { title, topic_slug, content_md, summary, sources, theme_id, pinned, takeaways } = parsed.data

  if (!validateTopicSlugDepth(topic_slug)) {
    return err('VALIDATION_ERROR', 'Max 3 levels (e.g., "a/b/c"). Got too many segments.', 400)
  }

  if (dryRun) {
    return ok({ id: '', title, topic_id: '', status: 'new', word_count: null, version: 1, created_at: '', updated_at: '', upserted: false }, 200)
  }

  const { supabase, siteId } = ctx
  const topicResult = await resolveOrCreateTopics(supabase, siteId, topic_slug)
  if ('error' in topicResult) {
    return err('DB_ERROR', 'Failed to resolve topic', 500)
  }

  const { data: item, error } = await supabase
    .from('research_items')
    .upsert(
      {
        site_id: siteId,
        topic_id: topicResult.topicId,
        title,
        content_md,
        content_json: null,
        summary: summary ?? null,
        sources,
        status: 'new',
        // Cowork can set these on create (only when provided, to avoid
        // clobbering on an upsert-conflict of the same site/topic/title).
        ...(theme_id !== undefined ? { theme_id } : {}),
        ...(pinned !== undefined ? { pinned } : {}),
        ...(takeaways !== undefined ? { takeaways } : {}),
      },
      { onConflict: 'site_id,topic_id,title' },
    )
    .select('id, title, topic_id, status, word_count, version, created_at, updated_at')
    .single()

  if (error) {
    console.error('[research/create]', error.message)
    return err('DB_ERROR', 'Failed to save research item', 500)
  }

  const isUpsert = item!.version > 1
  return ok(
    { ...(item as ResearchCreateResult), upserted: isUpsert },
    isUpsert ? 200 : 201,
  )
}

/** Get a single research item by ID, including linked pipeline items. */
export async function getResearchItem(
  ctx: ServiceContext,
  itemId: string,
): Promise<ServiceResult<{ data: ResearchDetailResult; meta: { version: number; updated_at: string } }>> {
  if (!UUID_REGEX.test(itemId)) {
    return err('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  const { supabase, siteId } = ctx

  const { data: item, error } = await supabase
    .from('research_items')
    .select('*, research_topics!inner(path, name, icon)')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (error || !item) {
    return err('NOT_FOUND', 'Research item not found', 404)
  }

  const typedItem = item as unknown as ResearchItemWithTopic

  const { data: links } = await supabase
    .from('research_links')
    .select('id, pipeline_item_id, note, created_at, content_pipeline(id, title_pt, title_en, format, stage)')
    .eq('research_id', itemId)

  const linkedItems: ResearchDetailLinkedItem[] = (links ?? []).map((l: Record<string, unknown>) => {
    const cp = l.content_pipeline as Record<string, unknown> | null
    return {
      link_id: l.id as string,
      pipeline_item_id: l.pipeline_item_id as string,
      note: l.note as string | null,
      title: (cp?.title_pt ?? cp?.title_en ?? '') as string,
      format: cp?.format as string | undefined,
      stage: cp?.stage as string | undefined,
    }
  })

  const detail: ResearchDetailResult = {
    id: typedItem.id,
    title: typedItem.title,
    topic_id: typedItem.topic_id,
    topic_path: typedItem.research_topics?.path,
    topic_name: typedItem.research_topics?.name,
    topic_icon: typedItem.research_topics?.icon,
    theme_id: typedItem.theme_id ?? null,
    takeaways: (typedItem.takeaways as string[] | null) ?? [],
    pinned: typedItem.pinned ?? false,
    read_min: typedItem.read_min ?? null,
    source: typedItem.source ?? 'thiago',
    content_json: typedItem.content_json,
    content_html: typedItem.content_html ?? null,
    content_md: typedItem.content_md,
    summary: typedItem.summary,
    sources: typedItem.sources,
    status: typedItem.status,
    word_count: typedItem.word_count,
    version: typedItem.version,
    created_at: typedItem.created_at,
    updated_at: typedItem.updated_at,
    linked_items: linkedItems,
  }

  return ok(
    { data: detail, meta: { version: typedItem.version, updated_at: typedItem.updated_at } },
  )
}

/** Update a research item with optimistic concurrency control via expected version. */
export async function updateResearchItem(
  ctx: ServiceContext,
  itemId: string,
  input: unknown,
  expectedVersion: number,
  dryRun?: boolean,
): Promise<ServiceResult<ResearchUpdateResult>> {
  if (!UUID_REGEX.test(itemId)) {
    return err('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  if (expectedVersion == null || isNaN(expectedVersion)) {
    return err('VALIDATION_ERROR', 'Expected version is required', 400)
  }

  const parsed = ResearchItemUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { supabase, siteId } = ctx

  const { data: current } = await supabase
    .from('research_items')
    .select('version')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (!current) {
    return err('NOT_FOUND', 'Item not found', 404)
  }

  if (current.version !== expectedVersion) {
    return err(
      'VERSION_CONFLICT',
      `Version mismatch. Current: ${current.version}, yours: ${expectedVersion}`,
      409,
    )
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (parsed.data.content_md !== undefined && !parsed.data.content_json) {
    updateData.content_json = null
  }

  if (dryRun) {
    return ok({ data: { id: itemId, ...updateData }, meta: { version: expectedVersion + 1, updated_at: '' } })
  }

  const { data: updated, error } = await supabase
    .from('research_items')
    .update(updateData)
    .eq('id', itemId)
    .eq('version', expectedVersion)
    .select()
    .single()

  if (error || !updated) {
    return err('VERSION_CONFLICT', 'Concurrent modification detected', 409)
  }

  return ok({
    data: updated as Record<string, unknown>,
    meta: { version: updated.version as number, updated_at: updated.updated_at as string },
  })
}

/** Delete a research item by ID. */
export async function deleteResearchItem(
  ctx: ServiceContext,
  itemId: string,
  dryRun?: boolean,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!UUID_REGEX.test(itemId)) {
    return err('VALIDATION_ERROR', 'Invalid item ID', 400)
  }

  if (dryRun) {
    return ok({ deleted: true })
  }

  const { supabase, siteId } = ctx
  const { error } = await supabase
    .from('research_items')
    .delete()
    .eq('id', itemId)
    .eq('site_id', siteId)

  if (error) {
    console.error('[research/delete]', error.message)
    return err('DB_ERROR', 'Failed to delete research item', 500)
  }

  return ok({ deleted: true })
}

// ---------------------------------------------------------------------------
// Research Links
// ---------------------------------------------------------------------------

/** Add a pipeline link to a research item. */
export async function addResearchLink(
  ctx: ServiceContext,
  researchId: string,
  input: unknown,
  dryRun?: boolean,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!UUID_REGEX.test(researchId)) {
    return err('VALIDATION_ERROR', 'Invalid research item ID', 400)
  }

  const parsed = ResearchLinkSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  if (dryRun) {
    return ok({ research_id: researchId, pipeline_item_id: parsed.data.pipeline_item_id, note: parsed.data.note ?? null }, 201)
  }

  const { supabase, siteId } = ctx

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) {
    return err('NOT_FOUND', 'Research item not found', 404)
  }

  const { data: link, error } = await supabase
    .from('research_links')
    .insert({
      research_id: researchId,
      pipeline_item_id: parsed.data.pipeline_item_id,
      note: parsed.data.note ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return err('VALIDATION_ERROR', 'Link already exists', 409)
    }
    console.error('[research/links/add]', error.message)
    return err('DB_ERROR', 'Failed to create link', 500)
  }

  return ok(link as Record<string, unknown>, 201)
}

/** Remove a pipeline link from a research item. */
export async function removeResearchLink(
  ctx: ServiceContext,
  researchId: string,
  linkId: string,
  dryRun?: boolean,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!UUID_REGEX.test(researchId) || !UUID_REGEX.test(linkId)) {
    return err('VALIDATION_ERROR', 'Invalid ID format', 400)
  }

  if (dryRun) {
    return ok({ deleted: true })
  }

  const { supabase, siteId } = ctx

  const { data: researchItem } = await supabase
    .from('research_items')
    .select('id')
    .eq('id', researchId)
    .eq('site_id', siteId)
    .single()

  if (!researchItem) {
    return err('NOT_FOUND', 'Research item not found', 404)
  }

  const { error } = await supabase
    .from('research_links')
    .delete()
    .eq('id', linkId)
    .eq('research_id', researchId)

  if (error) {
    console.error('[research/links/remove]', error.message)
    return err('DB_ERROR', 'Failed to delete link', 500)
  }

  return ok({ deleted: true })
}

// ---------------------------------------------------------------------------
// Batch Import
// ---------------------------------------------------------------------------

/** Batch import research items with per-item error isolation and topic caching. */
export async function importResearchItems(
  ctx: ServiceContext,
  input: unknown,
  dryRun?: boolean,
): Promise<ServiceResult<ImportResult>> {
  const parsed = ResearchImportSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  if (dryRun) {
    const dryResults: ImportItemResult[] = parsed.data.items.map((item) => {
      if (!validateTopicSlugDepth(item.topic_slug)) {
        return { title: item.title, ok: false, error: 'Max 3 levels' }
      }
      return { title: item.title, ok: true }
    })
    return ok({
      results: dryResults,
      success_count: dryResults.filter((r) => r.ok).length,
      failure_count: dryResults.filter((r) => !r.ok).length,
    })
  }

  const { supabase, siteId } = ctx
  const results: ImportItemResult[] = []
  const topicCache = new Map<string, string>()

  for (const item of parsed.data.items) {
    if (!validateTopicSlugDepth(item.topic_slug)) {
      results.push({ title: item.title, ok: false, error: 'Max 3 levels' })
      continue
    }

    const topicResult = await resolveOrCreateTopics(supabase, siteId, item.topic_slug, topicCache)
    if ('error' in topicResult) {
      results.push({ title: item.title, ok: false, error: topicResult.error })
      continue
    }

    const { data: created, error } = await supabase
      .from('research_items')
      .upsert(
        {
          site_id: siteId,
          topic_id: topicResult.topicId,
          title: item.title,
          content_md: item.content_md,
          content_json: null,
          summary: item.summary ?? null,
          sources: item.sources,
          status: 'new',
        },
        { onConflict: 'site_id,topic_id,title' },
      )
      .select('id')
      .single()

    if (error) {
      console.error('[research/import]', error)
      results.push({ title: item.title, ok: false, error: 'Failed to save item' })
    } else {
      results.push({ id: created!.id as string, title: item.title, ok: true })
    }
  }

  return ok({
    results,
    success_count: results.filter((r) => r.ok).length,
    failure_count: results.filter((r) => !r.ok).length,
  })
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/** List all research topics for a site, ordered by depth then sort_order. */
export async function listTopics(
  ctx: ServiceContext,
): Promise<ServiceResult<TopicRow[]>> {
  const { supabase, siteId } = ctx
  const { data: topics, error } = await supabase
    .from('research_topics')
    .select('id, parent_id, name, slug, path, depth, color, icon, sort_order, created_at, updated_at')
    .eq('site_id', siteId)
    .order('depth')
    .order('sort_order')

  if (error) {
    console.error('[research/topics/list]', error.message)
    return err('DB_ERROR', 'Failed to load topics', 500)
  }

  return ok((topics ?? []) as TopicRow[])
}

/** Create a topic with auto-parent resolution and max depth 3 enforcement. */
export async function createTopic(
  ctx: ServiceContext,
  input: unknown,
  dryRun?: boolean,
): Promise<ServiceResult<Record<string, unknown>>> {
  const parsed = ResearchTopicCreateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const { name, slug, parent_id, color, icon } = parsed.data
  const { supabase, siteId } = ctx

  let parentPath = ''
  let depth = 0

  if (parent_id) {
    const { data: parent } = await supabase
      .from('research_topics')
      .select('path, depth')
      .eq('id', parent_id)
      .eq('site_id', siteId)
      .single()

    if (!parent) {
      return err('NOT_FOUND', 'Parent topic not found', 404)
    }

    if (parent.depth >= 2) {
      return err('VALIDATION_ERROR', 'Max 3 levels (depth 0-2). Parent is already at max depth.', 400)
    }

    parentPath = parent.path as string
    depth = (parent.depth as number) + 1
  }

  const path = parentPath ? `${parentPath}/${slug}` : slug

  if (dryRun) {
    return ok({ site_id: siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon }, 201)
  }

  const { data: topic, error } = await supabase
    .from('research_topics')
    .insert({ site_id: siteId, name, slug, path, depth, parent_id: parent_id ?? null, color, icon })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return err('VALIDATION_ERROR', 'Topic with this path already exists', 409)
    }
    console.error('[research/topics/create]', error.message)
    return err('DB_ERROR', 'Failed to create topic', 500)
  }

  return ok(topic as Record<string, unknown>, 201)
}

/** Update a topic's mutable fields (name, color, icon, sort_order). */
export async function updateTopic(
  ctx: ServiceContext,
  topicId: string,
  input: unknown,
  dryRun?: boolean,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (!UUID_REGEX.test(topicId)) {
    return err('VALIDATION_ERROR', 'Invalid topic ID', 400)
  }

  const parsed = ResearchTopicUpdateSchema.safeParse(input)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400)
  }

  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) updateData[key] = value
  }

  if (Object.keys(updateData).length === 0) {
    return err('VALIDATION_ERROR', 'No fields to update', 400)
  }

  if (dryRun) {
    return ok({ id: topicId, ...updateData })
  }

  const { supabase, siteId } = ctx
  const { data: updated, error } = await supabase
    .from('research_topics')
    .update(updateData)
    .eq('id', topicId)
    .eq('site_id', siteId)
    .select()
    .single()

  if (error || !updated) {
    return err('NOT_FOUND', 'Topic not found', 404)
  }

  return ok(updated as Record<string, unknown>)
}

/** Delete a topic by ID. */
export async function deleteTopic(
  ctx: ServiceContext,
  topicId: string,
  dryRun?: boolean,
): Promise<ServiceResult<{ deleted: boolean }>> {
  if (!UUID_REGEX.test(topicId)) {
    return err('VALIDATION_ERROR', 'Invalid topic ID', 400)
  }

  if (dryRun) {
    return ok({ deleted: true })
  }

  const { supabase, siteId } = ctx
  const { error } = await supabase
    .from('research_topics')
    .delete()
    .eq('id', topicId)
    .eq('site_id', siteId)

  if (error) {
    console.error('[research/topics/delete]', error.message)
    return err('DB_ERROR', 'Failed to delete topic', 500)
  }

  return ok({ deleted: true })
}
