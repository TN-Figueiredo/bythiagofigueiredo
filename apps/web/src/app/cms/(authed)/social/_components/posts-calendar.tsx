// posts-calendar.tsx — enhanced with indigo social pills + slide-over panel
'use client'

import { useState, useMemo } from 'react'
import type { SocialPost, Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from '@/app/cms/(authed)/_shared/social/platform-icon'
import { SocialStatusBadge } from '@/app/cms/(authed)/_shared/social/social-status-badge'
import type { SocialStrings } from '../_i18n/types'

interface PostsCalendarProps {
  posts: SocialPost[]
  strings: SocialStrings
  platformsByPost?: Record<string, Provider[]>
}

/** Calendar-specific bg-only colors (no text color — cells use text-cms-text). */
const CALENDAR_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20', scheduled: 'bg-blue-500/20', draft: 'bg-yellow-500/20',
  failed: 'bg-red-500/20', cancelled: 'bg-gray-500/20', partial_failure: 'bg-orange-500/20',
  publishing: 'bg-blue-500/20',
}

/** Social posts get indigo pills to distinguish from other content types. */
const SOCIAL_PILL_CLASS = 'bg-indigo-500/20 text-cms-text'

export function PostsCalendar({ posts, strings: t, platformsByPost = {} }: PostsCalendarProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)

  const days = useMemo(() => {
    const first = new Date(month.year, month.month, 1)
    const last = new Date(month.year, month.month + 1, 0)
    const startDay = first.getDay()
    const cells: (Date | null)[] = Array.from({ length: startDay }, () => null)
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.year, month.month, d))
    return cells
  }, [month])

  const postsByDay = useMemo(() => {
    const map: Record<string, SocialPost[]> = {}
    for (const p of posts) {
      const date = p.scheduled_at ?? p.published_at ?? p.created_at
      const key = new Date(date).toISOString().slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return map
  }, [posts])

  function prevMonth() { setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 }) }
  function nextMonth() { setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 }) }

  const monthName = new Date(month.year, month.month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const dayNames = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 7 + i) // 2024-01-07 is a Sunday
      return formatter.format(d)
    })
  }, [])

  if (posts.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyCalendar}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="text-sm text-cms-accent hover:underline">&larr;</button>
        <span className="text-sm font-semibold text-cms-text">{monthName}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="text-sm text-cms-accent hover:underline">&rarr;</button>
      </div>
      <div role="grid" aria-label="Posts calendar" className="grid grid-cols-7 gap-px bg-cms-border rounded-lg overflow-hidden">
        {dayNames.map(d => (
          <div key={d} className="bg-cms-surface px-2 py-1 text-center text-xs font-medium text-cms-text-muted">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} role="gridcell" className="bg-cms-bg min-h-[60px]" />
          const key = day.toISOString().slice(0, 10)
          const dayPosts = postsByDay[key] ?? []
          return (
            <div key={key} role="gridcell" className="bg-cms-bg min-h-[60px] p-1">
              <span className="text-xs text-cms-text-dim">{day.getDate()}</span>
              {dayPosts.slice(0, 3).map(p => {
                const platforms = platformsByPost[p.id] ?? []
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPost(p)}
                    className={`mt-0.5 w-full rounded px-1 py-0.5 text-[10px] truncate text-left ${SOCIAL_PILL_CLASS} hover:bg-indigo-500/30 transition-colors`}
                  >
                    {platforms.length > 0 && (
                      <span className="mr-0.5">
                        {platforms.slice(0, 2).map(pl => (
                          <PlatformIcon key={pl} provider={pl} size="sm" className="inline text-[9px]" />
                        ))}
                      </span>
                    )}
                    {p.content.title ?? p.content.description?.slice(0, 20) ?? p.type}
                  </button>
                )
              })}
              {dayPosts.length > 3 && <p className="text-[10px] text-cms-text-dim">+{dayPosts.length - 3}</p>}
            </div>
          )
        })}
      </div>

      {/* Slide-over panel */}
      {selectedPost && (
        <CalendarSlideOver
          post={selectedPost}
          platforms={platformsByPost[selectedPost.id] ?? []}
          strings={t}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Slide-over panel (click a calendar pill to open)
// ---------------------------------------------------------------------------

interface CalendarSlideOverProps {
  post: SocialPost
  platforms: Provider[]
  strings: SocialStrings
  onClose: () => void
}

function CalendarSlideOver({ post, platforms, strings: t, onClose }: CalendarSlideOverProps) {
  const scheduledTime = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Post preview">
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed inset-0 bg-black/30"
      />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-md border-l border-cms-border bg-cms-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-cms-border p-4">
          <h3 className="text-sm font-semibold text-cms-text">Post Preview</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="text-cms-text-muted hover:text-cms-text"
          >
            x
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Status + platforms */}
          <div className="flex items-center gap-2 flex-wrap">
            <SocialStatusBadge
              status={post.status}
              label={t.status[post.status as keyof typeof t.status] ?? post.status}
            />
            {platforms.map((p) => (
              <span key={p} className="flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">
                <PlatformIcon provider={p} size="sm" />
                {platformLabel(p)}
              </span>
            ))}
          </div>

          {/* Scheduled time */}
          {scheduledTime && (
            <p className="text-sm text-cms-text-muted">{scheduledTime}</p>
          )}

          {/* Post content preview */}
          <div className="rounded-lg border border-cms-border bg-cms-bg p-3 space-y-2">
            {post.content.title && (
              <p className="text-sm font-medium text-cms-text">
                {post.content.title}
              </p>
            )}
            {post.content.description && (
              <p className="text-sm text-cms-text-muted">
                {post.content.description}
              </p>
            )}
            {post.content.url && (
              <p className="text-xs text-cms-accent truncate">
                {post.content.url}
              </p>
            )}
            {post.content.media_urls && post.content.media_urls.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {post.content.media_urls.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href={`/cms/social/new?post=${post.id}`}
              className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover"
            >
              {t.detail.edit}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              Remove from Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

