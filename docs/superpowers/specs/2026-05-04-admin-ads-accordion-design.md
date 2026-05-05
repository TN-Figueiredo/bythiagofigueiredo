# Admin Ads Accordion Redesign — Design Spec

**Date:** 2026-05-04  
**Status:** Draft  
**Visual Mockup:** `.superpowers/brainstorm/516-1777939250/content/accordion-v4.html`

---

## Problem

The `/admin/ads` Placeholders tab currently renders a flat vertical stack of cards via `PlaceholderManager` from `@tn-figueiredo/ad-engine-admin/client`. This has two issues:

1. **Missing slots** — The 5 new blog archive ad slots (`archive:*`) are not registered in `SITE_AD_SLOTS` or seeded in `ad_placeholders`, so they don't appear in admin.
2. **No area organization** — All slots are shown in a flat list with no visual grouping. As the system grows to cover Home, YouTube, etc., this becomes unmanageable.

## Solution

Replace the flat `PlaceholderManager` with a local accordion-based component that groups slots by area, registers all 10 slots (5 post + 5 archive), and shows format-accurate live previews.

---

## Architecture

### Slot Key Namespace

All slot keys follow `{area}:{position}:{format}`:

| Old Key | New Key | Component | Zone | IAB Size | Mobile |
|---------|---------|-----------|------|----------|--------|
| `banner_top` | `post:top:banner` | DoormanAd | banner | 728×90 | keep |
| `rail_left` | `post:rail:anchor-left` | MarginaliaAd | rail | 160×600 | hide |
| `rail_right` | `post:rail:anchor` | AnchorAd | rail | 300×250 | stack |
| `inline_mid` | `post:body:bookmark` | BookmarkAd (light) | inline | 300×250 | keep |
| `block_bottom` | `post:footer:coda` | CodaAd | block | 970×250 | keep |
| — (new) | `archive:top:doorman` | DoormanAd | banner | 728×90 | hide |
| — (new) | `archive:break:anchor` | HorizontalAnchor | inline | fluid | stack |
| — (new) | `archive:grid:bookmark` | BookmarkAd (dark) | inline | grid cell | keep |
| — (new) | `archive:footer:marginalia` | MarginaliaAd | block | max-w 720 | keep |
| — (new) | `archive:footer:bowtie` | BowtieAd | block | full width | keep |

### Area Sections

| Area | Route | Namespace | Slot Count |
|------|-------|-----------|------------|
| Blog Post | `/blog/[slug]` | `post:*` | 5 |
| Blog Archive | `/blog` | `archive:*` | 5 |
| Home | `/` | `home:*` | 0 (future) |
| YouTube | `/youtube` | `youtube:*` | 0 (future) |

---

## Database Changes

### Migration 1: Rename slot keys (`post:*` namespace)

Rename the 5 existing flat keys across all ad tables to the new `post:*` namespace. Idempotent — uses `WHERE slot_id = 'old_key'` / `WHERE slot_key = 'old_key'`.

**Tables affected:**
- `ad_placeholders` (PK = `slot_id`) — must drop + recreate rows since PK changes
- `ad_slot_creatives` (`slot_key` column)
- `ad_slot_metrics` (`slot_key` column in composite PK)
- `ad_events` (`slot_id` column)
- `kill_switches` (`id` column for per-slot switches)
- `ad_slot_config` (`slot_key` in composite PK)

**Key mapping:**
```sql
banner_top       → post:top:banner
rail_left        → post:rail:anchor-left
rail_right       → post:rail:anchor
inline_mid       → post:body:bookmark
block_bottom     → post:footer:coda
```

### Migration 2: Add `brand_color` and `logo_url` to `ad_placeholders`

The current `ad_placeholders` table lacks `brand_color` and `logo_url` columns. These are needed for component-accurate previews and rendering. Must run before Migration 3 (seed) since seeds reference these columns.

```sql
ALTER TABLE ad_placeholders
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS logo_url text;
```

