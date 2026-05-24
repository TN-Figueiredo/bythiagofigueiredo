# Playlist Versioning & Data Protection

**Date:** 2026-05-24
**Status:** Design approved
**Scope:** Persistent snapshot system with graph integrity validation and cascade guards

## Problem Statement

The playlist canvas editor auto-saves changes via a 1500ms debounced delta mechanism. A code bug during development silently disconnected all edges in a 139-item playlist, and the auto-save persisted the broken state. There was no way to revert — the in-memory undo/redo history (50 snapshots) was lost on page reload.

**Root cause analysis:** When a `playlist_item` is deleted, PostgreSQL's `ON DELETE CASCADE` silently removes all connected `playlist_edges`. This deletion happens at the database level, completely bypassing the delta mechanism. The delta only tracks position/sort_order updates — it never handles edge or item deletion. Any guard placed on the delta would never fire for the actual failure mode.

**Additional risk:** There are 23 distinct write paths that modify playlist data (server actions + API routes), but the delta mechanism covers only 1 (position updates). The 22 other paths — including bulk operations callable by external tools like Cowork — operate with no versioning or confirmation.

## Architecture Overview

Three-layer protection system:

```
┌─────────────────────────────────────────────────┐
│ Layer 1: Graph Integrity Check (Prevention)      │
│ Detects corruption BEFORE it gets saved          │
├─────────────────────────────────────────────────┤
│ Layer 2: Cascade Guard + withSnapshot (Safety)   │
│ Confirms destructive ops, snapshots before them  │
├─────────────────────────────────────────────────┤
│ Layer 3: Version History UI (Recovery)           │
│ Browse, preview, and selectively restore         │
└─────────────────────────────────────────────────┘
```

---

## Database Schema & Migration

### Table: `playlist_snapshots`

```sql
CREATE TABLE public.playlist_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id   UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  site_id       UUID NOT NULL REFERENCES sites(id),
  type          TEXT NOT NULL CHECK (type IN ('auto','manual','pre_destructive','session_start')),
  label         TEXT,
  graph_data    JSONB NOT NULL,
  stats         JSONB NOT NULL DEFAULT '{}',
  content_hash  TEXT NOT NULL,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);
```

### Indexes

```sql
-- Primary lookup: list snapshots for a playlist, newest first
CREATE INDEX idx_snapshots_playlist
  ON public.playlist_snapshots (playlist_id, created_at DESC);

-- Cron cleanup: find expired snapshots efficiently
CREATE INDEX idx_snapshots_expires
  ON public.playlist_snapshots (expires_at)
  WHERE expires_at IS NOT NULL;

-- Deduplication: prevent storing identical consecutive auto-snapshots
CREATE UNIQUE INDEX idx_snapshots_dedup
  ON public.playlist_snapshots (playlist_id, content_hash)
  WHERE type = 'auto';
```

The dedup index ensures that if the graph hasn't changed since the last auto-snapshot, a new row is rejected via unique constraint violation (caller uses `ON CONFLICT DO NOTHING`). Manual and pre-destructive snapshots are exempt — users may intentionally label the same state multiple times.

### Row-Level Security

```sql
ALTER TABLE public.playlist_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_manage_snapshots ON public.playlist_snapshots;
CREATE POLICY staff_manage_snapshots ON public.playlist_snapshots
  FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
```

### RPC: `restore_playlist_snapshot`

