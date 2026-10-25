// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, boundsAnalytics, dayPt, ontemPt } from '@/lib/youtube/coleta/day-pt'
import type { CicloComNumero } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { montarRetrato, type EntradasDoRetrato, type TesteParaRetrato, type LinhaSonda, type LinhaViews } from '@/lib/youtube/ab-gravacao/retrato'

const AGORA = new Date()
const ontem = ontemPt(AGORA)
const d = (n: number) => addDays(ontem, -n)
const meioDia = (day: string, h = 12) => new Date(boundsAnalytics(day).start + h * 3_600_000).toISOString()

const TESTE: TesteParaRetrato = {
  id: 't1', status: 'active', paused_at: null, completed_at: null, original_title: null,
  site_id: 's1', test_type: 'thumbnail', regra_duracao: 'v1', youtube_id: 'abcdefghijk', channel_id: 'ch1',
}
const VID = TESTE.youtube_id

/** Um ciclo por dia, na variante dada (ABBA etc.), nos dias dados. */
function fixture(dias: Array<[string, string]>, over: Partial<EntradasDoRetrato> = {}, teste: TesteParaRetrato = TESTE): EntradasDoRetrato {
  const ciclos: CicloComNumero[] = dias.map(([day, v], n) => ({
    id: 'c' + n, test_id: 't1', variant_id: v, started_at: meioDia(day, 1), ended_at: meioDia(day, 23), applied_metadata: null, cycle_number: n + 1,
  }))
  const meta = new Map(dias.map(([day, v]) => [`${VID}|${day}`, { ab_test_id: 't1', ab_variant_id: v, seconds_on_air_analytics: 86_000, captured_at: meioDia(day) }]))
  return {
    testes: [teste], ciclosPorTeste: new Map([['t1', ciclos]]), metaPorVideoDia: meta, alcancePorVideoDia: new Map(),
    relatoriosPorCanalDia: new Map(), viewsPorVideoDia: new Map(), coberturaPorVideo: new Map(), sondasPorTesteDia: new Map(),
    desde: d(40), ...over,
  }
}
const ABBA: Array<[string, string]> = [[d(6), 'A'], [d(5), 'B'], [d(4), 'B'], [d(3), 'A'], [d(2), 'A'], [d(1), 'B']]

