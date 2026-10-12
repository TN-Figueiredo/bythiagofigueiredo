// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { lerAlcance, lerDiario, TIPO_ALCANCE, TETO_VIDEOS_DIARIO } from '@/lib/youtube/observatorio/proprio/ler'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'

const S = 'site-a', C = 'canal-1', HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const relatorio = (dia: string, status: string, norm: boolean, over: Row = {}): Row => ({
  report_id: 'r-' + dia + '-' + status, site_id: S, channel_id: C, report_type_id: TIPO_ALCANCE, status,
  start_time: dia + 'T07:00:00+00:00', end_time: addDays(dia, 1) + 'T07:00:00+00:00', normalized_at: norm ? dia + 'T12:00:00+00:00' : null, ...over,
})
const alcance = (yt: string, dia: string, imp: number | null, ctr: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, thumbnail_impressions: imp, thumbnail_ctr: ctr, ...over })
const diario = (yt: string, dia: string, views: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, ...over })
const pedido = { siteId: S, canalId: C, hoje: HOJE, podeEditar: true }

describe('lerAlcance', () => {
  it('quem não edita o site: negado e NENHUMA consulta', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)] })
    expect(await lerAlcance(db.client, { ...pedido, podeEditar: false })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('tabelas vazias: ok com listas vazias (o modelo decide a frase), nunca um zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    expect(await lerAlcance(db.client, pedido)).toEqual({ acesso: 'ok', dado: { canalId: C, relatorios: [], linhas: [] } })
  })
  it('os três estados chegam ao modelo como vieram do banco', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3), 'baixado', true), relatorio(d(4), 'vazio', true), relatorio(d(5), 'listado', false)],
      yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.2)],
    })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual(expect.arrayContaining([
      { dia: d(3), status: 'baixado', normalizado: true }, { dia: d(4), status: 'vazio', normalizado: true }, { dia: d(5), status: 'listado', normalizado: false },
    ]))
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 5, ctr: 0.2 }])
  })
  it('nulo do banco continua nulo; número que veio como texto vira número; texto que não é número vira nulo', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), null, null), alcance('v2', d(3), '7' as unknown as number, '0.5' as unknown as number), alcance('v3', d(3), 'x' as unknown as number, null)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), imp: null, ctr: null }, { ytId: 'v2', dia: d(3), imp: 7, ctr: 0.5 }, { ytId: 'v3', dia: d(3), imp: null, ctr: null }]))
  })
  it('só o site, só o canal, só o tipo de alcance, só a janela', async () => {
    const db = fakeSupabase({
      yt_reporting_reports: [relatorio(d(3), 'baixado', true), relatorio(d(3), 'baixado', true, { report_id: 'x1', site_id: 'outro' }), relatorio(d(3), 'baixado', true, { report_id: 'x2', channel_id: 'outro' }), relatorio(d(3), 'baixado', true, { report_id: 'x3', report_type_id: 'channel_basic_a3' }), relatorio(d(90), 'baixado', true)],
      yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.2), alcance('v8', d(3), 5, 0.2, { site_id: 'outro' }), alcance('v9', d(3), 5, 0.2, { channel_id: 'outro' }), alcance('v1', d(90), 5, 0.2)],
    })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual([{ dia: d(3), status: 'baixado', normalizado: true }])
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 5, ctr: 0.2 }])
  })
  it('status fora da lista conhecida vira "desconhecido"', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'novo_status', true)], yt_own_video_reach_daily: [] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios[0]!.status).toBe('desconhecido')
  })
  it('erro do banco é lançado, nunca vira lista vazia', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] }, { failOn: 'yt_own_video_reach_daily' })
    await expect(lerAlcance(db.client, pedido)).rejects.toThrow()
  })
  it('erro na tabela de relatórios também é lançado', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] }, { failOn: 'yt_reporting_reports' })
    await expect(lerAlcance(db.client, pedido)).rejects.toThrow()
  })
  it('mais de 1000 linhas na janela: pagina e não trunca calada', async () => {
    const linhas = Array.from({ length: 2300 }, (_, k) => alcance('v' + k, d(3), 1, 0.1))
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: linhas })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toHaveLength(2300)
    expect(db.trips.filter(t => t === 'yt_own_video_reach_daily').length).toBeGreaterThanOrEqual(3)
  })
  it('toda consulta pede só colunas que o leitor usa (nunca select *)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    await lerAlcance(db.client, pedido)
    expect(db.selects.length).toBe(2)
    for (const s of db.selects) expect(s.cols).not.toContain('*')
  })
})

