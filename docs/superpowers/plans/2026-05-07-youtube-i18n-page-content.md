# YouTube i18n — Page Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 58 hardcoded UI strings across 9 YouTube page components with DB-stored, CMS-editable translations, fixing the locale resolution bug.

**Architecture:** New `page_content` table stores JSONB per page/locale. Server component fetches strings via `getPageContent<T>()` helper with field-level fallback (DB locale → DB en → hardcoded defaults). CMS editor at `/cms/youtube/content/` provides section-grouped form. All decorative prefixes (`§`, `↓`, `▶`) stay in JSX.

**Tech Stack:** Supabase (PostgreSQL JSONB), Next.js server components, `unstable_cache`, Zod, React server actions

**Parallelism:** After Task 1, Tasks 2–8 have zero file overlaps and can run as simultaneous sub-agents.

---

## Task 1: Foundation — Migration + Lib Files

**Files:**
- Create: `supabase/migrations/20260507180000_page_content.sql`
- Create: `apps/web/src/lib/content/types.ts`
- Create: `apps/web/src/lib/content/defaults/youtube-en.ts`
- Create: `apps/web/src/lib/content/defaults/youtube-pt.ts`
- Create: `apps/web/src/lib/content/fetch.ts`
- Create: `apps/web/src/lib/content/template.ts`

- [ ] **Step 1: Create migration**

```sql
-- supabase/migrations/20260507180000_page_content.sql

create table if not exists public.page_content (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  page text not null,
  locale text not null,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  constraint page_content_unique unique (site_id, page, locale)
);

create index if not exists idx_page_content_lookup
  on public.page_content(site_id, page, locale);

alter table public.page_content enable row level security;

drop policy if exists "page_content_public_read" on public.page_content;
create policy "page_content_public_read" on public.page_content
  for select using (public.site_visible(site_id));

drop policy if exists "page_content_admin_write" on public.page_content;
create policy "page_content_admin_write" on public.page_content
  for all to authenticated using (public.is_org_admin(site_id))
  with check (public.is_org_admin(site_id));
```

- [ ] **Step 2: Create TypeScript interface**

```typescript
// apps/web/src/lib/content/types.ts

export interface YouTubeStrings {
  hero_pt_section_label: string
  hero_pt_headline: string
  hero_pt_description: string
  hero_pt_also_on: string
  hero_pt_previously: string

  hero_en_section_label: string
  hero_en_headline_line1: string
  hero_en_headline_line2: string
  hero_en_description: string
  hero_en_previously: string

  stats_videos_published: string
  stats_hours_of_content: string
  stats_comments_answered: string
  stats_most_watched: string

  feature_section_label: string
  feature_headline: string
  feature_my_pick: string
  feature_also_dropped: string
  feature_jump_to_series: string

  comments_section_label: string
  comments_headline: string
  comments_description: string
  comments_scroll_annotation: string
  comments_relative_today: string
  comments_relative_days: string
  comments_relative_weeks: string
  comments_relative_months: string
  comments_relative_years: string

  archive_section_label: string
  archive_headline: string
  archive_search_placeholder: string
  archive_search_aria: string
  archive_channel_label: string
  archive_channel_aria: string
  archive_channel_both: string
  archive_clear_all: string
  archive_series_label: string
  archive_series_aria: string
  archive_tags_aria: string
  archive_video_singular: string
  archive_video_plural: string
  archive_filtered: string
  archive_newest_first: string
  archive_no_videos: string
  archive_clear_filters: string
  archive_load_more: string
  archive_latest: string

  card_views: string

  channel_subs: string
  channel_videos: string
  channel_open: string

  subscribe_floating_label: string
  subscribe_headline: string
  subscribe_description: string
  subscribe_subs: string
  subscribe_button: string

  empty_headline: string
  empty_description: string
  empty_subscribe_button: string
}
```

- [ ] **Step 3: Create EN defaults**

