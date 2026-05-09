'use client'

import Link from 'next/link'

interface CollectionData {
  id: string
  code: string
  name: string
  type: string
  position: number
  content_pipeline_memberships: Array<{ count: number }>
}

export function CollectionManager({ collections }: { collections: CollectionData[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {collections.map((c) => {
        const memberCount = c.content_pipeline_memberships?.[0]?.count ?? 0
        return (
          <Link
            key={c.id}
            href={`/cms/pipeline/collections/${c.id}`}
            className="block rounded-lg border border-slate-700 bg-slate-800 p-4 hover:border-indigo-500 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">{c.type}</span>
              <span className="text-xs text-slate-500 font-mono">{c.code}</span>
            </div>
            <p className="text-sm font-medium text-slate-200">{c.name}</p>
            <p className="text-xs text-slate-500 mt-1">{memberCount} items</p>
          </Link>
        )
      })}
      {collections.length === 0 && (
        <p className="text-slate-500 text-sm col-span-full">No collections yet</p>
      )}
    </div>
  )
}
