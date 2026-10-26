// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const cadeia: Record<string, unknown> = {}
for (const m of ['select', 'eq', 'neq', 'not', 'is', 'in', 'gte', 'lt', 'order', 'limit', 'from']) cadeia[m] = vi.fn().mockReturnValue(cadeia)
cadeia.single = vi.fn().mockResolvedValue({ data: null, error: null })
cadeia.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: () => cadeia }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(), acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({ usePollStats: () => ({ data: null, loading: false }) }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => true,
}))

import { toCardView, toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { ActiveTestCard } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-test-card'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { EarlyDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/early-detail'
import { diaDoTeste } from '@/lib/youtube/ab-dia-do-teste'
import { makeTestWithVariants, makeTestRow } from '../helpers/ab-fixtures'
import type { AbTestActiveView, AbTestResults, AbTestCycleRow, VariantStats } from '@/lib/youtube/ab-types'

function stats(id: string, label: string, orig: boolean): VariantStats {
  return { variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig, total_impressions: 100, total_clicks: 5, avg_ctr: 0.05, cycles_completed: 1 }
}
function ciclo(n: number, variantId: string, inicio: string, fim: string | null): AbTestCycleRow {
  return { id: `c${n}`, test_id: 't', variant_id: variantId, cycle_number: n, started_at: inicio, ended_at: fim, impressions: 1, clicks: 1, ctr: 1, estimated_impressions: null, estimated_clicks: null, estimated_ctr: null, backfill_status: 'confirmed', backfill_attempts: 0, applied_metadata: null, created_at: inicio }
}

// Início há 5 dias e 3 h, só 2 ciclos fechados: o dia corrido (5) e os ciclos (2) divergem.
const INICIO = new Date(Date.now() - (5 * 24 + 3) * 3600_000).toISOString()
const FIM = new Date(Date.now() - 3600_000).toISOString()

function resultados(): AbTestResults {
  return {
    test: makeTestRow({ status: 'active', started_at: INICIO, completed_at: null }),
    variants: [stats('v-a', 'original', true), stats('v-b', 'B', false)],
    confidence: 0.5, is_significant: false, suggested_winner_id: null,
    timeline: [ciclo(0, 'v-a', INICIO, INICIO), ciclo(1, 'v-b', INICIO, FIM), ciclo(2, 'v-a', FIM, null)],
    data_freshness: new Date().toISOString(),
    youtubeId: null,
  } as AbTestResults
}

describe('dia do teste: lista, cartão e detalhe mostram o mesmo dia', () => {
  it('detalhe usa dias corridos (não ciclos) no cabeçalho, na faixa e na contagem', async () => {
    const results = resultados()
    const esperado = diaDoTeste(results.test.started_at, results.test.completed_at, new Date())
    expect(esperado).toBe(5)

    const card = toCardView({ ...results.test, variants: [] } as never)
    expect(card.dayOf).toBe(5)
    const cartao = render(<ActiveTestCard test={card} onOpen={() => {}} />)
    expect(cartao.container.textContent).toContain('Dia 6/14')
    cartao.unmount()

    const view = (await toDetailView(results)) as AbTestActiveView
    expect(view.cycles.done).toBeLessThan(5)
    expect(view.dayOf).toBe(5)

    const ativo = render(<ActiveDetail view={view} encerrar={{} as never} pausar={{} as never} />)
    expect(ativo.container.textContent).toContain('Teste do Lab rodando')
    expect(ativo.container.textContent).toContain('faltam 8 dias')
    ativo.unmount()

    const cedo = render(<EarlyDetail view={view} encerrar={{} as never} pausar={{} as never} />)
    expect(cedo.container.textContent).toContain('Dia 6/14')
    expect(cedo.container.textContent).toContain('Dia 6 de 14')
  })
  it('passado da duração, o total acompanha o dia (igual ao cartão)', async () => {
    const results = resultados()
    results.test = makeTestRow({ status: 'active', started_at: new Date(Date.now() - 16 * 86400000).toISOString(), completed_at: null })
    const view = (await toDetailView(results)) as AbTestActiveView
    const ativo = render(<ActiveDetail view={view} encerrar={{} as never} pausar={{} as never} />)
    expect(ativo.container.textContent).toContain('dia 16 de 16')
  })
})
void makeTestWithVariants
