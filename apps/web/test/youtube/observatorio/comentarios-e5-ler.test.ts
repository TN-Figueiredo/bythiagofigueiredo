// @vitest-environment node
// A5 · E5a · Tarefa C1: o leitor dos comentários de destaque de um vídeo (banco falso que registra o que foi pedido).
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { falsoComentarios, type Linha } from './comentarios-e5-fake'
import { edicaoDe } from './edicao-teste'
import { leituraDe } from './leitura-teste'
import type { ProvasDeQuemVe, ComentariosDoVideo, CartaoTexto, CartaoIdentidade } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({ requireSiteScope: vi.fn(async () => ({ ok: true, user: { id: 'u1' } })) }))
vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const tol = vi.hoisted(() => ({ horas: 36 }))
vi.mock('@/lib/youtube/agenda/definicoes', async (original) => {
  const m = await original<typeof import('@/lib/youtube/agenda/definicoes')>()
  return { ...m, DEFINICAO_RETRATOS_COMENTARIOS: { ...m.DEFINICAO_RETRATOS_COMENTARIOS, get toleranciaVigiaH() { return tol.horas } } }
})
const viva = vi.hoisted(() => ({ chamadas: 0 }))
vi.mock('@/lib/youtube/observatorio/medidas-telas/tarefa-viva', async (original) => {
  const m = await original<typeof import('@/lib/youtube/observatorio/medidas-telas/tarefa-viva')>()
  return { ...m, tarefaViva: (o: Parameters<typeof m.tarefaViva>[0]) => { viva.chamadas += 1; return m.tarefaViva(o) } }
})

import { lerComentariosDeDestaque, type PedidoDeComentarios } from '@/lib/youtube/observatorio/comentarios/leitor'
import { COMMENT_RULES } from '@/lib/youtube/observatorio/comentarios/regras'

const S = 'site-1'
const OUTRO_SITE = 'site-2'
const V = 'video-1'
const CANAL = 'canal-1'
const H = 3_600_000
const AGORA = Date.UTC(2026, 9, 15, 12)
const iso = (ms: number): string => new Date(ms).toISOString()
const SENT_TEXTO = 'zz-sentinela-texto'
const SENT_NOME = 'zz-sentinela-nome'
const SENT_YT = 'zz-sentinela-ytid'

/** Vídeo com 8 dias: o marco 1 já passou (72 h), o 7 está na janela (168 a 240 h), o 30 ainda vai chegar. */
const T0 = AGORA - 192 * H
const VIDEO = { t0Ms: T0, descobertoEmMs: T0 + 2 * H, canalId: CANAL }

const snap = (mark: number, over: Linha = {}): Linha => ({
  site_id: S, video_id: V, competitor_channel_id: CANAL, mark, status: 'ok', error_reason: null, taken_at: iso(T0 + (mark * 24 + 3) * H), video_age_hours: mark * 24 + 3,
  pool_size: 100, pool_complete: true, video_comment_count: 500, selected_count: 3, featured_lookup_n: 20, featured_unknown_n: 1, ...over,
})
const coment = (id: number, over: Linha = {}): Linha => ({
  id, site_id: S, video_id: V, competitor_channel_id: CANAL, youtube_comment_id: SENT_YT + id, parent_id: null, is_creator: false, creator_replied: null,
  featured_reason: null, featured_size_band: null, featured_ratio_band: null, missing_since: null,
  body: SENT_TEXTO + id, body_truncated: false, published_at: iso(T0 + H), first_seen_at: iso(T0 + 2 * H), author_purged_at: null, ...over,
})
const marca = (comment: number, mark: number, likes: number, slot: string | null, over: Linha = {}): Linha => ({
  comment_id: comment, site_id: S, mark, likes, reply_count: 2, slot, creator_replied: null, ...over,
})
const autor = (comment: number, expiraEmH: number, over: Linha = {}): Linha => ({
  comment_id: comment, site_id: S, display_name: SENT_NOME + comment, channel_id: 'canal-do-autor', avatar_url: 'https://foto/' + comment, expires_at: iso(AGORA + expiraEmH * H), ...over,
})
const execucao = (over: Linha = {}): Linha => ({ task: 'retratos_comentarios', status: 'ok', started_at: iso(AGORA - 2 * H), finished_at: iso(AGORA - 1 * H), ...over })

