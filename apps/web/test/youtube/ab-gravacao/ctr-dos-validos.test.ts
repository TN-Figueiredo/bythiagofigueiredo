import { describe, it, expect } from 'vitest'
import { ctrDosValidos, estatisticaV2, type DiaDaDecisao } from '@/lib/youtube/ab-gravacao/decisao-v2'

const dia = (day: string, v: string, imp: number, ctr: number, over: Partial<DiaDaDecisao> = {}): DiaDaDecisao =>
  ({ day_pt: day, variant_id: v, alcance_estado: 'medido', impressoes: imp, ctr, final: true, bloco: 0, ...over })

const linhas: DiaDaDecisao[] = [
  dia('2026-10-01', 'o', 1000, 0.04), dia('2026-10-02', 'o', 1000, 0.05),
  dia('2026-10-03', 'b', 1000, 0.05), dia('2026-10-04', 'b', 1000, 0.06),
  dia('2026-10-05', 'b', 500, 0.9, { alcance_estado: 'aguardando' }), // inválido: fora
]

describe('ctrDosValidos (S8-F4 T12 T4, P2)', () => {
  it('CTR e lift só dos dias válidos; lift = ctrV/ctrO - 1', () => {
    const r = ctrDosValidos(linhas, ['o', 'b'], 'o')
    expect(r.o?.ctr).toBeCloseTo(0.045, 6)
    expect(r.b?.ctr).toBeCloseTo(0.055, 6)
    expect(r.b?.lift).toBeCloseTo(0.055 / 0.045 - 1, 6)
    expect(r.o?.lift).toBeNull()
  })
  it('variante sem dia válido => ctr e lift nulos (nunca 0)', () => {
    const r = ctrDosValidos(linhas.slice(0, 2), ['o', 'b'], 'o')
    expect(r.b).toEqual({ ctr: null, lift: null })
  })
  it('bate com o total de estatisticaV2 (lift)', () => {
    const muitos: DiaDaDecisao[] = []
    for (let i = 1; i <= 8; i++) {
      muitos.push(dia(`2026-10-0${i}`, 'o', 2000, 0.04 + i / 1000, { bloco: i % 2 }))
      muitos.push(dia(`2026-10-0${i}`, 'b', 2000, 0.05 + i / 1000, { bloco: i % 2 }))
    }
    const est = estatisticaV2(muitos, 'o', ['o', 'b'])
    expect(est.estado).toBe('calculada')
    if (est.estado !== 'calculada') return
    const r = ctrDosValidos(muitos, ['o', 'b'], 'o')
    expect(r.b?.lift).toBeCloseTo(est.por_variante[0]!.lift, 10)
  })
})
