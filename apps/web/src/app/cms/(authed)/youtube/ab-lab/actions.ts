'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { put } from '@vercel/blob'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AB_TEST_CONFIG_DEFAULTS, VARIANT_LABELS, DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import type {
  AbTestCreateInput,
  AbTestVariantRow,
  AbTestSiteSettings,
  TestType,
  CreateTextVariantInput,
  VariantMetadata,
} from '@/lib/youtube/ab-types'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { preflightTokenCheck } from '@/lib/youtube/ab-preflight'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { getVariantForCycle, getNextVariantIndex } from '@/lib/youtube/ab-rotation'
import { captureOriginalMetadata, updateVideoMetadata } from '@/lib/youtube/ab-metadata'
import { parseTemplateTokens } from '@/lib/youtube/ab-templates'
import { applyVariantToYouTube } from '@/lib/youtube/ab-apply'
import { ensureTrackedLink } from '@/lib/links/auto-link'
import { getChannelTier } from '@/lib/youtube/scoring'
import { scoreForPrompt } from '@/lib/youtube/prompt-scoring'
import type { AbBriefingData } from '@/lib/youtube/prompt-types'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { autoImportWinner } from '@/lib/youtube/thumbnail-library'
import { getVideoTestHistory as _getVideoTestHistory } from './queries'

async function preserveOriginalThumbnail(ytUrl: string): Promise<string> {
  const imgRes = await fetch(ytUrl, { signal: AbortSignal.timeout(15_000) })
  if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const ct = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const ext = ct.includes('png') ? 'png' : 'jpg'
  const blob = await put(
    `ab-originals/${crypto.randomUUID()}/original.${ext}`,
    buffer,
    { access: 'public', contentType: ct, addRandomSuffix: true },
  )
  return blob.url
}

export async function getVideoTestHistory(
  ...args: Parameters<typeof _getVideoTestHistory>
): ReturnType<typeof _getVideoTestHistory> {
  return _getVideoTestHistory(...args)
}

// ---------------------------------------------------------------------------
// dismissFatigueAlert
// ---------------------------------------------------------------------------

export async function dismissFatigueAlert(alertId: string): Promise<{ ok: boolean }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch {
    return { ok: false }
  }

  const supabase = getSupabaseServiceClient()
  await supabase
    .from('youtube_fatigue_alerts')
    .update({ status: 'dismissed' })
    .eq('id', alertId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

// ---------------------------------------------------------------------------
// createAbTest
// ---------------------------------------------------------------------------

export async function createAbTest(
  input: AbTestCreateInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  if (input.site_id !== siteId) {
    return { ok: false, error: 'site_id mismatch' }
  }

  const supabase = getSupabaseServiceClient()

  // Fetch video
  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, duration_seconds, thumbnail_hq_url')
    .eq('id', input.youtube_video_id)
    .eq('site_id', siteId)
    .single()

  if (videoError || !video) {
    return { ok: false, error: 'Video not found' }
  }

  // Reject Shorts
  if ((video.duration_seconds ?? 0) <= 60) {
    return { ok: false, error: 'Shorts (≤ 60s) are not eligible for A/B tests' }
  }

  if (!video.thumbnail_hq_url) {
    return { ok: false, error: 'Video has no thumbnail — sync first' }
  }

  let immutableOriginalUrl: string | null = video.thumbnail_hq_url ?? null
  if (video.thumbnail_hq_url?.includes('ytimg.com')) {
    try {
      immutableOriginalUrl = await preserveOriginalThumbnail(video.thumbnail_hq_url)
    } catch {
      return { ok: false, error: 'Falha ao salvar thumbnail original. Tente novamente.' }
    }
  }

  // Check for existing active/draft/paused test on the same video
  const { data: existing } = await supabase
    .from('ab_tests')
    .select('id')
    .eq('youtube_video_id', input.youtube_video_id)
    .eq('site_id', siteId)
    .in('status', ['draft', 'active', 'paused'])
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { ok: false, error: 'An active, paused or draft test already exists for this video' }
  }

  // Merge config with defaults
  const config = { ...AB_TEST_CONFIG_DEFAULTS, ...(input.config ?? {}) }

  // Capture original metadata for title/desc/combo tests
  let originalTitle: string | null = null
  let originalDescription: string | null = null
  const testType: TestType = input.test_type ?? 'thumbnail'

  if (testType !== 'thumbnail') {
    try {
      const { accessToken } = await ensureFreshToken(siteId, 'youtube')
      const { data: ytVideo } = await supabase
        .from('youtube_videos')
        .select('youtube_video_id')
        .eq('id', input.youtube_video_id)
        .single()

      if (ytVideo) {
        const meta = await captureOriginalMetadata(ytVideo.youtube_video_id, accessToken)
        if (meta) {
          originalTitle = meta.title
          originalDescription = meta.description
        }
      }
    } catch {
      // Non-fatal — we can proceed without originals
    }
  }

  // Insert test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .insert({
      site_id: siteId,
      youtube_video_id: input.youtube_video_id,
      name: input.name,
      status: 'draft',
      config,
      original_thumbnail_url: immutableOriginalUrl,
      test_type: testType,
      original_title: originalTitle,
      original_description: originalDescription,
    })
    .select('id')
    .single()

  if (testError || !test) {
    return { ok: false, error: testError?.message ?? 'Failed to create test' }
  }

  // Insert original variant
  const { error: variantError } = await supabase.from('ab_test_variants').insert({
    test_id: test.id,
    label: 'original',
    is_original: true,
    blob_url: immutableOriginalUrl,
    blob_key: null,
    sort_order: 0,
  })

  if (variantError) {
    // Roll back the test row on variant insert failure
    await supabase.from('ab_tests').delete().eq('id', test.id)
    return { ok: false, error: variantError.message }
  }

  // Auto-resolve any pending fatigue alert for this video
  await supabase
    .from('youtube_fatigue_alerts')
    .update({ status: 'resolved', resolved_by_test_id: test.id })
    .eq('video_id', input.youtube_video_id)
    .eq('status', 'pending')

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, id: test.id }
}

