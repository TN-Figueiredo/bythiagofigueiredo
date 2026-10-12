// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  CONFERENCIAS, DIAS_ATE_O_VERMELHO, conferenciasEmFalha, conferenciasVencidas, diasDeAtraso, hojeSP, type Conferencia,
} from '@/lib/conferencias'

const c = (extra: Partial<Conferencia> = {}): Conferencia => ({ id: 'x-d7', etapa: 'EX', data: '2020-03-10', responsavel: 'agente', onde: 'plano X', feitaEm: null, ...extra })

describe('conferências com data (item 246)', () => {
  it('na véspera e no próprio dia não está vencida; no dia seguinte está, com o nome', () => {
    expect(conferenciasVencidas('2020-03-09', [c()])).toEqual([])
    expect(conferenciasVencidas('2020-03-10', [c()])).toEqual([])
    expect(conferenciasVencidas('2020-03-11', [c()]).map(x => x.id)).toEqual(['x-d7'])
  })
  it('com a data de feita, nunca mais aparece', () => {
    expect(conferenciasVencidas('2030-01-01', [c({ feitaEm: '2020-03-12' })])).toEqual([])
    expect(conferenciasEmFalha('2030-01-01', [c({ feitaEm: '2020-03-12' })])).toEqual([])
  })
  it('lista vazia: nenhuma vencida, nenhuma em falha', () => {
    expect(conferenciasVencidas('2030-01-01', [])).toEqual([])
    expect(conferenciasEmFalha('2030-01-01', [])).toEqual([])
  })
  it('o dia é o de São Paulo: 02:59 UTC ainda é o dia anterior', () => {
    expect(hojeSP(new Date('2020-03-11T02:59:00Z'))).toBe('2020-03-10')
    expect(hojeSP(new Date('2020-03-11T03:00:00Z'))).toBe('2020-03-11')
  })
  it('dias de atraso: hoje menos a data devida, em dias de calendário (virada de mês, ano bissexto e ano novo)', () => {
    expect(diasDeAtraso('2020-03-10', c())).toBe(0)
    expect(diasDeAtraso('2020-03-17', c())).toBe(7)
    expect(diasDeAtraso('2020-03-01', c({ data: '2020-02-28' }))).toBe(2)
    expect(diasDeAtraso('2021-01-02', c({ data: '2020-12-31' }))).toBe(2)
    expect(diasDeAtraso('2020-03-09', c())).toBe(-1)
  })
  it('a decisão do controlador: vencida há 7 dias fica só no resumo; há 8 dias é falha', () => {
    expect(DIAS_ATE_O_VERMELHO).toBe(7)
    const lista = [c()]
    expect(conferenciasVencidas('2020-03-17', lista).map(x => x.id)).toEqual(['x-d7'])   // 7 dias: vencida
    expect(conferenciasEmFalha('2020-03-17', lista)).toEqual([])                          // ...mas ainda sem vermelho
    expect(conferenciasEmFalha('2020-03-18', lista).map(x => x.id)).toEqual(['x-d7'])    // 8 dias: vermelho
    expect(conferenciasEmFalha('2020-03-11', lista)).toEqual([])                          // 1 dia: sem vermelho
  })
  it('vencida há muito tempo continua em falha até alguém preencher feitaEm (não é mudo nem some sozinha)', () => {
    expect(conferenciasEmFalha('2030-01-01', [c()]).map(x => x.id)).toEqual(['x-d7'])
    expect(conferenciasEmFalha('2030-01-01', [c({ feitaEm: '2030-01-01' })])).toEqual([])
  })
  it('só as que passaram do limite entram na falha, na ordem da lista', () => {
    const lista = [c({ id: 'a', data: '2020-03-01' }), c({ id: 'b', data: '2020-03-15' }), c({ id: 'c', data: '2020-03-02', feitaEm: '2020-03-05' }), c({ id: 'd', data: '2020-03-05' })]
    expect(conferenciasEmFalha('2020-03-18', lista).map(x => x.id)).toEqual(['a', 'd'])
    expect(conferenciasVencidas('2020-03-18', lista).map(x => x.id)).toEqual(['a', 'b', 'd'])
  })
  it('a lista publicada é bem formada: ids únicos, datas AAAA-MM-DD, feitaEm nula ou data', () => {
    expect(new Set(CONFERENCIAS.map(x => x.id)).size).toBe(CONFERENCIAS.length)
    for (const x of CONFERENCIAS) {
      expect(x.data, x.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(x.feitaEm === null || /^\d{4}-\d{2}-\d{2}$/.test(x.feitaEm), x.id).toBe(true)
      expect(x.onde.length, x.id).toBeGreaterThan(0)
    }
  })
  it('as quatro conferências da E20 estão na lista, com as datas do plano', () => {
    const e20 = Object.fromEntries(CONFERENCIAS.filter(x => x.etapa === 'E20').map(x => [x.id, x.data]))
    expect(e20).toEqual({ 'e20-tamanho-d8': '2026-10-21', 'e20-tamanho-30d': '2026-11-12', 'e20-prova-90d': '2027-01-09', 'e20-prova-180d': '2027-04-09' })
  })
})
