// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { podeEditar, opcoes } = vi.hoisted(() => ({ podeEditar: vi.fn(), opcoes: [] as Array<{ arquivoVisivel?: boolean }> }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/cms/site-context', () => ({ getSiteContext: async () => ({ siteId: 's' }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/permissoes', () => ({ podeEditarSite: (s: string) => podeEditar(s) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ lerMeuCanalLembrado: async () => null, openObservatoryPage: async () => ({ obs: fakeObs }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/niche-actions', () => ({ setUserNiche: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/actions', () => ({ syncCompetitorsNow: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/forja-actions', () => ({ askForjaReading: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/observatory-chrome', () => ({ ObservatoryChrome: () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/resolve-niche', () => ({ resolveNiche: async () => ({ niche: 'todos', dropParam: false, fromParam: false }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_saiu/dados', () => ({ contarParaAAba: async () => ({ visivel: false, n: 0 }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_sugestoes/dados-da-tela', () => ({ contarParaAAbaSugestoes: async () => ({ visivel: false, n: 0, velho: false, calculado: false }) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/view-model', async orig => {
  const real = await orig<typeof import('@/app/cms/(authed)/youtube/competitors/_chrome/view-model')>()
  return { ...real, buildChromeView: (_o: unknown, o: { arquivoVisivel?: boolean }) => { opcoes.push(o); return { cowork: '' } } }
})
const fakeObs = { scopeOf: (n: string) => n }

describe('a aba Arquivo no chrome', () => {
  beforeEach(() => { opcoes.length = 0; podeEditar.mockReset() })
  it.each([[true], [false]])('chrome-server decide pela permissão de edição (%s), em qualquer aba (outliers)', async ok => {
    podeEditar.mockResolvedValue(ok)
    const { ObservatoryChromeServer } = await import('@/app/cms/(authed)/youtube/competitors/_chrome/chrome-server')
    await ObservatoryChromeServer({ tab: 'outliers', searchParams: undefined, obs: fakeObs as never, children: null })
    expect(opcoes[0]!.arquivoVisivel).toBe(ok)
  })
})
