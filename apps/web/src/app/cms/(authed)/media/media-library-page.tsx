'use client'

import { useReducer, useEffect, useCallback, useRef, useState, useTransition, useMemo } from 'react'
import { mediaLibraryReducer, initialState } from './media-library-reducer'
import {
  listMediaAssetsWithUsageAction,
  getMediaStatsAction,
  getAssetUsagesAction,
  softDeleteMediaAssetAction,
  bulkDeleteMediaAssetsAction,
  updateMediaAssetAction,
} from './actions'
import { getMediaGalleryStrings } from '../_shared/media/_i18n/types'
import type { MediaAssetResult, EnrichedMediaAsset, UsageEntry, MediaSortOption, MediaViewMode, MediaColumnCount } from '../_shared/media/types'
import type { MediaStats } from '@/lib/media/queries'
import type { MediaFolder, MediaAssetType } from '@/lib/media/types'
import { FOLDER_TO_TYPE } from '@/lib/media/resolve-type'
import { type QuickAction } from './_components/media-card'

import { StorageBar } from './_components/storage-bar'
import { MediaToolbar } from './_components/media-toolbar'
import { MediaGrid } from './_components/media-grid'
import { MediaList } from './_components/media-list'
import { SkeletonGrid } from './_components/skeleton-grid'
import { EmptyState } from './_components/empty-state'
import { DetailPanel } from './_components/detail-panel'
import { MediaLightbox } from './_components/media-lightbox'
import { BulkActionBar } from './_components/bulk-action-bar'
import { ContextMenu } from './_components/context-menu'
import { DeleteConfirmModal } from './_components/delete-confirm-modal'
import { DropOverlay } from './_components/drop-overlay'
import { MediaUploadTab } from '../_shared/media/media-upload-tab'

interface Props {
  locale: 'en' | 'pt-BR'
  siteId: string
}

