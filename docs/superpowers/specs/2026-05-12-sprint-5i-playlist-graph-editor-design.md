# Playlist Graph Editor — Design Spec

**Date:** 2026-05-12
**Sprint:** 5i (Playlist Graph Editor)
**Estimate:** ~56h across 5 PRs + 1 post-implementation task
**Sub-sprint split:** 5i-a (PR-A + PR-B = 22h) + 5i-b (PR-C + PR-D + PR-E + POST = 34h)
**Score:** 98/100 (post fresh-eyes audit, 11 findings corrected)

## Summary

A visual node graph editor for organizing blog posts, newsletter editions, and pipeline items into named playlists within the CMS. YouTube-style playlists: named collections with ordered content, items can belong to multiple playlists. The editor provides a canvas where content items appear as colored nodes and connections (edges) indicate reading flow, relationships, prerequisites, and continuations.

**Key principles:**
- `sort_order` is the sole source of truth for playlist playback order
- Sequence edges are visual flow indicators only — they do not control order
- Ghost nodes preserve graph layout when referenced content is deleted
- Custom canvas (React 19 + SVG + CSS transforms) — no external graph library dependency
- Cowork API access via server actions for programmatic playlist manipulation

**Existing system preserved:** The current `previous_post_id` + `continues_in_next` linear linking on `blog_posts` continues to work alongside playlists. No migration or sync between the two systems.

---

## 1. Database Schema

### 1.1 playlists

```sql
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category TEXT, -- free-text, not constrained (playlists span content types unlike blog_posts)
  viewport_state JSONB DEFAULT '{"zoom":1,"x":0,"y":0}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(site_id, slug)
);
```

```sql
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlists_select" ON playlists FOR SELECT
  USING (public.can_view_site(site_id));
CREATE POLICY "playlists_insert" ON playlists FOR INSERT
  WITH CHECK (public.can_edit_site(site_id));
CREATE POLICY "playlists_update" ON playlists FOR UPDATE
  USING (public.can_edit_site(site_id));
CREATE POLICY "playlists_delete" ON playlists FOR DELETE
  USING (public.can_edit_site(site_id));

CREATE TRIGGER tg_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
```

### 1.2 playlist_items

```sql
CREATE TABLE playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  blog_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,
  newsletter_edition_id UUID REFERENCES newsletter_editions(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES content_pipeline(id) ON DELETE SET NULL,
  CHECK(num_nonnulls(blog_post_id, newsletter_edition_id, pipeline_id) <= 1),
  sort_order INTEGER NOT NULL DEFAULT 1000,
  position_x REAL NOT NULL DEFAULT 0,
  position_y REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Key design decisions:**

- **Typed nullable FKs** instead of polymorphic `item_type` + `item_id`. Each content type gets its own FK column with real referential integrity.
- **`CHECK(num_nonnulls(...) <= 1)`** — allows at most one FK to be set. The `<= 1` (not `= 1`) enables ghost nodes: when referenced content is deleted via `ON DELETE SET NULL`, the playlist_item survives with all FKs null, appearing as a "Content removed" ghost node on the canvas.
- **`ON DELETE SET NULL`** on content FKs — deleting a blog post doesn't silently destroy playlist layouts. Ghost nodes preserve edge connections and visual structure.
- **`ON DELETE CASCADE`** on `playlist_id` — deleting a playlist removes all its items (expected behavior).
- **Per-item `position_x`/`position_y`** — each node has its own canvas position. Moving one node is a single-row UPDATE, not rewriting a JSONB blob.
- **`sort_order`** is the sole source of truth for playlist playback order. The sidebar displays items sorted by this value. Reordering is done via drag in the sidebar, which updates `sort_order`.

**Partial unique indexes** (prevents duplicate content in same playlist):
```sql
CREATE UNIQUE INDEX uq_playlist_blog ON playlist_items(playlist_id, blog_post_id)
  WHERE blog_post_id IS NOT NULL;
