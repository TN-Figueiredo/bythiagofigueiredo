# About Page + Author Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/about` page driven by author data in the DB, with a CMS "About Page" tab for editing all about-related fields.

**Architecture:** 8 new nullable columns on the `authors` table (no new tables). Public `/about` page fetches the site's default author and renders a narrative-first, polaroid-led layout using existing paper-and-tape components. CMS author drawer gains a tab system with Profile + About Page tabs.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL), Tailwind 4, `@tn-figueiredo/cms` (MdxRunner, compileMdx), existing pinboard Paper/Tape components, Zod validation, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-04-about-page-author-extension-design.md`

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `supabase/migrations/20260504000001_authors_about_extension.sql` | Add 8 columns to `authors` |
| `apps/web/lib/about/queries.ts` | Data fetching + unstable_cache for about page |
| `apps/web/src/app/(public)/about/page.tsx` | Server component: data fetch + metadata + render |
| `apps/web/src/app/(public)/about/components/AboutHero.tsx` | Kicker + headline with marker highlight |
| `apps/web/src/app/(public)/about/components/Polaroid.tsx` | Photo frame with tape, caption, location |
| `apps/web/src/app/(public)/about/components/AboutContent.tsx` | Subtitle + MDX chapters |
| `apps/web/src/app/(public)/about/components/CtaBlock.tsx` | Paper card with chips grid + signoff |
| `apps/web/src/app/(public)/about/components/CtaChip.tsx` | Individual chip: number + label + arrow |
| `apps/web/src/app/(public)/about/about.css` | About-page-specific styles (colors, layout, responsive) |
| `apps/web/test/about/about-queries.test.ts` | Tests for data fetching |
| `apps/web/test/cms/authors-about-actions.test.ts` | Tests for updateAuthorAbout server action |

### Modified files
| File | Change |
|---|---|
| `apps/web/lib/seo/page-metadata.ts` | Add `generateAboutMetadata` factory |
| `apps/web/lib/seo/enumerator.ts` | Add `/about` to static routes |
| `apps/web/lib/newsletter/cache-invalidation.ts` | Add `revalidateAbout(siteId)` helper |
| `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx` | Tab system + About Page tab with all field groups |
| `apps/web/src/app/cms/(authed)/authors/actions.ts` | Add `updateAuthorAbout` + `uploadAuthorAboutPhoto` server actions |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260504000001_authors_about_extension.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Migration: 20260504000001_authors_about_extension.sql
-- Adds about-page fields to the authors table.

ALTER TABLE authors
  ADD COLUMN IF NOT EXISTS headline        text,
  ADD COLUMN IF NOT EXISTS subtitle        text,
  ADD COLUMN IF NOT EXISTS about_md        text,
  ADD COLUMN IF NOT EXISTS about_compiled  text,
  ADD COLUMN IF NOT EXISTS about_photo_url text,
  ADD COLUMN IF NOT EXISTS photo_caption   text,
  ADD COLUMN IF NOT EXISTS photo_location  text,
  ADD COLUMN IF NOT EXISTS about_cta_links jsonb;

-- CHECK: about_photo_url must be https when set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_about_photo_url_https'
  ) THEN
    ALTER TABLE authors
      ADD CONSTRAINT authors_about_photo_url_https
      CHECK (about_photo_url IS NULL OR about_photo_url ~ '^https://');
  END IF;
END $$;

-- CHECK: about_cta_links structural validation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'authors_about_cta_links_valid'
  ) THEN
    ALTER TABLE authors
      ADD CONSTRAINT authors_about_cta_links_valid
      CHECK (
        about_cta_links IS NULL
        OR (
          about_cta_links ? 'links'
          AND jsonb_typeof(about_cta_links -> 'links') = 'array'
        )
      );
  END IF;
END $$;
```

- [ ] **Step 2: Verify migration locally (if DB available)**

Run: `npm run db:start && npm run db:reset`

Expected: Migration applies without errors, `\d authors` shows all 8 new columns.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260504000001_authors_about_extension.sql
git commit -m "feat(db): add about-page columns to authors table"
```

---

## Task 2: Cache Invalidation Helper

