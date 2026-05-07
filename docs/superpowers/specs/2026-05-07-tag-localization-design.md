# Tag Localization via `name_translations` JSONB

**Date:** 2026-05-07
**Status:** Approved

## Problem

Blog tags (`blog_tags`) are monolingual — a single `name` column stores one display name. With multi-locale content (PT-BR + EN), the same category needs different display names per locale (e.g. "Bastidores" in PT, "Behind the Scenes" in EN) without duplicating the tag entity.

## Decision

Add a `name_translations jsonb` column to `blog_tags`. The existing `name` column remains the primary/fallback name (default locale). Translations for secondary locales live in the JSONB. Slug stays universal.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CMS display | Show both: "Primary (Translation)" | Avoids ambiguity when same tag appears across locales |
| Missing translation fallback | Fall back to primary `name` | No visual holes; tag always visible |
| Slug localization | Universal slug only | Simpler URLs, no redirect complexity, no DB conflicts |
| Tag drawer UX | Inline fields per locale below primary name | One field per secondary locale, no extra clicks |
| Resolution layer | App-level (not SQL) | CMS needs both raw values for "show both" format |

## Database

### Migration

```sql
ALTER TABLE public.blog_tags
  ADD COLUMN name_translations jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.blog_tags.name_translations IS
  'Per-locale display names. Keys = locale codes (e.g. "en", "pt-BR"). Values = translated name strings. The "name" column is the primary/fallback name (default locale).';
```

- `name` = primary name (site default locale, e.g. PT-BR)
- `name_translations` = `{"en": "Behind the Scenes"}` — secondary locales only
- No backfill needed — empty `{}` + `name` fallback covers existing tags
- Slug generated from `name`, unchanged

### JSONB Structure

```jsonc
{
  "en": "Behind the Scenes",
  // Only secondary locales. Default locale uses `name` column.
  // Empty/missing key = fall back to `name`
}
```

## Utility Functions

Single file: `apps/web/src/app/cms/(authed)/blog/_hub/tag-locale.ts`

### `resolveTagName(tag, locale): string`

For public frontend — returns the locale-specific name or falls back to primary.

```typescript
export function resolveTagName(
  tag: { name: string; nameTranslations?: Record<string, string> | null },
  locale: string,
): string {
  if (tag.nameTranslations && typeof tag.nameTranslations === 'object') {
    const translated = tag.nameTranslations[locale]
    if (translated && translated.trim()) return translated
  }
  return tag.name
}
```

### `formatTagNameCms(tag): string`

For CMS display — returns "Primary (Translation1, Translation2)" or just "Primary" if no translations.

```typescript
export function formatTagNameCms(
  tag: { name: string; nameTranslations?: Record<string, string> | null },
): string {
  if (!tag.nameTranslations || typeof tag.nameTranslations !== 'object') return tag.name
  const translations = Object.values(tag.nameTranslations).filter(v => v && v.trim())
  if (translations.length === 0) return tag.name
  return `${tag.name} (${translations.join(', ')})`
}
```

## TypeScript Types

### `BlogTag` (hub-types.ts)

Add field:

```typescript
nameTranslations: Record<string, string> | null
```

### `PostCard` (hub-types.ts)

Add field:

```typescript
tagNameTranslations: Record<string, string> | null
```

## Display Rules by Context

| Context | Function | Example output |
|---------|----------|----------------|
| CMS kanban card badge | `formatTagNameCms()` | "Bastidores (Behind the Scenes)" |
| CMS editor TagSelector | `formatTagNameCms()` | "Bastidores (Behind the Scenes)" |
| CMS tag filter chips | `formatTagNameCms()` | "Bastidores (Behind the Scenes)" |
| CMS tag drawer | Separate fields | Name: "Bastidores" / EN: "Behind the Scenes" |
| Public blog post page | `resolveTagName(tag, locale)` | "Behind the Scenes" (EN page) |
| Public blog listing filter | `resolveTagName(tag, locale)` | "Behind the Scenes" (EN page) |
| SEO keywords meta | `resolveTagName(tag, locale)` | locale-aware |
| JSON-LD | `resolveTagName(tag, locale)` | locale-aware |

## Server Actions

