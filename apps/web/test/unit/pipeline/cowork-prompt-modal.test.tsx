import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/lib/pipeline/gem-design', () => ({
  getFormatIcon: vi.fn(() => ({ icon: '🎬', bgClass: 'bg-red-500/10', label: 'Video' })),
}))

const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
})

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { CoworkPromptModal } from '@/app/cms/(authed)/pipeline/_components/cowork-prompt-modal'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'https://example.com'

function renderModal(overrides: Partial<{ onClose: () => void; baseUrl: string }> = {}) {
  const props = {
    onClose: vi.fn(),
    baseUrl: BASE_URL,
    ...overrides,
  }
  const result = render(<CoworkPromptModal {...props} />)
  return { ...result, onClose: props.onClose }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CoworkPromptModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockClipboard.writeText.mockResolvedValue(undefined)
    try { sessionStorage.clear() } catch { /* test env */ }
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  // ---- 0. Scroll lock ----

  it('locks body scroll on mount and restores on unmount', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = renderModal()
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
  })

  // ---- 0b. Focus trap ----

  it('traps Tab focus within the modal dialog', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    // Focus last element, then Tab should wrap to first
    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('traps Shift+Tab focus within the modal dialog', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    // Focus first element, then Shift+Tab should wrap to last
    first.focus()
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  // ---- 1. Renders modal with dialog role and aria-modal ----

  it('renders modal with role="dialog" and aria-modal="true"', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders modal title "Gerar Prompt pro Cowork"', () => {
    renderModal()
    expect(screen.getByText('Gerar Prompt pro Cowork')).toBeTruthy()
  })

  it('has an accessible aria-label on the dialog', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-label')).toBe('Gerar Prompt pro Cowork')
  })

  // ---- 2. Shows all 7 capability domains as selectable options ----

  it('shows all 7 capability domains as selectable buttons', () => {
    renderModal()
    const domainGroup = screen.getByRole('group', { name: /docs de domínio/i })
    const pressedButtons = within(domainGroup).getAllByRole('button')
    // 7 domain buttons + 1 "Todas" button = 8
    expect(pressedButtons).toHaveLength(8)
  })

  it('renders domain labels from API_REGISTRY', () => {
    renderModal()
    expect(screen.getByLabelText('Pipeline Items & Content Sections')).toBeTruthy()
    expect(screen.getByLabelText('Playlists & Graph')).toBeTruthy()
    expect(screen.getByLabelText('Audio & B-Roll Libraries')).toBeTruthy()
    expect(screen.getByLabelText('Research Library')).toBeTruthy()
    expect(screen.getByLabelText('YouTube Analytics & A/B Testing')).toBeTruthy()
    expect(screen.getByLabelText('Search, Context & Utilities')).toBeTruthy()
    expect(screen.getByLabelText('Course Production (Schema Docs)')).toBeTruthy()
  })

  it('domain buttons toggle aria-pressed on click', () => {
    renderModal()
    const itemsBtn = screen.getByLabelText('Pipeline Items & Content Sections')
    expect(itemsBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(itemsBtn)
    expect(itemsBtn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(itemsBtn)
    expect(itemsBtn.getAttribute('aria-pressed')).toBe('false')
  })

  it('"Todas" domain button selects all domains', () => {
    renderModal()
    const domainGroup = screen.getByRole('group', { name: /docs de domínio/i })
    const todasBtn = within(domainGroup).getByText('Todas')
    fireEvent.click(todasBtn)

    // All 7 domain buttons should now be pressed
    const domainButtons = within(domainGroup).getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    )
    // 7 domains + the "Todas" button itself = 8
    expect(domainButtons).toHaveLength(8)
  })

  // ---- 3. Shows step counter ----

  it('shows step counter with initial count (2 steps: catalog + skill)', () => {
    renderModal()
    // Default: ideator selected, no domains -> steps = 1 (catalog) + 1 (skill) = 2
    expect(screen.getByText('2 steps')).toBeTruthy()
  })

  it('step counter updates when domains are toggled', () => {
    renderModal()
    const itemsBtn = screen.getByLabelText('Pipeline Items & Content Sections')
    fireEvent.click(itemsBtn)
    // 1 (catalog) + 1 (skill) + 1 (domain) = 3
    expect(screen.getByText('3 steps')).toBeTruthy()
  })

  it('step count increases when multiple domains are selected', () => {
    renderModal()
    const btn1 = screen.getByLabelText('Pipeline Items & Content Sections')
    const btn2 = screen.getByLabelText('Playlists & Graph')
    fireEvent.click(btn1)
    fireEvent.click(btn2)
    // 1 (catalog) + 1 (skill) + 2 (domains) = 4
    expect(screen.getByText('4 steps')).toBeTruthy()
  })

  // ---- 4. Skill selection (radio group) ----

  it('renders 7 skills plus "Todas" option in skill radiogroup', () => {
    renderModal()
    const radiogroup = screen.getByRole('radiogroup', { name: /skill do cowork/i })
    const radios = within(radiogroup).getAllByRole('radio')
    // 7 individual skills + 1 "Todas" = 8
    expect(radios).toHaveLength(8)
  })

  it('"Ideator" is selected by default', () => {
    renderModal()
    const ideatorBtn = screen.getByRole('radio', { name: 'Ideator' })
    expect(ideatorBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('selecting a different skill changes aria-checked', () => {
    renderModal()
    const writerBtn = screen.getByRole('radio', { name: 'Writer' })
    fireEvent.click(writerBtn)
    expect(writerBtn.getAttribute('aria-checked')).toBe('true')
    // Previous selection deactivated
    const ideatorBtn = screen.getByRole('radio', { name: 'Ideator' })
    expect(ideatorBtn.getAttribute('aria-checked')).toBe('false')
  })

  it('"Todas" skill selects all skills mode', () => {
    renderModal()
    const radiogroup = screen.getByRole('radiogroup', { name: /skill do cowork/i })
    const todasBtn = within(radiogroup).getByText('Todas')
    fireEvent.click(todasBtn)
    expect(todasBtn.getAttribute('aria-checked')).toBe('true')
    // Individual skills should not be checked
    const ideatorBtn = screen.getByRole('radio', { name: 'Ideator' })
    expect(ideatorBtn.getAttribute('aria-checked')).toBe('false')
  })

  // ---- 5. Generates prompt text containing API catalog info ----

  it('prompt preview contains base URL', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(BASE_URL)
  })

  it('prompt contains catalog GET step', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(`GET ${BASE_URL}/api/pipeline/`)
  })

  it('prompt contains skill context endpoint for default selection', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(`${BASE_URL}/api/pipeline/context?skill=ideator&format=md`)
  })

  it('prompt changes when selecting a different skill', () => {
    renderModal()
    const writerBtn = screen.getByRole('radio', { name: 'Writer' })
    fireEvent.click(writerBtn)
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(`${BASE_URL}/api/pipeline/context?skill=writer&format=md`)
  })

  it('prompt uses all-skills context when "Todas" selected', () => {
    renderModal()
    const radiogroup = screen.getByRole('radiogroup', { name: /skill do cowork/i })
    const todasBtn = within(radiogroup).getByText('Todas')
    fireEvent.click(todasBtn)
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(`${BASE_URL}/api/pipeline/context?format=md`)
  })

  it('prompt includes domain docs endpoint when domain selected', () => {
    renderModal()
    const itemsBtn = screen.getByLabelText('Pipeline Items & Content Sections')
    fireEvent.click(itemsBtn)
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain(`${BASE_URL}/api/pipeline/docs/items-and-sections`)
  })

  it('prompt includes final confirmation instruction', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('confirme prontidão')
  })

  it('prompt includes error handling instruction', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('NÃO prossiga')
  })

  // ---- 6. Copy button calls navigator.clipboard.writeText ----

  it('copy button calls navigator.clipboard.writeText with prompt text', async () => {
    renderModal()
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    expect(mockClipboard.writeText).toHaveBeenCalledOnce()
    const writtenText = mockClipboard.writeText.mock.calls[0][0] as string
    expect(writtenText).toContain(`GET ${BASE_URL}/api/pipeline/`)
    expect(writtenText).toContain('confirme prontidão')
  })

  it('shows success toast after copying', async () => {
    renderModal()
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    expect(toast.success).toHaveBeenCalledWith('Prompt copiado! ⚠️ Lembre de preencher a Pipeline Key no prompt.')
  })

  it('shows error toast when clipboard write fails', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('denied'))
    renderModal()
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    expect(toast.error).toHaveBeenCalledWith('Falha ao copiar')
  })

  it('button changes to "Copiado — fechar" after successful copy', async () => {
    renderModal()
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    expect(screen.getByText(/Copiado — fechar/)).toBeTruthy()
  })

  it('"Copiado — fechar" button calls onClose', async () => {
    const { onClose } = renderModal()
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    const closeBtn = screen.getByText(/Copiado — fechar/)
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- 7. Escape key triggers onClose ----

  it('Escape key triggers onClose', () => {
    const { onClose } = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Cmd+Enter triggers copy', async () => {
    renderModal()
    await act(async () => { fireEvent.keyDown(document, { key: 'Enter', metaKey: true }) })
    expect(mockClipboard.writeText).toHaveBeenCalledOnce()
  })

  it('Ctrl+Enter triggers copy', async () => {
    renderModal()
    await act(async () => { fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true }) })
    expect(mockClipboard.writeText).toHaveBeenCalledOnce()
  })

  // ---- 8. Skills are rendered with radio role ----

  it('each skill has role="radio" and correct aria-checked', () => {
    renderModal()
    const skills = ['Ideator', 'Writer', 'Producer', 'Product Eval', 'Perf Review', 'Curator', 'Architect']
    for (const label of skills) {
      const btn = screen.getByRole('radio', { name: label })
      expect(btn).toBeTruthy()
      // Only Ideator is default-checked
      if (label === 'Ideator') {
        expect(btn.getAttribute('aria-checked')).toBe('true')
      } else {
        expect(btn.getAttribute('aria-checked')).toBe('false')
      }
    }
  })

  // ---- Additional: Max Context toggle ----

  it('Max Context button selects all skills + all domains', () => {
    renderModal()
    const maxCtxBtn = screen.getByRole('button', { name: /max context/i })
    fireEvent.click(maxCtxBtn)

    // "Todas" skill should be checked
    const radiogroup = screen.getByRole('radiogroup', { name: /skill do cowork/i })
    const todasSkillBtn = within(radiogroup).getByText('Todas')
    expect(todasSkillBtn.getAttribute('aria-checked')).toBe('true')

    // All domain buttons should be pressed
    const domainGroup = screen.getByRole('group', { name: /docs de domínio/i })
    const pressedDomains = within(domainGroup).getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    )
    expect(pressedDomains.length).toBeGreaterThanOrEqual(6)
  })

  it('Max Context toggle off resets to defaults', () => {
    renderModal()
    const maxCtxBtn = screen.getByRole('button', { name: /max context/i })
    // Enable
    fireEvent.click(maxCtxBtn)
    // Disable
    fireEvent.click(maxCtxBtn)

    // Ideator should be re-selected
    const ideatorBtn = screen.getByRole('radio', { name: 'Ideator' })
    expect(ideatorBtn.getAttribute('aria-checked')).toBe('true')

    // No domains should be selected
    const domainGroup = screen.getByRole('group', { name: /docs de domínio/i })
    const pressedDomains = within(domainGroup).getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    )
    expect(pressedDomains).toHaveLength(0)
  })

  // ---- Cancelar button ----

  it('Cancelar button calls onClose', () => {
    const { onClose } = renderModal()
    const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
    fireEvent.click(cancelBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- Fechar (X) button ----

  it('close (X) button calls onClose', () => {
    const { onClose } = renderModal()
    const closeBtn = screen.getByRole('button', { name: /fechar/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- Backdrop click ----

  it('clicking backdrop calls onClose', () => {
    const { onClose, container } = renderModal()
    // The backdrop is the outermost fixed div
    const backdrop = container.firstElementChild as HTMLElement
    fireEvent.mouseDown(backdrop, { target: backdrop, currentTarget: backdrop })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ---- Show/hide key toggle ----

  it('toggle button reveals and hides the pipeline key input', () => {
    renderModal()
    const input = screen.getByLabelText('Pipeline API Key')
    expect(input.getAttribute('type')).toBe('password')
    const toggleBtn = screen.getByLabelText('Mostrar key')
    fireEvent.click(toggleBtn)
    expect(input.getAttribute('type')).toBe('text')
    expect(screen.getByLabelText('Ocultar key')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Ocultar key'))
    expect(input.getAttribute('type')).toBe('password')
  })

  // ---- Pipeline key appears in prompt ----

  it('pipeline key appears in the generated prompt when set', () => {
    renderModal()
    const input = screen.getByLabelText('Pipeline API Key')
    fireEvent.change(input, { target: { value: 'test-key-abc' } })
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('test-key-abc')
  })

  it('prompt shows placeholder when no key is set', () => {
    renderModal()
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).toContain('[sua key]')
  })

  it('prompt shows actual key when key is set', () => {
    renderModal()
    const input = screen.getByLabelText('Pipeline API Key')
    fireEvent.change(input, { target: { value: 'my-real-key' } })
    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent).not.toContain('[sua key]')
    expect(dialog.textContent).toContain('my-real-key')
  })

  // ---- Copy with key set shows simple toast ----

  it('shows simple toast when key is set and prompt is copied', async () => {
    renderModal()
    const input = screen.getByLabelText('Pipeline API Key')
    fireEvent.change(input, { target: { value: 'my-key' } })
    const copyBtn = screen.getByRole('button', { name: /copiar prompt/i })
    await act(async () => { fireEvent.click(copyBtn) })
    expect(toast.success).toHaveBeenCalledWith('Prompt copiado!')
  })
})
