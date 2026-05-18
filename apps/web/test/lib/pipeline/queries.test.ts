import { describe, it, expect } from 'vitest'
import { decodeCursor, encodeCursor, parseSortParam, applyPipelineFilters } from '@/lib/pipeline/queries'

describe('encodeCursor / decodeCursor', () => {
  it('round-trips a cursor', () => {
    const encoded = encodeCursor('2026-01-01', 'abc-123')
    const decoded = decodeCursor(encoded)
    expect(decoded).toEqual({ sort_value: '2026-01-01', id: 'abc-123' })
  })

  it('returns null for garbage input', () => {
    expect(decodeCursor('not-base64!')).toBeNull()
  })

  it('returns null when pipe separator is missing', () => {
    const noPipe = Buffer.from('noseparator').toString('base64url')
    expect(decodeCursor(noPipe)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(decodeCursor('')).toBeNull()
  })

  it('handles values containing pipe characters', () => {
    const encoded = encodeCursor('val|ue', 'id-1')
    const decoded = decodeCursor(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.sort_value).toBe('val')
  })
})

describe('parseSortParam', () => {
  it('defaults to updated_at desc when undefined', () => {
    expect(parseSortParam(undefined)).toEqual({ column: 'updated_at', ascending: false })
  })

  it('defaults to updated_at desc for empty string', () => {
    expect(parseSortParam('')).toEqual({ column: 'updated_at', ascending: false })
  })

  it('parses allowed column with asc direction', () => {
    expect(parseSortParam('priority:asc')).toEqual({ column: 'priority', ascending: true })
  })

  it('parses allowed column with desc direction', () => {
    expect(parseSortParam('created_at:desc')).toEqual({ column: 'created_at', ascending: false })
  })

  it('falls back to updated_at for disallowed columns', () => {
    expect(parseSortParam('evil_column:asc')).toEqual({ column: 'updated_at', ascending: true })
  })

  it('parses column without direction as desc', () => {
    expect(parseSortParam('title_pt')).toEqual({ column: 'title_pt', ascending: false })
  })

  it('accepts all allowed columns', () => {
    for (const col of ['updated_at', 'created_at', 'priority', 'title_pt', 'stage']) {
      expect(parseSortParam(col).column).toBe(col)
    }
  })
})

describe('applyPipelineFilters', () => {
  function createMockQuery() {
    const calls: Array<{ method: string; args: unknown[] }> = []
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        return (...args: unknown[]) => {
          calls.push({ method: prop as string, args })
          return new Proxy({}, handler)
        }
      },
    }
    const proxy = new Proxy({}, handler)
    return { query: proxy, calls }
  }

  it('returns query unchanged with no filters', () => {
    const { query, calls } = createMockQuery()
    const result = applyPipelineFilters(query, {})
    expect(calls).toHaveLength(1)
    expect(calls[0]!.method).toBe('eq')
    expect(calls[0]!.args).toEqual(['is_archived', false])
    expect(result).toBeDefined()
  })

  it('applies format filter with comma-separated values', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { format: 'video,blog_post' })
    expect(calls.some(c => c.method === 'in' && JSON.stringify(c.args) === JSON.stringify(['format', ['video', 'blog_post']]))).toBe(true)
  })

  it('applies stage filter', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { stage: 'scripting,recording' })
    expect(calls.some(c => c.method === 'in' && c.args[0] === 'stage')).toBe(true)
  })

  it('applies lang=both as exact match', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { lang: 'both' })
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'language' && c.args[1] === 'both')).toBe(true)
  })

  it('applies lang filter as in-clause including both', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { lang: 'pt' })
    expect(calls.some(c => c.method === 'in' && JSON.stringify(c.args) === JSON.stringify(['language', ['pt', 'both']]))).toBe(true)
  })

  it('hides archived by default', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, {})
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'is_archived' && c.args[1] === false)).toBe(true)
  })

  it('shows only archived when archived=only', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { archived: 'only' })
    expect(calls.some(c => c.method === 'eq' && c.args[0] === 'is_archived' && c.args[1] === true)).toBe(true)
  })

  it('applies priority range filters', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { priority_min: '3', priority_max: '5' })
    expect(calls.some(c => c.method === 'gte' && c.args[0] === 'priority' && c.args[1] === 3)).toBe(true)
    expect(calls.some(c => c.method === 'lte' && c.args[0] === 'priority' && c.args[1] === 5)).toBe(true)
  })

  it('applies tag filter as contains', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { tag: 'vlog,travel' })
    expect(calls.some(c => c.method === 'contains' && JSON.stringify(c.args) === JSON.stringify(['tags', ['vlog', 'travel']]))).toBe(true)
  })

  it('applies graduated=true as OR condition', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { graduated: 'true' })
    expect(calls.some(c => c.method === 'or')).toBe(true)
  })

  it('applies graduated=false as all-null check', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { graduated: 'false' })
    const isCalls = calls.filter(c => c.method === 'is')
    expect(isCalls.length).toBeGreaterThanOrEqual(4)
  })

  it('applies stale_days filter', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { stale_days: '7' })
    expect(calls.some(c => c.method === 'lt' && c.args[0] === 'updated_at')).toBe(true)
  })

  it('ignores invalid stale_days', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { stale_days: 'abc' })
    expect(calls.every(c => c.method !== 'lt')).toBe(true)
  })

  it('applies search as textSearch', () => {
    const { query, calls } = createMockQuery()
    applyPipelineFilters(query, { search: 'hello world' })
    expect(calls.some(c => c.method === 'textSearch' && c.args[0] === 'search_vector')).toBe(true)
  })
})
