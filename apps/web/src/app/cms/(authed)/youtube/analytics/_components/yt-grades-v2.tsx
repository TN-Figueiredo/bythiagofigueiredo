'use client'

import { useState } from 'react'
import { YtScoreBar } from './yt-score-bar'
import { YtVideoDiagnostic } from './yt-video-diagnostic'
import type { Axis, Grade, TrendDirection } from '@/lib/youtube/scoring-types'

interface VideoGradeRow {
  videoId: string
  title: string
  thumbnailUrl: string
  grade: Grade
  score: number
  axes: Array<{ axis: Axis; normalized: number }>
  trend: { direction: TrendDirection; velocity: number }
  optimizationState: string | null
  retentionCurve: number[] | null
  avgViewPercentage: number
  diagnosis: string | null
  recommendation: string | null
  trafficSources: Record<string, number> | null
}

interface Props {
  videos: VideoGradeRow[]
  onCreateAbTest?: (videoId: string, testType: string) => void
}

const GRADE_COLORS: Record<Grade, string> = {
  A: 'bg-[#34d399] text-black',
  B: 'bg-[#60a5fa] text-black',
  C: 'bg-[#fbbf24] text-black',
  D: 'bg-[#f87171] text-white',
}

const STATE_BADGES: Record<string, { label: string; color: string }> = {
  flagged: { label: 'Sinalizado', color: 'text-[#fbbf24]' },
  diagnosed: { label: 'Diagnosticado', color: 'text-[#f59e0b]' },
  test_suggested: { label: 'Teste Sugerido', color: 'text-[#60a5fa]' },
  testing: { label: 'Em Teste', color: 'text-[#8b5cf6]' },
  post_test_monitoring: { label: 'Monitorando', color: 'text-[#06b6d4]' },
}

export function YtGradesV2({ videos, onCreateAbTest }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all')
  const [sortBy, setSortBy] = useState<'score' | 'ctr' | 'trend'>('score')

  const filtered = videos.filter(v => gradeFilter === 'all' || v.grade === gradeFilter)
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'score') return a.score - b.score
    if (sortBy === 'trend') return a.trend.velocity - b.trend.velocity
    return (a.axes.find(x => x.axis === 'ctr')?.normalized ?? 0) - (b.axes.find(x => x.axis === 'ctr')?.normalized ?? 0)
  })

  const counts = { A: 0, B: 0, C: 0, D: 0 }
  for (const v of videos) counts[v.grade]++
  const inTest = videos.filter(v => v.optimizationState === 'testing').length

  return (
    <div className="space-y-3">
      {/* Summary Strip */}
      <div className="flex items-center gap-4 text-xs text-cms-text-muted">
        <span>{videos.length} vídeos</span>
        <span className="text-[#f87171]">{counts.D} Grade D</span>
        <span className="text-[#fbbf24]">{counts.C} Grade C</span>
        {inTest > 0 && <span className="text-[#8b5cf6]">{inTest} em teste</span>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(['all', 'A', 'B', 'C', 'D'] as const).map(g => (
          <button
            key={g}
            onClick={() => setGradeFilter(g)}
            className={`rounded px-2 py-0.5 text-xs ${gradeFilter === g ? 'bg-cms-accent text-white' : 'border border-cms-border text-cms-text-muted hover:bg-cms-surface'}`}
          >
            {g === 'all' ? 'Todos' : g}
          </button>
        ))}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="ml-auto rounded border border-cms-border bg-transparent px-2 py-0.5 text-xs text-cms-text-muted"
        >
          <option value="score">Score ↑</option>
          <option value="ctr">CTR ↑</option>
          <option value="trend">Tendência ↑</option>
        </select>
      </div>

      {/* Video List */}
      <div className="space-y-1">
        {sorted.map(video => (
          <div key={video.videoId} className="rounded border border-cms-border bg-cms-surface">
            <button
              onClick={() => setExpandedId(expandedId === video.videoId ? null : video.videoId)}
              className="flex w-full items-center gap-3 p-3 text-left"
            >
              {/* Grade Badge */}
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-xs font-bold ${GRADE_COLORS[video.grade]}`}>
                {video.grade}
              </span>

              {/* Title + State */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-cms-text">{video.title}</p>
                {video.optimizationState && STATE_BADGES[video.optimizationState] && (
                  <span className={`text-[10px] ${STATE_BADGES[video.optimizationState]!.color}`}>
                    {STATE_BADGES[video.optimizationState]!.label}
                  </span>
                )}
              </div>

              {/* Mini Score Bars (hidden on mobile) */}
              <div className="hidden w-40 space-y-0.5 md:block">
                {video.axes.slice(0, 3).map(a => (
                  <YtScoreBar key={a.axis} axis={a.axis} score={a.normalized} showLabel={false} />
                ))}
              </div>

              {/* Score + Trend */}
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-medium text-cms-text">{Math.round(video.score)}</span>
                <span className={`text-xs ${video.trend.direction === 'up' ? 'text-[#34d399]' : video.trend.direction === 'down' ? 'text-[#f87171]' : 'text-cms-text-muted'}`}>
                  {video.trend.direction === 'up' ? '↑' : video.trend.direction === 'down' ? '↓' : '→'}
                </span>
              </div>
            </button>

            {/* Expanded Diagnostic */}
            {expandedId === video.videoId && (
              <div className="px-3 pb-3">
                <YtVideoDiagnostic
                  video={{
                    videoId: video.videoId,
                    title: video.title,
                    axes: video.axes,
                    retentionCurve: video.retentionCurve,
                    avgViewPercentage: video.avgViewPercentage,
                    diagnosis: video.diagnosis,
                    recommendation: video.recommendation,
                    optimizationState: video.optimizationState,
                    trafficSources: video.trafficSources,
                  }}
                  onCreateAbTest={onCreateAbTest}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
