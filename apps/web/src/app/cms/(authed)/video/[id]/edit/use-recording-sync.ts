'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RoteiroBeatV3, RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'
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
import { useVideoEditorState, useVideoEditorDispatch, useSetLiveVersion } from './context'
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

/**
 * A stable-enough signature for one lang's roteiro: each beat's idx/name/kind + spoken text.
 * Drives the `useMemo` that stamps ids ONCE per session — a fresh `ensureBeatIds()` per render
 * would mint new UUIDs every time, orphaning status keyed on `${lang}:${beat.id}`.
 */
function roteiroSig(content: RoteiroContentV3 | null): string {
  if (!content) return ''
  return content.beats
    .map((b) => {
      const text = b.script.map((it) => ('text' in it ? it.text : `~${it.type}`)).join('|')
      return `${b.idx}:${b.id ?? ''}:${b.name}:${text}`
    })
    .join('||')
}

/** Map local store rows for one lang into the reducer's `${lang}:${beatId}` keyed maps. */
function rowsToState(rows: LocalRecRow[], lang: VideoLang): {
  recStatus: Record<string, RecStatus>
  retakeNotes: Record<string, string>
  recordedHash: Record<string, string>
} {
  const recStatus: Record<string, RecStatus> = {}
  const retakeNotes: Record<string, string> = {}
  const recordedHash: Record<string, string> = {}
  for (const row of rows) {
    if (row.lang !== lang) continue
    const key = `${lang}:${row.beatId}`
    recStatus[key] = row.status
    if (row.retakeNote && row.retakeNote.trim()) retakeNotes[key] = row.retakeNote
    // The hash the beat was recorded against — preserved verbatim so a later edit shows stale.
    if (row.contentHash) recordedHash[key] = row.contentHash
  }
  return { recStatus, retakeNotes, recordedHash }
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
 *      Reads the LIVE version (reducer mirror of editor-client's useState) so it doesn't lose
 *      a stale-version CAS forever; on success pushes the bumped version up so the next
 *      roteiro save doesn't 409; on a version_conflict it clears the persisted mark to retry.
 *   2. **Stable beat ids in render.** The roteiro is id-stamped via `useMemo` keyed on a
 *      stable signature, so a beat keeps ONE id for the session (no fresh UUID per render).
 *   3. **Hydrate.** On mount + lang switch: loadLocal → seed state immediately (offline-
 *      friendly), then loadRecording (server) → applyRemote → merged → HYDRATE_RECORDING.
 *      Keys touched this session are skipped so an in-flight local edit isn't clobbered.
 *   4. **Local-first write.** A single effect diffs `state.recStatus`/`retakeNotes` vs the
 *      last-synced snapshot; each changed beat → putLocal(dirty:true) + an opportunistic
 *      server upsert. The recorded content_hash is PRESERVED on note-only / non-record writes
 *      (only stamped fresh when a beat transitions INTO gravada/refazer), so stale survives.
 *   5. **Opportunistic sync.** On mount + `window 'online'`: dirtyRows → upsert → markSynced.
 */
export function useRecordingSync(): void {
  const state = useVideoEditorState()
  const dispatch = useVideoEditorDispatch()
  const data = useVideoData()
  const setLiveVersion = useSetLiveVersion()

  const { itemId, activeLang, version } = state

  // Last-synced snapshot of (recStatus, retakeNotes) — the diff baseline. Seeded by the
  // write effect itself after it persists, and by hydrate after it reconciles, so the
  // effect never treats a hydrate/its own writes as a fresh user edit.
  const syncedRef = useRef<{ status: Record<string, RecStatus>; notes: Record<string, string> }>({
    status: {},
    notes: {},
  })

  // Keys the user has touched (written) THIS session — recorded synchronously in the write
  // effect BEFORE any await. Hydrate keeps the LIVE value for these so server truth can't
  // clobber an unsynced local edit that's still racing through putLocal/saveRecordingBeat.
  const touchedRef = useRef<Set<string>>(new Set())

  // The latest live recording maps, mirrored into a ref so the async hydrate closure can
  // re-inject a touched key's CURRENT value (HYDRATE replaces the whole lang — without this,
  // dropping a touched key from the payload would wipe it instead of preserving it).
  const liveRef = useRef<{
    status: Record<string, RecStatus>
    notes: Record<string, string>
    recordedHash: Record<string, string>
  }>({ status: {}, notes: {}, recordedHash: {} })
  liveRef.current = {
    status: state.recStatus ?? {},
    notes: state.retakeNotes ?? {},
    recordedHash: state.recRecordedHash ?? {},
  }

  // Langs whose beat-ids have been persisted this mount (one-time per video+lang).
  const idPersistedRef = useRef<Set<VideoLang>>(new Set())
  // Langs currently hydrating — clamps duplicate hydrate runs (e.g. fast lang toggles).
  const hydratingRef = useRef<Set<VideoLang>>(new Set())

  // The CURRENTLY-RECORDED hashes (lang-qualified), carried from hydrate into state so the
  // write path can decide whether a write is a FRESH recording (transition into
  // gravada/refazer with a new hash) vs a note-only / pendente write that must preserve it.
  const recRecordedHash = state.recRecordedHash ?? {}

  // --- Stable id-stamped roteiro per lang (memoized — no fresh UUIDs per render) ----------
  const rawPt = data.roteiro?.pt ?? null
  const rawEn = data.roteiro?.en ?? null
  const sigPt = roteiroSig(rawPt)
  const sigEn = roteiroSig(rawEn)

  // Each memo stamps ids ONCE for its lang's signature, so a beat keeps one id all session.
  const stampedPt = useMemo(() => (rawPt ? ensureBeatIds(rawPt).content : null), [sigPt])
  const stampedEn = useMemo(() => (rawEn ? ensureBeatIds(rawEn).content : null), [sigEn])

  // Per-lang `${lang}:${id}` → meta maps. Built for BOTH langs so the write effect can enrich
  // a changed inactive-lang key (never upserting a null content_hash over a real one).
  const metaPt = useMemo(() => (stampedPt ? falaBeatMeta(stampedPt.beats, 'pt') : new Map<string, BeatMeta>()), [stampedPt])
  const metaEn = useMemo(() => (stampedEn ? falaBeatMeta(stampedEn.beats, 'en') : new Map<string, BeatMeta>()), [stampedEn])
  const metaFor = useCallback(
    (key: string): BeatMeta | undefined => (key.startsWith('en:') ? metaEn.get(key) : metaPt.get(key)),
    [metaPt, metaEn],
  )

  // Stable dependency signature for the combined meta (id|hash per key, both langs).
  const beatMetaSig = useMemo(() => {
    const parts: string[] = []
    for (const [k, m] of metaPt) parts.push(`${k}|${m.contentHash}`)
    for (const [k, m] of metaEn) parts.push(`${k}|${m.contentHash}`)
    return parts.sort().join(',')
  }, [metaPt, metaEn])

  // --- 1. Beat-id persistence (linchpin) ---------------------------------------------
  const roteiroPresent = data.roteiro?.[activeLang] != null
  useEffect(() => {
    const lang = activeLang
    if (idPersistedRef.current.has(lang)) return
    if (!roteiroPresent) return
    idPersistedRef.current.add(lang) // mark before await — one attempt per mount+lang
    void (async () => {
      try {
        const res = await persistBeatIds(itemId, lang, version)
        if (res.ok) {
          // Push the (possibly bumped) version up to the editor's live useState so the next
          // roteiro save doesn't 409 against a stale lock.
          setLiveVersion(res.data.version)
        } else if (res.error === 'version_conflict') {
          // A concurrent roteiro save won the CAS. Don't leave this lang marked as persisted —
          // clear it so a later clean render (new version) retries the stamp.
          idPersistedRef.current.delete(lang)
        }
      } catch (e) {
        // Never crash the editor on a stamping failure — ids retry on the next clean load.
        idPersistedRef.current.delete(lang)
        console.warn('[recording-sync] persistBeatIds failed', e)
      }
    })()
    // version read at call time; re-running on every version bump would re-attempt needlessly.
    // Keyed on item+lang+roteiro presence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, activeLang, roteiroPresent])

  // --- 2. Hydrate (local-first, then reconcile with server) --------------------------
  useEffect(() => {
    const lang = activeLang
    if (hydratingRef.current.has(lang)) return
    hydratingRef.current.add(lang)
    let cancelled = false

    // For keys the user has touched this session, KEEP the live local value in the hydrate
    // payload (HYDRATE replaces the whole lang, so a touched key must carry its current
    // value through — server truth never overwrites an in-flight, still-syncing local edit).
    const prefix = `${lang}:`
    const preserveTouched = (next: {
      recStatus: Record<string, RecStatus>
      retakeNotes: Record<string, string>
      recordedHash: Record<string, string>
    }) => {
      const touched = touchedRef.current
      const live = liveRef.current
      const recStatus: Record<string, RecStatus> = {}
      const retakeNotes: Record<string, string> = {}
      const recordedHash: Record<string, string> = {}
      // Server/local truth for NON-touched keys.
      for (const [k, v] of Object.entries(next.recStatus)) if (!touched.has(k)) recStatus[k] = v
      for (const [k, v] of Object.entries(next.retakeNotes)) if (!touched.has(k)) retakeNotes[k] = v
      for (const [k, v] of Object.entries(next.recordedHash)) if (!touched.has(k)) recordedHash[k] = v
      // Re-inject the live local value for every touched key in this lang.
      for (const k of touched) {
        if (!k.startsWith(prefix)) continue
        const st = live.status[k]
        if (st) recStatus[k] = st
        const note = live.notes[k]
        if (note) retakeNotes[k] = note
        const rh = live.recordedHash[k]
        if (rh) recordedHash[k] = rh
      }
      return { recStatus, retakeNotes, recordedHash }
    }

    void (async () => {
      try {
        // (a) Local-first: seed from IndexedDB immediately (offline-friendly).
        const local = await loadLocal(itemId, lang)
        if (!cancelled && local.length > 0) {
          const seeded = preserveTouched(rowsToState(local, lang))
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
        const next = preserveTouched(rowsToState(merged, lang))
        // Refresh the synced baseline so the write effect won't re-emit hydrated values.
        // Only for keys we actually hydrated (touched keys keep their in-flight baseline).
        const status = { ...syncedRef.current.status }
        const notes = { ...syncedRef.current.notes }
        for (const k of Object.keys(status)) {
          if (k.startsWith(prefix) && !touchedRef.current.has(k)) delete status[k]
        }
        for (const k of Object.keys(notes)) {
          if (k.startsWith(prefix) && !touchedRef.current.has(k)) delete notes[k]
        }
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

    // Detect, per changed key, whether the STATUS transitioned into a recorded state
    // (pendente → gravada/refazer) by THIS write — the only case that should stamp a fresh
    // recorded content_hash. (Computed before we advance the baseline below.)
    const isFreshRecording = new Map<string, boolean>()
    for (const key of changedKeys) {
      const before = prev.status[key]
      const now = status[key]
      const recordedNow = now === 'gravada' || now === 'refazer'
      const recordedBefore = before === 'gravada' || before === 'refazer'
      isFreshRecording.set(key, recordedNow && !recordedBefore)
    }

    // Mark every changed key as touched-this-session BEFORE any await, so a concurrent
    // hydrate won't clobber it. Synchronous — the race is real.
    for (const key of changedKeys) touchedRef.current.add(key)

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
        const meta = metaFor(key)

        // Hash-preserve: only stamp the CURRENT beat hash when this write freshly records the
        // beat (just recorded THIS text). For note-only / pendente / non-record writes,
        // PRESERVE the recorded hash (state) so "roteiro mudou desde a gravação" survives an
        // edit. Never send an undefined hash over an existing one (fall back to recorded).
        const fresh = isFreshRecording.get(key) === true
        const contentHash = fresh
          ? (meta?.contentHash ?? recRecordedHash[key])
          : (recRecordedHash[key] ?? meta?.contentHash)

        const row: LocalRecRow = {
          pipelineId: itemId,
          lang: parsed.lang,
          beatId: parsed.beatId,
          status: st,
          retakeNote: note,
          beatName: meta?.name,
          contentHash,
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
            contentHash,
          })
          if (res.ok) await markSynced([rowKey(row)])
        } catch (e) {
          console.warn('[recording-sync] saveRecordingBeat failed', e)
        }
      }
    })()
    // meta read at call time via beatMetaSig; itemId stable per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.recStatus, state.retakeNotes, itemId, beatMetaSig])

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