function base(): Record<string, Linha[]> {
  return {
    competitor_video_comment_snaps: [snap(1)],
    competitor_video_comments: [
      coment(1, { is_creator: true }),
      coment(2, { featured_reason: 'inscritos', featured_size_band: '1m_10m', featured_ratio_band: '10x_100x', creator_replied: true }),
      coment(3, { creator_replied: false }),
      coment(4, { featured_reason: 'canal_acompanhado' }),
      coment(9, { parent_id: 2, is_creator: true, body: 'resposta ' + SENT_TEXTO }),
    ],
    competitor_video_comment_marks: [marca(1, 1, 50, 'criador'), marca(2, 1, 40, 'destaque'), marca(3, 1, 30, 'curtidos'), marca(4, 1, 20, 'destaque')],
    competitor_video_comment_authors: [autor(2, 100), autor(3, 100), autor(4, 100)],
    competitor_agenda_runs: [execucao()],
  }
}

let provasContagem: ProvasDeQuemVe | null
let provasTexto: ProvasDeQuemVe
let provasIdentidade: ProvasDeQuemVe
beforeAll(async () => {
  provasContagem = null
  provasTexto = { leitura: await leituraDe(S), edicao: null }
  provasIdentidade = { leitura: await leituraDe(S), edicao: await edicaoDe(S) }
})
const canaisDoSite = new Map([[CANAL, { nome: 'Leo' }]])
const pedido = (provas: ProvasDeQuemVe | null, over: Partial<PedidoDeComentarios> = {}): PedidoDeComentarios =>
  ({ siteDaGuarda: S, provas, videoId: V, agoraMs: AGORA, canaisDoSite, video: VIDEO, ...over })
const dados = (r: Awaited<ReturnType<typeof lerComentariosDeDestaque>>): ComentariosDoVideo => {
  if (!r.lido) throw new Error('esperava lido, veio ' + r.causa + ' ' + r.codigo)
  return r.dados
}

describe('lerComentariosDeDestaque: os três níveis (E5a C1)', () => {
  it('contagem: o cartão não tem texto, autor, data nem id do YouTube; o JSON não leva os sentinelas', async () => {
    const db = falsoComentarios(base())
    const d = dados(await lerComentariosDeDestaque(db.client, pedido(provasContagem)))
    expect(d.nivel).toBe('contagem')
    expect(d.comentarios.map((c) => c.ordem)).toEqual([1, 2, 3, 4])
    for (const c of d.comentarios) for (const proibido of ['texto', 'autor', 'publicadoEm', 'respostasDoCriador', 'youtube_comment_id', 'id']) expect(Object.keys(c)).not.toContain(proibido)
    const json = JSON.stringify(d)
    for (const s of [SENT_TEXTO, SENT_NOME, SENT_YT, 'https://foto']) expect(json).not.toContain(s)
  })
  it('contagem: o select não pede body, published_at nem youtube_comment_id, e a tabela de autores não é tocada', async () => {
    const db = falsoComentarios(base())
    await lerComentariosDeDestaque(db.client, pedido(null))
    const doComent = db.pedidos.find((p) => p.table === 'competitor_video_comments')
    expect(doComent?.cols).not.toMatch(/body|published_at|youtube_comment_id|first_seen_at/)
    expect(db.pedidos.map((p) => p.table)).not.toContain('competitor_video_comment_authors')
  })
  it('texto: a tabela de autores não é consultada; "Um espectador" nos cartões e o canal grande na faixa, sem nome', async () => {
    const db = falsoComentarios(base())
    const d = dados(await lerComentariosDeDestaque(db.client, pedido(provasTexto)))
    expect(d.nivel).toBe('texto')
    expect(db.pedidos.map((p) => p.table)).not.toContain('competitor_video_comment_authors')
    const cs = d.comentarios as CartaoTexto[]
    expect(cs.map((c) => c.autor.tipo)).toEqual(['criador', 'canal_grande', 'espectador', 'espectador'])
    expect(JSON.stringify(d)).not.toContain(SENT_NOME)
    expect(cs[0]?.texto).toBe(SENT_TEXTO + '1')
  })
  it('identidade: o nome sai com "guardada até"; canal acompanhado antes dos 28 dias tem nome como qualquer autor', async () => {
    const db = falsoComentarios(base())
    const d = dados(await lerComentariosDeDestaque(db.client, pedido(provasIdentidade)))
    const cs = d.comentarios as CartaoIdentidade[]
    expect(cs[3]?.motivo).toBe('canal_acompanhado')
    expect(cs[3]?.autor).toEqual({ tipo: 'com_identidade', nome: SENT_NOME + '4', fotoUrl: 'https://foto/4', guardadaAte: iso(AGORA + 100 * H) })
    expect(cs[0]?.autor).toEqual({ tipo: 'criador' })
  })
  it('em nenhum nível channel_id do autor é pedido', async () => {
    for (const provas of [null, provasTexto, provasIdentidade]) {
      const db = falsoComentarios(base())
      await lerComentariosDeDestaque(db.client, pedido(provas))
      for (const p of db.pedidos) expect(p.cols, p.table).not.toMatch(/channel_id|featured_channel_id/)
    }
  })
  it('o criador tem o nome do cadastro em todos os níveis', async () => {
    for (const provas of [null, provasTexto, provasIdentidade]) {
      const d = dados(await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(provas)))
      expect(d.comentarios.every((c) => c.criadorNome === 'Leo')).toBe(true)
    }
  })
  it('nos níveis texto e identidade o site de toda consulta é o de dentro do token', async () => {
    const db = falsoComentarios(base())
    await lerComentariosDeDestaque(db.client, pedido(provasIdentidade))
    const comSite = db.pedidos.filter((p) => p.table !== 'competitor_agenda_runs')
    expect(comSite.length).toBeGreaterThanOrEqual(5)
    for (const p of comSite) expect(p.eqs.site_id, p.table).toBe(S)
  })
  it('token de leitura de outro site: contagem do site da guarda, e zero linha do outro', async () => {
    const t = base()
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(77, { site_id: OUTRO_SITE })]
    t.competitor_video_comment_marks = [...(t.competitor_video_comment_marks ?? []), marca(77, 1, 999, 'curtidos', { site_id: OUTRO_SITE })]
    const db = falsoComentarios(t)
    const d = dados(await lerComentariosDeDestaque(db.client, pedido({ leitura: await leituraDe(OUTRO_SITE), edicao: await edicaoDe(OUTRO_SITE) })))
    expect(d.nivel).toBe('contagem')
    expect(d.comentarios).toHaveLength(4)
    for (const p of db.pedidos.filter((x) => x.table !== 'competitor_agenda_runs')) expect(p.eqs.site_id).toBe(S)
  })
})

