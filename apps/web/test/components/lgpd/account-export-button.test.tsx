import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { AccountExportButton } from '../../../src/components/lgpd/account-export-button'

describe('AccountExportButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders a labelled export button', () => {
    render(<AccountExportButton />)
    expect(screen.getByRole('button', { name: /exportar/i })).toBeTruthy()
  })

  it('POSTs /api/lgpd/request-export and shows async-email confirmation on success', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ requestId: 'req-123', expiresAt }),
            { status: 200 },
          ),
        ),
      ),
    )
    render(<AccountExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status.textContent).toMatch(/req-123/)
      expect(status.textContent?.toLowerCase()).toMatch(/email/)
    })
    // No direct download link must be rendered — the signed URL is email-only.
    expect(screen.queryByRole('link', { name: /baixar/i })).toBeNull()
  })

  it('shows rate-limit error when server returns 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }))),
    )
    render(<AccountExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent?.toLowerCase()).toMatch(/limite|espere|tente/)
    })
  })

  it('renders "temporarily disabled" stub when enabled=false', () => {
    render(<AccountExportButton enabled={false} />)
    expect(screen.getByText(/temporariamente desabilitad/i)).toBeTruthy()
  })
})
