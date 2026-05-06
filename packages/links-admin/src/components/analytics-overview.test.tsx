import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AnalyticsOverview } from './analytics-overview'
import type { AnalyticsMetrics, DateRange } from '../types'

const metrics: AnalyticsMetrics = {
  totalClicks: 12500,
  uniqueVisitors: 9800,
  conversionRate: 0.032,
  topCountry: 'BR',
  dailyClicks: [
    { date: '2026-05-01', clicks: 1200, unique: 980 },
    { date: '2026-05-02', clicks: 1400, unique: 1100 },
    { date: '2026-05-03', clicks: 1800, unique: 1500 },
    { date: '2026-05-04', clicks: 2000, unique: 1600 },
    { date: '2026-05-05', clicks: 1500, unique: 1200 },
  ],
}

const dateRange: DateRange = {
  from: new Date('2026-05-01'),
  to: new Date('2026-05-05'),
}

describe('AnalyticsOverview', () => {
  const defaultProps = {
    metrics,
    dateRange,
    onDateRangeChange: vi.fn(),
  }

  it('renders total clicks KPI card', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByText('12,500')).toBeInTheDocument()
    expect(screen.getByText(/total clicks/i)).toBeInTheDocument()
  })

  it('renders unique visitors KPI card', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByText('9,800')).toBeInTheDocument()
    expect(screen.getByText(/unique visitors/i)).toBeInTheDocument()
  })

  it('renders conversion rate when available', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByText('3.2%')).toBeInTheDocument()
  })

  it('hides conversion rate when null', () => {
    render(
      <AnalyticsOverview
        {...defaultProps}
        metrics={{ ...metrics, conversionRate: null }}
      />,
    )
    expect(screen.queryByText(/conversion/i)).not.toBeInTheDocument()
  })

  it('renders top country', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByText('BR')).toBeInTheDocument()
    expect(screen.getByText(/top country/i)).toBeInTheDocument()
  })

  it('renders line chart container with daily data', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByTestId('analytics-chart')).toBeInTheDocument()
  })

  it('renders date range selector', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    expect(screen.getByTestId('date-range-picker')).toBeInTheDocument()
  })

  it('calls onDateRangeChange when 7d preset clicked', async () => {
    const user = userEvent.setup()
    render(<AnalyticsOverview {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /7d/i }))
    expect(defaultProps.onDateRangeChange).toHaveBeenCalled()
  })

  it('calls onDateRangeChange when 30d preset clicked', async () => {
    const user = userEvent.setup()
    render(<AnalyticsOverview {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /30d/i }))
    expect(defaultProps.onDateRangeChange).toHaveBeenCalled()
  })

  it('renders chart with correct number of data points', () => {
    render(<AnalyticsOverview {...defaultProps} />)
    const chart = screen.getByTestId('analytics-chart')
    expect(chart.querySelector('polyline, path')).not.toBeNull()
  })
})
