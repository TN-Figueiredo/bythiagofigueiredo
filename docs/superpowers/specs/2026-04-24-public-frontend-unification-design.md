# Public Frontend Unification — Design Spec

**Date:** 2026-04-24
**Status:** Draft
**Sprint:** Public Frontend Unification
**Baseline audit score:** 58/100
**Target audit score:** 98/100

## 1. Overview

The public-facing blog, campaigns, newsletter archive, and contact pages are structurally disconnected from each other and from the Pinboard design system that powers the homepage. Blog routes sit outside the `(public)` route group, missing the shared layout (CookieBanner, JSON-LD root nodes, PinboardHeader/Footer). Blog pages render vanilla HTML with zero visual styling. Four content types use four different visual patterns. Hardcoded pt-BR strings leak into English locales. `@tn-figueiredo/cms-reader` (10+ reading-UX components) is published but not integrated.

### Goals

1. **Route unification** — move all public content routes into `app/(public)/` so they inherit the Pinboard shell (header, footer, skip-to-content, LGPD banner, JSON-LD root)
2. **Visual consistency** — apply Pinboard design language (Fraunces, JetBrains Mono, PaperCard, Tape, warm palette) to blog index, blog detail, campaigns, and newsletter archive
3. **cms-reader integration** — wire `@tn-figueiredo/cms-reader@0.1.0` components (ReadingProgressBar, InteractiveToc, ShareButtons, BackToTop, AuthorCard, Breadcrumbs, LinkedH2/H3) into blog detail
4. **Content discovery** — add RSS feed, related posts, prev/next navigation
5. **i18n completeness** — move all UI strings to `locales/{en,pt-BR}.json`, fix homepage hardcoded `locale="en"`
6. **Accessibility** — `<article lang>`, `<time datetime>`, `<nav aria-label>`, `aria-current`, focus management on TOC popover, `alt` on images

### Non-goals

- Search (requires Algolia/Meilisearch)
- Category pages `/blog/category/[slug]` (v2)
- Tag system (requires migration + UI)
- Comments
- Reading analytics event persistence
- Authors table normalization (v1 hardcodes author identity)
- Breadcrumbs JSON-LD unification (keep dual system: cms-reader visual + composeGraph structured)

---

## 2. Current State

### Route layout

```
app/
├── (public)/           ← has layout.tsx with CookieBanner + JSON-LD root
│   ├── page.tsx        ← PinboardHome (header+footer inside component)
│   ├── components/     ← PinboardHeader, PinboardFooter, PaperCard, Tape, DualHero, etc.
│   ├── privacy/
│   ├── terms/
│   └── newsletters/    ← newsletter type listing
├── blog/               ← OUTSIDE (public) — no shell, no banner, no JSON-LD root
│   └── [locale]/
│       ├── page.tsx    ← vanilla <ul>/<li>, hardcoded pt-BR strings
│       └── [slug]/
│           └── page.tsx ← vanilla <article>, no cover image, no reading UX, 305 lines
├── campaigns/          ← OUTSIDE (public)
│   └── [locale]/[slug]/
├── newsletter/
│   ├── archive/[id]/   ← OUTSIDE (public), force-dynamic, minimal Tailwind
│   ├── confirm/        ← action route (stays outside)
│   └── subscribe/      ← action route (stays outside)
└── contact/            ← OUTSIDE (public), hardcoded pt-BR
```

### Problems by dimension

| Dimension | Score | Issue |
|---|---|---|
| Route structure | 45 | 4 content routes outside `(public)`, missing shared layout |
| Visual design | 20 | Blog pages are unstyled HTML, no cover images, no cards |
| cms-reader integration | 0 | Package exists, zero components used |
| Blog index | 30 | Plain `<ul>/<li>`, no cards, no category filter, no images |
| Blog detail | 35 | No progress bar, no TOC popover, no share, no author, no related posts |
| Campaigns | 50 | Functional but no Pinboard shell, no breadcrumbs visual |
| Newsletter archive | 40 | `force-dynamic`, no metadata factory, no pagination, minimal styling |
| i18n | 55 | Blog hardcodes pt-BR ("Nenhum post ainda", "min de leitura"), homepage hardcodes `locale="en"` |
| a11y | 60 | Missing `<article lang>`, `<time datetime>`, `aria-current` on pagination |
| Content discovery | 25 | No RSS, no related posts, no prev/next |
| Performance | 75 | No next/image on blog, force-dynamic on newsletter archive |
| SEO integration | 80 | Metadata factories exist but blog detail is 305 lines of mixed concerns |

---

## 3. Architecture

### 3.1 Target route structure

```
app/(public)/
├── layout.tsx              ← MODIFIED: extracts PinboardHeader + PinboardFooter from PinboardHome
├── page.tsx                ← homepage (unchanged, PinboardHome now thinner)
├── components/             ← existing Pinboard components
│   ├── visual-breadcrumbs.tsx  ← NEW: <nav> only, no JSON-LD script
│   └── blog-article-client.tsx ← NEW: 'use client' wrapper for ReaderProvider
├── blog/
│   └── [locale]/
│       ├── page.tsx        ← REWRITTEN: PaperCard grid + category filter + pagination
│       └── [slug]/
│           └── page.tsx    ← REWRITTEN: single-column + cms-reader UX (~60 lines)
├── campaigns/
│   └── [locale]/[slug]/
│       └── page.tsx        ← MOVED: inherits shell, add visual breadcrumbs
├── newsletter/
│   └── archive/
│       ├── page.tsx        ← NEW: paginated archive index
│       └── [id]/
│           └── page.tsx    ← MOVED: ISR, Pinboard styling, metadata factory
├── contact/
│   └── page.tsx            ← MOVED: inherits shell
├── privacy/                ← existing (already in (public))
├── terms/                  ← existing (already in (public))
├── feed.xml/
│   └── route.ts            ← NEW: RSS 2.0 feed
└── newsletters/            ← existing (already in (public))
```

Routes that stay outside `(public)`:
- `/newsletter/confirm/[token]` — server action confirmation
- `/newsletter/subscribe/` — form POST endpoint
- `/newsletter/consent.ts` — consent logic

### 3.2 Server/Client boundary

