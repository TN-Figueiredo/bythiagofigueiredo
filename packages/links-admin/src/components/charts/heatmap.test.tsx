import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heatmap } from './heatmap'

describe('Heatmap', () => {
  const grid = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => (d + h) % 5),
  )

  it('renders 7 day rows', () => {
    const { container } = render(<Heatmap grid={grid} />)
    const dayRows = container.querySelectorAll('[data-day-row]')
    expect(dayRows.length).toBe(7)
  })

  it('renders 7x24=168 cells', () => {
    const { container } = render(<Heatmap grid={grid} />)
    const cells = container.querySelectorAll('[data-cell]')
    expect(cells.length).toBe(168)
  })

  it('renders day labels (Seg-Dom)', () => {
    render(<Heatmap grid={grid} />)
    expect(screen.getByText('Seg')).toBeTruthy()
    expect(screen.getByText('Dom')).toBeTruthy()
  })

  it('renders hour labels in footer', () => {
    render(<Heatmap grid={grid} />)
    expect(screen.getByText('0h')).toBeTruthy()
    expect(screen.getByText('23h')).toBeTruthy()
  })

  it('applies intensity shading via background', () => {
    const simpleGrid = [[0, 4, 2, ...Array(21).fill(0)], ...Array(6).fill(Array(24).fill(0))]
    const { container } = render(<Heatmap grid={simpleGrid} />)
    const cells = container.querySelectorAll('[data-cell]')
    const cell0 = cells[0]?.getAttribute('style') || ''
    const cell1 = cells[1]?.getAttribute('style') || ''
    expect(cell0).not.toBe(cell1)
  })

  it('renders title attributes for each cell', () => {
    const { container } = render(<Heatmap grid={grid} />)
    const cell = container.querySelector('[data-cell]')
    expect(cell?.getAttribute('title')).toContain('Seg')
    expect(cell?.getAttribute('title')).toContain('0h')
  })

  it('handles empty grid gracefully', () => {
    const { container } = render(<Heatmap grid={[]} />)
    const cells = container.querySelectorAll('[data-cell]')
    expect(cells.length).toBe(0)
  })
})
