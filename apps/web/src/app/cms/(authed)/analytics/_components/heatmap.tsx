interface HeatmapCell {
  date: string
  count: number
}

interface HeatmapProps {
  cells: HeatmapCell[]
  weeks?: number
  label?: string
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function cellOpacity(count: number, max: number): number {
  if (count === 0 || max === 0) return 0
  return Math.max(0.15, count / max)
}

export function Heatmap({ cells, weeks = 12, label = 'contributions' }: HeatmapProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - (weeks * 7 - 1))

  const cellMap = new Map<string, number>()
  for (const c of cells) cellMap.set(c.date, c.count)

  const maxCount = cells.reduce((m, c) => Math.max(m, c.count), 1)
  const total = cells.reduce((sum, c) => sum + c.count, 0)

  const grid: Array<{ date: string; count: number; inFuture: boolean }[]> = []
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; count: number; inFuture: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDate)
      day.setDate(day.getDate() + w * 7 + d)
      const dateStr = day.toISOString().split('T')[0]!
      col.push({ date: dateStr, count: cellMap.get(dateStr) ?? 0, inFuture: day > today })
    }
    grid.push(col)
  }

  const monthLabels: { weekIndex: number; label: string }[] = []
  let lastMonth = -1
  for (let w = 0; w < weeks; w++) {
    const firstDay = grid[w]?.[0]
    if (!firstDay) continue
    const month = new Date(firstDay.date).getMonth()
    if (month !== lastMonth) {
      monthLabels.push({
        weekIndex: w,
        label: new Date(firstDay.date).toLocaleDateString('en', { month: 'short' }),
      })
      lastMonth = month
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--cms-text-muted, #71717a)' }}>
          {total} {label} in the last {weeks} weeks
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
            Less
          </span>
          {[0, 0.2, 0.4, 0.7, 1].map((op) => (
            <span
              key={op}
              className="w-2.5 h-2.5 rounded-sm"
              style={{
                background:
                  op === 0 ? 'var(--cms-border, #2a2d3a)' : `rgba(34, 197, 94, ${op})`,
              }}
            />
          ))}
          <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>
            More
          </span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        <div className="flex flex-col gap-[3px] shrink-0 pt-5">
          {DAY_LABELS.map((dl, i) => (
            <span
              key={dl}
              className="text-[9px] h-[11px] flex items-center"
              style={{
                color: 'var(--cms-text-dim, #52525b)',
                visibility: i % 2 === 0 ? 'visible' : 'hidden',
              }}
            >
              {dl}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-0 min-w-0">
          <div className="relative h-5 flex">
            {monthLabels.map((ml) => (
              <span
                key={ml.weekIndex + ml.label}
                className="absolute text-[10px]"
                style={{
                  left: `${(ml.weekIndex / weeks) * 100}%`,
                  color: 'var(--cms-text-dim, #52525b)',
                }}
              >
                {ml.label}
              </span>
            ))}
          </div>
          <div
            className="flex gap-[3px]"
            role="img"
            aria-label={`Activity heatmap: ${total} ${label} in the last ${weeks} weeks`}
          >
            {grid.map((col, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {col.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} ${label}`}
                    aria-label={`${cell.date}: ${cell.count} ${label}`}
                    className="w-[11px] h-[11px] rounded-sm transition-all cursor-default"
                    style={{
                      background: cell.inFuture
                        ? 'transparent'
                        : cell.count === 0
                          ? 'var(--cms-border, #2a2d3a)'
                          : `rgba(34, 197, 94, ${cellOpacity(cell.count, maxCount)})`,
                      border: cell.inFuture
                        ? '1px dashed var(--cms-border-subtle, #22252f)'
                        : 'none',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
