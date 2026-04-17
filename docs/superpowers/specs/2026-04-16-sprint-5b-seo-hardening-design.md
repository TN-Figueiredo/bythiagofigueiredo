# Sprint 5b — SEO Hardening Design

**Date:** 2026-04-16
**Status:** Approved (5 rounds of recursive self-audit, score 98/100). Verified against 5 parallel investigation agents (middleware behavior, sites schema, server-action inventory, `compileMdx` frontmatter exposure, `@tn-figueiredo/seo` API gaps).
**Target sub-sprint:** 5b — part of Sprint 5 "Public Launch Prep" decomposition (5a ✅ LGPD / 5b SEO / 5c E2E / 5d Vercel hardening).
**Pre-conditions:** Sprint 5a deployed (LGPD compliance, 26 migrations, feature-flagged). Vercel Hobby tier sufficient (no Vercel Pro requirement).
**Estimated effort:** ~14h across 5 PRs.

---

## Motivation

Sprint 5a closed user-facing LGPD compliance. Sprint 5b is the last gap before a public-launch-ready hub: search engines must (a) discover all public content via a valid sitemap, (b) index canonical URLs without duplicates, (c) render rich results (BlogPosting cards, breadcrumbs, sitelinks search box), (d) show branded share previews when posts are shared on social platforms.

Today's state:
- `apps/web/src/app/layout.tsx` has hardcoded title/OG tags, single locale, no `metadataBase` per site.
- `/blog/[locale]/[slug]` and `/blog/[locale]` already emit hreflang correctly (artisan implementation).
- `/campaigns/[locale]/[slug]` has `og:image` from DB but zero hreflang/canonical/JSON-LD.
- `/contact`, `/`: no `generateMetadata` at all.
- No `sitemap.ts`, no `robots.ts`, no JSON-LD anywhere, no dynamic OG images.
- `@tn-figueiredo/seo@0.1.0` is installed but unused.

Sprint 5b ships the wrapper layer over `@tn-figueiredo/seo`, adds dynamic OG image generation via `next/og`, emits maximalist JSON-LD (Person+Organization+WebSite+BlogPosting+Article+BreadcrumbList+FAQPage+HowTo+VideoObject) per page, configures Lighthouse CI as a quality gate, and prepares the multi-domain pattern for Sprint 11 CMS Hub Distribution.

## Goals

- **Indexability**: every public page emits canonical URL, robots policy, OpenGraph + Twitter card metadata.
- **Discoverability**: `sitemap.xml` enumerates all published blog posts + active campaigns + static pages, RLS-mirroring filters prevent draft leaks.
- **Rich results**: schema.org `@graph` per page combining `WebSite + Person/Organization + BlogPosting/Article + BreadcrumbList`, with optional `FAQPage/HowTo/VideoObject` from MDX frontmatter.
- **Brand share previews**: dynamic OG images (1200×630) per blog post + campaign via `next/og`, branded with `sites.primary_color` + author name.
- **Multi-domain ready**: `sitemap.ts`/`robots.ts`/SEO config all read host-derived site context per request — `bythiagofigueiredo.com` works today, future sites plug in zero-refactor.
- **Quality gate**: Lighthouse CI on every PR (SEO ≥95, mobile perf ≥80), schema-dts compile-time validation of all JSON-LD builders, smoke script as post-deploy gate.
- **Operability**: rollback flags per surface (JSON-LD, dynamic OG, extended schemas), health endpoint, runbook.

## Non-goals

- ❌ i18n routing for legal pages (`/privacy/en` etc.) — current cookie+Accept-Language pattern preserved.
- ❌ RSS / Atom feeds — separate sprint if demanded.
- ❌ Google Analytics / Plausible wiring — depends on consent gating, product decision.
- ❌ Search Console submission automation — manual at PR-E.
- ❌ AMP / instant articles — Google deprecated.
- ❌ Sitemap pagination — single sitemap until >10k URLs (we are far below).
- ❌ Admin UI editor for `seo_extras` — frontmatter-only this sprint, UI deferred to Sprint 6+.
- ❌ Multi-language `<html lang>` switching — root stays `pt-BR`.
- ❌ Internationalized routing (`/en/blog/...`) — current `/blog/{locale}/{slug}` preserved.
- ❌ A/B testing OG variants — premature.
- ❌ Open Graph video meta (`og:video`) — no embedded video content yet.

## Architecture

### Layer overview

New module `apps/web/lib/seo/`:

```
lib/seo/
├── config.ts                  # getSiteSeoConfig() — per-request, cached by (siteId, host)
├── identity-profiles.ts       # PROFILES: Record<siteSlug, PersonProfile | OrgProfile>
├── page-metadata.ts           # generateXxxMetadata() — 7 factories, one per archetype
├── jsonld/
│   ├── builders.ts            # buildPersonNode, buildOrgNode, buildWebSiteNode, buildBlogPostingNode, buildArticleNode, buildBreadcrumbNode, buildFaqNode, buildHowToNode, buildVideoNode (typed via schema-dts)
│   ├── graph.ts               # composeGraph({nodes}) → {'@context','@graph':[...]} + dedupeBy_id
│   ├── extras-schema.ts       # SeoExtrasSchema (Zod) for FAQ/HowTo/Video frontmatter
│   ├── render.tsx             # <JsonLdScript graph={...}/> SSR-safe with escapeJsonForScript
│   └── types.ts               # schema-dts re-exports + brand types
├── og/
│   ├── template.tsx           # BlogOgTemplate + CampaignOgTemplate + GenericOgTemplate
│   └── render.ts              # generateOgImage({variant, params}) → ImageResponse
├── noindex.ts                 # NOINDEX_PATTERNS + isPathIndexable + PROTECTED_DISALLOW_PATHS
├── enumerator.ts              # enumerateSiteRoutes(siteId, config) — RLS-aware
├── cache-invalidation.ts      # revalidateBlogPostSeo, revalidateCampaignSeo, revalidateSiteBranding
├── robots-config.ts           # buildRobotsRules({config, host, aiCrawlersBlocked})
├── frontmatter.ts             # parseFrontmatterAndStrip(source) wrapping gray-matter
└── __tests__/                 # vitest puro + DB-gated integration
```