```typescript
// apps/web/src/lib/content/defaults/youtube-en.ts
import type { YouTubeStrings } from '../types'

export const YOUTUBE_EN: YouTubeStrings = {
  hero_pt_section_label: 'this week, on two channels',
  hero_pt_headline: 'Two channels, one head',
  hero_pt_description: 'One channel in Portuguese, one in English — from the same desk. PT is where I talk about career, setup, retrospectives. EN is where I code in public.',
  hero_pt_also_on: 'also on @thiagofigueiredo',
  hero_pt_previously: 'previously in English',

  hero_en_section_label: 'latest video',
  hero_en_headline_line1: 'Live-coding,',
  hero_en_headline_line2: 'in English.',
  hero_en_description: '@thiagofigueiredo — where I code in public, in English. There\'s a sister channel in Portuguese, linked above.',
  hero_en_previously: 'previously',

  stats_videos_published: 'videos published',
  stats_hours_of_content: 'hours of content',
  stats_comments_answered: 'comments answered',
  stats_most_watched: 'most watched',

  feature_section_label: 'this week\'s pick',
  feature_headline: 'What\'s worth setting aside 20 minutes for',
  feature_my_pick: 'my pick',
  feature_also_dropped: 'also dropped',
  feature_jump_to_series: 'jump to a series',

  comments_section_label: 'what people said',
  comments_headline: 'Clippings that made me stop and re-read',
  comments_description: 'Hand-picked. Not automated — I read every single one.',
  comments_scroll_annotation: 'enough scrolling',
  comments_relative_today: 'today',
  comments_relative_days: '{n}d ago',
  comments_relative_weeks: '{n}w ago',
  comments_relative_months: '{n}mo ago',
  comments_relative_years: '{n}y ago',

  archive_section_label: 'archive',
  archive_headline: 'Everything on the channel',
  archive_search_placeholder: 'search title, tag, series…',
  archive_search_aria: 'Search videos',
  archive_channel_label: 'channel:',
  archive_channel_aria: 'Channel filter',
  archive_channel_both: 'Both',
  archive_clear_all: 'clear all',
  archive_series_label: 'series:',
  archive_series_aria: 'Series filter',
  archive_tags_aria: 'Tag filter',
  archive_video_singular: 'video',
  archive_video_plural: 'videos',
  archive_filtered: 'filtered',
  archive_newest_first: 'newest first',
  archive_no_videos: 'no videos.',
  archive_clear_filters: 'clear filters',
  archive_load_more: 'load more',
  archive_latest: 'Latest',

  card_views: 'views',

  channel_subs: 'subs',
  channel_videos: 'videos',
  channel_open: 'open',

  subscribe_floating_label: 'subscribe',
  subscribe_headline: 'Watching is free. Coming back is the hard part.',
  subscribe_description: 'Subscribe to both — the YouTube feed takes care of the rest. PT covers career and setup; EN is live-coding.',
  subscribe_subs: 'subs',
  subscribe_button: 'subscribe',

  empty_headline: 'Videos coming soon',
  empty_description: 'The channel is almost live. Subscribe to get notified when the first video drops.',
  empty_subscribe_button: 'Subscribe on YouTube',
}
```

- [ ] **Step 4: Create PT defaults**

```typescript
// apps/web/src/lib/content/defaults/youtube-pt.ts
import type { YouTubeStrings } from '../types'

export const YOUTUBE_PT: YouTubeStrings = {
  hero_pt_section_label: 'esta semana, em dois canais',
  hero_pt_headline: 'Dois canais, uma cabeça',
  hero_pt_description: 'Um canal em português, um em inglês — saídos da mesma mesa. PT é onde eu falo de carreira, setup, retrospectivas. EN é onde eu codifico em público.',
  hero_pt_also_on: 'também rolou no @thiagofigueiredo',
  hero_pt_previously: 'anteriores em inglês',

  hero_en_section_label: 'último vídeo',
  hero_en_headline_line1: 'Live-coding,',
  hero_en_headline_line2: 'em inglês.',
  hero_en_description: '@thiagofigueiredo — onde eu codifico em público, em inglês. Tem um canal-irmão em português, lá em cima.',
  hero_en_previously: 'anteriores',

  stats_videos_published: 'vídeos publicados',
  stats_hours_of_content: 'horas de conteúdo',
  stats_comments_answered: 'comentários respondidos',
  stats_most_watched: 'mais assistido',

  feature_section_label: 'esta semana, em destaque',
  feature_headline: 'O que vale a pena reservar 20 minutos',
  feature_my_pick: 'minha escolha',
  feature_also_dropped: 'também rolaram',
  feature_jump_to_series: 'ir direto pra uma série',

  comments_section_label: 'o que disseram',
  comments_headline: 'Recortes que me fizeram parar e reler',
  comments_description: 'Selecionados à mão. Não é automático — eu leio cada um.',
  comments_scroll_annotation: 'chega de scroll',
  comments_relative_today: 'hoje',
  comments_relative_days: '{n}d atrás',
  comments_relative_weeks: '{n}sem atrás',
  comments_relative_months: '{n}m atrás',
  comments_relative_years: '{n}a atrás',

  archive_section_label: 'arquivo',
  archive_headline: 'Tudo que tá no canal',
  archive_search_placeholder: 'buscar título, tag, série…',
  archive_search_aria: 'Buscar vídeos',
  archive_channel_label: 'canal:',
  archive_channel_aria: 'Filtro de canal',
  archive_channel_both: 'Ambos',
  archive_clear_all: 'limpar tudo',
  archive_series_label: 'série:',
  archive_series_aria: 'Filtro de série',
  archive_tags_aria: 'Filtro de tags',
  archive_video_singular: 'vídeo',
  archive_video_plural: 'vídeos',
  archive_filtered: 'filtrado',
  archive_newest_first: 'do mais novo pro mais antigo',
  archive_no_videos: 'nenhum vídeo.',
  archive_clear_filters: 'limpar filtros',
  archive_load_more: 'carregar mais',
  archive_latest: 'Recentes',

  card_views: 'visualizações',

  channel_subs: 'inscritos',
  channel_videos: 'vídeos',
  channel_open: 'abrir',

  subscribe_floating_label: 'se inscreva',
  subscribe_headline: 'Assistir é grátis. Voltar é o difícil.',
  subscribe_description: 'Inscreva-se nos dois — o feed do YouTube cuida do resto. PT é onde eu falo de carreira e setup; EN é onde eu codifico em público.',
  subscribe_subs: 'inscritos',
  subscribe_button: 'inscrever',

  empty_headline: 'Vídeos chegando em breve',
  empty_description: 'O canal está quase no ar. Inscreva-se para ser notificado quando o primeiro vídeo sair.',
  empty_subscribe_button: 'Inscrever no canal',
}
```

