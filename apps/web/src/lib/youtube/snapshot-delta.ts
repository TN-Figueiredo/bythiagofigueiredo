export interface ChannelSnapshot {
  snapshot_date: string
  subscriber_count: number | null
  view_count: number | null
}

/** Delta semanal. Exige snapshots ordenados ascendente por data. */
export function computeSnapshotDelta(
  snapshots: ReadonlyArray<ChannelSnapshot>,
  field: 'subscriber_count' | 'view_count',
  now: number = Date.now(),
): number | null {
  if (snapshots.length < 2) return null
  const latest = snapshots[snapshots.length - 1]!
  const sevenDaysAgoStr = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10)
  const weekAgoSnap =
    snapshots.reduce<ChannelSnapshot | null>(
      (best, s) => (s.snapshot_date < sevenDaysAgoStr ? s : best),
      null,
    ) ?? snapshots[0]!
  if (weekAgoSnap.snapshot_date === latest.snapshot_date) return null
  return (latest[field] ?? 0) - (weekAgoSnap[field] ?? 0)
}
