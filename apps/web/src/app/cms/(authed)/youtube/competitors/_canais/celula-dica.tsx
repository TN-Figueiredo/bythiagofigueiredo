'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { HoverTip, useTipShown } from '../_chrome/flut/flut'
import './celula-dica.css'

export const CELULA_DICA_CLASSE = 'cdica'
const FECHAR_OUTRAS = 'canais:cdica-abriu'

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
  }
}

/** A5 2ª leva: a dica de uma célula da lista. Hover e foco abrem, Enter/Espaço e toque alternam, Esc fecha; toque fora ou noutra dica fecha. Sem title nativo. */
export function CelulaDica({ texto, children, className }: { texto: string; children: ReactNode; className?: string }) {
  const id = useId()
  const ref = useRef<HTMLSpanElement>(null)
  const ultimoPonteiro = useRef<string>('mouse') // Naksu A6: depois de um toque o navegador dá mouseenter e foco emulados; sem isto o 2º toque não fecha
  const d = useDica()
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
  return (
    <span
      ref={ref} role="button" tabIndex={0} aria-expanded={d.aberta} aria-describedby={d.shown ? id : undefined}
      className={`${CELULA_DICA_CLASSE}${d.aberta ? ' on' : ''}${className ? ' ' + className : ''}`}
      onPointerDownCapture={e => { ultimoPonteiro.current = e.pointerType }}
      onMouseEnter={() => { if (ultimoPonteiro.current === 'touch') return; avisar(); d.handlers.onMouseEnter() }}
      onMouseLeave={d.handlers.onMouseLeave}
      onFocus={() => { if (ultimoPonteiro.current === 'touch') return; avisar(); d.handlers.onFocus() }}
      onBlur={() => { ultimoPonteiro.current = 'mouse'; d.handlers.onBlur() }} // sair da célula devolve o foco por teclado ao normal
      onKeyDown={e => {
        // Naksu A7: Enter e Espaço alternam (a caixa antes só abria pelo foco). Só quando o foco está no próprio gatilho, não num link dentro dele.
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); alternar(); return }
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
