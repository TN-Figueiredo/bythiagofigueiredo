'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { ArrowRightCircle } from 'lucide-react'
import type { PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { LOCALE_FLAGS } from '../../_hub/hub-utils'

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-amber-500',
  2: 'bg-sky-500',
  1: 'bg-gray-500',
}

interface PipelineCardProps {
  item: PipelineCardItem
  laneId: 'idea' | 'draft' | 'ready'
  strings?: BlogHubStrings
  onPromote?: (itemId: string) => void
}

export const PipelineCard = memo(function PipelineCard({
  item,
  laneId,
  strings,
  onPromote,
}: PipelineCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const title = item.title_pt || item.title_en || (strings?.editorial?.untitled ?? 'Untitled')
  const checklist = Array.isArray(item.production_checklist) ? item.production_checklist : []
  const done = checklist.filter((c) => c.done).length
  const total = checklist.length
  const checkPct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative rounded-lg border border-gray-800 bg-gray-900 p-2.5 transition-colors hover:border-gray-700"
    >
      {/* Priority bar */}
      <div
        className={`absolute left-0 top-0 h-full w-[3px] rounded-l-lg ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-600'}`}
      />

      <div className="pl-2">
        {/* Header: code + lang + priority */}
        <div className="flex items-center gap-1.5 text-[9px]">
          <span className="font-mono text-gray-500">{item.code}</span>
          <span aria-hidden="true">{LOCALE_FLAGS[item.language] ?? ''}</span>
          <span className="ml-auto text-gray-600">P{item.priority}</span>
        </div>

        {/* Title */}
        <Link
          href={`/cms/pipeline/items/${item.id}?from=blog`}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 block text-[12px] font-medium text-gray-200 line-clamp-2 hover:text-white"
        >
          {title}
        </Link>

        {/* Hook */}
        {item.hook && (
          <p className="mt-1 border-l-2 border-amber-500/30 pl-2 text-[10px] text-gray-500 line-clamp-2">
            {item.hook}
          </p>
        )}

        {/* Checklist progress */}
        {total > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full bg-gray-800">
              <div
                className="h-1 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${checkPct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-600">{done}/{total}</span>
          </div>
        )}

        {/* VVS score */}
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-gray-600">VVS {item.validation_score}%</span>

          {/* Promote button — only in Ready lane */}
          {laneId === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPromote?.(item.id)
              }}
              className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-0.5 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/30 transition-colors"
            >
              <ArrowRightCircle className="h-3 w-3" />
              {strings?.promotion?.promote ?? 'Promote'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

export function PipelineCardOverlay({ item, strings }: { item: PipelineCardItem; strings?: BlogHubStrings }) {
  const title = item.title_pt || item.title_en || (strings?.editorial?.untitled ?? 'Untitled')
  return (
    <div className="w-[280px] rounded-lg border border-indigo-500/40 bg-gray-900 p-3 shadow-xl">
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="font-mono text-gray-500">{item.code}</span>
        <span className="ml-auto text-gray-600">P{item.priority}</span>
      </div>
      <p className="mt-1 text-[12px] font-medium text-gray-200 line-clamp-2">{title}</p>
    </div>
  )
}
