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
      queueMicrotask(() => setShowDialog(true))
    }

    function guardedReplaceState(data: unknown, unused: string, url?: string | URL | null) {
      const targetPath = typeof url === 'string'
        ? new URL(url, window.location.origin).pathname
        : url?.pathname
      if (targetPath && targetPath.includes('/edit')) {
        const isEditorRedirect =
          (targetPath.includes('/cms/newsletters/') || targetPath.includes('/cms/blog/'))
        if (isEditorRedirect) {
          return origReplace(data, unused, url)
        }
      }
      pendingNavRef.current = { data, unused, url, method: 'replace' }
      queueMicrotask(() => setShowDialog(true))
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
    <div className="navguard-scrim">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="navguard-title" className="navguard-dialog">
        <div className="navguard-header">
          <div className="navguard-ico">
            <AlertTriangle size={16} />
          </div>
          <h3 id="navguard-title" className="navguard-title">Alterações não salvas</h3>
        </div>
        <p className="navguard-text">Você tem edições que ainda não foram salvas.</p>
        <div className="navguard-actions">
          <button type="button" onClick={handleDiscard} className="btn sm danger">
            Descartar
          </button>
          <button type="button" onClick={handleCancel} className="btn sm">
            Cancelar
          </button>
          {onSave && (
            <button type="button" onClick={handleSaveAndLeave} className="btn sm primary">
              Salvar e sair
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
