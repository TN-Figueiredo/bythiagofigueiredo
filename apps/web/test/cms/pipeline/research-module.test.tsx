import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import {
  RESEARCH_STATUS,
  RESEARCH_SOURCE,
  DECISION_HORIZON,
  DECISION_STATUS,
  FOCO_STATE,
  THEME_IDS,
} from '@/lib/pipeline/research-schemas'
import {
  STATUS_META,
  THEME_META,
  HORIZON_META,
  DECISION_STATUS_META,
  SOURCE_META,
  FOCO_STATE_META,
} from '@/lib/pipeline/research-types'
import type {
  ResearchStats,
  ResearchItemSummary,
  FocoWithRelations,
  ResearchDecision,
  ResearchTheme,
} from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Mocks — next/navigation + sub-components that have deep dependency chains
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/cms/pipeline/research',
}))

// Mock child tab components to isolate module-level behavior
vi.mock('@/app/cms/(authed)/pipeline/research/_components/tab-foco', () => ({
  TabFoco: (props: Record<string, unknown>) => <div data-testid="tab-foco">TabFoco</div>,
}))

vi.mock('@/app/cms/(authed)/pipeline/research/_components/tab-pesquisas', () => ({
  TabPesquisas: (props: Record<string, unknown>) => <div data-testid="tab-pesquisas">TabPesquisas</div>,
}))

vi.mock('@/app/cms/(authed)/pipeline/research/_components/tab-decisoes', () => ({
  TabDecisoes: (props: Record<string, unknown>) => <div data-testid="tab-decisoes">TabDecisoes</div>,
}))

vi.mock('@/app/cms/(authed)/pipeline/research/_components/research-doc', () => ({
  ResearchDoc: (props: Record<string, unknown>) => <div data-testid="research-doc">ResearchDoc</div>,
}))

vi.mock('@/app/cms/(authed)/pipeline/research/_components/foco-drawer', () => ({
  FocoDrawer: (props: Record<string, unknown>) => <div data-testid="foco-drawer">FocoDrawer</div>,
}))

vi.mock('@/app/cms/(authed)/pipeline/research/_components/decision-drawer', () => ({
  DecisionDrawer: (props: Record<string, unknown>) => <div data-testid="decision-drawer">DecisionDrawer</div>,
}))

// Import after mocks
import { ResearchModule } from '@/app/cms/(authed)/pipeline/research/_components/research-module'

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => 'dismissed'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  })
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const emptyStats: ResearchStats = {
  total: 0,
  fresca: 0,
  analise: 0,
  aplicada: 0,
  arquivada: 0,
}

const baseProps = {
  items: [] as ResearchItemSummary[],
  stats: emptyStats,
  focos: [] as FocoWithRelations[],
  decisions: [] as ResearchDecision[],
  themes: [] as ResearchTheme[],
}

// ---------------------------------------------------------------------------
// 1. Schema enum arrays — structural integrity
// ---------------------------------------------------------------------------

describe('Research schema enum arrays', () => {
  it('RESEARCH_STATUS has exactly 4 entries', () => {
    expect(RESEARCH_STATUS).toEqual(['fresca', 'analise', 'aplicada', 'arquivada'])
    expect(RESEARCH_STATUS).toHaveLength(4)
  })

  it('RESEARCH_SOURCE has exactly 3 entries', () => {
    expect(RESEARCH_SOURCE).toEqual(['cowork', 'thiago', 'dupla'])
    expect(RESEARCH_SOURCE).toHaveLength(3)
  })

  it('DECISION_HORIZON has exactly 3 entries', () => {
    expect(DECISION_HORIZON).toEqual(['agora', 'proximo', 'explorar'])
    expect(DECISION_HORIZON).toHaveLength(3)
  })

  it('DECISION_STATUS has exactly 4 entries', () => {
    expect(DECISION_STATUS).toEqual(['decidido', 'testando', 'revisar', 'arquivado'])
    expect(DECISION_STATUS).toHaveLength(4)
  })

  it('FOCO_STATE has exactly 4 entries', () => {
    expect(FOCO_STATE).toEqual(['ativo', 'proposto', 'rascunho', 'arquivado'])
    expect(FOCO_STATE).toHaveLength(4)
  })

  it('THEME_IDS has exactly 6 entries', () => {
    expect(THEME_IDS).toEqual(['asia', 'ia', 'dev', 'games', 'grana', 'canal'])
    expect(THEME_IDS).toHaveLength(6)
  })
})

// ---------------------------------------------------------------------------
// 2. Meta records match their enum arrays (no drift)
// ---------------------------------------------------------------------------

