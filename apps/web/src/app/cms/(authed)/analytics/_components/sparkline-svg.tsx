interface Props {
  data: number[]
  color?: string
  width?: number
  height?: number
  label?: string
}

export function SparklineSvg({ data, color = 'var(--color-blog)', width = 64, height = 20, label }: Props) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      role="img"
      aria-label={label ?? 'Trend sparkline'}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
