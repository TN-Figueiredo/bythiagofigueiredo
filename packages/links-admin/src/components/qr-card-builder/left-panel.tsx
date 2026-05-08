'use client'
import { useState, useCallback } from 'react'
import { QrCode, Type, ImagePlus } from 'lucide-react'
import {
  ASPECT_RATIO_PRESETS,
  MAX_ELEMENTS,
  createQrElement,
  createTextElement,
  createImageElement,
} from '@tn-figueiredo/links/qr'
import type { UseCardCompositionReturn } from './use-card-composition'
import type { UseCanvasInteractionReturn } from './use-canvas-interaction'
import { ColorPicker } from './color-picker'
import { LayersPanel } from './layers-panel'

interface LeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
}

type BgTab = 'solid' | 'image' | 'gradient'

export function LeftPanel({ comp, interaction, onImageUpload }: LeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement, updateElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)

  const handlePreset = useCallback((preset: typeof ASPECT_RATIO_PRESETS[number]) => {
    if (preset.name === 'custom') return
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [setCanvas])

  const handleAddQr = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    addElement(createQrElement(id, composition.canvas.width, composition.canvas.height))
    select(id)
  }, [composition, addElement, select])

  const handleAddText = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    addElement(createTextElement(id, composition.canvas.width, composition.canvas.height))
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
      const src = await onImageUpload(file)
      const id = crypto.randomUUID()
      addElement(createImageElement(id, src, composition.canvas.width, composition.canvas.height))
      select(id)
    }
    input.click()
  }, [composition, addElement, select, onImageUpload])

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const handleGradientAngle = useCallback((angle: number) => {
    if (composition.background.type !== 'gradient') return
    setBackground({ ...composition.background, angle })
  }, [composition.background, setBackground])

  const bg = composition.background

  return (
    <aside className="w-[252px] shrink-0 bg-neutral-900 border-r border-neutral-800 overflow-y-auto flex flex-col">
      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Aspect Ratio</h3>
        <div className="grid grid-cols-3 gap-1.5">
          {ASPECT_RATIO_PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`p-1.5 rounded text-[10px] text-center border ${
                composition.canvas.aspectRatio === preset.name
                  ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                  : 'border-neutral-700 text-neutral-400 hover:border-neutral-600'
              }`}
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-neutral-500">{preset.name === 'custom' ? '...' : `${preset.width}×${preset.height}`}</div>
            </button>
          ))}
        </div>
        {composition.canvas.aspectRatio === 'custom' && (
          <div className="flex gap-2 mt-2">
            <input
              type="number"
              min={200}
              max={4096}
              value={composition.canvas.width}
              onChange={e => setCanvas({ ...composition.canvas, width: Number(e.target.value) })}
              className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
              aria-label="Width"
            />
            <span className="text-neutral-600 self-center">×</span>
            <input
              type="number"
              min={200}
              max={4096}
              value={composition.canvas.height}
              onChange={e => setCanvas({ ...composition.canvas, height: Number(e.target.value) })}
              className="w-1/2 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-[11px] text-neutral-200"
              aria-label="Height"
            />
          </div>
        )}
      </section>

      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Add to Canvas</h3>
        <div className="flex gap-2">
          <button type="button" onClick={handleAddQr} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <QrCode size={18} />QR Code
          </button>
          <button type="button" onClick={handleAddText} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <Type size={18} />Text
          </button>
          <button type="button" onClick={handleAddImage} className="flex-1 flex flex-col items-center gap-1 p-2 rounded border border-neutral-700 text-neutral-300 hover:border-blue-500 hover:text-blue-300 text-[10px]" disabled={composition.elements.length >= MAX_ELEMENTS}>
            <ImagePlus size={18} />Image
          </button>
        </div>
      </section>

      <section className="p-3 border-b border-neutral-800">
        <h3 className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Background</h3>
        <div className="flex gap-1 mb-2">
          {(['solid', 'image', 'gradient'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setBgTab(tab)
                if (tab === 'solid' && bg.type !== 'solid') setBackground({ type: 'solid', color: '#ffffff' })
                if (tab === 'gradient' && bg.type !== 'gradient') setBackground({ type: 'gradient', angle: 180, stops: [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 1 }] })
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
        {bgTab === 'gradient' && bg.type === 'gradient' && (
          <div className="space-y-2">
            <div className="h-8 rounded" style={{ background: `linear-gradient(${bg.angle}deg, ${bg.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})` }} />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-neutral-500">Angle</span>
              <input type="range" min={0} max={360} value={bg.angle} onChange={e => handleGradientAngle(Number(e.target.value))} className="flex-1" />
              <span className="text-[10px] text-neutral-400 w-8 text-right">{bg.angle}°</span>
            </div>
            {bg.stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-2">
                <ColorPicker value={stop.color} onChange={c => {
                  const stops = [...bg.stops]
                  stops[i] = { ...stop, color: c }
                  setBackground({ ...bg, stops })
                }} />
                <span className="text-[10px] text-neutral-400">{Math.round(stop.position * 100)}%</span>
              </div>
            ))}
          </div>
        )}
        {bgTab === 'image' && (
          <div className="space-y-2">
            {bg.type === 'image' && bg.url && (
              <div className="h-14 rounded bg-neutral-800 bg-cover bg-center" style={{ backgroundImage: `url(${bg.url})` }} />
            )}
            <button
              type="button"
              onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'image/*'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const src = await onImageUpload(file)
                  setBackground({ type: 'image', url: src, fallbackColor: bg.type === 'image' ? bg.fallbackColor : '#ffffff' })
                }
                input.click()
              }}
              className="w-full py-2 border border-dashed border-neutral-600 rounded text-[11px] text-neutral-400 hover:border-neutral-400"
            >
              Upload / Replace
            </button>
          </div>
        )}
      </section>

      <section className="p-3 flex-1">
        <LayersPanel
          elements={composition.elements}
          selectedIds={selectedIds}
          onSelect={select}
          onReorder={reorderElements}
          onUpdateElement={updateElement}
        />
      </section>
    </aside>
  )
}
