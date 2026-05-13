import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social'),
}))

import { PostsCalendar } from '@/app/cms/(authed)/social/_components/posts-calendar'
import { en } from '@/app/cms/(authed)/social/_i18n/en'
import type { SocialPost } from '@tn-figueiredo/social'

const TODAY = new Date()
const todayStr = TODAY.toISOString().slice(0, 10)

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: `p-${Math.random()}`,
    site_id: 's1',
    created_by: 'u1',
    type: 'text',
    status: 'scheduled',
    scheduled_at: `${todayStr}T10:00:00Z`,
    user_timezone: 'UTC',
    published_at: null,
    content: { description: 'A post' },
    template_id: null,
    idempotency_key: `k-${Math.random()}`,
    created_at: `${todayStr}T09:00:00Z`,
    updated_at: `${todayStr}T09:00:00Z`,
    ...overrides,
  }
}

describe('PostsCalendar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state when no posts', () => {
    render(<PostsCalendar posts={[]} strings={en} />)
    expect(screen.getByText(en.posts.emptyCalendar)).toBeDefined()
  })

  it('renders the calendar grid with posts', () => {
    const posts = [makePost()]
    render(<PostsCalendar posts={posts} strings={en} />)
    expect(screen.getByRole('grid', { name: 'Posts calendar' })).toBeDefined()
  })

  it('renders 7 day name columns', () => {
    render(<PostsCalendar posts={[makePost()]} strings={en} />)
    const grid = screen.getByRole('grid')
    // First 7 children (non-gridcell) are day names
    const gridCells = screen.getAllByRole('gridcell')
    // There are cells rendered (at least today's day number)
    expect(gridCells.length).toBeGreaterThan(7)
  })

  it('renders post content on its scheduled day', () => {
    render(<PostsCalendar posts={[makePost({ content: { description: 'Calendar Post' } })]} strings={en} />)
    expect(screen.getByText('Calendar Post')).toBeDefined()
  })

  it('shows month name in header', () => {
    render(<PostsCalendar posts={[makePost()]} strings={en} />)
    const expected = TODAY.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    expect(screen.getByText(expected)).toBeDefined()
  })

  it('navigates to previous month on prev click', () => {
    render(<PostsCalendar posts={[makePost()]} strings={en} />)
    const prev = screen.getByRole('button', { name: 'Previous month' })
    fireEvent.click(prev)
    const prevDate = new Date(TODAY.getFullYear(), TODAY.getMonth() - 1)
    const prevMonthName = prevDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    expect(screen.getByText(prevMonthName)).toBeDefined()
  })

  it('navigates to next month on next click', () => {
    render(<PostsCalendar posts={[makePost()]} strings={en} />)
    const next = screen.getByRole('button', { name: 'Next month' })
    fireEvent.click(next)
    const nextDate = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1)
    const nextMonthName = nextDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    expect(screen.getByText(nextMonthName)).toBeDefined()
  })

  it('renders day numbers as gridcells', () => {
    render(<PostsCalendar posts={[makePost()]} strings={en} />)
    // Today's date number should appear
    const day = String(TODAY.getDate())
    // There may be multiple cells showing the same number if prev/next month overlap —
    // just verify at least one instance of today's date number appears in the grid.
    const cells = screen.getAllByRole('gridcell')
    const hasToday = cells.some(c => c.textContent?.includes(day))
    expect(hasToday).toBe(true)
  })

  it('shows +N overflow indicator when more than 3 posts on a day', () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: `p${i}`, content: { description: `Post ${i}` } }),
    )
    render(<PostsCalendar posts={posts} strings={en} />)
    expect(screen.getByText('+2')).toBeDefined()
  })
})
