'use client'

import { type SourceId } from '@tn-figueiredo/links-admin'
import { fmt } from './fmt'

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
    return <p style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--ink-faint)' }}>Nenhum link encontrado.</p>
  }

  const max = Math.max(...links.map(l => l.clicks), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {links.map((l, i) => (
        <button
          key={l.id}
          type="button"
          data-link-row
          onClick={() => window.location.href = l.id === 'linktree' ? '/cms/links?tab=tree' : `/cms/links/${l.id}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 6px', border: 'none', background: 'transparent',
            borderRadius: 8, textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-faint)', width: 16 }}>
            {i + 1}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {l.title}
            </div>
            <div className="mono" style={{ fontSize: '10.5px', color: 'var(--ink-faint)' }}>
              {l.slug}
            </div>
          </div>
          <div style={{ width: 120, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ width: `${(l.clicks / max) * 100}%`, height: '100%', background: 'var(--accent)', borderRadius: 99 }} />
          </div>
          <span className="mono" style={{ width: 56, textAlign: 'right', fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
            {fmt(l.clicks)}
          </span>
        </button>
      ))}
    </div>
  )
}
