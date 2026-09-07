// v21.0 expira 2027-01-21; v25.0 expira 2028-07-29 (data no runbook).
export const GRAPH_API_BASE = 'https://graph.instagram.com/v25.0'
// Endpoints de token (access_token / refresh_access_token): o prefixo FICA,
// porque é a única forma com prova em produção. Só troque para
// 'https://graph.instagram.com' se as DUAS linhas do Step 3 da Tarefa 1
// tiverem respondido 200 — um 404 seria classificado `permanent` e marcaria
// toda a frota no primeiro run das 11:00.
export const TOKEN_API_BASE = GRAPH_API_BASE

const MEDIA_FIELDS =
  'id,media_type,media_url,thumbnail_url,caption,permalink,like_count,comments_count,timestamp'
const FETCH_TIMEOUT_MS = 10_000

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
    public readonly httpStatus: number,
  ) {
    super(message)
    this.name = 'InstagramApiError'
  }
}

export interface InstagramMediaItem {
  id: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url: string | null
  thumbnail_url?: string | null
  caption: string | null
  permalink: string
  like_count: number
  comments_count: number
  timestamp: string
}

/** Constrói o erro tipado a partir de uma resposta não-ok. Nunca lança. */
export async function instagramErrorFromResponse(res: Response): Promise<InstagramApiError> {
  let errMsg = `Instagram API ${res.status}`
  let errCode: number = res.status
  let errType = 'HttpError'
  try {
    const body = (await res.json()) as {
      error?: { message?: string; code?: number; type?: string }
    }
    if (body?.error) {
      errMsg = body.error.message ?? errMsg
      errCode = body.error.code ?? errCode
      errType = body.error.type ?? errType
    }
  } catch {
    // corpo não-JSON: ficamos com o status
  }
  return new InstagramApiError(errMsg, errCode, errType, res.status)
}

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw await instagramErrorFromResponse(res)
  return res.json() as Promise<T>
}

const MAX_PAGES = 5

/** `paging.next` vem da Meta por cast puro — só https em graph.instagram.com. */
function isGraphInstagramUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate)
    return u.protocol === 'https:' && u.hostname === 'graph.instagram.com'
  } catch {
    return false
  }
}

export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 50,
): Promise<InstagramMediaItem[]> {
  const all: InstagramMediaItem[] = []
  let url: string | null =
    `${GRAPH_API_BASE}/${igUserId}/media?fields=${MEDIA_FIELDS}&access_token=${accessToken}&limit=${Math.min(limit, 50)}`
  let pages = 0

  while (url && all.length < limit && pages < MAX_PAGES) {
    const data: { data: InstagramMediaItem[]; paging?: { next?: string } } =
      await handleApiResponse<{ data: InstagramMediaItem[]; paging?: { next?: string } }>(
        await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
      )

    all.push(...data.data)
    const next = data.paging?.next
    url = typeof next === 'string' && isGraphInstagramUrl(next) ? next : null
    pages++
  }

  return all.slice(0, limit)
}

/**
 * UMA chamada, três campos documentados no *get-started* do Instagram Login.
 * MUST — os dois ids não se misturam:
 *   `id`      = app-scoped, o espaço que GET /{id}/media aceita  => ig_user_id
 *   `user_id` = id da conta profissional (o mesmo do webhook)    => ig_professional_id
 * MUST NOT pedir OUTRO campo sem `curl` verde no gate de §7: um campo
 * inexistente volta como `(#100) Tried accessing nonexisting field` dentro de
 * um OAuthException em HTTP 400.
 */
export async function fetchInstagramProfile(
  accessToken: string,
): Promise<{ id: string | null; userId: string | null; username: string | null }> {
  const url = `${GRAPH_API_BASE}/me?fields=id,user_id,username&access_token=${accessToken}`
  const json = await handleApiResponse<unknown>(
    await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }),
  )
  const envelope = json as { data?: unknown }
  const raw = Array.isArray(envelope?.data) ? envelope.data[0] : json
  const d = (raw ?? {}) as { id?: unknown; user_id?: unknown; username?: unknown }

  const asId = (v: unknown): string | null =>
    typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null

  return {
    id: asId(d.id),
    userId: asId(d.user_id),
    username: typeof d.username === 'string' ? d.username : null,
  }
}

export async function refreshAccessToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = `${TOKEN_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  const data = await handleApiResponse<{
    access_token: string
    token_type: string
    expires_in: number
  }>(await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }))

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