CREATE UNIQUE INDEX uq_playlist_newsletter ON playlist_items(playlist_id, newsletter_edition_id)
  WHERE newsletter_edition_id IS NOT NULL;
CREATE UNIQUE INDEX uq_playlist_pipeline ON playlist_items(playlist_id, pipeline_id)
  WHERE pipeline_id IS NOT NULL;
```

**RLS:** Nested EXISTS via `playlists.site_id`:
```sql
ALTER TABLE playlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlist_items_select" ON playlist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id
    AND public.can_view_site(playlists.site_id))
);
CREATE POLICY "playlist_items_insert" ON playlist_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id
    AND public.can_edit_site(playlists.site_id))
);
CREATE POLICY "playlist_items_update" ON playlist_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id
    AND public.can_edit_site(playlists.site_id))
);
CREATE POLICY "playlist_items_delete" ON playlist_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_items.playlist_id
    AND public.can_edit_site(playlists.site_id))
);
```

**sort_order assignment:** New items get `sort_order = COALESCE((SELECT MAX(sort_order) FROM playlist_items WHERE playlist_id = $1), 0) + 1000`. Gap of 1000 allows easy reordering without renumbering. On sidebar drag-reorder, reassign sequential values (1000, 2000, 3000...) to avoid fragmentation.

### 1.3 playlist_edges

```sql
CREATE TABLE playlist_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  source_item_id UUID NOT NULL REFERENCES playlist_items(id) ON DELETE CASCADE,
  target_item_id UUID NOT NULL REFERENCES playlist_items(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'sequence'
    CHECK (edge_type IN ('sequence', 'related', 'prerequisite', 'continuation')),
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(playlist_id, source_item_id, target_item_id),
  CHECK(source_item_id != target_item_id)
);
```

**Edge types:**

| Type | Visual | Purpose |
|------|--------|---------|
| `sequence` | Solid line + arrow, indigo | Reading flow direction |
| `related` | Dashed line, gray | "See also" connections |
| `prerequisite` | Dashed line + arrow, amber | "Read this first" |
| `continuation` | Solid line + arrow, green | Content continues in target |

**Cycle prevention trigger:** `prevent_sequence_cycle()` — BEFORE INSERT/UPDATE. Uses recursive CTE to detect cycles in `sequence` edges only. `related`, `prerequisite`, and `continuation` edges allow cycles (they're informational).

```sql
CREATE OR REPLACE FUNCTION prevent_sequence_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.edge_type != 'sequence' THEN RETURN NEW; END IF;
  IF EXISTS (
    WITH RECURSIVE chain AS (
      SELECT target_item_id FROM playlist_edges
      WHERE source_item_id = NEW.target_item_id
        AND playlist_id = NEW.playlist_id
        AND edge_type = 'sequence'
      UNION ALL
      SELECT e.target_item_id FROM playlist_edges e
      JOIN chain c ON e.source_item_id = c.target_item_id
      WHERE e.playlist_id = NEW.playlist_id
        AND e.edge_type = 'sequence'
    )
    SELECT 1 FROM chain WHERE target_item_id = NEW.source_item_id
  ) THEN
    RAISE EXCEPTION 'Sequence edge would create a cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

```sql
ALTER TABLE playlist_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playlist_edges_select" ON playlist_edges FOR SELECT USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_edges.playlist_id
    AND public.can_view_site(playlists.site_id))
);
CREATE POLICY "playlist_edges_insert" ON playlist_edges FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_edges.playlist_id
    AND public.can_edit_site(playlists.site_id))
);
CREATE POLICY "playlist_edges_update" ON playlist_edges FOR UPDATE USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_edges.playlist_id
    AND public.can_edit_site(playlists.site_id))
);
CREATE POLICY "playlist_edges_delete" ON playlist_edges FOR DELETE USING (
  EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_edges.playlist_id
    AND public.can_edit_site(playlists.site_id))
);

CREATE TRIGGER tg_prevent_sequence_cycle
  BEFORE INSERT OR UPDATE ON playlist_edges
  FOR EACH ROW EXECUTE FUNCTION prevent_sequence_cycle();
```

