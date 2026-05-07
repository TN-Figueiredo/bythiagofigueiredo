'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { uploadMediaAsset } from '@/lib/media/upload'
import {
  listMediaAssets,
  getMediaAsset,
  getMediaStats,
  getAssetUsageCount,
} from '@/lib/media/queries'
import { trackMediaUsage, removeMediaUsage } from '@/lib/media/track-usage'
import { toMediaAsset, type MediaAsset } from '@/lib/media/types'

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function requireViewScope(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

async function requireEditScope(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

// ─── Cache invalidation ────────────────────────────────────────────────────

function revalidateMedia(siteId: string, assetId?: string): void {
  revalidateTag(`media:gallery:${siteId}`)
  revalidateTag(`media:stats:${siteId}`)
  if (assetId) revalidateTag(`media:asset:${assetId}`)
  revalidatePath('/cms/media')
}

// ─── Zod schemas ────────────────────────────────────────────────────────────

const MEDIA_FOLDERS = [
  'general',
  'authors',
  'blog',
  'newsletters',
  'branding',
  'og',
  'ads',
  'links',
] as const

const ListFiltersSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS).optional(),
  search: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  includeDeleted: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

const UpdateAssetSchema = z.object({
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  folder: z.enum(MEDIA_FOLDERS).optional(),
})

const UsageResourceTypes = [
  'blog_post',
  'blog_translation',
  'newsletter_type',
  'newsletter_edition',
  'campaign_translation',
  'author',
  'site',
  'ad_campaign',
  'ad_placeholder',
  'ad_slot_creative',
  'tracked_link',
] as const

// ─── 1. listMediaAssetsAction ───────────────────────────────────────────────

export async function listMediaAssetsAction(
  filters: z.input<typeof ListFiltersSchema> = {},
): Promise<ActionResult<{ assets: MediaAsset[]; nextCursor: string | null }>> {
  try {
    const { siteId } = await requireViewScope()
    const parsed = ListFiltersSchema.safeParse(filters)
    if (!parsed.success) return { ok: false, error: 'validation_failed' }

    const result = await listMediaAssets({ siteId, ...parsed.data })
    return {
      ok: true,
      assets: result.assets.map(toMediaAsset),
      nextCursor: result.nextCursor,
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 2. getMediaAssetAction ─────────────────────────────────────────────────

export async function getMediaAssetAction(
  assetId: string,
): Promise<ActionResult<{ asset: MediaAsset; usageCount: number }>> {
  try {
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: 'invalid_id' }
    const { siteId } = await requireViewScope()
    const row = await getMediaAsset(assetId, siteId)
    if (!row) return { ok: false, error: 'not_found' }

    const usageCount = await getAssetUsageCount(assetId)
    return { ok: true, asset: toMediaAsset(row), usageCount }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 3. uploadMediaAction ───────────────────────────────────────────────────

export async function uploadMediaAction(
  formData: FormData,
): Promise<ActionResult<{ asset: MediaAsset; deduplicated: boolean }>> {
  try {
    const { siteId, userId } = await requireEditScope()

    const file = formData.get('file')
    if (!(file instanceof File)) return { ok: false, error: 'no_file' }
    if (file.size > 10_485_760) return { ok: false, error: 'file_too_large' }

    const folder = (formData.get('folder') as string) || 'general'
    const altText = (formData.get('altText') as string) || undefined
    if (altText && altText.length > 500) return { ok: false, error: 'alt_text_too_long' }
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw
      ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined

    const folderParsed = z.enum(MEDIA_FOLDERS).safeParse(folder)
    if (!folderParsed.success) return { ok: false, error: 'invalid_folder' }

    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: folderParsed.data,
      siteId,
      uploadedBy: userId,
      altText,
      tags,
    })

    if (!result.ok) return { ok: false, error: result.error }

    revalidateMedia(siteId, result.asset.id)
    return { ok: true, asset: result.asset, deduplicated: result.deduplicated }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 4. updateMediaAssetAction ──────────────────────────────────────────────

export async function updateMediaAssetAction(
  assetId: string,
  input: z.input<typeof UpdateAssetSchema>,
): Promise<ActionResult> {
  try {
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: 'invalid_id' }
    const { siteId } = await requireEditScope()
    const parsed = UpdateAssetSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'validation_failed' }

    const updates: Record<string, unknown> = {}
    if (parsed.data.altText !== undefined) updates.alt_text = parsed.data.altText
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags
    if (parsed.data.folder !== undefined) updates.folder = parsed.data.folder

    if (Object.keys(updates).length === 0)
      return { ok: false, error: 'no_changes' }

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('media_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 5. softDeleteMediaAssetAction ──────────────────────────────────────────

export async function softDeleteMediaAssetAction(
  assetId: string,
): Promise<ActionResult<{ usageWarning: number }>> {
  try {
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: 'invalid_id' }
    const { siteId } = await requireEditScope()

    const usageCount = await getAssetUsageCount(assetId)

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true, usageWarning: usageCount }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 6. bulkDeleteMediaAssetsAction ─────────────────────────────────────────

export async function bulkDeleteMediaAssetsAction(
  assetIds: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const idsParsed = z.array(z.string().uuid()).min(1).max(50).safeParse(assetIds)
    if (!idsParsed.success) return { ok: false, error: 'invalid_ids' }

    const { siteId } = await requireEditScope()
    const supabase = getSupabaseServiceClient()

    const { error, count } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
      .eq('site_id', siteId)
      .in('id', idsParsed.data)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId)
    return { ok: true, deletedCount: count ?? 0 }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 7. restoreMediaAssetAction ─────────────────────────────────────────────

export async function restoreMediaAssetAction(
  assetId: string,
): Promise<ActionResult> {
  try {
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: 'invalid_id' }
    const { siteId } = await requireEditScope()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('media_assets')
      .update({ deleted_at: null })
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 8. getMediaStatsAction ─────────────────────────────────────────────────

export async function getMediaStatsAction(): Promise<
  ActionResult<{ stats: Awaited<ReturnType<typeof getMediaStats>> }>
> {
  try {
    const { siteId } = await requireViewScope()
    const stats = await getMediaStats(siteId)
    return { ok: true, stats }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 9. trackMediaUsageAction ───────────────────────────────────────────────

export async function trackMediaUsageAction(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<ActionResult> {
  try {
    if (!z.string().uuid().safeParse(assetId).success || !z.string().uuid().safeParse(resourceId).success)
      return { ok: false, error: 'invalid_id' }
    await requireEditScope()

    const rtParsed = z.enum(UsageResourceTypes).safeParse(resourceType)
    if (!rtParsed.success)
      return { ok: false, error: 'invalid_resource_type' }

    await trackMediaUsage(assetId, rtParsed.data, resourceId, fieldName)
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 10. removeMediaUsageAction ─────────────────────────────────────────────

export async function removeMediaUsageAction(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<ActionResult> {
  try {
    if (!z.string().uuid().safeParse(assetId).success || !z.string().uuid().safeParse(resourceId).success)
      return { ok: false, error: 'invalid_id' }
    await requireEditScope()

    const rtParsed = z.enum(UsageResourceTypes).safeParse(resourceType)
    if (!rtParsed.success)
      return { ok: false, error: 'invalid_resource_type' }

    await removeMediaUsage(assetId, rtParsed.data, resourceId, fieldName)
    return { ok: true }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}
