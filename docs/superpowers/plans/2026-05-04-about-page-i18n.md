# About Page i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-locale about content via `author_about_translations` table so `/about` can serve pt-BR and en independently.

**Architecture:** Normalized translation table (`author_about_translations`) following the `blog_translations` pattern. Public page reads locale from `x-locale` header (set by middleware), queries with locale-aware fallback. CMS adds locale tabs inside the existing "About Page" tab with lazy-loaded per-locale state and upsert save.

**Tech Stack:** PostgreSQL (Supabase), Next.js 15, React 19, TypeScript 5, Vitest

**Spec:** `docs/superpowers/specs/2026-05-04-about-page-i18n-design.md`

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260504000003_author_about_translations.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Phase 1: Create table + RLS
CREATE TABLE author_about_translations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id      uuid NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  locale         text NOT NULL,
  headline       text,
  subtitle       text,
  about_md       text,
  about_compiled text,
  photo_caption  text,
  photo_location text,
  about_cta_links jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT author_about_tx_author_locale_uniq UNIQUE (author_id, locale),
  CONSTRAINT author_about_tx_cta_valid CHECK (
    about_cta_links IS NULL OR (
      about_cta_links ? 'links'
      AND jsonb_typeof(about_cta_links -> 'links') = 'array'
    )
  )
);

DROP TRIGGER IF EXISTS author_about_tx_set_updated_at ON author_about_translations;
CREATE TRIGGER author_about_tx_set_updated_at
  BEFORE UPDATE ON author_about_translations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE author_about_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "about_tx_public_read" ON author_about_translations;
CREATE POLICY "about_tx_public_read" ON author_about_translations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS "about_tx_staff_write" ON author_about_translations;
CREATE POLICY "about_tx_staff_write" ON author_about_translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.can_edit_site(a.site_id)
    )
  );

-- Phase 2: Migrate existing data to pt-BR
INSERT INTO author_about_translations
  (author_id, locale, headline, subtitle, about_md, about_compiled,
   photo_caption, photo_location, about_cta_links)
SELECT
  id, 'pt-BR', headline, subtitle, about_md, about_compiled,
  photo_caption, photo_location, about_cta_links
FROM authors
WHERE headline IS NOT NULL
   OR subtitle IS NOT NULL
   OR about_md IS NOT NULL
   OR about_compiled IS NOT NULL
   OR photo_caption IS NOT NULL
   OR photo_location IS NOT NULL
   OR about_cta_links IS NOT NULL;

-- Phase 3: Drop migrated columns from authors
ALTER TABLE authors DROP CONSTRAINT IF EXISTS authors_about_cta_links_valid;

ALTER TABLE authors
  DROP COLUMN IF EXISTS headline,
  DROP COLUMN IF EXISTS subtitle,
  DROP COLUMN IF EXISTS about_md,
  DROP COLUMN IF EXISTS about_compiled,
  DROP COLUMN IF EXISTS photo_caption,
  DROP COLUMN IF EXISTS photo_location,
  DROP COLUMN IF EXISTS about_cta_links;
```

- [ ] **Step 2: Verify migration syntax locally (if local DB available)**

Run: `npm run db:start && npm run db:reset`
Expected: Migration applies without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260504000003_author_about_translations.sql
git commit -m "feat(db): add author_about_translations table for about page i18n"
```

---

### Task 2: Data Layer — queries.ts Refactor

**Files:**
- Modify: `apps/web/lib/about/queries.ts`
- Test: `apps/web/test/about/about-queries.test.ts`

- [ ] **Step 1: Update the test file with 2-phase fetch mocks**

Replace the entire test file `apps/web/test/about/about-queries.test.ts`:

