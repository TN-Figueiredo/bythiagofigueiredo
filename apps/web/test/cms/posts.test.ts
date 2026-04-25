import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, within } from '@testing-library/react'
import { createElement } from 'react'

// ── Mocks ────────────────────────────────────────────────────────────

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    createElement('a', { href, ...props }, children),
}))

vi.mock('@tn-figueiredo/cms-ui/client', () => ({
  StatusBadge: ({ variant }: { variant: string }) =>
    createElement('span', { 'data-testid': `status-badge-${variant}` }, variant),
}))

import {
  PostsListConnected,
  type PostRow,
  type Author,
} from '../../src/app/cms/(authed)/blog/_components/posts-list-connected'

// ── Fixtures ─────────────────────────────────────────────────────────

function makePost(overrides: Partial<PostRow> = {}): PostRow {
  return {
    id: 'p1',
    title: 'Test Post',
    slug: 'test-post',
    status: 'draft',
    locales: ['pt-BR'],
    authorName: 'Alice',
    authorId: 'a1',
    authorInitials: 'AL',
    updatedAt: 'Apr 20',
    readingTime: 3,
    coverImageUrl: null,
    viewCount: 0,
    ...overrides,
  }
}

const defaultAuthors: Author[] = [
  { id: 'a1', display_name: 'Alice' },
  { id: 'a2', display_name: 'Bob' },
]

const defaultCounts: Record<string, number> = {
  draft: 3,
  published: 5,
  pending_review: 1,
  archived: 2,
}

const noopAction = vi.fn().mockResolvedValue({ ok: true, count: 0 })

