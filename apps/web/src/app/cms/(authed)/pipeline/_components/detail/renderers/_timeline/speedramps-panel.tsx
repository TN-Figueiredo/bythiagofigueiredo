// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/speedramps-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { SpeedRampData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface SpeedRampsPanelProps {
  data: SpeedRampData | undefined
}

function parseSpeedValue(speed: string): number | null {
  const match = speed.replace(/[^0-9.]/g, '')
  const num = parseFloat(match)
  return isNaN(num) ? null : num
}

function SpeedBadge({ vel, velColor }: { vel: string; velColor: string }) {
  return (
    <span
      className="font-mono text-[11px] font-semibold rounded-[3px]"
      style={{ color: velColor, background: `${velColor}18`, padding: '2px 7px' }}
    >
      {vel}
    </span>
  )
}

function SpeedRampsPanelRaw({ data }: SpeedRampsPanelProps) {
  const [open, setOpen] = useState(false)

  if (!data || !data.sections || data.sections.length === 0) return null

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
        <span className={MONO_XS_CLS} style={{ color: '#9B59B6', fontSize: 10, whiteSpace: 'nowrap' }}>
          SPEED RAMPS
        </span>
        <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>
          {data.sections.length} seções
        </span>
        <div className="flex-1" />
        <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>
          ~12-14 min final
        </span>
      </button>
      {open && (
        <div className="p-3.5 pt-3">
          <div className={`${MONO_SM_CLS} mb-1 leading-relaxed`} style={{ color: TH.muted, fontSize: 9 }}>
            {data.summary}
          </div>
          <div className={`${MONO_SM_CLS} mb-2.5 leading-relaxed`} style={{ color: TH.dim, fontSize: 9 }}>
            {data.base}
          </div>
          <table className="w-full border-collapse text-[11px]" style={{ color: TH.text }}>
            <thead>
              <tr>
                {['Seção', 'SRT Range', 'Velocidade', 'Racional'].map(h => (
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
              {data.sections.map((s, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 font-medium">{s.name}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]" style={{ color: TH.muted }}>{s.srt}</td>
                  <td className="px-2 py-1.5">
                    <SpeedBadge vel={s.vel} velColor={s.velColor} />
                  </td>
                  <td className="px-2 py-1.5 leading-relaxed" style={{ color: TH.muted }}>{s.racional}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={`mt-2 ${MONO_SM_CLS}`} style={{ fontSize: 8, color: TH.dim }}>
            Fonte: produzido por IA tool (Gemini AI transcribe + análise rítmica)
          </div>
        </div>
      )}
    </div>
  )
}

export const SpeedRampsPanel = memo(SpeedRampsPanelRaw)
SpeedRampsPanel.displayName = 'SpeedRampsPanel'
