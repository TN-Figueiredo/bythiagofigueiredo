'use client'

import Link from 'next/link'
import type { AbTestWithVariants } from '@/lib/youtube/ab-types'

interface AbTestCompletedRowProps {
  test: AbTestWithVariants
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const typeLabels: Record<string, string> = {
  thumbnail: 'Thumbnail',
  title: 'Título',
  description: 'Descrição',
  combo: 'Combo',
}

const typeBadgeColors: Record<string, string> = {
  thumbnail: 'bg-blue-500/20 text-blue-400',
  title: 'bg-green-500/20 text-green-400',
  description: 'bg-purple-500/20 text-purple-400',
  combo: 'bg-orange-500/20 text-orange-400',
}

export function AbTestCompletedRow({ test }: AbTestCompletedRowProps) {
  const winnerVariant = test.winner_variant_id
    ? test.variants.find(v => v.id === test.winner_variant_id)
    : null

  const winnerLabel = winnerVariant
    ? winnerVariant.label.replace('_', ' ')
    : test.result_metadata?.winner_label ?? 'Inconclusive'

  const ctrLift = test.result_metadata?.ctr_lift_percent
  const confidence = test.confidence_at_completion

  return (
    <Link
      href={`/cms/youtube/ab-lab/${test.id}`}
      className="flex items-center justify-between px-4 py-3 border-b border-cms-border last:border-0 hover:bg-cms-surface-hover transition-colors group"
    >
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2">
          <p className="text-sm text-cms-text truncate group-hover:text-cms-text">{test.name}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeBadgeColors[test.test_type ?? 'thumbnail']}`}>
            {typeLabels[test.test_type ?? 'thumbnail']}
          </span>
        </div>
        <p className="text-xs text-cms-text-muted mt-0.5">{formatDate(test.completed_at)}</p>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden sm:block text-right">
          <p className="text-xs text-cms-text-muted">Winner</p>
          <p className="text-xs font-medium text-cms-text capitalize">{winnerLabel}</p>
        </div>

        {ctrLift !== undefined && ctrLift !== null && (
          <div className="text-right">
            <p className="text-xs text-cms-text-muted">CTR Lift</p>
            <p className={`text-xs font-medium ${ctrLift >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {ctrLift >= 0 ? '+' : ''}{ctrLift.toFixed(1)}%
            </p>
          </div>
        )}

        {confidence !== null && confidence !== undefined && (
          <div className="text-right">
            <p className="text-xs text-cms-text-muted">Confidence</p>
            <p className="text-xs font-medium text-cms-text">{Math.round(confidence * 100)}%</p>
          </div>
        )}

        {(test.playoff_test_id || test.parent_test_id) && (
          <div className="text-right">
            <p className="text-xs text-cms-text-muted">Round</p>
            <p className="text-xs font-medium text-indigo-400">
              {test.parent_test_id ? '2/2' : '1/2'}
            </p>
          </div>
        )}

        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cms-text-dim group-hover:text-cms-text-muted transition-colors" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  )
}
