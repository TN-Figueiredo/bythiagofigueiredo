'use client'

import type { YouTubePageData } from './youtube-types'

interface YouTubePageClientProps {
  data: YouTubePageData
  locale: string
}

export function YouTubePageClient({ data, locale }: YouTubePageClientProps) {
  return <div data-testid="youtube-page-client">YouTube ({locale}) — {data.totalVideoCount} videos</div>
}
