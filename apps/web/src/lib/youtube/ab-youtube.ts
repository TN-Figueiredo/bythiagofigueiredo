import * as Sentry from '@sentry/nextjs'

export async function setThumbnail(
  videoId: string,
  imageBuffer: Buffer,
  contentType: 'image/png' | 'image/jpeg',
  accessToken: string
): Promise<void> {
  const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: imageBuffer as BodyInit,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = `thumbnails.set failed: ${res.status}`
    Sentry.captureException(new Error(msg), {
      extra: { videoId, status: res.status, error: err },
    })
    throw new Error(msg)
  }
}

export async function getCurrentThumbnailUrl(
  videoId: string,
  accessToken: string
): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.items?.[0]?.snippet?.thumbnails?.high?.url ?? null
}

export async function fetchAnalyticsForDateRange(
  videoId: string,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<{ day: string; impressions: number; ctr: number }[]> {
  const params = new URLSearchParams({
    ids: 'channel==MINE',
    startDate,
    endDate,
    metrics: 'impressions,annotationImpressionClickThroughRate',
    dimensions: 'day',
    filters: `video==${videoId}`,
  })
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?${params}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Analytics query failed: ${res.status} — ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  return (data.rows ?? []).map((row: string[]) => ({
    day: row[0],
    impressions: Number(row[1]),
    ctr: Number(row[2]),
  }))
}

export async function fetchVariantImageBuffer(
  blobUrl: string
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/jpeg' }> {
  const res = await fetch(blobUrl)
  if (!res.ok) throw new Error(`Failed to fetch variant image: ${res.status}`)
  const ct = res.headers.get('content-type') ?? 'image/png'
  const contentType = ct.includes('jpeg') ? ('image/jpeg' as const) : ('image/png' as const)
  const arrayBuffer = await res.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), contentType }
}
