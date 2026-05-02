'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useModalFocusTrap } from './use-modal-focus-trap'

interface NavigationGuardProps {
  hasUnsavedChanges: boolean
  onSave?: () => Promise<void>
}

export function NavigationGuard({ hasUnsavedChanges, onSave }: NavigationGuardProps) {
  const [showDialog, setShowDialog] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pendingNavRef = useRef<{ data: unknown; unused: string; url?: string | URL | null; method: 'push' | 'replace' } | null>(null)
  const originalPushRef = useRef<typeof window.history.pushState | null>(null)
  const originalReplaceRef = useRef<typeof window.history.replaceState | null>(null)

  const handleDiscard = useCallback(() => {
    setShowDialog(false)
    const nav = pendingNavRef.current
    pendingNavRef.current = null
    if (nav) {
      const orig = nav.method === 'push' ? originalPushRef.current : originalReplaceRef.current
      orig?.call(window.history, nav.data, nav.unused, nav.url)
    }
  }, [])

  const handleSaveAndLeave = useCallback(async () => {
    if (onSave) {
      await onSave()
    }
    handleDiscard()
  }, [onSave, handleDiscard])

  const handleCancel = useCallback(() => {
    setShowDialog(false)
    pendingNavRef.current = null
  }, [])

  useModalFocusTrap(dialogRef, showDialog, handleCancel)

  useEffect(() => {
    if (!hasUnsavedChanges) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    const origPush = window.history.pushState.bind(window.history)
    const origReplace = window.history.replaceState.bind(window.history)
    originalPushRef.current = origPush
    originalReplaceRef.current = origReplace

    function guardedPushState(data: unknown, unused: string, url?: string | URL | null) {
      pendingNavRef.current = { data, unused, url, method: 'push' }
      setShowDialog(true)
    }

    function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      // Allow router.replace() calls that update the URL within the editor
      // (e.g., ephemeral→draft transition from /new to /[id]/edit)
      const targetPath = typeof url === 'string'
        ? new URL(url, window.location.origin).pathname
        : url?.pathname
      if (targetPath && targetPath.includes('/cms/newsletters/') && targetPath.includes('/edit')) {
        return origReplace(data, unused, url)
      }
      pendingNavRef.current = { data, unused, url, method: 'replace' }
      setShowDialog(true)
    }

    window.history.pushState = guardedPushState as typeof window.history.pushState
    window.history.replaceState = guardedReplaceState as typeof window.history.replaceState
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.history.pushState = origPush
      window.history.replaceState = origReplace
    }
  }, [hasUnsavedChanges])

  if (!showDialog) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div ref={dialogRef} role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-[#111827] border border-[#374151] p-6 shadow-2xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle size={16} className="text-[#f59e0b]" />
          </div>
          <h3 className="text-base font-semibold text-[#f3f4f6]">Unsaved changes</h3>
        </div>
        <p className="text-sm text-[#9ca3af] mb-6">You have edits that haven&apos;t been saved yet.</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#ef4444] border border-[#ef4444]/30 hover:bg-red-500/10"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5"
          >
            Cancel
          </button>
          {onSave && (
            <button
              type="button"
              onClick={handleSaveAndLeave}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Save &amp; Leave
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
