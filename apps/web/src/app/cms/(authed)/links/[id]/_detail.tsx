'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback, useTransition } from 'react'
import {
  MousePointerClick,
  Users,
  Globe,
  TrendingUp,
  Pencil,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  Tag,
  Clock,
  ArrowUpRight,
  Trash2,
  Pause,
  Play,
  BarChart3,
} from 'lucide-react'
import { deleteLink, toggleLinkActive } from '../actions'

interface LinkData {
  id: string
  code: string
  slug: string | null
  title: string | null
  destination_url: string
  source_type: string
  tags: string[]
  active: boolean
  redirect_type: number
  expires_at: string | null
  total_clicks: number
  unique_visitors: number
  last_clicked_at: string | null
  created_at: string
}

interface DailyClick {
  date: string
  clicks: number
  unique: number
}

interface Props {
  link: LinkData
  dailyClicks: DailyClick[]
  topCountry: string | null
  linkId: string
}

const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-500/10 text-gray-400',
  campaign: 'bg-blue-500/10 text-blue-400',
  newsletter: 'bg-purple-500/10 text-purple-400',
  blog: 'bg-green-500/10 text-green-400',
  social: 'bg-pink-500/10 text-pink-400',
  print: 'bg-amber-500/10 text-amber-400',
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString()
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [url])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copied!' : 'Copy URL'}
    </button>
  )
}

function KpiCard({
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
    <div className="rounded-[10px] border border-border bg-card p-4 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentClass}`}
        >
          {icon}
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-extrabold tabular-nums text-foreground">
            {typeof value === 'number' ? formatCompact(value) : value}
          </p>
        </div>
      </div>
    </div>
  )
}

export function LinkDetail({ link, dailyClicks, topCountry, linkId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const periodClicks = dailyClicks.reduce((s, m) => s + m.clicks, 0)
  const periodUnique = dailyClicks.reduce((s, m) => s + m.unique, 0)

  function handleDelete() {
    if (!confirm('Delete this link? This action cannot be undone.')) return
    startTransition(async () => {
      await deleteLink(link.id)
      router.push('/cms/links')
    })
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleLinkActive(link.id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground">
              {link.title || `/${link.code}`}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${
                link.active ? 'text-green-400' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${link.active ? 'bg-green-500' : 'bg-muted-foreground/50'}`}
              />
              {link.active ? 'Active' : 'Inactive'}
            </span>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                SOURCE_COLORS[link.source_type] ?? SOURCE_COLORS.manual
              }`}
            >
              {link.source_type}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm text-muted-foreground">/{link.code}</p>
        </div>

        <div className="flex items-center gap-2">
          <CopyUrlButton url={`${typeof window !== 'undefined' ? window.location.origin : ''}/go/${link.code}`} />
          <button
            type="button"
            onClick={() => router.push(`/cms/links/${linkId}/edit`)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => router.push(`/cms/links/${linkId}/qr`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <QrCode className="h-3.5 w-3.5" />
            QR
          </button>
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {link.active ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {link.active ? 'Pause' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* Destination card */}
      <div className="rounded-[10px] border border-border bg-card p-4">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Destination
        </div>
        <a
          href={link.destination_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-indigo-400 transition-colors hover:text-indigo-300"
        >
          <span className="break-all">{link.destination_url}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<MousePointerClick className="h-4 w-4 text-indigo-400" />}
          label="Total Clicks"
          value={link.total_clicks}
          accentClass="bg-indigo-500/10"
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4 text-green-400" />}
          label="Last 30 Days"
          value={periodClicks}
          accentClass="bg-green-500/10"
        />
        <KpiCard
          icon={<Users className="h-4 w-4 text-sky-400" />}
          label="Unique Visitors"
          value={periodUnique}
          accentClass="bg-sky-500/10"
        />
        <KpiCard
          icon={<Globe className="h-4 w-4 text-purple-400" />}
          label="Top Country"
          value={topCountry || '—'}
          accentClass="bg-purple-500/10"
        />
      </div>

      {/* Sparkline chart */}
      {dailyClicks.length > 0 && (
        <div className="rounded-[10px] border border-border bg-card p-4">
          <div className="mb-3 text-[11px] font-semibold text-foreground">
            Click Trend (30 days)
          </div>
          <div className="flex items-end gap-px" style={{ height: '96px' }}>
            {dailyClicks.map((d, i) => {
              const max = Math.max(...dailyClicks.map((x) => x.clicks), 1)
              const height = Math.max((d.clicks / max) * 100, 2)
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t-sm bg-indigo-500/70 transition-opacity hover:bg-indigo-400"
                  style={{ height: `${height}%` }}
                  title={`${d.date}: ${d.clicks} clicks`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Details section */}
      <div className="rounded-[10px] border border-border bg-card p-4">
        <div className="mb-3 text-[11px] font-semibold text-foreground">Details</div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" />
              Redirect
            </span>
            <span className="font-mono font-medium text-foreground">{link.redirect_type}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              Created
            </span>
            <span className="font-medium text-foreground">
              {new Date(link.created_at).toLocaleDateString()}
            </span>
          </div>
          {link.expires_at && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Expires
              </span>
              <span className="font-medium text-foreground">
                {new Date(link.expires_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {link.last_clicked_at && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MousePointerClick className="h-3 w-3" />
                Last click
              </span>
              <span className="font-medium text-foreground">
                {new Date(link.last_clicked_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {link.tags.length > 0 && (
            <div className="pt-1">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Tag className="h-3 w-3" />
                Tags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {link.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[10px] font-medium text-indigo-400"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Analytics deep link */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => router.push(`/cms/links/${linkId}/analytics`)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 transition-colors hover:text-indigo-300"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          View Full Analytics
        </button>
      </div>
    </div>
  )
}
