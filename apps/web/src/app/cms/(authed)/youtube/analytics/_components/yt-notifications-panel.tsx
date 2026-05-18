'use client'

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

const PRIORITY_BORDER: Record<number, string> = {
  5: 'border-l-[#ef4444]',
  4: 'border-l-[#f59e0b]',
  3: 'border-l-[#60a5fa]',
  2: 'border-l-[#958A75]',
  1: 'border-l-[#958A75]',
}

export function YtNotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onDismiss }: Props) {
  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-cms-text-muted">Nenhuma notificação. Tudo em ordem!</p>
      </div>
    )
  }

  return (
    <div className="max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-cms-border px-3 py-2">
        <span className="text-xs font-medium text-cms-text">Notificações</span>
        <button onClick={onMarkAllRead} className="text-[10px] text-cms-accent hover:underline">
          Marcar tudo como lido
        </button>
      </div>
      <div className="divide-y divide-cms-border">
        {notifications.slice(0, 50).map(n => (
          <div
            key={n.id}
            onClick={() => { if (!n.read) onMarkRead(n.id) }}
            className={`group flex gap-2 border-l-2 ${PRIORITY_BORDER[n.priority] ?? ''} px-3 py-2.5 ${!n.read ? 'bg-cms-surface/50 cursor-pointer' : ''}`}
          >
            <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${n.read ? 'border border-cms-text-muted' : 'bg-cms-accent'}`} />
            <div className="min-w-0 flex-1">
              <p className={`text-xs ${n.read ? 'text-cms-text-muted' : 'font-medium text-cms-text'}`}>
                {n.title}
              </p>
              <p className="mt-0.5 text-[10px] text-cms-text-dim line-clamp-2">{n.message}</p>
              <p className="mt-0.5 text-[9px] text-cms-text-dim">
                {formatRelativeTime(n.created_at)}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(n.id) }}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-cms-text-muted hover:text-cms-text"
              aria-label="Dispensar"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}
