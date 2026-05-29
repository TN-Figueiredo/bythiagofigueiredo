import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DetailHeader } from '@/app/cms/(authed)/youtube/ab-lab/_components/detail-header'
import { LockCountdown } from '@/app/cms/(authed)/youtube/ab-lab/_components/lock-countdown'
import { HeroBand } from '@/app/cms/(authed)/youtube/ab-lab/_components/hero-band'
import { GatesPanel } from '@/app/cms/(authed)/youtube/ab-lab/_components/gates-panel'
import { VariantTable } from '@/app/cms/(authed)/youtube/ab-lab/_components/variant-table'
import type { GateResult, FullChartVariant, VariantThumb } from '@/lib/youtube/ab-types'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), TrendingUp: icon('TrendingUp'), TrendingDown: icon('TrendingDown'), Minus: icon('Minus'),
    CheckCircle: icon('CheckCircle'), Clock: icon('Clock'), ChevronDown: icon('ChevronDown'), ChevronRight: icon('ChevronRight'),
    ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'), Archive: icon('Archive'), Download: icon('Download') }
})

/* ─── Helpers ─── */

function makeVariant(label: 'A' | 'B' | 'C' | 'D', overrides?: Partial<FullChartVariant>): FullChartVariant {
  return {
    label,
    color: '#888',
    ctr: 5.0,
    impressions: 10000,
    clicks: 500,
    pBest: 0.5,
    pTop2: 0.8,
    ...overrides,
  }
}

function makeThumb(label: 'A' | 'B' | 'C' | 'D', isOriginal = false): VariantThumb {
  return { label, color: '#888', thumbUrl: null, isOriginal }
}

