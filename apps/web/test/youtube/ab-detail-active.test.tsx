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
    Pause: icon('Pause'), Square: icon('Square'), Settings: icon('Settings'), LayoutGrid: icon('LayoutGrid'),
    TrendingUp: icon('TrendingUp'), Crosshair: icon('Crosshair'), Target: icon('Target'), BarChart3: icon('BarChart3'),
    LineChart: icon('LineChart'), RefreshCw: icon('RefreshCw'), Filter: icon('Filter'), Search: icon('Search'),
    ListVideo: icon('ListVideo'), Smartphone: icon('Smartphone'), MousePointerClick: icon('MousePointerClick'),
    Trophy: icon('Trophy'), ArrowLeft: icon('ArrowLeft'), Swords: icon('Swords'), AlertCircle: icon('AlertCircle'),
    Lock: icon('Lock'), Minus: icon('Minus'), TrendingDown: icon('TrendingDown'), ChevronDown: icon('ChevronDown'),
    Radio: icon('Radio'), Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    X: icon('X'), CheckCircle: icon('CheckCircle'), Clock: icon('Clock'), ChevronRight: icon('ChevronRight'),
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

  it('signal toggle renders Confirmado/Live when liveData is present', () => {
    const liveData = { confidence: 85, leader: 'B' as DisplayLabel, leaderColor: '#E8823C', lift: 10 }
    render(<ActiveDetail view={makeActiveView({ liveData })} />)
    expect(screen.getByText('Confirmado')).toBeDefined()
    expect(screen.getByText('Live')).toBeDefined()
  })

  it('VariantTable is rendered with metric=pBest column header', () => {
    render(<ActiveDetail view={makeActiveView()} />)
    // pBest column header shows "chance de vencer"
    expect(screen.getByText('chance de vencer')).toBeDefined()
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
    const blocks = container.querySelectorAll('[data-block]')
    expect(blocks.length).toBe(6)
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
