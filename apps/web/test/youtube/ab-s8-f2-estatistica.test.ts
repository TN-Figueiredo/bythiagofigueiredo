// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  zDuasProporcoes,
  calculateBayesianConfidence,
  calculatePlayoffStats,
} from '@/lib/youtube/ab-statistics'
import type { ContagemDaVariante } from '@/lib/youtube/ab-types'

const c = (id: string, imp: number | null, cl: number | null): ContagemDaVariante => ({
  variant_id: id,
  total_impressions: imp,
  total_clicks: cl,
})

describe('zDuasProporcoes (S8-F2, C-8)', () => {
  it('nulo em impressões ou cliques de qualquer lado dá nao_medido, sem p nem pValue', () => {
    const casos: Array<[ContagemDaVariante, ContagemDaVariante]> = [
      [c('a', null, null), c('b', 1000, 50)],
      [c('a', 1000, 50), c('b', null, null)],
      [c('a', 1000, null), c('b', 1000, 50)],
    ]
    for (const [a, b] of casos) {
      const r = zDuasProporcoes(a, b)
      expect(r).toEqual({ estado: 'nao_medido' })
      expect('p' in r).toBe(false)
      expect('pValue' in r).toBe(false)
    }
  })

  it('0 impressões numa variante dá sem_volume', () => {
    expect(zDuasProporcoes(c('a', 0, 0), c('b', 1000, 50)).estado).toBe('sem_volume')
    expect(zDuasProporcoes(c('a', 1000, 50), c('b', 0, 0)).estado).toBe('sem_volume')
  })

  it('zero cliques nas duas (taxa degenerada) dá sem_volume, nunca p = 1 calculado (D-P8)', () => {
    expect(zDuasProporcoes(c('a', 1000, 0), c('b', 1000, 0)).estado).toBe('sem_volume')
  })

  it('amostra grande com diferença dá calculado', () => {
    const r = zDuasProporcoes(c('a', 5000, 250), c('b', 5000, 350))
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') {
      expect(r.z).toBeGreaterThan(2)
      expect(r.p).toBeLessThan(0.05)
    }
  })

  it('nunca calculado por falta de dado (6 combinações com nulo ou 0)', () => {
    const ruins = [c('x', null, null), c('x', 0, 0), c('x', 1000, null)]
    const bom = c('y', 1000, 50)
    for (const r of ruins) {
      expect(zDuasProporcoes(r, bom).estado).not.toBe('calculado')
      expect(zDuasProporcoes(bom, r).estado).not.toBe('calculado')
    }
  })
})

describe('Bayes e playoff com estado', () => {
  it('sonda de Yannis: views como impressões e cliques nulos dá nao_medido, sem vencedor', () => {
    const r = calculateBayesianConfidence([c('a', 1200, null), c('b', 900, null)])
    expect(r).toEqual({ estado: 'nao_medido' })
    expect('winnerId' in r).toBe(false)
    expect(calculateBayesianConfidence([c('a', 5000, null), c('b', 4000, 0)]).estado).toBe('nao_medido')
  })

  it('playoff com uma variante nula dá nao_medido', () => {
    expect(calculatePlayoffStats([c('a', 1000, 50), c('b', null, null), c('c', 1000, 60)])).toEqual({
      estado: 'nao_medido',
    })
  })

  it('com contagens medidas mantém o confidence de antes (semente igual)', () => {
    const r = calculateBayesianConfidence([c('a', 1000, 50), c('b', 1000, 80)])
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') {
      expect(r.winnerId).toBe('b')
      expect(r.confidence).toBe(0.9963)
      expect(r.probabilities).toEqual({ a: 0.0037, b: 0.9963 })
    }
  })

  it('playoff medido volta calculado com bayesian e ptop2', () => {
    const r = calculatePlayoffStats([c('a', 1000, 50), c('b', 1000, 80), c('c', 1000, 60)])
    expect(r.estado).toBe('calculado')
    if (r.estado === 'calculado') {
      expect(r.bayesian.winnerId).toBeTruthy()
      expect(Object.keys(r.ptop2)).toHaveLength(3)
    }
  })
})
