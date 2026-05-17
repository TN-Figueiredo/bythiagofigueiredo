'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { AbTestWithVariants, AbTestSiteSettings } from '@/lib/youtube/ab-types'
import { AbTestCard } from './ab-test-card'
import { AbTestCompletedRow } from './ab-test-completed-row'
import { AbSettingsPanel } from './ab-settings-panel'
import { AbVideoPicker } from './ab-video-picker'
import { AbCreateWizard } from './ab-create-wizard'

interface AbLabDashboardProps {
  siteId: string
  active: AbTestWithVariants[]
  draft: AbTestWithVariants[]
  completed: AbTestWithVariants[]
  settings: AbTestSiteSettings
}

export function AbLabDashboard({ siteId, active, draft, completed, settings }: AbLabDashboardProps) {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string
    title: string
    thumbnailUrl: string | null
    sourcePipelineId?: string | null
  } | null>(null)
  const [draftsOpen, setDraftsOpen] = useState(true)

  const hasAny = active.length + draft.length + completed.length > 0

  const completedWithWinners = completed.filter(
    t => t.winner_variant_id !== null &&
      (t.completed_reason === 'auto_resolve' || t.completed_reason === 'manual_winner'),
  )

  const avgConfidence =
    completedWithWinners.length > 0
      ? completedWithWinners.reduce((sum, t) => sum + (t.confidence_at_completion ?? 0), 0) /
        completedWithWinners.length
      : 0

  const winRate =
    completed.length > 0
      ? Math.round((completedWithWinners.length / completed.length) * 100)
      : 0

  const testsWithPositiveLift = completed.filter(
    t => t.result_metadata !== null && (t.result_metadata.ctr_lift_percent ?? 0) > 0,
  )

  const avgCtrLift =
    testsWithPositiveLift.length > 0
      ? testsWithPositiveLift.reduce(
          (sum, t) => sum + (t.result_metadata?.ctr_lift_percent ?? 0),
          0,
        ) / testsWithPositiveLift.length
      : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-semibold text-cms-text">A/B Lab</h1>
        {active.length > 0 && (
          <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full">
            {active.length} active
          </span>
        )}
        <span className="text-xs text-cms-text-muted">
          {active.length}/{settings.max_concurrent_tests} slots
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-8 h-8 rounded-[var(--cms-radius)] border border-cms-border text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text transition-colors"
            aria-label="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={() => setShowPicker(true)}
            className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            + New Test
          </button>
        </div>
      </div>

      {!hasAny && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-cms-text-dim mb-4" aria-hidden="true">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
          </svg>
          <h2 className="text-base font-semibold text-cms-text mb-2">No thumbnail tests yet</h2>
          <p className="text-sm text-cms-text-muted mb-6 max-w-sm">
            Run A/B tests on your YouTube thumbnails to find which ones drive more clicks.
          </p>
          <button
            onClick={() => setShowPicker(true)}
            className="bg-cms-accent text-white rounded-[var(--cms-radius)] px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start Your First Test
          </button>
        </div>
      )}

      {completed.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
            <p className="text-xs text-cms-text-muted uppercase tracking-wider mb-1">Active Tests</p>
            <p className="text-2xl font-bold text-cms-text">{active.length}</p>
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
            <p className="text-xs text-cms-text-muted uppercase tracking-wider mb-1">Avg Confidence</p>
            <p className="text-2xl font-bold text-cms-text">
              {completedWithWinners.length > 0 ? `${Math.round(avgConfidence * 100)}%` : '—'}
            </p>
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
            <p className="text-xs text-cms-text-muted uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-cms-text">
              {completed.length > 0 ? `${winRate}%` : '—'}
            </p>
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
            <p className="text-xs text-cms-text-muted uppercase tracking-wider mb-1">Avg CTR Lift</p>
            <p className="text-2xl font-bold text-cms-text">
              {testsWithPositiveLift.length > 0 ? `+${avgCtrLift.toFixed(1)}%` : '—'}
            </p>
          </div>
        </div>
      )}

      {draft.length > 0 && (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
          <button
            onClick={() => setDraftsOpen(o => !o)}
            className="flex items-center justify-between w-full px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-cms-text">Drafts ({draft.length})</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-cms-text-muted transition-transform ${draftsOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {draftsOpen && (
            <ul className="border-t border-cms-border divide-y divide-cms-border">
              {draft.map(test => (
                <li key={test.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-cms-text truncate">{test.name}</span>
                  <Link
                    href={`/cms/youtube/ab-lab/${test.id}`}
                    className="text-xs text-cms-accent hover:underline shrink-0 ml-4"
                  >
                    Continue Setup
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {active.map(test => (
            <AbTestCard key={test.id} test={test} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-cms-text mb-3">Completed Tests</h2>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface divide-y divide-cms-border">
            {completed.map(test => (
              <AbTestCompletedRow key={test.id} test={test} />
            ))}
          </div>
        </div>
      )}

      {showSettings && (
        <AbSettingsPanel settings={settings} onClose={() => setShowSettings(false)} />
      )}

      {showPicker && (
        <AbVideoPicker
          videos={[]}
          onSelect={v => {
            setSelectedVideo(v)
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {selectedVideo && (
        <AbCreateWizard
          video={selectedVideo}
          siteId={siteId}
          onClose={() => setSelectedVideo(null)}
          onCreated={(_testId: string) => {
            setSelectedVideo(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
