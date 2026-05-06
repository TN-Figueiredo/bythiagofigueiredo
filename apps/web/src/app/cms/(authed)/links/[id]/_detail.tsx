'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
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
  pulseEnabled: boolean
  linkId: string
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

  function copyToClipboard() {
    const url = `${window.location.origin}/go/${link.code}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{link.title || `/${link.code}`}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                link.active
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {link.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">/{link.code}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
            title="Copy short URL"
          >
            Copy URL
          </button>
          <button
            onClick={() => router.push(`/cms/links/${linkId}/edit`)}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => router.push(`/cms/links/${linkId}/qr`)}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            QR Code
          </button>
          <button
            onClick={handleToggle}
            disabled={isPending}
            className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {link.active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Destination */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-xs font-medium text-muted-foreground mb-1">Destination</div>
        <a
          href={link.destination_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {link.destination_url}
        </a>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Total Clicks</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{link.total_clicks.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Last 30 Days</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{periodClicks.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Unique Visitors</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{periodUnique.toLocaleString()}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Top Country</div>
          <div className="mt-1 text-2xl font-bold">{topCountry || '—'}</div>
        </div>
      </div>

      {/* Mini chart (sparkline using CSS bars) */}
      {dailyClicks.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <div className="text-sm font-medium mb-3">Last 30 Days</div>
          <div className="flex items-end gap-px h-24">
            {dailyClicks.map((d, i) => {
              const max = Math.max(...dailyClicks.map((x) => x.clicks), 1)
              const height = Math.max((d.clicks / max) * 100, 2)
              return (
                <div
                  key={i}
                  className="flex-1 bg-blue-500 dark:bg-blue-400 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                  style={{ height: `${height}%` }}
                  title={`${d.date}: ${d.clicks} clicks`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-medium mb-3">Details</div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="font-medium capitalize">{link.source_type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Redirect</dt>
            <dd className="font-medium">{link.redirect_type}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="font-medium">{new Date(link.created_at).toLocaleDateString()}</dd>
          </div>
          {link.expires_at && (
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd className="font-medium">{new Date(link.expires_at).toLocaleDateString()}</dd>
            </div>
          )}
          {link.tags.length > 0 && (
            <div className="col-span-2">
              <dt className="text-muted-foreground mb-1">Tags</dt>
              <dd className="flex gap-1 flex-wrap">
                {link.tags.map((t) => (
                  <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs">{t}</span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Deep analytics link */}
      <div className="flex justify-center">
        <button
          onClick={() => router.push(`/cms/links/${linkId}/analytics`)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View Full Analytics →
        </button>
      </div>
    </div>
  )
}
