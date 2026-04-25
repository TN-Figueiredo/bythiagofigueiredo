# Public Frontend Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the public-facing frontend under the `(public)` route group with shared PinboardHeader/PinboardFooter layout, Pinboard design system on all content pages, cms-reader integration, RSS feed, and content discovery (related/adjacent posts). Blog index gets redesigned with PaperCard grid + pagination + category filters. Blog detail uses cms-reader typography. Newsletter archive and campaigns get Pinboard styling. All pages share a11y and i18n improvements.

**Branch:** `feat/public-frontend-unification` (from `staging`)

**Test baseline:** 777 vitest tests + 77 Playwright E2E tests must remain green throughout.

---

## Current State (2026-04-24)

| Artifact | Status |
|---|---|
| `app/(public)/layout.tsx` | Has SEO metadata + JSON-LD + LGPD banner. No PinboardHeader/PinboardFooter. |
| `app/(public)/page.tsx` | Renders `<PinboardHome locale="en">`. Locale hardcoded to `"en"`. |
| `app/(public)/components/PinboardHome.tsx` | Has its own PinboardHeader + PinboardFooter renders inside itself. |
| `app/blog/` | Lives OUTSIDE `(public)` group. No shared layout. Raw `<ul><li>` on index. 306-line detail page. |
| `app/campaigns/` | Lives OUTSIDE `(public)` group. No Pinboard styling. |
| `app/newsletter/archive/` | Lives OUTSIDE `(public)` group. `force-dynamic`, no ISR, no pagination, generic styling. |
| `app/contact/` | Lives OUTSIDE `(public)` group. Hardcoded pt-BR. |
| `@tn-figueiredo/cms-reader` | NOT installed. Package exists on GitHub Packages. |
| RSS feed | Does NOT exist. |
| Related/adjacent posts | NOT implemented. |
| Blog category filter | NOT implemented. |
| Blog numbered pagination | NOT implemented. |

---

## Architecture Decisions

1. **Route restructuring via move, not symlink.** Moving `blog/`, `campaigns/`, `newsletter/archive/`, `contact/` into `(public)/` makes them inherit the shared layout. Next.js route groups are filesystem-based.
2. **PinboardHeader/PinboardFooter in layout, not in page components.** Remove from `PinboardHome.tsx`, mount in `(public)/layout.tsx`. Every public page gets them automatically.
3. **Keep `newsletter/confirm/`, `newsletter/subscribe/`, `newsletter/consent.ts` outside `(public)`.** These are functional endpoints (confirm token, subscribe action) that should NOT render PinboardHeader/Footer.
4. **Blog detail extraction.** The 306-line `blog/[locale]/[slug]/page.tsx` is split into focused modules: `lib/blog/load-post.ts`, `lib/blog/build-detail-graph.ts`, `lib/blog/related-posts.ts`, `lib/blog/adjacent-posts.ts`.
5. **CSS vars already defined.** `--pb-*` vars are already in `globals.css`. No extraction needed from DualHero inline styles (those reference the CSS vars via `var(--pb-*)`). The `reader-pinboard.css` file will map `--pb-*` to whatever CSS custom properties `@tn-figueiredo/cms-reader` expects.
6. **Import paths use `@/` alias.** The tsconfig maps `@/*` to `./src/*` and `@/lib/*` to `./lib/*`. Moving files into `(public)/` does NOT change `@/` alias-based imports. Only relative imports (like `../../../../lib/cms/repositories`) will break and need updating.

---

## Track 1: Route Restructuring + Layout Extraction

### Task 1.1: Move `blog/` into `(public)/blog/`

**Files:**
- Move `apps/web/src/app/blog/page.tsx` to `apps/web/src/app/(public)/blog/page.tsx`
- Move `apps/web/src/app/blog/[locale]/page.tsx` to `apps/web/src/app/(public)/blog/[locale]/page.tsx`
- Move `apps/web/src/app/blog/[locale]/[slug]/page.tsx` to `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx`

**What:**
1. `git mv apps/web/src/app/blog apps/web/src/app/\(public\)/blog`
2. Fix relative imports in each moved file. All three files use `@/` alias imports (e.g., `@/lib/seo/config`, `@/lib/supabase/service`) which will continue to work. However, `blog/[locale]/page.tsx` has relative imports:
   - `../../../../lib/cms/repositories` — change to `@/lib/cms/repositories`
   - `../../../../lib/cms/site-context` — change to `@/lib/cms/site-context`
   - `../../../components/locale-switcher` — change to `@/components/locale-switcher` (verify this alias resolves; if not, use new relative path `../../../../components/locale-switcher`)
3. `blog/[locale]/[slug]/page.tsx` has relative imports:
   - `../../../../../lib/cms/repositories` — change to `@/lib/cms/repositories`
   - `../../../../../lib/cms/site-context` — change to `@/lib/cms/site-context`
   - `../../../../../lib/cms/registry` — change to `@/lib/cms/registry`
   - `../../../../components/locale-switcher` — change to `@/components/locale-switcher`
4. `blog/page.tsx` has relative import:
   - `../../../lib/cms/site-context` — change to `@/lib/cms/site-context`

**Verify:**
- `npx tsc --noEmit` in `apps/web` (typecheck passes)
- Routes `/blog`, `/blog/en`, `/blog/en/some-slug` still resolve (dev server check)

**Depends on:** nothing

---

### Task 1.2: Move `campaigns/` into `(public)/campaigns/`

**Files:**
- Move `apps/web/src/app/campaigns/[locale]/[slug]/page.tsx` to `apps/web/src/app/(public)/campaigns/[locale]/[slug]/page.tsx`
- Move `apps/web/src/app/campaigns/[locale]/[slug]/submit-form.tsx` to `apps/web/src/app/(public)/campaigns/[locale]/[slug]/submit-form.tsx`
- Move `apps/web/src/app/campaigns/[locale]/[slug]/extras-renderer.tsx` to `apps/web/src/app/(public)/campaigns/[locale]/[slug]/extras-renderer.tsx`

**What:**
1. `git mv apps/web/src/app/campaigns apps/web/src/app/\(public\)/campaigns`
2. Fix relative imports in `page.tsx`:
   - `../../../../../lib/supabase/service` — change to `@/lib/supabase/service`
   - `../../../../../lib/cms/site-context` — change to `@/lib/cms/site-context`
   - `./submit-form` and `./extras-renderer` — these stay as-is (co-located)
3. `submit-form.tsx` and `extras-renderer.tsx` — check their relative imports and fix if they reference `../../../../../lib/...` paths.

**Verify:**
- `npx tsc --noEmit` passes
- Route `/campaigns/en/some-slug` still resolves

**Depends on:** nothing

---

### Task 1.3: Move `newsletter/archive/` into `(public)/newsletter/archive/`

**Files:**
- Move `apps/web/src/app/newsletter/archive/page.tsx` to `apps/web/src/app/(public)/newsletter/archive/page.tsx`
- Move `apps/web/src/app/newsletter/archive/[id]/page.tsx` to `apps/web/src/app/(public)/newsletter/archive/[id]/page.tsx`

**What:**
1. Create target directory: `mkdir -p apps/web/src/app/\(public\)/newsletter/archive/\[id\]`
2. `git mv` each file. The `newsletter/confirm/`, `newsletter/subscribe/`, and `newsletter/consent.ts` files stay in their original location (they are functional endpoints, not content pages).
3. Fix imports: both archive files use only `@/` alias imports (`@/lib/supabase/service`, `@/lib/cms/site-context`), so no changes needed.

**Verify:**
- `npx tsc --noEmit` passes
- Routes `/newsletter/archive` and `/newsletter/archive/[id]` still resolve
- Routes `/newsletter/confirm/[token]`, `/newsletter/subscribe` still resolve (they were NOT moved)

**Depends on:** nothing

---

### Task 1.4: Move `contact/` into `(public)/contact/`