### Migration 3: Seed archive slots

Insert 5 new rows into `ad_placeholders` with default house-ad content:

```sql
INSERT INTO ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, brand_color, app_id)
VALUES
  ('archive:top:doorman',        false, 'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:break:anchor',       true,  'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:grid:bookmark',      true,  'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:marginalia',  true,  'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:bowtie',      true,  'Anuncie aqui', 'Alcance nossos leitores.', 'Saiba mais', '/anuncie', '#FF8240', 'bythiagofigueiredo')
ON CONFLICT (slot_id) DO NOTHING;
```

Insert corresponding `ad_slot_config` rows:

```sql
-- Requires site_id from sites table
DO $$ DECLARE v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM sites WHERE slug = 'bythiagofigueiredo' LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;

  INSERT INTO ad_slot_config (site_id, slot_key, label, zone, iab_size, mobile_behavior, accepted_types, aspect_ratio)
  VALUES
    (v_site_id, 'archive:top:doorman',       'Banner — Topo Archive',  'banner', '728x90',    'hide',  '{house,cpa}', '8:1'),
    (v_site_id, 'archive:break:anchor',      'Âncora Horizontal',      'inline', null,        'stack', '{cpa}',       '16:3'),
    (v_site_id, 'archive:grid:bookmark',     'Card no Grid',           'inline', null,        'keep',  '{house,cpa}', '3:4'),
    (v_site_id, 'archive:footer:marginalia', 'Marginalia — Rodapé',    'block',  null,        'keep',  '{house,cpa}', '16:3'),
    (v_site_id, 'archive:footer:bowtie',     'Newsletter CTA',         'block',  null,        'keep',  '{house}',     '16:3')
  ON CONFLICT (site_id, slot_key) DO NOTHING;
END $$;
```

Insert per-slot kill switches:
```sql
INSERT INTO kill_switches (id, enabled, reason) VALUES
  ('ads_slot_archive_top_doorman', true, 'archive:top:doorman'),
  ('ads_slot_archive_break_anchor', true, 'archive:break:anchor'),
  ('ads_slot_archive_grid_bookmark', true, 'archive:grid:bookmark'),
  ('ads_slot_archive_footer_marginalia', true, 'archive:footer:marginalia'),
  ('ads_slot_archive_footer_bowtie', true, 'archive:footer:bowtie')
ON CONFLICT DO NOTHING;
```

---

## Shared Package Change

### `packages/shared/src/config/ad-slots.ts`

Expand `SITE_AD_SLOTS` from 5 to 10 entries. Add the 5 archive slots with their definitions:

```typescript
// Existing 5 slots: rename keys
{ key: 'post:top:banner',         label: 'Banner — Topo',      zone: 'banner', iabSize: '728x90',  ... },
{ key: 'post:rail:anchor-left',   label: 'Rail esquerdo',       zone: 'rail',   iabSize: '160x600', ... },
{ key: 'post:rail:anchor',        label: 'Rail direito',        zone: 'rail',   iabSize: '300x250', ... },
{ key: 'post:body:bookmark',      label: 'Inline — Meio',       zone: 'inline', iabSize: '300x250', ... },
{ key: 'post:footer:coda',        label: 'Block — Inferior',    zone: 'block',  iabSize: '970x250', ... },

// New 5 archive slots
{ key: 'archive:top:doorman',        label: 'Banner — Topo Archive',   zone: 'banner', iabSize: '728x90',    ... },
{ key: 'archive:break:anchor',       label: 'Âncora Horizontal',       zone: 'inline', iabSize: 'fluid',     ... },
{ key: 'archive:grid:bookmark',      label: 'Card no Grid',            zone: 'inline', iabSize: 'grid-cell', ... },
{ key: 'archive:footer:marginalia',  label: 'Marginalia — Rodapé',     zone: 'block',  iabSize: 'max-w-720', ... },
{ key: 'archive:footer:bowtie',      label: 'Newsletter CTA',          zone: 'block',  iabSize: 'full-width',... },
```

