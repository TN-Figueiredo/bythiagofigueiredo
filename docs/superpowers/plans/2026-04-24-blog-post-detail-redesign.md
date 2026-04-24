# Blog Post Detail Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the blog post detail page from a minimal single-column layout into a rich 3-column editorial experience with sticky sidebars, reading progress, AI Reader drawer, text highlights, and 20+ new components.

**Architecture:** Server-rendered page loads post data + parses frontmatter extras via new `PostExtrasSchema`. Hero section (meta → cover) centered above a CSS Grid 3-column layout (TOC | article | key points). Client components provide scroll-driven interactions (progress bar, TOC tracking, time pill) via a shared `IntersectionObserver` context. Hardcoded data (comments, engagement, series) renders server-side. Text highlights persist to `localStorage`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, TypeScript 5, Vitest + happy-dom + @testing-library/react, Zod, `@tn-figueiredo/cms` (MdxRunner, compileMdx, blogRegistry)

**Spec:** `docs/superpowers/specs/2026-04-24-blog-post-detail-redesign-design.md`

---

## File Map

### New Files — `apps/web/src/components/blog/`

| File | Type | Purpose |
|---|---|---|
| `types.ts` | Shared | Post extras types + mock data types |
| `post-extras-schema.ts` | Shared | Zod schema for editorial frontmatter (key_points, tags, pull_quote, series, colophon) |
| `reading-progress.tsx` | Client | Segmented progress bar below header |
| `time-left-pill.tsx` | Client | Fixed pill showing remaining time + current section |
| `post-toc.tsx` | Client | Left sidebar TOC with active tracking |
| `post-key-points.tsx` | Server | Right sidebar numbered key points |
| `post-pull-quote.tsx` | Server | Right sidebar pull quote |
| `share-buttons.tsx` | Client | X, LinkedIn, copy-link buttons |
| `copy-link-toast.tsx` | Client | "Copiado!" toast near button |
| `author-row.tsx` | Server | Inline author meta + engagement + share |
| `author-card.tsx` | Server | End-of-article author bio card |
| `series-banner.tsx` | Server | "PARTE DA SERIE" banner |
| `series-nav.tsx` | Server | "CONTINUA NA PROXIMA PARTE" card |
| `post-tags.tsx` | Server | Tag pills section |
| `post-comments.tsx` | Server | Hardcoded comments section |
| `cover-image.tsx` | Server | Paper+tape cover image wrapper |
| `newsletter-cta.tsx` | Client | Contextual newsletter signup with tape decoration |
| `post-footnotes.tsx` | Client | Footnotes section with popover |
| `post-colophon.tsx` | Server | Colofao section |
| `related-posts-grid.tsx` | Server | 3-col related posts with PaperCard |
| `ai-reader-button.tsx` | Client | Floating AI Reader pill |
| `ai-reader-drawer.tsx` | Client | Side drawer with TL;DR / Explain / Chat tabs |
| `mobile-toc-sheet.tsx` | Client | Bottom sheet TOC for mobile |
| `text-highlighter.tsx` | Client | Selection tooltip + highlight persistence |
| `highlights-sidebar.tsx` | Client | Right sidebar saved highlights list |
| `scroll-context.tsx` | Client | Shared IntersectionObserver context for TOC + progress |
| `mock-data.ts` | Shared | Hardcoded comments, engagement stats |

### Modified Files

| File | Change |
|---|---|
| `apps/web/src/app/layout.tsx` | Add Source Serif 4 font import |
| `apps/web/src/app/globals.css` | Add `--font-source-serif-var` to `@theme`, add blog detail CSS |
| `apps/web/src/styles/reader-pinboard.css` | Add Source Serif 4 body styles, highlight marks, progress bar, footnote popover |
| `apps/web/lib/seo/frontmatter.ts` | Extend to also parse + return `PostExtras` |
| `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx` | Full rewrite: 3-col layout, all new components |
| `apps/web/src/app/(public)/blog/[locale]/[slug]/blog-article-client.tsx` | Add ScrollProvider + TextHighlighter wrapper |

### Test Files — `apps/web/test/`

| File | Tests |
|---|---|
| `test/components/blog/post-extras-schema.test.ts` | Zod validation for PostExtrasSchema |
| `test/components/blog/server-components.test.tsx` | PostKeyPoints, PostPullQuote, PostColophon, PostTags, SeriesBanner, SeriesNav, AuthorRow, AuthorCard, PostComments, CoverImage |
| `test/components/blog/share-buttons.test.tsx` | ShareButtons clipboard + toast |
| `test/components/blog/newsletter-cta.test.tsx` | NewsletterCta render + form |
| `test/components/blog/reading-progress.test.tsx` | ReadingProgressBar segmentation |
| `test/components/blog/post-toc.test.tsx` | PostToc active tracking |
| `test/components/blog/text-highlighter.test.tsx` | Highlight selection + localStorage |
| `test/components/blog/ai-reader.test.tsx` | AiReaderButton + AiReaderDrawer |
| `test/app/blog-detail.test.tsx` | Full page integration: 3-col layout, all sections |

---

## Task 1: Add Source Serif 4 Font

**Files:**
- Modify: `apps/web/src/app/layout.tsx:2,28-29,57-58`
- Modify: `apps/web/src/app/globals.css:148-150`

- [ ] **Step 1: Add Source Serif 4 import to root layout**

```typescript
// apps/web/src/app/layout.tsx — add to imports (line 2)
import { Inter, Fraunces, JetBrains_Mono, Caveat, Source_Serif_4 } from 'next/font/google'

// Add after line 28 (after caveat definition)
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif-var',
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['400', '600'],
})
```

- [ ] **Step 2: Add CSS variable to html className**

```typescript
// apps/web/src/app/layout.tsx — update the className on <html> (line 58)
className={`${theme === 'dark' ? 'dark' : ''} ${inter.variable} ${fraunces.variable} ${jetbrains.variable} ${caveat.variable} ${sourceSerif.variable}`}
```

- [ ] **Step 3: Register in Tailwind @theme block**

```css
/* apps/web/src/app/globals.css — add after --font-caveat (line 150) */
  --font-source-serif: var(--font-source-serif-var);
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/web && npx next build 2>&1 | head -30`
Expected: Build succeeds, no font errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "feat(blog): add Source Serif 4 font for article body text"
```

---

## Task 2: PostExtrasSchema + Frontmatter Extension

**Files:**
- Create: `apps/web/src/components/blog/post-extras-schema.ts`
- Create: `apps/web/src/components/blog/types.ts`
- Modify: `apps/web/lib/seo/frontmatter.ts`
- Create: `apps/web/test/components/blog/post-extras-schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/components/blog/post-extras-schema.test.ts
import { describe, it, expect } from 'vitest'
import { PostExtrasSchema, type PostExtras } from '../../../src/components/blog/post-extras-schema'