**Files:**
- Move `apps/web/src/app/contact/page.tsx` to `apps/web/src/app/(public)/contact/page.tsx`
- Move `apps/web/src/app/contact/actions.ts` to `apps/web/src/app/(public)/contact/actions.ts`
- Move `apps/web/src/app/contact/consent.ts` to `apps/web/src/app/(public)/contact/consent.ts`

**What:**
1. `git mv apps/web/src/app/contact apps/web/src/app/\(public\)/contact`
2. Fix relative imports in `page.tsx`:
   - `../../components/contact-form` — change to `@/components/contact-form` (verify alias resolves, the `@/*` alias maps to `./src/*`, so `@/components/contact-form` should resolve to `src/components/contact-form`)
   - `./actions` — stays as-is (co-located)
3. Check `actions.ts` for any relative imports that need fixing.

**Verify:**
- `npx tsc --noEmit` passes
- Route `/contact` still resolves

**Depends on:** nothing

---

### Task 1.5: Extract PinboardHeader/PinboardFooter from PinboardHome into (public)/layout.tsx

**Files:**
- Modify `apps/web/src/app/(public)/layout.tsx`
- Modify `apps/web/src/app/(public)/components/PinboardHome.tsx`

**What:**

1. **Modify `PinboardHome.tsx`:**
   - Remove the `PinboardHeader` import and render (`<PinboardHeader locale={locale} currentTheme={theme} t={t} />`)
   - Remove the `PinboardFooter` import and render (`<PinboardFooter locale={locale} t={t} />`)
   - Remove the skip-to-content `<a>` tag (will live in layout)
   - Keep the outer `<div className="min-h-screen" ...>` wrapper or remove it if layout handles the bg
   - Remove the `cookies()` call for theme detection (layout will handle it)
   - Keep: `DualHero`, `ChannelStrip`, `UnifiedFeed`, `NewsletterInline`, `<main id="main-content">`
   - The component becomes a content-only component that renders the homepage sections inside `<main>`

2. **Modify `(public)/layout.tsx`:**
   - Add `import { cookies } from 'next/headers'`
   - Add `import { PinboardHeader } from './components/PinboardHeader'`
   - Add `import { PinboardFooter } from './components/PinboardFooter'`
   - Read theme from cookies: `const cookieStore = await cookies(); const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'`
   - Resolve locale from site context: `const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'`
   - Load translations: import both locale JSON files, select by locale (same pattern as PinboardHome)
   - Render structure:
     ```tsx
     <div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)' }}>
       <a href="#main-content" className="sr-only focus:not-sr-only ...">
         {locale === 'pt-BR' ? 'Ir para o conteudo' : 'Skip to content'}
       </a>
       <PinboardHeader locale={locale} currentTheme={theme} t={t} />
       {/* existing JSON-LD + children */}
       {children}
       <PinboardFooter locale={locale} t={t} />
       {/* existing LGPD banner */}
     </div>
     ```
   - Keep all existing SEO/JSON-LD/LGPD logic unchanged

3. **Problem: locale for non-homepage pages.** The layout must resolve locale for PinboardHeader. Options:
   - Use `ctx.defaultLocale` from site context (already resolved in layout for SEO)
   - For `/pt-BR` routes, the URL segment determines locale, but layout doesn't have params access. Since PinboardHeader reads locale for nav link generation, using `defaultLocale` is acceptable (the header links are fixed per-site, not per-page-locale). The locale-switcher on content pages handles per-page locale.

4. **Problem: `<main>` tag duplication.** Currently PinboardHome renders its own `<main id="main-content">`. Blog index, blog detail, campaigns, contact, newsletter archive also render their own `<main>`. The layout should NOT wrap children in `<main>` — let each page own its `<main>` with the appropriate `id="main-content"` for skip-to-content. The `<a href="#main-content">` skip link in layout targets whichever `<main>` the child page renders.

**Verify:**
- `npx tsc --noEmit` passes
- Homepage still renders correctly with header + hero + footer
- Blog index `/blog/en` now has PinboardHeader + PinboardFooter wrapping it
- Contact `/contact` now has PinboardHeader + PinboardFooter wrapping it
- `npm run test:web` passes

**Depends on:** 1.1, 1.2, 1.3, 1.4 (all routes must be inside `(public)` first)

---

### Task 1.6: Update sitemap enumerator static routes

**Files:**
- Review `apps/web/lib/seo/enumerator.ts`

