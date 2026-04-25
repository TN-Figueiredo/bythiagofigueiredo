'use client'

import {
  useState,
  useCallback,
  useEffect,
  useTransition,
  useMemo,
} from 'react'
import { scheduleItem, unslotItem, publishNow } from './actions'
import type { SchedulePost, ScheduleEdition } from './page'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type ViewMode = 'week' | 'agenda' | 'month'

interface ScheduleItemBase {
  id: string
  title: string
  status: string
  slot_date: string | null
  queue_position: number | null
  type: 'post' | 'newsletter'
  subtitle: string | null
}

interface UndoEntry {
  action: 'schedule' | 'unslot'
  id: string
  table: 'blog_posts' | 'newsletter_editions'
  previousSlotDate: string | null
  previousStatus: string
}

interface Props {
  scheduledPosts: SchedulePost[]
  backlogPosts: SchedulePost[]
  scheduledEditions: ScheduleEdition[]
  backlogEditions: ScheduleEdition[]
  today: string
  readOnly?: boolean
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const VIEW_OPTIONS: { id: ViewMode; label: string; key: string }[] = [
  { id: 'week', label: 'Week', key: '1' },
  { id: 'agenda', label: 'Agenda', key: '2' },
  { id: 'month', label: 'Month', key: '3' },
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TYPE_COLORS = {
  post: { bg: 'bg-blue-900/40', border: 'border-blue-700', text: 'text-blue-300', badge: 'bg-blue-800 text-blue-200' },
  newsletter: { bg: 'bg-emerald-900/40', border: 'border-emerald-700', text: 'text-emerald-300', badge: 'bg-emerald-800 text-emerald-200' },
  campaign: { bg: 'bg-purple-900/40', border: 'border-purple-700', text: 'text-purple-300', badge: 'bg-purple-800 text-purple-200' },
} as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]!
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function startOfWeek(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - r.getDay())
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function formatDateHeader(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function normalizeItems(
  posts: SchedulePost[],
  editions: ScheduleEdition[],
): ScheduleItemBase[] {
  const postItems: ScheduleItemBase[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    status: p.status,
    slot_date: p.slot_date,
    queue_position: p.queue_position,
    type: 'post',
    subtitle: p.author_name,
  }))
  const editionItems: ScheduleItemBase[] = editions.map((e) => ({
    id: e.id,
    title: e.subject,
    status: e.status,
    slot_date: e.slot_date,
    queue_position: e.queue_position,
    type: 'newsletter',
    subtitle: e.newsletter_type_name,
  }))
  return [...postItems, ...editionItems]
}

