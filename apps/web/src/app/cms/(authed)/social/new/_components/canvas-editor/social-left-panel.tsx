'use client'
import { useState, useCallback, useEffect } from 'react'
import { Type, ImagePlus, Square, Film, Loader2 } from 'lucide-react'
import {
  MAX_ELEMENTS,
  createTextElement,
  nextElementName,
} from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ColorPicker } from '@tn-figueiredo/links-admin/qr-card-builder/color-picker'
import { SliderField } from '@tn-figueiredo/links-admin/qr-card-builder/inspector-field'
import { LayersPanel } from '@tn-figueiredo/links-admin/qr-card-builder/layers-panel'

export const SOCIAL_ASPECT_RATIOS = [
  { name: '9:16' as const, width: 1080, height: 1920, label: 'Story 9:16' },
  { name: '1:1' as const, width: 1080, height: 1080, label: 'Quadrado 1:1' },
  { name: '4:5' as const, width: 1080, height: 1350, label: 'Feed 4:5' },
  { name: '16:9' as const, width: 1920, height: 1080, label: 'Paisagem 16:9' },
  { name: 'wide' as const, width: 1200, height: 630, label: 'Wide/OG' },
  { name: 'custom' as const, width: 1080, height: 1080, label: 'Custom' },
] as const

export type SocialAspectRatio = (typeof SOCIAL_ASPECT_RATIOS)[number]['name']

interface SocialLeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
  onVideoUpload: (file: File) => Promise<string>
  onOpenMediaGallery: () => void
  aspectRatio: SocialAspectRatio
  onAspectRatioChange: (ratio: SocialAspectRatio) => void
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  onLoadTemplate: (templateId: string) => void
  hideAspectRatioSelector?: boolean
}

type BgTab = 'solid' | 'image' | 'gradient'

