import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { BlogHealthData } from './dashboard-blog-health'

export const fetchDashboardBlogHealth = unstable_cache(
  async (siteId: string): Promise<BlogHealthData | null> => {
    const supabase = getSupabaseServiceClient()

    const { data: posts } = await supabase
      .from('blog_posts')
      .select('id, status, tag_id, created_at, published_at, blog_tags(name, color), blog_translations(reading_time_min)')
      .eq('site_id', siteId)

    if (!posts || posts.length === 0) return null

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000

    const published = posts.filter((p) => p.status === 'published')
    const drafts = posts.filter((p) => p.status === 'idea' || p.status === 'draft' || p.status === 'pending_review')

    const publishedRecent = published.filter((p) => p.published_at && new Date(p.published_at).getTime() > thirtyDaysAgo)
    const publishedPrev = published.filter((p) => p.published_at && new Date(p.published_at).getTime() > sixtyDaysAgo && new Date(p.published_at).getTime() <= thirtyDaysAgo)

    const readingTimes = posts.flatMap((p) => {
      const trans = p.blog_translations as Array<{ reading_time_min: number | null }> | null
      return trans?.map((t) => t.reading_time_min).filter((r): r is number => r != null) ?? []
    })
    const avgReading = readingTimes.length > 0 ? Math.round(readingTimes.reduce((a, b) => a + b, 0) / readingTimes.length) : 0

    const tagMap = new Map<string, { name: string; color: string; count: number }>()
    for (const p of posts) {
      const tag = p.blog_tags as unknown as { name: string; color: string } | null
      const key = tag?.name ?? 'Untagged'
      const existing = tagMap.get(key)
      if (existing) {
        existing.count++
      } else {
        tagMap.set(key, { name: key, color: tag?.color ?? '#475569', count: 1 })
      }
    }

    // 8-week velocity sparkline
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const sparkline: number[] = []
    for (let w = 7; w >= 0; w--) {
      const weekStart = now - (w + 1) * weekMs
      const weekEnd = now - w * weekMs
      sparkline.push(
        published.filter((p) => p.published_at && new Date(p.published_at).getTime() >= weekStart && new Date(p.published_at).getTime() < weekEnd).length,
      )
    }

    const recentPubs = published
      .filter((p) => p.published_at)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
      .slice(0, 5)

    const pctChange = (current: number, previous: number) =>
      previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100

    return {
      totalPosts: posts.length,
      totalPostsTrend: 0,
      published: published.length,
      publishedTrend: pctChange(publishedRecent.length, publishedPrev.length),
      avgReadingTime: avgReading,
      avgReadingTimeTrend: 0,
      draftBacklog: drafts.length,
      draftBacklogTrend: 0,
      tagBreakdown: Array.from(tagMap.values())
        .sort((a, b) => b.count - a.count)
        .map((t) => ({ tagName: t.name, tagColor: t.color, count: t.count })),
      velocitySparkline: sparkline,
      recentPublications: recentPubs.map((p) => {
        const tag = p.blog_tags as unknown as { name: string; color: string } | null
        return {
          id: p.id,
          title: `Post ${p.id.slice(0, 8)}`,
          tagName: tag?.name ?? null,
          tagColor: tag?.color ?? null,
          publishedAt: p.published_at!,
        }
      }),
    }
  },
  ['dashboard-blog-health'],
  { tags: ['dashboard', 'blog-health'], revalidate: 120 },
)