```
Server (RSC)                          Client ('use client')
─────────────────────────────────────────────────────────────
layout.tsx                            CookieBanner
  PinboardHeader                        CookieBannerTrigger
  PinboardFooter                        ThemeToggle
  JsonLdScript
  CookieBannerProvider*

blog/[locale]/page.tsx                CategoryFilter (pills + URL param)
  PaperCard (server)
  Tape (server)
  VisualBreadcrumbs (server)

blog/[locale]/[slug]/page.tsx         BlogArticleClient
  loadPost() → data                    ReaderProvider
  MdxRunner (SSR)                       ReadingProgressBar
  VisualBreadcrumbs (server)            InteractiveToc (popover)
  AuthorCard (server)                   ShareButtons
                                        BackToTop
                                        LinkedH2/LinkedH3 (via registry)

campaigns/[locale]/[slug]/page.tsx    SubmitForm (existing)
  VisualBreadcrumbs (server)

newsletter/archive/[id]/page.tsx      (none)
  VisualBreadcrumbs (server)
```

*CookieBannerProvider is a client component already mounted in layout.tsx.

### 3.3 Pinboard design tokens

Pinboard CSS vars are already extracted to `globals.css` (lines 101-133) as `:root`/`[data-theme="dark"]` and `[data-theme="light"]` selectors. The DualHero.tsx inline JS color objects (lines 25-37) are derived from these same values. No extraction needed — cms-reader CSS override file maps directly to existing `--pb-*` vars.

---

## 4. Track 1: Route Restructuring + Layout Extraction

### 4.1 Layout modification

Current state: `PinboardHome` renders `PinboardHeader` + `main#main-content` + `PinboardFooter` internally. The `(public)/layout.tsx` only renders `CookieBannerProvider` + `JsonLdScript` + `children`.

Target state: `(public)/layout.tsx` renders the full shell. `PinboardHome` becomes a content-only component.

```tsx
// app/(public)/layout.tsx — after modification
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  const ctx = await tryGetSiteContext()
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
  const t = TRANSLATIONS[locale]

  // ... existing SEO config + JSON-LD root nodes (unchanged) ...

  return (
    <CookieBannerProvider>
      <div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)' }}>
        {rootNodes.length > 0 && <JsonLdScript graph={composeGraph(rootNodes)} />}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-pb-accent text-white px-4 py-2 rounded z-50">
          {locale === 'pt-BR' ? 'Ir para o conteudo' : 'Skip to content'}
        </a>
        <PinboardHeader locale={locale} currentTheme={theme} t={t} />
        <main id="main-content">
          {children}
        </main>
        <PinboardFooter locale={locale} t={t} />
        {lgpdBannerEnabled && (
          <>
            <CookieBanner />
            <CookieBannerTrigger />
          </>
        )}
      </div>
    </CookieBannerProvider>
  )
}
```

`PinboardHome` strips its own header/footer/skip-to-content/min-h-screen wrapper, rendering only DualHero + ChannelStrip + UnifiedFeed + NewsletterInline sections.

### 4.2 Route moves

Each moved route keeps its existing `page.tsx` content but adjusts import paths. Redirect rules are unnecessary — Next.js route groups `(public)` are path-transparent (`/blog/en` stays `/blog/en`).

| Current path | New path | Import path changes |
|---|---|---|
| `app/blog/[locale]/page.tsx` | `app/(public)/blog/[locale]/page.tsx` | relative imports shift up by 1 segment |
| `app/blog/[locale]/[slug]/page.tsx` | `app/(public)/blog/[locale]/[slug]/page.tsx` | same |
| `app/campaigns/[locale]/[slug]/page.tsx` | `app/(public)/campaigns/[locale]/[slug]/page.tsx` | same |
| `app/newsletter/archive/[id]/page.tsx` | `app/(public)/newsletter/archive/[id]/page.tsx` | same |
| `app/contact/page.tsx` | `app/(public)/contact/page.tsx` | same |

Files that stay in place:
- `app/newsletter/confirm/` — action endpoint
- `app/newsletter/subscribe/` — form POST
- `app/newsletter/consent.ts` — utility

### 4.3 Middleware impact

The middleware matcher `/((?!_next/static|...).*` catches all routes regardless of route group. No matcher changes needed. `x-site-id` / `x-org-id` headers propagate identically since URL paths are unchanged.

### 4.4 E2E test impact

Existing Playwright specs reference URL paths (`/blog/en`, `/campaigns/pt-BR/slug`, `/contact`). Since `(public)` is a route group (invisible in URLs), all existing URLs remain valid. No spec changes needed for the route move itself.

---

## 5. Track 2: cms-reader Integration

### 5.1 Package installation

```bash
npm install @tn-figueiredo/cms-reader@0.1.0 --workspace=apps/web --save-exact
```

Add to `transpilePackages` in `next.config.ts`:

```typescript
transpilePackages: [
  '@tn-figueiredo/cms',
  '@tn-figueiredo/newsletter',
  '@tn-figueiredo/newsletter-admin',
  '@tn-figueiredo/cms-admin',
  '@tn-figueiredo/cms-reader',   // NEW
],
```

### 5.2 CSS var bridge

New file `apps/web/src/styles/reader-pinboard.css`:

