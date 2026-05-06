import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalyticsCharts } from './analytics-charts'
import type { DeviceData, ReferrerData, GeoDataItem, HourlyData } from '../types'

const deviceData: DeviceData = {
  device: [
    { name: 'mobile', count: 600 },
    { name: 'desktop', count: 350 },
    { name: 'tablet', count: 50 },
  ],
  browser: [
    { name: 'Chrome', count: 500 },
    { name: 'Safari', count: 300 },
    { name: 'Firefox', count: 100 },
    { name: 'Edge', count: 50 },
    { name: 'Other', count: 50 },
  ],
  os: [
    { name: 'iOS', count: 400 },
    { name: 'Android', count: 250 },
    { name: 'Windows', count: 200 },
    { name: 'macOS', count: 100 },
    { name: 'Linux', count: 50 },
  ],
}

const referrerData: ReferrerData = {
  items: [
    { domain: 'google.com', count: 300 },
    { domain: 'twitter.com', count: 200 },
    { domain: 'facebook.com', count: 150 },
    { domain: 'linkedin.com', count: 100 },
    { domain: 'reddit.com', count: 80 },
  ],
}

const geoData: GeoDataItem[] = [
  { country: 'BR', count: 500 },
  { country: 'US', count: 200 },
  { country: 'PT', count: 100 },
  { country: 'DE', count: 80 },
  { country: 'FR', count: 60 },
]

const hourlyData: HourlyData = {
  matrix: Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => Math.floor(Math.random() * 50)),
  ),
}

describe('AnalyticsCharts', () => {
  const defaultProps = {
    metrics: {
      totalClicks: 1000,
      uniqueVisitors: 800,
      conversionRate: null,
      topCountry: 'BR',
      dailyClicks: [],
    },
    deviceData,
    referrerData,
    geoData,
    hourlyData,
  }

  it('renders device donut chart section', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByText(/device/i)).toBeInTheDocument()
    expect(screen.getByText('mobile')).toBeInTheDocument()
    expect(screen.getByText('desktop')).toBeInTheDocument()
  })

  it('renders browser bar chart section', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByText(/browser/i)).toBeInTheDocument()
    expect(screen.getByText('Chrome')).toBeInTheDocument()
    expect(screen.getByText('Safari')).toBeInTheDocument()
  })

  it('renders OS bar chart section', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByText(/operating system/i)).toBeInTheDocument()
    expect(screen.getByText('iOS')).toBeInTheDocument()
    expect(screen.getByText('Android')).toBeInTheDocument()
  })

  it('renders referrer bar chart with top domains', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByText(/referrer/i)).toBeInTheDocument()
    expect(screen.getByText('google.com')).toBeInTheDocument()
    expect(screen.getByText('twitter.com')).toBeInTheDocument()
  })

  it('renders country bar chart section', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByText(/countr/i)).toBeInTheDocument()
    expect(screen.getByText('BR')).toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
  })

  it('renders hourly heatmap', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    expect(screen.getByTestId('hourly-heatmap')).toBeInTheDocument()
  })

  it('heatmap has 7 rows and 24 columns of cells', () => {
    render(<AnalyticsCharts {...defaultProps} />)
    const heatmap = screen.getByTestId('hourly-heatmap')
    const cells = heatmap.querySelectorAll('rect')
    expect(cells.length).toBe(7 * 24)
  })

  it('renders gracefully with empty data', () => {
    render(
      <AnalyticsCharts
        {...defaultProps}
        deviceData={{ device: [], browser: [], os: [] }}
        referrerData={{ items: [] }}
        geoData={[]}
        hourlyData={{ matrix: [] }}
      />,
    )
    expect(screen.getByText(/device/i)).toBeInTheDocument()
  })

  it('limits referrer list to top 10', () => {
    const manyReferrers: ReferrerData = {
      items: Array.from({ length: 15 }, (_, i) => ({
        domain: `site${i}.com`,
        count: 100 - i,
      })),
    }
    render(<AnalyticsCharts {...defaultProps} referrerData={manyReferrers} />)
    expect(screen.getByText('site0.com')).toBeInTheDocument()
    expect(screen.getByText('site9.com')).toBeInTheDocument()
    expect(screen.queryByText('site10.com')).not.toBeInTheDocument()
  })
})
