'use client'

import type { RendererProps } from '../section-content'

interface SpeedRampRow {
  section: string
  srt_range: string
  timeline: string
  speed: string
  rationale: string
}

interface SpeedRampContent {
  rows?: SpeedRampRow[]
}

function parseContent(content: RendererProps['content']): SpeedRampContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content)) return { rows: content as SpeedRampRow[] }
  if (content === null) return {}
  return content as SpeedRampContent
}

function parseSpeedValue(speed: string): number | null {
  const match = speed.replace(/[^0-9.]/g, '')
  const num = parseFloat(match)
  return isNaN(num) ? null : num
}

function SpeedBadge({ speed }: { speed: string }) {
  const upper = speed.toUpperCase()

  if (upper === 'CUT' || upper === 'CORTE') {
    return (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
      >
        {speed}
      </span>
    )
  }

  const val = parseSpeedValue(speed)

  if (val === null) {
    return <span className="text-[11px]" style={{ color: 'var(--gem-muted)' }}>{speed}</span>
  }

  let bg: string
  let color: string

  if (val <= 100) {
    bg = 'rgba(34,197,94,0.15)'
    color = '#22c55e'
  } else if (val <= 106) {
    bg = 'rgba(6,182,212,0.15)'
    color = '#06b6d4'
  } else {
    bg = 'rgba(234,179,8,0.15)'
    color = '#eab308'
  }

  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium font-mono"
      style={{ background: bg, color }}
    >
      {speed}
    </span>
  )
}

export function SpeedRampRenderer({ content }: RendererProps) {
  const data = parseContent(content)
  const rows = data.rows ?? []

  if (rows.length === 0) {
    return (
      <div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}>
        Nenhum dado de speed ramp disponível.
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="overflow-x-auto rounded-md" style={{ border: '1px solid var(--gem-border)' }}>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: 'var(--gem-well)' }}>
              {['Seção', 'SRT Range', 'Timeline', 'Velocidade', 'Racional'].map(h => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-medium whitespace-nowrap"
                  style={{ color: 'var(--gem-dim)', borderBottom: '1px solid var(--gem-border)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--gem-border)' : 'none' }}
              >
                <td className="px-3 py-2 font-medium" style={{ color: 'var(--gem-text)', whiteSpace: 'nowrap' }}>
                  {row.section}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--gem-muted)', whiteSpace: 'nowrap' }}>
                  {row.srt_range}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--gem-muted)', whiteSpace: 'nowrap' }}>
                  {row.timeline}
                </td>
                <td className="px-3 py-2">
                  <SpeedBadge speed={row.speed} />
                </td>
                <td className="px-3 py-2 leading-relaxed" style={{ color: 'var(--gem-muted)' }}>
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