Add `area` field to `AdSlotDefinition`:

```typescript
export interface AdSlotDefinition {
  key: string
  area: 'post' | 'archive' | 'home' | 'youtube'  // NEW
  label: string
  desc: string
  badge: string
  badgeColor: string
  zone: 'banner' | 'rail' | 'inline' | 'block'
  mobileBehavior: 'keep' | 'hide' | 'stack'
  acceptedAdTypes: readonly ('house' | 'cpa')[]
  defaultLimits: { maxPerSession: number; maxPerDay: number; cooldownMs: number }
  aspectRatio: string
  iabSize: string
}
```

Add helper:

```typescript
export function getSlotsByArea(area: string): AdSlotDefinition[] {
  return SITE_AD_SLOTS.filter(s => s.area === area)
}

export const AD_AREAS = [
  { key: 'post',    label: 'Blog Post',    route: '/blog/[slug]' },
  { key: 'archive', label: 'Blog Archive', route: '/blog' },
  { key: 'home',    label: 'Home',         route: '/' },
  { key: 'youtube', label: 'YouTube',      route: '/youtube' },
] as const
```

---

## UI Component: `PlaceholderAccordion`

Replaces `PlaceholderManager` from `@tn-figueiredo/ad-engine-admin/client`.

**File:** `apps/web/src/app/admin/(authed)/ads/_components/placeholder-accordion.tsx`

### Structure

```
PlaceholderAccordion (client component)
├── AreaSection (one per area with slots)
│   ├── Accordion header: area name, slot count, namespace badge, route badge
│   └── SlotRow (one per slot in the area)
│       ├── Collapsed: slot key, zone badge, IAB badge, status, accepted types, mobile badge, timestamp
│       └── Expanded (on click):
│           ├── SlotForm (left column): format-specific fields
│           └── SlotPreview (right column): component-accurate preview
├── FutureAreaSection (areas with 0 slots)
│   └── Dashed border, "+ Adicionar slot" button (disabled, informational)
```

### Props

```typescript
interface PlaceholderAccordionProps {
  placeholders: AdPlaceholderRow[]
  slotConfigs: AdSlotConfigRow[]
  locale: 'pt-BR' | 'en'
}
```

### Data Flow

1. Server component fetches `ad_placeholders` + `ad_slot_config` for the site
2. Groups by area using `slot.key.split(':')[0]`
3. Passes grouped data to `PlaceholderAccordion`
4. On save, calls existing `updatePlaceholder` server action (already supports upsert)
5. `revalidatePath('/admin/ads')` + `revalidateTag('ads')` on save

### Form Fields per Format

| Format | Fields |
|--------|--------|
| **DoormanAd** (banner) | title, ctaText, ctaUrl, brandColor, dismissMs |
| **AnchorAd** (anchor) | title, body, ctaText, ctaUrl, logoUrl, brandColor |
| **BookmarkAd** (bookmark) | title, body, ctaText, ctaUrl, logoUrl, brandColor, dismissMs |
| **CodaAd** (coda) | title, body, ctaText, ctaUrl, logoUrl, brandColor, dismissMs |
| **HorizontalAnchor** (anchor) | title, body, ctaText, ctaUrl, logoUrl, brandColor |
| **MarginaliaAd** (marginalia) | title, body, ctaText, ctaUrl, brandColor, tagline |
| **BowtieAd** (bowtie) | title (Caveat), subtitle, buttonText, emailPlaceholder, buttonColor |

### Preview Components

Each slot's preview renders a scaled-down version of the real ad component using the same fonts, colors, and layout proportions. The preview panel shows:
- Label: "Preview — {ComponentName}"
- Device badge: "desktop" | "sidebar" | "full width" | "grid card" | etc.
- Scale indicator: "~80%" etc.
- Dark background (`#1E1A12`) matching the blog theme

