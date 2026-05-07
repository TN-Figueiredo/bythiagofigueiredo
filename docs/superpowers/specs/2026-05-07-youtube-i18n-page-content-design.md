# YouTube Page i18n — CMS-Managed Page Content

**Date:** 2026-05-07
**Status:** Approved
**Scope:** Internationalize the `/youtube` page with DB-stored, CMS-editable strings

## Problem

The `/youtube` page has 58 hardcoded UI strings scattered across 9 components as inline ternaries (`L === 'pt' ? '...' : '...'`). Additionally, `page.tsx` reads `ctx.defaultLocale` (always `'en'`) instead of the `x-locale` header, so `/pt/youtube` always renders in English.

The user wants full CMS control over all page text — both UI labels and editorial copy — without requiring code deploys to change content.

## Design

### Database

New table `page_content` — generic, reusable for any page:

```sql
create table page_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  page text not null,
  locale text not null,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint page_content_unique unique (site_id, page, locale)
);

alter table page_content enable row level security;

drop policy if exists "page_content_public_read" on page_content;
create policy "page_content_public_read" on page_content
  for select using (public.site_visible(site_id));

drop policy if exists "page_content_admin_write" on page_content;
create policy "page_content_admin_write" on page_content
  for all using (public.is_org_admin(site_id));

create index idx_page_content_lookup on page_content(site_id, page, locale);

-- Audit trail
create trigger page_content_audit
  after insert or update or delete on page_content
  for each row execute function audit_log_trigger();
```

2 rows for YouTube: `('youtube', 'en', {...})` + `('youtube', 'pt-BR', {...})`.

### TypeScript Schema — 58 fields, 10 sections

```typescript
export interface YouTubeStrings {
  // Hero — PT variant (2-col layout, shown when PT channel has latest video)
  hero_pt_section_label: string     // "this week, on two channels"
  hero_pt_headline: string          // "Dois canais, uma cabeça"
  hero_pt_description: string       // Long editorial copy about the two channels
  hero_pt_also_on: string           // "also on @thiagofigueiredo"
  hero_pt_previously: string        // "previously in English"

  // Hero — EN variant (wide layout, shown when EN channel has latest video)
  hero_en_section_label: string     // "latest video"
  hero_en_headline_line1: string    // "Live-coding,"
  hero_en_headline_line2: string    // "in English." (accent color styling)
  hero_en_description: string       // "@thiagofigueiredo — where I code in public..."
  hero_en_previously: string        // "previously"

  // Stats strip
  stats_videos_published: string
  stats_hours_of_content: string
  stats_comments_answered: string
  stats_most_watched: string

  // Featured pick (§ 02)
  feature_section_label: string     // "this week's pick"
  feature_headline: string          // "What's worth setting aside 20 minutes for"
  feature_my_pick: string           // "my pick"
  feature_also_dropped: string      // "also dropped"
  feature_jump_to_series: string    // "jump to a series"

  // Comments wall (§ 03)
  comments_section_label: string    // "what people said"
  comments_headline: string         // "Clippings that made me stop and re-read"
  comments_description: string      // "Hand-picked. Not automated..."
  comments_scroll_annotation: string // "enough scrolling"
  comments_relative_today: string   // "today"
  comments_relative_days: string    // "{n}d ago" — runtime interpolation
  comments_relative_weeks: string   // "{n}w ago"
  comments_relative_months: string  // "{n}mo ago"
  comments_relative_years: string   // "{n}y ago"

  // Archive (§ 04)
  archive_section_label: string     // "archive"
  archive_headline: string          // "Everything on the channel"
  archive_search_placeholder: string // "search title, tag, series…"
  archive_search_aria: string       // "Search videos"
  archive_channel_label: string     // "channel:"
  archive_channel_aria: string      // "Channel filter"
  archive_channel_both: string      // "Both"
  archive_clear_all: string         // "clear all"
  archive_series_label: string      // "series:"
  archive_series_aria: string       // "Series filter"
  archive_tags_aria: string         // "Tag filter"
  archive_video_singular: string    // "video"
  archive_video_plural: string      // "videos"
  archive_filtered: string          // "filtered"
  archive_newest_first: string      // "newest first"
  archive_no_videos: string         // "no videos."
  archive_clear_filters: string     // "clear filters"
  archive_load_more: string         // "load more"
  archive_latest: string            // "Latest" (BUG FIX: was same in both locales)

  // Cards (shared)
  card_views: string                // "views" (BUG FIX: was never localized)

  // Channel strip
  channel_subs: string              // "subs"
  channel_videos: string            // "videos"
  channel_open: string              // "open"

  // Subscribe CTA
  subscribe_floating_label: string  // "subscribe"
  subscribe_headline: string        // "Watching is free. Coming back is the hard part."
  subscribe_description: string     // "Subscribe to both..."
  subscribe_subs: string            // "subs"
  subscribe_button: string          // "subscribe"

  // Empty state
  empty_headline: string            // "Videos coming soon"
  empty_description: string         // "The channel is almost live..."
  empty_subscribe_button: string    // "Subscribe on YouTube"
}
```

### Fetch Strategy

One query fetches both locales. Merge chain provides field-level fallback:

```typescript
const { data: rows } = await supabase
  .from('page_content')
  .select('locale, content')
  .eq('site_id', ctx.siteId)
  .eq('page', 'youtube')
  .in('locale', ['en', 'pt-BR'])

const en = rows?.find(r => r.locale === 'en')?.content ?? {}
const target = locale === 'pt-BR'
  ? rows?.find(r => r.locale === 'pt-BR')?.content ?? {}
  : en

const strings: YouTubeStrings = { ...YOUTUBE_DEFAULTS_EN, ...en, ...target }
```

