'use client'

import { useRef, type MutableRefObject } from 'react'
import { useCanEditContent } from './context'

/**
 * Autosave pause for the video editor — the single enforcement point that guarantees
 * VIEW mode (and the published lock) never persist content.
 *
 * The save callbacks (saveIdeia / saveTitle / saveRoteiro / savePostprod / savePublish /
 * saveAll) are constructed in `VideoEditorClient`, which renders ABOVE the
 * `VideoEditorProvider` and so cannot read `useCanEditContent()` directly. This hook bridges
 * that gap: it lives INSIDE the provider, mirrors the live `useCanEditContent()` value into a
 * mutable ref, and the editor-client callbacks read `ref.current` at call time before
 * touching the network. When content editing isn't allowed the save is a silent no-op.
 *
 * Recording-status persistence (use-recording-sync) is SEPARATE and intentionally NOT gated
 * here — shoot-tracking marks (gravada/refazer + retake notes) keep saving in view mode.
 *
 * Usage:
 *   const canEditRef = useAutosaveGateRef()      // in VideoEditorClient (above provider)
 *   <VideoEditorProvider …><AutosaveGate canEditRef={canEditRef} />…</VideoEditorProvider>
 *   // inside a save callback:  if (!canEditRef.current) return
 */
export function useAutosaveGateRef(): MutableRefObject<boolean> {
  // Default false → fail safe (read-only) until the in-provider <AutosaveGate> mirrors the
  // real value on first commit.
  return useRef(false)
}

/**
 * In-provider bridge: keeps `canEditRef.current` in lockstep with `useCanEditContent()`.
 * Renders nothing. Mount it once inside `VideoEditorProvider`.
 */
export function AutosaveGate({ canEditRef }: { canEditRef: MutableRefObject<boolean> }): null {
  const canEdit = useCanEditContent()
  // Mirror synchronously on every render so a callback firing in the same tick sees truth.
  canEditRef.current = canEdit
  return null
}
