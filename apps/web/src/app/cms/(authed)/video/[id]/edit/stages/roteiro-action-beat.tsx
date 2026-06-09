'use client'

import type { CSSProperties } from 'react'
import { Eye, Mic, CornerUpLeft } from 'lucide-react'
import type { BeatKind, RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { markableIdxs } from '@/lib/pipeline/video-perform'
import { ActionRow } from './script-line'

interface RoteiroActionBeatProps {
  beat: RoteiroBeatV3
  idx: number
  seq: number
  style?: CSSProperties
  /** True when the kind came from the heuristic (no explicit beat.kind) → offer recovery. */
  inferred: boolean
  notes: boolean
  spoken: Set<string>
  onToggle: (k: string) => void
  onSetKind: (beatIdx: number, kind: BeatKind) => void
  /** Content-edit gate. False (view mode) → the "é fala?" recover control is disabled (visibly inert). */
  canEdit: boolean
}

/**
 * An `acao` beat: things the talent DOES on camera (interview prompts, captures) — no
 * fixed script. Rendered as a checklist, visually distinct from the spoken teleprompter.
 * Legacy `line` items inside an action beat are treated as action prompts.
 */
export function RoteiroActionBeat({ beat, idx, seq, style, inferred, notes, spoken, onToggle, onSetKind, canEdit }: RoteiroActionBeatProps) {
  const marks = markableIdxs(beat, 'acao')
  const total = marks.length
  const done = marks.filter((i) => spoken.has(`${idx}-${i}`)).length
  const full = total > 0 && done === total

  return (
    <div className="rot-beat rot-beat-act" id={`rb-${idx}`} style={style}>
      <div className="rb-head">
        <span className="rb-num act">#{seq}</span>
        <span className="rb-name">{beat.name}</span>
        <span className="rb-kindtag"><Mic size={11} /> ação na câmera</span>
        {inferred && (
          <button type="button" className="rb-recover" title="Classificado automaticamente — mover pra fala" disabled={!canEdit} onClick={() => onSetKind(idx, 'fala')}>
            <CornerUpLeft size={11} /> é fala?
          </button>
        )}
        <span className="grow" />
        {total > 0 && <span className={'rb-prog' + (full ? ' full' : '')}>{done}/{total} feitos</span>}
      </div>
      {total > 0 && (
        <div className="rb-progbar">
          <span className={full ? 'full' : ''} style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      )}
      {beat.tone && <div className="rb-tone"><Eye size={14} /> {beat.tone}</div>}

      {beat.script.map((it, i) => {
        if (it.type === 'action' || it.type === 'line') {
          const k = `${idx}-${i}`
          const isKey = it.type === 'action' ? !!it.key : !!(it as { key?: boolean }).key
          return <ActionRow key={i} text={it.text} isKey={isKey} done={spoken.has(k)} onToggle={() => onToggle(k)} />
        }
        if (it.type === 'dir') {
          return <div key={i} className="rb-dir"><Eye size={13} /> <span>{it.text}</span></div>
        }
        if (!notes) return null
        if (it.type === 'vis') {
          return <div key={i} className="rb-note vis"><span className="rn-tag">Editor · b-roll</span><span className="rn-tx">{it.text}</span></div>
        }
        if (it.type === 'ed') {
          return <div key={i} className="rb-note ed"><span className="rn-tag">Editor</span><span className="rn-tx">{it.text}</span></div>
        }
        return null
      })}
    </div>
  )
}
