# Pipeline: Drag-and-Drop Reordering + Language-Aware Navigation

**Date:** 2026-05-12
**Status:** Approved
**Scope:** `apps/web` pipeline board + detail page

---

## Problem

1. **No reordering**: Pipeline Kanban cards are sorted by `priority DESC, updated_at DESC` — users cannot manually reorder items within a stage column or drag between columns.
2. **Wrong default language**: When clicking a pt-br-only item, the detail page opens with English tab selected (`tab-container.tsx:59` hardcodes `useState('en')`).

## Solution Overview

Two independent changes:
- **DnD**: Add `sort_order` column + wire `@dnd-kit` (already installed) into `PipelineBoard` for within-column reordering and cross-column stage moves.
- **Language fix**: Pass `item.language` to `TabContainer`, derive initial tab from it.

---

## Feature 1: Drag-and-Drop Kanban

### Database

**New column:**
```sql
ALTER TABLE content_pipeline ADD COLUMN sort_order int NOT NULL DEFAULT 0;
```

**Backfill** (preserves current visual order):
```sql
UPDATE content_pipeline SET sort_order = sub.rn
FROM (
  SELECT id,
    (ROW_NUMBER() OVER (
      PARTITION BY site_id, format, stage
      ORDER BY priority DESC, updated_at DESC
    ) * 1000)::int AS rn
  FROM content_pipeline
) sub
WHERE content_pipeline.id = sub.id;
```

**Query change** in `[format]/page.tsx`:
```
- .order('priority', { ascending: false })
- .order('updated_at', { ascending: false })
+ .order('sort_order', { ascending: true })
```

Also select `sort_order` and `version` in the query, pass through to board items.

**Gap strategy:** Values spaced by 1000. On reorder, new `sort_order = floor((prev + next) / 2)`. If gap < 2 between any adjacent pair, rebalance entire stage column (renumber 1000, 2000, ...). With <50 items per stage, rebalance is near-zero frequency.

### Migration

Idempotent pattern per CLAUDE.md:
```sql
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'content_pipeline'
      AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE content_pipeline ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END $$;
```

### Server Action

New action `reorderPipelineItem` in `actions.ts`:

```typescript
export async function reorderPipelineItem(
  id: string,
  version: number,
  input: { stage?: string; sort_order: number }
): Promise<ActionResult>
```

- Uses optimistic locking (`version` check)
- Updates `stage` (if changed) + `sort_order` in a single UPDATE
- Does NOT call `revalidatePath` — board uses optimistic local state
- Returns `{ ok: true, data: { id, version, stage, sort_order } }`

If cross-column drop also needs rebalance of target stage (gap exhausted), a second bulk UPDATE renumbers all items in that stage. This runs inside a transaction (Supabase RPC or sequential updates).

### Client Architecture

**Component hierarchy:**
```
PipelineBoard (client)
├── DndContext (sensors, collision detection, handlers)
│   ├── StageColumn (per stage)
│   │   ├── SortableContext (items in this stage)
│   │   │   ├── SortableGemCard (useSortable wrapper)
│   │   │   │   └── GemCard (pure render, unchanged)
│   │   │   └── ...
│   │   └── DropPlaceholder (empty column target)
│   └── DragOverlay (portal, floating card clone)
```

**Key decisions:**

