# Newsletter Type CRUD — Drawer Redesign

**Sprint:** 5e follow-up
**Date:** 2026-05-02
**Status:** Draft
**Quality target:** 98+/100

---

## 1. Problem Statement

The current newsletter type create/edit flow uses a small modal (`_components/type-modal.tsx`) with only 4 fields: name, tagline, color, locale. The public landing page at `/newsletters/[slug]` consumes many more fields (badge, description, promise list, color_dark, og_image_url) that are currently hardcoded in SQL seed migrations. Content editors have no way to manage these fields through the CMS UI, forcing developer intervention for every copy change.

## 2. Goal

Replace the small modal with a **right-side drawer (side panel)** that exposes ALL newsletter type fields organized in logical sections, supports both create and edit modes, and includes a safe delete flow with dependency awareness.

## 3. Non-Goals

- Editing cadence/schedule fields (managed in the Schedule tab)
- Inline MDX editing for landing page content beyond the promise list
- Drag-and-drop reordering of newsletter types (sort_order is managed elsewhere)
- Image upload for `og_image_url` (URL-only input; upload comes in a future sprint)

---

## 4. Design

### 4.1 Drawer Anatomy

```
+------------------------------------------+-----------------------------+
|                                          |                             |
|           Hub Content (dimmed)           |      Type Drawer (~480px)   |
|                                          |                             |
|           Backdrop overlay               |  [X] Close button           |
|           click-to-dismiss               |                             |
|                                          |  <h2> Create / Edit Type    |
|                                          |                             |
|                                          |  --- Essentials ----------  |
|                                          |  Name*                      |
|                                          |  Tagline                    |
|                                          |  Locale*                    |
|                                          |  Slug* (auto + preview)     |
|                                          |                             |
|                                          |  --- Landing Page Content - |
|                                          |  Badge                      |
|                                          |  Description (textarea)     |
|                                          |  Promise list [+] [-]       |
|                                          |                             |
|                                          |  --- Appearance ----------  |
|                                          |  Color* (picker + presets)  |
|                                          |  Color Dark (picker)        |
|                                          |  OG Image URL               |
|                                          |                             |
|                                          |  --- Schedule (read-only) - |
|                                          |  Cadence label (derived)    |
|                                          |  Paused status badge        |
|                                          |  "Edit in Schedule tab →"   |
|                                          |                             |
|                                          |  [Save / Create]            |
|                                          |                             |
|                                          |  --- Danger Zone ---------- |
|                                          |  [Delete Newsletter Type]   |
+------------------------------------------+-----------------------------+
```

- **Width:** `w-[480px]` (fixed), full viewport height
- **Animation:** slide-in from right (`translate-x-full` → `translate-x-0`), 200ms ease-out
- **Backdrop:** semi-transparent overlay (`bg-black/40`), click-to-dismiss
- **Scroll:** drawer body scrolls independently; header and footer actions remain fixed

### 4.2 Fields Specification

