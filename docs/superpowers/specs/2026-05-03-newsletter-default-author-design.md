# Newsletter Default Author — Design Spec

**Date:** 2026-05-03
**Score:** 98/100
**Status:** Approved
**Scope:** Dynamic author on newsletter landing pages, seeded via migration, editable via CMS.

---

## 1. Problem

The "Who writes this" section on newsletter landing pages (`/newsletters/[slug]`) is entirely hardcoded — name from `IDENTITY_PROFILES['bythiagofigueiredo']`, bio from i18n strings (`newsletter.landing.authorBio`), avatar from the static file `/identity/thiago.jpg`. The CMS has a fully functional Authors page at `/cms/authors` (with CRUD, RBAC, and the `authors` table supporting `display_name`, `bio`, `avatar_url`, `social_links`, `is_default`, etc.) but it shows 0 authors in production because no prod seed exists. If the author info needs to change — a new bio, a new photo, a corrected name — it requires a code deploy instead of a CMS edit.

The `newsletter_types` table has no `author_id` FK, so there is no way to link a newsletter to its author at the data level. The dev seed creates a default author, but prod has none.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Default author creation | Migration-level INSERT (not seed) | Always exists from first deploy; no manual setup needed; idempotent via `ON CONFLICT DO NOTHING` |
| Default author data | Real data from current hardcoded values | `name: 'Thiago Figueiredo'`, bio from i18n EN string, avatar `/identity/thiago.jpg`; avoids "First Last" placeholder appearing publicly |
| New sites default author | CMS forces edit before publish | Future sites get `name: 'First Last'` placeholder; CMS shows warning until bio/avatar filled |
| FK relationship | `newsletter_types.author_id` -> `authors.id` | Simple 1:1; multi-author is a future follow-up via junction table if needed |
| Landing page data source | DB first, IDENTITY_PROFILES fallback | Query author via FK; if `author_id IS NULL` or author has no bio, fall back to `IDENTITY_PROFILES`; protects against incomplete data showing publicly |
| CMS default author protection | Badge + non-deletable | `is_default = true` author shows "Default" badge in CMS; delete button hidden/disabled; can edit all fields |
| Author completeness | Warning, not blocking | CMS shows yellow warning if default author missing `avatar_url` or `bio`; does not block publishing |

---

## 3. Schema Changes

### 3.1 New column on `newsletter_types`

| Column | Type | Constraint | Default | Purpose |
|---|---|---|---|---|
| `author_id` | `uuid` | FK -> `authors(id)` ON DELETE SET NULL | NULL | Links newsletter type to its author |

### 3.2 Migration: default author + FK

Migration name: `YYYYMMDD_newsletter_author_fk.sql`

The migration follows the project's idempotent pattern (see CLAUDE.md: "always prefix `create policy` with `drop policy if exists`"; use `ADD COLUMN IF NOT EXISTS`; use `ON CONFLICT DO NOTHING` for inserts).

```sql
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
--    This wires up the 8 existing newsletter types (4 EN + 4 PT-BR) to the default author.
UPDATE public.newsletter_types nt
SET author_id = a.id
FROM public.authors a
JOIN public.sites s ON a.site_id = s.id
WHERE s.slug = 'bythiagofigueiredo'
  AND a.is_default = true
  AND nt.author_id IS NULL;
```

**Notes:**
- Step 1 uses the `authors_site_slug_unique` constraint (created in `20260501100000_authors_overhaul.sql`) for `ON CONFLICT`.
- Step 2 uses `ADD COLUMN IF NOT EXISTS` for idempotency.
- Step 3 only touches rows where `author_id IS NULL`, safe to re-run.
- `ON DELETE SET NULL` means if the author row is deleted, the newsletter type gracefully falls back to the `IDENTITY_PROFILES` chain (author_id becomes NULL, landing page uses fallback).

---

## 4. Landing Page Changes

### 4.1 Data fetching (server component)

In `apps/web/src/app/(public)/newsletters/[slug]/page.tsx`, after fetching the newsletter type by slug (line ~116), also fetch the linked author:

