// @vitest-environment node
// F2b T3: as séries já coletadas, com cliente falso. Literais, sem relógio.
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type Row } from '../../../../helpers/fake-supabase'
import { lerSeriesDoSite, juntarFaixas, ehSchemaAusenteDaMedida } from '@/lib/youtube/observatorio/sinais/medida/series'
import { somarJanela } from '@/lib/youtube/observatorio/sinais/medida/janela'
import { addDays } from '@/lib/youtube/coleta/day-pt'

const S = 'site-a', C = 'canal-1', V = 'vid00000001', W = 'vid00000002', OUT = 'outlier0001'
const D0 = '2026-11-02'
const dia = (n: number): string => addDays(D0, n)
const dias = (de: number, ate: number): string[] => Array.from({ length: ate - de + 1 }, (_, i) => dia(de + i))
const FAIXA = [{ de: dia(-10), ate: dia(10) }]

const cob = (yt: string, set: string, de: string, ate: string, canal = C): Row => ({ youtube_video_id: yt, metric_set: set, covered_from: de, covered_to: ate, site_id: S, channel_id: canal })
const diario = (yt: string, d: string, views: number | null): Row => ({ youtube_video_id: yt, day_pt: d, site_id: S, channel_id: C, views })
const reach = (yt: string, d: string, imp: number | null): Row => ({ youtube_video_id: yt, day_pt: d, site_id: S, channel_id: C, thumbnail_impressions: imp })
const reachDim = (yt: string, d: string, origem: string, aparelho: string, so: string, imp: number | null): Row =>
  ({ youtube_video_id: yt, day_pt: d, traffic_source_type: origem, device_type: aparelho, operating_system: so, site_id: S, channel_id: C, thumbnail_impressions: imp, thumbnail_clicks_est: null })
const dim = (yt: string, d: string, valor: string, views: number | null): Row =>
  ({ youtube_video_id: yt, day_pt: d, dim_kind: 'traffic_source', dim_value: valor, site_id: S, channel_id: C, views, watch_time_minutes: null })
const relatorio = (d: string, status: string, normalizado: boolean, canal = C): Row =>
  ({ report_id: 'r-' + d + canal, site_id: S, channel_id: canal, report_type_id: 'channel_reach_basic_a1', start_time: d + 'T07:00:00+00:00', end_time: addDays(d, 1) + 'T07:00:00+00:00', status, normalized_at: normalizado ? d + 'T12:00:00+00:00' : null })
const detalhe = (yt: string, d: string, tipo: string, texto: string): Row =>
  ({ youtube_video_id: yt, day_pt: d, source_type: tipo, detail: texto, detail_hash: 'h-' + texto, site_id: S, channel_id: C, views: 3, watch_time_minutes: null })

