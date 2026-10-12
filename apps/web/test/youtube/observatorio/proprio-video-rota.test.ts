// @vitest-environment node
// A4 Tarefa 11: a rota `video/[id]` ramifica pelo dono do canal do vídeo, decidido no SERVIDOR a partir do canal resolvido (nunca de parâmetro da URL).
// Vídeo de canal próprio abre a tela nova; vídeo de concorrente continua abrindo o Histórico, sem tocar o dado privado; id desconhecido continua
// "Vídeo não encontrado" na moldura (status 200); quem só lê o site abre a página sem os números privados.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { proprioWorld, primeiroProprio, DADOS } from './proprio-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { buildHistoricoView, historicoTrail } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import type { ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
import { provarEdicao, type EdicaoDoSite } from '@/lib/youtube/observatorio/proprio/edicao'

const w = proprioWorld({
  mut: ds => {
    // T13.0 H7: um vídeo de CONCORRENTE sem data (guardado, mas sem data de publicação)
    ds.channels.find(c => !c.own)!.undated.push({ id: 'conc-sem-data-1', ytId: 'ytcsd1', title: 'Concorrente sem data', url: 'https://youtu.be/ytcsd1', isShort: false, dur: 90, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null })
    primeiroProprio(ds).undated.push({ id: 'sem-data-1', ytId: 'ytsd1', title: 'Sem data', url: 'https://youtu.be/ytsd1', isShort: false, dur: 125, views: 50, likes: 5, comments: 1, pinned: false, checkedAt: null })
  },
})
const proprioVideo = w.obs.videos.find(v => v.ch === w.canalId)!
const concorrente = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!
// o token é o REAL (o que nasce em `provarEdicao`, com a guarda de edição simulada a dizer sim): nada de objeto forjado com cast
const guarda = vi.hoisted(() => ({ ok: true }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => (guarda.ok ? { ok: true, user: { id: 'u1' } } : { ok: false, reason: 'insufficient_access' }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
const EDICAO: EdicaoDoSite = await (async () => {
  const t = await provarEdicao('site-secreto-t11')
  if (!t) throw new Error('a fixture esperava o token de edição')
  return t
})()
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }

const state = {
  abrir: vi.fn(),
  edicao: vi.fn(async (_s: string): Promise<EdicaoDoSite | null> => EDICAO),
  dados: vi.fn(async (_a: unknown) => w.dados),
  swipe: vi.fn(async () => []),
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
  podeVerPrivado: (s: string) => state.edicao(s),
  lerDadosDoCanal: (a: unknown) => state.dados(a),
  longosAcompanhadosDe: (_obs: unknown, id: string) => ['yt-longos-de-' + id],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: () => state.swipe() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/video-model', async orig => {
  const m = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_proprio/video-model')>()
  state.real.base = m.buildProprioVideoBase
  return { ...m, buildProprioVideoBase: (...a: Parameters<typeof m.buildProprioVideoBase>) => state.base(...a) }
})
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_historico/historico-screen', () => ({ HistoricoScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/video-screen', () => ({ ProprioVideoScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn(), cancelForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ pinVideo: vi.fn(), unpinVideo: vi.fn(), syncCompetitorNow: vi.fn() }))

type Moldura = ReactElement<{ crumbs: Array<{ text: string; href?: string; voltaAoCanal?: string }>; owns: OwnMenu; aside?: ReactElement<{ pager: { prev: string | null; next: string | null; position: string } | null }>; children: ReactElement<Record<string, unknown>> }>
async function rota(id: string, sp: Record<string, string> = {}) {
  const { default: VideoPage } = await import('@/app/cms/(authed)/youtube/competitors/video/[id]/page')
  return (await VideoPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve(sp) })) as Moldura
}
const filho = (el: Moldura) => el.props.children
const nome = (el: Moldura) => (filho(el).type as { name?: string }).name

