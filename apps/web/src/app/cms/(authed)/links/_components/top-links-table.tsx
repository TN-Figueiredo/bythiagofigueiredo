'use client'

import { SOURCE_COLORS, type SourceId } from '@tn-figueiredo/links-admin'

interface TopLink {
  id: string
  title: string
  slug: string
  clicks: number
  source: SourceId
}

interface TopLinksTableProps {
  links: TopLink[]
}

export function TopLinksTable({ links }: TopLinksTableProps) {
  if (links.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum link encontrado.</p>
  }
  return (
    <div className="flex flex-col gap-1">
      {links.map((l, i) => (
        <div
          key={l.id}
          data-link-row
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
        >
          <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{i + 1}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: SOURCE_COLORS[l.source] || '#8A8F98' }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{l.title}</div>
            <div className="font-mono text-[10px] text-muted-foreground truncate">{l.slug}</div>
          </div>
          <span className="font-mono text-sm font-bold text-foreground">{l.clicks.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
