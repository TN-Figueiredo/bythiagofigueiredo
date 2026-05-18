'use client'

import { memo } from 'react'
import {
  getPriorityConfig,
  getStaleness,
  getFormatIcon,
  getLangConfig,
  getCardState,
  isBlocked,
  getChecklistProgress,
} from '@/lib/pipeline/gem-design'
import { GemVvsRing } from './gem-vvs-ring'

export interface GemCardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: string
  language: string
  priority: number
  hook: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  updated_at: string
  youtube_video_id: string | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  social_post_id: string | null
  linked_post_status: string | null
  is_archived: boolean
  validation_score: number
  dependencies: Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>
  sort_order: number
  version: number
  cover_image_url: string | null
}

interface GemCardProps {
  item: GemCardItem
  isDragging?: boolean
  onNavigate?: () => void
  onPromote?: (itemId: string) => void
}

export const GemCard = memo(function GemCard({ item, isDragging: _isDragging, onNavigate, onPromote }: GemCardProps) {
  const priority = getPriorityConfig(item.priority)
  const staleness = getStaleness(item.updated_at)
  const formatIcon = getFormatIcon(item.format)
  const lang = getLangConfig(item.language)
  const state = getCardState(item)
  const blocked = isBlocked(item.dependencies)
  const checklist = getChecklistProgress(item.production_checklist)
  const title = item.title_pt || item.title_en || 'Untitled'

  const isEnriched = state === 'enriched' || state === 'graduated'
  const isArchived = state === 'archived'
  const isGraduated = state === 'graduated'
  const isBlockedState = blocked.blocked

  const tags: Array<{ label: string; className: string }> = []
  for (const t of item.tags) {
    if (tags.length >= 3) break
    tags.push({ label: t, className: 'bg-cyan-900/50 text-cyan-300' })
  }
  const overflowCount = item.tags.length - tags.length

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${title} — ${formatIcon.label}, ${priority.label}`}
      onClick={onNavigate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.() } }}
      className={`block overflow-hidden rounded-lg border p-3 transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 cursor-pointer ${
        isArchived ? 'opacity-45 saturate-[0.3] hover:opacity-65' : ''
      } ${isBlockedState ? 'ring-1 ring-red-500/30' : ''}`}
      style={{
        borderColor: isBlockedState ? 'color-mix(in srgb, var(--gem-danger, #ef4444) 40%, transparent)' : 'var(--gem-border)',
        background: isBlockedState
          ? 'linear-gradient(to bottom, color-mix(in srgb, var(--gem-danger, #ef4444) 5%, transparent), var(--gem-surface))'
          : isEnriched
            ? `linear-gradient(to bottom, ${priority.accentDim}, var(--gem-surface))`
            : 'var(--gem-surface)',
      }}
      onMouseEnter={(e) => { if (!isArchived && !isBlockedState) e.currentTarget.style.borderColor = priority.accent }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isBlockedState ? 'color-mix(in srgb, var(--gem-danger, #ef4444) 40%, transparent)' : 'var(--gem-border)' }}
    >
      {/* Cover image tier */}
      {item.cover_image_url ? (
        <>
          <div className="relative h-[44px] w-full overflow-hidden rounded-t-lg -mt-3 -mx-3 mb-2">
            <img src={item.cover_image_url} alt={title} loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--gem-surface)] from-[20%] to-transparent" />
          </div>
          {/* Priority bar below cover */}
          <div
            className="h-0.5 -mx-3 mb-2"
            style={{
              background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
              opacity: item.priority <= 1 ? 0.25 : 1,
            }}
          />
        </>
      ) : (
        /* Priority bar */
        <div
          className="h-0.5 -mx-3 -mt-3 mb-2 rounded-t-lg"
          style={{
            background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
            opacity: item.priority <= 1 ? 0.25 : 1,
          }}
        />
      )}

      {/* Header row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
        <span className={`text-[18px] leading-none w-5 h-5 flex items-center justify-center rounded ${formatIcon.bgClass}`}>
          {formatIcon.icon}
        </span>
        <span className="text-[10px] font-mono" style={{ color: priority.accent }}>{item.code}</span>
        <span className={`text-[10px] px-1 py-0.5 rounded ${lang.className}`}>{lang.label}</span>
        <span
          className="text-[10px] px-1 py-0.5 rounded font-medium"
          style={{ backgroundColor: priority.accentDim, color: priority.accent }}
        >
          {priority.label}
        </span>
        {isGraduated && (
          <span
            className="text-[10px] px-1 py-0.5 rounded font-medium"
            style={{
              backgroundColor: item.linked_post_status === 'published' ? 'color-mix(in srgb, var(--gem-done, #10b981) 15%, transparent)' : 'color-mix(in srgb, var(--gem-warn, #f59e0b) 15%, transparent)',
              color: item.linked_post_status === 'published' ? 'var(--gem-done, #10b981)' : 'var(--gem-warn, #f59e0b)',
            }}
            title={`Blog post: ${item.linked_post_status ?? 'linked'}`}
          >
            {item.linked_post_status === 'published' ? '✓ published' : 'graduated'}
          </span>
        )}
        <span className={`text-[10px] flex items-center gap-0.5 ml-auto ${staleness.className}`} title={staleness.tier === 'ok' ? 'Current' : staleness.tier === 'warn' ? 'Stale' : 'Very stale'}>
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{
              backgroundColor: staleness.tier === 'ok' ? 'var(--gem-done, #10b981)' : staleness.tier === 'warn' ? 'var(--gem-warn, #f59e0b)' : 'var(--gem-danger, #ef4444)',
            }}
          />
          {staleness.days}d
        </span>
      </div>

      {/* Title */}
      <p className="text-xs font-semibold tracking-[-0.01em] line-clamp-2" style={{ color: 'var(--gem-text)' }}>
        {title}
      </p>

      {/* Hook */}
      <div className="mt-1.5">
        {item.hook ? (
          <p
            className="text-[10px] line-clamp-2 pl-2 border-l-2"
            style={{ color: 'var(--gem-muted)', borderColor: priority.accent }}
          >
            {item.hook}
          </p>
        ) : (
          <p
            className="text-[10px] italic pl-2 border-l-2 border-dashed"
            style={{ color: 'var(--gem-dim)', borderColor: 'var(--gem-dim)' }}
          >
            sem hook definido
          </p>
        )}
      </div>

      {/* Tags */}
      {(tags.length > 0 || blocked.blocked) && (
        <div className="flex gap-1 mt-1.5 overflow-hidden">
          {blocked.blocked && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-red-900/50 text-red-300 shrink-0">
              blocked by {blocked.blockers[0]}
            </span>
          )}
          {tags.map((t, i) => (
            <span key={`${t.label}-${i}`} className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${t.className}`}>
              {t.label}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-slate-700/50 text-slate-400 shrink-0">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid var(--gem-border)' }}>
        {/* Segmented checklist bar */}
        <div className="flex gap-0.5 flex-1 mr-2">
          {checklist.segments.map((done, i) => (
            <div
              key={i}
              data-segment
              className="h-1 flex-1 rounded-sm transition-colors duration-300"
              style={{
                backgroundColor: done ? 'var(--gem-done)' : 'var(--gem-well)',
                boxShadow: done ? '0 0 4px color-mix(in srgb, var(--gem-done, #10b981) 30%, transparent)' : 'none',
                border: done ? 'none' : '1px solid var(--gem-border)',
              }}
            />
          ))}
        </div>
        {/* VVS Ring */}
        <GemVvsRing score={item.validation_score} size={26} />
      </div>

      {/* Promote to Posts Hub — only on ready/pronto stage */}
      {item.stage === 'ready' && !isGraduated && onPromote && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPromote(item.id) }}
          className="mx-0 mt-2 flex w-full items-center gap-1 rounded-md border border-indigo-500/15 bg-indigo-500/8 px-2.5 py-1.5 text-[9px] font-semibold text-indigo-400 transition-colors hover:border-indigo-500/30 hover:bg-indigo-500/15 hover:text-indigo-300"
        >
          <span className="text-[11px]">&rarr;</span> Promote to Posts Hub
        </button>
      )}

      {/* Graduated emerald bar */}
      {isGraduated && (
        <div
          className="h-0.5 -mx-3 -mb-3 mt-2 rounded-b-lg"
          style={{ background: 'linear-gradient(to right, var(--gem-done, #10b981), var(--gem-done, #059669) 50%, transparent)' }}
        />
      )}
    </div>
  )
})
