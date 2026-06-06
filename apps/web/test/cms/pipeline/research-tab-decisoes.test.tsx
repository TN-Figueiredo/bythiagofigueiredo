import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ResearchDecision } from '@/lib/pipeline/research-types'

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
import { TabDecisoes } from '@/app/cms/(authed)/pipeline/research/_components/tab-decisoes'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDecision(overrides: Partial<ResearchDecision> & { id?: string } = {}): ResearchDecision {
  return {
    id: 'dec-1',
    site_id: 'site-1',
    title: 'Adotar formato curto',
    rationale: 'Melhor engajamento',
    horizon: 'agora',
    status: 'decidido',
    theme_id: 'ia',
    date_label: '28 mai',
    drives: ['Roteiros', 'Newsletter'],
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...overrides,
  }
}

const baseProps = {
  decisions: [] as ResearchDecision[],
  decisionSources: {} as Record<string, Array<{ research_id: string; research_title: string; note: string | null }>>,
  onOpenItem: vi.fn(),
  onEditDecision: vi.fn(),
  onCreateDecision: vi.fn(),
}

// ---------------------------------------------------------------------------
// 1. Render tests
// ---------------------------------------------------------------------------

describe('TabDecisoes', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('render', () => {
    it('renders "Nova decisão" button in header', () => {
      render(<TabDecisoes {...baseProps} />)
      const buttons = screen.getAllByRole('button', { name: /Nova decisão/i })
      // Header button always present; empty state CTA may also render
      expect(buttons.length).toBeGreaterThanOrEqual(1)
      // The header button has margin-left: auto (flex alignment)
      const headerBtn = buttons.find((b) => b.style.marginLeft === 'auto')
      expect(headerBtn).toBeDefined()
    })

    it('renders filter chips for each horizon + "Todos os horizontes"', () => {
      render(<TabDecisoes {...baseProps} />)
      expect(screen.getByText('Todos os horizontes')).toBeDefined()
      expect(screen.getByText('Agora')).toBeDefined()
      expect(screen.getByText('Próximo')).toBeDefined()
      expect(screen.getByText('Explorar')).toBeDefined()
    })

    it('groups decisions by horizon', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', title: 'Dec agora' }),
        makeDecision({ id: 'd2', horizon: 'proximo', title: 'Dec proximo' }),
        makeDecision({ id: 'd3', horizon: 'explorar', title: 'Dec explorar' }),
      ]
      const { container } = render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // All three decision titles should be visible
      expect(screen.getByText('Dec agora')).toBeDefined()
      expect(screen.getByText('Dec proximo')).toBeDefined()
      expect(screen.getByText('Dec explorar')).toBeDefined()
      // Three horizon group headers should appear (dec-group-head class)
      const groupHeads = container.querySelectorAll('.dec-group-head')
      expect(groupHeads).toHaveLength(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Filter chips
  // ---------------------------------------------------------------------------

  describe('filter chips', () => {
    it('"Todas" is effectively selected by default (no horizon filter active)', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', title: 'Dec agora' }),
        makeDecision({ id: 'd2', horizon: 'proximo', title: 'Dec proximo' }),
      ]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // Both decisions visible when "Todas" is default
      expect(screen.getByText('Dec agora')).toBeDefined()
      expect(screen.getByText('Dec proximo')).toBeDefined()
    })

    it('clicking "Agora" chip filters to agora decisions only', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', title: 'Dec agora' }),
        makeDecision({ id: 'd2', horizon: 'proximo', title: 'Dec proximo' }),
        makeDecision({ id: 'd3', horizon: 'explorar', title: 'Dec explorar' }),
      ]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // Multiple elements named "Agora": the filter chip and possibly group headers / card chips.
      // The filter chip is the one with className containing "chip".
      const chipButtons = screen.getAllByRole('button').filter(
        (b) => b.textContent?.trim().startsWith('Agora') && b.className.includes('chip'),
      )
      fireEvent.click(chipButtons[0])
      // Only agora decision should remain visible
      expect(screen.getByText('Dec agora')).toBeDefined()
      expect(screen.queryByText('Dec proximo')).toBeNull()
      expect(screen.queryByText('Dec explorar')).toBeNull()
    })

    it('filter counts show correct numbers for non-archived decisions', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', status: 'decidido' }),
        makeDecision({ id: 'd2', horizon: 'agora', status: 'testando' }),
        makeDecision({ id: 'd3', horizon: 'proximo', status: 'decidido' }),
        makeDecision({ id: 'd4', horizon: 'explorar', status: 'revisar' }),
      ]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // Total non-archived = 4
      // The filter chip area contains count spans
      const buttons = screen.getAllByRole('button')
      const todasBtn = buttons.find((b) => b.textContent?.includes('Todos os horizontes'))
      expect(todasBtn?.textContent).toContain('4')
    })

    it('archived decisions excluded from counts', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', status: 'decidido' }),
        makeDecision({ id: 'd2', horizon: 'agora', status: 'arquivado' }),
        makeDecision({ id: 'd3', horizon: 'proximo', status: 'arquivado' }),
      ]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      const buttons = screen.getAllByRole('button')
      const todasBtn = buttons.find((b) => b.textContent?.includes('Todos os horizontes'))
      // Only 1 non-archived decision
      expect(todasBtn?.textContent).toContain('1')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Decision cards
  // ---------------------------------------------------------------------------

  describe('decision cards', () => {
    it('shows decision title', () => {
      const decisions = [makeDecision({ title: 'Investir em IA generativa' })]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      expect(screen.getByText('Investir em IA generativa')).toBeDefined()
    })

    it('shows horizon chip on card', () => {
      const decisions = [makeDecision({ horizon: 'explorar' })]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // HorizonChip renders HORIZON_META[horizon].label inside the card
      // "Explorar" appears both in the filter chip area and in the card's HorizonChip
      const explorars = screen.getAllByText('Explorar')
      // At least 2: one in the filter chip, one in the card horizon chip
      expect(explorars.length).toBeGreaterThanOrEqual(2)
    })

    it('shows status badge on card', () => {
      const decisions = [makeDecision({ status: 'testando' })]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // DecisionStatusBadge renders DECISION_STATUS_META label
      expect(screen.getByText('Testando')).toBeDefined()
    })

    it('shows drives tags', () => {
      const decisions = [makeDecision({ drives: ['Roteiros', 'Newsletter'] })]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      expect(screen.getByText('Roteiros')).toBeDefined()
      expect(screen.getByText('Newsletter')).toBeDefined()
    })

    it('shows date label when provided', () => {
      const decisions = [makeDecision({ date_label: '28 mai' })]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      expect(screen.getByText('28 mai')).toBeDefined()
    })

    it('clicking edit button calls onEditDecision with decision id', () => {
      const onEditDecision = vi.fn()
      const decisions = [makeDecision({ id: 'dec-42' })]
      render(<TabDecisoes {...baseProps} decisions={decisions} onEditDecision={onEditDecision} />)
      const editBtn = screen.getByTitle('Editar decisão')
      fireEvent.click(editBtn)
      expect(onEditDecision).toHaveBeenCalledWith('dec-42')
      expect(onEditDecision).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Backlinks
  // ---------------------------------------------------------------------------

  describe('backlinks', () => {
    it('shows research backlink chips when decisionSources has entries', () => {
      const decisions = [makeDecision({ id: 'dec-1', drives: [] })]
      const decisionSources = {
        'dec-1': [
          { research_id: 'res-1', research_title: 'Estudo sobre IA', note: null },
          { research_id: 'res-2', research_title: 'Analise de mercado', note: null },
        ],
      }
      render(
        <TabDecisoes
          {...baseProps}
          decisions={decisions}
          decisionSources={decisionSources}
        />,
      )
      expect(screen.getByText('Estudo sobre IA')).toBeDefined()
      expect(screen.getByText('Analise de mercado')).toBeDefined()
    })

    it('clicking a backlink chip calls onOpenItem with research_id', () => {
      const onOpenItem = vi.fn()
      const decisions = [makeDecision({ id: 'dec-1', drives: [] })]
      const decisionSources = {
        'dec-1': [
          { research_id: 'res-99', research_title: 'Pesquisa relevante', note: null },
        ],
      }
      render(
        <TabDecisoes
          {...baseProps}
          decisions={decisions}
          decisionSources={decisionSources}
          onOpenItem={onOpenItem}
        />,
      )
      fireEvent.click(screen.getByText('Pesquisa relevante'))
      expect(onOpenItem).toHaveBeenCalledWith('res-99')
      expect(onOpenItem).toHaveBeenCalledTimes(1)
    })

    it('still renders the footer when onOpen is set (Abrir affordance) even with no sources/drives', () => {
      const decisions = [makeDecision({ id: 'dec-1', drives: [] })]
      // onOpen is always threaded by TabDecisoes (onOpenDecision), so the footer
      // renders the "Abrir" affordance even when there are no backlinks/drives.
      const { container } = render(
        <TabDecisoes
          {...baseProps}
          decisions={decisions}
          decisionSources={{}}
          onOpenDecision={vi.fn()}
        />,
      )
      const linksSections = container.querySelectorAll('.dcard-links')
      expect(linksSections).toHaveLength(1)
      // No backlink/drive chips, just the Abrir affordance
      expect(container.querySelector('.link-chip')).toBeNull()
      expect(container.querySelector('.drive-chip')).toBeNull()
      expect(container.querySelector('.dcard-open')).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 4b. Clickable card -> onOpenDecision
  // ---------------------------------------------------------------------------

  describe('clickable card', () => {
    it('card body is a button (role="button") and clicking it calls onOpenDecision with the decision id', () => {
      const onOpenDecision = vi.fn()
      const decisions = [makeDecision({ id: 'dec-77', title: 'Decisao clicavel' })]
      const { container } = render(
        <TabDecisoes
          {...baseProps}
          decisions={decisions}
          onOpenDecision={onOpenDecision}
        />,
      )
      const card = container.querySelector('.dcard') as HTMLElement
      expect(card).not.toBeNull()
      expect(card.getAttribute('role')).toBe('button')
      fireEvent.click(card)
      expect(onOpenDecision).toHaveBeenCalledWith('dec-77')
      expect(onOpenDecision).toHaveBeenCalledTimes(1)
    })

    it('edit pencil stops propagation: calls onEditDecision but NOT onOpenDecision', () => {
      const onOpenDecision = vi.fn()
      const onEditDecision = vi.fn()
      const decisions = [makeDecision({ id: 'dec-88' })]
      render(
        <TabDecisoes
          {...baseProps}
          decisions={decisions}
          onOpenDecision={onOpenDecision}
          onEditDecision={onEditDecision}
        />,
      )
      fireEvent.click(screen.getByTitle('Editar decisão'))
      expect(onEditDecision).toHaveBeenCalledWith('dec-88')
      expect(onOpenDecision).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Create button
  // ---------------------------------------------------------------------------

  describe('create button', () => {
    it('"Nova decisao" header button calls onCreateDecision', () => {
      const onCreateDecision = vi.fn()
      render(<TabDecisoes {...baseProps} onCreateDecision={onCreateDecision} />)
      // When no decisions, both header and empty-state CTA buttons exist.
      // Target the header button (margin-left: auto).
      const buttons = screen.getAllByRole('button', { name: /Nova decisão/i })
      const headerBtn = buttons.find((b) => b.style.marginLeft === 'auto')!
      fireEvent.click(headerBtn)
      expect(onCreateDecision).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Empty state
  // ---------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows empty state with CTA when no decisions at all', () => {
      render(<TabDecisoes {...baseProps} decisions={[]} />)
      expect(screen.getByText('Nenhuma decisão registrada')).toBeDefined()
      expect(
        screen.getByText('Registre uma decisão ou transforme um takeaway de pesquisa.'),
      ).toBeDefined()
      // CTA button in empty state
      const novaButtons = screen.getAllByRole('button', { name: /Nova decisão/i })
      // One in the header, one in the empty state
      expect(novaButtons).toHaveLength(2)
    })

    it('shows "Nenhuma decisao neste horizonte" when filter yields no results', () => {
      const decisions = [
        makeDecision({ id: 'd1', horizon: 'agora', title: 'Dec agora' }),
      ]
      render(<TabDecisoes {...baseProps} decisions={decisions} />)
      // Click "Explorar" filter -- no decisions in this horizon
      fireEvent.click(screen.getByText('Explorar'))
      expect(screen.getByText('Nenhuma decisão neste horizonte')).toBeDefined()
      // The agora decision should not be visible
      expect(screen.queryByText('Dec agora')).toBeNull()
    })
  })
})
