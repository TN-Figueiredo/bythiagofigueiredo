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
import { maskEmail, calculateEngagementScore } from './hub-utils'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const fetchSharedData = unstable_cache(
  async (siteId: string, defaultLocale: string): Promise<NewsletterHubSharedData> => {
    const supabase = getSupabaseServiceClient()

    const [{ data: site }, { data: types }, { data: subCounts }] = await Promise.all([
      supabase.from('sites').select('name, timezone').eq('id', siteId).single(),
      supabase.from('newsletter_types').select('id, name, color, sort_order, cadence_paused').eq('site_id', siteId).order('sort_order'),
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
      { data: recentSends },
    ] = await Promise.all([
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_editions').select('id, subject, newsletter_type_id, stats_delivered, stats_opens, stats_clicks, stats_bounces, stats_complaints, sent_at').eq('site_id', siteId).eq('status', 'sent').gte('sent_at', thirtyDaysAgo),
      supabase.from('newsletter_editions').select('stats_delivered, stats_opens').eq('site_id', siteId).eq('status', 'sent').gte('sent_at', sixtyDaysAgo).lt('sent_at', thirtyDaysAgo),
      supabase.from('newsletter_types').select('id, name, color, cadence_paused').eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('created_at').eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']).gte('created_at', thirtyDaysAgo).order('created_at'),
      supabase.from('newsletter_sends').select('status, opened_at, clicked_at').eq('site_id', siteId).gte('created_at', thirtyDaysAgo),
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
    const priorOpenRate = priorDelivered > 0 ? (priorOpens / priorDelivered) * 100 : 0
    const openRateTrend = prior30d.length > 0 ? avgOpenRate - priorOpenRate : 0

    const typeMap = new Map<string, { name: string; color: string; paused: boolean }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string, paused: !!t.cadence_paused })

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

    const sends = recentSends ?? []
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

    return {
      kpis: {
        totalSubscribers: totalSubscribers ?? 0,
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
        clickRateTrend: 0,
        bounceRate,
        bounceTrend: 0,
      },
      sparklines: { subscribers: subscriberGrowth.map((d) => d.count), editions: [], openRate: [], clickRate: [], bounceRate: [] },
      healthScore: 0,
      healthDimensions: {
        deliverability: { score: 0, label: '' },
        engagement: { score: 0, label: '' },
        growth: { score: 0, label: '' },
        compliance: { score: 0, label: '' },
      },
      subscriberGrowth,
      funnel: { sent: sends.length, delivered: funnelDelivered, opened: funnelOpened, clicked: funnelClicked },
      editionsByType,
      openRateTrend: [],
      publicationPerformance: Array.from(typeMap.entries()).map(([typeId, info]) => {
        const typeEditions = editions30d.filter((e) => e.newsletter_type_id === typeId)
        const typeDelivered = typeEditions.reduce((s, e) => s + ((e.stats_delivered as number) ?? 0), 0)
        const typeOpens = typeEditions.reduce((s, e) => s + ((e.stats_opens as number) ?? 0), 0)
        const typeClicks = typeEditions.reduce((s, e) => s + ((e.stats_clicks as number) ?? 0), 0)
        return {
          typeId,
          typeName: info.name,
          typeColor: info.color,
          subscribers: 0,
          editionsSent: typeEditions.length,
          openRate: typeDelivered > 0 ? (typeOpens / typeDelivered) * 100 : 0,
          clickRate: typeDelivered > 0 ? (typeClicks / typeDelivered) * 100 : 0,
          sparkline: [],
          paused: info.paused,
        }
      }),
      topEditions,
      activityFeed: [],
      cohortRetention: [],
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
        id, subject, status, newsletter_type_id, created_at, updated_at,
        slot_date, notes, idea_notes, idea_created_at, review_entered_at,
        stats_opens, stats_clicks, stats_bounces, stats_delivered
      `)
      .eq('site_id', siteId)
      .in('status', ['idea', 'draft', 'ready', 'review', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'])
      .order('created_at', { ascending: false })

    const { data: typeRows } = await supabase
      .from('newsletter_types')
      .select('id, name, color')
      .eq('site_id', siteId)

    const typeMap = new Map<string, { name: string; color: string }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string })

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const movedThisWeek = (editions ?? []).filter((e) => (e.updated_at as string) >= oneWeekAgo && (e.status as string) !== 'idea').length

    const cards: EditionCard[] = (editions ?? []).map((e) => {
      const info = e.newsletter_type_id ? typeMap.get(e.newsletter_type_id as string) : null
      const delivered = (e.stats_delivered as number) ?? 0
      const bounces = (e.stats_bounces as number) ?? 0
      return {
        id: e.id as string,
        subject: (e.subject as string) ?? '',
        status: e.status as EditionCard['status'],
        typeId: (e.newsletter_type_id as string) ?? null,
        typeName: info?.name ?? null,
        typeColor: info?.color ?? null,
        createdAt: e.created_at as string,
        ideaCreatedAt: (e.idea_created_at as string) ?? null,
        reviewEnteredAt: (e.review_entered_at as string) ?? null,
        slotDate: (e.slot_date as string) ?? null,
        wordCount: null,
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

    const { data: scheduled } = await supabase
      .from('newsletter_editions')
      .select('id, subject, status, newsletter_type_id, scheduled_at, slot_date')
      .eq('site_id', siteId)
      .in('status', ['scheduled', 'queued', 'ready'])
      .order('scheduled_at')

    const { data: typeRows } = await supabase
      .from('newsletter_types')
      .select('id, name, color, cadence_days, cadence_paused, preferred_send_time, cadence_start_date, last_sent_at')
      .eq('site_id', siteId)

    const typeMap = new Map<string, { name: string; color: string }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string })

    const today = new Date()
    const calendarSlots = Array.from({ length: 42 }).map((_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), 1 + i)
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

    const cadenceConfigs = (typeRows ?? []).map((t) => ({
      typeId: t.id as string,
      typeName: t.name as string,
      typeColor: (t.color ?? '#6366f1') as string,
      cadence: t.cadence_days ? `Every ${t.cadence_days} days` : 'No cadence',
      dayOfWeek: '',
      time: (t.preferred_send_time as string) ?? '08:00',
      nextDate: '',
      paused: !!t.cadence_paused,
      subscribers: 0,
      editionsSent: 0,
      openRate: 0,
      conflicts: [] as string[],
    }))

    return {
      healthStrip: {
        fillRate: 0,
        next7Days,
        conflicts: 0,
        avgOpenRate: 0,
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

    return {
      healthStrip: {
        workflowsActive: workflows.filter((w) => w.enabled).length,
        cronsHealthy: allCronsHealthy ? cronJobs.length : cronJobs.filter((c) => c.lastRuns[0]?.success).length,
        eventsToday,
        successRate,
        lastIncidentDaysAgo: null,
      },
      workflows,
      cronJobs,
      activityFeed: [],
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
      { count: totalSubscriptions },
      { data: recentSubs },
      { data: recentUnsubs },
      { data: typeRows },
      { data: subRows, count: totalRows },
      { data: consents },
    ] = await Promise.all([
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId).in('status', ['confirmed', 'pending_confirmation']),
      supabase.from('newsletter_subscriptions').select('*', { count: 'exact', head: true }).eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('created_at').eq('site_id', siteId).in('status', ['confirmed']).gte('created_at', thirtyDaysAgo),
      supabase.from('newsletter_subscriptions').select('unsubscribed_at').eq('site_id', siteId).eq('status', 'unsubscribed').gte('unsubscribed_at', thirtyDaysAgo),
      supabase.from('newsletter_types').select('id, name, color, cadence_paused').eq('site_id', siteId),
      supabase.from('newsletter_subscriptions').select('id, email, status, newsletter_id, created_at, locale').eq('site_id', siteId).order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1),
      supabase.from('consents').select('category').eq('site_id', siteId).eq('revoked_at', null as unknown as string),
    ])

    const typeMap = new Map<string, { name: string; color: string; paused: boolean }>()
    for (const t of typeRows ?? []) typeMap.set(t.id as string, { name: t.name as string, color: (t.color ?? '#6366f1') as string, paused: !!t.cadence_paused })

    const newSubs30d = (recentSubs ?? []).length
    const unsubs30d = (recentUnsubs ?? []).length
    const netGrowth = newSubs30d - unsubs30d
    const churnRate = (uniqueSubscribers ?? 0) > 0 ? (unsubs30d / (uniqueSubscribers ?? 1)) * 100 : 0

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
        status: (s.status === 'confirmed' ? 'active' : s.status === 'unsubscribed' ? 'unsubscribed' : 'active') as 'active' | 'at_risk' | 'bounced' | 'unsubscribed' | 'anonymized',
      }
    })

    const localeCounts: Record<string, number> = {}
    for (const s of subRows ?? []) {
      const loc = (s.locale as string) ?? 'unknown'
      localeCounts[loc] = (localeCounts[loc] ?? 0) + 1
    }

    const newsletterConsents = (consents ?? []).filter((c) => c.category === 'newsletter').length
    const analyticsConsents = (consents ?? []).filter((c) => c.category === 'analytics').length

    const distribution = Array.from(typeMap.entries()).map(([typeId, info]) => {
      const count = (subRows ?? []).filter((s) => s.newsletter_id === typeId).length
      return { typeId, typeName: info.name, typeColor: info.color, count, share: (totalRows ?? 0) > 0 ? (count / (totalRows ?? 1)) * 100 : 0 }
    })

    return {
      healthStrip: {
        uniqueSubscribers: uniqueSubscribers ?? 0,
        totalSubscriptions: totalSubscriptions ?? 0,
        netGrowth30d: netGrowth,
        churnRate,
        avgOpenRate: 0,
        lgpdConsent: (uniqueSubscribers ?? 0) > 0 ? (newsletterConsents / (uniqueSubscribers ?? 1)) * 100 : 0,
      },
      growth: [],
      distribution,
      engagementByType: Array.from(typeMap.entries()).map(([typeId, info]) => ({
        typeId, typeName: info.name, typeColor: info.color,
        subscribers: 0, openRate: 0, clickRate: 0, bounceRate: 0,
        sparkline: [], paused: info.paused,
      })),
      subscribers: { rows, total: totalRows ?? 0, page },
      locale: localeCounts,
      lgpdConsent: { newsletter: newsletterConsents, analytics: analyticsConsents, anonymized: 0, version: '' },
      recentActivity: [],
    }
  },
  ['newsletter-audience'],
  { tags: ['newsletter-hub', 'newsletter-audience'], revalidate: 60 },
)
