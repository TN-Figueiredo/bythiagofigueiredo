import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateBlogPostSeo(
  siteId: string,
  postId: string,
  locale: string,
  slug: string,
): void {
  revalidateTag(`blog:post:${postId}`)
  revalidateTag(`og:blog:${postId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(`/blog/${locale}/${slug}`)
  revalidatePath(`/blog/${locale}`)
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
  revalidatePath(`/campaigns/${locale}/${slug}`)
}

export function revalidateSiteBranding(): void {
  revalidateTag('seo-config')
}
