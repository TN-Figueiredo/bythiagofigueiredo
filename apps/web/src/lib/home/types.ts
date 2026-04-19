export interface HomePost {
  id: string
  slug: string
  title: string
  excerpt?: string
  category?: string
  coverImageUrl?: string
  readingTimeMin: number
  publishedAt: string
}

export interface HomeVideo {
  id: string
  title: string
  series: string
  youtubeUrl: string
  thumbnailUrl?: string
  duration: string
  publishedAt: string
}
