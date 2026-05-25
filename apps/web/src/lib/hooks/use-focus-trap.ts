'use client'

import { useEffect, useCallback, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], input:not([disabled]), button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus trap for modal dialogs.
 * - When `autoFocus` is true (default), focuses the first focusable element on mount.
 * - Returns an onKeyDown handler that cycles Tab / Shift+Tab within the ref.
 */
export function useFocusTrap(
  dialogRef: RefObject<HTMLElement | null>,
  { autoFocus = true }: { autoFocus?: boolean } = {},
) {
  useEffect(() => {
    if (!autoFocus) return
    const dialog = dialogRef.current
    if (!dialog) return
    const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    first?.focus()
  }, [dialogRef, autoFocus])

  return useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!first || !last) return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    },
    [dialogRef],
  )
}
