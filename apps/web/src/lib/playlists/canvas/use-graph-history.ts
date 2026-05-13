'use client'

import { useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export interface History<T> {
  push(state: T): void
  undo(): T | null
  redo(): T | null
  canUndo(): boolean
  canRedo(): boolean
  clear(): void
}

export function createHistory<T>(maxSize = MAX_HISTORY): History<T> {
  const past: T[] = []
  const future: T[] = []

  return {
    push(state: T) {
      past.push(state)
      future.length = 0
      if (past.length > maxSize) {
        past.shift()
      }
    },

    undo(): T | null {
      if (past.length <= 1) return null
      const current = past.pop()!
      future.push(current)
      return past[past.length - 1] ?? null
    },

    redo(): T | null {
      if (future.length === 0) return null
      const next = future.pop()!
      past.push(next)
      return next
    },

    canUndo() {
      return past.length > 1
    },

    canRedo() {
      return future.length > 0
    },

    clear() {
      past.length = 0
      future.length = 0
    },
  }
}

export function useGraphHistory<T>() {
  const historyRef = useRef(createHistory<T>())

  const pushSnapshot = useCallback((state: T) => {
    historyRef.current.push(structuredClone(state))
  }, [])

  const undo = useCallback((): T | null => {
    return historyRef.current.undo()
  }, [])

  const redo = useCallback((): T | null => {
    return historyRef.current.redo()
  }, [])

  const canUndo = useCallback(() => historyRef.current.canUndo(), [])
  const canRedo = useCallback(() => historyRef.current.canRedo(), [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
