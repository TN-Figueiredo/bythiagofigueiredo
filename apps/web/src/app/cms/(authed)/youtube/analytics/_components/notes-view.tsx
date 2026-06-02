/**
 * NotesView — manual notes + Cowork bot notes.
 * Max 720px. Textarea + "Salvar nota" button (disabled if empty -> toast).
 * Note history list with avatar (.bot cyan for Cowork), author, timestamp, text.
 */
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { fmtRelative } from '@/lib/youtube/format'

export interface NoteEntry {
  id: string
  author: string
  text: string
  timestamp: string
  isBot: boolean
}

interface NotesViewProps {
  notes: NoteEntry[]
}

export function NotesView({ notes }: NotesViewProps) {
  const [text, setText] = useState('')

  const handleSave = () => {
    if (!text.trim()) return
    toast.success('Nota salva')
    setText('')
  }

  return (
    <div className="fade-in flex flex-col gap-4" style={{ maxWidth: 720 }}>
      {/* Input area */}
      <div className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma nota sobre o desempenho do canal..."
          className="notes-input"
        />
        <div className="flex justify-end">
          <button
            type="button"
            className="btn primary sm"
            disabled={!text.trim()}
            onClick={handleSave}
          >
            Salvar nota
          </button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="note-row rounded-lg border border-cms-border bg-cms-surface"
            >
              {/* Avatar */}
              <div
                className={`note-av${note.isBot ? ' bot' : ''}`}
              >
                {note.isBot ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 8V4H8" />
                    <rect width="16" height="12" x="4" y="8" rx="2" />
                    <path d="M2 14h2" />
                    <path d="M20 14h2" />
                    <path d="M15 13v2" />
                    <path d="M9 13v2" />
                  </svg>
                ) : (
                  note.author.charAt(0).toUpperCase()
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-cms-text">
                    {note.author}
                  </span>
                  {note.isBot && (
                    <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-medium text-cyan-400">
                      Cowork
                    </span>
                  )}
                  <span className="tnum text-[10px] text-cms-text-muted">
                    {fmtRelative(note.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-cms-text-muted">
                  {note.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length === 0 && (
        <p className="text-center text-xs text-cms-text-muted">
          Nenhuma nota ainda. Escreva a primeira acima.
        </p>
      )}
    </div>
  )
}
