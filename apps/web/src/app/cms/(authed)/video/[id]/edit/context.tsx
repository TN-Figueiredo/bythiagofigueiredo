'use client'

import { createContext, useContext, useReducer, useEffect, type Dispatch, type ReactNode } from 'react'
import { videoReducer } from './reducer'
import type { VideoEditorState, VideoEditorAction } from './types'

const StateCtx = createContext<VideoEditorState | null>(null)
const DispatchCtx = createContext<Dispatch<VideoEditorAction> | null>(null)
// The LIVE optimistic-lock version setter, owned by VideoEditorClient's `useState` and
// advanced by every section save. The recording hook pushes a freshly-bumped version here
// (after persistBeatIds) so the editor's single source of truth stays in sync — the reducer
// copy mirrors it via the SET_VERSION bridge below.
const SetVersionCtx = createContext<((v: number) => void) | null>(null)

export function VideoEditorProvider({
  initialState,
  liveVersion,
  setLiveVersion,
  children,
}: {
  initialState: VideoEditorState
  /**
   * The live optimistic-lock version owned by the editor client (`useState`), advanced by
   * section saves. When provided, it is mirrored into the reducer so `state.version` is
   * always the LIVE version (persistBeatIds reads it instead of a frozen mount snapshot).
   * Optional so tests / older callers can mount the provider without the bridge.
   */
  liveVersion?: number
  setLiveVersion?: (v: number) => void
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(videoReducer, initialState)

  // Mirror the live version (editor-client useState, the single source of truth) into the
  // reducer so the recording hook reads the LIVE version — never the frozen mount copy.
  useEffect(() => {
    if (liveVersion === undefined) return
    if (liveVersion !== state.version) dispatch({ type: 'SET_VERSION', version: liveVersion })
  }, [liveVersion, state.version])

  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        <SetVersionCtx.Provider value={setLiveVersion ?? null}>{children}</SetVersionCtx.Provider>
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useVideoEditorState(): VideoEditorState {
  const v = useContext(StateCtx)
  if (!v) throw new Error('useVideoEditorState must be used within VideoEditorProvider')
  return v
}

export function useVideoEditorDispatch(): Dispatch<VideoEditorAction> {
  const v = useContext(DispatchCtx)
  if (!v) throw new Error('useVideoEditorDispatch must be used within VideoEditorProvider')
  return v
}

/**
 * Push a freshly-bumped optimistic-lock version up to the editor client's live `useState`
 * (the single source of truth). Returns a no-op when no setter is wired (test harnesses),
 * so callers can fire it unconditionally.
 */
export function useSetLiveVersion(): (v: number) => void {
  const set = useContext(SetVersionCtx)
  return set ?? (() => {})
}
