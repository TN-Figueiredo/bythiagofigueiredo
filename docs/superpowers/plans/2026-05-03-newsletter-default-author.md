# Newsletter Default Author Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the newsletter landing page author section dynamic from the `authors` DB table, with a migration-seeded default author and IDENTITY_PROFILES fallback.

**Architecture:** New migration seeds default author + adds `author_id` FK to `newsletter_types`. Landing page queries author via FK with 3-tier fallback (DB → IDENTITY_PROFILES → i18n). CMS Authors page gets default badge + delete protection + completeness warning.

**Tech Stack:** PostgreSQL (Supabase), Next.js 15 server components, unstable_cache, Vitest

---

## File Structure

### New files

| File | Purpose |
|---|---|
| `supabase/migrations/20260503000006_newsletter_author_fk.sql` | Migration: default author INSERT + `author_id` FK on `newsletter_types` + backfill |
| `apps/web/lib/newsletter/author-queries.ts` | `getAuthorByIdTagged` query helper with `unstable_cache` + per-author cache tag |
| `apps/web/test/unit/newsletter-author-fallback.test.ts` | Unit tests for author fallback chain logic |
| `apps/web/test/integration/newsletter-author-fk.test.ts` | DB-gated integration tests for migration correctness |

### Modified files

| File | Change |
|---|---|
| `apps/web/lib/newsletter/queries.ts` | Add `author_id` to `NewsletterType` interface + `getNewsletterTypeBySlug` select |
| `apps/web/lib/newsletter/cache-invalidation.ts` | Add `revalidateAuthor(authorId)` helper |
| `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` | Replace hardcoded author section with dynamic fallback chain |
| `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx` | Add completeness warning banner + delete protection for `isDefault` authors |
| `apps/web/src/app/cms/(authed)/authors/actions.ts` | Add `is_default` check in `deleteAuthor` + wire `revalidateTag` for author cache |
| `apps/web/test/cms/authors-connected.test.tsx` | Add tests for completeness warning + delete protection |
| `apps/web/test/cms/authors-actions.test.ts` | Add test for delete-default-author rejection |

---

## Task 1: Migration — default author INSERT + FK + backfill

### Step 1.1: Create migration file

- [ ] Run migration scaffold command:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase migration new newsletter_author_fk
```

This will create a timestamped file. Rename it to `20260503000006_newsletter_author_fk.sql` to follow the existing sequence (last migration is `20260503000005`).

- [ ] Write the migration content to `supabase/migrations/20260503000006_newsletter_author_fk.sql`:

```sql
-- Newsletter author FK: seed default author for bythiagofigueiredo + link newsletter_types
-- Follows idempotent patterns: ON CONFLICT DO NOTHING, ADD COLUMN IF NOT EXISTS, WHERE IS NULL guard.

-- 1. Insert default author for bythiagofigueiredo site (idempotent)
--    Uses real data from the current hardcoded IDENTITY_PROFILES + i18n strings.
--    ON CONFLICT on (site_id, slug) unique constraint ensures idempotency.
INSERT INTO public.authors (site_id, name, display_name, slug, bio, bio_md, avatar_url, is_default, sort_order)
SELECT
  s.id,
  'Thiago Figueiredo',
  'Thiago Figueiredo',
  'thiago',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  'I''ve built software for six years. Since 2024, only for myself: six apps cooking, a YouTube channel, a blog that became the center of everything.',
  '/identity/thiago.jpg',
  true,
  0
FROM public.sites s
WHERE s.slug = 'bythiagofigueiredo'
ON CONFLICT (site_id, slug) DO NOTHING;

-- 2. Add author_id FK to newsletter_types
ALTER TABLE public.newsletter_types
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.authors(id) ON DELETE SET NULL;

-- 3. Backfill: link all existing newsletter_types to the default author of the same site
--    Only touches rows where author_id IS NULL, safe to re-run.
UPDATE public.newsletter_types nt
SET author_id = a.id
FROM public.authors a
JOIN public.sites s ON a.site_id = s.id
WHERE s.slug = 'bythiagofigueiredo'
  AND a.is_default = true
  AND nt.author_id IS NULL;
