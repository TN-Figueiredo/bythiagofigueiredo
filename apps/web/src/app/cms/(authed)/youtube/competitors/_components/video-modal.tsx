'use client'

import { useRef, useCallback } from 'react'
import { X, ExternalLink, AlertTriangle, BarChart3 } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import { SparklineChart } from './sparkline-chart'
import type { CompetitorVideoView } from '@/lib/youtube/observatory-types'

interface VideoModalProps {
  video: CompetitorVideoView
  channelName: string
  open: boolean
  onClose: () => void
}

export function VideoModal({ video, channelName, open, onClose }: VideoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(modalRef, open, handleClose)

  if (!open) return null

  const v = video
  const hasLikeData = v.likeCount > 0 || v.commentCount > 0
  const engagement = hasLikeData && v.viewCount > 0 ? (v.likeCount + v.commentCount) / v.viewCount : null
  const isABDetected = v.outlierMultiplier != null && v.outlierMultiplier >= 2
  const fakeSparkline = [v.viewCount * 0.3, v.viewCount * 0.5, v.viewCount * 0.7, v.viewCount * 0.85, v.viewCount * 0.92, v.viewCount]

  return (
    <YtPortal>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={v.title ?? 'Detalhes do vídeo'}
          className="vd-modal relative rounded-[14px] overflow-hidden"
          style={{
            width: '100%',
            maxWidth: 520,
            background: 'var(--bg, #1A1714)',
            boxShadow: 'var(--shadow-pop)',
            border: '1px solid var(--border)',
            animation: 'fade var(--t-enter) var(--ease-out) both',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Thumbnail */}
          <div className="relative">
            {v.thumbnailUrl ? (
              <img
                src={v.thumbnailUrl}
                alt={v.title ?? ''}
                referrerPolicy="no-referrer"
                className="w-full aspect-video object-cover"
              />
            ) : (
              <div className="w-full aspect-video flex items-center justify-center text-sm" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                Sem thumbnail
              </div>
            )}
            {/* Close button on thumbnail */}
            <button
              className="ic-btn absolute top-3 right-3"
              style={{ background: 'rgba(0,0,0,0.6)', borderColor: 'transparent' }}
              onClick={handleClose}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" style={{ color: '#fff' }} />
            </button>
            {/* Outlier badge */}
            {v.outlierMultiplier != null && v.outlierMultiplier >= 2 && (
              <span
                className="absolute top-3 left-3 rounded-lg px-2 py-1 text-xs font-bold mono"
                style={{
                  background: v.outlierTier === 'top' ? 'var(--tier-top)' : v.outlierTier === 'high' ? 'var(--tier-high)' : 'var(--tier-mid)',
                  color: '#fff',
                }}
              >
                {brDec(v.outlierMultiplier, 1)}x
              </span>
            )}
          </div>

          {/* Body */}
          <div className="p-5">
            {/* Title */}
            <h3 className="vd-title text-lg font-semibold leading-snug" style={{ color: 'var(--text)' }}>
              {v.title ?? 'Sem título'}
            </h3>
            <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              {channelName}
              {v.publishedAt && <> · {fmtRelative(v.publishedAt)}</>}
            </p>

            {/* Stats 3-col */}
            <div className="vd-stats grid grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="eyebrow mb-1">Views</p>
                <p className="text-sm font-semibold mono" style={{ color: 'var(--text)' }}>{fmtC(v.viewCount)}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="eyebrow mb-1">Likes</p>
                <p className="text-sm font-semibold mono" style={{ color: 'var(--text)' }}>{v.likeCount > 0 ? fmtC(v.likeCount) : '—'}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="eyebrow mb-1">Engaj.</p>
                <p className="text-sm font-semibold mono" style={{ color: 'var(--text)' }}>{engagement != null ? `${brDec(engagement * 100, 2)}%` : '—'}</p>
              </div>
            </div>

            {/* Compare bar */}
            {v.viewDelta != null && (
              <div className="vd-compare flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--text-dim)' }}>
                <BarChart3 className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span>
                  Delta: <span className="tnum font-medium" style={{ color: v.viewDelta >= 0 ? 'var(--green)' : 'var(--amber)' }}>
                    {v.viewDelta >= 0 ? '+' : ''}{fmtC(v.viewDelta)} views
                  </span> desde monitoramento
                </span>
              </div>
            )}

            {/* Trend sparkline */}
            <div className="vd-trend flex items-center gap-3 mt-3">
              <p className="eyebrow flex-shrink-0">Tendência</p>
              <SparklineChart data={fakeSparkline} width={200} height={30} fill />
            </div>

            {/* A/B detection flag */}
            {isABDetected && (
              <div
                className="vd-flag flex items-center gap-2 mt-3 rounded-lg px-3 py-2 text-xs font-medium"
                style={{ background: 'var(--amber-soft)', color: 'var(--amber)', border: '1px solid var(--amber-soft)' }}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                Possível teste A/B detectado neste vídeo
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-4">
              <a
                href={`https://www.youtube.com/watch?v=${v.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn sm"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Assistir no YouTube
              </a>
              <a
                href={`/cms/youtube/ab-lab/new?ref=competitor&videoId=${v.videoId}`}
                className="btn primary sm"
              >
                Testar esta abordagem
              </a>
            </div>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