function makeGates(count: number, allPass = false): GateResult[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Gate ${i + 1}`,
    passed: allPass || i < 3,
    value: `${i + 1}/6`,
    hint: i === 0 ? 'Sample hint' : undefined,
  }))
}

/* ─── DetailHeader ─── */

describe('DetailHeader', () => {
  it('renders breadcrumb link to ab-lab', () => {
    render(<DetailHeader title="Test" flag="thumbnail" status="active" roundNumber={1} totalRounds={1} hasPlayoff={false} />)
    const link = screen.getByText('A/B Lab')
    expect(link.closest('a')?.getAttribute('href')).toBe('/cms/youtube/ab-lab')
  })

  it('renders TypeBadge for the test type', () => {
    render(<DetailHeader title="Test" flag="title" status="active" roundNumber={1} totalRounds={1} hasPlayoff={false} />)
    expect(screen.getByText('Title')).toBeDefined()
  })

  it('renders signal toggle as Seg when provided', () => {
    const onToggle = vi.fn()
    render(<DetailHeader title="Test" flag="thumbnail" status="active" roundNumber={1} totalRounds={1} hasPlayoff={false} signalToggle={{ mode: 'confirmed', onToggle }} />)
    expect(screen.getByRole('radiogroup')).toBeDefined()
    expect(screen.getByText('Confirmed')).toBeDefined()
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('renders actions slot when no signal toggle', () => {
    render(<DetailHeader title="Test" flag="thumbnail" status="active" roundNumber={1} totalRounds={1} hasPlayoff={false} actions={<button>Export</button>} />)
    expect(screen.getByText('Export')).toBeDefined()
  })

  it('shows round counter when totalRounds > 1', () => {
    render(<DetailHeader title="Test" flag="thumbnail" status="active" roundNumber={2} totalRounds={3} hasPlayoff={false} />)
    expect(screen.getByText('R2/3')).toBeDefined()
  })
})

/* ─── LockCountdown ─── */

describe('LockCountdown', () => {
  it('renders progress bar with correct width', () => {
    const { container } = render(<LockCountdown dayOf={7} durationDays={14} confidence={80} confidenceTarget={95} cyclesCompleted={4} />)
    const bar = container.querySelector('[role="progressbar"]')
    expect(bar).not.toBeNull()
    expect(bar?.getAttribute('aria-valuenow')).toBe('50')
  })

  it('shows days remaining text', () => {
    render(<LockCountdown dayOf={10} durationDays={14} confidence={80} confidenceTarget={95} cyclesCompleted={5} />)
    expect(screen.getByText(/4 days remaining/)).toBeDefined()
  })

  it('handles 0 days remaining edge case', () => {
    render(<LockCountdown dayOf={14} durationDays={14} confidence={96} confidenceTarget={95} cyclesCompleted={7} />)
    expect(screen.getByText(/Duration reached/)).toBeDefined()
  })
})

/* ─── HeroBand ─── */

describe('HeroBand', () => {
  it('renders 4 cells', () => {
    render(<HeroBand confidence={92} confidenceTarget={95} leader={{ label: 'B', color: '#E8823C' }} lift={12.5} trend="up" />)
    const cells = screen.getAllByTestId('hero-cell')
    expect(cells).toHaveLength(4)
  })

  it('renders a Gauge meter', () => {
    render(<HeroBand confidence={92} confidenceTarget={95} leader={{ label: 'B', color: '#E8823C' }} lift={12.5} trend="up" />)
    expect(screen.getByRole('meter')).toBeDefined()
  })

  it('renders VChip for leader', () => {
    render(<HeroBand confidence={92} confidenceTarget={95} leader={{ label: 'B', color: '#E8823C' }} lift={12.5} trend="up" />)
    expect(screen.getByLabelText('Variant B')).toBeDefined()
  })

  it('renders lift text', () => {
    render(<HeroBand confidence={92} confidenceTarget={95} leader={{ label: 'B', color: '#E8823C' }} lift={12.5} trend="up" />)
    expect(screen.getByTestId('lift-value').textContent).toBe('+12.5%')
  })

  it('renders trend icon', () => {
    render(<HeroBand confidence={92} confidenceTarget={95} leader={{ label: 'B', color: '#E8823C' }} lift={12.5} trend="down" />)
    expect(screen.getByTestId('icon-TrendingDown')).toBeDefined()
  })
})

/* ─── GatesPanel ─── */

describe('GatesPanel', () => {
  it('renders 6 cells with role listitem', () => {
    render(<GatesPanel gates={makeGates(6)} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('shows passed count', () => {
    render(<GatesPanel gates={makeGates(6)} />)
    // 3 pass out of 6 (from makeGates default)
    expect(screen.getByText('3/6 passed')).toBeDefined()
  })

  it('applies green text when all pass', () => {
    const { container } = render(<GatesPanel gates={makeGates(6, true)} />)
    const header = screen.getByText('6/6 passed')
    expect(header.className).toContain('text-cms-green')
  })

  it('uses role="list" container', () => {
    render(<GatesPanel gates={makeGates(6)} />)
    expect(screen.getByRole('list')).toBeDefined()
  })
})

/* ─── VariantTable ─── */

describe('VariantTable', () => {
  const variants: FullChartVariant[] = [
    makeVariant('A', { ctr: 4.0, pBest: 0.2, impressions: 10000, clicks: 400 }),
    makeVariant('B', { ctr: 5.5, pBest: 0.7, impressions: 10000, clicks: 550 }),
    makeVariant('C', { ctr: 4.8, pBest: 0.1, impressions: 10000, clicks: 480 }),
  ]
  const thumbs: VariantThumb[] = [makeThumb('A', true), makeThumb('B'), makeThumb('C')]

  it('renders correct number of rows', () => {
    render(<VariantTable variants={variants} metric="pBest" thumbs={thumbs} />)
    // 3 variant rows + 1 header row = 4 rows
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(4) // 1 header + 3 data
  })

  it('sorts variants by metric descending', () => {
    render(<VariantTable variants={variants} metric="pBest" thumbs={thumbs} />)
    const chips = screen.getAllByLabelText(/^Variant [A-D]$/)
    // B (0.7) first, then A (0.2), then C (0.1)
    expect(chips[0]?.textContent).toBe('B')
    expect(chips[1]?.textContent).toBe('A')
    expect(chips[2]?.textContent).toBe('C')
  })

  it('tints leader row', () => {
    const { container } = render(<VariantTable variants={variants} metric="pBest" thumbs={thumbs} />)
    const leaderRow = container.querySelector('[data-leader]')
    expect(leaderRow).not.toBeNull()
    expect(leaderRow?.className).toContain('border-l-cms-accent')
  })

  it('expands row on click and shows detail', () => {
    render(<VariantTable variants={variants} metric="pBest" thumbs={thumbs} />)
    // No expanded row initially
    expect(screen.queryByTestId('expanded-row')).toBeNull()

    // Click the first data row (B, the leader)
    const rows = screen.getAllByRole('row')
    fireEvent.click(rows[1]!) // first data row
    expect(screen.getByTestId('expanded-row')).toBeDefined()

    // Click again to collapse
    fireEvent.click(rows[1]!)
    expect(screen.queryByTestId('expanded-row')).toBeNull()
  })
})
