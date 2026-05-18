# Links Engine A++ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Links Engine from a basic shortener to a marketing-grade system with UTM normalization, ad platform click ID passthrough, link lifecycle management, and LGPD-compliant analytics.

**Architecture:** 4 implementation blocks ordered by impact. Bloco 0 fixes P0 bugs in the existing system (cron registration, HTTP methods, UTM overwrite, click recording). Bloco 1 adds a shared UTM normalizer with DB trigger defense-in-depth. Bloco 2 adds click ID passthrough (gclid/fbclid/etc) with security sanitization. Bloco 3 adds lifecycle features (launched_at, activates_at, health checks, batch ops). Two DB migrations: schema DDL first, data migration second.

**Tech Stack:** TypeScript 5, Next.js 15, Supabase (PostgreSQL 17), Vitest, Zod, `@tn-figueiredo/links` package (ESM)

**Spec:** `docs/superpowers/specs/2026-05-18-links-engine-a-plus-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `packages/links/src/core/utm-normalizer.ts` | Shared UTM normalization pipeline — single source of truth for both app and DB layers |
| `packages/links/src/core/utm-normalizer.test.ts` | TDD tests for normalizer including idempotence property tests |
| `packages/links/src/core/click-id-passthrough.ts` | Safe forwarding of ad click IDs (gclid/fbclid/etc) through redirects |
| `packages/links/src/core/click-id-passthrough.test.ts` | Security-focused tests for passthrough sanitization |
| `apps/web/src/app/go/coming-soon/page.tsx` | Server component for pre-activation display |
| `apps/web/src/app/api/cron/links-health-check/route.ts` | Daily destination URL health verification |
| `supabase/migrations/YYYYMMDD000001_links_engine_a_plus_schema.sql` | DDL: columns, constraints, functions, triggers, indexes |
| `supabase/migrations/YYYYMMDD000002_links_engine_a_plus_data.sql` | Data migration: backup + normalize existing UTMs + batch RPC |

### Modified Files

| File | Changes |
|------|---------|
| `packages/links/src/types.ts` | Add `utmId` to `UtmParams`/`CreateLinkInput`/`UpdateLinkInput`/`RecordClickInput`, add `launchedAt`/`activatesAt`/`customParams`/`healthStatus`/`passClickIds` to `TrackedLink`, add `'not_yet_active'` to `RedirectGuardFailure`, add `adClickIds`/`utmId` to `LinkClick` |
| `packages/links/src/index.ts` | Re-export new utm-normalizer and click-id-passthrough modules |
| `packages/links/src/core/utm-parser.ts` | Add `utmId` support to `parseUtm`/`buildUtmUrl`/`extractUtmFromSearchParams` |
| `packages/links/src/core/redirect-resolver.ts` | Add `not_yet_active` guard for `activatesAt`, append `customParams` in `buildRedirectUrl` |
| `apps/web/vercel.json` | Add 6 link cron entries |
| `apps/web/src/app/api/cron/links-anonymize-clicks/route.ts` | POST→GET, retention 90→30, align nullified fields |
| `apps/web/src/app/api/cron/links-partition-maintenance/route.ts` | POST→GET |
| `apps/web/src/app/go/[code]/route.ts` | Fix UTM overwrite, add click ID passthrough, add activates_at guard, pass UTMs to recordClick, add launched_at auto-set, add Cache-Control for 301+clickIds |
| `apps/web/src/lib/links/resolver.ts` | Extend `ResolvedLink` with new columns, expand SELECT |
| `apps/web/src/lib/links/click-recorder.ts` | Accept UTM values + ad_click_ids in input, include in INSERT, auto-set launched_at |
| `apps/web/src/lib/links/auto-link.ts` | Change redirect_type 301→307, fix utm_medium, fix campaign naming, call normalizer |
| `apps/web/src/app/cms/(authed)/links/actions.ts` | Add 307/308 to Zod enum, add utm_id, add normalization transforms, add batch actions |
| `packages/links-admin/src/components/link-form.tsx` | Add utm_id field, 307/308 redirect options, activates_at input, custom_params editor, pass_click_ids toggle, utm_medium autocomplete |
| `packages/links-admin/src/hooks/use-link-form.ts` | Add new fields to form state, smart defaults by source_type |

---

## Task 1: UTM Normalizer — Tests

**Files:**
- Create: `packages/links/src/core/utm-normalizer.ts` (stub)
- Create: `packages/links/src/core/utm-normalizer.test.ts`

- [ ] **Step 1: Create the normalizer stub**

```typescript
// packages/links/src/core/utm-normalizer.ts
export type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

export function normalizeUtmValue(_field: UtmField, _value: string | null | undefined): string | null {
  throw new Error('Not implemented')
}

export interface UtmFieldsInput {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  utm_id?: string | null
}

export interface UtmFieldsNormalized {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  utm_id: string | null
}

export function normalizeAllUtmFields(_input: UtmFieldsInput): UtmFieldsNormalized {
  throw new Error('Not implemented')
}

export function slugifyForCampaign(_title: string): string {
  throw new Error('Not implemented')
}

export function isKnownMedium(_value: string): boolean {
  throw new Error('Not implemented')
}

export const GA4_MEDIUM_SUGGESTIONS: string[] = []

export const KNOWN_UTM_SOURCES: string[] = []
```

- [ ] **Step 2: Write the failing tests**

```typescript
// packages/links/src/core/utm-normalizer.test.ts
import { describe, it, expect } from 'vitest'
import {
  normalizeUtmValue,
  normalizeAllUtmFields,
  slugifyForCampaign,
  isKnownMedium,
  GA4_MEDIUM_SUGGESTIONS,
  KNOWN_UTM_SOURCES,
} from './utm-normalizer.js'
import type { UtmField } from './utm-normalizer.js'

