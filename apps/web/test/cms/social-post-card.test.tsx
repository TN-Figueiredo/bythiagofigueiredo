import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/cms/social'),
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { PostCard } from '@/app/cms/(authed)/social/_components/post-card'
import { en } from '@/app/cms/(authed)/social/_i18n/en'
import type { SocialPost } from '@tn-figueiredo/social'

const basePost: SocialPost = {
  id: 'p1',
  site_id: 's1',
  created_by: 'u1',
  type: 'link',
  status: 'completed',
  scheduled_at: '2026-05-10T14:00:00Z',
  user_timezone: 'America/Sao_Paulo',
  published_at: '2026-05-10T14:01:00Z',
  content: { title: 'My Post Title', url: 'https://example.com' },
  template_id: null,
  idempotency_key: 'k1',
  created_at: '2026-05-10T12:00:00Z',
  updated_at: '2026-05-10T14:01:00Z',
}

function renderCard(overrides: Partial<SocialPost> = {}, extra: { selected?: boolean; onSelect?: (id: string) => void } = {}) {
  const post = { ...basePost, ...overrides }
  const onSelect = extra.onSelect ?? vi.fn()
  const selected = extra.selected ?? false
  return render(<PostCard post={post} strings={en} selected={selected} onSelect={onSelect} />)
}

describe('PostCard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders content title', () => {
    renderCard()
    expect(screen.getByText('My Post Title')).toBeDefined()
  })

  it('shows status badge', () => {
    renderCard()
    expect(screen.getByText(en.status.completed)).toBeDefined()
  })

  it('shows post type', () => {
    renderCard()
    expect(screen.getByText('link')).toBeDefined()
  })

  it('shows URL when present', () => {
    renderCard()
    expect(screen.getByText('https://example.com')).toBeDefined()
  })

  it('shows checkbox', () => {
    renderCard()
    expect(screen.getByRole('checkbox')).toBeDefined()
  })

  it('checkbox is checked when selected=true', () => {
    renderCard({}, { selected: true })
    const cb = screen.getByRole('checkbox') as HTMLInputElement
    expect(cb.checked).toBe(true)
  })

  it('fires onSelect when checkbox clicked', () => {
    const onSelect = vi.fn()
    renderCard({}, { onSelect })
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onSelect).toHaveBeenCalledWith('p1')
  })

  it('shows "(no content)" fallback when title and description are both absent', () => {
    renderCard({ content: {} })
    expect(screen.getByText(en.posts.noContent)).toBeDefined()
  })

  it('uses description as fallback when title is absent', () => {
    renderCard({ content: { description: 'A description' } })
    expect(screen.getByText('A description')).toBeDefined()
  })

  it('links to post detail page', () => {
    renderCard()
    const link = screen.getByRole('link', { name: 'My Post Title' })
    expect(link.getAttribute('href')).toBe('/cms/social/p1')
  })
})
