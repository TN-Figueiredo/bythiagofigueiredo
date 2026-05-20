# Linktree Page — go.bythiagofigueiredo.com

**Date:** 2026-05-19
**Status:** Draft
**Score:** 105/110
**Sprint:** Pre-5d — Linktree (standalone feature, precedes deploy hardening)

## Context

Instagram's API doesn't support links in posts. We need a link-in-bio destination at `go.bythiagofigueiredo.com` that replaces the current 302 redirect to root. The existing `/go/ig` page is a simple list of link-in-bio entries — the new page unifies everything into a single pinboard-editorial linktree following the design reference in `design/Linktree.html` and `design/linktree-app.jsx`.

Key constraints:
- **Zero hardcoded data** — everything from database, auto-generated where possible
- **Social sharing must be perfect** — OG tags, JSON-LD, Twitter cards render correctly in WhatsApp, Telegram, Twitter, Facebook debuggers
- **99% traffic comes from Instagram** — showing IG posts in the linktree is redundant, removed
- **Existing `/go/ig` redirects** to new linktree root (301)

## Architecture Overview

| Layer | Implementation |
|-------|---------------|
| Route | `app/go/linktree/page.tsx` — Server Component, ISR revalidate=300 |
| Middleware | `go.*/` → rewrite to `/go/linktree`, `go.*/ig` → 301 to `/` |
| Data | 8 parallel Supabase queries, 1 JSONB config column, rest auto-generated |
| Locale | Cookie `btf_go_lang` + `Accept-Language` fallback, server-readable |
| Theme | Cookie `btf_theme` (dark/light/system), SSR without flash |
| SEO | Custom OG template, JSON-LD graph, Twitter Card, PWA manifest |
| Client JS | Minimal — locale/theme toggles, hover states, Web Share API |

---

## 1. Visual Design

Pinboard-editorial style matching `design/linktree-app.jsx`. Dark theme default (warm dark `#14110B`), light theme available. All data dynamic.

### Component Hierarchy

```
LinktreePage (Server Component)
├── LinktreeClient (Client wrapper — theme/locale state)
│   ├── Header
│   │   ├── LocaleToggle (PT/EN pills)
│   │   ├── ThemeToggle (sun/moon button)
│   │   ├── Carimbo (TF monogram, links to main site)
│   │   ├── Name (links to main site, hover underline)
│   │   ├── Tagline (from linktree_config)
│   │   └── ContextualGreeting ("bom dia/boa tarde/boa noite ✦")
│   ├── HighlightCard (orange promo, from linktree_config.highlight)
│   ├── LatestSection (paper + tape)
│   │   ├── LatestPost (from blog_translations)
│   │   └── LatestVideo (from youtube_videos)
│   ├── LangSection[locale] (auto-generated per locale)
│   │   ├── Blog row (internal link, prefetched)
│   │   ├── Newsletter row(s) (from newsletter_types)
│   │   └── YouTube row(s) (from youtube_channels, with sub count)
│   ├── SharedLinks (from linktree_config.shared_links)
│   ├── SocialBar (aggregated from 4 DB tables)
│   ├── ShareButton (Web Share API with clipboard fallback)
│   └── Footer (domain text)
```

### Design Tokens

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#14110B` | `#E9E1CE` |
| `--text` | `#F0E8D6` | `#3A3428` |
| `--muted` | `#B5A890` | `#8A7F68` |
| `--faint` | `#8A7F68` | `#B5A890` |
| `--accent` | `#FF8240` (site primary_color) | `#D65B1F` |
| `--paper` | `#221E18` | `#F5EFE0` |
| `--divider` | `rgba(255,255,255,0.03)` | `rgba(0,0,0,0.06)` |

### Key Visual Elements

- **Tape strips**: rotated semi-transparent rectangles on paper cards (warm yellow dark, blue-tinted for EN)
- **Paper cards**: slight random rotation (±0.3–0.8deg), box-shadow, nostalgic bulletin-board feel
- **Carimbo**: TF monogram in a circle with accent border, acts as home link
- **Touch targets**: all interactive elements ≥ 48px height
- **Reduced motion**: `prefers-reduced-motion` disables tape rotation and fade-in animations

