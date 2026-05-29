import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FunnelChart } from './funnel-chart'

describe('FunnelChart', () => {
  const steps = [
    { label: 'Escaneamentos', value: 1000, pct: 100 },
    { label: 'Cliques', value: 500, pct: 50 },
    { label: 'Conversoes', value: 100, pct: 10 },
  ]

  it('renders all step labels', () => {
    render(<FunnelChart steps={steps} />)
    expect(screen.getByText('Escaneamentos')).toBeTruthy()
    expect(screen.getByText('Cliques')).toBeTruthy()
    expect(screen.getByText('Conversoes')).toBeTruthy()
  })

  it('renders step values', () => {
    const { container } = render(<FunnelChart steps={steps} />)
    expect(container.textContent).toContain('1,000')
    expect(container.textContent).toContain('500')
    expect(container.textContent).toContain('100')
  })

  it('renders funnel bars with proportional widths', () => {
    const { container } = render(<FunnelChart steps={steps} />)
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(3)
  })

  it('renders overall rate when provided', () => {
    render(<FunnelChart steps={steps} overallRate={10} />)
    expect(screen.getByText(/10%/)).toBeTruthy()
  })

  it('renders empty state when no steps', () => {
    const { container } = render(<FunnelChart steps={[]} />)
    const bars = container.querySelectorAll('[data-funnel-bar]')
    expect(bars.length).toBe(0)
  })
})
