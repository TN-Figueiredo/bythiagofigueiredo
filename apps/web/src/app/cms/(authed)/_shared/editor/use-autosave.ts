'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'
export type SaveMode = 'auto' | 'manual' | 'guarded'

interface AutosaveOptions {
  editionId: string | null
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean
  mode?: SaveMode
  getPayload?: () => Record<string, unknown>
}

interface AutosaveReturn {
  state: SaveState
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  scheduleSave: (data: Record<string, unknown>) => void
  saveNow: (data: Record<string, unknown>) => void
  forceSave: (data: Record<string, unknown>) => Promise<{ ok: boolean }>
  setHasUnsavedChanges: (v: boolean) => void
  needsConfirmation: boolean
  confirmSave: () => void
  cancelSave: () => void
  mode: SaveMode
}

const RETRY_DELAYS = [2000, 4000, 8000]
const LS_PREFIX = 'editor-draft-'

export function useAutosave({
  editionId,
  saveFn,
  debounceMs = 3000,
  maxRetries = 3,
  enabled = true,
  mode = 'auto',
  getPayload,
}: AutosaveOptions): AutosaveReturn {
  const [state, setState] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const pendingDataRef = useRef<Record<string, unknown> | null>(null)
  const getPayloadRef = useRef(getPayload)
  getPayloadRef.current = getPayload

  const doSave = useCallback(async (data: Record<string, unknown>): Promise<{ ok: boolean }> => {
    if (!editionId) return { ok: false }
    if (!enabled) return { ok: false }
    if (typeof window !== 'undefined' && !navigator.onLine) {
      localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      setState('offline')
      return { ok: false }
    }

    setState('saving')
    const result = await saveFn(data)

    if (result.ok) {
      setState('saved')
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      retryCountRef.current = 0
      if (typeof window !== 'undefined') localStorage.removeItem(`${LS_PREFIX}${editionId}`)
      return { ok: true }
    } else {
      if (retryCountRef.current < maxRetries) {
        const delay = RETRY_DELAYS[retryCountRef.current] ?? 8000
        retryCountRef.current++
        setTimeout(() => doSave(data), delay)
        setState('error')
      } else {
        setState('error')
        if (typeof window !== 'undefined') localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      }
      return { ok: false }
    }
  }, [editionId, saveFn, enabled, maxRetries])

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (!enabled) return
    if (!editionId) return
    pendingDataRef.current = data
    setHasUnsavedChanges(true)
    setState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (mode === 'auto') {
      debounceRef.current = setTimeout(() => doSave(data), debounceMs)
    }
  }, [doSave, debounceMs, enabled, editionId, mode])

  const saveNow = useCallback((data: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    if (mode === 'guarded') {
      pendingDataRef.current = data
      setHasUnsavedChanges(true)
      setNeedsConfirmation(true)
      return
    }
    doSave(data)
  }, [doSave, mode])

  const forceSave = useCallback(async (data: Record<string, unknown>): Promise<{ ok: boolean }> => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    setNeedsConfirmation(false)
    return doSave(data)
  }, [doSave])

  const confirmSave = useCallback(() => {
    setNeedsConfirmation(false)
    const data = getPayloadRef.current ? getPayloadRef.current() : pendingDataRef.current
    if (data) {
      retryCountRef.current = 0
      doSave(data)
    }
  }, [doSave])

  const cancelSave = useCallback(() => {
    setNeedsConfirmation(false)
  }, [])

  // Mode transition effects
  const prevModeRef = useRef(mode)
  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = mode
    if (prev === mode) return

    if (prev === 'auto' && mode !== 'auto') {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    if (prev === 'guarded') {
      setNeedsConfirmation(false)
    }
    if (prev !== 'auto' && mode === 'auto' && hasUnsavedChanges && pendingDataRef.current) {
      debounceRef.current = setTimeout(() => doSave(pendingDataRef.current!), debounceMs)
    }
  }, [mode, hasUnsavedChanges, doSave, debounceMs])

  // localStorage recovery
  useEffect(() => {
    if (!editionId) return
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`${LS_PREFIX}${editionId}`)
    if (stored && enabled) {
      try {
        const data = JSON.parse(stored) as Record<string, unknown>
        pendingDataRef.current = data
        setHasUnsavedChanges(true)
        setState('unsaved')
      } catch {
        localStorage.removeItem(`${LS_PREFIX}${editionId}`)
      }
    }
  }, [editionId, enabled])

  // Online recovery
  useEffect(() => {
    function handleOnline() {
      if (mode === 'auto' && pendingDataRef.current) {
        doSave(pendingDataRef.current)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [doSave, mode])

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    state, lastSavedAt, hasUnsavedChanges,
    scheduleSave, saveNow, forceSave,
    setHasUnsavedChanges,
    needsConfirmation, confirmSave, cancelSave,
    mode,
  }
}
