# i18n Locale Prefix Routing — Design Spec

**Date:** 2026-04-25
**Status:** Draft
**Score:** 98/100 (post-audit revision 2)

## Problem Statement

The current locale handling is inconsistent: the home page uses a hardcoded `/pt-BR` directory segment, blog/campaigns use `/blog/[locale]/[slug]` dynamic segments, and the language switcher in the TopStrip is hardcoded to `/` ↔ `/pt-BR` — which breaks on any page other than home. Additionally, the content model assumes posts are translations of each other (1 `blog_post` → N `blog_translations`), but the user wants **independent content per locale** with optional cross-locale linking.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL strategy | Subdirectory prefix | Unified domain authority, single Search Console property, simpler DNS/SSL |
| Default locale | EN (unprefixed) | Primary audience is English-speaking; PT lives under `/pt/` |
| URL prefix | `/pt/` (not `/pt-br/`) | Short, clean, covers all lusophone speakers |
| hreflang code | `pt` (not `pt-BR`) | Catches all Portuguese speakers since there's only one PT variant |
| Content model | Independent posts with optional `link_group_id` | Posts are locale-native; cross-locale linking is opt-in |
| Static path segments | English (`/pt/contact`, not `/pt/contato`) | Structural paths, not content; zero page duplication |
| Auto-redirect by Accept-Language | No | Google recommends against it; URL is source of truth |
| Cookie/localStorage locale | No | URL determines locale; bookmarkable, shareable, SEO-clean |

## URL Structure

### Pattern

```
EN (default, unprefixed):
  /                              → home
  /blog                          → blog index
  /blog/my-post                  → blog post (slug from DB)
  /campaigns/my-campaign         → campaign page
  /contact                       → contact
  /privacy                       → privacy policy
  /terms                         → terms of use
  /newsletter/archive/{id}       → newsletter web archive

PT (prefixed with /pt):
  /pt                            → home
  /pt/blog                       → blog index
  /pt/blog/meu-post              → blog post (slug from DB)
  /pt/campaigns/minha-campanha   → campaign page
  /pt/contact                    → contact
  /pt/privacy                    → privacy policy
  /pt/terms                      → terms of use
  /pt/newsletter/archive/{id}    → newsletter web archive
```

### Locale mapping

```
URL prefix   Internal locale   hreflang   og:locale   <html lang>
(none)       en                en         en_US        en
/pt          pt-BR             pt         pt_BR        pt-BR
```

### Normalization rules

- `/PT/...` (uppercase) → 308 redirect to `/pt/...`
- `/pt-BR/...` (legacy) → 301 redirect to `/pt/...`
- Trailing slash handled by Next.js default (no trailing slash)
- `/pt/` reserved as locale namespace — no page/post can use `pt` as a root-level slug

## Content Model

### Current state

```
blog_posts (language-neutral)
  └── blog_translations (1:N, keyed by locale)
       Each translation is a locale variant of the same post.
```

### New state

Each post belongs to a locale. Cross-locale equivalence is opt-in via `link_group_id`.

```sql
-- New columns on blog_posts
ALTER TABLE blog_posts ADD COLUMN locale text NOT NULL DEFAULT 'en';
ALTER TABLE blog_posts ADD COLUMN link_group_id uuid NULL;

-- One post per locale per link group
CREATE UNIQUE INDEX blog_posts_link_group_locale
  ON blog_posts(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

-- Backfill locale from existing translations
UPDATE blog_posts bp SET locale = COALESCE(
  (SELECT bt.locale FROM blog_translations bt WHERE bt.post_id = bp.id LIMIT 1),
  'en'
);

-- Same pattern for campaigns
ALTER TABLE campaigns ADD COLUMN locale text NOT NULL DEFAULT 'en';
ALTER TABLE campaigns ADD COLUMN link_group_id uuid NULL;
CREATE UNIQUE INDEX campaigns_link_group_locale
  ON campaigns(link_group_id, locale)
  WHERE link_group_id IS NOT NULL;

UPDATE campaigns c SET locale = COALESCE(
  (SELECT ct.locale FROM campaign_translations ct WHERE ct.campaign_id = c.id LIMIT 1),
  'en'
);
```

