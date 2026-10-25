// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { mulberry32 } from '@/lib/youtube/ab-statistics'
import { tCdf, estatisticaV2, type DiaDaDecisao } from '@/lib/youtube/ab-gravacao/decisao-v2'

const dia = (i: number, variant: string | null, imp: number | null, clicks: number | null, bloco: number | null): DiaDaDecisao => ({
  day_pt: `2026-09-${String(i + 1).padStart(2, '0')}`, variant_id: variant, alcance_estado: 'medido',
  impressoes: imp, ctr: clicks === null || !imp ? null : clicks / imp, final: true, bloco,
})

describe('tCdf', () => {
  it('valores conhecidos', () => {
    expect(Math.abs(tCdf(2.776, 4) - 0.975)).toBeLessThan(5e-4)
    expect(Math.abs(tCdf(2.969, 6) - 0.9875)).toBeLessThan(5e-4)
    expect(tCdf(0, 5)).toBeCloseTo(0.5, 10)
    expect(tCdf(-2.776, 4)).toBeCloseTo(1 - tCdf(2.776, 4), 10)
  })
})

/** Padrão ABBA / ABCCBA por dia; variante 0 é a original. */
function padrao(V: number, i: number): number {
  const p = V === 2 ? [0, 1, 1, 0] : [0, 1, 2, 2, 1, 0]
  return p[i % p.length]!
}
const IDS = ['o', 'a', 'b']

function binom(rng: () => number, n: number, p: number): number {
  const u1 = Math.max(rng(), 1e-12), u2 = rng()
  const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return Math.max(0, Math.round(n * p + g * Math.sqrt(n * p * (1 - p))))
}
function simular(rng: () => number, V: number, dias: number, imp: number, p1: number, lift: number): DiaDaDecisao[] {
  const out: DiaDaDecisao[] = []
  for (let i = 0; i < dias; i++) {
    const v = padrao(V, i)
    out.push(dia(i, IDS[v]!, imp, binom(rng, imp, v === 0 ? p1 : p1 * (1 + lift)), Math.floor(i / (2 * V))))
  }
  return out
}
const ids = (V: number) => IDS.slice(0, V)

describe('estatisticaV2', () => {
  it('células de 1 dia e gl = 1 => gl_menor_que_2', () => {
    const d = [
      dia(0, 'o', 10000, 380, 0), dia(1, 'o', 10000, 420, 0), dia(2, 'a', 10000, 440, 0),
      dia(3, 'o', 10000, 400, 1), dia(4, 'a', 10000, 430, 1),
      dia(5, 'o', 10000, 400, 2), dia(6, 'a', 10000, 430, 2),
    ]
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    expect(r).toEqual({ estado: 'sem_dado', motivo: 'gl_menor_que_2' }) // D = 7, 6 células => gl = 1
  })

  it('phi manual: 8 dias, 6 células, gl = 2', () => {
    const d = [
      dia(0, 'o', 10000, 380, 0), dia(1, 'o', 10000, 420, 0), dia(2, 'a', 10000, 440, 0),
      dia(3, 'a', 10000, 400, 0), // (a,0) 2 dias, resíduo >0 também
      dia(4, 'o', 10000, 400, 1), dia(5, 'a', 10000, 430, 1),
      dia(6, 'o', 10000, 400, 2), dia(7, 'a', 10000, 430, 2),
    ]
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    expect(r.gl).toBe(8 - 6)
    // (o,0): p=.04, resíduos ±20 => 800/384 ; (a,0): p=.042, resíduos ±20 => 800/(10000*.042*.958)
    const esperado = (800 / 384 + 800 / (10000 * 0.042 * 0.958)) / 2
    expect(r.phi).toBeCloseTo(esperado, 6)
  })

  it('bloco 3 parcial não cria célula vazia', () => {
    const d: DiaDaDecisao[] = []
    for (let i = 0; i < 9; i++) d.push(dia(i, padrao(2, i) === 0 ? 'o' : 'a', 10000, 400 + (i % 3) * 10, Math.floor(i / 4)))
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    // células: (o,0)(a,0)(o,1)(a,1)(o,2) = 5 ; D = 9
    expect(r.gl).toBe(4)
    expect(r.por_variante[0]!.sinais_por_bloco).toHaveLength(2)
  })

  it('exemplo do spec: 3 variantes, 12 dias, 6 células => gl = 6, phi e gl na raiz', () => {
    const d = simular(mulberry32(7), 3, 12, 5000, 0.04, 0)
    const r = estatisticaV2(d, 'o', ids(3))
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    expect(r.gl).toBe(6)
    expect(r.por_variante.map(x => x.variant_id)).toEqual(['a', 'b'])
    expect(Number.isFinite(r.phi)).toBe(true)
  })

  it('C-13b: phi ~ 4 com z cru p = 0,01 não passa', () => {
    const d: DiaDaDecisao[] = []
    let k = 0
    for (let b = 0; b < 3; b++) {
      // ABBA: o, a, a, o ; cada célula 400±28 (o) e 429±28 (a), Δ = 56
      d.push(dia(k++, 'o', 10000, 372, b), dia(k++, 'a', 10000, 401, b), dia(k++, 'a', 10000, 457, b), dia(k++, 'o', 10000, 428, b))
    }
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    expect(r.phi).toBeGreaterThan(3.5)
    expect(r.phi).toBeLessThan(4.6)
    const v = r.por_variante[0]!
    expect(Math.abs(v.z)).toBeGreaterThan(2.4) // p cru ~ 0,01
    expect(Math.abs(v.z)).toBeLessThan(2.8)
    expect(Math.abs(v.z_adj)).toBeLessThan(v.z === 0 ? 1 : Math.abs(v.z))
    expect(v.passa).toBe(false)
  })

  it('variante sem CTR => sem_dado/variante_sem_ctr', () => {
    const d = [dia(0, 'o', 10000, 400, 0), dia(1, 'a', 10000, null, 0), dia(2, 'a', 10000, null, 0), dia(3, 'o', 10000, 400, 0)]
    expect(estatisticaV2(d, 'o', ['o', 'a'])).toEqual({ estado: 'sem_dado', motivo: 'variante_sem_ctr' })
  })

  it('gl < 2 => sem_dado; p extremo => sem_dado', () => {
    const d = [dia(0, 'o', 10000, 400, 0), dia(1, 'a', 10000, 500, 0), dia(2, 'a', 10000, 500, 0)]
    expect(estatisticaV2(d, 'o', ['o', 'a'])).toEqual({ estado: 'sem_dado', motivo: 'gl_menor_que_2' })
    const z = [0, 1, 2, 3, 4, 5, 6, 7].map(i => dia(i, padrao(2, i) === 0 ? 'o' : 'a', 10000, 0, Math.floor(i / 4)))
    expect(estatisticaV2(z, 'o', ['o', 'a'])).toEqual({ estado: 'sem_dado', motivo: 'p_extremo' })
  })

  it('poder: caso fixo phi ~ 1, lift 30%', () => {
    const d: DiaDaDecisao[] = []
    const o = [400, 396, 404], a = [520, 516, 524]
    for (let b = 0; b < 3; b++) d.push(dia(b * 4, 'o', 10000, o[b]!, b), dia(b * 4 + 1, 'a', 10000, a[b]!, b), dia(b * 4 + 2, 'a', 10000, a[b]! + 1, b), dia(b * 4 + 3, 'o', 10000, o[b]! + 1, b))
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    expect(r.por_variante[0]!.passa).toBe(true)
    expect(r.por_variante[0]!.lift).toBeGreaterThan(0.25)
  })

  it('sinal diferente entre blocos impede passar', () => {
    const d: DiaDaDecisao[] = []
    // bloco 0: a >> o ; bloco 1: a < o ; totais ainda a favor de a
    d.push(dia(0, 'o', 10000, 300, 0), dia(1, 'a', 10000, 700, 0), dia(2, 'a', 10000, 700, 0), dia(3, 'o', 10000, 300, 0))
    d.push(dia(4, 'o', 10000, 420, 1), dia(5, 'a', 10000, 400, 1), dia(6, 'a', 10000, 400, 1), dia(7, 'o', 10000, 420, 1))
    d.push(dia(8, 'o', 10000, 420, 2), dia(9, 'a', 10000, 400, 2), dia(10, 'a', 10000, 400, 2), dia(11, 'o', 10000, 420, 2))
    const r = estatisticaV2(d, 'o', ['o', 'a'])
    if (r.estado !== 'calculada') throw new Error('esperava calculada')
    expect(r.por_variante[0]!.sinais_por_bloco).toEqual([1, -1, -1])
    expect(r.por_variante[0]!.passa).toBe(false)
  })

  it('JSON nunca contém NaN/Infinity', () => {
    const r = estatisticaV2(simular(mulberry32(3), 2, 12, 3000, 0.04, 0.2), 'o', ids(2))
    expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/)
  })
})

