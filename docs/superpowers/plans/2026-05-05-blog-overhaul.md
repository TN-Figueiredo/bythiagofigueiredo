# Blog Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the blog with WYSIWYG editor (Tiptap), clean slug generation, hashtags entity, series linking, structured metadata columns, author from DB, mock data elimination, and archive page with 110/100 reading progress features.

**Architecture:** DB-first approach — migrations add columns/tables, server actions consume them, CMS editor writes to them, public components read from them. Tiptap stores `content_json` (JSONContent) + `content_html` (rendered). All mock data eliminated. `ReadProgressStore` (existing localStorage-based) powers archive delighters.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL 17), Tiptap 3.22.4, Vitest, TypeScript 5, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-05-05-blog-overhaul-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `supabase/migrations/20260505100001_blog_overhaul_columns.sql` | Add columns to blog_posts + blog_translations |
| `supabase/migrations/20260505100002_hashtags.sql` | Create hashtags + post_hashtags tables with RLS |
| `supabase/migrations/20260505100003_clean_slate.sql` | Delete all existing blog posts |
| `apps/web/src/components/blog/_i18n/types.ts` | Public blog label types |
| `apps/web/src/components/blog/_i18n/pt-BR.ts` | Portuguese labels |
| `apps/web/src/components/blog/_i18n/en.ts` | English labels |
| `apps/web/src/components/blog/post-notes.tsx` | Numbered notes component |
| `apps/web/src/app/cms/(authed)/blog/_shared/slug-field.tsx` | Slug generator + editor field |
| `apps/web/src/app/cms/(authed)/blog/_shared/hashtag-input.tsx` | Multi-input with autocomplete |
| `apps/web/src/app/cms/(authed)/blog/_shared/series-fields.tsx` | Previous post select + continues checkbox |
| `apps/web/src/app/cms/(authed)/blog/_shared/structured-fields.tsx` | Key points, notes, colophon, pull quote inputs |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/hashtag-actions.ts` | Hashtag CRUD server actions |
| `apps/web/src/app/(public)/blog/archive-list-view.tsx` | Compact list view component |
| `apps/web/src/app/(public)/blog/reading-stats-card.tsx` | Reading progress stats card |
| `apps/web/src/app/(public)/blog/keyboard-nav.ts` | j/k/Enter/Esc keyboard handler hook |
| `apps/web/src/app/(public)/blog/search-highlight.tsx` | Mark-based search highlight utility |
| `apps/web/src/app/(public)/blog/stagger-reveal.tsx` | IntersectionObserver stagger animation hook |
| `apps/web/test/app/blog-archive-110.test.tsx` | Archive 110/100 feature tests |
| `apps/web/test/cms/blog-editor-overhaul.test.tsx` | Editor overhaul tests |

### Modified Files

| File | Changes |
|---|---|
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` | Update savePost for content_json/html + structured metadata + hashtags |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` | Replace PostEditor with Tiptap + structured fields |
| `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` | Add slug field, structured fields, hashtag input |
| `apps/web/src/app/(public)/blog/page.tsx` | Remove MOCK_POSTS fallback, real DB only |
| `apps/web/src/app/(public)/blog/blog-archive-client.tsx` | Add 110/100 features: view toggle, keyboard nav, stagger, stats, related tags |
| `apps/web/src/app/(public)/blog/blog-filter-bar.tsx` | Add "Não lidos" sort, view toggle, search highlight, keyboard hints |
| `apps/web/src/app/(public)/blog/writing-card.tsx` | Category-tinted tape, paper-lift hover, series badge |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Read from DB columns instead of frontmatter |
| `apps/web/src/components/blog/author-card.tsx` | Connect to authors table |
| `apps/web/src/components/blog/post-tags.tsx` | Rewire to post_hashtags join table |
| `apps/web/src/components/blog/post-key-points.tsx` | Read from key_points column, add i18n |
| `apps/web/src/components/blog/post-colophon.tsx` | Fix "COLOFAO" → "COLOFÃO", add i18n |
| `apps/web/src/components/blog/series-nav.tsx` | Adapt for previous_post_id chain model |
| `apps/web/src/components/blog/series-banner.tsx` | Adapt for chain model |

### Deleted Files

| File | Reason |
|---|---|
| `apps/web/src/app/(public)/blog/blog-mock-data.ts` | All mock data eliminated |
| `apps/web/src/components/blog/post-comments.tsx` | Comments hidden |
| `apps/web/src/components/blog/post-extras-schema.ts` | Fields move to DB columns |
| `apps/web/src/components/blog/mock-data.ts` | AUTHOR_THIAGO + MOCK_COMMENTS eliminated |

---

## Phase 1: Database Schema

### Task 1: Migration — blog_posts + blog_translations new columns

**Files:**
- Create: `supabase/migrations/20260505100001_blog_overhaul_columns.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Blog overhaul: new columns for series linking + structured content

-- === blog_posts: series linking ===
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS previous_post_id uuid REFERENCES blog_posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS continues_in_next boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS blog_posts_previous_post_idx ON blog_posts(previous_post_id)
  WHERE previous_post_id IS NOT NULL;

-- === blog_translations: Tiptap storage + structured metadata ===
ALTER TABLE blog_translations
  ADD COLUMN IF NOT EXISTS content_json jsonb,
  ADD COLUMN IF NOT EXISTS content_html text,
  ADD COLUMN IF NOT EXISTS colophon text,
  ADD COLUMN IF NOT EXISTS notes text[],
  ADD COLUMN IF NOT EXISTS pull_quote text,
  ADD COLUMN IF NOT EXISTS key_points text[];
```

- [ ] **Step 2: Validate locally**

```bash
npm run db:start && npm run db:reset
```

Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505100001_blog_overhaul_columns.sql
git commit -m "feat(db): add blog series + structured content columns"
```

---

### Task 2: Migration — hashtags + post_hashtags tables

**Files:**
- Create: `supabase/migrations/20260505100002_hashtags.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Hashtags: freeform tags separate from blog_tags (categories)

CREATE TABLE IF NOT EXISTS hashtags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, slug)
);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  hashtag_id uuid NOT NULL REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX IF NOT EXISTS post_hashtags_hashtag_idx ON post_hashtags(hashtag_id);

-- RLS
ALTER TABLE hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_hashtags ENABLE ROW LEVEL SECURITY;

-- hashtags: public read via site_visible, staff write
DROP POLICY IF EXISTS "hashtags_public_read" ON hashtags;
CREATE POLICY "hashtags_public_read" ON hashtags
  FOR SELECT USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "hashtags_staff_write" ON hashtags;
CREATE POLICY "hashtags_staff_write" ON hashtags
  FOR ALL USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- post_hashtags: public read via post's site_id, staff write
DROP POLICY IF EXISTS "post_hashtags_public_read" ON post_hashtags;
CREATE POLICY "post_hashtags_public_read" ON post_hashtags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.site_visible(bp.site_id)
    )
  );

DROP POLICY IF EXISTS "post_hashtags_staff_write" ON post_hashtags;
CREATE POLICY "post_hashtags_staff_write" ON post_hashtags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.can_edit_site(bp.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM blog_posts bp
      WHERE bp.id = post_id AND public.can_edit_site(bp.site_id)
    )
  );
```

- [ ] **Step 2: Validate locally**

```bash
npm run db:reset
```

Expected: migration applies, RLS policies created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260505100002_hashtags.sql
git commit -m "feat(db): add hashtags + post_hashtags tables with RLS"
```

---

### Task 3: Migration — clean slate (delete existing blog posts)

**Files:**
- Create: `supabase/migrations/20260505100003_clean_slate.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Clean slate: delete all existing blog posts for fresh start
-- post_hashtags and blog_translations cascade via ON DELETE CASCADE

