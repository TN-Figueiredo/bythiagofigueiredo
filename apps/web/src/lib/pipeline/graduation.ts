import type { SupabaseClient } from '@supabase/supabase-js'
import type { SocialConfig, ContentType, PipelineSnapshot } from '@/lib/social/types'
import { DEFAULT_TIMEZONE, PIPELINE_FORMAT_TO_CONTENT_TYPE } from '@/lib/social/types'

const CONTENT_ENTITY_FK: Record<string, string> = {
  blog: 'blog_post_id',
  newsletter: 'newsletter_edition_id',
  campaign: 'campaign_id',
  video: 'youtube_video_id',
}

export interface PipelineItem {
  id: string
  code: string
  format: string
  stage: string
  language: string
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  tags: string[]
  category: string | null
  cover_image_url: string | null
  sections: Record<string, unknown> | null
  format_metadata: Record<string, unknown>
  social_config: SocialConfig | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  youtube_video_id: string | null
  social_post_id: string | null
  version: number
  created_by: string | null
}

type GraduationResult =
  | { ok: true; data: { postId: string; isDraft: boolean } }
  | { ok: false; error: string }

export function isSocialConfigComplete(config: SocialConfig | null): boolean {
  if (!config) return false
  if (!config.enabled) return false
  if (config.platforms.length === 0) return false

  if (!config.captions) return false
  for (const platform of config.platforms) {
    const captions = config.captions[platform]
    if (!captions) return false
    const hasAnyCaption = Object.values(captions).some(
      (c) => c !== undefined && c !== null && c.trim().length > 0,
    )
    if (!hasAnyCaption) return false
  }

  return true
}

export function buildPipelineSnapshot(
  item: PipelineItem,
  userId: string,
): PipelineSnapshot {
  return {
    pipeline_id: item.id,
    code: item.code,
    format: item.format,
    stage: item.stage,
    language: item.language,
    title_pt: item.title_pt,
    title_en: item.title_en,
    hook: item.hook,
    synopsis: item.synopsis,
    tags: item.tags ?? [],
    category: item.category,
    cover_image_url: item.cover_image_url,
    sections: item.sections ?? {},
    format_metadata: item.format_metadata ?? {},
    blog_post_id: item.blog_post_id,
    newsletter_edition_id: item.newsletter_edition_id,
    campaign_id: item.campaign_id,
    youtube_video_id: item.youtube_video_id,
    graduated_at: new Date().toISOString(),
    graduated_by: userId,
    version: item.version,
  }
}

