'use client'

import Link from 'next/link'
import { ChevronLeft, Eye, Play } from 'lucide-react'
import { toast } from 'sonner'
import { WORKFLOWS } from '@/lib/pipeline/workflows'
import { videoColumn, type VideoColumn } from '@/lib/pipeline/video-lifecycle'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { useVideoData } from './data-context'
import { presentLangs } from './editor-model'
import { VidLang } from './_components/vid-lang'
import { CoworkButton } from './_components/cowork-button'
import type { VideoLang } from './types'

const STAGE_STATUS_CLASS = (stage: string): string =>
  videoColumn(stage) === 'published' ? 'ed-status live' : 'ed-status draft'

function getVideoStageLabel(stage: string): string {
  const found = WORKFLOWS.video.find((s) => s.stage === stage)
  return found?.label_pt ?? stage
}

// Stage chip dot color, by kanban column — parity with the hub (video-hub.tsx COLUMNS).
const COLUMN_COLOR: Record<VideoColumn, string> = {
  idea: 'var(--cms-purple)',
  roteiro: 'var(--c-pipeline)',
  gravacao: 'var(--warn)',
  published: 'var(--c-links)',
}

export function VideoEdBar() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const stageLabel = getVideoStageLabel(state.stage)
  const dotColor = COLUMN_COLOR[videoColumn(state.stage)]
  const present = presentLangs(data.versions, state.primaryLang)

  return (
    <div className="ed-bar">
      <div className="ed-bc">
        <Link className="eb-back" href="/cms/video"><ChevronLeft size={15} /> Voltar</Link>
        <span className="msep">/</span>
        <Link className="eb-back" href="/cms/video" style={{ gap: 0 }}>Vídeos</Link>
        <span className="msep">/</span>
        <span className="eb-code">{state.code}</span>
      </div>
      <div className="grow" />
      <VidLang
        versions={data.versions}
        present={present}
        active={state.activeLang}
        onSwitch={(l: VideoLang) => dispatch({ type: 'SET_LANG', lang: l })}
        onAdd={(l: VideoLang) =>
          toast.info('Versão ' + (l === 'pt' ? 'PT-BR' : 'EN'), {
            description: 'Em breve — cada idioma tem roteiro próprio, não é tradução.',
          })
        }
      />
      <span className={STAGE_STATUS_CLASS(state.stage)}>
        <span className="es-dot" style={{ background: dotColor }} />
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
      <CoworkButton stage={state.activeStage} />
      <button type="button" className="ed-recbtn" onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: 'recording' })}>
        <Play size={14} /> Modo Gravação
      </button>
    </div>
  )
}
