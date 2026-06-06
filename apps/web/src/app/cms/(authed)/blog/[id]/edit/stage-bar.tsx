'use client'

import { PenLine, Image as ImageIcon, Search, Rss } from 'lucide-react'
import { useEditorState, useEditorDispatch } from './context'
import { STAGES } from './types'
import type { Stage } from './types'

/* ------------------------------------------------------------------ */
/*  Lucide icon per stage                                             */
/* ------------------------------------------------------------------ */

function IdeiaIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M5 19l.6 1.7L7.5 21l-1.9.6L5 23l-.6-1.4L2.5 21l1.9-.7z" />
    </svg>
  )
}

const STAGE_ICON: Record<Stage, React.ComponentType<{ className?: string; size?: number }>> = {
  ideia: IdeiaIcon,
  rascunho: PenLine,
  imagens: ImageIcon,
  seo: Search,
  publicacao: Rss,
}

/* ------------------------------------------------------------------ */
/*  Labels (PT-BR)                                                    */
/* ------------------------------------------------------------------ */

const STAGE_LABELS: Record<Stage, string> = {
  ideia: 'Ideia',
  rascunho: 'Conteúdo',
  imagens: 'Imagens',
  seo: 'SEO',
  publicacao: 'Publicação',
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function StageBar() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()

  if (state.focus) return null

  return (
    <div
      className="ed-stages"
      role="tablist"
      aria-label="Etapas do editor"
      data-testid="stage-bar"
    >
      {STAGES.map((stage) => {
        const isActive = state.activeStage === stage
        const Icon = STAGE_ICON[stage]

        return (
          <button
            key={stage}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            className={['ed-stage', isActive && 'on'].filter(Boolean).join(' ')}
            data-testid={`stage-${stage}`}
            onClick={() => dispatch({ type: 'SET_STAGE', stage })}
          >
            <Icon size={14} />
            <span className="esl">{STAGE_LABELS[stage]}</span>
          </button>
        )
      })}
    </div>
  )
}
