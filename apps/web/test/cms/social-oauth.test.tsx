import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockRouterRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mockRouterRefresh }),
  usePathname: () => '/cms/social/accounts',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock @tn-figueiredo/social — only need Provider type and no runtime imports
vi.mock('@tn-figueiredo/social', () => ({
  PROVIDERS: ['youtube', 'facebook', 'instagram', 'bluesky'],
}))

const mockDisconnectSocial = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  disconnectSocial: (...args: unknown[]) => mockDisconnectSocial(...args),
}))

// Mock platform-icon shared component
vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => <span data-testid={`icon-${provider}`}>{provider}</span>,
  platformLabel: (provider: string) => provider.charAt(0).toUpperCase() + provider.slice(1),
}))

import { OauthButton } from '@/app/cms/(authed)/social/accounts/_components/oauth-button'
import { PlatformCard } from '@/app/cms/(authed)/social/accounts/_components/platform-card'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

// Connection fixtures
const activeConnection = {
  id: 'c1',
  provider: 'youtube' as const,
  account_id: 'ch1',
  account_name: 'My Channel',
  token_expires_at: '2027-06-01T00:00:00Z',
  connected_at: '2026-05-01T00:00:00Z',
  revoked_at: null,
  scopes: ['youtube.upload'],
  metadata: {},
}

const expiredConnection = {
  ...activeConnection,
  id: 'c2',
  account_name: 'Old Channel',
  token_expires_at: '2020-01-01T00:00:00Z',
}

const neverExpiresConnection = {
  ...activeConnection,
  id: 'c3',
  provider: 'facebook' as const,
  account_name: 'My Page',
  token_expires_at: null,
}

// Suppress window.confirm noise
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('open', vi.fn(() => ({ close: vi.fn() })))
})

describe('OauthButton', () => {
  it('renders connect button with provided label', () => {
    render(<OauthButton provider="youtube" label="Connect YouTube" />)
    expect(screen.getByText('Connect YouTube')).toBeDefined()
  })

  it('is a button element', () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    const btn = screen.getByRole('button', { name: 'Connect' })
    expect(btn).toBeDefined()
  })

  it('is not disabled initially', () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    const btn = screen.getByRole('button', { name: 'Connect' })
    expect((btn as HTMLButtonElement).disabled).toBe(false)
  })

  it('opens a popup window on click', () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    expect(window.open).toHaveBeenCalledWith(
      '/api/social/oauth/google',
      'social-oauth',
      expect.stringContaining('width=600'),
    )
  })

  it('opens correct oauth provider URL for facebook', () => {
    render(<OauthButton provider="facebook" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    expect(window.open).toHaveBeenCalledWith(
      '/api/social/oauth/meta',
      'social-oauth',
      expect.any(String),
    )
  })

  it('opens correct oauth provider URL for bluesky', () => {
    render(<OauthButton provider="bluesky" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    expect(window.open).toHaveBeenCalledWith(
      '/api/social/oauth/bluesky',
      'social-oauth',
      expect.any(String),
    )
  })

  it('calls router.refresh after successful oauth message', async () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    // Simulate popup sending success message
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'social-oauth-result', success: true },
      }),
    )
    await waitFor(() => {
      expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call router.refresh on failed oauth result', async () => {
    render(<OauthButton provider="youtube" label="Connect" />)
    fireEvent.click(screen.getByRole('button'))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'social-oauth-result', success: false },
      }),
    )
    await waitFor(() => {
      expect(mockRouterRefresh).not.toHaveBeenCalled()
    })
  })
})

describe('PlatformCard', () => {
  it('renders platform name', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('Youtube')).toBeDefined()
  })

  it('shows platform icon', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByTestId('icon-youtube')).toBeDefined()
  })

  it('shows account name for connected account', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText('My Channel')).toBeDefined()
  })

  it('shows Active status badge for active token', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // Redesigned card shows "Active" badge (not tokenOk "Connected")
    expect(screen.getByText('Active')).toBeDefined()
  })

  it('shows Token expired status for expired token', () => {
    render(<PlatformCard provider="youtube" connections={[expiredConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // The ExpiredBanner + ManageDetails both show tokenExpired text — use getAllByText
    const expiredTexts = screen.getAllByText(en.accounts.connections.tokenExpired)
    expect(expiredTexts.length).toBeGreaterThanOrEqual(1)
  })

  it('shows Active status badge for connection without token_expires_at', () => {
    render(<PlatformCard provider="facebook" connections={[neverExpiresConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    // Redesigned card shows "Active" badge for never-expires connections
    expect(screen.getByText('Active')).toBeDefined()
  })

  it('shows Add account button when no connections', () => {
    render(<PlatformCard provider="instagram" connections={[]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText(en.accounts.connections.addAccount)).toBeDefined()
  })

  it('shows manage button when connections exist', () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getByText(en.accounts.connections.manage)).toBeDefined()
  })

  it('shows disconnect button after clicking manage', async () => {
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => {
      expect(screen.getByText(en.accounts.connections.disconnect)).toBeDefined()
    })
  })

  it('shows reconnect button for expired token (in expired banner)', () => {
    // Redesigned component shows Reconnect in the expired banner, not just in manage mode
    render(<PlatformCard provider="youtube" connections={[expiredConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    expect(screen.getAllByText(en.accounts.connections.reconnect).length).toBeGreaterThanOrEqual(1)
  })

  it('calls disconnectSocial on disconnect confirm', async () => {
    mockDisconnectSocial.mockResolvedValue({ ok: true })
    render(<PlatformCard provider="youtube" connections={[activeConnection]} strings={en} onDisconnect={mockDisconnectSocial} />)
    fireEvent.click(screen.getByText(en.accounts.connections.manage))
    await waitFor(() => screen.getByText(en.accounts.connections.disconnect))
    fireEvent.click(screen.getByText(en.accounts.connections.disconnect))
    await waitFor(() => {
      expect(mockDisconnectSocial).toHaveBeenCalledWith('c1')
    })
  })
})
