import type { PlatformResult } from '../../core/types.js'
import { checkRateBudget, type RateBudgetCheck } from './rate-budget.js'

const GRAPH_BASE = 'https://graph.facebook.com/v25.0'
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type MediaType = 'STORIES' | 'REELS'

interface MediaInput {
  image_url?: string
  video_url?: string
  caption?: string
  media_type?: MediaType
}

export async function createMediaContainer(
  igUserId: string,
  token: string,
  media: MediaInput,
): Promise<string> {
  const body: Record<string, string> = {}

  if (media.caption) body['caption'] = media.caption

  if (media.video_url) {
    body['video_url'] = media.video_url
    body['media_type'] = media.media_type ?? 'REELS'
  } else if (media.image_url) {
    body['image_url'] = media.image_url
    if (media.media_type === 'STORIES') {
      body['media_type'] = 'STORIES'
    }
  }

  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IG container creation failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { id: string }
  return data.id
}

export async function pollContainerStatus(
  containerId: string,
  token: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<'FINISHED' | 'ERROR'> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const url = `${GRAPH_BASE}/${containerId}?fields=status_code&access_token=${token}`
    const res = await fetch(url)

    if (res.ok) {
      const data = (await res.json()) as {
        status_code: 'FINISHED' | 'ERROR' | 'IN_PROGRESS' | 'EXPIRED'
      }

      if (data.status_code === 'FINISHED') return 'FINISHED'
      if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
        return 'ERROR'
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }

  return 'ERROR'
}

export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<PlatformResult> {
  const res = await fetch(`${GRAPH_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ creation_id: containerId }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IG publish failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { id: string }
  return { id: data.id }
}

export async function publishInstagramMedia(
  igUserId: string,
  token: string,
  media: MediaInput,
): Promise<PlatformResult> {
  const containerId = await createMediaContainer(igUserId, token, media)

  const timeoutMs = media.video_url ? Math.max(DEFAULT_TIMEOUT_MS, 6 * 60 * 1000) : DEFAULT_TIMEOUT_MS
  const status = await pollContainerStatus(containerId, token, timeoutMs)

  if (status === 'ERROR') {
    throw new Error(`IG container ${containerId} failed processing`)
  }

  return publishContainer(igUserId, token, containerId)
}

export class InsufficientRateBudgetError extends Error {
  constructor(public budget: RateBudgetCheck) {
    super(`Need ${budget.required} API calls, only ${budget.remaining} remaining`)
    this.name = 'InsufficientRateBudgetError'
  }
}

export async function publishMultiSlideStory(
  igUserId: string,
  token: string,
  mediaUrls: string[],
  rateBudgetRemaining: number,
): Promise<PlatformResult[]> {
  const budgetCheck = checkRateBudget(rateBudgetRemaining, mediaUrls.length)
  if (!budgetCheck.sufficient) throw new InsufficientRateBudgetError(budgetCheck)

  const results: PlatformResult[] = []
  for (const url of mediaUrls) {
    const result = await publishInstagramMedia(igUserId, token, {
      image_url: url,
      media_type: 'STORIES',
    })
    results.push(result)
  }
  return results
}

export async function deleteInstagramMedia(
  mediaId: string,
  token: string,
): Promise<void> {
  const res = await fetch(
    `${GRAPH_BASE}/${mediaId}?access_token=${token}`,
    { method: 'DELETE' },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`IG delete failed (${res.status}): ${text}`)
  }
}
