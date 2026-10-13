// A5 · E14: a fronteira TypeScript x SQL da coleta de comentários. Monta o pacote e chama as cinco funções do banco,
// sem confiar em forma nenhuma de resposta e sem esperar para sempre (toda ida leva tempo máximo).
//
// DADO PESSOAL (LGPD): nome, id de canal e foto do autor vão SÓ para `author` de cada comentário (a tabela de identidade, que a
// anulação aos 28 dias limpa). O texto do comentário vai só para `body`. Nada disso entra em erro, log, nota nem Sentry:
// o que sai daqui para fora é código de catálogo e número. O erro do banco (que pode citar a linha recusada) nunca é repassado.
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMMENT_RULES, MOTIVOS, MOTIVOS_PASSAGEIROS, ruleParams } from './regras'
import { ComentariosErro, codigoDe } from './erro'
import type { AgregadosDoLote, Conversa, Devido, Escolhido, EstadoRetrato, Marco, Motivo, ProvaComentarios, RespostaVista } from './tipos'

export type Json = string | number | boolean | null | Json[] | { [chave: string]: Json }

/** Pacote que `montarPacote` entrega e `gravarRetrato` envia. */
export interface Pacote { snap: Json; comments: Json[]; missing: string[] }

/** Defeito nosso na montagem do pacote (não do banco, não da API). A mensagem é fixa: nunca leva dado de terceiros. */
export class PacoteInvalido extends Error {
  constructor(motivo: string) {
    super('comentarios: pacote invalido: ' + motivo)
    this.name = 'PacoteInvalido'
  }
}

// ───── a ida ao banco, com tempo máximo ─────

interface RespostaBanco { data: unknown; error: unknown }

const CODIGOS_SCHEMA_AUSENTE: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01', 'PGRST205'])
const ERRO_DE_TEMPO: RespostaBanco = { data: null, error: { message: 'AbortError: tempo esgotado', code: '' } }

function codigoBruto(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const c = (err as { code?: unknown }).code
  return typeof c === 'string' ? c : null
}

/** A função ou a tabela não existe (a MG8 não foi aplicada). */
export function ehSchemaAusente(err: unknown): boolean {
  const c = codigoBruto(err)
  return c !== null && CODIGOS_SCHEMA_AUSENTE.has(c)
}

/**
 * Uma ida ao banco: o sinal aborta aos `dbTimeoutMs` (AbortController + setTimeout, que obedece ao relógio falso dos testes) e a
 * espera também é cortada ali, para o caso de o cliente não reagir ao sinal. Nunca lança: exceção vira `error`.
 */
async function comTempo(ida: (sinal: AbortSignal) => PromiseLike<RespostaBanco>): Promise<RespostaBanco> {
  const ctl = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const corte = new Promise<RespostaBanco>((resolve) => {
    timer = setTimeout(() => { ctl.abort(); resolve(ERRO_DE_TEMPO) }, COMMENT_RULES.dbTimeoutMs)
  })
  try {
    return await Promise.race([Promise.resolve(ida(ctl.signal)), corte])
  } catch (e) {
    return { data: null, error: e }
  } finally {
    clearTimeout(timer)
  }
}

/** O erro que pode sair deste módulo: só o código do banco (ou o aviso de tempo), nunca message, details nem hint do banco. */
function erroSaneado(err: unknown): unknown {
  const codigo = codigoDe(err)
  if (codigo === 'banco:tempo_esgotado') return { message: 'AbortError: tempo esgotado', code: '' }
  const bruto = codigoBruto(err)
  if (typeof err === 'object' && err !== null && !(err instanceof Error) && typeof (err as { message?: unknown }).message === 'string') {
    return { message: 'erro do banco', code: bruto !== null && /^(PGRST\d{3}|[A-Za-z0-9]{5})$/.test(bruto) ? bruto : '' }
  }
  const nome = typeof err === 'object' && err !== null ? (err as { name?: unknown }).name : undefined
  const e = new Error('comentarios: erro inesperado')
  e.name = typeof nome === 'string' && /^[A-Za-z]{1,30}$/.test(nome) ? nome : 'Error'
  return e
}

const ehObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const ehContagem = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

// ───── a prova (e a guarda de schema) ─────

