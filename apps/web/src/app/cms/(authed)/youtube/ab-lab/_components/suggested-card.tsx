'use client'

import type { SuggestedVideo, TestType } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'

export interface SuggestedCardProps {
  video: SuggestedVideo
  onCreate: (videoId: string, type: TestType) => void
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-cms-green text-white',
  B: 'bg-cms-green/80 text-white',
  C: 'bg-cms-amber-subtle text-cms-amber',
  D: 'bg-red-500/20 text-red-400',
  F: 'bg-red-500/20 text-red-400',
}

export function SuggestedCard({ video, onCreate }: SuggestedCardProps) {
  return (
    <article className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg overflow-hidden">
      {/* 16:9 thumbnail area */}
      <div className="relative aspect-video bg-cms-surface-hover">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-cms-text-dim text-xs">
            No thumbnail
          </div>
        )}

        {/* Grade pill overlay */}
        <span
          data-grade
          className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-2xs font-bold ${GRADE_COLORS[video.grade] ?? GRADE_COLORS.C}`}
        >
          {video.grade}
        </span>
      </div>

      <div className="p-3">
        <p className="text-sm text-cms-text line-clamp-2 mb-2">{video.title}</p>

        {/* Mini stats */}
        <div className="flex items-center gap-3 text-2xs text-cms-text-muted mb-2">
          <span>CTR {formatPercent(video.ctr)}</span>
          <span>Median {formatPercent(video.channelMedianCtr)}</span>
          <span className="text-red-400">
            Gap {formatPercent(video.channelMedianCtr - video.ctr)}
          </span>
        </div>

        <p className="text-2xs text-cms-text-dim mb-3" data-reason>{video.reason}</p>

        <button
          type="button"
          onClick={() => onCreate(video.id, video.suggest)}
          className="w-full px-3 py-1.5 text-2xs font-medium rounded bg-cms-accent text-white hover:bg-cms-accent/90 transition-colors focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
        >
          Test {video.suggest}
        </button>
      </div>
    </article>
  )
}
