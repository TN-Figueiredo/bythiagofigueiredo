// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../../src/app/cms/(authed)/links/actions', () => ({
  exportAnalyticsCsv: vi.fn().mockResolvedValue({ ok: true, csv: 'header\r\ndata\r\n' }),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    BarChart3: icon('BarChart3'),
    Globe: icon('Globe'),
    Monitor: icon('Monitor'),
    Smartphone: icon('Smartphone'),
    TrendingUp: icon('TrendingUp'),
    Lightbulb: icon('Lightbulb'),
    Sparkles: icon('Sparkles'),
  }
})

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

import { AnalyticsView } from '@/app/cms/(authed)/links/_components/analytics-view'

afterEach(() => cleanup())

const analytics = {
  totalClicks: 5000,
  prevClicks: 4000,
  unique: 2500,
  prevUnique: 2000,
  ctr: 12.5,
  prevCtr: 10.0,
  qrShare: 15.2,
  byDay: Array.from({ length: 30 }, (_, i) => 100 + i * 5),
  byDayPrev: Array.from({ length: 30 }, (_, i) => 80 + i * 3),
  bySource: [
    { id: 'newsletter' as const, clicks: 2000, pct: 40 },
    { id: 'social' as const, clicks: 1500, pct: 30 },
    { id: 'blog' as const, clicks: 1000, pct: 20 },
    { id: 'qr' as const, clicks: 500, pct: 10 },
  ],
  devices: [
    { k: 'Mobile', v: 60, color: '#3FA9C0' },
    { k: 'Desktop', v: 35, color: '#46B17E' },
    { k: 'Tablet', v: 5, color: '#E0A23C' },
  ],
  browsers: [{ k: 'Chrome', v: 65 }, { k: 'Safari', v: 25 }, { k: 'Firefox', v: 10 }],
  os: [{ k: 'iOS', v: 45 }, { k: 'Android', v: 35 }, { k: 'Windows', v: 20 }],
  referrers: [{ k: 'google.com', v: 40 }, { k: 'twitter.com', v: 25 }],
  countries: [
    { code: 'BR', name: 'Brasil', v: 55, cities: ['Sao Paulo', 'Rio'] },
    { code: 'PT', name: 'Portugal', v: 25, cities: ['Lisboa'] },
    { code: 'US', name: 'Estados Unidos', v: 15, cities: [] },
  ],
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 5))),
  topLinks: [],
  insights: [
    { tone: 'up' as const, icon: 'trendingUp', text: 'Trafego cresceu 25%' },
  ],
}

describe('AnalyticsView', () => {
  it('renders 4 KPI tiles', () => {
    const { container } = render(<AnalyticsView data={analytics} />)
    const tiles = container.querySelectorAll('[data-stat-tile]')
    expect(tiles.length).toBe(4)
  })

  it('renders bar chart panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Cliques por dia')).toBeTruthy()
  })

  it('renders source breakdown panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Origem do trafego')).toBeTruthy()
  })

  it('renders device donut', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Dispositivos')).toBeTruthy()
  })

  it('renders browser bars', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Navegadores')).toBeTruthy()
  })

  it('renders heatmap panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText(/Horarios de pico/)).toBeTruthy()
  })

  it('renders country panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText(/paises/i)).toBeTruthy()
  })

  it('renders insights panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Trafego cresceu 25%')).toBeTruthy()
  })

  it('renders empty state messages when data arrays are empty', () => {
    const emptyAnalytics = {
      ...analytics,
      devices: [],
      browsers: [],
      os: [],
      referrers: [],
      countries: [],
    }
    const { getByText } = render(<AnalyticsView data={emptyAnalytics} />)
    expect(getByText('Dados de dispositivos ainda nao disponiveis.')).toBeTruthy()
    expect(getByText('Dados de navegadores ainda nao disponiveis.')).toBeTruthy()
    expect(getByText('Dados de sistemas ainda nao disponiveis.')).toBeTruthy()
    expect(getByText('Dados de referrers ainda nao disponiveis.')).toBeTruthy()
    expect(getByText('Dados geograficos ainda nao disponiveis.')).toBeTruthy()
  })

  it('renders potential features panel', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Potencial')).toBeTruthy()
    expect(getByText('UTM Attribution')).toBeTruthy()
  })

  it('renders period comparison note', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText(/Comparando com periodo anterior/)).toBeTruthy()
  })

  it('renders top links table when topLinks has data', () => {
    const withTopLinks = {
      ...analytics,
      topLinks: [
        { id: 'l1', title: 'My Link', slug: 'my-link', clicks: 120, source: 'social' as const },
      ],
    }
    const { getByText } = render(<AnalyticsView data={withTopLinks} />)
    expect(getByText('Top links')).toBeTruthy()
    expect(getByText('My Link')).toBeTruthy()
  })

  it('hides top links table when topLinks is empty', () => {
    const { queryByText } = render(<AnalyticsView data={analytics} />)
    expect(queryByText('Top links')).toBeNull()
  })

  it('renders CSV export button', () => {
    const { getByText } = render(<AnalyticsView data={analytics} />)
    expect(getByText('Exportar CSV')).toBeTruthy()
  })
})
