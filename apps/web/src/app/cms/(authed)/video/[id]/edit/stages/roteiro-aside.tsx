'use client'

import { useState } from 'react'
import { ChevronRight, Backpack, Scissors, ArrowRight, CornerUpLeft } from 'lucide-react'
import type { BeatKind } from '@/lib/pipeline/roteiro-schemas'
import type { KindedBeat } from '@/lib/pipeline/video-perform'
import { itemText } from '@/lib/pipeline/video-perform'

/** Bullets for a logistics/editor beat — every non-note item as plain text. */
function bullets(b: KindedBeat): string[] {
  return b.beat.script
    .filter((it) => it.type === 'line' || it.type === 'action' || it.type === 'pause')
    .map(itemText)
}

/** A "this was auto-filed — move it to fala" recovery control (only for inferred kinds). */
function Recover({ kb, onSetKind, canEdit }: { kb: KindedBeat; onSetKind: (beatIdx: number, kind: BeatKind) => void; canEdit: boolean }) {
  if (kb.beat.kind) return null // explicit kind → not a guess, no recovery needed
  return (
    <button type="button" className="rot-recover" title="Classificado automaticamente — mover pra fala" disabled={!canEdit} onClick={() => onSetKind(kb.idx, 'fala')}>
      <CornerUpLeft size={11} /> é fala?
    </button>
  )
}

/**
 * "Antes de gravar" — shoot-day logistics (kit, capture timeline, must-gets) pulled OUT
 * of the reading flow. Collapsed by default so it never competes with the lines; one
 * click reveals the checklist when the talent is prepping the bag.
 */
export function PrepStrip({ prep, onSetKind, canEdit }: { prep: KindedBeat[]; onSetKind: (beatIdx: number, kind: BeatKind) => void; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  if (prep.length === 0) return null
  return (
    <div className={'rot-prep' + (open ? ' open' : '')}>
      <button type="button" className="rot-prep-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ChevronRight size={15} className="rot-prep-caret" />
        <Backpack size={14} />
        <span className="rot-prep-title">Antes de gravar</span>
        <span className="rot-prep-count">{prep.length}</span>
        <span className="grow" />
        <span className="rot-prep-hint">logística — fora da gravação</span>
      </button>
      {open && (
        <div className="rot-prep-body">
          {prep.map((b) => (
            <div key={b.idx} className="rot-prep-grp">
              <div className="rot-prep-nm">{b.beat.name}<Recover kb={b} onSetKind={onSetKind} canEdit={canEdit} /></div>
              <ul>{bullets(b).map((t, j) => <li key={j}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * "Pro editor" — b-roll shot lists & visual coverage don't belong in the actor's flow.
 * They route to the editor (Pós). This footer keeps that contract visible and tells the
 * talent the real way to send a cue: turn on "Notas do editor" and hit "+ nota pro
 * editor" on a beat. `visInFala` counts cues authored inline inside spoken beats.
 */
export function EditorHandoff({
  editor,
  visInFala,
  notes,
  goPos,
  onSetKind,
  canEdit,
}: {
  editor: KindedBeat[]
  visInFala: number
  notes: boolean
  goPos: () => void
  onSetKind: (beatIdx: number, kind: BeatKind) => void
  canEdit: boolean
}) {
  if (editor.length === 0 && visInFala === 0) return null
  const count = editor.length + visInFala
  return (
    <div className="rot-edh">
      <div className="rot-edh-head">
        <Scissors size={14} />
        <span className="rot-edh-title">Pro editor</span>
        <span className="rot-edh-count">{count} {count === 1 ? 'cue' : 'cues'}</span>
        <span className="grow" />
        <button type="button" className="rot-edh-go" onClick={goPos}>ver no Pós <ArrowRight size={13} /></button>
      </div>
      <div className="rot-edh-sub">
        B-roll e captação são do editor — você sugere, ele se vira. Pra adicionar uma cue:{' '}
        {notes ? 'use ' : 'ligue '}
        <span className="rot-edh-k">{notes ? '+ nota pro editor' : 'Notas do editor'}</span>
        {notes ? ' num beat. Tudo aparece no Pós.' : ' e marque no beat. Tudo aparece no Pós.'}
      </div>
      {notes && editor.length > 0 && (
        <div className="rot-edh-body">
          {editor.map((b) => (
            <div key={b.idx} className="rot-edh-grp">
              <div className="rot-edh-nm">{b.beat.name}<Recover kb={b} onSetKind={onSetKind} canEdit={canEdit} /></div>
              <ul>{bullets(b).map((t, j) => <li key={j}>{t}</li>)}</ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
