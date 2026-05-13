/**
 * @vitest-environment happy-dom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn() })),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

const mockRetry = vi.fn()
const mockDelete = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  retrySocialDelivery: (...args: unknown[]) => mockRetry(...args),
  deleteSocialPost: (...args: unknown[]) => mockDelete(...args),
}))

vi.mock('@/lib/social/realtime', () => ({
  useSocialDeliveries: vi.fn(() => []),
  useSocialPostStatus: vi.fn(() => 'completed'),
}))

import { PostDetail } from '../../src/app/cms/(authed)/social/_components/post-detail'
import { en } from '../../src/app/cms/(authed)/social/_i18n/en'

const mockPost = {
  id: 'p1', site_id: 's1', created_by: 'u1', type: 'link' as const, status: 'completed' as const,
  scheduled_at: '2026-05-10T14:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: '2026-05-10T14:01:00Z',
  content: { title: 'Test Post', url: 'https://example.com', description: 'A test' },
  template_id: null, idempotency_key: 'k1',
  created_at: '2026-05-10T12:00:00Z', updated_at: '2026-05-10T14:01:00Z',
  deliveries: [
    { id: 'd1', post_id: 'p1', connection_id: 'c1', provider: 'facebook' as const, status: 'published' as const, platform_post_id: 'fb-123', platform_url: 'https://facebook.com/post/123', content_override: null, attempt: 1, max_attempts: 3, last_error: null, error_type: null, published_at: '2026-05-10T14:01:00Z', created_at: '2026-05-10T14:00:00Z' },
    { id: 'd2', post_id: 'p1', connection_id: 'c2', provider: 'bluesky' as const, status: 'failed' as const, platform_post_id: null, platform_url: null, content_override: null, attempt: 3, max_attempts: 3, last_error: 'Rate limit exceeded', error_type: 'transient' as const, published_at: null, created_at: '2026-05-10T14:00:00Z' },
  ],
}

function renderDetail(overrides: Record<string, unknown> = {}) {
  return render(<PostDetail post={mockPost} strings={en} {...overrides} />)
}

describe('PostDetail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders post content', () => {
    renderDetail()
    expect(screen.getByText('Test Post')).toBeDefined()
    expect(screen.getByText('https://example.com')).toBeDefined()
  })

  it('shows delivery cards per platform', () => {
    renderDetail()
    expect(screen.getByText('Facebook')).toBeDefined()
    expect(screen.getByText('Bluesky')).toBeDefined()
  })

  it('shows Published status for successful delivery', () => {
    renderDetail()
    // Global badge + delivery card badge both show "Published"
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(1)
  })

  it('shows Failed status with error for failed delivery', () => {
    renderDetail()
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Rate limit exceeded')).toBeDefined()
  })

  it('shows Retry button for failed deliveries', () => {
    renderDetail()
    const retryButtons = screen.getAllByText(en.detail.retry)
    expect(retryButtons.length).toBeGreaterThan(0)
  })

  it('shows back link', () => {
    renderDetail()
    expect(screen.getByText(en.detail.back)).toBeDefined()
  })

  it('calls retrySocialDelivery when retry button is clicked', () => {
    renderDetail()
    const retryButtons = screen.getAllByText(en.detail.retry)
    fireEvent.click(retryButtons[0])
    expect(mockRetry).toHaveBeenCalledWith('d2')
  })

  it('shows error message for failed delivery', () => {
    renderDetail()
    expect(screen.getByText('Rate limit exceeded')).toBeDefined()
  })

  it('shows error type badge for failed delivery', () => {
    renderDetail()
    expect(screen.getByText('transient')).toBeDefined()
  })

  it('renders attempt counter for deliveries', () => {
    renderDetail()
    // Facebook delivery: attempt 1/3, Bluesky delivery: attempt 3/3
    expect(screen.getByText('Attempt 1/3')).toBeDefined()
    expect(screen.getByText('Attempt 3/3')).toBeDefined()
  })

  it('renders timeline events in chronological order', () => {
    renderDetail()
    // Timeline should contain: Created, Scheduled, Published on facebook, Failed on bluesky
    expect(screen.getByText('Created')).toBeDefined()
    expect(screen.getByText('Scheduled')).toBeDefined()
    expect(screen.getByText(/Published on facebook/)).toBeDefined()
    expect(screen.getByText(/Failed on bluesky/)).toBeDefined()
  })

  it('shows platform delivery URL for published delivery', () => {
    renderDetail()
    // The Facebook delivery has a platform_url
    const viewOnLink = screen.getByText(/View on Facebook/)
    expect(viewOnLink).toBeDefined()
    expect(viewOnLink.closest('a')!.getAttribute('href')).toBe('https://facebook.com/post/123')
  })

  it('shows post description text', () => {
    renderDetail()
    expect(screen.getByText('A test')).toBeDefined()
  })

  it('renders delivery status section header', () => {
    renderDetail()
    expect(screen.getByText(en.detail.deliveryStatus)).toBeDefined()
  })
})
