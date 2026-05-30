'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'

interface DrawerShellProps {
  children: ReactNode
}

export function DrawerShell({ children }: DrawerShellProps) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') router.back()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  useEffect(() => {
    const el = overlayRef.current
    if (!el) return

    const focusable = () =>
      el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )

    const elements = focusable()
    if (elements.length > 0) elements[0].focus()

    function trapFocus(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const elems = focusable()
      if (elems.length === 0) return
      const first = elems[0]
      const last = elems[elems.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    return () => document.removeEventListener('keydown', trapFocus)
  }, [])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => router.back()}
      />
      <div className="relative w-[440px] max-w-full overflow-y-auto bg-cms-bg border-l border-cms-border animate-ab-drawer-in">
        <button
          onClick={() => router.back()}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-cms-text-muted hover:bg-cms-surface hover:text-cms-text transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
