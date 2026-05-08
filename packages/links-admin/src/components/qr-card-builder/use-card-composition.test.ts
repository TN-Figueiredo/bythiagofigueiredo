import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCardComposition } from './use-card-composition'
import type { CardComposition, CardElement } from '@tn-figueiredo/links/qr'

const base: CardComposition = {
  version: 1,
  canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
  background: { type: 'solid', color: '#ffffff' },
  elements: [],
}

const textEl: CardElement = {
  id: 'txt-1', type: 'text', x: 10, y: 10, width: 200, height: 40,
  rotation: 0, opacity: 1, locked: false,
  content: 'Hello', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
  lineHeight: 1.2, letterSpacing: '0em', align: 'left', color: '#000000',
  uppercase: false,
}

const qrEl: CardElement = {
  id: 'qr-1', type: 'qr', x: 100, y: 100, width: 200, height: 200,
  rotation: 0, opacity: 1, locked: false,
  foregroundColor: '#000000', backgroundColor: '#ffffff',
  errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
}

describe('useCardComposition', () => {
  it('returns initial composition', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.composition).toEqual(base)
  })

  it('adds an element', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.composition.elements).toHaveLength(1)
    expect(result.current.composition.elements[0]!.id).toBe('txt-1')
  })

  it('removes an element', () => {
    const initial = { ...base, elements: [textEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.removeElement('txt-1'))
    expect(result.current.composition.elements).toHaveLength(0)
  })

  it('updates an element', () => {
    const initial = { ...base, elements: [textEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.updateElement('txt-1', { x: 999 }))
    expect(result.current.composition.elements[0]!.x).toBe(999)
  })

  it('reorders elements', () => {
    const initial = { ...base, elements: [textEl, qrEl] }
    const { result } = renderHook(() => useCardComposition(initial))
    act(() => result.current.reorderElements(0, 1))
    expect(result.current.composition.elements[0]!.id).toBe('qr-1')
    expect(result.current.composition.elements[1]!.id).toBe('txt-1')
  })

  it('sets background', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.setBackground({ type: 'solid', color: '#ff0000' }))
    expect(result.current.composition.background).toEqual({ type: 'solid', color: '#ff0000' })
  })

  it('sets canvas', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.setCanvas({ width: 1920, height: 1080, aspectRatio: '16:9' }))
    expect(result.current.composition.canvas.width).toBe(1920)
  })

  it('undo reverts last action', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.composition.elements).toHaveLength(1)
    act(() => result.current.undo())
    expect(result.current.composition.elements).toHaveLength(0)
  })

  it('redo reapplies undone action', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    act(() => result.current.redo())
    expect(result.current.composition.elements).toHaveLength(1)
  })

  it('canUndo is false initially', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.canUndo).toBe(false)
  })

  it('canUndo is true after mutation', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    expect(result.current.canUndo).toBe(true)
  })

  it('canRedo is false initially', () => {
    const { result } = renderHook(() => useCardComposition(base))
    expect(result.current.canRedo).toBe(false)
  })

  it('canRedo is true after undo', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
  })

  it('new mutation clears future (redo)', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.undo())
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.addElement(qrEl))
    expect(result.current.canRedo).toBe(false)
  })

  it('history caps at 50', () => {
    const { result } = renderHook(() => useCardComposition(base))
    for (let i = 0; i < 55; i++) {
      act(() => result.current.addElement({ ...textEl, id: `txt-${i}` }))
    }
    let undoCount = 0
    while (result.current.canUndo) {
      act(() => result.current.undo())
      undoCount++
    }
    expect(undoCount).toBe(50)
  })

  it('replaceComposition resets history', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.addElement(textEl))
    act(() => result.current.addElement(qrEl))
    expect(result.current.canUndo).toBe(true)

    const newComp: CardComposition = {
      ...base,
      canvas: { width: 1920, height: 1080, aspectRatio: '16:9' },
    }
    act(() => result.current.replaceComposition(newComp))
    expect(result.current.composition.canvas.width).toBe(1920)
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })

  it('undo with empty past is no-op', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.undo())
    expect(result.current.composition).toEqual(base)
  })

  it('redo with empty future is no-op', () => {
    const { result } = renderHook(() => useCardComposition(base))
    act(() => result.current.redo())
    expect(result.current.composition).toEqual(base)
  })
})