```typescript
// Current: hardcoded
const profile = IDENTITY_PROFILES['bythiagofigueiredo']
const authorName = profile?.name ?? 'Thiago Figueiredo'

// New: dynamic with fallback
const author = newsletterType.author_id 
  ? await getAuthorById(newsletterType.author_id)
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

The `getAuthorById` query should use `unstable_cache` with tag `['author:${authorId}']` for cache invalidation (see Section 6).

### 4.2 Author section rendering

Replace hardcoded values with the `authorData` object. The section structure stays the same — same Fraunces heading, same layout, same avatar positioning. Only the data source changes.

Fields consumed:
- `authorData.name` -> h3 heading (currently `{authorName}` at line ~651)
- `authorData.bio` -> paragraph text (currently `{t('newsletter.landing.authorBio')}` at line ~673)
- `authorData.avatarUrl` -> `<Image src={...}>` (currently hardcoded `/identity/thiago.jpg` at line ~628)
- `authorData.socialLinks` -> optional links section (future enhancement; not rendered in this iteration)

The `authorRole` i18n string (line ~662, "Indie dev, Brazil" / "Dev indie, BH") remains i18n-sourced for now. The `authors` table has no `role` or `title` column, and adding one is out of scope. This can be revisited when the author profile page is built.

### 4.3 IDENTITY_PROFILES fallback chain

The fallback chain ensures the landing page never shows empty or broken author data:

1. Try `authors` table via `newsletter_types.author_id` FK
2. If `author_id IS NULL` or author `bio` is empty -> fall back to `IDENTITY_PROFILES[siteSlug]`
3. If `IDENTITY_PROFILES` does not have the site -> fall back to i18n strings (current behavior)

This protects against: empty author data showing publicly, migration not yet run, new site without configured author.

---

## 5. CMS Changes

### 5.1 Authors page enhancements

The CMS Authors page (`/cms/authors`) already exists with full CRUD. The `author-card.tsx` component already renders author cards. Additions:

- **Default badge**: Author with `is_default = true` shows a "Default" badge next to the name (styled like the existing "main" badge on newsletter types — small pill, muted background, monospace font).
- **Delete protection**: Default author's delete button is hidden; tooltip explains "Default author cannot be deleted". Enforced client-side (button hidden) and server-side (delete action checks `is_default` and returns error).
- **Completeness warning**: If the default author has `avatar_url IS NULL` or `bio IS NULL`, show a yellow banner at the top of the Authors page: "Default author is missing [avatar/bio]. This may affect how your newsletters appear publicly."

### 5.2 No new CMS pages needed

The existing Authors CRUD at `/cms/authors` handles create/edit/delete. The author edit form already supports all fields (`name`, `display_name`, `bio`, `avatar_url`, `social_links`). No new UI is needed.

---

## 6. Cache Invalidation

| Event | Action |
|---|---|
| Author updated via CMS | `revalidateTag('author:${authorId}')` in the save action |
| Author deleted (non-default) | `revalidateTag('author:${authorId}')` — landing page falls back to `IDENTITY_PROFILES` |
| Newsletter type author_id changed | `revalidateTag('newsletter-type:${typeId}')` + `revalidateTag('author:${newAuthorId}')` |

Landing page fetches the author with `unstable_cache` keyed by `['author', authorId]`, tagged `['author:${authorId}']`. This ensures CMS edits (new bio, new avatar) reflect on the public landing page without a full redeploy or cache TTL wait.

---

## 7. Files Changed

| File | Change |
|---|---|
| `supabase/migrations/YYYYMMDD_newsletter_author_fk.sql` | New migration: default author INSERT + `author_id` FK on `newsletter_types` + backfill |
| `apps/web/src/app/(public)/newsletters/[slug]/page.tsx` | Author section: DB query with `IDENTITY_PROFILES` fallback chain |
| `apps/web/src/app/cms/(authed)/authors/_components/author-card.tsx` | Default badge + delete protection |
| `apps/web/src/app/cms/(authed)/authors/page.tsx` | Completeness warning banner for default author |

---

## 8. What Does NOT Change

- **`IDENTITY_PROFILES`** in `lib/seo/identity-profiles.ts` — kept as fallback, not removed. Still consumed by SEO JSON-LD `Person` node and OG metadata.
- **Authors table schema** — no new columns. `is_default`, `display_name`, `bio`, `avatar_url`, `social_links`, `sort_order` all exist from `20260501100000_authors_overhaul.sql`.
- **CMS Authors CRUD flow** — create/edit/delete already work. Only visual additions (badge, warning).
- **i18n strings** for `authorRole`, `authorBio`, `authorMore`, `authorNow` — kept as tertiary fallback and for the role line (no DB equivalent yet).
- **SEO JSON-LD Person node** — still uses `IDENTITY_PROFILES` for now. Separate concern, separate spec.
- **`newsletter_types` table PK** — remains `text` (e.g. `'main-en'`); no structural change.

---

## 9. Testing

### Unit tests
- **Author fallback chain**: mock `getAuthorById` returning full author, returning author with null bio, returning null. Assert the correct branch of the fallback chain is used in each case.
- **Default badge rendering**: `author-card.tsx` renders "Default" badge when `is_default = true`, hides delete button.

### Integration tests (DB-gated)
- **Default author exists after migration**: query `authors` where `site_id` matches `bythiagofigueiredo` and `is_default = true`. Assert row exists with expected `name`, `slug`, `bio`, `avatar_url`.
- **FK backfill**: query `newsletter_types` where `author_id IS NOT NULL`. Assert all 8 seeded types are linked.
- **ON DELETE SET NULL**: delete the author row, assert `newsletter_types.author_id` is NULL (not cascaded).

### CMS tests
- Default author badge renders in author card.
- Delete button hidden for default author.
- Completeness warning shows when `avatar_url` or `bio` is null.

---

## 10. Follow-ups (out of scope)

- **Multi-author support** via junction table `newsletter_type_authors` (needed when a newsletter has guest authors or rotating writers).
- **SEO JSON-LD Person node** consuming `authors` table instead of `IDENTITY_PROFILES` (separate spec, depends on identity-profiles refactor).
- **Author social links rendering** on the landing page (the data will be available via `authorData.socialLinks` but not rendered in this iteration).
- **Portuguese bio** for PT-BR locale — currently the migration seeds English-only bio. A follow-up could add locale-aware bio (either a `bio_locale` column or a `bio_translations` jsonb pattern).
- **Author role/title column** on `authors` table — would replace the i18n `authorRole` string with DB-sourced data.
- **Newsletter type editor** — CMS UI for changing `author_id` on a newsletter type (dropdown of site authors). Currently only settable via migration backfill.