**What:**
The sitemap enumerator lists static routes: `/`, `/pt-BR`, `/privacy`, `/terms`, `/contact`. These route paths are unchanged by the `(public)` group (it's a virtual group, not a URL segment). Verify no changes are needed. Also consider adding `/newsletter/archive` and `/newsletters` to `STATIC_ROUTE_DEFS` if not already present.

Currently missing from `STATIC_ROUTE_DEFS`:
- `/newsletters` (the newsletters hub page)
- `/newsletter/archive` (the archive listing page)

Add them:
```typescript
{ path: '/newsletters', changeFrequency: 'weekly', priority: 0.5 },
{ path: '/newsletter/archive', changeFrequency: 'weekly', priority: 0.4 },
```

**Verify:**
- `npx tsc --noEmit` passes
- `npm run test:web` passes

**Depends on:** nothing

---

### Task 1.7: Update E2E tests for route structure

**Files:**
- Review `apps/web/e2e/tests/public/homepage.spec.ts`
- Review `apps/web/e2e/tests/public/contact-form.spec.ts`
- Review `apps/web/e2e/tests/public/newsletter.spec.ts`

**What:**
Route URLs did NOT change (route groups are virtual), so E2E tests should pass without modification. However, the homepage E2E test checks for `page.locator('main')` — with the layout change, `main` is now rendered by the child page, not PinboardHome. Verify PinboardHome still renders `<main id="main-content">`.

Run the E2E tests to verify:
```bash
cd apps/web && npx playwright test tests/public/ --reporter=list
```

If any test fails due to the layout restructuring, fix the test or the component.

**Verify:**
- All 3 public E2E spec files pass
- `npm run test:web` passes

**Depends on:** 1.5

---

### Task 1.8: Fix homepage locale from hardcoded "en" to site default

**Files:**
- Modify `apps/web/src/app/(public)/page.tsx`

**What:**
Currently: `<PinboardHome locale="en" />`. Change to read locale from site context:

```tsx
export default async function Home({ searchParams }: HomeProps) {
  const ctx = await tryGetSiteContext()
  const locale = (ctx?.defaultLocale ?? 'en') as 'en' | 'pt-BR'
  // ... rest unchanged, but use locale:
  return (
    <>
      {showInsufficientAccess && (...)}
      <PinboardHome locale={locale} />
    </>
  )
}
```

Note: `tryGetSiteContext` is already imported. Use `tryGetSiteContext()` (non-throwing) since the homepage can fall back.

**Verify:**
- `npx tsc --noEmit` passes
- Homepage still renders correctly

**Depends on:** 1.5

---

## Track 2: Pinboard CSS vars extraction + cms-reader integration

### Task 2.1: Install `@tn-figueiredo/cms-reader@0.1.0`

**Files:**
- Modify `apps/web/package.json`

**What:**
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm install @tn-figueiredo/cms-reader@0.1.0 -w apps/web --save-exact
```

After install, verify the package is pinned (no `^` prefix) in `package.json`.

**Verify:**
- `npm ls @tn-figueiredo/cms-reader` shows `0.1.0`
- Pre-commit hook pinning check passes

**Depends on:** nothing

---

### Task 2.2: Add `@tn-figueiredo/cms-reader` to transpilePackages

**Files:**
- Modify `apps/web/next.config.ts`

**What:**
Add `'@tn-figueiredo/cms-reader'` to the `transpilePackages` array:

```typescript
transpilePackages: ['@tn-figueiredo/cms', '@tn-figueiredo/newsletter', '@tn-figueiredo/newsletter-admin', '@tn-figueiredo/cms-admin', '@tn-figueiredo/cms-reader'],
```

**Verify:**
- `npx tsc --noEmit` passes
- `npm run build` does not fail on cms-reader import

**Depends on:** 2.1

---

### Task 2.3: Create reader-pinboard CSS bridge

**Files:**
- Create `apps/web/src/styles/reader-pinboard.css`
- Modify `apps/web/src/app/globals.css` (add import)

**What:**
1. Inspect `@tn-figueiredo/cms-reader` package to discover its CSS custom property names (e.g., `--reader-bg`, `--reader-text`, `--reader-heading-font`, `--reader-code-bg`, etc.). The exact property names depend on the package. If the package exports a `styles.css`, import it.

2. Create `apps/web/src/styles/reader-pinboard.css` that:
   - Imports cms-reader base styles (if the package ships a CSS file)
   - Maps `--pb-*` Pinboard vars to reader CSS vars. Example:
     ```css
     /* Reader <-> Pinboard bridge */
     .reader-pinboard {
       --reader-bg: var(--pb-bg);
       --reader-text: var(--pb-ink);
       --reader-text-secondary: var(--pb-muted);
       --reader-heading-font: var(--font-fraunces-var), serif;
       --reader-body-font: var(--font-sans), sans-serif;
       --reader-code-font: var(--font-jetbrains-var), monospace;
       --reader-code-bg: var(--pb-paper2);
       --reader-link: var(--pb-accent);
       --reader-border: var(--pb-line);
       --reader-blockquote-border: var(--pb-accent);
       /* ... additional mappings based on actual package API */
     }
     ```

3. Add to `globals.css` (after the existing `@import` lines):
   ```css
   @import '../styles/reader-pinboard.css';
   ```

**Note:** The exact CSS variable names MUST be verified against the `@tn-figueiredo/cms-reader` package source. If the package does not use CSS custom properties but instead uses CSS classes, the bridge approach will differ (wrapping with a Pinboard-themed class).

**Verify:**
- `npm run build` succeeds
- No CSS compilation errors

**Depends on:** 2.1, 2.2

---

### Task 2.4: Create reader adapter

**Files:**
- Create `apps/web/lib/cms/reader-adapter.ts`

**What:**
Create a function `toReaderArticle` that transforms a blog post + translation (as fetched from supabase) into whatever shape `@tn-figueiredo/cms-reader` expects:

```typescript
import type { ReaderArticle } from '@tn-figueiredo/cms-reader'

export function toReaderArticle(
  post: { id: string; cover_image_url: string | null; published_at: string | null; updated_at: string },
  tx: {
    title: string;
    slug: string;
    locale: string;
    excerpt: string | null;
    content_compiled: string | null;
    content_mdx: string;
    reading_time_min: number;
    content_toc: Array<{ slug: string; text: string; depth: number }>;
  },
): ReaderArticle {
  return {
    title: tx.title,
    excerpt: tx.excerpt,
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
    readingTimeMin: tx.reading_time_min,
    coverImageUrl: post.cover_image_url,
    toc: tx.content_toc,
    // ... map additional fields as required by ReaderArticle type
  }
}
```

The exact type mapping depends on `@tn-figueiredo/cms-reader`'s exported `ReaderArticle` interface. Inspect the package to determine the correct shape.

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** 2.1

---

### Task 2.5: Create visual breadcrumbs component

**Files:**
- Create `apps/web/src/app/(public)/components/visual-breadcrumbs.tsx`

**What:**
A nav-only breadcrumb component for visual navigation. JSON-LD breadcrumbs are already emitted by the SEO layer (via `buildBreadcrumbNode` in the page's `<JsonLdScript>`). This component is purely presentational:

```tsx
import Link from 'next/link'

type BreadcrumbItem = { label: string; href?: string }

type Props = {
  items: BreadcrumbItem[]
}

export function VisualBreadcrumbs({ items }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-mono text-xs text-pb-muted mb-4"
    >
      <ol className="flex items-center gap-1 flex-wrap">
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

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 2.6: Add linked headings to blog registry

**Files:**
- Modify `apps/web/lib/cms/registry.ts`

**What:**
Add `LinkedH2` and `LinkedH3` components to the blogRegistry so that MDX-rendered headings get anchor links (clickable heading IDs for deep-linking). If `@tn-figueiredo/cms-reader` exports heading components, use those. Otherwise, create simple wrappers:

```typescript
import { defaultComponents, type ComponentRegistry } from '@tn-figueiredo/cms'
import { ShikiCodeBlock } from '@tn-figueiredo/cms/code'

function LinkedHeading({ level, children, ...props }: { level: 2 | 3; children: React.ReactNode; id?: string; [k: string]: unknown }) {
  const Tag = `h${level}` as const
  const id = props.id
  return (
    <Tag {...props} className="group relative">
      {id && (
        <a href={`#${id}`} className="absolute -left-5 opacity-0 group-hover:opacity-100 text-pb-accent" aria-hidden="true">
          #
        </a>
      )}
      {children}
    </Tag>
  )
}

export const blogRegistry: ComponentRegistry = {
  ...defaultComponents,
  CodeBlock: ShikiCodeBlock as ComponentRegistry[string],
  h2: (props: Record<string, unknown>) => <LinkedHeading level={2} {...props} />,
  h3: (props: Record<string, unknown>) => <LinkedHeading level={3} {...props} />,
}
```

**Note:** If `@tn-figueiredo/cms-reader` exports `LinkedH2`/`LinkedH3` components, import those instead of creating local wrappers. Check the package exports first.

**Verify:**
- `npx tsc --noEmit` passes
- Blog posts render with anchor-linked headings on detail page

**Depends on:** 2.1

---

## Track 3: Blog Index Redesign

### Task 3.1: Add i18n keys for blog index

**Files:**
- Modify `apps/web/src/locales/en.json`
- Modify `apps/web/src/locales/pt-BR.json`

**What:**
Add new keys to both locale files:

English:
```json
"blog.title": "Blog",
"blog.empty": "No posts yet.",
"blog.readingTime": "{min} min read",
"blog.allCategories": "All",
"blog.pagination.prev": "Previous",
"blog.pagination.next": "Next",
"blog.pagination.page": "Page {current} of {total}",
"blog.breadcrumb.home": "Home",
"blog.breadcrumb.blog": "Blog"
```

Portuguese:
```json
"blog.title": "Blog",
"blog.empty": "Nenhum post ainda.",
"blog.readingTime": "{min} min de leitura",
"blog.allCategories": "Todos",
"blog.pagination.prev": "Anterior",
"blog.pagination.next": "Proximo",
"blog.pagination.page": "Pagina {current} de {total}",
"blog.breadcrumb.home": "Inicio",
"blog.breadcrumb.blog": "Blog"
```

**Verify:**
- JSON files are valid (no trailing commas, proper quoting)
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 3.2: Add category filter client component

**Files:**
- Create `apps/web/src/app/(public)/blog/[locale]/category-filter.tsx`

**What:**
A `'use client'` component that renders category pill buttons. Uses `useRouter` + `useSearchParams` to filter by category via URL search params:

```tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  categories: string[]
  currentCategory: string | null
  allLabel: string
}