describe('PostExtrasSchema', () => {
  it('parses full valid extras', () => {
    const input = {
      key_points: ['Point 1', 'Point 2'],
      tags: ['meta', 'manifesto'],
      pull_quote: 'a notebook, not a product',
      pull_quote_attribution: 'PROMISE 3',
      series_title: 'Building in public',
      series_part: 1,
      series_total: 3,
      series_next_slug: 'cms-for-all',
      series_next_title: 'A CMS to rule them all',
      series_next_excerpt: 'The architecture behind cross-site publishing...',
      colophon: 'Written in iA Writer on a MacBook Air M2.',
    }
    const result = PostExtrasSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key_points).toHaveLength(2)
      expect(result.data.tags).toHaveLength(2)
      expect(result.data.pull_quote).toBe('a notebook, not a product')
      expect(result.data.series_part).toBe(1)
    }
  })

  it('allows all fields to be absent (empty object)', () => {
    const result = PostExtrasSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key_points).toBeUndefined()
      expect(result.data.tags).toBeUndefined()
      expect(result.data.colophon).toBeUndefined()
    }
  })

  it('rejects key_points that is not string array', () => {
    const result = PostExtrasSchema.safeParse({ key_points: 'not-array' })
    expect(result.success).toBe(false)
  })

  it('rejects series_part without series_title', () => {
    const result = PostExtrasSchema.safeParse({ series_part: 2 })
    expect(result.success).toBe(false)
  })

  it('accepts partial series (title only, no next)', () => {
    const result = PostExtrasSchema.safeParse({
      series_title: 'My series',
      series_part: 1,
      series_total: 2,
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/components/blog/post-extras-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create PostExtrasSchema**

```typescript
// apps/web/src/components/blog/post-extras-schema.ts
import { z } from 'zod'

export const PostExtrasSchema = z.object({
  key_points: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  pull_quote: z.string().optional(),
  pull_quote_attribution: z.string().optional(),
  series_title: z.string().optional(),
  series_part: z.number().int().positive().optional(),
  series_total: z.number().int().positive().optional(),
  series_next_slug: z.string().optional(),
  series_next_title: z.string().optional(),
  series_next_excerpt: z.string().optional(),
  colophon: z.string().optional(),
}).refine(
  (data) => {
    if (data.series_part !== undefined && !data.series_title) return false
    if (data.series_total !== undefined && !data.series_title) return false
    return true
  },
  { message: 'series_part and series_total require series_title' },
)

export type PostExtras = z.infer<typeof PostExtrasSchema>
```

- [ ] **Step 4: Create shared types**

```typescript
// apps/web/src/components/blog/types.ts
import type { PostExtras } from './post-extras-schema'

export type { PostExtras }

export type TocEntry = {
  slug: string
  text: string
  depth: 2 | 3
}

export type AuthorData = {
  name: string
  role: string
  avatarUrl: string | null
  initials: string
  bio: string
  links: Array<{ label: string; href: string }>
}

export type EngagementStats = {
  views: number
  likes: number
  bookmarked: boolean
}

export type MockComment = {
  id: string
  authorName: string
  authorInitials: string
  avatarColor: string
  text: string
  timeAgo: string
  likes: number
  isAuthorReply: boolean
  parentId: string | null
}
```

- [ ] **Step 5: Extend frontmatter parser to return PostExtras**

```typescript
// apps/web/lib/seo/frontmatter.ts — add PostExtras parsing
import matter from 'gray-matter'
import { SeoExtrasSchema, SeoExtrasValidationError, type SeoExtras } from './jsonld/extras-schema'
import { PostExtrasSchema, type PostExtras } from '@/components/blog/post-extras-schema'

export { SeoExtrasValidationError } from './jsonld/extras-schema'

export interface ParsedMdx {
  content: string
  seoExtras: SeoExtras | null
  postExtras: PostExtras | null
  raw: Record<string, unknown>
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
  const postExtrasParsed = PostExtrasSchema.safeParse(data)
  const postExtras = postExtrasParsed.success ? postExtrasParsed.data : null
  return { content, seoExtras, postExtras, raw: data }
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/post-extras-schema.test.ts test/lib/seo/frontmatter.test.ts`
Expected: All pass. The existing frontmatter tests should still pass since `postExtras` is additive.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/blog/post-extras-schema.ts apps/web/src/components/blog/types.ts apps/web/lib/seo/frontmatter.ts apps/web/test/components/blog/post-extras-schema.test.ts
git commit -m "feat(blog): add PostExtrasSchema for editorial frontmatter fields"
```

---

## Task 3: Mock Data + Author Profile

**Files:**
- Create: `apps/web/src/components/blog/mock-data.ts`

- [ ] **Step 1: Create mock data module**

```typescript
// apps/web/src/components/blog/mock-data.ts
import type { AuthorData, MockComment, EngagementStats } from './types'

export const AUTHOR_THIAGO: AuthorData = {
  name: 'Thiago Figueiredo',
  role: 'Dev indie, BH',
  avatarUrl: null,
  initials: 'TF',
  bio: 'Construo software ha seis anos. Desde 2024, so pra mim mesmo: seis apps no forno, um canal no YouTube, um blog que virou o centro de tudo. Aqui voce me acha escrevendo uma vez por semana, filmando uma vez por semana, e quebrando coisa em producao com a frequencia que Deus achar justa.',
  links: [
    { label: 'YouTube', href: 'https://www.youtube.com/@bythiagofigueiredo' },
    { label: 'GitHub', href: 'https://github.com/tn-figueiredo' },
    { label: 'X', href: 'https://x.com/tnFigueiredo' },
    { label: 'RSS', href: '/rss.xml' },
  ],
}

export const MOCK_ENGAGEMENT: EngagementStats = {
  views: 2460,
  likes: 319,
  bookmarked: false,
}

export const MOCK_COMMENTS: MockComment[] = [
  {
    id: 'c1',
    authorName: 'Paula Reis',
    authorInitials: 'PR',
    avatarColor: '#C4956A',
    text: 'A promessa #3 e a mais honesta que eu li em muito tempo. Guardei aqui.',
    timeAgo: 'ha 2 dias',
    likes: 12,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c1r1',
    authorName: 'Thiago Figueiredo',
    authorInitials: 'TF',
    avatarColor: 'var(--pb-accent)',
    text: 'Obrigado, Paula. Escrever essa parte foi a que mais travou — a gente sempre quer fingir que a coisa vai durar pra sempre.',
    timeAgo: 'ha 2 dias',
    likes: 7,
    isAuthorReply: true,
    parentId: 'c1',
  },
  {
    id: 'c2',
    authorName: 'Rafa Oliveira',
    authorInitials: 'RO',
    avatarColor: '#8BAA7A',
    text: 'Esperando o post sobre como funciona a junction table no detalhe. Tem link?',
    timeAgo: 'ha 3 dias',
    likes: 8,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c3',
    authorName: 'Diego Souza',
    authorInitials: 'DS',
    avatarColor: '#7AA4B8',
    text: '+1, tambem curti o uso do rendered_at pra cache invalidation.',
    timeAgo: 'ha 2 dias',
    likes: 2,
    isAuthorReply: false,
    parentId: null,
  },
  {
    id: 'c4',
    authorName: 'Ana Costa',
    authorInitials: 'AC',
    avatarColor: '#B8A07A',
    text: 'Finalmente alguem que admite que 60 dos 83 drafts sao ruins. Isso e libertador.',
    timeAgo: 'ha 1 dia',
    likes: 15,
    isAuthorReply: false,
    parentId: null,
  },
]
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/mock-data.ts
git commit -m "feat(blog): add hardcoded author + comments + engagement mock data"
```

---

## Task 4: Blog Detail CSS

**Files:**
- Modify: `apps/web/src/styles/reader-pinboard.css`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add blog detail styles to reader-pinboard.css**

Append to `apps/web/src/styles/reader-pinboard.css` after line 29:

```css
/* ═══ Blog Detail — 3-Column Layout ═══ */

.blog-detail-hero {
  max-width: 760px;
  margin: 0 auto;
}

.blog-detail-grid {
  display: grid;
  grid-template-columns: 200px minmax(0, 760px) 240px;
  gap: 40px;
  justify-content: center;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 40px;
  align-items: start;
}

@media (max-width: 960px) {
  .blog-detail-grid {
    grid-template-columns: 1fr;
    padding: 0 16px;
  }
  .blog-detail-sidebar { display: none; }
}

.blog-detail-footer {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 0 32px;
}

/* ═══ Article Body — Source Serif 4 ═══ */

.reader-article .blog-body {
  font-family: var(--font-source-serif), Georgia, serif;
  font-size: 19px;
  line-height: 1.72;
}

.reader-article .blog-body h2 {
  font-family: var(--font-fraunces), serif;
  font-size: 32px;
  font-weight: 700;
  margin: 48px 0 16px;
  line-height: 1.15;
}

.reader-article .blog-body h3 {
  font-family: var(--font-fraunces), serif;
  font-size: 22px;
  font-weight: 600;
  margin: 32px 0 12px;
  line-height: 1.2;
}

.reader-article .blog-body h2 .heading-anchor,
.reader-article .blog-body h3 .heading-anchor {
  color: var(--pb-faint);
  text-decoration: none;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}
.reader-article .blog-body h2:hover .heading-anchor,
.reader-article .blog-body h3:hover .heading-anchor {
  opacity: 1;
}

.reader-article .blog-body p {
  margin-bottom: 22px;
}

.reader-article .blog-body a {
  color: var(--pb-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.reader-article .blog-body blockquote {
  border-left: 3px solid var(--pb-accent);
  background: var(--pb-paper);
  padding: 20px 24px;
  margin: 24px 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
}

.reader-article .blog-body ul {
  margin: 0 0 22px 24px;
  list-style: none;
}
.reader-article .blog-body ul li {
  position: relative;
  padding-left: 16px;
  margin-bottom: 8px;
}
.reader-article .blog-body ul li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 11px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pb-accent);
}

.reader-article .blog-body ol {
  margin: 0 0 22px 24px;
  list-style: none;
  counter-reset: ol-counter;
}
.reader-article .blog-body ol li {
  position: relative;
  padding-left: 28px;
  margin-bottom: 8px;
  counter-increment: ol-counter;
}
.reader-article .blog-body ol li::before {
  content: counter(ol-counter, decimal-leading-zero);
  position: absolute;
  left: 0;
  top: 2px;
  font-family: var(--font-jetbrains), monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--pb-accent);
}

.reader-article .blog-body figure {
  margin: 32px 0;
  text-align: center;
}
.reader-article .blog-body figcaption {
  font-family: var(--font-jetbrains), monospace;
  font-size: 12px;
  color: var(--pb-faint);
  margin-top: 10px;
  font-style: italic;
}

/* Callout box */
.reader-article .blog-body .callout {
  border: 1px solid rgba(255, 130, 64, 0.3);
  background: rgba(255, 130, 64, 0.06);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 24px 0;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-family: var(--font-source-serif), Georgia, serif;
  font-size: 17px;
  font-style: italic;
  line-height: 1.6;
}

/* Text highlight */
mark.btf-hl {
  background: linear-gradient(180deg, transparent 60%, rgba(255, 227, 122, 0.25) 60%);
  color: inherit;
  padding: 0 2px;
}

/* ═══ Progress Bar ═══ */

.blog-progress-bar {
  position: sticky;
  top: 56px;
  z-index: 99;
  height: 3px;
  display: flex;
  gap: 1px;
}
.blog-progress-segment {
  flex: 1;
  background: var(--pb-line);
  overflow: hidden;
}
.blog-progress-fill {
  height: 100%;
  background: var(--pb-accent);
  transition: width 0.3s;
}

/* ═══ Time Left Pill ═══ */

.blog-time-pill {
  position: fixed;
  top: 72px;
  right: 40px;
  background: var(--pb-paper);
  border: 1px solid var(--pb-line);
  border-radius: 20px;
  padding: 5px 14px;
  font-family: var(--font-jetbrains), monospace;
  font-size: 12px;
  color: var(--pb-muted);
  z-index: 90;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: opacity 0.3s;
}

/* ═══ Sidebar Shared ═══ */

.blog-sidebar {
  position: sticky;
  top: 80px;
  padding-top: 16px;
}

.blog-sidebar-label {
  font-family: var(--font-jetbrains), monospace;
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--pb-muted);
  margin-bottom: 12px;
}

/* ═══ Newsletter CTA ═══ */

.blog-nl-cta {
  background: var(--pb-paper);
  border-radius: 12px;
  padding: 36px 32px;
  margin: 32px 0;
  position: relative;
  overflow: visible;
}
.blog-nl-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--pb-accent);
  border-radius: 12px 12px 0 0;
}

/* ═══ AI Reader ═══ */

.ai-reader-pill {
  position: fixed;
  bottom: 28px;
  right: 28px;
  background: var(--pb-paper);
  border: 1px solid var(--pb-line);
  border-radius: 24px;
  padding: 10px 18px 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 90;
  transition: all 0.2s;
}
.ai-reader-pill:hover {
  border-color: var(--pb-accent);
  box-shadow: 0 4px 20px rgba(255, 130, 64, 0.2);
}

.ai-reader-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  background: var(--pb-paper);
  border-left: 1px solid var(--pb-line);
  z-index: 95;
  transform: translateX(100%);
  transition: transform 0.3s ease;
  overflow-y: auto;
}
.ai-reader-drawer.open {
  transform: translateX(0);
}
```

- [ ] **Step 2: Verify CSS loads without errors**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/reader-pinboard.css apps/web/src/app/globals.css
git commit -m "feat(blog): add blog detail CSS — 3-col grid, article typography, progress bar, sidebars"
```

---

## Task 5: Simple Server Components — KeyPoints, PullQuote, Colophon, Tags

