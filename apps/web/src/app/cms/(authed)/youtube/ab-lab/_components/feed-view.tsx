'use client'

import { useState } from 'react'
import { HomeCard } from './context-renderers'
import { Badge, VChip } from './ab-primitives'
import { formatPercent } from './ab-constants'
import type { ClickMomentVariant } from '@/lib/youtube/ab-wizard-adapter'

const DECOY_VIDEOS = [
  { title: 'How I Built a $1M Business in 90 Days', channelName: 'Growth Lab', views: '1.2M views', age: '2 weeks ago', thumbBg: '#2563eb', duration: '18:42' },
  { title: '10 Mistakes Every Creator Makes', channelName: 'Creator Academy', views: '845K views', age: '5 days ago', thumbBg: '#dc2626', duration: '12:15' },
  { title: 'The Science of Going Viral', channelName: 'Algorithm Insider', views: '2.1M views', age: '1 month ago', thumbBg: '#7c3aed', duration: '24:08' },
  { title: 'Morning Routine for Productivity', channelName: 'Daily Habits', views: '520K views', age: '3 days ago', thumbBg: '#059669', duration: '8:33' },
  { title: 'Best Camera Settings for YouTube', channelName: 'Tech Review Pro', views: '390K views', age: '1 week ago', thumbBg: '#d97706', duration: '15:47' },
]

// User's video is placed at grid index 4 (0-based), after the 4th decoy
const USER_VIDEO_INDEX = 4

interface FeedViewProps {
  variants: ClickMomentVariant[]
  selectedVariant?: string
  onSelectVariant?: (label: string) => void
}

export function FeedView({ variants, selectedVariant, onSelectVariant }: FeedViewProps) {
  const [localIdx, setLocalIdx] = useState(0)

  const selectedIdx = selectedVariant
    ? variants.findIndex(v => v.label === selectedVariant)
    : localIdx

  const activeIdx = selectedIdx < 0 ? 0 : selectedIdx
  const currentVariant = variants[activeIdx] ?? variants[0]

  function handleSelect(label: string, idx: number) {
    setLocalIdx(idx)
    onSelectVariant?.(label)
  }

  if (!currentVariant) return null

  // Build grid items: 4 decoys, then user video, then 1 more decoy
  const gridItems: Array<{ type: 'decoy'; data: (typeof DECOY_VIDEOS)[number] } | { type: 'user' }> = []
  for (let i = 0; i < DECOY_VIDEOS.length + 1; i++) {
    if (i === USER_VIDEO_INDEX) {
      gridItems.push({ type: 'user' })
    } else {
      const decoyIdx = i < USER_VIDEO_INDEX ? i : i - 1
      gridItems.push({ type: 'decoy', data: DECOY_VIDEOS[decoyIdx]! })
    }
  }

  return (
    <div className="bg-[#0f0f0f] rounded-xl p-4 space-y-5">
      {/* Feed grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gridItems.map((item, i) => {
          if (item.type === 'user') {
            return (
              <div
                key="user-video"
                className="relative rounded-xl overflow-hidden"
                style={{
                  outline: `2px solid ${currentVariant.color}`,
                  boxShadow: `0 0 12px 2px ${currentVariant.color}44`,
                }}
              >
                {/* "Your video" badge */}
                <div className="absolute top-2 right-2 z-10">
                  <Badge tone="live" dot>Seu vídeo</Badge>
                </div>
                <HomeCard
                  thumbUrl={currentVariant.thumbUrl ?? undefined}
                  thumbBg={currentVariant.thumbBg}
                  title={currentVariant.title}
                  channelName="Your Channel"
                  views="—"
                  age="Now testing"
                  duration="—"
                />
              </div>
            )
          }

          return (
            <div
              key={i}
              className="opacity-[0.62]"
              aria-hidden="true"
            >
              <HomeCard
                thumbBg={item.data.thumbBg}
                title={item.data.title}
                channelName={item.data.channelName}
                views={item.data.views}
                age={item.data.age}
                duration={item.data.duration}
              />
            </div>
          )
        })}
      </div>

      {/* Variant selector */}
      {variants.length > 1 && (
        <div
          role="radiogroup"
          aria-label="Selecionar variante para pré-visualizar"
          className="flex flex-wrap gap-2 pt-1"
        >
          {variants.map((v, idx) => (
            <button
              key={v.label}
              type="button"
              role="radio"
              aria-checked={idx === activeIdx}
              onClick={() => handleSelect(v.label, idx)}
              className={[
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                idx === activeIdx
                  ? 'border-transparent text-white'
                  : 'border-cms-border bg-cms-surface text-cms-text-muted hover:text-cms-text hover:border-cms-border-subtle',
              ].join(' ')}
              style={
                idx === activeIdx
                  ? { backgroundColor: v.color + '22', borderColor: v.color, color: v.color }
                  : undefined
              }
            >
              <VChip label={v.label} size={18} />
              <span>Variant {v.label}</span>
              {v.ctr > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded text-2xs font-mono"
                  style={{
                    backgroundColor: v.color + '22',
                    color: v.color,
                  }}
                >
                  {formatPercent(v.ctr)} CTR
                </span>
              )}
              {v.isLeader && !v.isWinner && (
                <Badge tone="amber">Líder</Badge>
              )}
              {v.isWinner && (
                <Badge tone="green">Vencedor</Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
