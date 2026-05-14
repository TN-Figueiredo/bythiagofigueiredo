// apps/web/src/lib/social/content-metadata.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentMetadata, ContentType } from './types'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

export async function extractContentMetadata(
  supabase: SupabaseClient,
  contentType: ContentType,
  contentId: string,
): Promise<ContentMetadata> {
  switch (contentType) {
    case 'blog':
      return extractBlogMetadata(supabase, contentId)
    case 'newsletter':
      return extractNewsletterMetadata(supabase, contentId)
    case 'campaign':
      return extractCampaignMetadata(supabase, contentId)
    case 'video':
      return extractVideoMetadata(supabase, contentId)
    default:
      throw new Error(`Unsupported content type: ${contentType as string}`)
  }
}

async function extractBlogMetadata(
  supabase: SupabaseClient,
  contentId: string,
): Promise<ContentMetadata> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('title, slug, locale, cover_image_url, excerpt, tags')
    .eq('id', contentId)
    .single()

  if (error || !data) {
    throw new Error(`Blog post not found: ${contentId}`)
  }

  const locale = (data.locale as string) || 'pt'
  return {
    title: data.title as string,
    url: `${APP_URL}/${locale}/blog/${data.slug as string}`,
    image: (data.cover_image_url as string) ?? null,
    excerpt: (data.excerpt as string) ?? null,
    tags: (data.tags as string[]) ?? [],
    locale,
  }
}

async function extractNewsletterMetadata(
  supabase: SupabaseClient,
  contentId: string,
): Promise<ContentMetadata> {
  const { data, error } = await supabase
    .from('newsletter_editions')
    .select('id, subject, preheader, content, locale, newsletter_types(slug)')
    .eq('id', contentId)
    .single()

  if (error || !data) {
    throw new Error(`Newsletter edition not found: ${contentId}`)
  }

  const locale = (data.locale as string) || 'pt'
  const typeData = data.newsletter_types as unknown as { slug: string } | null
  const typeSlug = typeData?.slug ?? 'default'
  const editionId = data.id as string

  const htmlContent = (data.content as string) ?? ''
  const imgMatch = htmlContent.match(/<img[^>]+src="([^"]+)"/)
  const image = imgMatch?.[1] ?? null

  const preheader = data.preheader as string | null
  const excerpt = preheader || stripHtml(htmlContent).slice(0, 160) || null

  return {
    title: data.subject as string,
    url: `${APP_URL}/${locale}/newsletter/${typeSlug}/editions/${editionId}`,
    image,
    excerpt,
    tags: [],
    locale,
  }
}

async function extractCampaignMetadata(
  supabase: SupabaseClient,
  contentId: string,
): Promise<ContentMetadata> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('meta_title, slug, locale, og_image_url, meta_description')
    .eq('id', contentId)
    .single()

  if (error || !data) {
    throw new Error(`Campaign not found: ${contentId}`)
  }

  const locale = (data.locale as string) || 'en'
  return {
    title: data.meta_title as string,
    url: `${APP_URL}/${locale}/campaign/${data.slug as string}`,
    image: (data.og_image_url as string) ?? null,
    excerpt: (data.meta_description as string) ?? null,
    tags: [],
    locale,
  }
}

async function extractVideoMetadata(
  supabase: SupabaseClient,
  videoId: string,
): Promise<ContentMetadata> {
  const { data, error } = await supabase
    .from('social_connections')
    .select('metadata')
    .eq('provider', 'youtube')
    .single()

  if (error || !data) {
    throw new Error(`YouTube connection not found for video: ${videoId}`)
  }

  const metadata = data.metadata as {
    videos?: Array<{
      id: string
      title: string
      thumbnail_url: string
      description: string
      tags?: string[]
    }>
  }
  const video = metadata.videos?.find((v) => v.id === videoId)
  if (!video) {
    throw new Error(`Video not found in YouTube metadata: ${videoId}`)
  }

  return {
    title: video.title,
    url: `https://youtube.com/watch?v=${videoId}`,
    image: video.thumbnail_url ?? null,
    excerpt: video.description ? video.description.slice(0, 160) : null,
    tags: video.tags ?? [],
    locale: 'pt',
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
