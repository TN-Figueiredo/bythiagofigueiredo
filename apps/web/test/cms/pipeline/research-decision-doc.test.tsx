import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { DecisionWithSources } from '@/lib/pipeline/research-types'
import { DECISION_STATUS_META } from '@/lib/pipeline/research-types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/cms/pipeline/research',
}))

import { DecisionDoc } from '@/app/cms/(authed)/pipeline/research/_components/decision-doc'

// ---------------------------------------------------------------------------
// Fixture — all 5 new fields populated
// ---------------------------------------------------------------------------

const decision: DecisionWithSources = {
  id: 'dec-77',
  site_id: 'site-1',
  title: 'Todo vídeo de viagem mostra o contraste de preço em dólar',
  rationale: 'Diferencia o canal e dá utilidade concreta ao espectador.',
  horizon: 'agora',
  status: 'testando',
  theme_id: 'asia',
  date_label: '28 mai',
  drives: ['Roteiros', 'Newsletter'],
  context: 'O público pede comparações de custo de vida com frequência.',
  consequences: ['Toda thumbnail traz um valor em dólar', 'Roteiro abre com o preço'],
  metric: 'Retenção ≥ 45%',
  revisit: 'Fim de ago 2026',
  history: [
    { label: 'Decisão registrada', date: 'hoje', note: 'Primeira versão.' },
    { label: 'Movida para testando', date: 'ontem', note: null },
  ],
  sources: [
    { research_id: 'res-1', research_title: 'Estudo sobre custo de vida', note: null },
    { research_id: 'res-2', research_title: 'Pesquisa de audiência', note: null },
  ],
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

const baseProps = {
  decision,
  onBack: vi.fn(),
  onEdit: vi.fn(),
  onPatchStatus: vi.fn(),
  onOpenDoc: vi.fn(),
}

function renderDoc(props: Partial<React.ComponentProps<typeof DecisionDoc>> = {}) {
  return render(<DecisionDoc {...baseProps} {...props} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecisionDoc', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders the statement as an h1 and the rationale', () => {
    const { container } = renderDoc()
    const h1 = container.querySelector('h1')
    expect(h1).not.toBeNull()
    expect(h1!.textContent).toBe(decision.title)
    expect(screen.getByText(decision.rationale!)).toBeDefined()
  })

  it('renders the Contexto section only when context is present', () => {
    renderDoc()
    expect(screen.getByText('Contexto')).toBeDefined()
    expect(screen.getByText(decision.context!)).toBeDefined()

    cleanup()
    renderDoc({ decision: { ...decision, context: null } })
    expect(screen.queryByText('Contexto')).toBeNull()
  })

  it('renders the "O que isso decide" consequences list when consequences present', () => {
    renderDoc()
    expect(screen.getByText('O que isso decide')).toBeDefined()
    for (const c of decision.consequences) {
      expect(screen.getByText(c)).toBeDefined()
    }

    cleanup()
    renderDoc({ decision: { ...decision, consequences: [] } })
    expect(screen.queryByText('O que isso decide')).toBeNull()
  })

  it('renders the histórico timeline rows', () => {
    const { container } = renderDoc()
    expect(screen.getByText('Histórico')).toBeDefined()
    const rows = container.querySelectorAll('.dtl-row')
    expect(rows).toHaveLength(decision.history.length)
    expect(screen.getByText('Decisão registrada')).toBeDefined()
    expect(screen.getByText('Movida para testando')).toBeDefined()
    expect(screen.getByText('Primeira versão.')).toBeDefined()
  })

  it('renders metric and revisit in the inspector', () => {
    renderDoc()
    expect(screen.getByText('Retenção ≥ 45%')).toBeDefined()
    expect(screen.getByText('Fim de ago 2026')).toBeDefined()
  })

  it('status picker calls onPatchStatus(id, status) on click', () => {
    const onPatchStatus = vi.fn()
    renderDoc({ onPatchStatus })
    // Click the "Revisar" status option in the picker
    const revisarBtn = screen
      .getAllByText(DECISION_STATUS_META.revisar.label)
      .map((el) => el.closest('button'))
      .find((b) => b?.className.includes('dsp-opt'))!
    fireEvent.click(revisarBtn)
    expect(onPatchStatus).toHaveBeenCalledWith('dec-77', 'revisar')
  })

  it('Editar button calls onEdit(id)', () => {
    const onEdit = vi.fn()
    renderDoc({ onEdit })
    fireEvent.click(screen.getByText('Editar').closest('button')!)
    expect(onEdit).toHaveBeenCalledWith('dec-77')
  })

  it('back button calls onBack', () => {
    const onBack = vi.fn()
    renderDoc({ onBack })
    // Back button labelled with the section name "Decisões"
    fireEvent.click(screen.getByText('Decisões').closest('button')!)
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('clicking a fundamenta research link calls onOpenDoc(researchId)', () => {
    const onOpenDoc = vi.fn()
    renderDoc({ onOpenDoc })
    fireEvent.click(screen.getByText('Estudo sobre custo de vida').closest('button')!)
    expect(onOpenDoc).toHaveBeenCalledWith('res-1')
  })
})
