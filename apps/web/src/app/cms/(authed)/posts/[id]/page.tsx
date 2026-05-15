import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { PostDetail } from '../_components/post-detail'
import type { PostDetailData, PostTranslation } from '@/lib/posts/types'
import type { SocialConfig } from '@/lib/social/types'

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'view' })

  const svc = getSupabaseServiceClient()
  const { data: post } = await svc
    .from('blog_posts')
    .select(`
      id, site_id, author_id, status, category, cover_image_url, locale,
      scheduled_at, published_at, social_config,
      include_in_newsletter, rss_included, search_indexable, canonical_url,
      created_at, updated_at,
      blog_translations(locale, title, slug, excerpt, content_mdx, content_json, content_html, meta_title, meta_description, og_image_url, key_points, pull_quote),
      content_pipeline!content_pipeline_blog_post_id_fkey(id, code, format, stage, priority)
    `)
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (!post) notFound()

  const rawTranslations = (post.blog_translations ?? []) as Array<Record<string, unknown>>
  const translations: PostTranslation[] = rawTranslations.map(tx => ({
    locale: tx.locale as string,
    title: tx.title as string,
    slug: tx.slug as string,
    excerpt: tx.excerpt as string | null,
    contentMdx: tx.content_mdx as string | null,
    contentJson: tx.content_json as Record<string, unknown> | null,
    contentHtml: tx.content_html as string | null,
    metaTitle: tx.meta_title as string | null,
    metaDescription: tx.meta_description as string | null,
    ogImageUrl: tx.og_image_url as string | null,
    keyPoints: tx.key_points as string[] | null,
    pullQuote: tx.pull_quote as string | null,
  }))

  const rawPipeline = (post.content_pipeline ?? []) as Array<Record<string, unknown>>
  const pipelineItem = rawPipeline[0] ? {
    id: rawPipeline[0].id as string,
    code: rawPipeline[0].code as string,
    format: rawPipeline[0].format as string,
    stage: rawPipeline[0].stage as string,
    priority: rawPipeline[0].priority as number,
  } : null

  const postData: PostDetailData = {
    id: post.id as string,
    siteId: post.site_id as string,
    authorId: post.author_id as string,
    status: post.status as string,
    category: post.category as string | null,
    coverImageUrl: post.cover_image_url as string | null,
    locale: post.locale as string,
    scheduledAt: post.scheduled_at as string | null,
    publishedAt: post.published_at as string | null,
    socialConfig: post.social_config as SocialConfig | null,
    includeInNewsletter: (post.include_in_newsletter as boolean) ?? true,
    rssIncluded: (post.rss_included as boolean) ?? true,
    searchIndexable: (post.search_indexable as boolean) ?? true,
    canonicalUrl: post.canonical_url as string | null,
    translations,
    pipelineItem,
    createdAt: post.created_at as string,
    updatedAt: post.updated_at as string,
  }

  return <PostDetail post={postData} />
}
