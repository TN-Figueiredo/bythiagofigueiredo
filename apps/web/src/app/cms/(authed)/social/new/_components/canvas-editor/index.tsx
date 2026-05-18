'use client'
import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { useCardComposition } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import { useCanvasInteraction } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ContextMenu } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import type { ContextMenuEntry } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import { SocialCanvas } from './social-canvas'
import type { SocialCanvasHandle } from './social-canvas'
import { SocialLeftPanel, SOCIAL_ASPECT_RATIOS } from './social-left-panel'
import type { SocialAspectRatio } from './social-left-panel'
import { SocialRightPanel } from './social-right-panel'
import { SocialToolbar } from './social-toolbar'
import type { PositionAnchor } from './social-toolbar'

export interface SocialPostData {
  title: string
  description?: string
  coverImageUrl?: string
  logoUrl?: string
  shortUrl?: string
}

export interface SocialCanvasEditorRef {
  getComposition: () => CardComposition
  replaceComposition: (composition: CardComposition) => void
  exportSlide: () => Promise<Blob>
}

export interface SocialCanvasEditorProps {
  aspectRatio: SocialAspectRatio
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string; composition?: CardComposition }>
  postData: SocialPostData
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
  /** Load an existing composition into the editor (e.g. for editing drafts) */
  initialComposition?: CardComposition
  /** Called on every composition change — lets parent track current state */
  onCompositionChange?: (composition: CardComposition) => void
  /** Hide the aspect ratio selector (e.g. when parent enforces a fixed ratio like Stories 9:16) */
  hideAspectRatioSelector?: boolean
}

function getDefaultComposition(ratio: SocialAspectRatio): CardComposition {
  const preset = SOCIAL_ASPECT_RATIOS.find(r => r.name === ratio)!
  return {
    canvas: { width: preset.width, height: preset.height, aspectRatio: preset.name },
    version: 1 as const,
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [],
  }
}

/**
 * Replace text placeholder tokens in a composition's text elements using postData.
 * Supported tokens: {{title}}, {{description}}, {{shortUrl}}, {{logoUrl}}, {{coverImageUrl}}
 */
function resolveTemplatePlaceholders(composition: CardComposition, postData: SocialPostData): CardComposition {
  const replacements: Record<string, string> = {
    '{{title}}': postData.title,
    '{{description}}': postData.description ?? '',
    '{{shortUrl}}': postData.shortUrl ?? '',
    '{{logoUrl}}': postData.logoUrl ?? '',
    '{{coverImageUrl}}': postData.coverImageUrl ?? '',
  }
  const resolved: CardComposition = {
    ...composition,
    elements: composition.elements.map(el => {
      if (el.type !== 'text') return el
      let text = el.text
      for (const [token, value] of Object.entries(replacements)) {
        text = text.split(token).join(value)
      }
      return { ...el, text }
    }),
  }
  return resolved
}

