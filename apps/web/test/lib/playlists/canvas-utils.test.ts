import { describe, it, expect } from 'vitest'
import { screenToCanvas, canvasToScreen, edgePath, clampZoom } from '@/lib/playlists/canvas/utils'

describe('screenToCanvas', () => {
  const camera = { x: 50, y: 30, zoom: 1 }
  const rect = { left: 10, top: 20 } as DOMRect

  it('converts screen coords to canvas coords at zoom 1', () => {
    const result = screenToCanvas(160, 150, rect, camera)
    expect(result.x).toBe(100)
    expect(result.y).toBe(100)
  })

  it('accounts for zoom', () => {
    const zoomed = { x: 0, y: 0, zoom: 2 }
    const result = screenToCanvas(110, 120, rect, zoomed)
    expect(result.x).toBe(50)
    expect(result.y).toBe(50)
  })
})

describe('canvasToScreen', () => {
  it('is inverse of screenToCanvas', () => {
    const camera = { x: 50, y: 30, zoom: 1.5 }
    const rect = { left: 10, top: 20 } as DOMRect
    const screen = canvasToScreen(100, 100, rect, camera)
    const back = screenToCanvas(screen.x, screen.y, rect, camera)
    expect(Math.round(back.x)).toBe(100)
    expect(Math.round(back.y)).toBe(100)
  })
})

describe('edgePath', () => {
  it('generates a cubic bezier SVG path', () => {
    const path = edgePath({ x: 0, y: 50 }, { x: 200, y: 50 })
    expect(path).toContain('M 0 50')
    expect(path).toContain('C')
  })

  it('uses minimum control point offset of 50', () => {
    const path = edgePath({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(path).toContain('C 50')
  })
})

describe('clampZoom', () => {
  it('clamps below minimum', () => {
    expect(clampZoom(0.1)).toBe(0.25)
  })

  it('clamps above maximum', () => {
    expect(clampZoom(5)).toBe(2)
  })

  it('passes through valid values', () => {
    expect(clampZoom(1)).toBe(1)
  })
})
