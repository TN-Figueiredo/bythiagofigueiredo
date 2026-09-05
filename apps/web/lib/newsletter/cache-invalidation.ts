import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateNewsletterType(
  siteId: string,
  slug: string,
): void {
  // sem leitor — candidata a remoção
  revalidateTag(`newsletter:type:${slug}`, { expire: 0 })
  revalidateTag(`og:newsletter:${slug}`, { expire: 0 })
  revalidateTag(`sitemap:${siteId}`, { expire: 0 })
  // leitor: lib/newsletter/queries.ts:getActiveTypeCount → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag('newsletter:types:count', { expire: 0 })
  // leitor: lib/newsletter/suggestions.ts → widget público em app/(public)/newsletters/[slug]/
  revalidateTag('newsletter-suggestions', { expire: 0 })
  revalidatePath(`/newsletters/${slug}`)
  revalidatePath('/newsletters')
}

export function revalidateAuthor(authorId: string): void {
  // leitor: lib/newsletter/author-queries.ts → app/(public)/newsletters/[slug]/page.tsx
  revalidateTag(`author:${authorId}`, { expire: 0 })
}

export function revalidateNewsletterSuggestions(): void {
  revalidateTag('newsletter-suggestions', { expire: 0 })
}

export function revalidateAbout(siteId: string): void {
  // leitor: lib/about/queries.ts → app/(public)/about/page.tsx
  revalidateTag(`about:${siteId}`, { expire: 0 })
}