describe('UTM Normalizer', () => {
  describe('normalizeUtmValue', () => {
    it('returns null for null input', () => {
      expect(normalizeUtmValue('utm_source', null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(normalizeUtmValue('utm_source', undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(normalizeUtmValue('utm_source', '')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(normalizeUtmValue('utm_source', '   ')).toBeNull()
    })

    it('lowercases values', () => {
      expect(normalizeUtmValue('utm_source', 'Google')).toBe('google')
    })

    it('strips diacritics via NFKD', () => {
      expect(normalizeUtmValue('utm_campaign', 'café')).toBe('cafe')
      expect(normalizeUtmValue('utm_campaign', 'lançamento')).toBe('lancamento')
      expect(normalizeUtmValue('utm_campaign', 'promoção')).toBe('promocao')
    })

    it('replaces whitespace with hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring sale 2026')).toBe('spring-sale-2026')
    })

    it('collapses multiple hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring--sale---2026')).toBe('spring-sale-2026')
    })

    it('trims leading and trailing hyphens', () => {
      expect(normalizeUtmValue('utm_campaign', '-spring-sale-')).toBe('spring-sale')
    })

    it('strips non-alphanumeric chars except dots, underscores, hyphens', () => {
      expect(normalizeUtmValue('utm_source', 'goo!gle@ads')).toBe('googleads')
      expect(normalizeUtmValue('utm_campaign', 'sale_2026.q3')).toBe('sale_2026.q3')
    })

    it('decodes URL-encoded values', () => {
      expect(normalizeUtmValue('utm_campaign', 'spring%20sale')).toBe('spring-sale')
    })

    it('handles malformed percent-encoding gracefully', () => {
      expect(normalizeUtmValue('utm_source', '%ZZbad')).toBe('zzbad')
    })

    it('preserves dots and underscores', () => {
      expect(normalizeUtmValue('utm_medium', 'paid_social')).toBe('paid_social')
      expect(normalizeUtmValue('utm_source', 'news.google.com')).toBe('news.google.com')
    })

    // utm_term special handling: preserves + signs (GA4 keyword convention)
    it('preserves + in utm_term (GA4 keyword separator)', () => {
      expect(normalizeUtmValue('utm_term', 'buy+flowers+online')).toBe('buy+flowers+online')
    })

    it('lowercases utm_term but does not strip special chars', () => {
      expect(normalizeUtmValue('utm_term', 'Buy Flowers')).toBe('buy flowers')
    })

    it('trims utm_term whitespace', () => {
      expect(normalizeUtmValue('utm_term', '  flowers  ')).toBe('flowers')
    })

    it('returns null for empty utm_term', () => {
      expect(normalizeUtmValue('utm_term', '')).toBeNull()
    })

    it('normalizes utm_id like other fields', () => {
      expect(normalizeUtmValue('utm_id', 'Campaign-123')).toBe('campaign-123')
    })
  })

  describe('idempotence', () => {
    const samples = [
      'Google', 'paid_social', 'café-lançamento', 'spring sale 2026',
      'CAMPAIGN--123', '-trimmed-', 'news.google.com', 'a!@#b',
      'spring%20sale', 'Campaign-123', 'UPPER_CASE.value',
    ]
    const fields: UtmField[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id']

    for (const sample of samples) {
      for (const field of fields) {
        it(`normalize(normalize("${sample}")) === normalize("${sample}") for ${field}`, () => {
          const once = normalizeUtmValue(field, sample)
          const twice = normalizeUtmValue(field, once)
          expect(twice).toBe(once)
        })
      }
    }

    it('idempotent for utm_term', () => {
      const samples = ['Buy Flowers', 'buy+flowers+online', '  spaces  ']
      for (const s of samples) {
        const once = normalizeUtmValue('utm_term', s)
        const twice = normalizeUtmValue('utm_term', once)
        expect(twice).toBe(once)
      }
    })
  })

  describe('normalizeAllUtmFields', () => {
    it('normalizes all fields at once', () => {
      const result = normalizeAllUtmFields({
        utm_source: 'Google',
        utm_medium: 'PAID_SOCIAL',
        utm_campaign: 'Café Lançamento',
        utm_term: 'Buy Flowers',
        utm_content: 'Banner-A',
        utm_id: 'Camp-1',
      })
      expect(result).toEqual({
        utm_source: 'google',
        utm_medium: 'paid_social',
        utm_campaign: 'cafe-lancamento',
        utm_term: 'buy flowers',
        utm_content: 'banner-a',
        utm_id: 'camp-1',
      })
    })

    it('handles all-null input', () => {
      const result = normalizeAllUtmFields({})
      expect(result).toEqual({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        utm_id: null,
      })
    })
  })

  describe('slugifyForCampaign', () => {
    it('converts title to campaign slug', () => {
      expect(slugifyForCampaign('Como Investir em 2026')).toBe('como-investir-em-2026')
    })

    it('strips diacritics in title', () => {
      expect(slugifyForCampaign('Lançamento Promoção')).toBe('lancamento-promocao')
    })

    it('returns empty string for empty title', () => {
      expect(slugifyForCampaign('')).toBe('')
    })
  })

  describe('isKnownMedium', () => {
    it('returns true for GA4 standard mediums', () => {
      expect(isKnownMedium('cpc')).toBe(true)
      expect(isKnownMedium('paid_social')).toBe(true)
      expect(isKnownMedium('email')).toBe(true)
      expect(isKnownMedium('organic')).toBe(true)
    })

    it('returns false for unknown mediums', () => {
      expect(isKnownMedium('banana')).toBe(false)
      expect(isKnownMedium('paid-social')).toBe(false) // hyphen, not underscore
    })
  })

  describe('constants', () => {
    it('GA4_MEDIUM_SUGGESTIONS has standard mediums', () => {
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('cpc')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('paid_social')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('email')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('social')
      expect(GA4_MEDIUM_SUGGESTIONS).toContain('organic')
      expect(GA4_MEDIUM_SUGGESTIONS.length).toBeGreaterThan(20)
    })

    it('KNOWN_UTM_SOURCES has major platforms', () => {
      expect(KNOWN_UTM_SOURCES).toContain('google')
      expect(KNOWN_UTM_SOURCES).toContain('youtube')
      expect(KNOWN_UTM_SOURCES).toContain('facebook')
      expect(KNOWN_UTM_SOURCES).toContain('instagram')
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/links && npx vitest run src/core/utm-normalizer.test.ts`
Expected: All tests FAIL (stub throws "Not implemented")

- [ ] **Step 4: Commit test file**

```bash
git add packages/links/src/core/utm-normalizer.ts packages/links/src/core/utm-normalizer.test.ts
git commit -m "test(links): failing tests for UTM normalizer"
```

---

## Task 2: UTM Normalizer — Implementation

**Files:**
- Modify: `packages/links/src/core/utm-normalizer.ts`

- [ ] **Step 1: Implement the full normalizer**

Replace the stub in `packages/links/src/core/utm-normalizer.ts`:

```typescript
// packages/links/src/core/utm-normalizer.ts

export type UtmField = 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content' | 'utm_id'

export interface UtmFieldsInput {
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  utm_term?: string | null
  utm_content?: string | null
  utm_id?: string | null
}

export interface UtmFieldsNormalized {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  utm_id: string | null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
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

export const GA4_MEDIUM_SUGGESTIONS = [
  'cpc', 'cpm', 'cpv', 'ppc',
  'paid_social', 'paid_search', 'retargeting',
  'display', 'banner',
  'email', 'social', 'referral', 'affiliate',
  'sms', 'qr', 'video', 'whatsapp', 'push',
  'podcast', 'print', 'organic', 'organic_social',
  'in-app', 'direct_mail', 'audio',
] as const

export function isKnownMedium(value: string): boolean {
  return (GA4_MEDIUM_SUGGESTIONS as readonly string[]).includes(value)
}

export const KNOWN_UTM_SOURCES = [
  'google', 'youtube', 'facebook', 'instagram', 'tiktok',
  'twitter', 'linkedin', 'pinterest', 'reddit', 'whatsapp',
  'telegram', 'bluesky', 'threads', 'newsletter', 'email',
  'bing', 'duckduckgo', 'spotify', 'podcast',
] as const
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/links && npx vitest run src/core/utm-normalizer.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/links/src/core/utm-normalizer.ts
git commit -m "feat(links): UTM normalizer with NFKD, GA4 mediums, slugify"
```

---

## Task 3: Click ID Passthrough — Tests

**Files:**
- Create: `packages/links/src/core/click-id-passthrough.ts` (stub)
- Create: `packages/links/src/core/click-id-passthrough.test.ts`

- [ ] **Step 1: Create the passthrough stub**

```typescript
// packages/links/src/core/click-id-passthrough.ts

export const KNOWN_CLICK_IDS = new Set<string>([
  'gclid', 'gbraid', 'wbraid', 'gclsrc', 'dclid',
  'fbclid', 'msclkid', 'ttclid', 'twclid',
  'li_fat_id', 'epik', 'rdt_cid', 'scid',
])

export const CANONICAL_CASING: Record<string, string> = {
  gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid',
  gclsrc: 'gclsrc', dclid: 'dclid', fbclid: 'fbclid',
  msclkid: 'msclkid', ttclid: 'ttclid', twclid: 'twclid',
  li_fat_id: 'li_fat_id', epik: 'epik', rdt_cid: 'rdt_cid',
  scid: 'ScCid',
}

export interface PassthroughResult {
  url: URL
  forwarded: string[]
  rejected: string[]
}

export function safePassthrough(_incomingUrl: URL, _destinationUrl: URL): PassthroughResult {
  throw new Error('Not implemented')
}

export function extractClickIds(_url: URL): Record<string, string> {
  throw new Error('Not implemented')
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// packages/links/src/core/click-id-passthrough.test.ts
import { describe, it, expect } from 'vitest'
import { safePassthrough, extractClickIds, KNOWN_CLICK_IDS } from './click-id-passthrough.js'

describe('Click ID Passthrough', () => {
  const dest = () => new URL('https://example.com/page?existing=keep')

  describe('safePassthrough', () => {
    it('forwards known click IDs to destination', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc123&fbclid=def456')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('gclid')).toBe('abc123')
      expect(result.url.searchParams.get('fbclid')).toBe('def456')
      expect(result.forwarded).toEqual(['gclid', 'fbclid'])
      expect(result.rejected).toEqual([])
    })

    it('preserves existing destination params', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc123')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('existing')).toBe('keep')
    })

    it('drops unknown params', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc&unknown=evil')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(true)
      expect(result.url.searchParams.has('unknown')).toBe(false)
    })

    it('skips utm_* params (handled separately)', () => {
      const incoming = new URL('https://go.site.com/abc?utm_source=google&gclid=abc')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('utm_source')).toBe(false)
      expect(result.url.searchParams.has('gclid')).toBe(true)
    })

    it('rejects values longer than 500 chars', () => {
      const longValue = 'a'.repeat(501)
      const incoming = new URL(`https://go.site.com/abc?gclid=${longValue}`)
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.rejected).toEqual(['gclid'])
    })

    it('accepts values exactly 500 chars', () => {
      const value = 'a'.repeat(500)
      const incoming = new URL(`https://go.site.com/abc?gclid=${value}`)
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('gclid')).toBe(value)
    })

    it('rejects values with unsafe characters', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc<script>alert(1)</script>')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.rejected).toContain('gclid')
    })

    it('rejects values with CRLF injection', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=abc%0d%0aHeader:injected')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
    })

    it('skips empty values', () => {
      const incoming = new URL('https://go.site.com/abc?gclid=')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.has('gclid')).toBe(false)
    })

    it('rolls back ALL forwarded params if URL exceeds 8192 chars', () => {
      const longDest = new URL('https://example.com/' + 'x'.repeat(7900))
      const incoming = new URL('https://go.site.com/abc?gclid=abc123&fbclid=def456')
      const result = safePassthrough(incoming, longDest)
      expect(result.url.searchParams.has('gclid')).toBe(false)
      expect(result.url.searchParams.has('fbclid')).toBe(false)
      expect(result.rejected).toContain('gclid')
      expect(result.rejected).toContain('fbclid')
    })

    it('preserves canonical casing (ScCid)', () => {
      const incoming = new URL('https://go.site.com/abc?scid=snap123')
      const result = safePassthrough(incoming, dest())
      expect(result.url.searchParams.get('ScCid')).toBe('snap123')
    })

    it('handles all 13 known click IDs', () => {
      expect(KNOWN_CLICK_IDS.size).toBe(13)
    })

    it('returns empty result when no click IDs present', () => {
      const incoming = new URL('https://go.site.com/abc?ref=something')
      const result = safePassthrough(incoming, dest())
      expect(result.forwarded).toEqual([])
      expect(result.rejected).toEqual([])
      expect(result.url.searchParams.get('existing')).toBe('keep')
    })
  })

  describe('extractClickIds', () => {
    it('extracts known click IDs as a record', () => {
      const url = new URL('https://go.site.com/abc?gclid=abc&fbclid=def&ref=other')
      const ids = extractClickIds(url)
      expect(ids).toEqual({ gclid: 'abc', fbclid: 'def' })
    })

    it('returns empty object when no click IDs', () => {
      const url = new URL('https://go.site.com/abc?ref=other')
      expect(extractClickIds(url)).toEqual({})
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/links && npx vitest run src/core/click-id-passthrough.test.ts`
Expected: All tests FAIL

- [ ] **Step 4: Commit test file**

```bash
git add packages/links/src/core/click-id-passthrough.ts packages/links/src/core/click-id-passthrough.test.ts
git commit -m "test(links): failing tests for click ID passthrough"
```

---

## Task 4: Click ID Passthrough — Implementation

**Files:**
- Modify: `packages/links/src/core/click-id-passthrough.ts`

- [ ] **Step 1: Implement the full passthrough**

Replace the stub in `packages/links/src/core/click-id-passthrough.ts`:

```typescript
// packages/links/src/core/click-id-passthrough.ts

export const KNOWN_CLICK_IDS = new Set<string>([
  'gclid', 'gbraid', 'wbraid', 'gclsrc', 'dclid',
  'fbclid', 'msclkid', 'ttclid', 'twclid',
  'li_fat_id', 'epik', 'rdt_cid', 'scid',
])

export const CANONICAL_CASING: Record<string, string> = {
  gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid',
  gclsrc: 'gclsrc', dclid: 'dclid', fbclid: 'fbclid',
  msclkid: 'msclkid', ttclid: 'ttclid', twclid: 'twclid',
  li_fat_id: 'li_fat_id', epik: 'epik', rdt_cid: 'rdt_cid',
  scid: 'ScCid',
}

const SAFE_VALUE_RE = /^[a-zA-Z0-9_\-=.%+]+$/
const MAX_VALUE_LENGTH = 500
const MAX_URL_LENGTH = 8192

export interface PassthroughResult {
  url: URL
  forwarded: string[]
  rejected: string[]
}

export function safePassthrough(incomingUrl: URL, destinationUrl: URL): PassthroughResult {
  const result = new URL(destinationUrl.toString())
  const forwarded: string[] = []
  const rejected: string[] = []

  for (const [rawName, value] of incomingUrl.searchParams.entries()) {
    const lowerName = rawName.toLowerCase()
    if (lowerName.startsWith('utm_')) continue
    if (!KNOWN_CLICK_IDS.has(lowerName)) continue
    if (value.length === 0) continue
    if (value.length > MAX_VALUE_LENGTH) { rejected.push(rawName); continue }
    if (!SAFE_VALUE_RE.test(value)) { rejected.push(rawName); continue }

    const canonicalName = CANONICAL_CASING[lowerName] ?? rawName
    result.searchParams.set(canonicalName, value)
    forwarded.push(rawName)
  }

  if (result.toString().length > MAX_URL_LENGTH) {
    for (const name of forwarded) {
      const canonical = CANONICAL_CASING[name.toLowerCase()] ?? name
      result.searchParams.delete(canonical)
    }
    return { url: new URL(destinationUrl.toString()), forwarded: [], rejected: [...rejected, ...forwarded] }
  }

  return { url: result, forwarded, rejected }
}

export function extractClickIds(url: URL): Record<string, string> {
  const ids: Record<string, string> = {}
  for (const [rawName, value] of url.searchParams.entries()) {
    const lowerName = rawName.toLowerCase()
    if (KNOWN_CLICK_IDS.has(lowerName) && value.length > 0) {
      ids[CANONICAL_CASING[lowerName] ?? rawName] = value
    }
  }
  return ids
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/links && npx vitest run src/core/click-id-passthrough.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/links/src/core/click-id-passthrough.ts
git commit -m "feat(links): click ID passthrough with allowlist sanitization"
```

---

## Task 5: Update Package Types

**Files:**
- Modify: `packages/links/src/types.ts:34-57` (TrackedLink)
- Modify: `packages/links/src/types.ts:219-225` (UtmParams)
- Modify: `packages/links/src/types.ts:242-258` (CreateLinkInput)
- Modify: `packages/links/src/types.ts:261-276` (UpdateLinkInput)
- Modify: `packages/links/src/types.ts:311-321` (RecordClickInput)
- Modify: `packages/links/src/types.ts:331-334` (RedirectGuardFailure)
- Modify: `packages/links/src/types.ts:60-82` (LinkClick)

- [ ] **Step 1: Add utm_id to UtmParams**

In `packages/links/src/types.ts`, update the `UtmParams` interface (line 219):

```typescript
// Before (lines 219-225):
export interface UtmParams {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
}

// After:
export interface UtmParams {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  utmId?: string
}
```

- [ ] **Step 2: Extend TrackedLink with new fields**

In `packages/links/src/types.ts`, update the `TrackedLink` interface (line 34):

```typescript
// Add after utmContent (line 52), before qrCodeUrl:
  utmId: string | null
  launchedAt: Date | null
  activatesAt: Date | null
  customParams: Record<string, string>
  healthStatus: 'unchecked' | 'healthy' | 'unhealthy' | 'timeout' | 'dns_error'
  healthCheckedAt: Date | null
  passClickIds: boolean
```

- [ ] **Step 3: Add utmId and adClickIds to LinkClick**

In `packages/links/src/types.ts`, update `LinkClick` (line 60):

```typescript
// Add after utmContent (line 80), before clickedAt:
  utmId: string | null
  adClickIds: Record<string, string> | null
```

- [ ] **Step 4: Add utmId to CreateLinkInput and UpdateLinkInput**

In `CreateLinkInput` (line 242), add after `utmContent`:
```typescript
  utmId?: string
```

In `UpdateLinkInput` (line 261), add after `utmContent`:
```typescript
  utmId?: string | null
```

- [ ] **Step 5: Add utmId and adClickIds to RecordClickInput**

In `RecordClickInput` (line 311), add after `utmContent`:
```typescript
  utmId?: string
  adClickIds?: Record<string, string>
```

- [ ] **Step 6: Add 'not_yet_active' to RedirectGuardFailure**

In `RedirectGuardFailure` (line 331):

```typescript
// Before:
export interface RedirectGuardFailure {
  reason: 'not_found' | 'deleted' | 'expired' | 'click_limit' | 'password_required' | 'paused'
  link?: TrackedLink
}

// After:
export interface RedirectGuardFailure {
  reason: 'not_found' | 'deleted' | 'expired' | 'click_limit' | 'password_required' | 'paused' | 'not_yet_active'
  link?: TrackedLink
}
```

- [ ] **Step 7: Run existing tests to verify no breakage**

Run: `cd packages/links && npx vitest run`
Expected: All existing tests still pass (new fields are optional/have defaults)

- [ ] **Step 8: Commit**

```bash
git add packages/links/src/types.ts
git commit -m "feat(links): extend types with utm_id, lifecycle fields, click IDs"
```

---

## Task 6: Update utm-parser for utm_id + Barrel File

**Files:**
- Modify: `packages/links/src/core/utm-parser.ts`
- Modify: `packages/links/src/core/utm-parser.test.ts`
- Modify: `packages/links/src/index.ts`

- [ ] **Step 1: Add utm_id test cases to utm-parser.test.ts**

Add to the `parseUtm` describe block:
```typescript
    it('extracts utm_id from URL', () => {
      const utm = parseUtm('https://example.com?utm_id=camp123&utm_source=google')
      expect(utm.utmId).toBe('camp123')
    })
```

Add to the `buildUtmUrl` describe block:
```typescript
    it('appends utm_id to URL', () => {
      const result = buildUtmUrl('https://example.com', { utmId: 'camp123' })
      const url = new URL(result)
      expect(url.searchParams.get('utm_id')).toBe('camp123')
    })
```

Add to the `extractUtmFromSearchParams` describe block:
```typescript
    it('extracts utm_id from URLSearchParams', () => {
      const sp = new URLSearchParams('utm_id=camp123')
      const utm = extractUtmFromSearchParams(sp)
      expect(utm.utmId).toBe('camp123')
    })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/links && npx vitest run src/core/utm-parser.test.ts`
Expected: New tests FAIL (utmId undefined)

- [ ] **Step 3: Update utm-parser.ts to support utm_id**

In `packages/links/src/core/utm-parser.ts`:

Update `extractUtmFromSearchParams` (line 14) — add `utmId`:
```typescript
export function extractUtmFromSearchParams(params: URLSearchParams): UtmParams {
  const get = (key: string): string | undefined => params.get(key) ?? undefined
  return {
    utmSource: get('utm_source'),
    utmMedium: get('utm_medium'),
    utmCampaign: get('utm_campaign'),
    utmTerm: get('utm_term'),
    utmContent: get('utm_content'),
    utmId: get('utm_id'),
  }
}
```

Update `buildUtmUrl` mapping array (line 32) — add utm_id entry:
```typescript
  const mapping: Array<[keyof UtmParams, string]> = [
    ['utmSource', 'utm_source'],
    ['utmMedium', 'utm_medium'],
    ['utmCampaign', 'utm_campaign'],
    ['utmTerm', 'utm_term'],
    ['utmContent', 'utm_content'],
    ['utmId', 'utm_id'],
  ]
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd packages/links && npx vitest run src/core/utm-parser.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Update barrel file with new exports**

In `packages/links/src/index.ts`, add after line 56 (the `classifyReferrer` export):

```typescript
export {
  normalizeUtmValue,
  normalizeAllUtmFields,
  slugifyForCampaign,
  isKnownMedium,
  GA4_MEDIUM_SUGGESTIONS,
  KNOWN_UTM_SOURCES,
} from './core/utm-normalizer.js'
export type { UtmField, UtmFieldsInput, UtmFieldsNormalized } from './core/utm-normalizer.js'
export { safePassthrough, extractClickIds, KNOWN_CLICK_IDS } from './core/click-id-passthrough.js'
export type { PassthroughResult } from './core/click-id-passthrough.js'
```

- [ ] **Step 6: Run full package tests**

Run: `cd packages/links && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/links/src/core/utm-parser.ts packages/links/src/core/utm-parser.test.ts packages/links/src/index.ts
git commit -m "feat(links): add utm_id to parser, export normalizer and passthrough from barrel"
```

---

## Task 7: Migration 1 — Schema DDL

**Files:**
- Create: `supabase/migrations/YYYYMMDD000001_links_engine_a_plus_schema.sql` (via `npm run db:new`)

- [ ] **Step 1: Generate the migration file**

Run: `npm run db:new links_engine_a_plus_schema`

This creates the file with the correct timestamp. Note the exact filename from the output.

- [ ] **Step 2: Write the schema migration**

Write the full DDL SQL into the generated file:

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

-- 7. UTM normalization trigger for tracked_links
CREATE OR REPLACE FUNCTION public.trg_normalize_tracked_links_utm() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
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

-- 8. UTM normalization trigger for link_utm_presets
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

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*links_engine_a_plus_schema*
git commit -m "feat(db): links engine A++ schema — columns, triggers, normalizer"
```

---

## Task 8: Bloco 0 — Cron Fixes

**Files:**
- Modify: `apps/web/vercel.json:5-28`
- Modify: `apps/web/src/app/api/cron/links-anonymize-clicks/route.ts:9,12,29-34`
- Modify: `apps/web/src/app/api/cron/links-partition-maintenance/route.ts:11`

- [ ] **Step 1: Register link crons in vercel.json**

In `apps/web/vercel.json`, add these entries to the `crons` array (after the last entry at line 27):

```jsonc
    { "path": "/api/cron/links-anonymize-clicks",     "schedule": "0 3 * * *" },
    { "path": "/api/cron/links-check-expiry",          "schedule": "*/15 * * * *" },
    { "path": "/api/cron/links-aggregate-metrics",      "schedule": "0 * * * *" },
    { "path": "/api/cron/links-check-alerts",           "schedule": "*/30 * * * *" },
    { "path": "/api/cron/links-partition-maintenance",   "schedule": "0 2 1 * *" },
    { "path": "/api/cron/links-health-check",            "schedule": "0 5 * * *" }
```

- [ ] **Step 2: Fix anonymize-clicks — POST→GET + retention + fields**

In `apps/web/src/app/api/cron/links-anonymize-clicks/route.ts`:

Change line 9: `RETENTION_DAYS = 90` → `RETENTION_DAYS = 30`

Change line 12: `export async function POST(req: Request)` → `export async function GET(req: Request)`

Change the update object (lines 29-34) to the canonical field set:
```typescript
      .update({
        ip: null,
        user_agent: null,
        city: null,
        region: null,
        referrer_url: null,
        ad_click_ids: null,
      })
```

- [ ] **Step 3: Fix partition-maintenance — POST→GET**

In `apps/web/src/app/api/cron/links-partition-maintenance/route.ts`:

Change line 11: `export async function POST(req: Request)` → `export async function GET(req: Request)`

- [ ] **Step 4: Commit**

```bash
git add apps/web/vercel.json apps/web/src/app/api/cron/links-anonymize-clicks/route.ts apps/web/src/app/api/cron/links-partition-maintenance/route.ts
git commit -m "fix(links): register 6 crons, fix POST→GET, align anonymize fields, retention 30d"
```

---

## Task 9: Bloco 0 — Fix Redirect Handler (UTM overwrite + UTM recording)

**Files:**
- Modify: `apps/web/src/lib/links/resolver.ts:3-20,30-32`
- Modify: `apps/web/src/lib/links/click-recorder.ts:26-33,69-83`
- Modify: `apps/web/src/app/go/[code]/route.ts:53-67,78-93,95-102`

- [ ] **Step 1: Extend ResolvedLink interface and SELECT**

In `apps/web/src/lib/links/resolver.ts`, add new fields to `ResolvedLink` (after `utm_content` at line 19):

```typescript
  utm_id: string | null
  launched_at: string | null
  activates_at: string | null
  custom_params: Record<string, string>
  pass_click_ids: boolean
```

Update the SELECT string (line 31) to include the new columns:

```typescript
      'id, site_id, code, destination_url, redirect_type, active, deleted_at, password_hash, click_limit, total_clicks, expires_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content, utm_id, launched_at, activates_at, custom_params, pass_click_ids',
```

- [ ] **Step 2: Extend RecordClickInput in click-recorder.ts**

In `apps/web/src/lib/links/click-recorder.ts`, update `RecordClickInput` (line 26):

```typescript
export interface RecordClickInput {
  linkId: string
  siteId: string
  ip: string
  userAgent: string
  referrer: string | null
  headers: Headers
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  utmId?: string | null
  adClickIds?: Record<string, string> | null
}
```

- [ ] **Step 3: Include UTMs and ad_click_ids in click INSERT**

In `apps/web/src/lib/links/click-recorder.ts`, update the INSERT object (lines 69-83):

```typescript
  const { error: insertErr } = await supabase.from('link_clicks').insert({
    link_id: linkId,
    site_id: siteId,
    visitor_id: visitorId,
    ip,
    user_agent: userAgent,
    referrer_domain: referrerDomain,
    referrer_url: referrer,
    country: geo.country,
    city: geo.city,
    region: geo.region,
    is_bot: bot,
    is_unique: true,
    clicked_at: new Date().toISOString(),
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    utm_term: input.utmTerm ?? null,
    utm_content: input.utmContent ?? null,
    utm_id: input.utmId ?? null,
    ad_click_ids: input.adClickIds ?? null,
  })
```

- [ ] **Step 4: Add launched_at auto-set after click insert**

In `apps/web/src/lib/links/click-recorder.ts`, after the INSERT (before the `increment_link_clicks` RPC call), add:

```typescript
  if (!bot) {
    await supabase
      .from('tracked_links')
      .update({ launched_at: new Date().toISOString() })
      .eq('id', linkId)
      .is('launched_at', null)
  }
```

- [ ] **Step 5: Fix UTM overwrite in route handler**

In `apps/web/src/app/go/[code]/route.ts`, replace lines 95-100:

```typescript
// Before:
    const destination = new URL(link.destination_url)
    if (link.utm_source) destination.searchParams.set('utm_source', link.utm_source)
    if (link.utm_medium) destination.searchParams.set('utm_medium', link.utm_medium)
    if (link.utm_campaign) destination.searchParams.set('utm_campaign', link.utm_campaign)
    if (link.utm_term) destination.searchParams.set('utm_term', link.utm_term)
    if (link.utm_content) destination.searchParams.set('utm_content', link.utm_content)

// After:
    const destination = new URL(link.destination_url)
    const utmMapping = [
      ['utm_source', link.utm_source],
      ['utm_medium', link.utm_medium],
      ['utm_campaign', link.utm_campaign],
      ['utm_term', link.utm_term],
      ['utm_content', link.utm_content],
      ['utm_id', link.utm_id],
    ] as const
    for (const [param, value] of utmMapping) {
      if (value && !destination.searchParams.has(param)) {
        destination.searchParams.set(param, value)
      }
    }
```

- [ ] **Step 6: Pass UTMs to recordClick**

In `apps/web/src/app/go/[code]/route.ts`, update the `recordClick` call (lines 78-93):

```typescript
    void recordClick({
      linkId: link.id,
      siteId,
      ip,
      userAgent,
      referrer,
      headers: new Headers(
        Object.fromEntries(
          [...new Headers(request.headers).entries()].filter(
            ([k]) => k.startsWith('cf-') || k === 'x-forwarded-for',
          ),
        ),
      ),
      utmSource: link.utm_source,
      utmMedium: link.utm_medium,
      utmCampaign: link.utm_campaign,
      utmTerm: link.utm_term,
      utmContent: link.utm_content,
      utmId: link.utm_id,
    }).catch((err) => {
      Sentry.captureException(err, { tags: { links: 'true', component: 'redirect' } })
    })
```

- [ ] **Step 7: Add activates_at guard in route handler**

In `apps/web/src/app/go/[code]/route.ts`, add after the password_hash check (after line 67):

```typescript
    if (link.activates_at && new Date(link.activates_at) > new Date()) {
      const comingSoonUrl = new URL('/go/coming-soon', request.url)
      comingSoonUrl.searchParams.set('title', link.title ?? link.code)
      if (link.activates_at) {
        comingSoonUrl.searchParams.set('activates', link.activates_at)
      }
      return NextResponse.rewrite(comingSoonUrl)
    }
```

- [ ] **Step 8: Run tests**

Run: `npm run test:web`
Expected: Tests pass (existing tests for these files are integration-level, new fields are additive)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/links/resolver.ts apps/web/src/lib/links/click-recorder.ts apps/web/src/app/go/\[code\]/route.ts
git commit -m "fix(links): fix UTM overwrite, populate click UTMs, add activates_at guard"
```

---

## Task 10: Click ID Passthrough + Cache-Control Integration

**Files:**
- Modify: `apps/web/src/app/go/[code]/route.ts`

- [ ] **Step 1: Add click ID passthrough import and logic**

At the top of `apps/web/src/app/go/[code]/route.ts`, add import:

```typescript
import { safePassthrough, extractClickIds } from '@tn-figueiredo/links'
```

After the UTM mapping loop (from Task 9 step 5), add click ID passthrough and custom params:

```typescript
    // Click ID passthrough (gclid, fbclid, etc.)
    const incomingUrl = new URL(request.url)
    let clickIds: Record<string, string> | null = null
    if (link.pass_click_ids) {
      const passResult = safePassthrough(incomingUrl, destination)
      if (passResult.forwarded.length > 0) {
        // Use the URL returned by safePassthrough — it already has forwarded params appended
        for (const param of passResult.forwarded) {
          const canonical = passResult.url.searchParams.get(param) ??
            passResult.url.searchParams.get(param.toLowerCase())
          // safePassthrough uses canonical casing; copy each forwarded param
        }
        // Replace destination with the passthrough result (it preserves all existing params)
        const finalUrl = passResult.url
        // Re-apply our UTMs since safePassthrough started from destination which already has them
        destination = finalUrl
        clickIds = extractClickIds(incomingUrl)
        Sentry.addBreadcrumb({
          category: 'links.passthrough',
          message: `Forwarded click IDs: ${passResult.forwarded.join(', ')}`,
          level: 'info',
        })
      }
      if (passResult.rejected.length > 0) {
        Sentry.addBreadcrumb({
          category: 'links.passthrough',
          message: `Rejected click IDs: ${passResult.rejected.join(', ')}`,
          level: 'warning',
        })
      }
    }

    // Custom params (jsonb key-value pairs from tracked_links)
    if (link.custom_params) {
      for (const [key, value] of Object.entries(link.custom_params)) {
        if (value && !destination.searchParams.has(key)) {
          destination.searchParams.set(key, value)
        }
      }
    }
```

**Important:** Change the `const destination = new URL(...)` (from Task 9) to `let destination = new URL(...)` so we can reassign it after passthrough.

- [ ] **Step 2: Update recordClick to include ad_click_ids (LGPD consent-gated)**

Update the `recordClick` call to pass `adClickIds` only when LGPD analytics consent is present. Click ID passthrough on the redirect URL always happens (legitimate interest as transparent intermediary), but **storage** in `link_clicks.ad_click_ids` requires analytics consent:

```typescript
      // ad_click_ids storage is LGPD consent-gated — passthrough always happens
      // but we only store the IDs if the user has analytics consent
      // For now, store unconditionally — LGPD consent check will be wired
      // when cookie consent banner integration is complete (Sprint 5d)
      adClickIds: clickIds,
```

(Add after the `utmId` line in the recordClick call from Task 9.)

**Note:** The redirect passthrough itself is legitimate interest (transparent intermediary). Only the storage in `ad_click_ids` needs consent. Full LGPD consent wiring depends on the cookie banner's consent state being accessible server-side, which is a Sprint 5d deliverable. For now, store unconditionally — the anonymize-clicks cron ensures 30-day retention.

- [ ] **Step 3: Add Cache-Control for 301 + click IDs**

Replace the simple redirect at the end of the handler:

```typescript
// Before:
    return NextResponse.redirect(destination.toString(), link.redirect_type)

// After:
    const response = NextResponse.redirect(destination.toString(), link.redirect_type)
    if (link.redirect_type === 301 && clickIds) {
      response.headers.set('Cache-Control', 'private, no-store')
    }
    return response
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/go/\[code\]/route.ts
git commit -m "feat(links): click ID passthrough with Cache-Control fix for 301s"
```

---

## Task 11: Bloco 1 — Normalization at All Entry Points

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts:39-54,56-68`
- Modify: `apps/web/src/lib/links/auto-link.ts:110-123`

- [ ] **Step 1: Update Zod schemas in actions.ts**

At the top of `apps/web/src/app/cms/(authed)/links/actions.ts`, add import:

```typescript
import { normalizeUtmValue, normalizeAllUtmFields, slugifyForCampaign } from '@tn-figueiredo/links'
```

Update `CreateLinkSchema` (line 39). Changes:
1. Add `'307'` and `'308'` to redirect_type enum
2. Add `utm_id` field
3. Add `.transform()` to each UTM field

```typescript
const CreateLinkSchema = z.object({
  destination_url: z.string().url(),
  title: z.string().max(255).optional(),
  code: z.string().max(64).optional(),
  slug: z.string().max(255).optional(),
  redirect_type: z.enum(['301', '302', '307', '308']).optional(),
  source_type: z.enum(sourceTypes).optional(),
  source_id: z.string().uuid().optional(),
  utm_source: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_source', v)),
  utm_medium: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_medium', v)),
  utm_campaign: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_campaign', v)),
  utm_term: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_term', v)),
  utm_content: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_content', v)),
  utm_id: z.string().max(255).optional().transform(v => normalizeUtmValue('utm_id', v)),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expires_at: z.string().datetime().optional(),
})
```

Update `UpdateLinkSchema` (line 56):

```typescript
const UpdateLinkSchema = z.object({
  destination_url: z.string().url().optional(),
  title: z.string().max(255).optional(),
  slug: z.string().max(255).nullable().optional(),
  source_type: z.enum(sourceTypes).optional(),
  utm_source: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_source', v) : v),
  utm_medium: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_medium', v) : v),
  utm_campaign: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_campaign', v) : v),
  utm_term: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_term', v) : v),
  utm_content: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_content', v) : v),
  utm_id: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_id', v) : v),
  tags: z.array(z.string().max(50)).max(20).optional(),
  expires_at: z.string().datetime().nullable().optional(),
})
```

- [ ] **Step 2: Add normalization to saveUtmPreset and saveLinkSettings**

In `saveUtmPreset` action (~line 819), wrap the insert data with normalization. Find the `.insert({...})` call and replace the UTM values:

```typescript
    const normalized = normalizeAllUtmFields({
      utm_source: parsed.data.utm_source,
      utm_medium: parsed.data.utm_medium,
      utm_campaign: parsed.data.utm_campaign,
      utm_term: parsed.data.utm_term,
      utm_content: parsed.data.utm_content,
      utm_id: parsed.data.utm_id,
    })

    const { data, error } = await supabase
      .from('link_utm_presets')
      .insert({
        site_id: siteId,
        name: parsed.data.name,
        ...normalized,
      })
      .select('id')
      .single()
```

In `saveLinkSettings` action (~line 788), normalize the `default_utm_source`, `default_utm_medium`, and `default_utm_campaign` fields in the JSONB settings before upserting:

```typescript
    const settings = parsed.data.settings ?? {}
    if (settings.default_utm_source) settings.default_utm_source = normalizeUtmValue('utm_source', settings.default_utm_source)
    if (settings.default_utm_medium) settings.default_utm_medium = normalizeUtmValue('utm_medium', settings.default_utm_medium)
    if (settings.default_utm_campaign) settings.default_utm_campaign = normalizeUtmValue('utm_campaign', settings.default_utm_campaign)
```

- [ ] **Step 3: Add normalization to duplicateLink**

In `duplicateLink` action (~line 219), after fetching the source link and before inserting the copy, normalize the UTM values:

```typescript
    const normalized = normalizeAllUtmFields({
      utm_source: source.utm_source,
      utm_medium: source.utm_medium,
      utm_campaign: source.utm_campaign,
      utm_term: source.utm_term,
      utm_content: source.utm_content,
    })
```

Use `normalized.*` values in the insert.

- [ ] **Step 4: Fix auto-link.ts — redirect type, utm_medium, campaign naming**

In `apps/web/src/lib/links/auto-link.ts`, add import at top:

```typescript
import { normalizeAllUtmFields, slugifyForCampaign } from '@tn-figueiredo/links'
```

Update the INSERT object in `ensureTrackedLink` (lines 112-123):

```typescript
// Before:
        redirect_type: 301,
        source_type: sourceType,
        source_id: sourceId,
        utm_medium: 'social',
        utm_campaign: utmCampaign ?? `${sourceType}-${sourceId}`,

// After:
        redirect_type: 307,
        source_type: sourceType,
        source_id: sourceId,
        ...normalizeAllUtmFields({
          utm_medium: sourceType === 'social' ? 'social' : sourceType === 'newsletter' ? 'email' : 'referral',
          utm_campaign: utmCampaign ?? `${sourceType}-${slugifyForCampaign(title) || sourceId.slice(0, 8)}`,
        }),
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: Tests pass

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/links/actions.ts apps/web/src/lib/links/auto-link.ts
git commit -m "feat(links): UTM normalization at all entry points, fix auto-link defaults"
```

---

## Task 12: Bloco 3 — Coming Soon Page

**Files:**
- Create: `apps/web/src/app/go/coming-soon/page.tsx`

- [ ] **Step 1: Create the coming-soon page**

```typescript
// apps/web/src/app/go/coming-soon/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Em breve',
  robots: 'noindex, nofollow',
}

interface Props {
  searchParams: Promise<{ title?: string; activates?: string }>
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const params = await searchParams
  const title = params.title ?? 'Este link'
  const activatesAt = params.activates ? new Date(params.activates) : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-5xl">🔜</div>
        <h1 className="mb-3 text-2xl font-bold text-white">{title}</h1>
        <p className="text-zinc-400">
          Este link ainda não está ativo.
          {activatesAt && (
            <>
              {' '}Disponível a partir de{' '}
              <time dateTime={activatesAt.toISOString()} className="font-medium text-white">
                {activatesAt.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </time>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/go/coming-soon/page.tsx
git commit -m "feat(links): coming-soon page for pre-activation links"
```

---

## Task 13: Bloco 3 — Health Check Cron

**Files:**
- Create: `apps/web/src/app/api/cron/links-health-check/route.ts`

- [ ] **Step 1: Create the health check cron**

```typescript
// apps/web/src/app/api/cron/links-health-check/route.ts
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120

const JOB = 'links-health-check'
const LOCK_KEY = 'cron:links-health-check'
const BATCH_SIZE = 50
const REQUEST_TIMEOUT_MS = 10_000
const RATE_LIMIT_MS = 1_000

const PRIVATE_IP_RE = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|localhost|::1|\[::1\])/i

type HealthStatus = 'healthy' | 'unhealthy' | 'timeout' | 'dns_error'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function checkUrl(url: string): Promise<HealthStatus> {
  try {
    const parsed = new URL(url)
    if (PRIVATE_IP_RE.test(parsed.hostname)) return 'unhealthy'

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const res = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'bythiagofigueiredo-health-check/1.0' },
      })
      clearTimeout(timer)

      const ok = res.status < 500 || res.status === 401 || res.status === 403
      return ok ? 'healthy' : 'unhealthy'
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') return 'timeout'
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) return 'dns_error'
      return 'unhealthy'
    }
  } catch {
    return 'unhealthy'
  }
}

export async function GET(req: Request): Promise<Response> {
  if (process.env.LINKS_HEALTH_CHECK_ENABLED !== 'true') {
    return Response.json({ status: 'disabled' })
  }

  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

    const { data: links, error } = await supabase
      .from('tracked_links')
      .select('id, destination_url')
      .eq('active', true)
      .is('deleted_at', null)
      .gt('total_clicks', 0)
      .or(`health_checked_at.is.null,health_checked_at.lt.${new Date(Date.now() - 86_400_000).toISOString()}`)
      .order('health_checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE)

    if (error) {
      Sentry.captureException(error, { tags: { links: 'true', component: 'cron-health-check' } })
      return { status: 'error' as const, error: error.message }
    }

    if (!links?.length) {
      return { status: 'ok' as const, checked: 0 }
    }

    // Group by domain for rate limiting
    const byDomain = new Map<string, typeof links>()
    for (const link of links) {
      try {
        const domain = new URL(link.destination_url).hostname
        const group = byDomain.get(domain) ?? []
        group.push(link)
        byDomain.set(domain, group)
      } catch {
        // skip invalid URLs
      }
    }

    let checked = 0
    let healthy = 0
    let unhealthy = 0

    for (const [, domainLinks] of byDomain) {
      for (const link of domainLinks) {
        const status = await checkUrl(link.destination_url)
        const now = new Date().toISOString()

        await supabase
          .from('tracked_links')
          .update({ health_status: status, health_checked_at: now })
          .eq('id', link.id)

        checked++
        if (status === 'healthy') healthy++
        else unhealthy++

        await delay(RATE_LIMIT_MS)
      }
    }

    return { status: 'ok' as const, checked, healthy, unhealthy }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/api/cron/links-health-check/route.ts
git commit -m "feat(links): health check cron with SSRF guard and rate limiting"
```

---

## Task 14: Bloco 3 — Batch Operations

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts`

- [ ] **Step 1: Add batch update server actions**

Add at the end of `apps/web/src/app/cms/(authed)/links/actions.ts` (before closing):

```typescript
const BatchFiltersSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  utm_campaign: z.string().optional(),
  source_type: z.enum(sourceTypes).optional(),
  active: z.boolean().optional(),
})

const BatchUpdateSchema = z.object({
  utm_source: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_source', v) : v),
  utm_medium: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_medium', v) : v),
  utm_campaign: z.string().max(255).nullish().transform(v => v ? normalizeUtmValue('utm_campaign', v) : v),
  expires_at: z.string().datetime().nullish(),
  active: z.boolean().optional(),
  pass_click_ids: z.boolean().optional(),
})

export async function previewBatchUpdate(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
) {
  const { supabase, site } = await requireSiteAdmin(siteId)
  const parsed = BatchFiltersSchema.safeParse(filters)
  if (!parsed.success) return { ok: false as const, error: parsed.error.message }

  let query = supabase
    .from('tracked_links')
    .select('id, code, title, utm_campaign', { count: 'exact' })
    .eq('site_id', site.id)
    .is('deleted_at', null)

  if (parsed.data.ids) query = query.in('id', parsed.data.ids)
  if (parsed.data.tags) query = query.overlaps('tags', parsed.data.tags)
  if (parsed.data.utm_campaign) query = query.eq('utm_campaign', parsed.data.utm_campaign)
  if (parsed.data.source_type) query = query.eq('source_type', parsed.data.source_type)
  if (parsed.data.active !== undefined) query = query.eq('active', parsed.data.active)

  const { data, count, error } = await query.limit(100)
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, links: data ?? [], total: count ?? 0 }
}

export async function batchUpdateLinks(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
  updates: z.input<typeof BatchUpdateSchema>,
) {
  const { supabase, site } = await requireSiteAdmin(siteId)

  const filtersParsed = BatchFiltersSchema.safeParse(filters)
  if (!filtersParsed.success) return { ok: false as const, error: filtersParsed.error.message }

  const updatesParsed = BatchUpdateSchema.safeParse(updates)
  if (!updatesParsed.success) return { ok: false as const, error: updatesParsed.error.message }

  const updateObj: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updatesParsed.data)) {
    if (value !== undefined) updateObj[key] = value
  }

  if (Object.keys(updateObj).length === 0) {
    return { ok: false as const, error: 'No updates provided' }
  }

  let query = supabase
    .from('tracked_links')
    .update(updateObj)
    .eq('site_id', site.id)
    .is('deleted_at', null)

  if (filtersParsed.data.ids) query = query.in('id', filtersParsed.data.ids)
  if (filtersParsed.data.tags) query = query.overlaps('tags', filtersParsed.data.tags)
  if (filtersParsed.data.utm_campaign) query = query.eq('utm_campaign', filtersParsed.data.utm_campaign)
  if (filtersParsed.data.source_type) query = query.eq('source_type', filtersParsed.data.source_type)
  if (filtersParsed.data.active !== undefined) query = query.eq('active', filtersParsed.data.active)

  const { error, count } = await query.select('id', { count: 'exact' })
  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, updated: count ?? 0 }
}

export async function batchExtendExpiry(
  siteId: string,
  filters: z.input<typeof BatchFiltersSchema>,
  hours: number,
) {
  const { supabase, site } = await requireSiteAdmin(siteId)

  const parsed = BatchFiltersSchema.safeParse(filters)
  if (!parsed.success) return { ok: false as const, error: parsed.error.message }
  if (hours < 1 || hours > 8760) return { ok: false as const, error: 'Hours must be 1-8760' }

  const { data: count, error } = await supabase.rpc('batch_extend_link_expiry', {
    p_site_id: site.id,
    p_campaign: parsed.data.utm_campaign ?? null,
    p_tags: parsed.data.tags ?? null,
    p_hours: hours,
  })

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, extended: count ?? 0 }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/links/actions.ts
git commit -m "feat(links): batch update, preview, and extend-expiry server actions"
```

---

## Task 15: Redirect Resolver Package Update

**Files:**
- Modify: `packages/links/src/core/redirect-resolver.ts`
- Modify: `packages/links/src/core/redirect-resolver.test.ts`

- [ ] **Step 1: Add not_yet_active test**

In `packages/links/src/core/redirect-resolver.test.ts`, add a new test in the guard checks describe block:

```typescript
    it('returns not_yet_active when activatesAt is in the future', async () => {
      const repo = makeMockRepo()
      const link = makeLink({ activatesAt: new Date(Date.now() + 86_400_000) })
      repo.findByCode.mockResolvedValue(link)
      const resolver = new RedirectResolver(repo)
      const result = await resolver.resolve('test')
      expect(result).toEqual({ reason: 'not_yet_active', link })
    })
```

Also update the `makeLink` factory to include the new fields with sensible defaults:

```typescript
// In the makeLink factory, add:
    activatesAt: null,
    launchedAt: null,
    customParams: {},
    utmId: null,
    healthStatus: 'unchecked',
    healthCheckedAt: null,
    passClickIds: true,
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/links && npx vitest run src/core/redirect-resolver.test.ts`
Expected: New test FAILS

- [ ] **Step 3: Add not_yet_active guard to RedirectResolver**

In `packages/links/src/core/redirect-resolver.ts`, in `checkGuards` method, add after the expired guard (line 79):

```typescript
    if (link.activatesAt && link.activatesAt > new Date()) {
      return { reason: 'not_yet_active', link }
    }
```

- [ ] **Step 4: Update buildRedirectUrl to include utm_id and custom_params**

In `packages/links/src/core/redirect-resolver.ts`, in `buildRedirectUrl` method (line 96):

```typescript
  private buildRedirectUrl(link: TrackedLink): string {
    const utm: UtmParams = {}
    if (link.utmSource) utm.utmSource = link.utmSource
    if (link.utmMedium) utm.utmMedium = link.utmMedium
    if (link.utmCampaign) utm.utmCampaign = link.utmCampaign
    if (link.utmTerm) utm.utmTerm = link.utmTerm
    if (link.utmContent) utm.utmContent = link.utmContent
    if (link.utmId) utm.utmId = link.utmId

    let url = Object.keys(utm).length > 0
      ? buildUtmUrl(link.destinationUrl, utm)
      : link.destinationUrl

    if (link.customParams && Object.keys(link.customParams).length > 0) {
      const parsed = new URL(url)
      for (const [key, value] of Object.entries(link.customParams)) {
        if (value && !parsed.searchParams.has(key)) {
          parsed.searchParams.set(key, value)
        }
      }
      url = parsed.toString()
    }

    return url
  }
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `cd packages/links && npx vitest run src/core/redirect-resolver.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/links/src/core/redirect-resolver.ts packages/links/src/core/redirect-resolver.test.ts
git commit -m "feat(links): not_yet_active guard, utm_id and custom_params in redirect"
```

---

## Task 16: UI Updates — Link Form

**Files:**
- Modify: `packages/links-admin/src/hooks/use-link-form.ts:4-20,24-40`
- Modify: `packages/links-admin/src/components/link-form.tsx:274,386-433`

- [ ] **Step 1: Extend form state in use-link-form.ts**

In `packages/links-admin/src/hooks/use-link-form.ts`:

Add new fields to `LinkFormData` interface (line 4):
```typescript
  utm_id: string
  activates_at: string
  pass_click_ids: boolean
```

Update `EMPTY_FORM` defaults (line 24):
```typescript
  redirect_type: '307' as const,
  // ... existing fields ...
  utm_id: '',
  activates_at: '',
  pass_click_ids: true,
```

Update the redirect_type type to include 307/308:
```typescript
  redirect_type: '301' | '302' | '307' | '308'
```

- [ ] **Step 2: Update link-form.tsx — Behavior section**

In `packages/links-admin/src/components/link-form.tsx`:

Update the redirect_type card buttons section (~line 274) to include 307 and 308:

```tsx
{(['307', '302', '301', '308'] as const).map((type) => (
  <button
    key={type}
    type="button"
    onClick={() => setField('redirect_type', type)}
    className={cn(
      'flex-1 rounded-lg border px-3 py-2 text-sm transition-colors',
      form.redirect_type === type
        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
    )}
  >
    <div className="font-medium">{type}</div>
    <div className="text-xs text-zinc-500">
      {type === '307' ? 'Temporary (recommended)' :
       type === '302' ? 'Found' :
       type === '301' ? 'Permanent (cached)' :
       'Permanent (strict)'}
    </div>
  </button>
))}
```

Add `activates_at` datetime input after `expires_at`:

```tsx
<div>
  <FieldLabel htmlFor="activates_at">Ativação programada</FieldLabel>
  <input
    id="activates_at"
    type="datetime-local"
    value={form.activates_at}
    onChange={(e) => setField('activates_at', e.target.value)}
    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
  />
  <p className="mt-1 text-xs text-zinc-500">Link mostra página "em breve" até esta data</p>
</div>
```

- [ ] **Step 3: Update link-form.tsx — UTM section**

In the UTM Parameters section (~line 386), add `utm_id` field after `utm_content`:

```tsx
<div>
  <FieldLabel htmlFor="utm_id">utm_id</FieldLabel>
  <input
    id="utm_id"
    value={form.utm_id}
    onChange={(e) => setField('utm_id', e.target.value)}
    placeholder="GA4 campaign ID"
    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
  />
</div>
```

- [ ] **Step 4: Add pass_click_ids toggle in Options section**

In the Options section (~line 337), add:

```tsx
<div className="flex items-center justify-between">
  <div>
    <span className="text-sm text-zinc-300">Encaminhar click IDs</span>
    <p className="text-xs text-zinc-500">gclid, fbclid, ttclid, etc.</p>
  </div>
  <button
    type="button"
    role="switch"
    aria-checked={form.pass_click_ids}
    onClick={() => setField('pass_click_ids', !form.pass_click_ids)}
    className={cn(
      'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
      form.pass_click_ids ? 'bg-indigo-500' : 'bg-zinc-700',
    )}
  >
    <span
      className={cn(
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform',
        form.pass_click_ids ? 'translate-x-5' : 'translate-x-0.5',
        'mt-0.5',
      )}
    />
  </button>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add packages/links-admin/src/hooks/use-link-form.ts packages/links-admin/src/components/link-form.tsx
git commit -m "feat(links-admin): utm_id, 307/308, activates_at, pass_click_ids in form"
```

---

## Task 17: Migration 2 — Data Migration

**Files:**
- Create: `supabase/migrations/YYYYMMDD000002_links_engine_a_plus_data.sql` (via `npm run db:new`)

- [ ] **Step 1: Generate the migration file**

Run: `npm run db:new links_engine_a_plus_data`

- [ ] **Step 2: Write the data migration**

Write into the generated file:

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

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*links_engine_a_plus_data*
git commit -m "feat(db): links engine A++ data migration — normalize UTMs, batch RPC"
```

---

## Task 18: Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run package tests**

Run: `cd packages/links && npx vitest run`
Expected: All tests pass including new utm-normalizer and click-id-passthrough tests

- [ ] **Step 2: Run web tests**

Run: `npm run test:web`
Expected: All tests pass

- [ ] **Step 3: Run full project typecheck**

Run: `npx tsc --noEmit -p packages/links/tsconfig.json && npx tsc --noEmit -p apps/web/tsconfig.json`
Expected: No type errors

- [ ] **Step 4: Build packages**

Run: `npm run build -w packages/links && npm run build -w packages/links-admin`
Expected: Clean build

---

## Task 19: Custom Params Sanitization

**Files:**
- Modify: `apps/web/src/app/go/[code]/route.ts`
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts`

- [ ] **Step 1: Add sanitization to custom_params in route handler**

In the custom params section of `apps/web/src/app/go/[code]/route.ts` (from Task 10), replace the naive loop with sanitized forwarding:

```typescript
    // Custom params (jsonb key-value pairs from tracked_links)
    if (link.custom_params && typeof link.custom_params === 'object') {
      const entries = Object.entries(link.custom_params)
      let applied = 0
      for (const [key, value] of entries) {
        if (applied >= 20) break
        if (!value || typeof value !== 'string') continue
        if (key.toLowerCase().startsWith('utm_')) continue
        if (value.length > 500) continue
        if (!destination.searchParams.has(key)) {
          destination.searchParams.set(key, value)
          applied++
        }
      }
    }
```

- [ ] **Step 2: Add custom_params Zod validation in createLink/updateLink**

In `apps/web/src/app/cms/(authed)/links/actions.ts`, add to both `CreateLinkSchema` and `UpdateLinkSchema`:

```typescript
  custom_params: z.record(z.string().max(100), z.string().max(500))
    .optional()
    .refine(
      (obj) => !obj || Object.keys(obj).length <= 20,
      { message: 'Maximum 20 custom params' },
    )
    .refine(
      (obj) => !obj || Object.keys(obj).every(k => !k.toLowerCase().startsWith('utm_')),
      { message: 'utm_* keys not allowed in custom params' },
    ),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/go/\[code\]/route.ts apps/web/src/app/cms/\(authed\)/links/actions.ts
git commit -m "feat(links): custom params sanitization — max 20, max 500 chars, no utm_* keys"
```

---

## Task 20: UI — utm_medium Warning Badge + Smart Defaults

**Files:**
- Modify: `packages/links-admin/src/components/link-form.tsx`
- Modify: `packages/links-admin/src/hooks/use-link-form.ts`

- [ ] **Step 1: Add utm_medium autocomplete with warning badge**

In `packages/links-admin/src/components/link-form.tsx`, replace the plain `utm_medium` input in the UTM section with a combobox-style input:

```tsx
<div>
  <FieldLabel htmlFor="utm_medium">utm_medium</FieldLabel>
  <input
    id="utm_medium"
    value={form.utm_medium}
    onChange={(e) => setField('utm_medium', e.target.value)}
    list="utm-medium-suggestions"
    placeholder="cpc, paid_social, email..."
    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
  />
  <datalist id="utm-medium-suggestions">
    {GA4_MEDIUM_SUGGESTIONS.map((m) => (
      <option key={m} value={m} />
    ))}
  </datalist>
  {form.utm_medium && !isKnownMedium(form.utm_medium) && (
    <p className="mt-1 flex items-center gap-1 text-xs text-amber-400">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
      Medium não reconhecido pelo GA4 — verifique a grafia
    </p>
  )}
</div>
```

Add imports at top of link-form.tsx:
```typescript
import { GA4_MEDIUM_SUGGESTIONS, isKnownMedium } from '@tn-figueiredo/links'
```

- [ ] **Step 2: Add smart defaults by source_type in use-link-form.ts**

In `packages/links-admin/src/hooks/use-link-form.ts`, add a `setField` wrapper that applies smart defaults when `source_type` changes:

```typescript
const setFieldWithDefaults = (field: keyof LinkFormData, value: unknown) => {
  setField(field, value)
  if (field === 'source_type' && typeof value === 'string') {
    const defaults: Record<string, { utm_source?: string; utm_medium?: string }> = {
      social: { utm_medium: 'social' },
      newsletter: { utm_medium: 'email', utm_source: 'newsletter' },
      blog: { utm_medium: 'referral' },
      campaign: { utm_medium: 'cpc' },
    }
    const d = defaults[value]
    if (d) {
      if (d.utm_source && !form.utm_source) setField('utm_source', d.utm_source)
      if (d.utm_medium && !form.utm_medium) setField('utm_medium', d.utm_medium)
    }
  }
}
```

Export `setFieldWithDefaults` from the hook and use it in the form component for the source_type buttons.

- [ ] **Step 3: Commit**

```bash
git add packages/links-admin/src/components/link-form.tsx packages/links-admin/src/hooks/use-link-form.ts
git commit -m "feat(links-admin): utm_medium warning badge, smart defaults by source_type"
```

---

## Task 21: Batch Operations — batchActivateNow + Audit Annotations

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts`

- [ ] **Step 1: Add batchActivateNow convenience wrapper**

Add at the end of the batch operations section in `actions.ts`:

```typescript
export async function batchActivateNow(siteId: string, campaign: string) {
  return batchUpdateLinks(
    siteId,
    { utm_campaign: campaign },
    { active: true },
  )
}
```

- [ ] **Step 2: Add annotation logging to batchUpdateLinks**

In the `batchUpdateLinks` function, after the successful update query, add annotation logging:

```typescript
  if (!error && count && count > 0) {
    const { data: affected } = await query
    if (affected) {
      const annotations = affected.map((link: { id: string }) => ({
        link_id: link.id,
        site_id: site.id,
        type: 'batch_update',
        content: JSON.stringify(updateObj),
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      }))
      await supabase.from('link_annotations').insert(annotations)
    }
  }
```

**Note:** The existing `createAnnotation` action already writes to `link_annotations` table, so it exists. This adds bulk annotation on batch ops.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/links/actions.ts
git commit -m "feat(links): batchActivateNow wrapper, audit annotations on batch ops"
```

---

## Task 22: LGPD Documentation Artifacts

**Files:**
- Create: `docs/lgpd/links-click-id-lia.md` (Legitimate Interest Assessment)

- [ ] **Step 1: Write the LIA/RIPD document**

```markdown
# Links Engine — Click ID Passthrough LIA/RIPD

**Date:** 2026-05-XX
**Data Controller:** ByThiagoFigueiredo
**Legal Basis:** Legitimate Interest (LGPD Art. 7, IX)

## 1. Processing Activity

When a visitor clicks a tracked short link (go.domain.com/code), the redirect handler:
- **Always** forwards ad click IDs (gclid, fbclid, etc.) from the incoming URL to the destination URL
- **Conditionally** stores the click IDs in `link_clicks.ad_click_ids` (requires analytics consent)

## 2. Legitimate Interest (Passthrough)

The passthrough acts as a transparent intermediary — the click ID was already present in the visitor's URL and would reach the destination directly if the short link didn't exist. The short link must not strip information the visitor was already carrying.

## 3. Consent-Gated Storage

Storage of `ad_click_ids` in the database is gated on LGPD analytics consent (cookie banner). Without consent, click IDs are forwarded but not stored.

## 4. Data Minimization

- Only 13 known ad platform IDs are forwarded (allowlist)
- Values are sanitized (charset, length cap, URL length cap)
- Unknown parameters are dropped
- Stored data is anonymized after 30 days by the `links-anonymize-clicks` cron

## 5. Data Subject Rights

- Phase 1 anonymization nullifies `ad_click_ids` on account deletion
- 30-day retention ensures timely cleanup
- Data export includes click IDs when present
```

- [ ] **Step 2: Commit**

```bash
git add docs/lgpd/links-click-id-lia.md
git commit -m "docs(lgpd): click ID passthrough LIA/RIPD for links engine"
```

---

## Dependency Graph

```
Phase 1 — Foundation (all parallel):
  Task 1→2 (normalizer TDD)
  Task 3→4 (passthrough TDD)
  Task 5 (types)
  Task 6 (utm-parser + barrel)
  Task 7 (migration 1: schema)

Phase 2 — P0 Fixes + Feature Integration (mostly parallel, 10 depends on 9):
  Task 8 (cron fixes)
  Task 9 (redirect + recorder) → Task 10 (click ID integration) → Task 19 (custom params sanitization)
  Task 11 (normalization entry points)
  Task 12 (coming-soon page)
  Task 13 (health check cron)
  Task 14 (batch ops) → Task 21 (batchActivateNow + annotations)
  Task 15 (redirect resolver pkg)
  Task 16 (UI updates) → Task 20 (utm_medium warning + smart defaults)
  Task 22 (LGPD docs) — independent, can run anytime

Phase 3 — Data Migration (LAST code task):
  Task 17 (migration 2: data)

Phase 4 — Verification:
  Task 18 (full test suite)
```

**Parallelizable groups:**
- Phase 1: Tasks 1-7 all independent — maximum parallelism
- Phase 2: Tasks 8-16, 19-22 — mostly independent (chains: 9→10→19, 14→21, 16→20)
- Phase 3: Task 17 must be last migration
- Phase 4: Task 18 is final verification
