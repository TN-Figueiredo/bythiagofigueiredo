export interface CursorParams {
  cursor?: string
  limit?: number
  sort?: string
}

interface DecodedCursor {
  sort_value: string
  id: string
}

export function decodeCursor(cursor: string): DecodedCursor | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const [sort_value, id] = decoded.split('|')
    if (!sort_value || !id) return null
    return { sort_value, id }
  } catch {
    return null
  }
}

export function encodeCursor(sort_value: string, id: string): string {
  return Buffer.from(`${sort_value}|${id}`).toString('base64url')
}

export function parseSortParam(sort?: string): { column: string; ascending: boolean } {
  if (!sort) return { column: 'updated_at', ascending: false }
  const parts = sort.split(':')
  const col = parts[0] ?? ''
  const dir = parts[1]
  const allowed = ['updated_at', 'created_at', 'priority', 'title_pt', 'stage']
  const column: string = allowed.includes(col) ? col : 'updated_at'
  const ascending = dir === 'asc'
  return { column, ascending }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase query builder generics are deeply nested; wrapping requires any */
export function applyPipelineFilters(
  query: any,
  filters: {
    format?: string
    stage?: string
    collection?: string
    lang?: string
    archived?: string
    priority_min?: string
    priority_max?: string
    tag?: string
    parent_id?: string
    graduated?: string
    assigned_to?: string
    stale_days?: string
    search?: string
  },
): any {
/* eslint-enable @typescript-eslint/no-explicit-any */
  if (filters.format) {
    const formats = filters.format.split(',')
    query = query.in('format', formats)
  }
  if (filters.stage) {
    const stages = filters.stage.split(',')
    query = query.in('stage', stages)
  }
  if (filters.lang) {
    if (filters.lang === 'both') {
      query = query.eq('language', 'both')
    } else {
      query = query.in('language', [filters.lang, 'both'])
    }
  }
  if (!filters.archived || filters.archived === 'false') {
    query = query.eq('is_archived', false)
  } else if (filters.archived === 'only') {
    query = query.eq('is_archived', true)
  }
  if (filters.priority_min) query = query.gte('priority', parseInt(filters.priority_min))
  if (filters.priority_max) query = query.lte('priority', parseInt(filters.priority_max))
  if (filters.tag) {
    const tags = filters.tag.split(',')
    query = query.contains('tags', tags)
  }
  if (filters.parent_id) query = query.eq('parent_id', filters.parent_id)
  if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to)
  if (filters.graduated === 'true') {
    query = query.or('blog_post_id.not.is.null,newsletter_edition_id.not.is.null,youtube_video_id.not.is.null,campaign_id.not.is.null')
  } else if (filters.graduated === 'false') {
    query = query.is('blog_post_id', null).is('newsletter_edition_id', null).is('youtube_video_id', null).is('campaign_id', null)
  }
  if (filters.stale_days) {
    const days = parseInt(filters.stale_days)
    if (!isNaN(days) && days > 0) {
      const cutoff = new Date(Date.now() - days * 86400000).toISOString()
      query = query.lt('updated_at', cutoff)
    }
  }
  if (filters.collection) {
    query = query.filter('content_pipeline_memberships.collection_id', 'eq', filters.collection)
  }
  if (filters.search) {
    query = query.textSearch('search_vector', filters.search, { type: 'plain' })
  }
  return query
}
