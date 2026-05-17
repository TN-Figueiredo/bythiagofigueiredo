'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'
import { AbPauseDialog } from './ab-pause-dialog'

interface AbTestCardProps {
  test: AbTestWithVariants
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.95) return 'bg-green-500'
  if (confidence >= 0.8) return 'bg-amber-500'
  return 'bg-red-500'
}

function healthSymbol(confidence: number, threshold: number): { symbol: string; color: string } | null {
  if (confidence <= 0) return null
  if (confidence >= threshold) return { symbol: '↑', color: 'text-green-400' }
  if (confidence >= threshold * 0.85) return { symbol: '≈', color: 'text-amber-400' }
  return { symbol: '↓', color: 'text-red-400' }
}

export function AbTestCard({ test }: AbTestCardProps) {
  const [showPause, setShowPause] = useState(false)

  const isActive = test.status === 'active'
  const isPaused = test.status === 'paused'

  const statusBadgeClass = isActive
    ? 'bg-green-900/30 text-green-400'
    : isPaused
    ? 'bg-amber-900/30 text-amber-400'
    : 'bg-cms-surface-hover text-cms-text-muted'

  const days = daysSince(test.started_at)
  const threshold = test.config.confidence_threshold ?? 0.95

  const confidence = test.confidence_at_completion ?? 0
  const health = healthSymbol(confidence, threshold)
  const fillPercent = Math.min(confidence * 100, 100)
  const barColor = confidenceColor(confidence)

  const sortedVariants = [...test.variants].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass}`}>
          {test.status.charAt(0).toUpperCase() + test.status.slice(1)}
        </span>
        {test.started_at && (
          <span className="text-xs text-cms-text-muted">D{days}</span>
        )}
        {health && (
          <span className={`text-sm font-bold ${health.color}`}>{health.symbol}</span>
        )}
      </div>

      <p className="text-sm font-medium text-cms-text line-clamp-1">{test.name}</p>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-cms-text-muted">Confidence</span>
          <span className="text-xs text-cms-text-muted">
            {confidence > 0 ? `${Math.round(confidence * 100)}%` : 'No data yet'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-700">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      {sortedVariants.length > 0 && (
        <div className="flex items-end gap-2">
          {sortedVariants.map(variant => (
            <div key={variant.id} className="flex flex-col items-center gap-1">
              <div className="w-10 h-[22px] rounded overflow-hidden bg-cms-surface-hover">
                {variant.blob_url ? (
                  <Image
                    src={variant.blob_url}
                    alt={variant.label}
                    width={40}
                    height={22}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim" aria-hidden="true">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-cms-text-dim capitalize">{variant.label.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-cms-text-muted">Rotating daily</span>
        {test.total_cycles > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(test.total_cycles, 8) }).map((_, i) => {
              const variantIndex = i % Math.max(sortedVariants.length, 1)
              const colors = ['bg-blue-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400']
              return (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${colors[variantIndex % colors.length]}`}
                />
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-cms-border">
        {(isActive || isPaused) && (
          <button
            onClick={() => setShowPause(true)}
            className="text-xs text-cms-text-muted hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-cms-surface-hover"
          >
            Pause
          </button>
        )}
        <Link
          href={`/cms/youtube/ab-lab/${test.id}`}
          className="text-xs text-cms-accent hover:underline ml-auto"
        >
          Details
        </Link>
      </div>

      {showPause && (
        <AbPauseDialog test={test} onClose={() => setShowPause(false)} />
      )}
    </div>
  )
}
