'use client'

import Link from 'next/link'
import { ChevronLeft, Eye } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion } from './context'

/* ------------------------------------------------------------------ */
/*  Status display logic                                              */
/* ------------------------------------------------------------------ */

type StatusVariant = 'draft' | 'live' | 'pending' | 'scheduled' | 'archived'

function getStatusDisplay(
  status: string,
  dirty: boolean,
): { label: string; variant: StatusVariant } {
  if (status === 'published' && dirty)
    return { label: 'Alterações pendentes', variant: 'pending' }
  if (status === 'published') return { label: 'Publicado', variant: 'live' }
  if (status === 'scheduled') return { label: 'Agendado', variant: 'scheduled' }
  if (status === 'archived') return { label: 'Arquivado', variant: 'archived' }
  return { label: 'Rascunho', variant: 'draft' }
}

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  scheduled:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  archived: 'bg-muted text-muted-foreground opacity-60',
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface ActionBarProps {
  children?: React.ReactNode
}

export function ActionBar({ children }: ActionBarProps) {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const version = useEditorVersion()

  const dirty = version?.dirty ?? false
  const { label, variant } = getStatusDisplay(state.shared.status, dirty)

  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-[14px]"
      data-testid="action-bar"
    >
      {/* Left region — back + breadcrumb */}
      <Link
        href="/cms/blog"
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Voltar para Blog"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="text-sm font-medium">Blog</span>
      </Link>

      <span className="text-muted-foreground/50" aria-hidden="true">
        &middot;
      </span>

      <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        {state.code}
      </span>

      {/* Optional children (e.g. LangToggle) */}
      {children}

      {/* Center spacer */}
      <div className="flex-1" />

      {/* Right region — status + focus + save */}
      <div className="flex items-center gap-2">
        {/* Status badge */}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
          data-testid="status-badge"
        >
          {label}
        </span>

        {/* Focus toggle */}
        <button
          type="button"
          data-testid="focus-toggle"
          data-active={state.focus ? 'true' : 'false'}
          className={[
            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            state.focus
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          ].join(' ')}
          onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
          aria-label="Modo foco"
        >
          <Eye className="h-4 w-4" />
        </button>

        {/* Save button */}
        <button
          type="button"
          data-testid="save-btn"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={() => dispatch({ type: 'SET_SAVE_STATUS', status: 'saving' })}
        >
          Salvar
        </button>
      </div>
    </header>
  )
}
