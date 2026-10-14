// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe, leituraPorDireitoDe } from './leitura-teste'
import { edicaoDe } from './edicao-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerAlcance, lerDiario, TIPO_ALCANCE, TETO_VIDEOS_DIARIO, PCT_ASSISTIDO_MAX } from '@/lib/youtube/observatorio/proprio/ler'
import { dayPt, addDays } from '@/lib/youtube/coleta/day-pt'
import { vpdDoCanal, motivoVpdTexto } from '@/lib/youtube/observatorio/proprio/vpd'
import { diarioDoVideo } from '@/lib/youtube/coleta/analytics-diario'
import { assistidoDoVideo } from '@/lib/youtube/observatorio/proprio/assistido'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import * as Sentry from '@sentry/nextjs'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', HOJE = dayPt(new Date())
const d = (n: number) => addDays(HOJE, -n)
const relatorio = (dia: string, status: string, norm: boolean, over: Row = {}): Row => ({
  report_id: 'r-' + dia + '-' + status, site_id: S, channel_id: C, report_type_id: TIPO_ALCANCE, status,
  start_time: dia + 'T07:00:00+00:00', end_time: addDays(dia, 1) + 'T07:00:00+00:00', normalized_at: norm ? dia + 'T12:00:00+00:00' : null, ...over,
})
const alcance = (yt: string, dia: string, imp: number | null, ctr: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, thumbnail_impressions: imp, thumbnail_ctr: ctr, ...over })
const diario = (yt: string, dia: string, views: number | null, over: Row = {}): Row => ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, ...over })
const SEM_MEDIAS = { pctAssistido: null, duracaoMediaSeg: null }
let pedido: { leitura: LeituraPrivadaDoSite | null; canalId: string; hoje: string }
beforeAll(async () => { pedido = { leitura: await leituraDe(S), canalId: C, hoje: HOJE } })

describe('o token de edição', () => {
  it('um objeto de fora (forjado, sem passar pela guarda) não abre nada: negado e nenhuma consulta', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)], yt_own_video_daily: [diario('v1', d(3), 4)] })
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    const forjado: LeituraPrivadaDoSite = { siteId: S }
    expect(await lerAlcance(db.client, { ...pedido, leitura: forjado })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { ...pedido, leitura: forjado, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('o site das consultas é o do token, não outro: dado de outro site não aparece', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)] })
    const r = await lerAlcance(db.client, { ...pedido, leitura: await leituraDe('outro-site') })
    expect(r).toMatchObject({ acesso: 'ok', dado: { linhas: [] } })
  })
})

describe('lerAlcance', () => {
  it('quem não edita o site: negado e NENHUMA consulta', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)] })
    expect(await lerAlcance(db.client, { ...pedido, leitura: null })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('tabelas vazias: ok com listas vazias (o modelo decide a frase), nunca um zero', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    expect(await lerAlcance(db.client, pedido)).toEqual({ acesso: 'ok', dado: { canalId: C, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 } })
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
  it('coleta parada há 60 dias: série vazia na janela, mas o último relatório é aquele dia (não "nunca coletado")', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(60), 'baixado', true), relatorio(d(61), 'vazio', true)], yt_own_video_reach_daily: [alcance('v1', d(60), 5, 0.1)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual([]); expect(r.dado.linhas).toEqual([]); expect(r.dado.ultimoRelatorio).toBe(d(60))
  })
  it('o último relatório só olha o site, o canal e o tipo (relatório de outro canal ou tipo mais novo não conta) e pede uma linha', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(50), 'baixado', true), relatorio(d(1), 'baixado', true, { report_id: 'x1', channel_id: 'outro' }), relatorio(d(1), 'baixado', true, { report_id: 'x2', site_id: 'outro' }), relatorio(d(1), 'baixado', true, { report_id: 'x3', report_type_id: 'channel_basic_a3' })], yt_own_video_reach_daily: [] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoRelatorio).toBe(d(50))
    expect(db.ranges.some(x => x.table === 'yt_reporting_reports' && x.range?.[0] === 0 && x.range?.[1] === 0)).toBe(true)
  })
  it('fronteira da janela do alcance: o dia -35 entra, o -36 não (relatório e linha)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(35), 'baixado', true), relatorio(d(36), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(35), 5, 0.1), alcance('v2', d(36), 5, 0.1)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios.map(x => x.dia)).toEqual([d(35)])
    expect(r.dado.linhas.map(l => l.ytId)).toEqual(['v1'])
  })
  it('o dia do relatório é a data UTC de start_time, qualquer que seja o fuso da sessão do banco', async () => {
    const dia = d(3)
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(dia, 'baixado', true, { start_time: addDays(dia, -1) + 'T23:00:00-08:00' })], yt_own_video_reach_daily: [] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual([{ dia, status: 'baixado', normalizado: true }])
    expect(r.dado.ultimoRelatorio).toBe(dia)
  })
  it('start_time inválido: o relatório é descartado e contado, nenhuma exceção; os outros ficam', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true), relatorio(d(4), 'baixado', true, { report_id: 'ruim', start_time: 'lixo' })], yt_own_video_reach_daily: [] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.relatorios).toEqual([{ dia: d(3), status: 'baixado', normalizado: true }])
    expect(r.dado.descartados).toBe(1)
  })
  it('impressão negativa vira nula e conta como descartada; uma linha com impressão e CTR ruins conta uma vez', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), -5, 0.1), alcance('v2', d(3), -5, 7), alcance('v3', d(3), 9, 0.1)] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: null, ctr: 0.1 }, { ytId: 'v2', dia: d(3), imp: null, ctr: null }, { ytId: 'v3', dia: d(3), imp: 9, ctr: 0.1 }])
    expect(r.dado.descartados).toBe(2)
  })
  it('canalId que não é uuid: negado, sem consulta e sem lançar', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    expect(await lerAlcance(db.client, { ...pedido, canalId: "x'; drop" })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('toda consulta pede só colunas que o leitor usa (nunca select *)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    await lerAlcance(db.client, pedido)
    expect(db.selects.length).toBe(3)
    for (const s of db.selects) expect(s.cols).not.toContain('*')
  })
})

