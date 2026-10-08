// `videos.list` da YouTube Data API com o token do canal DONO (spec, seção 3 — lote L1b).
// Nunca a YOUTUBE_API_KEY: a chave pública não vê `status.privacyStatus` de vídeo não público.
// 50 ids por chamada, 1 unidade de cota cada. O fetch vem de fora: quem chama passa o do prazo do passo.
import { parseDuration } from '@/lib/youtube/api-client'
import { motivoDoGoogle } from './google-erro'

const BASE = 'https://www.googleapis.com/youtube/v3/videos'
export const LOTE_VIDEOS = 50

/** Resposta não-ok da Data API. Leva só o status e o `reason`; nunca o corpo. */
export class DataApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(`YouTube Data API HTTP ${status}`)
    this.name = 'DataApiError'
  }
}

/** O estado do vídeo no instante da chamada. Campo que não veio é nulo. */
export interface VideoCapturado {
  id: string
  title: string | null
  description: string | null
  tags: string[]
  durationSeconds: number | null
  /** Como o YouTube devolveu; quem grava decide o que fazer com um valor desconhecido. */
  privacyStatus: string | null
}

interface Item {
  id?: string
  snippet?: { title?: string; description?: string; tags?: string[] }
  contentDetails?: { duration?: string }
  status?: { privacyStatus?: string }
}

const DURACAO_ISO = /^PT(?:\d+H)?(?:\d+M)?(?:\d+S)?$/

/** Duração que não se lê (`P0D` de live agendada, dias, `PT` vazio, zero) é nula, nunca 0. */
function duracaoEmSegundos(iso: string | undefined): number | null {
  if (!iso || !DURACAO_ISO.test(iso)) return null
  const { seconds } = parseDuration(iso)
  return seconds > 0 ? seconds : null
}

/** Id ausente da resposta (privado para o token, ou apagado) não entra no mapa. */
export async function videosList(token: string, ids: readonly string[], f: typeof fetch): Promise<Map<string, VideoCapturado>> {
  const out = new Map<string, VideoCapturado>()
  for (let i = 0; i < ids.length; i += LOTE_VIDEOS) {
    const url = new URL(BASE)
    url.searchParams.set('part', 'snippet,contentDetails,status')
    url.searchParams.set('id', ids.slice(i, i + LOTE_VIDEOS).join(','))
    const res = await f(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new DataApiError(res.status, await motivoDoGoogle(res))
    let corpo: { items?: Item[] }
    try {
      corpo = (await res.json()) as { items?: Item[] }
    } catch {
      throw new DataApiError(res.status, 'corpo_invalido')
    }
    for (const it of corpo.items ?? []) {
      if (!it.id) continue
      out.set(it.id, {
        id: it.id,
        title: it.snippet?.title ?? null,
        description: it.snippet?.description ?? null,
        tags: it.snippet?.tags ?? [],
        durationSeconds: duracaoEmSegundos(it.contentDetails?.duration),
        privacyStatus: it.status?.privacyStatus ?? null,
      })
    }
  }
  return out
}
