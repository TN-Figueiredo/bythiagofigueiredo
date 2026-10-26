// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/supabase/service', async () => {
  const { bancoFalso } = await import('../helpers/ab-banco-falso')
  return { getSupabaseServiceClient: () => bancoFalso({}) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }), useParams: () => ({ testId: 't1' }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(), revertWinner: vi.fn(), archiveAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: () => ({ data: null, loading: false }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import Carregando from '@/app/cms/(authed)/youtube/ab-lab/[testId]/loading'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { Placar } from '@/lib/youtube/ab-gravacao/placar'
import type { AbTestActiveView, AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

const BASE = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab')
const lerCss = (f: string) => readFileSync(join(BASE, f), 'utf8')

function pl(o: Partial<Placar> = {}): Placar {
  return {
    regra: 'v2', estatistica: 'nao_calculada', variantes: [], dias_total: 0, dias_descartados: 0,
    dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false,
    todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
  }
}
const vs = (id: string, label: string, orig: boolean): VariantStats => ({
  variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig,
  total_impressions: 4000, total_clicks: 200, avg_ctr: 0.05, impressoes_com_ctr: 4000, cycles_completed: 2,
})
async function ativo(dias: number, placar: Placar): Promise<AbTestActiveView> {
  const results = {
    test: makeTestRow({ status: 'active', started_at: new Date(Date.now() - (dias - 1) * 86400000 - 3600000).toISOString(), completed_at: null }),
    variants: [vs('v-a', 'original', true), vs('v-b', 'B', false)], confidence: null, is_significant: false, suggested_winner_id: null, timeline: [],
    data_freshness: new Date().toISOString(), placar, faixa_dias: [],
  } as unknown as AbTestResults
  return (await toDetailView(results)) as AbTestActiveView
}
const acoes = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

describe('S8-F3 T5b: cabeçalho, datas, andamento, carregando', () => {
  it('cabeçalho do detalhe do teste: rastro, miniatura, selo do Lab em uma peça', async () => {
    const view = await ativo(5, pl())
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    const h = container.querySelector('header.dhl')!
    expect(h).not.toBeNull()
    expect(h.querySelector('.dhl-crumb')).not.toBeNull()
    expect(h.querySelector('.dhl-th')).not.toBeNull()
    const selo = h.querySelector('.dhl-selo')!
    expect(selo.textContent).toBe(`Teste do Lab rodando, dia ${view.dayOf} de ${Math.max(view.dayOf, view.durationDays)}`)
    expect(h.querySelector('h2')).not.toBeNull()
  })

  it('"O primeiro dia fecha até DD/MM" usa proximo_fechamento; nulo cai na frase genérica', () => {
    const props = { faixaDias: [], variants: [], variantDb: [], thumbs: [], videoTitle: 'V', status: 'active' as const }
    const a = render(<PlacarDoTeste {...props} placar={pl({ proximo_fechamento: '2026-11-03' })} />)
    expect(a.container.textContent).toContain('O primeiro dia fecha até 03/11.')
    a.unmount()
    const b = render(<PlacarDoTeste {...props} placar={pl()} />)
    expect(b.container.textContent).toContain('O primeiro dia fecha até 10 dias depois do início.')
  })

  it('régua "Andamento do teste": dias do prazo, faltam X dias, sem volume', async () => {
    const view = await ativo(5, pl())
    const total = Math.max(view.dayOf, view.durationDays)
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    const r = container.querySelector('[data-section="andamento"]')!
    expect(r).not.toBeNull()
    expect(r.textContent).toContain('Andamento do teste')
    expect(r.textContent).toContain(`dia ${view.dayOf} de ${total}`)
    expect(r.textContent).toContain(`faltam ${total - view.dayOf} dias`)
    expect(r.textContent).not.toMatch(/impress|%/)
    expect(container.querySelector('[data-section="lock-countdown"]')).toBeNull()
  })

  it('régua: no último dia diz "último dia"', async () => {
    const view = await ativo(16, pl())
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    expect(container.querySelector('[data-section="andamento"]')!.textContent).toContain('último dia')
  })

  it('esqueleto de carregamento: role status, sem animação sob prefers-reduced-motion, sem hex solto', () => {
    const { container } = render(<Carregando />)
    const st = container.querySelector('[role="status"]')!
    expect(st.textContent).toContain('Carregando o placar')
    expect(container.querySelectorAll('.skdias, .skrow').length).toBe(0)
    const css = lerCss('_components/placar-esqueleto.css')
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.sk[^}]*animation:\s*none/)
    for (const f of ['_components/placar-esqueleto.css', '_components/detail-header-lab.css']) {
      const c = lerCss(f)
      expect(c).not.toMatch(/color-mix/)
      expect(c).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })
})
