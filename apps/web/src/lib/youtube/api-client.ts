const BASE = 'https://www.googleapis.com/youtube/v3'
const TIMEOUT_MS = 15_000
const MAX_RETRIES = 3
const RETRY_DELAYS = [1_000, 2_000, 4_000]
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])
const MAX_PAGES = 200

export class YouTubeQuotaError extends Error {
  constructor() { super('quotaExceeded') }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function ytFetch(url: string): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(url, { signal: controller.signal })
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error('YouTube API request timed out')
      }
      throw err
    }
    clearTimeout(timer)

    if (res.status === 403) {
      const body = await res.json().catch(() => ({}))
      const reason = (body as { error?: { errors?: { reason?: string }[] } })
        ?.error?.errors?.[0]?.reason
      if (reason === 'quotaExceeded') throw new YouTubeQuotaError()
      throw new Error(`YouTube API 403: ${reason ?? 'forbidden'}`)
    }

    if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAYS[attempt] ?? 4_000)
      continue
    }

    if (!res.ok) throw new Error(`YouTube API ${res.status}`)
    return res.json()
  }
  throw new Error('YouTube API: max retries exceeded')
}

export function parseDuration(iso: string): { text: string; seconds: number } {
  if (!iso) return { text: '0:00', seconds: 0 }
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return { text: '0:00', seconds: 0 }
  const h = parseInt(match[1] || '0', 10)
  const m = parseInt(match[2] || '0', 10)
  const s = parseInt(match[3] || '0', 10)
  const seconds = h * 3600 + m * 60 + s
  const text = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
  return { text, seconds }
}

export async function fetchRecentVideoIds(
  playlistId: string,
  apiKey: string,
): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  let pages = 0
  do {
    const params = new URLSearchParams({
      part: 'contentDetails',
      playlistId,
      maxResults: '50',
      key: apiKey,
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = (await ytFetch(`${BASE}/playlistItems?${params}`)) as {
      items?: { contentDetails: { videoId: string } }[]
      nextPageToken?: string
    }
    for (const item of data.items ?? []) {
      ids.push(item.contentDetails.videoId)
    }
    pageToken = data.nextPageToken
    pages++
  } while (pageToken && pages < MAX_PAGES)
  return ids
}

export interface ParsedVideo {
  youtubeVideoId: string
  title: string
  description: string
  publishedAt: string
  tags: string[]
  thumbnailUrl: string | null
  thumbnailHqUrl: string | null
  duration: string
  durationSeconds: number
  viewCount: number
  likeCount: number
  commentCount: number
}

export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<ParsedVideo[]> {
  if (videoIds.length === 0) return []
  const results: ParsedVideo[] = []
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: batch.join(','),
      key: apiKey,
    })
    const data = (await ytFetch(`${BASE}/videos?${params}`)) as { items?: Array<{
      id: string
      snippet: {
        title: string; description: string; publishedAt: string; tags?: string[]
        thumbnails: { medium?: { url: string }; high?: { url: string } }
      }
      contentDetails: { duration: string }
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string }
    }> }

    for (const item of data.items ?? []) {
      const { text, seconds } = parseDuration(item.contentDetails.duration)
      results.push({
        youtubeVideoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        tags: item.snippet.tags ?? [],
        thumbnailUrl: item.snippet.thumbnails.medium?.url ?? null,
        thumbnailHqUrl: item.snippet.thumbnails.high?.url ?? null,
        duration: text,
        durationSeconds: seconds,
        viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
        likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
        commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
      })
    }
  }
  return results
}

export async function fetchChannelStats(
  channelId: string,
  apiKey: string,
): Promise<{ subscriberCount: number; videoCount: number }> {
  const params = new URLSearchParams({
    part: 'statistics',
    id: channelId,
    key: apiKey,
  })
  const data = (await ytFetch(`${BASE}/channels?${params}`)) as { items?: Array<{
    statistics: { subscriberCount?: string; videoCount?: string }
  }> }
  const stats = data.items?.[0]?.statistics
  return {
    subscriberCount: parseInt(stats?.subscriberCount ?? '0', 10),
    videoCount: parseInt(stats?.videoCount ?? '0', 10),
  }
}

export interface ChannelLookupResult {
  channelId: string
  handle: string
  name: string
  description: string | null
  uploadsPlaylistId: string
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  bannerUrl: string | null
  customUrl: string | null
}

export function parseHandleInput(raw: string): string {
  const input = raw.trim()
  let pathname: string
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`)
    pathname = url.pathname.replace(/\/+$/, '')
  } catch {
    pathname = ''
  }
  if (pathname) {
    const channelMatch = pathname.match(/^\/channel\/(UC[a-zA-Z0-9_-]+)/)
    if (channelMatch?.[1]) return channelMatch[1]
    const handleMatch = pathname.match(/^\/@([a-zA-Z0-9_.-]+)/)
    if (handleMatch?.[1]) return `@${handleMatch[1]}`
    const customMatch = pathname.match(/^\/c\/([a-zA-Z0-9_.-]+)/)
    if (customMatch?.[1]) return `@${customMatch[1]}`
  }
  if (input.startsWith('@')) return input
  if (input.startsWith('UC') && /^UC[a-zA-Z0-9_-]+$/.test(input)) return input
  return `@${input}`
}

export async function lookupChannelByHandle(
  handleOrUrl: string,
  apiKey: string,
): Promise<ChannelLookupResult | null> {
  const parsed = parseHandleInput(handleOrUrl)
  const isChannelId = parsed.startsWith('UC')

  const params = new URLSearchParams({
    part: 'snippet,statistics,contentDetails',
    key: apiKey,
  })
  if (isChannelId) params.set('id', parsed)
  else params.set('forHandle', parsed)
  const data = (await ytFetch(`${BASE}/channels?${params}`)) as {
    items?: Array<{
      id: string
      snippet: {
        title: string
        description: string
        customUrl?: string
        thumbnails: { medium?: { url: string } }
      }
      statistics: { subscriberCount?: string; videoCount?: string }
      contentDetails: { relatedPlaylists: { uploads: string } }
      brandingSettings?: { image?: { bannerExternalUrl?: string } }
    }>
  }

  const item = data.items?.[0]
  if (!item) return null

  return {
    channelId: item.id,
    handle: item.snippet.customUrl ?? parsed,
    name: item.snippet.title,
    description: item.snippet.description || null,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
    subscriberCount: parseInt(item.statistics.subscriberCount ?? '0', 10),
    videoCount: parseInt(item.statistics.videoCount ?? '0', 10),
    thumbnailUrl: item.snippet.thumbnails.medium?.url ?? null,
    bannerUrl: item.brandingSettings?.image?.bannerExternalUrl ?? null,
    customUrl: item.snippet.customUrl ?? null,
  }
}
