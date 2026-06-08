'use client'

import { PILLARS, type PillarId } from '@/lib/pipeline/pillars'

interface PillarRailProps {
  total: number
  pillarCounts: Partial<Record<PillarId, number>>
  active: PillarId | null
  onChange: (id: PillarId | null) => void
}

export function PillarRail({ total, pillarCounts, active, onChange }: PillarRailProps) {
  return (
    <div className="pillar-rail" role="group" aria-label="Filtrar por pilar">
      <button
        type="button"
        className="pillar-chip"
        aria-pressed={active === null}
        onClick={() => onChange(null)}
      >
        Todos
        <span className="pc-count">{total}</span>
      </button>
      {PILLARS.map((p) => {
        const count = pillarCounts[p.id] ?? 0
        return (
          <button
            key={p.id}
            type="button"
            className="pillar-chip"
            aria-pressed={active === p.id}
            onClick={() => onChange(p.id)}
            style={{ ['--pc' as string]: p.color }}
          >
            <span className="pc-dot" aria-hidden />
            {p.label}
            {count > 0 && <span className="pc-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
