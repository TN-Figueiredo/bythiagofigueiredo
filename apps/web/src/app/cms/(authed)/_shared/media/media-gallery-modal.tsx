'use client'

import { useRef, useState } from 'react'
import { useModalFocusTrap } from '../editor/use-modal-focus-trap'
import { MediaUploadTab } from './media-upload-tab'
import { MediaLibraryTab } from './media-library-tab'
import type { MediaGalleryModalProps, MediaAssetResult } from './types'
import { getMediaGalleryStrings } from './_i18n/types'

type Tab = 'upload' | 'library'

export function MediaGalleryModal({
  open,
  onClose,
  onSelect,
  folder,
  cropPreset,
  locale,
  siteId,
}: MediaGalleryModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const t = getMediaGalleryStrings(locale)

  useModalFocusTrap(dialogRef, open, onClose)

  if (!open) return null

  const handleSelect = (asset: MediaAssetResult) => {
    onSelect(asset)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="gallery-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.modal.title}
        className="mx-4 flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[#374151] bg-[#111827] shadow-2xl sm:h-[600px]"
        data-testid="gallery-dialog"
      >
        <div className="flex items-center justify-between border-b border-[#374151] px-6 py-4">
          <h3 className="text-lg font-semibold text-[#f3f4f6]">{t.modal.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9ca3af] hover:bg-white/5 hover:text-[#f3f4f6]"
            aria-label={t.modal.close}
            data-testid="gallery-close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="flex border-b border-[#374151]">
          {(['upload', 'library'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-500 text-indigo-400'
                  : 'text-[#9ca3af] hover:text-[#f3f4f6]'
              }`}
            >
              {t.tabs[tab]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'upload' ? (
            <MediaUploadTab
              onSelect={handleSelect}
              folder={folder}
              cropPreset={cropPreset}
              locale={locale}
              siteId={siteId}
            />
          ) : (
            <MediaLibraryTab
              onSelect={handleSelect}
              folder={folder}
              cropPreset={cropPreset}
              locale={locale}
              siteId={siteId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
