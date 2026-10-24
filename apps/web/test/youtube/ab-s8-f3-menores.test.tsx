// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

import { ActiveDetail } from '@/app/cms/(authed)/youtube/ab-lab/_components/active-detail'
import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import Carregando from '@/app/cms/(authed)/youtube/ab-lab/[testId]/loading'
import { toDetailView } from '@/app/cms/(authed)/youtube/ab-lab/queries'
import { fraseDoPlacar } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-texto'
import { makeTestRow } from '../helpers/ab-fixtures'
import type { Placar, PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import type { AbTestActiveView, AbTestResults, VariantStats } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

const pv = (id: string, o: Partial<PlacarVariante> = {}): PlacarVariante => ({
  variant_id: id, dias: 0, dias_validos: 0, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
  dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: null, impressoes_com_ctr: null, cliques: null, ctr: null, views: null, ...o,
})
const pl = (o: Partial<Placar> = {}): Placar => ({
  regra: 'v2', estatistica: 'nao_calculada', variantes: [], dias_total: 0, dias_descartados: 0,
  dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false,
  todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
})
const vs = (id: string, label: string, orig: boolean): VariantStats => ({
  variant_id: id, label, blob_url: null, title_text: null, metadata: {}, is_original: orig,
  total_impressions: 4000, total_clicks: 200, avg_ctr: 0.05, impressoes_com_ctr: 4000, cycles_completed: 2,
})
async function ativo(placar: Placar): Promise<AbTestActiveView> {
  const results = {
    test: makeTestRow({ status: 'active', started_at: new Date(Date.now() - 3600000).toISOString(), completed_at: null }),
    variants: [vs('v-a', 'original', true), vs('v-b', 'B', false)], confidence: null, is_significant: false, suggested_winner_id: null, timeline: [],
    data_freshness: new Date().toISOString(), placar, faixa_dias: [],
  } as unknown as AbTestResults
  return (await toDetailView(results)) as AbTestActiveView
}
const acoes = { encerrar: vi.fn(), pausar: vi.fn(), retomar: vi.fn() }
const antes = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('S8-F3: menores do Gio (A3 a A6)', () => {
  it('A3: a linha da variante diz "N aguardando" + ◷, sem "o YouTube" que quebrava o ícone', () => {
    const { container } = render(
      <PlacarDoTeste placar={pl({ dias_total: 2, variantes: [pv('va', { dias: 2, dias_aguardando: 2, impressoes: 10, impressoes_com_ctr: 10, cliques: 1, ctr: 0.1 })] })}
        faixaDias={[]} variants={[{ label: 'A', color: '#888', ctr: null, impressions: null, clicks: null, pBest: null } as never]}
        variantDb={[{ id: 'va', label: 'A', is_original: true, blob_url: null }]} thumbs={[]} videoTitle="V" status="active" />,
    )
    const ap = container.querySelector('.pm4-vt .ap')!
    expect(ap.textContent).toContain('2 aguardando')
    expect(ap.textContent).not.toContain('o YouTube')
    expect(ap.querySelector('svg')).not.toBeNull()
  })

  it('A4: subfrase do não medido é a do mockup, com rótulos; sem rótulos cai na genérica', () => {
    const p = pl({ dias_total: 6, variantes: [
      pv('va', { dias: 3, impressoes: 0, impressoes_com_ctr: 0, cliques: 0 }),
      pv('vb', { dias: 3, impressoes: 5000, impressoes_com_ctr: 0, cliques: null }),
    ] })
    expect(fraseDoPlacar(p, 'active', [], undefined, { va: 'A', vb: 'B' }).apoio).toBe('A teve 0 impressões nos dias medidos; o CTR de B não veio.')
    expect(fraseDoPlacar(p, 'active').apoio).toContain('não são mostrados como 0')
  })

  it('A5: hoje, sem dia fechado, mostra a faixa "Dias do teste" com uma célula pendente ◷', () => {
    const { container } = render(
      <PlacarDoTeste placar={pl({ variantes: [pv('va'), pv('vb')] })} faixaDias={[]} variants={[]} variantDb={[]} thumbs={[]} videoTitle="V" status="active" />,
    )
    const dias = container.querySelector('.pm4-dias')!
    expect(dias).not.toBeNull()
    expect(dias.textContent).toContain('Dias do teste')
    expect(dias.querySelectorAll('.pm4-dc.g')).toHaveLength(1)
  })

  it('A5: atrasado sem nenhum dia gravado não ganha a célula de hoje', () => {
    const { container } = render(
      <PlacarDoTeste placar={pl({ atrasado: true })} faixaDias={[]} variants={[]} variantDb={[]} thumbs={[]} videoTitle="V" status="active" />,
    )
    expect(container.querySelector('.pm4-dias')).toBeNull()
  })

  it('A6: selo, frase e faixa vêm antes dos botões e do Sinal ao vivo', async () => {
    const view = await ativo(pl())
    const { container } = render(<ActiveDetail view={view} {...acoes} />)
    const selo = container.querySelector('.dhl-selo')!
    const frase = container.querySelector('.pm4-sum')!
    const faixa = container.querySelector('.pm4-band')!
    const botoes = container.querySelector('[data-section="acoes"]')!
    const sinal = Array.from(container.querySelectorAll('span')).find(e => e.textContent === 'Sinal ao vivo')!
    expect(botoes).not.toBeNull()
    expect(container.querySelector('header.dhl .dhl-acoes')).toBeNull()
    expect(antes(selo, frase)).toBe(true)
    expect(antes(frase, faixa)).toBe(true)
    expect(antes(faixa, botoes)).toBe(true)
    expect(antes(faixa, sinal)).toBe(true)
    expect(botoes.textContent).toContain('Pausar')
  })
})
