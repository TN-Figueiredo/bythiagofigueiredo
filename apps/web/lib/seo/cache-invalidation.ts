import { revalidateTag, revalidatePath } from 'next/cache'
import { localePath } from '@/lib/i18n/locale-path'

export function revalidateBlogPostSeo(
  siteId: string,
  postId: string,
  locale: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`blog:post:${postId}`, { expire: 0 })
  revalidateTag(`og:blog:${postId}`, { expire: 0 })
  revalidateTag(`sitemap:${siteId}`, { expire: 0 })
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
  revalidateTag(`campaign:${campaignId}`, { expire: 0 })
  revalidateTag(`og:campaign:${campaignId}`, { expire: 0 })
  revalidateTag(`sitemap:${siteId}`, { expire: 0 })
  revalidatePath(localePath(`/campaigns/${slug}`, locale))
}

export function revalidateNewsletterTypeSeo(
  siteId: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`sitemap:${siteId}`, { expire: 0 })
  // leitor: lib/newsletter/queries.ts:getActiveTypeCount → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag('newsletter:types:count', { expire: 0 })
  revalidatePath(`/newsletters/${slug}`)
}

export function revalidateSiteBranding(): void {
  // leitor: lib/seo/config.ts:getSiteSeoConfig → sitemap.ts, robots.ts, metadata pública, og/*
  revalidateTag('seo-config', { expire: 0 })
}
