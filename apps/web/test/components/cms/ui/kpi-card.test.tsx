import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCard } from '@/components/cms/ui/kpi-card'

describe('KpiCard', () => {
  it('renders label and value', () => {
    render(<KpiCard label="Total Posts" value={42} />)
    expect(screen.getByText('Total Posts')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
  })

  it('renders trend with up arrow', () => {
    render(<KpiCard label="Opens" value="38.4%" trend={{ direction: 'up', label: '2.1% vs prior' }} />)
    expect(screen.getByText(/↑/)).toBeDefined()
    expect(screen.getByText(/2.1% vs prior/)).toBeDefined()
  })

  it('renders sparkline when points provided', () => {
    const { container } = render(<KpiCard label="Test" value={1} sparklinePoints={[1, 3, 2, 5, 4]} />)
    expect(container.querySelector('svg')).toBeDefined()
    expect(container.querySelector('polyline')).toBeDefined()
  })
})
