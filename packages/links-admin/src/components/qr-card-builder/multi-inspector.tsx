'use client'
import { Trash2, Lock } from 'lucide-react'
import type { CardElement } from '@tn-figueiredo/links/qr'
import { SliderField, SectionTitle } from './inspector-field'

interface MultiInspectorProps {
  elements: CardElement[]
  onUpdateAll: (patch: Partial<CardElement>) => void
  onDeleteAll: () => void
  onLockAll: () => void
  onAlign: (alignment: string) => void
}

export function MultiInspector({ elements, onUpdateAll, onDeleteAll, onLockAll, onAlign }: MultiInspectorProps) {
  const opacities = elements.map(e => e.opacity)
  const allSame = opacities.every(o => o === opacities[0])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>{elements.length}</span>
        <span className="text-[12px]" style={{ color: 'var(--ink)' }}>Elements Selected</span>
      </div>

      <SectionTitle>Alignment</SectionTitle>
      <div className="grid grid-cols-4 gap-1">
        {[
          { key: 'left', label: 'Left' },
          { key: 'center-h', label: 'Center' },
          { key: 'right', label: 'Right' },
          { key: 'top', label: 'Top' },
          { key: 'middle', label: 'Middle' },
          { key: 'bottom', label: 'Bottom' },
          { key: 'distribute-h', label: 'Dist H' },
          { key: 'distribute-v', label: 'Dist V' },
        ].map(a => (
          <button
            key={a.key}
            type="button"
            onClick={() => onAlign(a.key)}
            className="py-1.5 rounded text-[9px] hover:opacity-80"
            style={{ border: '1px solid var(--line)', color: 'var(--ink-dim)' }}
          >
            {a.label}
          </button>
        ))}
      </div>

      <SectionTitle>Shared Properties</SectionTitle>
      <SliderField
        label="Opacity"
        value={allSame ? (opacities[0] ?? 1) * 100 : 50}
        onChange={v => onUpdateAll({ opacity: v / 100 })}
        min={0}
        max={100}
        format={v => allSame ? `${Math.round(v)}%` : 'Mixed'}
      />

      <SectionTitle>Actions</SectionTitle>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onLockAll}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] hover:opacity-80"
          style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}
        >
          <Lock size={12} />Lock All
        </button>
        <button
          type="button"
          onClick={onDeleteAll}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[11px] hover:opacity-80"
          style={{ border: '1px solid var(--red)', color: 'var(--red)' }}
        >
          <Trash2 size={12} />Delete All
        </button>
      </div>
    </div>
  )
}
