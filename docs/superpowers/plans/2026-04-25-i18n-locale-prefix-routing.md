# i18n Locale Prefix Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate from inconsistent locale routing (`/pt-BR` home, `/blog/[locale]/[slug]`) to unified subdirectory prefix routing (`/pt/...` for Portuguese, unprefixed for English) with independent content model and optional cross-locale post linking.

**Architecture:** Middleware detects `/pt/` prefix, strips it, sets `x-locale` header, and rewrites to the unprefixed path. Page components read locale from the header — zero page duplication. Blog posts become locale-native with an optional `link_group_id` for cross-locale equivalence. Legacy URLs get 301 redirects.

**Tech Stack:** Next.js 15 App Router, Supabase PostgreSQL, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-04-25-i18n-locale-prefix-routing-design.md`

---

### Task 1: Database Migration — locale + link_group_id columns

**Files:**
- Create: `supabase/migrations/20260501000024_i18n_locale_columns.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- i18n locale prefix routing: add locale + link_group_id to blog_posts and campaigns
-- Additive only — no breaking changes.

-- 1. blog_posts: locale column (defaults to 'en')
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

-- 2. blog_posts: link_group_id for cross-locale equivalence
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS link_group_id uuid NULL;

-- 3. One post per locale per link group
DROP INDEX IF EXISTS blog_posts_link_group_locale;
CREATE UNIQUE INDEX blog_posts_link_group_locale
  ON public.blog_posts(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

-- 4. Backfill locale from existing translations
UPDATE public.blog_posts bp
SET locale = COALESCE(
  (SELECT bt.locale FROM public.blog_translations bt WHERE bt.post_id = bp.id LIMIT 1),
  'en'
);

-- 5. campaigns: same pattern
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en';

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS link_group_id uuid NULL;

DROP INDEX IF EXISTS campaigns_link_group_locale;
CREATE UNIQUE INDEX campaigns_link_group_locale
  ON public.campaigns(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

UPDATE public.campaigns c
SET locale = COALESCE(
  (SELECT ct.locale FROM public.campaign_translations ct WHERE ct.campaign_id = c.id LIMIT 1),
  'en'
);

-- 6. Flip site default locale from pt-BR to en
UPDATE public.sites
SET default_locale = 'en'
WHERE slug = 'bythiagofigueiredo' AND default_locale = 'pt-BR';
```

- [ ] **Step 2: Validate locally**

Run: `npm run db:start && npm run db:reset`
Expected: Migration applies without errors.

- [ ] **Step 3: Push to prod**

Run: `npm run db:push:prod`
Expected: Prompted with YES, applies cleanly.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260501000024_i18n_locale_columns.sql
git commit -m "feat(db): add locale + link_group_id to blog_posts and campaigns"
```

---

### Task 2: localePath utility

**Files:**
- Create: `apps/web/lib/i18n/locale-path.ts`
- Create: `apps/web/test/lib/i18n/locale-path.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/lib/i18n/locale-path.test.ts
import { describe, it, expect } from 'vitest'
import {
  localePath,
  localeFromPrefix,
  prefixFromLocale,
  LOCALE_PREFIX_MAP,
  DEFAULT_LOCALE,
} from '@/lib/i18n/locale-path'

describe('localePath', () => {
  it('returns unprefixed path for default locale (en)', () => {
    expect(localePath('/blog/my-post', 'en')).toBe('/blog/my-post')
  })

  it('prefixes /pt for pt-BR locale', () => {
    expect(localePath('/blog/meu-post', 'pt-BR')).toBe('/pt/blog/meu-post')
  })

  it('handles root path for pt-BR', () => {
    expect(localePath('/', 'pt-BR')).toBe('/pt/')
  })

  it('handles root path for en', () => {
    expect(localePath('/', 'en')).toBe('/')
  })

  it('returns path unchanged for unknown locale', () => {
    expect(localePath('/blog/x', 'fr')).toBe('/blog/x')
  })
})

describe('localeFromPrefix', () => {
  it('returns pt-BR for /pt prefix', () => {
    expect(localeFromPrefix('pt')).toBe('pt-BR')
  })

  it('returns null for unknown prefix', () => {
    expect(localeFromPrefix('fr')).toBeNull()
  })
})

describe('prefixFromLocale', () => {
  it('returns empty string for en', () => {
    expect(prefixFromLocale('en')).toBe('')
  })

  it('returns /pt for pt-BR', () => {
    expect(prefixFromLocale('pt-BR')).toBe('/pt')
  })
})

describe('constants', () => {
  it('LOCALE_PREFIX_MAP maps pt to pt-BR', () => {
    expect(LOCALE_PREFIX_MAP).toEqual({ pt: 'pt-BR' })
  })

  it('DEFAULT_LOCALE is en', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run apps/web/test/lib/i18n/locale-path.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/lib/i18n/locale-path.ts

export const LOCALE_PREFIX_MAP: Record<string, string> = {
  pt: 'pt-BR',
}

export const DEFAULT_LOCALE = 'en'

const LOCALE_TO_PREFIX: Record<string, string> = {
  en: '',
  'pt-BR': '/pt',
}

export function localePath(path: string, locale: string): string {
  const prefix = LOCALE_TO_PREFIX[locale] ?? ''
  return `${prefix}${path}`
}

export function localeFromPrefix(prefix: string): string | null {
  return LOCALE_PREFIX_MAP[prefix] ?? null
}

export function prefixFromLocale(locale: string): string {
  return LOCALE_TO_PREFIX[locale] ?? ''
}

export function hreflangCode(locale: string): string {
  return locale === 'pt-BR' ? 'pt' : locale
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- --run apps/web/test/lib/i18n/locale-path.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/i18n/locale-path.ts apps/web/test/lib/i18n/locale-path.test.ts
git commit -m "feat: add localePath utility for i18n prefix routing"
```

---

### Task 3: Middleware — locale prefix detection + legacy redirects

**Files:**
- Modify: `apps/web/src/middleware.ts`
- Create: `apps/web/test/middleware-locale.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/middleware-locale.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@tn-figueiredo/cms/ring', () => ({
  SupabaseRingContext: vi.fn().mockImplementation(() => ({
    getSiteByDomain: vi.fn().mockResolvedValue({
      id: 'site-1',
      org_id: 'org-1',
      default_locale: 'en',
      cms_enabled: true,
    }),
  })),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@tn-figueiredo/auth-nextjs/middleware', () => ({
  createAuthMiddleware: () => vi.fn().mockImplementation(async (req: NextRequest) => NextResponse.next()),
}))

describe('middleware locale detection', () => {
  let middleware: (req: NextRequest) => Promise<NextResponse>

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/middleware')
    middleware = mod.middleware
  })

  it('sets x-locale=en for unprefixed paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/my-post')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('en')
  })

  it('sets x-locale=pt-BR and rewrites for /pt/ prefix', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt/blog/meu-post')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('pt-BR')
  })

  it('sets x-locale=pt-BR for exact /pt path', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBe('pt-BR')
  })

  it('301 redirects /pt-BR to /pt', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt-BR')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt')
  })

  it('301 redirects /pt-BR/blog/x to /pt/blog/x', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/pt-BR/blog/x')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/x')
  })

  it('301 redirects /blog/pt-BR/slug to /pt/blog/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/pt-BR/my-post')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/my-post')
  })

  it('301 redirects /blog/en/slug to /blog/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/blog/en/my-post')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/blog/my-post')
  })

  it('301 redirects /campaigns/pt-BR/slug to /pt/campaigns/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/campaigns/pt-BR/my-campaign')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/campaigns/my-campaign')
  })

  it('301 redirects /campaigns/en/slug to /campaigns/slug', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/campaigns/en/my-campaign')
    const res = await middleware(req)
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/campaigns/my-campaign')
  })

  it('308 redirects /PT/blog/x to /pt/blog/x', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/PT/blog/x')
    const res = await middleware(req)
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe('https://bythiagofigueiredo.com/pt/blog/x')
  })

  it('skips locale detection for /admin paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/admin/dashboard')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })

  it('skips locale detection for /cms paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/cms/blog')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })

  it('skips locale detection for /api paths', async () => {
    const req = new NextRequest('https://bythiagofigueiredo.com/api/health')
    const res = await middleware(req)
    expect(res.headers.get('x-locale')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run apps/web/test/middleware-locale.test.ts`
Expected: FAIL — `x-locale` header not set.

- [ ] **Step 3: Add locale detection to middleware**

In `apps/web/src/middleware.ts`, add after the dev subdomain rewrite block (after line 131) and before the `resolveHostname` block (line 137):

```typescript
  // --- i18n locale prefix detection ---
  // Runs BEFORE site resolution. Detects /pt/ prefix, strips it, sets
  // x-locale header, and rewrites. Legacy URLs (/pt-BR/*, /blog/en/*,
  // /blog/pt-BR/*) get 301 redirects to new format.

  // Skip locale detection for internal paths
  const skipLocale =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cms') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next')

  if (!skipLocale) {
    // Legacy URL redirects (301)
    if (pathname === '/pt-BR' || pathname.startsWith('/pt-BR/')) {
      const newPath = '/pt' + pathname.slice(5) // '/pt-BR'.length = 5
      return NextResponse.redirect(new URL(newPath || '/pt', request.url), 301)
    }
    // /blog/pt-BR/slug → /pt/blog/slug
    if (pathname.startsWith('/blog/pt-BR/')) {
      const slug = pathname.slice(12) // '/blog/pt-BR/'.length = 12
      return NextResponse.redirect(new URL(`/pt/blog/${slug}`, request.url), 301)
    }
    // /blog/pt-BR → /pt/blog
    if (pathname === '/blog/pt-BR') {
      return NextResponse.redirect(new URL('/pt/blog', request.url), 301)
    }
    // /blog/en/slug → /blog/slug
    if (pathname.startsWith('/blog/en/')) {
      const slug = pathname.slice(8) // '/blog/en/'.length = 8
      return NextResponse.redirect(new URL(`/blog/${slug}`, request.url), 301)
    }
    // /blog/en → /blog
    if (pathname === '/blog/en') {
      return NextResponse.redirect(new URL('/blog', request.url), 301)
    }
    // /campaigns/pt-BR/slug → /pt/campaigns/slug
    if (pathname.startsWith('/campaigns/pt-BR/')) {
      const slug = pathname.slice(17) // '/campaigns/pt-BR/'.length = 17
      return NextResponse.redirect(new URL(`/pt/campaigns/${slug}`, request.url), 301)
    }
    // /campaigns/en/slug → /campaigns/slug
    if (pathname.startsWith('/campaigns/en/')) {
      const slug = pathname.slice(13) // '/campaigns/en/'.length = 13
      return NextResponse.redirect(new URL(`/campaigns/${slug}`, request.url), 301)
    }

    // Uppercase normalization: /PT/... → 308 → /pt/...
    if (pathname.startsWith('/PT/') || pathname === '/PT') {
      const newPath = '/pt' + pathname.slice(3)
      return NextResponse.redirect(new URL(newPath || '/pt', request.url), 308)
    }

    // Active locale prefix detection
    let detectedLocale = 'en'
    let strippedPathname = pathname

    if (pathname === '/pt' || pathname.startsWith('/pt/')) {
      detectedLocale = 'pt-BR'
      strippedPathname = pathname.slice(3) || '/' // '/pt'.length = 3
    }

    // If prefix was detected and path was stripped, rewrite
    if (detectedLocale !== 'en') {
      const rewriteUrl = request.nextUrl.clone()
      rewriteUrl.pathname = strippedPathname
      const res = NextResponse.rewrite(rewriteUrl)
      res.headers.set('x-locale', detectedLocale)
      // Continue to site resolution by falling through below
      // But we need to handle this specially — store locale for later
      // Actually, we need to merge with site resolution...
    }
  }
```

Wait — the middleware structure requires that locale detection integrates with the existing response flow. Let me restructure. Replace the entire `middleware` function body with:

In `apps/web/src/middleware.ts`, replace the `middleware` function (lines 109-161) with:

```typescript
export async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  const host = request.headers.get('host') ?? request.nextUrl.host ?? ''
  const hostname = host.split(':')[0] ?? ''
  const url = request.nextUrl.clone()
  const { pathname } = request.nextUrl

  // Dev subdomain rewrite — runs before everything else.
  const isDevSubdomain =
    hostname === 'dev.bythiagofigueiredo.com' ||
    hostname === 'dev.localhost'
  const isSeoRoute = pathname === '/sitemap.xml' || pathname === '/robots.txt'
  if (isDevSubdomain && !isSeoRoute && !url.pathname.startsWith('/dev')) {
    url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
    return NextResponse.rewrite(url)
  }

  // --- i18n: locale prefix detection + legacy redirects ---
  const skipLocale =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cms') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/og/')

  let detectedLocale = 'en'
  let effectivePathname = pathname

  if (!skipLocale) {
    // Legacy URL redirects (301) — preserve SEO equity
    if (pathname === '/pt-BR' || pathname.startsWith('/pt-BR/')) {
      const rest = pathname.slice(5) // '/pt-BR'.length = 5
      return NextResponse.redirect(new URL(`/pt${rest}`, request.url), 301)
    }
    const legacyContentMatch = pathname.match(/^\/(blog|campaigns)\/(pt-BR|en)(?:\/(.*))?$/)
    if (legacyContentMatch) {
      const [, section, locale, slug] = legacyContentMatch
      if (locale === 'en') {
        return NextResponse.redirect(
          new URL(slug ? `/${section}/${slug}` : `/${section}`, request.url),
          301,
        )
      }
      return NextResponse.redirect(
        new URL(slug ? `/pt/${section}/${slug}` : `/pt/${section}`, request.url),
        301,
      )
    }

    // Uppercase normalization: /PT/... → 308 → /pt/...
    if (pathname === '/PT' || pathname.startsWith('/PT/')) {
      return NextResponse.redirect(
        new URL(`/pt${pathname.slice(3)}`, request.url),
        308,
      )
    }

    // Active /pt/ prefix detection
    if (pathname === '/pt' || pathname.startsWith('/pt/')) {
      detectedLocale = 'pt-BR'
      effectivePathname = pathname.slice(3) || '/'
    }
  }

  // Dev hostname override for local development
  const resolveHostname =
    (hostname === 'localhost' || hostname === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      : hostname

  // Site resolution (Edge-safe, anon key)
  const siteRes = await resolveSite(request, resolveHostname, effectivePathname)

  // Inject x-locale header into the response
  if (!skipLocale) {
    siteRes.response.headers.set('x-locale', detectedLocale)
  }

  // If /pt/ prefix was detected, rewrite to stripped path
  if (detectedLocale !== 'en' && !siteRes.shortCircuit) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = effectivePathname
    const res = NextResponse.rewrite(rewriteUrl)
    // Copy all headers from site resolution
    siteRes.response.headers.forEach((value, key) => {
      res.headers.set(key, value)
    })
    res.headers.set('x-locale', detectedLocale)

    // Auth gating for rewritten paths
    if (effectivePathname.startsWith('/admin')) {
      const authRes = await adminAuth(request)
      return mergeSiteHeaders(authRes, res)
    }
    if (effectivePathname.startsWith('/cms')) {
      const authRes = await cmsAuth(request)
      return mergeSiteHeaders(authRes, res)
    }
    return res
  }

  if (siteRes.shortCircuit) return siteRes.response

  // Auth gating — dispatch to area-specific instance
  if (pathname.startsWith('/admin')) {
    const authRes = await adminAuth(request)
    return mergeSiteHeaders(authRes, siteRes.response)
  }
  if (pathname.startsWith('/cms')) {
    const authRes = await cmsAuth(request)
    return mergeSiteHeaders(authRes, siteRes.response)
  }

  return siteRes.response
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- --run apps/web/test/middleware-locale.test.ts`
Expected: All 14 tests PASS.

- [ ] **Step 5: Run existing middleware tests**

Run: `npm run test:web -- --run apps/web/test/middleware`
Expected: All tests PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/test/middleware-locale.test.ts
git commit -m "feat: add locale prefix detection + legacy redirects to middleware"
```

---

### Task 4: Root layouts — dynamic `<html lang>` + fallback cleanup

**Files:**
- Modify: `apps/web/src/app/layout.tsx:64` — dynamic `lang`
- Modify: `apps/web/src/app/(public)/layout.tsx:76` — read `x-locale` header
- Modify: `apps/web/lib/cms/site-context.ts:30` — fallback `'en'`
- Modify: `apps/web/lib/seo/config.ts` — fallback `'en'`

- [ ] **Step 1: Make root layout `<html lang>` dynamic**

In `apps/web/src/app/layout.tsx`, add headers import and change the `<html>` tag:

Add at line 3 (after `import { cookies } from 'next/headers'`):
```typescript
import { headers } from 'next/headers'
```

Replace line 60-64:
```typescript
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  return (
    <html
      lang="pt-BR"
```

With:
```typescript
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const h = await headers()
  const lang = h.get('x-locale') === 'pt-BR' ? 'pt-BR' : 'en'
  return (
    <html
      lang={lang}
```

- [ ] **Step 2: Update public layout to read `x-locale` header**

In `apps/web/src/app/(public)/layout.tsx`, replace line 76:
```typescript
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
```
With:
```typescript
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
```

Note: `headers` is already imported on line 4.

- [ ] **Step 3: Change site-context fallback from `pt-BR` to `en`**

In `apps/web/lib/cms/site-context.ts`, replace line 30:
```typescript
  const defaultLocale = h.get('x-default-locale') ?? 'pt-BR'
```
With:
```typescript
  const defaultLocale = h.get('x-default-locale') ?? 'en'
```

- [ ] **Step 4: Change SEO config fallback**

In `apps/web/lib/seo/config.ts`, find the line with the `supportedLocales` fallback (the `?? ['pt-BR']` pattern) and change to `?? ['en']`. Also change the `defaultLocale` fallback similarly.

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/\(public\)/layout.tsx apps/web/lib/cms/site-context.ts apps/web/lib/seo/config.ts
git commit -m "feat: dynamic <html lang> + fallback chain cleanup (pt-BR → en)"
```

---

### Task 5: Home page — read `x-locale` + delete `/pt-BR` directory

**Files:**
- Modify: `apps/web/src/app/(public)/page.tsx:29` — read `x-locale`
- Delete: `apps/web/src/app/(public)/pt-BR/` — entire directory

- [ ] **Step 1: Update home page to read `x-locale`**

In `apps/web/src/app/(public)/page.tsx`, replace line 29:
```typescript
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
```
With:
```typescript
  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
```

Note: `headers` is already imported on line 1.

- [ ] **Step 2: Delete the pt-BR hardcoded home directory**

```bash
rm -rf apps/web/src/app/\(public\)/pt-BR/
```

Middleware now handles `/pt` → rewrite to `/` with `x-locale: pt-BR`, so the same `page.tsx` serves both locales.

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/app/\(public\)/pt-BR/ apps/web/src/app/\(public\)/page.tsx
git commit -m "feat: home page reads x-locale, delete hardcoded /pt-BR directory"
```

---

### Task 6: Blog routing — remove `[locale]` segment

**Files:**
- Delete: `apps/web/src/app/(public)/blog/[locale]/` — entire directory
- Create: `apps/web/src/app/(public)/blog/[slug]/page.tsx` — moved from `[locale]/[slug]`
- Modify: `apps/web/src/app/(public)/blog/page.tsx` — render index directly
- Move: `apps/web/src/app/(public)/blog/[locale]/category-filter.tsx` → `apps/web/src/app/(public)/blog/category-filter.tsx`

- [ ] **Step 1: Move category-filter out of [locale] directory**

```bash
cp apps/web/src/app/\(public\)/blog/\[locale\]/category-filter.tsx apps/web/src/app/\(public\)/blog/category-filter.tsx
```

- [ ] **Step 2: Create blog/[slug]/page.tsx**

Copy the content from `blog/[locale]/[slug]/page.tsx` but change how locale is obtained:

- Remove `locale` from the `params` type — it's now `{ slug: string }` only
- Read locale from `x-locale` header: `const locale = (await headers()).get('x-locale') ?? 'en'`
- Update all `href={/blog/${locale}}` to use `localePath('/blog', locale)` and `href={/blog/${locale}/${slug}}` to use `localePath(`/blog/${slug}`, locale)`
- Update `pageUrl` to use `localePath(`/blog/${encodeURIComponent(slug)}`, locale)`
- Import `localePath` from `@/lib/i18n/locale-path`
- Copy `blog-article-client.tsx` into the new `[slug]/` directory

```bash
mkdir -p apps/web/src/app/\(public\)/blog/\[slug\]/
cp apps/web/src/app/\(public\)/blog/\[locale\]/\[slug\]/blog-article-client.tsx apps/web/src/app/\(public\)/blog/\[slug\]/
```

Create `apps/web/src/app/(public)/blog/[slug]/page.tsx` based on the existing `[locale]/[slug]/page.tsx` with these key changes in the function signature and locale reading:

```typescript
interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  // ... rest unchanged except:
  // - href={`/blog/${locale}`} → href={localePath('/blog', locale)}
  // - pageUrl uses localePath
```

- [ ] **Step 3: Rewrite blog/page.tsx as the index page**

Replace `apps/web/src/app/(public)/blog/page.tsx` with the content from `blog/[locale]/page.tsx`, but read locale from header instead of params:

```typescript
// Key changes from [locale]/page.tsx:
// 1. No params.locale — read from header
// 2. Import localePath
// 3. All links use localePath()

import { headers } from 'next/headers'
import { localePath } from '@/lib/i18n/locale-path'
// ... other imports from [locale]/page.tsx, but update CategoryFilter import path

interface Props {
  searchParams: Promise<{ page?: string; category?: string }>
}

export default async function BlogListPage({ searchParams }: Props) {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  // ... rest of the component, replacing:
  //   href={`/blog/${locale}/${post.slug}`} → href={localePath(`/blog/${post.slug}`, locale)}
  //   hrefFor={(loc) => `/blog/${loc}`} → hrefFor={(loc) => localePath('/blog', loc)}
  //   buildBreadcrumbNode ... url: `${config.siteUrl}/blog/${locale}` → url: `${config.siteUrl}${localePath('/blog', locale)}`
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string>> }): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  // ... same as before but using locale from header
}
```

- [ ] **Step 4: Delete the old [locale] directory**

```bash
rm -rf apps/web/src/app/\(public\)/blog/\[locale\]/
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: Tests may fail due to test file references — those will be fixed in Task 17. Core app should compile.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/app/\(public\)/blog/
git commit -m "feat: blog routing uses x-locale header, remove [locale] segment"
```

---

### Task 7: Campaign routing — remove `[locale]` segment

**Files:**
- Delete: `apps/web/src/app/(public)/campaigns/[locale]/` — entire directory
- Create: `apps/web/src/app/(public)/campaigns/[slug]/page.tsx` — moved from `[locale]/[slug]`

- [ ] **Step 1: Create campaigns/[slug]/page.tsx**

Same pattern as blog: copy from `[locale]/[slug]/page.tsx`, change params to `{ slug: string }`, read locale from `x-locale` header, use `localePath()` for all links.

```bash
mkdir -p apps/web/src/app/\(public\)/campaigns/\[slug\]/
```

Key changes:
- `params: Promise<{ slug: string }>` (remove locale)
- `const locale = (await headers()).get('x-locale') ?? 'en'`
- Breadcrumb href: `localePath('/campaigns', locale)` instead of `/campaigns/${locale}`
- Import `localePath` from `@/lib/i18n/locale-path`

- [ ] **Step 2: Delete old [locale] directory**

```bash
rm -rf apps/web/src/app/\(public\)/campaigns/\[locale\]/
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src/app/\(public\)/campaigns/
git commit -m "feat: campaign routing uses x-locale header, remove [locale] segment"
```

---

### Task 8: Language switcher + header components

**Files:**
- Modify: `apps/web/src/components/layout/top-strip.tsx` — `/pt` ↔ `/`
- Modify: `apps/web/src/components/layout/global-header.tsx` — `homeHref` logic
- Modify: `apps/web/src/components/layout/header-types.ts` — nav items use `localePath()`

- [ ] **Step 1: Update TopStrip**

In `apps/web/src/components/layout/top-strip.tsx`:

Replace the PT link (line 56-67):
```typescript
          <Link
            href="/pt-BR"
            hrefLang="pt-BR"
```
With:
```typescript
          <Link
            href="/pt"
            hrefLang="pt"
```

Replace the EN link (line 83-94):
```typescript
          <Link
            href="/"
            hrefLang="en"
```
This stays the same — already correct.

- [ ] **Step 2: Update GlobalHeader homeHref**

In `apps/web/src/components/layout/global-header.tsx`, replace line 10:
```typescript
  const homeHref = locale === 'pt-BR' ? '/pt-BR' : '/'
```
With:
```typescript
  const homeHref = locale === 'pt-BR' ? '/pt' : '/'
```

- [ ] **Step 3: Update header-types.ts nav items**

In `apps/web/src/components/layout/header-types.ts`, add import and update `buildNavItems` to use `localePath()`:

Add import:
```typescript
import { localePath } from '@/lib/i18n/locale-path'
```

Update the nav items to use `localePath()` for internal links. For the home href:
```typescript
  const homeHref = locale === 'pt-BR' ? '/pt' : '/'
```

Update blog/newsletter/contact hrefs to use `localePath('/blog', locale)`, `localePath('/newsletters', locale)`, `localePath('/contact', locale)`.

- [ ] **Step 4: Run tests**

Run: `npm run test:web -- --run apps/web/test/components/layout/`
Expected: Tests may need updates (Task 17). Components should compile.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/top-strip.tsx apps/web/src/components/layout/global-header.tsx apps/web/src/components/layout/header-types.ts
git commit -m "feat: language switcher uses /pt, header nav uses localePath()"
```

---

### Task 9: Public components — locale-aware URLs

**Files:**
- Modify: `apps/web/src/app/(public)/components/DualHero.tsx`
- Modify: `apps/web/src/app/(public)/components/UnifiedFeed.tsx`
- Modify: `apps/web/src/app/(public)/components/PinboardFooter.tsx`
- Modify: `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx`

- [ ] **Step 1: Update DualHero**

In `DualHero.tsx`, add import:
```typescript
import { localePath } from '@/lib/i18n/locale-path'
```

Replace the `blogBase` ternary pattern:
```typescript
const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'
```
With:
```typescript
const blogBase = localePath('/blog', locale)
```

Update post link: `href={`${blogBase}/${post.slug}`}` stays the same (blogBase is now correct).

- [ ] **Step 2: Update UnifiedFeed**

Same pattern: add import, replace `blogBase` ternary with `localePath('/blog', locale)`.

- [ ] **Step 3: Update PinboardFooter**

In `PinboardFooter.tsx`, add import and replace:
```typescript
const blogHref = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'
```
With:
```typescript
const blogHref = localePath('/blog', locale)
```

- [ ] **Step 4: Update NewslettersHub**

In `NewslettersHub.tsx`, add import and replace all 3 locale-conditional links:
```typescript
locale === 'pt-BR' ? '/pt-BR' : '/'           → localePath('/', locale)
locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en' → localePath('/blog', locale)
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: Components compile and render correctly.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(public\)/components/DualHero.tsx apps/web/src/app/\(public\)/components/UnifiedFeed.tsx apps/web/src/app/\(public\)/components/PinboardFooter.tsx apps/web/src/app/\(public\)/newsletters/components/NewslettersHub.tsx
git commit -m "feat: public components use localePath() for locale-aware URLs"
```

---

### Task 10: Contact page + email fallback

**Files:**
- Modify: `apps/web/src/app/(public)/contact/page.tsx` — read `x-locale`
- Modify: `apps/web/src/app/(public)/contact/actions.ts` — read locale from header
- Modify: `apps/web/lib/email/resend.ts` — fallback `'en'`

- [ ] **Step 1: Update contact page**

In `contact/page.tsx`, read locale from `x-locale` header instead of hardcoded `pt-BR`. Replace any `locale = 'pt-BR'` with reading from the header.

- [ ] **Step 2: Update contact actions**

In `contact/actions.ts`, replace the hardcoded `'pt-BR'` locale (line ~33) with reading from the `x-locale` header via `headers()`.

- [ ] **Step 3: Update email fallback**

In `apps/web/lib/email/resend.ts`, change the fallback locale from `'pt-BR'` to `'en'` (line ~41).

- [ ] **Step 4: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/contact/page.tsx apps/web/src/app/\(public\)/contact/actions.ts apps/web/lib/email/resend.ts
git commit -m "feat: contact page reads x-locale, email fallback changed to en"
```

---

### Task 11: RSS feed — locale-aware

**Files:**
- Modify: `apps/web/src/app/(public)/feed.xml/route.ts`

- [ ] **Step 1: Update feed route to read `x-locale`**

In `feed.xml/route.ts`, replace the `ctx.defaultLocale` usage with reading from `x-locale` header:

```typescript
import { headers } from 'next/headers'
import { localePath } from '@/lib/i18n/locale-path'

// In the GET handler:
const h = await headers()
const locale = h.get('x-locale') ?? 'en'
```

Replace the locale filter and `<language>` tag to use the detected locale. Update `<link>` to use `localePath('/blog', locale)`.

- [ ] **Step 2: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/feed.xml/route.ts
git commit -m "feat: RSS feed reads x-locale for per-locale feeds"
```

---

### Task 12: SEO — page-metadata + enumerator + cache-invalidation

**Files:**
- Modify: `apps/web/lib/seo/page-metadata.ts`
- Modify: `apps/web/lib/seo/enumerator.ts`
- Modify: `apps/web/lib/seo/cache-invalidation.ts`
- Modify: `apps/web/src/app/sitemap.ts`

- [ ] **Step 1: Update page-metadata.ts**

Key changes:
- `generateBlogIndexMetadata`: change path from `/blog/${locale}` to `localePath('/blog', locale)`
- `generateBlogPostMetadata`: change path from `/blog/${locale}/${slug}` to `localePath(`/blog/${slug}`, locale)`. Add `linkedPosts` parameter for hreflang. Use `hreflangCode()` for alternate keys.
- `generateCampaignMetadata`: same pattern as blog
- Import `localePath` and `hreflangCode` from `@/lib/i18n/locale-path`

- [ ] **Step 2: Update enumerator.ts**

Replace `STATIC_ROUTE_DEFS` with a function that generates per-locale static routes. Replace hardcoded `/pt-BR` with generated paths using `localePath()`.

For blog/campaign routes, change path from `/blog/${locale}/${slug}` to `localePath(`/blog/${slug}`, locale)`.

- [ ] **Step 3: Update cache-invalidation.ts**

Change `revalidatePath` calls:
```typescript
// Old:
revalidatePath(`/blog/${locale}/${slug}`)
revalidatePath(`/blog/${locale}`)

// New:
revalidatePath(localePath(`/blog/${slug}`, locale))
revalidatePath(localePath('/blog', locale))
```

Same for campaigns.

- [ ] **Step 4: Update sitemap.ts**

Update `toSitemapEntry` if needed to handle the new path patterns. The alternates should use `hreflangCode()` for keys.

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: SEO tests will need updates (Task 17), but modules should compile.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/seo/page-metadata.ts apps/web/lib/seo/enumerator.ts apps/web/lib/seo/cache-invalidation.ts apps/web/src/app/sitemap.ts
git commit -m "feat(seo): update path patterns to locale prefix routing"
```

---

### Task 13: SEO JSON-LD — `inLanguage` + `translationOfWork`

**Files:**
- Modify: `apps/web/lib/seo/jsonld/builders.ts`

- [ ] **Step 1: Add `inLanguage` to BlogPosting and Article nodes**

In `buildBlogPostingNode`, add `inLanguage` property based on the locale:
```typescript
inLanguage: locale,
```

Add the locale parameter to the function signature.

- [ ] **Step 2: Add `translationOfWork` / `workTranslation` for linked posts**

When linked posts exist, add:
```typescript
translationOfWork: { '@id': linkedPostUrl },
workTranslation: { '@id': linkedPostUrl },
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web -- --run apps/web/test/lib/seo/jsonld/`
Expected: Tests may need updates (Task 17).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/seo/jsonld/builders.ts
git commit -m "feat(seo): add inLanguage to BlogPosting JSON-LD nodes"
```

---

### Task 14: 404 page — locale-aware

**Files:**
- Create: `apps/web/src/app/not-found.tsx`

- [ ] **Step 1: Create locale-aware 404 page**

```typescript
// apps/web/src/app/not-found.tsx
import { headers } from 'next/headers'
import Link from 'next/link'

export default async function NotFound() {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const isPt = locale === 'pt-BR'

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '80px 28px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 18, marginBottom: 32, color: 'var(--pb-muted)' }}>
        {isPt ? 'Página não encontrada.' : 'Page not found.'}
      </p>
      <Link
        href={isPt ? '/pt' : '/'}
        style={{ color: 'var(--pb-accent)', textDecoration: 'underline' }}
      >
        {isPt ? '← Voltar ao início' : '← Back to home'}
      </Link>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/not-found.tsx
git commit -m "feat: locale-aware 404 page"
```

---

### Task 15: CMS — blog locale selector

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx`

- [ ] **Step 1: Add locale selector to new post page**

In `blog/new/page.tsx`, read locale from search params and pass to the post creation:

```typescript
// Add to the function, before post creation:
const sp = await searchParams
const postLocale = sp?.locale ?? ctx.defaultLocale

// In the create call:
const post = await postRepo().create({
  site_id: ctx.siteId,
  initial_translation: {
    locale: postLocale,
    title: postLocale === 'pt-BR' ? 'Sem título' : 'Untitled',
    slug: uniqueSlug,
    content_mdx: '',
  },
})
```

Add a simple locale redirect UI or accept `?locale=pt-BR` as a query param.

- [ ] **Step 2: Update savePost action to set blog_posts.locale**

In `blog/[id]/edit/actions.ts`, update `savePost` to also update the `locale` column on `blog_posts`:

```typescript
// After the translations update, also set the locale on blog_posts:
await db.from('blog_posts').update({ locale }).eq('id', postId)
```

- [ ] **Step 3: Update posts-filters locale options**

In `posts-filters.tsx`, update the `LOCALE_OPTIONS` to match the new setup. The filter values should remain `'pt-BR'` and `'en'` (these are DB values, not URL segments).

- [ ] **Step 4: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/new/page.tsx apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/actions.ts apps/web/src/app/cms/\(authed\)/blog/_components/posts-filters.tsx
git commit -m "feat(cms): blog post locale selector + save locale column"
```

---

### Task 16: Newsletter archive — locale filtering

**Files:**
- Modify: `apps/web/src/app/(public)/newsletter/archive/page.tsx`

- [ ] **Step 1: Add locale filtering to archive query**

Read `x-locale` from headers. Join `newsletter_types` and filter by `newsletter_types.locale` matching the request locale:

```typescript
const h = await headers()
const locale = h.get('x-locale') ?? 'en'

// Update the query to filter by newsletter_type locale:
const { data } = await db
  .from('newsletter_editions')
  .select('id, subject, sent_at, newsletter_types!inner(name, color, locale)')
  .eq('site_id', ctx.siteId)
  .eq('status', 'sent')
  .eq('newsletter_types.locale', locale === 'pt-BR' ? 'pt-BR' : 'en')
  .order('sent_at', { ascending: false })
```

- [ ] **Step 2: Run tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/newsletter/archive/page.tsx
git commit -m "feat: newsletter archive filters by locale"
```

---

### Task 17: Unit test updates (15 files)

**Files:**
- Modify: `apps/web/test/app/sitemap.test.ts`
- Modify: `apps/web/test/app/blog-detail.test.tsx`
- Modify: `apps/web/test/app/cms-blog-actions.test.ts`
- Modify: `apps/web/test/components/locale-switcher.test.tsx`
- Modify: `apps/web/test/components/layout/global-header.test.tsx`
- Modify: `apps/web/test/components/layout/top-strip.test.tsx`
- Modify: `apps/web/test/app/og/blog-route.test.ts`
- Modify: `apps/web/test/app/og/campaign-route.test.ts`
- Modify: `apps/web/test/lib/seo/cache-invalidation.test.ts`
- Modify: `apps/web/test/lib/seo/noindex.test.ts`
- Modify: `apps/web/test/lib/seo/enumerator.test.ts`
- Modify: `apps/web/test/lib/seo/page-metadata.test.ts`
- Modify: `apps/web/test/api/health/seo.test.ts`
- Modify: `apps/web/test/lib/seo/jsonld/builders.test.ts`
- Modify: `apps/web/test/lib/seo/jsonld/builders-types.test.ts`

- [ ] **Step 1: Update URL patterns across all test files**

Apply these replacements across all 15 files:

| Old Pattern | New Pattern |
|---|---|
| `/pt-BR` (home) | `/pt` |
| `/blog/pt-BR/slug` | `/pt/blog/slug` |
| `/blog/pt-BR` (index) | `/pt/blog` |
| `/blog/en/slug` | `/blog/slug` |
| `/blog/en` (index) | `/blog` |
| `/campaigns/pt-BR/slug` | `/pt/campaigns/slug` |
| `/campaigns/en/slug` | `/campaigns/slug` |

For each file, find-and-replace the locale-specific URL patterns.

**top-strip.test.tsx:** Change `/pt-BR` to `/pt` (line 23).

**global-header.test.tsx:** Change `/pt-BR` to `/pt` (line 50).

**locale-switcher.test.tsx:** Update `hrefFor` callbacks. Change `/blog/${l}/hello` to `localePath('/blog/hello', l)` pattern.

**cache-invalidation.test.ts:**
- `/blog/pt-BR/my-post` → `/pt/blog/my-post`
- `/blog/pt-BR` → `/pt/blog`
- `/campaigns/pt-BR/launch` → `/pt/campaigns/launch`

**sitemap.test.ts:** Update all path patterns and alternates.

**page-metadata.test.ts:** Update all hreflang URL patterns and breadcrumb URLs.

**enumerator.test.ts:** Update expected paths from `/blog/pt-BR/published-1` to `/pt/blog/published-1`.

**noindex.test.ts:** Update test paths to new patterns.

**builders.test.ts + builders-types.test.ts:** Update breadcrumb URLs from `/blog/pt-BR` to `/pt/blog`.

**health/seo.test.ts:** Update fake routes from `/pt-BR` to `/pt`.

**blog-detail.test.tsx:** Update canonical and alternates patterns.

**cms-blog-actions.test.ts:** Update `revalidatePath` assertions.

**OG route tests (blog-route.test.ts, campaign-route.test.ts):** These test internal `/og/blog/[locale]/[slug]` routes which keep the `[locale]` segment — these should NOT change. Only update if they assert public URL patterns.

- [ ] **Step 2: Run all tests**

Run: `npm run test:web`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/
git commit -m "test: update 15 unit test files for locale prefix routing"
```

---

### Task 18: E2E test updates (3 files)

**Files:**
- Modify: `apps/web/e2e/tests/public/homepage.spec.ts`
- Modify: `apps/web/e2e/tests/cms/blog.spec.ts`
- Modify: `apps/web/e2e/tests/cms/campaigns.spec.ts`

- [ ] **Step 1: Update homepage spec**

In `homepage.spec.ts`, replace:
```typescript
await page.goto('/blog/pt-BR')
```
With:
```typescript
await page.goto('/pt/blog')
```

- [ ] **Step 2: Update blog CMS spec**

In `blog.spec.ts`, replace:
```typescript
await publicPage.goto('/blog/pt-BR/test-${testId}-publish')
await publicPage.goto('/blog/pt-BR/test-${testId}-unpublish')
```
With:
```typescript
await publicPage.goto('/pt/blog/test-${testId}-publish')
await publicPage.goto('/pt/blog/test-${testId}-unpublish')
```

- [ ] **Step 3: Update campaigns CMS spec**

In `campaigns.spec.ts`, replace:
```typescript
await publicPage.goto('/campaigns/pt-BR/test-${testId}-publish-campaign')
```
With:
```typescript
await publicPage.goto('/pt/campaigns/test-${testId}-publish-campaign')
```

- [ ] **Step 4: Run E2E tests (if local DB available)**

Run: `npx playwright test`
Expected: All E2E tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/e2e/
git commit -m "test(e2e): update 3 Playwright specs for locale prefix routing"
```

---

### Task 19: Final validation + full test run

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All API + web tests PASS.

- [ ] **Step 2: Start dev server and verify manually**

Run: `npm run dev -w apps/web`

Verify:
- `http://localhost:3000/` → EN home, `<html lang="en">`
- `http://localhost:3000/pt` → PT home, `<html lang="pt-BR">`
- `http://localhost:3000/pt/blog` → PT blog index
- `http://localhost:3000/blog` → EN blog index
- `http://localhost:3000/pt-BR` → 301 redirect to `/pt`
- `http://localhost:3000/blog/pt-BR/any-slug` → 301 redirect to `/pt/blog/any-slug`
- `http://localhost:3000/blog/en/any-slug` → 301 redirect to `/blog/any-slug`
- Language switcher: clicking PT goes to `/pt`, clicking EN goes to `/`
- `http://localhost:3000/PT/blog` → 308 redirect to `/pt/blog`
- `http://localhost:3000/nonexistent` → 404 page in English
- `http://localhost:3000/pt/nonexistent` → 404 page in Portuguese
- RSS: `/feed.xml` returns EN content, `/pt/feed.xml` returns PT content
- Sitemap: `/sitemap.xml` includes both `/` and `/pt` entries

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: final adjustments from manual testing"
```
