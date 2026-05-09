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
        className="relative bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Export QR Card"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-[14px] font-semibold text-neutral-200">Export QR Card</h2>
          <button type="button" onClick={onClose} className="p-1 text-neutral-500 hover:text-white" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 flex gap-6">
          <div className="shrink-0">
            <div className="w-[160px] bg-neutral-800 rounded border border-neutral-700 overflow-hidden flex items-center justify-center" style={{ aspectRatio: `${w}/${h}` }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Card preview" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[11px] text-neutral-500">Preview</span>
              )}
            </div>
            <div className="text-[10px] text-neutral-500 text-center mt-1">{w}×{h}</div>
          </div>

          <div className="flex-1 space-y-4">
            {state === 'idle' && (
              <>
                <div>
                  <div className="text-[10px] text-neutral-400 mb-1">Format</div>
                  <div className="flex gap-2">
                    {(['png', 'svg'] as const).map(f => (
                      <button key={f} type="button" onClick={() => setFormat(f)} className={`flex-1 py-1.5 rounded text-[11px] border ${format === f ? 'border-blue-500 bg-blue-600/10 text-blue-300' : 'border-neutral-700 text-neutral-400'}`}>
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {format === 'png' && (
                  <div>
                    <div className="text-[10px] text-neutral-400 mb-1">Quality / Scale</div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {([
                        { s: 1, label: '1×', desc: 'Draft' },
                        { s: 2, label: '2×', desc: 'Standard' },
                        { s: 3, label: '3×', desc: 'High' },
                        { s: 4, label: '4×', desc: 'Print' },
                      ] as const).map(({ s, label, desc }) => (
                        <button key={s} type="button" onClick={() => setScale(s)} className={`py-1.5 rounded text-[11px] border ${scale === s ? 'border-blue-500 bg-blue-600/10 text-blue-300' : 'border-neutral-700 text-neutral-400'}`}>
                          {label} <span className="text-[9px] text-neutral-500 block">{desc}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-neutral-500 mt-1">Output: {outW}×{outH}px — the preview is low-res, export is sharp</p>
                  </div>
                )}

                <label className="flex items-center gap-2 text-[11px] text-neutral-300">
                  <input type="checkbox" checked={saveToBlob} onChange={e => setSaveToBlob(e.target.checked)} className="rounded" />
                  Save copy to Vercel Blob
                </label>

                <button type="button" onClick={handleExport} className="w-full py-2 rounded bg-blue-600 text-[12px] font-medium text-white hover:bg-blue-500">
                  <Download size={14} className="inline mr-1.5" />
                  Download {format.toUpperCase()} · {scale}× · {estimatedSize}
                </button>
              </>
            )}

            {state === 'exporting' && (
              <div className="space-y-2">
                {steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    {s.done ? <Check size={14} className="text-green-400" /> : i === step - 1 ? <Loader2 size={14} className="text-blue-400 animate-spin" /> : <div className="w-3.5 h-3.5 rounded-full border border-neutral-600" />}
                    <span className={s.done ? 'text-neutral-300' : 'text-neutral-500'}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {state === 'done' && (
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 mx-auto bg-green-600/20 rounded-full flex items-center justify-center">
                  <Check size={20} className="text-green-400" />
                </div>
                <p className="text-[13px] text-neutral-200 font-medium">Card exported successfully</p>
                <p className="text-[11px] text-neutral-500">{`qr-card-${linkCode}.${format}`} · {(fileSize / 1024).toFixed(0)} KB</p>
                {blobUrl && (
                  <div className="flex items-center gap-2 bg-neutral-800 rounded px-2 py-1.5">
                    <span className="flex-1 text-[10px] font-mono text-neutral-400 truncate">{blobUrl}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(blobUrl)} className="text-neutral-500 hover:text-white">
                      <Copy size={12} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="flex-1 py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300">
                    Back to Editor
                  </button>
                  <button type="button" onClick={() => { setState('idle'); setBlobUrl(null) }} className="flex-1 py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300">
                    Export Another
                  </button>
                </div>
              </div>
            )}

            {state === 'error' && (
              <div className="space-y-3 text-center">
                <div className="w-10 h-10 mx-auto bg-red-600/20 rounded-full flex items-center justify-center">
                  <X size={20} className="text-red-400" />
                </div>
                <p className="text-[13px] text-neutral-200 font-medium">Export failed</p>
                <p className="text-[11px] text-red-400">{errorMsg}</p>
                <button type="button" onClick={() => setState('idle')} className="w-full py-1.5 rounded border border-neutral-700 text-[11px] text-neutral-300">
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