**Files:**
- Modify: `apps/web/lib/newsletter/cache-invalidation.ts`

- [ ] **Step 1: Add revalidateAbout helper**

Add to the existing file alongside other revalidation helpers:

```typescript
export function revalidateAbout(siteId: string) {
  revalidateTag(`about:${siteId}`)
}
```

Import `revalidateTag` from `next/cache` — it's already imported in this file.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/newsletter/cache-invalidation.ts
git commit -m "feat(seo): add revalidateAbout cache invalidation helper"
```

---

## Task 3: About Page Data Layer

**Files:**
- Create: `apps/web/lib/about/queries.ts`
- Create: `apps/web/test/about/about-queries.test.ts`

- [ ] **Step 1: Write failing test for getAboutData**

```typescript
// apps/web/test/about/about-queries.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

import { getAboutData } from '@/lib/about/queries'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  const chain = { select: mockSelect, eq: mockEq, single: mockSingle }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValueOnce(chain).mockReturnValueOnce(chain)
  ;(getSupabaseServiceClient as any).mockReturnValue({
    from: () => chain,
  })
})

describe('getAboutData', () => {
  it('returns author data when default author has about fields', async () => {
    const authorRow = {
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      about_md: '# Chapter 1',
      about_compiled: '<p>compiled</p>',
      about_photo_url: 'https://example.com/photo.jpg',
      photo_caption: 'CN Tower',
      photo_location: 'TORONTO · 2018',
      about_cta_links: { kicker: 'Vem junto', signature: 'tf', links: [] },
      social_links: { x: 'https://x.com/test' },
      display_name: 'Thiago',
    }
    mockSingle.mockResolvedValue({ data: authorRow, error: null })

    const result = await getAboutData('site-123')
    expect(result).toEqual(authorRow)
  })

  it('returns null when no default author exists', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await getAboutData('site-123')
    expect(result).toBeNull()
  })

  it('returns null when all about fields are empty', async () => {
    const authorRow = {
      headline: null,
      subtitle: null,
      about_md: null,
      about_compiled: null,
      about_photo_url: null,
      photo_caption: null,
      photo_location: null,
      about_cta_links: null,
      social_links: null,
      display_name: 'Thiago',
    }
    mockSingle.mockResolvedValue({ data: authorRow, error: null })

    const result = await getAboutData('site-123')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run test/about/about-queries.test.ts`

Expected: FAIL — module `@/lib/about/queries` not found.

- [ ] **Step 3: Implement getAboutData**

```typescript
// apps/web/lib/about/queries.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AboutData {
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  about_photo_url: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
  social_links: Record<string, string> | null
  display_name: string
}

const ABOUT_COLUMNS = [
  'headline', 'subtitle', 'about_md', 'about_compiled',
  'about_photo_url', 'photo_caption', 'photo_location',
  'about_cta_links', 'social_links', 'display_name',
].join(', ')

async function fetchAboutData(siteId: string): Promise<AboutData | null> {
  const sb = getSupabaseServiceClient()
  const { data, error } = await sb
    .from('authors')
    .select(ABOUT_COLUMNS)
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()

  if (error || !data) return null

  const hasAboutContent =
    data.headline || data.subtitle || data.about_md ||
    data.about_compiled || data.about_photo_url

  if (!hasAboutContent) return null

  return data as AboutData
}

export const getAboutData = unstable_cache(
  fetchAboutData,
  ['about'],
  { tags: ['about'], revalidate: 300 },
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- --run test/about/about-queries.test.ts`

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/about/queries.ts apps/web/test/about/about-queries.test.ts
git commit -m "feat(about): add data layer with getAboutData query + cache"
```

---

## Task 4: SEO Integration

**Files:**
- Modify: `apps/web/lib/seo/page-metadata.ts`
- Modify: `apps/web/lib/seo/enumerator.ts`

- [ ] **Step 1: Add generateAboutMetadata factory**

Add to `apps/web/lib/seo/page-metadata.ts` after the existing `generateContactMetadata` function:

```typescript
export function generateAboutMetadata(
  config: SiteSeoConfig,
  subtitle: string | null,
  aboutPhotoUrl: string | null,
): Metadata {
  const title = `About — ${config.siteName}`
  const description = subtitle ?? `About ${config.siteName}`
  const ogImage = aboutPhotoUrl ?? config.seoDefaultOgImage ?? `${config.siteUrl}/og-default.png`

  return {
    ...base(config),
    title,
    description,
    openGraph: {
      ...base(config).openGraph,
      title,
      description,
      images: [{ url: ogImage }],
      url: `${config.siteUrl}/about`,
    },
    alternates: {
      canonical: `${config.siteUrl}/about`,
    },
  }
}
```

- [ ] **Step 2: Add /about to sitemap static routes**

In `apps/web/lib/seo/enumerator.ts`, add to the `STATIC_ROUTES` array:

```typescript
{ basePath: '/about', changeFrequency: 'monthly' as const, priority: 0.6 },
```

Add it alongside the existing `/contact` entry (similar priority and frequency).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/seo/page-metadata.ts apps/web/lib/seo/enumerator.ts
git commit -m "feat(seo): add about page metadata factory + sitemap route"
```

---

## Task 5: About Page Styles

**Files:**
- Create: `apps/web/src/app/(public)/about/about.css`

- [ ] **Step 1: Create about.css with all visual tokens**

This file defines about-page-specific styles using existing CSS variables from the design system. The existing `globals.css` already defines `--pb-bg`, `--pb-paper`, `--pb-tape`, `--pb-accent`, `--font-fraunces`, `--font-caveat`, `--font-jetbrains` — we reference those.

```css
/* apps/web/src/app/(public)/about/about.css */

.about-page {
  min-height: calc(100vh - 44px);
  background:
    radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--pb-accent) 4%, transparent), transparent 45%),
    radial-gradient(circle at 88% 78%, color-mix(in srgb, white 1.2%, transparent), transparent 50%);
}

