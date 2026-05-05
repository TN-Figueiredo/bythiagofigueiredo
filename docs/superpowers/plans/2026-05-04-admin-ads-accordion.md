# Admin Ads Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `PlaceholderManager` with a local accordion component that groups all 10 ad slots by area, registers the 5 new archive slots, and shows format-accurate live previews.

**Architecture:** 3 DB migrations rename existing slot keys to `post:*` namespace, add `brand_color`/`logo_url` columns, and seed 5 new `archive:*` slots. Shared package gains `area` field + `AD_AREAS` + `getSlotsByArea()`. All consumer code (resolve.ts, blog post page, blog archive, adsense sync) updates to new keys. New `PlaceholderAccordion` component replaces `PlaceholderManager` in admin.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Supabase PostgreSQL 17, Vitest

---

## File Structure

### Files to Create

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260504100001_rename_slot_keys_v2.sql` | Rename 5 flat keys → `post:*` namespace across all ad tables |
| `supabase/migrations/20260504100002_placeholders_brand_columns.sql` | Add `brand_color` + `logo_url` columns to `ad_placeholders` |
| `supabase/migrations/20260504100003_seed_archive_slots.sql` | Seed 5 `archive:*` rows in `ad_placeholders`, `ad_slot_config`, `kill_switches` |
| `apps/web/src/app/admin/(authed)/ads/_components/placeholder-accordion.tsx` | Main accordion UI grouping slots by area |
| `apps/web/src/app/admin/(authed)/ads/_components/slot-form.tsx` | Per-format edit form with controlled fields |
| `apps/web/src/app/admin/(authed)/ads/_components/slot-preview.tsx` | Format-accurate preview renderers (7 ad formats) |

### Files to Modify

| File | Change |
|------|--------|
| `packages/shared/src/config/ad-slots.ts` | Add `area` to `AdSlotDefinition`, rename 5 keys to `post:*`, add 5 `archive:*` slots, add `AD_AREAS` + `getSlotsByArea()` |
| `apps/web/src/lib/ads/resolve.ts` | Update `SLOT_KEYS` + `toAdPlaceholder` + `mapResolutionToCreativeData` for new keys + `brand_color`/`logo_url` |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Update 7 slot key references from flat → `post:*` |
| `apps/web/src/app/api/cron/adsense-sync/route.ts` | Update `adUnitToSlotKey` mapping to `post:*` keys |
| `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` | Add `brand_color` + `logo_url` to `updatePlaceholder` |
| `apps/web/src/app/admin/(authed)/ads/page.tsx` | Replace `PlaceholderManager` with `PlaceholderAccordion`, fetch `ad_slot_config` |
| `apps/web/test/lib/ads-slot-config.test.ts` | Update to expect 10 slots with new `post:*`/`archive:*` keys |

---

### Task 1: Shared package — expand `AdSlotDefinition` + `SITE_AD_SLOTS`

**Files:**
- Modify: `packages/shared/src/config/ad-slots.ts`
- Test: `apps/web/test/lib/ads-slot-config.test.ts`

- [ ] **Step 1: Write the failing test**

Replace `apps/web/test/lib/ads-slot-config.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import { SITE_AD_SLOTS, AD_AREAS, getSlotsByArea } from '@app/shared'

describe('SITE_AD_SLOTS', () => {
  it('includes all 10 active slots', () => {
    const keys = SITE_AD_SLOTS.map((s) => s.key)
    expect(keys).toEqual([
      'post:top:banner',
      'post:rail:anchor-left',
      'post:rail:anchor',
      'post:body:bookmark',
      'post:footer:coda',
      'archive:top:doorman',
      'archive:break:anchor',
      'archive:grid:bookmark',
      'archive:footer:marginalia',
      'archive:footer:bowtie',
    ])
  })

  it('every slot has an area field', () => {
    for (const slot of SITE_AD_SLOTS) {
      expect(slot).toHaveProperty('area')
      expect(['post', 'archive', 'home', 'youtube']).toContain(slot.area)
    }
  })

  it('getSlotsByArea returns correct groupings', () => {
    expect(getSlotsByArea('post')).toHaveLength(5)
    expect(getSlotsByArea('archive')).toHaveLength(5)
    expect(getSlotsByArea('home')).toHaveLength(0)
    expect(getSlotsByArea('youtube')).toHaveLength(0)
  })

  it('AD_AREAS defines 4 areas', () => {
    expect(AD_AREAS).toHaveLength(4)
    expect(AD_AREAS.map((a) => a.key)).toEqual(['post', 'archive', 'home', 'youtube'])
  })
})

