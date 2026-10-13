/**
 * A gravação da leitura horária (A5 E16, Tarefa 9): a lista de candidatos, o que a hora já tem, as cruas e a curva
 * nas quatro tabelas da MG9, e a classificação dos vídeos do dono que a resposta do YouTube negou.
 *
 * O texto de erro do banco NUNCA sai deste módulo: falha vira código fechado (`ErroDeLeitura`) ou booleano.
 * Dado ausente primeiro: resposta nula ou fora da forma é erro, nunca "lista vazia"; lista que pode passar de 1.000
 * linhas é paginada e, passando do teto de páginas, falha em vez de cortar em silêncio.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRec, rowsAs } from '@/lib/youtube/competitor-capture'
import { pacificDate } from '@/lib/youtube/competitor-quota'
import { earlyEligible } from '@/lib/youtube/competitor-tiers'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { Lido } from '@/lib/youtube/agenda/tipos'
import { RULES } from '@/lib/youtube/observatorio/rules'
import type { Contagem } from './leitura'
import type { Alvo, CandConcorrente, CandProprio } from './lista'

export type CodigoLeitura = 'lista_falhou' | 'lista_cortada' | 'ja_lidos_falhou'
/** A mensagem é o próprio código: nenhum texto do banco entra aqui. */
export class ErroDeLeitura extends Error {
  readonly codigo: CodigoLeitura
  constructor(codigo: CodigoLeitura) {
    super(codigo)
    this.name = 'ErroDeLeitura'
    this.codigo = codigo
  }
}

const HORA_MS = 3_600_000
const DIA_MS = 24 * HORA_MS
const PAGINA = 1000
const PAGINAS = 5
const BLOCO_GRAVACAO = 500
/** O `.in()` dos negados do dono cabe na URL até aqui (cerca de 3 KB) e rende no máximo 4 linhas por id (< 1.000 com 250). */
const NEGADOS_MAX = 250
const JANELA_CAPTURA_DIAS = 3

interface RespostaBanco { data: unknown; error: unknown }
const textoOuNulo = (x: unknown): x is string | null => x === null || typeof x === 'string'
const numeroOuNulo = (x: unknown): x is number | null => x === null || (typeof x === 'number' && Number.isFinite(x))

/**
 * Lê até 5 páginas de 1.000. Uma sexta página com qualquer linha quer dizer mais de 5.000 linhas: `cortada`.
 * Erro do banco, resposta nula, linha fora da forma ou exceção: `falha`. O texto do erro é descartado.
 */
