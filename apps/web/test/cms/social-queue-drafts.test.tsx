import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social'),
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { PostsQueue } from '@/app/cms/(authed)/social/_components/posts-queue'
import { PostsDrafts } from '@/app/cms/(authed)/social/_components/posts-drafts'
import { en } from '@/app/cms/(authed)/social/_i18n/en'
import type { SocialPost } from '@tn-figueiredo/social'

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: `p-${Math.random()}`,
    site_id: 's1',
    created_by: 'u1',
    type: 'text',
    status: 'scheduled',
    scheduled_at: '2026-05-20T10:00:00Z',
    user_timezone: 'UTC',
    published_at: null,
    content: { description: 'Scheduled post' },
    template_id: null,
    idempotency_key: `k-${Math.random()}`,
    created_at: '2026-05-10T09:00:00Z',
    updated_at: '2026-05-10T09:00:00Z',
    ...overrides,
  }
}

// ── PostsQueue ────────────────────────────────────────────────────────────────

describe('PostsQueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no scheduled posts', () => {
    render(<PostsQueue posts={[]} strings={en} />)
    expect(screen.getByText(en.posts.emptyQueue)).toBeDefined()
  })

  it('renders scheduled posts in the queue', () => {
    const posts = [makePost({ id: 'q1', content: { description: 'Queue post 1' } })]
    render(<PostsQueue posts={posts} strings={en} />)
    expect(screen.getByText('Queue post 1')).toBeDefined()
  })

  it('shows scheduled time for each post', () => {
    render(<PostsQueue posts={[makePost()]} strings={en} />)
    // The component formats the date — just ensure some time text is present
    const dateText = new Date('2026-05-20T10:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    expect(screen.getByText(dateText)).toBeDefined()
  })

  it('shows status badge for queued posts', () => {
    render(<PostsQueue posts={[makePost()]} strings={en} />)
    expect(screen.getByText(en.status.scheduled)).toBeDefined()
  })

  it('only shows posts with status=scheduled', () => {
    const posts = [
      makePost({ id: 'q1', status: 'scheduled', content: { description: 'Scheduled one' } }),
      makePost({ id: 'q2', status: 'completed', content: { description: 'Published one' } }),
      makePost({ id: 'q3', status: 'draft', content: { description: 'Draft one' } }),
    ]
    render(<PostsQueue posts={posts} strings={en} />)
    expect(screen.getByText('Scheduled one')).toBeDefined()
    expect(screen.queryByText('Published one')).toBeNull()
    expect(screen.queryByText('Draft one')).toBeNull()
  })

  it('shows position number for each queued post', () => {
    const posts = [
      makePost({ id: 'q1', scheduled_at: '2026-05-20T08:00:00Z', content: { description: 'First' } }),
      makePost({ id: 'q2', scheduled_at: '2026-05-20T10:00:00Z', content: { description: 'Second' } }),
    ]
    render(<PostsQueue posts={posts} strings={en} />)
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('sorts posts by scheduled_at ascending', () => {
    const posts = [
      makePost({ id: 'q2', scheduled_at: '2026-05-22T10:00:00Z', content: { description: 'Later post' } }),
      makePost({ id: 'q1', scheduled_at: '2026-05-20T08:00:00Z', content: { description: 'Earlier post' } }),
    ]
    render(<PostsQueue posts={posts} strings={en} />)
    const items = screen.getAllByRole('generic').filter(el => el.textContent?.includes('post'))
    // "Earlier post" should appear before "Later post" in the DOM
    const text = screen.getByText('Earlier post')
    const later = screen.getByText('Later post')
    expect(text.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ── PostsDrafts ────────────────────────────────────────────────────────────────

describe('PostsDrafts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no draft posts', () => {
    render(<PostsDrafts posts={[]} strings={en} />)
    expect(screen.getByText(en.posts.emptyDrafts)).toBeDefined()
  })

  it('shows CTA link in empty state', () => {
    render(<PostsDrafts posts={[]} strings={en} />)
    const link = screen.getByRole('link', { name: en.posts.emptyDraftsCta })
    expect(link.getAttribute('href')).toBe('/cms/social/accounts?tab=automations')
  })

  it('renders draft posts', () => {
    const posts = [makePost({ id: 'd1', status: 'draft', content: { description: 'Draft post' } })]
    render(<PostsDrafts posts={posts} strings={en} />)
    expect(screen.getByText('Draft post')).toBeDefined()
  })

  it('shows review button for each draft', () => {
    const posts = [makePost({ id: 'd1', status: 'draft' })]
    render(<PostsDrafts posts={posts} strings={en} />)
    expect(screen.getByText(en.posts.review)).toBeDefined()
  })

  it('review link points to composer with draft id', () => {
    const posts = [makePost({ id: 'draft-42', status: 'draft' })]
    render(<PostsDrafts posts={posts} strings={en} />)
    const link = screen.getByRole('link', { name: en.posts.review })
    expect(link.getAttribute('href')).toBe('/cms/social/new?draft=draft-42')
  })

  it('only shows posts with status=draft', () => {
    const posts = [
      makePost({ id: 'd1', status: 'draft', content: { description: 'Draft one' } }),
      makePost({ id: 's1', status: 'scheduled', content: { description: 'Scheduled one' } }),
    ]
    render(<PostsDrafts posts={posts} strings={en} />)
    expect(screen.getByText('Draft one')).toBeDefined()
    expect(screen.queryByText('Scheduled one')).toBeNull()
  })

  it('shows "(no content)" fallback when draft has no title or description', () => {
    const posts = [makePost({ id: 'd1', status: 'draft', content: {} })]
    render(<PostsDrafts posts={posts} strings={en} />)
    expect(screen.getByText(en.posts.noContent)).toBeDefined()
  })
})
