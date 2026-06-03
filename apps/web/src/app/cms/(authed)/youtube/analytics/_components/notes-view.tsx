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
    toast.success('Nota salva.')
    setText('')
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-pad">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Anotar algo sobre o desempenho deste periodo…"
            className="notes-input"
          />
          <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
            <span className="dim" style={{ fontSize: 11.5 }}>Visivel pra voce e pro Cowork</span>
            <button
              type="button"
              className="btn primary sm"
              disabled={!text.trim()}
              onClick={handleSave}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
              Salvar nota
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col" style={{ gap: 10 }}>
        {notes.map((note) => (
          <div key={note.id} className="card note-row">
            <div className={`note-av${note.isBot ? ' bot' : ''}`}>
              {note.isBot ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M5 18l.7 1.8L7.5 20l-1.8.7L5 22l-.7-1.3L2.5 20l1.8-.2z"/></svg>
              ) : (
                note.author.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                  {note.isBot ? 'Cowork' : note.author}
                  {note.isBot && (
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-medium" style={{ marginLeft: 7, background: 'var(--cyan-soft, rgba(63,169,192,0.13))', color: 'var(--cyan, #3FA9C0)' }}>
                      IA
                    </span>
                  )}
                </span>
                <span className="mono dim" style={{ fontSize: 11 }}>
                  {fmtRelative(note.timestamp)}
                </span>
              </div>
              <p style={{ fontSize: 13, marginTop: 5, lineHeight: 1.5 }}>
                {note.text}
              </p>
            </div>
          </div>
        ))}

        {notes.length === 0 && (
          <p className="dim" style={{ fontSize: 12, textAlign: 'center', padding: '24px 0' }}>
            Nenhuma nota ainda. Escreva a primeira acima.
          </p>
        )}
      </div>
    </div>
  )
}