describe('lerDiario', () => {
  it('negado sem consulta; lista de vídeos vazia não consulta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] })
    expect(await lerDiario(db.client, { ...pedido, podeEditar: false, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { ...pedido, ytIds: [] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: null, linhas: [] } })
    expect(db.trips).toEqual([])
  })
  it('tabela vazia com vídeos pedidos: ok, ultimoDia null, nenhuma linha', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] })
    expect(await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: null, linhas: [] } })
  })
  it('linha com views 0 é ZERO medido (0, não null); views nulas ficam null; dia sem linha não existe na resposta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 0), diario('v1', d(4), null), diario('v1', d(6), 9)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(3))
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), views: 0 }, { ytId: 'v1', dia: d(4), views: null }, { ytId: 'v1', dia: d(6), views: 9 }]))
    expect(r.dado.linhas).toHaveLength(3)
  })
  it('views que vieram como texto viram número; texto que não é número vira nulo (nunca zero)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), '12' as unknown as number), diario('v1', d(4), 'x' as unknown as number)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), views: 12 }, { ytId: 'v1', dia: d(4), views: null }]))
  })
  it('nunca lê o histórico inteiro: fora da janela, de outro vídeo, de outro site ou de outro canal não vem', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 1), diario('v1', d(200), 1), diario('v2', d(3), 1), diario('v1', d(4), 1, { site_id: 'outro' }), diario('v1', d(5), 1, { channel_id: 'outro' })] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 1 }])
  })
  it('acima do teto de vídeos: lê os primeiros TETO_VIDEOS_DIARIO da lista', async () => {
    const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO + 5 }, (_, k) => 'v' + k)
    const db = fakeSupabase({ yt_own_video_daily: ytIds.map(y => diario(y, d(3), 1)) })
    const r = await lerDiario(db.client, { ...pedido, ytIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(new Set(r.dado.linhas.map(l => l.ytId)).size).toBe(TETO_VIDEOS_DIARIO)
  })
  it('50 vídeos x 38 dias (1900 linhas): pagina e não trunca calada', async () => {
    const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO }, (_, k) => 'v' + k)
    const linhas = ytIds.flatMap(y => Array.from({ length: 38 }, (_, k) => diario(y, d(k), k)))
    const db = fakeSupabase({ yt_own_video_daily: linhas })
    const r = await lerDiario(db.client, { ...pedido, ytIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toHaveLength(1900)
    expect(db.trips.length).toBeGreaterThanOrEqual(2)
  })
  it('erro do banco é lançado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).rejects.toThrow()
  })
})

describe('contrato da fonte (unidade do CTR e linha repetida)', () => {
  it('CTR fora de 0 a 1 (percentual, negativo) é LANÇADO: não passa calado nem vira clique', async () => {
    for (const ctr of [5.2, 1.0001, -0.1]) {
      const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 100, ctr)] })
      await expect(lerAlcance(db.client, pedido)).rejects.toThrow(/thumbnail_ctr/)
    }
  })
  it('CTR nos extremos 0 e 1 passa (zero medido é zero)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 100, 0), alcance('v2', d(3), 1, 1)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas.map(l => l.ctr)).toEqual([0, 1])
  })
  it('alcance repetido para (vídeo, dia): uma linha só, a de coleta mais recente', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [
      alcance('v1', d(3), 10, 0.1, { collected_at: '2026-10-10T10:00:00Z' }), alcance('v1', d(3), 20, 0.2, { collected_at: '2026-10-11T10:00:00Z' }), alcance('v1', d(3), 5, 0.3, { collected_at: '2026-10-09T10:00:00Z' }),
    ] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 20, ctr: 0.2 }])
  })
  it('diário repetido para (vídeo, dia): uma linha só, a de coleta mais recente (sem coleta perde)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [
      diario('v1', d(3), 2, { collected_at: '2026-10-10T10:00:00Z' }), diario('v1', d(3), 1, { collected_at: '2026-10-11T10:00:00Z' }), diario('v1', d(3), 3),
    ] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 1 }])
  })
})
