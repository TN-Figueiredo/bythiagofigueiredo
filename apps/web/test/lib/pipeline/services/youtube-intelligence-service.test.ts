// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimNextTask, failTask } from '@/lib/pipeline/services/youtube'
import type { ServiceContext } from '@/lib/pipeline/services/types'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

type Call = { op: string; args: unknown[] }

/** Chainable PostgREST double: records every call, replays queued terminal results. */
function makeSupabase(results: Array<{ data: unknown; error: unknown }>) {
  const calls: Call[] = []
  const tables: string[] = []
  let i = 0
  const chain: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'in', 'order', 'limit', 'update', 'is', 'not', 'gte']) {
    chain[op] = vi.fn((...args: unknown[]) => { calls.push({ op, args }); return chain })
  }
  chain.maybeSingle = vi.fn(async () => results[i++] ?? { data: null, error: null })
  chain.single = vi.fn(async () => results[i++] ?? { data: null, error: null })
  chain.then = undefined
  return {
    calls,
    tables,
    client: { from: vi.fn((t: string) => { tables.push(t); return chain }) },
    /**
     * Slice of `calls` starting at the nth (1-indexed) occurrence of `op` — use this,
     * never a bare `expect(calls).toContainEqual(...)`, for a CAS/UPDATE clause. The
     * double shares one `calls` array and one chain object across every query the
     * service makes in a test, so a SELECT that happens to touch the same column
     * (e.g. `site_id`) can silently satisfy an assertion meant for the UPDATE, and a
     * dropped filter on the real CAS would never fail the test.
     */
    from(op: string, nth = 1): Call[] {
      let seen = 0
      const idx = calls.findIndex((c) => c.op === op && ++seen === nth)
      return idx === -1 ? [] : calls.slice(idx)
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

    // The double shares one `calls` array and one chain object across the SELECT and
    // the UPDATE, so an assertion against `sb.calls` as a whole is satisfied by either
    // call — it would stay green even if the UPDATE's own `.eq(...)` were deleted. Slice
    // from the `update` call onward so these assertions can only be satisfied by clauses
    // chained AFTER `.update(...)`, i.e. by the CAS itself.
    const updateIdx = sb.calls.findIndex(c => c.op === 'update')
    expect(updateIdx).toBeGreaterThanOrEqual(0)
    const casCalls = sb.calls.slice(updateIdx)

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
