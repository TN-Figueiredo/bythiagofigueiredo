import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinnerBanner } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-banner'
import { LiveMonitorCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/live-monitor'
import { WinnerDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-detail'
import type { AbTestWinnerView, LiveMonitor, FullChartVariant, VariantThumb, GateResult } from '@/lib/youtube/ab-types'

vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Image: icon('Image'), Type: icon('Type'), FileText: icon('FileText'), Layers: icon('Layers'),
    Trophy: icon('Trophy'), TrendingUp: icon('TrendingUp'), TrendingDown: icon('TrendingDown'),
    CheckCircle: icon('CheckCircle'), Clock: icon('Clock'), ChevronDown: icon('ChevronDown'),
    ChevronRight: icon('ChevronRight'), ArrowLeft: icon('ArrowLeft'), Copy: icon('Copy'),
    Archive: icon('Archive'), Download: icon('Download'), Swords: icon('Swords'),
    Info: icon('Info'), Target: icon('Target'), ArrowRight: icon('ArrowRight'),
    Lock: icon('Lock'), Minus: icon('Minus'), Sparkles: icon('Sparkles') }
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
    value: `${i + 1}/${count}`,
  }))
}

function makeMonitor(overrides?: Partial<LiveMonitor>): LiveMonitor {
  return {
    liveCtr: 6.2,
    sparkline: [5.0, 5.5, 5.8, 6.0, 6.2],
    liftVsOriginal: 12.5,
    checkpoints: [
      { label: 'D+7', reached: true, date: '2026-05-01' },
      { label: 'D+14', reached: true, date: '2026-05-08' },
      { label: 'D+30', reached: false },
    ],
    ...overrides,
  }
}

function makeWinnerView(overrides?: Partial<AbTestWinnerView>): AbTestWinnerView {
  return {
    id: 'test-1',
    videoTitle: 'My Test Video',
    flag: 'thumbnail',
    status: 'completed',
    outcome: 'winner',
    winnerLabel: 'B',
    winnerColor: '#E8823C',
    lift: 15.3,
    confidence: 97.2,
    resultMeta: {
      ctrBefore: 4.5,
      ctrAfter: 5.2,
      totalImpressions: 50000,
      abbaCycles: 12,
      monthlyExtraClicks: 350,
    },
    variants: [
      makeVariant('A', { ctr: 4.5, pBest: 0.1, impressions: 25000, clicks: 1125 }),
      makeVariant('B', { ctr: 5.2, pBest: 0.9, impressions: 25000, clicks: 1300 }),
    ],
    variantThumbs: [makeThumb('A', true), makeThumb('B')],
    confTrend: [50, 65, 78, 85, 92, 97],
    daily: { A: [4.2, 4.5, 4.3, 4.6, 4.5, 4.4], B: [5.0, 5.1, 5.3, 5.1, 5.2, 5.2], C: [], D: [] },
    abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B'],
    cycles: { total: 12, done: 12 },
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 1,
    hasPlayoff: false,
    gates: makeGates(6, true),
    ...overrides,
  }
}

/* ─── WinnerBanner ─── */

describe('WinnerBanner', () => {
  it('renders trophy icon', () => {
    render(
      <WinnerBanner
        winnerLabel="B"
        winnerColor="#E8823C"
        lift={15.3}
        confidence={97.2}
        stats={{ ctrBefore: 4.5, ctrAfter: 5.2, totalImpressions: 50000, abbaCycles: 12, monthlyExtraClicks: 350 }}
      />,
    )
    expect(screen.getByTestId('icon-Trophy')).toBeDefined()
  })

  it('renders VChip with winner label', () => {
    render(
      <WinnerBanner
        winnerLabel="B"
        winnerColor="#E8823C"
        lift={15.3}
        confidence={97.2}
        stats={{ ctrBefore: 4.5, ctrAfter: 5.2, totalImpressions: 50000, abbaCycles: 12, monthlyExtraClicks: 350 }}
      />,
    )
    expect(screen.getByLabelText('Variant B')).toBeDefined()
  })

  it('renders lift value', () => {
    render(
      <WinnerBanner
        winnerLabel="B"
        winnerColor="#E8823C"
        lift={15.3}
        confidence={97.2}
        stats={{ ctrBefore: 4.5, ctrAfter: 5.2, totalImpressions: 50000, abbaCycles: 12, monthlyExtraClicks: 350 }}
      />,
    )
    expect(screen.getByTestId('winner-lift').textContent).toBe('+15.3%')
  })

  it('renders confidence text', () => {
    render(
      <WinnerBanner
        winnerLabel="B"
        winnerColor="#E8823C"
        lift={15.3}
        confidence={97.2}
        stats={{ ctrBefore: 4.5, ctrAfter: 5.2, totalImpressions: 50000, abbaCycles: 12, monthlyExtraClicks: 350 }}
      />,
    )
    expect(screen.getByText('97.2% confidence')).toBeDefined()
  })

  it('renders 3 stat cells', () => {
    render(
      <WinnerBanner
        winnerLabel="B"
        winnerColor="#E8823C"
        lift={15.3}
        confidence={97.2}
        stats={{ ctrBefore: 4.5, ctrAfter: 5.2, totalImpressions: 50000, abbaCycles: 12, monthlyExtraClicks: 350 }}
      />,
    )
    const statsEl = screen.getByTestId('winner-stats')
    expect(statsEl.textContent).toContain('Impressões no teste')
    expect(statsEl.textContent).toContain('Ciclos ABBA')
    expect(statsEl.textContent).toContain('Cliques/mês a mais')
  })
})

