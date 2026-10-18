// @vitest-environment node
/**
 * E17 degrau 1, Tarefa 8b: `montarCanal` e `montarVideo` devolvem o MESMO modelo que a página entrega ao componente, o `tipo` certo, as entradas dos
 * cartões de período e da origem, e o estado do dado privado (acesso cru por leitura, `negativa` da MESMA resposta que decidiu a leitura).
 */
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { proprioWorld, semVideos, umCanal, primeiroProprio } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'
/** Desembrulha o AbEntradasProvider (T8): a página põe o provedor entre a moldura e a tela. */
const semProvedor = (e: ReactElement): ReactElement => (e.type === AbEntradasProvider ? (e.props as { children: ReactElement }).children : e)

const w = proprioWorld()
const wUm = proprioWorld({ mut: umCanal })
const wSem = proprioWorld({ mut: ds => { semVideos(ds); umCanal(ds) } })
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }
const EDICAO = Object.defineProperty({}, 'siteId', { value: 'site-secreto-8b', enumerable: false }) as LeituraPrivadaDoSite

const st = vi.hoisted(() => ({
  page: null as unknown, site: null as unknown, dados: null as unknown,
  acesso: { leitura: null as unknown, edita: false, negativa: null as string | null },
  acessoChamadas: 0,
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openChannelPage: async () => st.page, openObservatoryPage: async () => st.site }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados', () => ({
  acessoPrivado: async () => { st.acessoChamadas++; return st.acesso },
  lerDadosDoCanal: async () => st.dados,
  lerDadosDoVideo: async () => { const d = st.dados as { alcance: { acesso: string; dado?: unknown }; diario: { acesso: string; dado?: unknown } }; return d.alcance.acesso === 'ok' && d.diario.acesso === 'ok' ? { acesso: 'ok', dado: { alcance: d.alcance.dado, diario: d.diario.dado } } : { acesso: d.diario.acesso } },
  lerDiarioLongo: async () => ({ acesso: 'erro' }), longosAcompanhadosDe: () => [],
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem', () => ({ lerOrigem: async () => ({ acesso: 'erro' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/dados-termos', () => ({ lerTermosESites: async () => ({ acesso: 'negado' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({ carregarExtrasProprio: async () => undefined }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows', async orig => ({ ...(await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_mudancas/swipe-rows')>()), loadSwipeRows: async () => [] }))

const R = '@/app/cms/(authed)/youtube/competitors'
function paginaCanal(mundo: typeof w, leitura: unknown, negativa: string | null): void {
  st.page = { siteId: 's1', now: mundo.obs.NOW, obs: mundo.obs, canEdit: leitura != null, leitura, negativa, ownYtIds: mundo.ytIds, meuCanalLembrado: null, owns: OWNS } satisfies Partial<ChannelPage> & Record<string, unknown>
  st.site = { siteId: 's1', now: w.obs.NOW, rows: {}, obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }
}
beforeEach(() => { st.dados = w.dados; st.acessoChamadas = 0; st.acesso = { leitura: EDICAO, edita: true, negativa: null }; paginaCanal(wUm, EDICAO, null) })

describe('montarCanal', () => {
  it('canal próprio com vídeos: tipo proprio, com as entradas dos cartões de período e da origem', async () => {
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const m = await montarCanal(w.canalId, {})
    expect(m.tipo).toBe('proprio')
    if (m.tipo !== 'proprio') return
    expect(m.proprio.id).toBe(w.canalId)
    expect(m.periodosProps?.canalId).toBe(w.canalId)
    expect(m.origemProps.canalId).toBe(w.canalId)
    expect(m.origemProps.podeEditar).toBe(true)
    expect(m.privado).toEqual({ acessoPorCanal: { [w.canalId]: { diario: 'ok', alcance: 'ok' } }, negativa: null })
  })
  it('id em maiúsculas: só vale o id RESOLVIDO do canal', async () => {
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const m = await montarCanal(w.canalId.toUpperCase(), {})
    expect(m.tipo === 'proprio' && m.proprio.id).toBe(w.canalId)
  })
  it('sem o direito: sem entrada dos cartões, acesso negado e a negativa da MESMA resposta que decidiu a leitura (nenhuma segunda chamada)', async () => {
    paginaCanal(wUm, null, 'sem_direito')
    st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const m = await montarCanal(w.canalId, {})
    expect(m.tipo === 'proprio' && m.periodosProps).toBeNull()
    expect(m.tipo === 'proprio' && m.privado).toEqual({ acessoPorCanal: { [w.canalId]: { diario: 'negado', alcance: 'negado' } }, negativa: 'sem_direito' })
    expect(st.acessoChamadas).toBe(0)
  })
  it('negada sem motivo na página (mock antigo): negativa nula = "não conferido", nunca "sem o direito"', async () => {
    paginaCanal(wUm, null, null)
    ;(st.page as { negativa?: unknown }).negativa = undefined
    st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const m = await montarCanal(w.canalId, {})
    expect(m.tipo === 'proprio' && m.privado.negativa).toBeNull()
  })
  it('canal próprio sem vídeos: tipo proprio_sem_videos e nenhuma leitura privada', async () => {
    paginaCanal(wSem, EDICAO, null)
    st.dados = null
    const { montarCanal } = await import(`${R}/_canal/montar`)
    expect((await montarCanal(wSem.canalId, {})).tipo).toBe('proprio_sem_videos')
  })
  it('concorrente: tipo concorrente, a aba Leitura traz o modelo de Mudanças só quando pedida', async () => {
    const conc = w.obs.channels.find(c => !c.own)!
    paginaCanal(w, EDICAO, null)
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const m = await montarCanal(conc.id, {})
    expect(m.tipo).toBe('concorrente')
    if (m.tipo !== 'concorrente') return
    expect(m.leituraMv).toBeNull()
    expect(m.view.header.name).toBe(conc.name)
    const l = await montarCanal(conc.id, { tab: 'leitura' })
    expect(l.tipo === 'concorrente' && l.view.state.tab).toBe('leitura')
  })
  it('id desconhecido ou de outro site: nao_encontrado', async () => {
    st.page = { ...(st.page as object), obs: w.obs }
    const { montarCanal } = await import(`${R}/_canal/montar`)
    expect((await montarCanal('canal-de-outro-site', {})).tipo).toBe('nao_encontrado')
    st.page = { ...(st.page as object), obs: null }
    expect((await montarCanal('x', {})).tipo).toBe('nao_encontrado')
  })
  it('a página entrega à tela o mesmo modelo que montarCanal (canal próprio e concorrente)', async () => {
    vi.doMock(`${R}/_chrome/trail-chrome`, () => ({ TrailChrome: () => null }))
    const { default: Page } = await import(`${R}/canal/[id]/page`)
    const { montarCanal } = await import(`${R}/_canal/montar`)
    const el = (await Page({ params: Promise.resolve({ id: w.canalId }), searchParams: Promise.resolve({ sort: 'imp' }) })) as ReactElement<{ children: ReactElement<{ view: unknown }> }>
    const m = await montarCanal(w.canalId, { sort: 'imp' })
    expect(m.tipo === 'proprio' && (semProvedor(el.props.children) as ReactElement<{ view: unknown }>).props.view).toEqual(m.tipo === 'proprio' && m.pv)
  })
})

describe('montarVideo', () => {
  const proprioVideo = w.obs.videos.find(v => v.ch === w.canalId)!
  const concVideo = w.obs.videos.find(v => !w.obs.channel(v.ch)!.own)!
  const abrir = async () => st.site as never
  it('vídeo próprio: tipo proprio, entradas dos cartões e da origem, privado do acesso e negativa da mesma resposta', async () => {
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(proprioVideo.id, {}, abrir)
    expect(m.tipo).toBe('proprio')
    if (m.tipo !== 'proprio') return
    expect(m.origemProps.podeEditar).toBe(true)
    expect(m.origemProps.ytId).toBe(m.base.header.ytId)
    expect(m.privado).toEqual({ acessoPorCanal: { [w.canalId]: { diario: 'ok', alcance: 'ok' } }, negativa: null })
  })
  it('sem o direito: acesso negado, negativa vinda de acessoPrivado, sem entrada dos cartões', async () => {
    st.acesso = { leitura: null, edita: false, negativa: 'nao_foi_possivel_conferir' }
    st.dados = { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(proprioVideo.id, {}, abrir)
    expect(m.tipo === 'proprio' && m.periodosProps).toBeNull()
    expect(m.tipo === 'proprio' && m.privado).toEqual({ acessoPorCanal: { [w.canalId]: { diario: 'negado', alcance: 'negado' } }, negativa: 'nao_foi_possivel_conferir' })
  })
  it('vídeo de concorrente: tipo concorrente e nenhuma leitura privada; id desconhecido: vista de não encontrado', async () => {
    const { montarVideo } = await import(`${R}/_historico/montar`)
    const m = await montarVideo(concVideo.id, {}, abrir)
    expect(m.tipo).toBe('concorrente')
    expect(st.acessoChamadas).toBe(0)
    const nf = await montarVideo('video-que-nao-existe', {}, abrir)
    expect(nf.tipo).toBe('concorrente')
  })
  it('um vídeo próprio sem cartão no conjunto lança (nunca cai no Histórico)', async () => {
    const { montarVideo } = await import(`${R}/_historico/montar`)
    expect(primeiroProprio).toBeDefined()
    await expect(montarVideo(proprioVideo.id, {}, async () => ({ ...(st.site as object), obs: Object.create(w.obs, { videos: { value: [] } }) }) as never)).rejects.toThrow()
  })
  it('a assinatura não tem siteId', async () => {
    const m = await import(`${R}/_historico/montar`)
    const c = await import(`${R}/_canal/montar`)
    expect(/^async function montarVideo\(([^)]*)\)/.exec(m.montarVideo.toString())?.[1]).not.toMatch(/siteId/)
    expect(/^async function montarCanal\(([^)]*)\)/.exec(c.montarCanal.toString())?.[1]).not.toMatch(/siteId/)
  })
})
