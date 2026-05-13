'use client'

import { useCallback, useRef, useState } from 'react'
import type { Camera, Point } from './utils'
import { screenToCanvas } from './utils'

export interface DragEdgeState {
  active: boolean
  sourceItemId: string | null
  sourcePoint: Point
  currentPoint: Point
}

interface UseEdgeDragOptions {
  camera: Camera
  containerRef: React.RefObject<HTMLDivElement | null>
  onEdgeCreated: (sourceItemId: string, targetItemId: string) => void
}

export function useEdgeDrag({ camera, containerRef, onEdgeCreated }: UseEdgeDragOptions) {
  const [dragEdge, setDragEdge] = useState<DragEdgeState>({
    active: false,
    sourceItemId: null,
    sourcePoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },
  })
  const sourceIdRef = useRef<string | null>(null)

  const getRect = () =>
    containerRef.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect)

  const handleHandlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, handleX: number, handleY: number) => {
      e.stopPropagation()
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      sourceIdRef.current = itemId
      setDragEdge({
        active: true,
        sourceItemId: itemId,
        sourcePoint: { x: handleX, y: handleY },
        currentPoint: { x: handleX, y: handleY },
      })
    },
    [],
  )

  const handleHandlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!sourceIdRef.current) return
      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      setDragEdge(prev => ({ ...prev, currentPoint: canvasPos }))
    },
    [camera, containerRef],
  )

  const handleHandlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!sourceIdRef.current) return
      const sourceId = sourceIdRef.current

      const target = (e.target as HTMLElement).closest('[data-handle-id]')
      const targetItemId = target?.getAttribute('data-handle-id')

      if (targetItemId && targetItemId !== sourceId) {
        onEdgeCreated(sourceId, targetItemId)
      }

      sourceIdRef.current = null
      setDragEdge({
        active: false,
        sourceItemId: null,
        sourcePoint: { x: 0, y: 0 },
        currentPoint: { x: 0, y: 0 },
      })
    },
    [onEdgeCreated],
  )

  return {
    dragEdge,
    handleHandlePointerDown,
    handleHandlePointerMove,
    handleHandlePointerUp,
  }
}
