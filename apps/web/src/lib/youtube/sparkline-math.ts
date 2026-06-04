export function computeViewGrowthSparkline(
  snapshots: ReadonlyArray<{ view_count: number | null; snapshot_date: string }>,
  windowSize = 7,
): number[] {
  if (snapshots.length < 2) return []

  const deltas: number[] = []

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!
    const curr = snapshots[i]!
    const prevViews = prev.view_count ?? 0
    const currViews = curr.view_count ?? 0
    const rawDelta = currViews - prevViews

    const prevDate = new Date(prev.snapshot_date).getTime()
    const currDate = new Date(curr.snapshot_date).getTime()
    const dayGap = Math.round((currDate - prevDate) / 86_400_000)

    if (dayGap <= 1) {
      deltas.push(Math.max(0, rawDelta))
    } else {
      const perDay = rawDelta / dayGap
      for (let d = 0; d < dayGap; d++) {
        deltas.push(Math.max(0, perDay))
      }
    }
  }

  const smoothed: number[] = deltas.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1)
    const window = deltas.slice(start, i + 1)
    const avg = window.reduce((sum, v) => sum + v, 0) / window.length
    return Math.round(avg)
  })

  return smoothed.slice(-30)
}