Fallback chain: DB locale → DB en → hardcoded defaults (safety net for empty DB).

Cache: `unstable_cache` with tag `page-content:youtube`, revalidate 3600s. CMS save calls `revalidateTag('page-content:youtube')`.

### Dynamic Template Interpolation

5 strings use `{n}` placeholder for numeric values:

```typescript
function t(template: string, vars: Record<string, number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? k))
}
// t(strings.comments_relative_days, { n: 5 }) → "5d ago"
```

### CMS Page — `/cms/youtube/content`

New sub-page in the existing YouTube CMS section.

**Layout:** Locale toggle (EN | PT-BR) at top. 10 collapsible sections below.

| Section | Fields | Input types |
|---------|--------|-------------|
| Hero (PT Variant) | 5 | 2× text, 1× text, 2× textarea |
| Hero (EN Variant) | 5 | 3× text, 1× textarea, 1× text |
| Stats | 4 | 4× text |
| Featured Pick | 5 | 3× text, 1× textarea, 1× text |
| Comments Wall | 9 | 3× textarea, 1× text, 5× text (hint: `{n}`) |
| Archive | 18 | 18× text |
| Channel Cards | 3 | 3× text |
| Subscribe CTA | 5 | 2× text, 2× textarea, 1× text |
| Empty State | 3 | 1× text, 1× textarea, 1× text |
| Shared | 1 | 1× text |

Form schema is hardcoded in the CMS component (not in DB). Each field has a descriptive label and appropriate input type. Zod validates all 58 fields are present on save.

"Reset to defaults" button overwrites DB with hardcoded default values.

### Server Action

```typescript
'use server'
export async function savePageContent(page: string, locale: string, content: Record<string, string>) {
  const ctx = await requireSiteAdmin()
  const parsed = youtubeStringsSchema.parse(content)

  await supabase.from('page_content').upsert({
    site_id: ctx.siteId, page, locale,
    content: parsed,
    updated_at: new Date().toISOString(),
    updated_by: ctx.userId,
  }, { onConflict: 'site_id,page,locale' })

  revalidateTag(`page-content:${page}`)
}
```

### Settings Migration

YouTube channel management (add/remove channels, sync config) moves from `/cms/settings` YouTube tab → `/cms/youtube` dashboard. The Settings YouTube tab is removed.

### Bug Fixes (included)

1. **Locale resolution:** `ctx.defaultLocale` → `headers().get('x-locale')` in page.tsx
2. **"Latest" chip:** Hardcoded English in both locales → `strings.archive_latest`
3. **"views" label:** Never localized → `strings.card_views`

### Decorative Prefixes

`§ 01 ·`, `↓`, `→`, `✕`, `▶` stay in JSX. DB stores clean text. CSS handles uppercase via `text-transform`.

### Permissions

- **Read:** Public via `site_visible(site_id)`
- **Write:** `org_admin` via `is_org_admin(site_id)` RLS + `requireSiteAdmin()` in server action
- **Audit:** Trigger on `page_content` → existing `audit_log` table

### Hardcoded Defaults (safety net)

```typescript
// lib/content/defaults/youtube.ts
export const YOUTUBE_DEFAULTS_EN: YouTubeStrings = { /* all 58 fields */ }
export const YOUTUBE_DEFAULTS_PT: YouTubeStrings = { /* all 58 fields */ }
```

Used as fallback when DB is empty and as "Reset to defaults" source.

### Pattern for Future Pages

Each new page follows the same cycle:
1. Migration: seed `page_content` rows
2. TypeScript interface in `lib/content/schemas/<page>.ts`
3. Defaults in `lib/content/defaults/<page>.ts`
4. CMS form component at `/cms/<section>/content/`
5. Fetch via shared `getPageContent<T>(page, locale)` helper

### Seed Migration

SQL insert with all 58 strings × 2 locales, extracted from current inline ternaries. Runs as part of the Supabase migration.

## Files Touched

### New files
- `supabase/migrations/XXXXXX_page_content.sql` — table + RLS + seed
- `apps/web/src/lib/content/types.ts` — `YouTubeStrings` interface
- `apps/web/src/lib/content/defaults/youtube.ts` — EN + PT defaults
- `apps/web/src/lib/content/fetch.ts` — `getPageContent<T>()` helper
- `apps/web/src/lib/content/template.ts` — `t()` interpolation helper
- `apps/web/src/app/cms/(authed)/youtube/content/page.tsx` — CMS editor
- `apps/web/src/app/cms/(authed)/youtube/content/actions.ts` — server action
- `apps/web/src/app/cms/(authed)/youtube/content/content-editor.tsx` — form component

### Modified files
- `apps/web/src/app/(public)/youtube/page.tsx` — locale fix + fetch strings from DB
- `apps/web/src/app/(public)/youtube/youtube-page-client.tsx` — receive strings as prop
- `apps/web/src/app/(public)/youtube/youtube-hero.tsx` — use strings instead of ternaries
- `apps/web/src/app/(public)/youtube/youtube-stats-strip.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-feature-block.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-comments-wall.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-archive.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-archive-card.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-channel-strip.tsx` — same
- `apps/web/src/app/(public)/youtube/youtube-subscribe.tsx` — same
- `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx` — remove YouTube tab
