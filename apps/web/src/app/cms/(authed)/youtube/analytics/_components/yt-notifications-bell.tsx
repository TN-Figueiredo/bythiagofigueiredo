'use client'

import { useState, useEffect, useCallback } from 'react'
import { YtNotificationsPanel } from './yt-notifications-panel'

interface Notification {
  id: string
  type: string
  priority: number
  title: string
  message: string
  read: boolean
  action_href: string | null
  created_at: string
}

interface Props {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDismiss: (id: string) => void
}

export function YtNotificationsBell({ notifications, onMarkRead, onMarkAllRead, onDismiss }: Props) {
  const [open, setOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length
  const hasCritical = notifications.some(n => !n.read && n.priority >= 4)

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    if (open) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleEscape])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded p-1.5 hover:bg-cms-surface"
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <svg className="h-5 w-5 text-cms-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${hasCritical ? 'motion-safe:animate-pulse bg-[#ef4444]' : 'bg-cms-accent'}`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" role="presentation" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded border border-cms-border bg-cms-bg shadow-lg" role="dialog" aria-label="Painel de notificações">
            <YtNotificationsPanel
              notifications={notifications}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onDismiss={onDismiss}
            />
          </div>
        </>
      )}
    </div>
  )
}
