// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildInsightsView } from '@/app/cms/(authed)/youtube/competitors/_insights/view-model'
import { InsightsScreen } from '@/app/cms/(authed)/youtube/competitors/_insights/insights-screen'
import { noJunkText, oneFilledButton, forbiddenVocabulary, brokenLinks, futureTimes, weekdaysMatch } from './audits'

const replace = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors/insights',
  useSearchParams: () => new URLSearchParams(search),
}))

const ds = datasetFromOracle(loadOracle())
const obs = createObservatory(ds)
const mount = (niche: 'todos' | 'viagem' | 'ia' = 'viagem', fmt?: string, o = obs) => render(<InsightsScreen view={buildInsightsView(o, { niche, fmt })} />)

/** Static labels of the screen (headings, axis titles…): everything else must come from the view model. */
const STATIC = new Set(['Fórmulas de título', 'Cadência por canal', 'Canal e ritmo', 'Último upload', 'Você no nicho', 'Lacunas', 'Quando publicam',
  'Uploads', 'Multiplicador mediano', 'Temas em alta', 'mediana do nicho', '/sem', '(ritmo parcial)', ' · ', 'Ex.: “', '”', 'Dia', ' ', '⚠ ',
  // the forja hero's own labels (Task 35)
  'Leitura da forja', 'ver detalhes', 'Evidências', 'Os links abrem o Outliers com o mesmo escopo da leitura (canais e janela) e os números de hoje; o que a leitura viu está no texto de cada evidência.'])

beforeEach(() => { replace.mockReset(); search = '' })

