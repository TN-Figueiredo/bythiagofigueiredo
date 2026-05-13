# Playlist Auto-Layout v2 — Intelligent Graph Positioning

**Date:** 2026-05-13
**Status:** Approved
**Scope:** `apps/web/src/lib/playlists/canvas/auto-layout.ts` + node component CSS fix

---

## Problem

The current auto-layout algorithm produces poor results:

1. **Node overlap**: `LAYER_GAP_X = 200` but nodes render at ~300px wide (`min-w-[160px]`, no max-width), causing massive horizontal overlap
2. **Only sequence edges**: `related`, `prerequisite`, and `continuation` edges are ignored — disconnected items land in layer 0 with no spatial intelligence
3. **No cross-minimization**: within-layer ordering uses `sort_order` only, not connection proximity
4. **No vertical centering**: all layers top-align at y=0
5. **No hub awareness**: highly-connected nodes aren't centralized
6. **No chain alignment**: sequential items don't form clean horizontal lines
7. **Multiple roots stack**: independent chains pile at y=0

## Solution: 7-Phase Hybrid Layout

### Constants

```typescript
const NODE_W = 280    // match max-w-[280px] on node component
const NODE_H = 100    // card with header + body + optional badge
const LAYER_GAP = 340  // NODE_W + 60px breathing room
const ROW_GAP = 130    // NODE_H + 30px breathing room
const ORPHAN_GAP = 200 // separation between main graph and orphan zone
const MAX_PER_LAYER = 5 // soft cap before overflow to adjacent layers
const HUB_THRESHOLD = 3 // degree at which hub centering kicks in
const HUB_BIAS = 0.2    // blend weight toward layer midpoint
const BARYCENTER_SWEEPS = 4
```

### Phase 1 — Layer Assignment (Kahn's Topological Sort)

Unchanged from v1. Sequence edges only → topological layers.

- Build in-degree map and adjacency list from `sequence` edges
- Kahn's algorithm assigns layer numbers (0, 1, 2...)
- Nodes without sequence edges → `layer = null` (unassigned)

**Output**: `Map<itemId, layerNumber | null>`

### Phase 2 — Disconnected Node Placement

For items where `layer = null`:

1. **Has non-sequence edges to layered nodes**: Compute the **mean layer** of all connected neighbors that already have layers (uniform weight per neighbor). Round to nearest integer. If that layer has ≥ `MAX_PER_LAYER` nodes, try layer ± 1 (prefer the less populated side).
2. **Connected only to other disconnected nodes**: Assign to a cluster layer at `maxLayer + 2`.
3. **True orphans (zero edges)**: Mark for orphan zone (handled in Phase 7).

**Output**: All items now have a layer assignment.

### Phase 3 — Barycenter Cross-Minimization

Uses ALL edge types (sequence, related, prerequisite, continuation) — this is the key improvement.

**Initial ordering**: within each layer, sort by `sort_order`.

**4 alternating sweeps** (L→R, R→L, L→R, R→L):

For each layer in sweep direction:
1. For each node, collect all neighbors in adjacent layers (both sides)
2. Compute **barycenter** = mean vertical index of those neighbors
3. For nodes with degree ≥ `HUB_THRESHOLD`: blend barycenter 20% toward the layer's vertical midpoint (integrated hub centering)
4. Nodes without cross-layer neighbors retain their current position
5. Sort the layer by barycenter value; **tie-break** by `sort_order`

**Output**: Optimized within-layer ordering.

### Phase 4 — Chain Alignment

Detect **linear chains**: sequences of nodes where each has exactly 1 outgoing sequence edge and the next has exactly 1 incoming sequence edge.

For each detected chain:
- Compute the **median y-index** of the chain's members (from barycenter ordering)
- Assign all chain members to that y-index
- Non-chain nodes in the same layers are assigned the remaining indices (preserving their relative order)

This creates clean horizontal lines for sequential content — the most common pattern.

**Output**: Adjusted within-layer ordering with aligned chains.

### Phase 5 — Fan-out/Fan-in Symmetry

- **Fan-out** (node A has N outgoing sequence edges → B, C, D): Spread targets symmetrically around A's y-index. If A is at index 3 and has 3 targets, place them at 2, 3, 4.
- **Fan-in** (nodes B, C converge → D): Set D's y-index to the average of B and C's y-indices.

