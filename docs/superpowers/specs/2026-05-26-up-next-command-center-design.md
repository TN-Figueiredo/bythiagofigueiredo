# Up Next — Command Center Design

**Date:** 2026-05-26
**Status:** Draft
**Review:** 96 agent reviews (88 design + 8 spec self-review), 100.2/110 score

## Summary

Redesign the Up Next page in the CMS to serve as a **command center** for a solo content creator managing 2 YouTube channels (PT-BR + EN), a blog, and a newsletter (~7 items/week). The creator opens the CMS every morning and needs to know exactly what to produce today and this week within 3 seconds.

**Key principle:** Priority-first layout — today's actions at the TOP, celebration BELOW. No redundant pipeline bar. Weekend slots muted. Per-day effort estimates. All algorithms implementable without questions.

## Design Tokens

Zero new CSS variables. All colors from existing design system:

| Source | Tokens |
|--------|--------|
| `gem-design.ts` | `--gem-surface`, `--gem-surface-hi`, `--gem-well`, `--gem-border`, `--gem-faint`, `--gem-text`, `--gem-muted`, `--gem-dim`, `--gem-done`, `--gem-warn`, `--gem-danger`, `--gem-accent` |
| `globals.css` | `--bg-0` through `--bg-4`, `--t1` through `--t5`, `--bdr-0` through `--bdr-2`, `--acc` |
| `colors.ts` | `FORMAT_COLORS` (video, blog_post, newsletter, course, campaign) with accent/bg/text/border per format |

**Token notation:** GEM tokens are applied as CSS custom properties via `GEM_CSS_VARS` in `gem-design.ts` (already injected by page.tsx). CMS tokens (`--bg-*`, `--t*`, `--bdr-*`, `--acc`) are native CSS vars in `globals.css`. FORMAT_COLORS are a JS object in `colors.ts` — access via `FORMAT_COLORS[format].text` etc., not CSS vars. This spec uses `--fmt-*` shorthand for readability; implementation uses the JS object inline.