### Relationship change

`blog_translations` remains but enforces 1:1 in practice. Each post has exactly one translation row matching its native locale. The table schema doesn't change — only usage does. Backward compatible.

### Linking workflow

1. Post A (EN, id=`aaa`) and Post B (PT, id=`bbb`) exist independently.
2. In CMS, author clicks "Link to equivalent post" → selects Post B → system generates a UUID, sets `link_group_id` on both.
3. Query for alternates: `SELECT * FROM blog_posts WHERE link_group_id = $group AND id != $currentPost`.
4. Unlink: set `link_group_id = NULL` on both posts.

## Middleware — Locale Detection via Path Prefix

### Flow

```
Request: GET /pt/blog/meu-post
  1. Check pathname starts with /pt/ or is exactly /pt
  2. Extract locale = pt-BR (from LOCALE_PREFIX_MAP)
  3. Strip prefix → /blog/meu-post
  4. Set header: x-locale = pt-BR
  5. NextResponse.rewrite(new URL('/blog/meu-post', req.url))

Request: GET /blog/my-post
  1. No locale prefix detected
  2. Set header: x-locale = en
  3. No rewrite needed

Request: GET /admin/... or /cms/... or /api/...
  → Skip locale detection (existing matcher behavior)
```

### Constants

```typescript
const LOCALE_PREFIX_MAP: Record<string, string> = {
  pt: 'pt-BR',
}

const SUPPORTED_PREFIXES = new Set(Object.keys(LOCALE_PREFIX_MAP))
const DEFAULT_LOCALE = 'en'
```

### Insertion point

Locale detection goes **after** the dev subdomain rewrite (line ~132 in current middleware) and **before** site resolution (line ~147). The stripped pathname is used for all downstream routing.

### Legacy URL redirects (in middleware)

```
/pt-BR              → 301 → /pt
/pt-BR/*            → 301 → /pt/*
/blog/en/*          → 301 → /blog/*
/blog/pt-BR/*       → 301 → /pt/blog/*
/campaigns/en/*     → 301 → /campaigns/*
/campaigns/pt-BR/*  → 301 → /pt/campaigns/*
```

These preserve SEO equity from any previously indexed URLs.

## Routing Architecture

### Strategy: middleware rewrite, zero page duplication

Page components don't duplicate. Middleware strips `/pt/` prefix and rewrites, so the same page component serves both locales. Each page reads locale from the `x-locale` header.

### File changes

**Removed:**
- `app/(public)/pt-BR/page.tsx` — hardcoded PT home (replaced by middleware rewrite)
- `app/(public)/blog/[locale]/` — entire directory (locale moves to prefix)

**Modified:**
- `app/(public)/page.tsx` — reads `x-locale` header instead of `ctx.defaultLocale`
- `app/(public)/blog/page.tsx` — no longer redirects to `/blog/{locale}`; reads `x-locale` and renders index directly
- `app/(public)/blog/[slug]/page.tsx` — new path (was `blog/[locale]/[slug]`), reads `x-locale` from header
- `app/(public)/campaigns/[slug]/page.tsx` — same pattern as blog
- `app/(public)/layout.tsx` — reads `x-locale` header, sets `<html lang>` dynamically

### How pages determine locale

```typescript
import { headers } from 'next/headers'

function getLocale(): 'en' | 'pt-BR' {
  const h = await headers()
  return (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'
}
```

### Blog post query change

```sql
-- Old: locale from URL param
SELECT * FROM blog_translations
WHERE slug = $slug AND locale = $localeParam AND post.site_id = $siteId

-- New: locale from header (same query, different source)
SELECT * FROM blog_translations
WHERE slug = $slug AND locale = $localeFromHeader AND post.site_id = $siteId
```

