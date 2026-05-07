'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { CropPreset } from './types'
import { getMediaGalleryStrings } from './_i18n/types'

interface MediaCropEditorProps {
  imageUrl: string
  preset: CropPreset
  locale: 'en' | 'pt-BR'
  onConfirm: (croppedBlob: Blob, dimensions: { width: number; height: number }) => void
  onCancel: () => void
}

function clampDimensions(
  w: number, h: number, maxW: number, maxH: number | undefined,
): { width: number; height: number } {
  let width = w
  let height = h
  if (width > maxW) {
    height = Math.round(height * (maxW / width))
    width = maxW
  }
  if (maxH && height > maxH) {
    width = Math.round(width * (maxH / height))
    height = maxH
  }
  return { width, height }
}

export function MediaCropEditor({ imageUrl, preset, locale, onConfirm, onCancel }: MediaCropEditorProps) {
  const t = getMediaGalleryStrings(locale)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget
      const cropPercent: Crop = preset.aspect
        ? (() => {
            const imgAspect = w / h
            if (imgAspect > preset.aspect) {
              const cropH = 100
              const cropW = (preset.aspect / imgAspect) * 100
              return { unit: '%' as const, x: (100 - cropW) / 2, y: 0, width: cropW, height: cropH }
            }
            const cropW = 100
            const cropH = (imgAspect / preset.aspect) * 100
            return { unit: '%' as const, x: 0, y: (100 - cropH) / 2, width: cropW, height: cropH }
          })()
        : { unit: '%' as const, x: 10, y: 10, width: 80, height: 80 }
      setCrop(cropPercent)
      const pixelCrop: PixelCrop = {
        unit: 'px',
        x: (cropPercent.x / 100) * w,
        y: (cropPercent.y / 100) * h,
        width: (cropPercent.width / 100) * w,
        height: (cropPercent.height / 100) * h,
      }
      setCompletedCrop(pixelCrop)
    },
    [preset.aspect],
  )

  const handleConfirm = useCallback(() => {
    const image = imgRef.current
    if (!image || !completedCrop) return
    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    const rawW = Math.round(completedCrop.width * scaleX)
    const rawH = Math.round(completedCrop.height * scaleY)
    const { width: outW, height: outH } = clampDimensions(rawW, rawH, preset.maxWidth, preset.maxHeight)
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (preset.circular) {
      ctx.beginPath()
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
      ctx.clip()
    }
    ctx.drawImage(image, completedCrop.x * scaleX, completedCrop.y * scaleY, rawW, rawH, 0, 0, outW, outH)
    canvas.toBlob(
      (blob) => { if (blob) onConfirm(blob, { width: outW, height: outH }) },
      'image/webp',
      0.85,
    )
  }, [completedCrop, preset, onConfirm])

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold text-[#f3f4f6]">{t.crop.cropTitle}</h4>
      <div className="flex justify-center overflow-hidden rounded-lg border border-[#374151] bg-black/20">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={preset.aspect}
          circularCrop={preset.circular}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" onLoad={onImageLoad} className="max-h-[400px] max-w-full" data-testid="crop-image" />
        </ReactCrop>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5" data-testid="crop-cancel">
          {t.crop.cropCancel}
        </button>
        <button type="button" onClick={handleConfirm} disabled={!completedCrop} className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed" data-testid="crop-confirm">
          {t.crop.cropConfirm}
        </button>
      </div>
    </div>
  )
}
