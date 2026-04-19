# Homepage Pinboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare-bones homepage with a warm editorial "Pinboard" design — paper cards, tape, bilingual routes (`/` EN + `/pt-BR`), blog posts + YouTube videos as equal content pillars, inline newsletter subscribe, and cookie-based theme toggle.

**Architecture:** Server Components fetch data (posts, newsletters) at the leaf level; Client Components are limited to `ThemeToggle` and `NewsletterInline`. Pinboard palette tokens live in `globals.css` CSS custom properties; Tailwind `@theme inline` maps them to utility classes. The `/pt-BR` route is a separate RSC page sharing one `PinboardHome` component.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind 4 · Vitest · Supabase (service-role) · Resend · `next/font/google` (Fraunces + JetBrains Mono + Caveat; Inter already loaded)

**Spec:** `docs/superpowers/specs/2026-04-19-homepage-pinboard-design.md`

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260419000001_blog_posts_is_featured.sql`
- Create: `supabase/migrations/20260419000002_blog_posts_category.sql`
- Create: `supabase/migrations/20260419000003_newsletter_schema_v2.sql`

No tests — verify by pushing to local DB and checking column presence.

- [ ] **Step 1.1: Create migration 1 — `is_featured`**

```sql
-- supabase/migrations/20260419000001_blog_posts_is_featured.sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS blog_posts_is_featured_idx
  ON blog_posts (site_id, is_featured)
  WHERE is_featured = true;
```

- [ ] **Step 1.2: Create migration 2 — `category`**

```sql
-- supabase/migrations/20260419000002_blog_posts_category.sql
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('tech', 'vida', 'viagem', 'crescimento', 'code', 'negocio'));
```

- [ ] **Step 1.3: Create migration 3 — newsletter schema v2**

```sql
-- supabase/migrations/20260419000003_newsletter_schema_v2.sql

