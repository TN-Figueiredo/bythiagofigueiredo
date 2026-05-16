import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiRow } from '@/app/cms/(authed)/analytics/_components/kpi-row'
import type { KpiData } from '@/app/cms/(authed)/analytics/types'

const mockKpis: KpiData[] = [
  { label: 'Views', value: 1234, previousValue: 1000, sparkline: [10, 20, 30, 25, 35] },
  { label: 'Unique Visitors', value: 567, previousValue: 600, sparkline: [] },
  { label: 'Reads Complete', value: 89, previousValue: null, sparkline: [] },
  { label: 'Subscribers', value: 42, previousValue: 35, sparkline: [] },
  { label: 'Open Rate', value: 55, previousValue: 55, sparkline: [] },
  { label: 'Link Clicks', value: 150, previousValue: 100, sparkline: [] },
]

describe('KpiRow', () => {
  it('renders all 6 KPI cards', () => {
    render(<KpiRow kpis={mockKpis} />)
    expect(screen.getByTestId('kpi-row')).toBeTruthy()
    expect(screen.getByTestId('kpi-views')).toBeTruthy()
    expect(screen.getByTestId('kpi-unique-visitors')).toBeTruthy()
    expect(screen.getByTestId('kpi-reads-complete')).toBeTruthy()
    expect(screen.getByTestId('kpi-subscribers')).toBeTruthy()
    expect(screen.getByTestId('kpi-open-rate')).toBeTruthy()
    expect(screen.getByTestId('kpi-link-clicks')).toBeTruthy()
  })

  it('formats large numbers with K suffix', () => {
    render(<KpiRow kpis={mockKpis} />)
    expect(screen.getByTestId('kpi-views').textContent).toContain('1.2K')
  })

  it('shows positive trend arrow', () => {
    render(<KpiRow kpis={mockKpis} />)
    // Views: 1234 vs 1000 = +23%
    expect(screen.getByTestId('kpi-views').textContent).toContain('+23%')
  })

  it('shows negative trend when value decreased', () => {
    render(<KpiRow kpis={mockKpis} />)
    // Unique: 567 vs 600 = ((567-600)/600)*100 = -5.5 → rounds to -5%
    expect(screen.getByTestId('kpi-unique-visitors').textContent).toContain('-5%')
  })

  it('does not show trend when previousValue is null', () => {
    render(<KpiRow kpis={mockKpis} />)
    // Reads Complete has null previous — should not contain any % sign in trend
    const text = screen.getByTestId('kpi-reads-complete').textContent ?? ''
    expect(text).not.toContain('vs prev')
  })

  it('renders sparkline SVG when data has 2+ points', () => {
    const { container } = render(<KpiRow kpis={mockKpis} />)
    const sparklines = container.querySelectorAll('svg polyline')
    // Only Views has sparkline data with >1 point
    expect(sparklines.length).toBeGreaterThanOrEqual(1)
  })

  it('does not show trend when delta is zero', () => {
    render(<KpiRow kpis={mockKpis} />)
    // Open Rate: 55 vs 55 = 0% → hidden
    const text = screen.getByTestId('kpi-open-rate').textContent ?? ''
    expect(text).not.toContain('vs prev')
  })
})
