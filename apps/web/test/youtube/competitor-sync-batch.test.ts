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
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncStatsOf: () => undefined, syncCompetitorChannel: vi.fn(async (r: { id: string }) => { if (r.id === 'a') throw new Error('404'); return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 } }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    expect(await runCompetitorBatch({ apiKey: 'k', batchSize: 5, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })).toMatchObject({ synced: 1, errors: 1 })
  })
  it('siteIds: os sites com canal sincronizado ou com erro; canal pulado não conta; nada tentado → vazio', async () => {
    vi.resetModules()
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncStatsOf: () => undefined, syncCompetitorChannel: vi.fn(async (r: { id: string }) => {
      if (r.id === 'b') throw new Error('404')
      if (r.id === 'c') return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0, skipped: true }
      return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 3 }
    }) }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's1', last_synced_at: null }, { id: 'a2', channel_id: 'A2', site_id: 's1', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's2', last_synced_at: null }, { id: 'c', channel_id: 'C', site_id: 's3', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 10, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })
    expect([...r.siteIds].sort()).toEqual(['s1', 's2'])
    vi.resetModules()
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }))
    const again = await import('@/lib/youtube/competitor-sync-batch')
    expect((await again.runCompetitorBatch({ apiKey: 'k', batchSize: 10, budgetMs: 1e9, now: () => sp('2026-10-24T15:02:00') })).siteIds).toEqual([])
  })
})

