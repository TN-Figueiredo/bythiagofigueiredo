// Observatório A5 (E1): o que se guarda de cada resposta do YouTube além das contagens.
// Puro até a seção "gravação": nada aqui lê relógio nem rede.
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { assertField, type FieldPrecision, type FieldScope } from '@/lib/youtube/observatorio/field-catalog'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = Record<string, unknown>
export const obj = (x: unknown): Obj | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : undefined)
export const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)
/** `str` para texto que vai ao banco: sem NUL nem substituto solitário (ver sanitizeForDb). */
const strDb = (x: unknown): string | null => { const s = str(x); return s === null ? null : cleanText(s) }

/** A counter the API may omit (hidden likes/subscribers): null when absent or not numeric, never 0. */
export function optCount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * JSON com as chaves em ordem alfabética em todos os níveis; a ordem das listas é a que veio (reordenar tags É mudança).
 * `undefined` se comporta como no JSON.stringify: chave de objeto com `undefined` é pulada; em lista (ou solto) vira null.
 */
export function canonicalJson(v: Json | undefined): string {
  if (v === undefined) return 'null'
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}'
}
export const sha256Hex = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')
/** O hash de um valor de campo: 16 caracteres, como hashValue de competitor-versions.ts. */
export const fieldHash = (v: Json): string => sha256Hex(canonicalJson(v)).slice(0, 16)

/** Acima disto a resposta de um item não é guardada (e a execução acusa): a maior descrição real tem 5 kB. */
export const RAW_MAX_BYTES = 100_000
/** `sanitized`: o texto trazia o que o Postgres rejeita (NUL ou substituto solitário) e foi limpo antes do hash. */
export interface RawCapture { sha: string; raw: Json; bytes: number; sanitized?: boolean }

/**
 * O que o `text` e o `jsonb` do Postgres rejeitam: o caractere NUL (U+0000) e, no `jsonb`, metade de par UTF-16 sem a outra.
 * Um vídeo assim derrubaria a gravação do lote inteiro. NUL sai; o substituto solitário vira U+FFFD; par válido (emoji) fica.
 */
const DB_BAD_CHARS = /\u0000|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g
export const cleanText = (s: string): string => s.replace(DB_BAD_CHARS, c => (c === '\u0000' ? '' : '\ufffd'))
/** Percorre texto, lista e objeto (valores e chaves). `changed` diz se algo foi tirado ou trocado. */
export function sanitizeForDb<T>(value: T): { value: T; changed: boolean } {
  let changed = false
  const walk = (x: unknown): unknown => {
    if (typeof x === 'string') {
      const c = cleanText(x)
      if (c !== x) changed = true
      return c
    }
    if (Array.isArray(x)) return x.map(walk)
    if (typeof x === 'object' && x !== null) {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(x)) out[cleanText(k)] = walk((x as Record<string, unknown>)[k])
      if (Object.keys(out).length !== Object.keys(x).length || Object.keys(x).some(k => cleanText(k) !== k)) changed = true
      return out
    }
    return x
  }
  const v = walk(value) as T
  return { value: v, changed }
}

/** A resposta como veio, sem o que muda a cada leitura: statistics, etag e concurrentViewers. */
export function rawOf(item: unknown): RawCapture {
  const src = obj(item) ?? {}
  const out: Obj = {}
  for (const k of Object.keys(src)) {
    if (k === 'statistics' || k === 'etag') continue
    if (k === 'liveStreamingDetails') {
      const live = { ...(obj(src[k]) ?? {}) }
      delete live.concurrentViewers
      out[k] = live
      continue
    }
    out[k] = src[k]
  }
  // o hash é do que vai ser gravado: limpa antes de calcular
  const clean = sanitizeForDb(out)
  const text = canonicalJson(clean.value as Json)
  return { sha: sha256Hex(text), raw: JSON.parse(text) as Json, bytes: Buffer.byteLength(text), sanitized: clean.changed }
}

export interface ObservedField { field: string; value: Json }
/** As colunas de competitor_videos que TODA leitura do vídeo grava. Sem last_seen_at: ele é carimbado depois da captura. */
export interface VideoRowPatch {
  last_checked_at: string
  miss_streak: 0; miss_first_at: null; missing_since: null
  removal_decision: null; removal_decided_at: null; removal_decided_by: null
  was_live: boolean; live_scheduled_start_at: string | null; live_actual_start_at: string | null; live_actual_end_at: string | null
  default_language?: string | null; default_audio_language?: string | null; live_broadcast_content?: string | null
  view_count?: number | null; like_count?: number | null; comment_count?: number | null
  views_hidden?: boolean; likes_hidden?: boolean; comments_disabled?: boolean
  // (emenda do portão: S-M2) o estado atual que o histórico compara também vai para a linha, e SÓ quando a parte veio:
  // snippet → tags, category_id, thumbnail_url; contentDetails → duration_seconds. Parte ausente não apaga a coluna.
  tags?: string[]; category_id?: string | null; thumbnail_url?: string | null; duration_seconds?: number | null
}
export interface VideoObserved { fields: ObservedField[]; patch: VideoRowPatch; hasViews: boolean; partsMissing: string[] }

