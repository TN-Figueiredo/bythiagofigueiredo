import { describe, it, expect, vi, beforeEach } from 'vitest'

/* A permissive chain: every filter records itself and returns the chain; the terminal calls
 * (`limit`, `maybeSingle`, `single`, `insert`) resolve with what the test queued for that
 * table. Records let the tests assert the scoping (site, channel, allowlist). */

interface Result { data: unknown; error: { message: string } | null }
const results = new Map<string, Result[]>()
const calls: Array<{ table: string; ops: Array<[string, ...unknown[]]> }> = []

function queue(table: string, ...r: Result[]) { results.set(table, [...(results.get(table) ?? []), ...r]) }
function next(table: string): Result { return results.get(table)?.shift() ?? { data: null, error: null } }

function chainFor(table: string) {
  const rec = { table, ops: [] as Array<[string, ...unknown[]]> }
  calls.push(rec)
  const chain: Record<string, unknown> = {}
  for (const op of ['select', 'eq', 'is', 'in', 'not', 'order']) {
    chain[op] = vi.fn((...args: unknown[]) => { rec.ops.push([op, ...args]); return chain })
  }
  chain.limit = vi.fn((n: number) => {
    rec.ops.push(['limit', n])
    const c = { ...chain, then: (res: (v: Result) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(next(table)).then(res, rej) }
    return c
  })
  chain.maybeSingle = vi.fn(() => Promise.resolve(next(table)))
  chain.single = vi.fn(() => Promise.resolve(next(table)))
  chain.insert = vi.fn((row: unknown) => { rec.ops.push(['insert', row]); return Promise.resolve(next(`${table}:insert`)) })
  return chain
}

const mockSupabase = { from: vi.fn((table: string) => chainFor(table)) }

vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1' }) }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => mockSupabase }))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import {
  fetchLatestAnalysisTask,
  fetchAnalysisHistory,
  requestIntelligenceAnalysis,
} from '@/app/cms/(authed)/youtube/analytics/actions'

const CH = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  results.clear()
  calls.length = 0
})

describe('fetchLatestAnalysisTask', () => {
  it('maps the newest task of THIS site and channel, and never selects result_summary', async () => {
    queue('youtube_intelligence_tasks', {
      data: {
        id: 't1', status: 'running', requested_at: '2026-09-23T10:34:12Z', started_at: '2026-09-23T10:40:03Z',
        completed_at: null, failed_at: null, updated_at: '2026-09-23T10:40:03Z', retry_count: 0, error_message: null,
      },
      error: null,
    })
    const t = await fetchLatestAnalysisTask(CH)
    expect(t).toEqual({
      id: 't1', status: 'running', requestedAt: '2026-09-23T10:34:12Z', startedAt: '2026-09-23T10:40:03Z',
      completedAt: null, failedAt: null, updatedAt: '2026-09-23T10:40:03Z', retryCount: 0, errorMessage: null,
    })
    const ops = calls[0]!.ops
    expect(ops).toContainEqual(['eq', 'site_id', 'site-1'])
    expect(ops).toContainEqual(['eq', 'channel_id', CH])
    expect(ops).toContainEqual(['order', 'requested_at', { ascending: false }])
    const select = ops.find(o => o[0] === 'select')![1] as string
    expect(select).not.toContain('result_summary')
    expect(select).not.toBe('*')
  })

  it('null when the channel never had a task', async () => {
    queue('youtube_intelligence_tasks', { data: null, error: null })
    expect(await fetchLatestAnalysisTask(CH)).toBeNull()
  })

  it('an unknown status is not guessed into a known one', async () => {
    queue('youtube_intelligence_tasks', { data: { id: 't', status: 'paused', requested_at: 'x' }, error: null })
    expect(await fetchLatestAnalysisTask(CH)).toBeNull()
  })

  it('a DB error throws instead of reading as "no task"', async () => {
    queue('youtube_intelligence_tasks', { data: null, error: { message: 'timeout' } })
    await expect(fetchLatestAnalysisTask(CH)).rejects.toThrow(/timeout/)
  })

  it('rejects a non-UUID channel', async () => {
    await expect(fetchLatestAnalysisTask('nope')).rejects.toThrow('invalid_input')
  })
})

describe('fetchAnalysisHistory', () => {
  it('reads channel-level rows of the allowlisted sources only, newest first, capped', async () => {
    queue('youtube_intelligence', {
      data: [
        { id: 'a', source: 'forja', generated_at: '2026-09-23T10:30:16Z', coaching: { summary: 'x', priorities: [] }, patterns_detected: [] },
        { id: 'b', source: 'cowork', generated_at: '2026-05-18T13:34:10Z', coaching: { summary: 'y', priorities: [] }, patterns_detected: [] },
      ],
      error: null,
    })
    const h = await fetchAnalysisHistory(CH)
    expect(h.map(e => e.id)).toEqual(['a', 'b'])
    const ops = calls[0]!.ops
    expect(ops).toContainEqual(['eq', 'site_id', 'site-1'])
    expect(ops).toContainEqual(['eq', 'channel_id', CH])
    expect(ops).toContainEqual(['is', 'video_id', null])
    expect(ops).toContainEqual(['in', 'source', ['cowork', 'forja']])
    expect(ops).toContainEqual(['order', 'generated_at', { ascending: false }])
    expect(ops).toContainEqual(['limit', 10])
  })

  it('a malformed row is dropped, the rest survives', async () => {
    queue('youtube_intelligence', {
      data: [
        { id: 'a', source: 'forja', generated_at: 'not-a-date', coaching: {}, patterns_detected: [] },
        { id: 'b', source: 'forja', generated_at: '2026-09-23T10:30:16Z', coaching: {}, patterns_detected: [] },
      ],
      error: null,
    })
    expect((await fetchAnalysisHistory(CH)).map(e => e.id)).toEqual(['b'])
  })

  it('a DB error throws', async () => {
    queue('youtube_intelligence', { data: null, error: { message: 'boom' } })
    await expect(fetchAnalysisHistory(CH)).rejects.toThrow(/boom/)
  })
})

describe('requestIntelligenceAnalysis', () => {
  function happyPrereqs() {
    queue('youtube_channels', { data: { id: CH }, error: null })
    queue('youtube_intelligence_tasks', { data: null, error: null }) // no active task
    queue('youtube_intelligence_tasks', { data: null, error: null }) // no recent manual
  }

  it('ok when the insert lands', async () => {
    happyPrereqs()
    queue('youtube_intelligence_tasks:insert', { data: null, error: null })
    expect(await requestIntelligenceAnalysis(CH)).toEqual({ ok: true })
  })

  it('a failed insert is reported, not answered with ok (the request that "just disappeared")', async () => {
    happyPrereqs()
    queue('youtube_intelligence_tasks:insert', { data: null, error: { message: 'rls' } })
    expect(await requestIntelligenceAnalysis(CH)).toEqual({ error: 'insert_failed' })
  })
})
