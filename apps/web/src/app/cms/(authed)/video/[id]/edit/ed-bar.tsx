'use client'

import Link from 'next/link'
import { ChevronLeft, Eye, Play } from 'lucide-react'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { useVideoEditorState, useVideoEditorDispatch } from './context'

function getVideoStageLabel(stage: string): string {
  const found = WORKFLOWS.video.find((s) => s.stage === stage)
  return found?.label_pt ?? stage
}

export function VideoEdBar() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const stageLabel = getVideoStageLabel(state.stage)

  return (
    <div className="ed-bar">
      <div className="ed-bc">
        <Link className="eb-back" href="/cms/video"><ChevronLeft size={15} /> Voltar</Link>
        <span className="msep">/</span>
        <Link className="eb-back" href="/cms/video" style={{ gap: 0 }}>Vídeos</Link>
        <span className="msep">/</span>
        <span className="eb-code">{state.code}</span>
      </div>
      <span className="grow" />
      <span className="ed-status draft">
        <span className="es-dot" />
        {stageLabel}
      </span>
      <button
        type="button"
        className={`ed-iconbtn${state.focus ? ' on' : ''}`}
        title="Modo foco (Esc)"
        aria-pressed={state.focus}
        onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
      >
        <Eye size={16} />
      </button>
      <button
        type="button"
        className="ed-iconbtn"
        title="Cowork"
        aria-label="Cowork"
        onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'cowork' })}
      >
        ✦
      </button>
      <button type="button" className="ed-recbtn" onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'recording' })}>
        <Play size={14} /> Modo Gravação
      </button>
    </div>
  )
}
