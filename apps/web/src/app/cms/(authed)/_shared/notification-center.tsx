'use client'

import { useState, useEffect } from 'react'

type NotificationType = 'delivery_failed' | 'token_expiring' | 'ai_drafts_ready' | 'ab_test_complete' | 'published'

interface Notification {
  id: string
  type: NotificationType
  message: string
  read: boolean
  createdAt: string
  href: string
}

interface NotificationStrings {
  title: string
  markAllRead: string
  empty: string
}

interface NotificationCenterProps {
  notifications: Notification[]
  onMarkAllRead: () => void
  strings: NotificationStrings
}

const TYPE_COLORS: Record<NotificationType, string> = {
  delivery_failed: 'border-l-red-500',
  token_expiring: 'border-l-yellow-500',
  ai_drafts_ready: 'border-l-purple-500',
  ab_test_complete: 'border-l-green-500',
  published: 'border-l-gray-500',
}

const DEFAULT_STRINGS: NotificationStrings = { title: 'Notifications', markAllRead: 'Mark all read', empty: 'No notifications' }

export function NotificationCenter({ notifications, onMarkAllRead, strings = DEFAULT_STRINGS }: NotificationCenterProps) {
  const [open, setOpen] = useState(false)
  const unread = notifications.filter(n => !n.read).length

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative rounded-md p-2 text-cms-text-muted hover:text-cms-text"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-cms-border bg-cms-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-cms-border px-4 py-2">
            <span className="text-sm font-semibold text-cms-text">{strings.title}</span>
            {unread > 0 && (
              <button type="button" onClick={onMarkAllRead} className="text-xs text-cms-accent hover:underline">{strings.markAllRead}</button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-cms-text-muted">{strings.empty}</p>
            ) : (
              notifications.map(n => (
                <a
                  key={n.id}
                  href={n.href}
                  className={`block border-l-2 px-4 py-3 hover:bg-cms-surface-hover ${TYPE_COLORS[n.type]} ${n.read ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm text-cms-text">{n.message}</p>
                  <p className="text-xs text-cms-text-dim">{new Date(n.createdAt).toLocaleString()}</p>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
