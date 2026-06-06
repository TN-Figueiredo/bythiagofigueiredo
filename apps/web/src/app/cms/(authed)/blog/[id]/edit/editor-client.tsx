'use client'

import { Component, lazy, Suspense, useEffect, useCallback, useRef, type ReactNode, type ErrorInfo } from 'react'
import { Eye, SlidersHorizontal, X } from 'lucide-react'
import { Toaster } from 'sonner'
import { useModalFocusTrap } from '@/app/cms/(authed)/_shared/editor/use-modal-focus-trap'
import { EditorProvider, useEditorState, useEditorDispatch, useAutosaveState, useSaveActions } from './context'
import type { EditorState, Stage } from './types'
import { STAGES } from './types'
import { ActionBar } from './action-bar'
import { LangToggle } from './lang-toggle'
import { StageBar } from './stage-bar'
import { Inspector } from './inspector/inspector'
import { StageRascunho } from './stages/stage-rascunho'

const StageIdeia = lazy(() => import('./stages/stage-ideia').then(m => ({ default: m.StageIdeia })))
const StageImagens = lazy(() => import('./stages/stage-imagens').then(m => ({ default: m.StageImagens })))
const StageSeo = lazy(() => import('./stages/stage-seo').then(m => ({ default: m.StageSeo })))
const StagePublicacao = lazy(() => import('./stages/stage-publicacao').then(m => ({ default: m.StagePublicacao })))
import { NavigationGuard } from '@/app/cms/(authed)/_shared/editor/navigation-guard'
import { savePost, type SavePostActionInput } from './actions'
import { createPost } from '../../actions'
import './editor-theme.css'

/* ------------------------------------------------------------------ */
/*  Error Boundary — catches render crashes and shows them             */
/* ------------------------------------------------------------------ */

interface EditorErrorBoundaryState {
  error: Error | null
}

class EditorErrorBoundary extends Component<
  { children: ReactNode },
  EditorErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[BlogEditor] Render crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--danger)', marginBottom: 8 }}>
            Erro no editor
          </h2>
          <pre style={{
            marginBottom: 16, maxWidth: 560, overflow: 'auto', borderRadius: 12,
            background: 'var(--danger-s)', padding: 16, fontSize: 12, color: 'var(--text-muted)',
            whiteSpace: 'pre-wrap',
          }}>
            {this.state.error.message}
            {process.env.NODE_ENV !== 'production' && (
              <>{'\n'}{this.state.error.stack}</>
            )}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn sm"
          >
            Tentar novamente
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/* ------------------------------------------------------------------ */
/*  Focus Mode Pill                                                   */
/* ------------------------------------------------------------------ */

