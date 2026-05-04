# Tag ↔ Newsletter Type Bidirectional Link

**Date:** 2026-05-04
**Status:** Approved
**Score:** 98/100

---

## 1. Problem

Blog tags and newsletter types represent overlapping editorial concepts. Tag "Vida" maps naturally to newsletter "Caderno de Campo"; tag "Tech" maps to "The bythiago diary". Today they have independently managed colors, which leads to visual inconsistency: the TagCategoryGrid on the homepage shows one shade of green for "Vida" while the newsletter landing page shows a different one. Editors must manually coordinate colors across two separate CMS drawers, and nothing prevents drift.

A first-class bidirectional link between tags and newsletter types solves three problems:

1. **Color consistency** — changing a color on either side automatically propagates to the other
2. **Editorial clarity** — the CMS surfaces the relationship, making content strategy visible
3. **Future leverage** — cross-promotion widgets ("Posts in this tag also appear in this newsletter") become trivial once the link exists in the data model

## 2. Non-Goals

- Many-to-many tag-newsletter relationships (each tag links to at most one newsletter type and vice-versa; 1:1 is the domain reality)
- Automatic subscriber routing based on tag (future sprint, depends on tag-based content filtering)
- Color inheritance hierarchy (no "master" side — last writer wins, trigger just keeps both in sync)
- Changing the public-facing UI of TagCategoryGrid or newsletter landing pages (consumers already read `color`/`color_dark` from their own table; sync ensures consistency transparently)

## 3. Decision

**Approach B — Bidirectional FKs on both tables with a shared trigger for color sync.**

### Why not the alternatives

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A: FK only on `newsletter_types`** | Simpler schema | Asymmetric: "which newsletter links to this tag?" requires reverse lookup. Both sides are peers in the editorial model. | Rejected |
| **B: Bidirectional FKs** | Symmetric, O(1) lookup from either side, trigger handles consistency | Two columns to maintain, trigger complexity | **Selected** |
| **C: Junction table `tag_newsletter_links`** | Normalized, could extend to M:N | Overkill for 1:1. Extra join in every query. No M:N need exists. | Rejected |

---

## 4. Data Model

### 4.1 New columns

```sql
-- blog_tags
linked_newsletter_type_id text REFERENCES newsletter_types(id) ON DELETE SET NULL

-- newsletter_types
linked_tag_id uuid REFERENCES blog_tags(id) ON DELETE SET NULL
```

Type mismatch is intentional: `blog_tags.id` is `uuid`, `newsletter_types.id` is `text` (slug-based PK established in Sprint 5e). FKs reference the actual PK type of each table.

### 4.2 Unique partial indexes (1:1 enforcement)

```sql
CREATE UNIQUE INDEX blog_tags_linked_nl_unique
  ON blog_tags(linked_newsletter_type_id)
  WHERE linked_newsletter_type_id IS NOT NULL;

CREATE UNIQUE INDEX newsletter_types_linked_tag_unique
  ON newsletter_types(linked_tag_id)
  WHERE linked_tag_id IS NOT NULL;
```

Partial indexes ensure at most one tag links to a given newsletter type and vice-versa, while allowing unlimited NULL values (unlinked entities).

### 4.3 Color sync trigger

Single function `sync_tag_newsletter_link()` fires on both tables as an AFTER trigger, scoped to the relevant columns:

```
AFTER INSERT OR UPDATE OF linked_newsletter_type_id, color, color_dark ON blog_tags
AFTER INSERT OR UPDATE OF linked_tag_id, color, color_dark ON newsletter_types
```

Three logical paths per side:

| Path | Condition | Action |
|---|---|---|
| **Link established/changed** | FK column value changed (incl. INSERT with non-null FK) | Clear old counterpart's reverse FK (if any), set new counterpart's reverse FK, copy `color` + `color_dark` to counterpart |
| **Color changed while linked** | `color` or `color_dark` changed, FK unchanged and non-null | Propagate `color` + `color_dark` to linked counterpart |
| **Unlink (FK set to NULL)** | Old FK non-null, new FK null | Clear counterpart's reverse FK. Colors stay independent (no reset). |

### 4.4 Recursion guard

