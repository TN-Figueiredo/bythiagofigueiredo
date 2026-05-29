export interface HeatmapProps {
  grid: number[][]
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const SHADES = [
  'var(--surface-2, #1E1B16)',
  'rgba(242,104,60,0.25)',
  'rgba(242,104,60,0.45)',
  'rgba(242,104,60,0.7)',
  'var(--accent, #F2683C)',
]

export function Heatmap({ grid }: HeatmapProps) {
  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {grid.map((row, d) => (
          <div
            key={d}
            data-day-row
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span
              style={{
                width: 26,
                fontSize: 9.5,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--ink-faint, #6E685D)',
              }}
            >
              {DAYS[d]}
            </span>
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {row.map((v, h) => (
                <div
                  key={h}
                  data-cell
                  title={`${DAYS[d]} ${h}h`}
                  style={{
                    flex: 1,
                    aspectRatio: '1',
                    borderRadius: 2,
                    background: SHADES[Math.min(v, 4)] || SHADES[0],
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {grid.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            paddingLeft: 32,
          }}
        >
          {['0h', '6h', '12h', '18h', '23h'].map((t) => (
            <span
              key={t}
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--ink-faint, #6E685D)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
