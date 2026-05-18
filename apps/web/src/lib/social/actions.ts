'use server'

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { revalidatePath, revalidateTag } from 'next/cache'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import {
  decrypt,
  encrypt,
  getMasterKey,
  SocialPostContentSchema,
  type Provider,
  type PostType,
  type PostStatus,
  type SocialConnection,
  type SocialPost,
  type SocialDelivery,
} from '@tn-figueiredo/social'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const SENTRY_TAG = { component: 'social-actions' }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return { siteId, userId: res.user.id }
}

function revalidateSocialPaths(): void {
  revalidateTag('social')
  revalidatePath('/cms/social')
}

// ---------------------------------------------------------------------------
// Strip tokens from connections before returning to client
// ---------------------------------------------------------------------------

type SafeConnection = Omit<
  SocialConnection,
  'access_token_enc' | 'refresh_token_enc' | 'page_token_enc'
>

function stripTokens(conn: SocialConnection): SafeConnection {
  const { access_token_enc: _a, refresh_token_enc: _r, page_token_enc: _p, ...safe } = conn
  return safe
}

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

const connectSchema = z.object({
  provider: z.enum(['youtube', 'facebook', 'instagram', 'bluesky']),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  pageToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  accountId: z.string().min(1),
  accountName: z.string().min(1),
  scopes: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
})

export async function connectSocial(
  provider: Provider,
  tokens: {
    accessToken: string
    refreshToken?: string
    pageToken?: string
    expiresAt?: string
    accountId: string
    accountName: string
    scopes: string[]
    metadata?: Record<string, unknown>
  },
): Promise<ActionResult<{ id: string }>> {
  const parsed = connectSchema.safeParse({ provider, ...tokens })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId } = await requireEditAccess()
    const key = getMasterKey()
    const supabase = getSupabaseServiceClient()

    const row = {
      site_id: siteId,
      provider: parsed.data.provider,
      account_id: parsed.data.accountId,
      account_name: parsed.data.accountName,
      access_token_enc: encrypt(parsed.data.accessToken, key),
      refresh_token_enc: parsed.data.refreshToken
        ? encrypt(parsed.data.refreshToken, key)
        : null,
      page_token_enc: parsed.data.pageToken
        ? encrypt(parsed.data.pageToken, key)
        : null,
      token_expires_at: parsed.data.expiresAt ?? null,
      scopes: parsed.data.scopes,
      metadata: parsed.data.metadata ?? {},
    }

    const { data, error } = await supabase
      .from('social_connections')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      console.error('[connectSocial]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'connectSocial' } })
      return { ok: false, error: 'Failed to connect social account' }
    }

    revalidateSocialPaths()
    return { ok: true, data: { id: data.id as string } }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'connectSocial' } })
    throw err
  }
}

export async function disconnectSocial(
  connectionId: string,
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(connectionId)
  if (!parsed.success) return { ok: false, error: 'Invalid connection ID' }

  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('social_connections')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .eq('site_id', siteId)
      .is('revoked_at', null)

    if (error) {
      console.error('[disconnectSocial]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'disconnectSocial' } })
      return { ok: false, error: 'Failed to disconnect social account' }
    }

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'disconnectSocial' } })
    throw err
  }
}

export async function getConnections(
  siteId: string,
): Promise<ActionResult<SafeConnection[]>> {
  const parsed = z.string().uuid().safeParse(siteId)
  if (!parsed.success) return { ok: false, error: 'Invalid site ID' }

  try {
    await requireEditAccess()
    const supabase = getSupabaseServiceClient()

    const { data, error } = await supabase
      .from('social_connections')
      .select('id, site_id, provider, account_id, account_name, token_expires_at, scopes, metadata, connected_at, revoked_at, updated_at')
      .eq('site_id', parsed.data)
      .is('revoked_at', null)
      .order('connected_at', { ascending: false })

    if (error) {
      console.error('[getConnections]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'getConnections' } })
      return { ok: false, error: 'Failed to load connections' }
    }

    const safe = (data as SocialConnection[]).map(stripTokens)
    return { ok: true, data: safe }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getConnections' } })
    throw err
  }
}

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
})

