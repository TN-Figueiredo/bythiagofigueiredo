# Pinboard Home Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Next.js home page to match `design/Pinboard.html` — separate Blog/Video grids, add Most Read + Tag grid, Newsletter+YouTube subscribe pair, ad slot placeholders, Stats Strip, rename nav "Writing"→"Blog", remove "Site dev", consolidate `blog_tags` as sole taxonomy.

**Architecture:** Server component `PinboardHome` orchestrates all data fetching and passes props to 10 section components. New queries in `lib/home/queries.ts` pull tags from `blog_tags` table. All colors reference `--pb-*` CSS variables from `globals.css`. Ad slots accept `null` data (render nothing until admin connects). Videos use static mock data.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5, Supabase, Vitest

---

## File Structure

| # | File | Action | Responsibility |
|---|------|--------|----------------|
| 1 | `apps/web/lib/home/types.ts` | Expand | Add `HomeTag` type |
| 2 | `apps/web/lib/home/queries.ts` | Expand | Add `getTopTags`, `getPostsByTag`, `getMostReadPosts`, `getPostCount` |
| 3 | `apps/web/src/locales/pt-BR.json` | Edit | Rename `nav.writing`→`nav.blog`, remove `nav.devSite`, add section keys |
| 4 | `apps/web/src/locales/en.json` | Edit | Same renames + add section keys |
| 5 | `apps/web/src/components/layout/header-types.ts` | Edit | Rename `writing`→`blog` in type + `buildNavItems` |
| 6 | `apps/web/src/app/(public)/components/SectionHeader.tsx` | Create | Reusable `§ NN · label` section header |
| 7 | `apps/web/src/app/(public)/components/StatsStrip.tsx` | Create | Post/video/subscriber counts bar |
| 8 | `apps/web/src/app/(public)/components/DualHero.tsx` | Adjust | Use CSS vars, add tag badge, empty states |
| 9 | `apps/web/src/app/(public)/components/ChannelStrip.tsx` | Adjust | Handwriting header, red border, match design |
| 10 | `apps/web/src/app/(public)/components/BlogGrid.tsx` | Create | 6-post 3-col grid with paper cards |
| 11 | `apps/web/src/app/(public)/components/VideoGrid.tsx` | Create | 3-video 3-col grid |
| 12 | `apps/web/src/app/(public)/components/MostReadSidebar.tsx` | Create | Top 5 ranked list |
| 13 | `apps/web/src/app/(public)/components/TagCategoryGrid.tsx` | Create | 2×2 tag grid with 2 posts each |
| 14 | `apps/web/src/app/(public)/components/SubscribePair.tsx` | Create | Newsletter + YouTube subscribe cards |
| 15 | `apps/web/src/app/(public)/components/PinboardHome.tsx` | Refactor | Orchestrate all sections + data fetching |
| 16 | `apps/web/src/app/(public)/components/UnifiedFeed.tsx` | Delete | Replaced by BlogGrid + VideoGrid |
| 17 | `apps/web/src/app/(public)/components/NewsletterInline.tsx` | Delete | Replaced by SubscribePair |
| 18 | `apps/web/src/app/globals.css` | Expand | Add section/grid CSS utility classes |

---

### Task 1: Types + Queries (data layer)

**Files:**
- Modify: `apps/web/lib/home/types.ts`
- Modify: `apps/web/lib/home/queries.ts`
- Test: `apps/web/test/unit/home/queries.test.ts`

- [ ] **Step 1: Write the failing test for HomeTag type and new query functions**

Create `apps/web/test/unit/home/queries.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import type { HomeTag, HomePost } from '../../../lib/home/types'

describe('HomeTag type', () => {
  it('has required fields', () => {
    const tag: HomeTag = {
      id: 'uuid-1',
      name: 'tech',
      slug: 'tech',
      color: '#6366f1',
      colorDark: '#818cf8',
      postCount: 3,
    }
    expect(tag.id).toBe('uuid-1')
    expect(tag.name).toBe('tech')
    expect(tag.color).toBe('#6366f1')
    expect(tag.postCount).toBe(3)
  })

  it('allows null colorDark', () => {
    const tag: HomeTag = {
      id: 'uuid-2',
      name: 'vida',
      slug: 'vida',
      color: '#22c55e',
      colorDark: null,
      postCount: 1,
    }
    expect(tag.colorDark).toBeNull()
  })
})

describe('getMostReadPosts', () => {
  it('returns deterministic results for same day', async () => {
    const { getMostReadPosts } = await import('../../../lib/home/queries')
    const a = await getMostReadPosts('en', 5)
    const b = await getMostReadPosts('en', 5)
    expect(a.map(p => p.id)).toEqual(b.map(p => p.id))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/queries.test.ts --reporter=verbose`
Expected: FAIL — `HomeTag` not exported, `getMostReadPosts` not defined

- [ ] **Step 3: Add HomeTag type to types.ts**

Add to the end of `apps/web/lib/home/types.ts`:

```typescript
export type HomeTag = {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  postCount: number
}
```

- [ ] **Step 4: Add new query functions to queries.ts**

Add to `apps/web/lib/home/queries.ts` — append these 4 functions after the existing `getNewslettersForLocale`:

```typescript
export async function getTopTags(locale: string, limit = 4): Promise<HomeTag[]> {
  const db = getSupabaseServiceClient()
  const { siteId } = await getSiteContext()

  const { data, error } = await db
    .from('blog_tags')
    .select('id, name, slug, color, color_dark, sort_order')
    .eq('site_id', siteId)
    .order('sort_order')
    .limit(limit)

  if (error || !data) return []

  const tagIds = data.map(t => t.id)
  const now = new Date().toISOString()

  const { data: counts } = await db
    .from('blog_posts')
    .select('tag_id')
    .in('tag_id', tagIds)
    .eq('status', 'published')
    .lte('published_at', now)

  const countMap = new Map<string, number>()
  for (const row of counts ?? []) {
    const tid = (row as Record<string, unknown>)['tag_id'] as string
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1)
  }

  return data
    .map(t => ({
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      color: t.color as string,
      colorDark: t.color_dark as string | null,
      postCount: countMap.get(t.id as string) ?? 0,
    }))
    .filter(t => t.postCount > 0)
}

export async function getPostsByTag(locale: string, tagId: string, limit = 2): Promise<HomePost[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, locale, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, is_featured, status, tag_id)
    `)
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .eq('blog_posts.tag_id', tagId)
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []).map((row: Record<string, unknown>) => {
    const post = row['blog_posts'] as Record<string, unknown>
    return {
      id: post['id'] as string,
      slug: row['slug'] as string,
      locale: row['locale'] as string,
      title: row['title'] as string,
      excerpt: row['excerpt'] as string | null,
      publishedAt: post['published_at'] as string,
      category: post['category'] as string | null,
      readingTimeMin: row['reading_time_min'] as number,
      coverImageUrl: row['cover_image_url'] as string | null,
      isFeatured: post['is_featured'] as boolean,
    }
  })
}

export async function getMostReadPosts(locale: string, limit = 5): Promise<HomePost[]> {
  const posts = await getLatestPosts(locale, 20)
  if (posts.length === 0) return []

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const seeded = posts.map((p, i) => ({
    post: p,
    score: ((i + 1) * 37 + dayOfYear * 13) % 97,
  }))
  seeded.sort((a, b) => b.score - a.score)
  return seeded.slice(0, limit).map(s => s.post)
}

export async function getPostCount(locale: string): Promise<number> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { count, error } = await db
    .from('blog_translations')
    .select('slug', { count: 'exact', head: true })
    .eq('locale', locale)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)

  if (error) return 0
  return count ?? 0
}
```

Also add the missing import at the top of `queries.ts`:

```typescript
import { getSiteContext } from '../cms/site-context'
```

And add the `HomeTag` import to the existing import line:

```typescript
import type { HomeNewsletter, HomePost, HomeTag } from './types'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/queries.test.ts --reporter=verbose`
Expected: HomeTag type tests PASS, getMostReadPosts deterministic test PASS (or skip if service client unavailable)

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/home/types.ts apps/web/lib/home/queries.ts apps/web/test/unit/home/queries.test.ts
git commit -m "feat(home): add HomeTag type and new query functions for tags/most-read"
```

---

### Task 2: Locale strings — rename nav + add section keys

**Files:**
- Modify: `apps/web/src/locales/pt-BR.json`
- Modify: `apps/web/src/locales/en.json`
- Test: `apps/web/test/unit/home/locale-keys.test.ts`

- [ ] **Step 1: Write the failing test for locale key renames**