### Multi-domain SEO config

`getSiteSeoConfig(siteId, host)` returns a `SiteSeoConfig` object with all per-site values needed for metadata/JSON-LD/OG generation:

```typescript
export interface SiteSeoConfig {
  siteId: string
  siteName: string                // sites.name
  siteUrl: string                 // 'https://${primary_domain}' (HTTPS forced; primary_domain validated bare-host)
  defaultLocale: string           // sites.default_locale
  supportedLocales: string[]      // sites.supported_locales (existing column, NOT new)
  identityType: 'person' | 'organization'   // sites.identity_type (NEW)
  primaryColor: string            // sites.primary_color ?? '#0F172A'
  logoUrl: string | null          // sites.logo_url
  twitterHandle: string | null    // sites.twitter_handle (NEW), validated regex ^[A-Za-z0-9_]{1,15}$
  defaultOgImageUrl: string | null // sites.seo_default_og_image (NEW)
  contentPaths: { blog: string; campaigns: string }  // hardcoded {'/blog','/campaigns'} until Sprint 11
  personIdentity: PersonProfile | null   // from identity-profiles.ts
  orgIdentity: OrgProfile | null         // null when identityType='person'
}

export interface PersonProfile {
  type: 'person'
  name: string
  jobTitle: string
  imageUrl: string                // absolute, ≥400×400, JPEG <100KB
  sameAs: string[]                // [instagram, youtube_en, youtube_pt, github, linkedin, ...]
}

export interface OrgProfile {
  type: 'organization'
  name: string
  legalName: string
  logoUrl: string                 // absolute square logo
  founderName: string             // links to Person via @id when both present
  sameAs: string[]
}
```

Cached via `unstable_cache`:

```typescript
export const getSiteSeoConfig = unstable_cache(
  async (siteId: string, host: string): Promise<SiteSeoConfig> => {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('sites')
      .select('id, name, slug, primary_domain, default_locale, supported_locales, identity_type, primary_color, logo_url, twitter_handle, seo_default_og_image')
      .eq('id', siteId)
      .single()
    if (error || !data) throw new Error(`getSiteSeoConfig: site ${siteId} not found`)
    return assembleConfig(data, host)
  },
  ['seo-config-v1'],
  { revalidate: 3600, tags: ['seo-config'] }
)
```

Cache key array `[siteId, host]` is the function arguments; Next.js `unstable_cache` keys by serialized args + the second-arg key array. Tag invalidation via `revalidateTag('seo-config')` is broad (affects all sites) — acceptable given branding updates are rare. Future granular: split into per-site tags via wrapper.

**Source-of-truth split:**
- DB (`sites` table) holds: site identity, locales, branding colors, social handles.
- Code (`identity-profiles.ts`) holds: structured Person/Organization profile (jobTitle, sameAs links, image URL). Edits trigger code review intentionally — identity is security-grade. Sprint 11 may move to DB if non-dev editing becomes a need.

### Multi-domain `sitemap.ts` / `robots.ts` — direct host lookup, NOT middleware-dependent

