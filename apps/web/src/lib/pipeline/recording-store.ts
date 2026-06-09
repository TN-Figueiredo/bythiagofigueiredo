/**
 * Local-first recording-status store.
 *
 * Recording status must survive an offline remote shoot (no wifi). User edits hit
 * IndexedDB locally-first (durable, synchronous-ish) and sync opportunistically to
 * the server later. This module is the local store + the conflict-merge logic.
 *
 * Two layers:
 *   1. {@link mergeRemoteRows} — a PURE, deterministic merge core (no IO, no clock).
 *      This is the testable heart: dirty-local-wins, else newer-wins, plus
 *      remote-only / local-only handling.
 *   2. A thin IndexedDB wrapper (SSR / test-safe). When `indexedDB`/`window` is
 *      absent (SSR, the vitest node/jsdom env), it transparently falls back to an
 *      in-memory Map so nothing crashes — the same async surface either way.
 *
 * Status keys on `(pipeline_id, lang, beat_id)`. See
 * docs/superpowers/specs/2026-06-08-gravacao-por-beat-design.md.
 */
import type { RecStatus } from './video-recording'

/** A recording-status row as stored locally in IndexedDB. */
export interface LocalRecRow {
  pipelineId: string
  lang: 'pt' | 'en'
  beatId: string
  status: RecStatus
  retakeNote?: string
  beatName?: string
  contentHash?: string
  /** Epoch ms, set by the caller (NEVER `Date.now()` inside a pure fn). */
  updatedAt: number
  /**
   * The server timestamp (epoch ms) this row was last synced against. Used to decide,
   * for a CLEAN local row, whether an incoming remote is genuinely newer on the server
   * (cross-device update) rather than comparing wall-clock `updatedAt`. Undefined = never
   * synced (treated as -Infinity, so any remote with a timestamp is newer).
   */
  serverUpdatedAt?: number
  /** true = local change not yet synced to the server. */
  dirty: boolean
}

/** A remote row: a {@link LocalRecRow} without the local-only `dirty`/`serverUpdatedAt` fields. */
export type RemoteRecRow = Omit<LocalRecRow, 'dirty' | 'serverUpdatedAt'>

/** Composite store key for a row: `${pipelineId}:${lang}:${beatId}`. */
export function rowKey(row: Pick<LocalRecRow, 'pipelineId' | 'lang' | 'beatId'>): string {
  return `${row.pipelineId}:${row.lang}:${row.beatId}`
}

// ---------------------------------------------------------------------------
// PURE merge core — no IO, no clock, no randomness. The testable heart.
// ---------------------------------------------------------------------------

/**
 * Merge local rows with rows fetched from the server, per composite key.
 *
 * Rules (deterministic, server-authoritative):
 *   • Local row is `dirty` → KEEP local (it's an unsynced edit; local wins,
 *     regardless of timestamps — the server hasn't seen this change yet).
 *   • Otherwise (local clean, both present) → accept the remote when the remote's
 *     SERVER timestamp (`updatedAt`) is strictly newer than the timestamp this clean
 *     local row was last synced against (`serverUpdatedAt`, defaulting to -Infinity).
 *     This is what makes a cross-device update arrive: comparing against the last-
 *     synced server timestamp instead of the local wall-clock `updatedAt` (which a
 *     clean row may carry from a prior, equal-or-newer-looking sync). Otherwise keep
 *     local. Adopted remotes are `dirty:false` with `serverUpdatedAt` set.
 *   • Remote-only key → adopt remote as `dirty:false`.
 *   • Local-only key → keep local as-is (dirty stays whatever it was; a dirty
 *     local-only row is an edit the server hasn't received yet).
 *
 * Output order is deterministic: local rows first (in their input order),
 * then remote-only rows (in their input order). The input arrays are never
 * mutated; brand-new row objects are returned for adopted-remote rows.
 */
export function mergeRemoteRows(local: LocalRecRow[], remote: RemoteRecRow[]): LocalRecRow[] {
  const remoteByKey = new Map<string, RemoteRecRow>()
  for (const r of remote) remoteByKey.set(rowKey(r), r)

  const localKeys = new Set<string>()
  const merged: LocalRecRow[] = []

  for (const localRow of local) {
    const key = rowKey(localRow)
    localKeys.add(key)
    const remoteRow = remoteByKey.get(key)

    // Dirty local always wins — unsynced edit, server hasn't seen it.
    if (localRow.dirty) {
      merged.push(localRow)
      continue
    }

    // Local-only clean row: nothing to compare against, keep it.
    if (!remoteRow) {
      merged.push(localRow)
      continue
    }

    // Clean local + remote present: accept remote only if the server has a NEWER
    // version than the one this clean row was last synced against (cross-device).
    const lastSynced = localRow.serverUpdatedAt ?? Number.NEGATIVE_INFINITY
    if (remoteRow.updatedAt > lastSynced) {
      merged.push(adoptRemote(remoteRow))
    } else {
      merged.push(localRow)
    }
  }

  // Remote-only keys: adopt as clean rows.
  for (const remoteRow of remote) {
    const key = rowKey(remoteRow)
    if (localKeys.has(key)) continue
    merged.push(adoptRemote(remoteRow))
  }

  return merged
}

