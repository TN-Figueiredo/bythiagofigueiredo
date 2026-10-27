// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { placarVazio } from '../helpers/ab-placar-fixture'

vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import type { DisplayLabel } from '@/lib/youtube/ab-types'

const ACOES = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(), acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: vi.fn(() => ({ data: null, loading: false })),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Activity: icon('Activity'), BarChart3: icon('BarChart3'), ChevronDown: icon('ChevronDown'),
    ChevronLeft: icon('ChevronLeft'), ChevronRight: icon('ChevronRight'), Crosshair: icon('Crosshair'),
    Eye: icon('Eye'), ExternalLink: icon('ExternalLink'), FileText: icon('FileText'), Filter: icon('Filter'), Image: icon('Image'),
    Layers: icon('Layers'), Lock: icon('Lock'), Minus: icon('Minus'), Pause: icon('Pause'), Play: icon('Play'),
    RefreshCw: icon('RefreshCw'), Settings: icon('Settings'), Square: icon('Square'),
    Swords: icon('Swords'), TrendingDown: icon('TrendingDown'), TrendingUp: icon('TrendingUp'),
    Type: icon('Type'), X: icon('X'), Zap: icon('Zap'),
  }
})
afterEach(cleanup)

function makeActiveView(overrides?: Partial<AbTestActiveView>): AbTestActiveView {
  return {
    id: 'test-1', videoTitle: 'My YouTube Video', flag: 'thumbnail', status: 'active',
    variants: [
      { label: 'A', color: '#8A8F98', ctr: 0.05, impressions: 10000, clicks: 500, pBest: 0.3 },
      { label: 'B', color: '#E8823C', ctr: 0.07, impressions: 10000, clicks: 700, pBest: 0.7 },
    ],
    variantThumbs: [
      { label: 'A', color: '#8A8F98', thumbUrl: null, isOriginal: true },
      { label: 'B', color: '#E8823C', thumbUrl: 'https://example.com/b.jpg', isOriginal: false },
    ],
    confTrend: [50, 65, 78, 85, 88],
    daily: { A: [5.0, 5.1, 4.9], B: [6.0, 6.5, 7.0] } as Record<DisplayLabel, number[]>,
    abbaSeq: ['A', 'B', 'B', 'A', 'A', 'B'] as DisplayLabel[],
    cycles: { total: 6, done: 4 },
    dayOf: 4,
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
    // Fixture legada da F2: hero e faixa só abrem com estatística calculada (D-F3-2); a F4 os reativa na tela real.
    placar: placarVazio({ estatistica: 'calculada' }),
    ...overrides,
  } as AbTestActiveView
}

describe('M7d T3a: selo com dia e ⓘ', () => {
  it('rodando: "Rodando · dia 3 de 14"', () => {
    render(<ActiveDetail view={makeActiveView({ dayOf: 2, durationDays: 14, flag: 'title' })} {...ACOES} />)
    expect(screen.getByTestId('selo-lab').textContent).toBe('Rodando · dia 3 de 14')
  })
  it('pausado: "Pausado · dia …"', () => {
    render(<ActiveDetail view={makeActiveView({ status: 'paused', dayOf: 2, durationDays: 14 })} {...ACOES} />)
    expect(screen.getByTestId('selo-lab').textContent).toMatch(/^Pausado · dia /)
  })
  it('escrevendo: "Escrevendo no YouTube… · dia …"', () => {
    render(<ActiveDetail view={makeActiveView({ dayOf: 2, durationDays: 14 })} escrevendo {...ACOES} />)
    expect(screen.getByTestId('selo-lab').textContent).toMatch(/^Escrevendo no YouTube… · dia /)
  })
  it('ⓘ abre a frase de origem; o parágrafo fixo sai', () => {
    render(<ActiveDetail view={makeActiveView({ flag: 'title' })} {...ACOES} />)
    expect(screen.queryByTestId('origem-lab')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'O que é este teste' }))
    expect(screen.getByText(/Teste do A\/B Lab: o Lab troca o título público/)).toBeTruthy()
  })
})
