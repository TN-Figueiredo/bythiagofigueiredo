import { describe, it, expect, vi, afterEach } from 'vitest'
import { placarVazio } from '../helpers/ab-placar-fixture'
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

import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { WinnerDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-detail'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { EarlyDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-detail'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { AbTestResults, AbTestWinnerView, AbTestActiveView, FullChartVariant, VariantStats } from '@/lib/youtube/ab-types'

const ACOES = { encerrar: vi.fn(), pausar: vi.fn() }

afterEach(() => cleanup())

const FRASE = 'CTR ainda não medido. Você decide o vencedor.'

function stats(id: string, label: string, imp: number, clicks: number, orig: boolean): VariantStats {
  return {
    variant_id: id, label, blob_url: null, title_text: null, metadata: {},
    is_original: orig, total_impressions: imp, total_clicks: clicks,
    avg_ctr: imp > 0 ? clicks / imp : 0, cycles_completed: 4,
  }
}

describe('emenda N (Gio)', () => {
  it('N2: vencedor A 30/840 e B 45/840 mostra 3,6% e 5,4% no banner, nunca 357,1%', async () => {
    const results: AbTestResults = {
      test: makeTestRow({ status: 'completed', winner_variant_id: 'v-b', completed_reason: 'manual_winner', started_at: new Date(Date.now() - 10 * 86400000).toISOString() }),
      variants: [stats('v-a', 'original', 840, 30, true), stats('v-b', 'B', 840, 45, false)],
      confidence: 0.9, is_significant: false, suggested_winner_id: 'v-b', timeline: [],
      data_freshness: new Date().toISOString(), tracked_links: [],
    }
    const view = await toDetailView(results)
    const { container } = render(<WinnerDetail view={view as AbTestWinnerView} />)
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/357,1|535,7/)
    // S8-F3 T5: a linha do placar não mostra % (só contagens); o CTR segue uma vez no banner do vencedor.
    expect(t.match(/3,6%/g)?.length).toBeGreaterThanOrEqual(1)
    expect(t.match(/5,4%/g)?.length).toBeGreaterThanOrEqual(1)
  })

  const vz = (label: 'A' | 'B'): FullChartVariant => ({ label, color: '#888', ctr: 0, impressions: 0, clicks: 0, pBest: 0.5 })
  const thumbs = [
    { label: 'A' as const, color: '#888', thumbUrl: null, isOriginal: true },
    { label: 'B' as const, color: '#888', thumbUrl: null, isOriginal: false },
  ]
  const ativo = {
    id: 't', videoTitle: 'V', flag: 'thumbnail', status: 'active',
    variants: [vz('A'), vz('B')], variantThumbs: thumbs, confTrend: [], daily: { A: [0], B: [0] },
    abbaSeq: ['A', 'B'], cycles: { total: 6, done: 1 }, durationDays: 14, confidenceTarget: 0.95,
    totalRounds: 1, hasPlayoff: false, gates: [],
    confirmedData: { confidence: 0, leader: 'A', leaderColor: '#888', lift: 0 },
    // Fixture legada da F2: hero e faixa só abrem com estatística calculada (D-F3-2); a F4 os reativa na tela real.
    placar: placarVazio({ estatistica: 'calculada' }),
  } as unknown as AbTestActiveView

  it('N3: ativo sem medição não mostra funil, Δ em zero nem cartão vazio de métricas', () => {
    const { container } = render(<ActiveDetail view={ativo} {...ACOES} />)
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/Funil por variante/)
    expect(t).not.toMatch(/Métricas computadas/)
    expect(t).toMatch(/Δ Views—/)
    expect(t).toMatch(/Δ Curtidas—/)
  })

  it('N7: tendência estável é uma célula só com "—", sem "estavel"', () => {
    const { container } = render(<ActiveDetail view={ativo} {...ACOES} />)
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/estavel/)
    const celula = screen.getByText('Tendência').parentElement!
    expect(celula.textContent).not.toMatch(/—\s*—/)
    expect(celula.textContent).toMatch(/^Tendência—/)
  })

  it('N4: early traz a frase fixa uma vez, sem gráfico vazio e sem texto sem acento', () => {
    const early = { ...ativo, cycles: { total: 6, done: 0 } } as unknown as AbTestActiveView
    const { container } = render(<EarlyDetail view={early} />)
    expect(screen.getAllByText(FRASE)).toHaveLength(1)
    expect(container.textContent).not.toMatch(/CTR diario|Historico|apos o segundo/)
    expect(container.textContent).not.toMatch(/diário por variante/)
  })

  it('N4: vencedor traz a frase fixa uma vez', async () => {
    const results: AbTestResults = {
      test: makeTestRow({ status: 'completed', winner_variant_id: 'v-b', completed_reason: 'winner', started_at: new Date(Date.now() - 10 * 86400000).toISOString() }),
      variants: [stats('v-a', 'original', 840, 30, true), stats('v-b', 'B', 840, 45, false)],
      confidence: 0.9, is_significant: false, suggested_winner_id: 'v-b', timeline: [],
      data_freshness: new Date().toISOString(), tracked_links: [],
    }
    // Vencedor sem nenhuma impressão não sai do toDetailView (cai em inconclusivo): zera a medição na view.
    const v = (await toDetailView(results)) as AbTestWinnerView
    const semImp = {
      ...v,
      resultMeta: { ...v.resultMeta, totalImpressions: 0 },
      variants: v.variants.map(x => ({ ...x, impressions: 0, clicks: 0, ctr: 0 })),
    } as AbTestWinnerView
    render(<WinnerDetail view={semImp} />)
    expect(screen.getAllByText(FRASE)).toHaveLength(1)
  })
})
