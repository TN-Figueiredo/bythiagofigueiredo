'use client'

import { useRef, useState, useCallback } from 'react'
import { X, ExternalLink, ChevronDown, Users, Search, List, LayoutGrid } from 'lucide-react'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import type { CompetitorChannelView, CompetitorVideoView } from '@/lib/youtube/observatory-types'

/* ── Constants ── */

const PAGE_SIZE = 16
const BATCH_SIZE = 8

/* ── Helpers ── */

interface ChannelDrawerProps {
  channel: CompetitorChannelView
  open: boolean
  onClose: () => void
  onVideoClick: (video: CompetitorVideoView, channelName: string, channelThumbnailUrl?: string | null, allVideos?: CompetitorVideoView[]) => void
}

type ViewMode = 'list' | 'grid'
type SortKey = 'recent' | 'views' | 'outlier' | 'engagement'

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

/** Duration formatter: 125 -> "2:05" */
function fmtDur(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Tier color from outlier multiplier. */
function multTierColor(mult: number | null): string {
  if (mult == null) return 'var(--text-dim)'
  if (mult >= 10) return 'var(--tier-top)'
  if (mult >= 5) return 'var(--tier-high)'
  if (mult >= 2) return 'var(--tier-mid)'
  return 'var(--text-dim)'
}

/** Engagement rate: (likes + comments) / views */
function engRate(v: CompetitorVideoView): number {
  return v.viewCount > 0 ? (v.likeCount + v.commentCount) / v.viewCount : 0
}

/* ── Main Component ── */

export function ChannelDrawer({ channel, open, onClose, onVideoClick }: ChannelDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [vsYouIdx, setVsYouIdx] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')

  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(drawerRef, open, handleClose)

  if (!open) return null

  const ch = channel
  const allVideos = [...ch.recentVideos]

  // Filter by search query
  const filtered = searchQuery.trim()
    ? allVideos.filter(v => v.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : allVideos

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'views') return b.viewCount - a.viewCount
    if (sortKey === 'outlier') return (b.outlierMultiplier ?? 0) - (a.outlierMultiplier ?? 0)
    if (sortKey === 'engagement') return engRate(b) - engRate(a)
    return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
  })

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length
  const remaining = sorted.length - visibleCount

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
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
        style={{
          width: '100%',
          maxWidth: 780,
          background: 'var(--bg, #1A1714)',
          boxShadow: 'var(--shadow-pop)',
          animation: 'fade var(--t-enter) var(--ease-out) both',
        }}
      >
        {/* cd-head — matches handoff: avatar 46px + name 17px + YouTube link + meta */}
        <div className="cd-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 0, alignItems: 'center' }}>
            {/* Avatar 46x46, border-radius 10px */}
            {ch.thumbnailUrl ? (
              <img
                src={ch.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                style={{ width: 46, height: 46, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 46, height: 46, borderRadius: 10, flexShrink: 0,
                display: 'grid', placeItems: 'center',
                background: `linear-gradient(145deg, var(--accent), rgba(255,130,64,0.6))`,
                color: 'var(--on-accent)', fontWeight: 700, fontSize: 15.6, letterSpacing: '-0.5px',
              }}>
                {ch.channelName.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              {/* Name 17px/600 + YouTube link inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ch.channelName}
                </h2>
                <a
                  href={`https://www.youtube.com/channel/${ch.channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cd-yt"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink style={{ width: 12, height: 12 }} aria-hidden="true" />
                  YouTube
                </a>
              </div>
              {/* Meta: 11.5px mono dim — "N inscritos · N vídeos · sync há Xh" */}
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2, display: 'block' }}>
                {ch.subscriberCount != null ? fmtC(ch.subscriberCount) : '—'} inscritos
                {' · '}{ch.videoCount} vídeos
                {' · sync '}{ch.lastSyncedAt ? fmtRelative(ch.lastSyncedAt) : '—'}
              </span>
            </div>
          </div>
          <button
            className="ic-btn"
            onClick={handleClose}
            aria-label="Fechar"
            style={{ flexShrink: 0 }}
          >
            <X style={{ width: 16, height: 16 }} aria-hidden="true" />
          </button>
        </div>

        {/* cd-stats — handoff: 5 stat cards (comes BEFORE cd-versus per handoff order) */}
        <div className="cd-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, padding: '14px 22px', borderBottom: '1px solid var(--border)' }}>
          {(() => {
            const outlierVideos = allVideos.filter(v => (v.outlierMultiplier ?? 0) >= 2)
            const bestMult = outlierVideos.reduce<number | null>((m, v) => v.outlierMultiplier != null && (m === null || v.outlierMultiplier > m) ? v.outlierMultiplier : m, null)
            const tierColor = bestMult != null ? (bestMult >= 10 ? 'var(--tier-top)' : bestMult >= 5 ? 'var(--tier-high)' : 'var(--tier-mid)') : undefined
            const recentDays = 28
            const recentVideos = allVideos.filter(v => v.publishedAt && (Date.now() - new Date(v.publishedAt).getTime()) < recentDays * 86_400_000)
            const cadence = recentDays > 0 ? recentVideos.length / (recentDays / 7) : 0

            return (<>
              <div className="cd-stat" style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                <span className="metric-label">Melhor outlier</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, display: 'block', marginTop: 4, color: tierColor ?? 'var(--text)' }}>
                  {bestMult != null ? `${brDec(bestMult, 1)}x` : '—'}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>vs. mediana</span>
              </div>
              <div className="cd-stat" style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                <span className="metric-label">Views médias</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, display: 'block', marginTop: 4 }}>
                  {fmtC(avgViews)}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>por vídeo</span>
              </div>
              <div className="cd-stat" style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                <span className="metric-label">Cadência</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, display: 'block', marginTop: 4 }}>
                  {brDec(cadence, 1)}/sem
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>ritmo de upload</span>
              </div>
              <div className="cd-stat" style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                <span className="metric-label">Outliers</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, display: 'block', marginTop: 4, color: outlierVideos.length > 0 ? 'var(--accent)' : undefined }}>
                  {outlierVideos.length}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>&ge; 2x mediana</span>
              </div>
              <div className="cd-stat" style={{ background: 'var(--surface-2)', borderRadius: 9, padding: '10px 12px' }}>
                <span className="metric-label">Último upload</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, display: 'block', marginTop: 4 }}>
                  {daysSinceLast != null ? `há ${daysSinceLast}d` : '—'}
                </span>
              </div>
            </>)
          })()}
        </div>

        {/* cd-versus — one row per own channel (no toggle, show all at once) */}
        {ch.vsYou && ch.vsYou.length > 0 && ch.vsYou.map((vs, vsIdx) => (
          <div key={vs.channelId} className="cd-versus" style={{ padding: '12px 22px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
            <span className="cd-versus-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-muted)', textTransform: 'uppercase' as const }}>
              <Users style={{ width: 12, height: 12, stroke: 'var(--text-dim)' }} aria-hidden="true" />
              vs. você · {vs.channelName}
            </span>
              {/* cd-versus-items: handoff grid 4-col, each with metric-label + value mono + vs-pill badge */}
              <div className="cd-versus-items" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 10 }}>
                {/* Engajamento */}
                <div className="vs-item">
                  <span className="metric-label">Engajamento</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {ch.avgEngagement != null && ch.avgEngagement > 0 && (
                      <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{brDec(ch.avgEngagement * 100, 1)}%</span>
                    )}
                    {(() => {
                      const d = vs.engagementDelta
                      const isGood = d <= 0
                      const color = isGood ? 'var(--green)' : 'var(--amber)'
                      return (
                        <span className="vs-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-jetbrains)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isGood
                              ? <><path d="M22 17l-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></>
                              : <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>
                            }
                          </svg>
                          {d > 0 ? '+' : '−'}{brDec(Math.abs(d * 100), 1)} pts
                        </span>
                      )
                    })()}
                  </div>
                </div>
                {/* Cresce/sem */}
                <div className="vs-item">
                  <span className="metric-label">Cresce/sem</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {(() => {
                      const d = vs.subsDelta
                      const ratio = ch.subscriberCount && ch.subscriberCount > 0 ? d / (ch.subscriberCount || 1) : 0
                      const isGood = d <= 0
                      const color = isGood ? 'var(--green)' : 'var(--amber)'
                      const label = Math.abs(ratio) > 0.01 ? `${brDec(Math.abs(ratio), 1)}×` : fmtC(Math.abs(Math.round(d)))
                      return (
                        <span className="vs-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-jetbrains)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isGood
                              ? <><path d="M22 17l-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></>
                              : <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>
                            }
                          </svg>
                          {label}
                        </span>
                      )
                    })()}
                  </div>
                </div>
                {/* Cadência */}
                <div className="vs-item">
                  <span className="metric-label">Cadência</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {(() => {
                      const d = vs.frequencyDelta
                      const isGood = d <= 0
                      const color = isGood ? 'var(--green)' : 'var(--amber)'
                      return (
                        <span className="vs-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-jetbrains)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isGood
                              ? <><path d="M22 17l-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></>
                              : <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>
                            }
                          </svg>
                          {brDec(Math.abs(d), 1)}×
                        </span>
                      )
                    })()}
                  </div>
                </div>
                {/* Views médias */}
                <div className="vs-item">
                  <span className="metric-label">Views médias</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {(() => {
                      const d = vs.avgViewsDelta
                      const isGood = d <= 0
                      const color = isGood ? 'var(--green)' : 'var(--amber)'
                      return (
                        <span className="vs-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: 'var(--font-jetbrains)', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {isGood
                              ? <><path d="M22 17l-8.5-8.5-5 5L2 7" /><path d="M16 17h6v-6" /></>
                              : <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>
                            }
                          </svg>
                          {brDec(Math.abs(d), 1)}×
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>
          </div>
        ))}

        {/* cd-controls — handoff: search-wrap + sort pills + view mode pills */}
        <div className="cd-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 22px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {/* Search input */}
          <div className="search-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 0%', minWidth: 180, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 9, padding: '6px 10px' }}>
            <Search style={{ width: 14, height: 14, stroke: 'var(--text-dim)', flexShrink: 0 }} aria-hidden="true" />
            <input
              className="search-input"
              placeholder="Buscar vídeo…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, flex: 1, padding: 0 }}
            />
          </div>
          {/* Sort pills */}
          <div className="seg-pills">
            {(['recent', 'views', 'outlier', 'engagement'] as const).map(k => (
              <button
                key={k}
                className={`seg-pill ${sortKey === k ? 'on' : ''}`}
                onClick={() => setSortKey(k)}
              >
                {k === 'recent' ? 'Recentes' : k === 'views' ? 'Mais vistos' : k === 'outlier' ? 'Outlier' : 'Engaj.'}
              </button>
            ))}
          </div>
          {/* View mode pills (icons) */}
          <div className="seg-pills">
            <button
              className={`seg-pill ${viewMode === 'list' ? 'on' : ''}`}
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List style={{ width: 14, height: 14 }} aria-hidden="true" />
            </button>
            <button
              className={`seg-pill ${viewMode === 'grid' ? 'on' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grade"
            >
              <LayoutGrid style={{ width: 14, height: 14 }} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* cd-body */}
        <div className="cd-body">
          {/* header row */}
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span className="dim" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {sorted.length} vídeos · mostrando {visible.length}
            </span>
            <span className="dim" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
              multiplicador = views ÷ mediana do canal
            </span>
          </div>

          {viewMode === 'list' ? (
            <div className="cd-list">
              {visible.map(v => (
                <VideoRow
                  key={v.id}
                  video={v}
                  onClick={() => onVideoClick(v, ch.channelName, ch.thumbnailUrl, allVideos)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {visible.map(v => (
                <VideoCard
                  key={v.id}
                  video={v}
                  onClick={() => onVideoClick(v, ch.channelName, ch.thumbnailUrl, allVideos)}
                />
              ))}
            </div>
          )}

          {/* cd-more pagination */}
          {hasMore && (
            <button
              className="cd-more"
              onClick={() => setVisibleCount(c => c + BATCH_SIZE)}
            >
              <ChevronDown style={{ width: 15, height: 15 }} aria-hidden="true" />
              Carregar mais {remaining} de {sorted.length}
            </button>
          )}
        </div>
      </div>
    </YtPortal>
  )
}

/* ── VideoRow (list mode) — matches handoff cd-row exactly ── */

function VideoRow({ video: v, onClick }: { video: CompetitorVideoView; onClick: () => void }) {
  const mult = v.outlierMultiplier ?? 0
  const tierColor = multTierColor(v.outlierMultiplier)
  const hasEngData = v.likeCount > 0 || v.commentCount > 0
  const eng = engRate(v)

  return (
    <button
      className="cd-row"
      onClick={onClick}
    >
      {/* cd-row-thumb */}
      <div className="cd-row-thumb">
        {v.thumbnailUrl ? (
          <img
            src={v.thumbnailUrl}
            alt={v.title ?? ''}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        ) : (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 9',
              background: 'linear-gradient(145deg, var(--surface-3), var(--surface-2))',
            }}
          />
        )}
        {v.durationSeconds != null && (
          <span className="cd-dur sm">{fmtDur(v.durationSeconds)}</span>
        )}
      </div>

      {/* title + date */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          className="line-clamp-2"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)' }}
        >
          {v.title}
        </div>
        <div
          className="mono"
          style={{ fontSize: 10.5, marginTop: 4, color: 'var(--text-dim)' }}
        >
          {v.publishedAt ? fmtRelative(v.publishedAt) : '—'}
        </div>
      </div>

      {/* cd-row-stats: 3 columns */}
      <div className="cd-row-stats">
        {/* views */}
        <div className="cd-rs">
          <span className="mono cd-rs-v">{fmtC(v.viewCount)}</span>
          <span className="metric-label">views</span>
        </div>
        {/* engaj. */}
        <div className="cd-rs">
          <span className="mono cd-rs-v" style={!hasEngData ? { color: 'var(--text-dim)' } : undefined}>
            {hasEngData ? `${brDec(eng * 100, 1)}%` : '—'}
          </span>
          <span className="metric-label">engaj.</span>
        </div>
        {/* outlier */}
        <div className="cd-rs">
          <span
            className="mono cd-rs-v"
            style={{ color: mult >= 2 ? tierColor : 'var(--text-dim)' }}
          >
            {mult >= 2 ? `${brDec(mult, 1)}x` : '—'}
          </span>
          <span className="metric-label">outlier</span>
        </div>
      </div>
    </button>
  )
}

/* ── VideoCard (grid mode) ── */

function VideoCard({ video: v, onClick }: { video: CompetitorVideoView; onClick: () => void }) {
  const mult = v.outlierMultiplier ?? 0
  const tierColor = multTierColor(v.outlierMultiplier)

  return (
    <div
      className="cd-row rounded-lg overflow-hidden cursor-pointer"
      style={{ border: '1px solid var(--border)', display: 'block', padding: 0, borderBottom: 'none' }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => handleKeyAction(e, onClick)}
    >
      <div style={{ position: 'relative' }}>
        {v.thumbnailUrl ? (
          <img
            src={v.thumbnailUrl}
            alt={v.title ?? ''}
            referrerPolicy="no-referrer"
            className="w-full aspect-video object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full aspect-video flex items-center justify-center"
            style={{ background: 'var(--surface-3)', color: 'var(--text-dim)', fontSize: 9 }}
          >
            Sem thumb
          </div>
        )}
        {v.durationSeconds != null && (
          <span className="cd-dur">{fmtDur(v.durationSeconds)}</span>
        )}
        {mult >= 2 && (
          <span
            className="cd-mult"
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              color: '#16110b',
              padding: '2px 6px',
              borderRadius: 5,
              background: tierColor,
            }}
          >
            {brDec(mult, 1)}x
          </span>
        )}
      </div>
      <div style={{ padding: '9px 11px 11px' }}>
        <p className="line-clamp-2" style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)', minHeight: 33 }}>
          {v.title}
        </p>
        <div className="flex items-center justify-between" style={{ marginTop: 7 }}>
          <span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>{fmtC(v.viewCount)}</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
            {v.publishedAt ? fmtRelative(v.publishedAt) : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}