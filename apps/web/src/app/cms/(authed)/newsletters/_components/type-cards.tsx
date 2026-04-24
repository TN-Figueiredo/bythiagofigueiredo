'use client'

import { useRouter } from 'next/navigation'

interface TypeCardData {
  id: string
  name: string
  color: string
  subscribers: number
  avgOpenRate: number
  lastSent: string | null
  cadence: string
  editionCount: number
  isPaused: boolean
}

interface TypeCardsProps {
  types: TypeCardData[]
  selectedTypeId: string | null
  currentStatus?: string
}

export function TypeCards({ types, selectedTypeId, currentStatus }: TypeCardsProps) {
  const router = useRouter()

  function onSelect(id: string | null) {
    const params = new URLSearchParams()
    if (id) params.set('type', id)
    if (currentStatus && currentStatus !== 'all') params.set('status', currentStatus)
    const qs = params.toString()
    router.push(`/cms/newsletters${qs ? `?${qs}` : ''}`)
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {types.map((t) => (
        <button type="button" key={t.id} onClick={() => onSelect(selectedTypeId === t.id ? null : t.id)}
          className={`shrink-0 w-56 bg-cms-surface border rounded-[var(--cms-radius)] p-4 text-left transition-all
            ${selectedTypeId === t.id ? 'border-cms-accent ring-1 ring-cms-accent' : 'border-cms-border hover:border-cms-accent/50'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-cms-text">{t.name}</span>
            {t.isPaused && <span className="text-[9px] px-1.5 py-0.5 rounded bg-cms-amber-subtle text-cms-amber uppercase">Paused</span>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div><div className="font-semibold text-cms-text">{t.subscribers}</div><div className="text-cms-text-dim">Subs</div></div>
            <div><div className="font-semibold text-cms-green">{t.avgOpenRate}%</div><div className="text-cms-text-dim">Opens</div></div>
            <div><div className="font-semibold text-cms-text">{t.editionCount}</div><div className="text-cms-text-dim">Editions</div></div>
          </div>
          <div className="mt-3 pt-2 border-t border-cms-border-subtle text-[10px] text-cms-text-dim">
            {t.cadence} · {t.lastSent ? `Last: ${t.lastSent}` : 'Never sent'}
          </div>
        </button>
      ))}
      <button type="button" className="shrink-0 w-40 border border-dashed border-cms-border rounded-[var(--cms-radius)] flex items-center justify-center text-sm text-cms-text-dim hover:border-cms-accent hover:text-cms-accent transition-colors">
        + Add type
      </button>
    </div>
  )
}