export function videoObservedOf(item: unknown, nowIso: string, durationOf: (iso: string | undefined) => number | null): VideoObserved {
  const it = obj(item) ?? {}
  const sn = obj(it.snippet), st = obj(it.statistics), cd = obj(it.contentDetails), live = obj(it.liveStreamingDetails)
  const partsMissing = [...(sn ? [] : ['snippet']), ...(st ? [] : ['statistics']), ...(cd ? [] : ['contentDetails'])]
  const fields: ObservedField[] = [{ field: 'availability', value: 'no_ar' }]
  const patch: VideoRowPatch = {
    last_checked_at: nowIso, miss_streak: 0, miss_first_at: null, missing_since: null,
    removal_decision: null, removal_decided_at: null, removal_decided_by: null,
    // liveStreamingDetails só vem para ao vivo e estreia: ausente = não foi nenhum dos dois (a parte é sempre pedida)
    was_live: live !== undefined,
    live_scheduled_start_at: str(live?.scheduledStartTime), live_actual_start_at: str(live?.actualStartTime), live_actual_end_at: str(live?.actualEndTime),
  }
  if (sn) {
    const tags: Json = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string').map(cleanText) : null
    const lang = strDb(sn.defaultLanguage), audio = strDb(sn.defaultAudioLanguage), lbc = strDb(sn.liveBroadcastContent)
    fields.push({ field: 'tags', value: tags }, { field: 'category_id', value: strDb(sn.categoryId) }, { field: 'default_language', value: lang },
      { field: 'default_audio_language', value: audio }, { field: 'live_broadcast_content', value: lbc })
    patch.default_language = lang; patch.default_audio_language = audio; patch.live_broadcast_content = lbc
    // (emenda do portão: S-M2) as mesmas regras que o laço da página usava: sem tags = lista vazia; miniatura = maxres, senão high
    const th = obj(sn.thumbnails)
    patch.tags = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string').map(cleanText) : []
    patch.category_id = strDb(sn.categoryId)
    patch.thumbnail_url = strDb(obj(th?.maxres)?.url) ?? strDb(obj(th?.high)?.url)
  }
  if (cd) {
    const dur = durationOf(typeof cd.duration === 'string' ? cd.duration : undefined)
    fields.push({ field: 'duration_seconds', value: dur })
    patch.duration_seconds = dur
  }
  let hasViews = false
  if (st) {
    const views = optCount(st.viewCount), likes = optCount(st.likeCount), comments = optCount(st.commentCount)
    hasViews = views !== null
    patch.view_count = views; patch.like_count = likes; patch.comment_count = comments
    patch.views_hidden = views === null; patch.likes_hidden = likes === null; patch.comments_disabled = comments === null
    fields.push({ field: 'comments_disabled', value: comments === null }, { field: 'likes_hidden', value: likes === null }, { field: 'views_hidden', value: views === null })
  }
  return { fields, patch, hasViews, partsMissing }
}

export interface ChannelRowPatch {
  custom_url: string | null; description: string | null; published_at: string | null; country: string | null; subscribers_hidden: boolean
  miss_streak: 0; miss_first_at: null; missing_since: null; removal_decision: null; removal_decided_at: null; removal_decided_by: null
}

export function channelObservedOf(item: unknown): { fields: ObservedField[]; patch: ChannelRowPatch } {
  const it = obj(item) ?? {}, sn = obj(it.snippet) ?? {}, st = obj(it.statistics) ?? {}
  const avatar = strDb(obj(obj(sn.thumbnails)?.default)?.url)
  const description = typeof sn.description === 'string' ? cleanText(sn.description) : null
  const hidden = st.hiddenSubscriberCount === true || optCount(st.subscriberCount) === null
  const customUrl = strDb(sn.customUrl), country = strDb(sn.country)
  return {
    fields: [
      { field: 'name', value: strDb(sn.title) }, { field: 'custom_url', value: customUrl }, { field: 'description', value: description },
      { field: 'country', value: country }, { field: 'avatar_url', value: avatar }, { field: 'subscribers_hidden', value: hidden },
      { field: 'availability', value: 'no_ar' },
    ],
    patch: {
      custom_url: customUrl, description, published_at: str(sn.publishedAt), country, subscribers_hidden: hidden,
      miss_streak: 0, miss_first_at: null, missing_since: null, removal_decision: null, removal_decided_at: null, removal_decided_by: null,
    },
  }
}

