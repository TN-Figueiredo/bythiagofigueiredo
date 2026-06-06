import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { ThemeId } from '@/lib/pipeline/research-schemas'
import { THEME_IDS, DECISION_HORIZON, FOCO_STATE } from '@/lib/pipeline/research-schemas'
import { THEME_META, HORIZON_META, FOCO_STATE_META } from '@/lib/pipeline/research-types'

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

const mockSaveFocoFull = vi.fn().mockResolvedValue({ ok: true })
const mockArchiveResearchFoco = vi.fn().mockResolvedValue({ ok: true })

vi.mock(
  '../../../src/app/cms/(authed)/pipeline/research/foco-actions',
  () => ({
    saveFocoFull: (...args: unknown[]) => mockSaveFocoFull(...args),
    archiveResearchFoco: (...args: unknown[]) => mockArchiveResearchFoco(...args),
  })
)

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  )
  return {
    Target: icon('Target'),
    X: icon('X'),
    Check: icon('Check'),
    Archive: icon('Archive'),
  }
})

// Import after mocks
import { FocoDrawer } from '@/app/cms/(authed)/pipeline/research/_components/foco-drawer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noop = () => {}

function renderDrawer(overrides: Partial<Parameters<typeof FocoDrawer>[0]> = {}) {
  const defaultProps = {
    onClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  }
  const result = render(<FocoDrawer {...defaultProps} />)
  return { ...result, props: defaultProps }
}

const editInitial = {
  id: 'abc-123',
  title: 'Asia Q3 Focus',
  description: 'Strategic expansion into APAC markets',
  horizon: 'proximo' as const,
  state: 'proposto' as const,
  rationale: 'Market timing is right',
  metric: '5 of 8 videos done',
  window_label: 'Jul - Sep 2026',
  themes: ['asia', 'grana'] as ThemeId[],
  active: false,
}

// ---------------------------------------------------------------------------
// 1. Render tests
// ---------------------------------------------------------------------------

