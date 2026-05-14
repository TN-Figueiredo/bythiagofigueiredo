'use client'

import { useCallback } from 'react'

interface ShortLinkCardProps {
  shortUrl: string
  destinationUrl: string
  clicks: number
  uniqueVisitors: number
}

export function ShortLinkCard({ shortUrl, destinationUrl, clicks, uniqueVisitors }: ShortLinkCardProps) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`https://${shortUrl}`)
  }, [shortUrl])

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-cms-text">{shortUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[10px] text-cms-text-muted hover:text-cms-text"
        >
          Copiar
        </button>
      </div>

      <p className="text-[10px] text-cms-text-muted font-mono">
        {shortUrl} <span className="text-amber-400">301</span> → {destinationUrl} <span className="text-emerald-400">200</span>
      </p>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-cms-border">
        <div>
          <p className="text-[9px] text-cms-text-muted uppercase">Clicks</p>
          <p className="text-sm font-bold tabular-nums text-cms-text">{clicks}</p>
        </div>
        <div>
          <p className="text-[9px] text-cms-text-muted uppercase">Unique</p>
          <p className="text-sm font-bold tabular-nums text-cms-text">{uniqueVisitors}</p>
        </div>
        <div>
          <p className="text-[9px] text-cms-text-muted uppercase">%</p>
          <p className="text-sm font-bold tabular-nums text-cms-text">
            {clicks > 0 ? Math.round((uniqueVisitors / clicks) * 100) : 0}%
          </p>
        </div>
      </div>
    </div>
  )
}
