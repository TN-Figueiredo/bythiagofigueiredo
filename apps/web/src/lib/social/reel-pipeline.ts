import { put, del } from '@vercel/blob'

const MIN_REEL_DURATION = 3
const MAX_REEL_DURATION = 90

export function shouldSkipReel(durationSeconds: number): boolean {
  return durationSeconds < MIN_REEL_DURATION || durationSeconds > MAX_REEL_DURATION
}

export async function prepareReelUpload(
  videoBuffer: Buffer,
  postId: string,
): Promise<{ blobUrl: string }> {
  const blob = await put(`social/reels/${postId}.mp4`, videoBuffer, {
    access: 'public',
    addRandomSuffix: true,
  })
  return { blobUrl: blob.url }
}

interface PublishReelOptions {
  igUserId: string
  accessToken: string
  blobUrl: string
  caption: string
  createContainer: (params: {
    media_type: 'REELS'
    video_url: string
    caption: string
  }) => Promise<{ id: string }>
  getContainerStatus: (containerId: string) => Promise<{ status_code: string }>
  publishContainer: (params: {
    creation_id: string
  }) => Promise<{ id: string }>
  maxPollAttempts?: number
  pollIntervalMs?: number
}

export async function publishReel({
  blobUrl,
  caption,
  createContainer,
  getContainerStatus,
  publishContainer,
  maxPollAttempts = 30,
  pollIntervalMs = 5_000,
}: PublishReelOptions): Promise<{ publishedId: string }> {
  const container = await createContainer({
    media_type: 'REELS',
    video_url: blobUrl,
    caption,
  })

  for (let attempts = 0; attempts < maxPollAttempts; attempts++) {
    const status = await getContainerStatus(container.id)
    if (status.status_code === 'FINISHED') break
    if (status.status_code === 'ERROR') {
      throw new Error(`Reel container processing failed for ${container.id}`)
    }
    if (attempts + 1 >= maxPollAttempts) {
      throw new Error(`Reel container processing timed out after ${maxPollAttempts} attempts`)
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  const result = await publishContainer({ creation_id: container.id })
  return { publishedId: result.id }
}

export async function cleanupReelBlob(blobUrl: string): Promise<void> {
  await del(blobUrl)
}
