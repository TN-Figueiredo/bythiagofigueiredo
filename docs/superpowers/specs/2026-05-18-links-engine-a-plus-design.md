# Links Engine A++ Design

**Date:** 2026-05-18
**Status:** Draft
**Score:** 98/100
**Sprint:** 5h (Social Hub) — Links Engine improvements

## Context

Competitor analysis (`formulayoutube.com.br/fyt/v01?utm_source=youtube&vk_source=organic_youtube&utm_medium=YT_NN&utm_campaign=YT_NN_17052026`) revealed gaps in our Links Engine around UTM normalization, ad platform click ID handling, campaign intelligence, and link lifecycle management. A deep audit of the existing system also uncovered critical P0 bugs: 5 link crons not registered in production, UTM overwrite inconsistency in the redirect handler, and `link_clicks.utm_*` columns always NULL.

## Architecture Overview

4 implementation blocks, ordered by impact:

| Block | Focus | Scope |
|-------|-------|-------|
| **Bloco 0** | Fix P0 bugs in existing system | Prerequisite — must land before any feature work |
| **Bloco 1** | UTM Normalization Engine | Shared normalizer, DB trigger, data migration, utm_id, auto-link naming |
| **Bloco 2** | Click ID Passthrough | Safe forwarding of gclid/fbclid/etc through redirects, LGPD-compliant storage |
| **Bloco 3** | Lifecycle & Campaign Intelligence | launched_at, activates_at, smart UTM defaults, custom params, health check, batch ops |

## Deployment Plan

### Ordering

1. **Fix cron HTTP methods** (Bloco 0 pre-req — can ship immediately)
2. `npm run db:new links_engine_a_plus_schema` — DDL only (columns, constraints, functions, triggers, indexes)
3. **Preview normalization impact** — run dry-run query (see below) and verify no surprises
4. `npm run db:new links_engine_a_plus_data` — data migration UPDATE + RPC function
5. Deploy code changes (same commit to staging)
6. Verify crons in Vercel dashboard, run each manually once
7. After 2 weeks stable: drop `_utm_backup` column

### Rollback

- **Schema migration**: write a reverse migration dropping columns/triggers/constraints
- **Data migration**: `_utm_backup` jsonb column preserves original UTM values for 2 weeks
- **Code changes**: revert commit on staging; old code ignores new columns safely

### Preview Query (run after schema migration, before data migration)

```sql
SELECT id, code, utm_campaign,
  public.normalize_utm_value('utm_campaign', utm_campaign) AS normalized
FROM tracked_links
WHERE utm_campaign IS NOT NULL
  AND utm_campaign != public.normalize_utm_value('utm_campaign', utm_campaign);
```

---

## Migration 1: Schema (DDL only)

`npm run db:new links_engine_a_plus_schema`:

