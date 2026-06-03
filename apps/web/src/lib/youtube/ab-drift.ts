import * as Sentry from '@sentry/nextjs'

export function normalizeYouTubeThumbnailUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('.ytimg.com')) {
      u.hostname = 'i.ytimg.com'
    }
    u.search = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return url.split('?')[0] ?? url
  }
}

export async function checkDrift(
  testId: string,
  youtubeVideoId: string,
  expectedThumbnailUrl: string | null,
  apiKey: string,
): Promise<{ drifted: boolean; currentUrl?: string }> {
  if (!expectedThumbnailUrl) return { drifted: false }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${youtubeVideoId}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) return { drifted: false }

    const data = await res.json()
    const currentUrl = data.items?.[0]?.snippet?.thumbnails?.high?.url ?? null
    if (!currentUrl) return { drifted: false }

    const normalizedCurrent = normalizeYouTubeThumbnailUrl(currentUrl)
    const normalizedExpected = normalizeYouTubeThumbnailUrl(expectedThumbnailUrl)
    const drifted = normalizedCurrent !== normalizedExpected

    Sentry.addBreadcrumb({
      category: 'ab-drift',
      message: `Drift check: test=${testId}, expected=${normalizedExpected}, current=${normalizedCurrent}, drifted=${drifted}`,
      level: drifted ? 'warning' : 'info',
    })

    return { drifted, currentUrl }
  } catch {
    return { drifted: false }
  }
}
