'use client'
import { useState, useCallback } from 'react'
import {
  AlignLeft,
  Image,
  FileVideo2,
  Link2,
  QrCode,
  Type,
  LayoutTemplate,
  Info,
  Loader2,
  Plus,
  X,
  Trash2,
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

export interface CustomPreset {
  id: string
  name: string
  width: number
  height: number
}

interface LeftPanelProps {
  comp: UseCardCompositionReturn
  interaction: UseCanvasInteractionReturn
  onImageUpload: (file: File) => Promise<string>
  customPresets?: CustomPreset[]
  onAddPreset?: (name: string, width: number, height: number) => Promise<void>
  onDeletePreset?: (id: string) => Promise<void>
}

type BgTab = 'solid' | 'image' | 'video' | 'gradient'

const PALETTE_COLORS = [...BG_PALETTE]

export function LeftPanel({ comp, interaction, onImageUpload, customPresets = [], onAddPreset, onDeletePreset }: LeftPanelProps) {
  const { composition, setCanvas, setBackground, addElement, updateElement, removeElement, reorderElements } = comp
  const { selectedIds, select } = interaction
  const [bgTab, setBgTab] = useState<BgTab>(
    composition.background.type === 'image'
      ? (composition.background.mediaType === 'video' ? 'video' : 'image')
      : composition.background.type as BgTab,
  )
  const [isUploading, setIsUploading] = useState(false)
  const [addingPreset, setAddingPreset] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetW, setNewPresetW] = useState(1080)
  const [newPresetH, setNewPresetH] = useState(1080)

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
      if (!file) return
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
      const maxSize = isGif ? 10 * 1024 * 1024 : 5 * 1024 * 1024
      if (file.size > maxSize) return
      setIsUploading(true)
      try {
        const localUrl = URL.createObjectURL(file)
        const rawImg = await new Promise<HTMLImageElement>(resolve => {
          const img = new window.Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(img)
          img.src = localUrl
        })
        URL.revokeObjectURL(localUrl)
        let naturalWidth = rawImg.naturalWidth || 200
        let naturalHeight = rawImg.naturalHeight || 200
        if (isGif && naturalHeight > naturalWidth * 4) {
          naturalHeight = naturalWidth
        }
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

  const handleAddGif = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const PLACEHOLDER_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    const id = crypto.randomUUID()
    const size = Math.min(composition.canvas.width, composition.canvas.height) * 0.3
    addElement({
      type: 'image' as const,
      id,
      name: 'GIF',
      x: (composition.canvas.width - size) / 2,
      y: (composition.canvas.height - size) / 2,
      width: size,
      height: size,
      rotation: 0,
      opacity: 1,
      locked: false,
      src: PLACEHOLDER_GIF,
      objectFit: 'cover' as const,
      borderRadius: 0,
      borderColor: '#000000',
      borderWidth: 0,
      maintainAspectRatio: true,
    })
    select(id)
  }, [composition, addElement, select])

  const handleAddShape = useCallback(() => {
    if (composition.elements.length >= MAX_ELEMENTS) return
    const id = crypto.randomUUID()
    const w = composition.canvas.width * 0.8
    const el = createTextElement(id, composition.canvas.width, composition.canvas.height, 'Forma')
    addElement({
      ...el,
      content: '__shape:line',
      fontSize: 8,
      fontWeight: 400,
      lineHeight: 1,
      letterSpacing: '0em',
      align: 'center',
      uppercase: false,
      width: w,
      height: 6,
      x: (composition.canvas.width - w) / 2,
      y: composition.canvas.height / 2,
      backgroundColor: '#1F1B17',
      backgroundPadding: 0,
      backgroundRadius: 0,
      color: '#1F1B17',
    })
    select(id)
  }, [composition, addElement, select])

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

  /* ── Element button definitions — 2 subgroups ── */

  const contentButtons = [
    { label: 'Texto', icon: AlignLeft, handler: handleAddText, title: 'Texto — Título, frase ou chamada' },
    { label: 'Imagem', icon: Image, handler: handleAddImage, title: 'Imagem — Foto, logo ou capa' },
    { label: 'GIF', icon: FileVideo2, handler: handleAddGif, title: 'GIF — Anima a arte (exporta vídeo/GIF)' },
    { label: 'Forma', icon: LayoutTemplate, handler: handleAddShape, title: 'Forma — Linha, bloco ou contorno' },
  ] as const

  const brandButtons = [
    { label: 'QR', icon: QrCode, handler: handleAddQr, title: 'QR Code — Aponta pro seu link' },
    { label: 'Carimbo', icon: Type, handler: handleAddCarimbo, title: 'Carimbo TF — Selo da marca' },
    { label: 'Botão', icon: Link2, handler: handleAddText, title: 'Botão / CTA — Chamada visual (Aponte a câmera)' },
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
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
          <div className="flex items-start gap-1.5" style={{ marginTop: 8 }}>
            <Info size={12} style={{ color: 'var(--ink-faint)', marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{hint}</span>
          </div>
        )}

        {/* Custom presets */}
        {customPresets.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
            {customPresets.map(cp => {
              const isActive = activePreset === `custom-${cp.id}`
              return (
                <div key={cp.id} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setCanvas({ width: cp.width, height: cp.height, aspectRatio: `custom-${cp.id}` })}
                    className={!isActive ? 'qr-left-preset' : ''}
                    style={{
                      width: '100%', padding: '8px 4px', borderRadius: 9, textAlign: 'center',
                      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line-strong)'}`,
                      background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: 600 }}>{cp.name}</div>
                    <div className="font-mono" style={{ fontSize: '8.5px', marginTop: 2, opacity: 0.8 }}>
                      {cp.width}×{cp.height}
                    </div>
                  </button>
                  {onDeletePreset && (
                    <button
                      type="button"
                      onClick={() => onDeletePreset(cp.id)}
                      title="Excluir formato"
                      style={{
                        position: 'absolute', top: -4, right: -4, zIndex: 10,
                        width: 16, height: 16, borderRadius: 8,
                        background: 'var(--red)', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      <X size={10} strokeWidth={2.5} style={{ color: '#fff' }} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add preset button / form */}
        {onAddPreset && (
          <div style={{ marginTop: 8, marginBottom: 18 }}>
            {addingPreset ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--line-strong)',
                borderRadius: 9, padding: 10, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <input
                  type="text"
                  placeholder="Nome (ex: A5, Cartão)"
                  value={newPresetName}
                  onChange={e => setNewPresetName(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%', padding: '6px 8px', fontSize: 11,
                    background: 'var(--surface-2)', border: '1px solid var(--line)',
                    borderRadius: 6, color: 'var(--ink)',
                  }}
                />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="number" min={200} max={4096} value={newPresetW}
                    onChange={e => setNewPresetW(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: 11,
                      background: 'var(--surface-2)', border: '1px solid var(--line)',
                      borderRadius: 6, color: 'var(--ink)',
                    }}
                    aria-label="Largura"
                  />
                  <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}>×</span>
                  <input
                    type="number" min={200} max={4096} value={newPresetH}
                    onChange={e => setNewPresetH(Number(e.target.value))}
                    style={{
                      width: '100%', padding: '6px 8px', fontSize: 11,
                      background: 'var(--surface-2)', border: '1px solid var(--line)',
                      borderRadius: 6, color: 'var(--ink)',
                    }}
                    aria-label="Altura"
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setAddingPreset(false); setNewPresetName('') }}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--line)', borderRadius: 6,
                      background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!newPresetName.trim()}
                    onClick={async () => {
                      if (!newPresetName.trim()) return
                      await onAddPreset(newPresetName.trim(), newPresetW, newPresetH)
                      setAddingPreset(false)
                      setNewPresetName('')
                      setNewPresetW(1080)
                      setNewPresetH(1080)
                    }}
                    style={{
                      padding: '5px 10px', fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--accent)', borderRadius: 6,
                      background: 'var(--accent)', color: 'var(--pb-ink-on-accent, #1A140C)',
                      cursor: 'pointer', opacity: newPresetName.trim() ? 1 : 0.4,
                    }}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingPreset(true)}
                className="qr-left-add-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', fontSize: 10.5, fontWeight: 600,
                  border: '1px dashed var(--line)', borderRadius: 7,
                  background: 'transparent', color: 'var(--ink-dim)', cursor: 'pointer',
                }}
              >
                <Plus size={12} strokeWidth={2} />
                Novo formato
              </button>
            )}
          </div>
        )}
        {!onAddPreset && <div style={{ marginBottom: 18 }} />}

        {/* ── ADICIONAR ── */}
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-dim)', marginBottom: 10 }}
        >
          Adicionar
        </h3>

        {/* Subgroup: Conteúdo */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 6, letterSpacing: '0.04em' }}>Conteúdo</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {contentButtons.map(({ label, icon: Icon, handler, title }) => (
              <button
                key={label}
                type="button"
                title={title}
                onClick={handler}
                className="qr-left-add-btn"
                disabled={atLimit || isUploading}
                style={{
                  padding: '10px 3px', borderRadius: 9,
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  color: 'var(--ink)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  cursor: atLimit ? 'not-allowed' : 'pointer',
                  opacity: atLimit ? 0.5 : 1,
                }}
              >
                {isUploading && (label === 'Imagem' || label === 'GIF')
                  ? <Loader2 size={17} className="animate-spin" style={{ color: 'var(--ink-dim)' }} />
                  : <Icon size={17} style={{ color: 'var(--ink-dim)' }} />
                }
                <span style={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Subgroup: Marca & ação */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--ink-faint)', marginBottom: 6, letterSpacing: '0.04em' }}>Marca &amp; ação</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {brandButtons.map(({ label, icon: Icon, handler, title }) => (
              <button
                key={label}
                type="button"
                title={title}
                onClick={handler}
                className="qr-left-add-btn"
                disabled={atLimit}
                style={{
                  padding: '10px 3px', borderRadius: 9,
                  border: '1px solid var(--line)', background: 'var(--surface-2)',
                  color: 'var(--ink)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                  cursor: atLimit ? 'not-allowed' : 'pointer',
                  opacity: atLimit ? 0.5 : 1,
                }}
              >
                <Icon size={17} style={{ color: 'var(--ink-dim)' }} />
                <span style={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── FUNDO ── */}
        <h3
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--ink-dim)', marginBottom: 10 }}
        >
          Fundo
        </h3>

        {/* Background type grid 2×2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {([
            { tab: 'solid' as const, label: 'Sólido' },
            { tab: 'gradient' as const, label: 'Degradê' },
            { tab: 'image' as const, label: 'Imagem' },
            { tab: 'video' as const, label: 'Vídeo' },
          ]).map(({ tab, label }) => {
            const isActive = bgTab === tab
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
                className={!isActive ? 'qr-left-preset' : ''}
                style={{
                  padding: '8px 0',
                  borderRadius: 8,
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: isActive ? 'var(--accent-soft)' : 'var(--surface-2)',
                  color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {label}
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
                    aria-label={`Definir cor ${color}`}
                  />
                )
              })}
            </div>
            {bg.type === 'solid' && (
              <div style={{ marginTop: 10 }}>
                <ColorPicker value={bg.color} onChange={handleSolidColor} label="Cor" />
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
              Enviar / Trocar
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
                Vídeo enviado
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
              Enviar vídeo
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
              <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>Ângulo</span>
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
