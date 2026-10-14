// @vitest-environment node
// A5 E4, Tarefa 13: os leitores de servidor das medidas.
import { describe, it, expect } from 'vitest'
import {
  lerCanal, lerVideosDoCanal, lerMarcasDoCanal, lerRetratosDoCanal, lerSeriesDoCanal, lerMudancasDoCanal,
} from '@/lib/youtube/observatorio/medidas/ler'
import { falsoPostgrest, type Linha } from './medidas-fixture'

const SITE = 's1', OUTRO_SITE = 's2', CANAL = 'c1', OUTRO_CANAL = 'c2'
const AGORA = Date.UTC(2026, 8, 20, 12, 0, 0)
const iso = (ms: number) => new Date(ms).toISOString()
const DESDE = '2026-08-01'
const E = { siteId: SITE, channelId: CANAL }
const SENT = 'FRASE-SENTINELA-LANCADA'

const canais = (): Linha[] => [
  { id: CANAL, site_id: SITE, collection_paused_at: null, missing_since: null },
  { id: CANAL, site_id: OUTRO_SITE, collection_paused_at: null, missing_since: null },
  { id: OUTRO_CANAL, site_id: SITE, collection_paused_at: null, missing_since: null },
]
const video = (id: string, canal = CANAL): Linha => ({
  id, competitor_channel_id: canal, video_id: 'yt' + id, published_at: iso(AGORA - 5e9), live_actual_start_at: null, live_broadcast_content: 'none',
  was_live: false, is_short: false, duration_seconds: 600, view_count: 100, like_count: 5, comment_count: 1, likes_hidden: false,
  comments_disabled: false, views_hidden: false, discovered_at: iso(AGORA - 4e9), missing_since: null, series_tier: 'diaria', last_checked_at: iso(AGORA),
})
const marca = (video_id: string, site_id = SITE, age_days = 7): Linha => ({
  video_id, site_id, age_days, views: 500, likes: 20, comments: null, read_before_at: iso(AGORA - 2e6), read_after_at: iso(AGORA - 1e6), age_base_at: iso(AGORA - 9e5),
})
const falta = (video_id: string, site_id = SITE, age_days = 30): Linha => ({ video_id, site_id, age_days, reason: 'leituras_distantes', since_at: null, age_base_at: iso(AGORA - 9e5) })

describe('lerCanal e a ausência de dado', () => {
  it.each(['42P01', 'PGRST205', 'PGRST202', '42703'])('tabela ou coluna ausente (%s): schema_ausente, nunca lista vazia', async (code) => {
    const { sb } = falsoPostgrest({}, { erros: { competitor_channels: { code, message: 'x' } } })
    expect(await lerCanal(sb, E)).toEqual({ lido: false, causa: 'schema_ausente' })
    const { sb: sb2 } = falsoPostgrest({ competitor_channels: canais(), competitor_video_marks: [], competitor_video_mark_misses: [] }, { erros: { competitor_video_marks: { code, message: 'x' } } })
    expect(await lerMarcasDoCanal(sb2, { ...E, videoIds: ['a'] })).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it('a tabela de marcas inexistente no falso: schema_ausente', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais() })
    expect(await lerMarcasDoCanal(sb, { ...E, videoIds: ['a'] })).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it('erro do banco: erro_do_banco', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais() }, { erros: { competitor_channels: { code: '42501', message: 'x' } } })
    expect(await lerCanal(sb, E)).toEqual({ lido: false, causa: 'erro_do_banco' })
  })
  it('consulta que lança: erro_do_banco, sem vazar a mensagem', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais() }, { lancam: ['competitor_channels'] })
    const r = await lerCanal(sb, E)
    expect(r).toEqual({ lido: false, causa: 'erro_do_banco' })
    expect(JSON.stringify(r)).not.toContain(SENT)
    const { sb: sb2 } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: [] }, { lancam: ['competitor_videos'] })
    const v = await lerVideosDoCanal(sb2, E)
    expect(v).toEqual({ lido: false, causa: 'erro_do_banco' })
    expect(JSON.stringify(v)).not.toContain(SENT)
  })
  it('lerCanal devolve collectionPausedAt (e coluna ausente é schema_ausente, nunca nulo calado)', async () => {
    const pausa = iso(AGORA - 1e8)
    const { sb } = falsoPostgrest({ competitor_channels: [{ id: CANAL, site_id: SITE, collection_paused_at: pausa, missing_since: '2026-09-01' }] })
    expect(await lerCanal(sb, E)).toEqual({ lido: true, dados: { id: CANAL, siteId: SITE, collectionPausedAt: pausa, missingSince: '2026-09-01' } })
    const { sb: sb2 } = falsoPostgrest({ competitor_channels: canais() }, { colunasAusentes: { competitor_channels: ['collection_paused_at'] } })
    expect(await lerCanal(sb2, E)).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it('canal sem vídeo: lido, lista vazia', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: [] })
    expect(await lerVideosDoCanal(sb, E)).toEqual({ lido: true, dados: [] })
  })
})

