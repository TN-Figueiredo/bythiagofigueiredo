'use client'

import { useCallback, useEffect, useRef } from 'react'
import { readRoteiro, type RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'
import { beatKind } from '@/lib/pipeline/video-perform'
import { ensureBeatIds, beatContentHash, type RecStatus } from '@/lib/pipeline/video-recording'
import {
  loadLocal,
  putLocal,
  applyRemote,
  dirtyRows,
  markSynced,
  rowKey,
  type LocalRecRow,
  type RemoteRecRow,
} from '@/lib/pipeline/recording-store'
import { useVideoEditorState, useVideoEditorDispatch } from './context'
import { useVideoData } from './data-context'
import { loadRecording, saveRecordingBeat, persistBeatIds } from './recording-actions'
import type { VideoLang } from './types'

/** Per-beat metadata the sync layer needs to enrich an upsert (name + content hash). */
interface BeatMeta {
  name: string
  contentHash: string
}

/** Build a `${lang}:${beatId}` → {name, contentHash} map over the lang's `fala` beats. */
function falaBeatMeta(beats: RoteiroBeatV3[], lang: VideoLang): Map<string, BeatMeta> {
  const out = new Map<string, BeatMeta>()
  for (const beat of beats) {
    if (beatKind(beat) !== 'fala' || !beat.id) continue
    out.set(`${lang}:${beat.id}`, { name: beat.name, contentHash: beatContentHash(beat) })
  }
  return out
}

/** Map local store rows for one lang into the reducer's `${lang}:${beatId}` keyed maps. */
function rowsToState(rows: LocalRecRow[], lang: VideoLang): {
  recStatus: Record<string, RecStatus>
  retakeNotes: Record<string, string>
} {
  const recStatus: Record<string, RecStatus> = {}
  const retakeNotes: Record<string, string> = {}
  for (const row of rows) {
    if (row.lang !== lang) continue
    const key = `${lang}:${row.beatId}`
    recStatus[key] = row.status
    if (row.retakeNote && row.retakeNote.trim()) retakeNotes[key] = row.retakeNote
  }
  return { recStatus, retakeNotes }
}

/** A `${lang}:${beatId}` key → `{ beatId, lang }`, or null when malformed. */
function parseKey(key: string): { lang: VideoLang; beatId: string } | null {
  const sep = key.indexOf(':')
  if (sep < 0) return null
  const lang = key.slice(0, sep)
  const beatId = key.slice(sep + 1)
  if ((lang !== 'pt' && lang !== 'en') || !beatId) return null
  return { lang, beatId }
}

/**
 * Local-first persistence + sync for per-beat recording status, driving the editor's
 * durable ledger end-to-end with the LOGGED-IN user's session auth (recording-actions.ts),
 * never the X-Pipeline-Key REST routes.
 *
 * Responsibilities, all mounted once in the shell:
 *   1. **Beat-id persistence (linchpin).** Once per (video, lang) with a roteiro, stamp
 *      stable ids via `persistBeatIds` so status keys (`${lang}:${beat.id}`) survive reloads.
 *      Guarded server-side (only writes when ids changed; loses a version CAS gracefully).
 *   2. **Hydrate.** On mount + lang switch: loadLocal → seed state immediately (offline-
 *      friendly), then loadRecording (server) → applyRemote → merged → HYDRATE_RECORDING
 *      (server wins for non-dirty rows; the pure merge core lives in recording-store).
 *   3. **Local-first write.** A single effect diffs `state.recStatus`/`retakeNotes` vs the
 *      last-synced snapshot; each changed beat → putLocal(dirty:true) + an opportunistic
 *      server upsert (failure leaves the row dirty for later). A synced-snapshot ref stops
 *      the effect from re-firing on its own dispatches (no infinite loop).
 *   4. **Opportunistic sync.** On mount + `window 'online'`: dirtyRows → upsert each →
 *      markSynced. Simple and safe — best-effort, never throws into render.
 */
export function useRecordingSync(): void {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()

  const { itemId, activeLang } = state

  // Last-synced snapshot of (recStatus, retakeNotes) — the diff baseline. Seeded by the
  // write effect itself after it persists, and by hydrate after it reconciles, so the
  // effect never treats a hydrate/its own writes as a fresh user edit.
  const syncedRef = useRef<{ status: Record<string, RecStatus>; notes: Record<string, string> }>({
    status: {},
    notes: {},
  })

  // Langs whose beat-ids have been persisted this mount (one-time per video+lang).
  const idPersistedRef = useRef<Set<VideoLang>>(new Set())
  // Langs currently hydrating — clamps duplicate hydrate runs (e.g. fast lang toggles).
  const hydratingRef = useRef<Set<VideoLang>>(new Set())

  // The active lang's roteiro beats, id-stamped in memory so meta keys match the durable
  // ledger even before the ids are persisted (mirrors the roteiro stage's ensureBeatIds).
  const rawRoteiro = data.roteiro?.[activeLang] ?? null
  const beatMeta = (() => {
    if (!rawRoteiro) return new Map<string, BeatMeta>()
    const { content } = ensureBeatIds(rawRoteiro)
    return falaBeatMeta(content.beats, activeLang)
  })()
  // Stable-enough dependency signature for the meta map (id|hash per beat).
  const beatMetaSig = [...beatMeta.entries()].map(([k, m]) => `${k}|${m.contentHash}`).join(',')

  // --- 1. Beat-id persistence (linchpin) ---------------------------------------------
  useEffect(() => {
    const lang = activeLang
    if (idPersistedRef.current.has(lang)) return
    if (!data.roteiro?.[lang]) return
    idPersistedRef.current.add(lang) // mark before await — one attempt per mount+lang
    void (async () => {
      try {
        await persistBeatIds(itemId, lang, state.version)
      } catch (e) {
        // Never crash the editor on a stamping failure — ids retry on the next clean load.
        console.warn('[recording-sync] persistBeatIds failed', e)
      }
    })()
    // version intentionally read at call time; re-running on every version bump would
    // re-attempt needlessly. Keyed on item+lang+roteiro presence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, activeLang, data.roteiro?.[activeLang]])

  // --- 2. Hydrate (local-first, then reconcile with server) --------------------------
  useEffect(() => {
    const lang = activeLang
    if (hydratingRef.current.has(lang)) return
    hydratingRef.current.add(lang)
    let cancelled = false

    void (async () => {
      try {
        // (a) Local-first: seed from IndexedDB immediately (offline-friendly).
        const local = await loadLocal(itemId, lang)
        if (!cancelled && local.length > 0) {
          const seeded = rowsToState(local, lang)
          dispatch({ type: 'HYDRATE_RECORDING', lang, ...seeded })
        }

        // (b) Server truth: load → merge (server wins for non-dirty) → hydrate.
        const res = await loadRecording(itemId, lang)
        if (cancelled || !res.ok) return
        const remote: RemoteRecRow[] = res.data.map((r) => ({
          pipelineId: itemId,
          lang,
          beatId: r.beat_id,
          status: r.status,
          retakeNote: r.retake_note ?? undefined,
          beatName: r.beat_name ?? undefined,
          contentHash: r.content_hash ?? undefined,
          // Remote rows have no client clock; treat them as the canonical baseline so the
          // merge prefers them over clean local rows (tie → remote in mergeRemoteRows).
          updatedAt: 0,
        }))
        const merged = await applyRemote(itemId, lang, remote)
        if (cancelled) return
        const next = rowsToState(merged, lang)
        // Refresh the synced baseline so the write effect won't re-emit hydrated values.
        const prefix = `${lang}:`
        const status = { ...syncedRef.current.status }
        const notes = { ...syncedRef.current.notes }
        for (const k of Object.keys(status)) if (k.startsWith(prefix)) delete status[k]
        for (const k of Object.keys(notes)) if (k.startsWith(prefix)) delete notes[k]
        for (const [k, v] of Object.entries(next.recStatus)) status[k] = v
        for (const [k, v] of Object.entries(next.retakeNotes)) notes[k] = v
        syncedRef.current = { status, notes }
        dispatch({ type: 'HYDRATE_RECORDING', lang, ...next })
      } catch (e) {
        console.warn('[recording-sync] hydrate failed', e)
      } finally {
        hydratingRef.current.delete(lang)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, activeLang])

  // --- 3. Local-first write path (diff vs synced snapshot, persist changed beats) -----
  useEffect(() => {
    // Defensive: older harnesses / partial seeds may omit these maps.
    const status = state.recStatus ?? {}
    const notes = state.retakeNotes ?? {}
    const prev = syncedRef.current

    // Collect changed keys (status differs OR note differs from the last-synced snapshot).
    const changedKeys = new Set<string>()
    for (const [k, v] of Object.entries(status)) {
      if (prev.status[k] !== v) changedKeys.add(k)
    }
    for (const [k, v] of Object.entries(notes)) {
      if (prev.notes[k] !== v) changedKeys.add(k)
    }
    // A note cleared (present before, absent now) is also a change worth persisting.
    for (const k of Object.keys(prev.notes)) {
      if (notes[k] === undefined && prev.notes[k] !== undefined && status[k] !== undefined) {
        changedKeys.add(k)
      }
    }
    if (changedKeys.size === 0) return

    // Advance the baseline IMMEDIATELY (synchronously) so a re-render before the awaits
    // settle doesn't re-enqueue the same change → no infinite loop.
    syncedRef.current = { status: { ...status }, notes: { ...notes } }

    void (async () => {
      for (const key of changedKeys) {
        const parsed = parseKey(key)
        if (!parsed) continue
        const st = status[key]
        if (!st) continue // a status entry should always exist for a tracked beat
        const note = notes[key]
        const meta = parsed.lang === activeLang ? beatMeta.get(key) : undefined
        const row: LocalRecRow = {
          pipelineId: itemId,
          lang: parsed.lang,
          beatId: parsed.beatId,
          status: st,
          retakeNote: note,
          beatName: meta?.name,
          contentHash: meta?.contentHash,
          updatedAt: Date.now(),
          dirty: true,
        }
        // (a) Local-first: durable immediately, survives offline.
        try { await putLocal(row) } catch (e) { console.warn('[recording-sync] putLocal failed', e) }

        // (b) Opportunistic server upsert — failure leaves the row dirty for later sync.
        try {
          const res = await saveRecordingBeat(itemId, parsed.lang, {
            beatId: parsed.beatId,
            status: st,
            retakeNote: note,
            beatName: meta?.name,
            contentHash: meta?.contentHash,
          })
          if (res.ok) await markSynced([rowKey(row)])
        } catch (e) {
          console.warn('[recording-sync] saveRecordingBeat failed', e)
        }
      }
    })()
    // beatMeta read at call time via beatMetaSig; itemId/activeLang stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recStatus, state.retakeNotes, itemId, activeLang, beatMetaSig])

  // --- 4. Opportunistic sync of leftover dirty rows (mount + 'online') ----------------
  const flushDirty = useCallback(async () => {
    try {
      const dirty = await dirtyRows()
      if (dirty.length === 0) return
      const synced: string[] = []
      for (const row of dirty) {
        const res = await saveRecordingBeat(row.pipelineId, row.lang, {
          beatId: row.beatId,
          status: row.status,
          retakeNote: row.retakeNote,
          beatName: row.beatName,
          contentHash: row.contentHash,
        })
        if (res.ok) synced.push(rowKey(row))
      }
      if (synced.length > 0) await markSynced(synced)
    } catch (e) {
      console.warn('[recording-sync] flushDirty failed', e)
    }
  }, [])

  useEffect(() => {
    void flushDirty()
    const onOnline = () => { void flushDirty() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flushDirty])
}