export function CategoryFilter({ categories, currentCategory, allLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function selectCategory(cat: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) {
      params.set('category', cat)
    } else {
      params.delete('category')
    }
    params.delete('page') // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by category">
      <button
        onClick={() => selectCategory(null)}
        className={`font-mono text-xs px-3 py-1.5 rounded transition-colors ${
          !currentCategory
            ? 'bg-pb-accent text-white'
            : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
        }`}
        aria-pressed={!currentCategory}
      >
        {allLabel}
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => selectCategory(cat)}
          className={`font-mono text-xs px-3 py-1.5 rounded capitalize transition-colors ${
            currentCategory === cat
              ? 'bg-pb-accent text-white'
              : 'bg-pb-paper text-pb-muted hover:text-pb-ink'
          }`}
          aria-pressed={currentCategory === cat}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
```

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 3.3: Redesign blog index page

**Files:**
- Modify `apps/web/src/app/(public)/blog/[locale]/page.tsx`

**What:**
Replace the bare `<ul><li>` listing with a PaperCard grid, visual breadcrumbs, category filter, and numbered pagination.

1. Add imports:
   ```tsx
   import { cookies } from 'next/headers'
   import { PaperCard } from '../../components/PaperCard'
   import { Tape } from '../../components/Tape'
   import { VisualBreadcrumbs } from '../../components/visual-breadcrumbs'
   import { CategoryFilter } from './category-filter'
   import { coverGradient } from '@/lib/home/cover-image'
   import enStrings from '@/locales/en.json'
   import ptBrStrings from '@/locales/pt-BR.json'
   ```

2. Update `searchParams` to include `category`:
   ```tsx
   interface Props {
     params: Promise<{ locale: string }>
     searchParams: Promise<{ page?: string; category?: string }>
   }
   ```

3. Resolve theme, locale strings, and category:
   ```tsx
   const cookieStore = await cookies()
   const isDark = cookieStore.get('btf_theme')?.value !== 'light'
   const t = locale === 'pt-BR' ? ptBrStrings : enStrings
   const category = sp.category ?? null
   ```

4. Pass category filter to the posts query (add `.eq('blog_posts.category', category)` when category is set — but `postRepo().list()` may not support category filter). Check the `postRepo().list()` API. If it doesn't support category, do a direct supabase query or filter client-side. Since the repo returns max 12 posts per page, and categories may span pages, a direct supabase query is better:
   ```tsx
   // If postRepo doesn't support category filter, use service client directly
   // OR filter the result set (less ideal for pagination accuracy)
   ```

5. Extract unique categories from all posts (separate query for the filter UI):
   ```tsx
   // Query distinct categories for the filter pills
   const supabase = getSupabaseServiceClient()
   const { data: catData } = await supabase
     .from('blog_posts')
     .select('category')
     .eq('site_id', ctx.siteId)
     .eq('status', 'published')
     .not('category', 'is', null)
   const categories = [...new Set((catData ?? []).map(r => r.category as string))]
   ```

6. Replace the `<ul>` with a PaperCard grid:
   ```tsx
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 28px' }}>
     {posts.map((p, i) => (
       <PaperCard key={p.id} index={i} variant={i % 2 === 0 ? 'paper' : 'paper2'} className="overflow-hidden">
         <Tape variant={(['tape', 'tape2', 'tapeR'] as const)[i % 3]} className="-top-2 left-4" rotate={-7 + (i % 5)} />
         <Link href={`/blog/${locale}/${p.translation.slug}`} className="block group">
           <div className="h-32 w-full" style={{ background: coverGradient(p.translation.category ?? null, isDark) }} />
           <div className="p-4">
             <div className="flex items-center gap-2 mb-2">
               {p.translation.category && <span className="font-mono text-xs text-pb-muted capitalize">{p.translation.category}</span>}
               <span className="font-mono text-xs text-pb-faint ml-auto">{p.translation.reading_time_min} {t['feed.readMin']}</span>
             </div>
             <h2 className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-accent transition-colors">{p.translation.title}</h2>
             {p.translation.excerpt && <p className="text-pb-muted text-xs mt-1 line-clamp-2">{p.translation.excerpt}</p>}
           </div>
         </Link>
       </PaperCard>
     ))}
   </div>
   ```

   Note: Adapt the above to the actual shape returned by `postRepo().list()`. The current code uses `p.translation.slug`, `p.translation.title`, etc.

7. Add numbered pagination:
   ```tsx
   <nav aria-label={locale === 'pt-BR' ? 'Paginacao' : 'Pagination'} className="flex items-center justify-center gap-2 mt-8">
     {page > 1 && (
       <Link href={`?page=${page - 1}${category ? `&category=${category}` : ''}`} className="font-mono text-sm text-pb-accent hover:underline">
         {t['blog.pagination.prev']}
       </Link>
     )}
     <span className="font-mono text-xs text-pb-muted">
       {(t['blog.pagination.page'] ?? '').replace('{current}', String(page)).replace('{total}', '...')}
     </span>
     {posts.length === 12 && (
       <Link href={`?page=${page + 1}${category ? `&category=${category}` : ''}`} className="font-mono text-sm text-pb-accent hover:underline">
         {t['blog.pagination.next']}
       </Link>
     )}
   </nav>
   ```

8. Add visual breadcrumbs at top:
   ```tsx
   <VisualBreadcrumbs items={[
     { label: t['blog.breadcrumb.home'] ?? 'Home', href: locale === 'pt-BR' ? '/pt-BR' : '/' },
     { label: t['blog.breadcrumb.blog'] ?? 'Blog' },
   ]} />
   ```

9. Wrap entire content in `<main id="main-content">` with Pinboard padding/max-width.

**Verify:**
- `npx tsc --noEmit` passes
- `/blog/en` renders PaperCard grid with Pinboard styling
- Category filter pills appear and filter works
- Pagination works
- `npm run test:web` passes

**Depends on:** 1.1, 2.5, 3.1, 3.2

---

## Track 4: Blog Detail Redesign

### Task 4.1: Extract data loading from blog detail page

**Files:**
- Create `apps/web/lib/blog/load-post.ts`

**What:**
Extract `loadPostWithLocales`, `loadSeoExtrasByLocale`, `toTranslationInputs` from `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx` into a reusable module:

```typescript
// apps/web/lib/blog/load-post.ts
import { postRepo } from '@/lib/cms/repositories'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { SeoExtrasSchema, type SeoExtras } from '@/lib/seo/jsonld/extras-schema'

export async function loadPostWithLocales(siteId: string, locale: string, slug: string) {
  // ... move the existing loadPostWithLocales function body here
}

export async function loadSeoExtrasByLocale(postId: string): Promise<Map<string, SeoExtras | null>> {
  // ... move the existing function body here
}

export type TxIn = {
  locale: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  seo_extras: SeoExtras | null
}

export function toTranslationInputs(
  postCover: string | null,
  translations: Array<{ locale: string; slug: string; title: string; excerpt: string | null }>,
  extrasByLocale: Map<string, SeoExtras | null>,
): TxIn[] {
  // ... move existing function body here
}
```

Also add the `@/lib/blog/*` path alias to `tsconfig.json`:
```json
"@/lib/blog/*": ["./lib/blog/*"]
```

**Verify:**
- `npx tsc --noEmit` passes
- No duplicate code remains in page.tsx (it imports from here)

**Depends on:** 1.1 (blog is in (public))

---

### Task 4.2: Extract JSON-LD graph building from blog detail page

**Files:**
- Create `apps/web/lib/blog/build-detail-graph.ts`

**What:**
Extract `buildDetailGraph`, `buildExtraNodesFromSeoExtras`, `parseDateOrNull` from the blog detail page:

```typescript
// apps/web/lib/blog/build-detail-graph.ts
import type { SiteSeoConfig } from '@/lib/seo/config'
import type { SeoExtras } from '@/lib/seo/jsonld/extras-schema'
import type { JsonLdNode } from '@/lib/seo/jsonld/types'
import {
  buildBlogPostingNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildVideoNode,
} from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import type { TxIn } from './load-post'

export function parseDateOrNull(s: string | null | undefined): Date | null {
  // ... existing body
}

export function buildExtraNodesFromSeoExtras(extras: SeoExtras | null): JsonLdNode[] {
  // ... existing body
}

export function buildDetailGraph(
  config: SiteSeoConfig | null,
  post: { id: string; cover_image_url: string | null; published_at: string | null; updated_at: string },
  tx: { locale: string; slug: string; title: string; excerpt: string | null },
  translations: Array<{ locale: string; slug: string; title: string; excerpt: string | null }>,
  locale: string,
  slug: string,
  extrasByLocale: Map<string, SeoExtras | null>,
  toTranslationInputsFn: (cover: string | null, txs: typeof translations, extras: typeof extrasByLocale) => TxIn[],
) {
  // ... existing body, using toTranslationInputsFn param
}
```

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** 4.1

---

### Task 4.3: Create related posts query

**Files:**
- Create `apps/web/lib/blog/related-posts.ts`

**What:**
Query up to 3 related posts by matching category + locale, excluding the current post:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export type RelatedPost = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  coverImageUrl: string | null
  readingTimeMin: number
  publishedAt: string
}

export async function getRelatedPosts(
  siteId: string,
  locale: string,
  postId: string,
  category: string | null,
  limit = 3,
): Promise<RelatedPost[]> {
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Try same category first
  if (category) {
    const { data } = await supabase
      .from('blog_translations')
      .select(`
        slug, title, excerpt, reading_time_min, cover_image_url,
        blog_posts!inner(id, published_at, category, status, site_id)
      `)
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .eq('blog_posts.category', category)
      .neq('blog_posts.id', postId)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(limit)

    if (data && data.length > 0) {
      return data.map(mapRow)
    }
  }

  // Fallback: recent posts regardless of category
  const { data: fallback } = await supabase
    .from('blog_translations')
    .select(`
      slug, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, status, site_id)
    `)
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .neq('blog_posts.id', postId)
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  return (fallback ?? []).map(mapRow)
}

function mapRow(row: Record<string, unknown>): RelatedPost {
  const post = row['blog_posts'] as Record<string, unknown>
  return {
    id: post['id'] as string,
    slug: row['slug'] as string,
    title: row['title'] as string,
    excerpt: row['excerpt'] as string | null,
    category: post['category'] as string | null,
    coverImageUrl: row['cover_image_url'] as string | null,
    readingTimeMin: row['reading_time_min'] as number,
    publishedAt: post['published_at'] as string,
  }
}
```

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 4.4: Create adjacent posts query

**Files:**
- Create `apps/web/lib/blog/adjacent-posts.ts`

**What:**
Query the previous and next posts by published_at for "previous/next" navigation:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export type AdjacentPost = {
  slug: string
  title: string
  locale: string
}

export async function getAdjacentPosts(
  siteId: string,
  locale: string,
  publishedAt: string,
): Promise<{ prev: AdjacentPost | null; next: AdjacentPost | null }> {
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const [prevResult, nextResult] = await Promise.all([
    supabase
      .from('blog_translations')
      .select(`
        slug, title, locale,
        blog_posts!inner(published_at, status, site_id)
      `)
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .lt('blog_posts.published_at', publishedAt)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: false })
      .limit(1),
    supabase
      .from('blog_translations')
      .select(`
        slug, title, locale,
        blog_posts!inner(published_at, status, site_id)
      `)
      .eq('locale', locale)
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .gt('blog_posts.published_at', publishedAt)
      .lte('blog_posts.published_at', now)
      .order('published_at', { referencedTable: 'blog_posts', ascending: true })
      .limit(1),
  ])

  const prev = prevResult.data?.[0]
    ? { slug: prevResult.data[0].slug as string, title: prevResult.data[0].title as string, locale }
    : null
  const next = nextResult.data?.[0]
    ? { slug: nextResult.data[0].slug as string, title: nextResult.data[0].title as string, locale }
    : null

  return { prev, next }
}
```

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 4.5: Add i18n keys for blog detail

**Files:**
- Modify `apps/web/src/locales/en.json`
- Modify `apps/web/src/locales/pt-BR.json`

**What:**
Add keys:

English:
```json
"blog.detail.readingTime": "{min} min read",
"blog.detail.toc": "Table of Contents",
"blog.detail.related": "Related Posts",
"blog.detail.prev": "Previous",
"blog.detail.next": "Next",
"blog.detail.backToBlog": "Back to Blog"
```

Portuguese:
```json
"blog.detail.readingTime": "{min} min de leitura",
"blog.detail.toc": "Sumario",
"blog.detail.related": "Posts Relacionados",
"blog.detail.prev": "Anterior",
"blog.detail.next": "Proximo",
"blog.detail.backToBlog": "Voltar ao Blog"
```

**Verify:**
- JSON files are valid

**Depends on:** nothing

---

### Task 4.6: Create blog article client wrapper

**Files:**
- Create `apps/web/src/app/(public)/blog/[locale]/[slug]/blog-article-client.tsx`

**What:**
If `@tn-figueiredo/cms-reader` exports a `ReaderProvider` or similar context wrapper, create a client component that wraps the article:

```tsx
'use client'

import type { ReactNode } from 'react'
// import { ReaderProvider } from '@tn-figueiredo/cms-reader'  // if it exists

type Props = {
  children: ReactNode
}

export function BlogArticleClient({ children }: Props) {
  return (
    <div className="reader-pinboard">
      {/* If ReaderProvider exists, wrap children with it */}
      {children}
    </div>
  )
}
```

This wraps the article content with the `reader-pinboard` CSS class that maps Pinboard vars to reader vars (Task 2.3).

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** 2.3

---

### Task 4.7: Rewrite blog detail page

**Files:**
- Modify `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx`

**What:**
Rewrite the page to ~60-80 lines by importing extracted modules:

```tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { cookies } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { compileMdx, MdxRunner } from '@tn-figueiredo/cms'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateBlogPostMetadata } from '@/lib/seo/page-metadata'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { VisualBreadcrumbs } from '../../../components/visual-breadcrumbs'
import { BlogArticleClient } from './blog-article-client'
import { loadPostWithLocales, toTranslationInputs } from '@/lib/blog/load-post'
import { buildDetailGraph, parseDateOrNull } from '@/lib/blog/build-detail-graph'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { getAdjacentPosts } from '@/lib/blog/adjacent-posts'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()
  const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { translations, full, extrasByLocale } = loaded
  const tx = translations.find((t) => t.locale === locale)
  if (!tx) notFound()

  let compiledSource = tx.content_compiled
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
  }

  const post = full ?? loaded.post
  const availableLocales = translations.map((t) => t.locale)
  const slugByLocale = new Map(translations.map((t) => [t.locale, t.slug] as const))

  // Parallel fetch: related posts + adjacent posts + SEO config
  const [related, adjacent, config] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, post.id, post.category ?? null),
    getAdjacentPosts(ctx.siteId, locale, post.published_at ?? post.updated_at),
    (async () => {
      const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
      return getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    })(),
  ])

  const detailGraph = buildDetailGraph(
    config, post, tx, translations, locale, slug, extrasByLocale, toTranslationInputs,
  )

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}
      <main id="main-content" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
        <VisualBreadcrumbs items={[
          { label: t['blog.breadcrumb.home'] ?? 'Home', href: locale === 'pt-BR' ? '/pt-BR' : '/' },
          { label: t['blog.breadcrumb.blog'] ?? 'Blog', href: `/blog/${locale}` },
          { label: tx.title },
        ]} />

        <article lang={locale}>
          <header className="mb-8">
            <LocaleSwitcher
              available={availableLocales}
              current={locale}
              hrefFor={(loc) => `/blog/${loc}/${encodeURIComponent(slugByLocale.get(loc) ?? slug)}`}
            />
            <h1 className="font-fraunces text-pb-ink text-3xl md:text-4xl leading-tight mt-4" style={{ letterSpacing: '-0.02em' }}>
              {tx.title}
            </h1>
            {tx.excerpt && <p className="text-pb-muted text-base mt-3 leading-relaxed">{tx.excerpt}</p>}
            <p className="font-mono text-xs text-pb-faint mt-2">
              <time dateTime={post.published_at ?? post.updated_at}>
                {new Date(post.published_at ?? post.updated_at).toLocaleDateString(locale)}
              </time>
              {' · '}
              {(t['blog.detail.readingTime'] ?? '').replace('{min}', String(tx.reading_time_min))}
            </p>
          </header>

          <BlogArticleClient>
            <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
          </BlogArticleClient>
        </article>

        {/* Table of contents (sidebar on desktop, collapsed on mobile) */}
        {tx.content_toc.length > 0 && (
          <aside aria-label={t['blog.detail.toc'] ?? 'Table of Contents'} className="mt-8 p-4 bg-pb-paper rounded border border-pb-line">
            <h2 className="font-mono text-xs text-pb-muted uppercase tracking-wider mb-3">{t['blog.detail.toc']}</h2>
            <ul className="space-y-1">
              {tx.content_toc.map((entry) => (
                <li key={entry.slug} style={{ marginLeft: (entry.depth - 2) * 16 }}>
                  <a href={`#${entry.slug}`} className="font-mono text-xs text-pb-muted hover:text-pb-accent transition-colors">
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Adjacent post navigation */}
        <nav aria-label={locale === 'pt-BR' ? 'Navegacao entre posts' : 'Post navigation'} className="flex justify-between mt-12 pt-6 border-t border-pb-line">
          {adjacent.prev ? (
            <Link href={`/blog/${locale}/${adjacent.prev.slug}`} className="group flex-1 text-left">
              <span className="font-mono text-xs text-pb-faint">{t['blog.detail.prev']}</span>
              <p className="font-fraunces text-pb-ink text-sm group-hover:text-pb-accent transition-colors leading-snug mt-1">
                {adjacent.prev.title}
              </p>
            </Link>
          ) : <div />}
          {adjacent.next ? (
            <Link href={`/blog/${locale}/${adjacent.next.slug}`} className="group flex-1 text-right">
              <span className="font-mono text-xs text-pb-faint">{t['blog.detail.next']}</span>
              <p className="font-fraunces text-pb-ink text-sm group-hover:text-pb-accent transition-colors leading-snug mt-1">
                {adjacent.next.title}
              </p>
            </Link>
          ) : <div />}
        </nav>

        {/* Related posts */}
        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-12">
            <h2 id="related-heading" className="font-fraunces text-pb-ink text-xl mb-4">{t['blog.detail.related']}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {related.map((r) => (
                <Link key={r.id} href={`/blog/${locale}/${r.slug}`} className="group block p-4 bg-pb-paper rounded border border-pb-line hover:border-pb-accent transition-colors">
                  <h3 className="font-fraunces text-pb-ink text-sm leading-snug group-hover:text-pb-accent transition-colors">{r.title}</h3>
                  {r.excerpt && <p className="text-pb-muted text-xs mt-1 line-clamp-2">{r.excerpt}</p>}
                  <span className="font-mono text-xs text-pb-faint mt-2 inline-block">{r.readingTimeMin} {t['feed.readMin']}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  )
}

// Keep generateMetadata — update imports to use extracted modules
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  // ... same logic as before, but import loadPostWithLocales + toTranslationInputs + parseDateOrNull from lib/blog/
  const { locale, slug } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const { translations, full } = loaded
  const tx = translations.find((t) => t.locale === locale)
  if (!tx) return {}
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    const post = full ?? loaded.post
    const txInputs = toTranslationInputs(post.cover_image_url, translations, loaded.extrasByLocale)
    const updatedAt = parseDateOrNull(post.updated_at)
    const publishedAt = parseDateOrNull(post.published_at) ?? updatedAt
    if (!publishedAt || !updatedAt) {
      return { title: tx.title, description: tx.excerpt ?? undefined, alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` } }
    }
    return generateBlogPostMetadata(config, {
      id: post.id,
      translation: { title: tx.title, slug: tx.slug, excerpt: tx.excerpt, reading_time_min: tx.reading_time_min ?? 0 },
      updated_at: updatedAt,
      published_at: publishedAt,
    }, txInputs)
  } catch {
    return { title: tx.title, description: tx.excerpt ?? undefined, alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` } }
  }
}
```

The above is ~120 lines but significantly cleaner than the original 306-line file. The core page component is ~70 lines; `generateMetadata` is ~30 lines. Data loading, graph building, related/adjacent queries are all in lib/.

**Verify:**
- `npx tsc --noEmit` passes
- `/blog/en/some-post` renders with Pinboard typography, breadcrumbs, TOC, related posts, adjacent navigation
- JSON-LD still emits correctly
- `npm run test:web` passes

**Depends on:** 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 1.1, 2.5

---

## Track 5: Campaigns + Newsletter Archive

### Task 5.1: Add i18n keys for campaigns and newsletter archive

**Files:**
- Modify `apps/web/src/locales/en.json`
- Modify `apps/web/src/locales/pt-BR.json`

**What:**
Add keys:

English:
```json
"campaigns.breadcrumb.home": "Home",
"campaigns.breadcrumb.campaigns": "Campaigns",
"newsletter.archive.title": "Newsletter Archive",
"newsletter.archive.empty": "No newsletters published yet.",
"newsletter.archive.breadcrumb.home": "Home",
"newsletter.archive.breadcrumb.archive": "Newsletter Archive",
"newsletter.archive.pagination.prev": "Previous",
"newsletter.archive.pagination.next": "Next"
```

Portuguese:
```json
"campaigns.breadcrumb.home": "Inicio",
"campaigns.breadcrumb.campaigns": "Campanhas",
"newsletter.archive.title": "Arquivo de Newsletters",
"newsletter.archive.empty": "Nenhuma newsletter publicada ainda.",
"newsletter.archive.breadcrumb.home": "Inicio",
"newsletter.archive.breadcrumb.archive": "Arquivo de Newsletters",
"newsletter.archive.pagination.prev": "Anterior",
"newsletter.archive.pagination.next": "Proximo"
```

**Verify:**
- JSON files are valid

**Depends on:** nothing

---

### Task 5.2: Add Pinboard styling + breadcrumbs to campaigns detail

**Files:**
- Modify `apps/web/src/app/(public)/campaigns/[locale]/[slug]/page.tsx`

**What:**
1. Import `VisualBreadcrumbs` and locale strings:
   ```tsx
   import { VisualBreadcrumbs } from '../../../../components/visual-breadcrumbs'
   import enStrings from '@/locales/en.json'
   import ptBrStrings from '@/locales/pt-BR.json'
   ```

2. Add breadcrumbs above the main content:
   ```tsx
   const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>
   // Inside the JSX, before <main>:
   <VisualBreadcrumbs items={[
     { label: t['campaigns.breadcrumb.home'] ?? 'Home', href: locale === 'pt-BR' ? '/pt-BR' : '/' },
     { label: t['campaigns.breadcrumb.campaigns'] ?? 'Campaigns' },
   ]} />
   ```

3. Wrap `<main>` content in Pinboard typography container:
   ```tsx
   <main id="main-content" className="reader-pinboard" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
   ```

4. Style the existing content sections with Pinboard classes instead of bare HTML.

**Verify:**
- `npx tsc --noEmit` passes
- `/campaigns/en/some-campaign` renders with Pinboard styling + breadcrumbs
- `npm run test:web` passes

**Depends on:** 1.2, 2.3, 2.5, 5.1

---

### Task 5.3: Redesign newsletter archive list page

**Files:**
- Modify `apps/web/src/app/(public)/newsletter/archive/page.tsx`

**What:**
1. Switch from `force-dynamic` to ISR with `revalidate`:
   ```tsx
   export const revalidate = 3600 // 1h ISR
   ```
   Remove `export const dynamic = 'force-dynamic'`

2. Add pagination via `searchParams`:
   ```tsx
   interface Props {
     searchParams: Promise<{ page?: string }>
   }
   ```

3. Import Pinboard components and locale strings:
   ```tsx
   import { cookies } from 'next/headers'
   import { PaperCard } from '../../../components/PaperCard'
   import { Tape } from '../../../components/Tape'
   import { VisualBreadcrumbs } from '../../../components/visual-breadcrumbs'
   import enStrings from '@/locales/en.json'
   import ptBrStrings from '@/locales/pt-BR.json'
   ```

4. Resolve locale and theme:
   ```tsx
   const ctx = await getSiteContext()
   const locale = (ctx.defaultLocale ?? 'en') as 'en' | 'pt-BR'
   const t = (locale === 'pt-BR' ? ptBrStrings : enStrings) as Record<string, string>
   ```

5. Add pagination to the query (limit per page, offset):
   ```tsx
   const page = Number.parseInt(sp.page ?? '1', 10)
   const perPage = 12
   const { data: editions } = await supabase
     .from('newsletter_editions')
     .select('id, subject, sent_at, newsletter_types(name, color)')
     .eq('site_id', ctx.siteId)
     .eq('status', 'sent')
     .order('sent_at', { ascending: false })
     .range((page - 1) * perPage, page * perPage - 1)
   ```

6. Replace bare `<ul>` with PaperCard grid:
   ```tsx
   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
     {(editions ?? []).map((e, i) => (
       <PaperCard key={e.id} index={i} variant={i % 2 === 0 ? 'paper' : 'paper2'} className="overflow-hidden">
         <Tape variant={(['tape', 'tape2', 'tapeR'] as const)[i % 3]} className="-top-2 left-4" rotate={-7 + (i % 5)} />
         <Link href={`/newsletter/archive/${e.id}`} className="block p-4 group">
           <p className="font-mono text-xs text-pb-muted mb-1">
             {typeName} · {new Date(e.sent_at!).toLocaleDateString(locale)}
           </p>
           <h2 className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-accent transition-colors">
             {e.subject}
           </h2>
         </Link>
       </PaperCard>
     ))}
   </div>
   ```

7. Add breadcrumbs + pagination nav + `<main id="main-content">` wrapper.

8. Replace static `metadata` with `generateMetadata`:
   ```tsx
   export async function generateMetadata(): Promise<Metadata> {
     const ctx = await tryGetSiteContext()
     if (!ctx) return { title: 'Newsletter Archive' }
     // Use generateNewsletterArchiveMetadata if added, or manual metadata
     return {
       title: t['newsletter.archive.title'],
       alternates: { canonical: '/newsletter/archive' },
     }
   }
   ```

**Verify:**
- `npx tsc --noEmit` passes
- `/newsletter/archive` renders with PaperCard grid, pagination, breadcrumbs
- `npm run test:web` passes

**Depends on:** 1.3, 2.5, 5.1

---

### Task 5.4: Add Pinboard styling + metadata to newsletter archive detail

**Files:**
- Modify `apps/web/src/app/(public)/newsletter/archive/[id]/page.tsx`

**What:**
1. Switch to ISR: `export const revalidate = 3600`
2. Import breadcrumbs + locale strings
3. Add `<VisualBreadcrumbs>` above content
4. Add Pinboard typography to the article:
   ```tsx
   <article className="reader-pinboard" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
   ```
5. Improve `generateMetadata` to include breadcrumb JSON-LD:
   ```tsx
   import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
   import { composeGraph } from '@/lib/seo/jsonld/graph'
   import { JsonLdScript } from '@/lib/seo/jsonld/render'
   ```
6. Add breadcrumb JSON-LD to the page render.
7. Style the `dangerouslySetInnerHTML` content div with `reader-pinboard` class for Pinboard typography.

**Verify:**
- `npx tsc --noEmit` passes
- `/newsletter/archive/[id]` renders with Pinboard typography + breadcrumbs
- `npm run test:web` passes

**Depends on:** 1.3, 2.3, 2.5, 5.1

---

### Task 5.5: Add generateNewsletterMetadata factory to page-metadata.ts

**Files:**
- Modify `apps/web/lib/seo/page-metadata.ts`

**What:**
Add a new factory function for newsletter archive pages:

```typescript
export function generateNewsletterArchiveMetadata(
  config: SiteSeoConfig,
  locale: string,
): Metadata {
  const t = locale === 'en'
    ? { title: 'Newsletter Archive', desc: `Past editions from ${config.siteName}.` }
    : { title: 'Arquivo de Newsletters', desc: `Edicoes anteriores de ${config.siteName}.` }
  return {
    ...baseMetadata(config),
    title: t.title,
    description: t.desc,
    alternates: { canonical: '/newsletter/archive' },
    robots: { index: true, follow: true },
  }
}

export function generateNewsletterDetailMetadata(
  config: SiteSeoConfig,
  subject: string,
): Metadata {
  return {
    ...baseMetadata(config),
    title: subject,
    alternates: { canonical: undefined }, // canonical set per-page
    robots: { index: true, follow: true },
  }
}
```

**Verify:**
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

## Track 6: i18n + Accessibility

### Task 6.1: Add `lang` attribute to article elements

**Files:**
- Modify `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx` (done in Task 4.7)
- Modify `apps/web/src/app/(public)/campaigns/[locale]/[slug]/page.tsx`
- Modify `apps/web/src/app/(public)/newsletter/archive/[id]/page.tsx`

**What:**
Ensure every `<article>` tag has a `lang` attribute matching the content locale:
- Blog detail: `<article lang={locale}>` (already done in Task 4.7)
- Campaigns: `<article lang={locale}>` (add to the campaign page.tsx main content wrapper, or add to the `<main>` if there's no `<article>`)
- Newsletter archive detail: `<article lang="pt-BR">` (or derive from site context defaultLocale)

**Verify:**
- `npx tsc --noEmit` passes
- Axe a11y check: no `html-has-lang` or content-lang violations

**Depends on:** 4.7, 5.2, 5.4

---

### Task 6.2: Add `datetime` attribute to time elements

**Files:**
- Modify blog detail page (done in Task 4.7 — `<time dateTime={...}>`)
- Modify newsletter archive list and detail pages
- Modify campaign detail page if dates are shown

**What:**
Wherever a date is displayed, wrap it in a `<time>` element with a machine-readable `dateTime` attribute:

```tsx
<time dateTime={edition.sent_at as string}>
  {new Date(edition.sent_at as string).toLocaleDateString(locale)}
</time>
```

**Verify:**
- `npx tsc --noEmit` passes
- Dates render correctly

**Depends on:** 5.3, 5.4

---

### Task 6.3: Add proper ARIA attributes to navigation elements

**Files:**
- Modify `apps/web/src/app/(public)/blog/[locale]/page.tsx` (pagination nav)
- Modify `apps/web/src/app/(public)/newsletter/archive/page.tsx` (pagination nav)
- Review all nav elements for `aria-label` and `aria-current`

**What:**
1. Pagination nav: `<nav aria-label="Pagination">` (already added in Track 3/5)
2. Breadcrumbs: `<nav aria-label="Breadcrumb">` (already in VisualBreadcrumbs component)
3. Current page in breadcrumbs: `aria-current="page"` on the last item (already in VisualBreadcrumbs)
4. Add `role="navigation"` where implicit role is not clear

**Verify:**
- Axe a11y analysis shows no navigation-related violations
- `npm run test:web` passes

**Depends on:** 3.3, 5.3

---

### Task 6.4: Fix pt-BR home page locale awareness

**Files:**
- Modify `apps/web/src/app/(public)/pt-BR/page.tsx`

**What:**
Currently the pt-BR page has hardcoded metadata. It should use the SEO factory like the en page:

```tsx
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateRootMetadata } from '@/lib/seo/page-metadata'
import { PinboardHome } from '../components/PinboardHome'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: 'Thiago Figueiredo — Criador & Builder',
      description: 'Textos, videos e experimentos da beira do teclado.',
      alternates: { canonical: '/pt-BR' },
    }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    const meta = generateRootMetadata(config)
    return {
      ...meta,
      alternates: {
        ...meta.alternates,
        canonical: '/pt-BR',
        languages: { en: '/' },
      },
    }
  } catch {
    return { title: 'Thiago Figueiredo — Criador & Builder' }
  }
}

