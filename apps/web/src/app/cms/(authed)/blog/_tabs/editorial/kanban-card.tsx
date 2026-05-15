'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, MoreVertical, Trash2, ArrowRight, Tag, Globe, Copy, Sparkles, Minus, Plus } from 'lucide-react'
import type { PostCard, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate, getKanbanMoveTargets } from '../../_hub/hub-utils'
import { formatTagNameCms } from '../../_hub/tag-locale'

function isOptimisticCard(card: PostCard): boolean {
  return card.id.startsWith('optimistic-')
}

const LOCALE_COLORS: Record<string, string> = {
  'pt-BR': 'bg-emerald-900/60 text-emerald-400',
  'en': 'bg-sky-900/60 text-sky-400',
  'pt': 'bg-amber-900/60 text-amber-400',
}
const DEFAULT_LOCALE_COLOR = 'bg-gray-800 text-gray-500'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
}

const LOCALE_LABELS: Record<string, string> = {
  'pt-BR': 'PT-BR',
  en: 'EN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
}

function localeColorClass(locale: string): string {
  return LOCALE_COLORS[locale] ?? DEFAULT_LOCALE_COLOR
}

const WORD_COUNT_TARGET = 2000

function estimateWordCount(readingTimeMin: number | null): number {
  return (readingTimeMin ?? 0) * 200
}

function progressPercent(readingTimeMin: number | null): number {
  const words = estimateWordCount(readingTimeMin)
  return Math.min(100, Math.round((words / WORD_COUNT_TARGET) * 100))
}

