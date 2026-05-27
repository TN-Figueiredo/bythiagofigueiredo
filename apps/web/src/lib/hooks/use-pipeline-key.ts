'use client'

import { useState, useCallback, useEffect } from 'react'

const SCOPED_PREFIX = 'cowork-pipeline-key-'
const OLD_KEY = 'cowork-pipeline-key'
const MIGRATED_FLAG = 'migrated-cowork-key'

function safeGet(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}

function safeSet(key: string, value: string): void {
  try { sessionStorage.setItem(key, value) } catch { /* SSR or blocked */ }
}

function safeRemove(key: string): void {
  try { sessionStorage.removeItem(key) } catch { /* SSR or blocked */ }
}

export function usePipelineKey(siteId: string) {
  const scopedKey = `${SCOPED_PREFIX}${siteId}`

  const [key, setKeyState] = useState<string>(() => {
    const scoped = safeGet(scopedKey)
    if (scoped) {
      safeRemove(OLD_KEY)
      return scoped
    }
    if (!safeGet(MIGRATED_FLAG)) {
      const old = safeGet(OLD_KEY)
      if (old) {
        safeSet(scopedKey, old)
        safeRemove(OLD_KEY)
        safeSet(MIGRATED_FLAG, '1')
        return old
      }
    }
    safeRemove(OLD_KEY)
    return ''
  })

  useEffect(() => {
    safeRemove(OLD_KEY)
  }, [])

  const setKey = useCallback((value: string) => {
    setKeyState(value)
    safeSet(scopedKey, value)
  }, [scopedKey])

  return { key, setKey }
}
