// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/clip-tooltip.tsx
'use client'

import type { TimelineClipData } from './types'
import { fmtTime, fmtDur } from './utils'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'

interface ClipTooltipProps {
  clip: TimelineClipData
  trackName: string
}

export function ClipTooltip({ clip, trackName }: ClipTooltipProps) {
  return (
    <div
      className="absolute pointer-events-none z-20 min-w-[180px] rounded-[5px] px-2.5 py-2"
      style={{
        bottom: 'calc(100% + 6px)',
        left: 0,
        background: 'rgba(12,18,34,0.96)',
        border: `1px solid ${TH.brdLight}`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div className={MONO_XS_CLS} style={{ color: TH.muted, marginBottom: 4 }}>{trackName}</div>
      <div className="text-[12px] font-medium leading-tight mb-1" style={{ color: TH.text }}>{clip.label}</div>
      <div className={MONO_SM_CLS} style={{ color: TH.muted }}>
        {fmtTime(clip.s)} → {fmtTime(clip.e)} · {fmtDur(clip.e - clip.s)}
      </div>
    </div>
  )
}