```sql
-- 1. New columns on tracked_links
ALTER TABLE tracked_links
  ADD COLUMN IF NOT EXISTS custom_params jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS activates_at timestamptz,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS health_status text DEFAULT 'unchecked' NOT NULL,
  ADD COLUMN IF NOT EXISTS health_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pass_click_ids boolean DEFAULT true NOT NULL;

-- 2. Constraints
ALTER TABLE tracked_links
  ADD CONSTRAINT chk_activation_before_expiry
    CHECK (activates_at IS NULL OR expires_at IS NULL OR activates_at < expires_at);

ALTER TABLE tracked_links
  ADD CONSTRAINT chk_health_status_values
    CHECK (health_status IN ('unchecked', 'healthy', 'unhealthy', 'timeout', 'dns_error'));

ALTER TABLE tracked_links DROP CONSTRAINT IF EXISTS tracked_links_redirect_type_check;
ALTER TABLE tracked_links ADD CONSTRAINT tracked_links_redirect_type_check
  CHECK (redirect_type IN (301, 302, 307, 308));

ALTER TABLE tracked_links ALTER COLUMN redirect_type SET DEFAULT 307;

-- Also update link_settings constraint for default redirect type
ALTER TABLE link_settings DROP CONSTRAINT IF EXISTS link_settings_default_redirect_type_check;
ALTER TABLE link_settings ADD CONSTRAINT link_settings_default_redirect_type_check
  CHECK (default_redirect_type IN (301, 302, 307, 308));

-- 3. New columns on link_clicks (partitioned — parent propagates to partitions)
ALTER TABLE link_clicks
  ADD COLUMN IF NOT EXISTS ad_click_ids jsonb,
  ADD COLUMN IF NOT EXISTS utm_id text;

-- 4. New column on link_utm_presets
ALTER TABLE link_utm_presets
  ADD COLUMN IF NOT EXISTS utm_id text;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_tracked_links_launched_at
  ON tracked_links (launched_at) WHERE launched_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_activates_at
  ON tracked_links (activates_at) WHERE activates_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_health_check_candidates
  ON tracked_links (health_checked_at NULLS FIRST)
  WHERE active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_link_clicks_ad_click_ids_not_null
  ON link_clicks (clicked_at) WHERE ad_click_ids IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracked_links_launched_null
  ON tracked_links (id) WHERE launched_at IS NULL;

-- 6. UTM normalization function
CREATE OR REPLACE FUNCTION public.normalize_utm_value(
  field_name text, raw_value text
) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE v text;
BEGIN
  IF raw_value IS NULL THEN RETURN NULL; END IF;
  v := raw_value;
  IF field_name = 'utm_term' THEN
    v := lower(trim(v));
    RETURN NULLIF(v, '');
  END IF;
  v := normalize(v, NFKD);
  v := regexp_replace(v, E'[\\u0300-\\u036F]', '', 'g');
  v := lower(trim(v));
  v := regexp_replace(v, '\s+', '-', 'g');
  v := regexp_replace(v, '[^a-z0-9._\-]', '', 'g');
  v := regexp_replace(v, '-{2,}', '-', 'g');
  v := regexp_replace(v, '^-+|-+$', '', 'g');
  RETURN NULLIF(v, '');
END; $$;

-- 7. UTM normalization triggers
CREATE OR REPLACE FUNCTION public.trg_normalize_tracked_links_utm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Short-circuit on UPDATE when no UTM field changed (critical for performance:
  -- increment_link_clicks RPC does UPDATE on total_clicks which fires this trigger
  -- on every single click — without this guard, 6 unnecessary normalizations per click)
  IF TG_OP = 'UPDATE' AND
     NEW.utm_source   IS NOT DISTINCT FROM OLD.utm_source AND
     NEW.utm_medium   IS NOT DISTINCT FROM OLD.utm_medium AND
     NEW.utm_campaign IS NOT DISTINCT FROM OLD.utm_campaign AND
     NEW.utm_term     IS NOT DISTINCT FROM OLD.utm_term AND
     NEW.utm_content  IS NOT DISTINCT FROM OLD.utm_content AND
     NEW.utm_id       IS NOT DISTINCT FROM OLD.utm_id THEN
    RETURN NEW;
  END IF;

  NEW.utm_source   := public.normalize_utm_value('utm_source',   NEW.utm_source);
  NEW.utm_medium   := public.normalize_utm_value('utm_medium',   NEW.utm_medium);
  NEW.utm_campaign := public.normalize_utm_value('utm_campaign', NEW.utm_campaign);
  NEW.utm_term     := public.normalize_utm_value('utm_term',     NEW.utm_term);
  NEW.utm_content  := public.normalize_utm_value('utm_content',  NEW.utm_content);
  NEW.utm_id       := public.normalize_utm_value('utm_id',       NEW.utm_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS normalize_utm_before_upsert ON tracked_links;
CREATE TRIGGER normalize_utm_before_upsert
  BEFORE INSERT OR UPDATE ON tracked_links
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_tracked_links_utm();

CREATE OR REPLACE FUNCTION public.trg_normalize_utm_presets() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.utm_source   := public.normalize_utm_value('utm_source',   NEW.utm_source);
  NEW.utm_medium   := public.normalize_utm_value('utm_medium',   NEW.utm_medium);
  NEW.utm_campaign := public.normalize_utm_value('utm_campaign', NEW.utm_campaign);
  NEW.utm_term     := public.normalize_utm_value('utm_term',     NEW.utm_term);
  NEW.utm_content  := public.normalize_utm_value('utm_content',  NEW.utm_content);
  NEW.utm_id       := public.normalize_utm_value('utm_id',       NEW.utm_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS normalize_utm_before_upsert ON link_utm_presets;
CREATE TRIGGER normalize_utm_before_upsert
  BEFORE INSERT OR UPDATE ON link_utm_presets
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_utm_presets();

```