describe('lerDiario', () => {
  it('negado: nenhuma consulta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] })
    expect(await lerDiario(db.client, { ...pedido, leitura: null, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { ...pedido, leitura: null, ytIds: [] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('lista de vídeos vazia: não lê linhas, mas lê o último dia do canal (canal sem longo acompanhado com o diário cheio não é "nunca coletado")', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4), diario('v1', d(9), 2), diario('v9', d(1), 1, { site_id: 'outro' }), diario('v8', d(1), 1, { channel_id: 'outro' })] })
    expect(await lerDiario(db.client, { ...pedido, ytIds: [] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: d(3), linhas: [], foraDoTeto: [], descartados: 0 } })
    // A5 E6 T5: além do último dia do diário, lê o último dia coberto (1 linha); sem vídeos pedidos não lê linhas nem intervalos
    expect(db.trips).toEqual(['yt_own_video_daily', 'yt_own_video_coverage'])
    expect(db.ranges.map(r => r.range)).toEqual([[0, 0], [0, 0]])
  })
  it('lista de vídeos vazia e diário vazio: ultimoDia null (nunca coletado de verdade)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v9', d(1), 1, { site_id: 'outro' })] })
    expect(await lerDiario(db.client, { ...pedido, ytIds: [] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: null, linhas: [], foraDoTeto: [], descartados: 0 } })
  })
  it('lista de vídeos vazia e erro de banco: lança', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: [] })).rejects.toThrow()
  })
  it('tabela vazia com vídeos pedidos: ok, ultimoDia null, nenhuma linha', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] })
    expect(await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).toEqual({ acesso: 'ok', dado: { canalId: C, ultimoDia: null, linhas: [], foraDoTeto: [], descartados: 0 } })
  })
  it('linha com views 0 é ZERO medido (0, não null); views nulas ficam null; dia sem linha não existe na resposta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 0), diario('v1', d(4), null), diario('v1', d(6), 9)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(3))
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), views: 0, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(4), views: null, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(6), views: 9, ...SEM_MEDIAS }]))
    expect(r.dado.linhas).toHaveLength(3)
  })
  it('views que vieram como texto viram número; texto que não é número vira nulo (nunca zero)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), '12' as unknown as number), diario('v1', d(4), 'x' as unknown as number)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual(expect.arrayContaining([{ ytId: 'v1', dia: d(3), views: 12, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(4), views: null, ...SEM_MEDIAS }]))
  })
  it('nunca lê o histórico inteiro: fora da janela, de outro vídeo, de outro site ou de outro canal não vem', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 1), diario('v1', d(200), 1), diario('v2', d(3), 1), diario('v1', d(4), 1, { site_id: 'outro' }), diario('v1', d(5), 1, { channel_id: 'outro' })] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 1, ...SEM_MEDIAS }])
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
  it('coleta parada há 60 dias: ultimoDia é aquele dia (não "nunca coletado") e a janela vem dele para trás, não de hoje', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(60), 3), diario('v1', d(61), 3), diario('v1', d(120), 3)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas.map(l => l.dia).sort()).toEqual([d(61), d(60)]); expect(r.dado.ultimoDia).toBe(d(60))
    expect(db.ranges.some(x => x.table === 'yt_own_video_daily' && x.range?.[0] === 0 && x.range?.[1] === 0)).toBe(true)
  })
  it('ultimoDia só olha o site e o canal: dia mais novo de outro site ou canal não conta', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(10), 3), diario('v9', d(1), 3, { site_id: 'outro' }), diario('v9', d(2), 3, { channel_id: 'outro' })] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(10))
  })
  it('fronteira da janela do diário (ancorada no último dia medido): o dia -38 antes dele entra, o -39 não', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(10), 1), diario('v1', d(48), 1), diario('v1', d(49), 1)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas.map(l => l.dia).sort()).toEqual([d(48), d(10)])
    expect(r.dado.ultimoDia).toBe(d(10))
  })
  it('diário parado há 20 dias: a janela de 28 dias que termina no ÚLTIMO dia gravado vem inteira (do dia -47 ao -20)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(20), 5), diario('v1', d(47), 5), diario('v1', d(30), 5), diario('v1', d(60), 5)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.ultimoDia).toBe(d(20))
    const dias = r.dado.linhas.map(l => l.dia)
    expect(dias).toEqual(expect.arrayContaining([d(20), d(30), d(47)]))
    expect(dias).not.toContain(d(60))
  })
  it('a leitura acompanha o último dia: pelo vídeo do vídeo parado há 20 dias o % assistido usa os 28 dias, não os 8 que sobrariam', async () => {
    const linhas = Array.from({ length: 28 }, (_, k) => diario('v1', d(20 + k), 10, { avg_view_percentage: 50 }))
    const db = fakeSupabase({ yt_own_video_daily: linhas })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    expect(assistidoDoVideo(r, 'v1').dias).toBe(28)
  })
  it('custo: a leitura do diário continua sendo o último dia (1 linha) mais as páginas das linhas, nunca uma ida por vídeo', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(20), 5), diario('v2', d(20), 5)] })
    await lerDiario(db.client, { ...pedido, ytIds: ['v1', 'v2'] })
    // A5 E6 T5: o último dia do diário e o último dia coberto (1 linha cada), depois as páginas das linhas e dos intervalos
    expect(db.trips).toEqual(['yt_own_video_daily', 'yt_own_video_coverage', 'yt_own_video_daily', 'yt_own_video_coverage'])
  })
  it('views negativas viram nulas e contam como descartadas', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), -4), diario('v1', d(4), 6)] })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(4), views: 6, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(3), views: null, ...SEM_MEDIAS }])
    expect(r.dado.descartados).toBe(1)
  })
  it('canalId que não é uuid: negado, sem consulta e sem lançar', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] })
    expect(await lerDiario(db.client, { ...pedido, canalId: 'canal-1', ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('nenhuma consulta do diário pede select *', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 4)] })
    await lerDiario(db.client, { ...pedido, ytIds: ['v1'] })
    expect(db.selects.length).toBe(4) // A5 E6 T5: duas do diário e duas da cobertura
    for (const x of db.selects) expect(x.cols).not.toContain('*')
  })
  it('erro do banco é lançado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).rejects.toThrow()
  })
})

