// @vitest-environment node
// A4 Tarefa 8: a rota `canal/[id]` ramifica pelo dono do canal. Canal próprio com vídeos monta a página própria (sem redirecionar);
// canal próprio sem vídeos é resolvido ANTES de qualquer leitura privada (D10); quem não edita o site abre a página com o token nulo;
// o id que chega aos leitores é o RESOLVIDO do canal, nunca o texto da URL; o conjunto do site só é lido neste ramo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { proprioWorld, semVideos, umCanal, DADOS } from './proprio-fixture'
import { a3World } from './a3-fixture'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { link } from '@/lib/youtube/observatorio/links'
import type { ChannelPage, ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import type { EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'

const w = proprioWorld() // o conjunto do SITE (openObservatoryPage)
const wUm = proprioWorld({ mut: umCanal }) // o conjunto de UM canal (openChannelPage), como em produção: ownChannels() lança nele
const wSem = proprioWorld({ mut: ds => { semVideos(ds); umCanal(ds) } })
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const state = {
  page: null as ChannelPage | null,
  site: null as ObservatoryPage<undefined> | null,
  dados: vi.fn(async (_a: unknown) => w.dados),
  abrirSite: vi.fn(),
  extras: vi.fn(async (..._a: unknown[]) => undefined),
}
const EDICAO = { siteId: 'site-secreto-t8' } as unknown as EdicaoDoSite // só a identidade importa nesta camada (o módulo da guarda é mockado)

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

function cenario(o: { mundo?: typeof w; edicao?: EdicaoDoSite | null } = {}) {
  const m = o.mundo ?? wUm
  state.page = {
    siteId: 's1', now: m.obs.NOW, obs: m.obs, canEdit: o.edicao !== null, edicao: o.edicao === undefined ? EDICAO : o.edicao,
    ownYtIds: m.ytIds, meuCanalLembrado: null, owns: OWNS,
  }
  state.site = { siteId: 's1', now: m.obs.NOW, rows: {} as ObservatoryPage<undefined>['rows'], obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }
}

async function rota(id: string, sp: Record<string, string> = {}) {
  const { default: CanalPage } = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
  return (await CanalPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp) })) as ReactElement<{ crumbs: Array<{ text: string; href?: string }>; owns: OwnMenu; children: ReactElement<Record<string, unknown>> }>
}
const filho = (el: ReactElement<{ children: ReactNode }>) => el.props.children as ReactElement<Record<string, unknown>>
const nome = (el: ReactElement<{ children: ReactNode }>) => (filho(el).type as { name?: string }).name

beforeEach(() => { vi.clearAllMocks(); state.dados.mockImplementation(async () => w.dados); cenario() })

