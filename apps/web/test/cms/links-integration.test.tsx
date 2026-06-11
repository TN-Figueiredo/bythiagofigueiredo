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

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

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
    <div data-panel data-title={title} style={style}><h3>{title}</h3>{children}</div>
  ),
}))

import { LinksHub } from '@/app/cms/(authed)/links/_hub'
import type { LinkDisplay, LinktreeDisplay, AnalyticsDisplay } from '@tn-figueiredo/links-admin'

afterEach(() => cleanup())

const makeTree = (): LinktreeDisplay => ({
  url: 'https://go.example.com',
  pageviews: 2500, last30: 1200, unique: 800, engagement: 32,
  topCountry: 'BR', spark: Array.from({ length: 30 }, (_, i) => 10 + i),
  blocks: [
    { id: 'b1', label: 'Blog', section: 'EN', clicks: 200, ctr: 16 },
    { id: 'b2', label: 'Newsletter', section: 'EN', clicks: 150, ctr: 12 },
  ],
  sharedLinks: [{ id: 's1', icon: 'globe', labelPt: 'About', labelEn: 'About', url: '/about' }],
})

const makeLinks = (): LinkDisplay[] => [
  {
    id: '1', title: 'Landing', slug: '/landing', source: 'newsletter',
    badge: 'Newsletter', dest: 'https://ex.com', status: 'active',
    clicks: 500, last30: 200, unique: 150, scans: 30, topCountry: 'BR',
    ctr: 12.5, created: '01 mai 2026', health: 'ok', redirect: 301,
    clickIds: true, spark: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 90, 80, 70, 60],
  },
  {
    id: '2', title: 'Blog Post', slug: '/blog', source: 'blog',
    badge: 'Blog', dest: 'https://ex.com/blog', status: 'paused',
    clicks: 100, last30: 50, unique: 30, scans: 5, topCountry: 'PT',
    ctr: 3.2, created: '15 mai 2026', health: 'warn', redirect: 301,
    clickIds: false, spark: [0, 1, 0, 2, 1, 0, 0, 1, 2, 1, 0, 0, 1, 0],
  },
]

const makeAnalytics = (): AnalyticsDisplay => ({
  totalClicks: 5000, prevClicks: 4000, unique: 2500, prevUnique: 2000,
  ctr: 12.5, prevCtr: 10, qrShare: 15, byDay: Array.from({ length: 30 }, (_, i) => 100 + i * 5),
  byDayPrev: Array.from({ length: 30 }, (_, i) => 80 + i * 3),
  bySource: [{ id: 'newsletter' as const, clicks: 2000, pct: 40 }, { id: 'blog' as const, clicks: 1500, pct: 30 }],
  devices: [{ k: 'Mobile', v: 60, color: '#3FA9C0' }],
  browsers: [{ k: 'Chrome', v: 70 }], os: [{ k: 'iOS', v: 50 }],
  referrers: [{ k: 'google.com', v: 40 }],
  countries: [{ code: 'BR', name: 'Brasil', v: 55, cities: ['SP'] }],
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 1)),
  topLinks: [], insights: [{ tone: 'up' as const, icon: 'trend', text: 'Traffic growing' }],
})

describe('Links Integration: Hub -> Tab -> Charts', () => {
  it('TreeTab renders blocks from tree data', () => {
    // 'Blog' also appears as a source label elsewhere in the tab — use *AllBy*
    const { getAllByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="tree" />)
    expect(getAllByText('Blog').length).toBeGreaterThanOrEqual(1)
    expect(getAllByText('Newsletter').length).toBeGreaterThanOrEqual(1)
  })

  it('TreeTab renders engagement stat from tree data', () => {
    const { getByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="tree" />)
    expect(getByText('32%')).toBeTruthy()
  })

  it('ShortLinksTab renders links from props', () => {
    const { getByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="links" />)
    expect(getByText('Landing')).toBeTruthy()
    expect(getByText('Blog Post')).toBeTruthy()
  })

  it('ShortLinksTab shows health panel for unhealthy links', () => {
    const { getByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="links" />)
    expect(getByText(/Saúde dos links/)).toBeTruthy()
  })

  it('AnalyticsView renders bar chart with 30 days of data', () => {
    const { container } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="analytics" />)
    const barChart = container.querySelector('[data-bar-chart]')
    expect(barChart).toBeTruthy()
    expect(barChart?.getAttribute('data-count')).toBe('30')
  })

  it('AnalyticsView renders heatmap with 7 day rows', () => {
    const { container } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="analytics" />)
    const heatmap = container.querySelector('[data-heatmap]')
    expect(heatmap?.getAttribute('data-rows')).toBe('7')
  })

  it('AnalyticsView renders source breakdown', () => {
    const { getByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="analytics" />)
    expect(getByText('Por origem')).toBeTruthy()
  })

  it('AnalyticsView renders insights text', () => {
    const { getByText } = render(<LinksHub tree={makeTree()} links={makeLinks()} analytics={makeAnalytics()} activeTab="analytics" />)
    expect(getByText('Traffic growing')).toBeTruthy()
  })

  it('Tab switching renders correct content', () => {
    const tree = makeTree()
    const links = makeLinks()
    const analytics = makeAnalytics()

    const { getByText: getTree } = render(<LinksHub tree={tree} links={links} analytics={analytics} activeTab="tree" />)
    expect(getTree(/Desempenho por bloco/)).toBeTruthy()
    cleanup()

    const { getAllByText: getLinksAll, getByText: getLinksText } = render(<LinksHub tree={tree} links={links} analytics={analytics} activeTab="links" />)
    expect(getLinksText('Landing')).toBeTruthy()
    expect(getLinksAll('Novo link').length).toBeGreaterThanOrEqual(1)
    cleanup()

    const { getByText: getAn } = render(<LinksHub tree={tree} links={links} analytics={analytics} activeTab="analytics" />)
    expect(getAn('Cliques por dia')).toBeTruthy()
  })

  it('hub passes correct stat values from tree data', () => {
    const tree = makeTree()
    tree.pageviews = 9999
    const { container } = render(<LinksHub tree={tree} links={makeLinks()} analytics={makeAnalytics()} activeTab="tree" />)
    expect(container.textContent).toContain('9.999')
  })
})
