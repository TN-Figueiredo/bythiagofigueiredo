// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { claimNextTask } from '@/lib/pipeline/services/youtube'
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
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['status', 'pending'] })
    const update = sb.calls.find(c => c.op === 'update')!
    expect(update.args[0]).toMatchObject({ status: 'running', result_summary: { claimed_by: 'key-forja' } })
    // the CAS carries site_id, and the returned row comes from a closed column list
    expect(sb.calls).toContainEqual({ op: 'eq', args: ['site_id', 'site-1'] })
    expect(sb.calls.some(c => c.op === 'select' && c.args[0] === '*')).toBe(false)
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
