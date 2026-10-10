'use client'
/**
 * O Voltar do navegador reabre a grade do canal na mesma rolagem (A1.6). A casca do CMS rola dentro do próprio contêiner (`main`), não no
 * documento, e o navegador e o Next só restauram a rolagem da janela: sem isto o Voltar do Histórico caía no alto da grade, com os mesmos
 * cartões. A rolagem é guardada na sessão quando a pessoa sai por um link (ou fecha a aba), com a URL como chave (o filtro, a ordenação e o `n`
 * já estão nela), e devolvida só quando a página volta por Voltar/Avançar: um `popstate` recente (navegação do Next) ou, na carga do
 * documento, o tipo `back_forward` (navegação inteira). Uma visita nova à mesma URL abre no alto.
 */
import { useEffect, useLayoutEffect } from 'react'

const PREFIXO = 'canal-rolagem:'
/** Quanto tempo depois de um `popstate` uma montagem ainda conta como "voltou". */
const JANELA_POP_MS = 10_000

let ultimoPop = Number.NEGATIVE_INFINITY
let documentoJaMontou = false
if (typeof window !== 'undefined') window.addEventListener('popstate', () => { ultimoPop = Date.now() })

const chave = () => PREFIXO + window.location.pathname + window.location.search

/** O contêiner que rola: o ancestral mais próximo com overflow-y rolável; senão o documento. */
function rolavel(raiz: Element | null): HTMLElement {
  for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll' || o === 'overlay') return p
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

function guardar(): void {
  try {
    const el = rolavel(document.querySelector('[data-obs-screen="canal"]'))
    window.sessionStorage.setItem(chave(), String(Math.round(el.scrollTop)))
  } catch { /* a rolagem é conforto */ }
}

export function useRolagemAoVoltar(): void {
  useLayoutEffect(() => {
    let voltou = Date.now() - ultimoPop < JANELA_POP_MS
    if (!documentoJaMontou) {
      documentoJaMontou = true
      const nav = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('navigation')[0] : undefined
      if ((nav as PerformanceNavigationTiming | undefined)?.type === 'back_forward') voltou = true
    }
    if (!voltou) return
    try {
      const k = chave(), salvo = window.sessionStorage.getItem(k)
      if (salvo == null) return
      window.sessionStorage.removeItem(k)
      const top = Number(salvo)
      if (!Number.isFinite(top) || top <= 0) return
      const el = rolavel(document.querySelector('[data-obs-screen="canal"]'))
      el.scrollTop = top
      // a casca pode terminar de montar (barra lateral recolhendo) um quadro depois: confere uma vez
      requestAnimationFrame(() => { if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top })
    } catch { /* a rolagem é conforto */ }
  }, [])
  useEffect(() => {
    // capture: antes de qualquer navegação por link; pagehide cobre fechar a aba e a navegação inteira por URL digitada
    const aoClicar = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href]')) guardar() }
    document.addEventListener('click', aoClicar, true)
    window.addEventListener('pagehide', guardar)
    return () => { document.removeEventListener('click', aoClicar, true); window.removeEventListener('pagehide', guardar) }
  }, [])
}