const CHAVES_NUMERICAS_PROVA = [
  'identidade_vencida', 'identidade_prazo_errado', 'identidade_de_criador', 'respostas_de_terceiros', 'retratos_atrasados',
  'retratos_em_erro', 'retratos_na_janela', 'retratos_perdidos_7d', 'retratos_total', 'retratos_ok', 'comentarios_total',
  'identidades_total', 'comentarios_ausentes_sem_decisao',
] as const
const CHAVES_MAPA_PROVA = ['erros_por_motivo', 'perdidos_por_motivo'] as const

function mapaDeInteiros(x: unknown): Record<string, number> | null {
  if (!ehObj(x)) return null
  const saida: Record<string, number> = {}
  for (const [k, v] of Object.entries(x)) {
    if (!ehContagem(v)) return null
    saida[k] = v
  }
  return saida
}

function provaDe(x: unknown): ProvaComentarios | null {
  if (!ehObj(x)) return null
  const n: Record<string, number> = {}
  for (const k of CHAVES_NUMERICAS_PROVA) {
    const v = x[k]
    if (!ehContagem(v)) return null
    n[k] = v
  }
  const erros = mapaDeInteiros(x.erros_por_motivo)
  const perdidos = mapaDeInteiros(x.perdidos_por_motivo)
  const { primeira_coleta: primeira, ultima_coleta: ultima } = x
  if (erros === null || perdidos === null) return null
  if ((primeira !== null && typeof primeira !== 'string') || (ultima !== null && typeof ultima !== 'string')) return null
  // Já validadas acima: todas as chaves de `n` são inteiros >= 0.
  const g = (k: typeof CHAVES_NUMERICAS_PROVA[number]): number => n[k] as number
  return {
    identidade_vencida: g('identidade_vencida'), identidade_prazo_errado: g('identidade_prazo_errado'),
    identidade_de_criador: g('identidade_de_criador'), respostas_de_terceiros: g('respostas_de_terceiros'),
    retratos_atrasados: g('retratos_atrasados'), retratos_em_erro: g('retratos_em_erro'), erros_por_motivo: erros,
    retratos_na_janela: g('retratos_na_janela'), retratos_perdidos_7d: g('retratos_perdidos_7d'), perdidos_por_motivo: perdidos,
    retratos_total: g('retratos_total'), retratos_ok: g('retratos_ok'), primeira_coleta: primeira, ultima_coleta: ultima,
    comentarios_total: g('comentarios_total'), identidades_total: g('identidades_total'),
    comentarios_ausentes_sem_decisao: g('comentarios_ausentes_sem_decisao'),
  }
}

/** [{ mark, from_h, until_h }] derivado de COMMENT_RULES.marks: o banco dá verde com chave de nome errado, então a forma é fixa. */
function marcosParaBanco(): Array<{ mark: number; from_h: number; until_h: number }> {
  return COMMENT_RULES.marks.map((m) => ({ mark: m.mark, from_h: m.fromH, until_h: m.untilH }))
}

export async function lerProva(
  sb: SupabaseClient,
  p: { siteId: string | null; nowIso: string; since: string | null },
): Promise<{ ok: true; prova: ProvaComentarios } | { ok: false; motivo: 'schema_ausente' | 'prova_ilegivel' }> {
  const r = await comTempo((sinal) => sb.rpc('competitor_comment_health', {
    p_site_id: p.siteId, p_now: p.nowIso, p_marks: marcosParaBanco(), p_identity_days: COMMENT_RULES.identityDays,
    p_grace: COMMENT_RULES.graceHours + ' hours', p_since: p.since,
  }).abortSignal(sinal))
  if (r.error !== null && r.error !== undefined) return { ok: false, motivo: ehSchemaAusente(r.error) ? 'schema_ausente' : 'prova_ilegivel' }
  const prova = provaDe(r.data)
  return prova === null ? { ok: false, motivo: 'prova_ilegivel' } : { ok: true, prova }
}

// ───── a lista do que está devido ─────

