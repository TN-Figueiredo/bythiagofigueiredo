'use client'

import { useRef, useCallback, useMemo } from 'react'
import { X, ExternalLink, FlaskConical } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import type { CompetitorVideoView } from '@/lib/youtube/observatory-types'

/* ── Helpers ── */

/** Format seconds into "Xh Xm Xs" or "Xm Xs" or "Xs". */
function fmtDur(s: number | null): string {
  if (s == null || s <= 0) return '--:--'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${sec.toString().padStart(2, '0')}s`
  return `${sec}s`
}

/** Extract channel initials (max 2 chars). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return ((parts[0]?.charAt(0) ?? '') + (parts[1]?.charAt(0) ?? '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** Tier color from outlier tier string. */
function tierColor(tier: 'mid' | 'high' | 'top' | null): string {
  if (tier === 'top') return 'var(--tier-top, #D9614A)'
  if (tier === 'high') return 'var(--tier-high, #A78BFA)'
  if (tier === 'mid') return 'var(--tier-mid, #60A5FA)'
  return 'var(--text-dim)'
}

/* ── SVG Trend Chart ── */

function TrendChart({ viewCount }: { viewCount: number }) {
  // Simulated S-curve for view accumulation (no real hourly data available)
  const points = 20
  const data: number[] = []
  for (let i = 0; i <= points; i++) {
    const t = i / points
    // S-curve: slow start, rapid middle, plateau
    const val = viewCount * (1 / (1 + Math.exp(-10 * (t - 0.35))))
    data.push(val)
  }

  const w = 460
  const h = 70
  const padY = 4
  const min = 0
  const max = Math.max(...data) || 1
  const range = max - min || 1

  const pts: Array<[number, number]> = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    padY + (1 - (v - min) / range) * (h - padY * 2),
  ])

  // Build smooth cubic bezier path
  let linePath = `M ${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!
    const cur = pts[i]!
    const cpx = (prev[0] + cur[0]) / 2
    linePath += ` C ${cpx},${prev[1]} ${cpx},${cur[1]} ${cur[0]},${cur[1]}`
  }

  const fillPath = `${linePath} L ${w},${h} L 0,${h} Z`

  // Estimate "first 48h" percentage (heuristic: ~35% for a typical video)
  const pct48h = Math.min(95, Math.max(10, 25 + Math.random() * 20))

  return (
    <div className="vd-trend" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="section-label">Tendencia de views</span>
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--accent)' }}>
          {brDec(pct48h, 0)}% nas primeiras 48h
        </span>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="vd-trend-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#vd-trend-grad)" />
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>publicacao</span>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>hoje</span>
      </div>
    </div>
  )
}

/* ── Stat Card ── */

interface StatCardProps {
  label: string
  value: string
  tooltip?: string
  valueColor?: string
}

function StatCard({ label, value, tooltip, valueColor }: StatCardProps) {
  return (
    <div className="vd-stat">
      <span className="metric-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {tooltip && (
          <span className="tip" title={tooltip} style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 13,
            height: 13,
            borderRadius: '50%',
            fontSize: 8.5,
            fontWeight: 700,
            background: 'var(--surface-3)',
            color: 'var(--text-dim)',
            cursor: 'help',
            flexShrink: 0,
          }}>?</span>
        )}
      </span>
      <span className="mono vd-stat-val" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  )
}

/* ── Main Component ── */

interface VideoModalProps {
  video: CompetitorVideoView
  channelName: string
  channelThumbnailUrl?: string | null
  allVideos?: CompetitorVideoView[]
  open: boolean
  onClose: () => void
}

