'use client'

import { useEffect } from 'react'
import type { SaveState, SaveMode } from './use-autosave'

interface SaveBarProps {
  state: SaveState
  hasUnsavedChanges: boolean
  mode: SaveMode
  status: string
  onSave: () => void
  onRetry: () => void
}

export function SaveBar({ state, hasUnsavedChanges, mode, status, onSave, onRetry }: SaveBarProps) {
  const visible = mode !== 'auto' && (hasUnsavedChanges || state === 'saving' || state === 'error')
  const isPublished = status === 'published'
  const isSaving = state === 'saving'
  const isError = state === 'error'

  useEffect(() => {
    if (mode === 'auto') return
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (isError) onRetry()
        else if (!isSaving) onSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, isError, isSaving, onSave, onRetry])

  return (
    <div role="status" aria-live="polite" className="shrink-0">
      {visible && (
        <div
          className="sticky bottom-0 z-30 border-t px-5 py-2.5 flex items-center justify-between transition-all"
          style={{
            borderColor: isError ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)',
            background: isError ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
          }}
        >
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`h-[6px] w-[6px] rounded-full ${
                isError ? 'bg-[#ef4444]' : isSaving ? 'bg-[#eab308] animate-pulse' : 'bg-[#f59e0b] animate-pulse'
              }`}
            />
            <span className={isError ? 'text-[#ef4444]' : 'text-[#d97706]'}>
              {isError ? 'Save failed' : isSaving ? 'Saving...' : 'Unsaved changes'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[#6b7280] hidden sm:inline">&#8984;S</span>
            {isError ? (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Retry save"
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[#ef4444] border border-[#ef4444]/30 hover:bg-red-500/10 transition-colors"
              >
                Retry
              </button>
            ) : (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                aria-label={isPublished ? 'Update live post' : 'Save'}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : isPublished ? 'Update live post' : 'Save'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
