/**
 * Core "start a test" logic — NOT a server action.
 *
 * Security note: `'use server'` modules expose every export as an HTTP endpoint.
 * This file intentionally has NO `'use server'` directive so it can be called
 * safely from both the server action (actions.ts) and the cron job without
 * exposing internal functions to the network.
 */

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

// ---------------------------------------------------------------------------
// Internal helper — mirrors the one in actions.ts (kept separate to avoid
// importing from a 'use server' file, which would pull in Next.js server
// action machinery and potentially re-export network-accessible endpoints).
// ---------------------------------------------------------------------------

async function resolveYouTubeVideoId(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  internalVideoId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', internalVideoId)
    .single()
  return (data?.youtube_video_id as string | null) ?? null
}

// ---------------------------------------------------------------------------
// startAbTestInternal
// ---------------------------------------------------------------------------

/**
 * Start an AB test given its ID and the site it belongs to.
 *
 * Callers are responsible for:
 * - Authentication / authorisation (the server action wraps this with requireEditAccess)
 * - Cache invalidation (revalidateTag) after a successful return
 *
 * The conditional update (.eq('status', 'draft')) acts as an optimistic lock:
 * only the first concurrent caller will flip the row; subsequent ones see
 * count === 0 and return an error.
 */
export async function startAbTestInternal(
  testId: string,
  siteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServiceClient()

  // 1. Fetch the test row and validate ownership + status.
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Only draft tests can be started' }

  // 2. Fetch variants.
  const { data: variants, error: variantsError } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url, sort_order')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  if (variantsError) return { ok: false, error: variantsError.message }
  if (!variants || variants.length < 2) {
    return { ok: false, error: 'A test needs at least 2 variants (original + 1) to start' }
  }

  // 3. Compute the first variant via rotation.
  const firstIndex = getVariantForCycle(variants.length, 0)
  if (firstIndex < 0 || firstIndex >= variants.length) {
    return { ok: false, error: 'Invalid variant rotation index' }
  }
  const firstVariant = variants[firstIndex] as AbTestVariantRow

  // 4. Set thumbnail on YouTube.
  try {
    const { accessToken } = await ensureFreshToken(siteId, 'youtube')
    const youtubeVideoId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!youtubeVideoId) return { ok: false, error: 'YouTube video ID not found' }

    if (!firstVariant.is_original && firstVariant.blob_url) {
      const { buffer, contentType } = await fetchVariantImageBuffer(firstVariant.blob_url)
      await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()

  // 5. Conditional update — only succeeds when status is still 'draft'.
  //    This prevents two concurrent callers (cron + user) from both winning.
  const { count, error: updateError } = await supabase
    .from('ab_tests')
    .update({ status: 'active', started_at: now, paused_at: null, updated_at: now })
    .eq('id', testId)
    .eq('status', 'draft')
    .select('id', { count: 'exact', head: true })

  if (updateError) return { ok: false, error: updateError.message }
  if (!count || count === 0) {
    return { ok: false, error: 'Test was already started by another process' }
  }

  // 6. Insert cycle 0.
  const { error: cycleError } = await supabase.from('ab_test_cycles').insert({
    test_id: testId,
    variant_id: firstVariant.id,
    cycle_number: 0,
    started_at: now,
  })

  if (cycleError) return { ok: false, error: cycleError.message }

  return { ok: true }
}
