'use client'
import { useState } from 'react'
import { LinkList } from './link-list'
import type { LinkSummary, DashboardKpis } from '../types'

export interface LinksDashboardProps {
  links: LinkSummary[]
  metrics: DashboardKpis
  onCreateLink: () => void
  onDeleteLink: (id: string) => void
  onToggleActive: (id: string) => void
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
    </div>
  )
}

export function LinksDashboard({
  links,
  metrics,
  onCreateLink,
  onDeleteLink,
  onToggleActive,
}: LinksDashboardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Links" value={metrics.totalLinks} />
        <StatCard label="Total Clicks" value={metrics.totalClicks} />
        <StatCard label="Active Links" value={metrics.activeLinks} />
        {metrics.topPerformer ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-500">Top Performer</p>
            <p className="mt-1 text-lg font-bold text-gray-900">
              {formatNumber(metrics.topPerformer.clicks)}
            </p>
            <p className="text-xs text-gray-500">{metrics.topPerformer.code}</p>
          </div>
        ) : (
          <StatCard label="Top Performer" value="--" />
        )}
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Links</h2>
        <button
          type="button"
          onClick={onCreateLink}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Link
        </button>
      </div>

      {/* Link List */}
      <LinkList
        links={links}
        onSelect={setSelectedId}
        onToggleActive={onToggleActive}
        onDelete={onDeleteLink}
        selectedId={selectedId}
      />
    </div>
  )
}
