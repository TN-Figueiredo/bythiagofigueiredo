// @vitest-environment node
// A5 2ª leva, D1: crescimento em 30 dias como função do motor; "dentro do arredondamento" = |ganho| < 2 passos (igual à seção Inscritos).
import { describe, it, expect } from 'vitest'
import { crescimento30 } from '@/lib/youtube/observatorio/channels'
import { createTestObservatory, datasetFromOracle, loadOracle } from './oracle'
import type { ChannelSnapshot } from '@/lib/youtube/observatorio/types'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 7, 1, 12)
const snap = (dia: number, subs: number): ChannelSnapshot => ({ t: T0 + dia * DAY, date: new Date(T0 + dia * DAY).toISOString().slice(0, 10), subs, views: 1000 * dia })
const obs = createTestObservatory(datasetFromOracle(loadOracle()))
const deps = { clock: obs.date, fmt: obs.fmt }

describe('crescimento30', () => {
  it('ganho de 1 passo fica dentro do arredondamento, com ±2 passos (já era "dentro" na regra antiga; o que muda é o ±N)', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_210_000)], 1_210_000)
    expect(g.abs).toBe(10_000)
    expect(g.roundingUnit).toBe(10_000)
    expect(g.withinRounding).toBe(true)
    expect(g.limiteArred).toBe(20_000)
  })
  it('virada de década na janela: 995.000 → 1.010.000 (ganho 15.000) agora é "dentro" (passo da maior contagem, igual a inscritos-28d)', () => {
    const g = crescimento30(deps, [snap(0, 995_000), snap(30, 1_010_000)], 1_010_000)
    expect(g.withinRounding).toBe(true)
    expect(g.limiteArred).toBe(20_000)
  })
  it('Yannis M3: perda que cruza a década (1.010.000 → 995.000) usa o passo da MAIOR contagem', () => {
    const g = crescimento30(deps, [snap(0, 1_010_000), snap(30, 995_000)], 995_000)
    expect(g.withinRounding).toBe(true)
    expect(g.limiteArred).toBe(20_000)
  })
  it('Phil M-5: 33 dias de distância mede; 34 é buraco', () => {
    expect(crescimento30(deps, [snap(0, 1_200_000), snap(33, 1_300_000)], 1_300_000).pending).toBeUndefined()
    expect(crescimento30(deps, [snap(0, 1_200_000), snap(34, 1_300_000)], 1_300_000).pending).toMatch(/^buraco na contagem/)
  })
  it('ganho de exatamente 2 passos fica fora (regra estrita, igual a inscritos-28d)', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_220_000)], 1_220_000)
    expect(g.withinRounding).toBe(false)
    expect(g.pct).toBeCloseTo(20_000 / 1_200_000)
  })
  it('abaixo de mil inscritos: zero exato é "sem variação" (nunca "−0,0%"); ±1 é ganho de verdade', () => {
    const zero = crescimento30(deps, [snap(0, 800), snap(30, 800)], 800)
    expect(zero.withinRounding).toBe(true)
    expect(zero.limiteArred).toBe(0)
    const um = crescimento30(deps, [snap(0, 800), snap(30, 801)], 801)
    expect(um.withinRounding).toBe(false)
    expect(um.abs).toBe(1)
    expect(um.limiteArred).toBe(0)
  })
  it('janela de 29 a 33 dias: com buraco na coleta (comparação de 60 dias) não mede e diz "buraco na contagem"', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(60, 1_300_000)], 1_300_000)
    expect(g.abs).toBeNull()
    expect(g.pending).toMatch(/buraco na contagem/)
  })
  it('devolve as contagens das duas pontas', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_250_000)], 1_250_000)
    expect(g.fromSubs).toBe(1_200_000)
    expect(g.toSubs).toBe(1_250_000)
  })
  it('canal novo: diz quantos dias tem e quando fecha', () => {
    const g = crescimento30(deps, [snap(0, 5000), snap(12, 5100)], 5100)
    expect(g.abs).toBeNull()
    expect(g.diasDeRegistro).toBe(12)
    expect(g.fechaEm).toBe(T0 + 30 * DAY)
  })
  it('sem retrato: sem contagem, sem data', () => {
    const g = crescimento30(deps, [], 5000)
    expect(g.pending).toBe('sem contagem')
    expect(g.diasDeRegistro).toBeNull()
    expect(g.fechaEm).toBeNull()
  })
  it('inscritos ocultos: nada a comparar', () => {
    const g = crescimento30(deps, [snap(0, 5000), snap(30, 5100)], null)
    expect(g.withinRounding).toBeNull()
  })
  // D1b (Logan, doc oficial: a contagem é CORTADA para baixo): o texto do arredondamento nunca é "±" simétrico.
  it('roundingText: "este ou um pouco maior, em menos de {passo}", nunca "±"', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_210_000)], 1_210_000)
    expect(g.roundingText).toBe(`o número real é este ou um pouco maior, em menos de ${deps.fmt.num(10_000)}`)
    expect(g.roundingText).not.toContain('±')
    expect(crescimento30(deps, [snap(0, 800), snap(30, 800)], 800).roundingText).toBe('exato')
    expect(crescimento30(deps, [], null).roundingText).toBe('sem contagem')
  })
  // Phil M-3: o GANHO é a diferença de duas contagens cortadas para baixo: erra em (−passo, +passo), então o texto curto é "+N (±passo)"; o "até +" vale para o NÍVEL (roundingText)
  it('text: "+N (±passo)" fora do arredondamento', () => {
    const g = crescimento30(deps, [snap(0, 1_200_000), snap(30, 1_250_000)], 1_250_000)
    expect(g.text).toBe(`+${deps.fmt.num(50_000)} (±${deps.fmt.num(10_000)})`)
    expect(crescimento30(deps, [snap(0, 800), snap(30, 803)], 803).text).toBe('+3')
  })
})