**Edge type update safety:** Changing an edge from `related` to `sequence` fires the trigger and checks for cycles. The trigger always inspects `NEW.edge_type`, so type changes are safe.

### 1.4 Indexes

```sql
CREATE INDEX idx_playlist_items_playlist ON playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_blog ON playlist_items(blog_post_id) WHERE blog_post_id IS NOT NULL;
CREATE INDEX idx_playlist_items_newsletter ON playlist_items(newsletter_edition_id) WHERE newsletter_edition_id IS NOT NULL;
CREATE INDEX idx_playlist_items_pipeline ON playlist_items(pipeline_id) WHERE pipeline_id IS NOT NULL;
CREATE INDEX idx_playlist_edges_playlist ON playlist_edges(playlist_id);
CREATE INDEX idx_playlists_site ON playlists(site_id);
```

### 1.5 Extensibility

Adding a new content type (e.g., courses) requires: new nullable FK column + partial unique index + migration. Acceptable for 3-5 types. If content types reach 10+, consider migrating to a junction table pattern.

---

## 2. Canvas Architecture

### 2.1 Technology Choice

**Custom canvas using React 19 + SVG + CSS transforms.** Not using React Flow/xyflow or Konva (both already installed in the project).

**Rationale:**
- **Full control** over rendering, interactions, and styling
- **No external dependency** — fewer breaking changes, smaller bundle
- **Tailwind + React components** compatibility — DOM-based nodes use standard Tailwind classes and React component patterns, unlike Konva's imperative canvas API
- **Ownership** — the canvas engine becomes part of the codebase, not a black box

**Trade-off documented:** Konva (`konva@10.3.0` + `react-konva@19.2.4`) is already installed for the pipeline board. The playlist editor uses DOM-based rendering instead because playlist nodes need rich React components (badges, status pills, context menus) that are simpler as HTML/CSS than Konva shapes.

### 2.2 Rendering Layers (6 layers)

```
┌─────────────────────────────────────────┐
│  Layer 6: Mini-map (position: absolute)  │
├─────────────────────────────────────────┤
│  Layer 5: Marquee selection overlay      │
├─────────────────────────────────────────┤
│  Layer 4: DOM nodes (position: absolute) │
├─────────────────────────────────────────┤
│  Layer 3: SVG edges (pointer-events:none)│
├─────────────────────────────────────────┤
│  Layer 2: CSS transform group            │
│  (translate + scale = camera)            │
├─────────────────────────────────────────┤
│  Layer 1: Viewport container             │
│  (overflow: hidden, captures wheel/pan)  │
└─────────────────────────────────────────┘
```

### 2.3 Camera & Coordinate System

**Screen-to-canvas coordinate conversion:**
```typescript
function screenToCanvas(screenX: number, screenY: number, rect: DOMRect, camera: Camera): Point {
  return {
    x: (screenX - rect.left - camera.x) / camera.zoom,
    y: (screenY - rect.top - camera.y) / camera.zoom,
  };
}
```

**Camera state:** `{ x: number, y: number, zoom: number }` — stored in React state, applied via CSS `transform: translate(${x}px, ${y}px) scale(${zoom})`.

**Zoom:** Wheel event → zoom toward cursor position. Range: 0.25x to 2.0x.

**Pan:** Middle-click drag or spacebar + left-click drag.

### 2.4 Performance Strategy