-- 1. Newsletter types lookup table
CREATE TABLE IF NOT EXISTS newsletter_types (
  id         text PRIMARY KEY,
  locale     text NOT NULL CHECK (locale IN ('en', 'pt-BR')),
  name       text NOT NULL,
  tagline    text,
  cadence    text,
  color      text NOT NULL DEFAULT '#C14513',
  active     boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed 8 newsletter types
INSERT INTO newsletter_types (id, locale, name, tagline, cadence, color, sort_order) VALUES
  ('main-en',   'en',    'The bythiago diary',  'Thoughts from the edge of the keyboard', 'Weekly',   '#C14513', 1),
  ('trips-en',  'en',    'Curves & roads',       'Motorcycle diaries, travel, freedom',    'Monthly',  '#1A6B4A', 2),
  ('growth-en', 'en',    'Grow inward',          'Self-improvement, habits, depth',        'Bi-weekly','#6B4FA0', 3),
  ('code-en',   'en',    'Code in Portuguese',   'Tech content, originally in PT-BR',     'Weekly',   '#1A5280', 4),
  ('main-pt',   'pt-BR', 'Diário do bythiago',   'Pensamentos da beira do teclado',       'Semanal',  '#C14513', 1),
  ('trips-pt',  'pt-BR', 'Curvas & estradas',    'Diários de moto, viagem, liberdade',    'Mensal',   '#1A6B4A', 2),
  ('growth-pt', 'pt-BR', 'Crescer de dentro',    'Desenvolvimento pessoal, hábitos',      'Quinzenal','#6B4FA0', 3),
  ('code-pt',   'pt-BR', 'Código em português',  'Conteúdo tech, em português mesmo',     'Semanal',  '#1A5280', 4)
ON CONFLICT (id) DO NOTHING;

-- 3. Add newsletter_id FK to subscriptions
--    NOTE: locale column already exists (added in 20260416000014) — NOT re-added here
ALTER TABLE newsletter_subscriptions
  ADD COLUMN IF NOT EXISTS newsletter_id text
    REFERENCES newsletter_types(id)
    ON DELETE SET NULL;

-- Backfill existing rows
UPDATE newsletter_subscriptions
  SET newsletter_id = 'main-pt'
  WHERE newsletter_id IS NULL;
```

- [ ] **Step 1.4: Apply migrations to local DB and verify**

```bash
npm run db:start
npm run db:reset
# Verify columns exist
npm run db:status
```

Expected: no errors; columns `is_featured`, `category` on `blog_posts`; table `newsletter_types` with 8 rows; `newsletter_subscriptions.newsletter_id` present.

- [ ] **Step 1.5: Push to prod**

```bash
npm run db:push:prod
# Type YES when prompted
```

- [ ] **Step 1.6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add is_featured + category to blog_posts, newsletter_types table"
```

---

## Task 2: Install Resend + Transport Wrapper

**Files:**
- Modify: `apps/web/package.json` (via npm install)
- Create: `apps/web/lib/email/resend.ts`
- Create: `apps/web/test/lib/email/resend.test.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// apps/web/test/lib/email/resend.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'test-123' }, error: null })
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { sendTransactionalEmail } from '../../../lib/email/resend'

describe('sendTransactionalEmail', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls resend with correct params', async () => {
    await sendTransactionalEmail({
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    })
    expect(mockSend).toHaveBeenCalledWith({
      from: 'Thiago <no-reply@bythiagofigueiredo.com>',
      to: 'test@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    })
  })

  it('allows overriding the from address', async () => {
    await sendTransactionalEmail({
      to: 'a@b.com',
      subject: 'S',
      html: '<p/>>',
      from: 'custom@domain.com',
    })
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@domain.com' }))
  })

  it('throws when resend returns an error', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate limited' } })
    await expect(
      sendTransactionalEmail({ to: 'x@y.com', subject: 'S', html: '<p/>' })
    ).rejects.toThrow('rate limited')
  })
})
```

- [ ] **Step 2.2: Run test — expect FAIL (module not found)**

```bash
npm run test:web -- --reporter=verbose test/lib/email/resend.test.ts
```

Expected: FAIL — `Cannot find module 'resend'`

- [ ] **Step 2.3: Install resend package**

```bash
npm install resend -w apps/web
```

- [ ] **Step 2.4: Create `apps/web/lib/email/resend.ts`**

```ts
import { Resend } from 'resend'

const client = new Resend(process.env.RESEND_API_KEY)

export async function sendTransactionalEmail(params: {
  to: string
  subject: string
  html: string
  from?: string
}): Promise<void> {
  const { data, error } = await client.emails.send({
    from: params.from ?? 'Thiago <no-reply@bythiagofigueiredo.com>',
    to: params.to,
    subject: params.subject,
    html: params.html,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2.5: Run test — expect PASS**

```bash
npm run test:web -- --reporter=verbose test/lib/email/resend.test.ts
```

Expected: 3 tests passing.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/lib/email/resend.ts apps/web/test/lib/email/resend.test.ts apps/web/package.json apps/web/package-lock.json package-lock.json
git commit -m "feat(email): add Resend transport wrapper"
```

---

## Task 3: Add Pinboard CSS Tokens + Fonts

**Files:**
- Modify: `apps/web/src/app/globals.css` — add pinboard palette + Tailwind theme mappings
- Modify: `apps/web/src/app/(public)/layout.tsx` — load Fraunces, JetBrains Mono, Caveat; apply cookie theme

No unit tests — visual verification in browser after Task 21.

- [ ] **Step 3.1: Add CSS tokens and `@theme inline` block to `globals.css`**

Open `apps/web/src/app/globals.css` and append after the existing CSS (do NOT replace existing variables):

```css
/* ── Pinboard palette ─────────────────────────────────────── */
:root,
[data-theme="dark"] {
  --pb-bg:     #14110B;
  --pb-paper:  #2A241A;
  --pb-paper2: #312A1E;
  --pb-ink:    #EFE6D2;
  --pb-muted:  #958A75;
  --pb-faint:  #6B634F;
  --pb-line:   #2E2718;
  --pb-accent: #FF8240;
  --pb-yt:     #FF3333;
  --pb-marker: #FFE37A;
  --pb-tape:   rgba(255, 226, 140, 0.42);
  --pb-tape2:  rgba(209, 224, 255, 0.36);
  --pb-tapeR:  rgba(255, 120, 120, 0.40);
}

[data-theme="light"] {
  --pb-bg:     #E9E1CE;
  --pb-paper:  #FBF6E8;
  --pb-paper2: #F5EDD6;
  --pb-ink:    #161208;
  --pb-muted:  #6A5F48;
  --pb-faint:  #9C9178;
  --pb-line:   #CEBFA0;
  --pb-accent: #C14513;
  --pb-yt:     #FF3333;
  --pb-marker: #FFE37A;
  --pb-tape:   rgba(255, 226, 140, 0.75);
  --pb-tape2:  rgba(200, 220, 255, 0.70);
  --pb-tapeR:  rgba(255, 150, 150, 0.70);
}

@theme inline {
  --color-pb-bg:     var(--pb-bg);
  --color-pb-paper:  var(--pb-paper);
  --color-pb-paper2: var(--pb-paper2);
  --color-pb-ink:    var(--pb-ink);
  --color-pb-muted:  var(--pb-muted);
  --color-pb-faint:  var(--pb-faint);
  --color-pb-line:   var(--pb-line);
  --color-pb-accent: var(--pb-accent);
  --color-pb-yt:     var(--pb-yt);
  --color-pb-marker: var(--pb-marker);

  --font-fraunces:     var(--font-fraunces-var);
  --font-jetbrains:    var(--font-jetbrains-var);
  --font-caveat:       var(--font-caveat-var);
}

@keyframes pb-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.pb-fade-in { animation: pb-fade-in 0.4s ease both; }

@media (prefers-reduced-motion: reduce) {
  .pb-rotate { transform: none !important; }
  .pb-tape   { display: none !important; }
}
```

- [ ] **Step 3.2: Update `apps/web/src/app/(public)/layout.tsx` — load fonts and read theme cookie**

Read the current file first, then apply these changes:

```tsx
// Add these imports at the top (after existing imports):
import { Fraunces, JetBrains_Mono, Caveat } from 'next/font/google'
import { cookies } from 'next/headers'

// Font instances (add alongside any existing next/font imports):
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces-var',
  display: 'swap',
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-var',
  display: 'swap',
})
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat-var',
  display: 'swap',
})
```

In the layout's return, update `<html>` to read the `btf_theme` cookie and apply both `class` and `data-theme`:

```tsx
// Inside the async layout function, before the return:
const cookieStore = await cookies()
const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'

// <html> tag:
<html
  lang={locale}
  className={`${theme === 'dark' ? 'dark' : ''} ${fraunces.variable} ${jetbrains.variable} ${caveat.variable}`}
  data-theme={theme}
>
```

- [ ] **Step 3.3: Run type check to verify no TS errors**

```bash
npm run typecheck -w apps/web 2>&1 | head -30
```

Expected: no errors related to the layout changes.

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/'(public)'/layout.tsx
git commit -m "feat(ui): add pinboard CSS tokens + load Fraunces/JetBrains Mono/Caveat fonts"
```

---

## Task 4: Data Types

**Files:**
- Create: `apps/web/lib/home/types.ts`

No test — pure TS types; verified by downstream consumers.

- [ ] **Step 4.1: Create `apps/web/lib/home/types.ts`**

```ts
export type HomePost = {
  id: string
  slug: string
  locale: string
  title: string
  excerpt: string | null
  publishedAt: string
  category: string | null
  readingTimeMin: number
  coverImageUrl: string | null
  isFeatured: boolean
}

export type HomeVideo = {
  id: string
  locale: 'en' | 'pt-BR'
  title: string
  description: string
  thumbnailUrl: string | null
  duration: string
  viewCount: string
  publishedAt: string
  series: string
  youtubeUrl: string
}

export type HomeNewsletter = {
  id: string
  name: string
  tagline: string | null
  cadence: string | null
  color: string
  locale: string
}

export type HomeChannel = {
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
}
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/web/lib/home/types.ts
git commit -m "feat(home): add home data types"
```

---

## Task 5: Cover Gradient Helper

**Files:**
- Create: `apps/web/lib/home/cover-image.ts`
- Create: `apps/web/test/lib/home/cover-image.test.ts`

- [ ] **Step 5.1: Write the failing test**

```ts
// apps/web/test/lib/home/cover-image.test.ts
import { describe, it, expect } from 'vitest'
import { coverGradient } from '../../../lib/home/cover-image'

describe('coverGradient', () => {
  it('returns a CSS linear-gradient string', () => {
    const result = coverGradient('tech', true)
    expect(result).toMatch(/^linear-gradient/)
    expect(result).toContain('135deg')
  })

  it('uses tech hues (220, 260) in dark mode', () => {
    const result = coverGradient('tech', true)
    expect(result).toContain('hsl(220,')
    expect(result).toContain('hsl(260,')
  })

  it('uses default hues (35, 50) for unknown category', () => {
    const result = coverGradient('unknown', false)
    expect(result).toContain('hsl(35,')
    expect(result).toContain('hsl(50,')
  })

  it('handles null category', () => {
    const result = coverGradient(null, false)
    expect(result).toContain('hsl(35,')
  })

  it('uses different lightness for dark vs light mode', () => {
    const dark = coverGradient('vida', true)
    const light = coverGradient('vida', false)
    expect(dark).not.toEqual(light)
    expect(dark).toContain('28%')
    expect(light).toContain('72%')
  })
})
```

- [ ] **Step 5.2: Run test — expect FAIL**

```bash
npm run test:web -- --reporter=verbose test/lib/home/cover-image.test.ts
```

Expected: FAIL — `Cannot find module '../../../lib/home/cover-image'`

- [ ] **Step 5.3: Create `apps/web/lib/home/cover-image.ts`**

```ts
const CATEGORY_HUES: Record<string, [number, number]> = {
  tech:         [220, 260],
  vida:         [30,  60],
  viagem:       [160, 200],
  crescimento:  [100, 140],
  code:         [200, 240],
  negocio:      [350, 20],
}
const DEFAULT_HUES: [number, number] = [35, 50]

export function coverGradient(category: string | null, dark: boolean): string {
  const [h1, h2] = (category && CATEGORY_HUES[category]) ?? DEFAULT_HUES
  const s = dark ? 45 : 55
  const l = dark ? 28 : 72
  return `linear-gradient(135deg, hsl(${h1},${s}%,${l}%) 0%, hsl(${h2},${s}%,${l}%) 100%)`
}
```

- [ ] **Step 5.4: Run test — expect PASS**

```bash
npm run test:web -- --reporter=verbose test/lib/home/cover-image.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/lib/home/cover-image.ts apps/web/test/lib/home/cover-image.test.ts
git commit -m "feat(home): add coverGradient helper for post placeholder images"
```

---

## Task 6: Static Video Data

**Files:**
- Create: `apps/web/lib/home/videos-data.ts`

No test — static data; type-checked by TS.

- [ ] **Step 6.1: Create `apps/web/lib/home/videos-data.ts`**

```ts
import type { HomeChannel, HomeVideo } from './types'

export const YOUTUBE_CHANNELS: Record<'en' | 'pt-BR', HomeChannel> = {
  'en': {
    locale: 'en',
    handle: '@byThiagoFigueiredo',
    url: 'https://www.youtube.com/@byThiagoFigueiredo',
    flag: '🌎',
    name: 'by Thiago Figueiredo',
  },
  'pt-BR': {
    locale: 'pt-BR',
    handle: '@tnFigueiredoTV',
    url: 'https://www.youtube.com/@tnFigueiredoTV',
    flag: '🇧🇷',
    name: 'tnFigueiredo TV',
  },
}

// Placeholder data — replace with YouTube Data API v3 in a future sprint
export const SAMPLE_VIDEOS: HomeVideo[] = [
  {
    id: 'v1',
    locale: 'pt-BR',
    title: 'Como eu estruturo projetos Next.js em 2026',
    description: 'Arquitetura, pastas, patterns — tudo que aprendi em 5 anos de produção.',
    thumbnailUrl: null,
    duration: '18:42',
    viewCount: '—',
    publishedAt: '2026-04-10',
    series: 'Dev Diary',
    youtubeUrl: 'https://www.youtube.com/@tnFigueiredoTV',
  },
  {
    id: 'v2',
    locale: 'pt-BR',
    title: 'Viagem de moto pelo RS — 3 dias, 900km',
    description: 'Da Serra Gaúcha ao litoral numa moto de 250cc. Vale a pena?',
    thumbnailUrl: null,
    duration: '24:15',
    viewCount: '—',
    publishedAt: '2026-03-28',
    series: 'Estrada',
    youtubeUrl: 'https://www.youtube.com/@tnFigueiredoTV',
  },
  {
    id: 'v3',
    locale: 'en',
    title: 'Building a personal CMS from scratch',
    description: 'Why I wrote my own CMS instead of using Notion, Sanity, or Ghost.',
    thumbnailUrl: null,
    duration: '22:08',
    viewCount: '—',
    publishedAt: '2026-04-05',
    series: 'Build in Public',
    youtubeUrl: 'https://www.youtube.com/@byThiagoFigueiredo',
  },
  {
    id: 'v4',
    locale: 'en',
    title: 'The 1-year mark: what changed',
    description: 'A year of creating in public. What worked, what flopped, what\'s next.',
    thumbnailUrl: null,
    duration: '15:30',
    viewCount: '—',
    publishedAt: '2026-03-15',
    series: 'Build in Public',
    youtubeUrl: 'https://www.youtube.com/@byThiagoFigueiredo',
  },
]
```

- [ ] **Step 6.2: Run typecheck**

```bash
npm run typecheck -w apps/web 2>&1 | grep "videos-data"
```

Expected: no errors.

- [ ] **Step 6.3: Commit**

```bash
git add apps/web/lib/home/videos-data.ts
git commit -m "feat(home): add static YouTube channel + video placeholder data"
```

---

## Task 7: DB Queries

**Files:**
- Create: `apps/web/lib/home/queries.ts`
- Create: `apps/web/test/lib/home/queries.test.ts`

- [ ] **Step 7.1: Write the failing test**

```ts
// apps/web/test/lib/home/queries.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockLte = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSingle = vi.fn()

// Chain builder — each method returns the same mock for fluent chaining
const chain = {
  select: mockSelect,
  eq: mockEq,
  lte: mockLte,
  order: mockOrder,
  limit: mockLimit,
  single: mockSingle,
}
Object.values(chain).forEach(fn => fn.mockReturnValue(chain))

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({ from: mockFrom.mockReturnValue(chain) })),
}))

