import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => ({}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(), revertWinner: vi.fn(), archiveAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: () => ({ data: null, loading: false }),
}))

import {
  medicaoCompleta, semImpressoes, liftVsA, ordemDesc, SEM_MEDICAO_DE_ENTREGA,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-constants'
import { VariantTable } from '@/app/cms/(authed)/youtube/ab-lab/_components/variant-table'
import { RankBars } from '@/app/cms/(authed)/youtube/ab-lab/_components/rank-bars'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { PlayoffBanner } from '@/app/cms/(authed)/youtube/ab-lab/_components/playoff-banner'
import { WinnerBanner } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-banner'
import { isEarly } from '@/app/cms/(authed)/youtube/ab-lab/_components/is-early'
import type { AbTestActiveView, FullChartVariant } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())
const ACOES = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

const thumbs = [
  { label: 'A' as const, color: '#888', thumbUrl: null, isOriginal: true },
  { label: 'B' as const, color: '#E8823C', thumbUrl: null, isOriginal: false },
]
const A_MEDIDA: FullChartVariant = { label: 'A', color: '#888', ctr: 0.05, impressions: 1000, clicks: 50, pBest: null }
const B_NULA: FullChartVariant = { label: 'B', color: '#E8823C', ctr: null, impressions: null, clicks: null, pBest: null }
const B_NULA_SEM_A: FullChartVariant = { ...A_MEDIDA, ctr: null, impressions: null, clicks: null }

function ativo(variants: FullChartVariant[], extra: Partial<AbTestActiveView> = {}): AbTestActiveView {
  return {
    id: 't', videoTitle: 'V', flag: 'thumbnail', status: 'active',
    variants, variantThumbs: thumbs, variantDb: [], confTrend: [], daily: { A: [], B: [], C: [], D: [] },
    abbaSeq: ['A', 'B'], cycles: { total: 6, done: 1 }, dayOf: 3, durationDays: 14, confidenceTarget: 0.95,
    totalRounds: 1, hasPlayoff: false, gates: [], activeNow: null, createdAt: new Date().toISOString(),
    restoreStatus: null, youtubeVideoId: null, noArAntes: null, restoreSeq: 0, statusNote: null, driftAcknowledgedAt: null,
    confirmedData: { confidence: null, leader: 'A', leaderColor: '#888', lift: null },
    ...extra,
  } as unknown as AbTestActiveView
}

