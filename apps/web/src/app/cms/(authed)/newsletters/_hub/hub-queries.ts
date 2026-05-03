import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type {
  NewsletterHubSharedData,
  OverviewTabData,
  EditorialTabData,
  ScheduleTabData,
  AutomationsTabData,
  AudienceTabData,
  EditionCard,
  ActivityEvent,
} from './hub-types'
import { maskEmail, calculateEngagementScore, calculateHealthScore } from './hub-utils'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const fetchSharedData = unstable_cache(
  async (siteId: string, defaultLocale: string): Promise<NewsletterHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const [{ data: site }, { data: types }, { data: subCounts }] = await Promise.all([
      supabase.from('sites').select('name, timezone').eq('id', siteId).single(),
      supabase.from('newsletter_types').select('id, name, color, sort_order, cadence_paused, badge').eq('site_id', siteId).order('sort_order'),
      supabase.from('newsletter_subscriptions').select('newsletter_id').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
    ])

    const countByType = new Map<string, number>()
    for (const row of subCounts ?? []) {
      const id = row.newsletter_id as string
      countByType.set(id, (countByType.get(id) ?? 0) + 1)
    }

    const { count: editorialBadge } = await supabase
      .from('newsletter_editions')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .in('status', ['idea', 'draft', 'ready', 'scheduled'])

    const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
    const { count: autoIncidents } = await supabase
      .from('newsletter_types')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .eq('cadence_paused', true)
      .gte('last_sent_at', oneDayAgo)

    return {
      types: (types ?? []).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        color: (t.color ?? '#6366f1') as string,
        sortOrder: (t.sort_order ?? 0) as number,
        cadencePaused: !!t.cadence_paused,
        badge: (t.badge as string | null) ?? null,
        subscriberCount: countByType.get(t.id as string) ?? 0,
      })),
      tabBadges: { editorial: editorialBadge ?? 0, automations: autoIncidents ?? 0 },
      siteTimezone: (site?.timezone as string) ?? 'America/Sao_Paulo',
      siteName: (site?.name as string) ?? 'Site',
      defaultLocale,
    }
  },
  ['newsletter-shared'],
  { tags: ['newsletter-hub'], revalidate: 60 },
)

