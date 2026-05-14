'use client'

import { useMemo } from 'react'

interface SourceData {
  source: string
  clicks: number
}

interface SourceBreakdownChartProps {
  data: SourceData[]
}

const SOURCE_COLORS: Record<string, string> = {
  blog: 'bg-green-500',
  social: 'bg-purple-500',
  newsletter: 'bg-blue-500',
  campaign: 'bg-orange-500',
  manual: 'bg-gray-500',
  video: 'bg-red-500',
  print: 'bg-amber-500',
}

export function SourceBreakdownChart({ data }: SourceBreakdownChartProps) {
  const { max, total } = useMemo(() => {
    const m = Math.max(...data.map((d) => d.clicks), 1)
    const t = data.reduce((sum, d) => sum + d.clicks, 0)
    return { max: m, total: t || 1 }
  }, [data])

  return (
    <div className="space-y-2">
      {data.map((item) => {
        const pct = Math.max((item.clicks / max) * 100, 4)
        const totalPct = Math.round((item.clicks / total) * 100)
        return (
          <div key={item.source} className="flex items-center gap-2">
            <span className="w-[72px] shrink-0 text-[10px] font-medium capitalize text-muted-foreground">
              {item.source}
            </span>
            <div className="flex-1">
              <div className="h-2.5 overflow-hidden rounded-full bg-muted/50">
                <div
                  className={`h-full rounded-full transition-all ${SOURCE_COLORS[item.source] ?? 'bg-gray-500'}`}
                  style={{ width: `${pct}%`, opacity: item.clicks > 0 ? 0.7 : 0.15 }}
                />
              </div>
            </div>
            <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {item.clicks}
            </span>
            <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {totalPct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}
