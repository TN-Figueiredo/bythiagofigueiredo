'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { hasPipelineDraft } from './pipeline-actions'

const POLL_MS = 5000

/**
 * Enquanto o corpo está vazio e existe item linkado, sonda o pipeline por um
 * draft escrito pelo Cowork. Quando aparece, FULL RELOAD — `router.refresh()`
 * NÃO serve aqui: o EditorProvider usa useReducer(initialState) e o EditorClient
 * é renderizado sem `key`, então um refresh do App Router preserva o estado
 * client e ignora o initialState novo. window.location.reload() remonta tudo e
 * o page.tsx converte o markdown do draft em HTML no load. Seguro: o corpo está
 * vazio por definição (condição do poll) — não há trabalho não-salvo a perder.
 */
export function usePipelineDraftPoll(opts: {
  enabled: boolean
  postId: string | null
  lang: 'pt' | 'en'
}) {
  const stopped = useRef(false)

  useEffect(() => {
    if (!opts.enabled || !opts.postId) return
    stopped.current = false
    const id = window.setInterval(async () => {
      if (stopped.current || document.hidden) return
      try {
        const ready = await hasPipelineDraft(opts.postId as string, opts.lang)
        if (ready && !stopped.current) {
          stopped.current = true
          window.clearInterval(id)
          toast.success('Cowork terminou o rascunho — carregando…')
          window.setTimeout(() => window.location.reload(), 600) // deixa o toast pintar
        }
      } catch { /* transient — tenta no próximo tick */ }
    }, POLL_MS)
    return () => { stopped.current = true; window.clearInterval(id) }
  }, [opts.enabled, opts.postId, opts.lang])
}
