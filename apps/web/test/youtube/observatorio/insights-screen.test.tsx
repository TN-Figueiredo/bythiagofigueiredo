// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadOracle, loadOracleOwns, datasetFromOracle } from './oracle'
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
  'Uploads', 'Multiplicador mediano', 'Temas em alta', 'Canal', 'Nicho', 'Role a tabela para o lado para ver todas as colunas.', '/sem', '(ritmo parcial)', ' · ', 'Ex.: “', '”', 'Dia', ' ', '⚠ ',
  // the forja hero's own labels (Task 35)
  'Leitura da forja', 'ver detalhes', 'Evidências', 'Os links abrem o Outliers com o mesmo escopo da leitura (canais e janela) e os números de hoje; o que a leitura viu está no texto de cada evidência.'])

// N own channels (Task 8): the engines are built once per file
const PRESETS = ['1', '2', '5', 'mix', 'zero'] as const
const OWNS = Object.fromEntries(PRESETS.map(p => [p, createObservatory(datasetFromOracle(loadOracleOwns(p)))])) as Record<typeof PRESETS[number], typeof obs>

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
    // the literal lead, with its evidence number glued to the last word (insights.html blockHTML)
    const lead = lit.querySelector('p')!
    const sup = lead.querySelector('sup a')
    expect(sup).not.toBeNull()
    expect(lead.textContent!.slice(0, -sup!.textContent!.length)).toBe(P.text.lead)
    expect(hero.querySelector('#ev' + sup!.textContent)).not.toBeNull()
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
  it('with a reading, Fórmulas shows the reading\'s numbers and says so (insights.html renderFormulas)', () => {
    const { container } = mount()
    expect(container.querySelector('#formCard .chead .meta.right')!.textContent).toBe('números da leitura de 20/10 06:10')
    expect(container.querySelector('#formCard .foot')!.textContent).toContain('Os números da linha são da leitura (base de')
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
    // Fórmulas keeps the frozen reading's rows; Você no nicho keeps the own channel's row, with the reason; every other card is empty
    expect(container.querySelectorAll('.empty').length).toBeGreaterThanOrEqual(3)
    expect(container.querySelectorAll('#youCard tr[data-own][data-empty]')).toHaveLength(1)
    expect(container.querySelector('#youCard tr[data-empty] td')!.textContent).toMatch(/^Sem longos nas últimas 13 semanas/)
    expect(screen.getByText(/^Nenhum longo dos concorrentes de Viagem nos últimos 90 dias\. Fora da análise: Vou sem volta/)).toBeInTheDocument()
  })
})

