'use client'

import { useCallback, useRef, useState } from 'react'
import { type Camera, type Point, screenToCanvas, zoomTowardPoint, clampZoom, fitAllNodes } from './utils'

interface UseCanvasOptions {
  initialCamera?: Camera
}

export function useCanvas(options: UseCanvasOptions = {}) {
  const [camera, setCamera] = useState<Camera>(
    options.initialCamera ?? { x: 0, y: 0, zoom: 1 },
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<Point>({ x: 0, y: 0 })
  const cameraStartRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })

  const getRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 } as DOMRect
  }, [])

  const toCanvas = useCallback(
    (screenX: number, screenY: number): Point => {
      return screenToCanvas(screenX, screenY, getRect(), camera)
    },
    [camera, getRect],
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = getRect()
      setCamera(prev => zoomTowardPoint(prev, e.clientX, e.clientY, rect, e.deltaY))
    },
    [getRect],
  )

  const handlePanStart = useCallback(
    (e: React.PointerEvent, forceStart = false) => {
      if (forceStart || e.button === 1 || (e.button === 0 && e.metaKey)) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX, y: e.clientY }
        cameraStartRef.current = { ...camera }
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    },
    [camera],
  )

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return
    const dx = e.clientX - panStartRef.current.x
    const dy = e.clientY - panStartRef.current.y
    setCamera({
      ...cameraStartRef.current,
      x: cameraStartRef.current.x + dx,
      y: cameraStartRef.current.y + dy,
    })
  }, [])

  const handlePanEnd = useCallback(() => {
    isPanningRef.current = false
  }, [])

  const zoomToFit = useCallback(
    (items: Array<{ position_x: number; position_y: number }>) => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      setCamera(fitAllNodes(items, width, height))
    },
    [],
  )

  const setZoom = useCallback((zoom: number) => {
    setCamera(prev => ({ ...prev, zoom: clampZoom(zoom) }))
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const cx = width / 2
    const cy = height / 2
    setCamera(prev => {
      const newZoom = clampZoom(prev.zoom * factor)
      const ratio = newZoom / prev.zoom
      return { zoom: newZoom, x: cx - (cx - prev.x) * ratio, y: cy - (cy - prev.y) * ratio }
    })
  }, [])

  return {
    camera,
    setCamera,
    containerRef,
    toCanvas,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomToFit,
    setZoom,
    zoomBy,
    isPanning: isPanningRef,
  }
}
