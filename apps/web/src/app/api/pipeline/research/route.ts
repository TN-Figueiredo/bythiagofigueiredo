import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { authenticateRead, authenticateWrite, pipelineError, pipelineSuccess, parseBody } from '@/lib/pipeline/helpers'
import { ResearchItemCreateSchema } from '@/lib/pipeline/research-schemas'
import { validateTopicSlugDepth, resolveOrCreateTopics } from '@/lib/pipeline/research-topics'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'

export async function GET(req: NextRequest) {
  const result = await authenticateRead(req)
  if (result instanceof Response) return result
  const { auth } = result

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursor = params.get('cursor') || undefined
  const includeContent = params.get('include') === 'content'

  const selectFields = includeContent
    ? 'id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at, content_md, research_topics(path, name, icon)'
    : 'id, title, topic_id, summary, status, word_count, sources, version, created_at, updated_at, research_topics(path, name, icon)'

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('research_items')
    .select(selectFields, { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const topicId = params.get('topic_id')
  if (topicId && UUID_REGEX.test(topicId)) {
    query = query.eq('topic_id', topicId)
  }

  const topicSlug = params.get('topic_slug')
  if (topicSlug && /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(topicSlug)) {
    const safeSlug = sanitizeForFilter(topicSlug)
    query = query.or(`research_topics.path.eq.${safeSlug},research_topics.path.like.${safeSlug}/%`)
  }

  const statusFilter = params.get('status')
  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(Boolean)
    query = query.in('status', statuses)
  }

  const search = params.get('search')
  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch', config: 'portuguese' })
  }

  const pipelineItemId = params.get('pipeline_item_id')
  if (pipelineItemId && UUID_REGEX.test(pipelineItemId)) {
    const { data: linkedIds } = await supabase
      .from('research_links')
      .select('research_id')
      .eq('pipeline_item_id', pipelineItemId)
    const ids = (linkedIds ?? []).map((r) => (r as { research_id: string }).research_id)
    if (ids.length > 0) {
      query = query.in('id', ids)
    } else {
      return NextResponse.json({ data: [], meta: { total: 0, has_next: false, limit } }, { headers: buildRateLimitHeaders(auth) })
    }
  }

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase
      .from('research_items')
      .select('created_at')
      .eq('id', cursor)
      .single()
    if (cursorItem) {
      const safeTs = sanitizeForFilter(String(cursorItem.created_at))
      query = query.or(`created_at.lt.${safeTs},and(created_at.eq.${safeTs},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error('[research/GET]', error.message)
    return pipelineError('DB_ERROR', 'Failed to load research items', 500, auth)
  }

  const hasNext = (data?.length ?? 0) > limit
  const items = (data?.slice(0, limit) ?? []) as unknown as Array<Record<string, unknown>>
  const lastItem = items[items.length - 1]

  const mapped = items.map((item: any) => ({
    id: item.id,
    title: item.title,
    topic_id: item.topic_id,
    topic_path: item.research_topics?.path,
    topic_name: item.research_topics?.name,
    topic_icon: item.research_topics?.icon,
    summary: item.summary,
    status: item.status,
    word_count: item.word_count,
    sources_count: Array.isArray(item.sources) ? item.sources.length : 0,
    version: item.version,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(includeContent ? { content_md: item.content_md } : {}),
  }))

  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: mapped,
    meta: {
      total: count ?? 0,
      has_next: hasNext,
      next_cursor: hasNext && lastItem ? lastItem.id : undefined,
      limit,
    },
  }, { headers })
}

export async function POST(req: NextRequest) {
  const result = await authenticateWrite(req)
  if (result instanceof Response) return result
  const { auth } = result

  const body = await parseBody(req)
  if (body instanceof Response) return body

  const parsed = ResearchItemCreateSchema.safeParse(body)
  if (!parsed.success) {
    return pipelineError('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join(', '), 400, auth)
  }

  const { title, topic_slug, content_md, summary, sources } = parsed.data

  if (!validateTopicSlugDepth(topic_slug)) {
    return pipelineError('VALIDATION_ERROR', 'Max 3 levels (e.g., "a/b/c"). Got too many segments.', 400, auth)
  }

  const supabase = getSupabaseServiceClient()
  const topicResult = await resolveOrCreateTopics(supabase, auth.siteId, topic_slug)
  if ('error' in topicResult) {
    return pipelineError('DB_ERROR', 'Failed to resolve topic', 500, auth)
  }

  const { data: item, error } = await supabase
    .from('research_items')
    .upsert(
      {
        site_id: auth.siteId,
        topic_id: topicResult.topicId,
        title,
        content_md,
        content_json: null,
        summary: summary ?? null,
        sources,
        status: 'new',
      },
      { onConflict: 'site_id,topic_id,title' }
    )
    .select('id, title, topic_id, status, word_count, version, created_at, updated_at')
    .single()

  if (error) {
    console.error('[research/POST]', error.message)
    return pipelineError('DB_ERROR', 'Failed to save research item', 500, auth)
  }

  const isUpsert = item!.version > 1
  const headers = buildRateLimitHeaders(auth)
  return NextResponse.json({
    data: { ...item, upserted: isUpsert },
  }, { status: isUpsert ? 200 : 201, headers })
}
