'use client'

import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react'
import Link from 'next/link'
import { Calendar, RefreshCw } from 'lucide-react'
import { FORMAT_COLORS } from '@/lib/pipeline/colors'
import { gemMix } from '@/lib/pipeline/gem-design'
import { DAY_LABELS, DEFAULT_WIP_LIMITS, getWipStatus } from '@/lib/pipeline/up-next-constants'
import type { WeekSlot, SlotCandidate, ModeInference } from '@/lib/pipeline/up-next-types'
import dynamic from 'next/dynamic'

// Lazy-loaded: only needed when the picker is open
const LazyWeekSlotPicker = dynamic(
  () => import('./week-slot-picker').then(m => ({ default: m.WeekSlotPicker })),
  { ssr: false }
)

const FORMAT_LABELS: Record<string, string> = {
  video: 'Video',
  blog_post: 'Blog',
  newsletter: 'News',
}

const LOCALE_FLAG: Record<string, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  'pt-br': '🇧🇷',
}

const STAGE_SHORT: Record<string, string> = {
  idea: 'ideia',
  outline: 'roteiro',
  draft: 'rascunho',
  roteiro: 'roteiro',
  gravacao: 'gravação',
  edicao: 'edição',
  pos_producao: 'pós',
  ready: 'pronto',
  scheduled: 'agendado',
  published: 'publicado',
}

export interface WeekGridProps {
  slots: WeekSlot[]
  todayDate: string
  stageCounts: Record<string, number>
  totalEffortMinutes: number
  streak: { currentStreak: number; isActive: boolean }
  nextWeekEmpty: number
  backlogCount: number
  candidates?: SlotCandidate[]
  onAssignSlot?: (itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string) => Promise<void>
  selectedItem?: SlotCandidate | null
  onItemAssigned?: () => void
  gridRef?: React.RefObject<HTMLElement | null>
  modeInference?: ModeInference | null
}

function groupSlotsByDay(slots: WeekSlot[]): Map<string, WeekSlot[]> {
  const map = new Map<string, WeekSlot[]>()
  for (const slot of slots) {
    const group = map.get(slot.day)
    if (group) group.push(slot)
    else map.set(slot.day, [slot])
  }
  return map
}

interface SlotChipProps {
  slot: WeekSlot
  onEmptyClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  onSwapClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  selectedItem?: SlotCandidate | null
  onDirectAssign?: (itemId: string, day: string, hour: string | null) => void
  isPast?: boolean
}

