/**
 * Service-level tests for the per-beat recording ledger
 * (apps/web/src/app/api/pipeline/items/[id]/recording/service.ts).
 *
 * Mirrors the links service test style: stub a ServiceContext (siteId, permissions,
 * source) + a fluent Supabase query-builder mock, then drive the real service functions
 * and assert status codes, payload attribution, scoping, and reconciliation invariants.
 *
 * Covers the security + stale-integrity gaps:
 *  - read-only key rejected on writes (403)
 *  - invalid UUID (400), missing item (404)
 *  - happy PUT upsert + source/content_hash derivation
 *  - if_unmodified_since → 412 carrying details.current
 *  - batch >100 → validation error
 *  - purgeOrphans deletes only orphan ids (never a live beat) + lang/site scoping
 *  - retake_note cleared unless status='refazer'
 *  - source attribution is derived from the auth channel, never the body
 *  - content_hash is server-derived for recorded beats (no silent-pass null)
 *  - GET surfaces updated_at on reconciled beats + orphans
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRecording,
  putRecording,
  batchRecording,
  purgeOrphans,
  RecordingPreconditionError,
} from '@/app/api/pipeline/items/[id]/recording/service'
import { beatContentHash } from '@/lib/pipeline/video-recording'
import { readRoteiro } from '@/lib/pipeline/roteiro-schemas'
import { PipelineServiceError } from '@/lib/pipeline/services/types'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import type { SupabaseClient } from '@supabase/supabase-js'

const SITE_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_SITE = '22222222-2222-2222-2222-222222222222'
const ITEM_ID = '33333333-3333-3333-3333-333333333333'
const BAD_ID = 'not-a-uuid'

const BEAT_A = 'beat-aaaa'
const BEAT_B = 'beat-bbbb'
const BEAT_ORPHAN = 'beat-orphan'

// A video item whose roteiro_pt section has two fala beats (A, B). beatContentHash is
// derived from these so the service's server-side hash derivation can be asserted.
function videoItem(): {
  id: string
  format: string
  version: number
  sections: Record<string, unknown>
} {
  const roteiro = {
    version: 3 as const,
    meta: {},
    beats: [
      { idx: 0, id: BEAT_A, name: 'Hook', kind: 'fala' as const, script: [{ type: 'line' as const, text: 'Olá mundo' }] },
      { idx: 1, id: BEAT_B, name: 'Desenvolvimento', kind: 'fala' as const, script: [{ type: 'line' as const, text: 'Segundo beat' }] },
    ],
  }
  return {
    id: ITEM_ID,
    format: 'video',
    version: 7,
    sections: {
      roteiro_pt: {
        rev: 1,
        source: 'user',
        edited: true,
        content: roteiro,
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    },
  }
}

/** The server-derived content hash for a current fala beat (matches the service). */
function hashFor(beatId: string): string {
  const item = videoItem()
  const section = item.sections.roteiro_pt as { content: unknown }
  const roteiro = readRoteiro(section.content)
  const beat = roteiro.beats.find((b) => b.id === beatId)
  if (!beat) throw new Error(`beat ${beatId} not in fixture`)
  return beatContentHash(beat)
}

// ---------------------------------------------------------------------------
// Fluent Supabase query-builder stub.
//
// Records the last operation + filters and resolves terminal calls to a canned
// result chosen by the test. The builder is thenable so `await builder` (the
// fetchRows / batch / delete cases) resolves too.
// ---------------------------------------------------------------------------

interface QueryResult {
  data: unknown
  error: { message: string } | null
}

interface RecordedCall {
  table: string
  op: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  filters: Record<string, unknown>
  inFilter?: { col: string; values: unknown[] }
  payload?: unknown
}

interface StubConfig {
  // keyed by `${table}:${op}` → result
  results: Record<string, QueryResult>
}

