'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import {
  decrypt,
  getMasterKey,
  SocialPostContentSchema,
  type Provider,
  type PostType,
  type PostStatus,
  type SocialPost,
  type SocialDelivery,
} from '@tn-figueiredo/social'
import {
  type ActionResult,
  SENTRY_TAG,
  zodError,
  requireEditAccess,
  revalidateSocialPaths,
} from './_shared'
import {
  toSocialPost,
  toSocialPosts,
  toSocialDeliveries,
  toSocialConnection,
  type SocialPostWithPipeline,
} from '../row-parsers'
import { getEditRules } from '../types'

// ---------------------------------------------------------------------------
// Post management
// ---------------------------------------------------------------------------

const createPostSchema = z.object({
  type: z.enum(['link', 'video', 'image', 'text']),
  content: SocialPostContentSchema,
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])).min(1),
  scheduledAt: z.string().datetime().optional(),
  userTimezone: z.string().optional(),
  templateId: z.string().optional(),
  storyMode: z.boolean().optional(),
})

export async function createSocialPost(data: {
  type: PostType
  content: z.infer<typeof SocialPostContentSchema>
  platforms: Provider[]
  scheduledAt?: string
  userTimezone?: string
  templateId?: string
  storyMode?: boolean
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()
    const ctx = await getSiteContext()

    const status: PostStatus = parsed.data.scheduledAt ? 'scheduled' : 'draft'
    const idempotencyKey = crypto.randomUUID()

    const postRow = {
      site_id: siteId,
      created_by: userId,
      type: parsed.data.type,
      status,
      content: parsed.data.content,
      scheduled_at: parsed.data.scheduledAt ?? null,
      user_timezone: parsed.data.userTimezone ?? ctx.timezone ?? 'America/Sao_Paulo',
      template_id: parsed.data.templateId ?? null,
      idempotency_key: idempotencyKey,
    }

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .insert(postRow)
      .select('id')
      .single()

    if (postError) {
      Sentry.captureException(postError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
      return { ok: false, error: postError.message }
    }

    const postId = post.id as string

    // Find active connections matching the requested platforms
    const { data: connections, error: connError } = await supabase
      .from('social_connections')
      .select('id, provider')
      .eq('site_id', siteId)
      .is('revoked_at', null)
      .in('provider', parsed.data.platforms)

    if (connError) {
      Sentry.captureException(connError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
      return { ok: false, error: connError.message }
    }

    if (connections && connections.length > 0) {
      const deliveryRows = connections.map((conn) => ({
        post_id: postId,
        connection_id: conn.id as string,
        provider: conn.provider as Provider,
        status: 'pending' as const,
        attempt: 0,
        max_attempts: 3,
        // Set format based on provider and post type
        format: conn.provider === 'instagram' && parsed.data.storyMode
          ? 'story'
          : conn.provider === 'bluesky'
            ? 'link_card'
            : 'link_share',
      }))

      const { error: deliveryError } = await supabase
        .from('social_deliveries')
        .insert(deliveryRows)

      if (deliveryError) {
        Sentry.captureException(deliveryError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
        return { ok: false, error: deliveryError.message }
      }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: postId } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
    throw err
  }
}

const updatePostSchema = z.object({
  type: z.enum(['link', 'video', 'image', 'text']).optional(),
  content: SocialPostContentSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  userTimezone: z.string().optional(),
  templateId: z.string().nullable().optional(),
})

export async function updateSocialPost(
  postId: string,
  data: {
    type?: PostType
    content?: z.infer<typeof SocialPostContentSchema>
    scheduledAt?: string | null
    userTimezone?: string
    templateId?: string | null
  },
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(postId)
  if (!idParsed.success) return { ok: false, error: 'Invalid post ID' }
  const parsed = updatePostSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify post exists and is editable
    const { data: existing, error: fetchError } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', idParsed.data)
      .eq('site_id', siteId)
      .single()

    if (fetchError || !existing) return { ok: false, error: 'Post not found' }

    const editableStatuses: PostStatus[] = ['draft', 'scheduled']
    if (!editableStatuses.includes(existing.status as PostStatus)) {
      return { ok: false, error: `Cannot edit post with status "${existing.status}"` }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.type !== undefined) patch.type = parsed.data.type
    if (parsed.data.content !== undefined) patch.content = parsed.data.content
    if (parsed.data.scheduledAt !== undefined) patch.scheduled_at = parsed.data.scheduledAt
    if (parsed.data.userTimezone !== undefined) patch.user_timezone = parsed.data.userTimezone
    if (parsed.data.templateId !== undefined) patch.template_id = parsed.data.templateId

    // Update status based on scheduling
    if (parsed.data.scheduledAt !== undefined) {
      patch.status = parsed.data.scheduledAt ? 'scheduled' : 'draft'
    }

    const { error } = await supabase
      .from('social_posts')
      .update(patch)
      .eq('id', idParsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateSocialPost' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'updateSocialPost' } })
    throw err
  }
}

export async function cancelSocialPost(postId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(postId)
  if (!parsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { error: postError } = await supabase
      .from('social_posts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .in('status', ['draft', 'scheduled', 'publishing'])

    if (postError) {
      Sentry.captureException(postError, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
      return { ok: false, error: postError.message }
    }

    // Cancel pending deliveries
    const { error: deliveryError } = await supabase
      .from('social_deliveries')
      .update({ status: 'skipped' })
      .eq('post_id', parsed.data)
      .eq('status', 'pending')

    if (deliveryError) {
      Sentry.captureException(deliveryError, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
      return { ok: false, error: deliveryError.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
    throw err
  }
}

export async function deleteSocialPost(postId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(postId)
  if (!parsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Get post with deliveries to check if anything was published
    const { data: deliveries } = await supabase
      .from('social_deliveries')
      .select('id, provider, platform_post_id, connection_id, status')
      .eq('post_id', parsed.data)
      .eq('status', 'published')

    // For published deliveries, attempt platform deletion
    if (deliveries && deliveries.length > 0) {
      const key = getMasterKey()
      const decryptFn = (enc: string) => decrypt(enc, key)

      for (const delivery of deliveries) {
        if (!delivery.platform_post_id) continue

        try {
          const { data: connection } = await supabase
            .from('social_connections')
            .select('*')
            .eq('id', delivery.connection_id)
            .single()

          if (!connection) continue

          const conn = toSocialConnection(connection as Record<string, unknown>)
          const provider = delivery.provider as Provider

          switch (provider) {
            case 'youtube': {
              const mod = await import('@tn-figueiredo/social/providers/youtube')
              const accessToken = decryptFn(conn.access_token_enc)
              await mod.deleteVideo({ accessToken }, delivery.platform_post_id)
              break
            }
            case 'facebook': {
              if (!conn.page_token_enc) break
              const mod = await import('@tn-figueiredo/social/providers/meta')
              const pageToken = decryptFn(conn.page_token_enc)
              await mod.deletePagePost(delivery.platform_post_id, pageToken)
              break
            }
            case 'instagram': {
              if (!conn.page_token_enc) break
              const mod = await import('@tn-figueiredo/social/providers/meta')
              const token = decryptFn(conn.page_token_enc)
              await mod.deleteInstagramMedia(delivery.platform_post_id, token)
              break
            }
            case 'bluesky':
              // Bluesky post deletion requires AT Protocol session — handled separately
              break
            default: {
              const _exhaustive: never = provider
              Sentry.captureMessage(`Unhandled provider in delete: ${_exhaustive}`, {
                level: 'warning',
                tags: { ...SENTRY_TAG, action: 'deleteSocialPost' },
              })
            }
          }
        } catch (deleteErr) {
          Sentry.captureException(deleteErr, {
            tags: { ...SENTRY_TAG, action: 'deleteSocialPost', step: 'platform-delete' },
            extra: { deliveryId: delivery.id, provider: delivery.provider },
          })
        }
      }
    }

    // Delete deliveries then post
    const { error: delError } = await supabase
      .from('social_deliveries')
      .delete()
      .eq('post_id', parsed.data)

    if (delError) {
      Sentry.captureException(delError, { tags: { ...SENTRY_TAG, action: 'deleteSocialPost' } })
      return { ok: false, error: delError.message }
    }

    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', parsed.data)
      .eq('site_id', siteId)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'deleteSocialPost' } })
      return { ok: false, error: error.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'deleteSocialPost' } })
    throw err
  }
}

export async function retrySocialDelivery(
  deliveryId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(deliveryId)
  if (!parsed.success) return { ok: false, error: 'Invalid delivery ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify delivery belongs to a post owned by this site
    const { data: delivery } = await supabase
      .from('social_deliveries')
      .select('id, post_id, status')
      .eq('id', parsed.data)
      .single()

    if (!delivery) return { ok: false, error: 'Delivery not found' }

    const { data: post } = await supabase
      .from('social_posts')
      .select('id')
      .eq('id', delivery.post_id as string)
      .eq('site_id', siteId)
      .single()

    if (!post) return { ok: false, error: 'forbidden' }

    const retryableStatuses = ['failed', 'skipped']
    if (!retryableStatuses.includes(delivery.status as string)) {
      return { ok: false, error: `Cannot retry delivery with status "${delivery.status}"` }
    }

    const { error } = await supabase
      .from('social_deliveries')
      .update({
        status: 'pending',
        attempt: 0,
        last_error: null,
        error_type: null,
      })
      .eq('id', parsed.data)

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'retrySocialDelivery' } })
      return { ok: false, error: error.message }
    }

    await supabase
      .from('social_posts')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', delivery.post_id as string)
      .eq('site_id', siteId)
      .in('status', ['failed', 'partial_failure'])

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'retrySocialDelivery' } })
    throw err
  }
}

