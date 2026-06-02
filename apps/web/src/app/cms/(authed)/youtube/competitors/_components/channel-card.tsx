'use client'

import { RefreshCw, Trash2, ChevronRight } from 'lucide-react'
import { fmtC, brDec, fmtRelative } from '@/lib/youtube/format'
import { SparklineChart } from './sparkline-chart'
import type { CompetitorChannelView, CompetitorVideoView } from '@/lib/youtube/observatory-types'

interface ChannelCardProps {
  channel: CompetitorChannelView
  onOpen: (channelId: string) => void
  onSync: (channelId: string) => void
  onRemove: (channelId: string) => void
  onVideoClick: (video: CompetitorVideoView, channelName: string) => void
}

function handleKeyAction(e: React.KeyboardEvent, fn: () => void) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        className="h-10 w-10 rounded-full flex-shrink-0 object-cover"
      />
    )
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  return (
    <div className="h-10 w-10 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold" style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}>
      {initials}
    </div>
  )
}

export function ChannelCard({ channel, onOpen, onSync, onRemove, onVideoClick }: ChannelCardProps) {
  const ch = channel

  return (
    <div
      className="chan-card clickable rounded-[14px] border overflow-hidden cursor-pointer"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(ch.id)}
      onKeyDown={e => handleKeyAction(e, () => onOpen(ch.id))}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <Avatar name={ch.channelName} url={ch.thumbnailUrl} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
            {ch.channelName}
          </p>
          <p className="text-xs mt-0.5 tnum" style={{ color: 'var(--text-dim)' }}>
            {ch.subscriberCount != null ? `${fmtC(ch.subscriberCount)} inscritos` : '—'}
            {' · '}
            {ch.videoCount} vídeos
          </p>
          {/* Change flags */}
          {ch.changeFlags.length > 0 && (
            <div className="flex gap-1.5 mt-1.5">
              {ch.changeFlags.map(f => (
                <span
                  key={f.type}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: 'rgba(167,139,250,0.18)', color: 'var(--purple)' }}
                >
                  trocou {f.type === 'thumbnail' ? 'thumb' : f.type} {fmtRelative(f.latestAt)}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Action buttons — stop propagation so card click doesn't fire */}
        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
          <button
            className="ic-btn"
            onClick={() => onSync(ch.id)}
            aria-label="Sincronizar canal"
          >
            <RefreshCw className="h-[13px] w-[13px]" />
          </button>
          <button
            className="ic-btn danger"
            onClick={() => onRemove(ch.id)}
            aria-label="Remover canal"
          >
            <Trash2 className="h-[13px] w-[13px]" />
          </button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center gap-4 px-4 pb-3">
        <div className="flex-1 min-w-0">
          <p className="eyebrow mb-1">Engaj. médio</p>
          <p className="text-sm font-semibold tnum" style={{ color: 'var(--text)' }}>
            {ch.avgEngagement != null ? `${brDec(ch.avgEngagement * 100, 1)}%` : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="min-w-0">
            <p className="eyebrow mb-1">Crescimento</p>
            <p className="text-sm font-semibold tnum" style={{ color: ch.growthDelta != null && ch.growthDelta >= 0 ? 'var(--green, #22C55E)' : 'var(--amber, #FBBF24)' }}>
              {ch.growthDelta != null ? `${ch.growthDelta >= 0 ? '+' : ''}${fmtC(ch.growthDelta)}/mês` : '—'}
            </p>
          </div>
          {ch.growthSparkline.length > 1 && (
            <SparklineChart
              data={ch.growthSparkline}
              color={ch.growthDelta != null && ch.growthDelta >= 0 ? '#22C55E' : '#FBBF24'}
              fill
            />
          )}
        </div>
      </div>

      {/* vs-you comparison */}
      {ch.vsYou && (
        <div
          className="flex items-center gap-3 px-4 py-2 text-xs"
          style={{ borderTop: '1px dashed var(--border)', color: 'var(--text-dim)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>vs você:</span>
          <VsPill label="inscritos" delta={ch.vsYou.subsDelta} format={fmtC} />
          <VsPill label="engaj." delta={ch.vsYou.engagementDelta} format={v => `${brDec(v * 100, 1)}pp`} />
          <VsPill label="views" delta={ch.vsYou.avgViewsDelta} format={fmtC} />
        </div>
      )}

      {/* Video shelf */}
      {ch.recentVideos.length > 0 && (
        <div className="px-3 py-3" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
          <p className="eyebrow mb-2 px-1">Vídeos recentes</p>
          <div className="flex gap-2">
            {ch.recentVideos.slice(0, 3).map(v => (
              <div
                key={v.id}
                className="shelf-vid flex-1 min-w-0 cursor-pointer rounded-lg overflow-hidden"
                style={{ border: '1px solid var(--border)' }}
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); onVideoClick(v, ch.channelName) }}
                onKeyDown={e => { e.stopPropagation(); handleKeyAction(e, () => onVideoClick(v, ch.channelName)) }}
              >
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt={v.title ?? ''} referrerPolicy="no-referrer" className="thumb w-full aspect-video object-cover" loading="lazy" style={{ borderColor: 'transparent', transition: 'border-color var(--t-fast) var(--ease-out)' }} />
                ) : (
                  <div className="w-full aspect-video flex items-center justify-center text-[9px]" style={{ background: 'var(--surface-3)', color: 'var(--text-dim)' }}>
                    Sem thumb
                  </div>
                )}
                <div className="p-1">
                  <p className="text-[10px] font-medium line-clamp-1" style={{ color: 'var(--text-muted)' }}>{v.title}</p>
                  <span className="text-[9px] tnum" style={{ color: 'var(--text-dim)' }}>
                    {fmtC(v.viewCount)} views
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button
            className="chan-seeall w-full mt-2 text-xs"
            onClick={e => { e.stopPropagation(); onOpen(ch.id) }}
          >
            Ver todos
          </button>
        </div>
      )}

      {/* Open hint */}
      <div
        className="flex items-center justify-center gap-1 py-2 text-xs"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="chan-open-hint">
          Ver detalhes <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  )
}

function VsPill({ label, delta, format }: { label: string; delta: number; format: (n: number) => string }) {
  const isPositive = delta > 0
  return (
    <span className="tnum" style={{ color: isPositive ? '#22C55E' : delta < 0 ? '#FBBF24' : 'var(--text-dim)' }}>
      {isPositive ? '+' : ''}{format(delta)} {label}
    </span>
  )
}