```css
@import '@tn-figueiredo/cms-reader/styles';

/*
 * Map cms-reader CSS vars to Pinboard design tokens.
 * cms-reader defines --reader-* defaults; overriding here
 * unifies the visual language without forking the package.
 */
:root,
[data-theme="dark"] {
  --reader-bg:           var(--pb-bg);
  --reader-surface:      var(--pb-paper);
  --reader-text:         var(--pb-ink);
  --reader-text-muted:   var(--pb-muted);
  --reader-text-faint:   var(--pb-faint);
  --reader-border:       var(--pb-line);
  --reader-accent:       var(--pb-accent);
  --reader-link:         var(--pb-accent);
  --reader-link-hover:   var(--pb-accent);
  --reader-code-bg:      var(--pb-paper2);
  --reader-code-text:    var(--pb-ink);
  --reader-heading:      var(--pb-ink);
  --reader-font-serif:   var(--font-fraunces-var);
  --reader-font-mono:    var(--font-jetbrains-var);
  --reader-font-body:    'Inter', ui-sans-serif, system-ui, sans-serif;
  --reader-progress-bg:  var(--pb-accent);
  --reader-toc-active:   var(--pb-accent);
  --reader-share-bg:     var(--pb-paper);
  --reader-share-hover:  var(--pb-paper2);
  --reader-author-bg:    var(--pb-paper);
  --reader-breadcrumb-separator: var(--pb-muted);
  --reader-content-max-width: 720px;
}

[data-theme="light"] {
  --reader-bg:           var(--pb-bg);
  --reader-surface:      var(--pb-paper);
  --reader-text:         var(--pb-ink);
  --reader-text-muted:   var(--pb-muted);
  --reader-text-faint:   var(--pb-faint);
  --reader-border:       var(--pb-line);
  --reader-accent:       var(--pb-accent);
  --reader-link:         var(--pb-accent);
  --reader-link-hover:   var(--pb-accent);
  --reader-code-bg:      var(--pb-paper2);
  --reader-code-text:    var(--pb-ink);
  --reader-heading:      var(--pb-ink);
  --reader-progress-bg:  var(--pb-accent);
  --reader-toc-active:   var(--pb-accent);
  --reader-share-bg:     var(--pb-paper);
  --reader-share-hover:  var(--pb-paper2);
  --reader-author-bg:    var(--pb-paper);
}
```

Import in `globals.css` at the top alongside existing package style imports:

```css
@import '@tn-figueiredo/cms-ui/styles.css';
@import '@tn-figueiredo/cms-admin/styles.css';
@import '../styles/reader-pinboard.css';         /* NEW */
@import "tailwindcss";
```

### 5.3 Reader adapter

New file `apps/web/lib/cms/reader-adapter.ts`:

```typescript
import type { ReaderArticle, ReaderAuthor } from '@tn-figueiredo/cms-reader'

// v1: hardcoded author identity (single-author blog).
// v2: normalize from `authors` table when it gains user_id FK.
const AUTHOR_V1: ReaderAuthor = {
  name: 'Thiago Figueiredo',
  avatarUrl: '/identity/thiago.jpg',
  role: 'Software Engineer',
}

export interface PostTranslationInput {
  title: string
  slug: string
  locale: string
  excerpt: string | null
  content_toc: Array<{ slug: string; text: string; depth: number }>
  reading_time_min: number
  published_at: string | null
  category?: string | null
  cover_image_url?: string | null
}

export function toReaderArticle(
  post: PostTranslationInput,
  siteUrl: string,
): ReaderArticle {
  return {
    title: post.title,
    slug: post.slug,
    locale: post.locale,
    excerpt: post.excerpt,
    toc: post.content_toc,
    readingTimeMin: post.reading_time_min,
    publishedAt: post.published_at,
    category: post.category ?? null,
    coverImageUrl: post.cover_image_url ?? null,
    author: AUTHOR_V1,
    url: `${siteUrl}/blog/${post.locale}/${encodeURIComponent(post.slug)}`,
    shareTitle: post.title,
  }
}
```

### 5.4 Components used per page

**Blog detail — `app/(public)/blog/[locale]/[slug]/page.tsx`:**

| Component | Source | Rendering | Purpose |
|---|---|---|---|
| `ReadingProgressBar` | cms-reader/client | Client | Scroll progress bar at top of viewport |
| `InteractiveToc` | cms-reader/client | Client | Floating popover (fixed bottom-right button) |
| `ShareButtons` | cms-reader/client | Client | Share links at header + footer of article |
| `BackToTop` | cms-reader/client | Client | Fixed button, appears after 300px scroll |
| `LinkedH2` / `LinkedH3` | cms-reader/client | Client (hydrated via MdxRunner) | Anchor links on headings |
| `AuthorCard` | cms-reader | Server | Author bio card at end of article |
| `VisualBreadcrumbs` | local component | Server | Visual-only `<nav>` breadcrumb trail |

**All content pages:**

| Component | Pages |
|---|---|
| `VisualBreadcrumbs` | Blog index, blog detail, campaigns, newsletter archive, contact |

### 5.5 Visual breadcrumbs (conflict resolution)

cms-reader's `Breadcrumbs` component emits both a `<nav>` and an inline `<script type="application/ld+json">`. The blog detail page already emits BreadcrumbList JSON-LD via `composeGraph`. To avoid duplicate structured data, create a local wrapper.

New file `apps/web/src/app/(public)/components/visual-breadcrumbs.tsx`:

```tsx
import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  items: BreadcrumbItem[]
  className?: string
}

export function VisualBreadcrumbs({ items, className = '' }: Props) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm font-mono text-pb-muted ${className}`}>
      <ol className="flex flex-wrap items-center gap-1 list-none p-0 m-0">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="text-pb-faint">/</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-pb-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-pb-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

### 5.6 LinkedH2/H3 + MdxRunner compatibility

MdxRunner renders server-side via `mdx.run()`, but the `components` prop can include client components. React serializes them as client references during SSR and hydrates on the client. `LinkedH2`/`LinkedH3` from cms-reader use `useEmitReaderEvent` which requires `ReaderProvider` in the tree.

Strategy: wrap the article content in `BlogArticleClient` (a `'use client'` component) that mounts `ReaderProvider` and renders `children` (the server-rendered MdxRunner output). The client components in the registry hydrate inside this provider.

New file `apps/web/src/app/(public)/components/blog-article-client.tsx`:

```tsx
'use client'

import { ReaderProvider } from '@tn-figueiredo/cms-reader/client'
import { ReadingProgressBar } from '@tn-figueiredo/cms-reader/client'
import { InteractiveToc } from '@tn-figueiredo/cms-reader/client'
import { ShareButtons } from '@tn-figueiredo/cms-reader/client'
import { BackToTop } from '@tn-figueiredo/cms-reader/client'
import type { ReaderArticle } from '@tn-figueiredo/cms-reader'
import type { ReactNode } from 'react'

interface Props {
  article: ReaderArticle
  children: ReactNode
}

export function BlogArticleClient({ article, children }: Props) {
  return (
    <ReaderProvider article={article}>
      <ReadingProgressBar />
      <article lang={article.locale} className="mx-auto" style={{ maxWidth: 720, padding: '32px 24px' }}>
        {children}
      </article>
      <InteractiveToc variant="popover" />
      <BackToTop />
    </ReaderProvider>
  )
}
```

