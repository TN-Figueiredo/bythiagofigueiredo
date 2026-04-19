export type HomeChannel = {
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
}

export type HomeVideo = {
  id: string
  locale: 'en' | 'pt-BR'
  title: string
  description: string
  thumbnailUrl: string | null
  duration: string
  viewCount: string
  publishedAt: string
  series: string
  youtubeUrl: string
}
