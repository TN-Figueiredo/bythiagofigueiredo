# About Page i18n — Design Spec

## Goal

Add locale support to the `/about` page so content can be authored in pt-BR and en independently. Follow the existing `blog_translations` / `campaign_translations` normalized table pattern.

## Scope

- New `author_about_translations` table with per-locale about content
- Migrate existing about data from `authors` columns to translation rows (locale `pt-BR`)
- Drop migrated columns from `authors` (keep `about_photo_url`, `social_links` as shared)
- Update public `/about` page to be locale-aware via `x-locale` header
- Add locale tabs to CMS author drawer "About Page" tab
- Update SEO metadata with hreflang alternates
- Update sitemap with multi-locale entries for `/about`

## Non-goals

- Locale support for `social_links` (stays shared on `authors`)
- New CMS page — stays within existing author detail drawer
- Changes to any page outside `/about` and CMS authors

---

## 1. Schema

### New table: `author_about_translations`

```sql
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
```

### Trigger

```sql
DROP TRIGGER IF EXISTS author_about_tx_set_updated_at ON author_about_translations;
CREATE TRIGGER author_about_tx_set_updated_at
  BEFORE UPDATE ON author_about_translations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

Reuses the existing `public.tg_set_updated_at()` function (created in migration `20260414000001_authors.sql`, used by `authors`, `blog_posts`, `campaigns`, etc.).

### RLS policies

```sql
ALTER TABLE author_about_translations ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can read translations for visible sites
DROP POLICY IF EXISTS "about_tx_public_read" ON author_about_translations;
CREATE POLICY "about_tx_public_read" ON author_about_translations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.site_visible(a.site_id)
    )
  );

-- Staff write: editors+ can manage translations
DROP POLICY IF EXISTS "about_tx_staff_write" ON author_about_translations;
CREATE POLICY "about_tx_staff_write" ON author_about_translations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM authors a
      WHERE a.id = author_about_translations.author_id
      AND public.can_edit_site(a.site_id)
    )
  );
```

### Fields that stay on `authors` (shared across locales)

- `about_photo_url` (same photo regardless of locale) + constraint `authors_about_photo_url_https`
- `social_links` (same URLs regardless of locale)

### Fields that move to `author_about_translations` (per-locale)

- `headline`, `subtitle`, `about_md`, `about_compiled`
- `photo_caption`, `photo_location`
- `about_cta_links` (kicker, signature, and link labels are translatable)

### Data migration

```sql
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
```

Locale is hardcoded to `pt-BR` because all existing about content was authored in Portuguese. The site's `default_locale` (`en`) does not influence this — data goes where it was written.

### Column cleanup

```sql
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

### Migration file

Single file: `supabase/migrations/20260504000003_author_about_translations.sql`

All three phases (create → migrate → drop) run in the same implicit transaction. PostgreSQL migrations via `supabase db push` are transactional — if any phase fails, the entire migration rolls back.

---

## 2. Data Layer

### `AboutData` interface

```typescript
interface AboutData {
  // From authors (shared)
  authorId: string
  displayName: string
  aboutPhotoUrl: string | null
  socialLinks: Record<string, string> | null
  // From author_about_translations (locale-specific)
  locale: string
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  aboutCompiled: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
  // Aggregated
  availableLocales: string[]
}
```

### Fetch strategy — 2-phase with fallback

```
getAboutData(siteId, locale):
  1. SELECT id, display_name, about_photo_url, social_links
     FROM authors WHERE site_id = $1 AND is_default = true
     → if null, return null

  2. SELECT * FROM author_about_translations
     WHERE author_id = $1
     ORDER BY CASE WHEN locale = $2 THEN 0 ELSE 1 END
     LIMIT 1
     → Prefers requested locale; falls back to ANY available locale
     → if no rows exist at all, return null (page shows 404)

  3. SELECT DISTINCT locale FROM author_about_translations
     WHERE author_id = $1
     → availableLocales array

  Return merged { ...author, ...translation, availableLocales }
```

The fallback is locale-agnostic: if the requested locale has no translation, the query returns whichever translation exists (e.g., visiting `/about` in English falls back to the pt-BR content rather than 404). This is appropriate because the about page is a singleton — unlike blog posts, there's only one about page, so showing content in another language is better than a 404. The `<LocaleSwitcher>` makes the available locales visible to the user.

