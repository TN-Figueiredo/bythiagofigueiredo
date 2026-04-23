import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from '@/components/cms/ui/sparkline'

describe('Sparkline', () => {
  it('renders SVG element with correct dimensions', () => {
    const { container } = render(<Sparkline points={[1, 3, 2, 5, 4]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('width')).toBe('48')
    expect(svg?.getAttribute('height')).toBe('28')
  })

  it('renders a polyline with point coordinates', () => {
    const { container } = render(<Sparkline points={[0, 5, 10]} />)
    const polyline = container.querySelector('polyline')
    expect(polyline).toBeTruthy()
    // Should have comma-separated coordinate pairs
    const pts = polyline?.getAttribute('points') ?? ''
    expect(pts.length).toBeGreaterThan(0)
    // Three data points → three coordinate pairs
    const pairs = pts.trim().split(' ')
    expect(pairs.length).toBe(3)
  })

  it('renders a circle at the last data point', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />)
    const circle = container.querySelector('circle')
    expect(circle).toBeTruthy()
  })

  it('returns null when only one point is provided', () => {
    const { container } = render(<Sparkline points={[42]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('returns null when points array is empty', () => {
    const { container } = render(<Sparkline points={[]} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('uses custom color for stroke and circle fill', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} color="#ff0000" />)
    const polyline = container.querySelector('polyline')
    const circle = container.querySelector('circle')
    expect(polyline?.getAttribute('stroke')).toBe('#ff0000')
    expect(circle?.getAttribute('fill')).toBe('#ff0000')
  })

  it('respects custom width and height props', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} width={100} height={50} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('100')
    expect(svg?.getAttribute('height')).toBe('50')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 50')
  })

  it('applies custom className to the SVG', () => {
    const { container } = render(<Sparkline points={[1, 2]} className="my-chart" />)
    expect(container.querySelector('svg.my-chart')).toBeTruthy()
  })

  it('handles flat data (all equal values) without crashing', () => {
    const { container } = render(<Sparkline points={[5, 5, 5, 5]} />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('polyline')).toBeTruthy()
  })

  it('is marked aria-hidden for accessibility', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
