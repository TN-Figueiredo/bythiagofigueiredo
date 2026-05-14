interface TimelineEvent {
  type: string
  timestamp: string
  description: string
  platform?: string
  platformPostId?: string
  origin?: string
  code?: string
}

interface TimelineProps {
  events: TimelineEvent[]
}

const DOT_COLORS: Record<string, string> = {
  created: 'bg-purple-500',
  short_link: 'bg-blue-500',
  og_scrape: 'bg-blue-500',
  delivery: 'bg-emerald-500',
  failed: 'bg-red-500',
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative">
      <div className="absolute left-[7px] top-4 bottom-4 w-px border-l border-cms-border" />
      <div className="space-y-4">
        {events.map((event, i) => (
          <div key={i} data-testid="timeline-event" className="flex gap-3 relative">
            <div
              data-testid="timeline-dot"
              className={`h-4 w-4 rounded-full shrink-0 z-10 ${DOT_COLORS[event.type] ?? 'bg-cms-border'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-cms-text">{event.description}</p>
              <p className="text-[10px] text-cms-text-muted mt-0.5">
                {formatTimestamp(event.timestamp)}
                {event.origin && ` — Origem: ${event.origin}`}
                {event.code && ` — Codigo: ${event.code}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
