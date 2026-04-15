import type { ContentStatus } from './content'

export interface PostTranslation {
  id: string
  post_id: string
  locale: string
  title: string
  slug: string
  excerpt: string | null
  content_mdx: string
  content_compiled: string | null
  content_toc: Array<{ depth: number; text: string; slug: string }>
  reading_time_min: number
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  site_id: string
  author_id: string
  status: ContentStatus
  published_at: string | null
  scheduled_for: string | null
  cover_image_url: string | null
  created_at: string
  updated_at: string
  translations: PostTranslation[]
}

export interface PostListItem {
  id: string
  status: ContentStatus
  published_at: string | null
  cover_image_url: string | null
  translation: {
    locale: string
    title: string
    slug: string
    excerpt: string | null
    reading_time_min: number
  }
  available_locales: string[]
}

export interface CreatePostInput {
  site_id: string
  author_id: string
  initial_translation: {
    locale: string
    title: string
    slug: string
    content_mdx: string
    excerpt?: string | null
  }
}

export interface UpdatePostInput {
  status?: ContentStatus
  scheduled_for?: string | null
  cover_image_url?: string | null
  translation?: {
    locale: string
    title?: string
    slug?: string
    excerpt?: string | null
    content_mdx?: string
    content_compiled?: string | null
    content_toc?: Array<{ depth: number; text: string; slug: string }>
    reading_time_min?: number
    meta_title?: string | null
    meta_description?: string | null
    og_image_url?: string | null
  }
}
