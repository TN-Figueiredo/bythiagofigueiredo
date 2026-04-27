'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { TypeModal } from './type-modal'
import { createNewsletterType, updateNewsletterType, deleteNewsletterType } from '../actions'

interface TypeCardData {
  id: string
  name: string
  color: string
  subscribers: number
  avgOpenRate: number
  lastSent: string | null
  cadence: string
  editionCount: number
  isPaused: boolean
}

interface TypeCardsProps {
  types: TypeCardData[]
  selectedTypeId?: string | null
  currentStatus?: string
}

export function TypeCards({ types, selectedTypeId, currentStatus }: TypeCardsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [editingType, setEditingType] = useState<TypeCardData | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  function handleTypeClick(typeId: string) {
    const sp = new URLSearchParams(searchParams.toString())
    if (selectedTypeId === typeId) {
      sp.delete('type')
    } else {
      sp.set('type', typeId)
    }
    sp.delete('page')
    router.push(`/cms/newsletters?${sp.toString()}`)
  }

  async function handleCreate(data: { name: string; tagline: string; color: string; locale: string }) {
    const result = await createNewsletterType(data)
    if (result.ok) {
      toast.success(`"${data.name}" created`)
      setShowTypeModal(false)
      router.refresh()
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  async function handleUpdate(data: { name: string; tagline: string; color: string; locale: string }) {
    if (!editingType) return
    const result = await updateNewsletterType(editingType.id, data)
    if (result.ok) {
      toast.success('Type updated')
      setEditingType(null)
      router.refresh()
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  async function handleTogglePause(type: TypeCardData) {
    const result = await updateNewsletterType(type.id, { cadence_paused: !type.isPaused })
    if (result.ok) {
      toast.success(type.isPaused ? 'Resumed' : 'Paused')
      router.refresh()
    } else {
      toast.error(`Failed: ${result.error}`)
    }
  }

  async function handleDelete(type: TypeCardData) {
    const result = await deleteNewsletterType(type.id, { confirmed: true, confirmText: type.name })
    if (result.ok) {
      toast.success(`"${type.name}" deleted`)
      router.refresh()
    } else {
      toast.error(`Failed: ${'error' in result ? result.error : 'unknown'}`)
    }
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never'
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="type-cards">
      {types.map((type) => (
        <div
          key={type.id}
          className={`relative rounded-[var(--cms-radius)] border p-4 hover:shadow-md transition-all cursor-pointer ${
            selectedTypeId === type.id
              ? 'border-cms-accent ring-1 ring-cms-accent bg-cms-accent/5'
              : 'border-cms-border bg-cms-surface hover:border-cms-accent/50'
          }`}
          onClick={() => handleTypeClick(type.id)}
          onContextMenu={(e) => { e.preventDefault(); setContextMenuId(type.id) }}
          data-testid={`type-card-${type.id}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: type.color }} />
              <h3 className="font-medium text-sm text-cms-text truncate">{type.name}</h3>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === type.id ? null : type.id) }}
              className="text-cms-text-muted hover:text-cms-text text-lg leading-none shrink-0"
              aria-label={`Actions for ${type.name}`}
            >
              &#x22EF;
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-cms-text-dim">
            <span>{type.subscribers} subs</span>
            <span>{type.editionCount} editions</span>
            {type.isPaused && <span className="text-[var(--cms-amber,#f59e0b)] font-medium">Paused</span>}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-cms-text-dim">
            <span>Last: {formatDate(type.lastSent)}</span>
            <span>{type.cadence}</span>
          </div>

          {contextMenuId === type.id && (
            <div
              className="absolute right-2 top-10 z-20 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface py-1 shadow-lg w-36"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => { setEditingType(type); setContextMenuId(null) }}
                className="w-full text-left px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => { handleTogglePause(type); setContextMenuId(null) }}
                className="w-full text-left px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover"
              >
                {type.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                type="button"
                onClick={() => { handleDelete(type); setContextMenuId(null) }}
                className="w-full text-left px-3 py-1.5 text-sm text-[var(--cms-red,#ef4444)] hover:bg-[var(--cms-red,#ef4444)]/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => setShowTypeModal(true)}
        className="rounded-[var(--cms-radius)] border-2 border-dashed border-cms-border p-4 flex items-center justify-center hover:border-cms-accent hover:bg-cms-accent/5 transition-colors min-h-[100px]"
        data-testid="add-type-btn"
      >
        <span className="text-sm font-medium text-cms-text-muted">+ Add type</span>
      </button>

      <TypeModal
        open={showTypeModal}
        mode="create"
        onSubmit={handleCreate}
        onCancel={() => setShowTypeModal(false)}
      />

      {editingType && (
        <TypeModal
          open={!!editingType}
          mode="edit"
          initial={{
            name: editingType.name,
            tagline: '',
            color: editingType.color,
            locale: 'pt-BR',
          }}
          onSubmit={handleUpdate}
          onCancel={() => setEditingType(null)}
        />
      )}
    </div>
  )
}
