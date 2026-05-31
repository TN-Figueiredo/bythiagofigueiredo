'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Check, Loader2, Download, Copy } from 'lucide-react'
import { encode as encodeGif } from 'modern-gif'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { compositionToSvg } from '@tn-figueiredo/links/qr'
import type { CanvasEditorHandle } from './canvas-editor'

/* ── types ── */

type ExportFormat = 'png' | 'jpg' | 'svg' | 'gif' | 'mp4'
type ExportState = 'idle' | 'exporting' | 'done' | 'error'

interface ExportModalProps {
  composition: CardComposition
  canvasRef: React.RefObject<CanvasEditorHandle | null>
  linkCode: string
  onExport: (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onClose: () => void
}

/* ── helpers ── */

function withExportStage<T>(
  stage: import('konva').default.Stage,
  canvasW: number,
  canvasH: number,
  fn: (stage: import('konva').default.Stage) => T,
): T {
  const prev = {
    width: stage.width(),
    height: stage.height(),
    scaleX: stage.scaleX(),
    scaleY: stage.scaleY(),
    offsetX: stage.offsetX(),
    offsetY: stage.offsetY(),
  }
  stage.size({ width: canvasW, height: canvasH })
  stage.scale({ x: 1, y: 1 })
  stage.offset({ x: 0, y: 0 })
  try {
    return fn(stage)
  } finally {
    stage.size({ width: prev.width, height: prev.height })
    stage.scale({ x: prev.scaleX, y: prev.scaleY })
    stage.offset({ x: prev.offsetX, y: prev.offsetY })
    stage.batchDraw()
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function estimateFileSize(w: number, h: number, scale: number, fmt: ExportFormat): number {
  const pixels = w * h * scale * scale
  if (fmt === 'jpg') return Math.round(pixels * 0.3)
  if (fmt === 'png') return Math.round(pixels * 4 / 5) // rough: 4 bytes/px with ~80% compression
  if (fmt === 'gif') return Math.round(pixels * 0.5) // rough estimate for single-frame; animated will be larger
  return 0
}

function compositionHasAnimatedGif(composition: CardComposition): boolean {
  const bgIsGif = composition.background.type === 'image' && composition.background.url.toLowerCase().endsWith('.gif')
  const elemHasGif = composition.elements.some(el =>
    el.type === 'image' && (
      el.name?.includes('GIF') ||
      el.src.toLowerCase().endsWith('.gif')
    ),
  )
  return bgIsGif || elemHasGif
}

async function captureGifFrames(
  stage: import('konva').default.Stage,
  canvasW: number,
  canvasH: number,
  frameCount: number,
  delayMs: number,
  onProgress?: (current: number, total: number) => void,
): Promise<Array<{ data: HTMLCanvasElement; delay: number }>> {
  const frames: Array<{ data: HTMLCanvasElement; delay: number }> = []
  for (let i = 0; i < frameCount; i++) {
    onProgress?.(i + 1, frameCount)
    await new Promise(r => setTimeout(r, delayMs))
    const canvas = withExportStage(stage, canvasW, canvasH, (s) =>
      s.toCanvas({ pixelRatio: 1 }),
    )
    frames.push({ data: canvas, delay: delayMs })
  }
  return frames
}

/* ── format / scale config ── */

const FORMAT_OPTIONS: { value: ExportFormat; label: string; disabled: boolean }[] = [
  { value: 'png', label: 'PNG', disabled: false },
  { value: 'jpg', label: 'JPG', disabled: false },
  { value: 'svg', label: 'SVG', disabled: false },
  { value: 'gif', label: 'GIF', disabled: false },
  { value: 'mp4', label: 'MP4', disabled: true },
]

const FORMAT_HINTS: Record<string, string> = {
  png: 'Melhor qualidade, suporta transparência.',
  jpg: 'Menor tamanho, sem transparência.',
  svg: 'Vetorial, escalável infinitamente.',
  gif: 'Animado se houver GIF na arte. Senão, exporta como imagem estática.',
}

const SCALE_OPTIONS = [
  { s: 1, label: '1×', desc: 'Rascunho' },
  { s: 2, label: '2×', desc: 'Padrão' },
  { s: 3, label: '3×', desc: 'Alta' },
  { s: 4, label: '4×', desc: 'Impressão' },
] as const

/* ── styles ── */

const btnActive: React.CSSProperties = {
  border: '1px solid var(--accent)',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
}
const btnInactive: React.CSSProperties = {
  border: '1px solid var(--line-strong)',
  background: 'var(--surface-2)',
  color: 'var(--ink-dim)',
}
const btnDisabled: React.CSSProperties = {
  ...btnInactive,
  opacity: 0.5,
  cursor: 'not-allowed',
}

/* ── component ── */

export function ExportModal({ composition, canvasRef, linkCode, onExport, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('png')
  const [scale, setScale] = useState(2)
  const [saveToLibrary, setSaveToLibrary] = useState(true)
  const [state, setState] = useState<ExportState>('idle')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [step, setStep] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [gifProgress, setGifProgress] = useState<string | null>(null)

  const w = composition.canvas.width
  const h = composition.canvas.height
  const isRaster = format === 'png' || format === 'jpg'
  const isGif = format === 'gif'
  const hasAnimatedGif = compositionHasAnimatedGif(composition)
  const outW = isRaster ? w * scale : w
  const outH = isRaster ? h * scale : h

  /* ── preview generation ── */
  useEffect(() => {
    const timer = setTimeout(() => {
      const stage = canvasRef.current?.getStage()
      if (!stage) return
      try {
        const url = withExportStage(stage, w, h, (s) =>
          s.toDataURL({ pixelRatio: Math.max(0.5, 160 / w) }),
        )
        setPreviewUrl(url)
      } catch { /* tainted canvas */ }
    }, 100)
    return () => clearTimeout(timer)
  }, [canvasRef, w, h])

  /* ── keyboard ── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  /* ── export handler ── */
  const handleExport = useCallback(async () => {
    setState('exporting')
    setErrorMsg(null)
    setGifProgress(null)
    setStep(1)

    try {
      let blob: Blob
      const exportFormat: 'png' | 'svg' = format === 'gif' ? 'png' : format === 'jpg' ? 'png' : (format as 'png' | 'svg')

      if (format === 'gif') {
        const stage = canvasRef.current?.getStage()
        if (!stage) { setState('idle'); return }

        await document.fonts.ready
        setStep(2)

        const animated = compositionHasAnimatedGif(composition)
        const frameCount = animated ? 30 : 1
        const delayMs = animated ? 100 : 0

        const frames = await captureGifFrames(stage, w, h, frameCount, delayMs, (current, total) => {
          setGifProgress(`Capturando frame ${current} de ${total}...`)
        })

        setGifProgress('Codificando GIF...')
        blob = await encodeGif({
          width: w,
          height: h,
          frames: frames.map(f => ({ data: f.data, delay: f.delay })),
          maxColors: 128,
          format: 'blob',
        })
      } else if (format === 'png' || format === 'jpg') {
        await document.fonts.ready
        setStep(2)
        const stage = canvasRef.current?.getStage()
        if (!stage) { setState('idle'); return }

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png'
        blob = await withExportStage(stage, w, h, (s) =>
          new Promise<Blob>((resolve, reject) => {
            s.toBlob({
              pixelRatio: scale,
              mimeType,
              quality: format === 'jpg' ? 0.92 : undefined,
              callback: (b: Blob | null) => b ? resolve(b) : reject(new Error('toBlob failed')),
            })
          }),
        )
      } else {
        setStep(2)
        const svg = compositionToSvg(composition)
        blob = new Blob([svg], { type: 'image/svg+xml' })
      }

      setFileSize(blob.size)
      setGifProgress(null)
      setStep(3)

      let resultUrl: string | null = null
      if (saveToLibrary) {
        const result = await onExport(blob, { format: exportFormat, scale: format === 'gif' ? 1 : scale, width: format === 'gif' ? w : outW, height: format === 'gif' ? h : outH })
        resultUrl = result?.url ?? null
      }

      setStep(4)
      const ext = format === 'jpg' ? 'jpg' : format
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `qr-card-${linkCode}.${ext}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000)

      setBlobUrl(resultUrl)
      setState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed')
      setGifProgress(null)
      setState('error')
    }
  }, [format, scale, saveToLibrary, composition, canvasRef, linkCode, onExport, outW, outH, w, h])

  /* ── progress steps ── */
  const gifFrameCount = hasAnimatedGif ? 30 : 1
  const steps = isGif
    ? [
        { label: gifProgress ?? `Capturando ${gifFrameCount} frames...`, done: step >= 2 && !gifProgress?.startsWith('Capturando') },
        { label: gifProgress === 'Codificando GIF...' ? gifProgress : `Codificando GIF (${w}×${h})`, done: step >= 3 },
        ...(saveToLibrary ? [{ label: 'Enviando para Vercel Blob...', done: step >= 4 }] : []),
        { label: 'Salvando nos downloads', done: step >= 4 },
      ]
    : [
        { label: `Renderizando canvas em ${scale}×...`, done: step >= 2 },
        { label: `Codificando ${format.toUpperCase()} (${outW}×${outH})`, done: step >= 3 },
        ...(saveToLibrary ? [{ label: 'Enviando para Vercel Blob...', done: step >= 4 }] : []),
        { label: 'Salvando nos downloads', done: step >= 4 },
      ]

  const gifEstimated = hasAnimatedGif
    ? estimateFileSize(w, h, 1, 'gif') * gifFrameCount * 0.6  // animated: multiple frames with inter-frame compression
    : estimateFileSize(w, h, 1, 'gif')
  const estimated = isGif ? gifEstimated : estimateFileSize(w, h, scale, format)
  const downloadLabel = isGif
    ? `Baixar GIF · ~${formatBytes(estimated)}`
    : isRaster
      ? `Baixar ${format.toUpperCase()} · ${scale}× · ~${formatBytes(estimated)}`
      : `Baixar ${format.toUpperCase()}`

  /* ── preview sizing ── */
  const previewMaxW = 84
  const previewScale = previewMaxW / w
  const previewH = Math.round(h * previewScale)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      {/* backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />

      {/* dialog */}
      <div
        ref={dialogRef}
        style={{
          position: 'relative',
          width: 620,
          maxWidth: '95vw',
          maxHeight: '80vh',
          overflow: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--line-strong)',
          borderRadius: 16,
          boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Exportar QR Card"
      >
        {/* ── header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid var(--line)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontFamily: 'Fraunces, serif',
              fontSize: 19,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Exportar
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: 'var(--ink-dim)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={19} />
          </button>
        </div>

        {/* ── body ── */}
        <div style={{ display: 'flex', gap: 22, padding: 22 }}>
          {/* ── left: preview ── */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              style={{
                width: previewMaxW + 28, // 14px padding each side
                borderRadius: 10,
                border: '1px solid var(--line)',
                padding: 14,
                background: 'repeating-conic-gradient(rgb(26,24,19) 0% 25%, rgb(22,20,15) 0% 50%) 50% center / 16px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Card preview"
                  style={{
                    width: previewMaxW,
                    height: previewH,
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: previewMaxW,
                    height: previewH,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: 'var(--ink-dim)',
                  }}
                >
                  Preview
                </div>
              )}
            </div>
            <span
              style={{
                marginTop: 8,
                fontFamily: 'monospace',
                fontSize: 10.5,
                color: 'var(--ink-faint)',
              }}
            >
              {isGif ? w : outW}×{isGif ? h : outH}px
            </span>
          </div>

          {/* ── right: controls ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {state === 'idle' && (
              <>
                {/* ── Formato ── */}
                <div>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'var(--ink-dim)',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                      marginBottom: 8,
                    }}
                  >
                    Formato
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {FORMAT_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        disabled={f.disabled}
                        title={f.disabled ? 'MP4 em breve' : undefined}
                        onClick={() => !f.disabled && setFormat(f.value)}
                        style={{
                          padding: '9px 0',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: f.disabled ? 'not-allowed' : 'pointer',
                          background: 'none',
                          ...(f.disabled
                            ? btnDisabled
                            : format === f.value
                              ? btnActive
                              : btnInactive),
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {FORMAT_HINTS[format] && (
                    <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 6, marginBottom: 0 }}>
                      {FORMAT_HINTS[format]}
                    </p>
                  )}
                  {format !== 'gif' && (
                    <p style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4, marginBottom: 0 }}>
                      MP4 fica disponível em breve.
                    </p>
                  )}
                </div>

                {/* ── Qualidade · escala ── */}
                {isRaster && (
                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        color: 'var(--ink-dim)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                        marginBottom: 8,
                      }}
                    >
                      Qualidade · escala
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {SCALE_OPTIONS.map(({ s, label, desc }) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setScale(s)}
                          style={{
                            padding: '8px 2px',
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            cursor: 'pointer',
                            background: 'none',
                            ...(scale === s ? btnActive : btnInactive),
                          }}
                        >
                          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                            {label}
                          </span>
                          <span style={{ fontSize: 9.5, color: 'var(--ink-dim)' }}>
                            {desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Salvar cópia ── */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: 12.5,
                    color: 'var(--ink-dim)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    role="checkbox"
                    aria-checked={saveToLibrary}
                    tabIndex={0}
                    onClick={() => setSaveToLibrary(!saveToLibrary)}
                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setSaveToLibrary(!saveToLibrary) } }}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: saveToLibrary ? 'none' : '1px solid var(--line-strong)',
                      background: saveToLibrary ? 'var(--accent)' : 'var(--surface-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 150ms, border 150ms',
                    }}
                  >
                    {saveToLibrary && <Check size={12} style={{ color: 'rgb(26,18,12)' }} />}
                  </span>
                  Salvar cópia na biblioteca
                </label>

                {/* ── Download button ── */}
                <button
                  type="button"
                  onClick={handleExport}
                  style={{
                    marginTop: 'auto',
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: 10,
                    background: 'var(--accent)',
                    color: 'rgb(26,18,12)',
                    fontSize: 13.5,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Download size={16} />
                  {downloadLabel}
                </button>
              </>
            )}

            {/* ── exporting progress ── */}
            {state === 'exporting' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    {s.done
                      ? <Check size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
                      : i === step - 1
                        ? <Loader2 size={14} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                        : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1px solid var(--ink-faint)', flexShrink: 0 }} />
                    }
                    <span style={{ color: s.done ? 'var(--ink)' : 'var(--ink-dim)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── success ── */}
            {state === 'done' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--green) 20%, transparent)',
                  }}
                >
                  <Check size={20} style={{ color: 'var(--green)' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  Card exportado com sucesso
                </p>
                <p style={{ fontSize: 11, color: 'var(--ink-dim)', margin: 0 }}>
                  {`qr-card-${linkCode}.${format === 'jpg' ? 'jpg' : format}`} · {formatBytes(fileSize)}
                </p>
                {blobUrl && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      borderRadius: 8,
                      padding: '8px 10px',
                      background: 'var(--surface-2)',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        fontSize: 10,
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--ink-dim)',
                      }}
                    >
                      {blobUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(blobUrl)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        color: 'var(--ink-dim)',
                        display: 'flex',
                      }}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: '1px solid var(--line)',
                      background: 'none',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    Voltar ao Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => { setState('idle'); setBlobUrl(null) }}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      fontSize: 11.5,
                      fontWeight: 600,
                      border: '1px solid var(--line)',
                      background: 'none',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                  >
                    Exportar Outro
                  </button>
                </div>
              </div>
            )}

            {/* ── error ── */}
            {state === 'error' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'color-mix(in srgb, var(--red) 20%, transparent)',
                  }}
                >
                  <X size={20} style={{ color: 'var(--red)' }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                  Falha na exportação
                </p>
                <p style={{ fontSize: 11, color: 'var(--red)', margin: 0 }}>{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => setState('idle')}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    borderRadius: 8,
                    fontSize: 11.5,
                    fontWeight: 600,
                    border: '1px solid var(--line)',
                    background: 'none',
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  Tentar Novamente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
