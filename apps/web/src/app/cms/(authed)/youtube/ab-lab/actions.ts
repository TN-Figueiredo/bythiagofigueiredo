'use server'

import { revalidateTag } from 'next/cache'
import { put } from '@vercel/blob'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { AB_TEST_CONFIG_DEFAULTS } from '@/lib/youtube/ab-types'
import type { AbTestCreateInput } from '@/lib/youtube/ab-types'

const VARIANT_LABELS = ['variant_b', 'variant_c', 'variant_d'] as const

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

  // Insert test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .insert({
      site_id: siteId,
      youtube_video_id: input.youtube_video_id,
      name: input.name,
      status: 'draft',
      config,
      original_thumbnail_url: video.thumbnail_hq_url ?? null,
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
    blob_url: video.thumbnail_hq_url ?? null,
    blob_key: null,
    sort_order: 0,
  })

  if (variantError) {
    // Roll back the test row on variant insert failure
    await supabase.from('ab_tests').delete().eq('id', test.id)
    return { ok: false, error: variantError.message }
  }

  revalidateTag('youtube')
  return { ok: true, id: test.id }
}

// ---------------------------------------------------------------------------
// uploadVariant
// ---------------------------------------------------------------------------

export async function uploadVariant(
  testId: string,
  formData: FormData,
): Promise<{ ok: boolean; variantId?: string; error?: string }> {
  try {
    await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load test and assert draft status
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', testId)
    .single()

  if (testError || !test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be added to draft tests' }

  // Get file from FormData
  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { ok: false, error: 'No file provided' }

  // Validate type and size
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return { ok: false, error: 'File must be JPEG, PNG, or WebP' }
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
    })
    .select('id')
    .single()

  if (insertError || !variant) {
    return { ok: false, error: insertError?.message ?? 'Failed to insert variant' }
  }

  revalidateTag('youtube')
  return { ok: true, variantId: variant.id }
}

// ---------------------------------------------------------------------------
// deleteVariant
// ---------------------------------------------------------------------------

export async function deleteVariant(
  variantId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const supabase = getSupabaseServiceClient()

  // Load variant
  const { data: variant, error: variantError } = await supabase
    .from('ab_test_variants')
    .select('id, test_id, is_original, blob_key')
    .eq('id', variantId)
    .single()

  if (variantError || !variant) return { ok: false, error: 'Variant not found' }
  if (variant.is_original) return { ok: false, error: 'Cannot delete the original variant' }

  // Load parent test
  const { data: test, error: testError } = await supabase
    .from('ab_tests')
    .select('id, status')
    .eq('id', variant.test_id)
    .single()

  if (testError || !test) return { ok: false, error: 'Parent test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Variants can only be deleted from draft tests' }

  // Delete blob if present
  if (variant.blob_key) {
    const { del } = await import('@vercel/blob')
    await del(variant.blob_key)
  }

  // Delete variant row
  const { error: deleteError } = await supabase
    .from('ab_test_variants')
    .delete()
    .eq('id', variantId)

  if (deleteError) return { ok: false, error: deleteError.message }

  revalidateTag('youtube')
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
  return { ok: true, added }
}