describe('InsightsScreen — Você no nicho as a table (N own channels)', () => {
  const you = (c: HTMLElement) => c.querySelector('#youCard') as HTMLElement

  it('preset 2, Viagem: one Nicho row, one row per own channel, "sem dado · base fraca" stays visible', () => {
    const { container } = mount('viagem', undefined, OWNS['2'])
    const card = you(container)
    expect(card).toHaveClass('c12')
    const table = card.querySelector('table.yt')!
    expect(table).toHaveAttribute('aria-labelledby', 'youH')
    expect([...table.querySelectorAll('thead th')].map(th => th.firstChild!.textContent)).toEqual(['Canal', 'Ritmo', 'Views/dia', 'Vídeos com 2× ou mais', 'Engajamento'])
    expect(table.querySelectorAll('tbody tr.ref')).toHaveLength(1)
    expect(table.querySelector('tbody')!.firstElementChild).toHaveClass('ref')
    expect(table.querySelector('tr.ref .nm')!.textContent).toBe('Nicho')
    expect(table.querySelectorAll('tr.ref td')).toHaveLength(4)
    expect([...table.querySelectorAll('tr[data-own]')].map(r => r.getAttribute('data-own'))).toEqual(['tnfigueiredo', 'tnfigueiredo-en'])
    const nd = table.querySelector('tr[data-own="tnfigueiredo-en"] td[data-nodata]')!
    expect(nd.querySelector('.v.nd')!.textContent).toBe('sem dado')
    expect(nd.querySelector('.vb')!.textContent).toBe('base fraca (n = 0)')
    expect(nd.querySelector('.vb')).toHaveAttribute('title', 'Menos de 3 vídeos deste canal com base de comparação')
    // R74: weak base → neutral verdict; enough base → coloured
    const few = table.querySelector('tr[data-own="tnfigueiredo"] td[data-few="1"]')!
    expect(few.querySelector('.vd')).toHaveClass('flat')
    expect(few.querySelector('.vd')!.textContent).toBe('▼ 0,6× a mediana')
    expect(few.querySelectorAll('.vb')[0]!.textContent).toBe('n = 8, pouco para concluir')
    table.querySelectorAll('td[data-few="1"] .vd, td[data-nodata] .vd').forEach(v => { expect(v).not.toHaveClass('up'); expect(v).not.toHaveClass('down') })
    expect(table.querySelector('td[data-few="0"] .vd.up')).not.toBeNull()
    // the channel name links to its row in Canais; the language chip only with more than one own channel
    expect(within(card).getByRole('link', { name: 'tnFigueiredo' })).toHaveAttribute('href', OWNS['2'].link.canais({ channel: 'tnfigueiredo' }))
    expect([...table.querySelectorAll('abbr.langtag')].map(a => [a.textContent, a.getAttribute('title')])).toEqual([['PT', 'Canal em português'], ['EN', 'Canal em inglês']])
    expect(card.querySelector('.ynote')).toBeNull()
    expect(card.querySelector('.foot')!.textContent).toMatch(/^Cada linha é um canal seu de Viagem;/)
    // jsdom has no layout: nothing overflows, so no hint and the box is not a tab stop
    expect(card.querySelector('[data-you-hint]')).toBeNull()
    expect(card.querySelector('.ybox')).toHaveAttribute('tabindex', '-1')
    expect(card.querySelector('.ybox')).not.toHaveAttribute('role')
  })

  it('the table says it scrolls sideways only when it really overflows', () => {
    const sw = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth'), cw = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')
    Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get() { return 640 } })
    Object.defineProperty(Element.prototype, 'clientWidth', { configurable: true, get() { return 500 } })
    try {
      const { container } = mount('viagem', undefined, OWNS['2'])
      const card = you(container)
      expect(card.querySelector('[data-you-hint]')!.textContent).toBe('Role a tabela para o lado para ver todas as colunas.')
      const box = card.querySelector('.ybox')!
      expect(box).toHaveAttribute('tabindex', '0')
      expect(box).toHaveAttribute('role', 'region')
      expect(box).toHaveAccessibleName('Tabela Você no nicho, rolável para o lado')
    } finally {
      if (sw) Object.defineProperty(Element.prototype, 'scrollWidth', sw)
      if (cw) Object.defineProperty(Element.prototype, 'clientWidth', cw)
    }
  })

  it('"Você no nicho" comes right after the hero and before "Cadência por canal"', () => {
    const { container } = mount('viagem', undefined, OWNS['2'])
    expect([...container.querySelectorAll('#grid > section')].map(s => s.id)).toEqual(['forjaCard', 'youCard', 'cadCard', 'gapCard', 'formCard', 'heatCard', 'themeCard'])
  })

  it('preset 1: one row, no language chip', () => {
    const { container } = mount('viagem', undefined, OWNS['1'])
    expect(you(container).querySelectorAll('tr[data-own]')).toHaveLength(1)
    expect(you(container).querySelector('.langtag')).toBeNull()
    expect(you(container).querySelector('.chead .meta')!.textContent).toBe('1 canal seu de Viagem, mesmo formato')
  })

  it('preset 2, IA: the empty state names where the channels are and links to Canais; no table', () => {
    const { container } = mount('ia', undefined, OWNS['2'])
    const card = you(container)
    expect(card.querySelector('table')).toBeNull()
    expect(card.querySelector('.foot')).toBeNull()
    expect(card.querySelector('.empty h3')!.textContent).toBe('Nenhum canal seu está em IA')
    expect(card.querySelector('.empty p')!.textContent).toContain('Você tem 2 canais: 2 de Viagem (tnFigueiredo e tnFigueiredo EN).')
    const links = [...card.querySelectorAll('.empty a.btn')]
    expect(links.map(a => [a.textContent, a.getAttribute('href')])).toEqual([['Ver seus canais', OWNS['2'].link.canais({})]])
  })

  it('preset zero, Viagem: one link per channel without a niche, then "Ver seus canais"', () => {
    const { container } = mount('viagem', undefined, OWNS.zero)
    expect([...you(container).querySelectorAll('.empty a.btn')].map(a => a.textContent)).toEqual(['Escolher o nicho de Mochila Leve', 'Ver seus canais'])
  })

  it('preset mix, Viagem: the note under the table names the channel without a niche, with its link', () => {
    const { container } = mount('viagem', undefined, OWNS.mix)
    const note = you(container).querySelector('.ynote')!
    expect(note.textContent).toBe('Mochila Leve está sem nicho e fica fora desta comparação. Escolher o nicho de Mochila Leve')
    expect(within(note as HTMLElement).getByRole('link', { name: 'Escolher o nicho de Mochila Leve' })).toHaveAttribute('href', OWNS.mix.link.canais({ channel: 'mochila-leve' }))
    expect(you(container).querySelectorAll('tr[data-own]')).toHaveLength(3)
  })

  it('preset 5, Shorts: the channel with no Short keeps its row — one cell across the four columns, no verdict', () => {
    const { container } = mount('viagem', 'short', OWNS['5'])
    const rows = you(container).querySelectorAll('tr[data-own]')
    expect(rows).toHaveLength(5)
    const empty = you(container).querySelectorAll('tr[data-empty]')
    expect(empty).toHaveLength(1)
    expect(empty[0]).toHaveAttribute('data-own', 'mochila-leve')
    const tds = empty[0]!.querySelectorAll('td')
    expect(tds).toHaveLength(1)
    expect(tds[0]!.colSpan).toBe(4)
    expect(tds[0]!.textContent).toBe('Sem Shorts nas últimas 13 semanas: não há o que comparar. A linha se preenche a partir do primeiro vídeo.')
    expect(empty[0]!.textContent).not.toMatch(/a mediana|[▲▼]/)
    expect(empty[0]!.querySelector('th .vb')!.textContent).toMatch(/^nenhum Short em 13 semanas · /)
  })

  it('no own channel at all: the connected-channel empty state, without links', () => {
    const d = structuredClone(ds); const own = new Set(d.channels.filter(c => c.own).map(c => c.id))
    d.channels = d.channels.filter(c => !c.own); d.videos = d.videos.filter(v => !own.has(v.ch))
    const { container } = mount('viagem', 'long', createObservatory(d))
    expect(you(container).querySelector('.empty h3')!.textContent).toBe('Nenhum canal seu conectado')
    expect(you(container).querySelectorAll('.empty a')).toHaveLength(0)
    expect(you(container).querySelector('table')).toBeNull()
    expect(noJunkText(container)).toEqual([])
  })

  it.each(PRESETS.flatMap(p => (['viagem', 'ia'] as const).flatMap(n => (['long', 'short'] as const).map(f => [p, n, f] as const))))('audits — preset %s, %s, %s: no junk, no forbidden word, no broken link; every text from the view model', (p, n, f) => {
    const view = buildInsightsView(OWNS[p], { niche: n, fmt: f })
    const { container } = render(<InsightsScreen view={view} />)
    expect(noJunkText(container)).toEqual([])
    expect(forbiddenVocabulary(container)).toEqual([])
    expect(brokenLinks(container)).toEqual([])
    you(container).querySelectorAll('a[href], [tabindex="0"]').forEach(el => expect(el).toHaveAccessibleName(/\S/))
    const json = JSON.stringify(view.youInNiche)
    const w = document.createTreeWalker(you(container), 4)
    const stray: string[] = []
    for (let node = w.nextNode(); node; node = w.nextNode()) {
      const t = node.textContent ?? ''
      if (!t.trim() || STATIC.has(t) || STATIC.has(t.trim())) continue
      if (!json.includes(JSON.stringify(t).slice(1, -1))) stray.push(t)
    }
    expect(stray).toEqual([])
  })
})

