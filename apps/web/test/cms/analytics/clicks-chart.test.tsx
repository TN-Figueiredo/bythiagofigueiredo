import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClicksChart } from '@/app/cms/(authed)/analytics/_components/clicks-chart'
import type { ClicksChartPoint } from '@/app/cms/(authed)/analytics/types'

const mockData: ClicksChartPoint[] = [
  { date: '2026-05-01', current: 10, previous: 5, average: 8 },
  { date: '2026-05-02', current: 15, previous: 8, average: 8 },
  { date: '2026-05-03', current: 7, previous: 12, average: 8 },
  { date: '2026-05-04', current: 20, previous: 6, average: 8 },
  { date: '2026-05-05', current: 12, previous: 9, average: 8 },
]

describe('ClicksChart', () => {
  it('renders the chart container', () => {
    render(<ClicksChart data={mockData} />)
    expect(screen.getByTestId('clicks-chart')).toBeTruthy()
  })

  it('renders empty state when no data', () => {
    render(<ClicksChart data={[]} />)
    expect(screen.getByTestId('clicks-chart').textContent).toContain('No click data for this period')
  })

  it('renders SVG with bars', () => {
    const { container } = render(<ClicksChart data={mockData} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    // Should have bars (rect elements) — current + ghost for each data point
    const rects = container.querySelectorAll('rect')
    expect(rects.length).toBeGreaterThan(0)
  })

  it('has accessible bar groups with tabindex', () => {
    const { container } = render(<ClicksChart data={mockData} />)
    const focusableGroups = container.querySelectorAll('g[tabindex="0"]')
    expect(focusableGroups.length).toBe(mockData.length)
  })

  it('shows aria labels with click counts', () => {
    const { container } = render(<ClicksChart data={mockData} />)
    const groups = container.querySelectorAll('g[role="graphics-symbol"]')
    expect(groups.length).toBe(mockData.length)
    const firstGroup = groups[0]
    expect(firstGroup?.getAttribute('aria-label')).toContain('10 clicks')
  })

  it('renders legend with Current, Previous, and Avg', () => {
    render(<ClicksChart data={mockData} />)
    expect(screen.getByText('Current')).toBeTruthy()
    expect(screen.getByText('Previous')).toBeTruthy()
    expect(screen.getByText('Avg')).toBeTruthy()
  })

  it('shows tooltip on hover', () => {
    const { container } = render(<ClicksChart data={mockData} />)
    const firstBar = container.querySelector('g[tabindex="0"]')
    expect(firstBar).toBeTruthy()
    fireEvent.mouseEnter(firstBar!)
    // After hover, tooltip should appear with click count
    expect(container.textContent).toContain('10 clicks')
  })
})
