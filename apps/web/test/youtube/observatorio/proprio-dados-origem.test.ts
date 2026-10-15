// @vitest-environment node
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe } from './leitura-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { CONJUNTOS_DIMENSOES } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import * as dim from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { lerOrigem } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'

vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/ler-dimensoes', async orig => ({ ...(await orig<typeof dim>()), lerDimensoes: vi.fn(), lerDetalheDaOrigem: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10'
const ATE = '2026-09-30'
const AGORA = Date.parse(ATE + 'T18:00:00Z')
let leitura: LeituraPrivadaDoSite
beforeAll(async () => { leitura = await leituraDe(S) })

const diaLido = (d: string) => ({ dia: d, coberto: true, baseMedida: true, base: 1, antesDoInicio: false, desde: d, linhas: [] })
function conjuntos(ytIds: readonly string[], de: string, ate: string) {
  const dias = Array.from({ length: diffDias(de, ate) + 1 }, (_, i) => addDays(de, i))
  return Object.fromEntries(CONJUNTOS_DIMENSOES.map(c => [c, { conjunto: c, estado: { tipo: 'coletado' }, videos: ytIds.map(ytId => ({ ytId, dias: dias.map(diaLido) })) }]))
}
const linha = (yt: string, dia: string, views: number): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, avg_view_percentage: 40 })
let db: ReturnType<typeof fakeSupabase>
beforeEach(() => {
  vi.clearAllMocks()
  db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: [] })
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
  vi.mocked(dim.lerDimensoes).mockImplementation((async (_sb: unknown, p: { ytIds: string[]; de: string; ate: string }) =>
    ({ acesso: 'ok', dado: { canalId: C, de: p.de, ate: p.ate, conjuntos: conjuntos(p.ytIds, p.de, p.ate), descartados: 0 } })) as never)
})
const ids = (n: number) => Array.from({ length: n }, (_, i) => 'v' + String(i).padStart(2, '0'))
const pedido = (extra: Partial<Parameters<typeof lerOrigem>[0]> = {}) => {
  const ytIds = extra.ytIds ?? ids(2)
  return { canalId: C, ytIds, de: addDays(ATE, -6), ate: ATE, diarioDesde: addDays(ATE, -6), publicacoes: new Map(ytIds.map(y => [y, addDays(ATE, -300)] as const)), agora: AGORA, prova: leitura, ...extra }
}

describe('lerOrigem', () => {
  it('sem prova: negado e o construtor do cliente de serviço não é chamado', async () => {
    expect(await lerOrigem(pedido({ prova: null }))).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
    expect(dim.lerDimensoes).not.toHaveBeenCalled()
  })
  it('período de 7 dias: um trecho', async () => {
    const r = await lerOrigem(pedido())
    expect(r).toMatchObject({ acesso: 'ok', dado: { trechos: 1 } })
    expect(dim.lerDimensoes).toHaveBeenCalledTimes(1)
  })
  it('período de 300 dias: três trechos, juntados sem dia repetido nem faltando', async () => {
    const r = await lerOrigem(pedido({ de: addDays(ATE, -299), ytIds: ['v00'] }))
    if (r.acesso !== 'ok') throw new Error(r.acesso)
    expect(r.dado.trechos).toBe(3)
    const dias = r.dado.dimensoes.conjuntos.trafego.videos[0]!.dias.map(d => d.dia)
    expect(dias).toHaveLength(300)
    expect(new Set(dias).size).toBe(300)
    expect(dias).toEqual([...dias].sort())
    expect(dias[0]).toBe(addDays(ATE, -299))
    expect(dias[299]).toBe(ATE)
  })
  it('60 vídeos: dois lotes nas dimensões e dois lotes em cada um dos dois diários', async () => {
    const todos = ids(60)
    await lerOrigem(pedido({ ytIds: todos }))
    expect(vi.mocked(dim.lerDimensoes)).toHaveBeenCalledTimes(2)
    expect(db.trips.filter(t => t === 'yt_own_video_daily')).toHaveLength(4)
  })
  it('o diário inteiro é lido com de nulo e soComViews, com os mesmos ytIds das dimensões', async () => {
    db = fakeSupabase({ yt_own_video_daily: [linha('v00', addDays(ATE, -100), 7), linha('v00', addDays(ATE, -2), 0), linha('v00', addDays(ATE, -3), 5)], yt_own_video_coverage: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
    const r = await lerOrigem(pedido({ ytIds: ['v00'] }))
    if (r.acesso !== 'ok') throw new Error(r.acesso)
    expect(r.dado.diarioInteiro?.linhas.map(l => l.views)).toEqual([7, 5])
    expect(r.dado.diario.linhas.map(l => l.views)).toEqual([5])
    expect(vi.mocked(dim.lerDimensoes).mock.calls[0]![1]).toMatchObject({ ytIds: ['v00'] })
  })
  it('o diário inteiro passa do teto: diarioInteiro nulo, um aviso, e as dimensões e o diário curto continuam', async () => {
    const muitas = Array.from({ length: 10_100 }, (_, i) => linha('v00', addDays('1990-01-01', i), 1))
    db = fakeSupabase({ yt_own_video_daily: muitas, yt_own_video_coverage: [] })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
    const r = await lerOrigem(pedido({ ytIds: ['v00'], diarioDesde: addDays(ATE, -6) }))
    if (r.acesso !== 'ok') throw new Error(r.acesso)
    expect(r.dado.diarioInteiro).toBeNull()
    expect(r.dado.dimensoes.conjuntos.trafego.videos).toHaveLength(1)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('13 chamadas: lança por dentro, vira erro com um aviso, e nada é lido', async () => {
    const r = await lerOrigem(pedido({ ytIds: ids(60), de: addDays(ATE, -120 * 7 + 1) }))
    expect(r).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(dim.lerDimensoes).not.toHaveBeenCalled()
  })
  it('um trecho falha: erro, um aviso só, sem conteúdo do banco', async () => {
    let n = 0
    vi.mocked(dim.lerDimensoes).mockImplementation((async () => { if (++n === 2) throw new dim.ErroLeituraDimensoes('yt_own_video_dim_daily', 'erro_de_banco', '57014', 0); return { acesso: 'ok', dado: { canalId: C, de: ATE, ate: ATE, conjuntos: conjuntos([], ATE, ATE), descartados: 0 } } }) as never)
    const r = await lerOrigem(pedido({ de: addDays(ATE, -299), ytIds: ['v00'] }))
    expect(r).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls[0])).toContain('57014')
  })
  it('início depois do fim: o RangeError vira erro com um aviso, nunca lista vazia', async () => {
    const r = await lerOrigem(pedido({ de: addDays(ATE, 3) }))
    expect(r).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('falha no diário curto é erro do grupo', async () => {
    db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: [] }, { failOn: 'yt_own_video_daily' })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
    expect(await lerOrigem(pedido())).toEqual({ acesso: 'erro' })
  })
  it('o limite de 2 chamadas em voo', async () => {
    let voo = 0, pico = 0
    vi.mocked(dim.lerDimensoes).mockImplementation((async (_s: unknown, p: { ytIds: string[]; de: string; ate: string }) => {
      pico = Math.max(pico, ++voo); await new Promise(r => setTimeout(r, 5)); voo--
      return { acesso: 'ok', dado: { canalId: C, de: p.de, ate: p.ate, conjuntos: conjuntos(p.ytIds, p.de, p.ate), descartados: 0 } }
    }) as never)
    await lerOrigem(pedido({ ytIds: ids(60), de: addDays(ATE, -299) }))
    expect(pico).toBe(2)
  })
})
