# Ad Slot Naming & Admin–Frontend Connection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the disconnected admin ad system and hardcoded frontend ad components via position-based slot naming, DB-driven resolution, and live preview components.

**Architecture:** 3 DB migrations rename slot keys + add locale/brand/interaction columns + seed 6 campaigns. `SITE_AD_SLOTS` updated with 6 position-based keys. 6 frontend components refactored from `AdProps` to `AdSlotProps` (receiving `AdCreativeData`). Blog post page switches from hardcoded data to `resolveSlots()` SSR. 6 preview components added for admin. Layout utilities relocated to `lib/blog/content-layout.ts`.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL), TypeScript 5, `@tn-figueiredo/ad-engine`, Vitest

---

## File Structure

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260501000025_rename_ad_slot_keys.sql` | Create | Migration 1: rename slot keys across 5 tables |
| `supabase/migrations/20260501000026_ad_campaigns_brand_locale_interaction.sql` | Create | Migration 2: add brand_color, logo_url, locale, interaction columns |
| `supabase/migrations/20260501000027_seed_initial_ad_campaigns.sql` | Create | Migration 3: seed 6 campaigns with bilingual creatives |
| `apps/web/public/ads/logos/railway-ghost.svg` | Create | Extracted SVG logo |
| `apps/web/public/ads/logos/ensaios-obsidian.svg` | Create | Extracted SVG logo |
| `apps/web/public/ads/logos/mailpond.svg` | Create | Extracted SVG logo |
| `apps/web/public/ads/logos/caderno-de-campo.svg` | Create | Extracted SVG logo |
| `apps/web/public/ads/logos/youtube.svg` | Create | Extracted SVG logo |
| `apps/web/public/ads/logos/related-post.svg` | Create | Extracted SVG logo |
| `packages/shared/src/config/ad-slots.ts` | Modify | Update SITE_AD_SLOTS with 6 new slot keys + zone/mobileBehavior/acceptedAdTypes |
| `apps/web/src/lib/blog/content-layout.ts` | Create | Relocated computeInlineAdIndex + computeMobileInlineIndex |
| `apps/web/src/components/blog/ads/types.ts` | Rewrite | AdSlotProps + re-export AdCreativeData |
| `apps/web/src/components/blog/ads/ad-label.tsx` | Rewrite | adLabel(type, locale) helper replacing old AdLabel component |
| `apps/web/src/components/blog/ads/use-dismissable.ts` | Modify | Accept AdCreativeData, use slotKey_campaignId dismiss key |
| `apps/web/src/components/blog/ads/marginalia-ad.tsx` | Modify | Refactor to AdSlotProps |
| `apps/web/src/components/blog/ads/anchor-ad.tsx` | Modify | Refactor to AdSlotProps |
| `apps/web/src/components/blog/ads/bookmark-ad.tsx` | Modify | Refactor to AdSlotProps |
| `apps/web/src/components/blog/ads/coda-ad.tsx` | Modify | Refactor to AdSlotProps |
| `apps/web/src/components/blog/ads/doorman-ad.tsx` | Modify | Refactor to AdSlotProps |
| `apps/web/src/components/blog/ads/bowtie-ad.tsx` | Modify | Refactor to AdSlotProps, interaction field |
| `apps/web/src/components/blog/ads/index.ts` | Rewrite | Clean barrel export |
| `apps/web/src/components/blog/ads/ad-data.ts` | Delete | Data moves to DB |
| `apps/web/src/components/blog/ads/ad-utils.ts` | Delete | Layout fns relocated, selection fns removed |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Modify | Switch from hardcoded to resolveSlots() SSR |
| `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` | Modify | Add brand_color, logo_url, locale, interaction + revalidateTag |
| `apps/web/test/components/blog/ads.test.tsx` | Rewrite | Remove old tests, add new AdSlotProps-based tests |
| `apps/web/test/lib/blog/content-layout.test.ts` | Create | Migrated layout utility tests |

---

### Task 1: Extract SVG Logos to Public Assets

**Files:**
- Create: `apps/web/public/ads/logos/railway-ghost.svg`
- Create: `apps/web/public/ads/logos/ensaios-obsidian.svg`
- Create: `apps/web/public/ads/logos/mailpond.svg`
- Create: `apps/web/public/ads/logos/caderno-de-campo.svg`
- Create: `apps/web/public/ads/logos/youtube.svg`
- Create: `apps/web/public/ads/logos/related-post.svg`
- Reference: `apps/web/src/components/blog/ads/ad-data.ts` (source of SVG marks)

- [ ] **Step 1: Create the logos directory**

```bash
mkdir -p apps/web/public/ads/logos
```

- [ ] **Step 2: Extract Railway Ghost SVG**

Create `apps/web/public/ads/logos/railway-ghost.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="34" height="34" rx="6" fill="#7B5BF7"/>
  <path d="M 12 14 L 12 26 L 28 26 L 28 14 Z" fill="none" stroke="#FFF" stroke-width="2"/>
  <circle cx="16" cy="20" r="1.5" fill="#FFF"/>
  <circle cx="20" cy="20" r="1.5" fill="#FFF"/>
  <circle cx="24" cy="20" r="1.5" fill="#FFF"/>
</svg>
```

- [ ] **Step 3: Extract Ensaios de Obsidian SVG**

Create `apps/web/public/ads/logos/ensaios-obsidian.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="3" width="28" height="34" rx="1" fill="#3B5A4A"/>
  <rect x="6" y="3" width="3" height="34" fill="#2A4337"/>
  <line x1="14" y1="11" x2="29" y2="11" stroke="#D4C4A0" stroke-width="0.6"/>
  <line x1="14" y1="14" x2="29" y2="14" stroke="#D4C4A0" stroke-width="0.6"/>
  <line x1="14" y1="17" x2="25" y2="17" stroke="#D4C4A0" stroke-width="0.6"/>
  <text x="14" y="29" fill="#D4C4A0" font-family="Georgia, serif" font-size="6" font-style="italic">obsidian</text>
</svg>
```

- [ ] **Step 4: Extract Mailpond SVG**

Create `apps/web/public/ads/logos/mailpond.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="3" width="34" height="34" rx="6" fill="#D4724B"/>
  <path d="M 8 14 L 20 24 L 32 14" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M 8 14 L 8 28 L 32 28 L 32 14" stroke="#FFF" stroke-width="2" fill="none" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 5: Extract Caderno de Campo SVG**

Create `apps/web/public/ads/logos/caderno-de-campo.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="6" y="9" width="28" height="22" rx="1" fill="#FF8240"/>
  <path d="M 6 9 L 20 21 L 34 9" stroke="#1A140C" stroke-width="1.6" fill="none"/>
  <rect x="6" y="9" width="28" height="22" rx="1" fill="none" stroke="#1A140C" stroke-width="1.4"/>
</svg>
```

- [ ] **Step 6: Extract YouTube SVG**