describe('contrato da fonte (unidade do CTR e linha repetida)', () => {
  it('CTR fora de 0 a 1 (percentual, negativo) NÃO derruba a leitura: a linha passa com CTR nulo e a impressão fica', async () => {
    for (const ctr of [5.2, 1.0001, -0.1]) {
      const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 100, ctr)] })
      const r = await lerAlcance(db.client, pedido)
      if (r.acesso !== 'ok') throw new Error('esperava ok')
      expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 100, ctr: null }])
      expect(r.dado.descartados).toBe(1)
    }
  })
  it('a contagem de CTR descartado soma só as linhas estragadas: boas, nulas e extremos não entram', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [
      alcance('v1', d(3), 100, 33.3), alcance('v2', d(3), 100, 0.04), alcance('v3', d(3), 100, null), alcance('v4', d(3), 100, 0), alcance('v5', d(3), 100, 1), alcance('v6', d(2), 50, -1),
    ] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.descartados).toBe(2)
    expect(r.dado.linhas.map(l => l.ctr).sort()).toEqual([0, 0.04, 1, null, null, null].sort())
  })
  it('linha repetida: só a que vence conta no descarte (a perdedora estragada não)', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [
      alcance('v1', d(3), 10, 0.1, { collected_at: '2026-10-11T10:00:00Z' }), alcance('v1', d(3), 20, 9, { collected_at: '2026-10-09T10:00:00Z' }),
    ] })
    const r = await lerAlcance(db.client, pedido)
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), imp: 10, ctr: 0.1 }])
    expect(r.dado.descartados).toBe(0)
  })
  it('erro de consulta continua lançando mesmo com CTR estragado na outra tabela', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [alcance('v1', d(3), 100, 5)] }, { failOn: 'yt_reporting_reports' })
    await expect(lerAlcance(db.client, pedido)).rejects.toThrow()
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
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 1, ...SEM_MEDIAS }])
  })
})

