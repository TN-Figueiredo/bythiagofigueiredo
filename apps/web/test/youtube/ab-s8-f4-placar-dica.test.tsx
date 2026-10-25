// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import type { Placar, PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import type { FullChartVariant, VariantDbEntry, VariantThumb } from '@/lib/youtube/ab-types'

afterEach(() => cleanup())

const pv = (id: string): PlacarVariante => ({
  variant_id: id, dias: 1, dias_validos: 1, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
  dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: 5, impressoes_com_ctr: 5, cliques: 1, ctr: 0.2, views: null,
})
const placar: Placar = {
  regra: 'v2', estatistica: 'nao_calculada', variantes: [pv('va'), pv('vb')], dias_total: 4, dias_descartados: 0,
  dias_variante_desconhecida: 0, atualizado_em: '2026-10-20T10:00:00Z', desatualizado: false, atrasado: false,
  todos_finais: false, iniciado: true, proximo_fechamento: null,
}
const fv = (label: 'A' | 'B'): FullChartVariant => ({ label, color: '#888', ctr: null, impressions: null, clicks: null, pBest: null } as FullChartVariant)
const db = (id: string, label: 'A' | 'B'): VariantDbEntry => ({ id, label, is_original: label === 'A', blob_url: null })
const th = (label: 'A' | 'B'): VariantThumb => ({ label, color: '#888', thumbUrl: null, isOriginal: label === 'A', titleText: null })

describe('S8-F4 T3: ⓘ do placar como popover do produto', () => {
  it('abre a caixa no #flut, sem filho novo no placar, e Esc devolve o foco', () => {
    const { container } = render(
      <PlacarDoTeste placar={placar} faixaDias={[]} status="active" videoTitle="V" variants={[fv('A'), fv('B')]} variantDb={[db('va', 'A'), db('vb', 'B')]} thumbs={[th('A'), th('B')]} />,
    )
    const antes = container.querySelectorAll('*').length
    const btn = screen.getByRole('button', { name: 'Como ler o placar' })
    btn.focus()
    fireEvent.click(btn)
    const flut = document.getElementById('flut')
    expect(flut).not.toBeNull()
    expect(flut!.querySelector('h3')!.textContent).toBe('Como ler este placar')
    expect(container.contains(flut)).toBe(false)
    expect(container.querySelectorAll('*').length).toBe(antes)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(btn)
  })
})
