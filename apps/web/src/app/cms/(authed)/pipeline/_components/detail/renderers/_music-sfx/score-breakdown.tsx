import type { ScoreBreakdownEntry } from './types'
import { RESOLVE_COLORS } from './types'
import { getBreakdownColor } from './score-utils'

interface ScoreBreakdownProps {
  breakdown: Record<string, ScoreBreakdownEntry>
}

export function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const entries = Object.entries(breakdown)
  const total = entries.reduce((sum, [, { score }]) => sum + score, 0)
  const totalMax = entries.reduce((sum, [, { max }]) => sum + max, 0)

  return (
    <div className="p-2 rounded-md" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }} aria-label="Detalhamento de pontuação">
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#94a3b8' }}>
        Detalhamento
      </div>
      <div className="grid grid-cols-1 gap-1">
        {entries.map(([key, { score, max }]) => {
          const color = getBreakdownColor(score, max)
          const pct = max > 0 ? (score / max) * 100 : 0
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[10px] min-w-[68px]" style={{ color: '#94a3b8' }}>{key}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="text-[10px] font-mono min-w-[24px] text-right" style={{ color }}>{score}/{max}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[10px] font-semibold" style={{ color: '#e2e8f0' }}>Total</span>
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${totalMax > 0 ? (total / totalMax) * 100 : 0}%`, background: `linear-gradient(90deg, ${RESOLVE_COLORS.LOCAL.color}, #a78bfa)` }}
          />
        </div>
        <span className="text-xs font-bold font-mono" style={{ color: RESOLVE_COLORS.LOCAL.color }}>{total}/{totalMax}</span>
      </div>
    </div>
  )
}
