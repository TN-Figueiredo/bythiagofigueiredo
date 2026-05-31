const DEDUP_MINUTES = 5

export function shouldSkipPoll(lastPollAt: string | null): boolean {
  if (!lastPollAt) return false
  const elapsed = Date.now() - new Date(lastPollAt).getTime()
  return elapsed < DEDUP_MINUTES * 60 * 1000
}

export async function pollVideoStats(
  youtubeVideoId: string,
  apiKey: string,
): Promise<{ views: number; likes: number } | null> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${youtubeVideoId}&key=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null

    const data = await res.json()
    if (!data.items?.length) return null

    const stats = data.items[0].statistics
    return {
      views: parseInt(stats.viewCount ?? '0', 10),
      likes: parseInt(stats.likeCount ?? '0', 10),
    }
  } catch {
    return null
  }
}

export async function getLastPollTime(
  supabase: any,
  testId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('ab_test_polls')
    .select('polled_at')
    .eq('test_id', testId)
    .order('polled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.polled_at ?? null
}

export async function insertPollData(
  supabase: any,
  testId: string,
  variantId: string,
  views: number,
  likes: number,
  source: 'client' | 'cron' = 'client',
): Promise<void> {
  await supabase.from('ab_test_polls').insert({
    test_id: testId,
    variant_id: variantId,
    views,
    likes,
    source,
  })
}
