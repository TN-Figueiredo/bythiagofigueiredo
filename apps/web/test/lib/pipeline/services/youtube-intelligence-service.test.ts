// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { claimNextTask, failTask, submitIntelRecommendations, getIntelligenceSnapshot } from '@/lib/pipeline/services/youtube'
import { PatchPayloadSchema } from '@/lib/youtube/intelligence-schemas'
import type { ServiceContext } from '@/lib/pipeline/services/types'
import fixture from '../../../fixtures/intel-cowork-2026-05-18.json'
import { fanOutToSiteAdmins } from '@/lib/notifications/fan-out-to-admins'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/lib/notifications/fan-out-to-admins', () => ({ fanOutToSiteAdmins: vi.fn() }))

type Call = { op: string; args: unknown[] }

/** Chainable PostgREST double: records every call, replays queued terminal results. */
function makeSupabase(results: Array<{ data: unknown; error: unknown }>) {
  const calls: Call[] = []
  const tables: string[] = []
  let i = 0
  const chain: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'in', 'order', 'limit', 'update', 'is', 'not', 'gte', 'insert']) {
    chain[op] = vi.fn((...args: unknown[]) => { calls.push({ op, args }); return chain })
  }
  // Recorded in `calls` like every other op, so a test can assert a query is NOT a
  // single-object read — `.maybeSingle()` raises PGRST116 on more than one row, which is now
  // a live hazard on any query over the accumulating channel history.
  chain.maybeSingle = vi.fn(async () => { calls.push({ op: 'maybeSingle', args: [] }); return results[i++] ?? { data: null, error: null } })
  chain.single = vi.fn(async () => { calls.push({ op: 'single', args: [] }); return results[i++] ?? { data: null, error: null } })
  // Real supabase-js resolves ANY filter builder when awaited, not just one ending in
  // `.single()`/`.maybeSingle()` — `.insert(x)` and a bare `.select().eq().in(...)` are both
  // awaited directly in the service. Without this, such a call would resolve to the chain
  // object itself instead of the queued `{ data, error }`, silently starving later assertions.
  chain.then = (resolve: (value: unknown) => void) => resolve(results[i++] ?? { data: null, error: null })
  return {
    calls,
    tables,
    // `from` is recorded in `calls` too, so a test can slice the ops belonging to ONE table
    // out of the shared chain (see `opsOnTable`).
    client: { from: vi.fn((t: string) => { tables.push(t); calls.push({ op: 'from', args: [t] }); return chain }) },
    /**
     * Slice of `calls` starting at the first occurrence of `op` — use this, never a
     * bare `expect(calls).toContainEqual(...)`, for a CAS/UPDATE clause. The double
     * shares one `calls` array and one chain object across every query the service
     * makes in a test, so a SELECT that happens to touch the same column (e.g.
     * `site_id`) can silently satisfy an assertion meant for the UPDATE, and a
     * dropped filter on the real CAS would never fail the test.
     */
    from(op: string): Call[] {
      const idx = calls.findIndex((c) => c.op === op)
      return idx === -1 ? [] : calls.slice(idx)
    },
    /**
     * The ops issued against ONE table, from its `from(table)` up to the next `from(...)`.
     * The double shares a single chain object across every query, so this is the only way to
     * say "youtube_intelligence was never read with .maybeSingle()" without the task lookup
     * — which legitimately uses it — satisfying the assertion instead.
     */
    opsOnTable(table: string): Call[] {
      const start = calls.findIndex((c) => c.op === 'from' && c.args[0] === table)
      if (start === -1) return []
      const rel = calls.slice(start + 1).findIndex((c) => c.op === 'from')
      return rel === -1 ? calls.slice(start + 1) : calls.slice(start + 1, start + 1 + rel)
    },
  }
}

function ctxOf(sb: { client: unknown }, over: Partial<ServiceContext> = {}): ServiceContext {
  return {
    siteId: 'site-1',
    permissions: ['read', 'intelligence'],
    keyId: 'key-forja',
    supabase: sb.client as ServiceContext['supabase'],
    source: 'api_key',
    ...over,
  }
}

const TASK_ID = '22222222-2222-4222-8222-222222222222'

