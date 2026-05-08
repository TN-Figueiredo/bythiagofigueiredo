# Content Tracking: Geo & Device Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich blog content tracking with geo (country/city/region) and device type data at the server-side API route level, unifying shared infrastructure with the links module.

**Architecture:** Extract geo resolution and bot detection from `lib/links/` into a shared `lib/request/` module. Add Vercel header fallback for geo. Add device classification. Wire geo + device into the content tracking API route. Add 4 nullable columns to `content_events` via migration.

**Tech Stack:** TypeScript 5, Vitest, Supabase (PostgreSQL 17), Next.js 15 API routes

---

## File Structure

| Action | Path (relative to `apps/web/`) | Responsibility |
|--------|-------------------------------|----------------|
| Create | `lib/request/bot-patterns.ts` | Unified bot detection: `isBot()`, `BOT_REGEX`, `BOT_NAMES` |
| Create | `lib/request/geo.ts` | Geo resolution with Vercel → Cloudflare fallback |
| Create | `lib/request/device.ts` | UA-based device classification |
| Create | `test/lib/request/bot-patterns.test.ts` | Bot detection tests |
| Create | `test/lib/request/geo.test.ts` | Geo resolution tests |
| Create | `test/lib/request/device.test.ts` | Device classifier tests |
| Edit | `src/lib/links/click-recorder.ts` | Import from shared `lib/request/` |
| Delete | `src/lib/links/geo.ts` | Moved to `lib/request/geo.ts` |
| Edit | `test/lib/links/click-recorder.test.ts` | Update import after `isBot` moves |
| Edit | `test/lib/links/geo.test.ts` | Repoint import to `lib/request/geo` |
| Delete | `lib/tracking/bot-patterns.ts` | Moved to `lib/request/bot-patterns.ts` |
| Delete | `test/lib/tracking/bot-patterns.test.ts` | Replaced by `test/lib/request/bot-patterns.test.ts` |
| Edit | `src/app/api/track/content/route.ts` | Add geo + device enrichment |
| Edit | `test/lib/tracking/events-route.test.ts` | Test geo/device columns in inserted rows |
| Create | `(repo root) supabase/migrations/20260508000001_content_events_geo_device.sql` | Add 4 columns + constraint |
| Edit | `(repo root) CLAUDE.md` | Update `LINKS_GEO_PROVIDER` → `GEO_PROVIDER` |
| Edit | `.env.local.example` | Rename env var |
| Edit | `.env.example` | Rename env var |

---

### Task 1: Create shared bot-patterns module

**Files:**
- Create: `apps/web/lib/request/bot-patterns.ts`
- Create: `apps/web/test/lib/request/bot-patterns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/request/bot-patterns.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isBot, BOT_NAMES, BOT_REGEX } from '../../../lib/request/bot-patterns'

describe('isBot', () => {
  it.each([
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['bingbot', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['Baiduspider', 'Mozilla/5.0 (compatible; Baiduspider/2.0)'],
    ['YandexBot', 'Mozilla/5.0 (compatible; YandexBot/3.0)'],
    ['DuckDuckBot', 'DuckDuckBot/1.1'],
    ['Bytespider', 'Bytespider; bytedance.com'],
    ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 GPTBot/1.0'],
    ['ClaudeBot', 'ClaudeBot/1.0'],
    ['anthropic-ai', 'anthropic-ai/1.0'],
    ['CCBot', 'CCBot/2.0 (https://commoncrawl.org/faq/)'],
    ['PerplexityBot', 'PerplexityBot/1.0'],
    ['Amazonbot', 'Mozilla/5.0 (compatible; Amazonbot/0.1)'],
    ['facebookexternalhit', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
    ['Twitterbot', 'Twitterbot/1.0'],
    ['LinkedInBot', 'LinkedInBot/1.0'],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)'],
  ])('detects %s', (_name, ua) => {
    expect(isBot(ua)).toBe(true)
  })

  it('allows normal Chrome UA', () => {
    expect(isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe(false)
  })

  it('allows normal Firefox UA', () => {
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe(false)
  })

  it('returns false for null/undefined UA', () => {
    expect(isBot(null)).toBe(false)
    expect(isBot(undefined)).toBe(false)
  })

  it('uses word boundaries — does not false-positive on substrings', () => {
    expect(isBot('MyGooglebotSpoofTool/1.0')).toBe(false)
  })
})

describe('BOT_NAMES', () => {
  it('contains at least 16 bot names (superset of links + tracking)', () => {
    expect(BOT_NAMES.length).toBeGreaterThanOrEqual(16)
  })

  it('includes all key bots', () => {
    expect(BOT_NAMES).toContain('Googlebot')
    expect(BOT_NAMES).toContain('LinkedInBot')
    expect(BOT_NAMES).toContain('Slackbot')
    expect(BOT_NAMES).toContain('facebookexternalhit')
  })
})

describe('BOT_REGEX', () => {
  it('exports a regex usable in SQL SIMILAR TO patterns', () => {
    expect(BOT_REGEX).toBeTypeOf('string')
    expect(BOT_REGEX).toContain('Googlebot')
    expect(BOT_REGEX).toContain('LinkedInBot')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/request/bot-patterns.test.ts`
