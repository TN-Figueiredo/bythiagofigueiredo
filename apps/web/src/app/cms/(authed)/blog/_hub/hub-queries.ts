import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { BlogHubSharedData, BlogTag, PostCard, OverviewTabData, EditorialTabData, ScheduleTabData, ScheduleSlot, BlogCadenceConfig } from './hub-types'
import { computeDisplayId } from './hub-utils'
import { generateSlots } from '@tn-figueiredo/newsletter'

export const fetchBlogSharedData = unstable_cache(
  async (siteId: string): Promise<BlogHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const [tagsResult, siteResult, badgeResult] = await Promise.all([
      supabase
        .from('blog_tags')
        .select('id, name, slug, color, color_dark, badge, sort_order')
        .eq('site_id', siteId)
        .order('sort_order'),
      supabase
        .from('sites')
        .select('name, timezone, default_locale, supported_locales')
        .eq('id', siteId)
        .single(),
      supabase
        .from('blog_posts')
        .select('id, tag_id, status, created_at')
        .eq('site_id', siteId),
    ])

    const allPosts = badgeResult.data ?? []

    const tagCountMap = new Map<string, number>()
    let staleDrafts = 0
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    for (const p of allPosts) {
      if (p.tag_id) tagCountMap.set(p.tag_id, (tagCountMap.get(p.tag_id) ?? 0) + 1)
      if (['draft', 'idea'].includes(p.status as string) && new Date(p.created_at as string).getTime() < sevenDaysAgo) {
        staleDrafts++
      }
    }

    const tags: BlogTag[] = (tagsResult.data ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      color: t.color as string,
      colorDark: (t.color_dark as string | null) ?? null,
      badge: (t.badge as string | null) ?? null,
      sortOrder: (t.sort_order as number) ?? 0,
      postCount: tagCountMap.get(t.id as string) ?? 0,
    }))

    const site = siteResult.data
    return {
      tags,
      tabBadges: { editorial: staleDrafts },
      siteTimezone: (site?.timezone as string) ?? 'America/Sao_Paulo',
      siteName: (site?.name as string) ?? '',
      defaultLocale: (site?.default_locale as string) ?? 'pt-BR',
      supportedLocales: (site?.supported_locales as string[]) ?? ['pt-BR', 'en'],
    }
  },
  ['blog-shared'],
  { tags: ['blog-hub'], revalidate: 60 },
)