describe('ads index exports', () => {
  it('does not export BowtieAd', async () => {
    const mod = await import('../../src/components/blog/ads')
    expect((mod as Record<string, unknown>).BowtieAd).toBeUndefined()
  })

  it('exports all 5 remaining ad components', async () => {
    const mod = await import('../../src/components/blog/ads')
    expect(mod.DoormanAd).toBeDefined()
    expect(mod.MarginaliaAd).toBeDefined()
    expect(mod.AnchorAd).toBeDefined()
    expect(mod.BookmarkAd).toBeDefined()
    expect(mod.CodaAd).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/lib/ads-slot-config.test.ts`
Expected: FAIL — `getSlotsByArea` and `AD_AREAS` not exported, slots still have old keys

- [ ] **Step 3: Update `packages/shared/src/config/ad-slots.ts`**

Replace the full file content:

```typescript
export interface AdSlotDefinition {
  key: string
  area: 'post' | 'archive' | 'home' | 'youtube'
  label: string
  desc: string
  badge: string
  badgeColor: string
  zone: 'banner' | 'rail' | 'inline' | 'block'
  mobileBehavior: 'keep' | 'hide' | 'stack'
  acceptedAdTypes: readonly ('house' | 'cpa')[]
  defaultLimits: {
    maxPerSession: number
    maxPerDay: number
    cooldownMs: number
  }
  aspectRatio: string
  iabSize: string
}

export const SITE_AD_SLOTS: readonly AdSlotDefinition[] = [
  {
    key: 'post:top:banner',
    area: 'post',
    label: 'Banner — Topo',
    desc: 'Strip full-width acima do artigo. Dismissable, opt-in.',
    badge: 'Alto alcance',
    badgeColor: 'green',
    zone: 'banner',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '8:1',
    iabSize: '728x90',
  },
  {
    key: 'post:rail:anchor-left',
    area: 'post',
    label: 'Rail esquerdo',
    desc: 'Sidebar esquerda abaixo do TOC. Apenas house ads.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'rail',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '1:4',
    iabSize: '160x600',
  },
  {
    key: 'post:rail:anchor',
    area: 'post',
    label: 'Rail direito',
    desc: 'Sidebar direita sticky acima dos key-points.',
    badge: 'Visibilidade',
    badgeColor: 'purple',
    zone: 'rail',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
    aspectRatio: '6:5',
    iabSize: '300x250',
  },
  {
    key: 'post:body:bookmark',
    area: 'post',
    label: 'Inline — Meio',
    desc: 'Inserido entre seções do artigo, antes do 2º h2.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
    aspectRatio: '6:5',
    iabSize: '300x250',
  },
  {
    key: 'post:footer:coda',
    area: 'post',
    label: 'Block — Inferior',
    desc: 'Card standalone após o body do artigo.',
    badge: 'Retargeting',
    badgeColor: 'orange',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 7_200_000 },
    aspectRatio: '4:1',
    iabSize: '970x250',
  },
  {
    key: 'archive:top:doorman',
    area: 'archive',
    label: 'Banner — Topo Archive',
    desc: 'Strip full-width no topo da listagem do blog. Hidden mobile.',
    badge: 'Awareness',
    badgeColor: 'green',
    zone: 'banner',
    mobileBehavior: 'hide',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 3, cooldownMs: 3_600_000 },
    aspectRatio: '8:1',
    iabSize: '728x90',
  },
  {
    key: 'archive:break:anchor',
    area: 'archive',
    label: 'Âncora Horizontal',
    desc: 'Break horizontal entre cards do grid, 3 colunas.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'inline',
    mobileBehavior: 'stack',
    acceptedAdTypes: ['cpa'],
    defaultLimits: { maxPerSession: 2, maxPerDay: 4, cooldownMs: 1_800_000 },
    aspectRatio: '16:3',
    iabSize: 'fluid',
  },
  {
    key: 'archive:grid:bookmark',
    area: 'archive',
    label: 'Card no Grid',
    desc: 'Card de anúncio integrado ao grid pinboard, tema escuro.',
    badge: 'Nativo',
    badgeColor: 'purple',
    zone: 'inline',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 3, maxPerDay: 6, cooldownMs: 900_000 },
    aspectRatio: '3:4',
    iabSize: 'grid-cell',
  },
  {
    key: 'archive:footer:marginalia',
    area: 'archive',
    label: 'Marginalia — Rodapé',
    desc: 'Bloco editorial no rodapé da listagem, max-w 720.',
    badge: 'Contextual',
    badgeColor: 'blue',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house', 'cpa'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 2, cooldownMs: 3_600_000 },
    aspectRatio: '16:3',
    iabSize: 'max-w-720',
  },
  {
    key: 'archive:footer:bowtie',
    area: 'archive',
    label: 'Newsletter CTA',
    desc: 'CTA de newsletter em Caveat cursive, form de email.',
    badge: 'Engajamento',
    badgeColor: 'orange',
    zone: 'block',
    mobileBehavior: 'keep',
    acceptedAdTypes: ['house'],
    defaultLimits: { maxPerSession: 1, maxPerDay: 1, cooldownMs: 7_200_000 },
    aspectRatio: '16:3',
    iabSize: 'full-width',
  },
] as const

export function getSlotsByArea(area: string): AdSlotDefinition[] {
  return SITE_AD_SLOTS.filter((s) => s.area === area)
}

export const AD_AREAS = [
  { key: 'post', label: 'Blog Post', route: '/blog/[slug]' },
  { key: 'archive', label: 'Blog Archive', route: '/blog' },
  { key: 'home', label: 'Home', route: '/' },
  { key: 'youtube', label: 'YouTube', route: '/youtube' },
] as const
```

- [ ] **Step 4: Ensure `getSlotsByArea` and `AD_AREAS` are exported from the shared barrel**

Check `packages/shared/src/index.ts` — if `ad-slots.ts` is re-exported with `*`, no change needed. If individual exports, add:

```typescript
export { SITE_AD_SLOTS, AD_AREAS, getSlotsByArea, type AdSlotDefinition } from './config/ad-slots'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/lib/ads-slot-config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config/ad-slots.ts apps/web/test/lib/ads-slot-config.test.ts
git commit -m "feat(ads): expand AdSlotDefinition with area field, add 5 archive slots + AD_AREAS + getSlotsByArea"
```

---

### Task 2: Update `resolve.ts` — new slot keys + `brand_color`/`logo_url` passthrough

**Files:**
- Modify: `apps/web/src/lib/ads/resolve.ts`
- Test: `apps/web/test/lib/ads-resolve.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/ads-resolve.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mapResolutionToCreativeData } from '../../src/lib/ads/resolve'
import type { AdResolution } from '@tn-figueiredo/ad-engine'