### `createTag` / `updateTag`

Accept new optional parameter: `nameTranslations?: Record<string, string>`

**Validation rules:**
- Strip keys where value is empty string or whitespace-only
- Trim all values
- Reject keys not in site's `supportedLocales`
- Reject key matching `defaultLocale` (that goes in `name` column)

### Inline tag creation (editor/kanban)

No change — creates with `name` only, no translations. User adds translations later via tag drawer. Fallback covers display.

## Hub Queries

### `fetchBlogSharedData`

Add `name_translations` to the `blog_tags` select. Map to `nameTranslations` in the `BlogTag` result.

### `fetchEditorialData`

The joined `blog_tags(id, name, color)` becomes `blog_tags(id, name, color, name_translations)`. PostCard mapping adds `tagNameTranslations`.

### Other queries

All queries that join `blog_tags` and return tag name/color must also select `name_translations`. This includes:
- `fetchOverviewData` tag breakdown
- `fetchScheduleData` slot posts
- Public page queries in `(public)/blog/[locale]/page.tsx` and `[slug]/page.tsx`

## Tag Drawer Changes

`apps/web/src/app/cms/(authed)/blog/_hub/tag-drawer.tsx`

### Layout

1. **Primary name field**: Label "Name (🇧🇷 PT-BR)" → maps to `name` column. Required.
2. **Translation fields**: One per secondary locale (locales from `supportedLocales` minus `defaultLocale`). Label "Name (🇺🇸 EN)" → maps to `name_translations.en`. Optional.
3. Color, badge, sort order, linked newsletter type — unchanged, below translations.

### Data Flow

- On open (edit mode): populate primary name from `name`, populate translation inputs from `name_translations`
- On save: strip empty translation values, pass `nameTranslations` to `createTag`/`updateTag`
- Tag drawer needs `supportedLocales` and `defaultLocale` props (from `BlogHubSharedData`)

## Fallback Chain

```
name_translations[locale] → name (always present, never null)
```

Defensive: if JSONB is corrupted (not an object), utility returns `name` directly.

## Cache Invalidation

`updateTag` already calls `revalidateBlogHub(siteId)`. Public pages cached with `blog-hub` tag are revalidated. No change needed.

## Testing

### New tests

- `resolveTagName`: with translation, without translation, null JSONB, non-existent locale, corrupted JSONB (non-object)
- `formatTagNameCms`: with translations, without, null, mixed empty values
- `createTag` with `nameTranslations`: valid, invalid locale key, empty values stripped
- `updateTag` with `nameTranslations`: partial update, clear translations

### Updated mocks

- `blog-hub-actions.test.ts`: add `name_translations` to mock tag data
- `blog-hub-components.test.ts`: add `tagNameTranslations` to PostCard mocks

## Out of Scope

- Localized slugs (decided: universal slug)
- RSS/Atom feeds (don't exist in project)
- Newsletter email rendering (uses `newsletter_types.name`, not `blog_tags.name`)
- Backfill existing tags (fallback to `name` covers)
- GIN index on `name_translations` (irrelevant at current tag volume)

## Files Changed (estimated)

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_tag_localization.sql` | New migration |
| `blog/_hub/tag-locale.ts` | New utility file |
| `blog/_hub/hub-types.ts` | Add `nameTranslations` to BlogTag + PostCard |
| `blog/_hub/hub-queries.ts` | Select + map `name_translations` in all tag queries |
| `blog/_hub/tag-drawer.tsx` | Add translation input fields |
| `blog/_hub/tag-filter-chips.tsx` | Use `formatTagNameCms()` |
| `blog/actions.ts` | `createTag`/`updateTag` accept + validate `nameTranslations` |
| `blog/new/post-edition-editor.tsx` | TagSelector uses `formatTagNameCms()` |
| `blog/_tabs/editorial/kanban-card.tsx` | Tag badge uses `formatTagNameCms()` |
| `(public)/blog/[locale]/page.tsx` | Select `name_translations`, use `resolveTagName()` |
| `(public)/blog/[locale]/[slug]/page.tsx` | Select `name_translations`, use `resolveTagName()` for display + SEO |
| Tests (2-3 files) | Update mocks, add utility tests |