**Verified risk:** Next.js [discussion #58436](https://github.com/vercel/next.js/discussions/58436) confirms middleware-injected request headers are **not reliably visible** to MetadataRoute handlers (`sitemap.ts`, `robots.ts`). Even though the middleware matcher matches `.xml`/`.txt` routes (verified by regex), `headers().get('x-site-id')` may return null inside `app/sitemap.ts`.

**Mitigation:** sitemap and robots handlers do their own host → site lookup via `SupabaseRingContext.getSiteByDomain(host)`. Duplicates ~5 lines of middleware logic but is bulletproof against framework quirks.

```typescript
// app/sitemap.ts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get('host')?.split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) return []
  const site = await resolveSiteByHost(host)  // wraps SupabaseRingContext.getSiteByDomain + Sentry on miss
  if (!site) return []
  const config = await getSiteSeoConfig(site.id, host)
  const routes = await enumerateSiteRoutes(site.id, config)  // RLS-mirroring filters
  return routes.map(toSitemapEntryWithHreflang(config))
}
```

```typescript
// app/robots.ts
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host')?.split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  const site = await resolveSiteByHost(host)
  const config = site ? await getSiteSeoConfig(site.id, host) : null
  return {
    rules: buildRobotsRules({
      config,
      host,
      aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
      protectedPaths: PROTECTED_DISALLOW_PATHS,
    }),
    sitemap: config ? `${config.siteUrl}/sitemap.xml` : `https://${host}/sitemap.xml`,
  }
}
```

`isPreviewOrDevHost(host)`:
- `host === 'dev.bythiagofigueiredo.com'`
- `host.endsWith('.vercel.app')`
- `host === 'localhost'` or starts with `localhost:`
- `host === 'dev.localhost'`

These conditions short-circuit to noindex everything (preview deploys + dev environments must not be crawled).

**Middleware change required:** `apps/web/src/middleware.ts:122` rewrites `dev.bythiagofigueiredo.com/anything` → `/dev/anything`. Add short-circuit to skip the rewrite when `pathname === '/sitemap.xml' || pathname === '/robots.txt'`, so the dynamic routes can run their own logic (which will detect dev host and return Disallow:/).

### JSON-LD: `@graph` composition with schema-dts

Each page renders **one** `<script type="application/ld+json">` containing `{'@context':'https://schema.org', '@graph': [...nodes]}`. Nodes link via `@id` (URLs as identifiers) — e.g., `BlogPosting.author = {'@id': 'https://site.com/#person'}`.

**Per-page composition map:**

| Route archetype | Nodes |
|---|---|
| `app/(public)/layout.tsx` (root) | `WebSite` (with `potentialAction: SearchAction`) + (`Person` or `Organization` per `identityType`) |
| `/blog/[locale]/[slug]` | `BlogPosting` + `BreadcrumbList` + extras from `seo_extras` (`FAQPage` / `HowTo` / `VideoObject`) |
| `/blog/[locale]` | `BreadcrumbList` only |
| `/campaigns/[locale]/[slug]` | `Article` + `BreadcrumbList` |
| `/privacy`, `/terms` | `BreadcrumbList` only (legal pages don't merit Article rich results) |
| `/contact` | `BreadcrumbList` + `ContactPage` (subtype of WebPage) |
| `/` | covered by root layout |

Layout root nodes appear on every page; per-page nodes added on top; `composeGraph` deduplicates by `@id` (priority: node with more keys wins, deterministic by key count).

**SSR-safe rendering:**

```typescript
// lib/seo/jsonld/render.tsx
function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function JsonLdScript({ graph }: { graph: JsonLdGraph }) {
  if (process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED === 'false') return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonForScript(JSON.stringify(graph)) }}
    />
  )
}
```

Rendered inside `<body>` of each Server Component (Next App Router doesn't allow custom `<script>` in `<head>` via Metadata API). Googlebot reads from body without issue.

**Type safety:** all builders typed via `schema-dts@1.1.5` (Google-maintained). `expectTypeOf().toMatchTypeOf<BlogPosting>()` in vitest catches schema regressions at compile time.

### Wrapper layer over `@tn-figueiredo/seo` (gap-driven)

Verified gaps in `@tn-figueiredo/seo@0.1.0`:

1. **`generateMetadata` does not support `alternates.languages`** — only emits `alternates.canonical`. Our wrapper merges hreflang per-route after the call.
2. **`buildSitemap` does blanket hreflang** — applies `options.locales` to every route, breaking locale-prefixed paths (would emit `/en/blog/pt-BR/post-x`). Our wrapper bypasses `options.locales` and constructs `alternates.languages` per-route from translation availability.
3. **`buildRobots` does not accept host** — must pass `sitemapUrl` per-call. Our `buildRobotsRules` wraps with host-derived sitemap URL + AI crawler stance.
4. **No `keywords/authors/publishedTime/modifiedTime`** in `PageMetadataInput` — our `generateBlogPostMetadata` factory adds these directly to the returned `Metadata` object.
5. **`SitemapOptions.defaultLocale`** declared but unused in package impl — we ignore.
6. **`JsonLdData[key: string]: unknown`** allows pass-through but no validation — `schema-dts` provides our type guard.

**Strategy:** package handles Metadata/Sitemap/Robots primitives + canonical URL construction; our `lib/seo/page-metadata.ts` factories add hreflang / keywords / OG image precedence / JSON-LD scripts. Single-direction wrap (we never call `buildSitemap` for content paths — we build manually).

### OG image precedence chain

When rendering blog/campaign metadata, OG image URL resolved in this order:

1. `seo_extras.og_image_url` (per-translation explicit override, set via frontmatter — Sprint 5b adds field to schema)
2. `cover_image_url` from `blog_translations` (existing column, currently unused in metadata — Sprint 5b surfaces it)
3. Dynamic OG via `/og/blog/{locale}/{slug}` (when `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=true`)
4. `sites.seo_default_og_image` (site-wide static fallback)
5. `/og-default.png` (repo-static last-resort fallback, committed to `apps/web/public/`)

Same chain for campaigns:
1. `campaign_translations.og_image_url` (existing)
2. (no cover image on campaigns)
3. Dynamic OG via `/og/campaigns/{locale}/{slug}`
4. `sites.seo_default_og_image`
5. `/og-default.png`

### OG image route handler

```typescript
// app/og/blog/[locale]/[slug]/route.tsx
export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(req: NextRequest, { params }: { params: Promise<{locale: string; slug: string}> }) {
  const { locale, slug } = await params
  try {
    const host = req.headers.get('host')?.split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const post = await postRepo().getBySlug({ siteId: site.id, locale, slug })
    if (!post) return notFoundOgFallback()
    return await renderBlogOgImage({
      title: post.translation.title,
      author: config.personIdentity?.name ?? config.siteName,
      locale,
      brandColor: config.primaryColor,
      logoUrl: config.logoUrl,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'og-route', type: 'blog' } })
    return new Response(null, { status: 302, headers: { Location: '/og-default.png' } })
  }
}
```

Route variants:
- `app/og/blog/[locale]/[slug]/route.tsx`
- `app/og/campaigns/[locale]/[slug]/route.tsx`
- `app/og/[type]/route.tsx` — site-wide variants (root, legal, contact) parameterized via `?title=`

Headers per response: `Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800`. Server actions invalidate via `revalidateTag('og:blog:${id}')` / `revalidateTag('og:campaign:${id}')`. Bundle size limit: 500KB total per ImageResponse (JSX + fonts + images) — verified in template; uses subset Inter font (~35KB).

**Fallback PNG:** `apps/web/public/og-default.png` (1200×630) committed in PR-B. Generated via Figma export of the BlogOgTemplate with placeholder content.

### Cache invalidation strategy

Tag taxonomy:

| Tag | Invalidates | Set by |
|---|---|---|
| `seo-config` | `getSiteSeoConfig` (all sites) | `updateSiteBranding`, `updateSiteIdentity` admin actions |
| `blog:post:${postId}` | per-post fetches in metadata + OG route | blog save/publish/unpublish/archive/delete |
| `og:blog:${postId}` | OG image route cache | same blog actions |
| `campaign:${campaignId}` | per-campaign fetches | campaign save/publish/etc |
| `og:campaign:${campaignId}` | OG image route cache | same campaign actions |
| `sitemap:${siteId}` | sitemap enumerator query | any post/campaign mutation |

Helper:

```typescript
// lib/seo/cache-invalidation.ts
export function revalidateBlogPostSeo(siteId: string, postId: string, locale: string, slug: string) {
  revalidateTag(`blog:post:${postId}`)
  revalidateTag(`og:blog:${postId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(`/blog/${locale}/${slug}`)
  revalidatePath(`/blog/${locale}`)
}
```

### RLS-aware sitemap enumerator

`enumerateSiteRoutes(siteId, config)` queries `blog_translations` + `campaign_translations` via service-role client but applies **explicit WHERE filters mirroring the RLS public-read policies**:

```typescript
const { data: posts } = await supabase
  .from('blog_translations')
  .select('slug, locale, updated_at, blog_posts!inner(id, status, published_at, site_id)')
  .eq('blog_posts.site_id', siteId)
  .eq('blog_posts.status', 'published')
  .lte('blog_posts.published_at', new Date().toISOString())
  .not('blog_posts.published_at', 'is', null)
```

Mirrors `blog_posts_public_read_published` policy exactly. DB-gated integration test creates draft + future-scheduled post + verifies neither leaks into the enumerator output.

Static routes always included: `/`, `/privacy`, `/terms`, `/contact`, `/blog/${defaultLocale}`.

Output sorted by `lastModified DESC` (deterministic for diffability).

## Schema changes

### Migration `20260501000001_sites_seo_columns.sql`

```sql
-- 1. identity_type — JSON-LD root entity choice
alter table public.sites
  add column if not exists identity_type text not null default 'person'
    check (identity_type in ('person','organization'));
comment on column public.sites.identity_type is
  'Sprint 5b — JSON-LD root entity. person=hub site (bythiagofigueiredo), organization=brand site (future ring)';

-- 2. twitter_handle — Twitter Card meta
alter table public.sites
  add column if not exists twitter_handle text
    check (twitter_handle is null or twitter_handle ~ '^[A-Za-z0-9_]{1,15}$');
comment on column public.sites.twitter_handle is
  'Sprint 5b — Twitter/X handle without @, used in twitter:site card meta';

-- 3. seo_default_og_image — site-wide OG fallback
alter table public.sites
  add column if not exists seo_default_og_image text
    check (seo_default_og_image is null or seo_default_og_image ~ '^https://');
comment on column public.sites.seo_default_og_image is
  'Sprint 5b — Absolute HTTPS URL fallback OG image when dynamic OG disabled or render fails';
```

**Existing column to reuse, not duplicate:** `sites.supported_locales text[] NOT NULL DEFAULT '{pt-BR}'` already exists (added in `20260415000020_organizations_sites.sql`). Sprint 5b uses this column for hreflang per-site — backfill via `update sites set supported_locales = '{pt-BR,en}' where slug='bythiagofigueiredo'` if not already set. Verify against prod live before backfill.

### Migration `20260501000002_blog_translations_seo_extras.sql`

```sql
alter table public.blog_translations
  add column if not exists seo_extras jsonb;

alter table public.blog_translations
  add constraint blog_translations_seo_extras_shape_chk
  check (
    seo_extras is null or (
      jsonb_typeof(seo_extras) = 'object'
      and (not (seo_extras ? 'faq')          or jsonb_typeof(seo_extras->'faq')          = 'array')
      and (not (seo_extras ? 'howTo')        or jsonb_typeof(seo_extras->'howTo')        = 'object')
      and (not (seo_extras ? 'video')        or jsonb_typeof(seo_extras->'video')        = 'object')
      and (not (seo_extras ? 'og_image_url') or jsonb_typeof(seo_extras->'og_image_url') = 'string')
    )
  );

comment on column public.blog_translations.seo_extras is
  'Sprint 5b — Structured-data extras (FAQ/HowTo/Video) + per-translation OG image override. Populated via MDX frontmatter on save, validated by Zod (SeoExtrasSchema) before insert.';
```

CHECK is structural-only (cheap, defense-in-depth). Zod validation in save action is the source-of-truth for shape correctness — full validation including bounds, regex, etc.

### Migration `20260501000003_seo_backfill.sql` (data, idempotent)

```sql
-- Backfill twitter handle for the master site (verify slug matches prod first)
update public.sites
set twitter_handle = 'thiagonfigueiredo'
where slug = 'bythiagofigueiredo' and twitter_handle is null;

-- Ensure supported_locales reflects current production reality
update public.sites
set supported_locales = array['pt-BR','en']
where slug = 'bythiagofigueiredo' and supported_locales = array['pt-BR'];
```

Idempotent. Pre-flight: `select slug, supported_locales, twitter_handle from sites;` to confirm slug and avoid clobbering manual edits.

### Migration sequencing

1. **PR-A merges first** — 3 migrations only, no app code reads them yet.
2. CI gate `check-migration-applied` job in PR-B does `select identity_type, twitter_handle, seo_default_og_image from sites limit 0` against prod read replica (anon key, read-only) and fails if column missing. Blocks merge of PR-B until PR-A is in prod.
3. App code reads with `?? 'person'` / `?? null` fallbacks during deploy window for safety.

Rollback per migration:
```sql
alter table public.sites drop column if exists identity_type;
alter table public.sites drop column if exists twitter_handle;
alter table public.sites drop column if exists seo_default_og_image;
alter table public.blog_translations drop constraint if exists blog_translations_seo_extras_shape_chk;
alter table public.blog_translations drop column if exists seo_extras;
```

## Frontmatter parsing (`gray-matter`)

`@tn-figueiredo/cms` `compileMdx` does **not** expose frontmatter. Verified: returns only `{ compiledSource, toc, readingTimeMin }`. No parser available in lockfile (no `gray-matter`, no `front-matter`, no `vfile-matter`).

**Decision:** add `gray-matter@4.0.3` to `apps/web/package.json` (~30KB, zero-config). Wrap in `lib/seo/frontmatter.ts`:

```typescript
import matter from 'gray-matter'
import { SeoExtrasSchema, type SeoExtras } from './jsonld/extras-schema'

export interface ParsedMdx {
  content: string                 // MDX source with frontmatter stripped
  seoExtras: SeoExtras | null     // validated; throws if invalid
  raw: Record<string, unknown>    // full frontmatter for future fields
}

export function parseMdxFrontmatter(source: string): ParsedMdx {
  const { content, data } = matter(source)
  let seoExtras: SeoExtras | null = null
  if (data.seo_extras !== undefined) {
    const parsed = SeoExtrasSchema.safeParse(data.seo_extras)
    if (!parsed.success) {
      throw new SeoExtrasValidationError(parsed.error.issues)
    }
    seoExtras = parsed.data
  }
  return { content, seoExtras, raw: data }
}
```

**Save action integration** — `cms/(authed)/blog/[id]/edit/actions.ts` `savePost`:

```typescript
let seoExtras: SeoExtras | null = null
let mdxContent = input.content_mdx
try {
  const parsed = parseMdxFrontmatter(input.content_mdx)
  seoExtras = parsed.seoExtras
  mdxContent = parsed.content  // strip frontmatter before compileMdx
} catch (err) {
  if (err instanceof SeoExtrasValidationError) {
    return { ok: false, error: 'invalid_seo_extras', details: err.issues }
  }
  throw err
}
const compiled = await compileMdx(mdxContent, blogRegistry)
await postRepo().updateTranslation({ ...input, content_mdx: mdxContent, content_compiled: compiled.compiledSource, seo_extras: seoExtras, content_toc: compiled.toc, reading_time_min: compiled.readingTimeMin })
```

Sprint 6+ may extract `parseFrontmatter` upstream into `@tn-figueiredo/cms@0.3.0` if a second consumer needs it.

### Extended schemas Zod definition

```typescript
// lib/seo/jsonld/extras-schema.ts
import { z } from 'zod'

export const FaqEntrySchema = z.object({
  q: z.string().min(1).max(500),
  a: z.string().min(1).max(2000),
})

export const HowToStepSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional(),
})

export const VideoObjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  thumbnailUrl: z.string().url(),
  uploadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.string().regex(/^PT(\d+H)?(\d+M)?(\d+S)?$/).optional(),
  embedUrl: z.string().url().optional(),
})

export const SeoExtrasSchema = z.object({
  faq: z.array(FaqEntrySchema).min(1).max(20).optional(),
  howTo: z.object({
    name: z.string().min(1).max(200),
    steps: z.array(HowToStepSchema).min(2).max(20),
  }).optional(),
  video: VideoObjectSchema.optional(),
  og_image_url: z.string().url().refine(u => u.startsWith('https://'), 'must be https').optional(),
}).strict()

export type SeoExtras = z.infer<typeof SeoExtrasSchema>
```

Frontmatter example:
```yaml
---
title: "Como Configurar pg_cron no Supabase"
seo_extras:
  howTo:
    name: "Configurar pg_cron no Supabase"
    steps:
      - name: "Habilitar extensão"
        text: "No SQL editor, rode CREATE EXTENSION pg_cron;"
      - name: "Schedule job"
        text: "select cron.schedule('job_name', '0 0 * * *', $$SELECT do_thing()$$);"
  faq:
    - q: "pg_cron exige Supabase Pro?"
      a: "Sim, plano Pro ou superior."
  og_image_url: "https://bythiagofigueiredo.com/og-pg-cron.png"
---
```

## Server action modifications

Confirmed by inventory agent — full surface area:

### Files & functions to modify (PR-C)

| File | Function | Operation | New revalidations |
|---|---|---|---|
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` | `savePost` | update `blog_posts` + `blog_translations` | call `revalidateBlogPostSeo(siteId, postId, locale, slug)` per translation; replaces existing 2 `revalidatePath` calls |
| same | `publishPost` | update status | call `revalidateBlogPostSeo(...)` per translation |
| same | `unpublishPost` | update status | call `revalidateBlogPostSeo(...)` |
| same | `archivePost` | update status | **bug fix**: today only revalidates `/blog/${locale}` index, missing the slug page — `revalidateBlogPostSeo(...)` adds it back |
| same | `deletePost` | delete | `revalidateBlogPostSeo(...)` + `revalidateTag('sitemap:${siteId}')` |
| `apps/web/src/app/cms/(authed)/campaigns/new/actions.ts` | `createCampaign` | insert | none initially (drafts not in sitemap); add tag invalidation only when status flips to active |
| `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts` | `saveCampaign` | RPC `update_campaign_atomic` | `revalidateCampaignSeo(siteId, campaignId, locale, slug)` per translation |
| same | `publishCampaign` | update status | `revalidateCampaignSeo(...)` |
| same | `unpublishCampaign` | update status | `revalidateCampaignSeo(...)` |
| same | `archiveCampaign` | update status | `revalidateCampaignSeo(...)` |
| same | `deleteCampaign` | delete | `revalidateCampaignSeo(...)` + `revalidateTag('sitemap:${siteId}')` |
| `apps/web/src/app/cms/(authed)/blog/new/page.tsx` | inline create | insert (server component) | none — drafts not in sitemap; redirects to edit |

### New action (admin)

`apps/web/src/app/admin/(authed)/sites/actions.ts` (NEW) — `updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults` call `revalidateTag('seo-config')` (broad, low frequency).

## Identity profiles (committed)

```typescript
// apps/web/lib/seo/identity-profiles.ts
import type { PersonProfile, OrgProfile } from './config'

export const IDENTITY_PROFILES: Record<string, PersonProfile | OrgProfile> = {
  bythiagofigueiredo: {
    type: 'person',
    name: 'Thiago Figueiredo',
    jobTitle: 'Creator & Builder',
    imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
    sameAs: [
      'https://www.instagram.com/thiagonfigueiredo',
      'https://www.youtube.com/@bythiagofigueiredo',
      'https://www.youtube.com/@thiagonfigueiredo',
      'https://github.com/tn-figueiredo',
    ],
  },
}

export function getIdentityProfile(siteSlug: string): PersonProfile | OrgProfile | null {
  return IDENTITY_PROFILES[siteSlug] ?? null
}
```

**Why committed JSON, not DB:** identity is security-grade (sameAs links impact Knowledge Graph, typo affects brand identity). Edits via PR triggering code review is desired friction. Sprint 11 may move to DB if non-dev editing becomes a need.

**Pre-PR-B requirement:** commit `apps/web/public/identity/thiago.jpg` (1:1 ratio, ≥400×400, JPEG <100KB). User must approve photo. Without it, Person.imageUrl is broken.

## OG image template (BlogOgTemplate baseline)

```typescript
// lib/seo/og/template.tsx — variant B (branded)
export function BlogOgTemplate({ title, author, locale, brandColor, logoUrl }: Props) {
  const darkerBrand = darkenHex(brandColor, 30)  // pure JS HSL math, no chroma.js dep
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: `linear-gradient(135deg, ${brandColor}, ${darkerBrand})`,
      color: '#fff', fontFamily: 'Inter', padding: 80,
    }}>
      {logoUrl && <img src={logoUrl} width={64} height={64} style={{borderRadius: 12}} />}
      <h1 style={{
        fontSize: title.length > 60 ? 56 : 64,
        lineHeight: 1.1, marginTop: 'auto', maxWidth: 1040,
        fontWeight: 700,
      }}>
        {truncate(title, 100)}
      </h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, alignItems: 'center' }}>
        <span style={{ fontSize: 28, opacity: 0.9 }}>{author}</span>
        <span style={{ fontSize: 24, opacity: 0.7 }}>{locale.toUpperCase()}</span>
      </div>
    </div>
  )
}
```

Inter Bold loaded via `fetch(new URL('./Inter-Bold.subset.ttf', import.meta.url))` in the route handler, passed to `ImageResponse({fonts:[{name:'Inter', data, weight:700}]})`. Subset latin-only (~35KB). No CJK/Arabic support (site has no such content yet).

Template is in own file → switching to variant C (cover-image-based) in future is one-PR refactor.

## Lighthouse CI quality gate

`.lighthouserc.yml`:
```yaml
ci:
  collect:
    url:
      - https://${LHCI_PREVIEW_URL}/
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR/welcome
      - https://${LHCI_PREVIEW_URL}/privacy
      - https://${LHCI_PREVIEW_URL}/contact
    settings:
      preset: desktop
      throttlingMethod: simulate
  assert:
    assertions:
      categories:seo: ['error', { minScore: 0.95 }]
      categories:accessibility: ['warn', { minScore: 0.90 }]
      categories:performance: ['warn', { minScore: 0.80 }]
      categories:best-practices: ['warn', { minScore: 0.90 }]
      uses-text-compression: error
      uses-rel-canonical: error
      hreflang: error
      structured-data: warn
  upload:
    target: temporary-public-storage
