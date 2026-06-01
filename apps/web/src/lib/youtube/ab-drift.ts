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

    // Simple URL comparison (P7.18 notes pHash as future enhancement)
    // Normalize: strip query params for comparison
    const normalize = (url: string) => url.split('?')[0]
    const drifted = normalize(currentUrl) !== normalize(expectedThumbnailUrl)

    return { drifted, currentUrl }
  } catch {
    return { drifted: false }
  }
}