function devidoDe(x: unknown): Devido | null {
  if (!ehObj(x)) return null
  const txt = (k: string): string | null => (typeof x[k] === 'string' && x[k] !== '' ? (x[k] as string) : null)
  const txtOuNulo = (k: string): string | null | undefined => (x[k] === null ? null : typeof x[k] === 'string' ? (x[k] as string) : undefined)
  const numOuNulo = (k: string): number | null | undefined => (x[k] === null ? null : typeof x[k] === 'number' && Number.isFinite(x[k]) ? (x[k] as number) : undefined)
  const marco = x.mark
  const subsOcultos = x.channel_subscribers_hidden
  const videoId = txt('video_id'), ytId = txt('youtube_video_id'), siteId = txt('site_id'), canalLinha = txt('channel_row_id')
  const canalYt = txt('channel_youtube_id'), t0 = txt('t0'), deadline = txt('deadline')
  const subs = numOuNulo('channel_subscribers'), contagem = numOuNulo('video_comment_count')
  const conferido = txtOuNulo('video_checked_at'), anterior = txtOuNulo('prev_status')
  if (marco !== 1 && marco !== 7 && marco !== 30) return null
  if (videoId === null || ytId === null || siteId === null || canalLinha === null || canalYt === null || t0 === null || deadline === null) return null
  if (subs === undefined || contagem === undefined || conferido === undefined || anterior === undefined) return null
  if (subsOcultos !== null && typeof subsOcultos !== 'boolean') return null
  if (!ehContagem(x.stored_n) || !ehContagem(x.total_due)) return null
  return {
    videoId, youtubeVideoId: ytId, siteId, channelRowId: canalLinha, channelYoutubeId: canalYt, channelSubscribers: subs,
    channelSubscribersHidden: subsOcultos, mark: marco, t0, deadline, videoCommentCount: contagem, videoCheckedAt: conferido,
    prevStatus: anterior, storedN: x.stored_n, totalDue: x.total_due,
  }
}

export async function lerDevidos(
  sb: SupabaseClient,
  p: { nowIso: string; since: string | null; siteId: string | null },
): Promise<{ linhas: Devido[]; total: number } | null> {
  const r = await comTempo((sinal) => sb.rpc('competitor_comment_due', {
    p_now: p.nowIso, p_marks: marcosParaBanco(), p_retry_after: COMMENT_RULES.retryAfterHours + ' hours', p_limit: COMMENT_RULES.dueLimit,
    p_fast_reasons: [...MOTIVOS_PASSAGEIROS], p_retry_fast: COMMENT_RULES.retryFastMinutes + ' minutes',
    p_since: p.since, p_site_id: p.siteId,
  }).abortSignal(sinal))
  if (r.error !== null && r.error !== undefined) return null
  if (!Array.isArray(r.data)) return null
  const linhas: Devido[] = []
  for (const item of r.data) {
    const d = devidoDe(item)
    if (d === null) return null
    linhas.push(d)
  }
  const primeira = linhas[0]
  if (primeira === undefined) return { linhas, total: 0 }
  const total = primeira.totalDue
  if (linhas.some((l) => l.totalDue !== total) || total < linhas.length) return null
  return { linhas, total }
}

// ───── o que já está guardado e o cadastro do site ─────

const PAGINA = 1000

/**
 * Os comentários guardados do vídeo (uma página de 1.000). O filtro é o uuid NOSSO do vídeo, nunca um id de comentário.
 * Vir a página cheia é defeito (um vídeo guarda dezenas): lança. Erro do banco ou linha ilegível: nulo.
 */
export async function lerGuardados(sb: SupabaseClient, videoRowId: string): Promise<Array<{ youtubeId: string; topo: boolean }> | null> {
  const r = await comTempo((sinal) => sb.from('competitor_video_comments').select('youtube_comment_id, parent_id')
    .eq('video_id', videoRowId).limit(PAGINA).abortSignal(sinal))
  if ((r.error !== null && r.error !== undefined) || !Array.isArray(r.data)) return null
  if (r.data.length >= PAGINA) throw new ComentariosErro('resposta_ilegivel')
  const saida: Array<{ youtubeId: string; topo: boolean }> = []
  for (const linha of r.data) {
    if (!ehObj(linha) || typeof linha.youtube_comment_id !== 'string' || linha.youtube_comment_id === '') return null
    if (linha.parent_id !== null && typeof linha.parent_id !== 'number') return null
    saida.push({ youtubeId: linha.youtube_comment_id, topo: linha.parent_id === null })
  }
  return saida
}

