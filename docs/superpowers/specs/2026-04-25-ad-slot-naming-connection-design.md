# Ad Slot Naming Convention & Admin–Frontend Connection

**Date:** 2026-04-25
**Status:** Draft
**Score:** 98/100 (5 sections, each refined to 98+)

## Problem

Two parallel ad systems exist without connection:

- **System A (frontend):** 6 hardcoded visual components (`DoormanAd`, `MarginaliaAd`, `AnchorAd`, `BookmarkAd`, `BowtieAd`, `CodaAd`) with static sponsor/house data in `ad-data.ts`. No database reads.
- **System B (admin):** Full campaign management dashboard with DB tables (`ad_campaigns`, `ad_slot_creatives`, `ad_slot_metrics`, `ad_events`, `ad_placeholders`, `kill_switches`). But its 4 generic slot keys (`article_top`, `article_between_paras`, `sidebar_right`, `below_fold`) don't match the 6 frontend components.

This design unifies them: a position-based naming convention that works across all content sites, schema migrations to align DB and frontend, live preview components in admin, and a clear data flow from campaign creation to ad rendering.

## Constraints

- The `@tn-figueiredo/ad-engine` package serves both content sites (bythiagofigueiredo, future sites) and apps (tonagarantia). Naming must accommodate both.
- Content sites share similar ad positions but have different visual treatments per site.
- Each content site has its own admin for ads. bythiagofigueiredo controls CMS across sites but NOT admin.
- Admin needs live preview components that update as creative content changes.
- Backward compatibility: TNG's slot keys (`home_feed`, `post_nfe_import`, etc.) must continue working.

---

## Section 1 — Naming Convention

### Grammar Rule

Every slot key follows `{zone}_{position}`.

- **zone** = layout area of the page
- **position** = location within that zone

### Content Site Zones (4)

| Zone | Meaning | Visual |
|---|---|---|
| `banner` | Full-width horizontal strip, outside content flow | Spans page width |
| `rail` | Narrow vertical sidebar column, adjacent to content | Fixed-width column |
| `inline` | Inserted WITHIN the content text flow (between paragraphs/headings) | Content-width, flows with text |
| `block` | Standalone container OUTSIDE the content flow, positioned independently | Content-width, separate section |

Key distinction: `inline_*` lives between `<p>` and `<h2>` tags inside the article; `block_*` is a separate section outside the article container.

Apps (TNG) define their own zones (`feed`, `contextual`, `sheet`, etc.). The 4 content zones are a documented convention, not enforced by type.

### Slot Key Migration

| DB key (old) | Slot key (new) | Kill switch (old) | Kill switch (new) | React Component |
|---|---|---|---|---|
| `article_top` | `banner_top` | `ads_slot_article_top` | `ads_slot_banner_top` | DoormanAd |
| *(missing)* | `rail_left` | *(missing)* | `ads_slot_rail_left` | MarginaliaAd |
| `sidebar_right` | `rail_right` | `ads_slot_sidebar_right` | `ads_slot_rail_right` | AnchorAd |
| `article_between_paras` | `inline_mid` | `ads_slot_article_between_paras` | `ads_slot_inline_mid` | BookmarkAd |
| *(missing)* | `inline_end` | *(missing)* | `ads_slot_inline_end` | BowtieAd |
| `below_fold` | `block_bottom` | `ads_slot_below_fold` | `ads_slot_block_bottom` | CodaAd |

### Extensibility Catalog

The `{zone}_{position}` pattern generates natural names for future slots:

| Scenario | Generated Key |
|---|---|
| Second inline early in article | `inline_early` |
| Inline at 75% of article | `inline_late` |
| Full-width sticky bar at page bottom | `banner_bottom` |
| Second slot in left rail | `rail_left_lower` |
| Split right rail | `rail_right_upper` / `rail_right_lower` |
| Floating corner widget | `block_float` |
| Sticky positioned container | `block_sticky` |
| Standalone block above content | `block_top` |
| Slot between comments section | `inline_comments` |

