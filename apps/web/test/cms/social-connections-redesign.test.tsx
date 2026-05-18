import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/cms/social/accounts',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@tn-figueiredo/social', () => ({
  PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
}))

const mockDisconnectSocial = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  disconnectSocial: (...args: unknown[]) => mockDisconnectSocial(...args),
}))

vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => <span data-testid={`icon-${provider}`}>{provider}</span>,
  platformLabel: (provider: string) => {
    const labels: Record<string, string> = {
      youtube: 'YouTube',
      facebook: 'Facebook',
      instagram: 'Instagram',
      bluesky: 'Bluesky',
    }
    return labels[provider] ?? provider.charAt(0).toUpperCase() + provider.slice(1)
  },
}))

import { ConnectionsSummary } from '@/app/cms/(authed)/social/accounts/_components/connections-summary'
import { PlatformCard } from '@/app/cms/(authed)/social/accounts/_components/platform-card'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeConnection(overrides: Partial<{
  id: string
  provider: 'youtube' | 'facebook' | 'instagram' | 'bluesky'
  account_id: string
  account_name: string | null
  token_expires_at: string | null
  connected_at: string
  revoked_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
}> = {}) {
  return {
    id: 'c1',
    provider: 'youtube' as const,
    account_id: 'ch1',
    account_name: 'My Channel',
    token_expires_at: '2027-06-01T00:00:00Z',
    connected_at: '2026-05-01T00:00:00Z',
    revoked_at: null,
    scopes: ['youtube.upload'],
    metadata: {} as Record<string, unknown>,
    ...overrides,
  }
}

/** Token expires more than 30 days from now */
const activeConnection = makeConnection({
  id: 'active-1',
  token_expires_at: '2027-06-01T00:00:00Z',
})

/** Token expires in ~15 days — "expiring" zone (7–30d) */
const expiringConnection = makeConnection({
  id: 'expiring-1',
  account_name: 'Expiring Channel',
  // 15 days from a fixed "now" would be before tests run. Use a relative date:
  token_expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
})

/** Token expired in the past */
const expiredConnection = makeConnection({
  id: 'expired-1',
  account_name: 'Old Channel',
  token_expires_at: '2020-01-01T00:00:00Z',
})

/** No token_expires_at (e.g. Bluesky, some Meta) */
const neverExpiresConnection = makeConnection({
  id: 'never-1',
  provider: 'facebook',
  account_name: 'My Page',
  token_expires_at: null,
})

// ─── ConnectionsSummary ───────────────────────────────────────────────────────

describe('ConnectionsSummary', () => {
  it('renders nothing when connections array is empty', () => {
    const { container } = render(
      <ConnectionsSummary connections={[]} strings={en} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows total connected accounts count', () => {
    const connections = [activeConnection, expiredConnection]
    render(<ConnectionsSummary connections={connections} strings={en} />)
    // Total = 2, shown as the first stat item
    expect(screen.getByText('2')).toBeDefined()
  })

  it('counts active connections correctly (>30d remaining or null)', () => {
    const connections = [activeConnection, neverExpiresConnection]
    render(<ConnectionsSummary connections={connections} strings={en} />)
    // Both should be "active" → active=2, total=2
    const twos = screen.getAllByText('2')
    expect(twos.length).toBeGreaterThanOrEqual(1)
  })

  it('counts expiring connections (7-30d remaining)', () => {
    render(
      <ConnectionsSummary connections={[expiringConnection]} strings={en} />,
    )
    // total=1, active=0, expiring=1, expired=0
    // "1" appears for total and expiring
    const ones = screen.getAllByText('1')
    expect(ones.length).toBe(2) // total + expiring
  })

  it('counts expired connections correctly', () => {
    render(
      <ConnectionsSummary connections={[expiredConnection]} strings={en} />,
    )
    // Only one connection, it is expired -> appears at least once as "1"
    const ones = screen.getAllByText('1')
    expect(ones.length).toBeGreaterThanOrEqual(1)
  })

  it('null token_expires_at is treated as active (never expires)', () => {
    render(
      <ConnectionsSummary connections={[neverExpiresConnection]} strings={en} />,
    )
    // total=1, active=1, expiring=0, expired=0
    const ones = screen.getAllByText('1')
    // Total and active both = 1
    expect(ones.length).toBeGreaterThanOrEqual(2)
    const zeros = screen.getAllByText('0')
    // expiring and expired both = 0
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it('shows linkedAccounts label', () => {
    render(<ConnectionsSummary connections={[activeConnection]} strings={en} />)
    expect(screen.getByText(en.accounts.connections.linkedAccounts)).toBeDefined()
  })

  it('shows tokenOk label', () => {
    render(<ConnectionsSummary connections={[activeConnection]} strings={en} />)
    expect(screen.getByText(en.accounts.connections.tokenOk)).toBeDefined()
  })

  it('shows tokenExpiring label', () => {
    render(<ConnectionsSummary connections={[activeConnection]} strings={en} />)
    expect(screen.getByText(en.accounts.connections.tokenExpiring)).toBeDefined()
  })

  it('shows tokenExpired label', () => {
    render(<ConnectionsSummary connections={[activeConnection]} strings={en} />)
    expect(screen.getByText(en.accounts.connections.tokenExpired)).toBeDefined()
  })

  it('correctly categorises a mix: 1 active, 1 expiring, 1 expired', () => {
    const connections = [activeConnection, expiringConnection, expiredConnection]
    render(<ConnectionsSummary connections={connections} strings={en} />)
    // Total = 3
    expect(screen.getByText('3')).toBeDefined()
    // active=1, expiring=1, expired=1 — each "1" should appear 3 times plus "3" once
    const ones = screen.getAllByText('1')
    expect(ones.length).toBe(3)
  })
})

// ─── PlatformCard — basic ─────────────────────────────────────────────────────

describe('PlatformCard — basic rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('open', vi.fn(() => ({ close: vi.fn() })))
  })

  it('renders platform name via platformLabel', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('YouTube')).toBeDefined()
  })

  it('renders account name', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('My Channel')).toBeDefined()
  })

  it('shows Add account button when no connections', () => {
    render(<PlatformCard provider="instagram" connections={[]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText(en.accounts.connections.addAccount)).toBeDefined()
  })

  it('shows Manage button when connections exist', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText(en.accounts.connections.manage)).toBeDefined()
  })

  it('does not show Manage button when no connections', () => {
    render(<PlatformCard provider="youtube" connections={[]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.queryByText(en.accounts.connections.manage)).toBeNull()
  })
})

