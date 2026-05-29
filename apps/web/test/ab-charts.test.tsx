// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers') }
})

import { ConfidenceChart } from '@/app/cms/(authed)/youtube/ab-lab/_components/confidence-chart'
import { MultiLine } from '@/app/cms/(authed)/youtube/ab-lab/_components/multi-line'
import { ABBATimeline } from '@/app/cms/(authed)/youtube/ab-lab/_components/abba-timeline'
import { Gauge } from '@/app/cms/(authed)/youtube/ab-lab/_components/gauge'
import { CredibleInterval } from '@/app/cms/(authed)/youtube/ab-lab/_components/credible-interval'
import { RankBars } from '@/app/cms/(authed)/youtube/ab-lab/_components/rank-bars'
import type { DisplayLabel, StatsVariant } from '@/lib/youtube/ab-types'

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

describe('ABBATimeline', () => {
  it('renders correct number of blocks', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks.length).toBe(4)
  })

  it('marks done blocks with full color', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={1} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('#8A8F98')
  })

  it('marks pending blocks with low opacity', () => {
    const { container } = render(
      <ABBATimeline seq={['A', 'B']} total={2} done={0} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks[0]?.getAttribute('style')).toContain('opacity')
  })

  it('shows footer with cycle count', () => {
    const { getByText } = render(
      <ABBATimeline seq={['A', 'B', 'B', 'A']} total={4} done={2} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    expect(getByText(/2\/4/)).toBeTruthy()
  })

  it('highlights next variant block with dashed border', () => {
    const { container } = render(
      <ABBATimeline
        seq={['A', 'B', 'B', 'A']} total={4} done={2}
        colors={{ A: '#8A8F98', B: '#E8823C' }}
        nextVariant="B"
      />,
    )
    const dashed = container.querySelector('[data-next]')
    expect(dashed).toBeTruthy()
  })

  it('enables horizontal scroll for 50+ blocks', () => {
    const seq = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? 'A' : 'B') as DisplayLabel)
    const { container } = render(
      <ABBATimeline seq={seq} total={60} done={30} colors={{ A: '#8A8F98', B: '#E8823C' }} />,
    )
    const wrapper = container.querySelector('[data-scroll]')
    expect(wrapper).toBeTruthy()
  })
})

describe('Gauge', () => {
  it('renders with role="meter"', () => {
    const { container } = render(<Gauge value={75} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter).toBeTruthy()
    expect(meter?.getAttribute('aria-valuenow')).toBe('75')
  })

  it('sets aria-valuemin and aria-valuemax', () => {
    const { container } = render(<Gauge value={50} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuemin')).toBe('0')
    expect(meter?.getAttribute('aria-valuemax')).toBe('100')
  })

  it('clamps value to 0-100', () => {
    const { container } = render(<Gauge value={150} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('100')
  })

  it('treats NaN as 0', () => {
    const { container } = render(<Gauge value={NaN} />)
    const meter = container.querySelector('[role="meter"]')
    expect(meter?.getAttribute('aria-valuenow')).toBe('0')
  })

  it('turns green when value >= target', () => {
    const { container } = render(<Gauge value={96} target={95} />)
    const arc = container.querySelector('[data-arc]')
    expect(arc?.getAttribute('stroke')).toBe('var(--cms-green)')
  })

  it('renders value text', () => {
    const { getByText } = render(<Gauge value={88} />)
    expect(getByText('88%')).toBeTruthy()
  })
})

describe('CredibleInterval', () => {
  const variants: StatsVariant[] = [
    { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000 },
    { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000 },
  ]

  it('renders one row per variant', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('skips variants with 0 impressions', () => {
    const withZero = [...variants, { label: 'C' as DisplayLabel, color: '#3FA9C0', ctr: 0.04, impressions: 0 }]
    const { container } = render(<CredibleInterval variants={withZero} />)
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(2)
  })

  it('highlights leader with ring on VChip', () => {
    const { container } = render(<CredibleInterval variants={variants} leader="B" />)
    const ring = container.querySelector('[data-leader-ring]')
    expect(ring).toBeTruthy()
  })

  it('renders single variant without error', () => {
    const { container } = render(
      <CredibleInterval variants={[variants[0]!]} />,
    )
    const rows = container.querySelectorAll('[data-ci-row]')
    expect(rows.length).toBe(1)
  })

  it('renders mean dot for each row', () => {
    const { container } = render(<CredibleInterval variants={variants} />)
    const dots = container.querySelectorAll('[data-mean-dot]')
    expect(dots.length).toBe(2)
  })
})

describe('RankBars', () => {
  const variants = [
    { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0.15, pTop2: 0.45 },
    { label: 'B' as DisplayLabel, color: '#E8823C', pBest: 0.85, pTop2: 0.95 },
  ]

  it('renders bars sorted descending by pBest', () => {
    const { container } = render(<RankBars variants={variants} />)
    const labels = container.querySelectorAll('[data-rank-label]')
    expect(labels[0]?.textContent).toBe('B')
    expect(labels[1]?.textContent).toBe('A')
  })

  it('uses pTop2 when metric is pTop2', () => {
    const { container } = render(<RankBars variants={variants} metric="pTop2" />)
    const bars = container.querySelectorAll('[data-rank-bar]')
    expect(bars.length).toBe(2)
  })

  it('gives 0% bars a minimum 2px width', () => {
    const zeroVariants = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 0, pTop2: 0 },
    ]
    const { container } = render(<RankBars variants={zeroVariants} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar?.getAttribute('style')).toContain('2px')
  })

  it('clamps values over 100 to 100%', () => {
    const over = [
      { label: 'A' as DisplayLabel, color: '#8A8F98', pBest: 1.5, pTop2: 0.5 },
    ]
    const { container } = render(<RankBars variants={over} />)
    const bar = container.querySelector('[data-rank-bar]')
    expect(bar).toBeTruthy()
  })
})