function groupByDate(
  items: ScheduleItemBase[],
): Map<string, ScheduleItemBase[]> {
  const map = new Map<string, ScheduleItemBase[]>()
  for (const item of items) {
    const key = item.slot_date ?? 'backlog'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function ReadOnlyBanner() {
  return (
    <div className="mb-4 rounded-md border border-amber-800/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
      You have read-only access. Contact an editor to schedule content.
    </div>
  )
}

function ItemCard({
  item,
  today,
  onUnslot,
  onPublish,
  onScheduleClick,
  readOnly,
  compact,
}: {
  item: ScheduleItemBase
  today: string
  onUnslot?: (item: ScheduleItemBase) => void
  onPublish?: (item: ScheduleItemBase) => void
  onScheduleClick?: (item: ScheduleItemBase) => void
  readOnly: boolean
  compact?: boolean
}) {
  const colors = TYPE_COLORS[item.type]
  const isOverdue = item.slot_date != null && item.slot_date < today && item.status !== 'published'

  return (
    <div
      className={`rounded-md border ${colors.border} ${colors.bg} ${
        compact ? 'px-2 py-1.5' : 'px-3 py-2'
      } ${isOverdue ? 'ring-1 ring-red-500/50' : ''}`}
      data-testid={`schedule-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`truncate font-medium ${colors.text} ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {item.title}
          </p>
          {item.subtitle && !compact && (
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {item.subtitle}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors.badge}`}
        >
          {item.type === 'post' ? 'Post' : 'NL'}
        </span>
      </div>
      {isOverdue && (
        <p className="mt-1 text-[10px] font-medium text-red-400">Overdue</p>
      )}
      {!readOnly && !compact && (
        <div className="mt-2 flex gap-1">
          {item.slot_date && onUnslot && (
            <button
              type="button"
              onClick={() => onUnslot(item)}
              className="rounded px-2 py-0.5 text-[10px] text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              data-testid={`unslot-${item.id}`}
            >
              Unslot
            </button>
          )}
          {!item.slot_date && onScheduleClick && (
            <button
              type="button"
              onClick={() => onScheduleClick(item)}
              className="rounded px-2 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-900/50 hover:text-indigo-300"
              data-testid={`quick-schedule-${item.id}`}
            >
              Schedule
            </button>
          )}
          {onPublish && (
            <button
              type="button"
              onClick={() => onPublish(item)}
              className="rounded px-2 py-0.5 text-[10px] text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300"
              data-testid={`publish-${item.id}`}
            >
              Publish
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function BusyDayBadge({ count }: { count: number }) {
  if (count < 2) return null
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-800/60 text-[10px] font-bold text-amber-300"
      title={`${count} items scheduled`}
      data-testid="busy-day-badge"
    >
      {count}
    </span>
  )
}

function UndoToast({
  visible,
  message,
  onUndo,
}: {
  visible: boolean
  message: string
  onUndo: () => void
}) {
  if (!visible) return null
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 shadow-xl"
      role="alert"
      data-testid="undo-toast"
    >
      <span className="text-sm text-slate-200">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="rounded-md bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-400"
      >
        Undo (Z)
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Week View                                                         */
/* ------------------------------------------------------------------ */

function WeekView({
  items,
  weekStart,
  today,
  onUnslot,
  onPublish,
  onDayCellClick,
  readOnly,
}: {
  items: Map<string, ScheduleItemBase[]>
  weekStart: Date
  today: string
  onUnslot: (item: ScheduleItemBase) => void
  onPublish: (item: ScheduleItemBase) => void
  onDayCellClick: (dateStr: string) => void
  readOnly: boolean
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700 bg-slate-700" data-testid="week-view">
      {days.map((day) => {
        const dateStr = toDateString(day)
        const dayItems = items.get(dateStr) ?? []
        const isToday = dateStr === today

        return (
          <div
            key={dateStr}
            className={`min-h-[140px] bg-[#0f172a] p-2 ${
              isToday ? 'ring-2 ring-inset ring-indigo-500/50' : ''
            }`}
            onClick={() => !readOnly && onDayCellClick(dateStr)}
            role="button"
            tabIndex={readOnly ? -1 : 0}
            aria-label={`Schedule on ${formatDateHeader(day)}`}
            onKeyDown={(e) => {
              if (!readOnly && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onDayCellClick(dateStr)
              }
            }}
            data-testid={`day-cell-${dateStr}`}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span
                className={`text-xs font-medium ${
                  isToday ? 'text-indigo-400' : 'text-slate-400'
                }`}
              >
                {WEEKDAY_LABELS[day.getDay()]}{' '}
                <span className={isToday ? 'text-indigo-300' : 'text-slate-300'}>
                  {day.getDate()}
                </span>
              </span>
              <BusyDayBadge count={dayItems.length} />
            </div>
            <div className="space-y-1">
              {dayItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  today={today}
                  onUnslot={onUnslot}
                  onPublish={onPublish}
                  readOnly={readOnly}
                  compact
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Agenda View                                                       */
/* ------------------------------------------------------------------ */

function AgendaView({
  items,
  today,
  onUnslot,
  onPublish,
  readOnly,
}: {
  items: ScheduleItemBase[]
  today: string
  onUnslot: (item: ScheduleItemBase) => void
  onPublish: (item: ScheduleItemBase) => void
  readOnly: boolean
}) {
  const grouped = useMemo(() => {
    const sorted = [...items]
      .filter((i) => i.slot_date)
      .sort((a, b) => (a.slot_date! < b.slot_date! ? -1 : 1))
    return groupByDate(sorted)
  }, [items])

  if (grouped.size === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500" data-testid="agenda-view">
        No scheduled items in this period.
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="agenda-view">
      {Array.from(grouped.entries()).map(([dateStr, dayItems]) => (
        <div key={dateStr}>
          <div className="mb-2 flex items-center gap-2">
            <h3
              className={`text-sm font-semibold ${
                dateStr === today ? 'text-indigo-400' : 'text-slate-300'
              }`}
            >
              {formatDateHeader(new Date(dateStr + 'T00:00:00'))}
            </h3>
            {dateStr === today && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                Today
              </span>
            )}
            <BusyDayBadge count={dayItems.length} />
          </div>
          <div className="space-y-2 pl-4">
            {dayItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                today={today}
                onUnslot={onUnslot}
                onPublish={onPublish}
                readOnly={readOnly}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Month View                                                        */
/* ------------------------------------------------------------------ */

function MonthView({
  items,
  currentMonth,
  today,
  onUnslot,
  onPublish,
  onDayCellClick,
  readOnly,
}: {
  items: Map<string, ScheduleItemBase[]>
  currentMonth: Date
  today: string
  onUnslot: (item: ScheduleItemBase) => void
  onPublish: (item: ScheduleItemBase) => void
  onDayCellClick: (dateStr: string) => void
  readOnly: boolean
}) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart)

  // Build 6 weeks of days to always fill the grid
  const totalDays = 42
  const days = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i))

  return (
    <div data-testid="month-view">
      {/* Weekday headers */}
      <div className="mb-1 grid grid-cols-7 gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-xs font-medium text-slate-500"
          >
            {label}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg border border-slate-700 bg-slate-700">
        {days.map((day) => {
          const dateStr = toDateString(day)
          const dayItems = items.get(dateStr) ?? []
          const isToday = dateStr === today
          const isCurrentMonth =
            day >= monthStart && day <= monthEnd

          return (
            <div
              key={dateStr}
              className={`min-h-[80px] p-1.5 ${
                isCurrentMonth ? 'bg-[#0f172a]' : 'bg-slate-900/50'
              } ${isToday ? 'ring-2 ring-inset ring-indigo-500/50' : ''}`}
              onClick={() => !readOnly && isCurrentMonth && onDayCellClick(dateStr)}
              role={isCurrentMonth ? 'button' : undefined}
              tabIndex={!readOnly && isCurrentMonth ? 0 : -1}
              aria-label={isCurrentMonth ? `Schedule on ${formatDateHeader(day)}` : undefined}
              onKeyDown={(e) => {
                if (!readOnly && isCurrentMonth && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onDayCellClick(dateStr)
                }
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-[10px] ${
                    !isCurrentMonth
                      ? 'text-slate-600'
                      : isToday
                        ? 'font-bold text-indigo-400'
                        : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>
                <BusyDayBadge count={dayItems.length} />
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((item) => {
                  const colors = TYPE_COLORS[item.type]
                  return (
                    <div
                      key={item.id}
                      className={`truncate rounded px-1 py-0.5 text-[9px] ${colors.bg} ${colors.text}`}
                      title={item.title}
                    >
                      {item.title}
                    </div>
                  )
                })}
                {dayItems.length > 3 && (
                  <span className="block text-[9px] text-slate-500">
                    +{dayItems.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Backlog Sidebar                                                   */
/* ------------------------------------------------------------------ */

function BacklogSidebar({
  items,
  today,
  onScheduleClick,
  onPublish,
  readOnly,
}: {
  items: ScheduleItemBase[]
  today: string
  onScheduleClick: (item: ScheduleItemBase) => void
  onPublish: (item: ScheduleItemBase) => void
  readOnly: boolean
}) {
  return (
    <aside
      className="w-64 shrink-0 overflow-y-auto border-r border-slate-700 bg-slate-900/50 p-4"
      aria-label="Backlog"
      data-testid="backlog-sidebar"
    >
      <h2 className="mb-3 text-sm font-semibold text-slate-300">
        Backlog
        {items.length > 0 && (
          <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-700 px-1.5 text-[10px] font-medium text-slate-400">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-600">
          No ready items. Move content to &quot;ready&quot; status to see it here.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              today={today}
              onScheduleClick={onScheduleClick}
              onPublish={onPublish}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/*  Quick-schedule modal                                              */
/* ------------------------------------------------------------------ */

function QuickScheduleModal({
  item,
  targetDate,
  onConfirm,
  onCancel,
  isPending,
}: {
  item: ScheduleItemBase
  targetDate: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
      data-testid="quick-schedule-modal"
    >
      <div
        className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-800 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-100">
          Schedule item
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Schedule{' '}
          <strong className="text-slate-200">{item.title}</strong> for{' '}
          <strong className="text-slate-200">
            {formatDateHeader(new Date(targetDate + 'T00:00:00'))}
          </strong>
          ?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          >
            {isPending && (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function ScheduleConnected({
  scheduledPosts,
  backlogPosts,
  scheduledEditions,
  backlogEditions,
  today,
  readOnly = false,
}: Props) {
  const [view, setView] = useState<ViewMode>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date(today + 'T00:00:00'))
  const [isPending, startTransition] = useTransition()

  // Local state mirrors to allow optimistic updates
  const [localScheduledPosts, setLocalScheduledPosts] = useState(scheduledPosts)
  const [localBacklogPosts, setLocalBacklogPosts] = useState(backlogPosts)
  const [localScheduledEditions, setLocalScheduledEditions] = useState(scheduledEditions)
  const [localBacklogEditions, setLocalBacklogEditions] = useState(backlogEditions)

  // Quick schedule state
  const [pendingSchedule, setPendingSchedule] = useState<{
    item: ScheduleItemBase
    targetDate: string
  } | null>(null)

  // Undo state
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)

  // Derived data
  const allScheduled = useMemo(
    () => normalizeItems(localScheduledPosts, localScheduledEditions),
    [localScheduledPosts, localScheduledEditions],
  )
  const allBacklog = useMemo(
    () => normalizeItems(localBacklogPosts, localBacklogEditions),
    [localBacklogPosts, localBacklogEditions],
  )
  const scheduledByDate = useMemo(() => groupByDate(allScheduled), [allScheduled])

  // Overdue count
  const overdueCount = useMemo(
    () =>
      allScheduled.filter(
        (i) => i.slot_date != null && i.slot_date < today && i.status !== 'published',
      ).length,
    [allScheduled, today],
  )

  // -- Navigation
  const goToday = useCallback(() => setAnchorDate(new Date(today + 'T00:00:00')), [today])
  const goPrev = useCallback(() => {
    setAnchorDate((d) =>
      view === 'month' ? new Date(d.getFullYear(), d.getMonth() - 1, 1) : addDays(d, -7),
    )
  }, [view])
  const goNext = useCallback(() => {
    setAnchorDate((d) =>
      view === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, 7),
    )
  }, [view])

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate])

  const periodLabel = useMemo(() => {
    if (view === 'month') return formatMonthYear(anchorDate)
    const end = addDays(weekStart, 6)
    return `${formatDateHeader(weekStart)} - ${formatDateHeader(end)}`
  }, [view, anchorDate, weekStart])

  // -- Item actions
  const tableForItem = useCallback(
    (item: ScheduleItemBase): 'blog_posts' | 'newsletter_editions' =>
      item.type === 'post' ? 'blog_posts' : 'newsletter_editions',
    [],
  )

  const handleUnslot = useCallback(
    (item: ScheduleItemBase) => {
      if (readOnly) return
      const table = tableForItem(item)
      setUndoEntry({
        action: 'unslot',
        id: item.id,
        table,
        previousSlotDate: item.slot_date,
        previousStatus: item.status,
      })
      setUndoVisible(true)

      // Optimistic: move from scheduled to backlog
      if (item.type === 'post') {
        setLocalScheduledPosts((prev) => prev.filter((p) => p.id !== item.id))
        const asPost: SchedulePost = {
          id: item.id,
          title: item.title,
          status: 'ready',
          slot_date: null,
          queue_position: null,
          published_at: null,
          author_name: item.subtitle,
        }
        setLocalBacklogPosts((prev) => [...prev, asPost])
      } else {
        setLocalScheduledEditions((prev) => prev.filter((e) => e.id !== item.id))
        const asEdition: ScheduleEdition = {
          id: item.id,
          subject: item.title,
          status: 'ready',
          slot_date: null,
          queue_position: null,
          scheduled_at: null,
          newsletter_type_name: item.subtitle,
        }
        setLocalBacklogEditions((prev) => [...prev, asEdition])
      }

      startTransition(async () => {
        await unslotItem({ id: item.id, table })
      })
    },
    [readOnly, tableForItem],
  )

  const handlePublish = useCallback(
    (item: ScheduleItemBase) => {
      if (readOnly) return
      const table = tableForItem(item)

      // Optimistic: remove from both lists
      if (item.type === 'post') {
        setLocalScheduledPosts((prev) => prev.filter((p) => p.id !== item.id))
        setLocalBacklogPosts((prev) => prev.filter((p) => p.id !== item.id))
      } else {
        setLocalScheduledEditions((prev) => prev.filter((e) => e.id !== item.id))
        setLocalBacklogEditions((prev) => prev.filter((e) => e.id !== item.id))
      }

      startTransition(async () => {
        await publishNow({ id: item.id, table })
      })
    },
    [readOnly, tableForItem],
  )

  // Day cell click → set pending schedule (first backlog item)
  const [selectedBacklogItem, setSelectedBacklogItem] =
    useState<ScheduleItemBase | null>(null)

  const handleDayCellClick = useCallback(
    (dateStr: string) => {
      if (readOnly) return
      const target = selectedBacklogItem ?? allBacklog[0]
      if (!target) return
      setPendingSchedule({ item: target, targetDate: dateStr })
    },
    [readOnly, selectedBacklogItem, allBacklog],
  )

  const handleBacklogItemScheduleClick = useCallback(
    (item: ScheduleItemBase) => {
      setSelectedBacklogItem(item)
      // If already a selected date or just mark item as selected for next day-cell click
    },
    [],
  )

  const confirmSchedule = useCallback(() => {
    if (!pendingSchedule || readOnly) return
    const { item, targetDate } = pendingSchedule
    const table = tableForItem(item)

    setUndoEntry({
      action: 'schedule',
      id: item.id,
      table,
      previousSlotDate: item.slot_date,
      previousStatus: item.status,
    })
    setUndoVisible(true)

    // Optimistic: move from backlog to scheduled
    if (item.type === 'post') {
      setLocalBacklogPosts((prev) => prev.filter((p) => p.id !== item.id))
      const asPost: SchedulePost = {
        id: item.id,
        title: item.title,
        status: 'queued',
        slot_date: targetDate,
        queue_position: null,
        published_at: null,
        author_name: item.subtitle,
      }
      setLocalScheduledPosts((prev) => [...prev, asPost])
    } else {
      setLocalBacklogEditions((prev) => prev.filter((e) => e.id !== item.id))
      const asEdition: ScheduleEdition = {
        id: item.id,
        subject: item.title,
        status: 'queued',
        slot_date: targetDate,
        queue_position: null,
        scheduled_at: null,
        newsletter_type_name: item.subtitle,
      }
      setLocalScheduledEditions((prev) => [...prev, asEdition])
    }

    setPendingSchedule(null)
    setSelectedBacklogItem(null)

    startTransition(async () => {
      await scheduleItem({ id: item.id, table, slotDate: targetDate })
    })
  }, [pendingSchedule, readOnly, tableForItem])

  // -- Undo
  const handleUndo = useCallback(() => {
    if (!undoEntry) return
    const { action, id, table, previousSlotDate, previousStatus } = undoEntry

    if (action === 'schedule') {
      // Undo a schedule → unslot it back
      startTransition(async () => {
        await unslotItem({ id, table })
      })
      // Optimistic: move back to backlog
      if (table === 'blog_posts') {
        setLocalScheduledPosts((prev) => prev.filter((p) => p.id !== id))
        const found = scheduledPosts.find((p) => p.id === id)
        if (found) {
          setLocalBacklogPosts((prev) => [
            ...prev,
            { ...found, status: 'ready', slot_date: null },
          ])
        }
      } else {
        setLocalScheduledEditions((prev) => prev.filter((e) => e.id !== id))
        const found = scheduledEditions.find((e) => e.id === id)
        if (found) {
          setLocalBacklogEditions((prev) => [
            ...prev,
            { ...found, status: 'ready', slot_date: null },
          ])
        }
      }
    } else {
      // Undo an unslot → re-schedule
      if (previousSlotDate) {
        startTransition(async () => {
          await scheduleItem({ id, table, slotDate: previousSlotDate })
        })
        if (table === 'blog_posts') {
          setLocalBacklogPosts((prev) => prev.filter((p) => p.id !== id))
          const found = backlogPosts.find((p) => p.id === id)
          if (found) {
            setLocalScheduledPosts((prev) => [
              ...prev,
              { ...found, status: previousStatus, slot_date: previousSlotDate },
            ])
          }
        } else {
          setLocalBacklogEditions((prev) => prev.filter((e) => e.id !== id))
          const found = backlogEditions.find((e) => e.id === id)
          if (found) {
            setLocalScheduledEditions((prev) => [
              ...prev,
              { ...found, status: previousStatus, slot_date: previousSlotDate },
            ])
          }
        }
      }
    }

    setUndoEntry(null)
    setUndoVisible(false)
  }, [
    undoEntry,
    scheduledPosts,
    scheduledEditions,
    backlogPosts,
    backlogEditions,
  ])

  // Undo toast auto-dismiss (5s)
  useEffect(() => {
    if (!undoVisible) return
    const timer = setTimeout(() => {
      setUndoVisible(false)
      setUndoEntry(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [undoVisible])

  // -- Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (isInput) return

      switch (e.key) {
        case '1':
          setView('week')
          break
        case '2':
          setView('agenda')
          break
        case '3':
          setView('month')
          break
        case 'ArrowLeft':
          e.preventDefault()
          goPrev()
          break
        case 'ArrowRight':
          e.preventDefault()
          goNext()
          break
        case 't':
        case 'T':
          goToday()
          break
        case 'z':
        case 'Z':
          if (undoVisible) {
            handleUndo()
          }
          break
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goPrev, goNext, goToday, undoVisible, handleUndo])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-[#0f172a]">
      {/* Backlog sidebar */}
      <BacklogSidebar
        items={allBacklog}
        today={today}
        onScheduleClick={handleBacklogItemScheduleClick}
        onPublish={handlePublish}
        readOnly={readOnly}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {readOnly && <ReadOnlyBanner />}

        {/* Topbar controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Period navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Previous period"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={goToday}
                className="rounded-md border border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                data-testid="today-button"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goNext}
                className="rounded-md border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                aria-label="Next period"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <h2 className="text-sm font-medium text-slate-200">{periodLabel}</h2>
            {overdueCount > 0 && (
              <span
                className="rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] font-medium text-red-400"
                data-testid="overdue-badge"
              >
                {overdueCount} overdue
              </span>
            )}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg border border-slate-700 p-0.5" role="group" aria-label="View mode">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setView(opt.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  view === opt.id
                    ? 'bg-indigo-500 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                aria-pressed={view === opt.id}
                data-testid={`view-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* View content */}
        {view === 'week' && (
          <WeekView
            items={scheduledByDate}
            weekStart={weekStart}
            today={today}
            onUnslot={handleUnslot}
            onPublish={handlePublish}
            onDayCellClick={handleDayCellClick}
            readOnly={readOnly}
          />
        )}
        {view === 'agenda' && (
          <AgendaView
            items={allScheduled}
            today={today}
            onUnslot={handleUnslot}
            onPublish={handlePublish}
            readOnly={readOnly}
          />
        )}
        {view === 'month' && (
          <MonthView
            items={scheduledByDate}
            currentMonth={anchorDate}
            today={today}
            onUnslot={handleUnslot}
            onPublish={handlePublish}
            onDayCellClick={handleDayCellClick}
            readOnly={readOnly}
          />
        )}
      </main>

      {/* Quick schedule modal */}
      {pendingSchedule && (
        <QuickScheduleModal
          item={pendingSchedule.item}
          targetDate={pendingSchedule.targetDate}
          onConfirm={confirmSchedule}
          onCancel={() => setPendingSchedule(null)}
          isPending={isPending}
        />
      )}

      {/* Undo toast */}
      <UndoToast
        visible={undoVisible}
        message={
          undoEntry?.action === 'schedule'
            ? 'Item scheduled'
            : 'Item unslotted'
        }
        onUndo={handleUndo}
      />
    </div>
  )
}
