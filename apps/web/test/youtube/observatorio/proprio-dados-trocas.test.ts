// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import * as ler from '@/lib/youtube/observatorio/proprio/ler'
import * as lerAb from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import * as lerV from '@/lib/youtube/observatorio/proprio-versoes/ler'
import type { VersaoPropria, VersoesCanal } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import { lerTrocas } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas'
import { leituraDe } from './leitura-teste'

vi.mock('server-only', () => ({}))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio-versoes/ler', async orig => ({ ...(await orig<typeof lerV>()), lerVersoes: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/ler-testes-ab', async orig => ({ ...(await orig<typeof lerAb>()), lerTestesAb: vi.fn() }))
vi.mock('@/lib/youtube/observatorio/proprio/ler', async orig => ({ ...(await orig<typeof ler>()), lerAlcanceDoVideo: vi.fn() }))

const C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', U = '4f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a11', YT = 'abcdefghijk'
const HOJE = '2026-06-20'
const AGORA = Date.parse(HOJE + 'T18:00:00Z')
const meio = (d: string): string => `${d}T20:00:00.000Z`
let prova: LeituraPrivadaDoSite
beforeAll(async () => { prova = await leituraDe('site-a') })

function versao(janelaDe: string, extra: Partial<VersaoPropria> = {}): VersaoPropria {
  return {
    id: 'v' + janelaDe, ytId: YT, campo: 'title', texto: 'TITULO-SENTINELA', hash: 'h', thumb: null, primeiroDia: janelaDe, ultimoDia: janelaDe,
    vistaDesde: meio(janelaDe), vistaAte: meio(janelaDe), janela: { de: meio(janelaDe), ate: meio(addDays(janelaDe, 1)) }, precisao: '1d',
    origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, preRegistro: false, corrente: true, ...extra,
  }
}
const canal = (versoes: VersaoPropria[]): VersoesCanal => ({
  canalId: C, estado: { estado: 'registrando', desde: '2026-01-01', conferidoAte: HOJE, atrasoDias: 0 },
  videos: [{ ytId: YT, versoes, registro: { title: { estado: 'com_trocas', conferidoAte: HOJE }, thumb: { estado: 'sem_versao', conferidoAte: null }, desc: { estado: 'sem_versao', conferidoAte: null } } }],
})
const pedido = (extra: Partial<Parameters<typeof lerTrocas>[0]> = {}) => ({ canalId: C, ytId: YT, videoUuid: U, agora: AGORA, prova, ...extra })
const alcanceOk = { acesso: 'ok', dado: { alcance: { canalId: C, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 }, desde: '2026-01-01', primeiroRelatorio: null } } as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -10))]) })
  vi.mocked(lerAb.lerTestesAb).mockResolvedValue({ acesso: 'ok', dado: { testes: [], descartados: 0 } })
  vi.mocked(ler.lerAlcanceDoVideo).mockResolvedValue(alcanceOk as never)
})
const desdeChamado = () => vi.mocked(ler.lerAlcanceDoVideo).mock.calls[0]![1].desde