function makeSupabase(config: StubConfig): {
  client: SupabaseClient
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []

  function builder(table: string) {
    const call: RecordedCall = { table, op: 'select', filters: {} }
    const result = (): QueryResult =>
      config.results[`${table}:${call.op}`] ?? { data: null, error: null }

    const api: Record<string, unknown> = {
      select() {
        return api
      },
      insert(payload: unknown) {
        call.op = 'insert'
        call.payload = payload
        return api
      },
      update(payload: unknown) {
        call.op = 'update'
        call.payload = payload
        return api
      },
      upsert(payload: unknown) {
        call.op = 'upsert'
        call.payload = payload
        return api
      },
      delete() {
        call.op = 'delete'
        return api
      },
      eq(col: string, val: unknown) {
        call.filters[col] = val
        return api
      },
      in(col: string, values: unknown[]) {
        call.inFilter = { col, values }
        return api
      },
      single() {
        const r = result()
        return Promise.resolve(r)
      },
      maybeSingle() {
        const r = result()
        return Promise.resolve(r)
      },
      then(onF: (v: QueryResult) => unknown, onR?: (e: unknown) => unknown) {
        return Promise.resolve(result()).then(onF, onR)
      },
    }
    calls.push(call)
    return api
  }

  const client = { from: (table: string) => builder(table) } as unknown as SupabaseClient
  return { client, calls }
}

function ctxWith(
  overrides: Partial<ServiceContext> & { supabase: SupabaseClient },
): ServiceContext {
  return {
    siteId: SITE_ID,
    permissions: ['read', 'write'],
    source: 'session',
    ...overrides,
  }
}

const itemFound: QueryResult = { data: videoItem(), error: null }

// ===========================================================================
// putRecording
// ===========================================================================

