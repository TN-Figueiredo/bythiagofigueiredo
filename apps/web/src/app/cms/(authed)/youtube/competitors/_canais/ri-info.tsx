'use client'
/** O ⓘ de cada seção: botão + popover nativo. Esc fecha e devolve o foco ao botão; `aria-expanded` segue o `toggle`. */
import { useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react'

export function RiInfo({ titulo, itens, rotuloBotao, aoMudar }: { titulo: string; itens: string[]; rotuloBotao: string; /** quem está em volta (um diálogo com Esc) precisa saber se o ⓘ está aberto */ aoMudar?: (aberto: boolean) => void }) {
  const id = useId()
  const botao = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [aberto, setAberto] = useState(false)

  function posiciona() {
    const b = botao.current
    const p = pop.current
    if (!b || !p) return
    const r = b.getBoundingClientRect()
    const w = Math.min(380, window.innerWidth - 24)
    p.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - 12 - w))}px`
    p.style.top = `${r.bottom + 6}px`
  }
  /** Depois de aberto: se não cabe abaixo do botão, abre para cima (nunca acima de 8px). */
  function ajustaAltura() {
    const b = botao.current
    const p = pop.current
    if (!b || !p) return
    const r = b.getBoundingClientRect()
    const h = p.getBoundingClientRect().height
    if (r.bottom + 6 + h > window.innerHeight - 8) p.style.top = `${Math.max(8, r.top - 6 - h)}px`
  }
  function alterna() {
    posiciona()
    pop.current?.togglePopover?.()
    ajustaAltura()
  }
  function aoAlternar(ev: SyntheticEvent<HTMLDivElement>) {
    const novo = (ev.nativeEvent as Event & { newState?: string }).newState
    setAberto(novo === 'open')
    aoMudar?.(novo === 'open')
  }
  function aoTeclar(ev: KeyboardEvent<HTMLDivElement>) {
    if (ev.key !== 'Escape') return
    pop.current?.hidePopover?.()
    botao.current?.focus()
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        className="ri-ibtn"
        aria-expanded={aberto}
        aria-controls={id}
        aria-label={rotuloBotao}
        onClick={alterna}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 7.2v4M8 4.8v.1" />
        </svg>
      </button>
      <div ref={pop} id={id} className="ri-pop" popover="auto" role="dialog" aria-label={titulo} onToggle={aoAlternar} onKeyDown={aoTeclar}>
        <h3>{titulo}</h3>
        <ul>
          {itens.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
    </>
  )
}
