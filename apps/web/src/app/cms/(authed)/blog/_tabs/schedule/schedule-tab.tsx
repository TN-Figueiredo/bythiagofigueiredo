'use client'

import { useRef, useState, useTransition } from 'react'
import { CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import type { ScheduleTabData, ReadyPost } from '../../_hub/hub-types'
import type { BlogHubStrings } from '../../_i18n/types'
import { HealthStrip } from '../../_shared/health-strip'
import { MonthCalendar } from './month-calendar'
import { CadenceCard } from './cadence-card'
import { EmptyState } from '../../_shared/empty-state'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { ScheduleModal } from '../editorial/schedule-modal'
import { updateBlogCadence, movePost } from '../../actions'

interface ScheduleTabProps {
  data: ScheduleTabData
  strings?: BlogHubStrings
  locale?: 'en' | 'pt-BR'
}

function PostPicker({
  posts,
  targetDate,
  onSelect,
  onClose,
  strings,
  anchorPos,
}: {
  posts: ReadyPost[]
  targetDate: string
  onSelect: (post: ReadyPost) => void
  onClose: () => void
  strings?: BlogHubStrings
  anchorPos: { x: number; y: number }
}) {
  const s = strings?.schedule
  const overlayRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-40"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        className="absolute z-50 w-64 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl"
        style={{
          top: Math.min(anchorPos.y, window.innerHeight - 260),
          left: Math.min(anchorPos.x, window.innerWidth - 280),
        }}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {s?.selectPost ?? 'Select a post to schedule'}
        </p>
        <p className="mb-2 text-[10px] text-gray-500">{targetDate}</p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelect(post)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-gray-200 hover:bg-gray-800"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: post.tagColor ?? '#6b7280' }}
              />
              <span className="truncate">{post.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ScheduleTab({ data, strings, locale = 'en' }: ScheduleTabProps) {
  const s = strings?.schedule
  const [, startTransition] = useTransition()

  // Post picker state
  const [pickerState, setPickerState] = useState<{
    date: string
    pos: { x: number; y: number }
  } | null>(null)

  // Schedule modal state
  const [scheduleTarget, setScheduleTarget] = useState<{
    post: ReadyPost
    date: string
  } | null>(null)

  const handleTogglePause = (loc: string, paused: boolean) => {
    startTransition(async () => {
      await updateBlogCadence(loc, { cadence_paused: paused })
    })
  }

  const handleDateClick = (date: string) => {
    if (data.readyPosts.length === 0) {
      toast.info(s?.noReadyPosts ?? 'No ready posts to schedule')
      return
    }
    // Get the click event coordinates from the most recent mouse event
    const event = window.event as MouseEvent | undefined
    const pos = event
      ? { x: event.clientX, y: event.clientY }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    setPickerState({ date, pos })
  }

  const handlePostSelected = (post: ReadyPost) => {
    if (!pickerState) return
    setScheduleTarget({ post, date: pickerState.date })
    setPickerState(null)
  }

  const handleScheduleConfirm = (scheduledFor: string) => {
    if (!scheduleTarget) return
    const { post } = scheduleTarget
    startTransition(async () => {
      const result = await movePost(post.id, 'scheduled', scheduledFor)
      if (result.ok) {
        toast.success(strings?.common?.moved ?? 'Moved')
      } else {
        toast.error(strings?.common?.couldntMove ?? "Couldn't move")
      }
    })
    setScheduleTarget(null)
  }

  if (data.cadenceConfigs.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-8 w-8" />}
        heading={strings?.empty.configCadence ?? 'Configure your publishing cadence'}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Schedule metrics">
        <HealthStrip
          metrics={[
            {
              label: s?.fillRate ?? 'Fill Rate',
              value: `${data.healthStrip.fillRate.toFixed(0)}%`,
            },
            {
              label: s?.next7Days ?? 'Next 7 Days',
              value: data.healthStrip.next7Days,
            },
            {
              label: s?.avgReadingTime ?? 'Avg Reading Time',
              value:
                data.healthStrip.avgReadingTime > 0
                  ? `${data.healthStrip.avgReadingTime.toFixed(1)} min`
                  : '—',
            },
            {
              label: s?.activeLocales ?? 'Active Locales',
              value: `${data.healthStrip.activeLocales}/${data.healthStrip.totalLocales}`,
            },
          ]}
        />
      </SectionErrorBoundary>

      <SectionErrorBoundary sectionName="Calendar">
        <MonthCalendar
          slots={data.calendarSlots}
          locale={locale}
          onDateClick={handleDateClick}
        />
      </SectionErrorBoundary>

      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          {s?.cadenceConfig ?? 'Cadence Config'}
        </h3>
        {data.cadenceConfigs.map((config) => (
          <CadenceCard
            key={config.locale}
            config={config}
            onTogglePause={handleTogglePause}
            strings={strings}
          />
        ))}
      </div>

      {/* Post picker popover */}
      {pickerState && (
        <PostPicker
          posts={data.readyPosts}
          targetDate={pickerState.date}
          onSelect={handlePostSelected}
          onClose={() => setPickerState(null)}
          strings={strings}
          anchorPos={pickerState.pos}
        />
      )}

      {/* Schedule modal */}
      <ScheduleModal
        isOpen={!!scheduleTarget}
        postTitle={scheduleTarget?.post.title ?? ''}
        defaultDate={scheduleTarget?.date}
        onConfirm={handleScheduleConfirm}
        onCancel={() => setScheduleTarget(null)}
        strings={strings}
      />
    </div>
  )
}
