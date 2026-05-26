'use client'

import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { UpNextCelebration, type CelebrationItem } from './up-next-celebration'
import { TodayActionCards } from './today-action-cards'
import { UpNextPlaylistStrips, type PlaylistStrip } from './up-next-playlist-strips'
import { UpNextSuggestion } from './up-next-suggestion'
import { UpNextActivity, type ActivityEntry } from './up-next-activity'
import { UpNextThisWeek } from './up-next-this-week'
import { CommandCenterSkeleton } from './command-center-skeleton'
import { CommandCenterEmpty } from './command-center-empty'
import { OfflineBanner } from './offline-banner'
import { PipelineSearchDropdown } from './pipeline-search-dropdown'
import type { UpNextApiResponse } from '@/lib/pipeline/up-next-types'

interface PipelineOverviewProps {
  fallbackData: UpNextApiResponse
  celebration: { items: CelebrationItem[] }
  playlists: PlaylistStrip[]
  activity: ActivityEntry[]
}

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json()
}).then(d => d.data as UpNextApiResponse)

export function PipelineOverview({ fallbackData, celebration, playlists, activity }: PipelineOverviewProps) {
  const { data, isLoading, mutate } = useSWR<UpNextApiResponse>(
    '/api/pipeline/up-next',
    fetcher,
    {
      fallbackData,
      revalidateOnFocus: true,
      dedupingInterval: 300_000,
      refreshInterval: 0,
    }
  )

  const dataRef = useRef(data ?? fallbackData)
  dataRef.current = data ?? fallbackData

  const handleAssignSlot = useCallback(async (
    itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string,
  ) => {
    const prev = dataRef.current
    const candidate = prev.candidates?.find(c => c.id === itemId)
    if (candidate) {
      const newItem = { id: candidate.id, title: candidate.title, stage: candidate.stage }
      const optimistic: UpNextApiResponse = {
        ...prev,
        weekSlots: prev.weekSlots.map(s => {
          if (previousItemId && s.day === slotDay && s.format === candidate.format && s.assignedItem?.id === previousItemId) {
            return { ...s, assignedItem: newItem }
          }
          if (previousItemId && s.assignedItem?.id === previousItemId) {
            return { ...s, assignedItem: null }
          }
          if (s.day === slotDay && s.format === candidate.format && s.hour === slotHour && !s.assignedItem) {
            return { ...s, assignedItem: newItem }
          }
          return s
        }),
      }
      mutate(optimistic, false)
    }

    try {
      const res = await fetch('/api/pipeline/up-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, slotDay, slotHour, previousItemId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Erro ao atribuir' } }))
        throw new Error(err.error?.message ?? 'Erro ao atribuir')
      }
      mutate()
    } catch (e) {
      mutate(prev, false)
      throw e
    }
  }, [mutate])

  const mountDateRef = useRef(fallbackData.todayDate)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const today = new Date().toISOString().slice(0, 10)
        if (today !== mountDateRef.current) {
          mountDateRef.current = today
          mutate()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [mutate])

  const upNext = data ?? fallbackData
  const weekdayLabel = useMemo(() => {
    const [y, m, d] = upNext.todayDate.split('-').map(Number)
    return new Date(y!, m! - 1, d!).toLocaleDateString('pt-BR', { weekday: 'long' })
  }, [upNext.todayDate])

  if (isLoading && !data) return <CommandCenterSkeleton />

  if (upNext.today.actions.length === 0 && upNext.weekSlots.length === 0 && upNext.today.totalSurfaced === 0) {
    return (
      <div className="space-y-6">
        <div className="max-w-sm ml-auto">
          <PipelineSearchDropdown />
        </div>
        <CommandCenterEmpty variant="first-run" />
      </div>
    )
  }

  const suggestion = upNext.suggestion
  const doneCount = upNext.today.doneToday
  const totalActions = upNext.today.totalSurfaced + doneCount
  const remainingHours = Math.round(upNext.today.totalEffortMinutes / 60)

  return (
    <div className="space-y-6">
      <OfflineBanner />

      {upNext.errors && Object.entries(upNext.errors).some(([, v]) => v !== null) && (
        <div
          role="status"
          aria-live="polite"
          className="text-[11px] px-3 py-1.5 rounded"
          style={{ color: 'var(--gem-warn)', background: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)' }}
        >
          Alguns dados podem estar incompletos. Tente recarregar a página.
        </div>
      )}

      {totalActions > 0 && (
        <div>
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--gem-text)' }}
            >
              {weekdayLabel}
              {' '}&mdash; {doneCount} de {totalActions} feito
              {remainingHours > 0 && <> · ~{remainingHours}h restantes</>}
            </h2>
            <div className="max-w-sm shrink-0">
              <PipelineSearchDropdown />
            </div>
          </div>
          <div
            className="mt-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--gem-faint)' }}
            role="progressbar"
            aria-label={`${doneCount} de ${totalActions} tarefas concluídas`}
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={totalActions}
          >
            <div
              className="h-full rounded-full motion-safe:transition-all"
              style={{
                width: `${Math.round((doneCount / totalActions) * 100)}%`,
                background: 'var(--gem-done)',
              }}
            />
          </div>
        </div>
      )}

      {totalActions === 0 && (
        <div className="max-w-sm ml-auto">
          <PipelineSearchDropdown />
        </div>
      )}

      {(upNext.today.actions.length > 0 || upNext.weekSlots.length === 0) && (
        <TodayActionCards
          actions={upNext.today.actions}
          overflow={upNext.today.overflow}
        />
      )}

      <UpNextCelebration items={celebration.items} />

      {suggestion && (
        <UpNextSuggestion
          text={suggestion.text}
          linkHref={suggestion.href}
          linkLabel="Ver"
        />
      )}

      <UpNextThisWeek
        slots={upNext.weekSlots}
        todayDate={upNext.todayDate}
        stageCounts={upNext.stageCounts}
        totalEffortMinutes={upNext.today.totalEffortMinutes}
        streak={upNext.streak}
        nextWeekEmpty={upNext.nextWeekEmpty}
        backlogCount={upNext.backlogCount}
        candidates={upNext.candidates}
        onAssignSlot={handleAssignSlot}
      />

      <section aria-label="Horizonte">
        <UpNextPlaylistStrips playlists={playlists} />
      </section>

      <section aria-label="Atividade recente">
        <UpNextActivity entries={activity} />
      </section>
    </div>
  )
}
