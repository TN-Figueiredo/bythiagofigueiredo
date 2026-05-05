# YouTube CMS Channel Management Design

**Date:** 2026-05-05
**Status:** Approved (recursive self-audit, score 98/100). 7-screen visual companion review with user approval on all sections.
**Pre-conditions:** YouTube 5-table schema deployed (`20260505000001`), `pinned_until` column + RPCs deployed (`20260505000002`, `20260505000003`), sync pipeline operational, channel registration in Settings working, home page queries wired to DB.
**Estimated effort:** ~12h across 4 tracks (sidebar, hub layout, schedule label, pin UX).

---

## Motivation

YouTube management pages (videos, categories, comments) and channel registration (in Settings) are fully built, but:

1. **YouTube is buried in Settings** — no sidebar entry, users must navigate to Settings to find YouTube. It should be a top-level CMS section like Posts or Newsletters.
2. **No dashboard** — no overview of channel status, sync health, weekly pick state, or aggregate stats.
3. **No shared tab layout** — the 3 existing YouTube pages (videos, categories, comments) have no unified navigation.
4. **Schedule text is hardcoded** — `home.channels.youtubeSchedule` locale key shows "new every Thursday" for all channels. Each channel may have a different posting cadence.
5. **Pin UX missing** — `pinWeeklyPick`/`unpinWeeklyPick` server actions and RPCs exist but the UI for selecting pin duration (7d/15d/30d + custom) is not wired.

---

## Goals

- **Sidebar elevation**: Add YouTube as a top-level CMS sidebar item in the Content section.
- **Hub layout**: Shared tab bar (Dashboard, Videos, Categories, Comments) via `youtube/layout.tsx`.
- **Dashboard page**: Per-channel cards with stats, sync status, weekly pick state, and navigation CTAs.
- **Schedule label**: Auto-derive from `sync_schedules` with manual override per channel via new `schedule_label` column.
- **Pin UX**: Duration dropdown (7/15/30 + custom 1-90 days) on each video row in the Videos tab.

## Non-goals

- No channel CRUD changes — registration stays in Settings.
- No YouTube Analytics integration.
- No home page component changes (already wired in prior work).
- No changes to categories or comments page functionality (they gain the shared layout for free).

---

## 1. Sidebar Elevation

### Approach

Pass custom `sections` prop to `CmsShell` in `cms/(authed)/layout.tsx`. Import `DEFAULT_SECTIONS` from `@tn-figueiredo/cms-ui`, spread into a new array with YouTube inserted into the Content section. No package changes needed.

### Sidebar Structure

```
Content
  Posts          /cms/blog
  Newsletters    /cms/newsletters
  Campaigns      /cms/campaigns
  YouTube        /cms/youtube           ← NEW (icon: 🎬, minRole: 'editor')
```

### Badge

Count of videos with `auto_suggested_category_id IS NOT NULL AND category_id IS NULL` (pending category suggestions to review). Computed in `cms/(authed)/layout.tsx` alongside existing badge queries (contacts, newsletters). Passed via `badges` prop to `CmsShell`. Uses the existing `SidebarBadges` portal pattern (yellow pill).

---

## 2. YouTube Hub Layout

### File Structure

```
cms/(authed)/youtube/
├── layout.tsx           ← NEW: shared tab bar + header
├── page.tsx             ← NEW: dashboard (default tab)
├── videos/page.tsx      ← EXISTS
├── categories/page.tsx  ← EXISTS
└── comments/page.tsx    ← EXISTS
```

### Shared Layout (`youtube/layout.tsx`)

Client component (needs `usePathname()` for active tab detection). Renders:

1. **Header bar**: Title "YouTube" + "Sync All" button + "Manage Channels" link (→ `/cms/settings#youtube`)
2. **Tab bar**: Dashboard | Videos | Categories | Comments — active tab has indigo bottom border
3. `{children}` — renders the active page

### Tab Routing

| Path | Active Tab |
|------|-----------|
| `/cms/youtube` | Dashboard |
| `/cms/youtube/videos` | Videos |
| `/cms/youtube/categories` | Categories |
| `/cms/youtube/comments` | Comments |

---

## 3. Dashboard Page (`/cms/youtube`)