export const fetchOverviewData = unstable_cache(
  async (siteId: string, tagId?: string | null, locale?: string | null): Promise<OverviewTabData> => {
    const supabase = getSupabaseServiceClient()

    let postsQuery = supabase
      .from('blog_posts')
      .select('id, status, tag_id, published_at, created_at, blog_translations(locale, reading_time_min)')
      .eq('site_id', siteId)
    if (tagId) postsQuery = postsQuery.eq('tag_id', tagId)

    const [postsResult, tagsResult] = await Promise.all([
      postsQuery,
      supabase.from('blog_tags').select('id, name, color').eq('site_id', siteId),
    ])

    let posts = postsResult.data ?? []
    if (locale) {
      posts = posts.filter((p: Record<string, unknown>) => {
        const txs = (p as { blog_translations: Array<{ locale: string }> }).blog_translations ?? []
        return txs.some((t) => t.locale === locale)
      })
    }

    const tags = tagsResult.data ?? []
    const now = Date.now()
    const day = 24 * 60 * 60 * 1000

    const totalPosts = posts.length
    const published = posts.filter((p) => p.status === 'published')
    const backlog = posts.filter((p) => ['idea', 'draft', 'pending_review'].includes(p.status as string))

    const publishedReadingTimes = published
      .flatMap((p) => ((p as { blog_translations: Array<{ reading_time_min: number | null }> }).blog_translations ?? []).map((t) => t.reading_time_min))
      .filter((rt): rt is number => rt !== null && rt > 0)
    const avgReadingTime = publishedReadingTimes.length > 0
      ? Math.round((publishedReadingTimes.reduce((a, b) => a + b, 0) / publishedReadingTimes.length) * 10) / 10
      : 0

    const recentCreated = posts.filter((p) => now - new Date(p.created_at as string).getTime() < 7 * day).length
    const prevCreated = posts.filter((p) => {
      const age = now - new Date(p.created_at as string).getTime()
      return age >= 7 * day && age < 14 * day
    }).length
    const totalPostsTrend = prevCreated > 0 ? Math.round(((recentCreated - prevCreated) / prevCreated) * 100) : 0

    const tagBreakdown = tags.map((t) => ({
      tagId: t.id as string,
      tagName: t.name as string,
      tagColor: t.color as string,
      count: posts.filter((p) => p.tag_id === t.id).length,
    }))
    const untaggedCount = posts.filter((p) => !p.tag_id).length
    if (untaggedCount > 0) {
      tagBreakdown.push({ tagId: null as unknown as string, tagName: 'Untagged', tagColor: '#6b7280', count: untaggedCount })
    }
    tagBreakdown.sort((a, b) => b.count - a.count)

    const recentPubs = published
      .filter((p) => p.published_at)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
      .slice(0, 5)
      .map((p) => {
        const txs = (p as { blog_translations: Array<{ locale: string; reading_time_min: number | null; title?: string }> }).blog_translations ?? []
        const tag = tags.find((t) => t.id === p.tag_id)
        return {
          id: p.id as string,
          title: txs[0]?.title ?? 'Untitled',
          tagName: (tag?.name as string) ?? null,
          tagColor: (tag?.color as string) ?? null,
          locales: txs.map((t) => t.locale),
          publishedAt: p.published_at!,
          readingTimeMin: txs[0]?.reading_time_min ?? null,
        }
      })

    const weeklyVelocity: number[] = []
    for (let w = 7; w >= 0; w--) {
      const weekStart = now - (w + 1) * 7 * day
      const weekEnd = now - w * 7 * day
      weeklyVelocity.push(
        published.filter((p) => {
          const t = new Date(p.published_at!).getTime()
          return t >= weekStart && t < weekEnd
        }).length,
      )
    }

    return {
      kpis: {
        totalPosts,
        totalPostsTrend,
        published: published.length,
        publishedTrend: 0,
        avgReadingTime,
        avgReadingTimeTrend: 0,
        draftBacklog: backlog.length,
        draftBacklogTrend: 0,
      },
      sparklines: {
        totalPosts: [totalPosts],
        published: [published.length],
        avgReadingTime: [avgReadingTime],
        draftBacklog: [backlog.length],
      },
      tagBreakdown,
      recentPublications: recentPubs,
      velocitySparkline: weeklyVelocity,
    }
  },
  ['blog-overview'],
  { tags: ['blog-hub', 'blog-hub-overview'], revalidate: 60 },
)