export default function HomePagePtBR() {
  return <PinboardHome locale="pt-BR" />
}
```

**Verify:**
- `npx tsc --noEmit` passes
- `/pt-BR` renders correctly with proper metadata

**Depends on:** nothing

---

## Track 7: Content Discovery + Performance

### Task 7.1: Create RSS feed route

**Files:**
- Create `apps/web/src/app/(public)/feed.xml/route.ts`

**What:**
Generate an RSS 2.0 feed of published blog posts:

```typescript
import { headers } from 'next/headers'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return new Response('<rss version="2.0"><channel><title>Not Found</title></channel></rss>', {
      status: 404,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    })
  }

  const h = await headers()
  const host = h.get('host') ?? ctx.primaryDomain ?? 'bythiagofigueiredo.com'
  const siteUrl = `https://${host}`
  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data: posts } = await supabase
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt,
      blog_posts!inner(id, published_at, status, site_id, category)
    `)
    .eq('blog_posts.site_id', ctx.siteId)
    .eq('blog_posts.status', 'published')
    .eq('locale', ctx.defaultLocale)
    .lte('blog_posts.published_at', now)
    .not('blog_posts.published_at', 'is', null)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(50)

  const items = (posts ?? []).map((row) => {
    const post = (row as Record<string, unknown>)['blog_posts'] as Record<string, unknown>
    const pubDate = new Date(post['published_at'] as string).toUTCString()
    const link = `${siteUrl}/blog/${(row as Record<string, unknown>)['locale']}/${(row as Record<string, unknown>)['slug']}`
    return `    <item>
      <title><![CDATA[${escapeXml((row as Record<string, unknown>)['title'] as string)}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${escapeXml((row as Record<string, unknown>)['excerpt'] as string ?? '')}]]></description>
      ${post['category'] ? `<category>${escapeXml(post['category'] as string)}</category>` : ''}
    </item>`
  })

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>by Thiago Figueiredo</title>
    <link>${siteUrl}</link>
    <description>Build in public. Learn out loud.</description>
    <language>${ctx.defaultLocale}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${items.join('\n')}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

**Verify:**
- `curl http://localhost:3001/feed.xml` returns valid RSS XML
- `npx tsc --noEmit` passes