## Language Switcher

### Header toggle (TopStrip)

Always navigates to the **home** of the other locale:

```typescript
// New behavior:
// EN active (any page) → click PT → /pt
// PT active (any page) → click EN → /

const ptHref = '/pt'
const enHref = '/'
```

This replaces the current hardcoded `/pt-BR` ↔ `/` links. The switcher no longer needs to know the current path — it always goes to home.

### In-page linked content indicator

When a blog post has a non-null `link_group_id`, show a link to the equivalent post in the other locale:

```
On EN post: "Também disponível em Português →"
On PT post: "Also available in English →"
```

Position: in the post metadata area (below title, near author/date). Links to the specific linked post URL, not home.

### Locale-aware link utility

```typescript
const LOCALE_PREFIX: Record<string, string> = {
  'en': '',
  'pt-BR': '/pt',
}

export function localePath(path: string, locale: string): string {
  const prefix = LOCALE_PREFIX[locale] ?? ''
  return `${prefix}${path}`
}

// localePath('/blog/my-post', 'en')     → '/blog/my-post'
// localePath('/blog/meu-post', 'pt-BR') → '/pt/blog/meu-post'
```

All `<Link>` components in public pages must use `localePath()`.

## SEO

### hreflang rules

| Scenario | hreflang emitted? |
|----------|-------------------|
| Independent post (no link_group) | **No** — exists in one locale only |
| Linked post (same link_group_id) | **Yes** — alternates pointing to the linked pair |
| Static pages (/, /contact, /privacy, /terms) | **Yes** — always have equivalents in both locales |
| Blog index (/blog, /pt/blog) | **Yes** — structural equivalents |
| Newsletter archive | **No** — editions are locale-specific |

`x-default` always points to the EN version.

### Canonical URLs

Self-referencing. Each URL is its own canonical. Never cross-locale canonical.

```
/blog/my-post         → canonical: https://bythiagofigueiredo.com/blog/my-post
/pt/blog/meu-post     → canonical: https://bythiagofigueiredo.com/pt/blog/meu-post
```

### Sitemap

Unified sitemap with all URLs from both locales. `<xhtml:link>` alternates only for content that has cross-locale equivalents (linked posts, static pages, blog index).

```xml
<!-- Independent EN post: no alternates -->
<url>
  <loc>https://bythiagofigueiredo.com/blog/my-post</loc>
</url>

<!-- Independent PT post: no alternates -->
<url>
  <loc>https://bythiagofigueiredo.com/pt/blog/meu-post</loc>
</url>

<!-- Linked pair: BOTH entries need full alternates (including self-reference) -->
<url>
  <loc>https://bythiagofigueiredo.com/blog/linked-post</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://bythiagofigueiredo.com/blog/linked-post" />
  <xhtml:link rel="alternate" hreflang="pt" href="https://bythiagofigueiredo.com/pt/blog/post-linkado" />
  <xhtml:link rel="alternate" hreflang="x-default" href="https://bythiagofigueiredo.com/blog/linked-post" />
</url>
<url>
  <loc>https://bythiagofigueiredo.com/pt/blog/post-linkado</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://bythiagofigueiredo.com/blog/linked-post" />
  <xhtml:link rel="alternate" hreflang="pt" href="https://bythiagofigueiredo.com/pt/blog/post-linkado" />
  <xhtml:link rel="alternate" hreflang="x-default" href="https://bythiagofigueiredo.com/blog/linked-post" />
</url>

<!-- Static page: always has alternates -->
<url>
  <loc>https://bythiagofigueiredo.com/contact</loc>
  <xhtml:link rel="alternate" hreflang="en" href="https://bythiagofigueiredo.com/contact" />
  <xhtml:link rel="alternate" hreflang="pt" href="https://bythiagofigueiredo.com/pt/contact" />
  <xhtml:link rel="alternate" hreflang="x-default" href="https://bythiagofigueiredo.com/contact" />
</url>
```

