import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`newsletter:type:${slug}`, 'seconds')
  revalidateTag(`og:newsletter:${slug}`, 'seconds')
  revalidateTag(`sitemap:${siteId}`, 'seconds')
  // leitor: lib/newsletter/queries.ts:getActiveTypeCount → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag('newsletter:types:count', 'minutes')
  // leitor: lib/newsletter/suggestions.ts → widget público em app/(public)/newsletters/[slug]/
  revalidateTag('newsletter-suggestions', 'minutes')
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}

export function revalidateAuthor(authorId: string): void {
  // leitor: lib/newsletter/author-queries.ts → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag(`author:${authorId}`, 'minutes')
}

export function revalidateNewsletterSuggestions(): void {
  revalidateTag('newsletter-suggestions', 'minutes')
}

export function revalidateAbout(siteId: string): void {
  // leitor: lib/about/queries.ts → app/(public)/about/page.tsx
  revalidateTag(`about:${siteId}`, 'minutes')
}