describe('S8-F2 T4: vista aceita nulo', () => {
  it('medicaoCompleta exige 2+ variantes, todas com impressões e CTR', () => {
    expect(medicaoCompleta([{ impressions: 100, ctr: 0.05 }, { impressions: null, ctr: null }])).toBe(false)
    expect(medicaoCompleta([])).toBe(false)
    expect(medicaoCompleta([{ impressions: 100, ctr: 0.05 }, { impressions: 5, ctr: 0.1 }])).toBe(true)
  })
  it('decisão da P2 intacta: semImpressoes só quando nenhuma variante tem impressão', () => {
    expect(semImpressoes([{ impressions: 100 }, { impressions: null }])).toBe(false)
    expect(semImpressoes([{ impressions: null }, { impressions: null }])).toBe(true)
  })
  it('liftVsA com CTR nulo dá null', () => {
    expect(liftVsA({ label: 'A', ctr: null, impressions: null }, { label: 'B', ctr: 0.05, impressions: 100 })).toBeNull()
  })
  it('ordemDesc põe nulo por último', () => {
    expect([5, null, 7].sort(ordemDesc)).toEqual([7, 5, null])
  })

  for (const semChance of [true, false]) {
    it(`VariantTable (semChance=${semChance}): B nula mostra "não medido", nunca 0`, () => {
      const { container } = render(
        <VariantTable variants={[B_NULA, semChance ? A_MEDIDA : { ...A_MEDIDA, pBest: 0.3 }]} thumbs={thumbs} semChance={semChance} />,
      )
      const linhas = screen.getAllByRole('row').filter(r => r.getAttribute('aria-label')?.startsWith('Variante'))
      expect(linhas[0]!.getAttribute('aria-label')).toContain('Variante A')
      expect(linhas[1]!.getAttribute('aria-label')).toContain('Variante B')
      expect(linhas[1]!.textContent).toContain('não medido')
      expect(linhas[1]!.textContent).not.toMatch(/0,0%|\b0%|\b0\b/)
      if (!semChance) expect(container.textContent).toContain('não medido')
    })
  }
  it('VariantTable expandido: impressões e cliques nulos mostram "não medido"', async () => {
    const { fireEvent } = await import('@testing-library/react')
    render(<VariantTable variants={[A_MEDIDA, B_NULA]} thumbs={thumbs} semChance />)
    fireEvent.click(screen.getByLabelText('Variante B, detalhes'))
    const imp = screen.getByText('Impressões').parentElement!
    const cli = screen.getByText('Cliques').parentElement!
    expect(imp.textContent).toContain('não medido')
    expect(cli.textContent).toContain('não medido')
  })
  it('RankBars com pBest nulo mostra "não medido", nunca 0%', () => {
    const { container } = render(<RankBars variants={[{ label: 'A', color: '#888', pBest: null }, { label: 'B', color: '#E80', pBest: 0.4 }]} />)
    expect(container.textContent).toContain('não medido')
    expect(container.textContent).not.toMatch(/\b0%/)
  })

  for (const [nome, vs] of [['sem nenhuma medição', [B_NULA_SEM_A, { ...B_NULA_SEM_A, label: 'B' as const }]], ['medição parcial', [A_MEDIDA, B_NULA]]] as const) {
    it(`ActiveDetail ${nome}: sem faixa de CTR, CTR diário nem funil`, () => {
      const { container } = render(<ActiveDetail view={ativo([...vs])} {...ACOES} />)
      const t = container.textContent ?? ''
      expect(t).not.toContain('Faixa provável de CTR')
      expect(t).not.toContain('CTR diário por variante')
      expect(t).not.toContain('Funil por variante')
      if (nome === 'medição parcial') expect(t).not.toContain(SEM_MEDICAO_DE_ENTREGA)
    })
  }

  it('isEarly trata confiança nula como "ainda sem confiança"', () => {
    expect(isEarly(ativo([A_MEDIDA, B_NULA], { cycles: { total: 6, done: 0 } }))).toBe(true)
    expect(isEarly(ativo([A_MEDIDA, B_NULA], { cycles: { total: 6, done: 2 } }))).toBe(false)
  })

  it('PlayoffBanner com finalista de CTR nulo mostra "não medido"', () => {
    const { container } = render(
      <PlayoffBanner
        finalists={[{ label: 'A', color: '#888', ctr: null, thumbnailUrl: null }, { label: 'B', color: '#E80', ctr: null, thumbnailUrl: null }]}
        allVariants={[{ label: 'A', isFinalist: true, thumbnailUrl: null }, { label: 'B', isFinalist: true, thumbnailUrl: null }]}
        startsIn="" reason=""
      />,
    )
    expect(container.textContent).toContain('não medido')
    expect(container.textContent).not.toMatch(/0,0%|NaN/)
  })
})

describe('S8-F2 T5: vista de vencedor aceita nulo', () => {
  it('WinnerBanner com tudo nulo mostra "—" e a frase, nunca 0', () => {
    render(
      <WinnerBanner
        winnerLabel="B" winnerColor="" lift={null} confidence={null}
        stats={{ ctrBefore: null, ctrAfter: null, totalImpressions: null, abbaCycles: 4, monthlyExtraClicks: null }}
      />,
    )
    expect(screen.getByText(SEM_MEDICAO_DE_ENTREGA)).toBeTruthy()
    const t = screen.getByTestId('winner-banner').textContent ?? ''
    expect(t).toContain('—')
    expect(t).not.toMatch(/0,0%|\b0\b/)
  })
})
