// A5 X1 + X5: o estado do vídeo próprio como série com histórico de troca (`yt_own_video_state_raw`) e o contador público do dia
// (`yt_own_video_public_daily`). A resposta da `videos.list` já era paga e o que não virava coluna era jogado fora.
// Política: fora do bruto o que nunca é público (uploadStatus, failureReason, rejectionReason) e o que o E18 já versiona
// (título, descrição, tags e miniaturas). Parte que não veio NÃO grava estado: um hash sem a parte pareceria troca e depois outra.
import { rawOf, type RawCapture } from '@/lib/youtube/competitor-capture'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { conferirBanco, pushUnico } from './schema'
import type { StepCtx } from './types'

/** Partes sem as quais o estado não é gravado. `statistics` fica de fora: ela alimenta o contador, não o estado. */
const PARTES_DO_ESTADO = ['snippet', 'contentDetails', 'status'] as const

// `channelTitle` é troca do CANAL (o X2 guarda), não do vídeo: renomear o canal não pode gerar uma linha em todos os vídeos.
const SNIPPET_FORA = ['title', 'description', 'tags', 'thumbnails', 'localized', 'channelTitle']
// Só o dono vê publishAt, selfDeclaredMadeForKids e hasCustomThumbnail (documentação da Data API): fora, pela regra "só o que é público".
const STATUS_FORA = ['uploadStatus', 'failureReason', 'rejectionReason', 'publishAt', 'selfDeclaredMadeForKids']
const CONTENT_DETAILS_FORA = ['hasCustomThumbnail']

export interface EstadoCapturado { sha: string; raw: RawCapture['raw'] }
export interface ContadoresPublicos { views: number | null; likes: number | null; comments: number | null }

const obj = (x: unknown): Record<string, unknown> | null =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null

function sem(o: Record<string, unknown>, fora: readonly string[]): Record<string, unknown> {
  const r = { ...o }
  for (const k of fora) delete r[k]
  return r
}

/** `{ estado: null, ausentes }` quando uma das três partes não veio. */
export function estadoDoVideo(item: unknown): { estado: EstadoCapturado | null; ausentes: string[] } {
  const it = obj(item) ?? {}
  const ausentes = PARTES_DO_ESTADO.filter(p => obj(it[p]) === null)
  if (ausentes.length > 0) return { estado: null, ausentes }
  const podado = { ...it, snippet: sem(obj(it.snippet)!, SNIPPET_FORA), contentDetails: sem(obj(it.contentDetails)!, CONTENT_DETAILS_FORA), status: sem(obj(it.status)!, STATUS_FORA) }
  const r = rawOf(podado)
  return { estado: { sha: r.sha, raw: r.raw }, ausentes: [] }
}

/**
 * X2: o estado do canal (`channels.list`, chave pública): branding, status, tópicos e localizações. Sem `statistics` (muda a cada
 * leitura; o retrato diário já a guarda). `brandingSettings`, `topicDetails` e `localizations` ausentes são normais (canal sem
 * personalização); `snippet` ou `status` ausentes é parte que não veio: nulo, não grava.
 */
export function estadoDoCanal(item: unknown): { estado: EstadoCapturado | null; ausentes: string[] } {
  const it = obj(item)
  if (!it) return { estado: null, ausentes: ['item'] }
  const ausentes = (['snippet', 'status'] as const).filter(p => obj(it[p]) === null)
  if (ausentes.length > 0) return { estado: null, ausentes }
  const r = rawOf(it)
  return { estado: { sha: r.sha, raw: r.raw }, ausentes: [] }
}

const contagem = (v: unknown): number | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

/** `null` quando a parte `statistics` não veio. Contador que a API não mandou (curtida oculta) é nulo, nunca 0. */
export function contadoresDoVideo(item: unknown): ContadoresPublicos | null {
  const st = obj(obj(item)?.statistics)
  if (!st) return null
  return { views: contagem(st.viewCount), likes: contagem(st.likeCount), comments: contagem(st.commentCount) }
}

