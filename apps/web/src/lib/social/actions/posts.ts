'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { after } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import {
  SocialPostContentSchema,
  type Provider,
  type PostType,
  type PostStatus,
  type SocialPost,
  type SocialDelivery,
} from '@tn-figueiredo/social'
import { decrypt, getMasterKey } from '@tn-figueiredo/social/vault'
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
import { publishSocialPost } from '../workflows'
import type { SocialPostWithSlides } from '../workflows'

type ExtendedPostType = PostType | 'poll' | 'manual'

// ---------------------------------------------------------------------------
// Post management
// ---------------------------------------------------------------------------

const createPostSchema = z.object({
  type: z.enum(['link', 'video', 'image', 'text', 'poll', 'manual']),
  content: SocialPostContentSchema,
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])).min(1),
  scheduledAt: z.string().datetime().optional(),
  userTimezone: z.string().optional(),
  templateId: z.string().optional(),
  storyMode: z.boolean().optional(),
  publishNow: z.boolean().optional(),
  sourceContentId: z.string().uuid().optional(),
  sourceContentType: z.enum(['blog', 'newsletter', 'campaign', 'video']).optional(),
})

export async function createSocialPost(data: {
  type: ExtendedPostType
  content: z.infer<typeof SocialPostContentSchema>
  platforms: Provider[]
  scheduledAt?: string
  userTimezone?: string
  templateId?: string
  storyMode?: boolean
  publishNow?: boolean
  sourceContentId?: string
  sourceContentType?: 'blog' | 'newsletter' | 'campaign' | 'video'
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()
    const ctx = await getSiteContext()

    const status: PostStatus = parsed.data.scheduledAt
      ? 'scheduled'
      : parsed.data.publishNow
        ? 'publishing'
        : 'draft'
    const idempotencyKey = crypto.randomUUID()

    const postRow: Record<string, unknown> = {
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

    if (parsed.data.sourceContentId) {
      postRow.source_content_id = parsed.data.sourceContentId
    }
    if (parsed.data.sourceContentType) {
      postRow.source_content_type = parsed.data.sourceContentType
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
          : conn.provider === 'instagram'
            ? 'image_post'
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

    // Trigger publish workflow when publishNow is set (and not scheduled)
    if (parsed.data.publishNow && !parsed.data.scheduledAt) {
      // Re-fetch the full post row to build SocialPostWithSlides
      const { data: fullPost } = await supabase
        .from('social_posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (fullPost) {
        const now = new Date().toISOString()
        const row = fullPost as Record<string, unknown>
        const socialPost: SocialPostWithSlides = {
          id: postId,
          site_id: siteId,
          created_by: userId,
          type: (row.type as PostType) ?? parsed.data.type,
          status: 'publishing',
          content: parsed.data.content,
          scheduled_at: null,
          user_timezone: (row.user_timezone as string) ?? parsed.data.userTimezone ?? 'America/Sao_Paulo',
          published_at: null,
          template_id: (row.template_id as string) ?? null,
          idempotency_key: (row.idempotency_key as string) ?? idempotencyKey,
          created_at: (row.created_at as string) ?? now,
          updated_at: now,
        }

        after(
          publishSocialPost(socialPost).catch((err: unknown) => {
            Sentry.captureException(err, {
              tags: { ...SENTRY_TAG, action: 'createSocialPost:workflow', postId },
            })
          }),
        )
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
  type: z.enum(['link', 'video', 'image', 'text', 'poll', 'manual']).optional(),
  content: SocialPostContentSchema.optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  userTimezone: z.string().optional(),
  templateId: z.string().nullable().optional(),
})

export async function updateSocialPost(
  postId: string,
  data: {
    type?: ExtendedPostType
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

    const { error: postError, count } = await supabase
      .from('social_posts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() }, { count: 'exact' })
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .in('status', ['draft', 'scheduled', 'publishing'])

    if (postError) {
      Sentry.captureException(postError, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
      return { ok: false, error: postError.message }
    }

    if (count === 0) return { ok: false, error: 'Post not found' }

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

    const { data: post } = await supabase
      .from('social_posts')
      .select('id')
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .single()

    if (!post) return { ok: false, error: 'Post not found' }

    const { data: deliveries } = await supabase
      .from('social_deliveries')
      .select('id, provider, platform_post_id, connection_id, status')
      .eq('post_id', parsed.data)
      .eq('status', 'published')

    if (deliveries && deliveries.length > 0) {
      const key = getMasterKey()
      const decryptFn = (enc: string) => decrypt(enc, key)

      const connectionIds = [...new Set(deliveries.map((d) => d.connection_id as string))]
      const { data: connections } = await supabase
        .from('social_connections')
        .select('*')
        .in('id', connectionIds)

      const connMap = new Map(
        (connections ?? []).map((c) => [c.id as string, toSocialConnection(c as Record<string, unknown>)]),
      )

      for (const delivery of deliveries) {
        if (!delivery.platform_post_id) continue

        try {
          const conn = connMap.get(delivery.connection_id as string)
          if (!conn) continue

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
    const { siteId: authorizedSiteId } = await requireEditAccess()
    if (idParsed.data !== authorizedSiteId) return { ok: false, error: 'forbidden' }
    const supabase = getSupabaseServiceClient()

    let query = supabase
      .from('social_posts')
      .select('*')
      .eq('site_id', authorizedSiteId)
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
// Batch queue reorder
// ---------------------------------------------------------------------------

export async function reorderQueuePosts(
  updates: Array<{ postId: string; scheduledAt: string }>,
): Promise<ActionResult<void>> {
  const schemaParsed = z.array(
    z.object({ postId: z.string().uuid(), scheduledAt: z.string().datetime() }),
  ).min(1).safeParse(updates)
  if (!schemaParsed.success) return { ok: false, error: zodError(schemaParsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const results = await Promise.all(
      schemaParsed.data.map(({ postId, scheduledAt }) =>
        supabase
          .from('social_posts')
          .update({ scheduled_at: scheduledAt, updated_at: new Date().toISOString() })
          .eq('id', postId)
          .eq('site_id', siteId)
          .eq('status', 'scheduled'),
      ),
    )

    const errors = results.filter((r) => r.error)
    if (errors.length > 0) {
      return { ok: false, error: 'Some updates failed' }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'reorderQueuePosts' } })
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

/* ------------------------------------------------------------------ */
/*  Task 1.6 — listFeedPostsWithDeliveries                           */
/* ------------------------------------------------------------------ */

export interface FeedPostWithDeliveries {
  post: SocialPostWithPipeline
  deliveries: Array<{
    id: string
    provider: Provider
    status: string
    platform_post_id: string | null
    format: string | null
  }>
}

const feedFiltersSchema = z.object({
  status: z.enum(['all', 'published', 'scheduled', 'failed']).default('all'),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
})

export async function listFeedPostsWithDeliveries(
  siteId: string,
  filters?: { status?: string; limit?: number; offset?: number },
): Promise<ActionResult<FeedPostWithDeliveries[]>> {
  try {
    const { siteId: authedSiteId } = await requireEditAccess()
    if (authedSiteId !== siteId) return { ok: false, error: 'forbidden' }

    const parsed = feedFiltersSchema.safeParse(filters ?? {})
    if (!parsed.success) return { ok: false, error: zodError(parsed.error) }
    const { status, limit, offset } = parsed.data

    const supabase = getSupabaseServiceClient()
    let query = supabase
      .from('social_posts')
      .select('*, social_deliveries(*)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status === 'published') query = query.eq('status', 'completed')
    else if (status === 'scheduled') query = query.eq('status', 'scheduled')
    else if (status === 'failed') query = query.eq('status', 'failed')

    const { data, error } = await query

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listFeedPostsWithDeliveries' } })
      return { ok: false, error: error.message }
    }

    const results: FeedPostWithDeliveries[] = (data ?? []).map((row: Record<string, unknown>) => ({
      post: toSocialPost(row),
      deliveries: ((row.social_deliveries ?? []) as Array<Record<string, unknown>>).map(d => ({
        id: String(d.id),
        provider: d.provider as Provider,
        status: String(d.status),
        platform_post_id: (d.platform_post_id as string) ?? null,
        format: (d.format as string) ?? null,
      })),
    }))

    return { ok: true, data: results }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listFeedPostsWithDeliveries' } })
    return { ok: false, error: 'Failed to list feed posts' }
  }
}

/* ------------------------------------------------------------------ */
/*  Task 1.7 — listCalendarEvents                                     */
/* ------------------------------------------------------------------ */

export interface CalendarEvent {
  postId: string
  title: string
  provider: Provider
  destId: string | null
  status: string
  scheduledAt: string
  tint: string
}

const calendarParamsSchema = z.object({
  siteId: z.string().uuid(),
  from: z.string().min(1),
  to: z.string().min(1),
})

export async function listCalendarEvents(
  siteId: string,
  from: string,
  to: string,
): Promise<ActionResult<CalendarEvent[]>> {
  const paramsParsed = calendarParamsSchema.safeParse({ siteId, from, to })
  if (!paramsParsed.success) return { ok: false, error: zodError(paramsParsed.error) }

  try {
    const { siteId: authedSiteId } = await requireEditAccess()
    if (authedSiteId !== paramsParsed.data.siteId) return { ok: false, error: 'forbidden' }

    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('social_posts')
      .select('id, content, status, scheduled_at, published_at, social_deliveries(provider, status)')
      .eq('site_id', siteId)
      .or(`and(scheduled_at.gte.${from},scheduled_at.lte.${to}),and(published_at.gte.${from},published_at.lte.${to})`)
      .in('status', ['scheduled', 'completed', 'failed', 'publishing'])
      .order('scheduled_at', { ascending: true })

    if (error) {
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listCalendarEvents' } })
      return { ok: false, error: error.message }
    }

    const { DESTINATIONS, DEST_IDS } = await import('../destinations')

    const events: CalendarEvent[] = []
    for (const row of (data ?? []) as Array<Record<string, unknown>>) {
      const content = (row.content ?? {}) as Record<string, unknown>
      const deliveries = (row.social_deliveries ?? []) as Array<Record<string, unknown>>
      const dateStr = (row.scheduled_at ?? row.published_at ?? '') as string

      for (const del of deliveries) {
        const provider = del.provider as Provider
        const dest = DEST_IDS.find(id => DESTINATIONS[id].provider === provider)
        events.push({
          postId: String(row.id),
          title: String(content.title ?? content.description ?? '(sem titulo)'),
          provider,
          destId: dest ?? null,
          status: String(row.status),
          scheduledAt: dateStr,
          tint: dest ? DESTINATIONS[dest].tint : '#888',
        })
      }
    }

    return { ok: true, data: events }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listCalendarEvents' } })
    return { ok: false, error: 'Failed to list calendar events' }
  }
}

/* ------------------------------------------------------------------ */
/*  Task 1.8 — reorderQueue                                           */
/* ------------------------------------------------------------------ */

const reorderQueueSchema = z.object({
  postId: z.string().uuid(),
  newPosition: z.number().int().min(0),
})

export async function reorderQueue(
  postId: string,
  newPosition: number,
): Promise<ActionResult> {
  const parsed = reorderQueueSchema.safeParse({ postId, newPosition })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: post, error: postErr } = await supabase
      .from('social_posts')
      .select('id, site_id, queue_position')
      .eq('id', postId)
      .single()

    if (postErr || !post) return { ok: false, error: 'Post not found' }
    if (post.site_id !== siteId) return { ok: false, error: 'forbidden' }

    const oldPosition = post.queue_position as number | null
    if (oldPosition === newPosition) return { ok: true, data: undefined }

    const { data: queued, error: queueErr } = await supabase
      .from('social_posts')
      .select('id, queue_position')
      .eq('site_id', siteId)
      .in('status', ['scheduled', 'queued'])
      .not('queue_position', 'is', null)
      .order('queue_position', { ascending: true })

    if (queueErr) return { ok: false, error: queueErr.message }

    const items = (queued ?? []) as Array<{ id: string; queue_position: number }>
    const filtered = items.filter(i => i.id !== postId)
    filtered.splice(newPosition, 0, { id: postId, queue_position: newPosition })

    await Promise.all(
      filtered.map((item, i) =>
        supabase
          .from('social_posts')
          .update({ queue_position: i })
          .eq('id', item.id)
      )
    )

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'reorderQueue' } })
    return { ok: false, error: 'Failed to reorder queue' }
  }
}

export async function duplicatePost(
  postId: string,
): Promise<ActionResult<{ id: string }>> {
  const idParsed = z.string().uuid().safeParse(postId)
  if (!idParsed.success) return { ok: false, error: 'Invalid post ID' }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data: original, error: fetchErr } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', idParsed.data)
      .single()

    if (fetchErr || !original) return { ok: false, error: 'Post not found' }
    if (original.site_id !== siteId) return { ok: false, error: 'forbidden' }

    const newRow = {
      site_id: siteId,
      created_by: userId,
      type: original.type,
      status: 'draft' as const,
      content: original.content,
      template_id: original.template_id,
      idempotency_key: crypto.randomUUID(),
      user_timezone: original.user_timezone,
      origin: 'manual',
    }

    const { data: newPost, error: insertErr } = await supabase
      .from('social_posts')
      .insert(newRow)
      .select('id')
      .single()

    if (insertErr) {
      Sentry.captureException(insertErr, { tags: { ...SENTRY_TAG, action: 'duplicatePost' } })
      return { ok: false, error: insertErr.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: newPost!.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'duplicatePost' } })
    return { ok: false, error: 'Failed to duplicate post' }
  }
}

const createAutoDraftSchema = z.object({
  contentId: z.string().min(1),
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])).min(1),
})

export async function createAutoDraft(
  contentId: string,
  platforms: Provider[],
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAutoDraftSchema.safeParse({ contentId, platforms })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const postRow = {
      site_id: siteId,
      created_by: userId,
      type: 'text' as const,
      status: 'draft' as const,
      content: { title: '', description: '' },
      idempotency_key: crypto.randomUUID(),
      user_timezone: 'America/Sao_Paulo',
      origin: 'auto',
      source_content_id: contentId,
    }

    const { data: post, error: insertErr } = await supabase
      .from('social_posts')
      .insert(postRow)
      .select('id')
      .single()

    if (insertErr) {
      Sentry.captureException(insertErr, { tags: { ...SENTRY_TAG, action: 'createAutoDraft' } })
      return { ok: false, error: insertErr.message }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: post!.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createAutoDraft' } })
    return { ok: false, error: 'Failed to create auto draft' }
  }
}
