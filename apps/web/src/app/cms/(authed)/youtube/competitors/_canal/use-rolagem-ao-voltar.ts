'use client'
/**
 * O Voltar do navegador reabre a grade do canal na mesma rolagem (A1.6). A casca do CMS rola dentro do próprio contêiner (`main`), não no
 * documento, e o navegador e o Next só restauram a rolagem da janela: sem isto o Voltar do Histórico caía no alto da grade, com os mesmos
 * cartões. A rolagem é guardada na sessão quando a pessoa sai por um link (ou fecha a aba), com a URL como chave (o filtro, a ordenação e o `n`
 * já estão nela), e devolvida só quando a página volta por Voltar/Avançar: um `popstate` recente (navegação do Next) ou, na carga do
 * documento, o tipo `back_forward` (navegação inteira). Uma visita nova à mesma URL abre no alto.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const PREFIXO = 'canal-rolagem:'
/** Quanto tempo depois de um `popstate` uma montagem ainda conta como "voltou". */
const JANELA_POP_MS = 10_000

const CHAVE_POP = 'canal-rolagem-pop'
let ultimoPop = Number.NEGATIVE_INFINITY
let documentoJaMontou = false
// capture: o roteador do Next também ouve `popstate`; aqui o aviso vem antes. O instante vai também para a sessão: em desenvolvimento o módulo pode
// ser avaliado de novo na volta (a cópia nova não viu o evento), e a montagem precisa saber que acabou de haver um Voltar.
let esperaVoltar = 0
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    ultimoPop = Date.now()
    try { window.sessionStorage.setItem(CHAVE_POP, String(ultimoPop)) } catch { /* conforto */ }
    // Voltar por navegação suave: o Next devolve a rota sem remontar a tela e só depois de a rede responder (em desenvolvimento, mais de um segundo),
    // então os efeitos do React não servem de gatilho. Fica de olho até aparecer uma tela do canal visível e devolve a rolagem guardada para a URL.
    cancelAnimationFrame(esperaVoltar)
    let n = 0
    const espera = () => {
      if (document.querySelector('[data-obs-screen="canal"]') && [...document.querySelectorAll('[data-obs-screen="canal"]')].some(e => e.getClientRects().length > 0)) { restaurar(); avisarVoltou(); return }
      if (++n < 180) esperaVoltar = requestAnimationFrame(espera)
    }
    esperaVoltar = requestAnimationFrame(espera)
  }, true)
}
/** Há quanto tempo foi o último `popstate` (o da memória ou o da sessão). */
function haQuantoPop(): number {
  let t = ultimoPop
  try { const g = Number(window.sessionStorage.getItem(CHAVE_POP)); if (Number.isFinite(g) && g > t) t = g } catch { /* conforto */ }
  return Date.now() - t
}

/** Quem quer saber que a página voltou (o foco no último vídeo visto): as telas do canal montadas, com a raiz para saber qual delas está à vista. */
const ouvintes = new Set<{ raiz?: RefObject<HTMLElement | null>; fn: () => void }>()
/** Avisa as telas à vista (a cópia escondida que o Next 16 mantém depois de um Voltar não ouve). */
function avisarVoltou(): void {
  for (const o of ouvintes) {
    const el = o.raiz?.current
    if (!el || el.getClientRects().length > 0) o.fn()
  }
}

const chave = () => PREFIXO + window.location.pathname + window.location.search

