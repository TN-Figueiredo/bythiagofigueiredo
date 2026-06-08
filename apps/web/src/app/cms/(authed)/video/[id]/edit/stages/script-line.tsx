'use client'

import { Check } from 'lucide-react'

/** **word** → <b class="emph">word</b>, HTML-escaped first. */
export function emphHtml(text: string): string {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return esc.replace(/\*\*(.+?)\*\*/g, '<b class="emph">$1</b>')
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
        onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
