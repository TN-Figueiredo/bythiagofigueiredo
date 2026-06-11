// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

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

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  // `then` MUST resolve to undefined: vitest `await`s the factory result, and a
  // Proxy that returns a function for EVERY key (including `then`) is a thenable
  // whose `then` never settles — the lucide-react import deadlocks the fork at
  // 0% CPU and the whole suite hangs forever (this is what hung CI for 6h).
  // (`has` trap: vitest checks `export in mock` before reading it.)
  return new Proxy(
    {},
    {
      get: (_, key) => (typeof key !== 'string' || key === 'then' ? undefined : icon(key)),
      has: (_, key) => typeof key === 'string' && key !== 'then',
    },
  )
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

// Mock child components to avoid deep dependency resolution
vi.mock('@/app/cms/(authed)/links/_components/tree-tab', () => ({
  TreeTab: () => <div data-testid="tree-tab">Link in Bio agora vive aqui</div>,
}))

vi.mock('@/app/cms/(authed)/links/_components/short-links-tab', () => ({
  ShortLinksTab: ({ onCreateLink }: { onCreateLink: () => void }) => (
    <div data-testid="short-links-tab">
      <button type="button" onClick={onCreateLink}>Novo link</button>
    </div>
  ),
}))

vi.mock('@/app/cms/(authed)/links/_components/analytics-view', () => ({
  AnalyticsView: () => <div data-testid="analytics-view">Cliques por dia</div>,
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
    const { getByRole } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="tree" />)
    expect(getByRole('heading', { name: 'Links' })).toBeTruthy()
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
    const { getAllByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="links" />)
    // Header + ShortLinksTab both render "Novo link"
    expect(getAllByText('Novo link').length).toBeGreaterThanOrEqual(1)
  })

  it('renders AnalyticsView when activeTab=analytics', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="analytics" />)
    expect(getByText('Cliques por dia')).toBeTruthy()
  })

  it('renders QR Card button in header', () => {
    const { getByText } = render(<LinksHub tree={mockTree} links={mockLinks} analytics={mockAnalytics} activeTab="tree" />)
    expect(getByText('QR Card')).toBeTruthy()
  })
})
