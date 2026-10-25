// @vitest-environment node
// S8-F4 T8: encerrarComPrazo (tabela de saídas) e rede de segurança v2 do ab-evaluate.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { settle } = vi.hoisted(() => ({ settle: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/youtube/ab-settle', () => ({ ORIGINAL: 'original', settleOnAir: settle }))

import * as Sentry from '@sentry/nextjs'
import { encerrarComPrazo, phaseEvaluateActiveTests, SETTLE_MINIMO_MS, FIM_DA_AVALIACAO_MS } from '@/lib/youtube/ab-evaluate-phases'

const DIA = 86_400_000
const AGORA = new Date('2026-10-24T15:00:00Z')
const ha = (dias: number) => new Date(AGORA.getTime() - dias * DIA).toISOString()

type Ciclo = { id: string; test_id: string; variant_id: string; cycle_number: number; started_at: string; ended_at: string | null }
const ciclo = (n: number, ini: number, fim: number | null, testId = 't1'): Ciclo => ({
  id: `c${testId}${n}`, test_id: testId, variant_id: n % 2 === 0 ? 'A' : 'B', cycle_number: n, started_at: ha(ini), ended_at: fim === null ? null : ha(fim),
})

function teste(id: string, max: number | undefined, regra: 'v1' | 'v2' = 'v2') {
  return { id, site_id: 'site-1', config: max === undefined ? {} : { max_duration_days: max }, started_at: ha(30), created_at: ha(30), regra_duracao: regra }
}

function cliente(tests: ReturnType<typeof teste>[], ciclos: Ciclo[], rpcRetorno: { data: unknown; error: unknown } | ((nome: string, a: Record<string, unknown>) => { data: unknown; error: unknown }) = { data: 1, error: null }) {
  const rpc = vi.fn((nome: string, args: Record<string, unknown>) =>
    Promise.resolve(typeof rpcRetorno === 'function' ? rpcRetorno(nome, args) : rpcRetorno))
  const from = vi.fn((tabela: string) => {
    if (tabela === 'ab_tests') return { select: () => ({ eq: () => Promise.resolve({ data: tests, error: null }) }) }
    if (tabela === 'ab_test_cycles') {
      return { select: () => ({ in: (_c: string, ids: string[]) => ({ order: () => ({ range: (de: number, ate: number) =>
        Promise.resolve({ data: ciclos.filter(c => ids.includes(c.test_id)).slice(de, ate + 1), error: null }) }) }) }) }
    }
    return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }
  })
  return { supabase: { from, rpc } as unknown as Parameters<typeof phaseEvaluateActiveTests>[0], rpc }
}

const feito = (extra: Record<string, unknown> = {}, campos: Record<string, unknown> = {}) => ({ resultado: 'feito', campos, ...extra })

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  settle.mockResolvedValue(feito())
})
afterEach(() => { vi.useRealTimers() })

