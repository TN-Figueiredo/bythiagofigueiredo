'use client'

import { useState, useMemo } from 'react'
import type { SocialPost } from '@tn-figueiredo/social'
import type { SocialStrings } from '../_i18n/types'

interface PostsCalendarProps {
  posts: SocialPost[]
  strings: SocialStrings
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/20', scheduled: 'bg-blue-500/20', draft: 'bg-yellow-500/20',
  failed: 'bg-red-500/20', cancelled: 'bg-gray-500/20', partial_failure: 'bg-orange-500/20',
  publishing: 'bg-blue-500/20',
}

export function PostsCalendar({ posts, strings: t }: PostsCalendarProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

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

  const monthName = new Date(month.year, month.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (posts.length === 0) {
    return <p className="py-12 text-center text-cms-text-muted">{t.posts.emptyCalendar}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="text-sm text-cms-accent hover:underline">&larr; Prev</button>
        <span className="text-sm font-semibold text-cms-text">{monthName}</span>
        <button type="button" onClick={nextMonth} className="text-sm text-cms-accent hover:underline">Next &rarr;</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-cms-border rounded-lg overflow-hidden">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="bg-cms-surface px-2 py-1 text-center text-xs font-medium text-cms-text-muted">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-cms-bg min-h-[60px]" />
          const key = day.toISOString().slice(0, 10)
          const dayPosts = postsByDay[key] ?? []
          return (
            <div key={key} className="bg-cms-bg min-h-[60px] p-1">
              <span className="text-xs text-cms-text-dim">{day.getDate()}</span>
              {dayPosts.slice(0, 3).map(p => (
                <div key={p.id} className={`mt-0.5 rounded px-1 py-0.5 text-[10px] truncate ${STATUS_COLORS[p.status] ?? ''} text-cms-text`}>
                  {p.content.title ?? p.content.description?.slice(0, 20) ?? p.type}
                </div>
              ))}
              {dayPosts.length > 3 && <p className="text-[10px] text-cms-text-dim">+{dayPosts.length - 3} more</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