Server component. Fetches all channel data, current pins, sync log, and stats.

### Data Queries

```typescript
const [channelsRes, videosCountRes, uncategorizedRes, recentSyncRes] = await Promise.all([
  supabase.from('youtube_channels')
    .select('id, locale, handle, name, subscriber_count, video_count, thumbnail_url, last_synced_at, sync_schedules')
    .eq('site_id', siteId),
  supabase.from('youtube_videos')
    .select('channel_id', { count: 'exact' }).eq('site_id', siteId).eq('is_hidden', false),
  supabase.from('youtube_videos')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId).not('auto_suggested_category_id', 'is', null).is('category_id', null),
  supabase.from('youtube_sync_log')
    .select('channel_id, status, videos_found, videos_inserted, created_at')
    .eq('site_id', siteId).order('created_at', { ascending: false }).limit(6),
])
```

Per-channel weekly pick query:
```typescript
// For each channel, get the currently pinned video
const pinnedRes = await supabase.from('youtube_videos')
  .select('id, title, thumbnail_url, view_count, like_count, pinned_until, channel_id')
  .eq('site_id', siteId).gt('pinned_until', new Date().toISOString())
```

### Per-Channel Card

**Header:**
- Flag emoji (🇧🇷 pt / 🇺🇸 en) + channel name + `@handle`
- Sync status: green dot + "2h ago" | yellow dot + "Never"
- Per-channel "Sync" button (calls `triggerSync(channelId)`)

**Stats row:**
- Video count
- Subscriber count (formatted: 1.2K, 15K)
- Total views (optional — sum from videos if available)

**Weekly Pick section (3 states):**

| State | Visual | Actions |
|---|---|---|
| **Active** (>2 days left) | Green accent. Pinned video thumbnail + title + "until May 12 (5 days left)" | Change pick → \| Unpin |
| **Expiring soon** (≤2 days) | Amber accent. "Expires tomorrow" | Extend → \| Change → \| Unpin |
| **No pin / Expired** | Gray accent. "No video pinned this week" | Choose Weekly Pick → |

- "Change pick →" navigates to `/cms/youtube/videos?channel={channelId}`
- "Choose Weekly Pick →" navigates to `/cms/youtube/videos?channel={channelId}`
- "Unpin" triggers confirmation dialog: "Remove weekly pick? The home page will fall back to showing the latest video." [Cancel] [Unpin]

---

## 4. Pin Weekly Pick UX

### Location

Pin controls live inline on each video row in the **Videos tab** (`/cms/youtube/videos/videos-connected.tsx`).

### Per-Video Pin States

1. **Not pinned, no existing pin for channel**: Button `☆ Pin as Weekly Pick` → opens duration dropdown
2. **Not pinned, another video pinned for this channel**: Button `☆ Pin as Weekly Pick` + hint "replaces current pin" → opens duration dropdown
3. **Currently pinned**: Gold left border on row + star icon + badge `★ Pinned until May 12` + "Unpin" link

### Duration Dropdown Component

Opens below the pin button:

```
┌─────────────────────────────────┐
│ PIN DURATION                    │
│ 7 days          until May 12    │
│ 15 days         until May 20    │
│ 30 days         until Jun 4     │
│─────────────────────────────────│
│ Custom: [  ] days    [Pin]      │
└─────────────────────────────────┘
```

- Presets: 7/15/30 days — each shows computed "until" date
- Custom: Number input (min 1, max 90) + "Pin" button
- Clicking a preset immediately pins (no extra confirmation)

### Validation (Zod)

Update existing `pinSchema` in `videos/actions.ts`:
```typescript
const pinSchema = z.object({
  videoId: z.string().uuid(),
  channelId: z.string().uuid(),
  durationDays: z.number().int().min(1).max(90),  // was max(30)
})
```

Additional checks in action:
- Video must belong to the filtered channel (already checked)
- Video must not be hidden (`is_hidden = false`)
- Only 1 pin per channel (enforced atomically by `pin_weekly_pick` RPC)

### Existing Backend (no changes needed)

