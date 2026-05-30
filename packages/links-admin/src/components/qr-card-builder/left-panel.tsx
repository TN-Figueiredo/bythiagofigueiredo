'use client'
import { useState, useCallback } from 'react'
import {
  AlignLeft,
  Image,
  FileVideo2,
  Sticker,
  QrCode,
  Type,
  BarChart3,
  Info,
  Loader2,
} from 'lucide-react'
import {
  ASPECT_RATIO_PRESETS,
  PRESET_HINTS,
  BG_PALETTE,
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

type BgTab = 'solid' | 'image' | 'video' | 'gradient'

const PALETTE_COLORS = [...BG_PALETTE]

export function LeftPanel({ comp, interaction, onImageUpload }: LeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement, updateElement, removeElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(
    composition.background.type === 'image'
      ? (composition.background.mediaType === 'video' ? 'video' : 'image')
      : composition.background.type as BgTab,
  )
  const [isUploading, setIsUploading] = useState(false)

  /* ── Format handlers ── */

  const handlePreset = useCallback((preset: typeof ASPECT_RATIO_PRESETS[number]) => {
    if (preset.name === 'custom') {
      setCanvas({ ...composition.canvas, aspectRatio: 'custom' })
      return
    }
    setCanvas({ width: preset.width, height: preset.height, aspectRatio: preset.name })
  }, [composition.canvas, setCanvas])

  /* ── Element handlers ── */

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

  const handleFileUpload = useCallback((accept: string, nameOverride?: string) => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
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
        const name = nameOverride ?? nextElementName(composition.elements, 'image')
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

  const handleAddImage = useCallback(() => handleFileUpload('image/*'), [handleFileUpload])
  const handleAddGif = useCallback(() => handleFileUpload('.gif', 'GIF'), [handleFileUpload])
  const handleAddSticker = useCallback(() => handleFileUpload('.png,.webp', 'Sticker'), [handleFileUpload])

  const handleAddCarimbo = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const el = createTextElement(id, composition.canvas.width, composition.canvas.height, 'Carimbo TF')
    addElement({
      ...el,
      fontFamily: 'Fraunces',
      fontSize: 14,
      uppercase: true,
      content: 'CARIMBO',
    })
    select(id)
  }, [composition, addElement, select])

  const handleAddEnquete = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const el = createTextElement(id, composition.canvas.width, composition.canvas.height, 'Enquete')
    addElement({ ...el, content: 'Opcao A vs B' })
    select(id)
  }, [composition, addElement, select])

  /* ── Background handlers ── */

  const handleSolidColor = useCallback((color: string) => {
    setBackground({ type: 'solid', color })
  }, [setBackground])

  const handleGradientAngle = useCallback((angle: number) => {
    if (composition.background.type !== 'gradient') return
    setBackground({ ...composition.background, angle })
  }, [composition.background, setBackground])

  const bg = composition.background
  const activePreset = composition.canvas.aspectRatio
  const hint = PRESET_HINTS[activePreset] ?? ''
  const atLimit = composition.elements.length >= MAX_ELEMENTS

  /* ── Element button definitions ── */

  const elementButtons = [
    { label: 'Texto', icon: AlignLeft, handler: handleAddText },
    { label: 'Imagem', icon: Image, handler: handleAddImage },
    { label: 'GIF', icon: FileVideo2, handler: handleAddGif },
    { label: 'Sticker', icon: Sticker, handler: handleAddSticker },
    { label: 'QR', icon: QrCode, handler: handleAddQr },
    { label: 'Carimbo', icon: Type, handler: handleAddCarimbo },
    { label: 'Enquete', icon: BarChart3, handler: handleAddEnquete },
  ] as const

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
        .qr-left-swatch:hover {
          transform: scale(1.12);
        }
      `}</style>
      <aside
        className="shrink-0 overflow-y-auto flex flex-col"
        style={{
          width: 248,
          background: 'var(--bg-side)',
          borderRight: '1px solid var(--line)',
          padding: '16px 14px',
        }}
      >
        {/* ── FORMATO ── */}
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-dim)', marginBottom: 10 }}
        >
          Formato
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
          {ASPECT_RATIO_PRESETS.map(preset => {
            const isActive = activePreset === preset.name
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePreset(preset)}
                className={!isActive ? 'qr-left-preset' : ''}
                style={{
                  padding: '8px 4px',
                  borderRadius: 9,
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11.5px', fontWeight: 600 }}>{preset.label}</div>
                <div className="font-mono" style={{ fontSize: '8.5px', marginTop: 2, opacity: 0.8 }}>
                  {preset.name === 'custom' ? 'livre' : `${preset.width}×${preset.height}`}
                </div>
              </button>
            )
          })}
        </div>

        {activePreset === 'custom' && (
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

        {hint && (
          <div className="flex items-start gap-1.5" style={{ marginTop: 8, marginBottom: 18 }}>
            <Info size={12} style={{ color: 'var(--ink-faint)', marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{hint}</span>
          </div>
        )}
        {!hint && <div style={{ marginBottom: 18 }} />}

        {/* ── ADICIONAR ── */}
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-dim)', marginBottom: 10 }}
        >
          Adicionar
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 18 }}>
          {elementButtons.map(({ label, icon: Icon, handler }) => (
            <button
              key={label}
              type="button"
              onClick={handler}
              className="qr-left-add-btn"
              disabled={atLimit || isUploading}
              style={{
                padding: '11px 4px',
                borderRadius: 9,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                color: 'var(--ink)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                cursor: atLimit ? 'not-allowed' : 'pointer',
                opacity: atLimit ? 0.5 : 1,
              }}
            >
              {isUploading && (label === 'Imagem' || label === 'GIF' || label === 'Sticker')
                ? <Loader2 size={18} className="animate-spin" style={{ color: 'var(--ink-dim)' }} />
                : <Icon size={18} style={{ color: 'var(--ink-dim)' }} />
              }
              <span style={{ fontSize: '10.5px' }}>{label}</span>
            </button>
          ))}
        </div>

        {/* ── FUNDO ── */}
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-dim)', marginBottom: 10 }}
        >
          Fundo
        </h3>

        {/* Segmented control */}
        <div style={{
          display: 'inline-flex',
          background: 'var(--surface-2)',
          borderRadius: 9,
          padding: 3,
          gap: 2,
        }}>
          {(['solid', 'image', 'video', 'gradient'] as const).map(tab => {
            const isActive = bgTab === tab
            const tabLabel: Record<BgTab, string> = {
              solid: 'Solido',
              image: 'Imagem',
              video: 'Video',
              gradient: 'Degrade',
            }
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setBgTab(tab)
                  if (tab === 'solid' && bg.type !== 'solid') {
                    setBackground({ type: 'solid', color: '#ffffff' })
                  }
                  if (tab === 'gradient' && bg.type !== 'gradient') {
                    setBackground({ type: 'gradient', angle: 180, stops: [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 1 }] })
                  }
                }}
                className={!isActive ? 'qr-left-bg-tab' : ''}
                style={{
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'rgb(26, 18, 12)' : 'var(--ink-dim)',
                  fontWeight: 600,
                  borderRadius: 7,
                  border: 'none',
                  padding: '5px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {tabLabel[tab]}
              </button>
            )
          })}
        </div>

        {/* Color palette (shown for solid tab) */}
        {bgTab === 'solid' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {PALETTE_COLORS.map(color => {
                const isActive = bg.type === 'solid' && bg.color === color
                return (
                  <button
                    key={color}
                    type="button"
                    className="qr-left-swatch"
                    onClick={() => handleSolidColor(color)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      border: isActive ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                      background: color,
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                    }}
                    aria-label={`Set color ${color}`}
                  />
                )
              })}
            </div>
            {bg.type === 'solid' && (
              <div style={{ marginTop: 10 }}>
                <ColorPicker value={bg.color} onChange={handleSolidColor} label="Color" />
              </div>
            )}
          </>
        )}

        {/* Image tab */}
        {bgTab === 'image' && (
          <div className="space-y-2" style={{ marginTop: 10 }}>
            {bg.type === 'image' && bg.url && bg.mediaType !== 'video' && (
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
                cursor: 'pointer',
              }}
            >
              Upload / Replace
            </button>
          </div>
        )}

        {/* Video tab */}
        {bgTab === 'video' && (
          <div className="space-y-2" style={{ marginTop: 10 }}>
            {bg.type === 'image' && bg.url && bg.mediaType === 'video' && (
              <div
                className="h-14 flex items-center justify-center"
                style={{
                  borderRadius: 'var(--r)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink-dim)',
                  fontSize: 11,
                }}
              >
                <FileVideo2 size={16} style={{ marginRight: 6 }} />
                Video uploaded
              </div>
            )}
            <button
              type="button"
              disabled={isUploading}
              onClick={async () => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = 'video/*'
                input.onchange = async () => {
                  const file = input.files?.[0]
                  if (!file) return
                  const fallback = bg.type === 'image' ? bg.fallbackColor : '#ffffff'
                  setIsUploading(true)
                  try {
                    const remoteUrl = await onImageUpload(file)
                    if (remoteUrl) {
                      setBackground({ type: 'image', url: remoteUrl, fallbackColor: fallback, mediaType: 'video' })
                    } else {
                      console.error('[QR Card] Video background upload returned empty URL')
                    }
                  } catch (err) {
                    console.error('[QR Card] Video background upload failed:', err)
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
                cursor: 'pointer',
              }}
            >
              Upload Video
            </button>
          </div>
        )}

        {/* Gradient tab */}
        {bgTab === 'gradient' && bg.type === 'gradient' && (
          <div className="space-y-2" style={{ marginTop: 10 }}>
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

        {/* ── CAMADAS ── */}
        <section className="mt-4 flex-1">
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
