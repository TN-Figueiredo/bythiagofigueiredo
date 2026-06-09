import { describe, it, expect, vi } from 'vitest'
import { titleIndexKey, findActiveDuplicateTitleId } from '@/lib/pipeline/services/items'

const SITE_ID = '11111111-1111-1111-1111-111111111111'

/**
 * Fake of the supabase chain that `findActiveDuplicateTitleId` uses:
 *   supabase.from('content_pipeline').select(...).eq(...).eq(...).eq(...)
 * The helper awaits the result of the LAST `.eq()` directly (no `.single()`),
 * so the chain object is thenable and resolves to `{ data }`.
 *
 * `eqCalls` records every `.eq(col, val)` for assertions (site_id / format / is_archived).
 */
function makeSupabase(rows: Array<{ id: string; title_pt: string | null; title_en: string | null }>) {
  const eqCalls: Array<[string, unknown]> = []
  const fromCalls: string[] = []
  const selectCalls: string[] = []
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn((cols: string) => {
    selectCalls.push(cols)
    return chain
  })
  chain.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return chain
  })
  // Thenable: awaiting the chain yields { data }
  ;(chain as { then: unknown }).then = (resolve: (v: { data: unknown }) => unknown) =>
    resolve({ data: rows })
  const supabase = {
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      return chain
    }),
  }
  return { supabase, eqCalls, fromCalls, selectCalls, chain }
}

describe('titleIndexKey — pt-preferred, en fallback, normalized', () => {
  it('keys on pt when pt is set (ignores en)', () => {
    expect(titleIndexKey('My Story', 'Other')).toBe('my story')
  })

  it('falls back to en only when pt is empty', () => {
    expect(titleIndexKey('', 'English Title')).toBe('english title')
    expect(titleIndexKey(undefined, 'English Title')).toBe('english title')
    expect(titleIndexKey(null, 'English Title')).toBe('english title')
  })

  it('lowercases and btrims (leading/trailing whitespace)', () => {
    expect(titleIndexKey('  Hello World  ', null)).toBe('hello world')
    expect(titleIndexKey('UPPER', null)).toBe('upper')
  })

  it('treats whitespace-only pt as empty → falls back to en', () => {
    expect(titleIndexKey('   ', 'fallback')).toBe('fallback')
  })

  it('returns empty string when both are empty/whitespace/null', () => {
    expect(titleIndexKey('', '')).toBe('')
    expect(titleIndexKey(null, null)).toBe('')
    expect(titleIndexKey(undefined, undefined)).toBe('')
    expect(titleIndexKey('   ', '  ')).toBe('')
  })
})

describe('findActiveDuplicateTitleId', () => {
  it('returns the id on an exact pt match', async () => {
    const { supabase } = makeSupabase([
      { id: 'item-1', title_pt: 'My Story', title_en: null },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['My Story', null])
    expect(id).toBe('item-1')
  })

  it('matches case- and whitespace-insensitively', async () => {
    const { supabase } = makeSupabase([
      { id: 'item-1', title_pt: '  my STORY ', title_en: null },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['My Story', null])
    expect(id).toBe('item-1')
  })

  it('matches on en ONLY when candidate pt is empty (en fallback)', async () => {
    const { supabase } = makeSupabase([
      { id: 'item-en', title_pt: null, title_en: 'English Only' },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['', 'English Only'])
    expect(id).toBe('item-en')
  })

  it('does NOT match when candidate has a pt key but only the en titles align (pt-preferred)', async () => {
    // Existing row is keyed by its pt ('Existing PT'); candidate is keyed by its pt ('Different PT').
    // Even though candidate.title_en equals existing.title_en, the live keys differ → no match.
    const { supabase } = makeSupabase([
      { id: 'item-1', title_pt: 'Existing PT', title_en: 'Shared EN' },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['Different PT', 'Shared EN'])
    expect(id).toBeNull()
  })

  it('does NOT match a candidate-en against an existing-pt-keyed row', async () => {
    // Existing row keyed by pt 'Foo'. Candidate has empty pt, en 'Foo' → key 'foo' on both sides
    // only because existing.title_pt happens to be 'Foo'. To prove pt-preference, existing pt is
    // 'Live PT' and its en is 'Foo'; candidate en is 'Foo' with empty pt → keys: 'live pt' vs 'foo'.
    const { supabase } = makeSupabase([
      { id: 'item-1', title_pt: 'Live PT', title_en: 'Foo' },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['', 'Foo'])
    expect(id).toBeNull()
  })

  it('applies site_id, format, and is_archived=false filters', async () => {
    const { supabase, eqCalls, fromCalls, selectCalls } = makeSupabase([])
    await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'blog_post', ['anything', null])
    expect(fromCalls).toEqual(['content_pipeline'])
    expect(selectCalls[0]).toContain('id')
    expect(eqCalls).toContainEqual(['site_id', SITE_ID])
    expect(eqCalls).toContainEqual(['format', 'blog_post'])
    expect(eqCalls).toContainEqual(['is_archived', false])
  })

  it('excludes archived rows by virtue of the is_archived=false filter (no archived in result set)', async () => {
    // The query is filtered server-side; the fake returns only non-archived rows. We assert the
    // filter is applied AND that a key match within the returned (active) set resolves.
    const { supabase, eqCalls } = makeSupabase([
      { id: 'active-1', title_pt: 'Live Story', title_en: null },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['Live Story', null])
    expect(id).toBe('active-1')
    expect(eqCalls).toContainEqual(['is_archived', false])
  })

  it('returns null without querying when the candidate key is empty', async () => {
    const { supabase } = makeSupabase([{ id: 'x', title_pt: 'x', title_en: null }])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['', ''])
    expect(id).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns null without querying when titles are null/whitespace', async () => {
    const { supabase } = makeSupabase([])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['   ', null])
    expect(id).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns null when no active row shares the key', async () => {
    const { supabase } = makeSupabase([
      { id: 'item-1', title_pt: 'Something Else', title_en: null },
    ])
    const id = await findActiveDuplicateTitleId(supabase as never, SITE_ID, 'video', ['My Story', null])
    expect(id).toBeNull()
  })
})