**Depends on:** nothing

---

### Task 7.2: Add RSS link to metadata alternates

**Files:**
- Modify `apps/web/src/app/(public)/layout.tsx`

**What:**
Add RSS feed discovery link to the layout's metadata:

In `generateMetadata()`, after computing root metadata, add:
```typescript
return {
  ...metadata,
  alternates: {
    ...metadata.alternates,
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
}
```

This makes browsers and RSS readers auto-discover the feed via `<link rel="alternate" type="application/rss+xml">`.

**Verify:**
- View page source: `<link rel="alternate" type="application/rss+xml" ...>` present
- `npx tsc --noEmit` passes

**Depends on:** 7.1

---

### Task 7.3: Add RSS link to PinboardFooter

**Files:**
- Modify `apps/web/src/app/(public)/components/PinboardFooter.tsx`

**What:**
Add an RSS link in the footer nav:

```tsx
<a href="/feed.xml" className="hover:text-pb-ink transition-colors" title="RSS Feed">
  RSS
</a>
```

Add it after the existing nav links (Blog, Newsletter, Contact, Privacy, Terms, Dev).

**Verify:**
- Footer shows RSS link
- `npx tsc --noEmit` passes

**Depends on:** 7.1

---

### Task 7.4: Add RSS feed to sitemap enumerator

