// apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/_timeline/script-panel.tsx
'use client'

import { useState, memo } from 'react'
import type { ScriptItem } from './types'
import { TH, MONO_XS_CLS, MONO_SM_CLS } from './constants'
import { badgeTextColor } from './utils'

interface ScriptPanelProps {
  script: ScriptItem[] | undefined
}

function ScriptItemNote({ item }: { item: Extract<ScriptItem, { type: 'note' }> }) {
  return (
    <div className="flex gap-2 mb-2 items-start">
      <span
        className={`${MONO_XS_CLS} shrink-0 mt-0.5 rounded-[3px]`}
        style={{
          fontSize: 9,
          padding: '2px 7px',
          background: item.tagColor,
          color: badgeTextColor(item.tagColor),
        }}
      >
        {item.tag}
      </span>
      <span className="text-[12px] leading-relaxed" style={{ color: TH.muted }}>
        {item.text}
      </span>
    </div>
  )
}

function ScriptItemLine({ item }: { item: Extract<ScriptItem, { type: 'line' }> }) {
  return (
    <div
      className="my-1.5 rounded-r"
      style={{
        borderLeft: `3px solid ${item.accent ?? TH.text}`,
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <span className="text-[13px] italic leading-[1.65]" style={{ color: TH.text }}>
        {item.text}
      </span>
    </div>
  )
}

function ScriptItemPause({ item }: { item: Extract<ScriptItem, { type: 'pause' }> }) {
  return (
    <div className="my-1 ml-1.5">
      <span
        className="font-mono text-[10px] rounded-[3px]"
        style={{ padding: '2px 8px', background: 'rgba(39,174,96,0.12)', color: '#27AE60' }}
      >
        ⏸ {item.duration}s
      </span>
    </div>
  )
}

function ScriptItemRef({ item }: { item: Extract<ScriptItem, { type: 'ref' }> }) {
  return (
    <div className="mt-3 pt-2" style={{ borderTop: `1px solid ${TH.border}` }}>
      <span
        className={MONO_XS_CLS}
        style={{
          fontSize: 8,
          color: '#E67E22',
          marginRight: 6,
          padding: '1px 5px',
          borderRadius: 2,
          background: 'rgba(230,126,34,0.12)',
        }}
      >
        REF
      </span>
      <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 10, lineHeight: 1.5 }}>
        {item.text}
      </span>
    </div>
  )
}

function ScriptPanelRaw({ script }: ScriptPanelProps) {
  const [open, setOpen] = useState(false)

  if (!script || script.length === 0) return null

  const lineCount = script.filter(s => s.type === 'line').length

  return (
    <div style={{ borderTop: `1px solid ${TH.border}` }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none text-left"
        style={{ background: TH.header }}
      >
        <span
          className="text-[10px] transition-transform duration-200"
          style={{ color: TH.dim, transform: open ? 'rotate(90deg)' : 'rotate(0)' }}
        >
          ▶
        </span>
        <span className={MONO_XS_CLS} style={{ color: TH.muted, fontSize: 9 }}>ROTEIRO</span>
        <span className={MONO_SM_CLS} style={{ color: TH.dim, fontSize: 9 }}>
          {lineCount} fala{lineCount !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
      </button>
      {open && (
        <div className="px-4 py-3.5 pb-4.5" style={{ background: TH.bg }}>
          {script.map((item, i) => {
            switch (item.type) {
              case 'note':  return <ScriptItemNote key={i} item={item} />
              case 'line':  return <ScriptItemLine key={i} item={item} />
              case 'pause': return <ScriptItemPause key={i} item={item} />
              case 'ref':   return <ScriptItemRef key={i} item={item} />
              default:      return null
            }
          })}
        </div>
      )}
    </div>
  )
}

export const ScriptPanel = memo(ScriptPanelRaw)
ScriptPanel.displayName = 'ScriptPanel'
