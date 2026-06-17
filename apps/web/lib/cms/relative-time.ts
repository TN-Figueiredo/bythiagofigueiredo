/**
 * Compact relative time for CMS list "Updated" columns: `now` / `Nh` / `Nd`.
 * `now` is injectable for deterministic tests. (Other CMS modules — newsletter,
 * playlists — roll their own relative-time helpers; adopt this one when touched.)
 */
export function relTimeShort(iso: string, now: number = Date.now()): string {
  const diffH = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 3_600_000))
  if (diffH < 1) return 'now'
  if (diffH < 24) return `${diffH}h`
  return `${Math.floor(diffH / 24)}d`
}
