// @vitest-environment node
// A5 E4, Tarefa 15: os insumos de comentários de M11 e M12. Dado do dono: só com o token de edição.
import { describe, it, expect, vi } from 'vitest'
vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { lerInsumosDeComentarios } from '@/lib/youtube/observatorio/medidas/ler-comentarios'
import { falsoPostgrest, type Linha } from './medidas-fixture'
import { edicaoDe } from './edicao-teste'

const SITE = 's1', OUTRO_SITE = 's2', CANAL = 'c1', OUTRO_CANAL = 'c2'
const T = '2026-08-01T12:00:00.000Z'

const canais = (): Linha[] => [
  { id: CANAL, site_id: SITE, collection_paused_at: null, missing_since: null },
  { id: OUTRO_CANAL, site_id: SITE, collection_paused_at: null, missing_since: null },
]
const video = (id: string, canal = CANAL): Linha => ({ id, competitor_channel_id: canal })
const snap = (video_id: string, mark: number, status: string, site_id = SITE, canal = CANAL, taken_at = T): Linha => ({ video_id, mark, status, site_id, competitor_channel_id: canal, taken_at })
const comentario = (id: number, video_id: string, o: Partial<Linha> = {}): Linha => ({ id, video_id, site_id: SITE, parent_id: null, creator_replied: null, body: 'TEXTO-PROIBIDO', ...o })
const marca = (comment_id: number, mark: number, likes: number, site_id = SITE): Linha => ({ comment_id, mark, likes, site_id })

const mundo = (extra: Record<string, Linha[]> = {}): Record<string, Linha[]> => ({
  competitor_channels: canais(), competitor_videos: [video('a'), video('b'), video('z', OUTRO_CANAL)],
  competitor_video_comment_snaps: [], competitor_video_comments: [], competitor_video_comment_marks: [], ...extra,
})
const pedido = { channelId: CANAL, videoIds: ['a', 'b'] }

describe('o token', () => {
  it('sem o token: sem_permissao, e nenhuma consulta é feita', async () => {
    const { sb, consultas } = falsoPostgrest(mundo())
    const nulo = await lerInsumosDeComentarios(sb, undefined as never, pedido)
    expect(nulo).toEqual({ lido: false, causa: 'sem_permissao' })
    expect(consultas).toHaveLength(0)
  })
  it('objeto forjado com siteId não passa', async () => {
    const { sb, consultas } = falsoPostgrest(mundo())
    const forjado = { siteId: SITE } as never
    expect(await lerInsumosDeComentarios(sb, forjado, pedido)).toEqual({ lido: false, causa: 'sem_permissao' })
    const clone = Object.create(Object.getPrototypeOf(await edicaoDe(SITE)), { siteId: { value: SITE } }) as never
    expect(await lerInsumosDeComentarios(sb, clone, pedido)).toEqual({ lido: false, causa: 'sem_permissao' })
    expect(consultas).toHaveLength(0)
  })
  it('o select não pede body nem coluna de autor', async () => {
    const { sb, consultas } = falsoPostgrest(mundo({ competitor_video_comments: [comentario(1, 'a')], competitor_video_comment_marks: [marca(1, 7, 10)] }))
    await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)
    const permitidas = new Set(['id', 'video_id', 'parent_id', 'creator_replied', 'mark', 'status', 'taken_at', 'comment_id', 'likes', 'competitor_channel_id', 'site_id', 'is_creator'])
    for (const c of consultas.filter((x) => x.tabela.startsWith('competitor_video_comment'))) {
      for (const col of c.colunas) expect(permitidas.has(col), c.tabela + '.' + col).toBe(true)
      expect(c.colunas.join(' ')).not.toMatch(/body|author|name|photo|youtube_comment_id/)
    }
  })
})

describe('o que devolve', () => {
  it('retratos de 7 e 30, resposta do criador e a maior curtida de comentário de topo por marco', async () => {
    const { sb } = falsoPostgrest(mundo({
      competitor_video_comment_snaps: [snap('a', 7, 'ok'), snap('a', 30, 'sem_comentarios', SITE, CANAL, '2026-08-05T00:00:00.000Z'), snap('b', 30, 'desligados'), snap('a', 0, 'ok')],
      competitor_video_comments: [comentario(1, 'a', { creator_replied: true }), comentario(2, 'a'), comentario(3, 'a', { parent_id: 1, creator_replied: true }), comentario(4, 'b', { creator_replied: false })],
      competitor_video_comment_marks: [marca(1, 7, 40), marca(2, 7, 90), marca(2, 30, 120), marca(1, 30, 70), marca(3, 7, 9999), marca(4, 7, 5)],
    }))
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)
    expect(r.lido).toBe(true)
    if (!r.lido) return
    expect(r.dados.coletaDesdeMs).toBe(Date.parse(T))
    expect(r.dados.porVideo.get('a')).toEqual({ retrato7: 'ok', retrato30: 'sem_comentarios', algumComRespostaDoCriador: true, maiorCurtidas7: 90, maiorCurtidas30: 120 })
    expect(r.dados.porVideo.get('b')).toEqual({ retrato7: null, retrato30: 'desligados', algumComRespostaDoCriador: false, maiorCurtidas7: 5, maiorCurtidas30: null })
  })
  it('tabelas vazias: lido, nenhum vídeo, coletaDesdeMs nulo', async () => {
    const { sb } = falsoPostgrest(mundo())
    expect(await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)).toEqual({ lido: true, dados: { coletaDesdeMs: null, porVideo: new Map() } })
  })
  it('canal de outro site: nada além da linha do canal é lido', async () => {
    const { sb, consultas } = falsoPostgrest(mundo())
    expect(await lerInsumosDeComentarios(sb, await edicaoDe(OUTRO_SITE), pedido)).toEqual({ lido: false, causa: 'canal_de_outro_site' })
    expect(consultas.map((c) => c.tabela)).toEqual(['competitor_channels'])
  })
})

