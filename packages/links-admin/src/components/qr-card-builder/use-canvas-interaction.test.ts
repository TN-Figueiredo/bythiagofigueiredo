import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasInteraction } from './use-canvas-interaction'

describe('useCanvasInteraction', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('selects an element', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    expect(result.current.selectedIds.has('el-1')).toBe(true)
    expect(result.current.selectedIds.size).toBe(1)
  })

  it('replaces selection on single select', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.select('el-2'))
    expect(result.current.selectedIds.has('el-1')).toBe(false)
    expect(result.current.selectedIds.has('el-2')).toBe(true)
  })

  it('multi-select adds to selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-2'))
    expect(result.current.selectedIds.size).toBe(2)
  })

  it('multi-select toggles off existing selection', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-1'))
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('deselects all', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.select('el-1'))
    act(() => result.current.multiSelect('el-2'))
    act(() => result.current.deselectAll())
    expect(result.current.selectedIds.size).toBe(0)
  })

  it('default zoom is 1', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.zoom).toBe(1)
  })

  it('clamps zoom between 0.1 and 5', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.setZoom(0.01))
    expect(result.current.zoom).toBe(0.1)
    act(() => result.current.setZoom(10))
    expect(result.current.zoom).toBe(5)
  })

  it('fitToView calculates correct zoom', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.fitToView(800, 600, 1080, 1080))
    expect(result.current.zoom).toBeCloseTo((600 - 80) / 1080, 5)
  })

  it('fitToView caps at 1', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.fitToView(2000, 2000, 500, 500))
    expect(result.current.zoom).toBe(1)
  })

  it('guides visible by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.guidesVisible).toBe(true)
  })

  it('toggles guides', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.toggleGuides())
    expect(result.current.guidesVisible).toBe(false)
    act(() => result.current.toggleGuides())
    expect(result.current.guidesVisible).toBe(true)
  })

  it('grid hidden by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.gridVisible).toBe(false)
  })

  it('toggles grid', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.toggleGrid())
    expect(result.current.gridVisible).toBe(true)
  })

  it('context menu null by default', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    expect(result.current.contextMenu).toBeNull()
  })

  it('opens and closes context menu', () => {
    const { result } = renderHook(() => useCanvasInteraction())
    act(() => result.current.openContextMenu(100, 200, 'el-1'))
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200, elementId: 'el-1' })
    act(() => result.current.closeContextMenu())
    expect(result.current.contextMenu).toBeNull()
  })
})