/** The only payload shape the forja ever sends in 2a: channel coaching, no video rows. */
const CHANNEL_ONLY = {
  task_id: TASK_ID,
  coaching: { summary: 'ok', priorities: [] },
  channel_insights: { patterns_detected: [], analysis_text: 'texto' },
}

const runningTask = {
  data: { id: TASK_ID, channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-forja' }, started_at: '2026-09-19T10:00:00Z' },
  error: null,
}

describe('claimNextTask', () => {
  beforeEach(() => vi.clearAllMocks())

  it('claims the oldest pending task filtered by channel_ids and records claimed_by', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: { id: 't1', site_id: 'site-1', channel_id: 'ch-1', trigger_type: 'cron', requested_at: '2026-09-01T00:00:00Z', started_at: '2026-09-19T10:00:00Z' }, error: null },
    ])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])

    expect(res.data).toMatchObject({ id: 't1', started_at: '2026-09-19T10:00:00Z' })
    expect(sb.calls).toContainEqual({ op: 'in', args: ['channel_id', ['ch-1']] })

    const casCalls = sb.from('update')
    expect(casCalls.length).toBeGreaterThan(0)
    expect(casCalls[0]!.args[0]).toMatchObject({ status: 'running', result_summary: { claimed_by: 'key-forja' } })
    expect(casCalls).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(casCalls).toContainEqual({ op: 'eq', args: ['status', 'pending'] })
    // Closed column list, never '*': error_message and result_summary can carry text
    // written by a narrow key and must not travel back to whoever claims next. The
    // exact string (not just "not '*'") also catches those columns creeping back in.
    expect(casCalls).toContainEqual({
      op: 'select',
      args: ['id, site_id, channel_id, trigger_type, requested_at, started_at'],
    })
  })

  it('returns null (204 upstream) when the queue is empty', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])
    expect(res.data).toBeNull()
  })

  it('returns null when the CAS is lost to another consumer', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: null, error: null },
    ])
    const res = await claimNextTask(ctxOf(sb), ['ch-1'])
    expect(res.data).toBeNull()
  })

  it('throws INTERNAL_ERROR when the SELECT errors — never a silent 204', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(claimNextTask(ctxOf(sb), ['ch-1'])).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('throws INTERNAL_ERROR when the CAS UPDATE errors', async () => {
    const sb = makeSupabase([
      { data: { id: 't1' }, error: null },
      { data: null, error: { message: 'boom' } },
    ])
    await expect(claimNextTask(ctxOf(sb), ['ch-1'])).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('does not filter by channel when no ids are given (legacy GET path)', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await claimNextTask(ctxOf(sb))
    expect(sb.calls.some(c => c.op === 'in')).toBe(false)
  })
})

