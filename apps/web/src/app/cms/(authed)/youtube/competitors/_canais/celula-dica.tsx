'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { HoverTip, useTipShown } from '../_chrome/flut/flut'
import './celula-dica.css'

export const CELULA_DICA_CLASSE = 'cdica'
const FECHAR_OUTRAS = 'canais:cdica-abriu'
const ATIVA = 'canais:cdica-ativa'
const LINHA = '[data-id]'

/** O grupo de Tab de uma dica: a linha (ou cartão) onde ela está; fora de uma linha, o pai. */
const grupoDe = (el: HTMLElement | null): HTMLElement | null => el?.closest<HTMLElement>(LINHA) ?? el?.parentElement ?? null
/** Escondida por display:none nela ou num ancestral até a linha (ex.: `.drawer-open .c-hide`). */
const visivel = (el: HTMLElement, g: HTMLElement): boolean => { for (let n: HTMLElement | null = el; n; n = n === g ? null : n.parentElement) if (getComputedStyle(n).display === 'none') return false; return true }
const irmas = (g: HTMLElement | null): HTMLElement[] => (g ? [...g.querySelectorAll<HTMLElement>('[data-cdica]')] : [])

/** A mesma máquina do `Tip` de cells.tsx (hov e foc separados; Esc fecha e mantém o foco; `shown` = a caixa está de fato no documento). */
export function useDica() {
  const [hov, setHov] = useState(false), [foc, setFoc] = useState(false), [toque, setToque] = useState(false)
  const show = hov || foc || toque
  const shown = useTipShown(show)
  const fechar = () => { setHov(false); setFoc(false); setToque(false) }
  return {
    show, shown, aberta: show,
    handlers: {
      onMouseEnter: () => setHov(true), onMouseLeave: () => setHov(false), onFocus: () => setFoc(true), onBlur: () => setFoc(false),
      onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Escape' && show) { e.stopPropagation(); fechar() } },
    },
    // Re-revisão C2: aberta por QUALQUER meio (hover, foco emulado pelo toque, toque anterior), o toque fecha tudo. `setToque(t => !t)` deixava hov/foc abertos.
    abrirPorToque: () => (show ? fechar() : setToque(true)),
    fechar,
    /** O foco saiu: some o que o teclado abriu (foco e Enter), o mouse que ainda está em cima segura a caixa. */
    desfocar: () => { setFoc(false); setToque(false) },
  }
}