**Files:**
- Create: `apps/web/src/components/blog/post-key-points.tsx`
- Create: `apps/web/src/components/blog/post-pull-quote.tsx`
- Create: `apps/web/src/components/blog/post-colophon.tsx`
- Create: `apps/web/src/components/blog/post-tags.tsx`
- Create: `apps/web/test/components/blog/server-components.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/web/test/components/blog/server-components.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PostKeyPoints } from '../../../src/components/blog/post-key-points'
import { PostPullQuote } from '../../../src/components/blog/post-pull-quote'
import { PostColophon } from '../../../src/components/blog/post-colophon'
import { PostTags } from '../../../src/components/blog/post-tags'

describe('PostKeyPoints', () => {
  it('renders numbered key points', () => {
    const { container } = render(<PostKeyPoints points={['Point A', 'Point B']} />)
    expect(container.textContent).toContain('01')
    expect(container.textContent).toContain('Point A')
    expect(container.textContent).toContain('02')
    expect(container.textContent).toContain('Point B')
  })

  it('returns null when points is undefined', () => {
    const { container } = render(<PostKeyPoints points={undefined} />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null when points is empty', () => {
    const { container } = render(<PostKeyPoints points={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostPullQuote', () => {
  it('renders quote and attribution', () => {
    const { container } = render(
      <PostPullQuote quote="a notebook" attribution="PROMISE 3" />,
    )
    expect(container.textContent).toContain('a notebook')
    expect(container.textContent).toContain('PROMISE 3')
  })

  it('returns null when quote is undefined', () => {
    const { container } = render(<PostPullQuote quote={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostColophon', () => {
  it('renders colophon text', () => {
    const { container } = render(<PostColophon text="Written in iA Writer" />)
    expect(container.textContent).toContain('Written in iA Writer')
    expect(container.textContent).toContain('COLOFAO')
  })

  it('returns null when text is undefined', () => {
    const { container } = render(<PostColophon text={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostTags', () => {
  it('renders tag pills', () => {
    const { getByText } = render(
      <PostTags tags={['meta', 'manifesto']} locale="pt-BR" />,
    )
    expect(getByText('#meta')).toBeTruthy()
    expect(getByText('#manifesto')).toBeTruthy()
  })

  it('returns null when tags is undefined', () => {
    const { container } = render(<PostTags tags={undefined} locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement PostKeyPoints**

```tsx
// apps/web/src/components/blog/post-key-points.tsx
type Props = { points: string[] | undefined }

