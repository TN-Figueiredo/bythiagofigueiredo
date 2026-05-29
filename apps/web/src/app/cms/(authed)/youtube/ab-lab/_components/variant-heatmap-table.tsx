'use client'

import type { VariantMetadata } from '@/lib/youtube/ab-types'
import { VARIANT_LABELS } from '@/lib/youtube/ab-types'
import { variantColor } from './ab-constants'

interface VariantHeatmapTableProps {
  variants: Array<{ label: string; metadata: VariantMetadata }>
}

const COLUMNS = ['Thumb', 'Title', 'Combo'] as const

function scoreCell(value: number | undefined, isCombo: boolean, columnLabel: string) {
  if (value === undefined) {
    return (
      <td
        className={`px-3 py-2 text-center text-muted-foreground ${isCombo ? 'border-l-2 border-indigo-500/30 text-lg font-bold' : ''}`}
      >
        —
      </td>
    )
  }

  return (
    <td
      className={`px-3 py-2 text-center ${isCombo ? 'border-l-2 border-indigo-500/30 text-lg font-bold' : ''}`}
      style={{ backgroundColor: `rgba(99, 102, 241, ${(value / 10) * 0.3})` }}
      role="img"
      aria-label={`${columnLabel} score: ${value}/10`}
    >
      {value}
    </td>
  )
}

export function VariantHeatmapTable({ variants }: VariantHeatmapTableProps) {
  const filtered = variants.filter((v) =>
    (VARIANT_LABELS as readonly string[]).includes(v.label),
  )

  if (filtered.length === 0) return null

  return (
    <div className="overflow-hidden rounded-lg border border-cms-border bg-cms-surface">
      <table className="w-full text-sm" aria-label="Heatmap de scores por variante">
        <thead>
          <tr className="text-muted-foreground text-xs uppercase">
            <th scope="col" className="px-3 py-2 text-left font-medium">Var</th>
            {COLUMNS.map((col) => (
              <th
                key={col}
                scope="col"
                className={`px-3 py-2 text-center font-medium ${col === 'Combo' ? 'border-l-2 border-indigo-500/30' : ''}`}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((v) => (
            <tr key={v.label} className="border-t border-cms-border">
              <th scope="row" className="px-3 py-2 font-semibold text-left" style={{ color: variantColor(v.label) }}>
                {v.label}
              </th>
              {scoreCell(v.metadata.score?.thumbnail, false, 'Thumb')}
              {scoreCell(v.metadata.score?.title, false, 'Title')}
              {scoreCell(v.metadata.score?.combo, true, 'Combo')}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