Create `apps/web/public/ads/logos/youtube.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="9" width="34" height="22" rx="4" fill="#C44B3D"/>
  <path d="M 17 16 L 25 20 L 17 24 Z" fill="#FFF"/>
</svg>
```

- [ ] **Step 7: Extract Related Post SVG**

Create `apps/web/public/ads/logos/related-post.svg`:

```svg
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="6" width="24" height="28" fill="#7A8A4D"/>
  <path d="M 13 14 L 27 14 M 13 19 L 27 19 M 13 24 L 22 24" stroke="#FFFCEE" stroke-width="1.6" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 8: Verify all 6 SVGs exist**

Run: `ls -la apps/web/public/ads/logos/`
Expected: 6 SVG files

- [ ] **Step 9: Commit**

```bash
git add apps/web/public/ads/logos/
git commit -m "feat(ads): extract SVG logos to public assets"
```

---

### Task 2: Create Content Layout Utilities (Relocated from ad-utils)

**Files:**
- Create: `apps/web/src/lib/blog/content-layout.ts`
- Create: `apps/web/test/lib/blog/content-layout.test.ts`

- [ ] **Step 1: Write the test file**

Create `apps/web/test/lib/blog/content-layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  computeInlineAdIndex,
  computeMobileInlineIndex,
} from '../../../src/lib/blog/content-layout'

describe('computeInlineAdIndex', () => {
  it('places before 2nd h2 when >=2 h2s exist', () => {
    const idx = computeInlineAdIndex(20, [3, 10])
    expect(idx).toBe(9)
  })

  it('places before 2nd h2 when 3+ h2s exist', () => {
    const idx = computeInlineAdIndex(30, [4, 12, 20])
    expect(idx).toBe(11)
  })

  it('places ~60% after single h2', () => {
    const idx = computeInlineAdIndex(20, [5])
    expect(idx).toBe(14)
  })

  it('places ~55% through body when no h2s', () => {
    const idx = computeInlineAdIndex(20, [])
    expect(idx).toBe(11)
  })

  it('caps single-h2 placement at bodyBlockCount - 2', () => {
    const idx = computeInlineAdIndex(10, [1])
    expect(idx).toBe(6)
  })
})

