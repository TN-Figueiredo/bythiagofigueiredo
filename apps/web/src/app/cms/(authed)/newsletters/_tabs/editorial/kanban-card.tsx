'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, MoreVertical, Trash2, ArrowRight, Sparkles } from 'lucide-react'
import type { EditionCard, NewsletterType } from '../../_hub/hub-types'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { formatRelativeDate } from '../../_hub/hub-utils'

const STATUS_TRANSITIONS: Record<string, string[]> = {
  idea: ['draft'],
  draft: ['idea', 'ready'],
  ready: ['draft', 'scheduled'],
  scheduled: ['draft', 'ready'],
  sent: [],
  failed: ['draft'],
  cancelled: ['draft'],
}

const STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  draft: 'Draft',
  ready: 'Ready',
  scheduled: 'Scheduled',
  sent: 'Sent',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

function isOptimisticCard(card: EditionCard): boolean {
  return card.id.startsWith('optimistic-')
}

interface KanbanCardProps {
  card: EditionCard
  confirmed?: boolean
  strings?: NewsletterHubStrings
  types?: NewsletterType[]
  onReassignType?: (editionId: string, typeId: string | null) => void
  onMoveToStatus?: (editionId: string, newStatus: string) => void | Promise<void>
  onDeleteEdition?: (editionId: string) => void
}

