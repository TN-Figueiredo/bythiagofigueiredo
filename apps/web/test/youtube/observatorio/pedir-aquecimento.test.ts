// @vitest-environment node
// F3-cache T3: o pedido de aquecimento que o cron faz (unidade) e a fiação na rota sync-youtube (ordem: invalidar, responder, pedir).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const afters: Array<() => Promise<void>> = []
vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (f: () => Promise<void>) => { afters.push(f) } }))
vi.mock('next/cache', () => ({ updateTag: vi.fn(), revalidateTag: vi.fn(), revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn((_sb: unknown, _key: unknown, _runId: unknown, _job: unknown, fn: () => Promise<{ status: string; [k: string]: unknown }>) =>
    fn().then(r => { const { status, ...extra } = r; return Response.json(extra, { status: status === 'error' ? 500 : 200 }) })),
  newRunId: vi.fn(() => 'run-1'),
  logCron: vi.fn(),
}))
vi.mock('@/lib/youtube/sync', () => ({ syncChannel: vi.fn(), YouTubeQuotaError: class extends Error {} }))
vi.mock('@/lib/cron-health', () => ({ recordCronSuccess: vi.fn(async () => undefined), recordCronFailure: vi.fn(async () => undefined) }))
vi.mock('@/lib/youtube/competitor-sync-batch', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/youtube/competitor-sync-batch')>()), runCompetitorBatch: vi.fn(), batchHealth: vi.fn(() => ({ ok: true })) }))
vi.mock('@/lib/youtube/agenda/arquivo-sem-agenda', () => ({ lerArquivoSemAgenda: vi.fn(async () => ({ problemas: [], notas: [], acao: [], banco: {} })) }))
vi.mock('@/lib/youtube/competitor-health', () => ({ schemaReady: vi.fn(async () => null), readSiteHealth: vi.fn(async () => ({ ok: true, problems: [], notes: [] })) }))
vi.mock('@/lib/youtube/competitor-missing-proof', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/competitor-missing-proof')>()), fecharApagamentos: vi.fn(async () => ({ sites: [] })), provaDosAusentes: vi.fn(async () => ({ ok: true, problems: [], notes: [] })) }))
vi.mock('@/lib/youtube/agenda/executar', async (orig) => ({ ...(await orig<typeof import('@/lib/youtube/agenda/executar')>()), rodarAntesDoLoteAntigo: vi.fn(async () => ({ tarefas: [], problemas: [], notas: [] })) }))

import { GET } from '@/app/api/cron/sync-youtube/route'
import { revalidateTag } from 'next/cache'
import { runCompetitorBatch } from '@/lib/youtube/competitor-sync-batch'
import { recordCronFailure, recordCronSuccess } from '@/lib/cron-health'
import { criarPedidoDeAquecimento } from '@/lib/youtube/agenda/pedir-aquecimento'

const T0 = 1_800_000_000_000
const ok202 = (): Response => new Response('{}', { status: 202 })

function unidade(o: { agora?: () => number; fetch?: typeof fetch } = {}) {
  const fila: Array<() => Promise<void>> = []
  const f = o.fetch ?? (vi.fn(async () => ok202()) as unknown as typeof fetch)
  const saude = { sucesso: vi.fn(async () => undefined), falha: vi.fn(async () => undefined) }
  const logar = vi.fn()
  const agora = o.agora ?? (() => T0 + 1000)
  const p = criarPedidoDeAquecimento({ after: fn => { fila.push(fn) }, fetch: f, agora, t0: T0, saude: saude as never, logar: logar as never })
  const rodar = async (): Promise<void> => { for (const fn of fila.splice(0)) await fn() }
  return { p, fila, f: f as unknown as ReturnType<typeof vi.fn>, saude, logar, rodar }
}

beforeEach(() => { afters.length = 0; vi.clearAllMocks(); vi.stubEnv('CRON_SECRET', 'seg'); vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://exemplo.test') })
afterEach(() => { vi.unstubAllEnvs() })

describe('10. criarPedidoDeAquecimento', () => {
  it('um só after() por disparo, mesmo com vários .somar; a lista é a união', async () => {
    const u = unidade()
    u.p.somar('s1', ['a', 'b']); u.p.somar('s1', ['b', 'c']); u.p.somar('s2', ['x'])
    expect(u.fila).toHaveLength(1)
    await u.rodar()
    expect(u.f).toHaveBeenCalledTimes(1)
    const corpo = JSON.parse((u.f.mock.calls[0]![1] as { body: string }).body)
    expect(corpo.alvos).toEqual([{ siteId: 's1', ids: ['a', 'b', 'c'] }, { siteId: 's2', ids: ['x'] }])
    expect(typeof corpo.invalidadoEm).toBe('number')
  })
  it('dois acumuladores em paralelo não se misturam', async () => {
    const a = unidade(), b = unidade()
    a.p.somar('s1', ['a1']); b.p.somar('s1', ['b1'])
    await Promise.all([a.rodar(), b.rodar()])
    expect(JSON.parse((a.f.mock.calls[0]![1] as { body: string }).body).alvos[0].ids).toEqual(['a1'])
    expect(JSON.parse((b.f.mock.calls[0]![1] as { body: string }).body).alvos[0].ids).toEqual(['b1'])
  })
  it('site inteiro (null) vence a lista e vai sem ids; lista vazia não pede', async () => {
    const u = unidade()
    u.p.somar('s1', ['a']); u.p.somar('s1', null); u.p.somar('s2', [])
    expect(u.fila).toHaveLength(1)
    await u.rodar()
    expect(u.f).toHaveBeenCalledTimes(1)
    const corpo = JSON.parse((u.f.mock.calls[0]![1] as { body: string }).body)
    expect(corpo.alvos).toEqual([{ siteId: 's1' }])
    expect('ids' in corpo.alvos[0]).toBe(false)
    const vazio = unidade()
    vazio.p.somar('s1', [])
    expect(vazio.fila).toHaveLength(0)
  })
  it('muitos sites e ids: ainda um só fetch, com cada ids de no máximo 500 (acima disso o site vai inteiro)', async () => {
    const u = unidade()
    u.p.somar('s1', Array.from({ length: 1100 }, (_x, i) => 'c' + i)); u.p.somar('s2', ['x']); u.p.somar('s3', null)
    await u.rodar()
    expect(u.f).toHaveBeenCalledTimes(1)
    const { alvos } = JSON.parse((u.f.mock.calls[0]![1] as { body: string }).body)
    expect(alvos).toEqual([{ siteId: 's1' }, { siteId: 's2', ids: ['x'] }, { siteId: 's3' }])
  })
  it('local (NODE_ENV de teste/dev com OBS_E2E=1): não grava o pedido nem chama', async () => {
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'development')
    const u = unidade()
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.f).not.toHaveBeenCalled()
    expect(u.saude.sucesso).not.toHaveBeenCalled()
    expect(u.saude.falha).not.toHaveBeenCalled()
  })
  it('fora do e2e (OBS_E2E apagada): pede normalmente', async () => {
    delete process.env.OBS_E2E
    const u = unidade()
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.f).toHaveBeenCalledTimes(1)
    expect(u.saude.sucesso).toHaveBeenCalledWith('observatorio-aquecer-pedido', 'info')
  })
  it('em produção com OBS_E2E=1: pede (o e2e só vale fora de produção)', async () => {
    vi.stubEnv('OBS_E2E', '1'); vi.stubEnv('NODE_ENV', 'production')
    const u = unidade()
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.f).toHaveBeenCalledTimes(1)
  })
  it('invalidadoEm é medido no after(), antes do fetch; o pedido é gravado antes do fetch; fetch com redirect manual, no-store e 8 s', async () => {
    let t = T0 + 1000
    const ordem: string[] = []
    const f = vi.fn(async () => { ordem.push('fetch'); return ok202() }) as unknown as typeof fetch
    const u = unidade({ agora: () => t, fetch: f })
    u.saude.sucesso.mockImplementation(async () => { ordem.push('pedido') })
    u.p.somar('s1', ['a'])
    t = T0 + 9000 // o tempo passa entre o somar e o after()
    await u.rodar()
    expect(ordem).toEqual(['pedido', 'fetch'])
    expect(u.saude.sucesso).toHaveBeenCalledWith('observatorio-aquecer-pedido', 'info')
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://exemplo.test/api/cron/observatorio-aquecer')
    expect(JSON.parse(init.body as string).invalidadoEm).toBe(T0 + 9000)
    expect(init).toMatchObject({ method: 'POST', redirect: 'manual', cache: 'no-store' })
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer seg')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('restante menor que 10 s: não chama e grava falha "sem tempo para pedir"', async () => {
    const u = unidade({ agora: () => T0 + 295_000 })
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.f).not.toHaveBeenCalled()
    expect(u.saude.falha).toHaveBeenCalledWith('observatorio-aquecer', 'sem tempo para pedir', 'info')
    expect(u.saude.sucesso).not.toHaveBeenCalled()
  })
  it.each([[301], [302], [500], [200]])('resposta %i (não 202): falha em observatorio-aquecer', async status => {
    const u = unidade({ fetch: vi.fn(async () => new Response('', { status })) as unknown as typeof fetch })
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.saude.falha).toHaveBeenCalledTimes(1)
    expect(String(u.saude.falha.mock.calls[0]![1])).toContain(String(status))
  })
  it('erro ou prazo do fetch: falha, sem lançar', async () => {
    const u = unidade({ fetch: vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'TimeoutError' }) }) as unknown as typeof fetch })
    u.p.somar('s1', ['a'])
    await expect(u.rodar()).resolves.toBeUndefined()
    expect(u.saude.falha).toHaveBeenCalledWith('observatorio-aquecer', expect.stringContaining('TimeoutError'), 'info')
  })
  it('sem NEXT_PUBLIC_APP_URL (variável apagada): não chama e grava falha "sem endereço"', async () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    const u = unidade()
    u.p.somar('s1', ['a'])
    await u.rodar()
    expect(u.f).not.toHaveBeenCalled()
    expect(u.saude.falha).toHaveBeenCalledWith('observatorio-aquecer', 'sem endereço', 'info')
  })
  it('after() que lança (fora de um request): o pedido não derruba quem chamou', () => {
    const p = criarPedidoDeAquecimento({ after: () => { throw new Error('fora do request') }, fetch: vi.fn() as never, agora: () => T0, t0: T0 })
    expect(() => p.somar('s1', ['a'])).not.toThrow()
  })
})