import { getFeaturedPost, getLatestPosts, getNewslettersForLocale } from '../../../lib/home/queries'

describe('getFeaturedPost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('falls back to most recent when no featured post', async () => {
    // First call (is_featured=true) returns null
    mockSingle.mockResolvedValueOnce({ data: null, error: null })
    // Second call (fallback) returns a post
    const post = { id: 'p1', slug: 'hello', locale: 'en', title: 'Hello', excerpt: null,
      published_at: '2026-01-01', category: null, reading_time_min: 3,
      cover_image_url: null, is_featured: false }
    mockLimit.mockResolvedValueOnce({ data: [post], error: null })

    const result = await getFeaturedPost('en')
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('hello')
  })
})

describe('getNewslettersForLocale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries newsletter_types filtered by locale', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null })
    await getNewslettersForLocale('pt-BR')
    expect(mockFrom).toHaveBeenCalledWith('newsletter_types')
    expect(mockEq).toHaveBeenCalledWith('locale', 'pt-BR')
  })
})
```

- [ ] **Step 7.2: Run test — expect FAIL**

```bash
npm run test:web -- --reporter=verbose test/lib/home/queries.test.ts
```

Expected: FAIL — `Cannot find module '../../../lib/home/queries'`

- [ ] **Step 7.3: Create `apps/web/lib/home/queries.ts`**

Find where the existing service client is exported. Check `apps/web/lib/supabase/` for a `service.ts` or similar file. Use that import path. The service client bypasses RLS (same pattern as `lib/seo/enumerator.ts`).

```ts
import type { HomeNewsletter, HomePost } from './types'
import { getSupabaseServiceClient } from '../supabase/service'

export async function getFeaturedPost(locale: string): Promise<HomePost | null> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  // Try featured first
  const { data: featured } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status)
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .eq('blog_posts.is_featured', true)
    .lte('blog_posts.published_at', now)
    .order('blog_posts.published_at', { ascending: false })
    .limit(1)
    .single()

  const row = featured ?? await (async () => {
    const { data } = await db
      .from('blog_translations')
      .select(`
        slug, locale, title, excerpt, reading_time_min, cover_image_url,
        blog_posts!inner(id, published_at, category, is_featured, status)
      `)
      .eq('locale', locale)
      .eq('blog_posts.status', 'published')
      .lte('blog_posts.published_at', now)
      .order('blog_posts.published_at', { ascending: false })
      .limit(1)
    return data?.[0] ?? null
  })()

  if (!row) return null

  const post = (row as any).blog_posts
  return {
    id: post.id,
    slug: (row as any).slug,
    locale: (row as any).locale,
    title: (row as any).title,
    excerpt: (row as any).excerpt,
    publishedAt: post.published_at,
    category: post.category,
    readingTimeMin: (row as any).reading_time_min,
    coverImageUrl: (row as any).cover_image_url,
    isFeatured: post.is_featured,
  }
}

export async function getLatestPosts(locale: string, limit = 8): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status)
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('blog_posts.published_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.blog_posts.id,
    slug: row.slug,
    locale: row.locale,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.blog_posts.published_at,
    category: row.blog_posts.category,
    readingTimeMin: row.reading_time_min,
    coverImageUrl: row.cover_image_url,
    isFeatured: row.blog_posts.is_featured,
  }))
}

export async function getNewslettersForLocale(locale: string): Promise<HomeNewsletter[]> {
  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('newsletter_types')
    .select('id, locale, name, tagline, cadence, color')
    .eq('locale', locale)
    .eq('active', true)
    .order('sort_order')

  if (error) throw error
  return (data ?? []) as HomeNewsletter[]
}
```

**Note on import path:** Check `apps/web/lib/seo/enumerator.ts` for the exact import used for the service client — use the same path. Common patterns: `'../supabase/service'` or `'@/lib/supabase/service'`.

- [ ] **Step 7.4: Run test — fix import path if needed**

```bash
npm run test:web -- --reporter=verbose test/lib/home/queries.test.ts
```

If the service client mock path is wrong, adjust the `vi.mock(...)` path to match the actual import in `queries.ts`.

Expected: 2 tests passing.

- [ ] **Step 7.5: Commit**

```bash
git add apps/web/lib/home/queries.ts apps/web/test/lib/home/queries.test.ts
git commit -m "feat(home): add DB queries (getFeaturedPost, getLatestPosts, getNewslettersForLocale)"
```

---

## Task 8: Locale Strings

**Files:**
- Modify: `apps/web/src/locales/en.json` — extend with homepage keys
- Create: `apps/web/src/locales/pt-BR.json`

No test — verified by components consuming the keys.

- [ ] **Step 8.1: Extend `apps/web/src/locales/en.json`**

Read the file first. Merge these keys in (keep all existing keys):

```json
{
  "meta.title": "Thiago Figueiredo — Creator & Builder",
  "meta.description": "Writing, videos, and experiments from the edge of the keyboard.",
  "hero.headline": "Build in public. Learn out loud.",
  "hero.subheadline": "Follow projects, launches, and experiments.",
  "social.title": "Find me online",
  "footer.note": "Site under construction",
  "notFound.title": "Page not found",
  "notFound.message": "We couldn't find the page you're looking for.",
  "notFound.cta": "Go back home",

  "nav.home": "Home",
  "nav.writing": "Writing",
  "nav.videos": "Videos",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.devSite": "Dev Site",

  "header.subscribe": "Subscribe on YouTube",
  "header.newsletter": "Get the newsletter",

  "hero.post.badge": "POST",
  "hero.post.mustRead": "← must-read",
  "hero.video.badge": "VIDEO",
  "hero.video.fresh": "fresh on the channel →",
  "hero.comingSoon": "Coming soon",

  "feed.type.post": "TEXT",
  "feed.type.video": "VIDEO",
  "feed.seeAll": "See all →",
  "feed.readMin": "min read",

  "channels.title": "Watch on YouTube",
  "channels.subscribersSuffix": "subscribers",
  "channels.subscribe": "Subscribe",
  "channels.primary": "Main channel",

  "newsletter.title": "Join the newsletter",
  "newsletter.subtitle": "Words from the edge of the keyboard — weekly.",
  "newsletter.emailPlaceholder": "your@email.com",
  "newsletter.submit": "Subscribe",
  "newsletter.success": "Check your inbox to confirm!",
  "newsletter.more": "→ more newsletters",
  "newsletter.consent": "By subscribing you agree to our Privacy Policy.",

  "footer.blog": "Blog",
  "footer.videos": "Videos",
  "footer.newsletter": "Newsletter",
  "footer.about": "About",
  "footer.contact": "Contact",
  "footer.tagline": "Ideas built in public.",
  "footer.madeIn": "Made in Brazil",
  "footer.copyright": "© {year} Thiago Figueiredo"
}
```

- [ ] **Step 8.2: Create `apps/web/src/locales/pt-BR.json`**

```json
{
  "meta.title": "Thiago Figueiredo — Criador & Builder",
  "meta.description": "Textos, vídeos e experimentos da beira do teclado.",
  "hero.headline": "Construindo em público. Aprendendo em voz alta.",
  "hero.subheadline": "Acompanhe projetos, lançamentos e experimentos.",
  "social.title": "Me encontre online",
  "footer.note": "Site em construção",
  "notFound.title": "Página não encontrada",
  "notFound.message": "Não encontramos a página que você está procurando.",
  "notFound.cta": "Voltar ao início",

  "nav.home": "Início",
  "nav.writing": "Textos",
  "nav.videos": "Vídeos",
  "nav.about": "Sobre",
  "nav.contact": "Contato",
  "nav.devSite": "Site Dev",

  "header.subscribe": "Inscrever no YouTube",
  "header.newsletter": "Receber newsletter",

  "hero.post.badge": "TEXTO",
  "hero.post.mustRead": "← leitura obrigatória",
  "hero.video.badge": "VÍDEO",
  "hero.video.fresh": "novo no canal →",
  "hero.comingSoon": "Em breve",

  "feed.type.post": "TEXTO",
  "feed.type.video": "VÍDEO",
  "feed.seeAll": "Ver todos →",
  "feed.readMin": "min de leitura",

  "channels.title": "Assista no YouTube",
  "channels.subscribersSuffix": "inscritos",
  "channels.subscribe": "Inscrever-se",
  "channels.primary": "Canal principal",

  "newsletter.title": "Entre para a newsletter",
  "newsletter.subtitle": "Palavras da beira do teclado — semanalmente.",
  "newsletter.emailPlaceholder": "seu@email.com",
  "newsletter.submit": "Inscrever",
  "newsletter.success": "Confirme sua inscrição no email!",
  "newsletter.more": "→ mais newsletters",
  "newsletter.consent": "Ao se inscrever você concorda com nossa Política de Privacidade.",

  "footer.blog": "Blog",
  "footer.videos": "Vídeos",
  "footer.newsletter": "Newsletter",
  "footer.about": "Sobre",
  "footer.contact": "Contato",
  "footer.tagline": "Ideias construídas em público.",
  "footer.madeIn": "Feito no Brasil",
  "footer.copyright": "© {year} Thiago Figueiredo"
}
```

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/locales/
git commit -m "feat(i18n): add homepage strings to en.json + create pt-BR.json"
```