- [ ] **Step 5: Create fetch helper**

```typescript
// apps/web/src/lib/content/fetch.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function getPageContent<T extends Record<string, string>>(
  siteId: string,
  page: string,
  locale: string,
  defaults: { en: T; pt: T },
): Promise<T> {
  const fetcher = unstable_cache(
    async () => {
      const supabase = getSupabaseServiceClient()
      const { data: rows } = await supabase
        .from('page_content')
        .select('locale, content')
        .eq('site_id', siteId)
        .eq('page', page)
        .in('locale', ['en', 'pt-BR'])

      const en = (rows?.find((r) => r.locale === 'en')?.content as Partial<T>) ?? {}
      const target =
        locale === 'pt-BR'
          ? ((rows?.find((r) => r.locale === 'pt-BR')?.content as Partial<T>) ?? {})
          : en

      const base = locale === 'pt-BR' ? defaults.pt : defaults.en
      return { ...base, ...en, ...target } as T
    },
    ['page-content', page, siteId, locale],
    { tags: [`page-content:${page}`], revalidate: 3600 },
  )

  return fetcher()
}
```

- [ ] **Step 6: Create template helper**

```typescript
// apps/web/src/lib/content/template.ts
export function t(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? k))
}
```

- [ ] **Step 7: Push migration**

```bash
npm run db:push:prod
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260507180000_page_content.sql apps/web/src/lib/content/
git commit -m "feat: add page_content table and YouTube i18n foundation"
```

---

## Task 2: Fix Locale + Wire Strings in page.tsx

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/page.tsx`

- [ ] **Step 1: Fix locale resolution and fetch strings**

In `page.tsx`, make these changes:

1. Add import at top:
```typescript
import { getPageContent } from '@/lib/content/fetch'
import type { YouTubeStrings } from '@/lib/content/types'
import { YOUTUBE_EN } from '@/lib/content/defaults/youtube-en'
import { YOUTUBE_PT } from '@/lib/content/defaults/youtube-pt'
```

2. In `generateMetadata` function, fix locale (around line 20):
```typescript
// BEFORE:
const locale = ctx.defaultLocale === 'pt-BR' ? 'pt' : 'en'
// AFTER:
const locale = (h.get('x-locale') ?? 'en') === 'pt-BR' ? 'pt' : 'en'
```

3. In `default export` function, fix locale (around line 31):
```typescript
// BEFORE:
const locale = ctx.defaultLocale === 'pt-BR' ? 'pt' : 'en'
// AFTER:
const rawLocale = (h.get('x-locale') ?? 'en') as string
const locale = rawLocale === 'pt-BR' ? 'pt' : 'en'
```

4. After the locale line, fetch strings:
```typescript
const strings = await getPageContent<YouTubeStrings>(
  ctx.siteId, 'youtube', rawLocale === 'pt-BR' ? 'pt-BR' : 'en',
  { en: YOUTUBE_EN, pt: YOUTUBE_PT },
)
```

5. Pass strings to client component:
```typescript
// BEFORE:
<YouTubePageClient data={data} locale={locale} />
// AFTER:
<YouTubePageClient data={data} locale={locale} strings={strings} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/page.tsx
git commit -m "fix: use x-locale header for YouTube page locale resolution"
```

---

## Task 3: Update YouTubePageClient

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-page-client.tsx`

- [ ] **Step 1: Add strings prop and pass to children**

1. Add import:
```typescript
import type { YouTubeStrings } from '@/lib/content/types'
```

2. Update Props interface:
```typescript
interface Props {
  data: YouTubePageData
  locale: 'pt' | 'en'
  strings: YouTubeStrings  // ← add
  ads?: { ... }
}
```

3. Destructure strings in component:
```typescript
export default function YouTubePageClient({ data, locale, strings, ads }: Props) {
```

4. Update empty state (around the "Videos coming soon" block):
```typescript
// BEFORE:
<h2 ...>{locale === 'pt' ? 'Vídeos chegando em breve' : 'Videos coming soon'}</h2>
<p ...>{locale === 'pt' ? 'O canal está quase no ar...' : 'The channel is almost live...'}</p>
// link text:
{locale === 'pt' ? 'Inscrever no canal' : 'Subscribe on YouTube'}

// AFTER:
<h2 ...>{strings.empty_headline}</h2>
<p ...>{strings.empty_description}</p>
// link text:
{strings.empty_subscribe_button}
```

5. Pass `strings` to all child components. For each child, add `strings={strings}`:
```typescript
<YouTubeHero ... strings={strings} />
<YouTubeChannelStrip ... strings={strings} />
<YouTubeStatsStrip ... strings={strings} />
<YouTubeFeatureBlock ... strings={strings} />
<YouTubeCommentsWall ... strings={strings} />
<YouTubeSubscribe ... strings={strings} />
<YouTubeArchive ... strings={strings} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-page-client.tsx
git commit -m "feat: wire YouTubeStrings through page client to all children"
```

---