**Files:**
- Modify `apps/web/lib/seo/enumerator.ts`

**What:**
The RSS feed route (`/feed.xml`) is auto-discovered via the `<link>` tag and doesn't need to be in the sitemap. However, the sitemap's `Sitemap:` line in robots.txt already points crawlers to the sitemap. No change needed unless the `/feed.xml` should appear as a static route — typically RSS feeds are NOT listed in sitemaps.

**Action:** Skip (no change needed). Note this in the plan for documentation.

**Depends on:** nothing

---

### Task 7.5: Optimize blog detail with Promise.all for parallel fetches

**Files:**
- Already done in Task 4.7

**What:**
The rewritten blog detail page (Task 4.7) already uses `Promise.all` to fetch related posts, adjacent posts, and SEO config in parallel. Verify this optimization is in place.

**Verify:**
- Blog detail page loads with parallel fetches (check waterfall in browser devtools)

**Depends on:** 4.7

---

### Task 7.6: Add `@/lib/blog/*` path alias to tsconfig

**Files:**
- Modify `apps/web/tsconfig.json`

**What:**
Add the path alias for the new `lib/blog/` directory:

```json
"@/lib/blog/*": ["./lib/blog/*"],
```

Add it alongside the existing `@/lib/cms/*`, `@/lib/seo/*`, etc. entries.

