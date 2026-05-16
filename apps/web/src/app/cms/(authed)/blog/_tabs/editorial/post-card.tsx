'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import Image from 'next/image'
import { MoreVertical, ArrowRight, Copy, Trash2, Undo2, Calendar } from 'lucide-react'
import type { PostCard as PostCardType } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate, getKanbanMoveTargets } from '../../_hub/hub-utils'
import { SUBSTATUS_BADGES } from '../../_hub/hub-utils'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
}

const MOVE_TO_LABEL_MAP: Record<string, keyof BlogHubStrings['editorial']> = {
  idea: 'moveToIdea',
  draft: 'moveToDraft',
  ready: 'moveToReady',
  scheduled: 'moveToScheduled',
  published: 'moveToPublished',
  archived: 'moveToArchived',
}

function isValidHexColor(color: string | null): color is string {
  return color != null && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
}

interface PostCardProps {
  card: PostCardType
  laneId: 'editing' | 'scheduled' | 'published'
  showSubstatus?: boolean
  pipelineCode?: string | null
  strings?: BlogHubStrings
  locale?: string
  onMoveToStatus?: (postId: string, newStatus: string) => void
  onDelete?: (postId: string) => void
  onDuplicate?: (postId: string) => void
  onReturnToPipeline?: (postId: string) => void
  selected?: boolean
  onSelect?: (postId: string, multi: boolean) => void
}

export const PostCard = memo(function PostCard({
  card,
  laneId,
  showSubstatus = false,
  pipelineCode,
  strings,
  locale,
  onMoveToStatus,
  onDelete,
  onDuplicate,
  onReturnToPipeline,
  selected,
  onSelect,
}: PostCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: laneId === 'published' })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleScroll = () => {
      closeMenu()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [menuOpen, closeMenu])

  useEffect(() => {
    if (menuOpen) {
      firstItemRef.current?.focus()
    }
  }, [menuOpen])

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const menu = menuRef.current
      if (!menu) return
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      )
      const currentIndex = items.findIndex((el) => el === document.activeElement)
      const nextIndex =
        e.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length
      items[nextIndex]?.focus()
    }
  }, [closeMenu])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onSelect) {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault()
        onSelect(card.id, true)
        return
      }
    }
  }, [card.id, onSelect])

  const moveTargets = getKanbanMoveTargets(card.status)
  const subBadge = showSubstatus ? SUBSTATUS_BADGES[card.status] : null
  const canReturn = pipelineCode && (card.status === 'idea' || card.status === 'draft')

  const displayTitle = card.title || (strings?.editorial?.untitled ?? 'Untitled')

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group relative rounded-lg border bg-gray-900 p-2.5 transition-colors hover:border-gray-700 ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-gray-800'
      } ${laneId === 'published' ? 'cursor-default' : ''}`}
    >
      {card.coverImageUrl && (
        <div className="mb-2 h-24 w-full overflow-hidden rounded-md relative">
          <Image
            src={card.coverImageUrl}
            alt={displayTitle}
            fill
            sizes="280px"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{card.displayId}</span>
        {subBadge && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${subBadge.color}`}>
            {strings?.substatus?.[subBadge.labelKey] ?? subBadge.labelKey}
          </span>
        )}
        <span className="ml-auto text-gray-600">{formatRelativeDate(card.updatedAt, strings?.relativeLabels)}</span>
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((prev) => !prev)
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 flex items-center justify-center min-h-[44px] min-w-[44px] -mr-1"
          aria-label={`${strings?.editorial?.moreActions ?? 'More actions'} — ${displayTitle}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="h-3 w-3" />
        </button>
      </div>

      <Link
        href={`/cms/blog/${card.id}/edit`}
        className="mt-1 block text-[12px] font-medium text-gray-200 line-clamp-2 hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {displayTitle}
      </Link>

      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {card.tagName && (
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={isValidHexColor(card.tagColor) ? { backgroundColor: `${card.tagColor}20`, color: card.tagColor } : undefined}
          >
            {card.tagName}
          </span>
        )}
        {card.locales.map((loc) => (
          <span key={loc} className="text-[9px] text-gray-500">
            {LOCALE_FLAGS[loc] ?? loc}
          </span>
        ))}
      </div>

      {laneId === 'scheduled' && card.scheduledFor && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-purple-400">
          <Calendar className="h-3 w-3" />
          {new Date(card.scheduledFor).toLocaleDateString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {pipelineCode && (
        <div className="mt-1 text-[10px] text-gray-600">
          &#x2197; {pipelineCode}
        </div>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-2 top-8 z-20 w-44 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
        >
          <Link
            href={`/cms/blog/${card.id}/edit`}
            role="menuitem"
            ref={(el) => { firstItemRef.current = el }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            {strings?.editorial?.open ?? 'Edit'}
          </Link>

          {moveTargets.length > 0 && (
            <div className="border-t border-gray-800 my-1" />
          )}
          {moveTargets.map((target, idx) => {
            const labelKey = MOVE_TO_LABEL_MAP[target]
            const label = labelKey ? (strings?.editorial?.[labelKey] ?? target) : target
            return (
              <button
                key={target}
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation()
                  closeMenu()
                  onMoveToStatus?.(card.id, target)
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
              >
                <ArrowRight className="h-3 w-3" />
                {label}
              </button>
            )
          })}

          <div className="border-t border-gray-800 my-1" />

          <button
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation()
              closeMenu()
              onDuplicate?.(card.id)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            {strings?.editorial?.duplicate ?? 'Duplicate'}
          </button>

          {canReturn && (
            <button
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu()
                onReturnToPipeline?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-amber-400 hover:bg-gray-800"
            >
              <Undo2 className="h-3 w-3" />
              {strings?.promotion?.returnToPipeline ?? 'Return to Pipeline'}
            </button>
          )}

          {(card.status === 'draft' || card.status === 'archived' || card.status === 'idea') && (
            <button
              role="menuitem"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu()
                onDelete?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-gray-800"
            >
              <Trash2 className="h-3 w-3" />
              {strings?.editorial?.delete ?? 'Delete'}
            </button>
          )}
        </div>
      )}

      {selected && (
        <div className="absolute inset-0 rounded-lg bg-indigo-500/5 pointer-events-none">
          <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] text-white">
            &#x2713;
          </div>
        </div>
      )}
    </div>
  )
})

export function PostCardOverlay({ card }: { card: PostCardType }) {
  return (
    <div className="w-[280px] rounded-lg border border-indigo-500/40 bg-gray-900 p-3 shadow-xl">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{card.displayId}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-gray-200 line-clamp-2">{card.title}</p>
    </div>
  )
}
