'use client'

import { Eye } from 'lucide-react'
import { videoBeatRead } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { ScriptLine } from './script-line'

interface RoteiroBeatProps {
  beat: RoteiroBeatV3
  idx: number
  notes: boolean
  spoken: Set<string>
  cursorKey: string | undefined
  onToggle: (k: string) => void
  onCommitLine: (beatIdx: number, lineIdx: number, next: string) => void
}

export function RoteiroBeat({ beat, idx, notes, spoken, cursorKey, onToggle, onCommitLine }: RoteiroBeatProps) {
  const lineIdxs = beat.script.map((it, i) => (it.type === 'line' ? i : -1)).filter((i) => i >= 0)
  const done = lineIdxs.filter((i) => spoken.has(`${idx}-${i}`)).length
  const pct = lineIdxs.length ? Math.round((done / lineIdxs.length) * 100) : 0

  return (
    <div className="rb">
      <div className="rb-head" style={{ position: 'sticky', top: 'var(--ed-bar-h, 56px)' }}>
        <span className="rb-n">#{idx + 1}</span>
        <span className="rb-name">{beat.name}</span>
        <span className="rb-info">~{videoBeatRead(beat)}s de fala</span>
      </div>
      <div className="rb-prog"><span style={{ width: `${pct}%`, background: pct === 100 ? 'var(--ok)' : undefined }} /></div>
      {beat.tone && <div className="rb-tone"><Eye size={14} /> {beat.tone}</div>}
      {beat.script.map((it, i) => {
        if (it.type === 'line') {
          const k = `${idx}-${i}`
          return (
            <ScriptLine
              key={i}
              text={it.text}
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
        if ((it.type === 'vis' || it.type === 'ed') && notes) {
          return <div key={i} className={`rb-note rb-${it.type}`}>{it.text}</div>
        }
        return null
      })}
    </div>
  )
}
