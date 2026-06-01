'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Filter, Settings, Zap, FlaskConical, Crosshair, Trophy, TrendingUp, Sparkles, Pause, AlertTriangle } from 'lucide-react'
import type {
  AbTestCardView,
  AbTestDraft,
  AbTestSiteSettings,
  ChannelLearningsData,
  DashboardStats,
  LearningsData,
  SuggestedVideo,
} from '@/lib/youtube/ab-types'
import type { FatigueAlert } from '../queries'
import { KPI } from './kpi'
import { ActiveTestCard } from './active-test-card'
import { CompletedRow } from './completed-row'
import { DraftsBlock } from './drafts-block'
import { LearningsPanel } from './learnings-panel'
import { EmptyState } from './empty-state'
import { SettingsDrawer } from './settings-drawer'
import { updateAbSiteSettings, dismissFatigueAlert, batchStartTests } from '../actions'
import { FatigueCard } from './fatigue-card'
import { VideoPickerDialog } from './video-picker-dialog'
import type { EligibleVideo } from './video-picker-dialog'
import { AbCreateWizard } from './ab-create-wizard'
import type { WizardVideo } from './ab-create-wizard'

export interface AbLabDashboardProps {
  stats: DashboardStats
  cards: AbTestCardView[]
  drafts: AbTestDraft[]
  completed: AbTestCardView[]
  paused: AbTestCardView[]
  learnings: LearningsData | null
  channelLearnings: ChannelLearningsData | null
  suggested: SuggestedVideo[]
  settings: AbTestSiteSettings
  siteId: string
  eligibleVideos: EligibleVideo[]
  fatigueAlerts: FatigueAlert[]
}