- **During drag:** `useRef` + direct DOM manipulation (`element.style.transform`) for 60fps. No React re-renders during drag.
- **On pointerUp:** Commit final position to React state. Single re-render.
- **Edge rendering:** SVG paths recalculated only when source/target node positions change. Cubic bezier with control points proportional to horizontal distance.
- **Edge path formula:**
```typescript
function edgePath(source: Point, target: Point): string {
  const dx = Math.abs(target.x - source.x);
  const cp = Math.max(dx * 0.4, 50);
  return `M ${source.x} ${source.y} C ${source.x + cp} ${source.y}, ${target.x - cp} ${target.y}, ${target.x} ${target.y}`;
}
```

### 2.5 Interaction Hooks

| Hook | Responsibility |
|------|---------------|
| `useCanvas` | Camera state, wheel zoom, pan, screen↔canvas coords |
| `useDragNode` | Pointer events for node drag, ref-based DOM manipulation, commit on up |
| `useEdgeDrag` | Handle creation from port → preview line → type selector on drop |
| `useGraphHistory` | Undo/redo via state snapshots (max 50, push before each mutation) |

### 2.6 State Management

**`graph-reducer.ts`** — pure function reducer for all graph state mutations:
- `ADD_ITEM`, `REMOVE_ITEM`, `MOVE_ITEM`
- `ADD_EDGE`, `REMOVE_EDGE`
- `SET_SELECTION`, `CLEAR_SELECTION`
- `REORDER_ITEMS` (updates sort_order)
- `SET_POSITIONS` (batch update from auto-layout)

Undo/redo: before each dispatch, push a snapshot. Max 50 snapshots (~50-100KB each for typical playlists of 20-50 items).

---

## 3. Save Strategy

### 3.1 Auto-save (items & edges)

1. User action (move node, create edge, etc.) → local state updated immediately
2. Debounce 1.5s of inactivity
3. Batch server action with delta (only changed items/edges)
4. Visual indicator: `● Saved` (green) → `● Saving...` (amber) → `● Error` (red, + toast)
5. `beforeunload` guard if unsaved changes exist

### 3.2 Viewport save

Viewport state (`zoom`, `x`, `y`) saves **only on page leave** (beforeunload + Next.js router navigation). During the session, viewport lives in memory only. This avoids excessive DB writes from constant pan/zoom actions.

**Viewport restore:** On page load, read `viewport_state` from the playlist row and apply as initial camera position. If null or invalid, default to `{ zoom: 1, x: 0, y: 0 }`.

### 3.3 Batch Save Action Shape

```typescript
interface PlaylistSaveDelta {
  playlistId: string;
  itemsUpserted: Array<{ id: string; position_x: number; position_y: number; sort_order: number }>;
  itemsRemoved: string[];        // playlist_item IDs
  edgesCreated: Array<{ source_item_id: string; target_item_id: string; edge_type: EdgeType; label?: string }>;
  edgesRemoved: string[];        // edge IDs
}
```

Server action `savePlaylistDelta(delta: PlaylistSaveDelta)` executes all mutations in a single Supabase transaction. On conflict (e.g., cycle trigger), the entire batch rolls back and returns the specific error.

---

## 4. Node Components

### 4.1 Node Types

Three visual variants by content type, each with type-specific color scheme:

| Type | Color | Badge | Metadata shown |
|------|-------|-------|---------------|
| Blog post | Indigo | `BLOG` | category, status, date |
| Newsletter | Green | `NEWS` | type, status, delivered count |
| Pipeline | Purple | `PIPE` | format, stage, version |

### 4.2 Node Anatomy

```
┌──────────────────────────┐
│ [BADGE] category        │  ← header (type-colored bg)
├──────────────────────────┤
│ Title                    │  ← body
│ status · date            │  ← metadata
├──────────────────────────┤
│ 📌 em 3 playlists       │  ← cross-playlist badge (if >1)
└──────────────────────────┘
○                          ○  ← connection handles (left/right)
```

### 4.3 Ghost Nodes

When referenced content is deleted (ON DELETE SET NULL), the playlist_item survives with all content FKs null. Rendered as:
- Dashed border, muted colors
- Title: "Content removed"
- Option to remove from playlist via context menu