describe('lerComentariosDeDestaque: o que cada cartão diz (E5a C1)', () => {
  it('curtidas por marco: o número, fora_dos_12 (marco retratado, sem leitura) e ainda_nao (marco sem retrato ok); nunca 0', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1), snap(7)]
    t.competitor_video_comment_marks = [marca(1, 1, 50, 'criador'), marca(2, 1, 40, 'destaque'), marca(3, 1, 30, 'curtidos'), marca(4, 1, 20, 'destaque'), marca(1, 7, 55, 'criador')]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null)))
    const por = Object.fromEntries(d.comentarios.map((c) => [c.ordem, c.curtidas]))
    expect(por[1]).toEqual({ 1: 50, 7: 55, 30: 'ainda_nao' })
    expect(por[2]).toEqual({ 1: 40, 7: 'fora_dos_12', 30: 'ainda_nao' })
    for (const c of d.comentarios) for (const v of Object.values(c.curtidas)) expect(v).not.toBe(0)
  })
  it('o criador: respondeu, nao_vimos, nao_sabemos (a coluna do banco, sem inventar)', async () => {
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(null)))
    expect(d.comentarios.map((c) => c.criador)).toEqual(['nao_sabemos', 'respondeu', 'nao_vimos', 'nao_sabemos'])
  })
  it('o motivo do cartão sai do grupo de seleção, com o motivo do destaque; a faixa vem do dado', async () => {
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(null)))
    expect(d.comentarios.map((c) => c.motivo)).toEqual(['criador', 'inscritos', 'curtidos', 'canal_acompanhado'])
    expect(d.comentarios[1]?.faixas).toEqual({ tamanho: '1m_10m', razao: '10x_100x' })
  })
  it('missing_since vira saiuDoYouTubeDesde; é data nossa e existe em todos os níveis', async () => {
    const t = base()
    t.competitor_video_comments = (t.competitor_video_comments ?? []).map((c) => (c.id === 3 ? { ...c, missing_since: '2026-10-12' } : c))
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null)))
    expect(d.comentarios[2]?.saiuDoYouTubeDesde).toBe('2026-10-12')
    expect(d.comentarios[0]?.saiuDoYouTubeDesde).toBeNull()
  })
  it('I-1 (trem 6): a resposta do criador que saiu do YouTube nunca entra no cartão', async () => {
    const t = base()
    const extra = [coment(20, { parent_id: 2, is_creator: true, body: 'resp-saiu-sentinela', missing_since: '2026-10-12', published_at: iso(T0 + 1 * H) })]
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), ...extra]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasTexto)))
    expect(JSON.stringify(d)).not.toContain('resp-saiu-sentinela')
  })
  it('T1: a resposta do criador traz a data (ISO do published_at), em ordem da mais antiga', async () => {
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(provasTexto)))
    const rs = (d.comentarios as CartaoTexto[]).flatMap((c) => c.respostasDoCriador)
    expect(rs.length).toBeGreaterThan(0)
    for (const r of rs) expect(r.publicadoEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(rs[0]?.publicadoEm).toBe(iso(T0 + H))
  })
  it('no máximo 3 respostas do criador por comentário, em ordem de data', async () => {
    const t = base()
    const extra = [10, 11, 12].map((id, i) => coment(id, { parent_id: 2, is_creator: true, body: 'r' + i, published_at: iso(T0 + (10 - i) * H) }))
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), ...extra]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasTexto)))
    const c = (d.comentarios as CartaoTexto[])[1]
    expect(c?.respostasDoCriador).toHaveLength(COMMENT_RULES.creatorRepliesMax)
  })
  it('a lista é a do que foi escolhido em algum marco; comentário só lido por id (slot nulo) não entra', async () => {
    const t = base()
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(5)]
    t.competitor_video_comment_marks = [...(t.competitor_video_comment_marks ?? []), marca(5, 1, 99, null)]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null)))
    expect(d.comentarios).toHaveLength(4)
  })
  it('entrouNoMarco e nosMarcos: o primeiro marco em que foi escolhido, e todos eles', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1), snap(7)]
    t.competitor_video_comment_marks = [...(t.competitor_video_comment_marks ?? []), marca(2, 7, 10, 'destaque'), marca(3, 7, 60, 'curtidos'), marca(3, 1, 30, null)]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null)))
    const c2 = d.comentarios.find((c) => c.motivo === 'inscritos')
    expect(c2?.nosMarcos).toEqual([1, 7])
    const c3 = d.comentarios.find((c) => c.motivo === 'curtidos')
    expect(c3?.entrouNoMarco).toBe(7)
    expect(c3?.nosMarcos).toEqual([7])
  })
})

