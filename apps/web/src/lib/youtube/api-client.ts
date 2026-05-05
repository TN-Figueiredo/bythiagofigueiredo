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
  maxResults = 10,
): Promise<string[]> {
  const url = `${BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${maxResults}&key=${apiKey}`
  const data = (await ytFetch(url)) as { items?: { contentDetails: { videoId: string } }[] }
  return (data.items ?? []).map((item) => item.contentDetails.videoId)
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
  const ids = videoIds.join(',')
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

  return (data.items ?? []).map((item) => {
    const { text, seconds } = parseDuration(item.contentDetails.duration)
    return {
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
    }
  })
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
