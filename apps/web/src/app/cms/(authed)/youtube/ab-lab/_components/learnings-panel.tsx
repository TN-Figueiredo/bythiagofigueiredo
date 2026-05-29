'use client'

import { useState } from 'react'
import type { LearningsData, LearningsTag } from '@/lib/youtube/ab-types'

export interface LearningsPanelProps {
  learnings: LearningsData | null
}

const TAG_LIMIT = 20

function WinBar({ wins, maxWins }: { wins: number; maxWins: number }) {
  const segments = 5
  const filled = maxWins > 0 ? Math.round((wins / maxWins) * segments) : 0
  const clamped = Math.min(filled, segments)

  return (
    <div
      role="meter"
      aria-valuenow={wins}
      aria-valuemin={0}
      aria-valuemax={maxWins}
      aria-label={`${wins} wins`}
      className="flex gap-0.5"
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="inline-block w-3 h-2 rounded-sm"
          style={{
            backgroundColor: i < clamped ? 'var(--cms-accent)' : 'var(--cms-surface-3, #333)',
          }}
        />
      ))}
    </div>
  )
}

function TagRow({ tag, maxWins }: { tag: LearningsTag; maxWins: number }) {
  const liftColor = tag.avgLift >= 0 ? 'text-cms-green' : 'text-red-400'

  return (
    <div className="flex items-center gap-3 py-1.5" data-tag-row>
      <span
        className={`text-xs text-cms-text flex-1 min-w-0 truncate ${tag.negative ? 'line-through' : ''}`}
      >
        {tag.tag}
      </span>
      <WinBar wins={tag.wins} maxWins={maxWins} />
      <span className={`text-2xs font-mono font-medium ${liftColor} w-14 text-right`}>
        {tag.avgLift >= 0 ? '+' : ''}
        {tag.avgLift.toFixed(1)}%
      </span>
    </div>
  )
}

export function LearningsPanel({ learnings }: LearningsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  if (!learnings) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-6 text-center">
        <p className="text-sm text-cms-text-muted">
          Complete 3+ tests to unlock insights
        </p>
      </div>
    )
  }

  const maxWins = Math.max(...learnings.tags.map(t => t.wins), 1)
  const visibleTags = expanded ? learnings.tags : learnings.tags.slice(0, TAG_LIMIT)
  const remaining = learnings.tags.length - TAG_LIMIT

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
      <div className="space-y-0.5">
        {visibleTags.map(tag => (
          <TagRow key={tag.tag} tag={tag} maxWins={maxWins} />
        ))}
      </div>

      {remaining > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 text-2xs text-cms-accent hover:underline"
        >
          Show {remaining} more
        </button>
      )}

      {learnings.insightText && (
        <div className="mt-3 pt-3 border-t border-cms-border">
          <p className="text-xs text-cms-text-muted italic" data-insight>
            {learnings.insightText}
          </p>
        </div>
      )}
    </div>
  )
}
