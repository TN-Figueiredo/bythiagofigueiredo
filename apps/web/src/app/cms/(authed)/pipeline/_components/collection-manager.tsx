'use client'

import Link from 'next/link'

interface CollectionData {
  id: string
  code: string
  name: string
  type: string
  description: string | null
  memberCount: number
  progress: number
  nextItem: { code: string; title: string } | null
}

export function CollectionManager({ collections }: { collections: CollectionData[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {collections.map((c) => {
        const progressPct = c.memberCount > 0 ? Math.round((c.progress / c.memberCount) * 100) : 0
        return (
          <Link key={c.id} href={`/cms/pipeline/collections/${c.id}`} className="block rounded-lg border p-4 transition-all hover:brightness-110" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono" style={{ color: 'var(--gem-muted)' }}>{c.code}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{c.type}</span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--gem-text)' }}>{c.name}</p>
            {c.description && <p className="text-[10px] line-clamp-2 mb-2" style={{ color: 'var(--gem-muted)' }}>{c.description}</p>}
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--gem-well)' }}>
                <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: 'var(--gem-done)', boxShadow: '0 0 4px rgba(16,185,129,0.3)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>{c.progress}/{c.memberCount}</span>
            </div>
            {c.nextItem && <p className="text-[10px]" style={{ color: 'var(--gem-dim)' }}>Próximo: <span style={{ color: 'var(--gem-muted)' }}>{c.nextItem.code}</span> — {c.nextItem.title}</p>}
          </Link>
        )
      })}
      {collections.length === 0 && <p className="text-xs col-span-full" style={{ color: 'var(--gem-faint)' }}>No collections yet</p>}
    </div>
  )
}