export function MediaLibraryPage({ locale, siteId }: Props) {
  const t = getMediaGalleryStrings(locale)
  const [state, dispatch] = useReducer(mediaLibraryReducer, undefined, initialState)
  const [, startTransition] = useTransition()

  const [items, setItems] = useState<EnrichedMediaAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [usages, setUsages] = useState<UsageEntry[]>([])
  const [showUpload, setShowUpload] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; usageCount: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [fetchError, setFetchError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lastCheckRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dragCounterRef = useRef(0)
  const searchRef = useRef(state.search)
  searchRef.current = state.search

  const announce = useCallback((message: string) => {
    const el = document.getElementById('media-announcements')
    if (el) el.textContent = message
  }, [])

  const fetchAssets = useCallback(
    async (cursor?: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      dispatch({ type: 'SET_LOADING', loading: true })

      try {
        const result = await listMediaAssetsWithUsageAction({
          search: searchRef.current || undefined,
          cursor,
          limit: 24,
        })

        if (controller.signal.aborted) return

        if (result.ok) {
          setFetchError(null)
          const enriched: EnrichedMediaAsset[] = result.assets.map((a) => ({
            asset: a.asset,
            type: a.type,
            usageCount: a.usageCount,
            primaryFieldName: a.primaryFieldName,
          }))

          if (cursor) {
            setItems((prev) => [...prev, ...enriched])
          } else {
            setItems(enriched)
          }
          setNextCursor(result.nextCursor)
        } else {
          setFetchError(t.upload.uploadError)
        }
      } finally {
        if (!controller.signal.aborted) {
          dispatch({ type: 'SET_LOADING', loading: false })
        }
      }
    },
    [t.upload.uploadError],
  )

  const sortedItems = useMemo(() => {
    const sorted = [...items]
    switch (state.sort) {
      case 'newest': sorted.sort((a, b) => b.asset.createdAt.localeCompare(a.asset.createdAt)); break
      case 'oldest': sorted.sort((a, b) => a.asset.createdAt.localeCompare(b.asset.createdAt)); break
      case 'largest': sorted.sort((a, b) => b.asset.fileSize - a.asset.fileSize); break
      case 'smallest': sorted.sort((a, b) => a.asset.fileSize - b.asset.fileSize); break
      case 'name': sorted.sort((a, b) => a.asset.filename.localeCompare(b.asset.filename)); break
    }
    return sorted
  }, [items, state.sort])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setItems([])
      setNextCursor(null)
      fetchAssets().then(() => {
        if (searchRef.current) {
          const count = document.querySelectorAll('[data-focus-index]').length
          announce(t.toolbar.searchCount.replace('{count}', String(count)))
        }
      }).catch(() => {})
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.search, fetchAssets, announce, t.toolbar.searchCount])

  useEffect(() => {
    getMediaStatsAction().then((res) => {
      if (res.ok) setStats(res.stats)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!state.selectedId) { setUsages([]); return }
    getAssetUsagesAction(state.selectedId).then((res) => {
      if (res.ok) setUsages(res.usages)
    }).catch(() => {})
  }, [state.selectedId])

  const filterCounts = useMemo(() => {
    const counts = { all: 0, cover: 0, inline: 0, avatar: 0, og: 0, orphan: 0 }
    for (const item of items) {
      counts.all++
      counts[item.type]++
    }
    return counts
  }, [items])

  const filteredItems = useMemo(
    () => state.filter === 'all' ? sortedItems : sortedItems.filter((i) => i.type === state.filter),
    [sortedItems, state.filter],
  )
  const selectedAsset = useMemo(
    () => sortedItems.find((i) => i.asset.id === state.selectedId)?.asset ?? null,
    [sortedItems, state.selectedId],
  )

  const handleSelect = useCallback((id: string) => {
    dispatch({ type: 'SELECT_ITEM', id })
  }, [])

  const handleCheck = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey && lastCheckRef.current) {
      const ids = filteredItems.map((i) => i.asset.id)
      const start = ids.indexOf(lastCheckRef.current)
      const end = ids.indexOf(id)
      if (start !== -1 && end !== -1) {
        const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1)
        dispatch({ type: 'CHECK_RANGE', ids: range })
        lastCheckRef.current = id
        return
      }
    }
    dispatch({ type: 'TOGGLE_CHECK', id })
    lastCheckRef.current = id
  }, [filteredItems])

  const handleQuickAction = useCallback((id: string, action: QuickAction) => {
    const enriched = sortedItems.find((i) => i.asset.id === id)
    if (!enriched) return

    switch (action) {
      case 'preview':
        dispatch({ type: 'OPEN_LIGHTBOX', id })
        break
      case 'download':
        window.open(enriched.asset.blobUrl, '_blank')
        break
      case 'copy-url':
        navigator.clipboard.writeText(enriched.asset.blobUrl).catch(() => {})
        break
      case 'delete':
        setDeleteModal({ ids: [id], usageCount: enriched.usageCount })
        break
    }
  }, [sortedItems])

  type ContextAction = QuickAction | 'edit-alt'
  const handleContextAction = useCallback((action: ContextAction) => {
    if (!contextMenu) return
    if (action === 'edit-alt') {
      dispatch({ type: 'SELECT_ITEM', id: contextMenu.id })
    } else {
      handleQuickAction(contextMenu.id, action)
    }
  }, [contextMenu, handleQuickAction])

  const handleUpdateAsset = useCallback(
    (assetId: string, updates: { altText?: string; tags?: string[]; folder?: string }) => {
      startTransition(async () => {
        await updateMediaAssetAction(assetId, {
          altText: updates.altText,
          tags: updates.tags,
          folder: updates.folder && updates.folder in FOLDER_TO_TYPE ? updates.folder as MediaFolder : undefined,
        })
        fetchAssets()
      })
    },
    [fetchAssets],
  )

  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      if (deleteModal.ids.length === 1) {
        await softDeleteMediaAssetAction(deleteModal.ids[0]!)
      } else {
        await bulkDeleteMediaAssetsAction(deleteModal.ids)
      }
      const deletedIds = deleteModal.ids
      setDeleteModal(null)
      dispatch({ type: 'UNCHECK_ALL' })
      setItems(prev => prev.filter(i => !deletedIds.includes(i.asset.id)))
      getMediaStatsAction().then((res) => { if (res.ok) setStats(res.stats) }).catch(() => {})
      announce(deletedIds.length === 1
        ? t.detail.deleteAsset
        : t.bulk.deleteSelected + ` (${deletedIds.length})`)
    } catch {
      setDeleteError(t.delete.deleteFailed)
    } finally {
      setIsDeleting(false)
    }
  }, [deleteModal, t.delete.deleteFailed, t.detail.deleteAsset, t.bulk.deleteSelected, announce])

  const handleBulkDelete = useCallback(() => {
    const totalUsages = [...state.checked].reduce((sum, id) => {
      const enriched = items.find((e) => e.asset.id === id)
      return sum + (enriched?.usageCount ?? 0)
    }, 0)
    setDeleteModal({ ids: [...state.checked], usageCount: totalUsages })
  }, [state.checked, items])

  const handleBulkDownload = useCallback(() => {
    for (const id of state.checked) {
      const asset = sortedItems.find((i) => i.asset.id === id)?.asset
      if (asset) {
        const a = document.createElement('a')
        a.href = asset.blobUrl
        a.download = asset.filename
        a.click()
      }
    }
  }, [state.checked, sortedItems])

  const handleUploadComplete = useCallback((_asset: MediaAssetResult) => {
    setShowUpload(false)
    setItems([])
    setNextCursor(null)
    fetchAssets()
    getMediaStatsAction().then((res) => { if (res.ok) setStats(res.stats) }).catch(() => {})
  }, [fetchAssets])

  // Memoized dispatch callbacks for child components
  const handleFilterChange = useCallback((f: 'all' | MediaAssetType) => dispatch({ type: 'SET_FILTER', filter: f }), [])
  const handleSearchChange = useCallback((s: string) => dispatch({ type: 'SET_SEARCH', search: s }), [])
  const handleSortChange = useCallback((s: MediaSortOption) => dispatch({ type: 'SET_SORT', sort: s }), [])
  const handleViewChange = useCallback((v: MediaViewMode) => dispatch({ type: 'SET_VIEW', view: v }), [])
  const handleColsChange = useCallback((c: MediaColumnCount) => dispatch({ type: 'SET_COLS', cols: c }), [])
  const handleSelectAll = useCallback(() => dispatch({ type: 'CHECK_ALL', ids: filteredItems.map((i) => i.asset.id) }), [filteredItems])
  const handleDeselectAll = useCallback(() => dispatch({ type: 'UNCHECK_ALL' }), [])
  const handleContextMenuOpen = useCallback((id: string, x: number, y: number) => setContextMenu({ id, x, y }), [])
  const handleDetailTabChange = useCallback((tab: 'details' | 'usage' | 'history') => dispatch({ type: 'SET_DETAIL_TAB', tab }), [])
  const handleDetailClose = useCallback(() => {
    dispatch({ type: 'DESELECT' })
  }, [])
  const handleCopyUrl = useCallback((url: string) => { navigator.clipboard.writeText(url).catch(() => {}) }, [])
  const handleReplace = useCallback(() => setShowUpload(true), [])
  const handleDetailDelete = useCallback((id: string) => setDeleteModal({ ids: [id], usageCount: usages.length }), [usages.length])
  const handleOpenLightbox = useCallback((id: string) => dispatch({ type: 'OPEN_LIGHTBOX', id }), [])
  const handleContextMenuClose = useCallback(() => setContextMenu(null), [])
  const handleDeleteCancel = useCallback(() => { setDeleteModal(null); setDeleteError(null) }, [])
  const handleCloseLightbox = useCallback(() => dispatch({ type: 'CLOSE_LIGHTBOX' }), [])
  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      setFocusedIndex(-1)
      fetchAssets(nextCursor)
    }
  }, [nextCursor, fetchAssets])

  const lightboxAsset = useMemo(
    () => state.lightboxId ? sortedItems.find((i) => i.asset.id === state.lightboxId)?.asset ?? null : null,
    [sortedItems, state.lightboxId],
  )
  const lightboxIndex = useMemo(
    () => state.lightboxId ? filteredItems.findIndex((i) => i.asset.id === state.lightboxId) : -1,
    [state.lightboxId, filteredItems],
  )

  const handleLightboxPrev = useCallback(() => {
    if (lightboxIndex > 0) {
      dispatch({ type: 'OPEN_LIGHTBOX', id: filteredItems[lightboxIndex - 1]!.asset.id })
    }
  }, [lightboxIndex, filteredItems])

  const handleLightboxNext = useCallback(() => {
    if (lightboxIndex < filteredItems.length - 1) {
      dispatch({ type: 'OPEN_LIGHTBOX', id: filteredItems[lightboxIndex + 1]!.asset.id })
    }
  }, [lightboxIndex, filteredItems])

  const [focusedIndex, setFocusedIndex] = useState(-1)

  useEffect(() => { setFocusedIndex(-1) }, [state.filter, state.search])

  useEffect(() => {
    if (focusedIndex < 0) return
    const el = document.querySelector<HTMLElement>(`[data-focus-index="${focusedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
    el?.focus()
  }, [focusedIndex])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-testid="media-search"]')?.focus()
      }
      if (e.key === 'Escape') {
        if (deleteModal) return
        if (state.lightboxId) { dispatch({ type: 'CLOSE_LIGHTBOX' }); return }
        if (state.selectedId) { dispatch({ type: 'DESELECT' }); return }
        if (state.search) dispatch({ type: 'SET_SEARCH', search: '' })
        return
      }

      if (state.lightboxId) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.checked.size > 0 && !isDeleting && !deleteModal) handleBulkDelete()
      }

      const active = document.activeElement
      const isInsideGrid = active === document.body || active?.closest('[role="list"]') !== null

      if (!isInsideGrid) return

      const cols = state.view === 'list' ? 1 : state.cols
      if (e.key === 'ArrowRight' && focusedIndex < filteredItems.length - 1) {
        e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
      }
      if (e.key === 'ArrowLeft' && focusedIndex > 0) {
        e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setFocusedIndex((i) => Math.min(i + cols, filteredItems.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); setFocusedIndex((i) => Math.max(i - cols, 0))
      }
      if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
        dispatch({ type: 'SELECT_ITEM', id: filteredItems[focusedIndex]!.asset.id })
      }
      if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_CHECK', id: filteredItems[focusedIndex]!.asset.id })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.lightboxId, state.selectedId, state.search, state.checked.size, state.view, state.cols, handleBulkDelete, focusedIndex, filteredItems, isDeleting, deleteModal])

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current++
      setIsDragging(true)
    }
    const handleDragOver = (e: DragEvent) => { e.preventDefault() }
    const handleDragLeave = () => {
      dragCounterRef.current--
      if (dragCounterRef.current === 0) setIsDragging(false)
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      dragCounterRef.current = 0
      setIsDragging(false)
      setShowUpload(true)
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 px-6 py-4 motion-reduce:*:!transition-none motion-reduce:*:!animate-none">
      <div aria-live="polite" className="sr-only" id="media-announcements" />

      {showUpload && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-cms-text">{t.tabs.upload}</h3>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-xs text-cms-text-muted hover:text-cms-text"
            >
              {t.modal.close}
            </button>
          </div>
          <MediaUploadTab
            onSelect={handleUploadComplete}
            locale={locale}
            siteId={siteId}
          />
        </div>
      )}

      {stats && (
        <StorageBar
          folderBreakdown={stats.folderBreakdown}
          totalSizeBytes={stats.totalSizeBytes}
          orphanCount={stats.orphanCount}
          t={t}
        />
      )}

      <MediaToolbar
        filter={state.filter}
        search={state.search}
        sort={state.sort}
        view={state.view}
        cols={state.cols}
        resultCount={filteredItems.length}
        totalCount={items.length}
        checkedCount={state.checked.size}
        filterCounts={filterCounts}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onViewChange={handleViewChange}
        onColsChange={handleColsChange}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        t={t}
      />

      {!showUpload && (
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="self-start rounded-md bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cms-accent/90"
        >
          {t.tabs.upload}
        </button>
      )}

      <div className={`flex-1 ${state.selectedId ? 'mr-[396px]' : ''} transition-all duration-300`}>
        {state.isLoading && items.length === 0 ? (
          <SkeletonGrid cols={state.cols} t={t} />
        ) : filteredItems.length === 0 ? (
          <EmptyState filter={state.filter} searchQuery={state.search} t={t} />
        ) : state.view === 'grid' ? (
          <MediaGrid
            items={filteredItems}
            checked={state.checked}
            selectedId={state.selectedId}
            cols={state.cols}
            searchQuery={state.search}
            focusedIndex={focusedIndex}
            onSelect={handleSelect}
            onCheck={handleCheck}
            onQuickAction={handleQuickAction}
            onContextMenu={handleContextMenuOpen}
            t={t}
          />
        ) : (
          <MediaList
            items={filteredItems}
            checked={state.checked}
            selectedId={state.selectedId}
            focusedIndex={focusedIndex}
            onSelect={handleSelect}
            onCheck={handleCheck}
            t={t}
          />
        )}

        {state.isLoading && items.length > 0 && (
          <div className="flex justify-center py-4" role="status">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cms-border border-t-cms-accent" />
            <span className="sr-only">{t.aria.loading}</span>
          </div>
        )}

        {fetchError && !state.isLoading && (
          <div role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {fetchError}
          </div>
        )}

        {nextCursor && !state.isLoading && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={handleLoadMore}
              className="rounded-md border border-cms-border px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
            >
              {t.library.loadMore}
            </button>
          </div>
        )}
      </div>

      <DetailPanel
        asset={selectedAsset}
        tab={state.detailTab}
        usages={usages}
        onTabChange={handleDetailTabChange}
        onClose={handleDetailClose}
        onUpdateAsset={handleUpdateAsset}
        onCopyUrl={handleCopyUrl}
        onReplace={handleReplace}
        onDelete={handleDetailDelete}
        onOpenLightbox={handleOpenLightbox}
        t={t}
      />

      <BulkActionBar
        count={state.checked.size}
        onDeselect={handleDeselectAll}
        onDownload={handleBulkDownload}
        onDelete={handleBulkDelete}
        t={t}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          assetId={contextMenu.id}
          onAction={handleContextAction}
          onClose={handleContextMenuClose}
          t={t}
        />
      )}

      <DeleteConfirmModal
        open={deleteModal !== null}
        count={deleteModal?.ids.length ?? 0}
        usageCount={deleteModal?.usageCount ?? 0}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        error={deleteError}
        isLoading={isDeleting}
        t={t}
      />

      <MediaLightbox
        asset={lightboxAsset}
        currentIndex={lightboxIndex}
        totalCount={filteredItems.length}
        onPrev={handleLightboxPrev}
        onNext={handleLightboxNext}
        onClose={handleCloseLightbox}
        t={t}
      />

      <DropOverlay active={isDragging} t={t} />
    </div>
  )
}