describe('paginação', () => {
  const muitos = (n: number) => Array.from({ length: n }, (_, i) => video('v' + String(i).padStart(5, '0')))
  it('duas páginas são lidas inteiras', async () => {
    const { sb, consultas } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: muitos(1500) })
    const r = await lerVideosDoCanal(sb, E)
    expect(r.lido && r.dados.length).toBe(1500)
    expect(consultas.filter((c) => c.tabela === 'competitor_videos')).toHaveLength(2)
  })
  it('exatamente 1.000 linhas pede a página seguinte (e a vazia fecha)', async () => {
    const { sb, consultas } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: muitos(1000) })
    const r = await lerVideosDoCanal(sb, E)
    expect(r.lido && r.dados.length).toBe(1000)
    expect(consultas.filter((c) => c.tabela === 'competitor_videos')).toHaveLength(2)
  })
  it('página cheia de 1.000 sem a seguinte pedida é cortado', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: muitos(2500) })
    expect(await lerVideosDoCanal(sb, { ...E, maxPaginas: 2 })).toEqual({ lido: false, causa: 'cortado' })
  })
  it('mais de 150 vídeos: o in() é partido em blocos', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => 'v' + i)
    const { sb, consultas } = falsoPostgrest({ competitor_channels: canais(), competitor_video_marks: [], competitor_video_mark_misses: [] })
    await lerMarcasDoCanal(sb, { ...E, videoIds: ids })
    const q = consultas.filter((c) => c.tabela === 'competitor_video_marks')
    expect(q).toHaveLength(3)
    expect(q.map((c) => (c.filtros.find((f) => f.op === 'in')?.valor as string[]).length)).toEqual([150, 150, 20])
  })
})

