'use client'
import { useState, useCallback } from 'react'
import {
  MousePointerClick,
  Users,
  Globe,
  Pencil,
  Copy,
  Check,
  QrCode,
  X,
  ExternalLink,
  Tag,
  Clock,
  ArrowUpRight,
} from 'lucide-react'
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
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString()
}

const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-500/10 text-gray-400',
  campaign: 'bg-blue-500/10 text-blue-400',
  newsletter: 'bg-purple-500/10 text-purple-400',
  blog: 'bg-green-500/10 text-green-400',
  social: 'bg-pink-500/10 text-pink-400',
  print: 'bg-amber-500/10 text-amber-400',
}

function MiniKpi({
  icon,
  label,
  value,
  accentClass,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  accentClass: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <div
        className={`mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-md ${accentClass}`}
      >
        {icon}
      </div>
      <p className="text-lg font-extrabold tabular-nums text-foreground">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  )
}

function Sparkline({ data }: { data: Array<{ clicks: number }> }) {
  if (data.length < 2) return null
  const max = Math.max(...data.map((d) => d.clicks), 1)
  const width = 240
  const height = 48
  const padding = 2
  const step = (width - padding * 2) / Math.max(data.length - 1, 1)

  const points = data
    .map((d, i) => `${padding + i * step},${height - padding - ((d.clicks / max) * (height - padding * 2))}`)
    .join(' ')

  const areaPoints = `${padding},${height - padding} ${points} ${padding + (data.length - 1) * step},${height - padding}`

  return (
    <svg data-testid="sparkline" viewBox={`0 0 ${width} ${height}`} className="h-12 w-full">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99 102 241)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-grad)" />
      <polyline
        points={points}
        fill="none"
        stroke="rgb(99 102 241)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyUrlButton({ text, onCopy }: { text: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    onCopy()
    setTimeout(() => setCopied(false), 1500)
  }, [text, onCopy])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Copy short URL"
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
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
    <div className="flex h-full flex-col overflow-y-auto border-l border-border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-4">
        <div className="min-w-0 pr-4">
          <h2 className="text-base font-bold text-foreground line-clamp-1">
            {link.title || `/${link.code}`}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                SOURCE_COLORS[link.source_type] ?? SOURCE_COLORS.manual
              }`}
            >
              {link.source_type}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                link.active ? 'text-green-400' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${link.active ? 'bg-green-500' : 'bg-muted-foreground/50'}`}
              />
              {link.active ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 p-4">
        {/* Short URL Card */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Short URL
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-indigo-400">
              /go/{link.code}
            </p>
          </div>
          <CopyUrlButton text={`/go/${link.code}`} onCopy={() => onCopyUrl(link.id)} />
        </div>

        {/* Destination */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Destination
          </p>
          <a
            href={link.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <span className="break-all">{link.destination_url}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-2">
          <MiniKpi
            icon={<MousePointerClick className="h-3.5 w-3.5 text-indigo-400" />}
            label="Clicks"
            value={metrics.totalClicks}
            accentClass="bg-indigo-500/10"
          />
          <MiniKpi
            icon={<Users className="h-3.5 w-3.5 text-green-400" />}
            label="Unique"
            value={metrics.uniqueVisitors}
            accentClass="bg-green-500/10"
          />
          <MiniKpi
            icon={<Globe className="h-3.5 w-3.5 text-purple-400" />}
            label="Top Country"
            value={metrics.topCountry ?? '—'}
            accentClass="bg-purple-500/10"
          />
        </div>

        {/* Sparkline */}
        {metrics.dailyClicks.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Clicks (7d)
            </p>
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <Sparkline data={metrics.dailyClicks} />
            </div>
          </div>
        )}

        {/* Tags */}
        {link.tags.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted-foreground" />
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Tags
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {link.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Redirect</span>
            <span className="font-mono font-medium text-foreground">{link.redirect_type}</span>
          </div>
          {link.expires_at && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Expires
              </span>
              <span className="font-medium text-foreground">
                {new Date(link.expires_at).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Created</span>
            <span className="font-medium text-foreground">
              {new Date(link.created_at).toLocaleDateString()}
            </span>
          </div>
          {link.last_clicked_at && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <ArrowUpRight className="h-3 w-3" />
                Last click
              </span>
              <span className="font-medium text-foreground">
                {new Date(link.last_clicked_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(link.id)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onGenerateQr(link.id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <QrCode className="h-3 w-3" />
            QR
          </button>
        </div>
      </div>
    </div>
  )
}
