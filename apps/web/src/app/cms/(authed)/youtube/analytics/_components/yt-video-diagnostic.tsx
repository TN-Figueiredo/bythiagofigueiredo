'use client'

import { YtScoreBar } from './yt-score-bar'
import { YtRetentionCurveV2 } from './yt-retention-curve-v2'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface VideoAnalytics {
  videoId: string
  title: string
  axes: Array<{ axis: Axis; normalized: number }>
  retentionCurve: number[] | null
  avgViewPercentage: number
  diagnosis: string | null
  recommendation: string | null
  optimizationState: string | null
  trafficSources: Record<string, number> | null
}

interface Props {
  video: VideoAnalytics
  onCreateAbTest?: (videoId: string, testType: string) => void
  onDismiss?: (videoId: string) => void
}

export function YtVideoDiagnostic({ video, onCreateAbTest, onDismiss }: Props) {
  const weakestAxis = video.axes.reduce((min, a) => a.normalized < min.normalized ? a : min, video.axes[0]!)

  return (
    <div className="space-y-3 border-t border-cms-border pt-3">
      {/* Score Bars */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {video.axes.map(a => (
          <YtScoreBar key={a.axis} axis={a.axis} score={a.normalized} />
        ))}
      </div>

      {/* Weakest Axis Call-out */}
      <div className="rounded border border-[#f87171]/30 bg-[#f87171]/5 px-3 py-2">
        <p className="text-xs font-medium text-[#f87171]">
          Maior Fraqueza: {AXIS_LABELS[weakestAxis.axis]} ({Math.round(weakestAxis.normalized)}/100)
        </p>
      </div>

      {/* Retention Curve */}
      <YtRetentionCurveV2
        retentionCurve={video.retentionCurve}
        avgViewPercentage={video.avgViewPercentage}
      />

      {/* Traffic Sources */}
      {video.trafficSources && (
        <div className="flex gap-2 text-[10px] text-cms-text-muted">
          {Object.entries(video.trafficSources)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([key, val]) => (
              <span key={key} className="rounded bg-cms-surface px-1.5 py-0.5">
                {key} {val}%
              </span>
            ))}
        </div>
      )}

      {/* AI Recommendation */}
      {video.recommendation && (
        <div className="rounded border border-cms-border bg-cms-surface p-3">
          <p className="mb-1 text-[10px] font-medium text-cms-text-muted">Recomendação AI</p>
          <p className="text-xs text-cms-text">{video.recommendation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onCreateAbTest && (
          <button
            onClick={() => onCreateAbTest(video.videoId, weakestAxis.axis === 'ctr' ? 'thumbnail' : 'title')}
            className="rounded bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#FF9A60]"
          >
            Criar A/B Test
          </button>
        )}
        {onDismiss && (
          <button
            onClick={() => onDismiss(video.videoId)}
            className="rounded border border-cms-border px-3 py-1.5 text-xs text-cms-text-muted hover:bg-cms-surface"
          >
            Dispensar
          </button>
        )}
      </div>
    </div>
  )
}