export async function lerCadastro(
  sb: SupabaseClient,
  siteId: string,
): Promise<{ acompanhados: Map<string, string>; proprios: Set<string> } | null> {
  const [acomp, proprios] = await Promise.all([
    comTempo((sinal) => sb.from('competitor_channels').select('id, channel_id').eq('site_id', siteId).limit(PAGINA).abortSignal(sinal)),
    comTempo((sinal) => sb.from('youtube_channels').select('channel_id').eq('site_id', siteId).limit(PAGINA).abortSignal(sinal)),
  ])
  for (const r of [acomp, proprios]) {
    if ((r.error !== null && r.error !== undefined) || !Array.isArray(r.data) || r.data.length >= PAGINA) return null
  }
  const acompanhados = new Map<string, string>()
  for (const linha of acomp.data as unknown[]) {
    if (!ehObj(linha) || typeof linha.id !== 'string' || typeof linha.channel_id !== 'string') return null
    acompanhados.set(linha.channel_id, linha.id)
  }
  const meus = new Set<string>()
  for (const linha of proprios.data as unknown[]) {
    if (!ehObj(linha) || typeof linha.channel_id !== 'string') return null
    meus.add(linha.channel_id)
  }
  return { acompanhados, proprios: meus }
}

// ───── o pacote ─────

export interface EntradaPacote {
  devido: Devido
  tiradoEm: string
  estado: EstadoRetrato
  motivo?: Motivo
  lote?: { conversas: Conversa[]; descartadas: number; completo: boolean }
  escolhidos?: Escolhido[]
  guardados?: Array<{ youtubeId: string; topo: boolean }>
  porId?: Map<string, { texto: string; cortado: boolean; editadoEm: string | null; curtidas: number | null; respostasTotal: number | null }>
  ausentes?: string[]
  consulta: { n: number | null; desconhecidos: number }
  agregados?: AgregadosDoLote
  conferenciaFalhou?: boolean
  unidades: number
}

/** O autor vai SÓ aqui. O criador nunca tem identidade; sem nenhum dos três campos, nada é enviado. */
function autorDe(c: Conversa): Json {
  if (c.doCriador) return null
  const { nome, canalId, foto } = c.autor
  if (nome === null && canalId === null && foto === null) return null
  return { display_name: nome, channel_id: canalId, avatar_url: foto }
}

function respostaDoCriador(r: RespostaVista, paiId: string): Json {
  return {
    youtube_comment_id: r.id, parent_youtube_id: paiId, via: 'lote', body: r.texto, body_truncated: r.cortado,
    published_at: r.publicadoEm, edited_at: r.editadoEm, is_creator: true, likes: r.curtidas,
  }
}

