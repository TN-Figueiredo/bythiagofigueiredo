'use client'

import { useEffect } from 'react'
import { EditorProvider, useEditorState, useEditorDispatch } from './context'
import type { EditorState } from './types'

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
/*  Document Canvas — renders active stage placeholder                */
/* ------------------------------------------------------------------ */

function DocumentCanvas() {
  const state = useEditorState()

  return (
    <div data-testid={`stage-${state.activeStage}`} className="min-h-0" />
  )
}

/* ------------------------------------------------------------------ */
/*  Editor Layout (inner — consumes context)                          */
/* ------------------------------------------------------------------ */

function EditorLayout() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()

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
    <div className="flex h-full flex-col">
      {/* Action bar */}
      <div data-testid="action-bar" />

      {/* Stage bar — hidden in focus mode */}
      {!state.focus && <div data-testid="stage-bar" />}

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
        {!state.focus && <div data-testid="inspector" />}
      </div>

      {/* Focus mode pill */}
      <FocusModePill />
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
  return (
    <EditorProvider initialState={initialState}>
      <EditorLayout />
    </EditorProvider>
  )
}
