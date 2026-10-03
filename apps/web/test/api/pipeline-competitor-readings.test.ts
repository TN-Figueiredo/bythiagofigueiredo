// @vitest-environment node
/**
 * The forja's observatory routes (Task 33): the typed claim, the refusal on …/fail and the readings endpoint.
 *
 * The routes are thin adapters, so they run here over the REAL services (forja-queue, failTask) against a small
 * in-memory PostgREST fake that keeps state between requests: a GET that freezes `sent` is visible to the next GET
 * and to the POST, and a published reading closes the task for the second POST. Only authentication, the dataset
 * loader, the observatory facade and buildSent are faked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/pipeline/helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/helpers')>()),
  authenticateIntel: vi.fn(),
}))
const state = vi.hoisted(() => ({ client: null as unknown, permissions: ['read', 'intelligence'] as string[], keyId: 'key-forja' as string | undefined }))
vi.mock('@/lib/pipeline/services/http-adapter', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/services/http-adapter')>()),
  authToServiceContext: vi.fn(() => ({ siteId: 'site-1', permissions: state.permissions, keyId: state.keyId, supabase: state.client, source: 'api_key' })),
}))
vi.mock('@/lib/youtube/observatorio/load', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/load')>()),
  loadDataset: vi.fn(async () => ({ marker: 'dataset' })),
}))
vi.mock('@/lib/youtube/observatorio', () => ({ createObservatory: vi.fn(() => ({ marker: 'observatory' })) }))
vi.mock('@/lib/youtube/observatorio/forja/sent', async (orig) => ({
  ...(await orig<typeof import('@/lib/youtube/observatorio/forja/sent')>()),
  buildSent: vi.fn(),
}))

import { authenticateIntel } from '@/lib/pipeline/helpers'
import { loadDataset } from '@/lib/youtube/observatorio/load'
import { buildSent, type SentPack } from '@/lib/youtube/observatorio/forja/sent'
import { ORPHAN_READING_MIN_AGE_MS } from '@/lib/pipeline/services/forja-queue'

/* ------------------------------------------------------------------------------------------------ fake PostgREST */

type Row = Record<string, unknown>
interface Op { op: string; args: unknown[] }
interface Query { table: string; ops: Op[] }
interface Res { data: unknown; error: unknown }

/** Only what the services under test use: eq (incl. `a->>b`), is null, select/update/insert/delete/upsert. */
function fakeDb(tables: Record<string, Row[]>) {
  const queries: Query[] = []
  let seq = 0
  const col = (row: Row, c: string) => {
    const [a, b] = c.split('->>')
    if (b === undefined) return row[a!]
    const j = row[a!] as Record<string, unknown> | null
    return j == null ? undefined : j[b]
  }
  const matches = (row: Row, q: Query) => q.ops.every(o =>
    o.op === 'eq' ? col(row, o.args[0] as string) === o.args[1]
    : o.op === 'is' ? (o.args[1] === null ? col(row, o.args[0] as string) == null : true)
    : true)
  function run(q: Query, single: boolean): Res {
    const rows = (tables[q.table] ??= [])
    const kind = q.ops[0]?.op
    const out = (list: Row[]): Res => ({ data: single ? (list[0] ? { ...list[0] } : null) : list.map(r => ({ ...r })), error: null })
    if (kind === 'select') return out(rows.filter(r => matches(r, q)))
    if (kind === 'update') {
      const hit = rows.filter(r => matches(r, q))
      for (const r of hit) Object.assign(r, q.ops[0]!.args[0] as Row)
      return out(hit)
    }
    if (kind === 'delete') {
      const hit = rows.filter(r => matches(r, q))
      tables[q.table] = rows.filter(r => !hit.includes(r))
      return out(hit)
    }
    if (kind === 'insert') {
      const row = { id: 'reading-' + ++seq, created_at: new Date().toISOString(), ...(q.ops[0]!.args[0] as Row) }
      if (q.table === 'competitor_readings' && rows.some(r => r.task_id === row.task_id)) return { data: null, error: { code: '23505', message: 'duplicate' } }
      rows.push(row)
      return out([row])
    }
    if (kind === 'upsert') {
      const row = q.ops[0]!.args[0] as Row
      tables[q.table] = [...rows.filter(r => r.site_id !== row.site_id), row]
      return out([row])
    }
    return { data: null, error: { message: 'fake: unsupported ' + kind } }
  }
  const client = {
    from(table: string) {
      const q: Query = { table, ops: [] }
      queries.push(q)
      const builder: object = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (ok: (v: Res) => unknown, ko: (e: unknown) => unknown) => Promise.resolve().then(() => run(q, false)).then(ok, ko)
          if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve().then(() => run(q, true))
          return (...args: unknown[]) => { q.ops.push({ op: String(prop), args }); return builder }
        },
      })
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, tables, queries }
}