```typescript
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

function buildMockClient(authorData: unknown, translationData: unknown[], allLocales: unknown[]) {
  const fromMap: Record<string, unknown> = {
    authors: {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: authorData, error: null }),
          }),
        }),
      }),
    },
    author_about_translations: (() => {
      let callCount = 0
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: translationData,
                error: null,
              }),
            }),
            // For the availableLocales query (second call)
            then: undefined,
          }),
        }),
      }
    })(),
  }

  // We need separate mock chains for the two translation queries
  let translationCallCount = 0
  const mockFrom = vi.fn((table: string) => {
    if (table === 'authors') return fromMap.authors
    if (table === 'author_about_translations') {
      translationCallCount++
      if (translationCallCount === 1) {
        // First call: fetch translation by locale
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: translationData,
                  error: null,
                }),
              }),
            }),
          }),
        }
      } else {
        // Second call: fetch available locales
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: allLocales,
              error: null,
            }),
          }),
        }
      }
    }
    return fromMap.authors
  })

  return { from: mockFrom }
}

describe('getAboutData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns merged author + translation data for requested locale', async () => {
    const author = {
      id: 'a1',
      display_name: 'Thiago',
      about_photo_url: 'https://example.com/photo.jpg',
      social_links: { x: 'https://x.com/test' },
    }
    const translation = {
      locale: 'pt-BR',
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      about_md: '# Hello',
      about_compiled: '<p>compiled</p>',
      photo_caption: 'CN Tower',
      photo_location: 'TORONTO · 2018',
      about_cta_links: { kicker: 'Vem junto', signature: 'tf', links: [] },
    }
    const client = buildMockClient(author, [translation], [{ locale: 'pt-BR' }])
    ;(getSupabaseServiceClient as any).mockReturnValue(client)

    const result = await getAboutData('site-123', 'pt-BR')
    expect(result).not.toBeNull()
    expect(result!.headline).toBe('eu sou |Thiago.')
    expect(result!.display_name).toBe('Thiago')
    expect(result!.about_photo_url).toBe('https://example.com/photo.jpg')
    expect(result!.locale).toBe('pt-BR')
    expect(result!.availableLocales).toEqual(['pt-BR'])
  })

  it('returns null when no default author exists', async () => {
    const client = buildMockClient(null, [], [])
    ;(getSupabaseServiceClient as any).mockReturnValue(client)

    const result = await getAboutData('site-123', 'en')
    expect(result).toBeNull()
  })

  it('returns null when no translations exist at all', async () => {
    const author = {
      id: 'a1',
      display_name: 'Thiago',
      about_photo_url: null,
      social_links: null,
    }
    const client = buildMockClient(author, [], [])
    ;(getSupabaseServiceClient as any).mockReturnValue(client)

    const result = await getAboutData('site-123', 'en')
    expect(result).toBeNull()
  })

  it('falls back to any available locale when requested locale is missing', async () => {
    const author = {
      id: 'a1',
      display_name: 'Thiago',
      about_photo_url: null,
      social_links: null,
    }
    const translation = {
      locale: 'pt-BR',
      headline: 'eu sou |Thiago.',
      subtitle: null,
      about_md: null,
      about_compiled: null,
      photo_caption: null,
      photo_location: null,
      about_cta_links: null,
    }
    const client = buildMockClient(author, [translation], [{ locale: 'pt-BR' }])
    ;(getSupabaseServiceClient as any).mockReturnValue(client)

    const result = await getAboutData('site-123', 'en')
    expect(result).not.toBeNull()
    expect(result!.locale).toBe('pt-BR')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/about/about-queries.test.ts`
Expected: FAIL — `getAboutData` still takes 1 parameter.

- [ ] **Step 3: Rewrite queries.ts with 2-phase fetch**

Replace `apps/web/lib/about/queries.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AboutData {
  // From authors (shared)
  authorId: string
  display_name: string
  about_photo_url: string | null
  social_links: Record<string, string> | null
  // From author_about_translations (locale-specific)
  locale: string
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
  // Aggregated
  availableLocales: string[]
}

interface AuthorRow {
  id: string
  display_name: string
  about_photo_url: string | null
  social_links: Record<string, string> | null
}

interface TranslationRow {
  locale: string
  headline: string | null
  subtitle: string | null
  about_md: string | null
  about_compiled: string | null
  photo_caption: string | null
  photo_location: string | null
  about_cta_links: AboutData['about_cta_links']
}

async function fetchAboutData(siteId: string, locale: string): Promise<AboutData | null> {
  const sb = getSupabaseServiceClient()

  // Phase 1: shared author fields
  const { data: author, error: authorErr } = await sb
    .from('authors')
    .select('id, display_name, about_photo_url, social_links')
    .eq('site_id', siteId)
    .eq('is_default', true)
    .single()

  if (authorErr || !author) return null
  const a = author as unknown as AuthorRow

  // Phase 2: locale-specific translation with fallback
  const { data: translations } = await sb
    .from('author_about_translations')
    .select('locale, headline, subtitle, about_md, about_compiled, photo_caption, photo_location, about_cta_links')
    .eq('author_id', a.id)
    .order('locale', { ascending: true })
    .limit(50)

  const txRows = (translations ?? []) as unknown as TranslationRow[]
  const tx = txRows.find((t) => t.locale === locale) ?? txRows[0]
  if (!tx) return null

  const availableLocales = txRows.map((t) => t.locale)

  return {
    authorId: a.id,
    display_name: a.display_name,
    about_photo_url: a.about_photo_url,
    social_links: a.social_links,
    locale: tx.locale,
    headline: tx.headline,
    subtitle: tx.subtitle,
    about_md: tx.about_md,
    about_compiled: tx.about_compiled,
    photo_caption: tx.photo_caption,
    photo_location: tx.photo_location,
    about_cta_links: tx.about_cta_links,
    availableLocales,
  }
}

export function getAboutData(siteId: string, locale: string = 'pt-BR'): Promise<AboutData | null> {
  return unstable_cache(
    () => fetchAboutData(siteId, locale),
    [`about:${siteId}:${locale}`],
    { tags: [`about:${siteId}`], revalidate: 300 },
  )()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/about/about-queries.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/about/queries.ts apps/web/test/about/about-queries.test.ts
git commit -m "feat(about): refactor queries to 2-phase fetch from author_about_translations"
```

