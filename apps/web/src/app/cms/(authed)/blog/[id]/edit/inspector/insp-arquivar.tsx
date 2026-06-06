'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Archive } from 'lucide-react'
import { useEditorState, useEditorDispatch } from '../context'
import { archivePost } from '../actions'

export function InspArquivar() {
  const state = useEditorState()
  const dispatch = useEditorDispatch()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleArchive() {
    const postId = state.postId
    if (!postId) return

    setPending(true)
    try {
      await archivePost(postId)
      dispatch({ type: 'SET_SHARED', field: 'status', value: 'archived' })
      toast.info('Post arquivado')
      setConfirming(false)
    } catch {
      toast.error('Erro ao arquivar post')
    } finally {
      setPending(false)
    }
  }

  if (confirming) {
    return (
      <div data-testid="insp-arquivar">
        <div className="lang-confirm" style={{ position: 'relative', top: 0, right: 'auto', width: '100%' }}>
          <div className="lc-title">
            <Archive size={14} className="lucide" style={{ color: 'var(--danger)' }} />
            Arquivar este post?
          </div>
          <div className="lc-tx">
            Esta ação não pode ser desfeita.
          </div>
          <div className="lc-actions" data-testid="archive-confirm">
            <button
              type="button"
              data-testid="archive-confirm-cancel"
              className="btn sm"
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="archive-confirm-yes"
              disabled={pending}
              className="btn sm danger"
              onClick={handleArchive}
            >
              <Archive size={13} className="lucide" />
              {pending ? 'Arquivando...' : 'Arquivar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="insp-arquivar">
      <button
        type="button"
        data-testid="archive-btn"
        className="btn sm danger"
        style={{ width: '100%' }}
        onClick={() => setConfirming(true)}
      >
        <Archive size={14} className="lucide" />
        Arquivar post
      </button>
    </div>
  )
}
