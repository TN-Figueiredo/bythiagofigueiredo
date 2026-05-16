import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { AudioImportModal } from '@/app/cms/(authed)/pipeline/audio/_components/audio-import-modal'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderModal(onClose = vi.fn()) {
  render(<AudioImportModal onClose={onClose} />)
  return { onClose }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('AudioImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('renders modal with title', () => {
    renderModal()
    expect(screen.getByText('Import Audio Library')).toBeDefined()
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('shows validation error for invalid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn())
    renderModal()
    const textarea = screen.getByPlaceholderText('Paste JSON here...')
    fireEvent.change(textarea, { target: { value: '{ not valid json !!!' } })
    const previewBtn = screen.getByText('Preview Import')
    fireEvent.click(previewBtn)
    await waitFor(() => {
      expect(screen.getByText('Invalid JSON')).toBeDefined()
    })
    // fetch should NOT have been called for invalid JSON
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    renderModal(onClose)
    const closeBtn = screen.getByLabelText('Close')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    renderModal(onClose)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables preview button when textarea is empty', () => {
    renderModal()
    const previewBtn = screen.getByText('Preview Import') as HTMLButtonElement
    // textarea starts empty
    expect(previewBtn.disabled).toBe(true)
  })
})
