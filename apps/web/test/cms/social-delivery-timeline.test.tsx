import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social'),
}))

const mockRetry = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  retrySocialDelivery: (...args: unknown[]) => mockRetry(...args),
}))

import { DeliveryCard } from '@/app/cms/(authed)/social/_components/delivery-card'
import { PostTimeline } from '@/app/cms/(authed)/social/_components/post-timeline'
import { en } from '@/app/cms/(authed)/social/_i18n/en'
import type { SocialDelivery, SocialPost } from '@tn-figueiredo/social'

function makeDelivery(overrides: Partial<SocialDelivery> = {}): SocialDelivery {
  return {
    id: 'd1',
    post_id: 'p1',
    connection_id: 'c1',
    provider: 'facebook',
    status: 'published',
    platform_post_id: '12345',
    platform_url: 'https://facebook.com/12345',
    content_override: null,
    attempt: 1,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: '2026-05-10T14:01:00Z',
    created_at: '2026-05-10T14:00:00Z',
    ...overrides,
  }
}

const basePost: SocialPost = {
  id: 'p1',
  site_id: 's1',
  created_by: 'u1',
  type: 'link',
  status: 'completed',
  scheduled_at: '2026-05-10T13:00:00Z',
  user_timezone: 'UTC',
  published_at: '2026-05-10T14:01:00Z',
  content: { title: 'My Post', url: 'https://example.com' },
  template_id: null,
  idempotency_key: 'k1',
  created_at: '2026-05-10T12:00:00Z',
  updated_at: '2026-05-10T14:01:00Z',
}

// ── DeliveryCard ──────────────────────────────────────────────────────────────

describe('DeliveryCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders platform name', () => {
    render(<DeliveryCard delivery={makeDelivery()} strings={en} />)
    expect(screen.getByText('Facebook')).toBeDefined()
  })

  it('shows status badge', () => {
    render(<DeliveryCard delivery={makeDelivery()} strings={en} />)
    // "published" maps to en.status.published = "Published"
    expect(screen.getByText(en.status.published)).toBeDefined()
  })

  it('shows "View on Facebook" link for published delivery with platform_url', () => {
    render(<DeliveryCard delivery={makeDelivery()} strings={en} />)
    const link = screen.getByRole('link')
    expect(link.textContent).toContain('Facebook')
    expect(link.getAttribute('href')).toBe('https://facebook.com/12345')
  })

  it('shows retry button for failed delivery', () => {
    render(<DeliveryCard delivery={makeDelivery({ status: 'failed', published_at: null, platform_url: null })} strings={en} />)
    expect(screen.getByRole('button', { name: /Retry delivery to Facebook/i })).toBeDefined()
  })

  it('shows error message for failed delivery', () => {
    render(
      <DeliveryCard
        delivery={makeDelivery({ status: 'failed', last_error: 'Token expired', published_at: null, platform_url: null })}
        strings={en}
      />,
    )
    expect(screen.getByText('Token expired')).toBeDefined()
  })

  it('shows attempt counter', () => {
    render(<DeliveryCard delivery={makeDelivery({ attempt: 2, max_attempts: 3 })} strings={en} />)
    expect(screen.getByText(en.detail.attempt.replace('{attempt}', '2').replace('{max}', '3'))).toBeDefined()
  })

  it('calls retrySocialDelivery when retry button clicked', async () => {
    mockRetry.mockResolvedValue(undefined)
    render(
      <DeliveryCard
        delivery={makeDelivery({ status: 'failed', published_at: null, platform_url: null })}
        strings={en}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Retry delivery to Facebook/i }))
    await waitFor(() => expect(mockRetry).toHaveBeenCalledWith('d1'))
  })

  it('does not show "View on" link when status is not published', () => {
    render(<DeliveryCard delivery={makeDelivery({ status: 'failed', published_at: null, platform_url: null })} strings={en} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})

// ── PostTimeline ──────────────────────────────────────────────────────────────

describe('PostTimeline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the timeline heading', () => {
    render(<PostTimeline post={basePost} deliveries={[]} strings={en} />)
    expect(screen.getByText(en.detail.timeline)).toBeDefined()
  })

  it('always shows the created event', () => {
    render(<PostTimeline post={basePost} deliveries={[]} strings={en} />)
    expect(screen.getByText(en.detail.created)).toBeDefined()
  })

  it('shows scheduled event when post has scheduled_at', () => {
    render(<PostTimeline post={basePost} deliveries={[]} strings={en} />)
    expect(screen.getByText(en.detail.scheduledEvent)).toBeDefined()
  })

  it('does not show scheduled event when post has no scheduled_at', () => {
    render(<PostTimeline post={{ ...basePost, scheduled_at: null }} deliveries={[]} strings={en} />)
    expect(screen.queryByText(en.detail.scheduledEvent)).toBeNull()
  })

  it('shows published event for delivery with published_at', () => {
    const delivery = makeDelivery({ provider: 'facebook', published_at: '2026-05-10T14:01:00Z' })
    render(<PostTimeline post={basePost} deliveries={[delivery]} strings={en} />)
    const expected = en.detail.publishedOn.replace('{provider}', 'facebook')
    expect(screen.getByText(expected)).toBeDefined()
  })

  it('shows failed event for delivery with failed status and last_error', () => {
    const delivery = makeDelivery({ status: 'failed', last_error: 'Rate limited', published_at: null, platform_url: null })
    render(<PostTimeline post={basePost} deliveries={[delivery]} strings={en} />)
    const expectedPrefix = en.detail.failedOn.replace('{provider}', 'facebook')
    const failedText = screen.getAllByText((text) => text.startsWith(expectedPrefix))
    expect(failedText.length).toBeGreaterThan(0)
  })

  it('renders events in chronological order (created before scheduled)', () => {
    render(<PostTimeline post={basePost} deliveries={[]} strings={en} />)
    const created = screen.getByText(en.detail.created)
    const scheduled = screen.getByText(en.detail.scheduledEvent)
    // Created (2026-05-10T12:00) should appear before Scheduled (2026-05-10T13:00) in DOM
    expect(created.compareDocumentPosition(scheduled) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
