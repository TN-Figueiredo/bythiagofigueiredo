// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return new Proxy({}, { get: (_, key) => icon(key as string) })
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/cms/links',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@tn-figueiredo/links-admin', () => ({
  SOURCE_COLORS: {
    newsletter: '#A77CE8', social: '#3FA9C0', blog: '#46B17E',
    qr: '#E0A23C', campaign: '#5B7FD6', manual: '#8A8F98',
  },
  SOURCE_LABELS: {
    newsletter: 'Newsletter', social: 'Social', blog: 'Blog',
    qr: 'QR', campaign: 'Campanha', manual: 'Manual',
  },
}))

vi.mock('@tn-figueiredo/links-admin/client', () => ({
  StatTile: ({ label, value, sub, delta, spark }: Record<string, unknown>) => (
    <div data-stat-tile>
      <span>{label as string}</span>
      <span>{value as string}</span>
      {sub && <span>{sub as string}</span>}
      {delta}
      {spark}
    </div>
  ),
  Delta: ({ cur, prev, suffix }: { cur: number; prev: number; suffix?: string }) => (
    <span data-delta>{cur} vs {prev} {suffix ?? '%'}</span>
  ),
  Spark: ({ data }: { data: number[] }) => <svg data-spark data-points={data.length} />,
  BarChart: ({ data, prev }: { data: number[]; prev?: number[] }) => (
    <div data-bar-chart data-count={data.length} data-prev={prev?.length ?? 0} />
  ),
  Donut: ({ segments, centerLabel, centerSub }: Record<string, unknown>) => (
    <div data-donut>
      {centerLabel && <span>{centerLabel as string}</span>}
      {centerSub && <span>{centerSub as string}</span>}
    </div>
  ),
  HBars: ({ rows }: { rows: Array<{ k: string; v: number }> }) => (
    <div data-hbars>{rows.map(r => <div key={r.k}>{r.k}: {r.v}</div>)}</div>
  ),
  Heatmap: ({ grid }: { grid: number[][] }) => <div data-heatmap data-rows={grid.length} />,
  CountryList: ({ countries }: { countries: Array<{ code: string; name: string }> }) => (
    <div data-country-list>{countries.map(c => <div key={c.code}>{c.name}</div>)}</div>
  ),
  Panel: ({ title, children, style }: { title: string; children: React.ReactNode; style?: Record<string, unknown> }) => (
    <div data-panel style={style}><h3>{title}</h3>{children}</div>
  ),
}))

import { LinksHub } from '@/app/cms/(authed)/links/_hub'

afterEach(() => cleanup())

const mockTree = {
  url: 'https://go.bythiagofigueiredo.com',
  pageviews: 1000, last30: 500, unique: 300, engagement: 30,
  topCountry: 'BR', spark: Array.from({ length: 30 }, () => 10),
  blocks: [{ id: '1', label: 'Blog', section: 'EN', clicks: 50, ctr: 5 }],
  sharedLinks: [],
}

const mockLinks = [
  {
    id: '1', title: 'Test', slug: '/test', source: 'blog' as const,
    badge: 'Blog', dest: 'https://ex.com', status: 'active' as const,
    clicks: 100, last30: 50, unique: 30, scans: 5, topCountry: 'BR',
    ctr: 5, created: '2026-05-01', health: 'ok' as const, redirect: 301 as const,
    clickIds: false, spark: Array.from({ length: 14 }, () => 5),
  },
]

const mockAnalytics = {
  totalClicks: 1000, prevClicks: 800, unique: 500, prevUnique: 400,
  ctr: 10, prevCtr: 8, qrShare: 12, byDay: Array.from({ length: 30 }, () => 30),
  byDayPrev: Array.from({ length: 30 }, () => 25),
  bySource: [{ id: 'blog' as const, clicks: 500, pct: 50 }],
  devices: [{ k: 'Mobile', v: 60, color: '#3FA9C0' }],
  browsers: [{ k: 'Chrome', v: 70 }], os: [{ k: 'iOS', v: 50 }],
  referrers: [{ k: 'google.com', v: 40 }],
  countries: [{ code: 'BR', name: 'Brasil', v: 55, cities: [] }],
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 1)),
  topLinks: [], insights: [],
}

describe('LinksHub', () => {
  it('renders page title "Links"', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="tree" />)
    expect(getByText('Links')).toBeTruthy()
  })

  it('renders tab bar with 3 tabs', () => {
    const { container } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="tree" />)
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs.length).toBe(3)
  })

  it('renders TreeTab when activeTab=tree', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="tree" />)
    expect(getByText(/Link in Bio agora vive aqui/)).toBeTruthy()
  })

  it('renders ShortLinksTab when activeTab=links', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="links" />)
    expect(getByText('Novo link')).toBeTruthy()
  })

  it('renders AnalyticsView when activeTab=analytics', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="analytics" />)
    expect(getByText('Cliques por dia')).toBeTruthy()
  })
})
