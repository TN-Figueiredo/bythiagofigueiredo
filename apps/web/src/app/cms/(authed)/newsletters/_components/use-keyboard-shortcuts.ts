'use client'

import { useEffect } from 'react'

interface ShortcutHandlers {
  onNewEdition: () => void
  onQuickIdea: () => void
  onFocusSearch: () => void
  onNavigateUp: () => void
  onNavigateDown: () => void
  onOpenSelected: () => void
  onShowHelp: () => void
}

export function useDashboardKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          handlers.onNewEdition()
          break
        case 'i':
          e.preventDefault()
          handlers.onQuickIdea()
          break
        case '/':
          e.preventDefault()
          handlers.onFocusSearch()
          break
        case 'arrowup':
          e.preventDefault()
          handlers.onNavigateUp()
          break
        case 'arrowdown':
          e.preventDefault()
          handlers.onNavigateDown()
          break
        case 'enter':
          e.preventDefault()
          handlers.onOpenSelected()
          break
        case '?':
          e.preventDefault()
          handlers.onShowHelp()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
