'use client'

import Link from 'next/link'
import { getPlaylistColor } from '@/lib/pipeline/colors'

interface CollectionData {
  id: string
  code: string
  name: string
  type: string
  position: number
  content_pipeline_memberships: Array<{ count: number }>
}

const PLAYLIST_ICONS: Record<string, string> = {
  'playlist-a': '📖',
  'playlist-b': '🎮',
  'playlist-c': '🚀',
  'playlist-e': '🌍',
  'playlist-f': '💪',
  'playlist-g': '🤖',
}

export function CollectionManager({ collections }: { collections: CollectionData[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {collections.map((c) => {
        const memberCount = c.content_pipeline_memberships?.[0]?.count ?? 0
        const colors = getPlaylistColor(c.code)
        const icon = PLAYLIST_ICONS[c.code] ?? '📂'
        const letter = c.code.replace('playlist-', '').toUpperCase()
        return (
          <Link
            key={c.id}
            href={`/cms/pipeline/collections/${c.id}`}
            className="block rounded-lg border p-5 transition-all hover:brightness-110 hover:scale-[1.02]"
            style={{ borderColor: colors.border, backgroundColor: colors.bg }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold" style={{ color: colors.text }}>{letter}</span>
                  <span className="text-xs text-slate-500 font-mono">{c.code}</span>
                </div>
                <p className="text-sm font-medium text-slate-200">{c.name}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: colors.text, opacity: 0.8 }}>
                {memberCount} items
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.border, color: colors.text }}
              >
                {c.type}
              </span>
            </div>
          </Link>
        )
      })}
      {collections.length === 0 && (
        <p className="text-slate-500 text-sm col-span-full">No collections yet</p>
      )}
    </div>
  )
}
