'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from 'react'

interface Props {
  file: File
  onConfirm: (croppedBlob: Blob) => void
  onCancel: () => void
}

const OUTPUT_SIZE = 400
const MIN_SCALE = 0.5
const MAX_SCALE = 3

export function AvatarCropModal({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const minDim = Math.min(img.width, img.height)
      setScale(OUTPUT_SIZE / minDim)
      setOffset({
        x: (OUTPUT_SIZE - img.width * (OUTPUT_SIZE / minDim)) / 2,
        y: (OUTPUT_SIZE - img.height * (OUTPUT_SIZE / minDim)) / 2,
      })
      setLoaded(true)
    }
    img.src = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(img.src)
  }, [file])

  useEffect(() => {
    if (!loaded || !imgRef.current || !canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return
    const img = imgRef.current

    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale)
    ctx.restore()

    ctx.save()
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale)
    ctx.restore()

    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2 - 1, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [loaded, scale, offset])

  const handlePointerDown = useCallback(
    (ev: ReactPointerEvent<HTMLCanvasElement>) => {
      ev.preventDefault()
      ;(ev.target as HTMLElement).setPointerCapture(ev.pointerId)
      dragStart.current = { x: ev.clientX, y: ev.clientY, ox: offset.x, oy: offset.y }
    },
    [offset],
  )

  const handlePointerMove = useCallback(
    (ev: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!dragStart.current) return
      const dx = ev.clientX - dragStart.current.x
      const dy = ev.clientY - dragStart.current.y
      setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy })
    },
    [],
  )

  const handlePointerUp = useCallback(() => {
    dragStart.current = null
  }, [])

  const handleWheel = useCallback(
    (ev: React.WheelEvent<HTMLCanvasElement>) => {
      ev.preventDefault()
      const delta = ev.deltaY > 0 ? -0.05 : 0.05
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta)))
    },
    [],
  )

  const handleConfirm = useCallback(() => {
    if (!imgRef.current) return
    const out = document.createElement('canvas')
    out.width = OUTPUT_SIZE
    out.height = OUTPUT_SIZE
    const ctx = out.getContext('2d')
    if (!ctx) return
    const img = imgRef.current

    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale)

    out.toBlob(
      (blob) => {
        if (blob) onConfirm(blob)
      },
      'image/webp',
      0.85,
    )
  }, [offset, scale, onConfirm])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-slate-700 bg-[#0f172a] p-6 shadow-2xl"
        role="dialog"
        aria-label="Crop avatar"
        data-testid="avatar-crop-modal"
      >
        <h3 className="mb-4 text-base font-semibold text-slate-100">
          Crop avatar
        </h3>

        <div className="mb-4 flex justify-center">
          <canvas
            ref={canvasRef}
            width={OUTPUT_SIZE}
            height={OUTPUT_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            className="h-[280px] w-[280px] cursor-grab touch-none rounded-full active:cursor-grabbing"
            style={{ imageRendering: 'auto' }}
            data-testid="crop-canvas"
          />
        </div>

        <div className="mb-5 flex items-center gap-3 px-2">
          <span className="text-xs text-slate-500">−</span>
          <input
            type="range"
            min={MIN_SCALE * 100}
            max={MAX_SCALE * 100}
            value={Math.round(scale * 100)}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="flex-1 accent-indigo-500"
            aria-label="Zoom"
            data-testid="crop-zoom"
          />
          <span className="text-xs text-slate-500">+</span>
        </div>

        <p className="mb-4 text-center text-xs text-slate-500">
          Drag to reposition &middot; scroll or slider to zoom
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            data-testid="crop-cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!loaded}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            data-testid="crop-confirm"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
