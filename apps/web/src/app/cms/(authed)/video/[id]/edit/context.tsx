'use client'

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { videoReducer } from './reducer'
import type { VideoEditorState, VideoEditorAction } from './types'

const StateCtx = createContext<VideoEditorState | null>(null)
const DispatchCtx = createContext<Dispatch<VideoEditorAction> | null>(null)

export function VideoEditorProvider({
  initialState,
  children,
}: {
  initialState: VideoEditorState
  children: ReactNode
}) {
  const [state, dispatch] = useReducer(videoReducer, initialState)
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
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
