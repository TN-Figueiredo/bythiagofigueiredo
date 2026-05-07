'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { listMediaAssetsAction } from '../../media/actions'
import type { CropPreset, MediaAssetResult } from './types'
import { getMediaGalleryStrings } from './_i18n/types'
import type { MediaAsset, MediaFolder } from '@/lib/media/types'

interface LibraryTabProps {
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  locale: 'en' | 'pt-BR'
  siteId: string
}

const FOLDER_FILTERS: Array<{ value: string; labelKey: keyof ReturnType<typeof getMediaGalleryStrings>['library'] }> = [
  { value: '', labelKey: 'folderAll' },
  { value: 'authors', labelKey: 'folderAuthors' },
  { value: 'blog', labelKey: 'folderBlog' },
  { value: 'newsletters', labelKey: 'folderNewsletters' },
  { value: 'branding', labelKey: 'folderBranding' },
  { value: 'og', labelKey: 'folderOg' },
  { value: 'ads', labelKey: 'folderAds' },
  { value: 'links', labelKey: 'folderLinks' },
  { value: 'general', labelKey: 'folderGeneral' },
]

export function MediaLibraryTab({ onSelect, folder, cropPreset, locale }: LibraryTabProps) {
  const t = getMediaGalleryStrings(locale)

  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState(folder ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchAssets = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      try {
        const result = await listMediaAssetsAction({
          folder: (folderFilter || undefined) as MediaFolder | undefined,
          search: search || undefined,
          cursor,
          limit: 24,
        })

        if (result.ok) {
          setAssets((prev) => (cursor ? [...prev, ...result.assets] : result.assets))
          setNextCursor(result.nextCursor)
        }
      } finally {
        setLoading(false)
      }
    },
    [folderFilter, search],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setAssets([])
      setNextCursor(null)
      fetchAssets()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchAssets])

  const selectedAsset = assets.find((a) => a.id === selectedId)

  const isTooSmall = (asset: MediaAsset): boolean => {
    if (!cropPreset || !asset.width || !asset.height) return false
    return asset.width < cropPreset.maxWidth || (cropPreset.maxHeight !== undefined && asset.height < cropPreset.maxHeight)
  }

  const handleSelectAsset = (asset: MediaAsset) => {
    onSelect({
      id: asset.id,
      url: asset.blobUrl,
      alt: asset.altText ?? '',
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      mimeType: asset.mimeType,
    })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          className="flex-1 rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] placeholder-[#6b7280] focus:border-indigo-500 focus:outline-none"
          data-testid="library-search"
        />
        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] focus:border-indigo-500 focus:outline-none"
          data-testid="library-folder-filter"
        >
          {FOLDER_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{t.library[f.labelKey]}</option>
          ))}
        </select>
      </div>

      {!loading && assets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#6b7280]">
            {search ? t.library.noResults : t.library.emptyLibrary}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
              onDoubleClick={() => handleSelectAsset(asset)}
              className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                selectedId === asset.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500'
                  : 'border-[#374151] hover:border-[#4b5563]'
              }`}
              data-testid={`media-thumb-${asset.id}`}
            >
              {asset.mimeType === 'image/svg+xml' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.blobUrl} alt={asset.altText ?? ''} className="h-full w-full object-cover" />
              ) : (
                <Image
                  src={asset.blobUrl}
                  alt={asset.altText ?? ''}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              )}
              {isTooSmall(asset) && (
                <span
                  className="absolute right-1 top-1 rounded bg-amber-500/80 px-1 py-0.5 text-[10px] font-medium text-black"
                  title={t.dimensions.tooSmall}
                >
                  !
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#374151] border-t-indigo-500" />
        </div>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchAssets(nextCursor)}
            className="rounded-md border border-[#374151] px-4 py-2 text-sm text-[#d1d5db] hover:bg-white/5"
          >
            {t.library.loadMore}
          </button>
        </div>
      )}

      {selectedAsset && (
        <div className="flex items-center justify-between rounded-lg border border-[#374151] bg-[#1e293b] px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-[#d1d5db]">
            <span className="font-medium">{selectedAsset.filename}</span>
            <span className="text-[#6b7280]">
              {selectedAsset.width && selectedAsset.height
                ? `${selectedAsset.width} × ${selectedAsset.height}`
                : 'SVG'}
            </span>
            {selectedAsset.altText && (
              <span className="truncate text-[#6b7280]">{selectedAsset.altText}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleSelectAsset(selectedAsset)}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
            data-testid="library-select-btn"
          >
            {locale === 'pt-BR' ? 'Selecionar' : 'Select'}
          </button>
        </div>
      )}
    </div>
  )
}