const batch = vi.mocked(runCompetitorBatch)
const req = () => new NextRequest('http://localhost/api/cron/sync-youtube?mode=competitors', { headers: { authorization: 'Bearer seg' } })
const ZERO = { unitsUsed: 0, dailyRecorded: 0, weeklyRecorded: 0, weeklyDeferred: 0, earlyRecorded: 0, fieldsOpened: 0, rawOpened: 0, rawTooBig: 0, missed: 0, newlyMissing: 0, returned: 0, tierChanges: 0, cutByCap: 0, excludedNoCount: 0, promoted: 0, longWindowChanges: 0, partsMissing: 0, quotaErrors: 0 }
const lote = (o: { synced: number; errors: number; siteIds: string[]; channelIdsBySite?: Record<string, string[]> }) => ({ skipped: 0, remainingDue: 0, stoppedForTime: false, healthSiteIds: [], totals: ZERO, ...o })

describe('a fiação na rota sync-youtube (caminho do lote antigo)', () => {
  beforeEach(() => { vi.stubEnv('YOUTUBE_API_KEY', 'yt'); vi.stubEnv('OBS_AGENDA', 'off') })
  it('depois de invalidar tudo, o after() pede o aquecimento por site; resposta e cron_health da coleta não mudam', async () => {
    const f = vi.fn(async () => ok202())
    vi.stubGlobal('fetch', f)
    batch.mockResolvedValue({ ...lote({ synced: 2, errors: 0, siteIds: ['s1', 's2'], channelIdsBySite: { s1: ['a1', 'a2'], s2: ['b1'] } }), healthSiteIds: ['s1', 's2'] })
    const resp = await GET(req())
    expect(resp.status).toBe(200)
    expect(f).not.toHaveBeenCalled() // o pedido sai no after(), depois da resposta
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledTimes(3) // todas as invalidações já aconteceram
    expect(afters).toHaveLength(1)
    const saudeAntes = [vi.mocked(recordCronSuccess).mock.calls.length, vi.mocked(recordCronFailure).mock.calls.length]
    await afters[0]!()
    const corpos = f.mock.calls.map(c => JSON.parse((c[1] as unknown as { body: string }).body))
    expect(corpos).toHaveLength(1)
    expect(corpos[0].alvos).toEqual([{ siteId: 's1', ids: ['a1', 'a2'] }, { siteId: 's2', ids: ['b1'] }])
    expect(vi.mocked(recordCronSuccess)).toHaveBeenCalledWith('observatorio-aquecer-pedido', 'info')
    expect(saudeAntes[1]).toBe(0)
    expect(saudeAntes[0]).toBe(1) // só o sync-youtube-competitors antes do after()
    expect(vi.mocked(recordCronSuccess).mock.calls[0]).toEqual(['sync-youtube-competitors', 'info'])
    expect(await resp.json()).toMatchObject({ mode: 'competitors', synced: 2 })
    vi.unstubAllGlobals()
  })
  it('lote sem a lista de canais: pede o site inteiro; nada sincronizado: não pede', async () => {
    const f = vi.fn(async () => ok202())
    vi.stubGlobal('fetch', f)
    batch.mockResolvedValue(lote({ synced: 1, errors: 0, siteIds: ['s1'] }))
    await GET(req())
    await afters[0]!()
    expect(JSON.parse((f.mock.calls[0]![1] as unknown as { body: string }).body).alvos).toEqual([{ siteId: 's1' }])
    afters.length = 0
    batch.mockResolvedValue(lote({ synced: 0, errors: 0, siteIds: [] }))
    await GET(req())
    expect(afters).toHaveLength(0)
    vi.unstubAllGlobals()
  })
  it('caminho late (o lote não voltou): só invalida, não pede', async () => {
    batch.mockRejectedValue(new Error('competitor batch: timeout'))
    expect((await GET(req())).status).toBe(500)
    expect(afters).toHaveLength(0)
  })
})
