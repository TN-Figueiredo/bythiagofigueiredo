interface AgendaItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string; date: string; locale?: string; isOverdue?: boolean }
interface AgendaEmptySlot { date: string; type: 'blog' | 'newsletter'; isOverdue: boolean }
interface AgendaViewProps { items: AgendaItem[]; emptySlots: AgendaEmptySlot[]; onItemClick?: (item: AgendaItem) => void; onSlotClick?: (slot: AgendaEmptySlot) => void }

const TYPE_ICONS: Record<string, string> = { post: '\u{1F4DD}', newsletter: '\u{1F4F0}', campaign: '\u{1F4E2}' }
const TYPE_COLORS: Record<string, string> = { post: 'var(--cms-accent, #6366f1)', newsletter: 'var(--cms-green, #22c55e)', campaign: 'var(--cms-amber, #f59e0b)' }
const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'var(--cms-amber, #f59e0b)' }, ready: { label: 'Ready', color: 'var(--cms-accent, #6366f1)' },
  queued: { label: 'Queued', color: 'var(--cms-purple, #8b5cf6)' }, scheduled: { label: 'Scheduled', color: 'var(--cms-cyan, #06b6d4)' },
  published: { label: 'Published', color: 'var(--cms-green, #22c55e)' }, sent: { label: 'Sent', color: 'var(--cms-green, #22c55e)' },
}

function groupByDate(items: AgendaItem[], slots: AgendaEmptySlot[]) {
  const map = new Map<string, { items: AgendaItem[]; slots: AgendaEmptySlot[] }>()
  const ensure = (date: string) => { if (!map.has(date)) map.set(date, { items: [], slots: [] }); return map.get(date)! }
  for (const item of items) ensure(item.date).items.push(item)
  for (const slot of slots) ensure(slot.date).slots.push(slot)
  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'; if (diffDays === 1) return 'Tomorrow'; if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function AgendaView({ items, emptySlots, onItemClick, onSlotClick }: AgendaViewProps) {
  const grouped = groupByDate(items, emptySlots)
  if (grouped.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="agenda-empty">
        <span className="text-4xl mb-3">{'\u{1F4C5}'}</span>
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--cms-text, #e4e4e7)' }}>No items scheduled</p>
        <p className="text-[12px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>Configure your cadence or assign backlog items to dates.</p>
      </div>
    )
  }
  return (
    <div className="space-y-6" data-testid="agenda-view">
      {[...grouped.entries()].map(([date, group]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cms-text-muted, #71717a)' }}>{formatDateHeader(date)}</span>
            <span className="text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{date}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--cms-border-subtle, #22252f)' }} />
          </div>
          <div className="space-y-2">
            {group.items.map((item) => {
              const badge = STATUS_BADGE[item.status]; const typeColor = TYPE_COLORS[item.type] ?? 'var(--cms-text-muted)'
              return (
                <button key={item.id} onClick={() => onItemClick?.(item)}
                  className="w-full text-left rounded-[10px] border p-3 flex items-start gap-3 transition-colors group"
                  style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: item.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-border, #2a2d3a)' }}>
                  <span className="text-xl leading-none shrink-0 mt-0.5">{TYPE_ICONS[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.locale && <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${typeColor} 12%, transparent)`, color: typeColor }}>{item.locale}</span>}
                      {badge && <span className="text-[10px]" style={{ color: badge.color }}>{badge.label}</span>}
                      {item.isOverdue && <span className="text-[10px] font-medium" style={{ color: 'var(--cms-red, #ef4444)' }}>Overdue</span>}
                    </div>
                  </div>
                  <span className="text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--cms-text-dim)' }}>&rsaquo;</span>
                </button>
              )
            })}
            {group.slots.map((slot, i) => (
              <button key={i} onClick={() => onSlotClick?.(slot)}
                className="w-full text-center rounded-[10px] border border-dashed py-3 px-4 text-[12px] transition-colors"
                style={{ borderColor: slot.isOverdue ? 'var(--cms-red)' : 'var(--cms-border)', color: slot.isOverdue ? 'var(--cms-red)' : 'var(--cms-text-dim)',
                  background: slot.isOverdue ? 'rgba(239,68,68,.05)' : 'transparent' }}>
                + Empty {slot.type} slot{slot.isOverdue && ' (overdue)'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