export const fetchOverviewData = unstable_cache(
  async (siteId: string): Promise<OverviewTabData> => {
    const supabase = getSupabaseServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()
    const sixtyDaysAgo = new Date(Date.now() - 2 * THIRTY_DAYS_MS).toISOString()

    const [
      { count: totalSubscribers },
      { data: recentEditions },
      { data: priorEditions },
      { data: typeRows },
      { data: recentSubs },
      { data: subCounts },
      { data: consents },
    ] = await Promise.all([
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_editions').select('id, subject, newsletter_type_id, stats_delivered, stats_opens, stats_clicks, stats_bounces, stats_complaints, sent_at').eq('site_id', siteId).eq('status', 'sent').gte('sent_at', thirtyDaysAgo).order('sent_at'),
      supabase.from('newsletter_editions').select('stats_delivered, stats_opens, stats_clicks, stats_bounces').eq('site_id', siteId).eq('status', 'sent').gte('sent_at', sixtyDaysAgo).lt('sent_at', thirtyDaysAgo),
      supabase.from('newsletter_types').select('id, name, color, cadence_paused').eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('created_at').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']).gte('created_at', thirtyDaysAgo).order('created_at'),
      supabase.from('newsletter_subscriptions').select('newsletter_id').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('consents').select('category').eq('site_id', siteId).is('revoked_at', null),
    ])

    const editions30d = recentEditions ?? []
    const totalDelivered = editions30d.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
    const totalOpens = editions30d.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
    const totalClicks = editions30d.reduce((s, e) => s + ((e.stats_clicks as number) ?? 0), 0)
    const totalBounces = editions30d.reduce((s, e) => s + ((e.stats_bounces as number) ?? 0), 0)
    const totalComplaints = editions30d.reduce((s, e) => s + ((e.stats_complaints as number) ?? 0), 0)

    const avgOpenRate = totalDelivered > 0 ? (totalOpens / totalDelivered) * 100 : 0
    const avgClickRate = totalDelivered > 0 ? (totalClicks / totalDelivered) * 100 : 0
    const bounceRate = totalDelivered > 0 ? (totalBounces / totalDelivered) * 100 : 0
    const complaintRate = totalDelivered > 0 ? (totalComplaints / totalDelivered) * 100 : 0

    const prior30d = priorEditions ?? []
    const priorDelivered = prior30d.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
    const priorOpens = prior30d.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
    const priorClicks = prior30d.reduce((s, e) => s + ((e.stats_clicks as number) ?? 0), 0)
    const priorBounces = prior30d.reduce((s, e) => s + ((e.stats_bounces as number) ?? 0), 0)
    const priorOpenRate = priorDelivered > 0 ? (priorOpens / priorDelivered) * 100 : 0
    const priorClickRate = priorDelivered > 0 ? (priorClicks / priorDelivered) * 100 : 0
    const priorBounceRate = priorDelivered > 0 ? (priorBounces / priorDelivered) * 100 : 0
    const openRateTrend = prior30d.length > 0 ? avgOpenRate - priorOpenRate : 0
    const clickRateTrend = prior30d.length > 0 ? avgClickRate - priorClickRate : 0
    const bounceTrend = prior30d.length > 0 ? bounceRate - priorBounceRate : 0

    const typeMap = new Map<string, { name: string; color: string; paused: boolean }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string, paused: !!t.cadence_paused })

    const subCountByType = new Map<string, number>()
    for (const row of subCounts ?? []) {
      const id = row.newsletter_id as string
      subCountByType.set(id, (subCountByType.get(id) ?? 0) + 1)
    }

    const editionsByType = Array.from(
      editions30d.reduce((m, e) => {
        const tid = e.newsletter_type_id as string
        m.set(tid, (m.get(tid) ?? 0) + 1)
        return m
      }, new Map<string, number>()),
    ).map(([typeId, count]) => {
      const info = typeMap.get(typeId)
      return { typeId, typeName: info?.name ?? 'Unknown', typeColor: info?.color ?? '#6366f1', count }
    })

    const topEditions = [...editions30d]
      .sort((a, b) => ((b.stats_opens as number) ?? 0) - ((a.stats_opens as number) ?? 0))
      .slice(0, 5)
      .map((e) => {
        const info = typeMap.get(e.newsletter_type_id as string)
        return {
          id: e.id as string,
          subject: e.subject as string,
          typeId: e.newsletter_type_id as string,
          typeName: info?.name ?? 'Unknown',
          typeColor: info?.color ?? '#6366f1',
          dateSent: e.sent_at as string,
          opens: (e.stats_opens as number) ?? 0,
          clicks: (e.stats_clicks as number) ?? 0,
        }
      })

    const editionIds = editions30d.map((e) => e.id as string)
    let sends: Array<Record<string, unknown>> = []
    if (editionIds.length > 0) {
      const { data } = await supabase
        .from('newsletter_sends')
        .select('status, opened_at, clicked_at, subscriber_email, edition_id')
        .in('edition_id', editionIds)
      sends = data ?? []
    }

    const funnelDelivered = sends.filter((s) => s.status === 'delivered' || s.opened_at || s.clicked_at).length
    const funnelOpened = sends.filter((s) => s.opened_at).length
    const funnelClicked = sends.filter((s) => s.clicked_at).length

    const subscriberGrowth = (recentSubs ?? []).reduce<Array<{ date: string; count: number }>>((acc, row) => {
      const date = (row.created_at as string).slice(0, 10)
      const last = acc[acc.length - 1]
      if (last?.date === date) last.count++
      else acc.push({ date, count: 1 })
      return acc
    }, [])

    const editionSparklines = editions30d.map(() => 1)
    const openRateSparkline = editions30d.map((e) => {
      const d = (e.stats_delivered as number) ?? 0
      const o = (e.stats_opens as number) ?? 0
      return d > 0 ? (o / d) * 100 : 0
    })
    const clickRateSparkline = editions30d.map((e) => {
      const d = (e.stats_delivered as number) ?? 0
      const c = (e.stats_clicks as number) ?? 0
      return d > 0 ? (c / d) * 100 : 0
    })
    const bounceRateSparkline = editions30d.map((e) => {
      const d = (e.stats_delivered as number) ?? 0
      const b = (e.stats_bounces as number) ?? 0
      return d > 0 ? (b / d) * 100 : 0
    })

    const totalSubCount = totalSubscribers ?? 0
    const newsletterConsents = (consents ?? []).filter((c) => c.category === 'newsletter').length
    const lgpdConsentRate = totalSubCount > 0 ? (newsletterConsents / totalSubCount) * 100 : 100
    const subscriberGrowthRate = totalSubCount > 0 ? (subscriberGrowth.reduce((s, d) => s + d.count, 0) / totalSubCount) * 100 : 0

    const healthScore = calculateHealthScore({
      spf: true, dkim: true, dmarc: true,
      bounceRate, complaintRate, avgOpenRate,
      subscriberGrowthRate, lgpdConsentRate,
    })

    const delivScore = Math.round(((1 + Math.max(0, 1 - bounceRate / 5) * 0.3 + Math.max(0, 1 - complaintRate / 1) * 0.2) / 1.5) * 100)
    const engScore = Math.round(Math.min(100, (avgOpenRate / 50) * 100))
    const growthScore = Math.round(Math.min(100, Math.max(0, ((subscriberGrowthRate + 10) / 30) * 100)))
    const complianceScore = Math.round(Math.min(100, lgpdConsentRate))

    const activityFeed: ActivityEvent[] = sends
      .filter((s) => s.opened_at || s.clicked_at)
      .sort((a, b) => {
        const ta = (a.opened_at as string) ?? (a.clicked_at as string) ?? ''
        const tb = (b.opened_at as string) ?? (b.clicked_at as string) ?? ''
        return tb.localeCompare(ta)
      })
      .slice(0, 10)
      .map((s, i) => {
        const hasClick = !!s.clicked_at
        return {
          id: `send-${i}`,
          type: hasClick ? 'clicked' as const : 'opened' as const,
          description: hasClick ? 'Clicked a link' : 'Opened edition',
          emailMasked: maskEmail(s.subscriber_email as string),
          timestamp: (hasClick ? s.clicked_at : s.opened_at) as string,
        }
      })

    return {
      kpis: {
        totalSubscribers: totalSubCount,
        subscribersTrend: subscriberGrowth.reduce((s, d) => s + d.count, 0),
        editionsSent: editions30d.length,
        editionsThisMonth: editions30d.filter((e) => {
          const d = new Date(e.sent_at as string)
          const now = new Date()
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length,
        avgOpenRate,
        openRateTrend,
        avgClickRate,
        clickRateTrend,
        bounceRate,
        bounceTrend,
      },
      sparklines: {
        subscribers: subscriberGrowth.map((d) => d.count),
        editions: editionSparklines,
        openRate: openRateSparkline,
        clickRate: clickRateSparkline,
        bounceRate: bounceRateSparkline,
      },
      healthScore,
      healthDimensions: {
        deliverability: { score: delivScore, label: delivScore >= 80 ? 'Excellent' : delivScore >= 60 ? 'Good' : 'Needs attention' },
        engagement: { score: engScore, label: engScore >= 80 ? 'Excellent' : engScore >= 60 ? 'Good' : 'Low' },
        growth: { score: growthScore, label: growthScore >= 80 ? 'Strong' : growthScore >= 50 ? 'Steady' : 'Slow' },
        compliance: { score: complianceScore, label: complianceScore >= 90 ? 'Compliant' : complianceScore >= 70 ? 'Partial' : 'At risk' },
      },
      subscriberGrowth,
      funnel: { sent: sends.length, delivered: funnelDelivered, opened: funnelOpened, clicked: funnelClicked },
      editionsByType,
      openRateTrend: editions30d.map((e) => {
        const d = (e.stats_delivered as number) ?? 0
        const o = (e.stats_opens as number) ?? 0
        const rate = d > 0 ? (o / d) * 100 : 0
        const info = typeMap.get(e.newsletter_type_id as string)
        const rates: Record<string, number> = { all: rate }
        if (info) rates[info.name] = rate
        return { date: (e.sent_at as string).slice(0, 10), rates }
      }),
      publicationPerformance: Array.from(typeMap.entries()).map(([typeId, info]) => {
        const typeEditions = editions30d.filter((e) => e.newsletter_type_id === typeId)
        const typeDelivered = typeEditions.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
        const typeOpens = typeEditions.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
        const typeClicks = typeEditions.reduce((s, e) => s + ((e.stats_clicks as number) ?? 0), 0)
        return {
          typeId,
          typeName: info.name,
          typeColor: info.color,
          subscribers: subCountByType.get(typeId) ?? 0,
          editionsSent: typeEditions.length,
          openRate: typeDelivered > 0 ? (typeOpens / typeDelivered) * 100 : 0,
          clickRate: typeDelivered > 0 ? (typeClicks / typeDelivered) * 100 : 0,
          sparkline: typeEditions.map((e) => {
            const d = (e.stats_delivered as number) ?? 0
            const o = (e.stats_opens as number) ?? 0
            return d > 0 ? (o / d) * 100 : 0
          }),
          paused: info.paused,
        }
      }),
      topEditions,
      activityFeed,
      deliverability: { spf: true, dkim: true, dmarc: true, bounceRate, complaintRate, provider: 'Amazon SES' },
    }
  },
  ['newsletter-overview'],
  { tags: ['newsletter-hub', 'newsletter-overview'], revalidate: 60 },
)

