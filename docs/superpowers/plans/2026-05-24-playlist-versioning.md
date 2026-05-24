# Playlist Versioning & Data Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent snapshot system with graph integrity validation and cascade guards to prevent accidental data loss in the playlist canvas editor.

**Architecture:** Three-layer protection — (1) Graph integrity check prevents saving corrupt state, (2) Cascade guards + withSnapshot middleware capture state before destructive ops, (3) Version history UI enables browsing, previewing, and selectively restoring snapshots.

**Tech Stack:** Supabase (PostgreSQL 17 + RPC), Next.js 15 server actions, React 19 hooks, Vitest, cyrb53 hash (inline, no deps)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/XXXXXX_playlist_snapshots.sql` | Table, indexes, RLS, restore RPC |
| `apps/web/src/lib/playlists/canvas/graph-hash.ts` | `cyrb53()` + `computeGraphHash()` |
| `apps/web/src/lib/playlists/canvas/graph-integrity.ts` | `checkGraphIntegrity()` pure function |
| `apps/web/src/lib/playlists/snapshot-middleware.ts` | `withSnapshot()`, `createSnapshot()` |
| `apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts` | Activity-based auto-snapshot hook |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx` | Right-side panel |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx` | Confirmation dialog |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx` | Selective restore picker |
| `apps/web/src/app/api/cron/snapshot-cleanup/route.ts` | Daily expired snapshot cleanup |
| `apps/web/test/unit/playlists/graph-hash.test.ts` | Hash determinism tests |
| `apps/web/test/unit/playlists/graph-integrity.test.ts` | Integrity check tests |
| `apps/web/test/unit/playlists/snapshot-middleware.test.ts` | Middleware behavior tests |
| `apps/web/test/integration/playlists/snapshots.test.ts` | Full CRUD + restore (DB-gated) |

### Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/lib/playlists/types.ts` | Add snapshot types |
| `apps/web/src/app/cms/(authed)/playlists/actions.ts` | Add 7 snapshot actions, wrap destructive ops |
| `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx` | Call `ensureSessionSnapshot()` |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx` | Integrity check, shortcuts, preview mode, cascade guard, auto-snapshot |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx` | Add history button |
| `apps/web/src/app/api/pipeline/playlists/[id]/route.ts` | Wrap DELETE |
| `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts` | Wrap POST |
| `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts` | Wrap POST |
| `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts` | Wrap POST |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/XXXXXX_playlist_snapshots.sql`

- [ ] **Step 1: Generate migration file**

Run: `npm run db:new playlist_snapshots`

This creates the timestamped file. Note the generated path.

- [ ] **Step 2: Write the migration SQL**

Write the full content into the generated migration file:

```sql
-- playlist_snapshots: persistent version history for playlist canvas
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

