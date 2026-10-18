// @vitest-environment node
// T8: a página do canal faz UMA leitura dos testes abertos, só no canal próprio e só para quem edita; o provedor recebe o valor decidido.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement } from 'react'
import { AbEntradasProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/contexto'
import { proprioWorld, semVideos, umCanal, primeiroProprio } from './proprio-fixture'
import type { ChannelPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

const w = proprioWorld()
const wUm = proprioWorld({ mut: umCanal })
const wSem = proprioWorld({ mut: ds => { semVideos(ds); umCanal(ds) } })
const OWNS: OwnMenu = { itens: [{ id: w.canalId, name: 'Meu', nota: 'n', href: '/x' }], principal: null, listaHref: '/l' }
const EDICAO = Object.defineProperty({}, 'siteId', { value: 'site-secreto-8b', enumerable: false }) as LeituraPrivadaDoSite

const st = vi.hoisted(() => ({
  page: null as unknown, site: null as unknown, dados: null as unknown,
  acesso: { leitura: null as unknown, edita: false, negativa: null as string | null },
  acessoChamadas: 0, abertos: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) }, notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/ab-entradas/ler-testes-abertos', () => ({ lerTestesAbertos: st.abertos }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/trail-chrome', () => ({ TrailChrome: ({ children }: { children: unknown }) => children }))
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
beforeEach(() => { st.abertos.mockReset(); st.abertos.mockResolvedValue({ acesso: 'ok', porVideo: {} }); st.dados = w.dados; st.acessoChamadas = 0; st.acesso = { leitura: EDICAO, edita: true, negativa: null }; paginaCanal(wUm, EDICAO, null) })


type No = ReactElement<{ valor?: unknown; children?: No | No[] }>
/** Acha o AbEntradasProvider na árvore de elementos devolvida pela página (sem renderizar). */
function provedor(n: unknown): No | null {
  const e = n as No | null | undefined
  if (!e || typeof e !== 'object') return null
  if (e.type === AbEntradasProvider) return e
  const f = (e.props as { children?: unknown } | undefined)?.children
  for (const c of Array.isArray(f) ? f : [f]) { const r = provedor(c); if (r) return r }
  return null
}
const pagina = async (id: string) => {
  const { default: Page } = await import(`${R}/canal/[id]/page`)
  return Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })
}

describe('página do canal: testes abertos do A/B', () => {
  it('canal próprio, quem edita: UMA leitura com o siteId e o provedor leva o valor', async () => {
    const el = await pagina(w.canalId)
    expect(st.abertos).toHaveBeenCalledTimes(1)
    expect(st.abertos).toHaveBeenCalledWith('s1')
    expect(provedor(el)!.props.valor).toEqual({ podeEditar: true, abertos: { acesso: 'ok', porVideo: {} } })
  })
  it('canal próprio, reporter (canEdit falso): não lê e o provedor leva null', async () => {
    paginaCanal(wUm, null, null)
    const el = await pagina(w.canalId)
    expect(st.abertos).not.toHaveBeenCalled()
    expect(provedor(el)!.props.valor).toBeNull()
  })
  it('canal próprio, leitura negada pela guarda interna: o provedor leva null', async () => {
    st.abertos.mockResolvedValue({ acesso: 'negado' })
    expect(provedor(await pagina(w.canalId))!.props.valor).toBeNull()
  })
  it('canal de concorrente: nunca lê; editor tem o provedor com abertos null, reporter com null', async () => {
    const conc = w.obs.channels.find(c => !c.own)!
    paginaCanal(w, EDICAO, null)
    expect(provedor(await pagina(conc.id))!.props.valor).toEqual({ podeEditar: true, abertos: null })
    paginaCanal(w, null, null)
    expect(provedor(await pagina(conc.id))!.props.valor).toBeNull()
    expect(st.abertos).not.toHaveBeenCalled()
  })
})
