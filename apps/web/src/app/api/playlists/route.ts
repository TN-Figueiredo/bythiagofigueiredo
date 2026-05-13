import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { listPlaylists, getPlaylistItemCounts } from '@/lib/playlists/queries'

export async function GET() {
  const { siteId } = await getSiteContext()
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!auth.ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const [playlists, counts] = await Promise.all([
    listPlaylists(siteId),
    getPlaylistItemCounts(siteId),
  ])

  return NextResponse.json({
    data: playlists.map(p => ({
      id: p.id,
      name_pt: p.name_pt,
      name_en: p.name_en,
      slug: p.slug,
      status: p.status,
      category: p.category,
      description_pt: p.description_pt,
      description_en: p.description_en,
      item_count: counts.get(p.id) ?? 0,
    })),
  })
}
