import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HBars } from './hbars'

describe('HBars', () => {
  const rows = [
    { k: 'Chrome', v: 65 },
    { k: 'Safari', v: 20 },
    { k: 'Firefox', v: 10 },
    { k: 'Edge', v: 5 },
  ]

  it('renders one row per item', () => {
    const { container } = render(<HBars rows={rows} />)
    const barRows = container.querySelectorAll('[data-hbar-row]')
    expect(barRows.length).toBe(4)
  })

  it('renders labels for each row', () => {
    render(<HBars rows={rows} />)
    expect(screen.getByText('Chrome')).toBeTruthy()
    expect(screen.getByText('Safari')).toBeTruthy()
    expect(screen.getByText('Firefox')).toBeTruthy()
    expect(screen.getByText('Edge')).toBeTruthy()
  })

  it('renders value with default % suffix', () => {
    const { container } = render(<HBars rows={[{ k: 'Chrome', v: 65 }]} />)
    expect(container.textContent).toContain('65%')
  })

  it('renders value with custom suffix', () => {
    const { container } = render(<HBars rows={[{ k: 'Chrome', v: 65 }]} suffix="" />)
    expect(container.textContent).toContain('65')
    expect(container.textContent).not.toContain('65%')
  })

  it('uses custom color for bars', () => {
    const { container } = render(<HBars rows={[{ k: 'Test', v: 50 }]} color="#3FA9C0" />)
    const fill = container.querySelector('[data-hbar-fill]')
    expect(fill?.getAttribute('style')).toContain('rgb(63, 169, 192)')
  })

  it('renders bar widths proportional to max', () => {
    const { container } = render(<HBars rows={[{ k: 'A', v: 50 }, { k: 'B', v: 100 }]} />)
    const fills = container.querySelectorAll('[data-hbar-fill]')
    expect(fills[0]?.getAttribute('style')).toContain('50%')
    expect(fills[1]?.getAttribute('style')).toContain('100%')
  })

  it('handles empty rows', () => {
    const { container } = render(<HBars rows={[]} />)
    const barRows = container.querySelectorAll('[data-hbar-row]')
    expect(barRows.length).toBe(0)
  })

  it('truncates long labels', () => {
    const { container } = render(
      <HBars rows={[{ k: 'Very long browser name that should truncate', v: 10 }]} />,
    )
    const label = container.querySelector('[data-hbar-label]')
    expect(label?.getAttribute('style')).toContain('overflow')
  })
})