describe('o que cada leitor devolve', () => {
  it('lerVideosDoCanal pede as colunas do contrato e mapeia', async () => {
    const { sb, consultas } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: [video('a')] })
    const r = await lerVideosDoCanal(sb, E)
    expect(r.lido && r.dados[0]).toMatchObject({ id: 'a', videoId: 'yta', liveBroadcastContent: 'none', seriesTier: 'diaria', viewCount: 100 })
    const cols = consultas.find((c) => c.tabela === 'competitor_videos')!.colunas
    for (const k of ['id', 'live_broadcast_content', 'was_live', 'is_short', 'series_tier', 'missing_since', 'last_checked_at']) expect(cols).toContain(k)
  })
  it('as marcas e os motivos vêm por vídeo e idade, com a base gravada', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais(), competitor_video_marks: [marca('a')], competitor_video_mark_misses: [falta('a')] })
    const r = await lerMarcasDoCanal(sb, { ...E, videoIds: ['a'] })
    expect(r.lido && r.dados.marcas.get('a')?.[7]).toMatchObject({ views: 500, likes: 20, comments: null, ageBaseAt: AGORA - 9e5 })
    expect(r.lido && r.dados.faltas.get('a')?.[30]).toMatchObject({ reason: 'leituras_distantes', sinceAt: null, ageBaseAt: AGORA - 9e5 })
  })
  it('view_count nulo no retrato continua nulo', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(),
      competitor_channel_snapshots: [
        { competitor_channel_id: CANAL, snapshot_date: '2026-09-10', view_count: null },
        { competitor_channel_id: CANAL, snapshot_date: '2026-09-11', view_count: 1234 },
      ],
    })
    expect(await lerRetratosDoCanal(sb, { ...E, desde: DESDE })).toEqual({ lido: true, dados: [{ dia: '2026-09-10', views: null }, { dia: '2026-09-11', views: 1234 }] })
  })
  it('retratos: 120 dias por padrão', async () => {
    const { sb, consultas } = falsoPostgrest({ competitor_channels: canais(), competitor_channel_snapshots: [] })
    await lerRetratosDoCanal(sb, { ...E, agoraMs: AGORA })
    const desde = consultas.find((c) => c.tabela === 'competitor_channel_snapshots')!.filtros.find((f) => f.op === 'gte')!.valor
    expect(desde).toBe(iso(AGORA - 120 * 864e5).slice(0, 10))
  })
  it('séries: junta a diária e as primeiras horas, em ordem, e conta o que descartou', async () => {
    const t1 = AGORA - 3e6, t2 = AGORA - 2e6, t3 = AGORA - 1e6
    const { sb } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a')],
      competitor_video_daily: [{ video_id: 'a', snap_date: '2026-09-19', taken_at: iso(t3), views: 30, likes: 3, comments: 1 }],
      competitor_video_early: [{ video_id: 'a', taken_at: iso(t1), views: 10, likes: null, comments: null }, { video_id: 'a', taken_at: iso(t2), views: 20, likes: 2, comments: 0 }],
    })
    const r = await lerSeriesDoCanal(sb, { ...E, videoIds: ['a', 'estranho'], desde: DESDE })
    expect(r.lido && r.dados.foraDoCanal).toBe(1)
    expect(r.lido && r.dados.series.get('a')?.map((x) => x.views)).toEqual([10, 20, 30])
  })
  it('mudanças: o histórico de vídeo e o de campo, sem a primeira leitura', async () => {
    const { sb, consultas } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a')],
      competitor_video_versions: [
        { video_id: 'a', field: 'title', first_seen_at: iso(AGORA - 2e6), precision: '6h', value_text: 'novo' },
        { video_id: 'a', field: 'desc', first_seen_at: iso(AGORA - 3e6), precision: 'first', value_text: 'primeira' },
        { video_id: 'a', field: 'desc', first_seen_at: iso(AGORA - 1e6), precision: '1d', value_text: 'cap 0:00' },
      ],
      competitor_field_versions: [
        { site_id: SITE, video_id: 'a', field: 'tags', first_seen_at: iso(AGORA - 1.5e6), precision: '1d' },
        { site_id: SITE, video_id: 'a', field: 'view_count', first_seen_at: iso(AGORA - 1.5e6), precision: '1d' },
      ],
    })
    const r = await lerMudancasDoCanal(sb, { ...E, videoIds: ['a'], desde: DESDE })
    expect(r.lido && r.dados.mudancas.get('a')).toEqual([
      { campo: 'titulo', em: AGORA - 2e6, valueText: null },
      { campo: 'tags', em: AGORA - 1.5e6, valueText: null },
      { campo: 'descricao', em: AGORA - 1e6, valueText: 'cap 0:00' },
    ])
    expect(consultas.some((c) => c.tabela === 'competitor_field_versions' && c.filtros.some((f) => f.op === 'neq' && f.valor === 'first'))).toBe(true)
  })
})