describe('T8 rota canal/[id] do canal próprio', () => {
  it('canal próprio com vídeos: a rota NÃO redireciona; a trilha é "Canais › <nome>" e a tela é a própria', async () => {
    const el = await rota(w.canalId)
    expect(el.props.crumbs).toEqual([{ text: 'Canais', href: link.canais() }, { text: w.obs.channel(w.canalId)!.name }])
    expect(nome(el)).toBe('ProprioScreen')
    expect(el.props.owns).toBe(OWNS)
    const view = filho(el).props.view as { header: { name: string; id: string }; state: { sort: string } }
    expect(view.header.id).toBe(w.canalId)
  })

  it('o estado da URL é lido como canal próprio: ?sort=imp&tab=retencao chegam à tela', async () => {
    const el = await rota(w.canalId, { sort: 'imp', tab: 'retencao' })
    const view = filho(el).props.view as { state: { sort: string; tab: string } }
    expect(view.state).toMatchObject({ sort: 'imp', tab: 'retencao' })
  })

  it('canal próprio SEM vídeos: status 200, a moldura com a frase de D10 e o atalho "Meu canal"; NENHUMA leitura das tabelas privadas', async () => {
    cenario({ mundo: wSem })
    const el = await rota(wSem.canalId)
    expect(el.props.crumbs).toEqual([{ text: 'Canais', href: link.canais() }, { text: wSem.obs.channel(wSem.canalId)!.name }])
    expect(el.props.owns).toBe(OWNS)
    expect(nome(el)).toBe('ProprioSemVideos')
    expect(filho(el).props.canaisHref).toBe(link.canais())
    expect(state.dados).not.toHaveBeenCalled()
    expect(state.abrirSite).not.toHaveBeenCalled()
    expect(state.extras).not.toHaveBeenCalled()
  })

  it('quem não edita o site abre a página: lerDadosDoCanal é chamado com edicao null (o leitor devolve "negado")', async () => {
    cenario({ edicao: null })
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(w.canalId)
    expect(nome(el)).toBe('ProprioScreen')
    expect(state.dados).toHaveBeenCalledTimes(1)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, edicao: null, longosAcompanhados: w.ytIds })
    const view = filho(el).props.view as { header: { faixa: Array<{ key: string; value: string | null; missing: string | null }> } }
    const imp = view.header.faixa.find(c => c.key === 'impressoes')!
    expect(imp.value).toBeNull()
    expect(imp.missing).toBe('só quem edita o site vê este número')
  })

  it('quem edita: o token da página vai ao leitor, com o relógio da página; o token nunca está nas props da tela', async () => {
    const el = await rota(w.canalId)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ edicao: EDICAO, agora: w.obs.NOW })
    expect(JSON.stringify(filho(el).props)).not.toContain('site-secreto-t8')
  })

  it('o id que chega ao leitor é o RESOLVIDO do canal, nunca o texto da URL (maiúsculas, espaços)', async () => {
    await rota(w.canalId.toUpperCase())
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId })
  })

  it('o conjunto do site é lido só neste ramo e as posições vêm dele: o leitor das posições recebe o token e o diário já lido', async () => {
    await rota(w.canalId)
    expect(state.abrirSite).toHaveBeenCalledTimes(1)
    expect(state.extras).toHaveBeenCalledTimes(1)
    const [obs, siteId, agora, , previo] = state.extras.mock.calls[0]! as [unknown, string, number, unknown, { edicao: unknown; canalId: string; diario: unknown }]
    expect(obs).toBe(w.obs)
    expect(siteId).toBe('s1')
    expect(agora).toBe(w.obs.NOW)
    expect(previo).toMatchObject({ edicao: EDICAO, canalId: w.canalId })
    expect(previo.diario).toBe(w.dados.diario)
  })

  it('a leitura que FALHA lança (a error.tsx da rota aparece): o erro nunca vira canal vazio (D5)', async () => {
    state.dados.mockRejectedValueOnce(new Error('banco fora'))
    await expect(rota(w.canalId)).rejects.toThrow('banco fora')
  })

  it('canal de concorrente: continua na página do concorrente (CanalScreen), sem tocar o dado privado nem o conjunto do site', async () => {
    const conc = w.obs.channels.find(c => !c.own)!.id
    const wc = a3World(ds => { const c = ds.channels.find(x => x.id === conc)!; ds.channels = [c]; ds.videos = ds.videos.filter(v => v.ch === conc); ds.scope = 'canal' })
    state.page = { ...state.page!, obs: wc.obs, ownYtIds: [] }
    const el = await rota(conc)
    expect(nome(el)).toBe('CanalScreen')
    expect(el.props.crumbs.map(c => c.text)).toEqual(['Canais', wc.obs.channel(conc)!.name])
    expect(state.dados).not.toHaveBeenCalled()
    expect(state.extras).not.toHaveBeenCalled()
    expect(state.abrirSite).not.toHaveBeenCalledTimes(1) // só a aba Leitura lê o conjunto do site, e só com nicho
  })

  it('id que não é canal do site: "Canal não encontrado" dentro da moldura, sem leitura privada', async () => {
    const el = await rota('nao-existe')
    expect(el.props.crumbs.map(c => c.text)).toEqual(['Canais', 'Canal não encontrado'])
    expect(state.dados).not.toHaveBeenCalled()
  })

  it('o relógio do dado privado é o dia do YouTube da página e o formatador de dia é o do dm', () => {
    expect(dmDia(w.hoje)).toMatch(/^\d\d\/\d\d$/)
  })
})
