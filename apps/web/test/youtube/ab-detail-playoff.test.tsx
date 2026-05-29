import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayoffBanner } from '@/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner'
import { PlayoffDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/playoff-detail'
import type { AbTestPlayoffView, FullChartVariant, VariantThumb, GateResult } from '@/lib/youtube/ab-types'

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

function makePlayoffView(overrides?: Partial<AbTestPlayoffView>): AbTestPlayoffView {
  return {
    id: 'test-2',
    videoTitle: 'Playoff Test Video',
    flag: 'thumbnail',
    status: 'completed',
    outcome: 'playoff',
    playoffTestId: 'playoff-1',
    startsIn: '2 days',
    confidenceReached: 82.4,
    reason: 'No clear winner after 14 days — top 2 variants advance to playoff',
    finalists: [
      { label: 'A', color: '#8A8F98', ctr: 5.1, thumbnailUrl: null },
      { label: 'B', color: '#E8823C', ctr: 5.0, thumbnailUrl: null },
    ],
    variants: [
      makeVariant('A', { ctr: 5.1, pBest: 0.35, pTop2: 0.85, impressions: 15000 }),
      makeVariant('B', { ctr: 5.0, pBest: 0.40, pTop2: 0.82, impressions: 15000 }),
      makeVariant('C', { ctr: 4.2, pBest: 0.25, pTop2: 0.33, impressions: 15000 }),
    ],
    variantThumbs: [makeThumb('A', true), makeThumb('B'), makeThumb('C')],
    confTrend: [40, 55, 65, 72, 78, 82],
    daily: { A: [5.0, 5.1, 5.0, 5.2, 5.1, 5.1], B: [4.8, 5.0, 5.1, 5.0, 5.0, 5.0], C: [4.0, 4.1, 4.2, 4.3, 4.2, 4.2], D: [] },
    abbaSeq: ['A', 'B', 'C', 'B', 'A', 'C'],
    cycles: { total: 12, done: 12 },
    durationDays: 14,
    confidenceTarget: 0.95,
    totalRounds: 2,
    hasPlayoff: true,
    gates: makeGates(6),
    ...overrides,
  }
}

/* ─── PlayoffBanner ─── */

describe('PlayoffBanner', () => {
  const finalists = [
    { label: 'A' as const, color: '#8A8F98', ctr: 5.1, thumbnailUrl: null },
    { label: 'B' as const, color: '#E8823C', ctr: 5.0, thumbnailUrl: null },
  ]
  const allVariants = [
    { label: 'A' as const, isFinalist: true, thumbnailUrl: null },
    { label: 'B' as const, isFinalist: true, thumbnailUrl: null },
    { label: 'C' as const, isFinalist: false, thumbnailUrl: null },
  ]

  it('renders swords icon and title', () => {
    render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner" />,
    )
    expect(screen.getByTestId('icon-Swords')).toBeDefined()
    expect(screen.getByText('Playoff criado automaticamente')).toBeDefined()
  })

  it('renders countdown badge', () => {
    render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner" />,
    )
    expect(screen.getByText('2 days')).toBeDefined()
  })

  it('renders bracket with round-1 and round-2', () => {
    render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner" />,
    )
    expect(screen.getByTestId('round-1')).toBeDefined()
    expect(screen.getByTestId('round-2')).toBeDefined()
  })

  it('renders finalists at full opacity and non-finalists dimmed', () => {
    const { container } = render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner" />,
    )
    const round1 = screen.getByTestId('round-1')
    const items = round1.querySelectorAll('[class*="opacity"]')
    // C should be dimmed (opacity-40), A and B should be full (opacity-100)
    const dimmed = Array.from(items).filter(el => el.className.includes('opacity-40'))
    const full = Array.from(items).filter(el => el.className.includes('opacity-100'))
    expect(dimmed).toHaveLength(1)
    expect(full).toHaveLength(2)
  })

  it('has role="region" with accessible label', () => {
    render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner" />,
    )
    const banner = screen.getByTestId('playoff-banner')
    expect(banner.getAttribute('role')).toBe('region')
    expect(banner.getAttribute('aria-label')).toContain('Variant A')
    expect(banner.getAttribute('aria-label')).toContain('Variant B')
  })

  it('renders reason text in footer', () => {
    render(
      <PlayoffBanner finalists={finalists} allVariants={allVariants} startsIn="2 days" reason="No clear winner after 14 days" />,
    )
    expect(screen.getByTestId('playoff-reason').textContent).toBe('No clear winner after 14 days')
  })
})

/* ─── PlayoffDetail ─── */

describe('PlayoffDetail', () => {
  it('renders 5-section layout', () => {
    render(<PlayoffDetail view={makePlayoffView()} />)
    expect(screen.getByTestId('playoff-detail')).toBeDefined()
    expect(screen.getByTestId('inconclusive-banner')).toBeDefined()
    expect(screen.getByTestId('playoff-banner')).toBeDefined()
    expect(screen.getByTestId('why-inconclusive')).toBeDefined()
    expect(screen.getByTestId('variant-section')).toBeDefined()
  })

  it('renders Inconclusive badge', () => {
    render(<PlayoffDetail view={makePlayoffView()} />)
    expect(screen.getByText('Inconclusivo')).toBeDefined()
  })

  it('renders inconclusive banner with confidence info', () => {
    render(<PlayoffDetail view={makePlayoffView({ confidenceReached: 82.4, confidenceTarget: 0.95 })} />)
    expect(screen.getByText('Teste encerrou sem vencedor claro')).toBeDefined()
    expect(screen.getByText(/82\.4%/)).toBeDefined()
    expect(screen.getByText(/95%/)).toBeDefined()
  })

  it('renders VariantTable with pTop2 metric', () => {
    render(<PlayoffDetail view={makePlayoffView()} />)
    // VariantTable header should show "Top 2" not "Chance to win"
    expect(screen.getByText('Top 2')).toBeDefined()
  })
})