describe('FocoDrawer — render', () => {
  afterEach(cleanup)

  it('renders in create mode with "Novo foco" dialog label', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Novo foco')
  })

  it('renders in edit mode with "Editar foco" dialog label when initial has id', () => {
    renderDrawer({ initial: editInitial })
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Editar foco')
  })

  it('title input auto-focuses on mount', () => {
    renderDrawer()
    const titleInput = screen.getByPlaceholderText('Ex.: A transicao Brasil para Asia')
    expect(document.activeElement).toBe(titleInput)
  })

  it('renders 3 horizon segmented buttons', () => {
    renderDrawer()
    for (const h of DECISION_HORIZON) {
      const meta = HORIZON_META[h]
      expect(screen.getByText(meta.label)).toBeDefined()
    }
    // Exactly 3 horizon buttons
    const horizonButtons = DECISION_HORIZON.map((h) =>
      screen.getByText(HORIZON_META[h].label)
    )
    expect(horizonButtons).toHaveLength(3)
  })

  it('renders state dropdown with all foco states', () => {
    renderDrawer()
    const select = screen.getByDisplayValue(FOCO_STATE_META.rascunho.label)
    expect(select).toBeDefined()
    // All options present
    for (const s of FOCO_STATE) {
      const meta = FOCO_STATE_META[s]
      expect(screen.getByText(meta.label)).toBeDefined()
    }
  })

  it('renders theme toggle chips for all 6 themes', () => {
    renderDrawer()
    for (const id of THEME_IDS) {
      const meta = THEME_META[id]
      expect(screen.getByText(meta.short)).toBeDefined()
    }
  })

  it('save button shows "Salvar foco" text', () => {
    renderDrawer({ initial: { title: 'Some title' } })
    expect(screen.getByText('Salvar foco')).toBeDefined()
  })

  it('renders header text "Novo foco" in create mode', () => {
    renderDrawer()
    const headers = screen.getAllByText('Novo foco')
    // One in aria-label, one in the visible header
    expect(headers.length).toBeGreaterThanOrEqual(1)
  })

  it('renders header text "Editar foco" in edit mode', () => {
    renderDrawer({ initial: editInitial })
    const headers = screen.getAllByText('Editar foco')
    expect(headers.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// 2. Prefill tests
// ---------------------------------------------------------------------------

describe('FocoDrawer — prefill in edit mode', () => {
  afterEach(cleanup)

  it('prefills title from initial', () => {
    renderDrawer({ initial: editInitial })
    const input = screen.getByPlaceholderText('Ex.: A transicao Brasil para Asia') as HTMLInputElement
    expect(input.value).toBe('Asia Q3 Focus')
  })

  it('prefills description from initial', () => {
    renderDrawer({ initial: editInitial })
    const textarea = screen.getByPlaceholderText(
      'A narrativa em torno da qual o trimestre se organiza...'
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('Strategic expansion into APAC markets')
  })

  it('prefills horizon selection from initial', () => {
    renderDrawer({ initial: editInitial })
    const proximoBtn = screen.getByText(HORIZON_META.proximo.label)
    expect(proximoBtn.className).toContain('on')
  })

  it('prefills state dropdown from initial', () => {
    renderDrawer({ initial: editInitial })
    const select = screen.getByDisplayValue(FOCO_STATE_META.proposto.label)
    expect(select).toBeDefined()
  })

  it('prefills theme chips as selected from initial', () => {
    renderDrawer({ initial: editInitial })
    const asiaChip = screen.getByText(THEME_META.asia.short).closest('button')!
    const granaChip = screen.getByText(THEME_META.grana.short).closest('button')!
    const devChip = screen.getByText(THEME_META.dev.short).closest('button')!

    expect(asiaChip.className).toContain('on')
    expect(granaChip.className).toContain('on')
    expect(devChip.className).not.toContain('on')
  })
})

// ---------------------------------------------------------------------------
// 3. Interaction tests
// ---------------------------------------------------------------------------

describe('FocoDrawer — interactions', () => {
  afterEach(cleanup)

  it('clicking horizon button changes selection', () => {
    renderDrawer()
    // Default is "agora"
    const agoraBtn = screen.getByText(HORIZON_META.agora.label)
    expect(agoraBtn.className).toContain('on')

    // Click "explorar"
    const explorarBtn = screen.getByText(HORIZON_META.explorar.label)
    fireEvent.click(explorarBtn)

    expect(explorarBtn.className).toContain('on')
    expect(agoraBtn.className).not.toContain('on')
  })

  it('clicking theme chip toggles it on', () => {
    renderDrawer()
    const iaChip = screen.getByText(THEME_META.ia.short).closest('button')!
    expect(iaChip.className).not.toContain('on')

    fireEvent.click(iaChip)
    expect(iaChip.className).toContain('on')
  })

  it('clicking theme chip toggles it off when already selected', () => {
    renderDrawer({ initial: { themes: ['ia'] as ThemeId[] } })
    const iaChip = screen.getByText(THEME_META.ia.short).closest('button')!
    expect(iaChip.className).toContain('on')

    fireEvent.click(iaChip)
    expect(iaChip.className).not.toContain('on')
  })

  it('save button is disabled when title is empty', () => {
    renderDrawer()
    const saveBtn = screen.getByText('Salvar foco').closest('button')!
    expect(saveBtn.disabled).toBe(true)
  })

  it('save button is disabled when title is only whitespace', () => {
    renderDrawer({ initial: { title: '   ' } })
    const saveBtn = screen.getByText('Salvar foco').closest('button')!
    expect(saveBtn.disabled).toBe(true)
  })

  it('save button is enabled when title has content', () => {
    renderDrawer({ initial: { title: 'Valid title' } })
    const saveBtn = screen.getByText('Salvar foco').closest('button')!
    expect(saveBtn.disabled).toBe(false)
  })

  it('changing state dropdown updates form value', () => {
    renderDrawer()
    const select = screen.getByDisplayValue(FOCO_STATE_META.rascunho.label) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'ativo' } })
    expect(select.value).toBe('ativo')
  })

  it('typing in title input updates the value', () => {
    renderDrawer()
    const input = screen.getByPlaceholderText('Ex.: A transicao Brasil para Asia') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'New focus title' } })
    expect(input.value).toBe('New focus title')
  })
})

// ---------------------------------------------------------------------------
// 4. Archive section
// ---------------------------------------------------------------------------