function progressColorClass(pct: number): string {
  if (pct >= 100) return 'bg-gradient-to-r from-green-500 to-cyan-500 shadow-[0_0_4px_rgba(34,197,94,0.3)]'
  if (pct >= 75) return 'bg-green-500 shadow-[0_0_3px_rgba(34,197,94,0.3)]'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

function tagColorFamily(hex: string | null): string | null {
  if (!hex) return null
  const h = hex.toLowerCase().replace('#', '')
  const RED = ['ef4444', 'f87171', 'dc2626']
  const BLUE = ['3b82f6', '60a5fa', '2563eb']
  const GREEN = ['22c55e', '4ade80', '16a34a']
  const PURPLE = ['a855f7', '8b5cf6', '7c3aed']
  if (RED.includes(h)) return 'red'
  if (BLUE.includes(h)) return 'blue'
  if (GREEN.includes(h)) return 'green'
  if (PURPLE.includes(h)) return 'purple'
  return null
}

function statusBadge(status: PostCard['status']): { label: string; className: string } | null {
  switch (status) {
    case 'ready':
    case 'queued':
      return { label: 'Approved', className: 'bg-gray-400/10 text-gray-400' }
    case 'published':
      return { label: 'Published', className: 'bg-emerald-400/10 text-emerald-400' }
    default:
      return null
  }
}

const GLOW_COLORS: Record<string, { border: string; shadow: string }> = {
  red: { border: 'rgba(239,68,68,0.35)', shadow: '0 6px 20px rgba(239,68,68,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
  blue: { border: 'rgba(59,130,246,0.35)', shadow: '0 6px 20px rgba(59,130,246,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
  green: { border: 'rgba(34,197,94,0.35)', shadow: '0 6px 20px rgba(34,197,94,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
  purple: { border: 'rgba(168,85,247,0.35)', shadow: '0 6px 20px rgba(168,85,247,0.06), 0 2px 6px rgba(0,0,0,0.3)' },
}

const CONTEXT_MENU_WIDTH = 170

function safeMenuPosition(clientX: number, clientY: number): { x: number; y: number } {
  const x = clientX + CONTEXT_MENU_WIDTH > window.innerWidth ? clientX - CONTEXT_MENU_WIDTH : clientX
  const y = clientY + 300 > window.innerHeight ? Math.max(8, clientY - 200) : clientY
  return { x, y }
}

interface KanbanCardProps {
  card: PostCard
  confirmed?: boolean
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales?: string[]
  onMoveToStatus?: (postId: string, newStatus: string, scheduledFor?: string) => Promise<void>
  onDelete?: (postId: string) => Promise<void>
  onReassignTag?: (postId: string, tagId: string | null) => Promise<void>
  onAddLocale?: (postId: string, locale: string) => Promise<void>
  onRemoveLocale?: (postId: string, locale: string) => Promise<void>
  onDuplicate?: (postId: string) => Promise<void>
  onCreateAndAssignTag?: (postId: string, tagName: string) => Promise<void>
  defaultLocale?: string
}

export function KanbanCard({
  card,
  confirmed: confirmedProp,
  strings,
  tags,
  supportedLocales,
  onMoveToStatus,
  onDelete,
  onReassignTag,
  onAddLocale,
  onRemoveLocale,
  onDuplicate,
  onCreateAndAssignTag,
  defaultLocale,
}: KanbanCardProps) {
  const router = useRouter()
  const isOptimistic = isOptimisticCard(card)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: isOptimistic,
  })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [creatingTag, setCreatingTag] = useState(false)
  const [localeDropdownOpen, setLocaleDropdownOpen] = useState(false)
  const [removeLocaleDropdownOpen, setRemoveLocaleDropdownOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [, startTransition] = useTransition()
  const cardRef = useRef<HTMLDivElement>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)
  const tagDropdownRef = useRef<HTMLDivElement>(null)
  const localeDropdownRef = useRef<HTMLDivElement>(null)
  const removeLocaleDropdownRef = useRef<HTMLDivElement>(null)

  const confirmed = confirmedProp ?? false

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const isLoading = navigating

  const handleClick = () => {
    if (contextMenu || tagDropdownOpen || isLoading || isOptimistic) return
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

  const handleCreateAndAssignTag = useCallback(async () => {
    const name = newTagName.trim()
    if (!name || !onCreateAndAssignTag || creatingTag) return
    setCreatingTag(true)
    await onCreateAndAssignTag(card.id, name)
    setCreatingTag(false)
    setNewTagName('')
    setTagDropdownOpen(false)
    setContextMenu(null)
  }, [card.id, newTagName, onCreateAndAssignTag, creatingTag])

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

  const handleRemoveLocaleSelect = useCallback(
    (loc: string) => {
      setRemoveLocaleDropdownOpen(false)
      setContextMenu(null)
      if (onRemoveLocale) {
        startTransition(async () => {
          await onRemoveLocale(card.id, loc)
        })
      }
    },
    [card.id, onRemoveLocale],
  )

  const missingLocales = supportedLocales?.filter((l) => !card.locales.includes(l)) ?? []
  const canRemoveLocale = card.locales.length > 1

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

  // Close remove-locale dropdown on outside click
  useEffect(() => {
    if (!removeLocaleDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (removeLocaleDropdownRef.current && !removeLocaleDropdownRef.current.contains(e.target as Node)) {
        setRemoveLocaleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [removeLocaleDropdownOpen])

  const validTargets = getKanbanMoveTargets(card.status)
  const canDelete =
    card.status === 'idea' || card.status === 'draft' || card.status === 'ready' || card.status === 'archived'

  const s = strings?.editorial

  const glowFamily = tagColorFamily(card.tagColor)
  const wordCount = estimateWordCount(card.readingTimeMin)
  const pct = progressPercent(card.readingTimeMin)
  const badge = statusBadge(card.status)

  const handleMouseEnter = useCallback(() => {
    if (isDragging || isLoading || isOptimistic || !glowFamily) return
    const el = cardRef.current
    const glow = GLOW_COLORS[glowFamily]
    if (!el || !glow) return
    el.style.borderColor = glow.border
    el.style.boxShadow = glow.shadow
  }, [isDragging, isLoading, isOptimistic, glowFamily])

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current
    if (!el) return
    el.style.borderColor = ''
    el.style.boxShadow = ''
  }, [])

  return (
    <>
      <div
        ref={(node) => { setNodeRef(node); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node }}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`${card.displayId} ${card.title || (s?.untitled ?? 'Untitled')}`}
        aria-busy={isLoading}
        data-tc={glowFamily}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isLoading) { e.preventDefault(); handleClick() }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isOptimistic) setContextMenu(safeMenuPosition(e.clientX, e.clientY))
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`group relative rounded-lg border transition-all duration-300 ${
          isOptimistic
            ? 'animate-fade-in border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
            : confirmed
              ? 'border-emerald-500/60 bg-emerald-950/10 ring-1 ring-emerald-500/20'
              : isDragging
                ? 'border-indigo-500/30 bg-indigo-950/20 opacity-40'
                : isLoading
                  ? 'pointer-events-none border-indigo-500/40 bg-indigo-950/10'
                  : 'cursor-pointer border-gray-800 bg-[#131B2E] hover:border-gray-700'
        }`}
      >
        {/* 3-tier cover system */}
        {card.coverImageUrl ? (
          <div className="relative h-[44px] w-full overflow-hidden rounded-t-lg">
            <img
              src={card.coverImageUrl}
              alt=""
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#131B2E]/80" />
          </div>
        ) : card.tagColor ? (
          <div
            data-testid="card-gradient"
            className="h-[24px] w-full rounded-t-lg"
            style={{ background: `linear-gradient(135deg, ${card.tagColor}30, ${card.tagColor}08)` }}
          />
        ) : (
          <div data-testid="card-strip" className="h-[3px] w-full rounded-t-lg bg-gray-700/50" />
        )}

        {/* Action buttons — pinned top-right of card, overlapping cover */}
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-px rounded-md bg-gray-900/70 p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleClick()
            }}
            aria-label={s?.open ?? 'Open'}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setContextMenu(safeMenuPosition(e.clientX, e.clientY))
            }}
            aria-label={s?.moreActions ?? 'More actions'}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-100"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Card body */}
        <div className="relative p-3">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-b-lg bg-[#131B2E]/60">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            </div>
          )}

          {/* Drag grip dots — visible on hover */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 grid grid-cols-2 gap-[2px] opacity-0 transition-opacity group-hover:opacity-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="block h-[3px] w-[3px] rounded-full bg-gray-500" />
            ))}
          </div>

          {/* Header row: displayId + status badge + tag badge */}
          <div className="mb-1.5 flex items-center gap-1">
            {isOptimistic ? (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded bg-indigo-500/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-indigo-400">
                <Sparkles className="h-2.5 w-2.5" />
                NEW
              </span>
            ) : (
              <span className="shrink-0 whitespace-nowrap rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums tracking-wide text-gray-400">
                {card.displayId}
              </span>
            )}
            {badge && (
              <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            )}
            {/* Sub-state badges */}
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
            {/* Tag badge — pushed right */}
            <div className="ml-auto relative" ref={tagDropdownRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setTagDropdownOpen((v) => !v)
                }}
                aria-label={s?.changeTag ?? 'Change tag'}
                aria-expanded={tagDropdownOpen}
                className="flex max-w-[110px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium transition-colors hover:ring-1 hover:ring-gray-600"
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
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: card.tagColor }}
                  />
                )}
                <span className="truncate">
                  {card.tagName ? formatTagNameCms({ name: card.tagName, nameTranslations: card.tagNameTranslations }) : (s?.noTag ?? 'No tag')}
                </span>
              </button>
              {tagDropdownOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
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
                      {formatTagNameCms({ name: t.name, nameTranslations: t.nameTranslations })}
                    </button>
                  ))}
                  {onCreateAndAssignTag && (
                    <>
                      <div className="my-1 h-px bg-gray-800" />
                      <div className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); handleCreateAndAssignTag() }
                              e.stopPropagation()
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder={defaultLocale ? `${LOCALE_FLAGS[defaultLocale] ?? ''} ${LOCALE_LABELS[defaultLocale] ?? defaultLocale} name...` : 'New tag...'}
                            disabled={creatingTag}
                            className="flex-1 min-w-0 bg-gray-950 border border-gray-700 rounded px-1.5 py-1 text-[10px] text-gray-300 placeholder-gray-600 outline-none focus:border-indigo-500 disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleCreateAndAssignTag() }}
                            disabled={!newTagName.trim() || creatingTag}
                            className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-[8px] text-gray-600 mt-0.5 px-0.5">{strings?.editorial.addTranslationsLater ?? 'Add translations in tag settings'}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <p
            className={`text-[13px] font-semibold leading-snug line-clamp-2 ${
              card.title ? 'text-gray-200' : 'italic text-gray-600'
            }`}
          >
            {card.title || (s?.untitled ?? 'Untitled')}
          </p>

          {/* Snippet */}
          {card.snippet && (
            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 line-clamp-2">
              {card.snippet}
            </p>
          )}

          {/* Word count progress bar */}
          {card.readingTimeMin != null && card.readingTimeMin > 0 && (
            <div className="mt-2">
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-[3px] w-full rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all ${progressColorClass(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="mt-0.5 block text-[8px] tabular-nums text-gray-600">
                {wordCount}/{WORD_COUNT_TARGET}w
              </span>
            </div>
          )}

          {/* Footer row */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-gray-600">
            {/* Locale badges */}
            <div className="flex items-center gap-1">
              {card.locales.map((loc) => (
                <span
                  key={loc}
                  className={`rounded px-1 py-0.5 text-[8px] uppercase font-medium ${localeColorClass(loc)}`}
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
              {validTargets.map((status) => {
                const actionKey = `moveTo${status.charAt(0).toUpperCase()}${status.slice(1)}`
                const actionLabel = (strings?.editorial as Record<string, string> | undefined)?.[actionKey] ?? status
                return (
                  <button
                    key={status}
                    role="menuitem"
                    onClick={() => handleContextMove(status)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-gray-800 ${status === 'published' ? 'font-medium text-emerald-400' : 'text-gray-300'}`}
                  >
                    <ArrowRight className="h-3 w-3" />
                    {actionLabel as string}
                  </button>
                )
              })}
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
              <div className="absolute right-full top-0 z-50 mr-1 w-28 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
                {missingLocales.map((loc) => (
                  <button
                    key={loc}
                    role="menuitem"
                    onClick={() => handleLocaleSelect(loc)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-gray-300 hover:bg-gray-800"
                  >
                    <span className="uppercase font-medium">{loc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {canRemoveLocale && (
            <div className="relative" ref={removeLocaleDropdownRef}>
              <button
                role="menuitem"
                onClick={() => setRemoveLocaleDropdownOpen((v) => !v)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
              >
                <Minus className="h-3 w-3" />
                {s?.removeLocale ?? 'Remove locale'}
              </button>
              {removeLocaleDropdownOpen && (
                <div className="absolute right-full top-0 z-50 mr-1 w-28 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
                  {card.locales.map((loc) => (
                    <button
                      key={loc}
                      role="menuitem"
                      onClick={() => handleRemoveLocaleSelect(loc)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] text-red-400 hover:bg-gray-800"
                    >
                      <span className="uppercase font-medium">{loc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
  const badge = statusBadge(card.status)
  return (
    <div className="w-[280px] rotate-2 overflow-hidden rounded-lg border border-indigo-500/50 bg-[#131B2E] shadow-2xl shadow-indigo-500/10">
      {/* Cover tier (simplified) */}
      {card.coverImageUrl ? (
        <div className="relative h-[32px] w-full overflow-hidden">
          <img src={card.coverImageUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#131B2E]/80" />
        </div>
      ) : card.tagColor ? (
        <div className="h-[16px] w-full" style={{ background: `linear-gradient(135deg, ${card.tagColor}30, ${card.tagColor}08)` }} />
      ) : (
        <div className="h-[3px] w-full bg-gray-700/50" />
      )}
      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-1">
          <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums text-gray-400">
            {card.displayId}
          </span>
          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {card.tagName && (
            <span
              className="ml-auto flex max-w-[110px] items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium"
              style={card.tagColor ? { backgroundColor: `${card.tagColor}20`, color: card.tagColor } : { backgroundColor: '#374151', color: '#9ca3af' }}
            >
              {card.tagColor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: card.tagColor }} />}
              <span className="truncate">{formatTagNameCms({ name: card.tagName, nameTranslations: card.tagNameTranslations })}</span>
            </span>
          )}
        </div>
        <p className={`text-[13px] font-semibold leading-snug line-clamp-2 ${card.title ? 'text-gray-200' : 'italic text-gray-600'}`}>
          {card.title || 'Untitled'}
        </p>
        <div className="mt-2 flex gap-1.5 text-[9px] text-gray-600">
          {card.locales.map((loc) => (
            <span key={loc} className={`rounded px-1 py-0.5 text-[8px] uppercase font-medium ${localeColorClass(loc)}`}>
              {loc}
            </span>
          ))}
          <time className="ml-auto">{formatRelativeDate(card.updatedAt)}</time>
        </div>
      </div>
    </div>
  )
}
