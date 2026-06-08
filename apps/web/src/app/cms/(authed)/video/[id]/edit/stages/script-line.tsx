'use client'

import { Check } from 'lucide-react'

/** **word** → <b class="emph">word</b>, HTML-escaped first. */
export function emphHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.+?)\*\*/g, '<b class="emph">$1</b>')
}

/**
 * Inverse of `emphHtml`: serialize an edited contentEditable back to markup so the
 * `**emphasis**` survives a round-trip. Without this, committing `textContent` would
 * silently strip the bold markers on every edit.
 */
export function htmlToMarkup(el: HTMLElement): string {
  let out = ''
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? ''
    } else if (n instanceof HTMLElement) {
      const inner = htmlToMarkup(n)
      const isEmph = n.tagName === 'B' || n.tagName === 'STRONG' || n.classList.contains('emph')
      out += isEmph && inner ? `**${inner}**` : inner
    }
  })
  out = out
    .replace(/\*{3,}/g, '**')      // flatten nested emphasis to a single level
    .replace(/\*\*\s*\*\*/g, '')   // drop empty emphasis
    .replace(/\u00a0/g, ' ')
  // strip an orphan (unbalanced) `**` so partial edits never persist a half-marker
  const seg = out.split('**')
  if ((seg.length - 1) % 2 === 1) {
    const orphan = seg.pop() ?? ''
    seg[seg.length - 1] = (seg[seg.length - 1] ?? '') + orphan
  }
  return seg.join('**').trim()
}

interface ScriptLineProps {
  html: string
  isKey: boolean
  spoken: boolean
  current: boolean
  dataK: string
  onToggle: () => void
  onCommit: (next: string) => void
}

/**
 * One spoken line of the teleprompter. Markup mirrors the design handoff exactly:
 * `.rb-line(.key/.spoken/.current)[data-k]` wrapping a mark button + contentEditable text.
 */
export function ScriptLine({ html, isKey, spoken, current, dataK, onToggle, onCommit }: ScriptLineProps) {
  return (
    <div
      className={'rb-line' + (isKey ? ' key' : '') + (spoken ? ' spoken' : '') + (current ? ' current' : '')}
      data-k={dataK}
    >
      <button
        type="button"
        className="rb-mark"
        onClick={onToggle}
        title={spoken ? 'Desmarcar' : 'Marcar como falada'}
        aria-pressed={spoken}
      >
        <span className="rb-mark-dot">{spoken && <Check size={11} />}</span>
      </button>
      <div
        className="rb-line-tx"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => onCommit(htmlToMarkup(e.currentTarget))}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

/**
 * One on-camera ACTION — a thing the talent DOES (interview prompt, capture, approach).
 * A square checkbox + medium text, distinct from the serif teleprompter line. Marking
 * checks it off (it's a do-list, not a read-list).
 */
export function ActionRow({ text, isKey, done, onToggle }: { text: string; isKey: boolean; done: boolean; onToggle: () => void }) {
  return (
    <div className={'rb-act' + (isKey ? ' key' : '') + (done ? ' done' : '')}>
      <button type="button" className="rb-actbox" onClick={onToggle} title={done ? 'Desmarcar' : 'Marcar como feito'} aria-pressed={done}>
        <span className="rb-actbox-in">{done && <Check size={12} />}</span>
      </button>
      <div className="rb-act-tx" dangerouslySetInnerHTML={{ __html: emphHtml(text) }} />
    </div>
  )
}

/**
 * An editor cue (vis/ed) shown in the Roteiro only when "Notas do editor" is on. Editable
 * in place; clearing the text removes the cue. These feed the Pós b-roll brief.
 */
export function EditorNote({ tag, variant, text, onCommit }: { tag: string; variant: 'vis' | 'ed'; text: string; onCommit: (next: string) => void }) {
  return (
    <div className={'rb-note ' + variant}>
      <span className="rn-tag">{tag}</span>
      <span
        className="rn-tx"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
      >
        {text}
      </span>
    </div>
  )
}
