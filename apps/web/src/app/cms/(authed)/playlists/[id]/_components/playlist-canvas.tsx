'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  useCanvas,
  useDragNode,
  useEdgeDrag,
  useGraphHistory,
  graphReducer,
  initialGraphState,
  computeAutoLayout,
  edgePath,
  type GraphState,
} from '@/lib/playlists/canvas'
import type {
  PlaylistGraph,
  PlaylistRow,
  PlaylistEdgeRow,
  EdgeType,
  ActionResult,
} from '@/lib/playlists/types'
import { PlaylistNode } from './playlist-node'
import { PlaylistEdge, EdgeArrowDefs } from './playlist-edge'
import { PlaylistToolbar } from './playlist-toolbar'
import { PlaylistSidebar } from './playlist-sidebar'
import { PlaylistMinimap } from './playlist-minimap'
import { PlaylistSettings } from './playlist-settings'
import { PlaylistEmptyState } from './playlist-skeleton'
import { EdgeTypeSelector } from './edge-type-selector'
import { ContextMenu } from './context-menu'

type SaveState = 'saved' | 'saving' | 'error'

interface PlaylistCanvasProps {
  graph: PlaylistGraph
  siteId: string
  onSaveDelta: (siteId: string, input: unknown) => Promise<ActionResult<void>>
  onRemoveItem: (itemId: string, siteId: string) => Promise<ActionResult<void>>
  onCreateEdge: (siteId: string, input: unknown) => Promise<ActionResult<{ id: string }>>
  onDeleteEdge: (edgeId: string, siteId: string) => Promise<ActionResult<void>>
  onSaveViewport: (
    playlistId: string,
    siteId: string,
    viewport: { zoom: number; x: number; y: number },
  ) => Promise<ActionResult<void>>
  onUpdate: (playlistId: string, siteId: string, input: unknown) => Promise<ActionResult<PlaylistRow>>
  onDelete: (playlistId: string, siteId: string) => Promise<ActionResult<void>>
}