### JSON-LD enhancements

- `BlogPosting.inLanguage`: `"en"` or `"pt-BR"` per post locale
- Linked posts: `BlogPosting.translationOfWork` / `workTranslation` referencing the `@id` of the equivalent
- `WebSite` node: `inLanguage` matches current page locale

### Open Graph

- `og:locale`: `en_US` (EN) or `pt_BR` (PT)
- `og:locale:alternate`: present only for linked content

### `<html lang>` attribute

Set dynamically in **both** root layouts:

```typescript
// app/layout.tsx (ROOT — currently hardcoded lang="pt-BR")
// Must read x-locale header and set dynamically:
const locale = getRequestLocale()
return <html lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}>

// app/(public)/layout.tsx
// Same pattern — reads x-locale header for all public pages
```

**Critical:** the current `app/layout.tsx` (line 12) has `lang="pt-BR"` hardcoded. This MUST change to dynamic — it's the outermost `<html>` tag that Google reads.

### RSS feed (`/feed.xml`)

An RSS feed already exists at `apps/web/src/app/(public)/feed.xml/route.ts`. Currently it filters posts by `ctx.defaultLocale` and sets `<language>` to that value.

Under the new system:
- `/feed.xml` → EN feed (filters by locale='en', `<language>en</language>`)
- `/pt/feed.xml` → PT feed (middleware rewrites to `/feed.xml` with `x-locale: pt-BR`)
- The feed route reads `x-locale` header instead of `ctx.defaultLocale`
- Each feed's `<link>` points to the locale-appropriate blog index

This is NOT deferred — the feed exists today and would break if ignored.

## CMS Workflow Changes

### Post creation

New required field "Language" (dropdown: English / Português) in the new post form. Default: last locale used by the author, or site default.

```typescript
// apps/web/src/app/cms/(authed)/blog/new/page.tsx
// Add locale selector before creating the post
const locale = searchParams.locale ?? ctx.defaultLocale
const post = await postRepo().create({
  site_id: ctx.siteId,
  locale,  // NEW: set on blog_posts
  initial_translation: {
    locale,
    title: locale === 'pt-BR' ? 'Sem título' : 'Untitled',
    slug: uniqueSlug,
    content_mdx: '',
  },
})
```

### Linking UI

Button "Link equivalent post" in the editor sidebar → opens modal listing posts from the **other** locale → select → both posts receive the same `link_group_id`. "Unlink" button clears it.

### Blog list in CMS

Add locale filter (tabs or dropdown: All / EN / PT). Visual indicator (link icon) for posts that are part of a link group.

### Content queue

Respects locale — each cadence queue is per-locale.

## Enumerator Changes

### Static routes

```typescript
// Old
const STATIC_ROUTE_DEFS = [
  { path: '/', ... },
  { path: '/pt-BR', ... },  // hardcoded
  { path: '/privacy', ... },
  // ...
]

// New: generate per-locale static routes
function staticRoutes(supportedLocales: string[], defaultLocale: string): SitemapRouteEntry[] {
  const paths = ['/', '/privacy', '/terms', '/contact', '/newsletters']
  const routes: SitemapRouteEntry[] = []
  for (const basePath of paths) {
    for (const locale of supportedLocales) {
      const path = locale === defaultLocale ? basePath : `/pt${basePath}`
      const alternates: Record<string, string> = {}
      for (const loc of supportedLocales) {
        alternates[loc === 'pt-BR' ? 'pt' : loc] = loc === defaultLocale ? basePath : `/pt${basePath}`
      }
      routes.push({ path, alternates, ... })
    }
  }
  return routes
}
```

### Blog/campaign routes

