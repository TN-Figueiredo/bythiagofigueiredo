'use client'

import Link from 'next/link'
import { Check, ChevronLeft, Eye, Pencil, SlidersHorizontal } from 'lucide-react'
import { useEditorState, useEditorDispatch, useEditorVersion, useSaveActions, useAutosaveState } from './context'

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
  const { saveNow } = useSaveActions()
  const autosave = useAutosaveState()

  const dirty = version?.dirty ?? false
  const { label, variant } = getStatusDisplay(state.shared.status, dirty)

  return (
    <header
      className="ed-bar"
      data-testid="action-bar"
    >
      {/* Left region — breadcrumb nav */}
      <nav className="ed-bc" aria-label="Breadcrumb">
        <Link
          href="/cms/blog"
          className="eb-back"
          aria-label="Voltar para Blog"
        >
          <ChevronLeft size={15} />
          Voltar
        </Link>
        <span className="msep" aria-hidden="true">/</span>
        <Link href="/cms/blog" className="eb-back" style={{ gap: 0 }}>
          Blog
        </Link>
        <span className="msep" aria-hidden="true">/</span>
        <span className="eb-code">{state.code}</span>
      </nav>

      {/* Center spacer */}
      <div className="grow" />

      {/* Optional children (e.g. LangToggle) */}
      {children}

      {/* Status badge */}
      <span
        className={`ed-status ${variant}`}
        data-testid="status-badge"
      >
        <span className="es-dot" />
        {label}
      </span>

      {/* Edit-mode toggle — pencil (paridade com o editor de vídeo). Publicado/
          agendado abre em view; o lápis liga a edição explicitamente. */}
      <button
        type="button"
        data-testid="editmode-toggle"
        className={`ed-iconbtn${state.editMode === 'edit' ? ' on' : ''}`}
        aria-pressed={state.editMode === 'edit'}
        title={state.editMode === 'edit'
          ? 'Editando — clique para voltar a visualizar (somente leitura)'
          : 'Visualizando (somente leitura) — clique para editar'}
        aria-label={state.editMode === 'edit' ? 'Desligar edição' : 'Editar post'}
        onClick={() => dispatch({ type: 'SET_EDIT_MODE', mode: state.editMode === 'edit' ? 'view' : 'edit' })}
      >
        <Pencil size={16} />
      </button>

      {/* Inspector toggle — opens/closes details drawer */}
      <button
        type="button"
        data-testid="inspector-toggle"
        className={`ed-iconbtn${state.inspectorOpen ? ' on' : ''}`}
        title="Detalhes do post"
        aria-label="Detalhes do post"
        onClick={() => dispatch({ type: 'TOGGLE_INSPECTOR' })}
      >
        <SlidersHorizontal size={16} />
      </button>

      {/* Focus toggle — distraction-free writing */}
      <button
        type="button"
        data-testid="focus-toggle"
        data-active={state.focus ? 'true' : 'false'}
        className={`ed-iconbtn${state.focus ? ' on' : ''}`}
        title="Modo foco (Esc)"
        onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
        aria-label="Modo foco"
      >
        <Eye size={16} />
      </button>

      {/* Save button — reflects autosave state */}
      <button
        type="button"
        data-testid="save-btn"
        disabled={autosave.state === 'saving'}
        className="btn sm primary"
        onClick={() => saveNow()}
        aria-label="Salvar (Ctrl+S)"
      >
        <Check size={14} />
        {autosave.state === 'saving' ? 'Salvando...'
          : autosave.state === 'error' ? 'Erro'
          : autosave.state === 'offline' ? 'Offline'
          : 'Salvar'}
      </button>
    </header>
  )
}
