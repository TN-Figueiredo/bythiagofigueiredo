// Observatório A5 (E1): o que se guarda de cada resposta do YouTube além das contagens.
// Puro até a seção "gravação": nada aqui lê relógio nem rede.
import crypto from 'crypto'

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json }
type Obj = Record<string, unknown>
export const obj = (x: unknown): Obj | undefined => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Obj) : undefined)
export const str = (x: unknown): string | null => (typeof x === 'string' && x !== '' ? x : null)

/** A counter the API may omit (hidden likes/subscribers): null when absent or not numeric, never 0. */
export function optCount(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(String(v), 10)
  return Number.isFinite(n) ? n : null
}

/** JSON com as chaves em ordem alfabética em todos os níveis; a ordem das listas é a que veio (reordenar tags É mudança). */
export function canonicalJson(v: Json): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k] as Json)).join(',') + '}'
}
export const sha256Hex = (s: string): string => crypto.createHash('sha256').update(s).digest('hex')
/** O hash de um valor de campo: 16 caracteres, como hashValue de competitor-versions.ts. */
export const fieldHash = (v: Json): string => sha256Hex(canonicalJson(v)).slice(0, 16)

/** Acima disto a resposta de um item não é guardada (e a execução acusa): a maior descrição real tem 5 kB. */
export const RAW_MAX_BYTES = 100_000
export interface RawCapture { sha: string; raw: Json; bytes: number }
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
  const text = canonicalJson(out as Json)
  return { sha: sha256Hex(text), raw: JSON.parse(text) as Json, bytes: Buffer.byteLength(text) }
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
    const tags: Json = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string') : null
    const lang = str(sn.defaultLanguage), audio = str(sn.defaultAudioLanguage), lbc = str(sn.liveBroadcastContent)
    fields.push({ field: 'tags', value: tags }, { field: 'category_id', value: str(sn.categoryId) }, { field: 'default_language', value: lang },
      { field: 'default_audio_language', value: audio }, { field: 'live_broadcast_content', value: lbc })
    patch.default_language = lang; patch.default_audio_language = audio; patch.live_broadcast_content = lbc
    // (emenda do portão: S-M2) as mesmas regras que o laço da página usava: sem tags = lista vazia; miniatura = maxres, senão high
    const th = obj(sn.thumbnails)
    patch.tags = Array.isArray(sn.tags) ? sn.tags.filter((t): t is string => typeof t === 'string') : []
    patch.category_id = str(sn.categoryId)
    patch.thumbnail_url = str(obj(th?.maxres)?.url) ?? str(obj(th?.high)?.url)
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
  const avatar = str(obj(obj(sn.thumbnails)?.default)?.url)
  const description = typeof sn.description === 'string' ? sn.description : null
  const hidden = st.hiddenSubscriberCount === true || optCount(st.subscriberCount) === null
  const customUrl = str(sn.customUrl), country = str(sn.country)
  return {
    fields: [
      { field: 'name', value: str(sn.title) }, { field: 'custom_url', value: customUrl }, { field: 'description', value: description },
      { field: 'country', value: country }, { field: 'avatar_url', value: avatar }, { field: 'subscribers_hidden', value: hidden },
      { field: 'availability', value: 'no_ar' },
    ],
    patch: {
      custom_url: customUrl, description, published_at: str(sn.publishedAt), country, subscribers_hidden: hidden,
      miss_streak: 0, miss_first_at: null, missing_since: null, removal_decision: null, removal_decided_at: null, removal_decided_by: null,
    },
  }
}
