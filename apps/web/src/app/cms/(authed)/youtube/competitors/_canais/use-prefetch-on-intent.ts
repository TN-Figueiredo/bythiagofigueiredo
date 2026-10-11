'use client'
/**
 * Pré-carga da página do canal por intenção (decisão D10): 150 ms de hover ou de foco num link chamam `router.prefetch(href)`;
 * sair antes disso cancela. No máximo 3 pré-cargas em andamento ao mesmo tempo, na tela inteira: com 3 em andamento a
 * intenção é descartada (a próxima, depois de uma vaga, vale). Sem cabeçalho otimista: a página só aparece quando chega.
 * `router.prefetch` do App Router não devolve promessa; sem uma, a vaga é devolvida depois de PREFETCH_LEASE_MS.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

export const PREFETCH_DELAY_MS = 150
export const PREFETCH_MAX = 3
export const PREFETCH_LEASE_MS = 1500

let inflight = 0

export function usePrefetchOnIntent(href: string | null) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cancel = useCallback(() => { clearTimeout(timer.current); timer.current = undefined }, [])
  useEffect(() => cancel, [cancel])
  const start = useCallback(() => {
    if (!href || timer.current !== undefined) return
    timer.current = setTimeout(() => {
      timer.current = undefined
      if (inflight >= PREFETCH_MAX) return
      inflight++
      let freed = false
      const free = () => { if (!freed) { freed = true; inflight = Math.max(0, inflight - 1) } }
      try {
        const r: unknown = router.prefetch(href)
        if (r && typeof (r as PromiseLike<unknown>).then === 'function') (r as PromiseLike<unknown>).then(free, free)
        else setTimeout(free, PREFETCH_LEASE_MS)
      } catch { free() }
    }, PREFETCH_DELAY_MS)
  }, [href, router])
  return { onMouseEnter: start, onMouseLeave: cancel, onFocus: start, onBlur: cancel }
}
