import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { notifyStoryReady } from '@/lib/social/notifications/notify-story-ready'
import {
  decrypt,
  encrypt,
  getMasterKey,
  RETRY_DELAYS,
  type DeliveryStatus,
  type ErrorType,
  type ISocialProvider,
  type PostStatus,
  type Provider,
  type SocialConnection,
  type SocialDelivery,
  type SocialPost,
} from '@tn-figueiredo/social'
import type { OGTags } from '@tn-figueiredo/social/providers/bluesky'
import { getSocialConfig } from './config'

const SENTRY_TAG = { component: 'social-workflows' }

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createDecryptor(): (enc: string) => string {
  const key = getMasterKey()
  return (enc: string) => decrypt(enc, key)
}

async function getProvider(provider: Provider): Promise<ISocialProvider> {
  const decryptToken = createDecryptor()
  const config = getSocialConfig()

  // Provider classes are not re-exported from the main @tn-figueiredo/social
  // entrypoint; import from their source modules (workspace package).
  switch (provider) {
    case 'youtube': {
      const mod = await import('@tn-figueiredo/social/providers/youtube')
      return new mod.YouTubeProvider(decryptToken)
    }
    case 'facebook': {
      const mod = await import('@tn-figueiredo/social/providers/meta')
      return new mod.FacebookProvider(decryptToken, config.meta.appId, config.meta.appSecret)
    }
    case 'instagram': {
      const mod = await import('@tn-figueiredo/social/providers/meta')
      return new mod.InstagramProvider(decryptToken)
    }
    case 'bluesky': {
      const mod = await import('@tn-figueiredo/social/providers/bluesky')
      return new mod.BlueskyProvider(decryptToken)
    }
  }
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

export function classifyError(error: unknown): ErrorType {
  if (!(error instanceof Error)) return 'transient'

  const message = error.message.toLowerCase()
  const statusMatch = message.match(/\((\d{3})\)/)
  const statusCode = statusMatch ? Number(statusMatch[1]) : null

  // Auth errors
  if (statusCode === 401 || message.includes('unauthorized') || message.includes('token expired') || message.includes('token revoked')) {
    return 'auth'
  }

  // Permanent errors
  if (
    statusCode === 400 ||
    statusCode === 403 ||
    statusCode === 404 ||
    statusCode === 422 ||
    message.includes('bad request') ||
    message.includes('forbidden') ||
    message.includes('policy') ||
    message.includes('format')
  ) {
    return 'permanent'
  }

  // Transient errors
  if (
    statusCode === 429 ||
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 503 ||
    message.includes('rate limit') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused')
  ) {
    return 'transient'
  }

  return 'transient'
}

// ---------------------------------------------------------------------------
// Retry execution
// ---------------------------------------------------------------------------

export async function executeWithRetry(
  delivery: SocialDelivery,
  connection: SocialConnection,
  post: SocialPost,
  publishFn: ISocialProvider,
  options?: { ogData?: OGTags },
): Promise<{ status: DeliveryStatus; platformPostId?: string; platformUrl?: string; error?: string; errorType?: ErrorType }> {
  const supabase = getSupabaseServiceClient()
  const maxAttempts = Math.min(delivery.max_attempts, RETRY_DELAYS.length + 1)

  for (let attempt = delivery.attempt; attempt < maxAttempts; attempt++) {
    try {
      // Update attempt counter
      await supabase
        .from('social_deliveries')
        .update({ attempt: attempt + 1, status: attempt > 0 ? 'retrying' : 'publishing' })
        .eq('id', delivery.id)

      const result = await publishFn.publish(post, connection, delivery)

      return {
        status: 'published',
        platformPostId: result.id,
        platformUrl: result.url,
      }
    } catch (err) {
      const errorType = classifyError(err)
      const errorMessage = err instanceof Error ? err.message : String(err)

      if (errorType === 'permanent') {
        return { status: 'failed', error: errorMessage, errorType }
      }

      if (errorType === 'auth') {
        // Try token refresh
        if (publishFn.refreshToken) {
          try {
            const refreshed = await publishFn.refreshToken(connection)
            if (refreshed) {
              const key = getMasterKey()
              const newTokenEnc = encrypt(refreshed.access_token, key)

              await supabase
                .from('social_connections')
                .update({
                  access_token_enc: newTokenEnc,
                  token_expires_at: refreshed.expires_at?.toISOString() ?? null,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', connection.id)

              // Update in-memory connection for retry
              connection = { ...connection, access_token_enc: newTokenEnc }
              continue
            }
          } catch {
            // Refresh failed
          }
        }
        return { status: 'skipped', error: `Auth failed: ${errorMessage}`, errorType }
      }

      // Transient: retry with backoff if not last attempt
      if (attempt < maxAttempts - 1) {
        const delay = RETRY_DELAYS[attempt] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]!
        await sleep(delay)
        continue
      }

      return { status: 'failed', error: errorMessage, errorType }
    }
  }

  return { status: 'failed', error: 'Max attempts exceeded', errorType: 'transient' }
}

// ---------------------------------------------------------------------------
// Extended post type for multi-slide delivery
// ---------------------------------------------------------------------------

/**
 * SocialPost extended with optional story_slides from the DB.
 * The @tn-figueiredo/social package SocialPost doesn't include story_slides
 * since it's a DB-only field; callers can pass it via this extended type.
 */
export interface SocialPostWithSlides extends SocialPost {
  story_slides?: unknown[]
}

// ---------------------------------------------------------------------------
// Story delivery preparation
// ---------------------------------------------------------------------------

async function prepareStoryDelivery(
  post: SocialPostWithSlides,
  delivery: SocialDelivery & { template_config?: Record<string, unknown> | null },
): Promise<SocialPost> {
  if (delivery.format !== 'story') return post

  try {
    const { put } = await import('@vercel/blob')

    // ---------------------------------------------------------------------------
    // Multi-slide path: render each CardComposition and upload individually
    // ---------------------------------------------------------------------------
    const storySlides = post.story_slides ?? delivery.template_config?.storySlides
    if (Array.isArray(storySlides) && storySlides.length > 0) {
      const { renderMultiSlide } = await import('@/lib/social/template-renderer')
      const { CardCompositionSchema } = await import('@tn-figueiredo/links/qr')

      const validSlides = storySlides.flatMap((slide) => {
        const parsed = CardCompositionSchema.safeParse(slide)
        return parsed.success ? [parsed.data] : []
      })

      if (validSlides.length > 0) {
        const context = {
          title: post.content.title ?? '',
          description: post.content.description,
          cover_image: post.content.media_urls?.[0],
          short_url: post.content.url ?? '',
        }

        const buffers = await renderMultiSlide(validSlides, context)

        const uploadedUrls: string[] = []
        for (let i = 0; i < buffers.length; i++) {
          const slideBuffer = buffers[i]
          if (!slideBuffer) continue
          const blob = await put(
            `stories/${post.id}-slide-${i + 1}-${Date.now()}.jpg`,
            slideBuffer,
            { access: 'public', addRandomSuffix: false },
          )
          uploadedUrls.push(blob.url)
        }

        if (uploadedUrls.length > 0) {
          notifyStoryReady({
            userId: post.created_by,
            postId: post.id,
            title: post.content.title ?? '',
            imageUrl: uploadedUrls[0]!,
            shortUrl: post.content.url ?? '',
          }).catch(() => {})

          return {
            ...post,
            content: {
              ...post.content,
              media_urls: uploadedUrls,
            },
          }
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Single-slide path: render a single template composition
    // ---------------------------------------------------------------------------
    const { renderTemplate } = await import('@/lib/social/template-renderer')

    const templateId = delivery.template_config?.templateId as string | undefined

    const buffer = await renderTemplate({
      templateId,
      aspectRatio: '9:16',
      data: {
        title: post.content.title ?? '',
        description: post.content.description,
        cover_image: post.content.media_urls?.[0],
        short_url: post.content.url ?? '',
      },
    })

    const blob = await put(
      `stories/${post.id}-${Date.now()}.png`,
      buffer,
      {
        access: 'public',
        addRandomSuffix: false,
      },
    )

    // Non-blocking notification: fire and forget
    notifyStoryReady({
      userId: post.created_by,
      postId: post.id,
      title: post.content.title ?? '',
      imageUrl: blob.url,
      shortUrl: post.content.url ?? '',
    }).catch(() => {})

    return {
      ...post,
      content: {
        ...post.content,
        media_urls: [blob.url],
      },
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'prepareStoryDelivery', postId: post.id },
    })
    // Fallback: try legacy generator
    try {
      const { generateStoryImage } = await import('./story-generator')
      const { put } = await import('@vercel/blob')
      const template = (delivery.template_config?.template as string) ?? 'card'
      const storyData = {
        title: post.content.title ?? '',
        description: post.content.description,
        domain: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://bythiagofigueiredo.com').hostname,
        shortUrl: post.content.url ?? '',
        coverImageUrl: post.content.media_urls?.[0],
      }
      const buffer = await generateStoryImage(template as 'minimal' | 'card' | 'bold', storyData)
      const blob = await put(`stories/${post.id}-${Date.now()}.png`, buffer, {
        access: 'public',
        addRandomSuffix: false,
      })

      // Non-blocking notification for fallback path too
      notifyStoryReady({
        userId: post.created_by,
        postId: post.id,
        title: post.content.title ?? '',
        imageUrl: blob.url,
        shortUrl: post.content.url ?? '',
      }).catch(() => {})

      return {
        ...post,
        content: { ...post.content, media_urls: [blob.url] },
      }
    } catch (fallbackErr) {
      Sentry.captureException(fallbackErr, {
        tags: { ...SENTRY_TAG, action: 'prepareStoryDelivery:fallback', postId: post.id },
      })
      return post
    }
  }
}

// ---------------------------------------------------------------------------
// Main publish orchestration
// ---------------------------------------------------------------------------

export interface PublishOptions {
  ogData?: OGTags
}

export async function publishSocialPost(
  post: SocialPostWithSlides,
  options?: PublishOptions,
): Promise<void> {
  const supabase = getSupabaseServiceClient()

  try {
    // Step 1: Set post status to 'publishing'
    await supabase
      .from('social_posts')
      .update({ status: 'publishing' as PostStatus, updated_at: new Date().toISOString() })
      .eq('id', post.id)

    // Step 2: Get pending deliveries
    let { data: deliveries, error: delError } = await supabase
      .from('social_deliveries')
      .select('*')
      .eq('post_id', post.id)
      .in('status', ['pending', 'retrying'])

    if (delError) {
      throw new Error(`Failed to fetch deliveries: ${delError.message}`)
    }

    if (!deliveries || deliveries.length === 0) {
      // Story posts with story_slides but no deliveries: auto-create Instagram delivery
      const storyPost = post as SocialPostWithSlides
      if (Array.isArray(storyPost.story_slides) && storyPost.story_slides.length > 0) {
        const { data: igConn } = await supabase
          .from('social_connections')
          .select('id')
          .eq('site_id', post.site_id)
          .eq('provider', 'instagram')
          .is('revoked_at', null)
          .limit(1)
          .single()

        if (igConn) {
          await supabase.from('social_deliveries').insert({
            post_id: post.id,
            connection_id: igConn.id,
            provider: 'instagram',
            format: 'story',
            status: 'pending',
            attempt: 0,
            max_attempts: 3,
            template_config: { storySlides: true },
          })

          const { data: retryDeliveries } = await supabase
            .from('social_deliveries')
            .select('*')
            .eq('post_id', post.id)
            .in('status', ['pending', 'retrying'])

          if (retryDeliveries && retryDeliveries.length > 0) {
            deliveries = retryDeliveries
          }
        }
      }

      if (!deliveries || deliveries.length === 0) {
        await supabase
          .from('social_posts')
          .update({ status: 'completed' as PostStatus, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', post.id)
        return
      }
    }

    // Step 3 & 4: Process each delivery in parallel
    const results = await Promise.allSettled(
      (deliveries as unknown as (SocialDelivery & { template_config?: Record<string, unknown> | null })[]).map(async (delivery) => {
        // Get connection
        // Intentionally selecting all columns including token fields —
        // tokens are required by the provider publish flow (executeWithRetry → publishFn.publish).
        const { data: connectionData, error: connError } = await supabase
          .from('social_connections')
          .select('id, site_id, provider, account_id, account_name, access_token_enc, refresh_token_enc, page_token_enc, token_expires_at, scopes, metadata, connected_at, revoked_at, updated_at')
          .eq('id', delivery.connection_id)
          .single()

        if (connError || !connectionData) {
          return {
            deliveryId: delivery.id,
            status: 'skipped' as DeliveryStatus,
            error: 'Connection not found',
            errorType: 'permanent' as ErrorType,
          }
        }

        const connection = connectionData as unknown as SocialConnection

        // Check if connection is revoked
        if (connection.revoked_at) {
          return {
            deliveryId: delivery.id,
            status: 'skipped' as DeliveryStatus,
            error: 'Connection has been revoked',
            errorType: 'permanent' as ErrorType,
          }
        }

        try {
          // Prepare story image for Instagram Story deliveries
          let processedPost = post
          if (delivery.format === 'story' && delivery.provider === 'instagram') {
            processedPost = await prepareStoryDelivery(post, delivery)
            if (processedPost.content.media_urls?.length) {
              await supabase
                .from('social_posts')
                .update({ content: processedPost.content, updated_at: new Date().toISOString() })
                .eq('id', post.id)
            }
          }

          // Multi-slide Instagram Story: publish each slide individually
          const mediaUrls = processedPost.content.media_urls ?? []
          if (
            delivery.format === 'story' &&
            delivery.provider === 'instagram' &&
            mediaUrls.length > 1
          ) {
            const metaMod = await import('@tn-figueiredo/social/providers/meta')
            const token = createDecryptor()(connection.page_token_enc!)
            const igUserId = (connection.metadata as { ig_user_id: string }).ig_user_id

            const results = await metaMod.publishMultiSlideStory(igUserId, token, mediaUrls, 100)
            const firstResult = results[0]
            return {
              deliveryId: delivery.id,
              status: 'published' as DeliveryStatus,
              platformPostId: firstResult?.id,
              platformUrl: firstResult?.url,
            }
          }

          const provider = await getProvider(delivery.provider)

          // Pass ogData to Bluesky provider
          const providerOptions = delivery.provider === 'bluesky' && options?.ogData
            ? { ogData: options.ogData }
            : undefined

          const result = await executeWithRetry(
            delivery,
            connection,
            processedPost,
            provider,
            providerOptions,
          )
          return { deliveryId: delivery.id, ...result }
        } catch (err) {
          return {
            deliveryId: delivery.id,
            status: 'failed' as DeliveryStatus,
            error: err instanceof Error ? err.message : String(err),
            errorType: 'transient' as ErrorType,
          }
        }
      }),
    )

    // Step 5: Update delivery statuses
    let publishedCount = 0
    let failedCount = 0

    for (const settledResult of results) {
      if (settledResult.status === 'rejected') {
        failedCount++
        continue
      }

      const result = settledResult.value
      const update: Record<string, unknown> = {
        status: result.status,
      }

      if (result.platformPostId) update.platform_post_id = result.platformPostId
      if (result.platformUrl) update.platform_url = result.platformUrl
      if (result.error) update.last_error = result.error
      if (result.errorType) update.error_type = result.errorType
      if (result.status === 'published') {
        update.published_at = new Date().toISOString()
        publishedCount++
      } else {
        failedCount++
      }

      await supabase
        .from('social_deliveries')
        .update(update)
        .eq('id', result.deliveryId)
    }

    // Step 6: Aggregate result
    let postStatus: PostStatus
    if (failedCount === 0) {
      postStatus = 'completed'
    } else if (publishedCount > 0) {
      postStatus = 'partial_failure'
    } else {
      postStatus = 'failed'
    }

    const postPatch: Record<string, unknown> = {
      status: postStatus,
      updated_at: new Date().toISOString(),
    }
    if (publishedCount > 0) {
      postPatch.published_at = new Date().toISOString()
    }

    await supabase
      .from('social_posts')
      .update(postPatch)
      .eq('id', post.id)

    // Record fan interaction for the publishing user when at least one delivery succeeded.
    // visitor_hash is derived from the author's user ID so it ties back to the same
    // identity used by the links-engine click tracker and future insights polling.
    // NOTE: interactions from actual story viewers are recorded by the social-metrics
    // cron once Instagram Insights returns per-viewer data.
    // Fire-and-forget — never throw into the main publish flow.
    if (publishedCount > 0 && post.created_by) {
      ;(async () => {
        const encoder = new TextEncoder()
        const userData = encoder.encode(post.created_by)
        const hashBuffer = await crypto.subtle.digest('SHA-256', userData)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const visitorHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

        const { error } = await supabase
          .from('fan_interactions')
          .insert({
            site_id: post.site_id,
            visitor_hash: visitorHash,
            platform: 'instagram',
            interaction_type: 'story_publish',
            post_id: post.id,
            raw: { post_type: post.type, published_count: publishedCount },
          })

        if (error) {
          Sentry.captureException(error, {
            tags: { ...SENTRY_TAG, action: 'recordFanInteraction:story_publish', postId: post.id },
          })
        }
      })().catch((fanErr: unknown) => {
        Sentry.captureException(fanErr, {
          tags: { ...SENTRY_TAG, action: 'recordFanInteraction:story_publish', postId: post.id },
        })
      })
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { ...SENTRY_TAG, action: 'publishSocialPost', postId: post.id },
    })

    await supabase
      .from('social_posts')
      .update({ status: 'failed' as PostStatus, updated_at: new Date().toISOString() })
      .eq('id', post.id)
  }
}
