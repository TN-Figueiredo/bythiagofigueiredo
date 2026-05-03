'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, MoreVertical, Trash2, ArrowRight, Tag, Globe, Copy } from 'lucide-react'
import type { PostCard, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate, getValidTargets } from '../../_hub/hub-utils'

interface KanbanCardProps {
  card: PostCard
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales?: string[]
  onMoveToStatus?: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onReassignTag?: (postId: string, tagId: string | null) => Promise<void>
  onAddLocale?: (postId: string, locale: string) => Promise<void>
  onDuplicate?: (postId: string) => Promise<void>
}

export function KanbanCard({
  card,
  strings,
  tags,
  supportedLocales,
  onMoveToStatus,
  onDelete,
  onReassignTag,
  onAddLocale,
  onDuplicate,
}: KanbanCardProps) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [localeDropdownOpen, setLocaleDropdownOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [, startTransition] = useTransition()
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const localeDropdownRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const isLoading = navigating

  const handleClick = () => {
    if (contextMenu || tagDropdownOpen || isLoading) return
    setNavigating(true)
    router.push(`/cms/blog/${card.id}/edit`)
  }

  const handleContextMove = useCallback(
    (status: string) => {
      setContextMenu(null)
      if (onMoveToStatus) {
        startTransition(async () => {
          await onMoveToStatus(card.id, status)
        })
      }
    },
    [card.id, onMoveToStatus],
  )

  const handleTagSelect = useCallback(
    (tagId: string | null) => {
      setTagDropdownOpen(false)
      setContextMenu(null)
      if (onReassignTag) {
        startTransition(async () => {
          await onReassignTag(card.id, tagId)
        })
      }
    },
    [card.id, onReassignTag],
  )

  const handleLocaleSelect = useCallback(
    (loc: string) => {
      setLocaleDropdownOpen(false)
      setContextMenu(null)
      if (onAddLocale) {
        startTransition(async () => {
          await onAddLocale(card.id, loc)
        })
      }
    },
    [card.id, onAddLocale],
  )

  const missingLocales = supportedLocales?.filter((l) => !card.locales.includes(l)) ?? []

  const handleDuplicate = useCallback(() => {
    setContextMenu(null)
    if (onDuplicate) {
      startTransition(async () => {
        await onDuplicate(card.id)
      })
    }
  }, [card.id, onDuplicate])

  const handleDelete = useCallback(() => {
    setContextMenu(null)
    if (onDelete) {
      startTransition(async () => {
        await onDelete(card.id)
      })
    }
  }, [card.id, onDelete])

  // Focus first menu item when context menu opens
  useEffect(() => {
    if (!contextMenu) return
    // Use requestAnimationFrame to ensure DOM is rendered
    const raf = requestAnimationFrame(() => {
      const firstBtn = contextMenuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')
      firstBtn?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [contextMenu])

  // Keyboard navigation for context menu
  const handleContextMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const menu = contextMenuRef.current
    if (!menu) return

    const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'))
    if (items.length === 0) return

    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const nextIdx = currentIndex < items.length - 1 ? currentIndex + 1 : 0
        items[nextIdx]?.focus()
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevIdx = currentIndex > 0 ? currentIndex - 1 : items.length - 1
        items[prevIdx]?.focus()
        break
      }
      case 'Home': {
        e.preventDefault()
        items[0]?.focus()
        break
      }
      case 'End': {
        e.preventDefault()
        items[items.length - 1]?.focus()
        break
      }
      case 'Enter':
      case ' ': {
        e.preventDefault()
        if (document.activeElement instanceof HTMLButtonElement && items.includes(document.activeElement)) {
          document.activeElement.click()
        }
        break
      }
    }
  }, [])

  // Close context menu on outside click / Escape / scroll
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    const handleScroll = () => setContextMenu(null)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [contextMenu])

  // Close tag dropdown on outside click
  useEffect(() => {
    if (!tagDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [tagDropdownOpen])

  // Close locale dropdown on outside click
  useEffect(() => {
    if (!localeDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (localeDropdownRef.current && !localeDropdownRef.current.contains(e.target as Node)) {
        setLocaleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [localeDropdownOpen])

  const validTargets = getValidTargets(card.status)
  const canDelete =
    card.status === 'idea' || card.status === 'draft' || card.status === 'archived'

  const s = strings?.editorial

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`${card.displayId} ${card.title || (s?.untitled ?? 'Untitled')}`}
        aria-busy={isLoading}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) { e.preventDefault(); handleClick() }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`group relative rounded-lg border p-3 transition-colors ${
          isDragging
            ? 'border-indigo-500/30 bg-indigo-950/20 opacity-40'
            : isLoading
              ? 'pointer-events-none border-indigo-500/40 bg-indigo-950/10'
              : 'cursor-pointer border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-800/50'
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/60">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          </div>
        )}

        {/* Header row */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums tracking-wide text-gray-400">
            {card.displayId}
          </span>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleClick()
                }}
                aria-label={s?.open ?? 'Open'}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setContextMenu({ x: e.clientX, y: e.clientY })
                }}
                aria-label={s?.moreActions ?? 'More actions'}
                className="rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </div>
            {/* Tag badge */}
            <div className="relative" ref={tagDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setTagDropdownOpen((v) => !v)
                }}
                aria-label={s?.changeTag ?? 'Change tag'}
                aria-expanded={tagDropdownOpen}
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium transition-colors hover:ring-1 hover:ring-gray-600"
                style={
                  card.tagColor
                    ? {
                        backgroundColor: `${card.tagColor}20`,
                        color: card.tagColor,
                      }
                    : { backgroundColor: '#374151', color: '#9ca3af' }
                }
              >
                {card.tagColor && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: card.tagColor }}
                  />
                )}
                {card.tagName ?? (s?.noTag ?? 'No tag')}
              </button>
              {tagDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
                  <button
                    onClick={() => handleTagSelect(null)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-gray-800 ${
                      !card.tagId ? 'text-indigo-400' : 'text-gray-400'
                    }`}
                  >
                    {s?.noTag ?? 'No tag'}
                  </button>
                  {tags?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTagSelect(t.id)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-gray-800 ${
                        card.tagId === t.id ? 'text-indigo-400' : 'text-gray-300'
                      }`}
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Title */}
        <p
          className={`text-[11px] font-medium leading-snug ${
            card.title ? 'text-gray-200' : 'italic text-gray-600'
          }`}
        >
          {card.title || (s?.untitled ?? 'Untitled')}
        </p>

        {/* Sub-state badges */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {card.status === 'pending_review' && (
            <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-orange-400">
              {s?.review ?? 'Review'}
            </span>
          )}
          {card.status === 'queued' && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-semibold text-amber-400">
              {s?.queued ?? 'Queued'}
            </span>
          )}
        </div>

        {/* Footer row */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-gray-600">
          {/* Locale badges */}
          <div className="flex items-center gap-1">
            {card.locales.map((loc) => (
              <span
                key={loc}
                className="rounded bg-gray-800 px-1 py-0.5 text-[8px] uppercase font-medium text-gray-500"
              >
                {loc}
              </span>
            ))}
          </div>
          {card.readingTimeMin != null && (
            <span className="tabular-nums">{card.readingTimeMin} min</span>
          )}
          <time className="ml-auto">{formatRelativeDate(card.updatedAt)}</time>
          {card.slotDate && (
            <span className="rounded bg-purple-500/10 px-1 py-0.5 text-[8px] text-purple-400">
              {new Date(card.slotDate + 'T00:00:00').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          role="menu"
          onKeyDown={handleContextMenuKeyDown}
          className="fixed z-[100] min-w-[160px] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              handleClick()
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Pencil className="h-3 w-3" />
            {s?.open ?? 'Open'}
          </button>

          {validTargets.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-800" />
              <p className="px-3 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-600">
                {s?.moveTo ?? 'Move to'}
              </p>
              {validTargets.map((status) => (
                <button
                  key={status}
                  role="menuitem"
                  onClick={() => handleContextMove(status)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
                >
                  <ArrowRight className="h-3 w-3" />
                  {strings?.editorial[status as keyof typeof strings.editorial] ?? status}
                </button>
              ))}
            </>
          )}

          <div className="my-1 border-t border-gray-800" />

          <button
            role="menuitem"
            onClick={() => {
              setContextMenu(null)
              setTagDropdownOpen(true)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Tag className="h-3 w-3" />
            {s?.changeTag ?? 'Change tag'}
          </button>

          <div className="relative" ref={localeDropdownRef}>
            <button
              role="menuitem"
              onClick={() => setLocaleDropdownOpen((v) => !v)}
              disabled={missingLocales.length === 0}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-gray-800 ${
                missingLocales.length === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-300'
              }`}
            >
              <Globe className="h-3 w-3" />
              {s?.addLocale ?? 'Add locale'}
            </button>
            {localeDropdownOpen && missingLocales.length > 0 && (
              <div className="absolute left-full top-0 z-50 ml-1 w-28 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
                {missingLocales.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => handleLocaleSelect(loc)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-gray-300 hover:bg-gray-800"
                  >
                    <span className="uppercase font-medium">{loc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            role="menuitem"
            onClick={handleDuplicate}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            {s?.duplicate ?? 'Duplicate'}
          </button>

          {canDelete && onDelete && (
            <>
              <div className="my-1 border-t border-gray-800" />
              <button
                role="menuitem"
                onClick={handleDelete}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-950/30"
              >
                <Trash2 className="h-3 w-3" />
                {s?.delete ?? 'Delete'}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}

export function KanbanCardOverlay({ card }: { card: PostCard }) {
  return (
    <div className="w-[220px] rotate-2 rounded-lg border border-indigo-500/50 bg-gray-900 p-3 shadow-2xl shadow-indigo-500/10">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums tracking-wide text-gray-400">
          {card.displayId}
        </span>
        {card.tagName && (
          <span
            className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
            style={
              card.tagColor
                ? { backgroundColor: `${card.tagColor}20`, color: card.tagColor }
                : { backgroundColor: '#374151', color: '#9ca3af' }
            }
          >
            {card.tagColor && (
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: card.tagColor }} />
            )}
            {card.tagName}
          </span>
        )}
      </div>
      <p className={`text-[11px] font-medium leading-snug ${card.title ? 'text-gray-200' : 'italic text-gray-600'}`}>
        {card.title || 'Untitled'}
      </p>
      <div className="mt-2 flex gap-1.5 text-[9px] text-gray-600">
        {card.locales.map((loc) => (
          <span key={loc} className="rounded bg-gray-800 px-1 py-0.5 text-[8px] uppercase font-medium text-gray-500">
            {loc}
          </span>
        ))}
        <time className="ml-auto">{formatRelativeDate(card.updatedAt)}</time>
      </div>
    </div>
  )
}