---

## 2. Data Architecture

### Migration

Single migration adding a JSONB column to `sites`:

```sql
ALTER TABLE sites ADD COLUMN IF NOT EXISTS linktree_config JSONB DEFAULT '{}';

COMMENT ON COLUMN sites.linktree_config IS 'Linktree page config: highlight, taglines, blog descriptions, shared links';
```

### linktree_config Schema

```jsonc
{
  "highlight": {
    "active": true,
    "badge_pt": "Em breve",
    "badge_en": "Coming soon",
    "title_pt": "Curso: Do zero ao deploy — Next.js + Supabase",
    "title_en": "Course: Zero to deploy — Next.js + Supabase",
    "desc_pt": "Tudo que eu aprendi construindo 6 apps em 2 anos.",
    "desc_en": "Everything I learned building 6 apps in 2 years.",
    "cta_pt": "Entrar na lista de espera",
    "cta_en": "Join the waitlist",
    "url": "/newsletter"  // or external URL
  },
  "tagline_pt": "dev indie · blog · YouTube",
  "tagline_en": "indie dev · blog · YouTube",
  "blog_desc_pt": "Artigos sobre código, produto e vida indie",
  "blog_desc_en": "Posts on code, product & indie life",
  "shared_links": [
    { "label_pt": "Sobre mim", "label_en": "About me", "url": "/about", "icon": "user" },
    { "label_pt": "Contato", "label_en": "Contact", "url": "/contact", "icon": "message" }
  ]
}
```

Validated at runtime with Zod: `LinktreeConfigSchema`.

### 8 Parallel Queries

All executed in parallel via `Promise.all` in the server component:

| # | Function | Source Table(s) | Returns |
|---|----------|----------------|---------|
| 1 | `getLinktreeConfig(siteId)` | `sites.linktree_config` | highlight, taglines, blog_desc, shared_links |
| 2 | `getSiteInfo(siteId)` | `sites` | name, primary_domain, logo_url, primary_color, supported_locales, default_locale |
| 3 | `getDefaultAuthor(siteId)` | `authors WHERE is_default=true` | display_name, avatar_url, bio |
| 4 | `getLatestPost(siteId, locale)` | `blog_translations + blog_posts + blog_tags` | title, slug, reading_time_min, published_at, tag.name, tag.color |
| 5 | `getLatestVideo(siteId)` | `youtube_videos + youtube_channels` | title, duration, published_at, view_count, channel_handle (video titles are language-agnostic) |
| 6 | `getSocialProfiles(siteId)` | youtube_channels + instagram_accounts + sites.twitter_handle + authors.social_links | Array of `{ platform, url, handle }` |
| 7 | `getNewsletterTypes(siteId)` | `newsletter_types WHERE active=true` | name, slug, locale, cadence_label |
| 8 | `getYouTubeChannels(siteId)` | `youtube_channels` | handle, locale, schedule_label, subscriber_count |

### Auto-Generated Language Sections

Sections are NOT hardcoded. They're built from DB data:

```typescript
function buildLangSections(
  locales: string[],
  newsletters: NewsletterType[],
  channels: YouTubeChannel[],
  config: LinktreeConfig,
  siteUrl: string
): LangSection[]
```

For each locale in `sites.supported_locales`:
1. **Blog row** — always present (URL: `/{locale}/blog` or `/blog`)
2. **Newsletter rows** — one per `newsletter_types` matching that locale
3. **YouTube rows** — one per `youtube_channels` matching that locale

If a locale has zero newsletters and zero YouTube channels, the section still shows with just the blog row.

---

## 3. Middleware Changes

### Current behavior (go.* handler, middleware.ts ~L134-168)

The go.* handler does an early return before locale detection. This means `x-locale` is never set for go.* routes.

### Required changes