Registry update in `apps/web/lib/cms/registry.ts`:

```typescript
import { defaultComponents, type ComponentRegistry } from '@tn-figueiredo/cms'
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'
import { LinkedH2, LinkedH3 } from '@tn-figueiredo/cms-reader/client'

export const blogRegistry: ComponentRegistry = {
  ...defaultComponents,
  CodeBlock: ShikiCodeBlock as ComponentRegistry[string],
  h2: LinkedH2 as ComponentRegistry[string],
  h3: LinkedH3 as ComponentRegistry[string],
}
```

**Fallback plan:** If `LinkedH2`/`LinkedH3` fail to hydrate inside MdxRunner (serialization incompatibility), build lightweight heading-link components locally without ReaderProvider dependency:

```tsx
'use client'
function LinkedHeading({ level, id, children }: { level: 2 | 3; id?: string; children: ReactNode }) {
  const Tag = `h${level}` as const
  return (
    <Tag id={id} className="group relative scroll-mt-20">
      {children}
      {id && (
        <a href={`#${id}`} aria-hidden="true" className="absolute -left-6 opacity-0 group-hover:opacity-100 text-pb-accent transition-opacity">
          #
        </a>
      )}
    </Tag>
  )
}
```

---

## 6. Track 3: Blog Index Redesign

### 6.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  VisualBreadcrumbs: Home / Blog                     │
│  h1: "Blog" (Fraunces, --pb-ink)                    │
│  LocaleSwitcher (existing)                          │
│                                                     │
│  CategoryFilter pills: All | Engineering | ...      │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ PaperCard │ │ PaperCard │ │ PaperCard │  3-col   │
│  │  Tape     │ │  Tape     │ │  Tape     │  desktop │
│  │  Cover    │ │  Cover    │ │  Cover    │          │
│  │  Badge    │ │  Badge    │ │  Badge    │          │
│  │  Title    │ │  Title    │ │  Title    │          │
│  │  Excerpt  │ │  Excerpt  │ │  Excerpt  │          │
│  │  Meta     │ │  Meta     │ │  Meta     │          │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  Pagination: ‹ 1 [2] 3 4 ›                         │
└─────────────────────────────────────────────────────┘
```

Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8`

### 6.2 Card anatomy

Each post card reuses `PaperCard` + `Tape` from the homepage:

```tsx
<PaperCard index={i}>
  <Tape variant={i % 2 === 0 ? 'tape' : 'tape2'} className="-top-2.5 left-[18%]" rotate={-4} />
  <Link href={`/blog/${locale}/${post.translation.slug}`} className="block no-underline">
    {/* Cover */}
    <div className="aspect-video overflow-hidden relative" style={{ background: coverGradient(post.category, isDark) }}>
      {post.cover_image_url ? (
        <Image src={post.cover_image_url} alt="" fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
      ) : null}
      <span className="absolute top-2 left-2 font-mono text-[10px] tracking-widest uppercase font-semibold px-2 py-0.5" style={{ background: 'var(--pb-ink)', color: 'var(--pb-paper)' }}>
        {post.category ?? t['feed.type.post']}
      </span>
    </div>
    {/* Body */}
    <div className="p-5">
      <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-pb-muted">
        <time dateTime={post.published_at}>{formatDate(post.published_at, locale)}</time>
        <span aria-hidden="true">&middot;</span>
        <span>{post.translation.reading_time_min} {t['blog.readMin']}</span>
      </div>
      <h2 className="font-fraunces text-pb-ink text-xl leading-tight tracking-tight font-medium m-0">
        {post.translation.title}
      </h2>
      {post.translation.excerpt && (
        <p className="text-sm text-pb-muted mt-2 line-clamp-2">{post.translation.excerpt}</p>
      )}
    </div>
  </Link>
</PaperCard>
```

### 6.3 Category filter

Client component with pills. Uses `searchParams` for shareable URLs.

```tsx
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  categories: string[]
  current: string | null
  allLabel: string
}

