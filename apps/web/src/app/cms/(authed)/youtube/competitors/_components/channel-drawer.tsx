'use client'

import { useRef, useState, useCallback } from 'react'
import { X, ExternalLink, ChevronDown } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import { SparklineChart } from './sparkline-chart'
import type { CompetitorChannelView, CompetitorVideoView, VsYouComparison } from '@/lib/youtube/observatory-types'

interface ChannelDrawerProps {
  channel: CompetitorChannelView
  open: boolean
  onClose: () => void
  onVideoClick: (video: CompetitorVideoView, channelName: string) => void
}

type ViewMode = 'list' | 'grid'
type SortKey = 'recent' | 'views' | 'engagement'

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

export function ChannelDrawer({ channel, open, onClose, onVideoClick }: ChannelDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [visibleCount, setVisibleCount] = useState(10)

  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(drawerRef, open, handleClose)

  if (!open) return null

  const ch = channel
  const allVideos = [...ch.recentVideos]

  // Sort
  const sorted = [...allVideos].sort((a, b) => {
    if (sortKey === 'views') return b.viewCount - a.viewCount
    if (sortKey === 'engagement') {
      const engA = a.viewCount > 0 ? (a.likeCount + a.commentCount) / a.viewCount : 0
      const engB = b.viewCount > 0 ? (b.likeCount + b.commentCount) / b.viewCount : 0
      return engB - engA
    }
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
  })

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  // Compute stats
  const totalViews = allVideos.reduce((s, v) => s + v.viewCount, 0)
  const avgViews = allVideos.length > 0 ? Math.round(totalViews / allVideos.length) : 0
  const avgEngRate = ch.avgEngagement != null ? ch.avgEngagement : 0
  const firstVideo = allVideos[0]
  const daysSinceLast = firstVideo?.publishedAt
    ? Math.round((Date.now() - new Date(firstVideo.publishedAt).getTime()) / 86_400_000)
    : null

  return (
    <YtPortal>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${ch.channelName}`}
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: '100%',
          maxWidth: 780,
          background: 'var(--bg, #1A1714)',
          boxShadow: 'var(--shadow-pop)',
          animation: 'fade var(--t-enter) var(--ease-out) both',
        }}
      >
        {/* cd-head */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>
              {ch.channelName}
            </h2>
            <a
              href={`https://www.youtube.com/channel/${ch.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cd-yt inline-flex items-center gap-1 text-xs mt-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Abrir no YouTube <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
          <button
            className="ic-btn"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* cd-versus */}
        {ch.vsYou && (
          <div className="px-6 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
            <p className="eyebrow mb-2">VOCÊ vs {ch.channelName.toUpperCase()}</p>
            <div className="flex flex-wrap gap-2">
              <VsPill label="Inscritos" delta={ch.vsYou.subsDelta} format={fmtC} />
              <VsPill label="Engaj." delta={ch.vsYou.engagementDelta} format={v => `${brDec(v * 100, 1)}pp`} />
              <VsPill label="Views méd." delta={ch.vsYou.avgViewsDelta} format={fmtC} />
              <VsPill label="Frequência" delta={ch.vsYou.frequencyDelta} format={v => `${brDec(v, 1)}/mês`} />
            </div>
          </div>
        )}

        {/* cd-stats */}
        <div className="grid grid-cols-5 gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <StatBox label="Views totais" value={fmtC(totalViews)} highlight />
          <StatBox label="Média/vídeo" value={fmtC(avgViews)} />
          <StatBox label="Inscritos" value={ch.subscriberCount != null ? fmtC(ch.subscriberCount) : '—'} />
          <StatBox label="Engajamento" value={`${brDec(avgEngRate * 100, 1)}%`} />
          <StatBox label="Último upload" value={daysSinceLast != null ? `${daysSinceLast}d atrás` : '—'} />
        </div>

        {/* cd-controls */}
        <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="seg-pills">
            {(['recent', 'views', 'engagement'] as const).map(k => (
              <button
                key={k}
                className={`seg-pill ${sortKey === k ? 'on' : ''}`}
                onClick={() => setSortKey(k)}
              >
                {k === 'recent' ? 'Recentes' : k === 'views' ? 'Views' : 'Engaj.'}
              </button>
            ))}
          </div>
          <div className="seg-pills ml-auto">
            {(['list', 'grid'] as const).map(m => (
              <button
                key={m}
                className={`seg-pill ${viewMode === m ? 'on' : ''}`}
                onClick={() => setViewMode(m)}
              >
                {m === 'list' ? 'Lista' : 'Grade'}
              </button>
            ))}
          </div>
        </div>

        {/* cd-body */}
        <div className="flex-1 px-6 py-4 overflow-y-auto">
          {viewMode === 'list' ? (
            <div className="flex flex-col gap-2">
              {visible.map(v => (
                <div
                  key={v.id}
                  className="cd-row flex items-center gap-3 rounded-lg p-2 cursor-pointer"
                  style={{ border: '1px solid transparent' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onVideoClick(v, ch.channelName)}
                  onKeyDown={e => handleKeyAction(e, () => onVideoClick(v, ch.channelName))}
                >
                  <div className="relative flex-shrink-0">
                    {v.thumbnailUrl ? (
                      <img
                        src={v.thumbnailUrl}
                        alt={v.title ?? ''}
                        referrerPolicy="no-referrer"
                        className="cd-row-thumb h-14 w-24 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-14 w-24 rounded-lg flex items-center justify-center text-[9px]" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                        Sem thumb
                      </div>
                    )}
                    {v.durationSeconds != null && (
                      <span className="cd-dur absolute bottom-1 right-1 rounded px-1 py-0.5 text-[9px] font-medium" style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}>
                        {Math.floor(v.durationSeconds / 60)}:{(v.durationSeconds % 60).toString().padStart(2, '0')}
                      </span>
                    )}
                    {v.outlierMultiplier != null && v.outlierMultiplier >= 2 && (
                      <span
                        className="cd-mult absolute top-1 right-1 rounded px-1 py-0.5 text-[9px] font-bold mono"
                        style={{
                          background: v.outlierTier === 'top' ? 'var(--tier-top)' : v.outlierTier === 'high' ? 'var(--tier-high)' : 'var(--tier-mid)',
                          color: '#fff',
                        }}
                      >
                        {brDec(v.outlierMultiplier, 1)}x
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{v.title}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] tnum" style={{ color: 'var(--text-dim)' }}>
                      <span>{fmtC(v.viewCount)} views</span>
                      {v.publishedAt && <span>{fmtRelative(v.publishedAt)}</span>}
                      {v.likeCount > 0 && <span>{fmtC(v.likeCount)} likes</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {visible.map(v => (
                <div
                  key={v.id}
                  className="cd-row rounded-lg overflow-hidden cursor-pointer"
                  style={{ border: '1px solid var(--border)' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => onVideoClick(v, ch.channelName)}
                  onKeyDown={e => handleKeyAction(e, () => onVideoClick(v, ch.channelName))}
                >
                  {v.thumbnailUrl ? (
                    <img src={v.thumbnailUrl} alt={v.title ?? ''} referrerPolicy="no-referrer" className="w-full aspect-video object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center text-[9px]" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>Sem thumb</div>
                  )}
                  <div className="p-2">
                    <p className="text-[10px] font-medium line-clamp-2" style={{ color: 'var(--text)' }}>{v.title}</p>
                    <p className="text-[9px] tnum mt-0.5" style={{ color: 'var(--text-dim)' }}>{fmtC(v.viewCount)} views</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* cd-more */}
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                className="cd-more"
                onClick={() => setVisibleCount(c => c + 10)}
              >
                Carregar mais <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </YtPortal>
  )
}

function StatBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: highlight ? 'var(--accent-soft, rgba(255,130,64,0.1))' : 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <p className="eyebrow mb-1">{label}</p>
      <p className={`text-sm font-semibold mono ${highlight ? '' : ''}`} style={{ color: highlight ? 'var(--accent)' : 'var(--text)', fontSize: highlight ? '21px' : undefined }}>
        {value}
      </p>
    </div>
  )
}

function VsPill({ label, delta, format }: { label: string; delta: number; format: (n: number) => string }) {
  const isPositive = delta > 0
  const color = isPositive ? 'var(--green)' : delta < 0 ? 'var(--amber)' : 'var(--text-dim)'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium mono"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color }}
    >
      {label}: {isPositive ? '+' : ''}{format(delta)}
    </span>
  )
}
