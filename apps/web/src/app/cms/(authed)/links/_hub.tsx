'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { deleteLink, toggleLinkActive } from './actions'

interface LinkRow {
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
  updated_at: string
}

interface DashboardKpis {
  totalLinks: number
  activeLinks: number
  totalClicks: number
  topPerformer: { code: string; clicks: number } | null
}

interface LinksHubProps {
  metrics: DashboardKpis
  links: unknown[]
  siteId: string
}

export function LinksHub({ metrics, links, siteId: _siteId }: LinksHubProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const typedLinks: LinkRow[] = (links as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    code: l.code as string,
    slug: (l.slug as string) ?? null,
    title: (l.title as string) ?? null,
    destination_url: l.destination_url as string,
    source_type: (l.source_type as string) ?? 'manual',
    tags: (l.tags as string[]) ?? [],
    active: (l.active as boolean) ?? true,
    redirect_type: (l.redirect_type as number) ?? 302,
    expires_at: (l.expires_at as string) ?? null,
    total_clicks: (l.total_clicks as number) ?? 0,
    unique_visitors: (l.unique_visitors as number) ?? 0,
    last_clicked_at: (l.last_clicked_at as string) ?? null,
    created_at: l.created_at as string,
    updated_at: l.updated_at as string,
  }))

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteLink(id)
      router.refresh()
    })
  }

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleLinkActive(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Links" value={metrics.totalLinks} />
        <KpiCard label="Total Clicks" value={metrics.totalClicks} />
        <KpiCard label="Active Links" value={metrics.activeLinks} />
        <KpiCard
          label="Top Performer"
          value={metrics.topPerformer ? `/${metrics.topPerformer.code}` : '—'}
          sub={metrics.topPerformer ? `${metrics.topPerformer.clicks} clicks` : undefined}
        />
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1" />
        <button
          onClick={() => router.push('/cms/links/new')}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Create Link
        </button>
      </div>

      {/* Links table */}
      {typedLinks.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No links yet. Create your first short link to get started.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Link</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Destination</th>
                <th className="px-4 py-3 text-right font-medium">Clicks</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {typedLinks.map((link) => (
                <tr
                  key={link.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/cms/links/${link.id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{link.title || `/${link.code}`}</div>
                    <div className="text-xs text-muted-foreground">/{link.code}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="truncate max-w-[300px] text-muted-foreground">
                      {link.destination_url}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {link.total_clicks.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        link.active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {link.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleToggle(link.id)}
                        disabled={isPending}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title={link.active ? 'Deactivate' : 'Activate'}
                      >
                        {link.active ? '⏸' : '▶'}
                      </button>
                      <button
                        onClick={() => router.push(`/cms/links/${link.id}/edit`)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(link.id)}
                        disabled={isPending}
                        className="rounded p-1.5 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition-colors"
                        title="Delete"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