## Task 4: Update youtube-hero.tsx

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-hero.tsx`

- [ ] **Step 1: Add strings prop to all hero components**

1. Add import:
```typescript
import type { YouTubeStrings } from '@/lib/content/types'
```

2. Add `strings: YouTubeStrings` to the props type used by `HeroPT`, `HeroEN`, and `YouTubeHero`.

3. In **HeroPT**, replace all ternaries:
```typescript
// Section label (§ 01 · ...)
// BEFORE: L === 'pt' ? 'esta semana, em dois canais' : 'this week, on two channels'
// AFTER: strings.hero_pt_section_label

// Headline
// BEFORE: 'Dois canais, uma cabeça' (hardcoded PT)
// AFTER: strings.hero_pt_headline

// Description paragraph
// BEFORE: L === 'pt' ? 'Um canal em português...' : 'One channel in Portuguese...'
// AFTER: strings.hero_pt_description

// "also on" label
// BEFORE: L === 'pt' ? 'também rolou no @thiagofigueiredo' : 'also on @thiagofigueiredo'
// AFTER: strings.hero_pt_also_on

// "previously in English" label
// BEFORE: L === 'pt' ? 'anteriores em inglês' : 'previously in English'
// AFTER: strings.hero_pt_previously

// "views" (hardcoded, lines 131)
// BEFORE: 'views'
// AFTER: strings.card_views
```

4. In **HeroEN**, replace all ternaries:
```typescript
// Section label
// BEFORE: L === 'pt' ? 'último vídeo' : 'latest video'
// AFTER: strings.hero_en_section_label

// Headline line 1 ("Live-coding,")
// BEFORE: hardcoded 'Live-coding,'
// AFTER: strings.hero_en_headline_line1

// Headline line 2 (the accented line)
// BEFORE: L === 'pt' ? 'em inglês.' : 'in English.'
// AFTER: strings.hero_en_headline_line2

// Description
// BEFORE: L === 'pt' ? '@thiagofigueiredo — onde eu codifico...' : '@thiagofigueiredo — where I code...'
// AFTER: strings.hero_en_description

// "previously"
// BEFORE: L === 'pt' ? 'anteriores' : 'previously'
// AFTER: strings.hero_en_previously

// "views" (hardcoded, line 299)
// BEFORE: 'views'
// AFTER: strings.card_views
```

5. In **YouTubeHero** wrapper, pass `strings` through to the chosen variant.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-hero.tsx
git commit -m "feat: replace hero ternaries with YouTubeStrings"
```

---

## Task 5: Update Small Components (stats, feature, channel-strip, archive-card)

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-stats-strip.tsx`
- Modify: `apps/web/src/app/(public)/youtube/youtube-feature-block.tsx`
- Modify: `apps/web/src/app/(public)/youtube/youtube-channel-strip.tsx`
- Modify: `apps/web/src/app/(public)/youtube/youtube-archive-card.tsx`

- [ ] **Step 1: Update youtube-stats-strip.tsx**

1. Add import and `strings: YouTubeStrings` to props.
2. Replace the 4 ternaries in the `stats` array (around lines 20-23):
```typescript
// BEFORE:
{ label: L === 'pt' ? 'vídeos publicados' : 'videos published', value: String(videoCount) },
{ label: L === 'pt' ? 'horas de conteúdo' : 'hours of content', value: totalHours },
{ label: L === 'pt' ? 'comentários respondidos' : 'comments answered', value: String(commentCount) },
{ label: L === 'pt' ? 'mais assistido' : 'most watched', value: fmtNum(mostWatched) },

// AFTER:
{ label: strings.stats_videos_published, value: String(videoCount) },
{ label: strings.stats_hours_of_content, value: totalHours },
{ label: strings.stats_comments_answered, value: String(commentCount) },
{ label: strings.stats_most_watched, value: fmtNum(mostWatched) },
```

- [ ] **Step 2: Update youtube-feature-block.tsx**

1. Add import and `strings: YouTubeStrings` to props.
2. Replace 5 ternaries:
```typescript
// Section label: strings.feature_section_label
// Headline: strings.feature_headline
// "↓ my pick" annotation: strings.feature_my_pick (keep ↓ prefix in JSX)
// "also dropped": strings.feature_also_dropped
// "jump to a series": strings.feature_jump_to_series
```

- [ ] **Step 3: Update youtube-channel-strip.tsx**

1. Add import and `strings: YouTubeStrings` to props.
2. Replace 3 ternaries:
```typescript
// "subs"/"inscritos": strings.channel_subs
// "videos"/"vídeos": strings.channel_videos
// "open"/"abrir" (▶ button): strings.channel_open (keep ▶ in JSX)
```

- [ ] **Step 4: Update youtube-archive-card.tsx**

1. Add import and `strings: YouTubeStrings` to props.
2. Fix the "views" bug (line 87):
```typescript
// BEFORE:
<span>{fmtNum(video.viewCount)} views</span>
// AFTER:
<span>{fmtNum(video.viewCount)} {strings.card_views}</span>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-stats-strip.tsx \
        apps/web/src/app/\(public\)/youtube/youtube-feature-block.tsx \
        apps/web/src/app/\(public\)/youtube/youtube-channel-strip.tsx \
        apps/web/src/app/\(public\)/youtube/youtube-archive-card.tsx
git commit -m "feat: replace ternaries in stats, feature, channel-strip, archive-card"
```

---

## Task 6: Update youtube-archive.tsx

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-archive.tsx`