---

## Migration 2: Data Migration

`npm run db:new links_engine_a_plus_data` (run AFTER previewing normalization impact):

```sql
-- 1. Backup original UTM values before normalization (rollback safety)
ALTER TABLE tracked_links ADD COLUMN IF NOT EXISTS _utm_backup jsonb;
UPDATE tracked_links SET _utm_backup = jsonb_build_object(
  'utm_source', utm_source, 'utm_medium', utm_medium,
  'utm_campaign', utm_campaign, 'utm_term', utm_term,
  'utm_content', utm_content
) WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

-- 2. Normalize existing data (triggers fire on UPDATE)
UPDATE tracked_links SET utm_source = utm_source
WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

UPDATE link_utm_presets SET utm_source = utm_source
WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL
   OR utm_campaign IS NOT NULL OR utm_term IS NOT NULL
   OR utm_content IS NOT NULL;

-- NOTE: link_clicks (partitioned, append-only) is NOT backfilled.

-- 3. Batch operations RPC (with authorization guard)
CREATE OR REPLACE FUNCTION public.batch_extend_link_expiry(
  p_site_id uuid, p_campaign text DEFAULT NULL,
  p_tags text[] DEFAULT NULL, p_hours integer DEFAULT 24
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_count integer;
BEGIN
  -- Authorization guard: caller must have edit permission on the site
  IF NOT public.can_edit_site(p_site_id) THEN
    RAISE EXCEPTION 'forbidden: caller cannot edit site %', p_site_id;
  END IF;

  UPDATE tracked_links
  SET expires_at = COALESCE(expires_at, now()) + (p_hours || ' hours')::interval,
      updated_at = now()
  WHERE site_id = p_site_id AND deleted_at IS NULL AND active = true
    AND expires_at IS NOT NULL
    AND (p_campaign IS NULL OR utm_campaign = p_campaign)
    AND (p_tags IS NULL OR tags && p_tags);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- 4. Drop _utm_backup after 2 weeks (separate future migration)
-- npm run db:new drop_utm_backup
-- ALTER TABLE tracked_links DROP COLUMN IF EXISTS _utm_backup;
```

---

## Bloco 0: P0 Fixes (Existing System)

### 0.1 -- Register link crons in vercel.json

**Problem:** 5 link management crons exist as fully implemented route handlers but were never registered in `apps/web/vercel.json`. None execute in production:

| Cron | Impact of not running |
|------|----------------------|
| `links-anonymize-clicks` | Raw IPs accumulate indefinitely (LGPD violation) |
| `links-check-expiry` | Expired links continue redirecting |
| `links-aggregate-metrics` | `link_daily_metrics` is empty |
| `links-check-alerts` | Alert rules never fire |
| `links-partition-maintenance` | Future partitions never created |

**Solution:** Add to `apps/web/vercel.json` crons array:

