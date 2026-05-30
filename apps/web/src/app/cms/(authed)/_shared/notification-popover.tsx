'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Settings, CheckCheck, X, ChevronRight } from 'lucide-react'
import { markRead, dismiss, markAllRead } from '@/lib/notifications/actions'
import { useNotifications } from '@/lib/notifications/notification-context'
import type { NotificationDomain } from '@/lib/notifications/types'
import { NotificationRow } from './notification-row'

// ---------------------------------------------------------------------------
// Filter chip definitions
// ---------------------------------------------------------------------------

type FilterKey = 'all' | 'unread' | NotificationDomain

interface FilterChip {
  key: FilterKey
  label: string
}

const FILTER_CHIPS: FilterChip[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'newsletter', label: 'NL' },
  { key: 'social', label: 'Social' },
  { key: 'links', label: 'Links' },
  { key: 'system', label: 'Sistema' },
]

const MAX_ITEMS = 8

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPopover({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useNotifications()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const chipGroupRef = useRef<HTMLDivElement>(null)

  // ---- Close on Escape ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ---- Close on click outside ----
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Use a timeout so the opening click doesn't immediately close
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  // ---- Roving tabindex for filter chips ----
  const handleChipKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      let next = idx
      if (e.key === 'ArrowRight') next = (idx + 1) % FILTER_CHIPS.length
      else if (e.key === 'ArrowLeft') next = (idx - 1 + FILTER_CHIPS.length) % FILTER_CHIPS.length
      else return
      e.preventDefault()
      const group = chipGroupRef.current
      if (!group) return
      const buttons = group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      buttons[next]?.focus()
      const chip = FILTER_CHIPS[next]
      if (chip) setActiveFilter(chip.key)
    },
    [],
  )

  // ---- Filter items ----
  const visibleItems = state.items.filter((n) => {
    if (n.dismissed_at) return false
    if (activeFilter === 'all') return true
    if (activeFilter === 'unread') return !n.read_at
    return n.domain === activeFilter
  })

  const shownItems = visibleItems.slice(0, MAX_ITEMS)
  const totalVisible = visibleItems.length
  const unreadCount = state.unreadCount

  // ---- Handlers ----
  const handleMarkAllRead = useCallback(async () => {
    dispatch({ type: 'MARK_ALL_READ' })
    // Use a dummy siteId — the action will scope by the user's auth context
    const firstItem = state.items[0]
    if (firstItem) {
      await markAllRead(firstItem.site_id)
    }
  }, [dispatch, state.items])

  const handleMarkRead = useCallback(
    async (id: string) => {
      dispatch({ type: 'MARK_READ', id })
      await markRead(id)
    },
    [dispatch],
  )

  const handleDismiss = useCallback(
    async (id: string) => {
      const item = state.items.find((n) => n.id === id)
      dispatch({ type: 'DISMISS', id })
      // Delay the server action to allow undo (5s), but for now commit immediately
      await dismiss(id)
      // TODO: implement undo toast with REVERT_DISMISS
      void item
    },
    [dispatch, state.items],
  )

  const handleAction = useCallback(
    (id: string, href: string | null) => {
      if (!href) return
      // Mark as read optimistically
      dispatch({ type: 'MARK_READ', id })
      markRead(id)
      // Navigate
      window.location.href = href
    },
    [dispatch],
  )

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Notificações"
      className="
        fixed top-14 right-4 z-[70]
        w-[408px] max-w-[calc(100vw-2rem)] max-h-[min(640px,80vh)]
        flex flex-col
        bg-[var(--elev,var(--color-cms-surface))] border border-[var(--border-strong,var(--color-cms-border))]
        rounded-[10px] shadow-lg
        motion-safe:animate-[popoverEnter_220ms_ease-out]
        overflow-hidden
      "
    >
      {/* ---- Header ---- */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cms-border">
        <h2 className="text-sm font-semibold text-cms-text">Notificações</h2>

        {unreadCount > 0 && (
          <span className="inline-flex items-center h-5 px-1.5 rounded-full bg-cms-accent text-[11px] font-bold text-[var(--pb-ink-on-accent)] tabular-nums">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="
                flex items-center gap-1 rounded-md px-2 py-1
                text-[12px] font-medium text-cms-accent
                hover:bg-cms-accent-subtle transition-colors
                min-h-[44px] sm:min-h-0
              "
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </button>
          )}

          <Link
            href="/cms/settings/notifications"
            onClick={onClose}
            className="
              grid place-items-center rounded-md
              min-w-11 min-h-11 sm:min-w-8 sm:min-h-8
              text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover
              transition-colors
            "
            aria-label="Configurações de notificações"
          >
            <Settings className="h-4 w-4" />
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="
              grid place-items-center rounded-md
              min-w-11 min-h-11 sm:min-w-8 sm:min-h-8
              text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover
              transition-colors
            "
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ---- Filter chips ---- */}
      <div
        ref={chipGroupRef}
        role="radiogroup"
        aria-label="Filtrar notificações"
        className="flex items-center gap-1 px-4 py-2 border-b border-cms-border overflow-x-auto scrollbar-none"
      >
        {FILTER_CHIPS.map((chip, idx) => {
          const active = activeFilter === chip.key
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setActiveFilter(chip.key)}
              onKeyDown={(e) => handleChipKeyDown(e, idx)}
              className={`
                shrink-0 rounded-full px-2.5 py-1
                text-[12px] font-medium transition-colors whitespace-nowrap
                ${
                  active
                    ? 'bg-cms-accent text-[var(--pb-ink-on-accent)]'
                    : 'bg-cms-surface text-cms-text-muted hover:text-cms-text hover:bg-cms-surface-hover'
                }
              `}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* ---- Notification list ---- */}
      <div className="flex-1 overflow-y-auto">
        {shownItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <p className="text-sm text-cms-text-muted">
              {activeFilter === 'unread'
                ? 'Nenhuma notificação não lida'
                : activeFilter !== 'all'
                  ? `Nenhuma notificação de ${FILTER_CHIPS.find((c) => c.key === activeFilter)?.label ?? activeFilter}`
                  : 'Nenhuma notificação'}
            </p>
          </div>
        ) : (
          shownItems.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onAction={() => handleAction(n.id, n.action_href)}
              onRead={() => handleMarkRead(n.id)}
              onDismiss={() => handleDismiss(n.id)}
            />
          ))
        )}
      </div>

      {/* ---- Footer ---- */}
      <div className="border-t border-cms-border px-4 py-2.5">
        <Link
          href="/cms/notifications"
          onClick={onClose}
          className="
            flex items-center justify-center gap-1
            text-[13px] font-medium text-cms-accent
            hover:underline underline-offset-2
          "
        >
          {totalVisible > MAX_ITEMS
            ? `Ver todas as ${totalVisible} notificações`
            : 'Ver todas as notificações'}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
