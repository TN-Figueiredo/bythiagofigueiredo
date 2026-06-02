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

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=5&key=${apiKey}`,
    { signal: AbortSignal.timeout(10_000) },
  )

  if (!searchRes.ok) return NextResponse.json({ results: [] })

  const searchData = await searchRes.json()
  const items = (searchData.items ?? []) as Array<Record<string, unknown>>

  // Extract channel IDs and basic info from search results
  const basics = items.map((item) => {
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

  const channelIds = basics.map(b => b.channelId).filter(Boolean)

  // Enrich with channel handles + subscriber counts (channels.list = 1 quota unit)
  const handleMap = new Map<string, { handle: string | null; subscriberCount: number | null }>()
  if (channelIds.length > 0) {
    try {
      const channelsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIds.join(',')}&key=${apiKey}`,
        { signal: AbortSignal.timeout(8_000) },
      )
      if (channelsRes.ok) {
        const channelsData = await channelsRes.json()
        for (const ch of (channelsData.items ?? []) as Array<Record<string, unknown>>) {
          const chSnippet = ch.snippet as Record<string, unknown> | undefined
          const chStats = ch.statistics as Record<string, unknown> | undefined
          const chId = ch.id as string
          const customUrl = (chSnippet?.customUrl as string) ?? null
          const subCount = chStats?.subscriberCount ? Number(chStats.subscriberCount) : null
          handleMap.set(chId, { handle: customUrl, subscriberCount: subCount })
        }
      }
    } catch {
      // Graceful fallback — search results still work without handles
    }
  }

  const results = basics.map(b => {
    const extra = handleMap.get(b.channelId)
    return {
      ...b,
      handle: extra?.handle ?? null,
      subscriberCount: extra?.subscriberCount ?? null,
    }
  })

  return NextResponse.json({ results })
}
