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

  it('POSTs /api/lgpd/request-export and shows signed URL on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ id: 'exp-1', downloadUrl: 'https://example.supabase/storage/x' }),
            { status: 200 },
          ),
        ),
      ),
    )
    render(<AccountExportButton />)
    fireEvent.click(screen.getByRole('button', { name: /exportar/i }))
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /baixar/i })).toHaveProperty(
        'href',
        'https://example.supabase/storage/x',
      )
    })
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