Create `apps/web/test/unit/home/locale-keys.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import ptBR from '../../../src/locales/pt-BR.json'
import en from '../../../src/locales/en.json'

describe('locale keys — nav rename', () => {
  it('pt-BR has nav.blog, not nav.writing', () => {
    const t = ptBR as Record<string, unknown>
    expect(t['nav.blog']).toBe('Blog')
    expect(t['nav.writing']).toBeUndefined()
  })

  it('en has nav.blog, not nav.writing', () => {
    const t = en as Record<string, unknown>
    expect(t['nav.blog']).toBe('Blog')
    expect(t['nav.writing']).toBeUndefined()
  })

  it('neither locale has nav.devSite', () => {
    const tPt = ptBR as Record<string, unknown>
    const tEn = en as Record<string, unknown>
    expect(tPt['nav.devSite']).toBeUndefined()
    expect(tEn['nav.devSite']).toBeUndefined()
  })
})

describe('locale keys — section strings', () => {
  it.each([
    'home.stats.subscribers',
    'home.stats.posts',
    'home.stats.videos',
    'home.blog.title',
    'home.blog.subtitle',
    'home.blog.viewAll',
    'home.blog.emptyTitle',
    'home.blog.emptyBody',
    'home.videos.title',
    'home.videos.subtitle',
    'home.videos.viewAll',
    'home.videos.subscribe',
    'home.mostRead.title',
    'home.mostRead.subtitle',
    'home.tags.title',
    'home.subscribe.headline',
    'home.subscribe.subheadline',
    'home.subscribe.nlKicker',
    'home.subscribe.nlTitle',
    'home.subscribe.nlSubtitle',
    'home.subscribe.ytKicker',
    'home.subscribe.ytTitle',
    'home.subscribe.ytSubtitle',
  ])('pt-BR has key "%s"', (key) => {
    const t = ptBR as Record<string, unknown>
    expect(t[key]).toBeDefined()
  })

  it.each([
    'home.stats.subscribers',
    'home.stats.posts',
    'home.stats.videos',
    'home.blog.title',
    'home.blog.subtitle',
    'home.blog.viewAll',
    'home.blog.emptyTitle',
    'home.blog.emptyBody',
    'home.videos.title',
    'home.videos.subtitle',
    'home.videos.viewAll',
    'home.videos.subscribe',
    'home.mostRead.title',
    'home.mostRead.subtitle',
    'home.tags.title',
    'home.subscribe.headline',
    'home.subscribe.subheadline',
    'home.subscribe.nlKicker',
    'home.subscribe.nlTitle',
    'home.subscribe.nlSubtitle',
    'home.subscribe.ytKicker',
    'home.subscribe.ytTitle',
    'home.subscribe.ytSubtitle',
  ])('en has key "%s"', (key) => {
    const t = en as Record<string, unknown>
    expect(t[key]).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/locale-keys.test.ts --reporter=verbose`
Expected: FAIL — `nav.blog` not found, `nav.writing` still present

- [ ] **Step 3: Update pt-BR.json**

In `apps/web/src/locales/pt-BR.json`:

1. **Replace** `"nav.writing": "Textos"` → `"nav.blog": "Blog"`
2. **Delete** the line `"nav.devSite": "Site Dev",`
3. **Add** after the `"newsletter.consent"` line:

```json
  "home.stats.subscribers": "inscritos",
  "home.stats.posts": "posts",
  "home.stats.videos": "vídeos",
  "home.blog.title": "Últimos escritos",
  "home.blog.subtitle": "ensaios, código, diário — os 6 mais recentes",
  "home.blog.viewAll": "Ver todos os artigos →",
  "home.blog.archiveLink": "ver arquivo completo →",
  "home.blog.emptyTitle": "ainda sem textos",
  "home.blog.emptyBody": "— mas vem coisa boa",
  "home.videos.title": "Últimos vídeos",
  "home.videos.subtitle": "live-coding, setup, bugs — os 3 mais recentes",
  "home.videos.viewAll": "ver todos os vídeos →",
  "home.videos.subscribe": "▶ inscreve no canal",
  "home.mostRead.title": "MAIS LIDOS",
  "home.mostRead.subtitle": "mais lidos do mês",
  "home.tags.title": "Por tag",
  "home.subscribe.headline": "duas formas de acompanhar",
  "home.subscribe.subheadline": "Escolhe o teu canal",
  "home.subscribe.nlKicker": "✉ NEWSLETTER",
  "home.subscribe.nlTitle": "Caderno de Campo",
  "home.subscribe.nlSubtitle": "Histórias, ideias e lições da trincheira indie — quinzenalmente na sua caixa de entrada.",
  "home.subscribe.ytKicker": "▶ YouTube",
  "home.subscribe.ytTitle": "Canal ao vivo",
  "home.subscribe.ytSubtitle": "Live-coding, vlogs de estrada e bastidores de projetos em dois idiomas.",
  "home.subscribe.readers": "leitores",
  "home.subscribe.openRate": "open rate",
```

- [ ] **Step 4: Update en.json**

Same changes in `apps/web/src/locales/en.json`:

1. **Replace** `"nav.writing": "Writing"` → `"nav.blog": "Blog"`
2. **Delete** the line `"nav.devSite": "Dev Site",`
3. **Add** after the `"newsletter.consent"` line:

```json
  "home.stats.subscribers": "subscribers",
  "home.stats.posts": "posts",
  "home.stats.videos": "videos",
  "home.blog.title": "Latest writing",
  "home.blog.subtitle": "essays, code, diary — the 6 most recent",
  "home.blog.viewAll": "See all posts →",
  "home.blog.archiveLink": "browse full archive →",
  "home.blog.emptyTitle": "nothing here yet",
  "home.blog.emptyBody": "— but good stuff is coming",
  "home.videos.title": "Latest videos",
  "home.videos.subtitle": "live-coding, setup, bugs — the 3 most recent",
  "home.videos.viewAll": "see all videos →",
  "home.videos.subscribe": "▶ subscribe on yt",
  "home.mostRead.title": "MOST READ",
  "home.mostRead.subtitle": "most read this month",
  "home.tags.title": "By tag",
  "home.subscribe.headline": "two ways to follow along",
  "home.subscribe.subheadline": "Pick your channel",
  "home.subscribe.nlKicker": "✉ NEWSLETTER",
  "home.subscribe.nlTitle": "Field Notes",
  "home.subscribe.nlSubtitle": "Stories, ideas, and lessons from the indie trenches — biweekly in your inbox.",
  "home.subscribe.ytKicker": "▶ YouTube",
  "home.subscribe.ytTitle": "On the channel",
  "home.subscribe.ytSubtitle": "Live-coding, road vlogs, and project behind-the-scenes in two languages.",
  "home.subscribe.readers": "readers",
  "home.subscribe.openRate": "open rate",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/locale-keys.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/locales/pt-BR.json apps/web/src/locales/en.json apps/web/test/unit/home/locale-keys.test.ts
git commit -m "feat(i18n): rename nav.writing to nav.blog, remove nav.devSite, add home section keys"
```

---

### Task 3: Header nav rename writing → blog

**Files:**
- Modify: `apps/web/src/components/layout/header-types.ts`
- Test: `apps/web/test/unit/home/header-nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/header-nav.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildNavItems, type HeaderCurrent } from '../../../src/components/layout/header-types'

const mockT: Record<string, string> = {
  'nav.home': 'Home',
  'nav.blog': 'Blog',
  'nav.videos': 'Videos',
  'nav.newsletter': 'Newsletter',
  'nav.about': 'About',
  'nav.contact': 'Contact',
}

describe('buildNavItems', () => {
  it('includes blog key, not writing', () => {
    const items = buildNavItems('en', 'full', mockT)
    expect(items.find(i => i.key === 'blog')).toBeDefined()
    expect(items.find(i => i.key === 'writing')).toBeUndefined()
  })

  it('does not include devSite', () => {
    const items = buildNavItems('en', 'full', mockT)
    expect(items.find(i => i.key === 'devSite')).toBeUndefined()
  })

  it('HeaderCurrent type includes blog', () => {
    const current: HeaderCurrent = 'blog'
    expect(current).toBe('blog')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/header-nav.test.ts --reporter=verbose`
Expected: FAIL — `HeaderCurrent` doesn't include `'blog'`, `buildNavItems` returns key `'writing'`

- [ ] **Step 3: Edit header-types.ts**

In `apps/web/src/components/layout/header-types.ts`:

1. Change `HeaderCurrent` type:
```typescript
export type HeaderCurrent = 'home' | 'blog' | 'videos' | 'newsletters' | 'about' | 'contact'
```