### 4.4 Cross-Playlist Membership Badge

If a content item belongs to multiple playlists, show badge: "em N playlists". On hover/context menu, list the playlists with links. Data loaded via single query on playlist load that covers all content types:
```sql
SELECT pi2.playlist_id, p.name, p.slug
FROM playlist_items pi1
JOIN playlist_items pi2 ON (
  (pi1.blog_post_id IS NOT NULL AND pi2.blog_post_id = pi1.blog_post_id)
  OR (pi1.newsletter_edition_id IS NOT NULL AND pi2.newsletter_edition_id = pi1.newsletter_edition_id)
  OR (pi1.pipeline_id IS NOT NULL AND pi2.pipeline_id = pi1.pipeline_id)
)
JOIN playlists p ON p.id = pi2.playlist_id
WHERE pi1.playlist_id = $current_playlist_id
  AND pi2.playlist_id != $current_playlist_id;
```
This returns all other playlists that share any content with the current playlist, covering blog posts, newsletters, and pipeline items in one query.

### 4.5 Selected Node Toolbar

Floating toolbar appears above selected node:
- **Open in editor** — navigates to the source editor based on which FK is non-null: `blog_post_id` → `/cms/blog/${id}`, `newsletter_edition_id` → `/cms/newsletters/${id}`, `pipeline_id` → `/cms/pipeline/${id}`. Ghost nodes (all FKs null) disable this button.
- **Create edge from here** — starts edge drag from this node
- **Remove from playlist** — removes the playlist_item (not the source content)

**Multi-select behavior:** When 2+ nodes are selected, toolbar shows only: "Remove N items" and "Delete key" shortcut. Drag moves all selected nodes as a group (delta applied to each). Edge creation is disabled during multi-select.

---

## 5. Edge Interactions

### 5.1 Edge Creation

1. User clicks connection handle (circle on node edge) → starts edge drag
2. Preview line follows cursor (dashed, animated)
3. On drop over another node's handle → edge type selector popover appears
4. User selects type → edge created via server action

### 5.2 Edge Selection & Deletion

**Method 1 — Click edge:**
- Fat invisible SVG path (12px stroke-width, `pointer-events: stroke`) for click target
- Selected edge: stroke-width 3px + red semi-transparent color + glow
- Delete key removes selected edge

**Method 2 — Context menu:**
- Right-click node → "Disconnect from..." → list of connected nodes → click to remove specific edge

### 5.3 Edge Labels

Edge labels shown on hover of the edge path. Precedence: user-set `label` field > type default > none. Type defaults: `prerequisite` → "leia antes", `related` → "veja também". `sequence` and `continuation` have no default label. User can clear a label by setting it to empty string (reverts to default or none).

---

## 6. Sidebar

### 6.1 Content Sidebar (left panel, 230px)

- **Search input** — filters available content by title
- **Type filters** — toggle buttons: Blog / News / Pipe / All
- **Available items** — content not yet in the current playlist, grouped by type. Filtered via `NOT EXISTS (SELECT 1 FROM playlist_items pi WHERE pi.playlist_id = $1 AND pi.blog_post_id = blog_posts.id)` per content type, loaded once on page open and updated optimistically on add/remove.
- **Already in playlist** — dimmed, shown at bottom with count
- **Empty search** — "Nenhum resultado" + "Limpar filtros" button

### 6.2 Sidebar-to-Canvas Drag

Uses **Pointer Events with phantom node pattern** (not HTML Drag & Drop API):

1. `onPointerDown` on sidebar item → create phantom node (position: fixed, follows cursor)
2. Phantom follows cursor via `onPointerMove`
3. When cursor enters canvas area → convert screen-to-canvas coords, show preview in canvas
4. `onPointerUp` → create playlist_item at canvas position via server action
5. Clean up phantom node