export function KanbanCard({ card, confirmed: confirmedProp, strings, types, onReassignType, onMoveToStatus, onDeleteEdition }: KanbanCardProps) {
  const router = useRouter()
  const isOptimistic = isOptimisticCard(card)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: isOptimistic })
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [reassigning, startReassign] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const confirmed = confirmedProp ?? false
  const isLoading = navigating || reassigning

  const handleClick = () => {
    if (dropdownOpen || isLoading || isOptimistic) return
    setNavigating(true)
    router.push(`/cms/newsletters/${card.id}/edit`)
  }

  const handleTypeBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (reassigning) return
    setDropdownOpen((prev) => !prev)
  }, [reassigning])

  const handleTypeSelect = useCallback((typeId: string | null) => {
    setDropdownOpen(false)
    if (typeId === card.typeId) return
    startReassign(() => {
      onReassignType?.(card.id, typeId)
    })
  }, [card.id, card.typeId, onReassignType])

  const handleContextMove = useCallback((status: string) => {
    setContextMenu(null)
    onMoveToStatus?.(card.id, status)
  }, [card.id, onMoveToStatus])

  // Close type dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Close context menu on outside click, Escape, or scroll
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

  const allowedTransitions = STATUS_TRANSITIONS[card.status] ?? []
  const canDelete = card.status === 'idea' || card.status === 'draft'

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        aria-label={`${card.displayId} ${card.subject || (strings?.editorial.untitled ?? 'Untitled')}`}
        aria-busy={isLoading}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) handleClick() }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (!isOptimistic) setContextMenu({ x: e.clientX, y: e.clientY })
        }}
        className={`group relative rounded-lg border p-3 transition-all duration-300 ${
          isOptimistic
            ? 'animate-fade-in border-indigo-500/60 bg-indigo-950/20 ring-1 ring-indigo-500/20'
            : confirmed
              ? 'border-emerald-500/60 bg-emerald-950/10 ring-1 ring-emerald-500/20'
              : isDragging
                ? 'border-indigo-500/30 bg-indigo-950/20 opacity-40'
                : isLoading
                  ? 'border-indigo-500/40 bg-indigo-950/10 pointer-events-none'
                  : 'cursor-pointer border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-800/50'
        }`}
      >
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/60">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
          </div>
        )}

        <div className="mb-1.5 flex items-center justify-between">
          {isOptimistic ? (
            <span className="flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-indigo-400">
              <Sparkles className="h-2.5 w-2.5" />
              NEW
            </span>
          ) : (
            <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums tracking-wide text-gray-400">
              {card.displayId}
            </span>
          )}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={(e) => { e.stopPropagation(); handleClick() }}
                aria-label="Edit"
                className="rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
                aria-label="More actions"
                className="rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              >
                <MoreVertical className="h-3 w-3" />
              </button>
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleTypeBadgeClick}
                aria-label={strings?.editorial.changeType ?? 'Change type'}
                aria-expanded={dropdownOpen}
                className="flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-medium transition-colors hover:ring-1 hover:ring-gray-600"
                style={card.typeColor
                  ? { backgroundColor: `${card.typeColor}20`, color: card.typeColor }
                  : { backgroundColor: '#374151', color: '#9ca3af' }
                }
              >
                {card.typeColor && (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: card.typeColor }} />
                )}
                {card.typeName ?? (strings?.editorial.noType ?? 'No type')}
              </button>
              {dropdownOpen && types && (
                <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-md border border-gray-700 bg-gray-900 py-1 shadow-xl">
                  <button
                    onClick={() => handleTypeSelect(null)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-gray-800 ${
                      !card.typeId ? 'text-indigo-400' : 'text-gray-400'
                    }`}
                  >
                    {strings?.editorial.noType ?? 'No type'}
                  </button>
                  {types.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleTypeSelect(t.id)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] hover:bg-gray-800 ${
                        card.typeId === t.id ? 'text-indigo-400' : 'text-gray-300'
                      }`}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-[11px] font-medium leading-snug text-gray-200">
          {card.subject || (strings?.editorial.untitled ?? 'Untitled')}
        </p>

        {card.preheader && (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-gray-500">{card.preheader}</p>
        )}

        {card.ideaNotes && card.status === 'idea' && (
          <p className="mt-1.5 line-clamp-2 text-[10px] text-gray-500">{card.ideaNotes}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-gray-600">
          <time>{formatRelativeDate(card.createdAt)}</time>
          {card.wordCount != null && card.wordCount > 0 && (
            <span className="tabular-nums">{card.wordCount.toLocaleString()}w</span>
          )}
          {card.charCount != null && card.charCount > 0 && (
            <span className="tabular-nums">{card.charCount.toLocaleString()} {strings?.editorial.chars ?? 'chars'}</span>
          )}
          {card.imageCount != null && card.imageCount > 0 && (
            <span className="tabular-nums">{card.imageCount} {strings?.editorial.images ?? 'images'}</span>
          )}
          {card.slotDate && (
            <span className="ml-auto rounded bg-purple-500/10 px-1 py-0.5 text-[8px] text-purple-400">
              {new Date(card.slotDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
          {card.stats && (
            <span className="ml-auto tabular-nums text-gray-500">
              {card.stats.opens} {strings?.overview.opens ?? 'opens'} · {card.stats.clicks} {strings?.overview.clicks ?? 'clicks'}
            </span>
          )}
        </div>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[100] min-w-[160px] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => { setContextMenu(null); handleClick() }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Pencil className="h-3 w-3" /> Open
          </button>

          {allowedTransitions.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-800" />
              {allowedTransitions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleContextMove(status)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-gray-300 hover:bg-gray-800"
                >
                  <ArrowRight className="h-3 w-3" /> Move to {STATUS_LABELS[status] ?? status}
                </button>
              ))}
            </>
          )}

          {canDelete && onDeleteEdition && (
            <>
              <div className="my-1 border-t border-gray-800" />
              <button
                onClick={() => { setContextMenu(null); onDeleteEdition(card.id) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 hover:bg-red-950/30"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}

export function KanbanCardOverlay({ card }: { card: EditionCard }) {
  return (
    <div className="w-[196px] rotate-2 rounded-lg border border-indigo-500/50 bg-gray-900 p-3 shadow-2xl shadow-indigo-500/10">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[8px] font-bold tabular-nums tracking-wide text-gray-400">
          {card.displayId}
        </span>
        {card.typeName && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
            style={card.typeColor
              ? { backgroundColor: `${card.typeColor}20`, color: card.typeColor }
              : { backgroundColor: '#374151', color: '#9ca3af' }
            }
          >
            {card.typeName}
          </span>
        )}
      </div>
      <p className="text-[11px] font-medium leading-snug text-gray-200">
        {card.subject || 'Untitled'}
      </p>
      <div className="mt-2 text-[9px] text-gray-600">
        <time>{formatRelativeDate(card.createdAt)}</time>
      </div>
    </div>
  )
}
