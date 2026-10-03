import type { ServiceContext, ServiceResult } from './types'
import { ok, err, PipelineServiceError } from './types'
import { oneEmbed } from '@/lib/supabase/one-embed'
import { loadRows, rowsToDataset, type ObservatoryRows } from '@/lib/youtube/observatorio/load'
import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { createObservatory, type Observatory } from '@/lib/youtube/observatorio'
import { legacyGrids } from '@/lib/youtube/observatorio/grids'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompetitorChannelRow {
  id: string
  channel_id: string
  channel_name: string
  thumbnail_url: string | null
  subscriber_count: number | null
  video_count: number
  last_synced_at: string | null
  added_at: string | null
  avg_engagement: number | null
}

export interface CompetitorChannelList {
  channels: CompetitorChannelRow[]
  count: number
}

export interface CompetitorChangeRow {
  id: string
  video_id: string
  video_title: string | null
  channel_name: string
  change_type: string
  old_title: string | null
  new_title: string | null
  old_thumbnail_url: string | null
  new_thumbnail_url: string | null
  view_count_at_change: number | null
  detected_at: string
  bookmarked: boolean
}

export interface CompetitorChangeList {
  changes: CompetitorChangeRow[]
  count: number
}

export interface CompetitorOutlierRow {
  id: string
  video_id: string
  title: string | null
  thumbnail_url: string | null
  channel_name: string
  /** null = the channel hides the counter (never 0). */
  view_count: number | null
  like_count: number | null
  comment_count: number
  duration_seconds: number | null
  published_at: string | null
  multiplier: number
  tier: 'mid' | 'high' | 'top'
  /** How the multiplier was computed: same life day vs the channel, or the age-band approximation. */
  method: 'mesmo dia de vida' | 'aproximação por faixa' | null
  /** Videos in the comparison base. */
  n: number
  /** Canonical engine text, e.g. "3,2× vs vídeos do canal no mesmo dia de vida (dia 5, n = 8)". */
  label: string | null
  /** Phase id: estourando | recente | perene | antigo | novos | sem-ritmo. */
  phase: string
}

export interface CompetitorOutlierList {
  outliers: CompetitorOutlierRow[]
  count: number
}

export interface CompetitorInsightsData {
  play_of_week: {
    topic_bold: string
    formula_bold: string
    formula_mult: number
    window_bold: string
    window_reason: string
  } | null
  cadence: Array<{
    channel_name: string
    channel_id: string
    freq: number
    window: string
    last_upload_days: number
  }>
  formulas: Array<{
    label: string
    hint: string
    multiplier: number
    count: number
    example_title: string
  }>
  content_gaps: Array<{
    topic: string
    competitor_count: number
    avg_views: number
    we_cover: boolean
    channel_names: string[]
  }>
  heatmap: number[][]
  tags: Array<{
    tag: string
    count: number
    avg_views: number
    channel_names: string[]
  }>
  engagement: Array<{
    channel_name: string
    engagement_rate: number
    is_us: boolean
  }>
}

export interface CompetitorChangeFilters {
  type?: string | null
  bookmarked?: boolean | null
  limit?: number
}