function FocusModePill() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()

  if (!state.focus) return null

  return (
    <button
      data-testid="focus-pill"
      className="focus-exit"
      onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
    >
      <Eye size={14} /> <b>Modo foco</b> — clique para sair · <span className="mono">esc</span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Stage loading skeleton (Suspense fallback)                        */
/* ------------------------------------------------------------------ */

function StageSkeleton() {
  return (
    <div className="stage-skel" data-testid="stage-skeleton" aria-hidden="true">
      <div className="skel-line kicker" />
      <div className="skel-line title" />
      <div className="skel-line" />
      <div className="skel-line" />
      <div className="skel-line short" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Document Canvas — renders active stage                            */
/* ------------------------------------------------------------------ */

function DocumentCanvas() {
  const state = useEditorState()

  return (
    <Suspense fallback={<StageSkeleton />}>
      <div key={state.activeStage} className="stage-fade">
        {state.activeStage === 'ideia' && <StageIdeia />}
        {state.activeStage === 'rascunho' && <StageRascunho />}
        {state.activeStage === 'imagens' && <StageImagens />}
        {state.activeStage === 'seo' && <StageSeo />}
        {state.activeStage === 'publicacao' && <StagePublicacao />}
      </div>
    </Suspense>
  )
}

/* ------------------------------------------------------------------ */
/*  Editor Layout (inner — consumes context)                          */
/* ------------------------------------------------------------------ */

function InspectorDrawer() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const langLabel = state.activeLang === 'pt' ? 'PT-BR' : 'EN'
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeInspector = useCallback(() => dispatch({ type: 'TOGGLE_INSPECTOR' }), [dispatch])
  useModalFocusTrap(drawerRef, state.inspectorOpen, closeInspector)

  if (!state.inspectorOpen) return null

  return (
    <>
      <div
        className="drawer-scrim"
        data-testid="inspector-scrim"
        onClick={() => dispatch({ type: 'TOGGLE_INSPECTOR' })}
        aria-hidden="true"
      />
      <div ref={drawerRef} className="drawer" data-testid="inspector-drawer" role="dialog" aria-modal="true" aria-label="Detalhes do post">
        <div className="drawer-head">
          <SlidersHorizontal size={17} style={{ color: 'var(--accent-text)' }} />
          <span className="dt">Detalhes do post</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
            {state.activeLang === 'pt' ? '\u{1F1E7}\u{1F1F7}' : '\u{1F1EC}\u{1F1E7}'} {langLabel}
          </span>
          <span className="grow" />
          <button
            type="button"
            className="ed-iconbtn"
            onClick={() => dispatch({ type: 'TOGGLE_INSPECTOR' })}
            aria-label="Fechar detalhes"
          >
            <X size={16} />
          </button>
        </div>
        <div className="drawer-body">
          <Inspector />
        </div>
      </div>
    </>
  )
}

const stageSet = new Set<string>(STAGES)

function EditorLayout() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const autosaveState = useAutosaveState()
  const { saveNow } = useSaveActions()

  /* Esc exits focus mode. (The drawer owns its own Esc via the focus trap,
     so we skip it here when the inspector is open to avoid a double toggle.) */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !state.inspectorOpen && state.focus) {
        dispatch({ type: 'TOGGLE_FOCUS' })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.focus, state.inspectorOpen, dispatch])

  /* Ctrl+S / Cmd+S saves immediately */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [saveNow])

  /* Hash ↔ activeStage sync: persist stage in URL so reload stays put */
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash && stageSet.has(hash) && hash !== state.activeStage) {
      dispatch({ type: 'SET_STAGE', stage: hash as Stage })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const current = window.location.hash.slice(1)
    if (current !== state.activeStage) {
      const url = `${window.location.pathname}${window.location.search}#${state.activeStage}`
      window.history.replaceState(null, '', url)
    }
  }, [state.activeStage])

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash.slice(1)
      if (stageSet.has(hash) && hash !== state.activeStage) {
        dispatch({ type: 'SET_STAGE', stage: hash as Stage })
      }
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [state.activeStage, dispatch]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="blog-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action bar with lang toggle */}
      <ActionBar>
        <LangToggle />
      </ActionBar>

      {/* Stage bar — hidden in focus mode */}
      {!state.focus && <StageBar />}

      {/* Document canvas — inert while the inspector drawer is open */}
      <div
        role="main"
        className={`ed-canvas${state.focus ? ' focus' : ''}`}
        inert={state.inspectorOpen || undefined}
      >
        <div className="ed-doc">
          <DocumentCanvas />
        </div>
      </div>

      {/* Inspector drawer — slide-in overlay */}
      <InspectorDrawer />

      {/* Focus mode pill */}
      <FocusModePill />

      {/* Screen-reader announcements for autosave status */}
      <div
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {autosaveState.state === 'saving' ? 'Salvando…'
          : autosaveState.state === 'saved' ? 'Rascunho salvo'
          : autosaveState.state === 'error' ? 'Erro ao salvar'
          : autosaveState.state === 'offline' ? 'Sem conexão — salvo localmente'
          : ''}
      </div>

      {/* Navigation guard */}
      <NavigationGuard hasUnsavedChanges={autosaveState.hasUnsavedChanges} onSave={async () => { await saveNow() }} />

      {/* Toast provider */}
      <Toaster
        theme="dark"
        position="bottom-center"
        duration={2800}
        toastOptions={{
          style: {
            borderRadius: '999px',
            boxShadow: 'var(--shadow-pop)',
          },
        }}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  EditorClient — top-level exported component                       */
/* ------------------------------------------------------------------ */

interface EditorClientProps {
  initialState: EditorState
}

export function EditorClient({ initialState }: EditorClientProps) {
  const handleSave = useCallback(
    async (id: string, locale: string, data: Record<string, unknown>) => {
      const result = await savePost(id, locale, data as unknown as SavePostActionInput)
      return { ok: result.ok, error: result.ok ? undefined : ('error' in result ? result.error : 'save_failed') }
    },
    [],
  )

  const handleCreatePost = useCallback(
    async (input: { title: string; locale: string; status: string }) => {
      return createPost({
        title: input.title,
        locale: input.locale,
        status: input.status as 'idea' | 'draft',
      })
    },
    [],
  )

  return (
    <EditorErrorBoundary>
      <EditorProvider
        initialState={initialState}
        saveAction={handleSave}
        createPostAction={handleCreatePost}
      >
        <EditorLayout />
      </EditorProvider>
    </EditorErrorBoundary>
  )
}