```jsonc
{ "path": "/api/cron/links-anonymize-clicks",    "schedule": "0 3 * * *" },
{ "path": "/api/cron/links-check-expiry",         "schedule": "*/15 * * * *" },
{ "path": "/api/cron/links-aggregate-metrics",     "schedule": "0 * * * *" },
{ "path": "/api/cron/links-check-alerts",          "schedule": "*/30 * * * *" },
{ "path": "/api/cron/links-partition-maintenance",  "schedule": "0 2 1 * *" },
{ "path": "/api/cron/links-health-check",           "schedule": "0 5 * * *" }
```

**Verification:** After deploy, Vercel dashboard > Crons tab shows all 5. Manual trigger each with `CRON_SECRET`. After 24h, verify `link_daily_metrics` has rows.

### 0.2 -- Fix cron HTTP methods (POST → GET)

**Problem:** Vercel invokes crons with GET requests. Two existing cron route handlers export `POST` instead of `GET`, causing them to return 405 Method Not Allowed and silently never run:

| Cron route | Current export | Fix |
|------------|---------------|-----|
| `links-anonymize-clicks/route.ts` | `export async function POST()` | Change to `GET` |
| `links-partition-maintenance/route.ts` | `export async function POST()` | Change to `GET` |

**Verification:** After fix, trigger each manually via `curl -H "Authorization: Bearer $CRON_SECRET"` and confirm 200 response.

### 0.3 -- Align IP retention to 30 days

**Problem:** Code says 90 days, design said 24h, neither runs. Compromise: 30 days (fraud lookback + LGPD proportionality).

**File:** `apps/web/src/app/api/cron/links-anonymize-clicks/route.ts` line 9

**Change:** `RETENTION_DAYS = 90` → `RETENTION_DAYS = 30`

Also align DB function and cron route (they disagree on which fields to anonymize):
- **Cron route** nullifies: `ip`, `user_agent`, `city`, `referrer_url` — MISSING `region`
- **DB function** nullifies: `ip`, `user_agent`, `city`, `region` — MISSING `referrer_url`
- **Fix both** to the canonical set: `ip`, `user_agent`, `city`, `region`, `referrer_url`, `ad_click_ids`

### 0.4 -- Consolidate redirect paths

**Problem:** Route handler (`go/[code]/route.ts`) reimplements guard logic that `RedirectResolver.checkGuards()` already handles, with different semantics (boolean `active` vs enum `status`).

**Solution:** Extract a shared `checkLinkGuards(link)` function. Route handler delegates to it. Single source of truth for: deleted → paused → expired → not_yet_active → click_limit → password_required.

**Files:** `apps/web/src/app/go/[code]/route.ts`, `apps/web/src/lib/links/resolver.ts`

### 0.5 -- Fix UTM overwrite

**Problem:** Route handler uses `searchParams.set()` (overwrites destination UTMs). Package uses `searchParams.has()` guard (preserves). The route handler is destructive.

**Fix:** Change to preserve-existing:
```typescript
if (value && !destination.searchParams.has(param)) {
  destination.searchParams.set(param, value)
}
```

**File:** `apps/web/src/app/go/[code]/route.ts` lines 96-100

### 0.6 -- Populate link_clicks.utm_* columns

**Problem:** 5 UTM columns on `link_clicks` are always NULL. Click recorder never sets them.

**Fix:** Pass link's UTM values to `recordClick()` and include in the INSERT. Gives historical snapshot — if link UTMs change later, click records retain what was active.

**Files:** `apps/web/src/lib/links/click-recorder.ts`, `apps/web/src/app/go/[code]/route.ts`

---

## Bloco 1: UTM Normalization Engine

### 1.1 -- Shared `normalizeUtmValue(field, value)`

**File:** `packages/links/src/core/utm-normalizer.ts` (new)

