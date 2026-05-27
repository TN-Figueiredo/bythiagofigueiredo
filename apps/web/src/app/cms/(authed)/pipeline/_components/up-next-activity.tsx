'use client'

import { memo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getFormatColor } from '@/lib/pipeline/colors'

export interface ActivityEntry {
  id: string
  code: string
  format: string
  event_type: string
  to_value: string | null
  changed_at: string
}

interface UpNextActivityProps {
  entries: ActivityEntry[]
}

const EVENT_LABELS: Record<string, (toValue: string | null) => string> = {
  stage_change: (to) => `moveu para ${to ?? '?'}`,
  created: () => 'criado',
  archived: () => 'arquivado',
  restored: () => 'restaurado',
  graduated: () => 'graduado',
}

function getEventLabel(eventType: string, toValue: string | null): string {
  const fn = EVENT_LABELS[eventType]
  if (fn) return fn(toValue)
  return eventType
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  if (diffMs < 60_000) return 'agora'

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}min`

  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(diffMs / 86_400_000)
  return `${days}d`
}

export const UpNextActivity = memo(function UpNextActivity({ entries }: UpNextActivityProps) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  return (
    <section
      data-testid="activity-section"
      aria-label="Atividade recente"
      className="rounded-lg"
      style={{
        background: 'var(--gem-surface)',
        border: '1px solid var(--gem-border)',
      }}
    >
      <button
        type="button"
        data-testid="activity-toggle"
        aria-expanded={expanded}
        aria-controls="activity-list"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none motion-safe:transition-opacity"
        style={{ color: 'var(--gem-text)' }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span>Atividade Recente</span>
        <ChevronDown
          size={16}
          className="motion-safe:transition-transform"
          style={{
            color: 'var(--gem-muted)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {expanded && (
        <ul
          id="activity-list"
          data-testid="activity-list"
          className="flex flex-col gap-1 px-4 pb-3"
        >
          {entries.map((entry) => {
            const color = getFormatColor(entry.format)
            return (
              <li
                key={entry.id}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--gem-muted)' }}
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color.accent }}
                  aria-hidden="true"
                  data-testid="activity-dot"
                />
                <span className="sr-only">{entry.format}</span>
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--gem-dim)' }}
                >
                  {entry.code}
                </span>
                <span>{getEventLabel(entry.event_type, entry.to_value)}</span>
                <span
                  className="ml-auto text-xs"
                  style={{ color: 'var(--gem-dim)' }}
                  data-testid="activity-time"
                >
                  {formatRelativeTime(entry.changed_at)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})