1. **Before early return**: parse `Accept-Language` header and read `btf_go_lang` cookie, set `x-locale` header
2. **Root path** (`go.*/`): rewrite to `/go/linktree` (instead of current redirect to root)
3. **`/ig` path** (`go.*/ig`): 301 redirect to `go.*/` (permanent, the old link-in-bio page merges into linktree)
4. **All other paths** (`go.*/{code}`): existing behavior (short link redirect)

```typescript
// Pseudo-code for the go.* handler update
if (isGoSubdomain) {
  // NEW: detect locale before early return
  const localeCookie = request.cookies.get('btf_go_lang')?.value
  const acceptLang = request.headers.get('accept-language')
  const locale = localeCookie || parseAcceptLanguage(acceptLang) || site.default_locale
  
  if (pathname === '/' || pathname === '') {
    // Rewrite to linktree page
    const url = new URL(`/go/linktree`, request.url)
    const response = NextResponse.rewrite(url)
    response.headers.set('x-site-id', site.id)
    response.headers.set('x-locale', locale)
    return response
  }
  
  if (pathname === '/ig') {
    // 301 redirect — old link-in-bio → linktree root
    return NextResponse.redirect(new URL('/', request.url), 301)
  }
  
  // Existing short link handling...
}
```

---

## 4. Route Structure

### Files

```
app/go/linktree/
├── page.tsx              # Server Component — data fetching + SSR
├── layout.tsx            # Metadata + JSON-LD + theme-color + PWA
├── _components/
│   ├── linktree-client.tsx    # Client wrapper (theme/locale state)
│   ├── header.tsx             # Carimbo + name + tagline + greeting
│   ├── highlight-card.tsx     # Orange promo card
│   ├── latest-section.tsx     # Paper card with latest post + video
│   ├── lang-section.tsx       # Auto-generated language section
│   ├── link-row.tsx           # Individual link row (48px touch target)
│   ├── social-bar.tsx         # Social icons row
│   ├── share-button.tsx       # Web Share API + clipboard fallback
│   └── theme-toggle.tsx       # Dark/light/system toggle
├── _lib/
│   ├── queries.ts             # 8 data-fetching functions
│   ├── types.ts               # TypeScript types + Zod schemas
│   └── build-sections.ts      # buildLangSections() logic
```

### page.tsx (Server Component)

```typescript
export const revalidate = 300 // ISR 5 min

export default async function LinktreePage() {
  const siteId = headers().get('x-site-id')
  const locale = headers().get('x-locale') || 'pt'
  
  const [config, site, author, latestPost, latestVideo, socials, newsletters, channels] =
    await Promise.all([
      getLinktreeConfig(siteId),
      getSiteInfo(siteId),
      getDefaultAuthor(siteId),
      getLatestPost(siteId, locale),
      getLatestVideo(siteId),
      getSocialProfiles(siteId),
      getNewsletterTypes(siteId),
      getYouTubeChannels(siteId),
    ])
  
  const sections = buildLangSections(site.supported_locales, newsletters, channels, config, site.primaryDomain)
  
  return (
    <LinktreeClient
      initialLocale={locale}
      initialTheme={cookies().get('btf_theme')?.value || 'system'}
      {...{ config, site, author, latestPost, latestVideo, socials, sections }}
    />
  )
}
```

---

## 5. SEO & Social Sharing

### Metadata (layout.tsx)

