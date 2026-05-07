'use client'

import { useState, useCallback } from 'react'
import type { CropPreset, MediaGalleryModalProps } from './types'

interface UseMediaGalleryOptions {
  folder?: string
  cropPreset?: CropPreset
}

export function useMediaGallery() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<UseMediaGalleryOptions>({})

  const openGallery = useCallback((opts?: UseMediaGalleryOptions) => {
    setOptions(opts ?? {})
    setOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setOpen(false)
    setOptions({})
  }, [])

  return {
    open,
    openGallery,
    closeGallery,
    galleryProps: {
      open,
      onClose: closeGallery,
      folder: options.folder,
      cropPreset: options.cropPreset,
    } satisfies Partial<MediaGalleryModalProps>,
  }
}
