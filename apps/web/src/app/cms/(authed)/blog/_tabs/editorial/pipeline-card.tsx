'use client'

import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { ArrowRightCircle, Link2, Music2 } from 'lucide-react'
import type { PipelineCardItem } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { LOCALE_FLAGS, formatRelativeDate } from '../../_hub/hub-utils'

const PRIORITY_COLORS: Record<number, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-amber-500',
  2: 'bg-sky-500',
  1: 'bg-gray-500',
}

const PRIORITY_BADGE_COLORS: Record<number, string> = {
  5: 'bg-red-500/15 text-red-400',
  4: 'bg-orange-500/15 text-orange-400',
  3: 'bg-amber-500/15 text-amber-400',
  2: 'bg-sky-500/15 text-sky-400',
  1: 'bg-gray-500/15 text-gray-400',
  0: 'bg-gray-500/10 text-gray-500',
}

const PRIORITY_LABELS: Record<number, string> = {
  5: 'Urgente',
  4: 'Alta',
  3: 'Média',
  2: 'Normal',
  1: 'Baixa',
}

function getLanguageFlags(item: PipelineCardItem): string {
  const hasPt = !!item.title_pt
  const hasEn = !!item.title_en
  if (hasPt && hasEn) return '\u{1F1E7}\u{1F1F7} \u{1F1FA}\u{1F1F8}'
  if (hasPt) return '\u{1F1E7}\u{1F1F7}'
  if (hasEn) return '\u{1F1FA}\u{1F1F8}'
  return LOCALE_FLAGS[item.language] ?? '\u{1F1E7}\u{1F1F7}'
}

interface PipelineCardProps {
  item: PipelineCardItem
  laneId: 'idea' | 'draft' | 'ready' | 'scheduled' | 'published'
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
      className="group relative rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-2.5 transition-all hover:border-gray-600 hover:bg-gray-800/40 focus-visible:ring-1 focus-visible:ring-indigo-500/50 focus-visible:outline-none"
    >
      {/* Priority bar */}
      <div
        className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-600'}`}
        title={item.priority > 0 ? `Prioridade: ${PRIORITY_LABELS[item.priority]}` : undefined}
      />

      <div className="pl-1.5">
        {/* Header: code + lang + priority */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="font-mono text-gray-500">{item.code}</span>
          <span aria-hidden="true" className="text-sm leading-none">{getLanguageFlags(item)}</span>
          <span className="text-gray-600" title={new Date(item.updated_at).toLocaleString()}>
            {formatRelativeDate(item.updated_at)}
          </span>
          {item.priority > 0 && (
            <span
              title={`Prioridade: ${PRIORITY_LABELS[item.priority]}`}
              className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_BADGE_COLORS[item.priority] ?? PRIORITY_BADGE_COLORS[0]}`}
            >
              {PRIORITY_LABELS[item.priority]}
            </span>
          )}
        </div>

        {/* Title */}
        {item.blog_post_id ? (
          <Link
            href={`/cms/blog/${item.blog_post_id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 block text-[13px] font-medium leading-snug text-gray-200 line-clamp-2 hover:text-white"
          >
            {title}
          </Link>
        ) : (
          <span className="mt-1.5 block text-[13px] font-medium leading-snug text-gray-200 line-clamp-2">
            {title}
          </span>
        )}

        {/* Hook */}
        {item.hook && (
          <p className="mt-1.5 border-l-2 border-amber-500/40 pl-2 text-[10px] text-gray-500 line-clamp-2">
            {item.hook}
          </p>
        )}

        {/* Checklist progress */}
        {total > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full bg-emerald-500 transition-all"
                style={{ width: `${checkPct}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-gray-500">{done}/{total}</span>
          </div>
        )}

        {/* Playlist tags */}
        {item.playlists.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.playlists.map((pl) => (
              <Link
                key={pl.id}
                href={`/cms/playlists/${pl.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-medium text-indigo-400 hover:bg-indigo-500/20 transition-colors"
              >
                <Music2 className="h-2.5 w-2.5" />
                {pl.name}
              </Link>
            ))}
          </div>
        )}

        {/* Dependencies */}
        {item.dependencies.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400/80">
            <Link2 className="h-2.5 w-2.5" />
            <span>Depende de {item.dependencies.map((d) => d.depends_on_pipeline?.code).filter(Boolean).join(', ')}</span>
          </div>
        )}

        {/* VVS score + Promote */}
        {(item.validation_score > 0 || laneId === 'ready') && (
          <div className="mt-2 flex items-center justify-between">
            {item.validation_score > 0 && (
              <span
                title="Validation & Viability Score"
                className={`text-[10px] font-medium ${item.validation_score < 50 ? 'text-red-400' : item.validation_score < 80 ? 'text-amber-400' : 'text-emerald-400'}`}
              >
                VVS {item.validation_score}%
              </span>
            )}

            {laneId === 'ready' && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPromote?.(item.id)
                }}
                aria-label={`${strings?.promotion?.promote ?? 'Promote'} — ${title}`}
                className="ml-auto flex items-center gap-1 rounded-md bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-colors"
              >
                <ArrowRightCircle className="h-3 w-3" />
                {strings?.promotion?.promote ?? 'Promote'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

export function PipelineCardOverlay({ item, strings }: { item: PipelineCardItem; strings?: BlogHubStrings }) {
  const title = item.title_pt || item.title_en || (strings?.editorial?.untitled ?? 'Untitled')
  return (
    <div className="relative w-[280px] rounded-lg border border-indigo-500/40 bg-gray-900 p-3 shadow-xl">
      <div
        className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${PRIORITY_COLORS[item.priority] ?? 'bg-gray-600'}`}
      />
      <div className="flex items-center gap-1.5 pl-1 text-[10px]">
        <span className="font-mono text-gray-500">{item.code}</span>
        <span aria-hidden="true" className="text-sm leading-none">{getLanguageFlags(item)}</span>
        <span className="text-gray-600">{formatRelativeDate(item.updated_at)}</span>
        {item.priority > 0 && (
          <span
            title={`Prioridade: ${PRIORITY_LABELS[item.priority]}`}
            className={`ml-auto rounded px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_BADGE_COLORS[item.priority] ?? PRIORITY_BADGE_COLORS[0]}`}
          >
            {PRIORITY_LABELS[item.priority]}
          </span>
        )}
      </div>
      <p className="mt-1.5 pl-1 text-[13px] font-medium text-gray-200 line-clamp-2">{title}</p>
    </div>
  )
}
