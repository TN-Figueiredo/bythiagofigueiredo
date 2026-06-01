import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function autoImportWinner(
  testId: string,
  siteId: string,
): Promise<{ imported: boolean; libraryId?: string }> {
  const supabase = getSupabaseServiceClient()

  // Get test + winner variant
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, winner_variant_id, youtube_video_id, confidence_at_completion, name')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test?.winner_variant_id) return { imported: false }

  // Check if already imported
  const { data: existing } = await supabase
    .from('thumbnail_library')
    .select('id')
    .eq('source_test_id', testId)
    .maybeSingle()

  if (existing) return { imported: false }

  // Get winner variant details
  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, blob_url, label')
    .eq('id', test.winner_variant_id)
    .single()

  if (!variant?.blob_url) return { imported: false }

  // Get video title
  const { data: video } = await supabase
    .from('youtube_videos')
    .select('title')
    .eq('id', test.youtube_video_id)
    .single()

  // Compute lift from cycles
  const { data: cycles } = await supabase
    .from('ab_test_cycles')
    .select('variant_id, views')
    .eq('test_id', testId)
    .not('ended_at', 'is', null)

  let liftAtWin: number | null = null
  if (cycles?.length) {
    const winnerViews = cycles.filter(c => c.variant_id === test.winner_variant_id).reduce((s, c) => s + (c.views ?? 0), 0)
    const otherViews = cycles.filter(c => c.variant_id !== test.winner_variant_id).reduce((s, c) => s + (c.views ?? 0), 0)
    const otherCount = cycles.filter(c => c.variant_id !== test.winner_variant_id).length
    if (otherCount > 0 && otherViews > 0) {
      const avgOther = otherViews / otherCount
      const avgWinner = winnerViews / cycles.filter(c => c.variant_id === test.winner_variant_id).length
      liftAtWin = Math.round(((avgWinner - avgOther) / avgOther) * 10000) / 100
    }
  }

  const { data: entry } = await supabase
    .from('thumbnail_library')
    .insert({
      site_id: siteId,
      source_test_id: testId,
      source_variant_id: variant.id,
      source_type: 'test_winner',
      blob_url: variant.blob_url,
      title: `${variant.label} — ${test.name}`,
      video_title: video?.title ?? null,
      youtube_video_id: test.youtube_video_id,
      lift_at_win: liftAtWin,
    })
    .select('id')
    .single()

  return { imported: true, libraryId: entry?.id }
}

export async function checkLongevity(
  libraryId: string,
  checkpointDays: 7 | 30 | 60 | 90,
  currentViews: number,
  viewsAtWin: number,
): Promise<{ status: 'holding' | 'fading' | 'growing'; changePercent: number }> {
  const changePercent = viewsAtWin > 0
    ? Math.round(((currentViews - viewsAtWin) / viewsAtWin) * 10000) / 100
    : 0

  const status = changePercent > 20 ? 'growing'
    : changePercent < -20 ? 'fading'
    : 'holding'

  return { status, changePercent }
}

export async function checkAndPersistLongevity(
  libraryId: string,
  checkpointDays: 7 | 30 | 60 | 90,
  currentViews: number,
  viewsAtWin: number,
): Promise<void> {
  const { status, changePercent } = await checkLongevity(libraryId, checkpointDays, currentViews, viewsAtWin)

  const supabase = getSupabaseServiceClient()
  await supabase.from('thumbnail_longevity').upsert({
    library_id: libraryId,
    checkpoint_days: checkpointDays,
    ctr_at_checkpoint: currentViews,  // stores views (column name is legacy)
    ctr_at_win: viewsAtWin,
    change_percent: changePercent,
    status,
    checked_at: new Date().toISOString(),
  }, { onConflict: 'library_id,checkpoint_days' })
}

export async function runLongevityChecks(siteId: string): Promise<number> {
  const supabase = getSupabaseServiceClient()

  // Get library entries from test winners with youtube_video_id
  const { data: entries } = await supabase
    .from('thumbnail_library')
    .select('id, youtube_video_id, created_at, source_test_id')
    .eq('site_id', siteId)
    .eq('source_type', 'test_winner')
    .not('youtube_video_id', 'is', null)

  if (!entries?.length) return 0

  let checked = 0
  const checkpoints: Array<{ days: 7 | 30 | 60 | 90; ms: number }> = [
    { days: 7, ms: 7 * 86400000 },
    { days: 30, ms: 30 * 86400000 },
    { days: 60, ms: 60 * 86400000 },
    { days: 90, ms: 90 * 86400000 },
  ]

  for (const entry of entries) {
    const ageMs = Date.now() - new Date(entry.created_at).getTime()

    for (const cp of checkpoints) {
      if (ageMs < cp.ms) continue // not old enough for this checkpoint

      // Check if already recorded
      const { data: existing } = await supabase
        .from('thumbnail_longevity')
        .select('id')
        .eq('library_id', entry.id)
        .eq('checkpoint_days', cp.days)
        .maybeSingle()

      if (existing) continue // already checked

      // Get current view count
      const { data: video } = await supabase
        .from('youtube_videos')
        .select('view_count')
        .eq('id', entry.youtube_video_id)
        .single()

      if (!video) continue

      // Get view count at time of win (from the test's cycles)
      const { data: winCycles } = await supabase
        .from('ab_test_cycles')
        .select('views')
        .eq('test_id', entry.source_test_id)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const viewsAtWin = winCycles?.views ?? 0
      await checkAndPersistLongevity(entry.id, cp.days, video.view_count ?? 0, viewsAtWin)
      checked++
    }
  }

  return checked
}
