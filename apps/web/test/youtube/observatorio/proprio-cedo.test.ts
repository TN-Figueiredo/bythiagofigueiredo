// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiaAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import { estadoCedo, CASAS } from '@/lib/youtube/observatorio/proprio/cedo'

const HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const med = (dia: string, imp: number, cliques: number | null = null): DiaAlcance => ({
  dia, situacao: imp === 0 ? 'zero-medido' : 'com-impressoes', motivo: null, imp, cliques,
})
const nao = (dia: string, motivo: DiaAlcance['motivo'] = 'recente'): DiaAlcance => ({ dia, situacao: 'nao-medido', motivo, imp: null, cliques: null })
/** Dias da publicação até hoje: medidos (zero ou com impressão) até hoje-2; hoje e ontem não chegaram. */
function dias(idade: number, imp: (i: number) => number = () => 0, medidos = true): DiaAlcance[] {
  const out: DiaAlcance[] = []
  for (let a = idade; a >= 0; a--) out.push(a <= 1 || !medidos ? nao(d(a), a <= 1 ? 'recente' : 'sem-relatorio') : med(d(a), imp(idade - a)))
  return out
}

describe('CASAS', () => { it('sete', () => expect(CASAS).toBe(7)) })

describe('tabelinha A: idade, casas e dias que faltam', () => {
  it('17 horas (idade 1): video-novo, faltam 5, dia 7 em publicação + 6', () => {
    const e = estadoCedo({ publicadoEm: d(1), hojePt: HOJE, dias: dias(1) })
    expect(e).toMatchObject({ tipo: 'video-novo', faltam: 5, dia7: addDays(d(1), 6) })
    if (e.tipo !== 'video-novo') throw new Error()
    expect(e.casas).toHaveLength(7)
    expect(e.casas.filter(c => c.dia <= HOJE)).toHaveLength(2)
    expect(e.casas.map(c => c.estado)).toEqual(['dia-nao-chegou', 'dia-nao-chegou', ...Array(5).fill('ainda-nao-existe')])
  })
  it('2 dias (idade 2): video-novo, 3 casas até hoje, faltam 4', () => {
    const e = estadoCedo({ publicadoEm: d(2), hojePt: HOJE, dias: dias(2) })
    expect(e).toMatchObject({ tipo: 'video-novo', faltam: 4, dia7: addDays(d(2), 6) })
    if (e.tipo !== 'video-novo') throw new Error()
    expect(e.casas.filter(c => c.dia <= HOJE)).toHaveLength(3)
  })
  it('3 dias, zeros (idade 3): ainda-cedo, 4 casas até hoje, 2 dias medidos, faltam 3', () => {
    const e = estadoCedo({ publicadoEm: d(3), hojePt: HOJE, dias: dias(3) })
    expect(e).toMatchObject({ tipo: 'ainda-cedo', diasMedidos: 2, faltam: 3, dia7: addDays(d(3), 6) })
    if (e.tipo !== 'ainda-cedo') throw new Error()
    expect(e.casas.map(c => c.estado)).toEqual(['zero-medido', 'zero-medido', 'dia-nao-chegou', 'dia-nao-chegou', 'ainda-nao-existe', 'ainda-nao-existe', 'ainda-nao-existe'])
    expect(e.casas[0]).toMatchObject({ dia: d(3), valor: 0 })
  })
  it('4 dias, zeros (idade 4): 5 casas até hoje, 3 dias medidos, faltam 2', () => {
    const e = estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: dias(4) })
    expect(e).toMatchObject({ tipo: 'ainda-cedo', diasMedidos: 3, faltam: 2 })
  })
  it('4 dias, números (idade 4): grafico com 3 dias medidos, nao soZeros', () => {
    const e = estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: dias(4, i => (i === 1 ? 109 : 0)) })
    expect(e).toEqual({ tipo: 'grafico', soZeros: false, diasMedidos: 3 })
  })
  it('5 dias, zeros (idade 5): 6 casas até hoje, 4 dias medidos, falta 1', () => {
    const e = estadoCedo({ publicadoEm: d(5), hojePt: HOJE, dias: dias(5) })
    expect(e).toMatchObject({ tipo: 'ainda-cedo', diasMedidos: 4, faltam: 1 })
  })
  it('dia 7, zeros (idade 6): grafico soZeros com 5 dias medidos', () => {
    expect(estadoCedo({ publicadoEm: d(6), hojePt: HOJE, dias: dias(6) })).toEqual({ tipo: 'grafico', soZeros: true, diasMedidos: 5 })
  })
  it('8º dia, zeros (idade 7): grafico soZeros com 6 dias', () => {
    expect(estadoCedo({ publicadoEm: d(7), hojePt: HOJE, dias: dias(7) })).toEqual({ tipo: 'grafico', soZeros: true, diasMedidos: 6 })
  })
  it('8º dia, números (idade 7): grafico, não soZeros, 6 dias', () => {
    expect(estadoCedo({ publicadoEm: d(7), hojePt: HOJE, dias: dias(7, i => (i === 2 ? 408 : 0)) })).toEqual({ tipo: 'grafico', soZeros: false, diasMedidos: 6 })
  })
  it('coleta não rodou (idade 4, nenhum dia medido): nao-medido', () => {
    expect(estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: dias(4, () => 0, false) })).toEqual({ tipo: 'nao-medido' })
  })
})