describe('batchHealth', () => {
  const base = { synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false, siteIds: [] as string[] }
  it('fails when at least half of the attempted channels errored', () => {
    expect(batchHealth({ ...base, synced: 1, errors: 14 })).toEqual({ ok: false, message: '14 de 15 canais falharam' })
  })
  it('item 9: a mensagem é em português, no singular e no plural', () => {
    expect(batchHealth({ ...base, synced: 2, errors: 3 }).message).toBe('3 de 5 canais falharam')
    expect(batchHealth({ ...base, synced: 1, errors: 1 }).message).toBe('1 de 2 canais falhou')
    expect(batchHealth({ ...base, synced: 0, errors: 1 }).message).toBe('1 de 1 canal falhou')
  })
  it('is ok with a single error among many', () => {
    expect(batchHealth({ ...base, synced: 14, errors: 1 }).ok).toBe(true)
  })
  it('is ok when nothing was attempted', () => {
    expect(batchHealth(base).ok).toBe(true)
  })

  // ── (portão final, dados I-2) canal em erro há mais de 3 dias não deixa o resumo do lote vermelho; metade ou mais deles, sim ──
  const known = (synced: number, errors: number, errorsKnown: number, channelsLongError: number, channelsActive = 15) =>
    batchHealth({ ...base, synced, errors, errorsKnown, channelsLongError, channelsActive })
  it('1 sadio + 1 canal em erro permanente (a entrada medida às 18:20): verde', () => {
    expect(known(1, 1, 1, 1, 15)).toEqual({ ok: true })
    expect(known(1, 1, 1, 1, 2)).toMatchObject({ ok: false, message: '1 de 2 canais em erro há mais de 3 dias' }) // 1 de 2 já é metade: pane
  })
  it('fronteiras da metade dos canais ativos: 1 de 15 e 7 de 15 verdes; 8 de 15 e 15 de 15 vermelhos', () => {
    expect(known(14, 1, 1, 1)).toEqual({ ok: true })
    expect(known(8, 7, 7, 7)).toEqual({ ok: true })
    expect(known(7, 8, 8, 8)).toEqual({ ok: false, message: '8 de 15 canais em erro há mais de 3 dias' })
    expect(known(0, 15, 15, 15)).toEqual({ ok: false, message: '15 de 15 canais em erro há mais de 3 dias' })
    expect(known(1, 1, 1, 1, 1)).toEqual({ ok: false, message: '1 de 1 canal em erro há mais de 3 dias' })
  })
  it('a metade conta os canais em erro no BANCO (channelsLongError), tenham sido tentados neste disparo ou não', () => {
    expect(known(0, 0, 0, 8)).toMatchObject({ ok: false })
    expect(known(0, 0, 0, 7)).toEqual({ ok: true })
  })
  it('erro NOVO (canal sem 3 dias de erro) segue a regra de hoje, e o erro conhecido sai da conta e do denominador', () => {
    expect(known(1, 2, 1, 1)).toEqual({ ok: false, message: '1 de 2 canais falhou' }) // 1 novo, 1 sadio
    expect(known(5, 2, 1, 1)).toEqual({ ok: true })                                    // 1 novo entre 5 sadios
    expect(known(1, 3, 1, 1)).toEqual({ ok: false, message: '2 de 3 canais falharam' })
  })
  it('sem os campos novos (chamada antiga) vale a regra de antes', () => {
    expect(batchHealth({ ...base, synced: 1, errors: 1 })).toMatchObject({ ok: false })
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
  async function run(opts: { controlIds?: string[]; controlId?: string; controlResponse?: () => Response; clock?: () => number }) {
    vi.resetModules()
    const captureMessage = vi.fn()
    vi.doMock('@sentry/nextjs', () => ({ captureMessage, captureException: vi.fn() }))
    let seenFailed: boolean | undefined
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (_r: unknown, _k: string, o: { probeBudget: { controlFailed?: boolean } }) => { seenFailed = o.probeBudget.controlFailed; return { videosChecked: 0, changesDetected: 0, dailyRecorded: 0, unitsUsed: 0 } }) }))
    const channels = [{ id: 'a', channel_id: 'A', site_id: 's', last_synced_at: null }]
    const chainRes = { data: (opts.controlIds ?? (opts.controlId ? [opts.controlId] : [])).map(video_id => ({ video_id })), error: null }
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
  it('P2: o primeiro longo removido (404) não desliga; o segundo volta normal: ok', async () => {
    let n = 0
    const { r, seenFailed } = await run({ controlIds: ['AAAAAAAAAA1', 'AAAAAAAAAA2'], controlResponse: () => (n++ === 0 ? ({ status: 404, headers: new Headers(), body: null } as unknown as Response) : redirectWatch()) })
    expect(r.shorts_probe?.control).toBe('ok'); expect(seenFailed).toBeFalsy()
  })
  it('P2: nenhum dos dois volta normal: failed', async () => {
    const { r, seenFailed } = await run({ controlIds: ['AAAAAAAAAA1', 'AAAAAAAAAA2'] })
    expect(r.shorts_probe?.control).toBe('failed'); expect(seenFailed).toBe(true)
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

// ───────────────────────── Tarefa 13 (A5 E1 e E2): o lote, a fase semanal, os tetos ─────────────────────────
describe('A5: tetos de tempo do disparo (a conta presa)', () => {
  it('a ordem dos tetos: começar canal < fase semanal < backfill de Shorts < duração máxima da função, com folga para o último canal', async () => {
    const { WEEKLY_DEADLINE_MS, WEEKLY_CHANNEL_BUDGET_MS, BATCH_BUDGET_MS, BACKFILL_DEADLINE_MS, COMPETITORS_MAX_DURATION_S } = await import('@/lib/youtube/competitor-sync-batch')
    expect(BATCH_BUDGET_MS).toBeLessThan(WEEKLY_DEADLINE_MS)
    expect(WEEKLY_DEADLINE_MS).toBeLessThan(BACKFILL_DEADLINE_MS)
    expect(WEEKLY_CHANNEL_BUDGET_MS).toBeLessThan(WEEKLY_DEADLINE_MS)
    // o último vídeo da fase começa no máximo aos 210 s; o pior caso de uma sonda com arquivo são 55 s de espera somados;
    // a prova usa o teto de 20 s (PROOF_TIMEOUT_MS, na rota): 210 + 55 + 20 = 285 s, e sobram 15 s para gravar o resumo
    expect(COMPETITORS_MAX_DURATION_S * 1000 - WEEKLY_DEADLINE_MS).toBeGreaterThanOrEqual(55_000 + 30_000)
    expect(WEEKLY_DEADLINE_MS + 55_000 + 20_000).toBeLessThan(COMPETITORS_MAX_DURATION_S * 1000)
    expect(BATCH_BUDGET_MS).toBeLessThan(BACKFILL_DEADLINE_MS)
    expect(BACKFILL_DEADLINE_MS).toBeLessThan(COMPETITORS_MAX_DURATION_S * 1000)
    // o último canal começa no máximo aos 200 s; o maior medido em produção leva 27 s (12/10/2026): cabem dois e sobra
    expect(COMPETITORS_MAX_DURATION_S * 1000 - BATCH_BUDGET_MS).toBeGreaterThanOrEqual(60_000 + 30_000)
  })
  it('I-4: a conta do pior caso é feita com constantes nomeadas: nenhuma operação longa começa sem caber no que resta menos a reserva do fim', async () => {
    const m = await import('@/lib/youtube/competitor-sync-batch')
    const LIMIT = m.COMPETITORS_MAX_DURATION_S * 1000
    expect(m.FINISH_RESERVE_MS).toBe(m.PROOF_TIMEOUT_MS + m.RECORD_RESERVE_MS)
    // o último canal começa aos BATCH_BUDGET_MS e pode levar CHANNEL_CALL_WORST_MS; a reserva do fim vem depois
    expect(m.BATCH_BUDGET_MS + m.CHANNEL_CALL_WORST_MS + m.FINISH_RESERVE_MS).toBeLessThanOrEqual(LIMIT)
    // a última chamada semanal começa aos WEEKLY_DEADLINE_MS e pode levar WEEKLY_CALL_WORST_MS (a sonda com arquivo)
    expect(m.WEEKLY_DEADLINE_MS + m.WEEKLY_CALL_WORST_MS + m.FINISH_RESERVE_MS).toBeLessThanOrEqual(LIMIT)
    expect(m.WEEKLY_CALL_WORST_MS).toBeGreaterThanOrEqual(55_000)
    expect(m.PROOF_TIMEOUT_MS).toBe(20_000)
  })
  it('a rota declara a mesma duração máxima e o mesmo orçamento do lote', async () => {
    const src = (await import('node:fs')).readFileSync('src/app/api/cron/sync-youtube/route.ts', 'utf8')
    expect(src).toMatch(/export const maxDuration = 300\b/)
    expect(src).toMatch(/budgetMs: BATCH_BUDGET_MS/)
  })
})

describe('A5: o lote passa o relógio à passada semanal e soma os contadores', () => {
  const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'c' + i, channel_id: 'UC' + i, site_id: i % 2 ? 's2' : 's1', last_synced_at: null, sync_status: 'idle' }))
  const mockAll = (sync: (r: { id: string }, key: string, o: Record<string, unknown>) => Promise<Record<string, unknown>>, rows: unknown[], extra: Record<string, unknown> = {}) => {
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(sync), syncCompetitorWeekly: vi.fn(), syncStatsOf: () => undefined, WeeklyVersionError: class extends Error {}, spDate: (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10), ...extra }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
  }
  it('a sincronização de um canal não recebe relógio de semanal nenhum (a leitura semanal não é dela)', async () => {
    const seen: string[][] = []
    mockAll(async (_r, _k, o) => { seen.push(Object.keys(o).sort()); return {} }, rowsOf(2))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => 0 })
    expect(seen).toEqual([['deferBackfill', 'probeBudget'], ['deferBackfill', 'probeBudget']])
  })
  it('totals soma o que cada canal devolveu; healthSiteIds traz todo site com canal, mesmo sem canal devido', async () => {
    mockAll(async () => ({ unitsUsed: 4, dailyRecorded: 50, fieldsOpened: 10, rawOpened: 2, missed: 1, quotaError: true }), [...rowsOf(2), { id: 'x', channel_id: 'UCx', site_id: 's3', last_synced_at: new Date(Date.UTC(2026, 9, 24, 15, 1)).toISOString(), sync_status: 'idle' }])
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r.totals).toMatchObject({ unitsUsed: 8, dailyRecorded: 100, weeklyRecorded: 0, weeklyDeferred: 0, fieldsOpened: 20, rawOpened: 4, missed: 2, quotaErrors: 2, earlyRecorded: 0 })
    expect(r.healthSiteIds.sort()).toEqual(['s1', 's2', 's3'])
  })
  it('D: todos os contadores do canal chegam ao resumo, inclusive os da cota, das partes e da captura', async () => {
    const all = { videosChecked: 9, changesDetected: 2, dailyRecorded: 5, unitsUsed: 3, partsMissing: 1, channelPartsMissing: 2, sanitized: 3, duplicates: 4, invalid: 5, captureSkipped: 6, fieldsOpened: 7, fieldsClosed: 8, rawOpened: 9, rawClosed: 10, rawTooBig: 11, missed: 12, newlyMissing: 13, returned: 14, earlyRecorded: 15, tierChanges: 16, cutByCap: 17, excludedNoCount: 18, promotionExtended: 19, quotaError: true, quotaUnitsLost: 3 }
    mockAll(async () => all, rowsOf(1))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r.totals).toMatchObject({ unitsUsed: 3, dailyRecorded: 5, partsMissing: 1, channelPartsMissing: 2, sanitized: 3, duplicates: 4, invalid: 5, captureSkipped: 6, fieldsOpened: 7, fieldsClosed: 8, rawOpened: 9, rawClosed: 10, rawTooBig: 11, missed: 12, newlyMissing: 13, returned: 14, earlyRecorded: 15, tierChanges: 16, cutByCap: 17, excludedNoCount: 18, promotionExtended: 19, quotaErrors: 1, quotaUnitsLost: 3 })
  })
  it('D: um canal que termina em erro também entrega os contadores que tinha (syncStatsOf), e o erro não some', async () => {
    const boom = new Error('404')
    mockAll(async r => { if (r.id === 'c0') throw boom; return { unitsUsed: 1, missed: 1 } }, rowsOf(2), { syncStatsOf: (e: unknown) => (e === boom ? { unitsUsed: 2, partsMissing: 3, sanitized: 1, missed: 4, newlyMissing: 1, quotaError: true, quotaUnitsLost: 2 } : undefined) })
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r).toMatchObject({ synced: 1, errors: 1 })
    expect(r.totals).toMatchObject({ unitsUsed: 3, partsMissing: 3, sanitized: 1, missed: 5, newlyMissing: 1, quotaErrors: 1, quotaUnitsLost: 2 })
  })
  it('D: erro que só carrega o progresso da falta (missingProgressOf) soma missed e newlyMissing, uma vez', async () => {
    const boom = new Error('a falta não foi registrada')
    vi.resetModules()
    vi.doMock('@/lib/youtube/competitor-capture', async () => ({ ...(await vi.importActual<typeof import('@/lib/youtube/competitor-capture')>('@/lib/youtube/competitor-capture')), missingProgressOf: (e: unknown) => (e === boom ? { missed: 3, newlyMissing: 1 } : undefined) }))
    mockAll(async () => { throw boom }, rowsOf(1))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => Date.UTC(2026, 9, 24, 15, 2) })
    expect(r.totals).toMatchObject({ missed: 3, newlyMissing: 1 })
    vi.doUnmock('@/lib/youtube/competitor-capture')
  })
  it('item 22: 75 canais a 20 s cada → 11 por disparo, o resto fica devido, e a faixa fecha em 7 disparos, cada canal uma vez', async () => {
    const slot = Date.UTC(2026, 9, 24, 15, 0) // 12:00 de São Paulo
    const rows = rowsOf(75).map(r => ({ ...r, last_synced_at: new Date(slot - 6 * 3_600_000).toISOString() as string | null }))
    const count = new Map<string, number>()
    let clock = slot
    mockAll(async r => { count.set(r.id, (count.get(r.id) ?? 0) + 1); rows.find(x => x.id === r.id)!.last_synced_at = new Date(clock).toISOString(); clock += 20_000; return { unitsUsed: 4 } }, rows)
    const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
    let runs = 0, remaining = 75
    while (remaining > 0 && runs < 18) {
      clock = slot + runs * 20 * 60_000
      const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: BATCH_BUDGET_MS, now: () => clock })
      if (runs === 0) expect(r).toMatchObject({ synced: 11, remainingDue: 64, stoppedForTime: true })
      remaining = r.remainingDue
      runs++
    }
    expect(runs).toBe(7)
    expect([...count.values()].every(v => v === 1)).toBe(true)
    expect(count.size).toBe(75)
  })
  it('J: o relógio é conferido ANTES de começar cada canal: com o orçamento no limite nenhum canal novo começa', async () => {
    const sync = vi.fn(async () => ({}))
    mockAll(sync, rowsOf(3))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    let t = Date.UTC(2026, 9, 24, 15, 2)
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => { const v = t; t += 150_000; return v } })
    // 1ª leitura (started) = 0; 2ª (antes do canal 1) = 150 s: começa; 3ª (antes do canal 2) = 300 s: passou de 200 s
    expect(sync).toHaveBeenCalledTimes(1)
    expect(r).toMatchObject({ synced: 1, stoppedForTime: true, remainingDue: 2 })
  })
  it('B: a leitura dos canais que volta nula é falha (o lote lança), nunca "nenhum canal"', async () => {
    mockAll(async () => ({}), [])
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) }) }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    await expect(runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => 0 })).rejects.toThrow(/nula|lista/)
  })
  it('B: sem nenhum canal cadastrado o lote responde lista vazia de sites (a rota decide o que isso quer dizer)', async () => {
    mockAll(async () => ({}), [])
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    expect(await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => 0 })).toMatchObject({ synced: 0, healthSiteIds: [], acao_do_dono: [] })
  })
})

