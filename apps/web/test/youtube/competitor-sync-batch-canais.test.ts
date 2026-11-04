// @vitest-environment node
// F3-cache T1: o lote diz QUAIS canais gravou (competitor_channels.id, a linha), por site, para o cache cair canal a canal.
import { describe, it, expect, vi } from 'vitest'

const NOW = Date.parse('2026-10-24T15:02:00-03:00')
type R = Record<string, unknown>
// id da linha e channel_id do YouTube DIFERENTES de propósito: a troca de um pelo outro não passa
const rowsOf = (n: number, f: (i: number) => R = () => ({})): R[] => Array.from({ length: n }, (_, i) => ({
  id: 'row-' + i, channel_id: 'UCyt' + i, channel_name: 'Canal ' + i, site_id: i % 2 ? 's2' : 's1', last_synced_at: null, sync_status: 'idle', collection_paused_at: null, ...f(i),
}))

function mock(rows: R[], o: { sync?: (r: { id: string }) => Promise<R>; weekly?: (r: { id: string }) => Promise<R> } = {}) {
  vi.resetModules()
  class WeeklyVersionError extends Error { constructor(m: string, readonly result: R) { super(m); this.name = 'WeeklyVersionError' } }
  vi.doMock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
  vi.doMock('@/lib/youtube/short-guard', () => ({ runControlProbe: vi.fn(async () => undefined), warnIfProbeBlocked: vi.fn() }))
  vi.doMock('@/lib/youtube/short-backfill', () => ({ reclassifyStoredShortsRoundRobin: vi.fn(async () => undefined) }))
  vi.doMock('@/lib/youtube/competitor-quota', () => ({ recordQuota: vi.fn(async () => undefined), pacificDate: () => '2026-10-24' }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({ from: () => ({ select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }) }) }) }))
  vi.doMock('@/lib/youtube/competitor-sync', () => ({
    spDate: (ms: number) => new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10),
    syncStatsOf: () => undefined, WeeklyVersionError,
    syncCompetitorChannel: vi.fn(o.sync ?? (async () => ({ unitsUsed: 1 }))),
    syncCompetitorWeekly: vi.fn(o.weekly ?? (async () => ({ due: 0, recorded: 1, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: true }))),
  }))
  return { WeeklyVersionError }
}
const run = async (opts: Record<string, unknown> = {}) => {
  const { runCompetitorBatch } = await import('@/lib/youtube/competitor-sync-batch')
  return runCompetitorBatch({ apiKey: 'k', batchSize: 10, budgetMs: 1e9, now: () => NOW, ...opts })
}

describe('channelIdsBySite do lote', () => {
  it('sincronizado e com erro entram (o erro grava parcial); pulado não; ids são os da LINHA, não o channel_id do YouTube; siteIds vem das chaves', async () => {
    mock(rowsOf(4), { sync: async (r) => { if (r.id === 'row-1') throw new Error('404'); if (r.id === 'row-2') return { unitsUsed: 0, skipped: true }; return { unitsUsed: 3 } } })
    const r = await run()
    expect(r.channelIdsBySite).toEqual({ s1: ['row-0'], s2: ['row-1', 'row-3'] })
    expect(r.siteIds.sort()).toEqual(Object.keys(r.channelIdsBySite).sort())
    expect(JSON.stringify(r.channelIdsBySite)).not.toContain('UCyt')
  })
  it('nada tentado: sem canais e sem sites', async () => {
    mock([])
    const r = await run()
    expect(r.channelIdsBySite).toEqual({})
    expect(r.siteIds).toEqual([])
  })
  it('um disparo sem canal devido roda só a fase semanal e os canais visitados entram na lista (o gráfico semanal não fica velho)', async () => {
    const hoje = new Date(NOW).toISOString()
    mock(rowsOf(2, () => ({ last_synced_at: hoje })))
    const r = await run({ weekly: true })
    expect(r.synced).toBe(0)
    expect(r.channelIdsBySite).toEqual({ s1: ['row-0'], s2: ['row-1'] })
    expect(r.siteIds.sort()).toEqual(['s1', 's2'])
  })
  it('a lista do lote e a da fase semanal se unem sem repetir', async () => {
    mock(rowsOf(2))
    const r = await run({ weekly: true })
    expect(r.channelIdsBySite).toEqual({ s1: ['row-0'], s2: ['row-1'] })
  })
  it('visited (por referência): o site entra assim que o lote começa a gravar o canal, mesmo que o lote nunca termine', async () => {
    let solta!: () => void
    mock(rowsOf(2), { sync: (r) => (r.id === 'row-1' ? new Promise<R>((res) => { solta = () => res({ unitsUsed: 1 }) }) : Promise.resolve({ unitsUsed: 1 })) })
    const visited = new Set<string>()
    const p = run({ visited })
    await vi.waitFor(() => expect([...visited].sort()).toEqual(['s1', 's2']))
    solta()
    await p
  })
})

describe('runWeeklyPhase devolve os canais por site', () => {
  it('todo canal visitado e não skipped entra, inclusive o que falhou com erro genérico (pode ter inserido pontos) e o WeeklyVersionError; skipped não', async () => {
    const m = mock([], { weekly: async (r) => {
      if (r.id === 'row-1') throw new Error('falhou depois de inserir')
      if (r.id === 'row-2') return { due: 0, recorded: 0, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: false, skipped: true }
      if (r.id === 'row-3') throw new m.WeeklyVersionError('versão', { due: 1, recorded: 1, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: true })
      return { due: 1, recorded: 1, deferred: 0, promoted: 0, unitsUsed: 0, changesDetected: 0, longWindowChanges: 0, complete: true }
    } })
    const { runWeeklyPhase } = await import('@/lib/youtube/competitor-sync-batch')
    const w = await runWeeklyPhase(rowsOf(4) as never, { apiKey: 'k', started: NOW, now: () => NOW })
    expect(w.channelIdsBySite).toEqual({ s1: ['row-0'], s2: ['row-1', 'row-3'] })
    expect(w.errors).toBe(2)
  })
  it('antes das 12:00 de São Paulo a fase não roda: lista vazia', async () => {
    mock([])
    const { runWeeklyPhase } = await import('@/lib/youtube/competitor-sync-batch')
    const w = await runWeeklyPhase(rowsOf(2) as never, { apiKey: 'k', started: NOW, now: () => Date.parse('2026-10-24T08:00:00-03:00') })
    expect(w.channelIdsBySite).toEqual({})
  })
})