```

### Step 1.2: Verify migration syntax

- [ ] Check the migration file is syntactically correct by examining it:

```bash
cat /Users/figueiredo/Workspace/bythiagofigueiredo/supabase/migrations/20260503000006_newsletter_author_fk.sql
```

Verify: 3 statements (INSERT, ALTER, UPDATE), all idempotent guards present.

---

## Task 2: Author query helper with unstable_cache

### Step 2.1: Define AuthorRecord type + getAuthorByIdTagged in queries module

- [ ] Create `apps/web/lib/newsletter/author-queries.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface AuthorRecord {
  id: string
  name: string
  display_name: string | null
  slug: string
  bio: string | null
  bio_md: string | null
  avatar_url: string | null
  social_links: Record<string, string> | null
  is_default: boolean
}

/**
 * Fetches author by ID and tags the cache entry with the specific author ID
 * so CMS edits can surgically invalidate it via `revalidateTag('author:${id}')`.
 *
 * This is the only query function needed — the per-author tag enables surgical
 * cache invalidation without a generic catch-all.
 */
export async function getAuthorByIdTagged(authorId: string): Promise<AuthorRecord | null> {
  const fn = unstable_cache(
    async (id: string): Promise<AuthorRecord | null> => {
      const supabase = getSupabaseServiceClient()
      const { data, error } = await supabase
        .from('authors')
        .select('id, name, display_name, slug, bio, bio_md, avatar_url, social_links, is_default')
        .eq('id', id)
        .single()

      if (error || !data) return null
      return data as AuthorRecord
    },
    ['author', authorId],
    {
      tags: [`author:${authorId}`],
      revalidate: 3600,
    },
  )
  return fn(authorId)
}
```

### Step 2.2: Add author_id to NewsletterType interface + select

- [ ] Edit `apps/web/lib/newsletter/queries.ts`:

In the `NewsletterType` interface, add `author_id`:

```typescript
// Add after the `site_id: string` line in the NewsletterType interface
author_id: string | null
```

In the `getNewsletterTypeBySlug` function, add `author_id` to the select string:

```typescript
// Change the select string to include author_id
'id, slug, locale, name, tagline, description, color, color_dark, badge, cadence_days, cadence_label, cadence_start_date, landing_content, og_image_url, active, site_id, updated_at, author_id'
```

### Step 2.3: Add vitest alias for author-queries

No change needed — `apps/web/vitest.config.ts` already has `{ find: /^@\/lib\/newsletter(.*)$/, replacement: path.resolve(__dirname, './lib/newsletter$1') }` which covers `@/lib/newsletter/author-queries`.

### Step 2.4: Add revalidateAuthor to cache-invalidation

- [ ] Edit `apps/web/lib/newsletter/cache-invalidation.ts` to add the author cache tag invalidation.

The file already imports `revalidateTag` and `revalidatePath` from `next/cache` and exports `revalidateNewsletterType`. Append the new `revalidateAuthor` function after the existing exports:

```typescript
// Append to the existing file — do NOT replace the existing revalidateNewsletterType function.
// The file already has: import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateAuthor(authorId: string): void {
  revalidateTag(`author:${authorId}`)
}
```

After this edit, the file should contain both `revalidateNewsletterType` (unchanged) and `revalidateAuthor` (new).

> **Note:** The cross-promotion plan (`2026-05-03-newsletter-cross-promotion.md`) also modifies this file. If implementing both plans, merge changes: add both `revalidateAuthor` (from this plan) and `revalidateNewsletterSuggestions` (from cross-promotion) as new exports, and add `revalidateTag('newsletter-suggestions')` to the existing `revalidateNewsletterType` body per the cross-promotion plan.

### Step 2.5: Run tests to confirm no breakage

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

All existing tests must pass. The `NewsletterType` interface change is additive (nullable field), so existing mocks still work.

---

## Task 3: Landing page — dynamic author with fallback chain

### Step 3.1: Write unit tests for author fallback chain

- [ ] Create `apps/web/test/unit/newsletter-author-fallback.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

