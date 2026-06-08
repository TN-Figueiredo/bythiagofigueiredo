'use client'

import { Eye } from 'lucide-react'
import { useVideoEditorState, useVideoEditorDispatch } from './context'

export function FocusExit() {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  if (!state.focus) return null
  return (
    <button
      type="button"
      data-testid="focus-exit"
      className="focus-exit"
      onClick={() => dispatch({ type: 'TOGGLE_FOCUS' })}
    >
      <Eye size={14} /> <b>Modo foco</b> — clique para sair · <span className="mono">esc</span>
    </button>
  )
}
