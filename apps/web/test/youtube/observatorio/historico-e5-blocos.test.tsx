// @vitest-environment node
// A5 · E5a, Tarefa 21c (mockup 13): o componente de servidor `BlocosDoVideo` e a página do vídeo (ramo do concorrente).
// `await BlocosDoVideo(props)` devolve o `HistoricoScreen` como elemento; os blocos de servidor (props `antesDoGrafico` e `depoisDoGrafico`) são
// renderizados à parte. A página é afirmada na árvore de `await Page(props)`.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Suspense, isValidElement, type ReactElement, type ReactNode } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canalWorld } from './canal-fixture'

const mocks = vi.hoisted(() => ({
  carregar: vi.fn(),
  servico: vi.fn(() => ({ from: vi.fn() })),
  montarVideo: vi.fn(),
  completar: vi.fn(),
  doConjunto: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: mocks.servico }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-canal', () => ({ carregarMedidasDoCanalInteiro: mocks.carregar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/montar', () => ({ montarVideo: mocks.montarVideo, assistidoDoVideo: vi.fn(), origemDoVideo: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu', () => ({ ownMenuOf: () => [] }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/medidas/estourou-leitura', () => ({ leituraSemConsulta: () => null, lerLeituraDoVideo: vi.fn(), lerLeituraDoConjunto: mocks.doConjunto }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-video', () => ({ completarVideoForaDaJanela: mocks.completar }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/contexto-ia-actions', () => ({ gerarPacoteIa: vi.fn() }))

import { buildHistoricoView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { BlocosDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/blocos-do-video'
import { HistoricoScreen } from '@/app/cms/(authed)/youtube/competitors/_historico/historico-screen'
import HistoricoPage from '@/app/cms/(authed)/youtube/competitors/video/[id]/page'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { IObservatorioDeMedidas } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'

const COMP = path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors')
const { obs, ds } = canalWorld()
const FULL = 'matt-opus55'
const video = obs.videos.find((v) => v.id === FULL)!
const view = buildHistoricoView(obs, FULL, {})
const AGORA = ds.now

const naoLida = { lido: false as const, causa: 'erro_do_banco' as const }
/** Um conjunto do canal com a base lida e nada mais: as partes de série, mudanças e horas entram por parâmetro. */
function canal(over: Partial<CanalInteiro> = {}): CanalInteiro {
  return {
    medidas: { porFormato: {}, m3a: {}, m8: {}, porVideo: new Map(), falhas: [] } as unknown as CanalInteiro['medidas'],
    videos: { lido: true, dados: [] }, retratos: { lido: true, dados: [] },
    marcas: { lido: true, dados: { marcas: new Map(), faltas: new Map() } },
    serie: naoLida, mudancas: naoLida, horas: naoLida, falhas: [], esgotou: [], ...over,
  }
}
const props = (extra: Record<string, unknown> = {}) => ({
  obterSb: () => ({}) as SupabaseClient, siteId: 's1', obs: obs as unknown as IObservatorioDeMedidas, agoraMs: AGORA, view, video, linkSaiu: null, ...extra,
})
const html = (n: ReactNode) => renderToStaticMarkup(<>{n}</>)
const tela = async (extra: Record<string, unknown> = {}) => (await BlocosDoVideo(props(extra))) as ReactElement<Record<string, ReactNode | boolean | undefined>>

beforeEach(() => {
  mocks.carregar.mockReset(); mocks.servico.mockClear(); mocks.montarVideo.mockReset(); mocks.doConjunto.mockReset()
  // por padrão o vídeo está dentro da janela: o conjunto segue como veio
  mocks.completar.mockReset(); mocks.completar.mockImplementation(async (_sb: unknown, c: CanalInteiro) => ({ canal: c, semLeitura: {}, leituraExtra: false }))
})

describe('BlocosDoVideo', () => {
  it('devolve o HistoricoScreen (cliente) com os acréscimos como dado e os blocos como elemento; a leitura é UMA, do canal do vídeo, com série, mudanças e horas', async () => {
    mocks.carregar.mockResolvedValue(canal())
    const el = await tela()
    expect(el.type).toBe(HistoricoScreen)
    expect(el.props.acrescimos).toBeTruthy()
    expect(mocks.carregar).toHaveBeenCalledTimes(1)
    expect(mocks.carregar.mock.calls[0]![1]).toMatchObject({ channelId: video.ch, agoraMs: AGORA, pedir: { serie: true, mudancas: true, horas: true } })
  })

  it('vídeo fora da janela: a leitura só dele entra (o conjunto completado vai a derivarDoVideo) e o que falhou vira "não carregou", nunca "nenhuma mudança"', async () => {
    const c = canal({ serie: { lido: true, dados: new Map() }, mudancas: { lido: true, dados: new Map() } })
    mocks.carregar.mockResolvedValue(c)
    mocks.completar.mockResolvedValue({ canal: c, semLeitura: { serie: true, mudancas: true }, leituraExtra: false })
    const el = await tela()
    expect(mocks.completar).toHaveBeenCalledTimes(1)
    expect(mocks.completar.mock.calls[0]![2]).toMatchObject({ siteId: 's1', channelId: video.ch, video: { id: video.id, publicadoEmMs: video.pub } })
    const depois = html(el.props.depoisDoGrafico)
    expect(depois).toContain('data-mudancas="nao_carregou"')
    expect(depois).not.toMatch(/nenhuma mudan/i)
    expect(el.props.acrescimos).toBeTruthy()
  })

  it('"Estourou e parou" pedido como "ler" sai do conjunto lido, sem leitura própria: lerLeituraDoConjunto recebe o conjunto ORIGINAL (sem a sobreposição do vídeo)', async () => {
    const c = canal()
    mocks.carregar.mockResolvedValue(c)
    mocks.completar.mockResolvedValue({ canal: { ...c }, semLeitura: {}, leituraExtra: true })
    mocks.doConjunto.mockResolvedValue(null)
    await tela({ estourou: 'ler' })
    expect(mocks.doConjunto).toHaveBeenCalledTimes(1)
    expect(mocks.doConjunto.mock.calls[0]![0]).toMatchObject({ c, siteId: 's1', videoId: video.id })
  })

  it('o conjunto do canal falhou: devolve o estado de erro (não lança) e nenhum bloco', async () => {
    mocks.carregar.mockResolvedValue(canal({ medidas: { naoCarregou: 'erro_do_banco' } }))
    const el = await tela()
    expect(el.type).toBe(HistoricoScreen)
    expect(el.props.erro).toBe(true)
    expect(el.props.antesDoGrafico).toBeUndefined()
  })

  it('só a série não foi lida: os blocos de idade e de dias dizem "não carregou", e a tela (versões, comparação, fixar) segue de pé', async () => {
    mocks.carregar.mockResolvedValue(canal())
    const el = await tela()
    expect(el.props.erro).toBeFalsy()
    const antes = html(el.props.antesDoGrafico)
    expect(antes).toContain('Views por idade')
    expect(antes).toContain('falhou')
    expect(antes).toContain('data-dias="nao_carregou"')
    expect(html(el.props.depoisDoGrafico)).toContain('Mudanças deste vídeo')
  })

  it('mudanças não lidas nunca viram "nenhuma mudança"', async () => {
    mocks.carregar.mockResolvedValue(canal())
    const depois = html((await tela()).props.depoisDoGrafico)
    expect(depois).toContain('data-mudancas="nao_carregou"')
    expect(depois).not.toMatch(/nenhuma mudan/i)
  })

  it('o bloco "Estourou e parou" aparece uma vez, depois de "Views por idade" e antes das 72 horas; a seção de baixo vem por último', async () => {
    mocks.carregar.mockResolvedValue(canal())
    const el = await tela({ estourou: <div id="estourou">ESTOUROU</div>, depois: <div id="ultimo">ULTIMO</div> })
    const a = html(el.props.antesDoGrafico)
    expect(a.split('id="estourou"').length - 1).toBe(1)
    expect(a.indexOf('Views por idade')).toBeLessThan(a.indexOf('id="estourou"'))
    expect(a.indexOf('id="estourou"')).toBeLessThan(a.indexOf('As primeiras 72 horas'))
    const d = html(el.props.depoisDoGrafico)
    expect(d.indexOf('Mudanças deste vídeo')).toBeLessThan(d.indexOf('id="ultimo"'))
    // e o "Estourou" não é passado duas vezes à tela
    expect(el.props.estourou).toBeUndefined()
  })

  it('as cinco ações chegam por prop e seguem para a tela; o bloco não importa ação de servidor', async () => {
    mocks.carregar.mockResolvedValue(canal())
    const acoes = { onAskForja: vi.fn(), onCancelForja: vi.fn(), onSyncChannel: vi.fn(), onPin: vi.fn(), onUnpin: vi.fn(), pagerNaTrilha: true }
    const el = await tela(acoes)
    for (const [k, v] of Object.entries(acoes)) expect(el.props[k], k).toBe(v)
    const fonte = fs.readFileSync(path.join(COMP, '_historico/medidas/blocos-do-video.tsx'), 'utf8')
    expect(fonte).not.toMatch(/from '[^']*(forja-actions|\/actions|contexto-ia-actions)'/)
    expect(fonte).not.toContain('next/link')
    expect(fonte).not.toContain('getSupabaseServiceClient')
  })

  it('o vídeo que saiu do YouTube: sem "Abrir no YouTube" no cabeçalho e o botão da fila só com o link', async () => {
    const saiuEm = new Date(AGORA - 5 * 864e5).toISOString()
    const base = { id: FULL, videoId: video.ytId, publishedAt: new Date(video.pub).toISOString(), liveActualStartAt: null, liveBroadcastContent: 'none', wasLive: false, isShort: false, durationSeconds: null, viewCount: 1, likeCount: null, commentCount: null, likesHidden: null, commentsDisabled: null, viewsHidden: null, discoveredAt: new Date(video.pub).toISOString(), missingSince: saiuEm, seriesTier: 'diaria' as const, lastCheckedAt: null }
    mocks.carregar.mockResolvedValue(canal({ videos: { lido: true, dados: [base] } }))
    const sem = await tela()
    const c = sem.props.cabecalhoDoSaiu as unknown as { abrirNoYoutube: boolean; botaoDaFila: unknown; semLink: string | null }
    expect(c.abrirNoYoutube).toBe(false)
    expect(c.semLink).toContain('Sem link')
    expect(c.botaoDaFila).toBeNull()
    const com = (await tela({ linkSaiu: { href: '/x/saiu' } })).props.cabecalhoDoSaiu as unknown as { botaoDaFila: { href: string } | null }
    expect(com.botaoDaFila!.href).toBe('/x/saiu')
  })
})

// ───── a página ─────
function achar(n: ReactNode, pred: (e: ReactElement<{ children?: ReactNode }>) => boolean): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(n)) { for (const f of n) { const r = achar(f, pred); if (r) return r } return null }
  if (!isValidElement(n)) return null
  const e = n as ReactElement<{ children?: ReactNode }>
  if (pred(e)) return e as ReactElement<Record<string, unknown>>
  return achar(e.props.children, pred)
}
const paginaCom = (v: typeof view) => {
  mocks.montarVideo.mockResolvedValue({ tipo: 'concorrente', pagina: { obs, meuCanalLembrado: null, siteId: 's1', now: AGORA }, view: v })
  return HistoricoPage({ params: Promise.resolve({ id: v.video?.id ?? 'x' }), searchParams: Promise.resolve({}) })
}

describe('a página do vídeo de concorrente', () => {
  it('o Suspense leva a key do vídeo, a reserva é o HistoricoScreen com carregando (título de verdade) e o filho é o BlocosDoVideo', async () => {
    const arvore = await paginaCom(view)
    const susp = achar(arvore, (e) => e.type === Suspense)
    expect(susp).not.toBeNull()
    expect(susp!.key).toBe(FULL)
    const reserva = (susp!.props as { fallback: ReactElement<Record<string, unknown>> }).fallback
    expect(reserva.type).toBe(HistoricoScreen)
    expect(reserva.props.carregando).toBe(true)
    expect((reserva.props.view as typeof view).video!.title).toBe(view.video!.title)
    const filho = (susp!.props as { children: ReactElement<Record<string, unknown>> }).children
    expect(filho.type).toBe(BlocosDoVideo)
    // as cinco ações chegam por prop da página, às duas montagens
    for (const k of ['onAskForja', 'onCancelForja', 'onSyncChannel', 'onPin', 'onUnpin']) { expect(typeof reserva.props[k]).toBe('function'); expect(filho.props[k]).toBe(reserva.props[k]) }
  })

  it('vídeo de outro site na URL ("não encontrado"): nenhum Suspense, nenhuma leitura de medidas e o cliente de serviço nem é pedido', async () => {
    const naoAchou = buildHistoricoView(obs, 'id-que-nao-existe-neste-site', {})
    expect(naoAchou.notFound).not.toBeNull()
    const arvore = await paginaCom(naoAchou)
    expect(achar(arvore, (e) => e.type === Suspense)).toBeNull()
    expect(achar(arvore, (e) => e.type === HistoricoScreen)).not.toBeNull()
    expect(mocks.carregar).not.toHaveBeenCalled()
    expect(mocks.servico).not.toHaveBeenCalled()
  })

  it('a página faz uma leitura de série, não duas: só o BlocosDoVideo chama o leitor (a página não o importa)', () => {
    const fonte = fs.readFileSync(path.join(COMP, 'video/[id]/page.tsx'), 'utf8')
    expect(fonte).not.toContain('carregarMedidasDoCanalInteiro')
    expect(fonte).toContain('<Suspense key={doMotor.id}')
  })

  it('nenhum next/link nem componente importado passa como prop para HistoricoScreen: só dado, ações e elementos prontos', () => {
    for (const f of ['video/[id]/page.tsx', '_historico/medidas/blocos-do-video.tsx']) {
      const fonte = fs.readFileSync(path.join(COMP, f), 'utf8')
      expect(fonte, f).not.toContain("from 'next/link'")
      for (const m of fonte.matchAll(/<HistoricoScreen([^>]*)\/>/g)) expect(m[1], f).not.toMatch(/=\{[A-Z][A-Za-z]*\}/)
    }
  })
})