describe('mapResolutionToCreativeData', () => {
  it('returns null for empty resolution', () => {
    const resolution: AdResolution = { source: 'empty', reason: 'killed' }
    expect(mapResolutionToCreativeData('post:top:banner', resolution)).toBeNull()
  })

  it('passes brandColor and logoUrl from placeholder', () => {
    const resolution: AdResolution = {
      source: 'placeholder',
      placeholder: {
        slotId: 'post:top:banner',
        headline: 'Test',
        body: 'Body',
        ctaText: 'CTA',
        ctaUrl: '/test',
        imageUrl: null,
        isEnabled: true,
        brandColor: '#f97316',
        logoUrl: 'https://example.com/logo.png',
      },
    }
    const result = mapResolutionToCreativeData('post:top:banner', resolution)
    expect(result).not.toBeNull()
    expect(result!.brandColor).toBe('#f97316')
    expect(result!.logoUrl).toBe('https://example.com/logo.png')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/lib/ads-resolve.test.ts`
Expected: FAIL — `brandColor` and `logoUrl` not on `AdPlaceholder`, hardcoded in `mapResolutionToCreativeData`

- [ ] **Step 3: Update `apps/web/src/lib/ads/resolve.ts`**

**Change 1:** Update `SLOT_KEYS` (line 17-23):

```typescript
const SLOT_KEYS = [
  'post:top:banner',
  'post:rail:anchor-left',
  'post:rail:anchor',
  'post:body:bookmark',
  'post:footer:coda',
] as const
```

**Change 2:** Update `toAdPlaceholder` (line 96-114) — add `brand_color` + `logo_url`:

```typescript
function toAdPlaceholder(ph: {
  slot_id: string
  headline: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  is_enabled: boolean
  brand_color: string | null
  logo_url: string | null
}): AdPlaceholder {
  return {
    slotId: ph.slot_id,
    headline: ph.headline ?? '',
    body: ph.body ?? '',
    ctaText: ph.cta_text ?? '',
    ctaUrl: ph.cta_url ?? '',
    imageUrl: ph.image_url ?? null,
    isEnabled: ph.is_enabled,
    brandColor: ph.brand_color ?? '#6B7280',
    logoUrl: ph.logo_url ?? null,
  }
}
```

**Change 3:** Update placeholder select query (line 226-228) — add columns:

```typescript
    supabase
      .from('ad_placeholders')
      .select('slot_id, headline, body, cta_text, cta_url, image_url, is_enabled, brand_color, logo_url')
      .eq('is_enabled', true),
```

**Change 4:** Update kill switch derivation (lines 235-239). The migration stores the real slot key in the `reason` column, so use that instead of deriving from `id`:

```typescript
  const killedSlots = new Set(
    (killSlotsResult.data ?? [])
      .filter((k) => !k.enabled && k.reason)
      .map((k) => k.reason as string),
  )
```

Also update the select query (line 190-191) to include `reason`:

```typescript
    supabase
      .from('kill_switches')
      .select('id, enabled, reason')
      .like('id', 'ads_slot_%'),
```

**Change 5:** Update `mapResolutionToCreativeData` placeholder branch (lines 316-334):

```typescript
  if (resolution.placeholder) {
    const ph = resolution.placeholder
    return {
      campaignId: null,
      slotKey,
      type: 'house',
      source: 'placeholder',
      interaction: 'link',
      title: ph.headline,
      body: ph.body,
      ctaText: ph.ctaText,
      ctaUrl: ph.ctaUrl,
      imageUrl: ph.imageUrl,
      logoUrl: (ph as Record<string, unknown>).logoUrl as string | null ?? null,
      brandColor: (ph as Record<string, unknown>).brandColor as string ?? '#6B7280',
      dismissSeconds: 0,
    }
  }
```

> **Note:** The `AdPlaceholder` type from `@tn-figueiredo/ad-engine` may not have `brandColor`/`logoUrl` fields yet. Cast through `Record<string, unknown>` to forward the values our `toAdPlaceholder` injects. When `ad-engine` is upgraded, remove the cast.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/lib/ads-resolve.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/ads/resolve.ts apps/web/test/lib/ads-resolve.test.ts
git commit -m "feat(ads): update resolve.ts to post:* slot keys + brand_color/logo_url passthrough"
```

---

### Task 3: Update blog post page — `post:*` slot key references

**Files:**
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Update slot key references**

In `apps/web/src/app/(public)/blog/[slug]/page.tsx`, replace all 7 occurrences of flat keys with `post:*` keys. The property access pattern `creatives.banner_top` becomes `creatives['post:top:banner']` (bracket notation required due to colons):

Line 149: `creatives.banner_top` → `creatives['post:top:banner']`
Line 213: `creatives.rail_left` → `creatives['post:rail:anchor-left']`
Line 229: `creatives.rail_right` → `creatives['post:rail:anchor']`
Line 232: `creatives.inline_mid` → `creatives['post:body:bookmark']`
Line 234: `creatives.inline_mid` → `creatives['post:body:bookmark']`
Line 254: `creatives.block_bottom` → `creatives['post:footer:coda']`
Line 267: `creatives.rail_right` → `creatives['post:rail:anchor']`

- [ ] **Step 2: Verify no remaining old key references**

Run: `grep -n 'banner_top\|rail_left\|rail_right\|inline_mid\|block_bottom' apps/web/src/app/\(public\)/blog/\[slug\]/page.tsx`
Expected: No output

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/\[slug\]/page.tsx
git commit -m "refactor(ads): update blog post page to post:* slot key namespace"
```

---

### Task 4: Update adsense sync cron — `post:*` key mapping

**Files:**
- Modify: `apps/web/src/app/api/cron/adsense-sync/route.ts`

- [ ] **Step 1: Update `adUnitToSlotKey` mapping**

In `apps/web/src/app/api/cron/adsense-sync/route.ts`, replace the mapping object (lines 10-16):

```typescript
function adUnitToSlotKey(adUnitCode: string): string {
  const mapping: Record<string, string> = {
    banner_top: 'post:top:banner',
    rail_left: 'post:rail:anchor-left',
    rail_right: 'post:rail:anchor',
    inline_mid: 'post:body:bookmark',
    block_bottom: 'post:footer:coda',
  }
  for (const [key, slotKey] of Object.entries(mapping)) {
    if (adUnitCode.includes(key)) return slotKey
  }
  return adUnitCode.split('/').pop() ?? adUnitCode
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/adsense-sync/route.ts
git commit -m "refactor(ads): update adsense sync cron to post:* slot keys"
```

---

### Task 5: Update `updatePlaceholder` server action — `brand_color` + `logo_url`

**Files:**
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`

- [ ] **Step 1: Add brand_color and logo_url to updatePlaceholder**

In `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`, update the `updatePlaceholder` function (lines 250-276). Add two field mappings after the existing ones:

After line 264 (`if (data.dismissAfterMs !== undefined) update.dismiss_after_ms = data.dismissAfterMs`), add:

```typescript
  const extData = data as Record<string, unknown>
  if (extData.brandColor !== undefined)    update.brand_color     = extData.brandColor
  if (extData.logoUrl !== undefined)       update.logo_url        = extData.logoUrl
```

> **Note:** `PlaceholderFormData` from `@tn-figueiredo/ad-engine-admin` doesn't include `brandColor`/`logoUrl`. We cast to `Record<string, unknown>` to accept the extended fields from our custom form. When the package is upgraded, replace with typed fields.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/_actions/campaigns.ts
git commit -m "feat(ads): support brand_color + logo_url in updatePlaceholder server action"
```

---

### Task 6: DB Migration 1 — Rename slot keys to `post:*` namespace

**Files:**
- Create: `supabase/migrations/20260504100001_rename_slot_keys_v2.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: rename flat slot keys to post:* namespace
-- Idempotent: WHERE clauses target old keys only, no-op if already renamed

BEGIN;

-- 1. ad_placeholders (PK = slot_id) — must delete + reinsert since PK changes
-- Save old rows, insert with new keys, delete originals
INSERT INTO public.ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, app_id, created_at, updated_at)
SELECT
  CASE slot_id
    WHEN 'banner_top'   THEN 'post:top:banner'
    WHEN 'rail_left'    THEN 'post:rail:anchor-left'
    WHEN 'rail_right'   THEN 'post:rail:anchor'
    WHEN 'inline_mid'   THEN 'post:body:bookmark'
    WHEN 'block_bottom' THEN 'post:footer:coda'
  END,
  is_enabled, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, app_id, created_at, now()
FROM public.ad_placeholders
WHERE slot_id IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom')
ON CONFLICT (slot_id) DO NOTHING;

DELETE FROM public.ad_placeholders
WHERE slot_id IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom');

-- 2. ad_slot_creatives (slot_key column)
UPDATE public.ad_slot_creatives SET slot_key = 'post:top:banner'       WHERE slot_key = 'banner_top';
UPDATE public.ad_slot_creatives SET slot_key = 'post:rail:anchor-left' WHERE slot_key = 'rail_left';
UPDATE public.ad_slot_creatives SET slot_key = 'post:rail:anchor'      WHERE slot_key = 'rail_right';
UPDATE public.ad_slot_creatives SET slot_key = 'post:body:bookmark'    WHERE slot_key = 'inline_mid';
UPDATE public.ad_slot_creatives SET slot_key = 'post:footer:coda'      WHERE slot_key = 'block_bottom';

-- 3. ad_slot_metrics (slot_key in composite PK — delete + reinsert)
INSERT INTO public.ad_slot_metrics (slot_key, app_id, impressions, clicks, conversions, revenue_cents, date, created_at, updated_at)
SELECT
  CASE slot_key
    WHEN 'banner_top'   THEN 'post:top:banner'
    WHEN 'rail_left'    THEN 'post:rail:anchor-left'
    WHEN 'rail_right'   THEN 'post:rail:anchor'
    WHEN 'inline_mid'   THEN 'post:body:bookmark'
    WHEN 'block_bottom' THEN 'post:footer:coda'
  END,
  app_id, impressions, clicks, conversions, revenue_cents, date, created_at, now()
FROM public.ad_slot_metrics
WHERE slot_key IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom')
ON CONFLICT DO NOTHING;

DELETE FROM public.ad_slot_metrics
WHERE slot_key IN ('banner_top', 'rail_left', 'rail_right', 'inline_mid', 'block_bottom');

-- 4. ad_events (slot_id column)
UPDATE public.ad_events SET slot_id = 'post:top:banner'       WHERE slot_id = 'banner_top';
UPDATE public.ad_events SET slot_id = 'post:rail:anchor-left' WHERE slot_id = 'rail_left';
UPDATE public.ad_events SET slot_id = 'post:rail:anchor'      WHERE slot_id = 'rail_right';
UPDATE public.ad_events SET slot_id = 'post:body:bookmark'    WHERE slot_id = 'inline_mid';
UPDATE public.ad_events SET slot_id = 'post:footer:coda'      WHERE slot_id = 'block_bottom';

-- 5. kill_switches (id column for per-slot switches)
UPDATE public.kill_switches SET id = 'ads_slot_post_top_banner',       reason = 'post:top:banner'       WHERE id = 'ads_slot_banner_top';
UPDATE public.kill_switches SET id = 'ads_slot_post_rail_anchor_left', reason = 'post:rail:anchor-left' WHERE id = 'ads_slot_rail_left';
UPDATE public.kill_switches SET id = 'ads_slot_post_rail_anchor',      reason = 'post:rail:anchor'      WHERE id = 'ads_slot_rail_right';
UPDATE public.kill_switches SET id = 'ads_slot_post_body_bookmark',    reason = 'post:body:bookmark'    WHERE id = 'ads_slot_inline_mid';
UPDATE public.kill_switches SET id = 'ads_slot_post_footer_coda',      reason = 'post:footer:coda'      WHERE id = 'ads_slot_block_bottom';

-- 6. ad_slot_config (composite PK = site_id + slot_key — update in-place)
UPDATE public.ad_slot_config SET slot_key = 'post:top:banner'       WHERE slot_key = 'banner_top';
UPDATE public.ad_slot_config SET slot_key = 'post:rail:anchor-left' WHERE slot_key = 'rail_left';
UPDATE public.ad_slot_config SET slot_key = 'post:rail:anchor'      WHERE slot_key = 'rail_right';
UPDATE public.ad_slot_config SET slot_key = 'post:body:bookmark'    WHERE slot_key = 'inline_mid';
UPDATE public.ad_slot_config SET slot_key = 'post:footer:coda'      WHERE slot_key = 'block_bottom';

COMMIT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260504100001_rename_slot_keys_v2.sql
git commit -m "feat(ads): migration to rename flat slot keys to post:* namespace"
```

---

### Task 7: DB Migration 2 — Add `brand_color` + `logo_url` to `ad_placeholders`

**Files:**
- Create: `supabase/migrations/20260504100002_placeholders_brand_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: add brand_color and logo_url columns to ad_placeholders
-- Required before migration 3 (seed archive slots references these columns)

ALTER TABLE public.ad_placeholders
  ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6B7280',
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260504100002_placeholders_brand_columns.sql
git commit -m "feat(ads): add brand_color + logo_url columns to ad_placeholders"
```

---

### Task 8: DB Migration 3 — Seed archive slots

**Files:**
- Create: `supabase/migrations/20260504100003_seed_archive_slots.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: seed 5 archive:* slots in ad_placeholders, ad_slot_config, kill_switches

-- 1. ad_placeholders
INSERT INTO public.ad_placeholders (slot_id, is_enabled, headline, body, cta_text, cta_url, brand_color, app_id)
VALUES
  ('archive:top:doorman',       false, 'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:break:anchor',      true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:grid:bookmark',     true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:marginalia', true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#f97316', 'bythiagofigueiredo'),
  ('archive:footer:bowtie',     true,  'Anuncie aqui', 'Alcance nossos leitores.',  'Saiba mais', '/anuncie', '#FF8240', 'bythiagofigueiredo')
ON CONFLICT (slot_id) DO NOTHING;

-- 2. ad_slot_config (requires site_id lookup)
DO $$ DECLARE v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM public.sites WHERE slug = 'bythiagofigueiredo' LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.ad_slot_config (
    site_id, slot_key, label, zone, iab_size, mobile_behavior,
    accepted_types, aspect_ratio,
    house_enabled, cpa_enabled, google_enabled, template_enabled,
    max_per_session, max_per_day, cooldown_ms
  )
  VALUES
    (v_site_id, 'archive:top:doorman',       'Banner — Topo Archive',  'banner', '728x90',    'hide',  '{house,cpa}', '8:1',  true, true,  false, true, 1, 3, 3600000),
    (v_site_id, 'archive:break:anchor',      'Âncora Horizontal',      'inline', NULL,        'stack', '{cpa}',       '16:3', false, true, false, true, 2, 4, 1800000),
    (v_site_id, 'archive:grid:bookmark',     'Card no Grid',           'inline', NULL,        'keep',  '{house,cpa}', '3:4',  true, true,  false, true, 3, 6, 900000),
    (v_site_id, 'archive:footer:marginalia', 'Marginalia — Rodapé',    'block',  NULL,        'keep',  '{house,cpa}', '16:3', true, true,  false, true, 1, 2, 3600000),
    (v_site_id, 'archive:footer:bowtie',     'Newsletter CTA',         'block',  NULL,        'keep',  '{house}',     '16:3', true, false, false, true, 1, 1, 7200000)
  ON CONFLICT (site_id, slot_key) DO NOTHING;
END $$;

-- 3. kill_switches
INSERT INTO public.kill_switches (id, enabled, reason) VALUES
  ('ads_slot_archive_top_doorman',       true, 'archive:top:doorman'),
  ('ads_slot_archive_break_anchor',      true, 'archive:break:anchor'),
  ('ads_slot_archive_grid_bookmark',     true, 'archive:grid:bookmark'),
  ('ads_slot_archive_footer_marginalia', true, 'archive:footer:marginalia'),
  ('ads_slot_archive_footer_bowtie',     true, 'archive:footer:bowtie')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260504100003_seed_archive_slots.sql
git commit -m "feat(ads): seed 5 archive:* slots in placeholders, slot_config, kill_switches"
```

---

### Task 9: Create `SlotPreview` component — format-accurate previews

**Files:**
- Create: `apps/web/src/app/admin/(authed)/ads/_components/slot-preview.tsx`

- [ ] **Step 1: Create the SlotPreview component**

Create `apps/web/src/app/admin/(authed)/ads/_components/slot-preview.tsx`:

```tsx
'use client'

interface PreviewData {
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  brandColor: string
  logoUrl: string | null
  imageUrl: string | null
}

interface SlotPreviewProps {
  slotKey: string
  data: PreviewData
}

const theme = {
  bg: '#1E1A12',
  paper: '#262117',
  paper2: '#2B261C',
  ink: '#EFE6D2',
  muted: '#958A75',
  faint: '#6B634F',
  line: '#2E2718',
  accent: '#FF8240',
  tape: '#E8C44A',
}

function getFormatFromKey(key: string): string {
  const parts = key.split(':')
  return parts[2] ?? 'unknown'
}

function DoormanPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ background: data.brandColor, color: '#FFF', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ fontSize: 8, letterSpacing: '0.16em', fontWeight: 700, padding: '2px 6px', background: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', fontFamily: 'monospace' }}>AD</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{data.headline || 'Headline'}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 600, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.5)', textTransform: 'uppercase', fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function AnchorPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '12px', border: `1px solid ${theme.line}`, background: theme.paper2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 6px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        {data.logoUrl && (
          <div style={{ width: 28, height: 28, borderRadius: 3, background: data.brandColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: theme.muted }}>
          <div style={{ fontWeight: 600, color: theme.ink, fontSize: 9, marginBottom: 1 }}>{(data.headline || 'Brand').split(' ').slice(0, 3).join(' ')}</div>
        </div>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 13, fontWeight: 500, color: theme.ink, lineHeight: 1.22, marginBottom: 4 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: theme.muted, lineHeight: 1.5, marginBottom: 8 }}>{data.body || 'Body text'}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.06em', color: data.brandColor, fontWeight: 600, paddingTop: 8, borderTop: `1px dashed ${theme.line}` }}>{data.ctaText || 'CTA'}</div>
    </div>
  )
}

function BookmarkLightPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ position: 'relative', background: '#FFFCEE', color: '#1A140C', padding: '16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.04)', transform: 'rotate(-0.2deg)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%) rotate(2deg)', width: 52, height: 13, background: 'rgba(255,180,120,0.72)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 6px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      {data.logoUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 3, background: data.brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={22} height={22} style={{ objectFit: 'contain' }} />
          </div>
        </div>
      )}
      <div style={{ fontFamily: 'serif', fontSize: 14, fontWeight: 500, color: '#1A140C', lineHeight: 1.22, marginBottom: 6 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: '#3A2E22', lineHeight: 1.5, marginBottom: 10 }}>{data.body || 'Body text'}</div>
      <span style={{ display: 'inline-block', padding: '6px 12px', background: '#1A140C', color: '#FFFCEE', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function BookmarkDarkPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ position: 'relative', background: theme.paper, padding: '16px 16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.03)', transform: 'rotate(0.5deg)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%) rotate(2deg)', width: 48, height: 11, background: theme.tape, opacity: 0.75 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
        <span style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.18em', color: theme.muted, textTransform: 'uppercase', fontWeight: 600 }}>PATROCINADO</span>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 13, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 6 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5, marginBottom: 10 }}>{data.body || 'Body text'}</div>
      <span style={{ display: 'inline-block', padding: '5px 10px', border: `1px solid ${data.brandColor}`, color: data.brandColor, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function CodaPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '20px 20px 18px', border: `1px solid ${theme.line}`, borderTop: `3px solid ${data.brandColor}`, background: 'rgba(0,0,0,0.012)' }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 7px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'start' }}>
        {data.logoUrl && (
          <div style={{ padding: 10, background: 'rgba(0,0,0,0.025)', border: `1px solid ${theme.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 500, color: theme.ink, lineHeight: 1.15, marginBottom: 8 }}>{data.headline || 'Headline'}</div>
          <div style={{ fontFamily: 'serif', fontSize: 12, color: theme.ink, lineHeight: 1.55, opacity: 0.9, marginBottom: 14 }}>{data.body || 'Body text'}</div>
          <span style={{ display: 'inline-block', padding: '8px 14px', background: data.brandColor, color: '#FFF', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
        </div>
      </div>
    </div>
  )
}

function HorizontalAnchorPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ background: theme.bg, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}`, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16, borderRight: `1px dashed ${theme.line}` }}>
        {data.logoUrl && (
          <div style={{ width: 28, height: 28, borderRadius: 3, background: data.brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={data.logoUrl} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.18em', color: theme.muted, textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
            AD
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 600, color: theme.ink }}>{(data.headline || 'Brand').split(' ').slice(0, 3).join(' ')}</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'serif', fontSize: 14, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 3 }}>{data.headline || 'Headline'}</div>
        <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5 }}>{data.body || 'Body text'}</div>
      </div>
      <span style={{ padding: '6px 10px', border: `1px solid ${data.brandColor}`, color: data.brandColor, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function MarginaliaPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ maxWidth: 500, padding: '14px 18px', background: theme.paper2, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
        <span style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.16em', color: theme.muted, textTransform: 'uppercase', fontWeight: 700 }}>PATROCINADO</span>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 12, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 4 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5, marginBottom: 8 }}>{data.body || 'Body text'}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.06em', color: data.brandColor, fontWeight: 600 }}>{data.ctaText || 'CTA'} →</div>
    </div>
  )
}

function BowtiePreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '20px 20px 18px', background: theme.paper, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}` }}>
      <div style={{ fontFamily: 'cursive', fontSize: 20, fontWeight: 600, color: theme.ink, lineHeight: 1.15, marginBottom: 6 }}>{data.headline || 'Receba o próximo ensaio antes de virar público'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: theme.muted, lineHeight: 1.5, marginBottom: 14, maxWidth: 400 }}>{data.body || 'Uma vez por semana, direto no email.'}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '8px 10px', fontSize: 11, border: `1px solid ${theme.faint}`, background: theme.bg, color: theme.muted, fontFamily: 'sans-serif' }}>voce@email.com</div>
        <span style={{ padding: '8px 14px', background: data.brandColor || theme.accent, color: theme.bg, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{data.ctaText || 'ASSINAR'}</span>
      </div>
    </div>
  )
}

const PREVIEW_MAP: Record<string, { component: React.FC<{ data: PreviewData }>; label: string; device: string }> = {
  'post:top:banner':           { component: DoormanPreview,          label: 'DoormanAd',        device: 'desktop full-width' },
  'post:rail:anchor-left':     { component: AnchorPreview,           label: 'MarginaliaAd',     device: 'sidebar 160px' },
  'post:rail:anchor':          { component: AnchorPreview,           label: 'AnchorAd',         device: 'sidebar 300px' },
  'post:body:bookmark':        { component: BookmarkLightPreview,    label: 'BookmarkAd',       device: 'inline 540px' },
  'post:footer:coda':          { component: CodaPreview,             label: 'CodaAd',           device: 'full-width' },
  'archive:top:doorman':       { component: DoormanPreview,          label: 'DoormanAd',        device: 'desktop full-width' },
  'archive:break:anchor':      { component: HorizontalAnchorPreview, label: 'HorizontalAnchor', device: '3-col grid break' },
  'archive:grid:bookmark':     { component: BookmarkDarkPreview,     label: 'BookmarkAd (dark)',device: 'grid card' },
  'archive:footer:marginalia': { component: MarginaliaPreview,       label: 'MarginaliaAd',     device: 'max-w 720' },
  'archive:footer:bowtie':     { component: BowtiePreview,           label: 'BowtieAd',         device: 'full-width' },
}

export function SlotPreview({ slotKey, data }: SlotPreviewProps) {
  const config = PREVIEW_MAP[slotKey]
  if (!config) return <div style={{ color: '#666', fontSize: 12 }}>No preview available</div>

  const { component: Component, label, device } = config

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Preview — {label}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {device}
        </span>
      </div>
      <div
        className="overflow-hidden rounded-md border border-border"
        style={{ background: theme.bg, padding: 16 }}
      >
        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.6%' }}>
          <Component data={data} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/_components/slot-preview.tsx
git commit -m "feat(ads): create SlotPreview with format-accurate previews for all 10 ad formats"
```

