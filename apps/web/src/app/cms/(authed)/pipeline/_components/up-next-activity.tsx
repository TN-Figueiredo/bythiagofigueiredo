'use client'

import { memo, useState } from 'react'
import { ChevronDown, CheckCheck, ArrowRight, Send, Edit } from 'lucide-react'
import { getFormatColor } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'

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

const EVENT_ICONS: Record<string, typeof CheckCheck> = {
  stage_change: CheckCheck,
  created: ArrowRight,
  archived: Edit,
  restored: ArrowRight,
  graduated: Send,
}

function getEventLabel(eventType: string, toValue: string | null): string {
  const fn = EVENT_LABELS[eventType]
  if (fn) return fn(toValue)
  return eventType
}

function formatActivityTime(dateStr: string): string {
  const then = new Date(dateStr)
  const now = new Date()

  // Same calendar day: show HH:MM
  const isSameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()

  if (isSameDay) {
    return then.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate()

  if (isYesterday) return 'ontem'

  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000)
  return `${days}d`
}

export const UpNextActivity = memo(function UpNextActivity({ entries }: UpNextActivityProps) {
  const [expanded, setExpanded] = useState(false)

  if (entries.length === 0) return null

  return (
    <section
      data-testid="activity-section"
      aria-label="Atividade recente"
      className="rounded-[10px]"
      style={{
        background: 'var(--gem-surface)',
        border: '1px solid var(--gem-border)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.6)',
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
          className="flex flex-col px-0 pb-0"
        >
          {entries.map((entry) => {
            const color = getFormatColor(entry.format)
            const EventIcon = EVENT_ICONS[entry.event_type] ?? ArrowRight
            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
                style={{
                  color: 'var(--gem-text)',
                  borderBottom: '1px solid var(--gem-border)',
                }}
              >
                <span
                  className="inline-flex items-center justify-center h-7 w-7 shrink-0 rounded-lg"
                  style={{
                    backgroundColor: gemMix(color.accent, 14),
                    color: color.accent,
                    border: `1px solid ${gemMix(color.accent, 20)}`,
                  }}
                  aria-hidden="true"
                  data-testid="activity-dot"
                >
                  <EventIcon size={13} />
                </span>
                <span className="sr-only">{entry.format}</span>
                <span className="flex-1 min-w-0 text-[13px]">
                  <span className="font-mono text-xs" style={{ color: 'var(--gem-dim)' }}>
                    {entry.code}
                  </span>
                  {' '}
                  <span style={{ color: 'var(--gem-muted)' }}>
                    {getEventLabel(entry.event_type, entry.to_value)}
                  </span>
                </span>
                <time
                  dateTime={entry.changed_at}
                  className="ml-auto text-xs font-mono shrink-0 tabular-nums"
                  style={{ color: 'var(--gem-dim)' }}
                  data-testid="activity-time"
                >
                  {formatActivityTime(entry.changed_at)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
})