describe('leitor do diário + views por dia: canal sem longo acompanhado', () => {
  const dm = (x: string) => x.slice(8) + '/' + x.slice(5, 7)
  it('canal com o diário cheio e nenhum longo acompanhado: sem-longos (a coleta gravou); canal sem vídeo nenhum: sem-diario', async () => {
    const cheio = fakeSupabase({ yt_own_video_daily: [diario('curto', d(3), 4)] })
    const a = await lerDiario(cheio.client, { ...pedido, ytIds: [] })
    const va = vpdDoCanal(a, [], HOJE)
    expect(va).toMatchObject({ valor: null, motivo: 'sem-longos', ultimoDia: d(3) })
    expect(motivoVpdTexto(va.motivo!, va, dm)).toBe('nenhum vídeo longo acompanhado')
    const vazio = fakeSupabase({ yt_own_video_daily: [] })
    const vb = vpdDoCanal(await lerDiario(vazio.client, { ...pedido, ytIds: [] }), [], HOJE)
    expect(vb).toMatchObject({ valor: null, motivo: 'sem-diario' })
    expect(motivoVpdTexto(vb.motivo!, vb, dm)).toBe('ainda não há coleta diária deste canal')
  })
  it('canal parado há semanas e sem longo acompanhado: "parou em dd/mm", não "ainda não gravou"', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('curto', d(60), 4)] })
    const v = vpdDoCanal(await lerDiario(db.client, { ...pedido, ytIds: [] }), [], HOJE)
    expect(v).toMatchObject({ motivo: 'diario-parado', ultimoDia: d(60) })
    expect(motivoVpdTexto(v.motivo!, v, dm)).toBe('a coleta diária deste canal parou em ' + dm(d(60)))
  })
})