export const fetchEditorialData = unstable_cache(
  async (siteId: string, tagId?: string | null, locale?: string | null): Promise<EditorialTabData> => {
    const supabase = getSupabaseServiceClient()

    const { data: rawPosts } = await supabase
      .from('blog_posts')
      .select('id, status, tag_id, published_at, scheduled_for, slot_date, created_at, updated_at, blog_translations(locale, title, slug, reading_time_min, content_mdx), blog_tags(id, name, color)')
      .eq('site_id', siteId)
      .order('created_at', { ascending: true })

    const allPosts = rawPosts ?? []

    type RawPost = typeof allPosts[number] & {
      blog_translations: Array<{ locale: string; title: string; slug: string; reading_time_min: number | null; content_mdx: string }>
      blog_tags: { id: string; name: string; color: string } | null
    }

    // Assign stable displayIds from the full unfiltered set (creation order)
    const displayIdMap = new Map<string, string>()
    for (let i = 0; i < allPosts.length; i++) {
      displayIdMap.set(allPosts[i]!.id as string, computeDisplayId(i + 1))
    }

    // Apply tag + locale filters after displayId assignment
    let filtered = allPosts as unknown as RawPost[]
    if (tagId) filtered = filtered.filter((p) => p.tag_id === tagId)
    if (locale) {
      filtered = filtered.filter((p) => {
        const txs = p.blog_translations ?? []
        return txs.some((t) => t.locale === locale)
      })
    }

    // Reverse to show newest first
    filtered = [...filtered].reverse()

    const cards: PostCard[] = filtered.map((p) => {
      const txs = p.blog_translations ?? []
      const preferredTx = (locale ? txs.find((t) => t.locale === locale) : null) ?? txs[0]
      return {
        id: p.id as string,
        displayId: displayIdMap.get(p.id as string) ?? computeDisplayId(0),
        title: preferredTx?.title ?? 'Untitled',
        status: p.status as PostCard['status'],
        tagId: p.tag_id as string | null,
        tagName: p.blog_tags?.name ?? null,
        tagColor: p.blog_tags?.color ?? null,
        locales: txs.map((t) => t.locale),
        readingTimeMin: preferredTx?.reading_time_min ?? null,
        createdAt: p.created_at as string,
        updatedAt: p.updated_at as string,
        publishedAt: p.published_at as string | null,
        scheduledFor: p.scheduled_for as string | null,
        slotDate: p.slot_date as string | null,
        snippet: preferredTx?.content_mdx?.slice(0, 80) ?? null,
      }
    })

    const now = Date.now()
    const day = 24 * 60 * 60 * 1000
    const publishedCards = cards.filter((c) => c.status === 'published')
    const throughput = publishedCards.filter(
      (c) => c.publishedAt && now - new Date(c.publishedAt).getTime() < 30 * day,
    ).length

    const completedPosts = publishedCards.filter((c) => c.publishedAt)
    const avgDays = completedPosts.length > 0
      ? Math.round(
          completedPosts.reduce((sum, c) => {
            return sum + (new Date(c.publishedAt!).getTime() - new Date(c.createdAt).getTime()) / day
          }, 0) / completedPosts.length,
        )
      : 0

    const movedThisWeek = cards.filter(
      (c) => now - new Date(c.updatedAt).getTime() < 7 * day && c.status !== 'published',
    ).length

    return {
      velocity: {
        throughput,
        avgIdeaToPublished: avgDays,
        movedThisWeek,
        bottleneck: null,
      },
      posts: cards,
    }
  },
  ['blog-editorial'],
  { tags: ['blog-hub', 'blog-hub-editorial'], revalidate: 30 },
)