// ---------------------------------------------------------------------------
// updateAbTestType
// ---------------------------------------------------------------------------

export async function updateAbTestType(
  testId: string,
  newType: TestType,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Only draft tests can change type' }

  const { error } = await supabase
    .from('ab_tests')
    .update({ test_type: newType })
    .eq('id', testId)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// uploadVariant
// ---------------------------------------------------------------------------

export async function uploadVariant(
  testId: string,
  formData: FormData,
): Promise<{ ok: boolean; variantId?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load test and assert draft status + site scope
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be added to draft tests' }

  // Get file from FormData
  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { ok: false, error: 'No file provided' }

  // Validate type and size
  const allowedTypes = ['image/jpeg', 'image/png']
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'File must be JPEG or PNG (YouTube does not accept WebP)' }
  }
  const MAX_SIZE = 2 * 1024 * 1024 // 2 MB
  if (file.size > MAX_SIZE) {
    return { ok: false, error: 'File must be 2 MB or smaller' }
  }

  // Count existing non-original variants
  const { data: existingVariants, error: countError } = await supabase
    .from('ab_test_variants')
    .select('id, label')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (countError) return { ok: false, error: countError.message }

  if ((existingVariants?.length ?? 0) >= 3) {
    return { ok: false, error: 'Maximum of 3 non-original variants allowed' }
  }

  // Determine next label
  const usedLabels = new Set((existingVariants ?? []).map(v => v.label))
  const label = VARIANT_LABELS.find(l => !usedLabels.has(l))
  if (!label) return { ok: false, error: 'No available variant label slot' }

  // Determine extension
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const ext = extMap[file.type] ?? 'jpg'

  // Upload to Vercel Blob
  const buffer = Buffer.from(await file.arrayBuffer())
  const blobPath = `ab-test/${testId}/${label}.${ext}`
  const blob = await put(blobPath, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: file.type,
  })

  // Insert variant row
  const sortOrder = 1 + (existingVariants?.length ?? 0)
  const { data: variant, error: insertError } = await supabase
    .from('ab_test_variants')
    .insert({
      test_id: testId,
      label,
      is_original: false,
      blob_url: blob.url,
      blob_key: blob.pathname,
      file_size_bytes: file.size,
      sort_order: sortOrder,
      title_text: formData.get('title_text') as string | null ?? null,
      description_text: formData.get('description_text') as string | null ?? null,
    })
    .select('id')
    .single()

  if (insertError || !variant) {
    try {
      const { del } = await import('@vercel/blob')
      await del(blob.url)
    } catch {}
    return { ok: false, error: insertError?.message ?? 'Failed to insert variant' }
  }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, variantId: variant.id }
}

// ---------------------------------------------------------------------------
// deleteVariant
// ---------------------------------------------------------------------------

export async function deleteVariant(
  variantId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load variant
  const { data: variant, error: variantError } = await supabase
    .from('ab_test_variants')
    .select('id, test_id, is_original, blob_url')
    .eq('id', variantId)
    .single()

  if (variantError || !variant) return { ok: false, error: 'Variant not found' }
  if (variant.is_original) return { ok: false, error: 'Cannot delete the original variant' }

  // Load parent test (scoped to site for security)
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', variant.test_id)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Parent test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be deleted from draft tests' }

  // Delete blob if present
  if (variant.blob_url) {
    const { del } = await import('@vercel/blob')
    await del(variant.blob_url)
  }

  // Delete variant row
  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variantId)

  if (deleteError) return { ok: false, error: deleteError.message }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// cleanupDraftVariants — remove non-original variants from a draft test