#### Section 1: Essentials

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `name` | `<input type="text">` | Yes | 1-100 chars, non-empty after trim | Label: "Name" |
| `tagline` | `<input type="text">` | No | max 200 chars | Label: "Tagline". Placeholder: "A short italic subtitle" |
| `locale` | `<select>` | Yes | `'en' \| 'pt-BR'` | Label: "Language". Default: `'pt-BR'` |
| `slug` | `<input type="text">` | Yes | `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, 3-80 chars, not reserved | Auto-generated from `name` on create. Editable. Shows preview: `bythiagofigueiredo.com/newsletters/{slug}` below the input. On edit mode: shows warning "Changing the slug will break existing links" |

**Slug auto-generation behavior:**
- On create mode only
- Triggers on `name` blur if slug has not been manually edited
- Uses `generateSlug(name)` logic (NFD normalize, lowercase, replace non-alnum with hyphens, trim, max 80)
- Uniqueness check is deferred to server action submission (server calls `ensureUniqueSlug()`)

**Reserved slugs** (DB constraint `newsletter_types_slug_reserved`):
`archive`, `subscribe`, `new`, `settings`, `edit`, `confirm`, `api`, `admin`, `hub`, `rss`, `feed`

#### Section 2: Landing Page Content

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `badge` | `<input type="text">` | No | max 30 chars | Label: "Badge". Placeholder: e.g. "MAIN", "NEW". Hint: "Shown as a tag above the title on the landing page" |
| `description` | `<textarea>` | No | max 1000 chars | Label: "Description". 4 rows default. Placeholder: "Describe what subscribers will receive" |
| `landing_content.promise` | Dynamic string array | No | Each item: 1-200 chars, max 10 items | Label: "What you get". Each item is a text input with remove/reorder buttons. |

**Promise list interaction:**
```
What you get
┌──────────────────────────────────────────────┐
│ Weekly deep dives on tech              [↑][↓][✕] │
│ Curated links and resources            [↑][↓][✕] │
│ Early access to projects               [↑][↓][✕] │
└──────────────────────────────────────────────┘
[+ Add item]
```
- `[↑]` and `[↓]` swap adjacent items
- `[✕]` removes the item (no confirmation needed)
- `[+ Add item]` appends an empty input, auto-focuses it
- Maximum 10 items; "Add item" button disabled at limit
- Empty items are stripped on submit

#### Section 3: Appearance

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `color` | Color picker | Yes | Valid hex `#RRGGBB` | Label: "Accent Color (Light)". Preset swatches + custom hex input. |
| `color_dark` | Color picker | No | Valid hex `#RRGGBB` or null | Label: "Accent Color (Dark)". Hint: "Falls back to light color if empty". Clear button to reset to null. |
| `og_image_url` | `<input type="url">` | No | Must match `^https://` if provided (DB constraint `newsletter_types_og_image_url_https`) | Label: "OG Image URL". Placeholder: `https://...` |

**Color picker:**
- 8 preset swatches reusing existing palette
- Hex input field below swatches
- Active swatch gets a ring/checkmark

#### Section 4: Schedule (Read-Only, edit mode only)

| Display | Source |
|---------|--------|
| Cadence label | Derived from `cadence_days` + `cadence_start_date` via `deriveCadenceLabel()` |
| Paused status | `cadence_paused` boolean → green "Active" or amber "Paused" badge |
| Link | "Edit in Schedule tab →" switches to Schedule tab |

- **Create mode:** This section is hidden
- **Edit mode:** Shown with current values

### 4.3 Drawer Modes

#### Create Mode (`mode="create"`)

- Header: "New Newsletter Type"
- Slug auto-generates from name
- Schedule section hidden
- Danger zone hidden
- Submit button: "Create"
- On success: close drawer, toast, `router.refresh()`

#### Edit Mode (`mode="edit"`)

- Header: "Edit {name}"
- All fields pre-populated
- Schedule section visible (read-only)
- Danger zone visible at bottom
- Submit button: "Save Changes"
- On success: close drawer, toast, `router.refresh()`

### 4.4 Delete Flow

Located at bottom of drawer in edit mode, visually separated.

```
[Delete Newsletter Type] clicked
        │
        ▼
   Call deleteNewsletterType(id) — probe mode
        │
        ├── ok: true (0 deps) ──► deleted, close drawer, toast
        │
        ├── subscriberCount/editionCount present ──►
        │   ├── Both = 0 ──► window.confirm("Delete {name}?")
        │   │                   Yes ──► deleteNewsletterType(id, {confirmed: true})
        │   │
        │   └── Either > 0 ──► window.prompt("Type name to confirm")
        │                       Input matches ──► deleteNewsletterType(id, {confirmed: true, confirmText: name})
        │                       Mismatch ──► toast.error("Name doesn't match")
        │
        └── error ──► toast.error(message)
```

Uses existing `deleteNewsletterType` server action probe/confirm pattern (already implemented in the audit).

### 4.5 State Management

No form library. React `useState` for under 10 fields + 1 dynamic array.

```typescript
interface TypeDrawerState {
  name: string
  tagline: string
  locale: 'en' | 'pt-BR'
  slug: string
  slugManuallyEdited: boolean
  badge: string
  description: string
  promise: string[]
  color: string
  colorDark: string
  ogImageUrl: string
}
```

- `useTransition` for submit/delete actions (pending state on buttons)
- `useId()` for accessible label linking
- Validation on submit, not per-keystroke
- Error state: `Record<string, string>` keyed by field name

