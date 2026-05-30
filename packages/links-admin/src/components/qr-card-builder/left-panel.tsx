'use client'
import { useState, useCallback } from 'react'
import { QrCode, Type, ImagePlus, Loader2 } from 'lucide-react'
import {
  ASPECT_RATIO_PRESETS,
  MAX_ELEMENTS,
  createQrElement,
  createTextElement,
  createImageElement,
  nextElementName,
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
  const { composition, setCanvas, setBackground, addElement, updateElement, removeElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(composition.background.type as BgTab)
  const [isUploading, setIsUploading] = useState(false)

  const handlePreset = useCallback((preset: typeof ASPECT_RATIO_PRESETS[number]) => {
    if (preset.name === 'custom') {
      setCanvas({ ...composition.canvas, aspectRatio: 'custom' })
      return
    }
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [composition.canvas, setCanvas])

  const handleAddQr = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const name = nextElementName(composition.elements, 'qr')
    addElement(createQrElement(id, composition.canvas.width, composition.canvas.height, name))
    select(id)
  }, [composition, addElement, select])

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
        if (!remoteUrl) {
          console.error('[QR Card] Image upload returned empty URL')
          return
        }
        const id = crypto.randomUUID()
        const name = nextElementName(composition.elements, 'image')
        addElement(createImageElement(id, remoteUrl, composition.canvas.width, composition.canvas.height, naturalWidth, naturalHeight, name))
        select(id)
      } catch (err) {
        console.error('[QR Card] Image upload failed:', err)
      } finally {
        setIsUploading(false)
      }
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
    <>
      <style>{`
        .qr-left-add-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
        }
        .qr-left-bg-tab:hover {
          color: var(--ink) !important;
        }
        .qr-left-upload:hover {
          border-color: var(--ink-dim) !important;
        }
        .qr-left-preset:hover {
          border-color: var(--ink-dim) !important;
        }
      `}</style>
      <aside
        className="w-[252px] shrink-0 overflow-y-auto flex flex-col"
        style={{
          background: 'var(--bg-side)',
          borderRight: '1px solid var(--line)',
        }}
      >
        <section
          className="p-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--ink-dim)' }}
          >
            Aspect Ratio
          </h3>
          <div className="grid grid-cols-3 gap-1.5">
            {ASPECT_RATIO_PRESETS.map(preset => {
              const isActive = composition.canvas.aspectRatio === preset.name
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`p-1.5 text-[10px] text-center ${!isActive ? 'qr-left-preset' : ''}`}
                  style={{
                    borderRadius: 'var(--r)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line)'}`,
                    background: isActive ? 'var(--accent-soft)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                  }}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div style={{ color: isActive ? 'var(--accent)' : 'var(--ink-faint)' }}>
                    {preset.name === 'custom' ? '...' : `${preset.width}×${preset.height}`}
                  </div>
                </button>
              )
            })}
          </div>
          {composition.canvas.aspectRatio === 'custom' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                min={200}
                max={4096}
                value={composition.canvas.width}
                onChange={e => setCanvas({ ...composition.canvas, width: Number(e.target.value) })}
                className="w-1/2 px-2 py-1 text-[11px]"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  color: 'var(--ink)',
                }}
                aria-label="Width"
              />
              <span className="self-center" style={{ color: 'var(--ink-faint)' }}>&times;</span>
              <input
                type="number"
                min={200}
                max={4096}
                value={composition.canvas.height}
                onChange={e => setCanvas({ ...composition.canvas, height: Number(e.target.value) })}
                className="w-1/2 px-2 py-1 text-[11px]"
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  color: 'var(--ink)',
                }}
                aria-label="Height"
              />
            </div>
          )}
        </section>

        <section
          className="p-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--ink-dim)' }}
          >
            Add to Canvas
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddQr}
              className="qr-left-add-btn flex-1 flex flex-col items-center gap-1 p-2 text-[10px]"
              style={{
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
              disabled={composition.elements.length >= MAX_ELEMENTS}
            >
              <QrCode size={18} />QR Code
            </button>
            <button
              type="button"
              onClick={handleAddText}
              className="qr-left-add-btn flex-1 flex flex-col items-center gap-1 p-2 text-[10px]"
              style={{
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
              disabled={composition.elements.length >= MAX_ELEMENTS}
            >
              <Type size={18} />Text
            </button>
            <button
              type="button"
              onClick={handleAddImage}
              className="qr-left-add-btn flex-1 flex flex-col items-center gap-1 p-2 text-[10px]"
              style={{
                borderRadius: 'var(--r)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
              }}
              disabled={composition.elements.length >= MAX_ELEMENTS || isUploading}
            >
              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
              {isUploading ? 'Uploading...' : 'Image'}
            </button>
          </div>
        </section>

        <section
          className="p-3"
          style={{ borderBottom: '1px solid var(--line)' }}
        >
          <h3
            className="text-[10px] font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--ink-dim)' }}
          >
            Background
          </h3>
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
                className={`flex-1 py-1 text-[10px] ${bgTab !== tab ? 'qr-left-bg-tab' : ''}`}
                style={{
                  borderRadius: 'var(--r)',
                  background: bgTab === tab ? 'var(--surface)' : 'transparent',
                  color: bgTab === tab ? 'var(--ink)' : 'var(--ink-dim)',
                }}
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
              <div
                className="h-8"
                style={{
                  borderRadius: 'var(--r)',
                  background: `linear-gradient(${bg.angle}deg, ${bg.stops.map(s => `${s.color} ${s.position * 100}%`).join(', ')})`,
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>Angle</span>
                <input type="range" min={0} max={360} value={bg.angle} onChange={e => handleGradientAngle(Number(e.target.value))} className="flex-1" />
                <span className="text-[10px] w-8 text-right" style={{ color: 'var(--ink-dim)' }}>{bg.angle}&deg;</span>
              </div>
              {bg.stops.map((stop, i) => (
                <div key={i} className="flex items-center gap-2">
                  <ColorPicker value={stop.color} onChange={c => {
                    const stops = [...bg.stops]
                    stops[i] = { ...stop, color: c }
                    setBackground({ ...bg, stops })
                  }} />
                  <span className="text-[10px]" style={{ color: 'var(--ink-dim)' }}>{Math.round(stop.position * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          {bgTab === 'image' && (
            <div className="space-y-2">
              {bg.type === 'image' && bg.url && (
                <div
                  className="h-14 bg-cover bg-center"
                  style={{
                    borderRadius: 'var(--r)',
                    background: `var(--surface-2) url(${bg.url}) center/cover`,
                  }}
                />
              )}
              <button
                type="button"
                disabled={isUploading}
                onClick={async () => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = 'image/*'
                  input.onchange = async () => {
                    const file = input.files?.[0]
                    if (!file) return
                    const fallback = bg.type === 'image' ? bg.fallbackColor : '#ffffff'
                    setIsUploading(true)
                    try {
                      const remoteUrl = await onImageUpload(file)
                      if (remoteUrl) {
                        setBackground({ type: 'image', url: remoteUrl, fallbackColor: fallback, mediaType: 'image' })
                      } else {
                        console.error('[QR Card] Background upload returned empty URL')
                      }
                    } catch (err) {
                      console.error('[QR Card] Background upload failed:', err)
                    } finally {
                      setIsUploading(false)
                    }
                  }
                  input.click()
                }}
                className="qr-left-upload w-full py-2 text-[11px]"
                style={{
                  border: '1px dashed var(--ink-faint)',
                  borderRadius: 'var(--r)',
                  color: 'var(--ink-dim)',
                }}
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
    </>
  )
}
