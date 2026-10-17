// @vitest-environment node
/**
 * Yannis I2 (17/10): as bordas de I/O dos três montar* nunca derrubam a tela. Com o carregador de medidas rejeitando, cada tela cai no seu estado de erro
 * e o erro vai ao Sentry com o `step` próprio. Com um conjunto que traz dado fora da forma, o Insights vira cartão em erro em vez de lançar.
 * M4: o carregador nunca recebe o id de um canal próprio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { a3World } from './a3-fixture'

const W = a3World()
const abrir = vi.hoisted(() => vi.fn())
const carregar = vi.hoisted(() => vi.fn())
const sentry = vi.hoisted(() => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => sentry)
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_chrome/page-data', () => ({ openObservatoryPage: abrir, lerMeuCanalLembrado: async () => null }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_proprio/carregar-extras', () => ({
  carregarProprioDaComparacao: async () => ({ extras: undefined, soSeuCanal: {} }),
  carregarExtrasProprio: vi.fn(async () => undefined),
}))
vi.mock('@/lib/youtube/observatorio/medidas-telas/carregar-do-site', () => ({ carregarMedidasDoSite: carregar }))

const R = '@/app/cms/(authed)/youtube/competitors'
const donos = new Set(W.obs.channels.filter(c => c.own).map(c => c.id))
const nichoComDois = ((): string => {
  const por = new Map<string, number>()
  for (const c of W.obs.channels) if (!c.own && c.niche) por.set(c.niche, (por.get(c.niche) ?? 0) + 1)
  return [...por].find(([, n]) => n >= 2)![0]
})()

beforeEach(() => {
  sentry.captureException.mockClear(); carregar.mockReset()
  abrir.mockReset()
  abrir.mockImplementation(async () => ({ siteId: 's', now: W.obs.NOW, rows: {}, obs: W.obs, meuCanalLembrado: null, savedNiche: 'todos', extra: { legacy: [], bookmarked: new Set<string>() } }))
})
const passos = () => sentry.captureException.mock.calls.map(c => (c[1] as { tags: { step: string } }).tags.step)

describe('carregador de medidas falhando', () => {
  beforeEach(() => { carregar.mockRejectedValue(new Error('banco fora')) })

  it('Comparar: todo lado concorrente vira "não carregou", o pacote leva hojeSP e o erro vai ao Sentry', async () => {
    const { montarComparar } = await import(`${R}/_comparar/montar`)
    const m = await montarComparar({})
    expect(m.pack.hojeSP).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const concorrentes = m.pack.canais.filter(c => !c.own)
    expect(concorrentes.length).toBeGreaterThan(0)
    expect(concorrentes.every(c => c.medidasDoLado?.fonte.tipo === 'nao_carregou')).toBe(true)
    expect(passos()).toContain('medidas-telas-comparar')
  })
  it('Outliers: a coluna de idade vira erro e a ordem v7 volta ao multiplicador', async () => {
    const { montarOutliers } = await import(`${R}/_outliers/montar`)
    const m = await montarOutliers({ sort: 'v7' })
    expect(m.view.idade?.erro).toBe(true)
    expect(m.view.query.sort).toBe('mult')
    expect(passos()).toContain('medidas-telas-outliers')
  })
  it('Insights: o cartão da direção vai em erro', async () => {
    const { montarInsights } = await import(`${R}/_insights/montar`)
    const m = await montarInsights({ niche: nichoComDois })
    expect(m.view.direcaoNicho?.estado).toBe('erro')
    expect(passos()).toContain('medidas-telas-insights')
  })
})

describe('dado fora da forma no Insights', () => {
  it('o modelo lançando vira cartão em erro e erro no Sentry, nunca página caída', async () => {
    // porCanal com valor que quebra a leitura (nem naoCarregou nem medidas)
    carregar.mockImplementation(async (_sb: unknown, o: { canais: string[] }) => ({
      porCanal: new Map(o.canais.map(id => [id, 42])), extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, videos: new Map(),
    }))
    const { montarInsights } = await import(`${R}/_insights/montar`)
    const m = await montarInsights({ niche: nichoComDois })
    expect(m.view.direcaoNicho?.estado).toBe('erro')
    expect(passos()).toContain('direcao-nicho-modelo')
  })
})

describe('canal próprio nunca entra no carregador (M4)', () => {
  beforeEach(() => { carregar.mockResolvedValue({ porCanal: new Map(), extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0, videos: new Map() }) })
  const semDonos = (): void => {
    expect(carregar).toHaveBeenCalled()
    for (const [, o] of carregar.mock.calls as Array<[unknown, { canais: string[] }]>) {
      for (const id of o.canais) expect(donos.has(id)).toBe(false)
    }
  }
  it('Comparar', async () => { const { montarComparar } = await import(`${R}/_comparar/montar`); await montarComparar({}); semDonos() })
  it('Outliers', async () => { const { montarOutliers } = await import(`${R}/_outliers/montar`); await montarOutliers({ sort: 'v7' }); semDonos() })
  it('Insights', async () => { const { montarInsights } = await import(`${R}/_insights/montar`); await montarInsights({ niche: nichoComDois }); semDonos() })
})
