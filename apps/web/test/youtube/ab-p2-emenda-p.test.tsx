import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { formatCtr } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'
import { VariantTable } from '@/app/cms/(authed)/youtube/ab-lab/_components/variant-table'
import { ActiveTestCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-test-card'
import { LearningsPanel } from '@/app/cms/(authed)/youtube/ab-lab/_components/learnings-panel'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { PlayoffDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/playoff-detail'
import { makeCardView } from '../helpers/ab-fixtures'
import type { AbTestActiveView, AbTestPlayoffView, FullChartVariant } from '@/lib/youtube/ab-types'

const ACOES = { encerrar: vi.fn(), pausar: vi.fn() }

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: () => ({ data: null, loading: false }),
}))

afterEach(() => cleanup())

const FRASE = 'CTR ainda não medido. Você decide o vencedor.'
const vz = (label: 'A' | 'B'): FullChartVariant => ({ label, color: '#888', ctr: 0, impressions: 0, clicks: 0, pBest: 0.5 })
const thumbs = [
  { label: 'A' as const, color: '#888', thumbUrl: null, isOriginal: true },
  { label: 'B' as const, color: '#888', thumbUrl: null, isOriginal: false },
]

describe('emenda P1-P6 (Gio)', () => {
  it('helper: CTR com 0/null impressões é "—", com impressões é percentual', () => {
    expect(formatCtr(0, 0)).toBe('—')
    expect(formatCtr(0.05, null)).toBe('—')
    expect(formatCtr(0.05, 1000)).toBe('5,0%')
  })

  it('P1: card ativo sem medição não tem o rótulo "Confiança"', () => {
    render(<ActiveTestCard test={makeCardView({ confidence: null, lift: null })} onOpen={vi.fn()} />)
    expect(screen.queryByText('Confiança')).toBeNull()
  })

  it('P3 + P2 (card): frase da coluna Líder com text-cms-text e Líder mostra "—"', () => {
    render(<ActiveTestCard test={makeCardView({ confidence: null, lift: null })} onOpen={vi.fn()} />)
    const frase = screen.getByText('CTR não medido')
    expect(frase.className).toMatch(/text-cms-text(?![-\w])/)
    expect(frase.className).not.toMatch(/text-cms-text-(dim|muted)/)
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('P2: detalhe ativo sem impressões não tem faixa de CTR, nem "credibilidade", nem "últimos N dias"; frase uma vez', () => {
    const view = {
      id: 't', videoTitle: 'V', flag: 'thumbnail', status: 'active',
      variants: [vz('A'), vz('B')], variantThumbs: thumbs, confTrend: [], daily: { A: [0], B: [0] },
      abbaSeq: ['A', 'B'], cycles: { total: 6, done: 0 }, durationDays: 14, confidenceTarget: 0.95,
      totalRounds: 1, hasPlayoff: false, gates: [],
      confirmedData: { confidence: 0, leader: 'A', leaderColor: '#888', lift: 0 },
    } as unknown as AbTestActiveView
    const { container } = render(<ActiveDetail view={view} {...ACOES} />)
    expect(container.textContent).not.toMatch(/credibilidade/)
    expect(container.textContent).not.toMatch(/Faixa provável/)
    expect(container.textContent).not.toMatch(/últimos \d+ dias/)
    expect(screen.getAllByText(FRASE)).toHaveLength(1)
  })

  it('P4/P5: placar com 0 impressões mostra "—", nunca "0,0%"', () => {
    const { container } = render(<VariantTable variants={[vz('A'), vz('B')]} thumbs={thumbs} semChance />)
    expect(container.textContent).not.toMatch(/0,0%/)
  })

  it('P4: encerrado sem vencedor não duplica o título "Placar das variantes"', () => {
    const view = {
      id: 't', videoTitle: 'V', flag: 'thumbnail', status: 'completed', outcome: 'playoff', playoffTestId: null,
      startsIn: '', confidenceReached: null, reason: '', finalists: [],
      variants: [vz('A'), vz('B')], variantThumbs: thumbs, confTrend: [], daily: {}, abbaSeq: [],
      cycles: { total: 0, done: 0 }, durationDays: 14, confidenceTarget: 0.95, totalRounds: 1, hasPlayoff: false, gates: [],
    } as unknown as AbTestPlayoffView
    render(<PlayoffDetail view={view} />)
    expect(screen.getAllByText('Placar das variantes')).toHaveLength(1)
  })

  it('P6: com 3 de 3 testes o texto não diz "Coletando dados"', () => {
    render(<LearningsPanel learnings={null} totalTests={3} />)
    expect(screen.queryByText(/Coletando dados/)).toBeNull()
    expect(screen.getByText(/3 de 3 testes concluídos/)).toBeTruthy()
  })
})
