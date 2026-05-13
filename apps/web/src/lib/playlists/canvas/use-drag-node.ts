'use client'

import { useCallback, useRef } from 'react'
import type { Camera, Point } from './utils'
import { screenToCanvas } from './utils'

interface UseDragNodeOptions {
  camera: Camera
  containerRef: React.RefObject<HTMLDivElement | null>
  selectedItemIds: Set<string>
  onMoveEnd: (moves: Array<{ itemId: string; x: number; y: number }>) => void
}

export function useDragNode({ camera, containerRef, selectedItemIds, onMoveEnd }: UseDragNodeOptions) {
  const isDraggingRef = useRef(false)
  const dragItemIdRef = useRef<string | null>(null)
  const dragStartCanvasRef = useRef<Point>({ x: 0, y: 0 })
  const initialPositionsRef = useRef<Map<string, Point>>(new Map())

  const getRect = () =>
    containerRef.current?.getBoundingClientRect() ?? ({ left: 0, top: 0 } as DOMRect)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, itemId: string, currentX: number, currentY: number) => {
      if (e.button !== 0 || e.metaKey) return
      e.stopPropagation()
      e.preventDefault()

      isDraggingRef.current = true
      dragItemIdRef.current = itemId
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      dragStartCanvasRef.current = canvasPos

      const idsToMove = selectedItemIds.has(itemId)
        ? selectedItemIds
        : new Set([itemId])

      initialPositionsRef.current = new Map()
      const nodeEls = containerRef.current?.querySelectorAll('[data-node-id]')
      if (nodeEls) {
        for (const el of nodeEls) {
          const id = (el as HTMLElement).dataset.nodeId!
          if (idsToMove.has(id)) {
            const x = parseFloat((el as HTMLElement).dataset.posX ?? '0')
            const y = parseFloat((el as HTMLElement).dataset.posY ?? '0')
            initialPositionsRef.current.set(id, { x, y })
          }
        }
      }

      if (!initialPositionsRef.current.has(itemId)) {
        initialPositionsRef.current.set(itemId, { x: currentX, y: currentY })
      }
    },
    [camera, containerRef, selectedItemIds],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      const dx = canvasPos.x - dragStartCanvasRef.current.x
      const dy = canvasPos.y - dragStartCanvasRef.current.y

      for (const [id, initial] of initialPositionsRef.current) {
        const el = containerRef.current?.querySelector(`[data-node-id="${id}"]`) as HTMLElement
        if (el) {
          const newX = initial.x + dx
          const newY = initial.y + dy
          el.style.transform = `translate(${newX}px, ${newY}px)`
        }
      }
    },
    [camera, containerRef],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false

      const canvasPos = screenToCanvas(e.clientX, e.clientY, getRect(), camera)
      const dx = canvasPos.x - dragStartCanvasRef.current.x
      const dy = canvasPos.y - dragStartCanvasRef.current.y

      const moves: Array<{ itemId: string; x: number; y: number }> = []
      for (const [id, initial] of initialPositionsRef.current) {
        moves.push({ itemId: id, x: initial.x + dx, y: initial.y + dy })
      }

      if (moves.length > 0 && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        onMoveEnd(moves)
      }

      dragItemIdRef.current = null
      initialPositionsRef.current.clear()
    },
    [camera, onMoveEnd],
  )

  return {
    isDragging: isDraggingRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