describe('A5: a cota que um canal não conseguiu gravar é tentada de novo no fim do disparo (D-I5b)', () => {
  const NOW = Date.UTC(2026, 9, 24, 15, 2)
  const world = (recordQuota: (sb: unknown, p: Record<string, unknown>) => Promise<void>) => {
    vi.resetModules()
    const captureException = vi.fn()
    vi.doMock('@sentry/nextjs', () => ({ captureException, captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async (r: { id: string }) => ({ unitsUsed: 4, quotaError: true as const, quotaUnitsLost: r.id === 'b' ? 5 : 4 })), syncCompetitorWeekly: vi.fn(), syncStatsOf: () => undefined, WeeklyVersionError: class extends Error {}, spDate: () => '2026-10-24' }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/youtube/competitor-quota', () => ({ recordQuota: vi.fn(recordQuota), pacificDate: () => '2026-10-24' }))
    const rows = [{ id: 'a', channel_id: 'A', site_id: 's1', last_synced_at: null }, { id: 'b', channel_id: 'B', site_id: 's1', last_synced_at: null }, { id: 'c', channel_id: 'C', site_id: 's2', last_synced_at: null }]
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
    return { captureException }
  }
  it('uma tentativa por site, com a soma e erros_cota; passou: quotaLost fica indefinido', async () => {
    const calls: Array<Record<string, unknown>> = []
    world(async (_sb, p) => { calls.push(p) })
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => NOW })
    expect(calls.map(c => [c.siteId, c.units, c.mode, c.extra])).toEqual([['s1', 9, 'competitors', { erros_cota: 2 }], ['s2', 4, 'competitors', { erros_cota: 1 }]])
    expect(r.quotaLost).toBeUndefined()
    expect(r.totals.quotaUnitsLost).toBe(13)
  })
  it('a nova tentativa também falha: quotaLost soma o que ficou de fora (só do site que falhou)', async () => {
    const { captureException } = world(async (_sb, p) => { if (p.siteId === 's1') throw new Error('banco fora') })
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => NOW })
    expect(r.quotaLost).toBe(9)
    // item 8: a perda de cota vai ao Sentry (antes o catch engolia o erro), com o site e as unidades perdidas
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: 'banco fora' }), expect.objectContaining({ tags: expect.objectContaining({ component: 'sync-youtube', mode: 'competitors-quota' }), extra: expect.objectContaining({ siteId: 's1', unitsLost: 9 }) }))
  })
})

