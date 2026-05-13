# Pipeline Reference Reorganization — Design Spec

**Date:** 2026-05-13
**Status:** Approved
**Scope:** CMS pipeline reference sidebar grouping, detail metadata, API extensions, orphan cleanup

---

## Context

The CMS Pipeline > Reference section currently shows ~47 reference documents in a flat list. References are context entries consumed by AI skills (Ideator, Writer, Producer, Product Eval, Performance Review) via the Pipeline API. **99% of updates happen via API (Cowork)**, not the CMS UI — the CMS serves primarily as a viewer/dashboard for reviewing reference state.

**Current state:**
- `reference_content` table: `id, site_id, key, title, content_md, content_compact, version, created_at, updated_at`
- Flat sidebar list in `reference-editor.tsx` (w-48, alphabetical by key)
- No grouping, no search, no metadata display
- API GET/PUT/DELETE at `/api/pipeline/context/[key]`

**Goals:**
1. Add `ref_group` and `sort_order` DB columns
2. Grouped collapsible sidebar with 6 color-coded groups
3. Detail view with group badge, API key, "used by" metadata
4. Search/filter across all references
5. API extensions to accept/return group and sort_order
6. Audit and clean up orphan context entries from archived skills

---

## Data Model Changes

### New columns on `reference_content`

```sql
ALTER TABLE public.reference_content
  ADD COLUMN IF NOT EXISTS ref_group text NOT NULL DEFAULT 'pessoal'
    CHECK (ref_group IN ('pessoal','estrategia','craft','producao','api','memoria')),
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
```

Column name is `ref_group` (not `group`) to avoid SQL reserved word conflicts.

### Group definitions (application-level constant)

```typescript
const REFERENCE_GROUPS = [
  { id: 'pessoal',    label: 'Pessoal',    color: '#34d399' },
  { id: 'estrategia', label: 'Estratégia', color: '#a78bfa' },
  { id: 'craft',      label: 'Craft',      color: '#fbbf24' },
  { id: 'producao',   label: 'Produção',   color: '#22d3ee' },
  { id: 'api',        label: 'API',        color: '#fb7185' },
  { id: 'memoria',    label: 'Memória',    color: '#38bdf8' },
] as const
```

### Backfill migration

Same migration file assigns `ref_group` and `sort_order` to all 29 active keys + 2 shared based on the mapping table in the user's spec. Keys not in the mapping keep defaults (`pessoal`, 0).

---

## API Changes

### GET `/api/pipeline/context`

Response adds `ref_group` and `sort_order` to each entry:

```json
{
  "data": [
    {
      "key": "personal-profile",
      "title": "Personal Profile",
      "content": "...",
      "ref_group": "pessoal",
      "sort_order": 10,
      "version": 3,
      "updated_at": "2026-05-13T..."
    }
  ]
}
```

Ordering changes from `ORDER BY key` to `ORDER BY ref_group, sort_order, key`.

### GET `/api/pipeline/context/[key]`

Response includes `ref_group` and `sort_order`.

### PUT `/api/pipeline/context/[key]`

Schema extends `ReferenceContentUpsertSchema` to accept optional group and sort_order:

```typescript
export const ReferenceContentUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  content_md: z.string().max(200_000).optional(),
  content_compact: z.record(z.unknown()).optional(),
  ref_group: z.enum(['pessoal','estrategia','craft','producao','api','memoria']).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
})
```

When `ref_group` or `sort_order` are omitted in PUT, existing values are preserved (not overwritten with defaults). This is critical since Cowork may PUT content without knowing about groups.

### Server action `upsertReference`

Also updated to accept `ref_group` and `sort_order` for CMS-originated saves.

---

## CMS Sidebar — Grouped Accordion

### Layout

- Sidebar width: 264px (was 192px)
- Full height split: sidebar left, detail right
- Sidebar sections: header → search → scrollable groups → footer

### Header

- Title "References" + total doc count
- Collapse-all / Expand-all buttons (⊟/⊞)

### Search (Cmd+K)

- Input with magnifying glass icon
- When typing: sidebar switches from grouped view to flat filtered results
- Each result shows: title with match highlight, group color bar, group name + API key as subtitle
- Keyboard hints: ↑↓ navigate, Enter select, Esc clear
- Result count shown ("3 results")
- Empty state: "No references match" with red-tinted search border

