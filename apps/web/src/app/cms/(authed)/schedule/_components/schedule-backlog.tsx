'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BacklogItem, ContentType } from '@/lib/schedule/schedule-queries'

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const TYPE_COLORS: Record<ContentType, string> = {
  blog: '#34d399',
  newsletter: '#a78bfa',
  video: '#fb7185',
}

const TYPE_LABELS: Record<ContentType, string> = {
  blog: 'Blog',
  newsletter: 'Newsletter',
  video: 'Video',
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface ScheduleBacklogProps {
  backlog: BacklogItem[]
}

export function ScheduleBacklog({ backlog }: ScheduleBacklogProps) {
  const [expanded, setExpanded] = useState(false)

  if (backlog.length === 0) return null

  // Group by type
  const grouped = backlog.reduce<Record<ContentType, BacklogItem[]>>(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = []
      acc[item.type].push(item)
      return acc
    },
    {} as Record<ContentType, BacklogItem[]>,
  )

  return (
    <div className="mt-4" data-testid="schedule-backlog">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60"
        data-testid="backlog-toggle"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
            expanded ? 'rotate-90' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        <span>Backlog</span>
        <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-400">
          {backlog.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 pl-2">
          {(Object.entries(grouped) as [ContentType, BacklogItem[]][]).map(
            ([type, items]) => (
              <div key={type}>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[type] }}
                  />
                  {TYPE_LABELS[type]}
                  <span className="text-slate-600">({items.length})</span>
                </h4>
                <div className="space-y-1">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.editUrl}
                      className="block truncate rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
