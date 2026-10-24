// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlacarDoTeste } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-do-teste'
import { fraseDoPlacar } from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-texto'
import type { Placar } from '@/lib/youtube/ab-gravacao/placar'

afterEach(() => cleanup())
const dir = join(__dirname, '../../src/app/cms/(authed)/youtube/ab-lab/_components')
const lerArq = (f: string) => readFileSync(join(dir, f), 'utf8')

const pl = (o: Partial<Placar> = {}): Placar => ({
  regra: 'v2', estatistica: 'nao_calculada', variantes: [], dias_total: 0, dias_descartados: 0,
  dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false,
  todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
})

describe('S8-F3 Gio r2', () => {
  it('B1: espaço selo→frase tem UMA fonte (padding-top de .pm4-in = --s5 = 24 px) e o cabeçalho não soma margem', () => {
    const css = lerArq('placar-do-teste.css')
    expect(css).toMatch(/--s5: 24px/)
    expect(css).toMatch(/\.pm4-in \{ padding: var\(--s5\); \}/)
    expect(css).toMatch(/@container \(max-width: 640px\)[^\n]*\.pm4-in \{ padding: var\(--s5\) /)
    expect(css).toMatch(/\.pm4 \.pm4-sum \{ margin: 0 0 var\(--s4\)/) // frase → faixa 16
    expect(css).toMatch(/\.pm4-selos \+ \.pm4-sum \{ margin-top: var\(--s5\)/) // selo da regra antiga: também 24
    expect(lerArq('active-detail.tsx')).toContain('<div data-section="header">')
  })
  it('B2: o relógio de "aguardando" fica inline na mesma linha', () => {
    expect(lerArq('placar-do-teste.css')).toMatch(/\.pm4-vt \.ap svg[^{]*\{ display: inline-block;/)
  })
  it('B3: sem polling quando o teste não começou', () => {
    expect(lerArq('active-detail.tsx')).toContain("view.status === 'active' && view.placar?.iniciado !== false")
  })
  it('B4: pausado não diz "Faltam N dias"; encerrado sem vitória não diz "não há CTR medido"', () => {
    const p = pl({ variantes: [{ variant_id: 'a', dias: 3, dias_validos: 3, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0, dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: 100, impressoes_com_ctr: 100, cliques: 5, ctr: null, views: null }], dias_total: 3 })
    const f = fraseDoPlacar(p, 'paused', [], { dayOf: 9, total: 14 }, {})
    expect(f.apoio).not.toMatch(/Falta/)
    expect(f.apoio).toMatch(/pausado/)
    expect(lerArq('playoff-detail.tsx')).not.toContain('não há CTR medido')
    const { container } = render(<PlacarDoTeste placar={p} faixaDias={[]} variants={[]} variantDb={[]} thumbs={[]} videoTitle="v" status="paused" andamento={{ dayOf: 9, total: 14 }} />)
    expect(container.textContent).not.toMatch(/faltam \d+ dias/i)
  })
})
