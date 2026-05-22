'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { PlaylistRow, ActionResult } from '@/lib/playlists/types'
import { PipelineEditor } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor'
import type { JSONContent } from '@tiptap/react'
import { extractTextFromJSON } from '@/lib/playlists/prompt-builder'

interface NotesDrawerProps {
  playlist: PlaylistRow
  onSaveNotes: (playlistId: string, siteId: string, notes: Record<string, unknown> | null) => Promise<ActionResult<void>>
}

export function NotesDrawer({ playlist, onSaveNotes }: NotesDrawerProps) {
  const [expanded, setExpanded] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [wordCount, setWordCount] = useState(() => {
    if (!playlist.notes) return 0
    return extractTextFromJSON(playlist.notes).split(/\s+/).filter(Boolean).length
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleNotesChange = useCallback(
    (content: JSONContent) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)

      const text = extractTextFromJSON(content)
      setWordCount(text.split(/\s+/).filter(Boolean).length)

      debounceRef.current = setTimeout(() => {
        setSaveState('saving')
        onSaveNotes(playlist.id, playlist.site_id, content as Record<string, unknown>).then(
          (result) => {
            setSaveState(result.ok ? 'saved' : 'error')
            if (result.ok) setTimeout(() => setSaveState('idle'), 2000)
          },
        )
      }, 2000)
    },
    [onSaveNotes, playlist.id, playlist.site_id],
  )

  return (
    <div className="border-t border-white/10 bg-[#0d0d18]">
      {/* Collapsed bar — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-center gap-3 px-4 py-2 text-xs transition-colors hover:bg-white/5"
      >
        <span className="text-white/50">{expanded ? '▼' : '▲'}</span>
        <span className="font-medium text-white/70">Notas</span>
        {wordCount > 0 && (
          <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
            {wordCount} palavras
          </span>
        )}
        <span className="ml-auto text-[10px] text-white/30">
          {saveState === 'saving' && 'Salvando...'}
          {saveState === 'saved' && 'Salvo ✓'}
          {saveState === 'error' && <span className="text-red-400">Erro</span>}
        </span>
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-white/5 px-4 pb-3 pt-2">
          <div className="max-h-[200px] overflow-y-auto">
            <PipelineEditor
              content={playlist.notes as JSONContent | null}
              isEditing={true}
              onContentChange={handleNotesChange}
              preset="compact"
              placeholder="Anote ideias, decisões e contexto para a próxima discussão..."
            />
          </div>
        </div>
      )}
    </div>
  )
}