2. In `buildNavItems`, change the writing nav item:
```typescript
    { key: 'blog', href: locale === 'pt-BR' ? '/pt/blog' : '/blog', label: l('nav.blog') },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/header-nav.test.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Search for any remaining references to `HeaderCurrent = 'writing'` in the codebase**

Run: `grep -rn "'writing'" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".test."`

If any files pass `current="writing"`, update them to `current="blog"`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/header-types.ts apps/web/test/unit/home/header-nav.test.ts
git commit -m "feat(nav): rename writing to blog in header navigation"
```

---

### Task 4: SectionHeader reusable component

**Files:**
- Create: `apps/web/src/app/(public)/components/SectionHeader.tsx`
- Test: `apps/web/test/unit/home/section-header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/section-header.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SectionHeader } from '../../../src/app/(public)/components/SectionHeader'

describe('SectionHeader', () => {
  it('renders section number and label', () => {
    const { getByText } = render(
      <SectionHeader number="02" label="blog" title="Últimos escritos" subtitle="os 6 mais recentes" />
    )
    expect(getByText(/§ 02/)).toBeDefined()
    expect(getByText(/blog/)).toBeDefined()
    expect(getByText('Últimos escritos')).toBeDefined()
    expect(getByText('os 6 mais recentes')).toBeDefined()
  })

  it('renders right-side link when provided', () => {
    const { getByText } = render(
      <SectionHeader
        number="02"
        label="blog"
        title="Latest"
        linkText="see all →"
        linkHref="/blog"
      />
    )
    const link = getByText('see all →')
    expect(link.closest('a')?.getAttribute('href')).toBe('/blog')
  })

  it('uses accent color by default', () => {
    const { container } = render(
      <SectionHeader number="02" label="blog" title="Latest" />
    )
    const kicker = container.querySelector('[data-testid="section-kicker"]')
    expect(kicker).toBeDefined()
  })

  it('accepts custom kicker color', () => {
    const { container } = render(
      <SectionHeader number="03" label="do canal" title="Últimos vídeos" kickerColor="var(--pb-yt)" />
    )
    expect(container.querySelector('[data-testid="section-kicker"]')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/section-header.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create SectionHeader.tsx**

Create `apps/web/src/app/(public)/components/SectionHeader.tsx`:

```tsx
type Props = {
  number: string
  label: string
  title: string
  subtitle?: string
  linkText?: string
  linkHref?: string
  linkColor?: string
  kickerColor?: string
}

