export interface BarChartProps {
  data: number[]
  prev?: number[]
  labels?: string[]
  height?: number
  color?: string
  label?: string
}

export function BarChart({
  data,
  prev,
  labels,
  height = 150,
  color = 'var(--accent, #F2683C)',
  label,
}: BarChartProps) {
  const max = Math.max(...data, ...(prev || [1]), 1)
  const gap = data.length > 16 ? 2 : 6

  return (
    <div>
      <div
        data-bar-chart
        role="img"
        aria-label={label || 'Bar chart'}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap,
          height,
          padding: '0 2px',
        }}
      >
        {data.map((v, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 3,
              position: 'relative',
              minWidth: 0,
            }}
            title={`${v}`}
          >
            {prev && prev[i] != null && (
              <div
                data-prev-bar
                style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '60%',
                  height: `${(prev[i]! / max) * 100}%`,
                  background: 'var(--line-strong, #3a3630)',
                  borderRadius: 3,
                }}
              />
            )}
            <div
              data-bar
              style={{
                width: prev ? '78%' : '70%',
                height: `${(v / max) * 100}%`,
                minHeight: v ? 3 : 0,
                background: color,
                borderRadius: 4,
                transition: 'height .5s',
                zIndex: 1,
              }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', gap, marginTop: 8 }}>
          {labels.map((l, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 10,
                color: 'var(--ink-faint, #6E685D)',
              }}
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