---

### Task 10: Create `SlotForm` component — per-format edit form

**Files:**
- Create: `apps/web/src/app/admin/(authed)/ads/_components/slot-form.tsx`

- [ ] **Step 1: Create the SlotForm component**

Create `apps/web/src/app/admin/(authed)/ads/_components/slot-form.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'

interface SlotFormData {
  isEnabled: boolean
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string
  brandColor: string
  logoUrl: string
  dismissAfterMs: number
}

interface SlotFormProps {
  slotKey: string
  initial: SlotFormData
  onSave: (slotId: string, data: Partial<SlotFormData>) => Promise<void>
  onChange: (data: SlotFormData) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary'

export function SlotForm({ slotKey, initial, onSave, onChange }: SlotFormProps) {
  const [form, setForm] = useState<SlotFormData>(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function update(patch: Partial<SlotFormData>) {
    const next = { ...form, ...patch }
    setForm(next)
    onChange(next)
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(slotKey, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  const format = slotKey.split(':')[2] ?? ''

  const showBody = format !== 'banner'
  const showLogo = !['banner', 'bowtie'].includes(format)
  const showDismiss = ['banner', 'bookmark', 'coda'].includes(format)
  const showImage = false

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => update({ isEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-border"
          />
          Habilitado
        </label>
      </div>

      <Field label="Título / Headline">
        <input
          type="text"
          value={form.headline}
          onChange={(e) => update({ headline: e.target.value })}
          className={inputClass}
          placeholder="Anuncie aqui"
        />
      </Field>

      {showBody && (
        <Field label="Corpo">
          <textarea
            value={form.body}
            onChange={(e) => update({ body: e.target.value })}
            className={`${inputClass} resize-none`}
            rows={2}
            placeholder="Alcance nossos leitores."
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Texto do CTA">
          <input
            type="text"
            value={form.ctaText}
            onChange={(e) => update({ ctaText: e.target.value })}
            className={inputClass}
            placeholder="Saiba mais"
          />
        </Field>
        <Field label="URL do CTA">
          <input
            type="text"
            value={form.ctaUrl}
            onChange={(e) => update({ ctaUrl: e.target.value })}
            className={inputClass}
            placeholder="/anuncie"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor da marca">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.brandColor}
              onChange={(e) => update({ brandColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border border-border"
              title={form.brandColor}
            />
            <input
              type="text"
              value={form.brandColor}
              onChange={(e) => update({ brandColor: e.target.value })}
              className={`${inputClass} flex-1`}
              placeholder="#f97316"
            />
          </div>
        </Field>

        {showLogo && (
          <Field label="URL do logo">
            <input
              type="text"
              value={form.logoUrl}
              onChange={(e) => update({ logoUrl: e.target.value })}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        )}
      </div>

      {showImage && (
        <Field label="URL da imagem">
          <input
            type="text"
            value={form.imageUrl}
            onChange={(e) => update({ imageUrl: e.target.value })}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>
      )}

      {showDismiss && (
        <Field label="Auto-dismiss (ms, 0 = desabilitado)">
          <input
            type="number"
            value={form.dismissAfterMs}
            onChange={(e) => update({ dismissAfterMs: Number(e.target.value) || 0 })}
            className={inputClass}
            min={0}
            step={1000}
          />
        </Field>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
        {saved && (
          <span className="text-xs text-green-600">Salvo com sucesso</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/_components/slot-form.tsx
git commit -m "feat(ads): create SlotForm with format-adaptive fields"
```

