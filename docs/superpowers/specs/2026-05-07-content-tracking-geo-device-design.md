# Content Tracking: Geo & Device Enrichment

**Date:** 2026-05-07
**Status:** Approved
**Scope:** Enrich blog content tracking with geo (country/city/region) and device type at the API route level, unifying shared infrastructure with the links module.

## Problem

`content_events` captures rich engagement data (scroll depth, time-on-page, read completion) but zero geo or device info. Meanwhile, the links module already resolves geo via Cloudflare headers and classifies bots — but that logic is locked inside `lib/links/`. Geo and device data only exist at request time; if not captured now, it's lost forever.

## Approach: Extract & Unify

Move geo resolution and bot detection to a shared `lib/request/` module. Both links and tracking import from there. Add device classification. Enrich the content tracking API route with geo + device on every insert.

## Architecture

### Shared Infrastructure: `lib/request/`

Three files, zero duplication:

**`lib/request/bot-patterns.ts`**
Unified bot list (merge of links' 6 patterns + tracking's 14 names — tracking's list is the superset). Exports `isBot(ua): boolean` and `BOT_REGEX` for SQL use. Consumers: links `click-recorder.ts`, tracking `route.ts`, aggregation RPC.

**`lib/request/geo.ts`**
`resolveGeo(headers): GeoData` with auto-detect fallback chain:
1. Vercel headers: `x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-country-region`
2. Cloudflare headers: `cf-ipcountry`, `cf-ipcity`, `cf-ipregion`
3. All null (local dev)

Env var `GEO_PROVIDER`: `auto` (default) or `stub` (tests/dev). No backward compat for `LINKS_GEO_PROVIDER` — clean break, update `.env.local`.

**`lib/request/device.ts`**
`classifyDevice(ua): DeviceType | null` where `DeviceType = 'mobile' | 'desktop' | 'tablet' | 'bot'`.

Detection order (first match wins):
1. `isBot(ua)` → `'bot'`
2. `/iPad|Android(?!.*Mobile)/i` → `'tablet'` (best-effort; some tablets classified as mobile)
3. `/Mobile|Android|iPhone|iPod/i` → `'mobile'`
4. Non-empty UA → `'desktop'`
5. Empty/null UA → `null`

### Migration

Additive, idempotent. 4 nullable columns on `content_events`:

```sql
ALTER TABLE content_events
  ADD COLUMN IF NOT EXISTS country     text,
  ADD COLUMN IF NOT EXISTS city        text,
  ADD COLUMN IF NOT EXISTS region      text,
  ADD COLUMN IF NOT EXISTS device_type text;

DO $$ BEGIN
  ALTER TABLE content_events
    ADD CONSTRAINT content_events_device_type_check
    CHECK (device_type IS NULL OR device_type IN ('mobile','desktop','tablet','bot'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

- Existing rows stay NULL (pre-feature data)
- No backfill needed
- No index (write-heavy table, queries via future aggregation)
- `content_metrics` untouched (aggregation layer updated when dashboard is built)

### API Route Changes (`POST /api/track/content`)

```
imports: resolveGeo from lib/request/geo, classifyDevice from lib/request/device

POST handler:
  1. existing: validate, rate-limit, parse body
  2. NEW: geo = resolveGeo(request.headers)
  3. NEW: deviceType = classifyDevice(rawUa)  // uses full UA before truncation
  4. existing: build rows
  5. NEW: each row gets country, city, region, device_type
  6. existing: insert, handle errors
```

LGPD: geo and device_type saved regardless of `hasConsent`. Country/city/device category are not PII in isolation (legitimate interest, Art. 7 IX). Consistent with how links already saves geo without consent gating.

Bot events still recorded (filtered at aggregation time, not insert time).

### Links Module Update

- `src/lib/links/click-recorder.ts`: import `resolveGeo` from `@/lib/request/geo`, import `isBot` from `@/lib/request/bot-patterns`. Remove local `isBot()` function.
- Delete `src/lib/links/geo.ts` (moved to shared)
- Delete `lib/tracking/bot-patterns.ts` (moved to shared). Update 2-3 imports.

### Tests

**New:**
- `test/lib/request/geo.test.ts` — Vercel headers priority, Cloudflare fallback, both present (Vercel wins), empty headers, stub mode
- `test/lib/request/device.test.ts` — mobile (iPhone, Android+Mobile), tablet (iPad, Android without Mobile), desktop (Chrome, Firefox), bot (all unified list), empty UA → null
- `test/lib/request/bot-patterns.test.ts` — every bot in unified list detected, common browsers not flagged

**Updated:**
- `test/lib/tracking/events-route.test.ts` — verify `country`, `city`, `region`, `device_type` in inserted rows; test with/without geo headers
- Delete `test/lib/tracking/bot-patterns.test.ts` (replaced by new shared test)

**Unchanged:**
- Links click-recorder tests (mock supabase, don't test geo directly)

### Env & Config

- New: `GEO_PROVIDER` — default `auto`, set `stub` for dev/test
- Removed: `LINKS_GEO_PROVIDER` — replaced by `GEO_PROVIDER`
- Update CLAUDE.md: operational flags section, replace `LINKS_GEO_PROVIDER` with `GEO_PROVIDER`

## What This Does NOT Change

- `content_metrics` table and `aggregate_content_events()` RPC — aggregation of geo/device deferred to dashboard sprint
- Client-side `use-content-tracking.ts` hook — no changes needed, enrichment is server-side
- `anonymous_id` strategy — stays client-side random (server-side visitor hash is a separate improvement)
- Link click recording behavior — same functionality, just imports from shared location

## File Impact Summary

| Action | File |
|--------|------|
| Create | `lib/request/geo.ts` |
| Create | `lib/request/device.ts` |
| Create | `lib/request/bot-patterns.ts` |
| Create | `supabase/migrations/2026MMDD_content_events_geo_device.sql` |
| Create | `test/lib/request/geo.test.ts` |
| Create | `test/lib/request/device.test.ts` |
| Create | `test/lib/request/bot-patterns.test.ts` |
| Edit | `src/app/api/track/content/route.ts` |
| Edit | `src/lib/links/click-recorder.ts` |
| Edit | `test/lib/tracking/events-route.test.ts` |
| Delete | `src/lib/links/geo.ts` |
| Delete | `lib/tracking/bot-patterns.ts` |
| Delete | `test/lib/tracking/bot-patterns.test.ts` |
| Edit | `CLAUDE.md` (env var docs) |