// ---------------------------------------------------------------------------

export async function cleanupDraftVariants(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Can only clean up draft tests' }

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('id, blob_url')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (variants && variants.length > 0) {
    const { del } = await import('@vercel/blob')
    for (const v of variants) {
      if (v.blob_url) await del(v.blob_url).catch(() => {})
    }
    await supabase
      .from('ab_test_variants')
      .delete()
      .eq('test_id', testId)
      .eq('is_original', false)
  }

  return { ok: true }
}

// ---------------------------------------------------------------------------
// pullPipelineThumbnails
// ---------------------------------------------------------------------------

export async function pullPipelineThumbnails(
  testId: string,
  pipelineId: string,
): Promise<{ ok: boolean; added?: number; error?: string }> {
  try {
    await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Pipeline thumbnails can only be added to draft tests' }

  // Load pipeline entry
  const { data: pipeline, error: pipelineError } = await supabase
    .from('content_pipeline')
    .select('id, social_config')
    .eq('id', pipelineId)
    .single()

  if (pipelineError || !pipeline) return { ok: false, error: 'Pipeline entry not found' }

  const socialConfig = pipeline.social_config as Record<string, unknown> | null
  const thumbnailAlternatives = (socialConfig?.thumbnail_alternatives ?? []) as string[]

  if (!Array.isArray(thumbnailAlternatives) || thumbnailAlternatives.length === 0) {
    return { ok: false, error: 'No thumbnail_alternatives found in pipeline social_config' }
  }

  // Count existing non-original variants
  const { data: existingVariants, error: countError } = await supabase
    .from('ab_test_variants')
    .select('id, label')
    .eq('test_id', testId)
    .eq('is_original', false)

  if (countError) return { ok: false, error: countError.message }

  const existingCount = existingVariants?.length ?? 0
  const usedLabels = new Set((existingVariants ?? []).map(v => v.label))
  const maxToAdd = 3 - existingCount

  if (maxToAdd <= 0) {
    return { ok: false, error: 'Maximum of 3 non-original variants already reached' }
  }

  const urlsToProcess = thumbnailAlternatives.slice(0, maxToAdd)
  let added = 0

  for (const url of urlsToProcess) {
    const label = VARIANT_LABELS.find(l => !usedLabels.has(l))
    if (!label) break

    try {
      // Fetch image from URL
      const response = await fetch(url)
      if (!response.ok) continue

      const contentType = response.headers.get('content-type') ?? 'image/jpeg'
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(contentType)) continue

      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }
      const ext = extMap[contentType] ?? 'jpg'

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      const blobPath = `ab-test/${testId}/${label}.${ext}`
      const blob = await put(blobPath, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType,
      })

      const sortOrder = 1 + existingCount + added
      const { error: insertError } = await supabase.from('ab_test_variants').insert({
        test_id: testId,
        label,
        is_original: false,
        blob_url: blob.url,
        blob_key: blob.pathname,
        file_size_bytes: buffer.byteLength,
        sort_order: sortOrder,
      })

      if (!insertError) {
        usedLabels.add(label)
        added++
      }
    } catch {
      // Skip failed URLs — continue with remaining
      continue
    }
  }

  // Update ab_tests.source_pipeline_id
  await supabase
    .from('ab_tests')
    .update({ source_pipeline_id: pipelineId, updated_at: new Date().toISOString() })
    .eq('id', testId)

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, added }
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the YouTube Data API video ID (youtube_video_id column on youtube_videos)
 * given the FK stored in ab_tests (which is the PK of youtube_videos).
 */
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

async function resolveChannelAccountId(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  internalVideoId: string,
): Promise<string | undefined> {
  const { data } = await supabase
    .from('youtube_videos')
    .select('youtube_channels!inner(channel_id)')
    .eq('id', internalVideoId)
    .single()
  return (data as any)?.youtube_channels?.channel_id ?? undefined
}

// ---------------------------------------------------------------------------
// startAbTest
// ---------------------------------------------------------------------------

export async function startAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const result = await startAbTestInternal(testId, siteId)
  if (result.ok) {
    revalidateTag('youtube')
    revalidatePath('/cms/youtube/ab-lab')
  }
  return result
}

// ---------------------------------------------------------------------------
// pauseAbTest
// ---------------------------------------------------------------------------

