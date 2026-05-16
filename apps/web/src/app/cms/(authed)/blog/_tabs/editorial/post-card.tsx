'use client'

import { memo, useCallback, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { MoreVertical, ArrowRight, Copy, Trash2, Undo2, Calendar } from 'lucide-react'
import type { PostCard as PostCardType, BlogTag } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { formatRelativeDate, getKanbanMoveTargets } from '../../_hub/hub-utils'
import { SUBSTATUS_BADGES } from '../../_hub/hub-utils'

const LOCALE_FLAGS: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
  es: '\u{1F1EA}\u{1F1F8}',
}

function isValidHexColor(color: string | null): color is string {
  return color != null && /^#[0-9a-fA-F]{3,8}$/.test(color)
}

interface PostCardProps {
  card: PostCardType
  laneId: 'editing' | 'scheduled' | 'published'
  showSubstatus?: boolean
  pipelineCode?: string | null
  strings?: BlogHubStrings
  tags?: BlogTag[]
  supportedLocales?: string[]
  onMoveToStatus?: (postId: string, newStatus: string) => void
  onDelete?: (postId: string) => void
  onReassignTag?: (postId: string, tagId: string | null) => void
  onAddLocale?: (postId: string, locale: string) => void
  onRemoveLocale?: (postId: string, locale: string) => void
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`group relative rounded-lg border bg-gray-900 p-2.5 transition-colors hover:border-gray-700 ${
        selected ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-gray-800'
      }`}
    >
      {/* Cover image */}
      {card.coverImageUrl && (
        <div className="mb-2 h-24 w-full overflow-hidden rounded-md">
          <img
            src={card.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Display ID + substatus */}
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{card.displayId}</span>
        {subBadge && (
          <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${subBadge.color}`}>
            {strings?.substatus[subBadge.labelKey as keyof typeof strings.substatus] ?? subBadge.labelKey}
          </span>
        )}
        <span className="ml-auto text-gray-600">{formatRelativeDate(card.updatedAt)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(!menuOpen)
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300"
          aria-label="More actions"
        >
          <MoreVertical className="h-3 w-3" />
        </button>
      </div>

      {/* Title */}
      <Link
        href={`/cms/blog/${card.id}/edit`}
        className="mt-1 block text-[12px] font-medium text-gray-200 line-clamp-2 hover:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {card.title}
      </Link>

      {/* Tag + locales */}
      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
        {card.tagName && (
          <span
            className="rounded px-1.5 py-0.5 text-[8px] font-medium"
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

      {/* Scheduled date */}
      {laneId === 'scheduled' && card.scheduledFor && (
        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-purple-400">
          <Calendar className="h-3 w-3" />
          {new Date(card.scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Pipeline provenance */}
      {pipelineCode && (
        <div className="mt-1 text-[8px] text-gray-600">
          &#x2197; {pipelineCode}
        </div>
      )}

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 top-8 z-20 w-44 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
        >
          <Link
            href={`/cms/blog/${card.id}/edit`}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            {strings?.editorial.open ?? 'Edit'}
          </Link>

          {moveTargets.length > 0 && (
            <div className="border-t border-gray-800 my-1" />
          )}
          {moveTargets.map((target) => (
            <button
              key={target}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onMoveToStatus?.(card.id, target)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
            >
              <ArrowRight className="h-3 w-3" />
              {strings?.editorial[`moveTo${target.charAt(0).toUpperCase()}${target.slice(1)}` as keyof typeof strings.editorial] ?? target}
            </button>
          ))}

          <div className="border-t border-gray-800 my-1" />

          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen(false)
              onDuplicate?.(card.id)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            {strings?.editorial.duplicate ?? 'Duplicate'}
          </button>

          {canReturn && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onReturnToPipeline?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-amber-400 hover:bg-gray-800"
            >
              <Undo2 className="h-3 w-3" />
              {strings?.promotion.returnToPipeline ?? 'Return to Pipeline'}
            </button>
          )}

          {(card.status === 'draft' || card.status === 'archived' || card.status === 'idea') && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                onDelete?.(card.id)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-gray-800"
            >
              <Trash2 className="h-3 w-3" />
              {strings?.editorial.delete ?? 'Delete'}
            </button>
          )}
        </div>
      )}

      {/* Selected overlay */}
      {selected && (
        <div className="absolute inset-0 rounded-lg bg-indigo-500/5 pointer-events-none">
          <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white">
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
