'use client'

import { Longevity } from './longevity'

const ITEMS = [
  { n: 1, label: 'Queimou rapido' },
  { n: 2, label: 'Durou ~2 semanas' },
  { n: 3, label: 'Durou ~1 mes' },
  { n: 4, label: 'Evergreen' },
] as const

export function LongevityLegend() {
  return (
    <div className="inline-flex items-center gap-4 flex-wrap">
      {ITEMS.map(item => (
        <span
          key={item.n}
          className="inline-flex items-center gap-1.5"
          style={{ fontSize: '11px', color: 'var(--cms-text-dim, #7C7060)' }}
        >
          <Longevity n={item.n} size={5} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