/* ------------------------------------------------------------------ plano de versões */
export interface CaptureItem {
  /** uuid de competitor_videos; null = o canal. */
  videoId: string | null
  fields: ObservedField[]
  raw: RawCapture | null
  /** Última leitura boa ANTES desta (competitor_videos.last_seen_at ou competitor_channels.last_seen_at, lido antes de regravar). */
  prevSeenAt: string | null
  /** series_tier_since quando o vídeo está em faixa semanal; null nos outros casos (inclusive canal). */
  weeklySince: string | null
  /** Só para "sumiu": o instante da 1ª leitura sem o vídeo. Ausente = nowIso. */
  firstSeenAt?: string
}
export interface StoredField { id: number; video_id: string | null; field: string; value_hash: string }
export interface StoredRaw { id: number; video_id: string | null; raw_sha256: string }
export interface PlanClose { id: number; last_seen_at: string | null }
export interface FieldOpen { video_id: string | null; field: string; value: Json; value_hash: string; first_seen_at: string; window_start: string | null; precision: FieldPrecision }
export interface RawOpen { video_id: string | null; raw_sha256: string; first_seen_at: string; raw: Json }
/** sanitized: itens cujo texto trazia NUL ou substituto solitário e foi limpo (M-4). */
export interface CaptureStats { fieldsOpened: number; fieldsClosed: number; rawOpened: number; rawClosed: number; rawTooBig: number; sanitized: number }
export interface MissedRow { id: string; miss_streak: number; miss_first_at: string | null; missing_since: string | null; last_seen_at: string | null }

const HOUR = 3_600_000
/** A precisão de uma mudança, pela distância entre a última leitura boa e a leitura que viu o valor novo (spec 4.1, v2.3). */
export function precisionOf(windowStart: string | null, firstSeen: string, weeklySince: string | null): FieldPrecision {
  if (!windowStart) return 'gap'
  const d = Date.parse(firstSeen) - Date.parse(windowStart)
  if (d <= 8 * HOUR) return '6h'
  if (d <= 36 * HOUR) return '1d'
  // semana só quando o vídeo esteve em faixa semanal a janela inteira; qualquer outra distância é coleta parada
  if (d <= 8 * 24 * HOUR && weeklySince != null && weeklySince <= spDateOf(Date.parse(windowStart))) return '7d'
  return 'gap'
}

