'use client'

import type { DisplayLabel } from '@/lib/youtube/ab-types'

export interface ABBATimelineProps {
  seq: DisplayLabel[]
  total: number
  done: number
  colors: Record<string, string>
}

export function ABBATimeline({ seq, total, done, colors }: ABBATimelineProps) {
  const activeIdx = done
  const nextLabel = seq[activeIdx]
  const nextColor = nextLabel ? (colors[nextLabel] ?? 'var(--cms-text-dim)') : undefined

  return (
    <div>
      {/* Blocks row */}
      <div className="flex gap-[4px] mb-[10px]">
        {seq.map((label, i) => {
          const color = colors[label] ?? '#8A8F98'
          const isDone = i < done
          const isActive = i === activeIdx
          const isFuture = i > activeIdx

          return (
            <div key={i} className="flex-1 relative">
              <div
                className="flex items-center justify-center font-mono font-bold text-[11px]"
                style={{
                  height: 34,
                  borderRadius: 5,
                  ...(isDone ? {
                    background: color,
                    opacity: 0.95,
                    border: '1px solid transparent',
                    color: 'rgb(21, 18, 13)',
                  } : isActive ? {
                    background: 'var(--cms-surface-hover)',
                    opacity: 0.4,
                    border: '1.5px dashed var(--cms-accent)',
                    color: 'var(--cms-text-dim)',
                  } : {
                    background: 'var(--cms-surface-hover)',
                    opacity: 0.4,
                    border: '1px solid transparent',
                    color: 'var(--cms-text-dim)',
                  }),
                }}
              >
                {isActive ? '•' : label}
              </div>
              <div className="font-mono text-[8px] text-cms-text-dim text-center mt-[3px]" style={{ color: 'var(--cms-text-faint)' }}>
                {i + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[11px] text-cms-text-dim">
        <span>{done}/{total} ciclos ABBA completos</span>
        {nextLabel && (
          <span className="font-mono">
            próx. rotação →{' '}
            <b style={{ color: nextColor }}>{nextLabel}</b>
            {' em 6h'}
          </span>
        )}
      </div>
    </div>
  )
}