### Cache

- Cache key: `about:${siteId}:${locale}` (separate entry per locale)
- Cache tag: `about:${siteId}` (revalidation busts ALL locales at once)
- TTL: 300s (unchanged)
- `revalidateAbout(siteId)` — no change needed, tag already covers all locales

---

## 3. Public Page

### Route

No change. Middleware handles `/pt/about` → strip prefix → `/about` + header `x-locale: pt-BR`. The page reads locale from the header.

### Page component changes

```typescript
export default async function AboutPage() {
  const ctx = await tryGetSiteContext()
  if (!ctx) notFound()

  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'

  const about = await getAboutData(ctx.siteId, locale)
  if (!about) notFound()

  // LocaleSwitcher only if multiple locales have content
  // Renders after AboutHero, before about-grid
}
```

### LocaleSwitcher placement

Renders between `<AboutHero>` and the `<section className="about-grid">`, using the existing `<LocaleSwitcher>` component:

```tsx
{about.availableLocales.length > 1 && (
  <LocaleSwitcher
    available={about.availableLocales}
    current={locale}
    hrefFor={(loc) => localePath('/about', loc)}
  />
)}
```

Wrapped in a container with `max-width: 1080px; margin: 0 auto; padding: 0 28px` to align with the hero and grid.

### AboutHero kicker

The `§ OLÁ` kicker should be locale-aware: `§ OLÁ` for pt-BR, `§ HELLO` for en. Strings come from the existing locale JSON files (`src/locales/en.json` and `src/locales/pt-BR.json`) — add keys `"about.kicker": "HELLO"` / `"about.kicker": "OLÁ"`. The page passes the resolved string to `<AboutHero kicker={t['about.kicker']}>`.

---

## 4. SEO

### Metadata

`generateAboutMetadata(config, about, locale)`:
- `title`: `"Sobre — {siteName}"` (pt-BR) / `"About — {siteName}"` (en)
- `description`: `about.subtitle ?? "About {siteName}"`
- `canonical`: `config.siteUrl + localePath('/about', locale)`
- `alternates.languages`: built from `about.availableLocales`, each mapping `hreflangCode(loc)` → full URL. Includes `x-default` pointing to default locale.

### JSON-LD

BreadcrumbList label: `"Sobre"` (pt-BR) / `"About"` (en).

### Sitemap

Move `/about` from `STATIC_SINGLE_LOCALE_DEFS` to a new `STATIC_MULTI_LOCALE_DEFS` array. Entries in this array generate one sitemap entry per `supportedLocale` on the site, with hreflang `alternates` cross-referencing each other.

```typescript
const STATIC_MULTI_LOCALE_DEFS: ReadonlyArray<{
  basePath: string
  changeFrequency: SitemapRouteEntry['changeFrequency']
  priority: number
}> = [
  { basePath: '/about', changeFrequency: 'monthly', priority: 0.6 },
]
```

The enumerator iterates `config.supportedLocales` for each entry, generating locale-prefixed paths with alternates. This is a static assumption (both locales assumed to have content). Acceptable for the about page — if one locale is missing, the sitemap points to a page that returns 404, which Google handles gracefully by de-indexing.

---

## 5. CMS

### Location

Inside the existing author detail drawer, within the "About Page" tab. No new CMS pages or routes.

### Locale tabs

Tabs rendered inside the "About Page" tab, showing ALL `supported_locales` from the site (not just locales with content).

Source of `supported_locales`: the server component `page.tsx` already calls `getSiteContext()` which returns `siteId`. Add a query `SELECT supported_locales FROM sites WHERE id = $siteId` in the same server component, pass the result as a new `supportedLocales: string[]` prop to `AuthorsConnected`.

Visual indicator: tabs with existing translations show normal label (`pt-BR`). Tabs without translations show dimmed label with suffix: `en (empty)`.

### Lazy loading

When the drawer opens on the "About Page" tab, a `useEffect` calls `getAuthorAboutTranslations(authorId)` — a new server action that returns `Record<string, AboutTranslation | null>` keyed by locale.

```typescript
interface AboutTranslation {
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: { kicker: string; signature: string; links: Array<...> } | null
}
```