describe('encerrarComPrazo: tabela de saídas', () => {
  const t = [{ id: 't1', site_id: 'site-1' }]
  const caso = (nome: string, ret: unknown, esperado: string, erro?: string) => it(`settleOnAir ${nome} => ${esperado}`, async () => {
    settle.mockResolvedValue(ret)
    const r = await encerrarComPrazo(t, 'regra_v2', Date.now())
    expect(r).toEqual([{ testId: 't1', resultado: esperado, ...(erro ? { erro } : {}) }])
    expect(settle).toHaveBeenCalledWith('t1', expect.objectContaining({ siteId: 'site-1', destino: 'original', motivo: 'regra_v2', prazo: expect.any(Number) }))
  })
  caso('feito', feito(), 'feito')
  caso('feito + campo falhou', feito({}, { thumbnail: { estado: 'falhou' } }), 'nao_voltou')
  caso('feito + campo desistiu', feito({}, { title: { estado: 'desistiu' } }), 'nao_voltou')
  caso('feito + pausadoPorTesteYoutube', feito({ pausadoPorTesteYoutube: true }), 'pausado_teste_youtube')
  caso('em_andamento', { resultado: 'em_andamento', campos: null }, 'outro_escritor')
  caso('mudou', { resultado: 'mudou', campos: null }, 'outro_escritor')
  caso('ja_encerrado', { resultado: 'ja_encerrado', campos: null }, 'ja_encerrado')
  for (const lit of ['precisa_confirmar', 'destino_invalido', 'outro_teste', 'sem_permissao', 'teste_youtube']) {
    caso(lit, { resultado: lit, campos: null }, 'erro', lit)
  }

  it('exceção => erro, e não derruba o seguinte', async () => {
    settle.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(feito())
    const r = await encerrarComPrazo([{ id: 't1', site_id: 's' }, { id: 't2', site_id: 's' }], 'regra_v2', Date.now())
    expect(r).toEqual([{ testId: 't1', resultado: 'erro', erro: 'boom' }, { testId: 't2', resultado: 'feito' }])
  })

  it('relógio injetado com 50 s gastos: settle não começa, adiado por tempo', async () => {
    let agora = 1_000_000
    const r = await encerrarComPrazo(t, 'duracao_maxima', agora - (FIM_DA_AVALIACAO_MS - SETTLE_MINIMO_MS + 10_000), () => agora)
    expect(r).toEqual([{ testId: 't1', resultado: 'adiado_por_tempo' }])
    expect(settle).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).toHaveBeenCalled()
    agora += 0
  })
})

