// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/track-divider.tsx
'use client'

import { DIVIDER_H, TH, MONO_XS_CLS } from './constants'

interface TrackDividerProps {
  width?: number
  inPanel?: boolean
}

export function TrackDivider({ width, inPanel }: TrackDividerProps) {
  return (
    <div
      className="flex items-center justify-center"
      style={{
        height: DIVIDER_H,
        background: `linear-gradient(180deg, ${TH.surface}, rgba(99,102,241,0.05), ${TH.surface})`,
        borderBottom: `1px solid ${TH.divLine}`,
        borderTop: `1px solid ${TH.divLine}`,
        width: inPanel ? '100%' : width,
        padding: inPanel ? '0 6px' : '0 8px',
        gap: 6,
      }}
    >
      {inPanel ? (
        <span className={MONO_XS_CLS} style={{ fontSize: 9, color: TH.accent, opacity: 0.85, letterSpacing: '0.12em' }}>
          ▲ VIDEO · AUDIO ▼
        </span>
      ) : (
        <>
          <div className="flex-1 h-px" style={{ background: TH.divLine }} />
          <span className="font-mono text-[7px]" style={{ color: TH.accent, opacity: 0.35 }}>◆</span>
          <div className="flex-1 h-px" style={{ background: TH.divLine }} />
        </>
      )}
    </div>
  )
}
