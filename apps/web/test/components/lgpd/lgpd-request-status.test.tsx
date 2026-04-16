import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { LgpdRequestStatus } from '../../../src/components/lgpd/lgpd-request-status'

const sampleRequest = {
  id: 'req-1',
  type: 'account_deletion' as const,
  status: 'pending' as const,
  phase: 1 as const,
  scheduledPurgeAt: '2026-05-01T00:00:00Z',
}

describe('LgpdRequestStatus', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ...sampleRequest, status: 'processing' }), { status: 200 }),
        ),
      ),
    )
  })

  it('renders static state from the request prop (no polling)', () => {
    render(<LgpdRequestStatus request={sampleRequest} />)
    expect(screen.getByTestId('lgpd-request-status')).toBeTruthy()
    expect(screen.getByText(/pending/i)).toBeTruthy()
    expect(screen.getByText(/req-1/)).toBeTruthy()
  })

  it('polls /api/lgpd/request-status/[id] when poll=true', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...sampleRequest, status: 'processing' }), { status: 200 }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<LgpdRequestStatus request={sampleRequest} poll />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/lgpd/request-status/req-1')
    })
  })

  it('renders phase + scheduled purge date for deletion requests', () => {
    render(<LgpdRequestStatus request={sampleRequest} />)
    expect(screen.getByText(/fase 1/i)).toBeTruthy()
    expect(screen.getByText(/2026-05-01/)).toBeTruthy()
  })
})
