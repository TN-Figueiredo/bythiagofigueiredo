'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { BlogTag } from '../_hub/hub-types'

interface TagFilterChipsProps {
  tags: BlogTag[]
  selectedTagId: string | null
  onSelect: (tagId: string | null) => void
  onAdd: () => void
  onEdit: (tagId: string) => void
  allLabel: string
  editLabel?: string
}

export function TagFilterChips({ tags, selectedTagId, onSelect, onAdd, onEdit, allLabel, editLabel = 'Edit' }: TagFilterChipsProps) {
  const [contextId, setContextId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(() => setContextId(null), [])

  useEffect(() => {
    if (!contextId) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) closeMenu()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [contextId, closeMenu])

  useEffect(() => {
    if (!contextId || !menuRef.current) return
    const btn = menuRef.current.querySelector<HTMLElement>('button')
    btn?.focus()
  }, [contextId])

  function handleChipKeyDown(e: React.KeyboardEvent, tagId: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(tagId)
    } else if (e.shiftKey && e.key === 'F10') {
      e.preventDefault()
      setContextId(contextId === tagId ? null : tagId)
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    }
  }

  return (
    <div ref={containerRef} className="flex flex-wrap gap-2 items-center" role="radiogroup" aria-label="Filter by tag">
      <button
        role="radio"
        aria-checked={selectedTagId === null}
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          selectedTagId === null
            ? 'bg-gray-100 text-gray-900'
            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        {allLabel}
      </button>
      {tags.map((t) => (
        <div key={t.id} className="relative group">
          <button
            role="radio"
            aria-checked={selectedTagId === t.id}
            onClick={() => onSelect(t.id)}
            onKeyDown={(e) => handleChipKeyDown(e, t.id)}
            onContextMenu={(e) => { e.preventDefault(); setContextId(contextId === t.id ? null : t.id) }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedTagId === t.id
                ? 'text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            style={selectedTagId === t.id ? { backgroundColor: t.color } : undefined}
          >
            {t.name}
            {t.postCount > 0 && (
              <span className="ml-1 opacity-60">{t.postCount}</span>
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(t.id) }}
            className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-gray-700 text-[8px] text-gray-300 hover:bg-gray-600 group-hover:flex"
            aria-label={`${editLabel} ${t.name}`}
            data-testid={`edit-chip-${t.id}`}
          >
            &#x270E;
          </button>
          {contextId === t.id && (
            <div
              ref={menuRef}
              role="menu"
              onKeyDown={handleMenuKeyDown}
              className="absolute left-0 top-full mt-1 z-30 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-lg w-28"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => { onEdit(t.id); closeMenu() }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
              >
                {editLabel}
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="rounded-full border border-dashed border-gray-700 px-2.5 py-1 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Add tag"
        data-testid="add-tag-chip"
      >
        +
      </button>
    </div>
  )
}