describe('failTask', () => {
  beforeEach(() => vi.clearAllMocks())

  const running = (over: Record<string, unknown> = {}) => ({
    data: { id: 't1', status: 'running', retry_count: 0, result_summary: { claimed_by: 'key-forja' }, started_at: '2026-09-19T10:00:00Z', ...over },
    error: null,
  })

  it('fails the task terminally without retry', async () => {
    const sb = makeSupabase([running(), { data: { id: 't1', status: 'failed', retry_count: 0 }, error: null }])
    const res = await failTask(ctxOf(sb), 't1', { reason: 'patch 400' })
    expect(res.data).toEqual({ id: 't1', status: 'failed', retry_count: 0 })

    const patch = sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>
    expect(patch).toMatchObject({ status: 'failed', error_message: 'patch 400' })
    expect(patch.completed_at).toBeUndefined()

    // CAS clauses live on the UPDATE, not the SELECT — assert from the update call
    // onward so a dropped filter on the real CAS can't hide behind the SELECT's own
    // `.eq('id', ...).eq('site_id', ...)`.
    const cas = sb.from('update')
    expect(cas).toContainEqual({ op: 'eq', args: ['id', 't1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['status', 'running'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
  })

  it('requeues with retry:true while retry_count < 2', async () => {
    const sb = makeSupabase([running({ retry_count: 1 }), { data: { id: 't1', status: 'pending', retry_count: 2 }, error: null }])
    const res = await failTask(ctxOf(sb), 't1', { reason: 'llama', retry: true })
    expect(res.data).toMatchObject({ status: 'pending', retry_count: 2 })
    const patch = sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>
    expect(patch).toMatchObject({ status: 'pending', retry_count: 2, started_at: null, error_message: null })
  })

  it('fails terminally on the third retry', async () => {
    const sb = makeSupabase([running({ retry_count: 2 }), { data: { id: 't1', status: 'failed', retry_count: 2 }, error: null }])
    await failTask(ctxOf(sb), 't1', { reason: 'llama', retry: true })
    expect((sb.calls.find(c => c.op === 'update')!.args[0] as Record<string, unknown>).status).toBe('failed')
  })

  it('404s when the task is missing or belongs to another site', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('500s — never 404 — when the SELECT itself errors, without any UPDATE', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(sb.calls.some(c => c.op === 'update')).toBe(false)
  })

  it('409s when the task is not running', async () => {
    const sb = makeSupabase([running({ status: 'stale' })])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })

  it('409s a narrow key on a task claimed by someone else, and when keyId is missing', async () => {
    const other = makeSupabase([running({ result_summary: { claimed_by: 'key-other' } })])
    await expect(failTask(ctxOf(other), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(other.calls.some(c => c.op === 'update')).toBe(false)

    const noKey = makeSupabase([running()])
    await expect(failTask(ctxOf(noKey, { keyId: undefined }), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(noKey.calls.some(c => c.op === 'update')).toBe(false)
  })

  it('lets a write key close a task claimed by the forja', async () => {
    const sb = makeSupabase([running(), { data: { id: 't1', status: 'failed', retry_count: 0 }, error: null }])
    await failTask(ctxOf(sb, { permissions: ['read', 'write'], keyId: 'key-cowork' }), 't1', { reason: 'x' })
    expect(sb.calls.some(c => c.op === 'eq' && c.args[0] === 'result_summary->>claimed_by')).toBe(false)
  })

  it('409s when the CAS returns no row', async () => {
    const sb = makeSupabase([running(), { data: null, error: null }])
    await expect(failTask(ctxOf(sb), 't1', { reason: 'x' })).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })
})

describe('submitIntelRecommendations — schema', () => {
  it('rejects a payload outside the schema with 400 and a path-qualified message', async () => {
    const sb = makeSupabase([])
    await expect(
      submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), { task_id: 'not-a-uuid' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400, message: expect.stringContaining('task_id:') })
    expect(sb.tables).not.toContain('youtube_intelligence_tasks')
  })

  it('caps patterns_detected at 30, pattern_id at 80, category at 40 and requires an int sample_size', () => {
    const base = { task_id: '22222222-2222-4222-8222-222222222222' }
    const pattern = { pattern_id: 'p', category: 'series', finding: 'f', confidence: 0.5, sample_size: 4 }
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: Array.from({ length: 31 }, () => pattern) } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, pattern_id: 'x'.repeat(81) }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, category: 'x'.repeat(41) }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [{ ...pattern, sample_size: -1 }] } }).success).toBe(false)
    expect(PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [pattern] } }).success).toBe(true)
  })

  it('patterns_detected is discriminated on tipo: an examined series needs serie/leitura/motivo, ' +
    'a pattern cannot claim a neutral reading, and the old shape still validates', () => {
    const base = { task_id: '22222222-2222-4222-8222-222222222222' }
    const parse = (item: Record<string, unknown>) =>
      PatchPayloadSchema.safeParse({ ...base, channel_insights: { patterns_detected: [item] } })
    const examinada = { tipo: 'examinada', serie: 'canada', leitura: 'sem_coorte', motivo: 'coorte_fina' }
    expect(parse(examinada).success).toBe(true)
    expect(parse({ ...examinada, motivo: undefined }).success).toBe(false)
    expect(parse({ ...examinada, serie: undefined }).success).toBe(false)
    expect(parse({ ...examinada, leitura: 'abaixo' }).success).toBe(false)
    const pattern = { pattern_id: 'p', category: 'series', finding: 'f', confidence: 0.5, sample_size: 4 }
    expect(parse(pattern).success).toBe(true)
    expect(parse({ ...pattern, tipo: 'padrao', leitura: 'abaixo', mediana: 91, mediana_coorte: 143.5 }).success).toBe(true)
    expect(parse({ ...pattern, leitura: 'neutra' }).success).toBe(false)
    expect(parse({ ...pattern, anos: { de: 2017 } }).success).toBe(false)
    expect(parse({ ...pattern, periodo: { de: '2017-1-2', ate: '2019-06-14' } }).success).toBe(false)
    expect(parse({ ...pattern, episodios: ['nao-uuid'] }).success).toBe(false)
    // exact ratio travels unrounded: the parse keeps every digit
    const ok = parse({ ...pattern, razao: 0.6341463414634146 })
    expect(ok.success && ok.data.channel_insights?.patterns_detected?.[0]).toMatchObject({ razao: 0.6341463414634146 })
  })

  it('accepts the real May payload from Cowork unchanged', () => {
    // These two lengths sit exactly on the Zod ceilings. If a remount added an ellipsis or a
    // space the fixture would fail the parse — or be "fixed" and start measuring another payload.
    expect([...fixture.coaching.summary].length).toBe(500)
    const variants = fixture.video_recommendations
      .map((r: { suggested_variant_description?: string }) => r.suggested_variant_description)
      .filter((v: string | undefined): v is string => typeof v === 'string' && v.length === 200)
    expect(variants).toHaveLength(5)
    expect(PatchPayloadSchema.safeParse(fixture).success).toBe(true)
  })
})

