// @vitest-environment node
// A4 Tarefa 8: a rota `canal/[id]` ramifica pelo dono do canal. Canal próprio com vídeos monta a página própria (sem redirecionar);
// canal próprio sem vídeos é resolvido ANTES de qualquer leitura privada (D10); quem não edita o site abre a página com o token nulo;
// o id que chega aos leitores é o RESOLVIDO do canal, nunca o texto da URL; o conjunto do site só é lido neste ramo.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { Suspense, type ReactElement, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { dims, detalhe, ok as okDado } from './proprio-origem-fixture'
import type { OrigemLida } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'
import type { DiarioLongo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { OrigemView } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { proprioWorld, semVideos, umCanal, DADOS } from './proprio-fixture'
import { a3World } from './a3-fixture'
import { dmDia } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { link } from '@/lib/youtube/observatorio/links'
import type { ChannelPage, ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

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
  origem: vi.fn(async (_a: unknown): Promise<Privado<OrigemLida>> => ({ acesso: 'erro' })),
  termos: vi.fn(async (_a: unknown): Promise<Privado<DetalheCanal>> => ({ acesso: 'negado' })),
  longo: vi.fn(async (_a: unknown): Promise<Privado<DiarioLongo>> => ({ acesso: 'erro' })),
}
// só a identidade importa nesta camada (o módulo da guarda é mockado). O `siteId` NÃO é enumerável, como no token real (getter): a página passa o token a componentes
// de servidor dentro de `Suspense`, e o teste do "token nunca está nas props" serializa a árvore inteira.
const EDICAO = Object.defineProperty({}, 'siteId', { value: 'site-secreto-t8', enumerable: false }) as LeituraPrivadaDoSite

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
  lerDiarioLongo: (a: unknown) => state.longo(a),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: (a: unknown) => state.origem(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos', () => ({ lerTermosESites: (a: unknown) => state.termos(a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({ carregarExtrasProprio: (...a: unknown[]) => state.extras(...a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canal/canal-screen', () => ({ CanalScreen: () => null, CanalNotFound: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/proprio-screen', () => ({ ProprioScreen: () => null, ProprioSemVideos: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))

function cenario(o: { mundo?: typeof w; leitura?: LeituraPrivadaDoSite | null } = {}) {
  const m = o.mundo ?? wUm
  state.page = {
    siteId: 's1', now: m.obs.NOW, obs: m.obs, canEdit: o.leitura !== null, leitura: o.leitura === undefined ? EDICAO : o.leitura,
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

  it('quem não edita o site abre a página: lerDadosDoCanal é chamado com leitura null (o leitor devolve "negado")', async () => {
    cenario({ leitura: null })
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(w.canalId)
    expect(nome(el)).toBe('ProprioScreen')
    expect(state.dados).toHaveBeenCalledTimes(1)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, leitura: null, longosAcompanhados: w.ytIds })
    const view = filho(el).props.view as { header: { faixa: Array<{ key: string; value: string | null; missing: string | null }> } }
    const imp = view.header.faixa.find(c => c.key === 'impressoes')!
    expect(imp.value).toBeNull()
    expect(imp.missing).toBe('só quem edita o site vê este número')
  })

  it('quem edita: o token da página vai ao leitor, com o relógio da página; o token nunca está nas props da tela', async () => {
    const el = await rota(w.canalId)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ leitura: EDICAO, agora: w.obs.NOW })
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
    const [obs, siteId, agora, , previo] = state.extras.mock.calls[0]! as [unknown, string, number, unknown, { leitura: unknown; canalId: string; diario: unknown }]
    expect(obs).toBe(w.obs)
    expect(siteId).toBe('s1')
    expect(agora).toBe(w.obs.NOW)
    expect(previo).toMatchObject({ leitura: EDICAO, canalId: w.canalId })
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

  it('Menor 7 da revisão da T10: o elemento da leitura do nicho (aba Leitura do concorrente) leva `key`, ou o React avisa "unique key" em produção', async () => {
    const conc = w.obs.channels.find(c => !c.own)!.id
    const wc = a3World(ds => { const c = ds.channels.find(x => x.id === conc)!; c.niche = 'viagem'; ds.channels = [c]; ds.videos = ds.videos.filter(v => v.ch === conc); ds.scope = 'canal' })
    state.page = { ...state.page!, obs: wc.obs, ownYtIds: [] }
    const el = await rota(conc, { tab: 'leitura' })
    expect(nome(el)).toBe('CanalScreen')
    const leitura = filho(el).props.leitura as ReactElement
    expect(leitura).not.toBeNull()
    expect(leitura.key).not.toBeNull()
    // o ramo sem nicho também devolve elemento: a mesma regra
    const wn = a3World(ds => { const c = ds.channels.find(x => x.id === conc)!; c.niche = null; ds.channels = [c]; ds.videos = ds.videos.filter(v => v.ch === conc); ds.scope = 'canal' })
    state.page = { ...state.page!, obs: wn.obs }
    const sem = await rota(conc, { tab: 'leitura' })
    expect((filho(sem).props.leitura as ReactElement).key).not.toBeNull()
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

describe('E5b T17: a aba Origem (17b) e os cartões da aba Retenção (17a) vão em Suspense próprio', () => {
  type No = ReactElement<{ fallback: ReactElement; children: ReactElement<Record<string, unknown>> }>
  const prop = (el: ReactElement<{ children: ReactNode }>, k: 'origem' | 'periodos') => filho(el).props[k] as No | undefined
  const resolverOrigem = async (n: No) => (await (n.props.children.type as (p: unknown) => Promise<ReactElement<{ view: OrigemView }>>)(n.props.children.props)).props.view
  const diarioOrigem = (conhecida: boolean): DiarioDoPeriodo => ({ canalId: w.canalId, de: '2026-10-05', ate: '2026-10-11', linhas: [], foraDoTeto: [], descartados: 0, cobertura: { conhecida, videosCompletos: 0, videosIncompletos: 0, primeiroDiaLido: null, intervalos: new Map() } })
  const origemOk = (conhecida = false, inteiro: DiarioDoPeriodo | null = null): Privado<OrigemLida> => ({ acesso: 'ok', dado: { dimensoes: dims(), diario: diarioOrigem(conhecida), diarioInteiro: inteiro, trechos: 1 } })
  const avisos = (step: string) => vi.mocked(Sentry.captureMessage).mock.calls.filter(c => (c[1] as { tags?: { step?: string } } | undefined)?.tags?.step === step)
  const todosOsYtIds = () => wUm.obs.videos.filter(v => v.ch === wUm.canalId).map(v => v.ytId)

  beforeEach(() => {
    state.origem.mockImplementation(async () => ({ acesso: 'erro' })); state.termos.mockImplementation(async () => ({ acesso: 'negado' })); state.longo.mockImplementation(async () => ({ acesso: 'erro' }))
  })

  it('a origem e os cartões estão cada um num Suspense com o esqueleto, e nenhum leitor roda antes do primeiro HTML', async () => {
    const el = await rota(w.canalId)
    const o = prop(el, 'origem')!, p = prop(el, 'periodos')!
    expect(o.type).toBe(Suspense); expect(p.type).toBe(Suspense)
    expect((o.props.fallback.type as { name?: string }).name).toBe('OrigemEsqueleto')
    expect((p.props.fallback.type as { name?: string }).name).toBe('AssistidoEsqueleto')
    expect((o.props.children.type as { name?: string }).name).toBe('OrigemDoCanal')
    expect((p.props.children.type as { name?: string }).name).toBe('AssistidoDoCanal')
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled(); expect(state.longo).not.toHaveBeenCalled()
  })

  it('canal próprio sem prova (quem só lê): lerOrigem e lerTermosESites não são chamados e a vista é "só o aviso", sem número', async () => {
    cenario({ leitura: null })
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(w.canalId)
    expect(prop(el, 'periodos')).toBeUndefined()   // diário negado: nada para ler
    const view = await resolverOrigem(prop(el, 'origem')!)
    expect(view.nivel).toBe('so-aviso'); expect(view.periodos).toEqual([])
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled()
  })

  it('com ?tab=origem e sem prova: a mesma coisa (o aviso, nenhum número, nenhum leitor)', async () => {
    cenario({ leitura: null })
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(w.canalId, { tab: 'origem' })
    expect((filho(el).props.view as { state: { tab: string } }).state.tab).toBe('origem')
    const view = await resolverOrigem(prop(el, 'origem')!)
    expect(view.semAcesso).not.toBeNull()
    expect(state.origem).not.toHaveBeenCalled()
  })

  it('lê TODOS os vídeos do canal (Short e vídeo não acompanhado inclusive), com o token e o último dia do diário; ownYtIds não é o conjunto', async () => {
    state.origem.mockResolvedValue(origemOk()); state.termos.mockResolvedValue(okDado(detalhe()))
    const el = await rota(w.canalId)
    await resolverOrigem(prop(el, 'origem')!)
    const a = state.origem.mock.calls[0]![0] as { canalId: string; ytIds: string[]; prova: unknown; diarioDesde: string; ate: string }
    expect(a).toMatchObject({ canalId: w.canalId, prova: EDICAO })
    expect([...a.ytIds].sort()).toEqual(todosOsYtIds().sort())
    expect(a.ytIds.length).toBeGreaterThan(w.ytIds.length)   // há vídeos que não são longos acompanhados na fixture
    const t = state.termos.mock.calls[0]![0] as { ytIds: string[] }
    expect([...t.ytIds].sort()).toEqual([...a.ytIds].sort())
  })

  it('períodos: 7, 28, 90 dias e "Desde {ano}" com o ano do vídeo MAIS ANTIGO; o total longo vem do diário inteiro, e diarioInteiro nulo lê não medido sem derrubar as outras três', async () => {
    state.origem.mockResolvedValue(origemOk(true, null)); state.termos.mockResolvedValue(okDado(detalhe()))
    const el = await rota(w.canalId)
    const view = await resolverOrigem(prop(el, 'origem')!)
    const ano = new Date(Math.min(...wUm.obs.videos.filter(v => v.ch === wUm.canalId).map(v => v.pub))).getUTCFullYear()
    expect(view.periodos.map(p => p.id)).toEqual(['7', '28', '90', 'tudo'])
    expect(view.periodos[3]!.rotulo).toBe(`Desde ${ano}`)
    expect(view.periodos[3]!.grupo.total).toMatch(/^não medido/)
    // o contador público do canal nunca é o total
    const publico = String(wUm.obs.channel(wUm.canalId)!.views ?? '')
    if (publico) expect(JSON.stringify(view.periodos.map(p => p.grupo.total))).not.toContain(wUm.obs.fmt.int(Number(publico)))
  })

  it('podeEditar sai de canEdit; termos em erro para quem edita: nível tudo, bloco de termos em erro, um aviso; negados para quem só lê: sem-termos', async () => {
    state.origem.mockResolvedValue(origemOk()); state.termos.mockResolvedValue({ acesso: 'erro' })
    const v1 = await resolverOrigem(prop(await rota(w.canalId), 'origem')!)
    expect(v1.nivel).toBe('tudo')
    expect(v1.periodos[0]!.grupo.blocos.find(b => b.id === 'termos')!.estado).toBe('erro')
    expect(avisos('origem-termos')).toHaveLength(1)
    // tem a prova mas não edita: canEdit falso
    cenario({ leitura: EDICAO }); state.page = { ...state.page!, canEdit: false }
    state.termos.mockResolvedValue({ acesso: 'negado' })
    const v2 = await resolverOrigem(prop(await rota(w.canalId), 'origem')!)
    expect(v2.nivel).toBe('sem-termos')
    expect(JSON.stringify(v2)).not.toMatch(/sentinela-termo-xyz|sentinela\.example/)
  })

  it('um aviso de cobertura por requisição quando há vídeo fora ou parado (só contagens, sem id de vídeo), e nenhum com a origem em erro', async () => {
    state.origem.mockResolvedValue(origemOk(true)); state.termos.mockResolvedValue(okDado(detalhe()))
    await resolverOrigem(prop(await rota(w.canalId), 'origem')!)
    const c = avisos('origem-cobertura')
    expect(c).toHaveLength(1)
    expect(JSON.stringify(c[0])).not.toContain(todosOsYtIds()[0]!)
    vi.mocked(Sentry.captureMessage).mockClear()
    state.origem.mockResolvedValue({ acesso: 'erro' })
    await resolverOrigem(prop(await rota(w.canalId), 'origem')!)
    expect(avisos('origem-cobertura')).toHaveLength(0)
  })

  it('a aba Retenção continua lendo só os longos acompanhados (ownYtIds) e o último dia do diário, com o token', async () => {
    const el = await rota(w.canalId)
    const p = prop(el, 'periodos')!
    const vista = await (p.props.children.type as (x: unknown) => Promise<ReactElement<{ view: { estado: string } }>>)(p.props.children.props)
    expect(vista.props.view.estado).toBe('erro')   // o leitor longo do teste devolve erro
    const a = state.longo.mock.calls[0]![0] as { canalId: string; ytIds: string[]; leitura: unknown; ultimoDia: string }
    expect(a).toMatchObject({ canalId: w.canalId, leitura: EDICAO, ytIds: wUm.ytIds })
  })

  it('a página não importa o leitor do diário por período (a varredura proíbe) e a rota do concorrente não lê nada disto', async () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/canal/[id]/page.tsx'), 'utf8')
    expect(src).not.toMatch(/ler-diario-periodo|lerDiarioDoPeriodo/)
    expect("import { lerDiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'").toMatch(/ler-diario-periodo|lerDiarioDoPeriodo/)
    const conc = w.obs.channels.find(c => !c.own)!.id
    const wc = a3World(ds => { const c = ds.channels.find(x => x.id === conc)!; ds.channels = [c]; ds.videos = ds.videos.filter(v => v.ch === conc); ds.scope = 'canal' })
    state.page = { ...state.page!, obs: wc.obs, ownYtIds: [] }
    await rota(conc)
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled(); expect(state.longo).not.toHaveBeenCalled()
  })
})
