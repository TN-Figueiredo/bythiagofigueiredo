// @vitest-environment jsdom
// I-4 (revisão da Tarefa 10): o DESTINO do botão "Comparar com o meu canal" do cabeçalho do concorrente. A página (Server Component) decide
// `compararHref` a partir de `owns.principal` (`escolherPrincipal`, 11c: a escolha do dono, ou o canal próprio de publicação mais recente; empate: a ordem do motor). Os testes do cabeçalho só recebem a
// string pronta; aqui a página roda de verdade (mocks só nas leituras) com 0, 1 e 2 canais próprios, inclusive o maior sem vídeos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import type { ReactElement } from 'react'
import { canalWorld } from './canal-fixture'
import { link } from '@/lib/youtube/observatorio/links'
import { ownMenuFromRows } from '@/app/cms/(authed)/youtube/competitors/_chrome/own-menu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/canal/matt-wolfe',
  useSearchParams: () => new URLSearchParams(''),
  redirect: vi.fn(),
}))
const mocks = vi.hoisted(() => ({ openChannelPage: vi.fn(), openObservatoryPage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => mocks)
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => true }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn() }))

import CanalPage from '@/app/cms/(authed)/youtube/competitors/canal/[id]/page'

const FMT = { subs: (n: number) => String(n) }
const AGORA = Date.UTC(2026, 9, 24, 18, 0, 0), DIA = 86_400_000
type Linha = { id: string; name: string; subs: number | null; videos: number; ultimo?: number | null }
async function compararHrefDaPagina(rows: Linha[], lembrado: string | null = null): Promise<{ href: string | null | undefined; chId: string; itens: number }> {
  const { obs, chId } = canalWorld()
  const owns = ownMenuFromRows(rows.map(l => ({ ...l, ultimo: l.ultimo === undefined ? (l.videos > 0 ? AGORA - 5 * DIA : null) : l.ultimo })), FMT, { lembrado, agora: AGORA })
  mocks.openChannelPage.mockResolvedValue({ siteId: 's1', now: 0, obs, canEdit: true, owns })
  const el = (await CanalPage({ params: Promise.resolve({ id: chId }), searchParams: Promise.resolve({}) })) as ReactElement<{ children: ReactElement<{ compararHref?: string | null }> }>
  return { href: el.props.children.props.compararHref, chId, itens: owns.itens.length }
}

beforeEach(() => { mocks.openChannelPage.mockReset(); mocks.openObservatoryPage.mockReset() })
afterEach(() => { cleanup() })

describe('o botão "Comparar com o meu canal" do cabeçalho: para onde a página o manda', () => {
  it('nenhum canal próprio: o destino é nulo (o botão não existe)', async () => {
    const r = await compararHrefDaPagina([])
    expect(r.itens).toBe(0); expect(r.href).toBeNull()
  })
  it('um canal próprio com vídeos: o lado A é ele', async () => {
    const r = await compararHrefDaPagina([{ id: 'eu', name: 'Eu', subs: 100, videos: 7 }])
    expect(r.href).toBe(link.comparar('eu', r.chId))
  })
  it('um canal próprio SEM vídeos: nenhum destino válido, o botão não existe', async () => {
    const r = await compararHrefDaPagina([{ id: 'eu', name: 'Eu', subs: 100, videos: 0 }])
    expect(r.href).toBeNull()
  })
  it('dois com vídeos: o lado A é o primeiro na ordem do motor (o de mais inscritos), qualquer que seja a ordem da leitura', async () => {
    const a = { id: 'pequeno', name: 'Pequeno', subs: 10, videos: 3 }, b = { id: 'grande', name: 'Grande', subs: 500, videos: 3 }
    expect((await compararHrefDaPagina([a, b])).href).toBe(link.comparar('grande', (await compararHrefDaPagina([a, b])).chId))
    const r = await compararHrefDaPagina([b, a])
    expect(r.href).toBe(link.comparar('grande', r.chId))
  })
  it('dois ativos: o de publicação mais recente é o lado A, ainda que tenha menos inscritos (11c)', async () => {
    const r = await compararHrefDaPagina([{ id: 'grande', name: 'Grande', subs: 500, videos: 3, ultimo: AGORA - 20 * DIA }, { id: 'pequeno', name: 'Pequeno', subs: 10, videos: 3, ultimo: AGORA - 2 * DIA }])
    expect(r.href).toBe(link.comparar('pequeno', r.chId))
  })
  it('dois ativos, com a escolha do dono (cookie): a escolha vale; sem o cookie, a recência (o teste que apaga o cookie)', async () => {
    const linhas = [{ id: 'grande', name: 'Grande', subs: 500, videos: 3, ultimo: AGORA - 20 * DIA }, { id: 'pequeno', name: 'Pequeno', subs: 10, videos: 3, ultimo: AGORA - 2 * DIA }]
    const com = await compararHrefDaPagina(linhas, 'grande')
    expect(com.href).toBe(link.comparar('grande', com.chId))
    const sem = await compararHrefDaPagina(linhas, null)
    expect(sem.href).toBe(link.comparar('pequeno', sem.chId))
  })
  it('dois, o PRIMEIRO sem vídeos: o link leva ao segundo, nunca ao primeiro da lista (D16)', async () => {
    const r = await compararHrefDaPagina([{ id: 'grande-sem-videos', name: 'Grande', subs: 900, videos: 0 }, { id: 'pequeno-com-videos', name: 'Pequeno', subs: 10, videos: 4 }])
    expect(r.itens).toBe(2)
    expect(r.href).toBe(link.comparar('pequeno-com-videos', r.chId))
    expect(r.href).not.toContain('grande-sem-videos')
  })
  it('dois, nenhum com vídeos: sem destino', async () => {
    const r = await compararHrefDaPagina([{ id: 'x', name: 'X', subs: 9, videos: 0 }, { id: 'y', name: 'Y', subs: 8, videos: 0 }])
    expect(r.itens).toBe(2); expect(r.href).toBeNull()
  })
})
