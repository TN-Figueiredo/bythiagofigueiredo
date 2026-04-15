'use client'

/**
 * Per-tab session identifier for autosave keys of brand-new drafts (no DB id
 * yet). Without this, multiple tabs all keyed on `post-draft:new` (or
 * `campaign-draft:new`) clobber each other. With it, each tab mints its own
 * UUID at first access and persists it in sessionStorage (tab-scoped).
 *
 * The caller is responsible for calling `clearNewDraftId(scope)` after a
 * successful save so the next new draft in the same tab gets a fresh id.
 */

function hasSessionStorage(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.sessionStorage !== 'undefined'
  )
}

function mintId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for older test envs — random enough for this purpose.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** Resolve (or mint) the per-tab draft id for the given scope. */
export function getNewDraftId(scope: string): string {
  const key = `__new-draft-id:${scope}`
  if (!hasSessionStorage()) return mintId()
  try {
    const existing = window.sessionStorage.getItem(key)
    if (existing) return existing
    const fresh = mintId()
    window.sessionStorage.setItem(key, fresh)
    return fresh
  } catch {
    return mintId()
  }
}

/** Clear the per-tab draft id for the given scope (call on successful save). */
export function clearNewDraftId(scope: string): void {
  if (!hasSessionStorage()) return
  try {
    window.sessionStorage.removeItem(`__new-draft-id:${scope}`)
  } catch {
    /* ignore */
  }
}
