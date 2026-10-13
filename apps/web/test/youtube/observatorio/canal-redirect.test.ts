// @vitest-environment node
// Task 9 (A3) e Tarefa 8 (A4): a página de Canais com ?channel=<canal> leva à página do canal, de concorrente ou PRÓPRIO com vídeos;
// o painel lateral só abre para o que não tem página (nenhum caso hoje: o próprio sem vídeos abre a lista sem painel).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const obsCheio = createObservatory(datasetFromOracle(loadOracleOwns('2')))
let obs = obsCheio
const COMP = 'luke-damant', OWN = 'tnfigueiredo'
const CANAL = (id: string) => '/cms/youtube/competitors/canal/' + id

vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error('REDIRECT ' + u) } }))
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: false }) }))
vi.mock('@/lib/youtube/competitor-admin', () => ({ canAdminSiteUsers: async () => false }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({
  openObservatoryPage: async () => ({ siteId: 's', now: 0, rows: { settings: null }, obs, savedNiche: 'todos', extra: false }),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/chrome-server', () => ({ ObservatoryChromeServer: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_canais/canais-screen', () => ({ CanaisScreen: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({
  addChannelFromCanais: vi.fn(), removeCompetitorChannel: vi.fn(), syncCompetitorNow: vi.fn(), unlockMoreChannels: vi.fn(),
  pinVideo: vi.fn(), unpinVideo: vi.fn(), getCompetitorRemovalImpactAction: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setChannelNiche: vi.fn(), setOwnChannelNiche: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn() }))

async function page(sp: Record<string, string | string[] | undefined>) {
  const { default: CompetitorsPage } = await import('@/app/cms/(authed)/youtube/competitors/page')
  return CompetitorsPage({ searchParams: Promise.resolve(sp) })
}

beforeEach(() => { vi.clearAllMocks(); obs = obsCheio })

describe('Canais com ?channel=', () => {
  it('?channel=<concorrente> redireciona para a página do canal', async () => {
    expect(obs.channel(COMP)!.own).toBe(false)
    await expect(page({ channel: COMP })).rejects.toThrow('REDIRECT ' + CANAL(COMP))
    expect(CANAL(COMP)).toBe(obs.link.canal(COMP))
  })
  it('?channel=<concorrente>&tab=videos redireciona; tab=outliers também (o tab do painel não tem equivalente)', async () => {
    await expect(page({ channel: COMP, tab: 'videos' })).rejects.toThrow('REDIRECT ' + CANAL(COMP))
    await expect(page({ channel: COMP, tab: 'outliers' })).rejects.toThrow('REDIRECT ' + CANAL(COMP))
    await expect(page({ channel: COMP, tab: 'trocas', niche: 'ia' })).rejects.toThrow('REDIRECT ' + CANAL(COMP))
  })
  it('?channel=<canal próprio com vídeos> redireciona para canal/<id> (A4, D9): o painel lateral não abre mais para ele', async () => {
    expect(obs.channel(OWN)!.own).toBe(true)
    expect(obs.videos.some(v => v.ch === OWN)).toBe(true)
    await expect(page({ channel: OWN })).rejects.toThrow('REDIRECT ' + CANAL(OWN))
    await expect(page({ channel: OWN, tab: 'outliers' })).rejects.toThrow('REDIRECT ' + CANAL(OWN))
    expect(CANAL(OWN)).toBe(obs.link.canal(OWN))
  })
  it('?channel=<canal próprio SEM vídeos> abre a lista sem painel e sem erro (canal sem vídeo não tem página, D10)', async () => {
    const ds = datasetFromOracle(loadOracleOwns('2'))
    ds.videos = ds.videos.filter(v => v.ch !== OWN)
    for (const c of ds.channels) if (c.id === OWN) c.undated = []
    obs = createObservatory(ds)
    expect(obs.videos.some(v => v.ch === OWN)).toBe(false)
    const el = await page({ channel: OWN }) as { props: { children: { props: { view: { drawer: unknown } } } } }
    expect(obs.channel(OWN)!.own).toBe(true)
    expect(el.props.children.props.view.drawer).toBeNull() // a lista abre sem o painel lateral
  })
  it('?channel=<id desconhecido> não redireciona nem dá erro (o painel some, como hoje)', async () => {
    await expect(page({ channel: 'nao-existe' })).resolves.toBeTruthy()
  })
  it('sem ?channel= a página abre normalmente; ?tab=outliers sozinho continua sendo o link antigo do painel de abas', async () => {
    await expect(page({})).resolves.toBeTruthy()
    await expect(page({ tab: 'outliers' })).rejects.toThrow('REDIRECT /cms/youtube/competitors/outliers')
  })
})