export function PostKeyPoints({ points }: Props) {
  if (!points || points.length === 0) return null
  return (
    <div>
      <div className="blog-sidebar-label">Pontos-chave</div>
      {points.map((point, i) => (
        <div key={i} className="flex gap-2.5 items-start mb-3">
          <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-[13px] text-pb-ink leading-snug">{point}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement PostPullQuote**

```tsx
// apps/web/src/components/blog/post-pull-quote.tsx
type Props = { quote: string | undefined; attribution?: string }

export function PostPullQuote({ quote, attribution }: Props) {
  if (!quote) return null
  return (
    <div className="border-l-[3px] border-pb-accent pl-3.5 my-6">
      <p className="font-caveat text-lg text-pb-accent italic leading-snug mb-1.5">
        &ldquo;{quote}&rdquo;
      </p>
      {attribution && (
        <span className="font-jetbrains text-[10px] text-pb-muted tracking-widest uppercase">
          — {attribution}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Implement PostColophon**

```tsx
// apps/web/src/components/blog/post-colophon.tsx
type Props = { text: string | undefined }

export function PostColophon({ text }: Props) {
  if (!text) return null
  return (
    <div className="my-6 py-6 border-t border-dashed border-[--pb-line] border-b flex gap-6 items-start">
      <div className="blog-sidebar-label min-w-[60px] pt-0.5">COLOFAO</div>
      <p className="text-sm text-pb-muted italic leading-relaxed">{text}</p>
    </div>
  )
}
```

- [ ] **Step 6: Implement PostTags**

```tsx
// apps/web/src/components/blog/post-tags.tsx
import Link from 'next/link'

type Props = { tags: string[] | undefined; locale: string }

export function PostTags({ tags, locale }: Props) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="my-6">
      <div className="blog-sidebar-label">Marcadores</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Link
            key={tag}
            href={`/blog/${locale}?tag=${encodeURIComponent(tag)}`}
            className="inline-block border border-[--pb-line] rounded-full px-3.5 py-1 font-jetbrains text-xs text-pb-muted hover:border-pb-faint transition-colors"
          >
            #{tag}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: All 9 tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/blog/post-key-points.tsx apps/web/src/components/blog/post-pull-quote.tsx apps/web/src/components/blog/post-colophon.tsx apps/web/src/components/blog/post-tags.tsx apps/web/test/components/blog/server-components.test.tsx
git commit -m "feat(blog): add PostKeyPoints, PostPullQuote, PostColophon, PostTags server components"
```

---

## Task 6: AuthorRow + AuthorCard

**Files:**
- Create: `apps/web/src/components/blog/author-row.tsx`
- Create: `apps/web/src/components/blog/author-card.tsx`
- Modify: `apps/web/test/components/blog/server-components.test.tsx`

- [ ] **Step 1: Add tests to server-components.test.tsx**

```tsx
// Append to apps/web/test/components/blog/server-components.test.tsx
import { AuthorRow } from '../../../src/components/blog/author-row'
import { AuthorCard } from '../../../src/components/blog/author-card'
import { AUTHOR_THIAGO, MOCK_ENGAGEMENT } from '../../../src/components/blog/mock-data'

describe('AuthorRow', () => {
  it('renders author name and role', () => {
    const { container } = render(
      <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('Dev indie')
  })

  it('renders engagement stats', () => {
    const { container } = render(
      <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale="pt-BR" url="https://example.com/post" />,
    )
    expect(container.textContent).toContain('2.460')
    expect(container.textContent).toContain('319')
  })
})

describe('AuthorCard', () => {
  it('renders full author card with bio', () => {
    const { container } = render(
      <AuthorCard author={AUTHOR_THIAGO} locale="pt-BR" />,
    )
    expect(container.textContent).toContain('SOBRE QUEM ESCREVEU')
    expect(container.textContent).toContain('Construo software')
    expect(container.textContent).toContain('YouTube')
    expect(container.textContent).toContain('GitHub')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: FAIL — AuthorRow, AuthorCard not found.

- [ ] **Step 3: Implement AuthorRow**

```tsx
// apps/web/src/components/blog/author-row.tsx
import type { AuthorData, EngagementStats } from './types'
import { ShareButtons } from './share-buttons'

type Props = {
  author: AuthorData
  engagement: EngagementStats
  locale: string
  url: string
}

export function AuthorRow({ author, engagement, locale, url }: Props) {
  const formattedViews = engagement.views.toLocaleString(locale === 'pt-BR' ? 'pt-BR' : 'en')

  return (
    <div className="flex items-center gap-4 mb-8 flex-wrap">
      <div
        className="w-10 h-10 rounded-full bg-pb-accent flex items-center justify-center font-bold text-sm shrink-0"
        style={{ color: 'var(--pb-bg)' }}
      >
        {author.initials}
      </div>
      <div>
        <div className="text-sm text-pb-ink">
          por <span className="underline underline-offset-2">{author.name}</span>
        </div>
        <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
      </div>
      <div className="flex items-center gap-4 ml-auto text-[13px] text-pb-muted">
        <span>👁 {formattedViews} leituras</span>
        <span>♡ {engagement.likes}</span>
        <span>🔖 SALVAR</span>
      </div>
      <ShareButtons url={url} compact />
    </div>
  )
}
```

- [ ] **Step 4: Implement AuthorCard**

```tsx
// apps/web/src/components/blog/author-card.tsx
import type { AuthorData } from './types'

type Props = {
  author: AuthorData
  locale: string
}

export function AuthorCard({ author, locale }: Props) {
  return (
    <div className="bg-[--pb-paper] rounded-xl p-7 my-12">
      <div className="blog-sidebar-label mb-4">SOBRE QUEM ESCREVEU</div>
      <div className="flex gap-4 items-start">
        <div
          className="w-16 h-16 rounded-full bg-pb-accent flex items-center justify-center font-bold text-[22px] shrink-0"
          style={{ color: 'var(--pb-bg)' }}
        >
          {author.initials}
        </div>
        <div>
          <div className="font-fraunces text-[22px] font-bold mb-0.5">{author.name}</div>
          <div className="font-jetbrains text-xs text-pb-muted">{author.role}</div>
        </div>
      </div>
      <p className="text-[15px] text-pb-ink leading-relaxed my-3">{author.bio}</p>
      <div className="flex gap-4 text-[13px]">
        {author.links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pb-muted hover:text-pb-accent transition-colors"
          >
            {link.label} ↗
          </a>
        ))}
      </div>
      <a
        href={`/blog/${locale}`}
        className="font-caveat text-base text-pb-accent float-right mt-2"
      >
        <em>mais textos de {author.name.split(' ')[0]}</em> →
      </a>
    </div>
  )
}
```

- [ ] **Step 5: Create stub ShareButtons for now (full implementation in Task 8)**

```tsx
// apps/web/src/components/blog/share-buttons.tsx
'use client'

type Props = {
  url: string
  compact?: boolean
}

export function ShareButtons({ url, compact }: Props) {
  return (
    <div className={`flex gap-2 ${compact ? 'ml-3' : ''}`}>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors"
      >
        in
      </a>
      <button
        onClick={() => navigator.clipboard.writeText(url)}
        className="w-8 h-8 rounded-lg bg-[--pb-paper] border border-[--pb-line] flex items-center justify-center text-xs text-pb-muted hover:border-pb-faint transition-colors cursor-pointer"
      >
        🔗
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/blog/author-row.tsx apps/web/src/components/blog/author-card.tsx apps/web/src/components/blog/share-buttons.tsx apps/web/test/components/blog/server-components.test.tsx
git commit -m "feat(blog): add AuthorRow, AuthorCard, ShareButtons components"
```

---

## Task 7: SeriesBanner + SeriesNav

**Files:**
- Create: `apps/web/src/components/blog/series-banner.tsx`
- Create: `apps/web/src/components/blog/series-nav.tsx`
- Modify: `apps/web/test/components/blog/server-components.test.tsx`

- [ ] **Step 1: Add tests**

```tsx
// Append to server-components.test.tsx
import { SeriesBanner } from '../../../src/components/blog/series-banner'
import { SeriesNav } from '../../../src/components/blog/series-nav'

describe('SeriesBanner', () => {
  it('renders series title and part info', () => {
    const { container } = render(
      <SeriesBanner title="Building in public" part={1} total={3} />,
    )
    expect(container.textContent).toContain('PARTE DA SERIE')
    expect(container.textContent).toContain('1 DE 3')
    expect(container.textContent).toContain('Building in public')
  })

  it('returns null when title is undefined', () => {
    const { container } = render(<SeriesBanner title={undefined} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('SeriesNav', () => {
  it('renders next post in series', () => {
    const { container } = render(
      <SeriesNav
        nextSlug="cms-for-all"
        nextTitle="A CMS to rule them all"
        nextExcerpt="The architecture behind cross-site publishing..."
        locale="pt-BR"
      />,
    )
    expect(container.textContent).toContain('CONTINUA NA PROXIMA PARTE')
    expect(container.textContent).toContain('A CMS to rule them all')
  })

  it('returns null when nextSlug is undefined', () => {
    const { container } = render(<SeriesNav locale="pt-BR" />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement SeriesBanner**

```tsx
// apps/web/src/components/blog/series-banner.tsx
type Props = {
  title: string | undefined
  part?: number
  total?: number
}

export function SeriesBanner({ title, part, total }: Props) {
  if (!title) return null
  return (
    <div className="bg-[--pb-paper] rounded-lg px-5 py-3.5 mb-6">
      <div className="font-jetbrains text-[11px] tracking-[2px] uppercase text-pb-muted mb-1">
        PARTE DA SERIE {part && total ? `· ${part} DE ${total}` : ''}
      </div>
      <div className="text-[15px] text-pb-ink">{title}</div>
    </div>
  )
}
```

- [ ] **Step 4: Implement SeriesNav**

```tsx
// apps/web/src/components/blog/series-nav.tsx
import Link from 'next/link'

type Props = {
  nextSlug?: string
  nextTitle?: string
  nextExcerpt?: string
  locale: string
}

export function SeriesNav({ nextSlug, nextTitle, nextExcerpt, locale }: Props) {
  if (!nextSlug || !nextTitle) return null
  return (
    <div className="bg-[--pb-paper] rounded-xl px-7 py-6 my-6">
      <div className="font-jetbrains text-[10px] tracking-[2px] uppercase text-pb-accent mb-2.5">
        CONTINUA NA PROXIMA PARTE
      </div>
      <div className="font-fraunces text-[22px] font-bold mb-2">
        <Link href={`/blog/${locale}/${encodeURIComponent(nextSlug)}`} className="text-pb-ink no-underline">
          {nextTitle} →
        </Link>
      </div>
      {nextExcerpt && (
        <p className="text-sm text-pb-muted leading-relaxed">{nextExcerpt}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/blog/series-banner.tsx apps/web/src/components/blog/series-nav.tsx apps/web/test/components/blog/server-components.test.tsx
git commit -m "feat(blog): add SeriesBanner and SeriesNav components"
```

---

## Task 8: CoverImage + PostComments

**Files:**
- Create: `apps/web/src/components/blog/cover-image.tsx`
- Create: `apps/web/src/components/blog/post-comments.tsx`
- Modify: `apps/web/test/components/blog/server-components.test.tsx`

- [ ] **Step 1: Add tests**

```tsx
// Append to server-components.test.tsx
import { CoverImage } from '../../../src/components/blog/cover-image'
import { PostComments } from '../../../src/components/blog/post-comments'
import { MOCK_COMMENTS } from '../../../src/components/blog/mock-data'

describe('CoverImage', () => {
  it('renders image in paper+tape wrapper', () => {
    const { container } = render(
      <CoverImage src="https://example.com/img.jpg" alt="Test" />,
    )
    expect(container.querySelector('img')).toBeTruthy()
    expect(container.textContent).toContain('bythiagofigueiredo')
  })

  it('returns null when src is null', () => {
    const { container } = render(<CoverImage src={null} alt="Test" />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostComments', () => {
  it('renders comments with form', () => {
    const { container } = render(<PostComments comments={MOCK_COMMENTS} />)
    expect(container.textContent).toContain('Conversa')
    expect(container.textContent).toContain('Paula Reis')
    expect(container.textContent).toContain('RESPOSTA DO AUTOR')
    expect(container.querySelector('textarea')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement CoverImage**

```tsx
// apps/web/src/components/blog/cover-image.tsx
import Image from 'next/image'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  src: string | null
  alt: string
}

export function CoverImage({ src, alt }: Props) {
  if (!src) return null
  return (
    <div className="mb-10">
      <div
        className="bg-[--pb-paper] rounded p-2 relative"
        style={{ transform: 'rotate(-0.3deg)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
      >
        <Tape variant="tape" className="top-[-8px] left-[35%]" rotate={-2} />
        <Tape variant="tape2" className="top-[-8px] right-[10%]" rotate={3} />
        <Tape variant="tape" className="bottom-[-6px] right-[5%]" rotate={-1} />
        <Image
          src={src}
          alt={alt}
          width={760}
          height={380}
          className="w-full rounded-sm object-cover"
          style={{ filter: 'brightness(0.92)' }}
          priority
        />
      </div>
      <div className="text-right text-[11px] text-pb-faint italic mt-1.5">bythiagofigueiredo</div>
    </div>
  )
}
```

- [ ] **Step 3: Implement PostComments**

```tsx
// apps/web/src/components/blog/post-comments.tsx
import type { MockComment } from './types'

type Props = { comments: MockComment[] }

export function PostComments({ comments }: Props) {
  const topLevel = comments.filter((c) => !c.parentId)
  const replies = comments.filter((c) => c.parentId)

  return (
    <div className="my-8">
      <div className="h-px bg-[--pb-line] mb-5" />
      <h3 className="font-fraunces text-2xl font-bold">
        Conversa <span className="font-sans text-[15px] font-normal text-pb-muted">· {comments.length} comentarios</span>
      </h3>
      <div className="bg-[--pb-paper] rounded-xl p-5 my-4">
        <textarea
          className="w-full bg-transparent border-none text-pb-ink font-source-serif text-[15px] resize-y min-h-[60px] outline-none leading-relaxed"
          placeholder="Deixe um comentario honesto (sem self-promo)"
          style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
          readOnly
        />
        <div className="flex justify-between items-center mt-2.5 pt-2.5 border-t border-[--pb-line]">
          <span className="text-[13px] text-pb-muted">Voce precisa entrar com email pra comentar — protege do spam.</span>
          <button
            className="bg-pb-accent font-jetbrains text-[11px] font-semibold tracking-[1.5px] uppercase px-4 py-1.5 rounded-md cursor-pointer border-none"
            style={{ color: 'var(--pb-bg)' }}
          >
            PUBLICAR
          </button>
        </div>
      </div>
      {topLevel.map((comment) => (
        <div key={comment.id}>
          <CommentRow comment={comment} />
          {replies
            .filter((r) => r.parentId === comment.id)
            .map((reply) => (
              <CommentRow key={reply.id} comment={reply} nested />
            ))}
        </div>
      ))}
    </div>
  )
}

function CommentRow({ comment, nested }: { comment: MockComment; nested?: boolean }) {
  return (
    <div className={`flex gap-3 py-3.5 border-b border-[--pb-line] ${nested ? 'ml-[52px]' : ''}`}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
        style={{ backgroundColor: comment.avatarColor, color: comment.isAuthorReply ? 'var(--pb-bg)' : '#14110B' }}
      >
        {comment.authorInitials}
      </div>
      <div>
        <div>
          <span className="text-sm font-semibold">{comment.authorName}</span>
          {comment.isAuthorReply && (
            <span
              className="font-jetbrains text-[9px] tracking-[1px] uppercase ml-1.5 px-2 py-0.5 rounded align-middle"
              style={{ backgroundColor: 'var(--pb-accent)', color: 'var(--pb-bg)' }}
            >
              RESPOSTA DO AUTOR
            </span>
          )}
          <span className="text-xs text-pb-faint ml-2">{comment.timeAgo}</span>
        </div>
        <p className="text-sm my-1 leading-relaxed text-pb-ink">{comment.text}</p>
        <div className="flex gap-4 text-xs text-pb-muted">
          <span>♡ {comment.likes}</span>
          <span>↩ responder</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/blog/cover-image.tsx apps/web/src/components/blog/post-comments.tsx apps/web/test/components/blog/server-components.test.tsx
git commit -m "feat(blog): add CoverImage and PostComments (hardcoded) components"
```

---

## Task 9: RelatedPostsGrid

**Files:**
- Create: `apps/web/src/components/blog/related-posts-grid.tsx`
- Modify: `apps/web/test/components/blog/server-components.test.tsx`

- [ ] **Step 1: Add test**

```tsx
// Append to server-components.test.tsx
import { RelatedPostsGrid } from '../../../src/components/blog/related-posts-grid'

describe('RelatedPostsGrid', () => {
  it('renders 3 related post cards', () => {
    const posts = [
      { id: '1', slug: 'post-1', title: 'First Post', excerpt: 'Excerpt 1', category: 'Ensaios', coverImageUrl: null, readingTimeMin: 5, publishedAt: '2026-04-17' },
      { id: '2', slug: 'post-2', title: 'Second Post', excerpt: 'Excerpt 2', category: 'Ensaios', coverImageUrl: null, readingTimeMin: 8, publishedAt: '2026-03-01' },
      { id: '3', slug: 'post-3', title: 'Third Post', excerpt: null, category: 'Codigo', coverImageUrl: null, readingTimeMin: 4, publishedAt: '2026-02-01' },
    ]
    const { container } = render(
      <RelatedPostsGrid posts={posts} locale="pt-BR" category="Ensaios" />,
    )
    expect(container.textContent).toContain('Textos relacionados')
    expect(container.textContent).toContain('First Post')
    expect(container.textContent).toContain('Second Post')
    expect(container.textContent).toContain('Third Post')
  })

  it('returns null when posts is empty', () => {
    const { container } = render(<RelatedPostsGrid posts={[]} locale="pt-BR" category={null} />)
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: Implement RelatedPostsGrid**

```tsx
// apps/web/src/components/blog/related-posts-grid.tsx
import Link from 'next/link'
import type { RelatedPost } from '@/lib/blog/related-posts'
import { PaperCard } from '@/app/(public)/components/PaperCard'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  posts: RelatedPost[]
  locale: string
  category: string | null
}

export function RelatedPostsGrid({ posts, locale, category }: Props) {
  if (posts.length === 0) return null

  return (
    <section className="max-w-[1100px] mx-auto my-12 px-10">
      <div className="h-px bg-[--pb-line] mb-10" />
      <div className="flex justify-between items-baseline mb-6">
        <div>
          <h2 className="font-fraunces text-[28px] font-bold">Textos relacionados</h2>
          <p className="text-sm text-pb-muted mt-1">
            Mais na mesma categoria ·{' '}
            {category && (
              <Link href={`/blog/${locale}?category=${encodeURIComponent(category)}`} className="text-pb-accent no-underline">
                {category}
              </Link>
            )}
          </p>
        </div>
        {category && (
          <Link href={`/blog/${locale}?category=${encodeURIComponent(category)}`} className="font-caveat text-base text-pb-accent no-underline">
            <em>Ver categoria</em> →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post, i) => (
          <Link key={post.id} href={`/blog/${locale}/${encodeURIComponent(post.slug)}`} className="no-underline">
            <PaperCard index={i}>
              <div className="relative h-[200px] overflow-hidden rounded-t-sm" style={{ background: `linear-gradient(135deg, hsl(${(i * 40 + 120) % 360}, 25%, 22%), hsl(${(i * 40 + 140) % 360}, 20%, 15%))` }}>
                <Tape variant={i % 2 === 0 ? 'tape' : 'tape2'} className="top-[-6px] left-5" rotate={-3} />
              </div>
              <div className="p-4">
                <div className="text-[11px] mb-2 flex gap-2 items-center">
                  <span className="font-jetbrains text-pb-accent uppercase tracking-wider">{post.category ?? 'Blog'}</span>
                  <span className="text-pb-muted">
                    {new Date(post.publishedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <h3 className="font-fraunces text-lg font-bold leading-tight mb-2 text-pb-ink">{post.title}</h3>
                <p className="text-xs text-pb-muted">{post.readingTimeMin} min · leitura</p>
              </div>
            </PaperCard>
          </Link>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/server-components.test.tsx`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/blog/related-posts-grid.tsx apps/web/test/components/blog/server-components.test.tsx
git commit -m "feat(blog): add RelatedPostsGrid with PaperCard + Tape styling"
```

---

## Task 10: ScrollContext + ReadingProgressBar + TimeLeftPill

**Files:**
- Create: `apps/web/src/components/blog/scroll-context.tsx`
- Create: `apps/web/src/components/blog/reading-progress.tsx`
- Create: `apps/web/src/components/blog/time-left-pill.tsx`
- Create: `apps/web/test/components/blog/reading-progress.test.tsx`

- [ ] **Step 1: Write tests**

```tsx
// apps/web/test/components/blog/reading-progress.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ReadingProgressBar } from '../../../src/components/blog/reading-progress'
import { TimeLeftPill } from '../../../src/components/blog/time-left-pill'

describe('ReadingProgressBar', () => {
  it('renders segments for each section', () => {
    const sections = [
      { id: 'intro', text: 'Intro', depth: 2 as const },
      { id: 'body', text: 'Body', depth: 2 as const },
    ]
    const { container } = render(<ReadingProgressBar sections={sections} />)
    const segments = container.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(2)
  })
})

describe('TimeLeftPill', () => {
  it('renders with reading time and current section', () => {
    const { container } = render(
      <TimeLeftPill totalMinutes={9} currentSection="O que e, entao" />,
    )
    expect(container.textContent).toContain('min')
    expect(container.textContent).toContain('restantes')
  })
})
```

- [ ] **Step 2: Implement ScrollContext**

```tsx
// apps/web/src/components/blog/scroll-context.tsx
'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { TocEntry } from './types'

type ScrollState = {
  activeSection: string | null
  progress: number
  sectionProgress: Map<string, number>
  visible: boolean
}

const ScrollContext = createContext<ScrollState>({
  activeSection: null,
  progress: 0,
  sectionProgress: new Map(),
  visible: false,
})

export function useScrollState() {
  return useContext(ScrollContext)
}

type Props = {
  sections: TocEntry[]
  children: ReactNode
}

export function ScrollProvider({ sections, children }: Props) {
  const [state, setState] = useState<ScrollState>({
    activeSection: null,
    progress: 0,
    sectionProgress: new Map(),
    visible: false,
  })

  useEffect(() => {
    const h2Sections = sections.filter((s) => s.depth === 2)
    const elements = h2Sections
      .map((s) => document.getElementById(s.slug))
      .filter(Boolean) as HTMLElement[]

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((e) => e.isIntersecting)
        if (visibleEntry) {
          setState((prev) => ({ ...prev, activeSection: visibleEntry.target.id }))
        }
      },
      { rootMargin: '-80px 0px -60% 0px' },
    )

    elements.forEach((el) => observer.observe(el))

    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const globalProgress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0

      const sectionProgress = new Map<string, number>()
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i]
        const next = elements[i + 1]
        const sectionTop = el.offsetTop - 100
        const sectionBottom = next ? next.offsetTop - 100 : document.documentElement.scrollHeight
        const sectionHeight = sectionBottom - sectionTop

        if (scrollTop >= sectionBottom) {
          sectionProgress.set(el.id, 1)
        } else if (scrollTop > sectionTop) {
          sectionProgress.set(el.id, (scrollTop - sectionTop) / sectionHeight)
        } else {
          sectionProgress.set(el.id, 0)
        }
      }

      const visible = globalProgress > 0.08 && globalProgress < 0.96

      setState((prev) => ({
        ...prev,
        progress: globalProgress,
        sectionProgress,
        visible,
      }))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
    }
  }, [sections])

  return <ScrollContext.Provider value={state}>{children}</ScrollContext.Provider>
}
```

- [ ] **Step 3: Implement ReadingProgressBar**

```tsx
// apps/web/src/components/blog/reading-progress.tsx
'use client'

import type { TocEntry } from './types'
import { useScrollState } from './scroll-context'

type Props = { sections: TocEntry[] }

export function ReadingProgressBar({ sections }: Props) {
  const { sectionProgress } = useScrollState()
  const h2s = sections.filter((s) => s.depth === 2)

  return (
    <div className="blog-progress-bar">
      {h2s.map((section) => (
        <div key={section.slug} className="blog-progress-segment" data-segment={section.slug}>
          <div
            className="blog-progress-fill"
            style={{ width: `${(sectionProgress.get(section.slug) ?? 0) * 100}%` }}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement TimeLeftPill**

```tsx
// apps/web/src/components/blog/time-left-pill.tsx
'use client'

import { useState, useEffect } from 'react'
import { useScrollState } from './scroll-context'

type Props = {
  totalMinutes: number
  currentSection?: string
}

export function TimeLeftPill({ totalMinutes, currentSection }: Props) {
  const { progress, visible, activeSection } = useScrollState()
  const [show, setShow] = useState(false)

  const minutesLeft = Math.max(1, Math.round(totalMinutes * (1 - progress)))
  const sectionLabel = activeSection
    ? document.getElementById(activeSection)?.textContent?.trim()
    : currentSection

  useEffect(() => {
    if (!visible) { setShow(false); return }
    setShow(true)
    const timer = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(timer)
  }, [visible, progress])

  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>
    const handleScroll = () => {
      if (visible) setShow(true)
      clearTimeout(scrollTimer)
      scrollTimer = setTimeout(() => setShow(false), 3000)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimer)
    }
  }, [visible])

  return (
    <div className="blog-time-pill" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}>
      <span>{minutesLeft} min</span> restantes
      {sectionLabel && <> · <span className="text-pb-ink font-sans">{sectionLabel}</span></>}
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/reading-progress.test.tsx`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/blog/scroll-context.tsx apps/web/src/components/blog/reading-progress.tsx apps/web/src/components/blog/time-left-pill.tsx apps/web/test/components/blog/reading-progress.test.tsx
git commit -m "feat(blog): add ScrollProvider, ReadingProgressBar, TimeLeftPill"
```

---

## Task 11: PostToc (Left Sidebar)

**Files:**
- Create: `apps/web/src/components/blog/post-toc.tsx`
- Create: `apps/web/test/components/blog/post-toc.test.tsx`

- [ ] **Step 1: Write test**

```tsx
// apps/web/test/components/blog/post-toc.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PostToc } from '../../../src/components/blog/post-toc'

describe('PostToc', () => {
  it('renders TOC items with correct hierarchy', () => {
    const sections = [
      { slug: 'intro', text: 'Introduction', depth: 2 as const },
      { slug: 'sub', text: 'Sub section', depth: 3 as const },
      { slug: 'conclusion', text: 'Conclusion', depth: 2 as const },
    ]
    const { container } = render(<PostToc sections={sections} url="https://example.com" />)
    expect(container.textContent).toContain('Introduction')
    expect(container.textContent).toContain('Sub section')
    expect(container.textContent).toContain('Conclusion')
    expect(container.textContent).toContain('NESTE TEXTO')
  })
})
```

- [ ] **Step 2: Implement PostToc**

```tsx
// apps/web/src/components/blog/post-toc.tsx
'use client'

import { useScrollState } from './scroll-context'
import { ShareButtons } from './share-buttons'
import type { TocEntry } from './types'

type Props = {
  sections: TocEntry[]
  url: string
}

export function PostToc({ sections, url }: Props) {
  const { activeSection } = useScrollState()

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <aside className="blog-sidebar blog-detail-sidebar">
      <div className="blog-sidebar-label">NESTE TEXTO</div>
      <ul className="list-none">
        {sections.map((entry) => {
          const isActive = activeSection === entry.slug
          return (
            <li
              key={entry.slug}
              className={`text-[13px] py-1 cursor-pointer border-l-2 transition-all leading-snug ${
                entry.depth === 3 ? 'pl-6 text-xs' : 'pl-3'
              } ${isActive ? 'text-pb-ink border-pb-accent font-medium' : 'text-pb-muted border-transparent'}`}
              style={{ marginLeft: '-2px' }}
              onClick={() => {
                const el = document.getElementById(entry.slug)
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              {entry.text}
            </li>
          )
        })}
      </ul>
      <hr className="border-none border-t border-dashed border-[--pb-line] my-4" />
      <div className="blog-sidebar-label">COMPARTILHAR</div>
      <ShareButtons url={url} />
      <button
        onClick={scrollToTop}
        className="font-jetbrains text-[11px] text-pb-accent cursor-pointer mt-3 flex items-center gap-1 bg-transparent border-none p-0"
      >
        TOPO ↑
      </button>
    </aside>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/post-toc.test.tsx`
Expected: Pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/blog/post-toc.tsx apps/web/test/components/blog/post-toc.test.tsx
git commit -m "feat(blog): add PostToc with active section tracking and share buttons"
```

---

## Task 12: TextHighlighter + HighlightsSidebar

**Files:**
- Create: `apps/web/src/components/blog/text-highlighter.tsx`
- Create: `apps/web/src/components/blog/highlights-sidebar.tsx`
- Create: `apps/web/test/components/blog/text-highlighter.test.tsx`

- [ ] **Step 1: Write test**

```tsx
// apps/web/test/components/blog/text-highlighter.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { HighlightsSidebar } from '../../../src/components/blog/highlights-sidebar'

describe('HighlightsSidebar', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows empty state when no highlights', () => {
    const { container } = render(<HighlightsSidebar slug="test-post" />)
    expect(container.textContent).toContain('Selecione texto no artigo')
  })

  it('renders saved highlights from localStorage', () => {
    const highlights = [
      { id: 'h1', text: 'Test highlight', startOffset: 0, endOffset: 14, createdAt: new Date().toISOString() },
    ]
    localStorage.setItem('btf-highlights:pt-BR/test-post', JSON.stringify(highlights))
    const { container } = render(<HighlightsSidebar slug="test-post" locale="pt-BR" />)
    expect(container.textContent).toContain('Test highlight')
  })
})
```

- [ ] **Step 2: Implement HighlightsSidebar**

```tsx
// apps/web/src/components/blog/highlights-sidebar.tsx
'use client'

import { useState, useEffect } from 'react'

type Highlight = {
  id: string
  text: string
  startOffset: number
  endOffset: number
  createdAt: string
}

type Props = {
  slug: string
  locale?: string
}

function getStorageKey(slug: string, locale?: string) {
  return `btf-highlights:${locale ? `${locale}/` : ''}${slug}`
}

export function HighlightsSidebar({ slug, locale }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(slug, locale))
      if (stored) setHighlights(JSON.parse(stored))
    } catch { /* ignore corrupt data */ }
  }, [slug, locale])

  useEffect(() => {
    const handleStorage = () => {
      try {
        const stored = localStorage.getItem(getStorageKey(slug, locale))
        setHighlights(stored ? JSON.parse(stored) : [])
      } catch { /* ignore */ }
    }
    window.addEventListener('highlights-updated', handleStorage)
    return () => window.removeEventListener('highlights-updated', handleStorage)
  }, [slug, locale])

  const removeHighlight = (id: string) => {
    const updated = highlights.filter((h) => h.id !== id)
    localStorage.setItem(getStorageKey(slug, locale), JSON.stringify(updated))
    setHighlights(updated)
    window.dispatchEvent(new CustomEvent('highlights-updated'))
  }

  return (
    <div className="mt-6">
      <div className="blog-sidebar-label">SEUS DESTAQUES</div>
      {highlights.length === 0 ? (
        <p className="text-xs text-pb-faint italic">Selecione texto no artigo para destacar.</p>
      ) : (
        highlights.map((h) => (
          <div
            key={h.id}
            className="font-source-serif text-[13px] italic text-pb-ink p-2 bg-[rgba(255,227,122,0.06)] border-l-2 border-[--pb-marker] rounded-r mb-1.5 leading-snug relative"
            style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}
          >
            &ldquo;{h.text}&rdquo;
            <button
              onClick={() => removeHighlight(h.id)}
              className="absolute top-1 right-1.5 text-[10px] text-pb-faint cursor-pointer bg-transparent border-none p-0"
            >
              ×
            </button>
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement TextHighlighter**

```tsx
// apps/web/src/components/blog/text-highlighter.tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type Props = {
  slug: string
  locale?: string
  children: ReactNode
}

type Highlight = {
  id: string
  text: string
  startOffset: number
  endOffset: number
  createdAt: string
}

const MAX_HIGHLIGHTS = 20

function getStorageKey(slug: string, locale?: string) {
  return `btf-highlights:${locale ? `${locale}/` : ''}${slug}`
}

export function TextHighlighter({ slug, locale, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)

  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !containerRef.current) {
        setTooltip(null)
        return
      }
      const text = sel.toString().trim()
      if (!text || text.length < 3 || !containerRef.current.contains(sel.anchorNode)) {
        setTooltip(null)
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setTooltip({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        text,
      })
    }

    document.addEventListener('selectionchange', handleSelection)
    return () => document.removeEventListener('selectionchange', handleSelection)
  }, [])

  const handleHighlight = () => {
    if (!tooltip) return
    const key = getStorageKey(slug, locale)
    let highlights: Highlight[] = []
    try { highlights = JSON.parse(localStorage.getItem(key) ?? '[]') } catch { /* ignore */ }
    if (highlights.length >= MAX_HIGHLIGHTS) return

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      text: tooltip.text,
      startOffset: 0,
      endOffset: tooltip.text.length,
      createdAt: new Date().toISOString(),
    }
    highlights.push(newHighlight)
    localStorage.setItem(key, JSON.stringify(highlights))
    window.dispatchEvent(new CustomEvent('highlights-updated'))
    setTooltip(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleCopy = () => {
    if (!tooltip) return
    navigator.clipboard.writeText(tooltip.text)
    setTooltip(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div ref={containerRef} className="relative">
      {children}
      {tooltip && (
        <div
          className="fixed z-[100] flex gap-1 bg-[--pb-paper2] border border-[--pb-line] rounded-lg shadow-lg px-2 py-1.5"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <button
            onClick={handleHighlight}
            className="text-xs font-jetbrains text-pb-accent bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-[rgba(255,130,64,0.1)] rounded"
          >
            Destacar
          </button>
          <button
            onClick={handleCopy}
            className="text-xs font-jetbrains text-pb-muted bg-transparent border-none cursor-pointer px-2 py-0.5 hover:bg-[rgba(255,255,255,0.05)] rounded"
          >
            Copiar
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/text-highlighter.test.tsx`
Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/blog/text-highlighter.tsx apps/web/src/components/blog/highlights-sidebar.tsx apps/web/test/components/blog/text-highlighter.test.tsx
git commit -m "feat(blog): add TextHighlighter with selection tooltip and HighlightsSidebar"
```

---

## Task 13: PostFootnotes

**Files:**
- Create: `apps/web/src/components/blog/post-footnotes.tsx`

- [ ] **Step 1: Implement PostFootnotes**

```tsx
// apps/web/src/components/blog/post-footnotes.tsx
type FootnoteData = {
  id: string
  content: string
}

type Props = {
  footnotes: FootnoteData[]
}

export function PostFootnotes({ footnotes }: Props) {
  if (footnotes.length === 0) return null
  return (
    <div className="my-8">
      <div className="blog-sidebar-label">NOTAS</div>
      {footnotes.map((fn) => (
        <div key={fn.id} className="flex gap-2.5 mb-3.5 text-sm text-pb-ink leading-relaxed">
          <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5 shrink-0 pt-0.5">
            {fn.id}.
          </span>
          <span>
            {fn.content}{' '}
            <a href={`#fnref-${fn.id}`} className="text-pb-accent no-underline text-[13px]">
              ↩
            </a>
          </span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/post-footnotes.tsx
git commit -m "feat(blog): add PostFootnotes component"
```

---

## Task 14: NewsletterCta

**Files:**
- Create: `apps/web/src/components/blog/newsletter-cta.tsx`
- Create: `apps/web/test/components/blog/newsletter-cta.test.tsx`

- [ ] **Step 1: Write test**

```tsx
// apps/web/test/components/blog/newsletter-cta.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NewsletterCta } from '../../../src/components/blog/newsletter-cta'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('NewsletterCta', () => {
  it('renders newsletter form with category label', () => {
    const { container } = render(<NewsletterCta category="Ensaios" locale="pt-BR" />)
    expect(container.textContent).toContain('Gostou?')
    expect(container.textContent).toContain('NEWSLETTER')
    expect(container.querySelector('input[type="email"]')).toBeTruthy()
  })

  it('renders tape decorations', () => {
    const { container } = render(<NewsletterCta category="Ensaios" locale="pt-BR" />)
    const tapes = container.querySelectorAll('[aria-hidden="true"]')
    expect(tapes.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Implement NewsletterCta**

```tsx
// apps/web/src/components/blog/newsletter-cta.tsx
'use client'

import { useActionState } from 'react'
import { subscribeNewsletterInline, type InlineState } from '@/app/(public)/actions/newsletter-inline'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  category: string | null
  locale: string
  newsletterId?: string
}

const INITIAL: InlineState = {}

const CATEGORY_LABEL: Record<string, string> = {
  Ensaios: 'Caderno de Campo',
  Codigo: 'Code Drops',
  Bastidores: 'Behind the Screens',
}

export function NewsletterCta({ category, locale, newsletterId }: Props) {
  const [state, dispatch, pending] = useActionState(subscribeNewsletterInline, INITIAL)
  const ctaLabel = category ? CATEGORY_LABEL[category] ?? 'Caderno de Campo' : 'Caderno de Campo'

  return (
    <div className="blog-nl-cta">
      <Tape variant="tape" className="top-[-10px] left-[calc(50%-40px)]" rotate={-1.5} />
      <Tape variant="tape2" className="bottom-[-8px] right-10" rotate={2} />
      <div className="blog-nl-accent" />

      <div className="blog-sidebar-label mb-3.5">NEWSLETTER</div>
      <h3 className="font-fraunces text-[28px] font-bold leading-tight mb-5 max-w-[500px]">
        Gostou? Recebe os proximos na caixa de entrada.
      </h3>

      {state.success ? (
        <p className="text-pb-accent font-jetbrains text-sm py-4">Inscrição recebida! Verifique seu email para confirmar.</p>
      ) : (
        <form action={dispatch}>
          {newsletterId && <input type="hidden" name="newsletter_id" value={newsletterId} />}
          <input type="hidden" name="locale" value={locale} />
          <div className="flex gap-2.5 mb-3">
            <input
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="flex-1 bg-[--pb-bg] border border-[--pb-line] text-pb-ink px-4 py-3.5 rounded-lg text-[15px] outline-none font-sans focus:border-pb-accent"
            />
            <button
              type="submit"
              disabled={pending}
              className="bg-pb-accent border-none px-5 py-3.5 rounded-lg font-jetbrains text-xs font-semibold tracking-wider uppercase cursor-pointer whitespace-nowrap transition-colors hover:opacity-90 disabled:opacity-50"
              style={{ color: '#14110B' }}
            >
              {pending ? '…' : `Assinar ${ctaLabel}`}
            </button>
          </div>
          {state.error && <p className="text-pb-yt font-jetbrains text-xs mb-2">{state.error}</p>}
        </form>
      )}
      <div className="text-xs text-pb-faint">1.427 leitores · 62% open rate · cancelar e um clique</div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/newsletter-cta.test.tsx`
Expected: Pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/blog/newsletter-cta.tsx apps/web/test/components/blog/newsletter-cta.test.tsx
git commit -m "feat(blog): add NewsletterCta with tape decorations and category mapping"
```

---

## Task 15: AiReaderButton + AiReaderDrawer

**Files:**
- Create: `apps/web/src/components/blog/ai-reader-button.tsx`
- Create: `apps/web/src/components/blog/ai-reader-drawer.tsx`
- Create: `apps/web/test/components/blog/ai-reader.test.tsx`

- [ ] **Step 1: Write test**

```tsx
// apps/web/test/components/blog/ai-reader.test.tsx
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AiReaderButton } from '../../../src/components/blog/ai-reader-button'
import { AiReaderDrawer } from '../../../src/components/blog/ai-reader-drawer'

describe('AiReaderButton', () => {
  it('renders pill with AI Reader label', () => {
    const { container } = render(<AiReaderButton onClick={() => {}} />)
    expect(container.textContent).toContain('AI Reader')
  })
})

describe('AiReaderDrawer', () => {
  it('renders tabs when open', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('TL;DR')
    expect(container.textContent).toContain('Explain')
    expect(container.textContent).toContain('Chat')
  })

  it('shows placeholder content in TL;DR tab', () => {
    const { container } = render(<AiReaderDrawer open onClose={() => {}} />)
    expect(container.textContent).toContain('resumo')
  })
})
```

- [ ] **Step 2: Implement AiReaderButton**

```tsx
// apps/web/src/components/blog/ai-reader-button.tsx
'use client'

type Props = { onClick: () => void }

export function AiReaderButton({ onClick }: Props) {
  return (
    <button onClick={onClick} className="ai-reader-pill" aria-label="Open AI Reader">
      <span className="text-lg">✨</span>
      <span className="font-jetbrains text-[11px] tracking-wide text-pb-muted">AI Reader</span>
    </button>
  )
}
```

- [ ] **Step 3: Implement AiReaderDrawer**

```tsx
// apps/web/src/components/blog/ai-reader-drawer.tsx
'use client'

import { useState } from 'react'

type Tab = 'tldr' | 'explain' | 'chat'

type Props = {
  open: boolean
  onClose: () => void
}

export function AiReaderDrawer({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('tldr')

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[94]" onClick={onClose} />
      )}
      <div className={`ai-reader-drawer ${open ? 'open' : ''}`}>
        <div className="p-4 border-b border-[--pb-line] flex items-center justify-between">
          <div className="flex gap-0">
            {(['tldr', 'explain', 'chat'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 font-jetbrains text-xs uppercase tracking-wider border-none cursor-pointer transition-colors rounded ${
                  activeTab === tab
                    ? 'bg-[rgba(255,130,64,0.15)] text-pb-accent'
                    : 'bg-transparent text-pb-muted hover:text-pb-ink'
                }`}
              >
                {tab === 'tldr' ? 'TL;DR' : tab === 'explain' ? 'Explain' : 'Chat'}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-pb-muted hover:text-pb-ink text-lg bg-transparent border-none cursor-pointer"
          >
            ×
          </button>
        </div>
        <div className="p-5">
          {activeTab === 'tldr' && (
            <div className="text-sm text-pb-muted leading-relaxed">
              <p className="font-jetbrains text-[10px] tracking-[2px] uppercase text-pb-faint mb-3">RESUMO AUTOMATICO</p>
              <p style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
                Este texto e um manifesto sobre o proposito do site bythiagofigueiredo. O autor explica que nao e um portfolio, feed ou blog corporativo — e um caderno aberto. Faz tres promessas: escrever mesmo quando for ruim, nunca rodar anuncio, e nao transformar em startup. Apresenta o CMS proprio que permite publicar uma vez e distribuir para multiplos destinos.
              </p>
            </div>
          )}
          {activeTab === 'explain' && (
            <div className="text-sm text-pb-faint text-center py-10">
              <p className="mb-2">Selecione um trecho do artigo para explicar.</p>
              <input
                disabled
                placeholder="Selecione texto primeiro..."
                className="w-full bg-[--pb-bg] border border-[--pb-line] text-pb-faint px-3 py-2 rounded text-sm opacity-50 mt-4"
              />
            </div>
          )}
          {activeTab === 'chat' && (
            <div className="text-sm text-pb-faint text-center py-10">
              <p className="mb-2">🔒 Em breve — converse com o artigo.</p>
              <input
                disabled
                placeholder="Desabilitado por agora..."
                className="w-full bg-[--pb-bg] border border-[--pb-line] text-pb-faint px-3 py-2 rounded text-sm opacity-50 mt-4"
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/components/blog/ai-reader.test.tsx`
Expected: Pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/blog/ai-reader-button.tsx apps/web/src/components/blog/ai-reader-drawer.tsx apps/web/test/components/blog/ai-reader.test.tsx
git commit -m "feat(blog): add AiReaderButton and AiReaderDrawer (hardcoded shell)"
```

---

## Task 16: MobileTocSheet

**Files:**
- Create: `apps/web/src/components/blog/mobile-toc-sheet.tsx`

- [ ] **Step 1: Implement MobileTocSheet**

```tsx
// apps/web/src/components/blog/mobile-toc-sheet.tsx
'use client'

import { useEffect } from 'react'
import { useScrollState } from './scroll-context'
import type { TocEntry } from './types'

type Props = {
  open: boolean
  onClose: () => void
  sections: TocEntry[]
  keyPoints?: string[]
}

export function MobileTocSheet({ open, onClose, sections, keyPoints }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const { activeSection } = useScrollState()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[95]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-[--pb-paper] rounded-t-2xl z-[96] max-h-[70vh] overflow-y-auto p-6">
        <div className="w-10 h-1 bg-[--pb-line] rounded-full mx-auto mb-4" />
        <div className="blog-sidebar-label mb-3">NESTE TEXTO</div>
        <ul className="list-none mb-6">
          {sections.map((entry) => (
            <li
              key={entry.slug}
              className={`text-sm py-2 cursor-pointer border-l-2 transition-all ${
                entry.depth === 3 ? 'pl-6' : 'pl-3'
              } ${activeSection === entry.slug ? 'text-pb-ink border-pb-accent font-medium' : 'text-pb-muted border-transparent'}`}
              onClick={() => {
                document.getElementById(entry.slug)?.scrollIntoView({ behavior: 'smooth' })
                onClose()
              }}
            >
              {entry.text}
            </li>
          ))}
        </ul>
        {keyPoints && keyPoints.length > 0 && (
          <>
            <div className="blog-sidebar-label mb-3">PONTOS-CHAVE</div>
            {keyPoints.map((point, i) => (
              <div key={i} className="flex gap-2 items-start mb-2">
                <span className="font-jetbrains text-xs font-bold text-pb-accent min-w-5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-sm text-pb-ink">{point}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/mobile-toc-sheet.tsx
git commit -m "feat(blog): add MobileTocSheet bottom sheet for mobile TOC + key points"
```

---

## Task 17: Barrel Export

**Files:**
- Create: `apps/web/src/components/blog/index.ts`

- [ ] **Step 1: Create barrel export**

```typescript
// apps/web/src/components/blog/index.ts
export { PostKeyPoints } from './post-key-points'
export { PostPullQuote } from './post-pull-quote'
export { PostColophon } from './post-colophon'
export { PostTags } from './post-tags'
export { AuthorRow } from './author-row'
export { AuthorCard } from './author-card'
export { SeriesBanner } from './series-banner'
export { SeriesNav } from './series-nav'
export { CoverImage } from './cover-image'
export { PostComments } from './post-comments'
export { RelatedPostsGrid } from './related-posts-grid'
export { ShareButtons } from './share-buttons'
export { ReadingProgressBar } from './reading-progress'
export { TimeLeftPill } from './time-left-pill'
export { PostToc } from './post-toc'
export { TextHighlighter } from './text-highlighter'
export { HighlightsSidebar } from './highlights-sidebar'
export { PostFootnotes } from './post-footnotes'
export { NewsletterCta } from './newsletter-cta'
export { AiReaderButton } from './ai-reader-button'
export { AiReaderDrawer } from './ai-reader-drawer'
export { MobileTocSheet } from './mobile-toc-sheet'
export { ScrollProvider } from './scroll-context'
export { PostExtrasSchema, type PostExtras } from './post-extras-schema'
export { AUTHOR_THIAGO, MOCK_ENGAGEMENT, MOCK_COMMENTS } from './mock-data'
export type { TocEntry, AuthorData, EngagementStats, MockComment } from './types'
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/index.ts
git commit -m "feat(blog): add barrel export for all blog detail components"
```

---

## Task 18: Rewrite page.tsx — 3-Column Editorial Layout

**Files:**
- Modify: `apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx` (full rewrite)
- Modify: `apps/web/src/app/(public)/blog/[locale]/[slug]/blog-article-client.tsx`

- [ ] **Step 1: Rewrite blog-article-client.tsx**

```tsx
// apps/web/src/app/(public)/blog/[locale]/[slug]/blog-article-client.tsx
'use client'

import { useState, type ReactNode } from 'react'
import {
  ScrollProvider,
  TextHighlighter,
  ReadingProgressBar,
  TimeLeftPill,
  AiReaderButton,
  AiReaderDrawer,
  MobileTocSheet,
  type TocEntry,
} from '@/components/blog'

type Props = {
  children: ReactNode
  sections: TocEntry[]
  readingTimeMin: number
  slug: string
  locale: string
  keyPoints?: string[]
}

export function BlogArticleClient({ children, sections, readingTimeMin, slug, locale, keyPoints }: Props) {
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

  return (
    <ScrollProvider sections={sections}>
      <ReadingProgressBar sections={sections} />
      <TimeLeftPill totalMinutes={readingTimeMin} />

      <div className="reader-pinboard reader-article">
        <TextHighlighter slug={slug} locale={locale}>
          <div className="blog-body">
            {children}
          </div>
        </TextHighlighter>
      </div>

      <AiReaderButton onClick={() => setAiDrawerOpen(true)} />
      <AiReaderDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
      <MobileTocSheet
        open={mobileTocOpen}
        onClose={() => setMobileTocOpen(false)}
        sections={sections}
        keyPoints={keyPoints}
      />

      {/* Mobile FABs — visible only on < 960px */}
      <div className="fixed bottom-28 right-7 z-[89] flex flex-col gap-2 md-960:hidden">
        <button
          onClick={() => setMobileTocOpen(true)}
          className="w-11 h-11 rounded-full bg-pb-accent flex items-center justify-center text-white shadow-lg border-none cursor-pointer"
          style={{ color: 'var(--pb-bg)' }}
          aria-label="Open table of contents"
        >
          ☰
        </button>
      </div>
    </ScrollProvider>
  )
}
```

- [ ] **Step 2: Rewrite page.tsx**

```tsx
// apps/web/src/app/(public)/blog/[locale]/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { compileMdx, MdxRunner, extractToc } from '@tn-figueiredo/cms'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteSeoConfig, type SiteSeoConfig } from '@/lib/seo/config'
import { generateBlogPostMetadata } from '@/lib/seo/page-metadata'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { loadPostWithLocales, toTranslationInputs } from '@/lib/blog/load-post'
import { buildDetailGraph, parseDateOrNull } from '@/lib/blog/build-detail-graph'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { parseMdxFrontmatter } from '@/lib/seo/frontmatter'
import {
  PostKeyPoints,
  PostPullQuote,
  PostColophon,
  PostTags,
  AuthorRow,
  AuthorCard,
  SeriesBanner,
  SeriesNav,
  CoverImage,
  PostComments,
  RelatedPostsGrid,
  PostFootnotes,
  NewsletterCta,
  PostToc,
  HighlightsSidebar,
  AUTHOR_THIAGO,
  MOCK_ENGAGEMENT,
  MOCK_COMMENTS,
  type TocEntry,
} from '@/components/blog'
import { BlogArticleClient } from './blog-article-client'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { post, translations, full, extrasByLocale } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) notFound()

  // Parse frontmatter for post extras (key_points, tags, series, etc.)
  const { postExtras } = parseMdxFrontmatter(tx.content_mdx)

  // Compile MDX
  let compiledSource = tx.content_compiled
  let toc: TocEntry[] = []
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
    toc = (compiled.toc ?? []).map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
  } else {
    const rawToc = extractToc(tx.content_mdx)
    toc = rawToc.map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
  }

  const publishedAt = post.published_at ?? (full ?? post).published_at

  // Parallel fetches
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  const [related, config] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, post.id, post.category ?? null),
    getSiteSeoConfig(ctx.siteId, host).catch(() => null),
  ])

  const detailGraph = buildDetailGraph(config, full ?? post, tx, translations, locale, slug, extrasByLocale)

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const updatedAt = (full ?? post).updated_at
  const showUpdated = updatedAt && publishedAt && new Date(updatedAt) > new Date(publishedAt)
  const formattedUpdated = showUpdated
    ? new Date(updatedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const pageUrl = `https://${host}/blog/${locale}/${encodeURIComponent(slug)}`

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}

      {/* Hero — centered, above 3-col grid */}
      <div className="max-w-[1280px] mx-auto px-10 pt-8">
        <div className="blog-detail-hero">
          <Link href={`/blog/${locale}`} className="inline-block text-sm text-pb-accent no-underline mb-6">
            ← voltar ao arquivo
          </Link>

          <div className="flex items-center gap-3 mb-4 text-[13px] text-pb-muted flex-wrap">
            {post.category && (
              <span className="border-[1.5px] border-pb-accent text-pb-accent px-2.5 py-0.5 rounded font-jetbrains text-[11px] uppercase tracking-wider font-medium">
                {post.category}
              </span>
            )}
            {formattedDate && <time dateTime={publishedAt!}>{formattedDate}</time>}
            <span>·</span>
            <span>{tx.reading_time_min} min leitura</span>
            {formattedUpdated && (
              <>
                <span>·</span>
                <span>atualizado em {formattedUpdated}</span>
              </>
            )}
          </div>

          <SeriesBanner
            title={postExtras?.series_title}
            part={postExtras?.series_part}
            total={postExtras?.series_total}
          />

          <h1 className="font-fraunces font-bold text-pb-ink mb-4" style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: 1.08 }}>
            {tx.title}
          </h1>

          {tx.excerpt && (
            <p className="text-lg italic text-pb-muted leading-relaxed mb-6" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
              {tx.excerpt}
            </p>
          )}

          <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale={locale} url={pageUrl} />

          <CoverImage src={post.cover_image_url ?? null} alt={tx.title} />
        </div>
      </div>

      {/* 3-Column Grid */}
      <div className="blog-detail-grid">
        {/* Left Sidebar — TOC */}
        <PostToc sections={toc} url={pageUrl} />

        {/* Article Body */}
        <main id="main-content" lang={locale}>
          <BlogArticleClient
            sections={toc}
            readingTimeMin={tx.reading_time_min}
            slug={slug}
            locale={locale}
            keyPoints={postExtras?.key_points}
          >
            <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
          </BlogArticleClient>
        </main>

        {/* Right Sidebar — Key Points + Pull Quote + Highlights */}
        <aside className="blog-sidebar blog-detail-sidebar">
          <PostKeyPoints points={postExtras?.key_points} />
          <PostPullQuote
            quote={postExtras?.pull_quote}
            attribution={postExtras?.pull_quote_attribution}
          />
          <HighlightsSidebar slug={slug} locale={locale} />
        </aside>
      </div>

      {/* Post Footer — centered 760px */}
      <div className="blog-detail-footer px-10">
        <AuthorCard author={AUTHOR_THIAGO} locale={locale} />
        <PostTags tags={postExtras?.tags} locale={locale} />
        <PostComments comments={MOCK_COMMENTS} />
        <SeriesNav
          nextSlug={postExtras?.series_next_slug}
          nextTitle={postExtras?.series_next_title}
          nextExcerpt={postExtras?.series_next_excerpt}
          locale={locale}
        />
        <NewsletterCta category={post.category ?? null} locale={locale} />
        <PostFootnotes footnotes={[]} />
        <PostColophon text={postExtras?.colophon} />
      </div>

      {/* Related Posts — wider container */}
      <RelatedPostsGrid posts={related} locale={locale} category={post.category ?? null} />
    </>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const { translations, full } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) return {}

  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  let config: SiteSeoConfig
  try {
    config = await getSiteSeoConfig(ctx.siteId, host)
  } catch {
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` },
    }
  }

  const post = full ?? loaded.post
  const txInputs = toTranslationInputs(post.cover_image_url, translations, loaded.extrasByLocale)
  const updatedAt = parseDateOrNull(post.updated_at)
  const publishedAt = parseDateOrNull(post.published_at) ?? updatedAt
  if (!publishedAt || !updatedAt) {
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` },
    }
  }
  const postInput = {
    id: post.id,
    translation: {
      title: tx.title,
      slug: tx.slug,
      excerpt: tx.excerpt,
      reading_time_min: tx.reading_time_min ?? 0,
    },
    updated_at: updatedAt,
    published_at: publishedAt,
  }
  return generateBlogPostMetadata(config, postInput, txInputs)
}
```

- [ ] **Step 3: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: All tests pass. Existing blog-detail test may need mock updates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/\[locale\]/\[slug\]/page.tsx apps/web/src/app/\(public\)/blog/\[locale\]/\[slug\]/blog-article-client.tsx
git commit -m "feat(blog): rewrite blog detail page with 3-column editorial layout"
```

---

## Task 19: Integration Test

**Files:**
- Create: `apps/web/test/app/blog-detail.test.tsx`

- [ ] **Step 1: Write integration test**

```tsx
// apps/web/test/app/blog-detail.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
  tryGetSiteContext: () => Promise.resolve({ siteId: 's1', orgId: 'o1', defaultLocale: 'pt-BR', primaryDomain: 'example.com' }),
}))

vi.mock('../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Test', siteUrl: 'https://example.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: null, defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map([['host', 'example.com']])),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

vi.mock('../../lib/blog/load-post', () => ({
  loadPostWithLocales: vi.fn().mockResolvedValue({
    post: { id: 'p1', published_at: '2026-04-24', cover_image_url: null, category: 'Ensaios', updated_at: '2026-04-26' },
    translations: [{
      locale: 'pt-BR', slug: 'test-post', title: 'Test Post Title',
      excerpt: 'Test excerpt', reading_time_min: 9,
      content_mdx: '# Hello\n\nBody text', content_compiled: null,
    }],
    full: { id: 'p1', published_at: '2026-04-24', cover_image_url: null, category: 'Ensaios', updated_at: '2026-04-26' },
    extrasByLocale: new Map(),
  }),
  toTranslationInputs: vi.fn().mockReturnValue([]),
}))

vi.mock('../../lib/blog/related-posts', () => ({
  getRelatedPosts: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../lib/blog/build-detail-graph', () => ({
  buildDetailGraph: vi.fn().mockReturnValue(null),
  parseDateOrNull: (d: string | null) => d ? new Date(d) : null,
}))

vi.mock('@tn-figueiredo/cms', () => ({
  compileMdx: vi.fn().mockResolvedValue({
    compiledSource: 'var Component = () => "hello"',
    toc: [{ slug: 'hello', text: 'Hello', depth: 2 }],
    readingTimeMin: 9,
  }),
  MdxRunner: ({ compiledSource }: { compiledSource: string }) => <div data-testid="mdx-body">MDX content</div>,
  extractToc: vi.fn().mockReturnValue([{ slug: 'hello', text: 'Hello', depth: 2 }]),
}))

vi.mock('../../lib/seo/frontmatter', () => ({
  parseMdxFrontmatter: vi.fn().mockReturnValue({
    content: '# Hello\n\nBody text',
    seoExtras: null,
    postExtras: { key_points: ['Point 1', 'Point 2'], tags: ['meta'] },
    raw: {},
  }),
}))

vi.mock('../../lib/seo/jsonld/render', () => ({
  JsonLdScript: () => null,
}))

import BlogDetailPage from '../../src/app/(public)/blog/[locale]/[slug]/page'

describe('BlogDetailPage', () => {
  it('renders hero with title, excerpt, and meta', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'test-post' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Test Post Title')
    expect(container.textContent).toContain('Test excerpt')
    expect(container.textContent).toContain('9 min leitura')
    expect(container.textContent).toContain('Ensaios')
  })

  it('renders key points in right sidebar', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'test-post' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Point 1')
    expect(container.textContent).toContain('Point 2')
  })

  it('renders author card', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'test-post' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Thiago Figueiredo')
    expect(container.textContent).toContain('SOBRE QUEM ESCREVEU')
  })

  it('renders tags', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'test-post' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('#meta')
  })

  it('renders comments section', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'test-post' }) })
    const { container } = render(jsx as never)
    expect(container.textContent).toContain('Conversa')
    expect(container.textContent).toContain('Paula Reis')
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `cd apps/web && npx vitest run`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/app/blog-detail.test.tsx
git commit -m "test(blog): add integration tests for blog detail page 3-column layout"
```

---

## Task 20: Visual Verification + Polish

**Files:**
- May need minor tweaks across components based on dev server rendering

- [ ] **Step 1: Start dev server**

Run: `cd apps/web && npm run dev`
Navigate to a blog post page in the browser.

- [ ] **Step 2: Verify layout**

Check the following in the browser:
1. Hero section centered above 3-col grid
2. 3-col grid: TOC (200px) | Article (760px) | Key Points (240px)
3. Sticky sidebars at top:80px
4. Progress bar below header
5. Time pill shows/hides on scroll
6. Source Serif 4 font on article body
7. Custom list bullets (accent dots for ul, accent numbers for ol)
8. Author row with engagement stats and share buttons
9. Cover image with paper+tape
10. Author card after article
11. Tags, comments, series nav, newsletter CTA in post-footer
12. Related posts grid with PaperCard
13. AI Reader pill in bottom-right
14. Text selection shows highlight/copy tooltip

- [ ] **Step 3: Fix any layout issues found**

Apply fixes as needed. Common issues:
- Responsive breakpoint at 960px hiding sidebars
- Font CSS variable resolution
- Sticky positioning conflicts with parent overflow

- [ ] **Step 4: Run full test suite one final time**

Run: `npm test`
Expected: All web + api tests pass.

- [ ] **Step 5: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(blog): polish blog detail layout after visual verification"
```

---

## Summary

| Task | Description | Components |
|---|---|---|
| 1 | Source Serif 4 font | Infrastructure |
| 2 | PostExtrasSchema + frontmatter | Schema + parsing |
| 3 | Mock data | Hardcoded data |
| 4 | Blog detail CSS | Styles |
| 5 | KeyPoints, PullQuote, Colophon, Tags | 4 server components |
| 6 | AuthorRow, AuthorCard | 2 server components |
| 7 | SeriesBanner, SeriesNav | 2 server components |
| 8 | CoverImage, PostComments | 2 server components |
| 9 | RelatedPostsGrid | 1 server component |
| 10 | ScrollContext, ProgressBar, TimePill | 3 client components |
| 11 | PostToc | 1 client component |
| 12 | TextHighlighter, HighlightsSidebar | 2 client components |
| 13 | PostFootnotes | 1 component |
| 14 | NewsletterCta | 1 client component |
| 15 | AiReaderButton, AiReaderDrawer | 2 client components |
| 16 | MobileTocSheet | 1 client component |
| 17 | Barrel export | Index file |
| 18 | Page rewrite | Integration |
| 19 | Integration test | Tests |
| 20 | Visual verification | Polish |

**Total:** 20 tasks, ~24 new components, ~10 test files, 2 modified core files.