export async function pauseAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id, original_thumbnail_url')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'active') return { ok: false, error: 'Only active tests can be paused' }

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url')
    .eq('test_id', testId)

  const originalVariant = variants?.find(v => v.is_original)

  try {
    const channelAccountId = await resolveChannelAccountId(supabase, test.youtube_video_id as string)
    const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId)
    const youtubeVideoId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!youtubeVideoId) return { ok: false, error: 'YouTube video ID not found' }

    const revertUrl = originalVariant?.blob_url ?? (test.original_thumbnail_url as string | null)
    if (revertUrl) {
      const { buffer, contentType } = await fetchVariantImageBuffer(revertUrl)
      await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()

  // Set paused first (prevents rotate cron from acting on this test)
  const { error: updateError } = await supabase
    .from('ab_tests')
    .update({ status: 'paused', paused_at: now, updated_at: now })
    .eq('id', testId)

  if (updateError) return { ok: false, error: updateError.message }

  // Now close the open cycle safely
  await supabase
    .from('ab_test_cycles')
    .update({ ended_at: now })
    .eq('test_id', testId)
    .is('ended_at', null)

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// acknowledgeAbTestDrift
// ---------------------------------------------------------------------------

export async function acknowledgeAbTestDrift(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch (e) { return { ok: false, error: (e as Error).message } }

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('ab_tests')
    .update({ drift_acknowledged_at: new Date().toISOString(), status_note: null })
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'paused')

  if (error) return { ok: false, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// resumeAbTest
// ---------------------------------------------------------------------------

export async function resumeAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, status_note, drift_acknowledged_at, youtube_video_id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'paused') return { ok: false, error: 'Only paused tests can be resumed' }
  if (test.status_note === DRIFT_STATUS_NOTE && !test.drift_acknowledged_at) {
    return { ok: false, error: 'Drift não reconhecido. Reconheça a mudança antes de retomar o teste.' }
  }

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url, sort_order')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  if (!variants || variants.length < 2) {
    return { ok: false, error: 'No variants found' }
  }

  const { count: totalCycleCount } = await supabase
    .from('ab_test_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', testId)

  const nextCycleNumber = totalCycleCount ?? 0
  const nextIndex = getVariantForCycle(variants.length, nextCycleNumber)
  if (nextIndex < 0 || nextIndex >= variants.length) {
    return { ok: false, error: 'Invalid variant rotation index' }
  }
  const nextVariant = variants[nextIndex] as AbTestVariantRow

  try {
    const channelAccountId = await resolveChannelAccountId(supabase, test.youtube_video_id as string)
    const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId)
    const youtubeVideoId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!youtubeVideoId) return { ok: false, error: 'YouTube video ID not found' }

    if (nextVariant.blob_url) {
      const { buffer, contentType } = await fetchVariantImageBuffer(nextVariant.blob_url)
      await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()

  const { error: cycleError } = await supabase.from('ab_test_cycles').insert({
    test_id: testId,
    variant_id: nextVariant.id,
    cycle_number: nextCycleNumber,
    started_at: now,
  })

  if (cycleError) return { ok: false, error: cycleError.message }

  const { error: updateError } = await supabase
    .from('ab_tests')
    .update({ status: 'active', paused_at: null, drift_acknowledged_at: null, status_note: null, updated_at: now })
    .eq('id', testId)

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// endAbTest
// ---------------------------------------------------------------------------

export async function endAbTest(
  testId: string,
  winnerId?: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id, original_thumbnail_url')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (!['active', 'paused'].includes(test.status as string)) {
    return { ok: false, error: 'Only active or paused tests can be ended' }
  }

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url')
    .eq('test_id', testId)

  if (!variants) return { ok: false, error: 'No variants found' }

  // Validate winnerId belongs to this test
  if (winnerId) {
    const winnerExists = variants.some(v => v.id === winnerId)
    if (!winnerExists) return { ok: false, error: 'Winner variant does not belong to this test' }
  }

  const targetVariant = winnerId
    ? variants.find(v => v.id === winnerId)
    : variants.find(v => v.is_original)

  try {
    const channelAccountId = await resolveChannelAccountId(supabase, test.youtube_video_id as string)
    const { accessToken } = await ensureFreshToken(siteId, 'youtube', channelAccountId)
    const youtubeVideoId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!youtubeVideoId) return { ok: false, error: 'YouTube video ID not found' }

    const applyUrl = targetVariant?.blob_url ?? (test.original_thumbnail_url as string | null)
    if (applyUrl) {
      const { buffer, contentType } = await fetchVariantImageBuffer(applyUrl)
      await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()

  // Close open cycle
  await supabase
    .from('ab_test_cycles')
    .update({ ended_at: now })
    .eq('test_id', testId)
    .is('ended_at', null)

  const completedReason = winnerId ? 'manual_winner' : 'manual_archive'

  const { error: updateError } = await supabase
    .from('ab_tests')
    .update({
      status: 'completed',
      completed_at: now,
      completed_reason: completedReason,
      winner_variant_id: winnerId ?? null,
      updated_at: now,
    })
    .eq('id', testId)

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// archiveAbTest
// ---------------------------------------------------------------------------

export async function archiveAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { error: updateError } = await supabase
    .from('ab_tests')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', testId)
    .eq('site_id', siteId)
    .in('status', ['completed', 'draft'])

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}


// ---------------------------------------------------------------------------
// updateAbSiteSettings
// ---------------------------------------------------------------------------

export async function updateAbSiteSettings(
  newSettings: Partial<AbTestSiteSettings>,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: site } = await supabase
    .from('sites')
    .select('settings')
    .eq('id', siteId)
    .single()

  const currentSettings = (site?.settings as Record<string, unknown> | null) ?? {}
  const currentAbSettings = (currentSettings.ab_test as Partial<AbTestSiteSettings> | null) ?? {}

  const merged = { ...currentAbSettings, ...newSettings }

  const { error: updateError } = await supabase
    .from('sites')
    .update({
      settings: { ...currentSettings, ab_test: merged },
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId)

  if (updateError) return { ok: false, error: updateError.message }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// createTextVariant
// ---------------------------------------------------------------------------

export async function createTextVariant(
  input: CreateTextVariantInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, test_type')
    .eq('id', input.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Can only add variants to draft tests' }
  if (test.test_type === 'thumbnail') {
    return { ok: false, error: 'Texto não pode ser adicionado a testes de thumbnail' }
  }

  const { count } = await supabase
    .from('ab_test_variants')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', input.test_id)

  if ((count ?? 0) >= 4) return { ok: false, error: 'Maximum 4 variants per test' }

  const sortOrder = (count ?? 0)
  const label = input.label ?? VARIANT_LABELS[sortOrder - 1] ?? `v${sortOrder + 1}`

  const { data: variant, error } = await supabase
    .from('ab_test_variants')
    .insert({
      test_id: input.test_id,
      label,
      is_original: false,
      title_text: input.title_text ?? null,
      description_text: input.description_text ?? null,
      metadata: input.metadata ?? {},
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !variant) return { ok: false, error: error?.message ?? 'Insert failed' }

  // Create tracked links for {{link:name}} templates in description
  if (input.description_text) {
    const tokens = parseTemplateTokens(input.description_text)
    for (const templateName of tokens) {
      const destinationUrl = input.link_destinations?.[templateName] ?? `https://bythiagofigueiredo.com`
      const linkResult = await ensureTrackedLink(
        supabase, siteId, `ab-${input.test_id}-${variant.id}-${templateName}`,
        'ab_test', destinationUrl, `A/B: ${templateName} (${label})`,
      )
      if (linkResult) {
        await supabase.from('ab_test_tracked_links').insert({
          ab_test_id: input.test_id,
          variant_id: variant.id,
          link_id: linkResult.linkId,
          template_name: templateName,
          short_code: linkResult.code,
        })
      }
    }
  }

  revalidateTag('ab-tests')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, id: variant.id }
}

// ---------------------------------------------------------------------------
// updateTextVariant
// ---------------------------------------------------------------------------

export async function updateTextVariant(
  variantId: string,
  updates: { title_text?: string; description_text?: string; metadata?: Partial<VariantMetadata> },
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, test_id')
    .eq('id', variantId)
    .single()

  if (!variant) return { ok: false, error: 'Variant not found' }

  const { data: test } = await supabase
    .from('ab_tests')
    .select('status, site_id')
    .eq('id', variant.test_id)
    .eq('site_id', siteId)
    .single()

  if (!test || test.status !== 'draft') {
    return { ok: false, error: 'Can only edit variants of draft tests' }
  }

  const { error } = await supabase
    .from('ab_test_variants')
    .update(updates)
    .eq('id', variantId)

  if (error) return { ok: false, error: error.message }

  revalidateTag('ab-tests')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// forceRotate
// ---------------------------------------------------------------------------

export async function forceRotate(testId: string): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id, test_type, original_title, original_description, config, last_applied_variant_id, variants:ab_test_variants!test_id(*)')
    .eq('id', testId)
    .eq('site_id', siteId)
    .eq('status', 'active')
    .single()

  if (!test) return { ok: false, error: 'Test not found or not active' }

  // Resolve channel for correct token
  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id, channel_id')
    .eq('id', test.youtube_video_id)
    .single()
  if (!video) return { ok: false, error: 'Video not found' }

  // Resolve the YouTube channel_id for correct OAuth token selection
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('channel_id')
    .eq('id', video.channel_id as string)
    .single()

  // Pre-flight token check (validates token works against YouTube API)
  const preflight = await preflightTokenCheck(siteId, 'youtube', channel?.channel_id as string | undefined)
  if (!preflight.ok) {
    return { ok: false, error: `Token inválido: ${preflight.reason}` }
  }
  const accessToken = preflight.accessToken

  // Count completed cycles BEFORE closing current (matches cron logic)
  const { count } = await supabase
    .from('ab_test_cycles')
    .select('id', { count: 'exact', head: true })
    .eq('test_id', testId)
    .not('ended_at', 'is', null)

  const nextCycle = (count ?? 0) + 1

  const variants = (test.variants as Array<{ id: string; sort_order: number; blob_url: string | null; is_original: boolean; title_text: string | null; description_text: string | null }>)
    .sort((a, b) => a.sort_order - b.sort_order)

  const config = test.config as Record<string, unknown> | null
  const pattern = (config?.rotation_pattern as 'abba' | 'round_robin' | 'random' | undefined) ?? 'abba'
  const nextIndex = getNextVariantIndex(pattern, variants.length, nextCycle)
  const nextVariant = variants[nextIndex]
  if (!nextVariant) return { ok: false, error: 'Invalid variant index' }

  // Write-ahead marker: record intent BEFORE calling YouTube API
  await supabase
    .from('ab_tests')
    .update({ last_applied_variant_id: nextVariant.id })
    .eq('id', testId)

  // Apply variant based on test type (matches cron logic)
  const testType = (test.test_type as string) ?? 'thumbnail'
  const youtubeVideoId = video.youtube_video_id as string

  const applyResult = await applyVariantToYouTube({
    youtubeVideoId,
    accessToken,
    testType: testType as 'thumbnail' | 'title' | 'description' | 'combo',
    variant: {
      id: nextVariant.id,
      blob_url: nextVariant.blob_url,
      title_text: nextVariant.title_text,
      description_text: nextVariant.description_text,
    },
    originalTitle: test.original_title as string | null,
    originalDescription: test.original_description as string | null,
  })

  if (!applyResult.ok) return { ok: false, error: applyResult.error ?? 'apply failed' }
  const appliedMeta: Record<string, unknown> = { trigger: 'manual', ...applyResult.meta }

  // Close old cycle + open new cycle AFTER YouTube confirms
  await supabase
    .from('ab_test_cycles')
    .update({ ended_at: new Date().toISOString() })
    .eq('test_id', testId)
    .is('ended_at', null)

  await supabase.from('ab_test_cycles').insert({
    test_id: testId,
    variant_id: nextVariant.id,
    cycle_number: nextCycle,
    started_at: new Date().toISOString(),
    applied_metadata: Object.keys(appliedMeta).length ? appliedMeta : null,
  })

  // Clear write-ahead marker after success
  await supabase
    .from('ab_tests')
    .update({ last_applied_variant_id: null })
    .eq('id', testId)

  revalidateTag('ab-tests')
  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// applyWinnerNow — Manual early apply (skips grace period)
// ---------------------------------------------------------------------------

export async function applyWinnerNow(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, winner_variant_id, youtube_video_id, test_type, original_title, original_description, grace_expires_at, winner_applied_at')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test || !test.winner_variant_id || test.winner_applied_at) {
    return { ok: false, error: 'Test not in grace period or already applied' }
  }

  // Get winner variant
  const { data: variant } = await supabase
    .from('ab_test_variants')
    .select('id, blob_url, title_text, description_text, is_original')
    .eq('id', test.winner_variant_id)
    .single()

  if (!variant) return { ok: false, error: 'Winner variant not found' }

  // Get channel for preflight
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('channel_id')
    .eq('site_id', siteId)
    .limit(1)
    .single()

  // Pre-flight check
  const preflight = await preflightTokenCheck(siteId, 'youtube', channel?.channel_id as string | undefined)
  if (!preflight.ok) return { ok: false, error: `Token inválido: ${preflight.reason}` }

  // Get YouTube video ID
  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', test.youtube_video_id)
    .single()

  if (!video?.youtube_video_id) return { ok: false, error: 'Video not found' }

  // Apply based on test_type
  const testType = test.test_type as string
  const applyResult = await applyVariantToYouTube({
    youtubeVideoId: video.youtube_video_id as string,
    accessToken: preflight.accessToken,
    testType: testType as 'thumbnail' | 'title' | 'description' | 'combo',
    variant: {
      id: variant.id as string,
      blob_url: variant.blob_url as string | null,
      title_text: variant.title_text as string | null,
      description_text: variant.description_text as string | null,
    },
    originalTitle: test.original_title as string | null,
    originalDescription: test.original_description as string | null,
  })

  if (!applyResult.ok) {
    return { ok: false, error: `YouTube API error: ${applyResult.error}` }
  }

  // Close the open cycle
  await supabase
    .from('ab_test_cycles')
    .update({ ended_at: new Date().toISOString() })
    .eq('test_id', testId)
    .is('ended_at', null)

  // Mark applied
  await supabase
    .from('ab_tests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_reason: 'manual_apply',
      winner_applied_at: new Date().toISOString(),
      applied_by: 'manual',
      revert_expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      grace_expires_at: null,
    })
    .eq('id', testId)

  // Auto-import winning thumbnail to library
  try {
    await autoImportWinner(testId, siteId)
  } catch {
    // Non-fatal — library import failure shouldn't block test completion
  }

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// cancelGracePeriod — Cancel auto-apply, complete without applying winner
// ---------------------------------------------------------------------------

export async function cancelGracePeriod(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Guard: ensure test is actually in grace period
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, status, grace_expires_at')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test || !test.grace_expires_at || test.status !== 'active') {
    return { ok: false, error: 'Test not in grace period' }
  }

  await supabase
    .from('ab_tests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_reason: 'manual_no_apply',
      grace_expires_at: null,
    })
    .eq('id', testId)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// revertWinner — Restore original (7-day window)
// ---------------------------------------------------------------------------

export async function revertWinner(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, youtube_video_id, test_type, original_thumbnail_url, original_title, original_description, revert_expires_at, winner_applied_at')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test || !test.winner_applied_at) {
    return { ok: false, error: 'Test has no applied winner' }
  }

  if (!test.revert_expires_at || new Date(test.revert_expires_at as string) < new Date()) {
    return { ok: false, error: 'Revert window expired (7 days)' }
  }

  // Get channel for preflight
  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('channel_id')
    .eq('site_id', siteId)
    .limit(1)
    .single()

  const preflight = await preflightTokenCheck(siteId, 'youtube', channel?.channel_id as string | undefined)
  if (!preflight.ok) return { ok: false, error: `Token inválido: ${preflight.reason}` }

  const { data: video } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', test.youtube_video_id)
    .single()

  if (!video?.youtube_video_id) return { ok: false, error: 'Video not found' }

  const testType = test.test_type as string
  try {
    if ((testType === 'thumbnail' || testType === 'combo') && test.original_thumbnail_url) {
      const { buffer, contentType } = await fetchVariantImageBuffer(test.original_thumbnail_url as string)
      await setThumbnail(video.youtube_video_id as string, buffer, contentType, preflight.accessToken)
    }
    if (testType === 'title' || testType === 'description' || testType === 'combo') {
      await updateVideoMetadata(
        video.youtube_video_id as string,
        test.original_title as string | null,
        test.original_description as string | null,
        preflight.accessToken,
      )
    }
  } catch (err) {
    return { ok: false, error: `YouTube API error: ${(err as Error).message}` }
  }

  // Clear applied state
  await supabase
    .from('ab_tests')
    .update({
      winner_applied_at: null,
      revert_expires_at: null,
      applied_by: null,
    })
    .eq('id', testId)

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true }
}

