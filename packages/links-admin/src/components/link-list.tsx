'use client'
import { useState, useMemo } from 'react'
import type { LinkSummary } from '../types'

export interface LinkListProps {
  links: LinkSummary[]
  onSelect: (id: string) => void
  onToggleActive: (id: string) => void
  onDelete: (id: string) => void
  selectedId: string | null
}

function truncateUrl(url: string, max = 40): string {
  if (url.length <= max) return url
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    const domain = u.hostname
    const available = max - domain.length - 3
    if (available <= 0) return domain.slice(0, max - 3) + '...'
    return domain + path.slice(0, available) + '...'
  } catch {
    return url.slice(0, max) + '...'
  }
}

function StatusBadge({ active, expiresAt }: { active: boolean; expiresAt: string | null }) {
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return (
      <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
        Expired
      </span>
    )
  }
  if (!active) {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">
        Paused
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
      Active
    </span>
  )
}

export function LinkList({
  links,
  onSelect,
  onToggleActive,
  onDelete,
  selectedId,
}: LinkListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let result = links
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.code.toLowerCase().includes(q) ||
          l.destination_url.toLowerCase().includes(q),
      )
    }
    return result
  }, [links, search])

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search links..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No links found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Title / Code</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Destination</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Clicks</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Source</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((link) => (
                <tr
                  key={link.id}
                  className={`cursor-pointer hover:bg-gray-50 ${
                    selectedId === link.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => onSelect(link.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{link.title || link.code}</div>
                    <div className="text-xs text-gray-500">{link.code}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {truncateUrl(link.destination_url)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{link.total_clicks}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                      {link.source_type}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge active={link.active} expiresAt={link.expires_at} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label="Copy short URL"
                        onClick={() => navigator.clipboard?.writeText(`/go/${link.code}`)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        aria-label="Toggle active"
                        onClick={() => onToggleActive(link.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        aria-label="Delete link"
                        onClick={() => onDelete(link.id)}
                        className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        Delete
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
