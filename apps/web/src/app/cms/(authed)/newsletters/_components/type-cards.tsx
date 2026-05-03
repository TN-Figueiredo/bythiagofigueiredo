'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { TypeDrawer } from './type-drawer'
import { updateNewsletterType, deleteNewsletterType } from '../actions'
import type { NewsletterHubStrings } from '../_i18n/types'

interface TypeCardData {
  id: string
  name: string
  color: string
  tagline: string
  locale: string
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
  locale: 'en' | 'pt-BR'
  drawerStrings: NewsletterHubStrings['typeDrawer']
}

export function TypeCards({ types, selectedTypeId, currentStatus, locale, drawerStrings }: TypeCardsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenuId) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setContextMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenuId])

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
    const probe = await deleteNewsletterType(type.id)
    if (probe.ok) {
      toast.success(`"${type.name}" deleted`)
      router.refresh()
      return
    }
    if (!('subscriberCount' in probe)) {
      toast.error(`Failed: ${probe.error}`)
      return
    }

    const hasDeps = (probe.subscriberCount ?? 0) > 0 || (probe.editionCount ?? 0) > 0
    const msg = hasDeps
      ? `Delete "${type.name}"? This has ${probe.subscriberCount} subscribers and ${probe.editionCount} editions. Type the name to confirm:`
      : `Delete "${type.name}"? This action cannot be undone.`

    const input = hasDeps ? window.prompt(msg) : (window.confirm(msg) ? type.name : null)
    if (input === null) return
    if (hasDeps && input !== type.name) {
      toast.error('Name does not match')
      return
    }

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
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="type-cards">
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
                onClick={() => { setDrawerMode('edit'); setEditingTypeId(type.id); setDrawerOpen(true); setContextMenuId(null) }}
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
        onClick={() => { setDrawerMode('create'); setEditingTypeId(null); setDrawerOpen(true) }}
        className="rounded-[var(--cms-radius)] border-2 border-dashed border-cms-border p-4 flex items-center justify-center hover:border-cms-accent hover:bg-cms-accent/5 transition-colors min-h-[100px]"
        data-testid="add-type-btn"
      >
        <span className="text-sm font-medium text-cms-text-muted">+ Add type</span>
      </button>

      <TypeDrawer
        open={drawerOpen}
        mode={drawerMode}
        typeId={editingTypeId}
        onClose={() => setDrawerOpen(false)}
        locale={locale}
        strings={drawerStrings}
      />
    </div>
  )
}
