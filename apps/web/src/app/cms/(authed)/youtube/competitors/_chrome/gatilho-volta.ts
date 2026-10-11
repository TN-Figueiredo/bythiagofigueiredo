'use client'
/**
 * O gatilho de "Comparar" que a pessoa usou (spec 3, tabela de entradas: "a lista de origem (Canais) ou o canal de origem, com foco no gatilho";
 * D18). O navegador devolve a rolagem, não o foco: o clique grava aqui o canal e o lugar (a lista de Canais ou o cabeçalho do canal), e quem
 * volta (popstate) lê, põe o foco no gatilho e apaga. `sessionStorage`, sempre em try/catch: sem ele a página volta como volta o navegador
 * (conforto, nunca requisito). O registro leva um carimbo e expira (30 min), como o do último vídeo visto.
 */
import { useEffect, useRef, type RefObject } from 'react'

export type LugarDoGatilho = 'canais' | 'canal'
const CHAVE = 'obs:gatilho-comparar'
const VALE_MS = 30 * 60_000
/** Quanto tempo depois de um `popstate` uma montagem nova ainda conta como "voltou". */
const JANELA_POP_MS = 10_000

/** `origem`: a URL (pathname + query) da tela de onde a pessoa saiu pelo gatilho. O registro só vale para a tela que volta SE ela é essa URL. */
interface Guardado { lugar: LugarDoGatilho; canalId: string; t: number; origem: string }

const urlAgora = (): string => `${window.location.pathname}${window.location.search}`

function apagar(): void { try { window.sessionStorage.removeItem(CHAVE) } catch { /* conforto */ } }

export function lembrarGatilho(lugar: LugarDoGatilho, canalId: string): void {
  // o ouvinte do módulo pode não existir na cópia que a tela remontada carrega (desenvolvimento): quem sai pelo gatilho deixa um ouvinte vivo no documento, que
  // anota na sessão o Voltar que vem a seguir
  if (typeof window !== 'undefined') window.addEventListener('popstate', marcarPop, { capture: true, once: true })
  try { window.sessionStorage.setItem(CHAVE, JSON.stringify({ lugar, canalId, t: Date.now(), origem: urlAgora() } satisfies Guardado)) } catch { /* conforto */ }
}

/** O canal do gatilho lembrado para este lugar, ou null (sem registro, de outro lugar, velho ou estragado). Lê e apaga; o registro de outro lugar fica. */
export function lerGatilho(lugar: LugarDoGatilho): string | null {
  try {
    const raw = window.sessionStorage.getItem(CHAVE)
    if (raw == null) return null
    let g: Partial<Guardado> | null = null
    try { g = JSON.parse(raw) as Partial<Guardado> } catch { g = null }
    const bom = !!g && typeof g === 'object' && (g.lugar === 'canais' || g.lugar === 'canal') && typeof g.canalId === 'string' && g.canalId !== ''
      && typeof g.t === 'number' && Date.now() - g.t <= VALE_MS && g.t - Date.now() <= 60_000 && typeof g.origem === 'string' && g.origem !== ''
    if (!bom) { apagar(); return null }
    if (g!.lugar !== lugar) return null
    // quem saiu da comparação por OUTRO caminho (trilha, link, atalho "Meu canal") deixou o registro vivo: um Voltar para outra tela, ou para a mesma
    // tela noutra URL, não é o Voltar que ele esperava
    if (g!.origem !== urlAgora()) { apagar(); return null }
    apagar()
    return g!.canalId!
  } catch { return null }
}

/** O instante do último `popstate`: em memória e na sessão (em desenvolvimento o módulo pode ser avaliado de novo na volta, e a cópia nova não viu o evento). */
const CHAVE_POP = 'obs:gatilho-pop'
let ultimoPop = Number.NEGATIVE_INFINITY
function marcarPop(): void {
  ultimoPop = Date.now()
  try { window.sessionStorage.setItem(CHAVE_POP, String(ultimoPop)) } catch { /* conforto */ }
}
if (typeof window !== 'undefined') window.addEventListener('popstate', marcarPop, true)
function haQuantoPop(): number {
  let t = ultimoPop
  try {
    const raw = window.sessionStorage.getItem(CHAVE_POP)
    const g = raw == null ? Number.NaN : Number(raw)
    if (Number.isFinite(g) && g > t) t = g
  } catch { /* conforto */ }
  return Date.now() - t
}

/** Uma montagem que NÃO veio de um Voltar descarta o registro deste lugar: ele pertencia a uma saída que não voltou por aqui. O de outro lugar fica. */
export function descartarGatilhoSeNaoVoltou(lugar: LugarDoGatilho): void {
  try {
    if (haQuantoPop() < JANELA_POP_MS) return
    const raw = window.sessionStorage.getItem(CHAVE)
    if (raw == null) return
    let g: Partial<Guardado> | null = null
    try { g = JSON.parse(raw) as Partial<Guardado> } catch { g = null }
    if (!g || typeof g !== 'object' || g.lugar === lugar) apagar()
  } catch { /* conforto */ }
}

const visivel = (el: Element): boolean => el.getClientRects().length > 0

/**
 * Depois de um Voltar, põe o foco no gatilho lembrado. O Next 16 devolve a rota sem remontar a tela (e a cópia antiga fica escondida no
 * documento), ou remonta: os dois casos são cobertos. Espera a raiz DESTA tela estar à vista (por ref, nunca por id global) e só então lê o
 * registro, que vale um Voltar só. `achar` recebe o canal e devolve o elemento dentro da raiz.
 */
export function useFocoAoVoltar(lugar: LugarDoGatilho, raiz: RefObject<HTMLElement | null>, achar: (canalId: string, raiz: HTMLElement) => HTMLElement | null): void {
  const fn = useRef(achar)
  useEffect(() => { fn.current = achar })
  useEffect(() => {
    let quadro = 0
    const esperar = () => {
      cancelAnimationFrame(quadro)
      let n = 0
      const passo = () => {
        const el = raiz.current
        if (el && visivel(el)) {
          const id = lerGatilho(lugar)
          if (id) fn.current(id, el)?.focus({ preventScroll: true })
          return
        }
        if (++n < 180) quadro = requestAnimationFrame(passo)
      }
      quadro = requestAnimationFrame(passo)
    }
    window.addEventListener('popstate', esperar, true)
    // montagem nova logo depois de um Voltar. Num macrotarefa depois: o roteador do Next remonta a tela dentro do próprio `popstate`, antes de o ouvinte que anota o
    // instante rodar, então a leitura imediata ainda não o vê
    const depois = window.setTimeout(() => { if (haQuantoPop() < JANELA_POP_MS) esperar(); else descartarGatilhoSeNaoVoltou(lugar) }, 0)
    return () => { window.removeEventListener('popstate', esperar, true); window.clearTimeout(depois); cancelAnimationFrame(quadro) }
  }, [lugar, raiz])
}
