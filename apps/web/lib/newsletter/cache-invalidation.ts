import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  revalidateTag(`newsletter:type:${slug}`)
  revalidateTag(`og:newsletter:${slug}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidateTag('newsletter:types:count')
  revalidateTag('newsletter-suggestions')
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}

export function revalidateAuthor(authorId: string): void {
  revalidateTag(`author:${authorId}`)
}

export function revalidateNewsletterSuggestions(): void {
  revalidateTag('newsletter-suggestions')
}

export function revalidateAbout(siteId: string): void {
  revalidateTag(`about:${siteId}`)
}