describe('deriveSource and the forja scope guards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes source=forja for a narrow key, even with source:cowork in the body', async () => {
    // Three queued results, not four: the channel path lost its pre-read. Migration
    // 20260922000001 made the channel analysis accumulate, so submitIntelRecommendations
    // always INSERTs — the `.maybeSingle()` dedup lookup that used to sit here would now
    // raise PGRST116 ("more than one row") on the second run of any source.
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: '22222222-2222-4222-8222-222222222222' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), { ...CHANNEL_ONLY, source: 'cowork', __extra: 'smuggled-top-level' })
    const insert = sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>
    expect(insert.source).toBe('forja')
    expect(insert).not.toHaveProperty('__extra')
  })

  it(
    'the channel row is always INSERTed, never read-then-updated — the history depends on it',
    async () => {
      const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: TASK_ID }, error: null }])
      await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)

      // youtube_intelligence is touched exactly once, to write — no lookup first. A
      // read-then-update here is what erased the previous week's measurement, and the
      // `.maybeSingle()` it used would now error outright once a second row exists.
      expect(sb.tables.filter(t => t === 'youtube_intelligence')).toHaveLength(1)
      const intelOps = sb.opsOnTable('youtube_intelligence')
      expect(intelOps.some(c => c.op === 'maybeSingle' || c.op === 'single')).toBe(false)
      expect(intelOps.some(c => c.op === 'select')).toBe(false)
      expect(intelOps.some(c => c.op === 'update')).toBe(false)
      expect(intelOps.filter(c => c.op === 'insert')).toHaveLength(1)

      const insert = sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>
      expect(insert).toMatchObject({ channel_id: 'ch-1', video_id: null, type: 'channel', source: 'forja' })
      // Its own timestamp: every run is a distinct point in the series, not an overwrite.
      expect(typeof insert.generated_at).toBe('string')

      // The only UPDATE in the whole call is the closing CAS on the task table.
      expect(sb.calls.filter(c => c.op === 'update')).toHaveLength(1)
    },
  )

  it('writes source=forja even when the context never sets `source` at all — the fail-closed default', async () => {
    // Regression for the exact failure mode the deriveSource comment warns about: a
    // future call site that forgets to populate ServiceContext.source. Written by
    // inclusion (`ctx.source === 'api_key' && !wide ? 'forja' : 'cowork'`) this would
    // read as 'cowork' and silently switch off all four forja scope refusals.
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: 'x' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb, { source: undefined }), CHANNEL_ONLY)
    expect((sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>).source).toBe('forja')
  })

  it('writes source=cowork for a session context', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: 'x' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb, { source: 'session', permissions: ['read', 'write'], keyId: undefined }), CHANNEL_ONLY)
    expect((sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>).source).toBe('cowork')
  })

  it.each([
    ['notifications', { ...CHANNEL_ONLY, notifications: [{ type: 'grade_drop', priority: 1, title: 't', message: 'm' }] }],
    ['video_recommendations', { ...CHANNEL_ONLY, video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }] }],
    ['coaching', { task_id: CHANNEL_ONLY.task_id }],
    ['coaching.priorities', { ...CHANNEL_ONLY, coaching: { summary: 'ok', priorities: [{ axis: 'reach', score: 4, diagnosis: 'd', action: 'a' }] } }],
  ])('400s a forja payload carrying %s, before any DB read or write', async (_label, payload) => {
    const sb = makeSupabase([])
    await expect(submitIntelRecommendations(ctxOf(sb), payload)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(sb.tables).toHaveLength(0)
  })

  it('400s before the task lookup even when the task_id does not exist — never 404', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), {
      task_id: '44444444-4444-4444-8444-444444444444',
      coaching: { summary: 'ok', priorities: [] },
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(sb.tables).not.toContain('youtube_intelligence_tasks')
  })

  it('strips unknown keys from a recommendation before writing (write key)', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: [{ id: '33333333-3333-4333-8333-333333333333' }], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: { id: 't' }, error: null },
    ])
    await submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'], keyId: 'key-cowork' }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r', smuggled: 'x' }],
    })
    const written = sb.calls.filter(c => c.op === 'insert').map(c => JSON.stringify(c.args[0])).join('')
    expect(written).not.toContain('smuggled')

    const videoInsert = sb.calls.find(c => c.op === 'insert')!.args[0] as Record<string, unknown>
    expect(videoInsert.source).toBe('cowork')
    // Same dedup-lookup guard as the channel row (see the forja test above), asserted here on
    // the video branch. Note: today this can only ever be proven with 'cowork' — the forja
    // scope guard rejects any payload carrying video_recommendations before this line is ever
    // reached, so a narrow key can never exercise this specific `.eq('source', ...)` call. The
    // assertion still documents that the filter is the derived `source`, not a hardcoded value.
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['source', 'cowork'] })
  })

  it('never notifies on a forja PATCH', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: 'x' }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)
    expect(fanOutToSiteAdmins).not.toHaveBeenCalled()
  })
})