export interface VideoDoEstado { youtube_video_id: string; channel_id: string; site_id: string; published_at: string }
export interface CapturaDoEstado {
  privacyStatus: string | null
  estado: EstadoCapturado | null
  estadoAusentes: string[]
  contadores: ContadoresPublicos | null
}

export interface ResumoEstado {
  estado_gravado: number
  estado_sem_parte: number
  publicos_gravados: number
  publicos_sem_contador: number
}

const IDADE_MINIMA_MS = 14 * 86_400_000
const LOTE = 200

/** Nunca lança. Falha vira nota em `falhas`; o que não veio é contado, não zerado. */
export async function gravarEstadoProprio(
  ctx: Pick<StepCtx, 'supabase' | 'falhas'>,
  videos: readonly VideoDoEstado[],
  captura: ReadonlyMap<string, CapturaDoEstado>,
  agoraMs: number,
): Promise<ResumoEstado> {
  const r: ResumoEstado = { estado_gravado: 0, estado_sem_parte: 0, publicos_gravados: 0, publicos_sem_contador: 0 }
  try {
    const estados: Array<Record<string, unknown>> = []
    const publicos: Array<Record<string, unknown>> = []
    const dia = spDateOf(agoraMs)
    const capturedAt = new Date(agoraMs).toISOString()
    for (const v of videos) {
      const c = captura.get(v.youtube_video_id)
      if (!c) continue
      if (c.estado) {
        estados.push({ youtube_video_id: v.youtube_video_id, site_id: v.site_id, channel_id: v.channel_id, state_sha256: c.estado.sha, raw: c.estado.raw })
      } else {
        r.estado_sem_parte++
      }
      // Só vídeo com mais de 14 dias (os mais novos a leitura horária cobre) e que tem contador público (privado não tem).
      if (agoraMs - Date.parse(v.published_at) < IDADE_MINIMA_MS) continue
      if (c.privacyStatus === 'private') continue
      const k = c.contadores
      if (!k || (k.views === null && k.likes === null && k.comments === null)) { r.publicos_sem_contador++; continue }
      publicos.push({
        youtube_video_id: v.youtube_video_id, day_pt: dia, site_id: v.site_id, channel_id: v.channel_id,
        view_count: k.views, like_count: k.likes, comment_count: k.comments, captured_at: capturedAt,
      })
    }
    if (r.estado_sem_parte > 0) {
      pushUnico(ctx.falhas, `estado do vídeo próprio: ${r.estado_sem_parte} vídeo(s) sem uma das partes snippet/contentDetails/status; estado não gravado`)
    }
    if (r.publicos_sem_contador > 0) {
      pushUnico(ctx.falhas, `contador público do vídeo próprio: ${r.publicos_sem_contador} vídeo(s) sem statistics; dia não gravado`)
    }
    for (let i = 0; i < estados.length; i += LOTE) {
      const res = await ctx.supabase.rpc('yt_own_video_state_record', { p_rows: estados.slice(i, i + LOTE) })
      if (conferirBanco(res, 'yt_own_video_state_raw', ctx.falhas) !== 'ok') continue
      r.estado_gravado += typeof res.data === 'number' ? res.data : 0
    }
    for (let i = 0; i < publicos.length; i += LOTE) {
      const lote = publicos.slice(i, i + LOTE)
      // `.select` devolve só as linhas realmente inseridas: na 2ª execução do dia (ignoreDuplicates) o resumo não diz que gravou o que já existia.
      const res = await ctx.supabase.from('yt_own_video_public_daily').upsert(lote, { onConflict: 'youtube_video_id,day_pt', ignoreDuplicates: true }).select('youtube_video_id')
      if (conferirBanco(res, 'yt_own_video_public_daily', ctx.falhas) !== 'ok') continue
      r.publicos_gravados += Array.isArray(res.data) ? res.data.length : 0
    }
  } catch {
    pushUnico(ctx.falhas, 'erro ao gravar o estado do vídeo próprio')
  }
  return r
}
