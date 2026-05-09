import { useState, useCallback, useMemo } from 'react'

export interface ContextMenuState {
  x: number
  y: number
  elementId: string | null
}

export function useCanvasInteraction() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [zoom, setZoomState] = useState(1)
  const [guidesVisible, setGuidesVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(false)
  const [clipOverflow, setClipOverflow] = useState(true)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const select = useCallback((id: string) => {
    setSelectedIds(new Set([id]))
  }, [])

  const multiSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const setZoom = useCallback((z: number) => {
    setZoomState(Math.max(0.1, Math.min(5, z)))
  }, [])

  const fitToView = useCallback(
    (containerWidth: number, containerHeight: number, canvasWidth: number, canvasHeight: number) => {
      const padding = 80
      const scaleX = (containerWidth - padding) / canvasWidth
      const scaleY = (containerHeight - padding) / canvasHeight
      setZoomState(Math.min(scaleX, scaleY, 1))
    },
    [],
  )

  const toggleGuides = useCallback(() => setGuidesVisible(prev => !prev), [])
  const toggleGrid = useCallback(() => setGridVisible(prev => !prev), [])
  const toggleClipOverflow = useCallback(() => setClipOverflow(prev => !prev), [])

  const openContextMenu = useCallback((x: number, y: number, elementId: string | null) => {
    setContextMenu({ x, y, elementId })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  return useMemo(() => ({
    selectedIds,
    select,
    multiSelect,
    deselectAll,
    zoom,
    setZoom,
    fitToView,
    guidesVisible,
    gridVisible,
    clipOverflow,
    toggleGuides,
    toggleGrid,
    toggleClipOverflow,
    contextMenu,
    openContextMenu,
    closeContextMenu,
  }), [
    selectedIds, select, multiSelect, deselectAll,
    zoom, setZoom, fitToView,
    guidesVisible, gridVisible, clipOverflow, toggleGuides, toggleGrid, toggleClipOverflow,
    contextMenu, openContextMenu, closeContextMenu,
  ])
}

export type UseCanvasInteractionReturn = ReturnType<typeof useCanvasInteraction>
