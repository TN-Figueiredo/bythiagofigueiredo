import { useReducer, useCallback, useMemo } from 'react'
import type { CardComposition, CardElement, Background, Canvas } from '@tn-figueiredo/links/qr'

const MAX_HISTORY = 50

type Action =
  | { type: 'UPDATE_ELEMENT'; id: string; patch: Partial<CardElement> }
  | { type: 'ADD_ELEMENT'; element: CardElement }
  | { type: 'REMOVE_ELEMENT'; id: string }
  | { type: 'REORDER'; fromIndex: number; toIndex: number }
  | { type: 'SET_BACKGROUND'; background: Background }
  | { type: 'SET_CANVAS'; canvas: Canvas }
  | { type: 'REPLACE'; composition: CardComposition }
  | { type: 'UNDO' }
  | { type: 'REDO' }

interface HistoryState {
  past: CardComposition[]
  present: CardComposition
  future: CardComposition[]
}

function pushHistory(state: HistoryState, next: CardComposition): HistoryState {
  const past = [...state.past, state.present].slice(-MAX_HISTORY)
  return { past, present: next, future: [] }
}

function applyElementUpdate(
  elements: CardElement[],
  id: string,
  patch: Partial<CardElement>,
): CardElement[] {
  return elements.map(el =>
    el.id === id ? { ...el, ...patch } as CardElement : el,
  )
}

function reorderArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr]
  const [moved] = result.splice(from, 1)
  if (moved !== undefined) result.splice(to, 0, moved)
  return result
}

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case 'UPDATE_ELEMENT': {
      const next = {
        ...state.present,
        elements: applyElementUpdate(state.present.elements, action.id, action.patch),
      }
      return pushHistory(state, next)
    }
    case 'ADD_ELEMENT': {
      const next = {
        ...state.present,
        elements: [...state.present.elements, action.element],
      }
      return pushHistory(state, next)
    }
    case 'REMOVE_ELEMENT': {
      const next = {
        ...state.present,
        elements: state.present.elements.filter(el => el.id !== action.id),
      }
      return pushHistory(state, next)
    }
    case 'REORDER': {
      const next = {
        ...state.present,
        elements: reorderArray(state.present.elements, action.fromIndex, action.toIndex),
      }
      return pushHistory(state, next)
    }
    case 'SET_BACKGROUND': {
      const next = { ...state.present, background: action.background }
      return pushHistory(state, next)
    }
    case 'SET_CANVAS': {
      const next = { ...state.present, canvas: action.canvas }
      return pushHistory(state, next)
    }
    case 'REPLACE':
      return { past: [], present: action.composition, future: [] }
    case 'UNDO': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]!
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      }
    }
    case 'REDO': {
      if (state.future.length === 0) return state
      const next = state.future[0]!
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      }
    }
  }
}

export function useCardComposition(initial: CardComposition) {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: initial,
    future: [],
  })

  const updateElement = useCallback(
    (id: string, patch: Partial<CardElement>) =>
      dispatch({ type: 'UPDATE_ELEMENT', id, patch }),
    [],
  )

  const addElement = useCallback(
    (element: CardElement) => dispatch({ type: 'ADD_ELEMENT', element }),
    [],
  )

  const removeElement = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_ELEMENT', id }),
    [],
  )

  const reorderElements = useCallback(
    (fromIndex: number, toIndex: number) =>
      dispatch({ type: 'REORDER', fromIndex, toIndex }),
    [],
  )

  const setBackground = useCallback(
    (background: Background) => dispatch({ type: 'SET_BACKGROUND', background }),
    [],
  )

  const setCanvas = useCallback(
    (canvas: Canvas) => dispatch({ type: 'SET_CANVAS', canvas }),
    [],
  )

  const replaceComposition = useCallback(
    (composition: CardComposition) => dispatch({ type: 'REPLACE', composition }),
    [],
  )

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  return useMemo(() => ({
    composition: state.present,
    updateElement,
    addElement,
    removeElement,
    reorderElements,
    setBackground,
    setCanvas,
    replaceComposition,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }), [state, updateElement, addElement, removeElement, reorderElements, setBackground, setCanvas, replaceComposition, undo, redo])
}

export type UseCardCompositionReturn = ReturnType<typeof useCardComposition>
