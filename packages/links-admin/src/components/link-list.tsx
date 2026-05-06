'use client'
import { useState, useCallback } from 'react'
import {
  Copy,
  Check,
  Pencil,
  Pause,
  Play,
  Trash2,
  ExternalLink,
  Link2,
} from 'lucide-react'
import type { LinkSummary } from '../types'

export interface LinkListProps {
  links: LinkSummary[]
  onSelect: (id: string) => void
  onToggleActive: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  selectedId: string | null
}

const SOURCE_COLORS: Record<string, string> = {
  manual: 'bg-gray-500/10 text-gray-400',
  campaign: 'bg-blue-500/10 text-blue-400',
  newsletter: 'bg-purple-500/10 text-purple-400',
  blog: 'bg-green-500/10 text-green-400',
  social: 'bg-pink-500/10 text-pink-400',
  print: 'bg-amber-500/10 text-amber-400',
}

function StatusBadge({ active, expiresAt }: { active: boolean; expiresAt: string | null }) {
  const isExpired = !!(expiresAt && new Date(expiresAt) < new Date())

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        <span className="text-amber-500">Expired</span>
      </span>
    )
  }
  if (!active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        <span className="text-muted-foreground">Paused</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      <span className="text-green-400">Active</span>
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [text])

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        handleCopy()
      }}
      className="rounded p-0.5 text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:text-foreground"
      title="Copy short URL"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

function truncateUrl(url: string, max = 45): string {
  try {
    const u = new URL(url)
    const display = u.hostname + u.pathname
    return display.length > max ? display.slice(0, max) + '…' : display
  } catch {
    return url.length > max ? url.slice(0, max) + '…' : url
  }
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function LinkList({
  links,
  onSelect,
  onToggleActive,
  onDelete,
  onEdit,
  selectedId,
}: LinkListProps) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/50 px-6 py-14">
        <Link2 className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No links found</p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          Create your first short link to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Link
            </th>
            <th className="hidden px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground md:table-cell">
              Destination
            </th>
            <th className="px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Clicks
            </th>
            <th className="hidden px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:table-cell">
              Source
            </th>
            <th className="px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="hidden px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:table-cell">
              Last Click
            </th>
            <th className="w-[100px] px-4 py-2.5 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {links.map((link) => (
            <tr
              key={link.id}
              className={`group/row cursor-pointer transition-colors hover:bg-muted/30 ${
                selectedId === link.id ? 'bg-indigo-500/5' : ''
              }`}
              onClick={() => onSelect(link.id)}
            >
              {/* Link */}
              <td className="px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-foreground line-clamp-1">
                    {link.title || `/${link.code}`}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="font-mono">/{link.code}</span>
                    {link.slug && (
                      <>
                        <span className="text-border">&middot;</span>
                        <span className="font-mono">/{link.slug}</span>
                      </>
                    )}
                    <CopyButton text={`/go/${link.code}`} />
                  </div>
                </div>
              </td>

              {/* Destination */}
              <td className="hidden px-4 py-3 md:table-cell">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="max-w-[280px] truncate">
                    {truncateUrl(link.destination_url)}
                  </span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-40" />
                </div>
              </td>

              {/* Clicks */}
              <td className="px-4 py-3 text-right">
                <span className="font-semibold tabular-nums text-foreground">
                  {link.total_clicks.toLocaleString()}
                </span>
                {link.unique_visitors > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    {link.unique_visitors.toLocaleString()} unique
                  </div>
                )}
              </td>

              {/* Source */}
              <td className="hidden px-4 py-3 sm:table-cell">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                    SOURCE_COLORS[link.source_type] ?? SOURCE_COLORS.manual
                  }`}
                >
                  {link.source_type}
                </span>
              </td>

              {/* Status */}
              <td className="px-4 py-3 text-center">
                <StatusBadge active={link.active} expiresAt={link.expires_at} />
              </td>

              {/* Last Click */}
              <td className="hidden px-4 py-3 text-right text-[10px] text-muted-foreground lg:table-cell">
                {timeAgo(link.last_clicked_at)}
              </td>

              {/* Actions */}
              <td className="px-4 py-3">
                <div
                  className="flex items-center justify-end gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onEdit(link.id)}
                    className="rounded p-1.5 text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-muted hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleActive(link.id)}
                    className="rounded p-1.5 text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-muted hover:text-foreground"
                    title={link.active ? 'Pause' : 'Activate'}
                  >
                    {link.active ? (
                      <Pause className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(link.id)}
                    className="rounded p-1.5 text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
