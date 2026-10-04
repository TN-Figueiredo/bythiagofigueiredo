// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { currentSlotStart, isDue, batchHealth } from '@/lib/youtube/competitor-sync-batch'

const sp = (iso: string) => Date.parse(iso + '-03:00')
describe('6 h slots in São Paulo', () => {
  it('slot start is the last 00/06/12/18 SP', () => {
    expect(currentSlotStart(sp('2026-10-24T15:02:00'))).toBe(sp('2026-10-24T12:00:00'))
    expect(currentSlotStart(sp('2026-10-24T00:00:00'))).toBe(sp('2026-10-24T00:00:00'))
    expect(currentSlotStart(sp('2026-10-24T05:59:59'))).toBe(sp('2026-10-24T00:00:00'))
  })
  it('due when never synced or synced before the slot', () => {
    const now = sp('2026-10-24T15:02:00')
    expect(isDue(null, now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T11:59:00')).toISOString(), now)).toBe(true)
    expect(isDue(new Date(sp('2026-10-24T12:01:00')).toISOString(), now)).toBe(false)
  })
})
describe('runCompetitorBatch', () => {
  it('syncs at most batchSize channels, oldest first, and reports what is still due', async () => {
    vi.resetModules()
    const synced: string[] = []
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { synced.push(r.id); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: '2026-10-24T13:00:00.000Z' }, { id: 'c', channel_id: 'C', site_id: 's', last_synced_at: '2026-10-24T14:00:00.000Z' }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 2, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect(synced).toEqual(['a', 'b'])
    expect(r).toMatchObject({ synced: 2, errors: 0, remainingDue: 1, stoppedForTime: false })
  })
  it('one failing channel does not stop the batch', async () => {
    vi.resetModules()
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { if (r.id === 'a') throw new Error('404'); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    expect(await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })).toMatchObject({ synced: 1, errors: 1 })
  })
})

describe('batchHealth', () => {
  const base = { synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false }
  it('fails when at least half of the attempted channels errored', () => {
    expect(batchHealth({ ...base, synced: 1, errors: 14 })).toEqual({ ok: false, message: '14 of 15 channels failed' })
  })
  it('is ok with a single error among many', () => {
    expect(batchHealth({ ...base, synced: 14, errors: 1 }).ok).toBe(true)
  })
  it('is ok when nothing was attempted', () => {
    expect(batchHealth(base).ok).toBe(true)
  })
})
describe('error channels never starve the cursor', () => {
  it('syncs healthy channels ahead of erroring ones', async () => {
    vi.resetModules()
    const synced: string[] = []
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => { synced.push(r.id); return {} }) }))
    const e = (id: string) => ({ id, channel_id: id, site_id: 's', last_synced_at: null, sync_status: 'error' })
    const ok = (id: string) => ({ id, channel_id: id, site_id: 's', last_synced_at: '2026-10-24T01:00:00.000Z', sync_status: 'idle' })
    const rows = [e('e1'), e('e2'), e('e3'), ok('h1'), ok('h2')]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await runCompetitorBatch({ apiKey: 'k', batchSize: 2, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect(synced).toEqual(['h1', 'h2'])
  })
})

