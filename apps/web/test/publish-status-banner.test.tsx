import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock platform-icon to avoid import chain issues
vi.mock('@/app/cms/(authed)/_shared/social/platform-icon', () => ({
  PlatformIcon: ({ provider }: { provider: string }) => (
    <span data-testid={`icon-${provider}`}>{provider}</span>
  ),
  platformLabel: (provider: string) =>
    ({ facebook: 'Facebook', bluesky: 'Bluesky', instagram: 'Instagram', youtube: 'YouTube' }[
      provider
    ] ?? provider),
}))

const mockStrings = {
  detail: {
    retry: 'Retry',
    reconnect: 'Reconnect',
    publishedOn: 'Published',
    failedOn: 'Failed',
  },
  platforms: {
    facebook: 'Facebook',
    bluesky: 'Bluesky',
    instagram: 'Instagram',
    youtube: 'YouTube',
  },
}

describe('PublishStatusBanner', () => {
  it('shows checkmark for successful platforms', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd1', provider: 'facebook', status: 'published', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByLabelText(/success/i)).toBeDefined()
  })

  it('shows X and retry button for failed platforms', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    const onRetry = vi.fn()
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd2', provider: 'instagram', status: 'failed', error: 'API error', errorType: 'transient' },
        ]}
        onRetry={onRetry}
        strings={mockStrings as never}
      />,
    )
    const instagramElements = screen.getAllByText(/Instagram/)
    expect(instagramElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText(/failed/i)).toBeDefined()
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('d2')
  })

  it('shows Reconnect link instead of Retry for auth errors', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd3', provider: 'bluesky', status: 'failed', error: 'Token expired', errorType: 'auth' },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText(/Reconnect/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('shows spinner for in-progress platforms', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd4', provider: 'facebook', status: 'publishing', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByLabelText(/in-progress/i)).toBeDefined()
  })

  it('returns null when deliveries array is empty', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    const { container } = render(
      <PublishStatusBanner
        deliveries={[]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('shows error details for failed deliveries', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd5', provider: 'youtube', status: 'failed', error: 'Quota exceeded', errorType: 'transient' },
          { id: 'd6', provider: 'facebook', status: 'published', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByText(/YouTube: Quota exceeded/)).toBeDefined()
  })

  it('shows retry for skipped deliveries', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    const onRetry = vi.fn()
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd7', provider: 'bluesky', status: 'skipped', error: null, errorType: null },
        ]}
        onRetry={onRetry}
        strings={mockStrings as never}
      />,
    )
    const retryBtn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('d7')
  })

  it('shows pending deliveries as in-progress', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd8', provider: 'instagram', status: 'pending', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByLabelText(/in-progress/i)).toBeDefined()
  })

  it('shows retrying deliveries as in-progress', async () => {
    const { PublishStatusBanner } = await import(
      '@/app/cms/(authed)/social/new/_components/publish-status-banner'
    )
    render(
      <PublishStatusBanner
        deliveries={[
          { id: 'd9', provider: 'youtube', status: 'retrying', error: null, errorType: null },
        ]}
        onRetry={vi.fn()}
        strings={mockStrings as never}
      />,
    )
    expect(screen.getByLabelText(/in-progress/i)).toBeDefined()
  })
})
