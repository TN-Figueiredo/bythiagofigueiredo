// apps/web/src/lib/youtube/competitor-versions.ts
import crypto from 'crypto'
import { isNewThumb, type ThumbProbe } from '@/lib/youtube/thumb-fingerprint'

export type VersionField = 'title' | 'thumb' | 'desc'
export interface StoredVersion { id: string; field: VersionField; value_hash: string; thumb_etag: string | null; thumb_dhash: string | null; first_seen_at: string; last_seen_at: string }
export interface ObservedVideo { title: string; description: string; thumb: ThumbProbe | null }
export interface SyncWindow { prevOkAt: string | null; now: string }
type Precision = 'min' | '6h' | '1d'
export interface VersionPlan {
  touch: string[]
  close: string[]
  open: Array<{ field: VersionField; value_text: string | null; value_hash: string; has_text: boolean; precision: Precision | 'first'; window_start: string | null; first_seen_at: string; thumb?: ThumbProbe }>
  changes: Array<{ field: VersionField; fromId: string; precision: Precision; window_start: string | null; window_end: string }>
}

const SLOT_MS = 7 * 3_600_000 // one 6 h slot + 1 h of batch slack

export function normalizeDescription(text: string): string {
  return text.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim()
}
export function hashValue(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function windowPrecision(w: SyncWindow): Precision {
  if (!w.prevOkAt) return '1d'
  return Date.parse(w.now) - Date.parse(w.prevOkAt) <= SLOT_MS ? '6h' : '1d'
}

export function reconcileVideoVersions(current: StoredVersion[], observed: ObservedVideo, w: SyncWindow, opts: { lastModifiedMinute: boolean }): VersionPlan {
  const plan: VersionPlan = { touch: [], close: [], open: [], changes: [] }
  const cur = (f: VersionField) => current.find(v => v.field === f) ?? null

  const textField = (field: 'title' | 'desc', raw: string) => {
    const value = field === 'desc' ? normalizeDescription(raw) : raw
    const hash = hashValue(value), prev = cur(field)
    if (!prev) { plan.open.push({ field, value_text: value, value_hash: hash, has_text: true, precision: 'first', window_start: null, first_seen_at: w.now }); return }
    if (prev.value_hash === hash) { plan.touch.push(prev.id); return }
    const precision = windowPrecision(w)
    plan.close.push(prev.id)
    plan.open.push({ field, value_text: value, value_hash: hash, has_text: true, precision, window_start: w.prevOkAt, first_seen_at: w.now })
    plan.changes.push({ field, fromId: prev.id, precision, window_start: w.prevOkAt, window_end: w.now })
  }
  textField('title', observed.title)
  textField('desc', observed.description)

  const t = observed.thumb
  if (t) {
    const prev = cur('thumb')
    const prevFp = prev ? { etag: prev.thumb_etag, dhash: prev.thumb_dhash } : null
    if (!isNewThumb(prevFp, t)) { if (prev) plan.touch.push(prev.id) }
    else {
      const hash = t.dhash ?? hashValue(t.etag ?? t.url)
      if (!prev) plan.open.push({ field: 'thumb', value_text: null, value_hash: hash, has_text: false, precision: 'first', window_start: null, first_seen_at: w.now, thumb: t })
      else {
        const lm = t.lastModified ? Date.parse(t.lastModified) : NaN
        const inWindow = Number.isFinite(lm) && w.prevOkAt !== null && lm > Date.parse(w.prevOkAt) && lm <= Date.parse(w.now)
        const precision: Precision = opts.lastModifiedMinute && inWindow ? 'min' : windowPrecision(w)
        const firstSeen = precision === 'min' ? new Date(lm).toISOString() : w.now
        plan.close.push(prev.id)
        plan.open.push({ field: 'thumb', value_text: null, value_hash: hash, has_text: false, precision, window_start: w.prevOkAt, first_seen_at: firstSeen, thumb: t })
        plan.changes.push({ field: 'thumb', fromId: prev.id, precision, window_start: w.prevOkAt, window_end: firstSeen })
      }
    }
  }
  return plan
}