export const SocialCanvasEditor = forwardRef<SocialCanvasEditorRef, SocialCanvasEditorProps>(
  function SocialCanvasEditor({
    aspectRatio: initialRatio, templates, postData,
    onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
    initialComposition, onCompositionChange, hideAspectRatioSelector,
  }: SocialCanvasEditorProps, ref) {
    const [aspectRatio, setAspectRatio] = useState<SocialAspectRatio>(initialRatio)
    const comp = useCardComposition(initialComposition ?? getDefaultComposition(initialRatio))
    const interaction = useCanvasInteraction()
    const canvasRef = useRef<SocialCanvasHandle>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [saveTemplateName, setSaveTemplateName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [viewportTooSmall, setViewportTooSmall] = useState(false)
    const [, setShowMediaGallery] = useState(false)

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

    // Expose imperative handle for parent components (e.g. Stories carousel)
    useImperativeHandle(ref, () => ({
      getComposition: () => comp.composition,
      replaceComposition: (c) => comp.replaceComposition(c),
      exportSlide: async () => {
        const stage = canvasRef.current?.getStage()
        if (!stage) throw new Error('Stage not ready')
        return new Promise<Blob>((resolve, reject) => {
          stage.toBlob({
            callback: (blob: Blob | null) => blob ? resolve(blob) : reject(new Error('Export failed')),
            mimeType: 'image/png',
          })
        })
      },
    }), [comp])

    // Notify parent of composition changes
    useEffect(() => {
      onCompositionChange?.(comp.composition)
    }, [comp.composition, onCompositionChange])

    // Keyboard shortcuts (same as QR Card Builder)
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
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !cmd && ix.selectedIds.size > 0) {
          e.preventDefault()
          const step = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
          ix.selectedIds.forEach(id => {
            const el = c.composition.elements.find(e => e.id === id)
            if (el && !el.locked) c.updateElement(id, { x: Math.round(el.x + dx), y: Math.round(el.y + dy) })
          })
        }
      }
      document.addEventListener('keydown', handleKey)
      return () => document.removeEventListener('keydown', handleKey)
    }, [])

    const handleReplaceImage = useCallback((elementId: string) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file || file.size > 5 * 1024 * 1024) return
        try {
          const remoteUrl = await onImageUpload(file)
          if (remoteUrl) comp.updateElement(elementId, { src: remoteUrl })
        } catch (err) {
          console.error('[Social Canvas] Replace image failed:', err)
        }
      }
      input.click()
    }, [comp, onImageUpload])

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

    const handleLoadTemplate = useCallback((templateId: string) => {
      const template = templates.find(t => t.id === templateId)
      if (!template?.composition) return
      const resolved = resolveTemplatePlaceholders(template.composition, postData)
      comp.replaceComposition(resolved)
    }, [templates, postData, comp])

    const handleSaveAsTemplate = useCallback(async () => {
      if (!saveTemplateName.trim()) return
      const stage = canvasRef.current?.getStage()
      if (!stage) return
      setIsSaving(true)
      try {
        const dataUrl = stage.toDataURL({ pixelRatio: 0.5 })
        const res = await fetch(dataUrl)
        const thumbnail = await res.blob()
        await onSaveTemplate(saveTemplateName, comp.composition, thumbnail)
        setShowSaveTemplate(false)
        setSaveTemplateName('')
      } finally {
        setIsSaving(false)
      }
    }, [saveTemplateName, comp.composition, onSaveTemplate])

    const handleExport = useCallback(async () => {
      const stage = canvasRef.current?.getStage()
      if (!stage) return
      const blob = await new Promise<Blob | null>((resolve) => {
        stage.toBlob({
          pixelRatio: 1,
          callback: (b: Blob | null) => resolve(b),
        })
      })
      if (!blob) return
      await onExport(blob, {
        format: 'png',
        scale: 1,
        width: comp.composition.canvas.width,
        height: comp.composition.canvas.height,
      })
    }, [comp.composition, onExport])

    const contextMenuItems = useCallback((): ContextMenuEntry[] => {
      const cm = interaction.contextMenu
      if (!cm?.elementId) return []
      const el = comp.composition.elements.find(e => e.id === cm.elementId)
      if (!el) return []
      const idx = comp.composition.elements.indexOf(el)
      return [
        { label: 'Bring Forward', shortcut: 'Ctrl+]', onClick: () => { if (idx < comp.composition.elements.length - 1) comp.reorderElements(idx, idx + 1) } },
        { label: 'Send Backward', shortcut: 'Ctrl+[', onClick: () => { if (idx > 0) comp.reorderElements(idx, idx - 1) } },
        { separator: true },
        { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: () => comp.addElement({ ...el, id: crypto.randomUUID(), x: el.x + 20, y: el.y + 20 }) },
        { label: el.locked ? 'Unlock' : 'Lock', shortcut: 'Ctrl+L', onClick: () => comp.updateElement(el.id, { locked: !el.locked }) },
        { separator: true },
        { label: 'Delete', shortcut: 'Del', onClick: () => { comp.removeElement(el.id); interaction.deselectAll() } },
      ]
    }, [interaction.contextMenu, comp, interaction])

    const currentPreset = SOCIAL_ASPECT_RATIOS.find(r => r.name === aspectRatio)!

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
      <div className="fixed inset-0 bg-neutral-950 flex flex-col" role="application" aria-label="Social canvas editor">
        <SocialToolbar
          aspectRatioLabel={currentPreset.label}
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
          onOpenTemplates={() => setShowSaveTemplate(true)}
          onExport={handleExport}
          onSaveAsTemplate={() => setShowSaveTemplate(true)}
          onPositionElement={handlePositionElement}
          hasSelection={interaction.selectedIds.size > 0}
        />

        <div className="flex flex-1 overflow-hidden">
          <SocialLeftPanel
            comp={comp}
            interaction={interaction}
            onImageUpload={onImageUpload}
            onOpenMediaGallery={() => setShowMediaGallery(true)}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            templates={templates}
            onLoadTemplate={handleLoadTemplate}
            hideAspectRatioSelector={hideAspectRatioSelector}
          />

          <div ref={containerRef} className="flex-1 overflow-hidden">
            <SocialCanvas
              ref={canvasRef}
              comp={comp}
              interaction={interaction}
              containerWidth={containerSize.width}
              containerHeight={containerSize.height}
            />
          </div>

          <SocialRightPanel
            composition={comp.composition}
            selectedIds={interaction.selectedIds}
            onUpdateElement={comp.updateElement}
            onRemoveElement={comp.removeElement}
            onReplaceImage={handleReplaceImage}
          />
        </div>

        {/* Status bar */}
        <div className="h-[22px] bg-neutral-900 border-t border-neutral-800 flex items-center px-3 gap-4 text-[10px] text-neutral-500">
          <span>{comp.composition.canvas.width}&times;{comp.composition.canvas.height}</span>
          <span>{currentPreset.label}</span>
          <span>{comp.composition.elements.length} elements</span>
        </div>

        {/* Save as Template dialog */}
        {showSaveTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={e => { if (e.target === e.currentTarget) setShowSaveTemplate(false) }}>
            <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-[400px]">
              <h3 className="text-lg font-semibold text-neutral-200 mb-4">Save as Template</h3>
              <input
                type="text"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-neutral-200 mb-2"
                autoFocus
              />
              <p className="text-[11px] text-neutral-500 mb-4">Aspect ratio: {currentPreset.label} ({currentPreset.name})</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowSaveTemplate(false)} className="px-4 py-2 rounded border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500">Cancel</button>
                <button type="button" onClick={handleSaveAsTemplate} disabled={!saveTemplateName.trim() || isSaving} className="px-4 py-2 rounded bg-blue-600 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {interaction.contextMenu && (
          <ContextMenu
            x={interaction.contextMenu.x}
            y={interaction.contextMenu.y}
            items={contextMenuItems()}
            onClose={interaction.closeContextMenu}
          />
        )}
      </div>
    )
  }
)
