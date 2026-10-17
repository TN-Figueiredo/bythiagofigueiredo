// @vitest-environment node
// A4 Tarefa 11: a rota `video/[id]` ramifica pelo dono do canal do vídeo, decidido no SERVIDOR a partir do canal resolvido (nunca de parâmetro da URL).
// Vídeo de canal próprio abre a tela nova; vídeo de concorrente continua abrindo o Histórico, sem tocar o dado privado; id desconhecido continua
// "Vídeo não encontrado" na moldura (status 200); quem só lê o site abre a página sem os números privados.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Suspense, type ReactElement, type ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { dims, detalhe, ok as okDado } from './proprio-origem-fixture'
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { OrigemView } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { proprioWorld, primeiroProprio, DADOS } from './proprio-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView, historicoTrail } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import type { ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { provarLeituraPrivada, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { DadosDoCanal, DadosDoVideo, DiarioLongo } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { OrigemLida } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'
import type { DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { VideoBlocosView } from '@/app/cms/(authed)/youtube/competitors/_proprio/video-blocos-model'

const w = proprioWorld({
  mut: ds => {
    // T13.0 H7: um vídeo de CONCORRENTE sem data (guardado, mas sem data de publicação)
    ds.channels.find(c => !c.own)!.undated.push({ id: 'conc-sem-data-1', ytId: 'ytcsd1', title: 'Concorrente sem data', url: 'https://youtu.be/ytcsd1', isShort: false, dur: 90, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null })
    primeiroProprio(ds).undated.push({ id: 'sem-data-1', ytId: 'ytsd1', title: 'Sem data', url: 'https://youtu.be/ytsd1', isShort: false, dur: 125, views: 50, likes: 5, comments: 1, pinned: false, checkedAt: null })
  },
})
const proprioVideo = w.obs.videos.find(v => v.ch === w.canalId)!
const concorrente = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!
// o token é o REAL (o que nasce em `provarLeituraPrivada`, com a guarda de edição simulada a dizer sim): nada de objeto forjado com cast
const guarda = vi.hoisted(() => ({ ok: true }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (guarda.ok ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
const EDICAO: LeituraPrivadaDoSite = await (async () => {
  const t = await provarLeituraPrivada('site-secreto-t11')
  if (!t) throw new Error('a fixture esperava o token de edição')
  return t
})()
/** O que `lerDadosDoVideo` devolve a partir do cenário da fixture (dois `Privado` separados): lido, negado ou erro. */
function paraVideo(d: DadosDoCanal): Privado<DadosDoVideo> {
  if (d.alcance.acesso === 'ok' && d.diario.acesso === 'ok') return { acesso: 'ok', dado: { alcance: d.alcance.dado, diario: d.diario.dado } }
  return { acesso: d.alcance.acesso === 'erro' || d.diario.acesso === 'erro' ? 'erro' : 'negado' }
}
const addDaysT = (d: string, n: number): string => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const state = {
  abrir: vi.fn(),
  leitura: vi.fn(async (_s: string): Promise<LeituraPrivadaDoSite | null> => EDICAO),
  dados: vi.fn(async (_a: unknown) => w.dados),
  /** o que a página sabe de quem pede: edita ou só lê (com o token). */
  edita: true,
  origem: vi.fn(async (_a: unknown): Promise<Privado<OrigemLida>> => ({ acesso: 'erro' })),
  termos: vi.fn(async (_a: unknown): Promise<Privado<DetalheCanal>> => ({ acesso: 'negado' })),
  longo: vi.fn(async (_a: unknown): Promise<Privado<DiarioLongo>> => ({ acesso: 'erro' })),
  swipe: vi.fn(async () => []),
  /** o que `lerTrocas` devolve: por padrão negado (a maioria dos testes não olha as trocas). */
  trocas: vi.fn(async (_a: unknown): Promise<unknown> => ({ acesso: 'negado' })),
  /** `buildProprioVideoBase` da vez: por padrão o de verdade (a factory do mock o guarda em `real`); um teste troca para simular o cartão que não se achou. */
  base: vi.fn(),
  real: { base: null as null | typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/video-model').buildProprioVideoBase },
}

vi.mock('server-only', () => ({}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => { state.abrir(); return { siteId: 's1', now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined } satisfies Omit<ObservatoryPage<undefined>, 'rows'> & { rows: object } },
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_chrome/own-menu')>()), ownMenuOf: () => OWNS }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async (s: string) => { const leitura = await state.leitura(s); return { leitura, edita: leitura != null && state.edita, negativa: null } },
  lerDadosDoVideo: async (a: unknown) => paraVideo(await state.dados(a)),
  lerDiarioLongo: (a: unknown) => state.longo(a),
  longosAcompanhadosDe: (_obs: unknown, id: string) => ['yt-longos-de-' + id],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas', () => ({ lerTrocas: (a: unknown) => state.trocas(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: (a: unknown) => state.origem(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos', () => ({ lerTermosESites: (a: unknown) => state.termos(a) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: () => state.swipe() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/video-model', async orig => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/video-model')>()
  state.real.base = m.buildProprioVideoBase
  return { ...m, buildProprioVideoBase: (...a: Parameters<typeof m.buildProprioVideoBase>) => state.base(...a) }
})
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/medidas/blocos-do-video', () => import('./blocos-sincronos'))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/historico-screen', () => ({ HistoricoScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/video-screen', () => ({ ProprioVideoScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))

type Moldura = ReactElement<{ crumbs: Array<{ text: string; href?: string; voltaAoCanal?: string }>; owns: OwnMenu; aside?: ReactElement<{ pager: { prev: string | null; next: string | null; position: string } | null }>; children: ReactElement<Record<string, unknown>> }>
async function rota(id: string, sp: Record<string, string> = {}) {
  const { default: VideoPage } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
  return (await VideoPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp) })) as Moldura
}
const filho = (el: Moldura) => { const c = el.props.children as ReactElement<{ fallback?: ReactElement }>; return (c.type === Suspense ? c.props.fallback : c) as Moldura['props']['children'] } // concorrente: a tela vem num Suspense (21c); a reserva leva a mesma view
/** O modelo dos blocos que a rota monta no servidor e entrega ao `VideoBlocos` (a única coisa privada que desce). */
const blocos = (el: Moldura): VideoBlocosView => (filho(el).props.children as ReactElement<{ view: VideoBlocosView }>).props.view
const nome = (el: Moldura) => (filho(el).type as { name?: string }).name

beforeEach(() => {
  vi.clearAllMocks()
  state.leitura.mockImplementation(async () => EDICAO)
  state.edita = true
  state.origem.mockImplementation(async () => ({ acesso: 'erro' }))
  state.termos.mockImplementation(async () => ({ acesso: 'negado' }))
  state.dados.mockImplementation(async () => w.dados)
  state.trocas.mockImplementation(async () => ({ acesso: 'negado' }))
  state.base.mockImplementation((...a: Parameters<NonNullable<typeof state.real.base>>) => state.real.base!(...a))
})

describe('T11 rota video/[id]: o dono do canal decide', () => {
  it('vídeo de canal próprio abre a tela nova, com a trilha "Canais › canal › Vídeo", o pager na trilha e o atalho "Meu canal"', async () => {
    const el = await rota(proprioVideo.id, { from: 'canais', canal: w.canalId, back: '?sort=imp' })
    expect(nome(el)).toBe('ProprioVideoScreen')
    expect(el.props.crumbs.map(c => c.text)).toEqual(['Canais', w.obs.channel(w.canalId)!.name, 'Vídeo'])
    expect(el.props.crumbs[1]).toMatchObject({ href: link.canal(w.canalId) + '?sort=imp', voltaAoCanal: w.canalId })
    expect(el.props.owns).toBe(OWNS)
    expect((el.props.aside!.type as { name?: string }).name).toBe('Pager')
    expect(el.props.aside!.props.pager!.position).toMatch(/^vídeo \d+ de \d+, /)
    const p = filho(el).props as { header: { id: string; faixa: unknown[] }; pager: unknown; fromCanal: string | null }
    expect(p.header.id).toBe(proprioVideo.id); expect(p.header.faixa).toHaveLength(6)
    expect(p.fromCanal).toBe(w.canalId)
    expect(p.pager).toBe(el.props.aside!.props.pager)
  })

  it('o dado privado do canal INTEIRO é lido com o token da página e o id RESOLVIDO do canal do vídeo (nunca texto da URL)', async () => {
    await rota(proprioVideo.id, { canal: 'texto-da-url' })
    expect(state.leitura).toHaveBeenCalledTimes(1); expect(state.leitura).toHaveBeenCalledWith('s1')
    expect(state.dados).toHaveBeenCalledTimes(1)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, ytId: proprioVideo.ytId, leitura: EDICAO, agora: w.obs.NOW, longosAcompanhados: ['yt-longos-de-' + w.canalId] })
  })

  it('vídeo de concorrente continua abrindo o Histórico, igual a hoje: mesma view, mesma trilha, pede só a prova de leitura (C3) e NÃO toca o dado privado', async () => {
    const el = await rota(concorrente.id, { from: 'canais', canal: concorrente.ch })
    expect(nome(el)).toBe('HistoricoScreen')
    const esperado = buildHistoricoView(w.obs, concorrente.id, { from: 'canais', canal: concorrente.ch, niche: 'todos' })
    expect(el.props.crumbs).toEqual(historicoTrail(esperado.crumbs))
    expect((filho(el).props as { view: { video: { id: string } } }).view.video.id).toBe(concorrente.id)
    // C3: a seção de comentários pede a prova de leitura UMA vez (nunca a de edição como decisão); o dado privado continua intocado
    expect(state.leitura).toHaveBeenCalledTimes(1); expect(state.dados).not.toHaveBeenCalled()
  })

  it('a decisão NÃO vem da URL: ?canal=<canal próprio> num vídeo de concorrente continua no Histórico; ?canal=<concorrente> num vídeo próprio continua na tela nova', async () => {
    expect(nome(await rota(concorrente.id, { from: 'canais', canal: w.canalId }))).toBe('HistoricoScreen')
    expect(nome(await rota(proprioVideo.id, { from: 'canais', canal: concorrente.ch }))).toBe('ProprioVideoScreen')
    expect(nome(await rota(proprioVideo.id, { from: 'outliers' }))).toBe('ProprioVideoScreen')
  })

  it('id desconhecido (ou de outro site, ou que saiu do canal) continua "Vídeo não encontrado" na moldura, sem leitura privada', async () => {
    for (const id of ['nao-existe', 'x\'; drop table', '<script>', 'ffffffff-ffff-ffff-ffff-ffffffffffff']) {
      const el = await rota(id)
      expect(nome(el), id).toBe('HistoricoScreen')
      expect((filho(el).props as { view: { state: string; video: unknown } }).view).toMatchObject({ state: 'not-found', video: null })
    }
    expect(state.leitura).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })

  it('vídeo próprio SEM data abre a tela nova (faixa sem múltiplo, pager apagado dos dois lados)', async () => {
    const el = await rota('sem-data-1')
    expect(nome(el)).toBe('ProprioVideoScreen')
    const p = filho(el).props as { header: { semData: boolean } }
    expect(p.header.semData).toBe(true)
    expect(el.props.aside!.props.pager).toMatchObject({ prev: null, next: null })
  })
})

describe('T11 rota: quem só lê o site, e a leitura que falha', () => {
  it('sem permissão de edição: a página abre; o leitor recebe leitura null (devolve "negado"); a frase certa; nenhum dado privado nas props', async () => {
    state.leitura.mockImplementation(async () => null)
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(proprioVideo.id)
    expect(nome(el)).toBe('ProprioVideoScreen')
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, leitura: null })
    const view = blocos(el)
    expect(view).toMatchObject({ acesso: 'negado', views: null, impressoes: null, assistido: null })
    expect(view.nota).toBe('Só quem edita o site vê as views por dia, as impressões e cliques, o % assistido e a posição deste vídeo nessas medidas.')
    const cheio = JSON.stringify(filho(el).props)
    expect(cheio).not.toMatch(/"imp"|"ctr"|relatorios|"diario"|"alcance"|"cliques"/)
  })

  it('quem edita: o token nunca está nas props que vão ao navegador', async () => {
    const el = await rota(proprioVideo.id)
    expect(JSON.stringify(filho(el).props)).not.toContain('site-secreto-t11')
    expect(JSON.stringify(el.props.aside!.props)).not.toContain('site-secreto-t11')
  })

  it('a guarda de edição que falha (null) é como não ter permissão: nenhuma exceção sobe', async () => {
    state.leitura.mockImplementation(async () => null)
    await expect(rota(proprioVideo.id)).resolves.toBeTruthy()
  })

  it('a leitura que FALHA lança (a error.tsx da rota aparece): o erro nunca vira um vídeo sem alcance (D5)', async () => {
    state.dados.mockRejectedValueOnce(new Error('banco fora'))
    await expect(rota(proprioVideo.id)).rejects.toThrow('banco fora')
  })

  it('canal próprio sem relatório: a frase do estado, sem número', async () => {
    state.dados.mockImplementation(async () => DADOS.vazio(w.canalId, w.ytIds, w.hoje))
    // um vídeo com mais de 3 dias: o vídeo novo (tela A) mostra a faixa de 7 casas mesmo sem relatório, e este caso é o do vídeo que já devia ter alcance
    const velho = w.obs.videos.filter(v => v.ch === w.canalId).sort((a, b) => a.pub - b.pub)[0]!
    const el = await rota(velho.id)
    expect(blocos(el).impressoes).toMatchObject({ medido: false, grafico: null, taxa: null, frase: 'Ainda não há relatório de alcance deste canal.' })
    expect(blocos(el).assistido!.partes.map(p => p.t).join('')).toBe('A coleta diária ainda não rodou: sem ela não há % assistido.')
  })
})

describe('T13.0 H5/H7/H8 rota: título, concorrente sem data, modelo antes do dado', () => {
  it('H5: a aba do navegador diz "Vídeo · Competidores" para o vídeo próprio e continua "Histórico do vídeo · Competidores" para o resto', async () => {
    const { generateMetadata } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
    expect(await generateMetadata({ params: Promise.resolve({ id: proprioVideo.id }) })).toEqual({ title: 'Vídeo · Competidores' })
    expect(await generateMetadata({ params: Promise.resolve({ id: 'sem-data-1' }) })).toEqual({ title: 'Vídeo · Competidores' })
    expect(await generateMetadata({ params: Promise.resolve({ id: concorrente.id }) })).toEqual({ title: 'Histórico do vídeo · Competidores' })
    expect(await generateMetadata({ params: Promise.resolve({ id: 'nao-existe' }) })).toEqual({ title: 'Histórico do vídeo · Competidores' })
    // o título não lê dado privado nem pede a guarda de edição
    expect(state.leitura).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })

  it('H7: vídeo de CONCORRENTE sem data continua "Vídeo não encontrado" na moldura (como em produção), sem tocar a guarda nem o dado privado', async () => {
    const { canalProprioDoVideo } = await import('@/app/cms/(authed)/youtube/competitors/_proprio/video-model')
    expect(canalProprioDoVideo(w.obs, 'conc-sem-data-1')).toBeNull()
    const el = await rota('conc-sem-data-1', { from: 'canais' })
    expect(nome(el)).toBe('HistoricoScreen')
    expect((filho(el).props as { view: { state: string; video: unknown } }).view).toMatchObject({ state: 'not-found', video: null })
    expect(state.leitura).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })

  it('H8: o modelo da página nasce ANTES de qualquer leitura privada (a guarda e o diário só rodam com o modelo na mão)', async () => {
    await rota(proprioVideo.id)
    expect(state.base).toHaveBeenCalledTimes(1)
    expect(state.base.mock.invocationCallOrder[0]!).toBeLessThan(state.leitura.mock.invocationCallOrder[0]!)
    expect(state.base.mock.invocationCallOrder[0]!).toBeLessThan(state.dados.mock.invocationCallOrder[0]!)
  })

  it('H8: se o modelo não se acha para um vídeo próprio, a rota LANÇA (nunca cai no Histórico) e nenhum dado privado foi lido', async () => {
    state.base.mockImplementation(() => null)
    await expect(rota(proprioVideo.id)).rejects.toThrow(/vídeo próprio/i)
    expect(state.leitura).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })
})


describe('E5b T16 (b), tela B: os cartões de % assistido por período vão em Suspense próprio', () => {
  type Periodos = ReactElement<{ fallback: ReactElement; children: ReactElement<{ canalId: string; ytId: string; ytIds: string[]; diario: { ultimoDia: string | null } }> }>
  const periodosDe = (el: Moldura) => (filho(el).props.children as ReactElement<{ periodos?: Periodos }>).props.periodos

  it('os cartões de período estão dentro de outro Suspense, com o esqueleto como fallback, e o bloco não espera a leitura (nenhum leitor do diário longo roda na rota)', async () => {
    const el = await rota(proprioVideo.id)
    const p = periodosDe(el)!
    expect(p.type).toBe(Suspense)
    expect((p.props.fallback.type as { name?: string }).name).toBe('AssistidoEsqueleto')
    expect((p.props.children.type as { name?: string }).name).toBe('AssistidoDoVideo')
    expect(p.props.children.props).toMatchObject({ canalId: w.canalId, ytId: proprioVideo.ytId })
    expect(state.longo).not.toHaveBeenCalled()
  })

  it('o componente do Suspense lê com o token, o último dia do diário e os OUTROS vídeos do canal (nunca o da tela)', async () => {
    const el = await rota(proprioVideo.id)
    const filhoP = periodosDe(el)!.props.children
    state.longo.mockResolvedValueOnce({ acesso: 'erro' })
    const vista = await (filhoP.type as (p: unknown) => Promise<ReactElement<{ view: { estado: string } }>>)(filhoP.props)
    expect(vista.props.view.estado).toBe('erro')
    expect(state.longo).toHaveBeenCalledTimes(1)
    const a = state.longo.mock.calls[0]![0] as { canalId: string; ytIds: string[]; ultimoDia: string; leitura: unknown; agora: number }
    expect(a).toMatchObject({ canalId: w.canalId, leitura: EDICAO, agora: w.obs.NOW, ultimoDia: filhoP.props.diario.ultimoDia })
    expect(a.ytIds).not.toContain(proprioVideo.ytId)
    expect(a.ytIds).toEqual(['yt-longos-de-' + w.canalId])
  })

  it('canal sem diário (sem último dia): o componente nem chama o leitor e os cartões dizem que a coleta não rodou', async () => {
    state.dados.mockImplementation(async () => DADOS.vazio(w.canalId, w.ytIds, w.hoje))
    const el = await rota(proprioVideo.id)
    const filhoP = periodosDe(el)!.props.children
    const vista = await (filhoP.type as (p: unknown) => Promise<ReactElement<{ view: { estado: string; conteudos: { inteiro: { frase: { texto: string } } } } }>>)(filhoP.props)
    expect(state.longo).not.toHaveBeenCalled()
    expect(vista.props.view.estado).toBe('ok')
    expect(vista.props.view.conteudos.inteiro.frase.texto).toMatch(/coleta diária ainda não rodou/)
  })

  it('quem só lê o site: o nó dos cartões nem existe e o leitor longo não roda; vídeo de concorrente não lê nada disto', async () => {
    state.leitura.mockImplementation(async () => null)
    state.dados.mockImplementation(async () => ({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }))
    expect(periodosDe(await rota(proprioVideo.id))).toBeUndefined()
    state.leitura.mockImplementation(async () => EDICAO)
    const el = await rota(concorrente.id)
    expect(nome(el)).toBe('HistoricoScreen')
    expect(state.longo).not.toHaveBeenCalled()
  })
})

describe('E5b T16 (d), "De onde vêm as views": a origem vai em Suspense próprio', () => {
  type No = ReactElement<{ fallback: ReactElement; children: ReactElement<Record<string, unknown>> }>
  /** o vídeo MAIS ANTIGO do canal: com 3 dias ou mais de vida a origem não é "ainda não existe" (a fixture tem vídeos de hoje). */
  const velho = w.obs.videos.filter(v => v.ch === w.canalId).sort((x, y) => x.pub - y.pub)[0]!
  const origemDe = (el: Moldura) => (filho(el).props.children as ReactElement<{ origem?: No }>).props.origem
  const resolver = async (n: No) => (await (n.props.children.type as (p: unknown) => Promise<ReactElement<{ view: OrigemView }>>)(n.props.children.props)).props.view
  const diarioOrigem = (conhecida: boolean): DiarioDoPeriodo => ({ canalId: w.canalId, de: '2026-10-05', ate: '2026-10-11', linhas: [], foraDoTeto: [], descartados: 0, cobertura: { conhecida, videosCompletos: 0, videosIncompletos: 0, primeiroDiaLido: null, intervalos: new Map(), ytIds: [velho.ytId], publicacoes: new Map([[velho.ytId, null]]) } })
  /** as dimensões da fixture com o ytId do vídeo da tela (a fixture usa 'v1'): sem isso o vídeo da tela seria "fora da conta" em todo bloco */
  const dimsDo = (yt: string) => { const d = dims(); for (const k of Object.keys(d.conjuntos) as Array<keyof typeof d.conjuntos>) d.conjuntos[k] = { ...d.conjuntos[k], videos: d.conjuntos[k].videos.map(v => ({ ...v, ytId: yt })) } as never; return d }
  const origemOk = (conhecida = false, yt = velho.ytId): Privado<OrigemLida> => ({ acesso: 'ok', dado: { dimensoes: dimsDo(yt), diario: diarioOrigem(conhecida), diarioInteiro: null, motivoInteiro: 'erro', trechos: 1 } })
  const avisos = (step: string) => vi.mocked(Sentry.captureMessage).mock.calls.filter(c => (c[1] as { tags?: { step?: string } } | undefined)?.tags?.step === step)

  it('o grupo está dentro de um Suspense com o esqueleto; a leitura não roda antes do primeiro HTML', async () => {
    const o = origemDe(await rota(proprioVideo.id))!
    expect(o.type).toBe(Suspense)
    expect((o.props.fallback.type as { name?: string }).name).toBe('OrigemEsqueleto')
    expect((o.props.children.type as { name?: string }).name).toBe('OrigemDoVideo')
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled()
  })

  it('quem edita: lê só o vídeo da tela, com o token, a janela de 7 dias (ou desde a publicação) e o último dia do diário; nível tudo', async () => {
    state.origem.mockResolvedValue(origemOk()); state.termos.mockResolvedValue(okDado(detalhe()))
    const o = origemDe(await rota(velho.id))!
    const view = await resolver(o)
    expect(view.nivel).toBe('tudo')
    expect(view.periodos.map(p => p.id)).toEqual(['7', 'tudo'])  // vídeo antigo: "Desde a publicação" é oferecido
    const a = state.origem.mock.calls[0]![0] as { canalId: string; ytIds: string[]; de: string; ate: string; diarioDesde: string; prova: unknown; publicacoes: Map<string, string | null> }
    expect(a).toMatchObject({ canalId: w.canalId, ytIds: [velho.ytId], prova: EDICAO })
    expect(a.diarioDesde).toBe(addDaysT(a.ate, -6))
    expect(a.publicacoes.has(velho.ytId)).toBe(true)
    expect(state.termos).toHaveBeenCalledTimes(1)
    expect((state.termos.mock.calls[0]![0] as { ytIds: string[] }).ytIds).toEqual([velho.ytId])
  })

  it('sem a prova de leitura: nível so-aviso, nenhum leitor roda e a vista não leva número nem termo', async () => {
    state.leitura.mockImplementation(async () => null)
    state.dados.mockImplementation(async () => ({ alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }))
    const o = origemDe(await rota(proprioVideo.id))!
    const view = await resolver(o)
    expect(view.nivel).toBe('so-aviso'); expect(view.periodos).toEqual([]); expect(view.semAcesso).not.toBeNull()
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled()
    expect(JSON.stringify(view)).not.toMatch(/sentinela|73519/)
  })

  it('quem só lê (tem a prova e não edita): termos negados dão o nível sem-termos, a origem aparece e o termo não', async () => {
    state.edita = false
    state.origem.mockResolvedValue(origemOk()); state.termos.mockResolvedValue({ acesso: 'negado' })
    const view = await resolver(origemDe(await rota(proprioVideo.id))!)
    expect(view.nivel).toBe('sem-termos')
    expect(JSON.stringify(view)).not.toMatch(/sentinela-termo-xyz|sentinela\.example/)
    expect(view.periodos.length).toBeGreaterThan(0)
  })

  it('quem edita e a leitura dos termos falha (erro, ou negado): nível tudo, bloco de termos em erro, um aviso, e o HTML não diz "só aparecem para quem edita"', async () => {
    for (const falha of [{ acesso: 'erro' }, { acesso: 'negado' }] as const) {
      vi.mocked(Sentry.captureMessage).mockClear()
      state.origem.mockResolvedValue(origemOk()); state.termos.mockResolvedValue(falha)
      const view = await resolver(origemDe(await rota(velho.id))!)
      expect(view.nivel, falha.acesso).toBe('tudo')
      const termos = view.periodos[0]!.grupo.blocos.find(b => b.id === 'termos')!
      expect(termos.estado).toBe('erro')
      expect(JSON.stringify(view)).not.toMatch(/só aparecem para quem edita/)
      expect(avisos('origem-termos')).toHaveLength(1)
    }
  })

  it('vídeo fora da conta: UM aviso de cobertura na requisição, só com contagens (sem id de vídeo); origem em erro (nenhum bloco com contagem): nenhum', async () => {
    state.origem.mockResolvedValue(origemOk(true)); state.termos.mockResolvedValue(okDado(detalhe()))
    await resolver(origemDe(await rota(velho.id))!)
    const c = avisos('origem-cobertura')
    expect(c).toHaveLength(1)
    expect(JSON.stringify(c[0])).not.toContain(velho.ytId)
    expect((c[0]![1] as { extra: Record<string, unknown> }).extra).toEqual({ periodosComVideoForaOuParado: expect.any(Number), blocosComContagem: expect.any(Number) })
    vi.mocked(Sentry.captureMessage).mockClear()
    state.origem.mockResolvedValue({ acesso: 'erro' })  // sem bloco nenhum: sem contagem (o caso "cobertura inteira" é do teste do modelo, que controla as datas)
    await resolver(origemDe(await rota(velho.id))!)
    expect(avisos('origem-cobertura')).toHaveLength(0)
  })

  it('origem em erro: o grupo é o bloco de erro e a página continua (nenhuma exceção)', async () => {
    state.origem.mockResolvedValue({ acesso: 'erro' }); state.termos.mockResolvedValue({ acesso: 'erro' })
    const view = await resolver(origemDe(await rota(proprioVideo.id))!)
    expect(view.periodos[0]!.grupo.blocos).toHaveLength(1)
    expect(view.periodos[0]!.grupo.blocos[0]!.estado).toBe('erro')
  })

  it('podeEditar sai de acessoPrivado(siteId).edita (a E17 está no HEAD): quem tem só o direito recebe podeEditar falso', async () => {
    state.edita = false
    const n = origemDe(await rota(proprioVideo.id))!
    expect(n.props.children.props.podeEditar).toBe(false)
    state.edita = true
    expect(origemDe(await rota(proprioVideo.id))!.props.children.props.podeEditar).toBe(true)
  })

  it('vídeo de concorrente não lê nada disto', async () => {
    const el = await rota(concorrente.id)
    expect(nome(el)).toBe('HistoricoScreen')
    expect(state.origem).not.toHaveBeenCalled(); expect(state.termos).not.toHaveBeenCalled()
  })

  it('a ordem das seções: a origem entra em VideoBlocos como `origem` e a constante "o que ainda não há" não cita mais a origem', async () => {
    const el = await rota(proprioVideo.id)
    expect(origemDe(el)).toBeDefined()
    expect(blocos(el).ainda ?? "").not.toMatch(/origem do tráfego/i)
  })
})

describe('portão L5 (Yannis I2): a nota das trocas chega ao gráfico em todo estado menos privado', () => {
  /** os textos de `notaFaixas` achados em qualquer lugar do modelo dos blocos (views e impressões têm uma cada) */
  /** um vídeo próprio com gráfico de impressões (o `proprioVideo` é novo e mostra a faixa de 7 casas no lugar do gráfico) */
  const VIDEO_COM_GRAFICO = 'tnfigueiredo-l0'
  const notas = (el: Moldura): string[] => [...JSON.stringify(blocos(el)).matchAll(/"notaFaixas":"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]!)
  it('leitura das trocas em erro: a nota "sem as marcas" nos dois gráficos', async () => {
    state.trocas.mockImplementation(async () => ({ acesso: 'erro' }))
    const n = notas(await rota(VIDEO_COM_GRAFICO, {}))
    expect(n.length).toBeGreaterThanOrEqual(1)
    for (const x of n) expect(x).toBe('As trocas não puderam ser lidas: o gráfico está sem as marcas.')
  })
  it('registro sem estado: a nota "trocas não registradas" nos dois gráficos', async () => {
    state.trocas.mockImplementation(async () => ({
      acesso: 'ok',
      dado: { versoes: { canalId: w.canalId, estado: { estado: 'sem_estado' }, videos: [] }, testes: { acesso: 'ok', dado: { testes: [], descartados: 0 } }, motivoTestes: null, alcance: null },
    }))
    const n = notas(await rota(VIDEO_COM_GRAFICO, {}))
    expect(n.length).toBeGreaterThanOrEqual(1)
    for (const x of n) expect(x).toBe('trocas não registradas')
  })
  it('privado (sem prova): nenhuma nota', async () => {
    expect(notas(await rota(VIDEO_COM_GRAFICO, {}))).toEqual([])
  })
})
