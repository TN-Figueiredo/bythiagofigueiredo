'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useModalFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  /** Controle que recebe o foco ao abrir (padrão: o 1º focável). */
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  // onClose num ref: um pai que re-renderiza com função nova não pode refazer a armadilha (e arrancar o foco).
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return

    // Quem tinha o foco antes de abrir: o foco volta a ele ao fechar.
    const previouslyFocused = document.activeElement as HTMLElement | null
    let dialog: HTMLElement | null = null
    let raf = 0
    let tentativas = 0

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab' || !dialog) return
      const focusableEls = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusableEls[0]
      const last = focusableEls[focusableEls.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
    }

    // O diálogo pode viver num portal que só monta depois deste efeito (YtPortal): espera o nó existir.
    function procurar() {
      dialog = dialogRef.current
      if (!dialog) {
        if (tentativas++ < 30) raf = requestAnimationFrame(procurar)
        return
      }
      (initialFocusRef?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR))?.focus()
    }

    document.addEventListener('keydown', handleKeyDown)
    procurar()
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to the trigger so keyboard users aren't dropped to <body>.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [open, dialogRef, initialFocusRef])
}
