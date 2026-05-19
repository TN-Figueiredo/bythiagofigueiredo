'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess, type ActionResult, SENTRY_TAG, revalidateSocialPaths } from './_shared'
import { StorySlidesSchema } from '@/lib/social/story-types'
import { publishSocialPost } from '@/lib/social/workflows'
import type { SocialPostWithSlides } from '@/lib/social/workflows'

// ---------------------------------------------------------------------------
// Shared content schema for story publish actions
// ---------------------------------------------------------------------------

const StoryContentSchema = z.object({
  caption: z.string().optional(),
}).optional()

type StoryContent = z.infer<typeof StoryContentSchema>

// ---------------------------------------------------------------------------
// saveStoryDraft
//
// Upsert a social_post with status='draft', storing story_slides.
// ---------------------------------------------------------------------------

export async function saveStoryDraft(
  siteId: string,
  postId: string,
  slides: unknown[],
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'Invalid post ID' }

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()

    const patch = {
      site_id: authorizedSiteId,
      created_by: userId,
      type: 'image' as const,
      status: 'draft' as const,
      story_slides: slidesParsed.data,
      content: {
        description: content?.caption ?? '',
      },
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('social_posts')
      .upsert(
        { id: postIdParsed.data, ...patch },
        { onConflict: 'id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'saveStoryDraft' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: z.object({ id: z.string() }).parse(data).id } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'saveStoryDraft' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// publishStoryNow
//
// Set status='publishing' and trigger the publish workflow.
// ---------------------------------------------------------------------------

export async function publishStoryNow(
  siteId: string,
  postId: string,
  slides: unknown[],
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'Invalid post ID' }

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()

    // Reject if post is already being published (prevents rapid-fire duplicate calls)
    const { data: existing } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', postIdParsed.data)
      .single()
    if (existing?.status === 'publishing' || existing?.status === 'completed') {
      return { ok: false, error: existing.status === 'publishing' ? 'Publicação já em andamento.' : 'Story já publicada.' }
    }

    const upsertPatch = {
      site_id: authorizedSiteId,
      created_by: userId,
      type: 'image' as const,
      status: 'publishing' as const,
      story_slides: slidesParsed.data,
      content: {
        description: content?.caption ?? '',
      },
      updated_at: new Date().toISOString(),
    }

    const { data, error: upsertError } = await supabase
      .from('social_posts')
      .upsert(
        { id: postIdParsed.data, ...upsertPatch },
        { onConflict: 'id', ignoreDuplicates: false },
      )
      .select('*')
      .single()

    if (upsertError) {
      Sentry.captureException(upsertError, { tags: { ...SENTRY_TAG, action: 'publishStoryNow' } })
      return { ok: false, error: upsertError.message }
    }

    const postFields = z.object({
      user_timezone: z.string().nullable().default(null),
      template_id: z.string().nullable().default(null),
      idempotency_key: z.string().nullable().default(null),
      created_at: z.string().nullable().default(null),
    }).parse(data)

    const now = new Date().toISOString()
    const socialPost: SocialPostWithSlides = {
      id: postIdParsed.data,
      site_id: authorizedSiteId,
      created_by: userId,
      type: 'image',
      status: 'publishing',
      content: {
        description: content?.caption ?? '',
      },
      scheduled_at: null,
      user_timezone: postFields.user_timezone ?? 'America/Sao_Paulo',
      published_at: null,
      template_id: postFields.template_id,
      idempotency_key: postFields.idempotency_key ?? crypto.randomUUID(),
      created_at: postFields.created_at ?? now,
      updated_at: now,
      story_slides: slidesParsed.data as unknown[],
    }

    // Fire publish workflow — non-blocking so UI gets the response quickly
    publishSocialPost(socialPost).catch((err: unknown) => {
      Sentry.captureException(err, {
        tags: { ...SENTRY_TAG, action: 'publishStoryNow:workflow', postId: postIdParsed.data },
      })
    })

    revalidateSocialPaths()
    return { ok: true, data: { id: postIdParsed.data } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'publishStoryNow' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// scheduleStory
//
// Upsert with status='scheduled' and a scheduled_at timestamp.
// ---------------------------------------------------------------------------

export async function scheduleStory(
  siteId: string,
  postId: string,
  slides: unknown[],
  scheduledAt: string,
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'Invalid post ID' }

  const scheduledDate = new Date(scheduledAt)
  if (isNaN(scheduledDate.getTime())) {
    return { ok: false, error: 'Invalid scheduled date/time. Use ISO 8601 format.' }
  }
  if (scheduledDate <= new Date()) {
    return { ok: false, error: 'Scheduled time must be in the future.' }
  }
  const isoDate = scheduledDate.toISOString()

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()

    const patch = {
      site_id: authorizedSiteId,
      created_by: userId,
      type: 'image' as const,
      status: 'scheduled' as const,
      story_slides: slidesParsed.data,
      scheduled_at: isoDate,
      content: {
        description: content?.caption ?? '',
      },
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('social_posts')
      .upsert(
        { id: postIdParsed.data, ...patch },
        { onConflict: 'id', ignoreDuplicates: false },
      )
      .select('id')
      .single()

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'scheduleStory' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: z.object({ id: z.string() }).parse(data).id } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'scheduleStory' } })
    throw err
  }
}
