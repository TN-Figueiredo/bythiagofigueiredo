'use client'

import { GemCard, type GemCardItem } from './gem-card'

interface CollectionData {
  id: string
  code: string
  name: string | null
  type: string
  description: string | null
}

interface Props {
  collection: CollectionData
  members: GemCardItem[]
}

export function CollectionDetail({ collection, members }: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4" style={{ backgroundColor: 'var(--gem-surface)', borderColor: 'var(--gem-border)' }}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xs font-mono" style={{ color: 'var(--gem-muted)' }}>{collection.code}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--gem-well)', color: 'var(--gem-dim)' }}>{collection.type}</span>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--gem-text)' }}>{collection.name ?? collection.code}</p>
        {collection.description && <p className="text-xs mt-1" style={{ color: 'var(--gem-muted)' }}>{collection.description}</p>}
        <p className="text-[10px] mt-2" style={{ color: 'var(--gem-dim)' }}>{members.length} items</p>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {members.map((item) => (<GemCard key={item.id} item={item} />))}
      </div>

      {members.length === 0 && <p className="text-xs" style={{ color: 'var(--gem-faint)' }}>No items in this collection</p>}
    </div>
  )
}
