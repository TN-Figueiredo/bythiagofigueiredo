import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

const mockGetConnections = vi.fn()
const mockDisconnectSocial = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  getConnections: (...args: unknown[]) => mockGetConnections(...args),
  disconnectSocial: (...args: unknown[]) => mockDisconnectSocial(...args),
}))

import { ConnectionsGrid } from '@/app/cms/(authed)/social/accounts/_components/connections-grid'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockConnections = [
  { id: 'c1', provider: 'youtube', account_id: 'ch1', account_name: 'My Channel', token_expires_at: '2026-06-01T00:00:00Z', scopes: ['youtube.upload'], metadata: {}, connected_at: '2026-05-01T00:00:00Z', revoked_at: null },
  { id: 'c2', provider: 'facebook', account_id: 'page1', account_name: 'My Page', token_expires_at: null, scopes: ['pages_manage_posts'], metadata: {}, connected_at: '2026-05-02T00:00:00Z', revoked_at: null },
]

function renderGrid(overrides: Record<string, unknown> = {}) {
  const props = {
    connections: mockConnections,
    siteId: 'site-1',
    strings: en,
    ...overrides,
  }
  return render(<ConnectionsGrid {...props} />)
}

describe('ConnectionsGrid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders platform cards for connected accounts', () => {
    renderGrid()
    expect(screen.getByText('My Channel')).toBeDefined()
    expect(screen.getByText('My Page')).toBeDefined()
  })

  it('shows "Connected" status for active tokens', () => {
    renderGrid()
    expect(screen.getAllByText(en.accounts.connections.tokenOk).length).toBeGreaterThan(0)
  })

  it('shows all 4 platform sections', () => {
    renderGrid()
    expect(screen.getByText('YouTube')).toBeDefined()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Instagram')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('shows Add account button for platforms without connections', () => {
    renderGrid()
    const addButtons = screen.getAllByText(en.accounts.connections.addAccount)
    expect(addButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('shows disconnect confirmation on button click', async () => {
    mockDisconnectSocial.mockResolvedValue({ ok: true })
    renderGrid()
    const manageButtons = screen.getAllByText(en.accounts.connections.manage)
    fireEvent.click(manageButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.connections.disconnect)).toBeDefined()
    })
  })

  it('shows token expired state for expired tokens', () => {
    const expiredConnections = [
      { ...mockConnections[0], token_expires_at: '2020-01-01T00:00:00Z' },
    ]
    renderGrid({ connections: expiredConnections })
    expect(screen.getByText(en.accounts.connections.tokenExpired)).toBeDefined()
  })

  it('shows Reconnect button for expired token when manage is open', async () => {
    const expiredConnections = [
      { ...mockConnections[0], token_expires_at: '2020-01-01T00:00:00Z' },
    ]
    renderGrid({ connections: expiredConnections })
    const manageButtons = screen.getAllByText(en.accounts.connections.manage)
    fireEvent.click(manageButtons[0])
    await waitFor(() => {
      expect(screen.getByText(en.accounts.connections.reconnect)).toBeDefined()
    })
  })

  it('shows empty add-account buttons when no connections exist', () => {
    renderGrid({ connections: [] })
    // All 4 platform cards should show add-account button
    const addButtons = screen.getAllByText(en.accounts.connections.addAccount)
    expect(addButtons.length).toBe(4)
    // No manage buttons should appear since nothing is connected
    expect(screen.queryByText(en.accounts.connections.manage)).toBeNull()
  })

  it('shows "Never expires" for tokens without expiry', () => {
    const neverExpireConn = [
      { ...mockConnections[1], token_expires_at: null },
    ]
    renderGrid({ connections: neverExpireConn })
    expect(screen.getByText(en.accounts.connections.tokenNever)).toBeDefined()
  })
})
