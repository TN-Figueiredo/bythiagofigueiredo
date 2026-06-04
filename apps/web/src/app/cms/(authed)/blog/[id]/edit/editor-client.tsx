'use client'

import { Component, useEffect, useCallback, type ReactNode, type ErrorInfo } from 'react'
import { Toaster } from 'sonner'
import { EditorProvider, useEditorState, useEditorDispatch, useAutosaveState } from './context'
import type { EditorState } from './types'
import { ActionBar } from './action-bar'
import { LangToggle } from './lang-toggle'
import { StageBar } from './stage-bar'
import { Inspector } from './inspector/inspector'
import { StageIdeia } from './stages/stage-ideia'
import { StageRascunho } from './stages/stage-rascunho'
import { StageImagens } from './stages/stage-imagens'
import { StageSeo } from './stages/stage-seo'
import { StagePublicacao } from './stages/stage-publicacao'
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
        <div className="flex flex-col items-center justify-center p-8">
          <h2 className="text-lg font-semibold text-red-400 mb-2">
            Editor failed to render
          </h2>
          <pre className="mb-4 max-w-xl overflow-auto rounded-lg bg-red-950/40 p-4 text-xs text-red-300 whitespace-pre-wrap">
            {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-zinc-700 text-white rounded-lg text-sm font-medium hover:bg-zinc-600"
          >
            Retry
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
      onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-800 px-4 py-2 text-sm text-white shadow-lg transition hover:bg-zinc-700"
    >
      Sair do modo foco
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Document Canvas — renders active stage                            */
/* ------------------------------------------------------------------ */

function DocumentCanvas() {
  const state = useEditorState()

  switch (state.activeStage) {
    case 'ideia':
      return <StageIdeia />
    case 'rascunho':
      return <StageRascunho />
    case 'imagens':
      return <StageImagens />
    case 'seo':
      return <StageSeo />
    case 'publicacao':
      return <StagePublicacao />
  }
}

/* ------------------------------------------------------------------ */
/*  Editor Layout (inner — consumes context)                          */
/* ------------------------------------------------------------------ */

function EditorLayout() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const autosaveState = useAutosaveState()

  /* Esc key exits focus mode */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.focus) {
        dispatch({ type: 'TOGGLE_FOCUS' })
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.focus, dispatch])

  return (
    <div className="blog-editor flex h-full flex-col">
      {/* Action bar with lang toggle */}
      <ActionBar>
        <LangToggle />
      </ActionBar>

      {/* Stage bar — hidden in focus mode */}
      {!state.focus && <StageBar />}

      {/* Two-column grid */}
      <div
        className="flex-1"
        style={{
          display: 'grid',
          gridTemplateColumns: state.focus
            ? 'minmax(0,1fr)'
            : 'minmax(0,1fr) 340px',
        }}
      >
        {/* Left: document canvas */}
        <DocumentCanvas />

        {/* Right: inspector — hidden in focus mode */}
        {!state.focus && <Inspector />}
      </div>

      {/* Focus mode pill */}
      <FocusModePill />

      {/* Navigation guard */}
      <NavigationGuard hasUnsavedChanges={autosaveState.hasUnsavedChanges} />

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