// ---------------------------------------------------------------------------
// fetchAbBriefingData
// ---------------------------------------------------------------------------

export async function fetchAbBriefingData(
  videoId: string,
  testId: string = '',
): Promise<{ ok: true; data: AbBriefingData } | { ok: false; error: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch {
    return { ok: false, error: 'Sem permissão' }
  }
  const supabase = getSupabaseServiceClient()

  const { data: video, error: videoError } = await supabase
    .from('youtube_videos')
    .select('id, youtube_video_id, title, thumbnail_url, ctr, avg_view_percentage, channel_id, last_analytics_sync_at')
    .eq('id', videoId)
    .eq('site_id', siteId)
    .single()

  if (videoError || !video) return { ok: false, error: 'Vídeo não encontrado' }

  const { data: channel } = await supabase
    .from('youtube_channels')
    .select('name, subscriber_count, locale')
    .eq('id', video.channel_id as string)
    .eq('site_id', siteId)
    .maybeSingle()

  const subscribers = (channel?.subscriber_count as number | null) ?? 0
  const tier = getChannelTier(subscribers)
  const locale = ((channel?.locale as string | null) === 'en' ? 'en' : 'pt') satisfies 'pt' | 'en'

  const ctr = (video.ctr as number | null)
  const avgViewPercentage = (video.avg_view_percentage as number | null)

  let score: number | null = null
  let grade: string | null = null
  if (ctr !== null && avgViewPercentage !== null) {
    const result = scoreForPrompt(ctr, avgViewPercentage)
    score = result.score
    grade = result.grade
  }

  const testHistory = await _getVideoTestHistory(video.youtube_video_id as string)
  const historyForBriefing = testHistory
    .filter(t => t.status === 'completed')
    .map(t => ({
      test_type: t.test_type,
      winner_label: t.winner_label,
      ctr_lift_percent: t.ctr_lift_percent,
    }))

  const lastSyncedAt = (video.last_analytics_sync_at as string | null) ?? new Date().toISOString()
  const snapshotAgeHours = Math.round(((Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000) * 10) / 10

  return {
    ok: true,
    data: {
      channel: {
        name: (channel?.name as string | null) ?? 'Canal',
        subscribers,
        tier,
      },
      locale,
      testId,
      video: {
        youtubeVideoId: video.youtube_video_id as string,
        title: video.title as string,
        thumbnailUrl: (video.thumbnail_url as string | null),
        ctr,
        avgViewPercentage,
        score,
        grade,
      },
      testHistory: historyForBriefing,
      snapshotAgeHours,
    },
  }
}

// ---------------------------------------------------------------------------
// fetchAbTestVariants — CMS session-authenticated variant polling
// ---------------------------------------------------------------------------

export async function fetchAbTestVariants(
  testId: string,
): Promise<Array<{
  label: string
  is_original: boolean
  title_text: string | null
  description_text: string | null
  metadata: Record<string, unknown> | null
}>> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: test } = await supabase
    .from('ab_tests')
    .select('id')
    .eq('id', testId)
    .eq('site_id', siteId)
    .single()

  if (!test) return []

  const { data: variants } = await supabase
    .from('ab_test_variants')
    .select('label, is_original, title_text, description_text, metadata')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  return (variants ?? []).map(v => ({
    label: v.label as string,
    is_original: v.is_original as boolean,
    title_text: v.title_text as string | null,
    description_text: v.description_text as string | null,
    metadata: v.metadata as Record<string, unknown> | null,
  }))
}

