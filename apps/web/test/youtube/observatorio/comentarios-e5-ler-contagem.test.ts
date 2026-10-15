// @vitest-environment node
// A5 · E5a · Tarefa C1: as leituras de contagem da página do canal (M11) e a lista "O que o criador respondeu".
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { edicaoDe } from './edicao-teste'
import { leituraDe } from './leitura-teste'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import { lerContagemDeRespostas, lerRespostasDoCriador } from '@/lib/youtube/observatorio/comentarios/leitor-contagem'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const S = 'site-1'
const OUTRO_SITE = 'site-2'
const CANAL = 'canal-1'
const OUTRO_CANAL = 'canal-2'
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 15, 12)
const iso = (ms: number): string => new Date(ms).toISOString()
const SENT = 'zz-sentinela-leitor'

const snap = (video: string, mark: number, over: Linha = {}): Linha => ({
  site_id: S, competitor_channel_id: CANAL, video_id: video, mark, status: 'ok', taken_at: iso(AGORA - (40 - mark) * H), ...over,
})
const coment = (id: number, video: string, over: Linha = {}): Linha => ({
  id, site_id: S, competitor_channel_id: CANAL, video_id: video, parent_id: null, is_creator: false, creator_replied: null,
  body: 'texto ' + SENT + id, body_truncated: false, published_at: iso(AGORA - 5 * H), ...over,
})
const marca = (c: number, mark: number, likes: number, over: Linha = {}): Linha => ({ comment_id: c, site_id: S, mark, likes, ...over })
const execucao = (over: Linha = {}): Linha => ({ task: 'retratos_comentarios', status: 'ok', started_at: iso(AGORA - 2 * H), finished_at: iso(AGORA - H), ...over })

function base(): Record<string, Linha[]> {
  return {
    competitor_video_comment_snaps: [snap('v1', 30), snap('v1', 1), snap('v2', 7), snap('v9', 30, { competitor_channel_id: OUTRO_CANAL, taken_at: iso(AGORA - 900 * H) })],
    competitor_video_comments: [
      coment(1, 'v1', { creator_replied: true, body: '@ana adorei' }),
      coment(2, 'v1', { parent_id: 1, is_creator: true, body: 'valeu @ana' }),
      coment(3, 'v2', { creator_replied: false }),
      coment(4, 'v9', { creator_replied: true, competitor_channel_id: OUTRO_CANAL }),
    ],
    competitor_video_comment_marks: [marca(1, 1, 10), marca(1, 7, 25)],
    competitor_video_comment_authors: [{ comment_id: 1, site_id: S, display_name: 'nome', expires_at: iso(AGORA + H) }],
    competitor_agenda_runs: [execucao()],
  }
}
let provasTexto: ProvasDeQuemVe
let provasIdentidade: ProvasDeQuemVe
beforeAll(async () => {
  provasTexto = { leitura: await leituraDe(S), edicao: null }
  provasIdentidade = { leitura: await leituraDe(S), edicao: await edicaoDe(S) }
})