```sql
CREATE OR REPLACE FUNCTION public.restore_playlist_snapshot(
  p_playlist_id UUID,
  p_snapshot_id UUID,
  p_mode TEXT DEFAULT 'full'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snapshot RECORD;
BEGIN
  -- Validate mode
  IF p_mode NOT IN ('full', 'edges_only', 'positions_only') THEN
    RAISE EXCEPTION 'Invalid restore mode: %', p_mode;
  END IF;

  -- Fetch snapshot and verify ownership
  SELECT * INTO v_snapshot
    FROM playlist_snapshots
   WHERE id = p_snapshot_id
     AND playlist_id = p_playlist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or does not belong to playlist';
  END IF;

  -- Permission check
  IF NOT can_edit_site(v_snapshot.site_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_mode = 'full' THEN
    -- Delete edges first (FK dependency), then items
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;
    DELETE FROM playlist_items WHERE playlist_id = p_playlist_id;

    -- Re-insert items from snapshot (inject playlist_id)
    INSERT INTO playlist_items (
      id, playlist_id, blog_post_id, newsletter_edition_id,
      pipeline_id, sort_order, position_x, position_y
    )
    SELECT
      (item->>'id')::uuid,
      p_playlist_id,
      (item->>'blog_post_id')::uuid,
      (item->>'newsletter_edition_id')::uuid,
      (item->>'pipeline_id')::uuid,
      (item->>'sort_order')::int,
      (item->>'position_x')::float,
      (item->>'position_y')::float
    FROM jsonb_array_elements(v_snapshot.graph_data->'items') AS item;

    -- Re-insert edges (ON CONFLICT DO NOTHING for FK safety — ghost items)
    INSERT INTO playlist_edges (
      id, playlist_id, source_item_id, target_item_id, edge_type, label
    )
    SELECT
      (edge->>'id')::uuid,
      p_playlist_id,
      (edge->>'source_item_id')::uuid,
      (edge->>'target_item_id')::uuid,
      edge->>'edge_type',
      edge->>'label'
    FROM jsonb_array_elements(v_snapshot.graph_data->'edges') AS edge
    ON CONFLICT DO NOTHING;

  ELSIF p_mode = 'edges_only' THEN
    -- Delete current edges only
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;

    -- Re-insert only edges whose source AND target exist in current items
    INSERT INTO playlist_edges (
      id, playlist_id, source_item_id, target_item_id, edge_type, label
    )
    SELECT
      (edge->>'id')::uuid,
      p_playlist_id,
      (edge->>'source_item_id')::uuid,
      (edge->>'target_item_id')::uuid,
      edge->>'edge_type',
      edge->>'label'
    FROM jsonb_array_elements(v_snapshot.graph_data->'edges') AS edge
    WHERE (edge->>'source_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    )
    AND (edge->>'target_item_id')::uuid IN (
      SELECT id FROM playlist_items WHERE playlist_id = p_playlist_id
    );

  ELSIF p_mode = 'positions_only' THEN
    -- Update positions and sort_order for matching items only
    UPDATE playlist_items pi
    SET
      position_x = (item->>'position_x')::float,
      position_y = (item->>'position_y')::float,
      sort_order = (item->>'sort_order')::int
    FROM jsonb_array_elements(v_snapshot.graph_data->'items') AS item
    WHERE pi.playlist_id = p_playlist_id
      AND pi.id = (item->>'id')::uuid;
  END IF;
END;
$$;
```

### `graph_data` JSONB Structure

```json
{
  "items": [
    {
      "id": "uuid",
      "blog_post_id": "uuid|null",
      "newsletter_edition_id": "uuid|null",
      "pipeline_id": "uuid|null",
      "sort_order": 1000,
      "position_x": 245.5,
      "position_y": 320.1
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "source_item_id": "uuid",
      "target_item_id": "uuid",
      "edge_type": "sequence",
      "label": "string|null"
    }
  ]
}
```

Only structural/positional data is stored. Content metadata (titles, tags, status) is re-fetched via JOIN on load. This keeps snapshots compact and avoids stale denormalized data on restore.

### `stats` JSONB Structure

```json
{
  "item_count": 139,
  "edge_count": 55,
  "content_types": { "blog_post": 45, "pipeline": 80, "newsletter": 14 }
}
```

Stats are computed at snapshot creation time for display in the version history UI without parsing `graph_data`.

### Retention Rules

| Type | `expires_at` | Auto-cleanup |
|------|-------------|-------------|
| `auto` | `created_at + 30 days` | Cron + on-create cap (max 100 per playlist) |
| `manual` | `NULL` (never) | User can delete manually |
| `pre_destructive` | `created_at + 90 days` | Cron |
| `session_start` | `NULL` (never) | User can delete manually |

**Storage estimate:** ~25-35KB per snapshot for a 139-item playlist. 100 auto + 50 manual = ~5MB max per playlist.

---

## Snapshot Middleware (`withSnapshot`)

The core architectural pattern. Instead of instrumenting 23 individual write paths, a single wrapper function covers all destructive playlist mutations.

