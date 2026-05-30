'use client'

import { useEffect, useCallback, useRef } from 'react'
import type { ComposerState } from './use-composer'

interface PersistenceOptions {
  state: ComposerState
  draftId?: string
  onRestore: (state: Partial<ComposerState>) => void
}

const STORAGE_PREFIX = 'social-composer-'
const SAVE_INTERVAL = 5000

export function useComposerPersistence({ state, draftId, onRestore }: PersistenceOptions) {
  const key = `${STORAGE_PREFIX}${draftId ?? 'new'}`
  const hasRestored = useRef(false)
  const isDirty = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    if (hasRestored.current) return
    hasRestored.current = true
    try {
      const saved = sessionStorage.getItem(key)
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<ComposerState>
        onRestore(parsed)
      }
    } catch {}
  }, [key, onRestore])

  useEffect(() => {
    isDirty.current = true
  }, [state.captions, state.destsOn, state.focused, state.mode, state.lang, state.poll, state.sched, state.schedDate, state.schedTime, state.cmsPicked, state.design])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDirty.current) return
      try {
        const s = stateRef.current
        const serializable = {
          mode: s.mode,
          lang: s.lang,
          destsOn: s.destsOn,
          focused: s.focused,
          captions: s.captions,
          poll: s.poll,
          sched: s.sched,
          schedDate: s.schedDate,
          schedTime: s.schedTime,
        }
        sessionStorage.setItem(key, JSON.stringify(serializable))
        isDirty.current = false
      } catch {}
    }, SAVE_INTERVAL)
    return () => clearInterval(interval)
  }, [key])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const clearPersistence = useCallback(() => {
    try { sessionStorage.removeItem(key) } catch {}
    isDirty.current = false
  }, [key])

  return { clearPersistence }
}