---

### Task 11: Create `PlaceholderAccordion` component

**Files:**
- Create: `apps/web/src/app/admin/(authed)/ads/_components/placeholder-accordion.tsx`

- [ ] **Step 1: Create the PlaceholderAccordion component**

Create `apps/web/src/app/admin/(authed)/ads/_components/placeholder-accordion.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { AD_AREAS, getSlotsByArea, type AdSlotDefinition } from '@app/shared'
import { SlotForm } from './slot-form'
import { SlotPreview } from './slot-preview'

interface PlaceholderRow {
  slot_id: string
  is_enabled: boolean
  headline: string | null
  body: string | null
  cta_text: string | null
  cta_url: string | null
  image_url: string | null
  brand_color: string | null
  logo_url: string | null
  dismiss_after_ms: number | null
  updated_at: string | null
}

interface SlotConfigRow {
  slot_key: string
  zone: string
  iab_size: string | null
  mobile_behavior: string
  accepted_types: string[]
  label: string
}

interface PlaceholderAccordionProps {
  placeholders: PlaceholderRow[]
  slotConfigs: SlotConfigRow[]
  onSave: (slotId: string, data: Record<string, unknown>) => Promise<void>
}

const ZONE_COLORS: Record<string, string> = {
  banner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  rail: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  inline: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  block: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
}

const MOBILE_LABELS: Record<string, string> = {
  keep: 'mobile: mantém',
  hide: 'mobile: oculta',
  stack: 'mobile: empilha',
}

function Badge({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className ?? 'bg-muted text-muted-foreground'}`}>
      {text}
    </span>
  )
}