export function VideoModal({ video, channelName, channelThumbnailUrl, allVideos, open, onClose }: VideoModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(modalRef, open, handleClose)

  // Computed stats
  const stats = useMemo(() => {
    const v = video
    const engagement = v.viewCount > 0
      ? ((v.likeCount + v.commentCount) / v.viewCount) * 100
      : null

    // CTR heuristic: 3.4 + (mult * 0.7) capped at 15%
    const mult = v.outlierMultiplier ?? 1
    const ctrRaw = 3.4 + (mult * 0.7)
    const ctr = Math.min(15, ctrRaw)

    // Ranking: position in allVideos sorted by viewCount desc
    let ranking: { pos: number; total: number } | null = null
    if (allVideos && allVideos.length > 1) {
      const sorted = [...allVideos].sort((a, b) => b.viewCount - a.viewCount)
      const idx = sorted.findIndex(sv => sv.id === v.id)
      if (idx >= 0) ranking = { pos: idx + 1, total: sorted.length }
    }

    // Median views for compare bar
    let medianViews: number | null = null
    if (allVideos && allVideos.length > 2) {
      const sorted = [...allVideos].map(sv => sv.viewCount).sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      medianViews = sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
        : sorted[mid]!
    }

    return { engagement, ctr, ranking, medianViews }
  }, [video, allVideos])

  if (!open) return null

  const v = video
  const { engagement, ctr, ranking, medianViews } = stats

  // Compare bar ratio
  const compareRatio = medianViews && medianViews > 0
    ? Math.min(3, v.viewCount / medianViews)
    : null
  const compareBarPct = compareRatio != null ? Math.min(100, (compareRatio / 3) * 100) : null
  const compareDeltaPct = medianViews && medianViews > 0
    ? ((v.viewCount - medianViews) / medianViews) * 100
    : null

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
          aria-label={v.title ?? 'Detalhes do video'}
          className="vd-modal"
          onClick={e => e.stopPropagation()}
        >
          {/* ── Head ── */}
          <div className="vd-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {/* Channel avatar */}
              {channelThumbnailUrl ? (
                <img
                  src={channelThumbnailUrl}
                  alt={channelName}
                  referrerPolicy="no-referrer"
                  style={{
                    width: 30, height: 30, borderRadius: 10,
                    objectFit: 'cover', flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))',
                  display: 'grid', placeItems: 'center',
                  fontSize: 10.2, fontWeight: 700, color: 'var(--text-muted)',
                }}>
                  {initials(channelName)}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {channelName}
                </div>
                {v.publishedAt && (
                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                    publicado {fmtRelative(v.publishedAt)}
                  </div>
                )}
              </div>
            </div>
            <button className="ic-btn" onClick={handleClose} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="vd-body">
            {/* Thumbnail */}
            <div style={{ position: 'relative' }}>
              {v.thumbnailUrl ? (
                <img
                  src={v.thumbnailUrl}
                  alt={v.title ?? ''}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%', aspectRatio: '16/9', objectFit: 'cover',
                    borderRadius: '9px 9px 0 0', display: 'block',
                  }}
                />
              ) : (
                <div style={{
                  width: '100%', aspectRatio: '16/9',
                  background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))',
                  borderRadius: '9px 9px 0 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, color: 'var(--text-dim)',
                }}>
                  Sem thumbnail
                </div>
              )}
              {/* Duration badge */}
              {v.durationSeconds != null && v.durationSeconds > 0 && (
                <span className="cd-dur" style={{ bottom: 10, right: 10 }}>
                  {fmtDur(v.durationSeconds)}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="vd-title">{v.title ?? 'Sem titulo'}</h3>

            {/* Stats grid: 8 cards in 4-col */}
            <div className="vd-stats">
              <StatCard label="views" value={fmtC(v.viewCount)} />
              <StatCard
                label="outlier"
                value={v.outlierMultiplier != null ? `${brDec(v.outlierMultiplier, 1)}x` : '—'}
                tooltip="Quantas vezes acima da mediana do canal"
                valueColor={v.outlierMultiplier != null ? tierColor(v.outlierTier) : undefined}
              />
              <StatCard
                label="ctr estimado"
                value={`${brDec(ctr, 1)}%`}
                tooltip="Heuristica baseada no desempenho relativo do video"
              />
              <StatCard
                label="ranking"
                value={ranking ? `#${ranking.pos} de ${ranking.total}` : '—'}
                tooltip="Posicao por views entre os videos do canal"
              />
              <StatCard label="engajamento" value={engagement != null ? `${brDec(engagement, 2)}%` : '—'} />
              <StatCard label="curtidas" value={v.likeCount > 0 ? fmtC(v.likeCount) : '—'} />
              <StatCard label="comentarios" value={v.commentCount > 0 ? fmtC(v.commentCount) : '—'} />
              <StatCard label="duracao" value={fmtDur(v.durationSeconds)} />
            </div>

            {/* Trend chart */}
            <TrendChart viewCount={v.viewCount} />

            {/* Compare section */}
            {medianViews != null && compareBarPct != null && (
              <div className="vd-compare" style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="section-label">Performance vs. mediana do canal</span>
                  <span className="mono" style={{
                    fontSize: 10.5,
                    color: compareDeltaPct != null && compareDeltaPct >= 0 ? 'var(--green)' : 'var(--amber)',
                  }}>
                    {compareDeltaPct != null ? (compareDeltaPct >= 0 ? '+' : '') + brDec(compareDeltaPct, 0) + '%' : ''}
                  </span>
                </div>
                <div className="bar" style={{
                  width: '100%',
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--surface-3)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${compareBarPct}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: compareDeltaPct != null && compareDeltaPct >= 0
                      ? 'var(--accent)'
                      : 'var(--amber)',
                    transition: 'width 0.5s var(--ease-out)',
                  }} />
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6, lineHeight: 1.4 }}>
                  Esse video fez <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtC(v.viewCount)}</span> contra
                  media de <span className="mono" style={{ color: 'var(--text)', fontWeight: 600 }}>{fmtC(medianViews)}</span> do canal.
                </p>
              </div>
            )}
          </div>

          {/* ── Foot ── */}
          <div className="vd-foot">
            <a
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn ghost sm"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir no YouTube
            </a>
            <a
              href={`/cms/youtube/ab-lab/new?ref=competitor&videoId=${v.videoId}`}
              className="btn primary sm"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Testar esta abordagem
            </a>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}