export const fetchEditorialData = unstable_cache(
  async (siteId: string): Promise<EditorialTabData> => {
    const supabase = getSupabaseServiceClient()

    const { data: editions } = await supabase
      .from('newsletter_editions')
      .select(`
        id, subject, preheader, status, newsletter_type_id, created_at, updated_at, sent_at,
        slot_date, notes, idea_notes, idea_created_at, review_entered_at,
        stats_opens, stats_clicks, stats_bounces, stats_delivered, content_html
      `)
      .eq('site_id', siteId)
      .in('status', ['idea', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'])
      .order('created_at', { ascending: false })

    const { data: typeRows } = await supabase
      .from('newsletter_types')
      .select('id, name, color')
      .eq('site_id', siteId)

    const typeMap = new Map<string, { name: string; color: string }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string })

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const movedThisWeek = (editions ?? []).filter((e) => (e.updated_at as string) >= oneWeekAgo && (e.status as string) !== 'idea').length

    const sortedForNumbering = [...(editions ?? [])].sort((a, b) =>
      (a.created_at as string).localeCompare(b.created_at as string),
    )
    const editionNumbers = new Map<string, number>()
    for (let i = 0; i < sortedForNumbering.length; i++) {
      const e = sortedForNumbering[i]!
      editionNumbers.set(e.id as string, i + 1)
    }

    const cards: EditionCard[] = (editions ?? []).map((e) => {
      const info = e.newsletter_type_id ? typeMap.get(e.newsletter_type_id as string) : null
      const delivered = (e.stats_delivered as number) ?? 0
      const bounces = (e.stats_bounces as number) ?? 0
      const num = editionNumbers.get(e.id as string) ?? 0
      const html = (e.content_html as string) ?? ''
      const textContent = html.replace(/<[^>]*>/g, '')
      const charCount = textContent.length
      const imageCount = (html.match(/<img[\s>]/g) ?? []).length
      return {
        id: e.id as string,
        displayId: `#${String(num).padStart(3, '0')}`,
        subject: (e.subject as string) ?? '',
        preheader: (e.preheader as string) ?? null,
        status: e.status as EditionCard['status'],
        typeId: (e.newsletter_type_id as string) ?? null,
        typeName: info?.name ?? null,
        typeColor: info?.color ?? null,
        createdAt: e.created_at as string,
        sentAt: (e.sent_at as string) ?? null,
        ideaCreatedAt: (e.idea_created_at as string) ?? null,
        reviewEnteredAt: (e.review_entered_at as string) ?? null,
        slotDate: (e.slot_date as string) ?? null,
        wordCount: textContent ? textContent.split(/\s+/).filter(Boolean).length : null,
        charCount: charCount > 0 ? charCount : null,
        imageCount: imageCount > 0 ? imageCount : null,
        readingTimeMin: null,
        progressPercent: null,
        ideaNotes: (e.idea_notes as string) ?? (e.notes as string) ?? null,
        snippet: null,
        stats: e.status === 'sent' ? { opens: (e.stats_opens as number) ?? 0, clicks: (e.stats_clicks as number) ?? 0, bounceRate: delivered > 0 ? (bounces / delivered) * 100 : 0 } : null,
      }
    })

    return {
      velocity: { throughput: cards.filter((c) => c.status === 'sent').length, avgIdeaToSent: 0, movedThisWeek, bottleneck: null },
      editions: cards,
      wipLimit: 5,
    }
  },
  ['newsletter-editorial'],
  { tags: ['newsletter-hub', 'newsletter-editorial'], revalidate: 30 },
)

