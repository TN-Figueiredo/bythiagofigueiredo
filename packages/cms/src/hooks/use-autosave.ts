'use client'

import * as React from 'react'

export interface UseAutosaveOptions {
  /** Debounce window in milliseconds. Defaults to 2000ms. */
  debounceMs?: number
  /** When false, the hook skips persistence entirely (still exposes any existing draft). */
  enabled?: boolean
}

export interface UseAutosaveResult<T> {
  /** True when a draft was found in storage at mount time AND not yet discarded/restored. */
  hasDraft: boolean
  /** The draft snapshot loaded from storage at mount, or null. */
  draft: T | null
  /** Returns the current draft snapshot (if any) and clears the `hasDraft` flag. */
  restore: () => T | null
  /** Removes the stored draft and clears the `hasDraft` flag. */
  discard: () => void
}

const DEFAULT_DEBOUNCE = 2000

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readDraft<T>(key: string): T | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeDraft<T>(key: string, value: T): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota / serialization errors */
  }
}

function removeDraft(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * Debounced localStorage autosave with restore/discard UX hooks.
 *
 * Does NOT auto-apply the restored draft — it only surfaces `hasDraft` and
 * `draft` so the consumer can decide how to prompt the user.
 *
 * Safe for SSR: guards on `typeof window`.
 */
export function useAutosave<T>(
  key: string,
  value: T,
  opts: UseAutosaveOptions = {},
): UseAutosaveResult<T> {
  const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE
  const enabled = opts.enabled ?? true

  // Load any existing draft once on mount.
  const initialDraftRef = React.useRef<T | null>(null)
  const [hasDraft, setHasDraft] = React.useState(false)

  React.useEffect(() => {
    const existing = readDraft<T>(key)
    if (existing !== null) {
      initialDraftRef.current = existing
      setHasDraft(true)
    }
    // only on mount (per key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Track last-serialized value to skip redundant writes.
  const lastSerializedRef = React.useRef<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    if (!isBrowser()) return

    let serialized: string
    try {
      serialized = JSON.stringify(value)
    } catch {
      return
    }
    if (serialized === lastSerializedRef.current) return

    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialized)
        lastSerializedRef.current = serialized
      } catch {
        /* ignore */
      }
    }, debounceMs)

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [key, value, debounceMs, enabled])

  const restore = React.useCallback((): T | null => {
    const snap = initialDraftRef.current
    setHasDraft(false)
    return snap
  }, [])

  const discard = React.useCallback((): void => {
    removeDraft(key)
    initialDraftRef.current = null
    lastSerializedRef.current = null
    setHasDraft(false)
  }, [key])

  return {
    hasDraft,
    draft: initialDraftRef.current,
    restore,
    discard,
  }
}

// Exposed for tests / advanced consumers.
export const __autosaveInternals = {
  readDraft,
  writeDraft,
  removeDraft,
  DEFAULT_DEBOUNCE,
}
