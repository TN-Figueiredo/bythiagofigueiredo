// @vitest-environment node
/**
 * Task 35 — askForjaReading / cancelForjaReading: the site-scope EDIT guard runs before any service client, the user
 * comes from the session, and only a waiting request is cancelled (a running one answers with the engine's label).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import type { Dataset } from '@/lib/youtube/observatorio'
import type { ForjaRequest } from '@/lib/youtube/observatorio/types'

const oracle = loadOracle()
const UID = '11111111-1111-4111-8111-111111111111'

interface Calls { order: string[]; ask: unknown[]; cancel: unknown[]; sentry: Array<{ e: unknown; extra: unknown }> }
function setup(o: { auth?: { ok: boolean; reason?: string; user?: { id: string } }; cancelled?: boolean; ds?: Dataset; askThrows?: Error; cancelThrows?: Error } = {}): Calls {
  const calls: Calls = { order: [], ask: [], cancel: [], sentry: [] }
  vi.resetModules()
  vi.doMock('@sentry/nextjs', () => ({ captureException: (e: unknown, ctx: { extra: unknown }) => { calls.sentry.push({ e, extra: ctx.extra }) } }))
  vi.doMock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's1' }) }))
  vi.doMock('@tn-figueiredo/auth-nextjs/server', () => ({
    requireSiteScope: async (a: unknown) => { calls.order.push('guard:' + JSON.stringify(a)); return o.auth ?? { ok: true, user: { id: UID } } },
  }))
  vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }))
  vi.doMock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => { calls.order.push('service'); return { sentinel: true } } }))
  vi.doMock('@/lib/pipeline/services/forja-queue', async () => {
    const real = await vi.importActual<typeof import('@/lib/pipeline/services/forja-queue')>('@/lib/pipeline/services/forja-queue')
    return {
      ...real,
      askReading: async (_ctx: unknown, input: unknown) => { calls.ask.push(input); if (o.askThrows) throw o.askThrows; return { data: { ok: true, reason: null, results: [{ niche: 'ia', ok: true, reason: null, taskId: 't1' }] } } },
      cancelReading: async (_ctx: unknown, input: unknown) => { calls.cancel.push(input); if (o.cancelThrows) throw o.cancelThrows; return { data: { cancelled: o.cancelled ?? true } } },
    }
  })
  vi.doMock('@/lib/youtube/observatorio/load', async () => {
    const real = await vi.importActual<typeof import('@/lib/youtube/observatorio/load')>('@/lib/youtube/observatorio/load')
    return { ...real, loadDataset: async () => o.ds ?? datasetFromOracle(oracle) }
  })
  return calls
}
const actions = async () => await import('@/app/cms/(authed)/youtube/competitors/forja-actions')

beforeEach(() => { vi.restoreAllMocks() })

describe('askForjaReading', () => {
  it('runs requireSiteScope (cms, edit) BEFORE the service client and passes the session userId', async () => {
    const calls = setup()
    const r = await (await actions()).askForjaReading('padroes-titulo', 'todos', undefined, 'long')
    expect(r.ok).toBe(true)
    expect(calls.order[0]).toBe('guard:' + JSON.stringify({ area: 'cms', siteId: 's1', mode: 'edit' }))
    expect(calls.order.indexOf('service')).toBeGreaterThan(0)
    expect(calls.ask).toEqual([{ type: 'padroes-titulo', scope: 'todos', fmt: 'long', userId: UID }])
  })
  it('without edit access: nothing reaches the service client nor the queue', async () => {
    const calls = setup({ auth: { ok: false, reason: 'forbidden' } })
    const r = await (await actions()).askForjaReading('temas', 'ia')
    expect(r).toEqual({ ok: false, reason: 'Sem permissão para pedir leituras à forja neste site.', results: [] })
    expect(calls.order).not.toContain('service')
    expect(calls.ask).toEqual([])
  })
  it('an unknown type or scope never reaches the guard', async () => {
    const calls = setup()
    const a = await actions()
    expect((await a.askForjaReading('diagnostico' as never, 'ia')).ok).toBe(false)
    expect((await a.askForjaReading('temas', 'tudo' as never)).ok).toBe(false)
    expect(calls.order).toEqual([])
  })
  it('a queue failure is said honestly (never a silent ok) AND reported to Sentry, without PII', async () => {
    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    const err = new PipelineServiceError('INTERNAL_ERROR', 'boom', 500)
    const calls = setup({ askThrows: err })
    expect(await (await actions()).askForjaReading('temas', 'ia')).toEqual({ ok: false, reason: 'A fila da forja não respondeu. Tente de novo em alguns minutos.', results: [] })
    expect(calls.sentry).toEqual([{ e: err, extra: { action: 'askForjaReading', taskType: 'temas', niche: 'ia', siteId: 's1' } }])
    expect(JSON.stringify(calls.sentry[0]!.extra)).not.toContain(UID)
  })
  it('a 400 from the queue is the user\'s input: said, not reported', async () => {
    const { PipelineServiceError } = await import('@/lib/pipeline/services/types')
    const calls = setup({ askThrows: new PipelineServiceError('VALIDATION_ERROR', 'videoId: required for leitura-video', 400) })
    expect((await (await actions()).askForjaReading('leitura-video', 'ia')).reason).toBe('Pedido inválido: videoId: required for leitura-video')
    expect(calls.sentry).toEqual([])
  })
  it('a cancel failure is said and reported', async () => {
    const calls = setup({ cancelThrows: new Error('db down') })
    expect(await (await actions()).cancelForjaReading('temas', 'viagem')).toEqual({ ok: false, reason: 'A fila da forja não respondeu. Tente de novo em alguns minutos.' })
    expect(calls.sentry[0]!.extra).toEqual({ action: 'cancelForjaReading', taskType: 'temas', niche: 'viagem', siteId: 's1' })
  })
  it('leitura-video carries the video id', async () => {
    const calls = setup()
    await (await actions()).askForjaReading('leitura-video', 'ia', '22222222-2222-4222-8222-222222222222')
    expect(calls.ask[0]).toMatchObject({ type: 'leitura-video', videoId: '22222222-2222-4222-8222-222222222222', userId: UID })
  })
})

describe('cancelForjaReading', () => {
  it('a pending request is cancelled (guard first)', async () => {
    const calls = setup({ cancelled: true })
    expect(await (await actions()).cancelForjaReading('resumo-trocas', 'ia')).toEqual({ ok: true })
    expect(calls.order[0]).toMatch(/^guard:/)
    expect(calls.cancel).toEqual([{ type: 'resumo-trocas', niche: 'ia' }])
  })
  it('a running request cannot be cancelled → {ok:false} with the engine label', async () => {
    const ds = datasetFromOracle(oracle)
    const claimed = ds.now - 17 * 6e4
    const running: ForjaRequest = {
      id: 't-run', type: 'resumo-trocas', niche: 'ia', status: 'running', target: { kind: 'niche', niche: 'ia' }, state: 'trabalhando',
      createdAt: ds.now - 21 * 6e4, claimedAt: claimed, startedAt: claimed, publishedAt: null, failedAt: null, attempt: 1, refusedReason: null, readingId: null,
    }
    ds.requests.push(running)
    setup({ cancelled: false, ds })
    expect(await (await actions()).cancelForjaReading('resumo-trocas', 'ia')).toEqual({ ok: false, reason: 'Nada cancelado: o pedido de IA está trabalhando desde 14:45 e termina na máquina.' })
  })
  it('nothing waiting → says so (no fake success)', async () => {
    setup({ cancelled: false })
    expect(await (await actions()).cancelForjaReading('temas', 'viagem')).toEqual({ ok: false, reason: 'Nada cancelado: não há pedido de Viagem esperando na fila.' })
  })
  it('without edit access nothing is deleted', async () => {
    const calls = setup({ auth: { ok: false, reason: 'unauthenticated' } })
    expect((await (await actions()).cancelForjaReading('temas', 'ia')).ok).toBe(false)
    expect(calls.cancel).toEqual([])
    expect(calls.order).not.toContain('service')
  })
})