### The `withSnapshot` function

**Location:** `apps/web/src/lib/playlists/snapshot-middleware.ts`

```typescript
async function withSnapshot<T>(
  playlistId: string,
  trigger: 'auto' | 'manual' | 'pre_destructive' | 'session_start',
  label: string,
  fn: () => Promise<T>
): Promise<T>
```

**Behavior:**

1. Fetches current items + edges for the playlist (lightweight query: only structural fields).
2. Computes `content_hash` via `computeGraphHash()`.
3. Computes stats (`item_count`, `edge_count`, `content_types`).
4. INSERTs into `playlist_snapshots` with `ON CONFLICT DO NOTHING` on `(playlist_id, content_hash)` for auto-type dedup.
5. Sets `expires_at` based on trigger type: `auto` = 30 days, `pre_destructive` = 90 days, others = NULL.
6. Enforces on-create cap: if auto-snapshots for this playlist exceed 100, deletes the oldest in the same transaction.
7. Executes `fn()` and returns its result.
8. If `fn()` throws, the snapshot is still preserved — it captured pre-mutation state before the destructive operation.

**Error semantics:** The snapshot INSERT and the mutation `fn()` are NOT in the same database transaction. The snapshot must persist even if the mutation fails.

### `createSnapshot` standalone function

Same logic as `withSnapshot` steps 1–6, but without executing a mutation. Used for manual checkpoints (Ctrl+S), session-start snapshots, and auto-snapshot timer.

Returns `{ id, deduplicated: boolean }` — `deduplicated: true` when the content hash matched an existing snapshot (no new row created).

### `computeGraphHash` function

**Location:** `apps/web/src/lib/playlists/canvas/graph-hash.ts`

```typescript
function computeGraphHash(items: ItemRow[], edges: EdgeRow[]): string {
  const itemSig = items
    .map(i => `${i.id}|${i.position_x.toFixed(1)}|${i.position_y.toFixed(1)}|${i.sort_order}`)
    .sort()
    .join('\n')

  const edgeSig = edges
    .map(e => `${e.source_item_id}→${e.target_item_id}:${e.edge_type}`)
    .sort()
    .join('\n')

  return cyrb53(`${itemSig}\x00${edgeSig}`).toString(36)
}
```

- Uses `cyrb53` (fast non-crypto hash, ~10 lines inline, no dependency).
- Arrays sorted for determinism regardless of query row order.
- Positions rounded to 1 decimal to avoid float noise.
- Null byte separator prevents collisions between item and edge signatures.

### Write Path Coverage

| Operation | Snapshot? | Reason |
|-----------|-----------|--------|
| `removeItemFromPlaylist` | YES always | CASCADE deletes connected edges silently |
| `deleteEdge` | YES always | Destroys graph connections |
| `deletePlaylist` | YES always | Irreversible without snapshot |
| API: bulk add items | YES always | Can significantly alter graph structure |
| API: bulk create edges | YES always | Restructures connections at scale |
| API: delete item/edge | YES always | External caller, no undo UI available |
| API: auto-layout | YES always | Repositions all items simultaneously |
| `addItem` (single) | NO | Non-destructive, easily reversible |
| `createEdge` (single) | NO | Non-destructive, easily reversible |
| `savePlaylistDelta` | NO | Position-only updates, too frequent |
| `updatePlaylist` (metadata) | NO | Doesn't affect graph structure |
| `saveViewportState` | NO | UI state only |
| `reorderItems` | NO | Covered by auto-snapshot timer |
| `updatePlaylistNotes` | NO | Metadata, not graph structure |

**Rule:** snapshot before DELETE and BULK operations. Skip for single ADD, position updates, and metadata. The auto-snapshot timer provides a safety net for cumulative small changes.

---

## Graph Integrity Validation & Cascade Guards

Two protective layers that PREVENT data loss, complementing the snapshot system that enables RECOVERY.

### Layer 1: Graph Integrity Check

**Location:** `apps/web/src/lib/playlists/canvas/graph-integrity.ts`

