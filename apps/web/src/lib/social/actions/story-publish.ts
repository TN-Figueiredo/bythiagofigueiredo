'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireEditAccess, type ActionResult, SENTRY_TAG, revalidateSocialPaths } from './_shared'
import { StorySlidesSchema } from '@/lib/social/story-types'
import { after } from 'next/server'
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
// Ensure an Instagram delivery row exists for a story post.
// Without this, the publish workflow finds zero deliveries and no-ops.
// ---------------------------------------------------------------------------

async function ensureStoryDelivery(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  postId: string,
  siteId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('social_deliveries')
    .select('id, status')
    .eq('post_id', postId)
    .eq('provider', 'instagram')
    .eq('format', 'story')
    .limit(1)

  if (existing && existing.length > 0) {
    const row = existing[0]!
    if (row.status === 'failed' || row.status === 'skipped') {
      await supabase
        .from('social_deliveries')
        .update({ status: 'pending', attempt: 0, last_error: null })
        .eq('id', row.id)
    }
    return
  }

  const { data: igConn } = await supabase
    .from('social_connections')
    .select('id')
    .eq('site_id', siteId)
    .eq('provider', 'instagram')
    .is('revoked_at', null)
    .limit(1)
    .single()

  if (!igConn) {
    throw new Error('Nenhuma conta Instagram conectada. Conecte em Accounts antes de publicar.')
  }

  const { error } = await supabase.from('social_deliveries').insert({
    post_id: postId,
    connection_id: igConn.id,
    provider: 'instagram',
    format: 'story',
    status: 'pending',
    attempt: 0,
    max_attempts: 3,
    template_config: { storySlides: true },
  })

  if (error) throw new Error(`Falha ao criar delivery: ${error.message}`)
}

// ---------------------------------------------------------------------------
// saveStoryDraft
//
// Upsert a social_post with status='draft', storing story_slides.
// Guarded: refuses to overwrite posts with status 'publishing' or 'completed'.
// ---------------------------------------------------------------------------