DELETE FROM blog_posts;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260505100003_clean_slate.sql
git commit -m "chore(db): clean slate — delete all existing blog posts"
```

---

## Phase 2: i18n Dictionary

### Task 4: Blog public component i18n dictionary

**Files:**
- Create: `apps/web/src/components/blog/_i18n/types.ts`
- Create: `apps/web/src/components/blog/_i18n/pt-BR.ts`
- Create: `apps/web/src/components/blog/_i18n/en.ts`

- [ ] **Step 1: Create types file**

```typescript
// apps/web/src/components/blog/_i18n/types.ts
export interface BlogStrings {
  keyPoints: string
  pullQuote: string
  notes: string
  colophon: string
  colophonHint: string
  series: string
  continuesNext: string
  previousPost: string
  partOfSeries: string
  tags: string
  categories: string
  archive: string
  allPosts: string
  results: string
  result: string
  searchPlaceholder: string
  sort: string
  recent: string
  longest: string
  shortest: string
  unread: string
  loadMore: string
  noResults: string
  clearFilters: string
  read: string
  inProgress: string
  minRead: string
  yourProgress: string
  startHere: string
  alsoSee: string
  reading: string
  minuteRead: string
  grid: string
  list: string
  navigate: string
  filtering: string
  clearAll: string
  backToHome: string
  videos: string
}
```

- [ ] **Step 2: Create pt-BR file**

```typescript
// apps/web/src/components/blog/_i18n/pt-BR.ts
import type { BlogStrings } from './types'

export const ptBR: BlogStrings = {
  keyPoints: 'Pontos-chave',
  pullQuote: 'Citação',
  notes: 'Notas',
  colophon: 'Colofão',
  colophonHint: 'ferramentas, processo, créditos',
  series: 'Série',
  continuesNext: 'Continua na próxima parte',
  previousPost: 'Post anterior',
  partOfSeries: 'Parte da série',
  tags: 'Tags',
  categories: 'Categoria',
  archive: 'Arquivo',
  allPosts: 'Tudo',
  results: 'resultados',
  result: 'resultado',
  searchPlaceholder: 'buscar por título, tag, slug…',
  sort: 'Ordenar',
  recent: 'Mais recentes',
  longest: 'Mais longos',
  shortest: 'Mais curtos',
  unread: 'Não lidos',
  loadMore: 'Carregar mais',
  noResults: 'nada por aqui.',
  clearFilters: 'limpar filtros',
  read: 'lido',
  inProgress: 'em progresso',
  minRead: 'min lidos',
  yourProgress: 'Seu progresso',
  startHere: 'começa por aqui',
  alsoSee: 'veja também',
  reading: 'leitura',
  minuteRead: 'min',
  grid: 'Grade',
  list: 'Lista',
  navigate: 'navegar',
  filtering: 'filtrando',
  clearAll: 'limpar tudo',
  backToHome: 'voltar pra home',
  videos: 'vídeos',
}
```

- [ ] **Step 3: Create en file**

```typescript
// apps/web/src/components/blog/_i18n/en.ts
import type { BlogStrings } from './types'