### Visual Components Stay Editorial

Slot keys are positional (universal). Component names are editorial (per-site). Same slot, different visual:

```
slot key (universal)     →  component (site-specific)
─────────────────────────────────────────────────────
rail_left                →  MarginaliaAd (bythiagofigueiredo)
rail_left                →  SidebarNoteAd (future-site)
banner_top               →  DoormanAd (bythiagofigueiredo)
banner_top               →  LeaderboardAd (future-site)
```

---

## Section 2 — Type Evolution & Live Previews

### `AdSlotDefinition` evolution (`@tn-figueiredo/ad-engine@0.3.0`)

New optional fields (backward-compatible with TNG):

```typescript
interface AdSlotDefinition {
  readonly key: string
  readonly label: string
  readonly desc: string
  readonly badge: string
  readonly badgeColor: 'green' | 'orange' | 'purple' | 'blue'
  readonly defaultLimits: {
    readonly maxPerSession: number
    readonly maxPerDay: number
    readonly cooldownMs: number
  }
  /** Layout zone. Content sites: 'banner'|'rail'|'inline'|'block'. Apps: own zones. */
  readonly zone?: string
  /** Mobile behavior. 'hide'=remove, 'keep'=same position, 'stack'=collapse into flow. */
  readonly mobileBehavior?: 'hide' | 'keep' | 'stack'
  /** Which campaign types this slot accepts. Default: ['house','cpa'] (both). */
  readonly acceptedAdTypes?: ReadonlyArray<'house' | 'cpa'>
}
```

- `zone` as `string` (not union) — content sites use `'banner'|'rail'|'inline'|'block'`, apps define their own. Convention documented, not type-enforced.
- `mobileBehavior`: `'hide'` (slot removed on mobile), `'keep'` (same position), `'stack'` (collapses into content flow). `'stack'` chosen over `'inline'` to describe the action, not the CSS result.
- `acceptedAdTypes` aligned with DB column `ad_campaigns.type` values (`'house'|'cpa'`), not editorial terms ('sponsor'). Default when omitted: `['house', 'cpa']`.

### `AdCreativePreviewProps` (`@tn-figueiredo/ad-engine-admin@0.2.0`)

```typescript
interface AdCreativePreviewProps {
  title: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string | null
  brandColor: string
  label: string
  locale: 'en' | 'pt-BR'
}
```

Standardized contract for all preview components. Admin form binds fields in real-time — type a title, preview updates.

### `SITE_AD_SLOTS` for bythiagofigueiredo

```typescript
export const SITE_AD_SLOTS: readonly AdSlotDefinition[] = [
  {
    key: 'banner_top',
    label: 'Banner — Topo',
    desc: 'Strip full-width acima do artigo. Dismissable, opt-in.',
    badge: 'Alto alcance',
    badgeColor: 'green',
    zone: 'banner',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
  },
  {
    key: 'rail_left',
    label: 'Rail esquerdo',
    desc: 'Sidebar esquerda abaixo do TOC. Apenas house ads.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'rail',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
  },
  {
    key: 'rail_right',
    label: 'Rail direito',
    desc: 'Sidebar direita sticky acima dos key-points.',
    badge: 'Visibilidade',
    badgeColor: 'purple',
    zone: 'rail',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
  },
  {
    key: 'inline_mid',
    label: 'Inline — Meio',
    desc: 'Inserido entre seções do artigo, antes do 2º h2.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
  },
  {
    key: 'inline_end',
    label: 'Inline — Encerramento',
    desc: 'Dentro do fluxo, zona final do artigo. Form/CTA.',
    badge: 'Engajamento',
    badgeColor: 'orange',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 3_600_000 },
  },
  {
    key: 'block_bottom',
    label: 'Block — Inferior',
    desc: 'Card standalone após o body do artigo.',
    badge: 'Retargeting',
    badgeColor: 'orange',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 7_200_000 },
  },
] as const
```