---

## Task 9: Swap Newsletter Confirmation Email to Resend

**Files:**
- Modify: `apps/web/src/app/newsletter/subscribe/actions.ts`

- [ ] **Step 9.1: Add confirmation email HTML builder at top of `actions.ts`**

Open `apps/web/src/app/newsletter/subscribe/actions.ts`. Add this helper before the main action function:

```ts
import { sendTransactionalEmail } from '../../../../lib/email/resend'

function buildConfirmationHtml(confirmUrl: string, locale: string): string {
  const isPt = locale === 'pt-BR'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${isPt ? 'Confirme sua inscrição' : 'Confirm your subscription'}</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#161208;background:#FBF6E8;padding:32px;border-radius:8px;">
  <h1 style="font-size:24px;margin-bottom:16px;">${isPt ? 'Quase lá!' : 'Almost there!'}</h1>
  <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">
    ${isPt
      ? 'Clique no botão abaixo para confirmar sua inscrição na newsletter.'
      : 'Click the button below to confirm your newsletter subscription.'}
  </p>
  <a href="${confirmUrl}" style="display:inline-block;background:#C14513;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
    ${isPt ? 'Confirmar inscrição' : 'Confirm subscription'}
  </a>
  <p style="font-size:12px;color:#6A5F48;margin-top:32px;">
    ${isPt
      ? 'Se você não se inscreveu, ignore este email.'
      : "If you didn't subscribe, ignore this email."}
  </p>
</body>
</html>
  `.trim()
}
```

- [ ] **Step 9.2: Replace the Brevo email send call**

In the same `actions.ts`, find where the existing email service is called to send the confirmation email (look for `emailService.sendTemplate(...)` or similar). Replace that block with:

```ts
const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/confirm?token=${rawToken}`
await sendTransactionalEmail({
  to: email,
  subject: locale === 'pt-BR' ? 'Confirme sua inscrição' : 'Confirm your subscription',
  html: buildConfirmationHtml(confirmUrl, locale),
}).catch((err) => {
  // Non-fatal: subscription row exists; user can re-request confirmation
  console.error('[newsletter] confirmation email failed', err)
})
```

- [ ] **Step 9.3: Also add `newsletter_id` extraction from formData**

In the existing action, after the locale extraction, add:

```ts
const newsletter_id = (formData.get('newsletter_id') as string) || 'main-pt'
```

And in the Supabase insert object, add `newsletter_id`.

- [ ] **Step 9.4: Run tests**

```bash
npm run test:web 2>&1 | tail -20
```

Expected: all tests still passing. If the existing newsletter tests relied on the Brevo mock, update them to mock `lib/email/resend` instead.

- [ ] **Step 9.5: Commit**

```bash
git add apps/web/src/app/newsletter/subscribe/actions.ts
git commit -m "feat(newsletter): swap confirmation email transport from Brevo to Resend"
```

---

## Task 10: Newsletter Inline Server Action

**Files:**
- Create: `apps/web/src/app/(public)/actions/newsletter-inline.ts`
- Create: `apps/web/test/app/(public)/actions/newsletter-inline.test.ts`

- [ ] **Step 10.1: Write the failing test**

```ts
// apps/web/test/app/(public)/actions/newsletter-inline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRateCheck = vi.fn().mockResolvedValue({ data: { allowed: true }, error: null })
const mockInsert = vi.fn().mockResolvedValue({ data: { id: 'sub-1' }, error: null })
const mockFrom = vi.fn()

vi.mock('../../../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    rpc: mockRateCheck,
    from: mockFrom.mockReturnValue({ insert: mockInsert }),
  })),
}))

vi.mock('../../../../../lib/email/resend', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../../../../lib/turnstile', () => ({
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}))

import { subscribeNewsletterInline } from '../../../../../src/app/(public)/actions/newsletter-inline'

describe('subscribeNewsletterInline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns error for invalid email', async () => {
    const fd = new FormData()
    fd.set('email', 'not-an-email')
    fd.set('newsletter_id', 'main-pt')
    fd.set('locale', 'pt-BR')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.error).toBeDefined()
    expect(result.success).toBeFalsy()
  })

  it('returns success for valid email', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: { allowed: true }, error: null })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-en')
    fd.set('locale', 'en')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.success).toBe(true)
  })

  it('returns rate-limited error', async () => {
    mockRateCheck.mockResolvedValueOnce({ data: { allowed: false }, error: null })
    const fd = new FormData()
    fd.set('email', 'user@example.com')
    fd.set('newsletter_id', 'main-pt')
    fd.set('locale', 'pt-BR')
    fd.set('turnstile_token', 'ok-token')

    const result = await subscribeNewsletterInline(undefined, fd)
    expect(result.error).toMatch(/rate|limit|tente/i)
  })
})
```

- [ ] **Step 10.2: Run test — expect FAIL**

```bash
npm run test:web -- --reporter=verbose "test/app/(public)/actions/newsletter-inline.test.ts"
```

Expected: FAIL — module not found.

- [ ] **Step 10.3: Create `apps/web/src/app/(public)/actions/newsletter-inline.ts`**