---

### Task 3: Locale JSON Strings

**Files:**
- Modify: `apps/web/src/locales/en.json`
- Modify: `apps/web/src/locales/pt-BR.json`

- [ ] **Step 1: Add about.kicker and about.breadcrumb keys to en.json**

Add these entries at the end of `apps/web/src/locales/en.json` (before the closing `}`):

```json
  "about.kicker": "HELLO",
  "about.breadcrumb": "About"
```

- [ ] **Step 2: Add about.kicker and about.breadcrumb keys to pt-BR.json**

Add these entries at the end of `apps/web/src/locales/pt-BR.json` (before the closing `}`):

```json
  "about.kicker": "OLÁ",
  "about.breadcrumb": "Sobre"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/locales/en.json apps/web/src/locales/pt-BR.json
git commit -m "feat(i18n): add about.kicker and about.breadcrumb locale keys"
```

---

### Task 4: Public Page + SEO

**Files:**
- Modify: `apps/web/src/app/(public)/about/page.tsx`
- Modify: `apps/web/src/app/(public)/about/components/AboutHero.tsx`
- Modify: `apps/web/lib/seo/page-metadata.ts`

**Dependencies:** Task 2 (queries.ts), Task 3 (locale JSON keys)

- [ ] **Step 1: Update AboutHero to accept kicker prop**

Replace `apps/web/src/app/(public)/about/components/AboutHero.tsx`:

```typescript
interface AboutHeroProps {
  headline: string
  kicker?: string
}

export function AboutHero({ headline, kicker = 'OLÁ' }: AboutHeroProps) {
  const parts = headline.split('|')
  const before = parts[0] ?? ''
  const highlighted = parts.slice(1).join('|')

  return (
    <section style={{ maxWidth: 1080, margin: '0 auto', padding: '72px 28px 24px' }}>
      <div className="about-kicker">§ {kicker}</div>
      <h1 className="about-headline">
        <span>{before}</span>
        {highlighted && (
          <span className="about-marker">
            <span className="about-marker-text">{highlighted}</span>
            <span className="about-marker-bg" aria-hidden="true" />
          </span>
        )}
      </h1>
    </section>
  )
}
```

- [ ] **Step 2: Update generateAboutMetadata with locale + hreflang**

In `apps/web/lib/seo/page-metadata.ts`, replace the `generateAboutMetadata` function:

```typescript
export function generateAboutMetadata(
  config: SiteSeoConfig,
  subtitle: string | null,
  aboutPhotoUrl: string | null,
  locale: string,
  availableLocales: string[],
): Metadata {
  const title = locale === 'pt-BR'
    ? `Sobre — ${config.siteName}`
    : `About — ${config.siteName}`
  const description = subtitle ?? `About ${config.siteName}`
  const ogImage = aboutPhotoUrl ?? config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`

  const languages: Record<string, string> = {}
  for (const loc of availableLocales) {
    languages[hreflangCode(loc)] = localePath('/about', loc)
  }
  if (availableLocales.length > 0) {
    const defaultLoc = availableLocales.includes(config.defaultLocale)
      ? config.defaultLocale
      : availableLocales[0]
    languages['x-default'] = localePath('/about', defaultLoc)
  }

  return {
    ...baseMetadata(config),
    title,
    description,
    openGraph: {
      ...baseMetadata(config).openGraph,
      title,
      description,
      images: [{ url: ogImage }],
      url: `${config.siteUrl}${localePath('/about', locale)}`,
    },
    alternates: {
      canonical: localePath('/about', locale),
      languages,
    },
  }
}
```

- [ ] **Step 3: Update the about page.tsx for locale awareness**

Replace `apps/web/src/app/(public)/about/page.tsx`:

```typescript
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
import { localePath } from '@/lib/i18n/locale-path'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { AboutHero } from './components/AboutHero'
import { Polaroid } from './components/Polaroid'
import { AboutContent } from './components/AboutContent'
import { CtaBlock } from './components/CtaBlock'
import './about.css'

import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

const LOCALE_STRINGS: Record<string, Record<string, unknown>> = {
  en: enStrings,
  'pt-BR': ptBrStrings,
}