-- RLS
ALTER TABLE public.playlist_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_manage_snapshots ON public.playlist_snapshots;
CREATE POLICY staff_manage_snapshots ON public.playlist_snapshots
  FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- Restore RPC
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
  IF p_mode NOT IN ('full', 'edges_only', 'positions_only') THEN
    RAISE EXCEPTION 'Invalid restore mode: %', p_mode;
  END IF;

  SELECT * INTO v_snapshot
    FROM playlist_snapshots
   WHERE id = p_snapshot_id
     AND playlist_id = p_playlist_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot not found or does not belong to playlist';
  END IF;

  IF NOT can_edit_site(v_snapshot.site_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_mode = 'full' THEN
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;
    DELETE FROM playlist_items WHERE playlist_id = p_playlist_id;

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
    DELETE FROM playlist_edges WHERE playlist_id = p_playlist_id;

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

- [ ] **Step 3: Push migration to prod**

Run: `npm run db:push:prod`
Expected: Migration applied successfully (type YES when prompted)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(playlist): add playlist_snapshots table, indexes, RLS, and restore RPC"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `apps/web/src/lib/playlists/types.ts`

- [ ] **Step 1: Add snapshot types at end of file**

Append after the `FilterState` interface (after line 161):

```typescript
// -- Snapshot types --

export type SnapshotType = 'auto' | 'manual' | 'pre_destructive' | 'session_start'
export type RestoreMode = 'full' | 'edges_only' | 'positions_only'

export interface SnapshotItem {
  id: string
  blog_post_id: string | null
  newsletter_edition_id: string | null
  pipeline_id: string | null
  sort_order: number
  position_x: number
  position_y: number
}

export interface SnapshotEdge {
  id: string
  source_item_id: string
  target_item_id: string
  edge_type: string
  label: string | null
}

export interface SnapshotRow {
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

export interface IntegrityReport {
  valid: boolean
  orphanedEdges: PlaylistEdgeRow[]
  invalidPositions: PlaylistItemRow[]
  duplicateEdges: PlaylistEdgeRow[]
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/playlists/types.ts
git commit -m "feat(playlist): add snapshot and integrity report types"
```

---

### Task 3: Graph Hash (`cyrb53` + `computeGraphHash`)

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/graph-hash.ts`
- Create: `apps/web/test/unit/playlists/graph-hash.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/playlists/graph-hash.test.ts
import { describe, it, expect } from 'vitest'
import { computeGraphHash } from '@/lib/playlists/canvas/graph-hash'

describe('computeGraphHash', () => {
  const items = [
    { id: 'a', position_x: 100.12, position_y: 200.34, sort_order: 1000 },
    { id: 'b', position_x: 300.56, position_y: 400.78, sort_order: 2000 },
  ]
  const edges = [
    { source_item_id: 'a', target_item_id: 'b', edge_type: 'sequence' },
  ]

  it('produces a deterministic string hash', () => {
    const h1 = computeGraphHash(items, edges)
    const h2 = computeGraphHash(items, edges)
    expect(h1).toBe(h2)
    expect(typeof h1).toBe('string')
    expect(h1.length).toBeGreaterThan(0)
  })

  it('is order-independent (items/edges sorted internally)', () => {
    const reversed = [...items].reverse()
    expect(computeGraphHash(reversed, edges)).toBe(computeGraphHash(items, edges))
  })

  it('changes when an edge is added', () => {
    const moreEdges = [
      ...edges,
      { source_item_id: 'b', target_item_id: 'a', edge_type: 'related' },
    ]
    expect(computeGraphHash(items, moreEdges)).not.toBe(computeGraphHash(items, edges))
  })

  it('changes when a position changes by >= 0.1', () => {
    const moved = [{ ...items[0]!, position_x: 100.22 }, items[1]!]
    expect(computeGraphHash(moved, edges)).not.toBe(computeGraphHash(items, edges))
  })

  it('ignores sub-0.1 position noise (rounds to 1 decimal)', () => {
    const noisy = [{ ...items[0]!, position_x: 100.14 }, items[1]!]
    expect(computeGraphHash(noisy, edges)).toBe(computeGraphHash(items, edges))
  })

  it('changes when sort_order changes', () => {
    const reordered = [{ ...items[0]!, sort_order: 500 }, items[1]!]
    expect(computeGraphHash(reordered, edges)).not.toBe(computeGraphHash(items, edges))
  })

  it('produces empty-safe hash for no items/edges', () => {
    const hash = computeGraphHash([], [])
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/unit/playlists/graph-hash.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/playlists/canvas/graph-hash.ts

function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

interface HashableItem {
  id: string
  position_x: number
  position_y: number
  sort_order: number
}

interface HashableEdge {
  source_item_id: string
  target_item_id: string
  edge_type: string
}

export function computeGraphHash(items: HashableItem[], edges: HashableEdge[]): string {
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/unit/playlists/graph-hash.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/graph-hash.ts apps/web/test/unit/playlists/graph-hash.test.ts
git commit -m "feat(playlist): add cyrb53 graph hash for snapshot deduplication"
```

---

### Task 4: Graph Integrity Check

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/graph-integrity.ts`
- Create: `apps/web/test/unit/playlists/graph-integrity.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/playlists/graph-integrity.test.ts
import { describe, it, expect } from 'vitest'
import { checkGraphIntegrity } from '@/lib/playlists/canvas/graph-integrity'
import type { PlaylistItemRow, PlaylistEdgeRow } from '@/lib/playlists/types'

const makeItem = (id: string, x = 100, y = 200): PlaylistItemRow => ({
  id,
  playlist_id: 'pl-1',
  blog_post_id: null,
  newsletter_edition_id: null,
  pipeline_id: null,
  sort_order: 1000,
  position_x: x,
  position_y: y,
  created_at: '2026-01-01',
})

const makeEdge = (id: string, src: string, tgt: string): PlaylistEdgeRow => ({
  id,
  playlist_id: 'pl-1',
  source_item_id: src,
  target_item_id: tgt,
  edge_type: 'sequence',
  label: null,
  created_at: '2026-01-01',
})

describe('checkGraphIntegrity', () => {
  it('returns valid for a healthy graph', () => {
    const items = [makeItem('a'), makeItem('b')]
    const edges = [makeEdge('e1', 'a', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(true)
    expect(report.orphanedEdges).toHaveLength(0)
    expect(report.invalidPositions).toHaveLength(0)
    expect(report.duplicateEdges).toHaveLength(0)
  })

  it('detects orphaned edges (source missing)', () => {
    const items = [makeItem('b')]
    const edges = [makeEdge('e1', 'gone', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.orphanedEdges).toHaveLength(1)
    expect(report.orphanedEdges[0]!.id).toBe('e1')
  })

  it('detects orphaned edges (target missing)', () => {
    const items = [makeItem('a')]
    const edges = [makeEdge('e1', 'a', 'gone')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.orphanedEdges).toHaveLength(1)
  })

  it('detects NaN positions', () => {
    const items = [makeItem('a', NaN, 200)]
    const report = checkGraphIntegrity(items, [])
    expect(report.valid).toBe(false)
    expect(report.invalidPositions).toHaveLength(1)
  })

  it('detects Infinity positions', () => {
    const items = [makeItem('a', 100, Infinity)]
    const report = checkGraphIntegrity(items, [])
    expect(report.valid).toBe(false)
    expect(report.invalidPositions).toHaveLength(1)
  })

  it('detects duplicate edges (same source+target+type)', () => {
    const items = [makeItem('a'), makeItem('b')]
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'a', 'b')]
    const report = checkGraphIntegrity(items, edges)
    expect(report.valid).toBe(false)
    expect(report.duplicateEdges).toHaveLength(1)
  })

  it('allows same source+target with different edge_type', () => {
    const items = [makeItem('a'), makeItem('b')]
    const e1: PlaylistEdgeRow = { ...makeEdge('e1', 'a', 'b'), edge_type: 'sequence' }
    const e2: PlaylistEdgeRow = { ...makeEdge('e2', 'a', 'b'), edge_type: 'related' }
    const report = checkGraphIntegrity(items, [e1, e2])
    expect(report.valid).toBe(true)
    expect(report.duplicateEdges).toHaveLength(0)
  })

  it('handles empty graph', () => {
    const report = checkGraphIntegrity([], [])
    expect(report.valid).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/unit/playlists/graph-integrity.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/playlists/canvas/graph-integrity.ts
import type { PlaylistItemRow, PlaylistEdgeRow, IntegrityReport } from '@/lib/playlists/types'

export function checkGraphIntegrity(
  items: Pick<PlaylistItemRow, 'id' | 'position_x' | 'position_y'>[],
  edges: PlaylistEdgeRow[],
): IntegrityReport {
  const itemIds = new Set(items.map(i => i.id))

  const orphanedEdges = edges.filter(
    e => !itemIds.has(e.source_item_id) || !itemIds.has(e.target_item_id),
  )

  const invalidPositions = items.filter(
    i => !Number.isFinite(i.position_x) || !Number.isFinite(i.position_y),
  ) as PlaylistItemRow[]

  const seen = new Set<string>()
  const duplicateEdges: PlaylistEdgeRow[] = []
  for (const edge of edges) {
    const key = `${edge.source_item_id}→${edge.target_item_id}:${edge.edge_type}`
    if (seen.has(key)) {
      duplicateEdges.push(edge)
    } else {
      seen.add(key)
    }
  }

  return {
    valid: orphanedEdges.length === 0 && invalidPositions.length === 0 && duplicateEdges.length === 0,
    orphanedEdges,
    invalidPositions,
    duplicateEdges,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/unit/playlists/graph-integrity.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/graph-integrity.ts apps/web/test/unit/playlists/graph-integrity.test.ts
git commit -m "feat(playlist): add graph integrity validation (orphans, NaN, duplicates)"
```

---

### Task 5: Snapshot Middleware

**Files:**
- Create: `apps/web/src/lib/playlists/snapshot-middleware.ts`
- Create: `apps/web/test/unit/playlists/snapshot-middleware.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/unit/playlists/snapshot-middleware.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { createSnapshot, withSnapshot } from '@/lib/playlists/snapshot-middleware'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
    from: mockFrom,
    rpc: mockRpc,
  })
})

function setupMockDb(items: unknown[] = [], edges: unknown[] = []) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'playlist_items') {
      return {
        select: () => ({
          eq: () => ({ data: items, error: null }),
        }),
      }
    }
    if (table === 'playlist_edges') {
      return {
        select: () => ({
          eq: () => ({ data: edges, error: null }),
        }),
      }
    }
    if (table === 'playlist_snapshots') {
      return {
        insert: () => ({ error: null }),
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }
    }
    return { select: () => ({ eq: () => ({ data: null, error: null }) }) }
  })
}

describe('createSnapshot', () => {
  it('returns a result with deduplicated flag', async () => {
    setupMockDb(
      [{ id: 'item-1', position_x: 10, position_y: 20, sort_order: 1000, blog_post_id: null, newsletter_edition_id: null, pipeline_id: 'p1' }],
      [{ id: 'edge-1', source_item_id: 'item-1', target_item_id: 'item-1', edge_type: 'sequence', label: null }],
    )
    const result = await createSnapshot('pl-1', 'site-1', 'user-1', 'manual', 'Test')
    expect(result).toHaveProperty('deduplicated')
  })
})

describe('withSnapshot', () => {
  it('executes the mutation function and returns its result', async () => {
    setupMockDb()
    const fn = vi.fn().mockResolvedValue({ ok: true, data: 'result' })
    const result = await withSnapshot('pl-1', 'site-1', 'user-1', 'pre_destructive', 'Before delete', fn)
    expect(fn).toHaveBeenCalledOnce()
    expect(result).toEqual({ ok: true, data: 'result' })
  })

  it('preserves snapshot even if mutation throws', async () => {
    setupMockDb()
    const fn = vi.fn().mockRejectedValue(new Error('mutation failed'))
    await expect(
      withSnapshot('pl-1', 'site-1', 'user-1', 'pre_destructive', 'Before delete', fn),
    ).rejects.toThrow('mutation failed')
    expect(mockFrom).toHaveBeenCalledWith('playlist_items')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/test/unit/playlists/snapshot-middleware.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// apps/web/src/lib/playlists/snapshot-middleware.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { computeGraphHash } from '@/lib/playlists/canvas/graph-hash'
import type { SnapshotType, SnapshotItem, SnapshotEdge } from '@/lib/playlists/types'

const EXPIRY_DAYS: Record<SnapshotType, number | null> = {
  auto: 30,
  manual: null,
  pre_destructive: 90,
  session_start: null,
}

const MAX_AUTO_PER_PLAYLIST = 100

interface SnapshotResult {
  id: string | null
  deduplicated: boolean
}

export async function createSnapshot(
  playlistId: string,
  siteId: string,
  userId: string | null,
  type: SnapshotType,
  label: string,
): Promise<SnapshotResult> {
  const supabase = getSupabaseServiceClient()

  const { data: items } = await supabase
    .from('playlist_items')
    .select('id, blog_post_id, newsletter_edition_id, pipeline_id, sort_order, position_x, position_y')
    .eq('playlist_id', playlistId)

  const { data: edges } = await supabase
    .from('playlist_edges')
    .select('id, source_item_id, target_item_id, edge_type, label')
    .eq('playlist_id', playlistId)

  const safeItems: SnapshotItem[] = (items ?? []).map(i => ({
    id: i.id,
    blog_post_id: i.blog_post_id,
    newsletter_edition_id: i.newsletter_edition_id,
    pipeline_id: i.pipeline_id,
    sort_order: i.sort_order,
    position_x: i.position_x,
    position_y: i.position_y,
  }))

  const safeEdges: SnapshotEdge[] = (edges ?? []).map(e => ({
    id: e.id,
    source_item_id: e.source_item_id,
    target_item_id: e.target_item_id,
    edge_type: e.edge_type,
    label: e.label,
  }))

  const contentHash = computeGraphHash(
    safeItems.map(i => ({ id: i.id, position_x: i.position_x, position_y: i.position_y, sort_order: i.sort_order })),
    safeEdges.map(e => ({ source_item_id: e.source_item_id, target_item_id: e.target_item_id, edge_type: e.edge_type })),
  )

  const contentTypes: Record<string, number> = {}
  for (const item of safeItems) {
    const ct = item.blog_post_id ? 'blog_post' : item.newsletter_edition_id ? 'newsletter' : item.pipeline_id ? 'pipeline' : 'unknown'
    contentTypes[ct] = (contentTypes[ct] ?? 0) + 1
  }

  const stats = {
    item_count: safeItems.length,
    edge_count: safeEdges.length,
    content_types: contentTypes,
  }

  const expiryDays = EXPIRY_DAYS[type]
  const expiresAt = expiryDays
    ? new Date(Date.now() + expiryDays * 86400000).toISOString()
    : null

  const { data: inserted, error } = await supabase
    .from('playlist_snapshots')
    .insert({
      playlist_id: playlistId,
      site_id: siteId,
      type,
      label,
      graph_data: { items: safeItems, edges: safeEdges },
      stats,
      content_hash: contentHash,
      created_by: userId,
      expires_at: expiresAt,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // Unique constraint violation = dedup (auto type)
    if (error.code === '23505') {
      return { id: null, deduplicated: true }
    }
    console.error('[snapshot] insert error:', error.message)
    return { id: null, deduplicated: false }
  }

  // Enforce per-playlist cap for auto snapshots
  if (type === 'auto' && inserted) {
    const { data: excess } = await supabase
      .from('playlist_snapshots')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('type', 'auto')
      .order('created_at', { ascending: true })
      .limit(1000)

    if (excess && excess.length > MAX_AUTO_PER_PLAYLIST) {
      const toDelete = excess.slice(0, excess.length - MAX_AUTO_PER_PLAYLIST)
      for (const row of toDelete) {
        await supabase.from('playlist_snapshots').delete().eq('id', row.id)
      }
    }
  }

  return { id: inserted?.id ?? null, deduplicated: false }
}

export async function withSnapshot<T>(
  playlistId: string,
  siteId: string,
  userId: string | null,
  trigger: SnapshotType,
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  await createSnapshot(playlistId, siteId, userId, trigger, label)
  return fn()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run apps/web/test/unit/playlists/snapshot-middleware.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/playlists/snapshot-middleware.ts apps/web/test/unit/playlists/snapshot-middleware.test.ts
git commit -m "feat(playlist): add withSnapshot middleware and createSnapshot utility"
```

---

### Task 6: Snapshot Server Actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/actions.ts`

- [ ] **Step 1: Add import for snapshot middleware**

At the top of actions.ts, add imports after the existing ones (after line 17):

```typescript
import { createSnapshot, withSnapshot } from '@/lib/playlists/snapshot-middleware'
import type { SnapshotType, SnapshotRow, RestoreMode } from '@/lib/playlists/types'
```

- [ ] **Step 2: Add the 7 snapshot server actions at end of file**

Append after the last existing function:

```typescript
// ─── Snapshot Actions ────────────────────────────────────────────────────────

export async function createPlaylistSnapshot(
  siteId: string,
  playlistId: string,
  type: SnapshotType,
  label: string,
): Promise<ActionResult<{ id: string | null; deduplicated: boolean }>> {
  const { siteId: authSiteId } = await requireEditScope()
  if (authSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  const result = await createSnapshot(playlistId, siteId, user?.id ?? null, type, label)
  return { ok: true, data: result }
}

export async function listPlaylistSnapshots(
  siteId: string,
  playlistId: string,
  cursor?: string,
  limit = 50,
): Promise<ActionResult<{ snapshots: SnapshotRow[]; hasMore: boolean }>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('playlist_snapshots')
    .select('*')
    .eq('playlist_id', playlistId)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) return { ok: false, error: error.message }

  const hasMore = (data?.length ?? 0) > limit
  const snapshots = (data ?? []).slice(0, limit) as SnapshotRow[]

  return { ok: true, data: { snapshots, hasMore } }
}

export async function restorePlaylistSnapshot(
  siteId: string,
  playlistId: string,
  snapshotId: string,
  mode: RestoreMode,
): Promise<ActionResult<void>> {
  const { siteId: authSiteId } = await requireEditScope()
  if (authSiteId !== siteId) return { ok: false, error: 'forbidden' }

  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Create pre_destructive snapshot before restoring
  await createSnapshot(playlistId, siteId, user?.id ?? null, 'pre_destructive', `Antes de restaurar (${mode})`)

  const { error } = await supabase.rpc('restore_playlist_snapshot', {
    p_playlist_id: playlistId,
    p_snapshot_id: snapshotId,
    p_mode: mode,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
}

export async function renamePlaylistSnapshot(
  siteId: string,
  snapshotId: string,
  label: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlist_snapshots')
    .update({ label })
    .eq('id', snapshotId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

export async function deletePlaylistSnapshot(
  siteId: string,
  snapshotId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlist_snapshots')
    .delete()
    .eq('id', snapshotId)
    .eq('site_id', siteId)
    .in('type', ['manual', 'session_start'])

  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

export async function getItemEdgeCount(
  siteId: string,
  playlistId: string,
  itemId: string,
): Promise<ActionResult<{ count: number; edges: Array<{ id: string; target_title: string; edge_type: string }> }>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const { data: edges, error } = await supabase
    .from('playlist_edges')
    .select('id, source_item_id, target_item_id, edge_type')
    .eq('playlist_id', playlistId)
    .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`)

  if (error) return { ok: false, error: error.message }

  const connectedItemIds = (edges ?? []).map(e =>
    e.source_item_id === itemId ? e.target_item_id : e.source_item_id,
  )

  let edgeDetails: Array<{ id: string; target_title: string; edge_type: string }> = []
  if (connectedItemIds.length > 0) {
    const { data: items } = await supabase
      .from('playlist_items')
      .select('id, blog_post_id, pipeline_id, newsletter_edition_id')
      .in('id', connectedItemIds.slice(0, 5))

    edgeDetails = (edges ?? []).slice(0, 5).map(e => {
      const otherId = e.source_item_id === itemId ? e.target_item_id : e.source_item_id
      const item = items?.find(i => i.id === otherId)
      const title = item?.blog_post_id ?? item?.pipeline_id ?? item?.newsletter_edition_id ?? 'Item'
      return { id: e.id, target_title: title as string, edge_type: e.edge_type }
    })
  }

  return { ok: true, data: { count: (edges ?? []).length, edges: edgeDetails } }
}

export async function ensureSessionSnapshot(
  siteId: string,
  playlistId: string,
): Promise<ActionResult<void>> {
  await requireEditScope()

  const supabase = getSupabaseServiceClient()

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
  const { data: recent } = await supabase
    .from('playlist_snapshots')
    .select('id')
    .eq('playlist_id', playlistId)
    .gt('created_at', oneHourAgo)
    .limit(1)

  if (recent && recent.length > 0) {
    return { ok: true, data: undefined }
  }

  const { data: { user } } = await supabase.auth.getUser()
  await createSnapshot(playlistId, siteId, user?.id ?? null, 'session_start', 'Início da sessão')

  return { ok: true, data: undefined }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/actions.ts
git commit -m "feat(playlist): add 7 snapshot server actions (CRUD, restore, cascade guard)"
```

---

### Task 7: Wrap Destructive Server Actions with `withSnapshot`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/actions.ts`

- [ ] **Step 1: Wrap `removeItemFromPlaylist`**

Replace the current body of `removeItemFromPlaylist` (lines 182-216). After the ownership verification block (lines 191-205), wrap the actual deletion:

Change the deletion section from:
```typescript
  const { error } = await supabase
    .from('playlist_items')
    .delete()
    .eq('id', playlistItemId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
```

To:
```typescript
  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(item.playlist_id, siteId, user?.id ?? null, 'pre_destructive', `Antes de remover item`, async () => {
    const { error } = await supabase
      .from('playlist_items')
      .delete()
      .eq('id', playlistItemId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
```

- [ ] **Step 2: Wrap `deleteEdge`**

Replace the deletion section of `deleteEdge` (after ownership verification at line 297):

Change from:
```typescript
  const { error } = await supabase
    .from('playlist_edges')
    .delete()
    .eq('id', edgeId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
```

To:
```typescript
  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(edge.playlist_id, siteId, user?.id ?? null, 'pre_destructive', `Antes de remover edge`, async () => {
    const { error } = await supabase
      .from('playlist_edges')
      .delete()
      .eq('id', edgeId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
```

- [ ] **Step 3: Wrap `deletePlaylist`**

Replace the deletion section of `deletePlaylist` (lines 121-131):

Change from:
```typescript
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidatePlaylists()
  return { ok: true, data: undefined }
```

To:
```typescript
  const supabase = getSupabaseServiceClient()
  const { data: { user } } = await supabase.auth.getUser()

  return withSnapshot(playlistId, siteId, user?.id ?? null, 'pre_destructive', `Antes de deletar playlist`, async () => {
    const { error } = await supabase
      .from('playlists')
      .delete()
      .eq('id', playlistId)
      .eq('site_id', siteId)

    if (error) return { ok: false, error: error.message } as ActionResult<void>

    revalidatePlaylists()
    return { ok: true, data: undefined } as ActionResult<void>
  })
```

- [ ] **Step 4: Add array size guards to `savePlaylistDelta`**

After the parse and before the playlist verification (after line 323):

```typescript
  if (parsed.data.itemsUpserted.length > 500) return { ok: false, error: 'payload_too_large' }
  if (parsed.data.itemsRemoved.length > 500) return { ok: false, error: 'payload_too_large' }
  if (parsed.data.edgesCreated.length > 200) return { ok: false, error: 'payload_too_large' }
  if (parsed.data.edgesRemoved.length > 200) return { ok: false, error: 'payload_too_large' }
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/actions.ts
git commit -m "feat(playlist): wrap destructive actions with withSnapshot, add delta size guards"
```

---

### Task 8: Wrap API Routes with `withSnapshot`

**Files:**
- Modify: `apps/web/src/app/api/pipeline/playlists/[id]/route.ts`
- Modify: `apps/web/src/app/api/pipeline/playlists/[id]/items/bulk/route.ts`
- Modify: `apps/web/src/app/api/pipeline/playlists/[id]/edges/bulk/route.ts`
- Modify: `apps/web/src/app/api/pipeline/playlists/[id]/auto-layout/route.ts`

- [ ] **Step 1: Wrap DELETE in playlists/[id]/route.ts**

Add import at top:
```typescript
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'
```

Wrap the DELETE handler body (after auth and param extraction) — replace the deletion block:

Change from:
```typescript
  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('playlists')
    .delete()
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id')
    .maybeSingle()

  if (!data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

  return pipelineSuccess({ deleted: true }, 200, auth)
```

To:
```typescript
  const supabase = getSupabaseServiceClient()

  return withSnapshot(id, auth.siteId, null, 'pre_destructive', 'API: antes de deletar playlist', async () => {
    const { data } = await supabase
      .from('playlists')
      .delete()
      .eq('id', id)
      .eq('site_id', auth.siteId)
      .select('id')
      .maybeSingle()

    if (!data) return pipelineError('NOT_FOUND', 'Playlist not found', 404, auth)

    return pipelineSuccess({ deleted: true }, 200, auth)
  })
```

- [ ] **Step 2: Wrap POST in items/bulk/route.ts**

Add import at top:
```typescript
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'
```

After the playlist ownership check (line 24), wrap the remaining body in `withSnapshot`:

```typescript
  return withSnapshot(playlistId, auth.siteId, null, 'pre_destructive', `API: bulk add ${parsed.data.items.length} items`, async () => {
    // ... existing body from validation through return pipelineSuccess
  })
```

- [ ] **Step 3: Wrap POST in edges/bulk/route.ts**

Add import at top:
```typescript
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'
```

After the playlist ownership check, wrap the remaining body:

```typescript
  return withSnapshot(playlistId, auth.siteId, null, 'pre_destructive', `API: bulk create ${parsed.data.edges.length} edges`, async () => {
    // ... existing body from results declaration through return pipelineSuccess
  })
```

- [ ] **Step 4: Wrap POST in auto-layout/route.ts**

Add import at top:
```typescript
import { withSnapshot } from '@/lib/playlists/snapshot-middleware'
```

After graph fetch (line 17), wrap the layout computation and DB update:

```typescript
  return withSnapshot(playlistId, auth.siteId, null, 'pre_destructive', 'API: auto-layout', async () => {
    // ... existing body from empty check through return pipelineSuccess
  })
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/playlists/
git commit -m "feat(playlist): wrap pipeline API destructive routes with withSnapshot"
```

---

### Task 9: Session-Start Snapshot in Page Component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx`

- [ ] **Step 1: Add import for ensureSessionSnapshot**

Add to the imports from `'../actions'`:
```typescript
import {
  savePlaylistDelta,
  removeItemFromPlaylist,
  createEdge,
  deleteEdge,
  saveViewportState,
  updatePlaylist,
  deletePlaylist,
  addItemToPlaylist,
  getAvailableContent,
  updatePlaylistNotes,
  getReuseCandidates,
  ensureSessionSnapshot,
} from '../actions'
```

- [ ] **Step 2: Call ensureSessionSnapshot after graph load**

After `if (!graph) notFound()` (line 33), add:

```typescript
  await ensureSessionSnapshot(siteId, id)
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx
git commit -m "feat(playlist): create session-start snapshot on editor load"
```

---

### Task 10: Cascade Confirm Dialog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
// apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx
'use client'

import { useState, useTransition } from 'react'

interface CascadeEdge {
  id: string
  target_title: string
  edge_type: string
}

interface CascadeConfirmDialogProps {
  itemTitle: string
  edgeCount: number
  edges: CascadeEdge[]
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function CascadeConfirmDialog({
  itemTitle,
  edgeCount,
  edges,
  onConfirm,
  onCancel,
}: CascadeConfirmDialogProps) {
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-[#1a1a2e] p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <h3 className="text-[15px] font-semibold text-red-400">Remover item com conexões</h3>
        </div>

        <p className="mb-2 text-sm font-medium text-white/90">{itemTitle}</p>

        <p className="mb-1 text-[13px] text-amber-400">
          Este item tem <strong>{edgeCount} edge{edgeCount > 1 ? 's' : ''} conectada{edgeCount > 1 ? 's' : ''}</strong> que {edgeCount > 1 ? 'serão removidas' : 'será removida'} junto:
        </p>

        {edges.length > 0 && (
          <div className="my-3 rounded-md bg-black/30 px-3 py-2 text-xs leading-relaxed text-white/60">
            {edges.map(e => (
              <div key={e.id}>→ {e.target_title} ({e.edge_type})</div>
            ))}
            {edgeCount > 5 && (
              <div className="text-white/30">+ {edgeCount - 5} outras edges</div>
            )}
          </div>
        )}

        <p className="mb-4 text-xs text-white/40">
          Um snapshot será criado automaticamente antes da remoção.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Removendo...' : `Remover item + ${edgeCount} edge${edgeCount > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/cascade-confirm-dialog.tsx
git commit -m "feat(playlist): add cascade confirmation dialog for item deletion"
```

---

### Task 11: `useAutoSnapshot` Hook

**Files:**
- Create: `apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts`

- [ ] **Step 1: Write the hook**

```typescript
// apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts
'use client'

import { useEffect, useRef } from 'react'
import { computeGraphHash } from './graph-hash'
import type { PlaylistItemEnriched, PlaylistEdgeRow } from '@/lib/playlists/types'

const AUTO_SNAPSHOT_INTERVAL_S = 300 // 5 minutes of active editing
const SAVE_TRANSITION_TIME_S = 1.5

interface UseAutoSnapshotOptions {
  playlistId: string
  siteId: string
  items: PlaylistItemEnriched[]
  edges: PlaylistEdgeRow[]
  saveState: 'saved' | 'saving' | 'error'
  enabled: boolean
  onCreateSnapshot: (siteId: string, playlistId: string, type: 'auto', label: string) => Promise<unknown>
}

export function useAutoSnapshot({
  playlistId,
  siteId,
  items,
  edges,
  saveState,
  enabled,
  onCreateSnapshot,
}: UseAutoSnapshotOptions): void {
  const accumulatedTimeRef = useRef(0)
  const lastSaveStateRef = useRef(saveState)
  const lastSnapshotHashRef = useRef('')

  useEffect(() => {
    if (!enabled) return

    const prev = lastSaveStateRef.current
    lastSaveStateRef.current = saveState

    if (prev === 'saving' && saveState === 'saved') {
      accumulatedTimeRef.current += SAVE_TRANSITION_TIME_S

      if (accumulatedTimeRef.current >= AUTO_SNAPSHOT_INTERVAL_S) {
        const currentHash = computeGraphHash(
          items.map(i => ({ id: i.id, position_x: i.position_x, position_y: i.position_y, sort_order: i.sort_order })),
          edges.map(e => ({ source_item_id: e.source_item_id, target_item_id: e.target_item_id, edge_type: e.edge_type })),
        )

        if (currentHash !== lastSnapshotHashRef.current) {
          lastSnapshotHashRef.current = currentHash
          accumulatedTimeRef.current = 0
          const now = new Date()
          const label = `Auto-save ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
          onCreateSnapshot(siteId, playlistId, 'auto', label)
        } else {
          accumulatedTimeRef.current = 0
        }
      }
    }
  }, [saveState, enabled, items, edges, playlistId, siteId, onCreateSnapshot])
}
```

- [ ] **Step 2: Export from canvas barrel (if exists) or skip**

Check if `apps/web/src/lib/playlists/canvas/index.ts` exists and exports hooks. If so, add:
```typescript
export { useAutoSnapshot } from './use-auto-snapshot'
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/playlists/canvas/use-auto-snapshot.ts
git commit -m "feat(playlist): add activity-based auto-snapshot hook"
```

---

### Task 12: Version History Panel

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx`

- [ ] **Step 1: Create the panel component**

```typescript
// apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { SnapshotRow, SnapshotType, ActionResult } from '@/lib/playlists/types'

interface VersionHistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  siteId: string
  playlistId: string
  onListSnapshots: (siteId: string, playlistId: string, cursor?: string, limit?: number) => Promise<ActionResult<{ snapshots: SnapshotRow[]; hasMore: boolean }>>
  onCreateSnapshot: (siteId: string, playlistId: string, type: SnapshotType, label: string) => Promise<ActionResult<{ id: string | null; deduplicated: boolean }>>
  onRenameSnapshot: (siteId: string, snapshotId: string, label: string) => Promise<ActionResult<void>>
  onDeleteSnapshot: (siteId: string, snapshotId: string) => Promise<ActionResult<void>>
  onPreview: (snapshot: SnapshotRow) => void
}

const TYPE_CONFIG: Record<SnapshotType, { icon: string; border: string; label: string }> = {
  manual: { icon: '📌', border: 'border-l-green-500', label: 'Manual' },
  pre_destructive: { icon: '⚠️', border: 'border-l-amber-500', label: 'Pré-operação' },
  auto: { icon: '🔄', border: 'border-l-blue-500', label: 'Auto-save' },
  session_start: { icon: '🟢', border: 'border-l-cyan-500', label: 'Início da sessão' },
}

export function VersionHistoryPanel({
  isOpen,
  onClose,
  siteId,
  playlistId,
  onListSnapshots,
  onCreateSnapshot,
  onRenameSnapshot,
  onDeleteSnapshot,
  onPreview,
}: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  const loadSnapshots = useCallback(async (cursor?: string) => {
    setIsLoading(true)
    const result = await onListSnapshots(siteId, playlistId, cursor)
    if (result.ok) {
      if (cursor) {
        setSnapshots(prev => [...prev, ...result.data.snapshots])
      } else {
        setSnapshots(result.data.snapshots)
      }
      setHasMore(result.data.hasMore)
    }
    setIsLoading(false)
  }, [siteId, playlistId, onListSnapshots])

  useEffect(() => {
    if (isOpen) loadSnapshots()
  }, [isOpen, loadSnapshots])

  function handleCreateCheckpoint() {
    startTransition(async () => {
      const now = new Date()
      const label = `Checkpoint ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      await onCreateSnapshot(siteId, playlistId, 'manual', label)
      await loadSnapshots()
    })
  }

  function handleRename(snapshotId: string) {
    if (!editLabel.trim()) return
    startTransition(async () => {
      await onRenameSnapshot(siteId, snapshotId, editLabel.trim())
      setEditingId(null)
      await loadSnapshots()
    })
  }

  function handleDelete(snapshotId: string) {
    startTransition(async () => {
      await onDeleteSnapshot(siteId, snapshotId)
      await loadSnapshots()
    })
  }

  function handleLoadMore() {
    const last = snapshots[snapshots.length - 1]
    if (last) loadSnapshots(last.created_at)
  }

  if (!isOpen) return null

  const grouped = groupByDate(snapshots)

  return (
    <div className="flex w-72 flex-col border-l border-white/10 bg-[#111827]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Versões</h2>
        <button
          onClick={onClose}
          className="text-white/40 transition-colors hover:text-white/70"
        >
          ✕
        </button>
      </div>

      {/* Create checkpoint */}
      <div className="border-b border-white/5 px-4 py-3">
        <button
          onClick={handleCreateCheckpoint}
          disabled={isPending}
          className="w-full rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/10 disabled:opacity-50"
        >
          + Criar checkpoint (⌘S)
        </button>
      </div>

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {grouped.map(([date, items]) => (
          <div key={date} className="mb-3">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-white/30">
              {date}
            </div>
            {items.map(snapshot => {
              const config = TYPE_CONFIG[snapshot.type]
              return (
                <div
                  key={snapshot.id}
                  className={`mb-1.5 cursor-pointer rounded-md border-l-2 ${config.border} bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.05]`}
                  onClick={() => onPreview(snapshot)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-white/80">
                      <span>{config.icon}</span>
                      {editingId === snapshot.id ? (
                        <input
                          autoFocus
                          value={editLabel}
                          onChange={e => setEditLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRename(snapshot.id)
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          onBlur={() => handleRename(snapshot.id)}
                          onClick={e => e.stopPropagation()}
                          className="w-32 rounded border border-white/20 bg-black/30 px-1 py-0.5 text-xs text-white outline-none"
                        />
                      ) : (
                        <span className="truncate">{snapshot.label || config.label}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {(snapshot.type === 'manual' || snapshot.type === 'session_start') && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingId(snapshot.id); setEditLabel(snapshot.label || '') }}
                            className="text-[10px] text-white/30 hover:text-white/60"
                            title="Renomear"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(snapshot.id) }}
                            className="text-[10px] text-white/30 hover:text-red-400"
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-white/30">
                    {formatTime(snapshot.created_at)} · {snapshot.stats.item_count}i · {snapshot.stats.edge_count}e
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="w-full rounded-md py-2 text-xs text-white/40 transition-colors hover:text-white/60"
          >
            {isLoading ? 'Carregando...' : 'Carregar mais'}
          </button>
        )}

        {!isLoading && snapshots.length === 0 && (
          <p className="py-8 text-center text-xs text-white/30">Nenhum snapshot ainda</p>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function groupByDate(snapshots: SnapshotRow[]): [string, SnapshotRow[]][] {
  const groups = new Map<string, SnapshotRow[]>()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const s of snapshots) {
    const d = new Date(s.created_at).toDateString()
    const label = d === today ? 'Hoje' : d === yesterday ? 'Ontem' : new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(s)
  }

  return Array.from(groups.entries())
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/version-history-panel.tsx
git commit -m "feat(playlist): add version history panel with snapshot timeline"
```

---

### Task 13: Restore Mode Dialog

**Files:**
- Create: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
// apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx
'use client'

import { useState, useTransition } from 'react'
import type { RestoreMode, SnapshotRow } from '@/lib/playlists/types'

interface RestoreModeDialogProps {
  snapshot: SnapshotRow
  currentItemCount: number
  currentEdgeCount: number
  onRestore: (mode: RestoreMode) => Promise<void>
  onCancel: () => void
}

const MODES: { value: RestoreMode; title: string; description: string }[] = [
  { value: 'full', title: 'Restaurar tudo', description: 'Items, edges e posições' },
  { value: 'edges_only', title: 'Apenas edges', description: 'Manter items/posições atuais, restaurar conexões' },
  { value: 'positions_only', title: 'Apenas posições', description: 'Manter items/edges atuais, restaurar layout' },
]

export function RestoreModeDialog({
  snapshot,
  currentItemCount,
  currentEdgeCount,
  onRestore,
  onCancel,
}: RestoreModeDialogProps) {
  const [mode, setMode] = useState<RestoreMode>('full')
  const [isPending, startTransition] = useTransition()

  const diffItems = snapshot.stats.item_count - currentItemCount
  const diffEdges = snapshot.stats.edge_count - currentEdgeCount

  function handleRestore() {
    startTransition(async () => {
      await onRestore(mode)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-blue-500/30 bg-[#1a1a2e] p-6">
        <h3 className="mb-1 text-[15px] font-semibold text-white">Restaurar snapshot</h3>
        <p className="mb-4 text-xs text-white/50">
          &quot;{snapshot.label}&quot; — {formatDateTime(snapshot.created_at)}
        </p>

        <div className="mb-4 space-y-2">
          {MODES.map(m => (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                mode === m.value
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <input
                type="radio"
                name="restoreMode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium text-white">{m.title}</div>
                <div className="text-xs text-white/50">{m.description}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mb-4 rounded-md bg-black/30 px-3 py-2 text-xs text-white/50">
          <div>Items: {snapshot.stats.item_count} ({diffItems >= 0 ? '+' : ''}{diffItems} vs atual)</div>
          <div>Edges: {snapshot.stats.edge_count} ({diffEdges >= 0 ? '+' : ''}{diffEdges} vs atual)</div>
        </div>

        <p className="mb-4 text-[11px] text-white/30">
          Um snapshot do estado atual será criado automaticamente antes da restauração.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-sm text-white/70 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            onClick={handleRestore}
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Restaurando...' : 'Restaurar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/[id]/_components/restore-mode-dialog.tsx
git commit -m "feat(playlist): add selective restore mode dialog (full/edges/positions)"
```

---

### Task 14: Canvas Integration

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-canvas.tsx`
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-toolbar.tsx`
- Modify: `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx`

This is the largest task — integrating all new components and behaviors into the canvas.

- [ ] **Step 1: Add new props to PlaylistCanvasProps**

Add to the `PlaylistCanvasProps` interface in `playlist-canvas.tsx`:

```typescript
  onGetItemEdgeCount: (siteId: string, playlistId: string, itemId: string) => Promise<ActionResult<{ count: number; edges: Array<{ id: string; target_title: string; edge_type: string }> }>>
  onCreateSnapshot: (siteId: string, playlistId: string, type: SnapshotType, label: string) => Promise<ActionResult<{ id: string | null; deduplicated: boolean }>>
  onListSnapshots: (siteId: string, playlistId: string, cursor?: string, limit?: number) => Promise<ActionResult<{ snapshots: SnapshotRow[]; hasMore: boolean }>>
  onRestoreSnapshot: (siteId: string, playlistId: string, snapshotId: string, mode: RestoreMode) => Promise<ActionResult<void>>
  onRenameSnapshot: (siteId: string, snapshotId: string, label: string) => Promise<ActionResult<void>>
  onDeleteSnapshot: (siteId: string, snapshotId: string) => Promise<ActionResult<void>>
```

- [ ] **Step 2: Add imports for new components and types**

Add at top of `playlist-canvas.tsx`:

```typescript
import type { SnapshotRow, SnapshotType, RestoreMode } from '@/lib/playlists/types'
import { checkGraphIntegrity } from '@/lib/playlists/canvas/graph-integrity'
import { useAutoSnapshot } from '@/lib/playlists/canvas/use-auto-snapshot'
import { VersionHistoryPanel } from './version-history-panel'
import { CascadeConfirmDialog } from './cascade-confirm-dialog'
import { RestoreModeDialog } from './restore-mode-dialog'
```

- [ ] **Step 3: Add new state variables**

After the existing `useState` calls (around line 110):

```typescript
  const [showHistory, setShowHistory] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewSnapshot, setPreviewSnapshot] = useState<SnapshotRow | null>(null)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [cascadeConfirm, setCascadeConfirm] = useState<{
    itemId: string
    itemTitle: string
    edgeCount: number
    edges: Array<{ id: string; target_title: string; edge_type: string }>
  } | null>(null)
```

- [ ] **Step 4: Wire useAutoSnapshot hook**

After the useGraphHistory call:

```typescript
  useAutoSnapshot({
    playlistId: graph.playlist.id,
    siteId,
    items: state.items,
    edges: state.edges,
    saveState,
    enabled: !isPreviewMode,
    onCreateSnapshot,
  })
```

- [ ] **Step 5: Add integrity check to flushDelta**

At the top of `flushDelta`, before `if (isSavingRef.current) return`:

```typescript
    const integrity = checkGraphIntegrity(state.items, state.edges)
    if (!integrity.valid) {
      setSaveState('error')
      return
    }
```

Note: `state` must be captured via ref for this to work inside the callback. If the existing code uses `state` from closure, integrate accordingly. Alternatively, run the check on the payload items.

- [ ] **Step 6: Replace `handleRemoveItem` with cascade guard**

Replace the current `handleRemoveItem` callback:

```typescript
  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      if (isPreviewMode) return

      const item = state.items.find(i => i.id === itemId)
      if (!item) return

      const result = await onGetItemEdgeCount(siteId, graph.playlist.id, itemId)
      if (!result.ok) {
        setSaveState('error')
        return
      }

      if (result.data.count > 0) {
        setCascadeConfirm({
          itemId,
          itemTitle: item.title,
          edgeCount: result.data.count,
          edges: result.data.edges,
        })
        return
      }

      pushSnapshot(state)
      dispatch({ type: 'REMOVE_ITEM', itemId })
      const deleteResult = await onRemoveItem(itemId, siteId)
      if (!deleteResult.ok) setSaveState('error')
    },
    [isPreviewMode, state, siteId, graph.playlist.id, onGetItemEdgeCount, onRemoveItem, pushSnapshot],
  )

  const confirmCascadeRemove = useCallback(async () => {
    if (!cascadeConfirm) return
    pushSnapshot(state)
    dispatch({ type: 'REMOVE_ITEM', itemId: cascadeConfirm.itemId })
    const result = await onRemoveItem(cascadeConfirm.itemId, siteId)
    if (!result.ok) setSaveState('error')
    setCascadeConfirm(null)
  }, [cascadeConfirm, state, pushSnapshot, onRemoveItem, siteId])
```

- [ ] **Step 7: Add preview mode handlers**

```typescript
  const handlePreview = useCallback((snapshot: SnapshotRow) => {
    setPreviewSnapshot(snapshot)
    setIsPreviewMode(true)
    dispatch({
      type: 'LOAD',
      items: snapshot.graph_data.items.map(i => ({
        ...i,
        playlist_id: graph.playlist.id,
        created_at: '',
        content_type: null,
        title: i.id,
        status: null,
        category: null,
        metadata: null,
        is_ghost: false,
        other_playlist_count: 0,
        language: null,
        tags: [],
        hook: null,
        synopsis: null,
      })),
      edges: snapshot.graph_data.edges.map(e => ({
        ...e,
        playlist_id: graph.playlist.id,
        created_at: '',
      })),
    })
  }, [graph.playlist.id])

  const handleExitPreview = useCallback(() => {
    setIsPreviewMode(false)
    setPreviewSnapshot(null)
    setShowRestoreDialog(false)
    dispatch({ type: 'LOAD', items: graph.items, edges: graph.edges })
  }, [graph.items, graph.edges])

  const handleRestore = useCallback(async (mode: RestoreMode) => {
    if (!previewSnapshot) return
    const result = await onRestoreSnapshot(siteId, graph.playlist.id, previewSnapshot.id, mode)
    if (result.ok) {
      setIsPreviewMode(false)
      setPreviewSnapshot(null)
      setShowRestoreDialog(false)
      router.refresh()
    }
  }, [previewSnapshot, siteId, graph.playlist.id, onRestoreSnapshot, router])
```

- [ ] **Step 8: Add keyboard shortcuts for ⌘S and ⌘H**

In the `handleKeyDown` function, add before the existing `Cmd+P` check:

```typescript
      // Manual checkpoint
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!isPreviewMode) {
          flushDelta()
          const now = new Date()
          const label = `Checkpoint ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
          onCreateSnapshot(siteId, graph.playlist.id, 'manual', label)
        }
      }

      // Toggle history panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault()
        setShowHistory(prev => !prev)
        setShowSettings(false)
      }
```

Also update the Escape handler to exit preview:

```typescript
      } else if (e.key === 'Escape') {
        if (isPreviewMode) {
          handleExitPreview()
        } else {
          dispatch({ type: 'CLEAR_SELECTION' })
          setContextMenu(null)
          setEdgeSelector(null)
        }
      }
```

- [ ] **Step 9: Add `onToggleHistory` to PlaylistToolbar props and render**

In `playlist-toolbar.tsx`, add to props:
```typescript
  onToggleHistory: () => void
```

Add a history button in the toolbar right section (between Refresh and Settings):
```typescript
        <button
          onClick={onToggleHistory}
          className="rounded p-1.5 text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          title="Versões (⌘H)"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
```

- [ ] **Step 10: Render new panels and dialogs in JSX**

In the canvas JSX, after `<PlaylistSettings>`, add:

```typescript
        {/* Version history panel (mutually exclusive with settings) */}
        <VersionHistoryPanel
          isOpen={showHistory && !showSettings}
          onClose={() => setShowHistory(false)}
          siteId={siteId}
          playlistId={graph.playlist.id}
          onListSnapshots={onListSnapshots}
          onCreateSnapshot={onCreateSnapshot}
          onRenameSnapshot={onRenameSnapshot}
          onDeleteSnapshot={onDeleteSnapshot}
          onPreview={handlePreview}
        />
```

After the main layout div, render dialogs:

```typescript
      {/* Preview mode banner */}
      {isPreviewMode && previewSnapshot && (
        <div className="absolute left-1/2 top-14 z-40 -translate-x-1/2 rounded-lg border border-amber-500/30 bg-amber-950/90 px-4 py-2 text-sm text-amber-200 shadow-lg">
          📸 Preview: &quot;{previewSnapshot.label}&quot; — {new Date(previewSnapshot.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          <button onClick={() => setShowRestoreDialog(true)} className="ml-3 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700">Restaurar</button>
          <button onClick={handleExitPreview} className="ml-2 rounded bg-white/10 px-2 py-0.5 text-xs text-white/70 hover:bg-white/20">Fechar</button>
        </div>
      )}

      {/* Cascade confirm dialog */}
      {cascadeConfirm && (
        <CascadeConfirmDialog
          itemTitle={cascadeConfirm.itemTitle}
          edgeCount={cascadeConfirm.edgeCount}
          edges={cascadeConfirm.edges}
          onConfirm={confirmCascadeRemove}
          onCancel={() => setCascadeConfirm(null)}
        />
      )}

      {/* Restore mode dialog */}
      {showRestoreDialog && previewSnapshot && (
        <RestoreModeDialog
          snapshot={previewSnapshot}
          currentItemCount={graph.items.length}
          currentEdgeCount={graph.edges.length}
          onRestore={handleRestore}
          onCancel={() => setShowRestoreDialog(false)}
        />
      )}
```

- [ ] **Step 11: Update page.tsx to pass new action props**

In `apps/web/src/app/cms/(authed)/playlists/[id]/page.tsx`, add imports:

```typescript
import {
  // ... existing
  createPlaylistSnapshot,
  listPlaylistSnapshots,
  restorePlaylistSnapshot,
  renamePlaylistSnapshot,
  deletePlaylistSnapshot,
  getItemEdgeCount,
} from '../actions'
```

Add the new props to `<PlaylistCanvas>`:

```typescript
        onGetItemEdgeCount={getItemEdgeCount}
        onCreateSnapshot={createPlaylistSnapshot}
        onListSnapshots={listPlaylistSnapshots}
        onRestoreSnapshot={restorePlaylistSnapshot}
        onRenameSnapshot={renamePlaylistSnapshot}
        onDeleteSnapshot={deletePlaylistSnapshot}
```

- [ ] **Step 12: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`
Expected: No errors

- [ ] **Step 13: Run full test suite**

Run: `npm run test:web 2>&1 | tail -20`
Expected: All existing tests pass

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/app/cms/(authed)/playlists/
git commit -m "feat(playlist): integrate versioning into canvas (history panel, cascade guard, preview mode, shortcuts)"
```

---

### Task 15: Snapshot Cleanup Cron

**Files:**
- Create: `apps/web/src/app/api/cron/snapshot-cleanup/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
// apps/web/src/app/api/cron/snapshot-cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// Vercel Cron: { "path": "/api/cron/snapshot-cleanup", "schedule": "0 4 * * *" }

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()
  let deletedCount = 0

  // 1. Delete expired snapshots (auto: 30 days, pre_destructive: 90 days)
  const { data: expired } = await supabase
    .from('playlist_snapshots')
    .delete()
    .lt('expires_at', now)
    .not('expires_at', 'is', null)
    .select('id')

  deletedCount += expired?.length ?? 0

  // 2. Enforce per-playlist cap: max 100 auto-snapshots (backup for on-create)
  const { data: playlists } = await supabase
    .from('playlist_snapshots')
    .select('playlist_id')
    .eq('type', 'auto')

  const playlistIds = [...new Set((playlists ?? []).map(p => p.playlist_id))]

  for (const playlistId of playlistIds) {
    const { data: autoSnapshots } = await supabase
      .from('playlist_snapshots')
      .select('id')
      .eq('playlist_id', playlistId)
      .eq('type', 'auto')
      .order('created_at', { ascending: true })

    if (autoSnapshots && autoSnapshots.length > 100) {
      const toDelete = autoSnapshots.slice(0, autoSnapshots.length - 100)
      for (const s of toDelete) {
        await supabase.from('playlist_snapshots').delete().eq('id', s.id)
        deletedCount++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    deleted: deletedCount,
    timestamp: now,
  })
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/cron/snapshot-cleanup/route.ts
git commit -m "feat(playlist): add daily snapshot cleanup cron (expires + cap enforcement)"
```

---

### Task 16: Integration Tests (DB-gated)

**Files:**
- Create: `apps/web/test/integration/playlists/snapshots.test.ts`

- [ ] **Step 1: Write integration test suite**

```typescript
// apps/web/test/integration/playlists/snapshots.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { skipIfNoLocalDb } from '../../helpers/db-skip'
import { createSnapshot, withSnapshot } from '@/lib/playlists/snapshot-middleware'

describe.skipIf(skipIfNoLocalDb())('playlist snapshots (integration)', () => {
  // These tests require a running local Supabase instance
  // Run with: npm run db:start && HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/playlists/snapshots.test.ts

  it.todo('createSnapshot inserts a row with correct graph_data')
  it.todo('createSnapshot deduplicates auto-type by content_hash')
  it.todo('withSnapshot creates snapshot before executing mutation')
  it.todo('restore_playlist_snapshot RPC restores full state')
  it.todo('restore_playlist_snapshot RPC restores edges_only (skips items from snapshot not in current)')
  it.todo('restore_playlist_snapshot RPC restores positions_only')
  it.todo('cleanup cron deletes expired auto snapshots')
})
```

- [ ] **Step 2: Run the test to confirm the suite is recognized**

Run: `npx vitest run apps/web/test/integration/playlists/snapshots.test.ts 2>&1 | tail -10`
Expected: All tests SKIPPED (no local DB) or PASS with `.todo`

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/integration/playlists/snapshots.test.ts
git commit -m "test(playlist): add integration test skeleton for snapshot system (DB-gated)"
```

---

## Post-Implementation Checklist

After all tasks are complete:

1. Run full test suite: `npm test`
2. Run typecheck: `npx tsc --noEmit -p apps/web/tsconfig.json`
3. Start dev server and test manually:
   - Open playlist editor → verify session-start snapshot created
   - Delete item with edges → verify cascade dialog appears
   - ⌘S → verify checkpoint created in history panel
   - ⌘H → verify history panel opens
   - Click snapshot → verify preview mode
   - Restore from preview → verify data restored
   - Wait 5 min of active editing → verify auto-snapshot created
4. Check that existing playlist tests still pass
5. Push to staging when confident