Previews are pure CSS/HTML within the admin — they do NOT import the real blog ad components (which have hooks, localStorage, etc.). Instead, they replicate the visual structure statically.

### Accessibility

- Accordion headers: `role="button"`, `aria-expanded`, `tabindex="0"`, keyboard Enter/Space toggle
- Area sections: `role="region"`, `aria-label`
- Focus-visible outlines on all interactive elements
- Color swatches: `title` tooltip, `cursor: pointer`

---

## Code Changes Summary

### Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/app/admin/(authed)/ads/_components/placeholder-accordion.tsx` | Main accordion component |
| `apps/web/src/app/admin/(authed)/ads/_components/slot-form.tsx` | Per-format edit form |
| `apps/web/src/app/admin/(authed)/ads/_components/slot-preview.tsx` | Format-accurate preview renderers |
| `supabase/migrations/YYYYMMDD000001_rename_slot_keys_v2.sql` | Rename 5 keys to post:* namespace |
| `supabase/migrations/YYYYMMDD000002_placeholders_brand_columns.sql` | Add brand_color + logo_url columns |
| `supabase/migrations/YYYYMMDD000003_seed_archive_slots.sql` | Seed 5 archive:* placeholder + slot_config + kill_switch rows |

### Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/config/ad-slots.ts` | Add `area` field to interface, add 5 archive slots, rename 5 post keys, add `AD_AREAS` + `getSlotsByArea()` |
| `apps/web/src/app/admin/(authed)/ads/page.tsx` | Replace `PlaceholderManager` with `PlaceholderAccordion`, fetch `ad_slot_config` alongside placeholders |
| `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` | Update `updatePlaceholder` to handle `brand_color` + `logo_url` fields |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Update slot key references from flat to `post:*` namespace |
| `apps/web/src/app/(public)/blog/blog-ad-slots.tsx` | Update `data-slot-key` attributes to match new keys |
| `apps/web/src/app/(public)/blog/blog-archive-client.tsx` | Update slot key references |
| `apps/web/src/components/blog/ads/*.tsx` | Update slot key references in components |
| `apps/web/src/lib/ads/resolve.ts` | Update slot key map for creative resolution |

### Files NOT Changed

- `@tn-figueiredo/ad-engine-admin` package — we replace its `PlaceholderManager` with a local component instead of modifying the package. The package's other components (dashboard, campaigns, inquiries, media) continue to be used.

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Slot key rename breaks existing campaigns/metrics | Migration renames atomically across all tables in single transaction. Rollback via reverse rename migration. |
| Kill switch IDs break | Migration renames kill switch IDs in same transaction. |
| `ad_slot_config` composite PK (site_id, slot_key) breaks | Migration updates slot_key in-place with `WHERE` filter. |
| Archive slots have no creative resolution yet | Archive ads currently use mock data via `getDailyAdCreative()`. Admin placeholders provide the content fallback when real campaigns exist. |
| PlaceholderManager removal breaks other tabs | Only the Placeholders tab uses it. Other tabs (Dashboard, Campaigns, etc.) use separate components. |

---

## Out of Scope

- Home/YouTube slot definitions (future areas shown as empty accordions)
- Creative resolution waterfall for archive slots (existing mock system works; real campaign resolution is a separate task)
- `@tn-figueiredo/ad-engine-admin` package upgrade (package stays as-is; we replace only PlaceholderManager locally)
- Drag-to-reorder slots within an area
- Mobile-responsive admin layout (admin is desktop-only)

---

## Success Criteria

1. All 10 slots visible in admin Placeholders tab, grouped by area
2. Slot key rename is backward-compatible (no broken metrics/campaigns)
3. Each slot's preview accurately matches the real component's visual identity
4. CRUD operations (enable/disable, edit content, save) work for all 10 slots
5. Future areas (Home, YouTube) appear as empty dashed sections
6. Existing tests pass after slot key rename
