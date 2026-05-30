'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Filter, Settings, Zap, FlaskConical, Crosshair, Trophy, TrendingUp } from 'lucide-react'
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
  drafts: AbTestDraft[]
  completed: AbTestCardView[]
  learnings: LearningsData | null
  suggested: SuggestedVideo[]
  settings: AbTestSiteSettings
  siteId: string
}

export function AbLabDashboard({
  stats,
  cards,
  drafts,
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

  const showKpiStrip = true
  const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0

  return (
    <div data-dashboard-root className="space-y-6 animate-ab-fade-up">
      {/* 1. Header */}
      <div className="animate-ab-fade-up">
        <div className="flex items-center justify-between flex-wrap gap-[12px] mb-[22px]">
          <div className="flex items-baseline gap-[14px]">
            <h2 className="text-[22px] font-bold tracking-[-0.01em] text-cms-text m-0">A/B Lab</h2>
            <span className="text-[13px] text-cms-text-dim">
              {cards.length > 0
                ? `${cards.length} teste${cards.length > 1 ? 's' : ''} ativo${cards.length > 1 ? 's' : ''}`
                : 'Nenhum teste ativo'}
            </span>
            <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase bg-cms-surface-hover text-cms-text-dim self-center">
              <Zap size={11} aria-hidden="true" />
              quota 1,5% hoje
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-surface-hover text-cms-text"
            >
              <Filter size={14} aria-hidden="true" />
              Todos os tipos
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Configurações"
              className="inline-flex items-center justify-center py-[6px] px-[11px] rounded-[9px] border border-cms-border-strong whitespace-nowrap transition-[0.15s] text-cms-text-dim hover:text-cms-text"
            >
              <Settings size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => router.push('/cms/youtube/ab-lab/new')}
              className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] border border-cms-accent whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent"
              style={{ color: 'rgb(26, 18, 12)' }}
            >
              <Plus size={16} aria-hidden="true" />
              Novo teste
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Strip */}
      {showKpiStrip && (
        <div className="grid grid-cols-4 gap-[14px] mb-[26px] animate-ab-fade-up" data-kpi-strip>
          <KPI
            label="Testes ativos"
            value={stats.activeTests}
            icon={FlaskConical}
          />
          <KPI
            label="Confiança média"
            value={Math.round(stats.avgConfidence)}
            suffix="%"
            icon={Crosshair}
            spark={stats.avgConfidence > 0 ? [40, 52, 58, 63, 68, 72, 75, 78, 80, Math.round(stats.avgConfidence)] : undefined}
          />
          <KPI
            label="Win rate"
            value={Math.round(stats.winRate)}
            suffix="%"
            icon={Trophy}
            trend={stats.completedTests > 0 ? `${stats.testsWon} de ${stats.completedTests} testes` : undefined}
          />
          <KPI
            label="CTR lift médio"
            value={stats.avgLift > 0 ? `+${stats.avgLift.toFixed(1)}` : '0'}
            suffix="%"
            icon={TrendingUp}
            trend={stats.avgLift > 0 ? `~${Math.round(stats.avgLift * 74)} cliques/mês extra` : undefined}
          />
        </div>
      )}

      {/* 3. DraftsBlock */}
      {drafts.length > 0 && (
        <div className="animate-ab-fade-up">
          <DraftsBlock drafts={drafts} onContinue={handleContinueDraft} />
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
            <div className="rounded-lg border border-cms-border bg-cms-bg divide-y divide-cms-border">
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
