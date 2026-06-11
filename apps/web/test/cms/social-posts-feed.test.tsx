// @vitest-environment happy-dom
/**
 * NOTE: this file originally tested <PostsFeed>, deleted in 35b6a0f7
 * (2026-05-30 dead-file cleanup) — the file was orphaned and failed module
 * resolution ever since. <FeedGrid> is the live feed view; same intent:
 * the social posts feed renders filterable post cards with an empty state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { afterEach } from 'vitest'

const mockPush = vi.fn()
let mockSearch = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => mockSearch,
  usePathname: () => '/cms/social',
}))

// Isolate the grid from the card's own dependency tree
vi.mock('@/app/cms/(authed)/social/_components/feed-card', () => ({
  FeedCard: ({ item }: { item: { id: string; title: string } }) => (
    <div data-testid={`feed-card-${item.id}`}>{item.title}</div>
  ),
}))

import { FeedGrid, type FeedItem } from '@/app/cms/(authed)/social/_components/feed-grid'

afterEach(() => cleanup())

function makeItem(overrides?: Partial<FeedItem>): FeedItem {
  return {
    id: 'p1', status: 'published', title: 'Post One', imageUrl: null,
    scheduledAt: null, publishedAt: '2026-06-01T12:00:00Z',
    destId: null, destLabel: 'Instagram', provider: 'instagram',
    statusLabel: 'No ar',
    ...overrides,
  }
}

describe('FeedGrid', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockSearch = new URLSearchParams()
  })

  it('renders one card per item', () => {
    render(<FeedGrid items={[makeItem(), makeItem({ id: 'p2', title: 'Post Two' })]} />)
    expect(screen.getAllByRole('listitem').length).toBe(2)
    expect(screen.getByText('Post One')).toBeDefined()
    expect(screen.getByText('Post Two')).toBeDefined()
  })

  it('renders the status filter group', () => {
    render(<FeedGrid items={[makeItem()]} />)
    expect(screen.getByRole('group', { name: 'Filtrar por status' })).toBeDefined()
    expect(screen.getByText('Tudo')).toBeDefined()
    expect(screen.getByText('No ar')).toBeDefined()
    expect(screen.getByText('Agendados')).toBeDefined()
    expect(screen.getByText('Falhas')).toBeDefined()
  })

  it('pushes the status param when a filter is clicked', () => {
    render(<FeedGrid items={[makeItem()]} />)
    fireEvent.click(screen.getByText('Agendados'))
    expect(mockPush).toHaveBeenCalledWith('/cms/social?status=scheduled')
  })

  it('clears the status param when "Tudo" is clicked', () => {
    mockSearch = new URLSearchParams('status=failed')
    render(<FeedGrid items={[makeItem()]} />)
    fireEvent.click(screen.getByText('Tudo'))
    expect(mockPush).toHaveBeenCalledWith('/cms/social?')
  })

  it('marks the active filter with aria-pressed', () => {
    mockSearch = new URLSearchParams('status=published')
    render(<FeedGrid items={[makeItem()]} />)
    expect(screen.getByText('No ar').closest('button')?.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Tudo').closest('button')?.getAttribute('aria-pressed')).toBe('false')
  })

  it('renders empty state when there are no items', () => {
    render(<FeedGrid items={[]} />)
    expect(screen.getByText('Nenhum post encontrado')).toBeDefined()
    expect(screen.getByText('Crie seu primeiro post para comecar')).toBeDefined()
  })

  it('renders filter-aware empty state when a filter is active', () => {
    mockSearch = new URLSearchParams('status=failed')
    render(<FeedGrid items={[]} />)
    expect(screen.getByText('Nenhum post falhas')).toBeDefined()
    expect(screen.getByText('Tente outro filtro ou crie um novo post')).toBeDefined()
  })
})
