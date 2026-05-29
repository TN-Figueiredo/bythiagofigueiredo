import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Spark } from './spark'

describe('Spark', () => {
  it('renders SVG with specified width and height', () => {
    const { container } = render(<Spark data={[10, 20, 30]} color="#F2683C" w={90} h={28} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('width')).toBe('90')
    expect(svg?.getAttribute('height')).toBe('28')
  })

  it('renders a stroke path (the line)', () => {
    const { container } = render(<Spark data={[5, 15, 10, 20]} color="#46B17E" />)
    const paths = container.querySelectorAll('path')
    const strokePath = Array.from(paths).find(p => p.getAttribute('fill') === 'none')
    expect(strokePath).toBeTruthy()
    expect(strokePath?.getAttribute('stroke')).toBe('#46B17E')
  })

  it('renders an area fill path by default', () => {
    const { container } = render(<Spark data={[5, 15, 10]} color="#F2683C" />)
    const paths = container.querySelectorAll('path')
    const fillPath = Array.from(paths).find(p => p.getAttribute('fill') !== 'none')
    expect(fillPath).toBeTruthy()
    expect(fillPath?.getAttribute('opacity')).toBe('0.12')
  })

  it('omits area fill when fill=false', () => {
    const { container } = render(<Spark data={[5, 15, 10]} color="#F2683C" fill={false} />)
    const paths = container.querySelectorAll('path')
    const fillPath = Array.from(paths).find(p => p.getAttribute('fill') !== 'none')
    expect(fillPath).toBeFalsy()
  })

  it('renders end dot circle at last data point', () => {
    const { container } = render(<Spark data={[10, 20, 30]} color="#3FA9C0" />)
    const circle = container.querySelector('circle')
    expect(circle).toBeTruthy()
    expect(circle?.getAttribute('fill')).toBe('#3FA9C0')
  })

  it('handles single data point without error', () => {
    const { container } = render(<Spark data={[42]} color="#F2683C" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const circle = container.querySelector('circle')
    expect(circle).toBeTruthy()
  })

  it('handles all-zero data without error', () => {
    const { container } = render(<Spark data={[0, 0, 0, 0]} color="#F2683C" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('uses custom width and height', () => {
    const { container } = render(<Spark data={[1, 2, 3]} color="#F2683C" w={200} h={50} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('200')
    expect(svg?.getAttribute('height')).toBe('50')
  })
})
