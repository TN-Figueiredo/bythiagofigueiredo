'use client'
/**
 * "A janela é estreita?" (largura <= `px`), lida do navegador por `matchMedia` e assinada com `useSyncExternalStore`: no servidor e na hidratação
 * devolve `false` (a marcação de desktop), e o cliente corrige logo depois. Não é container query de propósito: o menu ⋯ mora em `#flut`, fora do
 * contêiner `obscontent`. O limiar de 480 px é o único das molduras do topo (design D-A da 11c); o CSS usa o mesmo número.
 */
import { useSyncExternalStore } from 'react'

export const LARGURA_ESTREITA = 480

export function useJanelaEstreita(px: number = LARGURA_ESTREITA): boolean {
  return useSyncExternalStore(
    aviso => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
      const mq = window.matchMedia(`(max-width: ${px}px)`)
      mq.addEventListener('change', aviso)
      return () => mq.removeEventListener('change', aviso)
    },
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(`(max-width: ${px}px)`).matches,
    () => false,
  )
}