export function CategoryFilter({ categories, current, allLabel }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function select(cat: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) params.set('category', cat)
    else params.delete('category')
    params.delete('page') // reset pagination on filter change
    router.push(`?${params.toString()}`)
  }

  return (
    <div role="group" aria-label="Category filter" className="flex flex-wrap gap-2 mb-8">
      <button
        onClick={() => select(null)}
        aria-pressed={!current}
        className={`font-mono text-xs px-3 py-1.5 rounded transition-colors ${
          !current ? 'bg-pb-accent text-white' : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
        }`}
      >
        {allLabel}
      </button>
      {categories.map(cat => (
        <button
          key={cat}
          onClick={() => select(cat)}
          aria-pressed={current === cat}
          className={`font-mono text-xs px-3 py-1.5 rounded transition-colors ${
            current === cat ? 'bg-pb-accent text-white' : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
```

The server page passes `searchParams.category` to the `postRepo().list()` call as an additional filter.

### 6.4 Pagination

```tsx
<nav role="navigation" aria-label={t['pagination.label']}>
  <ol className="flex items-center gap-2 list-none p-0 justify-center font-mono text-sm">
    {page > 1 && (
      <li><Link href={buildPageUrl(page - 1)} className="text-pb-accent">{t['pagination.prev']}</Link></li>
    )}
    {pageNumbers.map(n => (
      <li key={n}>
        <Link
          href={buildPageUrl(n)}
          aria-current={n === page ? 'page' : undefined}
          className={n === page ? 'bg-pb-accent text-white px-2.5 py-1 rounded' : 'text-pb-muted hover:text-pb-ink px-2.5 py-1'}
        >
          {n}
        </Link>
      </li>
    ))}
    {hasMore && (
      <li><Link href={buildPageUrl(page + 1)} className="text-pb-accent">{t['pagination.next']}</Link></li>
    )}
  </ol>
</nav>
```

Pagination helper derives `pageNumbers` from `totalCount` (requires adding count to `postRepo().list()` return or a separate count query).

---

## 7. Track 4: Blog Detail — Single Column + cms-reader UX

### 7.1 Page structure (top to bottom)

```
ReadingProgressBar (fixed viewport top)
─────────────────────────────────────────
VisualBreadcrumbs: Home / Blog / {title}
Cover Image (next/image, aspect-video, gradient fallback)
Category Badge + Date + Reading Time + LocaleSwitcher
h1 Title (Fraunces, clamp 28px–42px)
Excerpt (text-pb-muted)
ShareButtons (inline, horizontal)
─────────────────────────────────────────
article[lang={locale}]
  MdxRunner + blogRegistry (LinkedH2/H3)
─────────────────────────────────────────
ShareButtons (inline, horizontal)
AuthorCard (name, avatar, role)
Related Posts (max 3, PaperCard grid)
Prev/Next Navigation
InteractiveToc (floating popover, bottom-right)
BackToTop (fixed button)
```

Content column: `max-width: 720px; margin: 0 auto; padding: 32px 24px`.

### 7.2 File decomposition

The current 305-line `page.tsx` is split into:

| File | Responsibility | Lines (est.) |
|---|---|---|
| `app/(public)/blog/[locale]/[slug]/page.tsx` | Server component: data loading, metadata, JSX composition | ~60 |
| `lib/blog/load-post.ts` | `loadPostWithLocales()`, `loadSeoExtrasByLocale()`, `toTranslationInputs()` | ~80 |
| `lib/blog/build-detail-graph.ts` | `buildDetailGraph()`, `buildExtraNodesFromSeoExtras()`, `parseDateOrNull()` | ~60 |
| `lib/blog/related-posts.ts` | `getRelatedPosts()` | ~30 |
| `lib/blog/adjacent-posts.ts` | `getAdjacentPosts()` | ~25 |
| `lib/cms/reader-adapter.ts` | `toReaderArticle()` | ~35 |
| `app/(public)/components/blog-article-client.tsx` | Client wrapper with ReaderProvider + cms-reader components | ~30 |

### 7.3 Refactored page.tsx (~60 lines)

```tsx
import { notFound } from 'next/navigation'
import { MdxRunner } from '@tn-figueiredo/cms'
import { AuthorCard } from '@tn-figueiredo/cms-reader'
import Image from 'next/image'
import { loadPostWithLocales } from '@/lib/blog/load-post'
import { buildDetailGraph } from '@/lib/blog/build-detail-graph'
import { toReaderArticle, AUTHOR_V1 } from '@/lib/cms/reader-adapter'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { getAdjacentPosts } from '@/lib/blog/adjacent-posts'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { blogRegistry } from '@/lib/cms/registry'
import { BlogArticleClient } from '../../components/blog-article-client'
import { VisualBreadcrumbs } from '../../components/visual-breadcrumbs'
import { ShareButtons } from '@tn-figueiredo/cms-reader/client'
import { coverGradient } from '@/lib/home/cover-image'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

export const revalidate = 3600

export default async function BlogDetailPage({ params }) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { tx, compiledSource, translations, config } = loaded

  const article = toReaderArticle(tx, config?.siteUrl ?? '')
  const [related, adjacent] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, loaded.post.id, tx.category, 3),
    getAdjacentPosts(ctx.siteId, locale, tx.published_at),
  ])
  const graph = buildDetailGraph(config, loaded, locale, slug)

  return (
    <>
      {graph && <JsonLdScript graph={graph} />}
      <VisualBreadcrumbs items={[
        { label: 'Home', href: '/' },
        { label: 'Blog', href: `/blog/${locale}` },
        { label: tx.title },
      ]} />
      {/* Cover, meta, title, excerpt, ShareButtons */}
      {/* ... */}
      <BlogArticleClient article={article}>
        <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
      </BlogArticleClient>
      {/* ShareButtons, AuthorCard, Related Posts, Prev/Next */}
    </>
  )
}
```

### 7.4 Related posts

New file `apps/web/lib/blog/related-posts.ts`:

```typescript
import { postRepo } from '@/lib/cms/repositories'

export interface RelatedPost {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  cover_image_url: string | null
  reading_time_min: number
  published_at: string | null
}

export async function getRelatedPosts(
  siteId: string,
  locale: string,
  currentPostId: string,
  category: string | null,
  limit = 3,
): Promise<RelatedPost[]> {
  // 1. Same category, exclude current post
  if (category) {
    const byCategory = await postRepo().list({
      siteId,
      locale,
      status: 'published',
      category,
      page: 1,
      perPage: limit + 1, // +1 to account for filtering out current
    })
    const filtered = byCategory.filter(p => p.id !== currentPostId).slice(0, limit)
    if (filtered.length >= 2) return filtered.map(mapToRelated)
  }

  // 2. Fallback: latest posts excluding current
  const latest = await postRepo().list({
    siteId,
    locale,
    status: 'published',
    page: 1,
    perPage: limit + 1,
  })
  return latest.filter(p => p.id !== currentPostId).slice(0, limit).map(mapToRelated)
}
```

### 7.5 Adjacent posts (prev/next)

New file `apps/web/lib/blog/adjacent-posts.ts`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AdjacentPost {
  slug: string
  title: string
  locale: string
}

export async function getAdjacentPosts(
  siteId: string,
  locale: string,
  publishedAt: string | null,
): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> {
  if (!publishedAt) return { prev: null, next: null }
  const supabase = getSupabaseServiceClient()

  const [prevResult, nextResult] = await Promise.all([
    supabase
      .from('blog_translations')
      .select('slug, title, locale, blog_posts!inner(published_at, status, site_id)')
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .lt('blog_posts.published_at', publishedAt)
      .order('blog_posts(published_at)', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('blog_translations')
      .select('slug, title, locale, blog_posts!inner(published_at, status, site_id)')
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .gt('blog_posts.published_at', publishedAt)
      .order('blog_posts(published_at)', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    prev: prevResult.data ? { slug: prevResult.data.slug, title: prevResult.data.title, locale } : null,
    next: nextResult.data ? { slug: nextResult.data.slug, title: nextResult.data.title, locale } : null,
  }
}
```

---

## 8. Track 5: Campaigns + Newsletter Archive

### 8.1 Campaigns

Minimal changes. The page moves to `app/(public)/campaigns/` and inherits the Pinboard shell (header/footer/banner). Additions:

1. `VisualBreadcrumbs` at the top: `Home / Campaigns / {title}`
2. Wrap content sections in `<div className="mx-auto" style={{ maxWidth: 720, padding: '32px 24px' }}>` for consistent column width
3. Keep `ReactMarkdown` (campaigns use Markdown, not MDX)
4. Remove any standalone header/footer elements (now inherited from layout)

### 8.2 Newsletter archive

#### Archive index (NEW)

New file `app/(public)/newsletter/archive/page.tsx`:

Paginated list of sent editions. Uses PaperCard grid (2 cols desktop, 1 mobile).

```tsx
export const revalidate = 3600

export default async function NewsletterArchiveIndex({ searchParams }) {
  const sp = await searchParams
  const page = Number.parseInt(sp.page ?? '1', 10)
  const perPage = 20
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: editions, count } = await supabase
    .from('newsletter_editions')
    .select('id, subject, sent_at, preheader, newsletter_types(name, color)', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  // ... render PaperCard grid + pagination
}
```

#### Archive detail (MODIFIED)

Changes to existing `newsletter/archive/[id]/page.tsx`:

1. Move to `app/(public)/newsletter/archive/[id]/page.tsx`
2. Replace `force-dynamic` with `revalidate = 3600` (ISR)
3. Add full metadata via new `generateNewsletterMetadata` factory (see 8.3)
4. Add `VisualBreadcrumbs`: `Home / Newsletter / Archive / {subject}`
5. Add BreadcrumbList JSON-LD via `composeGraph`
6. Apply Pinboard styling: warm background, Fraunces heading, mono meta text
7. Remove the `dangerouslySetInnerHTML` safety concern note — content_html is from React Email server render (trusted)

### 8.3 Newsletter metadata factory

New function in `apps/web/lib/seo/page-metadata.ts`:

```typescript
export function generateNewsletterMetadata(
  config: SiteSeoConfig,
  edition: { subject: string; preheader: string | null; sentAt: string; id: string },
): Metadata {
  return {
    title: edition.subject,
    description: edition.preheader ?? `Newsletter edition from ${config.siteName}`,
    alternates: { canonical: `${config.siteUrl}/newsletter/archive/${edition.id}` },
    openGraph: {
      title: edition.subject,
      description: edition.preheader ?? undefined,
      type: 'article',
      publishedTime: edition.sentAt,
      siteName: config.siteName,
      url: `${config.siteUrl}/newsletter/archive/${edition.id}`,
    },
    twitter: {
      card: 'summary',
      site: config.twitterHandle ? `@${config.twitterHandle}` : undefined,
    },
  }
}
```

---

## 9. Track 6: i18n + Accessibility

### 9.1 New locale keys

Add to both `apps/web/src/locales/en.json` and `apps/web/src/locales/pt-BR.json`:

| Key | EN | PT-BR |
|---|---|---|
| `blog.title` | Blog | Blog |
| `blog.empty` | No posts yet. | Nenhum post ainda. |
| `blog.readMin` | min read | min de leitura |
| `blog.relatedPosts` | Related posts | Posts relacionados |
| `blog.allCategories` | All | Todos |
| `pagination.prev` | Previous | Anterior |
| `pagination.next` | Next | Proximo |
| `pagination.label` | Page navigation | Navegacao de paginas |
| `pagination.page` | Page {n} | Pagina {n} |
| `newsletter.archive.title` | Newsletter Archive | Arquivo da Newsletter |
| `newsletter.archive.empty` | No editions published yet. | Nenhuma edicao publicada ainda. |
| `nav.post` | Post | Post |
| `nav.older` | Older post | Post anterior |
| `nav.newer` | Newer post | Proximo post |

### 9.2 Homepage locale fix

Current: `<PinboardHome locale="en" />` is hardcoded.

Fix in `app/(public)/page.tsx`:

```tsx
export default async function Home({ searchParams }: HomeProps) {
  const ctx = await tryGetSiteContext()
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
  // ...
  return <PinboardHome locale={locale} />
}
```

### 9.3 Accessibility checklist

| Element | Current | Target |
|---|---|---|
| Blog article wrapper | `<article>` | `<article lang={locale}>` |
| Published date | `<small>` plain text | `<time dateTime={iso}>` formatted text |
| Blog index pagination | `<nav>` no label | `<nav role="navigation" aria-label={t['pagination.label']}>` |
| Pagination active page | no indicator | `aria-current="page"` |
| Locale switcher current | `aria-current="true"` | `aria-current="page"` (semantic correction) |
| Cover images | no alt | `alt=""` (decorative) or `alt={title}` (informative) |
| TOC popover | sidebar | floating popover with focus trap on open, Escape to close |
| Skip to content | in PinboardHome only | in layout.tsx (all public pages) |
| Category filter | none | `role="group" aria-label="Category filter"` + `aria-pressed` on buttons |

---

## 10. Track 7: Content Discovery + Performance

### 10.1 RSS feed

New file `apps/web/src/app/(public)/feed.xml/route.ts`:

```typescript
import { getSiteContext } from '@/lib/cms/site-context'
import { postRepo } from '@/lib/cms/repositories'

export const revalidate = 3600

export async function GET() {
  const ctx = await getSiteContext()
  const siteUrl = `https://${ctx.primaryDomain}`
  const locale = ctx.defaultLocale ?? 'en'

  const posts = await postRepo().list({
    siteId: ctx.siteId,
    locale,
    status: 'published',
    page: 1,
    perPage: 50,
  })

  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.translation.title}]]></title>
      <link>${siteUrl}/blog/${locale}/${encodeURIComponent(p.translation.slug)}</link>
      <guid isPermaLink="true">${siteUrl}/blog/${locale}/${encodeURIComponent(p.translation.slug)}</guid>
      <pubDate>${new Date(p.published_at ?? p.updated_at).toUTCString()}</pubDate>
      <description><![CDATA[${p.translation.excerpt ?? ''}]]></description>
    </item>`).join('')

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${ctx.siteName ?? 'Blog'}</title>
    <link>${siteUrl}/blog/${locale}</link>
    <description>Latest posts</description>
    <language>${locale}</language>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  })
}
```

RSS discovery link: add to root metadata in `generateRootMetadata`:

```typescript
alternates: {
  // ...existing,
  types: { 'application/rss+xml': '/feed.xml' },
},
```

Also add RSS link in `PinboardFooter`:

```tsx
<a href="/feed.xml" className="hover:text-pb-ink transition-colors" aria-label="RSS Feed">RSS</a>
```

### 10.2 Query consolidation

Current blog detail makes 3 sequential queries:
1. `postRepo().getBySlug()` — translation by slug
2. `postRepo().getById()` — all translations for locale switcher
3. `loadSeoExtrasByLocale()` — seo_extras from blog_translations

Consolidation: merge (1) + (2) into a single `getBySlug` that returns all translations (not just the matched one). This requires either modifying the repo method or adding a new `getBySlugWithAllTranslations` variant. Query (3) stays separate until `cms@0.3.0` exposes `seo_extras` on PostTranslation.

Related + adjacent posts run in `Promise.all` with the main fetch to avoid waterfalls:

```typescript
const [loaded, related, adjacent] = await Promise.all([
  loadPostWithLocales(ctx.siteId, locale, slug),
  getRelatedPosts(ctx.siteId, locale, postId, category, 3),
  getAdjacentPosts(ctx.siteId, locale, publishedAt),
])
```

Note: `postId` and `publishedAt` are unknown before `loadPostWithLocales` resolves. The actual pattern is a two-phase fetch:

```typescript
const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
if (!loaded) notFound()
const [related, adjacent] = await Promise.all([
  getRelatedPosts(ctx.siteId, locale, loaded.post.id, loaded.tx.category, 3),
  getAdjacentPosts(ctx.siteId, locale, loaded.tx.published_at),
])
```

### 10.3 next/image

Replace `<img>` and gradient-only covers with `next/image`:

```tsx
import Image from 'next/image'

{post.cover_image_url ? (
  <Image
    src={post.cover_image_url}
    alt=""
    fill
    className="object-cover"
    sizes="(max-width: 720px) 100vw, 720px"
    priority={/* first card or detail cover */}
  />
) : (
  <div style={{ background: coverGradient(category, isDark), width: '100%', height: '100%' }} />
)}
```

### 10.4 Newsletter archive ISR

Replace `export const dynamic = 'force-dynamic'` with `export const revalidate = 3600` on the archive detail page. Content is immutable after send — 1-hour ISR is generous.

---

## 11. Conflicts Resolved

### 11.1 Breadcrumbs dual JSON-LD

**Problem:** cms-reader `Breadcrumbs` emits inline `<script type="application/ld+json">`. Blog pages already emit BreadcrumbList JSON-LD via `composeGraph`.

**Resolution:** Build a local `VisualBreadcrumbs` component (section 5.5) that renders only the `<nav>` markup. No cms-reader Breadcrumbs import. Keep the existing `composeGraph` + `buildBreadcrumbNode` pipeline for structured data.

### 11.2 LinkedH2/H3 + MdxRunner

**Problem:** LinkedH2/H3 are `'use client'` components using `useEmitReaderEvent` (needs ReaderProvider). MdxRunner renders server-side.

**Resolution:** Wrap article content in `BlogArticleClient` (client boundary) which mounts ReaderProvider. MdxRunner's `run()` supports client component hydration via the components prop. The registry passes LinkedH2/H3 as component overrides for `h2`/`h3`. Server-side rendering produces the heading HTML; client-side hydration attaches the event emitters and anchor links.

**Key finding:** LinkedH2/H3 internally use `useOptionalEmit()` (not `useEmitReaderEvent()`), which returns `undefined` instead of throwing when no ReaderProvider exists. This means heading anchor links work even without the provider — events are simply skipped. ReaderProvider is needed only for reading analytics tracking, not for basic functionality.

**Fallback:** If hydration fails, replace with local lightweight heading-link components (section 5.6 fallback).

### 11.3 PinboardHome refactoring

**Problem:** PinboardHome currently renders its own header, footer, skip-to-content link, and `min-h-screen` wrapper. Moving these to layout.tsx would cause duplication on the homepage if PinboardHome is not updated.

**Resolution:** Extract shell elements from PinboardHome. The component becomes content-only (sections only). Layout handles the shell for all pages including homepage.

---

## 12. Feature Flags

No new feature flags. All changes are structural (route moves) and visual (Pinboard styling + cms-reader components). Rollback is a git revert. The existing `NEXT_PUBLIC_LGPD_BANNER_ENABLED` and `NEXT_PUBLIC_SEO_*` flags continue to gate their respective features across the newly unified routes.

---

## 13. Migration & Backward Compatibility

### 13.1 URL stability

Route groups in Next.js are path-transparent. Moving `app/blog/` to `app/(public)/blog/` does not change the public URL `/blog/en/my-post`. No redirects needed.

### 13.2 Import path updates

Moving files changes relative import paths. Each moved file needs import path adjustments. Use `@/` alias (mapped to `src/` or project root) to minimize churn. Files already using `@/lib/...` patterns need no changes.

### 13.3 Sitemap + robots

`app/sitemap.ts` and `app/robots.ts` live at the app root (outside route groups). They resolve hosts directly (not via middleware headers). No changes needed.

### 13.4 Middleware

The catch-all matcher `/((?!_next/static|...).*` matches based on URL paths, not filesystem paths. Route groups are invisible. No middleware changes.

### 13.5 OG routes

`app/og/blog/[locale]/[slug]/route.tsx` stays at its current location (outside `(public)`). OG routes are API-like endpoints, not user-facing pages. No changes needed.

---

## 14. Testing Strategy

### 14.1 Existing tests

All 777+ vitest tests must continue to pass. No test should break from route restructuring since tests import from `@/lib/*` paths (not relative filesystem paths that would change with route moves).

### 14.2 E2E tests

Existing Playwright specs navigate to URLs like `/blog/en`, `/campaigns/pt-BR/slug`, `/contact`. Since URLs are unchanged, existing specs should pass without modification. After the route move, run the full E2E suite to verify.

### 14.3 New unit tests

| Test file | Coverage |
|---|---|
| `test/lib/cms/reader-adapter.test.ts` | `toReaderArticle()` — maps PostTranslation fields correctly, handles null excerpt/category/cover |
| `test/lib/blog/related-posts.test.ts` | Category match returns up to 3, excludes current post, falls back to latest when < 2 category matches |
| `test/lib/blog/adjacent-posts.test.ts` | Returns prev/next by published_at, handles first/last post (null prev/next), handles null publishedAt |
| `test/app/feed-xml.test.ts` | RSS 2.0 valid XML, contains last 50 posts, correct Content-Type header, CDATA-wraps titles |

### 14.4 Manual verification

- Pinboard theme renders consistently on blog detail, blog index, campaigns, newsletter archive
- Dark/light theme toggle works on all content pages
- cms-reader ReadingProgressBar tracks scroll correctly
- InteractiveToc popover opens/closes, highlights active section
- ShareButtons generate correct share URLs
- Category filter updates URL and filters posts
- Pagination navigates correctly, `aria-current` marks active page
- Related posts show relevant content, fallback works
- Prev/next navigation links to correct posts
- RSS feed validates at W3C Feed Validation Service

---

## 15. File Inventory

### New files (12)

| File | Purpose |
|---|---|
| `apps/web/src/styles/reader-pinboard.css` | CSS var bridge: cms-reader tokens to Pinboard tokens |
| `apps/web/src/app/(public)/components/visual-breadcrumbs.tsx` | Visual-only breadcrumb nav (no JSON-LD) |
| `apps/web/src/app/(public)/components/blog-article-client.tsx` | Client wrapper: ReaderProvider + cms-reader UX components |
| `apps/web/lib/cms/reader-adapter.ts` | `toReaderArticle()` adapter |
| `apps/web/lib/blog/load-post.ts` | Extracted post loading logic from blog detail page |
| `apps/web/lib/blog/build-detail-graph.ts` | Extracted JSON-LD graph building from blog detail page |
| `apps/web/lib/blog/related-posts.ts` | `getRelatedPosts()` query |
| `apps/web/lib/blog/adjacent-posts.ts` | `getAdjacentPosts()` query |
| `apps/web/src/app/(public)/feed.xml/route.ts` | RSS 2.0 feed |
| `apps/web/src/app/(public)/newsletter/archive/page.tsx` | Paginated archive index |
| `apps/web/src/app/(public)/blog/[locale]/components/category-filter.tsx` | Client-side category filter pills |
| `apps/web/test/lib/cms/reader-adapter.test.ts` + 3 more test files | Unit tests |

### Modified files (14)

| File | Change |
|---|---|
| `apps/web/src/app/(public)/layout.tsx` | Add PinboardHeader, PinboardFooter, skip-to-content, locale/theme resolution |
| `apps/web/src/app/(public)/page.tsx` | Fix hardcoded `locale="en"` to `ctx.defaultLocale` |
| `apps/web/src/app/(public)/components/PinboardHome.tsx` | Remove header, footer, skip-to-content, min-h-screen wrapper |
| `apps/web/src/app/(public)/blog/[locale]/page.tsx` | Rewrite: PaperCard grid, category filter, pagination, i18n |
| `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx` | Rewrite: single-column layout, cms-reader integration, related+adjacent |
| `apps/web/src/app/(public)/campaigns/[locale]/[slug]/page.tsx` | Add VisualBreadcrumbs, Pinboard content width |
| `apps/web/src/app/(public)/newsletter/archive/[id]/page.tsx` | ISR, metadata factory, Pinboard styling, breadcrumbs |
| `apps/web/src/app/(public)/contact/page.tsx` | Inherits shell (remove standalone layout if any), add VisualBreadcrumbs |
| `apps/web/lib/cms/registry.ts` | Add LinkedH2/LinkedH3 to blogRegistry |
| `apps/web/lib/seo/page-metadata.ts` | Add `generateNewsletterMetadata` factory |
| `apps/web/src/locales/en.json` | Add 14 new keys |
| `apps/web/src/locales/pt-BR.json` | Add 14 new keys |
| `apps/web/src/app/globals.css` | Import reader-pinboard.css |
| `apps/web/next.config.ts` | Add `@tn-figueiredo/cms-reader` to transpilePackages |
| `apps/web/package.json` | Add `@tn-figueiredo/cms-reader@0.1.0` dependency |

### Deleted files (0)

Old route directories (`app/blog/`, `app/campaigns/`, `app/newsletter/archive/`, `app/contact/`) become empty after moves and are removed as directories. No content files are deleted — they are moved.

---

## 16. Implementation Order

The 7 tracks have dependencies. Recommended execution order:

```
Track 1 (Route Restructuring)      ← foundation, all other tracks depend on routes being in (public)
  ↓
Track 6a (i18n locale keys)        ← needed by Track 3 + 4 + 5
  ↓
Track 2 (cms-reader Integration)   ← package install + CSS bridge + adapter + registry
  ↓
Track 3 (Blog Index)               ← depends on Pinboard components + i18n keys
Track 4 (Blog Detail)              ← depends on cms-reader + adapter + registry
  ↓ (parallel with Track 3)
Track 5 (Campaigns + Newsletter)   ← depends on layout shell + VisualBreadcrumbs
  ↓
Track 7 (Discovery + Performance)  ← RSS, related/adjacent, next/image, ISR
  ↓
Track 6b (a11y hardening)          ← final pass across all modified pages
```

Tracks 3 and 4 can be parallelized. Track 5 can start once Track 1 is merged. Track 7 depends on Track 4 (related/adjacent posts are blog detail features).

---

## 17. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LinkedH2/H3 hydration failure inside MdxRunner | Medium | Low | Fallback to local heading-link components (section 5.6) |
| cms-reader@0.1.0 CSS vars differ from documented | Low | Medium | Inspect package source at install time, adjust reader-pinboard.css |
| PinboardHome refactoring breaks homepage layout | Low | High | Verify homepage renders identically before/after extraction |
| Category filter query performance on large post sets | Low | Low | postRepo().list already paginates; category is an indexed column |
| RSS XML injection via post titles | Low | Medium | CDATA wrapping prevents XML parsing issues; no user-generated content in channel metadata |
| Adjacent posts query on first/last post | None | None | `maybeSingle()` returns null gracefully |
