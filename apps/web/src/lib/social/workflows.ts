import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
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
// Story delivery preparation
// ---------------------------------------------------------------------------

async function prepareStoryDelivery(
  post: SocialPost,
  delivery: SocialDelivery & { template_config?: Record<string, unknown> | null },
): Promise<SocialPost> {
  if (delivery.format !== 'story') return post

  try {
    const { renderTemplate } = await import('@/lib/social/template-renderer')
    const { put } = await import('@vercel/blob')

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
        domain: 'bythiagofigueiredo.com',
        shortUrl: post.content.url ?? '',
        coverImageUrl: post.content.media_urls?.[0],
      }
      const buffer = await generateStoryImage(template as 'minimal' | 'card' | 'bold', storyData)
      const blob = await put(`stories/${post.id}-${Date.now()}.png`, buffer, {
        access: 'public',
        addRandomSuffix: false,
      })
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
  post: SocialPost,
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
    const { data: deliveries, error: delError } = await supabase
      .from('social_deliveries')
      .select('*')
      .eq('post_id', post.id)
      .in('status', ['pending', 'retrying'])

    if (delError) {
      throw new Error(`Failed to fetch deliveries: ${delError.message}`)
    }

    if (!deliveries || deliveries.length === 0) {
      await supabase
        .from('social_posts')
        .update({ status: 'completed' as PostStatus, published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', post.id)
      return
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