export async function graduateToSocialPost(
  supabase: SupabaseClient,
  item: PipelineItem,
  siteId: string,
  timezone?: string,
): Promise<GraduationResult> {
  const contentType = PIPELINE_FORMAT_TO_CONTENT_TYPE[item.format]
  if (!contentType) {
    return { ok: false, error: `Format "${item.format}" does not support social graduation` }
  }

  const userId = item.created_by
  if (!userId) {
    return { ok: false, error: 'Pipeline item has no creator' }
  }

  if (item.social_post_id) {
    return { ok: true, data: { postId: item.social_post_id, isDraft: true } }
  }

  const config = item.social_config
  const snapshot = buildPipelineSnapshot(item, userId)
  const fkField = CONTENT_ENTITY_FK[contentType]
  const contentEntityId = fkField ? (item[fkField as keyof PipelineItem] as string | null) : null

  const configComplete = isSocialConfigComplete(config)
  const hasContentEntity = contentEntityId !== null

  // Auto-graduation: config complete + content entity linked
  if (configComplete && hasContentEntity && config) {
    try {
      const { createSocialPostFromContent } = await import('@/lib/social/create-from-content')
      const { getNextQueueSlot } = await import('@/lib/social/queue')

      const tz = timezone ?? DEFAULT_TIMEZONE
      let slot: { scheduledAt?: string } | null = null
      try {
        slot = await getNextQueueSlot(siteId, tz)
      } catch {
        // Queue fetch failed; proceed without scheduled time
      }
      const scheduledAt = slot?.scheduledAt

      const result = await createSocialPostFromContent({
        supabase,
        siteId,
        contentType,
        contentId: contentEntityId,
        config,
        origin: 'pipeline',
        scheduledAt,
        userId,
        sourcePipelineId: item.id,
        pipelineSnapshot: snapshot as unknown as Record<string, unknown>,
      })

      const { error: fkError, count: fkCount } = await supabase
        .from('content_pipeline')
        .update({ social_post_id: result.postId, is_archived: true }, { count: 'exact' })
        .eq('id', item.id)
        .eq('site_id', siteId)
        .is('social_post_id', null)

      if (fkError) {
        const { captureException } = await import('@sentry/nextjs')
        captureException(new Error(`Failed to link social post: ${fkError.message}`), {
          tags: { component: 'pipeline-graduation', path: 'fk-update' },
          extra: { pipelineId: item.id, postId: result.postId },
        })
      } else if (fkCount === 0) {
        // Another concurrent graduation won — clean up our orphan post
        await supabase.from('social_posts').delete().eq('id', result.postId)
        return { ok: false, error: 'Concurrent graduation detected — another process already graduated this item' }
      }

      const { error: historyError } = await supabase.from('content_pipeline_history').insert({
        pipeline_id: item.id,
        event_type: 'graduated',
        to_value: `social:${result.postId}`,
      })

      if (historyError) {
        const { captureException } = await import('@sentry/nextjs')
        captureException(new Error(`Failed to insert graduation history: ${historyError.message}`), {
          tags: { component: 'pipeline-graduation', path: 'history-insert' },
          extra: { pipelineId: item.id, postId: result.postId },
        })
      }

      return { ok: true, data: { postId: result.postId, isDraft: false } }
    } catch (err) {
      // Auto-graduation failed — fall through to draft path
      const { captureException } = await import('@sentry/nextjs')
      captureException(err, {
        tags: { component: 'pipeline-graduation', path: 'auto' },
        extra: { pipelineId: item.id },
      })
    }
  }

  // Draft graduation path
  const idempotencyKey = crypto.randomUUID()
  const postContent = {
    title: item.title_pt || item.title_en || '',
    description: item.hook || item.synopsis || '',
    url: '',
    hashtags: config?.hashtags ?? item.tags ?? [],
    media_urls: item.cover_image_url ? [item.cover_image_url] : [],
    captions: config?.captions ?? {},
  }

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .insert({
      site_id: siteId,
      created_by: userId,
      type: contentType === 'video' ? 'video' : 'link',
      status: 'draft',
      content: postContent,
      user_timezone: timezone ?? DEFAULT_TIMEZONE,
      idempotency_key: idempotencyKey,
      source_content_type: hasContentEntity ? contentType : null,
      source_content_id: contentEntityId,
      source_pipeline_id: item.id,
      pipeline_snapshot: snapshot,
      graduated_at: new Date().toISOString(),
      origin: 'pipeline',
      pipeline_steps: [],
    })
    .select('id')
    .single()

  if (postError || !post) {
    return { ok: false, error: `Failed to create draft social post: ${postError?.message ?? 'unknown'}` }
  }

  const postId = post.id as string

  const { error: draftFkError, count: draftFkCount } = await supabase
    .from('content_pipeline')
    .update({ social_post_id: postId, is_archived: true }, { count: 'exact' })
    .eq('id', item.id)
    .eq('site_id', siteId)
    .is('social_post_id', null)

  if (draftFkError) {
    const { captureException } = await import('@sentry/nextjs')
    captureException(new Error(`Failed to link social post: ${draftFkError.message}`), {
      tags: { component: 'pipeline-graduation', path: 'draft-fk-update' },
      extra: { pipelineId: item.id, postId },
    })
  } else if (draftFkCount === 0) {
    // Another concurrent graduation won — clean up our orphan draft
    await supabase.from('social_posts').delete().eq('id', postId)
    return { ok: false, error: 'Concurrent graduation detected — another process already graduated this item' }
  }

  const { error: draftHistoryError } = await supabase.from('content_pipeline_history').insert({
    pipeline_id: item.id,
    event_type: 'graduated_draft',
    to_value: `social:${postId}`,
  })

  if (draftHistoryError) {
    const { captureException } = await import('@sentry/nextjs')
    captureException(new Error(`Failed to insert graduation history: ${draftHistoryError.message}`), {
      tags: { component: 'pipeline-graduation', path: 'draft-history-insert' },
      extra: { pipelineId: item.id, postId },
    })
  }

  return { ok: true, data: { postId, isDraft: true } }
}
