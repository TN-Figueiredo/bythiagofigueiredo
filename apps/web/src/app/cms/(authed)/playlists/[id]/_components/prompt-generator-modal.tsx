'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'
import { buildPlaylistPrompt, extractTextFromJSON } from '@/lib/playlists/prompt-builder'
import type { ReuseCandidateItem } from '@/lib/playlists/prompt-builder'
import type { PlaylistRow, PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'

interface PlaylistPromptModalProps {
  playlist: PlaylistRow
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  selectedItemIds: string[]
  reuseCandidates: ReuseCandidateItem[]
  onClose: () => void
}

export function PlaylistPromptModal({
  playlist,
  items,
  edges,
  selectedItemIds,
  reuseCandidates,
  onClose,
}: PlaylistPromptModalProps) {
  const [instructions, setInstructions] = useState('')
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleTrapKeyDown = useFocusTrap(dialogRef)

  const focusedItems = useMemo(
    () => items.filter(item => selectedItemIds.includes(item.id)),
    [items, selectedItemIds],
  )

  const tbdCount = useMemo(
    () => items.filter(item => /^TBD\b/i.test(item.title)).length,
    [items],
  )

  const promptResult = useMemo(
    () => buildPlaylistPrompt({
      playlist,
      items,
      edges,
      focusedItemIds: selectedItemIds,
      reuseCandidates,
      userInstructions: instructions,
    }),
    [playlist, items, edges, selectedItemIds, reuseCandidates, instructions],
  )

  const fullPrompt = promptResult.text

  const notesWordCount = useMemo(() => {
    if (!playlist.notes) return 0
    return extractTextFromJSON(playlist.notes).split(/\s+/).filter(Boolean).length
  }, [playlist.notes])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(fullPrompt).then(() => {
      setCopied(true)
    }).catch(() => {
      toast.error('Não foi possível copiar. Use Cmd+A, Cmd+C no preview.')
    })
  }, [fullPrompt])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    function handleKeys(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleCopy()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [onClose, handleCopy])

  useEffect(() => {
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm motion-reduce:backdrop-blur-none"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Gerar Prompt — ${playlist.name_en || playlist.name_pt}`}
        className="w-full max-w-lg rounded-lg border p-4 shadow-xl"
        style={{ ...GEM_CSS_VARS as React.CSSProperties, borderColor: 'var(--gem-border)', backgroundColor: 'var(--gem-surface)' }}
        onKeyDown={handleTrapKeyDown}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600/20 text-base">
              🤖
            </span>
            <h2 className="flex-1 text-sm font-semibold" style={{ color: 'var(--gem-text)' }}>
              Gerar Prompt — Playlist
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded p-1 transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
              style={{ color: 'var(--gem-dim)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--gem-dim)' }}>
            {playlist.name_en || playlist.name_pt}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {playlist.status}
            </span>
            {playlist.category && (
              <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
                {playlist.category}
              </span>
            )}
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {items.length} items
            </span>
            <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--gem-well)' }}>
              {edges.length} edges
            </span>
          </div>
        </div>

        {/* Items em foco */}
        {focusedItems.length > 0 && (
          <div className="mb-3 rounded-md p-2" style={{ background: 'var(--gem-well)' }}>
            <h3 className="text-xs font-medium" style={{ color: 'var(--gem-text)' }}>
              Items em foco ({focusedItems.length})
            </h3>
            <ul className="mt-1.5 flex flex-col gap-1">
              {focusedItems.map((item, i) => (
                <li key={item.id} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[11px]" style={{ color: 'var(--gem-dim)' }}>
                    {i + 1}.
                  </span>
                  <span className="rounded px-1 py-0.5 text-[11px]" style={{ background: 'var(--gem-surface)' }}>
                    {item.content_type ?? 'ghost'}
                  </span>
                  <span style={{ color: 'var(--gem-text)' }}>{item.title}</span>
                  {item.status && (
                    <span className="rounded px-1 py-0.5 text-[11px]" style={{ background: 'var(--gem-surface)' }}>
                      {item.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px]" style={{ color: 'var(--gem-dim)' }}>
              Shift+click nos cards do canvas para selecionar/remover
            </p>
          </div>
        )}

        {/* Instructions input */}
        <textarea
          ref={textareaRef}
          value={instructions}
          onChange={(e) => { setInstructions(e.target.value); setCopied(false) }}
          placeholder="Descreva o que quer discutir ou alterar..."
          aria-label="Instruções para o prompt"
          className="w-full text-xs p-2.5 rounded-md resize-y"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
            minHeight: '60px',
            maxHeight: '120px',
          }}
          rows={3}
        />

        {/* Stats line */}
        <div className="mt-1.5 flex items-center gap-3 text-[11px]" style={{ color: 'var(--gem-dim)' }}>
          {tbdCount > 0 && <span>TBD: {tbdCount}</span>}
          {notesWordCount > 0 && <span>Notas: {notesWordCount} palavras</span>}
          <span>~{promptResult.wordCount} palavras no prompt</span>
        </div>

        {/* Preview toggle */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-[11px] hover:underline rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
            style={{ color: 'var(--gem-accent)' }}
          >
            {showPreview ? 'Ocultar prompt' : 'Ver prompt completo'}
          </button>
        </div>

        {showPreview && (
          <pre
            className="mt-2 p-2.5 rounded-md text-[11px] overflow-y-auto"
            style={{
              maxHeight: '200px',
              background: 'var(--gem-well)',
              border: '1px solid var(--gem-border)',
              color: 'var(--gem-dim)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >{fullPrompt}</pre>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center mt-3">
          <span className="text-[11px]" style={{ color: 'var(--gem-dim)' }}>
            Cole no Claude Code
          </span>
          <div className="flex gap-1.5 items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
              style={{ border: '1px solid var(--gem-border)', color: 'var(--gem-muted)' }}
            >
              Cancelar
            </button>
            {copied ? (
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 text-xs font-semibold rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{ background: 'var(--gem-done)', color: 'white' }}
              >
                Copiado — fechar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1 text-xs font-semibold rounded focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
                style={{ background: 'var(--gem-accent)', color: 'white' }}
              >
                Copiar prompt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
