import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])'

/**
 * Modal-dialog a11y for a portalled dialog (WCAG 2.4.3): Esc-to-close, Tab/Shift+Tab focus
 * trap, initial focus into the dialog on open, and focus restoration to the trigger on
 * close (guarded against a detached trigger). The dialog element MUST have tabIndex={-1}.
 * Shared by the export + broadcast dialogs; the edit drawer keeps its own variant (it
 * focuses a specific first field).
 */
export function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  const triggerRef = useRef<HTMLElement | null>(
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null,
  )
  useEffect(() => {
    const dialog = dialogRef.current
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab' && dialog) {
        const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        if (!first || !last) return
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const raf = requestAnimationFrame(() => {
      const firstField = dialog?.querySelector<HTMLElement>(FOCUSABLE)
      ;(firstField ?? dialog)?.focus()
    })
    const trigger = triggerRef.current
    return () => {
      document.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
      if (trigger && trigger.isConnected) trigger.focus()
    }
  }, [dialogRef, onClose])
}
