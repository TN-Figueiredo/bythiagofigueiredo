'use client'

import { useState, useMemo } from 'react'
import { WeekView } from './week-view'
import { AgendaView } from './agenda-view'
import { BacklogPanel } from './backlog-panel'
import { QuickScheduleDialog } from './quick-schedule-dialog'

export interface BlogPostRow { id: string; slot_date: string | null; status: string
  blog_translations: Array<{ title: string; locale: string; reading_time_min?: number | null }> | null }
export interface NewsletterEditionRow { id: string; subject: string; status: string; scheduled_at: string | null
  newsletter_types: Array<{ name: string }> | { name: string } | null }
export interface BlogCadenceRow { id?: string; locale: string; cadence_days: number; preferred_send_time?: string | null; cadence_paused?: boolean | null }
interface ScheduleClientProps { posts: BlogPostRow[]; editions: NewsletterEditionRow[]; cadence: BlogCadenceRow[]; backlog: BlogPostRow[] }

type ViewMode = 'week' | 'agenda'
interface CalendarItem { id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string; date: string; slot: number; sendTime?: string }

function getWeekStart(d: Date) { const s = new Date(d); s.setHours(0,0,0,0); s.setDate(s.getDate() - s.getDay()); return s }
function isoDate(d: Date) { return d.toISOString().split('T')[0]! }

function buildCalendarItems(posts: BlogPostRow[], editions: NewsletterEditionRow[]): CalendarItem[] {
  const items: CalendarItem[] = []
  for (const p of posts) { if (!p.slot_date) continue; const t = p.blog_translations?.[0]
    items.push({ id: p.id, title: t?.title ?? 'Untitled', type: 'post', status: p.status, date: p.slot_date, slot: 1 }) }
  let si = 1
  for (const ed of editions) { const date = ed.scheduled_at?.split('T')[0]; if (!date) continue
    items.push({ id: ed.id, title: ed.subject ?? 'Newsletter', type: 'newsletter', status: ed.status, date, slot: (si % 3) + 1,
      sendTime: ed.scheduled_at ? new Date(ed.scheduled_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : undefined }); si++ }
  return items
}

export function ScheduleClient({ posts, editions, cadence, backlog }: ScheduleClientProps) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(today))
  const [dialogItem, setDialogItem] = useState<{ id: string; title: string; type: 'post' | 'newsletter' | 'campaign'; status: string } | null>(null)

  const weekEnd = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 6); return d }, [weekStart])
  const calendarItems = useMemo(() => buildCalendarItems(posts, editions), [posts, editions])
  const backlogItems = useMemo(() => backlog.map((p) => ({
    id: p.id, title: p.blog_translations?.[0]?.title ?? 'Untitled', type: 'post' as const, status: p.status, locale: p.blog_translations?.[0]?.locale })), [backlog])
  const cadenceRows = useMemo(() => cadence.map((c) => ({
    label: `Blog ${c.locale}`, schedule: `Every ${c.cadence_days}d${c.preferred_send_time ? ` @ ${c.preferred_send_time}` : ''}`,
    color: 'var(--cms-accent, #6366f1)' })), [cadence])
  const weekSummary = useMemo(() => {
    const weekDates = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return isoDate(d) })
    const wi = calendarItems.filter((it) => weekDates.includes(it.date))
    return [
      { label: 'Posts scheduled', value: wi.filter((it) => it.type === 'post').length, accent: 'var(--cms-accent)' },
      { label: 'Newsletters queued', value: wi.filter((it) => it.type === 'newsletter').length, accent: 'var(--cms-green)' },
      { label: 'Campaigns active', value: 0, accent: 'var(--cms-amber)' },
      { label: 'Empty slots', value: Math.max(0, 21 - wi.length), accent: 'var(--cms-text-dim)' },
      { label: 'Overdue', value: wi.filter((it) => it.date < isoDate(today) && it.status !== 'published' && it.status !== 'sent').length, accent: 'var(--cms-text-dim)' },
    ]
  }, [calendarItems, weekStart, today])
  const agendaItems = useMemo(() => calendarItems.map((it) => ({
    ...it, isOverdue: it.date < isoDate(today) && it.status !== 'published' && it.status !== 'sent' })), [calendarItems, today])
  const slotDays = useMemo(() => {
    const days: string[] = []
    for (let i = 0; i < 28; i++) { const d = new Date(today); d.setDate(d.getDate() + i)
      if (cadence.some((c) => c.cadence_days <= 7)) days.push(isoDate(d)) }
    return days
  }, [cadence, today])

  const weekRangeLabel = `${weekStart.toLocaleDateString('en', { month: 'short', day: 'numeric' })} -- ${weekEnd.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-[8px]" style={{ background: 'var(--cms-bg, #0f1117)' }}>
          {(['week', 'agenda'] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)} className="px-3 py-1 rounded-[6px] text-sm font-medium capitalize transition-colors"
              style={{ background: viewMode === v ? 'var(--cms-surface)' : 'transparent', color: viewMode === v ? 'var(--cms-text)' : 'var(--cms-text-muted)' }}>{v}</button>
          ))}
        </div>
        {viewMode === 'week' && (
          <div className="flex items-center gap-2">
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}
              className="w-7 h-7 flex items-center justify-center rounded-md border text-sm"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }} aria-label="Previous week">&lsaquo;</button>
            <span className="text-sm font-medium min-w-[200px] text-center" style={{ color: 'var(--cms-text)' }}>{weekRangeLabel}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}
              className="w-7 h-7 flex items-center justify-center rounded-md border text-sm"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }} aria-label="Next week">&rsaquo;</button>
            <button onClick={() => setWeekStart(getWeekStart(today))} className="px-2.5 py-1 text-[11px] rounded-md border"
              style={{ borderColor: 'var(--cms-border)', color: 'var(--cms-text-muted)' }}>Today</button>
          </div>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {[{ label: 'Post', color: 'var(--cms-accent)' }, { label: 'Newsletter', color: 'var(--cms-green)' }, { label: 'Campaign', color: 'var(--cms-amber)' }].map((l) => (
            <div key={l.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
              <span className="text-[11px]" style={{ color: 'var(--cms-text-dim)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-5">
        <div className="flex-1 min-w-0">
          {viewMode === 'week' ? (
            <WeekView startDate={weekStart} items={calendarItems} emptySlots={[]}
              onItemClick={(item) => setDialogItem({ id: item.id, title: item.title, type: item.type, status: item.status })} onSlotClick={() => {}} />
          ) : (
            <AgendaView items={agendaItems} emptySlots={[]}
              onItemClick={(item) => setDialogItem({ id: item.id, title: item.title, type: item.type, status: item.status })} />
          )}
        </div>
        <div className="hidden md:block w-[260px] shrink-0">
          <BacklogPanel items={backlogItems} cadence={cadenceRows} weekSummary={weekSummary}
            onScheduleItem={(item) => setDialogItem(item)} onEditCadence={() => { window.location.href = '/cms/newsletters/settings' }} />
        </div>
      </div>
      {dialogItem && (
        <QuickScheduleDialog item={dialogItem} slotDays={slotDays}
          onSchedule={(_item, _date) => { /* TODO: wire to server action */ }} onClose={() => setDialogItem(null)} />
      )}
    </div>
  )
}
