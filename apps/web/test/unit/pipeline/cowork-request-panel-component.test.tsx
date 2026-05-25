import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
  configurable: true,
})

import { CoworkRequestPanel } from '@/app/cms/(authed)/pipeline/_components/detail/cowork-request-panel'
import { toast } from 'sonner'

const BASE_PROPS = {
  isOpen: true,
  onClose: vi.fn(),
  itemId: 'abc-123',
  itemCode: 'tg-01',
  itemTitle: 'Test Item',
  sectionLabel: 'Rascunho',
  sectionKey: 'draft_pt',
  lang: 'pt',
  rev: 3,
  placeholder: 'Escreva instruções...',
  format: 'video',
  stage: 'rascunho',
  tags: ['ai'],
  hook: 'A hook',
  synopsis: 'A synopsis',
  sectionContent: 'Some content here',
  references: new Map<number, string>([[1, 'Ref text one'], [2, 'Ref text two that is longer than eighty characters and should be truncated in the citation display area']]),
  onSendAndWait: vi.fn(),
}

function renderPanel(overrides: Partial<typeof BASE_PROPS> = {}) {
  return render(<CoworkRequestPanel {...BASE_PROPS} {...overrides} />)
}

describe('CoworkRequestPanel (component)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClipboard.writeText.mockResolvedValue(undefined)
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = renderPanel({ isOpen: false })
    expect(container.innerHTML).toBe('')
  })

  it('renders panel region when open', () => {
    renderPanel()
    expect(screen.getByRole('region', { name: /painel de requisição cowork/i })).toBeTruthy()
  })

  it('renders textarea with placeholder', () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    expect(textarea).toBeTruthy()
    expect(textarea.getAttribute('placeholder')).toBe('Escreva instruções...')
  })

  it('copy button is disabled when no instructions typed', () => {
    renderPanel()
    const btn = screen.getByText('Copiar prompt')
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('copy button becomes enabled when instructions are typed', () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Write something' } })
    const btn = screen.getByText('Copiar prompt')
    expect(btn.hasAttribute('disabled')).toBe(false)
  })

  it('shows prompt preview when instructions are typed', () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Rewrite intro' } })
    const region = screen.getByRole('region')
    expect(region.textContent).toContain('tg-01')
    expect(region.textContent).toContain('X-Pipeline-Key')
  })

  it('copies prompt to clipboard on button click', async () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Do something' } })
    const btn = screen.getByText('Copiar prompt')
    fireEvent.click(btn)
    await vi.waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledOnce()
    })
    const written = mockClipboard.writeText.mock.calls[0][0] as string
    expect(written).toContain('tg-01')
    expect(written).toContain('X-Pipeline-Key')
  })

  it('shows "Enviado" button after successful copy', async () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Write it' } })
    fireEvent.click(screen.getByText('Copiar prompt'))
    await vi.waitFor(() => {
      expect(screen.getByText(/Enviado/)).toBeTruthy()
    })
  })

  it('shows error toast when clipboard fails', async () => {
    mockClipboard.writeText.mockRejectedValueOnce(new Error('denied'))
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Write it' } })
    fireEvent.click(screen.getByText('Copiar prompt'))
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Não foi possível copiar automaticamente. Use Cmd+A, Cmd+C no preview acima.')
    })
  })

  it('Cancelar button calls onClose', () => {
    const onClose = vi.fn()
    renderPanel({ onClose })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Escape key calls onClose', () => {
    const onClose = vi.fn()
    renderPanel({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows citation badges when [citacao N] typed', () => {
    renderPanel()
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'See [citacao 1] for context' } })
    expect(screen.getByText('[1]')).toBeTruthy()
  })

  it('"Enviado" button calls onSendAndWait and resets state', async () => {
    const onSendAndWait = vi.fn()
    renderPanel({ onSendAndWait })
    const textarea = screen.getByLabelText('Instruções para o Cowork')
    fireEvent.change(textarea, { target: { value: 'Do it' } })
    fireEvent.click(screen.getByText('Copiar prompt'))
    await vi.waitFor(() => {
      expect(screen.getByText(/Enviado/)).toBeTruthy()
    })
    fireEvent.click(screen.getByText(/Enviado/))
    expect(onSendAndWait).toHaveBeenCalledOnce()
  })
})
