// apps/web/src/lib/social/create-from-content.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import type {
  ContentType,
  DeliveryFormat,
  Origin,
  SocialConfig,
} from './types'
import { CONTENT_FORMAT_MAP } from './types'
import { extractContentMetadata } from './content-metadata'
import { createInitialPipelineSteps } from './pipeline'

interface CreateParams {
  supabase: SupabaseClient
  siteId: string
  contentType: ContentType
  contentId: string
  config: SocialConfig
  origin: Origin
  scheduledAt?: string
  userId: string
}

interface CreateResult {
  postId: string
  shortLinkId: string | null
}

export async function createSocialPostFromContent(
  params: CreateParams,
): Promise<CreateResult> {
  const {
    supabase,
    siteId,
    contentType,
    contentId,
    config,
    origin,
    scheduledAt,
    userId,
  } = params

  const metadata = await extractContentMetadata(supabase, contentType, contentId, siteId)

  // Re-publish guard — scoped to site_id to prevent cross-site matches
  const { data: existing } = await supabase
    .from('social_posts')
    .select('id, status')
    .eq('site_id', siteId)
    .eq('source_content_type', contentType)
    .eq('source_content_id', contentId)
    .in('status', ['draft', 'scheduled', 'publishing'])
    .maybeSingle()

  if (existing?.status === 'publishing') {
    throw new Error(
      'Pipeline em execucao — aguarde conclusao ou cancele',
    )
  }

  // Create tracked link
  const shortCode = generateShortCode()
  const { data: linkData, error: linkError } = await supabase
    .from('tracked_links')
    .insert({
      site_id: siteId,
      destination_url: metadata.url,
      code: shortCode,
      title: metadata.title,
      redirect_type: 301,
      source_type: 'social',
      source_id: contentId,
      utm_medium: 'social',
      utm_campaign: `${contentType}-${contentId}`,
      active: true,
    })
    .select('id, code')
    .single()

  let shortLinkId: string | null = null
  if (linkError || !linkData) {
    Sentry.captureException(
      new Error(`Failed to create tracked link: ${linkError?.message ?? 'unknown error'}`),
      { tags: { component: 'social-pipeline', action: 'create-short-link' } },
    )
  } else {
    shortLinkId = linkData.id as string
  }

  // Build social post content JSONB
  const postContent = {
    title: metadata.title,
    description: metadata.excerpt ?? '',
    url: metadata.url,
    hashtags: config.hashtags,
    media_urls: metadata.image ? [metadata.image] : [],
    captions: config.captions,
  }

  const pipelineSteps = createInitialPipelineSteps()
  const status = scheduledAt ? 'scheduled' : 'draft'
  const idempotencyKey = `${siteId}-${contentType}-${contentId}-${Date.now()}`

  let postId: string

  if (existing && (existing.status === 'draft' || existing.status === 'scheduled')) {
    postId = existing.id as string
    const { error: updateError } = await supabase
      .from('social_posts')
      .update({
        content: postContent,
        status,
        scheduled_at: scheduledAt ?? null,
        short_link_id: shortLinkId,
        pipeline_steps: pipelineSteps,
        origin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)

    if (updateError) {
      throw new Error(
        `Failed to update social post: ${updateError.message}`,
      )
    }
  } else {
    const { data: postData, error: postError } = await supabase
      .from('social_posts')
      .insert({
        site_id: siteId,
        created_by: userId,
        type: contentType === 'video' ? 'video' : 'link',
        status,
        content: postContent,
        scheduled_at: scheduledAt ?? null,
        user_timezone: 'America/Sao_Paulo',
        idempotency_key: idempotencyKey,
        source_content_type: contentType,
        source_content_id: contentId,
        origin,
        short_link_id: shortLinkId,
        pipeline_steps: pipelineSteps,
      })
      .select('id')
      .single()

    if (postError || !postData) {
      throw new Error(
        `Failed to create social post: ${postError?.message ?? 'unknown error'}`,
      )
    }

    postId = postData.id as string
  }

  // Create deliveries per platform
  const { data: connections } = await supabase
    .from('social_connections')
    .select('id, provider')
    .eq('site_id', siteId)
    .is('revoked_at', null)
    .in('provider', config.platforms)

  if (connections && connections.length > 0) {
    const deliveryRows = connections.map((conn) => {
      const provider = conn.provider as string
      const format =
        (config.formats[provider as keyof typeof config.formats] as DeliveryFormat) ??
        CONTENT_FORMAT_MAP[contentType]?.[provider as keyof (typeof CONTENT_FORMAT_MAP)[typeof contentType]] ??
        'link_share'

      const templateConfig =
        provider === 'instagram' && format === 'story'
          ? { template: config.ig_template, link_sticker: true }
          : provider === 'facebook' && format === 'link_share'
            ? { og_preview: true }
            : null

      return {
        post_id: postId,
        connection_id: conn.id as string,
        provider,
        status: 'pending' as const,
        attempt: 0,
        max_attempts: 3,
        format,
        template_config: templateConfig,
      }
    })

    const { error: deliveryError } = await supabase
      .from('social_deliveries')
      .insert(deliveryRows)

    if (deliveryError) {
      throw new Error(
        `Failed to create social deliveries: ${deliveryError.message}`,
      )
    }
  }

  // Trigger async pipeline (fire-and-forget) for immediate posts
  if (!scheduledAt) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${appUrl}/api/social/pipeline/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({ postId }),
    }).catch((err) =>
      Sentry.captureException(err, {
        tags: { component: 'social-pipeline-trigger' },
        extra: { postId },
      }),
    )
  }

  return { postId, shortLinkId }
}

function generateShortCode(length = 7): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
