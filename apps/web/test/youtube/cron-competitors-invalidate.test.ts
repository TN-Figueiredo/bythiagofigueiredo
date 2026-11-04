// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(), recordCronFailure: vi.fn() }))
vi.mock('@/lib/youtube/competitor-sync-batch', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })) }))
vi.mock('@/lib/youtube/agenda/arquivo-sem-agenda', () => ({ lerArquivoSemAgenda: vi.fn(async () => ({ problemas: [], notas: [], acao: [], banco: {} })) }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(async () => null), readSiteHealth: vi.fn(async () => ({ ok: true, problems: [], notes: [] })) }))
// OBS_AGENDA=off (abaixo): a rota roda o lote antigo inteiro. A lista que roda antes dele é falso de módulo, só arranjo (não afirmação).
vi.mock('@/lib/youtube/agenda/executar', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/agenda/executar')>()), rodarAntesDoLoteAntigo: vi.fn(async () => ({ tarefas: [], problemas: [], notas: [] })) }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag, revalidatePath } from 'next/cache'
import { runCompetitorBatch } from '@/lib/youtube/competitor-sync-batch'
import { recordCronFailure } from '@/lib/cron-health'
import * as Sentry from '@sentry/nextjs'

const batch = vi.mocked(runCompetitorBatch), tag = vi.mocked(revalidateTag)
const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer test-secret' } })
const ZERO = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
const result = (o: { synced: number; errors: number; siteIds: string[]; channelIdsBySite?: Record<string, string[]> }) => ({ skipped: 0, remainingDue: 0, stoppedForTime: false, healthSiteIds: [], totals: ZERO, ...o })

describe('cron de competidores invalida o cache do Observatório', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret'); vi.stubEnv('YOUTUBE_API_KEY', 'yt-key'); vi.stubEnv('OBS_AGENDA', 'off') })

  it('nada sincronizado: nenhuma tag invalidada', async () => {
    batch.mockResolvedValue(result({ synced: 0, errors: 0, siteIds: [] }))
    expect((await GET(req())).status).toBe(200)
    expect(tag).not.toHaveBeenCalled()
  })
  it('uma tag por canal gravado (a linha do canal), com expire 0', async () => {
    batch.mockResolvedValue(result({ synced: 2, errors: 0, siteIds: ['s1', 's2'], channelIdsBySite: { s1: ['a1', 'a2'], s2: ['b1'] } }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1:a1', { expire: 0 }], ['observatorio:s1:a2', { expire: 0 }], ['observatorio:s2:b1', { expire: 0 }]])
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('lote sem a lista de canais (campo ausente ou torto): a etiqueta do site, nunca nada', async () => {
    batch.mockResolvedValue(result({ synced: 2, errors: 0, siteIds: ['s1', 's2'] }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }], ['observatorio:s2', { expire: 0 }]])
    tag.mockClear()
    batch.mockResolvedValue(result({ synced: 1, errors: 0, siteIds: ['s1'], channelIdsBySite: { s1: [] } }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/cms/youtube/competitors', 'layout')
  })
  it('só erros (dado parcial gravado): invalida mesmo com synced 0', async () => {
    batch.mockResolvedValue(result({ synced: 0, errors: 1, siteIds: ['s1'] }))
    await GET(req())
    expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }]])
  })
  it('a resposta do cron não ganha os campos siteIds nem channelIdsBySite (a lista cresce com o surto)', async () => {
    batch.mockResolvedValue(result({ synced: 1, errors: 0, siteIds: ['s1'], channelIdsBySite: { s1: ['a1'] } }))
    const body = await (await GET(req())).json()
    expect(body).toMatchObject({ mode: 'competitors', synced: 1 })
    expect('siteIds' in body).toBe(false)
    expect('channelIdsBySite' in body).toBe(false)
  })
  it('a fase semanal na resposta não traz a lista de canais (recursivo); o resto da fase fica', async () => {
    batch.mockResolvedValue({ ...result({ synced: 1, errors: 0, siteIds: ['s1'], channelIdsBySite: { s1: ['canal-unico-7'] } }), weekly: { ran: true, visited: 2, channelIdsBySite: { s1: ['canal-unico-7'] } } } as never)
    const body = await (await GET(req())).json()
    expect(body.weekly.visited).toBe(2)
    expect(JSON.stringify(body)).not.toContain('channelIdsBySite')
    expect(JSON.stringify(body)).not.toContain('canal-unico-7')
  })
  it('o lote lançou: erro registrado, nenhuma tag', async () => {
    batch.mockRejectedValue(new Error('competitor batch: timeout'))
    expect((await GET(req())).status).toBe(500)
    expect(tag).not.toHaveBeenCalled()
  })

  describe('o lote estourou o tempo (late): o site inteiro de cada canal que ele começou a gravar', () => {
    const estoura = async (): Promise<Response> => {
      vi.useFakeTimers()
      try {
        batch.mockImplementation((async (o: { visited?: Set<string> }) => { o.visited?.add('s1'); o.visited?.add('s2'); return new Promise(() => undefined) }) as never)
        const p = GET(req())
        await vi.advanceTimersByTimeAsync(10 * 60_000)
        return await p
      } finally { vi.useRealTimers() }
    }
    it('invalida os sites de `visited` E grava o cron_health vermelho', async () => {
      const res = await estoura()
      expect(res.status).toBe(500)
      expect(tag.mock.calls).toEqual([['observatorio:s1', { expire: 0 }], ['observatorio:s2', { expire: 0 }]])
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(recordCronFailure).mock.calls[0]![1]).toContain('o disparo passou do tempo')
    })
    it('a invalidação lançando nunca impede o cron_health vermelho', async () => {
      tag.mockImplementation(() => { throw new Error('fora de um request') })
      const res = await estoura()
      expect(res.status).toBe(500)
      expect(vi.mocked(recordCronFailure)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
      tag.mockReset()
    })
  })
})