/** O contêiner que rola: o ancestral mais próximo com overflow-y rolável; senão o documento. */
function rolavel(raiz: Element | null): HTMLElement {
  for (let p = raiz?.parentElement ?? null; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll' || o === 'overlay') return p
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}

/** A raiz desta tela (nunca a cópia escondida que o Next 16 mantém depois de um Voltar); sem a ref, a primeira do documento. */
const daTela = (raiz?: RefObject<HTMLElement | null>): Element | null =>
  raiz?.current ?? [...document.querySelectorAll('[data-obs-screen="canal"]')].find(e => e.getClientRects().length > 0) ?? document.querySelector('[data-obs-screen="canal"]')

function guardar(raiz?: RefObject<HTMLElement | null>): void {
  try {
    const el = rolavel(daTela(raiz))
    window.sessionStorage.setItem(chave(), String(Math.round(el.scrollTop)))
  } catch { /* a rolagem é conforto */ }
}

/** Devolve a rolagem guardada para a URL de agora (e a consome). Depois da montagem alguém ainda mexe na rolagem: a tela cresce (a casca termina de
 *  montar, o estado do cliente — `n`, a ordem — é reconciliado com a URL), e o Next, quando a rota volta pela rede, rola o segmento para o alto
 *  quando o RSC chega (em desenvolvimento, segundos depois). Por isso a rolagem é reafirmada a cada quadro por meio segundo e, depois, sempre que
 *  algo a tirar do lugar, por até 6 s; qualquer gesto da pessoa (roda, toque, tecla, clique) encerra tudo. */
function restaurar(raiz?: RefObject<HTMLElement | null>): void {
  try {
    const k = chave(), salvo = window.sessionStorage.getItem(k)
    if (salvo == null) return
    window.sessionStorage.removeItem(k)
    const top = Number(salvo)
    if (!Number.isFinite(top) || top <= 0) return
    const el = rolavel(daTela(raiz))
    el.scrollTop = top
    const longe = () => Math.abs(el.scrollTop - top) > 1
    const eventos = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const
    let fim = 0, quadro = 0, tentativas = 0
    const para = () => {
      clearTimeout(fim); cancelAnimationFrame(quadro)
      el.removeEventListener('scroll', aoRolar)
      for (const ev of eventos) window.removeEventListener(ev, para)
    }
    const aoRolar = () => { if (longe()) el.scrollTop = top }
    el.addEventListener('scroll', aoRolar, { passive: true })
    for (const ev of eventos) window.addEventListener(ev, para, { passive: true })
    fim = window.setTimeout(para, 6000)
    const reafirma = () => {
      if (longe()) el.scrollTop = top
      if (++tentativas < 30) quadro = requestAnimationFrame(reafirma)
    }
    quadro = requestAnimationFrame(reafirma)
  } catch { /* a rolagem é conforto */ }
}

/** `aoVoltar` roda uma vez por Voltar, quando a tela do canal volta à vista (montagem nova ou rota que o Next devolve sem remontar). */
export function useRolagemAoVoltar(raiz?: RefObject<HTMLElement | null>, aoVoltar?: () => void): void {
  const fn = useRef(aoVoltar)
  useLayoutEffect(() => { fn.current = aoVoltar })
  // montagem nova (volta por navegação inteira, ou a rota remontada)
  useLayoutEffect(() => {
    let voltou = haQuantoPop() < JANELA_POP_MS
    if (!documentoJaMontou) {
      documentoJaMontou = true
      const nav = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function' ? performance.getEntriesByType('navigation')[0] : undefined
      if ((nav as PerformanceNavigationTiming | undefined)?.type === 'back_forward') voltou = true
    }
    if (voltou) { restaurar(raiz); fn.current?.() }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps -- a ref é estável
  useEffect(() => {
    const o = { raiz, fn: () => fn.current?.() }
    ouvintes.add(o)
    return () => { ouvintes.delete(o) }
  }, [raiz])
  useEffect(() => {
    // capture: antes de qualquer navegação por link; pagehide cobre fechar a aba e a navegação inteira por URL digitada
    const aoClicar = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href]')) guardar(raiz) }
    const aoSair = () => guardar(raiz)
    document.addEventListener('click', aoClicar, true)
    window.addEventListener('pagehide', aoSair)
    return () => { document.removeEventListener('click', aoClicar, true); window.removeEventListener('pagehide', aoSair) }
  }, [raiz])
}
