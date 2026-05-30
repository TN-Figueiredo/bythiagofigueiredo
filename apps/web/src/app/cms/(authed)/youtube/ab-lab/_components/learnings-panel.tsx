'use client'

import { Sparkles } from 'lucide-react'
import type { LearningsData, LearningsTag } from '@/lib/youtube/ab-types'

export interface LearningsPanelProps {
  learnings: LearningsData | null
}

function StrengthBar({ wins, maxWins }: { wins: number; maxWins: number }) {
  const segments = 5
  const filled = maxWins > 0 ? Math.round((wins / maxWins) * segments) : 0

  return (
    <div className="flex gap-[3px]" role="meter" aria-valuenow={wins} aria-valuemin={0} aria-valuemax={maxWins}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className="rounded-[2px]"
          style={{
            width: 5,
            height: 14,
            background: i < filled ? 'var(--accent)' : 'var(--surface-3, var(--cms-surface-3, #333))',
          }}
        />
      ))}
    </div>
  )
}

function TagRow({ tag, maxWins }: { tag: LearningsTag; maxWins: number }) {
  const isNegative = tag.negative || tag.avgLift < 0

  return (
    <div className="flex items-center gap-[10px]">
      <span
        className="flex-1 text-[13px] min-w-0 truncate"
        style={{
          color: isNegative ? 'var(--ink-faint, var(--cms-text-dim))' : 'var(--ink, var(--cms-text))',
          textDecoration: isNegative ? 'line-through' : 'none',
        }}
      >
        {tag.tag}
      </span>
      <StrengthBar wins={tag.wins} maxWins={maxWins} />
      <span
        className="font-mono text-[12px] font-bold w-[44px] text-right"
        style={{ color: isNegative ? 'var(--cms-red, #ef4444)' : 'var(--green, var(--cms-green))' }}
      >
        {tag.avgLift >= 0 ? '+' : ''}{Math.round(tag.avgLift)}%
      </span>
    </div>
  )
}

export function LearningsPanel({ learnings }: LearningsPanelProps) {
  if (!learnings) {
    return (
      <div className="rounded-[14px] p-[20px]" style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)' }}>
        <p className="text-[13px] text-cms-text-dim text-center py-4">
          Complete 3+ testes para desbloquear insights
        </p>
      </div>
    )
  }

  const maxWins = Math.max(...learnings.tags.map(t => t.wins), 1)

  return (
    <div className="rounded-[14px] p-[20px]" style={{ background: 'var(--cms-surface)', border: '1px solid var(--cms-border, #332D25)' }}>
      {/* Header */}
      <div className="flex items-center gap-[9px] mb-[4px]">
        <Sparkles size={17} className="text-cms-accent" aria-hidden="true" />
        <h3 className="text-[15px] font-semibold text-cms-text m-0">O que já funciona pra você</h3>
      </div>
      <p className="text-[12px] text-cms-text-dim m-0 mb-[16px]">
        Padrões aprendidos em {learnings.totalTests} testes. O Cowork usa isso pra sugerir variantes melhores.
      </p>

      {/* Tags */}
      <div className="flex flex-col gap-[9px]">
        {learnings.tags.map(tag => (
          <TagRow key={tag.tag} tag={tag} maxWins={maxWins} />
        ))}
      </div>

      {/* Insight box */}
      {learnings.insightText && (
        <div
          className="mt-[16px] py-[12px] px-[14px] rounded-[10px] text-[12px] text-cms-text-dim leading-[1.5]"
          style={{ background: 'var(--accent-soft, rgba(255,130,64,0.08))' }}
        >
          <b className="text-cms-accent">Insight:</b> {learnings.insightText}
        </div>
      )}
    </div>
  )
}
