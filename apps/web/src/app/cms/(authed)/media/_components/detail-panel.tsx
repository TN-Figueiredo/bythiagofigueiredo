'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { DetailTabs } from './detail-tabs'

import type { UsageEntry } from '../../_shared/media/types'

interface DetailPanelProps {
  asset: MediaAsset | null
  tab: 'details' | 'usage' | 'history'
  usages: UsageEntry[]
  onTabChange: (tab: 'details' | 'usage' | 'history') => void
  onClose: () => void
  onUpdateAsset: (assetId: string, updates: { altText?: string; tags?: string[]; folder?: string }) => void
  onCopyUrl: (url: string) => void
  onReplace: (id: string) => void
  onDelete: (id: string) => void
  onOpenLightbox: (id: string) => void
  t: MediaGalleryStrings
}

export const DetailPanel = React.memo(function DetailPanel({
  asset,
  tab,
  usages,
  onTabChange,
  onClose,
  onUpdateAsset,
  onCopyUrl,
  onReplace,
  onDelete,
  onOpenLightbox,
  t,
}: DetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (asset) {
      requestAnimationFrame(() => setIsOpen(true))
    } else {
      setIsOpen(false)
    }
  }, [asset])

  useEffect(() => {
    if (isOpen) requestAnimationFrame(() => closeBtnRef.current?.focus())
  }, [isOpen])

  const handleUpdateAltText = useCallback(
    (altText: string) => { if (asset) onUpdateAsset(asset.id, { altText }) },
    [asset, onUpdateAsset],
  )
  const handleUpdateTags = useCallback(
    (tags: string[]) => { if (asset) onUpdateAsset(asset.id, { tags }) },
    [asset, onUpdateAsset],
  )
  const handleUpdateFolder = useCallback(
    (folder: string) => { if (asset) onUpdateAsset(asset.id, { folder }) },
    [asset, onUpdateAsset],
  )

  if (!asset) return null

  const isSvg = asset.mimeType === 'image/svg+xml'
  const tabs = ['details', 'usage', 'history'] as const
  const tabLabels: Record<typeof tabs[number], string> = {
    details: t.detail.tabDetails,
    usage: t.detail.tabUsage,
    history: t.detail.tabHistory,
  }

  return (
    <div
      role="complementary"
      aria-label={t.aria.assetDetails}
      inert={!isOpen || undefined}
      className={`
        fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-cms-border bg-cms-surface shadow-2xl
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
      style={{ marginTop: 'var(--cms-topbar-height, 0px)' }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={t.context.preview}
        className="relative aspect-[16/10] w-full cursor-pointer bg-cms-bg"
        onClick={() => onOpenLightbox(asset.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLightbox(asset.id) } }}
      >
        {isSvg ? (
          <img src={asset.blobUrl} alt={asset.altText ?? ''} className="h-full w-full object-contain p-4" />
        ) : (
          <Image src={asset.blobUrl} alt={asset.altText ?? ''} fill className="object-contain" />
        )}
        <button
          ref={closeBtnRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-black/60"
          aria-label={t.modal.close}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div role="tablist" className="flex border-b border-cms-border">
        {tabs.map((t2) => (
          <button
            key={t2}
            type="button"
            role="tab"
            aria-selected={tab === t2}
            aria-controls={tab === t2 ? `tabpanel-${t2}` : undefined}
            id={`tab-${t2}`}
            onClick={() => onTabChange(t2)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t2
                ? 'border-b-2 border-cms-accent text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {tabLabels[t2]}
          </button>
        ))}
      </div>

      <div id={`tabpanel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex-1 overflow-y-auto p-4">
        <DetailTabs
          tab={tab}
          asset={asset}
          usages={usages}
          onUpdateAltText={handleUpdateAltText}
          onUpdateTags={handleUpdateTags}
          onUpdateFolder={handleUpdateFolder}
          t={t}
        />
      </div>

      <div className="flex items-center gap-2 border-t border-cms-border px-4 py-3">
        <button
          type="button"
          onClick={() => onCopyUrl(asset.blobUrl)}
          className="flex-1 rounded-md bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cms-accent/90"
        >
          {t.detail.copyUrl}
        </button>
        <button
          type="button"
          onClick={() => onReplace(asset.id)}
          className="rounded-md border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface-hover"
        >
          {t.detail.replace}
        </button>
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
        >
          {t.detail.deleteAsset}
        </button>
      </div>
    </div>
  )
})
