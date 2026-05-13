'use client'

import { useState, useTransition } from 'react'
import type { PlaylistRow, PlaylistStatus, ActionResult } from '@/lib/playlists/types'

interface PlaylistSettingsProps {
  playlist: PlaylistRow
  itemCount: number
  edgeCount: number
  isOpen: boolean
  onClose: () => void
  onUpdate: (playlistId: string, siteId: string, input: unknown) => Promise<ActionResult<PlaylistRow>>
  onDelete: (playlistId: string, siteId: string) => Promise<ActionResult<void>>
}

export function PlaylistSettings({
  playlist,
  itemCount,
  edgeCount,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: PlaylistSettingsProps) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(playlist.name)
  const [slug, setSlug] = useState(playlist.slug)
  const [description, setDescription] = useState(playlist.description ?? '')
  const [category, setCategory] = useState(playlist.category ?? '')
  const [status, setStatus] = useState<PlaylistStatus>(playlist.status)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  if (!isOpen) return null

  function handleSave() {
    startTransition(async () => {
      const result = await onUpdate(playlist.id, playlist.site_id, {
        name,
        slug,
        description: description || null,
        category: category || null,
        status,
      })
      if (result.ok) {
        setMessage({ type: 'success', text: 'Settings saved' })
        setTimeout(() => setMessage(null), 2000)
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await onDelete(playlist.id, playlist.site_id)
      if (result.ok) {
        window.location.href = '/cms/playlists'
      } else {
        setMessage({ type: 'error', text: result.error })
      }
    })
  }

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

      <div className="flex-1 overflow-y-auto p-4">
        {/* Stats */}
        <div className="mb-4 flex gap-4 rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40">
          <span>{itemCount} items</span>
          <span>{edgeCount} edges</span>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-white/50">Name</span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
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
            <span className="text-xs font-medium text-white/50">Description</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-white/50">Category</span>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-white/50">Status</span>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as PlaylistStatus)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
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
      </div>
    </div>
  )
}