```

Mobile run separate (different config — `formFactor: mobile`, `screenEmulation: { mobile: true, ... }`, throttling presets per Moto G4).

`.github/workflows/lighthouse.yml` triggers on PRs touching `apps/web/**`, waits for Vercel preview, runs `lhci autorun`. `LHCI_GITHUB_APP_TOKEN` optional — without it, results fall back to public temporary storage (`temporary-public-storage`).

## Schema-dts test gate

```typescript
// lib/seo/jsonld/__tests__/builders.test.ts
import { expectTypeOf } from 'vitest'
import type { BlogPosting, Person, BreadcrumbList, FAQPage, HowTo, VideoObject } from 'schema-dts'

test('buildBlogPostingNode matches schema-dts BlogPosting', () => {
  const node = buildBlogPostingNode(mockConfig, mockPost, mockTxs)
  expectTypeOf(node).toMatchTypeOf<BlogPosting>()
  expect(node['@type']).toBe('BlogPosting')
  expect(node.author).toEqual({ '@id': expect.stringMatching(/#person$/) })
})

test('blog post @graph snapshot — full extras', () => {
  const graph = composeGraph([
    buildWebSiteNode(mockConfig),
    buildPersonNode(mockConfig, mockPersonProfile),
    buildBlogPostingNode(mockConfig, mockPost, mockTxs),
    buildBreadcrumbNode([{name:'Home',url:'/'},{name:'Blog',url:'/blog/pt-BR'},{name:mockPost.title,url:'/blog/pt-BR/'+mockPost.slug}]),
    buildFaqNode(mockExtras.faq),
  ])
  expect(graph).toMatchSnapshot()
})
```

`expectTypeOf` is compile-time TypeScript guard (catches schema regressions before runtime). Snapshot detects accidental output drift.

## Health endpoint

`apps/web/src/app/api/health/seo/route.ts` (CRON_SECRET-protected GET):

```typescript
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response(null, { status: 401 })
  const host = req.headers.get('host')!
  const site = await resolveSiteByHost(host)
  if (!site) return Response.json({ ok: false, error: 'site_not_resolved' }, { status: 503 })
  const start = Date.now()
  const config = await getSiteSeoConfig(site.id, host)
  const configMs = Date.now() - start
  const sitemapStart = Date.now()
  const routes = await enumerateSiteRoutes(site.id, config)
  const sitemapMs = Date.now() - sitemapStart
  return Response.json({
    ok: true,
    siteId: site.id,
    siteSlug: site.slug,
    identityType: config.identityType,
    seoConfigCachedMs: configMs,
    sitemapBuildMs: sitemapMs,
    sitemapRouteCount: routes.length,
    schemaVersion: 'v1',
    flags: {
      jsonLd: process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED !== 'false',
      dynamicOg: process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false',
      extendedSchemas: process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED !== 'false',
      aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
    },
  })
}
```

Used during incident response: `curl -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo` returns full SEO stack state.

## Acceptance test matrix

`scripts/seo-smoke.sh` (committed, runnable locally + CI):

```bash
#!/usr/bin/env bash
set -euo pipefail
HOST="${1:-https://bythiagofigueiredo.com}"

echo "1. Sitemap valid XML"
curl -sf "$HOST/sitemap.xml" | xmllint --noout - || (echo FAIL; exit 1)

echo "2. Robots includes Sitemap line"
curl -sf "$HOST/robots.txt" | grep -q "^Sitemap: $HOST/sitemap.xml$" || (echo FAIL; exit 1)

echo "3. Robots disallows protected paths"
for path in /admin /cms /account /api; do
  curl -sf "$HOST/robots.txt" | grep -q "Disallow: $path" || (echo "FAIL: $path"; exit 1)
done

echo "4. Blog post emits JSON-LD with @graph"
SLUG=$(curl -sf "$HOST/sitemap.xml" | grep -oE '<loc>[^<]+/blog/[^<]+</loc>' | head -1 | sed 's/<\/\?loc>//g')
HTML=$(curl -sf "$SLUG")
echo "$HTML" | grep -q 'type="application/ld+json"' || (echo "FAIL: no JSON-LD on $SLUG"; exit 1)
echo "$HTML" | grep -q '"@graph"' || (echo "FAIL: no @graph on $SLUG"; exit 1)

echo "5. OG image returns PNG 1200x630"
OG_URL=$(echo "$HTML" | grep -oE 'og:image" content="[^"]+"' | head -1 | sed 's/og:image" content="//;s/"$//')
TYPE=$(curl -sfI "$OG_URL" | grep -i content-type)
echo "$TYPE" | grep -q "image/png" || (echo "FAIL: $OG_URL → $TYPE"; exit 1)

echo "6. Hreflang alternates present"
echo "$HTML" | grep -qE 'rel="alternate" hreflang="(pt-BR|en|x-default)"' || (echo FAIL; exit 1)

echo "7. Dev subdomain blocks all"
DEV_ROBOTS=$(curl -sf "https://dev.bythiagofigueiredo.com/robots.txt")
echo "$DEV_ROBOTS" | grep -q "Disallow: /" || (echo "FAIL: dev robots permissive"; exit 1)

echo "8. Health endpoint reports ok"
curl -sf -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/health/seo" | grep -q '"ok":true' || (echo FAIL; exit 1)

echo "✅ All smoke checks passed"
```

Runs in CI via `seo-post-deploy.yml` workflow (manual dispatch after deploy verified green).

## Rollout sequence (5 PRs)

### PR-A — DB schema (~30 min)
- `supabase/migrations/20260501000001_sites_seo_columns.sql`
- `supabase/migrations/20260501000002_blog_translations_seo_extras.sql`
- `supabase/migrations/20260501000003_seo_backfill.sql`
- Verify slug + supported_locales pre-flight: `select slug, supported_locales, twitter_handle from sites;`
- `npm run db:push:prod` → production
- Post-verification: `select identity_type, twitter_handle, seo_default_og_image from sites;`
- **Does not break or change anything in app today.** Independent merge.

### PR-B — `lib/seo/` core + dynamic routes (~6h)

**Spike (≤1h):** verify in preview deploy:
- Does middleware execute for `/sitemap.xml` and `/robots.txt`? (Expected yes, per matcher analysis.)
- Does `headers().get('x-site-id')` work inside `app/sitemap.ts`? (Expected: NO — confirms direct host lookup is required.)
- Does `compileMdx` accept frontmatter-stripped content cleanly? (Expected yes — gray-matter strips before pass.)

If spike confirms expectations, proceed; if surprises, document fallback before coding.

**Implementation:**
- Create `lib/seo/{config,page-metadata,noindex,enumerator,cache-invalidation,robots-config,frontmatter,identity-profiles}.ts`
- Create `lib/seo/jsonld/{builders,graph,extras-schema,render,types}.ts`
- Create `lib/seo/og/{template,render}.tsx`
- Create `app/sitemap.ts`, `app/robots.ts`
- Create `app/og/blog/[locale]/[slug]/route.tsx`, `app/og/campaigns/[locale]/[slug]/route.tsx`, `app/og/[type]/route.tsx`
- Create `apps/web/public/og-default.png` (Figma export of template with placeholder)
- Create `apps/web/public/identity/thiago.jpg` (user-supplied)
- Modify `apps/web/src/middleware.ts:122` to short-circuit `/sitemap.xml` + `/robots.txt` from dev rewrite
- Add deps: `gray-matter@4.0.3`, `schema-dts@1.1.5`, `@lhci/cli@0.13` (devDep)
- All feature flags TODOS `true` by default (`NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED`, `NEXT_PUBLIC_SEO_JSONLD_ENABLED`, `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED`, optional `SEO_AI_CRAWLERS_BLOCKED=false`)
- Tests: 100% unit jsonld builders + factories, integration DB-gated for enumerator (RLS mirror correctness), smoke in sitemap/robots/OG routes
- CI gate `check-migration-applied`: read-only query against prod read replica via anon key, fails if column absent
- Manual preview verification: `/sitemap.xml`, `/robots.txt`, `/og/blog/.../...` return expected shapes
- **Does NOT modify any existing `page.tsx`** — only adds new infra

### PR-C — Wire existing pages + JSON-LD + cache invalidation (~5h)
- Refactor `generateMetadata` in 7 page files using new factories
- Cleanup `app/layout.tsx` hardcoded metadata (becomes shell only); add `generateMetadata` to `app/(public)/layout.tsx`
- Add `<JsonLdScript graph={...}/>` to each page server component
- Modify 11 server actions + 1 server component per inventory table
- Add new admin server actions for branding/identity updates
- Snapshot tests per `generateMetadata` factory
- Verify `archivePost` revalidation bug fix lands

### PR-D — CI gates (~2h)
- `.lighthouserc.yml` + `.github/workflows/lighthouse.yml`
- `scripts/seo-smoke.sh` + `.github/workflows/seo-post-deploy.yml` (manual dispatch)
- Vitest suite for schema-dts type-equivalence
- LHCI threshold: SEO ≥95, mobile perf ≥80

### PR-E — Health + runbook + post-deploy (~1h)
- `app/api/health/seo/route.ts`
- `docs/runbooks/seo-incident.md` — playbook for OG broken, sitemap empty, JSON-LD invalid, hreflang regression
- After merge: trigger `seo-post-deploy.yml` against prod
- Submit sitemap to Google Search Console + Bing Webmaster (manual UI)
- Verify Rich Results test on 1 blog post + 1 campaign
- Mark Sprint 5b done in roadmap

**Total: ~14h.** vs original roadmap 9h — extra justified by scope C maximalist + multi-domain + CI gates.

## Feature flag rollback playbook

| Symptom | Flag | Recovery |
|---|---|---|
| Rich Results validator fails on all posts | `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` | <60s Vercel env redeploy |
| FAQ rich result triggers Google manual penalty | `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false` | <60s |
| OG images broken in social shares | `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false` (falls back to `og_image_url`/`cover_image_url`/static default) | <60s |
| Sitemap leaks drafts | (RLS mirror bug) `SEO_SITEMAP_KILLED=true` returns `[]` | <60s; add flag in PR-B |
| AI crawlers cause unexpected load | `SEO_AI_CRAWLERS_BLOCKED=true` adds GPTBot/CCBot/anthropic-ai to robots Disallow | <60s |

All flags are env vars, SSR-safe boolean default `true` (or `false` for AI crawler block).

## Risks & mitigations

| Risk | L | I | Mitigation |
|---|:-:|:-:|---|
| Middleware headers not visible in `app/sitemap.ts`/`robots.ts` | **CONFIRMED** | H | Direct host lookup via `SupabaseRingContext.getSiteByDomain(host)` inside handlers (planned as primary path, not fallback) |
| `compileMdx` doesn't expose frontmatter | **CONFIRMED** | M | `gray-matter@4.0.3` added to apps/web; strips before compile |
| `@tn-figueiredo/seo` `buildSitemap` produces broken hreflang URLs for locale-prefixed paths | **CONFIRMED** | M | Build sitemap entries manually in `enumerator.ts`; `@tn-figueiredo/seo` only used for `buildRobots` + `generateMetadata` primitives |
| Middleware dev-subdomain rewrite breaks `/sitemap.xml` on `dev.bythiagofigueiredo.com` | **CONFIRMED** | L | Middleware short-circuit added in PR-B |
| Sitemap/OG req frequency stresses Vercel Hobby invocations | L | M | Cache-Control aggressive; OG immutable-style; pre-warm cron deferred unless metrics justify |
| OG cold start >800ms triggers crawler timeout | L | L | Subset Inter (~35KB) + simple template; Sentry alerts p95>5s; static fallback redirect on error |
| Lighthouse mobile <80 due to font/CLS | M | M | Defer optimization (subset font, font-display: swap, reserve heights); not a Sprint 5b blocker if 70-79 |
| `revalidateTag` doesn't propagate fast enough on Vercel Edge | L | M | Verify in preview before PR-C; fallback to `revalidatePath` everywhere |
| schema.org validator marks `@graph` malformed | L | H | Snapshot test + Rich Results manual test in PR-E; rollback flag |
| Multi-site cache key bleed (site A config served for site B) | L | Critical | Cache key includes `host`; integration test creates 2 sites + verifies isolation; RLS mirror reinforces site_id filter |
| Vercel preview URL accidentally indexable | M | M | `isPreviewOrDevHost(host)` short-circuits; explicit test |
| Person.imageUrl 404s (no thiago.jpg committed) | **PRE-FLIGHT** | H | Action item: user provides photo before PR-B merge |
| `sites.supported_locales` not backfilled with `['pt-BR','en']` | L | M | Migration `…000003` includes idempotent backfill; verify via `select` post-merge |

## Open decisions

1. **AI crawler stance** — default Sprint 5b: **permit** (no `Disallow` for GPTBot/CCBot/anthropic-ai). To block: set `SEO_AI_CRAWLERS_BLOCKED=true` in Vercel env. Decision belongs to user, not engineering.
2. **Twitter handle** — backfill assumes `@thiagonfigueiredo` matches Twitter/X. **User confirms before PR-A**.
3. **Person photo** — `apps/web/public/identity/thiago.jpg` must be supplied. **Blocking PR-B**.
4. **OG template variant** — B baseline. Switching to C (cover image) is post-Sprint 5b 1-PR refactor.
5. **`/contact` ContactPage JSON-LD** — included for completeness; can drop if surface area concerns surface.
6. **Sentry tag conventions** — use `component: 'og-route' | 'sitemap' | 'robots' | 'jsonld'` + `seo: true` consistent with Sprint 4a Sentry layer.

## Effort breakdown

| PR | Scope | Estimate |
|---|---|:-:|
| PR-A | DB migrations + backfill | 0.5h |
| PR-B | `lib/seo/` core + dynamic routes + spike | 6h |
| PR-C | Wire existing pages + JSON-LD + cache invalidation in 12 actions/components | 5h |
| PR-D | Lighthouse CI + smoke + schema-dts gate | 2h |
| PR-E | Health endpoint + runbook + post-deploy verification | 0.5h |

**Total: ~14h** (+5h vs roadmap 9h, scoped for C maximalist + multi-domain + CI quality gates).

## Post-deploy verification checklist

```markdown
- [ ] `scripts/seo-smoke.sh https://bythiagofigueiredo.com` → all 8 checks ✅
- [ ] Rich Results Test on 1 blog post → BlogPosting + BreadcrumbList + Person valid
- [ ] Rich Results Test on 1 campaign → Article + BreadcrumbList valid
- [ ] Share blog post URL on Slack/WhatsApp → OG image preview correct
- [ ] Share same URL on LinkedIn → OG image loads
- [ ] Submit sitemap.xml in Google Search Console
- [ ] Submit sitemap.xml in Bing Webmaster
- [ ] 24h: GSC indexes ≥1 new URL
- [ ] 7d: GSC shows "Search appearance → Enhanced results → Articles" entries
- [ ] Lighthouse mobile (Moto G4 throttle): SEO ≥95, perf ≥80
- [ ] `/api/health/seo` returns `ok: true`
- [ ] Sentry: zero new errors with tags `component: og-route|sitemap|robots|jsonld` in 24h
```

## Future work (registered in roadmap)

- **Sprint 6+**: Admin UI editor for `seo_extras` (FAQ/HowTo/Video tabs)
- **Sprint 11 (CMS Hub)**: move identity profiles to DB; `sites.content_path_segment` configurable column for `/article` vs `/blog` per-site
- **Second site live**: stress-test multi-domain isolation
- **Analytics sprint**: GA4/Plausible with consent gating (Sprint 5a ConsentGate ready)
- **>10k URLs**: implement sitemap index pagination
- **Sprint 5d**: pre-warm cron for OG images if metrics justify