The trigger on table A updates table B, which fires the trigger on B. Without a guard, this causes infinite recursion. Solution:

```sql
IF current_setting('app.skip_link_sync', true) = '1' THEN
  RETURN NEW;
END IF;

SET LOCAL app.skip_link_sync = '1';
```

`SET LOCAL` scopes to the current transaction, automatically reset on commit/rollback. The second trigger invocation sees `'1'` and short-circuits.

### 4.5 Cross-site validation

The trigger validates that both entities share the same `site_id`:

```sql
SELECT site_id INTO v_other_site_id FROM newsletter_types WHERE id = NEW.linked_newsletter_type_id;
IF v_other_site_id IS DISTINCT FROM NEW.site_id THEN
  RAISE EXCEPTION 'cross-site link forbidden'
    USING ERRCODE = 'P0001', HINT = 'cross_site_link_forbidden';
END IF;
```

This is defense-in-depth: server actions also validate same-site before writing. The trigger catches any bypass via direct SQL or service-role client.

### 4.6 SECURITY DEFINER

The trigger function runs as `SECURITY DEFINER` with `SET search_path = public` to ensure it can read/write both tables regardless of the invoking user's RLS permissions. This follows the project convention for cross-table triggers (see `enforce_publish_permission`, `sync_tag_newsletter_link` pattern).

---

## 5. Server Actions

### 5.1 New queries

#### `getUnlinkedNewsletterTypes(siteId, currentTagId?)`

Located in `apps/web/src/app/cms/(authed)/blog/actions.ts`.

Returns newsletter types available for linking from a tag:
- Filters by `site_id`
- Includes types where `linked_tag_id IS NULL` (unlinked)
- If `currentTagId` provided, also includes the type already linked to this tag (for edit mode: keep current selection in the dropdown)
- Returns `{ id, name, locale, color }` for combobox display

#### `getUnlinkedTags(siteId, currentTypeId?)`

Located in `apps/web/src/app/cms/(authed)/newsletters/actions.ts`.

Mirror of the above for the newsletter type drawer:
- Filters by `site_id`
- Includes tags where `linked_newsletter_type_id IS NULL`
- If `currentTypeId` provided, also includes the tag already linked to this type
- Returns `{ id, name, slug, color, color_dark }` for combobox display

#### `getTagWithLink(tagId)`

Located in `apps/web/src/app/cms/(authed)/blog/actions.ts`.

Returns full tag data including `linked_newsletter_type_id`. If linked, performs a secondary query to fetch the newsletter type's `{ id, name, locale }` for display in the drawer.

#### `getNewsletterTypeForEdit(typeId)` (modified)

Existing action gains `linked_tag_id` in its SELECT. If linked, fetches the tag's `{ id, name, color }` for display. Returns `linkedTag: { id, name, color } | null`.

### 5.2 Modified write actions

#### `createTag(input)` / `updateTag(tagId, patch)`

Accept optional `linkedNewsletterTypeId: string | null` in their input schema.