export async function createSocialPost(data: {
  type: PostType
  content: z.infer<typeof SocialPostContentSchema>
  platforms: Provider[]
  scheduledAt?: string
  userTimezone?: string
  templateId?: string
}): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(data)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  try {
    const { siteId, userId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()
    const ctx = await getSiteContext()

    const status: PostStatus = parsed.data.scheduledAt ? 'scheduled' : 'draft'
    const idempotencyKey = `${siteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

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
      console.error('[createSocialPost]', postError)
      Sentry.captureException(postError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
      return { ok: false, error: 'Failed to create social post' }
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
      console.error('[createSocialPost] connections lookup', connError)
      Sentry.captureException(connError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
      return { ok: false, error: 'Failed to create social post' }
    }

    if (connections && connections.length > 0) {
      const deliveryRows = connections.map((conn) => ({
        post_id: postId,
        connection_id: conn.id as string,
        provider: conn.provider as Provider,
        status: 'pending' as const,
        attempt: 0,
        max_attempts: 3,
      }))

      const { error: deliveryError } = await supabase
        .from('social_deliveries')
        .insert(deliveryRows)

      if (deliveryError) {
        console.error('[createSocialPost] delivery insert', deliveryError)
        Sentry.captureException(deliveryError, { tags: { ...SENTRY_TAG, action: 'createSocialPost' } })
        return { ok: false, error: 'Failed to create social post' }
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
      console.error('[updateSocialPost]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'updateSocialPost' } })
      return { ok: false, error: 'Failed to update social post' }
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
      .in('status', ['draft', 'scheduled'])

    if (postError) {
      console.error('[cancelSocialPost]', postError)
      Sentry.captureException(postError, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
      return { ok: false, error: 'Failed to cancel social post' }
    }

    // Cancel pending deliveries
    const { error: deliveryError } = await supabase
      .from('social_deliveries')
      .update({ status: 'skipped' })
      .eq('post_id', parsed.data)
      .eq('status', 'pending')

    if (deliveryError) {
      console.error('[cancelSocialPost] delivery update', deliveryError)
      Sentry.captureException(deliveryError, { tags: { ...SENTRY_TAG, action: 'cancelSocialPost' } })
      return { ok: false, error: 'Failed to cancel social post' }
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
          // Intentionally selecting token columns — needed for platform API deletion calls.
          const { data: connection } = await supabase
            .from('social_connections')
            .select('id, site_id, provider, account_id, account_name, access_token_enc, refresh_token_enc, page_token_enc, token_expires_at, scopes, metadata, connected_at, revoked_at, updated_at')
            .eq('id', delivery.connection_id)
            .single()

          if (!connection) continue

          const conn = connection as unknown as SocialConnection
          const provider = delivery.provider as Provider

          switch (provider) {
            case 'youtube': {
              const mod = await import('@tn-figueiredo/social/providers/youtube')
              const accessToken = decryptFn(conn.access_token_enc)
              await mod.deleteVideo({ accessToken }, delivery.platform_post_id)
              break
            }
            case 'facebook': {
              const mod = await import('@tn-figueiredo/social/providers/meta')
              const pageToken = decryptFn(conn.page_token_enc!)
              await mod.deletePagePost(delivery.platform_post_id, pageToken)
              break
            }
            case 'instagram': {
              const mod = await import('@tn-figueiredo/social/providers/meta')
              const token = decryptFn(conn.page_token_enc!)
              await mod.deleteInstagramMedia(delivery.platform_post_id, token)
              break
            }
            case 'bluesky':
              // Bluesky post deletion requires AT Protocol session — handled separately
              break
          }
        } catch (deleteErr) {
          console.warn(`[social] Platform delete failed for delivery ${delivery.id}:`, deleteErr)
        }
      }
    }

    // Delete deliveries then post
    const { error: delError } = await supabase
      .from('social_deliveries')
      .delete()
      .eq('post_id', parsed.data)

    if (delError) {
      console.error('[deleteSocialPost] delivery delete', delError)
      Sentry.captureException(delError, { tags: { ...SENTRY_TAG, action: 'deleteSocialPost' } })
      return { ok: false, error: 'Failed to delete social post' }
    }

    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', parsed.data)
      .eq('site_id', siteId)

    if (error) {
      console.error('[deleteSocialPost]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'deleteSocialPost' } })
      return { ok: false, error: 'Failed to delete social post' }
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
      console.error('[retrySocialDelivery]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'retrySocialDelivery' } })
      return { ok: false, error: 'Failed to retry delivery' }
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

export async function retryPostDeliveries(
  postId: string,
): Promise<ActionResult> {
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

    if (!post) return { ok: false, error: 'forbidden' }

    const { data: deliveries, error: fetchErr } = await supabase
      .from('social_deliveries')
      .select('id, status')
      .eq('post_id', parsed.data)
      .in('status', ['failed', 'skipped'])

    if (fetchErr) return { ok: false, error: fetchErr.message }
    if (!deliveries || deliveries.length === 0) return { ok: false, error: 'No retryable deliveries' }

    const { error: updateErr } = await supabase
      .from('social_deliveries')
      .update({ status: 'pending', attempt: 0, last_error: null, error_type: null })
      .in('id', deliveries.map(d => d.id as string))

    if (updateErr) return { ok: false, error: updateErr.message }

    await supabase
      .from('social_posts')
      .update({ status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('id', parsed.data)
      .in('status', ['failed', 'partial_failure'])

    revalidateSocialPaths()
    return { ok: true, data: undefined }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'retryPostDeliveries' } })
    throw err
  }
}

export async function getSocialPost(
  postId: string,
): Promise<ActionResult<SocialPost & { deliveries: SocialDelivery[] }>> {
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
      console.error('[getSocialPost] deliveries fetch', delError)
      Sentry.captureException(delError, { tags: { ...SENTRY_TAG, action: 'getSocialPost' } })
      return { ok: false, error: 'Failed to load social post' }
    }

    return {
      ok: true,
      data: {
        ...(post as unknown as SocialPost),
        deliveries: (deliveries ?? []) as unknown as SocialDelivery[],
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
  try {
    const { siteId } = await requireEditAccess()
    const supabase = getSupabaseServiceClient()
    if (contentType === 'blog') {
      const { data: rows, error: dbErr } = await supabase
        .from('blog_posts')
        .select('id, cover_image_url, blog_translations(title, slug, meta_description, locale)')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .limit(1)
      if (dbErr) {
        console.error('[getContentForSocialPost] blog error:', dbErr.message, { contentId, siteId })
        return { ok: false, error: 'Failed to load content' }
      }
      const data = rows?.[0]
      if (!data) return { ok: false, error: 'not_found' }
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

    if (contentType === 'newsletter') {
      const { data: rows, error: dbErr } = await supabase
        .from('newsletter_editions')
        .select('id, subject, preview_text')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .limit(1)
      if (dbErr) {
        console.error('[getContentForSocialPost] newsletter error:', dbErr.message, { contentId, siteId })
        return { ok: false, error: 'Failed to load content' }
      }
      if (!rows?.[0]) return { ok: false, error: 'not_found' }
      const data = rows[0]
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

    if (contentType === 'campaign') {
      const { data: rows, error: dbErr } = await supabase
        .from('campaigns')
        .select('id, campaign_translations(slug, meta_title, meta_description, og_image_url)')
        .eq('id', contentId)
        .eq('site_id', siteId)
        .limit(1)
      if (dbErr) {
        console.error('[getContentForSocialPost] campaign error:', dbErr.message, { contentId, siteId })
        return { ok: false, error: 'Failed to load content' }
      }
      if (!rows?.[0]) return { ok: false, error: 'not_found' }
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
    console.error('[getContentForSocialPost]', err)
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'getContentForSocialPost' } })
    return { ok: false, error: 'Failed to load content' }
  }
}

export async function createFromContentAction(params: {
  contentType: string
  contentId: string
  config: Record<string, unknown>
  origin: string
  scheduledAt?: string
}): Promise<{ ok: true; data: { postId: string; shortLinkId: string | null } } | { ok: false; error: string }> {
  try {
    const { siteId, userId } = await requireEditAccess()
    const { createSocialPostFromContent } = await import('@/lib/social/create-from-content')
    const result = await createSocialPostFromContent({
      supabase: getSupabaseServiceClient(),
      siteId,
      contentType: params.contentType as import('@/lib/social/types').ContentType,
      contentId: params.contentId,
      config: params.config as unknown as import('@/lib/social/types').SocialConfig,
      origin: params.origin as import('@/lib/social/types').Origin,
      scheduledAt: params.scheduledAt,
      userId,
    })
    return { ok: true, data: result }
  } catch (err) {
    console.error('[createFromContentAction]', err)
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'createFromContentAction' } })
    return { ok: false, error: 'Failed to create social post from content' }
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

    const key = getMasterKey()
    const pageToken = connection?.page_token_enc
      ? decrypt(connection.page_token_enc as string, key)
      : (connection?.access_token_enc ? decrypt(connection.access_token_enc as string, key) : '')

    const { scrapeOg } = await import('@/lib/social/og-scraper')
    const result = await scrapeOg(contentUrl, pageToken)

    const { updatePipelineStep } = await import('@/lib/social/pipeline')
    const scrapeData = result as unknown as Record<string, unknown>
    if (result.status === 'ok') {
      await updatePipelineStep(supabase, idParsed.data, 'platform_prepare', 'completed', scrapeData)
    } else {
      await updatePipelineStep(supabase, idParsed.data, 'platform_prepare', 'warning', scrapeData)
    }

    return { ok: true, data: scrapeData }
  } catch (err) {
    console.error('[scrapeOgTags]', err)
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'scrapeOgTags' } })
    return { ok: false, error: 'Failed to scrape OG tags' }
  }
}

export async function listSocialPosts(
  siteId: string,
  filters?: { status?: PostStatus; from?: string; to?: string },
): Promise<ActionResult<SocialPost[]>> {
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
      console.error('[listSocialPosts]', error)
      Sentry.captureException(error, { tags: { ...SENTRY_TAG, action: 'listSocialPosts' } })
      return { ok: false, error: 'Failed to list social posts' }
    }

    return { ok: true, data: (data ?? []) as unknown as SocialPost[] }
  } catch (err) {
    Sentry.captureException(err, { tags: { ...SENTRY_TAG, action: 'listSocialPosts' } })
    throw err
  }
}

// EditRules and getEditRules moved to ./types.ts (non-server module)
// Import from '@/lib/social/types' instead.

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
    const typesModule = await import('./types')
    const rules = typesModule.getEditRules(provider)

    if (rules.readOnly) {
      return { ok: false, error: rules.readOnlyReason ?? 'Platform does not support editing' }
    }

    if (!rules.canEditCaption) {
      return { ok: false, error: 'Caption editing not supported for this platform' }
    }

    // Get connection (need token columns for platform API calls)
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('id, site_id, provider, account_id, account_name, access_token_enc, refresh_token_enc, page_token_enc, token_expires_at, scopes, metadata, connected_at, revoked_at, updated_at')
      .eq('id', delivery.connection_id)
      .single()

    if (connError || !connection) return { ok: false, error: 'Connection not found' }

    const conn = connection as unknown as SocialConnection
    const key = getMasterKey()

    if (rules.method === 'update') {
      // Facebook: POST /{post-id} with updated message
      if (provider === 'facebook' && conn.page_token_enc) {
        const pageToken = decrypt(conn.page_token_enc, key)
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
        // Delete old record (best-effort)
        if (delivery.platform_post_id) {
          try {
            const service = (conn.metadata as Record<string, unknown>)?.service ?? 'https://bsky.social'
            await fetch(
              `${service}/xrpc/com.atproto.repo.deleteRecord`,
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
          const bsMod = await import('@tn-figueiredo/social/providers/bluesky')
          const bsProvider = new bsMod.BlueskyProvider((enc: string) => decrypt(enc, key))
          const socialPost = postData as unknown as SocialPost
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
