// @vitest-environment jsdom
// Conserto do lote S8-F3 (revisão Gio + Phil + Yannis).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const getTestResultsMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/service', async () => {
  const { bancoFalso } = await import('../helpers/ab-banco-falso')
  return { getSupabaseServiceClient: () => bancoFalso({}) }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  notFound: () => { throw new Error('NOT_FOUND') },
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(), endAbTest: vi.fn(), pauseAbTest: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(), revertWinner: vi.fn(), archiveAbTest: vi.fn(), retryRestore: vi.fn(), dismissRestore: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({ usePollStats: () => ({ data: null, loading: false }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/queries', async (orig) => ({
  ...(await orig<typeof import('@/app/cms/(authed)/youtube/ab-lab/queries')>()),
  getTestResults: getTestResultsMock,
}))

import { PlayoffDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/playoff-detail'
import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import { isEarly } from '@/app/cms/(authed)/youtube/ab-lab/_components/is-early'
import AbTestDetailPage from '@/app/cms/(authed)/youtube/ab-lab/[testId]/page'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { Placar, PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import type { AbTestPlayoffView, AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => { cleanup(); getTestResultsMock.mockReset() })

const pv = (id: string, o: Partial<PlacarVariante> = {}): PlacarVariante => ({
  variant_id: id, dias: 1, dias_validos: 1, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
  dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: 1000, impressoes_com_ctr: 1000, cliques: 20, ctr: 0.02, views: null, ...o,
})
const pl = (o: Partial<Placar> = {}): Placar => ({
  regra: 'v2', estatistica: 'nao_calculada', variantes: [pv('v-a'), pv('v-b', { cliques: 31, ctr: 0.031 })], dias_total: 4,
  dias_descartados: 0, dias_variante_desconhecida: 0, atualizado_em: '2026-10-20T10:00:00Z', desatualizado: false, atrasado: false,
  todos_finais: true, iniciado: true, proximo_fechamento: null, ...o,
})
const vs = (id: string, label: string, orig: boolean, ctr: number): VariantStats => ({
  variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig,
  total_impressions: 1000, total_clicks: ctr * 1000, avg_ctr: ctr, impressoes_com_ctr: 1000, cycles_completed: 2,
})
const resultados = (status: 'completed' | 'queued', placar: Placar): AbTestResults => ({
  test: makeTestRow({ id: `t-${status}`, status, started_at: status === 'queued' ? null : '2026-10-10T00:00:00Z', completed_at: status === 'completed' ? '2026-10-20T00:00:00Z' : null, winner_variant_id: null, completed_reason: status === 'completed' ? 'max_duration' : null }),
  variants: [vs('v-a', 'original', true, 0.02), vs('v-b', 'B', false, 0.031)],
  confidence: null, is_significant: false, suggested_winner_id: null, timeline: [], data_freshness: new Date().toISOString(), placar, faixa_dias: [],
} as unknown as AbTestResults)

describe('conserto do lote S8-F3', () => {
  it('Yannis 1 (C-11): encerrado sem vitória humana não ordena por CTR nem pinta ganho sobre A', async () => {
    const view = (await toDetailView(resultados('completed', pl()))) as AbTestPlayoffView
    expect(view.outcome).toBe('playoff')
    const { container } = render(<PlayoffDetail view={view} />)
    const t = container.textContent ?? ''
    expect(t).not.toMatch(/ordenado por CTR|vs A|\+55|\+3[01]/i)
    expect(container.querySelector('[data-testid="placar-do-teste"]')).not.toBeNull()
    const ordem = Array.from(container.querySelectorAll('[role="group"]')).map(g => g.getAttribute('aria-label'))
    expect(ordem).toEqual(['Variante A', 'Variante B'])
  })

  it('Gio A1: teste queued não é "early" nem "encerrado": mostra o placar não iniciado', async () => {
    const placar = pl({ iniciado: false, dias_total: 0, atualizado_em: null, variantes: [pv('v-a', { impressoes: null }), pv('v-b', { impressoes: null })] })
    const view = await toDetailView(resultados('queued', placar))
    expect(view.status).not.toBe('completed')
    expect(isEarly(view)).toBe(false)
  })

  it('Gio A2: atrasado mostra uma só data (a do último dia gravado)', () => {
    const { container } = render(
      <PlacarDoTeste
        placar={pl({ atrasado: true, atualizado_em: '2026-10-19T13:19:00Z' })}
        faixaDias={[{ day_pt: '2026-10-18', variante: 'v-a', estado: 'medido', impressoes: 10, ctr: 0.1, motivo: null }]}
        variants={[{ label: 'A', color: '#888', ctr: null, impressions: null, clicks: null, pBest: null }]}
        variantDb={[{ id: 'v-a', label: 'A', is_original: true, blob_url: null }]}
        thumbs={[{ label: 'A', color: '#888', thumbUrl: null, isOriginal: true, titleText: null }]}
        videoTitle="V" status="active"
      />,
    )
    const t = container.textContent ?? ''
    expect(t).toContain('18/10')
    expect(t).not.toContain('19/10')
  })

  it('Yannis 2: falha de leitura vira a cópia do M4 no servidor; outro erro é relançado', async () => {
    getTestResultsMock.mockRejectedValue(new Error('ab_lab_leitura: ab_test_dias: erro_de_banco'))
    const el = await AbTestDetailPage({ params: Promise.resolve({ testId: 'x' }) })
    const { container } = render(<>{el}</>)
    expect(container.textContent).toContain('Não consegui ler o placar agora')
    cleanup()
    getTestResultsMock.mockRejectedValue(new Error('outra coisa'))
    await expect(AbTestDetailPage({ params: Promise.resolve({ testId: 'x' }) })).rejects.toThrow('outra coisa')
  })
})
