'use client'

import { useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export interface History<T> {
  push(state: T): void
  undo(current: T): T | null
  redo(current: T): T | null
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
      if (past.length > maxSize) past.shift()
    },

    undo(current: T): T | null {
      if (past.length === 0) return null
      future.push(current)
      return past.pop()!
    },

    redo(current: T): T | null {
      if (future.length === 0) return null
      past.push(current)
      return future.pop()!
    },

    canUndo() {
      return past.length > 0
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

  const undo = useCallback((current: T): T | null => {
    return historyRef.current.undo(structuredClone(current))
  }, [])

  const redo = useCallback((current: T): T | null => {
    return historyRef.current.redo(structuredClone(current))
  }, [])

  const canUndo = useCallback(() => historyRef.current.canUndo(), [])
  const canRedo = useCallback(() => historyRef.current.canRedo(), [])

  return { pushSnapshot, undo, redo, canUndo, canRedo }
}