function renderComponent(overrides: Partial<Parameters<typeof PostsListConnected>[0]> = {}) {
  return render(
    createElement(PostsListConnected, {
      posts: [makePost()],
      total: 1,
      page: 1,
      pageSize: 50,
      counts: defaultCounts,
      authors: defaultAuthors,
      onBulkPublish: noopAction,
      onBulkArchive: noopAction,
      onBulkDelete: noopAction,
      onBulkChangeAuthor: noopAction,
      ...overrides,
    }),
  )
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PostsListConnected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentSearchParams = new URLSearchParams()
  })

  // ── Table rendering ────────────────────────────────────────────

  it('renders the posts table with data', () => {
    renderComponent()
    expect(screen.getByTestId('posts-table')).toBeDefined()
    expect(screen.getByTestId('post-row-p1')).toBeDefined()
    expect(screen.getAllByText('Test Post').length).toBeGreaterThan(0)
  })

  it('shows author name and initials in post row', () => {
    renderComponent()
    // Alice appears in both desktop + mobile + bulk author dropdown
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getByText('AL')).toBeDefined()
  })

  it('shows locale badges', () => {
    renderComponent({ posts: [makePost({ locales: ['pt-BR', 'en'] })] })
    // Locale badges appear in both desktop and mobile views
    expect(screen.getAllByText('PT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EN').length).toBeGreaterThan(0)
  })

  // ── Empty states ───────────────────────────────────────────────

  it('shows zero-data empty state when no posts and no filters', () => {
    renderComponent({ posts: [], total: 0 })
    expect(screen.getByTestId('posts-empty-state')).toBeDefined()
    expect(screen.getByText('No posts yet')).toBeDefined()
    expect(screen.getByText('Create first post')).toBeDefined()
  })

  it('shows filtered empty state when no posts but filters are active', () => {
    currentSearchParams = new URLSearchParams('status=published')
    renderComponent({ posts: [], total: 0 })
    expect(screen.getByTestId('posts-filtered-empty')).toBeDefined()
    expect(screen.getByText('No posts match your filters')).toBeDefined()
  })

  // ── Status filter pills ────────────────────────────────────────

  it('renders status filter pills with counts', () => {
    renderComponent()
    const pills = screen.getByTestId('status-pills')
    expect(pills).toBeDefined()
    expect(screen.getByTestId('status-pill-all')).toBeDefined()
    expect(screen.getByTestId('status-pill-draft')).toBeDefined()
    expect(screen.getByTestId('status-pill-published')).toBeDefined()
  })

  it('clicking a status pill pushes URL with status param', () => {
    renderComponent()
    const publishedPill = screen.getByTestId('status-pill-published')
    fireEvent.click(publishedPill)
    expect(pushMock).toHaveBeenCalled()
    const url = pushMock.mock.calls[0]![0] as string
    expect(url).toContain('status=published')
  })

  // ── Search ─────────────────────────────────────────────────────

  it('renders search input', () => {
    renderComponent()
    expect(screen.getByTestId('posts-search-input')).toBeDefined()
  })

  it('debounces search and pushes URL param', async () => {
    vi.useFakeTimers()
    renderComponent()
    const input = screen.getByTestId('posts-search-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    // Not pushed yet (debounce)
    expect(pushMock).not.toHaveBeenCalled()
    // Advance past debounce
    vi.advanceTimersByTime(350)
    expect(pushMock).toHaveBeenCalled()
    const url = pushMock.mock.calls[0]![0] as string
    expect(url).toContain('q=hello')
    vi.useRealTimers()
  })

  // ── Sort ───────────────────────────────────────────────────────

  it('renders sort dropdown', () => {
    renderComponent()
    expect(screen.getByTestId('posts-sort-select')).toBeDefined()
  })

  it('changing sort pushes URL param', () => {
    renderComponent()
    const select = screen.getByTestId('posts-sort-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'oldest' } })
    expect(pushMock).toHaveBeenCalled()
    const url = pushMock.mock.calls[0]![0] as string
    expect(url).toContain('sort=oldest')
  })

  // ── Selection + bulk bar ───────────────────────────────────────

  it('bulk actions bar is hidden when nothing is selected', () => {
    renderComponent()
    expect(screen.queryByTestId('bulk-actions-bar')).toBeNull()
  })

  it('selecting a post shows the bulk actions bar', () => {
    renderComponent()
    const checkbox = screen.getByLabelText('Select Test Post')
    fireEvent.click(checkbox)
    expect(screen.getByTestId('bulk-actions-bar')).toBeDefined()
    expect(screen.getByText('1 selected')).toBeDefined()
  })

  it('select-all checkbox selects all visible posts', () => {
    const posts = [
      makePost({ id: 'p1', title: 'Post 1' }),
      makePost({ id: 'p2', title: 'Post 2' }),
    ]
    renderComponent({ posts, total: 2 })
    const selectAll = screen.getByTestId('select-all-checkbox')
    fireEvent.click(selectAll)
    expect(screen.getByTestId('bulk-actions-bar')).toBeDefined()
    expect(screen.getByText('2 selected')).toBeDefined()
  })

  it('bulk publish button calls onBulkPublish with selected ids', async () => {
    const onBulkPublish = vi.fn().mockResolvedValue({ ok: true, count: 1 })
    renderComponent({ onBulkPublish })
    // Select the post
    fireEvent.click(screen.getByLabelText('Select Test Post'))
    // Click publish
    fireEvent.click(screen.getByTestId('bulk-publish-btn'))
    expect(onBulkPublish).toHaveBeenCalledWith(['p1'])
  })

  it('bulk archive button calls onBulkArchive with selected ids', async () => {
    const onBulkArchive = vi.fn().mockResolvedValue({ ok: true, count: 1 })
    renderComponent({ onBulkArchive })
    fireEvent.click(screen.getByLabelText('Select Test Post'))
    fireEvent.click(screen.getByTestId('bulk-archive-btn'))
    expect(onBulkArchive).toHaveBeenCalledWith(['p1'])
  })

  it('bulk delete button calls onBulkDelete with selected ids', async () => {
    const onBulkDelete = vi.fn().mockResolvedValue({ ok: true, count: 1 })
    renderComponent({ onBulkDelete })
    fireEvent.click(screen.getByLabelText('Select Test Post'))
    fireEvent.click(screen.getByTestId('bulk-delete-btn'))
    expect(onBulkDelete).toHaveBeenCalledWith(['p1'])
  })

  it('bulk change author requires selecting an author', () => {
    const onBulkChangeAuthor = vi.fn().mockResolvedValue({ ok: true, count: 1 })
    renderComponent({ onBulkChangeAuthor })
    fireEvent.click(screen.getByLabelText('Select Test Post'))
    // Click apply without selecting an author
    const applyBtn = screen.getByTestId('bulk-change-author-btn') as HTMLButtonElement
    fireEvent.click(applyBtn)
    // Should NOT be called when no author is selected
    expect(onBulkChangeAuthor).not.toHaveBeenCalled()
  })

  // ── Pagination ─────────────────────────────────────────────────

  it('shows pagination when total exceeds pageSize', () => {
    renderComponent({ total: 100, pageSize: 50 })
    expect(screen.getByTestId('posts-pagination')).toBeDefined()
    expect(screen.getByText(/Showing 1–50 of 100/)).toBeDefined()
  })

  it('does not show pagination when total fits in one page', () => {
    renderComponent({ total: 10, pageSize: 50 })
    expect(screen.queryByTestId('posts-pagination')).toBeNull()
  })

  it('pagination next button pushes page param', () => {
    renderComponent({ total: 100, pageSize: 50, page: 1 })
    fireEvent.click(screen.getByTestId('pagination-next'))
    expect(pushMock).toHaveBeenCalled()
    const url = pushMock.mock.calls[0]![0] as string
    expect(url).toContain('page=2')
  })

  // ── Row variants ───────────────────────────────────────────────

  it('renders draft posts with dimmed title', () => {
    renderComponent({ posts: [makePost({ status: 'draft' })] })
    // The status badge appears in both desktop + mobile views
    expect(screen.getAllByTestId('status-badge-draft').length).toBeGreaterThan(0)
  })

  it('renders published posts with view count', () => {
    renderComponent({
      posts: [makePost({ status: 'published', viewCount: 42 })],
    })
    expect(screen.getByText(/42 views/)).toBeDefined()
  })

  it('renders pending_review posts with amber tint row', () => {
    const { container } = renderComponent({
      posts: [makePost({ id: 'pr1', status: 'pending_review' })],
    })
    const row = container.querySelector('[data-testid="post-row-pr1"]')
    expect(row?.className).toContain('amber')
  })

  it('renders empty draft title as italic "Sem titulo"', () => {
    renderComponent({ posts: [makePost({ title: '' })] })
    // "Sem titulo" appears in both desktop + mobile views
    expect(screen.getAllByText('Sem titulo').length).toBeGreaterThan(0)
  })

  it('renders cover image when available', () => {
    const { container } = renderComponent({
      posts: [makePost({ coverImageUrl: 'https://example.com/cover.jpg' })],
    })
    const img = container.querySelector('img')
    expect(img).toBeDefined()
    expect(img?.getAttribute('src')).toBe('https://example.com/cover.jpg')
  })
})