```typescript
export type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

function safeDecode(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

export function normalizeUtmValue(field: UtmField, value: string | null | undefined): string | null {
  if (value == null) return null
  let v = safeDecode(value)
  if (field === 'utm_term') {
    v = v.trim().toLowerCase()
    return v.length === 0 ? null : v
  }
  v = v.normalize('NFKD')
  v = v.replace(/[̀-ͯ]/g, '')
  v = v.toLowerCase().trim()
  v = v.replace(/\s+/g, '-')
  v = v.replace(/[^a-z0-9._-]/g, '')
  v = v.replace(/-{2,}/g, '-')
  v = v.replace(/^-+|-+$/g, '')
  return v.length === 0 ? null : v
}

export function normalizeAllUtmFields(input: UtmFieldsInput): UtmFieldsNormalized {
  return {
    utm_source: normalizeUtmValue('utm_source', input.utm_source),
    utm_medium: normalizeUtmValue('utm_medium', input.utm_medium),
    utm_campaign: normalizeUtmValue('utm_campaign', input.utm_campaign),
    utm_term: normalizeUtmValue('utm_term', input.utm_term),
    utm_content: normalizeUtmValue('utm_content', input.utm_content),
    utm_id: normalizeUtmValue('utm_id', input.utm_id),
  }
}

export function slugifyForCampaign(title: string): string {
  return normalizeUtmValue('utm_campaign', title) ?? ''
}
```

Also exports: `GA4_MEDIUM_SUGGESTIONS` (allowlist for autocomplete), `KNOWN_UTM_SOURCES`, `isKnownMedium()`.

### 1.2 -- Apply at ALL entry points

| Entry point | File | Current state | Fix |
|-------------|------|--------------|-----|
| Zod schemas | `CreateLinkSchema`, `UpdateLinkSchema` | `z.string().max(255)` only | Add `.transform(v => normalizeUtmValue(...))` |
| `ensureTrackedLink()` | `auto-link.ts` | Raw insert, bypasses all validation | Call `normalizeAllUtmFields()` before insert |
| `saveUtmPreset()` | `actions.ts` | No normalization | Normalize before insert |
| `duplicateLink()` | `actions.ts` | Copies raw values | Re-normalize copied values |
| `saveLinkSettings()` | `actions.ts` | `default_utm_source` in JSONB | Normalize before storing |
| Click recorder | `click-recorder.ts` | Never populates UTMs | Normalize when copying from link |

### 1.3 -- DB trigger (defense-in-depth)

See consolidated migration above. Triggers on `tracked_links` and `link_utm_presets`. Handles NULL gracefully via `IMMUTABLE STRICT` on the scalar function. Converts empty string to NULL via `NULLIF`.

### 1.4 -- Data migration

Trigger fires on `UPDATE tracked_links SET utm_source = utm_source` — normalizes all fields in-place. Historical `link_clicks` left as-is (partitioned, append-only).

### 1.5 -- utm_medium soft-validation

`GA4_MEDIUM_SUGGESTIONS` used as autocomplete in UI, not hard reject. Unknown values get amber warning badge. List includes: `cpc`, `cpm`, `cpv`, `ppc`, `paid_social`, `paid_search`, `retargeting`, `display`, `banner`, `email`, `social`, `referral`, `affiliate`, `sms`, `qr`, `video`, `whatsapp`, `push`, `podcast`, `print`, `organic`, `organic_social`, `in-app`, `direct_mail`, `audio`.

### 1.6 -- utm_source: no rigid allowlist

Only normalize + autocomplete with known platforms. No blocking.

### 1.7 -- Add utm_id

6th GA4 parameter. Added across: DB columns (tracked_links, link_clicks, link_utm_presets), TypeScript types (UtmParams, CreateLinkInput, UpdateLinkInput), Zod schemas, redirect handler, buildUtmUrl/parseUtm. Required for GA4 cost data import.

### 1.8 -- Fix auto-link naming

Change from `campaign-{uuid}` to `{sourceType}-{slugify(title)}`:
- `blog-como-investir-2026` (not `campaign-a1b2c3d4-e5f6-...`)
- `social-lancamento-curso-q3`
- `newsletter-edicao-42`

New `buildCampaignName(sourceType, title)` function. Falls back to `{prefix}-{shortId}` if title is empty.