```typescript
interface IntegrityReport {
  valid: boolean
  orphanedEdges: EdgeRow[]      // edges pointing to non-existent items
  invalidPositions: ItemRow[]   // NaN, Infinity, or non-finite
  duplicateEdges: EdgeRow[]     // same source+target+type combo
}

function checkGraphIntegrity(items: ItemRow[], edges: EdgeRow[]): IntegrityReport
```

**Checks:**

1. **Orphaned edges** — Any edge whose `source_item_id` or `target_item_id` is not in the items array.
2. **Invalid positions** — Items with NaN, Infinity, or non-finite `position_x`/`position_y`.
3. **Duplicate edges** — Multiple edges with same `source_item_id` + `target_item_id` + `edge_type`.

**When it runs:**

- On initial graph load (catches existing corruption)
- Before each `flushDelta()` call (catches corruption during editing)
- After LOAD from undo/redo/restore (catches corruption in restored state)

**When it fails (`valid === false`):**

1. Auto-save is PAUSED (prevents persisting corrupt state)
2. Persistent red banner appears above canvas
3. Auto-snapshot of current (corrupt) state for forensics
4. Banner offers: "Limpar edges órfãs" (auto-fix) and "Restaurar última versão" (opens history panel)

### Layer 2: Cascade Guard (Client-side)

The ROOT CAUSE of the original data loss: deleting a `playlist_item` triggers `ON DELETE CASCADE`, silently removing all connected edges.

**Flow:**

1. User triggers item deletion (Delete key, context menu)
2. Client calls `getItemEdgeCount(siteId, playlistId, itemId)` — lightweight server action
3. If `count === 0`: proceed directly
4. If `count > 0`: show `CascadeConfirmDialog` with:
   - Item name being deleted
   - Count of edges that will cascade-delete
   - List of first 5 connected items with edge types
   - "Um snapshot será criado automaticamente antes da remoção"
   - Cancel / "Remover item + N edges" (red button)

The client guard and server-side `withSnapshot` are independent safety nets — even if the client dialog is bypassed (e.g., API call), the snapshot is still created.

### Server-side Guards (in `savePlaylistDelta`)

Array size limits to reject corrupted or malicious payloads:

- `itemsUpserted.length > 500` → reject
- `itemsRemoved.length > 500` → reject
- `edgesCreated.length > 200` → reject
- `edgesRemoved.length > 200` → reject

No percentage-based guard — edge/item removal doesn't go through the delta. The cascade guard + `withSnapshot` are the correct mechanisms.

---

## Auto-Snapshot System & Cleanup Cron

### `useAutoSnapshot` Hook

**Location:** `apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts`

```typescript
function useAutoSnapshot(options: {
  playlistId: string
  siteId: string
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  saveState: 'saved' | 'saving' | 'error'
  enabled: boolean  // false during preview mode
}): void
```

**Trigger logic:**

- Tracks accumulated "active editing time" since the last auto-snapshot.
- Time advances ONLY when `saveState` transitions `'saving'` → `'saved'` (a real delta was flushed).
- Each transition adds ~1.5s to accumulated time.
- At 300s (5 minutes of active editing): creates auto-snapshot and resets timer.
- If user is idle (no saves), timer does NOT advance.
- Hash comparison prevents duplicate snapshots when content hasn't changed.

**Internal state:**

| Ref | Type | Purpose |
|-----|------|---------|
| `accumulatedTimeRef` | `useRef<number>(0)` | Active editing seconds since last snapshot |
| `lastSaveStateRef` | `useRef<string>('saved')` | Detects save transitions |
| `lastSnapshotHashRef` | `useRef<string>('')` | Prevents duplicates |

### Session-Start Snapshot

**Location:** `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx`

On editor mount, after graph data loads:

1. Query most recent snapshot for this playlist.
2. If no snapshots exist OR last snapshot is older than 1 hour: create `'session_start'` snapshot.
3. This ensures a baseline always exists at the start of each editing session.

### Snapshot Server Actions

Added to `apps/web/src/app/cms/(authed)/playlists/actions.ts`:

