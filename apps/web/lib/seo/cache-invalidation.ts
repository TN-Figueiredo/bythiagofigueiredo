import { revalidateTag, revalidatePath } from 'next/cache'
import { localePath } from '@/lib/i18n/locale-path'

export function revalidateBlogPostSeo(
  siteId: string,
  postId: string,
  locale: string,
  slug: string,
): void {
  revalidateTag(`blog:post:${postId}`)
  revalidateTag(`og:blog:${postId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(localePath(`/blog/${slug}`, locale))
  revalidatePath(localePath('/blog', locale))
}

export function revalidateCampaignSeo(
  siteId: string,
  campaignId: string,
  locale: string,
  slug: string,
): void {
  revalidateTag(`campaign:${campaignId}`)
  revalidateTag(`og:campaign:${campaignId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(localePath(`/campaigns/${slug}`, locale))
}

export function revalidateSiteBranding(): void {
  revalidateTag('seo-config')
}