const SlotChip = memo(function SlotChip({ slot, onEmptyClick, onSwapClick, selectedItem, onDirectAssign, isPast }: SlotChipProps) {
  const colors = FORMAT_COLORS[slot.format] ?? { accent: 'var(--gem-accent)', text: 'var(--gem-muted)' }
  const filled = slot.assignedItem !== null

  if (slot.isRestDay && !filled) {
    const dayNum = new Date(slot.day + 'T00:00:00Z').getUTCDay()
    const dayLabel = DAY_LABELS[dayNum] ?? ''
    const dateNum = parseInt(slot.day.slice(8, 10), 10)
    return (
      <button
        type="button"
        className="flex items-center justify-center rounded-md px-2 py-1 text-xs w-full h-full min-h-[44px] flex-1 cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none hover:opacity-80"
        style={{
          border: '1px dashed var(--gem-muted)',
          color: 'var(--gem-muted)',
          background: gemMix('--gem-text', 3),
        }}
        data-testid={`empty-slot-${slot.day}-${slot.format}`}
        data-day={slot.day}
        data-format={slot.format}
        data-hour={slot.hour ?? ''}
        data-locale={slot.channelLocale ?? ''}
        data-channel-id={slot.channelId ?? ''}
        aria-label={`Adicionar conteúdo — ${dayLabel} ${dateNum}`}
        onClick={onEmptyClick}
      >
        &mdash;
      </button>
    )
  }

  if (filled) {
    return (
      <div className="group/chip relative" style={{ opacity: isPast ? 0.6 : undefined }}>
        <Link
          href={`/cms/pipeline/items/${slot.assignedItem!.id}`}
          className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer motion-safe:transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none min-h-[44px] min-w-0${!isPast && onSwapClick ? ' pr-11' : ''}`}
          style={{
            background: gemMix(colors.accent, 20),
            borderLeft: `3px solid ${colors.accent}`,
            color: 'var(--gem-text)',
          }}
          title={slot.assignedItem!.title}
          aria-label={`${slot.assignedItem!.title} — ${slot.dayLabel}, ${STAGE_SHORT[slot.assignedItem!.stage] ?? slot.assignedItem!.stage}${slot.channelLocale ? `, ${slot.channelLocale === 'pt' ? 'Português' : 'English'}` : ''}`}
        >
          {slot.channelLocale && (
            <span className="shrink-0 text-xs" aria-hidden="true">{LOCALE_FLAG[slot.channelLocale]}</span>
          )}
          <span className="truncate min-w-0 flex-1">{slot.assignedItem!.title}</span>
          <span
            className="text-[10px] px-1 py-0.5 rounded shrink-0 font-normal"
            style={{ background: gemMix(colors.accent, 25), color: 'var(--gem-text)' }}
            aria-hidden="true"
          >
            {STAGE_SHORT[slot.assignedItem!.stage] ?? slot.assignedItem!.stage}
          </span>
        </Link>
        {!isPast && onSwapClick && (
          <button
            type="button"
            className="absolute top-1/2 right-0 -translate-y-1/2 w-11 min-h-[44px] flex items-center justify-center rounded-full opacity-60 group-hover/chip:opacity-100 focus-visible:opacity-100 motion-safe:transition-opacity focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
            style={{
              background: gemMix(colors.accent, 20),
              color: 'var(--gem-text)',
            }}
            data-day={slot.day}
            data-format={slot.format}
            data-hour={slot.hour ?? ''}
            data-locale={slot.channelLocale ?? ''}
            data-channel-id={slot.channelId ?? ''}
            data-item-id={slot.assignedItem!.id}
            onClick={(e) => { e.preventDefault(); onSwapClick(e) }}
            aria-label={`Trocar ${slot.assignedItem!.title}`}
            aria-haspopup="dialog"
          >
            <RefreshCw size={12} aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  const dayNum = new Date(slot.day + 'T00:00:00Z').getUTCDay()
  const dayLabel = DAY_LABELS[dayNum] ?? ''
  const dateNum = parseInt(slot.day.slice(8, 10), 10)

  const isCompatible = !!selectedItem && selectedItem.format === slot.format
    && (!slot.channelLocale || !selectedItem.language || selectedItem.language === 'both'
      || (slot.channelLocale === 'pt' && selectedItem.language === 'pt-br')
      || (slot.channelLocale === 'en' && selectedItem.language === 'en'))

  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center rounded-md px-2 py-1 text-xs w-full min-h-[44px] gap-0.5 focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none"
      style={{
        border: isCompatible
          ? `2px solid var(--gem-accent)`
          : '1px dashed var(--gem-muted)',
        color: isCompatible ? 'var(--gem-accent)' : 'var(--gem-muted)',
        background: isCompatible ? gemMix('--gem-accent', 8) : gemMix('--gem-text', 3),
        boxShadow: isCompatible ? `0 0 0 3px ${gemMix('--gem-accent', 20)}` : undefined,
      }}
      data-testid={`empty-slot-${slot.day}-${slot.format}`}
      data-day={slot.day}
      data-format={slot.format}
      data-hour={slot.hour ?? ''}
      data-locale={slot.channelLocale ?? ''}
      data-channel-id={slot.channelId ?? ''}
      aria-label={isCompatible
        ? `Atribuir "${selectedItem!.title}" — ${dayLabel} ${dateNum}`
        : `Adicionar ${FORMAT_LABELS[slot.format] ?? slot.format} — ${dayLabel} ${dateNum}`}
      onClick={isCompatible && onDirectAssign
        ? () => onDirectAssign(selectedItem!.id, slot.day, slot.hour)
        : onEmptyClick}
    >
      {isCompatible
        ? <span className="truncate">{selectedItem!.title}</span>
        : <>
            <span>&mdash;</span>
            <span className="text-[10px]" style={{ color: colors.accent }}>
              {slot.channelLocale && LOCALE_FLAG[slot.channelLocale] ? `${LOCALE_FLAG[slot.channelLocale]} ` : ''}{FORMAT_LABELS[slot.format] ?? slot.format}
            </span>
          </>}
    </button>
  )
})

export const UpNextThisWeek = memo(function UpNextThisWeek({
  slots, todayDate, stageCounts, totalEffortMinutes,
  streak, nextWeekEmpty, backlogCount,
  candidates = [], onAssignSlot,
  selectedItem = null, onItemAssigned,
  gridRef, modeInference,
}: WeekGridProps) {
  const [pickerSlot, setPickerSlot] = useState<{ day: string; format: WeekSlot['format']; hour: string | null; channelLocale?: 'pt' | 'en' | null; channelId?: string | null; previousItemId?: string } | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const dayCellRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const setDayCellRef = useCallback((day: string, el: HTMLDivElement | null) => {
    if (el) dayCellRefs.current.set(day, el)
    else dayCellRefs.current.delete(day)
  }, [])

  useEffect(() => {
    if (selectedItem) setPickerSlot(null)
  }, [selectedItem])

  const slotsByDay = useMemo(() => groupSlotsByDay(slots), [slots])

  const maxSlotsPerDay = useMemo(() => {
    let max = 1
    for (const daySlots of slotsByDay.values()) {
      if (daySlots.length > max) max = daySlots.length
    }
    return max
  }, [slotsByDay])

  // 44px per slot + 4px gap between slots + 12px padding
  const contentMinHeight = maxSlotsPerDay * 44 + (maxSlotsPerDay - 1) * 4 + 12

  const defaultFormat = useMemo(() => {
    if (candidates.length === 0) return 'video' as const
    const counts: Record<string, number> = {}
    for (const c of candidates) counts[c.format] = (counts[c.format] ?? 0) + 1
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]![0] as WeekSlot['format']
  }, [candidates])

  const allDays = useMemo(() => {
    const start = new Date(todayDate + 'T00:00:00Z')
    const days: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      days.push(d.toISOString().slice(0, 10))
    }
    return days
  }, [todayDate])

  const handleEmptyClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const day = e.currentTarget.dataset.day!
    const format = e.currentTarget.dataset.format! as WeekSlot['format']
    const hour = e.currentTarget.dataset.hour || null
    const channelLocale = (e.currentTarget.dataset.locale || null) as 'pt' | 'en' | null
    const channelId = e.currentTarget.dataset.channelId || null
    triggerRef.current = e.currentTarget
    setPickerSlot({ day, format, hour, channelLocale, channelId })
  }, [])

  const handleSwapClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const day = e.currentTarget.dataset.day!
    const format = e.currentTarget.dataset.format! as WeekSlot['format']
    const hour = e.currentTarget.dataset.hour || null
    const channelLocale = (e.currentTarget.dataset.locale || null) as 'pt' | 'en' | null
    const channelId = e.currentTarget.dataset.channelId || null
    const itemId = e.currentTarget.dataset.itemId!
    triggerRef.current = e.currentTarget
    setPickerSlot({ day, format, hour, channelLocale, channelId, previousItemId: itemId })
  }, [])

  const handleDirectAssign = useCallback(async (itemId: string, day: string, hour: string | null) => {
    try {
      await onAssignSlot?.(itemId, day, hour)
      onItemAssigned?.()
    } catch {
      // Error is surfaced via aria-live announcement in use-slot-assignment; don't clear selection
    }
  }, [onAssignSlot, onItemAssigned])

  const handlePickerAssign = useCallback(async (itemId: string, slotDay: string, slotHour: string | null) => {
    await onAssignSlot?.(itemId, slotDay, slotHour, pickerSlot?.previousItemId)
  }, [onAssignSlot, pickerSlot?.previousItemId])

  const handlePickerClose = useCallback(() => {
    setPickerSlot(null)
    triggerRef.current?.focus()
  }, [])

  const { filledCount, totalCount } = useMemo(() => ({
    filledCount: slots.filter(s => s.assignedItem).length,
    totalCount: slots.length,
  }), [slots])

  const wipStatus = useMemo(() => getWipStatus(stageCounts), [stageCounts])

  if (slots.length === 0) return null

  return (
    <section ref={gridRef} aria-label="Grade de conteúdo — próximos 7 dias">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={14} style={{ color: 'var(--gem-accent)' }} aria-hidden="true" />
          <h2
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--gem-muted)' }}
          >
            Próximos 7 Dias
          </h2>
        </div>
      </div>

      <div className="relative">
      <div
        className="rounded-lg border overflow-x-auto"
        style={{
          background: 'var(--gem-surface)',
          borderColor: 'var(--gem-border)',
        }}
        tabIndex={0}
        aria-label="Grade semanal — role para ver mais dias"
      >
        <ul
          aria-label="Dias da semana"
          className="grid grid-cols-7 min-w-[840px] list-none m-0 p-0"
        >
          {allDays.map((dayDate) => {
            const daySlots = slotsByDay.get(dayDate) ?? []
            const dayNum = new Date(dayDate + 'T00:00:00Z').getUTCDay()
            const isToday = dayDate === todayDate
            const isPast = dayDate < todayDate
            const isWeekend = dayNum === 0 || dayNum === 6
            const dayEffort = daySlots.reduce((sum, s) => sum + s.effortMinutes, 0)

            return (
              <li
                key={dayDate}
                className="flex flex-col border-r last:border-r-0 min-h-[120px]"
                style={{
                  borderColor: 'var(--gem-border)',
                  background: isToday
                    ? gemMix('--gem-accent', 10)
                    : isPast
                      ? gemMix('--gem-text', 8)
                      : isWeekend && daySlots.length === 0
                        ? gemMix('--gem-text', 5)
                        : undefined,
                }}
                {...(isToday ? { 'aria-current': 'date' as const } : {})}
              >
                <h3
                  className="px-2 py-1.5 text-center border-b"
                  style={{
                    borderColor: 'var(--gem-border)',
                    borderTop: isToday ? '3px solid var(--gem-accent)' : '3px solid transparent',
                  }}
                >
                  <span
                    className={`text-xs uppercase tracking-wider ${isToday ? 'font-bold' : 'font-semibold'}`}
                    style={{
                      color: isToday ? 'var(--gem-accent)' : 'var(--gem-muted)',
                    }}
                  >
                    {DAY_LABELS[dayNum]} <span className={`font-bold ${isToday ? 'text-base' : 'text-sm'}`}>{parseInt(dayDate.slice(8, 10), 10)}</span>
                  </span>
                  {dayEffort > 0 && (
                    <span
                      className="block text-xs mt-0.5"
                      style={{
                        color: dayEffort >= 240 ? 'var(--gem-warn)' : 'var(--gem-muted)',
                      }}
                    >
                      ~{Math.round(dayEffort / 60)}h
                    </span>
                  )}
                </h3>

                <div ref={(el) => setDayCellRef(dayDate, el)} className="p-1.5 flex flex-col flex-1 relative" style={{ gap: 4, minHeight: contentMinHeight }}>
                  {daySlots.length === 0 ? (
                    isPast ? (
                      <div
                        className="flex items-center justify-center w-full h-full min-h-[44px] flex-1 rounded-md text-xs"
                        style={{ color: 'var(--gem-muted)' }}
                        aria-label={`Sem conteúdo — ${DAY_LABELS[dayNum]} ${parseInt(dayDate.slice(8, 10), 10)}`}
                      >
                        &mdash;
                      </div>
                    ) : (
                    <button
                      type="button"
                      className="flex items-center justify-center w-full h-full min-h-[44px] flex-1 rounded-md text-xs cursor-pointer motion-safe:transition-colors focus-visible:ring-2 focus-visible:ring-[var(--gem-accent)] focus-visible:outline-none hover:opacity-80"
                      style={{
                        border: '1px dashed var(--gem-muted)',
                        color: 'var(--gem-muted)',
                        background: gemMix('--gem-text', 3),
                      }}
                      aria-label={`Sem conteúdo planejado — ${DAY_LABELS[dayNum]} ${parseInt(dayDate.slice(8, 10), 10)}`}
                      onClick={() => {
                        triggerRef.current = null
                        setPickerSlot({ day: dayDate, format: defaultFormat, hour: null })
                      }}
                    >
                      &mdash;
                    </button>)
                  ) : (
                    daySlots.map((slot, i) => (
                      <SlotChip
                        key={`${slot.day}-${slot.format}-${slot.hour ?? 'null'}-${slot.channelId ?? ''}`}
                        slot={slot}
                        onEmptyClick={isPast ? undefined : handleEmptyClick}
                        onSwapClick={!isPast && onAssignSlot ? handleSwapClick : undefined}
                        selectedItem={isPast ? null : selectedItem}
                        onDirectAssign={!isPast && selectedItem ? handleDirectAssign : undefined}
                        isPast={isPast}
                      />
                    ))
                  )}
                  {pickerSlot && pickerSlot.day === dayDate && (
                    <LazyWeekSlotPicker
                      slot={{ day: pickerSlot.day, format: pickerSlot.format, hour: pickerSlot.hour, effortMinutes: 0, assignedItem: null, isRestDay: false, dayLabel: '', channelLocale: pickerSlot.channelLocale ?? null, channelId: pickerSlot.channelId ?? null }}
                      candidates={candidates}
                      anchorRef={{ current: triggerRef.current ?? dayCellRefs.current.get(dayDate) ?? null }}
                      onAssign={handlePickerAssign}
                      onClose={handlePickerClose}
                    />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none rounded-r-lg max-[840px]:block hidden"
        style={{ background: 'linear-gradient(to right, transparent, var(--gem-surface))' }}
        aria-hidden="true"
      />
      </div>

      <div className="flex items-center justify-between mt-2 text-xs flex-wrap gap-2" style={{ color: 'var(--gem-muted)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(stageCounts).map(([group, count]) => {
            const status = wipStatus[group]
            const limit = DEFAULT_WIP_LIMITS[group]
            const dotColor = group === 'escrever' ? 'var(--gem-accent)'
              : group === 'gravar' ? 'var(--gem-danger)'
              : group === 'pos-prod' ? 'var(--gem-warn)'
              : 'var(--gem-done)'
            return (
              <span
                key={group}
                className="flex items-center gap-1"
                style={{
                  color: status === 'exceeded' ? 'var(--gem-danger)'
                    : status === 'warning' ? 'var(--gem-warn)'
                    : undefined,
                }}
                title={status === 'exceeded'
                  ? `${group}: ${count} itens (limite: ${limit})`
                  : status === 'warning'
                    ? `${group}: no limite (${limit})`
                    : undefined}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block w-2 h-2 rounded-full${status === 'exceeded' ? ' motion-safe:animate-pulse' : ''}`}
                  style={{ background: status === 'exceeded' ? 'var(--gem-danger)' : dotColor }}
                />
                {count}{limit ? `/${limit}` : ''} {group}
              </span>
            )
          })}
          {totalEffortMinutes > 0 && (
            <span>~{Math.round(totalEffortMinutes / 60)}h restantes</span>
          )}
          {totalCount > 0 && (
            <span>
              {filledCount}/{totalCount} slots
              {filledCount === totalCount && ' — tudo pronto!'}
            </span>
          )}
          {modeInference?.mode && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
              style={{
                background: modeInference.mode === 'escrever' ? gemMix('--gem-accent', 15)
                  : modeInference.mode === 'gravar' ? gemMix('--gem-danger', 15)
                  : gemMix('--gem-warn', 15),
                color: modeInference.mode === 'escrever' ? 'var(--gem-accent)'
                  : modeInference.mode === 'gravar' ? 'var(--gem-danger)'
                  : 'var(--gem-warn)',
              }}
            >
              {modeInference.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {nextWeekEmpty > 0 && <span>{nextWeekEmpty} vazios prox. semana</span>}
          {backlogCount > 0 && <span>{backlogCount} no backlog</span>}
          {streak.currentStreak >= 2 && (
            <span style={{ color: 'var(--gem-done)' }}>
              Streak: {streak.currentStreak} semanas{streak.isActive ? '' : ' (pausado)'}
            </span>
          )}
        </div>
      </div>
    </section>
  )
})
