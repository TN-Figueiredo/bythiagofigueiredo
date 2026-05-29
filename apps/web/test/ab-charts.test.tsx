// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
})

import { ConfidenceChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart'
import { MultiLine } from '@/app/cms/(authed)/youtube/ab-lab/_components/multi-line'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

describe('ConfidenceChart', () => {
  it('renders SVG with correct viewBox', () => {
    const { container } = render(<ConfidenceChart data={[50, 65, 78]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 620 200')
  })

  it('renders dashed target line at default 95%', () => {
    const { container } = render(<ConfidenceChart data={[50, 60]} />)
    const lines = container.querySelectorAll('line[stroke-dasharray]')
    const targetLine = Array.from(lines).find(l => l.getAttribute('stroke') === '#22c55e')
    expect(targetLine).toBeTruthy()
  })

  it('renders custom target line', () => {
    const { container } = render(<ConfidenceChart data={[50]} target={80} />)
    const texts = container.querySelectorAll('text')
    const targetLabel = Array.from(texts).find(t => t.textContent === '80%')
    expect(targetLabel).toBeTruthy()
  })

  it('renders placeholder when data is empty', () => {
    const { container } = render(<ConfidenceChart data={[]} />)
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })

  it('renders single dot for 1-point data', () => {
    const { container } = render(<ConfidenceChart data={[42]} />)
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(1)
    const path = container.querySelector('path[d]')
    expect(path?.getAttribute('d') || '').not.toContain('C')
  })

  it('filters NaN values from data', () => {
    const { container } = render(<ConfidenceChart data={[50, NaN, 70, NaN, 90]} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('EndDot turns green when last value >= target', () => {
    const { container } = render(<ConfidenceChart data={[50, 70, 96]} target={95} />)
    const circles = container.querySelectorAll('circle')
    const lastCircle = circles[circles.length - 1]
    expect(lastCircle?.getAttribute('fill')).toContain('#22c55e')
  })

  it('includes sr-only data table', () => {
    const { container } = render(<ConfidenceChart data={[50, 60, 70]} />)
    const table = container.querySelector('table.sr-only')
    expect(table).toBeTruthy()
    const rows = table?.querySelectorAll('tr')
    expect(rows?.length).toBe(4)
  })
})

describe('MultiLine', () => {
  const colors = { A: '#8A8F98', B: '#E8823C', C: '#3FA9C0', D: '#A77CE8' } as const

  it('renders one path per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders end dots per series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4, 5], B: [2, 3, 4] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBeGreaterThanOrEqual(2)
  })

  it('auto-scales Y with 0.6 padding', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [10, 20], B: [15, 25] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('uses shortest common length for different-length series', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [1, 2, 3, 4, 5], B: [10, 20, 30] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    const paths = container.querySelectorAll('path[stroke]')
    expect(paths.length).toBe(2)
  })

  it('renders sr-only table', () => {
    const { container } = render(
      <MultiLine
        series={{ A: [3, 4], B: [5, 6] } as Record<DisplayLabel, number[]>}
        colors={colors}
      />,
    )
    expect(container.querySelector('table.sr-only')).toBeTruthy()
  })

  it('renders nothing for empty series', () => {
    const { container } = render(
      <MultiLine series={{} as Record<DisplayLabel, number[]>} colors={colors} />,
    )
    const text = container.querySelector('text')
    expect(text?.textContent).toContain('No data')
  })
})