```typescript
// Old: path = /blog/{locale}/{slug}
// New: path = localePath(`/blog/${slug}`, locale)

for (const post of posts) {
  const path = post.locale === defaultLocale
    ? `/blog/${post.slug}`
    : `/pt/blog/${post.slug}`

  const alternates: Record<string, string> = {}
  if (post.link_group_id) {
    // Query linked posts for alternates
    const linked = await getLinkedPosts(post.link_group_id)
    for (const lp of linked) {
      const hreflangCode = lp.locale === 'pt-BR' ? 'pt' : lp.locale
      alternates[hreflangCode] = lp.locale === defaultLocale
        ? `/blog/${lp.slug}`
        : `/pt/blog/${lp.slug}`
    }
  }
  routes.push({ path, alternates, ... })
}
```

## Page Metadata Changes

### `generateBlogPostMetadata`

```typescript
// Old: iterates translations array for alternates
// New: only emits alternates for linked posts

export function generateBlogPostMetadata(
  config: SiteSeoConfig,
  post: BlogPostInput,
  linkedPosts: LinkedPostInput[] | null,  // NEW parameter
): Metadata {
  const locale = post.locale
  const slug = post.translation.slug
  const path = locale === config.defaultLocale
    ? `/blog/${slug}`
    : `/pt/blog/${slug}`

  // Build hreflang alternates — MUST include self (Google requirement)
  const allPosts = linkedPosts && linkedPosts.length > 0
    ? [{ locale, slug, isDefault: locale === config.defaultLocale }, ...linkedPosts.map(lp => ({
        locale: lp.locale, slug: lp.slug, isDefault: lp.locale === config.defaultLocale,
      }))]
    : null

  const languages: Record<string, string> | undefined = allPosts
    ? Object.fromEntries([
        ...allPosts.map(p => {
          const hreflang = p.locale === 'pt-BR' ? 'pt' : p.locale
          const pPath = p.isDefault ? `/blog/${p.slug}` : `/pt/blog/${p.slug}`
          return [hreflang, `${config.siteUrl}${pPath}`]
        }),
        ['x-default', `${config.siteUrl}${
          allPosts.find(p => p.isDefault)
            ? `/blog/${allPosts.find(p => p.isDefault)!.slug}`
            : path
        }`],
      ])
    : undefined

  return {
    ...baseMetadata(config),
    alternates: {
      canonical: `${config.siteUrl}${path}`,
      languages,
    },
    openGraph: {
      locale: locale === 'pt-BR' ? 'pt_BR' : 'en_US',
      ...(linkedPosts?.length ? {
        alternateLocale: linkedPosts.map(lp =>
          lp.locale === 'pt-BR' ? 'pt_BR' : 'en_US'
        ),
      } : {}),
    },
  }
}
```

### `generateBlogIndexMetadata`

```typescript
// Old: builds alternates from supportedLocales with /blog/{locale} paths
// New: uses locale prefix pattern

export function generateBlogIndexMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) {
    const hreflang = loc === 'pt-BR' ? 'pt' : loc
    languages[hreflang] = loc === config.defaultLocale
      ? `${config.siteUrl}/blog`
      : `${config.siteUrl}/pt/blog`
  }
  languages['x-default'] = `${config.siteUrl}/blog`

  const canonical = locale === config.defaultLocale
    ? `${config.siteUrl}/blog`
    : `${config.siteUrl}/pt/blog`

  return {
    ...baseMetadata(config),
    alternates: { canonical, languages },
  }
}
```

## Migration Safety

### Zero-downtime deployment sequence

1. **DB migration** (additive) — `ADD COLUMN locale`, `ADD COLUMN link_group_id`, backfill, create indexes. No breaking changes.
2. **Deploy middleware** with legacy redirect map. Old URLs start 301-redirecting to new format. Pages still work via old routing during transition.
3. **Deploy routing changes** — remove `[locale]` segment, add prefix support, update all `<Link>` components.
4. **Deploy SEO changes** — updated sitemap, hreflang, metadata factories.
5. **Post-deploy verification:**
   - Google Search Console: submit updated sitemap
   - URL Inspection on top 10 pages
   - Monitor 404s via Sentry for 7 days
   - Verify hreflang via `scripts/seo-smoke.sh`