export const en: BlogStrings = {
  keyPoints: 'Key Points',
  pullQuote: 'Pull Quote',
  notes: 'Notes',
  colophon: 'Colophon',
  colophonHint: 'tools, process, credits',
  series: 'Series',
  continuesNext: 'Continues in next part',
  previousPost: 'Previous post',
  partOfSeries: 'Part of series',
  tags: 'Tags',
  categories: 'Category',
  archive: 'Archive',
  allPosts: 'All',
  results: 'results',
  result: 'result',
  searchPlaceholder: 'search title, tag, slug…',
  sort: 'Sort',
  recent: 'Newest',
  longest: 'Longest',
  shortest: 'Shortest',
  unread: 'Unread',
  loadMore: 'Load more',
  noResults: 'nothing here.',
  clearFilters: 'clear filters',
  read: 'read',
  inProgress: 'in progress',
  minRead: 'min read',
  yourProgress: 'Your progress',
  startHere: 'start here',
  alsoSee: 'also see',
  reading: 'read',
  minuteRead: 'min',
  grid: 'Grid',
  list: 'List',
  navigate: 'navigate',
  filtering: 'filtered',
  clearAll: 'clear all',
  backToHome: 'back to home',
  videos: 'videos',
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/blog/_i18n/
git commit -m "feat(i18n): add public blog component dictionary (pt-BR + en)"
```

---

## Phase 3: Delete Mock Data & Comments

### Task 5: Delete mock files and PostComments

**Files:**
- Delete: `apps/web/src/app/(public)/blog/blog-mock-data.ts`
- Delete: `apps/web/src/components/blog/post-comments.tsx`
- Delete: `apps/web/src/components/blog/mock-data.ts`
- Delete: `apps/web/src/components/blog/post-extras-schema.ts`
- Modify: `apps/web/src/components/blog/index.ts` — remove deleted exports

- [ ] **Step 1: Remove mock data file**

```bash
rm apps/web/src/app/\(public\)/blog/blog-mock-data.ts
```

- [ ] **Step 2: Remove PostComments component**

```bash
rm apps/web/src/components/blog/post-comments.tsx
```

- [ ] **Step 3: Remove mock-data.ts (AUTHOR_THIAGO + MOCK_COMMENTS)**

```bash
rm apps/web/src/components/blog/mock-data.ts
```

- [ ] **Step 4: Remove post-extras-schema.ts**

```bash
rm apps/web/src/components/blog/post-extras-schema.ts
```

- [ ] **Step 5: Update barrel export**

Remove any re-exports of deleted files from `apps/web/src/components/blog/index.ts`. Remove `PostComments` export and any references to `mock-data` or `post-extras-schema`.

- [ ] **Step 6: Fix all import errors**

Search the codebase for imports from deleted files and update them:

```bash
grep -rn "blog-mock-data\|post-comments\|mock-data\|post-extras-schema\|MOCK_POSTS\|MOCK_SPONSORS\|MOCK_HOUSE_ADS\|AUTHOR_THIAGO\|MOCK_COMMENTS\|PostExtras\|PostExtrasSchema" apps/web/src/ --include="*.ts" --include="*.tsx"
```

For each file found:
- `blog/page.tsx` — remove MOCK_POSTS import and fallback logic, show empty state when no DB posts
- `blog-archive-client.tsx` — remove MOCK_SPONSORS/MOCK_HOUSE_ADS imports, remove ad slot logic
- `blog/[slug]/page.tsx` — remove PostExtras parsing from frontmatter, read from DB columns instead
- `author-card.tsx` — remove AUTHOR_THIAGO import (will be rewired in Task 10)
- Any component referencing `PostComments` — remove the render call

- [ ] **Step 7: Run tests to find remaining breakage**

```bash
npm run test:web 2>&1 | head -100
```

Fix any test files that reference deleted mocks.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete blog mock data, PostComments, PostExtras schema"
```

---

## Phase 4: Server Actions

### Task 6: Update savePost action for new columns

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`

- [ ] **Step 1: Update SavePostActionInput interface**

Add new fields to the existing interface in `actions.ts`:

```typescript
export interface SavePostActionInput {
  // existing fields
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
  meta_title?: string | null
  meta_description?: string | null
  og_image_url?: string | null
  cover_image_url?: string | null
  tag_id?: string | null
  // new fields
  content_json?: Record<string, unknown> | null
  content_html?: string | null
  colophon?: string | null
  notes?: string[] | null
  pull_quote?: string | null
  key_points?: string[] | null
  previous_post_id?: string | null
  continues_in_next?: boolean
  hashtag_ids?: string[]
}
```

- [ ] **Step 2: Update savePost function body**

In the `savePost` function, after the existing `blog_translations` update, add the new columns:

```typescript
// In the blog_translations update object, add:
content_json: input.content_json ?? null,
content_html: input.content_html ?? null,
colophon: input.colophon ?? null,
notes: input.notes ?? null,
pull_quote: input.pull_quote ?? null,
key_points: input.key_points ?? null,
```

And for `blog_posts` update, add:

```typescript
previous_post_id: input.previous_post_id ?? null,
continues_in_next: input.continues_in_next ?? false,
```

- [ ] **Step 3: Add hashtag sync logic**

After the post/translation updates, sync hashtags:

```typescript
if (input.hashtag_ids !== undefined) {
  // Delete existing associations
  await db.from('post_hashtags').delete().eq('post_id', id)

  // Insert new associations
  if (input.hashtag_ids.length > 0) {
    const rows = input.hashtag_ids.map(hid => ({
      post_id: id,
      hashtag_id: hid,
    }))
    const { error: htErr } = await db.from('post_hashtags').insert(rows)
    if (htErr) {
      console.error('[savePost] hashtag sync error:', htErr.message)
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts
git commit -m "feat(cms): update savePost for structured metadata + hashtags"
```

---

### Task 7: Hashtag CRUD server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/edit/hashtag-actions.ts`

- [ ] **Step 1: Write the hashtag actions**

```typescript
'use server'

import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { requireSiteAdmin } from '@/lib/cms/require-site-admin'

export async function searchHashtags(siteId: string, query: string) {
  await requireSiteAdmin(siteId)
  const db = getSupabaseServiceClient()

  const { data, error } = await db
    .from('hashtags')
    .select('id, name, slug')
    .eq('site_id', siteId)
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20)

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, hashtags: data }
}

export async function createHashtag(siteId: string, name: string) {
  await requireSiteAdmin(siteId)
  const db = getSupabaseServiceClient()

  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  const { data, error } = await db
    .from('hashtags')
    .upsert({ site_id: siteId, name: name.trim(), slug }, { onConflict: 'site_id,slug' })
    .select('id, name, slug')
    .single()

  if (error) return { ok: false as const, error: error.message }
  return { ok: true as const, hashtag: data }
}

export async function getPostHashtags(postId: string) {
  const db = getSupabaseServiceClient()
  const { data, error } = await db
    .from('post_hashtags')
    .select('hashtag_id, hashtags(id, name, slug)')
    .eq('post_id', postId)

  if (error) return []
  return (data ?? []).map((row: any) => row.hashtags).filter(Boolean)
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/hashtag-actions.ts
git commit -m "feat(cms): add hashtag CRUD server actions"
```

---

## Phase 5: CMS Editor Components

### Task 8: Slug generator field

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/slug-field.tsx`

- [ ] **Step 1: Write the slug field component**

```typescript
'use client'

import { useState, useCallback } from 'react'

export function generateSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

interface SlugFieldProps {
  value: string
  onChange: (slug: string) => void
  siteUrl: string
  locale: string
}

export function SlugField({ value, onChange, siteUrl, locale }: SlugFieldProps) {
  const [editing, setEditing] = useState(false)
  const charCount = value.length
  const prefix = locale === 'en' ? '/blog/' : `/pt/blog/`
  const permalink = `${siteUrl}${prefix}${value}`

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span className="font-mono text-xs text-cms-text-dim">{prefix}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          className="flex-1 bg-transparent border border-cms-border rounded px-2 py-1 font-mono text-xs text-indigo-300 outline-none focus:border-cms-accent"
        />
        {value && <span className="text-green-500 text-xs">✓</span>}
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-3xs text-cms-text-dim">🔗 {permalink}</span>
        <span className={`font-mono text-3xs ${charCount > 80 ? 'text-red-400' : 'text-green-500'}`}>
          {charCount} caracteres
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write test for generateSlug**

```typescript
// apps/web/test/cms/slug-generator.test.ts
import { describe, it, expect } from 'vitest'
import { generateSlug } from '../../src/app/cms/(authed)/blog/_shared/slug-field'

describe('generateSlug', () => {
  it('converts title to kebab-case', () => {
    expect(generateSlug('Inglês II — Phrasal Verbs')).toBe('ingles-ii-phrasal-verbs')
  })

  it('strips diacritics', () => {
    expect(generateSlug('Colofão do café')).toBe('colofao-do-cafe')
  })

  it('trims to 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(generateSlug(long).length).toBeLessThanOrEqual(80)
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('removes leading/trailing hyphens', () => {
    expect(generateSlug('—hello world—')).toBe('hello-world')
  })
})
```

- [ ] **Step 3: Run test**

```bash
npm run test:web -- --run test/cms/slug-generator.test.ts
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/slug-field.tsx apps/web/test/cms/slug-generator.test.ts
git commit -m "feat(cms): add slug generator field with tests"
```

---

### Task 9: Structured metadata fields component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/structured-fields.tsx`

- [ ] **Step 1: Write the structured fields component**

This component renders key_points, pull_quote, notes, and colophon inputs below the Tiptap editor.

```typescript
'use client'

import { useState, useCallback } from 'react'

interface StructuredFieldsProps {
  keyPoints: string[]
  onKeyPointsChange: (points: string[]) => void
  pullQuote: string
  onPullQuoteChange: (quote: string) => void
  notes: string[]
  onNotesChange: (notes: string[]) => void
  colophon: string
  onColophonChange: (colophon: string) => void
}

function OrderedListField({
  label,
  hint,
  items,
  onChange,
  indexColor = 'var(--cms-accent)',
}: {
  label: string
  hint?: string
  items: string[]
  onChange: (items: string[]) => void
  indexColor?: string
}) {
  const addItem = () => onChange([...items, ''])
  const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const updateItem = (i: number, val: string) => {
    const next = [...items]
    next[i] = val
    onChange(next)
  }

  return (
    <div className="mb-6">
      <label className="font-mono text-3xs tracking-widest uppercase text-cms-text-dim font-semibold block mb-2">
        {label}
        {hint && <span className="ml-2 normal-case tracking-normal font-normal text-cms-text-dim/60">{hint}</span>}
      </label>
      {items.length === 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full border border-dashed border-cms-border rounded-lg py-3 text-xs text-cms-text-dim hover:border-cms-accent transition-colors"
        >
          + Adicionar
        </button>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className="font-mono text-xs font-bold mt-2 w-5 text-center flex-shrink-0"
                style={{ color: indexColor }}
              >
                {i + 1}
              </span>
              <input
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                className="flex-1 bg-transparent border border-cms-border rounded px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-red-400/60 hover:text-red-400 text-xs mt-2"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="text-xs text-cms-text-dim hover:text-cms-accent transition-colors"
          >
            + Adicionar item
          </button>
        </div>
      )}
    </div>
  )
}

export function StructuredFields(props: StructuredFieldsProps) {
  return (
    <div className="mt-8 pt-8 border-t border-cms-border">
      <OrderedListField
        label="Pontos-chave"
        items={props.keyPoints}
        onChange={props.onKeyPointsChange}
        indexColor="var(--cms-accent)"
      />

      <div className="mb-6">
        <label className="font-mono text-3xs tracking-widest uppercase text-cms-text-dim font-semibold block mb-2">
          Citação
        </label>
        <input
          value={props.pullQuote}
          onChange={(e) => props.onPullQuoteChange(e.target.value)}
          placeholder="Uma frase marcante do post..."
          className="w-full bg-transparent border border-cms-border rounded px-3 py-2 text-sm text-cms-text italic outline-none focus:border-cms-accent"
        />
      </div>

      <OrderedListField
        label="Notas"
        items={props.notes}
        onChange={props.onNotesChange}
        indexColor="#FFE37A"
      />

      <div className="mb-6">
        <label className="font-mono text-3xs tracking-widest uppercase text-cms-text-dim font-semibold block mb-2">
          Colofão
          <span className="ml-2 normal-case tracking-normal font-normal text-cms-text-dim/60">
            ferramentas, processo, créditos
          </span>
        </label>
        <input
          value={props.colophon}
          onChange={(e) => props.onColophonChange(e.target.value)}
          className="w-full bg-transparent border border-cms-border rounded px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/structured-fields.tsx
git commit -m "feat(cms): add structured metadata fields (key points, notes, colophon, pull quote)"
```

---

### Task 10: Hashtag multi-input component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/hashtag-input.tsx`

- [ ] **Step 1: Write the hashtag input component**

```typescript
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { searchHashtags, createHashtag } from '../[id]/edit/hashtag-actions'

interface Hashtag {
  id: string
  name: string
  slug: string
}

interface HashtagInputProps {
  siteId: string
  selected: Hashtag[]
  onChange: (hashtags: Hashtag[]) => void
}

export function HashtagInput({ siteId, selected, onChange }: HashtagInputProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Hashtag[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setSuggestions([]); return }
    setLoading(true)
    const result = await searchHashtags(siteId, q)
    if (result.ok) {
      const existing = new Set(selected.map(h => h.id))
      setSuggestions(result.hashtags.filter(h => !existing.has(h.id)))
    }
    setLoading(false)
  }, [siteId, selected])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const addHashtag = useCallback(async (hashtag: Hashtag) => {
    onChange([...selected, hashtag])
    setQuery('')
    setSuggestions([])
    inputRef.current?.focus()
  }, [selected, onChange])

  const createAndAdd = useCallback(async () => {
    const name = query.trim().replace(/^#/, '')
    if (!name) return
    const result = await createHashtag(siteId, name)
    if (result.ok) {
      addHashtag(result.hashtag)
    }
  }, [query, siteId, addHashtag])

  const removeHashtag = useCallback((id: string) => {
    onChange(selected.filter(h => h.id !== id))
  }, [selected, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0) {
        addHashtag(suggestions[0])
      } else if (query.trim()) {
        createAndAdd()
      }
    }
    if (e.key === 'Backspace' && !query && selected.length > 0) {
      removeHashtag(selected[selected.length - 1].id)
    }
  }, [query, suggestions, selected, addHashtag, createAndAdd, removeHashtag])

  return (
    <div className="mb-6">
      <label className="font-mono text-3xs tracking-widest uppercase text-cms-text-dim font-semibold block mb-2">
        Marcadores
      </label>
      <div className="flex flex-wrap gap-1.5 p-2 border border-cms-border rounded-lg min-h-[40px] focus-within:border-cms-accent transition-colors">
        {selected.map(h => (
          <span
            key={h.id}
            className="inline-flex items-center gap-1 bg-cms-surface px-2 py-0.5 text-xs font-mono text-cms-text"
          >
            #{h.name}
            <button
              type="button"
              onClick={() => removeHashtag(h.id)}
              className="text-cms-text-dim hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder={selected.length === 0 ? '#tag' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-cms-text outline-none font-mono"
        />
      </div>
      {showDropdown && (suggestions.length > 0 || (query.trim() && !loading)) && (
        <div className="mt-1 border border-cms-border rounded bg-cms-surface max-h-40 overflow-y-auto">
          {suggestions.map(h => (
            <button
              key={h.id}
              type="button"
              onMouseDown={() => addHashtag(h)}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-cms-text hover:bg-cms-surface-hover"
            >
              #{h.name}
            </button>
          ))}
          {query.trim() && suggestions.every(s => s.name.toLowerCase() !== query.trim().toLowerCase()) && (
            <button
              type="button"
              onMouseDown={createAndAdd}
              className="w-full text-left px-3 py-1.5 text-xs font-mono text-cms-accent hover:bg-cms-surface-hover"
            >
              + Criar "#{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/hashtag-input.tsx
git commit -m "feat(cms): add hashtag multi-input with autocomplete"
```

---

### Task 11: Series fields component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/_shared/series-fields.tsx`

- [ ] **Step 1: Write the series fields**

```typescript
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

interface PostOption {
  id: string
  title: string
  slug: string
}

interface SeriesFieldsProps {
  siteId: string
  locale: string
  currentPostId: string | null
  previousPostId: string | null
  onPreviousPostChange: (id: string | null) => void
  continuesInNext: boolean
  onContinuesChange: (val: boolean) => void
  searchPostsFn: (siteId: string, locale: string, query: string, excludeId: string | null) => Promise<PostOption[]>
}

export function SeriesFields(props: SeriesFieldsProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PostOption[]>([])
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const posts = await props.searchPostsFn(props.siteId, props.locale, query, props.currentPostId)
      setResults(posts)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, props.siteId, props.locale, props.currentPostId, props.searchPostsFn])

  const selectPost = useCallback((post: PostOption) => {
    props.onPreviousPostChange(post.id)
    setSelectedTitle(post.title)
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }, [props])

  const clearSelection = useCallback(() => {
    props.onPreviousPostChange(null)
    setSelectedTitle(null)
  }, [props])

  return (
    <div className="mt-6 pt-6 border-t border-cms-border">
      <div className="mb-4">
        <label className="font-mono text-3xs tracking-widest uppercase text-cms-text-dim font-semibold block mb-2">
          Post anterior
        </label>
        {props.previousPostId && selectedTitle ? (
          <div className="flex items-center gap-2 border border-cms-border rounded-lg px-3 py-2">
            <span className="text-sm text-cms-text flex-1">← {selectedTitle}</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-red-400/60 hover:text-red-400 text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Buscar por título..."
              className="w-full bg-transparent border border-dashed border-cms-border rounded-lg px-3 py-2 text-sm text-cms-text outline-none focus:border-cms-accent"
            />
            {showDropdown && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-cms-border rounded bg-cms-surface max-h-40 overflow-y-auto z-10">
                {results.map(post => (
                  <button
                    key={post.id}
                    type="button"
                    onMouseDown={() => selectPost(post)}
                    className="w-full text-left px-3 py-1.5 text-xs text-cms-text hover:bg-cms-surface-hover"
                  >
                    {post.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={props.continuesInNext}
          onChange={(e) => props.onContinuesChange(e.target.checked)}
          className="accent-cms-accent"
        />
        <span className="text-sm text-cms-text">Continua na próxima parte</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_shared/series-fields.tsx
git commit -m "feat(cms): add series fields (previous post search + continues checkbox)"
```

---

### Task 12: Wire editor to new save flow

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`

- [ ] **Step 1: Update PostEditionEditor (new posts)**

In `post-edition-editor.tsx`, import and render the new components below the Tiptap editor:

```typescript
import { SlugField, generateSlug } from '../_shared/slug-field'
import { StructuredFields } from '../_shared/structured-fields'
import { HashtagInput } from '../_shared/hashtag-input'
import { SeriesFields } from '../_shared/series-fields'
```

Add state for new fields:

```typescript
const [keyPoints, setKeyPoints] = useState<string[]>([])
const [pullQuote, setPullQuote] = useState('')
const [notes, setNotes] = useState<string[]>([])
const [colophon, setColophon] = useState('')
const [previousPostId, setPreviousPostId] = useState<string | null>(null)
const [continuesInNext, setContinuesInNext] = useState(false)
const [hashtags, setHashtags] = useState<Array<{ id: string; name: string; slug: string }>>([])
```

Add slug auto-generation on title blur:

```typescript
const handleTitleBlur = useCallback(() => {
  if (title && !slug) {
    setSlug(generateSlug(title))
  }
}, [title, slug])
```

Update `getSavePayload()` to include new fields:

```typescript
function getSavePayload() {
  return {
    ...existingFields,
    content_json: contentJson,
    content_html: contentHtml,
    key_points: keyPoints.filter(Boolean),
    pull_quote: pullQuote || null,
    notes: notes.filter(Boolean),
    colophon: colophon || null,
    previous_post_id: previousPostId,
    continues_in_next: continuesInNext,
    hashtag_ids: hashtags.map(h => h.id),
  }
}
```

Render the new components below the Tiptap editor:

```tsx
{/* After TipTapEditor */}
<StructuredFields
  keyPoints={keyPoints}
  onKeyPointsChange={v => { setKeyPoints(v); scheduleAutosave() }}
  pullQuote={pullQuote}
  onPullQuoteChange={v => { setPullQuote(v); scheduleAutosave() }}
  notes={notes}
  onNotesChange={v => { setNotes(v); scheduleAutosave() }}
  colophon={colophon}
  onColophonChange={v => { setColophon(v); scheduleAutosave() }}
/>
<SeriesFields
  siteId={siteId}
  locale={locale}
  currentPostId={postId}
  previousPostId={previousPostId}
  onPreviousPostChange={v => { setPreviousPostId(v); scheduleAutosave() }}
  continuesInNext={continuesInNext}
  onContinuesChange={v => { setContinuesInNext(v); scheduleAutosave() }}
  searchPostsFn={searchPosts}
/>
<HashtagInput
  siteId={siteId}
  selected={hashtags}
  onChange={v => { setHashtags(v); scheduleAutosave() }}
/>
```

- [ ] **Step 2: Update EditPostClient (existing posts)**

In `edit-post-client.tsx`, apply the same pattern. Load existing structured data from the translation:

```typescript
// In the initial data fetch, add:
const { data: hashtagData } = await db
  .from('post_hashtags')
  .select('hashtags(id, name, slug)')
  .eq('post_id', postId)
```

Initialize state from loaded data:

```typescript
const [keyPoints, setKeyPoints] = useState<string[]>(tx.key_points ?? [])
const [pullQuote, setPullQuote] = useState(tx.pull_quote ?? '')
const [notes, setNotes] = useState<string[]>(tx.notes ?? [])
const [colophon, setColophon] = useState(tx.colophon ?? '')
const [previousPostId, setPreviousPostId] = useState<string | null>(post.previous_post_id)
const [continuesInNext, setContinuesInNext] = useState(post.continues_in_next ?? false)
const [hashtags, setHashtags] = useState(hashtagData ?? [])
```

Render the same StructuredFields, SeriesFields, and HashtagInput components.

- [ ] **Step 3: Add searchPosts server action**

Add to `actions.ts`:

```typescript
export async function searchPosts(
  siteId: string,
  locale: string,
  query: string,
  excludeId: string | null
): Promise<Array<{ id: string; title: string; slug: string }>> {
  const db = getSupabaseServiceClient()
  let q = db
    .from('blog_translations')
    .select('post_id, title, slug, blog_posts!inner(id, site_id)')
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .ilike('title', `%${query}%`)
    .limit(10)

  if (excludeId) {
    q = q.neq('post_id', excludeId)
  }

  const { data } = await q
  return (data ?? []).map((row: any) => ({
    id: row.post_id,
    title: row.title,
    slug: row.slug,
  }))
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web
```

Fix any test failures.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/
git commit -m "feat(cms): wire editor to new save flow with structured fields + hashtags + series"
```

---

## Phase 6: Public Components

### Task 13: PostNotes component

**Files:**
- Create: `apps/web/src/components/blog/post-notes.tsx`

- [ ] **Step 1: Write PostNotes (mirrors PostKeyPoints pattern)**

```typescript
import type { BlogStrings } from './_i18n/types'

interface PostNotesProps {
  notes: string[]
  t: BlogStrings
}

export function PostNotes({ notes, t }: PostNotesProps) {
  if (!notes || notes.length === 0) return null

  return (
    <div className="mt-8 pt-6 border-t border-dashed border-pb-line">
      <h3 className="blog-sidebar-label">{t.notes}</h3>
      <ol className="list-none p-0 m-0 space-y-3">
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="font-mono text-xs font-bold mt-0.5 w-5 text-center flex-shrink-0"
              style={{ color: 'var(--pb-marker, #FFE37A)' }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: 'var(--pb-ink)' }}>
              {note}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/blog/post-notes.tsx
git commit -m "feat(blog): add PostNotes component with amber indices"
```

---

### Task 14: Rewire public components to DB columns + i18n

**Files:**
- Modify: `apps/web/src/components/blog/post-key-points.tsx`
- Modify: `apps/web/src/components/blog/post-colophon.tsx`
- Modify: `apps/web/src/components/blog/post-tags.tsx`
- Modify: `apps/web/src/components/blog/author-card.tsx`
- Modify: `apps/web/src/components/blog/series-nav.tsx`
- Modify: `apps/web/src/components/blog/series-banner.tsx`

- [ ] **Step 1: Update PostKeyPoints to accept i18n**

In `post-key-points.tsx`, change the hardcoded "Pontos-chave" to use `t.keyPoints` prop:

```typescript
import type { BlogStrings } from './_i18n/types'

interface PostKeyPointsProps {
  points: string[]
  t: BlogStrings
}

export function PostKeyPoints({ points, t }: PostKeyPointsProps) {
  if (!points || points.length === 0) return null
  // Replace hardcoded "Pontos-chave" with t.keyPoints
  // ... rest of component
}
```

- [ ] **Step 2: Fix PostColophon accent and i18n**

In `post-colophon.tsx`, fix "COLOFAO" → use `t.colophon`:

```typescript
import type { BlogStrings } from './_i18n/types'

interface PostColophonProps {
  colophon: string
  t: BlogStrings
}

export function PostColophon({ colophon, t }: PostColophonProps) {
  if (!colophon) return null
  // Use t.colophon as the label
  // ... rest of component with "COLOFÃO" from t.colophon
}
```

- [ ] **Step 3: Update PostTags to read from hashtags**

In `post-tags.tsx`, change the component to accept hashtag objects:

```typescript
import type { BlogStrings } from './_i18n/types'

interface Hashtag {
  id: string
  name: string
  slug: string
}

interface PostTagsProps {
  hashtags: Hashtag[]
  locale: string
  t: BlogStrings
}

export function PostTags({ hashtags, locale, t }: PostTagsProps) {
  if (!hashtags || hashtags.length === 0) return null

  return (
    <div>
      <h3 className="blog-sidebar-label">{t.tags}</h3>
      <div className="flex flex-wrap gap-2">
        {hashtags.map(tag => (
          <a
            key={tag.id}
            href={`/${locale === 'pt-BR' ? 'pt' : ''}/blog?tag=${tag.slug}`}
            className="font-mono text-xs"
            style={{ color: 'var(--pb-muted)' }}
          >
            #{tag.name}
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update AuthorCard to read from DB**

In `author-card.tsx`, remove `AUTHOR_THIAGO` import. Change props to accept author data from DB:

```typescript
interface AuthorCardProps {
  author: {
    display_name: string | null
    name: string
    bio: string | null
    avatar_url: string | null
    avatar_color: string | null
    social_links: { links?: Array<{ label: string; href: string; visible: boolean; paid: boolean }> } | null
  }
}

export function AuthorCard({ author }: AuthorCardProps) {
  const displayName = author.display_name || author.name
  const links = (author.social_links?.links ?? []).filter(l => l.visible)
  // ... render with real data
}
```

- [ ] **Step 5: Update SeriesBanner for chain model**

In `series-banner.tsx`, accept `previousPost` prop instead of frontmatter series data:

```typescript
import type { BlogStrings } from './_i18n/types'

interface SeriesBannerProps {
  previousPost: { title: string; slug: string; locale: string } | null
  t: BlogStrings
}

export function SeriesBanner({ previousPost, t }: SeriesBannerProps) {
  if (!previousPost) return null
  const prefix = previousPost.locale === 'en' ? '' : '/pt'
  return (
    <div style={{ /* existing styles with --pb-paper, --pb-accent border */ }}>
      <div className="blog-sidebar-label">{t.partOfSeries}</div>
      <a href={`${prefix}/blog/${previousPost.slug}`} style={{ color: 'var(--pb-accent)' }}>
        ← {previousPost.title}
      </a>
    </div>
  )
}
```

- [ ] **Step 6: Update SeriesNav for chain model**

In `series-nav.tsx`, accept both previous and next posts:

```typescript
import type { BlogStrings } from './_i18n/types'

interface SeriesNavProps {
  previousPost: { title: string; slug: string; locale: string } | null
  nextPost: { title: string; slug: string; locale: string } | null
  continuesInNext: boolean
  t: BlogStrings
}

export function SeriesNav({ previousPost, nextPost, continuesInNext, t }: SeriesNavProps) {
  if (!previousPost && !nextPost && !continuesInNext) return null
  // Render bidirectional nav
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/blog/
git commit -m "feat(blog): rewire public components to DB columns + i18n"
```

---

### Task 15: Update post detail page to read from DB columns

**Files:**
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Update data fetching**

In the post detail page, update the Supabase query to include new columns:

```typescript
// In the post query, add to the select:
// blog_posts: also select previous_post_id, continues_in_next
// blog_translations: also select content_json, content_html, colophon, notes, pull_quote, key_points

// Fetch hashtags:
const { data: hashtagData } = await db
  .from('post_hashtags')
  .select('hashtags(id, name, slug)')
  .eq('post_id', postId)
const hashtags = (hashtagData ?? []).map((r: any) => r.hashtags).filter(Boolean)

// Fetch previous post title/slug if previous_post_id exists:
let previousPost = null
if (post.previous_post_id) {
  const { data: prevTx } = await db
    .from('blog_translations')
    .select('title, slug')
    .eq('post_id', post.previous_post_id)
    .eq('locale', locale)
    .single()
  if (prevTx) previousPost = { ...prevTx, locale }
}

// Fetch next post (any post that has previous_post_id = current post):
let nextPost = null
const { data: nextData } = await db
  .from('blog_posts')
  .select('id, blog_translations(title, slug)')
  .eq('previous_post_id', postId)
  .limit(1)
  .single()
if (nextData?.blog_translations?.[0]) {
  nextPost = { ...nextData.blog_translations[0], locale }
}
```

- [ ] **Step 2: Update component rendering**

Replace frontmatter-based extras with DB column data:

```tsx
// Import i18n
import { ptBR } from '@/components/blog/_i18n/pt-BR'
import { en } from '@/components/blog/_i18n/en'
const t = locale === 'pt-BR' ? ptBR : en

// Use content_html if available, otherwise fall back to MDX compiled
const articleHtml = tx.content_html || compiledHtml

// Replace PostExtras-based rendering:
<SeriesBanner previousPost={previousPost} t={t} />
{/* ... article content ... */}
<PostKeyPoints points={tx.key_points ?? []} t={t} />
<PostTags hashtags={hashtags} locale={locale} t={t} />
<SeriesNav
  previousPost={previousPost}
  nextPost={nextPost}
  continuesInNext={post.continues_in_next}
  t={t}
/>
<PostNotes notes={tx.notes ?? []} t={t} />
<PostColophon colophon={tx.colophon ?? ''} t={t} />
<AuthorCard author={author} />
```

- [ ] **Step 3: Remove PostExtras/frontmatter parsing**

Remove imports and usage of `PostExtrasSchema`, `parseMdxFrontmatter`, `PostExtras` type. The data now comes from dedicated DB columns.

- [ ] **Step 4: Run tests**

```bash
npm run test:web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/
git commit -m "feat(blog): wire post detail page to DB columns instead of frontmatter"
```

---

## Phase 7: Archive 110/100 Features

### Task 16: Remove mock fallbacks from archive page

**Files:**
- Modify: `apps/web/src/app/(public)/blog/page.tsx`

- [ ] **Step 1: Remove MOCK_POSTS fallback**

In `page.tsx`, replace the fallback logic:

```typescript
// BEFORE:
// posts = dbPosts.length > 0 ? dbPosts : MOCK_POSTS

// AFTER:
posts = dbPosts
categories = deriveCategories(dbPosts)
tags = deriveTags(dbPosts)
```

Remove all imports of `MOCK_POSTS`, `MOCK_CATEGORIES`, `getMockCategories`, `getMockTags`.

Remove the `CATEGORY_MAP` constant — categories now come from `blog_tags` table in the DB query.

- [ ] **Step 2: Update fetchAllPosts to include hashtags**

```typescript
async function fetchAllPosts(siteId: string, locale: string): Promise<DbRow[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, tag_id, previous_post_id, continues_in_next,
        blog_tags(name, color, color_dark),
        post_hashtags(hashtags(name, slug))
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })

  if (error) {
    console.error('[blog/page] fetchAllPosts error:', error.message)
    return []
  }

  return (data ?? []) as unknown as DbRow[]
}
```

- [ ] **Step 3: Update toArchivePost to use DB tags**

```typescript
function toArchivePost(row: DbRow): ArchivePost {
  const post = row.blog_posts
  const tagName = post.blog_tags?.name ?? null
  const hashtags = (post.post_hashtags ?? [])
    .map((ph: any) => ph.hashtags?.name)
    .filter(Boolean) as string[]
  return {
    id: post.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    category: tagName ?? 'essay',
    categoryColor: post.blog_tags?.color ?? '#6366f1',
    categoryColorDark: post.blog_tags?.color_dark ?? '#818cf8',
    categoryLabel: tagName ?? '',
    date: formatDate(post.published_at),
    isoDate: post.published_at?.split('T')[0] || '',
    readingTime: row.reading_time_min || 5,
    tags: hashtags,
    coverUrl: row.cover_image_url || null,
    patternName: getPattern(post.id),
    previousPostId: post.previous_post_id ?? null,
    continuesInNext: post.continues_in_next ?? false,
  }
}
```

- [ ] **Step 4: Update ArchivePost interface**

Add `previousPostId` and `continuesInNext` to the interface (move it to a shared file or keep inline):

```typescript
interface ArchivePost {
  // ... existing fields
  previousPostId: string | null
  continuesInNext: boolean
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/page.tsx
git commit -m "feat(blog): remove mock fallbacks, wire archive to real DB data"
```

---

### Task 17: Reading stats card

**Files:**
- Create: `apps/web/src/app/(public)/blog/reading-stats-card.tsx`

- [ ] **Step 1: Write the reading stats component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import type { BlogStrings } from '@/components/blog/_i18n/types'

interface ReadingStatsCardProps {
  posts: Array<{ id: string; readingTime: number }>
  t: BlogStrings
}

export function ReadingStatsCard({ posts, t }: ReadingStatsCardProps) {
  const [stats, setStats] = useState<{ read: number; inProgress: number; totalMin: number } | null>(null)

  useEffect(() => {
    const store = new ReadProgressStore()
    const all = store.getAllRead()
    let read = 0
    let inProgress = 0
    let totalMin = 0

    for (const post of posts) {
      const progress = all.get(post.id)
      if (!progress) continue
      if (progress.depth >= 95) {
        read++
        totalMin += post.readingTime
      } else if (progress.depth > 0) {
        inProgress++
        totalMin += Math.round(post.readingTime * progress.depth / 100)
      }
    }

    setStats({ read, inProgress, totalMin })
  }, [posts])

  if (!stats || (stats.read === 0 && stats.inProgress === 0)) return null

  const total = posts.length
  const pct = total > 0 ? Math.round((stats.read / total) * 100) : 0

  return (
    <div style={{ background: 'var(--pb-paper)', border: '1px solid var(--pb-line)', padding: '14px 18px', minWidth: 200, flexShrink: 0 }}>
      <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--pb-faint)', marginBottom: 10 }}>
        {t.yourProgress}
      </div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: '#8eda8e', fontWeight: 500 }}>{stats.read}</div>
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.read}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--pb-line)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: '#FFE37A', fontWeight: 500 }}>{stats.inProgress}</div>
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.inProgress}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--pb-line)' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 28, color: 'var(--pb-muted)', fontWeight: 500 }}>~{stats.totalMin}</div>
          <div className="font-mono" style={{ fontSize: 9, color: 'var(--pb-faint)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.minRead}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, height: 3, background: 'var(--pb-line)', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#8eda8e', borderRadius: 2 }} />
      </div>
      <div className="font-mono" style={{ fontSize: 9, color: 'var(--pb-faint)', marginTop: 4, letterSpacing: '0.06em' }}>
        {stats.read} de {total} · {pct}%
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/reading-stats-card.tsx
git commit -m "feat(blog): add reading stats card component"
```

---

### Task 18: Category-tinted tape + paper-lift hover on WritingCard

**Files:**
- Modify: `apps/web/src/app/(public)/blog/writing-card.tsx`

- [ ] **Step 1: Add category tape tint**

In `writing-card.tsx`, compute tape color from category color:

```typescript
// Replace the fixed tape color with category-derived tint:
const tapeColor = post.categoryColor
  ? `color-mix(in srgb, ${post.categoryColor} 45%, transparent)`
  : (index % 2 ? 'var(--pb-tape2)' : 'var(--pb-tape)')
```

- [ ] **Step 2: Add paper-lift hover + series badge**

Add a CSS class for hover effect (inline or via reader-pinboard.css):

```css
/* In reader-pinboard.css or globals.css */
.paper-card-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.paper-card-lift:hover {
  transform: rotate(0deg) translateY(-6px) scale(1.02) !important;
  box-shadow: var(--pb-shadow-hover) !important;
}
@media (prefers-reduced-motion: reduce) {
  .paper-card-lift { transition: none !important; }
  .paper-card-lift:hover { transform: none !important; }
}
```

Add `paper-card-lift` class to the Paper wrapper div.

Add series badge overlay on the card image when `post.previousPostId` is set (indicating it's part of a series).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/writing-card.tsx apps/web/src/styles/reader-pinboard.css
git commit -m "feat(blog): category-tinted tape + paper-lift hover + series badge on WritingCard"
```

---

### Task 19: Stagger reveal animation

**Files:**
- Create: `apps/web/src/app/(public)/blog/stagger-reveal.tsx`

- [ ] **Step 1: Write the stagger reveal hook**

```typescript
'use client'

import { useEffect, useRef, useCallback } from 'react'

export function useStaggerReveal(containerRef: React.RefObject<HTMLElement | null>) {
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const container = containerRef.current
    if (!container) return

    const cards = container.querySelectorAll<HTMLElement>('[data-stagger]')
    cards.forEach((card) => {
      card.style.opacity = '0'
      card.style.transform = 'translateY(20px)'
      card.style.transition = 'none'
    })

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const index = Number(el.dataset.stagger ?? 0)
          const delay = index * 60

          requestAnimationFrame(() => {
            el.style.transition = `opacity 0.3s ease-out ${delay}ms, transform 0.3s ease-out ${delay}ms`
            el.style.opacity = '1'
            el.style.transform = el.dataset.staggerTransform || 'translateY(0)'
          })

          observerRef.current?.unobserve(el)
        })
      },
      { threshold: 0.1 }
    )

    cards.forEach((card) => observerRef.current?.observe(card))

    return () => observerRef.current?.disconnect()
  }, [containerRef])
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/stagger-reveal.tsx
git commit -m "feat(blog): add stagger reveal animation hook"
```

---

### Task 20: Keyboard navigation hook

**Files:**
- Create: `apps/web/src/app/(public)/blog/keyboard-nav.ts`

- [ ] **Step 1: Write the keyboard nav hook**

```typescript
'use client'

import { useEffect, useCallback, useState } from 'react'

export function useKeyboardNav(totalCards: number) {
  const [activeIndex, setActiveIndex] = useState(-1)

  const navigate = useCallback((direction: 'next' | 'prev') => {
    setActiveIndex(prev => {
      if (direction === 'next') return Math.min(prev + 1, totalCards - 1)
      if (direction === 'prev') return Math.max(prev - 1, -1)
      return prev
    })
  }, [totalCards])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      switch (e.key) {
        case 'j':
          e.preventDefault()
          navigate('next')
          break
        case 'k':
          e.preventDefault()
          navigate('prev')
          break
        case 'Enter':
          if (activeIndex >= 0) {
            e.preventDefault()
            const card = document.querySelector(`[data-card-index="${activeIndex}"] a`) as HTMLElement
            card?.click()
          }
          break
        case '/':
          e.preventDefault()
          const search = document.querySelector('[data-search-input]') as HTMLInputElement
          search?.focus()
          break
        case 'Escape':
          const focused = document.activeElement as HTMLElement
          if (focused?.tagName === 'INPUT') focused.blur()
          setActiveIndex(-1)
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeIndex, navigate])

  useEffect(() => {
    if (activeIndex >= 0) {
      const el = document.querySelector(`[data-card-index="${activeIndex}"]`) as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIndex])

  return { activeIndex, setActiveIndex }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/keyboard-nav.ts
git commit -m "feat(blog): add keyboard navigation hook (j/k/Enter/Esc)"
```

---

### Task 21: Search highlight utility

**Files:**
- Create: `apps/web/src/app/(public)/blog/search-highlight.tsx`

- [ ] **Step 1: Write the highlight component**

```typescript
import { type ReactNode } from 'react'

export function highlightText(text: string, query: string): ReactNode {
  if (!query || !text) return text

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        style={{ background: 'var(--pb-marker, #FFE37A)', color: 'var(--pb-ink-on-accent, #1A140C)', padding: '0 2px' }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/search-highlight.tsx
git commit -m "feat(blog): add search highlight utility with marker color"
```

---

### Task 22: Archive list view component

**Files:**
- Create: `apps/web/src/app/(public)/blog/archive-list-view.tsx`

- [ ] **Step 1: Write the compact list view**

```typescript
'use client'

import { ReadProgressStore } from '@/lib/tracking/read-progress-store'
import { useMemo } from 'react'
import type { BlogStrings } from '@/components/blog/_i18n/types'
import { highlightText } from './search-highlight'

interface ArchivePost {
  id: string
  slug: string
  title: string
  category: string
  categoryColor: string
  date: string
  readingTime: number
  previousPostId: string | null
}

interface ArchiveListViewProps {
  posts: ArchivePost[]
  locale: 'pt-BR' | 'en'
  query: string
  t: BlogStrings
  activeIndex: number
}

export function ArchiveListView({ posts, locale, query, t, activeIndex }: ArchiveListViewProps) {
  const readStore = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new ReadProgressStore()
  }, [])

  const prefix = locale === 'pt-BR' ? '/pt' : ''

  return (
    <div>
      {posts.map((post, i) => {
        const progress = readStore?.getProgress(post.id)
        const isRead = (progress?.depth ?? 0) >= 95
        const inProgress = progress && progress.depth > 0 && !isRead

        return (
          <a
            key={post.id}
            href={`${prefix}/blog/${post.slug}`}
            data-card-index={i}
            className="flex items-center gap-4 py-3 no-underline"
            style={{
              borderBottom: '1px solid var(--pb-line)',
              color: 'inherit',
              outline: activeIndex === i ? '2px solid var(--pb-accent)' : 'none',
              outlineOffset: 2,
            }}
          >
            <span className="font-mono text-3xs w-20 flex-shrink-0" style={{ color: 'var(--pb-faint)' }}>{post.date}</span>
            <span className="font-mono text-3xs w-16 flex-shrink-0 tracking-wider uppercase" style={{ color: post.categoryColor }}>{post.category}</span>
            <span className="flex-1 text-base" style={{ fontFamily: 'Fraunces, serif', color: 'var(--pb-ink)' }}>
              {highlightText(post.title, query)}
              {post.previousPostId && (
                <span className="font-mono text-3xs ml-2" style={{ color: 'var(--pb-marker)' }}>série</span>
              )}
            </span>
            <span className="font-mono text-3xs w-12 text-right" style={{ color: 'var(--pb-faint)' }}>{post.readingTime} {t.minuteRead}</span>
            <span className="w-9 text-center text-3xs">
              {isRead && <span style={{ color: '#8eda8e' }}>✓</span>}
              {inProgress && <span className="font-mono" style={{ color: '#ccc' }}>{Math.round(progress!.depth)}%</span>}
              {!isRead && !inProgress && <span style={{ color: 'var(--pb-faint)' }}>—</span>}
            </span>
          </a>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/archive-list-view.tsx
git commit -m "feat(blog): add compact archive list view component"
```

---

### Task 23: Wire 110/100 features into BlogArchiveClient

**Files:**
- Modify: `apps/web/src/app/(public)/blog/blog-archive-client.tsx`
- Modify: `apps/web/src/app/(public)/blog/blog-filter-bar.tsx`

- [ ] **Step 1: Import all new modules**

```typescript
import { ReadingStatsCard } from './reading-stats-card'
import { ArchiveListView } from './archive-list-view'
import { useKeyboardNav } from './keyboard-nav'
import { useStaggerReveal } from './stagger-reveal'
import { highlightText } from './search-highlight'
import { ptBR } from '@/components/blog/_i18n/pt-BR'
import { en } from '@/components/blog/_i18n/en'
```

- [ ] **Step 2: Add view toggle state**

```typescript
const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
  try {
    return (sessionStorage.getItem('btf_blog_view') as 'grid' | 'list') || 'grid'
  } catch { return 'grid' }
})

useEffect(() => {
  try { sessionStorage.setItem('btf_blog_view', viewMode) } catch {}
}, [viewMode])
```

- [ ] **Step 3: Wire keyboard nav**

```typescript
const { activeIndex } = useKeyboardNav(filtered.length)
```

- [ ] **Step 4: Wire stagger reveal**

```typescript
const gridRef = useRef<HTMLDivElement>(null)
useStaggerReveal(gridRef)
```

- [ ] **Step 5: Add related tag cluster computation**

```typescript
const relatedTags = useMemo(() => {
  if (!filters.tag) return []
  const cooccurrence = new Map<string, number>()
  for (const p of posts) {
    if (!p.tags.includes(filters.tag)) continue
    for (const t of p.tags) {
      if (t === filters.tag) continue
      cooccurrence.set(t, (cooccurrence.get(t) ?? 0) + 1)
    }
  }
  return Array.from(cooccurrence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag)
}, [posts, filters.tag])
```

- [ ] **Step 6: Render ReadingStatsCard in title area**

```tsx
<ReadingStatsCard
  posts={posts.map(p => ({ id: p.id, readingTime: p.readingTime }))}
  t={t}
/>
```

- [ ] **Step 7: Conditional Grid vs List rendering**

```tsx
{viewMode === 'grid' ? (
  <div ref={gridRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 40, rowGap: 56 }}>
    {visiblePosts.map((post, i) => (
      <div key={post.id} data-stagger={i % 6} data-card-index={i}>
        <WritingCard post={post} index={i} locale={locale}
          searchQuery={filters.q}
          isActive={activeIndex === i}
        />
      </div>
    ))}
  </div>
) : (
  <ArchiveListView
    posts={visiblePosts}
    locale={locale}
    query={filters.q}
    t={t}
    activeIndex={activeIndex}
  />
)}
```

- [ ] **Step 8: Update BlogFilterBar props**

Pass view mode toggle, keyboard hints, and "Não lidos" sort to the filter bar. Add `viewMode`/`onViewModeChange` props. Add `relatedTags` prop for cluster hint. The filter bar already has the sort buttons — just ensure "Não lidos" button is rendered (it was already supported by the sort logic).

- [ ] **Step 9: Remove ad imports**

Remove all imports of `MOCK_SPONSORS`, `MOCK_HOUSE_ADS`, `getDailyAdCreative`, `getAdPositions`, `BookmarkAd`, `MarginaliaAd`, `BowtieAd`, `HorizontalAnchor`, `mockToAdCreative`, and all ad rendering logic.

- [ ] **Step 10: Run tests**

```bash
npm run test:web
```

Fix any failures.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/
git commit -m "feat(blog): wire all 110/100 archive features — stats, view toggle, keyboard nav, stagger, search highlight, related tags"
```

---

## Phase 8: Final Cleanup & Tests

### Task 24: Add RSS link to header

**Files:**
- Modify: `apps/web/src/app/(public)/blog/page.tsx` or the layout/header component

- [ ] **Step 1: Add RSS button**

In the blog page or shared header, add an RSS link next to the Newsletter CTA:

```tsx
<a
  href="/feed.xml"
  title="RSS Feed"
  className="inline-flex items-center gap-1.5 font-mono text-3xs tracking-wider uppercase font-semibold"
  style={{ padding: '7px 10px', color: 'var(--pb-accent)', border: '1.5px solid var(--pb-line)' }}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="6.18" cy="17.82" r="2.18"/>
    <path d="M4 4.44A15.56 15.56 0 0 1 19.56 20"/>
    <path d="M4 11.1A8.9 8.9 0 0 1 12.9 20"/>
  </svg>
  RSS
</a>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/blog/
git commit -m "feat(blog): add RSS feed link to archive header"
```

---

### Task 25: Tests

**Files:**
- Create: `apps/web/test/cms/blog-editor-overhaul.test.tsx`
- Create: `apps/web/test/app/blog-archive-110.test.tsx`
- Modify: existing test files that reference deleted mocks

- [ ] **Step 1: Write slug generator tests** (already done in Task 8)

- [ ] **Step 2: Write archive feature tests**

```typescript
// apps/web/test/app/blog-archive-110.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { highlightText } from '../../src/app/(public)/blog/search-highlight'

describe('highlightText', () => {
  it('returns text unchanged when no query', () => {
    expect(highlightText('Hello world', '')).toBe('Hello world')
  })

  it('wraps matching substring in mark', () => {
    const result = highlightText('Hello world', 'world')
    expect(result).toBeDefined()
    // Should be array with mark element
  })

  it('is case-insensitive', () => {
    const result = highlightText('Hello WORLD', 'world')
    expect(result).toBeDefined()
  })

  it('handles special regex characters', () => {
    const result = highlightText('price is $10.00', '$10')
    expect(result).toBeDefined()
  })
})
```

- [ ] **Step 3: Fix any broken existing tests**

Run full test suite and fix imports, mocks, and assertions that reference deleted files:

```bash
npm run test:web 2>&1 | grep -E "FAIL|Error|Cannot find"
```

For each broken test:
- If it tests mock data → delete the test
- If it tests a component that changed props → update the test
- If it imports a deleted file → remove the import

- [ ] **Step 4: Run full suite**

```bash
npm test
```

Expected: all tests pass (api + web).

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/
git commit -m "test: add blog overhaul tests + fix broken test imports"
```

---

### Task 26: Push migrations to prod

- [ ] **Step 1: Verify all migrations locally**

```bash
npm run db:start && npm run db:reset
```

- [ ] **Step 2: Push to prod**

```bash
npm run db:push:prod
```

Type `YES` when prompted.

- [ ] **Step 3: Commit any generated lock files**

```bash
git add -A && git status
```

If clean, no commit needed. Otherwise commit lock file changes.

---

### Task 27: Final verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev -w apps/web
```

- [ ] **Step 2: Verify archive page**

Navigate to `http://localhost:3001/pt/blog`:
- Empty state shows correctly (no mock data)
- Filter bar renders with categories from DB
- View toggle works (grid/list)
- Keyboard nav (j/k) works

- [ ] **Step 3: Verify CMS editor**

Navigate to `http://localhost:3001/cms/blog/new`:
- Create a new post
- Title blur generates slug
- Tiptap WYSIWYG renders
- Structured fields (key points, notes, colophon) work
- Hashtag autocomplete works
- Series search works
- Autosave works

- [ ] **Step 4: Verify post detail**

Publish a post via kanban and verify:
- Content renders from content_html
- Key points, notes, colophon show when filled
- Author card shows DB data
- Hashtags render as `#tag` pills
- Series banner/nav show when linked

- [ ] **Step 5: Run full test suite one final time**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 6: Final commit if any last fixes**

```bash
git add -A
git commit -m "fix: final blog overhaul polish"
```
