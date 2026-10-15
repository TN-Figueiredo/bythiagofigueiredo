import * as Sentry from '@sentry/nextjs'

export async function updateVideoMetadata(
  videoId: string,
  title: string,
  accessToken: string,
): Promise<void> {
  const listUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const listRes = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
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
  // videos.update com part=snippet apaga propriedade mutável omitida: falha alto, sem PUT.
  if (typeof snippet?.description !== 'string') {
    throw new Error(`videos.list sem snippet.description: ${videoId}; nada enviado`)
  }
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
        title,
        description: snippet.description, // sempre a lida: o A/B não escreve descrição (P3)
        categoryId: snippet.categoryId,
        tags: snippet.tags ?? [],
      },
    }),
    signal: AbortSignal.timeout(15_000),
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
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null

  const data = await res.json()
  const snippet = data.items?.[0]?.snippet
  if (!snippet) return null

  return { title: snippet.title, description: snippet.description }
}
