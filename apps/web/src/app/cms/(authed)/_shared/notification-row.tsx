'use client'

import { useCallback } from 'react'
import { Check, X, ChevronRight } from 'lucide-react'
import type { INotification, NotificationDomain } from '@/lib/notifications/types'
import { DOMAIN_META } from '@/lib/notifications/domain-colors'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotificationRowProps {
  notification: INotification
  onAction?: () => void
  onRead?: () => void
  onDismiss?: () => void
  showCheckbox?: boolean
  checked?: boolean
  onCheck?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Priority label for high/critical priorities */
function priorityLabel(p: INotification['priority']): string | null {
  if (p === 5) return 'Crítico'
  if (p === 4) return 'Alta'
  return null
}

/** Compact relative time (e.g. "2m", "3h", "5d") */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationRow({
  notification: n,
  onAction,
  onRead,
  onDismiss,
  showCheckbox = false,
  checked = false,
  onCheck,
}: NotificationRowProps) {
  const isRead = !!n.read_at
  const meta = DOMAIN_META[n.domain as NotificationDomain] ?? DOMAIN_META.system
  const Icon = meta.icon
  const pLabel = priorityLabel(n.priority)

  const handleAction = useCallback(() => {
    onAction?.()
  }, [onAction])

  return (
    <div
      className={`
        group relative flex gap-3 px-3 py-2.5
        border-l-[3px] transition-colors duration-100
        hover:bg-cms-surface-hover
        ${isRead ? 'bg-transparent' : 'bg-[var(--accent-soft)]'}
      `}
      style={{ borderLeftColor: meta.color }}
    >
      {/* Checkbox (inbox mode) */}
      {showCheckbox && (
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            aria-label={`Selecionar: ${n.title}`}
            className="h-4 w-4 rounded border-cms-border accent-cms-accent cursor-pointer"
          />
        </div>
      )}

      {/* Domain icon circle */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: meta.subtle,
          opacity: isRead ? 0.65 : 1,
        }}
      >
        <Icon
          className="h-4 w-4"
          style={{ color: meta.color }}
          strokeWidth={2}
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Title line */}
        <div className="flex items-center gap-1.5">
          {/* Unread dot */}
          {!isRead && (
            <span
              className="inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-cms-accent"
              aria-label="Não lida"
            />
          )}

          <span
            className={`
              truncate text-[13px] font-semibold text-cms-text
              ${isRead ? 'opacity-[0.72]' : ''}
            `}
          >
            {n.title}
          </span>

          {pLabel && (
            <span className="shrink-0 text-[10px] font-semibold text-cms-red">
              {pLabel}
            </span>
          )}

          <time
            dateTime={n.created_at}
            className="ml-auto shrink-0 font-mono text-[11px] text-cms-text-dim tabular-nums"
          >
            {relativeTime(n.created_at)}
          </time>
        </div>

        {/* Message */}
        {n.message && (
          <p
            className={`
              mt-0.5 line-clamp-2 text-[12px] text-cms-text-muted
              ${isRead ? 'opacity-[0.72]' : ''}
            `}
          >
            {n.message}
          </p>
        )}

        {/* Domain label + action row */}
        <div className="mt-1 flex items-center gap-2">
          <span
            className="text-[11px] font-medium"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>

          {/* Actions — reveal on hover, always visible on touch */}
          <div
            className="
              ml-auto flex items-center gap-1
              opacity-0 transition-opacity duration-100
              group-hover:opacity-100
              [@media(hover:none)]:opacity-100
            "
          >
            {/* Primary action */}
            {n.action_href && (
              <button
                type="button"
                onClick={handleAction}
                className="
                  flex items-center gap-0.5 rounded px-1.5 py-0.5
                  text-[11px] font-medium text-cms-accent
                  hover:bg-cms-accent-subtle transition-colors
                "
                aria-label={n.suggested_action ?? 'Abrir'}
              >
                {n.suggested_action ?? 'Abrir'}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {/* Mark read */}
            {onRead && (
              <button
                type="button"
                onClick={onRead}
                className="
                  grid place-items-center rounded p-1
                  text-cms-text-muted hover:text-cms-accent hover:bg-cms-accent-subtle
                  transition-colors
                "
                aria-label={isRead ? 'Marcar como não lida' : 'Marcar como lida'}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dismiss */}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="
                  grid place-items-center rounded p-1
                  text-cms-text-muted hover:text-cms-red hover:bg-cms-red-subtle
                  transition-colors
                "
                aria-label="Dispensar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