describe('lerComentariosDeDestaque: identidade, menções e prazo (E5a C1)', () => {
  it('identidade com 27 dias sai; com 28 dias e 1 minuto não sai, nem para quem edita (relógio por parâmetro)', async () => {
    const t = base()
    const agora = AGORA
    t.competitor_video_comment_authors = [autor(2, 1 * 24 - 1 / 60), autor(3, -1 / 60), autor(4, 100)]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade, { agoraMs: agora })))
    const tipos = (d.comentarios as CartaoIdentidade[]).map((c) => c.autor.tipo)
    expect(tipos).toEqual(['criador', 'com_identidade', 'espectador', 'com_identidade'])
  })
  it('author_purged_at preenchido com a linha de autor ainda no banco: espectador (não confia na rotina)', async () => {
    const t = base()
    t.competitor_video_comments = (t.competitor_video_comments ?? []).map((c) => (c.id === 3 ? { ...c, author_purged_at: iso(AGORA - H) } : c))
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade)))
    expect((d.comentarios as CartaoIdentidade[])[2]?.autor).toEqual({ tipo: 'espectador' })
  })
  it('autor sem linha na tabela de identidade: espectador', async () => {
    const t = base()
    t.competitor_video_comment_authors = []
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade)))
    expect((d.comentarios as CartaoIdentidade[]).map((c) => c.autor.tipo)).toEqual(['criador', 'canal_grande', 'espectador', 'espectador'])
  })
  it('canal acompanhado depois dos 28 dias: espectador, com o motivo no cartão e sem featured_channel_id pedido nem resolvido (decisão 67)', async () => {
    const t = base()
    t.competitor_video_comment_authors = [autor(2, 100), autor(3, 100), autor(4, -1)]
    const db = falsoComentarios(t)
    const d = dados(await lerComentariosDeDestaque(db.client, pedido(provasIdentidade)))
    const c = (d.comentarios as CartaoIdentidade[])[3]
    expect(c?.motivo).toBe('canal_acompanhado')
    expect(c?.autor).toEqual({ tipo: 'espectador' })
    for (const p of db.pedidos) expect(p.cols).not.toContain('featured_channel_id')
  })
  it('canal acompanhado, nível texto: espectador', async () => {
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(provasTexto)))
    expect((d.comentarios as CartaoTexto[])[3]?.autor).toEqual({ tipo: 'espectador' })
  })
  it('menções: no nível texto o @ vira "@…" no comentário e na resposta presa; com identidade válida o texto sai como veio', async () => {
    const t = base()
    t.competitor_video_comments = (t.competitor_video_comments ?? []).map((c) =>
      c.id === 2 ? { ...c, body: 'oi @fulano tudo bem' } : c.id === 9 ? { ...c, body: '@autor valeu, @outro tb' } : c)
    const texto = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasTexto)))
    const c = (texto.comentarios as CartaoTexto[])[1]
    expect(c?.texto).toBe('oi @… tudo bem')
    expect(c?.respostasDoCriador[0]?.texto).toBe('@… valeu, @… tb')
    expect(c?.mencoesTrocadas).toBe(3)
    const ident = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade)))
    const ci = (ident.comentarios as CartaoIdentidade[])[1]
    expect(ci?.autor.tipo).toBe('com_identidade')
    expect(ci?.texto).toBe('oi @fulano tudo bem')
    expect(ci?.mencoesTrocadas).toBe(0)
  })
  it('menção no nível identidade depois do vencimento: trocada', async () => {
    const t = base()
    t.competitor_video_comments = (t.competitor_video_comments ?? []).map((c) => (c.id === 3 ? { ...c, body: 'oi @fulano' } : c))
    t.competitor_video_comment_authors = [autor(3, -5)]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade)))
    expect((d.comentarios as CartaoIdentidade[])[2]?.texto).toBe('oi @…')
  })
})

