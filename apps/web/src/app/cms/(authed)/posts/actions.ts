'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'
import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'
import type { SocialConfig } from '@/lib/social/types'

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
}

export async function savePostContent(
  postId: string,
  locale: string,
  data: {
    title?: string
    slug?: string
    excerpt?: string
    contentMdx?: string
    contentJson?: Record<string, unknown>
    contentHtml?: string
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.slug !== undefined) patch.slug = data.slug
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt
  if (data.contentMdx !== undefined) patch.content_mdx = data.contentMdx
  if (data.contentJson !== undefined) patch.content_json = data.contentJson
  if (data.contentHtml !== undefined) patch.content_html = data.contentHtml

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostSeo(
  postId: string,
  locale: string,
  data: {
    metaTitle?: string
    metaDescription?: string
    ogImageUrl?: string | null
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.metaTitle !== undefined) patch.meta_title = data.metaTitle
  if (data.metaDescription !== undefined) patch.meta_description = data.metaDescription
  if (data.ogImageUrl !== undefined) patch.og_image_url = data.ogImageUrl

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  revalidateBlogPostSeo(siteId, postId, locale, '')
  return { ok: true }
}

export async function savePostSocialConfig(
  postId: string,
  config: SocialConfig,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ social_config: config })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostPublishSettings(
  postId: string,
  data: {
    includeInNewsletter?: boolean
    rssIncluded?: boolean
    searchIndexable?: boolean
    canonicalUrl?: string | null
  },
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.includeInNewsletter !== undefined) patch.include_in_newsletter = data.includeInNewsletter
  if (data.rssIncluded !== undefined) patch.rss_included = data.rssIncluded
  if (data.searchIndexable !== undefined) patch.search_indexable = data.searchIndexable
  if (data.canonicalUrl !== undefined) patch.canonical_url = data.canonicalUrl

  const { error } = await svc
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function savePostCoverImage(
  postId: string,
  coverImageUrl: string | null,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ cover_image_url: coverImageUrl })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function schedulePost(
  postId: string,
  scheduledAt: string,
  timezone: string,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await svc
    .from('blog_posts')
    .select('id, status, social_config')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'Post not found' }
  if (post.status === 'published') return { ok: false, error: 'Post already published' }

  const { error } = await svc
    .from('blog_posts')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  syncPipelineOnPostStatusChange(postId, 'scheduled', post.status).catch(() => {})

  revalidatePath('/cms/posts')
  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function publishPost(
  postId: string,
): Promise<ActionResult> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await svc
    .from('blog_posts')
    .select('id, status, social_config, blog_translations(locale, slug)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'Post not found' }
  if (post.status === 'published') return { ok: false, error: 'Post already published' }

  const { error } = await svc
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  const translations = (post as { blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  syncPipelineOnPostStatusChange(postId, 'published', post.status).catch(() => {})

  const socialConfig = (post as { social_config?: { enabled: boolean } }).social_config
  if (socialConfig?.enabled) {
    import('@/lib/social/create-from-content').then(({ createSocialPostFromContent }) =>
      createSocialPostFromContent({
        supabase: svc,
        siteId,
        contentType: 'blog',
        contentId: postId,
        config: socialConfig as unknown as SocialConfig,
        origin: 'auto',
        userId: 'system',
      }).catch(() => {}),
    )
  }

  revalidatePath('/cms/posts')
  revalidatePath(`/cms/posts/${postId}`)
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function returnToPipeline(
  postId: string,
): Promise<ActionResult<{ pipelineItemId: string }>> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: pipelineItem } = await svc
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('blog_post_id', postId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (!pipelineItem) return { ok: false, error: 'No linked pipeline item found' }

  const { error: archiveErr } = await svc
    .from('blog_posts')
    .update({ status: 'archived' })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (archiveErr) return { ok: false, error: archiveErr.message }

  const { error: pipelineErr } = await svc
    .from('content_pipeline')
    .update({
      blog_post_id: null,
      social_config: null,
      stage: 'draft',
      version: pipelineItem.version + 1,
    })
    .eq('id', pipelineItem.id)
    .eq('version', pipelineItem.version)

  if (pipelineErr) return { ok: false, error: pipelineErr.message }

  await svc.from('content_pipeline_history').insert({
    pipeline_id: pipelineItem.id,
    event_type: 'returned_from_post',
    from_value: `post:${postId}`,
    to_value: 'draft',
  })

  revalidatePath('/cms/posts')
  revalidatePath('/cms/pipeline')
  return { ok: true, data: { pipelineItemId: pipelineItem.id } }
}