These adjustments override barycenter order only for directly connected fan patterns. Apply after chain alignment to avoid conflicts.

**Output**: Final within-layer ordering.

### Phase 6 — Multiple Root Balancing

When there are N root nodes (in-degree 0 in sequence edges), sort by **subtree size** (number of descendants reachable via sequence edges). Place the largest subtree centered, smaller ones outward.

Ordering within layer 0: `[small₁, small₂, ..., LARGEST, ..., small₃, small₄]`

**Output**: Reordered layer 0.

### Phase 7 — Coordinate Assignment

Final pixel coordinates:

```
x = layerIndex × LAYER_GAP
y = positionInLayer × ROW_GAP
```

**Vertical centering**: Find the tallest layer (most nodes). Compute its vertical midpoint. Offset every layer's y-coordinates so all layers center around the same midpoint.

```typescript
const maxHeight = Math.max(...layerSizes) * ROW_GAP
for each layer:
  const layerHeight = layerSize * ROW_GAP
  const offset = (maxHeight - layerHeight) / 2
  for each node in layer:
    node.y += offset
```

**Orphan zone**: Items with zero edges placed below the main graph:
- Start y = `globalMaxY + ORPHAN_GAP`
- Grid layout: max 4 per row, `LAYER_GAP` horizontal, `ROW_GAP` vertical

**Output**: `LayoutPosition[]` — same signature as v1.

---

## CSS Changes

### `playlist-node.tsx`

Add `max-w-[280px]` to the node container div and `truncate` to the title `<h4>` to prevent unbounded width growth.

### `utils.ts`

Update dimension constants:
- `NODE_WIDTH`: 160 → 280
- `NODE_HEIGHT`: 80 → 100

Update `fitAllNodes` default `nodeWidth` parameter: 180 → 280.

---

## Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/playlists/canvas/auto-layout.ts` | Full rewrite — 7-phase algorithm |
| `apps/web/src/lib/playlists/canvas/utils.ts` | Update NODE_WIDTH/NODE_HEIGHT constants |
| `apps/web/src/app/cms/(authed)/playlists/[id]/_components/playlist-node.tsx` | Add max-w-[280px] + truncate |
| `apps/web/test/lib/playlists/auto-layout.test.ts` | New comprehensive test suite |
| `docs/cowork-playlist-reference.md` | Update Auto-Layout section |

---

## Test Plan

### Unit Tests (auto-layout.test.ts)

1. **Empty/single node** — returns empty / origin position
2. **Linear chain** (A→B→C) — left-to-right, same y (chain alignment)
3. **Fan-out** (A→B, A→C, A→D) — B, C, D symmetric around A's y
4. **Fan-in** (B, C→D) — D centered between B and C
5. **Diamond** (A→B, A→C, B→D, C→D) — symmetric layout
6. **Disconnected with related edges** — placed near related neighbors
7. **True orphans** — placed in orphan zone below main graph
8. **Hub centering** — high-degree node centered in its layer
9. **Multiple roots** — largest subtree centered in layer 0
10. **Cross-minimization** — fewer crossings than sort_order-only ordering
11. **No overlap** — all node positions separated by at least NODE_W (x) and NODE_H (y)
12. **Vertical centering** — all layers centered around same midpoint
13. **Non-sequence edges ignored for layering** — only affect within-layer ordering
14. **Large graph (20+ nodes)** — completes in < 50ms

### Integration (manual)

- Open "Life Chapters — The Journey" playlist
- Click auto-layout button
- Verify: no overlapping nodes, clean horizontal chains, related items nearby, hub nodes central
- Verify: edges don't overlap nodes excessively
- Verify: zoom-to-fit shows entire graph properly with new dimensions

---

## Edge Cases

- **Cycle in sequence edges**: Impossible — DB trigger prevents. Algorithm safe.
- **Single disconnected node**: Goes to orphan zone, not awkwardly placed at origin.
- **All disconnected**: No sequence edges → all placed in grid, no layer structure needed.
- **Very wide graph (20+ layers)**: Layout extends horizontally; `fitAllNodes` handles zoom.
- **Dense layer (10+ nodes)**: Vertical layout extends; centering keeps it balanced.

---

## Non-Goals

- Animated transitions during layout (future enhancement)
- Interactive preview before applying (future)
- Incremental layout for 100+ nodes (not needed for playlist scale)
- Edge label overlap avoidance (edge labels are optional and rare)
