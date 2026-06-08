'use client'

import { lazy, Suspense, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { getStagePosition } from '@/lib/pipeline/workflows'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { VideoEdBar } from './ed-bar'
import { VidStages } from './vid-stages'
import { FocusExit } from './focus-exit'

const IdeiaStage = lazy(() => import('./stages/ideia-stage').then((m) => ({ default: m.IdeiaStage })))
const RoteiroStage = lazy(() => import('./stages/roteiro-stage').then((m) => ({ default: m.RoteiroStage })))

function StageBody() {
  const state = useVideoEditorState()
  return (
    <Suspense fallback={<div className="stage-skel" aria-hidden="true" />}>
      <div key={`${state.activeStage}-${state.activeLang}`} className="stage-fade">
        {state.activeStage === 'ideia' && <IdeiaStage />}
        {state.activeStage === 'roteiro' && <RoteiroStage />}
        {state.activeStage === 'pos' && <div data-testid="pos-placeholder" />}
        {state.activeStage === 'publicacao' && <div data-testid="pub-placeholder" />}
      </div>
    </Suspense>
  )
}

export function EditorShell() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const published = getStagePosition('video', state.stage) >= getStagePosition('video', 'published')
  const overlayOpen = state.recordingOpen || state.handoffOpen || state.coworkOpen

  // Precedence level 3: Esc exits focus only when no overlay/cowork popover owns the key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.focus && !overlayOpen) {
        dispatch({ type: 'TOGGLE_FOCUS' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [state.focus, overlayOpen, dispatch])

  return (
    <div className={`video-editor staged-editor vid-ed${published ? ' vid-ro' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <VideoEdBar />
      {!state.focus && <VidStages />}
      {published && !state.focus && (
        <div className="vid-robanner">
          <CheckCircle size={15} /> <span><b>Publicado · no ar.</b> Edições limitadas — para mudar algo, peça ao <b>Cowork</b> ou despublique.</span>
        </div>
      )}
      <div className={`ed-canvas content${state.focus ? ' focus' : ''}`} role="main">
        <div className="ed-doc">
          <StageBody />
        </div>
      </div>
      <FocusExit />
    </div>
  )
}