Expected: FAIL — module `lib/request/bot-patterns` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/request/bot-patterns.ts`:

```typescript
export const BOT_NAMES = [
  'Googlebot', 'bingbot', 'Baiduspider', 'YandexBot', 'DuckDuckBot',
  'Bytespider', 'GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot',
  'PerplexityBot', 'Amazonbot', 'facebookexternalhit', 'Twitterbot',
  'LinkedInBot', 'Slackbot',
] as const

const BOT_RE =
  /\b(Googlebot|bingbot|Baiduspider|YandexBot|DuckDuckBot|Bytespider|GPTBot|ClaudeBot|anthropic-ai|CCBot|PerplexityBot|Amazonbot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot)\b/i

export const BOT_REGEX = BOT_NAMES.join('|')

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return BOT_RE.test(userAgent)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/request/bot-patterns.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/request/bot-patterns.ts apps/web/test/lib/request/bot-patterns.test.ts
git commit -m "feat(tracking): create shared bot-patterns module in lib/request/"
```

---

### Task 2: Create shared geo module

**Files:**
- Create: `apps/web/lib/request/geo.ts`
- Create: `apps/web/test/lib/request/geo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/request/geo.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('resolveGeo', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function loadGeo() {
    const mod = await import('../../../lib/request/geo')
    return mod.resolveGeo
  }

  it('prefers Vercel headers over Cloudflare', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'x-vercel-ip-country': 'US',
      'x-vercel-ip-city': 'New York',
      'x-vercel-ip-country-region': 'NY',
      'cf-ipcountry': 'BR',
      'cf-ipcity': 'Sao Paulo',
      'cf-ipregion': 'SP',
    })
    expect(resolveGeo(headers)).toEqual({ country: 'US', city: 'New York', region: 'NY' })
  })

  it('falls back to Cloudflare headers when Vercel absent', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'cf-ipcountry': 'BR',
      'cf-ipcity': 'Sao Paulo',
      'cf-ipregion': 'SP',
    })
    expect(resolveGeo(headers)).toEqual({ country: 'BR', city: 'Sao Paulo', region: 'SP' })
  })

  it('returns partial geo when some headers missing', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({ 'cf-ipcountry': 'US' })
    expect(resolveGeo(headers)).toEqual({ country: 'US', city: null, region: null })
  })

  it('returns all nulls when no geo headers present', async () => {
    const resolveGeo = await loadGeo()
    expect(resolveGeo(new Headers({}))).toEqual({ country: null, city: null, region: null })
  })

  it('returns all nulls when GEO_PROVIDER=stub', async () => {
    vi.stubEnv('GEO_PROVIDER', 'stub')
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'cf-ipcountry': 'BR',
      'x-vercel-ip-country': 'US',
    })
    expect(resolveGeo(headers)).toEqual({ country: null, city: null, region: null })
  })

  it('uses Vercel country even when city comes from Cloudflare', async () => {
    const resolveGeo = await loadGeo()
    const headers = new Headers({
      'x-vercel-ip-country': 'CA',
      'cf-ipcity': 'Toronto',
    })
    const geo = resolveGeo(headers)
    expect(geo.country).toBe('CA')
    expect(geo.city).toBe('Toronto')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/request/geo.test.ts`
Expected: FAIL — module `lib/request/geo` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/request/geo.ts`:

```typescript
export interface GeoData {
  country: string | null
  city: string | null
  region: string | null
}

type GeoProvider = 'auto' | 'stub'

function getProvider(): GeoProvider {
  const env = process.env.GEO_PROVIDER ?? 'auto'
  if (env === 'stub') return 'stub'
  return 'auto'
}

function resolveAuto(headers: Headers): GeoData {
  const country =
    headers.get('x-vercel-ip-country') ??
    headers.get('cf-ipcountry') ??
    null
  const city =
    headers.get('x-vercel-ip-city') ??
    headers.get('cf-ipcity') ??
    null
  const region =
    headers.get('x-vercel-ip-country-region') ??
    headers.get('cf-ipregion') ??
    null
  return { country, city, region }
}

export function resolveGeo(headers: Headers): GeoData {
  if (getProvider() === 'stub') {
    return { country: null, city: null, region: null }
  }
  return resolveAuto(headers)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/request/geo.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/request/geo.ts apps/web/test/lib/request/geo.test.ts
git commit -m "feat(tracking): create shared geo module with Vercel+Cloudflare fallback"
```

---

### Task 3: Create device classifier

**Files:**
- Create: `apps/web/lib/request/device.ts`
- Create: `apps/web/test/lib/request/device.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/request/device.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyDevice, type DeviceType } from '../../../lib/request/device'

describe('classifyDevice', () => {
  it('returns "bot" for Googlebot', () => {
    expect(classifyDevice('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe('bot')
  })

  it('returns "bot" for ClaudeBot', () => {
    expect(classifyDevice('ClaudeBot/1.0')).toBe('bot')
  })

  it('returns "tablet" for iPad', () => {
    expect(classifyDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('tablet')
  })

  it('returns "tablet" for Android tablet (no Mobile token)', () => {
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 Chrome/125.0')).toBe('tablet')
  })

  it('returns "mobile" for iPhone', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')).toBe('mobile')
  })

  it('returns "mobile" for Android phone (with Mobile token)', () => {
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile')).toBe('mobile')
  })

  it('returns "desktop" for Chrome on macOS', () => {
    expect(classifyDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0')).toBe('desktop')
  })

  it('returns "desktop" for Firefox on Windows', () => {
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0')).toBe('desktop')
  })

  it('returns null for null UA', () => {
    expect(classifyDevice(null)).toBeNull()
  })

  it('returns null for undefined UA', () => {
    expect(classifyDevice(undefined)).toBeNull()
  })

  it('returns null for empty string UA', () => {
    expect(classifyDevice('')).toBeNull()
  })

  it('bot detection takes priority over mobile tokens', () => {
    expect(classifyDevice('facebookexternalhit/1.1 Mobile')).toBe('bot')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/request/device.test.ts`
Expected: FAIL — module `lib/request/device` does not exist.

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/request/device.ts`:

```typescript
import { isBot } from './bot-patterns'

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'bot'

const TABLET_RE = /iPad|Android(?!.*Mobile)/i
const MOBILE_RE = /Mobile|Android|iPhone|iPod/i

export function classifyDevice(userAgent: string | null | undefined): DeviceType | null {
  if (!userAgent) return null
  if (isBot(userAgent)) return 'bot'
  if (TABLET_RE.test(userAgent)) return 'tablet'
  if (MOBILE_RE.test(userAgent)) return 'mobile'
  return 'desktop'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/request/device.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/request/device.ts apps/web/test/lib/request/device.test.ts
git commit -m "feat(tracking): create device classifier in lib/request/"
```

---

### Task 4: Migrate links module to shared imports

**Files:**
- Edit: `apps/web/src/lib/links/click-recorder.ts`
- Delete: `apps/web/src/lib/links/geo.ts`
- Edit: `apps/web/test/lib/links/geo.test.ts` → repoint import
- Edit: `apps/web/test/lib/links/click-recorder.test.ts` → tests still pass

- [ ] **Step 1: Update click-recorder.ts imports and remove local isBot**

Edit `apps/web/src/lib/links/click-recorder.ts`:

Replace the import and local bot code:

```typescript
// OLD (lines 1-13):
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { resolveGeo } from './geo'

const BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /twitterbot/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /slackbot/i,
]
```

Replace with:

```typescript
// NEW:
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { resolveGeo } from '../../../lib/request/geo'
import { isBot as isBotShared } from '../../../lib/request/bot-patterns'
```

Replace the local `isBot` function (line 30-32):

```typescript
// OLD:
export function isBot(userAgent: string): boolean {
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent))
}
```

With:

```typescript
// NEW:
export function isBot(userAgent: string): boolean {
  return isBotShared(userAgent)
}
```

This preserves the export for backward compat with click-recorder tests that import `isBot` from this file.

- [ ] **Step 2: Update geo test to import from new location**

Edit `apps/web/test/lib/links/geo.test.ts`:

Replace line 2:
```typescript
// OLD:
import { resolveGeo } from '../../../src/lib/links/geo'
```
With:
```typescript
// NEW:
import { resolveGeo } from '../../../lib/request/geo'
```

Replace line 6 and line 35 (env var name):
```typescript
// OLD:
vi.stubEnv('LINKS_GEO_PROVIDER', 'cloudflare')
// and
vi.stubEnv('LINKS_GEO_PROVIDER', 'stub')
```
With:
```typescript
// NEW:
vi.stubEnv('GEO_PROVIDER', 'auto')
// and
vi.stubEnv('GEO_PROVIDER', 'stub')
```

Replace line 37 (dynamic import path):
```typescript
// OLD:
const mod = await import('../../../src/lib/links/geo')
```
With:
```typescript
// NEW:
const mod = await import('../../../lib/request/geo')
```

- [ ] **Step 3: Delete old geo file**

Delete `apps/web/src/lib/links/geo.ts`.

- [ ] **Step 4: Run links tests to verify nothing broke**

Run: `cd apps/web && npx vitest run test/lib/links/`
Expected: all links tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/links/click-recorder.ts apps/web/test/lib/links/geo.test.ts apps/web/test/lib/links/click-recorder.test.ts
git rm apps/web/src/lib/links/geo.ts
git commit -m "refactor(links): migrate geo and bot-patterns to shared lib/request/"
```

