'use client'

import { Fragment, useMemo } from 'react'

interface CalendarItem {
  id: string; title: string; type: 'post' | 'newsletter' | 'campaign'
  status: string; date: string; slot: number; sendTime?: string; subscriberCount?: number
}

interface EmptySlot { date: string; slot: number; type: 'blog' | 'newsletter'; isOverdue: boolean }

interface WeekViewProps {
  startDate: Date; items: CalendarItem[]; emptySlots: EmptySlot[]
  onItemClick: (item: CalendarItem) => void; onSlotClick: (slot: EmptySlot) => void
}

const SLOT_COLORS = {
  post: 'var(--cms-accent, #6366f1)',
  newsletter: 'var(--cms-green, #22c55e)',
  campaign: 'var(--cms-amber, #f59e0b)',
} as const

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  post: { bg: `color-mix(in srgb, ${SLOT_COLORS.post} 12%, transparent)`, text: SLOT_COLORS.post, border: SLOT_COLORS.post },
  newsletter: { bg: `color-mix(in srgb, ${SLOT_COLORS.newsletter} 12%, transparent)`, text: SLOT_COLORS.newsletter, border: SLOT_COLORS.newsletter },
  campaign: { bg: `color-mix(in srgb, ${SLOT_COLORS.campaign} 12%, transparent)`, text: SLOT_COLORS.campaign, border: SLOT_COLORS.campaign },
}
const TYPE_ICONS: Record<string, string> = { post: '\u{1F4DD}', newsletter: '\u{1F4F0}', campaign: '\u{1F4E2}' }

export function WeekView({ startDate, items, emptySlots, onItemClick, onSlotClick }: WeekViewProps) {
  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate); d.setDate(d.getDate() + i); return d
    }), [startDate])

  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  return (
    <div className="grid border rounded-[10px] overflow-hidden"
      style={{ gridTemplateColumns: '60px repeat(7, 1fr)', background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}>
      <div className="border-b" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }} />
      {days.map((d) => {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const isToday = dateStr === today
        return (
          <div key={dateStr} className="p-2 text-center border-b border-l" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }}>
            <div className="text-[11px] uppercase tracking-wide"
              style={{ color: isToday ? 'var(--cms-accent, #6366f1)' : 'var(--cms-text-dim, #52525b)' }}>
              {d.toLocaleDateString('en', { weekday: 'short' })}
            </div>
            <div className="mt-0.5 mx-auto flex items-center justify-center"
              style={{ width: 30, height: 30, borderRadius: isToday ? '50%' : undefined,
                background: isToday ? `var(--cms-accent-subtle, color-mix(in srgb, ${SLOT_COLORS.post} 12%, transparent))` : 'transparent',
                color: isToday ? 'var(--cms-accent, #6366f1)' : 'var(--cms-text, #e4e4e7)', fontWeight: 700, fontSize: 18 }}>
              {d.getDate()}
            </div>
          </div>
        )
      })}

      {([1, 2, 3] as const).map((slot) => (
        <Fragment key={slot}>
          <div className="px-2 py-1 text-[9px] text-right border-r border-b flex items-start justify-end h-20"
            style={{ borderColor: 'var(--cms-border, #2a2d3a)', color: 'var(--cms-text-dim, #52525b)' }}>
            Slot {slot}
          </div>
          {days.map((d) => {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const isToday = dateStr === today
            const cellItems = items.filter((it) => it.date === dateStr && it.slot === slot)
            const cellSlots = emptySlots.filter((s) => s.date === dateStr && s.slot === slot)
            return (
              <div key={`${dateStr}-${slot}`} className="border-l border-b p-1 h-20 overflow-hidden"
                style={{ borderColor: 'var(--cms-border, #2a2d3a)', background: isToday ? `color-mix(in srgb, ${SLOT_COLORS.post} 3%, transparent)` : 'transparent' }}>
                {cellItems.map((item) => {
                  const itemStyle = TYPE_STYLES[item.type] ?? TYPE_STYLES['post']!
                  const bg = itemStyle.bg; const text = itemStyle.text; const border = itemStyle.border
                  return (
                    <button type="button" key={item.id} onClick={() => onItemClick(item)}
                      className="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium mb-0.5 border-l-[3px] cursor-pointer transition-all hover:brightness-110"
                      style={{ background: bg, color: text, borderLeftColor: border,
                        opacity: item.status === 'draft' ? 0.6 : 1 }}>
                      {TYPE_ICONS[item.type]} {item.title}
                    </button>
                  )
                })}
                {cellSlots.map((s, i) => (
                  <button type="button" key={i} onClick={() => onSlotClick(s)}
                    className="w-full text-center px-2 py-1 rounded-md text-[10px] mb-0.5 border border-dashed cursor-pointer transition-colors"
                    style={{ borderColor: s.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-border, #2a2d3a)',
                      color: s.isOverdue ? 'var(--cms-red, #ef4444)' : 'var(--cms-text-dim, #52525b)',
                      background: s.isOverdue ? 'color-mix(in srgb, var(--cms-red, #ef4444) 6%, transparent)' : 'transparent' }}>
                    + Empty {s.type} slot
                  </button>
                ))}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
