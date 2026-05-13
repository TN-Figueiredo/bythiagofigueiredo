import { youtube, type youtube_v3 } from '@googleapis/youtube'
import type { PlatformResult } from '../../core/types.js'

export interface YouTubeVideo {
  id: string
  title: string
  description: string
  tags: string[]
  categoryId: string
  privacyStatus: 'private' | 'public' | 'unlisted'
  publishedAt: string
  thumbnails: Record<string, { url: string; width: number; height: number }>
  duration: string
  viewCount: number
}

export interface YouTubeAuth {
  accessToken: string
}

export interface VideoMetadata {
  title: string
  description?: string
  tags?: string[]
  categoryId?: string
  privacyStatus: 'private' | 'public' | 'unlisted'
}

function getClient(auth: YouTubeAuth): youtube_v3.Youtube {
  return youtube({
    version: 'v3',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
    },
  })
}

function mapVideo(item: youtube_v3.Schema$Video): YouTubeVideo | null {
  if (!item.id) return null

  const snippet = item.snippet ?? {}
  const status = item.status ?? {}
  const contentDetails = item.contentDetails ?? {}
  const statistics = item.statistics ?? {}
  const thumbs = snippet.thumbnails ?? {}

  const thumbnails: YouTubeVideo['thumbnails'] = {}
  for (const [key, val] of Object.entries(thumbs)) {
    if (val?.url && val.width != null && val.height != null) {
      thumbnails[key] = { url: val.url, width: val.width, height: val.height }
    }
  }

  return {
    id: item.id,
    title: snippet.title ?? '',
    description: snippet.description ?? '',
    tags: snippet.tags ?? [],
    categoryId: snippet.categoryId ?? '',
    privacyStatus: (status.privacyStatus as YouTubeVideo['privacyStatus']) ?? 'private',
    publishedAt: snippet.publishedAt ?? '',
    thumbnails,
    duration: contentDetails.duration ?? '',
    viewCount: Number(statistics.viewCount ?? 0),
  }
}

export async function createUploadSession(
  auth: YouTubeAuth,
  metadata: VideoMetadata,
): Promise<string> {
  const requestBody = {
    snippet: {
      title: metadata.title,
      description: metadata.description ?? '',
      tags: metadata.tags ?? [],
      categoryId: metadata.categoryId ?? '22',
    },
    status: {
      privacyStatus: metadata.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  }

  const response = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'video/*',
      },
      body: JSON.stringify(requestBody),
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`YouTube resumable upload init failed (${response.status}): ${body}`)
  }

  const uploadUri = response.headers.get('location')
  if (!uploadUri) {
    throw new Error('YouTube resumable upload init returned no location header')
  }

  return uploadUri
}

export async function updateVideoMetadata(
  auth: YouTubeAuth,
  videoId: string,
  metadata: Partial<VideoMetadata>,
): Promise<PlatformResult> {
  const client = getClient(auth)

  const requestBody: youtube_v3.Schema$Video = {
    id: videoId,
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: metadata.categoryId,
    },
  }

  if (metadata.privacyStatus) {
    requestBody.status = { privacyStatus: metadata.privacyStatus }
  }

  const parts: string[] = ['snippet']
  if (metadata.privacyStatus) parts.push('status')

  await client.videos.update({
    part: parts,
    requestBody,
  })

  return {
    id: videoId,
    url: `https://youtube.com/watch?v=${videoId}`,
  }
}

export async function setThumbnail(
  auth: YouTubeAuth,
  videoId: string,
  imageBuffer: Uint8Array,
  mimeType: string,
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': mimeType,
      },
      body: imageBuffer as unknown as BodyInit,
    },
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`YouTube set thumbnail failed (${response.status}): ${body}`)
  }
}

export async function setPrivacyStatus(
  auth: YouTubeAuth,
  videoId: string,
  status: 'private' | 'public' | 'unlisted',
): Promise<void> {
  const client = getClient(auth)

  await client.videos.update({
    part: ['status'],
    requestBody: {
      id: videoId,
      status: { privacyStatus: status },
    },
  })
}

export async function getVideo(
  auth: YouTubeAuth,
  videoId: string,
): Promise<YouTubeVideo | null> {
  const client = getClient(auth)

  const res = await client.videos.list({
    part: ['snippet', 'status', 'contentDetails', 'statistics'],
    id: [videoId],
  })

  const item = res.data.items?.[0]
  if (!item) return null

  return mapVideo(item)
}

export async function deleteVideo(
  auth: YouTubeAuth,
  videoId: string,
): Promise<void> {
  const client = getClient(auth)
  await client.videos.delete({ id: videoId })
}

export async function listVideos(
  auth: YouTubeAuth,
  channelId: string,
  maxResults = 10,
): Promise<YouTubeVideo[]> {
  const client = getClient(auth)

  const searchRes = await client.search.list({
    part: ['id'],
    channelId,
    type: ['video'],
    order: 'date',
    maxResults,
  })

  const videoIds = (searchRes.data.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id))

  if (videoIds.length === 0) return []

  const videosRes = await client.videos.list({
    part: ['snippet', 'status', 'contentDetails', 'statistics'],
    id: videoIds,
  })

  return (videosRes.data.items ?? [])
    .map(mapVideo)
    .filter((v): v is YouTubeVideo => v !== null)
}