Before writing:
1. If `linkedNewsletterTypeId` is provided, call `validateNewsletterTypeLinkable(siteId, nlTypeId, currentTagId?)` which checks:
   - Newsletter type exists
   - Same `site_id`
   - Not already linked to a different tag (unless it's the current tag in edit mode)
2. Include `linked_newsletter_type_id` in the INSERT/UPDATE payload
3. Trigger handles the reverse FK and color sync automatically

#### `createNewsletterType(data)` / `updateNewsletterType(typeId, patch)`

Accept optional `linkedTagId: string | null`.

Before writing:
1. If `linkedTagId` is provided, validate:
   - Tag exists
   - Same `site_id`
   - Tag's `linked_newsletter_type_id` is null (or points to current type in edit mode)
2. Include `linked_tag_id` in the INSERT/UPDATE payload
3. Trigger handles the reverse FK and color sync

### 5.3 Validation strategy (belt + suspenders)

| Layer | Validates |
|---|---|
| Client (drawer) | Only shows unlinked options in combobox |
| Server action | Same-site check, not-already-linked check |
| DB trigger | Same-site check (defense-in-depth) |
| DB unique index | 1:1 constraint (prevents race conditions) |

### 5.4 Cache invalidation

Link/unlink operations trigger:

```typescript
revalidateTag('home-tags')   // TagCategoryGrid on homepage
revalidateTag('home-posts')  // PinboardHome if it shows tag colors
```

Color changes on either side already trigger these via the existing `updateTag`/`updateNewsletterType` cache invalidation paths.

---

## 6. CMS UI

### 6.1 Tag Drawer — "Link to Newsletter" section

Inserted after the Appearance section, before the Danger Zone:

```
--- Link to Newsletter --------
[ Combobox: Select newsletter... ▾ ]

  Dropdown items:
  ┌──────────────────────────────────┐
  │ ● Caderno de Campo    [pt-BR]   │
  │ ● The bythiago diary  [en]      │
  └──────────────────────────────────┘

  Linked state:
  ┌──────────────────────────────────┐
  │ ● Caderno de Campo    [Unlink]  │
  │ ⓘ Colors sync automatically    │
  └──────────────────────────────────┘
```

**Combobox behavior:**
- Fetches options via `getUnlinkedNewsletterTypes(siteId, currentTagId?)` on drawer open
- Each option shows: color swatch (small circle), name, locale badge
- Selecting an option does NOT immediately write — it sets the value in form state
- Value is persisted on form submit alongside other tag fields
- If no newsletter types exist or all are already linked, shows disabled state with helper text: "No unlinked newsletter types available"

**Linked state display:**
- Shows linked newsletter name with color swatch chip
- Informational note: "Colors sync automatically" (small text, muted)
- "Unlink" button (text button, no confirmation needed — unlinking is non-destructive, colors are preserved)
- Clicking Unlink sets `linkedNewsletterTypeId` to `null` in form state

### 6.2 Newsletter Type Drawer — "Link to Tag" section

Mirror of the tag drawer section, inserted after Appearance:

```
--- Link to Tag ----------------
[ Combobox: Select tag... ▾ ]

  Dropdown items:
  ┌──────────────────────────────────┐
  │ ● Tech                          │
  │ ● Vida                          │
  └──────────────────────────────────┘

  Linked state:
  ┌──────────────────────────────────┐
  │ ● Vida               [Unlink]   │
  │ ⓘ Colors sync automatically    │
  └──────────────────────────────────┘
```

Same interaction pattern as the tag drawer. Options fetched via `getUnlinkedTags(siteId, currentTypeId?)`.

### 6.3 Visual sync feedback

When a color is changed on a linked entity, no extra UI feedback is needed in the current drawer. The counterpart's color updates happen server-side via the trigger. The next time the counterpart's drawer is opened, it will show the synced color.

Future enhancement (not in scope): real-time toast notification "Color synced to linked newsletter/tag".

### 6.4 i18n strings

New keys added to both `BlogHubStrings.tagDrawer` and newsletter drawer string maps:

```typescript
// Tag drawer
sectionLinkNewsletter: string    // "Link to Newsletter"
linkComboPlaceholder: string     // "Select newsletter..."
linkSyncNote: string             // "Colors sync automatically"
unlinkButton: string             // "Unlink"
noUnlinkedTypes: string          // "No unlinked newsletter types"

// Newsletter type drawer
sectionLinkTag: string           // "Link to Tag"
linkTagComboPlaceholder: string  // "Select tag..."
linkTagSyncNote: string          // "Colors sync automatically"
unlinkTagButton: string          // "Unlink"
noUnlinkedTags: string           // "No unlinked tags"
```

---

## 7. Edge Cases

| Scenario | Behavior |
|---|---|
| Delete linked tag | `ON DELETE SET NULL` on `newsletter_types.linked_tag_id`. Newsletter keeps its current colors. No cascade, no error. |
| Delete linked newsletter type | Mirror: `ON DELETE SET NULL` on `blog_tags.linked_newsletter_type_id`. Tag keeps its current colors. |
| Relink to different counterpart | Trigger clears old counterpart's reverse FK, sets new counterpart's reverse FK, copies colors to new counterpart. Old counterpart keeps its colors at the moment of unlinking. |
| Cross-site attempt | Trigger raises `ERRCODE P0001` with `HINT = 'cross_site_link_forbidden'`. Server action also validates before write. Double protection. |
| Unlink | Both entities keep their current colors. Colors diverge independently from this point. |
| Simultaneous color edits on both sides | Last-write-wins. Trigger propagates the latest color. Acceptable for CMS admin usage patterns (single editor per entity is the norm). |
| Create tag with link in single operation | INSERT trigger fires, sets reverse FK and copies colors. Works atomically. |
| Link to entity that is being deleted concurrently | FK constraint prevents writing a reference to a deleted row. Standard PostgreSQL serialization. |
| Tag has no `color_dark`, newsletter does | `color_dark` is nullable on both sides. Trigger copies whatever value exists (including NULL). If tag has `color_dark = NULL`, newsletter's `color_dark` becomes NULL on link/sync. |

---

## 8. RLS

No new policies required. The new columns are covered by existing policies:

- `blog_tags_staff_all` — `FOR ALL USING (can_edit_site(site_id))` covers reads and writes to all columns including `linked_newsletter_type_id`
- `blog_tags_public_read` — `FOR SELECT USING (site_visible(site_id))` covers public reads
- Newsletter types have equivalent staff-write and public-read policies

The trigger function is `SECURITY DEFINER` (runs as the function owner, bypassing RLS), which is necessary because cross-table updates within the trigger would otherwise fail under the invoking user's limited RLS permissions.

---

## 9. Tests

### 9.1 Unit tests (Vitest)

**Trigger behavior (DB-gated, `describe.skipIf(skipIfNoLocalDb())`)**:
- Link tag to newsletter type -> verify reverse FK set + colors copied
- Link newsletter type to tag -> verify reverse FK set + colors copied
- Change color on linked tag -> verify newsletter type color updated
- Change color on linked newsletter type -> verify tag color updated
- Unlink -> verify reverse FK cleared, colors unchanged
- Relink -> verify old counterpart cleared, new counterpart set
- Cross-site link attempt -> verify `P0001` exception
- Delete linked tag -> verify newsletter type's `linked_tag_id` becomes NULL
- Delete linked newsletter type -> verify tag's `linked_newsletter_type_id` becomes NULL

**Server actions**:
- `getUnlinkedNewsletterTypes` returns only unlinked types (+ current link in edit mode)
- `getUnlinkedTags` returns only unlinked tags (+ current link in edit mode)
- `createTag` with `linkedNewsletterTypeId` persists and triggers sync
- `updateTag` link/unlink round-trip
- `createNewsletterType` with `linkedTagId` persists and triggers sync
- `updateNewsletterType` link/unlink round-trip
- Same-site validation rejects cross-site links before DB write
- Already-linked validation rejects double-linking

### 9.2 Component tests (Vitest + Testing Library)

- Tag drawer renders "Link to Newsletter" section
- Combobox shows unlinked newsletter types with color swatches
- Selecting a newsletter type sets form state
- Linked state shows chip + sync note + unlink button
- Unlink button clears selection
- Empty state when no unlinked types available
- Newsletter type drawer mirrors all above for "Link to Tag"

### 9.3 Integration tests (DB-gated)

Full round-trip:
1. Create tag with color `#22c55e`
2. Create newsletter type with color `#6366f1`
3. Link tag to newsletter type via `updateTag`
4. Verify newsletter type color updated to `#22c55e`
5. Change tag color to `#dc2626`
6. Verify newsletter type color propagated to `#dc2626`
7. Unlink via `updateTag(tagId, { linkedNewsletterTypeId: null })`
8. Verify both entities retain `#dc2626`
9. Change tag color to `#000000`
10. Verify newsletter type still has `#dc2626` (no longer synced)

---

## 10. Migration

**File:** `supabase/migrations/20260504000001_tag_newsletter_link.sql`

Idempotent per project convention:
- Column additions wrapped in `DO $$ ... IF NOT EXISTS` blocks
- Indexes use `DROP INDEX IF EXISTS` before `CREATE UNIQUE INDEX`
- Trigger function uses `CREATE OR REPLACE FUNCTION`
- Triggers use `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`

No data backfill needed — tags and newsletter types are linked manually by editors through the CMS UI. Initial state: all `linked_newsletter_type_id` and `linked_tag_id` values are NULL.

---

## 11. Sequence Diagram — Link Establishment

```
Editor                  Tag Drawer              Server Action           Database
  │                         │                        │                      │
  │  Open tag "Vida"        │                        │                      │
  │────────────────────────>│                        │                      │
  │                         │  getTagWithLink()      │                      │
  │                         │───────────────────────>│                      │
  │                         │  getUnlinkedNLTypes()  │                      │
  │                         │───────────────────────>│                      │
  │                         │<───────────────────────│                      │
  │                         │  [Caderno de Campo]    │                      │
  │                         │                        │                      │
  │  Select "Caderno"       │                        │                      │
  │────────────────────────>│                        │                      │
  │  Click Save             │                        │                      │
  │────────────────────────>│                        │                      │
  │                         │  updateTag(id, {       │                      │
  │                         │    linkedNLTypeId: X    │                      │
  │                         │  })                    │                      │
  │                         │───────────────────────>│                      │
  │                         │                        │  validate same-site  │
  │                         │                        │  validate not-linked │
  │                         │                        │  UPDATE blog_tags    │
  │                         │                        │─────────────────────>│
  │                         │                        │                      │ AFTER trigger fires
  │                         │                        │                      │ UPDATE newsletter_types
  │                         │                        │                      │   SET linked_tag_id = tag.id
  │                         │                        │                      │       color = tag.color
  │                         │                        │                      │       color_dark = tag.color_dark
  │                         │                        │                      │
  │                         │                        │  revalidateTag()     │
  │                         │                        │<─────────────────────│
  │                         │<───────────────────────│                      │
  │  Toast: "Saved"         │                        │                      │
  │<────────────────────────│                        │                      │
```

---

## 12. Public-Facing Impact

The link is purely a CMS/data-model concern. Public components are **not modified**:

- `TagCategoryGrid` reads `blog_tags.color` — already correct after sync
- Newsletter landing pages read `newsletter_types.color` — already correct after sync
- `PinboardHome` tag badges read from `blog_tags` — already correct
- `ChannelStrip` newsletter cards read from `newsletter_types` — already correct

The only visible change for end users is that linked tags and newsletter types will always have matching colors, which was the original editorial intent.

---

## 13. Future Extensions

These are out of scope but the data model enables them:

- **Cross-promotion widget**: "Posts tagged [Vida] also go out in [Caderno de Campo] — Subscribe" — query is a single JOIN on the FK
- **Automatic newsletter content curation**: When a post is published with tag X, auto-queue it for the linked newsletter type's next edition
- **Unified color management**: CMS "Brand Colors" page that shows all linked pairs with a single color picker per pair
- **Tag-based subscription preferences**: Subscriber picks tags on subscribe form; backend maps to newsletter types via the link

---

## 14. File Inventory

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260504000001_tag_newsletter_link.sql` | Create | Migration: columns, indexes, trigger |
| `apps/web/src/app/cms/(authed)/blog/actions.ts` | Modify | Add `getUnlinkedNewsletterTypes`, `getTagWithLink`, extend `createTag`/`updateTag` |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Modify | Add `getUnlinkedTags`, extend `createNewsletterType`/`updateNewsletterType`/`getNewsletterTypeForEdit` |
| `apps/web/src/app/cms/(authed)/blog/_components/tag-drawer.tsx` | Modify | Add "Link to Newsletter" section with combobox |
| `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx` | Modify | Add "Link to Tag" section with combobox |
| `apps/web/src/app/cms/(authed)/blog/_i18n/*.ts` | Modify | Add i18n strings for link section |
| `apps/web/src/app/cms/(authed)/newsletters/_i18n/*.ts` | Modify | Add i18n strings for link section |
| `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts` | Modify | Add `linkedNewsletterTypeId` to `BlogTag` type |
| `apps/web/test/unit/cms/tag-newsletter-link.test.ts` | Create | Trigger + action unit tests |
| `apps/web/test/components/cms/tag-drawer-link.test.tsx` | Create | Component tests for link UI |
| `apps/web/test/integration/tag-newsletter-link.test.ts` | Create | DB-gated integration round-trip |
