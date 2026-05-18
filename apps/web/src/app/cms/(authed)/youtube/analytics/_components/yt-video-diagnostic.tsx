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
}

export function YtVideoDiagnostic({ video, onCreateAbTest }: Props) {
  if (video.axes.length === 0) return null
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

      {/* AI Diagnosis & Recommendation */}
      {(video.diagnosis || video.recommendation) && (
        <div className="rounded border border-cms-border bg-cms-surface p-3 space-y-2">
          {video.diagnosis && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium text-cms-text-muted">Diagnóstico AI</p>
              <p className="text-xs text-cms-text">{video.diagnosis}</p>
            </div>
          )}
          {video.recommendation && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium text-cms-text-muted">Recomendação AI</p>
              <p className="text-xs text-cms-text">{video.recommendation}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {onCreateAbTest && (
        <div className="flex gap-2">
          <button
            onClick={() => onCreateAbTest(video.videoId, weakestAxis.axis === 'ctr' ? 'thumbnail' : 'title')}
            className="rounded bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-[#FF9A60]"
          >
            Criar A/B Test
          </button>
        </div>
      )}
    </div>
  )
}
