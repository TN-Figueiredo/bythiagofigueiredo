'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Check, Loader2, Download, Copy } from 'lucide-react'
import type { CardComposition } from '@tn-figueiredo/links/qr'
import { compositionToSvg } from '@tn-figueiredo/links/qr'
import type { CanvasEditorHandle } from './canvas-editor'

interface ExportModalProps {
  composition: CardComposition
  canvasRef: React.RefObject<CanvasEditorHandle | null>
  linkCode: string
  onExport: (blob: Blob, metadata: { format: 'png' | 'svg'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onClose: () => void
}

type ExportState = 'idle' | 'exporting' | 'done' | 'error'

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

export function ExportModal({ composition, canvasRef, linkCode, onExport, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'png' | 'svg'>('png')
  const [scale, setScale] = useState(2)
  const [saveToBlob, setSaveToBlob] = useState(true)
  const [state, setState] = useState<ExportState>('idle')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number>(0)
  const [step, setStep] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const stage = canvasRef.current?.getStage()
      if (!stage) return
      try {
        const url = withExportStage(stage, composition.canvas.width, composition.canvas.height, (s) =>
          s.toDataURL({ pixelRatio: Math.max(0.5, 160 / composition.canvas.width) }),
        )
        setPreviewUrl(url)
      } catch { /* tainted canvas */ }
    }, 100)
    return () => clearTimeout(timer)
  }, [canvasRef, composition.canvas.width, composition.canvas.height])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const w = composition.canvas.width
  const h = composition.canvas.height
  const outW = format === 'png' ? w * scale : w
  const outH = format === 'png' ? h * scale : h

  const handleExport = useCallback(async () => {
    setState('exporting')
    setErrorMsg(null)
    setStep(1)

    try {
      let blob: Blob

      if (format === 'png') {
        await document.fonts.ready
        setStep(2)
        const stage = canvasRef.current?.getStage()
        if (!stage) { setState('idle'); return }
        blob = await withExportStage(stage, w, h, (s) =>
          new Promise<Blob>((resolve, reject) => {
            s.toBlob({
              pixelRatio: scale,
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
      setStep(3)

      let resultUrl: string | null = null
      if (saveToBlob) {
        const result = await onExport(blob, { format, scale, width: outW, height: outH })
        resultUrl = result?.url ?? null
      }

      setStep(4)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `qr-card-${linkCode}.${format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000)

      setBlobUrl(resultUrl)
      setState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed')
      setState('error')
    }
  }, [format, scale, saveToBlob, composition, canvasRef, linkCode, onExport, outW, outH])

  const steps = [
    { label: `Rendering canvas at ${scale}x resolution`, done: step >= 2 },
    { label: `Encoding ${format.toUpperCase()} (${outW}×${outH})`, done: step >= 3 },
    ...(saveToBlob ? [{ label: 'Uploading to Vercel Blob...', done: step >= 4 }] : []),
    { label: 'Saving to browser downloads', done: step >= 4 },
  ]

  const estimatedSize = format === 'png' ? `~${Math.round(outW * outH * 4 / 1024 / 5)} KB` : 'varies'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        className="relative rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-auto"
        style={{ background: 'var(--bg-side)', border: '1px solid var(--line)' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Export QR Card"
      >
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--line-strong)' }}>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Export QR Card</h2>
          <button type="button" onClick={onClose} className="p-1 hover:opacity-80" style={{ color: 'var(--ink-dim)' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex gap-6">
          <div className="shrink-0">
            <div className="w-[160px] rounded overflow-hidden flex items-center justify-center" style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', aspectRatio: `${w}/${h}` }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>Preview</span>
              )}
            </div>
            <div className="text-[10px] text-center mt-1" style={{ color: 'var(--ink-dim)' }}>{w}×{h}</div>
          </div>

          <div className="flex-1 space-y-4">
            {state === 'idle' && (
              <>
                <div>
                  <div className="text-[10px] mb-1" style={{ color: 'var(--ink-dim)' }}>Format</div>
                  <div className="flex gap-2">
                    {(['png', 'svg'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormat(f)}
                        className="flex-1 py-1.5 rounded text-[11px]"
                        style={format === f
                          ? { border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)' }
                          : { border: '1px solid var(--line)', color: 'var(--ink-dim)' }
                        }
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {format === 'png' && (
                  <div>
                    <div className="text-[10px] mb-1" style={{ color: 'var(--ink-dim)' }}>Quality / Scale</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { s: 1, label: '1×', desc: 'Draft' },
                        { s: 2, label: '2×', desc: 'Standard' },
                        { s: 3, label: '3×', desc: 'High' },
                        { s: 4, label: '4×', desc: 'Print' },
                      ] as const).map(({ s, label, desc }) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setScale(s)}
                          className="py-1.5 rounded text-[11px]"
                          style={scale === s
                            ? { border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)' }
                            : { border: '1px solid var(--line)', color: 'var(--ink-dim)' }
                          }
                        >
                          {label} <span className="text-[9px] block" style={{ color: 'var(--ink-dim)' }}>{desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] mt-1" style={{ color: 'var(--ink-dim)' }}>Output: {outW}×{outH}px — the preview is low-res, export is sharp</p>
                  </div>
                )}

                <label className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--ink)' }}>
                  <input type="checkbox" checked={saveToBlob} onChange={e => setSaveToBlob(e.target.checked)} className="rounded" />
                  Save copy to Vercel Blob
                </label>

                <button
                  type="button"
                  onClick={handleExport}
                  className="w-full py-2 rounded text-[12px] font-medium hover:opacity-90"
                  style={{ background: 'var(--accent)', color: 'var(--ink)' }}
                >
                  <Download size={14} className="inline mr-1.5" />
                  Download {format.toUpperCase()} · {scale}× · {estimatedSize}
                </button>
              </>
            )}

            {state === 'exporting' && (
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {s.done
                      ? <Check size={14} style={{ color: 'var(--green)' }} />
                      : i === step - 1
                        ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                        : <div className="w-3.5 h-3.5 rounded-full" style={{ border: '1px solid var(--ink-faint)' }} />
                    }
                    <span style={{ color: s.done ? 'var(--ink)' : 'var(--ink-dim)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {state === 'done' && (
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--green) 20%, transparent)' }}>
                  <Check size={20} style={{ color: 'var(--green)' }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Card exported successfully</p>
                <p className="text-[11px]" style={{ color: 'var(--ink-dim)' }}>{`qr-card-${linkCode}.${format}`} · {(fileSize / 1024).toFixed(0)} KB</p>
                {blobUrl && (
                  <div className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'var(--surface-2)' }}>
                    <span className="flex-1 text-[10px] font-mono truncate" style={{ color: 'var(--ink-dim)' }}>{blobUrl}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(blobUrl)} className="hover:opacity-80" style={{ color: 'var(--ink-dim)' }}>
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded text-[11px]" style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    Back to Editor
                  </button>
                  <button type="button" onClick={() => { setState('idle'); setBlobUrl(null) }} className="flex-1 py-1.5 rounded text-[11px]" style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}>
                    Export Another
                  </button>
                </div>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 mx-auto rounded-full flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--red) 20%, transparent)' }}>
                  <X size={20} style={{ color: 'var(--red)' }} />
                </div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Export failed</p>
                <p className="text-[11px]" style={{ color: 'var(--red)' }}>{errorMsg}</p>
                <button type="button" onClick={() => setState('idle')} className="w-full py-1.5 rounded text-[11px]" style={{ border: '1px solid var(--line)', color: 'var(--ink)' }}>
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
