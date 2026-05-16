import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { toDateStringInTz } from '@/lib/cms/format-site-datetime'
import type { BlogHubSharedData, BlogTag, PostCard, EditorialTabData, ScheduleTabData, ScheduleSlot, BlogCadenceConfig, ReadyPost } from './hub-types'
import type { PipelineCardItem } from './hub-types'
import { computeDisplayId } from './hub-utils'
import { generateSlots } from '@tn-figueiredo/newsletter'

export const fetchBlogSharedData = unstable_cache(
  async (siteId: string): Promise<BlogHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const [tagsResult, siteResult, badgeResult] = await Promise.all([
      supabase
        .from('blog_tags')
        .select('id, name, slug, color, color_dark, badge, sort_order, name_translations')
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
      nameTranslations: (t.name_translations as Record<string, string> | null) ?? null,
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

export const fetchEditorialData = unstable_cache(
  async (siteId: string, tagId?: string | null, locale?: string | null): Promise<EditorialTabData> => {
    const supabase = getSupabaseServiceClient()

    const { data: rawPosts } = await supabase
      .from('blog_posts')
      .select('id, status, tag_id, published_at, scheduled_for, slot_date, created_at, updated_at, cover_image_url, blog_translations(locale, title, slug, reading_time_min, cover_image_url, excerpt), blog_tags(id, name, color, name_translations)')
      .eq('site_id', siteId)
      .in('status', ['idea', 'draft', 'pending_review', 'ready', 'queued', 'scheduled', 'published'])
      .order('created_at', { ascending: true })

    const allPosts = rawPosts ?? []

    type RawPost = typeof allPosts[number] & {
      cover_image_url: string | null
      blog_translations: Array<{ locale: string; title: string; slug: string; reading_time_min: number | null; cover_image_url: string | null; excerpt: string | null }>
      blog_tags: { id: string; name: string; color: string; name_translations: Record<string, string> | null } | null
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
        tagNameTranslations: (p.blog_tags?.name_translations as Record<string, string> | null) ?? null,
        locales: txs.map((t) => t.locale),
        readingTimeMin: preferredTx?.reading_time_min ?? null,
        createdAt: p.created_at as string,
        updatedAt: p.updated_at as string,
        publishedAt: p.published_at as string | null,
        scheduledFor: p.scheduled_for as string | null,
        slotDate: p.slot_date as string | null,
        snippet: preferredTx?.excerpt ?? null,
        coverImageUrl: preferredTx?.cover_image_url ?? p.cover_image_url ?? null,
        excerpt: preferredTx?.excerpt ?? null,
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
        // Intentionally null — computing real bottleneck requires historical column-duration data not yet tracked
        bottleneck: null,
        totalPosts: allPosts.length,
        publishedCount: publishedCards.length,
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

    const [postsResult, cadenceResult, siteResult, readyPostsResult] = await Promise.all([
      supabase
        .from('blog_posts')
        .select('id, status, tag_id, published_at, scheduled_for, slot_date, created_at, blog_translations(locale, title, reading_time_min), blog_tags(name, color, name_translations)')
        .eq('site_id', siteId)
        .in('status', ['scheduled', 'queued', 'published', 'ready']),
      supabase
        .from('blog_cadence')
        .select('locale, cadence_days, preferred_send_time, cadence_start_date, cadence_paused, last_published_at')
        .eq('site_id', siteId),
      supabase
        .from('sites')
        .select('supported_locales, timezone')
        .eq('id', siteId)
        .single(),
      supabase
        .from('blog_posts')
        .select('id, created_at, blog_translations(title, locale), blog_tags(name, color, name_translations)')
        .eq('site_id', siteId)
        .eq('status', 'ready')
        .order('created_at'),
    ])

    const posts = postsResult.data ?? []
    const cadences = cadenceResult.data ?? []
    const supportedLocales: string[] = (siteResult.data?.supported_locales as string[]) ?? ['pt-BR', 'en']
    const siteTimezone: string = (siteResult.data?.timezone as string) ?? 'America/Sao_Paulo'

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
    const todayStr = toDateStringInTz(now, siteTimezone)
    const [curY, curM] = todayStr.split('-').map(Number) as [number, number, number]
    const calendarStart = new Date(curY, curM - 1, 1)
    const calendarEnd = new Date(curY, curM, 0)

    const slotsMap = new Map<string, ScheduleSlot>()
    for (let d = new Date(calendarStart); d <= calendarEnd; d.setDate(d.getDate() + 1)) {
      const key = d.toLocaleDateString('sv-SE')
      slotsMap.set(key, { date: key, posts: [], emptySlots: [] })
    }

    type PostWithRelations = typeof posts[number] & {
      blog_translations: Array<{ locale: string; title: string; reading_time_min: number | null }>
      blog_tags: { name: string; color: string; name_translations: Record<string, string> | null } | null
    }

    const sortedPosts = [...(posts as unknown as PostWithRelations[])].sort(
      (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime(),
    )
    const postDisplayIdMap = new Map<string, string>()
    for (let i = 0; i < sortedPosts.length; i++) {
      postDisplayIdMap.set(sortedPosts[i]!.id as string, computeDisplayId(i + 1))
    }

    for (const p of posts as unknown as PostWithRelations[]) {
      const dates: string[] = []
      if (p.slot_date) dates.push(p.slot_date as string)
      if (p.scheduled_for) dates.push(toDateStringInTz(new Date(p.scheduled_for as string), siteTimezone))
      if (p.published_at) dates.push(toDateStringInTz(new Date(p.published_at as string), siteTimezone))

      const uniqueDates = [...new Set(dates)]
      for (const dateStr of uniqueDates) {
        const slot = slotsMap.get(dateStr)
        if (slot) {
          const txs = p.blog_translations ?? []
          slot.posts.push({
            id: p.id as string,
            displayId: postDisplayIdMap.get(p.id as string) ?? '#BP-000',
            title: txs[0]?.title ?? 'Untitled',
            tagName: p.blog_tags?.name ?? null,
            tagColor: p.blog_tags?.color ?? null,
            tagNameTranslations: (p.blog_tags?.name_translations as Record<string, string> | null) ?? null,
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
          { today: calendarStart.toLocaleDateString('sv-SE'), count: 31 },
        )
        for (const s of slots) {
          const slot = slotsMap.get(s)
          if (slot && slot.posts.length === 0) {
            slot.emptySlots.push({ locale: config.locale })
          }
        }
      } catch (err) {
        console.error('[blog-hub] generateSlots failed:', err)
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

    type ReadyPostRaw = {
      id: string
      created_at: string
      blog_translations: Array<{ title: string; locale: string }>
      blog_tags: { name: string; color: string; name_translations: Record<string, string> | null } | null
    }
    const readyPosts: ReadyPost[] = (readyPostsResult.data ?? []).map((p, idx) => {
      const row = p as unknown as ReadyPostRaw
      const txs = row.blog_translations ?? []
      return {
        id: row.id,
        displayId: computeDisplayId(idx + 1),
        title: txs[0]?.title ?? 'Untitled',
        tagName: row.blog_tags?.name ?? null,
        tagColor: row.blog_tags?.color ?? null,
        tagNameTranslations: (row.blog_tags?.name_translations as Record<string, string> | null) ?? null,
        locales: txs.map((t) => t.locale),
      }
    })

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
      readyPosts,
    }
  },
  ['blog-schedule'],
  { tags: ['blog-hub', 'blog-hub-schedule'], revalidate: 60 },
)

export const fetchPipelineData = unstable_cache(
  async (siteId: string): Promise<PipelineCardItem[]> => {
    const supabase = getSupabaseServiceClient()
    const { data } = await supabase
      .from('content_pipeline')
      .select(`
        id, code, title_pt, title_en, format, stage, language, priority,
        hook, body_content, tags, production_checklist, updated_at, created_at,
        blog_post_id, cover_image_url, validation_score, sort_order, version,
        is_archived, collection_code,
        dependencies:pipeline_dependencies(
          dependency_type,
          depends_on_pipeline:content_pipeline!pipeline_dependencies_depends_on_id_fkey(code)
        )
      `)
      .eq('site_id', siteId)
      .eq('format', 'blog_post')
      .eq('is_archived', false)
      .is('blog_post_id', null)
      .in('stage', ['idea', 'draft', 'ready'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    return (data ?? []).map((item) => ({
      id: item.id as string,
      code: item.code as string,
      title_pt: item.title_pt as string | null,
      title_en: item.title_en as string | null,
      format: item.format as string,
      stage: item.stage as 'idea' | 'draft' | 'ready' | 'archived',
      language: item.language as string,
      priority: item.priority as number,
      hook: item.hook as string | null,
      body_content: item.body_content as string | null,
      tags: (item.tags ?? []) as string[],
      production_checklist: (item.production_checklist ?? []) as Array<{ label: string; done: boolean }>,
      updated_at: item.updated_at as string,
      created_at: item.created_at as string,
      blog_post_id: null,
      cover_image_url: (item as Record<string, unknown>).cover_image_url as string | null,
      validation_score: (item as Record<string, unknown>).validation_score as number ?? 0,
      dependencies: ((item as Record<string, unknown>).dependencies ?? []) as PipelineCardItem['dependencies'],
      collection_code: (item as Record<string, unknown>).collection_code as string | null,
      sort_order: (item as Record<string, unknown>).sort_order as number ?? 0,
      version: (item.version ?? 1) as number,
      is_archived: false,
    }))
  },
  ['pipeline-blog'],
  { tags: ['pipeline-blog'], revalidate: 60 },
)