// ─── PlatformCard — token status ─────────────────────────────────────────────

describe('PlatformCard — token status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('shows Active badge for active token (>30d)', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // New card shows "Active" status badge
    expect(screen.getByText('Active')).toBeDefined()
  })

  it('shows Expired badge for expired token', () => {
    render(<PlatformCard provider="youtube" connections={[expiredConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // New card shows "Expired" status badge
    expect(screen.getByText('Expired')).toBeDefined()
  })

  it('shows neverExpires text for connection with null token_expires_at', () => {
    render(<PlatformCard provider="facebook" connections={[neverExpiresConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText(en.accounts.connections.neverExpires)).toBeDefined()
  })
})

// ─── PlatformCard — thumbnail / avatar ───────────────────────────────────────

describe('PlatformCard — avatar / thumbnail metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders avatar img when metadata.thumbnail_url is present', () => {
    const conn = makeConnection({
      metadata: { thumbnail_url: 'https://example.com/avatar.jpg' },
    })
    const { container } = render(<PlatformCard provider="youtube" connections={[conn]} strings={en} onDisconnect={mockDisconnectSocial} />)
    const img = container.querySelector('img[src*="avatar.jpg"]')
    expect(img).not.toBeNull()
  })

  it('does not render an img element when no thumbnail_url in metadata', () => {
    const { container } = render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // No avatar img should be present (initials div is used instead)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders handle link when custom_url is in metadata', () => {
    const conn = makeConnection({
      metadata: { custom_url: '@mychannel' },
    })
    render(<PlatformCard provider="youtube" connections={[conn]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('@mychannel')).toBeDefined()
  })

  it('does not render handle when metadata has no custom_url', () => {
    const conn = makeConnection({ metadata: {} })
    render(<PlatformCard provider="youtube" connections={[conn]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // No handle link should appear
    expect(screen.queryByText(/@/)).toBeNull()
  })

  it('shows instagram handle with @ prefix', () => {
    const conn = makeConnection({
      provider: 'instagram',
      metadata: { ig_username: 'myprofile' },
    })
    render(<PlatformCard provider="instagram" connections={[conn]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('@myprofile')).toBeDefined()
  })
})

// ─── PlatformCard — manage mode ──────────────────────────────────────────────

describe('PlatformCard — manage mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('shows disconnect button after clicking Manage', async () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => {
      expect(screen.getByText(en.accounts.connections.disconnect)).toBeDefined()
    })
  })

  it('shows reconnect button for expired token when manage is open', async () => {
    render(<PlatformCard provider="youtube" connections={[expiredConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => {
      // Multiple reconnect buttons may appear (expired banner + manage details)
      const reconnects = screen.getAllByText(en.accounts.connections.reconnect)
      expect(reconnects.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('does not show reconnect for active token even in manage mode', async () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    expect(screen.queryByText(en.accounts.connections.reconnect)).toBeNull()
  })

  it('calls disconnectSocial when disconnect is confirmed', async () => {
    mockDisconnectSocial.mockResolvedValue({ ok: true })
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    fireEvent.click(screen.getByText(en.accounts.connections.disconnect))
    await waitFor(() => {
      expect(mockDisconnectSocial).toHaveBeenCalledWith('active-1')
    })
  })

  it('does not call disconnectSocial when confirm is cancelled', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    fireEvent.click(screen.getByText(en.accounts.connections.disconnect))
    expect(mockDisconnectSocial).not.toHaveBeenCalled()
  })

  it('shows Add another button in manage mode for adding more accounts', async () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => {
      // New card shows "+ Add another YouTube" in manage mode
      expect(screen.getByText(/Add another/)).toBeDefined()
    })
  })

  it('toggles manage off when Manage is clicked again', async () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => {
      expect(screen.queryByText(en.accounts.connections.disconnect)).toBeNull()
    })
  })

  it('shows error message when disconnectSocial returns error', async () => {
    mockDisconnectSocial.mockResolvedValue({ ok: false, error: 'Server error' })
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    fireEvent.click(screen.getByText(en.accounts.connections.disconnect))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined()
    })
  })
})

