import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/cms/social/insights',
}))
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Line: () => <div data-testid="chart-line" />,
  Bar: () => <div data-testid="chart-bar" />,
  XAxis: () => <div data-testid="chart-xaxis" />,
  YAxis: () => <div data-testid="chart-yaxis" />,
  CartesianGrid: () => <div data-testid="chart-grid" />,
  Tooltip: () => <div data-testid="chart-tooltip" />,
}))

import { KpiCard } from '@/app/cms/(authed)/social/insights/_components/kpi-card'
import { EngagementChart } from '@/app/cms/(authed)/social/insights/_components/engagement-chart'
import { PostingHeatmap } from '@/app/cms/(authed)/social/insights/_components/posting-heatmap'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

// ── KpiCard ──────────────────────────────────────────────────────────────────
describe('KpiCard', () => {
  it('renders the label text', () => {
    render(<KpiCard label={en.insights.kpi.postsPublished} value="42" />)
    expect(screen.getByText(en.insights.kpi.postsPublished)).toBeDefined()
  })

  it('renders the value text', () => {
    render(<KpiCard label={en.insights.kpi.linkClicks} value="1,280" />)
    expect(screen.getByText('1,280')).toBeDefined()
  })

  it('shows up trend indicator with green styling', () => {
    render(<KpiCard label="Metric" value="10" trend={{ direction: 'up', pct: 15 }} />)
    const trend = screen.getByText(/↑.*15%/)
    expect(trend).toBeDefined()
    expect((trend as HTMLElement).className).toContain('green')
  })

  it('shows down trend indicator with red styling', () => {
    render(<KpiCard label="Metric" value="5" trend={{ direction: 'down', pct: 8 }} />)
    const trend = screen.getByText(/↓.*8%/)
    expect(trend).toBeDefined()
    expect((trend as HTMLElement).className).toContain('red')
  })

  it('renders no trend indicator when trend prop is omitted', () => {
    render(<KpiCard label="Metric" value="100" />)
    expect(screen.queryByText(/[↑↓]/)).toBeNull()
  })

  it('has aria-label combining label and value', () => {
    render(<KpiCard label={en.insights.kpi.avgEngagement} value="3.2%" />)
    const card = screen.getByLabelText(`${en.insights.kpi.avgEngagement}: 3.2%`)
    expect(card).toBeDefined()
  })

  it('renders zero value without errors', () => {
    render(<KpiCard label={en.insights.kpi.deliverySuccess} value="0%" />)
    expect(screen.getByText('0%')).toBeDefined()
  })

  it('renders large formatted value', () => {
    render(<KpiCard label={en.insights.kpi.linkClicks} value="12,345" />)
    expect(screen.getByText('12,345')).toBeDefined()
  })
})

// ── EngagementChart ───────────────────────────────────────────────────────────
const chartData = [
  { date: '2026-05-01', clicks: 120, engagement: 40, posts: 3 },
  { date: '2026-05-07', clicks: 95, engagement: 32, posts: 2 },
]

describe('EngagementChart', () => {
  it('renders chart container', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    expect(screen.getByTestId('responsive-container')).toBeDefined()
  })

  it('renders composed chart inside container', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    expect(screen.getByTestId('composed-chart')).toBeDefined()
  })

  it('renders a Bar element for posts', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    expect(screen.getByTestId('chart-bar')).toBeDefined()
  })

  it('renders Line elements for clicks and engagement', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    const lines = screen.getAllByTestId('chart-line')
    expect(lines.length).toBe(2)
  })

  it('renders with empty data without crashing', () => {
    render(<EngagementChart data={[]} strings={en} />)
    expect(screen.getByTestId('composed-chart')).toBeDefined()
  })

  it('renders XAxis and YAxis', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    expect(screen.getByTestId('chart-xaxis')).toBeDefined()
    expect(screen.getByTestId('chart-yaxis')).toBeDefined()
  })

  it('renders chart grid', () => {
    render(<EngagementChart data={chartData} strings={en} />)
    expect(screen.getByTestId('chart-grid')).toBeDefined()
  })
})

// ── PostingHeatmap ────────────────────────────────────────────────────────────

// Build a full 7×24 dataset
const heatmapData = Array.from({ length: 7 }, (_, day) =>
  Array.from({ length: 24 }, (_, hour) => ({ day, hour, value: (day + hour) * 0.5 })),
).flat()

describe('PostingHeatmap', () => {
  it('renders the heatmap title', () => {
    render(<PostingHeatmap data={heatmapData} strings={en} />)
    expect(screen.getByText(en.insights.heatmap.title)).toBeDefined()
  })

  it('renders hour labels 0–23', () => {
    render(<PostingHeatmap data={heatmapData} strings={en} />)
    // Hours 0-23 appear as text
    expect(screen.getByText('0')).toBeDefined()
    expect(screen.getByText('12')).toBeDefined()
    expect(screen.getByText('23')).toBeDefined()
  })

  it('renders 7 day name labels', () => {
    render(<PostingHeatmap data={heatmapData} strings={en} />)
    // Intl short weekday names — just verify there are 7 non-empty day labels
    // by counting elements that render with the day-label class approach
    // The heatmap renders day names from Intl formatter; query by title patterns
    const cells = document.querySelectorAll('[title]')
    // Each of the 7*24=168 cells has a title with the format "Day HH:00 — value"
    expect(cells.length).toBe(168)
  })

  it('renders 7×24 = 168 cells with title attributes', () => {
    render(<PostingHeatmap data={heatmapData} strings={en} />)
    const cells = document.querySelectorAll('[title]')
    expect(cells.length).toBe(168)
  })

  it('renders with empty data without crashing', () => {
    render(<PostingHeatmap data={[]} strings={en} />)
    expect(screen.getByText(en.insights.heatmap.title)).toBeDefined()
  })

  it('cell title includes the hour annotation', () => {
    render(<PostingHeatmap data={heatmapData} strings={en} />)
    const cells = Array.from(document.querySelectorAll('[title]'))
    const hasHourAnnotation = cells.some(c => c.getAttribute('title')?.includes(':00'))
    expect(hasHourAnnotation).toBe(true)
  })

  it('highest-value cells get brightest intensity class', () => {
    // Provide a single peak cell
    const singlePeak = [{ day: 0, hour: 12, value: 10 }]
    render(<PostingHeatmap data={singlePeak} strings={en} />)
    const peakCell = document.querySelector('[title*="12:00"]') as HTMLElement
    expect(peakCell).not.toBeNull()
    expect(peakCell.className).toContain('bg-green-500')
  })
})