describe('submitIntelRecommendations — task state and ownership', () => {
  beforeEach(() => vi.clearAllMocks())

  it('409s TASK_NOT_RUNNING on a stale task, without writing', async () => {
    const sb = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'stale', result_summary: {}, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
    expect(sb.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('409s a narrow key on a task claimed by another key, and when keyId is missing', async () => {
    const other = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-other' }, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(other), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(other.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)

    const noKey = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: { claimed_by: 'key-forja' }, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(noKey, { keyId: undefined }), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING' })
    expect(noKey.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('409s a narrow key with a missing keyId even on a legacy row that was never claimed', async () => {
    // `claimed_by` is ABSENT (not merely mismatched) here — this is the one case where
    // `!ctx.keyId ||` actually matters: `previousSummary.claimed_by !== ctx.keyId` alone
    // would read `undefined !== undefined` as false and let the request through.
    const sb = makeSupabase([{ data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb, { keyId: undefined }), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
    expect(sb.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('500s — not 404 — when the task SELECT errors, without writing', async () => {
    const sb = makeSupabase([{ data: null, error: { message: 'boom' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    expect(sb.calls.some(c => c.op === 'insert' || c.op === 'update')).toBe(false)
  })

  it('404s on zero rows without an error', async () => {
    const sb = makeSupabase([{ data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('500s when the integrity SELECT errors (Cowork path only)', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: null, error: { message: 'boom' } },
    ])
    await expect(submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('keeps the integrity failure as 422 VALIDATION_ERROR', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: [], error: null },
    ])
    await expect(submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 422 })
  })

  it('scopes the integrity SELECT to the caller site, not just to the channel', async () => {
    const sb = makeSupabase([
      { data: { id: 't', channel_id: 'ch-1', status: 'running', result_summary: {}, started_at: 's' }, error: null },
      { data: [], error: null },
    ])
    await expect(submitIntelRecommendations(ctxOf(sb, { permissions: ['read', 'write'] }), {
      task_id: '22222222-2222-4222-8222-222222222222',
      video_recommendations: [{ video_id: '33333333-3333-4333-8333-333333333333', action_type: 'title_test', priority: 'low', confidence: 0.5, reasoning: 'r' }],
    })).rejects.toMatchObject({ status: 422 })

    expect(sb.tables).toContain('youtube_videos')
    // Isolate just the integrity query: the chain double shares one `calls` array, and the
    // task read right before it also filters `site_id`, so a bare toContainEqual would pass
    // even with the filter dropped. Slice from that query's own `.select()` to its `.in()`.
    const inIdx = sb.calls.findIndex((c) => c.op === 'in')
    expect(inIdx).toBeGreaterThan(-1)
    const selIdx = sb.calls.slice(0, inIdx).map((c) => c.op).lastIndexOf('select')
    const integrity = sb.calls.slice(selIdx, inIdx + 1)
    expect(integrity).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(integrity).toContainEqual({ op: 'eq', args: ['channel_id', 'ch-1'] })
  })
})

describe('submitIntelRecommendations — closing the task', () => {
  beforeEach(() => vi.clearAllMocks())

  it('closes with a CAS pinned to status, site, started_at and owner, preserving claimed_by', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: { id: TASK_ID }, error: null }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)
    // The channel path only ever INSERTs (it accumulates history), so the first — and only —
    // 'update' op in the whole call is the closing CAS itself.
    const cas = sb.from('update')
    const close = cas[0]!.args[0] as Record<string, unknown>
    expect(close).toMatchObject({ status: 'completed' })
    expect(close.result_summary).toMatchObject({ claimed_by: 'key-forja', has_coaching: true, recommendations: 0, source: 'forja', closed_by: 'key-forja' })
    expect(cas).toContainEqual({ op: 'eq', args: ['id', TASK_ID] })
    expect(cas).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['status', 'running'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['started_at', '2026-09-19T10:00:00Z'] })
    expect(cas).toContainEqual({ op: 'eq', args: ['result_summary->>claimed_by', 'key-forja'] })
  })

  it('409s when the closing CAS returns no row', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: null }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'TASK_NOT_RUNNING', status: 409 })
  })

  it('500s INTERNAL_ERROR when the closing UPDATE itself errors', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: null }, { data: null, error: { message: 'boom' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('500s PARTIAL_FAILURE listing only targets, and leaves the task untouched', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: { message: 'disk on fire' } }])
    await expect(submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY)).rejects.toMatchObject({
      code: 'PARTIAL_FAILURE', status: 500, message: 'channel: write_failed',
    })
    // nothing was written to the task table: no completed_at, no failed_at, no error_message
    expect(sb.calls.filter(c => c.op === 'update')).toHaveLength(0)
  })

  it('never writes the status partial_failure — the DB CHECK forbids it', async () => {
    const sb = makeSupabase([runningTask, { data: null, error: { message: 'x' } }])
    await submitIntelRecommendations(ctxOf(sb), CHANNEL_ONLY).catch(() => {})
    expect(JSON.stringify(sb.calls)).not.toContain('partial_failure')
  })
})

/**
 * Snapshot double: `from(table)` hands back a per-table chain so the five parallel reads
 * and the two analytics reads can be told apart. `results` is keyed by table, in call order.
 */
function makeSnapshotSupabase(results: Record<string, Array<{ data: unknown; error: unknown }>>) {
  const calls: Array<{ table: string; op: string; args: unknown[] }> = []
  const counters: Record<string, number> = {}
  const client = {
    from: (table: string) => {
      const next = () => {
        counters[table] = (counters[table] ?? 0) + 1
        return results[table]?.[counters[table] - 1] ?? { data: [], error: null }
      }
      const chain: Record<string, unknown> = {}
      for (const op of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not', 'is']) {
        chain[op] = (...args: unknown[]) => { calls.push({ table, op, args }); return chain }
      }
      chain.single = async () => next()
      chain.maybeSingle = async () => next()
      // the five parallel reads are awaited directly, without a terminal method
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(next()).then(resolve)
      return chain
    },
  }
  return { calls, client, argsOf: (table: string, op: string) => calls.filter(c => c.table === table && c.op === op).map(c => c.args) }
}

const NOW = Date.UTC(2026, 8, 19, 15, 0, 0) // 2026-09-19T15:00:00Z
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const V2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'

function snapshotResults(over: Partial<Record<string, Array<{ data: unknown; error: unknown }>>> = {}) {
  return {
    youtube_channels: [{ data: { id: 'ch-1', channel_id: 'UC…', name: 'tnFigueiredo', subscriber_count: 1160 }, error: null }],
    youtube_videos: [{ data: [
      { id: V1, youtube_video_id: 'yt1', title: 'a', thumbnail_url: null, published_at: '2024-12-10T15:57:00Z', view_count: 100, ctr: null, impressions: null, avg_view_percentage: null, avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: false },
      { id: V2, youtube_video_id: 'yt2', title: 'b', thumbnail_url: null, published_at: '2024-11-10T15:57:00Z', view_count: 50, ctr: null, impressions: null, avg_view_percentage: null, avg_view_duration_seconds: null, retention_curve: null, traffic_sources: null, is_hidden: true },
    ], error: null }],
    video_grade_history: [{ data: [], error: null }],
    optimization_cycles: [{ data: [], error: null }],
    ab_tests: [{ data: [], error: null }],
    youtube_intelligence: [{ data: [], error: null }],
    ...over,
  } as Record<string, Array<{ data: unknown; error: unknown }>>
}

describe('getIntelligenceSnapshot — recent window', () => {
  beforeEach(() => { vi.useFakeTimers({ now: NOW, toFake: ['Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  it('reads the latest analytics date within 3 days, scoped by site and by the channel video ids', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [
        { data: { date: '2026-09-18' }, error: null },
        { data: [{ youtube_video_id: V1, views: 6, subscribers_gained: 0 }], error: null },
      ],
    }))
    await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    // Two independent reads share this table: the date probe and the per-video read. A bare
    // `.toContainEqual` over the merged list would let `site_id` (or any other clause) drop
    // from EITHER read while the other keeps it — mutating each `.eq('site_id', …)` away
    // individually proved this: the un-sliced assertion still went green. Slice by the two
    // `select` calls so each read is checked on its own.
    const analytics = sb.calls.filter(c => c.table === 'youtube_video_analytics')
    const selectIdxs = analytics.reduce<number[]>((acc, c, i) => (c.op === 'select' ? [...acc, i] : acc), [])
    expect(selectIdxs).toHaveLength(2)
    const probe = analytics.slice(selectIdxs[0], selectIdxs[1])
    const perVideo = analytics.slice(selectIdxs[1])

    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'select', args: ['date'] })
    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'eq', args: ['site_id', 'site-1'] })
    // the internal uuid of youtube_videos, never the textual youtube_video_id
    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'in', args: ['youtube_video_id', [V1, V2]] })
    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'gte', args: ['date', '2026-09-16'] })
    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'order', args: ['date', { ascending: false }] })
    expect(probe).toContainEqual({ table: 'youtube_video_analytics', op: 'limit', args: [1] })

    expect(perVideo).toContainEqual({ table: 'youtube_video_analytics', op: 'select', args: ['youtube_video_id, views, subscribers_gained'] })
    expect(perVideo).toContainEqual({ table: 'youtube_video_analytics', op: 'eq', args: ['site_id', 'site-1'] })
    expect(perVideo).toContainEqual({ table: 'youtube_video_analytics', op: 'in', args: ['youtube_video_id', [V1, V2]] })
    expect(perVideo).toContainEqual({ table: 'youtube_video_analytics', op: 'eq', args: ['date', '2026-09-18'] })
  })

  it('fills recent from the row of that single date, without summing, and zeroes missing videos', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [
        { data: { date: '2026-09-18' }, error: null },
        { data: [{ youtube_video_id: V1, views: 6, subscribers_gained: 0 }], error: null },
      ],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toEqual({ date: '2026-09-18', days: 90 })
    expect(data.videos.find(v => v.id === V1)!.recent).toEqual({ views: 6, subscribers_gained: 0 })
    expect(data.videos.find(v => v.id === V2)!.recent).toEqual({ views: 0, subscribers_gained: 0 })
  })

  it('returns recent_window as a whole null — never {date: null} — when no row is within 3 days', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toBeNull()
    expect(data.videos.every(v => v.recent.views === 0 && v.recent.subscribers_gained === 0)).toBe(true)
    // only the date probe ran; the per-video read never did
    expect(sb.calls.filter(c => c.table === 'youtube_video_analytics' && c.op === 'select')).toHaveLength(1)
  })

  it('makes zero calls to youtube_video_analytics when the channel has no videos (the EN channel)', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({ youtube_videos: [{ data: [], error: null }] }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.recent_window).toBeNull()
    expect(sb.calls.some(c => c.table === 'youtube_video_analytics')).toBe(false)
  })

  it('exposes videos[].is_hidden and scopes the video SELECT by site_id too', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    const { data } = await getIntelligenceSnapshot(ctxOf(sb), 'ch-1')

    expect(data.videos.map(v => v.is_hidden)).toEqual([false, true])
    expect(sb.argsOf('youtube_videos', 'eq')).toContainEqual(['site_id', 'site-1'])
    expect(sb.argsOf('youtube_videos', 'eq')).toContainEqual(['channel_id', 'ch-1'])
  })

  it.each([
    ['narrow key', { permissions: ['read', 'intelligence'] as const }],
    ['write key', { permissions: ['read', 'write'] as const }],
    ['session', { source: 'session' as const, permissions: ['read', 'write'] as const }],
  ])('filters the intelligence array to source=cowork for a %s', async (_label, over) => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: null }],
    }))
    await getIntelligenceSnapshot(ctxOf(sb, over as never), 'ch-1')

    expect(sb.argsOf('youtube_intelligence', 'eq')).toContainEqual(['source', 'cowork'])
    expect(sb.argsOf('youtube_intelligence', 'eq')).toContainEqual(['site_id', 'site-1'])
    // The 50-row cap is only safe paired with a NEWEST-first order: flip the order (or shrink
    // the limit) and past 50 rows the /cms pins the OLDEST coaching forever, silently.
    expect(sb.argsOf('youtube_intelligence', 'order')).toContainEqual(['generated_at', { ascending: false }])
    expect(sb.argsOf('youtube_intelligence', 'limit')).toContainEqual([50])
  })

  // A DB error on either of these two reads must surface as a 500, never as a quiet
  // "no recent activity" snapshot — see the comment above the checks in youtube.ts.
  it('throws INTERNAL_ERROR 500 when the date-probe read fails', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [{ data: null, error: { message: 'statement timeout' } }],
    }))

    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
    // the per-video read must never run off a failed probe
    expect(sb.calls.filter(c => c.table === 'youtube_video_analytics' && c.op === 'select')).toHaveLength(1)
  })

  it('throws INTERNAL_ERROR 500 when the per-video read fails', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_video_analytics: [
        { data: { date: '2026-09-18' }, error: null },
        { data: null, error: { message: 'statement timeout' } },
      ],
    }))

    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  // Same invariant for the channel read and the five parallel reads: each one owes a 500
  // on a DB error, never a 200 with an empty/missing section. One test per read.
  it('throws INTERNAL_ERROR 500 when the channel read fails — never a 404', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_channels: [{ data: null, error: { message: 'statement timeout' } }],
    }))

    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500 })
  })

  it('still answers NOT_FOUND 404 when the channel read reports zero rows (PGRST116)', async () => {
    const sb = makeSnapshotSupabase(snapshotResults({
      youtube_channels: [{ data: null, error: { code: 'PGRST116', message: 'no rows' } }],
    }))

    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-1')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it.each([
    ['youtube_videos', 'Failed to read the channel videos'],
    ['video_grade_history', 'Failed to read the grade history'],
    ['optimization_cycles', 'Failed to read the optimization cycles'],
    ['ab_tests', 'Failed to read the A/B tests'],
    ['youtube_intelligence', 'Failed to read the intelligence rows'],
  ])('throws INTERNAL_ERROR 500 when the %s read fails', async (table, message) => {
    const sb = makeSnapshotSupabase(snapshotResults({
      [table]: [{ data: null, error: { message: 'statement timeout' } }],
      youtube_video_analytics: [{ data: null, error: null }],
    }))

    // the message pins WHICH read raised it: one shared check covering all five would pass
    // this test while four of the reads stayed unguarded.
    await expect(getIntelligenceSnapshot(ctxOf(sb), 'ch-1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 500, message })
  })
})
