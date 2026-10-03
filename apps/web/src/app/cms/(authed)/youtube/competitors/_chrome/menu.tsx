'use client'
/** Menu ⋯ (port of chrome.js menuHtml + keyboard): "Copiar pedido para o Cowork" and "Definir nicho dos canais". */
import Link from 'next/link'
import { useEffect, useId, useRef, type KeyboardEvent, type RefObject } from 'react'
import { Icon } from './icons'

export function Menu({ open, focusAt, btnRef, boxRef, cowork, nicheEditorHref, onOpenNicheEditor, onToggle, onOpenAt, onClose, onCopy, onCopyReading }: {
  open: boolean; focusAt: 'first' | 'last'
  btnRef: RefObject<HTMLButtonElement | null>; boxRef: RefObject<HTMLDivElement | null>
  cowork: string; nicheEditorHref: string; onOpenNicheEditor?: () => void
  onToggle: () => void; onOpenAt: (at: 'first' | 'last') => void; onClose: (focusBtn: boolean) => void; onCopy: () => void
  /** Insights: "Copiar texto da leitura" (Task 35) — only when a reading is shown. */
  onCopyReading?: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const prev = useId()
  const items = () => [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  useEffect(() => {
    if (!open) return
    const xs = items()
    ;(focusAt === 'last' ? xs[xs.length - 1] : xs[0])?.focus()
  }, [open, focusAt])
  // M6: on the ⋯ button, arrow down/up opens on the first/last item (menu button pattern)
  const onBtnKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); onOpenAt(e.key === 'ArrowDown' ? 'first' : 'last') }
  }
  const onMenuKey = (e: KeyboardEvent) => {
    const xs = items(), i = xs.indexOf(document.activeElement as HTMLElement)
    const go = (j: number) => { e.preventDefault(); xs[(j + xs.length) % xs.length]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(xs.length - 1)
    else if (e.key === 'Tab') onClose(false)
  }
  return (
    <div className="obs-ch-menu-wrap" ref={boxRef}>
      <button ref={btnRef} className="obs-ch-btn obs-ch-ghost obs-ch-icon" type="button" aria-haspopup="menu" aria-expanded={open}
        aria-controls={open ? 'obs-ch-menu' : undefined} aria-label="Mais ações" onClick={onToggle} onKeyDown={onBtnKey}>
        {Icon.dots()}
      </button>
      {open ? (
        <div className="obs-ch-pop obs-ch-menu" id="obs-ch-menu" role="menu" aria-label="Mais ações" ref={menuRef} onKeyDown={onMenuKey}>
          <button className="obs-ch-mi" role="menuitem" type="button" tabIndex={-1} aria-label="Copiar pedido para o Cowork" aria-describedby={prev} onClick={onCopy}>
            <strong>{Icon.copy()}Copiar pedido para o Cowork</strong>
            <span className="obs-ch-ctx">Copia este texto, montado a partir desta tela e do nicho atual. Depois, cole no Cowork com ⌘V.</span>
            <span className="obs-ch-preview" id={prev}>{cowork}</span>
          </button>
          {onCopyReading ? (
            <button className="obs-ch-mi" role="menuitem" type="button" tabIndex={-1} onClick={onCopyReading}>
              <strong>{Icon.copy()}Copiar texto da leitura</strong><span className="obs-ch-ctx">Um bloco por fonte, com o selo e os dados enviados à forja.</span>
            </button>
          ) : null}
          <hr />
          {onOpenNicheEditor ? (
            <button className="obs-ch-mi" role="menuitem" type="button" tabIndex={-1} onClick={() => { onClose(true); onOpenNicheEditor() }}>
              <strong>Definir nicho dos canais</strong><span className="obs-ch-ctx">Abre o editor de nicho por canal.</span>
            </button>
          ) : (
            <Link className="obs-ch-mi" role="menuitem" tabIndex={-1} href={nicheEditorHref} onClick={() => onClose(false)}>
              <strong>Definir nicho dos canais</strong><span className="obs-ch-ctx">Abre a aba Canais.</span>
            </Link>
          )}
        </div>
      ) : null}
    </div>
  )
}
