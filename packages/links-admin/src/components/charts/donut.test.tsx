import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Donut } from './donut'

describe('Donut', () => {
  const segments = [
    { k: 'Mobile', v: 60, color: '#3b82f6' },
    { k: 'Desktop', v: 30, color: '#10b981' },
    { k: 'Tablet', v: 10, color: '#f59e0b' },
  ]

  it('renders SVG with correct size', () => {
    const { container } = render(<Donut segments={segments} size={120} thickness={16} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('120')
    expect(svg?.getAttribute('height')).toBe('120')
  })

  it('renders one circle per segment', () => {
    const { container } = render(<Donut segments={segments} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(3)
  })

  it('renders legend items for each segment', () => {
    render(<Donut segments={segments} />)
    expect(screen.getByText('Mobile')).toBeTruthy()
    expect(screen.getByText('Desktop')).toBeTruthy()
    expect(screen.getByText('Tablet')).toBeTruthy()
  })

  it('renders center label when provided', () => {
    render(<Donut segments={segments} centerLabel="100%" centerSub="sessoes" />)
    expect(screen.getByText('100%')).toBeTruthy()
    expect(screen.getByText('sessoes')).toBeTruthy()
  })

  it('does not render center label when not provided', () => {
    const { container } = render(<Donut segments={segments} />)
    const center = container.querySelector('[data-center]')
    expect(center).toBeFalsy()
  })

  it('handles empty segments', () => {
    const { container } = render(<Donut segments={[]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(0)
  })

  it('handles single segment', () => {
    const { container } = render(<Donut segments={[{ k: 'All', v: 100, color: '#fff' }]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(1)
  })

  it('uses custom thickness', () => {
    const { container } = render(<Donut segments={segments} thickness={24} />)
    const circle = container.querySelector('circle')
    expect(circle?.getAttribute('stroke-width')).toBe('24')
  })

  it('renders legend color dots matching segment colors', () => {
    const { container } = render(<Donut segments={segments} />)
    const dots = container.querySelectorAll('[data-legend-dot]')
    expect(dots.length).toBe(3)
    expect(dots[0]?.getAttribute('style')).toContain('rgb(59, 130, 246)')
  })
})
