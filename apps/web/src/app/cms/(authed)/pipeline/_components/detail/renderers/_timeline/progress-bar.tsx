'use client'

import { memo } from 'react'
import type { BeatData } from './types'
import { TH, MONO_SM_CLS, MONO_XS_CLS } from './constants'
import { fmtDur } from './utils'

interface ProgressBarProps {
  beats: BeatData[]
}

function ProgressBarRaw({ beats }: ProgressBarProps) {
  const totalDur = beats.reduce((s, b) => s + b.duration, 0)

  return (
    <div
      className="flex items-center gap-3 flex-wrap rounded-md mb-3"
      style={{ padding: '10px 16px', background: TH.surface, border: `1px solid ${TH.border}` }}
    >
      <span className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 9 }}>OVERVIEW</span>
      <div
        className="flex-1 flex overflow-hidden rounded gap-px"
        style={{ height: 26, background: TH.bg }}
      >
        {beats.map((b, i) => (
          <div
            key={i}
            title={`Beat ${b.idx + 1} — ${b.name} · ${fmtDur(b.duration)}`}
            className="relative flex items-center justify-center overflow-hidden cursor-default"
            style={{
              flex: b.duration,
              height: '100%',
              background: `linear-gradient(90deg, rgba(99,102,241,0.19), rgba(99,102,241,0.09))`,
            }}
          >
            <span
              className="font-mono text-[10px] whitespace-nowrap px-1.5 overflow-hidden text-ellipsis"
              style={{ color: TH.text, opacity: 0.8 }}
            >
              {b.idx + 1} {b.name}
            </span>
          </div>
        ))}
      </div>
      <span className={MONO_SM_CLS} style={{ color: TH.text }}>
        {beats.length} beats · {fmtDur(totalDur)} total
      </span>
    </div>
  )
}

export const ProgressBar = memo(ProgressBarRaw)
ProgressBar.displayName = 'ProgressBar'