- [ ] **Step 1: Add strings prop and replace all 18 ternaries**

1. Add import and `strings: YouTubeStrings` to props.

2. Replace all ternaries:
```typescript
// Section label: strings.archive_section_label
// Headline: strings.archive_headline
// Search placeholder: strings.archive_search_placeholder
// Search aria-label: strings.archive_search_aria
// "channel:": strings.archive_channel_label
// Channel aria-label: strings.archive_channel_aria
// "Both"/"Ambos": strings.archive_channel_both
// "✕ clear all": strings.archive_clear_all (keep ✕ in JSX)
// "series:": strings.archive_series_label
// Series aria-label: strings.archive_series_aria
// Tags aria-label: strings.archive_tags_aria
// "video"/"vídeo": strings.archive_video_singular
// "videos"/"vídeos": strings.archive_video_plural
// "filtered"/"filtrado": strings.archive_filtered
// "↓ newest first": strings.archive_newest_first (keep ↓ in JSX)
// "no videos.": strings.archive_no_videos
// "clear filters": strings.archive_clear_filters
// "load more": strings.archive_load_more
```

3. **Fix "Latest" bug** (line 52):
```typescript
// BEFORE:
{ key: 'latest', label: L === 'pt' ? 'Latest' : 'Latest', count: totalVideoCount },
// AFTER:
{ key: 'latest', label: strings.archive_latest, count: totalVideoCount },
```

4. Pass `strings` to `<YouTubeArchiveCard>` children:
```typescript
<YouTubeArchiveCard ... strings={strings} />
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-archive.tsx
git commit -m "fix: localize archive section and fix Latest chip bug"
```

---

## Task 7: Update youtube-comments-wall.tsx

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-comments-wall.tsx`

- [ ] **Step 1: Add strings prop and replace ternaries + formatRelativeTime**

1. Add imports:
```typescript
import type { YouTubeStrings } from '@/lib/content/types'
import { t } from '@/lib/content/template'
```

2. Add `strings: YouTubeStrings` to props.

3. Replace the 4 editorial ternaries:
```typescript
// Section label: strings.comments_section_label
// Headline: strings.comments_headline
// Description: strings.comments_description
// "→ enough scrolling" annotation: strings.comments_scroll_annotation (keep → in JSX)
```

4. **Rewrite `formatRelativeTime`** to use string templates:
```typescript
function formatRelativeTime(iso: string | null, strings: YouTubeStrings): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days < 1) return strings.comments_relative_today
  if (days < 7) return t(strings.comments_relative_days, { n: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return t(strings.comments_relative_weeks, { n: weeks })
  const months = Math.floor(days / 30)
  if (months < 12) return t(strings.comments_relative_months, { n: months })
  const years = Math.floor(days / 365)
  return t(strings.comments_relative_years, { n: years })
}
```

5. Update all calls to `formatRelativeTime` — change from `formatRelativeTime(date, locale)` to `formatRelativeTime(date, strings)`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-comments-wall.tsx
git commit -m "feat: replace comments ternaries and formatRelativeTime with strings"
```

---

## Task 8: Update youtube-subscribe.tsx

**Depends on:** Task 1
**Files:**
- Modify: `apps/web/src/app/(public)/youtube/youtube-subscribe.tsx`

- [ ] **Step 1: Add strings prop and replace 5 ternaries**

1. Add import and `strings: YouTubeStrings` to props.

2. Replace ternaries:
```typescript
// Floating badge "▶ subscribe": strings.subscribe_floating_label (keep ▶ in JSX)
// Headline: strings.subscribe_headline
// Description: strings.subscribe_description
// "subs"/"inscritos": strings.subscribe_subs
// "▶ subscribe" button: strings.subscribe_button (keep ▶ in JSX)
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(public\)/youtube/youtube-subscribe.tsx
git commit -m "feat: replace subscribe CTA ternaries with strings"
```

---

## Task 9: CMS Content Editor

**Depends on:** Task 1
**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/content/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/content/actions.ts`
- Create: `apps/web/src/app/cms/(authed)/youtube/content/content-editor.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/layout.tsx`

- [ ] **Step 1: Create server action**

```typescript
// apps/web/src/app/cms/(authed)/youtube/content/actions.ts
'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { YouTubeStrings } from '@/lib/content/types'
import { YOUTUBE_EN } from '@/lib/content/defaults/youtube-en'
import { YOUTUBE_PT } from '@/lib/content/defaults/youtube-pt'

const stringField = z.string().min(1)

const youtubeStringsSchema = z.object({
  hero_pt_section_label: stringField,
  hero_pt_headline: stringField,
  hero_pt_description: stringField,
  hero_pt_also_on: stringField,
  hero_pt_previously: stringField,
  hero_en_section_label: stringField,
  hero_en_headline_line1: stringField,
  hero_en_headline_line2: stringField,
  hero_en_description: stringField,
  hero_en_previously: stringField,
  stats_videos_published: stringField,
  stats_hours_of_content: stringField,
  stats_comments_answered: stringField,
  stats_most_watched: stringField,
  feature_section_label: stringField,
  feature_headline: stringField,
  feature_my_pick: stringField,
  feature_also_dropped: stringField,
  feature_jump_to_series: stringField,
  comments_section_label: stringField,
  comments_headline: stringField,
  comments_description: stringField,
  comments_scroll_annotation: stringField,
  comments_relative_today: stringField,
  comments_relative_days: stringField,
  comments_relative_weeks: stringField,
  comments_relative_months: stringField,
  comments_relative_years: stringField,
  archive_section_label: stringField,
  archive_headline: stringField,
  archive_search_placeholder: stringField,
  archive_search_aria: stringField,
  archive_channel_label: stringField,
  archive_channel_aria: stringField,
  archive_channel_both: stringField,
  archive_clear_all: stringField,
  archive_series_label: stringField,
  archive_series_aria: stringField,
  archive_tags_aria: stringField,
  archive_video_singular: stringField,
  archive_video_plural: stringField,
  archive_filtered: stringField,
  archive_newest_first: stringField,
  archive_no_videos: stringField,
  archive_clear_filters: stringField,
  archive_load_more: stringField,
  archive_latest: stringField,
  card_views: stringField,
  channel_subs: stringField,
  channel_videos: stringField,
  channel_open: stringField,
  subscribe_floating_label: stringField,
  subscribe_headline: stringField,
  subscribe_description: stringField,
  subscribe_subs: stringField,
  subscribe_button: stringField,
  empty_headline: stringField,
  empty_description: stringField,
  empty_subscribe_button: stringField,
}) satisfies z.ZodType<YouTubeStrings>

export async function loadPageContent(locale: string) {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const { data } = await supabase
    .from('page_content')
    .select('content')
    .eq('site_id', siteId)
    .eq('page', 'youtube')
    .eq('locale', locale)
    .maybeSingle()

  const defaults = locale === 'pt-BR' ? YOUTUBE_PT : YOUTUBE_EN
  return { ...defaults, ...(data?.content as Partial<YouTubeStrings> ?? {}) } as YouTubeStrings
}

export async function savePageContent(locale: string, content: Record<string, string>) {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'admin' })
  if (!res.ok) throw new Error('forbidden')

  const parsed = youtubeStringsSchema.parse(content)
  const supabase = getSupabaseServiceClient()

  await supabase.from('page_content').upsert(
    {
      site_id: siteId,
      page: 'youtube',
      locale,
      content: parsed,
      updated_at: new Date().toISOString(),
      updated_by: res.user.id,
    },
    { onConflict: 'site_id,page,locale' },
  )

  revalidateTag('page-content:youtube')
  return { success: true }
}

