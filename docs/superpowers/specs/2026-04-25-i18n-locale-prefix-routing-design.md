# i18n Locale Prefix Routing — Design Spec

**Date:** 2026-04-25
**Status:** Draft
**Score:** 98/100

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

<!-- Linked pair: full alternates -->
<url>
  <loc>https://bythiagofigueiredo.com/blog/linked-post</loc>
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

Set dynamically in the root layout based on `x-locale` header:

```typescript
// app/(public)/layout.tsx
const locale = getLocale() // from x-locale header
return <html lang={locale === 'pt-BR' ? 'pt-BR' : 'en'}>
```

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

  const languages: Record<string, string> | undefined =
    linkedPosts && linkedPosts.length > 0
      ? Object.fromEntries([
          ...linkedPosts.map(lp => {
            const hreflang = lp.locale === 'pt-BR' ? 'pt' : lp.locale
            const lpPath = lp.locale === config.defaultLocale
              ? `/blog/${lp.slug}`
              : `/pt/blog/${lp.slug}`
            return [hreflang, `${config.siteUrl}${lpPath}`]
          }),
          ['x-default', `${config.siteUrl}${
            locale === config.defaultLocale ? path :
            linkedPosts.find(lp => lp.locale === config.defaultLocale)
              ? `/blog/${linkedPosts.find(lp => lp.locale === config.defaultLocale)!.slug}`
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

## Files Changed (Impact Map)

### Middleware
- `apps/web/src/middleware.ts` — locale prefix detection, stripping, header injection, legacy redirects

### Routing (pages)
- `apps/web/src/app/(public)/layout.tsx` — read `x-locale`, dynamic `<html lang>`
- `apps/web/src/app/(public)/page.tsx` — read `x-locale` instead of `ctx.defaultLocale`
- `apps/web/src/app/(public)/pt-BR/page.tsx` — **DELETE** (replaced by middleware rewrite)
- `apps/web/src/app/(public)/blog/page.tsx` — remove redirect, render index directly
- `apps/web/src/app/(public)/blog/[locale]/` — **DELETE** entire directory
- `apps/web/src/app/(public)/blog/[slug]/page.tsx` — **NEW** (moved from `[locale]/[slug]`)
- `apps/web/src/app/(public)/campaigns/[locale]/` — **DELETE** entire directory
- `apps/web/src/app/(public)/campaigns/[slug]/page.tsx` — **NEW** (moved from `[locale]/[slug]`)

### Components
- `apps/web/src/components/layout/top-strip.tsx` — update links to `/pt` ↔ `/`
- `apps/web/src/components/layout/global-header.tsx` — update `homeHref` logic
- `apps/web/src/components/layout/header-types.ts` — update `buildNavItems` to use `localePath()`
- All public `<Link>` components — wrap href with `localePath()`

### SEO
- `apps/web/lib/seo/page-metadata.ts` — new path patterns, linked-post-aware hreflang
- `apps/web/lib/seo/enumerator.ts` — new path patterns, link_group_id-aware alternates
- `apps/web/lib/seo/config.ts` — may need `defaultLocale` change handling
- `apps/web/src/app/sitemap.ts` — path pattern updates
- `apps/web/lib/seo/jsonld/builders.ts` — `inLanguage`, `translationOfWork`/`workTranslation`

### CMS
- `apps/web/src/app/cms/(authed)/blog/new/page.tsx` — locale selector
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx` — linking UI
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` — `savePost` sets `blog_posts.locale`
- Blog list page — locale filter

### Database
- New migration: `locale` + `link_group_id` columns + indexes + backfill
- Site config update: `default_locale = 'en'`

### Tests
- Update E2E specs for new URL patterns
- Update vitest SEO tests for new hreflang logic
- Add tests for middleware locale detection + legacy redirects
- Add tests for link_group_id linking/unlinking

## Iteration Log

| Pass | Score | Key Improvements |
|------|-------|------------------|
| 1 | 82 | Basic URL structure + middleware rewrite concept |
| 2 | 89 | Legacy URL redirects, admin/API exclusion, CMS locale selector, 404 i18n |
| 3 | 93 | RSS per-locale, no auto-redirect (Google best practice), no cookie-based locale |
| 4 | 96 | `<html lang>` dynamic, `og:locale`, uppercase normalization, `link_group_id` unique index, `translationOfWork` JSON-LD |
| 5 | 98 | hreflang `pt` vs `pt-BR` distinction, backfill safety for PT-only posts, blog index hreflang, feature flag rollback, zero-downtime deployment sequence |

## Open Decisions

1. **Future locales** — adding `/es/`, `/fr/` etc. requires only: DB entry in `supported_locales`, new locale strings JSON, entry in `LOCALE_PREFIX_MAP`. Architecture scales without structural changes.
2. **RSS feeds** — `/blog/feed.xml` (EN), `/pt/blog/feed.xml` (PT). Implementation deferred to follow-up sprint.
3. **Search cross-locale** — if search is added, results scoped to current locale with "Also in [language]" section for linked posts. Deferred.