describe('lerSeriesDoSite', () => {
  it('nunca consulta yt_own_collection_attempts (não é fonte de cobertura)', async () => {
    const db = fakeSupabase({ yt_own_collection_attempts: [{ attempt_day: D0, outcome: 'ok' }] })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(db.trips).not.toContain('yt_own_collection_attempts')
    // sem intervalo base no dia, mesmo com tentativa ok: não medido por cobertura, nunca 0
    expect(s.estado('views_total', V, D0)).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
    expect(s.somar('views_total', V, dias(1, 3))).toEqual({ nao_medido: 'cobertura', diasSemCobertura: 3 })
  })

  it('R1: dia coberto sem linha é 0 medido; com linha soma; linha nula é sem_valor; intervalo de 2024 cobre o placebo de 1 ano', async () => {
    const velho = addDays(D0, -365)
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', '2024-01-01', dia(10))],
      yt_own_video_daily: [diario(V, dia(1), 5), diario(V, dia(2), 7), diario(V, dia(3), null), diario(V, velho, 4)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: [...FAIXA, { de: addDays(velho, -2), ate: addDays(velho, 2) }] })
    expect(s.somar('views_total', V, [dia(1), dia(2), dia(4)])).toEqual({ soma: 12 }) // dia(4) sem linha, coberto: 0
    expect(s.somar('views_total', V, [dia(1), dia(3)])).toEqual({ nao_medido: 'sem_valor', diasSemCobertura: 1 })
    expect(s.somar('views_total', V, [velho, addDays(velho, 1)])).toEqual({ soma: 4 })
  })

  it('R2: relatório vazio cobre; listado não; baixado SEM normalizar não cobre (nunca soma 0)', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', '2026-01-01', dia(10))],
      yt_reporting_reports: [relatorio(dia(1), 'vazio', true), relatorio(dia(2), 'listado', false), relatorio(dia(3), 'baixado', false), relatorio(dia(4), 'baixado', true)],
      yt_own_video_reach_daily: [reach(V, dia(4), 9)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(s.estado('impressoes_total', V, dia(1))).toEqual({ tipo: 'zero_medido' }) // vazio e normalizado, sem linha
    expect(s.estado('impressoes_total', V, dia(2))).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
    expect(s.estado('impressoes_total', V, dia(3))).toMatchObject({ tipo: 'nao_medido', motivo: 'fora_da_cobertura' })
    expect(s.somar('impressoes_total', V, [dia(3)])).toEqual({ nao_medido: 'cobertura', diasSemCobertura: 1 })
    expect(s.somar('impressoes_total', V, [dia(1), dia(4)])).toEqual({ soma: 9 })
  })

  it('R2: impressão nula na linha = sem_valor (e a base de R3 sai do dia), nunca 0', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', '2026-01-01', dia(10))],
      yt_reporting_reports: [relatorio(dia(1), 'baixado', true)],
      yt_own_video_reach_daily: [reach(V, dia(1), null)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(s.somar('impressoes_total', V, [dia(1)])).toEqual({ nao_medido: 'sem_valor', diasSemCobertura: 1 })
  })

  it('R3: soma aparelhos e sistemas do código; o código 8 não entra na métrica mas entra no total do dia; sem linha do código e soma < base é limiar', async () => {
    const d = dia(1)
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'alcance_dim', '2026-09-08', dia(10)), cob(V, 'base', '2026-01-01', dia(10))],
      yt_reporting_reports: [relatorio(d, 'baixado', true), relatorio(dia(2), 'baixado', true)],
      yt_own_video_reach_daily: [reach(V, d, 100), reach(V, dia(2), 50)],
      yt_own_video_reach_dim_daily: [
        reachDim(V, d, '5', 'MOBILE', 'ANDROID', 30), reachDim(V, d, '5', 'DESKTOP', 'WINDOWS', 20), reachDim(V, d, '8', 'MOBILE', 'IOS', 50),
        reachDim(V, dia(2), '8', 'MOBILE', 'IOS', 20), // total do dia 20 < base 50, sem linha de busca
      ],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(s.estado('impressoes_busca', V, d)).toEqual({ tipo: 'valor', views: 50, minutos: null })
    expect(s.estado('impressoes_canal', V, d)).toEqual({ tipo: 'zero_medido' }) // soma 100 = base 100, nenhuma linha do código 4
    expect(s.estado('impressoes_busca', V, dia(2))).toEqual({ tipo: 'zero_ou_abaixo_do_limiar' })
    expect(s.somar('impressoes_busca', V, [dia(2)])).toEqual({ nao_medido: 'limiar', diasSemCobertura: 1 })
  })

  it('R3: soma maior que a base é em_revisao para todo código', async () => {
    const d = dia(1)
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'alcance_dim', '2026-09-08', dia(10))],
      yt_reporting_reports: [relatorio(d, 'baixado', true)],
      yt_own_video_reach_daily: [reach(V, d, 10)],
      yt_own_video_reach_dim_daily: [reachDim(V, d, '5', 'MOBILE', 'ANDROID', 30)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(s.somar('impressoes_busca', V, [d])).toEqual({ nao_medido: 'em_revisao', diasSemCobertura: 1 })
    expect(s.somar('impressoes_canal', V, [d])).toEqual({ nao_medido: 'em_revisao', diasSemCobertura: 1 })
  })

  it('R4: origem pelo limiar contra R1 do mesmo vídeo e dia', async () => {
    const d = dia(1)
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'trafego', '2026-10-07', dia(10)), cob(V, 'base', '2026-01-01', dia(10))],
      yt_own_video_daily: [diario(V, d, 10)],
      yt_own_video_dim_daily: [dim(V, d, 'YT_SEARCH', 4), dim(V, d, 'RELATED_VIDEO', 6)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(s.somar('views_busca', V, [d])).toEqual({ soma: 4 })
    expect(s.somar('views_sugeridos', V, [d])).toEqual({ soma: 6 })
    expect(s.estado('views_inicio', V, d)).toEqual({ tipo: 'zero_medido' }) // soma 10 = base 10, sem linha de SUBSCRIBER
  })

  it('R5: presença; dia coberto sem a linha é "não apareceu" (nunca views 0); detail de outro vídeo não conta; nunca pede source_type 5', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'detalhe', '2026-09-08', dia(3))],
      yt_own_video_traffic_detail_daily: [
        detalhe(V, dia(1), '7', OUT), detalhe(V, dia(2), '7', 'outro-video'), detalhe(V, dia(3), '5', OUT),
      ],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA, outliersYt: [OUT] })
    expect(s.presenca(V, OUT, [dia(1), dia(2), dia(3)])).toEqual({ apareceu: 1, semCobertura: 0 })
    expect(s.presenca(V, OUT, [dia(4), dia(5)])).toEqual({ apareceu: 0, semCobertura: 2 }) // fora da cobertura
    const sels = db.selects.filter(x => x.table === 'yt_own_video_traffic_detail_daily')
    expect(sels).toHaveLength(1)
  })

  it('sem outlier a procurar, R5 não é lida', async () => {
    const db = fakeSupabase({})
    await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    expect(db.trips).not.toContain('yt_own_video_traffic_detail_daily')
  })

  it('10 pares do mesmo site: uma ida por fonte, não uma por par', async () => {
    const faixas = Array.from({ length: 10 }, (_, i) => ({ de: dia(i * 3 - 30), ate: dia(i * 3 - 30 + 58) }))
    const db = fakeSupabase({})
    await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V, W], faixas, outliersYt: [OUT] })
    for (const t of ['yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_own_video_reach_dim_daily', 'yt_own_video_dim_daily', 'yt_own_video_traffic_detail_daily', 'yt_reporting_reports']) {
      expect(db.trips.filter(x => x === t), t).toHaveLength(1)
    }
  })

  it('450 vídeos: blocos de 50 (9 idas por tabela de vídeo)', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `v${String(i).padStart(9, '0')}`)
    const db = fakeSupabase({})
    await lerSeriesDoSite(db.client, { siteId: S, ytIds: ids, faixas: FAIXA })
    expect(db.trips.filter(x => x === 'yt_own_video_daily')).toHaveLength(9)
    expect(db.trips.filter(x => x === 'yt_own_video_coverage')).toHaveLength(9)
    expect(db.trips.filter(x => x === 'yt_reporting_reports')).toHaveLength(1)
  })

  it('faixas distantes (placebo) não viram uma faixa gigante', () => {
    expect(juntarFaixas([{ de: '2026-10-01', ate: '2026-10-10' }, { de: '2026-10-11', ate: '2026-10-20' }, { de: '2025-10-01', ate: '2025-10-20' }]))
      .toEqual([{ de: '2025-10-01', ate: '2025-10-20' }, { de: '2026-10-01', ate: '2026-10-20' }])
  })

  it('tabela ausente lança (a tarefa traduz em schema_ausente), nunca vira zero', async () => {
    const db = fakeSupabase({}, { failOn: 'yt_own_video_daily', failCode: '42P01' })
    const erro = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA }).catch((e: unknown) => e)
    expect(ehSchemaAusenteDaMedida(erro)).toBe(true)
  })

  it('somarBraco: um vídeo sem cobertura derruba o braço; motivo mais forte; dias somados', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', '2026-01-01', dia(10))], // W sem cobertura
      yt_own_video_daily: [diario(V, dia(1), 5)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V, W], faixas: FAIXA })
    expect(s.somarBraco('views_total', [V], [dia(1), dia(2)])).toEqual({ soma: 5 })
    expect(s.somarBraco('views_total', [V, W], [dia(1), dia(2)])).toEqual({ nao_medido: 'cobertura', diasSemCobertura: 2 })
  })

  it('coberturaDeFecho: Analytics pelo covered_to do canal; reporting pelo fim do relatório; sem cobertura = nulo', async () => {
    const db = fakeSupabase({
      yt_own_video_coverage: [cob(V, 'base', '2026-01-01', dia(7)), cob(V, 'detalhe', '2026-09-08', dia(5))],
      yt_reporting_reports: [relatorio(dia(1), 'baixado', true), relatorio(dia(2), 'baixado', true)],
    })
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V, W], faixas: FAIXA })
    expect(s.coberturaDeFecho('R1', V)).toEqual({ ateReporting: null, ateAnalytics: dia(7) })
    expect(s.coberturaDeFecho('R5', V)).toEqual({ ateReporting: dia(6), ateAnalytics: null })
    expect(s.coberturaDeFecho('R2', V)).toEqual({ ateReporting: dia(3), ateAnalytics: null })
    expect(s.coberturaDeFecho('R4', V)).toEqual({ ateReporting: null, ateAnalytics: null })
    expect(s.coberturaDeFecho('R1', W)).toEqual({ ateReporting: null, ateAnalytics: null })
  })

  it('somarJanela do braço de 28 dias sem nenhum dado nunca devolve soma', async () => {
    const db = fakeSupabase({})
    const s = await lerSeriesDoSite(db.client, { siteId: S, ytIds: [V], faixas: FAIXA })
    const r = somarJanela(new Map(), dias(-28, -1), s.estadoDe('impressoes_total', V))
    expect('soma' in r).toBe(false)
  })
})
