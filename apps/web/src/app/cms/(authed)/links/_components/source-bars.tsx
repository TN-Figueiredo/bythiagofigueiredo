'use client'

import { SOURCE_COLORS, SOURCE_LABELS, type SourceId } from '@tn-figueiredo/links-admin'

interface SourceBarData {
  id: string
  clicks: number
  pct: number
}

interface SourceBarsProps {
  sources: SourceBarData[]
}

export function SourceBars({ sources }: SourceBarsProps) {
  const max = Math.max(...sources.map(s => s.clicks), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {sources.map((s) => {
        const color = SOURCE_COLORS[s.id as SourceId] || '#8A8F98'
        const label = SOURCE_LABELS[s.id as SourceId] || s.id
        return (
          <div key={s.id} data-source-row className="flex items-center gap-2.5">
            <span
              data-source-dot
              className="h-[9px] w-[9px] shrink-0 rounded-[3px]"
              style={{ background: color }}
            />
            <span className="w-20 shrink-0 text-xs text-foreground">{label}</span>
            <div className="flex-1 h-[7px] rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(s.clicks / max) * 100}%`, background: color }}
              />
            </div>
            <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
              {s.pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
