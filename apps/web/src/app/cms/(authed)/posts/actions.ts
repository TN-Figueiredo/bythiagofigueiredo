'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'
import { syncPipelineOnPostStatusChange } from '@/lib/pipeline/blog-sync'
import { socialConfigSchema } from '@/lib/social/schemas'
import type { SocialConfig } from '@/lib/social/types'
import { ensureTrackedLink, deactivateSourceLinks } from '@/lib/links/auto-link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'


type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string }

const uuidSchema = z.string().uuid()
const localeSchema = z.string().min(2).max(10)

const contentInputSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  excerpt: z.string().max(1000).optional(),
  contentMdx: z.string().optional(),
  contentJson: z.record(z.unknown()).optional(),
  contentHtml: z.string().optional(),
})

const seoInputSchema = z.object({
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(500).optional(),
  ogImageUrl: z.string().url().nullable().optional(),
})

const publishSettingsSchema = z.object({
  includeInNewsletter: z.boolean().optional(),
  rssIncluded: z.boolean().optional(),
  searchIndexable: z.boolean().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
})

const scheduledAtSchema = z.string().datetime()


async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
}

async function requirePublishScope(siteId: string): Promise<{ userId: string }> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'publish' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return { userId: res.user.id }
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
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }
  if (!localeSchema.safeParse(locale).success) return { ok: false, error: 'Locale inválido' }
  if (!contentInputSchema.safeParse(data).success) return { ok: false, error: 'Dados inválidos' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  // Verify post belongs to this site before updating translations
  const { data: post } = await svc.from('blog_posts').select('id').eq('id', postId).eq('site_id', siteId).single()
  if (!post) return { ok: false, error: 'Post não encontrado' }

  const patch: Record<string, unknown> = {}
  if (data.title !== undefined) patch.title = data.title
  if (data.slug !== undefined) patch.slug = data.slug
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt
  if (data.contentMdx !== undefined) patch.content_mdx = data.contentMdx
  if (data.contentJson !== undefined) patch.content_json = data.contentJson
  if (data.contentHtml !== undefined) patch.content_html = data.contentHtml

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) {
    console.error('[posts] savePostContent', error)
    return { ok: false, error: 'Erro ao salvar conteúdo' }
  }

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
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }
  if (!localeSchema.safeParse(locale).success) return { ok: false, error: 'Locale inválido' }
  if (!seoInputSchema.safeParse(data).success) return { ok: false, error: 'Dados inválidos' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  // Verify post belongs to this site before updating translations
  const { data: post } = await svc.from('blog_posts').select('id').eq('id', postId).eq('site_id', siteId).single()
  if (!post) return { ok: false, error: 'Post não encontrado' }

  const patch: Record<string, unknown> = {}
  if (data.metaTitle !== undefined) patch.meta_title = data.metaTitle
  if (data.metaDescription !== undefined) patch.meta_description = data.metaDescription
  if (data.ogImageUrl !== undefined) patch.og_image_url = data.ogImageUrl

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await svc
    .from('blog_translations')
    .update(patch)
    .eq('post_id', postId)
    .eq('locale', locale)

  if (error) {
    console.error('[posts] savePostSeo', error)
    return { ok: false, error: 'Erro ao salvar SEO' }
  }

  const { data: txData } = await svc.from('blog_translations').select('slug').eq('post_id', postId).eq('locale', locale).single()

  revalidatePath(`/cms/posts/${postId}`)
  revalidateBlogPostSeo(siteId, postId, locale, txData?.slug ?? '')
  return { ok: true }
}

export async function savePostSocialConfig(
  postId: string,
  config: SocialConfig,
): Promise<ActionResult> {
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }

  const parsed = socialConfigSchema.safeParse(config)
  if (!parsed.success) return { ok: false, error: 'Configuração inválida' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ social_config: parsed.data })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) {
    console.error('[posts] savePostSocialConfig', error)
    return { ok: false, error: 'Erro ao salvar' }
  }

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
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }
  if (!publishSettingsSchema.safeParse(data).success) return { ok: false, error: 'Dados inválidos' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {}
  if (data.includeInNewsletter !== undefined) patch.include_in_newsletter = data.includeInNewsletter
  if (data.rssIncluded !== undefined) patch.rss_included = data.rssIncluded
  if (data.searchIndexable !== undefined) patch.search_indexable = data.searchIndexable
  if (data.canonicalUrl !== undefined) patch.canonical_url = data.canonicalUrl

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await svc
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) {
    console.error('[posts] savePostPublishSettings', error)
    return { ok: false, error: 'Erro ao salvar' }
  }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

const coverImageUrlSchema = z.string().url().nullable()