export function montarPacote(p: EntradaPacote): Pacote {
  const r = COMMENT_RULES
  const marco = r.marks.find((m) => m.mark === p.devido.mark)
  let erroMotivo: string | null = null
  if (p.estado === 'erro') {
    if (p.motivo === undefined || !(MOTIVOS as readonly string[]).includes(p.motivo)) throw new PacoteInvalido('retrato em erro sem motivo do catalogo')
    erroMotivo = p.motivo
  }
  const escolhidos = p.escolhidos ?? []
  if (p.estado === 'ok' && escolhidos.length > r.target) throw new PacoteInvalido('mais escolhidos do que o alvo')

  const ok = p.estado === 'ok'
  const comLote = (p.estado === 'ok' || p.estado === 'sem_comentarios') && p.lote !== undefined
  const snap: { [chave: string]: Json } = {
    taken_at: p.tiradoEm,
    ...(marco ? { from_h: marco.fromH, until_h: marco.untilH } : {}),
    status: p.estado,
    error_reason: erroMotivo,
    pool_size: comLote ? p.lote?.conversas.length ?? null : null,
    pool_complete: comLote ? p.lote?.completo ?? null : null,
    video_comment_count: p.estado === 'sem_comentarios' ? 0 : p.devido.videoCommentCount,
    selected_count: ok ? escolhidos.length : null,
    featured_lookup_n: p.consulta.n,
    featured_unknown_n: p.consulta.desconhecidos,
    rule_version: r.version,
    rule_params: ruleParams(),
    units_used: p.unidades,
    identity_days: r.identityDays,
    creator_replies_max: r.creatorRepliesMax,
  }
  if (ok && p.agregados !== undefined) snap.pool_stats = { ...p.agregados, conferencia_falhou: p.conferenciaFalhou === true }
  if (!ok) return { snap, comments: [], missing: [] }

  const comments: Json[] = []
  const vistos = new Set<string>()
  const criador = p.devido.channelYoutubeId

  /** Respostas do criador de uma conversa, sem id repetido e só as de quem é mesmo o canal do vídeo. */
  const respostasDe = (c: Conversa): void => {
    for (const resp of c.respostasDoCriador) {
      if (resp.autorCanalId !== criador || vistos.has(resp.id)) continue
      vistos.add(resp.id)
      comments.push(respostaDoCriador(resp, c.id))
    }
  }

  // 1. os escolhidos (com a identidade do autor), cada um seguido das respostas do criador vistas nele
  for (const e of escolhidos) {
    const c = e.conversa
    if (vistos.has(c.id)) continue
    vistos.add(c.id)
    comments.push({
      youtube_comment_id: c.id, parent_youtube_id: null, via: 'lote', body: c.texto, body_truncated: c.cortado,
      published_at: c.publicadoEm, edited_at: c.editadoEm, is_creator: c.doCriador, creator_replied: c.criadorRespondeu,
      featured_reason: e.destaque?.motivo ?? null, featured_channel_id: e.destaque?.canalRowId ?? null,
      featured_size_band: e.destaque?.faixaTamanho ?? null, featured_ratio_band: e.destaque?.faixaRazao ?? null,
      author: autorDe(c), likes: c.curtidas, reply_count: c.respostasTotal, relevance_rank: c.posicao + 1, slot: e.grupo,
    })
    respostasDe(c)
  }

  // 2. os já guardados que vieram no lote sem ser escolhidos: slot nulo, a posição e as respostas do criador vistas agora.
  //    Sem identidade: o comentário já existe, e a identidade só é gravada na primeira vez.
  const guardados = new Set((p.guardados ?? []).filter((g) => g.topo).map((g) => g.youtubeId))
  for (const c of p.lote?.conversas ?? []) {
    if (!guardados.has(c.id) || vistos.has(c.id)) continue
    vistos.add(c.id)
    comments.push({
      youtube_comment_id: c.id, parent_youtube_id: null, via: 'lote', body: c.texto, body_truncated: c.cortado,
      published_at: c.publicadoEm, edited_at: c.editadoEm, is_creator: c.doCriador, creator_replied: c.criadorRespondeu,
      featured_reason: null, featured_channel_id: null, featured_size_band: null, featured_ratio_band: null,
      likes: c.curtidas, reply_count: c.respostasTotal, relevance_rank: c.posicao + 1, slot: null,
    })
    respostasDe(c)
  }

  // 3. os achados por id (marcos 7 e 30): o que veio no lote já saiu acima. Curtida não medida não vira zero: o item não é enviado.
  for (const [id, v] of p.porId ?? []) {
    if (vistos.has(id)) continue
    vistos.add(id)
    if (v.curtidas === null) continue
    comments.push({
      youtube_comment_id: id, parent_youtube_id: null, via: 'id', body: v.texto, body_truncated: v.cortado,
      edited_at: v.editadoEm, likes: v.curtidas, reply_count: null,
    })
  }

  const missing = [...new Set(p.ausentes ?? [])].filter((id) => !vistos.has(id))
  return { snap, comments, missing }
}

// ───── a escrita do retrato ─────

export type StatusGravacao = 'gravado' | 'ja_existe' | 'video_ausente' | 'fora_da_tolerancia'
export interface ResultadoGravacao {
  status: StatusGravacao
  retrato?: string
  anterior?: string
  idade_h?: number | null
  recebidos?: number
  comentarios_novos?: number
  comentarios_atualizados?: number
  achados_por_id?: number
  respostas_novas?: number
  respostas_atualizadas?: number
  identidades?: number
  leituras?: number
  ausentes?: number
  ausentes_marcados?: number
  nao_gravados?: number
}
const STATUS_GRAVACAO: readonly string[] = ['gravado', 'ja_existe', 'video_ausente', 'fora_da_tolerancia']
const CONTAGENS_GRAVACAO = [
  'recebidos', 'comentarios_novos', 'comentarios_atualizados', 'achados_por_id', 'respostas_novas', 'respostas_atualizadas',
  'identidades', 'leituras', 'ausentes', 'ausentes_marcados', 'nao_gravados',
] as const

function resultadoDe(x: unknown): ResultadoGravacao | null {
  if (!ehObj(x) || typeof x.status !== 'string' || !STATUS_GRAVACAO.includes(x.status)) return null
  const saida: ResultadoGravacao = { status: x.status as StatusGravacao }
  if (typeof x.retrato === 'string') saida.retrato = x.retrato
  if (typeof x.anterior === 'string') saida.anterior = x.anterior
  if (x.idade_h === null || (typeof x.idade_h === 'number' && Number.isFinite(x.idade_h))) saida.idade_h = x.idade_h
  for (const k of CONTAGENS_GRAVACAO) {
    const v = x[k]
    if (ehContagem(v)) saida[k] = v
  }
  return saida
}

