// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('@/lib/supabase/service', async () => {
  const { bancoFalso } = await import('../helpers/ab-banco-falso')
  return { getSupabaseServiceClient: () => bancoFalso({}) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(), revertWinner: vi.fn(), archiveAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: () => ({ data: null, loading: false }),
}))

import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { AbTestActiveView, AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())
const ACOES = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

function vs(id: string, label: string, original: boolean, ctr: number): VariantStats {
  return {
    variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: original,
    total_impressions: 4000, total_clicks: Math.round(4000 * ctr), avg_ctr: ctr, impressoes_com_ctr: 4000, cycles_completed: 2,
  }
}
async function vista(): Promise<AbTestActiveView> {
  const r = {
    test: makeTestRow({ id: 't1', status: 'active' }),
    variants: [vs('v-a', 'original', true, 0.05), vs('v-b', 'B', false, 0.08)],
    confidence: null, is_significant: false, suggested_winner_id: null, timeline: [], data_freshness: new Date().toISOString(),
    placar: { regra: 'v1', estatistica: 'nao_calculada', variantes: [], dias_total: 8, dias_descartados: 0, dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false, todos_finais: false, iniciado: true, proximo_fechamento: null },
    faixa_dias: [],
  } as unknown as AbTestResults
  return (await toDetailView(r)) as AbTestActiveView
}

describe('S8-F3 T3: tela sem estatística', () => {
  it('6: faixa provável de CTR fica fechada mesmo com medição completa', async () => {
    const view = await vista()
    const { container } = render(<ActiveDetail view={view} {...ACOES} />)
    expect(container.textContent).not.toContain('Faixa provável de CTR')
  })

  it('7: sem líder por padrão (I2): sem hero e sem destaque de líder', async () => {
    const view = await vista()
    const { container, queryByTestId } = render(<ActiveDetail view={view} {...ACOES} />)
    expect(queryByTestId('hero-band')).toBeNull()
    expect(container.textContent).not.toContain('Líder atual')
    expect(container.querySelectorAll('[data-leader="true"], [aria-label*="líder" i]').length).toBe(0)
  })
})
