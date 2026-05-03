import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  revalidateTag(`newsletter:type:${slug}`)
  revalidateTag(`og:newsletter:${slug}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidateTag('newsletter:types:count')
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}

export function revalidateAuthor(authorId: string): void {
  revalidateTag(`author:${authorId}`)
}