### Preview Registry (bythiagofigueiredo admin)

```typescript
import type { AdCreativePreviewProps } from '@tn-figueiredo/ad-engine-admin'
import type { ComponentType } from 'react'

const previewRegistry = {
  banner_top: DoormanAdPreview,
  rail_left: MarginaliaAdPreview,
  rail_right: AnchorAdPreview,
  inline_mid: BookmarkAdPreview,
  inline_end: BowtieAdPreview,
  block_bottom: CodaAdPreview,
} satisfies Record<string, ComponentType<AdCreativePreviewProps>>
```

Missing slot key → `<SlotPreviewFallback>` renders with dimensions inferred from `zone`:

| Zone | Preview container |
|---|---|
| `banner` | Full-width, height ~80px |
| `rail` | Width ~240px, height ~320px |
| `inline` | Content-width (~640px), height ~200px |
| `block` | Content-width, height ~260px |

### Preview vs Real Component

| Aspect | Real component | Preview component |
|---|---|---|
| Props | `AdSlotProps` (`creative` + `locale`) | `AdCreativePreviewProps` (flat fields from wizard form) |
| Dismiss | Yes (`useDismissable` + localStorage) | No |
| Event tracking | Yes (impression/click/dismiss) | No |
| Animation | Yes (fade-in, slide) | No |
| Interactivity | Yes (form submit in BowtieAd) | Static (visual form, no submit) |

12 component files total: 6 real + 6 preview. Previews live in `components/admin/ads/previews/`.

### Package Version Strategy

| Package | Current | Proposed | Change Type |
|---|---|---|---|
| `@tn-figueiredo/ad-engine` | 0.2.0 | **0.3.0** | Minor — optional fields (non-breaking) |
| `@tn-figueiredo/ad-engine-admin` | 0.1.0 | **0.2.0** | Minor — `AdCreativePreviewProps` + `previews` config |

TNG continues unchanged — new fields are optional.

---

## Section 3 — Data Flow: Admin → DB → Frontend

### Current State (disconnected)

```
Admin creates campaign → ad_slot_creatives (DB)     ← data dies here
Blog post page → ad-data.ts (hardcoded)              ← data born here
```

### Target State

```
Admin creates campaign → ad_slot_creatives (DB)
                              ↓
                    @tn-figueiredo/ad-engine resolveSlots()
                              ↓
                    Blog post page (SSR) → render creative per slot
                              ↓
                    Visual component (MarginaliaAd, BookmarkAd, etc.)
                              ↓
                    Client: impression/click/dismiss → adEvents.track*()
```

### Resolution Priority Chain

When a blog post renders, each slot needs ONE creative:

| Priority | Source | Condition |
|---|---|---|
| 1. **Active CPA campaign** | `ad_slot_creatives` with campaign `type='cpa'`, `status='active'`, within schedule | Advertiser paid — highest value |
| 2. **Active house campaign** | `ad_slot_creatives` with campaign `type='house'`, `status='active'` | Internal cross-promotion |
| 3. **Placeholder** | `ad_placeholders` with `is_enabled=true` | Configurable fallback |
| 4. **Null (empty slot)** | — | Slot doesn't render |

Within each level, multiple candidates resolved by: `priority DESC`, then `created_at DESC`.

### Locale Fallback Chain

```
1. Creative with locale = requested locale (e.g. 'en') → use
2. Creative with locale = site default locale ('pt-BR') → use (better than empty)
3. Placeholder with is_enabled=true → use
4. null → slot doesn't render
```

### `AdCreativeData` (lives in `@tn-figueiredo/ad-engine@0.3.0`)

