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
import { ContextMenu } from './context-menu'
import type { ContextMenuEntry } from './context-menu'
import { ExportModal } from './export-modal'
import { TemplateBrowser } from './template-browser'
import type { QrTemplate } from './template-browser'

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
}

export function QrCardBuilder({
  link, shortUrl, initialComposition, templates,
  onSave, onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
}: QrCardBuilderProps) {
  const comp = useCardComposition(initialComposition)
  const interaction = useCanvasInteraction()
  const canvasRef = useRef<CanvasEditorHandle>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [showExport, setShowExport] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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

  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSaving(true)
      try { await onSave(comp.composition) } finally { setIsSaving(false) }
    }, 1500)
    return () => clearTimeout(timer)
  }, [comp.composition, onSave])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      const cmd = e.metaKey || e.ctrlKey
      if (cmd && e.key === 'z' && !e.shiftKey) { e.preventDefault(); comp.undo() }
      if (cmd && e.key === 'z' && e.shiftKey) { e.preventDefault(); comp.redo() }
      if (cmd && e.key === 'g' && !e.shiftKey) { e.preventDefault(); interaction.toggleGuides() }
      if (cmd && e.key === '0') { e.preventDefault(); interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => comp.removeElement(id))
        interaction.deselectAll()
      }
      if (cmd && e.key === 'd') {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const el = comp.composition.elements.find(e => e.id === id)
          if (el) comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 })
        })
      }
      if (cmd && e.key === 'l') {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const el = comp.composition.elements.find(e => e.id === id)
          if (el) comp.updateElement(id, { locked: !el.locked })
        })
      }
      if (cmd && e.key === ']' && !e.shiftKey) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const idx = comp.composition.elements.findIndex(e => e.id === id)
          if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1)
        })
      }
      if (cmd && e.key === '[' && !e.shiftKey) {
        e.preventDefault()
        interaction.selectedIds.forEach(id => {
          const idx = comp.composition.elements.findIndex(e => e.id === id)
          if (idx > 0) comp.reorderElements(idx, idx - 1)
        })
      }
      if (cmd && e.shiftKey && e.key === 'E') { e.preventDefault(); setShowExport(true) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [comp, interaction, containerSize])

  const handleReplaceImage = useCallback((elementId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
      const src = await onImageUpload(file)
      comp.updateElement(elementId, { src })
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
      <div className="fixed inset-0 bg-neutral-950 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-[16px] text-neutral-300 font-medium mb-2">Desktop Required</p>
          <p className="text-[13px] text-neutral-500">This editor requires a desktop viewport (960px+).</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-neutral-950 flex flex-col" role="application" aria-label="QR Card canvas editor">
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
        isSaving={isSaving}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenExport={() => setShowExport(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel comp={comp} interaction={interaction} onImageUpload={onImageUpload} />

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

      <div className="h-[22px] bg-neutral-900 border-t border-neutral-800 flex items-center px-3 gap-4 text-[10px] text-neutral-500">
        <span>{comp.composition.canvas.width}×{comp.composition.canvas.height}</span>
        <span>{comp.composition.canvas.aspectRatio}</span>
        <span>{comp.composition.elements.length} elements</span>
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