describe('computeMobileInlineIndex', () => {
  it('places before last h2 when >=2 h2s exist', () => {
    const idx = computeMobileInlineIndex(20, [3, 15])
    expect(idx).toBe(14)
  })

  it('places at ~70% when fewer than 2 h2s', () => {
    const idx = computeMobileInlineIndex(20, [5])
    expect(idx).toBe(14)
  })

  it('places at ~70% when no h2s', () => {
    const idx = computeMobileInlineIndex(30, [])
    expect(idx).toBe(21)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/blog/content-layout.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the implementation**

Create `apps/web/src/lib/blog/content-layout.ts`:

```typescript
export function computeInlineAdIndex(
  bodyBlockCount: number,
  h2Indices: number[],
): number {
  if (h2Indices.length >= 2) {
    return h2Indices[1]! - 1
  } else if (h2Indices.length === 1) {
    return Math.min(
      bodyBlockCount - 2,
      h2Indices[0]! + Math.floor((bodyBlockCount - h2Indices[0]!) * 0.6),
    )
  }
  return Math.floor(bodyBlockCount * 0.55)
}

export function computeMobileInlineIndex(
  bodyBlockCount: number,
  h2Indices: number[],
): number {
  if (h2Indices.length >= 2) {
    return h2Indices[h2Indices.length - 1]! - 1
  }
  return Math.floor(bodyBlockCount * 0.7)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/blog/content-layout.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/blog/content-layout.ts apps/web/test/lib/blog/content-layout.test.ts
git commit -m "feat(ads): relocate layout utilities to lib/blog/content-layout"
```

---

### Task 3: DB Migration 1 — Rename Ad Slot Keys

**Files:**
- Create: `supabase/migrations/20260501000025_rename_ad_slot_keys.sql`

- [ ] **Step 1: Create migration file**

Run: `npx supabase migration new rename_ad_slot_keys`

- [ ] **Step 2: Write the migration SQL**

Edit the generated file to contain:

```sql
-- Migration 1: Rename ad slot keys from generic to position-based names.
-- Renames across 5 tables + seeds 2 new slots (rail_left, inline_end).

-- 1. ad_slot_creatives
UPDATE ad_slot_creatives SET slot_key = 'banner_top' WHERE slot_key = 'article_top';
UPDATE ad_slot_creatives SET slot_key = 'inline_mid' WHERE slot_key = 'article_between_paras';
UPDATE ad_slot_creatives SET slot_key = 'rail_right' WHERE slot_key = 'sidebar_right';
UPDATE ad_slot_creatives SET slot_key = 'block_bottom' WHERE slot_key = 'below_fold';

-- 2. ad_slot_metrics
UPDATE ad_slot_metrics SET slot_key = 'banner_top' WHERE slot_key = 'article_top';
UPDATE ad_slot_metrics SET slot_key = 'inline_mid' WHERE slot_key = 'article_between_paras';
UPDATE ad_slot_metrics SET slot_key = 'rail_right' WHERE slot_key = 'sidebar_right';
UPDATE ad_slot_metrics SET slot_key = 'block_bottom' WHERE slot_key = 'below_fold';

-- 3. ad_events (historical data unified under new names)
UPDATE ad_events SET slot_id = 'banner_top' WHERE slot_id = 'article_top';
UPDATE ad_events SET slot_id = 'inline_mid' WHERE slot_id = 'article_between_paras';
UPDATE ad_events SET slot_id = 'rail_right' WHERE slot_id = 'sidebar_right';
UPDATE ad_events SET slot_id = 'block_bottom' WHERE slot_id = 'below_fold';

-- 4. ad_placeholders (PK = slot_id, can't UPDATE PK — insert new, delete old)
INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'banner_top', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'article_top'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'inline_mid', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'article_between_paras'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'rail_right', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'sidebar_right'
  ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled)
  SELECT 'block_bottom', headline, body, cta_text, cta_url, image_url, dismiss_after_ms, is_enabled
  FROM ad_placeholders WHERE slot_id = 'below_fold'
  ON CONFLICT (slot_id) DO NOTHING;

DELETE FROM ad_placeholders WHERE slot_id IN ('article_top', 'article_between_paras', 'sidebar_right', 'below_fold');

-- Seed new slots (disabled placeholders)
INSERT INTO ad_placeholders (slot_id, headline, body, cta_text, cta_url, dismiss_after_ms, is_enabled)
VALUES
  ('rail_left', '', '', '', '', 0, false),
  ('inline_end', '', '', '', '', 0, false)
ON CONFLICT (slot_id) DO NOTHING;

-- 5. kill_switches (PK = id — same insert/delete pattern)
INSERT INTO kill_switches (id, enabled, description)
  SELECT 'ads_slot_banner_top', enabled, description
  FROM kill_switches WHERE id = 'ads_slot_article_top'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, description)
  SELECT 'ads_slot_inline_mid', enabled, description
  FROM kill_switches WHERE id = 'ads_slot_article_between_paras'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, description)
  SELECT 'ads_slot_rail_right', enabled, description
  FROM kill_switches WHERE id = 'ads_slot_sidebar_right'
  ON CONFLICT (id) DO NOTHING;

INSERT INTO kill_switches (id, enabled, description)
  SELECT 'ads_slot_block_bottom', enabled, description
  FROM kill_switches WHERE id = 'ads_slot_below_fold'
  ON CONFLICT (id) DO NOTHING;

DELETE FROM kill_switches WHERE id IN ('ads_slot_article_top', 'ads_slot_article_between_paras', 'ads_slot_sidebar_right', 'ads_slot_below_fold');

-- Seed new slot kill switches (enabled by default)
INSERT INTO kill_switches (id, enabled, description)
VALUES
  ('ads_slot_rail_left', true, 'Kill switch for rail_left ad slot'),
  ('ads_slot_inline_end', true, 'Kill switch for inline_end ad slot')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(ads): migration 1 — rename slot keys to position-based names"
```

---

### Task 4: DB Migration 2 — Brand, Locale, Interaction Columns

**Files:**
- Create: `supabase/migrations/20260501000026_ad_campaigns_brand_locale_interaction.sql`

- [ ] **Step 1: Create migration file**

Run: `npx supabase migration new ad_campaigns_brand_locale_interaction`

- [ ] **Step 2: Write the migration SQL**

```sql
-- Migration 2: Add brand identity, locale, and interaction type columns.

-- Brand identity on campaigns
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS brand_color TEXT NOT NULL DEFAULT '#6B7280';
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Locale support on creatives
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'pt-BR';

-- Unique constraint for campaign+slot+locale combination
ALTER TABLE ad_slot_creatives ADD CONSTRAINT ad_slot_creatives_campaign_slot_locale_unique
  UNIQUE (campaign_id, slot_key, locale);

-- Interaction type on creatives (link = regular CTA, form = inline email capture)
ALTER TABLE ad_slot_creatives ADD COLUMN IF NOT EXISTS interaction TEXT NOT NULL DEFAULT 'link';
ALTER TABLE ad_slot_creatives ADD CONSTRAINT ad_slot_creatives_interaction_check
  CHECK (interaction IN ('link', 'form'));
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(ads): migration 2 — brand_color, logo_url, locale, interaction columns"
```

---

### Task 5: DB Migration 3 — Seed Initial Ad Campaigns

**Files:**
- Create: `supabase/migrations/20260501000027_seed_initial_ad_campaigns.sql`

- [ ] **Step 1: Create migration file**

Run: `npx supabase migration new seed_initial_ad_campaigns`

- [ ] **Step 2: Write the migration SQL**

Use deterministic UUIDs via `uuid_generate_v5` for idempotency:

```sql
-- Migration 3: Seed 6 initial ad campaigns with bilingual creatives.
-- Uses deterministic UUIDs for idempotent re-runs.

-- Namespace UUID for deterministic generation
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN CREATE EXTENSION "uuid-ossp"; END IF; END $$;

-- Use a fixed namespace for our ad seeds
-- Namespace: 6ba7b810-9dad-11d1-80b4-00c04fd430c8 (URL namespace from RFC 4122)

-- ==========================================
-- Campaign 1: Railway Ghost (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'),
  'Railway Ghost', 'Railway Ghost', 'native', 'active', 10,
  '#7B5BF7', '/ads/logos/railway-ghost.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

-- pt-BR creatives
INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'rail_right', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'inline_mid', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'block_bottom', 'pt-BR', 'Deploy sem stress, do dev ao prod', 'Hosting feito por dois desenvolvedores cansados de Heroku. Postgres, Redis, e um CLI que não te odeia. 14 dias grátis.', 'Conhecer o Railway Ghost →', '#sponsor-railway', 'link', 0)
ON CONFLICT DO NOTHING;

-- en creatives
INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'rail_right', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'inline_mid', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'railway-ghost'), 'block_bottom', 'en', 'Deploys that don''t keep you up at night', 'Hosting built by two devs tired of Heroku. Postgres, Redis, and a CLI that doesn''t hate you. 14 days free.', 'Try Railway Ghost →', '#sponsor-railway', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 2: Ensaios de Obsidian (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'),
  'Ensaios de Obsidian', 'Ensaios de Obsidian', 'native', 'active', 10,
  '#3B5A4A', '/ads/logos/ensaios-obsidian.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'rail_right', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'inline_mid', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'block_bottom', 'pt-BR', 'Um livro sobre escrever em público — sem performar', 'São 12 ensaios curtos sobre como manter uma prática de escrita honesta quando ninguém te paga pra escrever. Edição em português, lançada esse mês.', 'Comprar (R$ 39) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'rail_right', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'inline_mid', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'ensaios-obsidian'), 'block_bottom', 'en', 'A book about writing in public without performing', 'Twelve short essays on keeping an honest writing practice when nobody pays you to write. Portuguese edition, out this month.', 'Buy (US$ 9) →', '#sponsor-obsidian', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 3: Mailpond (CPA)
-- ==========================================
INSERT INTO ad_campaigns (id, name, advertiser, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'),
  'Mailpond', 'Mailpond', 'native', 'active', 10,
  '#D4724B', '/ads/logos/mailpond.svg', 'cpm', 'cpa'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'rail_right', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'inline_mid', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'block_bottom', 'pt-BR', 'A plataforma de newsletter pra escritores que valorizam tipografia', 'Source Serif, Söhne, sua própria fonte custom. Sem templates plásticos. Lista de 1.000 grátis pra sempre.', 'Migrar pra Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'rail_right', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'inline_mid', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'mailpond'), 'block_bottom', 'en', 'A newsletter platform for writers who care about typography', 'Source Serif, Söhne, your own custom font. No plastic templates. 1,000 subscribers free forever.', 'Move to Mailpond →', '#sponsor-mailpond', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 4: Caderno de Campo (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'),
  'Caderno de Campo', 'native', 'active', 5,
  '#FF8240', '/ads/logos/caderno-de-campo.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'inline_end', 'pt-BR', 'Receba o próximo ensaio antes de virar público', 'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam, sem afiliados.', 'Assinar a newsletter →', 'newsletters.html', 'form', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'rail_left', 'pt-BR', 'Receba o próximo ensaio antes de virar público', 'Uma carta a cada 15 dias, com o que estou escrevendo, lendo, e construindo. 1.247 leitores. Sem spam, sem afiliados.', 'Assinar a newsletter →', 'newsletters.html', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'inline_end', 'en', 'Get the next essay before it goes public', 'A letter every 15 days with what I''m writing, reading, and building. 1,247 readers. No spam, no affiliates.', 'Subscribe →', 'newsletters.html', 'form', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'caderno-de-campo'), 'rail_left', 'en', 'Get the next essay before it goes public', 'A letter every 15 days with what I''m writing, reading, and building. 1,247 readers. No spam, no affiliates.', 'Subscribe →', 'newsletters.html', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 5: Canal no YouTube (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'),
  'Canal no YouTube', 'native', 'active', 5,
  '#C44B3D', '/ads/logos/youtube.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'), 'rail_left', 'pt-BR', 'Vejo sua dúvida em vídeo — toda quinta', 'Vídeos curtos sobre o que estou construindo. Esta semana: como o CMS gerencia vários sites com um post só.', 'Ver no YouTube →', 'videos.html', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'canal-youtube'), 'rail_left', 'en', 'Your question, in video — every Thursday', 'Short videos about what I''m building. This week: how the CMS manages multiple sites with one post.', 'Watch on YouTube →', 'videos.html', 'link', 0)
ON CONFLICT DO NOTHING;

-- ==========================================
-- Campaign 6: Leitura relacionada (house)
-- ==========================================
INSERT INTO ad_campaigns (id, name, format, status, priority, brand_color, logo_url, pricing_model, type)
VALUES (
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'),
  'Leitura relacionada', 'native', 'active', 5,
  '#7A8A4D', '/ads/logos/related-post.svg', 'house_free', 'house'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO ad_slot_creatives (campaign_id, slot_key, locale, title, body, cta_text, cta_url, interaction, dismiss_seconds)
VALUES
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'), 'banner_top', 'pt-BR', 'Por que abandonei o Notion para escrever — e o que veio depois', 'Sobre fricção, atrito útil, e por que ferramentas "perfeitas" às vezes atrapalham. Ensaio de 12 minutos.', 'Ler o ensaio →', 'post.html?p=notion', 'link', 0),
  (uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, 'leitura-relacionada'), 'banner_top', 'en', 'Why I left Notion for writing — and what came next', 'On friction, useful resistance, and why "perfect" tools sometimes get in the way. A 12-minute essay.', 'Read the essay →', 'post.html?p=notion', 'link', 0)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(ads): migration 3 — seed 6 initial campaigns with bilingual creatives"
```

---

### Task 6: Update SITE_AD_SLOTS with Position-Based Keys

**Files:**
- Modify: `packages/shared/src/config/ad-slots.ts`

- [ ] **Step 1: Rewrite ad-slots.ts**

Replace the entire content of `packages/shared/src/config/ad-slots.ts`:

```typescript
import type { AdSlotDefinition } from '@tn-figueiredo/ad-engine'

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

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/shared && npx tsc --noEmit`
Expected: PASS (requires `@tn-figueiredo/ad-engine@0.3.0` with the new optional fields — if the package isn't published yet, this will fail on `zone`/`mobileBehavior`/`acceptedAdTypes`. In that case, temporarily cast or add a TODO and proceed.)

**Note:** If `@tn-figueiredo/ad-engine` doesn't have the new optional fields yet, add a `// @ts-expect-error — pending ad-engine@0.3.0` inline comment on each new field and commit. The package update will resolve this.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/config/ad-slots.ts
git commit -m "feat(ads): update SITE_AD_SLOTS with position-based keys"
```

---

### Task 7: Rewrite Ad Types (AdSlotProps + AdCreativeData)

**Files:**
- Modify: `apps/web/src/components/blog/ads/types.ts`

- [ ] **Step 1: Rewrite types.ts**

Replace entire content of `apps/web/src/components/blog/ads/types.ts`:

```typescript
export interface AdCreativeData {
  campaignId: string | null
  slotKey: string
  type: 'house' | 'cpa'
  source: 'campaign' | 'placeholder'
  interaction: 'link' | 'form'
  title: string
  body: string
  ctaText: string
  ctaUrl: string
  imageUrl: string | null
  logoUrl: string | null
  brandColor: string
  dismissSeconds: number
}

export interface AdSlotProps {
  creative: AdCreativeData
  locale: 'en' | 'pt-BR'
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/types.ts
git commit -m "feat(ads): rewrite ad types — AdSlotProps + AdCreativeData"
```

---

### Task 8: Rewrite AdLabel Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/ad-label.tsx`

- [ ] **Step 1: Rewrite ad-label.tsx**

Replace entire content of `apps/web/src/components/blog/ads/ad-label.tsx`:

```tsx
'use client'

export function adLabel(type: 'house' | 'cpa', locale: 'en' | 'pt-BR'): string {
  if (type === 'cpa') return locale === 'pt-BR' ? 'PATROCINADO' : 'SPONSORED'
  return locale === 'pt-BR' ? 'DA CASA' : 'HOUSE'
}

type AdLabelProps = {
  type: 'house' | 'cpa'
  locale: 'en' | 'pt-BR'
  brandColor: string
  color?: string
}

export function AdLabel({ type, locale, brandColor, color }: AdLabelProps) {
  return (
    <div
      className="font-jetbrains inline-flex items-center gap-1.5"
      style={{
        fontSize: 9,
        letterSpacing: '0.18em',
        color: color || 'var(--pb-muted)',
        textTransform: 'uppercase',
        fontWeight: 600,
      }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          background: brandColor,
        }}
      />
      {adLabel(type, locale)}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/ad-label.tsx
git commit -m "feat(ads): rewrite AdLabel to use type+locale instead of ad object"
```

---

### Task 9: Update useDismissable Hook

**Files:**
- Modify: `apps/web/src/components/blog/ads/use-dismissable.ts`

- [ ] **Step 1: Update use-dismissable.ts**

Replace entire content:

```typescript
'use client'

import { useState, useCallback } from 'react'
import type { AdCreativeData } from './types'

const DISMISS_KEY = 'btf_ads_dismissed'

function getDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function setDismissed(id: string): void {
  const d = getDismissed()
  d[id] = Date.now()
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(d))
  } catch {
    // localStorage may be full or unavailable
  }
}

function dismissKey(creative: AdCreativeData): string {
  return `${creative.slotKey}_${creative.campaignId ?? 'ph'}`
}

export function useDismissable(
  creative: AdCreativeData,
  onDismiss?: () => void,
): [dismissed: boolean, dismiss: () => void] {
  const key = dismissKey(creative)
  const [dismissed, setLocal] = useState(() => Boolean(getDismissed()[key]))

  const dismiss = useCallback(() => {
    setDismissed(key)
    setLocal(true)
    if (onDismiss) onDismiss()
  }, [key, onDismiss])

  return [dismissed, dismiss]
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/use-dismissable.ts
git commit -m "feat(ads): update useDismissable to use AdCreativeData dismiss keys"
```

---

### Task 10: Refactor MarginaliaAd Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/marginalia-ad.tsx`

- [ ] **Step 1: Rewrite marginalia-ad.tsx**

Replace entire content:

```tsx
'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { AdLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function MarginaliaAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  return (
    <div
      className="relative"
      style={{
        paddingTop: 16,
        marginTop: 16,
        borderTop: '1px dashed var(--pb-line)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-1.5">
        <AdLabel type={creative.type} locale={locale} brandColor={creative.brandColor} />
        <DismissButton
          onClick={dismiss}
          label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        />
      </div>

      <a href={creative.ctaUrl} className="block no-underline">
        <div
          className="font-fraunces mb-1.5"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--pb-ink)',
            lineHeight: 1.25,
            letterSpacing: '-0.005em',
          }}
        >
          {creative.title}
        </div>
        <div
          className="font-source-serif mb-2"
          style={{
            fontSize: 11,
            color: 'var(--pb-muted)',
            lineHeight: 1.45,
          }}
        >
          {creative.body.split('.')[0] + '.'}
        </div>
        <div
          className="font-jetbrains"
          style={{
            fontSize: 10,
            letterSpacing: '0.06em',
            color: creative.brandColor,
            fontWeight: 600,
          }}
        >
          {creative.ctaText}
        </div>
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/marginalia-ad.tsx
git commit -m "feat(ads): refactor MarginaliaAd to AdSlotProps"
```

---

### Task 11: Refactor AnchorAd Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/anchor-ad.tsx`

- [ ] **Step 1: Rewrite anchor-ad.tsx**

Replace entire content:

```tsx
'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function AnchorAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative"
      style={{
        padding: '14px 14px 16px',
        border: '1px solid var(--pb-line)',
        background: 'var(--pb-paper2)',
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: creative.brandColor,
            padding: '3px 7px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
        <DismissButton onClick={dismiss} />
      </div>

      <a href={creative.ctaUrl} className="block text-inherit no-underline">
        <div className="mb-2.5 flex items-start gap-2.5">
          {creative.logoUrl && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: creative.brandColor,
              }}
            >
              <img src={creative.logoUrl} alt="" width={28} height={28} />
            </div>
          )}
          <div
            className="font-jetbrains"
            style={{
              fontSize: 10,
              letterSpacing: '0.04em',
              color: 'var(--pb-muted)',
              lineHeight: 1.4,
              paddingTop: 2,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: 'var(--pb-ink)',
                fontSize: 11,
                marginBottom: 2,
              }}
            >
              {creative.title.split(' ').slice(0, 3).join(' ')}
            </div>
          </div>
        </div>

        <div
          className="font-fraunces mb-2"
          style={{
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.22,
            color: 'var(--pb-ink)',
            letterSpacing: '-0.01em',
            textWrap: 'balance',
          }}
        >
          {creative.title}
        </div>

        <div
          className="font-source-serif mb-3"
          style={{
            fontSize: 13,
            color: 'var(--pb-muted)',
            lineHeight: 1.5,
          }}
        >
          {creative.body}
        </div>

        <div
          className="font-jetbrains"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: creative.brandColor,
            fontWeight: 600,
            paddingTop: 10,
            borderTop: '1px dashed var(--pb-line)',
          }}
        >
          {creative.ctaText}
        </div>
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/anchor-ad.tsx
git commit -m "feat(ads): refactor AnchorAd to AdSlotProps"
```

---

### Task 12: Refactor BookmarkAd Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/bookmark-ad.tsx`

- [ ] **Step 1: Rewrite bookmark-ad.tsx**

Replace entire content:

```tsx
'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function BookmarkAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div className="my-11 flex justify-center">
      <div
        className="relative w-full max-w-[540px] dark:bg-[#F2EBDB] bg-[#FFFCEE]"
        style={{
          color: '#1A140C',
          padding: '20px 24px 20px',
          boxShadow:
            'var(--pb-bookmark-shadow, 0 6px 18px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.04))',
          transform: 'rotate(-0.2deg)',
        }}
      >
        <div
          aria-hidden="true"
          className="absolute left-1/2"
          style={{
            top: -10,
            transform: 'translateX(-50%) rotate(2deg)',
            width: 72,
            height: 18,
            background: 'rgba(255,180,120,0.72)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
          }}
        />

        <div className="mb-3 flex items-center justify-between">
          <span
            className="font-jetbrains inline-flex items-center gap-1.5"
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              fontWeight: 700,
              color: '#FFFCEE',
              background: creative.brandColor,
              padding: '4px 8px',
              borderRadius: 2,
            }}
          >
            {label}
          </span>
          <DismissButton onClick={dismiss} color="#5A4A3C" />
        </div>

        <div className="mb-3 flex items-center gap-3">
          {creative.logoUrl && (
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                background: creative.brandColor,
              }}
            >
              <img src={creative.logoUrl} alt="" width={32} height={32} />
            </div>
          )}
        </div>

        <div
          className="font-fraunces mb-2.5"
          style={{
            fontSize: 19,
            fontWeight: 500,
            lineHeight: 1.22,
            color: '#1A140C',
            letterSpacing: '-0.01em',
            textWrap: 'balance',
          }}
        >
          {creative.title}
        </div>

        <div
          className="font-source-serif mb-4"
          style={{
            fontSize: 14,
            color: '#3A2E22',
            lineHeight: 1.5,
          }}
        >
          {creative.body}
        </div>

        <a
          href={creative.ctaUrl}
          className="font-jetbrains inline-block no-underline"
          style={{
            padding: '9px 16px',
            background: '#1A140C',
            color: '#FFFCEE',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {creative.ctaText}
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/bookmark-ad.tsx
git commit -m "feat(ads): refactor BookmarkAd to AdSlotProps"
```

---

### Task 13: Refactor CodaAd Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/coda-ad.tsx`

- [ ] **Step 1: Rewrite coda-ad.tsx**

Replace entire content:

```tsx
'use client'

import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function CodaAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        border: '2px solid var(--pb-line)',
        borderTop: `4px solid ${creative.brandColor}`,
        background: 'var(--pb-coda-bg, rgba(0,0,0,0.012))',
      }}
    >
      <div className="absolute right-3.5 top-3.5">
        <DismissButton onClick={dismiss} />
      </div>

      <div className="mb-5">
        <span
          className="font-jetbrains inline-flex items-center gap-1.5"
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            fontWeight: 700,
            color: '#FFFCEE',
            background: creative.brandColor,
            padding: '4px 9px',
            borderRadius: 2,
          }}
        >
          {label}
        </span>
      </div>

      <div className="grid items-start gap-5" style={{ gridTemplateColumns: 'auto 1fr' }}>
        {creative.logoUrl && (
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              padding: 14,
              background: 'var(--pb-coda-mark-bg, rgba(0,0,0,0.025))',
              border: '1px solid var(--pb-line)',
            }}
          >
            <img src={creative.logoUrl} alt="" width={36} height={36} />
          </div>
        )}

        <div>
          <div
            className="font-fraunces mb-3"
            style={{
              fontSize: 26,
              fontWeight: 500,
              lineHeight: 1.15,
              color: 'var(--pb-ink)',
              letterSpacing: '-0.015em',
              textWrap: 'balance',
            }}
          >
            {creative.title}
          </div>

          <div
            className="font-source-serif"
            style={{
              fontSize: 16,
              color: 'var(--pb-ink)',
              lineHeight: 1.55,
              opacity: 0.9,
              marginBottom: 22,
            }}
          >
            {creative.body}
          </div>

          <a
            href={creative.ctaUrl}
            className="font-jetbrains inline-block uppercase no-underline"
            style={{
              padding: '12px 22px',
              background: creative.brandColor,
              color: '#FFF',
              fontSize: 12,
              letterSpacing: '0.1em',
              fontWeight: 600,
            }}
          >
            {creative.ctaText}
          </a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/coda-ad.tsx
git commit -m "feat(ads): refactor CodaAd to AdSlotProps"
```

---

### Task 14: Refactor DoormanAd Component

**Files:**
- Modify: `apps/web/src/components/blog/ads/doorman-ad.tsx`

- [ ] **Step 1: Rewrite doorman-ad.tsx**

Replace entire content:

```tsx
'use client'

import { useState, useEffect } from 'react'
import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'

export function DoormanAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (dismissed) return
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = setTimeout(() => setVisible(true), reduce ? 0 : 300)
    return () => clearTimeout(t)
  }, [dismissed])

  if (dismissed) return null

  const label = adLabel(creative.type, locale)

  return (
    <div
      className="relative flex w-full flex-wrap items-center gap-3.5"
      style={{
        background: creative.brandColor,
        color: '#FFF',
        padding: '12px 20px',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
        transition:
          'transform 0.4s cubic-bezier(.2,.8,.2,1), opacity 0.4s',
      }}
    >
      <div
        className="font-jetbrains uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: 2,
          background: 'rgba(255,255,255,0.18)',
        }}
      >
        {label}
      </div>

      <div
        className="min-w-[240px] flex-1"
        style={{ fontSize: 14, lineHeight: 1.4 }}
      >
        <strong className="font-semibold">{creative.title}</strong>
      </div>

      <a
        href={creative.ctaUrl}
        className="font-jetbrains uppercase no-underline"
        style={{
          color: '#FFF',
          fontSize: 11,
          letterSpacing: '0.1em',
          fontWeight: 600,
          padding: '8px 14px',
          border: '1px solid rgba(255,255,255,0.5)',
        }}
      >
        {creative.ctaText}
      </a>

      <button
        onClick={dismiss}
        aria-label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        className="cursor-pointer border-none bg-transparent p-1 leading-none"
        style={{
          color: '#FFF',
          fontSize: 18,
          opacity: 0.85,
        }}
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/doorman-ad.tsx
git commit -m "feat(ads): refactor DoormanAd to AdSlotProps"
```

---

### Task 15: Refactor BowtieAd Component (interaction field)

**Files:**
- Modify: `apps/web/src/components/blog/ads/bowtie-ad.tsx`

- [ ] **Step 1: Rewrite bowtie-ad.tsx**

Replace entire content:

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import type { AdSlotProps } from './types'
import { useDismissable } from './use-dismissable'
import { adLabel } from './ad-label'
import { DismissButton } from './dismiss-button'

export function BowtieAd({ creative, locale }: AdSlotProps) {
  const [dismissed, dismiss] = useDismissable(creative)
  const [submitted, setSubmitted] = useState(false)
  if (dismissed) return null

  const label = adLabel(creative.type, locale)
  const isForm = creative.interaction === 'form'

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div
      className="relative mt-12"
      style={{
        padding: '32px 32px 28px',
        background: creative.brandColor,
        color: '#1A140C',
        transform: 'rotate(-0.25deg)',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute"
        style={{
          top: -10,
          left: '40%',
          transform: 'rotate(3deg)',
          width: 80,
          height: 18,
          background: 'rgba(255,180,120,0.85)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        }}
      />

      <div className="absolute right-3 top-3">
        <DismissButton
          onClick={dismiss}
          color="#1A140C"
          label={locale === 'pt-BR' ? 'Fechar' : 'Close'}
        />
      </div>

      <div
        className="font-jetbrains mb-2.5 uppercase"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          fontWeight: 600,
          opacity: 0.7,
        }}
      >
        {label}
      </div>

      <div
        className="font-fraunces mb-2.5"
        style={{
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.15,
          textWrap: 'balance',
          letterSpacing: '-0.012em',
        }}
      >
        {creative.title}
      </div>

      <div
        className="font-source-serif"
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.85,
          marginBottom: 18,
        }}
      >
        {creative.body}
      </div>

      {isForm && !submitted ? (
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <input
            type="email"
            required
            placeholder={locale === 'pt-BR' ? 'voce@email.com' : 'you@email.com'}
            className="min-w-[200px] flex-1"
            style={{
              padding: '12px 14px',
              fontSize: 14,
              border: '1px solid #1A140C',
              background: '#FFFCEE',
              color: '#1A140C',
              fontFamily: '"Inter", sans-serif',
            }}
          />
          <button
            type="submit"
            className="font-jetbrains cursor-pointer border-none uppercase"
            style={{
              padding: '12px 20px',
              background: '#1A140C',
              color: creative.brandColor,
              fontSize: 11,
              letterSpacing: '0.14em',
              fontWeight: 600,
            }}
          >
            {creative.ctaText}
          </button>
        </form>
      ) : isForm && submitted ? (
        <div
          className="font-source-serif italic"
          style={{
            padding: '12px 16px',
            background: 'rgba(26,20,12,0.08)',
            fontSize: 14,
          }}
        >
          {locale === 'pt-BR'
            ? 'Recebido. Confira sua caixa.'
            : 'Got it. Check your inbox.'}
        </div>
      ) : (
        <a
          href={creative.ctaUrl}
          className="font-jetbrains inline-block uppercase no-underline"
          style={{
            padding: '12px 22px',
            background: '#1A140C',
            color: creative.brandColor,
            fontSize: 11,
            letterSpacing: '0.14em',
            fontWeight: 600,
          }}
        >
          {creative.ctaText}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/ads/bowtie-ad.tsx
git commit -m "feat(ads): refactor BowtieAd to AdSlotProps with interaction field"
```

---

### Task 16: Clean Barrel Export + Delete Old Files

**Files:**
- Rewrite: `apps/web/src/components/blog/ads/index.ts`
- Delete: `apps/web/src/components/blog/ads/ad-data.ts`
- Delete: `apps/web/src/components/blog/ads/ad-utils.ts`

- [ ] **Step 1: Rewrite barrel export**

Replace entire content of `apps/web/src/components/blog/ads/index.ts`:

```typescript
export type { AdCreativeData, AdSlotProps } from './types'
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

- [ ] **Step 2: Delete old files**

```bash
rm apps/web/src/components/blog/ads/ad-data.ts
rm apps/web/src/components/blog/ads/ad-utils.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/blog/ads/index.ts
git rm apps/web/src/components/blog/ads/ad-data.ts
git rm apps/web/src/components/blog/ads/ad-utils.ts
git commit -m "feat(ads): clean barrel export, delete ad-data.ts and ad-utils.ts"
```

---

### Task 17: Update Blog Post Page — SSR Ad Resolution

**Files:**
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

This task replaces the hardcoded ad selection (lines ~117-125) with the new creative data flow. Until `resolveSlots()` is available from the package, we create a temporary local `resolveAdsForPost()` function that queries the DB directly.

- [ ] **Step 1: Update imports at top of file**

Remove these imports from the blog post page:
```typescript
import { hashSlug, pickSponsor, pickHouse, SPONSORS, HOUSE_ADS, computeBookmarkIndex, computeMobileInlineIndex } from '...'
```

Add these imports:
```typescript
import { computeInlineAdIndex, computeMobileInlineIndex } from '@/lib/blog/content-layout'
import type { AdCreativeData } from '@/components/blog/ads'
```

- [ ] **Step 2: Replace the ad selection block (lines ~117-125)**

Replace:
```typescript
const adLocale = locale as 'en' | 'pt-BR'
const adHash = hashSlug(slug)
const adMarginalia = pickHouse(adHash, 2, HOUSE_ADS)
const adAnchor = pickSponsor(adHash, 1, SPONSORS)
const adBookmark = pickSponsor(adHash, 2, SPONSORS)
const adCoda = pickSponsor(adHash, 0, SPONSORS)
const adMidContent = pickSponsor(adHash, 3, SPONSORS)
const adBowtie = HOUSE_ADS.find((h) => h.kind === 'newsletter') ?? pickHouse(adHash, 1, HOUSE_ADS)
const adDoorman = HOUSE_ADS.find((h) => h.kind === 'post') ?? pickHouse(adHash, 3, HOUSE_ADS)
```

With a temporary inline resolution that queries the DB. The exact implementation depends on the available Supabase client and how ad components are wired into the JSX below. Since the page is a server component, use the service client:

```typescript
const adLocale = locale as 'en' | 'pt-BR'
const creatives = await loadAdCreatives(adLocale)
```

Where `loadAdCreatives` is a helper added to the same file or imported from `@/lib/ads/resolve.ts`.

**Important:** The exact wiring depends on how the 6 components are rendered in the JSX. Each component call like `<MarginaliaAd ad={adMarginalia} locale={adLocale} />` becomes `creatives.rail_left && <MarginaliaAd creative={creatives.rail_left} locale={adLocale} />`.

- [ ] **Step 3: Update all component invocations in JSX**

Replace all 6 component usages to use `creative` prop instead of `ad` prop. Each component now conditionally renders based on whether the creative exists.

- [ ] **Step 4: Update computeBookmarkIndex to computeInlineAdIndex**

Replace any call to `computeBookmarkIndex(...)` with `computeInlineAdIndex(...)`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/\[slug\]/page.tsx
git commit -m "feat(ads): switch blog post page from hardcoded to DB-driven ad resolution"
```

---

### Task 18: Update Admin Campaign Actions

**Files:**
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`

- [ ] **Step 1: Update createCampaign to include new columns**

In the `createCampaign` function, add `brand_color` and `logo_url` to the campaign insert. In the creatives insert, add `locale` and `interaction` fields.

Add to campaign insert:
```typescript
brand_color: data.brandColor ?? '#6B7280',
logo_url: data.logoUrl ?? null,
```

Add to each creative insert:
```typescript
locale: c.locale ?? 'pt-BR',
interaction: c.interaction ?? 'link',
```

- [ ] **Step 2: Update updateCampaign similarly**

Add the same new columns to the update operation and creative re-insert.

- [ ] **Step 3: Add cache invalidation**

Add `import { revalidateTag } from 'next/cache'` if not already imported.

After each mutation (`createCampaign`, `updateCampaign`, `deleteCampaign`, `updatePlaceholder`), add:
```typescript
revalidateTag('ads')
```

Keep the existing `revalidatePath('/admin/ads')` as well.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/admin/\(authed\)/ads/_actions/campaigns.ts
git commit -m "feat(ads): add brand/locale/interaction columns + cache invalidation to campaign actions"
```

---

### Task 19: Rewrite Ad Test Suite

**Files:**
- Rewrite: `apps/web/test/components/blog/ads.test.tsx`

- [ ] **Step 1: Rewrite test file**

Replace entire content of `apps/web/test/components/blog/ads.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { AdCreativeData } from '../../../src/components/blog/ads'

// ---------- localStorage mock ----------
const store: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k])
  }),
  get length() {
    return Object.keys(store).length
  },
  key: vi.fn((_i: number) => null),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

// ---------- matchMedia mock ----------
Object.defineProperty(globalThis, 'matchMedia', {
  value: vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})

beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
})

// ---------- Mock creative factory ----------

function mockCreative(overrides: Partial<AdCreativeData> = {}): AdCreativeData {
  return {
    campaignId: 'test-campaign-1',
    slotKey: 'rail_left',
    type: 'house',
    source: 'campaign',
    interaction: 'link',
    title: 'Test Headline',
    body: 'Test body text for the ad.',
    ctaText: 'Click here →',
    ctaUrl: '#test-url',
    imageUrl: null,
    logoUrl: '/ads/logos/test.svg',
    brandColor: '#7B5BF7',
    dismissSeconds: 0,
    ...overrides,
  }
}

// ============ adLabel helper tests ============

describe('adLabel', () => {
  it('returns PATROCINADO for cpa pt-BR', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('cpa', 'pt-BR')).toBe('PATROCINADO')
  })

  it('returns SPONSORED for cpa en', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('cpa', 'en')).toBe('SPONSORED')
  })

  it('returns DA CASA for house pt-BR', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('house', 'pt-BR')).toBe('DA CASA')
  })

  it('returns HOUSE for house en', async () => {
    const { adLabel } = await import('../../../src/components/blog/ads/ad-label')
    expect(adLabel('house', 'en')).toBe('HOUSE')
  })
})