### Feature flag

`NEXT_PUBLIC_I18N_PREFIX_ROUTING` — when `false`, reverts to old routing behavior. Allows instant rollback without redeploy.

### Redirect monitoring

Track 301 redirect hits in Sentry (tag `redirect:legacy-locale`) for 30 days. Once hits drop to near-zero, the redirect map can be simplified but should remain indefinitely for SEO safety.

## DB Schema Changes Summary

### New columns

| Table | Column | Type | Default | Purpose |
|-------|--------|------|---------|---------|
| `blog_posts` | `locale` | `text NOT NULL` | `'en'` | Post's native language |
| `blog_posts` | `link_group_id` | `uuid NULL` | `NULL` | Cross-locale equivalence group |
| `campaigns` | `locale` | `text NOT NULL` | `'en'` | Campaign's native language |
| `campaigns` | `link_group_id` | `uuid NULL` | `NULL` | Cross-locale equivalence group |

### New indexes

| Index | Table | Columns | Condition |
|-------|-------|---------|-----------|
| `blog_posts_link_group_locale` | `blog_posts` | `(link_group_id, locale)` | `WHERE link_group_id IS NOT NULL` |
| `campaigns_link_group_locale` | `campaigns` | `(link_group_id, locale)` | `WHERE link_group_id IS NOT NULL` |

### Updated site config

```sql
UPDATE sites SET default_locale = 'en'
WHERE slug = 'bythiagofigueiredo';
```

This flips the site default from `pt-BR` to `en`, matching the new unprefixed-EN strategy.

## Fallback & Hardcode Cleanup

### `pt-BR` fallback chain (must change to `en`)

These files have hardcoded `pt-BR` as the fallback locale. All must change to `en` to match the new default:

| File | Line | Current | Change to |
|------|------|---------|-----------|
| `apps/web/lib/cms/site-context.ts` | 30 | `h.get('x-default-locale') ?? 'pt-BR'` | `?? 'en'` |
| `apps/web/lib/seo/config.ts` | 52 | `?? ['pt-BR']` | `?? ['en']` |
| `apps/web/lib/email/resend.ts` | 41 | fallback `'pt-BR'` | `'en'` |
| `apps/web/src/app/(public)/contact/actions.ts` | 33 | hardcoded `'pt-BR'` | read from `x-locale` header |
| `apps/web/src/app/layout.tsx` | 12 | `lang="pt-BR"` | dynamic from `x-locale` header |

### Contact page (currently hardcoded `pt-BR`)

`apps/web/src/app/(public)/contact/page.tsx` (lines 18-23) has a comment: "Locale is hardcoded pt-BR here because the page's ContactForm is also hardcoded pt-BR". Must be refactored to read locale from `x-locale` header and pass to `ContactForm`.

### Email template locale

`apps/web/lib/email/resend.ts` falls back to `pt-BR` for email template rendering. After this change, emails sent from EN context should render in English. The fallback must change to `en`, and the locale should be explicitly passed from the calling context.

### Newsletter archive locale filtering

`apps/web/src/app/(public)/newsletter/archive/page.tsx` currently queries ALL sent editions regardless of locale. Under the new system:
- `/newsletter/archive` → filter by EN newsletter types
- `/pt/newsletter/archive` → filter by PT newsletter types

The archive list query must JOIN `newsletter_types` and filter by `newsletter_types.locale` matching the request locale from `x-locale` header.

### 404 page (does not exist)

No custom 404 page currently exists (`not-found.tsx`). Create `apps/web/src/app/not-found.tsx` that reads `x-locale` header and renders locale-appropriate error text.

## Files Changed (Impact Map)

### Middleware
- `apps/web/src/middleware.ts` — locale prefix detection, stripping, header injection, legacy redirects