export function PlaylistCanvas({
  graph,
  siteId,
  onSaveDelta,
  onRemoveItem,
  onCreateEdge,
  onDeleteEdge,
  onSaveViewport,
  onUpdate,
  onDelete,
}: PlaylistCanvasProps) {
  const [state, dispatch] = useReducer(graphReducer, undefined, initialGraphState)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [showSettings, setShowSettings] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    itemId: string
  } | null>(null)
  const [edgeSelector, setEdgeSelector] = useState<{
    x: number
    y: number
    sourceId: string
    targetId: string
  } | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSavingRef = useRef(false)
  const pendingDeltaRef = useRef<{
    itemsUpserted: Map<
      string,
      { id: string; position_x: number; position_y: number; sort_order: number }
    >
    itemsRemoved: Set<string>
    edgesCreated: Array<{
      source_item_id: string
      target_item_id: string
      edge_type: EdgeType
      label?: string
    }>
    edgesRemoved: Set<string>
  }>({
    itemsUpserted: new Map(),
    itemsRemoved: new Set(),
    edgesCreated: [],
    edgesRemoved: new Set(),
  })

  // Initialize state from server data
  useEffect(() => {
    dispatch({ type: 'LOAD', items: graph.items, edges: graph.edges })
  }, [graph])

  // Canvas hooks
  const {
    camera,
    setCamera,
    containerRef,
    handleWheel,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    zoomToFit,
    isPanning,
  } = useCanvas({
    initialCamera: graph.playlist.viewport_state
      ? {
          x: graph.playlist.viewport_state.x,
          y: graph.playlist.viewport_state.y,
          zoom: graph.playlist.viewport_state.zoom,
        }
      : undefined,
  })

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useGraphHistory<GraphState>()

  // ── Auto-save ────────────────────────────────────────────────────────

  const flushDelta = useCallback(async () => {
    if (isSavingRef.current) return
    const delta = pendingDeltaRef.current
    const hasChanges =
      delta.itemsUpserted.size > 0 ||
      delta.itemsRemoved.size > 0 ||
      delta.edgesCreated.length > 0 ||
      delta.edgesRemoved.size > 0

    if (!hasChanges) return

    isSavingRef.current = true
    setSaveState('saving')

    const payload = {
      playlistId: graph.playlist.id,
      itemsUpserted: Array.from(delta.itemsUpserted.values()),
      itemsRemoved: Array.from(delta.itemsRemoved),
      edgesCreated: delta.edgesCreated,
      edgesRemoved: Array.from(delta.edgesRemoved),
    }

    pendingDeltaRef.current = {
      itemsUpserted: new Map(),
      itemsRemoved: new Set(),
      edgesCreated: [],
      edgesRemoved: new Set(),
    }

    try {
      const result = await onSaveDelta(siteId, payload)
      setSaveState(result.ok ? 'saved' : 'error')
    } finally {
      isSavingRef.current = false
      // Re-check if more changes queued while we were saving
      const next = pendingDeltaRef.current
      if (next.itemsUpserted.size > 0 || next.itemsRemoved.size > 0 ||
          next.edgesCreated.length > 0 || next.edgesRemoved.size > 0) {
        scheduleSaveRef.current()
      }
    }
  }, [graph.playlist.id, onSaveDelta, siteId])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(flushDelta, 1500)
    setSaveState('saving')
  }, [flushDelta])
  const scheduleSaveRef = useRef(scheduleSave)
  scheduleSaveRef.current = scheduleSave

  // ── Node drag ────────────────────────────────────────────────────────

  const handleMoveEnd = useCallback(
    (moves: Array<{ itemId: string; x: number; y: number }>) => {
      pushSnapshot(state)
      dispatch({ type: 'MOVE_ITEMS', moves })
      for (const move of moves) {
        const item = state.items.find(i => i.id === move.itemId)
        if (item) {
          pendingDeltaRef.current.itemsUpserted.set(item.id, {
            id: item.id,
            position_x: move.x,
            position_y: move.y,
            sort_order: item.sort_order,
          })
        }
      }
      scheduleSave()
    },
    [pushSnapshot, state, scheduleSave],
  )

  const dragNode = useDragNode({
    camera,
    containerRef,
    selectedItemIds: state.selectedItemIds,
    onMoveEnd: handleMoveEnd,
  })

  // ── Edge creation ────────────────────────────────────────────────────

  const handleEdgeCreated = useCallback(
    (sourceId: string, targetId: string) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setEdgeSelector({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        sourceId,
        targetId,
      })
    },
    [containerRef],
  )

  const edgeDrag = useEdgeDrag({
    camera,
    containerRef,
    onEdgeCreated: handleEdgeCreated,
  })

  const handleEdgeTypeSelected = useCallback(
    async (edgeType: EdgeType) => {
      if (!edgeSelector) return
      const { sourceId, targetId } = edgeSelector
      setEdgeSelector(null)

      const result = await onCreateEdge(siteId, {
        playlistId: graph.playlist.id,
        sourceItemId: sourceId,
        targetItemId: targetId,
        edgeType,
      })

      if (result.ok) {
        const newEdge: PlaylistEdgeRow = {
          id: result.data.id,
          playlist_id: graph.playlist.id,
          source_item_id: sourceId,
          target_item_id: targetId,
          edge_type: edgeType,
          label: null,
          created_at: new Date().toISOString(),
        }
        pushSnapshot(state)
        dispatch({ type: 'ADD_EDGE', edge: newEdge })
      }
    },
    [edgeSelector, onCreateEdge, siteId, graph.playlist.id, pushSnapshot, state],
  )

  // ── Selection ────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (e: Pick<React.MouseEvent, 'shiftKey'>, itemId: string) => {
      if (e.shiftKey) {
        const newIds = new Set(state.selectedItemIds)
        if (newIds.has(itemId)) newIds.delete(itemId)
        else newIds.add(itemId)
        dispatch({ type: 'SET_SELECTION', itemIds: Array.from(newIds), edgeIds: [] })
      } else {
        dispatch({ type: 'SET_SELECTION', itemIds: [itemId], edgeIds: [] })
      }
    },
    [state.selectedItemIds],
  )

  const handleEdgeSelect = useCallback((edgeId: string) => {
    dispatch({ type: 'SET_SELECTION', itemIds: [], edgeIds: [edgeId] })
  }, [])

  const handleCanvasClick = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
    setContextMenu(null)
  }, [])

  // ── Context menu ─────────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent, itemId: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, itemId })
  }, [])

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      pushSnapshot(state)
      dispatch({ type: 'REMOVE_ITEM', itemId })
      await onRemoveItem(itemId, siteId)
    },
    [pushSnapshot, state, onRemoveItem, siteId],
  )

  const handleDeleteSelectedEdges = useCallback(async () => {
    if (state.selectedEdgeIds.size === 0) return
    pushSnapshot(state)
    const edgeIds = Array.from(state.selectedEdgeIds)
    for (const edgeId of edgeIds) {
      dispatch({ type: 'REMOVE_EDGE', edgeId })
    }
    await Promise.all(edgeIds.map(edgeId => onDeleteEdge(edgeId, siteId)))
  }, [state, pushSnapshot, onDeleteEdge, siteId])

  // ── Toolbar actions ──────────────────────────────────────────────────

  const handleUndo = useCallback(() => {
    const prev = undo()
    if (prev) {
      dispatch({ type: 'LOAD', items: prev.items, edges: prev.edges })
    }
  }, [undo])

  const handleRedo = useCallback(() => {
    const next = redo()
    if (next) {
      dispatch({ type: 'LOAD', items: next.items, edges: next.edges })
    }
  }, [redo])

  const handleAutoLayout = useCallback(() => {
    pushSnapshot(state)
    const positions = computeAutoLayout(state.items, state.edges)
    dispatch({ type: 'SET_POSITIONS', positions })
    for (const pos of positions) {
      const item = state.items.find(i => i.id === pos.itemId)
      if (item) {
        pendingDeltaRef.current.itemsUpserted.set(item.id, {
          id: item.id,
          position_x: pos.x,
          position_y: pos.y,
          sort_order: item.sort_order,
        })
      }
    }
    scheduleSave()
  }, [pushSnapshot, state, scheduleSave])

  const handleZoomToFit = useCallback(() => {
    zoomToFit(state.items)
  }, [zoomToFit, state.items])

  const handleMinimapNavigate = useCallback(
    (x: number, y: number) => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      setCamera(prev => ({
        ...prev,
        x: -x * prev.zoom + width / 2,
        y: -y * prev.zoom + height / 2,
      }))
    },
    [containerRef, setCamera],
  )

  // ── Keyboard shortcuts ───────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault()
        handleRedo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey) {
        if (state.selectedItemIds.size > 0) {
          for (const itemId of state.selectedItemIds) {
            handleRemoveItem(itemId)
          }
        }
        if (state.selectedEdgeIds.size > 0) {
          handleDeleteSelectedEdges()
        }
      } else if (e.key === 'Escape') {
        dispatch({ type: 'CLEAR_SELECTION' })
        setContextMenu(null)
        setEdgeSelector(null)
      } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        dispatch({
          type: 'SET_SELECTION',
          itemIds: state.items.map(i => i.id),
          edgeIds: [],
        })
      } else if (e.key === '0' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleZoomToFit()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    handleUndo,
    handleRedo,
    handleRemoveItem,
    handleDeleteSelectedEdges,
    handleZoomToFit,
    state.selectedItemIds,
    state.selectedEdgeIds,
    state.items,
  ])

  // ── Viewport persistence (debounced) ─────────────────────────────────

  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cameraRef = useRef(camera)
  cameraRef.current = camera

  useEffect(() => {
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
    viewportTimerRef.current = setTimeout(() => {
      onSaveViewport(graph.playlist.id, siteId, camera)
    }, 2000)
    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current)
    }
  }, [camera, graph.playlist.id, siteId, onSaveViewport])

  useEffect(() => {
    function handleBeforeUnload() {
      onSaveViewport(graph.playlist.id, siteId, cameraRef.current)
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [graph.playlist.id, siteId, onSaveViewport])

  // ── Flush on unmount ─────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        flushDelta()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sidebar handlers ─────────────────────────────────────────────────

  const handleSidebarSelectItem = useCallback((itemId: string) => {
    dispatch({ type: 'SET_SELECTION', itemIds: [itemId], edgeIds: [] })
  }, [])

  // ── Render ───────────────────────────────────────────────────────────

  const itemMap = new Map(state.items.map(i => [i.id, i]))

  return (
    <div className="flex h-full flex-col bg-[#0a0a12]">
      {/* Toolbar */}
      <PlaylistToolbar
        playlistName={graph.playlist.name_en || graph.playlist.name_pt}
        status={graph.playlist.status}
        saveState={saveState}
        canUndo={canUndo()}
        canRedo={canRedo()}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onZoomToFit={handleZoomToFit}
        onToggleSettings={() => setShowSettings(prev => !prev)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <PlaylistSidebar
          items={state.items}
          selectedItemIds={state.selectedItemIds}
          onSelectItem={handleSidebarSelectItem}
          onRemoveItem={handleRemoveItem}
        />

        {/* Canvas viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden"
          onWheel={handleWheel}
          onPointerDown={e => {
            handlePanStart(e)
            if (!isPanning.current && e.button === 0 && !e.metaKey) {
              // Only clear selection if clicking on empty canvas
              const target = e.target as HTMLElement
              if (target.dataset.canvasBackground !== undefined) {
                handleCanvasClick()
              }
            }
          }}
          onPointerMove={e => {
            handlePanMove(e)
            dragNode.handlePointerMove(e)
            edgeDrag.handleHandlePointerMove(e)
          }}
          onPointerUp={e => {
            handlePanEnd()
            dragNode.handlePointerUp(e)
            edgeDrag.handleHandlePointerUp(e)
          }}
          data-canvas-background
        >
          {/* Transform group */}
          <div
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG edge layer */}
            <svg
              className="pointer-events-none absolute inset-0"
              style={{ overflow: 'visible' }}
            >
              <EdgeArrowDefs />
              {state.edges.map(edge => {
                const source = itemMap.get(edge.source_item_id)
                const target = itemMap.get(edge.target_item_id)
                if (!source || !target) return null
                return (
                  <PlaylistEdge
                    key={edge.id}
                    edge={edge}
                    sourceItem={source}
                    targetItem={target}
                    isSelected={state.selectedEdgeIds.has(edge.id)}
                    onSelect={handleEdgeSelect}
                  />
                )
              })}

              {/* Drag edge preview */}
              {edgeDrag.dragEdge.active && (
                <path
                  d={edgePath(
                    edgeDrag.dragEdge.sourcePoint,
                    edgeDrag.dragEdge.currentPoint,
                  )}
                  stroke="#818cf8"
                  strokeWidth={2}
                  strokeDasharray="6,3"
                  fill="none"
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </svg>

            {/* DOM node layer */}
            {state.items.map(item => (
              <PlaylistNode
                key={item.id}
                item={item}
                isSelected={state.selectedItemIds.has(item.id)}
                onPointerDown={dragNode.handlePointerDown}
                onHandlePointerDown={edgeDrag.handleHandlePointerDown}
                onContextMenu={handleContextMenu}
                onClick={handleNodeClick}
              />
            ))}
          </div>

          {/* Empty state */}
          {state.items.length === 0 && <PlaylistEmptyState />}

          {/* Mini-map */}
          <PlaylistMinimap
            items={state.items}
            camera={camera}
            viewportWidth={containerRef.current?.clientWidth ?? 0}
            viewportHeight={containerRef.current?.clientHeight ?? 0}
            onNavigate={handleMinimapNavigate}
          />
        </div>

        {/* Settings panel */}
        <PlaylistSettings
          playlist={graph.playlist}
          itemCount={state.items.length}
          edgeCount={state.edges.length}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      </div>

      {/* Edge type selector popover */}
      {edgeSelector && (
        <EdgeTypeSelector
          x={edgeSelector.x}
          y={edgeSelector.y}
          onSelect={handleEdgeTypeSelected}
          onCancel={() => setEdgeSelector(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: 'Select',
              onClick: () =>
                handleNodeClick({ shiftKey: false }, contextMenu.itemId),
            },
            {
              label: 'Remove from playlist',
              onClick: () => handleRemoveItem(contextMenu.itemId),
              variant: 'danger',
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
