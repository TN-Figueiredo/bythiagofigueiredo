// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, ontemPt } from '@/lib/youtube/coleta/day-pt'
import { volumeMinimo, baseDoVideo } from '@/lib/youtube/ab-gravacao/decisao-v2'
import type { LinhaAlcance, MetaDoDia, RelatorioDoDia } from '@/lib/youtube/ab-gravacao/tipos'

const agora = new Date()
const ate = ontemPt(agora)
const V = { youtube_id: 'v1', channel_id: 'c1' }
const lin = (imp: number, ctr: number): LinhaAlcance => ({ thumbnail_impressions: imp, thumbnail_ctr: ctr, source_report_id: 'r', report_create_time: '2026-01-01T00:00:00Z' })
const entradas = (n: number, imp = 1000, ctr = 0.05, metas: Record<string, MetaDoDia> = {}) => {
  const alcancePorVideoDia = new Map<string, LinhaAlcance>()
  for (let i = 1; i <= n; i++) alcancePorVideoDia.set(`v1|${addDays(ate, -i)}`, lin(imp, ctr))
  return { alcancePorVideoDia, relatoriosPorCanalDia: new Map<string, RelatorioDoDia[]>(), metaPorVideoDia: new Map(Object.entries(metas)) }
}

describe('volumeMinimo', () => {
  it('valores do spec', () => {
    expect(volumeMinimo(0.04, 2)).toBeGreaterThanOrEqual(10300)
    expect(volumeMinimo(0.04, 2)).toBeLessThanOrEqual(10330)
    expect(volumeMinimo(0.04, 3)).toBeGreaterThanOrEqual(12470)
    expect(volumeMinimo(0.04, 3)).toBeLessThanOrEqual(12500)
  })
  it('V fora de {2,3} lança', () => {
    for (const v of [0, 1, 4]) expect(() => volumeMinimo(0.04, v)).toThrow()
  })
})

describe('baseDoVideo', () => {
  it('14 dias antes do teste sem ab_test_dias: p1 medido', () => {
    const b = baseDoVideo(entradas(14), V, 't1', ate, agora)
    expect(b).toMatchObject({ p1: 0.05, dias: 14, impressoes: 14000, base_estimada: false, p1_dias_sem_meta: 14 })
  })
  it('dia de outro teste fica fora; do próprio teste entra', () => {
    const m = (id: string): MetaDoDia => ({ ab_test_id: id, ab_variant_id: null, seconds_on_air_analytics: null, captured_at: 'x' })
    const b = baseDoVideo(entradas(14, 1000, 0.05, { [`v1|${addDays(ate, -1)}`]: m('outro'), [`v1|${addDays(ate, -2)}`]: m('t1') }), V, 't1', ate, agora)
    expect(b.dias).toBe(13)
    expect(b.p1_dias_sem_meta).toBe(12)
  })
  it('3 dias, 300 impressões e p1 = 0 ⇒ estimada com 0,04', () => {
    expect(baseDoVideo(entradas(3), V, 't1', ate, agora)).toMatchObject({ p1: 0.04, base_estimada: true })
    expect(baseDoVideo(entradas(14, 20), V, 't1', ate, agora)).toMatchObject({ p1: 0.04, base_estimada: true, impressoes: 280 })
    expect(baseDoVideo(entradas(14, 1000, 0), V, 't1', ate, agora)).toMatchObject({ p1: 0.04, base_estimada: true })
  })
  it('sem alcance algum e sem NaN', () => {
    const b = baseDoVideo(entradas(0), V, 't1', ate, agora)
    expect(b).toEqual({ p1: 0.04, dias: 0, impressoes: 0, p1_dias_sem_meta: 0, base_estimada: true })
    expect(JSON.stringify(b)).not.toMatch(/NaN|Infinity/)
  })
})