describe('Meta records match schema enums', () => {
  it('STATUS_META keys match RESEARCH_STATUS', () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...RESEARCH_STATUS].sort())
  })

  it('THEME_META keys match THEME_IDS', () => {
    expect(Object.keys(THEME_META).sort()).toEqual([...THEME_IDS].sort())
  })

  it('HORIZON_META keys match DECISION_HORIZON', () => {
    expect(Object.keys(HORIZON_META).sort()).toEqual([...DECISION_HORIZON].sort())
  })

  it('DECISION_STATUS_META keys match DECISION_STATUS', () => {
    expect(Object.keys(DECISION_STATUS_META).sort()).toEqual([...DECISION_STATUS].sort())
  })

  it('SOURCE_META keys match RESEARCH_SOURCE', () => {
    expect(Object.keys(SOURCE_META).sort()).toEqual([...RESEARCH_SOURCE].sort())
  })

  it('FOCO_STATE_META keys match FOCO_STATE', () => {
    expect(Object.keys(FOCO_STATE_META).sort()).toEqual([...FOCO_STATE].sort())
  })
})

// ---------------------------------------------------------------------------
// 3. ResearchModule tab structure & readHashTab behavior
// ---------------------------------------------------------------------------

describe('ResearchModule tab structure', () => {
  beforeEach(() => {
    cleanup()
    window.location.hash = ''
  })

  it('renders exactly 3 tab buttons', () => {
    render(<ResearchModule {...baseProps} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
  })

  it('tab ids are foco, pesquisas, decisoes', () => {
    render(<ResearchModule {...baseProps} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0].id).toBe('tab-foco')
    expect(tabs[1].id).toBe('tab-pesquisas')
    expect(tabs[2].id).toBe('tab-decisoes')
  })

  it('tab labels are Foco, Pesquisas, Decisões', () => {
    render(<ResearchModule {...baseProps} />)
    expect(screen.getByText('Foco')).toBeDefined()
    expect(screen.getByText('Pesquisas')).toBeDefined()
    expect(screen.getByText('Decisões')).toBeDefined()
  })

  it('defaults to foco tab (aria-selected=true)', () => {
    render(<ResearchModule {...baseProps} />)
    const focoTab = screen.getByRole('tab', { name: /Foco/i })
    expect(focoTab.getAttribute('aria-selected')).toBe('true')
  })

  it('readHashTab defaults to foco when no hash', () => {
    window.location.hash = ''
    render(<ResearchModule {...baseProps} />)
    const focoTab = screen.getByRole('tab', { name: /Foco/i })
    expect(focoTab.getAttribute('aria-selected')).toBe('true')
  })

  it('readHashTab reads valid hash #pesquisas', () => {
    window.location.hash = '#pesquisas'
    render(<ResearchModule {...baseProps} />)
    const pesquisasTab = screen.getByRole('tab', { name: /Pesquisas/i })
    expect(pesquisasTab.getAttribute('aria-selected')).toBe('true')
  })

  it('readHashTab reads valid hash #decisoes', () => {
    window.location.hash = '#decisoes'
    render(<ResearchModule {...baseProps} />)
    const decisoesTab = screen.getByRole('tab', { name: /Decisões/i })
    expect(decisoesTab.getAttribute('aria-selected')).toBe('true')
  })

  it('readHashTab falls back to foco for invalid hash', () => {
    window.location.hash = '#invalid'
    render(<ResearchModule {...baseProps} />)
    const focoTab = screen.getByRole('tab', { name: /Foco/i })
    expect(focoTab.getAttribute('aria-selected')).toBe('true')
  })

  it('switching tabs updates aria-selected', () => {
    render(<ResearchModule {...baseProps} />)
    const pesquisasTab = screen.getByRole('tab', { name: /Pesquisas/i })
    fireEvent.click(pesquisasTab)
    expect(pesquisasTab.getAttribute('aria-selected')).toBe('true')
    const focoTab = screen.getByRole('tab', { name: /Foco/i })
    expect(focoTab.getAttribute('aria-selected')).toBe('false')
  })

  it('tab bar has correct aria-label', () => {
    render(<ResearchModule {...baseProps} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.getAttribute('aria-label')).toBe('Secoes da pesquisa')
  })

  it('each tab panel has tabpanel role', () => {
    render(<ResearchModule {...baseProps} />)
    const panels = screen.getAllByRole('tabpanel')
    expect(panels.length).toBeGreaterThanOrEqual(1)
  })

  it('renders module header with "Research"', () => {
    render(<ResearchModule {...baseProps} />)
    expect(screen.getByText('Research')).toBeDefined()
  })

  it('renders TabFoco mock when foco tab is active', () => {
    render(<ResearchModule {...baseProps} />)
    expect(screen.getByTestId('tab-foco')).toBeDefined()
  })

  it('renders TabPesquisas mock when pesquisas tab is selected', () => {
    render(<ResearchModule {...baseProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /Pesquisas/i }))
    expect(screen.getByTestId('tab-pesquisas')).toBeDefined()
  })

  it('renders TabDecisoes mock when decisoes tab is selected', () => {
    render(<ResearchModule {...baseProps} />)
    fireEvent.click(screen.getByRole('tab', { name: /Decisões/i }))
    expect(screen.getByTestId('tab-decisoes')).toBeDefined()
  })
})