/* ─── LiveMonitorCard ─── */

describe('LiveMonitorCard', () => {
  it('renders live CTR value', () => {
    render(<LiveMonitorCard monitor={makeMonitor()} />)
    expect(screen.getByTestId('live-ctr').textContent).toBe('6.2%')
  })

  it('renders sparkline SVG', () => {
    render(<LiveMonitorCard monitor={makeMonitor()} />)
    expect(screen.getByTestId('sparkline')).toBeDefined()
  })

  it('renders checkpoints with correct icons', () => {
    render(<LiveMonitorCard monitor={makeMonitor()} />)
    const checkpoints = screen.getByTestId('checkpoints')
    expect(checkpoints.textContent).toContain('D+7')
    expect(checkpoints.textContent).toContain('D+14')
    expect(checkpoints.textContent).toContain('D+30')
  })
})

/* ─── WinnerDetail ─── */

describe('WinnerDetail', () => {
  it('renders 8-section layout', () => {
    const view = makeWinnerView()
    const { container } = render(<WinnerDetail view={view} />)
    expect(screen.getByTestId('winner-detail')).toBeDefined()
    expect(screen.getByTestId('winner-banner')).toBeDefined()
    expect(screen.getByTestId('why-won')).toBeDefined()
    expect(screen.getByTestId('confidence-section')).toBeDefined()
    expect(screen.getByTestId('scoreboard')).toBeDefined()
    expect(screen.getByTestId('gates-section')).toBeDefined()
    expect(container.querySelector('[data-click-moment]')).not.toBeNull()
  })

  it('renders "Why B won" section heading', () => {
    const view = makeWinnerView({ winnerLabel: 'B' })
    render(<WinnerDetail view={view} />)
    expect(screen.getByText('Why B won')).toBeDefined()
  })

  it('shows Duplicate and Download actions', () => {
    render(<WinnerDetail view={makeWinnerView()} />)
    expect(screen.getByText('Duplicate')).toBeDefined()
    expect(screen.getByText('Download')).toBeDefined()
  })

  it('does not render LiveMonitor when view.monitor is undefined', () => {
    const view = makeWinnerView({ monitor: undefined })
    render(<WinnerDetail view={view} />)
    expect(screen.queryByTestId('live-monitor')).toBeNull()
  })

  it('renders LiveMonitor when view.monitor is present', () => {
    const view = makeWinnerView({ monitor: makeMonitor() })
    render(<WinnerDetail view={view} />)
    expect(screen.getByTestId('live-monitor')).toBeDefined()
  })

  it('renders learning text when present', () => {
    const view = makeWinnerView({ learning: 'Faces with eye contact outperform product shots' })
    render(<WinnerDetail view={view} />)
    expect(screen.getByTestId('learning-text').textContent).toBe(
      'Faces with eye contact outperform product shots',
    )
  })

  it('renders VariantTable in scoreboard section', () => {
    render(<WinnerDetail view={makeWinnerView()} />)
    // VariantTable renders role="table" (ConfidenceChart also has a sr-only table)
    const tables = screen.getAllByRole('table')
    const variantTable = tables.find(t => t.getAttribute('aria-label') === 'Variant comparison')
    expect(variantTable).toBeDefined()
  })
})