| Action | Purpose |
|--------|---------|
| `createPlaylistSnapshot(siteId, playlistId, type, label)` | Create snapshot with on-create cap enforcement |
| `listPlaylistSnapshots(siteId, playlistId, cursor?, limit?)` | Paginated list, newest first (default 50) |
| `restorePlaylistSnapshot(siteId, playlistId, snapshotId, mode)` | Restore via RPC (creates pre_destructive snapshot first) |
| `renamePlaylistSnapshot(siteId, snapshotId, label)` | Rename label (any type) |
| `deletePlaylistSnapshot(siteId, snapshotId)` | Delete (manual type only) |
| `getItemEdgeCount(siteId, playlistId, itemId)` | Edge count + details for cascade guard |
| `ensureSessionSnapshot(siteId, playlistId)` | Session-start if >1h since last snapshot |

### Cleanup Cron

**Location:** `apps/web/src/app/api/cron/snapshot-cleanup/route.ts`
**Schedule:** `0 4 * * *` (daily at 04:00 UTC / 01:00 BRT)
**Auth:** `CRON_SECRET` header

```sql
-- 1. Delete expired auto-snapshots (>30 days)
DELETE FROM playlist_snapshots
WHERE type = 'auto' AND expires_at IS NOT NULL AND expires_at < now();

-- 2. Delete expired pre_destructive snapshots (>90 days)
DELETE FROM playlist_snapshots
WHERE type = 'pre_destructive' AND expires_at IS NOT NULL AND expires_at < now();

-- 3. Enforce per-playlist cap: max 100 auto-snapshots (backup for on-create)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY playlist_id ORDER BY created_at DESC
  ) AS rn
  FROM playlist_snapshots WHERE type = 'auto'
)
DELETE FROM playlist_snapshots WHERE id IN (
  SELECT id FROM ranked WHERE rn > 100
);
```

The cron is a BACKUP. Primary enforcement is on-create in `createPlaylistSnapshot`. Manual and session_start snapshots are never auto-deleted.

---

## UI Components & Interactions

### 1. Version History Panel

**File:** `apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx`

Right-side panel, same pattern as `PlaylistSettings`:
- Width: `280px`, full height
- Border: `border-l border-white/10`, background: `#111827`
- Opens via clock icon in toolbar (between Refresh and Settings)
- Keyboard: `Cmd+H` (toggle)
- Mutually exclusive with Settings panel

**Layout:**

```
┌──────────────────────────────┐
│ Versões                    × │
├──────────────────────────────┤
│ [+ Criar checkpoint (⌘S)]   │  ← Green outline button
├──────────────────────────────┤
│ Hoje                         │  ← Date group
│ ┌──────────────────────────┐ │
│ │📌 Layout final PT-BR   ✏️│ │  ← Manual (green border)
│ │   15:45 · 139i · 55e    │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │⚠️ Antes de remover item  │ │  ← Pre-destructive (amber)
│ │   14:32 · 139i · 55e    │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │🔄 Auto-save              │ │  ← Auto (blue border)
│ │   14:27 · 139i · 55e    │ │
│ └──────────────────────────┘ │
│ ...                          │
└──────────────────────────────┘
```

- Left border color by type: green (manual), amber (pre_destructive), blue (auto), cyan (session_start)
- ✏️ rename button on manual/session_start types
- Click → preview mode
- Paginate at 50 entries, load more on scroll

### 2. Preview Mode

- Canvas shows snapshot graph state (read-only)
- Yellow banner at top center: `📸 Preview: "label" — HH:MM [Restaurar] [Fechar]`
- All canvas interactions disabled (drag, edge creation, context menu)
- Escape exits preview mode
- Implementation: use existing `dispatch({ type: 'LOAD' })` with snapshot data; on exit, re-LOAD from database

### 3. Restore Mode Dialog

**File:** `apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx`

Modal with three radio options:

1. **Restaurar tudo** (default) — items, edges, and positions
2. **Apenas edges** — keep current items/positions, restore connections
3. **Apenas posições** — keep current items/edges, restore layout

Shows diff summary: +/- items, +/- edges, positions changed.

**Post-restore:** call RPC → clear undo/redo → re-fetch graph → exit preview → success toast.

### 4. Cascade Confirm Dialog

**File:** `apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx`

Shows item name, edge count, first 5 connected items with types, snapshot notice.

### 5. Integrity Banner

Full-width red bar above canvas. Not dismissible. Shows issue detail + "Limpar edges órfãs" and "Restaurar última versão" buttons.

