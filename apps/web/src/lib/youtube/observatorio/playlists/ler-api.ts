// A5, X3: leitura PURA das respostas de playlists.list, playlistItems.list e channelSections.list.
// Nada aqui lê relógio, rede ou banco. Dado ausente vira null (nunca 0), forma errada vira `{ porque: 'forma' }`.
import { canonicalJson, cleanText, obj, sanitizeForDb, sha256Hex, str, type Json } from '@/lib/youtube/competitor-capture'

/** Envios (UU), curtidos (LL) e favoritos (FL): nunca gravados (A-26). */
export const PLAYLIST_FILTRADA_RE = /^(UU|LL|FL)/
export const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

export interface PlaylistLida {
  playlist_id: string
  title: string | null
  published_at: string | null
  item_count: number | null
  privacy: string | null
  state_sha256: string
  /** O item inteiro da API, sem `etag` (capa e `itemCount` de cada versão ficam de graça). */
  raw: Json
}
export interface PaginaDePlaylists { itens: PlaylistLida[]; proxima: string | null; total: number | null; excluidas: number }

export interface ItemLido {
  item_id: string
  youtube_video_id: string
  position: number | null
  added_at: string | null
  video_published_at: string | null
  video_owner_channel_id: string | null
  privacy: string | null
  note: string | null
}
/** `lidos`: itens que vieram na página (antes do descarte de `videoId` inválido); é o número que se compara com `totalResults`. */
export interface PaginaDeItens { itens: ItemLido[]; proxima: string | null; total: number | null; lidos: number; descartados: number }

export interface SecoesLidas { itens: Json[]; sha: string; raw: Json }
export type Forma = { porque: 'forma' }
export type ErroDaApi = 'cota' | 'playlist_sumiu' | 'api'

/** Verdadeiro para o retorno `{ porque: 'forma' }` de qualquer leitura. */
export const ehForma = (x: unknown): x is Forma => typeof x === 'object' && x !== null && 'porque' in x

/** Data que vai para timestamptz: o texto se o JS o entende como data, senão nulo. */
const data = (x: unknown): string | null => {
  const s = str(x)
  return s !== null && !Number.isNaN(Date.parse(s)) ? cleanText(s) : null
}
const texto = (x: unknown): string | null => { const s = str(x); return s === null ? null : cleanText(s) }
const contagem = (x: unknown): number | null => {
  const n = typeof x === 'string' && x.trim() !== '' ? Number(x) : x
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : null
}
const proximaDe = (j: Record<string, unknown>): string | null => str(j.nextPageToken)
const totalDe = (j: Record<string, unknown>): number | null => contagem(obj(j.pageInfo)?.totalResults)

const semEtag = (item: Record<string, unknown>): Record<string, unknown> => {
  const { etag: _etag, ...resto } = item
  void _etag
  return resto
}

/**
 * O hash do estado da playlist: `snippet` sem `thumbnails` e sem `publishedAt`, mais `status` e `localizations`; sem `etag` e sem
 * `contentDetails.itemCount` (muda a cada vídeo novo). A troca de capa sozinha não gera versão (P-4).
 */
export function hashDaPlaylist(item: unknown): string {
  const it = obj(item) ?? {}
  const snippet = { ...(obj(it.snippet) ?? {}) }
  delete snippet.thumbnails
  delete snippet.publishedAt
  const recorte = sanitizeForDb({ snippet, status: obj(it.status) ?? null, localizations: obj(it.localizations) ?? null } as unknown as Json).value
  return sha256Hex(canonicalJson(recorte))
}

export function lerPaginaDePlaylists(json: unknown): PaginaDePlaylists | Forma {
  const j = obj(json)
  if (!j || !Array.isArray(j.items)) return { porque: 'forma' }
  const itens: PlaylistLida[] = []
  let excluidas = 0
  for (const bruto of j.items) {
    const it = obj(bruto)
    const id = str(it?.id)
    if (!it || id === null) continue
    if (PLAYLIST_FILTRADA_RE.test(id)) { excluidas++; continue }
    const snippet = obj(it.snippet)
    itens.push({
      playlist_id: cleanText(id),
      title: texto(snippet?.title),
      published_at: data(snippet?.publishedAt),
      item_count: contagem(obj(it.contentDetails)?.itemCount),
      privacy: texto(obj(it.status)?.privacyStatus),
      state_sha256: hashDaPlaylist(it),
      raw: sanitizeForDb(semEtag(it) as unknown as Json).value,
    })
  }
  return { itens, proxima: proximaDe(j), total: totalDe(j), excluidas }
}

export function lerPaginaDeItens(json: unknown): PaginaDeItens | Forma {
  const j = obj(json)
  if (!j || !Array.isArray(j.items)) return { porque: 'forma' }
  const itens: ItemLido[] = []
  let descartados = 0
  for (const bruto of j.items) {
    const it = obj(bruto)
    const snippet = obj(it?.snippet)
    const detalhes = obj(it?.contentDetails)
    const id = str(it?.id)
    const video = str(detalhes?.videoId) ?? str(obj(snippet?.resourceId)?.videoId)
    if (!it || id === null || video === null || !VIDEO_ID_RE.test(video)) { descartados++; continue }
    const pos = contagem(snippet?.position)
    itens.push({
      item_id: cleanText(id),
      youtube_video_id: video,
      position: pos,
      added_at: data(snippet?.publishedAt),
      video_published_at: data(detalhes?.videoPublishedAt),
      video_owner_channel_id: texto(snippet?.videoOwnerChannelId),
      privacy: texto(obj(it.status)?.privacyStatus),
      note: texto(detalhes?.note),
    })
  }
  return { itens, proxima: proximaDe(j), total: totalDe(j), lidos: j.items.length, descartados }
}

/** Seções ordenadas por `snippet.position` (sem posição vão para o fim, na ordem de chegada), cada uma sem `etag`. Lista vazia é lista, não forma. */
export function lerSecoes(json: unknown): SecoesLidas | Forma {
  const j = obj(json)
  if (!j || !Array.isArray(j.items)) return { porque: 'forma' }
  const com = j.items.map((x, i) => ({ x, i, p: contagem(obj(obj(x)?.snippet)?.position) }))
  com.sort((a, b) => (a.p ?? Number.MAX_SAFE_INTEGER) - (b.p ?? Number.MAX_SAFE_INTEGER) || a.i - b.i)
  const itens = com
    .map(c => obj(c.x))
    .filter((x): x is Record<string, unknown> => x !== undefined)
    .map(x => sanitizeForDb(semEtag(x) as unknown as Json).value)
  return { itens, sha: sha256Hex(canonicalJson(itens)), raw: { items: itens } }
}

/** `403 quotaExceeded` -> cota; `404 playlistNotFound` -> playlist sumiu; qualquer outra coisa (5xx, rede, status 0) -> api. */
export function erroDaApi(status: number, json: unknown): ErroDaApi {
  const erros = obj(obj(json)?.error)?.errors
  const razao = Array.isArray(erros) ? str(obj(erros[0])?.reason) : null
  if (status === 403 && razao === 'quotaExceeded') return 'cota'
  if (status === 404 && razao === 'playlistNotFound') return 'playlist_sumiu'
  return 'api'
}
