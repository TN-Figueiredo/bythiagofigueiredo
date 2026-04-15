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

  // Track last-serialized value to skip redundant writes, and the pending
  // (scheduled but not yet flushed) serialized snapshot so an unmount can
  // flush it synchronously without losing the last ≤debounceMs of edits.
  const lastSerializedRef = React.useRef<string | null>(null)
  const pendingSerializedRef = React.useRef<string | null>(null)
  const pendingKeyRef = React.useRef<string | null>(null)
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

    pendingSerializedRef.current = serialized
    pendingKeyRef.current = key

    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialized)
        lastSerializedRef.current = serialized
        pendingSerializedRef.current = null
      } catch {
        /* ignore */
      }
    }, debounceMs)

    // NOTE: intentionally no flush inside this cleanup. Per-render cleanups
    // run between renders (e.g. when `value` changes) — flushing there would
    // defeat the debounce. The unmount-only effect below handles the true
    // "leaving the editor" flush.
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [key, value, debounceMs, enabled])

  // Unmount-only: flush any pending write synchronously so the last batch of
  // edits isn't lost when the user navigates away. Documented side effect:
  // "flushes pending write on unmount to avoid losing last <debounceMs>s of
  // edits".
  React.useEffect(() => {
    return () => {
      if (!isBrowser()) return
      const pending = pendingSerializedRef.current
      const pendingKey = pendingKeyRef.current
      if (pending != null && pendingKey != null && pending !== lastSerializedRef.current) {
        try {
          window.localStorage.setItem(pendingKey, pending)
          lastSerializedRef.current = pending
          pendingSerializedRef.current = null
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  const restore = React.useCallback((): T | null => {
    const snap = initialDraftRef.current
    // Clear the cached snapshot so subsequent restore() calls return null and
    // a later rerender can't re-apply a stale draft (M2 fix).
    initialDraftRef.current = null
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
