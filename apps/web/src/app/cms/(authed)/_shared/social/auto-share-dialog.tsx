'use client'

import React, { useState, useMemo } from 'react'
import type { Provider } from '@tn-figueiredo/social'
import { PlatformIcon, platformLabel } from './platform-icon'

const PLATFORM_CHAR_LIMITS: Record<Provider, number> = {
  facebook: 63206,
  bluesky: 300,
  instagram: 2200,
  youtube: 5000,
}

interface AutoShareStrings {
  title: string
  shareNow: string
  customize: string
  skip: string
  captionLabel: string
  undoToast: string
  undoAction: string
}

interface AutoShareDialogProps {
  open: boolean
  onClose: () => void
  contentType: 'blog' | 'newsletter' | 'campaign' | 'video'
  contentId: string
  contentTitle: string
  contentUrl: string
  contentExcerpt?: string | null
  contentImage?: string | null
  availablePlatforms: readonly Provider[]
  defaultPlatforms: readonly Provider[]
  onShareNow: (payload: { platforms: Provider[]; caption: string }) => void
  onCustomize: () => void
  strings: { autoShare: AutoShareStrings }
}

export function AutoShareDialog({
  open,
  onClose,
  contentTitle,
  contentUrl,
  availablePlatforms,
  defaultPlatforms,
  onShareNow,
  onCustomize,
  strings: { autoShare: t },
}: AutoShareDialogProps) {
  const [checked, setChecked] = useState<Set<Provider>>(
    () => new Set(defaultPlatforms),
  )
  const defaultCaption = `${contentTitle}\n\n${contentUrl}`
  const [caption, setCaption] = useState(defaultCaption)

  const charCounts = useMemo(() => {
    const counts: Partial<Record<Provider, { current: number; limit: number }>> = {}
    for (const p of availablePlatforms) {
      counts[p] = { current: caption.length, limit: PLATFORM_CHAR_LIMITS[p] }
    }
    return counts
  }, [caption, availablePlatforms])

  function togglePlatform(provider: Provider) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) next.delete(provider)
      else next.add(provider)
      return next
    })
  }

  function handleShareNow() {
    onShareNow({
      platforms: Array.from(checked),
      caption,
    })
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div className="w-full max-w-lg rounded-xl border border-cms-border bg-cms-surface p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-cms-text">{t.title}</h2>

        {/* Platform checkboxes */}
        <div className="flex flex-wrap gap-3">
          {availablePlatforms.map((provider) => (
            <label
              key={provider}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked.has(provider)}
                onChange={() => togglePlatform(provider)}
                aria-label={platformLabel(provider)}
                className="accent-cms-accent"
              />
              <PlatformIcon provider={provider} size="sm" />
              <span className="text-sm text-cms-text">
                {platformLabel(provider)}
              </span>
            </label>
          ))}
        </div>

        {/* Caption preview */}
        <div className="space-y-1">
          <label
            htmlFor="auto-share-caption"
            className="text-sm font-medium text-cms-text-muted"
          >
            {t.captionLabel}
          </label>
          <textarea
            id="auto-share-caption"
            aria-label={t.captionLabel}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-cms-border bg-cms-bg p-3 text-sm text-cms-text resize-none focus:border-cms-accent focus:outline-none"
          />
          <div className="flex flex-wrap gap-3 text-xs text-cms-text-dim">
            {Array.from(checked).map((p) => {
              const count = charCounts[p]
              if (!count) return null
              const ratio = count.current / count.limit
              const color =
                ratio >= 1
                  ? 'text-red-400'
                  : ratio >= 0.9
                    ? 'text-amber-400'
                    : 'text-cms-text-dim'
              return (
                <span key={p} className={color}>
                  {platformLabel(p)}: {count.current}/{count.limit}
                </span>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleShareNow}
            disabled={checked.size === 0}
            className="rounded-lg bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-cms-accent-hover disabled:opacity-50"
          >
            {t.shareNow}
          </button>
          <button
            type="button"
            onClick={onCustomize}
            className="rounded-lg border border-cms-border px-4 py-2 text-sm font-medium text-cms-text hover:bg-cms-bg"
          >
            {t.customize}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-sm text-cms-text-muted hover:text-cms-text"
          >
            {t.skip}
          </button>
        </div>
      </div>
    </div>
  )
}
