import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import { useRef } from 'react'
import {
  VideoEditorProvider,
  useVideoEditorState,
  useVideoEditorDispatch,
} from '@/app/cms/(authed)/video/[id]/edit/context'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'idea', version: 1,
  activeLang: 'pt', activeStage: 'ideia', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

function Probe({ onState }: { onState: (s: VideoEditorState) => void }) {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const ref = useRef(dispatch)
  ref.current = dispatch
  onState(state)
  ;(globalThis as Record<string, unknown>).__dispatch = dispatch
  return <div data-testid="stage">{state.activeStage}</div>
}

describe('VideoEditorProvider', () => {
  it('exposes initial state and dispatch reaches the reducer', () => {
    let captured: VideoEditorState | null = null
    const { getByTestId } = render(
      <VideoEditorProvider initialState={seed}>
        <Probe onState={(s) => { captured = s }} />
      </VideoEditorProvider>,
    )
    expect(getByTestId('stage').textContent).toBe('ideia')
    expect(captured!.code).toBe('V-A07')
    act(() => {
      ;(globalThis as Record<string, () => void> as any).__dispatch({ type: 'SET_STAGE', stage: 'roteiro' })
    })
    expect(getByTestId('stage').textContent).toBe('roteiro')
  })
})