function t(locale: string, key: string): string {
  const strings = LOCALE_STRINGS[locale] ?? LOCALE_STRINGS['en']
  return (strings[key] as string) ?? key
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const h = await headers()
  const host = h.get('host') ?? ''
  const locale = h.get('x-locale') ?? 'en'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const about = await getAboutData(ctx.siteId, locale)
  if (!about) return {}
  return generateAboutMetadata(config, about.subtitle, about.about_photo_url, about.locale, about.availableLocales)
}

export default async function AboutPage() {
  const ctx = await tryGetSiteContext()
  if (!ctx) notFound()

  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'

  const about = await getAboutData(ctx.siteId, locale)
  if (!about) notFound()

  const host = h.get('host') ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host)

  const breadcrumb = buildBreadcrumbNode([
    { name: 'Home', url: config.siteUrl },
    { name: t(about.locale, 'about.breadcrumb'), url: `${config.siteUrl}${localePath('/about', about.locale)}` },
  ])
  const graph = composeGraph([breadcrumb])

  return (
    <div className="about-page">
      <JsonLdScript graph={graph} />

      {about.headline && (
        <AboutHero headline={about.headline} kicker={t(about.locale, 'about.kicker')} />
      )}

      {about.availableLocales.length > 1 && (
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 28px' }}>
          <LocaleSwitcher
            available={about.availableLocales}
            current={about.locale}
            hrefFor={(loc) => localePath('/about', loc)}
          />
        </div>
      )}

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

      {about.about_cta_links ? (
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

- [ ] **Step 4: Run type check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -30`
Expected: No errors related to about page files.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/about/page.tsx apps/web/src/app/\(public\)/about/components/AboutHero.tsx apps/web/lib/seo/page-metadata.ts
git commit -m "feat(about): locale-aware public page with hreflang alternates"
```

---

### Task 5: CMS Actions — Locale-aware upsert + getAuthorAboutTranslations

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/actions.ts`
- Test: `apps/web/test/cms/authors-about-actions.test.ts`

- [ ] **Step 1: Update test file for locale-aware actions**

Replace `apps/web/test/cms/authors-about-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
  revalidateAbout: vi.fn(),
}))

const mockEq = vi.fn()
const mockUpdate = vi.fn()
const mockUpsert = vi.fn()
const mockSelect = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = mockEq.mockReturnValue(chain)
  chain.select = mockSelect.mockReturnValue(chain)
  chain.single = vi.fn().mockResolvedValue({ data: { slug: 'test-site', supported_locales: ['pt-BR', 'en'] }, error: null })
  chain.update = mockUpdate.mockReturnValue(chain)
  chain.upsert = mockUpsert.mockResolvedValue({ error: null })
  chain.then = (resolve: (v: unknown) => void) => resolve({ error: null })
  return chain
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => makeChain()),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@tn-figueiredo/cms', () => ({
  compileMdx: vi.fn().mockResolvedValue({
    compiledSource: '<p>compiled</p>',
    toc: [],
    readingTimeMin: 1,
  }),
  defaultComponents: {},
}))

import { updateAuthorAbout } from '@/app/cms/(authed)/authors/actions'