---

### Task 5: Delete old tracking bot-patterns

**Files:**
- Delete: `apps/web/lib/tracking/bot-patterns.ts`
- Delete: `apps/web/test/lib/tracking/bot-patterns.test.ts`

- [ ] **Step 1: Verify no production code imports the old module**

Run: `grep -rn "from.*tracking/bot-patterns" apps/web/src apps/web/lib --include="*.ts" --include="*.tsx"`
Expected: no output (only test files import it, which we're deleting).

- [ ] **Step 2: Delete old files**

```bash
git rm apps/web/lib/tracking/bot-patterns.ts apps/web/test/lib/tracking/bot-patterns.test.ts
```

- [ ] **Step 3: Run all tracking tests to ensure nothing broke**

Run: `cd apps/web && npx vitest run test/lib/tracking/`
Expected: all tracking tests PASS (events-route.test.ts doesn't import bot-patterns).

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(tracking): remove old bot-patterns (replaced by lib/request/)"
```

---

### Task 6: Database migration

**Files:**
- Create: `supabase/migrations/20260508000001_content_events_geo_device.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260508000001_content_events_geo_device.sql`:

```sql
-- Add geo and device columns to content_events for analytics enrichment.
-- All nullable: existing rows stay NULL (pre-feature data). No backfill needed.

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

- [ ] **Step 2: Verify migration is valid SQL**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && cat supabase/migrations/20260508000001_content_events_geo_device.sql`
Verify: SQL is syntactically correct and idempotent.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260508000001_content_events_geo_device.sql
git commit -m "feat(db): add geo and device_type columns to content_events"
```

---

### Task 7: Enrich content tracking API route

**Files:**
- Edit: `apps/web/src/app/api/track/content/route.ts`
- Edit: `apps/web/test/lib/tracking/events-route.test.ts`

- [ ] **Step 1: Write failing tests for geo/device enrichment**

Add to `apps/web/test/lib/tracking/events-route.test.ts` — append these tests inside the existing `describe('POST /api/track/content')` block:

```typescript
  it('includes geo data from Vercel headers in inserted rows', async () => {
    await callRoute(
      { events: [validEvent] },
      {
        'x-vercel-ip-country': 'BR',
        'x-vercel-ip-city': 'Sao Paulo',
        'x-vercel-ip-country-region': 'SP',
      },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('BR')
    expect(rows[0].city).toBe('Sao Paulo')
    expect(rows[0].region).toBe('SP')
  })

  it('includes geo from Cloudflare headers as fallback', async () => {
    await callRoute(
      { events: [validEvent] },
      {
        'cf-ipcountry': 'US',
        'cf-ipcity': 'New York',
        'cf-ipregion': 'NY',
      },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('US')
    expect(rows[0].city).toBe('New York')
    expect(rows[0].region).toBe('NY')
  })

  it('sets null geo when no geo headers present', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBeNull()
    expect(rows[0].city).toBeNull()
    expect(rows[0].region).toBeNull()
  })

  it('classifies device_type from user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('mobile')
  })

  it('classifies desktop user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('desktop')
  })

  it('classifies bot user-agent', async () => {
    await callRoute(
      { events: [validEvent] },
      { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBe('bot')
  })

  it('sets null device_type when no user-agent header', async () => {
    await callRoute({ events: [validEvent] })
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].device_type).toBeNull()
  })

  it('saves geo regardless of hasConsent (legitimate interest)', async () => {
    await callRoute(
      { events: [{ ...validEvent, hasConsent: false }] },
      { 'x-vercel-ip-country': 'DE' },
    )
    const rows = mockInsert.mock.calls[0][0] as Record<string, unknown>[]
    expect(rows[0].country).toBe('DE')
    expect(rows[0].user_agent).toBeNull()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/tracking/events-route.test.ts`
Expected: FAIL — `country`, `city`, `region`, `device_type` not present in rows.

- [ ] **Step 3: Update the API route**

Edit `apps/web/src/app/api/track/content/route.ts`:

Add imports after line 1:

```typescript
import { resolveGeo } from '@/lib/request/geo'
import { classifyDevice } from '@/lib/request/device'
```

In the POST handler, after line 58 (`const rawUa = request.headers.get('user-agent')`), add:

```typescript
  const geo = resolveGeo(request.headers)
  const deviceType = classifyDevice(rawUa)
```

Update the row mapping (lines 64-77) to add the 4 new fields:

```typescript
  const rows = parsed.events.map((e) => ({
    session_id: e.sessionId,
    site_id: e.siteId,
    resource_type: e.resourceType,
    resource_id: e.resourceId,
    event_type: e.eventType,
    anonymous_id: e.anonymousId,
    locale: e.locale ?? null,
    referrer_src: e.referrerSrc ?? null,
    read_depth: e.readDepth ?? null,
    time_on_page: e.timeOnPage ?? null,
    has_consent: e.hasConsent,
    user_agent: e.hasConsent ? userAgent : null,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    device_type: deviceType,
  }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/tracking/events-route.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/track/content/route.ts apps/web/test/lib/tracking/events-route.test.ts
git commit -m "feat(tracking): enrich content events with geo and device_type"
```

---

### Task 8: Update env vars and documentation

**Files:**
- Edit: `CLAUDE.md` (repo root)
- Edit: `apps/web/.env.local.example`
- Edit: `apps/web/.env.example`

- [ ] **Step 1: Update CLAUDE.md operational flags**

In `CLAUDE.md`, line 114, replace:

```
Links: `LINKS_SHORT_DOMAIN` (string), `LINKS_GEO_PROVIDER` (string — default `cloudflare`)
```

With:

```
Links: `LINKS_SHORT_DOMAIN` (string)
Tracking: `GEO_PROVIDER` (string — default `auto`, set `stub` for dev/test)
```

- [ ] **Step 2: Update .env.local.example**

In `apps/web/.env.local.example`, replace:

```
LINKS_GEO_PROVIDER=cloudflare
```

With:

```
GEO_PROVIDER=auto
```

- [ ] **Step 3: Update .env.example**

In `apps/web/.env.example`, replace:

```
LINKS_GEO_PROVIDER=cloudflare           # geo lookup provider (default: cloudflare)
```

With:

```
GEO_PROVIDER=auto                       # geo lookup: auto (Vercel→Cloudflare fallback) or stub
```

- [ ] **Step 4: Run full test suite**

Run: `cd apps/web && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: all tests PASS (except pre-existing instagram failures which are unrelated).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md apps/web/.env.local.example apps/web/.env.example
git commit -m "docs: rename LINKS_GEO_PROVIDER to GEO_PROVIDER"
```