### Routing (pages)
- `apps/web/src/app/layout.tsx` — **dynamic `<html lang>`** (currently hardcoded `pt-BR`)
- `apps/web/src/app/(public)/layout.tsx` — read `x-locale`, pass locale to children
- `apps/web/src/app/(public)/page.tsx` — read `x-locale` instead of `ctx.defaultLocale`
- `apps/web/src/app/(public)/pt-BR/` — **DELETE** entire directory (page.tsx + newsletters/)
- `apps/web/src/app/(public)/blog/page.tsx` — remove redirect, render index directly using `x-locale`
- `apps/web/src/app/(public)/blog/[locale]/` — **DELETE** entire directory
- `apps/web/src/app/(public)/blog/[slug]/page.tsx` — **NEW** (moved from `[locale]/[slug]`)
- `apps/web/src/app/(public)/campaigns/[locale]/` — **DELETE** entire directory
- `apps/web/src/app/(public)/campaigns/[slug]/page.tsx` — **NEW** (moved from `[locale]/[slug]`)
- `apps/web/src/app/(public)/contact/page.tsx` — read `x-locale` (remove hardcoded `pt-BR`)
- `apps/web/src/app/(public)/contact/actions.ts` — read locale from header, not hardcoded
- `apps/web/src/app/(public)/feed.xml/route.ts` — read `x-locale`, filter posts by locale
- `apps/web/src/app/(public)/newsletter/archive/page.tsx` — filter by newsletter_type locale
- `apps/web/src/app/(public)/newsletter/archive/[id]/page.tsx` — locale-aware UI
- `apps/web/src/app/not-found.tsx` — **NEW** locale-aware 404 page

### Components (locale-aware URL generation)
- `apps/web/src/components/layout/top-strip.tsx` — update links to `/pt` ↔ `/`
- `apps/web/src/components/layout/global-header.tsx` — update `homeHref` logic
- `apps/web/src/components/layout/header-types.ts` — update `buildNavItems` to use `localePath()`
- `apps/web/src/app/(public)/components/DualHero.tsx` — replace `blogBase` ternary with `localePath()`
- `apps/web/src/app/(public)/components/UnifiedFeed.tsx` — replace `blogBase` ternary with `localePath()`
- `apps/web/src/app/(public)/components/PinboardFooter.tsx` — replace `blogHref` ternary with `localePath()`
- `apps/web/src/app/(public)/newsletters/components/NewslettersHub.tsx` — replace 3 locale-conditional links with `localePath()`
- `apps/web/src/components/locale-switcher.tsx` — update `hrefFor` callback pattern for new URL structure
- `apps/web/src/app/(public)/blog/[locale]/category-filter.tsx` — move to `blog/` dir, uses `usePathname()` (already locale-aware via middleware rewrite)

### Infrastructure
- `apps/web/lib/cms/site-context.ts` — change fallback from `pt-BR` to `en`
- `apps/web/lib/email/resend.ts` — change fallback from `pt-BR` to `en`
- `apps/web/lib/i18n/locale-path.ts` — **NEW** utility: `localePath()` + `LOCALE_PREFIX_MAP`

### SEO
- `apps/web/lib/seo/page-metadata.ts` — new path patterns, linked-post-aware hreflang with self-inclusion
- `apps/web/lib/seo/enumerator.ts` — new path patterns, link_group_id-aware alternates, static routes refactored
- `apps/web/lib/seo/config.ts` — change defaultLocale fallback from `pt-BR` to `en`
- `apps/web/src/app/sitemap.ts` — path pattern updates
- `apps/web/lib/seo/jsonld/builders.ts` — `inLanguage`, `translationOfWork`/`workTranslation`

### CMS
- `apps/web/src/app/cms/(authed)/blog/new/page.tsx` — locale selector
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx` — linking UI
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` — `savePost` sets `blog_posts.locale`
- `apps/web/src/app/cms/(authed)/blog/_components/posts-filters.tsx` — update `LOCALE_OPTIONS`
- Blog list page — locale filter