describe('updateAuthorAbout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves about fields with locale via upsert and returns ok', async () => {
    const result = await updateAuthorAbout('author-1', 'pt-BR', {
      headline: 'eu sou |Thiago.',
      subtitle: '37 anos',
      aboutMd: '# Hello',
      photoCaption: 'CN Tower',
      photoLocation: 'TORONTO · 2018',
    })

    expect(result.ok).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('rejects headline exceeding max length', async () => {
    const result = await updateAuthorAbout('author-1', 'pt-BR', {
      headline: 'x'.repeat(201),
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('validation_failed')
  })

  it('compiles MDX when aboutMd is provided', async () => {
    const { compileMdx } = await import('@tn-figueiredo/cms')

    await updateAuthorAbout('author-1', 'pt-BR', {
      aboutMd: '# New content',
    })

    expect(compileMdx).toHaveBeenCalledWith('# New content', {})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-about-actions.test.ts`
Expected: FAIL — `updateAuthorAbout` still takes 2 parameters (no locale).

- [ ] **Step 3: Refactor actions.ts**

In `apps/web/src/app/cms/(authed)/authors/actions.ts`, make these changes:

**3a. Update `aboutSchema` — remove socialLinks (stays on authors table):**

Replace the `aboutSchema` definition:

```typescript
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
})
```

**3b. Replace the `updateAuthorAbout` function with locale-aware upsert:**

```typescript
export async function updateAuthorAbout(
  authorId: string,
  locale: string,
  input: z.input<typeof aboutSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const siteId = await requireEditAccess()

  const parsed = aboutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed' }

  // Validate locale against site's supported_locales
  const sb = getSupabaseServiceClient()
  const { data: siteRow } = await sb
    .from('sites')
    .select('supported_locales')
    .eq('id', siteId)
    .single()

  const supportedLocales = (siteRow as unknown as { supported_locales: string[] } | null)?.supported_locales ?? []
  if (!supportedLocales.includes(locale)) {
    return { ok: false, error: 'unsupported_locale' }
  }

  const data = parsed.data
  const updates: Record<string, unknown> = {
    author_id: authorId,
    locale,
  }

  if (data.headline !== undefined) updates.headline = data.headline || null
  if (data.subtitle !== undefined) updates.subtitle = data.subtitle || null
  if (data.photoCaption !== undefined) updates.photo_caption = data.photoCaption || null
  if (data.photoLocation !== undefined) updates.photo_location = data.photoLocation || null
  if (data.aboutCtaLinks !== undefined) updates.about_cta_links = data.aboutCtaLinks

  if (data.aboutMd !== undefined) {
    updates.about_md = data.aboutMd || null
    if (data.aboutMd) {
      try {
        const compiled = await compileMdx(data.aboutMd, defaultComponents)
        updates.about_compiled = compiled.compiledSource
      } catch {
        return { ok: false, error: 'compile_failed' }
      }
    } else {
      updates.about_compiled = null
    }
  }

  const { error } = await sb
    .from('author_about_translations')
    .upsert(updates, { onConflict: 'author_id,locale' })

  if (error) return { ok: false, error: error.message }

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true }
}
```

**3c. Add new `getAuthorAboutTranslations` action:**

Add this new exported function after `updateAuthorAbout`:

```typescript
export async function getAuthorAboutTranslations(
  authorId: string,
): Promise<Record<string, {
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
} | null>> {
  await requireEditAccess()
  const sb = getSupabaseServiceClient()

  const { data } = await sb
    .from('author_about_translations')
    .select('locale, headline, subtitle, about_md, photo_caption, photo_location, about_cta_links')
    .eq('author_id', authorId)

  const result: Record<string, unknown> = {}
  for (const row of (data ?? []) as unknown as Array<{
    locale: string
    headline: string | null
    subtitle: string | null
    about_md: string | null
    photo_caption: string | null
    photo_location: string | null
    about_cta_links: unknown
  }>) {
    result[row.locale] = {
      headline: row.headline,
      subtitle: row.subtitle,
      aboutMd: row.about_md,
      photoCaption: row.photo_caption,
      photoLocation: row.photo_location,
      aboutCtaLinks: row.about_cta_links,
    }
  }

  return result as Record<string, any>
}
```

**3d. Fix `setDefaultAuthor` gap — add `revalidateAbout(siteId)` call:**

In the `setDefaultAuthor` function, add `revalidateAbout(siteId)` after the existing `revalidatePath('/cms/authors')` line:

```typescript
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  revalidateAbout(siteId)
  return { ok: true }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-about-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/authors/actions.ts apps/web/test/cms/authors-about-actions.test.ts
git commit -m "feat(cms): locale-aware upsert for about translations + getAuthorAboutTranslations"
```

---

### Task 6: CMS UI — Authors page.tsx + authors-connected.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`

**Dependencies:** Task 5 (new actions)

- [ ] **Step 1: Update page.tsx — drop about columns, add supportedLocales**

Replace the `AuthorRow` interface and the SELECT query in `apps/web/src/app/cms/(authed)/authors/page.tsx`:

**1a. Replace `AuthorRow` interface:**

```typescript
interface AuthorRow {
  id: string
  display_name: string | null
  name: string
  slug: string | null
  bio: string | null
  avatar_url: string | null
  avatar_color: string | null
  user_id: string | null
  social_links: Record<string, string> | null
  sort_order: number | null
  is_default: boolean | null
  about_photo_url: string | null
}
```

**1b. Replace the SELECT query (remove 7 dropped columns):**

```typescript
  const { data: authors } = await supabase
    .from('authors')
    .select(
      'id, display_name, name, slug, bio, avatar_url, avatar_color, user_id, social_links, sort_order, is_default, about_photo_url',
    )
    .eq('site_id', siteId)
    .order('sort_order')
```

**1c. Add `supportedLocales` query after the existing post counts logic:**

```typescript
  // Fetch supported locales for the site
  const { data: siteRow } = await supabase
    .from('sites')
    .select('supported_locales')
    .eq('id', siteId)
    .single()
  const supportedLocales: string[] = (siteRow as unknown as { supported_locales: string[] } | null)?.supported_locales ?? ['pt-BR']
```

**1d. Update `authorData` mapping — drop about fields, keep `aboutPhotoUrl`:**

```typescript
  const authorData: AuthorData[] = ((authors as AuthorRow[] | null) ?? []).map(
    (a) => {
      const displayName = a.display_name ?? a.name
      return {
        id: a.id,
        displayName,
        slug: a.slug ?? a.id.slice(0, 8),
        bio: a.bio,
        avatarUrl: a.avatar_url,
        avatarColor: a.avatar_color,
        initials: displayName
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
        userId: a.user_id,
        socialLinks: (a.social_links as Record<string, string>) ?? {},
        sortOrder: a.sort_order ?? 0,
        isDefault: a.is_default ?? false,
        postsCount: postCounts[a.id] ?? 0,
        aboutPhotoUrl: a.about_photo_url,
      }
    },
  )
```

**1e. Pass `supportedLocales` to `AuthorsConnected`:**

```tsx
  return (
    <div>
      <CmsTopbar title="Authors" />
      <AuthorsConnected authors={authorData} readOnly={readOnly} supportedLocales={supportedLocales} />
    </div>
  )
```

- [ ] **Step 2: Update authors-connected.tsx — AuthorData, Props, locale tabs, lazy load**

**2a. Update `AuthorData` interface — drop about fields, keep aboutPhotoUrl:**

```typescript
export interface AuthorData {
  id: string
  displayName: string
  slug: string
  bio: string | null
  avatarUrl: string | null
  avatarColor: string | null
  initials: string
  userId: string | null
  socialLinks: Record<string, string>
  sortOrder: number
  isDefault: boolean
  postsCount: number
  aboutPhotoUrl: string | null
}
```

**2b. Update `Props` interface:**

```typescript
interface Props {
  authors: AuthorData[]
  readOnly?: boolean
  supportedLocales?: string[]
}
```

**2c. Add import for `getAuthorAboutTranslations`:**

Add to the existing imports from `./actions`:

```typescript
import {
  createAuthor,
  updateAuthor,
  deleteAuthor,
  setDefaultAuthor,
  uploadAuthorAvatar,
  updateAuthorAbout,
  uploadAuthorAboutPhoto,
  getAuthorAboutTranslations,
} from './actions'
```

**2d. Add `AboutTranslation` type after `SaveState`:**

```typescript
interface AboutTranslation {
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
}
```

**2e. Rewrite the `DetailPanel` "About Page" tab section to use locale tabs + lazy loading.**

In the `DetailPanel` component, replace the about-tab state initialization (lines ~273-291) with locale-aware state:

Replace all about-field `useState` calls (headline, subtitle, aboutMd, photoCaption, photoLocation, ctaKicker, ctaSignature, ctaLinks, socialX, socialInstagram, socialYoutube, socialLinkedin, aboutSaveState) with locale-aware versions. Also add the lazy loading `useEffect`.

The `DetailPanel` component needs a new prop `supportedLocales: string[]`.

Update the `DetailPanel` signature:

```typescript
function DetailPanel({
  author,
  onClose,
  onUpdate,
  onDelete,
  onSetDefault,
  readOnly,
  supportedLocales,
}: {
  author: AuthorData
  onClose: () => void
  onUpdate: (id: string, data: { display_name?: string; bio?: string | null; social_links?: Record<string, string>; avatar_color?: string | null }) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
  readOnly: boolean
  supportedLocales: string[]
}) {
```

Add new state for locale-aware about tab. Replace the about-specific state block (the lines for headline, subtitle, aboutMd, etc.) with:

```typescript
  const [aboutLocale, setAboutLocale] = useState(supportedLocales[0] ?? 'pt-BR')
  const [translations, setTranslations] = useState<Record<string, AboutTranslation | null>>({})
  const [translationsLoaded, setTranslationsLoaded] = useState(false)

  // Lazy load translations when About tab is opened
  const loadTranslations = useCallback(async () => {
    if (translationsLoaded) return
    const data = await getAuthorAboutTranslations(author.id)
    setTranslations(data as Record<string, AboutTranslation | null>)
    setTranslationsLoaded(true)
  }, [author.id, translationsLoaded])

  // Load when about tab becomes active
  const prevActiveTab = useRef(activeTab)
  if (activeTab === 'about' && prevActiveTab.current !== 'about') {
    loadTranslations()
  }
  prevActiveTab.current = activeTab

  // Per-locale field state — reset when aboutLocale changes
  const currentTx = translations[aboutLocale]
  const [headline, setHeadline] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [aboutMd, setAboutMd] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [photoLocation, setPhotoLocation] = useState('')
  const [aboutPhotoUrl, setAboutPhotoUrl] = useState(author.aboutPhotoUrl ?? '')
  const [aboutPhotoUploading, setAboutPhotoUploading] = useState(false)
  const aboutFileRef = useRef<HTMLInputElement>(null)
  const [socialX, setSocialX] = useState(author.socialLinks?.x ?? '')
  const [socialInstagram, setSocialInstagram] = useState(author.socialLinks?.instagram ?? '')
  const [socialYoutube, setSocialYoutube] = useState(author.socialLinks?.youtube ?? '')
  const [socialLinkedin, setSocialLinkedin] = useState(author.socialLinks?.linkedin ?? '')
  const [ctaKicker, setCtaKicker] = useState('')
  const [ctaSignature, setCtaSignature] = useState('')
  const [ctaLinks, setCtaLinks] = useState<Array<{ type: 'internal' | 'social'; key: string; label: string }>>([])
  const [aboutSaveState, setAboutSaveState] = useState<SaveState>('idle')

  // Sync fields when translation data loads or locale changes
  const lastSyncedLocale = useRef<string | null>(null)
  if (translationsLoaded && lastSyncedLocale.current !== aboutLocale) {
    const tx = translations[aboutLocale]
    setHeadline(tx?.headline ?? '')
    setSubtitle(tx?.subtitle ?? '')
    setAboutMd(tx?.aboutMd ?? '')
    setPhotoCaption(tx?.photoCaption ?? '')
    setPhotoLocation(tx?.photoLocation ?? '')
    setCtaKicker(tx?.aboutCtaLinks?.kicker ?? '')
    setCtaSignature(tx?.aboutCtaLinks?.signature ?? '')
    setCtaLinks(tx?.aboutCtaLinks?.links ?? [])
    lastSyncedLocale.current = aboutLocale
  }

  const handleLocaleSwitch = useCallback((newLocale: string) => {
    // Dirty check — compare current fields to loaded translation
    const tx = translations[aboutLocale]
    const isDirty =
      headline !== (tx?.headline ?? '') ||
      subtitle !== (tx?.subtitle ?? '') ||
      aboutMd !== (tx?.aboutMd ?? '') ||
      photoCaption !== (tx?.photoCaption ?? '') ||
      photoLocation !== (tx?.photoLocation ?? '')

    if (isDirty) {
      const confirmed = window.confirm('You have unsaved changes. Switch locale and lose changes?')
      if (!confirmed) return
    }

    lastSyncedLocale.current = null // Force re-sync
    setAboutLocale(newLocale)
  }, [aboutLocale, translations, headline, subtitle, aboutMd, photoCaption, photoLocation])
```

Update `handleAboutSave` to pass locale:

```typescript
  const handleAboutSave = useCallback(async () => {
    if (readOnly) return
    setAboutSaveState('saving')
    const result = await updateAuthorAbout(author.id, aboutLocale, {
      headline: headline || undefined,
      subtitle: subtitle || undefined,
      aboutMd: aboutMd || undefined,
      photoCaption: photoCaption || undefined,
      photoLocation: photoLocation || undefined,
      aboutCtaLinks: (ctaKicker || ctaSignature || ctaLinks.length > 0) ? {
        kicker: ctaKicker,
        signature: ctaSignature,
        links: ctaLinks,
      } : null,
    })
    if (result.ok) {
      // Update local translations cache
      setTranslations((prev) => ({
        ...prev,
        [aboutLocale]: {
          headline: headline || null,
          subtitle: subtitle || null,
          aboutMd: aboutMd || null,
          photoCaption: photoCaption || null,
          photoLocation: photoLocation || null,
          aboutCtaLinks: (ctaKicker || ctaSignature || ctaLinks.length > 0) ? {
            kicker: ctaKicker,
            signature: ctaSignature,
            links: ctaLinks,
          } : null,
        },
      }))
    }
    setAboutSaveState(result.ok ? 'success' : 'error')
    setTimeout(() => setAboutSaveState('idle'), 2000)
  }, [
    author.id, readOnly, aboutLocale, headline, subtitle, aboutMd, photoCaption, photoLocation,
    ctaKicker, ctaSignature, ctaLinks,
  ])
```

**2f. Add locale tabs to the About tab section in JSX.**

In the `{activeTab === 'about' && (` block, add locale tabs at the top, before the "Headline & Subtitle" section:

```tsx
        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Locale tabs */}
            {supportedLocales.length > 1 && (
              <div className="flex gap-0 border-b border-slate-700">
                {supportedLocales.map((loc) => {
                  const hasContent = translations[loc] != null
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => handleLocaleSwitch(loc)}
                      className={`px-3 py-2 text-sm font-medium transition-colors ${
                        aboutLocale === loc
                          ? 'border-b-2 border-indigo-500 text-slate-100'
                          : hasContent
                            ? 'text-slate-400 hover:text-slate-300'
                            : 'text-slate-600 hover:text-slate-400'
                      }`}
                    >
                      {loc}{!hasContent && ' (empty)'}
                    </button>
                  )
                })}
              </div>
            )}

            {!translationsLoaded && (
              <div className="py-4 text-center text-sm text-slate-500">Loading translations...</div>
            )}

            {translationsLoaded && (
              <>
                {/* ... existing Headline & Subtitle, Photo, About Text sections ... */}
```

Close the `translationsLoaded` conditional before the save button section so that save only shows when loaded.

Note: The Social Links section should be moved OUT of the per-locale block since social links stay shared on the `authors` table. Social links should remain in the About tab but outside the locale tabs — they save via `updateAuthor()`, not `updateAuthorAbout()`.

The save handler for social links needs to be a separate function that calls `updateAuthor`:

```typescript
  const handleSocialLinksSave = useCallback(async () => {
    if (readOnly) return
    const socialLinks: Record<string, string> = {}
    if (socialX) socialLinks.x = socialX
    if (socialInstagram) socialLinks.instagram = socialInstagram
    if (socialYoutube) socialLinks.youtube = socialYoutube
    if (socialLinkedin) socialLinks.linkedin = socialLinkedin
    onUpdate(author.id, { social_links: Object.keys(socialLinks).length > 0 ? socialLinks : {} })
  }, [author.id, readOnly, socialX, socialInstagram, socialYoutube, socialLinkedin, onUpdate])
```

The Social Links section renders after the locale-gated content, with its own save button.

- [ ] **Step 3: Update `AuthorsConnected` to pass `supportedLocales` to `DetailPanel`**

In the `AuthorsConnected` component:

Update the function signature:

```typescript
export function AuthorsConnected({ authors, readOnly = false, supportedLocales = ['pt-BR'] }: Props) {
```

Pass `supportedLocales` to `DetailPanel`:

```tsx
      {selectedAuthor && (
        <DetailPanel
          key={selectedAuthor.id}
          author={selectedAuthor}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          readOnly={readOnly}
          supportedLocales={supportedLocales}
        />
      )}
```

- [ ] **Step 4: Run type check and tests**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -40`
Then: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -20`
Expected: Type check clean, tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/authors/page.tsx apps/web/src/app/cms/\(authed\)/authors/authors-connected.tsx
git commit -m "feat(cms): locale tabs in about page tab with lazy-loaded translations"
```

---

### Task 7: Test for getAuthorAboutTranslations

**Files:**
- Create: `apps/web/test/cms/authors-about-translations.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
  revalidateAbout: vi.fn(),
}))

