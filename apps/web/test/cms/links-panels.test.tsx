// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  // Guarded Proxy: serves ANY icon the component tree asks for, so the mock
  // doesn't rot when components add icons (the previous explicit list broke on
  // every new icon). `then` must resolve to undefined — a thenable mock
  // namespace deadlocks vitest's `await factory()` forever.
  // (`has` trap: vitest checks `export in mock` before reading it.)
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, prop) => (typeof prop !== 'string' || prop === 'then' ? undefined : icon(prop)),
    has: (_target, prop) => typeof prop === 'string' && prop !== 'then',
  })
})

// TopLinksTable rows navigate via useRouter — without this mock its tests die
// with "invariant expected app router to be mounted".
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/cms/links',
}))

import { SourceBars } from '@/app/cms/(authed)/links/_components/source-bars'
import { TopLinksTable } from '@/app/cms/(authed)/links/_components/top-links-table'
import { InsightsPanel } from '@/app/cms/(authed)/links/_components/insights-panel'
import { PotentialPanel } from '@/app/cms/(authed)/links/_components/potential-panel'

afterEach(() => cleanup())

describe('SourceBars', () => {
  const sources = [
    { id: 'newsletter', clicks: 200, pct: 50 },
    { id: 'social', clicks: 100, pct: 25 },
    { id: 'blog', clicks: 100, pct: 25 },
  ]

  it('renders one bar per source', () => {
    const { container } = render(<SourceBars sources={sources} />)
    const bars = container.querySelectorAll('[data-source-row]')
    expect(bars.length).toBe(3)
  })

  it('renders source labels', () => {
    const { getByText } = render(<SourceBars sources={sources} />)
    expect(getByText('Newsletter')).toBeTruthy()
    expect(getByText('Social')).toBeTruthy()
    expect(getByText('Blog')).toBeTruthy()
  })

  it('renders colored dots for sources', () => {
    const { container } = render(<SourceBars sources={sources} />)
    // Dots are the aria-hidden color chips inside each source row
    const dots = container.querySelectorAll('[data-source-row] span[aria-hidden="true"]')
    expect(dots.length).toBe(3)
  })
})

describe('TopLinksTable', () => {
  const links = [
    { id: '1', title: 'Landing Page', slug: '/landing', clicks: 500, source: 'newsletter' as const },
    { id: '2', title: 'Blog Post', slug: '/blog-post', clicks: 300, source: 'blog' as const },
  ]

  it('renders rows for each link', () => {
    const { container } = render(<TopLinksTable links={links} />)
    const rows = container.querySelectorAll('[data-link-row]')
    expect(rows.length).toBe(2)
  })

  it('renders link titles', () => {
    const { getByText } = render(<TopLinksTable links={links} />)
    expect(getByText('Landing Page')).toBeTruthy()
    expect(getByText('Blog Post')).toBeTruthy()
  })

  it('renders empty state when no links', () => {
    const { getByText } = render(<TopLinksTable links={[]} />)
    expect(getByText('Nenhum link encontrado.')).toBeTruthy()
  })
})

describe('InsightsPanel', () => {
  const insights = [
    { tone: 'up' as const, icon: 'trendingUp', text: 'Trafego cresceu 15% esta semana' },
    { tone: 'amber' as const, icon: 'zap', text: 'Link XYZ perdeu 40% de cliques' },
  ]

  it('renders one row per insight', () => {
    const { container } = render(<InsightsPanel insights={insights} />)
    const rows = container.querySelectorAll('[data-insight-row]')
    expect(rows.length).toBe(2)
  })

  it('renders insight text', () => {
    const { getByText } = render(<InsightsPanel insights={insights} />)
    expect(getByText('Trafego cresceu 15% esta semana')).toBeTruthy()
  })

  it('renders empty state', () => {
    const { getByText } = render(<InsightsPanel insights={[]} />)
    expect(getByText('Nenhum insight disponivel.')).toBeTruthy()
  })
})

describe('PotentialPanel', () => {
  // PotentialPanel now owns a fixed FEATURES roadmap list (no props)

  it('renders features list', () => {
    const { getByText } = render(<PotentialPanel />)
    expect(getByText('Atribuição UTM')).toBeTruthy()
    expect(getByText('Mapa geográfico')).toBeTruthy()
  })

  it('renders descriptions', () => {
    const { getByText } = render(<PotentialPanel />)
    expect(getByText('Quebrar por source / medium / campaign automaticamente.')).toBeTruthy()
  })

  it('renders panel title', () => {
    const { getByText } = render(<PotentialPanel />)
    expect(getByText('Potencial — a implementar')).toBeTruthy()
  })
})
