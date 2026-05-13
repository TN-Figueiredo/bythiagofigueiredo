import { notFound } from 'next/navigation'
import Link from 'next/link'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { listPlaylists, getPlaylistItemCounts } from '@/lib/playlists/queries'
import type { PlaylistRow, PlaylistStatus } from '@/lib/playlists/types'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'published', label: 'Published' },
  { key: 'archived', label: 'Archived' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default async function PlaylistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const ctx = await tryGetSiteContext()
  if (!ctx) notFound()

  const params = await searchParams
  const tab = (params.tab ?? 'all') as TabKey
  const status = tab === 'all' ? undefined : tab

  const [playlists, itemCounts] = await Promise.all([
    listPlaylists(ctx.siteId, status ? { status } : undefined),
    getPlaylistItemCounts(ctx.siteId),
  ])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Playlists</h1>
        <Link
          href="/cms/playlists/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New Playlist
        </Link>
      </div>

      <div className="flex gap-1 border-b border-white/10 pb-px">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/cms/playlists${t.key === 'all' ? '' : `?tab=${t.key}`}`}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white/5 text-white'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/40">
          <p className="text-lg">No playlists yet</p>
          <p className="mt-1 text-sm">Create your first playlist to start organizing content</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map(playlist => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              itemCount={itemCounts.get(playlist.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaylistCard({
  playlist,
  itemCount,
}: {
  playlist: PlaylistRow
  itemCount: number
}) {
  const statusColors: Record<PlaylistStatus, string> = {
    draft: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
  }

  return (
    <Link
      href={`/cms/playlists/${playlist.id}`}
      className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-white group-hover:text-indigo-300">
          {playlist.name_en || playlist.name_pt}
        </h3>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusColors[playlist.status]}`}
        >
          {playlist.status}
        </span>
      </div>

      {(playlist.description_en || playlist.description_pt) && (
        <p className="mt-2 line-clamp-2 text-sm text-white/50">
          {playlist.description_en || playlist.description_pt}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-white/30">
        <span>{itemCount} items</span>
        {playlist.category && <span>{playlist.category}</span>}
        <span className="ml-auto">
          {new Date(playlist.updated_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}
