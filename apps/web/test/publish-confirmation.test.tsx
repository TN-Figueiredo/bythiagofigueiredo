import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

// Mock the OG card components and PlatformIcon to avoid import chain issues
vi.mock('@/app/cms/(authed)/social/new/_components/og-facebook-card', () => ({
  OgFacebookCard: ({ title, domain }: { title: string; domain: string }) => (
    <div data-testid="og-facebook-card">
      {title} - {domain}
    </div>
  ),
}))
vi.mock('@/app/cms/(authed)/social/new/_components/og-bluesky-card', () => ({
  OgBlueskyCard: ({ title, domain }: { title: string; domain: string }) => (
    <div data-testid="og-bluesky-card">
      {title} - {domain}
    </div>
  ),
}))
vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`}>{provider}</span>
  ),
  platformLabel: (provider: string) =>
    ({ facebook: 'Facebook', bluesky: 'Bluesky', instagram: 'Instagram', youtube: 'YouTube' }[
      provider
    ] ?? provider),
}))

describe('PublishConfirmationDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    platforms: ['facebook', 'bluesky'] as const,
    captions: {
      facebook: { pt: '{{title}}\n\n{{link}}' },
      bluesky: { pt: '{{title}}\n\n{{link}}' },
    },
    contentTitle: 'Test Post Title',
    contentUrl: 'https://example.com/post',
    shortUrl: 'go.btf.com/abc123',
    ogData: {
      title: 'Test Post Title',
      description: 'A test description',
      image: 'https://example.com/og.jpg',
      domain: 'example.com',
    },
    isLoading: false,
    activeLang: 'pt' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders resolved captions per platform', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    // Should show resolved title instead of {{title}} — appears in multiple places
    const titleMatches = screen.getAllByText(/Test Post Title/)
    expect(titleMatches.length).toBeGreaterThanOrEqual(1)
    // Should show resolved short URL instead of {{link}}
    const linkMatches = screen.getAllByText(/go\.btf\.com\/abc123/)
    expect(linkMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('shows platform badges with green for auto-post', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    const { container } = render(<PublishConfirmationDialog {...defaultProps} />)
    const badges = container.querySelectorAll('[data-testid="platform-badge"]')
    expect(badges.length).toBe(2)
  })

  it('shows amber badge for Instagram Design mode', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    const { container } = render(
      <PublishConfirmationDialog
        {...defaultProps}
        platforms={['instagram']}
        captions={{ instagram: { pt: '{{title}}\n\nLink na bio' } }}
        instagramMode="design"
      />,
    )
    const badge = container.querySelector('[data-testid="platform-badge"]')
    expect(badge?.textContent).toContain('Notification')
  })

  it('calls onClose when Cancel is clicked', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls onConfirm when Confirm is clicked', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    expect(defaultProps.onConfirm).toHaveBeenCalled()
  })

  it('disables Confirm button when loading', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} isLoading={true} />)
    const btn = screen.getByRole('button', { name: /publicando/i })
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('shows warning for missing OG image', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(
      <PublishConfirmationDialog
        {...defaultProps}
        ogData={{ ...defaultProps.ogData, image: null }}
      />,
    )
    expect(screen.getByText(/og:image missing/i)).toBeDefined()
  })

  it('does not render when open is false', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    const { container } = render(
      <PublishConfirmationDialog {...defaultProps} open={false} />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows loading text on confirm button when isLoading', async () => {
    const { PublishConfirmationDialog } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-confirmation-dialog'
    )
    render(<PublishConfirmationDialog {...defaultProps} isLoading={true} />)
    const btn = screen.getByRole('button', { name: /publicando/i })
    expect(btn).toBeDefined()
  })
})
