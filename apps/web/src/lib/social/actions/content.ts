'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { decrypt, getMasterKey } from '@tn-figueiredo/social/vault'
import type { SocialConfig } from '@/lib/social/types'
import {
  checkDuplicates,
  getDuplicateWarnings,
  type DuplicateWarnings,
} from '@/lib/social/duplicate-detection'
import type { DestId } from '../destinations'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
} from './_shared'

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

const contentTypeSchema = z.enum(['blog', 'newsletter', 'campaign', 'video'])
const contentIdSchema = z.string().uuid()

const providerSchema = z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])
const deliveryFormatSchema = z.enum([
  'link_share', 'image_post', 'story', 'reel', 'link_card', 'video_share',
])
const socialConfigSchema: z.ZodType<SocialConfig> = z.object({
  enabled: z.boolean(),
  platforms: z.array(providerSchema),
  captions: z.record(z.string(), z.record(z.string(), z.string())),
  hashtags: z.array(z.string()),
  image_source: z.enum(['og_image', 'cover_image', 'custom']),
  ig_template: z.enum(['minimal', 'card', 'bold']),
  formats: z.record(z.string(), deliveryFormatSchema),
})

export async function getContentForSocialPost(
  contentType: string,
  contentId: string,
): Promise<
  | {
      ok: true
      data: {
        title: string
        url: string
        image: string | null
        excerpt: string | null
        tags: string[]
        locale: string
        contentType: string
        contentId: string
      }
    }
  | { ok: false; error: string }
> {
  const parsedType = contentTypeSchema.safeParse(contentType)
  if (!parsedType.success) return { ok: false, error: 'Invalid content type' }
  const parsedId = contentIdSchema.safeParse(contentId)
  if (!parsedId.success) return { ok: false, error: 'Invalid content ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    if (parsedType.data === 'blog') {
      const { data: rows, error: dbErr } = await supabase
        .from('blog_posts')
        .select('id, cover_image_url, blog_translations(title, slug, meta_description, locale)')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .limit(1)
      if (dbErr || !rows?.[0]) return { ok: false, error: dbErr?.message ?? 'not_found' }
      const data = rows[0]
      const record = data as unknown as Record<string, unknown>
      const translations = record.blog_translations as Array<{ title: string; slug: string; meta_description: string | null; locale: string }> | undefined
      const tx = translations?.[0]
      return {
        ok: true,
        data: {
          title: tx?.title ?? '',
          url: `${process.env.NEXT_PUBLIC_APP_URL}/blog/${tx?.slug ?? contentId}`,
          image: data.cover_image_url as string | null,
          excerpt: tx?.meta_description ?? null,
          tags: [],
          locale: tx?.locale ?? 'pt-BR',
          contentType,
          contentId,
        },
      }
    }

    if (parsedType.data === 'newsletter') {
      const { data } = await supabase
        .from('newsletter_editions')
        .select('id, subject, preview_text')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .single()
      if (!data) return { ok: false, error: 'not_found' }
      return {
        ok: true,
        data: {
          title: data.subject as string,
          url: `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/${contentId}`,
          image: null,
          excerpt: data.preview_text as string | null,
          tags: [],
          locale: 'pt-BR',
          contentType,
          contentId,
        },
      }
    }

    if (parsedType.data === 'campaign') {
      const { data: rows, error: dbErr } = await supabase
        .from('campaigns')
        .select('id, campaign_translations(slug, meta_title, meta_description, og_image_url)')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .limit(1)
      if (dbErr || !rows?.[0]) return { ok: false, error: dbErr?.message ?? 'not_found' }
      const record = rows[0] as unknown as Record<string, unknown>
      const translations = record.campaign_translations as Array<{ slug: string; meta_title: string; meta_description: string | null; og_image_url: string | null }> | undefined
      const tx = translations?.[0]
      return {
        ok: true,
        data: {
          title: tx?.meta_title ?? '',
          url: `${process.env.NEXT_PUBLIC_APP_URL}/campaigns/${tx?.slug ?? contentId}`,
          image: tx?.og_image_url ?? null,
          excerpt: tx?.meta_description ?? null,
          tags: [],
          locale: 'pt-BR',
          contentType,
          contentId,
        },
      }
    }

    return { ok: false, error: 'unsupported_content_type' }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getContentForSocialPost' } })
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

const createFromContentSchema = z.object({
  contentType: contentTypeSchema,
  contentId: contentIdSchema,
  config: socialConfigSchema,
  origin: z.enum(['manual', 'auto', 'publish_modal', 'pipeline']),
  scheduledAt: z.string().datetime().optional(),
})

export async function createFromContentAction(params: {
  contentType: string
  contentId: string
  config: Record<string, unknown>
  origin: string
  scheduledAt?: string
}): Promise<{ ok: true; data: { postId: string; shortLinkId: string | null } } | { ok: false; error: string }> {
  const parsed = createFromContentSchema.safeParse(params)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const { createSocialPostFromContent } = await import('@/lib/social/create-from-content')
    const result = await createSocialPostFromContent({
      supabase: getSupabaseServiceClient(),
      siteId,
      contentType: parsed.data.contentType,
      contentId: parsed.data.contentId,
      config: parsed.data.config,
      origin: parsed.data.origin,
      scheduledAt: parsed.data.scheduledAt,
      userId,
    })
    return { ok: true, data: result }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createFromContentAction' } })
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function scrapeOgTags(
  postId: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const idParsed = z.string().uuid().safeParse(postId)
  if (!idParsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: post, error } = await supabase
      .from('social_posts')
      .select('id, content, short_link_id')
      .eq('id', idParsed.data)
      .eq('site_id', siteId)
      .single()

    if (error || !post) return { ok: false, error: 'Post not found' }

    const contentUrl = (post.content as Record<string, unknown> | null)?.url as string | undefined
    if (!contentUrl) return { ok: false, error: 'No URL to scrape' }

    // Get an active Facebook or Instagram connection to obtain a page token
    const { data: connection } = await supabase
      .from('social_connections')
      .select('page_token_enc, access_token_enc')
      .eq('site_id', siteId)
      .is('revoked_at', null)
      .in('provider', ['facebook', 'instagram'])
      .not('page_token_enc', 'is', null)
      .limit(1)
      .single()

    if (!connection?.page_token_enc && !connection?.access_token_enc) {
      return { ok: false, error: 'No Facebook/Instagram page token available' }
    }
    const key = getMasterKey()
    const tokenEnc = (connection.page_token_enc ?? connection.access_token_enc) as string
    const pageToken = decrypt(tokenEnc, key)

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(contentUrl, pageToken)

    const { updatePipelineStep } = await import('@/lib/social/pipeline')
    const scrapeData: Record<string, unknown> = { ...result }
    if (result.status === 'ok') {
      await updatePipelineStep(supabase, idParsed.data, 'platform_prepare', 'completed', scrapeData)
    } else {
      await updatePipelineStep(supabase, idParsed.data, 'platform_prepare', 'warning', scrapeData)
    }

    return { ok: true, data: scrapeData }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'scrapeOgTags' } })
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Checks for existing social posts linked to the same CMS content and computes
 * duplicate warnings for the given target platforms.
 * Called from the composer before publish to surface conflicts.
 */
