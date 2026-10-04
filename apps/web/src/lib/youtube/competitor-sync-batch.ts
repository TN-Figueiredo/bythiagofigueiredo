import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { syncCompetitorChannel } from '@/lib/youtube/competitor-sync'
import { newProbeBudget, type ShortProbeStats } from '@/lib/youtube/short-classifier'
import { reclassifyStoredShortsRoundRobin } from '@/lib/youtube/short-backfill'
import { runControlProbe, warnIfProbeBlocked } from '@/lib/youtube/short-guard'

/** Depois disso o backfill de Shorts não começa (e o rodízio para): folga contra maxDuration = 300 s. */
export const BACKFILL_DEADLINE_MS = 230_000

export const SLOT_HOURS_SP = [0, 6, 12, 18] as const
const H = 3_600_000
const SP_OFFSET = 3 * H

/** Last 00/06/12/18 São Paulo boundary at or before `nowMs`. */
export function currentSlotStart(nowMs: number): number {
  const local = nowMs - SP_OFFSET
  const dayStart = Math.floor(local / (24 * H)) * 24 * H
  const hour = Math.floor((local - dayStart) / H)
  const slot = [...SLOT_HOURS_SP].reverse().find((h) => h <= hour) ?? 0
  return dayStart + slot * H + SP_OFFSET
}

/** Never synced, or synced before the current slot. */
export function isDue(lastSyncedAt: string | null, nowMs: number): boolean {
  return lastSyncedAt === null || Date.parse(lastSyncedAt) < currentSlotStart(nowMs)
}

export interface BatchResult {
  synced: number
  errors: number
  skipped: number
  remainingDue: number
  stoppedForTime: boolean
  shorts_probe?: ShortProbeStats
}

/** Health verdict: fail when at least half of the attempted channels errored. */
export function batchHealth(r: BatchResult): { ok: boolean; message?: string } {
  const attempted = r.errors + r.synced
  if (r.errors > 0 && r.errors >= r.synced) {
    return { ok: false, message: `${r.errors} of ${attempted} channels failed` }
  }
  return { ok: true }
}

export async function runCompetitorBatch(opts: {
  apiKey: string
  batchSize: number
  budgetMs: number
  now?: () => number
}): Promise<BatchResult> {
  const now = opts.now ?? Date.now
  const started = now()
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('competitor_channels')
    .select('id, channel_id, site_id, last_synced_at, sync_status')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
  if (error) throw new Error(`competitor batch: ${error.message}`)
  // Defensive: channels stuck in 'error' go after the healthy ones so they can
  // never starve the cursor. Array.sort is stable, so the oldest-first order
  // (nulls first) is kept within each group.
  const due = (data ?? [])
    .filter((r) => isDue(r.last_synced_at, started))
    .sort((a, b) => Number(a.sync_status === 'error') - Number(b.sync_status === 'error'))
  const probeBudget = newProbeBudget() // 60 sondas de Short por execução, divididas entre os canais
  // Sonda de controle uma vez por execução, antes das demais (I-2).
  if (due.length) await runControlProbe(sb, probeBudget, fetch)
  const res: BatchResult = { synced: 0, errors: 0, skipped: 0, remainingDue: 0, stoppedForTime: false }
  let taken = 0
  const syncedIds: string[] = []
  for (const row of due) {
    if (taken >= opts.batchSize) break
    if (now() - started > opts.budgetMs) {
      res.stoppedForTime = true
      break
    }
    taken++
    try {
      const r = await syncCompetitorChannel(row, opts.apiKey, { probeBudget, deferBackfill: true })
      if (r.skipped) res.skipped++
      else { res.synced++; syncedIds.push(row.id) }
    } catch (err) {
      res.errors++
      Sentry.captureException(err, {
        tags: { component: 'sync-youtube', mode: 'competitors' },
        extra: { channelId: row.channel_id, siteId: row.site_id },
      })
    }
  }
  // Backfill só depois de todos os vídeos novos (R114), em rodízio entre os canais sincronizados.
  try {
    await reclassifyStoredShortsRoundRobin(sb, syncedIds, started, probeBudget, fetch, () => now() - started > BACKFILL_DEADLINE_MS)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'sync-youtube', mode: 'competitors-shorts-backfill' } })
  }
  const st = probeBudget.stats!
  res.shorts_probe = { ...st }
  warnIfProbeBlocked(st)
  res.remainingDue = due.length - taken
  return res
}