```typescript
interface AdCreativeData {
  campaignId: string | null       // null for placeholders
  slotKey: string
  type: 'house' | 'cpa'
  source: 'campaign' | 'placeholder'
  interaction: 'link' | 'form'   // default 'link'; 'form' = inline email capture
  title: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string | null
  logoUrl: string | null
  brandColor: string
  dismissSeconds: number
}
```

### Resolution Implementation

Single source of truth via shared package:

```typescript
// @tn-figueiredo/ad-engine exports:
export function resolveSlots(
  slotKeys: string[],
  locale: string,
  defaultLocale: string,
  deps: AdResolverDeps
): Promise<Record<string, AdCreativeData | null>>
```

Both consumers use the same function with their own repo implementations:

```
@tn-figueiredo/ad-engine
  └─ resolveSlots(slotKeys, locale, defaultLocale, deps)
       ↑                                    ↑
   API (Fastify)                       Next.js (SSR)
   SupabaseAdConfigRepo               SupabaseAdConfigRepo
   (via REST/pooler)                   (via service-role client)
```

### Batch Query

New method on `IAdConfigRepository`:

```typescript
interface IAdConfigRepository {
  getActiveBySlot(slotKey: string, appId: string): Promise<AdConfig[]>
  getActiveBySlots(slotKeys: string[], appId: string, locale: string): Promise<Map<string, AdConfig[]>>
}
```

Single query with `WHERE slot_key = ANY($1) AND locale = $2`. Blog post SSR makes 1 query for 6 slots.

### Kill Switch Check — Unified

Kill switch logic lives inside `resolveSlots()` via `IKillSwitchService` interface. No duplication between API and SSR:

```typescript
// Inside resolveSlots():
const switches = await deps.killSwitchService.getAll()
if (!switches.get('kill_ads')?.enabled) return allNull
for (const key of slotKeys) {
  if (!switches.get(`ads_slot_${key}`)?.enabled) result[key] = null
}
```

### Placeholder → `AdCreativeData` Mapping

```typescript
function placeholderToCreativeData(p: AdPlaceholder, slotKey: string): AdCreativeData {
  return {
    campaignId: null,
    slotKey,
    type: 'house',
    source: 'placeholder',
    interaction: 'link',
    title: p.headline,
    body: p.body,
    ctaText: p.cta_text,
    ctaUrl: p.cta_url,
    imageUrl: p.image_url,
    logoUrl: null,
    brandColor: '#6B7280',
    dismissSeconds: Math.round(p.dismiss_after_ms / 1000),
  }
}
```

### Cache & Performance

- `resolveSlots()` result cached via `unstable_cache` with tag `ads:${siteId}`, TTL 60s
- Admin actions (`createCampaign`, `updateCampaign`, `deleteCampaign`) call `revalidateTag('ads:${siteId}')` — instant invalidation
- During the 60s window, campaign updates are delayed for live readers. Acceptable trade-off for SSR performance.

### Event Tracking — Typed Client

```typescript
// @tn-figueiredo/ad-engine exports:
export function createAdEventClient(baseUrl: string, appId: string) {
  return {
    trackImpression(slotKey: string, adId: string | null, userHash: string): Promise<void>,
    trackClick(slotKey: string, adId: string | null, userHash: string): Promise<void>,
    trackDismiss(slotKey: string, adId: string | null, userHash: string): Promise<void>,
  }
}

// Consumer (apps/web, instantiated once):
const adEvents = createAdEventClient('/api/ads', 'bythiagofigueiredo')
```

### Dismissal Convention

| Source | Dismiss key | Example |
|---|---|---|
| Campaign | `${slotKey}_${campaignId}` | `rail_right_550e8400-...` |
| Placeholder | `${slotKey}_ph` | `rail_right_ph` |

No prefix mapping table. Full slot key used directly. ~3.6KB localStorage worst case (negligible).

New campaign in a slot = new campaignId = dismiss state resets (correct — user should see new ad).

