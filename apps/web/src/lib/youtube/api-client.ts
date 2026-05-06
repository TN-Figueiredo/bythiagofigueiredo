const BASE = 'https://www.googleapis.com/youtube/v3'

export class YouTubeQuotaError extends Error {
  constructor() { super('quotaExceeded') }
}

async function ytFetch(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const reason = body?.error?.errors?.[0]?.reason
    if (reason === 'quotaExceeded') throw new YouTubeQuotaError()
    throw new Error(`YouTube API 403: ${reason ?? 'forbidden'}`)
  }
  if (!res.ok) throw new Error(`YouTube API ${res.status}`)
  return res.json()
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
  do {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : ''
    const url = `${BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${tokenParam}&key=${apiKey}`
    const data = (await ytFetch(url)) as {
      items?: { contentDetails: { videoId: string } }[]
      nextPageToken?: string
    }
    for (const item of data.items ?? []) {
      ids.push(item.contentDetails.videoId)
    }
    pageToken = data.nextPageToken
  } while (pageToken)
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
    const ids = batch.join(',')
    const url = `${BASE}/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${apiKey}`
    const data = (await ytFetch(url)) as { items?: Array<{
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
  const url = `${BASE}/channels?part=statistics&id=${channelId}&key=${apiKey}`
  const data = (await ytFetch(url)) as { items?: Array<{
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
  const channelMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/)
  if (channelMatch?.[1]) return channelMatch[1]
  const handleMatch = input.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/)
  if (handleMatch?.[1]) return `@${handleMatch[1]}`
  const customMatch = input.match(/youtube\.com\/c\/([a-zA-Z0-9_.-]+)/)
  if (customMatch?.[1]) return `@${customMatch[1]}`
  if (input.startsWith('@')) return input
  return `@${input}`
}

export async function lookupChannelByHandle(
  handleOrUrl: string,
  apiKey: string,
): Promise<ChannelLookupResult | null> {
  const parsed = parseHandleInput(handleOrUrl)
  const isChannelId = parsed.startsWith('UC')

  const param = isChannelId ? `id=${parsed}` : `forHandle=${parsed}`
  const url = `${BASE}/channels?part=snippet,statistics,contentDetails&${param}&key=${apiKey}`
  const data = (await ytFetch(url)) as {
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
