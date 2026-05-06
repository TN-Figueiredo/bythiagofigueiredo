'use client'
import type { LinkSummary, AnalyticsMetrics } from '../types'

export interface LinkDetailPanelProps {
  link: LinkSummary
  metrics: AnalyticsMetrics
  onEdit: (id: string) => void
  onCopyUrl: (id: string) => void
  onGenerateQr: (id: string) => void
  onClose: () => void
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function Sparkline({ data }: { data: Array<{ clicks: number }> }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.clicks), 1)
  const width = 200
  const height = 40
  const step = width / Math.max(data.length - 1, 1)

  const points = data
    .map((d, i) => `${i * step},${height - (d.clicks / max) * height}`)
    .join(' ')

  return (
    <svg data-testid="sparkline" viewBox={`0 0 ${width} ${height}`} className="h-10 w-full">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-blue-500"
      />
    </svg>
  )
}

export function LinkDetailPanel({
  link,
  metrics,
  onEdit,
  onCopyUrl,
  onGenerateQr,
  onClose,
}: LinkDetailPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-gray-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{link.title || link.code}</h2>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          X
        </button>
      </div>

      {/* Short URL + Code */}
      <div className="mt-3 rounded bg-gray-50 p-2">
        <p className="text-xs text-gray-500">Short URL</p>
        <p className="font-mono text-sm text-gray-800">/go/{link.code}</p>
      </div>

      {/* Full Destination */}
      <div className="mt-3">
        <p className="text-xs text-gray-500">Destination</p>
        <p className="break-all text-sm text-gray-800">{link.destination_url}</p>
      </div>

      {/* KPI Row */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded bg-blue-50 p-2 text-center">
          <p className="text-lg font-bold text-blue-700">{formatNumber(metrics.totalClicks)}</p>
          <p className="text-xs text-gray-500">Clicks</p>
        </div>
        <div className="rounded bg-green-50 p-2 text-center">
          <p className="text-lg font-bold text-green-700">
            {formatNumber(metrics.uniqueVisitors)}
          </p>
          <p className="text-xs text-gray-500">Unique</p>
        </div>
        <div className="rounded bg-purple-50 p-2 text-center">
          <p className="text-lg font-bold text-purple-700">{metrics.topCountry ?? '—'}</p>
          <p className="text-xs text-gray-500">Top Country</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-4">
        <p className="mb-1 text-xs text-gray-500">Clicks (7d)</p>
        <Sparkline data={metrics.dailyClicks} />
      </div>

      {/* Tags */}
      {link.tags.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-gray-500">Tags</p>
          <div className="flex flex-wrap gap-1">
            {link.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Source Type */}
      <div className="mt-4">
        <p className="text-xs text-gray-500">Source</p>
        <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs capitalize">
          {link.source_type}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          aria-label="Edit link"
          onClick={() => onEdit(link.id)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          type="button"
          aria-label="Copy short URL"
          onClick={() => onCopyUrl(link.id)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Copy
        </button>
        <button
          type="button"
          aria-label="Generate QR"
          onClick={() => onGenerateQr(link.id)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          QR
        </button>
      </div>
    </div>
  )
}