export const fetchScheduleData = unstable_cache(
  async (siteId: string): Promise<ScheduleTabData> => {
    const supabase = getSupabaseServiceClient()

    const [{ data: scheduled }, { data: typeRows }, { data: subCounts }, { data: sentEditions }] = await Promise.all([
      supabase
        .from('newsletter_editions')
        .select('id, subject, status, newsletter_type_id, scheduled_at, slot_date')
        .eq('site_id', siteId)
        .in('status', ['scheduled', 'queued', 'ready'])
        .order('scheduled_at'),
      supabase
        .from('newsletter_types')
        .select('id, name, color, cadence_days, cadence_paused, preferred_send_time, cadence_start_date, last_sent_at')
        .eq('site_id', siteId),
      supabase
        .from('newsletter_subscriptions')
        .select('newsletter_id')
        .eq('site_id', siteId)
        .in('status', ['confirmed', 'pending_confirmation']),
      supabase
        .from('newsletter_editions')
        .select('newsletter_type_id, stats_delivered, stats_opens')
        .eq('site_id', siteId)
        .eq('status', 'sent'),
    ])

    const typeMap = new Map<string, { name: string; color: string }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string })

    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const startOffset = firstDay.getDay()
    const calendarSlots = Array.from({ length: 42 }).map((_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), 1 - startOffset + i)
      const dateStr = date.toISOString().slice(0, 10)
      const dayEditions = (scheduled ?? [])
        .filter((e) => {
          const d = (e.scheduled_at as string)?.slice(0, 10) ?? (e.slot_date as string)
          return d === dateStr
        })
        .map((e) => {
          const info = typeMap.get(e.newsletter_type_id as string)
          return { id: e.id as string, subject: (e.subject as string) ?? '', typeColor: info?.color ?? '#6366f1', status: e.status as string }
        })
      return { date: dateStr, editions: dayEditions, emptySlots: [] }
    })

    const next7Days = (scheduled ?? []).filter((e) => {
      const d = new Date((e.scheduled_at as string) ?? (e.slot_date as string) ?? '')
      return d >= today && d <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    }).length

    const subCountByType = new Map<string, number>()
    for (const row of subCounts ?? []) {
      const id = row.newsletter_id as string
      if (id) subCountByType.set(id, (subCountByType.get(id) ?? 0) + 1)
    }

    const edCountByType = new Map<string, number>()
    const openSumByType = new Map<string, number>()
    const delivSumByType = new Map<string, number>()
    for (const e of sentEditions ?? []) {
      const tid = e.newsletter_type_id as string
      if (!tid) continue
      edCountByType.set(tid, (edCountByType.get(tid) ?? 0) + 1)
      openSumByType.set(tid, (openSumByType.get(tid) ?? 0) + ((e.stats_opens as number) ?? 0))
      delivSumByType.set(tid, (delivSumByType.get(tid) ?? 0) + ((e.stats_delivered as number) ?? 0))
    }

    const cadenceConfigs = (typeRows ?? []).map((t) => {
      const tid = t.id as string
      const dSum = delivSumByType.get(tid) ?? 0
      const oSum = openSumByType.get(tid) ?? 0
      const startDate = (t.cadence_start_date as string | null) ?? null
      const dayIdx = startDate ? new Date(startDate + 'T00:00:00').getUTCDay() : null
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return {
        typeId: tid,
        typeName: t.name as string,
        typeColor: (t.color ?? '#6366f1') as string,
        cadence: t.cadence_days ? `Every ${t.cadence_days} days` : 'No cadence',
        cadenceDays: (t.cadence_days as number) ?? 7,
        dayOfWeek: dayIdx !== null ? dayNames[dayIdx]! : '',
        time: (t.preferred_send_time as string) ?? '08:00',
        nextDate: '',
        cadenceStartDate: startDate,
        paused: !!t.cadence_paused,
        subscribers: subCountByType.get(tid) ?? 0,
        editionsSent: edCountByType.get(tid) ?? 0,
        openRate: dSum > 0 ? (oSum / dSum) * 100 : 0,
        conflicts: [] as string[],
      }
    })

    const activeTypeCount = (typeRows ?? []).filter((t) => !t.cadence_paused && t.cadence_days).length
    const totalSlotsThisMonth = activeTypeCount > 0 ? Math.round(30 / Math.max(1, Math.min(...(typeRows ?? []).filter((t) => !t.cadence_paused && t.cadence_days).map((t) => (t.cadence_days as number) ?? 30))) * activeTypeCount) : 0
    const filledSlots = (scheduled ?? []).length
    const fillRate = totalSlotsThisMonth > 0 ? Math.min(100, (filledSlots / totalSlotsThisMonth) * 100) : 0

    const avgOpenRate = cadenceConfigs.reduce((s, c) => s + c.openRate, 0) / Math.max(1, cadenceConfigs.length)

    return {
      healthStrip: {
        fillRate,
        next7Days,
        conflicts: 0,
        avgOpenRate,
        activeTypes: (typeRows ?? []).filter((t) => !t.cadence_paused).length,
        totalTypes: (typeRows ?? []).length,
      },
      calendarSlots,
      cadenceConfigs,
      sendWindow: { time: '08:00', timezone: 'America/Sao_Paulo', bestTimeInsight: 'Based on subscriber timezone distribution' },
    }
  },
  ['newsletter-schedule'],
  { tags: ['newsletter-hub', 'newsletter-schedule'], revalidate: 60 },
)