describe('montarRetrato', () => {
  it('uma linha por dia do teste, nenhuma em hoje', () => {
    const r = montarRetrato(fixture(ABBA.slice(0, 4)), AGORA)
    expect(r).toHaveLength(4)
    expect(r.map(x => x.day_pt)).toEqual(ABBA.slice(0, 4).map(x => x[0]))
    expect(r.some(x => x.day_pt === dayPt(AGORA))).toBe(false)
    expect(r[0]).toMatchObject({ test_id: 't1', site_id: 's1', youtube_video_id: VID, regra_duracao: 'v1', variant_id: 'A', segundos_no_ar: 86_000 })
    expect(r[0].ciclos).toHaveLength(1)
    expect(r[0].ciclos[0]?.cycle_number).toBe(1)
    expect(r[0].retratado_em).toBe(AGORA.toISOString())
  })

  it('dia_de_troca: [nulo, true, false, true]', () => {
    const r = montarRetrato(fixture(ABBA.slice(0, 4)), AGORA)
    expect(r.map(x => x.dia_de_troca)).toEqual([null, true, false, true])
  })

  it('dia_de_troca é nulo quando uma das variantes é nula', () => {
    const e = fixture(ABBA.slice(0, 3))
    e.metaPorVideoDia.delete(`${VID}|${d(5)}`)
    const r = montarRetrato(e, AGORA)
    expect(r.map(x => x.dia_de_troca)).toEqual([null, null, null])
    expect(r[1]).toMatchObject({ variant_id: null, motivo_sem_variante: 'meta_ausente' })
  })

  it('teste iniciado 45 dias atrás com desde = ontem - 40: nenhuma linha antes de desde', () => {
    const dias: Array<[string, string]> = Array.from({ length: 46 }, (_, n) => [d(45 - n), n % 2 ? 'B' : 'A'])
    const r = montarRetrato(fixture(dias), AGORA)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(x => x.day_pt >= d(40))).toBe(true)
  })

  it('views e proveniência copiadas do diário (reporting_api aparece como veio)', () => {
    const v: LinhaViews = { views: 321, engaged_views: 200, watch_time_minutes: 12.5, avg_view_percentage: 40.5, source: 'reporting_api', metric_version: 'mv2' }
    const r = montarRetrato(fixture(ABBA.slice(0, 2), { viewsPorVideoDia: new Map([[`${VID}|${d(6)}`, v]]) }), AGORA)
    expect(r[0]).toMatchObject({ views: 321, views_estado: 'medido', views_fonte: 'reporting_api', metric_version: 'mv2', engaged_views: 200, watch_time_minutes: 12.5, avg_view_percentage: 40.5 })
    expect(r[1]).toMatchObject({ views: null, views_estado: 'nao_medido', views_fonte: null, metric_version: null })
  })

  it('views 0 na linha do diário é zero_medido e grava 0; sem linha coberto é zero_medido', () => {
    const v: LinhaViews = { views: 0, engaged_views: 0, watch_time_minutes: 0, avg_view_percentage: null, source: 'analytics_api', metric_version: 'mv1' }
    const r = montarRetrato(fixture(ABBA.slice(0, 2), {
      viewsPorVideoDia: new Map([[`${VID}|${d(6)}`, v]]), coberturaPorVideo: new Map([[VID, [{ de: d(30), ate: d(0) }]]]) }), AGORA)
    expect(r[0]).toMatchObject({ views: 0, views_estado: 'zero_medido' })
    expect(r[1]).toMatchObject({ views: null, views_estado: 'zero_medido' })
  })

  it('alcance: linha medida copia impressões, ctr e proveniência', () => {
    const al = { thumbnail_impressions: 900, thumbnail_ctr: 0.04, source_report_id: 'rep9', report_create_time: '2026-10-02T00:00:00Z' }
    const r = montarRetrato(fixture(ABBA.slice(0, 2), { alcancePorVideoDia: new Map([[`${VID}|${d(6)}`, al]]) }), AGORA)
    expect(r[0]).toMatchObject({ impressoes: 900, ctr: 0.04, alcance_estado: 'medido', source_report_id: 'rep9', report_create_time: '2026-10-02T00:00:00Z' })
    expect(r[1]).toMatchObject({ impressoes: null, ctr: null, alcance_estado: 'aguardando', source_report_id: null })
  })

  it('o dia do D+10 fecha: final true e aguardando vira nao_medido; D+9 segue aberto', () => {
    const r = montarRetrato(fixture([[d(10), 'A'], [d(9), 'B']]), AGORA)
    expect(r[0]).toMatchObject({ final: true, alcance_estado: 'nao_medido' })
    expect(r[1]).toMatchObject({ final: false, alcance_estado: 'aguardando' })
  })

  describe('troca_vista_em', () => {
    const sonda = (day: string, hora: number, estado: string, vista: string | null): LinhaSonda => {
      const lida = new Date(boundsAnalytics(day).start + hora * 3_600_000 + 15 * 60_000).toISOString()
      return { hora: lida, lida_em: lida, leitura_estado: estado, variante_vista: vista }
    }
    it('sonda bate da nova variante vira troca_vista_em (a primeira)', () => {
      const s1 = sonda(d(5), 3, 'bate', 'B'), s2 = sonda(d(5), 5, 'bate', 'B')
      const r = montarRetrato(fixture(ABBA.slice(0, 2), { sondasPorTesteDia: new Map([[`t1|${d(5)}`, [s2, s1]]]) }), AGORA)
      expect(r[1].dia_de_troca).toBe(true)
      expect(r[1].troca_vista_em).toBe(s1.lida_em)
    })
    it('sem_referencia, variante velha ou dia sem sonda deixam nulo', () => {
      const e = fixture(ABBA.slice(0, 2), { sondasPorTesteDia: new Map([[`t1|${d(5)}`, [sonda(d(5), 3, 'sem_referencia', null), sonda(d(5), 4, 'bate', 'A')]]]) })
      expect(montarRetrato(e, AGORA)[1].troca_vista_em).toBeNull()
      expect(montarRetrato(fixture(ABBA.slice(0, 2)), AGORA)[1].troca_vista_em).toBeNull()
    })
    it('teste de título nunca tem troca_vista_em', () => {
      const t = { ...TESTE, test_type: 'title' as const }
      const e = fixture(ABBA.slice(0, 2), { sondasPorTesteDia: new Map([[`t1|${d(5)}`, [sonda(d(5), 3, 'bate', 'B')]]]) }, t)
      expect(montarRetrato(e, AGORA)[1].troca_vista_em).toBeNull()
    })
    it('sem dia_de_troca não há troca_vista_em', () => {
      const e = fixture(ABBA.slice(1, 3), { sondasPorTesteDia: new Map([[`t1|${d(4)}`, [sonda(d(4), 3, 'bate', 'B')]]]) })
      const r = montarRetrato(e, AGORA)
      expect(r[1].dia_de_troca).toBe(false)
      expect(r[1].troca_vista_em).toBeNull()
    })
  })

  it('dia de 25 h: segundos_do_dia 90000', () => {
    const day = dayPt(AGORA)
    // procura para trás (dentro da janela) um dia de 25 h; o retrato só vai até ontem
    let achou: string | null = null
    for (let n = 1; n < 400 && !achou; n++) {
      const cand = addDays(day, -n); const b = boundsAnalytics(cand)
      if ((b.end - b.start) / 1000 === 90_000) achou = cand
    }
    expect(achou).not.toBeNull()
    const e = fixture([[achou!, 'A']], { desde: addDays(achou!, -3) })
    expect(montarRetrato(e, AGORA)[0].segundos_do_dia).toBe(90_000)
  })
})
