'use client'
import { useState, useCallback } from 'react'
import { Type, ImagePlus, Square, Loader2 } from 'lucide-react'
import {
  MAX_ELEMENTS,
  createTextElement,
  createImageElement,
  nextElementName,
} from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-card-composition'
import type { UseCanvasInteractionReturn } from '@tn-figueiredo/links-admin/qr-card-builder/use-canvas-interaction'
import { ColorPicker } from '@tn-figueiredo/links-admin/qr-card-builder/color-picker'
import { LayersPanel } from '@tn-figueiredo/links-admin/qr-card-builder/layers-panel'

export const SOCIAL_ASPECT_RATIOS = [
  { name: '9:16' as const, width: 1080, height: 1920, label: 'Story' },
  { name: '1:1' as const, width: 1080, height: 1080, label: 'Square' },
  { name: '16:9' as const, width: 1280, height: 720, label: 'Landscape' },
] as const

export type SocialAspectRatio = (typeof SOCIAL_ASPECT_RATIOS)[number]['name']

interface SocialLeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
  onOpenMediaGallery: () => void
  aspectRatio: SocialAspectRatio
  onAspectRatioChange: (ratio: SocialAspectRatio) => void
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  onLoadTemplate: (templateId: string) => void
}

type BgTab = 'solid' | 'image' | 'gradient'

export function SocialLeftPanel({
  comp, interaction, onImageUpload, onOpenMediaGallery,
  aspectRatio, onAspectRatioChange, templates, onLoadTemplate,
}: SocialLeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)
  const [isUploading, setIsUploading] = useState(false)

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
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || file.size > 5 * 1024 * 1024) return
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
        addElement(createImageElement(id, remoteUrl, composition.canvas.width, composition.canvas.height, naturalWidth, naturalHeight, name))
        select(id)
      } finally {
        setIsUploading(false)
      }
    }
    input.click()
  }, [composition, addElement, select, onImageUpload])

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const filteredTemplates = templates.filter(t => t.aspectRatio === aspectRatio)
  const bg = composition.background

  return (
    <aside className="w-[252px] shrink-0 bg-neutral-900 border-r border-neutral-800 overflow-y-auto flex flex-col">
      {/* Aspect Ratio -- fixed presets only, no custom */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-1.5">
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

      {/* Add Elements */}
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Add to Canvas</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleAddText} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Type size={18} />Text
          </button>
          <button type="button" onClick={handleAddImage} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS || isUploading}>
            {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
            {isUploading ? 'Uploading...' : 'Image'}
          </button>
          <button type="button" onClick={onOpenMediaGallery} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Square size={18} />Gallery
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