### 4.6 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Dialog role | `role="dialog"` + `aria-modal="true"` |
| Label | `aria-labelledby={titleId}` via `useId()` |
| Focus trap | Reuse pattern from `type-modal.tsx`: Tab cycles within drawer |
| Escape | Closes drawer |
| Backdrop click | Closes drawer |
| Section headings | `<h3>` per section for screen reader navigation |
| Color picker | `aria-label="Select color {hex}"` + `aria-pressed` |
| Promise list | `aria-label="Promise item {n}"` on inputs |
| Pending state | `aria-busy="true"` + disabled during transition |
| Required fields | `aria-required="true"` on name, locale, slug, color |
| Error messages | `aria-describedby` linking input to error element |

---

## 5. Server Actions

### Existing Actions (already in `actions.ts`, fully updated in audit)

- **`createNewsletterType(data)`** — All fields supported: name, tagline, locale, color, slug (auto-generated or override), badge, description, colorDark, ogImageUrl, landingPromise[]. Calls `generateSlug()` + `ensureUniqueSlug()`.
- **`updateNewsletterType(id, data)`** — All fields supported including slug change. Invalidates both old and new slug paths via `revalidateNewsletterTypeSeo(siteId, slug)`.
- **`deleteNewsletterType(id, opts?)`** — Probe/confirm pattern. Without `confirmed: true` returns dependency counts. With confirmed deletes and invalidates.

### No modifications needed

The audit already brought all three actions to 100% field coverage.

---

## 6. Files

### Create

| File | Purpose |
|------|---------|
| `_components/type-drawer.tsx` | Main drawer component (~350-400 lines). Single self-contained file. |

### Modify

| File | Change |
|------|--------|
| `_components/type-cards.tsx` | Replace `TypeModal` imports/usage with `TypeDrawer`. Wire "New" button and card edit to drawer. |
| `_i18n/en.ts` | Add `typeDrawer` key block |
| `_i18n/pt-BR.ts` | Add `typeDrawer` key block |
| `_i18n/types.ts` | Add `typeDrawer` shape to `NewsletterStrings` interface |

### Delete

| File | Reason |
|------|--------|
| `_components/type-modal.tsx` | Fully replaced by `type-drawer.tsx` |

---

## 7. Animation

CSS transitions via Tailwind classes + data attributes. No animation library.

```
Backdrop: opacity 0 → 1, 200ms ease-out
Panel: translate-x-full → translate-x-0, 200ms ease-out
```

Use `onTransitionEnd` to unmount content after close animation.

---

## 8. Edge Cases

| Case | Handling |
|------|----------|
| Duplicate slug | Server returns error; drawer shows inline error on slug field |
| Empty promise items | Stripped on submit (`filter(s => s.trim())`) |
| Network error | Catch in `startTransition`, toast error, keep drawer open |
| Concurrent edit | Last write wins (acceptable for single-admin CMS) |
| Color paste | Accept `#RRGGBB` or `RRGGBB` (normalize) |
| Mobile (< 640px) | Drawer takes full width (`w-full sm:w-[480px]`) |
| Tab switch while open | Close drawer when user navigates to different hub tab |

---

## 9. Testing

### Unit Tests (Vitest + RTL)

File: `apps/web/test/cms/newsletter-type-drawer.test.tsx`

| # | Test |
|---|------|
| 1 | Renders in create mode with empty fields |
| 2 | Renders in edit mode with pre-populated fields |
| 3 | Slug auto-generates from name on blur |
| 4 | Slug manual override stops auto-generation |
| 5 | Promise list: add item |
| 6 | Promise list: remove item |
| 7 | Promise list: reorder up/down |
| 8 | Promise list: max 10 items disables add |
| 9 | Delete: simple confirm for 0 deps |
| 10 | Delete: name prompt for deps |
| 11 | Close on Escape |
| 12 | Close on backdrop click |
| 13 | Validation: required name |
| 14 | Validation: slug format |
| 15 | Validation: og_image_url https |
| 16 | Schedule section hidden in create |
| 17 | Submit loading state |
| 18 | Color picker preset selection |

---

## 10. Constraints

1. **No form library.** useState + useTransition is sufficient.
2. **No animation library.** CSS transitions only.
3. **No new DB migrations.** All columns already exist.
4. **No new server actions.** Create/update/delete already fully support all fields.
5. **No new packages.** Native `<input type="color">` + preset swatches.
6. **Fixed 480px width.** Full-width on mobile.
7. **`cadence_label` is derived, not stored.** Read from `cadence_days` + `cadence_start_date` via `deriveCadenceLabel()`.
