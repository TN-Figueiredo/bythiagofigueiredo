import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { ConsentRevocationPanel } from '../../../src/components/lgpd/consent-revocation-panel'

const sampleConsents = [
  {
    id: 'c1',
    category: 'analytics' as const,
    granted: true,
    grantedAt: '2026-04-10T10:00:00Z',
    version: 1,
  },
  {
    id: 'c2',
    category: 'marketing' as const,
    granted: true,
    grantedAt: '2026-04-10T10:00:00Z',
    version: 1,
  },
  {
    id: 'c3',
    category: 'functional' as const,
    granted: true,
    grantedAt: '2026-04-10T10:00:00Z',
    version: 1,
  },
]

describe('ConsentRevocationPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))),
    )
  })

  it('lists all consents by category', () => {
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    expect(screen.getByText(/^analytics$/i)).toBeTruthy()
    expect(screen.getByText(/^marketing$/i)).toBeTruthy()
    expect(screen.getByText(/^funcionais$/i)).toBeTruthy()
  })

  it('shows a revoke button for revocable categories but NOT for functional', () => {
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    const revokeAnalytics = screen.getByRole('button', { name: /revogar analytics/i })
    expect(revokeAnalytics).toBeTruthy()
    expect(screen.queryByRole('button', { name: /revogar funcionais/i })).toBeNull()
  })

  it('POSTs to /api/consents/revoke when the revoke button is clicked', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    fireEvent.click(screen.getByRole('button', { name: /revogar analytics/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/consents/revoke',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('renders empty state when no consents are present', () => {
    render(<ConsentRevocationPanel consents={[]} />)
    expect(screen.getByText(/nenhum consent/i)).toBeTruthy()
  })
})
