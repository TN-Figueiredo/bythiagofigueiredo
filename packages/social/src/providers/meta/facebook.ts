import type { PlatformResult } from '../../core/types.js'

const GRAPH_BASE = 'https://graph.facebook.com/v25.0'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function postToPage(
  pageId: string,
  pageToken: string,
  content: { message: string; link?: string },
): Promise<PlatformResult> {
  const body: Record<string, string> = { message: content.message }
  if (content.link) body['link'] = content.link

  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageToken}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Facebook post failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { id: string }
  // data.id = "pageId_postId"
  const postId = data.id.split('_')[1] ?? data.id

  return {
    id: data.id,
    url: `https://facebook.com/${pageId}/posts/${postId}`,
  }
}

export async function warmOGCache(
  url: string,
  accessToken: string,
): Promise<boolean> {
  const maxRetries = 3
  const delayMs = 10_000

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) await sleep(delayMs)

    const res = await fetch(
      `${GRAPH_BASE}/?id=${encodeURIComponent(url)}&scrape=true`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )

    if (!res.ok) continue

    const data = (await res.json()) as {
      og_object?: { image?: Array<{ url: string }> }
    }

    if (data.og_object?.image?.[0]?.url) return true
  }

  return false
}

export async function deletePagePost(
  postId: string,
  pageToken: string,
): Promise<void> {
  const res = await fetch(
    `${GRAPH_BASE}/${postId}?access_token=${pageToken}`,
    { method: 'DELETE' },
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Facebook delete failed (${res.status}): ${text}`)
  }
}