describe('FocoDrawer — archive section', () => {
  afterEach(cleanup)

  it('archive button visible for non-archived edit focos', () => {
    renderDrawer({ initial: { ...editInitial, state: 'proposto' as const } })
    expect(screen.getByText('Arquivar aposta')).toBeDefined()
  })

  it('archive button hidden for new focos (create mode)', () => {
    renderDrawer()
    expect(screen.queryByText('Arquivar aposta')).toBeNull()
    expect(screen.queryByText('Encerrar este foco')).toBeNull()
  })

  it('archive button hidden when state is already "arquivado"', () => {
    renderDrawer({ initial: { ...editInitial, state: 'arquivado' as const } })
    expect(screen.queryByText('Arquivar aposta')).toBeNull()
    expect(screen.queryByText('Encerrar este foco')).toBeNull()
  })

  it('shows "Encerrar este foco" when foco is active', () => {
    renderDrawer({ initial: { ...editInitial, active: true, state: 'ativo' as const } })
    expect(screen.getByText('Encerrar este foco')).toBeDefined()
  })

  it('shows hint text when foco is active', () => {
    renderDrawer({ initial: { ...editInitial, active: true, state: 'ativo' as const } })
    expect(
      screen.getByText('Encerra o foco do trimestre. Voce volta a tela de definir foco.')
    ).toBeDefined()
  })

  it('does not show active hint when foco is not active', () => {
    renderDrawer({ initial: { ...editInitial, active: false, state: 'proposto' as const } })
    expect(
      screen.queryByText('Encerra o foco do trimestre. Voce volta a tela de definir foco.')
    ).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. Callback tests (close)
// ---------------------------------------------------------------------------

describe('FocoDrawer — close callbacks', () => {
  afterEach(cleanup)

  it('clicking backdrop calls onClose', () => {
    const { props } = renderDrawer()
    const backdrop = screen.getByRole('presentation')
    fireEvent.click(backdrop)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking Cancel button calls onClose', () => {
    const { props } = renderDrawer()
    const cancelBtn = screen.getByText('Cancelar')
    fireEvent.click(cancelBtn)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('clicking X button calls onClose', () => {
    const { props } = renderDrawer()
    const closeBtn = screen.getByLabelText('Fechar')
    fireEvent.click(closeBtn)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('pressing Escape key calls onClose', () => {
    const { props } = renderDrawer()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('pressing non-Escape key does not call onClose', () => {
    const { props } = renderDrawer()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(props.onClose).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 6. Accessibility
// ---------------------------------------------------------------------------

describe('FocoDrawer — accessibility', () => {
  afterEach(cleanup)

  it('panel has role="dialog" and aria-modal="true"', () => {
    renderDrawer()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('backdrop has role="presentation"', () => {
    renderDrawer()
    const backdrop = screen.getByRole('presentation')
    expect(backdrop).toBeDefined()
  })

  it('close button has aria-label="Fechar"', () => {
    renderDrawer()
    const closeBtn = screen.getByLabelText('Fechar')
    expect(closeBtn).toBeDefined()
    expect(closeBtn.tagName).toBe('BUTTON')
  })

  it('close button has title="Fechar"', () => {
    renderDrawer()
    const closeBtn = screen.getByLabelText('Fechar')
    expect(closeBtn.getAttribute('title')).toBe('Fechar')
  })
})

// ---------------------------------------------------------------------------
// 7. Save action
// ---------------------------------------------------------------------------

describe('FocoDrawer — save action', () => {
  beforeEach(() => {
    mockSaveFocoFull.mockClear()
    mockArchiveResearchFoco.mockClear()
  })
  afterEach(cleanup)

  it('clicking save invokes saveFocoFull with form data', async () => {
    mockSaveFocoFull.mockResolvedValue({ ok: true })
    const { props } = renderDrawer({ initial: { title: 'Test Focus', themes: ['ia'] as ThemeId[] } })

    const saveBtn = screen.getByText('Salvar foco').closest('button')!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockSaveFocoFull).toHaveBeenCalledTimes(1)
    })

    const callArg = mockSaveFocoFull.mock.calls[0][0]
    expect(callArg.title).toBe('Test Focus')
    expect(callArg.horizon).toBe('agora')
    expect(callArg.state).toBe('rascunho')
    expect(callArg.theme_ids).toEqual(['ia'])
    expect(callArg.id).toBeUndefined()
  })

  it('on successful save, calls onSaved and onClose', async () => {
    mockSaveFocoFull.mockResolvedValue({ ok: true })
    const { props } = renderDrawer({ initial: { title: 'Test' } })

    fireEvent.click(screen.getByText('Salvar foco').closest('button')!)

    await waitFor(() => {
      expect(props.onSaved).toHaveBeenCalledTimes(1)
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('on save error, shows error message', async () => {
    mockSaveFocoFull.mockResolvedValue({ ok: false, error: 'DB connection failed' })
    renderDrawer({ initial: { title: 'Test' } })

    fireEvent.click(screen.getByText('Salvar foco').closest('button')!)

    await waitFor(() => {
      expect(screen.getByText('DB connection failed')).toBeDefined()
    })
  })

  it('save passes initial.id in edit mode', async () => {
    mockSaveFocoFull.mockResolvedValue({ ok: true })
    renderDrawer({ initial: editInitial })

    fireEvent.click(screen.getByText('Salvar foco').closest('button')!)

    await waitFor(() => {
      expect(mockSaveFocoFull).toHaveBeenCalledTimes(1)
    })

    expect(mockSaveFocoFull.mock.calls[0][0].id).toBe('abc-123')
  })

  it('clicking archive invokes archiveResearchFoco with foco id', async () => {
    mockArchiveResearchFoco.mockResolvedValue({ ok: true })
    const { props } = renderDrawer({ initial: { ...editInitial, state: 'proposto' as const } })

    fireEvent.click(screen.getByText('Arquivar aposta'))

    await waitFor(() => {
      expect(mockArchiveResearchFoco).toHaveBeenCalledWith('abc-123')
      expect(props.onSaved).toHaveBeenCalledTimes(1)
      expect(props.onClose).toHaveBeenCalledTimes(1)
    })
  })
})
