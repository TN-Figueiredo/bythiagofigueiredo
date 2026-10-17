// T22a-1: faixas e marcas das trocas no modelo do gráfico. Sem as opções a view é a de sempre; com elas, recorte, linhas das marcas e frases.
import { describe, it, expect } from 'vitest'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import type { DiaYt } from '@/lib/youtube/observatorio/proprio/tipos'
import { buildImpressoes, linhasDasMarcas, FAIXA_ALTURA_PX, type FaixaDoGrafico, type MarcaDoGrafico } from '@/app/cms/(authed)/youtube/competitors/_proprio/impressoes-model'

const dm = (d: DiaYt) => d.slice(8, 10) + '/' + d.slice(5, 7)
const d = (n: number): DiaYt => `2026-10-${String(n).padStart(2, '0')}`
const dias: DiaAlcance[] = Array.from({ length: 10 }, (_, i) => ({ dia: d(i + 1), situacao: 'com-impressoes', motivo: null, imp: 10 + i, cliques: 1 }))
const periodo = { de: d(1), ate: d(10), dias: 10 }
const O = { escopo: 'video' as const, alturaArea: 180, dm, acesso: 'ok' as const, hoje: d(12) }
const ab = (de: DiaYt | null, ate: DiaYt | null, dentes: DiaYt[] = []): FaixaDoGrafico => ({ k: 'cheia', de, ate, dentes, rot: 'em teste A/B', rotCurto: 'teste A/B', fala: 'em teste A/B' })
const reg = (ate: DiaYt): FaixaDoGrafico => ({ k: 'pontilhada', de: null, ate, dentes: [], rot: 'antes do registro', rotCurto: 'antes do registro', fala: 'antes do início do registro' })
const marca = (dia: DiaYt, n: number): MarcaDoGrafico => ({ dia, n, forma: 'losango', fala: `troca (${n})` })

describe('sem as opções a view não muda', () => {
  it('campos novos vazios e o resto igual ao de passar listas vazias', () => {
    const a = buildImpressoes(dias, periodo, O)
    const b = buildImpressoes(dias, periodo, { ...O, faixas: [], marcas: [], notaFaixas: null })
    expect(a).toEqual(b)
    expect(a.faixas).toEqual([]); expect(a.marcas).toEqual([]); expect(a.alturaFaixas).toBe(0); expect(a.notaFaixas).toBeNull()
    expect(a.legenda.some(l => l.situacao === 'faixa-cheia')).toBe(false)
  })
})
describe('faixas', () => {
  it('recorta nos dias do gráfico, com dentes e seta de aberta', () => {
    const v = buildImpressoes(dias, periodo, { ...O, faixas: [ab('2026-09-28', null, [d(4), d(7)])] })
    expect(v.faixas).toEqual([expect.objectContaining({ k: 'cheia', i0: 0, i1: 9, dentes: [3, 6], aberta: true })])
    expect(v.alturaFaixas).toBe(FAIXA_ALTURA_PX)
  })
  it('faixa toda fora some, inclusive da legenda', () => {
    const v = buildImpressoes(dias, periodo, { ...O, faixas: [ab('2026-09-01', '2026-09-20'), reg('2026-09-30')] })
    expect(v.faixas).toEqual([]); expect(v.alturaFaixas).toBe(0)
    expect(v.legenda.some(l => l.situacao === 'faixa-cheia' || l.situacao === 'faixa-pontilhada')).toBe(false)
  })
  it('dois tipos: 48 px e um item de legenda por tipo; a pontilhada recorta pelo fim', () => {
    const v = buildImpressoes(dias, periodo, { ...O, faixas: [ab(d(5), d(8)), reg(d(3))] })
    expect(v.alturaFaixas).toBe(48)
    expect(v.faixas.find(f => f.k === 'pontilhada')).toMatchObject({ i0: 0, i1: 2, aberta: false })
    expect(v.faixas.find(f => f.k === 'cheia')).toMatchObject({ i0: 4, i1: 7, aberta: false })
    expect(v.legenda.filter(l => l.situacao === 'faixa-cheia' || l.situacao === 'faixa-pontilhada')).toHaveLength(2)
  })
  it('a frase do dia leva a da faixa só nos dias dela; a tabela também', () => {
    const v = buildImpressoes(dias, periodo, { ...O, faixas: [ab(d(5), d(6))] })
    expect(v.colunas[4]!.dica).toContain('em teste A/B'); expect(v.colunas[4]!.situacaoTexto).toContain('em teste A/B')
    expect(v.colunas[3]!.dica).not.toContain('teste A/B')
  })
})
describe('G-3 e M-3: a legenda só cita o que o gráfico desenha', () => {
  const zeros: DiaAlcance[] = dias.map(x => ({ ...x, imp: 0, cliques: 0 }))
  it('gráfico só de zeros com teste e troca: nem faixa, nem marca, nem "teste A/B" nem ▲/◆ na legenda', () => {
    const v = buildImpressoes(zeros, periodo, { ...O, cedo: { tipo: 'grafico', soZeros: true, diasMedidos: 10 }, faixas: [ab(d(3), null)], marcas: [marca(d(4), 1)] })
    expect(v.soZeros).toBe(true)
    expect(v.faixas).toEqual([]); expect(v.marcas).toEqual([])
    expect(v.legenda.map(l => l.texto).join('|')).not.toMatch(/teste A\/B|troca de/)
    expect(v.legenda.some(l => l.situacao === 'faixa-cheia' || l.situacao.startsWith('marca-'))).toBe(false)
  })
  it('com marcas desenhadas a legenda explica ◆ (título) e ▲ (thumbnail), uma vez cada', () => {
    const v = buildImpressoes(dias, periodo, { ...O, marcas: [marca(d(4), 1), marca(d(6), 2), { ...marca(d(8), 3), forma: 'triangulo' }] })
    expect(v.legenda.filter(l => l.situacao === 'marca-losango')).toEqual([{ situacao: 'marca-losango', texto: 'troca de título' }])
    expect(v.legenda.filter(l => l.situacao === 'marca-triangulo')).toHaveLength(1)
  })
})
describe('marcas', () => {
  it('marca fora dos dias some; dentro leva a frase no dia', () => {
    const v = buildImpressoes(dias, periodo, { ...O, marcas: [marca(d(3), 1), marca('2026-09-01', 2)], notaFaixas: 'nota' })
    expect(v.marcas).toEqual([expect.objectContaining({ i: 2, n: 1 })])
    expect(v.colunas[2]!.dica).toContain('troca (1)'); expect(v.notaFaixas).toBe('nota')
  })
  it('27 px desce uma linha, 28 px fica na mesma', () => {
    expect(linhasDasMarcas([0, 27])).toEqual([0, 1])
    expect(linhasDasMarcas([0, 28])).toEqual([0, 0])
    expect(linhasDasMarcas([0, 10, 20])).toEqual([0, 1, 2])
  })
})
