'use client'
import { useState } from 'react'
import { Bell } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useNotifications } from '@/lib/notifications/notification-context'

// Lazy load the popover
const NotificationPopover = dynamic(
  () => import('./notification-popover').then(m => ({ default: m.NotificationPopover })),
  { ssr: false }
)

export function NotificationBell() {
  const { state } = useNotifications()
  const [open, setOpen] = useState(false)
  const count = state.unreadCount
  const hasCritical = state.hasCritical

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notificações${count > 0 ? ` (${count} não lidas${hasCritical ? ', inclui críticas' : ''})` : ''}`}
        className={`
          relative grid place-items-center
          min-w-11 min-h-11 sm:min-w-9 sm:min-h-9
          rounded-[10px] bg-cms-surface border border-cms-border
          text-cms-text-muted transition-all duration-[120ms]
          hover:text-cms-text hover:bg-cms-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pb-accent)]
          ${open ? 'bg-cms-accent-subtle text-cms-accent border-transparent' : ''}
        `}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        {count > 0 && (
          <span
            key={count}
            className={`
              absolute max-sm:-top-0.5 max-sm:-right-0.5 sm:top-1.5 sm:right-1.5
              min-w-4 h-4 px-1 rounded-[10px]
              grid place-items-center
              text-[10px] font-bold tabular-nums
              border-2 border-cms-bg
              ${hasCritical ? 'bg-cms-red text-[var(--pb-ink-on-accent)]' : 'bg-cms-accent text-[var(--pb-ink-on-accent)]'}
            `}
          >
            {hasCritical ? '!' : ''}{count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && <NotificationPopover onClose={() => setOpen(false)} />}
    </div>
  )
}