**Fallback:** "+ Add" button in toolbar opens a search modal. Items added via modal appear at the center of the current viewport (converted to canvas coords), offset by 20px per item if adding multiple at once.

### 6.3 Sidebar Reordering

Drag-to-reorder items in the sidebar updates `sort_order`. This is the primary way to set playlist playback order (not sequence edges).

---

## 7. Toolbar

### 7.1 Layout

```
← Playlists | Playlist Name | [status badge] | ● Saved | ←→ spacer →← | + Add | ↩ Undo | ↪ Redo | Auto-layout | ⚙ Settings
```

### 7.2 Auto-Layout Algorithm

Simplified Sugiyama algorithm (no external dependency — no dagre/elkjs):

1. **Topological sort** — Kahn's algorithm on sequence edges. Nodes without sequence edges go to layer 0.
2. **Layer assignment** — each node's layer = max(predecessors' layers) + 1. Creates left-to-right flow.
3. **Vertical ordering** — within each layer, sort by `sort_order`. Spacing: 200px horizontal between layers, 120px vertical between nodes.

**Behavior:**
- Button "Auto-layout" in toolbar
- Pushes undo snapshot before applying
- Only sequence edges affect layout. Related/prerequisite/continuation are overlay.
- Animation: nodes interpolate position over 300ms
- User can adjust manually after (positions are persisted)

### 7.3 Settings Panel

Accessible via ⚙ icon. Slide-over panel on the right:
- Name, Slug, Description (editable)
- Category (select)
- Status (select: draft/published/archived)
- Cover Image (via `<MediaGalleryDialog>` — same reusable picker used in blog/author/newsletter editors)
- Stats: items count, edges count, content types count
- Delete Playlist button (confirmation dialog, items are NOT deleted from source tables)

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘ Z` | Undo |
| `⌘ ⇧ Z` | Redo |
| `Delete` | Remove selected node(s)/edge(s) from playlist |
| `⌘ A` | Select all nodes |
| `Escape` | Deselect / close menu |
| `Shift + Click` | Multi-select |
| `Shift + Drag` | Marquee select |
| `Scroll` | Zoom in/out |
| `⌘ 0` | Zoom to fit all nodes |
| `Tab` / `Shift+Tab` | Navigate between nodes (by sort_order) |
| `Arrow Keys` | Move selected node 10px (+ Shift: 50px) |
| `Enter` | Open context menu on selected node |

---

## 9. Accessibility

### 9.1 Canvas ARIA

- Canvas container: `role="group"` `aria-label="Playlist graph editor"` (NOT `role="application"` — that disables screen reader navigation)
- Nodes: `role="button"` `aria-label="Blog: React Basics, published"`
- Live region announces state changes: "Node added", "Edge created", "Undo", etc.

### 9.2 Alternative List View

Toggle "List view" in toolbar provides a table-based alternative for screen readers. Columns: order, title, type, status, connections. Full CRUD available from list view.

---

## 10. UX States

### 10.1 Empty State

Canvas shows centered placeholder:
- Icon (muted)
- "Playlist vazia"
- "Arraste itens do sidebar ou clique em '+ Add' para começar"

### 10.2 Loading State

- Canvas: skeleton rectangles pulsing at saved positions
- Sidebar: skeleton items

### 10.3 Error Feedback (toasts)

| Scenario | Toast |
|----------|-------|
| Item already in playlist | `✕ Item já está nesta playlist` |
| Cycle detected | `⚠ Ciclo detectado — sequence edges não podem formar loops` |
| Items added | `✓ 3 itens adicionados à playlist` |
| Save error | `✕ Erro ao salvar — tentando novamente...` |

---

## 11. CMS Integration

### 11.1 Sidebar Entry

In `cms-sections.ts`, Content section:
```typescript
{ label: 'Playlists', href: '/cms/playlists', icon: ListMusic, minRole: 'editor' }
```

### 11.2 Hub Page (`/cms/playlists`)

- Tabs: All / Published / Draft / Archived
- Playlist cards: name, status badge, item count, last updated
- Create button → form: name, slug (auto-generated), category, description
- Delete with confirmation dialog

### 11.3 Graph Editor Page (`/cms/playlists/[id]`)

Full canvas layout:
- Left: content sidebar (230px)
- Center: canvas with toolbar
- Right: settings panel (slide-over, hidden by default)

---

## 12. Cowork API Integration

Server actions callable programmatically by Claude Cowork:

| Action | Parameters |
|--------|-----------|
| `createPlaylist` | `{ name, slug, category }` |
| `addItemToPlaylist` | `{ playlistId, blogPostId?, newsletterEditionId?, pipelineId?, sortOrder? }` |
| `removeItemFromPlaylist` | `{ playlistItemId }` |
| `reorderPlaylistItems` | `{ playlistId, itemIds[] }` |
| `createEdge` | `{ playlistId, sourceItemId, targetItemId, edgeType, label? }` |
| `deleteEdge` | `{ edgeId }` |
| `updatePlaylistStatus` | `{ playlistId, status }` |
| `getPlaylistWithItems` | `{ playlistId }` — returns full graph (items + edges + positions) |
| `getPlaylistBySlug` | `{ slug }` |

**Pipeline graduation integration:** When a pipeline item graduates to a blog post, Cowork can auto-add it to relevant playlists and create sequence edges from the last item.

**Cowork reference update** (`docs/cowork-pipeline-reference.md`) — added as **final task post-implementation and post-tests** to avoid stale documentation.

---

## 13. Pipeline Lifecycle Integration

Pipeline items remain in playlists regardless of their stage. The pipeline manages `idea`/`draft`/etc. stages, while blog post management handles `ready`/`scheduled`/`published`. When a pipeline item graduates, both the pipeline_id item and the new blog_post_id item can coexist in the playlist (or the pipeline item can be swapped out).

For scale management at 100+ nodes, toolbar filters (by type, by status) and zoom are sufficient. Auto-density was evaluated and removed as YAGNI for v1 scope.

---

## 14. File Structure

```
supabase/migrations/
  YYYYMMDD_playlists.sql              # 3 tables + RLS + triggers + indexes