export async function getSocialPost(
  postId: string,
): Promise<ActionResult<SocialPostWithPipeline & { deliveries: SocialDelivery[] }>> {
  const parsed = z.string().uuid().safeParse(postId)
  if (!parsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .single()

    if (postError || !post) return { ok: false, error: 'Post not found' }

    const { data: deliveries, error: delError } = await supabase
      .from('social_deliveries')
      .select('*')
      .eq('post_id', parsed.data)
      .order('created_at', { ascending: true })

    if (delError) {
      Sentry.captureException(delError, { tags: { ...SENTRY_TAG, action: 'getSocialPost' } })
      return { ok: false, error: delError.message }
    }

    return {
      ok: true,
      data: {
        ...toSocialPost(post as Record<string, unknown>),
        deliveries: toSocialDeliveries(deliveries ?? []),
      },
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getSocialPost' } })
    throw err
  }
}

const listFiltersSchema = z.object({
  status: z.enum([
    'draft', 'scheduled', 'publishing', 'completed',
    'partial_failure', 'failed', 'cancelled',
  ]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export async function listSocialPosts(
  siteId: string,
  filters?: { status?: PostStatus; from?: string; to?: string },
): Promise<ActionResult<SocialPostWithPipeline[]>> {
  const idParsed = z.string().uuid().safeParse(siteId)
  if (!idParsed.success) return { ok: false, error: 'Invalid site ID' }
  const filtersParsed = listFiltersSchema.safeParse(filters ?? {})
  if (!filtersParsed.success) return { ok: false, error: zodError(filtersParsed.error) }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('site_id', idParsed.data)
      .order('created_at', { ascending: false })

    if (filtersParsed.data.status) {
      query = query.eq('status', filtersParsed.data.status)
    }
    if (filtersParsed.data.from) {
      query = query.gte('created_at', filtersParsed.data.from)
    }
    if (filtersParsed.data.to) {
      query = query.lte('created_at', filtersParsed.data.to)
    }

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listSocialPosts' } })
      return { ok: false, error: error.message }
    }

    return { ok: true, data: toSocialPosts(data ?? []) }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listSocialPosts' } })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Edit published post (caption-only per platform rules)
// ---------------------------------------------------------------------------

const editPublishedSchema = z.object({
  caption: z.string().min(1),
})

export async function editPublishedPost(
  postId: string,
  deliveryId: string,
  data: { caption: string },
): Promise<ActionResult> {
  const idParsed = z.string().uuid().safeParse(postId)
  if (!idParsed.success) return { ok: false, error: 'Invalid post ID' }
  const deliveryParsed = z.string().uuid().safeParse(deliveryId)
  if (!deliveryParsed.success) return { ok: false, error: 'Invalid delivery ID' }
  const parsed = editPublishedSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    // Verify post belongs to this site and is published
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('id, status, site_id')
      .eq('id', idParsed.data)
      .eq('site_id', siteId)
      .single()

    if (postError || !post) return { ok: false, error: 'Post not found' }

    const completedStatuses: PostStatus[] = ['completed', 'partial_failure']
    if (!completedStatuses.includes(post.status as PostStatus)) {
      return { ok: false, error: `Cannot edit post with status "${post.status}"` }
    }

    // Get delivery
    const { data: delivery, error: delError } = await supabase
      .from('social_deliveries')
      .select('id, provider, platform_post_id, connection_id, status')
      .eq('id', deliveryParsed.data)
      .eq('post_id', idParsed.data)
      .single()

    if (delError || !delivery) return { ok: false, error: 'Delivery not found' }
    if (delivery.status !== 'published') return { ok: false, error: 'Delivery not published' }

    const provider = delivery.provider as Provider
    const rules = getEditRules(provider)

    if (rules.readOnly) {
      return { ok: false, error: rules.readOnlyReason ?? 'Platform does not support editing' }
    }

    if (!rules.canEditCaption) {
      return { ok: false, error: 'Caption editing not supported for this platform' }
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('id', delivery.connection_id)
      .single()

    if (connError || !connection) return { ok: false, error: 'Connection not found' }

    const key = getMasterKey()

    if (rules.method === 'update') {
      // Facebook: POST /{post-id} with updated message
      if (provider === 'facebook' && connection.page_token_enc) {
        const pageToken = decrypt(connection.page_token_enc as string, key)
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${delivery.platform_post_id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: parsed.data.caption,
              access_token: pageToken,
            }),
            signal: AbortSignal.timeout(10_000),
          },
        )
        if (!res.ok) {
          const body = await res.text()
          return { ok: false, error: `Facebook edit failed (${res.status}): ${body}` }
        }
      }
    } else if (rules.method === 'delete_recreate') {
      // Bluesky: delete old + create new
      if (provider === 'bluesky') {
        const conn = toSocialConnection(connection as Record<string, unknown>)

        // Delete old record (best-effort)
        if (delivery.platform_post_id) {
          try {
            await fetch(
              `${(conn.metadata as Record<string, unknown>)?.service ?? 'https://bsky.social'}/xrpc/com.atproto.repo.deleteRecord`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${decrypt(conn.access_token_enc, key)}`,
                },
                body: JSON.stringify({
                  repo: conn.account_id,
                  collection: 'app.bsky.feed.post',
                  rkey: (delivery.platform_post_id as string).split('/').pop(),
                }),
                signal: AbortSignal.timeout(10_000),
              },
            )
          } catch {
            // Best effort -- old post may already be deleted
          }
        }

        // Create new post with updated caption
        const { data: postData } = await supabase
          .from('social_posts')
          .select('*')
          .eq('id', idParsed.data)
          .single()

        if (postData) {
          const socialPost = toSocialPost(postData as Record<string, unknown>)
          const bsMod = await import('@tn-figueiredo/social/providers/bluesky')
          const bsProvider = new bsMod.BlueskyProvider((enc: string) => decrypt(enc, key))
          const updatedPost = {
            ...socialPost,
            content: { ...socialPost.content, description: parsed.data.caption },
          }
          const publishResult = await bsProvider.publish(updatedPost, conn, {
            id: delivery.id as string,
            post_id: postData.id as string,
            connection_id: conn.id,
            provider: 'bluesky',
            status: 'pending' as const,
            platform_post_id: null,
            platform_url: null,
            content_override: null,
            attempt: 0,
            max_attempts: 1,
            last_error: null,
            error_type: null,
            published_at: null,
            created_at: new Date().toISOString(),
          })

          // Update delivery with new platform_post_id
          await supabase
            .from('social_deliveries')
            .update({
              platform_post_id: publishResult.id,
              platform_url: publishResult.url,
            })
            .eq('id', delivery.id)
        }
      }
    }

    // Update post timestamp
    await supabase
      .from('social_posts')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', idParsed.data)

    // Store caption override on the delivery
    await supabase
      .from('social_deliveries')
      .update({
        content_override: { caption: parsed.data.caption },
      })
      .eq('id', delivery.id)

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'editPublishedPost' } })
    throw err
  }
}