### 6. Toolbar Changes

Add clock/history icon between Refresh and Settings. Tooltip: "Versões (⌘H)".

### 7. Keyboard Shortcuts

| Shortcut | Action | Guard |
|----------|--------|-------|
| `⌘S` | Create manual checkpoint | Not in editable element |
| `⌘H` | Toggle history panel | Canvas focused |
| `Escape` | Exit preview mode | In preview mode |

`⌘S`: preventDefault browser save, flush pending delta, create snapshot with auto-label "Checkpoint HH:MM". Snapshot appears in panel with ✏️ rename.

---

## Component Inventory & File Changes

### New Files

| File | Type | Purpose |
|------|------|---------|
| `supabase/migrations/XXXXXX_playlist_snapshots.sql` | Migration | Table, indexes, RLS, restore RPC |
| `apps/web/src/lib/playlists/snapshot-middleware.ts` | Server util | `withSnapshot()`, `createSnapshot()`, `computeGraphHash()` |
| `apps/web/src/lib/playlists/canvas/graph-integrity.ts` | Client util | `checkGraphIntegrity()` pure function |
| `apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts` | React hook | Activity-based auto-snapshot timer |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx` | Component | Right-side panel with snapshot timeline |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx` | Component | Confirmation for item deletion with edges |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx` | Component | Selective restore mode picker |
| `apps/web/src/app/api/cron/snapshot-cleanup/route.ts` | API route | Daily expired snapshot cleanup |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/lib/playlists/types.ts` | Add `SnapshotType`, `SnapshotRow`, `SnapshotItem`, `SnapshotEdge`, `IntegrityReport`, `RestoreMode` types |
| `apps/web/src/app/cms/(authed)/playlists/actions.ts` | Add 7 snapshot server actions. Wrap `removeItemFromPlaylist`, `deleteEdge`, `deletePlaylist` with `withSnapshot` |
| `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx` | Call `ensureSessionSnapshot()` on load |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx` | Integrity check, ⌘S/⌘H handlers, preview mode, integrity banner, useAutoSnapshot, cascade guard |
| `apps/web/src/app/api/pipeline/playlists/[id]/route.ts` | Wrap DELETE with `withSnapshot` |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts` | Wrap POST with `withSnapshot` |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts` | Wrap POST with `withSnapshot` |
| `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts` | Wrap POST with `withSnapshot` |

### TypeScript Types

```typescript
type SnapshotType = 'auto' | 'manual' | 'pre_destructive' | 'session_start'
type RestoreMode = 'full' | 'edges_only' | 'positions_only'

interface SnapshotRow {
  id: string
  playlist_id: string
  site_id: string
  type: SnapshotType
  label: string | null
  graph_data: { items: SnapshotItem[]; edges: SnapshotEdge[] }
  stats: { item_count: number; edge_count: number; content_types: Record<string, number> }
  content_hash: string
  created_by: string | null
  created_at: string
  expires_at: string | null
}

interface SnapshotItem {
  id: string
  blog_post_id: string | null
  newsletter_edition_id: string | null
  pipeline_id: string | null
  sort_order: number
  position_x: number
  position_y: number
}

interface SnapshotEdge {
  id: string
  source_item_id: string
  target_item_id: string
  edge_type: string
  label: string | null
}

interface IntegrityReport {
  valid: boolean
  orphanedEdges: PlaylistEdgeRow[]
  invalidPositions: PlaylistItemRow[]
  duplicateEdges: PlaylistEdgeRow[]
}
```

### Dependencies

No new npm packages. Uses existing Supabase client, RLS helpers, UI patterns, and cyrb53 (~10 lines inline).

### Test Coverage

| Test file | Scope |
|-----------|-------|
| `apps/web/test/unit/playlists/graph-integrity.test.ts` | Corruption scenarios (orphans, NaN, duplicates) |
| `apps/web/test/unit/playlists/graph-hash.test.ts` | Hash determinism, dedup, float rounding |
| `apps/web/test/unit/playlists/snapshot-middleware.test.ts` | withSnapshot behavior, error passthrough |
| `apps/web/test/integration/playlists/snapshots.test.ts` | Full CRUD + restore flows (DB-gated) |