describe('falhas', () => {
  it.each(['competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_marks'])('tabela ausente (%s): schema_ausente', async (t) => {
    const m = mundo({ competitor_video_comments: [comentario(1, 'a')] })
    const { sb } = falsoPostgrest(m, { erros: { [t]: { code: '42P01', message: 'x' } } })
    expect(await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)).toEqual({ lido: false, causa: 'schema_ausente' })
  })
  it.each(['competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_marks'])('erro numa das três (%s): a parte inteira é não lida', async (t) => {
    const m = mundo({ competitor_video_comment_snaps: [snap('a', 7, 'ok')], competitor_video_comments: [comentario(1, 'a')], competitor_video_comment_marks: [marca(1, 7, 5)] })
    const { sb } = falsoPostgrest(m, { erros: { [t]: { code: '42501', message: 'FRASE' } } })
    expect(await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)).toEqual({ lido: false, causa: 'erro_do_banco' })
  })
  it('consulta que lança: erro_do_banco, sem vazar a mensagem', async () => {
    const { sb } = falsoPostgrest(mundo(), { lancam: ['competitor_video_comments'] })
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)
    expect(r).toEqual({ lido: false, causa: 'erro_do_banco' })
    expect(JSON.stringify(r)).not.toContain('SENTINELA')
  })
})

// Provas por mutação: cada teste planta o dado alheio e falha se o filtro for removido.
describe('provas por mutação (filtros)', () => {
  it('as três consultas filtram pelo site do token', async () => {
    const { sb } = falsoPostgrest(mundo({
      competitor_video_comment_snaps: [snap('a', 7, 'ok'), snap('a', 30, 'erro', OUTRO_SITE)],
      competitor_video_comments: [comentario(1, 'a'), comentario(2, 'a', { site_id: OUTRO_SITE, creator_replied: true })],
      competitor_video_comment_marks: [marca(1, 7, 10), marca(1, 7, 777, OUTRO_SITE), marca(2, 30, 888, OUTRO_SITE)],
    }))
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)
    expect(r.lido && r.dados.porVideo.get('a')).toEqual({ retrato7: 'ok', retrato30: null, algumComRespostaDoCriador: false, maiorCurtidas7: 10, maiorCurtidas30: null })
  })
  it('as leituras de comentário de outro vídeo do mesmo site não são lidas', async () => {
    const outros = Array.from({ length: 50 }, (_, k) => comentario(100 + k, 'b2'))
    const { sb, consultas } = falsoPostgrest(mundo({
      competitor_videos: [video('a'), video('b'), video('b2')],
      competitor_video_comment_snaps: [snap('a', 7, 'ok'), snap('b2', 7, 'erro')],
      competitor_video_comments: [comentario(1, 'a'), ...outros],
      competitor_video_comment_marks: [marca(1, 7, 3), ...outros.map((c) => marca(c.id as number, 7, 50))],
    }))
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), { channelId: CANAL, videoIds: ['a', 'b'] })
    expect(r.lido && [...r.dados.porVideo.keys()]).toEqual(['a'])
    const doVideo = consultas.filter((x) => x.tabela === 'competitor_video_comment_snaps' || x.tabela === 'competitor_video_comments').filter((x) => !x.colunas.includes('taken_at') || x.colunas.includes('video_id'))
    expect(doVideo.length).toBeGreaterThanOrEqual(2)
    for (const c of doVideo) expect(c.filtros.find((f) => f.op === 'in' && f.coluna === 'video_id')?.valor).toEqual(['a', 'b'])
    const marcas = consultas.filter((c) => c.tabela === 'competitor_video_comment_marks')
    expect(marcas.flatMap((c) => c.filtros.filter((f) => f.coluna === 'comment_id').flatMap((f) => f.valor as number[]))).toEqual([1])
  })
  it('vídeo de outro canal pedido por id não é lido', async () => {
    const { sb } = falsoPostgrest(mundo({
      competitor_video_comment_snaps: [snap('z', 7, 'ok', SITE, OUTRO_CANAL)], competitor_video_comments: [comentario(9, 'z', { creator_replied: true })],
    }))
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), { channelId: CANAL, videoIds: ['a', 'z'] })
    expect(r.lido && r.dados.porVideo.size).toBe(0)
  })
  it('mais de 150 comentários: o in() de comment_id é partido em blocos', async () => {
    const cs = Array.from({ length: 320 }, (_, k) => comentario(1000 + k, 'a'))
    const { sb, consultas } = falsoPostgrest(mundo({ competitor_video_comments: cs, competitor_video_comment_marks: cs.map((c) => marca(c.id as number, 7, 1)) }))
    const r = await lerInsumosDeComentarios(sb, await edicaoDe(SITE), pedido)
    const q = consultas.filter((c) => c.tabela === 'competitor_video_comment_marks')
    expect(q.map((c) => (c.filtros.find((f) => f.op === 'in')!.valor as unknown[]).length)).toEqual([150, 150, 20])
    expect(r.lido && r.dados.porVideo.get('a')?.maiorCurtidas7).toBe(1)
  })
})