### Group rendering

Each group is a collapsible section with:
- **Chevron** (▶/▼) — rotates 90° on expand with CSS transition
- **Color bar** — 3px × 12px rounded pill in group color
- **Label** — group name, 11px semibold
- **Badge** — doc count in group-colored pill

Inside expanded group:
- Docs listed by `sort_order`, then by `key`
- Doc titles use the `title` column as-is (no automated prefix stripping). The display name in the group assignment table above reflects what should be stored in `title`. Titles like "Writer: Voice Guide" are fine — the colon provides context about which skill owns it.
- Selected doc: indigo bg tint + 2px left border in indigo
- Recently edited (< 24h): small green dot after title
- Hover: subtle background tint

### Collapse behavior

- On first load: only the group containing the selected doc is expanded, rest collapsed
- State persisted in localStorage per user
- Clicking a group header toggles collapse
- Search auto-expands the group when selecting a result
- CSS transition: `max-height` with `ease` timing, ~250ms

### Footer

- "+ New Reference" button with dashed border
- Opens modal with: API key input, title input, group selector (6-option grid), Create/Cancel buttons

---

## Detail View — Metadata Display

### Header section

Row 1: Group badge (colored, with color bar) + "Updated Xh ago" + action buttons (copy API key, view raw JSON)

Row 2: Title input (editable, large font)

Row 3: Metadata chips separated by a subtle top border:
- **API Key** — monospace code block with the context key
- **Used by** — colored pills matching skill groups (e.g., "Ideator" in violet, "Writer" in amber)

### Editor