describe('lerDiario: % assistido e duração média (colunas avg_view_percentage e avg_view_duration_seconds)', () => {
  const ler = async (rows: Row[]) => {
    const db = fakeSupabase({ yt_own_video_daily: rows })
    const r = await lerDiario(db.client, { ...pedido, ytIds: ['v1', 'v2'] })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    return { r, db }
  }
  const medias = (extra: Row): Row => extra
  it('as duas colunas chegam como pctAssistido e duracaoMediaSeg', async () => {
    const { r } = await ler([diario('v1', d(3), 40, medias({ avg_view_percentage: 51.5, avg_view_duration_seconds: 210 }))])
    expect(r.dado.linhas).toEqual([{ ytId: 'v1', dia: d(3), views: 40, pctAssistido: 51.5, duracaoMediaSeg: 210 }])
  })
  it('nulo do banco continua nulo e coluna ausente também: nunca 0', async () => {
    const { r } = await ler([diario('v1', d(3), 0, medias({ avg_view_percentage: null, avg_view_duration_seconds: null })), diario('v1', d(4), 7)])
    const por = (dia: string) => r.dado.linhas.find(l => l.dia === dia)!
    expect(por(d(3))).toMatchObject({ pctAssistido: null, duracaoMediaSeg: null })
    expect(por(d(4))).toMatchObject({ pctAssistido: null, duracaoMediaSeg: null })
  })
  it('numeric chega como texto do PostgREST: "51.5" vira 51,5; texto que não é número vira nulo (nunca 0)', async () => {
    const { r } = await ler([diario('v1', d(3), 5, medias({ avg_view_percentage: '51.5', avg_view_duration_seconds: '210.25' })), diario('v1', d(4), 5, medias({ avg_view_percentage: 'x', avg_view_duration_seconds: '  ' }))])
    const por = (dia: string) => r.dado.linhas.find(l => l.dia === dia)!
    expect(por(d(3))).toMatchObject({ pctAssistido: 51.5, duracaoMediaSeg: 210.25 })
    expect(por(d(4))).toMatchObject({ pctAssistido: null, duracaoMediaSeg: null })
    expect(r.dado.descartados).toBe(0)
  })
  it('as consultas pedem as duas colunas novas (e nada de select *)', async () => {
    const { db } = await ler([diario('v1', d(3), 4)])
    const diarioSel = db.selects.filter(x => x.table === 'yt_own_video_daily').map(x => x.cols)
    expect(diarioSel.some(c => c.includes('avg_view_percentage') && c.includes('avg_view_duration_seconds'))).toBe(true)
    for (const c of diarioSel) expect(c).not.toContain('*')
  })
  describe('contrato da unidade de avg_view_percentage: PONTOS (0 em diante), não fração', () => {
    it('os extremos 0 e 100 passam; 51,5 passa como 51,5 (sem multiplicar nem dividir por 100)', async () => {
      const { r } = await ler([diario('v1', d(3), 5, medias({ avg_view_percentage: 0 })), diario('v1', d(4), 5, medias({ avg_view_percentage: 100 })), diario('v1', d(5), 5, medias({ avg_view_percentage: 51.5 }))])
      expect(r.dado.linhas.map(l => l.pctAssistido)).toEqual([51.5, 100, 0])
      expect(r.dado.descartados).toBe(0)
    })
    it('0,5 é meio ponto percentual (0,5% assistido), não 50%: o leitor não reescala nem adivinha a unidade', async () => {
      const { r } = await ler([diario('v1', d(3), 5, medias({ avg_view_percentage: 0.5 }))])
      expect(r.dado.linhas[0]!.pctAssistido).toBe(0.5)
    })
    it('acima de 100 é dado VÁLIDO (o espectador reviu trechos): 100,01 e 139,38 passam sem descarte; PCT_ASSISTIDO_MAX = 999,99', async () => {
      const { r } = await ler([diario('v1', d(3), 9, medias({ avg_view_percentage: 100.01 })), diario('v1', d(4), 8, medias({ avg_view_percentage: 139.38 })), diario('v1', d(5), 7, medias({ avg_view_percentage: 999.99 }))])
      expect(r.dado.linhas.map(l => [l.views, l.pctAssistido])).toEqual([[7, 999.99], [8, 139.38], [9, 100.01]])
      expect(r.dado.descartados).toBe(0)
      expect(PCT_ASSISTIDO_MAX).toBe(999.99)
    })
    it('negativo ou acima do teto de sanidade (1000): nulo (não medido) e conta em descartados, a linha e as views ficam', async () => {
      const { r } = await ler([diario('v1', d(3), 9, medias({ avg_view_percentage: 1000 })), diario('v1', d(4), 8, medias({ avg_view_percentage: -1 }))])
      expect(r.dado.linhas.map(l => [l.views, l.pctAssistido])).toEqual([[8, null], [9, null]])
      expect(r.dado.descartados).toBe(2)
    })
    it('duração média negativa: nula e descartada; zero fica zero', async () => {
      const { r } = await ler([diario('v1', d(3), 9, medias({ avg_view_duration_seconds: -3 })), diario('v1', d(4), 9, medias({ avg_view_duration_seconds: 0 }))])
      expect(r.dado.linhas.map(l => l.duracaoMediaSeg)).toEqual([0, null])
      expect(r.dado.descartados).toBe(1)
    })
    it('linha com três valores ruins (views, % e duração) conta UMA vez em descartados', async () => {
      const { r } = await ler([diario('v1', d(3), -1, medias({ avg_view_percentage: 3000, avg_view_duration_seconds: -9 })), diario('v1', d(4), 5, medias({ avg_view_percentage: 50 }))])
      expect(r.dado.descartados).toBe(1)
    })
    it('a corrente inteira: o que a coleta grava da Analytics API (51,5) é o que o leitor entrega e o que o % assistido calcula', async () => {
      const resposta = { columnHeaders: ['day', 'views', 'averageViewDuration', 'averageViewPercentage'].map(name => ({ name, columnType: 'METRIC', dataType: 'FLOAT' })), rows: [[d(3), 40, 212, 51.5], [d(4), 60, 190, 41.5]] }
      const f = (async () => new Response(JSON.stringify(resposta), { status: 200 })) as typeof fetch
      const { dias } = await diarioDoVideo({ token: 't', canalUc: 'UCabc', videoId: 'vid12345678', inicio: d(4), fim: d(3), f })
      // o que a coleta decide gravar, coluna a coluna, é o número da API sem escala
      expect(dias.map(x => x.valores.avg_view_percentage)).toEqual([51.5, 41.5])
      const { r } = await ler(dias.map(x => diario('v1', x.day, x.valores.views ?? null, medias({ avg_view_percentage: x.valores.avg_view_percentage ?? null, avg_view_duration_seconds: x.valores.avg_view_duration_seconds ?? null }))))
      expect(r.dado.linhas.map(l => l.pctAssistido).sort()).toEqual([41.5, 51.5])
      const a = assistidoDoVideo({ acesso: 'ok', dado: r.dado }, 'v1')
      expect(a.pct).toBeCloseTo((40 * 51.5 + 60 * 41.5) / 100, 10)
      expect(a.pct).toBeGreaterThan(1) // pontos, nunca fração
    })
  })
})