export async function resetPageContent(locale: string) {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'admin' })
  if (!res.ok) throw new Error('forbidden')

  const defaults = locale === 'pt-BR' ? YOUTUBE_PT : YOUTUBE_EN
  const supabase = getSupabaseServiceClient()

  await supabase.from('page_content').upsert(
    {
      site_id: siteId,
      page: 'youtube',
      locale,
      content: defaults,
      updated_at: new Date().toISOString(),
      updated_by: res.user.id,
    },
    { onConflict: 'site_id,page,locale' },
  )

  revalidateTag('page-content:youtube')
  return { success: true, content: defaults }
}
```

- [ ] **Step 2: Create CMS page (server component)**

```typescript
// apps/web/src/app/cms/(authed)/youtube/content/page.tsx
import { YouTubeContentEditor } from './content-editor'
import { loadPageContent } from './actions'

export const dynamic = 'force-dynamic'

export default async function YouTubeContentPage() {
  const en = await loadPageContent('en')
  const pt = await loadPageContent('pt-BR')

  return <YouTubeContentEditor initialEn={en} initialPt={pt} />
}
```

- [ ] **Step 3: Create form component**

```typescript
// apps/web/src/app/cms/(authed)/youtube/content/content-editor.tsx
'use client'

import { useState, useTransition } from 'react'
import type { YouTubeStrings } from '@/lib/content/types'
import { savePageContent, resetPageContent } from './actions'

interface Section {
  id: string
  label: string
  fields: { key: keyof YouTubeStrings; label: string; type: 'text' | 'textarea'; hint?: string }[]
}

