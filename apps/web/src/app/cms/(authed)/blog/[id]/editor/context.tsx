'use client'

import {
  createContext,
  useContext,
  useReducer,
  useRef,
  useCallback,
  type ReactNode,
} from 'react'
import { editorReducer } from './reducer'
import type { EditorState, EditorAction, VersionContent } from './types'

/* ------------------------------------------------------------------ */
/*  Contexts (internal — not exported)                                */
/* ------------------------------------------------------------------ */

const EditorStateContext = createContext<EditorState | null>(null)
const EditorDispatchContext = createContext<
  ((action: EditorAction) => void) | null
>(null)

/* ------------------------------------------------------------------ */
/*  Provider                                                          */
/* ------------------------------------------------------------------ */

interface EditorProviderProps {
  initialState: EditorState
  children: ReactNode
}

export function EditorProvider({ initialState, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, initialState)

  // Stable dispatch — never changes reference identity across re-renders
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
  const stableDispatch = useCallback((action: EditorAction) => {
    dispatchRef.current(action)
  }, [])

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={stableDispatch}>
        {children}
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  Consumer hooks                                                    */
/* ------------------------------------------------------------------ */

export function useEditorState(): EditorState {
  const state = useContext(EditorStateContext)
  if (state === null) {
    throw new Error('useEditorState must be used within an EditorProvider')
  }
  return state
}

export function useEditorDispatch(): (action: EditorAction) => void {
  const dispatch = useContext(EditorDispatchContext)
  if (dispatch === null) {
    throw new Error('useEditorDispatch must be used within an EditorProvider')
  }
  return dispatch
}

export function useEditorVersion(): VersionContent | null {
  const state = useEditorState()
  return state.content[state.activeLang] ?? null
}
