// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, boundsAnalytics, dayPt, ontemPt } from '@/lib/youtube/coleta/day-pt'
import type { AbCycle, AbTest } from '@/lib/youtube/coleta/ab-seconds'
import { atribuirDia, diasDoTeste } from '@/lib/youtube/ab-gravacao/atribuicao'
import type { MetaDoDia } from '@/lib/youtube/ab-gravacao/tipos'

/** Próximo dia do Pacífico (a partir de hoje, teto 400) com a duração dada; lança se não achar. */
function proximoDiaCom(segundos: number): string {
  let d = dayPt(new Date())
  for (let n = 0; n < 400; n++, d = addDays(d, 1)) {
    const b = boundsAnalytics(d)
    if ((b.end - b.start) / 1000 === segundos) return d
  }
  throw new Error('sem dia de ' + segundos + ' s em 400 dias')
}

const TESTE: AbTest = { id: 't1', status: 'active', paused_at: null, completed_at: null, original_title: null }
const ciclo = (p: Partial<AbCycle> & { id: string; started_at: string }): AbCycle => ({ test_id: 't1', variant_id: 'vA', ended_at: null, applied_metadata: null, ...p })
const meta = (p: Partial<MetaDoDia>): MetaDoDia => ({ ab_test_id: 't1', ab_variant_id: 'vB', seconds_on_air_analytics: 86_000, captured_at: '2026-10-01T12:00:00Z', ...p })
const ciclos: AbCycle[] = [ciclo({ id: 'c1', started_at: '2026-01-01T00:00:00Z' })]

describe('atribuirDia', () => {
  it('dia de 25 h com 86 400 s no ar fica com a variante (96%)', () => {
    const day = proximoDiaCom(90_000)
    const r = atribuirDia({ testId: 't1', day, meta: meta({ seconds_on_air_analytics: 86_400 }), teste: TESTE, ciclos })
    expect(r).toMatchObject({ variant_id: 'vB', motivo_sem_variante: null, segundos_do_dia: 90_000, segundos_no_ar: 86_400 })
  })
  it('dia de 25 h com 80 000 s no ar é menos_de_90 (nunca 77 760 fixo)', () => {
    const day = proximoDiaCom(90_000)
    const r = atribuirDia({ testId: 't1', day, meta: meta({ seconds_on_air_analytics: 80_000 }), teste: TESTE, ciclos })
    expect(r).toMatchObject({ variant_id: null, motivo_sem_variante: 'menos_de_90', segundos_no_ar: 80_000 })
  })
  it('dia de 23 h com 76 000 s no ar fica com a variante (91,8%)', () => {
    const day = proximoDiaCom(82_800)
    const r = atribuirDia({ testId: 't1', day, meta: meta({ seconds_on_air_analytics: 76_000 }), teste: TESTE, ciclos })
    expect(r).toMatchObject({ variant_id: 'vB', segundos_do_dia: 82_800 })
  })
  it('dia de 23 h com 74 000 s é menos_de_90 (89,4%)', () => {
    const day = proximoDiaCom(82_800)
    expect(atribuirDia({ testId: 't1', day, meta: meta({ seconds_on_air_analytics: 74_000 }), teste: TESTE, ciclos }).motivo_sem_variante).toBe('menos_de_90')
  })
  const dia24 = addDays(ontemPt(new Date()), -3)
  it('meta ausente: variant_id nulo e meta_ausente, nunca a variante do ciclo', () => {
    const r = atribuirDia({ testId: 't1', day: dia24, meta: null, teste: TESTE, ciclos })
    expect(r).toMatchObject({ variant_id: null, motivo_sem_variante: 'meta_ausente', segundos_no_ar: null })
    expect(r.segundos_do_dia).toBeGreaterThan(80_000)
  })
  it('ab_test_id de outro teste é dia_de_outro_teste', () => {
    expect(atribuirDia({ testId: 't1', day: dia24, meta: meta({ ab_test_id: 'outro' }), teste: TESTE, ciclos }).motivo_sem_variante).toBe('dia_de_outro_teste')
  })
  it('meta com variante nula e dois ciclos abertos do teste é meta_nula com ciclo_aberto_duplicado', () => {
    const dois = [ciclo({ id: 'c1', started_at: '2026-01-01T00:00:00Z' }), ciclo({ id: 'c2', started_at: '2026-01-02T00:00:00Z', variant_id: 'vB' })]
    const r = atribuirDia({ testId: 't1', day: dia24, meta: meta({ ab_variant_id: null, ab_test_id: null, captured_at: new Date(boundsAnalytics(dia24).start + 3_600_000).toISOString() }), teste: TESTE, ciclos: dois })
    expect(r).toMatchObject({ variant_id: null, motivo_sem_variante: 'meta_nula', motivo_nulo_meta: 'ciclo_aberto_duplicado' })
  })
  it('meta nula que o recálculo não reproduz deixa motivo_nulo_meta nulo', () => {
    const r = atribuirDia({ testId: 't1', day: dia24, meta: meta({ ab_variant_id: null, captured_at: new Date(boundsAnalytics(dia24).start + 3_600_000).toISOString() }), teste: TESTE, ciclos })
    expect(r.motivo_sem_variante).toBe('meta_nula')
    expect(r.motivo_nulo_meta).toBeNull()
  })
})