async function paginar<T>(
  pagina: (de: number, ate: number) => PromiseLike<RespostaBanco>,
  guarda: (x: unknown) => x is T,
  falha: CodigoLeitura,
  cortada: CodigoLeitura,
  oQue: string,
): Promise<T[]> {
  const out: T[] = []
  for (let p = 0; p <= PAGINAS; p++) {
    let linhas: T[]
    try {
      const { data, error } = await pagina(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (error) throw new Error('banco')
      linhas = rowsAs(data, guarda, oQue)
    } catch {
      throw new ErroDeLeitura(falha)
    }
    if (p === PAGINAS) {
      if (linhas.length > 0) throw new ErroDeLeitura(cortada)
      break
    }
    out.push(...linhas)
    if (linhas.length < PAGINA) break
  }
  return out
}

// ─────────────────────────── a lista de candidatos ───────────────────────────
interface LinhaConcorrente {
  id: string
  video_id: string
  competitor_channel_id: string
  published_at: string | null
  discovered_at: string | null
  live_broadcast_content: string | null
  missing_since: string | null
  competitor_channels: { site_id: string; missing_since: string | null }
}
interface LinhaProprio {
  id: string
  youtube_video_id: string
  channel_id: string
  site_id: string
  published_at: string | null
  created_at: string
}
const eCanalEmbutido = (x: unknown): x is LinhaConcorrente['competitor_channels'] =>
  isRec(x) && typeof x.site_id === 'string' && textoOuNulo(x.missing_since)
const eLinhaConcorrente = (x: unknown): x is LinhaConcorrente =>
  isRec(x) && typeof x.id === 'string' && typeof x.video_id === 'string' && typeof x.competitor_channel_id === 'string'
  && textoOuNulo(x.published_at) && textoOuNulo(x.discovered_at) && textoOuNulo(x.live_broadcast_content)
  && textoOuNulo(x.missing_since) && eCanalEmbutido(x.competitor_channels)
const eLinhaProprio = (x: unknown): x is LinhaProprio =>
  isRec(x) && typeof x.id === 'string' && typeof x.youtube_video_id === 'string' && typeof x.channel_id === 'string'
  && typeof x.site_id === 'string' && textoOuNulo(x.published_at) && typeof x.created_at === 'string'

const COLUNAS_CONCORRENTE: string = 'id, video_id, competitor_channel_id, published_at, discovered_at, live_broadcast_content, missing_since, competitor_channels!inner(site_id, missing_since)'
const COLUNAS_PROPRIO: string = 'id, youtube_video_id, channel_id, site_id, published_at, created_at'

/**
 * Todo vídeo publicado na janela (concorrentes e dono), em ordem estável, até 5.000 por tabela.
 * A captura diária de privacidade do dono NÃO é lida aqui: quem decide se a leitura é gravada é a resposta do YouTube.
 */
export async function lerCandidatos(
  sb: SupabaseClient,
  agoraMs: number,
): Promise<{ conc: CandConcorrente[]; prop: CandProprio[] }> {
  const corte = new Date(agoraMs - RULES.hourly.ageDays * DIA_MS).toISOString()
  const [conc, prop] = await Promise.all([
    paginar(
      (de, ate) => sb.from('competitor_videos').select(COLUNAS_CONCORRENTE).gt('published_at', corte)
        .order('published_at', { ascending: false }).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaConcorrente, 'lista_falhou', 'lista_cortada', 'competitor_videos',
    ),
    paginar(
      (de, ate) => sb.from('youtube_videos').select(COLUNAS_PROPRIO).gt('published_at', corte)
        .order('published_at', { ascending: false }).order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaProprio, 'lista_falhou', 'lista_cortada', 'youtube_videos',
    ),
  ])
  return {
    conc: conc.map(v => ({
      id: v.id, ytId: v.video_id, canalId: v.competitor_channel_id, siteId: v.competitor_channels.site_id,
      publishedAt: v.published_at, discoveredAt: v.discovered_at, lbc: v.live_broadcast_content,
      missingSince: v.missing_since, canalAusente: v.competitor_channels.missing_since !== null,
    })),
    prop: prop.map(v => ({
      id: v.id, ytId: v.youtube_video_id, canalId: v.channel_id, siteId: v.site_id,
      publishedAt: v.published_at, createdAt: v.created_at,
    })),
  }
}

// ─────────────────────────── o que a hora já tem ───────────────────────────
/** Chave: tipo + ':' + (uuid do concorrente | ytId do próprio). */
export interface JaLidos {
  cruas: Map<string, { lidoEm: string; views: number; likes: number | null; comments: number | null }>
  comCurva: Set<string>
}
interface CruaConcorrente { video_id: string; taken_at: string; views: number; likes: number | null; comments: number | null }
interface CruaProprio { youtube_video_id: string; taken_at: string; views: number; likes: number | null; comments: number | null }
interface CurvaConcorrente { video_id: string; taken_at: string }
interface CurvaProprio { youtube_video_id: string; taken_at: string }
const eContagens = (x: Record<string, unknown>): boolean =>
  typeof x.taken_at === 'string' && typeof x.views === 'number' && numeroOuNulo(x.likes) && numeroOuNulo(x.comments)
const eCruaConcorrente = (x: unknown): x is CruaConcorrente => isRec(x) && typeof x.video_id === 'string' && eContagens(x)
const eCruaProprio = (x: unknown): x is CruaProprio => isRec(x) && typeof x.youtube_video_id === 'string' && eContagens(x)
const eCurvaConcorrente = (x: unknown): x is CurvaConcorrente => isRec(x) && typeof x.video_id === 'string' && typeof x.taken_at === 'string'
const eCurvaProprio = (x: unknown): x is CurvaProprio => isRec(x) && typeof x.youtube_video_id === 'string' && typeof x.taken_at === 'string'

/**
 * As leituras e os pontos de curva que a hora cheia `horaIso` já tem. Quatro consultas em paralelo, FILTRADAS PELA HORA
 * (nunca `.in()` com os ids dos alvos). Falha de leitura lança `ja_lidos_falhou`: nunca "ninguém lido" (gastaria a cota em dobro).
 */
export async function jaLidosNaHora(sb: SupabaseClient, horaIso: string): Promise<JaLidos> {
  const fim = new Date(Date.parse(horaIso) + HORA_MS).toISOString()
  const colunas = 'taken_at, views, likes, comments'
  const [cConc, cProp, eConc, eProp] = await Promise.all([
    paginar(
      (de, ate) => sb.from('competitor_video_hourly').select(`video_id, ${colunas}`).eq('hour_slot', horaIso)
        .order('video_id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eCruaConcorrente, 'ja_lidos_falhou', 'ja_lidos_falhou', 'competitor_video_hourly',
    ),
    paginar(
      (de, ate) => sb.from('yt_own_public_video_hourly').select(`youtube_video_id, ${colunas}`).eq('hour_slot', horaIso)
        .order('youtube_video_id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eCruaProprio, 'ja_lidos_falhou', 'ja_lidos_falhou', 'yt_own_public_video_hourly',
    ),
    paginar(
      (de, ate) => sb.from('competitor_video_early').select('video_id, taken_at').gte('taken_at', horaIso).lt('taken_at', fim)
        .order('video_id').order('taken_at').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eCurvaConcorrente, 'ja_lidos_falhou', 'ja_lidos_falhou', 'competitor_video_early',
    ),
    paginar(
      (de, ate) => sb.from('yt_own_public_video_early').select('youtube_video_id, taken_at').gte('taken_at', horaIso).lt('taken_at', fim)
        .order('youtube_video_id').order('taken_at').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eCurvaProprio, 'ja_lidos_falhou', 'ja_lidos_falhou', 'yt_own_public_video_early',
    ),
  ])
  const ja: JaLidos = { cruas: new Map(), comCurva: new Set() }
  for (const l of cConc) ja.cruas.set(`concorrente:${l.video_id}`, { lidoEm: l.taken_at, views: l.views, likes: l.likes, comments: l.comments })
  for (const l of cProp) ja.cruas.set(`proprio:${l.youtube_video_id}`, { lidoEm: l.taken_at, views: l.views, likes: l.likes, comments: l.comments })
  for (const l of eConc) ja.comCurva.add(`concorrente:${l.video_id}`)
  for (const l of eProp) ja.comCurva.add(`proprio:${l.youtube_video_id}`)
  return ja
}

// ─────────────────────────── a gravação ───────────────────────────
type Linha = Record<string, string | number | null>
interface OpcoesGravacao { agoraMs: number; podeGravar: () => boolean }

/** A chave de um alvo em `JaLidos`. */
const chaveDe = (a: Alvo): string => `${a.tipo}:${a.tipo === 'proprio' ? a.ytId : a.uuid}`
const horaCheiaIso = (ms: number): string => new Date(Math.floor(ms / HORA_MS) * HORA_MS).toISOString()
const eleitoraDaCurva = (a: Alvo, agoraMs: number): boolean =>
  earlyEligible({ discoveredAt: a.descobertoEm, publishedAt: a.publishedAt }, agoraMs)

function linhaCrua(a: Alvo, c: Contagem, horaIso: string): Linha {
  const base: Linha = { hour_slot: horaIso, taken_at: c.lidoEm, site_id: a.siteId, views: c.views, likes: c.likes, comments: c.comments }
  return a.tipo === 'proprio'
    ? { youtube_video_id: a.ytId, video_id: a.uuid, channel_id: a.canalId, ...base }
    : { video_id: a.uuid, ...base }
}
function linhaCurva(a: Alvo, d: { takenAt: string; views: number; likes: number | null; comments: number | null }): Linha {
  const base: Linha = { taken_at: d.takenAt, site_id: a.siteId, views: d.views, likes: d.likes, comments: d.comments }
  return a.tipo === 'proprio'
    ? { youtube_video_id: a.ytId, video_id: a.uuid, channel_id: a.canalId, ...base }
    : { video_id: a.uuid, ...base }
}

/**
 * `upsert … ignoreDuplicates` em blocos de 500. `podeGravar()` antes de CADA ida ao banco. O texto do erro não sai:
 * vira `falhou`. `gravadas` conta só os blocos que o banco aceitou.
 */
async function gravarEmBlocos(
  sb: SupabaseClient, tabela: string, linhas: readonly Linha[], onConflict: string, podeGravar: () => boolean,
): Promise<{ gravadas: number; fim: 'ok' | 'sem_tempo' | 'falhou' }> {
  let gravadas = 0
  for (let i = 0; i < linhas.length; i += BLOCO_GRAVACAO) {
    if (!podeGravar()) return { gravadas, fim: 'sem_tempo' }
    const bloco = linhas.slice(i, i + BLOCO_GRAVACAO)
    try {
      const { error } = await sb.from(tabela).upsert(bloco, { onConflict, ignoreDuplicates: true }).abortSignal(AbortSignal.timeout(BANCO_MS))
      if (error) return { gravadas, fim: 'falhou' }
    } catch {
      return { gravadas, fim: 'falhou' }
    }
    gravadas += bloco.length
  }
  return { gravadas, fim: 'ok' }
}

export async function gravarLeituras(
  sb: SupabaseClient,
  alvos: readonly Alvo[],
  contagens: readonly Contagem[],
  o: OpcoesGravacao,
): Promise<{ cruas: number; cruasProprio: number; curva: number; curvaProprio: number; naoPublico: number; semStatus: number; falhouCruas: boolean; falhouCurva: boolean; semTempo: boolean }> {
  const r = { cruas: 0, cruasProprio: 0, curva: 0, curvaProprio: 0, naoPublico: 0, semStatus: 0, falhouCruas: false, falhouCurva: false, semTempo: false }
  const porId = new Map<string, Contagem>()
  for (const c of contagens) porId.set(c.ytId, c)

  const cruasConc: Linha[] = [], cruasProp: Linha[] = [], curvaConc: Linha[] = [], curvaProp: Linha[] = []
  for (const a of alvos) {
    const c = porId.get(a.ytId)
    if (!c) continue
    const lido = Date.parse(c.lidoEm)
    if (!Number.isFinite(lido)) continue
    // do dono, só o que a resposta DESTA hora diz público; a privacidade do concorrente não é olhada
    if (a.tipo === 'proprio') {
      if (c.privacidade === null) { r.semStatus++; continue }
      if (c.privacidade !== 'public') { r.naoPublico++; continue }
    }
    const crua = linhaCrua(a, c, horaCheiaIso(lido))
    const curva = eleitoraDaCurva(a, o.agoraMs) ? linhaCurva(a, { takenAt: c.lidoEm, views: c.views, likes: c.likes, comments: c.comments }) : null
    if (a.tipo === 'proprio') { cruasProp.push(crua); if (curva) curvaProp.push(curva) }
    else { cruasConc.push(crua); if (curva) curvaConc.push(curva) }
  }

  // as cruas primeiro; erro nelas e a curva nem é tentada
  const c1 = await gravarEmBlocos(sb, 'competitor_video_hourly', cruasConc, 'video_id,hour_slot', o.podeGravar)
  r.cruas = c1.gravadas
  if (c1.fim === 'falhou') { r.falhouCruas = true; return r }
  if (c1.fim === 'sem_tempo') { r.semTempo = true; return r }
  const c2 = await gravarEmBlocos(sb, 'yt_own_public_video_hourly', cruasProp, 'youtube_video_id,hour_slot', o.podeGravar)
  r.cruasProprio = c2.gravadas
  if (c2.fim === 'falhou') { r.falhouCruas = true; return r }
  if (c2.fim === 'sem_tempo') { r.semTempo = true; return r }

  const e1 = await gravarEmBlocos(sb, 'competitor_video_early', curvaConc, 'video_id,taken_at', o.podeGravar)
  r.curva = e1.gravadas
  if (e1.fim === 'falhou') { r.falhouCurva = true; return r }
  if (e1.fim === 'sem_tempo') { r.semTempo = true; return r }
  const e2 = await gravarEmBlocos(sb, 'yt_own_public_video_early', curvaProp, 'youtube_video_id,taken_at', o.podeGravar)
  r.curvaProprio = e2.gravadas
  if (e2.fim === 'falhou') r.falhouCurva = true
  if (e2.fim === 'sem_tempo') r.semTempo = true
  return r
}

/**
 * Para todo alvo JÁ LIDO nesta hora, elegível à curva e sem ponto de curva nesta hora, grava o ponto a partir da leitura
 * crua (mesmos números, mesmo `taken_at`). Sem chamada à API. Falha ou falta de tempo: `falhou`.
 */
export async function completarCurva(
  sb: SupabaseClient,
  alvos: readonly Alvo[],
  ja: JaLidos,
  o: OpcoesGravacao,
): Promise<{ curva: number; curvaProprio: number; falhou: boolean }> {
  const conc: Linha[] = [], prop: Linha[] = []
  for (const a of alvos) {
    const chave = chaveDe(a)
    const crua = ja.cruas.get(chave)
    if (!crua || ja.comCurva.has(chave) || !eleitoraDaCurva(a, o.agoraMs)) continue
    const linha = linhaCurva(a, { takenAt: crua.lidoEm, views: crua.views, likes: crua.likes, comments: crua.comments })
    if (a.tipo === 'proprio') prop.push(linha)
    else conc.push(linha)
  }
  const r = { curva: 0, curvaProprio: 0, falhou: false }
  const e1 = await gravarEmBlocos(sb, 'competitor_video_early', conc, 'video_id,taken_at', o.podeGravar)
  r.curva = e1.gravadas
  if (e1.fim !== 'ok') { r.falhou = true; return r }
  const e2 = await gravarEmBlocos(sb, 'yt_own_public_video_early', prop, 'youtube_video_id,taken_at', o.podeGravar)
  r.curvaProprio = e2.gravadas
  if (e2.fim !== 'ok') r.falhou = true
  return r
}

// ─────────────────────────── os negados do dono ───────────────────────────
interface Captura { youtube_video_id: string; day_pt: string; privacy_status: string }
const eCaptura = (x: unknown): x is Captura =>
  isRec(x) && typeof x.youtube_video_id === 'string' && typeof x.day_pt === 'string' && typeof x.privacy_status === 'string'

/** 'AAAA-MM-DD' menos `n` dias (aritmética de calendário em UTC: sem fuso, sem horário de verão). */
function diaMenos(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a ?? 0, (m ?? 1) - 1, (d ?? 1) - n)).toISOString().slice(0, 10)
}

/**
 * Dos ids do dono que a resposta desta hora negou, quantos a captura diária ainda diz 'public': a MESMA regra da CTE
 * `proprios_lista` da prova (vale a linha de MAIOR `day_pt` com status não nulo dentro de 3 dias; conta se for 'public').
 * Esta leitura nunca decide se uma leitura é gravada; só classifica o que já foi negado. Nenhuma chamada à API.
 * Falha, resposta nula, fora da forma, prazo ou mais de 250 ids: `{ porque }` (sem desconto).
 */
export async function contarNegadosCobraveis(sb: SupabaseClient, ytIds: readonly string[], agoraMs: number): Promise<Lido<number>> {
  const ids = [...new Set(ytIds)]
  if (ids.length === 0) return { valor: 0 }
  if (ids.length > NEGADOS_MAX) return { porque: 'negados demais para classificar' }
  try {
    const desde = diaMenos(pacificDate(agoraMs), JANELA_CAPTURA_DIAS)
    const { data, error } = await sb.from('yt_own_video_meta_daily').select('youtube_video_id, day_pt, privacy_status')
      .in('youtube_video_id', ids).not('privacy_status', 'is', null).gte('day_pt', desde).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) return { porque: 'a captura diária não pôde ser lida' }
    const linhas = rowsAs(data, eCaptura, 'yt_own_video_meta_daily')
    // 1.000 linhas é o teto do banco: com menos de 4 por id isso não acontece; se acontecer, pode ter cortado
    if (linhas.length >= PAGINA) return { porque: 'a captura diária veio cortada' }
    const ultima = new Map<string, Captura>()
    for (const l of linhas) {
      const atual = ultima.get(l.youtube_video_id)
      if (!atual || l.day_pt > atual.day_pt) ultima.set(l.youtube_video_id, l)
    }
    let valor = 0
    for (const l of ultima.values()) if (l.privacy_status === 'public') valor++
    return { valor }
  } catch {
    return { porque: 'a captura diária não pôde ser lida' }
  }
}
