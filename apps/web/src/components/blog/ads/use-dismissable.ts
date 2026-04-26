'use client'

import { useState, useCallback } from 'react'
import type { AdCreativeData } from './types'

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

function dismissKey(creative: AdCreativeData): string {
  return `${creative.slotKey}_${creative.campaignId ?? 'ph'}`
}

/**
 * Hook for dismissable ad slots.
 * Persists dismiss state in localStorage keyed by slotKey + campaignId.
 */
export function useDismissable(
  creative: AdCreativeData,
  onDismiss?: () => void,
): [dismissed: boolean, dismiss: () => void] {
  const key = dismissKey(creative)
  const [dismissed, setLocal] = useState(() => Boolean(getDismissed()[key]))

  const dismiss = useCallback(() => {
    setDismissed(key)
    setLocal(true)
    if (onDismiss) onDismiss()
  }, [key, onDismiss])

  return [dismissed, dismiss]
}
