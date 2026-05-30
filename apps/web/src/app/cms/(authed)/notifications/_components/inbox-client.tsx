'use client'

import {
  useState,
  useMemo,
  useCallback,
  useTransition,
  type ReactNode,
} from 'react'
import Link from 'next/link'
import {
  Settings,
  Check,
  X,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react'
import type {
  INotification,
  NotificationDomain,
} from '@/lib/notifications/types'
import {
  DOMAIN_META,
  DOMAIN_ORDER,
} from '@/lib/notifications/domain-colors'
import {
  markRead,
  markUnread,
  dismiss,
  markAllRead,
  bulkDismiss,
} from '@/lib/notifications/actions'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterValue = 'all' | 'unread' | NotificationDomain

interface TimeBucket {
  label: string
  items: INotification[]
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InboxClientProps {
  initialNotifications: INotification[]
  totalCount: number
  unreadCount: number
  domainCounts: Record<NotificationDomain, number>
  siteId: string
}

// ---------------------------------------------------------------------------
// Time bucket helper
// ---------------------------------------------------------------------------

function groupByTimeBucket(items: INotification[]): TimeBucket[] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)
  // ISO week: Monday-based
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(todayStart.getTime() - dayOfWeek * 86_400_000)

  const today: TimeBucket = { label: 'Hoje', items: [] }
  const yesterday: TimeBucket = { label: 'Ontem', items: [] }
  const thisWeek: TimeBucket = { label: 'Esta semana', items: [] }
  const older: TimeBucket = { label: 'Mais antigos', items: [] }

  for (const item of items) {
    const d = new Date(item.created_at)
    if (d >= todayStart) {
      today.items.push(item)
    } else if (d >= yesterdayStart) {
      yesterday.items.push(item)
    } else if (d >= weekStart) {
      thisWeek.items.push(item)
    } else {
      older.items.push(item)
    }
  }

  return [today, yesterday, thisWeek, older].filter((b) => b.items.length > 0)
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}sem`
}

// ---------------------------------------------------------------------------
// Priority label
// ---------------------------------------------------------------------------

function priorityLabel(priority: number): string | null {
  if (priority >= 5) return 'Critico'
  if (priority >= 4) return 'Alta'
  return null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InboxClient({
  initialNotifications,
  totalCount,
  unreadCount: initialUnreadCount,
  domainCounts,
  siteId,
}: InboxClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all')
  const [isPending, startTransition] = useTransition()
  const [localUnread, setLocalUnread] = useState(initialUnreadCount)

  // ------------------------------------------------------------------
  // Filtering
  // ------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return notifications
    if (activeFilter === 'unread') {
      return notifications.filter((n) => !n.read_at)
    }
    return notifications.filter((n) => n.domain === activeFilter)
  }, [notifications, activeFilter])

  const buckets = useMemo(() => groupByTimeBucket(filteredItems), [filteredItems])

  // ------------------------------------------------------------------
  // Filters config
  // ------------------------------------------------------------------

  const filters = useMemo(() => {
    const base: Array<{ value: FilterValue; label: string; count?: number }> = [
      { value: 'all', label: 'Todas' },
      { value: 'unread', label: 'Nao lidas', count: localUnread },
    ]

    for (const domain of DOMAIN_ORDER) {
      const count = domainCounts[domain]
      if (count > 0) {
        base.push({
          value: domain,
          label: DOMAIN_META[domain].label,
          count,
        })
      }
    }

    return base
  }, [domainCounts, localUnread])

  // ------------------------------------------------------------------
  // Selection helpers
  // ------------------------------------------------------------------

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
  }, [])

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.read_at ? n : { ...n, read_at: new Date().toISOString() },
        ),
      )
      setLocalUnread(0)
      await markAllRead(siteId)
    })
  }, [siteId])

  const handleMarkRead = useCallback((id: string) => {
    startTransition(async () => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
        ),
      )
      setLocalUnread((c) => Math.max(0, c - 1))
      await markRead(id)
    })
  }, [])

  const handleMarkUnread = useCallback((id: string) => {
    startTransition(async () => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: null } : n,
        ),
      )
      setLocalUnread((c) => c + 1)
      await markUnread(id)
    })
  }, [])

  const handleDismiss = useCallback((id: string) => {
    startTransition(async () => {
      const target = notifications.find((n) => n.id === id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      if (target && !target.read_at) {
        setLocalUnread((c) => Math.max(0, c - 1))
      }
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await dismiss(id)
    })
  }, [notifications])

  const handleBulkMarkRead = useCallback(() => {
    const ids = Array.from(selected)
    startTransition(async () => {
      let unreadDelta = 0
      setNotifications((prev) =>
        prev.map((n) => {
          if (ids.includes(n.id) && !n.read_at) {
            unreadDelta++
            return { ...n, read_at: new Date().toISOString() }
          }
          return n
        }),
      )
      setLocalUnread((c) => Math.max(0, c - unreadDelta))
      setSelected(new Set())
      await Promise.all(ids.map((id) => markRead(id)))
    })
  }, [selected])

  const handleBulkDismiss = useCallback(() => {
    const ids = Array.from(selected)
    startTransition(async () => {
      const idsSet = new Set(ids)
      let unreadDelta = 0
      setNotifications((prev) => {
        const kept: INotification[] = []
        for (const n of prev) {
          if (idsSet.has(n.id)) {
            if (!n.read_at) unreadDelta++
          } else {
            kept.push(n)
          }
        }
        return kept
      })
      setLocalUnread((c) => Math.max(0, c - unreadDelta))
      setSelected(new Set())
      await bulkDismiss(ids)
    })
  }, [selected])

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------

  if (notifications.length === 0) {
    return (
      <div className="mx-auto max-w-[900px] p-6">
        <InboxHeader
          unreadCount={0}
          totalCount={0}
          onMarkAllRead={handleMarkAllRead}
        />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 text-5xl">&#x1f389;</div>
          <h2 className="text-lg font-semibold text-cms-text mb-1">
            Voce esta em dia
          </h2>
          <p className="text-sm text-cms-text-muted max-w-sm">
            Nenhuma notificacao por enquanto. Quando algo acontecer, voce vera aqui.
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[900px] p-6">
      {/* Header */}
      <InboxHeader
        unreadCount={localUnread}
        totalCount={totalCount}
        onMarkAllRead={handleMarkAllRead}
      />

      {/* Filter chips */}
      <div
        role="radiogroup"
        aria-label="Filtrar notificacoes"
        className="flex flex-wrap gap-2 mb-6"
      >
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={activeFilter === f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              transition-colors duration-100 border
              ${
                activeFilter === f.value
                  ? 'bg-cms-accent text-[var(--pb-ink-on-accent)] border-cms-accent'
                  : 'bg-cms-surface text-cms-text-muted border-cms-border hover:bg-cms-surface-hover hover:text-cms-text'
              }
            `}
          >
            {/* Domain color dot */}
            {f.value !== 'all' && f.value !== 'unread' && (
              <span
                className="inline-block h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: DOMAIN_META[f.value as NotificationDomain].color }}
              />
            )}
            {f.label}
            {typeof f.count === 'number' && f.count > 0 && (
              <span className="tabular-nums opacity-70">{f.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Acoes em lote"
          className="sticky top-0 z-10 flex items-center gap-3 mb-4 px-4 py-3
                     bg-cms-surface border border-cms-border rounded-[10px]
                     border-l-[3px] border-l-cms-accent"
        >
          <span
            aria-live="polite"
            className="text-sm font-medium text-cms-text tabular-nums"
          >
            {selected.size} selecionada{selected.size > 1 ? 's' : ''}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleBulkMarkRead}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cms-text-muted
                       hover:text-cms-text transition-colors px-2 py-1 rounded-md
                       hover:bg-cms-surface-hover"
          >
            <Eye className="h-3.5 w-3.5" />
            Marcar lidas
          </button>
          <button
            type="button"
            onClick={handleBulkDismiss}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cms-red
                       hover:text-cms-red/80 transition-colors px-2 py-1 rounded-md
                       hover:bg-cms-surface-hover"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Dispensar
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cms-text-muted
                       hover:text-cms-text transition-colors px-2 py-1 rounded-md
                       hover:bg-cms-surface-hover"
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      )}

      {/* Notification list grouped by time */}
      {filteredItems.length === 0 ? (
        <div className="py-16 text-center text-sm text-cms-text-muted">
          Nenhuma notificacao neste filtro.
        </div>
      ) : (
        <div className="space-y-0">
          {buckets.map((bucket) => (
            <TimeBucketGroup key={bucket.label} label={bucket.label}>
              {bucket.items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  isSelected={selected.has(n.id)}
                  onToggleSelect={() => toggleSelect(n.id)}
                  onMarkRead={() => handleMarkRead(n.id)}
                  onMarkUnread={() => handleMarkUnread(n.id)}
                  onDismiss={() => handleDismiss(n.id)}
                />
              ))}
            </TimeBucketGroup>
          ))}
        </div>
      )}

      {/* Load more */}
      {notifications.length < totalCount && (
        <div className="mt-6 text-center">
          <button
            type="button"
            disabled
            className="px-4 py-2 text-sm font-medium text-cms-accent rounded-[10px]
                       border border-cms-border hover:bg-cms-surface-hover
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Carregar mais
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InboxHeader({
  unreadCount,
  totalCount,
  onMarkAllRead,
}: {
  unreadCount: number
  totalCount: number
  onMarkAllRead: () => void
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-lg font-semibold text-cms-text">
          Caixa de notificacoes
        </h1>
        <p className="text-sm text-cms-text-muted mt-0.5 tabular-nums">
          {unreadCount} nao lida{unreadCount !== 1 ? 's' : ''} &middot;{' '}
          {totalCount} no total
        </p>
      </div>
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                       rounded-[10px] bg-cms-accent text-[var(--pb-ink-on-accent)]
                       hover:bg-[var(--pb-accent-hover)] transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Marcar todas lidas
          </button>
        )}
        <Link
          href="/cms/settings/notifications"
          aria-label="Preferencias de notificacao"
          className="grid place-items-center min-w-11 min-h-11 sm:min-w-9 sm:min-h-9
                     rounded-[10px] bg-cms-surface border border-cms-border
                     text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover
                     transition-colors"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function TimeBucketGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const headingId = `bucket-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div role="group" aria-labelledby={headingId} className="mb-2">
      <div className="border-t border-cms-border pt-4 pb-2">
        <h2
          id={headingId}
          className="text-[11px] font-semibold uppercase tracking-[1px] text-cms-text-dim"
        >
          {label}
        </h2>
      </div>
      <div>{children}</div>
    </div>
  )
}

