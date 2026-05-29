'use client'

import type { GateResult } from '@/lib/youtube/ab-types'
import { CheckCircle, Clock } from 'lucide-react'

export interface GatesPanelProps {
  gates: GateResult[]
}

export function GatesPanel({ gates }: GatesPanelProps) {
  const passedCount = gates.filter(g => g.passed).length
  const allPassed = passedCount === gates.length && gates.length > 0

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold ${allPassed ? 'text-cms-green' : 'text-cms-text'}`}>
          {passedCount}/{gates.length} passed
        </span>
      </div>

      {/* 2x3 grid */}
      <div role="list" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {gates.map(gate => (
          <div
            key={gate.name}
            role="listitem"
            className="rounded bg-cms-surface p-2 flex items-start gap-2"
          >
            {gate.passed ? (
              <CheckCircle size={14} className="text-cms-green shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Clock size={14} className="text-cms-amber shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span className="sr-only">{gate.passed ? 'Passed' : 'Pending'}</span>
            <div className="min-w-0">
              <p className="text-2xs font-medium text-cms-text truncate">{gate.name}</p>
              <p className="text-2xs text-cms-text-muted">{gate.value}</p>
              {gate.hint && (
                <p className="text-2xs text-cms-text-dim mt-0.5">{gate.hint}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
