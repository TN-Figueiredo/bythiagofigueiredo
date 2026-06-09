import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))

import { createItems } from '@/lib/pipeline/services/items'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { ServiceContext } from '@/lib/pipeline/services/types'

const SITE_ID = '11111111-1111-1111-1111-111111111111'

type Row = { id: string; title_pt: string | null; title_en: string | null; format?: string; is_archived?: boolean; [k: string]: unknown }

const ctx: ServiceContext = {
  siteId: SITE_ID,
  permissions: ['write'],
  supabase: {} as never,
}

/**
 * Stateful fake of the supabase service client tailored to `createItems`' access pattern.
 *
 * `createItems` issues exactly three kinds of statements against `content_pipeline`:
 *  1. findActiveDuplicateTitleId → .select('id, title_pt, title_en').eq(site).eq(format).eq(is_archived=false)  [awaited]
 *  2. batch insert               → .insert(rows[]).select()                                                      [awaited]
 *  3. resolve existing ids       → .select().eq('site_id', …).in('id', [...])                                    [awaited]
 *
 * We distinguish them by which builder method was called (insert vs in vs plain select), and by
 * whether `.single()` was invoked. The fake is a per-query builder so concurrent chains don't
 * clobber each other.
 *
 * `store` is the simulated DB of pre-existing (active) rows used for dup detection.
 * `insertedSink` captures every row passed to `.insert()` so the test can assert insert counts.
 */
function titleKey(pt?: string | null, en?: string | null): string {
  const p = (pt ?? '').trim()
  return (p.length > 0 ? p : (en ?? '')).trim().toLowerCase()
}