/** A janela do pacote tem de ser a de COMMENT_RULES para o marco: o banco confere a tolerância que o chamador manda. */
function toleranciaCoerente(marco: number, snap: Json): boolean {
  const regra = COMMENT_RULES.marks.find((m) => m.mark === marco)
  if (regra === undefined || !ehObj(snap)) return false
  return snap.from_h === regra.fromH && snap.until_h === regra.untilH
}

export async function gravarRetrato(
  sb: SupabaseClient,
  videoRowId: string,
  marco: Marco,
  pacote: Pacote,
): Promise<{ ok: true; resultado: ResultadoGravacao } | { ok: false; codigo: string }> {
  if (!toleranciaCoerente(marco, pacote.snap)) return { ok: false, codigo: 'tolerancia_incoerente' }
  const r = await comTempo((sinal) => sb.rpc('apply_competitor_comment_snap', {
    p_video: videoRowId, p_mark: marco, p_snap: pacote.snap, p_comments: pacote.comments, p_missing: pacote.missing,
  }).abortSignal(sinal))
  // Só o código sai daqui: message, details e hint do banco podem citar a linha recusada (texto e nome de terceiros).
  if (r.error !== null && r.error !== undefined) return { ok: false, codigo: codigoDe(r.error) }
  const resultado = resultadoDe(r.data)
  return resultado === null ? { ok: false, codigo: 'banco:resposta_ilegivel' } : { ok: true, resultado }
}

// ───── a anulação e o impacto da remoção ─────

export interface ResultadoAnulacao { apagadas: number; comentarios_carimbados: number; vencidas_ha_mais_de_1_dia: number; restantes: number }

/**
 * Apaga a identidade vencida. Em produção é chamada SEM site (apaga de todos); o parâmetro existe para o teste de integração.
 * Erro do banco lança um objeto saneado (só o código; `ehSchemaAusente` e `codigoDe` leem); contagem ilegível lança
 * `ComentariosErro('resposta_ilegivel')`, nunca vira 0.
 */
export async function anular(sb: SupabaseClient, siteId?: string): Promise<ResultadoAnulacao> {
  const r = await comTempo((sinal) => sb.rpc('competitor_comment_identity_purge', { p_site_id: siteId ?? null }).abortSignal(sinal))
  if (r.error !== null && r.error !== undefined) throw erroSaneado(r.error)
  const d = r.data
  if (!ehObj(d) || !ehContagem(d.apagadas) || !ehContagem(d.comentarios_carimbados)
    || !ehContagem(d.vencidas_ha_mais_de_1_dia) || !ehContagem(d.restantes)) throw new ComentariosErro('resposta_ilegivel')
  return { apagadas: d.apagadas, comentarios_carimbados: d.comentarios_carimbados, vencidas_ha_mais_de_1_dia: d.vencidas_ha_mais_de_1_dia, restantes: d.restantes }
}

export interface ImpactoComentarios {
  comment_snaps: number; comments: number; comment_marks: number; comment_authors: number; featured_elsewhere: number
}

/** O que a remoção de um canal leva das tabelas de comentário. `not_found` = nulo. Mesma regra de erro de `anular`. */
export async function lerImpacto(sb: SupabaseClient, siteId: string, channelRowId: string): Promise<ImpactoComentarios | null> {
  const r = await comTempo((sinal) => sb.rpc('competitor_channel_comment_impact', { p_site_id: siteId, p_channel_id: channelRowId }).abortSignal(sinal))
  if (r.error !== null && r.error !== undefined) throw erroSaneado(r.error)
  const d = r.data
  if (!ehObj(d)) throw new ComentariosErro('resposta_ilegivel')
  if (d.status === 'not_found') return null
  if (d.status !== 'ok' || !ehContagem(d.comment_snaps) || !ehContagem(d.comments) || !ehContagem(d.comment_marks)
    || !ehContagem(d.comment_authors) || !ehContagem(d.featured_elsewhere)) throw new ComentariosErro('resposta_ilegivel')
  return {
    comment_snaps: d.comment_snaps, comments: d.comments, comment_marks: d.comment_marks,
    comment_authors: d.comment_authors, featured_elsewhere: d.featured_elsewhere,
  }
}