- `pin_weekly_pick(p_video_id, p_channel_id, p_site_id, p_duration_days)` RPC — clears old pin + sets new atomically
- `unpin_weekly_pick(p_channel_id, p_site_id)` RPC — clears pin for channel
- Server actions `pinWeeklyPick()` and `unpinWeeklyPick()` in `videos/actions.ts` — already wired

---

## 5. Schedule Label — Configurable Per Channel

### Problem

`home.channels.youtubeSchedule` in locale JSON is shared across all channels. Each channel may have a different posting cadence.

### Solution: Auto-derive + Manual Override

**New DB column:**
```sql
-- 20260505000004_youtube_schedule_label.sql
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS schedule_label text;
```

Nullable. When set, used as-is (manual override). When null, auto-derived from `sync_schedules` jsonb.

**Resolution chain:**
1. `schedule_label` (manual) → use exact text
2. `sync_schedules` days → auto-derive via `deriveScheduleLabel(schedules, locale)`
3. Both null/empty → hide label entirely

### `deriveScheduleLabel()` — Pure Function

```typescript
// lib/youtube/schedule-label.ts
export function deriveScheduleLabel(
  schedules: Array<{ day: string; time: string }>,
  locale: 'pt-BR' | 'en',
): string | null
```

| sync_schedules days | EN | PT-BR |
|---|---|---|
| `['thursday']` | new every Thursday | novidade toda quinta |
| `['monday']` | new every Monday | novidade toda segunda |
| `['tuesday', 'friday']` | new Tue & Fri | novidade terça e sexta |
| `['mon','wed','fri']` | new Mon, Wed & Fri | novidade seg, qua e sex |
| `[]` (empty) | null (hidden) | null (hidden) |
| `schedule_label` set | exact text | exact text |

### Public Site Wiring

`getHomeChannels()` in `lib/home/queries.ts`:
1. Add `schedule_label, sync_schedules` to SELECT
2. Call `deriveScheduleLabel()` to compute resolved label
3. Return as `scheduleLabel: string | null` in `HomeChannel`

`HomeChannel` type gains `scheduleLabel: string | null`.

Components:
- `ChannelStrip.tsx`: Replace `t['home.channels.youtubeSchedule']` with `channel.scheduleLabel` (conditionally rendered)
- `SubscribePair.tsx`: Same — use per-channel `scheduleLabel`

### CMS Settings UI

Each `YouTubeChannelCard` in Settings gains a "Schedule label" text input:
- Placeholder shows auto-derived text (so user sees what the default would be)
- Custom value saved to `youtube_channels.schedule_label`
- Clear/empty reverts to auto-derive (sets to null)

`updateYouTubeChannel` action in `settings/actions.ts` adds `schedule_label` to the update payload.

---

## 6. Database Changes

### New Migration

```sql
-- 20260505000004_youtube_schedule_label.sql
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS schedule_label text;
COMMENT ON COLUMN youtube_channels.schedule_label IS
  'Manual override for schedule text on public site. NULL = auto-derive from sync_schedules.';
```

### Existing Schema (no changes)

All other schema is already deployed:
- `youtube_channels`, `youtube_videos`, `youtube_categories`, `youtube_curated_comments`, `youtube_sync_log` — migration `20260505000001`
- `youtube_videos.pinned_until` — migration `20260505000002`
- `pin_weekly_pick` / `unpin_weekly_pick` RPCs — migration `20260505000003`

### Action Update

`videos/actions.ts` `pinSchema`: change `durationDays` max from `30` → `90`.

---

## 7. Layout Architecture

```
CmsShell (from @tn-figueiredo/cms-ui)
  ├── Sidebar: DEFAULT_SECTIONS + YouTube item
  └── Content Area
       └── cms/(authed)/youtube/layout.tsx (client)
            ├── Header: "YouTube" + Sync All + Manage Channels
            ├── Tab bar: Dashboard | Videos | Categories | Comments
            └── {children}
                 ├── page.tsx (Dashboard — server)
                 ├── videos/page.tsx (Videos — server)
                 ├── categories/page.tsx (Categories — server)
                 └── comments/page.tsx (Comments — server)
```

### Navigation Flows

