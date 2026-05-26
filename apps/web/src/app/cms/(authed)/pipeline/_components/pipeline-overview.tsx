'use client'

import useSWR from 'swr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UpNextCelebration, type CelebrationItem } from './up-next-celebration'
import { TodayActionCards } from './today-action-cards'
import { UpNextPlaylistStrips, type PlaylistStrip } from './up-next-playlist-strips'
import { UpNextSuggestion } from './up-next-suggestion'
import { UpNextActivity, type ActivityEntry } from './up-next-activity'
import { UpNextThisWeek } from './up-next-this-week'
import { CommandCenterSkeleton } from './command-center-skeleton'
import { CommandCenterEmpty } from './command-center-empty'
import { OfflineBanner } from './offline-banner'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { useSlotAssignment } from './use-slot-assignment'
import { gemMix } from '@/lib/pipeline/gem-design'
import type { UpNextApiResponse, SlotCandidate } from '@/lib/pipeline/up-next-types'
import { SITE_TIMEZONE } from '@/lib/pipeline/up-next-constants'
import dynamic from 'next/dynamic'

// Lazy-loaded: only needed on user interaction
const LazyPipelineSearchDropdown = dynamic(
  () => import('./pipeline-search-dropdown').then(m => ({ default: m.PipelineSearchDropdown })),
  { ssr: false }
)

const LazyPlaylistSuggestionPanel = dynamic(
  () => import('./playlist-suggestion-panel').then(m => ({ default: m.PlaylistSuggestionPanel })),
  { ssr: false }
)

interface PipelineOverviewProps {
  fallbackData: UpNextApiResponse
  celebration: { items: CelebrationItem[] }
  playlists: PlaylistStrip[]
  activity: ActivityEntry[]
}

const siteDateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: SITE_TIMEZONE })

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error ${r.status}`)
  return r.json()
}).then(d => {
  if (!d.data || typeof d.data !== 'object') throw new Error('Invalid response shape')
  return d.data as UpNextApiResponse
})

export function PipelineOverview({ fallbackData, celebration, playlists, activity }: PipelineOverviewProps) {
  const { data, isLoading, mutate } = useSWR<UpNextApiResponse>(
    '/api/pipeline/up-next',
    fetcher,
    {
      fallbackData,
      revalidateOnFocus: true,
      dedupingInterval: 300_000,
      refreshInterval: 300_000,
      errorRetryCount: 3,
    }
  )

  const dataRef = useRef(data ?? fallbackData)
  dataRef.current = data ?? fallbackData

  const { handleAssignSlot, announcement } = useSlotAssignment(mutate, dataRef)

  const [selectedCandidate, setSelectedCandidate] = useState<SlotCandidate | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  const handleAssignFromPanel = useCallback(async (
    itemId: string, slotDay: string, slotHour: string | null, previousItemId?: string,
  ) => {
    await handleAssignSlot(itemId, slotDay, slotHour, previousItemId)
    setSelectedCandidate(null)
  }, [handleAssignSlot])

  useEffect(() => {
    if (!selectedCandidate) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCandidate(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [selectedCandidate])

  const mountDateRef = useRef(fallbackData.todayDate)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const today = siteDateFormatter.format(new Date())
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
          <LazyPipelineSearchDropdown />
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
      <div role="status" aria-live="polite" className="sr-only">
        {selectedCandidate
          ? `${selectedCandidate.title} selecionado. Clique em um slot compatível para atribuir.`
          : announcement}
      </div>
      <OfflineBanner />

      {upNext.errors && Object.entries(upNext.errors).some(([, v]) => v !== null) && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs px-3 py-1.5 rounded"
          style={{ color: 'var(--gem-warn)', background: gemMix('--gem-warn', 8) }}
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
              <LazyPipelineSearchDropdown />
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
              className="h-full rounded-full motion-safe:transition-all motion-safe:animate-[progress-fill_0.8s_ease-out]"
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
          <LazyPipelineSearchDropdown />
        </div>
      )}

      {(upNext.today.actions.length > 0 || upNext.weekSlots.length === 0) && (
        <SectionErrorBoundary>
          <TodayActionCards
            actions={upNext.today.actions}
            overflow={upNext.today.overflow}
          />
        </SectionErrorBoundary>
      )}

      <UpNextCelebration items={celebration.items} />

      {suggestion && (
        <UpNextSuggestion
          text={suggestion.text}
          linkHref={suggestion.href}
          linkLabel="Ver"
        />
      )}

      <SectionErrorBoundary>
        <UpNextThisWeek
          slots={upNext.weekSlots}
          todayDate={upNext.todayDate}
          stageCounts={upNext.stageCounts}
          totalEffortMinutes={upNext.today.totalEffortMinutes}
          streak={upNext.streak}
          nextWeekEmpty={upNext.nextWeekEmpty}
          backlogCount={upNext.backlogCount}
          candidates={upNext.candidates}
          onAssignSlot={selectedCandidate ? handleAssignFromPanel : handleAssignSlot}
          selectedItem={selectedCandidate}
          onItemAssigned={() => setSelectedCandidate(null)}
        />
      </SectionErrorBoundary>

      {upNext.candidates.length > 0 && (
        <LazyPlaylistSuggestionPanel
          candidates={upNext.candidates}
          weekSlots={upNext.weekSlots}
          onSelectItem={setSelectedCandidate}
          selectedItem={selectedCandidate}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed(p => !p)}
        />
      )}

      <section aria-label="Horizonte">
        <UpNextPlaylistStrips playlists={playlists} />
      </section>

      <section aria-label="Atividade recente">
        <UpNextActivity entries={activity} />
      </section>
    </div>
  )
}