export async function checkDuplicatesAction(
  contentType: string,
  contentId: string,
  targetPlatforms: string[],
): Promise<{ ok: true; data: DuplicateWarnings } | { ok: false; error: string }> {
  const parsedType = contentTypeSchema.safeParse(contentType)
  if (!parsedType.success) return { ok: false, error: 'Invalid content type' }
  const parsedId = contentIdSchema.safeParse(contentId)
  if (!parsedId.success) return { ok: false, error: 'Invalid content ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()
    const { posts } = await checkDuplicates(supabase, parsedType.data, parsedId.data, siteId)
    const warnings = getDuplicateWarnings(posts, targetPlatforms)
    return { ok: true, data: warnings }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'checkDuplicatesAction' } })
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}

// ---------------------------------------------------------------------------
// AI caption generation, translation & best-times
// ---------------------------------------------------------------------------

export interface AICaptionResult {
  variations: string[]
  hashtags: string[]
  tone: string
  bestTime: string | null
}

export async function generateAICaption(
  destId: DestId,
  lang: 'pt' | 'en',
  source?: { title: string; excerpt: string | null; url?: string },
): Promise<ActionResult<AICaptionResult>> {
  try {
    await requireEditAccess()

    const pipelineKey = process.env.PIPELINE_COWORK_KEY
    if (!pipelineKey) return { ok: false, error: 'Pipeline key not configured' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/pipeline/social/generate-caption`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-key': pipelineKey,
      },
      body: JSON.stringify({ destId, lang, source }),
    })

    if (!response.ok) {
      return { ok: false, error: `Pipeline returned ${response.status}` }
    }

    const data = await response.json() as AICaptionResult
    return { ok: true, data }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'generateAICaption' } })
    return { ok: false, error: 'Failed to generate AI caption' }
  }
}

export async function translateCaption(
  text: string,
  from: 'pt' | 'en',
  to: 'pt' | 'en',
): Promise<ActionResult<string>> {
  try {
    await requireEditAccess()

    const pipelineKey = process.env.PIPELINE_COWORK_KEY
    if (!pipelineKey) return { ok: false, error: 'Pipeline key not configured' }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/pipeline/social/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pipeline-key': pipelineKey,
      },
      body: JSON.stringify({ text, from, to }),
    })

    if (!response.ok) {
      return { ok: false, error: `Pipeline returned ${response.status}` }
    }

    const data = await response.json() as { translated: string }
    return { ok: true, data: data.translated }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'translateCaption' } })
    return { ok: false, error: 'Failed to translate caption' }
  }
}

export async function getBestTimes(
  connectionIds: string[],
): Promise<ActionResult<Record<string, string[]>>> {
  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: site } = await supabase
      .from('sites')
      .select('social_defaults')
      .eq('id', siteId)
      .single()

    const defaults = (site?.social_defaults ?? {}) as Record<string, unknown>
    const bestTimes = (defaults.best_times ?? {}) as Record<string, string[]>

    const { data: connections } = await supabase
      .from('social_connections')
      .select('id, provider')
      .in('id', connectionIds)

    const result: Record<string, string[]> = {}
    for (const conn of (connections ?? []) as Array<{ id: string; provider: string }>) {
      result[conn.provider] = bestTimes[conn.provider] ?? ['09:00', '12:00', '18:00']
    }

    return { ok: true, data: result }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getBestTimes' } })
    return { ok: false, error: 'Failed to get best times' }
  }
}