describe('putRecording', () => {
  let calls: RecordedCall[]

  beforeEach(() => {
    calls = []
  })

  it('rejects a read-only key on write (403)', async () => {
    const { client } = makeSupabase({ results: {} })
    const ctx = ctxWith({ supabase: client, permissions: ['read'] })
    await expect(
      putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada' }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('rejects an invalid UUID (400)', async () => {
    const { client } = makeSupabase({ results: {} })
    const ctx = ctxWith({ supabase: client })
    await expect(
      putRecording(ctx, BAD_ID, 'pt', { beat_id: BEAT_A, status: 'gravada' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('returns 404 when the item is absent / cross-site', async () => {
    const { client } = makeSupabase({
      results: { 'content_pipeline:select': { data: null, error: { message: 'no row' } } },
    })
    const ctx = ctxWith({ supabase: client })
    await expect(
      putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('upserts a gravada beat: derives source from auth channel + server hash, scopes to site', async () => {
    const stored = {
      id: 'row-1',
      site_id: SITE_ID,
      pipeline_id: ITEM_ID,
      lang: 'pt',
      beat_id: BEAT_A,
      status: 'gravada',
      retake_note: null,
      beat_name: null,
      content_hash: hashFor(BEAT_A),
      source: 'cowork',
      updated_at: '2026-06-08T10:00:00.000Z',
      modified_by: null,
    }
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: stored, error: null },
      },
    })
    calls = mk.calls
    // api_key channel → 'cowork' attribution
    const ctx = ctxWith({ supabase: mk.client, source: 'api_key' })
    const res = await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada' })

    expect(res.data.row.status).toBe('gravada')

    const upsert = calls.find((c) => c.table === 'video_recording_status' && c.op === 'upsert')
    expect(upsert).toBeDefined()
    const payload = upsert!.payload as Record<string, unknown>
    // source derived from auth channel, NOT the (now-removed) body field
    expect(payload.source).toBe('cowork')
    // server-derived content_hash — never null for a recorded beat
    expect(payload.content_hash).toBe(hashFor(BEAT_A))
    expect(payload.site_id).toBe(SITE_ID)
    expect(payload.lang).toBe('pt')
  })

  it('attributes a session write as user', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: { beat_id: BEAT_A }, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client, source: 'session' })
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada' })
    const upsert = calls.find((c) => c.op === 'upsert')!
    expect((upsert.payload as Record<string, unknown>).source).toBe('user')
  })

  it('ignores a forged source field in the body (stripped by schema)', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: { beat_id: BEAT_A }, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client, source: 'session' })
    // A caller tries to forge 'cowork' on a human session write.
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada', source: 'cowork' })
    const upsert = calls.find((c) => c.op === 'upsert')!
    expect((upsert.payload as Record<string, unknown>).source).toBe('user')
  })

  it('clears retake_note unless status is refazer', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: { beat_id: BEAT_A }, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client })
    // gravada + a note → note dropped
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada', retake_note: 'redo it' })
    let payload = (calls.find((c) => c.op === 'upsert')!.payload) as Record<string, unknown>
    expect(payload.retake_note).toBeNull()

    // refazer + a note → note kept
    calls.length = 0
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'refazer', retake_note: 'redo it' })
    payload = (calls.find((c) => c.op === 'upsert')!.payload) as Record<string, unknown>
    expect(payload.retake_note).toBe('redo it')
  })

  it('stores null hash for a pendente beat (nothing to go stale)', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: { beat_id: BEAT_A }, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client })
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'pendente' })
    const payload = (calls.find((c) => c.op === 'upsert')!.payload) as Record<string, unknown>
    expect(payload.content_hash).toBeNull()
  })

  it('honours a client-supplied content_hash when present', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: { beat_id: BEAT_A }, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client })
    await putRecording(ctx, ITEM_ID, 'pt', { beat_id: BEAT_A, status: 'gravada', content_hash: 'client123' })
    const payload = (calls.find((c) => c.op === 'upsert')!.payload) as Record<string, unknown>
    expect(payload.content_hash).toBe('client123')
  })

  it('if_unmodified_since: returns 412 carrying details.current when the row moved on', async () => {
    const current = {
      id: 'row-1',
      site_id: SITE_ID,
      pipeline_id: ITEM_ID,
      lang: 'pt',
      beat_id: BEAT_A,
      status: 'refazer',
      retake_note: 'changed elsewhere',
      beat_name: null,
      content_hash: hashFor(BEAT_A),
      source: 'user',
      updated_at: '2026-06-08T12:00:00.000Z',
      modified_by: null,
    }
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        // conditional update matched 0 rows
        'video_recording_status:update': { data: null, error: null },
        // but a row exists (moved past the precondition)
        'video_recording_status:select': { data: current, error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client })

    let thrown: unknown
    try {
      await putRecording(ctx, ITEM_ID, 'pt', {
        beat_id: BEAT_A,
        status: 'gravada',
        if_unmodified_since: '2026-06-08T09:00:00.000Z',
      })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(RecordingPreconditionError)
    const err = thrown as RecordingPreconditionError
    expect(err.status).toBe(412)
    expect(err.details?.current).toMatchObject({ beat_id: BEAT_A, updated_at: current.updated_at })
    expect(err.current.updated_at).toBe(current.updated_at)
  })

  it('if_unmodified_since: succeeds (atomic update path) when the precondition matches', async () => {
    const updated = {
      id: 'row-1',
      site_id: SITE_ID,
      pipeline_id: ITEM_ID,
      lang: 'pt',
      beat_id: BEAT_A,
      status: 'gravada',
      retake_note: null,
      beat_name: null,
      content_hash: hashFor(BEAT_A),
      source: 'user',
      updated_at: '2026-06-08T13:00:00.000Z',
      modified_by: null,
    }
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:update': { data: updated, error: null },
      },
    })
    calls = mk.calls
    const ctx = ctxWith({ supabase: mk.client })
    const res = await putRecording(ctx, ITEM_ID, 'pt', {
      beat_id: BEAT_A,
      status: 'gravada',
      if_unmodified_since: '2026-06-08T12:00:00.000Z',
    })
    expect(res.data.row.status).toBe('gravada')
    // conditional update gated on the expected updated_at
    const upd = calls.find((c) => c.op === 'update')!
    expect(upd.filters.updated_at).toBe('2026-06-08T12:00:00.000Z')
    expect(upd.filters.site_id).toBe(SITE_ID)
  })
})

