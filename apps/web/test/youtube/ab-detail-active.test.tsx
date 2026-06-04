import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(),
  applyWinnerNow: vi.fn(),
  cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(),
  resumeAbTest: vi.fn(),
}))

vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: vi.fn(() => ({ data: null, loading: false })),
}))

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Activity: icon('Activity'), BarChart3: icon('BarChart3'), ChevronDown: icon('ChevronDown'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'), Crosshair: icon('Crosshair'),
    Eye: icon('Eye'), FileText: icon('FileText'), Filter: icon('Filter'), Image: icon('Image'),
    Layers: icon('Layers'), Lock: icon('Lock'), Minus: icon('Minus'), Pause: icon('Pause'),
    RefreshCw: icon('RefreshCw'), Settings: icon('Settings'), Square: icon('Square'),
    Swords: icon('Swords'), TrendingDown: icon('TrendingDown'), TrendingUp: icon('TrendingUp'),
    Type: icon('Type'), X: icon('X'), Zap: icon('Zap'),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
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
  it('renders key sections via data-section attributes', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const sections = [
      'header', 'lock-countdown', 'hero-band', 'variant-performance',
      'charts-confidence-radar',
    ]
    for (const s of sections) {
      expect(container.querySelector(`[data-section="${s}"]`), `missing section: ${s}`).not.toBeNull()
    }
  })

  it('SignalCard renders "Sinal ao vivo" heading', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    expect(screen.getByText('Sinal ao vivo')).toBeDefined()
  })

  it('VariantTable is rendered with metric=pBest column header', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // pBest column header shows "chance de vencer"
    expect(screen.getByText('chance de vencer')).toBeDefined()
  })

  it('GatesPanel shows all 6 gate values', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    // GatesPanel renders each gate.value as a font-mono span
    const gateValues = ['10,000 min', '10 / 7 days', '16 / 14 cycles', '14 eligible', '2 / 3 consecutive']
    for (const v of gateValues) {
      expect(screen.getByText(v)).toBeDefined()
    }
    // Also verify the panel header badge shows correct count
    expect(container.textContent).toContain('5/6 ok')
  })

  it('ConfidenceChart receives confTrend data (renders svg)', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const confidenceSection = container.querySelector('[data-section="charts-confidence-radar"]')
    expect(confidenceSection).not.toBeNull()
    // Should contain an SVG from ConfidenceChart
    const svgs = confidenceSection?.querySelectorAll('svg')
    expect(svgs?.length).toBeGreaterThanOrEqual(1)
  })

  it('ABBATimeline receives seq data and renders cycle count', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // ABBATimeline footer shows "done/total ciclos ABBA completos"
    expect(screen.getByText('4/6 ciclos ABBA completos')).toBeDefined()
  })

  it('LockCountdown section exists', () => {
    const { container } = render(<ActiveDetail view={makeActiveView()} />)
    const lockSection = container.querySelector('[data-section="lock-countdown"]')
    expect(lockSection).not.toBeNull()
    // Contains the lock text
    expect(lockSection?.textContent).toContain('Teste travado')
  })

  it('HeroBand shows leader VChip for variant B', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // Multiple VChips with "Variant B" exist (hero-band + variant-table)
    const chips = screen.getAllByLabelText('Variant B')
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })

  it('ClickMoment component is rendered', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // ClickMoment renders context buttons like "Home"
    expect(screen.getByText('Home')).toBeDefined()
  })

  it('title from view.videoTitle renders in header', () => {
    render(<ActiveDetail view={makeActiveView({ videoTitle: 'Special Test Video Title' })} />)
    // Title may appear multiple times (header, variant table, click-moment, feed)
    const allTitles = screen.getAllByText('Special Test Video Title')
    expect(allTitles.length).toBeGreaterThanOrEqual(1)
  })
})