export function PlaceholderAccordion({ placeholders, slotConfigs, onSave }: PlaceholderAccordionProps) {
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const area of AD_AREAS) {
      if (getSlotsByArea(area.key).length > 0) {
        initial.add(area.key)
      }
    }
    return initial
  })
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set())
  const [previewState, setPreviewState] = useState<Record<string, {
    headline: string
    body: string
    ctaText: string
    ctaUrl: string
    brandColor: string
    logoUrl: string | null
    imageUrl: string | null
  }>>({})

  const placeholderMap = new Map(placeholders.map((p) => [p.slot_id, p]))
  const configMap = new Map(slotConfigs.map((c) => [c.slot_key, c]))

  const toggleArea = useCallback((key: string) => {
    setExpandedAreas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const toggleSlot = useCallback((key: string) => {
    setExpandedSlots((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  function getPreviewData(slot: AdSlotDefinition) {
    if (previewState[slot.key]) return previewState[slot.key]
    const ph = placeholderMap.get(slot.key)
    return {
      headline: ph?.headline ?? 'Anuncie aqui',
      body: ph?.body ?? 'Alcance nossos leitores.',
      ctaText: ph?.cta_text ?? 'Saiba mais',
      ctaUrl: ph?.cta_url ?? '/anuncie',
      brandColor: ph?.brand_color ?? '#6B7280',
      logoUrl: ph?.logo_url ?? null,
      imageUrl: ph?.image_url ?? null,
    }
  }

  const areasWithSlots = AD_AREAS.filter((a) => getSlotsByArea(a.key).length > 0)
  const futureAreas = AD_AREAS.filter((a) => getSlotsByArea(a.key).length === 0)

  return (
    <div className="space-y-4">
      {areasWithSlots.map((area) => {
        const slots = getSlotsByArea(area.key)
        const isExpanded = expandedAreas.has(area.key)

        return (
          <div key={area.key} className="overflow-hidden rounded-lg border border-border">
            <button
              type="button"
              role="button"
              aria-expanded={isExpanded}
              onClick={() => toggleArea(area.key)}
              className="flex w-full items-center justify-between bg-muted/50 px-4 py-3 text-left transition-colors hover:bg-muted"
              tabIndex={0}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold">{area.label}</span>
                <Badge text={`${slots.length} slots`} />
                <Badge text={`${area.key}:*`} className="bg-primary/10 text-primary" />
                <span className="text-xs text-muted-foreground">{area.route}</span>
              </div>
              <svg
                className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isExpanded && (
              <div role="region" aria-label={`${area.label} slots`} className="divide-y divide-border">
                {slots.map((slot) => {
                  const ph = placeholderMap.get(slot.key)
                  const cfg = configMap.get(slot.key)
                  const isSlotExpanded = expandedSlots.has(slot.key)
                  const isEnabled = ph?.is_enabled ?? false

                  return (
                    <div key={slot.key}>
                      <button
                        type="button"
                        role="button"
                        aria-expanded={isSlotExpanded}
                        onClick={() => toggleSlot(slot.key)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
                        tabIndex={0}
                      >
                        <span className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className="min-w-[200px] font-mono text-xs">{slot.key}</span>
                        <Badge text={slot.zone} className={ZONE_COLORS[slot.zone]} />
                        {slot.iabSize && <Badge text={slot.iabSize} />}
                        <Badge
                          text={slot.acceptedAdTypes.join(', ')}
                          className="bg-muted text-muted-foreground"
                        />
                        <Badge
                          text={MOBILE_LABELS[slot.mobileBehavior] ?? slot.mobileBehavior}
                          className={
                            slot.mobileBehavior === 'hide'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : slot.mobileBehavior === 'stack'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-muted text-muted-foreground'
                          }
                        />
                        {ph?.updated_at && (
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {new Date(ph.updated_at).toLocaleDateString('pt-BR')}
                          </span>
                        )}
                        <svg
                          className={`ml-2 h-3 w-3 text-muted-foreground transition-transform ${isSlotExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isSlotExpanded && (
                        <div className="grid grid-cols-2 gap-6 border-t border-border bg-background px-4 py-4">
                          <SlotForm
                            slotKey={slot.key}
                            initial={{
                              isEnabled: ph?.is_enabled ?? false,
                              headline: ph?.headline ?? '',
                              body: ph?.body ?? '',
                              ctaText: ph?.cta_text ?? '',
                              ctaUrl: ph?.cta_url ?? '',
                              imageUrl: ph?.image_url ?? '',
                              brandColor: ph?.brand_color ?? '#6B7280',
                              logoUrl: ph?.logo_url ?? '',
                              dismissAfterMs: ph?.dismiss_after_ms ?? 0,
                            }}
                            onSave={onSave}
                            onChange={(data) => {
                              setPreviewState((prev) => ({
                                ...prev,
                                [slot.key]: {
                                  headline: data.headline,
                                  body: data.body,
                                  ctaText: data.ctaText,
                                  ctaUrl: data.ctaUrl,
                                  brandColor: data.brandColor,
                                  logoUrl: data.logoUrl || null,
                                  imageUrl: data.imageUrl || null,
                                },
                              }))
                            }}
                          />
                          <SlotPreview
                            slotKey={slot.key}
                            data={getPreviewData(slot)}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {futureAreas.map((area) => (
        <div
          key={area.key}
          className="flex items-center justify-between rounded-lg border-2 border-dashed border-border px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">{area.label}</span>
            <Badge text="0 slots" />
            <span className="text-xs text-muted-foreground">{area.route}</span>
          </div>
          <button
            type="button"
            disabled
            className="cursor-not-allowed text-xs text-muted-foreground/50"
          >
            + Adicionar slot
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/_components/placeholder-accordion.tsx
git commit -m "feat(ads): create PlaceholderAccordion with area grouping and expand/collapse"
```

---

### Task 12: Wire `PlaceholderAccordion` into admin page

**Files:**
- Modify: `apps/web/src/app/admin/(authed)/ads/page.tsx`

- [ ] **Step 1: Update imports**

In `apps/web/src/app/admin/(authed)/ads/page.tsx`:

Remove `PlaceholderManager` from the client import (line 21):

```typescript
import { InquiriesList } from '@tn-figueiredo/ad-engine-admin/client'
```

Add the new import after line 22:

```typescript
import { PlaceholderAccordion } from './_components/placeholder-accordion'
```

- [ ] **Step 2: Update data fetching — add `ad_slot_config` query**

In the `Promise.allSettled` array (lines 60-71), change line 67 from fetching only placeholders to fetching both. Replace:

```typescript
      tab === 'placeholders' ? fetchAdPlaceholders(supabase, AD_APP_ID) : Promise.resolve(null),
```

With:

```typescript
      tab === 'placeholders' ? fetchAdPlaceholders(supabase, AD_APP_ID) : Promise.resolve(null),
```

(Keep the placeholder fetch as-is — we'll add a separate parallel query.)

After line 71, we need to also fetch `ad_slot_config`. The simplest approach: add inline fetch inside the placeholders tab render block. But for cleaner code, add to Promise.allSettled. Since the array already has 9 entries, add a 10th:

After the `inquiries` entry, add a new fetch for slot configs. Update the `Promise.allSettled` to include:

```typescript
      tab === 'placeholders' ? supabase.from('ad_slot_config').select('slot_key, zone, iab_size, mobile_behavior, accepted_types, label').then(r => r.data) : Promise.resolve(null),
```

Update the destructuring to include the new result and extract the data:

```typescript
  const slotConfigsResult = /* 10th element from allSettled */
  const slotConfigs = slotConfigsResult.status === 'fulfilled' ? (slotConfigsResult.value ?? []) : []
```

- [ ] **Step 3: Replace PlaceholderManager with PlaceholderAccordion**

Replace lines 152-154:

```typescript
        {tab === 'placeholders' && (
          <PlaceholderManager placeholders={placeholders} />
        )}
```

With:

```typescript
        {tab === 'placeholders' && (
          <PlaceholderAccordion
            placeholders={placeholders}
            slotConfigs={slotConfigs}
            onSave={async (slotId, data) => {
              'use server'
              await updatePlaceholder(slotId, data)
            }}
          />
        )}
```

Wait — server actions can't be defined inline in server components and passed as callbacks to client components without `use server`. Since `updatePlaceholder` is already a server action, we can pass it directly:

```typescript
        {tab === 'placeholders' && (
          <PlaceholderAccordion
            placeholders={placeholders}
            slotConfigs={slotConfigs}
            onSave={updatePlaceholder}
          />
        )}
```

- [ ] **Step 4: Update placeholder query to include brand_color and logo_url**

If `fetchAdPlaceholders` from `@tn-figueiredo/ad-engine-admin` doesn't return `brand_color`/`logo_url`, we need to replace it with a direct query. Change line 67:

```typescript
      tab === 'placeholders' ? supabase.from('ad_placeholders').select('slot_id, is_enabled, headline, body, cta_text, cta_url, image_url, brand_color, logo_url, dismiss_after_ms, updated_at').eq('app_id', AD_APP_ID).then(r => r.data ?? []) : Promise.resolve(null),
```

- [ ] **Step 5: Verify the full page still compiles**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | head -30`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/page.tsx
git commit -m "feat(ads): wire PlaceholderAccordion into admin ads page, fetch slot configs"
```

---

### Task 13: Update existing tests + run full suite

**Files:**
- Test: all existing test files

- [ ] **Step 1: Run full test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web -- --reporter=verbose 2>&1 | tail -40`
Expected: All tests pass. If any test fails due to old slot keys, update them.

- [ ] **Step 2: Check for remaining old key references**

Run: `grep -rn 'banner_top\|rail_left\|rail_right\|inline_mid\|block_bottom' apps/web/src/ packages/shared/src/ --include='*.ts' --include='*.tsx' | grep -v node_modules | grep -v '.test.'`
Expected: No output (only test files may reference old keys in comments)

- [ ] **Step 3: Run TypeScript check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Final commit if any test fixes were needed**

```bash
git add -A
git commit -m "fix(ads): update remaining tests for post:*/archive:* slot key namespace"
```

---

## Dependency Graph

```
Task 1 (shared package) ─┬─→ Task 2 (resolve.ts)
                          ├─→ Task 3 (blog post page)
                          ├─→ Task 4 (adsense sync)
                          └─→ Task 9 (SlotPreview)

Task 5 (updatePlaceholder action) ─→ Task 12 (wire accordion)

Task 6 (migration 1) ──→ Task 7 (migration 2) ──→ Task 8 (migration 3)

Task 9 (SlotPreview) ──┐
Task 10 (SlotForm) ────┼─→ Task 11 (PlaceholderAccordion) ──→ Task 12 (wire accordion)

Task 12 ──→ Task 13 (final test suite)
```

**Parallelizable groups:**
- **Wave 1:** Tasks 1, 6 (independent: shared package + first migration)
- **Wave 2:** Tasks 2, 3, 4, 5, 7, 9, 10 (all depend on Task 1 completing; 7 depends on 6)
- **Wave 3:** Tasks 8, 11 (8 depends on 7; 11 depends on 9+10)
- **Wave 4:** Task 12 (depends on 5+11)
- **Wave 5:** Task 13 (final validation)