### Database
- New migration: `locale` + `link_group_id` columns + indexes + backfill
- Site config update: `default_locale = 'en'`

### Tests (18 files affected)

**Unit tests (15 files):**
- `test/app/sitemap.test.ts` — `/blog/pt-BR/x` → `/pt/blog/x`
- `test/app/blog-detail.test.tsx` — canonical + alternates path patterns
- `test/app/cms-blog-actions.test.ts` — `revalidatePath` assertions
- `test/components/locale-switcher.test.tsx` — `hrefFor` callback patterns
- `test/components/layout/global-header.test.tsx` — `/pt-BR` → `/pt`
- `test/components/layout/top-strip.test.tsx` — `/pt-BR` → `/pt`
- `test/app/og/blog-route.test.ts` — OG route URLs (internal, keep `[locale]`)
- `test/app/og/campaign-route.test.ts` — OG route URLs (internal, keep `[locale]`)
- `test/lib/seo/cache-invalidation.test.ts` — `revalidatePath` patterns
- `test/lib/seo/noindex.test.ts` — path patterns
- `test/lib/seo/enumerator.test.ts` — sitemap path assertions
- `test/lib/seo/page-metadata.test.ts` — hreflang alternate URLs
- `test/api/health/seo.test.ts` — fake route paths
- `test/lib/seo/jsonld/builders.test.ts` — breadcrumb URLs
- `test/lib/seo/jsonld/builders-types.test.ts` — breadcrumb URLs

**E2E tests (3 files):**
- `e2e/tests/public/homepage.spec.ts` — `/blog/pt-BR` → `/pt/blog`
- `e2e/tests/cms/campaigns.spec.ts` — `/campaigns/pt-BR/...` → `/pt/campaigns/...`
- `e2e/tests/cms/blog.spec.ts` — `/blog/pt-BR/...` → `/pt/blog/...`

**New tests to add:**
- Middleware locale detection + prefix stripping
- Legacy URL 301 redirects
- `localePath()` utility
- `link_group_id` linking/unlinking
- 404 page locale awareness

## Iteration Log

| Pass | Score | Key Improvements |
|------|-------|------------------|
| 1 | 82 | Basic URL structure + middleware rewrite concept |
| 2 | 89 | Legacy URL redirects, admin/API exclusion, CMS locale selector, 404 i18n |
| 3 | 93 | No auto-redirect (Google best practice), no cookie-based locale |
| 4 | 96 | `<html lang>` dynamic, `og:locale`, uppercase normalization, `link_group_id` unique index, `translationOfWork` JSON-LD |
| 5 | 88 | Audit revealed: root `<html lang>` hardcoded, RSS feed exists (not deferred), hreflang self-reference bug, 6 components with hardcoded URLs missing from impact map, 18 test files not enumerated, no 404 page, fallback chain still `pt-BR` |
| 6 | 98 | Fixed all audit gaps: root layout dynamic lang, RSS feed locale-aware, hreflang includes self, complete component impact map (DualHero/UnifiedFeed/PinboardFooter/NewslettersHub/LocaleSwitcher/CategoryFilter), 18 test files enumerated, 404 page spec'd, fallback cleanup table, contact page + email template fallback addressed, newsletter archive locale filtering, `localePath()` utility extracted |

## Open Decisions

1. **Future locales** — adding `/es/`, `/fr/` etc. requires only: DB entry in `supported_locales`, new locale strings JSON, entry in `LOCALE_PREFIX_MAP`. Architecture scales without structural changes.
2. **Search cross-locale** — if search is added, results scoped to current locale with "Also in [language]" section for linked posts. Deferred.
3. **Newsletter subscriber locale routing** — `newsletter_subscriptions.locale` is captured but not used for filtering sends. Future sprint should route subscribers to locale-matched newsletter types.