// ── A5 · E6 · Tarefa 5: o leitor tolera os dois estados do banco (diário cheio de zeros × diário só com atividade + cobertura) ──
describe('lerDiario: cobertura (a dieta do diário, D13)', () => {
  const cobertura = (yt: string, de: string, ate: string, over: Row = {}): Row => ({
    youtube_video_id: yt, metric_set: 'base', covered_from: de, covered_to: ate, site_id: S, channel_id: C, collected_at: HOJE + 'T10:00:00Z', ...over,
  })
  const lerOk = async (db: ReturnType<typeof fakeSupabase>, ytIds: string[]) => {
    const r = await lerDiario(db.client, { ...pedido, ytIds })
    if (r.acesso !== 'ok') throw new Error('esperava ok')
    return r.dado
  }
  /** O cliente em que só a tabela da cobertura responde com um erro de banco de código `code`. */
  const comCoberturaFalhando = (db: ReturnType<typeof fakeSupabase>, code: string) => ({
    from: (t: string) => {
      if (t !== 'yt_own_video_coverage') return db.client.from(t)
      db.trips.push(t)
      const falha = { data: null, error: { code, message: 'x' } }
      const q: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order']) q[m] = () => q
      q.range = async () => falha
      return q
    },
  }) as unknown as typeof db.client

  it('o banco ANTES da dieta (todas as linhas) e DEPOIS (só as com atividade, mesma cobertura) devolvem exatamente as mesmas linhas', async () => {
    const dias = [10, 9, 8, 7, 6, 5, 4, 3]
    const atividade = new Map<string, number>([['v1|' + d(9), 4], ['v1|' + d(5), 2], ['v2|' + d(7), 9]])
    const cheio = ['v1', 'v2'].flatMap(y => dias.map(n => diario(y, d(n), atividade.get(y + '|' + d(n)) ?? 0)))
    const enxuto = ['v1', 'v2'].flatMap(y => dias.filter(n => atividade.has(y + '|' + d(n))).map(n => diario(y, d(n), atividade.get(y + '|' + d(n))!)))
    const cob = [cobertura('v1', d(10), d(3)), cobertura('v2', d(10), d(3))]
    const antes = await lerOk(fakeSupabase({ yt_own_video_daily: cheio, yt_own_video_coverage: cob }), ['v1', 'v2'])
    const depois = await lerOk(fakeSupabase({ yt_own_video_daily: enxuto, yt_own_video_coverage: cob }), ['v1', 'v2'])
    expect(antes.linhas).toHaveLength(16)
    expect(depois.linhas).toEqual(antes.linhas)
    expect(depois).toEqual(antes)
  })
  it('dia coberto sem linha vira views 0 com as médias nulas; dia fora da cobertura continua sem linha', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5)], yt_own_video_coverage: [cobertura('v1', d(8), d(4))] })
    const r = await lerOk(db, ['v1'])
    expect(r.linhas).toEqual([
      { ytId: 'v1', dia: d(8), views: 0, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(7), views: 0, ...SEM_MEDIAS },
      { ytId: 'v1', dia: d(6), views: 5, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(5), views: 0, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(4), views: 0, ...SEM_MEDIAS },
    ])
    expect(r.linhas.some(l => l.dia === d(3) || l.dia === d(9))).toBe(false)
  })
  it('canal parado: nenhuma linha na janela e cobertura até hoje - 3: ultimoDia é hoje - 3, há linhas de zero e a tela não diz "coleta parada"', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(100), 3)], yt_own_video_coverage: [cobertura('v1', d(40), d(3))] })
    const r = await lerOk(db, ['v1'])
    expect(r.ultimoDia).toBe(d(3))
    expect(r.linhas).toHaveLength(38) // d(40)..d(3): o intervalo, que começa dentro da janela de 39 dias
    expect(r.linhas.every(l => l.views === 0)).toBe(true)
    expect(r.linhas.at(-1)?.dia).toBe(d(3))
    const v = vpdDoCanal({ acesso: 'ok', dado: r }, ['v1'], HOJE)
    expect(v.motivo).not.toBe('diario-parado')
    expect(v.ultimoDia).toBe(d(3))
  })
  it('cobertura atrasada e linhas mais novas (o intervalo entre M e D): ultimoDia é a última linha', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(3), 6), diario('v1', d(9), 1)], yt_own_video_coverage: [cobertura('v1', d(20), d(8))] })
    const r = await lerOk(db, ['v1'])
    expect(r.ultimoDia).toBe(d(3))
    // a cobertura acaba em d(8): os dias d(7)..d(4) NÃO viram zero (não medido); só os dias até d(8) sem linha viram
    expect(r.linhas.some(l => l.dia === d(5))).toBe(false)
    expect(r.linhas.find(l => l.dia === d(3))).toEqual({ ytId: 'v1', dia: d(3), views: 6, ...SEM_MEDIAS })
    expect(r.linhas.find(l => l.dia === d(8))).toEqual({ ytId: 'v1', dia: d(8), views: 0, ...SEM_MEDIAS })
  })
  it('só a cobertura do conjunto base, do site e do canal do pedido, dos vídeos pedidos', async () => {
    const db = fakeSupabase({
      yt_own_video_daily: [diario('v1', d(5), 1)],
      yt_own_video_coverage: [
        cobertura('v1', d(7), d(5)),
        cobertura('v1', d(7), d(5), { metric_set: 'estendidas', covered_from: d(30), covered_to: d(0) }),
        cobertura('v1', d(7), d(5), { site_id: 'outro', covered_from: d(2), covered_to: d(1) }),
        cobertura('v1', d(7), d(5), { channel_id: 'outro', covered_from: d(2), covered_to: d(1) }),
        cobertura('v9', d(7), d(5)),
      ],
    })
    const r = await lerOk(db, ['v1'])
    expect(r.linhas.map(l => l.ytId + '|' + l.dia)).toEqual(['v1|' + d(7), 'v1|' + d(6), 'v1|' + d(5)])
    expect(r.ultimoDia).toBe(d(5))
  })
  it('cobertura com o mesmo id de vídeo em OUTRO site não vaza', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(5), 1)], yt_own_video_coverage: [cobertura('v1', d(30), d(0), { site_id: 'outro' })] })
    const r = await lerOk(db, ['v1'])
    expect(r.linhas).toEqual([{ ytId: 'v1', dia: d(5), views: 1, ...SEM_MEDIAS }])
    expect(r.ultimoDia).toBe(d(5))
  })
  it('cobertura com o mesmo id de vídeo em OUTRO canal não vaza (E17 passo 0, prova do filtro de canal da cobertura por vídeo)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(5), 1)], yt_own_video_coverage: [cobertura('v1', d(30), d(0), { channel_id: 'outro-canal' })] })
    const r = await lerOk(db, ['v1'])
    expect(r.linhas).toEqual([{ ytId: 'v1', dia: d(5), views: 1, ...SEM_MEDIAS }])
    expect(r.ultimoDia).toBe(d(5))
  })
  it('intervalo que termina antes da janela não gera linha', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(2), 1)], yt_own_video_coverage: [cobertura('v1', d(100), d(60)), cobertura('v1', d(50), d(2))] })
    const r = await lerOk(db, ['v1'])
    expect(r.linhas.every(l => l.dia >= addDays(d(2), -38))).toBe(true)
    expect(r.linhas).toHaveLength(39)
  })
  it('lista de vídeos vazia: não lê os intervalos, mas a cobertura do canal ainda diz o ultimoDia', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(30), 1)], yt_own_video_coverage: [cobertura('v1', d(40), d(3))] })
    const r = await lerOk(db, [])
    expect(r).toEqual({ canalId: C, ultimoDia: d(3), linhas: [], foraDoTeto: [], descartados: 0 })
    expect(db.ranges.map(x => x.table)).toEqual(['yt_own_video_daily', 'yt_own_video_coverage'])
  })
  it('só há cobertura (diário sem nenhuma linha): ultimoDia vem dela e os zeros são devolvidos', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: [cobertura('v1', d(5), d(3))] })
    const r = await lerOk(db, ['v1'])
    expect(r.ultimoDia).toBe(d(3))
    expect(r.linhas.map(l => l.dia)).toEqual([d(5), d(4), d(3)])
  })
  it('as consultas da cobertura pedem só colunas nomeadas (nunca select *) e a última é de uma linha só', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(5), 1)], yt_own_video_coverage: [cobertura('v1', d(7), d(5))] })
    await lerOk(db, ['v1'])
    const cob = db.selects.filter(x => x.table === 'yt_own_video_coverage')
    expect(cob).toHaveLength(2)
    for (const x of cob) expect(x.cols).not.toContain('*')
    expect(db.ranges.filter(x => x.table === 'yt_own_video_coverage')[0]!.range).toEqual([0, 0])
  })
  it('mais de 1000 intervalos: a leitura pagina e não trunca calada', async () => {
    const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO }, (_, k) => 'v' + k)
    // 1 intervalo de 1 dia por (vídeo, dia) em 25 dias: 1250 intervalos
    const cob = ytIds.flatMap(y => Array.from({ length: 25 }, (_, k) => cobertura(y, d(k + 3), d(k + 3))))
    const db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: cob })
    const r = await lerOk(db, ytIds)
    expect(r.linhas).toHaveLength(1250)
    expect(db.ranges.filter(x => x.table === 'yt_own_video_coverage').length).toBeGreaterThanOrEqual(3)
  })
  it('tabela de cobertura ausente (42P01): as mesmas linhas de hoje e o Sentry avisado UMA vez', async () => {
    vi.mocked(Sentry.captureMessage).mockClear()
    const base = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5), diario('v1', d(4), 0)] })
    const r = await lerOk({ ...base, client: comCoberturaFalhando(base, '42P01') }, ['v1'])
    expect(r.ultimoDia).toBe(d(4))
    expect(r.linhas).toEqual([{ ytId: 'v1', dia: d(6), views: 5, ...SEM_MEDIAS }, { ytId: 'v1', dia: d(4), views: 0, ...SEM_MEDIAS }])
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]![1]).toMatchObject({ tags: { component: 'observatorio-proprio', step: 'cobertura-ausente' } })
  })
  it('tabela de cobertura ausente pelo PostgREST (PGRST205) também segue sem cobertura', async () => {
    vi.mocked(Sentry.captureMessage).mockClear()
    const base = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5)] })
    const r = await lerOk({ ...base, client: comCoberturaFalhando(base, 'PGRST205') }, ['v1'])
    expect(r.linhas).toHaveLength(1)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('coluna ausente (42703) NÃO é "tabela ausente": lança', async () => {
    const base = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5)] })
    await expect(lerDiario(comCoberturaFalhando(base, '42703'), { ...pedido, ytIds: ['v1'] })).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('erro de banco na cobertura: lança ObservatoryLoadError (nunca vira lista vazia)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5)] }, { failOn: 'yt_own_video_coverage' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: ['v1'] })).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('erro de banco na cobertura com lista de vídeos vazia também lança', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_coverage' })
    await expect(lerDiario(db.client, { ...pedido, ytIds: [] })).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('sem prova de acesso: negado e NENHUMA consulta, nem à cobertura', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [diario('v1', d(6), 5)], yt_own_video_coverage: [cobertura('v1', d(7), d(3))] })
    expect(await lerDiario(db.client, { ...pedido, leitura: null, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('o teto de vídeos continua valendo: a cobertura dos vídeos além do teto não é lida', async () => {
    const ytIds = Array.from({ length: TETO_VIDEOS_DIARIO + 3 }, (_, k) => 'v' + k)
    const db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: ytIds.map(y => cobertura(y, d(5), d(5))) })
    const r = await lerOk(db, ytIds)
    expect(new Set(r.linhas.map(l => l.ytId)).size).toBe(TETO_VIDEOS_DIARIO)
    expect(r.foraDoTeto).toEqual(ytIds.slice(TETO_VIDEOS_DIARIO))
  })
})

