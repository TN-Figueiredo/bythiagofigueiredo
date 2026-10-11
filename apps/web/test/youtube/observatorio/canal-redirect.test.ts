// @vitest-environment node
// Task 9: a página de Canais com ?channel=<concorrente> leva à página do canal; o painel só serve o canal próprio.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadOracleOwns, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'

const obs = createObservatory(datasetFromOracle(loadOracleOwns('2')))
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

beforeEach(() => { vi.clearAllMocks() })

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
  it('?channel=<canal próprio> NÃO redireciona: o painel abre como hoje', async () => {
    expect(obs.channel(OWN)!.own).toBe(true)
    await expect(page({ channel: OWN })).resolves.toBeTruthy()
  })
  it('?channel=<id desconhecido> não redireciona nem dá erro (o painel some, como hoje)', async () => {
    await expect(page({ channel: 'nao-existe' })).resolves.toBeTruthy()
  })
  it('sem ?channel= a página abre normalmente; ?tab=outliers sozinho continua sendo o link antigo do painel de abas', async () => {
    await expect(page({})).resolves.toBeTruthy()
    await expect(page({ tab: 'outliers' })).rejects.toThrow('REDIRECT /cms/youtube/competitors/outliers')
  })
})