### State management

`AuthorData` interface drops all about fields (headline, subtitle, aboutMd, aboutCompiled, photoCaption, photoLocation, aboutCtaLinks). Keeps `aboutPhotoUrl` (shared).

The "About Page" tab manages its own state:
- `translations: Record<string, AboutTranslation | null>` — loaded via lazy fetch
- `activeLocale: string` — which locale tab is selected
- Per-field state initialized from `translations[activeLocale]` when switching tabs
- `aboutPhotoUrl` state stays (loaded from author, shared across locales)

**Dirty check on locale tab switch:** before switching locale tabs, if any field has been modified since last save, show a browser `confirm()` dialog: "You have unsaved changes. Switch locale and lose changes?". If declined, stay on current tab. This prevents accidental data loss without adding UI complexity (no toast, no autosave — just a native confirm).

### Save — upsert pattern

`updateAuthorAbout(authorId, locale, input)` gains a `locale` parameter.

Validation: `locale` must be in site's `supported_locales`, otherwise returns `{ ok: false, error: 'unsupported_locale' }`. The action fetches `supported_locales` via `SELECT supported_locales FROM sites WHERE id = $siteId` (single lightweight query, same service client).

Internally uses Supabase `upsert({ author_id, locale, ...updates }, { onConflict: 'author_id,locale' })`. No separate "Create translation" button needed — saving an empty-tab locale creates the row automatically.

### Photo upload

`uploadAuthorAboutPhoto(authorId, formData)` — unchanged. Photo is shared (stored on `authors.about_photo_url`), displayed across all locale tabs.

---

## 6. Cache Invalidation

### Existing `revalidateAbout(siteId)`

No change. The tag `about:${siteId}` already invalidates all locale-specific cache entries because the cache key `about:${siteId}:${locale}` includes the siteId prefix.

### `setDefaultAuthor` gap fix

`setDefaultAuthor` in `actions.ts` should call `revalidateAbout(siteId)` after swapping the default author. Currently missing — changing the default author wouldn't refresh the about page. This is a pre-existing bug that becomes more impactful with i18n.

---

## 7. Deployment

Migration and code changes must deploy together:

1. Commit all code changes to staging
2. Run `npm run db:push:prod` (applies migration)
3. Restart dev server / deploy

If code deploys before migration: queries to `author_about_translations` fail (table doesn't exist). If migration runs before code: CMS SELECT of dropped columns fails. Both must happen in the same deploy window.

---

## 8. Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260504000003_...sql` | New: create table, migrate data, drop columns |
| `apps/web/lib/about/queries.ts` | Refactor: 2-phase fetch, locale param, availableLocales, fallback |
| `apps/web/src/app/(public)/about/page.tsx` | Locale from header, LocaleSwitcher, hreflang |
| `apps/web/src/app/(public)/about/components/AboutHero.tsx` | Locale-aware kicker text |
| `apps/web/lib/seo/page-metadata.ts` | `generateAboutMetadata` gains locale + alternates.languages |
| `apps/web/lib/seo/enumerator.ts` | New `STATIC_MULTI_LOCALE_DEFS`, move `/about` there |
| `apps/web/src/app/cms/(authed)/authors/page.tsx` | Drop 7 about columns from SELECT, add supportedLocales prop |
| `apps/web/src/app/cms/(authed)/authors/authors-connected.tsx` | Drop about fields from AuthorData, locale tabs, lazy load, per-locale state |
| `apps/web/src/app/cms/(authed)/authors/actions.ts` | `updateAuthorAbout` +locale +upsert, new `getAuthorAboutTranslations`, `setDefaultAuthor` +revalidateAbout |
| `apps/web/src/locales/en.json` | Add `about.kicker` and `about.breadcrumb` keys |
| `apps/web/src/locales/pt-BR.json` | Add `about.kicker` and `about.breadcrumb` keys |
| `apps/web/test/about/about-queries.test.ts` | Update: 2-phase mocks, locale param, availableLocales |
| `apps/web/test/cms/authors-about-actions.test.ts` | Update: locale param, upsert behavior |
| New: `apps/web/test/cms/authors-about-translations.test.ts` | Test `getAuthorAboutTranslations` action |
