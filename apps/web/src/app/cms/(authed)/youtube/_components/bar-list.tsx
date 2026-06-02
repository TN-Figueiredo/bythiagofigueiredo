/**
 * BarList — reusable horizontal bar list for demographics.
 * Props: items (generic T[]), keyf (item -> string), valf (item -> number),
 * color. Layout: label 96px + bar (proportional) + value 44px.
 * Bars normalized by max.
 */

interface BarListProps<T> {
  items: T[]
  keyf: (item: T) => string
  valf: (item: T) => number
  color?: string
  /** Optional formatter for the value display. Defaults to raw number. */
  fmtVal?: (val: number) => string
}

export function BarList<T>({
  items,
  keyf,
  valf,
  color = 'var(--accent)',
  fmtVal,
}: BarListProps<T>) {
  const maxVal = items.reduce((m, item) => Math.max(m, valf(item)), 0)

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const label = keyf(item)
        const val = valf(item)
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0

        return (
          <div key={label} className="demo-row flex items-center gap-2 text-xs">
            <span
              className="shrink-0 truncate text-cms-text-muted"
              style={{ width: 96 }}
            >
              {label}
            </span>
            <div className="flex-1">
              <div
                className="h-4 rounded"
                style={{
                  width: `${pct}%`,
                  minWidth: pct > 0 ? 4 : 0,
                  background: color,
                  opacity: 0.7,
                }}
              />
            </div>
            <span
              className="tnum shrink-0 text-right text-cms-text"
              style={{ width: 44 }}
            >
              {fmtVal ? fmtVal(val) : val}
            </span>
          </div>
        )
      })}
    </div>
  )
}