beforeEach(() => {
  vi.clearAllMocks()
  state.edicao.mockImplementation(async () => EDICAO)
  state.dados.mockImplementation(async () => w.dados)
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
    expect(state.edicao).toHaveBeenCalledTimes(1); expect(state.edicao).toHaveBeenCalledWith('s1')
    expect(state.dados).toHaveBeenCalledTimes(1)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, edicao: EDICAO, agora: w.obs.NOW, longosAcompanhados: ['yt-longos-de-' + w.canalId] })
  })

  it('vídeo de concorrente continua abrindo o Histórico, igual a hoje: mesma view, mesma trilha, SEM tocar a guarda de edição nem o dado privado', async () => {
    const el = await rota(concorrente.id, { from: 'canais', canal: concorrente.ch })
    expect(nome(el)).toBe('HistoricoScreen')
    const esperado = buildHistoricoView(w.obs, concorrente.id, { from: 'canais', canal: concorrente.ch, niche: 'todos' })
    expect(el.props.crumbs).toEqual(historicoTrail(esperado.crumbs))
    expect((filho(el).props as { view: { video: { id: string } } }).view.video.id).toBe(concorrente.id)
    expect(state.edicao).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
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
    expect(state.edicao).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
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
  it('sem permissão de edição: a página abre; o leitor recebe edicao null (devolve "negado"); a frase certa; nenhum dado privado nas props', async () => {
    state.edicao.mockImplementation(async () => null)
    state.dados.mockImplementation(async () => DADOS.negado(w.canalId, w.ytIds, w.hoje))
    const el = await rota(proprioVideo.id)
    expect(nome(el)).toBe('ProprioVideoScreen')
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: w.canalId, edicao: null })
    const p = filho(el).props as { alcanceNota: string }
    expect(p.alcanceNota).toBe('Impressões e cliques deste vídeo: só quem edita o site vê este número.')
    const cheio = JSON.stringify(filho(el).props)
    expect(cheio).not.toMatch(/"imp"|"ctr"|relatorios|linhas/)
  })

  it('quem edita: o token nunca está nas props que vão ao navegador', async () => {
    const el = await rota(proprioVideo.id)
    expect(JSON.stringify(filho(el).props)).not.toContain('site-secreto-t11')
    expect(JSON.stringify(el.props.aside!.props)).not.toContain('site-secreto-t11')
  })

  it('a guarda de edição que falha (null) é como não ter permissão: nenhuma exceção sobe', async () => {
    state.edicao.mockImplementation(async () => null)
    await expect(rota(proprioVideo.id)).resolves.toBeTruthy()
  })

  it('a leitura que FALHA lança (a error.tsx da rota aparece): o erro nunca vira um vídeo sem alcance (D5)', async () => {
    state.dados.mockRejectedValueOnce(new Error('banco fora'))
    await expect(rota(proprioVideo.id)).rejects.toThrow('banco fora')
  })

  it('canal próprio sem relatório: a frase do estado, sem número', async () => {
    state.dados.mockImplementation(async () => DADOS.vazio(w.canalId, w.ytIds, w.hoje))
    const el = await rota(proprioVideo.id)
    expect((filho(el).props as { alcanceNota: string }).alcanceNota).toBe('Impressões e cliques deste vídeo: ainda sem relatório de alcance deste canal.')
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
    expect(state.edicao).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })

  it('H7: vídeo de CONCORRENTE sem data continua "Vídeo não encontrado" na moldura (como em produção), sem tocar a guarda nem o dado privado', async () => {
    const { canalProprioDoVideo } = await import('@/app/cms/(authed)/youtube/competitors/_proprio/video-model')
    expect(canalProprioDoVideo(w.obs, 'conc-sem-data-1')).toBeNull()
    const el = await rota('conc-sem-data-1', { from: 'canais' })
    expect(nome(el)).toBe('HistoricoScreen')
    expect((filho(el).props as { view: { state: string; video: unknown } }).view).toMatchObject({ state: 'not-found', video: null })
    expect(state.edicao).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })

  it('H8: o modelo da página nasce ANTES de qualquer leitura privada (a guarda e o diário só rodam com o modelo na mão)', async () => {
    await rota(proprioVideo.id)
    expect(state.base).toHaveBeenCalledTimes(1)
    expect(state.base.mock.invocationCallOrder[0]!).toBeLessThan(state.edicao.mock.invocationCallOrder[0]!)
    expect(state.base.mock.invocationCallOrder[0]!).toBeLessThan(state.dados.mock.invocationCallOrder[0]!)
  })

  it('H8: se o modelo não se acha para um vídeo próprio, a rota LANÇA (nunca cai no Histórico) e nenhum dado privado foi lido', async () => {
    state.base.mockImplementation(() => null)
    await expect(rota(proprioVideo.id)).rejects.toThrow(/vídeo próprio/i)
    expect(state.edicao).not.toHaveBeenCalled(); expect(state.dados).not.toHaveBeenCalled()
  })
})