export async function saveStoryDraft(
  siteId: string,
  postId: string,
  slides: unknown[],
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'ID do post inválido' }

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }

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

    // Try UPDATE first with status guard — prevents overwriting publishing/completed posts
    const { data: updated, error: updateError } = await supabase
      .from('social_posts')
      .update(patch)
      .eq('id', postIdParsed.data)
      .not('status', 'in', '("publishing","completed")')
      .select('id')
      .maybeSingle()

    if (updateError) {
      Sentry.captureException(updateError, { tags: { ...SENTRY_TAG, action: 'saveStoryDraft' } })
      return { ok: false, error: updateError.message }
    }

    if (updated) {
      revalidateSocialPaths()
      return { ok: true, data: { id: z.object({ id: z.string() }).parse(updated).id } }
    }

    // No row updated — either post doesn't exist (new) or status is blocked
    const { data: existing } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', postIdParsed.data)
      .maybeSingle()

    if (existing) {
      // Post exists but status is publishing/completed — reject
      return {
        ok: false,
        error: existing.status === 'publishing'
          ? 'Não é possível editar — publicação em andamento.'
          : 'Não é possível editar — story já publicada.',
      }
    }

    // Post doesn't exist yet — INSERT
    const { data: inserted, error: insertError } = await supabase
      .from('social_posts')
      .insert({ id: postIdParsed.data, ...patch })
      .select('id')
      .single()

    if (insertError) {
      Sentry.captureException(insertError, { tags: { ...SENTRY_TAG, action: 'saveStoryDraft' } })
      return { ok: false, error: insertError.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: z.object({ id: z.string() }).parse(inserted).id } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'saveStoryDraft' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// publishStoryNow
//
// Set status='publishing' and trigger the publish workflow.
// Guarded: atomic UPDATE with status filter prevents TOCTOU race conditions.
// ---------------------------------------------------------------------------

export async function publishStoryNow(
  siteId: string,
  postId: string,
  slides: unknown[],
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'ID do post inválido' }

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }

    const supabase = getSupabaseServiceClient()

    const publishPatch = {
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

    // Atomic UPDATE with status guard — prevents TOCTOU race between concurrent calls
    const { data, error: updateError } = await supabase
      .from('social_posts')
      .update(publishPatch)
      .eq('id', postIdParsed.data)
      .not('status', 'in', '("publishing","completed")')
      .select('*')
      .maybeSingle()

    let finalData = data

    if (updateError) {
      Sentry.captureException(updateError, { tags: { ...SENTRY_TAG, action: 'publishStoryNow' } })
      return { ok: false, error: updateError.message }
    }

    if (!finalData) {
      // No row updated — either post doesn't exist (new) or status is blocked
      const { data: existing } = await supabase
        .from('social_posts')
        .select('status')
        .eq('id', postIdParsed.data)
        .maybeSingle()

      if (existing) {
        // Post exists but status is publishing/completed — reject
        return {
          ok: false,
          error: existing.status === 'publishing'
            ? 'Publicação já em andamento.'
            : 'Story já publicada.',
        }
      }

      // Post doesn't exist yet — INSERT for new posts
      const { data: inserted, error: insertError } = await supabase
        .from('social_posts')
        .insert({ id: postIdParsed.data, ...publishPatch })
        .select('*')
        .single()

      if (insertError) {
        Sentry.captureException(insertError, { tags: { ...SENTRY_TAG, action: 'publishStoryNow' } })
        return { ok: false, error: insertError.message }
      }

      finalData = inserted
    }

    await ensureStoryDelivery(supabase, postIdParsed.data, authorizedSiteId)

    const postFields = z.object({
      user_timezone: z.string().nullable().default(null),
      template_id: z.string().nullable().default(null),
      idempotency_key: z.string().nullable().default(null),
      created_at: z.string().nullable().default(null),
    }).parse(finalData)

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

    // Schedule publish workflow to run after the response is sent.
    // `after()` tells Vercel to keep the function alive until the promise resolves,
    // preventing the workflow from being killed mid-execution.
    after(
      publishSocialPost(socialPost).catch((err: unknown) => {
        Sentry.captureException(err, {
          tags: { ...SENTRY_TAG, action: 'publishStoryNow:workflow', postId: postIdParsed.data },
        })
      }),
    )

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
// Guarded: refuses to overwrite posts with status 'publishing' or 'completed'.
// ---------------------------------------------------------------------------

export async function scheduleStory(
  siteId: string,
  postId: string,
  slides: unknown[],
  scheduledAt: string,
  content?: StoryContent,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'ID do site inválido' }

  const postIdParsed = z.string().uuid().safeParse(postId)
  if (!postIdParsed.success) return { ok: false, error: 'ID do post inválido' }

  const scheduledDate = new Date(scheduledAt)
  if (isNaN(scheduledDate.getTime())) {
    return { ok: false, error: 'Data/hora de agendamento inválida.' }
  }
  if (scheduledDate <= new Date()) {
    return { ok: false, error: 'O horário agendado deve ser no futuro.' }
  }
  const isoDate = scheduledDate.toISOString()

  const slidesParsed = StorySlidesSchema.safeParse(slides)
  if (!slidesParsed.success) {
    return { ok: false, error: `Invalid slides: ${slidesParsed.error.issues.map((i) => i.message).join(', ')}` }
  }

  try {
    const { siteId: authorizedSiteId, userId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'Sem permissão' }

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

    // Try UPDATE first with status guard — prevents overwriting publishing/completed posts
    const { data: updated, error: updateError } = await supabase
      .from('social_posts')
      .update(patch)
      .eq('id', postIdParsed.data)
      .not('status', 'in', '("publishing","completed")')
      .select('id')
      .maybeSingle()

    if (updateError) {
      Sentry.captureException(updateError, { tags: { ...SENTRY_TAG, action: 'scheduleStory' } })
      return { ok: false, error: updateError.message }
    }

    if (updated) {
      await ensureStoryDelivery(supabase, postIdParsed.data, authorizedSiteId)
      revalidateSocialPaths()
      return { ok: true, data: { id: z.object({ id: z.string() }).parse(updated).id } }
    }

    // No row updated — either post doesn't exist (new) or status is blocked
    const { data: existing } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', postIdParsed.data)
      .maybeSingle()

    if (existing) {
      // Post exists but status is publishing/completed — reject
      return {
        ok: false,
        error: existing.status === 'publishing'
          ? 'Não é possível agendar — publicação em andamento.'
          : 'Não é possível agendar — story já publicada.',
      }
    }

    // Post doesn't exist yet — INSERT
    const { data: inserted, error: insertError } = await supabase
      .from('social_posts')
      .insert({ id: postIdParsed.data, ...patch })
      .select('id')
      .single()

    if (insertError) {
      Sentry.captureException(insertError, { tags: { ...SENTRY_TAG, action: 'scheduleStory' } })
      return { ok: false, error: insertError.message }
    }

    await ensureStoryDelivery(supabase, postIdParsed.data, authorizedSiteId)

    revalidateSocialPaths()
    return { ok: true, data: { id: z.object({ id: z.string() }).parse(inserted).id } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'scheduleStory' } })
    throw err
  }
}
