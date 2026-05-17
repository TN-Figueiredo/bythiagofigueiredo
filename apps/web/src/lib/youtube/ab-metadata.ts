import * as Sentry from '@sentry/nextjs'

export async function updateVideoMetadata(
  videoId: string,
  title: string | null,
  description: string | null,
  accessToken: string,
): Promise<void> {
  if (title === null && description === null) return

  const listUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({}))
    const msg = `videos.list failed: ${listRes.status}`
    Sentry.captureException(new Error(msg), { extra: { videoId, error: err } })
    throw new Error(msg)
  }

  const listData = await listRes.json()
  const item = listData.items?.[0]
  if (!item) throw new Error(`Video not found: ${videoId}`)

  const snippet = item.snippet
  const updateUrl = 'https://www.googleapis.com/youtube/v3/videos?part=snippet'
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title: title ?? snippet.title,
        description: description ?? snippet.description,
        categoryId: snippet.categoryId,
        tags: snippet.tags ?? [],
      },
    }),
  })

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}))
    const msg = `videos.update failed: ${updateRes.status}`
    Sentry.captureException(new Error(msg), { extra: { videoId, error: err } })
    throw new Error(msg)
  }
}

export async function captureOriginalMetadata(
  videoId: string,
  accessToken: string,
): Promise<{ title: string; description: string } | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null

  const data = await res.json()
  const snippet = data.items?.[0]?.snippet
  if (!snippet) return null

  return { title: snippet.title, description: snippet.description }
}