export const fetchAutomationsData = unstable_cache(
  async (siteId: string): Promise<AutomationsTabData> => {
    const supabase = getSupabaseServiceClient()

    const { data: typeRows } = await supabase
      .from('newsletter_types')
      .select('id, name, cadence_paused, last_sent_at')
      .eq('site_id', siteId)

    const { data: cronRuns } = await supabase
      .from('cron_runs')
      .select('job_name, started_at, status')
      .order('started_at', { ascending: false })
      .limit(50)

    const cronMap = new Map<string, Array<{ date: string; success: boolean }>>()
    for (const r of cronRuns ?? []) {
      const name = r.job_name as string
      if (!cronMap.has(name)) cronMap.set(name, [])
      cronMap.get(name)!.push({ date: r.started_at as string, success: r.status === 'ok' })
    }

    const cronJobs = [
      { name: 'send-scheduled-newsletters', expression: '0 8 * * *', frequency: 'Daily 08:00', lgpd: false },
      { name: 'anonymize-newsletter-tracking', expression: '0 4 * * *', frequency: 'Daily 04:00', lgpd: true },
      { name: 'purge-webhook-events', expression: '0 5 * * 0', frequency: 'Weekly Sun 05:00', lgpd: true },
      { name: 'purge-sent-emails', expression: '0 6 * * *', frequency: 'Daily 06:00', lgpd: true },
    ].map((c) => ({ ...c, lastRuns: (cronMap.get(c.name) ?? []).slice(0, 5) }))

    const allCronsHealthy = cronJobs.every((c) => c.lastRuns.length === 0 || c.lastRuns[0]?.success)
    const todayStart = new Date().toISOString().slice(0, 10)
    const eventsToday = (cronRuns ?? []).filter((r) => (r.started_at as string).startsWith(todayStart)).length
    const successRate = (cronRuns ?? []).length > 0 ? ((cronRuns ?? []).filter((r) => r.status === 'ok').length / (cronRuns ?? []).length) * 100 : 100

    const workflows: AutomationsTabData['workflows'] = [
      {
        id: 'welcome',
        name: 'Welcome Email',
        type: 'welcome',
        enabled: true,
        stats: { sent: 0, delivered: 0 },
      },
      {
        id: 're_engagement',
        name: 'Re-engagement',
        type: 're_engagement',
        enabled: false,
        stats: { sent: 0, delivered: 0 },
      },
      {
        id: 'bounce_handler',
        name: 'Bounce Handler',
        type: 'bounce_handler',
        enabled: true,
        stats: { processed: 0, paused: 0 },
        pipelineCounts: {
          paused: (typeRows ?? []).filter((t) => t.cadence_paused).length,
          active: (typeRows ?? []).filter((t) => !t.cadence_paused).length,
        },
      },
    ]

    const autoActivity: ActivityEvent[] = (cronRuns ?? []).slice(0, 10).map((r, i) => ({
      id: `cron-${i}`,
      type: 'system' as const,
      description: `${r.job_name as string} ${r.status === 'ok' ? 'completed' : 'failed'}`,
      timestamp: r.started_at as string,
    }))

    const lastFailedRun = (cronRuns ?? []).find((r) => r.status !== 'ok')
    const lastIncidentDaysAgo = lastFailedRun ? Math.floor((Date.now() - new Date(lastFailedRun.started_at as string).getTime()) / (24 * 60 * 60 * 1000)) : null

    return {
      healthStrip: {
        workflowsActive: workflows.filter((w) => w.enabled).length,
        cronsHealthy: allCronsHealthy ? cronJobs.length : cronJobs.filter((c) => c.lastRuns[0]?.success).length,
        eventsToday,
        successRate,
        lastIncidentDaysAgo,
      },
      workflows,
      cronJobs,
      activityFeed: autoActivity,
    }
  },
  ['newsletter-automations'],
  { tags: ['newsletter-hub', 'newsletter-automations'], revalidate: 60 },
)

