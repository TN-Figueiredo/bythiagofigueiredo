import type { ReaderArticle, ReaderAuthor } from '@tn-figueiredo/cms-reader'

export function toReaderArticle(
  post: {
    id: string
    cover_image_url: string | null
    published_at: string | null
    updated_at: string
    category?: string | null
  },
  tx: {
    title: string
    slug: string
    locale: string
    excerpt: string | null
    reading_time_min: number
    content_compiled: string | null
    content_toc: Array<{ slug: string; text: string; depth: number }>
  },
  author: ReaderAuthor,
): ReaderArticle {
  return {
    id: post.id,
    title: tx.title,
    slug: tx.slug,
    locale: tx.locale,
    compiledMdx: tx.content_compiled ?? '',
    excerpt: tx.excerpt,
    coverImageUrl: post.cover_image_url,
    headings: tx.content_toc.map((h) => ({
      id: h.slug,
      text: h.text,
      level: h.depth as 2 | 3,
    })),
    readingTimeMin: tx.reading_time_min,
    publishedAt: post.published_at ?? post.updated_at,
    updatedAt: post.updated_at,
    author,
    category: post.category ?? undefined,
  }
}