describe('A5: a fase semanal não depende da posição do canal nem da faixa das 18:00 (D-I3, S-I1)', () => {
  const SP = 3 * 3_600_000
  const at = (day: string, hhmm: string) => Date.parse(day + 'T' + hhmm + ':00.000Z') + SP        // hora de São Paulo → UTC
  const DAY = '2026-10-24'
  type Row = { id: string; channel_id: string; channel_name: string; site_id: string; last_synced_at: string | null; last_ok_synced_at: string | null; sync_status: string; sync_error: string | null; sync_error_since: string | null; missing_since: string | null; weekly_pass_date: string | null }
  /**
   * Um mundo simulado: canais na ordem estável, um relógio só; a sincronização de um canal custa `syncMs`, conferir um vídeo semanal custa `videoMs`.
   * Opções: lastSync (hora da última sincronização dos canais), unclassified (nenhum vídeo tem faixa), stampUnclassified (a leitura semanal SEM a defesa da 11b),
   * noReopen (o banco SEM o conserto da MG2), weeklyThrows (canais cuja leitura semanal lança o erro dado).
   */
  const world = (o: { syncMs: number; videoMs: number; due: number[]; failWeeklyUntil?: number; lastSync?: string; unclassified?: boolean; stampUnclassified?: boolean; noReopen?: boolean; weeklyThrows?: Record<string, () => Error> }) => {
    let clock = 0
    const rows: Row[] = o.due.map((_, i) => ({ id: 'c' + String(i).padStart(2, '0'), channel_id: 'UC' + i, channel_name: 'Canal ' + i, site_id: 's1', last_synced_at: new Date(at(DAY, o.lastSync ?? '06:00') + i * 1000).toISOString(), last_ok_synced_at: new Date(at(DAY, o.lastSync ?? '06:00') + i * 1000).toISOString(), sync_status: 'idle', sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null })) // canais que já sincronizaram bem
    const left = new Map(rows.map((r, i) => [r.id, o.due[i]!]))
    const order: string[] = []
    const breakers: unknown[] = []
    const budgets: Array<{ id: string; visitMs: number | null }> = []
    const classified = new Set(o.unclassified ? [] : rows.map(r => r.id))
    const readAt = new Map<string, number>()
    class WeeklyVersionError extends Error { constructor(m: string, readonly result: Record<string, unknown>) { super(m); this.name = 'WeeklyVersionError' } }
    vi.resetModules()
    vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    vi.doMock('@/lib/youtube/competitor-quota', () => ({ recordQuota: vi.fn(async () => undefined), pacificDate: () => DAY }))
    // o lote recebe uma CÓPIA das linhas, como em produção: o que a sincronização grava no meio do disparo só é visto no disparo seguinte
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows.map(r => ({ ...r })).sort((a, b) => (a.last_synced_at ?? '').localeCompare(b.last_synced_at ?? '')), error: null }) }) }) }) }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({
      spDate: (ms: number) => new Date(ms - SP).toISOString().slice(0, 10),
      syncStatsOf: () => undefined,
      WeeklyVersionError,
      syncCompetitorChannel: vi.fn(async (r: { id: string }) => {
        const row = rows.find(x => x.id === r.id)!
        row.last_synced_at = new Date(clock).toISOString(); row.last_ok_synced_at = row.last_synced_at; clock += o.syncMs
        if (!classified.has(r.id)) { classified.add(r.id); if (!o.noReopen) row.weekly_pass_date = null }
        return { unitsUsed: 3 }
      }),
      syncCompetitorWeekly: vi.fn(async (r: { id: string }, _k: string, w: { deadline?: () => boolean; thumbBreaker?: unknown }) => {
        order.push(r.id); breakers.push(w.thumbBreaker)
        const row = rows.find(x => x.id === r.id)!
        const t0 = clock
        if (o.weeklyThrows?.[r.id]) { clock += 2_000; throw o.weeklyThrows[r.id]!() }
        if (o.failWeeklyUntil != null && clock < o.failWeeklyUntil) { clock += 2_000; throw new Error('boom') }
        if (!classified.has(r.id)) {
          clock += 300
          if (o.stampUnclassified) row.weekly_pass_date = DAY
          return { due: 0, recorded: 0, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: o.stampUnclassified === true }
        }
        let n = left.get(r.id)!, recorded = 0
        while (n > 0 && !w.deadline?.()) { clock += o.videoMs; n--; recorded++ }
        budgets.push({ id: r.id, visitMs: clock - t0 })
        left.set(r.id, n)
        if (n === 0) { row.weekly_pass_date = DAY; readAt.set(r.id, clock) }
        return { due: n + recorded, recorded, deferred: n, promoted: 0, unitsUsed: recorded ? 1 : 0, changesDetected: 0, longWindowChanges: 0, complete: n === 0 }
      }),
    }))
    const fire = async (hhmm: string, weekly = true) => {
      clock = at(DAY, hhmm)
      const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
      return runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: BATCH_BUDGET_MS, now: () => clock, ...(weekly ? { weekly: true } : {}) })
    }
    const pending = () => rows.filter(r => r.weekly_pass_date !== DAY).map(r => r.id)
    const devidosHoje = () => rows.filter(r => classified.has(r.id)).reduce((a, r) => a + left.get(r.id)!, 0)
    return { rows, left, order, fire, pending, devidosHoje, readAt, breakers, budgets, classified, WeeklyVersionError }
  }
  // o que foi medido em produção em 12/10: 15 canais a 21 s; devidos por canal num dia da semana 1
  const MEASURED = [1, 13, 0, 34, 1, 0, 32, 7, 12, 3, 1, 0, 0, 0, 0]

  it('antes das 12:00 de São Paulo a fase não roda', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED })
    const r = await w.fire('06:00')
    expect(r.weekly).toMatchObject({ ran: false, visited: 0 })
    expect(w.order).toEqual([])
  })
  it('as duas faixas, ordem estável, 15 canais a 21 s, trabalho da semana 1: TODO canal tem a passada completa até o disparo das 12:40, inclusive as posições 7 a 11', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED })
    const r1 = await w.fire('12:00')                    // 10 canais (210 s): não sobra tempo para a fase
    expect(r1.synced).toBe(10)
    expect(r1.weekly.visited).toBe(0)
    await w.fire('12:20')                               // os 5 restantes (105 s) e a fase até os 210 s
    await w.fire('12:40')                               // nenhum canal devido: a fase tem o disparo inteiro
    expect(w.pending()).toEqual([])
    expect([...w.left.values()].every(n => n === 0)).toBe(true)
    expect(new Set(w.order).size).toBe(15)
    const r4 = await w.fire('18:00')
    expect(r4.weekly).toMatchObject({ visited: 0, pending: 0 })
  })
  it('caso duro: os disparos com canal devido não deixam tempo NENHUM (45 s por canal): tudo completo no primeiro disparo sem canal devido', async () => {
    const w = world({ syncMs: 45_000, videoMs: 1_050, due: MEASURED })
    for (const t of ['12:00', '12:20', '12:40']) { const r = await w.fire(t); expect(r.synced).toBe(5); expect(r.weekly.recorded).toBe(0) }
    expect(w.pending()).toHaveLength(15)
    const r = await w.fire('13:00')
    expect(w.pending()).toEqual([])
    expect(r.weekly).toMatchObject({ complete: 15, pending: 0, errors: 0 })
  })
  it('a fase só começa depois do último canal devido do disparo: nenhuma visita semanal antes da última sincronização', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [3, 3, 3] })
    const calls: string[] = []
    const sync = await import('@/lib/youtube/competitor-sync')
    vi.mocked(sync.syncCompetitorChannel).mockImplementation(async (r: { id: string }) => { calls.push('sync:' + r.id); return { unitsUsed: 3 } as never })
    const weekly = vi.mocked(sync.syncCompetitorWeekly)
    const inner = weekly.getMockImplementation()!
    weekly.mockImplementation(async (r, k, o) => { calls.push('weekly:' + r.id); return inner(r, k, o) })
    await w.fire('12:40')
    expect(calls.findIndex(c => c.startsWith('weekly:'))).toBe(3)
    expect(calls.slice(0, 3).every(c => c.startsWith('sync:'))).toBe(true)
  })
  it('I-5: a fase NUNCA começa com canal devido sobrando: 15 canais a 19 s, o laço para aos ~209 s com 4 devidos, e nenhuma visita semanal acontece naquele disparo', async () => {
    const w = world({ syncMs: 19_000, videoMs: 1_050, due: MEASURED })
    const r = await w.fire('12:40')
    expect(r.synced).toBe(11)
    expect(r.remainingDue).toBe(4)
    expect(r.stoppedForTime).toBe(true)
    expect(r.weekly.ran).toBe(false)
    expect(w.order).toEqual([])
    // o disparo seguinte sincroniza os 4 que sobraram e, agora sem devido sobrando, a fase roda
    const r2 = await w.fire('13:00')
    expect(r2.remainingDue).toBe(0)
    expect(r2.weekly.ran).toBe(true)
    expect(w.order.length).toBeGreaterThan(0)
  })
  it('I-5: o lote cheio (batchSize) com devido sobrando também não abre a fase', async () => {
    const w = world({ syncMs: 1_000, videoMs: 1_050, due: MEASURED })
    const { runCompetitorBatch, BATCH_BUDGET_MS } = await import('@/lib/youtube/competitor-sync-batch')
    const r = await runCompetitorBatch({ apiKey: 'k', batchSize: 10, budgetMs: BATCH_BUDGET_MS, now: () => at(DAY, '12:40'), weekly: true })
    expect(r.remainingDue).toBe(5)
    expect(r.weekly.ran).toBe(false)
    expect(w.order).toEqual([])
  })
  it('a dívida mais antiga é lida primeiro: nunca antes de todos, depois o mais antigo; canal já carimbado hoje é pulado', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [5, 5, 5, 5, 5] })
    w.rows[0]!.weekly_pass_date = '2026-10-23'; w.rows[1]!.weekly_pass_date = '2026-10-23'
    w.rows[2]!.weekly_pass_date = '2026-10-22'
    w.rows[3]!.weekly_pass_date = null
    w.rows[4]!.weekly_pass_date = DAY                   // já carimbado hoje
    await w.fire('12:40')
    expect(w.order.slice(0, 4)).toEqual(['c03', 'c02', 'c00', 'c01'])
    expect(w.order).not.toContain('c04')
  })
  it('o MESMO disjuntor de miniatura vai a todos os canais do disparo, e cada visita recebe o orçamento por canal', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2, 2, 2] })
    await w.fire('12:40')
    expect(w.breakers).toHaveLength(3)
    expect(w.breakers[0]).toEqual({ failures: 0 })
    expect(w.breakers[1]).toBe(w.breakers[0]); expect(w.breakers[2]).toBe(w.breakers[0])
  })
  it('orçamento por canal: um canal com 279 devidos não tira a vez dos outros, e o que sobra dele continua no disparo seguinte', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [279, 3, 3, 3] })
    w.rows[0]!.weekly_pass_date = null
    const r = await w.fire('12:40')
    expect(w.pending()).toEqual(['c00'])
    expect(w.left.get('c00')).toBeGreaterThan(0)
    expect(r.weekly.deferred).toBeGreaterThan(0)
    await w.fire('13:00')
    expect(w.pending()).toEqual([])
  })
  it('a fase semanal falhando num canal não derruba o disparo nem os outros canais, e o canal é tentado de novo no disparo seguinte', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2, 2], failWeeklyUntil: at(DAY, '12:50') })
    const r = await w.fire('12:40')
    expect(r.weekly).toMatchObject({ errors: 2, complete: 0, pending: 2 })
    expect(r.errors).toBe(0)
    const r2 = await w.fire('13:00')
    expect(r2.weekly).toMatchObject({ errors: 0, complete: 2, pending: 0 })
  })
  it('C: um canal que lança erro qualquer não derruba os seguintes, o erro é contado e visível no resumo', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2, 2, 2], weeklyThrows: { c00: () => new Error('YouTube API 500 em videos.list') } })
    const r = await w.fire('12:40')
    expect(r.weekly).toMatchObject({ errors: 1, complete: 2, pending: 1, visited: 2 })
    expect(r.weekly.firstError).toMatch(/c00|Canal 0/)
    expect(r.weekly.firstError).toMatch(/videos\.list/)
    expect(w.pending()).toEqual(['c00'])
    expect(r.errors).toBe(0)
  })
  it('C: WeeklyVersionError: o canal foi carimbado (complete), o erro é visível, e os contadores vêm de .result', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [1, 1], weeklyThrows: {} })
    const sync = await import('@/lib/youtube/competitor-sync')
    const weekly = vi.mocked(sync.syncCompetitorWeekly)
    const inner = weekly.getMockImplementation()!
    weekly.mockImplementation(async (r, k, o) => {
      if (r.id !== 'c00') return inner(r, k, o)
      w.rows[0]!.weekly_pass_date = DAY
      throw new w.WeeklyVersionError('não foi possível gravar a versão da miniatura (x)', { due: 5, recorded: 5, deferred: 0, promoted: 2, unitsUsed: 1, changesDetected: 0, longWindowChanges: 0, complete: true, versionFailed: 2, thumbFailed: 1, thumbSkipped: 3 })
    })
    const r = await w.fire('12:40')
    expect(r.weekly).toMatchObject({ errors: 1, complete: 2, pending: 0, recorded: 6, promoted: 2, versionFailed: 2, thumbFailed: 1, thumbSkipped: 3 })
    expect(r.weekly.firstError).toMatch(/miniatura/)
    expect(r.totals).toMatchObject({ weeklyRecorded: 6, promoted: 2, versionFailed: 2, thumbFailed: 1, thumbSkipped: 3 })
  })
  it('C: o canal sem nenhuma faixa (nada devido, nada adiado) não é revisitado a cada volta da fase', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [300, 4], lastSync: '12:00' })
    w.classified.delete('c01')                          // c00 anda em várias voltas (60 s por visita); c01 não tem faixa e não tem o que ler
    await w.fire('15:00')
    expect(w.order.filter(id => id === 'c00').length).toBeGreaterThan(2)
    expect(w.order.filter(id => id === 'c01')).toHaveLength(1)
  })
  // O DIA DO DEPLOY. A promoção é entre 12:25 e 17:30: o código antigo fez a faixa das 12:00, nenhum vídeo tem faixa, e a fase semanal roda
  // em todo disparo até as 17:40 sem ter o que ler. Às 18:00 a sincronização grava as faixas.
  it.each([
    [false, 'com a defesa da Tarefa 11b (canal sem faixa não é carimbado)'],
    [true, 'SEM a defesa, só com a MG2 (a troca de faixa zera weekly_pass_date)'],
  ] as Array<[boolean, string]>)('fecho F-1, dia do deploy (stampUnclassified = %s: %s): os devidos de D0 são lidos em D0, antes das 19:00, e a prova não fica vermelha', async (stampUnclassified) => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED, lastSync: '12:00', unclassified: true, stampUnclassified })
    for (const t of ['13:00', '13:20', '15:00', '17:40']) { const r = await w.fire(t); expect(r.synced).toBe(0); expect(r.weekly).toMatchObject({ ran: true, recorded: 0 }) }
    expect(w.pending()).toHaveLength(stampUnclassified ? 0 : 15)
    const r18 = await w.fire('18:00')
    expect(r18.synced).toBe(10)
    expect(r18.weekly.recorded).toBe(0)
    expect(w.devidosHoje()).toBeGreaterThan(0)
    await w.fire('18:20')
    await w.fire('18:40')
    expect([...w.left.values()].every(n => n === 0)).toBe(true)
    expect(w.pending()).toEqual([])
    expect(w.devidosHoje()).toBe(0)
    expect(Math.max(...w.readAt.values())).toBeLessThan(at(DAY, '19:00'))
    const r19 = await w.fire('19:00')
    expect(r19.weekly).toMatchObject({ pending: 0, errors: 0 })
  })
  it('fecho F-1, o defeito reproduzido: sem a defesa E sem a MG2, nenhum devido de D0 é lido em D0 (é o que os dois consertos impedem)', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: MEASURED, lastSync: '12:00', unclassified: true, stampUnclassified: true, noReopen: true })
    for (const t of ['13:00', '18:00', '18:20', '18:40', '19:00', '23:40']) await w.fire(t)
    expect(w.devidosHoje()).toBe(104)
    expect(w.pending()).toEqual([])
  })
  it('fecho F-1, canal novo no meio da tarde: carimbado ou não antes da primeira sincronização, é lido no dia em que ganha as faixas', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [3, 5], lastSync: '12:00' })
    w.rows.push({ ...w.rows[0]!, id: 'c99', channel_id: 'UC99', channel_name: 'Novo', last_synced_at: null, weekly_pass_date: DAY })
    w.left.set('c99', 40)
    await w.fire('15:00')
    await w.fire('15:20')
    expect(w.left.get('c99')).toBe(0)
    expect(w.pending()).toEqual([])
  })
  it('I: weekly: false (a volta de uma linha): a fase não roda e a série diária segue', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [2] })
    const r = await w.fire('12:40', false)
    expect(r.weekly).toMatchObject({ ran: false, visited: 0 })
    expect(w.order).toEqual([])
    expect(r.synced).toBe(1)                            // a série diária segue
    expect(r.totals).toMatchObject({ unitsUsed: 3, weeklyRecorded: 0 })
  })
  it('E: a nota do canal em erro: depois do 3º dia vai para acao_do_dono (nome, dias desde a última sincronização boa, motivo humano); com menos, ausente ou fora do ar, não', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0, 0, 0, 0] })
    const ago = (d: number) => new Date(at(DAY, '12:40') - d * 86_400_000).toISOString()
    Object.assign(w.rows[0]!, { sync_status: 'error', sync_error: 'YouTube API 404 for channel UC0', sync_error_since: ago(4), last_ok_synced_at: ago(4.3) })
    Object.assign(w.rows[1]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(1), last_ok_synced_at: ago(1.2) })
    Object.assign(w.rows[2]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(9), last_ok_synced_at: ago(9.1), missing_since: '2026-10-16' })
    Object.assign(w.rows[3]!, { sync_status: 'error', sync_error: null, sync_error_since: ago(5), last_ok_synced_at: null })
    const r = await w.fire('12:40')
    // o erro mais antigo primeiro: é o que está esperando o dono há mais tempo
    expect(r.acao_do_dono).toEqual(['canal Canal 3 em erro há 5 dias: erro sem mensagem registrada', 'canal Canal 0 em erro há 4 dias: não encontrado no YouTube (404)'])
  })
  // (portão final, I-4 de software / dados) canal novo pelo CMS: a primeira sincronização roda num after() de 60 s e pode ficar pela metade
  // (status 'syncing', last_synced_at de agora, sem sincronização boa). Sem isto ele só voltaria na próxima faixa de 6 h, com a prova vermelha.
  it('I-4: o canal que ainda não teve a PRIMEIRA sincronização boa é devido no disparo seguinte, mesmo já tendo last_synced_at da faixa; os outros seguem a faixa', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0, 0, 0, 0, 0], lastSync: '12:10' })
    // 12:10 já é da faixa das 12:00: ninguém é devido por faixa. c0 = parcial (syncing), c1 = parcial parado (idle), c2 = parcial em erro, c3 = parcial ausente
    Object.assign(w.rows[0]!, { sync_status: 'syncing', last_ok_synced_at: null })
    Object.assign(w.rows[1]!, { sync_status: 'idle', last_ok_synced_at: null })
    Object.assign(w.rows[2]!, { sync_status: 'error', last_ok_synced_at: null, sync_error_since: new Date(at(DAY, '12:00')).toISOString() })
    Object.assign(w.rows[3]!, { last_ok_synced_at: null, missing_since: '2026-10-20' })
    const sync = await import('@/lib/youtube/competitor-sync')
    const r = await w.fire('12:40', false)
    expect(r.synced).toBe(2)
    expect(vi.mocked(sync.syncCompetitorChannel).mock.calls.map(c => (c[0] as { id: string }).id)).toEqual(['c00', 'c01'])
    expect(r.remainingDue).toBe(0)
    // a sincronização boa (o mock grava last_ok) tira o canal da regra: o disparo seguinte volta à faixa
    const r2 = await w.fire('13:00', false)
    expect(r2.synced).toBe(0)
  })
  it('I-4: o canal em erro desde o começo (nunca sincronizou bem) NÃO é puxado a cada disparo: segue a faixa, como o erro permanente', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0], lastSync: '12:10' })
    Object.assign(w.rows[0]!, { sync_status: 'error', last_ok_synced_at: null, sync_error_since: new Date(at(DAY, '12:00')).toISOString() })
    expect((await w.fire('12:40', false)).synced).toBe(0)
  })
  it('I-2 do portão (dados): o canal em erro permanente tentado de novo e que falha de novo NÃO deixa o resumo vermelho; o novo erro (menos de 3 dias) sim', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0, 0] })
    const ago = (d: number) => new Date(at(DAY, '12:40') - d * 86_400_000).toISOString()
    const sync = await import('@/lib/youtube/competitor-sync')
    const { batchHealth } = await import('@/lib/youtube/competitor-sync-batch')
    vi.mocked(sync.syncCompetitorChannel).mockImplementation(async (r: { id: string }) => {
      if (r.id === w.rows[0]!.id) throw new Error('boom')
      return { unitsUsed: 3 } as never
    })
    Object.assign(w.rows[0]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(4), last_ok_synced_at: ago(4.2) })
    const r = await w.fire('12:40', false)
    expect(r).toMatchObject({ synced: 1, errors: 1, errorsKnown: 1, channelsLongError: 1, channelsActive: 2 })
    // 1 de 2 ativos é metade: vermelho pela pane, não pelo erro isolado
    expect(batchHealth(r)).toMatchObject({ ok: false, message: '1 de 2 canais em erro há mais de 3 dias' })
    // o mesmo canal com 2 dias de erro é o erro novo da regra de hoje
    Object.assign(w.rows[0]!, { sync_status: 'error', sync_error_since: ago(2) })
    const r2 = await w.fire('13:00', false)
    expect(r2).toMatchObject({ errors: 1, errorsKnown: 0, channelsLongError: 0 })
    expect(batchHealth(r2)).toMatchObject({ ok: false, message: '1 de 2 canais falhou' })
  })
  it('E: a nota some sozinha quando o canal deixa de estar em erro (recalculada do banco a cada execução)', async () => {
    const w = world({ syncMs: 21_000, videoMs: 1_050, due: [0] })
    const ago = (d: number) => new Date(at(DAY, '12:40') - d * 86_400_000).toISOString()
    Object.assign(w.rows[0]!, { sync_status: 'error', sync_error: 'boom', sync_error_since: ago(6), last_ok_synced_at: ago(6) })
    expect((await w.fire('12:40')).acao_do_dono).toHaveLength(1)
    Object.assign(w.rows[0]!, { sync_status: 'idle', sync_error: null, sync_error_since: null })
    expect((await w.fire('13:00')).acao_do_dono).toEqual([])
  })
})

