// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { DIAS_SEM_LEITURA, quemEstaNaConta } from '@/lib/youtube/observatorio/proprio/na-conta'

const ATE = '2026-09-30'
const DE90 = addDays(ATE, -89)
const DE7 = addDays(ATE, -6)
const ult = (m: Record<string, string | null>) => (id: string) => m[id] ?? null

describe('quemEstaNaConta', () => {
  it('sem nenhum dia medido: fora', () => {
    const r = quemEstaNaConta({ ytIds: ['a', 'b'], de: DE90, ate: ATE, ultimoMedido: ult({ a: ATE, b: null }) })
    expect(r.fora).toEqual(['b'])
    expect(r.exigidoAte.has('b')).toBe(false)
    expect(r.exigidoAte.get('a')).toBe(ATE)
  })
  it('último dia medido em ate - 8: exigido até ate', () => {
    const r = quemEstaNaConta({ ytIds: ['a'], de: DE90, ate: ATE, ultimoMedido: ult({ a: addDays(ATE, -DIAS_SEM_LEITURA) }) })
    expect(r.parados).toEqual([])
    expect(r.exigidoAte.get('a')).toBe(ATE)
    expect(r.paradosDesde).toBeNull()
  })
  it('em ate - 9: parado, exigido só até esse último dia', () => {
    const ultimo = addDays(ATE, -(DIAS_SEM_LEITURA + 1))
    const r = quemEstaNaConta({ ytIds: ['a', 'b'], de: DE90, ate: ATE, ultimoMedido: ult({ a: ultimo, b: ATE }) })
    expect(r.parados).toEqual(['a'])
    expect(r.exigidoAte.get('a')).toBe(ultimo)
    expect(r.exigidoAte.get('b')).toBe(ATE)
    expect(r.paradosDesde).toBe(ultimo)
  })
  it('paradosDesde é o menor último dia entre os parados', () => {
    const a = addDays(ATE, -30), b = addDays(ATE, -50)
    expect(quemEstaNaConta({ ytIds: ['a', 'b'], de: DE90, ate: ATE, ultimoMedido: ult({ a, b }) }).paradosDesde).toBe(b)
  })
  it('período de 7 dias: ninguém é parado, qualquer que seja o último dia', () => {
    for (let k = 0; k < 7; k++) {
      const r = quemEstaNaConta({ ytIds: ['a'], de: DE7, ate: ATE, ultimoMedido: ult({ a: addDays(DE7, k) }) })
      expect(r.parados, String(k)).toEqual([])
      expect(r.exigidoAte.get('a')).toBe(ATE)
    }
  })
  it('lista vazia: tudo vazio, sem lançar', () => {
    const r = quemEstaNaConta({ ytIds: [], de: DE90, ate: ATE, ultimoMedido: () => null })
    expect(r.fora).toEqual([])
    expect(r.parados).toEqual([])
    expect(r.exigidoAte.size).toBe(0)
    expect(r.paradosDesde).toBeNull()
  })
  it('id repetido conta uma vez', () => {
    const r = quemEstaNaConta({ ytIds: ['a', 'a'], de: DE90, ate: ATE, ultimoMedido: ult({}) })
    expect(r.fora).toEqual(['a'])
  })
  it('DIAS_SEM_LEITURA é o número escrito em coleta/diario-step.ts', () => {
    const src = readFileSync(join(process.cwd(), 'src/lib/youtube/coleta/diario-step.ts'), 'utf8')
    const m = /const DIAS_DE_ATRASO_ANTIGO = (\d+)/.exec(src)
    expect(m).not.toBeNull()
    expect(DIAS_SEM_LEITURA).toBe(Number(m![1]))
  })
})