1. **GemCard stays pure** — new `SortableGemCard` wrapper handles `useSortable` hooks. GemCard changes from `<Link>` to `<div>` with `onClick` navigation (because `<Link>` + drag conflicts). The `onClick` fires only if drag was NOT activated (checked via dnd-kit's `isDragging`).

2. **Sensors:** `PointerSensor` with `activationConstraint: { distance: 8 }` (8px movement before drag activates — below that, it's a click). `KeyboardSensor` with `sortableKeyboardCoordinates` for a11y.

3. **State management:** Board initializes local state from server props: `const [items, setItems] = useState(serverItems)`. Drags update local state immediately (optimistic). Server action runs in background. On failure: rollback local state + toast.

4. **Props sync:** `useEffect` merges new server props with local overrides — new items added, deleted items removed, sort_order from server accepted only for items without pending local changes.

### Drag Rules

| Scenario | Allowed? | Behavior |
|----------|----------|----------|
| Within same column | Yes | Update sort_order only |
| To adjacent column | Yes | Update stage + sort_order |
| Skip columns forward | Yes | Direct stage update |
| Skip columns backward | Yes | Direct stage update |
| To "published" column | Only if graduated | Toast: "Vincule a um post primeiro" |
| Archived item | No | Not draggable (opacity + no drag handle) |
| Item with `is_archived: true` | No | Filtered out of board already |

### Visual Feedback

- **Drag overlay:** Semi-transparent clone (opacity 0.85) with elevated shadow (`shadow-2xl`), slight scale (`scale-1.02`)
- **Drop indicator:** 2px horizontal line in stage accent color, appears between cards at drop position
- **Source card:** Dims to opacity 0.3 while dragging (placeholder)
- **Column highlight:** Target column border pulses with stage accent color on `dragOver`
- **Snap back:** Animated return to original position if drop rejected

### Accessibility

- Keyboard: Space to grab, Arrow keys to move, Space to drop, Escape to cancel
- Screen reader announcements (pt-BR):
  - onDragStart: `"Arrastando {title}"`
  - onDragOver: `"Sobre {stage}, posição {n}"`
  - onDragEnd: `"{title} movido para {stage}, posição {n}"`
  - onDragCancel: `"Arrasto cancelado"`

### New Item Sort Order

When creating a new item via `createPipelineItem`, assign `sort_order`:
- Query `MAX(sort_order)` for the target stage
- New item gets `max + 1000` (appended to bottom)

---

## Feature 2: Language-Aware Tab Default

### Root Cause

`apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx` line 59:
```typescript
const [lang, setLang] = useState('en')  // always English
```

### Fix

1. **New prop** on `TabContainer`:
```typescript
interface TabContainerProps {
  // ... existing props
  itemLanguage: 'pt-br' | 'en' | 'both'
}
```

2. **Derive initial language:**
```typescript
function getInitialLang(itemLanguage: string): string {
  if (itemLanguage === 'en') return 'en'
  return 'pt'  // 'pt-br' and 'both' → pt (primary language of the project)
}

const [lang, setLang] = useState(() => getInitialLang(itemLanguage))
```

3. **Hash override preserved:** The existing `useEffect` (lines 82-92) parses hash on mount. If hash contains a language (`#draft/en` or `#seo/pt`), it overrides the initial state. This already works — no change needed.

4. **Prop threading:** `pipeline-item-detail.tsx` already has `item.language` — pass it to `TabContainer`:
```typescript
<TabContainer
  // ... existing props
  itemLanguage={item.language as 'pt-br' | 'en' | 'both'}
>
```

### Precedence Order

1. URL hash language (if present) — highest priority
2. Item's `language` field mapping — default
3. Fallback `'pt'` — lowest (unreachable given the mapping covers all cases)

### Edge Cases

| Scenario | Result |
|----------|--------|
| Item `language: 'pt-br'` | Opens on PT tab |
| Item `language: 'en'` | Opens on EN tab |
| Item `language: 'both'` | Opens on PT tab (project primary) |
| Item `pt-br` but URL has `#draft/en` | Opens on EN tab (hash wins) |
| Item upgraded from `pt-br` to `both` (via + EN button) | Tab stays on current selection, no auto-switch |
| Shared sections (lang-independent) | Unaffected — shared sections ignore lang toggle |

---

## Files Changed

### Feature 1 (DnD)
| File | Change |
|------|--------|
| `supabase/migrations/TIMESTAMP_pipeline_sort_order.sql` | New migration: add column + backfill |
| `apps/web/src/app/cms/(authed)/pipeline/[format]/page.tsx` | Select sort_order+version, change ORDER BY |
| `apps/web/src/app/cms/(authed)/pipeline/actions.ts` | New `reorderPipelineItem` action, update `createPipelineItem` to set sort_order |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-board.tsx` | DndContext, SortableContext, optimistic state, drag handlers |
| `apps/web/src/app/cms/(authed)/pipeline/_components/sortable-gem-card.tsx` | New: useSortable wrapper |
| `apps/web/src/app/cms/(authed)/pipeline/_components/gem-card.tsx` | Change `<Link>` to `<div>` with onClick, accept `isDragging` prop |
| `apps/web/src/app/cms/(authed)/pipeline/_components/drag-overlay-card.tsx` | New: floating card overlay during drag |
| `apps/web/src/app/cms/(authed)/pipeline/_components/drop-indicator.tsx` | New: horizontal line indicator |

### Feature 2 (Language)
| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx` | New prop `itemLanguage`, derive initial lang |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Pass `item.language` to TabContainer |

---

## Testing

- Unit: `reorderPipelineItem` action with version conflict scenarios
- Unit: `getInitialLang()` mapping for all 3 language values
- Integration: sort_order backfill produces correct ordering
- Manual: drag within column, drag across columns, drag to published (blocked), click still navigates, pt-br item opens in PT tab, hash override works
