// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('@/lib/supabase/service', async () => {
  const { bancoFalso } = await import('../helpers/ab-banco-falso')
  return { getSupabaseServiceClient: () => bancoFalso({}) }
})
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/actions', () => ({
  forceRotate: vi.fn(), applyWinnerNow: vi.fn(), cancelGracePeriod: vi.fn(),
  acknowledgeAbTestDrift: vi.fn(), resumeAbTest: vi.fn(), archiveAbTest: vi.fn(),
}))
vi.mock('@/app/cms/(authed)/youtube/ab-lab/_components/use-poll-stats', () => ({
  usePollStats: () => ({ data: null, loading: false }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { ResumoV2, AndamentoV2, PisosV2, SinalV2 } from '@/app/cms/(authed)/youtube/ab-lab/_components/blocos-v2'
import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { LinhaPisoV2, TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { Placar } from '@/lib/youtube/ab-gravacao/placar'
import type { AbTestActiveView, AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

const L = (letra: 'A' | 'B', volume: number | null, dias: number | null): LinhaPisoV2 => ({
  variant_id: letra === 'A' ? 'v-a' : 'v-b', letra, titulo: `Título ${letra}`, volume, dias_validos: dias,
})
type Ativo = Extract<TelaV2, { fase: 'ativo' }>
const ativoV2 = (o: Partial<Ativo> = {}): Ativo => ({
  fase: 'ativo', dia: 5, teto: 15, pausado: false, passouDoFim: false, ilegivel: false,
  frase: { principal: 'Ainda não decide: faltam impressões.', apoio: 'Cada versão precisa de 10.315; A tem 412 e B tem 388.' },
  n: 10315, pisos: [L('A', 412, 4), L('B', 388, 4)], sinal: null, ...o,
})

describe('T12 T6: blocos do ativo v2', () => {
  it('ativo-sem-volume: "412 de 10.315" e "388 de 10.315", sem % e sem botão Aplicar', () => {
    const t = ativoV2()
    const { container } = render(<><ResumoV2 frase={t.frase} /><AndamentoV2 dia={t.dia} teto={t.teto} pausado={false} /><PisosV2 linhas={t.pisos} n={t.n} final={false} /></>)
    const txt = container.textContent ?? ''
    expect(txt).toContain('Impressões 412 de 10.315')
    expect(txt).toContain('Impressões 388 de 10.315')
    expect(txt).toContain('Falta para decidir')
    expect(txt).not.toContain('%')
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
  })

  it('ativo-antes-pisos: 2x "não medido", nenhum 0 nos pisos', () => {
    const { container } = render(<PisosV2 linhas={[L('A', null, null), L('B', null, null)]} n={10315} final={false} />)
    expect(screen.getAllByText('não medido')).toHaveLength(2)
    const nums = Array.from(container.querySelectorAll('.pv2-pr b')).map(e => e.textContent)
    expect(nums).not.toContain('0')
  })

  it('pausado: "⏸ pausado" e ⓘ sem "encerra sozinho"', () => {
    const { container } = render(<AndamentoV2 dia={5} teto={15} pausado />)
    expect(container.textContent).toContain('⏸ pausado')
    expect(container.textContent).not.toContain('faltam')
    fireEvent.click(screen.getByRole('button', { name: 'Como ler o andamento' }))
    const pop = document.getElementById('flut')
    expect(pop?.textContent).toContain('Um quadrado por dia corrido')
    expect(pop?.textContent).not.toContain('encerra sozinho')
  })

  it('andamento normal: "Dia 5 de 15", "faltam 9 dias", ⓘ abre no #flut com "encerra sozinho depois do dia 15"', () => {
    const { container } = render(<AndamentoV2 dia={5} teto={15} pausado={false} />)
    expect(container.textContent).toContain('Dia 6 de 15')
    expect(container.textContent).toContain('faltam 9 dias')
    fireEvent.click(screen.getByRole('button', { name: 'Como ler o andamento' }))
    expect(document.getElementById('flut')?.textContent).toContain('encerra sozinho depois do dia 15')
    expect(container.querySelectorAll('.pv2-ticks i')).toHaveLength(15)
  })

  it('faltam 1 dia (dia 14 de 15) e último dia (dia 15 de 15)', () => {
    const a = render(<AndamentoV2 dia={13} teto={15} pausado={false} />)
    expect(a.container.textContent).toContain('faltam 1 dia')
    expect(a.container.textContent).not.toContain('faltam 1 dias')
    a.unmount()
    const b = render(<AndamentoV2 dia={15} teto={15} pausado={false} />)
    expect(b.container.textContent).toContain('último dia')
  })

  it('dia > teto: "passou do fim", nunca "faltam -"', () => {
    const { container } = render(<AndamentoV2 dia={17} teto={15} pausado={false} />)
    expect(container.textContent).toContain('Dia 18 · passou do fim (15)')
    expect(container.textContent).not.toMatch(/faltam -/)
  })

  it('n nulo: "piso não calculado", barra sem ✓', () => {
    const { container } = render(<PisosV2 linhas={[L('A', 412, 4), L('B', 388, 4)]} n={null} final={false} />)
    expect(container.textContent).toContain('Impressões 412 de —')
    expect(screen.getAllByText('piso não calculado')).toHaveLength(2)
    expect(container.querySelector('.pv2-ok')).toBeNull()
    expect(container.querySelector('[aria-label="Impressões 412; piso não calculado"]')).not.toBeNull()
  })

  it('piso atingido mostra ✓; final troca os títulos', () => {
    const { container } = render(<PisosV2 linhas={[L('A', 11000, 4), L('B', 9000, 3)]} n={10315} final />)
    expect(container.textContent).toContain('Quanto o teste alcançou')
    expect(container.textContent).toContain('Dias válidos 4 (mínimo 4) ✓')
    expect(container.textContent).toContain('Dias válidos 3 de 4')
    expect(screen.getByRole('button', { name: 'Como ler a régua final' })).toBeTruthy()
  })

  it('ⓘ dos pisos usa o texto do ◆T 10', () => {
    render(<PisosV2 linhas={[L('A', 1, 1)]} n={10315} final={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Como ler os pisos' }))
    const t = document.getElementById('flut')?.textContent ?? ''
    expect(t).toContain('Dias e impressões são somados dos dias válidos do placar; o piso vem da avaliação diária. “—” é não medido, não zero.')
    expect(t).toContain('10.315 impressões')
  })

  it('ativo ilegível: selo ⚠ "Não consegui ler"', () => {
    const t = ativoV2({ ilegivel: true, frase: { principal: 'Não consegui ler a avaliação; este teste não encerra sozinho.', apoio: 'Para decidir agora, use Encerrar.' } })
    const { container } = render(<ResumoV2 frase={t.frase} ilegivel />)
    expect(screen.getByRole('status').textContent).toContain('⚠ Não consegui ler')
    expect(container.textContent).toContain('Não consegui ler a avaliação; este teste não encerra sozinho.')
  })

  it('sinal: texto da linha, classe neutra (sem --ok)', () => {
    const { container } = render(<SinalV2 letra="B" />)
    expect(container.textContent).toContain('Sinal provisório, não decide: B está um pouco à frente.')
    const css = readFileSync(join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components/blocos-v2.css'), 'utf8')
    const regra = css.split('}').find(r => r.includes('.pv2-sinal .l'))!
    expect(regra).not.toMatch(/--cn-ok|--ok/)
    expect(css).not.toMatch(/color-mix/)
  })
})

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
async function ativoView(): Promise<AbTestActiveView> {
  const results = {
    test: makeTestRow({ status: 'active', started_at: new Date(Date.now() - 4 * 86400000).toISOString(), completed_at: null }),
    variants: [vs('v-a', 'original', true), vs('v-b', 'B', false)], confidence: null, is_significant: false, suggested_winner_id: null, timeline: [],
    data_freshness: new Date().toISOString(), placar: pl(), faixa_dias: [],
  } as unknown as AbTestResults
  return (await toDetailView(results)) as AbTestActiveView
}
const acoes = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }

describe('T12 T6: ligação no ActiveDetail e placar modoV2', () => {
  it('v2 ativo: resumo, andamento, pisos e sinal antes do placar; placar sem .pm4-sum e sem seção de andamento', async () => {
    const base = await ativoView()
    const view = { ...base, v2: ativoV2({ sinal: 'B' }) } as AbTestActiveView
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    const pv2 = container.querySelector('.pv2')!
    expect(pv2).not.toBeNull()
    expect(pv2.textContent).toContain('Ainda não decide: faltam impressões.')
    expect(pv2.textContent).toContain('Sinal provisório, não decide: B')
    const placar = container.querySelector('[data-testid="placar-do-teste"]')!
    expect(pv2.compareDocumentPosition(placar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(placar.querySelector('.pm4-sum')).toBeNull()
    expect(container.querySelector('[data-section="andamento"]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
  })

  it('PlacarDoTeste modoV2 esconde .pm4-sum; sem modoV2 mostra', () => {
    const props = { faixaDias: [], variants: [], variantDb: [], thumbs: [], videoTitle: 'V', status: 'active' as const, placar: pl() }
    const a = render(<PlacarDoTeste {...props} modoV2 />)
    expect(a.container.querySelector('.pm4-sum')).toBeNull()
    a.unmount()
    const b = render(<PlacarDoTeste {...props} />)
    expect(b.container.querySelector('.pm4-sum')).not.toBeNull()
  })

  it('teste v1 (v2 ausente): nenhum pv2- e andamento do M4 segue', async () => {
    const view = await ativoView()
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    expect(container.innerHTML).not.toContain('pv2')
    expect(container.querySelector('[data-section="andamento"]')).not.toBeNull()
  })
})