/* ------------------------------------------------------------------------------------------------ fixtures */

const AUTH = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key' as const, keyHash: 'h', keyId: 'key-forja' } }
const CH = '11111111-1111-4111-8111-111111111111'
const TASK = '22222222-2222-4222-8222-222222222222'
const V1 = '33333333-3333-4333-8333-333333333333'
const STARTED = '2026-10-03T14:45:00.000Z'

const SENT: SentPack = {
  text: 'dados enviados à forja: 3 vídeos', asOf: Date.parse('2026-10-03T12:00:00Z'), ids: [V1], numbers: ['3', '1,5 mil', '8,2×', '2º'],
  nVideos: 3, nOutliers: 1, channels: [CH], channelsOut: [], items: [{ kind: 'vídeo', id: V1, views: '1,5 mil', mult: '8,2×' }], capped: false,
}

function runningTask(over: Row = {}): Row {
  return {
    id: TASK, site_id: 'site-1', status: 'running', task_type: 'temas', target_niche: 'ia', target_video_id: null, target_fmt: 'long',
    channel_id: null, trigger_type: 'manual', requested_at: '2026-10-03T14:40:00.000Z', started_at: STARTED, retry_count: 0,
    result_summary: { claimed_by: 'key-forja' }, sent: null, released_at: null, failed_at: null, ...over,
  }
}

let db: ReturnType<typeof fakeDb>
function useDb(tasks: Row[], readings: Row[] = []) {
  db = fakeDb({ youtube_intelligence_tasks: tasks, competitor_readings: readings, forja_heartbeat: [] })
  state.client = db.client
}

beforeEach(() => {
  vi.clearAllMocks()
  state.permissions = ['read', 'intelligence']
  state.keyId = 'key-forja'
  vi.mocked(authenticateIntel).mockResolvedValue(AUTH)
  vi.mocked(buildSent).mockImplementation(() => structuredClone(SENT))
})

function req(method: string, url: string, body?: unknown) {
  return new NextRequest(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) }) as never
}
const BASE = 'http://localhost/api/pipeline'
const claimReq = (body: unknown) => req('POST', BASE + '/youtube/intelligence/task/claim', body)
const failReq = (body: unknown, id = TASK) => req('POST', `${BASE}/youtube/intelligence/task/${id}/fail`, body)
const readGet = (q = '?task_id=' + TASK) => req('GET', BASE + '/youtube/competitors/readings' + q)
const readPost = (body: unknown) => req('POST', BASE + '/youtube/competitors/readings', body)
const params = (id = TASK) => ({ params: Promise.resolve({ id }) })

function reading(over: Row = {}) {
  return {
    task_id: TASK, model: 'Gemma 12B', generated_at: '2026-10-03T15:00:00Z',
    text: { title: 'Temas que se repetem', lead: 'O vídeo chegou a 8,2× com 1,5 mil views, o 2º maior da base.', items: ['3 vídeos lidos'] },
    analysis: { tipo: 'temas', tentativas: 1 }, evidence: [{ id: V1, note: '' }], ...over,
  }
}

