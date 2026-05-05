export type HomePost = {
  id: string
  slug: string
  locale: string
  title: string
  excerpt: string | null
  publishedAt: string
  category: string | null
  readingTimeMin: number
  coverImageUrl: string | null
  isFeatured: boolean
  tagName: string | null
  tagColor: string | null
  tagColorDark: string | null
}

export type HomeChannel = {
  id: string
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
  subscriberCount: number
  thumbnailUrl: string | null
  scheduleLabel: string | null
}

export type HomeVideo = {
  id: string
  locale: 'en' | 'pt-BR'
  title: string
  description: string
  thumbnailUrl: string | null
  duration: string
  viewCount: number
  publishedAt: string
  categoryName: string | null
  categoryColor: string | null
  youtubeUrl: string
  channelHandle: string
  youtubeVideoId: string
  isPinned: boolean
}

export type HomeNewsletter = {
  id: string
  slug: string
  name: string
  tagline: string | null
  cadence: string | null
  color: string
  locale: string
}

export type HomeTag = {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  postCount: number
}
