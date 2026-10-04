import * as Sentry from '@sentry/nextjs'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'
import { SHORT_CERTAIN_MAX_SECONDS, SHORT_MAX_SECONDS, probeShortsBatch, type ProbeBudget } from '@/lib/youtube/short-classifier'

/** Janela que a tela usa: 91 dias. */
export const SHORT_RECLASSIFY_WINDOW_DAYS = 91

/**
 * Vídeos gravados com is_short=false e 61–180 s, publicados nos últimos 91 dias. Por canal: mais recentes primeiro;
 * entre canais: rodízio (um de cada por volta), para um canal com 151 candidatos não deixar os outros sem sonda.
 * Só vira Short quando a sonda é conclusiva; inconclusivo fica false e volta a ser candidato. Devolve quantos viraram Short.
 */
export async function reclassifyStoredShortsRoundRobin(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  channelIds: string[],
  nowMs: number,
  budget: ProbeBudget,
  f: typeof fetch,
  shouldStop: () => boolean = () => false,
  beforeProbe?: () => Promise<void>,
): Promise<number> {
  if (budget.remaining <= 0 || !channelIds.length) return 0
  const cutoff = new Date(nowMs - SHORT_RECLASSIFY_WINDOW_DAYS * 86_400_000).toISOString()
  const report = (error: unknown, step: string) =>
    Sentry.captureException(error instanceof Error ? error : new Error(String((error as { message?: string })?.message ?? error)), { tags: { component: 'sync-youtube', mode: 'competitors-shorts-backfill', step } })
  const stopped = shouldStop()
  const lists: Array<Array<{ id: string; video_id: string }>> = []
  let totalCandidates = 0
  for (const channelId of channelIds) {
    const { data, count, error } = await supabase
      .from('competitor_videos')
      .select('id, video_id', stopped ? { count: 'exact', head: true } : { count: 'exact' })
      .eq('competitor_channel_id', channelId)
      .or('is_short.is.null,is_short.eq.false')
      .gt('duration_seconds', SHORT_CERTAIN_MAX_SECONDS)
      .lte('duration_seconds', SHORT_MAX_SECONDS)
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(budget.remaining)
    if (error) { report(error, 'select'); continue }
    const rows = (data ?? []) as Array<{ id: string; video_id: string }>
    lists.push(rows)
    totalCandidates += typeof count === 'number' ? Math.max(count, rows.length) : rows.length
  }
  if (stopped) { if (budget.stats) budget.stats.pending += totalCandidates; return 0 }
  const picked: Array<{ id: string; video_id: string }> = []
  for (let i = 0; picked.length < budget.remaining; i++) {
    let any = false
    for (const l of lists) { const r = l[i]; if (r && picked.length < budget.remaining) { picked.push(r); any = true } }
    if (!any) break
  }
  if (!picked.length) return 0
  if (beforeProbe) await beforeProbe()
  const probes = await probeShortsBatch(picked.map(r => r.video_id), budget, f, shouldStop)
  if (budget.stats) budget.stats.pending += Math.max(0, totalCandidates - probes.size)
  const shortIds = picked.filter(r => probes.get(r.video_id) === 'short').map(r => r.id)
  if (!shortIds.length) return 0
  const { error: upErr } = await supabase.from('competitor_videos').update({ is_short: true }).in('id', shortIds)
  if (upErr) { report(upErr, 'update'); return 0 }
  if (budget.stats) budget.stats.backfilled += shortIds.length
  return shortIds.length
}

export const reclassifyStoredShorts = (
  supabase: ReturnType<typeof getSupabaseServiceClient>, competitorChannelId: string, nowMs: number, budget: ProbeBudget, f: typeof fetch, beforeProbe?: () => Promise<void>,
): Promise<number> => reclassifyStoredShortsRoundRobin(supabase, [competitorChannelId], nowMs, budget, f, () => false, beforeProbe)
