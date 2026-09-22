/**
 * Reading `youtube_video_analytics` honestly.
 *
 * Every row of that table is the TOTAL over the rolling `SYNC_WINDOW_DAYS`
 * window as of its `date` (see `analytics-window.ts`) — NOT that day's count.
 * The sync cron re-asks the YouTube Analytics API for the same window every
 * day and upserts one row per (video, date), so a video that never gains a
 * view still gets a fresh row carrying the same total.
 *
 * Summing those rows therefore multiplies the same views by the number of
 * syncs. Measured against production on 2026-09-22 for channel
 * UCRHtzTwaEpcjspAS2hbqmrA: summing gave 543 views "in 28 days" across 17
 * sync dates, while the truth — the value on each video's most recent row —
 * was 32. A 17x inflation, served by the API that Cowork reads.
 *
 * The window total for a video is the value on its MOST RECENT row. That is
 * what every consumer must use, and it is why this module exists instead of
 * the same three-line loop being re-derived (and re-broken) in six places.
 */

/** The minimum shape of an analytics row: which video, and as of when. */
export interface RollingWindowRow {
  youtube_video_id: string
  date: string
}

/**
 * The most recent row per video — i.e. the current window total for each.
 *
 * `date` is a `YYYY-MM-DD` string, so lexicographic comparison is chronological.
 * Callers must NOT reduce over the input rows; that is the bug this replaces.
 */
export function latestRowPerVideo<T extends RollingWindowRow>(rows: readonly T[]): Map<string, T> {
  const latest = new Map<string, T>()
  for (const row of rows) {
    const current = latest.get(row.youtube_video_id)
    if (current === undefined || row.date > current.date) {
      latest.set(row.youtube_video_id, row)
    }
  }
  return latest
}

/**
 * The most recent row of an already per-video list of rows, or `null` when the
 * list is empty. Absence stays absence — it never becomes a zero.
 */
export function latestRow<T extends { date: string }>(rows: readonly T[]): T | null {
  let latest: T | null = null
  for (const row of rows) {
    if (latest === null || row.date > latest.date) latest = row
  }
  return latest
}

/**
 * Channel-wide total for a metric across videos: the sum of each video's
 * CURRENT window total — one contribution per video, never one per sync date.
 */
export function sumLatestPerVideo<T extends RollingWindowRow>(
  rows: readonly T[],
  pick: (row: T) => number,
): number {
  let total = 0
  for (const row of latestRowPerVideo(rows).values()) total += pick(row)
  return total
}