/** A5 2ª leva: a dica de uma célula da lista. Hover e foco abrem, Enter/Espaço e toque alternam, Esc fecha; toque fora ou noutra dica fecha. Sem title nativo. */
export function CelulaDica({ texto, children, className }: { texto: string; children: ReactNode; className?: string }) {
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const ultimoPonteiro = useRef<string>('mouse') // Naksu A6: depois de um toque o navegador dá mouseenter e foco emulados; evita abrir de novo pelo mouseenter/foco emulados e o `avisar()` duplicado
  const d = useDica()
  // Gio F2a (roving): cada linha tem UMA parada de Tab entre as suas dicas (a ativa; a primeira até o foco passar por ali); as setas esquerda e direita andam entre elas.
  // Sem isto, cada célula virava uma parada e o Tab por linha da lista (nome, ações, próxima linha) ficava preso em ~8 dicas por canal.
  const [tab, setTab] = useState(false)
  useEffect(() => {
    const el = ref.current, g = grupoDe(el)
    if (!el || !g) return
    // Re-revisão N1: a ativa só vale se ainda está na linha E visível (coluna escondida por `.drawer-open .c-hide` não é parada de Tab); senão a primeira visível da linha assume.
    const calcula = () => {
      const todas = irmas(g)
      const viva = todas.some(x => x.dataset.cdicaId === g.dataset.cdicaAtiva && visivel(x, g))
      const ativa = viva ? g.dataset.cdicaAtiva : undefined
      setTab(ativa ? ativa === id : (todas.find(x => visivel(x, g)) ?? todas[0]) === el)
    }
    calcula()
    g.addEventListener(ATIVA, calcula)
    return () => { g.removeEventListener(ATIVA, calcula); g.dispatchEvent(new Event(ATIVA)) }
  }, [id])
  const ativar = () => { const g = grupoDe(ref.current); if (g) { g.dataset.cdicaAtiva = id; g.dispatchEvent(new Event(ATIVA)) } }
  // Yannis M2: os ouvintes globais só existem enquanto ESTA dica está aberta (O(1) por evento, não O(linhas × colunas)).
  useEffect(() => {
    if (!d.aberta) return
    const outra = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) d.fechar() }
    const fora = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) d.fechar() }
    window.addEventListener(FECHAR_OUTRAS, outra)
    document.addEventListener('pointerdown', fora)
    return () => { window.removeEventListener(FECHAR_OUTRAS, outra); document.removeEventListener('pointerdown', fora) }
  }, [d.aberta, id]) // eslint-disable-line react-hooks/exhaustive-deps -- `d.fechar` é estável em comportamento
  const avisar = () => window.dispatchEvent(new CustomEvent(FECHAR_OUTRAS, { detail: id }))
  const alternar = () => { if (d.aberta) d.fechar(); else { avisar(); d.abrirPorToque() } }
  // Gio leva 2 (menor): Enter/Espaço com a dica já aberta (pelo foco) a MANTÊM aberta; só abre se estava fechada. Fechar é Esc, Tab ou sair.
  const abrirPorTeclado = () => { if (!d.aberta) { avisar(); d.abrirPorToque() } }
  return (
    <span
      ref={ref} role="button" tabIndex={tab ? 0 : -1} data-cdica="" data-cdica-id={id} aria-expanded={d.aberta} aria-describedby={d.shown ? id : undefined}
      className={`${CELULA_DICA_CLASSE}${d.aberta ? ' on' : ''}${className ? ' ' + className : ''}`}
      onPointerDownCapture={e => { ultimoPonteiro.current = e.pointerType }}
      onMouseEnter={() => { if (ultimoPonteiro.current === 'touch') return; avisar(); d.handlers.onMouseEnter() }}
      onMouseLeave={d.handlers.onMouseLeave}
      onFocus={() => { ativar(); if (ultimoPonteiro.current === 'touch') return; avisar(); d.handlers.onFocus() }}
      // Yannis I1: o foco sair da célula FECHA a dica do teclado (aberta por Enter, ela ficava sobre a tabela e o Esc, sem foco, não a fechava)
      onBlur={e => {
        ultimoPonteiro.current = 'mouse'; d.desfocar()
        // N1: o foco saiu da linha => esquece a ativa (a primeira volta a ser a parada de Tab)
        const g = grupoDe(ref.current)
        if (g && !g.contains(e.relatedTarget as Node | null)) { delete g.dataset.cdicaAtiva; g.dispatchEvent(new Event(ATIVA)) }
      }}
      onKeyDown={e => {
        // Naksu A7: Enter e Espaço alternam (a caixa antes só abria pelo foco). Só quando o foco está no próprio gatilho, não num link dentro dele.
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); abrirPorTeclado(); return }
        if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target === e.currentTarget) {
          const todas = irmas(grupoDe(ref.current)), i = todas.indexOf(e.currentTarget as HTMLElement), alvo = todas[i + (e.key === 'ArrowRight' ? 1 : -1)]
          if (alvo) { e.preventDefault(); alvo.focus() }
          return
        }
        d.handlers.onKeyDown(e)
      }}
      // Toque: alterna. Sem stopPropagation (Yannis M3): o painel do canal não abre porque a LINHA exclui `.cdica` do seu clique (Tarefa 8, testado), e o `stopPropagation` do React 19 esconderia o clique de ouvintes de document (menu "Mais ações", popover).
      onPointerDown={e => { if (e.pointerType === 'touch') alternar() }}
    >
      {children}
      <HoverTip show={d.show} anchor={() => ref.current} id={id} className="cn-tt" pref="baixo" align="meio" maxW={270}>{texto}</HoverTip>
    </span>
  )
}