// ===========================================================================
// batchRecording
// ===========================================================================

describe('batchRecording', () => {
  it('rejects a read-only key (403)', async () => {
    const { client } = makeSupabase({ results: {} })
    const ctx = ctxWith({ supabase: client, permissions: ['read'] })
    await expect(
      batchRecording(ctx, ITEM_ID, 'pt', { updates: [{ beat_id: BEAT_A, status: 'gravada' }] }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('rejects more than 100 updates (validation error)', async () => {
    const { client } = makeSupabase({
      results: { 'content_pipeline:select': itemFound },
    })
    const ctx = ctxWith({ supabase: client })
    const updates = Array.from({ length: 101 }, (_, i) => ({ beat_id: `b${i}`, status: 'gravada' as const }))
    await expect(
      batchRecording(ctx, ITEM_ID, 'pt', { updates }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('rejects an empty updates array (validation error)', async () => {
    const { client } = makeSupabase({ results: { 'content_pipeline:select': itemFound } })
    const ctx = ctxWith({ supabase: client })
    await expect(
      batchRecording(ctx, ITEM_ID, 'pt', { updates: [] }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('derives source + per-beat server hashes for the whole batch', async () => {
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:upsert': { data: [{ beat_id: BEAT_A }, { beat_id: BEAT_B }], error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client, source: 'api_key' })
    const res = await batchRecording(ctx, ITEM_ID, 'pt', {
      updates: [
        { beat_id: BEAT_A, status: 'gravada' },
        { beat_id: BEAT_B, status: 'refazer', retake_note: 'again' },
      ],
    })
    expect(res.data.updated).toBe(2)
    const upsert = mk.calls.find((c) => c.op === 'upsert')!
    const payload = upsert.payload as Array<Record<string, unknown>>
    expect(payload[0]).toMatchObject({ source: 'cowork', content_hash: hashFor(BEAT_A), retake_note: null })
    expect(payload[1]).toMatchObject({ source: 'cowork', content_hash: hashFor(BEAT_B), retake_note: 'again' })
  })
})

// ===========================================================================
// purgeOrphans
// ===========================================================================

describe('purgeOrphans', () => {
  it('rejects a read-only key (403)', async () => {
    const { client } = makeSupabase({ results: {} })
    const ctx = ctxWith({ supabase: client, permissions: ['read'] })
    await expect(purgeOrphans(ctx, ITEM_ID, 'pt')).rejects.toMatchObject({ status: 403 })
  })

  it('deletes only orphan beat_ids, scoped to site + lang — never a live beat', async () => {
    const storedRows = [
      { beat_id: BEAT_A, status: 'gravada', retake_note: null, beat_name: null, content_hash: hashFor(BEAT_A), updated_at: '2026-06-08T00:00:00.000Z' },
      { beat_id: BEAT_ORPHAN, status: 'refazer', retake_note: 'x', beat_name: null, content_hash: 'old', updated_at: '2026-06-08T00:00:00.000Z' },
    ]
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:select': { data: storedRows, error: null },
        'video_recording_status:delete': { data: null, error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client })
    const res = await purgeOrphans(ctx, ITEM_ID, 'pt')

    expect(res.data.purged).toBe(1)
    expect(res.data.orphan_beat_ids).toEqual([BEAT_ORPHAN])

    const del = mk.calls.find((c) => c.op === 'delete')!
    // only the orphan id targeted; the live beat (BEAT_A) is never in the IN list
    expect(del.inFilter).toEqual({ col: 'beat_id', values: [BEAT_ORPHAN] })
    expect(del.inFilter!.values).not.toContain(BEAT_A)
    // site + lang scoping preserved
    expect(del.filters.site_id).toBe(SITE_ID)
    expect(del.filters.pipeline_id).toBe(ITEM_ID)
    expect(del.filters.lang).toBe('pt')
  })

  it('no-ops (no delete) when there are no orphans', async () => {
    const storedRows = [
      { beat_id: BEAT_A, status: 'gravada', retake_note: null, beat_name: null, content_hash: hashFor(BEAT_A), updated_at: '2026-06-08T00:00:00.000Z' },
    ]
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:select': { data: storedRows, error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client })
    const res = await purgeOrphans(ctx, ITEM_ID, 'pt')
    expect(res.data.purged).toBe(0)
    expect(mk.calls.find((c) => c.op === 'delete')).toBeUndefined()
  })
})

// ===========================================================================
// getRecording — reconcile + updated_at surfacing
// ===========================================================================

describe('getRecording', () => {
  it('reconciles stored rows and surfaces updated_at on matched beats + orphans', async () => {
    const storedRows = [
      {
        beat_id: BEAT_A,
        status: 'gravada',
        retake_note: null,
        beat_name: 'Hook',
        content_hash: hashFor(BEAT_A),
        updated_at: '2026-06-08T08:00:00.000Z',
      },
      {
        beat_id: BEAT_ORPHAN,
        status: 'refazer',
        retake_note: 'gone',
        beat_name: 'Old beat',
        content_hash: 'stale',
        updated_at: '2026-06-07T00:00:00.000Z',
      },
    ]
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:select': { data: storedRows, error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client })
    const res = await getRecording(ctx, ITEM_ID, 'pt')

    expect(res.data.roteiro_present).toBe(true)
    expect(res.meta?.item_version).toBe(7)

    // matched beat carries updated_at (so a writer can send if_unmodified_since)
    const a = res.data.beats.find((b) => b.beat_id === BEAT_A)!
    expect(a.status).toBe('gravada')
    expect(a.stale).toBe(false)
    expect(a.updated_at).toBe('2026-06-08T08:00:00.000Z')

    // fresh pendente beat (B) has no row → no updated_at
    const b = res.data.beats.find((bb) => bb.beat_id === BEAT_B)!
    expect(b.status).toBe('pendente')
    expect(b.updated_at).toBeUndefined()

    // orphan surfaced with its updated_at, not auto-deleted
    expect(res.data.orphans).toHaveLength(1)
    expect(res.data.orphans[0]).toMatchObject({ beat_id: BEAT_ORPHAN, updated_at: '2026-06-07T00:00:00.000Z' })
  })

  it('flags stale when the stored hash differs from the live roteiro hash', async () => {
    const storedRows = [
      {
        beat_id: BEAT_A,
        status: 'gravada',
        retake_note: null,
        beat_name: 'Hook',
        content_hash: 'OUTDATED_HASH',
        updated_at: '2026-06-08T08:00:00.000Z',
      },
    ]
    const mk = makeSupabase({
      results: {
        'content_pipeline:select': itemFound,
        'video_recording_status:select': { data: storedRows, error: null },
      },
    })
    const ctx = ctxWith({ supabase: mk.client })
    const res = await getRecording(ctx, ITEM_ID, 'pt')
    const a = res.data.beats.find((b) => b.beat_id === BEAT_A)!
    expect(a.stale).toBe(true)
  })

  it('rejects an invalid UUID (400)', async () => {
    const { client } = makeSupabase({ results: {} })
    const ctx = ctxWith({ supabase: client })
    await expect(getRecording(ctx, BAD_ID, 'pt')).rejects.toBeInstanceOf(PipelineServiceError)
    await expect(getRecording(ctx, BAD_ID, 'pt')).rejects.toMatchObject({ status: 400 })
  })
})