// ---------------------------------------------------------------------------
// batchStartTests — create draft tests for multiple suggested videos
// ---------------------------------------------------------------------------

export async function batchStartTests(
  videoIds: string[],
): Promise<{ ok: boolean; created: number; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, created: 0, error: (e as Error).message }
  }

  if (videoIds.length < 2 || videoIds.length > 5) {
    return { ok: false, created: 0, error: 'Select 2-5 videos' }
  }

  const supabase = getSupabaseServiceClient()

  // Validate all videos are eligible (no active/draft/paused test)
  const { data: existingTests } = await supabase
    .from('ab_tests')
    .select('youtube_video_id')
    .eq('site_id', siteId)
    .in('status', ['draft', 'active', 'paused', 'queued'])
    .in('youtube_video_id', videoIds)

  const ineligible = new Set((existingTests ?? []).map(t => t.youtube_video_id))
  const eligible = videoIds.filter(id => !ineligible.has(id))

  if (eligible.length === 0) {
    return { ok: false, created: 0, error: 'All videos already have active tests' }
  }

  let created = 0

  for (const videoId of eligible) {
    const { data: video } = await supabase
      .from('youtube_videos')
      .select('id, title, thumbnail_hq_url')
      .eq('id', videoId)
      .eq('site_id', siteId)
      .single()

    if (!video) continue

    let batchImmutableUrl: string | null = video.thumbnail_hq_url ?? null
    if (video.thumbnail_hq_url?.includes('ytimg.com')) {
      try {
        batchImmutableUrl = await preserveOriginalThumbnail(video.thumbnail_hq_url)
      } catch {
        continue
      }
    }

    const { data: test } = await supabase
      .from('ab_tests')
      .insert({
        site_id: siteId,
        youtube_video_id: videoId,
        name: `Batch: ${video.title?.slice(0, 40)}`,
        status: 'draft',
        test_type: 'thumbnail',
        original_thumbnail_url: batchImmutableUrl,
        config: {},
      })
      .select('id')
      .single()

    if (test) {
      await supabase.from('ab_test_variants').insert({
        test_id: test.id,
        label: 'original',
        is_original: true,
        blob_url: batchImmutableUrl,
        blob_key: null,
        sort_order: 0,
      })
      created++
    }
  }

  revalidatePath('/cms/youtube/ab-lab')
  return { ok: true, created }
}
