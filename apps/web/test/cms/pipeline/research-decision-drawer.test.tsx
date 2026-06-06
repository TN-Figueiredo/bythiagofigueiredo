import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { ResearchDecision } from '@/lib/pipeline/research-types'
import {
  THEME_META,
  HORIZON_META,
  DECISION_STATUS_META,
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

const mockCreateDecision = vi.fn().mockResolvedValue({ ok: true })
const mockUpdateDecision = vi.fn().mockResolvedValue({ ok: true })

vi.mock(
  '../../../src/app/cms/(authed)/pipeline/research/decision-actions',
  () => ({
    createResearchDecision: mockCreateDecision,
    updateResearchDecision: mockUpdateDecision,
  })
)

// Import after mocks
import {
  DecisionDrawer,
  type DecisionResearchOption,
} from '@/app/cms/(authed)/pipeline/research/_components/decision-drawer'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const noop = () => {}

const researchOptions: DecisionResearchOption[] = [
  { id: 'res-1', title: 'Estudo sobre IA', theme_id: 'ia' },
  { id: 'res-2', title: 'Analise de mercado', theme_id: 'grana' },
]

const baseDecision: ResearchDecision = {
  id: 'dec-00000000-0000-0000-0000-000000000001',
  site_id: 'site-1',
  title: 'Adotar formato curto',
  rationale: 'Engajamento melhor em Shorts',
  horizon: 'proximo',
  status: 'testando',
  theme_id: 'ia',
  date_label: '28 mai',
  drives: ['Roteiros', 'Newsletter'],
  context: 'Contexto da decisao',
  consequences: ['Conseq A'],
  metric: 'Retencao >= 45%',
  revisit: 'Fim de ago 2026',
  history: [],
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
}

// -- placeholders / labels used across tests --------------------------------
const STATEMENT_PLACEHOLDER =
  'Ex.: Todo vídeo de viagem mostra o contraste de preço em dólar.'
const RATIONALE_PLACEHOLDER = 'A lógica curta por trás da decisão.'

/** Render helper that always supplies the new required researchOptions prop. */
function renderDrawer(props: Partial<React.ComponentProps<typeof DecisionDrawer>> = {}) {
  return render(
    <DecisionDrawer
      researchOptions={props.researchOptions ?? researchOptions}
      onClose={props.onClose ?? noop}
      onSaved={props.onSaved ?? noop}
      initial={props.initial}
      prefillStatement={props.prefillStatement}
      prefillTheme={props.prefillTheme}
    />
  )
}

// ---------------------------------------------------------------------------
// 1. Render tests
// ---------------------------------------------------------------------------

describe('DecisionDrawer — render', () => {
  afterEach(cleanup)

  it('renders in create mode with dialog label "Nova decisão"', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Nova decisão')
    // Header title + primary button share text; ensure the header label is present
    expect(screen.getAllByText('Nova decisão').length).toBeGreaterThanOrEqual(1)
  })

  it('renders in edit mode with dialog label "Editar decisão" when initial has an id', () => {
    renderDrawer({ initial: baseDecision })
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Editar decisão')
    expect(screen.getByText('Editar decisão')).toBeDefined()
  })

  it('statement textarea gets autoFocus on mount', () => {
    renderDrawer()
    const input = screen.getByPlaceholderText(STATEMENT_PLACEHOLDER)
    expect(document.activeElement === input).toBe(true)
  })

  it('renders the new field labels', () => {
    renderDrawer()
    expect(screen.getByText('A decisão')).toBeDefined()
    expect(screen.getByText('Por quê — o racional')).toBeDefined()
    // "Contexto" label is split across a span with "· opcional"
    expect(screen.getByText('Contexto')).toBeDefined()
    expect(screen.getByText('· opcional')).toBeDefined()
    expect(screen.getByText('Métrica')).toBeDefined()
    expect(screen.getByText('Revisitar')).toBeDefined()
    expect(screen.getByText('Pesquisa que fundamenta')).toBeDefined()
  })

  it('renders all 3 horizon segmented buttons (Agora, Próximo, Explorar)', () => {
    renderDrawer()
    expect(screen.getByText(HORIZON_META.agora.label)).toBeDefined()
    expect(screen.getByText(HORIZON_META.proximo.label)).toBeDefined()
    expect(screen.getByText(HORIZON_META.explorar.label)).toBeDefined()
  })

  it('renders all 4 status segmented buttons (Decidido, Testando, Revisar, Arquivado)', () => {
    renderDrawer()
    expect(screen.getByText(DECISION_STATUS_META.decidido.label)).toBeDefined()
    expect(screen.getByText(DECISION_STATUS_META.testando.label)).toBeDefined()
    expect(screen.getByText(DECISION_STATUS_META.revisar.label)).toBeDefined()
    expect(screen.getByText(DECISION_STATUS_META.arquivado.label)).toBeDefined()
  })

  it('renders the 6 tema chips (single-select), not a <select> dropdown', () => {
    const { container } = renderDrawer()
    // No native select for tema anymore
    expect(container.querySelector('select')).toBeNull()
    // Each theme renders a chip with its short label
    for (const id of ['asia', 'ia', 'dev', 'games', 'grana', 'canal'] as const) {
      expect(screen.getByText(THEME_META[id].short)).toBeDefined()
    }
  })

  it('renders all 4 drive (Alimenta) chips', () => {
    renderDrawer()
    expect(screen.getByText('Alimenta')).toBeDefined()
    expect(screen.getByText('Roteiros')).toBeDefined()
    expect(screen.getByText('Newsletter')).toBeDefined()
    expect(screen.getByText('Thumbnails')).toBeDefined()
    expect(screen.getByText('Script de vídeo')).toBeDefined()
  })

  it('renders a pick-row per research option in the source multi-select', () => {
    const { container } = renderDrawer()
    const rows = container.querySelectorAll('.pick-row')
    expect(rows).toHaveLength(researchOptions.length)
    expect(screen.getByText('Estudo sobre IA')).toBeDefined()
    expect(screen.getByText('Analise de mercado')).toBeDefined()
  })

  it('renders Cancel (ghost) and the create primary button "Registrar decisão"', () => {
    const { container } = renderDrawer()
    const cancel = screen.getByText('Cancelar').closest('button')!
    expect(cancel.className).toContain('ghost')
    const primary = screen.getByText('Registrar decisão').closest('button')!
    expect(primary.className).toContain('primary')
    expect(container).toBeDefined()
  })

  it('renders "Salvar" as the primary button in edit mode', () => {
    renderDrawer({ initial: baseDecision })
    expect(screen.getByText('Salvar')).toBeDefined()
    // Archive affordance only in edit mode
    expect(screen.getByText('Arquivar decisão')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 2. Prefill tests
// ---------------------------------------------------------------------------

describe('DecisionDrawer — prefill', () => {
  afterEach(cleanup)

  it('prefillStatement sets the statement textarea value', () => {
    renderDrawer({ prefillStatement: 'Mudar formato do canal' })
    const input = screen.getByPlaceholderText(STATEMENT_PLACEHOLDER) as HTMLTextAreaElement
    expect(input.value).toBe('Mudar formato do canal')
  })

  it('prefillTheme marks the matching tema chip as selected (on)', () => {
    renderDrawer({ prefillTheme: 'games' })
    const chip = screen.getByText(THEME_META.games.short).closest('button')!
    expect(chip.className).toContain('on')
  })

  it('edit mode prefills all fields from initial prop', () => {
    renderDrawer({ initial: baseDecision })

    // Statement
    const statementInput = screen.getByPlaceholderText(STATEMENT_PLACEHOLDER) as HTMLTextAreaElement
    expect(statementInput.value).toBe(baseDecision.title)

    // Rationale
    const rationaleInput = screen.getByPlaceholderText(RATIONALE_PLACEHOLDER) as HTMLTextAreaElement
    expect(rationaleInput.value).toBe(baseDecision.rationale)

    // Context
    const contextInput = screen.getByPlaceholderText(
      'O cenário que torna a decisão necessária.'
    ) as HTMLTextAreaElement
    expect(contextInput.value).toBe(baseDecision.context)

    // Metric + revisit
    expect((screen.getByPlaceholderText('Retenção ≥ 45%') as HTMLInputElement).value).toBe(
      baseDecision.metric
    )
    expect((screen.getByPlaceholderText('Fim de ago 2026') as HTMLInputElement).value).toBe(
      baseDecision.revisit
    )

    // Horizon — "proximo" selected
    const horizonBtn = screen.getByText(HORIZON_META.proximo.label).closest('button')!
    expect(horizonBtn.className).toContain('on')

    // Status — "testando" selected
    const statusBtn = screen.getByText(DECISION_STATUS_META.testando.label).closest('button')!
    expect(statusBtn.className).toContain('on')

    // Tema — "ia" chip selected
    const temaChip = screen.getByText(THEME_META.ia.short).closest('button')!
    expect(temaChip.className).toContain('on')

    // Drives — Roteiros + Newsletter on, Thumbnails off
    expect(screen.getByText('Roteiros').closest('button')!.className).toContain('on')
    expect(screen.getByText('Newsletter').closest('button')!.className).toContain('on')
    expect(screen.getByText('Thumbnails').closest('button')!.className).not.toContain('on')
  })

  it('edit mode prefills linked research from initial.sources', () => {
    const { container } = renderDrawer({
      initial: {
        ...baseDecision,
        sources: [{ research_id: 'res-2', research_title: 'Analise de mercado', note: null }],
      } as ResearchDecision & { sources: { research_id: string; research_title: string; note: string | null }[] },
    })
    const rows = Array.from(container.querySelectorAll('.pick-row'))
    const selectedRow = screen.getByText('Analise de mercado').closest('.pick-row')!
    expect(selectedRow.className).toContain('on')
    // The other row should not be selected
    const unselected = rows.find((r) => r !== selectedRow)!
    expect(unselected.className).not.toContain('on')
  })
})

// ---------------------------------------------------------------------------
// 3. Interaction tests
// ---------------------------------------------------------------------------

describe('DecisionDrawer — interactions', () => {
  afterEach(cleanup)

  it('clicking a horizon button updates selection', () => {
    renderDrawer()
    const agoraBtn = screen.getByText(HORIZON_META.agora.label).closest('button')!
    expect(agoraBtn.className).toContain('on')

    const explorarBtn = screen.getByText(HORIZON_META.explorar.label).closest('button')!
    fireEvent.click(explorarBtn)

    expect(explorarBtn.className).toContain('on')
    expect(agoraBtn.className).not.toContain('on')
  })

  it('clicking a status button updates selection', () => {
    renderDrawer()
    const decididoBtn = screen.getByText(DECISION_STATUS_META.decidido.label).closest('button')!
    expect(decididoBtn.className).toContain('on')

    const revisarBtn = screen.getByText(DECISION_STATUS_META.revisar.label).closest('button')!
    fireEvent.click(revisarBtn)

    expect(revisarBtn.className).toContain('on')
    expect(decididoBtn.className).not.toContain('on')
  })

  it('tema chips are single-select: clicking one deselects the previous', () => {
    renderDrawer()
    const iaChip = screen.getByText(THEME_META.ia.short).closest('button')!
    const devChip = screen.getByText(THEME_META.dev.short).closest('button')!

    fireEvent.click(iaChip)
    expect(iaChip.className).toContain('on')

    fireEvent.click(devChip)
    expect(devChip.className).toContain('on')
    expect(iaChip.className).not.toContain('on')

    // Clicking an active chip again clears it
    fireEvent.click(devChip)
    expect(devChip.className).not.toContain('on')
  })

  it('toggling an Alimenta chip adds/removes the on class', () => {
    renderDrawer()
    const roteirosBtn = screen.getByText('Roteiros').closest('button')!
    expect(roteirosBtn.className).not.toContain('on')

    fireEvent.click(roteirosBtn)
    expect(roteirosBtn.className).toContain('on')

    fireEvent.click(roteirosBtn)
    expect(roteirosBtn.className).not.toContain('on')
  })

  it('toggling a research pick-row adds/removes the on class (multi-select)', () => {
    renderDrawer()
    const row1 = screen.getByText('Estudo sobre IA').closest('.pick-row')! as HTMLElement
    const row2 = screen.getByText('Analise de mercado').closest('.pick-row')! as HTMLElement

    fireEvent.click(row1)
    expect(row1.className).toContain('on')
    // Multi-select: second selection keeps the first
    fireEvent.click(row2)
    expect(row1.className).toContain('on')
    expect(row2.className).toContain('on')

    fireEvent.click(row1)
    expect(row1.className).not.toContain('on')
    expect(row2.className).toContain('on')
  })

  it('save (Registrar decisão) button is disabled when statement is empty', () => {
    renderDrawer()
    const saveBtn = screen.getByText('Registrar decisão').closest('button')! as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })

  it('save button is enabled when statement has content', () => {
    renderDrawer()
    const input = screen.getByPlaceholderText(STATEMENT_PLACEHOLDER)
    fireEvent.change(input, { target: { value: 'Minha decisao' } })
    const saveBtn = screen.getByText('Registrar decisão').closest('button')! as HTMLButtonElement
    expect(saveBtn.disabled).toBe(false)
  })

  it('save button stays disabled when statement is only whitespace', () => {
    renderDrawer()
    const input = screen.getByPlaceholderText(STATEMENT_PLACEHOLDER)
    fireEvent.change(input, { target: { value: '   ' } })
    const saveBtn = screen.getByText('Registrar decisão').closest('button')! as HTMLButtonElement
    expect(saveBtn.disabled).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. Callback tests
// ---------------------------------------------------------------------------

describe('DecisionDrawer — callbacks', () => {
  afterEach(cleanup)

  it('clicking the scrim/backdrop calls onClose', () => {
    const onClose = vi.fn()
    renderDrawer({ onClose })
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking Cancel calls onClose', () => {
    const onClose = vi.fn()
    renderDrawer({ onClose })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking the X button calls onClose', () => {
    const onClose = vi.fn()
    renderDrawer({ onClose })
    fireEvent.click(screen.getByLabelText('Fechar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    renderDrawer({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// 5. Accessibility
// ---------------------------------------------------------------------------

describe('DecisionDrawer — accessibility', () => {
  afterEach(cleanup)

  it('dialog has role="dialog" and aria-modal="true"', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('backdrop has role="presentation"', () => {
    renderDrawer()
    expect(screen.getByRole('presentation')).toBeDefined()
  })

  it('close button has aria-label="Fechar" and is a button', () => {
    renderDrawer()
    const closeBtn = screen.getByLabelText('Fechar')
    expect(closeBtn.tagName).toBe('BUTTON')
  })

  it('all buttons have type="button"', () => {
    renderDrawer()
    for (const btn of screen.getAllByRole('button')) {
      expect(btn.getAttribute('type')).toBe('button')
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Save action tests
// ---------------------------------------------------------------------------

describe('DecisionDrawer — save actions', () => {
  beforeEach(() => {
    mockCreateDecision.mockClear()
    mockUpdateDecision.mockClear()
    mockCreateDecision.mockResolvedValue({ ok: true })
    mockUpdateDecision.mockResolvedValue({ ok: true })
  })
  afterEach(cleanup)

  it('save in create mode calls createResearchDecision with the built input', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderDrawer({ onSaved, onClose })

    fireEvent.change(screen.getByPlaceholderText(STATEMENT_PLACEHOLDER), {
      target: { value: 'Nova decisao de teste' },
    })
    // Link a research source so source_research_ids is populated
    fireEvent.click(screen.getByText('Estudo sobre IA').closest('.pick-row')!)

    fireEvent.click(screen.getByText('Registrar decisão').closest('button')!)

    await waitFor(() => {
      expect(mockCreateDecision).toHaveBeenCalledOnce()
    })

    const callArg = mockCreateDecision.mock.calls[0][0]
    expect(callArg.title).toBe('Nova decisao de teste')
    expect(callArg.horizon).toBe('agora')
    expect(callArg.status).toBe('decidido')
    expect(callArg.source_research_ids).toEqual(['res-1'])

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('save in edit mode calls updateResearchDecision with id and input', async () => {
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderDrawer({ initial: baseDecision, onSaved, onClose })

    fireEvent.click(screen.getByText('Salvar').closest('button')!)

    await waitFor(() => {
      expect(mockUpdateDecision).toHaveBeenCalledOnce()
    })

    expect(mockUpdateDecision.mock.calls[0][0]).toBe(baseDecision.id)
    const callArg = mockUpdateDecision.mock.calls[0][1]
    expect(callArg.title).toBe(baseDecision.title)
    expect(callArg.horizon).toBe('proximo')
    expect(callArg.status).toBe('testando')
  })

  it('Arquivar decisão persists with status "arquivado"', async () => {
    const onSaved = vi.fn()
    renderDrawer({ initial: baseDecision, onSaved })

    fireEvent.click(screen.getByText('Arquivar decisão').closest('button')!)

    await waitFor(() => {
      expect(mockUpdateDecision).toHaveBeenCalledOnce()
    })
    expect(mockUpdateDecision.mock.calls[0][1].status).toBe('arquivado')
  })

  it('shows error message when the save action fails', async () => {
    mockCreateDecision.mockResolvedValue({ ok: false, error: 'DB connection lost' })
    renderDrawer()

    fireEvent.change(screen.getByPlaceholderText(STATEMENT_PLACEHOLDER), {
      target: { value: 'Decisao com erro' },
    })
    fireEvent.click(screen.getByText('Registrar decisão').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('DB connection lost')).toBeDefined()
    })
  })
})