describe('E: o aviso ao dono quando o canal cruza o 3º dia em erro, e um lembrete por semana', () => {
  const NOW = Date.parse('2026-10-24T15:40:00.000Z')
  const DAYMS = 86_400_000
  const ago = (d: number) => new Date(NOW - d * DAYMS).toISOString()
  type R = { id: string; channel_id: string; channel_name: string; site_id: string; last_synced_at: string | null; last_ok_synced_at: string | null; sync_status: string; sync_error: string | null; sync_error_since: string | null; missing_since: string | null; weekly_pass_date: string | null }
  const row = (id: string, o: Partial<R> = {}): R => ({ id, channel_id: 'UC' + id, channel_name: 'Canal ' + id, site_id: 's1', last_synced_at: new Date(NOW - 60_000).toISOString(), last_ok_synced_at: null, sync_status: 'idle', sync_error: null, sync_error_since: null, missing_since: null, weekly_pass_date: null, ...o })
  const erro = (id: string, days: number, o: Partial<R> = {}): R => row(id, { sync_status: 'error', sync_error: 'YouTube API 404 for channel UC' + id, sync_error_since: ago(days), last_ok_synced_at: ago(days + 0.1), ...o })
  const world = async (rows: R[], o: { existing?: string[]; owners?: Record<string, Array<{ userId: string; email: string | null }>>; create?: () => Promise<unknown>; lookup?: 'ok' | 'error' | 'throws' } = {}) => {
    vi.resetModules()
    const captureException = vi.fn()
    vi.doMock('@sentry/nextjs', () => ({ captureException, captureMessage: vi.fn() }))
    vi.doMock('@/lib/youtube/competitor-sync', () => ({ syncCompetitorChannel: vi.fn(async () => ({})), syncCompetitorWeekly: vi.fn(), syncStatsOf: () => undefined, WeeklyVersionError: class extends Error {}, spDate: () => '2026-10-24' }))
    vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
    vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
    // o que foi criado fica gravado: o disparo seguinte (again) consulta a trava e acha o que o anterior criou
    const stored = new Set(o.existing ?? [])
    const create = vi.fn(async (input: { dedup_key: string }) => {
      const r = await (o.create ?? (async () => ({ success: true, notificationId: 'n1' })))() as { success?: boolean; suppressed?: boolean }
      if (r.success && !r.suppressed) stored.add(input.dedup_key)
      return r
    })
    vi.doMock('@/lib/notifications/create', () => ({ createNotification: create }))
    const logSem = vi.fn()
    const owners = o.owners ?? { s1: [{ userId: 'u1', email: null }] }
    vi.doMock('@/lib/notifications/get-site-owners', () => ({ getSiteOwners: vi.fn(async (_c: unknown, siteId: string) => owners[siteId] ?? []), logSemDestinatario: logSem }))
    const lookups: string[][] = []
    const tables: string[] = []
    vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: (t: string) => {
      tables.push(t)
      if (t === 'notifications') return { select: () => ({ in: (_col: string, keys: string[]) => {
        lookups.push(keys)
        if (o.lookup === 'throws') throw new Error('rede')
        return Promise.resolve(o.lookup === 'error' ? { data: null, error: { message: 'banco fora' } } : { data: [...stored].filter(k => keys.includes(k)).map(dedup_key => ({ dedup_key })), error: null })
      } }) }
      return { select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }
    } }) }))
    const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
    const again = () => runCompetitorBatch({ apiKey: 'k', batchSize: 15, budgetMs: 200_000, now: () => NOW })
    const result = await again()
    return { result, create, logSem, lookups, captureException, again }
  }
  const since = (days: number) => ago(days).slice(0, 10)

  it('o canal que cruzou o 3º dia: um aviso por dono, com o nome, os dias e o motivo em português, sem repetir a cada disparo', async () => {
    const w = await world([erro('a', 3.2)], { owners: { s1: [{ userId: 'u1', email: null }, { userId: 'u2', email: null }] } })
    expect(w.create).toHaveBeenCalledTimes(2)
    const input = w.create.mock.calls[0]![0] as Record<string, unknown>
    expect(input).toMatchObject({ site_id: 's1', user_id: 'u1', type: 'youtube.competitor_channel_error', domain: 'youtube', dedup_key: 'competitor-channel-error-a-' + since(3.2) + '-0' })
    expect(input.title).toBe('O canal Canal a está em erro há 3 dias')
    expect(String(input.message)).toContain('não encontrado no YouTube (404)')
    expect(String(input.message)).toContain('Canal a')
    expect(String(input.action_href)).toMatch(/^\/cms\/youtube\/competitors/)
    expect(w.result.ownerNotices).toEqual({ sent: 2, failed: 0 })
  })
  it('nome do canal e motivo gigantes são cortados com reticências, sem controle no título', async () => {
    const w = await world([erro('a', 3.2, { channel_name: 'N\r\nBcc: x' + 'n'.repeat(500), sync_error: 'e'.repeat(2000) })])
    const input = w.create.mock.calls[0]![0] as { title: string; message: string }
    expect(input.title).not.toMatch(/[\r\n]/)
    expect(input.title.length).toBeLessThan(200)
    expect(input.title).toContain('…')
    expect(input.message.length).toBeLessThan(900)
    expect(input.message).toContain('…')
  })
  it('a trava é o estado gravado: com a chave da semana já em notifications, nada é criado', async () => {
    const w = await world([erro('a', 4)], { existing: ['competitor-channel-error-a-' + since(4) + '-0'] })
    expect(w.create).not.toHaveBeenCalled()
    expect(w.lookups).toEqual([['competitor-channel-error-a-' + since(4) + '-0']])
    expect(w.result.ownerNotices).toEqual({ sent: 0, failed: 0 })
  })
  it('um lembrete por semana: a chave muda de 7 em 7 dias a partir do 3º dia, e o texto vira lembrete', async () => {
    const w = await world([erro('a', 10.5), erro('b', 17.2), erro('c', 9.9)])
    const keys = w.create.mock.calls.map(c => (c[0] as { dedup_key: string }).dedup_key).sort()
    expect(keys).toEqual(['competitor-channel-error-a-' + since(10.5) + '-1', 'competitor-channel-error-b-' + since(17.2) + '-2', 'competitor-channel-error-c-' + since(9.9) + '-0'])
    const titleA = (w.create.mock.calls.find(c => (c[0] as { dedup_key: string }).dedup_key.includes('-a-'))![0] as { title: string }).title
    expect(titleA).toBe('Lembrete: o canal Canal a continua em erro (10 dias)')
  })
  it('com menos de 3 dias, canal ausente do YouTube ou canal sem data de erro: nenhum aviso e nenhuma consulta', async () => {
    const w = await world([erro('a', 2.9), erro('b', 8, { missing_since: '2026-10-16' }), erro('c', 5, { sync_error_since: null }), row('d')])
    expect(w.create).not.toHaveBeenCalled()
    expect(w.lookups).toEqual([])
  })
  it('a criação do aviso falha: o disparo termina, o erro vai ao Sentry e conta como falha', async () => {
    const w = await world([erro('a', 4), erro('b', 4)], { create: async () => { throw new Error('rate limit') } })
    expect(w.result.errors).toBe(0)
    expect(w.result.ownerNotices).toEqual({ sent: 0, failed: 2 })
    expect(w.captureException).toHaveBeenCalled()
  })
  it('a criação devolve success: false (não lança): conta como falha, não como enviado', async () => {
    const w = await world([erro('a', 4)], { create: async () => ({ success: false, error: 'rate limit exceeded (100/hour)' }) })
    expect(w.result.ownerNotices).toEqual({ sent: 0, failed: 1 })
  })
  it('aviso suprimido pela trava do banco (suppressed) não conta como enviado', async () => {
    const w = await world([erro('a', 4)], { create: async () => ({ success: true, suppressed: true }) })
    expect(w.result.ownerNotices).toEqual({ sent: 0, failed: 0 })
  })
  it('a consulta da trava falha (erro ou exceção): tenta criar mesmo assim, o índice único do banco impede a repetição', async () => {
    for (const lookup of ['error', 'throws'] as const) {
      const w = await world([erro('a', 4)], { lookup })
      expect(w.create).toHaveBeenCalledTimes(1)
      expect(w.result.ownerNotices).toEqual({ sent: 1, failed: 0 })
    }
  })
  it('site sem dono: registra sem_destinatario e não cria nada', async () => {
    const w = await world([erro('a', 4)], { owners: {} })
    expect(w.logSem).toHaveBeenCalledWith('competitor-sync-batch', 's1')
    expect(w.create).not.toHaveBeenCalled()
  })
  it('COMPETITOR_NOTIFICATIONS_ENABLED=false desliga o aviso (a mesma chave que o sync já respeita)', async () => {
    vi.stubEnv('COMPETITOR_NOTIFICATIONS_ENABLED', 'false')
    const w = await world([erro('a', 4)])
    vi.unstubAllEnvs()
    expect(w.create).not.toHaveBeenCalled()
  })
  it('o texto do aviso é português simples, sem jargão técnico', async () => {
    const w = await world([erro('a', 5, { sync_error: 'quotaExceeded' })])
    const input = w.create.mock.calls[0]![0] as { title: string; message: string }
    expect(input.message).toContain('cota diária da API do YouTube esgotada')
    expect(input.message).not.toMatch(/sync_error|dedup|rpc|undefined|null/)
  })
  it('são no máximo 5 avisos por disparo (o resto vai no seguinte), para o aviso nunca atrasar o disparo', async () => {
    const w = await world(Array.from({ length: 8 }, (_, i) => erro('x' + i, 4)))
    expect(w.create).toHaveBeenCalledTimes(5)
    expect(w.lookups[0]).toHaveLength(8) // I-3: a trava é consultada para TODOS os candidatos; o teto de 5 vem depois do filtro
  })
  it('I-3: 7 canais em erro, dois disparos: 5 no primeiro, os 2 que sobraram no segundo, e nenhum aviso repetido no terceiro', async () => {
    const w = await world(Array.from({ length: 7 }, (_, i) => erro('x' + i, 10 - i * 0.5)))
    expect(w.create).toHaveBeenCalledTimes(5)
    await w.again()
    expect(w.create).toHaveBeenCalledTimes(7)
    const keys = w.create.mock.calls.map(c => (c[0] as { dedup_key: string }).dedup_key)
    expect(new Set(keys).size).toBe(7)
    await w.again()
    expect(w.create).toHaveBeenCalledTimes(7)
  })
  it('I-3: 6 canais em erro e os 5 mais antigos já avisados: o 6º é avisado (antes ficava preso para sempre)', async () => {
    const days = [10, 9.5, 9, 8.5, 8, 7.5]
    const key = (i: number) => 'competitor-channel-error-x' + i + '-' + since(days[i]!) + '-' + Math.floor((days[i]! - 3) / 7)
    const w = await world(days.map((d, i) => erro('x' + i, d)), { existing: [0, 1, 2, 3, 4].map(key) })
    expect(w.create).toHaveBeenCalledTimes(1)
    expect((w.create.mock.calls[0]![0] as { dedup_key: string }).dedup_key).toBe(key(5))
  })
  it('item 1 (I-2): o aviso vai também por E-MAIL (defaultChannels), o mesmo caminho do system.token_expired, e o corpo diz onde olhar no CMS', async () => {
    const w = await world([erro('a', 4)])
    const input = w.create.mock.calls[0]![0] as { defaultChannels?: string[]; title: string; message: string; action_href: string }
    expect(input.defaultChannels).toEqual(['email'])
    expect(input.title).toBe('O canal Canal a está em erro há 4 dias')
    expect(input.message).toContain('o canal Canal a há 4 dias')
    expect(input.message).toContain('Motivo: não encontrado no YouTube (404)')
    expect(input.message).toContain(input.action_href) // o e-mail não tem botão: o caminho da lista de canais vai escrito no corpo
    expect(input.message).toContain('/cms/youtube/competitors')
  })
  it('item 1: o lembrete semanal também sai por e-mail, com o caminho no corpo', async () => {
    const w = await world([erro('a', 10.5)])
    const input = w.create.mock.calls[0]![0] as { defaultChannels?: string[]; title: string; message: string; action_href: string }
    expect(input.title).toBe('Lembrete: o canal Canal a continua em erro (10 dias)')
    expect(input.defaultChannels).toEqual(['email'])
    expect(input.message).toContain(input.action_href)
  })
})