export const fetchScheduleData = unstable_cache(
  async (siteId: string, _tagId?: string | null, _locale?: string | null): Promise<ScheduleTabData> => {
    const supabase = getSupabaseServiceClient()

    const [postsResult, cadenceResult, siteResult] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id, status, tag_id, published_at, scheduled_for, slot_date, blog_translations(locale, title, reading_time_min), blog_tags(color)')
        .eq('site_id', siteId)
        .in('status', ['scheduled', 'queued', 'published', 'ready']),
      supabase
        .from('blog_cadence')
        .select('locale, cadence_days, preferred_send_time, cadence_start_date, cadence_paused, last_published_at')
        .eq('site_id', siteId),
      supabase
        .from('sites')
        .select('supported_locales')
        .eq('id', siteId)
        .single(),
    ])

    const posts = postsResult.data ?? []
    const cadences = cadenceResult.data ?? []
    const supportedLocales: string[] = (siteResult.data?.supported_locales as string[]) ?? ['pt-BR', 'en']

    const cadenceConfigs: BlogCadenceConfig[] = supportedLocales.map((loc) => {
      const c = cadences.find((cd) => cd.locale === loc)
      return {
        locale: loc,
        cadenceDays: (c?.cadence_days as number) ?? 7,
        preferredSendTime: (c?.preferred_send_time as string) ?? '09:00',
        cadenceStartDate: (c?.cadence_start_date as string | null) ?? null,
        cadencePaused: (c?.cadence_paused as boolean) ?? false,
        lastPublishedAt: (c?.last_published_at as string | null) ?? null,
      }
    })

    const now = new Date()
    const calendarStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const calendarEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const slotsMap = new Map<string, ScheduleSlot>()
    for (let d = new Date(calendarStart); d <= calendarEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0]!
      slotsMap.set(key, { date: key, posts: [], emptySlots: [] })
    }

    type PostWithRelations = typeof posts[number] & {
      blog_translations: Array<{ locale: string; title: string; reading_time_min: number | null }>
      blog_tags: { color: string } | null
    }

    for (const p of posts as unknown as PostWithRelations[]) {
      const dates: string[] = []
      if (p.slot_date) dates.push(p.slot_date as string)
      if (p.scheduled_for) dates.push(new Date(p.scheduled_for as string).toISOString().split('T')[0]!)
      if (p.published_at) dates.push(new Date(p.published_at as string).toISOString().split('T')[0]!)

      for (const dateStr of dates) {
        const slot = slotsMap.get(dateStr)
        if (slot) {
          const txs = p.blog_translations ?? []
          slot.posts.push({
            id: p.id as string,
            title: txs[0]?.title ?? 'Untitled',
            tagColor: p.blog_tags?.color ?? null,
            status: p.status as string,
            locale: txs[0]?.locale ?? 'en',
          })
        }
      }
    }

    for (const config of cadenceConfigs) {
      if (config.cadencePaused || !config.cadenceStartDate) continue
      try {
        const slots = generateSlots(
          { cadenceDays: config.cadenceDays, startDate: config.cadenceStartDate, lastSentAt: config.lastPublishedAt, paused: false },
          { today: calendarStart.toISOString().split('T')[0]!, count: 31 },
        )
        for (const s of slots) {
          const slot = slotsMap.get(s)
          if (slot && slot.posts.length === 0) {
            slot.emptySlots.push({ locale: config.locale })
          }
        }
      } catch {
        // generateSlots may throw on invalid config — skip
      }
    }

    const calendarSlots = [...slotsMap.values()]
    const scheduledPosts = posts.filter((p) => ['scheduled', 'queued'].includes(p.status as string))

    const next7 = scheduledPosts.filter((p) => {
      const d = (p.scheduled_for ?? p.slot_date) as string | null
      if (!d) return false
      const diff = new Date(d).getTime() - now.getTime()
      return diff >= 0 && diff < 7 * 24 * 60 * 60 * 1000
    }).length

    const totalSlots = calendarSlots.reduce((sum, s) => sum + (s.emptySlots.length > 0 || s.posts.length > 0 ? 1 : 0), 0)
    const filledSlots = calendarSlots.reduce((sum, s) => sum + (s.posts.length > 0 ? 1 : 0), 0)
    const fillRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0

    const activeLocales = cadenceConfigs.filter((c) => !c.cadencePaused).length

    const readingTimes = (scheduledPosts as unknown as PostWithRelations[])
      .flatMap((p) => (p.blog_translations ?? []).map((t) => t.reading_time_min))
      .filter((rt): rt is number => rt !== null && rt > 0)
    const avgRT = readingTimes.length > 0
      ? Math.round((readingTimes.reduce((a, b) => a + b, 0) / readingTimes.length) * 10) / 10
      : 0

    return {
      healthStrip: {
        fillRate,
        next7Days: next7,
        avgReadingTime: avgRT,
        activeLocales,
        totalLocales: supportedLocales.length,
      },
      calendarSlots,
      cadenceConfigs,
    }
  },
  ['blog-schedule'],
  { tags: ['blog-hub', 'blog-hub-schedule'], revalidate: 60 },
)
