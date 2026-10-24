// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'

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
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { WinnerDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/winner-detail'
import ErroDaRota from '@/app/cms/(authed)/youtube/ab-lab/error'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { Placar, PlacarVariante, DiaDaFaixa } from '@/lib/youtube/ab-gravacao/placar'
import type { AbTestActiveView, AbTestResults, AbTestWinnerView, FullChartVariant, VariantDbEntry, VariantThumb, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

function pv(id: string, o: Partial<PlacarVariante> = {}): PlacarVariante {
  return {
    variant_id: id, dias: 0, dias_validos: 0, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
    dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: null, impressoes_com_ctr: null, cliques: null, ctr: null, views: null, ...o,
  }
}
function pl(o: Partial<Placar> = {}): Placar {
  return {
    regra: 'v2', estatistica: 'nao_calculada', variantes: [pv('va'), pv('vb')], dias_total: 4, dias_descartados: 0,
    dias_variante_desconhecida: 0, atualizado_em: '2026-10-20T10:00:00Z', desatualizado: false, atrasado: false,
    todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
  }
}
const fv = (label: 'A' | 'B' | 'C' | 'D'): FullChartVariant =>
  ({ label, color: '#888', ctr: null, impressions: null, clicks: null, pBest: null } as FullChartVariant)
const db = (id: string, label: 'A' | 'B' | 'C' | 'D'): VariantDbEntry => ({ id, label, is_original: label === 'A', blob_url: null })
const th = (label: 'A' | 'B' | 'C' | 'D'): VariantThumb => ({ label, color: '#888', thumbUrl: null, isOriginal: label === 'A', titleText: null })
const dia = (day_pt: string, variante: string | null, estado: DiaDaFaixa['estado'], impressoes: number | null = 10, ctr: number | null = 0.1): DiaDaFaixa =>
  ({ day_pt, variante, estado, impressoes, ctr, motivo: null })

function renderPlacar(p: Placar | null, faixa: DiaDaFaixa[] = [], labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B'], status: 'active' | 'completed' = 'active') {
  const ids = { A: 'va', B: 'vb', C: 'vc', D: 'vd' }
  return render(
    <PlacarDoTeste
      placar={p} faixaDias={faixa} status={status} videoTitle="Meu vídeo"
      variants={labels.map(fv)} variantDb={labels.map(l => db(ids[l], l))} thumbs={labels.map(th)}
    />,
  )
}

describe('S8-F3 T5: tela do placar', () => {
  it('1 (C-10): zero_medido aparece como 0; aguardando e não medido são contados à parte, nunca um pelo outro', () => {
    const p = pl({
      variantes: [
        pv('va', { dias: 3, dias_zero: 1, dias_aguardando: 1, dias_nao_medidos: 1, impressoes: 0, impressoes_com_ctr: 0, cliques: 0 }),
        pv('vb', { dias: 1, dias_validos: 1, impressoes: 40, impressoes_com_ctr: 40, cliques: 4, ctr: 0.1 }),
      ],
    })
    const faixa = [dia('2026-10-18', 'va', 'zero_medido', 0, null), dia('2026-10-19', 'va', 'aguardando', null, null), dia('2026-10-20', 'va', 'nao_medido', null, null), dia('2026-10-18', 'vb', 'medido')]
    const { container } = renderPlacar(p, faixa)
    const cel = (r: RegExp) => Array.from(container.querySelectorAll('[role="listitem"]')).filter(e => r.test(e.getAttribute('aria-label') ?? ''))
    expect(cel(/zero medido/)).toHaveLength(1)
    expect(cel(/zero medido/)[0]!.textContent).toContain('0')
    expect(cel(/aguardando o YouTube/)).toHaveLength(1)
    expect(cel(/aguardando o YouTube/)[0]!.textContent).not.toMatch(/(^|[^*\d])0($|[^*\d])/)
    expect(cel(/não medido/)).toHaveLength(1)
    const linhaA = screen.getByRole('group', { name: 'Variante A' })
    expect(linhaA.textContent).toContain('1 aguardando o YouTube')
    expect(linhaA.textContent).toContain('1 não medido')
  })

  it('2 (C-11): teste v1 com números mostra impressões e cliques, selo "regra antiga" e nada de vencedor, chance ou faixa', () => {
    const p = pl({ regra: 'v1', variantes: [pv('va', { impressoes: 1190, impressoes_com_ctr: 1190, cliques: 52, ctr: 0.044, dias_validos: 4 }), pv('vb', { impressoes: 1150, impressoes_com_ctr: 1150, cliques: 58, ctr: 0.05, dias_validos: 4 })] })
    const { container } = renderPlacar(p)
    const t = container.textContent ?? ''
    expect(t).toContain('Regra antiga')
    expect(t).toContain('1.190')
    expect(t).toContain('58')
    expect(t).not.toMatch(/vencedor|chance|faixa provável|líder|vs A/i)
  })

  it('2b (C-11): ActiveDetail e WinnerDetail com placar v1 não mostram hero nem vencedor na seção do placar', async () => {
    const vs = (id: string, label: string, orig: boolean): VariantStats => ({
      variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig,
      total_impressions: 4000, total_clicks: 200, avg_ctr: 0.05, impressoes_com_ctr: 4000, cycles_completed: 2,
    })
    const placar = pl({ regra: 'v1', variantes: [pv('v-a', { impressoes: 4000, impressoes_com_ctr: 4000, cliques: 200, ctr: 0.05 }), pv('v-b', { impressoes: 4000, impressoes_com_ctr: 4000, cliques: 200, ctr: 0.05 })] })
    const r = (status: 'active' | 'completed') => ({
      test: makeTestRow({ id: `t-${status}`, status, ...(status === 'completed' ? { winner_variant_id: 'v-b', completed_reason: 'manual_winner' as const } : {}) }),
      variants: [vs('v-a', 'original', true), vs('v-b', 'B', false)],
      confidence: null, is_significant: false, suggested_winner_id: null, timeline: [], data_freshness: new Date().toISOString(),
      placar, faixa_dias: [],
    }) as unknown as AbTestResults
    const ativo = (await toDetailView(r('active'))) as AbTestActiveView
    const a = render(<ActiveDetail view={ativo} encerrar={vi.fn()} pausar={vi.fn()} retomar={vi.fn()} />)
    expect(a.queryByTestId('hero-band')).toBeNull()
    const secA = a.container.querySelector('[data-section="variant-performance"]')!
    expect(secA.textContent).toContain('Regra antiga')
    expect(secA.textContent).not.toMatch(/vencedor|chance|faixa provável|líder/i)
    expect(a.container.textContent).not.toContain('CTR diário')
    cleanup()
    const enc = (await toDetailView(r('completed'))) as AbTestWinnerView
    const w = render(<WinnerDetail view={enc} />)
    const secW = w.container.querySelector('[data-testid="scoreboard"]')!
    expect(secW.textContent).toContain('Regra antiga')
    expect(secW.textContent).toContain('4.000')
    expect(secW.textContent).not.toMatch(/chance|faixa provável|vs A/i)
  })

  it('3a: desatualizado mostra o aviso com a hora', () => {
    const { container } = renderPlacar(pl({ desatualizado: true, atualizado_em: '2026-10-20T13:40:00Z' }))
    expect(container.textContent).toMatch(/Dados parados desde 20\/10 às 10:40/)
  })
  it('3b: sem linha e não atrasado diz "ainda sem dia fechado"; atrasado diz "fora de hora" e nunca o primeiro nem "não medido"', () => {
    const a = renderPlacar(pl({ dias_total: 0, atualizado_em: null }))
    expect(a.container.textContent).toMatch(/ainda não fechou nenhum dia|Sem dia fechado/)
    expect(a.container.textContent).not.toContain('Dados do YouTube fora de hora')
    cleanup()
    const b = renderPlacar(pl({ dias_total: 0, atualizado_em: null, atrasado: true }))
    expect(b.container.textContent).toContain('Dados do YouTube fora de hora')
    expect(b.container.textContent).toContain('não rodaram desde o início')
    expect(b.container.textContent).not.toMatch(/Sem dia fechado|ainda não fechou/)
    expect(b.container.textContent).not.toContain('não medido')
    cleanup()
    const c = renderPlacar(pl({ atrasado: true }), [dia('2026-10-21', 'va', 'medido')])
    expect(c.container.textContent).toContain('Dados do YouTube fora de hora')
    expect(c.container.textContent).toContain('21/10')
    expect(c.container.textContent).not.toMatch(/Sem dia fechado/)
  })

  it('4: erro de leitura mostra a tela de erro e nenhum "não medido"', () => {
    const { container } = render(<ErroDaRota error={new Error('ab_lab_leitura: ab_test_dias: boom')} reset={vi.fn()} />)
    expect(container.textContent).toContain('Não consegui ler o placar agora')
    expect(container.textContent).toContain('o teste não foi alterado')
    expect(container.textContent).not.toContain('não medido')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
  it('4b: erro de outra rota segue genérico', () => {
    const { container } = render(<ErroDaRota error={new Error('outra coisa')} reset={vi.fn()} />)
    expect(container.textContent).toContain('Algo deu errado')
  })

  it('5: a tabela segue a ordem fixa A, B, C, D mesmo com a entrada embaralhada (sem ordem por CTR)', () => {
    const placar = pl({ variantes: [
      pv('vd', { impressoes: 9, impressoes_com_ctr: 9, cliques: 9, ctr: 1 }), pv('vb', { impressoes: 9, impressoes_com_ctr: 9, cliques: 0, ctr: 0 }),
      pv('va', { impressoes: 9, impressoes_com_ctr: 9, cliques: 3, ctr: 0.33 }), pv('vc', { impressoes: 9, impressoes_com_ctr: 9, cliques: 5, ctr: 0.5 }),
    ] })
    renderPlacar(placar, [], ['D', 'B', 'A', 'C'])
    const ordem = screen.getAllByRole('group', { name: /^Variante [A-D]$/ }).map(g => g.getAttribute('aria-label'))
    expect(ordem).toEqual(['Variante A', 'Variante B', 'Variante C', 'Variante D'])
  })

  it('6: teste não iniciado não mostra "sem dia fechado"; v1 não monta hero', () => {
    const { container } = renderPlacar(pl({ iniciado: false, dias_total: 0, atualizado_em: null }))
    expect(container.textContent).not.toMatch(/Sem dia fechado|ainda não fechou/)
    expect(container.textContent).toContain('ainda não começou')
    expect(container.querySelector('[data-testid="hero-band"]')).toBeNull()
  })

  it('7: CTR nunca fica só: contagem "1 de 3" na linha, % só ao abrir; cliques nulos nunca viram 0', () => {
    const p = pl({ variantes: [
      pv('va', { impressoes: 3, impressoes_com_ctr: 3, cliques: 1, ctr: 1 / 3, dias_validos: 1 }),
      pv('vb', { impressoes: 5000, impressoes_com_ctr: 0, cliques: null, dias_fora_do_ctr: 3 }),
    ] })
    renderPlacar(p)
    const a = screen.getByRole('group', { name: 'Variante A' })
    expect(a.textContent).toMatch(/1\s*de\s*3/)
    expect(a.textContent).not.toContain('%')
    const b = screen.getByRole('group', { name: 'Variante B' })
    expect(b.textContent).toContain('5.000')
    expect(b.textContent).toContain('não medido')
    fireEvent.click(within(a).getByRole('button', { name: /Detalhes da variante A/ }))
    expect(document.body.textContent).toContain('33,3%')
  })

  it('8: ⓘ tem rótulo próprio, abre o balão e Esc fecha devolvendo o foco', () => {
    renderPlacar(pl({ variantes: [pv('va', { impressoes: 3, impressoes_com_ctr: 3, cliques: 1 }), pv('vb', { impressoes: 2, impressoes_com_ctr: 2, cliques: 0 })] }), [dia('2026-10-18', 'va', 'medido')])
    const btn = screen.getByRole('button', { name: 'Como ler o placar' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    btn.focus()
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(btn.getAttribute('aria-controls')!)!.hasAttribute('hidden')).toBe(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(btn)
  })

  it('9: dias descartados e variante desconhecida entram juntos na linha de apoio, com o rótulo "troca ou dia parcial"', () => {
    const { container } = renderPlacar(pl({ dias_descartados: 2, dias_variante_desconhecida: 1, variantes: [pv('va', { impressoes: 1, impressoes_com_ctr: 1, cliques: 0 }), pv('vb', { impressoes: 1, impressoes_com_ctr: 1, cliques: 0 })] }))
    expect(container.textContent).toContain('3 dias de troca ou dia parcial, fora do placar')
  })
})
