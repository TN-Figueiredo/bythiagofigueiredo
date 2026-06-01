import { NextResponse } from 'next/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')
  if (!query || query.length < 2) return NextResponse.json({ results: [] })

  try {
    const { siteId } = await getSiteContext()
    const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
    if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return NextResponse.json({ results: [] })

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  )

  if (!res.ok) return NextResponse.json({ results: [] })

  const data = await res.json()
  const results = (data.items ?? []).map((item: Record<string, unknown>) => {
    const snippet = item.snippet as Record<string, unknown> | undefined
    const id = item.id as Record<string, unknown> | undefined
    const thumbnails = snippet?.thumbnails as Record<string, unknown> | undefined
    const defaultThumb = thumbnails?.default as Record<string, unknown> | undefined
    return {
      channelId: (snippet?.channelId as string) ?? (id?.channelId as string) ?? '',
      name: (snippet?.title as string) ?? '',
      thumbnail: (defaultThumb?.url as string) ?? null,
      description: ((snippet?.description as string) ?? '').slice(0, 100),
    }
  })

  return NextResponse.json({ results })
}
