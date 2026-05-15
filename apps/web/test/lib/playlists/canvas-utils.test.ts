import { describe, it, expect } from 'vitest'
import { screenToCanvas, canvasToScreen, edgePath, clampZoom, getConnectionPoints } from '@/lib/playlists/canvas/utils'

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

  it('uses minimum control point offset of 60', () => {
    const path = edgePath({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(path).toContain('C 60')
  })
})

describe('edgePath vertical', () => {
  it('generates vertical bezier when dy > dx', () => {
    const path = edgePath({ x: 100, y: 0 }, { x: 100, y: 300 })
    expect(path).toContain('M 100 0')
    expect(path).toContain('C 100')
  })
})

describe('getConnectionPoints', () => {
  it('connects right-to-left when target is to the right', () => {
    const { sourcePoint, targetPoint } = getConnectionPoints(
      { position_x: 0, position_y: 0 },
      { position_x: 300, position_y: 0 },
    )
    expect(sourcePoint.x).toBe(250)
    expect(targetPoint.x).toBe(300)
  })

  it('connects left-to-right when target is to the left', () => {
    const { sourcePoint, targetPoint } = getConnectionPoints(
      { position_x: 300, position_y: 0 },
      { position_x: 0, position_y: 0 },
    )
    expect(sourcePoint.x).toBe(300)
    expect(targetPoint.x).toBe(250)
  })

  it('connects bottom-to-top when target is below', () => {
    const { sourcePoint, targetPoint } = getConnectionPoints(
      { position_x: 0, position_y: 0 },
      { position_x: 0, position_y: 300 },
    )
    expect(sourcePoint.y).toBe(80)
    expect(targetPoint.y).toBe(300)
  })

  it('connects top-to-bottom when target is above', () => {
    const { sourcePoint, targetPoint } = getConnectionPoints(
      { position_x: 0, position_y: 300 },
      { position_x: 0, position_y: 0 },
    )
    expect(sourcePoint.y).toBe(300)
    expect(targetPoint.y).toBe(80)
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
