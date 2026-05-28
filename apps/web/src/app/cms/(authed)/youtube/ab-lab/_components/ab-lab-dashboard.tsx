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
  eligibleVideos: Array<{
    id: string
    title: string
    thumbnailUrl: string | null
    durationSeconds: number
    channelHandle: string
    hasActiveTest: boolean
    previousLift: number | null
    sourcePipelineId: string | null
  }>
}

export function AbLabDashboard({ siteId, active, draft, completed, settings, eligibleVideos }: AbLabDashboardProps) {
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
  const [typeFilter, setTypeFilter] = useState<string>('')

  const filteredActive = typeFilter ? active.filter(t => t.test_type === typeFilter) : active
  const filteredDraft = typeFilter ? draft.filter(t => t.test_type === typeFilter) : draft
  const filteredCompleted = typeFilter ? completed.filter(t => t.test_type === typeFilter) : completed

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

  const insightTests = completed.filter(t => t.winner_variant_id && t.result_metadata)
  const totalExtraClicks = insightTests.reduce(
    (sum, t) =>
      sum +
      ((t.result_metadata as { estimated_monthly_extra_clicks?: number } | null)
        ?.estimated_monthly_extra_clicks ?? 0),
    0,
  )
  const avgLift =
    insightTests.length > 0
      ? insightTests.reduce(
          (sum, t) =>
            sum +
            ((t.result_metadata as { ctr_lift_percent?: number } | null)?.ctr_lift_percent ?? 0),
          0,
        ) / insightTests.length
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
          {active.length} {active.length === 1 ? 'teste ativo' : 'testes ativos'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="text-sm bg-cms-surface border border-cms-border rounded-[var(--cms-radius)] px-2 py-1 text-cms-text"
          >
            <option value="">Todos os Tipos</option>
            <option value="thumbnail">Thumbnail</option>
            <option value="title">Título</option>
            <option value="description">Descrição</option>
            <option value="combo">Combo</option>
          </select>
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
          <h2 className="text-base font-semibold text-cms-text mb-2">Nenhum teste A/B ainda</h2>
          <p className="text-sm text-cms-text-muted mb-6 max-w-sm">
            Crie testes A/B nos seus vídeos do YouTube para descobrir qual variação gera mais cliques.
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
            <p className="text-xs text-cms-text-muted uppercase tracking-wider mb-1">Testes Ativos</p>
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

      {filteredDraft.length > 0 && (
        <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
          <button
            onClick={() => setDraftsOpen(o => !o)}
            className="flex items-center justify-between w-full px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-cms-text">Rascunhos ({filteredDraft.length})</span>
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
              {filteredDraft.map(test => (
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

      {filteredActive.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredActive.map(test => (
            <AbTestCard key={test.id} test={test} />
          ))}
        </div>
      )}

      {filteredCompleted.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-cms-text mb-3">Completed Tests</h2>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface divide-y divide-cms-border">
            {filteredCompleted.map(test => (
              <AbTestCompletedRow key={test.id} test={test} />
            ))}
          </div>
        </div>
      )}

      {insightTests.length >= 3 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Cross-Test Insights</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
              <p className="text-xs text-cms-text-muted uppercase tracking-wider">Cumulative Impact</p>
              <p className="text-xl font-bold text-cms-text">
                {totalExtraClicks.toLocaleString()} extra clicks/mo
              </p>
            </div>
            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
              <p className="text-xs text-cms-text-muted uppercase tracking-wider">Avg CTR Lift</p>
              <p className="text-xl font-bold text-green-400">+{avgLift.toFixed(1)}%</p>
            </div>
            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface p-4">
              <p className="text-xs text-cms-text-muted uppercase tracking-wider">Tests Won</p>
              <p className="text-xl font-bold text-cms-text">{insightTests.length}/{completed.length}</p>
            </div>
          </div>
        </section>
      )}

      {showSettings && (
        <AbSettingsPanel settings={settings} onClose={() => setShowSettings(false)} />
      )}

      {showPicker && (
        <AbVideoPicker
          videos={eligibleVideos}
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
