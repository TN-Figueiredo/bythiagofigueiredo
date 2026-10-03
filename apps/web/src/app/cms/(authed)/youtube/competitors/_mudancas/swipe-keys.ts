/**
 * Engine change → `competitor_changes` row key for the swipe file (pure).
 * - A real change: its `toId` (= `to_version_id` of the row the sync wrote).
 * - A legacy row loaded as a pre-series version: its `toId` IS the row id.
 * - The last legacy row merged into the first real version (load.ts withLegacy): `toId` is the real version, which no
 *   row names. The legacy row is recovered from the version before it: `<id>/antes` (single legacy row) or the legacy
 *   row right after `fromId` in detection order. Unresolvable → null (R41: the button is disabled).
 */
import type { ObsChange } from '@/lib/youtube/observatorio/changes'

export interface SwipeLegacyRow { id: string; video_id: string; change_type: string; detected_at: string | null }

const FIELD: Record<string, string> = { title: 'title', desc: 'description' }

export function resolveSwipeKeys(changes: readonly ObsChange[], legacy: readonly SwipeLegacyRow[]): Map<string, string | null> {
  const ids = new Set(legacy.map(l => l.id))
  const groups = new Map<string, SwipeLegacyRow[]>()
  for (const l of legacy) {
    if (l.detected_at == null || !Number.isFinite(Date.parse(l.detected_at))) continue
    const k = l.video_id + '|' + l.change_type, g = groups.get(k)
    if (g) g.push(l); else groups.set(k, [l])
  }
  for (const g of groups.values()) g.sort((a, b) => Date.parse(a.detected_at!) - Date.parse(b.detected_at!))
  const out = new Map<string, string | null>()
  for (const c of changes) {
    if (ids.has(c.toId)) { out.set(c.id, c.toId); continue }
    if (c.fromId.endsWith('/antes')) {
      const base = c.fromId.slice(0, -'/antes'.length)
      out.set(c.id, ids.has(base) ? base : null); continue
    }
    if (ids.has(c.fromId)) {
      const g = groups.get(c.video + '|' + (FIELD[c.type] ?? c.type)) ?? []
      const i = g.findIndex(l => l.id === c.fromId)
      out.set(c.id, i >= 0 && g[i + 1] ? g[i + 1]!.id : null); continue
    }
    out.set(c.id, c.toId)
  }
  return out
}