export const fetchAudienceData = unstable_cache(
  async (siteId: string, page = 1, pageSize = 20): Promise<AudienceTabData> => {
    const supabase = getSupabaseServiceClient()
    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString()

    const [
      { count: uniqueSubscribers },
      { count: confirmedSubscribers },
      { count: pendingSubscribers },
      { count: totalSubscriptions },
      { data: recentSubs },
      { data: recentUnsubs },
      { data: typeRows },
      { data: subRows, count: totalRows },
      { data: consents },
      { data: allSubsForDist },
      { data: allSubsForLocale },
      { data: sentEditions },
    ] = await Promise.all([
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'confirmed'),
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).eq('status', 'pending_confirmation'),
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('created_at').eq('site_id', siteId).eq('status', 'confirmed').gte('created_at', thirtyDaysAgo).order('created_at'),
      supabase.from('newsletter_subscriptions').select('unsubscribed_at').eq('site_id', siteId).eq('status', 'unsubscribed').gte('unsubscribed_at', thirtyDaysAgo),
      supabase.from('newsletter_types').select('id, name, color, cadence_paused').eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('id, email, status, newsletter_id, created_at, locale', { count: 'exact' }).eq('site_id', siteId).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
      supabase.from('consents').select('category').eq('site_id', siteId).is('revoked_at', null),
      supabase.from('newsletter_subscriptions').select('newsletter_id').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_subscriptions').select('locale').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_editions').select('newsletter_type_id, stats_delivered, stats_opens, stats_clicks, stats_bounces').eq('site_id', siteId).eq('status', 'sent'),
    ])

    const typeMap = new Map<string, { name: string; color: string; paused: boolean }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string, paused: !!t.cadence_paused })

    const newSubs30d = (recentSubs ?? []).length
    const unsubs30d = (recentUnsubs ?? []).length
    const netGrowth = newSubs30d - unsubs30d
    const churnRate = (uniqueSubscribers ?? 0) > 0 ? (unsubs30d / (uniqueSubscribers ?? 1)) * 100 : 0

    const statusForRow = (s: string): 'active' | 'at_risk' | 'bounced' | 'unsubscribed' | 'anonymized' => {
      if (s === 'confirmed') return 'active'
      if (s === 'unsubscribed') return 'unsubscribed'
      if (s === 'bounced') return 'bounced'
      if (s === 'pending_confirmation') return 'at_risk'
      return 'active'
    }

    const rows = (subRows ?? []).map((s) => {
      const info = s.newsletter_id ? typeMap.get(s.newsletter_id as string) : null
      return {
        id: s.id as string,
        emailMasked: maskEmail(s.email as string),
        name: null,
        initials: ((s.email as string) ?? '??').slice(0, 2).toUpperCase(),
        types: info ? [{ id: s.newsletter_id as string, name: info.name, color: info.color }] : [],
        subscribedAt: s.created_at as string,
        opens30d: 0,
        clicks30d: 0,
        engagementScore: calculateEngagementScore({ opens30d: 0, clicks30d: 0, editionsReceived30d: 0, daysSinceLastOpen: 30 }),
        status: statusForRow(s.status as string),
      }
    })

    const localeCounts: Record<string, number> = {}
    for (const s of allSubsForLocale ?? []) {
      const loc = (s.locale as string) ?? 'unknown'
      localeCounts[loc] = (localeCounts[loc] ?? 0) + 1
    }

    const newsletterConsents = (consents ?? []).filter((c) => c.category === 'newsletter').length
    const analyticsConsents = (consents ?? []).filter((c) => c.category === 'analytics').length
    const anonymizedCount = (consents ?? []).filter((c) => c.category === 'newsletter_anonymized').length

    const distCountByType = new Map<string, number>()
    for (const s of allSubsForDist ?? []) {
      const id = s.newsletter_id as string
      if (id) distCountByType.set(id, (distCountByType.get(id) ?? 0) + 1)
    }
    const totalActiveSubs = uniqueSubscribers ?? 0

    const edStatsByType = new Map<string, { delivered: number; opens: number; clicks: number; bounces: number }>()
    let allDelivered = 0
    let allOpens = 0
    for (const e of sentEditions ?? []) {
      const tid = e.newsletter_type_id as string
      const d = (e.stats_delivered as number) ?? 0
      const o = (e.stats_opens as number) ?? 0
      const c = (e.stats_clicks as number) ?? 0
      const b = (e.stats_bounces as number) ?? 0
      allDelivered += d
      allOpens += o
      if (tid) {
        const cur = edStatsByType.get(tid) ?? { delivered: 0, opens: 0, clicks: 0, bounces: 0 }
        cur.delivered += d
        cur.opens += o
        cur.clicks += c
        cur.bounces += b
        edStatsByType.set(tid, cur)
      }
    }
    const audienceAvgOpenRate = allDelivered > 0 ? (allOpens / allDelivered) * 100 : 0

    const distribution = Array.from(typeMap.entries()).map(([typeId, info]) => {
      const count = distCountByType.get(typeId) ?? 0
      return { typeId, typeName: info.name, typeColor: info.color, count, share: totalActiveSubs > 0 ? (count / totalActiveSubs) * 100 : 0 }
    })

    const growth = (recentSubs ?? []).reduce<Array<{ date: string; newSubs: number; unsubs: number }>>((acc, row) => {
      const date = (row.created_at as string).slice(0, 10)
      const last = acc[acc.length - 1]
      if (last?.date === date) last.newSubs++
      else acc.push({ date, newSubs: 1, unsubs: 0 })
      return acc
    }, [])
    for (const u of recentUnsubs ?? []) {
      const date = (u.unsubscribed_at as string).slice(0, 10)
      const entry = growth.find((g) => g.date === date)
      if (entry) entry.unsubs++
      else growth.push({ date, newSubs: 0, unsubs: 1 })
    }
    growth.sort((a, b) => a.date.localeCompare(b.date))

    const recentActivity: ActivityEvent[] = (recentSubs ?? []).slice(0, 8).map((s, i) => ({
      id: `sub-${i}`,
      type: 'welcome' as const,
      description: 'New subscriber joined',
      timestamp: s.created_at as string,
    }))

    return {
      healthStrip: {
        uniqueSubscribers: uniqueSubscribers ?? 0,
        confirmedSubscribers: confirmedSubscribers ?? 0,
        pendingSubscribers: pendingSubscribers ?? 0,
        totalSubscriptions: totalSubscriptions ?? 0,
        netGrowth30d: netGrowth,
        churnRate,
        avgOpenRate: audienceAvgOpenRate,
        lgpdConsent: totalActiveSubs > 0 ? (newsletterConsents / totalActiveSubs) * 100 : 0,
      },
      growth,
      distribution,
      engagementByType: Array.from(typeMap.entries()).map(([typeId, info]) => {
        const st = edStatsByType.get(typeId)
        return {
          typeId, typeName: info.name, typeColor: info.color,
          subscribers: distCountByType.get(typeId) ?? 0,
          openRate: st && st.delivered > 0 ? (st.opens / st.delivered) * 100 : 0,
          clickRate: st && st.delivered > 0 ? (st.clicks / st.delivered) * 100 : 0,
          bounceRate: st && st.delivered > 0 ? (st.bounces / st.delivered) * 100 : 0,
          sparkline: [], paused: info.paused,
        }
      }),
      subscribers: { rows, total: totalRows ?? 0, page },
      locale: localeCounts,
      lgpdConsent: { newsletter: newsletterConsents, analytics: analyticsConsents, anonymized: anonymizedCount, version: '' },
      recentActivity,
    }
  },
  ['newsletter-audience'],
  { tags: ['newsletter-hub', 'newsletter-audience'], revalidate: 60 },
)
