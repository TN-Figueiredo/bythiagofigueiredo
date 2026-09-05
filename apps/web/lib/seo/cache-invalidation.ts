import { revalidateTag, revalidatePath } from 'next/cache'
import { localePath } from '@/lib/i18n/locale-path'

export function revalidateBlogPostSeo(
  siteId: string,
  postId: string,
  locale: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`blog:post:${postId}`, 'seconds')
  revalidateTag(`og:blog:${postId}`, 'seconds')
  revalidateTag(`sitemap:${siteId}`, 'seconds')
  revalidatePath(localePath(`/blog/${slug}`, locale))
  revalidatePath(localePath('/blog', locale))
}

export function revalidateCampaignSeo(
  siteId: string,
  campaignId: string,
  locale: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`campaign:${campaignId}`, 'seconds')
  revalidateTag(`og:campaign:${campaignId}`, 'seconds')
  revalidateTag(`sitemap:${siteId}`, 'seconds')
  revalidatePath(localePath(`/campaigns/${slug}`, locale))
}

export function revalidateNewsletterTypeSeo(
  siteId: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`sitemap:${siteId}`, 'seconds')
  // leitor: lib/newsletter/queries.ts:getActiveTypeCount → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag('newsletter:types:count', 'minutes')
  revalidatePath(`/newsletters/${slug}`)
}

export function revalidateSiteBranding(): void {
  // leitor: lib/seo/config.ts:getSiteSeoConfig → sitemap.ts, robots.ts, metadata pública, og/*
  revalidateTag('seo-config', 'minutes')
}