const mockSelect = vi.fn()
const mockEq = vi.fn()

function makeChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  chain.eq = mockEq
  chain.select = mockSelect
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null })
  return chain
}

let translationRows: unknown[] = []

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'author_about_translations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: translationRows,
              error: null,
            }),
          }),
        }
      }
      return makeChain()
    }),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({
    siteId: 'site-1',
    orgId: 'org-1',
    defaultLocale: 'pt-BR',
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'u1' } }),
}))

vi.mock('@tn-figueiredo/cms', () => ({
  compileMdx: vi.fn().mockResolvedValue({ compiledSource: '', toc: [], readingTimeMin: 0 }),
  defaultComponents: {},
}))

import { getAuthorAboutTranslations } from '@/app/cms/(authed)/authors/actions'

describe('getAuthorAboutTranslations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    translationRows = []
  })

  it('returns empty record when no translations exist', async () => {
    translationRows = []
    const result = await getAuthorAboutTranslations('author-1')
    expect(result).toEqual({})
  })

  it('returns translations keyed by locale', async () => {
    translationRows = [
      {
        locale: 'pt-BR',
        headline: 'Olá',
        subtitle: 'sub',
        about_md: '# md',
        photo_caption: 'cap',
        photo_location: 'loc',
        about_cta_links: null,
      },
      {
        locale: 'en',
        headline: 'Hello',
        subtitle: null,
        about_md: null,
        photo_caption: null,
        photo_location: null,
        about_cta_links: null,
      },
    ]
    const result = await getAuthorAboutTranslations('author-1')
    expect(result['pt-BR']).toBeTruthy()
    expect(result['pt-BR']!.headline).toBe('Olá')
    expect(result['en']).toBeTruthy()
    expect(result['en']!.headline).toBe('Hello')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-about-translations.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/cms/authors-about-translations.test.ts
git commit -m "test(cms): add getAuthorAboutTranslations action tests"
```

---

### Task 8: Run Full Test Suite + Fix Any Regressions

**Files:** Any files touched in Tasks 1-7

- [ ] **Step 1: Run the full web test suite**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web 2>&1 | tail -40`
Expected: All tests pass.

- [ ] **Step 2: Fix any failures**

If the `authors-connected.test.tsx` or `apps/web/test/app/cms/authors.test.tsx` tests fail due to changed interfaces (AuthorData no longer having about fields, new `supportedLocales` prop), update them to match the new interfaces.

The most likely failure: `authors.test.tsx` may reference AuthorData properties that were removed (headline, subtitle, etc.). Remove those from test data objects.

The `authors-connected.test.tsx` may need `supportedLocales` prop added to renders.

- [ ] **Step 3: Run type check**

Run: `cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | head -40`
Expected: Clean.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(test): update tests for about page i18n interface changes"
```