export function SocialLeftPanel({
  comp, interaction, onImageUpload, onVideoUpload, onOpenMediaGallery,
  aspectRatio, onAspectRatioChange, templates, onLoadTemplate, hideAspectRatioSelector,
}: SocialLeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)
  useEffect(() => setBgTab(composition.background.type as BgTab), [composition.background.type])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleAspectRatio = useCallback((ratio: SocialAspectRatio) => {
    const preset = SOCIAL_ASPECT_RATIOS.find(r => r.name === ratio)
    if (!preset) return
    onAspectRatioChange(ratio)
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [setCanvas, onAspectRatioChange])

  const handleAddText = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const name = nextElementName(composition.elements, 'text')
    addElement(createTextElement(id, composition.canvas.width, composition.canvas.height, name))
    select(id)
  }, [composition, addElement, select])

  const handleAddImage = useCallback(async () => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    setUploadError(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) { setUploadError('Imagem deve ter no máximo 5 MB'); return }
      setIsUploading(true)
      try {
        const localUrl = URL.createObjectURL(file)
        const { naturalWidth, naturalHeight } = await new Promise<HTMLImageElement>(resolve => {
          const img = new window.Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = localUrl
        })
        URL.revokeObjectURL(localUrl)
        const remoteUrl = await onImageUpload(file)
        if (!remoteUrl) return
        const id = crypto.randomUUID()
        const name = nextElementName(composition.elements, 'image')
        const cw = composition.canvas.width
        const ch = composition.canvas.height
        const fitW = cw * 0.6
        const fitH = ch * 0.5
        let w = fitW
        let h = fitW * (naturalHeight / naturalWidth)
        if (h > fitH) { h = fitH; w = fitH * (naturalWidth / naturalHeight) }
        w = Math.round(w)
        h = Math.round(h)
        addElement({
          id, name, type: 'image' as const, src: remoteUrl,
          x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2),
          width: w, height: h,
          rotation: 0, opacity: 1, locked: false,
          objectFit: 'cover' as const,
          borderRadius: 0, borderColor: '#000000', borderWidth: 0,
          maintainAspectRatio: true,
        })
        select(id)
      } catch (err) {
        console.error('[Social Canvas] Upload failed:', err)
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }, [composition, addElement, select, onImageUpload])

  const handleAddVideo = useCallback(async () => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    setUploadError(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/mp4,video/webm,video/quicktime'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 50 * 1024 * 1024) { setUploadError('Vídeo deve ter no máximo 50 MB'); return }
      setIsUploading(true)
      try {
        const localUrl = URL.createObjectURL(file)
        const { videoWidth, videoHeight } = await new Promise<HTMLVideoElement>((resolve, reject) => {
          const video = document.createElement('video')
          video.onloadedmetadata = () => resolve(video)
          video.onerror = () => reject(new Error('Failed to load video metadata'))
          video.src = localUrl
        })
        URL.revokeObjectURL(localUrl)
        const remoteUrl = await onVideoUpload(file)
        if (!remoteUrl) return
        const id = crypto.randomUUID()
        const name = nextElementName(composition.elements, 'video')
        const cw = composition.canvas.width
        const ch = composition.canvas.height
        const fitW = cw * 0.6
        const fitH = ch * 0.5
        let w = fitW
        let h = fitW * (videoHeight / videoWidth)
        if (h > fitH) { h = fitH; w = fitH * (videoWidth / videoHeight) }
        w = Math.round(w)
        h = Math.round(h)
        addElement({
          id, name, type: 'video' as const, src: remoteUrl,
          x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2),
          width: w, height: h,
          rotation: 0, opacity: 1, locked: false,
          borderRadius: 0, borderColor: '#000000', borderWidth: 0,
          maintainAspectRatio: true, muted: true, loop: true, startTime: 0, endTime: null,
        })
        select(id)
      } catch (err) {
        console.error('[Social Canvas] Upload failed:', err)
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }, [composition, addElement, select, onVideoUpload])

  const handleBgImageUpload = useCallback(async () => {
    setUploadError(null)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 5 * 1024 * 1024) { setUploadError('Imagem deve ter no máximo 5 MB'); return }
      setIsUploading(true)
      try {
        const remoteUrl = await onImageUpload(file)
        if (!remoteUrl) return
        setBackground({ type: 'image', url: remoteUrl, fallbackColor: '#0a0a0a', blur: 20, mediaType: 'image' })
      } catch (err) {
        console.error('[Social Canvas] Upload failed:', err)
        setUploadError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }, [onImageUpload, setBackground])

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const filteredTemplates = templates.filter(t => t.aspectRatio === aspectRatio)
  const bg = composition.background

  return (
    <aside className="w-[252px] shrink-0 bg-neutral-900 border-r border-neutral-800 overflow-y-auto flex flex-col">
      {/* Aspect Ratio -- fixed presets only, no custom */}
      {!hideAspectRatioSelector && (
        <section className="p-3 border-b border-neutral-800">
          <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {SOCIAL_ASPECT_RATIOS.map(preset => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleAspectRatio(preset.name)}
                className={`p-1.5 rounded text-[10px] text-center border ${
                  aspectRatio === preset.name
                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
                }`}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-neutral-500">{preset.width}x{preset.height}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mx-3 mt-2 rounded bg-red-900/50 border border-red-700/50 px-2 py-1.5 text-[10px] text-red-300 flex items-center justify-between">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="ml-2 text-red-400 hover:text-red-200" aria-label="Dismiss error">✕</button>
        </div>
      )}

      {/* Add Elements */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Add to Canvas</h3>
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={handleAddText} className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Type size={18} />Text
          </button>
          <button type="button" onClick={handleAddImage} className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS || isUploading}>
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {isUploading ? 'Uploading...' : 'Image'}
          </button>
          <button type="button" onClick={handleAddVideo} className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS || isUploading}>
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Film size={18} />}
            {isUploading ? 'Uploading...' : 'Video'}
          </button>
          <button type="button" onClick={onOpenMediaGallery} className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Square size={18} />Gallery
          </button>

          {/* GIF */}
          <button
            type="button"
            onClick={() => {
              if (composition.elements.length >= MAX_ELEMENTS) return
              const id = crypto.randomUUID()
              addElement({
                id,
                type: 'image' as const,
                name: nextElementName(composition.elements, 'image'),
                x: 100, y: 100,
                width: 200, height: 200,
                rotation: 0,
                opacity: 1,
                src: '',
                locked: false,
              })
              select(id)
            }}
            className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]"
            disabled={composition.elements.length >= MAX_ELEMENTS}
            title="GIF renderizado como frame estatico na exportacao"
          >
            <span className="text-sm">GIF</span>
            <span className="text-[9px] text-neutral-500">Frame estatico</span>
          </button>

          {/* Sticker */}
          <button
            type="button"
            onClick={() => {
              if (composition.elements.length >= MAX_ELEMENTS) return
              const id = crypto.randomUUID()
              addElement({
                id,
                type: 'text' as const,
                name: nextElementName(composition.elements, 'text'),
                x: 100, y: 100,
                width: 160, height: 44,
                rotation: 0,
                opacity: 1,
                text: 'Saiba mais',
                fontSize: 14,
                fontFamily: 'Inter',
                fontWeight: 'bold',
                color: '#FFFFFF',
                align: 'center',
                locked: false,
                backgroundColor: '#E8823C',
                borderRadius: 22,
                padding: 12,
              })
              select(id)
            }}
            className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]"
            disabled={composition.elements.length >= MAX_ELEMENTS}
          >
            <span className="text-sm">Sticker</span>
            <span className="text-[9px] text-neutral-500">Botao com link</span>
          </button>

          {/* Logo */}
          <button
            type="button"
            onClick={() => {
              if (composition.elements.length >= MAX_ELEMENTS) return
              const id = crypto.randomUUID()
              addElement({
                id,
                type: 'image' as const,
                name: 'Logo',
                x: 40, y: 40,
                width: 80, height: 80,
                rotation: 0,
                opacity: 0.9,
                src: '',
                locked: false,
              })
              select(id)
            }}
            className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]"
            disabled={composition.elements.length >= MAX_ELEMENTS}
          >
            <span className="text-sm">Logo</span>
            <span className="text-[9px] text-neutral-500">Marca</span>
          </button>

          {/* Frame */}
          <button
            type="button"
            onClick={() => {
              if (composition.elements.length >= MAX_ELEMENTS) return
              const id = crypto.randomUUID()
              addElement({
                id,
                type: 'image' as const,
                name: nextElementName(composition.elements, 'image'),
                x: 0, y: 0,
                width: composition.canvas.width,
                height: composition.canvas.height,
                rotation: 0,
                opacity: 0.3,
                src: '',
                locked: false,
              })
              select(id)
            }}
            className="flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]"
            disabled={composition.elements.length >= MAX_ELEMENTS}
          >
            <span className="text-sm">Frame</span>
            <span className="text-[9px] text-neutral-500">Decorativo</span>
          </button>
        </div>
      </section>

      {/* Background */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Background</h3>
        <div className="flex gap-1 mb-2">
          {(['solid', 'image', 'gradient'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setBgTab(tab)
                if (tab === 'solid' && bg.type !== 'solid') setBackground({ type: 'solid', color: '#0a0a0a' })
                if (tab === 'gradient' && bg.type !== 'gradient') setBackground({ type: 'gradient', angle: 180, stops: [{ color: '#0a0a0a', position: 0 }, { color: '#1a1a2e', position: 1 }] })
              }}
              className={`flex-1 py-1 rounded text-[10px] ${bgTab === tab ? 'bg-neutral-700 text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        {bgTab === 'solid' && bg.type === 'solid' && (
          <ColorPicker value={bg.color} onChange={handleSolidColor} label="Color" />
        )}
        {bgTab === 'image' && (
          <div className="space-y-2">
            {bg.type === 'image' ? (
              <>
                <div className="h-14 rounded bg-neutral-800 bg-cover bg-center border border-neutral-700" style={{ backgroundImage: `url(${bg.url})` }} />
                <button type="button" onClick={handleBgImageUpload} className="w-full py-1.5 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400" disabled={isUploading}>
                  Replace image
                </button>
                <SliderField label="Blur" value={bg.blur ?? 0} onChange={v => setBackground({ ...bg, blur: v })} min={0} max={80} format={v => `${v}px`} />
                <SliderField label="Position Y" value={bg.offsetY ?? 0} onChange={v => setBackground({ ...bg, offsetY: v })} min={-500} max={500} format={v => `${v}px`} />
                <button
                  type="button"
                  onClick={() => { setBackground({ type: 'solid', color: '#0a0a0a' }); setBgTab('solid') }}
                  className="w-full py-1.5 border border-dashed border-red-700/50 rounded text-[11px] text-red-400 hover:border-red-600"
                >
                  Remove
                </button>
              </>
            ) : (
              <button type="button" onClick={handleBgImageUpload} className="w-full py-2 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Choose image...'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Template Gallery */}
      {filteredTemplates.length > 0 && (
        <section className="p-3 border-b border-neutral-800">
          <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Templates</h3>
          <div className="grid grid-cols-2 gap-2">
            {filteredTemplates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onLoadTemplate(t.id)}
                className="rounded border border-neutral-700 hover:border-blue-500 overflow-hidden"
              >
                {t.thumbnailUrl ? (
                  <img src={t.thumbnailUrl} alt={t.name} className="w-full aspect-video object-cover" />
                ) : (
                  <div className="w-full aspect-video bg-neutral-800 flex items-center justify-center text-[10px] text-neutral-500">
                    {t.name}
                  </div>
                )}
                <p className="text-[9px] text-neutral-400 px-1 py-0.5 truncate">{t.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Layers */}
      <section className="p-3 flex-1">
        <LayersPanel
          elements={composition.elements}
          selectedIds={selectedIds}
          onSelect={select}
          onReorder={comp.reorderElements}
          onUpdateElement={comp.updateElement}
        />
      </section>
    </aside>
  )
}
