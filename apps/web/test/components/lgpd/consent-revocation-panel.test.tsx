import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { ConsentRevocationPanel } from '../../../src/components/lgpd/consent-revocation-panel'

const sampleConsents = [
  {
    id: 'c1',
    category: 'cookie_analytics' as const,
    granted: true,
    grantedAt: '2026-04-10T10:00:00Z',
    version: 1,
  },
  {
    id: 'c2',
    category: 'cookie_marketing' as const,
    granted: true,
    grantedAt: '2026-04-10T10:00:00Z',
    version: 1,
  },
  {
    id: 'c3',
    category: 'cookie_functional' as const,
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

  it('lists all consents by category using DB-aligned labels', () => {
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    // Labels appear at least once as the list-item heading; the revoke
    // button may echo the label too, so use getAllByText and assert count>=1.
    expect(screen.getAllByText(/cookies de analytics/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/cookies de marketing/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/cookies funcionais/i).length).toBeGreaterThan(0)
  })

  it('shows a revoke button for revocable categories but NOT for functional', () => {
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    const revokeAnalytics = screen.getByRole('button', {
      name: /revogar cookies de analytics/i,
    })
    expect(revokeAnalytics).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /revogar cookies funcionais/i }),
    ).toBeNull()
  })

  it('POSTs to /api/consents/revoke with the canonical category name', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ revoked: true }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ConsentRevocationPanel consents={sampleConsents} />)
    fireEvent.click(screen.getByRole('button', { name: /revogar cookies de analytics/i }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/consents/revoke',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('cookie_analytics'),
        }),
      )
    })
  })

  it('renders empty state when no consents are present', () => {
    render(<ConsentRevocationPanel consents={[]} />)
    expect(screen.getByText(/nenhum consent/i)).toBeTruthy()
  })
})
