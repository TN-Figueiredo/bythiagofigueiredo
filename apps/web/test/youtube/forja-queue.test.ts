// @vitest-environment node
/**
 * forja-queue service against a fake PostgREST client: every `from(table)` opens its own query, records its
 * chain and is answered by the test's `respond(query)`. The DB-gated suite (test/integration/forja-queue.test.ts)
 * proves the real filters, indexes and CHECKs; this one pins the calls and the validation rules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceContext } from '@/lib/pipeline/services/types'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
// askReading loads the dataset lazily; here a minimal observatory stands in (no channels, heartbeat alive with 'temas').
const OBS_NOW = Date.parse('2026-10-03T15:00:00Z')
// only loadDataset is faked: the row mapper (taskRowToRequest) and TASK_COLS are the real ones the service shares with the loader
vi.mock('@/lib/youtube/observatorio/load', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/youtube/observatorio/load')>()),
  loadDataset: vi.fn(async () => ({ queue: { lastPollAt: OBS_NOW - 60_000, tickMinutes: 10, capabilities: ['temas'] } })),
}))
vi.mock('@/lib/youtube/observatorio', async () => {
  const { createClock } = await import('@/lib/youtube/observatorio/time')
  return { createObservatory: () => ({ date: createClock(OBS_NOW, OBS_NOW - 30 * 864e5, OBS_NOW - 30 * 864e5), forja: { eligibleChannels: () => ({ in: [], out: [] }) }, video: () => undefined }) }
})

import * as Sentry from '@sentry/nextjs'
import { claim, recordHeartbeat, refuseTask, completeReading, cancelReading, askReading, type ObsType } from '@/lib/pipeline/services/forja-queue'

interface Op { op: string; args: unknown[] }
interface Query { table: string; ops: Op[] }
interface Res { data: unknown; error: unknown }

function fakeClient(respond: (q: Query) => Res) {
  const queries: Query[] = []
  const client = {
    from(table: string) {
      const q: Query = { table, ops: [] }
      queries.push(q)
      const builder: object = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => respond(q)).then(ok, ko)
          if (prop === 'maybeSingle' || prop === 'single') return () => { q.ops.push({ op: String(prop), args: [] }); return Promise.resolve().then(() => respond(q)) }
          return (...args: unknown[]) => { q.ops.push({ op: String(prop), args }); return builder }
        },
      })
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, queries }
}
const first = (q: Query) => q.ops[0]?.op
const has = (q: Query, op: string, ...args: unknown[]) => q.ops.some(o => o.op === op && JSON.stringify(o.args.slice(0, args.length)) === JSON.stringify(args))
const ctxOf = (supabase: SupabaseClient, over: Partial<ServiceContext> = {}): ServiceContext => ({
  siteId: 'site-1', permissions: ['read', 'intelligence'], keyId: 'key-forja', supabase, source: 'api_key', ...over,
})

const NOW = Date.parse('2026-10-03T15:00:00Z')
const CH = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const V1 = '33333333-3333-4333-8333-333333333333'
const V2 = '44444444-4444-4444-8444-444444444444'
const OK: Res = { data: null, error: null }

beforeEach(() => vi.clearAllMocks())

describe('recordHeartbeat', () => {
  it('upserts last_poll_at = now, the capabilities and the key, keyed on site_id', async () => {
    const f = fakeClient(() => OK)
    await recordHeartbeat(ctxOf(f.client), ['temas'], NOW)
    const q = f.queries[0]!
    expect(q.table).toBe('forja_heartbeat')
    expect(q.ops[0]).toEqual({ op: 'upsert', args: [{ site_id: 'site-1', last_poll_at: new Date(NOW).toISOString(), capabilities: ['temas'], key_id: 'key-forja' }, { onConflict: 'site_id' }] })
  })
  it('a session context (no key) writes key_id null', async () => {
    const f = fakeClient(() => OK)
    await recordHeartbeat(ctxOf(f.client, { keyId: undefined, source: 'session' }), [], NOW)
    expect((f.queries[0]!.ops[0]!.args[0] as Record<string, unknown>).key_id).toBeNull()
  })
})

describe('claim', () => {
  it('without the heartbeat option (Health Coach, legacy GET, MCP, Cowork) never touches forja_heartbeat (R46)', async () => {
    const f = fakeClient(() => OK)
    const res = await claim(ctxOf(f.client), { channelIds: [CH] }, NOW)
    expect(res.data).toBeNull()
    expect(f.queries.map(q => q.table)).toEqual(['youtube_intelligence_tasks'])
    const sel = f.queries[0]!
    expect(has(sel, 'eq', 'site_id', 'site-1')).toBe(true)
    expect(has(sel, 'eq', 'status', 'pending')).toBe(true)
    expect(has(sel, 'or', `and(task_type.eq.diagnostico,channel_id.in.(${CH}))`)).toBe(true)
    expect(has(sel, 'order', 'requested_at', { ascending: true })).toBe(true)
    // the old `.in('channel_id', …)` is gone: it let observatory rows (channel_id null) through on the legacy path
    expect(sel.ops.some(o => o.op === 'in')).toBe(false)
  })

  it('even with task_types, no option → no heartbeat (only the forja route passes it)', async () => {
    const f = fakeClient(() => OK)
    await claim(ctxOf(f.client), { channelIds: [CH], taskTypes: ['temas'] }, NOW)
    expect(f.queries.some(q => q.table === 'forja_heartbeat')).toBe(false)
  })

  it('with the heartbeat option: written FIRST, even on an empty queue; capabilities filtered; the filter adds the types', async () => {
    const f = fakeClient(() => OK)
    const types = ['temas', 'resumo-trocas', 'nope' as never] as ObsType[]
    const res = await claim(ctxOf(f.client), { channelIds: [CH], taskTypes: types }, NOW, { heartbeat: { capabilities: types } })
    expect(res.data).toBeNull()
    expect(f.queries.map(q => q.table)).toEqual(['forja_heartbeat', 'youtube_intelligence_tasks'])
    expect(f.queries[0]!.ops[0]!.args[0]).toEqual({ site_id: 'site-1', last_poll_at: new Date(NOW).toISOString(), capabilities: ['temas', 'resumo-trocas'], key_id: 'key-forja' })
    expect(has(f.queries[1]!, 'or', `and(task_type.eq.diagnostico,channel_id.in.(${CH})),task_type.in.(temas,resumo-trocas)`)).toBe(true)
  })

  it('legacy GET (no channel ids, no types) is restricted to diagnostico', async () => {
    const f = fakeClient(() => OK)
    await claim(ctxOf(f.client, { permissions: ['read', 'write', 'intelligence'] }), { channelIds: [] }, NOW)
    expect(has(f.queries[0]!, 'or', 'task_type.eq.diagnostico')).toBe(true)
    expect(f.queries.some(q => q.table === 'forja_heartbeat')).toBe(false)
  })

  it('CAS pending → running with claimed_by and a closed column list carrying the target', async () => {
    const f = fakeClient(q => q.table !== 'youtube_intelligence_tasks' ? OK
      : first(q) === 'select' ? { data: { id: TASK_ID }, error: null }
      : { data: { id: TASK_ID, site_id: 'site-1', channel_id: null, trigger_type: 'manual', requested_at: 'x', started_at: 'y', task_type: 'temas', target_niche: 'ia', target_video_id: null, target_fmt: 'long' }, error: null })
    const res = await claim(ctxOf(f.client), { channelIds: [CH], taskTypes: ['temas'] }, NOW, { heartbeat: { capabilities: ['temas'] } })
    expect(res.data).toMatchObject({ id: TASK_ID, task_type: 'temas', target_niche: 'ia' })
    const cas = f.queries[2]!
    expect(cas.ops[0]!.op).toBe('update')
    expect(cas.ops[0]!.args[0]).toMatchObject({ status: 'running', started_at: new Date(NOW).toISOString(), result_summary: { claimed_by: 'key-forja' } })
    expect(has(cas, 'eq', 'id', TASK_ID) && has(cas, 'eq', 'site_id', 'site-1') && has(cas, 'eq', 'status', 'pending')).toBe(true)
    expect(has(cas, 'select', 'id, site_id, channel_id, trigger_type, requested_at, started_at, task_type, target_niche, target_video_id, target_fmt')).toBe(true)
  })

  it('a heartbeat write error does not block the claim — it goes to Sentry', async () => {
    const f = fakeClient(q => q.table === 'forja_heartbeat' ? { data: null, error: { message: 'boom' } } : OK)
    await expect(claim(ctxOf(f.client), { channelIds: [CH] }, NOW, { heartbeat: { capabilities: [] } })).resolves.toMatchObject({ data: null })
    expect(Sentry.captureMessage).toHaveBeenCalled()
  })

  it('a non-UUID channel id is a 400, before anything is written (heartbeat included)', async () => {
    const f = fakeClient(() => OK)
    await expect(claim(ctxOf(f.client), { channelIds: ['x),or(y'] }, NOW, { heartbeat: { capabilities: [] } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(f.queries).toHaveLength(0)
  })

  it('a SELECT error is a 500, never a silent empty queue', async () => {
    const f = fakeClient(q => q.table === 'youtube_intelligence_tasks' ? { data: null, error: { message: 'down' } } : OK)
    await expect(claim(ctxOf(f.client), { channelIds: [CH] }, NOW)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })
})

const running = (o: Record<string, unknown> = {}) => ({
  id: TASK_ID, status: 'running', task_type: 'temas', target_niche: 'ia', target_video_id: null, target_fmt: 'long',
  result_summary: { claimed_by: 'key-forja' }, started_at: '2026-10-03T14:55:00Z',
  sent: { text: 'dados enviados à forja: 12 longos', asOf: NOW, ids: [V1, V2], numbers: ['12', '2', '8,2×', '1,5 mil', '−41%', '12 pp'], nVideos: 12, nOutliers: 2, channels: [], channelsOut: [], items: [], capped: false },
  ...o,
})

describe('refuseTask', () => {
  it('CAS running → refused with the short code, refused_at, the started_at pin and the owner', async () => {
    const f = fakeClient(q => first(q) === 'select' ? { data: running(), error: null } : { data: { id: TASK_ID, status: 'refused' }, error: null })
    const res = await refuseTask(ctxOf(f.client), TASK_ID, 'dado-velho', NOW)
    expect(res.data).toEqual({ id: TASK_ID, status: 'refused' })
    const cas = f.queries[1]!
    // refused_at from the injected clock, like claim's started_at
    expect(cas.ops[0]!.args[0]).toMatchObject({ status: 'refused', refused_reason: 'dado-velho', refused_at: new Date(NOW).toISOString() })
    expect(has(cas, 'eq', 'status', 'running') && has(cas, 'eq', 'started_at', '2026-10-03T14:55:00Z') && has(cas, 'eq', 'result_summary->>claimed_by', 'key-forja')).toBe(true)
  })
  it('409 for a task held by another key; 409 when not running', async () => {
    const other = fakeClient(() => ({ data: running({ result_summary: { claimed_by: 'outra' } }), error: null }))
    await expect(refuseTask(ctxOf(other.client), TASK_ID, 'dado-velho')).rejects.toMatchObject({ status: 409 })
    const done = fakeClient(() => ({ data: running({ status: 'completed' }), error: null }))
    await expect(refuseTask(ctxOf(done.client), TASK_ID, 'dado-velho')).rejects.toMatchObject({ status: 409 })
  })
  it('400 for an empty or > 200-char reason, and for a diagnostico task', async () => {
    const f = fakeClient(() => ({ data: running(), error: null }))
    await expect(refuseTask(ctxOf(f.client), TASK_ID, 'x'.repeat(201))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    await expect(refuseTask(ctxOf(f.client), TASK_ID, '  ')).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    const d = fakeClient(() => ({ data: running({ task_type: 'diagnostico', target_niche: null }), error: null }))
    await expect(refuseTask(ctxOf(d.client), TASK_ID, 'dado-velho')).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
  })
  it('409 when the CAS loses', async () => {
    const f = fakeClient(q => first(q) === 'select' ? { data: running(), error: null } : OK)
    await expect(refuseTask(ctxOf(f.client), TASK_ID, 'dado-velho')).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })
})

const submission = (o: Record<string, unknown> = {}) => ({
  task_id: TASK_ID, model: 'Gemma 12B', generated_at: '2026-10-03T12:00:00-03:00',
  text: { title: 'Temas de IA', lead: 'Dos 12 longos, 2 passaram de 8,2×.', items: ['Agentes: 1,5 mil views/dia', 'Queda de −41%'] },
  analysis: { linhas_lidas: 12, linhas_enviadas: 12 },
  evidence: [{ id: V1, note: 'subiu 12 pp' }],
  ...o,
})
function completeClient(task: Record<string, unknown> | null, o: { insert?: Res | Res[]; cas?: Res; del?: Res } = {}) {
  let inserts = 0
  return fakeClient(q => {
    if (q.table === 'competitor_readings') {
      if (first(q) !== 'insert') return o.del ?? OK
      const r = Array.isArray(o.insert) ? o.insert[Math.min(inserts, o.insert.length - 1)] : o.insert
      inserts++
      return r ?? { data: { id: 'reading-1' }, error: null }
    }
    return first(q) === 'select' ? { data: task, error: null } : (o.cas ?? { data: { id: TASK_ID }, error: null })
  })
}

describe('completeReading', () => {
  it('inserts the reading with sent copied from the task, the analysis extras and the target; then CAS → completed', async () => {
    const f = completeClient(running())
    const res = await completeReading(ctxOf(f.client), submission(), NOW)
    expect(res.data).toEqual({ readingId: 'reading-1' })
    const ins = f.queries.find(q => q.table === 'competitor_readings')!
    expect(ins.ops[0]!.args[0]).toMatchObject({
      site_id: 'site-1', task_id: TASK_ID, task_type: 'temas', niche: 'ia', video_id: null, fmt: 'long', model: 'Gemma 12B',
      generated_at: '2026-10-03T12:00:00-03:00', sent: running().sent, analysis: { linhas_lidas: 12, linhas_enviadas: 12 },
      text: submission().text, evidence: [{ id: V1, note: 'subiu 12 pp' }],
    })
    const cas = f.queries[f.queries.length - 1]!
    expect(cas.ops[0]!.args[0]).toMatchObject({ status: 'completed', completed_at: new Date(NOW).toISOString() })
    expect(has(cas, 'eq', 'status', 'running') && has(cas, 'eq', 'started_at', '2026-10-03T14:55:00Z') && has(cas, 'eq', 'result_summary->>claimed_by', 'key-forja')).toBe(true)
  })

  it('generated_at accepts Z as well as an offset (R29)', async () => {
    const f = completeClient(running())
    await expect(completeReading(ctxOf(f.client), submission({ generated_at: '2026-10-03T15:00:00Z' }))).resolves.toBeTruthy()
    await expect(completeReading(ctxOf(f.client), submission({ generated_at: '03/10/2026' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
  })

  it('a number outside sent.numbers (title, lead, items or evidence note) → 400 naming the tokens; nothing written', async () => {
    const f = completeClient(running())
    const bad = submission({
      text: { title: 'Top 3', lead: 'Dos 12 longos, 2 passaram de 9,9×.', items: ['Agentes: 1,5 mil views/dia'] },
      evidence: [{ id: V1, note: 'ganhou 7 pp' }],
    })
    const e = await completeReading(ctxOf(f.client), bad).catch((x: unknown) => x as { code: string; status: number; message: string })
    expect(e).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(e.message).toContain('3')
    expect(e.message).toContain('9,9×')
    expect(e.message).toContain('7 pp')
    expect(f.queries.some(q => q.table === 'competitor_readings')).toBe(false)
  })

  it('numbers compare in the canonical form on both sides ("8,2x" ≡ "8,2×", "-41 %" ≡ "−41%", NBSP)', async () => {
    const f = completeClient(running())
    await expect(completeReading(ctxOf(f.client), submission({ text: { lead: 'Passou de 8,2x e caiu -41 %, 1,5 mil.', items: [] } }))).resolves.toBeTruthy()
  })

  it('evidence ids must be in sent.ids → 400 naming the id', async () => {
    const f = completeClient(running())
    const stranger = '55555555-5555-4555-8555-555555555555'
    const e = await completeReading(ctxOf(f.client), submission({ evidence: [{ id: stranger }] })).catch((x: unknown) => x as { status: number; message: string })
    expect(e).toMatchObject({ status: 400 })
    expect(e.message).toContain(stranger)
  })

  it('409 when the task is not running (a second POST), held by another key, or its data was never read', async () => {
    await expect(completeReading(ctxOf(completeClient(running({ status: 'completed' })).client), submission())).rejects.toMatchObject({ status: 409 })
    await expect(completeReading(ctxOf(completeClient(running({ result_summary: { claimed_by: 'outra' } })).client), submission())).rejects.toMatchObject({ status: 409 })
    await expect(completeReading(ctxOf(completeClient(running({ sent: null })).client), submission())).rejects.toMatchObject({ status: 409 })
  })

  it('404 when the task does not exist; 400 for a diagnostico task', async () => {
    await expect(completeReading(ctxOf(completeClient(null).client), submission())).rejects.toMatchObject({ status: 404 })
    await expect(completeReading(ctxOf(completeClient(running({ task_type: 'diagnostico' })).client), submission())).rejects.toMatchObject({ status: 400 })
  })

  const DUP: Res = { data: null, error: { code: '23505', message: 'duplicate key' } }
  it('an orphan reading of this (still running) task is removed by task_id and the insert retried once → published', async () => {
    const f = completeClient(running(), { insert: [DUP, { data: { id: 'reading-2' }, error: null }] })
    const res = await completeReading(ctxOf(f.client), submission(), NOW)
    expect(res.data).toEqual({ readingId: 'reading-2' })
    const del = f.queries.filter(q => q.table === 'competitor_readings' && first(q) === 'delete')
    expect(del).toHaveLength(1)
    expect(has(del[0]!, 'eq', 'site_id', 'site-1') && has(del[0]!, 'eq', 'task_id', TASK_ID)).toBe(true)
    expect(f.queries.filter(q => q.table === 'competitor_readings' && first(q) === 'insert')).toHaveLength(2)
  })

  it('a 23505 again after removing the orphan → 409 (no loop)', async () => {
    const f = completeClient(running(), { insert: DUP })
    await expect(completeReading(ctxOf(f.client), submission())).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
    expect(f.queries.filter(q => q.table === 'competitor_readings' && first(q) === 'insert')).toHaveLength(2)
  })

  it('the orphan cannot be removed → 500, nothing published', async () => {
    const f = completeClient(running(), { insert: DUP, del: { data: null, error: { message: 'rls' } } })
    await expect(completeReading(ctxOf(f.client), submission())).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(f.queries.some(q => q.table === 'youtube_intelligence_tasks' && first(q) === 'update')).toBe(false)
  })

  it('the CAS lost after the insert → the reading is removed by its id and the answer is 409', async () => {
    const f = completeClient(running(), { cas: OK })
    await expect(completeReading(ctxOf(f.client), submission())).rejects.toMatchObject({ status: 409 })
    const del = f.queries.filter(q => q.table === 'competitor_readings' && first(q) === 'delete')
    expect(del).toHaveLength(1)
    expect(has(del[0]!, 'eq', 'id', 'reading-1')).toBe(true)
  })

  it('the cleanup after a lost CAS fails → still 409, Sentry told; the next attempt removes that orphan (test above)', async () => {
    const f = completeClient(running(), { cas: OK, del: { data: null, error: { message: 'down' } } })
    await expect(completeReading(ctxOf(f.client), submission())).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('cleanup'), expect.anything())
  })
})

describe('cancelReading', () => {
  it('deletes only the PENDING row of that type and niche of this site', async () => {
    const f = fakeClient(() => ({ data: [{ id: TASK_ID }], error: null }))
    const res = await cancelReading(ctxOf(f.client), { type: 'temas', niche: 'ia' })
    expect(res.data).toEqual({ cancelled: true })
    const q = f.queries[0]!
    expect(first(q)).toBe('delete')
    expect(has(q, 'eq', 'site_id', 'site-1') && has(q, 'eq', 'task_type', 'temas') && has(q, 'eq', 'target_niche', 'ia') && has(q, 'eq', 'status', 'pending')).toBe(true)
  })
  it('nothing pending (running or none) → cancelled: false', async () => {
    const f = fakeClient(() => ({ data: [], error: null }))
    expect((await cancelReading(ctxOf(f.client), { type: 'temas', niche: 'ia' })).data).toEqual({ cancelled: false })
  })
  it('leitura-video cancels by video', async () => {
    const f = fakeClient(() => ({ data: [], error: null }))
    await cancelReading(ctxOf(f.client), { type: 'leitura-video', niche: 'ia', videoId: V1 })
    expect(has(f.queries[0]!, 'eq', 'target_video_id', V1)).toBe(true)
  })
})

describe('askReading — the unique-index race', () => {
  const USER = '00000000-0000-4000-8000-0000000000aa'
  it('a concurrent ask that won the niche (23505) → ok:false with the engine\'s "já há um pedido de IA …" text', async () => {
    let reads = 0
    const f = fakeClient(q => {
      if (first(q) === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "idx_yt_intel_obs_active"' } }
      reads++
      return reads === 1 ? { data: [], error: null } : { data: [{
        id: 'other', task_type: 'temas', target_niche: 'ia', target_video_id: null, target_fmt: 'long', status: 'pending',
        requested_at: new Date(OBS_NOW - 30_000).toISOString(), started_at: null, completed_at: null, failed_at: null, refused_at: null, refused_reason: null, released_at: null, retry_count: 0,
      }], error: null }
    })
    const res = await askReading(ctxOf(f.client), { type: 'temas', scope: 'ia', userId: USER }, OBS_NOW)
    expect(res.data.ok).toBe(false)
    expect(res.data.results).toHaveLength(1)
    expect(res.data.reason).toMatch(/^Nada enviado: já há um pedido de IA na fila · pedido \d\d:\d\d/)
  })
  it('validates the input: leitura-video needs a videoId; userId is a uuid', async () => {
    const f = fakeClient(() => OK)
    await expect(askReading(ctxOf(f.client), { type: 'leitura-video', scope: 'ia', userId: USER }, OBS_NOW)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    await expect(askReading(ctxOf(f.client), { type: 'temas', scope: 'ia', userId: 'x' }, OBS_NOW)).rejects.toMatchObject({ status: 400 })
    expect(f.queries).toHaveLength(0)
  })
})
