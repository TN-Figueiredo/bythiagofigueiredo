// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Link2: icon('Link2'),
    TrendingUp: icon('TrendingUp'),
    Lightbulb: icon('Lightbulb'),
    Sparkles: icon('Sparkles'),
    ChevronRight: icon('ChevronRight'),
    ExternalLink: icon('ExternalLink'),
    Zap: icon('Zap'),
  }
})

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
    const dots = container.querySelectorAll('[data-source-dot]')
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
  const features = [
    { id: 'utm', label: 'UTM Attribution', desc: 'Veja de onde vem seu trafego' },
    { id: 'geo', label: 'Geo Map', desc: 'Mapa mundial de visitantes' },
  ]

  it('renders features list', () => {
    const { getByText } = render(<PotentialPanel features={features} />)
    expect(getByText('UTM Attribution')).toBeTruthy()
    expect(getByText('Geo Map')).toBeTruthy()
  })

  it('renders descriptions', () => {
    const { getByText } = render(<PotentialPanel features={features} />)
    expect(getByText('Veja de onde vem seu trafego')).toBeTruthy()
  })

  it('renders panel title', () => {
    const { getByText } = render(<PotentialPanel features={features} />)
    expect(getByText('Potencial')).toBeTruthy()
  })
})
