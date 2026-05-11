'use client'

import type { RendererProps } from '../section-content'
import { StatusBadge } from './status-badge'

interface CrossRefRow {
  beat: string
  srt_timestamp: string
  duration: string
  script_estimate?: string
  script_est?: string
  status: string
}

interface CrossRefContent {
  rows?: CrossRefRow[]
  beats?: CrossRefRow[]
  divergences?: string[]
  key_divergences?: string[]
  source?: string
  summary?: string
}

function parseContent(content: RendererProps['content']): CrossRefContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content)) return { rows: content as CrossRefRow[] }
  if (content === null) return {}
  return content as CrossRefContent
}

export function CrossRefRenderer({ content }: RendererProps) {
  const data = parseContent(content)
  const rows = data.rows ?? data.beats ?? []
  const divergences = data.divergences ?? data.key_divergences ?? []

  if (rows.length === 0) {
    return (
      <div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}>
        Nenhum dado de cross-reference disponível.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-3">
      {data.summary && (
        <div className="text-[11px] leading-relaxed p-3 rounded-md" style={{ background: 'var(--gem-well)', color: 'var(--gem-muted)' }}>
          {data.summary}
        </div>
      )}

      <div className="overflow-x-auto rounded-md" style={{ border: '1px solid var(--gem-border)' }}>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr style={{ background: 'var(--gem-well)' }}>
              {['Beat', 'SRT Timestamp', 'Duração', 'Est. Roteiro', 'Status'].map(h => (
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
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--gem-accent)' }}>
                  {row.beat}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--gem-muted)' }}>
                  {row.srt_timestamp}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--gem-muted)' }}>
                  {row.duration}
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--gem-muted)' }}>
                  {row.script_estimate ?? row.script_est}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.source && (
        <div className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>
          Fonte: {data.source}
        </div>
      )}

      {divergences.length > 0 && (
        <div
          className="p-3 rounded-md"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <div className="text-[10px] font-semibold mb-2" style={{ color: '#f87171' }}>
            Divergências identificadas
          </div>
          <ul className="pl-3.5 m-0 space-y-1">
            {divergences.map((d, i) => (
              <li key={i} className="text-[11px]" style={{ color: '#fca5a5' }}>
                {typeof d === 'string' ? d : String((d as Record<string, unknown>).description ?? JSON.stringify(d))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