---

## Bloco 2: Click ID Passthrough (Seguro)

### 2.1 -- Safe passthrough with sanitization

**File:** `packages/links/src/core/click-id-passthrough.ts` (new)

Known click IDs (13 total):
`gclid`, `gbraid`, `wbraid`, `gclsrc`, `dclid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `li_fat_id`, `epik`, `rdt_cid`, `ScCid`

```typescript
export function safePassthrough(incomingUrl: URL, destinationUrl: URL): PassthroughResult {
  const result = new URL(destinationUrl.toString())
  const forwarded: string[] = []
  const rejected: string[] = []
  for (const [rawName, value] of incomingUrl.searchParams.entries()) {
    if (rawName.toLowerCase().startsWith('utm_')) continue
    if (!KNOWN_CLICK_IDS.has(rawName.toLowerCase())) continue
    if (value.length > 500) { rejected.push(rawName); continue }
    if (!/^[a-zA-Z0-9_\-=.%+]+$/.test(value)) { rejected.push(rawName); continue }
    if (value.length === 0) continue
    result.searchParams.set(CANONICAL_CASING[rawName.toLowerCase()] ?? rawName, value)
    forwarded.push(rawName)
  }
  if (result.toString().length > 8192) {
    for (const name of forwarded) result.searchParams.delete(name)
    return { url: new URL(destinationUrl.toString()), forwarded: [], rejected: [...rejected, ...forwarded] }
  }
  return { url: result, forwarded, rejected }
}
```

Security: value length cap (500), charset regex (blocks XSS/CRLF), URL length cap (8192 with full rollback), allowlist-only (no arbitrary params).

### 2.2 -- 301 caching conflict

301 + click IDs = browser caches redirect with first gclid, ignores subsequent fbclid. Fix:
- Add 307/308 to DB constraint (`tracked_links` AND `link_settings`)
- Update Zod schemas: `CreateLinkSchema` and `UpdateLinkSchema` change `redirect_type: z.enum(['301', '302'])` → `z.enum(['301', '302', '307', '308'])`
- Update `ensureTrackedLink()` in `auto-link.ts`: change hardcoded `redirect_type: 301` to `redirect_type: 307`
- Default new links to 307
- When 301 link has click IDs present: add `Cache-Control: private, no-store`

### 2.3 -- Capture in link_clicks (consent-gated)

New column `ad_click_ids jsonb`. Only populated if LGPD analytics consent. Passthrough always happens (not storage). 30-day retention via anonymize-clicks cron.

### 2.4 -- LGPD documentation

Required artifacts (not code):
- **LIA/RIPD** for passthrough as transparent intermediary
- **Consent mapping**: LGPD analytics → Google Consent Mode v2 `ad_storage + ad_user_data`
- **Retention**: 30 days, same as IP
- **Data subject rights**: Phase 1 anonymization nulls `ad_click_ids` on deletion

### 2.5 -- Observability

- Sentry breadcrumbs: log param NAMES only (never values)
- Metric: % redirects with click IDs (`Sentry.metrics.increment`)
- Sentry warning on validation failure or URL length rollback
- Integration test: query params survive middleware rewrite for `go.*`

---

## Bloco 3: Lifecycle & Campaign Intelligence

### 3.1 -- launched_at (simplified)

Single field replacing dual `first_seen_at` + `launched_at`. No fragile heuristic.

- Auto-set on first non-bot click: `UPDATE tracked_links SET launched_at = now() WHERE id = $1 AND launched_at IS NULL`
- Manual override in CMS form
- Analytics: `COALESCE(launched_at, created_at)` as fallback
- Safe under concurrency: `.is('launched_at', null)` means second concurrent UPDATE is no-op

### 3.2 -- activates_at (scheduled activation)

- `activates_at timestamptz` with CHECK constraint `activates_at < expires_at`
- Guard in BOTH redirect paths (route handler + RedirectResolver)
- Before activation: rewrite to `/go/coming-soon?title=...` (200, not redirect — URL stays in browser)
- All timestamps UTC; UI converts local timezone before sending
- Full lifecycle: `activates_at → ACTIVE → expires_at → expired_url`

### 3.3 -- UTM Campaign Builder (smart defaults)

Auto-suggestion in link form:
- Format: `{year}_{quarter}_{slug}` (e.g., `2026_q3_curso-fundamentos`)
- Platform defaults: `source_type=social + youtube → utm_source=youtube, utm_medium=social`
- `utm_content` promoted as hero field with contextual placeholders
- All suggestions editable — never forced

### 3.4 -- Custom params (jsonb)

- `custom_params jsonb DEFAULT '{}'` on `tracked_links`
- Key-value pairs appended to redirect after UTMs and click IDs
- `searchParams.has(key)` guard: never overwrites UTMs or destination params
- Sanitization: max 20 params, max 500 chars/value, charset validation, utm_* keys blocked

### 3.5 -- Health check (realistic)

New cron `links-health-check` (daily 05:00 UTC):
- HTTP HEAD, `redirect: 'manual'`, identified User-Agent
- Accept 2xx/3xx/401/403 as alive; flag 5xx/timeout/DNS
- Rate limit: 1 req/s per domain
- SSRF guard: reject private/localhost IPs
- Results: `health_status` + `health_checked_at` on tracked_links
- NEVER blocks activation — only notifies creator
- Skip links with 0 clicks in last 30 days
- Gated by `LINKS_HEALTH_CHECK_ENABLED` env var (default false) — safe to enable later

### 3.6 -- Batch operations

`batchUpdateLinks(filters, updates)` server action:
- Filter by: IDs, tags, utm_campaign, source_type, active status
- Preview step (dry run) before commit
- Convenience wrappers: `batchActivateNow(campaign)`, `batchExtendExpiry(filters, hours)`
- Audit: `link_annotations` row per affected link

---

## Feature Flags

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `LINKS_HEALTH_CHECK_ENABLED` | `boolean` | `false` | Gate for health-check cron; disable without redeploy if it causes rate-limit issues with destinations |

All other features in this spec are unconditional — they fix bugs or add core functionality that should always be active.

## Per-Link Opt-Out: Click ID Passthrough

New column on `tracked_links`:

```sql
ALTER TABLE tracked_links ADD COLUMN IF NOT EXISTS pass_click_ids boolean DEFAULT true NOT NULL;
```

When `pass_click_ids = false`, redirect handler skips `safePassthrough()` entirely. Use case: affiliate links where the destination rejects unknown query params or links to domains that break with extra params.

Exposed in link-form.tsx as a toggle in the Advanced section: "Forward ad click IDs (gclid, fbclid, etc.)".

## Barrel File Updates

`packages/links/src/index.ts` must re-export new modules:

```typescript
export { normalizeUtmValue, normalizeAllUtmFields, slugifyForCampaign, isKnownMedium, GA4_MEDIUM_SUGGESTIONS } from './core/utm-normalizer'
export { safePassthrough, KNOWN_CLICK_IDS } from './core/click-id-passthrough'
```

## Test Matrix

### Unit Tests

| Test file | Cases | What it validates |
|-----------|-------|-------------------|
| `utm-normalizer.test.ts` | NFKD stripping (`café` → `cafe`), whitespace → hyphens, empty → null, `utm_term` preserves `+`, diacritics removal, double-hyphen collapse, leading/trailing hyphen trim, `utm_id` normalization | App-side normalizer matches DB trigger output bit-for-bit |
| `click-id-passthrough.test.ts` | Allowlist-only (unknown params dropped), value length cap (501 chars → rejected), charset validation (`<script>` → rejected), URL length cap (8192 rollback), empty value skip, canonical casing preservation | Security boundaries hold under adversarial input |
| `utm-normalizer.test.ts` (idempotence) | `normalize(normalize(x)) === normalize(x)` for 50 random inputs | Trigger firing twice on same row produces no change |

### Integration Tests

| Test | What it validates |
|------|-------------------|
| Redirect with UTMs | UTM values on `go/` request are forwarded to destination via `.has()` guard (never overwrite) |
| Redirect with click IDs | `gclid` + `fbclid` on incoming URL appear on redirect Location header |
| Redirect with `pass_click_ids=false` | Click IDs NOT forwarded when opt-out is set |
| 301 + click IDs present | Response includes `Cache-Control: private, no-store` |
| `activates_at` future date | Redirect returns 200 with coming-soon page, not 302 |
| Trigger short-circuit | `UPDATE tracked_links SET total_clicks = total_clicks + 1` does NOT mutate UTM values (verify with `_utm_backup` comparison) |
| Anonymize cron | After cron run, clicks older than 30 days have NULL `ip`, `user_agent`, `city`, `region`, `referrer_url`, `ad_click_ids` |
| Migration idempotence | Running both migrations twice produces no errors (IF NOT EXISTS guards) |

### Smoke Tests (post-deploy)

| Test | How |
|------|-----|
| All 6 crons registered | Vercel dashboard > Crons tab shows 6 entries |
| Crons respond to GET | `curl -H "Authorization: Bearer $CRON_SECRET" $URL` → 200 for each |
| Redirect works | Click a known short link → lands on destination with UTMs |
| Health check cron | Manual trigger → `health_status` updated on at least 1 link |

## Out of Scope (with rationale)

| Feature | Reason | When |
|---------|--------|------|
| A/B split testing | Needs conversion tracking (pixel/webhook) | After payment processor integration |
| `launches` table (funnel model) | Tags + utm_campaign naming convention covers 80% | When launch volume justifies |
| Conversion webhook handler | Depends on Stripe/Hotmart/Kiwify decision | Dedicated sprint |
| `ip_hash` column | `visitor_id` already pseudonymous; unsalted hash is reversible | Not planned |
| Per-QR UTM override | QR uses link's utm_medium; separate QR links solve this | Incremental improvement |
| Bot signatures (Discord/Slack/iMessage) | Current bot filter covers major platforms | PR-level fix |

## Files Affected (summary)

| Area | Files |
|------|-------|
| **New files** | `packages/links/src/core/utm-normalizer.ts`, `packages/links/src/core/click-id-passthrough.ts`, `apps/web/src/app/go/coming-soon/page.tsx`, `apps/web/src/app/api/cron/links-health-check/route.ts` |
| **Modified (redirect)** | `apps/web/src/app/go/[code]/route.ts`, `apps/web/src/lib/links/resolver.ts` |
| **Modified (UTM)** | `packages/links/src/core/utm-parser.ts`, `packages/links/src/types.ts`, `apps/web/src/lib/links/auto-link.ts` |
| **Modified (actions)** | `apps/web/src/app/cms/(authed)/links/actions.ts` |
| **Modified (click recording)** | `apps/web/src/lib/links/click-recorder.ts` |
| **Modified (UI)** | `packages/links-admin/src/components/link-form.tsx`, `packages/links-admin/src/hooks/use-link-form.ts` |
| **Modified (barrel)** | `packages/links/src/index.ts` (re-export new modules) |
| **Modified (config)** | `apps/web/vercel.json` |
| **Modified (cron fix)** | `apps/web/src/app/api/cron/links-anonymize-clicks/route.ts` (POST→GET, retention 90→30, field alignment), `apps/web/src/app/api/cron/links-partition-maintenance/route.ts` (POST→GET) |
| **Migration** | 2 migrations: `links_engine_a_plus_schema` (DDL) + `links_engine_a_plus_data` (data migration) |
| **Tests** | `packages/links/src/core/__tests__/utm-normalizer.test.ts`, `packages/links/src/core/__tests__/click-id-passthrough.test.ts`, integration tests for redirect handler, smoke tests for crons |
