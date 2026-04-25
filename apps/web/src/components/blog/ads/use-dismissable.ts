'use client'

import { useState, useCallback } from 'react'

const DISMISS_KEY = 'btf_ads_dismissed'

function getDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function setDismissed(id: string): void {
  const d = getDismissed()
  d[id] = Date.now()
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(d))
  } catch {
    // localStorage may be full or unavailable
  }
}

/**
 * Hook for dismissable ad slots.
 * Persists dismiss state in localStorage keyed by ad id.
 */
export function useDismissable(
  id: string,
  onDismiss?: () => void,
): [dismissed: boolean, dismiss: () => void] {
  const [dismissed, setLocal] = useState(() => Boolean(getDismissed()[id]))

  const dismiss = useCallback(() => {
    setDismissed(id)
    setLocal(true)
    if (onDismiss) onDismiss()
  }, [id, onDismiss])

  return [dismissed, dismiss]
}