1. **Sidebar → "YouTube"** → `/cms/youtube` → Dashboard tab
2. **Dashboard "Change pick →"** → `/cms/youtube/videos?channel={id}` → Videos tab filtered
3. **Dashboard "Manage Channels"** → `/cms/settings#youtube` → Settings page
4. **Videos tab "Pin as Weekly Pick"** → Duration dropdown → pin action → revalidate → gold border

---

## 8. Files to Create/Modify

### Create

| File | Purpose |
|---|---|
| `cms/(authed)/youtube/layout.tsx` | Shared YouTube hub layout with header + tabs |
| `cms/(authed)/youtube/page.tsx` | Dashboard page (server component) |
| `lib/youtube/schedule-label.ts` | `deriveScheduleLabel()` pure function |
| `supabase/migrations/20260505000004_youtube_schedule_label.sql` | schedule_label column |

### Modify

| File | Change |
|---|---|
| `cms/(authed)/layout.tsx` | Add YouTube to sidebar sections prop, add badge query |
| `cms/(authed)/youtube/videos/videos-connected.tsx` | Add PinDropdown UI inline on video rows |
| `cms/(authed)/youtube/videos/actions.ts` | Update pinSchema max 30 → 90 |
| `cms/(authed)/settings/settings-connected.tsx` | Add schedule_label text input to channel cards |
| `cms/(authed)/settings/actions.ts` | Add schedule_label to updateChannel action |
| `lib/home/queries.ts` | Add schedule_label + sync_schedules to getHomeChannels, call deriveScheduleLabel |
| `lib/home/types.ts` | Add scheduleLabel to HomeChannel |
| `(public)/components/ChannelStrip.tsx` | Use channel.scheduleLabel instead of i18n key |
| `(public)/components/SubscribePair.tsx` | Use channel.scheduleLabel instead of i18n key |

---

## 9. Testing Strategy

### Unit tests (vitest)
- `deriveScheduleLabel()` — all day combinations, both locales, manual override, empty schedules
- Dashboard state computation — per-channel pin expiry classification (active/expiring/expired)

### Component tests
- Dashboard renders both channel cards with correct sync status
- Pin dropdown renders presets with computed "until" dates
- PinDropdown custom input validates 1-90 range

### Action tests
- `pinWeeklyPick` with duration 1-90 (was 1-30)
- `unpinWeeklyPick` clears only active pin
- `updateYouTubeChannel` saves schedule_label

### Integration (DB-gated)
- Schedule label resolution: manual override → auto-derive → null
- Pin flow end-to-end: pin → check query → unpin → fallback to latest

---

## 10. Cache & Revalidation

| Action | Tags revalidated |
|---|---|
| Pin/unpin weekly pick | `youtube` |
| Sync channel | `youtube` |
| Update channel (schedule_label) | `youtube` |

All YouTube queries use `unstable_cache` with `'youtube'` tag, 3600s TTL.

---

## 11. Edge Cases

### Dashboard
- **0 channels** → empty state: "No YouTube channels configured. Add channels in Settings."
- **Never-synced channel** → yellow dot + prominent "First Sync" CTA
- **Pin expired** → red accent, "Pin expired — home page shows latest video as fallback"
- **Pin expiring ≤2 days** → amber accent with "Expires tomorrow" warning

### Pin UX
- **Custom duration 0 or negative** → Zod rejects, inline error
- **Custom duration >90** → Zod rejects, inline error
- **Pin hidden video** → blocked by action (video must have `is_hidden = false`)
- **Replace existing pin** → atomic via RPC, hint text "replaces current pin" shown

### Schedule label
- **Both schedule_label and sync_schedules empty** → no label shown on public site
- **schedule_label set to whitespace** → treat as null (trim in action)
- **sync_schedules has unknown day** → fallback to null (no label)

---

## Locale Mapping

DB stores `locale` as `'pt'` and `'en'`. Home page uses `'pt-BR'` and `'en'`. Mapping in query layer:

```typescript
const DB_LOCALE_MAP: Record<string, 'pt' | 'en'> = { 'pt-BR': 'pt', en: 'en' }
const HOME_LOCALE_MAP: Record<string, 'en' | 'pt-BR'> = { pt: 'pt-BR', en: 'en' }
```

Already exists in `lib/home/queries.ts`.