function NotificationRow({
  notification: n,
  isSelected,
  onToggleSelect,
  onMarkRead,
  onMarkUnread,
  onDismiss,
}: {
  notification: INotification
  isSelected: boolean
  onToggleSelect: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onDismiss: () => void
}) {
  const meta = DOMAIN_META[n.domain]
  const Icon = meta.icon
  const isUnread = !n.read_at
  const pLabel = priorityLabel(n.priority)

  return (
    <div
      className={`
        group relative flex items-start gap-3 px-3 py-3 rounded-[10px]
        transition-colors duration-100
        ${isUnread ? 'bg-[var(--pb-accent-soft,rgba(251,122,82,.06))]' : ''}
        ${isSelected ? 'bg-cms-accent-subtle' : ''}
        hover:bg-cms-surface-hover
      `}
      style={{
        borderLeft: `3px solid ${meta.color}`,
      }}
    >
      {/* Checkbox */}
      <div className="shrink-0 pt-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Selecionar notificacao: ${n.title}`}
          onClick={onToggleSelect}
          className={`
            grid place-items-center h-5 w-5 rounded border transition-colors
            min-h-11 min-w-11 sm:min-h-5 sm:min-w-5
            ${
              isSelected
                ? 'bg-cms-accent border-cms-accent text-[var(--pb-ink-on-accent)]'
                : 'border-cms-border bg-cms-surface hover:border-cms-text-dim'
            }
          `}
        >
          {isSelected && <Check className="h-3 w-3" />}
        </button>
      </div>

      {/* Domain icon */}
      <div
        className="shrink-0 grid place-items-center h-8 w-8 rounded-full"
        style={{
          backgroundColor: meta.subtle,
          color: meta.color,
          opacity: isUnread ? 1 : 0.65,
        }}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Unread dot */}
          {isUnread && (
            <span
              className="inline-block h-[7px] w-[7px] rounded-full bg-cms-accent shrink-0"
              aria-hidden="true"
            />
          )}
          <span
            className={`text-[13px] font-semibold text-cms-text truncate ${
              isUnread ? '' : 'opacity-[.72]'
            }`}
          >
            {n.title}
          </span>
          {pLabel && (
            <span className="text-[10px] font-bold text-cms-red shrink-0">
              {pLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {n.message && (
            <span
              className={`text-xs text-cms-text-muted truncate ${
                isUnread ? '' : 'opacity-[.72]'
              }`}
            >
              {n.message}
            </span>
          )}
          <span
            className="text-[10px] font-medium shrink-0"
            style={{ color: meta.color }}
          >
            {meta.label}
          </span>
          <span className="text-[11px] tabular-nums text-cms-text-dim font-mono shrink-0">
            {relativeTime(n.created_at)}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="shrink-0 flex items-center gap-1
                    opacity-0 group-hover:opacity-100
                    max-sm:opacity-100
                    transition-opacity"
      >
        {isUnread ? (
          <button
            type="button"
            onClick={onMarkRead}
            aria-label="Marcar como lida"
            className="grid place-items-center h-7 w-7 rounded-md
                       text-cms-text-dim hover:text-cms-text hover:bg-cms-surface
                       transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMarkUnread}
            aria-label="Marcar como nao lida"
            className="grid place-items-center h-7 w-7 rounded-md
                       text-cms-text-dim hover:text-cms-text hover:bg-cms-surface
                       transition-colors"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          className="grid place-items-center h-7 w-7 rounded-md
                     text-cms-text-dim hover:text-cms-red hover:bg-cms-surface
                     transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
