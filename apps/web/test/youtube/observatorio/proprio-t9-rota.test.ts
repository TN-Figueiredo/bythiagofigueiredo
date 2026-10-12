// @vitest-environment node
// A4 Tarefa 9 (revisão da T8): dois casos de rota que faltavam em proprio-rota.test.ts. (1) O id de um canal próprio de OUTRO site: o carregador não o acha
// (`obs` nulo) e a rota diz "Canal não encontrado" SEM tocar tabela privada nem o conjunto do site (M4). (2) M3: canal próprio só com vídeos sem data TEM página
// (o mesmo critério `canalTemVideos` de todos os pontos): a rota monta a página própria, não a moldura "ainda não tem vídeos".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import { proprioWorld, umCanal } from './proprio-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import type { Dataset, UndatedVideo } from '@/lib/youtube/observatorio/types'
import type { ChannelPage, ObservatoryPage } from '@/app/cms/(authed)/youtube/competitors/_chrome/page-data'
import type { OwnMenu } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

const SEM_DATA: UndatedVideo = { id: 'u1', ytId: 'yt-u1', title: 'Sem data', url: 'https://youtu.be/yt-u1', isShort: false, dur: 600, views: 10, likes: 1, comments: 0, pinned: false, checkedAt: null }
const w = proprioWorld()
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
  state.page = { siteId: 's1', now: m.obs.NOW, obs, canEdit: true, edicao: null, ownYtIds: m.ytIds, meuCanalLembrado: null, owns: OWNS }
  state.site = { siteId: 's1', now: w.obs.NOW, rows: {} as ObservatoryPage<undefined>['rows'], obs: w.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: undefined }
}
async function rota(id: string) {
  const { default: CanalPage } = await import('@/app/cms/(authed)/youtube/competitors/canal/[id]/page')
  return (await CanalPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) })) as ReactElement<{ crumbs: Array<{ text: string; href?: string }>; children: ReactElement<Record<string, unknown>> }>
}
const nome = (el: ReactElement<{ children: ReactNode }>) => ((el.props.children as ReactElement).type as { name?: string }).name

beforeEach(() => { vi.clearAllMocks(); state.dados.mockImplementation(async () => w.dados) })

describe('canal de outro site (o carregador não o acha)', () => {
  it('"Canal não encontrado": nenhuma tabela privada, nenhum conjunto do site, nenhuma posição; a trilha não nomeia o canal', async () => {
    cenario(w, null)
    const el = await rota(w.canalId) // o id existe em OUTRO site: para este, `obs` é nulo
    expect(el.props.crumbs).toEqual([{ text: 'Canais', href: link.canais() }, { text: 'Canal não encontrado' }])
    expect(nome(el)).toBe('CanalNotFound')
    expect(state.dados).not.toHaveBeenCalled()
    expect(state.abrirSite).not.toHaveBeenCalled()
    expect(state.extras).not.toHaveBeenCalled()
  })
  it('um id que o conjunto do site não conhece (canal inexistente) cai no mesmo lugar, sem leitura privada', async () => {
    cenario(w)
    const el = await rota('nao-existe-em-lugar-nenhum')
    expect(nome(el)).toBe('CanalNotFound')
    expect(state.dados).not.toHaveBeenCalled()
    expect(state.extras).not.toHaveBeenCalled()
  })
})

describe('M3 · canal próprio só com vídeo sem data', () => {
  it('tem página: a rota monta a página própria (não a moldura "ainda não tem vídeos") e lê o dado privado com o id resolvido', async () => {
    cenario(soSemData)
    const el = await rota(soSemData.canalId)
    expect(nome(el)).toBe('ProprioScreen')
    expect(state.dados).toHaveBeenCalledTimes(1)
    expect(state.dados.mock.calls[0]![0]).toMatchObject({ canalId: soSemData.canalId })
  })
})