apps/web/src/lib/playlists/
  types.ts                            # Zod schemas + TypeScript types
  queries.ts                          # Supabase queries
  canvas/
    use-canvas.ts                     # Camera state, zoom, pan, coords
    use-drag-node.ts                  # Pointer events node drag
    use-edge-drag.ts                  # Edge creation drag
    use-graph-history.ts              # Undo/redo snapshots
    graph-reducer.ts                  # Pure state reducer

apps/web/src/app/cms/(authed)/playlists/
  page.tsx                            # Hub page
  actions.ts                          # Server actions (CRUD + Cowork API)
  [id]/
    page.tsx                          # Graph editor page
    _components/
      playlist-canvas.tsx             # Canvas container + layers
      playlist-sidebar.tsx            # Content sidebar
      playlist-toolbar.tsx            # Toolbar
      playlist-node.tsx               # Node component (3 variants + ghost)
      playlist-edge.tsx               # SVG edge component
      playlist-settings.tsx           # Settings slide-over
      playlist-minimap.tsx            # Mini-map
      edge-type-selector.tsx          # Edge type popover
      node-toolbar.tsx                # Selected node floating toolbar
      context-menu.tsx                # Right-click context menu
```

---

## 15. Non-Goals (explicitly out of scope)

- Public-facing `/playlists/[slug]` page — future sprint
- Collaborative editing / real-time sync
- Import/export of playlists
- Automatic sync with `previous_post_id` field on blog_posts
- Mobile-first design (CMS is desktop-first). Pointer Events provide basic touch support out of the box: tap = click, single-finger drag = node move/pan. Multi-touch gestures (pinch-to-zoom) are NOT implemented in v1 — would require `gesturechange` event handler or touch-action CSS tuning. Documented as v2 enhancement.
- Playlist analytics / play counts
- Pinch-to-zoom (v2 enhancement — requires multi-touch gesture handler)

---

## 16. Testing Strategy

| Layer | What | How |
|-------|------|-----|
| **Unit** | `graph-reducer.ts`, cycle detection, coordinate conversion, edge path calculation | Vitest, pure functions |
| **Integration (DB)** | CRUD operations, RLS policies, cascade behavior, SET NULL behavior, cycle trigger | Vitest, gated on `HAS_LOCAL_DB` |
| **Component** | Node rendering (3 types), edge type visuals, sidebar search/filter | Vitest + React Testing Library |
| **Canvas hooks** | `useCanvas`, `useDragNode` return correct state after simulated events | Vitest, unit test hooks |
| **Manual** | See manual test checklist below | Browser dev server |

### 16.1 Manual Test Checklist (PR-D/PR-E)

1. **Canvas basics:** Pan (middle-click drag), zoom (scroll wheel toward cursor), zoom limits (0.25x–2.0x)
2. **Node drag:** Drag single node, verify position persists after save. Drag multi-selected nodes as group.
3. **Sidebar drag:** Drag content from sidebar to canvas, verify phantom node follows cursor, item created at drop position.
4. **Edge creation:** Drag from handle to handle, select edge type, verify edge renders with correct style.
5. **Edge deletion:** Click edge (fat hit area), verify selection glow, press Delete.
6. **Ghost nodes:** Delete a blog post from `/cms/blog`, return to playlist, verify ghost node with "Content removed".
7. **Cycle prevention:** Create A→B→C sequence edges, attempt C→A, verify toast error.
8. **Auto-layout:** Click Auto-layout, verify nodes reposition with animation, verify undo restores original positions.
9. **Save indicator:** Move a node, verify "Saving..." → "Saved" transition. Kill network (DevTools offline), verify "Error" state.
10. **Viewport persist:** Zoom/pan, navigate away, return, verify same viewport position.
11. **Empty state:** Create new playlist, verify empty state message and sidebar hint.
12. **Keyboard:** Tab between nodes, arrow-key move, ⌘Z undo, Delete remove.

### 16.2 Concurrency Model

Single-user CMS — no real-time sync. If two tabs edit the same playlist, **last write wins**. The debounced auto-save means the most recent tab's changes overwrite. This is acceptable for a personal CMS; collaborative editing is a documented non-goal.

---

## 17. Sprint Timeline

| PR | Scope | Estimate | Dependencies |
|----|-------|----------|-------------|
| **PR-A** | Schema: 3 tables + RLS nested + cycle trigger + indexes + types + queries + DB tests | ~6h | — |
| **PR-B** | Canvas engine: pan/zoom/drag/edges/selection/undo/a11y + unit tests on hooks | ~16h | PR-A (types) |
| **PR-C** | CMS integration: hub page + sidebar entry + CRUD + delete confirmation + tests | ~10h | PR-A (schema) |
| **PR-D** | Graph editor: nodes + edges + sidebar drag + save strategy + auto-layout + ghost nodes + skeletons | ~14h | PR-B + PR-C |
| **PR-E** | Polish: mini-map + keyboard shortcuts + edge labels + settings panel + viewport persist + a11y list view + tests | ~8h | PR-D |
| **POST** | Update `docs/cowork-pipeline-reference.md` with Playlists section | ~2h | All PRs + tests pass |

**Total:** ~56h

**Risk:** PR-B (canvas engine) is highest risk — custom canvas has unpredictable edge cases. The 5h buffer is allocated here.

**Sub-sprint split:** If needed, deliver 5i-a (PR-A + PR-B = 22h, standalone canvas engine) separately from 5i-b (PR-C + PR-D + PR-E + POST = 34h, full CMS integration).