describe('lerComentariosDeDestaque: o estado de cada marco (E5a C1)', () => {
  const h = (n: number): number => AGORA - n * H
  const so = (t: Record<string, Linha[]>, over: Partial<PedidoDeComentarios> = {}) => lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null, over)).then(dados)
  const vazio = (): Record<string, Linha[]> => ({
    competitor_video_comment_snaps: [], competitor_video_comments: [], competitor_video_comment_marks: [], competitor_video_comment_authors: [], competitor_agenda_runs: [],
  })

  it('nenhuma linha nas quatro tabelas: lido, os três marcos em coleta_nao_comecou, nenhum zero, e tarefaViva não é chamada', async () => {
    viva.chamadas = 0
    const d = await so(vazio())
    expect(d.comentarios).toEqual([])
    expect(Object.values(d.marcos).map((m) => m.estado)).toEqual(['coleta_nao_comecou', 'coleta_nao_comecou', 'coleta_nao_comecou'])
    expect(viva.chamadas).toBe(0)
  })
  it('nenhum retrato no site e a leitura da agenda falhou: parte não lida', async () => {
    const r = await lerComentariosDeDestaque(falsoComentarios(vazio(), { erroEm: { competitor_agenda_runs: { code: 'XX000' } } }).client, pedido(null))
    expect(r.lido).toBe(false)
  })
  it('tabela ausente: schema_ausente (e o código, sem texto)', async () => {
    const r = await lerComentariosDeDestaque(falsoComentarios(base(), { erroEm: { competitor_video_comment_snaps: { code: '42P01', message: 'texto ' + SENT_TEXTO } } }).client, pedido(null))
    expect(r).toEqual({ lido: false, causa: 'schema_ausente', codigo: 'banco:42p01' })
    expect(JSON.stringify(r)).not.toContain(SENT_TEXTO)
  })
  it('erro em uma das consultas: a parte inteira é não lida (não se monta cartão com metade)', async () => {
    for (const tabela of ['competitor_video_comment_snaps', 'competitor_video_comments', 'competitor_video_comment_marks', 'competitor_video_comment_authors', 'competitor_agenda_runs']) {
      const r = await lerComentariosDeDestaque(falsoComentarios(base(), { erroEm: { [tabela]: { code: 'XX000' } } }).client, pedido(provasIdentidade))
      expect(r.lido, tabela).toBe(false)
    }
  })
  it('exceção na ida e resposta que não é lista: não lida, sem lançar', async () => {
    expect((await lerComentariosDeDestaque(falsoComentarios(base(), { lancaEm: ['competitor_video_comments'] }).client, pedido(null))).lido).toBe(false)
    expect((await lerComentariosDeDestaque(falsoComentarios(base(), { dadoNuloEm: ['competitor_video_comment_snaps'] }).client, pedido(null))).lido).toBe(false)
  })
  it('linha fora da forma esperada deixa a parte não lida, nunca é pulada em silêncio', async () => {
    const t = base()
    t.competitor_video_comment_marks = [...(t.competitor_video_comment_marks ?? []), marca(1, 7, 'muitas' as unknown as number, 'curtidos')]
    const r = await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null))
    expect(r).toEqual({ lido: false, causa: 'erro_do_banco', codigo: 'forma_inesperada' })
  })
  it('erro + lista_vazia_com_contagem (a forma que a E14 grava) com 57 no vídeo: lista_vazia com o total e a data, não "erro"', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { status: 'erro', error_reason: 'lista_vazia_com_contagem', selected_count: null, video_comment_count: 57 })]
    const d = await so(t)
    expect(d.marcos[1]).toEqual({ estado: 'nao_coletado', porque: { causa: 'lista_vazia', tomadoEmMs: T0 + 27 * H, ateMs: T0 + 72 * H, encerrada: true, totalDoDia: 57 } })
  })
  it('erro + lista_vazia_com_contagem com a contagem nula: lista_vazia com total nulo (nunca afirma contagem)', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { status: 'erro', error_reason: 'lista_vazia_com_contagem', selected_count: null, video_comment_count: null })]
    const d = await so(t)
    expect(d.marcos[1]).toMatchObject({ estado: 'nao_coletado', porque: { causa: 'lista_vazia', totalDoDia: null } })
  })
  it('defesa: ok com zero escolhidos continua lista_vazia, com a data e o total do retrato (57 e nulo)', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { selected_count: 0, video_comment_count: 57 })]
    expect((await so(t)).marcos[1]).toMatchObject({ estado: 'nao_coletado', porque: { causa: 'lista_vazia', totalDoDia: 57, tomadoEmMs: T0 + 27 * H } })
    t.competitor_video_comment_snaps = [snap(1, { selected_count: 0, video_comment_count: null })]
    expect((await so(t)).marcos[1]).toMatchObject({ porque: { causa: 'lista_vazia', totalDoDia: null } })
  })
  it('erro com outro código (proibido): causa erro com o código; sem código gravado: sem_codigo', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { status: 'erro', error_reason: 'proibido', selected_count: null, video_comment_count: 12 })]
    expect((await so(t)).marcos[1]).toMatchObject({ estado: 'nao_coletado', porque: { causa: 'erro', codigo: 'proibido', totalDoDia: 12 } })
    t.competitor_video_comment_snaps = [snap(1, { status: 'erro', error_reason: null, selected_count: null })]
    expect((await so(t)).marcos[1]).toMatchObject({ porque: { causa: 'erro', codigo: 'sem_codigo' } })
  })
  it('encerrada: a janela do marco já fechou (agora > t0 + untilH), no erro e na lista vazia', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { status: 'erro', error_reason: 'rede', selected_count: null }), snap(7, { status: 'erro', error_reason: 'lista_vazia_com_contagem', selected_count: null })]
    const d = await so(t, { agoraMs: T0 + 73 * H })
    expect(d.marcos[1]).toMatchObject({ porque: { causa: 'erro', encerrada: true } })
    expect(d.marcos[7]).toMatchObject({ porque: { causa: 'lista_vazia', encerrada: false } })
  })
  it('sem_comentarios, desligados e erro (com a data da tentativa e até quando se tenta)', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [snap(1, { status: 'sem_comentarios', selected_count: 0 }), snap(7, { status: 'erro', error_reason: 'rede', video_comment_count: null }), snap(30, { status: 'desligados' })]
    const d = await so(t, { agoraMs: T0 + 40 * 24 * H })
    expect(d.marcos[1].estado).toBe('sem_comentarios')
    expect(d.marcos[30].estado).toBe('desligados')
    expect(d.marcos[7]).toEqual({ estado: 'nao_coletado', porque: { causa: 'erro', tentouEmMs: T0 + (7 * 24 + 3) * H, ateMs: T0 + 240 * H, encerrada: true, codigo: 'rede', totalDoDia: null } })
  })
  it('cliente sem leitura (zero comentários) com retrato ok e escolhidos > 0: parte não lida, nunca "lista vazia"', async () => {
    const t = base()
    t.competitor_video_comments = []
    t.competitor_video_comment_marks = []
    expect(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null))).toEqual({ lido: false, causa: 'erro_do_banco', codigo: 'forma_inesperada' })
    expect((await lerComentariosDeDestaque(falsoComentarios(base()).client, pedido(null))).lido).toBe(true)
  })
  it('a posição do YouTube (relevance_rank) vai ao cartão por marco; nula onde não há leitura', async () => {
    const t = base()
    t.competitor_video_comment_marks = (t.competitor_video_comment_marks ?? []).map((m) => (m.comment_id === 2 ? { ...m, relevance_rank: 7 } : m))
    const d = await so(t)
    expect(d.comentarios.find((c) => c.entrouNoMarco === 1 && c.posicao[1] === 7)).toBeDefined()
    expect(d.comentarios[0]?.posicao[30]).toBeNull()
  })
  it('o resumo do marco ok traz o total do dia, não o de hoje', async () => {
    const d = await so(base())
    const m = d.marcos[1]
    expect(m.estado).toBe('ok')
    if (m.estado === 'ok') expect(m.resumo).toMatchObject({ totalDoDia: 500, amostra: 100, amostraCompleta: true, escolhidos: 3 })
  })
  // ---- as fronteiras de idade, sem linha de retrato ----
  const semLinha = (): Record<string, Linha[]> => ({ ...base(), competitor_video_comment_snaps: [snap(30, { video_age_hours: 800, selected_count: 1 })], competitor_video_comments: [coment(1)], competitor_video_comment_marks: [marca(1, 1, 5, 'curtidos'), marca(1, 7, 5, 'curtidos'), marca(1, 30, 5, 'curtidos')] })
  const COM = (marco: 1 | 7 | 30) => COMMENT_RULES.marks.find((m) => m.mark === marco)
  it('sem linha, idade futura e coleta viva: fecha_em, com a data', async () => {
    const d = await so(semLinha())
    expect(d.marcos[7]).toMatchObject({ estado: 'a_caminho' })
    expect(d.marcos[30]).toMatchObject({ estado: 'ok' })
    const t = semLinha()
    t.competitor_video_comment_snaps = [snap(1)]
    const d2 = await so(t)
    expect(d2.marcos[30]).toEqual({ estado: 'fecha_em', fechaEmMs: T0 + (COM(30)?.fromH ?? 0) * H })
  })
  it('idade exatamente fromH: a_caminho, não fecha_em; um minuto antes, fecha_em', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)] }
    const from7 = T0 + (COM(7)?.fromH ?? 0) * H
    expect((await so(t, { agoraMs: from7 })).marcos[7].estado).toBe('a_caminho')
    expect((await so(t, { agoraMs: from7 - 60_000 })).marcos[7].estado).toBe('fecha_em')
  })
  it('idade exatamente untilH: a_caminho; um minuto depois: janela_perdida', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [execucao({ finished_at: iso(T0 + 240 * H) })] }
    const until7 = T0 + (COM(7)?.untilH ?? 0) * H
    expect((await so(t, { agoraMs: until7 })).marcos[7].estado).toBe('a_caminho')
    const depois = await so({ ...t, competitor_agenda_runs: [execucao({ finished_at: iso(until7 + 30_000) })] }, { agoraMs: until7 + 60_000 })
    expect(depois.marcos[7]).toEqual({ estado: 'nao_coletado', porque: { causa: 'janela_perdida' } })
  })
  it('a_caminho traz as duas datas, e a segunda é t0 + untilH', async () => {
    const m = (await so(semLinha())).marcos[7]
    expect(m).toEqual({ estado: 'a_caminho', fezEmMs: T0 + (COM(7)?.fromH ?? 0) * H, ateMs: T0 + (COM(7)?.untilH ?? 0) * H })
  })
  it('a_caminho com a coleta parada: coleta_parada, sem promessa', async () => {
    const t = { ...semLinha(), competitor_agenda_runs: [execucao({ finished_at: iso(h(100)), started_at: iso(h(101)) })] }
    const d = await so(t)
    expect(d.marcos[7]).toEqual({ estado: 'coleta_parada', desdeMs: h(100), semOk: false })
  })
  it('sem linha, idade passada da tolerância e discovered_at posterior a ela: tarde', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(30), snap(1, { video_id: 'outro-video', taken_at: iso(T0 - 5 * H) })] }
    const d = await so(t, { video: { ...VIDEO, descobertoEmMs: T0 + 100 * H }, agoraMs: T0 + 400 * H })
    expect(d.marcos[1]).toEqual({ estado: 'nao_coletado', porque: { causa: 'tarde' } })
  })
  it('sem linha, idade passada, vídeo descoberto com 2 horas e a coleta já existia: janela_perdida, nunca tarde', async () => {
    const d = await so({ ...semLinha(), competitor_video_comment_snaps: [snap(30, { taken_at: iso(T0 - 5 * H) })] }, { agoraMs: T0 + 400 * H })
    expect(d.marcos[1]).toEqual({ estado: 'nao_coletado', porque: { causa: 'janela_perdida' } })
  })
  it('janela cortada pelo começo da coleta (começa antes, termina depois): janela_perdida, não antes_da_coleta', async () => {
    const primeiro = T0 + 50 * H // dentro da janela do marco 1 (24 a 72 h)
    const d = await so({ ...semLinha(), competitor_video_comment_snaps: [snap(30, { taken_at: iso(primeiro) })] }, { agoraMs: T0 + 400 * H })
    expect(d.marcos[1].estado).toBe('nao_coletado')
  })
  it('janela inteira antes do primeiro retrato do site: antes_da_coleta, com a data real', async () => {
    const primeiro = T0 + 100 * H
    const d = await so({ ...semLinha(), competitor_video_comment_snaps: [snap(30, { taken_at: iso(primeiro) })] }, { agoraMs: T0 + 400 * H })
    expect(d.marcos[1]).toEqual({ estado: 'antes_da_coleta', coletaDesdeMs: primeiro })
  })
  it('a leitura da agenda falhou: parte não lida, nenhum fecha_em', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)] }
    const r = await lerComentariosDeDestaque(falsoComentarios(t, { erroEm: { competitor_agenda_runs: { code: 'XX000' } } }).client, pedido(null))
    expect(r.lido).toBe(false)
  })
  it('sem execução nenhuma na agenda mas com retrato: não lida (nunca viva, nunca data nula)', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [] }
    const r = await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(null))
    expect(r.lido).toBe(false)
  })
  it('7 dias sem retrato novo e tarefa com ok há 1 hora: viva, e "fecha em" continua', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1, { taken_at: iso(h(24 * 7)) })] }
    expect((await so(t)).marcos[30].estado).toBe('fecha_em')
  })
  it('retrato de ontem e tarefa sem ok há 3 dias: coleta_parada, com a data do último ok', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [execucao({ finished_at: iso(h(72)) })] }
    expect((await so(t)).marcos[30]).toEqual({ estado: 'coleta_parada', desdeMs: h(72), semOk: false })
  })
  it('ok ontem às 13:05, parcial hoje às 13:05, agora 16:00: viva, e "fecha em" continua', async () => {
    const agora = Date.UTC(2026, 9, 15, 19)
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [execucao({ finished_at: iso(Date.UTC(2026, 9, 14, 16, 5)) }), execucao({ status: 'parcial', finished_at: iso(Date.UTC(2026, 9, 15, 16, 5)) })] }
    expect((await so(t, { agoraMs: agora })).marcos[30].estado).toBe('fecha_em')
  })
  it('nenhum ok e primeira execução há 3 horas: viva; há 40 horas: coleta_parada com a data da primeira execução', async () => {
    const t = (inicio: number): Record<string, Linha[]> => ({ ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [execucao({ status: 'parcial', started_at: iso(inicio), finished_at: iso(inicio + H) })] })
    expect((await so(t(h(3)))).marcos[30].estado).toBe('fecha_em')
    expect((await so(t(h(40)))).marcos[30]).toEqual({ estado: 'coleta_parada', desdeMs: h(40), semOk: true })
  })
  it('a tolerância é a de DEFINICAO_RETRATOS_COMENTARIOS: trocá-la move a fronteira', async () => {
    const t = { ...semLinha(), competitor_video_comment_snaps: [snap(1)], competitor_agenda_runs: [execucao({ finished_at: iso(h(10)) })] }
    expect((await so(t)).marcos[30].estado).toBe('fecha_em')
    tol.horas = 5
    try {
      expect((await so(t)).marcos[30].estado).toBe('coleta_parada')
    } finally { tol.horas = 36 }
  })
})

