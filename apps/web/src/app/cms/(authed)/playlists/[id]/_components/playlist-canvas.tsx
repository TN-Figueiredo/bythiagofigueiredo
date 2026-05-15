'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useCanvas,
  useDragNode,
  useEdgeDrag,
  useGraphHistory,
  graphReducer,
  initialGraphState,
  computeAutoLayout,
  edgePath,
  getConnectionPoints,
  computeViewNumbers,
  matchesFilter,
  DIMMED_OFFSET_Y,
  type GraphState,
} from '@/lib/playlists/canvas'
import type {
  PlaylistGraph,
  PlaylistRow,
  PlaylistEdgeRow,
  EdgeType,
  ActionResult,
  FilterState,
  ContentType,
} from '@/lib/playlists/types'
import { PlaylistNode } from './playlist-node'
import { PlaylistEdge, EdgeArrowDefs } from './playlist-edge'
import { PlaylistToolbar } from './playlist-toolbar'
import { PlaylistSidebar } from './playlist-sidebar'
import { PlaylistMinimap } from './playlist-minimap'
import { PlaylistSettings } from './playlist-settings'
import { PlaylistEmptyState } from './playlist-skeleton'
import { EdgeTypeSelector } from './edge-type-selector'
import { PlaylistContextMenu } from './context-menu'
import { FilterBar } from './filter-bar'
import { PrintView } from './print-view'
import { ExportMenu } from './export-menu'
import { ContentPicker } from './content-picker'
import type { PickerItem } from '../../actions'

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
  onAddItem: (siteId: string, input: unknown) => Promise<ActionResult<{ id: string }>>
  onFetchContent: (siteId: string, playlistId: string) => Promise<ActionResult<PickerItem[]>>
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
  onAddItem,
  onFetchContent,
}: PlaylistCanvasProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(graphReducer, undefined, initialGraphState)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
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
  const [filter, setFilter] = useState<FilterState>({
    types: new Set(),
    languages: new Set(),
    mode: 'all',
    search: '',
  })
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportBtnRef = useRef<HTMLButtonElement>(null)
  const handlePrint = useCallback(() => window.print(), [])

  const viewNumbers = useMemo(
    () => computeViewNumbers(state.items, filter),
    [state.items, filter],
  )

  const typeCounts = useMemo(() => {
    const counts: Record<ContentType, number> = { video: 0, blog_post: 0, newsletter: 0, pipeline: 0 }
    for (const item of state.items) {
      if (item.content_type && !item.is_ghost) counts[item.content_type]++
    }
    return counts
  }, [state.items])

  const filterLabel = useMemo(() => {
    const parts: string[] = []
    if (filter.types.size > 0) parts.push([...filter.types].map(t => t === 'blog_post' ? 'Blog' : t === 'newsletter' ? 'News' : t === 'pipeline' ? 'Pipe' : 'Video').join(', '))
    if (filter.languages.size > 0) parts.push([...filter.languages].map(l => l === 'pt-br' ? 'PT-BR' : 'EN').join(', '))
    return parts.join(' — ')
  }, [filter])

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
    zoomBy,
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

  const handleOpenContent = useCallback((itemId: string) => {
    const item = state.items.find(i => i.id === itemId)
    if (!item) return
    if (item.blog_post_id) router.push(`/cms/blog/${item.blog_post_id}`)
    else if (item.pipeline_id) router.push(`/cms/pipeline/${item.pipeline_id}`)
    else if (item.newsletter_edition_id) router.push(`/cms/newsletters`)
  }, [state.items, router])

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
    const prev = undo(state)
    if (prev) {
      dispatch({ type: 'LOAD', items: prev.items, edges: prev.edges })
    }
  }, [undo, state])

  const handleRedo = useCallback(() => {
    const next = redo(state)
    if (next) {
      dispatch({ type: 'LOAD', items: next.items, edges: next.edges })
    }
  }, [redo, state])

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

  const handleZoomIn = useCallback(() => zoomBy(1.25), [zoomBy])
  const handleZoomOut = useCallback(() => zoomBy(0.8), [zoomBy])

  const handleExport = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const items = state.items
    if (items.length === 0) return

    const pad = 60
    const nodeW = 250
    const nodeH = 80
    const stripeW = 26
    const minX = Math.min(...items.map(i => i.position_x)) - pad
    const minY = Math.min(...items.map(i => i.position_y)) - pad
    const maxX = Math.max(...items.map(i => i.position_x)) + nodeW + pad
    const maxY = Math.max(...items.map(i => i.position_y)) + nodeH + pad
    const w = maxX - minX
    const h = maxY - minY

    const typeColors: Record<string, string> = {
      blog_post: '#6366f1',
      newsletter: '#22c55e',
      pipeline: '#a855f7',
      video: '#ef4444',
    }
    const typeBadges: Record<string, string> = {
      blog_post: 'BLOG',
      newsletter: 'NEWS',
      pipeline: 'PIPE',
      video: 'VIDEO',
    }

    const offscreen = document.createElement('canvas')
    const scale = 2
    offscreen.width = w * scale
    offscreen.height = h * scale
    const ctx = offscreen.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.fillStyle = '#0a0a12'
    ctx.fillRect(0, 0, w, h)

    for (const item of items) {
      const x = item.position_x - minX
      const y = item.position_y - minY
      const color = item.content_type ? typeColors[item.content_type] ?? '#6b7280' : '#6b7280'
      const vn = viewNumbers.get(item.id)

      ctx.fillStyle = color + '10'
      ctx.strokeStyle = color + '60'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.roundRect(x, y, nodeW, nodeH, 10)
      ctx.fill()
      ctx.stroke()

      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x, y, stripeW, nodeH, [10, 0, 0, 10])
      ctx.clip()
      ctx.fillStyle = color
      ctx.fillRect(x, y, stripeW, nodeH)
      ctx.restore()

      if (vn != null) {
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(String(vn), x + stripeW / 2, y + nodeH / 2 + 4)
        ctx.textAlign = 'left'
      }

      const badge = item.content_type ? typeBadges[item.content_type] ?? '' : ''
      if (badge) {
        ctx.fillStyle = color
        ctx.font = 'bold 8px system-ui, -apple-system, sans-serif'
        const tw = ctx.measureText(badge).width
        ctx.beginPath()
        ctx.roundRect(x + stripeW + 8, y + 8, tw + 8, 14, 3)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.fillText(badge, x + stripeW + 12, y + 18)
      }

      ctx.fillStyle = '#fff'
      ctx.font = '600 12px system-ui, -apple-system, sans-serif'
      const maxTitleW = nodeW - stripeW - 20
      const title = item.title.length > 28 ? item.title.slice(0, 27) + '…' : item.title
      ctx.fillText(title, x + stripeW + 8, y + 38, maxTitleW)

      ctx.fillStyle = '#ffffff66'
      ctx.font = '10px system-ui, -apple-system, sans-serif'
      ctx.fillText(item.status ?? '', x + stripeW + 8, y + 54)
    }

    const edgeColors: Record<string, string> = {
      sequence: '#818cf8',
      related: '#a855f7',
      prerequisite: '#fbbf24',
      continuation: '#34d399',
    }
    for (const edge of state.edges) {
      const src = items.find(i => i.id === edge.source_item_id)
      const tgt = items.find(i => i.id === edge.target_item_id)
      if (!src || !tgt) continue

      const { sourcePoint, targetPoint } = getConnectionPoints(src, tgt)
      const sx = sourcePoint.x - minX
      const sy = sourcePoint.y - minY
      const tx = targetPoint.x - minX
      const ty = targetPoint.y - minY

      ctx.strokeStyle = edgeColors[edge.edge_type] ?? '#6b7280'
      ctx.lineWidth = 1.5
      const dx = targetPoint.x - sourcePoint.x
      const dy = targetPoint.y - sourcePoint.y
      ctx.beginPath()
      if (Math.abs(dx) >= Math.abs(dy)) {
        const ecp = Math.max(Math.abs(tx - sx) * 0.4, 50)
        const d = tx >= sx ? 1 : -1
        ctx.moveTo(sx, sy)
        ctx.bezierCurveTo(sx + ecp * d, sy, tx - ecp * d, ty, tx, ty)
      } else {
        const ecp = Math.max(Math.abs(ty - sy) * 0.4, 50)
        const d = ty >= sy ? 1 : -1
        ctx.moveTo(sx, sy)
        ctx.bezierCurveTo(sx, sy + ecp * d, tx, ty - ecp * d, tx, ty)
      }
      ctx.stroke()
    }

    offscreen.toBlob(blob => {
      if (!blob) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `playlist-${graph.playlist.slug}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/png')
  }, [containerRef, state.items, state.edges, graph.playlist.slug, viewNumbers])

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
      } else if ((e.key === '=' || e.key === '+') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleZoomIn()
      } else if (e.key === '-' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleZoomOut()
      }

      // Print shortcut
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        handlePrint()
      }

      // Cmd+Enter = open editor
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && state.selectedItemIds.size === 1) {
        e.preventDefault()
        const selectedId = state.selectedItemIds.values().next().value
        if (selectedId) handleOpenContent(selectedId)
      }

      // Single-node shortcuts (only when one node selected and no input focused)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (!isInput && state.selectedItemIds.size === 1) {
        const selectedId = state.selectedItemIds.values().next().value as string
        if (e.key === 'e' || e.key === 'E') {
          const nodeEl = document.querySelector(`[data-node-id="${selectedId}"]`)
          if (nodeEl) {
            const handles = nodeEl.querySelectorAll('[data-handle-id]')
            const rightHandle = handles[3]
            if (rightHandle) {
              const rect = rightHandle.getBoundingClientRect()
              rightHandle.dispatchEvent(new PointerEvent('pointerdown', {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                bubbles: true,
              }))
            }
          }
        } else if (e.key === 'm' || e.key === 'M') {
          const input = window.prompt('Move to position #:', '')
          if (!input) return
          const pos = parseInt(input, 10)
          if (isNaN(pos) || pos < 1) return
          const sorted = [...state.items].sort((a, b) => a.sort_order - b.sort_order)
          const targetIdx = Math.min(pos - 1, sorted.length - 1)
          const newOrder = sorted.map(i => i.id)
          const currentIdx = newOrder.indexOf(selectedId)
          if (currentIdx === -1) return
          newOrder.splice(currentIdx, 1)
          newOrder.splice(targetIdx, 0, selectedId)
          dispatch({ type: 'REORDER_ITEMS', itemIds: newOrder })
        } else if (e.key === 'n' || e.key === 'N') {
          const item = state.items.find(i => i.id === selectedId)
          if (item) navigator.clipboard.writeText(`${item.title} (${item.other_playlist_count} other playlists)`)
        }
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
    handleZoomIn,
    handleZoomOut,
    handleOpenContent,
    handlePrint,
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

  const itemMap = useMemo(() => new Map(state.items.map(i => [i.id, i])), [state.items])

  return (
    <>
    <div className="flex h-full flex-col bg-[#0a0a12] print:hidden">
      {/* Toolbar */}
      <PlaylistToolbar
        playlistName={graph.playlist.name_en || graph.playlist.name_pt}
        status={graph.playlist.status}
        saveState={saveState}
        canUndo={canUndo()}
        canRedo={canRedo()}
        zoomPercent={Math.round(camera.zoom * 100)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onAutoLayout={handleAutoLayout}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomToFit={handleZoomToFit}
        onToggleExportMenu={() => setShowExportMenu(prev => !prev)}
        onPrint={handlePrint}
        exportButtonRef={exportBtnRef}
        onToggleSettings={() => setShowSettings(prev => !prev)}
      />

      <FilterBar
        filter={filter}
        counts={typeCounts}
        totalCount={state.items.filter(i => !i.is_ghost).length}
        onChange={setFilter}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <PlaylistSidebar
          items={state.items}
          selectedItemIds={state.selectedItemIds}
          viewNumbers={viewNumbers}
          filter={filter}
          onSelectItem={handleSidebarSelectItem}
          onRemoveItem={handleRemoveItem}
          onAddContent={() => setShowPicker(true)}
          onSearchChange={(search) => setFilter(prev => ({ ...prev, search }))}
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
            data-transform-group
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

                const sourceHidden = filter.mode === 'hide' && !matchesFilter(source, filter)
                const targetHidden = filter.mode === 'hide' && !matchesFilter(target, filter)
                if (sourceHidden || targetHidden) return null

                const sourceDimmed = filter.mode === 'dim' && !matchesFilter(source, filter)
                const targetDimmed = filter.mode === 'dim' && !matchesFilter(target, filter)
                const edgeOpacity = (sourceDimmed || targetDimmed) ? 0.04 : 1

                return (
                  <PlaylistEdge
                    key={edge.id}
                    edge={edge}
                    sourceItem={source}
                    targetItem={target}
                    isSelected={state.selectedEdgeIds.has(edge.id)}
                    opacity={edgeOpacity}
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
            {state.items.map(item => {
              const isDimmed = filter.mode === 'dim' && !matchesFilter(item, filter)
              const isHidden = filter.mode === 'hide' && !matchesFilter(item, filter)
              if (isHidden) return null
              const offsetY = isDimmed ? DIMMED_OFFSET_Y : 0
              const adjustedItem = offsetY > 0 ? { ...item, position_y: item.position_y + offsetY } : item
              return (
                <PlaylistNode
                  key={item.id}
                  item={adjustedItem}
                  isSelected={state.selectedItemIds.has(item.id)}
                  isDropTarget={
                    edgeDrag.dragEdge.active &&
                    edgeDrag.dragEdge.sourceItemId !== item.id
                  }
                  isDimmed={isDimmed}
                  isIdea={!item.is_ghost && item.status === 'idea'}
                  viewNumber={viewNumbers.get(item.id) ?? null}
                  onPointerDown={dragNode.handlePointerDown}
                  onHandlePointerDown={edgeDrag.handleHandlePointerDown}
                  onContextMenu={handleContextMenu}
                  onClick={handleNodeClick}
                  onOpenContent={handleOpenContent}
                />
              )
            })}
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
      {contextMenu && (() => {
        const item = state.items.find(i => i.id === contextMenu.itemId)
        if (!item) return null
        return (
          <PlaylistContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            itemId={item.id}
            itemTitle={item.title}
            contentType={item.content_type}
            viewNumber={viewNumbers.get(item.id) ?? null}
            createdAt={item.created_at}
            onClose={() => setContextMenu(null)}
            onOpenEditor={() => handleOpenContent(item.id)}
            onCopyId={() => navigator.clipboard.writeText(item.id)}
            onAddEdge={() => {
              setContextMenu(null)
              const nodeEl = document.querySelector(`[data-node-id="${item.id}"]`)
              if (nodeEl) {
                const rect = nodeEl.getBoundingClientRect()
                const syntheticEvent = new PointerEvent('pointerdown', {
                  clientX: rect.right, clientY: rect.top + rect.height / 2,
                })
                nodeEl.querySelector('[data-handle-id]')?.dispatchEvent(syntheticEvent)
              }
            }}
            onSelectConnected={() => {
              setContextMenu(null)
              const connected = new Set<string>()
              const queue = [item.id]
              while (queue.length > 0) {
                const current = queue.pop()
                if (!current) break
                if (connected.has(current)) continue
                connected.add(current)
                for (const edge of state.edges) {
                  if (edge.source_item_id === current && !connected.has(edge.target_item_id)) queue.push(edge.target_item_id)
                  if (edge.target_item_id === current && !connected.has(edge.source_item_id)) queue.push(edge.source_item_id)
                }
              }
              dispatch({ type: 'SET_SELECTION', itemIds: Array.from(connected), edgeIds: [] })
            }}
            onMoveToPosition={() => {
              setContextMenu(null)
              const input = window.prompt('Move to position #:', '')
              if (!input) return
              const pos = parseInt(input, 10)
              if (isNaN(pos) || pos < 1) return
              const sorted = [...state.items].sort((a, b) => a.sort_order - b.sort_order)
              const targetIdx = Math.min(pos - 1, sorted.length - 1)
              const newOrder = sorted.map(i => i.id)
              const currentIdx = newOrder.indexOf(item.id)
              if (currentIdx === -1) return
              newOrder.splice(currentIdx, 1)
              newOrder.splice(targetIdx, 0, item.id)
              dispatch({ type: 'REORDER_ITEMS', itemIds: newOrder })
            }}
            onShowOtherPlaylists={() => {
              setContextMenu(null)
              navigator.clipboard.writeText(`${item.title} (${item.other_playlist_count} other playlists)`)
            }}
            onRemove={() => handleRemoveItem(item.id)}
          />
        )
      })()}

      {/* Export menu */}
      {showExportMenu && (
        <ExportMenu
          anchorRef={exportBtnRef}
          playlistName={graph.playlist.name_en || graph.playlist.name_pt}
          filterLabel={filterLabel}
          items={state.items}
          viewNumbers={viewNumbers}
          onPrint={handlePrint}
          onExportPng={handleExport}
          onClose={() => setShowExportMenu(false)}
        />
      )}

      {/* Content picker */}
      <ContentPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        playlistId={graph.playlist.id}
        siteId={siteId}
        onFetchContent={onFetchContent}
        onAddItem={onAddItem}
        onItemAdded={() => router.refresh()}
      />

    </div>

    {/* Print view (hidden on screen, visible only when printing) */}
    <PrintView
      playlistName={graph.playlist.name_en || graph.playlist.name_pt}
      filterLabel={filterLabel}
      items={state.items}
      viewNumbers={viewNumbers}
    />
    </>
  )
}
