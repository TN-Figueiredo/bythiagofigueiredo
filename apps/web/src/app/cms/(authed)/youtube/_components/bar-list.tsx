interface BarListProps<T> {
  items: T[]
  keyf: (item: T) => string
  valf: (item: T) => number
  color?: string
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
    <div className="flex flex-col" style={{ gap: 10 }}>
      {items.map((item) => {
        const label = keyf(item)
        const val = valf(item)
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0

        return (
          <div key={label} className="demo-row">
            <span className="demo-label truncate">{label}</span>
            <div className="bar" style={{ flex: 1 }}>
              <span style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="mono demo-val">{fmtVal ? fmtVal(val) : String(val)}</span>
          </div>
        )
      })}
    </div>
  )
}