export interface CompetitorOutlierFilters {
  tier?: string | null
  limit?: number
  /** 'long' (default) or 'short' — the engine never mixes formats in one comparison. */
  fmt?: 'long' | 'short'
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const BR_DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const

const FORMULA_PATTERNS: Array<{ label: string; hint: string; test: (t: string) => boolean }> = [
  { label: 'Nome do lugar', hint: 'o estrangeiro nítido', test: t => /\b(bangkok|tailândia|vietnam|vietnã|japão|tóquio|coreia|seul|bali|índia|filipinas|china|asia|ásia|europa|delhi|hanói)\b/i.test(t) },
  { label: 'Primeira pessoa', hint: '"larguei tudo"', test: t => /^(eu |fui |larguei |cheguei |morei |voltei |tentei |decidi |saí )/i.test(t) },
  { label: 'Preço em R$', hint: 'o número que dói', test: t => /R\$\s*[\d.,]+|por apenas|custou/i.test(t) },
  { label: 'Em dólar', hint: 'arbitragem de moeda', test: t => /dólar|dollar|ganhando em/i.test(t) },
  { label: 'Número/lista', hint: 'concretude', test: t => /^\d+\s|TOP \d|\d+ (coisas|razões|motivos|dicas|erros|lugares)/i.test(t) },
  { label: 'Passaporte BR · solo', hint: 'flex geográfico', test: t => /passaporte|sozinho|solo/i.test(t) && /brasil|brasileiro/i.test(t) },
]

// ---------------------------------------------------------------------------
// list channels
// ---------------------------------------------------------------------------

/** List all competitor channels for the site with stats (subscriber count, engagement). */
export async function listCompetitorChannels(
  ctx: ServiceContext,
): Promise<ServiceResult<CompetitorChannelList>> {
  const { supabase, siteId } = ctx

  const { data: channels, error: chErr } = await supabase
    .from('competitor_channels')
    .select('id, channel_id, channel_name, thumbnail_url, subscriber_count, last_synced_at, added_at')
    .eq('site_id', siteId)
    .order('added_at', { ascending: false })

  if (chErr) return err('DB_ERROR', 'Failed to load competitor channels', 500)

  const safeChannels = channels ?? []
  const channelIds = safeChannels.map(ch => ch.id)

  // Fetch videos for engagement computation
  type VidRow = {
    competitor_channel_id: string
    view_count: number | null
    like_count: number | null
    comment_count: number | null
  }
  const allVids: VidRow[] = []
  for (const chId of channelIds) {
    const { data: cv } = await supabase
      .from('competitor_videos')
      .select('competitor_channel_id, view_count, like_count, comment_count')
      .eq('competitor_channel_id', chId)
      .order('published_at', { ascending: false })
      .limit(50)
    if (cv) allVids.push(...(cv as VidRow[]))
  }

  const vidsByChannel = new Map<string, VidRow[]>()
  for (const v of allVids) {
    const list = vidsByChannel.get(v.competitor_channel_id) ?? []
    list.push(v)
    vidsByChannel.set(v.competitor_channel_id, list)
  }

  const result: CompetitorChannelRow[] = safeChannels.map(ch => {
    const vids = vidsByChannel.get(ch.id) ?? []
    const totalViews = vids.reduce((s, v) => s + (v.view_count ?? 0), 0)
    const totalEng = vids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
    const avgEngagement = totalViews > 0 ? totalEng / totalViews : null

    return {
      id: ch.id,
      channel_id: ch.channel_id,
      channel_name: ch.channel_name,
      thumbnail_url: ch.thumbnail_url,
      subscriber_count: ch.subscriber_count,
      video_count: vids.length,
      last_synced_at: ch.last_synced_at,
      added_at: ch.added_at,
      avg_engagement: avgEngagement,
    }
  })

  return ok({ channels: result, count: result.length })
}

// ---------------------------------------------------------------------------
// list changes
// ---------------------------------------------------------------------------

/** List competitor changes with type/bookmarked filters. */
export async function listCompetitorChanges(
  ctx: ServiceContext,
  filters: CompetitorChangeFilters,
): Promise<ServiceResult<CompetitorChangeList>> {
  const { supabase, siteId } = ctx
  const changeLimit = Math.min(filters.limit ?? 25, 100)

  let query = supabase
    .from('competitor_changes')
    .select('id, change_type, old_title, new_title, old_thumbnail_url, new_thumbnail_url, view_count_at_change, detected_at, bookmarked, competitor_videos!inner(title, video_id, competitor_channels!inner(channel_name))')
    .eq('site_id', siteId)
    .order('detected_at', { ascending: false })
    .limit(changeLimit)

  if (filters.type && filters.type !== 'all') {
    query = query.eq('change_type', filters.type)
  }
  if (filters.bookmarked != null) {
    query = query.eq('bookmarked', filters.bookmarked)
  }

  const { data: rawChanges, error: changeErr } = await query
  if (changeErr) return err('DB_ERROR', 'Failed to load competitor changes', 500)

  type ChangeRow = NonNullable<typeof rawChanges>[number]

  const changes: CompetitorChangeRow[] = (rawChanges ?? []).map((c: ChangeRow) => {
    const vidInfo = oneEmbed(c.competitor_videos)
    const chInfo = vidInfo ? oneEmbed(vidInfo.competitor_channels) : null
    return {
      id: c.id,
      video_id: vidInfo?.video_id ?? '',
      video_title: vidInfo?.title ?? null,
      channel_name: chInfo?.channel_name ?? '',
      change_type: c.change_type,
      old_title: c.old_title,
      new_title: c.new_title,
      old_thumbnail_url: c.old_thumbnail_url,
      new_thumbnail_url: c.new_thumbnail_url,
      view_count_at_change: c.view_count_at_change,
      detected_at: c.detected_at,
      bookmarked: c.bookmarked,
    }
  })

  return ok({ changes, count: changes.length })
}

// ---------------------------------------------------------------------------
// list outliers
// ---------------------------------------------------------------------------

/** Loads the observatory once per request (one query per table) — the single calculation layer. */
async function loadObservatory(ctx: ServiceContext): Promise<{ rows: ObservatoryRows; obs: Observatory }> {
  const now = observatoryNow()
  let rows: ObservatoryRows
  try {
    rows = await loadRows({ siteId: ctx.siteId, now, supabase: ctx.supabase })
  } catch (e) {
    throw new PipelineServiceError('DB_ERROR', 'Failed to load competitor channels', 500, { cause: e instanceof Error ? e.message : String(e) })
  }
  return { rows, obs: createObservatory(rowsToDataset(rows, now)) }
}

/** List competitor outlier videos (multiplier ≥ 2× vs the channel, computed by the observatory engine). */
export async function listCompetitorOutliers(
  ctx: ServiceContext,
  filters: CompetitorOutlierFilters,
): Promise<ServiceResult<CompetitorOutlierList>> {
  const { rows: dbRows, obs } = await loadObservatory(ctx)
  const thumbOf = new Map(dbRows.videos.map(v => [v.id, v.thumbnail_url]))
  const tierMap: Record<string, 'top' | 'high' | 'mid'> = { S: 'top', A: 'high', B: 'mid' }
  const res = obs.outliers({ ages: 'all', fmt: filters.fmt ?? 'long' })
  let rows: CompetitorOutlierRow[] = res.items.map(it => ({
    id: it.video.id, video_id: it.video.ytId, title: it.video.title, thumbnail_url: it.video.thumbs.at(-1)?.blobUrl ?? thumbOf.get(it.video.id) ?? null,
    channel_name: obs.channel(it.video.ch)!.name, view_count: it.video.views ?? null, like_count: it.video.likes ?? null, comment_count: it.video.comments,
    duration_seconds: it.video.dur, published_at: new Date(it.video.pub).toISOString(),
    multiplier: Math.round((it.mult.value ?? 0) * 10) / 10, tier: obs.tierOf(it.mult.value)!, method: it.mult.method, n: it.mult.n, label: it.mult.label ?? null, phase: it.phase.id,
  }))
  if (filters.tier && filters.tier !== 'all') rows = rows.filter(r => r.tier === (tierMap[filters.tier!] ?? filters.tier))
  return ok({ outliers: rows.slice(0, Math.min(filters.limit ?? 25, 100)), count: rows.length })
}

// ---------------------------------------------------------------------------
// aggregate insights
// ---------------------------------------------------------------------------

/** Heatmap/hits/cadence come from the engine (São Paulo time); tags, gaps and engagement stay as before. */
const RECENT_PER_CHANNEL = 200

/** Aggregate competitor insights (play of week, cadence, formulas, gaps, heatmap, tags, engagement). */
export async function getCompetitorInsights(
  ctx: ServiceContext,
): Promise<ServiceResult<CompetitorInsightsData>> {
  const { rows, obs } = await loadObservatory(ctx)
  const safeChannels = [...rows.channels].sort((a, b) => (b.added_at ?? '').localeCompare(a.added_at ?? ''))

  // Raw rows for tags/engagement: the most recent videos per channel (same window as before).
  const vidsByChannel = new Map<string, ObservatoryRows['videos']>()
  for (const v of [...rows.videos].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))) {
    const list = vidsByChannel.get(v.competitor_channel_id) ?? []
    if (list.length < RECENT_PER_CHANNEL) list.push(v)
    vidsByChannel.set(v.competitor_channel_id, list)
  }
  const allVids = [...vidsByChannel.values()].flat()

  // Own channel data for engagement comparison and gap analysis
  const ownVids = [...rows.ownVideos].sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, RECENT_PER_CHANNEL)
  const ownTotalViews = ownVids.reduce((s, v) => s + (v.view_count ?? 0), 0)
  const ownTotalEng = ownVids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
  const ourEngRate = ownTotalViews > 0 ? ownTotalEng / ownTotalViews : 0

  // ── Heatmap: 7x24 (day-of-week x hour, SP) — publication count from the engine ──
  const { heatmap, hitsHeatmap } = legacyGrids(obs)

  // ── Tags ──
  const tagStats = new Map<string, { count: number; totalViews: number; channels: Set<string> }>()
  for (const v of allVids) {
    const tags = (v.tags as string[] | null) ?? []
    const chName = safeChannels.find(c => c.id === v.competitor_channel_id)?.channel_name ?? ''
    for (const tag of tags) {
      const s = tagStats.get(tag) ?? { count: 0, totalViews: 0, channels: new Set<string>() }
      s.count++
      s.totalViews += v.view_count ?? 0
      if (chName) s.channels.add(chName)
      tagStats.set(tag, s)
    }
  }
  const tagsSorted = [...tagStats.entries()]
    .map(([tag, s]) => ({ tag, count: s.count, avg_views: s.count > 0 ? Math.round(s.totalViews / s.count) : 0, channel_names: [...s.channels] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // ── Engagement comparison ──
  const engagement = safeChannels
    .filter(ch => (vidsByChannel.get(ch.id) ?? []).length > 0)
    .map(ch => {
      const vids = vidsByChannel.get(ch.id) ?? []
      const totalV = vids.reduce((s, v) => s + (v.view_count ?? 0), 0)
      const totalE = vids.reduce((s, v) => s + (v.like_count ?? 0) + (v.comment_count ?? 0), 0)
      return {
        channel_name: ch.channel_name,
        engagement_rate: totalV > 0 ? totalE / totalV : 0,
        is_us: false,
      }
    })
    .sort((a, b) => b.engagement_rate - a.engagement_rate)

  engagement.push({
    channel_name: 'Você',
    engagement_rate: ourEngRate,
    is_us: true,
  })
  engagement.sort((a, b) => b.engagement_rate - a.engagement_rate)

  // ── Content gaps ──
  const ownTagSet = new Set<string>()
  for (const v of ownVids) {
    const vTags = (v as { tags?: string[] | null }).tags
    if (vTags) for (const t of vTags) ownTagSet.add(t.toLowerCase())
  }
  const gaps = tagsSorted.slice(0, 10).map(t => ({
    topic: t.tag,
    competitor_count: t.count,
    avg_views: t.avg_views,
    we_cover: ownTagSet.has(t.tag.toLowerCase()),
    channel_names: t.channel_names,
  }))

  // ── Cadence per channel (engine: long videos, 13 weeks, habit in SP) ──
  const cadence = safeChannels.map(ch => {
    const cad = obs.cadence(ch.id, 'long')
    return {
      channel_name: ch.channel_name,
      channel_id: ch.channel_id,
      freq: cad.pw,
      window: cad.habit.costuma ? `${BR_DAY_NAMES[(cad.habit.dow! + 6) % 7]} ${cad.habit.hour}h` : '—',
      last_upload_days: cad.lastUpload != null ? Math.floor((obs.NOW - cad.lastUpload) / 86_400_000) : -1,
    }
  })

  // ── Outliers for formula analysis (engine) ──
  const outliersList = obs.outliers({ ages: 'all', fmt: 'long' }).items
    .map(it => ({ title: it.video.title, multiplier: Math.round(it.mult.value! * 10) / 10 }))

  // ── Formulas ──
  const formulaAccum = new Map<string, { label: string; hint: string; totalMult: number; count: number; bestTitle: string; bestMult: number }>()
  for (const o of outliersList) {
    for (const p of FORMULA_PATTERNS) {
      if (!p.test(o.title)) continue
      const acc = formulaAccum.get(p.label) ?? { label: p.label, hint: p.hint, totalMult: 0, count: 0, bestTitle: '', bestMult: 0 }
      acc.totalMult += o.multiplier
      acc.count++
      if (o.multiplier > acc.bestMult) { acc.bestMult = o.multiplier; acc.bestTitle = o.title }
      formulaAccum.set(p.label, acc)
    }
  }
  const formulas = [...formulaAccum.values()]
    .filter(f => f.count > 0)
    .map(f => ({
      label: f.label,
      hint: f.hint,
      multiplier: Math.round((f.totalMult / f.count) * 10) / 10,
      count: f.count,
      example_title: f.bestTitle,
    }))
    .sort((a, b) => b.multiplier - a.multiplier)

  // ── Play of the week ──
  let play: CompetitorInsightsData['play_of_week'] = null
  if (outliersList.length >= 3 && formulas.length > 0) {
    const topicBold = gaps.find(g => !g.we_cover)?.topic ?? tagsSorted[0]?.tag ?? ''
    const topFormula = formulas[0]!

    let windowBold = ''
    const windowReason = 'onde nascem os hits e o volume é fraco'
    let bestScore = Infinity
    for (let di = 0; di < 7; di++) {
      const heatRow = heatmap[di]
      const hitsRow = hitsHeatmap[di]
      if (!heatRow || !hitsRow) continue
      for (let hi = 0; hi < 24; hi++) {
        const hitsCount = hitsRow[hi] ?? 0
        const volume = heatRow[hi] ?? 0
        if (hitsCount === 0) continue
        const score = volume / (hitsCount + 1)
        if (score < bestScore) {
          bestScore = score
          windowBold = `${BR_DAY_NAMES[di]} ${hi}h`
        }
      }
    }
    if (!windowBold) {
      let minVol = Infinity
      for (let di = 0; di < 7; di++) {
        const row = heatmap[di]
        if (!row) continue
        for (let hi = 0; hi < 24; hi++) {
          const vol = row[hi] ?? 0
          if (vol > 0 && vol < minVol) { minVol = vol; windowBold = `${BR_DAY_NAMES[di]} ${hi}h` }
        }
      }
    }

    if (topicBold && windowBold) {
      play = {
        topic_bold: topicBold,
        formula_bold: topFormula.label,
        formula_mult: topFormula.multiplier,
        window_bold: windowBold,
        window_reason: windowReason,
      }
    }
  }

  return ok({
    play_of_week: play,
    cadence,
    formulas,
    content_gaps: gaps,
    heatmap,
    tags: tagsSorted,
    engagement,
  })
}