/**
 * Tests the author fallback resolution logic extracted from the landing page.
 * This is a pure function test — no DB, no React, no mocks needed.
 */

interface AuthorRecord {
  id: string
  name: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  social_links: Record<string, string> | null
}

interface IdentityProfile {
  name: string
}

interface AuthorData {
  name: string
  bio: string
  avatarUrl: string
  socialLinks: Record<string, string>
}

/**
 * Resolves the author data for the landing page using a 3-tier fallback:
 * 1. DB author (via newsletter_types.author_id FK)
 * 2. IDENTITY_PROFILES static config
 * 3. i18n strings (hardcoded fallback)
 */
function resolveAuthorData(
  author: AuthorRecord | null,
  profile: IdentityProfile | null,
  i18nBio: string,
): AuthorData {
  // Tier 1: DB author with non-empty bio
  if (author?.bio) {
    return {
      name: author.display_name ?? author.name,
      bio: author.bio,
      avatarUrl: author.avatar_url ?? '/identity/thiago.jpg',
      socialLinks: author.social_links ?? {},
    }
  }

  // Tier 2 + 3: IDENTITY_PROFILES name or hardcoded, with i18n bio
  return {
    name: profile?.name ?? 'Thiago Figueiredo',
    bio: i18nBio,
    avatarUrl: '/identity/thiago.jpg',
    socialLinks: {},
  }
}