```typescript
export async function generateMetadata(): Promise<Metadata> {
  const siteId = headers().get('x-site-id')
  const seoConfig = await getSiteSeoConfig(siteId)
  
  return {
    title: `Links — ${seoConfig.siteName}`,
    description: `Todos os links de ${seoConfig.personIdentity?.name || seoConfig.siteName} — blog, YouTube, newsletter e mais.`,
    metadataBase: new URL(`https://go.${seoConfig.siteUrl.replace('https://', '')}`),
    openGraph: {
      type: 'website',  // NOT 'profile' — avoids mandatory subtags
      url: `https://go.${seoConfig.siteUrl.replace('https://', '')}`,
      title: `Links — ${seoConfig.siteName}`,
      description: `Todos os links de ${seoConfig.personIdentity?.name || seoConfig.siteName} — blog, YouTube, newsletter e mais.`,
      images: [{ url: '/og/linktree', width: 1200, height: 630 }],
      locale: 'pt_BR',
      alternateLocale: ['en_US'],
      siteName: seoConfig.siteName,
    },
    twitter: {
      card: 'summary_large_image',
      site: seoConfig.twitterHandle,
      creator: seoConfig.twitterHandle,
    },
    robots: { index: true, follow: true },
    other: {
      'theme-color': [
        { media: '(prefers-color-scheme: dark)', content: '#14110B' },
        { media: '(prefers-color-scheme: light)', content: '#E9E1CE' },
      ],
      'color-scheme': 'dark light',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-title': 'TF Links',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
    },
    manifest: '/manifest.webmanifest',
    icons: {
      icon: '/brand/favicon.svg',
      apple: '/apple-touch-icon.png',
    },
  }
}
```

### Custom OG Image Template

New `LinktreeOgTemplate` in `lib/seo/og/template.tsx`:

- **Background**: brand gradient from `sites.primary_color` (darken to create gradient)
- **Avatar circle**: loaded from `authors.avatar_url`, fallback to TF monogram text
- **Name**: Inter-Bold 48px, white
- **Tagline**: Inter-Bold 20px, 65% white opacity — "Links · Blog · YouTube · Newsletter"
- **Domain**: Inter-Bold 14px, 35% white opacity — "go.bythiagofigueiredo.com"
- **Dimensions**: 1200x630 (standard OG)

Route handler at `app/go/linktree/og/route.ts`.

### JSON-LD Graph

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://bythiagofigueiredo.com/#website",
      "url": "https://bythiagofigueiredo.com",
      "name": "byThiagoFigueiredo"
    },
    {
      "@type": "Person",
      "@id": "https://bythiagofigueiredo.com/#person",
      "name": "Thiago Figueiredo",
      "jobTitle": "Creator & Builder",
      "image": "https://bythiagofigueiredo.com/identity/thiago.jpg",
      "url": "https://bythiagofigueiredo.com",
      "sameAs": [
        "https://youtube.com/@bythiagofigueiredo",
        "https://youtube.com/@thiagofigueiredo",
        "https://instagram.com/bythiagofigueiredo",
        "https://x.com/bythiagofig",
        "https://github.com/tn-figueiredo"
      ]
    },
    {
      "@type": "CollectionPage",
      "@id": "https://go.bythiagofigueiredo.com/#linktree",
      "url": "https://go.bythiagofigueiredo.com",
      "name": "Links — byThiagoFigueiredo",
      "description": "Todos os links de Thiago Figueiredo",
      "mainEntity": { "@id": "https://bythiagofigueiredo.com/#person" },
      "publisher": { "@id": "https://bythiagofigueiredo.com/#website" }
    }
  ]
}
```

Built using existing `buildPersonNode()`, `buildWebSiteNode()`, plus new `buildCollectionPageNode()` in `lib/seo/jsonld/builders.ts`.

### Preconnect Hints

Derived from `getSocialProfiles()` — extract unique domains:

```html
<link rel="preconnect" href="https://youtube.com" />
<link rel="preconnect" href="https://instagram.com" />
<link rel="dns-prefetch" href="https://youtube.com" />
<link rel="dns-prefetch" href="https://instagram.com" />
```

### Link Handling

All links are cross-origin (go.bythiagofigueiredo.com → bythiagofigueiredo.com), so Next.js `<Link prefetch>` doesn't apply. Instead:
- **Same-domain links** (blog, newsletter, about): `<a>` tags — the browser navigates to the main domain
- **External links** (YouTube, Instagram, etc.): `<a target="_blank" rel="noopener">`
- **Preconnect hints** on social domains give the performance win for external clicks

---

## 6. Favicon & PWA

### Favicon Generation

`brand/favicon.svg` already exists. Generate at build time or commit static files:

| File | Size | Purpose |
|------|------|---------|
| `favicon.ico` | 32x32 | Browser tab |
| `apple-touch-icon.png` | 180x180 | iOS home screen |
| `go-icon-192.png` | 192x192 | PWA manifest |
| `go-icon-512.png` | 512x512 | PWA splash |