const SECTIONS: Section[] = [
  {
    id: 'hero_pt',
    label: 'Hero — PT Variant',
    fields: [
      { key: 'hero_pt_section_label', label: 'Section label', type: 'text' },
      { key: 'hero_pt_headline', label: 'Headline', type: 'text' },
      { key: 'hero_pt_description', label: 'Description', type: 'textarea' },
      { key: 'hero_pt_also_on', label: '"Also on" label', type: 'text' },
      { key: 'hero_pt_previously', label: '"Previously" label', type: 'text' },
    ],
  },
  {
    id: 'hero_en',
    label: 'Hero — EN Variant',
    fields: [
      { key: 'hero_en_section_label', label: 'Section label', type: 'text' },
      { key: 'hero_en_headline_line1', label: 'Headline line 1', type: 'text' },
      { key: 'hero_en_headline_line2', label: 'Headline line 2 (accent)', type: 'text' },
      { key: 'hero_en_description', label: 'Description', type: 'textarea' },
      { key: 'hero_en_previously', label: '"Previously" label', type: 'text' },
    ],
  },
  {
    id: 'stats',
    label: 'Stats Strip',
    fields: [
      { key: 'stats_videos_published', label: 'Videos published', type: 'text' },
      { key: 'stats_hours_of_content', label: 'Hours of content', type: 'text' },
      { key: 'stats_comments_answered', label: 'Comments answered', type: 'text' },
      { key: 'stats_most_watched', label: 'Most watched', type: 'text' },
    ],
  },
  {
    id: 'feature',
    label: 'Featured Pick',
    fields: [
      { key: 'feature_section_label', label: 'Section label', type: 'text' },
      { key: 'feature_headline', label: 'Headline', type: 'textarea' },
      { key: 'feature_my_pick', label: '"My pick" annotation', type: 'text' },
      { key: 'feature_also_dropped', label: '"Also dropped" label', type: 'text' },
      { key: 'feature_jump_to_series', label: '"Jump to series" label', type: 'text' },
    ],
  },
  {
    id: 'comments',
    label: 'Comments Wall',
    fields: [
      { key: 'comments_section_label', label: 'Section label', type: 'text' },
      { key: 'comments_headline', label: 'Headline', type: 'textarea' },
      { key: 'comments_description', label: 'Description', type: 'textarea' },
      { key: 'comments_scroll_annotation', label: '"Enough scrolling" annotation', type: 'text' },
      { key: 'comments_relative_today', label: 'Relative: today', type: 'text' },
      { key: 'comments_relative_days', label: 'Relative: days', type: 'text', hint: 'Use {n} for the number, e.g. "{n}d ago"' },
      { key: 'comments_relative_weeks', label: 'Relative: weeks', type: 'text', hint: 'Use {n} for the number' },
      { key: 'comments_relative_months', label: 'Relative: months', type: 'text', hint: 'Use {n} for the number' },
      { key: 'comments_relative_years', label: 'Relative: years', type: 'text', hint: 'Use {n} for the number' },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    fields: [
      { key: 'archive_section_label', label: 'Section label', type: 'text' },
      { key: 'archive_headline', label: 'Headline', type: 'text' },
      { key: 'archive_search_placeholder', label: 'Search placeholder', type: 'text' },
      { key: 'archive_search_aria', label: 'Search aria-label', type: 'text' },
      { key: 'archive_channel_label', label: '"Channel:" label', type: 'text' },
      { key: 'archive_channel_aria', label: 'Channel aria-label', type: 'text' },
      { key: 'archive_channel_both', label: '"Both" button', type: 'text' },
      { key: 'archive_clear_all', label: '"Clear all" button', type: 'text' },
      { key: 'archive_series_label', label: '"Series:" label', type: 'text' },
      { key: 'archive_series_aria', label: 'Series aria-label', type: 'text' },
      { key: 'archive_tags_aria', label: 'Tags aria-label', type: 'text' },
      { key: 'archive_video_singular', label: 'Video (singular)', type: 'text' },
      { key: 'archive_video_plural', label: 'Videos (plural)', type: 'text' },
      { key: 'archive_filtered', label: '"Filtered" label', type: 'text' },
      { key: 'archive_newest_first', label: '"Newest first" annotation', type: 'text' },
      { key: 'archive_no_videos', label: 'No videos message', type: 'text' },
      { key: 'archive_clear_filters', label: '"Clear filters" button', type: 'text' },
      { key: 'archive_load_more', label: '"Load more" button', type: 'text' },
      { key: 'archive_latest', label: '"Latest" chip label', type: 'text' },
    ],
  },
  {
    id: 'shared',
    label: 'Shared',
    fields: [
      { key: 'card_views', label: '"Views" label', type: 'text' },
    ],
  },
  {
    id: 'channel',
    label: 'Channel Cards',
    fields: [
      { key: 'channel_subs', label: '"Subs" label', type: 'text' },
      { key: 'channel_videos', label: '"Videos" label', type: 'text' },
      { key: 'channel_open', label: '"Open" button', type: 'text' },
    ],
  },
  {
    id: 'subscribe',
    label: 'Subscribe CTA',
    fields: [
      { key: 'subscribe_floating_label', label: 'Floating label', type: 'text' },
      { key: 'subscribe_headline', label: 'Headline', type: 'textarea' },
      { key: 'subscribe_description', label: 'Description', type: 'textarea' },
      { key: 'subscribe_subs', label: '"Subs" label', type: 'text' },
      { key: 'subscribe_button', label: 'Button text', type: 'text' },
    ],
  },
  {
    id: 'empty',
    label: 'Empty State',
    fields: [
      { key: 'empty_headline', label: 'Headline', type: 'text' },
      { key: 'empty_description', label: 'Description', type: 'textarea' },
      { key: 'empty_subscribe_button', label: 'Subscribe button', type: 'text' },
    ],
  },
]

interface Props {
  initialEn: YouTubeStrings
  initialPt: YouTubeStrings
}

export function YouTubeContentEditor({ initialEn, initialPt }: Props) {
  const [locale, setLocale] = useState<'en' | 'pt-BR'>('en')
  const [enData, setEnData] = useState(initialEn)
  const [ptData, setPtData] = useState(initialPt)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [saving, startSave] = useTransition()
  const [toast, setToast] = useState<string | null>(null)

  const data = locale === 'en' ? enData : ptData
  const setData = locale === 'en' ? setEnData : setPtData

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function update(key: keyof YouTubeStrings, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    startSave(async () => {
      try {
        await savePageContent(locale, data)
        setToast('Saved!')
        setTimeout(() => setToast(null), 2000)
      } catch {
        setToast('Error saving')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  function handleReset() {
    if (!confirm('Reset all fields to defaults? This cannot be undone.')) return
    startSave(async () => {
      try {
        const result = await resetPageContent(locale)
        if (result.content) setData(result.content)
        setToast('Reset to defaults')
        setTimeout(() => setToast(null), 2000)
      } catch {
        setToast('Error resetting')
        setTimeout(() => setToast(null), 3000)
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Locale toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['en', 'pt-BR'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                locale === l
                  ? 'bg-orange-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {l === 'en' ? '🇺🇸 English' : '🇧🇷 Português'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-orange-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-500 transition disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {toast && (
        <div className="rounded-md bg-zinc-800 px-4 py-2 text-sm text-zinc-200">{toast}</div>
      )}

      {/* Sections */}
      {SECTIONS.map((section) => (
        <div key={section.id} className="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <button
            onClick={() => toggle(section.id)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-zinc-200">{section.label}</span>
            <span className="text-xs text-zinc-500">
              {collapsed.has(section.id) ? '▸' : '▾'} {section.fields.length} fields
            </span>
          </button>
          {!collapsed.has(section.id) && (
            <div className="space-y-3 border-t border-zinc-800 px-4 py-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">
                    {field.label}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={data[field.key]}
                      onChange={(e) => update(field.key, e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={data[field.key]}
                      onChange={(e) => update(field.key, e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500 focus:outline-none"
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1 text-xs text-zinc-500">{field.hint}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Add Content tab to YouTube CMS layout**

In `apps/web/src/app/cms/(authed)/youtube/layout.tsx`, add to the TABS array:
```typescript
const TABS = [
  { label: 'Dashboard', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },
  { label: 'Categories', href: '/cms/youtube/categories' },
  { label: 'Comments', href: '/cms/youtube/comments' },
  { label: 'Content', href: '/cms/youtube/content' },  // ← add
] as const
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/content/ \
        apps/web/src/app/cms/\(authed\)/youtube/layout.tsx
git commit -m "feat: add CMS content editor for YouTube page strings"
```

---

## Task 10: Tests

**Depends on:** All above
**Files:**
- Create: `apps/web/test/lib/content/fetch.test.ts`
- Create: `apps/web/test/lib/content/template.test.ts`

- [ ] **Step 1: Test template helper**

```typescript
// apps/web/test/lib/content/template.test.ts
import { describe, it, expect } from 'vitest'
import { t } from '../../../src/lib/content/template'

describe('t() template interpolation', () => {
  it('replaces {n} with number', () => {
    expect(t('{n}d ago', { n: 5 })).toBe('5d ago')
  })

  it('replaces multiple placeholders', () => {
    expect(t('{a} and {b}', { a: 1, b: 2 })).toBe('1 and 2')
  })

  it('leaves unknown placeholders as-is', () => {
    expect(t('{n}d {x}', { n: 3 })).toBe('3d x')
  })

  it('handles string with no placeholders', () => {
    expect(t('hello world', { n: 1 })).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(t('', { n: 1 })).toBe('')
  })
})
```

- [ ] **Step 2: Test fetch helper**

```typescript
// apps/web/test/lib/content/fetch.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: Function) => fn,
}))

const mockRows: { locale: string; content: Record<string, string> }[] = []

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockRows }),
      }),
    }),
  }),
}))

import { getPageContent } from '../../../src/lib/content/fetch'

const enDefaults = { greeting: 'hello', farewell: 'bye' }
const ptDefaults = { greeting: 'olá', farewell: 'tchau' }

describe('getPageContent', () => {
  it('returns EN defaults when DB is empty', async () => {
    mockRows.length = 0
    const result = await getPageContent('site1', 'test', 'en', {
      en: enDefaults as any,
      pt: ptDefaults as any,
    })
    expect(result.greeting).toBe('hello')
  })

  it('returns PT defaults when DB is empty and locale is pt-BR', async () => {
    mockRows.length = 0
    const result = await getPageContent('site1', 'test', 'pt-BR', {
      en: enDefaults as any,
      pt: ptDefaults as any,
    })
    expect(result.greeting).toBe('olá')
  })

  it('merges DB content over defaults', async () => {
    mockRows.length = 0
    mockRows.push({ locale: 'en', content: { greeting: 'hey' } })
    const result = await getPageContent('site1', 'test', 'en', {
      en: enDefaults as any,
      pt: ptDefaults as any,
    })
    expect(result.greeting).toBe('hey')
    expect(result.farewell).toBe('bye')
  })

  it('falls back field-level from pt-BR to en', async () => {
    mockRows.length = 0
    mockRows.push({ locale: 'en', content: { greeting: 'hey', farewell: 'see ya' } })
    mockRows.push({ locale: 'pt-BR', content: { greeting: 'oi' } })
    const result = await getPageContent('site1', 'test', 'pt-BR', {
      en: enDefaults as any,
      pt: ptDefaults as any,
    })
    expect(result.greeting).toBe('oi')
    expect(result.farewell).toBe('see ya')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm run test:web -- --run test/lib/content/
```

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/lib/content/
git commit -m "test: add page content fetch and template tests"
```
