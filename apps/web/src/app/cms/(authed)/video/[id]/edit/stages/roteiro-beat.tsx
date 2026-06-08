'use client'

import type { CSSProperties } from 'react'
import { Eye, Sparkles, Plus } from 'lucide-react'
import { videoBeatRead } from '@/lib/pipeline/video-schemas'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { ScriptLine, ActionRow, EditorNote, emphHtml } from './script-line'

interface RoteiroBeatProps {
  beat: RoteiroBeatV3
  /** Stable index into content.beats — drives DOM id + `spoken` keys. */
  idx: number
  /** Display number in the performer sequence (1..N, prep/editor excluded). */
  seq: number
  style?: CSSProperties
  notes: boolean
  spoken: Set<string>
  cursorKey: string | undefined
  onToggle: (k: string) => void
  onCommitLine: (beatIdx: number, lineIdx: number, next: string) => void
  onCommitNote: (beatIdx: number, itemIdx: number, next: string) => void
  onAddCue: (beatIdx: number) => void
}

/**
 * A `fala` beat: sticky head with spoken progress, optional tone, and the sequence of
 * lines / actions / breaths / talent notes. Editor cues (vis/ed) only show when
 * "Notas do editor" is on — they belong to the editor (Pós), not the performer.
 */
export function RoteiroBeat({ beat, idx, seq, style, notes, spoken, cursorKey, onToggle, onCommitLine, onCommitNote, onAddCue }: RoteiroBeatProps) {
  const lineIdx = beat.script.map((it, i) => (it.type === 'line' ? i : -1)).filter((i) => i >= 0)
  const total = lineIdx.length
  const done = lineIdx.filter((i) => spoken.has(`${idx}-${i}`)).length
  const full = total > 0 && done === total
  // A beat with no performer content at all (only editor cues, or nothing) — render a
  // quiet placeholder instead of a dead "0/0 faladas" row.
  const hasPerformer = beat.script.some((it) => it.type === 'line' || it.type === 'action' || it.type === 'pause')

  return (
    <div className="rot-beat" id={`rb-${idx}`} style={style}>
      <div className="rb-head">
        <span className="rb-num">#{seq}</span>
        <span className="rb-name">{beat.name}</span>
        <span className="grow" />
        {total > 0 && <span className={'rb-prog' + (full ? ' full' : '')}>{done}/{total} faladas</span>}
        {total > 0 && <span className="rb-info">~{videoBeatRead(beat)}s de fala</span>}
      </div>
      {total > 0 && (
        <div className="rb-progbar">
          <span className={full ? 'full' : ''} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      )}
      {beat.tone && <div className="rb-tone"><Eye size={14} /> {beat.tone}</div>}

      {!hasPerformer && (
        <div className="rb-empty">
          <Sparkles size={13} /> Sem fala ainda — peça ao Cowork pra rascunhar este beat.
        </div>
      )}

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
        if (it.type === 'action') {
          const k = `${idx}-${i}`
          return <ActionRow key={i} text={it.text} isKey={!!it.key} done={spoken.has(k)} onToggle={() => onToggle(k)} />
        }
        if (it.type === 'pause') {
          return (
            <div key={i} className="rb-pause">
              <span className="rb-breath">respira <span className="rb-dur">{String(it.duration).replace('.', ',')}s</span></span>
            </div>
          )
        }
        if (it.type === 'dir') {
          // Talent performance note — always visible (it's for the actor, not the editor).
          return <div key={i} className="rb-dir"><Eye size={13} /> <span>{it.text}</span></div>
        }
        if (!notes) return null
        if (it.type === 'vis' || it.type === 'ed') {
          return (
            <EditorNote
              key={i}
              tag={it.type === 'vis' ? 'Editor · b-roll' : 'Editor'}
              variant={it.type}
              text={it.text}
              onCommit={(next) => onCommitNote(idx, i, next)}
            />
          )
        }
        return null
      })}

      {notes && (
        <button type="button" className="rb-addcue" onClick={() => onAddCue(idx)}>
          <Plus size={13} /> nota pro editor
        </button>
      )}
    </div>
  )
}