/**
 * Convert a remote row into a clean (`dirty:false`) local row, recording the remote's
 * server timestamp as `serverUpdatedAt` so a later merge can detect a newer server
 * version. Pure.
 */
function adoptRemote(remote: RemoteRecRow): LocalRecRow {
  return { ...remote, serverUpdatedAt: remote.updatedAt, dirty: false }
}

// ---------------------------------------------------------------------------
// IndexedDB wrapper (SSR / test-safe) with an in-memory fallback.
//
// When `window`/`indexedDB` is unavailable (SSR render, the vitest node/jsdom
// env), every operation transparently routes through an in-memory Map keyed by
// the composite key. This keeps the async API identical everywhere and lets the
// unit tests exercise put/load/applyRemote/dirtyRows/markSynced without a real
// IndexedDB.
// ---------------------------------------------------------------------------

const DB_NAME = 'tnf-recording'
const DB_VERSION = 1
const STORE = 'rows'

/** Whether a real IndexedDB is available in this runtime. */
function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

/** Process-local fallback store, keyed by the composite row key. */
const memStore = new Map<string, LocalRecRow>()

// --- raw IndexedDB promise wrappers (tiny, dependency-free) ---

/** Open (and lazily upgrade) the recording DB. */
function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: '_key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB.open failed'))
  })
}

/** Wrap an IDBRequest as a Promise. */
function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDBRequest failed'))
  })
}

/** The shape persisted in IndexedDB: the row plus its composite `_key`. */
interface StoredRow extends LocalRecRow {
  _key: string
}

/** Strip the persistence-only `_key` field off a stored row. */
function stripKey(stored: StoredRow): LocalRecRow {
  const { _key: _drop, ...row } = stored
  void _drop
  return row
}

// --- public async API ---

/** Load all local rows for one `(pipelineId, lang)`. */
export async function loadLocal(pipelineId: string, lang: 'pt' | 'en'): Promise<LocalRecRow[]> {
  if (!hasIndexedDB()) {
    const out: LocalRecRow[] = []
    for (const row of memStore.values()) {
      if (row.pipelineId === pipelineId && row.lang === lang) out.push(row)
    }
    return out
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const all = await reqAsPromise(tx.objectStore(STORE).getAll() as IDBRequest<StoredRow[]>)
    return all
      .map(stripKey)
      .filter((row) => row.pipelineId === pipelineId && row.lang === lang)
  } finally {
    db.close()
  }
}

/**
 * Write one row. Callers set `updatedAt` + `dirty:true` on a user edit (this
 * helper does not touch the clock or the dirty flag — it persists verbatim).
 */
export async function putLocal(row: LocalRecRow): Promise<void> {
  const key = rowKey(row)
  if (!hasIndexedDB()) {
    memStore.set(key, { ...row })
    return
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const stored: StoredRow = { ...row, _key: key }
    await reqAsPromise(tx.objectStore(STORE).put(stored))
  } finally {
    db.close()
  }
}

/**
 * Apply a remote snapshot for one `(pipelineId, lang)`: load local rows, run the
 * pure {@link mergeRemoteRows}, persist the merged result back, and return it.
 */
export async function applyRemote(
  pipelineId: string,
  lang: 'pt' | 'en',
  remote: RemoteRecRow[],
): Promise<LocalRecRow[]> {
  const local = await loadLocal(pipelineId, lang)
  const merged = mergeRemoteRows(local, remote)
  for (const row of merged) await putLocal(row)
  return merged
}

/** All dirty rows across every key — for opportunistic sync to the server. */
export async function dirtyRows(): Promise<LocalRecRow[]> {
  if (!hasIndexedDB()) {
    return [...memStore.values()].filter((row) => row.dirty)
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    const all = await reqAsPromise(tx.objectStore(STORE).getAll() as IDBRequest<StoredRow[]>)
    return all.map(stripKey).filter((row) => row.dirty)
  } finally {
    db.close()
  }
}

/** Clear the dirty flag on the given composite keys (called after a sync). */
export async function markSynced(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const wanted = new Set(keys)
  if (!hasIndexedDB()) {
    for (const key of wanted) {
      const row = memStore.get(key)
      if (row && row.dirty) memStore.set(key, { ...row, dirty: false })
    }
    return
  }
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const key of wanted) {
      const stored = await reqAsPromise(store.get(key) as IDBRequest<StoredRow | undefined>)
      if (stored && stored.dirty) {
        await reqAsPromise(store.put({ ...stored, dirty: false }))
      }
    }
  } finally {
    db.close()
  }
}

/** Test-only: clear the in-memory fallback store between cases. */
export function __resetMemStore(): void {
  memStore.clear()
}