describe('resolveAuthorData', () => {
  const fullAuthor: AuthorRecord = {
    id: 'a1',
    name: 'Thiago Figueiredo',
    display_name: 'Thiago N. Figueiredo',
    bio: 'A developer building things.',
    avatar_url: '/identity/thiago.jpg',
    social_links: { twitter: 'https://twitter.com/tnfigueiredo' },
  }

  const profile: IdentityProfile = {
    name: 'Thiago Figueiredo',
  }

  const i18nBio = 'Fallback bio from i18n strings.'

  it('uses DB author when bio is present (tier 1)', () => {
    const result = resolveAuthorData(fullAuthor, profile, i18nBio)
    expect(result.name).toBe('Thiago N. Figueiredo')
    expect(result.bio).toBe('A developer building things.')
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
    expect(result.socialLinks).toEqual({ twitter: 'https://twitter.com/tnfigueiredo' })
  })

  it('prefers display_name over name from DB author', () => {
    const result = resolveAuthorData(fullAuthor, profile, i18nBio)
    expect(result.name).toBe('Thiago N. Figueiredo')
  })

  it('falls back to name when display_name is null', () => {
    const authorNoDisplay = { ...fullAuthor, display_name: null }
    const result = resolveAuthorData(authorNoDisplay, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
  })

  it('falls back to IDENTITY_PROFILES when author bio is null (tier 2)', () => {
    const authorNoBio = { ...fullAuthor, bio: null }
    const result = resolveAuthorData(authorNoBio, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
  })

  it('falls back to IDENTITY_PROFILES when author is null (tier 2)', () => {
    const result = resolveAuthorData(null, profile, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
    expect(result.socialLinks).toEqual({})
  })

  it('falls back to hardcoded name when both author and profile are null (tier 3)', () => {
    const result = resolveAuthorData(null, null, i18nBio)
    expect(result.name).toBe('Thiago Figueiredo')
    expect(result.bio).toBe(i18nBio)
  })

  it('uses default avatar when author avatar_url is null', () => {
    const authorNoAvatar = { ...fullAuthor, avatar_url: null }
    const result = resolveAuthorData(authorNoAvatar, profile, i18nBio)
    expect(result.avatarUrl).toBe('/identity/thiago.jpg')
  })

  it('uses empty socialLinks when author social_links is null', () => {
    const authorNoSocial = { ...fullAuthor, social_links: null }
    const result = resolveAuthorData(authorNoSocial, profile, i18nBio)
    expect(result.socialLinks).toEqual({})
  })

  it('falls back to i18n bio when author bio is empty string', () => {
    const authorEmptyBio = { ...fullAuthor, bio: '' }
    const result = resolveAuthorData(authorEmptyBio, profile, i18nBio)
    // Empty string is falsy, so falls to tier 2
    expect(result.bio).toBe(i18nBio)
  })
})
```

### Step 3.2: Run the fallback tests

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/unit/newsletter-author-fallback.test.ts
```

All 9 tests should pass (pure logic, no mocks needed).

### Step 3.3: Update the landing page to use dynamic author

- [ ] Edit `apps/web/src/app/(public)/newsletters/[slug]/page.tsx`:

**Import change** — add the author query import near the top (after existing newsletter imports):

```typescript
import { getAuthorByIdTagged } from '@/lib/newsletter/author-queries'
```

**Data fetching change** — replace lines 116-117 (the hardcoded author resolution) with the dynamic fallback chain. After the `Promise.all` block (~line 109), add:

```typescript
    // Dynamic author resolution with 3-tier fallback
    const author = type.author_id
      ? await getAuthorByIdTagged(type.author_id)
      : null

    const authorData = author?.bio
      ? {
          name: author.display_name ?? author.name,
          bio: author.bio,
          avatarUrl: author.avatar_url ?? '/identity/thiago.jpg',
          socialLinks: author.social_links ?? {},
        }
      : {
          name: profile?.name ?? 'Thiago Figueiredo',
          bio: t('newsletter.landing.authorBio'),
          avatarUrl: '/identity/thiago.jpg',
          socialLinks: {},
        }
```

Keep the existing `profile` and `authorName` lines (116-117) as they are still used by the fallback. But replace the `authorName` usage with `authorData.name`.

**Author section rendering change** — update lines ~598-701 (the author section) to use `authorData`:

Replace the Image `src` (line ~628):
```typescript
src={authorData.avatarUrl}
```

Replace the Image `alt` (line ~629):
```typescript
alt={authorData.name}
```

Replace the author name heading (line ~651):
```typescript
{authorData.name}
```

Replace the author bio paragraph (line ~673):
```typescript
{authorData.bio}
```

The `authorRole` i18n string (line ~662) remains unchanged — it stays i18n-sourced as the spec notes.

### Step 3.4: Run full test suite

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

All tests must pass.

---

## Task 4: CMS Authors — delete protection for default author

### Step 4.1: Write test for delete-default-author rejection

- [ ] Edit `apps/web/test/cms/authors-actions.test.ts` — add a new test in the `deleteAuthor` describe block.

**Context:** This test appends to the existing `describe('deleteAuthor', ...)` block which already has `mockSingle` and `mockLimit` defined via the Supabase client mock chain at the top of the file. The chain pattern is: `createClient` returns `{ from }` which returns `{ select }` → `{ eq }` → `{ eq }` → `{ single }` (assigned to `mockSingle`) and a parallel `{ limit }` (assigned to `mockLimit`). Each mock in the chain returns the next. The new `is_default` check adds an additional `.single()` call before the existing posts-check `.limit()` call, so the mock resolution order changes: `mockSingle` fires first for the author lookup, then `mockLimit` for the posts query.

```typescript
  it('rejects deleting default author', async () => {
    // mockSingle resolves the `.select('id, is_default').eq(...).single()` call
    mockSingle.mockResolvedValueOnce({
      data: { id: 'author-1', is_default: true },
      error: null,
    })
    const { deleteAuthor } = await import(
      '@/app/cms/(authed)/authors/actions'
    )
    const result = await deleteAuthor('author-1')
    expect(result.ok).toBe(false)
    expect((result as { ok: false; error: string }).error).toMatch(
      /default author/i,
    )
  })
```

### Step 4.2: Run the test to see it fail (TDD red)

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-actions.test.ts
```

The new test should fail because `deleteAuthor` does not yet check `is_default`.

### Step 4.3: Implement delete protection in actions.ts

- [ ] Edit `apps/web/src/app/cms/(authed)/authors/actions.ts` — in the `deleteAuthor` function, add an `is_default` check after the RBAC check but before the posts check:

Replace the existing `deleteAuthor` function body (lines 130-157) with:

```typescript
export async function deleteAuthor(id: string): Promise<ActionResult> {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Check if this is the default author — cannot be deleted
  const { data: authorRow } = await supabase
    .from('authors')
    .select('id, is_default')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (authorRow?.is_default) {
    return {
      ok: false,
      error: 'Default author cannot be deleted. Remove the default flag first.',
    }
  }

  // Check for posts assigned to this author
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('author_id', id)
    .eq('site_id', siteId)
    .limit(1)

  if (posts && posts.length > 0) {
    return {
      ok: false,
      error: 'Cannot delete author with assigned posts. Reassign posts first.',
    }
  }

  const { error } = await supabase
    .from('authors')
    .delete()
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/authors')
  return { ok: true }
}
```

### Step 4.4: Run tests again (TDD green)

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-actions.test.ts
```

All tests should pass now.

---

## Task 5: CMS Authors — completeness warning banner + UI delete protection

### Step 5.1: Write tests for completeness warning and delete button hiding

- [ ] Edit `apps/web/test/cms/authors-connected.test.tsx` — add new tests at the end of the describe block (before the closing `})`):

```typescript
  /* ---- Default author completeness warning ---- */

  it('shows completeness warning when default author has no bio', async () => {
    const authorsNoBio = [
      { ...mockAuthors[0], bio: null },
      mockAuthors[1],
      mockAuthors[2],
    ]
    await renderAuthors({ authors: authorsNoBio })
    expect(screen.getByTestId('default-author-warning')).toBeTruthy()
    expect(screen.getByText(/missing/i)).toBeTruthy()
  })

  it('shows completeness warning when default author has no avatar', async () => {
    const authorsNoAvatar = [
      { ...mockAuthors[0], avatarUrl: null },
      mockAuthors[1],
      mockAuthors[2],
    ]
    await renderAuthors({ authors: authorsNoAvatar })
    expect(screen.getByTestId('default-author-warning')).toBeTruthy()
  })

  it('does not show completeness warning when default author is complete', async () => {
    // mockAuthors[0] has bio and avatarUrl is null but avatarColor exists
    // For this test, give default author both bio and avatarUrl
    const completeAuthors = [
      { ...mockAuthors[0], bio: 'A bio', avatarUrl: 'https://example.com/avatar.jpg' },
      mockAuthors[1],
      mockAuthors[2],
    ]
    await renderAuthors({ authors: completeAuthors })
    expect(screen.queryByTestId('default-author-warning')).toBeNull()
  })

  /* ---- Default author delete protection in detail panel ---- */

  it('hides danger zone for default author in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a1')) // a1 is default
    expect(screen.queryByText('Danger Zone')).toBeNull()
  })

  it('shows danger zone for non-default author in detail panel', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a2')) // a2 is not default
    expect(screen.getByText('Danger Zone')).toBeTruthy()
  })
```

### Step 5.2: Run tests to see failures (TDD red)

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-connected.test.tsx
```

New tests should fail — the completeness warning and danger zone hiding for default authors are not yet implemented.

### Step 5.3: Add completeness warning banner to AuthorsConnected

- [ ] Edit `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`:

In the `AuthorsConnected` component, after the `counts` computation (around line 599-603) and before the return statement, add logic to find the default author and check completeness:

```typescript
  const defaultAuthor = authors.find((a) => a.isDefault)
  const defaultIncomplete = defaultAuthor
    ? !defaultAuthor.bio || !defaultAuthor.avatarUrl
    : false
  const missingFields: string[] = []
  if (defaultAuthor && !defaultAuthor.avatarUrl) missingFields.push('avatar')
  if (defaultAuthor && !defaultAuthor.bio) missingFields.push('bio')
```

In the JSX return, add the warning banner between the header area div and the create form section (after the closing `</div>` of the header area, before `{showCreate && (`):

```tsx
      {/* Default author completeness warning */}
      {defaultIncomplete && (
        <div
          data-testid="default-author-warning"
          className="mb-6 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4"
        >
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">
                Default author is missing {missingFields.join(' and ')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This may affect how your newsletters appear publicly.
              </p>
            </div>
          </div>
        </div>
      )}
```

### Step 5.4: Add delete protection for default author in DetailPanel

- [ ] Edit `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx`:

In the `DetailPanel` component, the danger zone section (lines ~424-465) already has `{!readOnly && (` wrapping the actions area. Inside that section, the danger zone div needs an additional guard to hide for default authors.

Replace the condition around the danger zone block. The current pattern shows the entire actions section when `!readOnly`. We need to additionally hide the danger zone when the author `isDefault`:

Change the danger zone section (the `<div className="rounded-md border border-red-900/50 ...">` block) to be wrapped with `!author.isDefault &&`:

```tsx
            {!author.isDefault && (
              /* Danger zone */
              <div className="rounded-md border border-red-900/50 bg-red-950/20 p-4">
                <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-2 text-sm text-red-400 hover:text-red-300"
                    data-testid="delete-author-btn"
                  >
                    Delete Author
                  </button>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-400">
                      {author.postsCount > 0
                        ? 'This author has assigned posts. Reassign them first.'
                        : 'This action cannot be undone.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(author.id)}
                        disabled={author.postsCount > 0}
                        className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                        data-testid="confirm-delete-btn"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
```

### Step 5.5: Run tests (TDD green)

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-connected.test.tsx
```

All tests should pass now, including new completeness warning and delete protection tests.

**Note:** Some existing tests may need adjustment:
- The test `'hides danger zone in detail panel when read-only'` (line ~361) clicks on `author-card-a1` which is `isDefault: true`. With our change, the danger zone is also hidden for default authors regardless of read-only mode. This test still passes since it expects `queryByText('Danger Zone')` to be null.
- The test `'shows delete button in detail panel'` (line ~240) clicks on `author-card-a2` which is NOT default, so it still sees the danger zone. Passes.
- The test `'disables confirm delete when author has posts'` (line ~265) clicks on `author-card-a1` which IS default. With our change, danger zone is hidden for default authors, so this test will FAIL. Fix: change it to use `author-card-a3` which has posts (2) and is NOT default.

- [ ] Fix the broken test in `apps/web/test/cms/authors-connected.test.tsx`:

Change the `'disables confirm delete when author has posts'` test to use a non-default author with posts. Update `mockAuthors[2]` (Bot Author) or create a scenario where a non-default author has posts. The simplest fix is to change the test to click on `author-card-a3` (Bot Author, has 2 posts, not default):

```typescript
  it('disables confirm delete when author has posts', async () => {
    await renderAuthors()
    fireEvent.click(screen.getByTestId('author-card-a3')) // has 2 posts, not default
    fireEvent.click(screen.getByTestId('delete-author-btn'))
    const confirmBtn = screen.getByTestId(
      'confirm-delete-btn',
    ) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)
    expect(
      screen.getByText(/reassign/i),
    ).toBeTruthy()
  })
```

### Step 5.6: Re-run full test suite

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-connected.test.tsx
```

All tests pass.

---

## Task 6: Cache invalidation — wire revalidateTag in CMS author save/delete actions

### Step 6.1: Wire revalidateTag in updateAuthor and deleteAuthor

- [ ] Edit `apps/web/src/app/cms/(authed)/authors/actions.ts`:

Add import at the top:

```typescript
import { revalidatePath } from 'next/cache'
import { revalidateAuthor } from '@/lib/newsletter/cache-invalidation'
```

Remove the existing `revalidatePath` import from `next/cache` (it's already there, just add `revalidateAuthor` import).

In `updateAuthor`, after the successful update (before `return { ok: true }`), add:

```typescript
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  return { ok: true }
```

Replace the existing `revalidatePath('/cms/authors')` + `return { ok: true }` block.

In `deleteAuthor`, after the successful delete (before `return { ok: true }`), add:

```typescript
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  return { ok: true }
```

Replace the existing `revalidatePath('/cms/authors')` + `return { ok: true }` block.

In `setDefaultAuthor`, after the successful update, add:

```typescript
  revalidateAuthor(id)
  revalidatePath('/cms/authors')
  return { ok: true }
```

### Step 6.2: Update mock in authors-actions test

- [ ] Edit `apps/web/test/cms/authors-actions.test.ts` — add `revalidateTag` to the `next/cache` mock (it may already be there from line 6):

```typescript
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))
```

Also add a mock for the cache-invalidation module:

```typescript
vi.mock('@/lib/newsletter/cache-invalidation', () => ({
  revalidateAuthor: vi.fn(),
}))
```

### Step 6.3: Run tests

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx vitest run apps/web/test/cms/authors-actions.test.ts
```

All tests pass.

---

## Task 7: Integration tests (DB-gated)

### Step 7.1: Create DB-gated integration test file

- [ ] Create `apps/web/test/integration/newsletter-author-fk.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { skipIfNoLocalDb } from '../helpers/db-skip'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

describe.skipIf(skipIfNoLocalDb())('newsletter_author_fk migration', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    })
  })

  it('default author exists for bythiagofigueiredo site', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    expect(site).toBeTruthy()

    const { data: author, error } = await db
      .from('authors')
      .select('id, name, display_name, slug, bio, avatar_url, is_default')
      .eq('site_id', site!.id)
      .eq('is_default', true)
      .single()

    expect(error).toBeNull()
    expect(author).toBeTruthy()
    expect(author!.name).toBe('Thiago Figueiredo')
    expect(author!.slug).toBe('thiago')
    expect(author!.bio).toContain('built software')
    expect(author!.avatar_url).toBe('/identity/thiago.jpg')
    expect(author!.is_default).toBe(true)
  })

  it('newsletter_types.author_id column exists', async () => {
    const { data, error } = await db
      .from('newsletter_types')
      .select('author_id')
      .limit(1)

    expect(error).toBeNull()
    expect(data).toBeDefined()
  })

  it('backfill linked newsletter_types to default author', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    if (!site) return // skip if no site

    const { data: types } = await db
      .from('newsletter_types')
      .select('id, author_id')
      .eq('site_id', site.id)

    if (!types || types.length === 0) return // skip if no types seeded

    // All types for this site should have author_id set (backfill ran)
    for (const t of types) {
      expect(t.author_id).toBeTruthy()
    }
  })

  it('ON DELETE SET NULL works — removing author nullifies FK', async () => {
    const { data: site } = await db
      .from('sites')
      .select('id')
      .eq('slug', 'bythiagofigueiredo')
      .single()

    if (!site) return

    // Create a temporary test author
    const { data: testAuthor, error: insertErr } = await db
      .from('authors')
      .insert({
        site_id: site.id,
        name: 'Test Delete Author',
        display_name: 'Test Delete Author',
        slug: 'test-delete-author-fk',
        bio: 'Temporary',
        is_default: false,
      })
      .select('id')
      .single()

    expect(insertErr).toBeNull()
    expect(testAuthor).toBeTruthy()

    // Create a temporary newsletter type pointing to this author
    const { data: testType, error: typeErr } = await db
      .from('newsletter_types')
      .insert({
        id: 'test-fk-cascade-type',
        locale: 'en',
        name: 'Test FK Cascade',
        color: '#000000',
        site_id: site.id,
        slug: 'test-fk-cascade',
        author_id: testAuthor!.id,
      })
      .select('id, author_id')
      .single()

    expect(typeErr).toBeNull()
    expect(testType!.author_id).toBe(testAuthor!.id)

    // Delete the author
    const { error: delErr } = await db
      .from('authors')
      .delete()
      .eq('id', testAuthor!.id)

    expect(delErr).toBeNull()

    // Verify newsletter type still exists but author_id is NULL
    const { data: updatedType } = await db
      .from('newsletter_types')
      .select('id, author_id')
      .eq('id', 'test-fk-cascade-type')
      .single()

    expect(updatedType).toBeTruthy()
    expect(updatedType!.author_id).toBeNull()

    // Cleanup
    await db.from('newsletter_types').delete().eq('id', 'test-fk-cascade-type')
  })
})
```

### Step 7.2: Run integration tests (if local DB is available)

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && HAS_LOCAL_DB=1 npx vitest run apps/web/test/integration/newsletter-author-fk.test.ts
```

If local DB is not running, the tests will skip automatically via `skipIfNoLocalDb()`.

---

## Task 8: Full test suite + commit

### Step 8.1: Run full web test suite

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

All tests must pass. Fix any failures before proceeding.

### Step 8.2: Verify no TypeScript errors

- [ ] Run:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx tsc --noEmit -p apps/web/tsconfig.json
```

### Step 8.3: Commit

- [ ] Stage and commit all changes:

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git add \
  supabase/migrations/20260503000006_newsletter_author_fk.sql \
  apps/web/lib/newsletter/author-queries.ts \
  apps/web/lib/newsletter/queries.ts \
  apps/web/lib/newsletter/cache-invalidation.ts \
  apps/web/src/app/\(public\)/newsletters/\[slug\]/page.tsx \
  apps/web/src/app/cms/\(authed\)/authors/authors-connected.tsx \
  apps/web/src/app/cms/\(authed\)/authors/actions.ts \
  apps/web/test/unit/newsletter-author-fallback.test.ts \
  apps/web/test/integration/newsletter-author-fk.test.ts \
  apps/web/test/cms/authors-connected.test.tsx \
  apps/web/test/cms/authors-actions.test.ts
```

```bash
git commit -m "feat(newsletter): dynamic author on landing page with DB fallback chain

Seeds default author via migration, adds author_id FK to newsletter_types,
replaces hardcoded author section with 3-tier fallback (DB -> IDENTITY_PROFILES -> i18n).
CMS authors page gains completeness warning banner and delete protection for default author."
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| Migration: default author INSERT with ON CONFLICT DO NOTHING | Task 1, Step 1.1 |
| Migration: `author_id` FK on `newsletter_types` with ON DELETE SET NULL | Task 1, Step 1.1 |
| Migration: backfill existing newsletter_types | Task 1, Step 1.1 |
| `getAuthorByIdTagged` with `unstable_cache` + per-author cache tag | Task 2, Step 2.1 |
| `author_id` added to `NewsletterType` interface + select | Task 2, Step 2.2 |
| Landing page 3-tier fallback chain (DB -> IDENTITY_PROFILES -> i18n) | Task 3, Steps 3.1-3.3 |
| Landing page: `authorData.name` replaces hardcoded | Task 3, Step 3.3 |
| Landing page: `authorData.bio` replaces i18n string | Task 3, Step 3.3 |
| Landing page: `authorData.avatarUrl` replaces hardcoded path | Task 3, Step 3.3 |
| `authorRole` i18n string remains unchanged | Task 3, Step 3.3 (noted) |
| CMS: Default badge on author card | Already implemented (line 157-159 of authors-connected.tsx) |
| CMS: Delete protection for default author (server-side) | Task 4, Steps 4.1-4.4 |
| CMS: Delete protection for default author (client-side) | Task 5, Steps 5.3-5.4 |
| CMS: Completeness warning banner | Task 5, Steps 5.1-5.3 |
| Cache invalidation: `revalidateTag('author:${id}')` on save | Task 6, Steps 6.1-6.3 |
| Cache invalidation: `revalidateTag('author:${id}')` on delete | Task 6, Steps 6.1-6.3 |
| Unit test: fallback chain branches | Task 3, Step 3.1 |
| Unit test: default badge rendering | Already covered (existing test line 164) |
| Unit test: delete button hidden for default | Task 5, Steps 5.1, 5.5 |
| Unit test: completeness warning | Task 5, Steps 5.1, 5.5 |
| Integration test: default author exists after migration | Task 7, Step 7.1 |
| Integration test: FK backfill | Task 7, Step 7.1 |
| Integration test: ON DELETE SET NULL | Task 7, Step 7.1 |
| IDENTITY_PROFILES not removed | Task 3, Step 3.3 (kept as fallback) |
| No new CMS pages needed | Confirmed — all changes are to existing files |
| `is_default` badge already in authors-connected.tsx | Verified at line 157-159 |
