import {
  YOUTUBE_DAILY_QUOTA,
  YOUTUBE_QUOTA_COSTS,
  type YouTubeOperation,
  type YouTubeQuotaUsage,
} from './types.js'

const QUOTA_WARNING_THRESHOLD = 0.8

export interface IQuotaStore {
  getUsage(siteId: string, date: string): Promise<YouTubeQuotaUsage | null>
  upsertUsage(
    siteId: string,
    date: string,
    units: number,
    operation: { op: string; units: number; at: string },
  ): Promise<void>
}

function todayUTC(date?: Date): string {
  const d = date ?? new Date()
  return d.toISOString().slice(0, 10)
}

export async function checkQuota(
  siteId: string,
  operation: YouTubeOperation,
  store: IQuotaStore,
): Promise<{ allowed: boolean; remaining: number; warning?: string }> {
  const cost = YOUTUBE_QUOTA_COSTS[operation]
  const usage = await store.getUsage(siteId, todayUTC())
  const used = usage?.units_used ?? 0
  const remaining = YOUTUBE_DAILY_QUOTA - used

  if (cost > remaining) {
    return {
      allowed: false,
      remaining,
      warning: `Quota exhausted: ${remaining} units remaining, ${cost} required for ${operation}`,
    }
  }

  const result: { allowed: boolean; remaining: number; warning?: string } = {
    allowed: true,
    remaining: remaining - cost,
  }

  const afterUsage = used + cost
  if (afterUsage >= YOUTUBE_DAILY_QUOTA * QUOTA_WARNING_THRESHOLD) {
    result.warning = `YouTube quota at ${Math.round((afterUsage / YOUTUBE_DAILY_QUOTA) * 100)}% (${afterUsage}/${YOUTUBE_DAILY_QUOTA} units)`
  }

  return result
}

export async function recordUsage(
  siteId: string,
  operation: YouTubeOperation,
  store: IQuotaStore,
): Promise<void> {
  const cost = YOUTUBE_QUOTA_COSTS[operation]
  const date = todayUTC()
  const entry = {
    op: operation,
    units: cost,
    at: new Date().toISOString(),
  }
  await store.upsertUsage(siteId, date, cost, entry)
}

export async function getUsage(
  siteId: string,
  date: Date,
  store: IQuotaStore,
): Promise<YouTubeQuotaUsage | null> {
  return store.getUsage(siteId, todayUTC(date))
}