export function SectionHeader({
  number,
  label,
  title,
  subtitle,
  linkText,
  linkHref,
  linkColor,
  kickerColor = 'var(--pb-accent)',
}: Props) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span
            data-testid="section-kicker"
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: kickerColor,
            }}
          >
            § {number} · {label}
          </span>
          <h2
            className="font-fraunces"
            style={{
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              color: 'var(--pb-ink)',
              marginTop: 6,
            }}
          >
            <span
              style={{
                backgroundImage: 'linear-gradient(transparent 60%, var(--pb-marker) 60%)',
                backgroundSize: '100% 100%',
                backgroundRepeat: 'no-repeat',
                paddingBottom: 2,
              }}
            >
              {title}
            </span>
          </h2>
          {subtitle && (
            <p
              className="font-mono"
              style={{ fontSize: 12, color: 'var(--pb-muted)', marginTop: 6, letterSpacing: '0.02em' }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {linkText && linkHref && (
          <a
            href={linkHref}
            className="font-caveat shrink-0"
            style={{
              fontSize: 20,
              color: linkColor ?? kickerColor,
              textDecoration: 'none',
              transform: 'rotate(-1deg)',
              display: 'inline-block',
            }}
          >
            {linkText}
          </a>
        )}
      </div>
      <div
        style={{
          height: 1,
          background: 'var(--pb-line)',
          marginTop: 16,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/section-header.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/SectionHeader.tsx apps/web/test/unit/home/section-header.test.tsx
git commit -m "feat(home): add SectionHeader reusable component"
```

---

### Task 5: StatsStrip component

**Files:**
- Create: `apps/web/src/app/(public)/components/StatsStrip.tsx`
- Test: `apps/web/test/unit/home/stats-strip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/stats-strip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatsStrip } from '../../../src/app/(public)/components/StatsStrip'

describe('StatsStrip', () => {
  it('renders post, video and subscriber counts', () => {
    const { getByText } = render(
      <StatsStrip postCount={42} videoCount={8} subscriberCount={1427} t={{ 'home.stats.subscribers': 'inscritos', 'home.stats.posts': 'posts', 'home.stats.videos': 'vídeos' }} />
    )
    expect(getByText(/42/)).toBeDefined()
    expect(getByText(/posts/)).toBeDefined()
    expect(getByText(/1\.?427/)).toBeDefined()
  })

  it('renders nothing when all counts are 0', () => {
    const { container } = render(
      <StatsStrip postCount={0} videoCount={0} subscriberCount={0} t={{ 'home.stats.subscribers': 'subs', 'home.stats.posts': 'posts', 'home.stats.videos': 'videos' }} />
    )
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/stats-strip.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create StatsStrip.tsx**

Create `apps/web/src/app/(public)/components/StatsStrip.tsx`:

```tsx
type Props = {
  postCount: number
  videoCount: number
  subscriberCount: number
  t: Record<string, string>
}

export function StatsStrip({ postCount, videoCount, subscriberCount, t }: Props) {
  if (postCount === 0 && videoCount === 0 && subscriberCount === 0) return null

  const fmt = (n: number) => n.toLocaleString('pt-BR')
  const items = [
    subscriberCount > 0 ? `${fmt(subscriberCount)} ${t['home.stats.subscribers']}` : null,
    postCount > 0 ? `${fmt(postCount)} ${t['home.stats.posts']}` : null,
    videoCount > 0 ? `${fmt(videoCount)} ${t['home.stats.videos']}` : null,
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '10px 28px',
        borderBottom: '1px dashed var(--pb-line)',
      }}
    >
      <div className="flex justify-end gap-4 flex-wrap" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'var(--pb-faint)' }}>
        {items.map((item, i) => (
          <span key={i}>
            {i > 0 && <span style={{ marginRight: 8 }}>|</span>}
            ▸ {item}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/stats-strip.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/StatsStrip.tsx apps/web/test/unit/home/stats-strip.test.tsx
git commit -m "feat(home): add StatsStrip component with post/video/subscriber counts"
```

---

### Task 6: DualHero — refactor to use CSS variables + tag badges + empty states

**Files:**
- Modify: `apps/web/src/app/(public)/components/DualHero.tsx`
- Modify: `apps/web/lib/home/cover-image.ts`
- Test: `apps/web/test/unit/home/dual-hero.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/dual-hero.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DualHero } from '../../../src/app/(public)/components/DualHero'

const mockT: Record<string, string> = {
  'hero.post.mustRead': '← must-read',
  'hero.video.fresh': 'fresh →',
  'hero.comingSoon': 'Coming soon',
}

const mockPost = {
  id: '1', slug: 'test', locale: 'en', title: 'Test Post',
  excerpt: 'An excerpt', publishedAt: '2026-05-01', category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: true,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: '#818cf8',
}

const mockVideo = {
  id: 'v1', locale: 'en' as const, title: 'Test Video',
  description: 'A video', thumbnailUrl: null, duration: '18:42',
  viewCount: '1.2k', publishedAt: '2026-05-01', series: 'Dev Diary',
  youtubeUrl: 'https://youtube.com/watch?v=test',
}

describe('DualHero', () => {
  it('renders nothing when no post and no video', () => {
    const { container } = render(
      <DualHero post={null} video={null} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders post card with tag badge', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={null} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('tech')).toBeDefined()
  })

  it('renders video card', () => {
    const { getByText } = render(
      <DualHero post={null} video={mockVideo} locale="en" t={mockT} />
    )
    expect(getByText('Test Video')).toBeDefined()
    expect(getByText('18:42')).toBeDefined()
  })

  it('renders both cards in 2-col grid', () => {
    const { getByText } = render(
      <DualHero post={mockPost} video={mockVideo} locale="en" t={mockT} />
    )
    expect(getByText('Test Post')).toBeDefined()
    expect(getByText('Test Video')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/dual-hero.test.tsx --reporter=verbose`
Expected: FAIL — DualHero doesn't accept `tagName`/`tagColor` props on post

- [ ] **Step 3: Update the HomePost type to include optional tag fields**

In `apps/web/lib/home/types.ts`, add optional tag fields to `HomePost`:

```typescript
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
  tagName?: string
  tagColor?: string
  tagColorDark?: string | null
}
```

- [ ] **Step 4: Update cover-image.ts to accept tag slug**

In `apps/web/lib/home/cover-image.ts`, rename parameter and keep backward compat:

```typescript
const CATEGORY_HUES: Record<string, [number, number]> = {
  tech: [220, 260],
  vida: [30, 60],
  viagem: [160, 200],
  crescimento: [100, 140],
  code: [200, 240],
  negocio: [350, 20],
}
const DEFAULT_HUES: [number, number] = [35, 50]

export function coverGradient(tagOrCategory: string | null, dark: boolean): string {
  const [h1, h2] = (tagOrCategory && CATEGORY_HUES[tagOrCategory]) ?? DEFAULT_HUES
  const s = dark ? 45 : 55
  const l = dark ? 28 : 72
  return `linear-gradient(135deg, hsl(${h1},${s}%,${l}%) 0%, hsl(${h2},${s}%,${l}%) 100%)`
}
```

- [ ] **Step 5: Rewrite DualHero.tsx to use CSS variables**

Replace the full content of `apps/web/src/app/(public)/components/DualHero.tsx` — remove all hardcoded color values, use `var(--pb-*)` CSS variables, add `tagName`/`tagColor` display, and empty state logic:

```tsx
import Link from 'next/link'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost, HomeVideo } from '../../../../lib/home/types'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

type HeroPost = HomePost & { tagName?: string; tagColor?: string; tagColorDark?: string | null }

type Props = {
  post: HeroPost | null
  video: HomeVideo | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function DualHero({ post, video, locale, t }: Props) {
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const isPt = locale === 'pt-BR'
  const hasContent = post || video
  if (!hasContent) return null

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const year = now.getFullYear()

  const postDate = post
    ? new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const videoDate = video
    ? new Date(video.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const cols = post && video ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'

  return (
    <section aria-labelledby="hero-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <div className="font-caveat" style={{ color: 'var(--pb-accent)', fontSize: 30, transform: 'rotate(-1.5deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
          ★ {isPt ? 'o destaque da semana' : "this week's highlight"}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--pb-line)' }} />
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--pb-muted)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {isPt ? 'SEM' : 'WK'} {weekNum} · {year}
        </span>
      </div>
      <h2 id="hero-heading" className="sr-only">{isPt ? 'Destaque da semana' : "This week's highlight"}</h2>

      <div className={`grid ${cols}`} style={{ gap: 40 }}>
        {post && (
          <div style={{ position: 'relative', paddingTop: 20 }}>
            <div style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(-0.8deg)', boxShadow: 'var(--pb-shadow-card)' }}>
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '18%', transform: 'rotate(-4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '18%', transform: 'rotate(5deg)' }} />
              <Link href={`${blogBase}/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ position: 'relative', overflow: 'hidden', background: coverGradient(post.tagName ?? post.category, false), aspectRatio: '16 / 9' }}>
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--pb-ink)', color: 'var(--pb-paper)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                      ▤ {isPt ? 'texto' : 'post'}
                    </span>
                  </div>
                </div>
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {post.tagName && (
                      <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: post.tagColor ?? 'var(--pb-accent)', fontWeight: 500 }}>
                        {post.tagName}
                      </span>
                    )}
                    {postDate && (
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.1em' }}>
                        {postDate} · {post.readingTimeMin} min
                      </span>
                    )}
                  </div>
                  <h3 className="font-fraunces" style={{ fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p style={{ fontSize: 14.5, color: 'var(--pb-muted)', lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.excerpt}
                    </p>
                  )}
                  <div className="font-caveat" style={{ marginTop: 16, color: 'var(--pb-accent)', fontSize: 20, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                    {t['hero.post.mustRead'] ?? (isPt ? '← leitura obrigatória' : '← must-read')}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {video && (
          <div style={{ position: 'relative', paddingTop: 20 }}>
            <div style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(0.8deg)', boxShadow: 'var(--pb-shadow-card)' }}>
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tapeR)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '22%', transform: 'rotate(4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '15%', transform: 'rotate(-3deg)' }} />
              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', background: 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 68, height: 48, background: 'var(--pb-yt)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
                    ▶ YouTube
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 11, padding: '2px 7px' }}>
                    {video.duration}
                  </div>
                </div>
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ padding: '2px 8px', background: 'var(--pb-yt)', color: '#FFF', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {video.series}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.1em' }}>
                      {video.viewCount !== '—' ? `${video.viewCount} · ` : ''}{videoDate}
                    </span>
                  </div>
                  <h3 className="font-fraunces" style={{ fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                    {video.title}
                  </h3>
                  <p style={{ fontSize: 14.5, color: 'var(--pb-muted)', lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.description}
                  </p>
                  <div className="font-caveat" style={{ marginTop: 16, color: 'var(--pb-accent)', fontSize: 20, transform: 'rotate(2deg)', display: 'inline-block' }}>
                    {t['hero.video.fresh'] ?? (isPt ? 'novo no canal →' : 'fresh on the channel →')}
                  </div>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 16 }} />
    </section>
  )
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/dual-hero.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(public\)/components/DualHero.tsx apps/web/lib/home/cover-image.ts apps/web/lib/home/types.ts apps/web/test/unit/home/dual-hero.test.tsx
git commit -m "refactor(home): DualHero uses CSS vars, tag badges, empty states"
```

---

### Task 7: ChannelStrip — match Pinboard design

**Files:**
- Modify: `apps/web/src/app/(public)/components/ChannelStrip.tsx`
- Test: `apps/web/test/unit/home/channel-strip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/channel-strip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ChannelStrip } from '../../../src/app/(public)/components/ChannelStrip'

const mockT: Record<string, string> = {
  'channels.title': 'Watch on YouTube',
  'channels.subscribe': 'Subscribe',
  'channels.primary': 'Main',
  'channels.subscribersSuffix': 'subscribers',
}

describe('ChannelStrip', () => {
  it('renders handwriting header', () => {
    const { getByText } = render(
      <ChannelStrip locale="en" t={mockT} />
    )
    expect(getByText(/two channels/i)).toBeDefined()
  })

  it('renders both channel cards with red border', () => {
    const { container } = render(
      <ChannelStrip locale="en" t={mockT} />
    )
    const cards = container.querySelectorAll('[data-testid="channel-card"]')
    expect(cards.length).toBe(2)
  })

  it('renders subscribe buttons', () => {
    const { getAllByText } = render(
      <ChannelStrip locale="en" t={mockT} />
    )
    expect(getAllByText('Subscribe').length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/channel-strip.test.tsx --reporter=verbose`
Expected: FAIL — no handwriting header, no `data-testid="channel-card"`

- [ ] **Step 3: Rewrite ChannelStrip.tsx**

Replace `apps/web/src/app/(public)/components/ChannelStrip.tsx`:

```tsx
import { PaperCard } from './PaperCard'
import { YOUTUBE_CHANNELS } from '@/lib/home/videos-data'
import type { HomeChannel } from '@/lib/home/types'

type Props = {
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

function ChannelCard({ channel, index, t }: { channel: HomeChannel; index: number; t: Record<string, string> }) {
  return (
    <div data-testid="channel-card">
      <PaperCard index={index} variant="paper" className="p-5 flex flex-col gap-4" >
        <div style={{ border: '2px solid var(--pb-yt)', borderRadius: 2, padding: 20 }}>
          <div className="flex items-start gap-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--pb-yt)' }}
              aria-hidden="true"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
              <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: 14 }}>{channel.flag}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-fraunces text-lg leading-tight" style={{ color: 'var(--pb-ink)' }}>
                {channel.name}
              </p>
              <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--pb-muted)' }}>{channel.handle}</p>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--pb-faint)' }}>
                — {t['channels.subscribersSuffix']}
              </p>
            </div>
          </div>

          <a
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t['channels.subscribe']} ${channel.name}`}
            className="mt-4 inline-flex items-center gap-2 font-mono font-semibold text-sm px-4 py-2 rounded"
            style={{ background: 'var(--pb-yt)', color: '#FFF' }}
          >
            ▶ {t['channels.subscribe']}
          </a>
        </div>
      </PaperCard>
    </div>
  )
}

export function ChannelStrip({ locale, t }: Props) {
  const primary = YOUTUBE_CHANNELS[locale]
  const secondary = YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']
  const isPt = locale === 'pt-BR'

  return (
    <section aria-labelledby="channels-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 28px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div className="font-caveat" style={{ color: 'var(--pb-yt)', fontSize: 26, transform: 'rotate(-1deg)', whiteSpace: 'nowrap' }}>
          ▶ {isPt ? 'dois canais, dois idiomas' : 'two channels, two languages'}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--pb-line)' }} />
        <span className="font-mono uppercase" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {isPt ? 'INSCREVA-SE EM UM OU NOS DOIS' : 'SUBSCRIBE TO ONE OR BOTH'}
        </span>
      </div>
      <h2 id="channels-heading" className="sr-only">{t['channels.title']}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        <ChannelCard channel={primary} index={0} t={t} />
        <ChannelCard channel={secondary} index={1} t={t} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/channel-strip.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/ChannelStrip.tsx apps/web/test/unit/home/channel-strip.test.tsx
git commit -m "refactor(home): ChannelStrip with handwriting header, red border, CSS vars"
```

---

### Task 8: BlogGrid component

**Files:**
- Create: `apps/web/src/app/(public)/components/BlogGrid.tsx`
- Test: `apps/web/test/unit/home/blog-grid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/blog-grid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BlogGrid } from '../../../src/app/(public)/components/BlogGrid'

const mockT: Record<string, string> = {
  'home.blog.title': 'Latest writing',
  'home.blog.subtitle': 'the 6 most recent',
  'home.blog.viewAll': 'See all posts →',
  'home.blog.archiveLink': 'browse archive →',
  'home.blog.emptyTitle': 'nothing here yet',
  'home.blog.emptyBody': '— but good stuff is coming',
}

const makePost = (i: number) => ({
  id: `p${i}`, slug: `post-${i}`, locale: 'en', title: `Post ${i}`,
  excerpt: `Excerpt ${i}`, publishedAt: `2026-05-0${i}`, category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: i === 1,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: null,
})

describe('BlogGrid', () => {
  it('renders empty state when 0 posts', () => {
    const { getByText } = render(
      <BlogGrid posts={[]} locale="en" t={mockT} isDark />
    )
    expect(getByText('nothing here yet')).toBeDefined()
  })

  it('renders correct number of cards', () => {
    const posts = [1, 2, 3, 4, 5, 6].map(makePost)
    const { getAllByRole } = render(
      <BlogGrid posts={posts} locale="en" t={mockT} isDark />
    )
    expect(getAllByRole('heading', { level: 3 }).length).toBe(6)
  })

  it('renders section header with marker highlight', () => {
    const { getByText } = render(
      <BlogGrid posts={[makePost(1)]} locale="en" t={mockT} isDark />
    )
    expect(getByText('Latest writing')).toBeDefined()
  })

  it('renders CTA button', () => {
    const { getByText } = render(
      <BlogGrid posts={[makePost(1)]} locale="en" t={mockT} isDark />
    )
    expect(getByText('See all posts →')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/blog-grid.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create BlogGrid.tsx**

Create `apps/web/src/app/(public)/components/BlogGrid.tsx`:

```tsx
import Link from 'next/link'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { SectionHeader } from './SectionHeader'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost } from '../../../../lib/home/types'

type Props = {
  posts: HomePost[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

const tapeVariants = ['tape', 'tape2', 'tapeR'] as const

export function BlogGrid({ posts, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const isPt = locale === 'pt-BR'

  const gridCols =
    posts.length >= 3 ? 'lg:grid-cols-3' :
    posts.length === 2 ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="blog-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px' }}>
      <SectionHeader
        number="02"
        label="blog"
        title={t['home.blog.title']}
        subtitle={t['home.blog.subtitle']}
        linkText={t['home.blog.archiveLink']}
        linkHref={blogBase}
      />
      <h2 id="blog-heading" className="sr-only">{t['home.blog.title']}</h2>

      {posts.length === 0 ? (
        <PaperCard index={0} variant="paper" className="p-8 text-center max-w-md mx-auto">
          <Tape variant="tape" className="-top-2 left-6" rotate={-5} />
          <p className="font-caveat text-2xl" style={{ color: 'var(--pb-accent)' }}>
            {t['home.blog.emptyTitle']}
          </p>
          <p className="font-caveat text-lg mt-1" style={{ color: 'var(--pb-muted)' }}>
            {t['home.blog.emptyBody']}
          </p>
        </PaperCard>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols}`} style={{ gap: 40, rowGap: 56 }}>
            {posts.map((post, i) => (
              <PaperCard
                key={post.id}
                index={i}
                variant={i % 3 === 1 ? 'paper2' : 'paper'}
                className="overflow-hidden"
              >
                <Tape variant={tapeVariants[i % 3]} className="-top-2 left-4" rotate={-7 + (i % 5)} />
                <Link href={`${blogBase}/${post.slug}`} className="block group" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div
                    style={{
                      background: post.coverImageUrl ? undefined : coverGradient(post.tagName ?? post.category, isDark),
                      aspectRatio: '16 / 10',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ position: 'absolute', top: 8, left: 8 }}>
                      <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--pb-ink)', color: 'var(--pb-paper)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                        ▤ {isPt ? 'texto' : 'post'}
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: '16px 18px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      {post.tagName && (
                        <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: post.tagColor ?? 'var(--pb-accent)' }}>
                          {post.tagName}
                        </span>
                      )}
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)' }}>
                        {new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="font-fraunces" style={{ fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.01em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                      {post.title}
                    </h3>
                    <p className="font-mono" style={{ fontSize: 12, color: 'var(--pb-faint)', marginTop: 8 }}>
                      {post.readingTimeMin} min
                    </p>
                    {post.tagName && (
                      <p className="font-mono" style={{ fontSize: 9.5, color: 'var(--pb-faint)', marginTop: 6, opacity: 0.7 }}>
                        #{post.tagName}
                      </p>
                    )}
                    {i === 0 && (
                      <div className="font-caveat" style={{ marginTop: 10, color: 'var(--pb-accent)', fontSize: 18, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                        ⭐ top!
                      </div>
                    )}
                  </div>
                </Link>
              </PaperCard>
            ))}
          </div>

          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <Link
              href={blogBase}
              className="font-mono inline-block"
              style={{ fontSize: 13, color: 'var(--pb-accent)', padding: '10px 24px', border: '1px solid var(--pb-line)', textDecoration: 'none' }}
            >
              {t['home.blog.viewAll']}
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/blog-grid.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/BlogGrid.tsx apps/web/test/unit/home/blog-grid.test.tsx
git commit -m "feat(home): add BlogGrid component with 3-col paper cards and empty state"
```

---

### Task 9: VideoGrid component

**Files:**
- Create: `apps/web/src/app/(public)/components/VideoGrid.tsx`
- Test: `apps/web/test/unit/home/video-grid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/video-grid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { VideoGrid } from '../../../src/app/(public)/components/VideoGrid'

const mockT: Record<string, string> = {
  'home.videos.title': 'Latest videos',
  'home.videos.subtitle': 'the 3 most recent',
  'home.videos.viewAll': 'see all →',
  'home.videos.subscribe': '▶ subscribe on yt',
}

const makeVideo = (i: number) => ({
  id: `v${i}`, locale: 'en' as const, title: `Video ${i}`,
  description: `Description ${i}`, thumbnailUrl: null,
  duration: `${10 + i}:00`, viewCount: '1.2k',
  publishedAt: `2026-05-0${i}`, series: 'Dev Diary',
  youtubeUrl: 'https://youtube.com/@test',
})

describe('VideoGrid', () => {
  it('renders nothing when 0 videos', () => {
    const { container } = render(
      <VideoGrid videos={[]} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders correct number of cards', () => {
    const videos = [1, 2, 3].map(makeVideo)
    const { getAllByRole } = render(
      <VideoGrid videos={videos} locale="en" t={mockT} />
    )
    expect(getAllByRole('heading', { level: 3 }).length).toBe(3)
  })

  it('renders section header', () => {
    const { getByText } = render(
      <VideoGrid videos={[makeVideo(1)]} locale="en" t={mockT} />
    )
    expect(getByText('Latest videos')).toBeDefined()
  })

  it('renders subscribe CTA', () => {
    const { getByText } = render(
      <VideoGrid videos={[makeVideo(1)]} locale="en" t={mockT} />
    )
    expect(getByText('▶ subscribe on yt')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/video-grid.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create VideoGrid.tsx**

Create `apps/web/src/app/(public)/components/VideoGrid.tsx`:

```tsx
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { SectionHeader } from './SectionHeader'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'
import type { HomeVideo } from '../../../../lib/home/types'

type Props = {
  videos: HomeVideo[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

const rot = (i: number) => ((i * 37) % 7 - 3) * 0.5
const lift = (i: number) => ((i * 53) % 5 - 2) * 2

export function VideoGrid({ videos, locale, t }: Props) {
  if (videos.length === 0) return null

  const isPt = locale === 'pt-BR'
  const channelUrl = YOUTUBE_CHANNELS[locale].url
  const gridCols =
    videos.length >= 3 ? 'lg:grid-cols-3' :
    videos.length === 2 ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="videos-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px' }}>
      <div style={{ borderTop: '1px dashed var(--pb-line)', paddingTop: 32 }}>
        <SectionHeader
          number="03"
          label={isPt ? 'do canal' : 'from the channel'}
          title={t['home.videos.title']}
          subtitle={t['home.videos.subtitle']}
          linkText={t['home.videos.viewAll']}
          linkHref={channelUrl}
          kickerColor="var(--pb-yt)"
          linkColor="var(--pb-yt)"
        />
        <h2 id="videos-heading" className="sr-only">{t['home.videos.title']}</h2>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols}`} style={{ gap: 32, rowGap: 48 }}>
          {videos.map((video, i) => {
            const cardIdx = i + 11
            return (
              <PaperCard key={video.id} index={cardIdx} variant="paper" className="overflow-hidden" >
                <Tape variant="tapeR" className="-top-2 left-5" rotate={-6 + (i % 4)} />
                <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ position: 'relative', aspectRatio: '4 / 3', overflow: 'hidden', background: 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 52, height: 36, background: 'var(--pb-yt)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                    <div className="font-mono" style={{ position: 'absolute', top: 6, left: 6, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '2px 6px' }}>
                      ▶ YouTube
                    </div>
                    <div className="font-mono" style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 10, padding: '2px 6px' }}>
                      {video.duration}
                    </div>
                  </div>
                  <div style={{ padding: '12px 14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="font-mono" style={{ padding: '2px 6px', background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                        {video.series}
                      </span>
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)' }}>
                        {new Date(video.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <h3 className="font-fraunces" style={{ fontSize: 19, lineHeight: 1.15, letterSpacing: '-0.01em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                      {video.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--pb-muted)', lineHeight: 1.45, marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {video.description}
                    </p>
                    <p className="font-mono" style={{ fontSize: 11, color: 'var(--pb-faint)', marginTop: 10 }}>
                      {video.duration} · {video.viewCount !== '—' ? video.viewCount : ''}
                    </p>
                  </div>
                </a>
              </PaperCard>
            )
          })}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a
            href={channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono uppercase inline-block"
            style={{ fontSize: 12, letterSpacing: '0.1em', background: 'var(--pb-yt)', color: '#FFF', padding: '12px 28px', fontWeight: 600, textDecoration: 'none' }}
          >
            {t['home.videos.subscribe']}
          </a>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/video-grid.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/VideoGrid.tsx apps/web/test/unit/home/video-grid.test.tsx
git commit -m "feat(home): add VideoGrid component with 3-col grid and empty state"
```

---

### Task 10: MostReadSidebar component

**Files:**
- Create: `apps/web/src/app/(public)/components/MostReadSidebar.tsx`
- Test: `apps/web/test/unit/home/most-read-sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/most-read-sidebar.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MostReadSidebar } from '../../../src/app/(public)/components/MostReadSidebar'

const mockT: Record<string, string> = {
  'home.mostRead.title': 'MOST READ',
  'home.mostRead.subtitle': 'most read this month',
}

const makePost = (i: number) => ({
  id: `p${i}`, slug: `post-${i}`, locale: 'en', title: `Most Read Post ${i}`,
  excerpt: null, publishedAt: `2026-05-0${i}`, category: 'tech',
  readingTimeMin: 5, coverImageUrl: null, isFeatured: false,
  tagName: 'tech', tagColor: '#6366f1', tagColorDark: null,
})

describe('MostReadSidebar', () => {
  it('renders nothing when 0 posts', () => {
    const { container } = render(
      <MostReadSidebar posts={[]} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders ordered list with correct count', () => {
    const posts = [1, 2, 3, 4, 5].map(makePost)
    const { container, getByText } = render(
      <MostReadSidebar posts={posts} locale="en" t={mockT} />
    )
    const ol = container.querySelector('ol')
    expect(ol).toBeDefined()
    expect(ol!.children.length).toBe(5)
    expect(getByText('Most Read Post 1')).toBeDefined()
  })

  it('renders header', () => {
    const { getByText } = render(
      <MostReadSidebar posts={[makePost(1)]} locale="en" t={mockT} />
    )
    expect(getByText('MOST READ')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/most-read-sidebar.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create MostReadSidebar.tsx**

Create `apps/web/src/app/(public)/components/MostReadSidebar.tsx`:

```tsx
import Link from 'next/link'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import type { HomePost } from '../../../../lib/home/types'

type Props = {
  posts: HomePost[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function MostReadSidebar({ posts, locale, t }: Props) {
  if (posts.length === 0) return null
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'

  return (
    <div>
      <PaperCard index={7} variant="paper2" className="p-5">
        <Tape variant="tape" className="-top-2 left-6" rotate={-4} />
        <div style={{ marginBottom: 16 }}>
          <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: 'var(--pb-accent)' }}>
            ★ {t['home.mostRead.title']}
          </span>
          <p className="font-caveat" style={{ fontSize: 20, color: 'var(--pb-muted)', marginTop: 4 }}>
            {t['home.mostRead.subtitle']}
          </p>
        </div>

        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {posts.map((post, i) => (
            <li
              key={post.id}
              style={{
                padding: '14px 0',
                borderTop: i > 0 ? '1px dashed var(--pb-line)' : undefined,
              }}
            >
              <Link href={`${blogBase}/${post.slug}`} className="flex items-start gap-3 group" style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className="font-caveat shrink-0" style={{ fontSize: 30, color: 'var(--pb-accent)', lineHeight: 1, minWidth: 28, textAlign: 'center' }}>
                  {i + 1}
                </span>
                <div>
                  {post.tagName && (
                    <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: post.tagColor ?? 'var(--pb-accent)' }}>
                      {post.tagName}
                    </span>
                  )}
                  <h3 className="font-fraunces" style={{ fontSize: 15, lineHeight: 1.25, margin: '2px 0 0', fontWeight: 500, color: 'var(--pb-ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post.title}
                  </h3>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </PaperCard>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/most-read-sidebar.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/MostReadSidebar.tsx apps/web/test/unit/home/most-read-sidebar.test.tsx
git commit -m "feat(home): add MostReadSidebar component with ranked list"
```

---

### Task 11: TagCategoryGrid component

**Files:**
- Create: `apps/web/src/app/(public)/components/TagCategoryGrid.tsx`
- Test: `apps/web/test/unit/home/tag-category-grid.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/tag-category-grid.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TagCategoryGrid } from '../../../src/app/(public)/components/TagCategoryGrid'

const mockT: Record<string, string> = {
  'home.tags.title': 'By tag',
}

const makePosts = (tagName: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: `${tagName}-${i}`, slug: `${tagName}-post-${i}`, locale: 'en',
    title: `${tagName} Post ${i}`, excerpt: null, publishedAt: `2026-05-0${i + 1}`,
    category: tagName, readingTimeMin: 3, coverImageUrl: null, isFeatured: false,
    tagName, tagColor: '#6366f1', tagColorDark: null,
  }))

describe('TagCategoryGrid', () => {
  it('renders nothing when no tag groups', () => {
    const { container } = render(
      <TagCategoryGrid tagGroups={[]} locale="en" t={mockT} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders header and cards for each tag', () => {
    const groups = [
      { tag: { id: '1', name: 'tech', slug: 'tech', color: '#6366f1', colorDark: null, postCount: 2 }, posts: makePosts('tech', 2) },
      { tag: { id: '2', name: 'vida', slug: 'vida', color: '#22c55e', colorDark: null, postCount: 2 }, posts: makePosts('vida', 2) },
    ]
    const { getByText } = render(
      <TagCategoryGrid tagGroups={groups} locale="en" t={mockT} />
    )
    expect(getByText('By tag')).toBeDefined()
    expect(getByText('tech')).toBeDefined()
    expect(getByText('vida')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/tag-category-grid.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create TagCategoryGrid.tsx**

Create `apps/web/src/app/(public)/components/TagCategoryGrid.tsx`:

```tsx
import Link from 'next/link'
import { PaperCard } from './PaperCard'
import type { HomePost, HomeTag } from '../../../../lib/home/types'

type TagGroup = {
  tag: HomeTag
  posts: HomePost[]
}

type Props = {
  tagGroups: TagGroup[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function TagCategoryGrid({ tagGroups, locale, t }: Props) {
  if (tagGroups.length === 0) return null
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const isPt = locale === 'pt-BR'

  const gridCols =
    tagGroups.length >= 2 ? 'md:grid-cols-2' : ''

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 600, color: 'var(--pb-accent)' }}>
          § 04
        </span>
        <h2 className="font-fraunces italic" style={{ fontSize: 32, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--pb-ink)', marginTop: 4 }}>
          {t['home.tags.title']}
        </h2>
      </div>

      <div className={`grid grid-cols-1 ${gridCols}`} style={{ gap: 28 }}>
        {tagGroups.map((group, gi) => (
          <PaperCard key={group.tag.id} index={gi + 20} variant="paper" className="overflow-hidden">
            <div style={{ padding: '16px 18px 20px' }}>
              <span
                className="font-mono inline-block"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  background: group.tag.color,
                  color: '#FFF',
                  padding: '3px 10px',
                  marginBottom: 14,
                }}
              >
                {group.tag.name}
              </span>

              {group.posts.map((post, pi) => (
                <div key={post.id}>
                  {pi > 0 && <div style={{ height: 1, background: 'var(--pb-line)', margin: '12px 0', opacity: 0.5 }} />}
                  <Link href={`${blogBase}/${post.slug}`} className="block group" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <h3 className="font-fraunces" style={{ fontSize: 15, lineHeight: 1.25, margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                      {post.title}
                    </h3>
                    <p className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', marginTop: 4 }}>
                      {new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {post.readingTimeMin} min
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          </PaperCard>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/tag-category-grid.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/TagCategoryGrid.tsx apps/web/test/unit/home/tag-category-grid.test.tsx
git commit -m "feat(home): add TagCategoryGrid component with color-coded tag cards"
```

---

### Task 12: SubscribePair component

**Files:**
- Create: `apps/web/src/app/(public)/components/SubscribePair.tsx`
- Test: `apps/web/test/unit/home/subscribe-pair.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/subscribe-pair.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SubscribePair } from '../../../src/app/(public)/components/SubscribePair'

const mockT: Record<string, string> = {
  'home.subscribe.headline': 'two ways to follow',
  'home.subscribe.subheadline': 'Pick your channel',
  'home.subscribe.nlKicker': '✉ NEWSLETTER',
  'home.subscribe.nlTitle': 'Field Notes',
  'home.subscribe.nlSubtitle': 'Stories from the trenches.',
  'home.subscribe.ytKicker': '▶ YouTube',
  'home.subscribe.ytTitle': 'On the channel',
  'home.subscribe.ytSubtitle': 'Live-coding in two languages.',
  'home.subscribe.readers': 'readers',
  'home.subscribe.openRate': 'open rate',
  'newsletter.emailPlaceholder': 'your@email.com',
  'newsletter.submit': 'Subscribe',
  'newsletter.consent': 'By subscribing you agree to our Privacy Policy.',
  'channels.subscribe': 'Subscribe',
  'channels.subscribersSuffix': 'subscribers',
}

const newsletter = {
  id: 'nl-1', name: 'Field Notes', tagline: 'Stories', cadence: 'biweekly', color: '#FF8240', locale: 'en',
}

describe('SubscribePair', () => {
  it('renders both cards when newsletter and channels exist', () => {
    const { getByText } = render(
      <SubscribePair newsletter={newsletter} locale="en" t={mockT} />
    )
    expect(getByText('Field Notes')).toBeDefined()
    expect(getByText('On the channel')).toBeDefined()
  })

  it('renders only YT card when no newsletter', () => {
    const { getByText, queryByText } = render(
      <SubscribePair newsletter={null} locale="en" t={mockT} />
    )
    expect(queryByText('Field Notes')).toBeNull()
    expect(getByText('On the channel')).toBeDefined()
  })

  it('renders headline and subheadline', () => {
    const { getByText } = render(
      <SubscribePair newsletter={newsletter} locale="en" t={mockT} />
    )
    expect(getByText('two ways to follow')).toBeDefined()
    expect(getByText('Pick your channel')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/unit/home/subscribe-pair.test.tsx --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Create SubscribePair.tsx**

Create `apps/web/src/app/(public)/components/SubscribePair.tsx`:

```tsx
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { YOUTUBE_CHANNELS } from '../../../../lib/home/videos-data'
import type { HomeNewsletter } from '../../../../lib/home/types'

type Props = {
  newsletter: HomeNewsletter | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function SubscribePair({ newsletter, locale, t }: Props) {
  const isPt = locale === 'pt-BR'
  const hasNl = !!newsletter
  const channels = [YOUTUBE_CHANNELS[locale], YOUTUBE_CHANNELS[locale === 'en' ? 'pt-BR' : 'en']]
  const gridCols = hasNl ? 'md:grid-cols-2' : ''

  return (
    <section aria-labelledby="subscribe-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px' }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <p className="font-caveat" style={{ fontSize: 24, color: 'var(--pb-muted)', transform: 'rotate(-1deg)', display: 'inline-block' }}>
          {t['home.subscribe.headline']}
        </p>
        <h2 id="subscribe-heading" className="font-fraunces italic" style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--pb-ink)', marginTop: 6 }}>
          {t['home.subscribe.subheadline']}
        </h2>
      </div>

      <div className={`grid grid-cols-1 ${gridCols}`} style={{ gap: 40 }}>
        {hasNl && (
          <PaperCard index={30} variant="paper" className="p-6">
            <Tape variant="tape" className="-top-2 left-6" rotate={-5} />
            <Tape variant="tape2" className="-top-2 right-8" rotate={4} />
            <div style={{ transform: 'rotate(-0.6deg)' }}>
              <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: 'var(--pb-accent)' }}>
                {t['home.subscribe.nlKicker']}
              </span>
              <h3 className="font-fraunces italic" style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--pb-ink)', marginTop: 8, lineHeight: 1.05 }}>
                {t['home.subscribe.nlTitle']}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--pb-muted)', marginTop: 10, lineHeight: 1.55 }}>
                {t['home.subscribe.nlSubtitle']}
              </p>

              <form style={{ marginTop: 20 }}>
                <input type="hidden" name="newsletter_id" value={newsletter.id} />
                <input type="hidden" name="locale" value={locale} />
                <div className="flex gap-2">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder={t['newsletter.emailPlaceholder']}
                    className="flex-1 px-3 py-2 text-sm font-mono"
                    style={{
                      background: 'transparent',
                      color: 'var(--pb-ink)',
                      border: '1px dashed var(--pb-line)',
                    }}
                  />
                  <button
                    type="submit"
                    className="font-mono font-semibold text-sm px-4 py-2"
                    style={{ background: 'var(--pb-ink)', color: 'var(--pb-paper)' }}
                  >
                    {t['newsletter.submit']}
                  </button>
                </div>
              </form>

              <p className="font-caveat" style={{ fontSize: 18, color: 'var(--pb-faint)', marginTop: 16 }}>
                1.427 {t['home.subscribe.readers']} · 62% {t['home.subscribe.openRate']}
              </p>
            </div>
          </PaperCard>
        )}

        <PaperCard index={31} variant="paper" className="p-6">
          <Tape variant="tapeR" className="-top-2 left-6" rotate={-3} />
          <div style={{ transform: 'rotate(0.6deg)', border: '2px solid var(--pb-yt)', borderRadius: 2, padding: 20 }}>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.16em', fontWeight: 700, color: 'var(--pb-yt)' }}>
              {t['home.subscribe.ytKicker']}
            </span>
            <h3 className="font-fraunces italic" style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--pb-ink)', marginTop: 8, lineHeight: 1.05 }}>
              {t['home.subscribe.ytTitle']}
            </h3>
            <p style={{ fontSize: 14, color: 'var(--pb-muted)', marginTop: 10, lineHeight: 1.55 }}>
              {t['home.subscribe.ytSubtitle']}
            </p>

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {channels.map((ch) => (
                <div key={ch.locale} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--pb-yt)' }}
                    aria-hidden="true"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-semibold" style={{ color: 'var(--pb-ink)' }}>{ch.name}</p>
                    <p className="font-mono text-xs" style={{ color: 'var(--pb-faint)' }}>{ch.handle}</p>
                  </div>
                  <a
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs font-semibold px-3 py-1.5 shrink-0"
                    style={{ background: 'var(--pb-yt)', color: '#FFF', textDecoration: 'none' }}
                  >
                    {t['channels.subscribe']}
                  </a>
                </div>
              ))}
            </div>

            <p className="font-caveat" style={{ fontSize: 18, color: 'var(--pb-faint)', marginTop: 16 }}>
              {isPt ? 'quinta que vem: vídeos novos nos dois canais' : 'next thursday: new videos on both channels'}
            </p>
          </div>
        </PaperCard>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/subscribe-pair.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/SubscribePair.tsx apps/web/test/unit/home/subscribe-pair.test.tsx
git commit -m "feat(home): add SubscribePair component with newsletter + YouTube cards"
```

---

### Task 13: PinboardHome orchestrator — wire all sections together

**Files:**
- Modify: `apps/web/src/app/(public)/components/PinboardHome.tsx`
- Test: `apps/web/test/unit/home/pinboard-home.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/unit/home/pinboard-home.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'

describe('PinboardHome orchestration', () => {
  it('module exports PinboardHome function', async () => {
    const mod = await import('../../../src/app/(public)/components/PinboardHome')
    expect(typeof mod.PinboardHome).toBe('function')
  })
})
```

- [ ] **Step 2: Run test to verify current version still passes**

Run: `cd apps/web && npx vitest run test/unit/home/pinboard-home.test.tsx --reporter=verbose`
Expected: PASS (existing export)

- [ ] **Step 3: Rewrite PinboardHome.tsx**

Replace the full content of `apps/web/src/app/(public)/components/PinboardHome.tsx`:

```tsx
import { cookies } from 'next/headers'
import { DualHero } from './DualHero'
import { ChannelStrip } from './ChannelStrip'
import { BlogGrid } from './BlogGrid'
import { VideoGrid } from './VideoGrid'
import { MostReadSidebar } from './MostReadSidebar'
import { TagCategoryGrid } from './TagCategoryGrid'
import { SubscribePair } from './SubscribePair'
import { StatsStrip } from './StatsStrip'
import {
  getFeaturedPost,
  getLatestPosts,
  getNewslettersForLocale,
  getTopTags,
  getPostsByTag,
  getMostReadPosts,
  getPostCount,
} from '../../../../lib/home/queries'
import { SAMPLE_VIDEOS } from '../../../../lib/home/videos-data'
import enStrings from '../../../locales/en.json'
import ptBrStrings from '../../../locales/pt-BR.json'

const TRANSLATIONS: Record<'en' | 'pt-BR', Record<string, string>> = {
  en: enStrings as unknown as Record<string, string>,
  'pt-BR': ptBrStrings as unknown as Record<string, string>,
}

type Props = { locale: 'en' | 'pt-BR' }

export async function PinboardHome({ locale }: Props) {
  const cookieStore = await cookies()
  const isDark = cookieStore.get('btf_theme')?.value !== 'light'
  const t = TRANSLATIONS[locale]

  const [featuredPost, latestPosts, newsletters, topTags, mostReadPosts, postCount] = await Promise.all([
    getFeaturedPost(locale),
    getLatestPosts(locale, 7),
    getNewslettersForLocale(locale),
    getTopTags(locale, 4),
    getMostReadPosts(locale, 5),
    getPostCount(locale),
  ])

  const localeVideos = SAMPLE_VIDEOS.filter(v => v.locale === locale)
  const featuredVideo = localeVideos[0] ?? null
  const feedPosts = latestPosts.filter(p => p.id !== featuredPost?.id).slice(0, 6)
  const primaryNewsletter = newsletters[0] ?? null

  const tagGroups = await Promise.all(
    topTags.map(async (tag) => ({
      tag,
      posts: await getPostsByTag(locale, tag.id, 2),
    }))
  )
  const filteredTagGroups = tagGroups.filter(g => g.posts.length > 0)

  const showMostReadAndTags = mostReadPosts.length > 0 || filteredTagGroups.length > 0

  return (
    <main id="main-content">
      {/* Stats Strip */}
      <StatsStrip
        postCount={postCount}
        videoCount={localeVideos.length}
        subscriberCount={1427}
        t={t}
      />

      {/* §1 Dual Hero */}
      <div className="pb-section">
        <DualHero post={featuredPost} video={featuredVideo} locale={locale} t={t} />
      </div>

      {/* §2 Channel Strip */}
      <div className="pb-section">
        <ChannelStrip locale={locale} t={t} />
      </div>

      {/* §3 Blog Grid */}
      <div className="pb-section">
        <BlogGrid posts={feedPosts} locale={locale} t={t} isDark={isDark} />
      </div>

      {/* AD: Bookmark — renders nothing until admin connects */}
      {/* <BookmarkAd creative={null} locale={locale} /> */}

      {/* §4 Video Grid */}
      <div className="pb-section">
        <VideoGrid videos={localeVideos.slice(1)} locale={locale} t={t} />
      </div>

      {/* AD: Anchor — renders nothing until admin connects */}
      {/* <AnchorAd creative={null} locale={locale} /> */}

      {/* §5 Most Read + By Tag */}
      {showMostReadAndTags && (
        <div className="pb-section" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px' }}>
          <div
            className="grid grid-cols-1"
            style={{
              gap: 56,
              ...(filteredTagGroups.length > 0 && mostReadPosts.length > 0
                ? { gridTemplateColumns: '1fr 2fr' }
                : {}),
            }}
          >
            <MostReadSidebar posts={mostReadPosts} locale={locale} t={t} />
            <TagCategoryGrid tagGroups={filteredTagGroups} locale={locale} t={t} />
          </div>
        </div>
      )}

      {/* AD: Bowtie — renders nothing until admin connects */}
      {/* <CodaAd creative={null} locale={locale} /> */}

      {/* §6 Newsletter + YouTube Subscribe */}
      <div className="pb-section">
        <SubscribePair newsletter={primaryNewsletter} locale={locale} t={t} />
      </div>

      {/* §7 Footer is rendered in layout.tsx */}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/unit/home/pinboard-home.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/components/PinboardHome.tsx apps/web/test/unit/home/pinboard-home.test.tsx
git commit -m "refactor(home): PinboardHome orchestrates all 7 sections with data fetching"
```

---

### Task 14: Delete UnifiedFeed + NewsletterInline

**Files:**
- Delete: `apps/web/src/app/(public)/components/UnifiedFeed.tsx`
- Delete: `apps/web/src/app/(public)/components/NewsletterInline.tsx`

- [ ] **Step 1: Verify no remaining imports of UnifiedFeed or NewsletterInline**

Run: `grep -rn "UnifiedFeed\|NewsletterInline" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules`

After PinboardHome rewrite, there should be zero results. If any remain, update those files.

- [ ] **Step 2: Delete the files**

```bash
rm apps/web/src/app/\(public\)/components/UnifiedFeed.tsx
rm apps/web/src/app/\(public\)/components/NewsletterInline.tsx
```

- [ ] **Step 3: Run full test suite to verify nothing breaks**

Run: `cd apps/web && npx vitest run --reporter=verbose`
Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add -u apps/web/src/app/\(public\)/components/UnifiedFeed.tsx apps/web/src/app/\(public\)/components/NewsletterInline.tsx
git commit -m "chore(home): delete UnifiedFeed and NewsletterInline (replaced by BlogGrid + SubscribePair)"
```

---

### Task 15: CSS utility classes for sections

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add section/grid CSS classes**

At the end of `apps/web/src/app/globals.css` (before any `@media` block), add:

```css
/* ── Pinboard home section utilities ── */
@media (min-width: 1024px) {
  .pb-mostread-layout {
    grid-template-columns: 1fr 2fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pb-section [style*="transform"] {
    transform: none !important;
  }
  .pb-tape {
    display: none !important;
  }
}

@media (max-width: 767px) {
  .pb-section {
    padding-left: 18px !important;
    padding-right: 18px !important;
  }
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd apps/web && npx next build --no-lint 2>&1 | tail -5` (or just `npx tsc --noEmit`)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(home): add pinboard section CSS utilities and reduced-motion support"
```

---

### Task 16: Run full test suite and fix any failures

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && npx vitest run --reporter=verbose`

- [ ] **Step 2: Fix any failing tests**

If tests reference `UnifiedFeed`, `NewsletterInline`, `nav.writing`, or `HeaderCurrent = 'writing'`, update them to match the new code.

Common fixes:
- Any test importing `UnifiedFeed` → delete or rewrite for `BlogGrid`
- Any test checking `nav.writing` → change to `nav.blog`
- Any snapshot test → update snapshots with `npx vitest run --update`

- [ ] **Step 3: Run full suite again**

Run: `cd apps/web && npx vitest run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix(tests): update tests for pinboard home redesign changes"
```

---

### Task 17: Final integration verification

- [ ] **Step 1: TypeScript check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run full test suite one final time**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 3: Commit if any final adjustments**

Only if changes were needed.
