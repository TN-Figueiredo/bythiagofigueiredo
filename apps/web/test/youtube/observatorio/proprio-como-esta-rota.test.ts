// @vitest-environment node
// A4 Tarefa 10: a rota `canal/[id]` passa a seção "Como o canal está" para a página própria (`comoEsta` do ProprioScreen). Prova o que só a rota decide: o
// `painel` vem da URL (`1`, `0` ou nenhum), o id que a seção recebe é o RESOLVIDO, o dado é o MESMO que o cabeçalho leu (uma leitura só), os concorrentes do
// formulário vêm do conjunto do SITE, e sem permissão ou com a leitura falha nenhum número privado chega ao navegador nas props da seção.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { DADOS, proprioWorld, semVideos, umCanal } from './proprio-fixture'
import type { Dataset, UndatedVideo } from '@/lib/youtube/observatorio/types'
import type { ChannelPage, ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

const SEM_DATA: UndatedVideo = { id: 'u1', ytId: 'yt-u1', title: 'Sem data', url: 'https://youtu.be/yt-u1', isShort: false, dur: 600, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null }
const w = proprioWorld() // o conjunto do SITE (openObservatoryPage)
const wUm = proprioWorld({ mut: umCanal }) // o conjunto de UM canal (openChannelPage), como em produção
const wSem = proprioWorld({ mut: ds => { semVideos(ds); umCanal(ds) } })
const soSemData = proprioWorld({ mut: (ds: Dataset) => {
  const id = ds.channels.filter(c => c.own)[0]!.id
  ds.videos = ds.videos.filter(v => v.ch !== id)
  ds.channels.find(c => c.id === id)!.undated = [SEM_DATA]
  umCanal(ds)
} })
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const state = {
  page: null as ChannelPage | null,
  site: null as ObservatoryPage<undefined> | null,
  dados: vi.fn(async (_a: unknown) => w.dados),
  abrirSite: vi.fn(),
  extras: vi.fn(async (..._a: unknown[]) => undefined),
}
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openChannelPage: async () => state.page,
  openObservatoryPage: async () => { state.abrirSite(); return state.site },
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  lerDadosDoCanal: (a: unknown) => state.dados(a),
  longosAcompanhadosDe: () => [],
  podeVerPrivado: async () => null,
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({ carregarExtrasProprio: (...a: unknown[]) => state.extras(...a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/canal-screen', () => ({ CanalScreen: () => null, CanalNotFound: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/proprio-screen', () => ({ ProprioScreen: () => null, ProprioSemVideos: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))

function cenario(m: typeof w, obs: ChannelPage['obs'] = m.obs) {
  state.page = { siteId: 's1', now: m.obs.NOW, obs, canEdit: true, leitura: null, ownYtIds: m.ytIds, meuCanalLembrado: null, owns: OWNS }
  state.site = { siteId: 's1', now: w.obs.NOW, rows: {} as ObservatoryPage<undefined>['rows'], obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }
}
beforeEach(() => { vi.clearAllMocks(); state.dados.mockImplementation(async () => w.dados) })

type Secao = { key: string | null; type: { name?: string }; props: { view: { recolhida: string; frase: string; top: Array<{ id: string; titulo: string }>; noNicho: { opcoes: Array<{ id: string }> } | null }; grafico: { colunas: unknown[]; vazio: string | null }; painel: string | null; canalId: string } }
async function secaoDe(id: string, sp: Record<string, string | string[]> = {}) {
  const { default: CanalPage } = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
  const el = (await CanalPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp as Record<string, string>) })) as ReactElement<{ children: ReactElement<{ comoEsta?: Secao }> }>
  return { el, secao: el.props.children.props.comoEsta }
}

describe('T10 a rota monta a seção', () => {
  it('a página própria recebe `comoEsta` = a seção, recolhida (painel nulo) e com o id resolvido do canal', async () => {
    cenario(wUm)
    const { secao } = await secaoDe(w.canalId)
    expect(secao).toBeDefined()
    expect(secao!.type.name).toBe('ComoEsta')
    expect(secao!.props.painel).toBeNull()
    expect(secao!.props.canalId).toBe(w.canalId)
    expect(secao!.props.view.recolhida).toContain('187 impressões e 24 cliques estimados em 19 dos 21 dias.')
    expect(secao!.props.view.top.length).toBeGreaterThan(0)
    expect(secao!.props.grafico.colunas).toHaveLength(21)
  })

  it('o elemento da seção leva `key` (sem ela o React avisa "Each child in a list should have a unique key" no ProprioScreen e os testes de console do navegador caem)', async () => {
    cenario(wUm)
    const { secao } = await secaoDe(w.canalId)
    expect(secao!.key).toBe(w.canalId)
  })

  it('o id que a seção recebe é o RESOLVIDO (a URL pode vir em outra caixa)', async () => {
    cenario(wUm)
    const { secao } = await secaoDe(w.canalId.toUpperCase())
    expect(secao!.props.canalId).toBe(w.canalId)
  })

  it('?painel=1 e ?painel=0 chegam à seção; qualquer outro valor é "nenhum"; vale o primeiro valor repetido', async () => {
    cenario(wUm)
    expect((await secaoDe(w.canalId, { painel: '1' })).secao!.props.painel).toBe('1')
    expect((await secaoDe(w.canalId, { painel: '0' })).secao!.props.painel).toBe('0')
    expect((await secaoDe(w.canalId, { painel: 'sim' })).secao!.props.painel).toBeNull()
    expect((await secaoDe(w.canalId, { painel: '' })).secao!.props.painel).toBeNull()
    expect((await secaoDe(w.canalId, { painel: ['1', '0'] })).secao!.props.painel).toBe('1')
  })

  it('o dado privado é lido UMA vez (o do cabeçalho): a seção e o gráfico saem dele, sem segunda leitura', async () => {
    cenario(wUm)
    await secaoDe(w.canalId)
    expect(state.dados).toHaveBeenCalledTimes(1)
  })

  it('o formulário "Comparar com…" oferece só concorrentes do conjunto do SITE (nunca o próprio canal) e o logo acima primeiro', async () => {
    cenario(wUm)
    const { secao } = await secaoDe(w.canalId)
    const ops = secao!.props.view.noNicho!.opcoes.map(o => o.id)
    expect(ops.length).toBeGreaterThan(1)
    expect(ops).not.toContain(w.canalId)
    for (const id of ops) expect(w.obs.channel(id)!.own).toBe(false)
  })

  it('sem permissão: as props da seção não carregam número, série nem título de vídeo do dado privado', async () => {
    cenario(wUm)
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const { secao } = await secaoDe(w.canalId)
    const json = JSON.stringify(secao!.props)
    expect(secao!.props.view.frase).toBe('Só quem edita o site vê as impressões.')
    expect(secao!.props.view.top).toEqual([])
    expect(secao!.props.grafico.colunas).toEqual([])
    expect(json).not.toMatch(/\d+ impress/)
    for (const v of w.obs.videos.filter(x => x.ch === w.canalId).slice(0, 5)) expect(json).not.toContain(v.title)
  })

  it('banco sem relatório (o local): a seção diz "Ainda não há relatório de alcance deste canal." e o gráfico também', async () => {
    cenario(wUm)
    state.dados.mockImplementation(async () => ({ alcance: { acesso: 'ok' as const, dado: { canalId: w.canalId, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 } }, diario: w.dados.diario }))
    const { secao } = await secaoDe(w.canalId)
    expect(secao!.props.view.frase).toBe('Ainda não há relatório de alcance deste canal.')
    expect(secao!.props.grafico.vazio).toBe('Ainda não há relatório de alcance deste canal.')
  })

  it('as props da seção são dados simples (nada de função, nada de componente): atravessam o limite servidor/cliente', async () => {
    cenario(wUm)
    const { secao } = await secaoDe(w.canalId)
    expect(JSON.parse(JSON.stringify(secao!.props))).toEqual(secao!.props)
  })

  it('canal próprio SEM vídeos: nenhuma seção (a moldura nem lê o dado privado)', async () => {
    cenario(wSem)
    const { el, secao } = await secaoDe(wSem.canalId)
    expect(secao).toBeUndefined()
    expect(((el.props.children as ReactElement).type as { name?: string }).name).toBe('ProprioSemVideos')
    expect(state.dados).not.toHaveBeenCalled()
  })

  it('canal só com vídeo sem data: tem página e a seção (o critério único)', async () => {
    cenario(soSemData)
    const { secao } = await secaoDe(soSemData.canalId)
    expect(secao!.type.name).toBe('ComoEsta')
    expect(secao!.props.canalId).toBe(soSemData.canalId)
  })
})