// Provas por mutação: cada teste planta o dado alheio e falha se o filtro for removido do leitor.
describe('provas por mutação (filtros)', () => {
  it('lerCanal sem o filtro de site devolveria o canal de outro site', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: [{ id: CANAL, site_id: OUTRO_SITE, collection_paused_at: null, missing_since: null }] })
    expect(await lerCanal(sb, E)).toEqual({ lido: false, causa: 'canal_de_outro_site' })
  })
  it('lerVideosDoCanal filtra pelo canal', async () => {
    const { sb } = falsoPostgrest({ competitor_channels: canais(), competitor_videos: [video('a'), video('z', OUTRO_CANAL)] })
    const r = await lerVideosDoCanal(sb, E)
    expect(r.lido && r.dados.map((v) => v.id)).toEqual(['a'])
  })
  it('lerMarcasDoCanal filtra pelo site E pelos vídeos', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(),
      competitor_video_marks: [marca('a'), marca('a', OUTRO_SITE, 1), marca('z')],
      competitor_video_mark_misses: [falta('a'), falta('a', OUTRO_SITE, 1), falta('z')],
    })
    const r = await lerMarcasDoCanal(sb, { ...E, videoIds: ['a'] })
    expect(r.lido && [...r.dados.marcas.keys()]).toEqual(['a'])
    expect(r.lido && Object.keys(r.dados.marcas.get('a') ?? {})).toEqual(['7'])
    expect(r.lido && Object.keys(r.dados.faltas.get('a') ?? {})).toEqual(['30'])
  })
  it('lerRetratosDoCanal filtra pelo canal', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(),
      competitor_channel_snapshots: [
        { competitor_channel_id: CANAL, snapshot_date: '2026-09-10', view_count: 1 },
        { competitor_channel_id: OUTRO_CANAL, snapshot_date: '2026-09-10', view_count: 999 },
      ],
    })
    const r = await lerRetratosDoCanal(sb, { ...E, desde: DESDE })
    expect(r.lido && r.dados).toEqual([{ dia: '2026-09-10', views: 1 }])
  })
  it('lerSeriesDoCanal só devolve os vídeos pedidos', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a'), video('b')],
      competitor_video_daily: [
        { video_id: 'a', snap_date: '2026-09-19', taken_at: iso(AGORA), views: 1, likes: null, comments: null },
        { video_id: 'b', snap_date: '2026-09-19', taken_at: iso(AGORA), views: 2, likes: null, comments: null },
      ],
      competitor_video_early: [],
    })
    const r = await lerSeriesDoCanal(sb, { ...E, videoIds: ['a'], desde: DESDE })
    expect(r.lido && [...r.dados.series.keys()]).toEqual(['a'])
  })
  it('lerSeriesDoCanal: vídeo de outro canal pedido por id não volta', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a'), video('z', OUTRO_CANAL)],
      competitor_video_daily: [{ video_id: 'z', snap_date: '2026-09-19', taken_at: iso(AGORA), views: 77, likes: null, comments: null }],
      competitor_video_early: [{ video_id: 'z', taken_at: iso(AGORA - 1e6), views: 70, likes: null, comments: null }],
    })
    const r = await lerSeriesDoCanal(sb, { ...E, videoIds: ['a', 'z'], desde: DESDE })
    expect(r.lido && r.dados.series.has('z')).toBe(false)
    expect(r.lido && r.dados.foraDoCanal).toBe(1)
  })
  it('lerMudancasDoCanal filtra o histórico de campo pelo site', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a')], competitor_video_versions: [],
      competitor_field_versions: [
        { site_id: SITE, video_id: 'a', field: 'tags', first_seen_at: iso(AGORA - 1e6), precision: '1d' },
        { site_id: OUTRO_SITE, video_id: 'a', field: 'category_id', first_seen_at: iso(AGORA - 1e6), precision: '1d' },
      ],
    })
    const r = await lerMudancasDoCanal(sb, { ...E, videoIds: ['a'], desde: DESDE })
    expect(r.lido && r.dados.mudancas.get('a')?.map((m) => m.campo)).toEqual(['tags'])
  })
  it('lerMudancasDoCanal: versão de vídeo de outro canal pedido por id não volta', async () => {
    const { sb } = falsoPostgrest({
      competitor_channels: canais(), competitor_videos: [video('a'), video('z', OUTRO_CANAL)],
      competitor_video_versions: [{ video_id: 'z', field: 'title', first_seen_at: iso(AGORA - 1e6), precision: '6h', value_text: 'x' }],
      competitor_field_versions: [{ site_id: SITE, video_id: 'z', field: 'tags', first_seen_at: iso(AGORA - 1e6), precision: '1d' }],
    })
    const r = await lerMudancasDoCanal(sb, { ...E, videoIds: ['a', 'z'], desde: DESDE })
    expect(r.lido && r.dados.mudancas.size).toBe(0)
    expect(r.lido && r.dados.foraDoCanal).toBe(1)
  })
  it('todo leitor para quando lerCanal responde canal_de_outro_site, sem fazer a segunda consulta', async () => {
    const f = () => falsoPostgrest({ competitor_channels: [{ id: CANAL, site_id: OUTRO_SITE, collection_paused_at: null, missing_since: null }], competitor_videos: [video('a')] })
    const pedido = { siteId: SITE, channelId: CANAL }
    const leitores: Array<(sb: ReturnType<typeof f>['sb']) => Promise<unknown>> = [
      (sb) => lerVideosDoCanal(sb, pedido),
      (sb) => lerMarcasDoCanal(sb, { ...pedido, videoIds: ['a'] }),
      (sb) => lerRetratosDoCanal(sb, { ...pedido, desde: DESDE }),
      (sb) => lerSeriesDoCanal(sb, { ...pedido, videoIds: ['a'], desde: DESDE }),
      (sb) => lerMudancasDoCanal(sb, { ...pedido, videoIds: ['a'], desde: DESDE }),
    ]
    for (const ler of leitores) {
      const { sb, consultas } = f()
      expect(await ler(sb)).toEqual({ lido: false, causa: 'canal_de_outro_site' })
      expect(consultas).toHaveLength(1)
      expect(consultas[0]?.tabela).toBe('competitor_channels')
    }
  })
})
