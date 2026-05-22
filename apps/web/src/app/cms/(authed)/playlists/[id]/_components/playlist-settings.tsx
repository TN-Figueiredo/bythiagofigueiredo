'use client'

import { useState, useTransition, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PlaylistRow, PlaylistStatus, ActionResult } from '@/lib/playlists/types'
import { PipelineEditor } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor'
import type { JSONContent } from '@tiptap/react'
import { extractTextFromJSON } from '@/lib/playlists/prompt-builder'

interface PlaylistSettingsProps {
  playlist: PlaylistRow
  itemCount: number
  edgeCount: number
  isOpen: boolean
  onClose: () => void
  onUpdate: (playlistId: string, siteId: string, input: unknown) => Promise<ActionResult<PlaylistRow>>
  onDelete: (playlistId: string, siteId: string) => Promise<ActionResult<void>>
  onSaveNotes: (playlistId: string, siteId: string, notes: Record<string, unknown> | null) => Promise<ActionResult<void>>
}

type SettingsTab = 'config' | 'notes'

export function PlaylistSettings({
  playlist,
  itemCount,
  edgeCount,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onSaveNotes,
}: PlaylistSettingsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [namePt, setNamePt] = useState(playlist.name_pt)
  const [nameEn, setNameEn] = useState(playlist.name_en)
  const [slug, setSlug] = useState(playlist.slug)
  const [descriptionPt, setDescriptionPt] = useState(playlist.description_pt ?? '')
  const [descriptionEn, setDescriptionEn] = useState(playlist.description_en ?? '')
  const [category, setCategory] = useState(playlist.category ?? '')
  const [status, setStatus] = useState<PlaylistStatus>(playlist.status)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [activeTab, setActiveTab] = useState<SettingsTab>(playlist.notes ? 'notes' : 'config')
  const [noteSaveState, setNoteSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [noteWordCount, setNoteWordCount] = useState(() => {
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
      setNoteWordCount(text.split(/\s+/).filter(Boolean).length)

      debounceRef.current = setTimeout(() => {
        setNoteSaveState('saving')
        onSaveNotes(playlist.id, playlist.site_id, content as Record<string, unknown>).then(
          (result) => {
            setNoteSaveState(result.ok ? 'saved' : 'error')
            if (result.ok) setTimeout(() => setNoteSaveState('idle'), 2000)
          },
        )
      }, 2000)
    },
    [onSaveNotes, playlist.id, playlist.site_id],
  )

  if (!isOpen) return null

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await onUpdate(playlist.id, playlist.site_id, {
          name_pt: namePt,
          name_en: nameEn,
          slug,
          description_pt: descriptionPt || null,
          description_en: descriptionEn || null,
          category: category || null,
          status,
        })
        if (result.ok) {
          setMessage({ type: 'success', text: 'Settings saved' })
          setTimeout(() => setMessage(null), 2000)
        } else {
          setMessage({ type: 'error', text: result.error })
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await onDelete(playlist.id, playlist.site_id)
        if (result.ok) {
          router.push('/cms/playlists')
        } else {
          setMessage({ type: 'error', text: result.error })
        }
      } catch {
        setMessage({ type: 'error', text: 'Failed to delete playlist' })
      }
    })
  }

  const fieldClasses = 'rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white'

  return (
    <div className="flex h-full w-80 flex-col border-l border-white/10 bg-[#0a0a12]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-white/40 hover:text-white/70"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'config'
              ? 'border-b-2 border-indigo-400 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Config
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
            activeTab === 'notes'
              ? 'border-b-2 border-indigo-400 text-white'
              : 'text-white/40 hover:text-white/60'
          }`}
        >
          Notas
          {noteWordCount > 0 && (
            <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
              {noteWordCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'config' ? (
          <>
            {/* Stats */}
            <div className="mb-4 flex gap-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40">
              <span>{itemCount} items</span>
              <span>{edgeCount} edges</span>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Name (EN)</span>
                <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Name (PT)</span>
                <input type="text" value={namePt} onChange={e => setNamePt(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs text-white/60"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Description (EN)</span>
                <textarea value={descriptionEn} onChange={e => setDescriptionEn(e.target.value)} rows={2} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Description (PT)</span>
                <textarea value={descriptionPt} onChange={e => setDescriptionPt(e.target.value)} rows={2} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Category</span>
                <input type="text" value={category} onChange={e => setCategory(e.target.value)} className={fieldClasses} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-white/50">Status</span>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as PlaylistStatus)}
                  className={fieldClasses}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            {/* Message */}
            {message && (
              <p className={`mt-3 text-xs ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {message.text}
              </p>
            )}

            {/* Save button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Settings'}
            </button>

            {/* Delete */}
            <div className="mt-8 border-t border-white/10 pt-4">
              {showDeleteConfirm ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-red-400">
                    This will permanently delete the playlist and all its items and edges.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isPending}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Delete forever
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-400/60 hover:text-red-400"
                >
                  Delete playlist...
                </button>
              )}
            </div>
          </>
        ) : (
          /* Notes tab */
          <div className="flex flex-col gap-3">
            <div className="min-h-[140px]">
              <PipelineEditor
                content={playlist.notes as JSONContent | null}
                isEditing={true}
                onContentChange={handleNotesChange}
                preset="compact"
                placeholder="Anote ideias, decisões e contexto para a próxima discussão..."
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/30">
              <span>{noteWordCount} palavras</span>
              <span>
                {noteSaveState === 'saving' && 'Salvando...'}
                {noteSaveState === 'saved' && 'Auto-salvo ✓'}
                {noteSaveState === 'error' && <span className="text-red-400">Erro ao salvar</span>}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