/* Kicker */
.about-kicker {
  font-family: var(--font-jetbrains);
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--pb-accent);
  margin-bottom: 16px;
}

/* Headline */
.about-headline {
  font-family: var(--font-fraunces);
  font-size: clamp(56px, 10vw, 132px);
  line-height: 0.92;
  letter-spacing: -0.04em;
  font-weight: 500;
  text-wrap: balance;
  color: var(--pb-ink);
}

.about-marker {
  position: relative;
  display: inline-block;
}

.about-marker-text {
  position: relative;
  z-index: 1;
}

.about-marker-bg {
  position: absolute;
  bottom: 0.10em;
  left: -0.06em;
  right: -0.06em;
  height: 0.26em;
  background: #FFE37A;
  opacity: 0.78;
  transform: skew(-3deg) rotate(-0.6deg);
  z-index: 0;
}

[data-theme="light"] .about-marker-bg {
  opacity: 0.90;
}

/* Main grid */
.about-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 56px;
  align-items: start;
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px 28px 48px;
}

/* Polaroid */
.about-polaroid {
  position: relative;
  padding-top: 18px;
  flex: 0 0 auto;
}

.about-polaroid-frame {
  width: 320px;
  padding: 14px 14px 18px;
  transform: rotate(-2.4deg);
  position: relative;
}

[data-theme="dark"] .about-polaroid-frame {
  background: #F2EBDB;
  box-shadow: 0 3px 0 rgba(0,0,0,0.6), 0 18px 36px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.08);
}

[data-theme="light"] .about-polaroid-frame {
  background: #FFFEF8;
  box-shadow: 0 1px 0 rgba(0,0,0,0.05), 0 14px 28px rgba(70,50,20,0.22), inset 0 0 0 1px rgba(0,0,0,0.04);
}

.about-polaroid-photo {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  display: block;
}

.about-polaroid-caption {
  font-family: var(--font-caveat);
  font-size: 22px;
  color: #1A1410;
  margin-top: 12px;
  line-height: 1.1;
  text-align: center;
}

.about-polaroid-location {
  font-family: var(--font-jetbrains);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: #9C8E70;
  text-align: center;
  margin-top: 6px;
  text-transform: uppercase;
}

/* Tape */
.about-tape {
  position: absolute;
  height: 18px;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);
}