// ============ useDismissable hook test ============

describe('useDismissable', () => {
  function TestComponent({
    creative,
    onDismiss,
  }: {
    creative: AdCreativeData
    onDismiss?: () => void
  }) {
    const { useDismissable } = require('../../../src/components/blog/ads/use-dismissable')
    const [dismissed, dismiss] = useDismissable(creative, onDismiss)
    return (
      <div>
        <span data-testid="status">{dismissed ? 'dismissed' : 'visible'}</span>
        <button data-testid="dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    )
  }

  it('starts as visible when not previously dismissed', () => {
    const { getByTestId } = render(
      <TestComponent creative={mockCreative()} />,
    )
    expect(getByTestId('status').textContent).toBe('visible')
  })

  it('becomes dismissed on click and persists to localStorage', () => {
    const onDismiss = vi.fn()
    const creative = mockCreative()
    const { getByTestId } = render(
      <TestComponent creative={creative} onDismiss={onDismiss} />,
    )

    fireEvent.click(getByTestId('dismiss'))
    expect(getByTestId('status').textContent).toBe('dismissed')
    expect(onDismiss).toHaveBeenCalledOnce()

    const stored = JSON.parse(store['btf_ads_dismissed'] || '{}')
    expect(stored['rail_left_test-campaign-1']).toBeDefined()
  })

  it('uses slotKey_ph for placeholder dismiss key', () => {
    const creative = mockCreative({ campaignId: null, source: 'placeholder' })
    const { getByTestId } = render(<TestComponent creative={creative} />)

    fireEvent.click(getByTestId('dismiss'))
    const stored = JSON.parse(store['btf_ads_dismissed'] || '{}')
    expect(stored['rail_left_ph']).toBeDefined()
  })

  it('starts as dismissed when localStorage has the key', () => {
    const creative = mockCreative({ slotKey: 'banner_top', campaignId: 'abc' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'banner_top_abc': Date.now() })
    const { getByTestId } = render(<TestComponent creative={creative} />)
    expect(getByTestId('status').textContent).toBe('dismissed')
  })
})

// ============ Component render tests ============

describe('MarginaliaAd', () => {
  it('renders title and CTA', async () => {
    const { MarginaliaAd } = await import('../../../src/components/blog/ads/marginalia-ad')
    const creative = mockCreative({ slotKey: 'rail_left' })
    const { container } = render(<MarginaliaAd creative={creative} locale="pt-BR" />)
    expect(container.textContent).toContain('Test Headline')
    expect(container.textContent).toContain('Click here →')
  })

  it('returns null when dismissed', async () => {
    const creative = mockCreative({ slotKey: 'rail_left', campaignId: 'xyz' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'rail_left_xyz': Date.now() })
    const { MarginaliaAd } = await import('../../../src/components/blog/ads/marginalia-ad')
    const { container } = render(<MarginaliaAd creative={creative} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('AnchorAd', () => {
  it('renders logo img instead of dangerouslySetInnerHTML', async () => {
    const { AnchorAd } = await import('../../../src/components/blog/ads/anchor-ad')
    const creative = mockCreative({ slotKey: 'rail_right', type: 'cpa', logoUrl: '/ads/logos/test.svg' })
    const { container } = render(<AnchorAd creative={creative} locale="pt-BR" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('/ads/logos/test.svg')
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('BookmarkAd', () => {
  it('renders tape decoration and cream background', async () => {
    const { BookmarkAd } = await import('../../../src/components/blog/ads/bookmark-ad')
    const creative = mockCreative({ slotKey: 'inline_mid', type: 'cpa' })
    const { container } = render(<BookmarkAd creative={creative} locale="pt-BR" />)
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
    expect(container.textContent).toContain('Test Headline')
  })

  it('renders CTA as a link', async () => {
    const { BookmarkAd } = await import('../../../src/components/blog/ads/bookmark-ad')
    const creative = mockCreative({ slotKey: 'inline_mid' })
    const { container } = render(<BookmarkAd creative={creative} locale="en" />)
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('#test-url')
  })
})

describe('CodaAd', () => {
  it('renders logo img and content', async () => {
    const { CodaAd } = await import('../../../src/components/blog/ads/coda-ad')
    const creative = mockCreative({ slotKey: 'block_bottom', type: 'cpa' })
    const { container } = render(<CodaAd creative={creative} locale="pt-BR" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(container.textContent).toContain('Test Headline')
    expect(container.textContent).toContain('Test body text')
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe('#test-url')
  })
})

describe('DoormanAd', () => {
  it('renders banner with title and CTA', async () => {
    const { DoormanAd } = await import('../../../src/components/blog/ads/doorman-ad')
    const creative = mockCreative({ slotKey: 'banner_top' })
    const { container } = render(<DoormanAd creative={creative} locale="pt-BR" />)
    expect(container.textContent).toContain('Test Headline')
  })

  it('returns null when dismissed', async () => {
    const creative = mockCreative({ slotKey: 'banner_top', campaignId: 'abc' })
    store['btf_ads_dismissed'] = JSON.stringify({ 'banner_top_abc': Date.now() })
    const { DoormanAd } = await import('../../../src/components/blog/ads/doorman-ad')
    const { container } = render(<DoormanAd creative={creative} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('BowtieAd', () => {
  it('renders email form when interaction is form', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
    expect(container.querySelector('form')).toBeTruthy()
  })

  it('renders CTA link when interaction is link', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'link', type: 'cpa' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.getAttribute('href')).toBe('#test-url')
  })

  it('shows confirmation after form submit', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="pt-BR" />)

    const input = container.querySelector('input[type="email"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(container.textContent).toContain('Recebido. Confira sua caixa.')
  })

  it('renders tape decoration', async () => {
    const { BowtieAd } = await import('../../../src/components/blog/ads/bowtie-ad')
    const creative = mockCreative({ slotKey: 'inline_end', interaction: 'form' })
    const { container } = render(<BowtieAd creative={creative} locale="en" />)
    const tape = container.querySelector('[aria-hidden="true"]')
    expect(tape).toBeTruthy()
  })
})

// ============ Shared atoms ============

describe('AdLabel component', () => {
  it('renders label text and brand dot', async () => {
    const { AdLabel } = await import('../../../src/components/blog/ads/ad-label')
    const { container } = render(
      <AdLabel type="cpa" locale="pt-BR" brandColor="#7B5BF7" />,
    )
    expect(container.textContent).toContain('PATROCINADO')
    const dot = container.querySelector('span.inline-block')
    expect(dot).toBeTruthy()
  })
})

describe('DismissButton', () => {
  it('calls onClick and has aria-label', async () => {
    const { DismissButton } = await import('../../../src/components/blog/ads/dismiss-button')
    const onClick = vi.fn()
    const { getByRole } = render(
      <DismissButton onClick={onClick} label="Fechar" />,
    )
    const btn = getByRole('button', { name: 'Fechar' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/ads.test.tsx`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/components/blog/ads.test.tsx
git commit -m "feat(ads): rewrite ad test suite for AdSlotProps"
```

---

### Task 20: Run Full Test Suite + Fix Breakages

**Files:**
- Various — fix any import breakages caused by deleted files

- [ ] **Step 1: Run full web test suite**

Run: `npm run test:web`
Expected: All tests pass. If any test imports from `ad-data.ts` or `ad-utils.ts`, fix the import.

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors. Fix any remaining references to old types (`SponsorAd`, `HouseAd`, `AdProps`, `AdLocaleKey`).

- [ ] **Step 3: Run API tests**

Run: `npm run test:api`
Expected: All pass (API shouldn't be affected)

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(ads): resolve import breakages after ad system refactor"
```

---