describe('bordas e dado ausente', () => {
  it('publicação nula: nao-medido', () => {
    expect(estadoCedo({ publicadoEm: null, hojePt: HOJE, dias: dias(4) })).toEqual({ tipo: 'nao-medido' })
  })
  it('lista de dias vazia aos 8 dias: nao-medido (sem relatório não se afirma "todos com 0")', () => {
    expect(estadoCedo({ publicadoEm: d(8), hojePt: HOJE, dias: [] })).toEqual({ tipo: 'nao-medido' })
  })
  it('zero dentro da casa é zero-medido, nunca dia-nao-chegou', () => {
    const e = estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: dias(4) })
    if (e.tipo !== 'ainda-cedo') throw new Error()
    expect(e.casas[0]!.estado).toBe('zero-medido')
    expect(e.casas[0]!.valor).toBe(0)
  })
  it('casa com impressões leva o valor', () => {
    const e = estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: dias(4, i => (i === 0 ? 7 : 0)) })
    expect(e.tipo).toBe('grafico')
  })
  it('idade 5 vira grafico no dia seguinte (fronteira 5 e 6)', () => {
    expect(estadoCedo({ publicadoEm: d(5), hojePt: HOJE, dias: dias(5) }).tipo).toBe('ainda-cedo')
    expect(estadoCedo({ publicadoEm: d(6), hojePt: HOJE, dias: dias(6) }).tipo).toBe('grafico')
  })
  it('idade 2 e 3 (fronteira)', () => {
    expect(estadoCedo({ publicadoEm: d(2), hojePt: HOJE, dias: dias(2) }).tipo).toBe('video-novo')
    expect(estadoCedo({ publicadoEm: d(3), hojePt: HOJE, dias: dias(3) }).tipo).toBe('ainda-cedo')
  })
  it('dia anterior à publicação não existe: não entra nos dias medidos nem nas casas', () => {
    const extra = [med(d(10), 500), ...dias(4)]
    const e = estadoCedo({ publicadoEm: d(4), hojePt: HOJE, dias: extra })
    expect(e).toMatchObject({ tipo: 'ainda-cedo', diasMedidos: 3 })
  })
  it('idade 0 (publicado hoje): video-novo, faltam 6', () => {
    expect(estadoCedo({ publicadoEm: HOJE, hojePt: HOJE, dias: [nao(HOJE)] })).toMatchObject({ tipo: 'video-novo', faltam: 6 })
  })
})