- Markdown textarea with monospace font
- Syntax color hints for headers (#)

### Save bar

Footer with: version + char count + "Markdown" label | Cmd+S hint + Save button

Save button states:
- **Idle**: indigo gradient, "Save"
- **Saving**: dimmed indigo, spinner + "Saving..."
- **Saved**: green gradient, "✓ Saved" — returns to idle after 2s

### "Used by" data source

Static mapping defined in application code (not DB). Maps each API key to which skills consume it:

```typescript
const REFERENCE_USAGE: Record<string, string[]> = {
  'personal-profile': ['Ideator', 'Writer', 'Producer', 'Product Eval', 'Perf Review'],
  'writer-voice-guide': ['Writer'],
  'ideator-memory': ['Ideator'],
  // ...
}
```

This avoids a DB join and reflects the actual SKILL.md configurations.

---

## Empty and Edge States

### Empty group
- Dashed border container: "No references in this group" + "+ Add one" link

### No search results
- Red-tinted search border
- Center message: "No references match" + "Try a different keyword or clear the filter"

### Group with zero docs after orphan cleanup
- Group still renders (with badge showing 0) so user knows the category exists

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+K | Focus search input |
| ↑/↓ | Navigate docs in sidebar (within search results or expanded groups) |
| Enter | Select highlighted doc |
| Esc | Clear search / blur search |
| Cmd+S | Save current doc |
| ←/→ | Collapse/expand current group (when focus is on group header) |

---

## Orphan Cleanup (Phase 2 — Audit)

### Process

1. Fetch all context entries via `GET /api/pipeline/context`
2. Compare against list of 29 active keys + 2 shared
3. Present orphan candidates to user for confirmation
4. Delete confirmed orphans via `DELETE /api/pipeline/context/[key]`

### Known active keys (31 total)

**Shared (2):** `personal-profile`, `featured-convention`
**Ideator (7):** `ideator-memory`, `ideator-generation-techniques`, `ideator-channel-profiles`, `ideator-content-angles`, `ideator-formats-frameworks`, `ideator-scoring-rubrics`, `ideator-monetization-research`
**Writer (5):** `writer-memory`, `writer-voice-guide`, `writer-article-craft`, `writer-newsletter-craft`, `writer-social-craft`
**Producer (6):** `producer-memory`, `producer-editing-patterns`, `producer-sound-design`, `producer-visual-style`, `producer-seo-metadata`, `producer-launch-strategy`
**Product Eval (5):** `product-eval-scoring`, `product-eval-memory`, `product-eval-catalog`, `product-eval-experience`, `product-eval-reference`
**Perf Review (4):** `perf-review-benchmarks`, `perf-review-memory`, `perf-review-feedback-templates`, `perf-review-analytics-guide`

### New entry to create

`content-calendar-taxonomy` in group `pessoal` (sort_order 20) — empty content, to be populated later.

### Merge evaluation

Check if `product-eval-experience` and `product-eval-reference` have complementary content. If so, merge into one. Decision deferred to implementation phase after reading actual content.

---

## Group Assignment Table

| API Key | Group | Sort |
|---------|-------|------|
| `personal-profile` | pessoal | 10 |
| `content-calendar-taxonomy` | pessoal | 20 |
| `featured-convention` | pessoal | 30 |
| `ideator-channel-profiles` | estrategia | 10 |
| `ideator-content-angles` | estrategia | 20 |
| `ideator-formats-frameworks` | estrategia | 30 |
| `ideator-generation-techniques` | estrategia | 40 |
| `ideator-monetization-research` | estrategia | 50 |
| `ideator-scoring-rubrics` | estrategia | 60 |
| `writer-voice-guide` | craft | 10 |
| `writer-article-craft` | craft | 20 |
| `writer-newsletter-craft` | craft | 30 |
| `writer-social-craft` | craft | 40 |
| `producer-editing-patterns` | craft | 50 |
| `producer-sound-design` | craft | 60 |
| `producer-visual-style` | craft | 70 |
| `product-eval-scoring` | craft | 80 |
| `producer-seo-metadata` | producao | 10 |
| `producer-launch-strategy` | producao | 20 |
| `perf-review-benchmarks` | producao | 30 |
| `perf-review-feedback-templates` | producao | 40 |
| `perf-review-analytics-guide` | producao | 50 |
| `product-eval-catalog` | api | 10 |
| `product-eval-experience` | api | 20 |
| `product-eval-reference` | api | 30 |
| `ideator-memory` | memoria | 10 |
| `writer-memory` | memoria | 20 |
| `producer-memory` | memoria | 30 |
| `product-eval-memory` | memoria | 40 |
| `perf-review-memory` | memoria | 50 |

---

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/2026MMDD_reference_groups.sql` | Add `ref_group`, `sort_order` columns + backfill |
| `apps/web/src/lib/pipeline/schemas.ts` | Extend `ReferenceContentUpsertSchema` with optional `ref_group`, `sort_order` |
| `apps/web/src/lib/pipeline/reference-groups.ts` | **New** — group definitions, colors, usage mapping, display name helpers |
| `apps/web/src/app/api/pipeline/context/route.ts` | Return `ref_group`, `sort_order` in GET; change order |
| `apps/web/src/app/api/pipeline/context/[key]/route.ts` | Accept `ref_group`, `sort_order` in PUT; return in GET |
| `apps/web/src/app/cms/(authed)/pipeline/actions.ts` | Extend `upsertReference` to accept `ref_group`, `sort_order` |
| `apps/web/src/app/cms/(authed)/pipeline/_components/reference-editor.tsx` | Full rewrite: grouped sidebar, search, detail metadata, keyboard shortcuts, save states |
| `apps/web/src/app/cms/(authed)/pipeline/reference/page.tsx` | Query includes `ref_group`, `sort_order`; pass to editor |
| Tests | Update existing reference tests + add group/search/edge case tests |

---

## Verification Checklist

- [ ] Sidebar renders 6 collapsible groups with correct counts
- [ ] Each doc shows group badge, API key, "used by" in detail view
- [ ] All 31 active keys assigned to correct groups
- [ ] No orphan keys remain (or marked for review)
- [ ] `content-calendar-taxonomy` exists as empty entry
- [ ] API GET returns `ref_group` and `sort_order`
- [ ] API PUT preserves existing `ref_group`/`sort_order` when omitted
- [ ] Search filters across all docs with match highlighting
- [ ] Cmd+S saves, Cmd+K focuses search
- [ ] Collapse state persists in localStorage
- [ ] Sort order works within each group
- [ ] CMS loads without errors
- [ ] All existing tests pass
