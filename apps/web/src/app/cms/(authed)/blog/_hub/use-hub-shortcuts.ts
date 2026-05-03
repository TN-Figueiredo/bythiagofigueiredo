'use client'

import { useEffect, useRef } from 'react'
import type { BlogTabId } from './hub-types'

interface HubShortcutHandlers {
  onNewPost: () => void
  onSwitchTab: (tab: BlogTabId) => void
  onFocusSearch?: () => void
  onExportCsv?: () => void
}

const TAB_MAP: Record<string, BlogTabId> = { '1': 'overview', '2': 'editorial', '3': 'schedule', '4': 'analytics' }

export function useHubShortcuts(handlers: HubShortcutHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'n') { e.preventDefault(); ref.current.onNewPost(); return }
      if (TAB_MAP[key]) { e.preventDefault(); ref.current.onSwitchTab(TAB_MAP[key]); return }
      if (key === '/' || key === 'f') { e.preventDefault(); ref.current.onFocusSearch?.(); return }
      if (key === 'e') { e.preventDefault(); ref.current.onExportCsv?.(); return }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}
