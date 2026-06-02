'use client'

import Link from 'next/link'

interface VideoRow {
  id: string
  youtubeVideoId: string
  title: string
  channelId: string
  channelLocale: 'pt' | 'en'
  categoryId: string | null
  suggestedCategoryId: string | null
  isFeatured: boolean
  isHidden: boolean
  pinnedUntil: string | null
  viewCount?: number
  likeCount?: number
  commentCount?: number
  publishedAt?: string
}

interface VideosTabProps {
  videos: VideoRow[]
}

export function VideosTab({ videos }: VideosTabProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 text-xs font-medium text-cms-text-muted px-2">
        <span>Video</span>
        <span>Stats</span>
        <span>Grade</span>
        <span>Actions</span>
      </div>
      {videos.map(video => {
        const views = video.viewCount ?? 0
        return (
          <div key={video.id} className="flex items-center gap-4 rounded-lg border border-cms-border bg-cms-surface p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-cms-text truncate">{video.title}</p>
              <p className="text-xs text-cms-text-dim">{video.publishedAt ? new Date(video.publishedAt).toLocaleDateString() : ''}</p>
            </div>
            <div className="text-xs text-cms-text-muted">{views.toLocaleString('pt-BR')} views</div>
            <div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${views > 10000 ? 'bg-green-500/15 text-green-400' : views > 1000 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-gray-500/15 text-gray-400'}`}>
                {views > 10000 ? 'A+' : views > 1000 ? 'B+' : 'C'}
              </span>
            </div>
            <div className="flex gap-2">
              <Link href={`/cms/social/new?mode=video&ref=${video.youtubeVideoId}`} className="text-xs text-cms-accent hover:underline">
                Share
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
