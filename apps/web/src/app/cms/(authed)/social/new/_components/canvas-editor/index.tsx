'use client'
import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { useCardComposition } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import { useCanvasInteraction } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ContextMenu } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import type { ContextMenuEntry } from '@tn-figueiredo/links-admin/qr-card-builder/context-menu'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import type { SocialCanvasHandle } from './social-canvas'

const SocialCanvas = dynamic(
  () => import('./social-canvas').then(mod => ({ default: mod.SocialCanvas })),
  { ssr: false, loading: () => null },
)

import type { SocialPostData } from '@/lib/social/story-types'
export type { SocialPostData }
import { SocialLeftPanel, SOCIAL_ASPECT_RATIOS } from './social-left-panel'
import type { SocialAspectRatio } from './social-left-panel'
import { SocialRightPanel } from './social-right-panel'
import { SocialToolbar } from './social-toolbar'
import type { PositionAnchor } from './social-toolbar'
import { StoryFramesStrip } from './story-frames-strip'

export interface SocialCanvasEditorRef {
  getComposition: () => CardComposition
  replaceComposition: (composition: CardComposition) => void
  addImageElement: (url: string) => void
  setBackground: (url: string) => void
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
  onVideoUpload: (file: File) => Promise<string>
  /** Load an existing composition into the editor (e.g. for editing drafts) */
  initialComposition?: CardComposition
  /** Called on every composition change — lets parent track current state */
  onCompositionChange?: (composition: CardComposition) => void
  /** Hide the aspect ratio selector (e.g. when parent enforces a fixed ratio like Stories 9:16) */
  hideAspectRatioSelector?: boolean
  /** When true, fills parent container instead of using fixed positioning (for embedding in StoryEditor) */
  embedded?: boolean
  /** Called when user clicks "Usar no post" — exports and hands image back to parent */
  onUseInPost?: () => void
}

function getDefaultComposition(ratio: SocialAspectRatio): CardComposition {
  const preset = SOCIAL_ASPECT_RATIOS.find(r => r.name === ratio) ?? SOCIAL_ASPECT_RATIOS[0]
  return {
    canvas: { width: preset.width, height: preset.height, aspectRatio: preset.name },
    version: 1 as const,
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [],
  }
}

/**
 * Replace placeholder tokens in a composition using postData.
 * Text elements: {{title}}, {{description}}, {{shortUrl}}, {{logoUrl}}, {{coverImageUrl}}
 * Image elements: {{cover_image}}, {{coverImageUrl}} in src field
 */
function resolveTemplatePlaceholders(composition: CardComposition, postData: SocialPostData): CardComposition {
  const textReplacements: Record<string, string> = {
    '{{title}}': postData.title,
    '{{description}}': postData.description ?? '',
    '{{shortUrl}}': postData.shortUrl ?? '',
    '{{logoUrl}}': postData.logoUrl ?? '',
    '{{coverImageUrl}}': postData.coverImageUrl ?? '',
  }
  const imageTokens = ['{{cover_image}}', '{{coverImageUrl}}']
  const coverUrl = postData.coverImageUrl ?? ''

  const resolved: CardComposition = {
    ...composition,
    elements: composition.elements.map(el => {
      if (el.type === 'text') {
        let content = el.content
        for (const [token, value] of Object.entries(textReplacements)) {
          content = content.split(token).join(value)
        }
        return { ...el, content }
      }
      if (el.type === 'image' && el.src) {
        for (const token of imageTokens) {
          if (el.src === token && coverUrl) {
            return { ...el, src: coverUrl }
          }
        }
      }
      return el
    }),
  }
  return resolved
}

