import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { listPlaylists, getPlaylistItemCounts } from '@/lib/playlists/queries'

export async function GET() {
  try {
    const { siteId } = await getSiteContext()
    const [playlists, counts] = await Promise.all([
      listPlaylists(siteId),
      getPlaylistItemCounts(siteId),
    ])

    return NextResponse.json(
      playlists.map(p => ({
        id: p.id,
        name_pt: p.name_pt,
        name_en: p.name_en,
        slug: p.slug,
        status: p.status,
        category: p.category,
        item_count: counts.get(p.id) ?? 0,
      })),
    )
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
