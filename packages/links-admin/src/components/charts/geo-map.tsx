import { useMemo } from 'react'
import { GEO_COORDS } from './geo-coords'

export interface GeoCountry {
  code: string
  name: string
  v: number
}

export interface GeoMapProps {
  countries: GeoCountry[]
  width?: number
  height?: number
}

export function GeoMap({ countries, width = 800, height = 450 }: GeoMapProps) {
  const maxVal = useMemo(() => Math.max(...countries.map(c => c.v), 1), [countries])

  const known = useMemo(
    () => countries.filter(c => GEO_COORDS[c.code]),
    [countries]
  )

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Mapa geografico: ${countries.map(c => `${c.name} ${c.v}%`).join(', ')}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Background outline (simplified world shape) */}
      <rect x="0" y="0" width={width} height={height} fill="none" />

      {/* Grid lines for reference */}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={`h${f}`} x1="0" y1={height * f} x2={width} y2={height * f}
          stroke="var(--line, rgba(255,255,255,0.05))" strokeWidth="0.5" />
      ))}
      {[0.25, 0.5, 0.75].map(f => (
        <line key={`v${f}`} x1={width * f} y1="0" x2={width * f} y2={height}
          stroke="var(--line, rgba(255,255,255,0.05))" strokeWidth="0.5" />
      ))}

      {/* Country circles */}
      {known.map(c => {
        const coord = GEO_COORDS[c.code]!
        const r = 6 + (c.v / maxVal) * 22
        return (
          <circle
            key={c.code}
            data-country={c.code}
            cx={coord.x}
            cy={coord.y}
            r={r}
            fill="var(--accent, #F2683C)"
            fillOpacity={0.35}
            stroke="var(--accent, #F2683C)"
            strokeWidth={1.5}
          >
            <title>{`${c.name}: ${c.v}%`}</title>
          </circle>
        )
      })}

      {/* Labels for top 3 */}
      {known.slice(0, 3).map(c => {
        const coord = GEO_COORDS[c.code]!
        const r = 6 + (c.v / maxVal) * 22
        return (
          <text
            key={`label-${c.code}`}
            x={coord.x}
            y={coord.y + r + 14}
            textAnchor="middle"
            fill="var(--ink-faint, #6E685D)"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
          >
            {c.code} {c.v}%
          </text>
        )
      })}
    </svg>
  )
}
