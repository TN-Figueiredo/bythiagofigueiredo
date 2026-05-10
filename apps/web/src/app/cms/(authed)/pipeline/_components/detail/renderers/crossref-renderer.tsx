'use client'

import type { RendererProps } from '../section-content'

interface CrossRefRow {
  beat: string
  srt_timestamp: string
  duration: string
  script_estimate: string
  status: string
}

interface CrossRefContent {
  rows?: CrossRefRow[]
  divergences?: string[]
}

function parseContent(content: RendererProps['content']): CrossRefContent {
  if (typeof content === 'string') return {}
  if (Array.isArray(content)) return { rows: content as CrossRefRow[] }
  if (content === null) return {}
  return content as CrossRefContent
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  RECORDED: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Gravado' },
  GRAVADO: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'Gravado' },
  IMPROVISED: { bg: 'rgba(249,115,22,0.15)', color: '#f97316', label: 'Improvisado' },
  IMPROVISADO: { bg: 'rgba(249,115,22,0.15)', color: '#f97316', label: 'Improvisado' },
  COMPRESSED: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4', label: 'Comprimido' },
  EXPANDIDO: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4', label: 'Expandido' },
  'EDITADO MANUALMENTE': { bg: 'rgba(234,179,8,0.15)', color: '#eab308', label: 'Edit. Manual' },
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toUpperCase()
  const style = STATUS_STYLES[key] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--gem-dim)', label: status }
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

export function CrossRefRenderer({ content }: RendererProps) {
  const data = parseContent(content)
  const rows = data.rows ?? []
  const divergences = data.divergences ?? []

  if (rows.length === 0) {
    return (
      <div className="p-5 text-[11px] text-center" style={{ color: 'var(--gem-dim)' }}>
        Nenhum dado de cross-reference disponível.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-3">
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
                  {row.script_estimate}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
