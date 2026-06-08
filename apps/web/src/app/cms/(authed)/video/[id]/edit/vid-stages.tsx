'use client'

import { Lightbulb, FileText, Scissors, Rocket, Lock } from 'lucide-react'
import { isRecorded, REACHED_BY } from '@/lib/pipeline/video-lifecycle'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { VIDEO_STAGES, type VideoStage } from './types'

const STAGE_IDX: Record<VideoStage, number> = { ideia: 0, roteiro: 1, pos: 2, publicacao: 3 }

const META: Record<VideoStage, { label: string; Icon: typeof Lightbulb; gated: boolean }> = {
  ideia: { label: 'Ideia', Icon: Lightbulb, gated: false },
  roteiro: { label: 'Roteiro', Icon: FileText, gated: false },
  pos: { label: 'Pós', Icon: Scissors, gated: true },
  publicacao: { label: 'Publicação', Icon: Rocket, gated: true },
}

export function VidStages() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const recorded = isRecorded(state.stage)
  const progress = REACHED_BY(state.stage)

  if (state.focus) {
    return null
  }

  return (
    <div className="ed-stages vid-stages" role="tablist">
      {VIDEO_STAGES.map((id) => {
        const { label, Icon, gated } = META[id]
        const locked = gated && !recorded
        const on = state.activeStage === id
        const done = !locked && STAGE_IDX[id] < progress && !on
        return (
          <button
            key={id}
            type="button"
            role="tab"
            className={`ed-stage${on ? ' on' : ''}${locked ? ' locked' : ''}${done ? ' done' : ''}`}
            aria-current={on ? 'page' : undefined}
            aria-selected={on}
            // Locked tabs stay clickable (render LockedStage on select, §5.5) but are
            // flagged aria-disabled so AT announces the gate without a native disabled.
            aria-disabled={locked || undefined}
            onClick={() => dispatch({ type: 'SET_STAGE', stage: id })}
          >
            {locked ? <Lock size={14} /> : <Icon size={14} />}
            <span className="esl">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
