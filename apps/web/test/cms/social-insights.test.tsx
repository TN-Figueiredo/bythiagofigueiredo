import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Line: () => <div />,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
}))

import { InsightsOverview } from '@/app/cms/(authed)/social/insights/_components/insights-overview'
import { en } from '@/app/cms/(authed)/social/_i18n/en'

const mockData = {
  kpis: { postsPublished: 42, deliverySuccessRate: 94.5, linkClicks: 1280, avgEngagement: 3.2, aiDraftsApproved: 7 },
  chartData: [
    { date: '2026-05-01', clicks: 120, engagement: 40, posts: 3 },
    { date: '2026-05-02', clicks: 95, engagement: 32, posts: 2 },
  ],
  heatmapData: Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({ day, hour, value: Math.random() * 10 }))
  ).flat(),
}

describe('InsightsOverview', () => {
  it('renders 5 KPI cards', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText(en.insights.kpi.postsPublished)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.deliverySuccess)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.linkClicks)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.avgEngagement)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.aiDraftsApproved)).toBeDefined()
  })

  it('renders KPI values', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('94.5%')).toBeDefined()
    expect(screen.getByText('1,280')).toBeDefined()
  })

  it('renders chart area', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByTestId('composed-chart')).toBeDefined()
  })

  it('renders heatmap', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    expect(screen.getByText(en.insights.heatmap.title)).toBeDefined()
  })

  it('renders zero-value KPIs correctly', () => {
    const zeroData = {
      ...mockData,
      kpis: { postsPublished: 0, deliverySuccessRate: 0, linkClicks: 0, avgEngagement: 0, aiDraftsApproved: 0 },
    }
    render(<InsightsOverview data={zeroData} strings={en} />)
    // All KPI labels should still render
    expect(screen.getByText(en.insights.kpi.postsPublished)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.deliverySuccess)).toBeDefined()
    expect(screen.getByText(en.insights.kpi.linkClicks)).toBeDefined()
    // Zero values
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('0%')).toBeDefined()
  })

  it('formats large KPI values with locale separators', () => {
    const bigData = {
      ...mockData,
      kpis: { ...mockData.kpis, linkClicks: 12345 },
    }
    render(<InsightsOverview data={bigData} strings={en} />)
    // toLocaleString should produce "12,345"
    expect(screen.getByText('12,345')).toBeDefined()
  })

  it('renders KPI cards with accessible aria-labels', () => {
    render(<InsightsOverview data={mockData} strings={en} />)
    // KpiCard renders aria-label="{label}: {value}"
    expect(screen.getByLabelText(`${en.insights.kpi.postsPublished}: 42`)).toBeDefined()
    expect(screen.getByLabelText(`${en.insights.kpi.deliverySuccess}: 94.5%`)).toBeDefined()
    expect(screen.getByLabelText(`${en.insights.kpi.linkClicks}: 1,280`)).toBeDefined()
  })
})