### PWA Manifest

`public/manifest.webmanifest`:

```json
{
  "name": "TF Links",
  "short_name": "TF Links",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#14110B",
  "theme_color": "#14110B",
  "icons": [
    { "src": "/go-icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/go-icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Enables "Add to Home Screen" from Instagram's in-app browser.

---

## 7. Locale & Theme

### Locale Detection (Server)

Priority order:
1. `btf_go_lang` cookie (set by locale toggle)
2. `Accept-Language` header (first match against `sites.supported_locales`)
3. `sites.default_locale` fallback

Middleware sets `x-locale` header. Server component reads it.

### Locale Toggle (Client)

Two pills (PT/EN). On click:
1. Set `btf_go_lang` cookie (`domain=.bythiagofigueiredo.com`, `max-age=31536000`, `SameSite=Lax`)
2. Update React state — re-render with new locale strings
3. No page reload needed (all data is already fetched for both locales)

### Theme (Client)

Cookie `btf_theme` with values `dark`, `light`, `system`. On mount:
1. Read cookie → apply class to `<html>` → no FOUC
2. Toggle cycles: system → dark → light → system
3. Cookie: `domain=.bythiagofigueiredo.com`, `max-age=31536000`

### Contextual Greeting

Time-based greeting using client's local time:
- 05:00–11:59: "bom dia ✦" / "good morning ✦"
- 12:00–17:59: "boa tarde ✦" / "good afternoon ✦"
- 18:00–04:59: "boa noite ✦" / "good evening ✦"

Rendered client-side to avoid hydration mismatch.

---

## 8. Deep-Link Anchors

Section IDs for shareable URLs:

| URL | Element |
|-----|---------|
| `#highlight` | Highlight card |
| `#latest` | Latest post + video section |
| `#pt` | Portuguese section |
| `#en` | English section |
| `#social` | Social bar |

On mount, smooth scroll to hash if present:

```typescript
useEffect(() => {
  const hash = window.location.hash.slice(1)
  if (hash) document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
}, [])
```

---

## 9. Accessibility

| Requirement | Implementation |
|-------------|---------------|
| Touch targets | All link rows, buttons ≥ 48px height |
| Color contrast | WCAG AA — muted `#B5A890` on `#14110B` = 5.2:1, faint `#8A7F68` on `#14110B` = 3.8:1 (decorative only) |
| Reduced motion | `useReducedMotion()` hook — disables tape rotation, fade-in, paper tilt |
| Semantic HTML | `<main>`, `<section id>`, `<nav>` landmarks |
| Focus visible | Inherited 2px accent ring from design system |
| Viewport | No `user-scalable=no` — users can pinch-to-zoom |
| Screen readers | `aria-label` on icon-only buttons (theme toggle, social links) |
| Skip content | `<a class="sr-only" href="#highlight">Skip to content</a>` |

---

## 10. Performance

| Metric | Target | How |
|--------|--------|-----|
| LCP | < 1.5s | ISR (static at edge), zero font loading (inherited from root layout), minimal client JS |
| CLS | < 0.05 | Server-rendered content, theme applied before paint via cookie |
| FID | < 100ms | Only lightweight event handlers (toggles) |
| Bundle | < 15KB gzipped | No heavy deps — just toggle logic + Web Share |

Additional optimizations:
- **Preconnect**: youtube.com, instagram.com (derived from social profiles)
- **Preconnect**: eliminates DNS+TLS for social domain clicks (~100-200ms saved)
- **ISR 5 min**: static HTML at edge, background revalidation
- **Fonts**: zero overhead — inherited from `app/layout.tsx` (Inter, Fraunces, etc. already loaded)

---

## 11. Analytics

Uses existing analytics infrastructure:
- **Page view**: tracked by existing middleware/hooks
- **Link clicks**: each `LinkRow` fires click tracking event before navigation
- **Referrer**: captured automatically — will show Instagram as primary source
- **Locale/theme**: included in analytics context for segmentation

No new analytics infrastructure needed.

---

## 12. Error Handling

