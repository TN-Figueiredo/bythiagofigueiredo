'use client'

import { memo } from 'react'
import Link from 'next/link'
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
  is_archived: boolean
  validation_score: number
  dependencies: Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>
  collection_code: string | null
}

export const GemCard = memo(function GemCard({ item }: { item: GemCardItem }) {
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
  if (item.collection_code) {
    tags.push({ label: item.collection_code, className: 'bg-amber-900/50 text-amber-300' })
  }
  for (const t of item.tags) {
    if (tags.length >= 3) break
    tags.push({ label: t, className: 'bg-cyan-900/50 text-cyan-300' })
  }
  const overflowCount = (item.collection_code ? 1 : 0) + item.tags.length - tags.length

  return (
    <Link
      href={`/cms/pipeline/items/${item.id}`}
      aria-label={`${title} — ${formatIcon.label}, ${priority.label}, stage ${item.stage}`}
      className={`block rounded-lg border p-3 transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${
        isArchived ? 'opacity-45 saturate-[0.3] hover:opacity-65' : ''
      } ${isBlockedState ? 'ring-1 ring-red-500/30' : ''}`}
      style={{
        borderColor: isBlockedState ? 'rgba(239,68,68,0.4)' : 'var(--gem-border)',
        background: isBlockedState
          ? 'linear-gradient(to bottom, rgba(239,68,68,0.05), var(--gem-surface))'
          : isEnriched
            ? `linear-gradient(to bottom, ${priority.accentDim}, var(--gem-surface))`
            : 'var(--gem-surface)',
      }}
      onMouseEnter={(e) => { if (!isArchived && !isBlockedState) e.currentTarget.style.borderColor = priority.accent }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = isBlockedState ? 'rgba(239,68,68,0.4)' : 'var(--gem-border)' }}
    >
      {/* Priority bar */}
      <div
        className="h-0.5 -mx-3 -mt-3 mb-2 rounded-t-lg"
        style={{
          background: `linear-gradient(to right, ${priority.accent}, transparent 75%)`,
          opacity: item.priority <= 1 ? 0.25 : 1,
        }}
      />

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
          <span className="text-[10px] px-1 py-0.5 rounded bg-emerald-900/50 text-emerald-300 font-medium">
            graduated
          </span>
        )}
        <span className={`text-[10px] flex items-center gap-0.5 ml-auto ${staleness.className}`}>
          <span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{
              backgroundColor: staleness.tier === 'ok' ? '#10b981' : staleness.tier === 'warn' ? '#f59e0b' : '#ef4444',
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
                boxShadow: done ? '0 0 4px rgba(16,185,129,0.3)' : 'none',
                border: done ? 'none' : '1px solid var(--gem-border)',
              }}
            />
          ))}
        </div>
        {/* VVS Ring */}
        <GemVvsRing score={item.validation_score} size={26} />
      </div>

      {/* Graduated emerald bar */}
      {isGraduated && (
        <div
          className="h-0.5 -mx-3 -mb-3 mt-2 rounded-b-lg"
          style={{ background: 'linear-gradient(to right, #10b981, #059669 50%, transparent)' }}
        />
      )}
    </Link>
  )
})