describe('lerContagemDeRespostas (E5a C1)', () => {
  it('por vídeo: o status do retrato de 30 dias e se algum comentário teve resposta do criador', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v1', 'v2', 'v3'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.porVideo.get('v1')).toEqual({ retrato30: 'ok', algumComRespostaDoCriador: true })
    expect(r.dados.porVideo.get('v2')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
    expect(r.dados.porVideo.get('v3')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
  })
  it('as datas: a coleta do site, a coleta do canal e a agenda', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.coletaDoSiteDesdeMs).toBe(AGORA - 900 * H)
    expect(r.dados.coletaDoCanalDesdeMs).toBe(AGORA - 39 * H)
    expect(r.dados.ultimoOkDaTarefaMs).toBe(AGORA - H)
    expect(r.dados.primeiraExecucaoDaTarefaMs).toBe(AGORA - 2 * H)
  })
  it('nada nas tabelas: lido, vazio e datas nulas (dado ausente não é zero nem erro)', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios({}).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    expect(r).toMatchObject({ lido: true, dados: { coletaDoSiteDesdeMs: null, coletaDoCanalDesdeMs: null, ultimoOkDaTarefaMs: null, primeiraExecucaoDaTarefaMs: null } })
  })
  it('sem o cruzamento do vídeo com os do canal, contaria vídeo de outro canal: v9 é do outro canal e não conta', async () => {
    const r = await lerContagemDeRespostas(falsoComentarios(base()).client, { siteId: S, channelId: CANAL, videoIds: ['v9'] })
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.porVideo.get('v9')).toEqual({ retrato30: null, algumComRespostaDoCriador: false })
  })
  it('lê só video_id e creator_replied dos comentários; filtra por site e canal em toda consulta de dado', async () => {
    const db = falsoComentarios(base())
    await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    const c = db.pedidos.find((p) => p.table === 'competitor_video_comments')
    expect(c?.cols).toBe('video_id, creator_replied')
    for (const p of db.pedidos.filter((x) => x.table !== 'competitor_agenda_runs')) expect(p.eqs.site_id, p.table).toBe(S)
    expect(c?.eqs.competitor_channel_id).toBe(CANAL)
  })
  it('mais de 150 vídeos: o in() é partido em blocos de 150', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => 'x' + i)
    const db = falsoComentarios(base())
    await lerContagemDeRespostas(db.client, { siteId: S, channelId: CANAL, videoIds: ids })
    const blocos = db.pedidos.filter((p) => p.table === 'competitor_video_comments').map((p) => p.ins.video_id?.length)
    expect(blocos).toEqual([150, 150, 20])
  })
  it('erro do banco e tabela ausente: não lida, com o código e sem texto', async () => {
    expect(await lerContagemDeRespostas(falsoComentarios(base(), { erroEm: { competitor_video_comments: { code: '42P01', message: SENT } } }).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] }))
      .toEqual({ lido: false, causa: 'schema_ausente', codigo: 'banco:42p01' })
    const r = await lerContagemDeRespostas(falsoComentarios(base(), { erroEm: { competitor_agenda_runs: { code: 'XX000', message: SENT } } }).client, { siteId: S, channelId: CANAL, videoIds: ['v1'] })
    expect(r.lido).toBe(false)
    expect(JSON.stringify(r)).not.toContain(SENT)
  })
})

describe('lerRespostasDoCriador (E5a C1)', () => {
  const pedir = (provas: ProvasDeQuemVe | null, over: { videoIds?: string[]; channelId?: string } = {}, tabelas = base()) => {
    const db = falsoComentarios(tabelas)
    return lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas, channelId: over.channelId ?? CANAL, videoIds: over.videoIds ?? ['v1', 'v2'] }).then((r) => ({ r, db }))
  }
  it('nível contagem: lista vazia e o número de itens, sem texto, e a tabela de leituras não é tocada', async () => {
    const { r, db } = await pedir(null)
    expect(r).toEqual({ lido: true, dados: { nivel: 'contagem', total: 1, itens: [] } })
    expect(JSON.stringify(r)).not.toContain(SENT)
    expect(db.pedidos.map((p) => p.table)).toEqual(['competitor_video_comments'])
    expect(db.pedidos[0]?.cols).not.toMatch(/body|published_at/)
  })
  it('nível texto: o comentário, a resposta presa, as curtidas do marco mais recente e o vídeo; menções trocadas', async () => {
    const { r } = await pedir(provasTexto)
    if (!r.lido) throw new Error('esperava lido')
    expect(r.dados.itens).toEqual([{ videoId: 'v1', texto: '@… adorei', cortado: false, respostaTexto: 'valeu @…', respostaCortada: false, curtidas: 25, marco: 7, mencoesTrocadas: 2 }])
  })
  it('não consulta a tabela de identidade em nível nenhum (e a menção é trocada também no nível identidade)', async () => {
    for (const provas of [null, provasTexto, provasIdentidade]) {
      const { r, db } = await pedir(provas)
      expect(db.pedidos.map((p) => p.table), String(provas?.edicao)).not.toContain('competitor_video_comment_authors')
      if (r.lido && r.dados.itens.length) expect(r.dados.itens[0]?.texto).toBe('@… adorei')
    }
  })
  it('vídeo de outro canal não entra, mesmo na lista de ids (cruzamento)', async () => {
    const { r } = await pedir(provasTexto, { videoIds: ['v9'] })
    expect(r).toMatchObject({ lido: true, dados: { total: 0, itens: [] } })
  })
  it('sem o filtro de site, o comentário de outro site apareceria: nunca aparece', async () => {
    const t = base()
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(70, 'v1', { site_id: OUTRO_SITE, creator_replied: true })]
    const { r } = await pedir(null, {}, t)
    expect(r).toMatchObject({ lido: true, dados: { total: 1 } })
  })
  it('erro do banco: não lida', async () => {
    const db = falsoComentarios(base(), { erroEm: { competitor_video_comments: { code: 'XX000' } } })
    const r = await lerRespostasDoCriador(db.client, { siteDaGuarda: S, provas: null, channelId: CANAL, videoIds: ['v1'] })
    expect(r.lido).toBe(false)
  })
})