describe('InsightsScreen', () => {
  it('passes the DOM audits; no filled button; weekdays real', () => {
    const { container } = mount()
    expect(noJunkText(container)).toEqual([])
    expect(oneFilledButton(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
    expect(weekdaysMatch(container, obs.date)).toEqual([])
    expect(futureTimes(container, obs.NOW, obs.date)).toEqual([])
    expect(container.querySelectorAll('.btn-primary,.btn-forja-solid,.obs-ch-forja-solid')).toHaveLength(0)
  })

  it('every interactive element has an accessible name', () => {
    const { container } = mount()
    const els = container.querySelectorAll('button, a[href], [tabindex="0"]')
    expect(els.length).toBeGreaterThan(10)
    els.forEach(el => expect(el).toHaveAccessibleName(/\S/))
  })

  it('no number is computed in the screen: every visible text comes from the view model', () => {
    const view = buildInsightsView(obs, { niche: 'viagem' })
    const { container } = render(<InsightsScreen view={view} />)
    const json = JSON.stringify(view)
    const w = document.createTreeWalker(container, 4)
    const stray: string[] = []
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.textContent ?? ''
      if (!t.trim() || STATIC.has(t) || STATIC.has(t.trim())) continue
      if (!json.includes(JSON.stringify(t).slice(1, -1))) stray.push(t)
    }
    expect(stray).toEqual([])
  })

  it('the six cards render; the forja hero comes first, with the seal directly above the LITERAL reading text', () => {
    const { container } = mount()
    for (const h of ['Leitura da forja', 'Cadência por canal', 'Você no nicho', 'Lacunas', 'Fórmulas de título', 'Quando publicam', 'Temas em alta']) expect(screen.getByRole('heading', { name: h })).toBeInTheDocument()
    const hero = container.querySelector('#forjaCard')!
    expect(hero.parentElement!.firstElementChild).toBe(hero)
    expect(hero).toHaveAttribute('data-forja-anchor')
    const P = obs.forja.byId['padroes-titulo-viagem-20-10']!
    const seal = hero.querySelector('[data-seal-of="padroes-titulo-viagem-20-10"]')!
    expect(seal.textContent).toBe('forja · Gemma 12B · fórmulas, 6 meses · 20/10 06:10 (SP)')
    // under the seal: only the reading's literal text
    const lit = seal.closest('.sealrow')!.nextElementSibling!
    expect(lit).toHaveAttribute('data-reading-id', P.id)
    expect(lit.querySelector('p')!.textContent).toBe(P.text.lead)
    // "Desde então" is a site note, outside the seal, without a final period
    const since = hero.querySelector('.since')!
    expect(since.textContent).toContain('Desde então: ')
    expect(lit.contains(since)).toBe(false)
    // the forja button lives in the chrome (no button in the screen)
    expect(screen.queryByRole('button', { name: /forja/ })).toBeNull()
  })
  it('no reading at all: the hero says so and the Fórmulas foot says "Ainda não há leitura"', () => {
    const ds2 = datasetFromOracle(loadOracle()); ds2.readings = []
    const { container } = mount('viagem', undefined, createObservatory(ds2))
    expect(container.querySelector('#forjaCard .statebox h3')!.textContent).toBe('Ainda não há leitura dos longos de Viagem')
    expect(container.querySelector('#formCard .foot')!.textContent).toContain('Ainda não há leitura: a tabela é a análise de hoje')
  })
  it('with a reading, the Fórmulas foot keeps the plain sentence', () => {
    const { container } = mount()
    expect(container.querySelector('#formCard .foot')!.textContent).toContain('A tabela é a análise de hoje (base de')
    expect(container.querySelector('#formCard .foot')!.textContent).not.toContain('Ainda não há leitura')
  })
  it('formulas: verdict chips and the rule text', () => {
    const { container } = mount()
    const preco = container.querySelector('[data-formula="preco"]')!
    expect(preco).toHaveAttribute('data-verdict', 'padrao')
    expect(within(preco as HTMLElement).getByText('● passa a regra')).toBeInTheDocument()
    container.querySelectorAll('[data-verdict="recorrencia"]').forEach(r => expect(r.textContent).toContain('◌ pouco para concluir'))
  })

  it('heatmap: switching to the multiplier changes the note and keeps focus on the button', async () => {
    const user = userEvent.setup()
    const { container } = mount()
    const card = container.querySelector('#heatCard') as HTMLElement
    expect(card.querySelector('.note')!.textContent).toContain('Mais uploads: ')
    await user.click(within(card).getByRole('button', { name: 'Multiplicador mediano' }))
    expect(within(card).getByRole('button', { name: 'Multiplicador mediano' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(card).getByRole('button', { name: 'Multiplicador mediano' })).toHaveFocus()
    expect(card.querySelector('.note')!.textContent).toMatch(/mediana|normal/)
    expect(card.querySelectorAll('.hm .cell')).toHaveLength(84)
  })

  it('format toggle replaces ?fmt= in the URL and keeps the other params', async () => {
    search = 'niche=viagem'
    const user = userEvent.setup()
    mount()
    await user.click(screen.getByRole('button', { name: 'Shorts' }))
    expect(replace).toHaveBeenCalledWith('/cms/youtube/competitors/insights?niche=viagem&fmt=short', { scroll: false })
  })

  it('Todos: asks for one niche, with links to Viagem and IA, and no cards', () => {
    const { container } = mount('todos')
    expect(screen.getByRole('heading', { name: 'Insights compara dentro de um nicho' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver Viagem' })).toHaveAttribute('href', '?niche=viagem')
    expect(container.querySelector('#grid')).toBeNull()
  })

  it('low theme coverage: Temas shows the honest note and no ▲/▼ or sparks', () => {
    const d = structuredClone(ds)
    let kept = 0
    for (const v of d.videos) if (v.theme && !(v.ageDays <= 90 && v.niche === 'viagem' && v.fmt === 'long' && v.tracked && v.ch !== 'tnfigueiredo' && kept++ < 8)) v.theme = null
    const { container } = mount('viagem', 'long', createObservatory(d))
    const card = container.querySelector('#themeCard')!
    expect(card.querySelector('[data-coverage="low"]')!.textContent).toMatch(/^A forja ainda não deu tema a vídeos suficientes/)
    expect(card.textContent).not.toMatch(/[▲▼]/)
    expect(card.querySelectorAll('.spark')).toHaveLength(0)
    expect(noJunkText(container)).toEqual([])
  })

  it('empty dataset: every card shows its empty text, no junk', () => {
    const d = structuredClone(ds); d.videos = []
    const { container } = mount('viagem', 'long', createObservatory(d))
    expect(noJunkText(container)).toEqual([])
    expect(container.querySelectorAll('.empty').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText(/^Nenhum longo dos concorrentes de Viagem nos últimos 90 dias\. Fora da análise: Vou sem volta/)).toBeInTheDocument()
  })
})
