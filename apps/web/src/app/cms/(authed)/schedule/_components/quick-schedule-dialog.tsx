'use client'

import { useState } from 'react'

interface SchedulableItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string }

interface QuickScheduleDialogProps {
  item: SchedulableItem | null; slotDays?: string[]
  onSchedule: (item: SchedulableItem, date: string) => void; onClose: () => void
}

const SLOT_COLORS = {
  post: 'var(--cms-accent, #6366f1)',
  newsletter: 'var(--cms-green, #22c55e)',
  campaign: 'var(--cms-amber, #f59e0b)',
} as const
const TYPE_COLOR: Record<string, string> = { post: SLOT_COLORS.post, newsletter: SLOT_COLORS.newsletter, campaign: SLOT_COLORS.campaign }
const TYPE_LABEL: Record<string, string> = { post: 'Post', newsletter: 'Newsletter', campaign: 'Campaign' }

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function QuickScheduleDialog({ item, slotDays = [], onSchedule, onClose }: QuickScheduleDialogProps) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]!
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const slotSet = new Set(slotDays)
  const calDays = buildCalendarDays(calYear, calMonth)

  function prevMonth() { if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) } else { setCalMonth((m) => m - 1) } }
  function nextMonth() { if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) } else { setCalMonth((m) => m + 1) } }
  function dayToDateStr(day: number) { return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
  function isPast(day: number) { return dayToDateStr(day) < todayStr }

  if (!item) return null
  const typeColor = TYPE_COLOR[item.type] ?? 'var(--cms-text-muted, #71717a)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--cms-overlay, rgba(0,0,0,0.6))' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Schedule ${item.title}`}
        className="rounded-[12px] border shadow-2xl w-full max-w-[420px]"
        style={{ background: 'var(--cms-surface, #1a1d27)', borderColor: 'var(--cms-border, #2a2d3a)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--cms-border, #2a2d3a)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--cms-text, #e4e4e7)' }}>Schedule Item</p>
          <button type="button" onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:opacity-70 text-lg leading-none"
            style={{ color: 'var(--cms-text-dim, #52525b)' }} aria-label="Close">x</button>
        </div>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3 rounded-[8px] p-3 border"
            style={{ borderColor: typeColor, background: `color-mix(in srgb, ${typeColor} 8%, transparent)` }}>
            <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: typeColor }} />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: typeColor }}>{TYPE_LABEL[item.type]}</p>
              <p className="text-sm font-medium truncate" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{item.title}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--cms-text-muted, #71717a)' }}>Status: {item.status}</p>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded text-sm hover:opacity-70"
              style={{ color: 'var(--cms-text-muted)' }} aria-label="Previous month">&lsaquo;</button>
            <span className="text-[13px] font-medium" style={{ color: 'var(--cms-text, #e4e4e7)' }}>{MONTH_NAMES[calMonth]} {calYear}</span>
            <button type="button" onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded text-sm hover:opacity-70"
              style={{ color: 'var(--cms-text-muted)' }} aria-label="Next month">&rsaquo;</button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[10px]" style={{ color: 'var(--cms-text-dim, #52525b)' }}>{wd}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {calDays.map((day, idx) => {
              if (day === null) return <div key={`blank-${idx}`} />
              const dateStr = dayToDateStr(day); const past = isPast(day)
              const isToday = dateStr === todayStr; const isSlot = slotSet.has(dateStr); const isSelected = selectedDate === dateStr
              return (
                <button type="button" key={dateStr} onClick={() => !past && setSelectedDate(dateStr)} disabled={past}
                  className="relative flex flex-col items-center justify-center h-8 rounded-md text-xs font-medium transition-colors"
                  style={{ background: isSelected ? 'var(--cms-accent)' : isToday ? 'var(--cms-accent-subtle)' : 'transparent',
                    color: isSelected ? 'var(--cms-text-on-accent, #fff)' : past ? 'var(--cms-text-dim)' : isToday ? 'var(--cms-accent)' : 'var(--cms-text)',
                    cursor: past ? 'default' : 'pointer', opacity: past ? 0.35 : 1 }} aria-label={`Select ${dateStr}`}>
                  {day}
                  {isSlot && !isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--cms-green, #22c55e)' }} />
                  )}
                </button>
              )
            })}
          </div>
          {selectedDate && (
            <p className="text-[11px] mt-2 text-center"
              style={{ color: slotSet.has(selectedDate) ? 'var(--cms-green, #22c55e)' : 'var(--cms-text-muted, #71717a)' }}>
              {slotSet.has(selectedDate) ? 'Slot available on this day' : 'No cadence slot -- scheduling manually'}</p>
          )}
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-[8px] text-sm border"
            style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }}>Cancel</button>
          <button type="button" onClick={() => { if (selectedDate) { onSchedule(item, selectedDate); onClose() } }} disabled={!selectedDate}
            className="flex-1 py-2 rounded-[8px] text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: selectedDate ? 'var(--cms-accent)' : 'var(--cms-border)', color: 'var(--cms-text-on-accent, #fff)' }}>
            {selectedDate ? `Schedule for ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}` : 'Pick a date'}
          </button>
        </div>
      </div>
    </div>
  )
}
