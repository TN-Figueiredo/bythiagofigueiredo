// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Link2: icon('Link2'),
    Search: icon('Search'),
    Plus: icon('Plus'),
    ChevronRight: icon('ChevronRight'),
    AlertTriangle: icon('AlertTriangle'),
    QrCode: icon('QrCode'),
    Target: icon('Target'),
    TrendingUp: icon('TrendingUp'),
    Zap: icon('Zap'),
    Clock: icon('Clock'),
    RefreshCw: icon('RefreshCw'),
    Tag: icon('Tag'),
    Users: icon('Users'),
    Globe: icon('Globe'),
  }
})

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { ShortLinksTab } from '@/app/cms/(authed)/links/_components/short-links-tab'

afterEach(() => cleanup())

const links = [
  {
    id: '1', title: 'Landing Page', slug: '/landing', source: 'newsletter' as const,
    badge: 'Newsletter', dest: 'https://example.com/landing', status: 'active' as const,
    clicks: 500, last30: 200, unique: 150, scans: 30, topCountry: 'BR',
    ctr: 12.5, created: '2026-05-01', health: 'ok' as const, redirect: 301 as const,
    clickIds: true, spark: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  },
  {
    id: '2', title: 'Blog Post', slug: '/blog', source: 'blog' as const,
    badge: 'Blog', dest: 'https://example.com/blog', status: 'paused' as const,
    clicks: 100, last30: 50, unique: 30, scans: 5, topCountry: 'PT',
    ctr: 3.2, created: '2026-05-15', health: 'warn' as const, redirect: 301 as const,
    clickIds: false, spark: [0, 1, 0, 2, 1, 0, 0, 1, 2, 1, 0, 0, 1, 0],
  },
]

describe('ShortLinksTab', () => {
  it('renders stat tiles', () => {
    const { container } = render(<ShortLinksTab links={links} onCreateLink={() => {}} />)
    const tiles = container.querySelectorAll('[data-stat-tile]')
    expect(tiles.length).toBeGreaterThanOrEqual(3)
  })

  it('renders search input', () => {
    const { container } = render(<ShortLinksTab links={links} onCreateLink={() => {}} />)
    const input = container.querySelector('input[type="text"]')
    expect(input).toBeTruthy()
  })

  it('renders link rows', () => {
    const { getByText } = render(<ShortLinksTab links={links} onCreateLink={() => {}} />)
    expect(getByText('Landing Page')).toBeTruthy()
    expect(getByText('Blog Post')).toBeTruthy()
  })

  it('renders "Novo link" button', () => {
    const { getByText } = render(<ShortLinksTab links={links} onCreateLink={() => {}} />)
    expect(getByText('Novo link')).toBeTruthy()
  })

  it('calls onCreateLink when button clicked', () => {
    const onCreateLink = vi.fn()
    const { getByText } = render(<ShortLinksTab links={links} onCreateLink={onCreateLink} />)
    fireEvent.click(getByText('Novo link'))
    expect(onCreateLink).toHaveBeenCalled()
  })

  it('shows health panel when unhealthy links exist', () => {
    const { getByText } = render(<ShortLinksTab links={links} onCreateLink={() => {}} />)
    expect(getByText(/Saúde dos links/)).toBeTruthy()
  })

  it('renders empty state when no links', () => {
    const { getByText } = render(<ShortLinksTab links={[]} onCreateLink={() => {}} />)
    expect(getByText('Nenhum link encontrado.')).toBeTruthy()
  })
})
