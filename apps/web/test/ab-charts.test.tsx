// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
})

import { ConfidenceChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart'

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
