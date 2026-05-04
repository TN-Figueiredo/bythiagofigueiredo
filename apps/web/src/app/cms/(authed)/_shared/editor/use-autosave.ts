'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveState = 'saving' | 'saved' | 'unsaved' | 'error' | 'offline'

interface AutosaveOptions {
  editionId: string | null
  saveFn: (data: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>
  debounceMs?: number
  maxRetries?: number
  enabled?: boolean
}

interface AutosaveReturn {
  state: SaveState
  lastSavedAt: Date | null
  hasUnsavedChanges: boolean
  scheduleSave: (data: Record<string, unknown>) => void
  saveNow: (data: Record<string, unknown>) => void
  setHasUnsavedChanges: (v: boolean) => void
}

const RETRY_DELAYS = [2000, 4000, 8000]
const LS_PREFIX = 'newsletter-draft-'

export function useAutosave({
  editionId,
  saveFn,
  debounceMs = 3000,
  maxRetries = 3,
  enabled = true,
}: AutosaveOptions): AutosaveReturn {
  const [state, setState] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)
  const pendingDataRef = useRef<Record<string, unknown> | null>(null)

  const doSave = useCallback(async (data: Record<string, unknown>) => {
    if (!editionId) return
    if (!enabled) return
    if (typeof window !== 'undefined' && !navigator.onLine) {
      localStorage.setItem(`${LS_PREFIX}${editionId}`, JSON.stringify(data))
      setState('offline')
      return
    }

    setState('saving')
    const result = await saveFn(data)

    if (result.ok) {
      setState('saved')
      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      retryCountRef.current = 0
      if (typeof window !== 'undefined') localStorage.removeItem(`${LS_PREFIX}${editionId}`)
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
    }
  }, [editionId, saveFn, enabled, maxRetries])

  const scheduleSave = useCallback((data: Record<string, unknown>) => {
    if (!enabled) return
    if (!editionId) return
    pendingDataRef.current = data
    setHasUnsavedChanges(true)
    setState('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSave(data), debounceMs)
  }, [doSave, debounceMs, enabled])

  const saveNow = useCallback((data: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    retryCountRef.current = 0
    doSave(data)
  }, [doSave])

  useEffect(() => {
    if (!editionId) return
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`${LS_PREFIX}${editionId}`)
    if (stored && enabled) {
      const data = JSON.parse(stored) as Record<string, unknown>
      pendingDataRef.current = data
      setHasUnsavedChanges(true)
      setState('unsaved')
    }
  }, [editionId, enabled])

  useEffect(() => {
    function handleOnline() {
      if (pendingDataRef.current) {
        doSave(pendingDataRef.current)
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [doSave])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { state, lastSavedAt, hasUnsavedChanges, scheduleSave, saveNow, setHasUnsavedChanges }
}
