'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import { SparklineChart } from './sparkline-chart'
import { ConfirmFullSyncDialog } from './confirm-full-sync-dialog'
import { useFullSyncProgress } from './useFullSyncProgress'
import { syncFullHistory, updateVideoLimit } from '../actions'
import type { CompetitorChannelView, CompetitorVideoView } from '@/lib/youtube/observatory-types'

/* ── Palette: deterministic gradient per channel name ── */

const AVATAR_COLORS = [
  '#E8753A',
  '#A78BFA',
  '#60A5FA',
  '#F472B6',
  '#34D399',
  '#FBBF24',
  '#F87171',
  '#818CF8',
]

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!
}

/* ── Helpers ── */

interface ChannelCardProps {
  channel: CompetitorChannelView
  onOpen: (channelId: string) => void
  onSync: (channelId: string) => void | Promise<void>
  onRemove: (channelId: string) => void
  onVideoClick: (video: CompetitorVideoView, channelName: string, channelThumbnailUrl?: string | null, allVideos?: CompetitorVideoView[]) => void
}

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

/* ── Avatar: 40x40, border-radius 10px, gradient bg ── */

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }}
      />
    )
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  const c = colorFor(name)
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(145deg, ${c}, ${c}60)`,
        color: '#fff',
        fontSize: 13.6,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {initials}
    </div>
  )
}

/* ── Outlier helpers for shelf header ── */

function getOutlierStats(videos: CompetitorVideoView[]) {
  const outliers = videos.filter(v => v.outlierMultiplier != null)
  const best = outliers.reduce<number | null>(
    (max, v) => (v.outlierMultiplier != null && (max === null || v.outlierMultiplier > max) ? v.outlierMultiplier : max),
    null,
  )
  return { count: outliers.length, bestMult: best }
}

/* ══════════════════════════════════════════════════════════════
   ChannelCard — matches handoff HTML structure exactly
   ══════════════════════════════════════════════════════════════ */

export function ChannelCard({ channel, onOpen, onSync, onRemove, onVideoClick }: ChannelCardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [showFullSyncDialog, setShowFullSyncDialog] = useState(false)
  const ch = channel
  const isFullSyncing = ch.syncStatus === 'syncing' && ch.syncMode === 'full'
  const syncProgress = useFullSyncProgress(ch.id, isFullSyncing)
  const isLimitReached = ch.videoCount >= ch.videoLimit
  const hasAllYouTube = !!(ch.youtubeVideoCount && ch.videoCount >= ch.youtubeVideoCount)
  const isComplete = hasAllYouTube || !!ch.fullSyncCompletedAt || isLimitReached
  const sparkColor = ch.growthDelta == null ? 'var(--text-dim)' : ch.growthDelta >= 0 ? 'var(--green)' : 'var(--amber)'
  const outlierStats = getOutlierStats(ch.recentVideos)

  return (
    <div
      className="chan-card clickable"
      style={{
        borderRadius: 14,
        border: '1px solid var(--border)',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--surface)',
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir canal ${ch.channelName}`}
      onClick={() => onOpen(ch.id)}
      onKeyDown={e => handleKeyAction(e, () => onOpen(ch.id))}
    >
      {/* ── card-pad ── */}
      <div style={{ padding: '14px 18px' }}>

        {/* row: avatar + info + actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Avatar name={ch.channelName} url={ch.thumbnailUrl} />

          {/* grow */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* row between: name col + action buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>

              {/* col: name + meta + change flags */}
              <div style={{ minWidth: 0 }}>
                {/* Name: 15px/600, truncate */}
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ch.channelName}
                </p>

                {/* Meta: 11.5px, mono, dim */}
                <p
                  className="mono"
                  style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}
                >
                  {ch.subscriberCount != null ? `${fmtC(ch.subscriberCount)} inscritos` : '—'}
                  {' · '}
                  {(() => {
                    if (ch.syncStatus === 'syncing') return 'sincronizando...'
                    if (isComplete) return `${ch.videoCount} vídeos (completo)`
                    return `${ch.videoCount} vídeos (recentes)`
                  })()}
                </p>

                {/* Change flags: pill, 10.5px/500 */}
                {ch.changeFlags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {ch.changeFlags.map(f => (
                      <span
                        key={f.type}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10.5,
                          fontWeight: 500,
                          background: 'var(--purple-soft)',
                          color: 'var(--purple)',
                          borderRadius: 999,
                          padding: '2px 7px',
                        }}
                      >
                        <RotateCcw style={{ width: 10, height: 10 }} />
                        trocou {f.type === 'thumbnail' ? 'thumb' : f.type} {fmtRelative(f.latestAt)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* chan-actions: sync + delete */}
              <div
                className="chan-actions"
                style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className={`ic-btn${isSyncing ? ' syncing' : ''}`}
                  disabled={isSyncing}
                  onClick={async () => {
                    setIsSyncing(true)
                    try { await onSync(ch.id) } finally { setIsSyncing(false) }
                  }}
                  aria-label={isSyncing ? 'Sincronizando...' : 'Sincronizar canal'}
                >
                  <RefreshCw style={{ width: 15, height: 15 }} aria-hidden="true" />
                </button>
                <button
                  className="ic-btn danger"
                  onClick={() => onRemove(ch.id)}
                  aria-label="Remover canal"
                >
                  <Trash2 style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Metrics row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>

          {/* Left col: engagement + growth */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              {/* Engagement */}
              <div>
                <p className="metric-label">Engaj. médio</p>
                <p className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>
                  {ch.avgEngagement != null && ch.avgEngagement > 0
                    ? `${brDec(ch.avgEngagement * 100, 1)}%`
                    : '—'}
                </p>
              </div>

              {/* Growth */}
              <div>
                <p className="metric-label">Crescimento</p>
                <div
                  className="mono"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 16,
                    fontWeight: 600,
                    color: sparkColor,
                    marginTop: 2,
                  }}
                >
                  {ch.growthDelta != null && ch.growthDelta >= 0 && (
                    <TrendingUp style={{ width: 13, height: 13 }} />
                  )}
                  {ch.growthDelta != null && ch.growthDelta < 0 && (
                    <TrendingDown style={{ width: 13, height: 13 }} />
                  )}
                  {ch.growthDelta != null
                    ? `${ch.growthDelta >= 0 ? '+' : ''}${fmtC(ch.growthDelta)}`
                    : '—'
                  }
                  <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-dim)' }}>/sem</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right col: sparkline + caption */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            {ch.growthSparkline.length > 1 && (
              <SparklineChart
                data={ch.growthSparkline}
                width={76}
                height={28}
                color={sparkColor}
                fill
              />
            )}
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-dim)' }}>
              inscritos · 30 dias
            </span>
          </div>
        </div>

        {/* ── vs-you (first own channel only on card) ── */}
        {ch.vsYou && ch.vsYou.length > 0 && (() => {
          const vs = ch.vsYou[0]!
          return (
            <div
              className="vs-you"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 11,
                paddingTop: 10,
                borderTop: '1px dashed var(--border-subtle)',
                fontSize: 11,
              }}
            >
              <Users style={{ width: 11, height: 11, stroke: 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-dim)' }}>vs {vs.channelName}</span>
              <span style={{ color: vs.engagementDelta > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>
                engaj {vs.engagementDelta > 0 ? '+' : ''}{brDec(vs.engagementDelta * 100, 1)} pts
              </span>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span style={{ color: vs.avgViewsDelta > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>
                {vs.avgViewsDelta > 0
                  ? `+${fmtC(Math.round(vs.avgViewsDelta))} views/vídeo`
                  : `${fmtC(Math.round(vs.avgViewsDelta))} views/vídeo`
                }
              </span>
            </div>
          )
        })()}

        {/* ── Sync time + open hint ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
          {ch.syncStatus === 'error' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--red)' }}>
                Sync falhou · {ch.videoCount} vídeos importados
              </span>
              <button
                className="sync-action"
                onClick={e => { e.stopPropagation(); setShowFullSyncDialog(true) }}
              >
                tentar novamente
              </button>
            </div>
          ) : isFullSyncing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                Buscando histórico... {syncProgress.progress}
                {syncProgress.total ? ` de ~${fmtC(syncProgress.total)}` : ''} vídeos
              </span>
              <div className="sync-bar">
                <span style={{ width: `${syncProgress.percent}%` }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
                {ch.lastSyncedAt ? `sincronizado ${fmtRelative(ch.lastSyncedAt)}` : 'nunca sincronizado'}
                {isComplete
                  ? ` · ${ch.videoCount} vídeos (completo)`
                  : ` · ${ch.videoCount} recentes`}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="sync-action"
                  title="Limite de vídeos monitorados — clique pra alternar"
                  onClick={e => {
                    e.stopPropagation()
                    const steps = [50, 100, 200] as const
                    const next = steps[(steps.indexOf(ch.videoLimit as 50 | 100 | 200) + 1) % steps.length] ?? 50
                    updateVideoLimit(ch.id, next)
                  }}
                >
                  limite: {ch.videoLimit}
                </button>
                {isComplete ? (
                  <span className="chan-open-hint" style={{ fontSize: 12, fontWeight: 500 }}>
                    ver canal
                    <ArrowRight style={{ width: 12, height: 12 }} />
                  </span>
                ) : (
                  <button
                    className="sync-action"
                    onClick={e => { e.stopPropagation(); setShowFullSyncDialog(true) }}
                  >
                    buscar histórico ›
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {showFullSyncDialog && (
          <ConfirmFullSyncDialog
            channelName={ch.channelName}
            youtubeVideoCount={ch.youtubeVideoCount}
            onConfirm={async () => {
              const result = await syncFullHistory(ch.id)
              setShowFullSyncDialog(false)
              if (!result.ok && result.error) {
                console.error('[full-sync]', result.error)
              }
            }}
            onClose={() => setShowFullSyncDialog(false)}
          />
        )}
      </div>

      {/* ── chan-shelf ── */}
      {ch.recentVideos.length > 0 && (
        <div className="chan-shelf">
          {/* shelf header */}
          <div className="chan-shelf-head">
            <span className="section-label">
              Vídeos{' '}
              <span className="mono" style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                ({ch.fullSyncCompletedAt ? 'histórico' : `${ch.recentVideos.length} ${isComplete ? 'completo' : 'recentes'}`})
              </span>
            </span>
            {outlierStats.count > 0 && outlierStats.bestMult != null && (
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--accent)' }}>
                {outlierStats.count} outlier{outlierStats.count > 1 ? 's' : ''} · melhor {brDec(outlierStats.bestMult, 0)}x
              </span>
            )}
          </div>

          {/* shelf row: 3 videos — handoff: shelf-vid buttons, thumb 16:9, shelf-cap (views mono + · time dim) */}
          <div className="chan-shelf-row">
            {ch.recentVideos.slice(0, 3).map(v => (
              <button
                key={v.id}
                className="shelf-vid"
                title={v.title ?? ''}
                onClick={e => { e.stopPropagation(); onVideoClick(v, ch.channelName, ch.thumbnailUrl, ch.recentVideos) }}
                onKeyDown={e => { e.stopPropagation(); handleKeyAction(e, () => onVideoClick(v, ch.channelName, ch.thumbnailUrl, ch.recentVideos)) }}
              >
                <div style={{ position: 'relative' }}>
                  {v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title ?? ''}
                      referrerPolicy="no-referrer"
                      className="thumb"
                      loading="lazy"
                      style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <div className="thumb" style={{ aspectRatio: '16/9', background: 'linear-gradient(150deg, var(--surface-3), var(--surface-2))' }} />
                  )}
                  {v.outlierMultiplier != null && v.outlierMultiplier >= 2 && (
                    <span
                      className="mono"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 4,
                        color: '#fff',
                        background: v.outlierMultiplier >= 10 ? 'var(--tier-top)' : v.outlierMultiplier >= 5 ? 'var(--tier-high)' : 'var(--tier-mid)',
                      }}
                    >
                      {brDec(v.outlierMultiplier, 1)}x
                    </span>
                  )}
                </div>
                <div className="shelf-cap">
                  <span className="mono">{fmtC(v.viewCount)}</span>
                  <span className="dim"> · {v.publishedAt ? fmtRelative(v.publishedAt) : '—'}</span>
                </div>
              </button>
            ))}
          </div>

          {/* see-all button */}
          <button
            className="chan-seeall"
            onClick={e => { e.stopPropagation(); onOpen(ch.id) }}
          >
            <BarChart3 style={{ width: 14, height: 14 }} />
            Ver todos os {ch.videoCount} vídeos
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}
    </div>
  )
}