export const SocialCanvasEditor = forwardRef<SocialCanvasEditorRef, SocialCanvasEditorProps>(
  function SocialCanvasEditor({
    aspectRatio: initialRatio, templates, postData,
    onExport, onSaveTemplate, onDeleteTemplate, onImageUpload, onVideoUpload,
    initialComposition, onCompositionChange, hideAspectRatioSelector,
    embedded, onUseInPost,
  }: SocialCanvasEditorProps, ref) {
    const [aspectRatio, setAspectRatio] = useState<SocialAspectRatio>(initialRatio)
    const resolvedInitial = useMemo(
      () => initialComposition
        ? resolveTemplatePlaceholders(initialComposition, postData)
        : getDefaultComposition(initialRatio),
      // Only resolve once on mount — postData/initialComposition changes are handled by handleLoadTemplate
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    )
    const comp = useCardComposition(resolvedInitial)
    const interaction = useCanvasInteraction()
    const canvasRef = useRef<SocialCanvasHandle>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [saveTemplateName, setSaveTemplateName] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [viewportTooSmall, setViewportTooSmall] = useState(false)
    const [, setShowMediaGallery] = useState(false)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const handlePanChange = useCallback((panX: number, panY: number) => setPan({ x: panX, y: panY }), [])
    const fittedOnMount = useRef(false)
    const hasMeasuredContainer = useRef(false)
    const [pausedVideos, setPausedVideos] = useState<Set<string>>(() => new Set())
    const [videoDurations, setVideoDurations] = useState<Map<string, number>>(() => new Map())
    const [frames, setFrames] = useState([{ id: 'frame-1', thumbnailUrl: null as string | null }])
    const [activeFrameId, setActiveFrameId] = useState('frame-1')

    const handleToggleVideoPlay = useCallback((elementId: string) => {
      setPausedVideos(prev => {
        const next = new Set(prev)
        if (next.has(elementId)) next.delete(elementId)
        else next.add(elementId)
        return next
      })
    }, [])

    const handleVideoDuration = useCallback((elementId: string, duration: number) => {
      setVideoDurations(prev => {
        if (prev.get(elementId) === duration) return prev
        const next = new Map(prev)
        next.set(elementId, duration)
        return next
      })
    }, [])

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
        if (entry) {
          hasMeasuredContainer.current = true
          setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height })
        }
      })
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    useEffect(() => {
      if (fittedOnMount.current) return
      // Only fit once we have a real container measurement from ResizeObserver,
      // not the initial fallback (800×600). This prevents the tall story canvas
      // from being partially off-screen because the first fit used incorrect dims.
      if (!hasMeasuredContainer.current) return
      if (containerSize.width > 0 && containerSize.height > 0) {
        interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height)
        fittedOnMount.current = true
      }
    }, [containerSize, interaction, comp.composition.canvas.width, comp.composition.canvas.height])

    // Expose imperative handle for parent components (e.g. Stories carousel)
    useImperativeHandle(ref, () => ({
      getComposition: () => comp.composition,
      replaceComposition: (c) => comp.replaceComposition(c),
      addImageElement: (url: string) => {
        const cw = comp.composition.canvas.width
        const ch = comp.composition.canvas.height
        const size = Math.min(cw, ch) * 0.6
        comp.addElement({
          id: crypto.randomUUID(),
          type: 'image',
          src: url,
          x: (cw - size) / 2,
          y: (ch - size) / 2,
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          locked: false,
          objectFit: 'cover',
          borderRadius: 0,
          borderColor: '#000000',
          borderWidth: 0,
          maintainAspectRatio: true,
        })
      },
      setBackground: (url: string) => {
        comp.setBackground({ type: 'image', url, fallbackColor: '#0a0a0a', mediaType: 'image' })
      },
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

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const onCompositionChangeRef = useRef(onCompositionChange)
    onCompositionChangeRef.current = onCompositionChange
    useEffect(() => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        onCompositionChangeRef.current?.(comp.composition)
      }, 300)
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      }
    }, [comp.composition])

    // Keyboard shortcuts (same as QR Card Builder)
    const compRef = useRef(comp)
    const interactionRef = useRef(interaction)
    const containerSizeRef = useRef(containerSize)
    const toggleVideoPlayRef = useRef(handleToggleVideoPlay)
    compRef.current = comp
    interactionRef.current = interaction
    containerSizeRef.current = containerSize
    toggleVideoPlayRef.current = handleToggleVideoPlay

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
        if (cmd && e.key === '0') { e.preventDefault(); ix.fitToView(cs.width, cs.height, c.composition.canvas.width, c.composition.canvas.height); setPan({ x: 0, y: 0 }) }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !cmd) {
          e.preventDefault()
          ix.selectedIds.forEach(id => {
            const el = c.composition.elements.find(e => e.id === id)
            if (el && (el.type === 'image' || el.type === 'video') && c.composition.background.type === 'image' && c.composition.background.url === el.src) {
              c.setBackground({ type: 'solid', color: '#0a0a0a' })
            }
            c.removeElement(id)
          })
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
        if (e.key === 'k' && !cmd && ix.selectedIds.size > 0) {
          const videoSelected = Array.from(ix.selectedIds).find(id =>
            c.composition.elements.find(el => el.id === id && el.type === 'video'),
          )
          if (videoSelected) { e.preventDefault(); toggleVideoPlayRef.current(videoSelected) }
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
        if (!file) return
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Imagem excede o limite de 5 MB.')
          return
        }
        try {
          const remoteUrl = await onImageUpload(file)
          if (remoteUrl) comp.updateElement(elementId, { src: remoteUrl })
        } catch (err) {
          console.error('[Social Canvas] Replace image failed:', err)
        }
      }
      input.click()
    }, [comp, onImageUpload])

    const handleReplaceVideo = useCallback((elementId: string) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'video/mp4,video/webm,video/quicktime'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        if (file.size > 50 * 1024 * 1024) {
          toast.error('Video excede o limite de 50 MB.')
          return
        }
        try {
          const remoteUrl = await onVideoUpload(file)
          if (remoteUrl) comp.updateElement(elementId, { src: remoteUrl })
        } catch (err) {
          console.error('[Social Canvas] Replace video failed:', err)
        }
      }
      input.click()
    }, [comp, onVideoUpload])

    const handleSplash = useCallback((elementId: string) => {
      const el = comp.composition.elements.find(e => e.id === elementId)
      if (!el || (el.type !== 'image' && el.type !== 'video')) return
      const mediaType = el.type === 'video' ? 'video' : 'image'
      const bg: Record<string, unknown> = { type: 'image', url: el.src, fallbackColor: '#0a0a0a', blur: 45, offsetY: 0, mediaType }
      if (el.type === 'video') {
        if (el.startTime > 0) bg.startTime = el.startTime
        if (el.endTime != null) bg.endTime = el.endTime
      }
      comp.setBackground(bg as Parameters<typeof comp.setBackground>[0])
      const cw = comp.composition.canvas.width
      const ch = comp.composition.canvas.height
      const ratio = el.height / el.width
      let targetW = cw * 0.85
      let targetH = targetW * ratio
      if (targetH > ch * 0.75) {
        targetH = ch * 0.75
        targetW = targetH / ratio
      }
      comp.updateElement(elementId, {
        width: Math.round(targetW),
        height: Math.round(targetH),
        x: Math.round((cw - targetW) / 2),
        y: Math.round((ch - targetH) / 2),
        borderRadius: 16,
      })
    }, [comp])

    const handleRemoveElement = useCallback((id: string) => {
      const el = comp.composition.elements.find(e => e.id === id)
      if (el && (el.type === 'image' || el.type === 'video') && comp.composition.background.type === 'image' && comp.composition.background.url === el.src) {
        comp.setBackground({ type: 'solid', color: '#0a0a0a' })
      }
      comp.removeElement(id)
      setPausedVideos(prev => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n })
      setVideoDurations(prev => { if (!prev.has(id)) return prev; const n = new Map(prev); n.delete(id); return n })
    }, [comp])

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
        { label: 'Delete', shortcut: 'Del', onClick: () => { handleRemoveElement(el.id); interaction.deselectAll() } },
      ]
    }, [interaction.contextMenu, comp, interaction, handleRemoveElement])

    const videoElementIds = useMemo(
      () => comp.composition.elements.filter(el => el.type === 'video').map(el => el.id),
      [comp.composition.elements],
    )
    const playingVideos = useMemo(
      () => new Set(videoElementIds.filter(id => !pausedVideos.has(id))),
      [videoElementIds, pausedVideos],
    )

    const currentPreset = SOCIAL_ASPECT_RATIOS.find(r => r.name === aspectRatio) ?? SOCIAL_ASPECT_RATIOS[0]

    if (viewportTooSmall) {
      return (
        <div className={`${embedded ? 'h-full w-full' : 'fixed inset-0'} bg-neutral-950 flex items-center justify-center p-8`}>
          <div className="text-center">
            <p className="text-[16px] text-neutral-300 font-medium mb-2">Desktop Required</p>
            <p className="text-[13px] text-neutral-500">This editor requires a desktop viewport (960px+).</p>
          </div>
        </div>
      )
    }

    return (
      <div className={`${embedded ? 'h-full w-full' : 'fixed inset-0'} bg-neutral-950 flex flex-col`} role="application" aria-label="Social canvas editor">
        <SocialToolbar
          aspectRatioLabel={currentPreset.label}
          canUndo={comp.canUndo}
          canRedo={comp.canRedo}
          onUndo={comp.undo}
          onRedo={comp.redo}
          zoom={interaction.zoom}
          onZoomIn={() => interaction.setZoom(interaction.zoom + 0.1)}
          onZoomOut={() => interaction.setZoom(interaction.zoom - 0.1)}
          onFitToView={() => { interaction.fitToView(containerSize.width, containerSize.height, comp.composition.canvas.width, comp.composition.canvas.height); setPan({ x: 0, y: 0 }) }}
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
          onUseInPost={onUseInPost}
        />

        <div className="flex flex-1 overflow-hidden">
          <SocialLeftPanel
            comp={comp}
            interaction={interaction}
            onImageUpload={onImageUpload}
            onVideoUpload={onVideoUpload}
            onOpenMediaGallery={() => setShowMediaGallery(true)}
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            templates={templates}
            onLoadTemplate={handleLoadTemplate}
            hideAspectRatioSelector={hideAspectRatioSelector}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            <div ref={containerRef} className="flex-1 overflow-hidden">
              <SocialCanvas
                ref={canvasRef}
                comp={comp}
                interaction={interaction}
                containerWidth={containerSize.width}
                containerHeight={containerSize.height}
                panX={pan.x}
                panY={pan.y}
                onPanChange={handlePanChange}
                playingVideos={playingVideos}
                onVideoDuration={handleVideoDuration}
              />
            </div>

            {aspectRatio === '9:16' && (
              <StoryFramesStrip
                frames={frames}
                activeFrameId={activeFrameId}
                onSelectFrame={setActiveFrameId}
                onAddFrame={() => {
                  const newId = `frame-${frames.length + 1}`
                  setFrames(prev => [...prev, { id: newId, thumbnailUrl: null }])
                }}
                onRemoveFrame={(id) => {
                  if (frames.length <= 1) return
                  setFrames(prev => prev.filter(f => f.id !== id))
                  if (activeFrameId === id) setActiveFrameId(frames[0].id)
                }}
              />
            )}
          </div>

          <SocialRightPanel
            composition={comp.composition}
            selectedIds={interaction.selectedIds}
            onUpdateElement={comp.updateElement}
            onRemoveElement={handleRemoveElement}
            onReplaceImage={handleReplaceImage}
            onReplaceVideo={handleReplaceVideo}
            onSplash={handleSplash}
            playingVideos={playingVideos}
            onToggleVideoPlay={handleToggleVideoPlay}
            videoDurations={videoDurations}
          />
        </div>

        {/* Status bar */}
        <div className="h-[22px] bg-neutral-900 border-t border-neutral-800 flex items-center px-3 gap-4 text-[10px] text-neutral-500" role="status">
          <span>{comp.composition.canvas.width}&times;{comp.composition.canvas.height}</span>
          <span>{currentPreset.label}</span>
          <span>{comp.composition.elements.length} elements</span>
        </div>

        {/* Save as Template dialog */}
        {showSaveTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Save as Template" onClick={e => { if (e.target === e.currentTarget) setShowSaveTemplate(false) }} onKeyDown={e => { if (e.key === 'Escape') setShowSaveTemplate(false) }}>
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
