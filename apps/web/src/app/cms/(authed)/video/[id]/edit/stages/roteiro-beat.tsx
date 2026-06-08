'use client'

import { Eye } from 'lucide-react'
import { videoBeatRead } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { ScriptLine, emphHtml } from './script-line'

interface RoteiroBeatProps {
  beat: RoteiroBeatV3
  idx: number
  notes: boolean
  spoken: Set<string>
  cursorKey: string | undefined
  onToggle: (k: string) => void
  onCommitLine: (beatIdx: number, lineIdx: number, next: string) => void
}

/**
 * A single roteiro beat: sticky head with progress, optional tone, and the
 * sequence of lines / pauses / editor notes. Markup mirrors the design handoff.
 */
export function RoteiroBeat({ beat, idx, notes, spoken, cursorKey, onToggle, onCommitLine }: RoteiroBeatProps) {
  const lineIdx = beat.script.map((it, i) => (it.type === 'line' ? i : -1)).filter((i) => i >= 0)
  const total = lineIdx.length
  const done = lineIdx.filter((i) => spoken.has(`${idx}-${i}`)).length
  const full = total > 0 && done === total

  return (
    <div className="rot-beat" id={`rb-${idx}`}>
      <div className="rb-head">
        <span className="rb-num">#{idx + 1}</span>
        <span className="rb-name">{beat.name}</span>
        <span className="grow" />
        <span className={'rb-prog' + (full ? ' full' : '')}>{done}/{total} faladas</span>
        <span className="rb-info">~{videoBeatRead(beat)}s de fala</span>
      </div>
      <div className="rb-progbar">
        <span className={full ? 'full' : ''} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      {beat.tone && <div className="rb-tone"><Eye size={14} /> {beat.tone}</div>}
      {beat.script.map((it, i) => {
        if (it.type === 'line') {
          const k = `${idx}-${i}`
          return (
            <ScriptLine
              key={i}
              html={emphHtml(it.text)}
              isKey={!!it.key}
              spoken={spoken.has(k)}
              current={cursorKey === k}
              dataK={k}
              onToggle={() => onToggle(k)}
              onCommit={(next) => onCommitLine(idx, i, next)}
            />
          )
        }
        if (it.type === 'pause') {
          return (
            <div key={i} className="rb-pause">
              <span className="rb-breath">respira <span className="rb-dur">{String(it.duration).replace('.', ',')}s</span></span>
            </div>
          )
        }
        if (!notes) return null
        if (it.type === 'vis') {
          return <div key={i} className="rb-note vis"><span className="rn-tag">Visual</span><span className="rn-tx">{it.text}</span></div>
        }
        if (it.type === 'ed') {
          return <div key={i} className="rb-note ed"><span className="rn-tag">Editor</span><span className="rn-tx">{it.text}</span></div>
        }
        return null
      })}
    </div>
  )
}
