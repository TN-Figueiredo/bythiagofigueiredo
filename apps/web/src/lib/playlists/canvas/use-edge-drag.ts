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
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

      // setPointerCapture routes all events to the source handle,
      // so e.target is always the source — use elementFromPoint instead
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const handle = el?.closest('[data-handle-id]')
      const node = el?.closest('[data-node-id]')
      const targetItemId = handle?.getAttribute('data-handle-id')
        ?? node?.getAttribute('data-node-id')

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
