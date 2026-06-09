'use client'

import { useState } from 'react'
import { Pencil, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { retreatPipelineItem } from '@/app/cms/(authed)/pipeline/actions'
import { useEditMode, useVideoEditorState, useVideoEditorDispatch, useSetLiveVersion } from '../context'
import { isContentLockedStage } from '../types'

/**
 * Compact, icon-only View/Edit toggle that lives in the header next to the focus eye.
 * Pencil = content editing (muted in view mode, lit-accent when editing). When the stage
 * is published/scheduled the content is hard-locked: a Lock button retreats the stage
 * (with a confirm) so the user explicitly un-publishes before editing.
 */
export function EditModeToggle() {
  const { mode, locked, setMode } = useEditMode()
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const setLiveVersion = useSetLiveVersion()
  const [busy, setBusy] = useState(false)

  if (locked) {
    const onUnpublish = async () => {
      if (busy) return
      if (typeof window !== 'undefined' && !window.confirm('Despublicar pra editar? O vídeo sai do ar até você publicar de novo.')) return
      setBusy(true)
      try {
        const res = await retreatPipelineItem(state.itemId, state.version)
        if (!res.ok) {
          toast.error(res.error === 'Version conflict' ? 'Versão desatualizada — recarregue a página.' : 'Não foi possível despublicar.')
          return
        }
        const updated = res.data as { stage?: string; version?: number } | undefined
        if (updated?.stage) dispatch({ type: 'SET_DB_STAGE', stage: updated.stage })
        if (typeof updated?.version === 'number') {
          dispatch({ type: 'SET_VERSION', version: updated.version })
          setLiveVersion(updated.version)
        }
        // published→scheduled retreats ONE step but scheduled is still content-locked: only
        // enter edit mode when the new stage actually unlocks content; otherwise stay in view.
        if (updated?.stage && isContentLockedStage(updated.stage)) {
          toast('Ainda travado — despublique mais uma etapa pra editar.')
        } else {
          setMode('edit')
          toast.success('Despublicado — agora você pode editar.')
        }
      } finally {
        setBusy(false)
      }
    }
    return (
      <button
        type="button"
        className="ed-iconbtn ed-editlock"
        title="Publicado — conteúdo travado. Clique para despublicar e editar."
        aria-label={busy ? 'Despublicando para poder editar' : 'Conteúdo publicado e travado — despublicar para editar'}
        aria-busy={busy}
        onClick={onUnpublish}
        disabled={busy}
      >
        <Lock size={16} />
      </button>
    )
  }

  const editing = mode === 'edit'
  return (
    <button
      type="button"
      className={`ed-iconbtn ed-editmode${editing ? ' on' : ''}`}
      aria-pressed={editing}
      title={editing ? 'Editando — clique para voltar a visualizar (somente leitura)' : 'Visualizando (somente leitura) — clique para editar'}
      onClick={() => setMode(editing ? 'view' : 'edit')}
    >
      <Pencil size={16} />
    </button>
  )
}