describe('rede de segurança v2', () => {
  const ontemV2 = (dias: number) => [ciclo(0, dias, null)] // ciclo aberto há `dias` dias => relógio = dias

  it('retrato parado, relógio 17 com teto 14: grava rede_tentou_em antes, encerra e grava inconclusivo_por_falha', async () => {
    const c = cliente([teste('t1', 14)], ontemV2(17))
    const r = await phaseEvaluateActiveTests(c.supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 1, errors: 0 })
    expect(c.rpc).toHaveBeenCalledTimes(2)
    const [a1, a2] = c.rpc.mock.calls
    expect(a1![1]).toMatchObject({ p_test_id: 't1', p_v2: { rede_tentou_em: expect.any(String) } })
    expect(settle.mock.invocationCallOrder[0]!).toBeGreaterThan(c.rpc.mock.invocationCallOrder[0]!)
    expect(settle).toHaveBeenCalledWith('t1', expect.objectContaining({ motivo: 'regra_v2' }))
    const v2 = (a2![1] as { p_v2: Record<string, unknown>; p_hist: Array<{ desfecho: string }> })
    expect(v2.p_v2).toMatchObject({ desfecho: 'inconclusivo_por_falha', desfecho_no_encerramento: 'inconclusivo_por_falha', provisorio: false, desfecho_final: 'inconclusivo_por_falha', encerrado_em_dia: '2026-10-23' })
    expect(v2.p_hist).toEqual([{ em: AGORA.toISOString(), desfecho: 'inconclusivo_por_falha' }])
  })

  it('relógio 15 com teto 14 (< 17): pula', async () => {
    const c = cliente([teste('t1', 14)], ontemV2(15))
    expect(await phaseEvaluateActiveTests(c.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(settle).not.toHaveBeenCalled()
    expect(c.rpc).not.toHaveBeenCalled()
  })

  it('pausa de 5 dias: 22 dias corridos mas relógio 12 (ms = 17): não encerra', async () => {
    const c = cliente([teste('t1', 14)], [ciclo(0, 22, 17), ciclo(1, 6, null)])
    expect(await phaseEvaluateActiveTests(c.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(settle).not.toHaveBeenCalled()
  })

  it('config sem max_duration_days usa 14', async () => {
    const c = cliente([teste('t1', undefined)], ontemV2(17))
    expect((await phaseEvaluateActiveTests(c.supabase)).resolved).toBe(1)
  })

  it('RPC devolvendo -1 no desfecho: errors++ e Sentry', async () => {
    let n = 0
    const c = cliente([teste('t1', 14)], ontemV2(17), () => ({ data: ++n === 1 ? 1 : -1, error: null }))
    const r = await phaseEvaluateActiveTests(c.supabase)
    expect(r.errors).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('rede + pausadoPorTesteYoutube: nenhuma chamada ao RPC de desfecho (só a rede_tentou_em)', async () => {
    settle.mockResolvedValue(feito({ pausadoPorTesteYoutube: true }))
    const c = cliente([teste('t1', 14)], ontemV2(17))
    const r = await phaseEvaluateActiveTests(c.supabase)
    expect(r).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(c.rpc).toHaveBeenCalledTimes(1)
    expect(c.rpc.mock.calls[0]![1]).toMatchObject({ p_v2: { rede_tentou_em: expect.any(String) } })
  })

  it('feito com nao_voltou: grava o desfecho (o teste fechou) e conta erro', async () => {
    settle.mockResolvedValue(feito({}, { thumbnail: { estado: 'falhou' } }))
    const c = cliente([teste('t1', 14)], ontemV2(17))
    const r = await phaseEvaluateActiveTests(c.supabase)
    expect(r.errors).toBe(1)
    expect(c.rpc).toHaveBeenCalledTimes(2)
    const g = c.rpc.mock.calls.find(([n, a]) => n === 'ab_test_v2_gravar' && (a as { p_v2: Record<string, unknown> }).p_v2.desfecho)
    expect((g![1] as { p_v2: { volta_falhou: unknown } }).p_v2.volta_falhou).toEqual({ em: expect.any(String) })
  })

  it('feito sem nao_voltou: não grava volta_falhou', async () => {
    const c = cliente([teste('t1', 14)], ontemV2(17))
    await phaseEvaluateActiveTests(c.supabase)
    const g = c.rpc.mock.calls.find(([n, a]) => n === 'ab_test_v2_gravar' && (a as { p_v2: Record<string, unknown> }).p_v2.desfecho)
    expect((g![1] as { p_v2: Record<string, unknown> }).p_v2).not.toHaveProperty('volta_falhou')
  })

  it('outro_escritor e ja_encerrado: não gravam desfecho nem contam erro', async () => {
    settle.mockResolvedValue({ resultado: 'em_andamento', campos: null })
    const c = cliente([teste('t1', 14)], ontemV2(17))
    expect(await phaseEvaluateActiveTests(c.supabase)).toEqual({ evaluated: 1, resolved: 0, errors: 0 })
    expect(c.rpc).toHaveBeenCalledTimes(1)
  })

  it('saída erro (sem_permissao): errors++ e Sentry', async () => {
    settle.mockResolvedValue({ resultado: 'sem_permissao', campos: null })
    const c = cliente([teste('t1', 14)], ontemV2(17))
    expect((await phaseEvaluateActiveTests(c.supabase)).errors).toBe(1)
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('exceção num teste não derruba os outros', async () => {
    settle.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(feito())
    const c = cliente([teste('t1', 14), teste('t2', 14)], [ciclo(0, 17, null, 't1'), ciclo(0, 17, null, 't2')])
    const r = await phaseEvaluateActiveTests(c.supabase)
    expect(r).toEqual({ evaluated: 2, resolved: 1, errors: 1 })
    expect(settle).toHaveBeenCalledTimes(2)
  })

  it('ativo v2 sem ciclo aberto: Sentry', async () => {
    const c = cliente([teste('t1', 14)], [ciclo(0, 5, 3)])
    await phaseEvaluateActiveTests(c.supabase)
    expect(Sentry.captureMessage).toHaveBeenCalledWith(expect.stringContaining('sem ciclo aberto'), expect.anything())
  })

  it('teste v1 não passa pela rede (não lê ciclos)', async () => {
    const c = cliente([teste('t1', 90, 'v1')], [])
    await phaseEvaluateActiveTests(c.supabase)
    expect(settle).not.toHaveBeenCalled()
  })
})
