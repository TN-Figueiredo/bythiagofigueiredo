'use client'
/**
 * A nota do ritmo (mockup de 19/10): o sufixo âmbar ("· sobre 81 d" / "canal com menos de 4 sem") e o ⓘ com a causa. O número ao lado não
 * esmaece; só o sufixo e o ⓘ levam a cor. O ⓘ abre por clique ou Enter, fecha por Esc e por clique fora. A caixa é `fixed`: a tabela rola
 * na horizontal e cortaria uma caixa absoluta.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { NotaDoRitmo } from '@/lib/youtube/observatorio/ritmo-nota'
import './nota-ritmo.css'

export function NotaRitmo({ nota, className }: { nota: NotaDoRitmo; className?: string }) {
  const id = useId()
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLSpanElement>(null)
  const raiz = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aberta) return
    const b = botao.current, p = caixa.current
    if (b && p) {
      const r = b.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24)
      p.style.width = `${w}px`
      p.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - 12 - w))}px`
      p.style.top = `${r.bottom + 6}px`
    }
    const fora = (e: PointerEvent) => { if (raiz.current && !raiz.current.contains(e.target as Node)) setAberta(false) }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberta])

  return (
    <span
      ref={raiz} className={`obs-nr${className ? ' ' + className : ''}`} data-nota-ritmo={nota.tipo}
      onKeyDown={e => { if (e.key === 'Escape' && aberta) { e.stopPropagation(); setAberta(false); botao.current?.focus() } }}
    >
      <span className="obs-nr-t">{nota.sufixo}</span>
      <button ref={botao} type="button" className="obs-nr-i" aria-expanded={aberta} aria-controls={id} aria-label={`Por que: ${nota.titulo}`} onClick={() => setAberta(a => !a)}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.2" /><path d="M8 7.2v4M8 4.8v.1" strokeLinecap="round" /></svg>
      </button>
      <span ref={caixa} id={id} className="obs-nr-p" role="note" hidden={!aberta}><b>{nota.titulo}</b>{nota.causa}</span>
    </span>
  )
}

/** A coluna do sufixo reservada numa linha sem nota, enquanto alguma linha à vista tem: os números ficam alinhados. */
export function NotaRitmoReserva() {
  return <span className="obs-nr ph" aria-hidden="true"><span className="obs-nr-t">· sobre 000 d</span></span>
}