describe('o token de LEITURA (E17 passo 0): quem só tem o direito também lê', () => {
  it('com o token de leitura nascido do DIREITO, sem edição, os dois leitores leem', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)], yt_own_video_daily: [diario('v1', d(3), 4)] })
    const leitura = await leituraPorDireitoDe('7c1d2e3f-5a47-4d0e-9b1c-7e6a2d4f8a99')
    expect(await lerAlcance(db.client, { leitura, canalId: C, hoje: HOJE })).toMatchObject({ acesso: 'ok' })
    expect(await lerDiario(db.client, { leitura, canalId: C, hoje: HOJE, ytIds: ['v1'] })).toMatchObject({ acesso: 'ok' })
  })
  it('com um EdicaoDoSite no lugar do token (por cast) os leitores negam e não consultam nada', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [relatorio(d(3), 'baixado', true)], yt_own_video_reach_daily: [alcance('v1', d(3), 5, 0.1)] })
    const leitura = (await edicaoDe(S)) as unknown as LeituraPrivadaDoSite
    expect(await lerAlcance(db.client, { leitura, canalId: C, hoje: HOJE })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { leitura, canalId: C, hoje: HOJE, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('com leitura null os leitores negam e não consultam nada', async () => {
    const db = fakeSupabase({ yt_reporting_reports: [], yt_own_video_reach_daily: [] })
    expect(await lerAlcance(db.client, { leitura: null, canalId: C, hoje: HOJE })).toEqual({ acesso: 'negado' })
    expect(await lerDiario(db.client, { leitura: null, canalId: C, hoje: HOJE, ytIds: ['v1'] })).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
})