describe('estatisticaV2 simulações (mulberry32)', () => {
  const N_FP = 10000

  it('falso positivo V = 2, phi = 1: taxa <= alfa + 0,01', () => {
    let passa = 0
    for (let s = 1; s <= N_FP; s++) {
      const r = estatisticaV2(simular(mulberry32(s), 2, 12, 3000, 0.04, 0), 'o', ids(2))
      if (r.estado === 'calculada' && r.por_variante.some(v => v.passa)) passa++
    }
    expect(passa / N_FP).toBeLessThanOrEqual(0.05 + 0.01)
  }, 60000)

  it('falso positivo V = 3: por comparação <= 0,035 e família <= 0,06', () => {
    let fam = 0, a = 0, b = 0
    for (let s = 1; s <= N_FP; s++) {
      const r = estatisticaV2(simular(mulberry32(s + 100000), 3, 12, 3000, 0.04, 0), 'o', ids(3))
      if (r.estado !== 'calculada') continue
      const pa = r.por_variante[0]!.passa, pb = r.por_variante[1]!.passa
      if (pa) a++
      if (pb) b++
      if (pa || pb) fam++
    }
    expect(a / N_FP).toBeLessThanOrEqual(0.025 + 0.01)
    expect(b / N_FP).toBeLessThanOrEqual(0.025 + 0.01)
    expect(fam / N_FP).toBeLessThanOrEqual(0.05 + 0.01)
  }, 60000)

  it('poder V = 2, p1 4%, 12 dias, lift 25%: taxa >= 0,6', () => {
    let passa = 0
    const n = 2000
    for (let s = 1; s <= n; s++) {
      const r = estatisticaV2(simular(mulberry32(s + 500000), 2, 12, 3000, 0.04, 0.25), 'o', ids(2))
      if (r.estado === 'calculada' && r.por_variante[0]!.passa) passa++
    }
    console.log('PODER V2', passa / n)
    expect(passa / n).toBeGreaterThanOrEqual(0.6)
  }, 60000)

  it('poder V = 3, p1 4%, 12 dias, lift 25%: família >= 0,5', () => {
    let passa = 0
    const n = 2000
    for (let s = 1; s <= n; s++) {
      const r = estatisticaV2(simular(mulberry32(s + 900000), 3, 12, 3000, 0.04, 0.25), 'o', ids(3))
      if (r.estado === 'calculada' && r.por_variante.some(v => v.passa)) passa++
    }
    console.log('PODER V3', passa / n)
    expect(passa / n).toBeGreaterThanOrEqual(0.5)
  }, 60000)
})