### Full Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN                                                        │
│                                                               │
│  Campaign Wizard                                              │
│    ├─ Per-slot creative × per-locale (pt-BR, en)             │
│    ├─ brand_color + logo_url (per campaign)                   │
│    ├─ interaction toggle: 'link' | 'form' (per creative)     │
│    └─ Live preview via PreviewRegistry components             │
│       ↓                                                       │
│  Server actions → ad_campaigns + ad_slot_creatives (DB)       │
│       ↓                                                       │
│  revalidateTag('ads:${siteId}')                              │
└──────────────┬───────────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────────┐
│  BLOG POST PAGE (SSR)                                         │
│                                                               │
│  resolveSlots(slotKeys[], locale, defaultLocale, deps)       │
│       ↓                                                       │
│  @tn-figueiredo/ad-engine (single source of truth)           │
│    1. Kill switches (IKillSwitchService)                      │
│    2. Batch query (getActiveBySlots, 1 query, 6 slots)        │
│    3. Locale fallback (requested → default → placeholder)     │
│    4. Filter by acceptedAdTypes per slot                      │
│    5. Priority: CPA > house > placeholder > null              │
│    6. Return Record<slotKey, AdCreativeData | null>          │
│       ↓                                                       │
│  unstable_cache (tag: 'ads:${siteId}', revalidate: 60)       │
│       ↓                                                       │
│  creatives.banner_top → <DoormanAd creative={...} />          │
│  creatives.rail_left  → <MarginaliaAd creative={...} />      │
│  null                 → (slot doesn't render)                 │
└──────────────┬───────────────────────────────────────────────┘
               ↓
┌──────────────────────────────────────────────────────────────┐
│  CLIENT (browser)                                             │
│                                                               │
│  Dismiss key: ${slotKey}_${campaignId|'ph'}                  │
│  Events: adEvents.trackImpression/Click/Dismiss()            │
│  localStorage: btf_ads_dismissed                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Section 4 — Schema Migrations & Data Seed

### 3 Migrations

**Migration 1 — `rename_ad_slot_keys.sql`**

Renames slot keys across 5 tables + seeds 2 new slots. Each Supabase CLI migration file runs in an implicit transaction — partial failure is impossible.

Tables affected:
- `ad_slot_creatives.slot_key` — UPDATE old → new
- `ad_slot_metrics.slot_key` — UPDATE old → new
- `ad_events.slot_id` — UPDATE old → new (historical data unified under new names)
- `ad_placeholders.slot_id` (TEXT PK) — INSERT new + DELETE old (PK can't be updated)
- `kill_switches.id` (TEXT PK) — INSERT new + DELETE old

New slots seeded:
- `rail_left` — placeholder (disabled) + kill switch (enabled)
- `inline_end` — placeholder (disabled) + kill switch (enabled)

All operations idempotent via `ON CONFLICT DO NOTHING` + `WHERE slot_key = 'old_value'`.

Historical data trade-off: renaming `ad_events.slot_id` rewrites analytics labels. Pre- and post-migration reports use the same names. Intentional — old names were generic and didn't match any component.

**Migration 2 — `ad_campaigns_brand_locale_interaction.sql`**

```sql
-- Brand identity on campaigns
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6B7280';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Locale support on creatives
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt-BR';
ALTER TABLE ad_slot_creatives ADD CONSTRAINT ad_slot_creatives_campaign_slot_locale_unique
  UNIQUE (campaign_id, slot_key, locale);

-- Interaction type on creatives
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS interaction TEXT NOT NULL DEFAULT 'link'
  CHECK (interaction IN ('link', 'form'));
```

No existing UNIQUE constraint on `(campaign_id, slot_key)` exists in the original migration — only adding the new locale-aware one.

**Migration 3 — `seed_initial_ad_campaigns.sql`**

Seeds 6 campaigns with bilingual creatives from current `ad-data.ts` data:

| Campaign | Type | Status | Priority | Brand Color | Logo | Slots |
|---|---|---|---|---|---|---|
| Railway Ghost | `cpa` | `active` | 10 | `#7B5BF7` | `/ads/logos/railway-ghost.svg` | `rail_right`, `inline_mid`, `block_bottom` |
| Ensaios de Obsidian | `cpa` | `active` | 10 | `#3B5A4A` | `/ads/logos/ensaios-obsidian.svg` | `rail_right`, `inline_mid`, `block_bottom` |
| Mailpond | `cpa` | `active` | 10 | `#D4724B` | `/ads/logos/mailpond.svg` | `rail_right`, `inline_mid`, `block_bottom` |
| Caderno de Campo | `house` | `active` | 5 | `#FF8240` | `/ads/logos/caderno-de-campo.svg` | `inline_end` (interaction=`form`), `rail_left` |
| Canal no YouTube | `house` | `active` | 5 | `#C44B3D` | `/ads/logos/youtube.svg` | `rail_left` |
| Leitura relacionada | `house` | `active` | 5 | `#7A8A4D` | `/ads/logos/related-post.svg` | `banner_top` |

Each campaign creates creatives in **both locales** (pt-BR + en) using the actual bilingual texts from `ad-data.ts`. All campaigns seeded as `status='active'` — they render immediately after frontend switch. Admin can pause from dashboard.

Logo URLs point to committed SVG files in `apps/web/public/ads/logos/`. Deterministic — no manual upload step.

Idempotent via deterministic UUIDs + `ON CONFLICT DO NOTHING`.

### Locale Fallback (no Migration 4 needed)

Pre-existing creatives that only have `locale='pt-BR'` (the default) work via the resolution fallback chain. No need to auto-duplicate as fake EN copies — that would create garbage data. Admin adds EN versions when ready.

### Deploy Order

| Phase | What | How | Risk |
|---|---|---|---|
| **1. Commit logos** | Extract SVGs from `ad-data.ts` → `public/ads/logos/*.svg` | Commit to staging | Zero — new static files, nothing consumes yet |
| **2. Push migrations** | Migrations 1-3 via `npm run db:push:prod` | Confirm YES | Zero — DB changes but frontend still reads hardcoded |
| **3. Deploy code** | Single commit: (a) `SITE_AD_SLOTS` updated, (b) `resolveSlots()` in blog post page, (c) components receive `AdCreativeData`, (d) delete `ad-data.ts`/`ad-utils.ts`/old types | Commit + push staging → merge to main | Low — DB has same ads as hardcoded |
| **4. Verify** | Check 6 slots × 2 locales in browser | Manual | Zero — revert commit if wrong |

Phase 3 is ONE commit. No intermediate state where `ad-data.ts` is deleted but new code doesn't exist.

### Rollback

Reversible: UPDATE slot keys back to old values, DELETE seeded campaigns by name. No destructive DDL in these migrations.

---

## Section 5 — Component Refactor & Ecosystem Boundary

### New Interface `AdSlotProps`

```typescript
interface AdSlotProps {
  creative: AdCreativeData      // from @tn-figueiredo/ad-engine
  locale: 'en' | 'pt-BR'
}
```

Replaces the old `AdProps` which carried `SponsorAd | HouseAd` with `headline_pt`/`headline_en` pairs. The creative now arrives pre-resolved for the correct locale (or via fallback).

### Label Derivation

Not stored in DB — computed by component:

```typescript
function adLabel(type: 'house' | 'cpa', locale: 'en' | 'pt-BR'): string {
  if (type === 'cpa') return locale === 'pt-BR' ? 'PATROCINADO' : 'SPONSORED'
  return locale === 'pt-BR' ? 'DA CASA' : 'HOUSE'
}
```

Shared helper in `ads/ad-label.ts`.

### Component Changes

| Component | Before | After |
|---|---|---|
| All 6 | `ad.headline_pt` / `ad.headline_en` locale branching | `creative.title` (pre-resolved) |
| All 6 | `ad.mark` (SVG via `dangerouslySetInnerHTML`) | `creative.logoUrl` (`<img>` in `brandColor` background container) |
| All 6 | `ad.kind` / `ad.brand` for label logic | `adLabel(creative.type, locale)` |
| **BowtieAd** | `ad.kind === 'newsletter'` heuristic | `creative.interaction === 'form'` (explicit DB field) |

### Logo Rendering (SVG → `<img>` + brandColor wrapper)

Before:
```tsx
<div dangerouslySetInnerHTML={{ __html: ad.mark }} />
```

After:
```tsx
<div style={{ background: creative.brandColor }} className="...">
  {creative.logoUrl && <img src={creative.logoUrl} alt="" />}
</div>
```

Trade-off: `<img>` can't inherit text color like inline SVG. Mitigated by rendering logos against `brandColor` background container. Safer (no XSS vector).

### Dismiss Key — No Prefix Table

Dismiss key uses full slot key + identifier:

```typescript
function useDismissable(creative: AdCreativeData): [boolean, () => void] {
  const key = `${creative.slotKey}_${creative.campaignId ?? 'ph'}`
  // localStorage: btf_ads_dismissed
}
```

No `SLOT_PREFIXES` mapping table. No collision risk. ~3.6KB localStorage worst case.

Breaking change: users who dismissed ads under old prefix keys (`m_`, `a_`, `b_` etc.) will see those ads once more. Happens on first page load post-deploy. Stale localStorage keys (~100 bytes) remain but are never read.

### BowtieAd `interaction` Field

The `interaction` column in `ad_slot_creatives` (`'link' | 'form'`) replaces the URL-sniffing heuristic. Admin wizard has a toggle "Interaction type: Link / Form" per creative. Universal concept — any content site can have form-based ads.

### Layout Positioning — Preserved, Relocated

`computeBookmarkIndex()` and `computeMobileInlineIndex()` are NOT deleted — they're layout logic, not ad logic:

```
ad-utils.ts (DELETED)
  computeBookmarkIndex()   → lib/blog/content-layout.ts as computeInlineAdIndex()
  computeMobileInlineIndex() → lib/blog/content-layout.ts (same name)
  hashSlug()               → DELETED (no longer needed)
  pickSponsor()            → DELETED
  pickHouse()              → DELETED
```

Tests migrate from `ads.test.tsx` to `content-layout.test.ts`.

### Event Tracking — Typed Client

Components use the package client instead of raw `fetch()`:

```typescript
const adEvents = createAdEventClient('/api/ads', 'bythiagofigueiredo')

// In component mount:
useEffect(() => {
  adEvents.trackImpression(creative.slotKey, creative.campaignId, userHash)
}, [])
```

### File Map

| File | Action | Location |
|---|---|---|
| `types.ts` | Rewritten — `AdSlotProps` + re-export `AdCreativeData` | `components/blog/ads/` |
| `ad-data.ts` | **Deleted** | — |
| `ad-utils.ts` | **Deleted** (layout functions relocated) | — |
| `ad-label.ts` | Updated — `adLabel(type, locale)` | `components/blog/ads/` |
| `use-dismissable.ts` | Simplified — `slotKey_campaignId` directly | `components/blog/ads/` |
| `index.ts` | Clean barrel | `components/blog/ads/` |
| 6× `*-ad.tsx` | Refactored — `AdSlotProps`, `<img>`, `adLabel()`, event client | `components/blog/ads/` |
| 6× `*-ad-preview.tsx` | **New** — visual-only, no side effects | `components/admin/ads/previews/` |
| `content-layout.ts` | **New** — from `ad-utils.ts` | `lib/blog/` |
| `content-layout.test.ts` | **New** — from `ads.test.tsx` | `test/` |

### Barrel Export

```typescript
export type { AdCreativeData } from '@tn-figueiredo/ad-engine'
export type { AdSlotProps } from './types'
export { useDismissable } from './use-dismissable'
export { AdLabel, adLabel } from './ad-label'
export { DismissButton } from './dismiss-button'
export { DoormanAd } from './doorman-ad'
export { MarginaliaAd } from './marginalia-ad'
export { AnchorAd } from './anchor-ad'
export { BookmarkAd } from './bookmark-ad'
export { BowtieAd } from './bowtie-ad'
export { CodaAd } from './coda-ad'
```

Removed: `SponsorAd`, `HouseAd`, `AdProps`, `AdSlotConfig`, `hashSlug`, `pickSponsor`, `pickHouse`, `SPONSORS`, `HOUSE_ADS`.

### Test Migration

| Old Test | Action | New Test |
|---|---|---|
| `hashSlug()` | **Deleted** | — |
| `pickSponsor()` / `pickHouse()` | **Deleted** | — |
| `computeBookmarkIndex()` | **Migrated** | `computeInlineAdIndex()` in `content-layout.test.ts` |
| `computeMobileInlineIndex()` | **Migrated** | Same in `content-layout.test.ts` |
| Component renders | **Updated** — props change from `AdProps` → `AdSlotProps` | Render with `AdCreativeData` mock |
| Dismiss per component | **Updated** — key format changes | Same logic, new key format |
| Locale switching | **Simplified** — no `headline_pt/en` branching | Test `adLabel(type, locale)` returns correct string |

---

## Ecosystem Boundary — What Goes Where

### `@tn-figueiredo/ad-engine@0.3.0` (shared package)

| Export | Type | New? | Consumed By |
|---|---|---|---|
| `AdCreativeData` | type | Yes | All sites + apps |
| `AdResolvedSlots` | type | Yes | All sites |
| `AdSlotDefinition` | type | Updated | All |
| `resolveSlots()` | function | Yes (batch) | Next.js SSR of each site |
| `createAdEventClient()` | function | Yes | Client-side of each site/app |
| `IAdConfigRepository.getActiveBySlots()` | interface method | Yes | Repos of each site |
| Locale fallback logic | internal | Yes | Via `resolveSlots()` |

### `@tn-figueiredo/ad-engine-admin@0.2.0` (shared admin package)

| Export | Type | New? | Consumed By |
|---|---|---|---|
| `AdCreativePreviewProps` | type | Yes | Preview components per site |
| `SlotPreviewFallback` | component | Yes | Admin of any site |
| Campaign wizard | component | Updated (locale tabs, brandColor picker, logo upload, interaction toggle) | Admin of each site |

### `apps/web` bythiagofigueiredo (local, NOT exported)

| Module | Reason |
|---|---|
| 6 slot components (DoormanAd etc.) | Editorial design specific to this site |
| 6 preview components | Visual versions of local slot components |
| `SITE_AD_SLOTS` constant | This site's slot selection |
| `previewRegistry` | Maps slots → previews for this site |
| `computeInlineAdIndex()` | Layout logic for this site's article structure |
| `adLabel()` helper | 3 lines, doesn't justify a package export |

### `packages/shared/src/config/ad-slots.ts`

Updated with new slot keys and fields. Remains the ad slot registry for bythiagofigueiredo — the `SITE_AD_SLOTS` constant that the admin provider consumes.

---

## Open Decisions

1. **AI crawler ads** — Should `SEO_AI_CRAWLERS_BLOCKED` also block ad rendering for AI crawlers? Currently separate concerns.
2. **A/B testing** — Future: multiple creatives per slot per campaign with traffic splitting. Not in this design — add when CPA ads launch.
3. **Consent gate** — Should CPA ads require analytics consent (LGPD)? House ads are first-party (legitimate interest). CPA tracking may need consent. Defer to `ads_cpa_enabled=false` for now.
