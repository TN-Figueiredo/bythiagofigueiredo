'use client'

import { useState, useEffect, useRef } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import type { SocialStrings } from '../../_i18n/types'

interface ImageComposerProps {
  images: string[]
  onImagesChange: (urls: string[]) => void
  caption: string
  onCaptionChange: (v: string) => void
  selectedPlatforms: Provider[]
  strings: SocialStrings
}

export function ImageComposer({ images, onImagesChange, caption, onCaptionChange, selectedPlatforms, strings: t }: ImageComposerProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const blobUrlsRef = useRef<Set<string>>(new Set())

  // Revoke blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
      blobUrlsRef.current.clear()
    }
  }, [])

  function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return
    const next = [...images]
    const removed = next.splice(dragIdx, 1)
    const moved = removed[0]
    if (moved === undefined) return
    next.splice(targetIdx, 0, moved)
    onImagesChange(next)
    setDragIdx(null)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {images.map((url, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className="relative aspect-square rounded-md border border-cms-border bg-cms-bg overflow-hidden cursor-grab"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
            <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white font-medium">{i + 1}</span>
            <button
              type="button"
              onClick={() => {
                if (url.startsWith('blob:')) {
                  URL.revokeObjectURL(url)
                  blobUrlsRef.current.delete(url)
                }
                onImagesChange(images.filter((_, j) => j !== i))
              }}
              className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-red-600"
            >
              x
            </button>
          </div>
        ))}
        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border border-dashed border-cms-border bg-cms-bg text-cms-text-muted text-sm hover:border-cms-accent">
          {t.composer.image.addImages}
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => {
            const files = e.target.files
            if (files) {
              const urls = Array.from(files).map(f => {
                const url = URL.createObjectURL(f)
                blobUrlsRef.current.add(url)
                return url
              })
              onImagesChange([...images, ...urls])
            }
          }} />
        </label>
      </div>

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {selectedPlatforms.includes('instagram') && images.length > 1 && (
            <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-pink-400">{t.composer.image.igCarousel}</span>
          )}
          {selectedPlatforms.includes('facebook') && images.length > 1 && (
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-400">{t.composer.image.fbMulti}</span>
          )}
          {selectedPlatforms.includes('bluesky') && images.length > 4 && (
            <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-400">BS: max 4 images</span>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-cms-text">{t.composer.image.captionLabel}</label>
        <textarea
          value={caption}
          onChange={e => onCaptionChange(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text"
        />
      </div>
    </div>
  )
}
