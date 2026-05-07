'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { listMediaAssetsAction, softDeleteMediaAssetAction, getMediaStatsAction } from './actions'
import { MediaUploadTab } from '../_shared/media/media-upload-tab'
import { getMediaGalleryStrings } from '../_shared/media/_i18n/types'
import type { MediaAssetResult } from '../_shared/media/types'
import type { MediaAsset, MediaFolder } from '@/lib/media/types'

interface Props {
  locale: 'en' | 'pt-BR'
  siteId: string
}

type Tab = 'library' | 'upload'

const FOLDER_FILTERS: Array<{ value: string; labelKey: keyof ReturnType<typeof getMediaGalleryStrings>['library'] }> = [
  { value: '', labelKey: 'folderAll' },
  { value: 'authors', labelKey: 'folderAuthors' },
  { value: 'blog', labelKey: 'folderBlog' },
  { value: 'newsletters', labelKey: 'folderNewsletters' },
  { value: 'branding', labelKey: 'folderBranding' },
  { value: 'og', labelKey: 'folderOg' },
  { value: 'ads', labelKey: 'folderAds' },
  { value: 'general', labelKey: 'folderGeneral' },
]

export function MediaLibraryConnected({ locale, siteId }: Props) {
  const t = getMediaGalleryStrings(locale)

  const [activeTab, setActiveTab] = useState<Tab>('library')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState('')
  const [stats, setStats] = useState<{ total: number; totalSize: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  useEffect(() => {
    getMediaStatsAction().then((res) => {
      if (res.ok) setStats({ total: res.stats.totalCount, totalSize: res.stats.totalSizeBytes })
    })
  }, [])

  const selectedAsset = assets.find((a) => a.id === selectedId)

  const handleUploadComplete = (_asset: MediaAssetResult) => {
    setActiveTab('library')
    setAssets([])
    setNextCursor(null)
    fetchAssets()
    getMediaStatsAction().then((res) => {
      if (res.ok) setStats({ total: res.stats.totalCount, totalSize: res.stats.totalSizeBytes })
    })
  }

  const handleDelete = async () => {
    if (!selectedAsset) return
    setDeleting(true)
    try {
      const result = await softDeleteMediaAssetAction(selectedAsset.id)
      if (result.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== selectedAsset.id))
        setSelectedId(null)
        getMediaStatsAction().then((res) => {
          if (res.ok) setStats({ total: res.stats.totalCount, totalSize: res.stats.totalSizeBytes })
        })
      }
    } finally {
      setDeleting(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {stats && (
        <div className="mb-6 flex gap-4">
          <div className="rounded-lg border border-[#374151] bg-[#1e293b] px-4 py-3">
            <p className="text-xs text-[#9ca3af]">{locale === 'pt-BR' ? 'Total de assets' : 'Total assets'}</p>
            <p className="text-lg font-semibold text-[#f3f4f6]">{stats.total}</p>
          </div>
          <div className="rounded-lg border border-[#374151] bg-[#1e293b] px-4 py-3">
            <p className="text-xs text-[#9ca3af]">{locale === 'pt-BR' ? 'Armazenamento' : 'Storage'}</p>
            <p className="text-lg font-semibold text-[#f3f4f6]">{formatBytes(stats.totalSize)}</p>
          </div>
        </div>
      )}

      <div className="flex border-b border-[#374151]">
        {(['library', 'upload'] as const).map((tab) => (
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

      <div className="mt-6">
        {activeTab === 'upload' ? (
          <MediaUploadTab
            onSelect={handleUploadComplete}
            locale={locale}
            siteId={siteId}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.library.searchPlaceholder}
                className="flex-1 rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] placeholder-[#6b7280] focus:border-indigo-500 focus:outline-none"
                data-testid="media-page-search"
              />
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] focus:border-indigo-500 focus:outline-none"
                data-testid="media-page-folder-filter"
              >
                {FOLDER_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{t.library[f.labelKey]}</option>
                ))}
              </select>
            </div>

            {!loading && assets.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-[#6b7280]">
                  {search ? t.library.noResults : t.library.emptyLibrary}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
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
                        sizes="(min-width: 1024px) 150px, (min-width: 640px) 200px, 50vw"
                        className="object-cover"
                      />
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
                <div className="flex items-center gap-2">
                  <a
                    href={selectedAsset.blobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-[#374151] px-3 py-1.5 text-sm text-[#d1d5db] hover:bg-white/5"
                  >
                    {locale === 'pt-BR' ? 'Abrir' : 'Open'}
                  </a>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    data-testid="media-delete-btn"
                  >
                    {deleting
                      ? (locale === 'pt-BR' ? 'Excluindo...' : 'Deleting...')
                      : (locale === 'pt-BR' ? 'Excluir' : 'Delete')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