describe('runCompetitorBatch — teto de sondas de Short', () => {
  it('um só orçamento de 60 sondas é compartilhado por todos os canais do lote', async () => {
    vi.resetModules()
    const budgets: unknown[] = []
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (_r: unknown, _k: string, o: { probeBudget: unknown }) => { budgets.push(o.probeBudget); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect(budgets).toHaveLength(2)
    expect(budgets[0]).toBe(budgets[1])
    expect(budgets[0]).toMatchObject({ remaining: 60 })
  })
})

describe('runCompetitorBatch — visibilidade da sonda (R114)', () => {
  const chain = (rows: unknown[]): unknown => {
    const p: unknown = new Proxy({}, { get: (_t, prop: string) => prop === 'then'
      ? (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, count: rows.length, error: null }).then(ok)
      : () => p })
    return p
  }
  async function run(spend: (stats: { attempted: number; shorts: number; regular: number; inconclusive: number }) => void) {
    vi.resetModules()
    const captureMessage = vi.fn()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (_r: unknown, _k: string, o: { probeBudget: { stats: { attempted: number; shorts: number; regular: number; inconclusive: number } } }) => { spend(o.probeBudget.stats); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => 0) }))
    void chain
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    return { r, captureMessage }
  }
  it('expõe shorts_probe no resultado', async () => {
    const { r, captureMessage } = await run(s => { s.attempted = 12; s.shorts = 9; s.regular = 1; s.inconclusive = 2 })
    expect(r.shorts_probe).toMatchObject({ attempted: 12, shorts: 9, regular: 1, inconclusive: 2, backfilled: 0, pending: 0 })
    expect(captureMessage).not.toHaveBeenCalled()
  })
  it('≥ 10 sondas e nenhuma conclusiva: um aviso Sentry, sem ids, e o lote não vira falha', async () => {
    const { r, captureMessage } = await run(s => { s.attempted = 10; s.inconclusive = 10 })
    expect(captureMessage).toHaveBeenCalledTimes(1)
    expect(captureMessage.mock.calls[0]![0]).toMatch(/bloqueada/)
    expect(captureMessage.mock.calls[0]![1]).toMatchObject({ level: 'warning' })
    expect(r).toMatchObject({ synced: 1, errors: 0 })
  })
  it('menos de 10 sondas inconclusivas não alarma', async () => {
    const { captureMessage } = await run(s => { s.attempted = 9; s.inconclusive = 9 })
    expect(captureMessage).not.toHaveBeenCalled()
  })
})

describe('runCompetitorBatch — controle e prazo do backfill (I-2, I-3)', () => {
  async function run(opts: { controlId?: string; controlResponse?: () => Response; clock?: () => number }) {
    vi.resetModules()
    const captureMessage = vi.fn()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
    let seenFailed: boolean | undefined
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (_r: unknown, _k: string, o: { probeBudget: { controlFailed?: boolean } }) => { seenFailed = o.probeBudget.controlFailed; return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0 } }) }))
    const channels = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }]
    const chainRes = { data: opts.controlId ? [{ video_id: opts.controlId }] : [], error: null }
    const chain: unknown = new Proxy({}, { get: (_t, p: string) => p === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(chainRes).then(ok) : () => chain })
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => t === 'competitor_channels' ? { select: () => ({ order: () => Promise.resolve({ data: channels, error: null }) }) } : chain }) }))
    const backfill = vi.fn(async () => 0)
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: backfill }))
    const fetchMock = vi.fn(async () => opts.controlResponse ? opts.controlResponse() : new Response('', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: opts.clock ?? (() => sp('2026-10-24T15:02:00')) })
    vi.unstubAllGlobals()
    return { r, captureMessage, seenFailed, fetchMock, backfill }
  }
  const redirectWatch = () => ({ status: 303, headers: new Headers({ location: '/watch?v=x' }), body: null }) as unknown as Response

  it('controle volta normal: ok, sondas valem', async () => {
    const { r, seenFailed, captureMessage } = await run({ controlId: 'AAAAAAAAAA1', controlResponse: redirectWatch })
    expect(r.shorts_probe?.control).toBe('ok'); expect(seenFailed).toBeFalsy(); expect(captureMessage).not.toHaveBeenCalled()
  })
  it('controle não volta normal (200 com interstício): failed, sondas descartadas e aviso', async () => {
    const { r, seenFailed, captureMessage } = await run({ controlId: 'AAAAAAAAAA1' })
    expect(r.shorts_probe?.control).toBe('failed'); expect(seenFailed).toBe(true)
    expect(captureMessage).toHaveBeenCalledTimes(1); expect(captureMessage.mock.calls[0]![0]).toMatch(/controle/)
    expect(r).toMatchObject({ synced: 1, errors: 0 })
  })
  it('sem vídeo longo conhecido: none, segue como hoje, sem requisição de controle', async () => {
    const { r, fetchMock, seenFailed } = await run({})
    expect(r.shorts_probe?.control).toBe('none'); expect(fetchMock).not.toHaveBeenCalled(); expect(seenFailed).toBeFalsy()
  })
  it('I-3: passa o prazo de 230 s ao backfill (relógio falso)', async () => {
    let t = sp('2026-10-24T15:02:00')
    const { backfill } = await run({ clock: () => t })
    const stop = backfill.mock.calls[0]![5] as () => boolean
    expect(stop()).toBe(false)
    t += 231_000
    expect(stop()).toBe(true)
  })
})
