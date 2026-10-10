'use client'
/**
 * Estado da página do canal (spec 5.5, 5.6): filtro, ordenação, busca, vista, "Carregar mais" e aba. Vive no navegador e é
 * espelhado na URL com `history.replaceState`, sem navegar: o servidor não relê, e cada troca já vale no mesmo render. O resto da
 * URL (`from`, `back`…) fica como está.
 */
import { useCallback, useRef, useState } from 'react'
import { canalQuery, type CanalState } from './params'

/** Os parâmetros que o estado possui; todos os outros da URL passam intactos. */
const CHAVES = ['tab', 'fmt', 'sort', 'dir', 'q', 'ver', 'n', 'video', 'nums'] as const

/** Escreve o estado na URL atual sem navegar. A URL é conforto: se o navegador recusar, a tela já mudou. */
export function escreverUrl(next: CanalState): void {
  try {
    const q = new URLSearchParams(window.location.search)
    for (const k of CHAVES) q.delete(k)
    for (const [k, v] of new URLSearchParams(canalQuery(next))) q.append(k, v)
    const s = q.toString()
    window.history.replaceState(null, '', window.location.pathname + (s ? '?' + s : '') + window.location.hash)
  } catch { /* a URL é conforto */ }
}

export function useCanalState(initial: CanalState): [CanalState, (patch: Partial<CanalState>) => void] {
  const [state, setState] = useState(initial)
  // o último estado, lido na hora: dois patches seguidos no mesmo evento não perdem o primeiro
  const ref = useRef(state)
  const set = useCallback((patch: Partial<CanalState>) => {
    const next = { ...ref.current, ...patch }
    ref.current = next
    setState(next)
    escreverUrl(next)
  }, [])
  return [state, set]
}
