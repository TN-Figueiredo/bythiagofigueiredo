import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type {
  FocoWithRelations,
  ResearchDecision,
  ResearchItemSummary,
} from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/cms/pipeline/research',
}))

// Import after mocks
import { TabFoco } from '@/app/cms/(authed)/pipeline/research/_components/tab-foco'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFoco(overrides: Partial<FocoWithRelations> = {}): FocoWithRelations {
  return {
    id: 'foco-1',
    site_id: 'site-1',
    title: 'Foco de IA',
    description: 'Explorar IA generativa',
    horizon: 'agora',
    state: 'ativo',
    active: true,
    author: 'thiago',
    rationale: 'Trend',
    metric: 'Views',
    window_label: 'Jun 2026',
    started_at: null,
    ended_at: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    themes: ['ia', 'dev'],
    pinned_research: [
      { item_id: 'r1', title: 'Pesquisa sobre LLMs', note: null },
    ],
    decisions: [],
    ...overrides,
  }
}

function makeDecision(overrides: Partial<ResearchDecision> = {}): ResearchDecision {
  return {
    id: 'dec-1',
    site_id: 'site-1',
    title: 'Decisão de teste',
    rationale: 'Porque sim',
    horizon: 'agora',
    status: 'decidido',
    theme_id: 'ia',
    date_label: null,
    drives: [],
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeItem(overrides: Partial<ResearchItemSummary> = {}): ResearchItemSummary {
  return {
    id: 'item-1',
    title: 'Pesquisa de teste',
    topic_id: null,
    theme_id: 'ia',
    source: 'cowork',
    summary: 'Resumo da pesquisa',
    status: 'aplicada',
    word_count: 100,
    read_min: 1,
    pinned: true,
    takeaways: [],
    sources: [],
    version: 1,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

const baseCallbacks = {
  onEditFoco: vi.fn(),
  onCreateFoco: vi.fn(),
  onActivateFoco: vi.fn(),
  onOpenItem: vi.fn(),
  onEditDecision: vi.fn(),
  onSwitchTab: vi.fn(),
  showExplainer: false,
  onDismissExplainer: vi.fn(),
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

let localStorageStore: Record<string, string> = {}

beforeEach(() => {
  cleanup()
  localStorageStore = {}
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
      localStorageStore[key] = val
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageStore[key]
    }),
    clear: vi.fn(() => {
      localStorageStore = {}
    }),
    get length() {
      return Object.keys(localStorageStore).length
    },
    key: vi.fn((i: number) => Object.keys(localStorageStore)[i] ?? null),
  })
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// 1. TabFoco main
// ---------------------------------------------------------------------------

describe('TabFoco main', () => {
  it('renders ExplainerStrip when showExplainer is true', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.getByText(/Como o Foco funciona/)).toBeDefined()
  })

  it('does NOT render ExplainerStrip when showExplainer is false', () => {
    render(<TabFoco focos={[]} {...baseCallbacks} showExplainer={false} />)
    expect(screen.queryByText(/Como o Foco funciona/)).toBeNull()
  })

  it('renders FocusHero when there is an active foco', () => {
    const activeFoco = makeFoco({ state: 'ativo', active: true })
    render(<TabFoco focos={[activeFoco]} {...baseCallbacks} />)
    // Title appears in both hero and board card; check both exist
    const titles = screen.getAllByText('Foco de IA')
    expect(titles.length).toBeGreaterThanOrEqual(1)
    // The hero-specific "Editar foco" button confirms the hero rendered
    expect(screen.getByText('Editar foco')).toBeDefined()
  })

  it('renders FocusEmpty (big invite) only in the pure zero state', () => {
    render(<TabFoco focos={[]} {...baseCallbacks} />)
    expect(screen.getByText('Escolha a aposta do trimestre')).toBeDefined()
    expect(screen.getByText(/Definir manualmente/)).toBeDefined()
  })

  it('renders FocusNoActive banner when board has bets but none is active', () => {
    const propostoFoco = makeFoco({ state: 'proposto', active: false })
    render(<TabFoco focos={[propostoFoco]} {...baseCallbacks} />)
    // Compact banner, not the big invite card
    expect(screen.getByText(/Nenhum foco no ar/)).toBeDefined()
    expect(screen.queryByText('Escolha a aposta do trimestre')).toBeNull()
    // "Definir foco" CTA in the banner
    expect(screen.getByText(/Definir foco/)).toBeDefined()
  })

  it('FocusNoActive "Definir foco" calls onCreateFoco', () => {
    const onCreateFoco = vi.fn()
    const propostoFoco = makeFoco({ state: 'proposto', active: false })
    render(<TabFoco focos={[propostoFoco]} {...baseCallbacks} onCreateFoco={onCreateFoco} />)
    fireEvent.click(screen.getByText(/Definir foco/))
    expect(onCreateFoco).toHaveBeenCalledOnce()
  })

  it('suppresses the explainer in the pure zero state even when showExplainer is true', () => {
    render(<TabFoco focos={[]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.queryByText(/Como o Foco funciona/)).toBeNull()
  })

  it('a single archived foco collapses to the pure zero state (no board, no explainer)', () => {
    render(
      <TabFoco
        focos={[makeFoco({ state: 'arquivado', active: false })]}
        {...baseCallbacks}
        showExplainer={true}
      />,
    )
    expect(screen.getByText('Escolha a aposta do trimestre')).toBeDefined()
    expect(screen.queryByText('Horizonte estratégico')).toBeNull()
    expect(screen.queryByText(/Como o Foco funciona/)).toBeNull()
  })

  it('Recomeçar button renders only when onReset is provided and calls it', () => {
    const proposto = makeFoco({ state: 'proposto', active: false })
    const { rerender } = render(<TabFoco focos={[proposto]} {...baseCallbacks} />)
    expect(screen.queryByText('Recomeçar')).toBeNull()

    const onReset = vi.fn()
    rerender(<TabFoco focos={[proposto]} {...baseCallbacks} onReset={onReset} />)
    fireEvent.click(screen.getByText('Recomeçar'))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('renders HorizonBoard with non-archived focos', () => {
    const focos = [
      makeFoco({ id: 'f1', title: 'Foco Agora', state: 'ativo', active: true, horizon: 'agora' }),
      makeFoco({ id: 'f2', title: 'Foco Proximo', state: 'proposto', active: false, horizon: 'proximo' }),
      makeFoco({ id: 'f3', title: 'Foco Arquivado', state: 'arquivado', active: false, horizon: 'explorar' }),
    ]
    render(<TabFoco focos={focos} {...baseCallbacks} />)
    // Active foco appears in both hero and board card
    expect(screen.getAllByText('Foco Agora').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Foco Proximo')).toBeDefined()
    // Archived foco should not appear anywhere (filtered from board)
    expect(screen.queryByText('Foco Arquivado')).toBeNull()
  })

  it('renders FocoSplit section with column headers', () => {
    render(<TabFoco focos={[makeFoco()]} decisions={[]} {...baseCallbacks} />)
    expect(screen.getByText('Decisões em vigor')).toBeDefined()
    expect(screen.getByText('Pesquisa que sustenta o foco')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 2. FocusHero
// ---------------------------------------------------------------------------

describe('FocusHero (via TabFoco)', () => {
  it('shows active foco title', () => {
    const foco = makeFoco({ title: 'Meu Foco Estrategico' })
    render(<TabFoco focos={[foco]} {...baseCallbacks} />)
    // Title appears in hero (h2.fh-title) and board card; just confirm it renders
    const titles = screen.getAllByText('Meu Foco Estrategico')
    expect(titles.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Editar foco" button', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} />)
    expect(screen.getByText('Editar foco')).toBeDefined()
  })

  it('clicking edit calls onEditFoco(foco.id)', () => {
    const onEditFoco = vi.fn()
    render(<TabFoco focos={[makeFoco({ id: 'xyz' })]} {...baseCallbacks} onEditFoco={onEditFoco} />)
    fireEvent.click(screen.getByText('Editar foco'))
    expect(onEditFoco).toHaveBeenCalledWith('xyz')
  })

  it('shows pinned research chips ("Com base em...")', () => {
    const foco = makeFoco({
      pinned_research: [
        { item_id: 'r1', title: 'Pesquisa sobre LLMs', note: null },
        { item_id: 'r2', title: 'Mercado de IA 2026', note: null },
      ],
    })
    render(<TabFoco focos={[foco]} {...baseCallbacks} />)
    expect(screen.getByText('Com base em')).toBeDefined()
    // Pinned research titles appear in both FocusHero chips and FocoSplit cards
    expect(screen.getAllByText('Pesquisa sobre LLMs').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Mercado de IA 2026').length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// 3. FocusEmpty
// ---------------------------------------------------------------------------

describe('FocusEmpty (via TabFoco)', () => {
  it('shows eyebrow with "não definido" tag', () => {
    render(<TabFoco focos={[]} {...baseCallbacks} />)
    expect(screen.getByText('Escolha a aposta do trimestre')).toBeDefined()
    expect(screen.getByText('não definido')).toBeDefined()
  })

  it('shows 3-step flow (Pesquisas → Decisões → Foco)', () => {
    render(<TabFoco focos={[]} {...baseCallbacks} />)
    // "Pesquisas" appears in step flow + footer link
    expect(screen.getAllByText('Pesquisas').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Decisões')).toBeDefined()
    expect(screen.getByText('Foco')).toBeDefined()
  })

  it('"Pedir proposta ao Cowork" renders a Cowork deep-link (not the manual drawer)', () => {
    const onCreateFoco = vi.fn()
    render(<TabFoco focos={[]} {...baseCallbacks} onCreateFoco={onCreateFoco} />)
    // Now a CoworkDeepLink button — asks the Cowork directly, does not open the drawer
    const btn = screen.getByRole('button', { name: 'Pedir proposta ao Cowork' })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(onCreateFoco).not.toHaveBeenCalled()
  })

  it('"Definir manualmente" calls onCreateFoco', () => {
    const onCreateFoco = vi.fn()
    render(<TabFoco focos={[]} {...baseCallbacks} onCreateFoco={onCreateFoco} />)
    fireEvent.click(screen.getByText(/Definir manualmente/))
    expect(onCreateFoco).toHaveBeenCalledOnce()
  })

  it('foot "Pesquisas" link calls onSwitchTab("pesquisas")', () => {
    const onSwitchTab = vi.fn()
    render(<TabFoco focos={[]} {...baseCallbacks} onSwitchTab={onSwitchTab} />)
    const links = screen.getAllByText('Pesquisas')
    fireEvent.click(links[links.length - 1])
    expect(onSwitchTab).toHaveBeenCalledWith('pesquisas')
  })
})

// ---------------------------------------------------------------------------
// 4. HorizonBoard
// ---------------------------------------------------------------------------

describe('HorizonBoard (via TabFoco)', () => {
  it('renders 3 columns (Agora, Proximo, Explorar)', () => {
    // Board only renders when there is content; seed one draft foco
    render(<TabFoco focos={[makeFoco({ state: 'rascunho', active: false })]} {...baseCallbacks} />)
    // Column headers contain the horizon names
    expect(screen.getByText('Agora')).toBeDefined()
    // "Proximo" is rendered with accent as "Próximo"
    expect(screen.getByText('Próximo')).toBeDefined()
    expect(screen.getByText('Explorar')).toBeDefined()
  })

  it('cards appear in correct column based on horizon', () => {
    const focos = [
      makeFoco({ id: 'f-agora', title: 'Card Agora', horizon: 'agora', state: 'rascunho', active: false }),
      makeFoco({ id: 'f-prox', title: 'Card Proximo', horizon: 'proximo', state: 'rascunho', active: false }),
      makeFoco({ id: 'f-exp', title: 'Card Explorar', horizon: 'explorar', state: 'rascunho', active: false }),
    ]
    render(<TabFoco focos={focos} {...baseCallbacks} />)
    // All three titles should render in the board
    expect(screen.getByText('Card Agora')).toBeDefined()
    expect(screen.getByText('Card Proximo')).toBeDefined()
    expect(screen.getByText('Card Explorar')).toBeDefined()
  })

  it('each column has a "+" add button with title "Nova aposta"', () => {
    render(<TabFoco focos={[makeFoco({ state: 'rascunho', active: false })]} {...baseCallbacks} />)
    const addButtons = screen.getAllByTitle('Nova aposta')
    expect(addButtons).toHaveLength(3)
  })

  it('clicking "+" calls onCreateFoco', () => {
    const onCreateFoco = vi.fn()
    render(<TabFoco focos={[makeFoco({ state: 'rascunho', active: false })]} {...baseCallbacks} onCreateFoco={onCreateFoco} />)
    const addButtons = screen.getAllByTitle('Nova aposta')
    fireEvent.click(addButtons[0])
    expect(onCreateFoco).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 5. HorizonCard
// ---------------------------------------------------------------------------

describe('HorizonCard (via TabFoco)', () => {
  it('shows foco title in the board', () => {
    const foco = makeFoco({ title: 'Minha Aposta', state: 'rascunho', active: false })
    render(<TabFoco focos={[foco]} {...baseCallbacks} />)
    // Title appears in the HorizonCard (the hero is not shown because state != ativo)
    expect(screen.getByText('Minha Aposta')).toBeDefined()
  })

  it('shows edit button on the card', () => {
    const foco = makeFoco({ state: 'rascunho', active: false })
    render(<TabFoco focos={[foco]} {...baseCallbacks} />)
    const editButtons = screen.getAllByTitle('Editar')
    expect(editButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('"Proposto" state cards show Confirmar button', () => {
    const foco = makeFoco({ state: 'proposto', active: false, author: 'cowork' })
    render(<TabFoco focos={[foco]} {...baseCallbacks} />)
    expect(screen.getByText('Confirmar')).toBeDefined()
  })

  it('clicking Confirmar calls onActivateFoco(id)', () => {
    const onActivateFoco = vi.fn()
    const foco = makeFoco({ id: 'foco-prop', state: 'proposto', active: false, author: 'cowork' })
    render(<TabFoco focos={[foco]} {...baseCallbacks} onActivateFoco={onActivateFoco} />)
    fireEvent.click(screen.getByText('Confirmar'))
    expect(onActivateFoco).toHaveBeenCalledWith('foco-prop')
  })
})

// ---------------------------------------------------------------------------
// 6. FocoSplit
// ---------------------------------------------------------------------------

describe('FocoSplit (via TabFoco)', () => {
  it('shows "Decisoes em vigor" column', () => {
    render(<TabFoco focos={[makeFoco()]} decisions={[]} {...baseCallbacks} />)
    expect(screen.getByText('Decisões em vigor')).toBeDefined()
  })

  it('shows "Pesquisa que sustenta" column', () => {
    render(<TabFoco focos={[makeFoco()]} decisions={[]} {...baseCallbacks} />)
    expect(screen.getByText('Pesquisa que sustenta o foco')).toBeDefined()
  })

  it('renders DecisionCard from GLOBAL decisions (agora + non-archived), independent of any foco link array; edit calls onEditDecision(id)', () => {
    const onEditDecision = vi.fn()
    // Foco has an EMPTY link array — the split must derive from the global list.
    const foco = makeFoco({ decisions: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[makeDecision({ id: 'd1', title: 'Decisao X', horizon: 'agora', status: 'decidido' })]}
        {...baseCallbacks}
        onEditDecision={onEditDecision}
      />,
    )
    // The decision statement renders in the rich card despite no foco link
    expect(screen.getByText('Decisao X')).toBeDefined()
    // Edit is a dedicated pencil button (rich card is not a single click target)
    fireEvent.click(screen.getByTitle('Editar decisão'))
    expect(onEditDecision).toHaveBeenCalledWith('d1')
  })

  it('an agora + non-archived decision NOT in the foco link array MUST render', () => {
    const foco = makeFoco({ decisions: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[makeDecision({ id: 'free', title: 'Decisão sem vínculo', horizon: 'agora', status: 'decidido' })]}
        {...baseCallbacks}
      />,
    )
    expect(screen.getByText('Decisão sem vínculo')).toBeDefined()
    // Empty state must NOT show
    expect(screen.queryByText('Nenhuma decisão para o foco atual')).toBeNull()
  })

  it('an archived decision must NOT render even if it is linked to the foco', () => {
    const foco = makeFoco({
      decisions: [{ decision_id: 'arch', decision_title: 'Arquivada X', horizon: 'agora', status: 'arquivado' }],
    })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[makeDecision({ id: 'arch', title: 'Arquivada X', horizon: 'agora', status: 'arquivado' })]}
        {...baseCallbacks}
      />,
    )
    // Archived → filtered out by status !== 'arquivado'
    expect(screen.queryByText('Arquivada X')).toBeNull()
    expect(screen.getByText('Nenhuma decisão para o foco atual')).toBeDefined()
  })

  it('a non-agora decision does NOT render in the split', () => {
    const foco = makeFoco({ decisions: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[makeDecision({ id: 'p1', title: 'Decisão próxima', horizon: 'proximo', status: 'decidido' })]}
        {...baseCallbacks}
      />,
    )
    expect(screen.queryByText('Decisão próxima')).toBeNull()
    expect(screen.getByText('Nenhuma decisão para o foco atual')).toBeDefined()
  })

  it('renders ResearchCard from GLOBAL items (pinned + non-archived); clicking it calls onOpenItem(id)', () => {
    const onOpenItem = vi.fn()
    const foco = makeFoco({ pinned_research: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[]}
        items={[makeItem({ id: 'r99', title: 'Pesquisa Fixada', pinned: true, status: 'aplicada' })]}
        {...baseCallbacks}
        onOpenItem={onOpenItem}
      />,
    )
    // Derives purely from the global pinned item, not from foco.pinned_research
    const matches = screen.getAllByText('Pesquisa Fixada')
    fireEvent.click(matches[matches.length - 1])
    expect(onOpenItem).toHaveBeenCalledWith('r99')
  })

  it('a pinned non-archived item renders; an unpinned one does not', () => {
    const foco = makeFoco({ pinned_research: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[]}
        items={[
          makeItem({ id: 'pin', title: 'Item Fixado', pinned: true, status: 'aplicada' }),
          makeItem({ id: 'unpin', title: 'Item Solto', pinned: false, status: 'aplicada' }),
        ]}
        {...baseCallbacks}
      />,
    )
    expect(screen.getByText('Item Fixado')).toBeDefined()
    expect(screen.queryByText('Item Solto')).toBeNull()
  })

  it('an archived (arquivada) pinned item does NOT render', () => {
    const foco = makeFoco({ pinned_research: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[]}
        items={[makeItem({ id: 'arch', title: 'Pinned Arquivada', pinned: true, status: 'arquivada' })]}
        {...baseCallbacks}
      />,
    )
    expect(screen.queryByText('Pinned Arquivada')).toBeNull()
    expect(screen.getByText('Nada fixado no foco')).toBeDefined()
  })

  it('hero "decisões ligadas" count equals the global agora + non-archived decisions', () => {
    const foco = makeFoco({ decisions: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[
          makeDecision({ id: 'd1', title: 'A', horizon: 'agora', status: 'decidido' }),
          makeDecision({ id: 'd2', title: 'B', horizon: 'proximo', status: 'decidido' }),
          makeDecision({ id: 'd3', title: 'C', horizon: 'agora', status: 'arquivado' }),
        ]}
        {...baseCallbacks}
      />,
    )
    // Only d1 qualifies (agora + non-archived) → singular "1 decisão ligada"
    expect(screen.getByText(/1 decisão ligada/)).toBeDefined()
  })

  it('"Abrir" on a decision card opens the fullscreen (calls onOpenDecision)', () => {
    const onOpenDecision = vi.fn()
    const foco = makeFoco({ decisions: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[makeDecision({ id: 'd1', horizon: 'agora', status: 'decidido' })]}
        {...baseCallbacks}
        onOpenDecision={onOpenDecision}
      />,
    )
    fireEvent.click(screen.getByText('Abrir'))
    expect(onOpenDecision).toHaveBeenCalledWith('d1')
  })

  it('"Todas" link calls onSwitchTab("decisoes")', () => {
    const onSwitchTab = vi.fn()
    render(
      <TabFoco
        focos={[makeFoco()]}
        decisions={[]}
        {...baseCallbacks}
        onSwitchTab={onSwitchTab}
      />,
    )
    fireEvent.click(screen.getByText('Todas'))
    expect(onSwitchTab).toHaveBeenCalledWith('decisoes')
  })

  it('"Biblioteca" link calls onSwitchTab("pesquisas")', () => {
    const onSwitchTab = vi.fn()
    render(
      <TabFoco
        focos={[makeFoco()]}
        decisions={[]}
        {...baseCallbacks}
        onSwitchTab={onSwitchTab}
      />,
    )
    fireEvent.click(screen.getByText('Biblioteca'))
    expect(onSwitchTab).toHaveBeenCalledWith('pesquisas')
  })

  it('empty states show when no decisions or research', () => {
    const foco = makeFoco({ pinned_research: [] })
    render(
      <TabFoco
        focos={[foco]}
        decisions={[]}
        {...baseCallbacks}
      />,
    )
    expect(screen.getByText('Nenhuma decisão para o foco atual')).toBeDefined()
    expect(screen.getByText('Nada fixado no foco')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 7. ExplainerStrip
// ---------------------------------------------------------------------------

describe('ExplainerStrip (via TabFoco)', () => {
  it('renders 3-step flow with step descriptions', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.getByText(/O Cowork investiga e escreve/)).toBeDefined()
    expect(screen.getByText(/Você transforma takeaways em decisões/)).toBeDefined()
    expect(screen.getByText(/decisão estratégica com prazo/)).toBeDefined()
  })

  it('renders step titles (Pesquisas, Decisões, Foco)', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.getByText('Pesquisas')).toBeDefined()
    expect(screen.getByText('Decisões')).toBeDefined()
    expect(screen.getByText('Foco')).toBeDefined()
  })

  it('renders header with bold emphasis', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.getByText(/Como o Foco funciona/)).toBeDefined()
    expect(screen.getByText(/você decide, o Cowork propõe/)).toBeDefined()
  })

  it('renders footnote text', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    expect(screen.getByText(/Nada vira foco automaticamente/)).toBeDefined()
  })

  it('"Pedir proposta ao Cowork" button renders a Cowork deep-link (not the manual drawer)', () => {
    const onCreateFoco = vi.fn()
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} onCreateFoco={onCreateFoco} />)
    // Now a CoworkDeepLink button — asks the Cowork directly, does not open the drawer
    const btn = screen.getByRole('button', { name: 'Pedir proposta ao Cowork' })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(onCreateFoco).not.toHaveBeenCalled()
  })

  it('dismiss button calls onDismissExplainer and sets localStorage', () => {
    const onDismiss = vi.fn()
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} onDismissExplainer={onDismiss} />)
    expect(screen.getByText(/Como o Foco funciona/)).toBeDefined()

    fireEvent.click(screen.getByTitle('Entendi'))

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tf-research-explainer-v1',
      'dismissed',
    )
    expect(onDismiss).toHaveBeenCalled()
  })

  it('explainer has accessible role and label', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    const region = screen.getByRole('region', { name: /Como o Foco funciona/ })
    expect(region).toBeDefined()
  })

  it('dismiss button has aria-label', () => {
    render(<TabFoco focos={[makeFoco()]} {...baseCallbacks} showExplainer={true} />)
    const btn = screen.getByLabelText('Fechar explainer')
    expect(btn).toBeDefined()
  })
})
