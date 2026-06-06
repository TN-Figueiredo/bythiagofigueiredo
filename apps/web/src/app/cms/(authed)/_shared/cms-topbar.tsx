'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useNotifications } from '@/lib/notifications/notification-context'
import './cms-topbar.css'

const NotificationPopover = dynamic(
  () => import('./notification-popover').then(m => ({ default: m.NotificationPopover })),
  { ssr: false },
)

/**
 * Standalone notification bell + popover. Designed to be dropped into any
 * topbar's actions slot — including the package `<CmsTopbar actions={...}>`
 * from `@tn-figueiredo/cms-ui/client`. Self-contained styling is scoped under
 * `.cms-bell` in cms-topbar.css so it renders correctly outside `.cms-topbar`.
 */
export function NotificationBell() {
  const { state } = useNotifications()
  const [bellOpen, setBellOpen] = useState(false)
  const count = state.unreadCount
  const hasCritical = state.hasCritical

  return (
    <div className="cms-bell" style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setBellOpen(o => !o)}
        aria-expanded={bellOpen}
        aria-haspopup="dialog"
        aria-label={`Notificacoes${count > 0 ? `, ${count} nao lidas${hasCritical ? ', inclui criticas' : ''}` : ''}`}
        className={`icon-btn${bellOpen ? ' active' : ''}`}
      >
        <Bell size={18} strokeWidth={2} />
        {count > 0 && (
          <span className={`notif-dot${hasCritical ? ' crit' : ''}`}>
            {hasCritical ? '!' : ''}{count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {bellOpen && <NotificationPopover onClose={() => setBellOpen(false)} />}
    </div>
  )
}

/**
 * Legacy standalone bell bar rendered by the CMS layout. Kept for backwards
 * compatibility while pages are migrated to host the bell inside their own
 * titled package `<CmsTopbar>`. Once every page passes
 * `actions={<NotificationBell/>}`, the layout can drop this bar entirely.
 */
export function CmsTopbar() {
  return (
    <header className="cms-topbar">
      <div className="tb-title" />
      <div className="tb-actions">
        <NotificationBell />
      </div>
    </header>
  )
}