describe('lerComentariosDeDestaque: provas por mutação (o filtro de site em cada consulta) (E5a C1)', () => {
  it('o comentário, a leitura e a identidade de outro site com o mesmo vídeo nunca aparecem', async () => {
    const t = base()
    t.competitor_video_comment_snaps = [...(t.competitor_video_comment_snaps ?? []), snap(7, { site_id: OUTRO_SITE, status: 'desligados' })]
    t.competitor_video_comments = [...(t.competitor_video_comments ?? []), coment(50, { site_id: OUTRO_SITE })]
    t.competitor_video_comment_marks = [...(t.competitor_video_comment_marks ?? []), marca(50, 1, 5, 'curtidos', { site_id: OUTRO_SITE }), marca(1, 7, 1, 'criador', { site_id: OUTRO_SITE })]
    t.competitor_video_comment_authors = [...(t.competitor_video_comment_authors ?? []), autor(2, 100, { site_id: OUTRO_SITE, display_name: 'intruso' })]
    const d = dados(await lerComentariosDeDestaque(falsoComentarios(t).client, pedido(provasIdentidade)))
    expect(d.comentarios).toHaveLength(4)
    expect(d.marcos[7].estado).not.toBe('desligados')
    expect(d.comentarios[0]?.curtidas[7]).not.toBe(1)
    expect(JSON.stringify(d)).not.toContain('intruso')
  })
})
