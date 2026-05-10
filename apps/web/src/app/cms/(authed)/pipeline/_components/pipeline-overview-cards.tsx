'use client'

import Link from 'next/link'
import { getPlaylistColor } from '@/lib/pipeline/colors'

interface CollectionStats {
  id: string
  code: string
  name: string
  total: number
  byFormat: Record<string, number>
  byStage: Record<string, number>
}

const PLAYLIST_ICONS: Record<string, string> = {
  'playlist-a': '📖',
  'playlist-b': '🎮',
  'playlist-c': '🚀',
  'playlist-e': '🌍',
  'playlist-f': '💪',
  'playlist-g': '🤖',
}

const FORMAT_LABELS: Record<string, string> = {
  video: 'vídeos',
  blog_post: 'artigos',
  newsletter: 'newsletters',
  course: 'cursos',
  campaign: 'campanhas',
}

export function PipelineOverviewCards({ collections }: { collections: CollectionStats[] }) {
  const totalItems = collections.reduce((sum, c) => sum + c.total, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {collections.map((c) => {
          const colors = getPlaylistColor(c.code)
          const icon = PLAYLIST_ICONS[c.code] ?? '📂'
          const letter = c.code.replace('playlist-', '').toUpperCase()

          const formatSummary = Object.entries(c.byFormat)
            .sort(([, a], [, b]) => b - a)
            .map(([f, n]) => `${n} ${FORMAT_LABELS[f] || f}`)

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
                  </div>
                  <p className="text-sm font-medium text-slate-200">{c.name}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{c.total}</p>
              <div className="mt-1 space-y-0.5">
                {formatSummary.slice(0, 2).map((s) => (
                  <p key={s} className="text-xs" style={{ color: colors.text, opacity: 0.7 }}>{s}</p>
                ))}
              </div>
            </Link>
          )
        })}
      </div>
      <div className="text-sm text-slate-400">
        Total: {totalItems} items across {collections.length} collections
      </div>
    </div>
  )
}
