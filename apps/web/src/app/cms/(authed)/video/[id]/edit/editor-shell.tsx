'use client'

import { lazy, Suspense, useEffect, useRef } from 'react'
import { CheckCircle } from 'lucide-react'
import { getStagePosition } from '@/lib/pipeline/workflows'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { VideoEdBar } from './ed-bar'
import { VidStages } from './vid-stages'
import { FocusExit } from './focus-exit'
import { useEdBarHeight } from './use-ed-bar-height'
import { NavigationGuard } from '@/app/cms/(authed)/_shared/editor/navigation-guard'
import { useVideoData } from './data-context'

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

  const topRef = useRef<HTMLDivElement>(null)
  const edBarH = useEdBarHeight(topRef)

  const data = useVideoData()

  // ⌘S / Ctrl+S force-flush autosave (no-op if clean — useAutosave handles that).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        void data.saveAll()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [data])

  return (
    <div
      className={`video-editor staged-editor vid-ed${published ? ' vid-ro' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', ['--ed-bar-h' as string]: edBarH }}
    >
      <div ref={topRef}>
        <VideoEdBar />
        {!state.focus && <VidStages />}
        {published && !state.focus && (
          <div className="vid-robanner">
            <CheckCircle size={15} /> <span><b>Publicado · no ar.</b> Edições limitadas — para mudar algo, peça ao <b>Cowork</b> ou despublique.</span>
          </div>
        )}
      </div>
      <div className={`ed-canvas content${state.focus ? ' focus' : ''}`} role="main">
        <div className="ed-doc">
          <StageBody />
        </div>
      </div>
      <FocusExit />
      <div
        role="status"
        aria-live="polite"
        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}
      >
        {data.autosaveState === 'saving' ? 'Salvando…'
          : data.autosaveState === 'saved' ? 'Rascunho salvo'
          : data.autosaveState === 'error' ? 'Erro ao salvar'
          : data.autosaveState === 'offline' ? 'Sem conexão — salvo localmente'
          : ''}
      </div>
      <NavigationGuard hasUnsavedChanges={data.hasUnsavedChanges} onSave={async () => { await data.saveAll() }} />
    </div>
  )
}
