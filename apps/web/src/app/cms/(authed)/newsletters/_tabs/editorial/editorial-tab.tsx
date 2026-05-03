'use client'

import { useState, useMemo, useDeferredValue, useTransition } from 'react'
import type { EditorialTabData, NewsletterType } from '../../_hub/hub-types'
import { VelocityStrip } from './velocity-strip'
import { KanbanBoard } from './kanban-board'
import { EmptyState } from '../../_shared/empty-state'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { Kanban, Plus, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import type { NewsletterHubStrings } from '../../_i18n/types'
import { moveEdition, reassignEditionType } from '../../actions'

const SENT_RETENTION_DAYS = 14

interface EditorialTabProps {
  data: EditorialTabData
  typeFilter?: string | null
  strings?: NewsletterHubStrings
  types?: NewsletterType[]
}

export function EditorialTab({ data, typeFilter, strings, types }: EditorialTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)
  const [, startTransition] = useTransition()

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - SENT_RETENTION_DAYS)
    return d.toISOString()
  }, [])

  const failedEditions = useMemo(
    () => data.editions.filter((e) => e.status === 'failed'),
    [data.editions],
  )

  const visibleEditions = useMemo(
    () => data.editions.filter((e) => {
      if (e.status === 'failed' || e.status === 'review' || e.status === 'sending') return false
      if (e.status === 'sent' && e.sentAt && e.sentAt < cutoff) return false
      return true
    }),
    [data.editions, cutoff],
  )

  const typeFiltered = typeFilter
    ? visibleEditions.filter((e) => e.typeId === typeFilter)
    : visibleEditions

  const filtered = deferredQuery
    ? typeFiltered.filter((e) => e.subject.toLowerCase().includes(deferredQuery.toLowerCase()))
    : typeFiltered

  const handleMoveEdition = async (editionId: string, newStatus: string, scheduledFor?: string) => {
    startTransition(async () => {
      await moveEdition(editionId, newStatus, scheduledFor)
    })
  }

  const handleReassignType = (editionId: string, typeId: string | null) => {
    startTransition(async () => {
      await reassignEditionType(editionId, typeId)
    })
  }

  const newEditionHref = typeFilter
    ? `/cms/newsletters/new?type=${typeFilter}`
    : '/cms/newsletters/new'

  if (data.editions.length === 0) {
    return (
      <EmptyState
        icon={<Kanban className="h-8 w-8" />}
        heading={strings?.empty.startPipeline ?? 'Start your editorial pipeline'}
        description={strings?.empty.addIdea ?? 'Add your first idea or create a new edition to get started.'}
        action={
          <Link href={newEditionHref} className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> {strings?.actions.newEdition ?? 'New Edition'}
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Velocity metrics">
        <VelocityStrip velocity={data.velocity} strings={strings} />
      </SectionErrorBoundary>

      {failedEditions.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span className="text-[11px] text-red-300">
            {failedEditions.length} {failedEditions.length === 1 ? 'edition' : 'editions'} failed —{' '}
            {failedEditions.map((e) => (
              <Link key={e.id} href={`/cms/newsletters/${e.id}/edit`} className="font-medium underline hover:text-red-200">
                {e.displayId}
              </Link>
            )).reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, ', ', el]), [])}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="search"
          placeholder={strings?.editorial.searchEditions ?? 'Search editions...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={strings?.editorial.searchEditions ?? 'Search editions'}
          className="w-64 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <SectionErrorBoundary sectionName="Kanban board">
        <KanbanBoard editions={filtered} onMoveEdition={handleMoveEdition} strings={strings} types={types} onReassignType={handleReassignType} />
      </SectionErrorBoundary>

      <SummaryBar
        stats={`${filtered.length} ${strings?.common.editions ?? 'editions'} · ${data.velocity.movedThisWeek} ${strings?.editorial.movedForward ?? 'moved this week'} · WIP: ${data.wipLimit}`}
        shortcuts={[
          { key: 'N', label: strings?.actions.newEdition ?? 'New' },
          { key: '/', label: strings?.editorial.searchEditions ?? 'Search' },
        ]}
      />
    </div>
  )
}
