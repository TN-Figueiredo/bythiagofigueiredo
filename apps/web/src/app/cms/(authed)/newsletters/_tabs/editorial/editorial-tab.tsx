'use client'

import { useState } from 'react'
import type { EditorialTabData } from '../../_hub/hub-types'
import { VelocityStrip } from './velocity-strip'
import { KanbanBoard } from './kanban-board'
import { EmptyState } from '../../_shared/empty-state'
import { SummaryBar } from '../../_shared/summary-bar'
import { SectionErrorBoundary } from '../../_shared/section-error-boundary'
import { Kanban, Plus } from 'lucide-react'
import Link from 'next/link'

interface EditorialTabProps {
  data: EditorialTabData
}

export function EditorialTab({ data }: EditorialTabProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = searchQuery
    ? data.editions.filter((e) => e.subject.toLowerCase().includes(searchQuery.toLowerCase()))
    : data.editions

  if (data.editions.length === 0) {
    return (
      <EmptyState
        icon={<Kanban className="h-8 w-8" />}
        heading="Start your editorial pipeline"
        description="Add your first idea or create a new edition to get started."
        action={
          <Link href="/cms/newsletters/new" className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600">
            <Plus className="mr-1 inline h-3.5 w-3.5" /> New Edition
          </Link>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionErrorBoundary sectionName="Velocity metrics">
        <VelocityStrip velocity={data.velocity} />
      </SectionErrorBoundary>

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search editions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 rounded-md border border-gray-800 bg-gray-900 px-3 py-1.5 text-[11px] text-gray-300 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <SectionErrorBoundary sectionName="Kanban board">
        <KanbanBoard editions={filtered} />
      </SectionErrorBoundary>

      <SummaryBar
        stats={`${data.editions.length} editions · ${data.velocity.movedThisWeek} moved this week · WIP limit: ${data.wipLimit}`}
        shortcuts={[
          { key: 'N', label: 'New' },
          { key: '/', label: 'Search' },
        ]}
      />
    </div>
  )
}
