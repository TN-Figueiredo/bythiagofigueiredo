import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Lock: icon('Lock'), TrendingUp: icon('TrendingUp'), TrendingDown: icon('TrendingDown'), Minus: icon('Minus'),
    CheckCircle: icon('CheckCircle'), Clock: icon('Clock'), ChevronDown: icon('ChevronDown'), ChevronRight: icon('ChevronRight'),
    ArrowLeft: icon('ArrowLeft') }
})

/* ─── Fixture ─── */

function makeActiveView(overrides?: Partial<AbTestActiveView>): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'My YouTube Video', flag: 'thumbnail', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000, clicks: 500, pBest: 0.3, pTop2: 0.6 },
      { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000, clicks: 700, pBest: 0.7, pTop2: 0.9 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', isOriginal: false },
    ],
    confTrend: [50, 65, 78, 85, 88],
    daily: { A: [5.0, 5.1, 4.9], B: [6.0, 6.5, 7.0] } as Record<DisplayLabel, number[]>,
    abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B'] as DisplayLabel[],
    cycles: { total: 6, done: 4 },
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 1,
    hasPlayoff: false,
    gates: [
      { name: 'confidence', passed: true, value: '88%' },
      { name: 'min_impressions', passed: true, value: '10,000 min' },
      { name: 'min_duration', passed: true, value: '10 / 7 days' },
      { name: 'min_cycles', passed: true, value: '16 / 14 cycles' },
      { name: 'burn_in', passed: true, value: '14 eligible' },
      { name: 'stability', passed: false, value: '2 / 3 consecutive' },
    ],
    confirmedData: { confidence: 88, leader: 'B' as DisplayLabel, leaderColor: '#E8823C', lift: 12.3 },
    ...overrides,
  } as AbTestActiveView
}

/* ─── Tests ─── */

describe('ActiveDetail', () => {
  it('renders 10 sections via data-section attributes and click-moment', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const sections = [
      'header', 'lock-countdown', 'hero-band', 'variant-performance',
      'charts-confidence-radar', 'charts-ci-rank', 'daily-ctr',
      'timeline-funnel', 'gates',
    ]
    for (const s of sections) {
      expect(container.querySelector(`[data-section="${s}"]`), `missing section: ${s}`).not.toBeNull()
    }
    expect(container.querySelector('[data-click-moment]'), 'missing click-moment').not.toBeNull()
  })

  it('signal toggle renders Seg with confirmed/live options', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    expect(screen.getByRole('radiogroup')).toBeDefined()
    expect(screen.getByText('Confirmed')).toBeDefined()
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('VariantTable is rendered with metric=pBest column header', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // pBest column header shows "Chance to win"
    expect(screen.getByText('Chance to win')).toBeDefined()
  })

  it('GatesPanel shows all 6 gates', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(6)
  })

  it('ConfidenceChart receives confTrend data (renders svg)', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const confidenceSection = container.querySelector('[data-section="charts-confidence-radar"]')
    expect(confidenceSection).not.toBeNull()
    // Should contain an SVG from ConfidenceChart
    const svgs = confidenceSection?.querySelectorAll('svg')
    expect(svgs?.length).toBeGreaterThanOrEqual(1)
  })

  it('ABBATimeline receives seq data and renders blocks', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const timelineSection = container.querySelector('[data-section="timeline-funnel"]')
    expect(timelineSection).not.toBeNull()
    const blocks = timelineSection?.querySelectorAll('[data-block]')
    expect(blocks?.length).toBe(6)
  })

  it('LockCountdown appears with progress bar', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const lockSection = container.querySelector('[data-section="lock-countdown"]')
    expect(lockSection).not.toBeNull()
    const progressBar = lockSection?.querySelector('[role="progressbar"]')
    expect(progressBar).not.toBeNull()
  })

  it('HeroBand shows leader VChip for variant B', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // HeroBand renders a VChip for the leader (B)
    expect(screen.getByTestId('hero-band')).toBeDefined()
    // Multiple VChips with "Variant B" exist (hero-band + variant-table)
    const chips = screen.getAllByLabelText('Variant B')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('click-moment placeholder exists in DOM', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    expect(container.querySelector('[data-click-moment]')).not.toBeNull()
  })

  it('title from view.videoTitle renders in header', () => {
    render(<ActiveDetail view={makeActiveView({ videoTitle: 'Special Test Video Title' })} />)
    expect(screen.getByText('Special Test Video Title')).toBeDefined()
  })
})
