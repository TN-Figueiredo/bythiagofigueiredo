'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { formatBytes } from '../../_shared/media/types'
import type { UsageEntry } from '../../_shared/media/types'

interface DetailTabsProps {
  tab: 'details' | 'usage' | 'history'
  asset: MediaAsset
  usages: UsageEntry[]
  onUpdateAltText: (altText: string) => void
  onUpdateTags: (tags: string[]) => void
  onUpdateFolder: (folder: string) => void
  t: MediaGalleryStrings
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {})
}

function CopyableValue({ label, value, t }: { label: string; value: string; t: MediaGalleryStrings }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-cms-text-dim">{label}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="group flex items-center gap-1 text-xs text-cms-text hover:text-cms-accent"
      >
        <span className="tabular-nums">{value}</span>
        <span className={`text-[10px] text-cms-accent transition-opacity ${copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {copied ? t.detail.copied : ''}
        </span>
      </button>
    </div>
  )
}

export function DetailTabs({ tab, asset, usages, onUpdateAltText, onUpdateTags, onUpdateFolder, t }: DetailTabsProps) {
  if (tab === 'details') {
    return (
      <DetailsTab
        asset={asset}
        onUpdateAltText={onUpdateAltText}
        onUpdateTags={onUpdateTags}
        onUpdateFolder={onUpdateFolder}
        t={t}
      />
    )
  }
  if (tab === 'usage') {
    return <UsageTab usages={usages} t={t} />
  }
  return <HistoryTab asset={asset} t={t} />
}

function DetailsTab({
  asset,
  onUpdateAltText,
  onUpdateTags,
  onUpdateFolder,
  t,
}: {
  asset: MediaAsset
  onUpdateAltText: (v: string) => void
  onUpdateTags: (v: string[]) => void
  onUpdateFolder: (v: string) => void
  t: MediaGalleryStrings
}) {
  const [altText, setAltText] = useState(asset.altText ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setAltText(asset.altText ?? '')
  }, [asset.id, asset.altText])

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  const handleAltChange = useCallback(
    (value: string) => {
      setAltText(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onUpdateAltText(value), 500)
    },
    [onUpdateAltText],
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onUpdateTags(asset.tags.filter((t) => t !== tag))
    },
    [asset.tags, onUpdateTags],
  )

  const [newTag, setNewTag] = useState('')
  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim()
    if (trimmed && !asset.tags.includes(trimmed)) {
      onUpdateTags([...asset.tags, trimmed])
    }
    setNewTag('')
  }, [newTag, asset.tags, onUpdateTags])

  const ratio = asset.width && asset.height
    ? `${(asset.width / asset.height).toFixed(2)}:1`
    : '—'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 rounded-lg border border-cms-border bg-cms-bg p-3">
        <CopyableValue label={t.detail.filename} value={asset.filename} t={t} />
        <CopyableValue
          label={t.detail.dimensions}
          value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'SVG'}
          t={t}
        />
        <CopyableValue label={t.detail.fileSize} value={formatBytes(asset.fileSize)} t={t} />
        <CopyableValue label={t.detail.ratio} value={ratio} t={t} />
        <CopyableValue label={t.detail.mimeType} value={asset.mimeType} t={t} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-cms-text-dim">{t.detail.uploaded}</span>
          <span className="text-xs text-cms-text">{new Date(asset.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.altText}</label>
        <textarea
          value={altText}
          onChange={(e) => handleAltChange(e.target.value)}
          rows={2}
          className="rounded-md border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none resize-none"
          placeholder={t.upload.altPlaceholder}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.tags}</label>
        <div className="flex flex-wrap gap-1.5">
          {asset.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-cms-bg px-2 py-0.5 text-xs text-cms-text">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 text-cms-text-dim hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder={t.detail.addTag}
              className="w-20 rounded border border-cms-border bg-cms-bg px-1.5 py-0.5 text-xs text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.folder}</label>
        <select
          value={asset.folder}
          onChange={(e) => onUpdateFolder(e.target.value)}
          className="rounded-md border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
        >
          {['general', 'authors', 'blog', 'pipeline', 'newsletters', 'branding', 'og', 'ads', 'links'].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function UsageTab({ usages, t }: { usages: UsageEntry[]; t: MediaGalleryStrings }) {
  if (usages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-red-400">
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12l8 8M20 12l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-cms-text-muted">{t.detail.noUsages}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-cms-text-muted">{t.detail.usedIn}</p>
      {usages.map((u, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-cms-border bg-cms-bg px-3 py-2">
          <span className="rounded-full bg-cms-accent/15 px-2 py-0.5 text-[10px] font-semibold text-cms-accent">
            {u.resourceType.replace('_', ' ')}
          </span>
          <span className="text-xs text-cms-text truncate">{u.fieldName}</span>
        </div>
      ))}
    </div>
  )
}

function HistoryTab({ asset, t }: { asset: MediaAsset; t: MediaGalleryStrings }) {
  const events = [
    { label: t.detail.historyUpload, date: asset.createdAt },
    { label: t.detail.historyExifStrip, date: asset.createdAt },
    { label: t.detail.historyDedupCheck, date: asset.createdAt },
  ]

  return (
    <div className="flex flex-col gap-0 pl-3">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 pb-4">
          <div className="relative flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-cms-accent" />
            {i < events.length - 1 && <div className="absolute top-3 h-full w-px bg-cms-border" />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-cms-text">{ev.label}</span>
            <span className="text-[10px] text-cms-text-dim">{new Date(ev.date).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