export function AbLabDashboard({
  stats,
  cards,
  drafts,
  completed,
  paused,
  learnings,
  channelLearnings,
  suggested,
  settings,
  siteId,
  eligibleVideos,
  fatigueAlerts,
}: AbLabDashboardProps) {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [wizardVideo, setWizardVideo] = useState<WizardVideo | null>(null)
  const [continueDraft, setContinueDraft] = useState<AbTestDraft | null>(null)
  const [selectedForBatch, setSelectedForBatch] = useState<Set<string>>(new Set())

  const toggleBatchSelect = (videoId: string) => {
    setSelectedForBatch(prev => {
      const next = new Set(prev)
      next.has(videoId) ? next.delete(videoId) : next.add(videoId)
      return next
    })
  }

  const handleBatchStart = async () => {
    const ids = [...selectedForBatch]
    if (ids.length < 2) return
    const result = await batchStartTests(ids)
    if (result.ok) {
      setSelectedForBatch(new Set())
      router.refresh()
    }
  }

  function handleOpenTest(id: string) {
    router.push(`/cms/youtube/ab-lab/${id}`)
  }

  function handleContinueDraft(id: string) {
    const draft = drafts.find(d => d.id === id)
    if (!draft) return
    setContinueDraft(draft)
    setWizardVideo({
      id: draft.videoId,
      title: draft.name,
      thumbnailUrl: draft.thumbUrl,
      sourcePipelineId: draft.sourcePipelineId,
    })
  }

  function handleCreateTest(_videoId: string, _type: string) {
    setShowPicker(true)
  }

  function handleFatigueCreate(videoId: string) {
    const video = eligibleVideos.find(v => v.id === videoId)
    if (video) {
      setWizardVideo({
        id: video.id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        sourcePipelineId: video.sourcePipelineId,
      })
    } else {
      setShowPicker(true)
    }
  }

  async function handleFatigueDismiss(alertId: string) {
    await dismissFatigueAlert(alertId)
  }

  function handleVideoPicked(video: WizardVideo) {
    setShowPicker(false)
    setWizardVideo(video)
  }

  async function handleSaveSettings(changes: Partial<AbTestSiteSettings>) {
    const result = await updateAbSiteSettings(changes)
    if (!result.ok) throw new Error(result.error ?? 'Failed to save settings')
  }

  const hasAnyData = cards.length > 0 || completed.length > 0 || drafts.length > 0 || paused.length > 0
  const showEmpty = cards.length === 0 && completed.length === 0 && drafts.length === 0 && paused.length === 0

  return (
    <div data-dashboard-root className="animate-ab-fade-up">
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
            <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase text-cms-text-dim self-center font-mono" style={{ background: 'var(--cms-surface-3, var(--cms-surface-hover))' }}>
              <Zap size={11} aria-hidden="true" />
              quota 1,5% hoje
            </span>
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              className="inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text cursor-pointer"
              style={{ background: 'var(--cms-surface-hover)' }}
            >
              <Filter size={14} aria-hidden="true" />
              Todos os tipos
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-label="Configurações"
              className="inline-flex items-center justify-center py-[6px] px-[11px] rounded-[9px] border whitespace-nowrap transition-[0.15s] text-cms-text-dim hover:text-cms-text cursor-pointer"
              style={{ borderColor: 'var(--cms-border)' }}
            >
              <Settings size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] border border-cms-accent whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent cursor-pointer"
              style={{ color: 'rgb(26, 18, 12)' }}
            >
              <Plus size={16} aria-hidden="true" />
              Novo teste
            </button>
          </div>
        </div>
      </div>

      {/* 2. KPI Strip */}
      {hasAnyData && (
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
        <div className="animate-ab-fade-up" style={{ margin: '26px 0 14px' }}>
          <div className="flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Testes</span>
              <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase bg-cms-green-subtle text-cms-green font-mono">
                <span className="size-[6px] rounded-full bg-cms-green animate-ab-slot-pulse" />
                ativos
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]" data-active-grid>
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

      {/* 4b. Paused tests */}
      {paused.length > 0 && (
        <div className="animate-ab-fade-up" style={{ margin: '26px 0 14px' }}>
          <div className="flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Testes</span>
              <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase font-mono" style={{ background: 'rgba(234, 179, 8, 0.08)', color: 'rgb(234, 179, 8)' }}>
                <Pause size={10} aria-hidden="true" />
                pausados
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]" data-paused-grid>
            {paused.map(card => (
              <div
                key={card.id}
                className="rounded-[14px] border border-cms-border bg-cms-surface p-[16px] cursor-pointer hover:border-cms-accent/40 transition-colors"
                onClick={() => handleOpenTest(card.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenTest(card.id) }}
              >
                <div className="flex items-start justify-between gap-[12px]">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-semibold text-cms-text truncate m-0">{card.name}</h4>
                    <span className="text-[12px] text-cms-text-dim mt-[4px] block">
                      Dia {card.dayOf} &middot; {Math.round(card.confidence)}% confiança
                    </span>
                  </div>
                  {card.statusNote && (
                    <span
                      className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-[6px] text-[11px] font-medium shrink-0"
                      style={{ background: 'rgba(234, 179, 8, 0.1)', color: 'rgb(234, 179, 8)' }}
                    >
                      <AlertTriangle size={11} aria-hidden="true" />
                      {card.statusNote}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4c. Fatigue alerts — "Precisa de Atenção" */}
      {fatigueAlerts.length > 0 && (
        <div className="animate-ab-fade-up" style={{ margin: '26px 0 14px' }}>
          <div className="flex items-center justify-between mb-[14px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Precisa de Atenção</span>
              <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase font-mono" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'rgb(239, 68, 68)' }}>
                <AlertTriangle size={10} aria-hidden="true" />
                {fatigueAlerts.length} alerta{fatigueAlerts.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-[10px]">
            {fatigueAlerts.map(alert => (
              <FatigueCard
                key={alert.id}
                alert={alert}
                onCreate={handleFatigueCreate}
                onDismiss={handleFatigueDismiss}
              />
            ))}
          </div>
        </div>
      )}

      {/* 5. Suggested videos — always shown when available */}
      {suggested.length > 0 && (
        <div className="animate-ab-fade-up" style={{ margin: '26px 0 0' }}>
          {/* Hero banner only when empty */}
          {showEmpty && (
            <div
              className="rounded-[14px] p-[28px] mb-[26px] overflow-hidden relative"
              style={{
                background: 'linear-gradient(120deg, var(--cms-surface), var(--cms-bg-side))',
                border: '1px solid var(--cms-border, #332D25)',
              }}
            >
              <div className="absolute opacity-[0.06]" style={{ right: -30, top: -30 }}>
                <FlaskConical size={200} aria-hidden="true" />
              </div>
              <div className="relative max-w-[560px]">
                <span className="inline-flex items-center gap-[5px] px-[9px] py-[3px] rounded-full text-[10.5px] font-semibold tracking-[0.06em] uppercase font-mono" style={{ background: 'var(--accent-soft, rgba(255,130,64,0.08))', color: 'var(--cms-accent)' }}>
                  <Sparkles size={11} aria-hidden="true" />
                  Sugerido pelo Intelligence Engine
                </span>
                <h3 className="text-[24px] font-semibold leading-[1.2] mt-[14px] mb-[8px] m-0">
                  {suggested.length} {suggested.length > 1 ? 'vídeos que valem' : 'vídeo que vale'} a pena testar agora
                </h3>
                <p className="text-[14px] text-cms-text-dim leading-[1.5] m-0">
                  O sistema monitora o CTR de cada vídeo contra a mediana do seu canal. Estes estão abaixo do potencial — um teste A/B pode recuperar cliques que você está perdendo todo dia.
                </p>
              </div>
            </div>
          )}
          {/* Compact eyebrow when dashboard has data */}
          {!showEmpty && (
            <div className="flex items-center justify-between mb-[14px]">
              <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Sugeridos para testar</span>
              {selectedForBatch.size >= 2 && (
                <button
                  type="button"
                  onClick={handleBatchStart}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Iniciar Lote ({selectedForBatch.size})
                </button>
              )}
            </div>
          )}
          {showEmpty && selectedForBatch.size >= 2 && (
            <div className="flex justify-end mb-[14px]">
              <button
                type="button"
                onClick={handleBatchStart}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors cursor-pointer"
              >
                Iniciar Lote ({selectedForBatch.size})
              </button>
            </div>
          )}
          <EmptyState
            suggested={suggested}
            onCreate={handleCreateTest}
            selectedForBatch={selectedForBatch}
            onToggleBatchSelect={toggleBatchSelect}
          />
        </div>
      )}

      {/* 6. Completed + Learnings */}
      {completed.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-[16px] mt-[26px] items-start animate-ab-fade-up">
          <div className="rounded-[14px] border border-cms-border bg-cms-surface p-[16px]">
            <div className="flex items-center justify-between mb-[14px]">
              <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">Concluídos</span>
              <button type="button" className="text-[12px] text-cms-text-dim hover:text-cms-accent transition-colors cursor-pointer">ver todos</button>
            </div>
            {completed.map(test => (
              <CompletedRow key={test.id} test={test} onOpen={handleOpenTest} />
            ))}
          </div>
          <LearningsPanel learnings={learnings} channelLearnings={channelLearnings} totalTests={stats.completedTests} />
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

      {/* 8. VideoPickerDialog */}
      {showPicker && (
        <VideoPickerDialog
          eligibleVideos={eligibleVideos}
          onSelect={handleVideoPicked}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* 9. AbCreateWizard */}
      {wizardVideo && (
        <AbCreateWizard
          video={wizardVideo}
          siteId={siteId}
          settings={settings}
          onClose={() => {
            setWizardVideo(null)
            setContinueDraft(null)
          }}
          onCreated={(testId) => {
            // Don't close the wizard — let it stay visible with "Ativando..."
            // loading state until router.push completes the navigation.
            router.push(`/cms/youtube/ab-lab/${testId}`)
          }}
          existingDraftId={continueDraft?.id}
          prefill={continueDraft ? { testType: continueDraft.type, draftVariants: continueDraft.variants } : undefined}
        />
      )}
    </div>
  )
}