describe('diasDoTeste', () => {
  const ontem = ontemPt(new Date())
  const d = (n: number) => addDays(ontem, -n)
  const noInicio = (day: string, h = 12) => new Date(boundsAnalytics(day).start + h * 3_600_000).toISOString()
  it('ciclo que começa às 23:50 PT conta o dia', () => {
    const day = d(5)
    const inicio = new Date(boundsAnalytics(day).end - 10 * 60_000).toISOString()
    const r = diasDoTeste([ciclo({ id: 'c1', started_at: inicio, ended_at: noInicio(addDays(day, 1)) })], TESTE, ontem, d(40))
    expect(r).toEqual([day, addDays(day, 1)])
  })
  it('nunca devolve hoje nem depois de ontem, mesmo com ciclo aberto', () => {
    const r = diasDoTeste([ciclo({ id: 'c1', started_at: noInicio(d(3)) })], TESTE, ontem, d(40))
    expect(r).toEqual([d(3), d(2), d(1), d(0)])
    expect(r).not.toContain(dayPt(new Date()))
  })
  it('pausa de 2 dias some da lista', () => {
    const r = diasDoTeste([
      ciclo({ id: 'c1', started_at: noInicio(d(6)), ended_at: noInicio(d(5)) }),
      ciclo({ id: 'c2', started_at: noInicio(d(2)), ended_at: noInicio(d(1)) })], TESTE, ontem, d(40))
    expect(r).toEqual([d(6), d(5), d(2), d(1)])
  })
  it('ciclo de 50 a 60 dias atrás com desde = ontem - 40: nenhum dia anterior a desde', () => {
    const r = diasDoTeste([ciclo({ id: 'c1', started_at: noInicio(d(60)), ended_at: noInicio(d(50)) }),
      ciclo({ id: 'c2', started_at: noInicio(d(45)), ended_at: noInicio(d(30)) })], TESTE, ontem, d(40))
    expect(r.every(x => x >= d(40))).toBe(true)
    expect(r[0]).toBe(d(40))
    expect(r[r.length - 1]).toBe(d(30))
  })
  it('ciclo aberto de teste pausado vai até o paused_at', () => {
    const r = diasDoTeste([ciclo({ id: 'c1', started_at: noInicio(d(6)) })], { ...TESTE, status: 'paused', paused_at: noInicio(d(4)) }, ontem, d(40))
    expect(r).toEqual([d(6), d(5), d(4)])
  })
  it('Y1: teste active com paused_at velho: o ciclo aberto vai até ontem (regra de fimEfetivo)', () => {
    const r = diasDoTeste([
      ciclo({ id: 'c1', started_at: noInicio(d(20)), ended_at: noInicio(d(15)) }),
      ciclo({ id: 'c2', started_at: noInicio(d(5)) })], { ...TESTE, status: 'active', paused_at: noInicio(d(15)) }, ontem, d(40))
    expect(r).toEqual(expect.arrayContaining([d(5), d(4), d(3), d(2), d(1), d(0)]))
  })
  it('Y1: teste paused sem completed_at corta no paused_at', () => {
    const r = diasDoTeste([ciclo({ id: 'c1', started_at: noInicio(d(6)) })], { ...TESTE, status: 'paused', paused_at: noInicio(d(4)), completed_at: null }, ontem, d(40))
    expect(r).toEqual([d(6), d(5), d(4)])
  })
  it('sem ciclos, lista vazia', () => expect(diasDoTeste([], TESTE, ontem, d(40))).toEqual([]))
})
