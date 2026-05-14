// apps/web/test/cms/social-tab.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('SocialTab', () => {
  const defaultConnections = [
    { id: 'c1', provider: 'facebook' as const, account_name: 'My Page', site_id: 's1' },
    { id: 'c2', provider: 'instagram' as const, account_name: 'my_ig', site_id: 's1' },
    { id: 'c3', provider: 'bluesky' as const, account_name: 'me.bsky', site_id: 's1' },
  ]

  const mockOnConfigChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders share toggle and calls onConfigChange when toggled on', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={null}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    const toggle = screen.getByRole('switch')
    expect(toggle).toBeDefined()

    fireEvent.click(toggle)

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        platforms: expect.arrayContaining(['facebook', 'instagram', 'bluesky']),
      }),
    )
  })

  it('shows platform chips when enabled', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={{
          enabled: true,
          platforms: ['facebook', 'instagram', 'bluesky'],
          captions: {},
          hashtags: [],
          image_source: 'og_image',
          ig_template: 'card',
          formats: {},
        }}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    expect(screen.getByText('My Page')).toBeDefined()
    expect(screen.getByText('my_ig')).toBeDefined()
    expect(screen.getByText('me.bsky')).toBeDefined()
  })

  it('toggles platform off and calls onConfigChange without that platform', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={{
          enabled: true,
          platforms: ['facebook', 'instagram', 'bluesky'],
          captions: {},
          hashtags: [],
          image_source: 'og_image',
          ig_template: 'card',
          formats: {},
        }}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    fireEvent.click(screen.getByText('My Page'))

    expect(mockOnConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({
        platforms: expect.not.arrayContaining(['facebook']),
      }),
    )
  })

  it('renders caption editor tabs per platform', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={{
          enabled: true,
          platforms: ['facebook', 'bluesky'],
          captions: {},
          hashtags: [],
          image_source: 'og_image',
          ig_template: 'card',
          formats: {},
        }}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    expect(screen.getByRole('tab', { name: /facebook/i })).toBeDefined()
    expect(screen.getByRole('tab', { name: /bluesky/i })).toBeDefined()
  })

  it('shows pipeline preview one-liner', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={{
          enabled: true,
          platforms: ['facebook'],
          captions: {},
          hashtags: [],
          image_source: 'og_image',
          ig_template: 'card',
          formats: {},
        }}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    expect(screen.getByText(/short link/i)).toBeDefined()
    expect(screen.getByText(/og scrape/i)).toBeDefined()
    expect(screen.getByText(/deliver/i)).toBeDefined()
  })

  it('hides form sections when toggle is off', async () => {
    const { SocialTab } = await import(
      '@/app/cms/(authed)/_shared/social/social-tab'
    )

    render(
      <SocialTab
        contentType="blog"
        contentId="post-1"
        socialConfig={null}
        onConfigChange={mockOnConfigChange}
        connections={defaultConnections}
      />,
    )

    expect(screen.queryByText('My Page')).toBeNull()
  })
})
