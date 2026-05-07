const GRAPH_API_BASE = 'https://graph.instagram.com/v21.0'
const MEDIA_FIELDS = 'id,media_type,media_url,thumbnail_url,caption,permalink,like_count,comments_count,timestamp'

export class InstagramApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
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

async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `Instagram API ${res.status}`
    let errCode = res.status
    let errType = 'HttpError'
    try {
      const body = await res.json()
      if (body?.error) {
        errMsg = body.error.message ?? errMsg
        errCode = body.error.code ?? errCode
        errType = body.error.type ?? errType
      }
    } catch {
      // ignore parse failure
    }
    throw new InstagramApiError(errMsg, errCode, errType)
  }
  return res.json() as Promise<T>
}

const MAX_PAGES = 5

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
    const data: { data: InstagramMediaItem[]; paging?: { next?: string } } = await handleApiResponse<{
      data: InstagramMediaItem[]
      paging?: { next?: string }
    }>(await fetch(url))

    all.push(...data.data)
    url = data.paging?.next ?? null
    pages++
  }

  return all.slice(0, limit)
}

export async function fetchInstagramProfile(
  accessToken: string,
): Promise<{ id: string; username: string }> {
  const url = `${GRAPH_API_BASE}/me?fields=id,username&access_token=${accessToken}`
  return handleApiResponse<{ id: string; username: string }>(await fetch(url))
}

export async function refreshAccessToken(
  currentToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const url = `${GRAPH_API_BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${currentToken}`
  const data = await handleApiResponse<{
    access_token: string
    token_type: string
    expires_in: number
  }>(await fetch(url))

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}
