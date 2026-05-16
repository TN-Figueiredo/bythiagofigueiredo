'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { listMediaAssetsAction } from '../../media/actions'
import { MediaCard } from '../../media/_components/media-card'
import type { CropPreset, MediaAssetResult, MediaAssetType } from './types'
import { getMediaGalleryStrings } from './_i18n/types'
import type { MediaAsset, MediaFolder } from '@/lib/media/types'

function folderToType(folder: MediaFolder): MediaAssetType {
  if (folder === 'authors') return 'avatar'
  if (folder === 'og') return 'og'
  return 'inline'
}

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
  { value: 'pipeline', labelKey: 'folderPipeline' },
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
  const [folderFilter, setFolderFilter] = useState('')
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
          className="flex-1 rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          aria-label={t.toolbar.searchLabel}
          data-testid="library-search"
        />
        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="rounded-md border border-cms-border bg-cms-bg px-3 py-2 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
          aria-label={t.upload.folderLabel}
          data-testid="library-folder-filter"
        >
          {FOLDER_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{t.library[f.labelKey]}</option>
          ))}
        </select>
      </div>

      {!loading && assets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-cms-text-dim">
            {search ? t.library.noResults : t.library.emptyLibrary}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              onDoubleClick={() => handleSelectAsset(asset)}
              className="relative"
            >
              <MediaCard
                item={asset}
                type={folderToType(asset.folder)}
                checked={false}
                selected={selectedId === asset.id}
                onSelect={(id) => setSelectedId(selectedId === id ? null : id)}
                onCheck={() => undefined}
                onQuickAction={() => undefined}
                compact
                data-testid={`media-thumb-${asset.id}`}
              />
              {isTooSmall(asset) && (
                <span
                  className="pointer-events-none absolute right-1 top-1 z-10 rounded bg-amber-500/80 px-1 py-0.5 text-[10px] font-medium text-black"
                  title={t.dimensions.tooSmall}
                >
                  !
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cms-border border-t-cms-accent" />
        </div>
      )}

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchAssets(nextCursor)}
            className="rounded-md border border-cms-border px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
          >
            {t.library.loadMore}
          </button>
        </div>
      )}

      {selectedAsset && (
        <div className="flex items-center justify-between rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-cms-text-muted">
            <span className="font-medium">{selectedAsset.filename}</span>
            <span className="text-cms-text-dim">
              {selectedAsset.width && selectedAsset.height
                ? `${selectedAsset.width} × ${selectedAsset.height}`
                : 'SVG'}
            </span>
            {selectedAsset.altText && (
              <span className="truncate text-cms-text-dim">{selectedAsset.altText}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleSelectAsset(selectedAsset)}
            className="rounded-md bg-cms-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-cms-accent/90"
            data-testid="library-select-btn"
          >
            {t.library.selectButton}
          </button>
        </div>
      )}
    </div>
  )
}
