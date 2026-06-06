'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Info, Plus, Target, CheckCheck } from 'lucide-react'
import { SearchPlus } from './atoms'
import type {
  ResearchItemSummary,
  ResearchItemFull,
  FocoWithRelations,
  ResearchDecision,
  DecisionWithSources,
  DecisionStatus,
  ResearchTheme,
  ResearchStats,
  ThemeId,
} from '@/lib/pipeline/research-types'
import { TabFoco } from './tab-foco'
import { TabPesquisas } from './tab-pesquisas'
import { TabDecisoes } from './tab-decisoes'
import { ResearchDoc } from './research-doc'
import { DecisionDoc } from './decision-doc'
import { FocoDrawer } from './foco-drawer'
import { DecisionDrawer } from './decision-drawer'
import { patchDecisionStatus } from '../decision-actions'
import '../research.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResearchTab = 'foco' | 'pesquisas' | 'decisoes'

type DrawerState =
  | { kind: 'none' }
  | { kind: 'foco'; focoId?: string }
  | {
      kind: 'decision'
      decisionId?: string
      prefillStatement?: string
      prefillTheme?: ThemeId | null
      prefillSourceId?: string
      prefillStatus?: DecisionStatus
    }

interface ResearchModuleProps {
  items: ResearchItemSummary[]
  stats: ResearchStats
  focos: FocoWithRelations[]
  decisions: ResearchDecision[]
  themes: ResearchTheme[]
  decisionSources?: Record<string, Array<{ research_id: string; research_title: string; note: string | null }>>
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const TAB_ICONS: Record<ResearchTab, React.ComponentType<{ size?: number }>> = {
  foco: Target,
  pesquisas: SearchPlus,
  decisoes: CheckCheck,
}

const TABS: Array<{ id: ResearchTab; label: string }> = [
  { id: 'foco', label: 'Foco' },
  { id: 'pesquisas', label: 'Pesquisas' },
  { id: 'decisoes', label: 'Decisões' },
]

const VALID_TABS = new Set<string>(TABS.map((t) => t.id))

function readHashTab(): ResearchTab {
  if (typeof window === 'undefined') return 'foco'
  const hash = window.location.hash.slice(1)
  if (VALID_TABS.has(hash)) return hash as ResearchTab
  return 'foco'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResearchModule({
  items,
  stats,
  focos,
  decisions,
  themes,
  decisionSources,
}: ResearchModuleProps) {
  const router = useRouter()
  const [tab, setTab] = useState<ResearchTab>(readHashTab)
  const [drawer, setDrawer] = useState<DrawerState>({ kind: 'none' })
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openDecId, setOpenDecId] = useState<string | null>(null)
  const [pendingDecStatus, setPendingDecStatus] = useState<DecisionStatus | null>(null)
  const [docItem, setDocItem] = useState<ResearchItemFull | null>(null)
  const [docStartMode, setDocStartMode] = useState<'read' | 'edit'>('read')
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [showExplainer, setShowExplainer] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('tf-research-explainer-v1') !== 'dismissed'
  })
  const activateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (activateTimerRef.current) clearTimeout(activateTimerRef.current)
    }
  }, [])

  const switchTab = useCallback((t: ResearchTab) => {
    setTab(t)
    window.history.replaceState(null, '', `#${t}`)
  }, [])

  // --- Callbacks ---

  const handleOpenItem = useCallback(async (id: string, mode: 'read' | 'edit' = 'read') => {
    setOpenDecId(null) // doc view and decision fullscreen are mutually exclusive
    setDocStartMode(mode)
    setOpenDocId(id)
    setDocItem(null)
    setDocLoading(true)
    setDocError(null)
    try {
      const { getResearchItemFull } = await import('../actions')
      const result = await getResearchItemFull(id)
      if (result.ok && result.data) {
        setDocItem(result.data as ResearchItemFull)
      } else {
        setDocError('Erro ao carregar pesquisa')
      }
    } catch {
      setDocError('Erro ao carregar pesquisa')
    } finally {
      setDocLoading(false)
    }
  }, [])

  const handleEditFoco = useCallback((id: string) => {
    setDrawer({ kind: 'foco', focoId: id })
  }, [])

  const handleCreateFoco = useCallback(() => {
    setDrawer({ kind: 'foco' })
  }, [])

  const handleEditDecision = useCallback((id: string) => {
    setDrawer({ kind: 'decision', decisionId: id })
  }, [])

  const handleOpenDecision = useCallback((id: string) => {
    // decision fullscreen and doc view are mutually exclusive
    setOpenDocId(null)
    setDocItem(null)
    setDocError(null)
    setOpenDecId(id)
  }, [])

  // Resolve the open decision to a DecisionWithSources by joining the
  // decisions prop with the decisionSources map (same shape as `sources`).
  const openDecision = useMemo<DecisionWithSources | null>(() => {
    if (!openDecId) return null
    const base = decisions.find((d) => d.id === openDecId)
    if (!base) return null
    return { ...base, sources: decisionSources?.[openDecId] ?? [] }
  }, [openDecId, decisions, decisionSources])

  // Clear the optimistic status once the refreshed data reflects it.
  useEffect(() => {
    if (pendingDecStatus && openDecision?.status === pendingDecStatus) {
      setPendingDecStatus(null)
    }
  }, [openDecision?.status, pendingDecStatus])

  // Close a stale fullscreen if its decision vanished from the loaded set
  // (e.g. archived from elsewhere) and we're not mid-status-change.
  useEffect(() => {
    if (openDecId && !openDecision && !pendingDecStatus) {
      setOpenDecId(null)
    }
  }, [openDecId, openDecision, pendingDecStatus])

  const handleCreateDecision = useCallback(() => {
    setDrawer({ kind: 'decision' })
  }, [])

  // "Nova pesquisa" — create a blank research doc and open it in edit mode.
  const handleCreatePesquisa = useCallback(async () => {
    try {
      const { createBlankResearchItem } = await import('../actions')
      const result = await createBlankResearchItem()
      if (result.ok) {
        await handleOpenItem(result.data.id, 'edit')
      }
    } catch {
      // swallow — open-doc error UI covers reload failures
    }
  }, [handleOpenItem])

  const handleActivateFoco = useCallback(async (id: string) => {
    const { activateResearchFoco } = await import('../foco-actions')
    const result = await activateResearchFoco(id)
    if (!result.ok) {
      console.error('[research] activate failed:', result.error)
      setActivateError(result.error ?? 'Erro ao ativar foco')
      if (activateTimerRef.current) clearTimeout(activateTimerRef.current)
      activateTimerRef.current = setTimeout(() => setActivateError(null), 4000)
      return
    }
    setActivateError(null)
    if (activateTimerRef.current) clearTimeout(activateTimerRef.current)
    router.refresh()
  }, [router])

  const closeDrawer = useCallback(() => setDrawer({ kind: 'none' }), [])

  const handleItemUpdated = useCallback((updated: Partial<ResearchItemFull> & { id: string }) => {
    setDocItem(prev => prev ? { ...prev, ...updated } : null)
  }, [])

  const handleMakeDecision = useCallback(
    (statement: string, themeId: ThemeId | null, sourceId: string) => {
      // A takeaway becomes a decision that carries its provenance: auto-link
      // the source research and start it as "testando" (per the handoff loop).
      setDrawer({
        kind: 'decision',
        prefillStatement: statement,
        prefillTheme: themeId,
        prefillSourceId: sourceId,
        prefillStatus: 'testando',
      })
    },
    [],
  )

  const handleBackFromDoc = useCallback(() => {
    setOpenDocId(null)
    setDocItem(null)
    setDocError(null)
    setDocStartMode('read') // avoid leaking 'edit' into the next doc opened
  }, [])

  const handleDrawerSaved = useCallback(() => {
    closeDrawer()
    router.refresh()
  }, [closeDrawer, router])

  const handlePatchDecisionStatus = useCallback(
    async (id: string, status: string) => {
      const next = status as DecisionStatus
      // Optimistic: the picker shows `next` as active + disables itself while
      // pending (no double-fire). Cleared by the effect below once the
      // refreshed data reflects it, or here on error/archive.
      setPendingDecStatus(next)
      try {
        const result = await patchDecisionStatus(id, next)
        if (!result.ok) {
          toast.error(result.error ?? 'Erro ao mudar o status da decisão')
          setPendingDecStatus(null)
          return
        }
        if (next === 'arquivado') {
          // Archived decisions leave the loaded set → return to the list.
          setOpenDecId(null)
          setPendingDecStatus(null)
          toast.success('Decisão arquivada')
        }
        router.refresh()
      } catch {
        toast.error('Erro ao mudar o status da decisão')
        setPendingDecStatus(null)
      }
    },
    [router],
  )

  // Non-archived research items offered as link sources in the decision drawer.
  const researchOptions = useMemo(
    () =>
      items
        .filter((i) => i.status !== 'arquivada')
        .map((i) => ({ id: i.id, title: i.title, theme_id: i.theme_id })),
    [items],
  )

  // Pristine = no focus board yet (no non-archived focos). In this zero state
  // the Foco tab's own panel owns the CTAs, so the header hides its actions.
  const isPristine = useMemo(
    () => !focos.some((f) => f.state !== 'arquivado'),
    [focos],
  )

  // --- (tab counts removed — design uses icon-only tabs) ---

  // --- Render ---

  return (
    <div data-cms-section="research">
      {/* Module header */}
      <div className="mod-head">
        <span className="mod-title">Research</span>
        <span className="mod-live">
          <i />
          Cowork + você
        </span>
        <div style={{ flex: 1 }} />
        {tab === 'foco' && !isPristine && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setShowExplainer(true)
              switchTab('foco')
            }}
          >
            <Info size={15} />
            Como funciona
          </button>
        )}
        {tab === 'foco' && !isPristine && (
          <button
            className="btn primary"
            type="button"
            onClick={handleCreateFoco}
          >
            <Plus size={15} />
            Definir foco
          </button>
        )}
        {tab === 'pesquisas' && (
          <button
            className="btn primary"
            type="button"
            onClick={handleCreatePesquisa}
          >
            <Plus size={15} />
            Nova pesquisa
          </button>
        )}
        {tab === 'decisoes' && (
          <button
            className="btn primary"
            type="button"
            onClick={handleCreateDecision}
          >
            <Plus size={15} />
            Nova decisão
          </button>
        )}
      </div>

      {/* Decision fullscreen OR document view OR tab navigation */}
      {openDecId && openDecision ? (
        <DecisionDoc
          decision={openDecision}
          onBack={() => setOpenDecId(null)}
          onEdit={handleEditDecision}
          onPatchStatus={handlePatchDecisionStatus}
          onOpenDoc={handleOpenItem}
          statusPending={pendingDecStatus !== null}
          pendingStatus={pendingDecStatus ?? undefined}
        />
      ) : openDocId && docItem ? (
        <ResearchDoc
          item={docItem}
          onBack={handleBackFromDoc}
          onItemUpdated={handleItemUpdated}
          onMakeDecision={handleMakeDecision}
          initialMode={docStartMode}
        />
      ) : openDocId && docLoading ? (
        <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
          Carregando...
        </div>
      ) : openDocId && docError ? (
        <div className="fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--c-danger, #ef4444)', marginBottom: '1rem' }}>{docError}</p>
          <button
            className="btn sm"
            onClick={() => handleOpenItem(openDocId)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="tabs" role="tablist" aria-label="Secoes da pesquisa">
            {TABS.map((t) => {
              const Icon = TAB_ICONS[t.id]
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab${tab === t.id ? ' on' : ''}`}
                  onClick={() => switchTab(t.id)}
                >
                  <span className="row gap-6">
                    <Icon size={14} />
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Activate foco error banner */}
          {activateError && (
            <div
              className="fade-in"
              style={{
                margin: '8px 0',
                padding: '10px 14px',
                borderRadius: 8,
                background: 'color-mix(in srgb, var(--c-danger, #ef4444) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--c-danger, #ef4444) 30%, transparent)',
                color: 'var(--c-danger, #ef4444)',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {activateError}
            </div>
          )}

          {/* Tab content */}
          {tab === 'foco' && (
            <div className="fade-in" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              <TabFoco
                focos={focos}
                decisions={decisions}
                items={items}
                decisionSources={decisionSources}
                onEditFoco={handleEditFoco}
                onCreateFoco={handleCreateFoco}
                onActivateFoco={handleActivateFoco}
                onOpenItem={handleOpenItem}
                onEditDecision={handleEditDecision}
                onOpenDecision={handleOpenDecision}
                onSwitchTab={switchTab as (tab: string) => void}
                onReset={() => router.refresh()}
                showExplainer={showExplainer}
                onDismissExplainer={() => setShowExplainer(false)}
              />
            </div>
          )}

          {tab === 'pesquisas' && (
            <div className="fade-in" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              <TabPesquisas
                items={items}
                onOpenItem={handleOpenItem}
                onCreate={handleCreatePesquisa}
              />
            </div>
          )}

          {tab === 'decisoes' && (
            <div className="fade-in" role="tabpanel" aria-labelledby={`tab-${tab}`}>
              <TabDecisoes
                decisions={decisions}
                decisionSources={decisionSources}
                onOpenItem={handleOpenItem}
                onEditDecision={handleEditDecision}
                onCreateDecision={handleCreateDecision}
                onOpenDecision={handleOpenDecision}
              />
            </div>
          )}
        </>
      )}

      {/* Drawers — always rendered outside tab/doc content */}
      {drawer.kind === 'foco' && (
        <FocoDrawer
          initial={drawer.focoId ? focos.find(f => f.id === drawer.focoId) : undefined}
          onClose={closeDrawer}
          onSaved={handleDrawerSaved}
        />
      )}
      {drawer.kind === 'decision' && (
        <DecisionDrawer
          initial={
            drawer.decisionId
              ? (() => {
                  const base = decisions.find((d) => d.id === drawer.decisionId)
                  if (!base) return undefined
                  return { ...base, sources: decisionSources?.[drawer.decisionId] ?? [] }
                })()
              : undefined
          }
          prefillStatement={drawer.prefillStatement}
          prefillTheme={drawer.prefillTheme}
          prefillSourceId={drawer.prefillSourceId}
          prefillStatus={drawer.prefillStatus}
          researchOptions={researchOptions}
          onClose={closeDrawer}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  )
}
