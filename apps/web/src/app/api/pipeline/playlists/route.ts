import { NextResponse, type NextRequest } from 'next/server'
import { authenticatePipeline, getRateLimitHeaders } from '@/lib/pipeline/auth'
import { listPlaylists, getPlaylistItemCounts } from '@/lib/playlists/queries'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  const { auth } = authResult
  const headers = auth.keyHash ? getRateLimitHeaders(auth.keyHash) : {}

  const [playlists, counts] = await Promise.all([
    listPlaylists(auth.siteId),
    getPlaylistItemCounts(auth.siteId),
  ])

  return NextResponse.json({
    data: playlists.map(p => ({
      id: p.id,
      name_pt: p.name_pt,
      name_en: p.name_en,
      slug: p.slug,
      status: p.status,
      category: p.category,
      cover_image_url: p.cover_image_url,
      item_count: counts.get(p.id) ?? 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  }, { headers })
}
