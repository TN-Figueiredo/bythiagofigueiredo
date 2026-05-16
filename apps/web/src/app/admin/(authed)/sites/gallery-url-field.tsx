'use client'

import { useState } from 'react'
import { useMediaGallery } from '../../../cms/(authed)/_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../../cms/(authed)/_shared/media/media-gallery-modal'
import type { CropPreset } from '../../../cms/(authed)/_shared/media/types'
import { trackMediaUsageAction } from '../../../cms/(authed)/media/actions'

interface GalleryUrlFieldProps {
  id: string
  name: string
  label: string
  defaultValue: string
  placeholder?: string
  folder: string
  cropPreset: CropPreset
  siteId: string
  locale: 'en' | 'pt-BR'
  trackResourceType?: string
  trackResourceId?: string
  trackFieldName?: string
}

export function GalleryUrlField({
  id,
  name,
  label,
  defaultValue,
  placeholder = 'https://...',
  folder,
  cropPreset,
  siteId,
  locale,
  trackResourceType,
  trackResourceId,
  trackFieldName,
}: GalleryUrlFieldProps) {
  const [value, setValue] = useState(defaultValue)
  const gallery = useMediaGallery()

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => gallery.openGallery({ folder, cropPreset })}
          className="shrink-0 rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          {locale === 'pt-BR' ? 'Galeria' : 'Gallery'}
        </button>
      </div>
      <MediaGalleryModal
        {...gallery.galleryProps}
        onSelect={(asset) => {
          setValue(asset.url)
          if (trackResourceType && trackResourceId && trackFieldName) {
            trackMediaUsageAction(asset.id, trackResourceType, trackResourceId, trackFieldName).catch(() => {})
          }
          gallery.closeGallery()
        }}
        locale={locale}
        siteId={siteId}
      />
    </div>
  )
}
