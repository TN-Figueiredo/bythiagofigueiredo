// @vitest-environment node
// Leitores do canal próprio contra o Postgres LOCAL (PostgREST de verdade: limite de 1000 linhas, tipos bigint/numeric).
// Semeia e limpa o que semeou, só no banco local (HAS_LOCAL_DB=1).
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { SUPABASE_URL, SERVICE_KEY, seedSite, seedYoutubeChannelAndVideo } from '../../helpers/db-seed'
import { edicaoDe } from './edicao-teste'
import { lerAlcance, lerDiario, TIPO_ALCANCE, TETO_VIDEOS_DIARIO } from '@/lib/youtube/observatorio/proprio/ler'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: async () => ({ ok: true, user: { id: 'u1' } }) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

describe.skipIf(skipIfNoLocalDb())('leitores do canal próprio (banco local)', () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  const HOJE = dayPt(new Date())
  const d = (n: number) => addDays(HOJE, -n)
  const sites: string[] = []
  let siteId = '', canalId = '', outroSite = '', outroCanal = ''
  const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO }, (_, k) => 'seedv' + String(k).padStart(6, '0'))
  const dietaIds = Array.from({ length: TETO_VIDEOS_DIARIO }, (_, k) => 'seeddt' + String(k).padStart(5, '0'))

  beforeAll(async () => {
    siteId = (await seedSite(sb)).siteId; sites.push(siteId)
    outroSite = (await seedSite(sb)).siteId; sites.push(outroSite)
    canalId = (await seedYoutubeChannelAndVideo(sb, siteId)).channelId
    outroCanal = (await seedYoutubeChannelAndVideo(sb, outroSite)).channelId
    const ins = async (table: string, rows: Record<string, unknown>[]) => {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await sb.from(table).insert(rows.slice(i, i + 500))
        if (error) throw new Error(table + ': ' + error.message)
      }
    }
    const mv = 'views_desde_2026-08-27'
    // 50 vídeos x 28 dias = 1400 linhas (> 1000: prova a paginação) + 1 linha de OUTRO site com o mesmo vídeo de outro id
    await ins('yt_own_video_daily', [
      ...ytIds.flatMap(y => Array.from({ length: 28 }, (_, k) => ({ youtube_video_id: y, day_pt: d(k + 3), site_id: siteId, channel_id: canalId, views: k === 0 ? 0 : k, metric_version: mv }))),
      { youtube_video_id: 'seedoutro01', day_pt: d(3), site_id: outroSite, channel_id: outroCanal, views: 99, metric_version: mv },
      { youtube_video_id: ytIds[0], day_pt: d(300), site_id: siteId, channel_id: canalId, views: 7, metric_version: mv },
      // % assistido e duração média: numeric do Postgres, na unidade da coleta (pontos de 0 a 100)
      { youtube_video_id: 'seedpct0001', day_pt: d(4), site_id: siteId, channel_id: canalId, views: 40, avg_view_percentage: 51.5, avg_view_duration_seconds: 212.25, metric_version: mv },
      { youtube_video_id: 'seedpct0001', day_pt: d(5), site_id: siteId, channel_id: canalId, views: 0, avg_view_percentage: null, avg_view_duration_seconds: null, metric_version: mv },
    ])
    // A5 E6 T5: dieta. 50 vídeos com 38 dias cobertos (cobertura base de d(40) a d(3)) e só 60 linhas com atividade, num vídeo-cobaia por
    // vídeo diferente dos acima; a cobertura de OUTRO site usa o mesmo id de vídeo e não pode vazar.
    await ins('yt_own_video_daily', dietaIds.flatMap((y, k) => [
      { youtube_video_id: y, day_pt: d(10), site_id: siteId, channel_id: canalId, views: 3, metric_version: mv },
      ...(k < 10 ? [{ youtube_video_id: y, day_pt: d(20), site_id: siteId, channel_id: canalId, views: 1, metric_version: mv }] : []),
    ]))
    await ins('yt_own_video_coverage', [
      ...dietaIds.map(y => ({ youtube_video_id: y, metric_set: 'base', covered_from: d(40), covered_to: d(3), site_id: siteId, channel_id: canalId })),
      { youtube_video_id: dietaIds[0], metric_set: 'base', covered_from: d(2), covered_to: d(1), site_id: outroSite, channel_id: outroCanal },
    ])
    await ins('yt_own_video_reach_daily', [
      { youtube_video_id: ytIds[0], day_pt: d(3), site_id: siteId, channel_id: canalId, thumbnail_impressions: 120, thumbnail_ctr: 0.0425, source_report_id: 'seed-r1', report_create_time: new Date().toISOString(), metric_version: mv },
      { youtube_video_id: 'seedoutro01', day_pt: d(3), site_id: outroSite, channel_id: outroCanal, thumbnail_impressions: 999, thumbnail_ctr: 0.5, source_report_id: 'seed-r2', report_create_time: new Date().toISOString(), metric_version: mv },
    ])
    const rel = (id: string, dia: string, status: string, site: string, canal: string, normalizado: boolean) => ({
      report_id: id, site_id: site, job_id: 'seed-job', channel_id: canal, report_type_id: TIPO_ALCANCE, start_time: dia + 'T07:00:00Z', end_time: addDays(dia, 1) + 'T07:00:00Z',
      create_time: new Date().toISOString(), download_url: 'https://example.invalid/x', status, normalized_at: normalizado ? new Date().toISOString() : null,
    })
    await ins('yt_reporting_reports', [
      rel('seed-rep-1-' + siteId, d(3), 'baixado', siteId, canalId, true),
      rel('seed-rep-2-' + siteId, d(4), 'vazio', siteId, canalId, true),
      rel('seed-rep-3-' + siteId, d(5), 'listado', siteId, canalId, false),
      rel('seed-rep-4-' + outroSite, d(3), 'baixado', outroSite, outroCanal, true),
    ])
  }, 60_000)

  afterAll(async () => {
    for (const s of sites) {
      for (const t of ['yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_video_reach_daily', 'yt_reporting_reports']) await sb.from(t).delete().eq('site_id', s)
    }
    for (const c of [canalId, outroCanal]) if (c) { await sb.from('youtube_videos').delete().eq('channel_id', c); await sb.from('youtube_channels').delete().eq('id', c) }
    for (const s of sites) await sb.from('sites').delete().eq('id', s)
  }, 60_000)

  it('diário: 1400 linhas passam do limite de 1000 e chegam inteiras; zero medido continua 0; nada de outro site nem fora da janela', async () => {
    const r = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE, ytIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toHaveLength(TETO_VIDEOS_DIARIO * 28)
    expect(r.dado.ultimoDia).toBe(d(3))
    expect(r.dado.linhas.find(l => l.ytId === ytIds[0] && l.dia === d(3))?.views).toBe(0)
    expect(r.dado.linhas.some(l => l.dia === d(300))).toBe(false)
  })
  it('diário: avg_view_percentage e avg_view_duration_seconds (numeric) chegam como número, na unidade da coleta (51,5 continua 51,5) e dia sem view fica nulo', async () => {
    const r = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE, ytIds: ['seedpct0001'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([
      { ytId: 'seedpct0001', dia: d(5), views: 0, pctAssistido: null, duracaoMediaSeg: null },
      { ytId: 'seedpct0001', dia: d(4), views: 40, pctAssistido: 51.5, duracaoMediaSeg: 212.25 },
    ])
    expect(r.dado.descartados).toBe(0)
  })
  it('diário: o id de um canal de outro site não alcança o dado dele', async () => {
    const r = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE, ytIds: ['seedoutro01'] })
    // nenhuma linha do vídeo de outro site; o último dia é o do PRÓPRIO canal (consulta sem janela e sem filtro de vídeo)
    expect(r).toEqual({ acesso: 'ok', dado: { canalId, ultimoDia: d(3), linhas: [], foraDoTeto: [], descartados: 0 } })
    const r2 = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId: outroCanal, hoje: HOJE, ytIds: ['seedoutro01'] })
    expect(r2.acesso === 'ok' && r2.dado.linhas.length).toBe(0)
    expect(r2.acesso === 'ok' && r2.dado.ultimoDia).toBeNull() // o dia 'd(3)' do outro site não vaza
  })
  it('dieta: 50 vídeos x 38 dias cobertos e só 60 linhas com atividade devolvem 1.900 linhas (paginação dos intervalos e materialização)', async () => {
    const r = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE, ytIds: dietaIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(3))
    expect(r.dado.linhas).toHaveLength(TETO_VIDEOS_DIARIO * 38)
    const reais = r.dado.linhas.filter(l => (l.views ?? 0) > 0)
    expect(reais).toHaveLength(60)
    expect(r.dado.linhas.filter(l => l.views === 0)).toHaveLength(TETO_VIDEOS_DIARIO * 38 - 60)
    expect(r.dado.linhas.filter(l => l.pctAssistido != null || l.duracaoMediaSeg != null)).toHaveLength(0)
  })
  it('dieta: a cobertura de outro site com o mesmo id de vídeo não vaza (nem no último dia, nem em zeros)', async () => {
    const r = await lerDiario(sb, { edicao: await edicaoDe(outroSite), canalId: outroCanal, hoje: HOJE, ytIds: [dietaIds[0]!] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    // só os 2 dias do outro site (d(2) e d(1)); nada do intervalo d(40)..d(3) do primeiro site
    expect(r.dado.ultimoDia).toBe(d(1))
    expect(r.dado.linhas.map(l => l.dia)).toEqual([d(2), d(1)])
    const meu = await lerDiario(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE, ytIds: [dietaIds[0]!] })
    if (meu.acesso !== 'ok') throw new Error('esperava ok')
    expect(meu.dado.linhas.some(l => l.dia === d(2) || l.dia === d(1))).toBe(false)
  })
  it('alcance: relatórios com os três estados, linhas com bigint/numeric já como número, só do site e canal', async () => {
    const r = await lerAlcance(sb, { edicao: await edicaoDe(siteId), canalId, hoje: HOJE })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toHaveLength(3)
    expect(r.dado.relatorios).toEqual(expect.arrayContaining([
      { dia: d(3), status: 'baixado', normalizado: true }, { dia: d(4), status: 'vazio', normalizado: true }, { dia: d(5), status: 'listado', normalizado: false },
    ]))
    expect(r.dado.linhas).toEqual([{ ytId: ytIds[0], dia: d(3), imp: 120, ctr: 0.0425 }])
  })
  it('quem não edita: negado, sem consulta', async () => {
    expect(await lerAlcance(sb, { edicao: null, canalId, hoje: HOJE })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(sb, { edicao: null, canalId, hoje: HOJE, ytIds })).toEqual({ acesso: 'negado' })
  })
})
