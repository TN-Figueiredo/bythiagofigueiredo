'use client'

import { useState } from 'react'
import type { ActivityEvent } from '../_hub/hub-types'
import { formatRelativeDate } from '../_hub/hub-utils'

const EVENT_ICONS: Record<ActivityEvent['type'], string> = {
  welcome: '👋',
  delivered: '✉️',
  opened: '📬',
  clicked: '🔗',
  bounced: '⚠️',
  system: '⚙️',
}

interface ActivityFeedProps {
  events: ActivityEvent[]
  maxVisible?: number
  showMoreLabel?: string
}

export function ActivityFeed({ events, maxVisible = 8, showMoreLabel = 'Show more' }: ActivityFeedProps) {
  const [limit, setLimit] = useState(maxVisible)
  const visible = events.slice(0, limit)

  if (events.length === 0) return null

  return (
    <div className="space-y-1">
      {visible.map((e) => (
        <div key={e.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-800/50">
          <span className="mt-0.5 shrink-0 text-[11px]">{EVENT_ICONS[e.type]}</span>
          <div className="min-w-0 flex-1">
            <span className="text-gray-300">{e.description}</span>
            {e.emailMasked && <span className="ml-1 text-gray-500">{e.emailMasked}</span>}
          </div>
          <time className="shrink-0 text-[10px] text-gray-600">{formatRelativeDate(e.timestamp)}</time>
        </div>
      ))}
      {events.length > limit && (
        <button
          onClick={() => setLimit((l) => l + maxVisible)}
          className="w-full py-1 text-center text-[11px] text-indigo-400 hover:text-indigo-300"
        >
          {showMoreLabel}
        </button>
      )}
    </div>
  )
}
