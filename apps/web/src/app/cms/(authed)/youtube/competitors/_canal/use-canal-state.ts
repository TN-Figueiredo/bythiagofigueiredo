'use client'
/**
 * Estado da página do canal (spec 5.5, 5.6, 5.7): filtro, ordenação, busca, vista, "Carregar mais" e aba. Vive no navegador e é
 * espelhado na URL com `history.replaceState`, sem navegar: o servidor não relê, e cada troca já vale no mesmo render. A troca de
 * aba (Vídeos, Trocas) usa `history.pushState`: o Voltar do navegador a desfaz, e o `popstate` relê a URL com `parseCanalState`.
 * O resto da URL (`from`, `back`…) fica como está.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { canalQuery, parseCanalState, type CanalState } from './params'

/** Os parâmetros que o estado possui; todos os outros da URL passam intactos. */
const CHAVES = ['tab', 'fmt', 'sort', 'dir', 'q', 'ver', 'n', 'video', 'nums'] as const

/** Escreve o estado na URL atual sem navegar (`push`: uma entrada nova no histórico). A URL é conforto: se o navegador recusar, a tela já mudou. */
export function escreverUrl(next: CanalState, modo: 'replace' | 'push' = 'replace'): void {
  try {
    const q = new URLSearchParams(window.location.search)
    for (const k of CHAVES) q.delete(k)
    for (const [k, v] of new URLSearchParams(canalQuery(next))) q.append(k, v)
    const s = q.toString()
    const url = window.location.pathname + (s ? '?' + s : '') + window.location.hash
    if (modo === 'push') window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
  } catch { /* a URL é conforto */ }
}

export function useCanalState(initial: CanalState): [CanalState, (patch: Partial<CanalState>) => void] {
  const [state, setState] = useState(initial)
  // o último estado, lido na hora: dois patches seguidos no mesmo evento não perdem o primeiro
  const ref = useRef(state)
  const set = useCallback((patch: Partial<CanalState>) => {
    const antes = ref.current, next = { ...antes, ...patch }
    ref.current = next
    setState(next)
    escreverUrl(next, next.tab !== antes.tab ? 'push' : 'replace')
  }, [])
  // o Voltar/Avançar do navegador: a URL é a verdade, o estado a relê
  useEffect(() => {
    const onPop = () => {
      const next = parseCanalState(Object.fromEntries(new URLSearchParams(window.location.search)))
      ref.current = next
      setState(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return [state, set]
}