const keyOf = (videoId: string | null, field: string) => (videoId ?? '') + '|' + field
export function planFields(scope: FieldScope, current: readonly StoredField[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: FieldOpen[] } {
  for (const it of items) for (const f of it.fields) assertField(scope, f.field) // antes de planejar qualquer coisa
  const cur = new Map(current.map(c => [keyOf(c.video_id, c.field), c]))
  const close: PlanClose[] = [], open: FieldOpen[] = []
  for (const it of items) {
    const first = it.firstSeenAt ?? nowIso
    for (const f of it.fields) {
      const hash = fieldHash(f.value), prev = cur.get(keyOf(it.videoId, f.field))
      if (prev && prev.value_hash === hash) continue // nada mudou: a versão corrente não é tocada (item 223)
      if (!prev) { open.push({ video_id: it.videoId, field: f.field, value: f.value, value_hash: hash, first_seen_at: first, window_start: null, precision: 'first' }); continue }
      close.push({ id: prev.id, last_seen_at: it.prevSeenAt })
      open.push({ video_id: it.videoId, field: f.field, value: f.value, value_hash: hash, first_seen_at: first, window_start: it.prevSeenAt, precision: precisionOf(it.prevSeenAt, first, it.weeklySince) })
    }
  }
  return { close, open }
}

export function planRaw(current: readonly StoredRaw[], items: readonly CaptureItem[], nowIso: string): { close: PlanClose[]; open: RawOpen[]; tooBig: number } {
  const cur = new Map(current.map(c => [c.video_id ?? '', c]))
  const close: PlanClose[] = [], open: RawOpen[] = []
  let tooBig = 0
  for (const it of items) {
    if (!it.raw) continue
    if (it.raw.bytes > RAW_MAX_BYTES) { tooBig++; continue }
    const prev = cur.get(it.videoId ?? '')
    if (prev && prev.raw_sha256 === it.raw.sha) continue
    if (prev) close.push({ id: prev.id, last_seen_at: it.prevSeenAt })
    open.push({ video_id: it.videoId, raw_sha256: it.raw.sha, first_seen_at: nowIso, raw: it.raw.raw })
  }
  return { close, open, tooBig }
}

/* ------------------------------------------------------------------ gravação */
export const CAPTURE_CHUNK = 50
/** PostgREST corta em 1.000 linhas sem avisar (supabase/config.toml, max_rows): chegar lá é erro, nunca "é só isso". */
const MAX_ROWS = 1000
/** Corpo máximo de uma gravação de raw. */
const RPC_MAX_BYTES = 1_000_000
const fail = (what: string, error: { message?: string } | null | undefined): void => {
  if (error) throw new Error('captura: ' + what + ': ' + (error.message ?? 'erro do banco'))
}

// (emenda do portão: S-I3) Sem cast duplo para o tipo da linha: a forma de cada linha lida é CONFERIDA, não afirmada.
/**
 * As linhas de uma resposta do banco, cada uma conferida pela guarda. Lança na primeira linha fora da forma.
 * Resposta NULA também lança: toda leitura e função daqui responde lista (vazia quando não há linha); nulo é falha, nunca "nenhuma linha".
 */
export function rowsAs<T>(data: unknown, guard: (x: unknown) => x is T, what: string): T[] {
  if (data == null) throw new Error(what + ': a resposta do banco é nula (esperava uma lista)')
  if (!Array.isArray(data)) throw new Error(what + ': a resposta do banco não é uma lista')
  const out: T[] = []
  for (const x of data) {
    if (!guard(x)) throw new Error(what + ': linha fora da forma esperada')
    out.push(x)
  }
  return out
}
export const isRec = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const idOk = (x: Record<string, unknown>): boolean => typeof x.id === 'number' && (x.video_id === null || typeof x.video_id === 'string')
const isStoredField = (x: unknown): x is StoredField => isRec(x) && idOk(x) && typeof x.field === 'string' && typeof x.value_hash === 'string'
const isStoredRaw = (x: unknown): x is StoredRaw => isRec(x) && idOk(x) && typeof x.raw_sha256 === 'string'

async function readCurrent<T>(sb: SupabaseClient, table: 'competitor_field_versions' | 'competitor_raw', cols: string, channelId: string, scope: FieldScope, ids: string[], guard: (x: unknown) => x is T): Promise<T[]> {
  const q = sb.from(table).select(cols).eq('competitor_channel_id', channelId).eq('is_current', true)
  const { data, error } = await (scope === 'canal' ? q.is('video_id', null) : q.in('video_id', ids))
  fail(table, error)
  const rows = rowsAs(data, guard, 'captura: ' + table)
  if (rows.length >= MAX_ROWS) throw new Error('captura: ' + table + ' devolveu ' + MAX_ROWS + ' linhas ou mais numa leitura (1000 é o teto do PostgREST): lote grande demais')
  return rows
}

export async function captureItems(sb: SupabaseClient, p: { siteId: string; channelId: string; scope: FieldScope; items: readonly CaptureItem[]; nowIso: string }): Promise<CaptureStats> {
  const stats: CaptureStats = { fieldsOpened: 0, fieldsClosed: 0, rawOpened: 0, rawClosed: 0, rawTooBig: 0, sanitized: 0 }
  if (!p.items.length) return stats
  if (p.items.length > CAPTURE_CHUNK) throw new Error('captura: no máximo ' + CAPTURE_CHUNK + ' itens por chamada (vieram ' + p.items.length + ')')
  stats.sanitized = p.items.filter(i => i.raw?.sanitized).length // texto com NUL ou substituto solitário que o rawOf limpou: visível, não silencioso
  const ids = p.items.map(i => i.videoId).filter((x): x is string => x != null)
  const curFields = await readCurrent(sb, 'competitor_field_versions', 'id, video_id, field, value_hash', p.channelId, p.scope, ids, isStoredField)
  const curRaw = await readCurrent(sb, 'competitor_raw', 'id, video_id, raw_sha256', p.channelId, p.scope, ids, isStoredRaw)
  const fp = planFields(p.scope, curFields, p.items, p.nowIso)
  if (fp.close.length || fp.open.length) {
    const { error } = await sb.rpc('apply_competitor_field_plan', { p_site_id: p.siteId, p_channel_id: p.channelId, p_close: fp.close, p_open: fp.open })
    fail('apply_competitor_field_plan', error)
    stats.fieldsOpened = fp.open.length; stats.fieldsClosed = fp.close.length
  }
  const rp = planRaw(curRaw, p.items, p.nowIso)
  stats.rawTooBig = rp.tooBig
  // lotes de até 1 MB: o fecho de um vídeo vai no mesmo lote da abertura dele (a função fecha antes de abrir)
  const prevId = new Map(curRaw.map(c => [c.video_id ?? '', c.id]))
  const bytesOf = new Map(p.items.filter(i => i.raw).map(i => [i.videoId ?? '', i.raw!.bytes]))
  let batch: RawOpen[] = [], size = 0
  const flush = async () => {
    if (!batch.length) return
    const closeIds = new Set(batch.map(o => prevId.get(o.video_id ?? '')).filter((x): x is number => x != null))
    const { error } = await sb.rpc('apply_competitor_raw_plan', { p_site_id: p.siteId, p_channel_id: p.channelId, p_close: rp.close.filter(c => closeIds.has(c.id)), p_open: batch })
    fail('apply_competitor_raw_plan', error)
    stats.rawOpened += batch.length; stats.rawClosed += closeIds.size
    batch = []; size = 0
  }
  for (const o of rp.open) {
    const b = bytesOf.get(o.video_id ?? '') ?? 0
    if (batch.length && size + b > RPC_MAX_BYTES) await flush()
    batch.push(o); size += b
  }
  await flush()
  return stats
}

const strOrNull = (x: unknown): boolean => x === null || typeof x === 'string'
// os três campos de data são conferidos: um nome trocado (undefined) faria `missing_since != null` falhar em silêncio e a versão 'sumiu' nunca abriria
const isMissedRow = (x: unknown): x is MissedRow => isRec(x) && typeof x.id === 'string' && typeof x.miss_streak === 'number' && strOrNull(x.miss_first_at) && strOrNull(x.missing_since) && strOrNull(x.last_seen_at)

export async function markMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; videoIds: readonly string[]; nowIso: string; weeklySinceOf: (id: string) => string | null }): Promise<{ missed: number; newlyMissing: number }> {
  if (!p.videoIds.length) return { missed: 0, newlyMissing: 0 }
  const { data, error } = await sb.rpc('competitor_mark_missing', { p_channel_id: p.channelId, p_video_ids: [...p.videoIds], p_now: p.nowIso })
  if (error) throw new Error('ausência: ' + (error.message ?? 'erro do banco'))
  const rows = rowsAs(data, isMissedRow, 'ausência')
  // estado desejado, não evento: todo vídeo com missing_since tem de ter a versão 'sumiu' (se a gravação falhou antes, conserta agora)
  const gone = rows.filter(r => r.missing_since != null)
  for (let i = 0; i < gone.length; i += CAPTURE_CHUNK) {
    await captureItems(sb, { siteId: p.siteId, channelId: p.channelId, scope: 'video', nowIso: p.nowIso, items: gone.slice(i, i + CAPTURE_CHUNK).map(r => ({
      videoId: r.id, fields: [{ field: 'availability', value: 'sumiu' }], raw: null, prevSeenAt: r.last_seen_at, weeklySince: p.weeklySinceOf(r.id), firstSeenAt: r.miss_first_at ?? p.nowIso,
    })) })
  }
  return { missed: rows.length, newlyMissing: rows.filter(r => r.miss_streak === 2).length }
}

export async function markChannelMissing(sb: SupabaseClient, p: { siteId: string; channelId: string; nowIso: string }): Promise<{ missingSince: string | null }> {
  const { data, error } = await sb.rpc('competitor_channel_mark_missing', { p_channel_id: p.channelId, p_now: p.nowIso })
  if (error) throw new Error('ausência do canal: ' + (error.message ?? 'erro do banco'))
  // a função documenta nulo (canal que não existe mais); qualquer outra coisa fora da forma é falha, não "sem ausência"
  if (data !== null && !isMissedRow(data)) throw new Error('ausência do canal: resposta do banco fora da forma esperada')
  const r = data
  if (r?.missing_since) {
    await captureItems(sb, { siteId: p.siteId, channelId: p.channelId, scope: 'canal', nowIso: p.nowIso, items: [{
      videoId: null, fields: [{ field: 'availability', value: 'sumiu' }], raw: null, prevSeenAt: r.last_seen_at, weeklySince: null, firstSeenAt: r.miss_first_at ?? p.nowIso,
    }] })
  }
  return { missingSince: r?.missing_since ?? null }
}