.about-tape-yellow { background: var(--pb-tape); }
.about-tape-blue   { background: var(--pb-tape2); }

/* Content column */
.about-content {
  padding-top: 8px;
  max-width: 620px;
}

.about-tagline {
  font-family: var(--font-fraunces);
  font-style: italic;
  font-size: 22px;
  line-height: 1.4;
  margin: 0 0 28px;
  text-wrap: pretty;
}

[data-theme="dark"] .about-tagline { color: #958A75; }
[data-theme="light"] .about-tagline { color: #6A5F48; }

.about-chapters {
  font-family: var(--font-fraunces);
  font-size: 19px;
  line-height: 1.6;
  color: var(--pb-ink);
}

.about-chapters p {
  margin: 0 0 18px;
  text-wrap: pretty;
}

.about-chapters p:last-child { margin-bottom: 0; }

/* CTA block */
.about-cta {
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 28px 40px;
}

.about-cta-paper {
  padding: 28px 32px 24px;
  position: relative;
  transform: rotate(-0.3deg);
}

.about-cta-kicker {
  font-family: var(--font-jetbrains);
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--pb-accent);
  font-weight: 700;
  white-space: nowrap;
}

.about-cta-line {
  flex: 1;
  min-width: 40px;
  height: 1px;
}

[data-theme="dark"] .about-cta-line { border-top: 1px dashed #2E2718; }
[data-theme="light"] .about-cta-line { border-top: 1px dashed #CEBFA0; }

.about-chips {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.about-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  text-decoration: none;
  color: inherit;
  background: transparent;
  transition: transform 120ms ease, border-color 120ms ease;
}

[data-theme="dark"] .about-chip { border: 1px dashed #2E2718; }
[data-theme="light"] .about-chip { border: 1px dashed #CEBFA0; }

.about-chip:hover {
  transform: translateY(-1px);
  border-color: var(--pb-accent) !important;
}

.about-chip:hover .about-chip-label {
  color: var(--pb-accent) !important;
}

.about-chip-num {
  font-family: var(--font-jetbrains);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

[data-theme="dark"] .about-chip-num { color: #6B634F; }
[data-theme="light"] .about-chip-num { color: #9C9178; }

.about-chip-label {
  font-family: var(--font-fraunces);
  font-size: 16px;
  color: var(--pb-ink);
  letter-spacing: -0.005em;
  transition: color 120ms ease;
}

.about-chip-arrow {
  color: var(--pb-accent);
  font-size: 14px;
}

.about-signoff {
  font-family: var(--font-caveat);
  font-size: 22px;
  color: var(--pb-accent);
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 760px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 32px;
    justify-items: center;
  }
  .about-polaroid { display: flex; justify-content: center; }
  .about-content { max-width: 100%; }
  .about-chips { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .about-chips { grid-template-columns: 1fr; }
  .about-polaroid-frame { width: 260px; }
  .about-grid { padding: 16px 20px 32px; }
  .about-cta { padding: 24px 20px 32px; }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/(public)/about/about.css
git commit -m "feat(about): add about page styles with theme-aware CSS variables"
```

---

## Task 6: About Page Components

**Files:**
- Create: `apps/web/src/app/(public)/about/components/AboutHero.tsx`
- Create: `apps/web/src/app/(public)/about/components/Polaroid.tsx`
- Create: `apps/web/src/app/(public)/about/components/AboutContent.tsx`
- Create: `apps/web/src/app/(public)/about/components/CtaChip.tsx`
- Create: `apps/web/src/app/(public)/about/components/CtaBlock.tsx`

- [ ] **Step 1: Create AboutHero**

```tsx
// apps/web/src/app/(public)/about/components/AboutHero.tsx

interface AboutHeroProps {
  headline: string
}

export function AboutHero({ headline }: AboutHeroProps) {
  const parts = headline.split('|')
  const before = parts[0] ?? ''
  const highlighted = parts.slice(1).join('|')

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 28px 24px' }}>
      <div className="about-kicker">§ OLÁ</div>
      <h1 className="about-headline">
        <span>{before}</span>
        {highlighted && (
          <span className="about-marker">
            <span className="about-marker-text">{highlighted}</span>
            <span className="about-marker-bg" />
          </span>
        )}
      </h1>
    </section>
  )
}
```

- [ ] **Step 2: Create Polaroid**

```tsx
// apps/web/src/app/(public)/about/components/Polaroid.tsx
import Image from 'next/image'

interface PolaroidProps {
  photoUrl: string
  caption: string | null
  location: string | null
  displayName: string
}

export function Polaroid({ photoUrl, caption, location, displayName }: PolaroidProps) {
  return (
    <div className="about-polaroid">
      <div className="about-polaroid-frame">
        <div
          className="about-tape about-tape-yellow"
          style={{ width: 78, top: -10, left: 30, transform: 'rotate(-5deg)' }}
        />
        <div
          className="about-tape about-tape-blue"
          style={{ width: 64, top: -10, right: 24, transform: 'rotate(4deg)' }}
        />
        <Image
          src={photoUrl}
          alt={displayName}
          width={292}
          height={292}
          className="about-polaroid-photo"
          priority
        />
        {caption && <div className="about-polaroid-caption">{caption}</div>}
        {location && <div className="about-polaroid-location">{location}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create AboutContent**

```tsx
// apps/web/src/app/(public)/about/components/AboutContent.tsx
import { MdxRunner, compileMdx } from '@tn-figueiredo/cms'

interface AboutContentProps {
  subtitle: string | null
  aboutCompiled: string | null
  aboutMd: string | null
}

export async function AboutContent({ subtitle, aboutCompiled, aboutMd }: AboutContentProps) {
  let compiledSource = aboutCompiled
  if (!compiledSource && aboutMd) {
    const result = await compileMdx(aboutMd)
    compiledSource = result.compiledSource
  }

  return (
    <div className="about-content">
      {subtitle && <p className="about-tagline">{subtitle}</p>}
      {compiledSource && (
        <div className="about-chapters">
          <MdxRunner compiledSource={compiledSource} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create CtaChip**

```tsx
// apps/web/src/app/(public)/about/components/CtaChip.tsx

interface CtaChipProps {
  number: string
  label: string
  href: string
  external?: boolean
}

export function CtaChip({ number, label, href, external }: CtaChipProps) {
  return (
    <a
      className="about-chip"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener' : undefined}
    >
      <span className="about-chip-num">{number}</span>
      <span className="about-chip-label">{label}</span>
      <span className="about-chip-arrow">→</span>
    </a>
  )
}
```

- [ ] **Step 5: Create CtaBlock**

```tsx
// apps/web/src/app/(public)/about/components/CtaBlock.tsx
import { Paper } from '@/components/pinboard/paper'
import { Tape } from '@/app/(public)/components/Tape'
import { CtaChip } from './CtaChip'

const INTERNAL_ROUTES: Record<string, string> = {
  blog: '/blog',
  newsletters: '/newsletters',
  videos: '/videos',
}

interface CtaLink {
  type: 'internal' | 'social'
  key: string
  label: string
}

interface CtaBlockProps {
  kicker: string
  signature: string
  links: CtaLink[]
  socialLinks: Record<string, string> | null
}

export function CtaBlock({ kicker, signature, links, socialLinks }: CtaBlockProps) {
  const resolvedLinks = links
    .map((link) => {
      if (link.type === 'internal') {
        const href = INTERNAL_ROUTES[link.key]
        return href ? { ...link, href, external: false } : null
      }
      const href = socialLinks?.[link.key]
      return href ? { ...link, href, external: true } : null
    })
    .filter(Boolean) as Array<CtaLink & { href: string; external: boolean }>

  if (resolvedLinks.length === 0) return null

  return (
    <section className="about-cta">
      <div style={{ position: 'relative', paddingTop: 18 }}>
        <Paper tint="var(--pb-paper2)" padding="28px 32px 24px" rotation={-0.3}>
          <Tape
            style={{ width: 78, top: -9, left: '26%', transform: 'rotate(-3deg)' }}
          />
          <Tape
            variant="tape2"
            style={{ width: 64, top: -9, right: '30%', transform: 'rotate(2.5deg)' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <span className="about-cta-kicker">◉ {kicker}</span>
            <span className="about-cta-line" />
          </div>

          <div className="about-chips">
            {resolvedLinks.map((link, i) => (
              <CtaChip
                key={link.key}
                number={String(i + 1).padStart(2, '0')}
                label={link.label}
                href={link.href}
                external={link.external}
              />
            ))}
          </div>

          <div style={{ marginTop: 22 }}>
            <span className="about-signoff">{signature}</span>
          </div>
        </Paper>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/(public)/about/components/
git commit -m "feat(about): add AboutHero, Polaroid, AboutContent, CtaBlock, CtaChip components"
```

---

## Task 7: About Page Route

**Files:**
- Create: `apps/web/src/app/(public)/about/page.tsx`

- [ ] **Step 1: Create the page server component**

```tsx
// apps/web/src/app/(public)/about/page.tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getAboutData } from '@/lib/about/queries'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateAboutMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { AboutHero } from './components/AboutHero'
import { Polaroid } from './components/Polaroid'
import { AboutContent } from './components/AboutContent'
import { CtaBlock } from './components/CtaBlock'
import './about.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const about = await getAboutData(ctx.siteId)
  if (!about) return {}
  return generateAboutMetadata(config, about.subtitle, about.about_photo_url)
}

export default async function AboutPage() {
  const ctx = await tryGetSiteContext()
  if (!ctx) notFound()

  const about = await getAboutData(ctx.siteId)
  if (!about) notFound()

  const h = await headers()
  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)

  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', url: config.siteUrl },
    { name: 'About', url: `${config.siteUrl}/about` },
  ])
  const graph = composeGraph({ nodes: [breadcrumb] })

  return (
    <div className="about-page">
      <JsonLdScript graph={graph} />

      {about.headline && <AboutHero headline={about.headline} />}

      <section className="about-grid">
        {about.about_photo_url && (
          <Polaroid
            photoUrl={about.about_photo_url}
            caption={about.photo_caption}
            location={about.photo_location}
            displayName={about.display_name}
          />
        )}

        <AboutContent
          subtitle={about.subtitle}
          aboutCompiled={about.about_compiled}
          aboutMd={about.about_md}
        />
      </section>

      {about.about_cta_links?.links?.length ? (
        <CtaBlock
          kicker={about.about_cta_links.kicker}
          signature={about.about_cta_links.signature}
          links={about.about_cta_links.links}
          socialLinks={about.social_links}
        />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd apps/web && npx next build --no-lint 2>&1 | head -50`

Check that `/about` appears in the route list without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/(public)/about/page.tsx
git commit -m "feat(about): add public /about page route with SEO + JSON-LD"
```

---

## Task 8: CMS Server Actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/actions.ts`
- Create: `apps/web/test/cms/authors-about-actions.test.ts`

- [ ] **Step 1: Write failing test for updateAuthorAbout**

```typescript
// apps/web/test/cms/authors-about-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', orgId: 'org-1' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ userId: 'user-1' }),
}))

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'author-1' }, error: null }),
    }),
  }),
})

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn().mockReturnValue({
    from: () => ({ update: mockUpdate }),
  }),
}))

vi.mock('@tn-figueiredo/cms', () => ({
  compileMdx: vi.fn().mockResolvedValue({ compiledSource: '<p>compiled</p>', toc: [], readingTimeMin: 1 }),
}))

vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
  revalidateAbout: vi.fn(),
}))

import { updateAuthorAbout } from '@/app/cms/(authed)/authors/actions'

describe('updateAuthorAbout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves about fields and revalidates cache', async () => {
    const result = await updateAuthorAbout('author-1', {
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      aboutMd: '# Hello',
      photoCaption: 'CN Tower',
      photoLocation: 'TORONTO · 2018',
    })

    expect(result.ok).toBe(true)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('rejects invalid headline exceeding max length', async () => {
    const result = await updateAuthorAbout('author-1', {
      headline: 'x'.repeat(201),
    })

    expect(result.ok).toBe(false)
  })

  it('compiles MDX when aboutMd is provided', async () => {
    const { compileMdx } = await import('@tn-figueiredo/cms')

    await updateAuthorAbout('author-1', {
      aboutMd: '# New content',
    })

    expect(compileMdx).toHaveBeenCalledWith('# New content')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:web -- --run test/cms/authors-about-actions.test.ts`

Expected: FAIL — `updateAuthorAbout` is not exported.

- [ ] **Step 3: Implement updateAuthorAbout and uploadAuthorAboutPhoto**

Add to `apps/web/src/app/cms/(authed)/authors/actions.ts`:

```typescript
// Add import at top
import { compileMdx } from '@tn-figueiredo/cms'
import { revalidateAbout } from '@/lib/newsletter/cache-invalidation'

// Add Zod schema
const aboutSchema = z.object({
  headline:      z.string().max(200).optional(),
  subtitle:      z.string().max(500).optional(),
  aboutMd:       z.string().max(50000).optional(),
  photoCaption:  z.string().max(200).optional(),
  photoLocation: z.string().max(100).optional(),
  aboutCtaLinks: z.object({
    kicker:    z.string().max(100),
    signature: z.string().max(200),
    links: z.array(z.object({
      type:  z.enum(['internal', 'social']),
      key:   z.string(),
      label: z.string().max(50),
    })).max(10),
  }).optional().nullable(),
  socialLinks: z.record(z.string().url().or(z.literal(''))).optional(),
})

// Add server action
export async function updateAuthorAbout(
  authorId: string,
  input: z.input<typeof aboutSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const parsed = aboutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  const data = parsed.data
  const updates: Record<string, unknown> = {}

  if (data.headline !== undefined) updates.headline = data.headline || null
  if (data.subtitle !== undefined) updates.subtitle = data.subtitle || null
  if (data.photoCaption !== undefined) updates.photo_caption = data.photoCaption || null
  if (data.photoLocation !== undefined) updates.photo_location = data.photoLocation || null
  if (data.aboutCtaLinks !== undefined) updates.about_cta_links = data.aboutCtaLinks
  if (data.socialLinks !== undefined) {
    const cleaned: Record<string, string> = {}
    for (const [k, v] of Object.entries(data.socialLinks)) {
      if (v) cleaned[k] = v
    }
    updates.social_links = Object.keys(cleaned).length > 0 ? cleaned : null
  }

  if (data.aboutMd !== undefined) {
    updates.about_md = data.aboutMd || null
    if (data.aboutMd) {
      try {
        const compiled = await compileMdx(data.aboutMd)
        updates.about_compiled = compiled.compiledSource
      } catch {
        return { ok: false, error: 'compile_failed' }
      }
    } else {
      updates.about_compiled = null
    }
  }

  const sb = getSupabaseServiceClient()
  const { error } = await sb
    .from('authors')
    .update(updates)
    .eq('id', authorId)

  if (error) return { ok: false, error: error.message }

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true }
}

export async function uploadAuthorAboutPhoto(
  authorId: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'no_file' }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!validTypes.includes(file.type)) return { ok: false, error: 'invalid_type' }
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'too_large' }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${authorId}/about.${ext}`

  const sb = getSupabaseServiceClient()
  const { error: uploadError } = await sb.storage
    .from('author-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = sb.storage.from('author-avatars').getPublicUrl(path)
  const url = `${urlData.publicUrl}?v=${Date.now()}`

  await sb.from('authors').update({ about_photo_url: url }).eq('id', authorId)

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true, url }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:web -- --run test/cms/authors-about-actions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/authors/actions.ts apps/web/test/cms/authors-about-actions.test.ts
git commit -m "feat(cms): add updateAuthorAbout + uploadAuthorAboutPhoto server actions"
```

---

## Task 9: CMS Author UI — Tab System + About Page Tab

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`

This is the largest task. The existing `DetailPanel` component inside `authors-connected.tsx` needs to be refactored to support tabs. The existing fields (Display Name, Bio, Avatar Color) move to a "Profile" tab. A new "About Page" tab contains all about-related field groups.

- [ ] **Step 1: Add tab state and tab UI to DetailPanel**

At the top of the `DetailPanel` component, add tab state:

```tsx
const [activeTab, setActiveTab] = useState<'profile' | 'about'>('profile')
```

Render tab buttons between the avatar block and the form fields:

```tsx
<div style={{ display: 'flex', gap: 0, padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
  <button
    onClick={() => setActiveTab('profile')}
    style={{
      padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
      color: activeTab === 'profile' ? '#e4e4e7' : '#52525b',
      borderBottom: activeTab === 'profile' ? '2px solid #6366f1' : '2px solid transparent',
      background: 'transparent', border: 'none', borderBottomStyle: 'solid',
    }}
  >
    Profile
  </button>
  <button
    onClick={() => setActiveTab('about')}
    style={{
      padding: '10px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
      color: activeTab === 'about' ? '#e4e4e7' : '#52525b',
      borderBottom: activeTab === 'about' ? '2px solid #6366f1' : '2px solid transparent',
      background: 'transparent', border: 'none', borderBottomStyle: 'solid',
    }}
  >
    About Page
  </button>
</div>
```

Wrap existing form fields in `{activeTab === 'profile' && (...)}`.

- [ ] **Step 2: Add about tab state variables**

Add state for all about fields:

```tsx
const [headline, setHeadline] = useState(author.headline ?? '')
const [subtitle, setSubtitle] = useState(author.subtitle ?? '')
const [aboutMd, setAboutMd] = useState(author.aboutMd ?? '')
const [photoCaption, setPhotoCaption] = useState(author.photoCaption ?? '')
const [photoLocation, setPhotoLocation] = useState(author.photoLocation ?? '')
const [aboutPhotoUrl, setAboutPhotoUrl] = useState(author.aboutPhotoUrl ?? '')
const [socialX, setSocialX] = useState(author.socialLinks?.x ?? '')
const [socialInstagram, setSocialInstagram] = useState(author.socialLinks?.instagram ?? '')
const [socialYoutube, setSocialYoutube] = useState(author.socialLinks?.youtube ?? '')
const [socialLinkedin, setSocialLinkedin] = useState(author.socialLinks?.linkedin ?? '')
const [ctaKicker, setCtaKicker] = useState(author.aboutCtaLinks?.kicker ?? '')
const [ctaSignature, setCtaSignature] = useState(author.aboutCtaLinks?.signature ?? '')
const [ctaLinks, setCtaLinks] = useState(author.aboutCtaLinks?.links ?? [])
const [aboutSaveState, setAboutSaveState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
```

- [ ] **Step 3: Add About Page tab content**

Add the About Page tab content with all 5 field groups (Headline & Subtitle, Photo, About Text, Social Links, CTA Block). Each field group uses a section divider label and the same input styling as the Profile tab.

The save handler calls `updateAuthorAbout` with all field values. The photo upload opens a file picker and calls `uploadAuthorAboutPhoto`.

This is a large UI component — the implementer should reference the CMS mockup at `.superpowers/brainstorm/48359-1777905795/content/cms-author-about-v2.html` for exact field layout and grouping.

- [ ] **Step 4: Update AuthorData interface to include about fields**

Add to the `AuthorData` interface:

```typescript
headline: string | null
subtitle: string | null
aboutMd: string | null
aboutCompiled: string | null
aboutPhotoUrl: string | null
photoCaption: string | null
photoLocation: string | null
aboutCtaLinks: {
  kicker: string
  signature: string
  links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
} | null
```

- [ ] **Step 5: Update page.tsx data query to include about columns**

In `apps/web/src/app/cms/(authed)/authors/page.tsx`, add the about columns to the select query and map them in the data transformation.

- [ ] **Step 6: Run all tests**

Run: `npm test`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/authors/
git commit -m "feat(cms): add About Page tab to author detail drawer with all field groups"
```

---

## Task 10: Integration Test — Full Flow

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: All tests pass (web + api).

- [ ] **Step 2: Start dev server and verify manually**

Run: `cd apps/web && npm run dev`

Verify:
1. Open `/cms/authors` → click author → see Profile / About Page tabs
2. Switch to About Page tab → see all field groups
3. Fill in headline, subtitle, about text → Save → success
4. Open `/about` → page renders with the saved content
5. Check SEO: view source → JSON-LD `@graph` has `BreadcrumbList`
6. Check responsive: resize to mobile → grid collapses

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(about): integration fixes from manual testing"
```
