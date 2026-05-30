'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { useCardComposition } from './use-card-composition'
import { useCanvasInteraction } from './use-canvas-interaction'
import { CanvasEditor } from './canvas-editor'
import type { CanvasEditorHandle } from './canvas-editor'
import { LeftPanel } from './left-panel'
import { RightPanel } from './right-panel'
import { Toolbar } from './toolbar'
import type { PositionAnchor } from './toolbar'
import { ContextMenu } from './context-menu'
import type { ContextMenuEntry } from './context-menu'
import { ExportModal } from './export-modal'
import { TemplateBrowser } from './template-browser'
import type { QrTemplate } from './template-browser'

function hasTemporaryUrls(composition: CardComposition): boolean {
  if (composition.background.type === 'image' && composition.background.url.startsWith('blob:')) return true
  return composition.elements.some(el => el.type === 'image' && el.src.startsWith('blob:'))
}

export interface QrCardBuilderProps {
  link: { id: string; code: string; title: string | null }
  shortUrl: string
  initialComposition: CardComposition
  templates: QrTemplate[]
  onSave: (composition: CardComposition) => Promise<void>
  onExport: (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
  customPresets?: Array<{ id: string; name: string; width: number; height: number }>
  onAddPreset?: (name: string, width: number, height: number) => Promise<void>
  onDeletePreset?: (id: string) => Promise<void>
}

export function QrCardBuilder({
  link, shortUrl, initialComposition, templates,
  onSave, onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
  customPresets, onAddPreset, onDeletePreset,
}: QrCardBuilderProps) {
  const comp = useCardComposition(initialComposition)
  const interaction = useCanvasInteraction()
  const canvasRef = useRef<CanvasEditorHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [showExport, setShowExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [viewportTooSmall, setViewportTooSmall] = useState(false)

  useEffect(() => {
    function check() { setViewportTooSmall(window.innerWidth < 960) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const isFirstRender = useRef(true)
  const lastSavedRef = useRef(initialComposition)
  const pendingSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nudgingRef = useRef(false)
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const flushSave = useCallback(() => {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = null
    }
    const current = compRef.current.composition
    if (current !== lastSavedRef.current && !hasTemporaryUrls(current)) {
      lastSavedRef.current = current
      setHasPendingChanges(false)
      setIsSaving(true)
      onSaveRef.current(current).finally(() => setIsSaving(false))
    }
  }, [])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current)
    pendingSaveRef.current = null
    if (hasTemporaryUrls(comp.composition)) return
    if (nudgingRef.current) { setHasPendingChanges(true); return }
    setHasPendingChanges(true)
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null
      const current = compRef.current.composition
      if (hasTemporaryUrls(current)) return
      lastSavedRef.current = current
      setIsSaving(true)
      setHasPendingChanges(false)
      onSaveRef.current(current).finally(() => setIsSaving(false))
    }, 800)
    return () => {
      if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current)
    }
  }, [comp.composition])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasTemporaryUrls(compRef.current.composition)) {
        e.preventDefault()
        return
      }
      if (pendingSaveRef.current) {
        flushSave()
        e.preventDefault()
      }
    }
    const handleVisibility = () => {
      if (document.hidden) flushSave()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [flushSave])

  const nudgeFlush = useCallback(() => {
    nudgingRef.current = true
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current)
    nudgeTimerRef.current = setTimeout(() => {
      nudgingRef.current = false
      nudgeTimerRef.current = null
      const current = compRef.current.composition
      if (!hasTemporaryUrls(current)) {
        lastSavedRef.current = current
        setHasPendingChanges(false)
        setIsSaving(true)
        onSaveRef.current(current).finally(() => setIsSaving(false))
      }
    }, 600)
  }, [])

  const compRef = useRef(comp)
  const interactionRef = useRef(interaction)
  const containerSizeRef = useRef(containerSize)
  compRef.current = comp
  interactionRef.current = interaction
  containerSizeRef.current = containerSize

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const c = compRef.current
      const ix = interactionRef.current
      const cs = containerSizeRef.current
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 'z' && !e.shiftKey) { e.preventDefault(); c.undo() }
      if (cmd && e.key === 'z' && e.shiftKey) { e.preventDefault(); c.redo() }
      if (cmd && e.key === 'g' && !e.shiftKey) { e.preventDefault(); ix.toggleGuides() }
      if (cmd && e.key === '0') { e.preventDefault(); ix.fitToView(cs.width, cs.height, c.composition.canvas.width, c.composition.canvas.height) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
        e.preventDefault()
        ix.selectedIds.forEach(id => c.removeElement(id))
        ix.deselectAll()
      }
      if (cmd && e.key === 'd') {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el) c.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 })
        })
      }
      if (cmd && e.key === 'l') {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el) c.updateElement(id, { locked: !el.locked })
        })
      }
      if (cmd && e.key === ']' && !e.shiftKey) {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const idx = c.composition.elements.findIndex(e => e.id === id)
          if (idx < c.composition.elements.length - 1) c.reorderElements(idx, idx + 1)
        })
      }
      if (cmd && e.key === '[' && !e.shiftKey) {
        e.preventDefault()
        ix.selectedIds.forEach(id => {
          const idx = c.composition.elements.findIndex(e => e.id === id)
          if (idx > 0) c.reorderElements(idx, idx - 1)
        })
      }
      if (cmd && e.shiftKey && e.key === 'K') { e.preventDefault(); ix.toggleClipOverflow() }
      if (cmd && e.shiftKey && e.key === 'E') { e.preventDefault(); setShowExport(true) }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !cmd && ix.selectedIds.size > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        ix.selectedIds.forEach(id => {
          const el = c.composition.elements.find(e => e.id === id)
          if (el && !el.locked) c.updateElement(id, { x: Math.round(el.x + dx), y: Math.round(el.y + dy) })
        })
        nudgeFlush()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const handleReplaceImage = useCallback((elementId: string) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > MAX_FILE_SIZE) return
      try {
        const remoteUrl = await onImageUpload(file)
        if (remoteUrl) {
          comp.updateElement(elementId, { src: remoteUrl })
        } else {
          console.error('[QR Card] Replace image upload returned empty URL')
        }
      } catch (err) {
        console.error('[QR Card] Replace image upload failed:', err)
      }
    }
    input.click()
  }, [comp, onImageUpload])

  const contextMenuItems = useCallback((): ContextMenuEntry[] => {
    const cm = interaction.contextMenu
    if (!cm?.elementId) return []
    const el = comp.composition.elements.find(e => e.id === cm.elementId)
    if (!el) return []
    const idx = comp.composition.elements.indexOf(el)
    return [
      { label: 'Bring Forward', shortcut: '⌘]', onClick: () => { if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1) } },
      { label: 'Send Backward', shortcut: '⌘[', onClick: () => { if (idx > 0) comp.reorderElements(idx, idx - 1) } },
      { label: 'Bring to Front', shortcut: '⌘⇧]', onClick: () => comp.reorderElements(idx, comp.composition.elements.length - 1) },
      { label: 'Send to Back', shortcut: '⌘⇧[', onClick: () => comp.reorderElements(idx, 0) },
      { separator: true },
      { label: 'Duplicate', shortcut: '⌘D', onClick: () => comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }) },
      { label: el.locked ? 'Unlock' : 'Lock', shortcut: '⌘L', onClick: () => comp.updateElement(el.id, { locked: !el.locked }) },
      { separator: true },
      { label: 'Delete', shortcut: '⌫', onClick: () => { comp.removeElement(el.id); interaction.deselectAll() } },
    ]
  }, [interaction.contextMenu, comp, interaction])

  const handlePositionElement = useCallback((position: PositionAnchor) => {
    const cw = comp.composition.canvas.width
    const ch = comp.composition.canvas.height
    interaction.selectedIds.forEach(id => {
      const el = comp.composition.elements.find(e => e.id === id)
      if (!el) return
      let x = el.x
      let y = el.y
      const col = position[1]
      const row = position[0]
      if (col === 'l') x = 0
      else if (col === 'c') x = (cw - el.width) / 2
      else if (col === 'r') x = cw - el.width
      if (row === 't') y = 0
      else if (row === 'c') y = (ch - el.height) / 2
      else if (row === 'b') y = ch - el.height
      comp.updateElement(id, { x, y })
    })
  }, [comp, interaction.selectedIds])

  const handleSaveTemplate = useCallback(async (name: string) => {
    const stage = canvasRef.current?.getStage()
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 0.5 })
    const res = await fetch(dataUrl)
    const thumbnail = await res.blob()
    await onSaveTemplate(name, comp.composition, thumbnail)
  }, [comp.composition, onSaveTemplate])

  if (viewportTooSmall) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-8"
        style={{ background: 'var(--bg-side, #0a0a0a)' }}
      >
        <div className="text-center">
          <p className="font-medium mb-2" style={{ fontSize: 16, color: 'var(--ink, #ECE6DA)' }}>Desktop Required</p>
          <p style={{ fontSize: 13, color: 'var(--ink-dim, #A39C8E)' }}>This editor requires a desktop viewport (960px+).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col" role="application" aria-label="QR Card canvas editor" style={{ background: 'var(--bg-side, #0a0a0a)' }}>
      <style>{`
        [role="application"] input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: var(--line-strong, #333);
          outline: none;
        }
        [role="application"] input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 99px;
          background: var(--accent, #FF8240);
          border: 2px solid var(--accent, #FF8240);
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          margin-top: -5px;
        }
        [role="application"] input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 99px;
          background: var(--accent, #FF8240);
          border: 2px solid var(--accent, #FF8240);
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        [role="application"] input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;
          border-radius: 2px;
        }
        [role="application"] input[type="range"]::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: var(--line-strong, #333);
        }
      `}</style>
      <Toolbar
        linkCode={link.code}
        canUndo={comp.canUndo}
        canRedo={comp.canRedo}
        onUndo={comp.undo}
        onRedo={comp.redo}
        zoom={interaction.zoom}
        onZoomIn={() => interaction.setZoom(interaction.zoom + 0.1)}
        onZoomOut={() => interaction.setZoom(interaction.zoom - 0.1)}
        onFitToView={() => interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height)}
        guidesVisible={interaction.guidesVisible}
        onToggleGuides={interaction.toggleGuides}
        gridVisible={interaction.gridVisible}
        onToggleGrid={interaction.toggleGrid}
        clipOverflow={interaction.clipOverflow}
        onToggleClipOverflow={interaction.toggleClipOverflow}
        isSaving={isSaving}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenExport={() => setShowExport(true)}
        onPositionElement={handlePositionElement}
        hasSelection={interaction.selectedIds.size > 0}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel comp={comp} interaction={interaction} onImageUpload={onImageUpload} customPresets={customPresets} onAddPreset={onAddPreset} onDeletePreset={onDeletePreset} />

        <div ref={containerRef} className="flex-1 overflow-hidden">
          <CanvasEditor
            ref={canvasRef}
            comp={comp}
            interaction={interaction}
            shortUrl={shortUrl}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        </div>

        <RightPanel
          composition={comp.composition}
          selectedIds={interaction.selectedIds}
          shortUrl={shortUrl}
          linkCode={link.code}
          onUpdateElement={comp.updateElement}
          onRemoveElement={comp.removeElement}
          onReplaceImage={handleReplaceImage}
        />
      </div>

      <div
        className="flex items-center px-3 gap-4"
        style={{
          height: 22,
          background: 'var(--surface, #161410)',
          borderTop: '1px solid var(--line, rgba(255,255,255,0.08))',
          fontSize: 10,
          color: 'var(--ink-dim, #A39C8E)',
        }}
      >
        <span>{comp.composition.canvas.width}×{comp.composition.canvas.height}</span>
        <span>{comp.composition.canvas.aspectRatio}</span>
        <span>{comp.composition.elements.length} elements</span>
        <span className="ml-auto">
          {hasTemporaryUrls(comp.composition) ? (
            <span style={{ color: 'var(--accent)' }}>Uploading images...</span>
          ) : isSaving ? (
            <span style={{ color: 'var(--amber, #E0A23C)' }}>Saving...</span>
          ) : hasPendingChanges ? (
            <span style={{ color: 'var(--ink-faint, #6E685D)' }}>Unsaved changes</span>
          ) : (
            <span style={{ color: 'var(--green, #46B17E)' }}>Saved</span>
          )}
        </span>
      </div>

      {interaction.contextMenu && (
        <ContextMenu
          x={interaction.contextMenu.x}
          y={interaction.contextMenu.y}
          items={contextMenuItems()}
          onClose={interaction.closeContextMenu}
        />
      )}

      {showExport && (
        <ExportModal
          composition={comp.composition}
          canvasRef={canvasRef}
          linkCode={link.code}
          onExport={onExport}
          onClose={() => setShowExport(false)}
        />
      )}
      {showTemplates && (
        <TemplateBrowser
          templates={templates}
          onLoad={c => comp.replaceComposition(c)}
          onSave={handleSaveTemplate}
          onDelete={onDeleteTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  )
}
