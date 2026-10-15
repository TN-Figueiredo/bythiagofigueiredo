// @vitest-environment node
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { fakeSupabase, type Row } from '../../helpers/fake-supabase'
import { leituraDe } from './leitura-teste'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { lerDiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'
import { totalDoPeriodo, cobreTodo, type DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import { ObservatoryLoadError } from '@/lib/youtube/observatorio/niches-db'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import * as Sentry from '@sentry/nextjs'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-a', C = '3f2b8c1e-5a47-4d0e-9b1c-7e6a2d4f8a10', OUTRO = '9a1b2c3d-5a47-4d0e-9b1c-7e6a2d4f8a99'
const ATE = '2026-09-30'
const d = (n: number) => addDays(ATE, -n)
const linha = (yt: string, dia: string, views: number | null, pct: number | null = 50, over: Row = {}): Row =>
  ({ youtube_video_id: yt, day_pt: dia, site_id: S, channel_id: C, views, avg_view_percentage: pct, ...over })
const cob = (yt: string, de: string, ate: string, over: Row = {}): Row =>
  ({ youtube_video_id: yt, covered_from: de, covered_to: ate, metric_set: 'base', site_id: S, channel_id: C, ...over })
let leitura: LeituraPrivadaDoSite
beforeAll(async () => { leitura = await leituraDe(S) })
const pedido = (extra: Partial<Parameters<typeof lerDiarioDoPeriodo>[1]> = {}) => ({
  leitura, canalId: C, hoje: ATE, ytIds: ['v1'], de: d(6), ate: ATE, soComViews: false, publicacoes: new Map([['v1', d(100)]]), ...extra,
})
const dado = async (db: ReturnType<typeof fakeSupabase>, extra: Partial<Parameters<typeof lerDiarioDoPeriodo>[1]> = {}): Promise<DiarioDoPeriodo> => {
  const r = await lerDiarioDoPeriodo(db.client, pedido(extra))
  if (r.acesso !== 'ok') throw new Error('esperava ok: ' + r.acesso)
  return r.dado
}

describe('lerDiarioDoPeriodo: guardas', () => {
  it('sem token: negado e zero consultas; objeto forjado: negado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [linha('v1', d(1), 5)] })
    expect(await lerDiarioDoPeriodo(db.client, pedido({ leitura: null }))).toEqual({ acesso: 'negado' })
    // @ts-expect-error literal não é um LeituraPrivadaDoSite
    expect(await lerDiarioDoPeriodo(db.client, pedido({ leitura: { siteId: S } }))).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('canal que não é uuid: negado sem consultar', async () => {
    const db = fakeSupabase({})
    expect(await lerDiarioDoPeriodo(db.client, pedido({ canalId: 'nao-uuid' }))).toEqual({ acesso: 'negado' })
    expect(db.trips).toEqual([])
  })
  it('de nulo sem soComViews: lança antes de consultar', async () => {
    const db = fakeSupabase({})
    await expect(lerDiarioDoPeriodo(db.client, pedido({ de: null, soComViews: false }))).rejects.toThrow(RangeError)
    expect(db.trips).toEqual([])
  })
  it('lista de vídeos vazia: linhas vazias, sem consultar o diário', async () => {
    const db = fakeSupabase({})
    const r = await dado(db, { ytIds: [] })
    expect(r.linhas).toEqual([])
    expect(db.trips).toEqual([])
  })
})

describe('lerDiarioDoPeriodo: filtros e páginas', () => {
  it('diário de outro site, de outro canal e de outro vídeo não aparece', async () => {
    const db = fakeSupabase({
      yt_own_video_daily: [linha('v1', d(1), 5), linha('v1', d(2), 7, 50, { site_id: 'site-b' }), linha('v1', d(3), 9, 50, { channel_id: OUTRO }), linha('v9', d(1), 11)],
      yt_own_video_coverage: [],
    })
    expect((await dado(db)).linhas.map(l => l.views)).toEqual([5])
  })
  it('a consulta da cobertura leva os filtros de site, canal e vídeo', async () => {
    const db = fakeSupabase({
      yt_own_video_daily: [],
      yt_own_video_coverage: [cob('v1', d(10), ATE), cob('v1', d(10), ATE, { site_id: 'site-b' }), cob('v1', d(10), ATE, { channel_id: OUTRO }), cob('v9', d(10), ATE), cob('v1', d(10), ATE, { metric_set: 'detalhe' })],
    })
    const r = await dado(db)
    expect(r.cobertura.intervalos.get('v1')).toEqual([{ de: d(10), ate: ATE }])
    expect(r.cobertura.intervalos.has('v9')).toBe(false)
  })
  it('soComViews filtra views > 0 na consulta; sem a flag as linhas de zero voltam', async () => {
    const tabelas = { yt_own_video_daily: [linha('v1', d(1), 0), linha('v1', d(2), 4)], yt_own_video_coverage: [] }
    expect((await dado(fakeSupabase(tabelas), { soComViews: true })).linhas.map(l => l.views)).toEqual([4])
    expect((await dado(fakeSupabase(tabelas), { soComViews: false })).linhas.map(l => l.views)).toEqual([4, 0])
  })
  it('só entram os dias de de a ate; de nulo lê desde o começo', async () => {
    const tabelas = { yt_own_video_daily: [linha('v1', d(20), 1), linha('v1', d(3), 2), linha('v1', '2026-10-05', 3)], yt_own_video_coverage: [] }
    expect((await dado(fakeSupabase(tabelas))).linhas.map(l => l.views)).toEqual([2])
    expect((await dado(fakeSupabase(tabelas), { de: null, soComViews: true })).linhas.map(l => l.views)).toEqual([1, 2])
  })
  it('mais de 1.000 linhas: pagina, sem repetir nem perder, na ordem (vídeo, dia)', async () => {
    const muitas: Row[] = []
    for (let i = 0; i < 1300; i++) muitas.push(linha(i % 2 ? 'v1' : 'v2', addDays('2020-01-01', i), i + 1))
    const db = fakeSupabase({ yt_own_video_daily: muitas, yt_own_video_coverage: [] })
    const r = await dado(db, { ytIds: ['v1', 'v2'], de: null, soComViews: true })
    expect(r.linhas).toHaveLength(1300)
    expect(new Set(r.linhas.map(l => l.ytId + l.dia)).size).toBe(1300)
    const chaves = r.linhas.map(l => l.ytId + '|' + l.dia)
    expect(chaves).toEqual([...chaves].sort())
    expect(db.ranges.filter(x => x.table === 'yt_own_video_daily').map(x => x.range)).toEqual([[0, 999], [1000, 1999]])
  })
  it('passa do teto: lança ObservatoryLoadError', async () => {
    const db = fakeSupabase({ yt_own_video_daily: Array.from({ length: 30 }, (_, i) => linha('v1', addDays('2020-01-01', i), 1)), yt_own_video_coverage: [] })
    await expect(lerDiarioDoPeriodo(db.client, pedido({ de: null, soComViews: true, tetoLinhas: 20 }))).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('passa do teto: a contagem exata da primeira página para na hora (1 ida, nenhuma página descartada)', async () => {
    const db = fakeSupabase({ yt_own_video_daily: Array.from({ length: 3500 }, (_, i) => linha('v1', addDays('2000-01-01', i), 1)), yt_own_video_coverage: [] })
    await expect(lerDiarioDoPeriodo(db.client, pedido({ de: null, soComViews: true, tetoLinhas: 3000 }))).rejects.toBeInstanceOf(ObservatoryLoadError)
    expect(db.ranges.filter(x => x.table === 'yt_own_video_daily')).toHaveLength(1)
  })
  it('51 vídeos: 50 lidos e 1 em foraDoTeto', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => 'v' + String(i).padStart(2, '0'))
    const db = fakeSupabase({ yt_own_video_daily: ids.map(id => linha(id, d(1), 1)), yt_own_video_coverage: [] })
    const r = await dado(db, { ytIds: ids })
    expect(r.linhas).toHaveLength(50)
    expect(r.foraDoTeto).toEqual(['v50'])
  })
  it('views negativas e % fora de 0 a 999,99 viram nulo e contam', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [linha('v1', d(1), -3, 50), linha('v1', d(2), 4, 1200), linha('v1', d(3), 6, 100.5)], yt_own_video_coverage: [] })
    const r = await dado(db)
    expect(r.descartados).toBe(2)
    expect(r.linhas.find(l => l.dia === d(1))).toMatchObject({ views: null, pctAssistido: 50 })
    expect(r.linhas.find(l => l.dia === d(2))).toMatchObject({ views: 4, pctAssistido: null })
    expect(r.linhas.find(l => l.dia === d(3))).toMatchObject({ pctAssistido: 100.5 })
  })
  it('erro de banco é lançado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [] }, { failOn: 'yt_own_video_daily' })
    await expect(lerDiarioDoPeriodo(db.client, pedido())).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
})

describe('cobertura e totalDoPeriodo', () => {
  const pubs = (ids: string[]) => new Map(ids.map(id => [id, d(200)] as const))
  const leia = (linhas: Row[], coberturas: Row[], extra: Partial<Parameters<typeof lerDiarioDoPeriodo>[1]> = {}) =>
    dado(fakeSupabase({ yt_own_video_daily: linhas, yt_own_video_coverage: coberturas }), extra)

  it('cobreTodo: união de intervalos que se tocam cobre; um dia de folga não', () => {
    expect(cobreTodo([{ de: '2026-01-01', ate: '2026-01-05' }, { de: '2026-01-06', ate: '2026-01-10' }], '2026-01-01', '2026-01-10')).toBe(true)
    expect(cobreTodo([{ de: '2026-01-01', ate: '2026-01-05' }, { de: '2026-01-07', ate: '2026-01-10' }], '2026-01-01', '2026-01-10')).toBe(false)
  })
  it('cobertura base cobre o período inteiro dos dois vídeos: o total é a soma', async () => {
    const r = await leia([linha('v1', d(1), 10), linha('v2', d(2), 5)], [cob('v1', d(100), ATE), cob('v2', d(100), ATE)], { ytIds: ['v1', 'v2'], publicacoes: pubs(['v1', 'v2']) })
    expect(r.cobertura).toMatchObject({ conhecida: true, videosCompletos: 2, videosIncompletos: 0 })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ total: 15, videosNaConta: 2, videosFora: 0, videosParados: 0, comBuraco: 0 })
  })
  it('buraco de cobertura de 40 a 20 dias atrás: o total de 7 dias é a soma e o de 90 é nulo, com comBuraco 1', async () => {
    const r = await leia([linha('v1', d(1), 10), linha('v1', d(50), 3)], [cob('v1', d(100), d(40)), cob('v1', d(20), ATE)], { de: d(89) })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ total: 10, comBuraco: 0 })
    expect(totalDoPeriodo(r, { de: d(89), ate: ATE })).toMatchObject({ total: null, comBuraco: 1 })
    expect(r.cobertura).toMatchObject({ videosCompletos: 0, videosIncompletos: 1 })
  })
  it('35 vídeos, um sem nenhum dia coberto no trecho: o total é o dos 34, videosFora 1', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => 'v' + String(i).padStart(2, '0'))
    const linhas = ids.map(id => linha(id, d(1), 2))
    const r = await leia(linhas, ids.slice(0, 34).map(id => cob(id, d(100), ATE)), { ytIds: ids, publicacoes: pubs(ids) })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ total: 68, videosNaConta: 34, videosFora: 1 })
  })
  it('vídeo publicado depois do fim do período não conta como fora: total dos 34, sem "de N dos M" (Phil I2)', async () => {
    const ids = Array.from({ length: 35 }, (_, i) => 'v' + String(i).padStart(2, '0'))
    const pub = new Map(ids.map((id, i) => [id, i === 34 ? addDays(ATE, 1) : d(200)] as const))
    const r = await leia(ids.slice(0, 34).map(id => linha(id, d(1), 2)), ids.slice(0, 34).map(id => cob(id, d(100), ATE)), { ytIds: ids, publicacoes: pub })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ total: 68, videosNaConta: 34, videosFora: 0 })
  })
  it('o mesmo vídeo publicado no último dia do período e sem cobertura: continua fora (entra na conta)', async () => {
    const ids = ['v1', 'v2']
    const pub = new Map([['v1', d(200)], ['v2', ATE]] as const)
    const r = await leia([linha('v1', d(1), 2)], [cob('v1', d(100), ATE)], { ytIds: ids, publicacoes: pub })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ videosNaConta: 1, videosFora: 1 })
  })
  it('vídeo com a cobertura parada há 30 dias num trecho de 90: soma até o último dia coberto, videosParados 1, não é nulo', async () => {
    const r = await leia(
      [linha('v1', d(40), 7), linha('v1', d(10), 100), linha('v2', d(10), 4)],
      [cob('v1', d(100), d(30)), cob('v2', d(100), ATE)], { ytIds: ['v1', 'v2'], publicacoes: pubs(['v1', 'v2']), de: d(89) })
    expect(totalDoPeriodo(r, { de: d(89), ate: ATE })).toMatchObject({ total: 11, videosParados: 1, paradosDesde: d(30), comBuraco: 0 })
  })
  it('o mesmo vídeo parado há 5 dias: total nulo (só atrasado é buraco)', async () => {
    const r = await leia([linha('v1', d(10), 7)], [cob('v1', d(100), d(5))], { de: d(89) })
    expect(totalDoPeriodo(r, { de: d(89), ate: ATE })).toMatchObject({ total: null, comBuraco: 1, videosParados: 0 })
  })
  it('todos fora: total nulo, nunca 0', async () => {
    const r = await leia([], [], { ytIds: ['v1', 'v2'], publicacoes: pubs(['v1', 'v2']) })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE })).toMatchObject({ total: null, videosNaConta: 0, videosFora: 2 })
  })
  it('um vídeo com 20 dias sem cobertura no meio do período: totalDoPeriodo nulo e videosIncompletos 1', async () => {
    const r = await leia([linha('v1', d(1), 9)], [cob('v1', d(100), d(60)), cob('v1', d(40), ATE)], { de: d(89) })
    expect(r.cobertura.videosIncompletos).toBe(1)
    expect(totalDoPeriodo(r, { de: d(89), ate: ATE }).total).toBeNull()
  })
  it('tabela de cobertura ausente: conhecida falso, total nulo e um aviso ao Sentry', async () => {
    vi.mocked(Sentry.captureMessage).mockClear()
    const db = fakeSupabase({ yt_own_video_daily: [linha('v1', d(1), 9)], yt_own_video_coverage: [] }, { failOn: 'yt_own_video_coverage', failCode: '42P01' })
    const r = await dado(db)
    expect(r.cobertura.conhecida).toBe(false)
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE }).total).toBeNull()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
  it('outro erro da cobertura é lançado', async () => {
    const db = fakeSupabase({ yt_own_video_daily: [], yt_own_video_coverage: [] }, { failOn: 'yt_own_video_coverage' })
    await expect(lerDiarioDoPeriodo(db.client, pedido())).rejects.toBeInstanceOf(ObservatoryLoadError)
  })
  it('dia coberto sem linha conta como zero: apagar as linhas de zero não muda o total nem o percentual', async () => {
    const cheio = [linha('v1', d(1), 10, 40), linha('v1', d(2), 0, null), linha('v1', d(3), 0, null), linha('v1', d(4), 20, 60)]
    const enxuto = cheio.filter(l => l.views !== 0)
    const cobertura = [cob('v1', d(100), ATE)]
    const a = await leia(cheio, cobertura), b = await leia(enxuto, cobertura)
    expect(totalDoPeriodo(b, { de: d(6), ate: ATE })).toEqual(totalDoPeriodo(a, { de: d(6), ate: ATE }))
    expect(totalDoPeriodo(b, { de: d(6), ate: ATE }).total).toBe(30)
    const comPct = (x: DiarioDoPeriodo) => x.linhas.filter(l => l.pctAssistido !== null).map(l => l.pctAssistido)
    expect(comPct(b)).toEqual(comPct(a))
  })
  it('publicação nula conta como buraco; ate é o recebido, mesmo com a última linha de semanas antes', async () => {
    const r = await leia([linha('v1', d(30), 9)], [cob('v1', d(100), ATE)], { publicacoes: new Map([['v1', null]]), de: d(89) })
    expect(r.ate).toBe(ATE)
    expect(totalDoPeriodo(r, { de: d(89), ate: ATE })).toMatchObject({ total: null, comBuraco: 1 })
    expect(r.cobertura.videosIncompletos).toBe(1)
  })
  it('linha descartada (views -3 virou nulo) dentro do período: o total é nulo, não um total menor; fora do período o total segue (Phil M3, Yannis m3)', async () => {
    const r = await leia([linha('v1', d(1), 10), linha('v1', d(2), -3), linha('v1', d(20), -5)], [cob('v1', d(100), ATE)], { de: d(30) })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE }).total).toBeNull()
    expect(totalDoPeriodo(r, { de: d(10), ate: d(8) }).total).toBe(0)
    expect(totalDoPeriodo(r, { de: d(1), ate: d(1) }).total).toBe(10)
  })
  it('com vídeos além do teto o total é nulo (nunca um total menor em silêncio)', async () => {
    const ids = Array.from({ length: 51 }, (_, i) => 'v' + String(i).padStart(2, '0'))
    const r = await leia(ids.map(id => linha(id, d(1), 1)), ids.map(id => cob(id, d(100), ATE)), { ytIds: ids, publicacoes: pubs(ids) })
    expect(totalDoPeriodo(r, { de: d(6), ate: ATE }).total).toBeNull()
  })
})