function makeClient(opts: {
  store?: Row[]
  // optional override for what the batch insert returns (data/error); default echoes rows with ids
  onInsert?: (rows: Row[]) => { data?: Row[] | Row | null; error?: { code?: string; message?: string } | null }
}) {
  const store: Row[] = [...(opts.store ?? [])]
  const insertedSink: Row[][] = []
  let autoId = 0

  function newBuilder() {
    const state: {
      op: 'select' | 'insert'
      insertRows: Row[]
      eqs: Array<[string, unknown]>
      inIds: string[] | null
      single: boolean
    } = { op: 'select', insertRows: [], eqs: [], inIds: null, single: false }

    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn((col: string, val: unknown) => {
      state.eqs.push([col, val])
      return builder
    })
    builder.in = vi.fn((_col: string, ids: string[]) => {
      state.inIds = ids
      return builder
    })
    builder.insert = vi.fn((rows: Row | Row[]) => {
      state.op = 'insert'
      const arr = Array.isArray(rows) ? rows : [rows]
      state.insertRows = arr
      insertedSink.push(arr)
      return builder
    })
    builder.single = vi.fn(() => {
      state.single = true
      return builder
    })

    function resolve(): { data: unknown; error: unknown } {
      if (state.op === 'insert') {
        const provided = opts.onInsert
          ? opts.onInsert(state.insertRows)
          : { data: state.insertRows.map((r) => ({ ...r, id: r.id ?? `new-${++autoId}` })) }
        if (provided.error) return { data: null, error: provided.error }
        const data = provided.data ?? null
        if (state.single) {
          const one = Array.isArray(data) ? (data[0] ?? null) : data
          return { data: one, error: null }
        }
        return { data, error: null }
      }
      // select branch
      const byId = state.eqs.find(([c]) => c === 'id')?.[1] as string | undefined
      if (state.inIds) {
        const rows = store.filter((r) => state.inIds!.includes(r.id))
        return { data: rows, error: null }
      }
      if (byId && state.single) {
        const row = store.find((r) => r.id === byId) ?? null
        return { data: row, error: null }
      }
      // findActiveDuplicateTitleId branch: site_id + format + is_archived filters
      const format = state.eqs.find(([c]) => c === 'format')?.[1] as string | undefined
      const rows = store.filter(
        (r) => (r.is_archived ?? false) === false && (format === undefined || r.format === format),
      )
      return { data: rows, error: null }
    }

    ;(builder as { then: unknown }).then = (
      onFulfilled: (v: { data: unknown; error: unknown }) => unknown,
    ) => onFulfilled(resolve())

    return builder
  }

  const client = {
    from: vi.fn(() => newBuilder()),
  }
  return { client, store, insertedSink }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createItems — get-or-create by story identity', () => {
  it('resolves to an existing item on title match: no insert, meta.resolved_ids contains it', async () => {
    const { client, insertedSink } = makeClient({
      store: [{ id: 'existing-1', title_pt: 'My Story', title_en: null, format: 'video', is_archived: false }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [{ format: 'video', title_pt: 'My Story', language: 'pt-br' }],
    })

    expect(insertedSink).toHaveLength(0)
    const rows = res.data as Record<string, unknown>[]
    expect(rows[0]!.id).toBe('existing-1')
    expect(res.meta?.resolved_ids).toContain('existing-1')
    expect(res.meta?.created_ids).toEqual([])
  })

  it('creates when no duplicate exists: one insert, meta.created_ids has the new id', async () => {
    const { client, insertedSink } = makeClient({ store: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [{ format: 'video', title_pt: 'Brand New', language: 'pt-br' }],
    })

    expect(insertedSink).toHaveLength(1)
    expect(insertedSink[0]).toHaveLength(1)
    const rows = res.data as Record<string, unknown>[]
    expect(typeof rows[0]!.id).toBe('string')
    expect(res.meta?.created_ids).toEqual([rows[0]!.id])
    expect(res.meta?.resolved_ids).toEqual([])
  })

  it('collapses two same-title items within one batch to a single insert', async () => {
    const { client, insertedSink } = makeClient({ store: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [
        { format: 'video', title_pt: 'Same Title', language: 'pt-br' },
        { format: 'video', title_pt: '  same title ', language: 'pt-br' },
      ],
    })

    // Only one row actually inserted (intra-batch dedup on normalized key).
    expect(insertedSink).toHaveLength(1)
    expect(insertedSink[0]).toHaveLength(1)

    const rows = res.data as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    // Both results point to the same created item (collapsed via the shared insertIndex).
    expect(rows[0]!.id).toBe(rows[1]!.id)
    // The row is inserted ONCE; the implementation attributes the id per-plan, so the same id
    // appears twice in created_ids (one entry per result position) — but only one DB insert.
    expect(res.meta?.created_ids).toEqual([rows[0]!.id, rows[1]!.id])
  })

  it('does NOT collapse same-title items across different formats', async () => {
    const { client, insertedSink } = makeClient({ store: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [
        { format: 'video', title_pt: 'Shared', language: 'pt-br' },
        { format: 'blog_post', title_pt: 'Shared', language: 'pt-br' },
      ],
    })

    expect(insertedSink).toHaveLength(1)
    expect(insertedSink[0]).toHaveLength(2)
    const rows = res.data as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows[0]!.id).not.toBe(rows[1]!.id)
    expect(res.meta?.created_ids).toHaveLength(2)
  })

  it('mixed batch: returns rows in input order with correct resolved/created split', async () => {
    const { client, insertedSink } = makeClient({
      store: [{ id: 'existing-A', title_pt: 'Old One', title_en: null, format: 'video', is_archived: false }],
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [
        { format: 'video', title_pt: 'Old One', language: 'pt-br' }, // → resolves to existing-A
        { format: 'video', title_pt: 'Fresh One', language: 'pt-br' }, // → created
        { format: 'video', title_pt: 'Old One', language: 'pt-br' }, // → resolves to existing-A again
      ],
    })

    // Only the one genuinely new row was inserted.
    expect(insertedSink).toHaveLength(1)
    expect(insertedSink[0]).toHaveLength(1)

    const rows = res.data as Record<string, unknown>[]
    expect(rows).toHaveLength(3)
    // Order preserved.
    expect(rows[0]!.id).toBe('existing-A')
    expect(typeof rows[1]!.id).toBe('string')
    expect(rows[1]!.id).not.toBe('existing-A')
    expect(rows[2]!.id).toBe('existing-A')

    // resolved_ids has one entry per resolving result position (existing-A appears twice);
    // created_ids has the one fresh insert.
    expect(res.meta?.resolved_ids).toEqual(['existing-A', 'existing-A'])
    expect(res.meta?.created_ids).toEqual([rows[1]!.id])
  })

  it('single-input still returns an array (params.items is always an array → isBatch)', async () => {
    // `createItems` derives isBatch from `Array.isArray(items)`, which is always true for the
    // params shape — so even a one-element input yields a one-element array, not a bare object.
    const { client } = makeClient({ store: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(client as never)

    const res = await createItems(ctx, {
      items: [{ format: 'video', title_pt: 'Solo', language: 'pt-br' }],
    })

    expect(Array.isArray(res.data)).toBe(true)
    const rows = res.data as Record<string, unknown>[]
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBeDefined()
    expect(res.meta?.created_ids).toEqual([rows[0]!.id])
  })
})
