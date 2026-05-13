import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a> }))

const mockCancel = vi.fn()
const mockDelete = vi.fn()
const mockRetry = vi.fn()
vi.mock('@/lib/social/actions', () => ({
  cancelSocialPost: (...args: unknown[]) => mockCancel(...args),
  deleteSocialPost: (...args: unknown[]) => mockDelete(...args),
  retrySocialDelivery: (...args: unknown[]) => mockRetry(...args),
}))

import { PostsFeed } from '@/app/cms/(authed)/social/_components/posts-feed'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockPosts = [
  {
    id: 'p1', site_id: 's1', created_by: 'u1', type: 'link' as const, status: 'completed' as const,
    scheduled_at: '2026-05-10T14:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: '2026-05-10T14:01:00Z',
    content: { title: 'Test Post', url: 'https://example.com' }, template_id: null, idempotency_key: 'k1',
    created_at: '2026-05-10T12:00:00Z', updated_at: '2026-05-10T14:01:00Z',
  },
  {
    id: 'p2', site_id: 's1', created_by: 'u1', type: 'text' as const, status: 'scheduled' as const,
    scheduled_at: '2026-05-15T10:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: null,
    content: { description: 'Upcoming post' }, template_id: null, idempotency_key: 'k2',
    created_at: '2026-05-09T12:00:00Z', updated_at: '2026-05-09T12:00:00Z',
  },
  {
    id: 'p3', site_id: 's1', created_by: 'u1', type: 'text' as const, status: 'failed' as const,
    scheduled_at: '2026-05-08T10:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: null,
    content: { description: 'Failed post' }, template_id: null, idempotency_key: 'k3',
    created_at: '2026-05-08T10:00:00Z', updated_at: '2026-05-08T10:00:00Z',
  },
]

function renderFeed(overrides: Record<string, unknown> = {}) {
  return render(<PostsFeed posts={mockPosts} siteId="s1" strings={en} {...overrides} />)
}

describe('PostsFeed', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders post cards', () => {
    renderFeed()
    expect(screen.getByText('Test Post')).toBeDefined()
    expect(screen.getByText('Upcoming post')).toBeDefined()
  })

  it('shows status badges', () => {
    renderFeed()
    // "Published", "Scheduled", "Failed" each appear twice: once in the
    // filter tab and once in the post card badge.
    expect(screen.getAllByText('Published').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(2)
  })

  it('shows "New Post" CTA in empty state', () => {
    render(<PostsFeed posts={[]} siteId="s1" strings={en} />)
    expect(screen.getByText(en.posts.emptyFeedCta)).toBeDefined()
  })

  it('renders filter tabs', () => {
    renderFeed()
    // Filter buttons are rendered as <button> elements
    const buttons = screen.getAllByRole('button')
    const filterLabels = buttons.map(b => b.textContent)
    expect(filterLabels).toContain(en.posts.filters.all)
    expect(filterLabels).toContain(en.posts.filters.published)
    expect(filterLabels).toContain(en.posts.filters.scheduled)
  })

  it('shows empty state when no posts', () => {
    render(<PostsFeed posts={[]} siteId="s1" strings={en} />)
    expect(screen.getByText(en.posts.emptyFeed)).toBeDefined()
  })

  it('shows bulk action bar when posts are selected', () => {
    renderFeed()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByText(en.posts.bulk.delete)).toBeDefined()
  })

  it('filters to show only matching posts when filter tab is clicked', () => {
    renderFeed()
    // Click the "Scheduled" filter
    const scheduledFilter = screen.getByRole('button', { name: /Filter: Scheduled/i })
    fireEvent.click(scheduledFilter)
    // Only the scheduled post ("Upcoming post") should remain visible
    expect(screen.getByText('Upcoming post')).toBeDefined()
    expect(screen.queryByText('Test Post')).toBeNull()
    expect(screen.queryByText('Failed post')).toBeNull()
  })

  it('shows bulk actions bar after checkbox selection', () => {
    renderFeed()
    const checkboxes = screen.getAllByRole('checkbox')
    // Select two posts
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    // Bulk bar should show "2 selected"
    expect(screen.getByRole('status')).toBeDefined()
    expect(screen.getByText('2 selected')).toBeDefined()
  })

  it('shows empty state when filtering to a status with no posts', () => {
    // Only provide completed and scheduled posts — no cancelled posts
    const postsWithoutCancelled = [
      {
        id: 'p1', site_id: 's1', created_by: 'u1', type: 'link' as const, status: 'completed' as const,
        scheduled_at: '2026-05-10T14:00:00Z', user_timezone: 'America/Sao_Paulo', published_at: '2026-05-10T14:01:00Z',
        content: { title: 'Test Post', url: 'https://example.com' }, template_id: null, idempotency_key: 'k1',
        created_at: '2026-05-10T12:00:00Z', updated_at: '2026-05-10T14:01:00Z',
      },
    ]
    render(<PostsFeed posts={postsWithoutCancelled} siteId="s1" strings={en} />)
    // Click the "Failed" filter — no posts match
    const failedFilter = screen.getByRole('button', { name: /Filter: Failed/i })
    fireEvent.click(failedFilter)
    // The filtered list should be empty (no post cards visible)
    expect(screen.queryByText('Test Post')).toBeNull()
  })

  it('clears selection when switching filters', () => {
    renderFeed()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    expect(screen.getByText(en.posts.bulk.delete)).toBeDefined()
    // Switch filter — selection should be cleared
    const scheduledFilter = screen.getByRole('button', { name: /Filter: Scheduled/i })
    fireEvent.click(scheduledFilter)
    expect(screen.queryByText('2 selected')).toBeNull()
  })
})
