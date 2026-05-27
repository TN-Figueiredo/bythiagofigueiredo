// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/crossref-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { CrossRefData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface CrossRefPanelProps {
  data: CrossRefData | undefined
}

function CrossRefPanelRaw({ data }: CrossRefPanelProps) {
  const [open, setOpen] = useState(false)

  if (!data || !data.beats || data.beats.length === 0) return null

  return (
    <div className="rounded-md overflow-hidden" style={{ background: TH.surface, border: `1px solid ${TH.border}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          ▶
        </span>
        <span className={MONO_XS_CLS} style={{ color: '#3498DB', fontSize: 10, whiteSpace: 'nowrap' }}>
          CROSS-REFERENCE
        </span>
        <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>
          {data.beats.length} beats · SRT
        </span>
        <div className="flex-1" />
        {(data.divergences ?? []).length > 0 && (
          <span
            className={MONO_XS_CLS}
            style={{ fontSize: 8, color: '#E67E22', background: 'rgba(230,126,34,0.12)', padding: '1px 6px', borderRadius: 3 }}
          >
            {(data.divergences ?? []).length} divergência{(data.divergences ?? []).length > 1 ? 's' : ''}
          </span>
        )}
      </button>
      {open && (
        <div className="p-3.5 pt-3">
          <div className={`${MONO_SM_CLS} mb-2.5 leading-relaxed`} style={{ color: TH.muted, fontSize: 9 }}>
            {data.summary}
          </div>
          <table className="w-full border-collapse text-xs" style={{ color: TH.text }}>
            <thead>
              <tr>
                {['Beat', 'SRT Timestamp', 'Duração', 'Est. Roteiro', 'Status'].map(h => (
                  <th
                    key={h}
                    className={`${MONO_XS_CLS} text-left px-2 py-1`}
                    style={{ color: TH.muted, fontSize: 8, borderBottom: `1px solid ${TH.border}` }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.beats.map((b, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 font-medium" style={{ color: TH.accent }}>{b.name}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}>{b.srt}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{b.dur}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}>{b.estRot}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={MONO_XS_CLS}
                      style={{ fontSize: 8, color: b.statusColor, background: `${b.statusColor}18`, padding: '1px 5px', borderRadius: 2 }}
                    >
                      {b.status}
                    </span>
                    {b.note && <span className={`${MONO_SM_CLS} ml-1.5`} style={{ fontSize: 8, color: TH.dim }}>{b.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data.divergences ?? []).length > 0 && (
            <div
              className="mt-3 p-2.5 rounded"
              style={{ background: 'rgba(230,78,60,0.06)', border: '1px solid rgba(230,78,60,0.15)' }}
            >
              <div className={MONO_XS_CLS} style={{ fontSize: 8, color: '#E74C3C', marginBottom: 6 }}>
                DIVERGÊNCIAS IDENTIFICADAS
              </div>
              {(data.divergences ?? []).map((d, i) => (
                <div key={i} className="text-xs leading-relaxed mb-0.5" style={{ color: '#E67E22' }}>
                  • {d}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const CrossRefPanel = memo(CrossRefPanelRaw)
CrossRefPanel.displayName = 'CrossRefPanel'
