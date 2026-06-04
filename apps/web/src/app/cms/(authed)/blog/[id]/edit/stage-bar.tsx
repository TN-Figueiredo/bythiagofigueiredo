'use client'

import { useEditorState, useEditorDispatch, useEditorVersion } from './context'
import { STAGES, STAGE_ICONS } from './types'
import type { Stage } from './types'
import { imageStats } from './helpers'

/* ------------------------------------------------------------------ */
/*  Labels (PT-BR)                                                    */
/* ------------------------------------------------------------------ */

const STAGE_LABELS: Record<Stage, string> = {
  ideia: 'Ideia',
  rascunho: 'Rascunho',
  imagens: 'Imagens',
  seo: 'SEO',
  publicacao: 'Publicacao',
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function StageBar() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  if (state.focus) return null

  const stats = version?.body
    ? imageStats(version.body, version.coverReady)
    : null
  const hasPending = stats !== null && stats.total > 0 && stats.done < stats.total

  return (
    <nav
      className="flex items-center gap-1 rounded-lg bg-muted p-1"
      aria-label="Editor stages"
      data-testid="stage-bar"
    >
      {STAGES.map((stage) => {
        const isActive = state.activeStage === stage
        const showDot = stage === 'imagens' && hasPending

        return (
          <button
            key={stage}
            type="button"
            role="button"
            data-active={isActive ? 'true' : 'false'}
            className={[
              'relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'active bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
            onClick={() => dispatch({ type: 'SET_STAGE', stage })}
          >
            {STAGE_LABELS[stage]}
            {showDot && (
              <span
                data-pending-dot
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500"
                aria-label="Pending images"
              />
            )}
          </button>
        )
      })}
    </nav>
  )
}