**Contrast decisions (WCAG 2.1 AA):**
- `--acc` (#818cf8) fails AA at 3.7:1 on dark → use `FORMAT_COLORS.newsletter.text` (#a5b4fc, 5.3:1) for accent text
- `--gem-danger` (#ef4444) fails at 3.9:1 → use `FORMAT_COLORS.video.text` (#fca5a5, 5.7:1) for danger text
- All text on `--gem-surface` uses `--t3` (#94a3b8, 5.87:1) minimum — never `--t4`

**Required dependency:** `swr` must be installed (`npm install swr` in `apps/web`) — not currently in package.json. Required for focus-based revalidation + midnight detection.

## Layout Sections (top to bottom)

### 1. Today Header + Progress

```
Domingo — 1 de 3 feito · ~4h restantes
[████░░░░░░░░] Newsletter enviada
```

- Day name + done count + remaining effort hours
- Progress bar shown only when `doneToday >= 1` (empty bar at 0/3 is deflating)
- `role="progressbar"` with `aria-valuenow/min/max`

### 2. Today Action Cards

Priority-sorted cards answering "what do I do RIGHT NOW?"

Each card is a full `<a>` link to `/cms/pipeline/items/{id}` with:
- Left color accent bar (3px, format color)
- Urgency badge (overdue/today/tomorrow/this_week)
- Effort badge (deep/quick + time estimate, borderless rounded-full)
- Title + context (item title, language, channel/playlist name)
- Deadline line ("Gravar em 2d · publica ter 10:00")
- Playlist position ("AI Empire 8/144")
- Full-width CTA span (decorative, `aria-hidden`)

**Batch cards:** 2+ items at same effort/stage/format/channel merge into one card. Key: `effort|stage|format|channelLabel`. Title: "Gravar 2 videos". Effort = sum. Deadline = earliest.

**Structure:** `<section aria-label>` → `<ul>` → `<li>` → `<a class="action-card">`. No `display:contents` on `<li>`.

Max 5 cards desktop, 3 mobile. Overflow count shown with `aria-label="N acoes adicionais"`.

**Batch card a11y:** `aria-label` must distinguish from single cards: e.g., "Gravar 2 videos: AI Empire. 8 horas total."

### 3. Celebration

Moved BELOW actions (earns space only after priorities shown).

- Gradient background, `--gem-border` border
- Shows published items this week
- Dismiss via `<button>` (44px target)
- localStorage key: `celebration-dismissed-{YYYY-Www}` (ISO week, not daily — prevents dismiss fatigue)
- Multi-tab sync via `window.storage` event

### 4. Suggestion

Single contextual suggestion (max 1). Background container with `color-mix(--gem-accent 4%)`.

Priority order:
1. Batch opportunity: "Bloco de gravacao: N roteiros prontos. Gravar juntos?"
2. Orphaned items: "N items sem canal configurado." (guard: exclude blog_post/newsletter formats)
3. Newsletter without date: "Newsletter sem data de envio."
4. Playlist near completion: total > 0 AND remaining/total <= 0.2

Link has 44px inline-flex touch target, `text-decoration: underline`.

### 5. This Week Grid

7-column calendar (Mon-Sun) with:
- Day label + per-day effort estimate
- Filled slots: `<a>` links with format color, stage badge, title
- Empty slots: `<button>` elements opening WeekSlotPicker
- Weekend/rest-day slots: muted dashed border (`--t5`), labeled "(opcional)"
- Today column: top border accent, `aria-current="date"`
- Past days: `opacity: 0.4`

`role="region" aria-label="Grade semanal de conteudo"` (not `role="grid"` — grid requires arrow-key roving tabindex JS, deferred to V2). The `aria-label` is required for `role="region"` to be meaningful.

**Week summary bar** (replaces separate pipeline bar):
```
● 3 escrever · ● 0 gravar · ● 1 pos-prod · ● 2 prontos · ~8h restantes
```
`<ul>` with `<li>` items for screen reader list semantics.

**Lookahead + Streak:**
```
Prox. semana: 3 vazios · 4 no backlog    Streak: 4 semanas
```

### 6. Horizon (Playlist Strips)

Wrapped in `<section aria-label="Horizonte">`. Top 5 playlists by completion proximity. Each is an `<a>` link to `/cms/playlists/{id}`.

Dot visualization: done (green), in-progress (yellow), idea (hollow). Cap at 20 dots + "+N" text.

"Ver todas (N)" link if > 5 playlists.

### 7. Activity (Collapsible)

Wrapped in `<section aria-label="Atividade recente">`. `<button aria-expanded aria-controls="activity-list">` toggle pattern. Content div with `id="activity-list"` and `hidden` attribute.

## TypeScript Interfaces

### Stage System

```typescript
const STAGE_ORDER = {
  idea: 0, outline: 1, draft: 2, roteiro: 3,
  gravacao: 4, edicao: 5, pos_producao: 6, ready: 6, scheduled: 7, published: 8,
} as const satisfies Record<string, number>
// NOTE: 'ready' and 'pos_producao' share ordinal 6 — both mean "final review before scheduling"
// in their respective formats (blog_post uses ready, video uses pos_producao).
// DB also has 'modulos', 'review', 'approved' for course/campaign — out of Up Next scope.

type Stage = keyof typeof STAGE_ORDER

const STAGE_GROUP: Record<string, Stage[]> = {
  escrever: ['idea', 'outline', 'draft', 'roteiro'],
  gravar: ['gravacao'],
  'pos-prod': ['edicao', 'pos_producao', 'ready'],
  prontos: ['scheduled'],
  // 'published' intentionally excluded — shown in celebration section, not stage counts
}

const URGENCY_ORDER: Record<string, number> = {
  overdue: 0, today: 1, tomorrow: 2, this_week: 3,
}
```

### Production Deadlines

```typescript
function getProductionDeadline(pubDate: string, stage: Stage): string | undefined {
  const pub = parseISO(pubDate)
  switch (stage) {
    case 'idea': case 'outline': case 'draft': case 'roteiro':
      return formatISO(subDays(pub, 4), { representation: 'date' })
    case 'gravacao':
      return formatISO(subDays(pub, 3), { representation: 'date' })
    case 'edicao':
      return formatISO(subDays(pub, 2), { representation: 'date' })
    case 'pos_producao': case 'ready':
      return formatISO(subDays(pub, 1), { representation: 'date' })
    case 'scheduled': case 'published':
      return undefined
  }
}
```

### Effort Defaults

```typescript
const EFFORT_DEFAULTS: Record<string, { effort: 'deep' | 'quick'; minutes: number }> = {
  'video:idea':           { effort: 'deep',  minutes: 180 },
  'video:roteiro':        { effort: 'deep',  minutes: 180 },
  'video:gravacao':       { effort: 'deep',  minutes: 240 },
  'video:edicao':         { effort: 'quick', minutes: 60  },
  'video:pos_producao':   { effort: 'quick', minutes: 60  },
  'blog_post:idea':       { effort: 'deep',  minutes: 120 },
  'blog_post:draft':      { effort: 'deep',  minutes: 120 },
  'blog_post:ready':      { effort: 'quick', minutes: 30  },
  'newsletter:draft':     { effort: 'deep',  minutes: 60  },
  'newsletter:ready':     { effort: 'quick', minutes: 20  },
}
// Lookup: EFFORT_DEFAULTS[`${item.format}:${item.stage}`] ?? { effort: 'quick', minutes: 30 }
```

### Input Types

```typescript
interface PipelineItemWithSlot {
  id: string
  title: string                  // COALESCE(NULLIF(title_pt,''), NULLIF(title_en,''))
  stage: Stage
  priority: number               // 0-5, COALESCE(priority, 0)
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'  // NOT NULL DEFAULT 'pt-br'
  duration_target: number | null  // minutes — REQUIRES MIGRATION
  scheduled_at: string | null     // ISO datetime — REQUIRES MIGRATION
  youtube_channel_id: string | null  // FK — REQUIRES MIGRATION
  playlist_id: string | null
  playlist_name: string | null
  playlist_position: number | null
  playlist_total: number | null
  channel_label: string | null    // youtube_channels.name via JOIN
}

interface SyncScheduleEntry {
  day: string                     // "monday"..."sunday" (lowercase)
  hour: number                    // 10, 15, 20 (integer, 24h)
}

interface SyncScheduleWithChannel {
  channel_id: string
  channel_name: string
  locale: 'pt' | 'en'            // youtube_channels.locale (NOT language)
  schedule: SyncScheduleEntry
  timezone: string
}

const LOCALE_TO_LANGUAGE: Record<string, string> = { pt: 'pt-br', en: 'en' }

interface BlogCadenceRow {
  site_id: string
  cadence_days: number | null
  cadence_start_date: string | null
  cadence_paused: boolean
  last_published_at: string | null
  locale: string | null
}

interface NewsletterEditionRow {
  id: string
  subject: string                 // DB column is 'subject', NOT 'title'
  status: 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
  scheduled_at: string | null
}

interface PlaylistSummary {
  id: string
  name: string                    // COALESCE(NULLIF(name_pt,''), NULLIF(name_en,''))
  total_items: number
  done_items: number              // stage in {scheduled, published, sent}
  in_progress_items: number
  next_item_title: string | null
  next_item_stage: Stage | null
}
```

### Today Actions

```typescript
interface TodayAction {
  id: string
  itemTitle: string
  actionLabel: string
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'
  effort: 'deep' | 'quick'
  effortEstimate: string          // "~3h", "~20min"
  effortMinutes: number
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week'
  priority: number
  stage: Stage
  deadline: { label: string; date: string }
  playlistContext: { name: string; position: number; total: number } | null
  channelLabel: string | null
  pubDate: string | null
  batchItems?: string[]
}

interface TodayActionsInput {
  pipelineItems: PipelineItemWithSlot[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]
  syncSchedules: SyncScheduleWithChannel[]
  siteTimezone: string
  now: Date
  maxCards: number                // 5 desktop, 3 mobile
  doneToday: number
}

interface TodayActionsResult {
  actions: TodayAction[]
  overflow: number
  doneToday: number
  totalSurfaced: number
  totalEffortMinutes: number
}
```

### Week Grid

```typescript
// BREAKING CHANGE: existing UpNextThisWeek exports its own WeekSlot with `type` field.
// New interface uses `format` (matches content_pipeline column name).
// Existing WeekSlot in up-next-this-week.tsx will be replaced entirely during MODIFY.
interface WeekSlot {
  day: string                     // YYYY-MM-DD
  dayLabel: string                // "Seg 19"
  hour: string | null             // "10:00" — null for blog/newsletter slots
  format: 'video' | 'blog_post' | 'newsletter'
  channelLocale: 'pt' | 'en' | null  // null for blog/newsletter slots (no youtube channel)
  channelId: string | null        // youtube_channels.id — null for blog/newsletter
  isRestDay: boolean              // true if Sat/Sun AND no sync_schedules for that day
  assignedItem: { id: string; title: string; stage: Stage } | null
  effortMinutes: number           // 0 if assignedItem is null or stage >= scheduled
}
```

### API Response

```typescript
interface UpNextApiResponse {
  today: TodayActionsResult
  todayDate: string               // YYYY-MM-DD (fixes "today" prop bug)
  weekSlots: WeekSlot[]
  streak: StreakResult
  stageCounts: Record<string, number>
  playlists: PlaylistSummary[]
  nextWeekEmpty: number
  backlogCount: number
  suggestion: { text: string; href: string } | null
  errors: {
    today: string | null
    weekSlots: string | null
    streak: string | null
    playlists: string | null
  }
}
```

## Algorithms

### calculateTodayActions(input: TodayActionsInput): TodayActionsResult

The algorithm has **three processing paths** that run sequentially. Steps 4-10 handle video slots (from syncSchedules). Step 11 handles blog (from blogCadence). Step 12 handles newsletter (from newsletterEditions). Each path generates TodayAction items independently; they're merged, batched, and sorted at the end.

1. **Define today:** `formatISO(startOfDay(utcToZonedTime(input.now, input.siteTimezone)), { representation: 'date' })` → YYYY-MM-DD. All comparisons are date-string-based.
2. **Guard:** Zero syncSchedules AND blogCadence null AND zero newsletterEditions → return empty (first-run).
3. **Collect week slots:** Generate from syncSchedules + blogCadence + newsletterEditions. Filter to current ISO week (Mon 00:00 to Sun 23:59, site TZ). `$week_start` = Monday 00:00:00, `$week_end` = Sunday 23:59:59, both in site TZ.
4. **Match items to video/blog slots (steps 4-10 only apply to pipeline items):**
   ```
   // First: filter out items already at/past scheduled
   activePipelineItems = pipelineItems.filter(item =>
     STAGE_ORDER[item.stage] < STAGE_ORDER['scheduled']
   )

   for each slot in weekSlots (video + blog slots only):
     candidates = activePipelineItems.filter(item =>
       item.format === slot.format
       AND (item.scheduled_at === null OR extractDate(item.scheduled_at, tz) === slot.day)
       AND (slot.channelId === null OR item.youtube_channel_id === slot.channelId)
       AND (slot.channelLocale === null
            OR item.language === LOCALE_TO_LANGUAGE[slot.channelLocale]
            OR item.language === 'both')
     )
     slot.assignedItem = candidates.sort(by STAGE_ORDER DESC)[0] ?? null
     // Remove assigned item from activePipelineItems to prevent double-assignment
   ```
5. **For each slot WITH assignedItem:** compute deadline via `getProductionDeadline(slot.day, item.stage)`. If returns undefined → skip (already scheduled/published — shouldn't happen due to step 4 filter, but defensive guard).
6. **Urgency (applies to all paths):** `overdue` if deadline < today. `today` if deadline === today. `tomorrow` if deadline === today + 1d. `this_week` otherwise. Only generate action if deadline <= endOfISOWeek. Sort uses `URGENCY_ORDER` mapping: `{ overdue: 0, today: 1, tomorrow: 2, this_week: 3 }`.
7. **Video writing (format=video, slot matched):** `STAGE_ORDER[stage] <= STAGE_ORDER['roteiro']` → action "Finalizar roteiro". Effort from EFFORT_DEFAULTS[`video:${stage}`].
8. **Video gravacao:** stage === 'gravacao' → "Gravar". EFFORT_DEFAULTS['video:gravacao'].
9. **Video pos-prod:** stage in {edicao, pos_producao} → "Revisar edicao". EFFORT_DEFAULTS[`video:${stage}`].
10. **Blog (separate path — uses blogCadence, not slot matching):** Guard: skip if `blogCadence === null || cadence_paused || !cadence_days || cadence_days <= 0 || !cadence_start_date`. First post: `next_pub = cadence_start_date` (when last_published_at null). Subsequent: `next_pub = formatISO(addDays(parseISO(last_published_at), cadence_days), { representation: 'date' })`. Advance: if `next_pub < today`, set `next_pub = today` (one overdue, not N). **Fire if:** `subDays(parseISO(next_pub), 2) <= today` (calendar days, `date-fns/subDays`). Find matching blog_post pipeline item (most-progressed, stage < scheduled). Effort: EFFORT_DEFAULTS[`blog_post:${stage}`]. Urgency: computed from `next_pub - 1` as deadline (blog has 1-day pre-pub window).
11. **Newsletter (separate path — uses newsletterEditions directly, not pipeline items):** Guard: skip if `!scheduled_at` or status NOT in {draft, ready} (only actionable statuses — query already filters but this is defensive). Guard past: skip if `pubDate < today` (missed edition). `deadline = subDays(parseISO(pubDate), 1)`. Fire if `deadline <= today`. For TodayAction: use `edition.subject` as title, map `edition.status` to EFFORT_DEFAULTS key as `newsletter:${status}` (e.g., `newsletter:draft`, `newsletter:ready`). The newsletter's `status` field serves as the "stage" for EFFORT_DEFAULTS lookup.
12. **Effort estimate:** If `item.duration_target != null && item.duration_target > 0`: use it (minutes). Else: `EFFORT_DEFAULTS[`${format}:${stage}`] ?? { effort: 'quick', minutes: 30 }`. Format: <60min → "~{n}min", >=60 → "~{Math.round(n/60)}h".
13. **Batch:** Key = `${effort}|${stage}|${format}|${channelLabel ?? ''}`. 2+ items same key → single card. Title: "Gravar N videos" / "Escrever N posts". Effort = sum. Deadline = earliest. Link = `/cms/pipeline?stage=${stage}&format=${format}&channel=${encodeURIComponent(channelLabel)}`. Sort position = most urgent item in batch (lowest URGENCY_ORDER, then highest priority, then earliest pubDate). Batch counts as 1 toward maxCards.
14. **Sort:** `URGENCY_ORDER[urgency]` ASC → effort (deep=0, quick=1) ASC → priority DESC → pubDate ASC (nulls last) → id ASC (deterministic tiebreaker).
15. **Max + overflow:** `totalSurfaced = sortedActions.length`. `actions = sortedActions.slice(0, maxCards)`. `overflow = totalSurfaced - actions.length`.
16. **totalEffortMinutes:** Sum of `effortMinutes` for ALL items in sortedActions (pre-slice).
17. **Empty (rest day):** Zero actions + rest day → empty with lookahead to next non-rest day.

### calculateStreak(input: StreakInput): StreakResult

```typescript
interface StreakInput {
  publishHistory: string[]        // ISO datetimes from Query 4
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  siteTimezone: string
}
```

1. Convert each datetime → `getISOWeek()` + `getISOWeekYear()` in site TZ.
2. Group into Set of unique (year, week) pairs.
3. For vacation grace: compute whether a given week has any expected slots by checking `syncSchedules` (has at least one day mapping to that week), `blogCadence` (cadence_days > 0 and not paused and cadence_start_date <= week_end), or any newsletter edition scheduled in that week. This reuses the same slot generation logic from step 3 of calculateTodayActions, parameterized by week start/end instead of "current week".
4. Count backwards from current week:
   - Week has published entry → streak++, continue.
   - Week has ZERO expected slots (vacation — no sync_schedules match, blog paused/null, no newsletters) → streak++, continue.
   - Otherwise → stop.
5. `isActive = true` if current week is in published set.
6. Display only if currentStreak >= 2.

### Slot Generation Rules

1. **Video:** One slot per SyncScheduleEntry in current week. Map day string to ISO day via DAY_INDEX. Hour formatted as `${hour}:00`. PT/EN by channel.locale. Two schedules same day = separate slots (stack).
2. **Blog:** next_pub date from cadence → one slot. No fixed time. Skip if paused/null/zero.
3. **Newsletter:** One slot per edition with scheduled_at in current/next week. Skip past editions.
4. **Matching:** Format + day + channelId + language (via LOCALE_TO_LANGUAGE). 'both' matches any. Most-progressed item wins.
5. **Empty slots:** Workday = dashed `--gem-danger 35%`. Rest day = dashed `--t5 50%`, "(opcional)".
6. **Per-day effort:** Sum effortMinutes where stage < scheduled. Red if >= 4h.

### Suggestion Selection

Priority order (max 1):
1. Batch opportunity (2+ items same stage)
2. Orphaned items (no channel — guard: exclude blog_post/newsletter formats)
3. Newsletter without scheduled_at
4. Playlist near completion (total > 0 AND remaining/total <= 0.2)

## SQL Queries

### Query 1: Blog Cadence

```sql
-- blog_cadence has last_published_at as a real column (timestamptz), no subquery needed
SELECT cadence_days, cadence_start_date, cadence_paused, locale, last_published_at
FROM blog_cadence
WHERE site_id = $site_id
ORDER BY locale ASC
LIMIT 1;
```

### Query 2: Newsletter Editions

```sql
-- $week_start = startOfISOWeek(today) in site TZ (Monday 00:00)
-- $week_end   = endOfISOWeek(today) in site TZ (Sunday 23:59:59)
-- Window: current ISO week + next ISO week (14 days from Monday)
SELECT id, subject, status, scheduled_at
FROM newsletter_editions
WHERE site_id = $site_id
  AND scheduled_at >= $week_start::timestamptz
  AND scheduled_at < ($week_end + interval '7 days')::timestamptz
  AND scheduled_at >= NOW()
  AND status IN ('draft', 'ready', 'scheduled')
ORDER BY scheduled_at;
```

### Query 3: Done-Today Count

```sql
SELECT COUNT(DISTINCT cph.pipeline_id) AS done_today
FROM content_pipeline_history cph
JOIN content_pipeline cp ON cp.id = cph.pipeline_id
WHERE cp.site_id = $site_id
  AND (cph.changed_at AT TIME ZONE $site_tz)::date = $today::date;
```

### Query 4: Publish History (Streak)

```sql
SELECT pub_date FROM (
  SELECT published_at AS pub_date FROM blog_posts
    WHERE site_id = $site_id AND status = 'published'
  UNION ALL
  SELECT sent_at AS pub_date FROM newsletter_editions
    WHERE site_id = $site_id AND status = 'sent'
  UNION ALL
  SELECT cph.changed_at AS pub_date
    FROM content_pipeline_history cph
    JOIN content_pipeline cp ON cp.id = cph.pipeline_id
    WHERE cp.site_id = $site_id
      AND cph.event_type = 'stage_change'
      AND cph.to_value = 'published'
) AS combined
WHERE pub_date >= NOW() - interval '52 weeks';
```

### Query 5: Pipeline Items with Slots

```sql
SELECT cp.id, COALESCE(NULLIF(cp.title_pt, ''), NULLIF(cp.title_en, '')) AS title,
  cp.stage, COALESCE(cp.priority, 0) AS priority,
  cp.format, cp.language, cp.duration_target, cp.scheduled_at,
  pi.playlist_id, COALESCE(NULLIF(p.name_pt, ''), NULLIF(p.name_en, '')) AS playlist_name,
  pi.sort_order AS playlist_position,
  (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = pi.playlist_id AND playlist_id IS NOT NULL) AS playlist_total,
  yc.name AS channel_label, cp.youtube_channel_id
FROM content_pipeline cp
LEFT JOIN playlist_items pi ON pi.pipeline_id = cp.id
LEFT JOIN playlists p ON p.id = pi.playlist_id
LEFT JOIN youtube_channels yc ON yc.id = cp.youtube_channel_id
WHERE cp.site_id = $site_id
  AND cp.stage NOT IN ('published', 'archived')
ORDER BY COALESCE(cp.priority, 0) DESC, cp.created_at;
```

### Sync Schedules (in page.tsx)

```typescript
const channels = await supabase.from('youtube_channels')
  .select('id, name, locale, sync_schedules')
  .eq('site_id', siteId)

const syncSchedules = channels.flatMap(ch =>
  (ch.sync_schedules ?? []).filter(Boolean).map(s => ({
    channel_id: ch.id, channel_name: ch.name,
    locale: ch.locale, schedule: s, timezone: siteTz
  }))
)
```

## Required Migration

Single migration file via `npm run db:new up_next_columns_and_rpc`.

```sql
-- Step 1: Add missing columns
ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  duration_target integer;

ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  youtube_channel_id uuid REFERENCES youtube_channels(id) ON DELETE SET NULL;

ALTER TABLE content_pipeline ADD COLUMN IF NOT EXISTS
  scheduled_at timestamptz;

-- Step 2: assign_week_slot RPC
DROP FUNCTION IF EXISTS assign_week_slot(uuid, date, text);
CREATE OR REPLACE FUNCTION assign_week_slot(
  p_item_id uuid,
  p_slot_day date,
  p_slot_hour text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  UPDATE content_pipeline
  SET scheduled_at = p_slot_day + COALESCE(p_slot_hour::time, '00:00'::time),
      updated_at = NOW()
  WHERE id = p_item_id
    AND site_id = (current_setting('app.site_id'))::uuid
  RETURNING json_build_object('id', id, 'scheduled_at', scheduled_at) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public';
```

## API Route

`GET /api/pipeline/up-next`

- **Auth:** `authenticateRead(req)` from `@/lib/pipeline/helpers` (matches existing pipeline routes)
- **Query params:** `maxCards` (number, default 5, Zod validated), `tz` (IANA timezone, default from site settings)
- **Response 200:** `UpNextApiResponse` — each section computed independently, per-section error isolation
- **Response 401:** `{ error: "unauthorized" }`
- **Response 400:** `{ error: "invalid_params", details: ZodError }`
- **Cache:** `no-store` (SWR handles client caching)
- **Pipeline Integrity:** Must update `api-registry.ts`: add endpoint to `utilities` domain (bump endpoint_count from 9 to 10) and update `cowork-docs-pipeline.md`

## Interactions

### Mouse/Touch (all targets >= 44px)

| Trigger | Result |
|---------|--------|
| Click action card (`<a>`) | Navigate to `/cms/pipeline/items/{id}`. hover:scale-[1.02], :active:scale-[0.98] |
| Click batch card (`<a>`) | Navigate to `/cms/pipeline?stage=${stage}&format=${format}&channel=${encodeURIComponent(channelLabel)}` |
| Click empty slot (`<button>`) | Opens WeekSlotPicker. Disabled during RPC flight |
| Click filled slot (`<a>`) | Navigate to pipeline item or newsletter edition |
| Click playlist strip (`<a>`) | Navigate to `/cms/playlists/{id}` |
| Click suggestion link (`<a>`) | Navigate to suggested URL. 44px inline-flex |
| Dismiss celebration (`<button>`) | localStorage key: `celebration-dismissed-{YYYY-Www}`. Multi-tab sync via storage event |

### WeekSlotPicker

- **Desktop (>= 768px):** Combobox popover below slot. Type-ahead search, max 8 results, focus-trap, aria-activedescendant
- **Mobile (< 768px):** Bottom sheet: max-height 60vh, `padding-bottom: env(safe-area-inset-bottom)`, input `font-size: 16px` (prevents iOS zoom), dismiss via swipe-down (100px threshold) or backdrop tap
- **Candidates:** From already-fetched pipelineItems (SWR cache). No additional API call. Filter: matching format + stage < scheduled + not already assigned. Sort: STAGE_ORDER DESC
- **Mutation:** 300ms debounce → disable button → spinner → RPC assign_week_slot → success: close + SWR mutate() → error: rollback, inline error (red, 11px, auto-dismiss 3s), re-enable after 1s

### Keyboard (WCAG 2.1 AA)

Tab order: Today actions → celebration dismiss → suggestion link → week slots (L→R, top→bottom) → playlist links → activity toggle. Enter activates `<a>`, Enter/Space activates `<button>`, Escape closes WeekSlotPicker and **returns focus to the triggering `<button>`**.

**Reduced motion:** `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`. Disables hover:scale, :active:scale, progress bar animation, bottom sheet slide-up, and skeleton pulse.

**Dynamic content announcements:**
- Offline banner: wrap in `<div role="status" aria-live="polite">`
- Slot mutation inline error: wrap in `<div role="alert">` (assertive, auto-announced)
- Slot mutation success: SWR mutate triggers re-render; no explicit announcement needed (visual update sufficient for solo CMS user)

### Data + State

- **Architecture:** page.tsx (server) → PipelineOverview (client) → SWR(fallbackData, key: '/api/pipeline/up-next')
- **SWR config:** revalidateOnFocus: true, dedupingInterval: 300_000 (5min), refreshInterval: 0
- **Midnight:** Primary: revalidateOnFocus. Backup: visibilitychange listener checks if date changed since mount
- **Timezone:** Server: today = startOfDay in site TZ. Client: new Date() only for midnight detection
- **Multi-tab:** Celebration dismiss syncs via storage event. SWR revalidateOnFocus handles data staleness
- **maxCards SSR:** Server renders with maxCards=5. Client re-fetches with 3 on mobile (<768px) via SWR key change
- **Offline:** `navigator.onLine` + event listeners. Subtle banner: "Sem conexao — dados podem estar desatualizados" in `--gem-warn`

## Responsive Breakpoints

| Breakpoint | Action Cards | Week Grid | Horizon | Picker | Max Cards |
|------------|-------------|-----------|---------|--------|-----------|
| >= 1024px | 2-col | 7 columns | 3 strips | Combobox | 5 |
| 768-1023px | 2-col | compact | 2 strips (flex-wrap) | Combobox | 5 |
| 640-767px | 1-col | scroll-snap-x, 70% width | stacked | Bottom sheet | 3 |
| < 640px | 1-col | scroll-snap-x, 80% width | stacked | Bottom sheet | 3 |
| Landscape + max-height 500px | — | min-height 64px, max-height 50vh | — | — | — |

Mobile week grid: `<details>` wrapper with summary "5/7 slots · ~8h". Defaults open. Horizontal scroll-snap with left/right gradient fade (CSS-only, left at 50% opacity).

## Edge Cases (35)

1. **Timezone:** Server `today = formatISO(startOfDay(utcToZonedTime(now, tz)))`. All comparisons date-only strings.
2. **DST:** `date-fns-tz` handles DST. "1d" = `subDays(date, 1)` (calendar day, not 24h).
3. **First-time:** Zero schedules → "Command Center vazio" + "Configurar YouTube" CTA.
4. **Zero playlists:** Horizon section not rendered.
5. **All filled + published:** Empty state "Nada urgente" + lookahead.
6. **Pipeline empty:** "Nada no pipeline" with CTA link.
7. **Deleted channel:** Items without slot → suggestion "N items sem canal".
8. **Long title:** `text-overflow: ellipsis` + `title` attribute.
9. **20+ playlists:** Top 5 by closest to completion. "Ver todas (N)" link.
10. **cadence_paused:** No blog slots.
11. **cadence_days null/0:** Skip entirely.
12. **cadence_start_date null:** Skip entirely.
13. **cadence_start_date in future:** next_pub = start_date. If > this week → no slot.
14. **Newsletter no scheduled_at:** Not a slot. Suggestion: "Newsletter sem data".
15. **Newsletter scheduled_at in past:** Skipped in query (WHERE >= NOW()).
16. **Partial query failure:** Per-section error isolation. Other sections render normally.
17. **Celebration multi-tab:** Dismiss syncs via storage event.
18. **Celebration dismiss fatigue:** ISO week key. Dismiss once per week.
19. **localStorage unavailable:** React state fallback.
20. **Day without schedule:** "—" + aria-hidden.
21. **Unknown format:** `--t3` color, no crash.
22. **500+ playlist items:** Dots cap at 20 + "+N".
23. **Midnight boundary:** revalidateOnFocus + visibilitychange backup.
24. **Stage skipping:** Algorithm checks current STAGE_ORDER only.
25. **Overlapping schedules:** Same day+hour → separate slots, stack vertically.
26. **Item in 2 playlists:** Show playlist closest to completion.
27. **Blog missed multiple posts:** next_pub advances to today (ONE overdue, not N).
28. **duration_target invalid (0/null/negative):** Treated as null → stage defaults.
29. **Course/campaign format:** No weekly slots (video/blog/newsletter only). Pipeline list view only.
30. **Orphaned items + blog format:** Suggestion guard excludes blog_post/newsletter (no youtube_channel_id expected).
31. **All items at idea stage:** No deadlines computable → zero action cards. "Nada urgente" + suggestion.
32. **ISO week year boundary:** Dec 29-31 can be ISO week 1. getISOWeekYear handles this.
33. **sync_schedules JSONB null entries:** `(ch.sync_schedules ?? []).filter(Boolean)`.
34. **Concurrent slot assignment:** Read-committed isolation. Last writer wins. SWR refetch after mutation shows actual state.
35. **Reduced motion:** `prefers-reduced-motion: reduce` disables all transforms (hover/active scale), animations (skeleton pulse), and slide transitions (bottom sheet).

## Component Map

| Tag | Component | LOC | Notes |
|-----|-----------|-----|-------|
| REUSE | UpNextCelebration | 59 | Move below actions. ISO week dismiss. Multi-tab sync |
| REUSE | UpNextPlaylistStrips | 102 | Horizon section. Remove "Proximo:" line |
| REUSE | UpNextSuggestion | 35 | Background container, 44px link |
| REUSE | UpNextActivity | 123 | Add id="activity-list" on content div |
| KEEP | PipelineSearchDropdown | — | Must survive PipelineOverview rewrite |
| MODIFY | UpNextThisWeek | 225→280 | +blog/newsletter slots, +scroll-snap, +muted weekends, +per-day effort |
| REPLACE | UpNextModeCards → TodayActionCards | ~140 | Full card `<a>`, batch support |
| REWRITE | PipelineOverview | 40→110 | SWR wrapper, priority-first layout, todayDate prop, offline banner |
| NEW | calculate-today-actions.ts | ~250 | Pure function, TDD |
| NEW | calculate-streak.ts | ~50 | ISO week, TZ-aware, 2-condition grace |
| NEW | WeekSlotPicker | ~120 | Combobox/bottom sheet |
| NEW | CommandCenterSkeleton | ~40 | Loading state |
| NEW | CommandCenterEmpty | ~30 | First-run / rest day |
| NEW | OfflineBanner | ~20 | navigator.onLine + event listeners |
| NEW | /api/pipeline/up-next | ~80 | GET, Zod, per-section errors |
| NEW | assign_week_slot RPC | — | Migration. is_staff() + GUC |
| EXPAND | page.tsx | +80 | 5 queries, calculateTodayActions, calculateStreak |

## Implementation Order

1. **Migration** — columns + RPC (BLOCKER: nothing works without these)
2. **Pure helpers (TDD)** — calculate-today-actions.ts, calculate-streak.ts, EFFORT_DEFAULTS
3. **API route + registry** — /api/pipeline/up-next, update api-registry.ts + cowork docs
4. **Components** — TodayActionCards, WeekSlotPicker, Skeleton, Empty, OfflineBanner
5. **page.tsx integration** — 5 queries, SWR wrapper, layout reorder
6. **Test updates** — delete mode-cards tests, update celebration/activity/suggestion tests, new tests

## Tests

- **calculate-today-actions.test.tsx** (15+): DST, null cadence, overdue blog, weekend empty, batch key collision, EFFORT_DEFAULTS, getProductionDeadline, language='both', LOCALE_TO_LANGUAGE
- **calculate-streak.test.tsx** (8+): vacation grace, two-condition check, history table pub date, ISO week year boundary
- **week-slot-picker.test.tsx**: keyboard, debounce, error rollback
- Delete: up-next-mode-cards.test.tsx
- Update: up-next-activity (id attr), up-next-celebration (ISO week dismiss), up-next-suggestion (bg + 44px)

## Success Criteria

1. **3s test:** Creator sees #1 action card within 3s of page load
2. **3 content types:** Video (4x), blog (2x), newsletter (1x) — all with format-specific colors
3. **Effort + deadline:** Every card has deep/quick + time estimate + publish date
4. **WCAG 2.1 AA:** All text >= 4.5:1 contrast. All targets >= 44px. Semantic HTML. ARIA attributes
5. **Zero redundancy:** No pipeline bar, no duplicate playlist "Proximo" line
6. **Weekend friendly:** Muted slots, "(opcional)" label, no red on rest days
7. **Schema-accurate:** All SQL verified against actual migrations
8. **Design system compliance:** Zero new CSS variables, zero hard-coded colors

## V2 Backlog

- Drag-to-reschedule in week grid
- Arrow-key navigation (upgrade region to grid with roving tabindex)
- Effort tracking with partial progress
- AI topic suggestion
- Audience pulse
- Cross-channel content graph
- Weekly planning mode
- Focus mode (ADHD-friendly)
- Time-of-day energy ordering
- Burnout detection
- Holiday calendar integration
