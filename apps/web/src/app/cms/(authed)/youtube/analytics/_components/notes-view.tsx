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
  channelId: string
  onCreateNote?: (input: { channelId: string; text: string }) => Promise<{ ok: boolean; error?: string }>
  onDeleteNote?: (noteId: string) => Promise<{ ok: boolean; error?: string }>
}

export function NotesView({ notes, channelId, onCreateNote, onDeleteNote }: NotesViewProps) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!text.trim() || !onCreateNote || saving) return
    setSaving(true)
    try {
      const result = await onCreateNote({ channelId, text: text.trim() })
      if (result.ok) {
        toast.success('Nota salva.')
        setText('')
      } else {
        toast.error(result.error ?? 'Erro ao salvar nota.')
      }
    } catch {
      toast.error('Erro ao salvar nota.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!onDeleteNote) return
    try {
      const result = await onDeleteNote(noteId)
      if (result.ok) {
        toast.success('Nota removida.')
      } else {
        toast.error(result.error ?? 'Erro ao remover nota.')
      }
    } catch {
      toast.error('Erro ao remover nota.')
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-pad">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Anotar algo sobre o desempenho deste periodo..."
            className="notes-input"
          />
          <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
            <span className="dim" style={{ fontSize: 11.5 }}>Visivel pra voce e pro Cowork</span>
            <button
              type="button"
              className="btn primary sm"
              disabled={!text.trim() || saving}
              onClick={handleSave}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
              {saving ? 'Salvando...' : 'Salvar nota'}
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
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span className="mono dim" style={{ fontSize: 11 }}>
                    {fmtRelative(note.timestamp)}
                  </span>
                  {onDeleteNote && !note.isBot && (
                    <button
                      type="button"
                      className="ic-btn danger"
                      style={{ width: 24, height: 24 }}
                      title="Remover nota"
                      onClick={() => handleDelete(note.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  )}
                </div>
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