/* ------------------------------------------------------------------------------------------------ claim */

describe('POST …/intelligence/task/claim with task_types', () => {
  it('passes the announced types to the claim filter and writes the heartbeat with them (R52)', async () => {
    useDb([{ ...runningTask(), status: 'pending', started_at: null, result_summary: null }])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(claimReq({ channel_ids: [CH], task_types: ['temas'] }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ id: TASK, task_type: 'temas', target_niche: 'ia', target_video_id: null, target_fmt: 'long' })
    expect(db.queries[0]!.table).toBe('forja_heartbeat')
    expect(db.tables.forja_heartbeat).toEqual([expect.objectContaining({ site_id: 'site-1', capabilities: ['temas'], key_id: 'key-forja' })])
    const sel = db.queries[1]!
    expect(sel.ops.find(o => o.op === 'or')!.args[0]).toBe(`and(task_type.eq.diagnostico,channel_id.in.(${CH})),task_type.in.(temas)`)
  })

  it('writes the heartbeat on an empty queue too, and answers 204', async () => {
    useDb([])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(claimReq({ channel_ids: [CH], task_types: ['temas', 'leitura-video'] }))
    expect(res.status).toBe(204)
    expect(db.tables.forja_heartbeat).toEqual([expect.objectContaining({ capabilities: ['temas', 'leitura-video'] })])
  })

  it('without task_types (today\'s production worker): no heartbeat, diagnostico only (R52)', async () => {
    useDb([])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(claimReq({ channel_ids: [CH] }))
    expect(res.status).toBe(204)
    expect(db.queries.map(q => q.table)).toEqual(['youtube_intelligence_tasks'])
    expect(db.tables.forja_heartbeat).toEqual([])
    expect(db.queries[0]!.ops.find(o => o.op === 'or')!.args[0]).toBe(`and(task_type.eq.diagnostico,channel_id.in.(${CH}))`)
  })

  it('400s an unknown type or more than 5 types — before anything is written', async () => {
    useDb([])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    for (const task_types of [['nope'], ['temas', 'temas', 'temas', 'temas', 'temas', 'temas'], 'temas']) {
      const res = await POST(claimReq({ channel_ids: [CH], task_types }))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    }
    expect(db.queries).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------------------------------------ fail / refuse */

describe('POST …/intelligence/task/:id/fail with refuse', () => {
  it('400s refuse + retry together, before touching the task', async () => {
    useDb([runningTask()])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(failReq({ reason: 'dado-velho', refuse: true, retry: true }), params())
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    expect(db.queries).toHaveLength(0)
  })

  it('refuse:true refuses the running task (status refused, refused_reason, refused_at)', async () => {
    useDb([runningTask()])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(failReq({ reason: 'dado-velho', refuse: true }), params())
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ id: TASK, status: 'refused' })
    expect(db.tables.youtube_intelligence_tasks![0]).toMatchObject({ status: 'refused', refused_reason: 'dado-velho', refused_at: expect.any(String) })
  })

  it('refuse on a task held by another key is a 409', async () => {
    useDb([runningTask({ result_summary: { claimed_by: 'other-key' } })])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(failReq({ reason: 'dado-velho', refuse: true }), params())
    expect(res.status).toBe(409)
    expect(db.tables.youtube_intelligence_tasks![0]).toMatchObject({ status: 'running' })
  })

  it('R27: a requeue clears a released_at left by an earlier vigia release', async () => {
    useDb([runningTask({ released_at: new Date(Date.now() - 60 * 60_000).toISOString() })])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(failReq({ reason: 'validador', retry: true }), params())
    expect(res.status).toBe(200)
    expect(db.tables.youtube_intelligence_tasks![0]).toMatchObject({ status: 'pending', retry_count: 1, released_at: null, started_at: null })
  })

  it('R27: a plain fail stamps failed_at after the old released_at, so the state reads "falhou", not "liberado pelo vigia"', async () => {
    const released = new Date(Date.now() - 60 * 60_000).toISOString()
    useDb([runningTask({ released_at: released })])
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(failReq({ reason: 'llama' }), params())
    expect(res.status).toBe(200)
    const row = db.tables.youtube_intelligence_tasks![0]!
    expect(row.status).toBe('failed')
    expect(Date.parse(row.failed_at as string)).toBeGreaterThan(Date.parse(released))
  })
})

/* ------------------------------------------------------------------------------------------------ readings GET */

describe('GET …/competitors/readings', () => {
  it('400s without task_id or with a non-uuid', async () => {
    useDb([runningTask()])
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    for (const q of ['', '?task_id=nope']) {
      const res = await GET(readGet(q))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    }
    expect(db.queries).toHaveLength(0)
  })

  it('freezes sent on the first read; the second read returns the same object without rebuilding it', async () => {
    useDb([runningTask()])
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const first = await GET(readGet())
    expect(first.status).toBe(200)
    const a = (await first.json()).data
    expect(a).toEqual({ task_id: TASK, task_type: 'temas', target: { niche: 'ia', video_id: null, fmt: 'long' }, sent: SENT })
    expect(db.tables.youtube_intelligence_tasks![0]!.sent).toEqual(SENT)
    expect(vi.mocked(buildSent)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(buildSent).mock.calls[0]!.slice(1)).toEqual(['temas', { niche: 'ia', videoId: null, fmt: 'long' }])
    expect(vi.mocked(loadDataset).mock.calls[0]![0]).toMatchObject({ siteId: 'site-1' })

    vi.mocked(buildSent).mockImplementation(() => ({ ...structuredClone(SENT), text: 'something else' }))
    const second = await GET(readGet())
    expect(second.status).toBe(200)
    expect((await second.json()).data).toEqual(a)
    expect(vi.mocked(buildSent)).toHaveBeenCalledTimes(1)
  })

  it('the freeze is a CAS on sent IS NULL, the claim (started_at) and the holder', async () => {
    useDb([runningTask()])
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    await GET(readGet())
    const upd = db.queries.find(q => q.table === 'youtube_intelligence_tasks' && q.ops[0]!.op === 'update')!
    const ops = upd.ops.map(o => [o.op, ...o.args.slice(0, 2)])
    expect(ops).toEqual(expect.arrayContaining([['is', 'sent', null], ['eq', 'status', 'running'], ['eq', 'started_at', STARTED], ['eq', 'result_summary->>claimed_by', 'key-forja']]))
  })

  it('409s when the task is not running, or is held by another key — and builds nothing', async () => {
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    for (const t of [runningTask({ status: 'pending' }), runningTask({ status: 'completed' }), runningTask({ result_summary: { claimed_by: 'other-key' } })]) {
      useDb([t])
      const res = await GET(readGet())
      expect(res.status).toBe(409)
      expect((await res.json()).error.code).toBe('TASK_NOT_RUNNING')
    }
    expect(buildSent).not.toHaveBeenCalled()
  })

  it('404s an unknown task; 400s a diagnostico task', async () => {
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    useDb([])
    expect((await GET(readGet())).status).toBe(404)
    useDb([runningTask({ task_type: 'diagnostico', channel_id: CH, target_niche: null, target_fmt: null })])
    expect((await GET(readGet())).status).toBe(400)
  })

  it('a target the engine cannot build (video gone) is a 422 TARGET_UNAVAILABLE, not a retryable 500, and nothing is frozen', async () => {
    useDb([runningTask({ task_type: 'leitura-video', target_video_id: V1, target_fmt: null })])
    vi.mocked(buildSent).mockImplementation(() => { throw new Error('buildSent: unknown video ' + V1) })
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await GET(readGet())
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('TARGET_UNAVAILABLE')
    expect(db.tables.youtube_intelligence_tasks![0]!.sent).toBeNull()
  })

  it('a concurrent read that froze first wins: its sent is returned, ours is dropped', async () => {
    useDb([runningTask()])
    const other = { ...structuredClone(SENT), text: 'frozen by the other read' }
    // the other request freezes between our read and our CAS
    vi.mocked(buildSent).mockImplementation(() => { db.tables.youtube_intelligence_tasks![0]!.sent = other; return structuredClone(SENT) })
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await GET(readGet())
    expect(res.status).toBe(200)
    expect((await res.json()).data.sent).toEqual(other)
  })

  it('a session (no api key) is refused by authenticateIntel apiKeyOnly', async () => {
    useDb([runningTask()])
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    await GET(readGet())
    expect(vi.mocked(authenticateIntel).mock.calls[0]![1]).toEqual({ apiKeyOnly: true })
  })
})

/* ------------------------------------------------------------------------------------------------ readings POST */

describe('POST …/competitors/readings', () => {
  async function frozen() {
    useDb([runningTask()])
    const { GET } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    expect((await GET(readGet())).status).toBe(200)
  }

  it('400 VALIDATION_ERROR for a number not in sent.numbers — nothing written', async () => {
    await frozen()
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await POST(readPost(reading({ text: { lead: 'Chegou a 9,1× em 3 vídeos.', items: [] } })))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('9,1×')
    expect(db.tables.competitor_readings).toEqual([])
    expect(db.tables.youtube_intelligence_tasks![0]!.status).toBe('running')
  })

  it('400 for evidence outside sent.ids', async () => {
    await frozen()
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await POST(readPost(reading({ evidence: [{ id: 'not-sent', note: '' }] })))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('400 for a malformed body (no task_id, generated_at without offset) and for invalid JSON', async () => {
    await frozen()
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    for (const body of [reading({ task_id: undefined }), reading({ generated_at: '2026-10-03T15:00:00' })]) {
      const res = await POST(readPost(body))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    }
    const bad = new Request(BASE + '/youtube/competitors/readings', { method: 'POST', body: 'not json', headers: { 'content-type': 'application/json' } }) as never
    expect((await POST(bad)).status).toBe(400)
  })

  it('409 TASK_NOT_READY when sent was never frozen (no GET first)', async () => {
    useDb([runningTask()])
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await POST(readPost(reading()))
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('TASK_NOT_READY')
  })

  it('valid → 200 {reading_id}, the reading carries the frozen sent and the task is completed; again → 409', async () => {
    await frozen()
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    // the worker's exact shape: generated_at with Z, note "" for an evidence without a note
    const res = await POST(readPost(reading()))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toEqual({ reading_id: expect.any(String) })
    expect(db.tables.competitor_readings).toEqual([expect.objectContaining({ id: data.reading_id, task_id: TASK, sent: SENT, model: 'Gemma 12B', niche: 'ia', fmt: 'long' })])
    expect(db.tables.youtube_intelligence_tasks![0]).toMatchObject({ status: 'completed', result_summary: expect.objectContaining({ reading_id: data.reading_id }) })

    const again = await POST(readPost(reading()))
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('TASK_NOT_RUNNING')
    expect(db.tables.competitor_readings).toHaveLength(1)
  })

  it('a reading left behind by a crashed POST (older than the orphan age) does not block the retry (R51)', async () => {
    await frozen()
    db.tables.competitor_readings!.push({ id: 'orphan', site_id: 'site-1', task_id: TASK, created_at: new Date(Date.now() - ORPHAN_READING_MIN_AGE_MS - 1000).toISOString() })
    const { POST } = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    const res = await POST(readPost(reading()))
    expect(res.status).toBe(200)
    expect(db.tables.competitor_readings!.map(r => r.id)).not.toContain('orphan')
  })
})

describe('readings route config', () => {
  it('maxDuration is 60 (the coupled forja budget)', async () => {
    const mod = await import('@/app/api/pipeline/youtube/competitors/readings/route')
    expect(mod.maxDuration).toBe(60)
    expect(mod.dynamic).toBe('force-dynamic')
  })
})