export async function savePostCoverImage(
  postId: string,
  coverImageUrl: string | null,
): Promise<ActionResult> {
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }

  const parsed = coverImageUrlSchema.safeParse(coverImageUrl)
  if (!parsed.success) return { ok: false, error: 'URL inválida' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)
  const svc = getSupabaseServiceClient()

  const { error } = await svc
    .from('blog_posts')
    .update({ cover_image_url: parsed.data })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) {
    console.error('[posts] savePostCoverImage', error)
    return { ok: false, error: 'Erro ao salvar' }
  }

  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function schedulePost(
  postId: string,
  scheduledAt: string,
): Promise<ActionResult> {
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }
  if (!scheduledAtSchema.safeParse(scheduledAt).success) return { ok: false, error: 'Data inválida' }

  const { siteId } = await getSiteContext()
  await requirePublishScope(siteId)
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

  if (error) {
    console.error('[posts] schedulePost', error)
    return { ok: false, error: 'Erro ao agendar' }
  }

  syncPipelineOnPostStatusChange(postId, 'scheduled', post.status).catch(err => console.error('[posts]', err))

  revalidatePath('/cms/posts')
  revalidatePath(`/cms/posts/${postId}`)
  return { ok: true }
}

export async function publishPost(
  postId: string,
): Promise<ActionResult> {
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }

  const { siteId } = await getSiteContext()
  const { userId } = await requirePublishScope(siteId)
  const svc = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await svc
    .from('blog_posts')
    .select('id, status, social_config, blog_translations(locale, slug)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'Post not found' }
  if (post.status === 'published') return { ok: false, error: 'Post already published' }

  const { data: updated, error } = await svc
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('site_id', siteId)
    .eq('status', post.status as string)
    .select('id')

  if (error) {
    console.error('[posts] publishPost', error)
    return { ok: false, error: 'Erro ao publicar' }
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'conflict' }

  const translations = (post as { blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  // Create tracked link for the published post (idempotent)
  const primaryTx = translations[0]
  if (primaryTx) {
    ensureTrackedLink(svc, siteId, postId, 'blog', `${APP_URL}/${primaryTx.locale}/blog/${primaryTx.slug}`, primaryTx.slug).catch(err => console.error('[posts] ensureTrackedLink', err))
  }

  syncPipelineOnPostStatusChange(postId, 'published', post.status).catch(err => console.error('[posts]', err))

  const rawSocialConfig = (post as { social_config?: unknown }).social_config
  const parsedSocialConfig = socialConfigSchema.safeParse(rawSocialConfig)
  if (parsedSocialConfig.success && parsedSocialConfig.data.enabled) {
    import('@/lib/social/create-from-content').then(({ createSocialPostFromContent }) =>
      createSocialPostFromContent({
        supabase: svc,
        siteId,
        contentType: 'blog',
        contentId: postId,
        config: parsedSocialConfig.data as SocialConfig,
        origin: 'auto',
        userId,
      }).catch(err => console.error('[posts]', err)),
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
  if (!uuidSchema.safeParse(postId).success) return { ok: false, error: 'ID inválido' }

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

  const { data: currentPost } = await svc.from('blog_posts').select('status').eq('id', postId).eq('site_id', siteId).single()
  if (!currentPost) return { ok: false, error: 'Post não encontrado' }
  if (currentPost.status === 'published') return { ok: false, error: 'Não é possível retornar um post publicado ao pipeline' }

  // Step 1: archive post
  const { error: archiveErr } = await svc
    .from('blog_posts')
    .update({ status: 'archived' })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (archiveErr) {
    console.error('[posts] returnToPipeline archive', archiveErr)
    return { ok: false, error: 'Erro ao retornar ao pipeline' }
  }

  // Deactivate tracked links on archive
  deactivateSourceLinks(svc, postId, 'blog').catch(err => console.error('[posts] deactivateSourceLinks', err))

  // Step 2: restore pipeline
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

  if (pipelineErr) {
    console.error('[posts] returnToPipeline restore pipeline', pipelineErr)
    // Compensate: revert archive
    await svc.from('blog_posts').update({ status: 'draft' }).eq('id', postId).eq('site_id', siteId)
    return { ok: false, error: 'Erro ao retornar ao pipeline' }
  }

  const { error: historyErr } = await svc.from('content_pipeline_history').insert({
    pipeline_id: pipelineItem.id,
    event_type: 'returned_from_post',
    from_value: `post:${postId}`,
    to_value: 'draft',
  })
  if (historyErr) console.error('[posts] returnToPipeline history insert', historyErr)

  revalidatePath('/cms/posts')
  revalidatePath('/cms/pipeline')
  return { ok: true, data: { pipelineItemId: pipelineItem.id } }
}