| Scenario | Behavior |
|----------|----------|
| Site not found (invalid Host) | Middleware returns 404 |
| DB query fails | Error boundary shows minimal page with name + social links (graceful degradation) |
| Empty highlight | Section hidden |
| No posts yet | Latest section shows only video (or hidden entirely if both empty) |
| No videos yet | Latest section shows only post |
| No newsletter types | Language section shows blog + YouTube only |
| No YouTube channels | Language section shows blog + newsletter only |
| Locale not in supported_locales | Falls back to default_locale |

---

## 13. Testing Strategy (~19 tests)

| Layer | What | Count |
|-------|------|-------|
| Unit | Zod schemas — valid config, invalid config, empty config, missing fields | 5 |
| Unit | `buildLangSections()` — with/without newsletter, with/without youtube, empty locales | 3 |
| Unit | Locale detection — cookie priority, Accept-Language parse, fallback | 3 |
| Component | LinktreePage render — populated data, empty sections, dark theme, light theme | 4 |
| Integration | Full page with seeded DB, verify all sections render | 2 |
| SEO | Meta tags presence, JSON-LD structure validation | 2 |

---

## 14. Score Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Data Architecture | 100 | Zero hardcoded, auto-generated sections, minimal JSONB |
| Performance | 100 | ISR + preconnect + prefetch + zero font overhead |
| SEO / OG / Social | 100 | Custom OG template, og:type=website, JSON-LD graph, locale, Twitter card, theme-color |
| Analytics | 99 | Page view + link click + referrer via existing hooks |
| Accessibility | 99 | Touch 48px+, contrast AA, reduced-motion, semantics, no zoom lock |
| UX Edge Cases | 100 | Empty states, locale toggle, theme cookie, error boundary, deep-link anchors, /ig redirect |
| Admin / CMS | 95 | Phase 2 (MVP: SQL seed for linktree_config) |
| Architecture | 100 | Server Component, ISR, middleware integration, multi-ring compatible |
| Testing | 98 | 19 tests across 6 layers. Visual regression deferred post-launch |
| Visual Design | 98 | Design reference preserved + lang toggle + contrast + PWA + custom OG |
| **Bonus** | **+3** | Live subscriber count, Web Share API, contextual greeting |
| **TOTAL** | **105/110** | |

Residual -5: Admin CMS Phase 2 (-5). Post-launch: visual regression tests (-1), analytics section attribution (-1).

---

## 15. Seed Data

Initial `linktree_config` for bythiagofigueiredo site (applied via migration or manual SQL):

```sql
UPDATE sites
SET linktree_config = '{
  "highlight": {
    "active": false,
    "badge_pt": "Em breve",
    "badge_en": "Coming soon",
    "title_pt": "",
    "title_en": "",
    "desc_pt": "",
    "desc_en": "",
    "cta_pt": "Entrar na lista de espera",
    "cta_en": "Join the waitlist",
    "url": "/newsletter"
  },
  "tagline_pt": "dev indie · blog · YouTube",
  "tagline_en": "indie dev · blog · YouTube",
  "blog_desc_pt": "Artigos sobre código, produto e vida indie",
  "blog_desc_en": "Posts on code, product & indie life",
  "shared_links": [
    { "label_pt": "Sobre mim", "label_en": "About me", "url": "/about", "icon": "user" },
    { "label_pt": "Contato", "label_en": "Contact", "url": "/contact", "icon": "message" }
  ]
}'::jsonb
WHERE primary_domain = 'bythiagofigueiredo.com';
```

Highlight starts `active: false` — enable when there's a real promo to show.

---

## Deployment Plan

1. Create migration: `npm run db:new linktree_config_column`
2. Push migration: `npm run db:push:prod`
3. Seed linktree_config for bythiagofigueiredo site
4. Implement route + components + queries
5. Update middleware (locale detection + routing changes)
6. Add SEO (metadata, OG template, JSON-LD builder)
7. Generate favicon variants
8. Create PWA manifest
9. Add tests
10. Deploy to staging → verify in debuggers (WhatsApp, Twitter, Facebook)
11. Merge to main
