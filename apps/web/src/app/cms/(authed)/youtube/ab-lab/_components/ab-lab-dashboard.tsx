'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type {
  AbTestCardView,
  AbTestDraft,
  AbTestSiteSettings,
  DashboardStats,
  LearningsData,
  SuggestedVideo,
} from '@/lib/youtube/ab-types'
import { KPI } from './kpi'
import { ActiveTestCard } from './active-test-card'
import { CompletedRow } from './completed-row'
import { DraftsBlock } from './drafts-block'
import { LearningsPanel } from './learnings-panel'
import { EmptyState } from './empty-state'
import { SettingsDrawer } from './settings-drawer'
import { SectionLabel } from './ab-primitives'
import { updateAbSiteSettings } from '../actions'

export interface AbLabDashboardProps {
  stats: DashboardStats
  cards: AbTestCardView[]
  draft: AbTestDraft | null
  completed: AbTestCardView[]
  learnings: LearningsData | null
  suggested: SuggestedVideo[]
  settings: AbTestSiteSettings
  siteId: string
}

export function AbLabDashboard({
  stats,
  cards,
  draft,
  completed,
  learnings,
  suggested,
  settings,
  siteId,
}: AbLabDashboardProps) {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)

  function handleOpenTest(id: string) {
    router.push(`/cms/youtube/ab-lab/${id}`)
  }

  function handleContinueDraft(id: string) {
    router.push(`/cms/youtube/ab-lab/${id}`)
  }

  function handleCreateTest(_videoId: string, _type: string) {
    router.push('/cms/youtube/ab-lab/new')
  }

  async function handleSaveSettings(changes: Partial<AbTestSiteSettings>) {
    const result = await updateAbSiteSettings(changes)
    if (!result.ok) throw new Error(result.error ?? 'Failed to save settings')
  }

  const showKpiStrip = cards.length > 0 || completed.length > 0
  const showEmpty = cards.length === 0 && completed.length === 0

  return (
    <div data-dashboard-root className="space-y-6 animate-ab-fade-up">
      {/* 1. Header */}
      <div className="animate-ab-fade-up">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-cms-text">A/B Lab</h2>
            <p className="text-sm text-cms-text-muted mt-0.5">
              {cards.length > 0 ? `${cards.length} teste${cards.length > 1 ? 's' : ''} ativo${cards.length > 1 ? 's' : ''}` : 'Nenhum teste ativo'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push('/cms/youtube/ab-lab/new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--cms-radius)] bg-cms-accent text-white text-sm font-medium hover:bg-cms-accent-hover transition-colors"
            >
              <Plus size={14} aria-hidden="true" />
              Novo teste
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
              className="flex items-center justify-center w-8 h-8 rounded-[var(--cms-radius)] border border-cms-border text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text transition-colors focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Strip */}
      {showKpiStrip && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-ab-fade-up" data-kpi-strip>
          <KPI
            label="Testes ativos"
            value={stats.activeTests}
          />
          <KPI
            label="Confiança média"
            value={Math.round(stats.avgConfidence)}
            suffix="%"
          />
          <KPI
            label="Taxa de vitória"
            value={Math.round(stats.winRate)}
            suffix="%"
          />
          <KPI
            label="Lift médio"
            value={Number(stats.avgLift.toFixed(1))}
            suffix="%"
          />
        </div>
      )}

      {/* 3. DraftsBlock */}
      {draft && (
        <div className="animate-ab-fade-up">
          <DraftsBlock draft={draft} onContinue={handleContinueDraft} />
        </div>
      )}

      {/* 4. Active Grid */}
      {cards.length > 0 && (
        <div className="animate-ab-fade-up">
          <SectionLabel>Testes ativos</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-active-grid>
            {cards.map(card => (
              <ActiveTestCard
                key={card.id}
                test={card}
                onOpen={handleOpenTest}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. EmptyState */}
      {showEmpty && (
        <div className="animate-ab-fade-up">
          <EmptyState suggested={suggested} onCreate={handleCreateTest} />
        </div>
      )}

      {/* 6. Completed + Learnings */}
      {completed.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 animate-ab-fade-up">
          <div>
            <SectionLabel>Concluídos</SectionLabel>
            <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg divide-y divide-cms-border">
              {completed.map(test => (
                <CompletedRow key={test.id} test={test} onOpen={handleOpenTest} />
              ))}
            </div>
          </div>
          <div>
            <LearningsPanel learnings={learnings} />
          </div>
        </div>
      )}

      {/* 7. SettingsDrawer */}
      {showSettings && (
        <SettingsDrawer
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
