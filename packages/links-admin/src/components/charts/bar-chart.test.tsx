import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BarChart } from './bar-chart'

describe('BarChart', () => {
  it('renders one bar per data point', () => {
    const { container } = render(<BarChart data={[10, 20, 30]} />)
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(3)
  })

  it('renders comparison bars when prev is provided', () => {
    const { container } = render(<BarChart data={[10, 20]} prev={[5, 15]} />)
    const prevBars = container.querySelectorAll('[data-prev-bar]')
    expect(prevBars.length).toBe(2)
  })

  it('does not render prev bars when prev is not provided', () => {
    const { container } = render(<BarChart data={[10, 20]} />)
    const prevBars = container.querySelectorAll('[data-prev-bar]')
    expect(prevBars.length).toBe(0)
  })

  it('renders labels when provided', () => {
    const { container } = render(
      <BarChart data={[10, 20, 30]} labels={['Mon', 'Tue', 'Wed']} />,
    )
    expect(container.textContent).toContain('Mon')
    expect(container.textContent).toContain('Wed')
  })

  it('respects custom height', () => {
    const { container } = render(<BarChart data={[10]} height={200} />)
    const wrapper = container.querySelector('[data-bar-chart]')
    expect(wrapper?.getAttribute('style')).toContain('200')
  })

  it('uses custom color for bars', () => {
    const { container } = render(<BarChart data={[10]} color="#46B17E" />)
    const bar = container.querySelector('[data-bar]')
    expect(bar?.getAttribute('style')).toContain('rgb(70, 177, 126)')
  })

  it('handles empty data array', () => {
    const { container } = render(<BarChart data={[]} />)
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(0)
  })

  it('handles all-zero data', () => {
    const { container } = render(<BarChart data={[0, 0, 0]} />)
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(3)
  })

  it('sets bar height proportional to max value', () => {
    const { container } = render(<BarChart data={[50, 100]} height={150} />)
    const bars = container.querySelectorAll('[data-bar]')
    const firstStyle = bars[0]?.getAttribute('style') || ''
    const secondStyle = bars[1]?.getAttribute('style') || ''
    expect(secondStyle).toContain('100%')
    expect(firstStyle).toContain('50%')
  })

  it('renders legend when prev data is provided', () => {
    const { getByText } = render(<BarChart data={[10, 20]} prev={[5, 15]} />)
    expect(getByText('Atual')).toBeTruthy()
    expect(getByText('Anterior')).toBeTruthy()
  })

  it('does not render legend when prev is not provided', () => {
    const { queryByText } = render(<BarChart data={[10, 20]} />)
    expect(queryByText('Atual')).toBeNull()
  })
})
