'use client'

import { useEffect, useRef } from 'react'

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
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          handlersRef.current.onNewEdition()
          break
        case 'i':
          e.preventDefault()
          handlersRef.current.onQuickIdea()
          break
        case '/':
          e.preventDefault()
          handlersRef.current.onFocusSearch()
          break
        case 'arrowup':
          e.preventDefault()
          handlersRef.current.onNavigateUp()
          break
        case 'arrowdown':
          e.preventDefault()
          handlersRef.current.onNavigateDown()
          break
        case 'enter':
          e.preventDefault()
          handlersRef.current.onOpenSelected()
          break
        case '?':
          e.preventDefault()
          handlersRef.current.onShowHelp()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