describe('lerTrocas', () => {
  it('sem prova: negado e o construtor do cliente de serviço não é chamado', async () => {
    expect(await lerTrocas(pedido({ prova: null }))).toEqual({ acesso: 'negado' })
    expect(getSupabaseServiceClient).not.toHaveBeenCalled()
  })
  it('vídeo sem troca que conta: lerAlcanceDoVideo NÃO é chamada e alcance é null', async () => {
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -10), { origem: 'linha_de_base' })]) })
    const r = await lerTrocas(pedido())
    expect(ler.lerAlcanceDoVideo).not.toHaveBeenCalled()
    expect(r).toMatchObject({ acesso: 'ok', dado: { alcance: null } })
  })
  it('troca com a janela começando há 6 dias: desde há 15 dias (6 + 7 + 2)', async () => {
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -6))]) })
    await lerTrocas(pedido())
    expect(desdeChamado()).toBe(addDays(HOJE, -15))
  })
  it('troca com buraco de leitura de 5 dias: o desde parte do começo da janela, não do dia em que a versão foi vista', async () => {
    const x = versao(addDays(HOJE, -8), { janela: { de: meio(addDays(HOJE, -13)), ate: meio(addDays(HOJE, -8)) } })
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([x]) })
    await lerTrocas(pedido())
    expect(desdeChamado()).toBe(addDays(HOJE, -22))
  })
  it('duas trocas: vale a mais antiga', async () => {
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -30)), versao(addDays(HOJE, -3))]) })
    await lerTrocas(pedido())
    expect(desdeChamado()).toBe(addDays(HOJE, -39))
  })
  it('troca de 500 dias atrás: desde = hoje − 400 (o teto); de 395 dias também', async () => {
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -500))]) })
    await lerTrocas(pedido())
    expect(desdeChamado()).toBe(addDays(HOJE, -400))
    vi.clearAllMocks()
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -395))]) })
    vi.mocked(lerAb.lerTestesAb).mockResolvedValue({ acesso: 'ok', dado: { testes: [], descartados: 0 } })
    vi.mocked(ler.lerAlcanceDoVideo).mockResolvedValue(alcanceOk as never)
    await lerTrocas(pedido())
    expect(desdeChamado()).toBe(addDays(HOJE, -400))
  })
  it('lerVersoes lança: erro e um aviso', async () => {
    vi.mocked(lerV.lerVersoes).mockRejectedValue(new lerV.ErroLeituraVersoes('yt_own_video_versions', 'erro_de_banco', '42501', 0))
    expect(await lerTrocas(pedido())).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('lerTestesAb lança: versões ok, testes erro, um aviso; teto e banco têm motivo próprio', async () => {
    vi.mocked(lerAb.lerTestesAb).mockRejectedValue(new ObservatoryLoadError('ab_tests', undefined, 'mais de 50 testes neste vídeo', true))
    const r = await lerTrocas(pedido())
    expect(r).toMatchObject({ acesso: 'ok', dado: { testes: { acesso: 'erro' }, motivoTestes: 'teto' } })
    if (r.acesso === 'ok') expect(r.dado.versoes.videos).toHaveLength(1)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    vi.mocked(lerAb.lerTestesAb).mockRejectedValue(new ObservatoryLoadError('ab_tests', '57014', 'timeout'))
    const r2 = await lerTrocas(pedido())
    expect(r2).toMatchObject({ acesso: 'ok', dado: { motivoTestes: 'banco' } })
    // M-4 (portão L5): o teto é o campo `teto`, nunca o texto da mensagem
    vi.mocked(lerAb.lerTestesAb).mockRejectedValue(new ObservatoryLoadError('ab_tests', undefined, 'mais de 50 testes neste vídeo'))
    expect(await lerTrocas(pedido())).toMatchObject({ acesso: 'ok', dado: { motivoTestes: 'banco' } })
  })
  it('lerAlcanceDoVideo lança: versões e testes ok, alcance erro', async () => {
    vi.mocked(ler.lerAlcanceDoVideo).mockRejectedValue(new Error('boom'))
    expect(await lerTrocas(pedido())).toMatchObject({ acesso: 'ok', dado: { alcance: { acesso: 'erro' }, testes: { acesso: 'ok' } } })
  })
  it('lerTestesAb ou lerAlcanceDoVideo devolvendo negado com a prova válida: erro daquele leitor, nunca lista vazia', async () => {
    vi.mocked(lerAb.lerTestesAb).mockResolvedValue({ acesso: 'negado' })
    vi.mocked(ler.lerAlcanceDoVideo).mockResolvedValue({ acesso: 'negado' })
    expect(await lerTrocas(pedido())).toMatchObject({ acesso: 'ok', dado: { testes: { acesso: 'erro' }, alcance: { acesso: 'erro' } } })
  })
  it('as três falham juntas: um aviso só, sem título nem endereço de imagem', async () => {
    vi.mocked(lerAb.lerTestesAb).mockRejectedValue(new Error('TITULO-SENTINELA'))
    vi.mocked(ler.lerAlcanceDoVideo).mockRejectedValue(new Error('TITULO-SENTINELA'))
    await lerTrocas(pedido())
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('SENTINELA')
    vi.clearAllMocks()
    vi.mocked(lerV.lerVersoes).mockRejectedValue(new Error('TITULO-SENTINELA'))
    vi.mocked(lerAb.lerTestesAb).mockRejectedValue(new Error('x'))
    await lerTrocas(pedido())
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).not.toContain('SENTINELA')
  })
  it('versão que conta e janela nula: erro, motivo janela_nula, um aviso', async () => {
    vi.mocked(lerV.lerVersoes).mockResolvedValue({ acesso: 'ok', dado: canal([versao(addDays(HOJE, -5), { janela: null })]) })
    expect(await lerTrocas(pedido())).toEqual({ acesso: 'erro' })
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)).toContain('janela_nula')
  })
})
void dayPt
