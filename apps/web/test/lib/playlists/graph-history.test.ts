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
    expect(h.canUndo()).toBe(true)
    expect(h.undo(s2)).toEqual(s1)
  })

  it('undo then redo returns forward state', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    const restored = h.undo(s2)
    expect(restored).toEqual(s1)
    expect(h.canRedo()).toBe(true)
    expect(h.redo(restored!)).toEqual(s2)
  })

  it('push after undo clears redo stack', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    const s3 = { ...s1, items: [{ id: 'b' }] } as unknown as GraphState
    h.push(s1)
    h.undo(s2)
    h.push(s3)
    expect(h.canRedo()).toBe(false)
  })

  it('respects max size', () => {
    const h = createHistory<GraphState>(3)
    const states: GraphState[] = []
    for (let i = 0; i < 5; i++) {
      const s = { ...initialGraphState(), items: [{ id: String(i) }] } as unknown as GraphState
      h.push(s)
      states.push(s)
    }
    let undoCount = 0
    let current = states[states.length - 1]
    while (h.canUndo()) {
      const prev = h.undo(current)
      if (prev) current = prev
      undoCount++
    }
    expect(undoCount).toBe(3)
  })

  it('undo with empty history returns null', () => {
    const h = createHistory<GraphState>()
    const s = initialGraphState()
    expect(h.undo(s)).toBeNull()
  })

  it('redo with empty future returns null', () => {
    const h = createHistory<GraphState>()
    const s = initialGraphState()
    h.push(s)
    expect(h.redo(s)).toBeNull()
  })

  it('clear resets both stacks', () => {
    const h = createHistory<GraphState>()
    const s1 = initialGraphState()
    const s2 = { ...s1, items: [{ id: 'a' }] } as unknown as GraphState
    h.push(s1)
    h.undo(s2)
    expect(h.canRedo()).toBe(true)
    h.clear()
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })
})
