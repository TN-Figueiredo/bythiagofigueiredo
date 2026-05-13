import { describe, it, expect } from 'vitest'
import { createHistory } from '@/lib/playlists/canvas/use-graph-history'
import { initialGraphState, type GraphState } from '@/lib/playlists/canvas/graph-reducer'

describe('createHistory', () => {
  it('starts with no undo/redo', () => {
    const h = createHistory<GraphState>()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('push then undo returns previous state', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    expect(h.canUndo()).toBe(true)
    expect(h.undo()).toEqual(s1)
  })

  it('undo then redo returns forward state', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    h.undo()
    expect(h.canRedo()).toBe(true)
    expect(h.redo()).toEqual(s2)
  })

  it('push after undo clears redo stack', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    const s3 = { ...s1, items: [{ id: 'b' }] } as unknown as GraphState
    h.push(s1)
    h.push(s2)
    h.undo()
    h.push(s3)
    expect(h.canRedo()).toBe(false)
  })

  it('respects max size', () => {
    const h = createHistory<GraphState>(3)
    for (let i = 0; i < 5; i++) {
      h.push({ ...initialGraphState(), items: [{ id: String(i) }] } as unknown as GraphState)
    }
    let undoCount = 0
    while (h.canUndo()) {
      h.undo()
      undoCount++
    }
    expect(undoCount).toBe(2)
  })
})