// ─── PlatformCard — multiple connections ─────────────────────────────────────

describe('PlatformCard — multiple connections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders all connections', () => {
    const conn1 = makeConnection({ id: 'c1', account_name: 'Channel One' })
    const conn2 = makeConnection({ id: 'c2', account_name: 'Channel Two' })
    render(<PlatformCard provider="youtube" connections={[conn1, conn2]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('Channel One')).toBeDefined()
    expect(screen.getByText('Channel Two')).toBeDefined()
  })

  it('renders multiple avatar images when both have thumbnail_url', () => {
    const conn1 = makeConnection({ id: 'c1', metadata: { thumbnail_url: 'https://example.com/a.jpg' } })
    const conn2 = makeConnection({ id: 'c2', account_name: 'Two', metadata: { thumbnail_url: 'https://example.com/b.jpg' } })
    const { container } = render(<PlatformCard provider="youtube" connections={[conn1, conn2]} strings={en} onDisconnect={mockDisconnectSocial} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs).toHaveLength(2)
  })
})

// ─── PlatformCard — rich card features ──────────────────────────────────────

describe('PlatformCard — rich card features', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('shows stats grid for YouTube with Subscribers, Videos, Views labels', () => {
    const conn = makeConnection({
      metadata: { subscriber_count: 1500, video_count: 42, view_count: 250000 },
    })
    render(<PlatformCard provider="youtube" connections={[conn]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('Subscribers')).toBeDefined()
    expect(screen.getByText('Videos')).toBeDefined()
    expect(screen.getByText('Views')).toBeDefined()
    expect(screen.getByText('1.5K')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('250.0K')).toBeDefined()
  })

  it('shows token health bar with green color for active connection', () => {
    const { container } = render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    const bar = container.querySelector('.bg-green-500')
    expect(bar).not.toBeNull()
  })

  it('shows expired banner with reconnect for expired connection', () => {
    render(<PlatformCard provider="youtube" connections={[expiredConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // Expired banner shows token expired text
    const tokenExpired = screen.getAllByText(en.accounts.connections.tokenExpired)
    expect(tokenExpired.length).toBeGreaterThanOrEqual(1)
    // Reconnect button in banner
    const reconnects = screen.getAllByText(en.accounts.connections.reconnect)
    expect(reconnects.length).toBeGreaterThanOrEqual(1)
  })

  it('shows connection count badge', () => {
    const conn1 = makeConnection({ id: 'c1' })
    const conn2 = makeConnection({ id: 'c2', account_name: 'Two' })
    render(<PlatformCard provider="youtube" connections={[conn1, conn2]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('2 channels')).toBeDefined()
  })

  it('shows empty state with dashed circle when no connections', () => {
    const { container } = render(<PlatformCard provider="youtube" connections={[]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(container.querySelector('.border-dashed')).not.toBeNull()
    expect(screen.getByText(/Connect your YouTube account/)).toBeDefined()
  })

  it('shows accent bar at top of card', () => {
    const { container } = render(<PlatformCard provider="youtube" connections={[]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // YouTube accent bar has red gradient
    const accentBar = container.querySelector('.from-red-600')
    expect(accentBar).not.toBeNull()
  })
})