**Verify:**
- `npx tsc --noEmit` passes
- Imports like `@/lib/blog/load-post` resolve correctly

**Depends on:** nothing (but must be done before 4.1)

---

## Final Verification

### Task F.1: Run full test suite

**Files:** none (verification only)

**What:**
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

All 777+ vitest tests must pass.

**Verify:**
- Zero test failures
- No new test warnings

**Depends on:** all previous tasks

---

### Task F.2: Run E2E tests

**Files:** none (verification only)

**What:**
```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx playwright test --reporter=list
```

All 77 Playwright E2E tests must pass. Pay special attention to:
- `tests/public/homepage.spec.ts` — homepage layout changed
- `tests/public/contact-form.spec.ts` — contact page moved
- `tests/public/newsletter.spec.ts` — newsletter routes

**Verify:**
- Zero E2E failures

**Depends on:** all previous tasks

---

### Task F.3: Manual smoke test

**Files:** none (verification only)

**What:**
Start dev server and manually verify:
1. Homepage (`/`) — PinboardHeader + hero + feed + footer
2. pt-BR home (`/pt-BR`) — same layout, Portuguese strings
3. Blog index (`/blog/en`) — PaperCard grid, category filter, pagination
4. Blog detail (`/blog/en/some-post`) — Pinboard typography, TOC, related, adjacent nav, breadcrumbs
5. Campaigns (`/campaigns/en/some-campaign`) — Pinboard styling, breadcrumbs
6. Newsletter archive (`/newsletter/archive`) — PaperCard grid, pagination
7. Newsletter detail (`/newsletter/archive/[id]`) — Pinboard typography
8. Contact (`/contact`) — Pinboard styling via layout
9. Privacy (`/privacy`) — still renders correctly
10. RSS (`/feed.xml`) — valid XML

**Verify:**
- All pages render without console errors
- Pinboard design system is consistent across all public pages
- Skip-to-content link works

**Depends on:** all previous tasks

---

## Execution Order

| Phase | Tasks | Parallel? |
|---|---|---|
| 1: Route moves | 1.1, 1.2, 1.3, 1.4 | Yes (all independent) |
| 2: Layout extraction | 1.5 | No (depends on Phase 1) |
| 3: Infrastructure | 1.6, 1.8, 2.1, 2.2, 7.6, 3.1, 4.5, 5.1 | Yes (all independent) |
| 4: CSS + components | 2.3, 2.4, 2.5, 2.6, 3.2 | Yes (all independent, depend on Phase 3) |
| 5: Page rewrites | 3.3, 4.1, 4.2, 4.3, 4.4, 4.6 | Partially parallel |
| 6: Detail page | 4.7 | No (depends on 4.1-4.6) |
| 7: Other pages | 5.2, 5.3, 5.4, 5.5 | Yes (independent of each other) |
| 8: i18n/a11y | 6.1, 6.2, 6.3, 6.4 | Yes (independent) |
| 9: RSS + polish | 7.1, 7.2, 7.3 | Sequential (7.2/7.3 depend on 7.1) |
| 10: E2E + tests | 1.7, F.1, F.2, F.3 | Sequential |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| `@tn-figueiredo/cms-reader@0.1.0` CSS API unknown | Task 2.3 instructions include "inspect package" step. If API differs, adjust the CSS bridge accordingly. Worst case: skip cms-reader, use Pinboard CSS classes directly on article content. |
| Blog category filter requires DB query change | If `postRepo().list()` doesn't support category param, use direct supabase query. Document the approach chosen. |
| E2E tests break from layout change | Homepage E2E checks `main` visibility (not PinboardHeader/Footer). Since layout adds header/footer around children, and children still render `<main>`, tests should pass. Run early (Task 1.7). |
| Relative import depth changes | All files being moved use `@/` alias imports, which are path-independent. Only a few use relative `../../../../` paths — these are explicitly listed per task. |
| PinboardHome.tsx `cookies()` call removed | Layout handles theme detection instead. PinboardHome's `isDark` prop must be passed from the page component, or theme must be read from layout and passed through. Since PinboardHome is an async server component on the homepage page.tsx, the page can read cookies and pass `isDark` as a prop. |
| Newsletter confirm/subscribe routes must NOT get PinboardHeader | These routes stay outside `(public)/` group. Verify they still work after Task 1.3. |