```ts
'use server'

import crypto from 'node:crypto'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { sendTransactionalEmail } from '../../../../lib/email/resend'
import { verifyTurnstile } from '../../../../lib/turnstile'

const CONSENT_VERSION = 'newsletter-v1-2026-04'

const InlineSchema = z.object({
  email: z.string().email(),
  newsletter_id: z.string().min(1),
  locale: z.enum(['en', 'pt-BR']),
  turnstile_token: z.string().optional(),
})

export type InlineState = { success?: boolean; error?: string }

export async function subscribeNewsletterInline(
  _prev: InlineState | undefined,
  formData: FormData,
): Promise<InlineState> {
  const parsed = InlineSchema.safeParse({
    email: formData.get('email'),
    newsletter_id: formData.get('newsletter_id'),
    locale: formData.get('locale'),
    turnstile_token: formData.get('turnstile_token'),
  })
  if (!parsed.success) {
    return { error: 'E-mail inválido. / Invalid email.' }
  }

  const { email, newsletter_id, locale, turnstile_token } = parsed.data

  // Turnstile verification (skip in test env)
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && turnstile_token) {
    const ok = await verifyTurnstile(turnstile_token)
    if (!ok) return { error: 'Verificação falhou. / Verification failed.' }
  }

  const db = getSupabaseServiceClient()

  // Rate check
  const { data: rate } = await db.rpc('newsletter_rate_check', { p_email: email })
  if (!rate?.allowed) {
    return { error: 'Muitas tentativas. Tente novamente em breve. / Too many attempts.' }
  }

  // Generate confirmation token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Insert subscription (upsert on conflict — existing pending row is refreshed)
  const { error: insertError } = await db.from('newsletter_subscriptions').insert({
    site_id: process.env.MASTER_SITE_ID,
    email,
    status: 'pending_confirmation',
    newsletter_id,
    locale,
    consent_text_version: CONSENT_VERSION,
    confirmation_token_hash: tokenHash,
    confirmation_expires_at: expiresAt,
  })

  if (insertError && !insertError.message.includes('duplicate')) {
    return { error: 'Erro interno. Tente novamente. / Internal error.' }
  }

  // Send confirmation email (non-fatal)
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/confirm?token=${rawToken}`
  const isPt = locale === 'pt-BR'
  await sendTransactionalEmail({
    to: email,
    subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:40px auto;">
        <h2>${isPt ? 'Confirme sua inscrição' : 'Confirm your subscription'}</h2>
        <a href="${confirmUrl}" style="background:#C14513;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">
          ${isPt ? 'Confirmar' : 'Confirm'}
        </a>
      </div>
    `,
  }).catch(() => undefined)

  return { success: true }
}
```

**Note:** `MASTER_SITE_ID` must be set in env. Check existing `.env.local` — it may be `NEXT_PUBLIC_SITE_ID` or set it from the DB's site row for `bythiagofigueiredo`. Look at how other actions obtain the site_id (e.g., `apps/web/src/app/newsletter/subscribe/actions.ts`) and use the same approach.

- [ ] **Step 10.4: Run test — expect PASS**

```bash
npm run test:web -- --reporter=verbose "test/app/(public)/actions/newsletter-inline.test.ts"
```

Expected: 3 tests passing.

- [ ] **Step 10.5: Commit**

```bash
git add "apps/web/src/app/(public)/actions/" "apps/web/test/app/(public)/actions/"
git commit -m "feat(newsletter): add inline subscribe Server Action"
```

---

## Task 11: Theme API Route

**Files:**
- Create: `apps/web/src/app/api/theme/route.ts`
- Create: `apps/web/test/app/api/theme.test.ts`

- [ ] **Step 11.1: Write the failing test**

```ts
// apps/web/test/app/api/theme.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../../../src/app/api/theme/route'

describe('POST /api/theme', () => {
  it('sets btf_theme=dark cookie', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'dark' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=dark')
  })

  it('sets btf_theme=light cookie', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'light' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('btf_theme=light')
  })

  it('rejects unknown theme values', async () => {
    const req = new Request('http://localhost/api/theme', {
      method: 'POST',
      body: JSON.stringify({ theme: 'purple' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 11.2: Run test — expect FAIL**

```bash
npm run test:web -- --reporter=verbose test/app/api/theme.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 11.3: Create `apps/web/src/app/api/theme/route.ts`**

```ts
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const theme = body?.theme

  if (theme !== 'dark' && theme !== 'light') {
    return NextResponse.json({ error: 'invalid theme' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  res.headers.set(
    'set-cookie',
    `btf_theme=${theme}; Path=/; SameSite=Lax; Max-Age=31536000; HttpOnly`,
  )
  return res
}
```

- [ ] **Step 11.4: Run test — expect PASS**

```bash
npm run test:web -- --reporter=verbose test/app/api/theme.test.ts
```

Expected: 3 tests passing.

- [ ] **Step 11.5: Commit**

```bash
git add apps/web/src/app/api/theme/ apps/web/test/app/api/theme.test.ts
git commit -m "feat(api): add /api/theme cookie setter route"
```

---

## Task 12: PaperCard + Tape Primitives

**Files:**
- Create: `apps/web/src/app/(public)/components/PaperCard.tsx`
- Create: `apps/web/src/app/(public)/components/Tape.tsx`

No unit tests — visual primitives; verified in browser after Task 21.

- [ ] **Step 12.1: Create `PaperCard.tsx`**

```tsx
// apps/web/src/app/(public)/components/PaperCard.tsx
import { type ReactNode, CSSProperties } from 'react'

type Props = {
  index: number
  variant?: 'paper' | 'paper2'
  className?: string
  children: ReactNode
}

export function PaperCard({ index, variant = 'paper', className = '', children }: Props) {
  const rotateDeg = (((index * 37) % 7) - 3) * 0.5
  const translateY = (((index * 53) % 5) - 2) * 2

  const style: CSSProperties = {
    transform: `rotate(${rotateDeg}deg) translateY(${translateY}px)`,
    backgroundColor: `var(--pb-${variant})`,
  }

  return (
    <div
      className={`relative rounded-sm transition-shadow hover:shadow-xl ${className} pb-rotate`}
      style={style}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 12.2: Create `Tape.tsx`**

```tsx
// apps/web/src/app/(public)/components/Tape.tsx
type TapeVariant = 'tape' | 'tape2' | 'tapeR'

type Props = {
  variant?: TapeVariant
  className?: string
  rotate?: number
}

export function Tape({ variant = 'tape', className = '', rotate = -8 }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`hidden md:block pb-tape absolute w-14 h-5 opacity-90 ${className}`}
      style={{
        backgroundColor: `var(--pb-${variant})`,
        transform: `rotate(${rotate}deg)`,
        borderRadius: '1px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    />
  )
}
```

- [ ] **Step 12.3: Commit**

```bash
git add "apps/web/src/app/(public)/components/PaperCard.tsx" "apps/web/src/app/(public)/components/Tape.tsx"
git commit -m "feat(ui): add PaperCard + Tape primitives"
```

---

## Task 13: ThemeToggle Client Component

**Files:**
- Create: `apps/web/src/app/(public)/components/ThemeToggle.tsx`

- [ ] **Step 13.1: Create `ThemeToggle.tsx`**

```tsx
// apps/web/src/app/(public)/components/ThemeToggle.tsx
'use client'

import { useTransition } from 'react'

type Props = { currentTheme: 'dark' | 'light' }

export function ThemeToggle({ currentTheme }: Props) {
  const [pending, startTransition] = useTransition()

  function toggle() {
    const next = currentTheme === 'dark' ? 'light' : 'dark'
    startTransition(async () => {
      await fetch('/api/theme', {
        method: 'POST',
        body: JSON.stringify({ theme: next }),
        headers: { 'Content-Type': 'application/json' },
      })
      document.documentElement.dataset.theme = next
      document.documentElement.classList.toggle('dark', next === 'dark')
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="text-pb-muted hover:text-pb-ink transition-colors text-sm font-mono px-2 py-1 rounded"
    >
      {currentTheme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
```

- [ ] **Step 13.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/ThemeToggle.tsx"
git commit -m "feat(ui): add ThemeToggle client component (cookie-based, no FOUC)"
```

---

## Task 14: PinboardHeader

**Files:**
- Create: `apps/web/src/app/(public)/components/PinboardHeader.tsx`

- [ ] **Step 14.1: Create `PinboardHeader.tsx`**

```tsx
// apps/web/src/app/(public)/components/PinboardHeader.tsx
import Link from 'next/link'
import { ThemeToggle } from './ThemeToggle'

type Props = {
  locale: 'en' | 'pt-BR'
  currentTheme: 'dark' | 'light'
  t: Record<string, string>
}

const YT_CHANNELS = {
  en: 'https://www.youtube.com/@byThiagoFigueiredo',
  'pt-BR': 'https://www.youtube.com/@tnFigueiredoTV',
}

export function PinboardHeader({ locale, currentTheme, t }: Props) {
  const altLocale = locale === 'en' ? 'pt-BR' : 'en'
  const altHref = locale === 'en' ? '/pt-BR' : '/'

  return (
    <header className="sticky top-0 z-40 border-b border-[--pb-line] bg-[--pb-bg]/90 backdrop-blur-sm">
      {/* Top strip: lang + theme */}
      <div className="flex items-center justify-end gap-3 px-6 py-1 text-xs text-pb-muted border-b border-[--pb-line]">
        <Link href={altHref} className="hover:text-pb-ink transition-colors font-mono" hrefLang={altLocale}>
          {altLocale === 'pt-BR' ? '🇧🇷 PT-BR' : '🌎 EN'}
        </Link>
        <ThemeToggle currentTheme={currentTheme} />
      </div>

      {/* Main header row */}
      <div className="flex items-center justify-between px-6 py-3 gap-4">
        {/* Brand */}
        <Link href={locale === 'pt-BR' ? '/pt-BR' : '/'} className="shrink-0">
          <span
            className="font-fraunces text-pb-ink text-xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            by<em>thiago</em>
            <span className="text-pb-accent">.</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm text-pb-muted font-sans" aria-label="Main navigation">
          <Link href={locale === 'pt-BR' ? '/pt-BR' : '/'} className="hover:text-pb-ink transition-colors">{t['nav.home']}</Link>
          <Link href={locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'} className="hover:text-pb-ink transition-colors">{t['nav.writing']}</Link>
          <Link href={YT_CHANNELS[locale]} className="hover:text-pb-ink transition-colors" target="_blank" rel="noopener">{t['nav.videos']}</Link>
          <Link href="/contact" className="hover:text-pb-ink transition-colors">{t['nav.contact']}</Link>
          <a href="https://dev.bythiagofigueiredo.com" className="hover:text-pb-ink transition-colors opacity-60" target="_blank" rel="noopener">
            {t['nav.devSite']} ↗
          </a>
        </nav>

        {/* CTAs */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <a
            href={YT_CHANNELS[locale]}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t['header.subscribe']}
            className="bg-pb-yt text-white text-xs font-mono font-semibold px-3 py-1.5 rounded"
            style={{ transform: 'rotate(-1deg)', display: 'inline-block' }}
          >
            ▶ YouTube
          </a>
          <a
            href="#newsletter"
            className="text-xs font-mono font-semibold px-3 py-1.5 rounded"
            style={{ background: 'var(--pb-marker)', color: '#161208' }}
          >
            ✉ Newsletter
          </a>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 14.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/PinboardHeader.tsx"
git commit -m "feat(ui): add PinboardHeader with sticky nav, lang toggle, YouTube CTA"
```

---

## Task 15: DualHero

**Files:**
- Create: `apps/web/src/app/(public)/components/DualHero.tsx`

- [ ] **Step 15.1: Create `DualHero.tsx`**

```tsx
// apps/web/src/app/(public)/components/DualHero.tsx
import Link from 'next/link'
import Image from 'next/image'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost, HomeVideo } from '../../../../lib/home/types'

type Props = {
  post: HomePost | null
  video: HomeVideo | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

export function DualHero({ post, video, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-8 py-10 px-6">
      {/* Featured Post */}
      <PaperCard index={0} className="overflow-hidden pb-fade-in" style={{ transform: 'rotate(-0.8deg)' }}>
        <Tape variant="tape" className="-top-2 left-6" rotate={-6} />
        <Tape variant="tape2" className="-top-2 right-6" rotate={5} />

        {post ? (
          <Link href={`${blogBase}/${post.slug}`} className="block group">
            {/* Cover */}
            <div className="h-52 w-full overflow-hidden">
              {post.coverImageUrl ? (
                <Image
                  src={post.coverImageUrl}
                  alt={post.title}
                  width={600}
                  height={208}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ background: coverGradient(post.category, isDark) }}
                />
              )}
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-pb-accent tracking-widest">
                  ▤ {t['hero.post.badge']}
                </span>
                {post.category && (
                  <span className="font-mono text-xs text-pb-muted capitalize">{post.category}</span>
                )}
                <span className="font-mono text-xs text-pb-faint ml-auto">
                  {post.readingTimeMin} {t['feed.readMin']}
                </span>
              </div>
              <h2 className="font-fraunces text-pb-ink text-2xl md:text-3xl leading-tight mb-2 group-hover:text-pb-accent transition-colors" style={{ letterSpacing: '-0.02em' }}>
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-pb-muted text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
              )}
            </div>
          </Link>
        ) : (
          <div className="p-5 h-64 flex items-center justify-center">
            <span className="font-fraunces text-pb-faint text-xl">{t['hero.comingSoon']}</span>
          </div>
        )}

        <p className="font-caveat text-pb-muted text-base px-5 pb-4">{t['hero.post.mustRead']}</p>
      </PaperCard>

      {/* Featured Video */}
      {video && (
        <PaperCard index={1} variant="paper2" className="overflow-hidden pb-fade-in" style={{ transform: 'rotate(0.8deg)' }}>
          <Tape variant="tapeR" className="-top-2 left-1/2 -translate-x-1/2" rotate={-2} />

          <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group">
            {/* Thumbnail */}
            <div className="h-52 w-full relative overflow-hidden bg-pb-bg">
              {video.thumbnailUrl ? (
                <Image src={video.thumbnailUrl} alt={video.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1a0a0a 0%,#3a1010 100%)' }}>
                  <span className="text-5xl text-pb-yt opacity-80">▶</span>
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-6xl text-white drop-shadow-lg">▶</span>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-xs font-bold text-pb-yt tracking-widest">▶ {t['hero.video.badge']}</span>
                <span className="font-mono text-xs text-pb-muted">{video.series}</span>
                <span className="font-mono text-xs text-pb-faint ml-auto">{video.duration}</span>
              </div>
              <h2 className="font-fraunces text-pb-ink text-2xl md:text-3xl leading-tight mb-2 group-hover:text-pb-yt transition-colors" style={{ letterSpacing: '-0.02em' }}>
                {video.title}
              </h2>
              <p className="text-pb-muted text-sm leading-relaxed line-clamp-2">{video.description}</p>
            </div>
          </a>

          <p className="font-caveat text-pb-muted text-base px-5 pb-4 text-right">{t['hero.video.fresh']}</p>
        </PaperCard>
      )}
    </section>
  )
}
```

- [ ] **Step 15.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/DualHero.tsx"
git commit -m "feat(ui): add DualHero — bilingual post + video featured cards"
```

---

## Task 16: ChannelStrip

**Files:**
- Create: `apps/web/src/app/(public)/components/ChannelStrip.tsx`

- [ ] **Step 16.1: Create `ChannelStrip.tsx`**

```tsx
// apps/web/src/app/(public)/components/ChannelStrip.tsx
import { PaperCard } from './PaperCard'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'
import type { HomeChannel } from '../../../../lib/home/types'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

function ChannelCard({ channel, isPrimary, t, index }: { channel: HomeChannel; isPrimary: boolean; t: Record<string, string>; index: number }) {
  return (
    <PaperCard index={index} variant={index % 2 === 0 ? 'paper' : 'paper2'} className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-12 h-12 rounded-full bg-pb-yt flex items-center justify-center text-white font-bold text-lg shrink-0">
          TF
        </div>
        <div>
          <p className="font-fraunces text-pb-ink text-lg leading-tight">{channel.name}</p>
          <p className="font-mono text-pb-muted text-xs">{channel.handle}</p>
        </div>
        {isPrimary && (
          <span className="ml-auto font-mono text-xs bg-pb-marker text-pb-bg px-2 py-0.5 rounded">
            {t['channels.primary']}
          </span>
        )}
      </div>

      <a
        href={channel.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t['channels.subscribe']} ${channel.name}`}
        className="inline-flex items-center gap-2 bg-pb-yt text-white font-mono font-semibold text-sm px-4 py-2 rounded self-start"
      >
        {channel.flag} {t['channels.subscribe']}
      </a>
    </PaperCard>
  )
}

export function ChannelStrip({ locale, t }: Props) {
  const primary = YOUTUBE_CHANNELS[locale]
  const secondary = YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']

  return (
    <section className="px-6 py-8">
      <h2 className="font-fraunces text-pb-ink text-2xl mb-6" style={{ letterSpacing: '-0.02em' }}>
        {t['channels.title']}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChannelCard channel={primary} isPrimary index={0} t={t} />
        <ChannelCard channel={secondary} isPrimary={false} index={1} t={t} />
      </div>
    </section>
  )
}
```

- [ ] **Step 16.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/ChannelStrip.tsx"
git commit -m "feat(ui): add ChannelStrip — dual YouTube channel cards"
```

---

## Task 17: UnifiedFeed

**Files:**
- Create: `apps/web/src/app/(public)/components/UnifiedFeed.tsx`

- [ ] **Step 17.1: Create `UnifiedFeed.tsx`**

```tsx
// apps/web/src/app/(public)/components/UnifiedFeed.tsx
import Link from 'next/link'
import Image from 'next/image'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost, HomeVideo } from '../../../../lib/home/types'

type FeedItem =
  | ({ kind: 'post' } & HomePost)
  | ({ kind: 'video' } & HomeVideo)

type Props = {
  posts: HomePost[]
  videos: HomeVideo[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

export function UnifiedFeed({ posts, videos, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  const items: FeedItem[] = [
    ...posts.map(p => ({ kind: 'post' as const, ...p })),
    ...videos.map(v => ({ kind: 'video' as const, ...v })),
  ]
    .sort((a, b) => {
      const aDate = a.kind === 'post' ? a.publishedAt : a.publishedAt
      const bDate = b.kind === 'post' ? b.publishedAt : b.publishedAt
      return bDate.localeCompare(aDate)
    })
    .slice(0, 9)

  if (items.length === 0) return null

  return (
    <section className="px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item, i) => (
          <FeedCard key={`${item.kind}-${item.id}`} item={item} index={i} blogBase={blogBase} t={t} isDark={isDark} />
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={blogBase}
          className="font-mono text-sm text-pb-accent hover:underline"
        >
          {t['feed.seeAll']}
        </Link>
      </div>
    </section>
  )
}

function FeedCard({ item, index, blogBase, t, isDark }: {
  item: FeedItem
  index: number
  blogBase: string
  t: Record<string, string>
  isDark: boolean
}) {
  const tapeVariants = ['tape', 'tape2', 'tapeR'] as const
  const tape = tapeVariants[index % 3]

  if (item.kind === 'post') {
    return (
      <PaperCard index={index} variant={index % 2 === 0 ? 'paper' : 'paper2'} className="overflow-hidden">
        <Tape variant={tape} className="-top-2 left-4" rotate={-7 + (index % 5)} />
        <Link href={`${blogBase}/${item.slug}`} className="block group">
          <div className="h-32 w-full" style={{ background: item.coverImageUrl ? undefined : coverGradient(item.category, isDark) }}>
            {item.coverImageUrl && (
              <Image src={item.coverImageUrl} alt={item.title} width={400} height={128} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-bold text-pb-accent">▤ {t['feed.type.post']}</span>
              {item.category && <span className="font-mono text-xs text-pb-muted capitalize">{item.category}</span>}
              <span className="font-mono text-xs text-pb-faint ml-auto">{item.readingTimeMin}{t['feed.readMin']}</span>
            </div>
            <h3 className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-accent transition-colors" style={{ letterSpacing: '-0.01em' }}>
              {item.title}
            </h3>
            {item.excerpt && (
              <p className="text-pb-muted text-xs mt-1 line-clamp-2">{item.excerpt}</p>
            )}
          </div>
        </Link>
      </PaperCard>
    )
  }

  return (
    <PaperCard index={index} variant={index % 2 === 0 ? 'paper' : 'paper2'} className="overflow-hidden">
      <Tape variant={tape} className="-top-2 left-4" rotate={-7 + (index % 5)} />
      <a href={item.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="h-32 w-full relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#1a0808 0%,#3a1010 100%)' }}>
          {item.thumbnailUrl && (
            <Image src={item.thumbnailUrl} alt={item.title} fill className="object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl text-white opacity-70 group-hover:opacity-100 transition-opacity">▶</span>
          </div>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs font-bold text-pb-yt">▶ {t['feed.type.video']}</span>
            <span className="font-mono text-xs text-pb-muted">{item.series}</span>
            <span className="font-mono text-xs text-pb-faint ml-auto">{item.duration}</span>
          </div>
          <h3 className="font-fraunces text-pb-ink text-lg leading-snug group-hover:text-pb-yt transition-colors" style={{ letterSpacing: '-0.01em' }}>
            {item.title}
          </h3>
        </div>
      </a>
    </PaperCard>
  )
}
```

- [ ] **Step 17.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/UnifiedFeed.tsx"
git commit -m "feat(ui): add UnifiedFeed — merged posts + videos date-sorted grid"
```

---

## Task 18: NewsletterInline

**Files:**
- Create: `apps/web/src/app/(public)/components/NewsletterInline.tsx`

- [ ] **Step 18.1: Create `NewsletterInline.tsx`**

```tsx
// apps/web/src/app/(public)/components/NewsletterInline.tsx
'use client'

import { useActionState, useRef } from 'react'
import { subscribeNewsletterInline, type InlineState } from '../actions/newsletter-inline'
import type { HomeNewsletter } from '../../../../lib/home/types'

type Props = {
  locale: 'en' | 'pt-BR'
  primaryNewsletter: HomeNewsletter
  t: Record<string, string>
}

const INITIAL: InlineState = {}

export function NewsletterInline({ locale, primaryNewsletter, t }: Props) {
  const [state, dispatch, pending] = useActionState(subscribeNewsletterInline, INITIAL)

  return (
    <section id="newsletter" className="px-6 py-12 border-t border-[--pb-line]">
      <div className="max-w-md mx-auto text-center">
        <h2 className="font-fraunces text-pb-ink text-3xl mb-2" style={{ letterSpacing: '-0.03em' }}>
          {t['newsletter.title']}
        </h2>
        <p className="text-pb-muted text-sm mb-6">{t['newsletter.subtitle']}</p>

        {state.success ? (
          <p className="text-pb-accent font-mono text-sm py-4">{t['newsletter.success']}</p>
        ) : (
          <form action={dispatch} className="flex flex-col gap-3">
            <input type="hidden" name="newsletter_id" value={primaryNewsletter.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="consent_processing" value="on" />
            <input type="hidden" name="consent_marketing" value="on" />

            <div className="flex gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder={t['newsletter.emailPlaceholder']}
                className="flex-1 px-3 py-2 rounded text-sm font-mono bg-[--pb-paper2] text-pb-ink border border-[--pb-line] placeholder:text-pb-faint focus:outline-none focus:border-pb-accent"
              />
              <button
                type="submit"
                disabled={pending}
                className="bg-pb-accent text-white font-mono font-semibold text-sm px-4 py-2 rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {pending ? '…' : t['newsletter.submit']}
              </button>
            </div>

            {state.error && (
              <p className="text-pb-yt font-mono text-xs">{state.error}</p>
            )}

            <p className="text-pb-faint text-xs">
              {t['newsletter.consent']}{' '}
              <a href="/privacy" className="underline hover:text-pb-muted">Privacy Policy</a>
            </p>
          </form>
        )}

        <a href="/newsletter" className="mt-4 inline-block font-mono text-xs text-pb-accent hover:underline">
          {t['newsletter.more']}
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 18.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/NewsletterInline.tsx"
git commit -m "feat(ui): add NewsletterInline client component"
```

---

## Task 19: PinboardFooter

**Files:**
- Create: `apps/web/src/app/(public)/components/PinboardFooter.tsx`

- [ ] **Step 19.1: Create `PinboardFooter.tsx`**

```tsx
// apps/web/src/app/(public)/components/PinboardFooter.tsx
import Link from 'next/link'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function PinboardFooter({ locale, t }: Props) {
  const year = new Date().getFullYear()
  const blogHref = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'

  return (
    <footer className="border-t border-[--pb-line] bg-[--pb-bg] px-6 py-10 mt-8">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Brand + tagline */}
        <div>
          <span className="font-fraunces text-pb-ink text-lg" style={{ letterSpacing: '-0.02em' }}>
            by<em>thiago</em><span className="text-pb-accent">.</span>
          </span>
          <p className="text-pb-muted text-xs mt-1">{t['footer.tagline']}</p>
        </div>

        {/* Links */}
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-pb-muted text-sm" aria-label="Footer navigation">
          <Link href={blogHref} className="hover:text-pb-ink transition-colors">{t['footer.blog']}</Link>
          <Link href="/newsletter" className="hover:text-pb-ink transition-colors">{t['footer.newsletter']}</Link>
          <Link href="/contact" className="hover:text-pb-ink transition-colors">{t['footer.contact']}</Link>
          <Link href="/privacy" className="hover:text-pb-ink transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-pb-ink transition-colors">Terms</Link>
          <a href="https://dev.bythiagofigueiredo.com" target="_blank" rel="noopener" className="hover:text-pb-ink transition-colors opacity-60">Dev ↗</a>
        </nav>

        {/* Copyright */}
        <p className="text-pb-faint text-xs font-mono">
          {t['footer.copyright'].replace('{year}', String(year))} · {t['footer.madeIn']}
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 19.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/PinboardFooter.tsx"
git commit -m "feat(ui): add PinboardFooter"
```

---

## Task 20: PinboardHome Orchestrator

**Files:**
- Create: `apps/web/src/app/(public)/components/PinboardHome.tsx`

- [ ] **Step 20.1: Create `PinboardHome.tsx`**

```tsx
// apps/web/src/app/(public)/components/PinboardHome.tsx
import { cookies } from 'next/headers'
import { PinboardHeader } from './PinboardHeader'
import { DualHero } from './DualHero'
import { ChannelStrip } from './ChannelStrip'
import { UnifiedFeed } from './UnifiedFeed'
import { NewsletterInline } from './NewsletterInline'
import { PinboardFooter } from './PinboardFooter'
import { getFeaturedPost, getLatestPosts, getNewslettersForLocale } from '../../../../lib/home/queries'
import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'

// Locale string loaders
async function loadTranslations(locale: 'en' | 'pt-BR'): Promise<Record<string, string>> {
  if (locale === 'pt-BR') {
    const m = await import('../../../locales/pt-BR.json')
    return m.default as Record<string, string>
  }
  const m = await import('../../../locales/en.json')
  return m.default as Record<string, string>
}

type Props = { locale: 'en' | 'pt-BR' }

export async function PinboardHome({ locale }: Props) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('btf_theme')?.value === 'light' ? 'light' : 'dark'
  const isDark = theme === 'dark'

  const [featuredPost, latestPosts, newsletters, t] = await Promise.all([
    getFeaturedPost(locale),
    getLatestPosts(locale, 8),
    getNewslettersForLocale(locale),
    loadTranslations(locale),
  ])

  const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
  const featuredVideo = localeVideos[0] ?? null
  const primaryNewsletter = newsletters[0]

  // Posts for the feed (exclude the featured one to avoid duplication)
  const feedPosts = latestPosts.filter(p => p.id !== featuredPost?.id).slice(0, 6)

  return (
    <div className="min-h-screen" style={{ background: 'var(--pb-bg)', color: 'var(--pb-ink)' }}>
      {/* Skip to content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-pb-accent text-white px-4 py-2 rounded z-50">
        {locale === 'pt-BR' ? 'Ir para o conteúdo' : 'Skip to content'}
      </a>

      <PinboardHeader locale={locale} currentTheme={theme} t={t} />

      <main id="main-content">
        <DualHero post={featuredPost} video={featuredVideo} locale={locale} t={t} isDark={isDark} />
        <ChannelStrip locale={locale} t={t} />
        <UnifiedFeed posts={feedPosts} videos={localeVideos.slice(1)} locale={locale} t={t} isDark={isDark} />
        {primaryNewsletter && (
          <NewsletterInline locale={locale} primaryNewsletter={primaryNewsletter} t={t} />
        )}
      </main>

      <PinboardFooter locale={locale} t={t} />
    </div>
  )
}
```

- [ ] **Step 20.2: Commit**

```bash
git add "apps/web/src/app/(public)/components/PinboardHome.tsx"
git commit -m "feat(home): add PinboardHome Server Component orchestrator"
```

---

## Task 21: Routes

**Files:**
- Modify: `apps/web/src/app/(public)/page.tsx`
- Create: `apps/web/src/app/(public)/pt-BR/page.tsx`

- [ ] **Step 21.1: Update `apps/web/src/app/(public)/page.tsx`**

Read the current file. Replace the page body entirely while keeping the `generateMetadata` function. Update metadata to add hreflang:

```tsx
import type { Metadata } from 'next'
import { PinboardHome } from './components/PinboardHome'

export const metadata: Metadata = {
  title: 'Thiago Figueiredo — Creator & Builder',
  description: 'Writing, videos, and experiments from the edge of the keyboard.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com',
    languages: { 'pt-BR': 'https://bythiagofigueiredo.com/pt-BR' },
  },
}

export default function HomePage() {
  return <PinboardHome locale="en" />
}
```

If the current `page.tsx` has a `generateMetadata` function pulling from a SEO config, preserve that pattern and just EXTEND the return value with the `alternates` field. The static metadata above is acceptable if the existing pattern is overly complex to thread through.

- [ ] **Step 21.2: Create `apps/web/src/app/(public)/pt-BR/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { PinboardHome } from '../components/PinboardHome'

export const metadata: Metadata = {
  title: 'Thiago Figueiredo — Criador & Builder',
  description: 'Textos, vídeos e experimentos da beira do teclado.',
  alternates: {
    canonical: 'https://bythiagofigueiredo.com/pt-BR',
    languages: { 'en': 'https://bythiagofigueiredo.com' },
  },
}

export default function HomePagePtBR() {
  return <PinboardHome locale="pt-BR" />
}
```

- [ ] **Step 21.3: Run type check**

```bash
npm run typecheck -w apps/web 2>&1 | tail -20
```

Fix any errors before proceeding.

- [ ] **Step 21.4: Start dev server and verify**

```bash
npm run dev -w apps/web
```

Open `http://localhost:3000` — should render PinboardHome with EN content.
Open `http://localhost:3000/pt-BR` — should render PinboardHome with PT-BR content.

Verify:
- [ ] Pinboard palette applied (warm sepia tones)
- [ ] Cards have paper texture + slight rotation
- [ ] Header shows correct nav + YouTube CTAs
- [ ] DualHero renders (may show "Coming soon" if no posts)
- [ ] ChannelStrip shows both YouTube channels
- [ ] Footer renders correctly
- [ ] Theme toggle switches dark/light (check cookie is set in DevTools → Application → Cookies)
- [ ] Lang switcher navigates between `/` and `/pt-BR`

- [ ] **Step 21.5: Commit**

```bash
git add "apps/web/src/app/(public)/page.tsx" "apps/web/src/app/(public)/pt-BR/"
git commit -m "feat(routes): replace homepage + add /pt-BR bilingual route"
```

---

## Task 22: SEO Updates

**Files:**
- Modify: `apps/web/lib/seo/enumerator.ts`

- [ ] **Step 22.1: Add `/pt-BR` to static routes**

Open `apps/web/lib/seo/enumerator.ts`. Find `STATIC_ROUTE_DEFS` array:

```ts
const STATIC_ROUTE_DEFS = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
]
```

Add `/pt-BR`:

```ts
const STATIC_ROUTE_DEFS = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/pt-BR', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
]
```

- [ ] **Step 22.2: Run tests**

```bash
npm run test:web 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 22.3: Commit**

```bash
git add apps/web/lib/seo/enumerator.ts
git commit -m "feat(seo): add /pt-BR to sitemap static routes"
```

---

## Task 23: Remove Old Components

**Files:**
- Remove: `apps/web/src/app/(public)/components/Header.tsx`
- Remove: `apps/web/src/app/(public)/components/Hero.tsx`
- Remove: `apps/web/src/app/(public)/components/SocialLinks.tsx`
- Modify: `apps/web/src/app/(public)/components/Footer.tsx` → replaced by PinboardFooter (can be deleted if no other pages use it)

- [ ] **Step 23.1: Check for other usages before deleting**

```bash
grep -r "from.*Header\|from.*Hero\|from.*SocialLinks\|from.*Footer" apps/web/src/app --include="*.tsx" | grep -v "(public)/components/Pinboard"
```

If any pages outside `(public)/page.tsx` import these, update those imports first.

- [ ] **Step 23.2: Delete old components**

```bash
rm apps/web/src/app/'(public)'/components/Header.tsx
rm apps/web/src/app/'(public)'/components/Hero.tsx
rm apps/web/src/app/'(public)'/components/SocialLinks.tsx
```

Only delete `Footer.tsx` if no other page imports it.

- [ ] **Step 23.3: Run type check — no dangling imports**

```bash
npm run typecheck -w apps/web 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 23.4: Commit**

```bash
git add -A
git commit -m "chore(cleanup): remove legacy Header, Hero, SocialLinks components"
```

---

## Task 24: Full Test Run + Add RESEND_API_KEY Env Var

**Files:**
- Modify: `apps/web/.env.local` — add `RESEND_API_KEY`

- [ ] **Step 24.1: Add env var to `.env.local`**

Open `apps/web/.env.local` and add:

```
RESEND_API_KEY=your_resend_api_key_here
```

Get the key from resend.com dashboard. **Do NOT commit this file** (it's in `.gitignore`).

Also add to Vercel Environment Variables for production.

- [ ] **Step 24.2: Run full test suite**

```bash
npm test
```

Expected output: all tests passing. If any test fails, fix before proceeding.

- [ ] **Step 24.3: Run type check**

```bash
npm run typecheck -w apps/web && npm run typecheck -w apps/api
```

Expected: no errors.

- [ ] **Step 24.4: Final browser smoke**

With dev server running (`npm run dev -w apps/web`):

- [ ] `/` renders PinboardHome in dark mode
- [ ] `/pt-BR` renders PinboardHome in PT-BR
- [ ] Theme toggle: click → page switches light/dark without full reload; cookie `btf_theme` visible in DevTools
- [ ] Language toggle: EN → `/pt-BR` and back
- [ ] Newsletter inline form: enter email, submit → "Check your inbox" message appears
- [ ] YouTube Subscribe buttons link to correct channels (`@tnFigueiredoTV` for PT-BR, `@byThiagoFigueiredo` for EN)
- [ ] `curl http://localhost:3000/sitemap.xml | grep pt-BR` → should include the route

- [ ] **Step 24.5: Commit**

```bash
git add -A
git commit -m "chore(env): document RESEND_API_KEY requirement (not committed)"
```

---

## Task 25: Final PR

- [ ] **Step 25.1: Run full tests one last time**

```bash
npm test
```

All passing.

- [ ] **Step 25.2: Push branch + open PR**

```bash
git push origin HEAD
gh pr create \
  --base staging \
  --title "feat(homepage): pinboard design — bilingual, PaperCard, Resend, newsletter schema v2" \
  --body "$(cat <<'EOF'
## Summary
- Replaces bare-bones homepage with editorial Pinboard design (warm sepia palette, paper cards, tape decorations)
- Bilingual routes: `/` (EN) + `/pt-BR` (PT-BR) sharing `PinboardHome` Server Component
- 3 DB migrations: `is_featured`, `category` on `blog_posts`; `newsletter_types` table + `newsletter_id` FK
- Cookie-based theme toggle (dark/light) via `/api/theme` — SSR-safe, no FOUC
- Inline newsletter subscribe (Server Action, Resend confirmation email)
- Resend replaces Brevo for confirmation emails; Brevo cron sync unchanged
- YouTube channels: PT-BR `@tnFigueiredoTV`, EN `@byThiagoFigueiredo`

## Test plan
- [ ] `npm test` — all tests passing
- [ ] `npm run typecheck -w apps/web` — no errors
- [ ] Browse `/` and `/pt-BR` on preview
- [ ] Theme toggle changes cookie + DOM without reload
- [ ] Newsletter inline form shows success message on submit
- [ ] `/sitemap.xml` includes `/pt-BR`
- [ ] YouTube Subscribe buttons point to correct channels

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## File Map

| File | Status |
|---|---|
| `supabase/migrations/20260419000001_blog_posts_is_featured.sql` | New |
| `supabase/migrations/20260419000002_blog_posts_category.sql` | New |
| `supabase/migrations/20260419000003_newsletter_schema_v2.sql` | New |
| `apps/web/lib/email/resend.ts` | New |
| `apps/web/lib/home/types.ts` | New |
| `apps/web/lib/home/cover-image.ts` | New |
| `apps/web/lib/home/videos-data.ts` | New |
| `apps/web/lib/home/queries.ts` | New |
| `apps/web/src/locales/en.json` | Extend |
| `apps/web/src/locales/pt-BR.json` | New |
| `apps/web/src/app/globals.css` | Extend — pinboard tokens |
| `apps/web/src/app/(public)/layout.tsx` | Modify — fonts + cookie theme |
| `apps/web/src/app/(public)/page.tsx` | Rewrite |
| `apps/web/src/app/(public)/pt-BR/page.tsx` | New |
| `apps/web/src/app/(public)/components/PinboardHome.tsx` | New |
| `apps/web/src/app/(public)/components/PinboardHeader.tsx` | New |
| `apps/web/src/app/(public)/components/DualHero.tsx` | New |
| `apps/web/src/app/(public)/components/ChannelStrip.tsx` | New |
| `apps/web/src/app/(public)/components/UnifiedFeed.tsx` | New |
| `apps/web/src/app/(public)/components/NewsletterInline.tsx` | New |
| `apps/web/src/app/(public)/components/ThemeToggle.tsx` | New |
| `apps/web/src/app/(public)/components/PaperCard.tsx` | New |
| `apps/web/src/app/(public)/components/Tape.tsx` | New |
| `apps/web/src/app/(public)/components/PinboardFooter.tsx` | New |
| `apps/web/src/app/(public)/actions/newsletter-inline.ts` | New |
| `apps/web/src/app/api/theme/route.ts` | New |
| `apps/web/src/app/newsletter/subscribe/actions.ts` | Modify — Resend swap |
| `apps/web/lib/seo/enumerator.ts` | Modify — add /pt-BR |
| `apps/web/src/app/(public)/components/Header.tsx` | Delete |
| `apps/web/src/app/(public)/components/Hero.tsx` | Delete |
| `apps/web/src/app/(public)/components/SocialLinks.tsx` | Delete |
