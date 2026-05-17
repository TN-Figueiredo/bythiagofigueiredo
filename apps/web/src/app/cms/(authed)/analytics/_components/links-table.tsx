'use client'

import { useState, useMemo } from 'react'
import type { LinkRow } from '@/lib/analytics/links-queries'

interface Props {
  links: LinkRow[]
}

export function LinksTable({ links }: Props) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'clicks' | 'uniqueClicks'>('clicks')

  const filtered = useMemo(() => {
    let result = links
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(l => l.code.toLowerCase().includes(q) || l.source.toLowerCase().includes(q))
    }
    return result.sort((a, b) => b[sortBy] - a[sortBy])
  }, [links, search, sortBy])

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-cms-text">Links</h3>
        <div className="ml-auto flex gap-2">
          <input
            type="search"
            placeholder="Search links…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text placeholder:text-cms-text-muted"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'clicks' | 'uniqueClicks')}
            className="rounded border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text"
          >
            <option value="clicks">Sort: Clicks</option>
            <option value="uniqueClicks">Sort: Unique</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-cms-border text-left text-cms-text-muted">
              <th scope="col" className="sticky left-0 bg-cms-surface pb-2 pr-4 font-medium">Link</th>
              <th scope="col" className="pb-2 font-medium">Source</th>
              <th scope="col" className="pb-2 text-right font-medium">Clicks</th>
              <th scope="col" className="pb-2 text-right font-medium">Unique</th>
              <th scope="col" className="pb-2 text-right font-medium">Country</th>
              <th scope="col" className="pb-2 text-right font-medium">Device</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((link) => (
              <tr key={link.id} className="border-b border-cms-border/50 hover:bg-cms-bg/40">
                <td className="sticky left-0 bg-cms-surface py-2 pr-4 font-medium text-cms-text">{link.code}</td>
                <td className="py-2 text-cms-text-muted">{link.source}</td>
                <td className="py-2 text-right tabular-nums font-bold text-cms-text">{link.clicks.toLocaleString()}</td>
                <td className="py-2 text-right tabular-nums text-cms-text-muted">{link.uniqueClicks.toLocaleString()}</td>
                <td className="py-2 text-right text-cms-text-muted">{link.topCountry}</td>
                <td className="py-2 text-right text-cms-text-muted">{link.topDevice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
