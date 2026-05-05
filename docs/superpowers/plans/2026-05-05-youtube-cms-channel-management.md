# YouTube CMS Channel Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate YouTube to a top-level CMS sidebar item with its own hub layout (Dashboard + Videos + Categories + Comments tabs), make schedule labels configurable per channel, and wire the pin-duration dropdown UX into the Videos tab.

**Architecture:** Custom `sections` prop on `CmsShell` adds YouTube to the sidebar. A new `youtube/layout.tsx` client component provides shared tab bar across all YouTube sub-pages. A new `youtube/page.tsx` server component renders the dashboard with per-channel cards. Schedule labels are auto-derived from `sync_schedules` via a pure function with manual override via new DB column.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind 4, Supabase (PostgreSQL), Vitest

---

### Task 1: Schedule Label — Migration + Pure Function + Tests

**Files:**
- Create: `supabase/migrations/20260505000004_youtube_schedule_label.sql`
- Create: `apps/web/src/lib/youtube/schedule-label.ts`
- Create: `apps/web/test/youtube/schedule-label.test.ts`

- [ ] **Step 1: Write the failing tests for `deriveScheduleLabel`**

Create `apps/web/test/youtube/schedule-label.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { deriveScheduleLabel } from '@/lib/youtube/schedule-label'

describe('deriveScheduleLabel', () => {
  it('returns null for empty schedules', () => {
    expect(deriveScheduleLabel([], 'en')).toBeNull()
    expect(deriveScheduleLabel([], 'pt-BR')).toBeNull()
  })

  it('handles single day in EN', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'America/Sao_Paulo', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('handles single day in PT-BR', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'America/Sao_Paulo', label: '' }]
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda quinta')
  })

  it('handles monday', () => {
    const schedules = [{ day: 'monday', hour: 8, tz: 'UTC', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Monday')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade toda segunda')
  })

  it('handles two days with & separator', () => {
    const schedules = [
      { day: 'tuesday', hour: 10, tz: 'UTC', label: '' },
      { day: 'friday', hour: 10, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Tue & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade terça e sexta')
  })

  it('handles three days with comma + &', () => {
    const schedules = [
      { day: 'monday', hour: 10, tz: 'UTC', label: '' },
      { day: 'wednesday', hour: 10, tz: 'UTC', label: '' },
      { day: 'friday', hour: 10, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new Mon, Wed & Fri')
    expect(deriveScheduleLabel(schedules, 'pt-BR')).toBe('novidade seg, qua e sex')
  })

  it('deduplicates same-day entries', () => {
    const schedules = [
      { day: 'thursday', hour: 10, tz: 'UTC', label: '' },
      { day: 'thursday', hour: 14, tz: 'UTC', label: '' },
    ]
    expect(deriveScheduleLabel(schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null for unknown day values', () => {
    const schedules = [{ day: 'funday', hour: 10, tz: 'UTC', label: '' }]
    expect(deriveScheduleLabel(schedules, 'en')).toBeNull()
  })

  it('handles all seven days', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    const schedules = days.map(d => ({ day: d, hour: 10, tz: 'UTC', label: '' }))
    const result = deriveScheduleLabel(schedules, 'en')
    expect(result).toContain('Mon')
    expect(result).toContain('Sun')
  })
})

describe('resolveScheduleLabel', () => {
  // We'll import this once implemented
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/youtube/schedule-label.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the `deriveScheduleLabel` implementation**

Create `apps/web/src/lib/youtube/schedule-label.ts`:

```typescript
type ScheduleEntry = { day: string; hour: number; tz: string; label: string }

const DAY_NAMES_EN: Record<string, { full: string; short: string }> = {
  monday: { full: 'Monday', short: 'Mon' },
  tuesday: { full: 'Tuesday', short: 'Tue' },
  wednesday: { full: 'Wednesday', short: 'Wed' },
  thursday: { full: 'Thursday', short: 'Thu' },
  friday: { full: 'Friday', short: 'Fri' },
  saturday: { full: 'Saturday', short: 'Sat' },
  sunday: { full: 'Sunday', short: 'Sun' },
}

const DAY_NAMES_PT: Record<string, { full: string; short: string }> = {
  monday: { full: 'segunda', short: 'seg' },
  tuesday: { full: 'terça', short: 'terça' },
  wednesday: { full: 'quarta', short: 'qua' },
  thursday: { full: 'quinta', short: 'quinta' },
  friday: { full: 'sexta', short: 'sexta' },
  saturday: { full: 'sábado', short: 'sáb' },
  sunday: { full: 'domingo', short: 'dom' },
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export function deriveScheduleLabel(
  schedules: ScheduleEntry[],
  locale: 'pt-BR' | 'en',
): string | null {
  const uniqueDays = [...new Set(schedules.map(s => s.day.toLowerCase()))]
    .filter(d => DAY_ORDER.includes(d))
    .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))

  if (uniqueDays.length === 0) return null

  const names = locale === 'pt-BR' ? DAY_NAMES_PT : DAY_NAMES_EN
  const prefix = locale === 'pt-BR' ? 'novidade' : 'new'
  const conjunction = locale === 'pt-BR' ? 'e' : '&'

  if (uniqueDays.length === 1) {
    const full = names[uniqueDays[0]!]!.full
    const every = locale === 'pt-BR' ? 'toda' : 'every'
    return `${prefix} ${every} ${full}`
  }

  const labels = uniqueDays.map(d => names[d]!.short)
  const last = labels.pop()!
  return `${prefix} ${labels.join(', ')} ${conjunction} ${last}`
}

export function resolveScheduleLabel(
  scheduleLabel: string | null,
  syncSchedules: ScheduleEntry[] | null,
  locale: 'pt-BR' | 'en',
): string | null {
  if (scheduleLabel && scheduleLabel.trim()) return scheduleLabel.trim()
  if (!syncSchedules || syncSchedules.length === 0) return null
  return deriveScheduleLabel(syncSchedules, locale)
}
```

- [ ] **Step 4: Add `resolveScheduleLabel` tests to the test file**

Append to `apps/web/test/youtube/schedule-label.test.ts`:

```typescript
import { resolveScheduleLabel } from '@/lib/youtube/schedule-label'

describe('resolveScheduleLabel', () => {
  it('returns manual override when set', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'UTC', label: '' }]
    expect(resolveScheduleLabel('custom text', schedules, 'en')).toBe('custom text')
  })

  it('trims whitespace-only override to null and falls through', () => {
    expect(resolveScheduleLabel('   ', null, 'en')).toBeNull()
  })

  it('auto-derives when no override', () => {
    const schedules = [{ day: 'thursday', hour: 10, tz: 'UTC', label: '' }]
    expect(resolveScheduleLabel(null, schedules, 'en')).toBe('new every Thursday')
  })

  it('returns null when both are empty', () => {
    expect(resolveScheduleLabel(null, [], 'en')).toBeNull()
    expect(resolveScheduleLabel(null, null, 'pt-BR')).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/youtube/schedule-label.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Create the migration**

Create `supabase/migrations/20260505000004_youtube_schedule_label.sql`:

```sql
ALTER TABLE youtube_channels ADD COLUMN IF NOT EXISTS schedule_label text;
COMMENT ON COLUMN youtube_channels.schedule_label IS
  'Manual override for schedule text on public site. NULL = auto-derive from sync_schedules.';
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/schedule-label.ts apps/web/test/youtube/schedule-label.test.ts supabase/migrations/20260505000004_youtube_schedule_label.sql
git commit -m "feat(youtube): add schedule label migration + deriveScheduleLabel pure function"
```

---

### Task 2: Wire Schedule Label to Home Page + Public Components

**Files:**
- Modify: `apps/web/lib/home/types.ts`
- Modify: `apps/web/lib/home/queries.ts`
- Modify: `apps/web/src/app/(public)/components/ChannelStrip.tsx`
- Modify: `apps/web/src/app/(public)/components/SubscribePair.tsx`

- [ ] **Step 1: Add `scheduleLabel` to `HomeChannel` type**

In `apps/web/lib/home/types.ts`, modify `HomeChannel`:

```typescript
export type HomeChannel = {
  id: string
  locale: 'en' | 'pt-BR'
  handle: string
  url: string
  flag: string
  name: string
  subscriberCount: number
  thumbnailUrl: string | null
  scheduleLabel: string | null
}
```

- [ ] **Step 2: Update `getHomeChannels` query to include schedule label**

In `apps/web/lib/home/queries.ts`, modify the `getHomeChannels` function. Change the SELECT to include `schedule_label, sync_schedules` and import + call `resolveScheduleLabel`:

At the top of the file, add import:
```typescript
import { resolveScheduleLabel } from '@/lib/youtube/schedule-label'
```

In the `getHomeChannels` function, change:
```typescript
.select('id, locale, handle, name, subscriber_count, thumbnail_url')
```
to:
```typescript
.select('id, locale, handle, name, subscriber_count, thumbnail_url, schedule_label, sync_schedules')
```

And in the return mapping, add `scheduleLabel`:
```typescript
return {
  id: c.id as string,
  locale: homeLocale,
  handle: c.handle as string,
  url: `https://www.youtube.com/${c.handle as string}`,
  flag: LOCALE_FLAG[c.locale as string] ?? '🌎',
  name: c.name as string,
  subscriberCount: (c.subscriber_count as number) ?? 0,
  thumbnailUrl: (c.thumbnail_url as string) ?? null,
  scheduleLabel: resolveScheduleLabel(
    c.schedule_label as string | null,
    c.sync_schedules as Array<{ day: string; hour: number; tz: string; label: string }> | null,
    homeLocale,
  ),
}
```

- [ ] **Step 3: Update `ChannelStrip.tsx` to use `channel.scheduleLabel`**

In `apps/web/src/app/(public)/components/ChannelStrip.tsx`, replace line 144:
```typescript
{t['home.channels.youtubeSchedule']}
```
with:
```typescript
{ch.scheduleLabel}
```

And wrap in a conditional so it only renders when non-null:
```typescript
{ch.scheduleLabel && (
  <div style={{ fontSize: 12, color: 'var(--pb-faint)', marginTop: 2, fontStyle: 'italic' }}>
    {ch.scheduleLabel}
  </div>
)}
```

Remove the old unconditional `<div>` that was on line 143-145.

- [ ] **Step 4: Update `SubscribePair.tsx` to use per-channel schedule labels**

In `apps/web/src/app/(public)/components/SubscribePair.tsx`, replace line 114-116:
```typescript
<p className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-yt)', marginTop: 12, transform: 'rotate(1deg)', display: 'block' }}>
  {allChannels.length >= 2 ? t['home.subscribe.scheduleNote'] : t['home.channels.youtubeSchedule']}
</p>
```
with:
```typescript
{allChannels.some(ch => ch.scheduleLabel) && (
  <p className="font-caveat" style={{ fontSize: 16, color: 'var(--pb-yt)', marginTop: 12, transform: 'rotate(1deg)', display: 'block' }}>
    {allChannels.length >= 2
      ? allChannels.map(ch => ch.scheduleLabel).filter(Boolean).join(' · ')
      : allChannels[0]?.scheduleLabel}
  </p>
)}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/home/types.ts apps/web/lib/home/queries.ts apps/web/src/app/'(public)'/components/ChannelStrip.tsx apps/web/src/app/'(public)'/components/SubscribePair.tsx
git commit -m "feat(youtube): wire schedule label to home page channels + public components"
```

---

### Task 3: Schedule Label Settings UI + Action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`
- Modify: `apps/web/src/app/cms/(authed)/settings/actions.ts`

- [ ] **Step 1: Add `schedule_label` to `YouTubeChannelData` interface**

In `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`, modify the `YouTubeChannelData` interface (around line 73):

```typescript
interface YouTubeChannelData {
  id: string
  name: string
  handle: string
  locale: string
  thumbnail_url: string | null
  sync_enabled: boolean
  sync_schedules: Array<{
    day: string
    hour: number
    tz: string
    label: string
  }> | null
  schedule_label: string | null
}
```

- [ ] **Step 2: Add schedule label input to `YouTubeChannelCard`**

In `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`, inside the `YouTubeChannelCard` component (around line 1370), add state for `scheduleLabel`:

After `const [schedules, setSchedules] = useState(channel.sync_schedules ?? [])` (line 1382), add:
```typescript
const [scheduleLabel, setScheduleLabel] = useState(channel.schedule_label ?? '')
```

Add import at the top of the file (after other imports):
```typescript
import { deriveScheduleLabel } from '@/lib/youtube/schedule-label'
```

In the `handleSave` function (line 1386-1403), modify the `updateYouTubeChannelSettings` call to include schedule_label:
```typescript
const res = await updateYouTubeChannelSettings({
  channel_id: channel.id,
  sync_enabled: syncEnabled,
  sync_schedules: schedules.map(s => ({
    day: s.day as typeof DAYS[number],
    hour: s.hour,
    tz: s.tz,
    label: s.label,
  })),
  schedule_label: scheduleLabel.trim() || null,
})
```

After the schedule entries section (after the `{schedules.map(...)` block, before the save button), add:
```typescript
<div className="space-y-1">
  <label className={labelCls()}>Schedule Label (public site)</label>
  <input
    type="text"
    value={scheduleLabel}
    onChange={(e) => setScheduleLabel(e.target.value)}
    disabled={readOnly}
    placeholder={deriveScheduleLabel(schedules, channel.locale === 'pt' ? 'pt-BR' : 'en') ?? 'Auto-derived from schedules'}
    className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
  />
  <p className="text-xs text-slate-500">Leave empty to auto-derive from posting schedule. Set to override.</p>
</div>
```

- [ ] **Step 3: Update the `syncScheduleSchema` in settings actions to include `schedule_label`**

In `apps/web/src/app/cms/(authed)/settings/actions.ts`, modify the `syncScheduleSchema` (around line 269):

```typescript
const syncScheduleSchema = z.object({
  channel_id: z.string().uuid(),
  sync_enabled: z.boolean(),
  sync_schedules: z.array(z.object({
    day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
    hour: z.number().int().min(0).max(23),
    tz: z.string(),
    label: z.string(),
  })),
  schedule_label: z.string().nullable().optional(),
})
```

And in the `updateYouTubeChannelSettings` function body (around line 286-292), add `schedule_label` to the update:
```typescript
const { error } = await supabase.from('youtube_channels')
  .update({
    sync_enabled: parsed.data.sync_enabled,
    sync_schedules: parsed.data.sync_schedules,
    schedule_label: parsed.data.schedule_label ?? null,
    updated_at: new Date().toISOString(),
  })
  .eq('id', parsed.data.channel_id).eq('site_id', siteId)
```

- [ ] **Step 4: Update the settings page server component to include `schedule_label` in the query**

In `apps/web/src/app/cms/(authed)/settings/page.tsx`, find the youtube_channels query and add `schedule_label` to the SELECT. Locate the line like:
```typescript
.select('id, name, handle, locale, thumbnail_url, sync_enabled, sync_schedules')
```
Change to:
```typescript
.select('id, name, handle, locale, thumbnail_url, sync_enabled, sync_schedules, schedule_label')
```

And in the mapping that builds `YouTubeChannelData[]`, add `schedule_label`:
```typescript
schedule_label: (ch.schedule_label as string | null) ?? null,
```

- [ ] **Step 5: Also update `onAdded` callback in `AddChannelForm`**

In `settings-connected.tsx`, find the `onAdded` callback (around line 1291-1299) that constructs the new `YouTubeChannelData` after adding a channel. Add `schedule_label: null` to the object:
```typescript
onAdded({
  id: res.id,
  name: preview.name,
  handle: preview.handle,
  locale,
  thumbnail_url: preview.thumbnailUrl,
  sync_enabled: true,
  sync_schedules: [],
  schedule_label: null,
})
```

- [ ] **Step 6: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/settings/settings-connected.tsx apps/web/src/app/cms/'(authed)'/settings/actions.ts apps/web/src/app/cms/'(authed)'/settings/page.tsx
git commit -m "feat(youtube): add schedule label settings UI + action"
```

---

### Task 4: YouTube Hub Layout (Shared Tab Bar)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/layout.tsx`

- [ ] **Step 1: Create the shared YouTube layout**

Create `apps/web/src/app/cms/(authed)/youtube/layout.tsx`:

```typescript
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'

const TABS = [
  { label: 'Dashboard', href: '/cms/youtube' },
  { label: 'Videos', href: '/cms/youtube/videos' },
  { label: 'Categories', href: '/cms/youtube/categories' },
  { label: 'Comments', href: '/cms/youtube/comments' },
] as const

export default function YouTubeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const activeTab = TABS.find(t => {
    if (t.href === '/cms/youtube') return pathname === '/cms/youtube'
    return pathname.startsWith(t.href)
  })?.href ?? '/cms/youtube'

  return (
    <div className="flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border px-6 py-4">
        <h1 className="text-lg font-semibold text-cms-text">YouTube</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/cms/settings?section=youtube"
            className="text-sm text-cms-text-muted hover:text-cms-text"
          >
            Manage Channels
          </Link>
        </div>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 border-b border-cms-border px-6" aria-label="YouTube sections">
        {TABS.map(tab => {
          const isActive = tab.href === activeTab
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-cms-accent text-cms-accent'
                  : 'text-cms-text-muted hover:text-cms-text'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Remove duplicate padding from existing pages**

The existing `videos/page.tsx` wraps content in `<div className="flex flex-col gap-6 p-6">`. Since the layout now provides `p-6`, change it to `<div className="flex flex-col gap-6">` (remove the `p-6`).

Similarly check `categories/page.tsx` and `comments/page.tsx` for duplicate padding and remove it.

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/youtube/layout.tsx apps/web/src/app/cms/'(authed)'/youtube/videos/page.tsx apps/web/src/app/cms/'(authed)'/youtube/categories/page.tsx apps/web/src/app/cms/'(authed)'/youtube/comments/page.tsx
git commit -m "feat(youtube): add shared hub layout with tab bar"
```

---

### Task 5: Sidebar Elevation (Add YouTube to CMS Sidebar)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`

- [ ] **Step 1: Import `DEFAULT_SECTIONS` and add YouTube item**

In `apps/web/src/app/cms/(authed)/layout.tsx`, add import at top:
```typescript
import { DEFAULT_SECTIONS } from '@tn-figueiredo/cms-ui/client'
import type { SidebarSection } from '@tn-figueiredo/cms-ui'
```

Before the component function, build the custom sections:
```typescript
const CMS_SECTIONS: SidebarSection[] = DEFAULT_SECTIONS.map(section => {
  if (section.label === 'Content') {
    return {
      ...section,
      items: [
        ...section.items,
        { icon: '🎬', label: 'YouTube', href: '/cms/youtube', minRole: 'editor' as const },
      ],
    }
  }
  return section
})
```

Then pass `sections={CMS_SECTIONS}` to `<CmsShell>`:
```typescript
<CmsShell
  siteName={currentSite?.site_name ?? 'OneCMS'}
  siteInitials={currentSite?.site_name?.slice(0, 2).toUpperCase() ?? 'CM'}
  userDisplayName={userDisplayName}
  userRole={userRole}
  siteSwitcher={<CmsSiteSwitcherSlot sites={rawSites} />}
  badges={badges}
  sections={CMS_SECTIONS}
>
```

- [ ] **Step 2: Add YouTube badge query**

In the `Promise.all` that fetches badge data (around line 58-62), add a third query:

```typescript
const [badgeData, pendingContactsRes, ytPendingRes] = await Promise.all([
  fetchSidebarBadges(middlewareSiteId),
  svc.from('contact_submissions').select('id', { count: 'exact', head: true })
    .eq('site_id', middlewareSiteId).is('replied_at', null).is('anonymized_at', null),
  svc.from('youtube_videos').select('id', { count: 'exact', head: true })
    .eq('site_id', middlewareSiteId)
    .not('auto_suggested_category_id', 'is', null)
    .is('category_id', null),
])
```

And add to the badges object:
```typescript
const badges: Record<string, number> = {}
if (pendingContactsRes.count) badges['/cms/contacts'] = pendingContactsRes.count
if (ytPendingRes.count) badges['/cms/youtube'] = ytPendingRes.count
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/layout.tsx
git commit -m "feat(youtube): elevate YouTube to CMS sidebar with badge"
```

---

### Task 6: Dashboard Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/youtube/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx`

- [ ] **Step 1: Create the dashboard server component**

Create `apps/web/src/app/cms/(authed)/youtube/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { DashboardConnected, type ChannelDashboard, type PinnedVideo } from './dashboard-connected'

export const dynamic = 'force-dynamic'

export default async function YouTubeDashboardPage() {
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const [channelsRes, uncategorizedRes, recentSyncRes, pinnedRes] = await Promise.all([
    supabase.from('youtube_channels')
      .select('id, locale, handle, name, subscriber_count, video_count, thumbnail_url, last_synced_at, sync_schedules, schedule_label')
      .eq('site_id', siteId)
      .order('locale'),
    supabase.from('youtube_videos')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('auto_suggested_category_id', 'is', null)
      .is('category_id', null),
    supabase.from('youtube_sync_log')
      .select('channel_id, status, videos_found, videos_inserted, created_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('youtube_videos')
      .select('id, title, thumbnail_url, view_count, like_count, pinned_until, channel_id')
      .eq('site_id', siteId)
      .gt('pinned_until', new Date().toISOString()),
  ])

  const rawChannels = channelsRes.data ?? []
  const rawPinned = pinnedRes.data ?? []
  const rawSyncs = recentSyncRes.data ?? []

  const pinnedMap = new Map<string, PinnedVideo>()
  for (const p of rawPinned) {
    pinnedMap.set(p.channel_id as string, {
      id: p.id as string,
      title: p.title as string,
      thumbnailUrl: (p.thumbnail_url as string | null) ?? null,
      viewCount: (p.view_count as number) ?? 0,
      likeCount: (p.like_count as number) ?? 0,
      pinnedUntil: p.pinned_until as string,
    })
  }

  const channels: ChannelDashboard[] = rawChannels.map(ch => {
    const lastSync = rawSyncs.find(s => s.channel_id === ch.id)
    return {
      id: ch.id as string,
      locale: ch.locale as 'pt' | 'en',
      handle: ch.handle as string,
      name: ch.name as string,
      subscriberCount: (ch.subscriber_count as number) ?? 0,
      videoCount: (ch.video_count as number) ?? 0,
      thumbnailUrl: (ch.thumbnail_url as string | null) ?? null,
      lastSyncedAt: (ch.last_synced_at as string | null) ?? null,
      lastSyncStatus: (lastSync?.status as string | null) ?? null,
      pinnedVideo: pinnedMap.get(ch.id as string) ?? null,
    }
  })

  return (
    <DashboardConnected
      channels={channels}
      uncategorizedCount={uncategorizedRes.count ?? 0}
    />
  )
}
```

- [ ] **Step 2: Create the dashboard client component**

Create `apps/web/src/app/cms/(authed)/youtube/dashboard-connected.tsx`:

```typescript
'use client'

import { useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { triggerSync } from './videos/actions'
import { unpinWeeklyPick } from './videos/actions'
import { useState } from 'react'

export interface PinnedVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  pinnedUntil: string
}

export interface ChannelDashboard {
  id: string
  locale: 'pt' | 'en'
  handle: string
  name: string
  subscriberCount: number
  videoCount: number
  thumbnailUrl: string | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  pinnedVideo: PinnedVideo | null
}

interface Props {
  channels: ChannelDashboard[]
  uncategorizedCount: number
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type PinState = 'active' | 'expiring' | 'none'

function getPinState(pinnedVideo: PinnedVideo | null): PinState {
  if (!pinnedVideo) return 'none'
  const until = new Date(pinnedVideo.pinnedUntil)
  const now = new Date()
  if (until <= now) return 'none'
  const daysLeft = Math.ceil((until.getTime() - now.getTime()) / 86_400_000)
  if (daysLeft <= 2) return 'expiring'
  return 'active'
}

function daysLeft(pinnedUntil: string): number {
  return Math.ceil((new Date(pinnedUntil).getTime() - Date.now()) / 86_400_000)
}

function ChannelCard({ channel }: { channel: ChannelDashboard }) {
  const [isPending, startTransition] = useTransition()
  const [showUnpinConfirm, setShowUnpinConfirm] = useState(false)
  const flag = channel.locale === 'pt' ? '🇧🇷' : '🇺🇸'
  const pinState = getPinState(channel.pinnedVideo)
  const neverSynced = !channel.lastSyncedAt

  const handleSync = () => {
    startTransition(async () => {
      await triggerSync(channel.id)
    })
  }

  const handleUnpin = () => {
    startTransition(async () => {
      await unpinWeeklyPick({ channelId: channel.id })
      setShowUnpinConfirm(false)
    })
  }

  const pinAccent = pinState === 'active'
    ? 'border-l-emerald-500'
    : pinState === 'expiring'
      ? 'border-l-amber-500'
      : 'border-l-slate-600'

  return (
    <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cms-border px-4 py-3">
        <div className="flex items-center gap-3">
          {channel.thumbnailUrl ? (
            <Image src={channel.thumbnailUrl} alt="" width={36} height={36} className="rounded-full" unoptimized />
          ) : (
            <span className="text-xl">{flag}</span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{flag}</span>
              <span className="text-sm font-semibold text-cms-text">{channel.name}</span>
            </div>
            <span className="text-xs text-cms-text-dim">{channel.handle}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${neverSynced ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className={`text-xs ${neverSynced ? 'text-amber-400' : 'text-cms-text-dim'}`}>
              {neverSynced ? 'Never' : timeAgo(channel.lastSyncedAt!)}
            </span>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSync}
            className={`rounded px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
              neverSynced
                ? 'bg-cms-accent text-white'
                : 'border border-cms-border text-cms-text-muted hover:bg-cms-surface-hover'
            }`}
          >
            {isPending ? '⟳ …' : neverSynced ? '⟳ First Sync' : '⟳ Sync'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 border-b border-cms-border px-4 py-2.5">
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{channel.videoCount}</span> videos
        </div>
        <div className="text-xs text-cms-text-muted">
          <span className="font-semibold text-cms-text">{formatCount(channel.subscriberCount)}</span> subscribers
        </div>
      </div>

      {/* Weekly Pick */}
      <div className={`border-l-[3px] ${pinAccent} px-4 py-3`}>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${
            pinState === 'active' ? 'text-amber-400'
              : pinState === 'expiring' ? 'text-amber-500'
                : 'text-cms-text-dim'
          }`}>
            ★ Weekly Pick
          </span>
          {channel.pinnedVideo && pinState !== 'none' && (
            <span className={`text-xs ${
              pinState === 'expiring' ? 'font-medium text-amber-500' : 'text-cms-text-dim'
            }`}>
              {pinState === 'expiring'
                ? `⚠ Expires ${daysLeft(channel.pinnedVideo.pinnedUntil) <= 1 ? 'tomorrow' : `in ${daysLeft(channel.pinnedVideo.pinnedUntil)} days`}`
                : `until ${new Date(channel.pinnedVideo.pinnedUntil).toLocaleDateString('en', { month: 'short', day: 'numeric' })} (${daysLeft(channel.pinnedVideo.pinnedUntil)}d left)`
              }
            </span>
          )}
        </div>

        {channel.pinnedVideo && pinState !== 'none' ? (
          <>
            <div className="flex items-center gap-3">
              {channel.pinnedVideo.thumbnailUrl && (
                <Image
                  src={channel.pinnedVideo.thumbnailUrl}
                  alt=""
                  width={72}
                  height={40}
                  className="rounded object-cover"
                  unoptimized
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-cms-text">{channel.pinnedVideo.title}</p>
                <p className="text-xs text-cms-text-dim">
                  {formatCount(channel.pinnedVideo.viewCount)} views · {formatCount(channel.pinnedVideo.likeCount)} likes
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 border-t border-cms-border pt-2">
              <Link
                href={`/cms/youtube/videos?channel=${channel.id}`}
                className="text-xs font-medium text-cms-accent hover:underline"
              >
                Change pick →
              </Link>
              <span className="text-cms-text-dim">|</span>
              <button
                type="button"
                onClick={() => setShowUnpinConfirm(true)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Unpin
              </button>
            </div>
          </>
        ) : (
          <div className="py-2 text-center">
            <p className="mb-2 text-sm text-cms-text-dim">No video pinned this week</p>
            <Link
              href={`/cms/youtube/videos?channel=${channel.id}`}
              className="inline-flex items-center gap-1 rounded bg-cms-accent/10 px-3 py-1.5 text-xs font-medium text-cms-accent hover:bg-cms-accent/20"
            >
              ☆ Choose Weekly Pick →
            </Link>
          </div>
        )}
      </div>

      {/* Unpin confirmation dialog */}
      {showUnpinConfirm && (
        <div className="border-t border-cms-border px-4 py-3">
          <p className="mb-1 text-sm font-medium text-cms-text">Remove weekly pick?</p>
          <p className="mb-3 text-xs text-cms-text-muted">
            The home page will fall back to showing the latest video for this channel.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowUnpinConfirm(false)}
              className="rounded border border-cms-border px-3 py-1 text-xs text-cms-text-muted hover:bg-cms-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handleUnpin}
              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Unpin
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardConnected({ channels, uncategorizedCount }: Props) {
  if (channels.length === 0) {
    return (
      <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-cms-text">No YouTube channels configured</p>
        <p className="mt-2 text-sm text-cms-text-muted">
          Add channels in{' '}
          <Link href="/cms/settings?section=youtube" className="text-cms-accent hover:underline">
            Settings → YouTube
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      {uncategorizedCount > 0 && (
        <div className="flex items-center gap-2 rounded-[var(--cms-radius)] border border-amber-900/40 bg-amber-900/10 px-4 py-2.5">
          <span className="text-sm text-amber-400">
            {uncategorizedCount} video{uncategorizedCount !== 1 ? 's' : ''} with pending category suggestions
          </span>
          <Link
            href="/cms/youtube/videos"
            className="ml-auto text-xs font-medium text-cms-accent hover:underline"
          >
            Review →
          </Link>
        </div>
      )}

      {/* Channel cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {channels.map(ch => (
          <ChannelCard key={ch.id} channel={ch} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/youtube/page.tsx apps/web/src/app/cms/'(authed)'/youtube/dashboard-connected.tsx
git commit -m "feat(youtube): add dashboard page with per-channel cards"
```

---

### Task 7: Enhanced Pin Duration Dropdown UX

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/video-row-actions.tsx`
- Modify: `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts`

- [ ] **Step 1: Update `pinSchema` max from 30 to 90**

In `apps/web/src/app/cms/(authed)/youtube/videos/actions.ts`, change line 113:

```typescript
durationDays: z.number().int().min(1).max(90),
```

- [ ] **Step 2: Add `is_hidden` check to `pinWeeklyPick` action**

In the same file, in the `pinWeeklyPick` function (around line 122-131), update the video validation query to also check `is_hidden`:

```typescript
const { data: video } = await supabase
  .from('youtube_videos')
  .select('id')
  .eq('id', parsed.data.videoId)
  .eq('channel_id', parsed.data.channelId)
  .eq('site_id', siteId)
  .eq('is_hidden', false)
  .single()

if (!video) return { ok: false, error: 'Video not found or is hidden' }
```

- [ ] **Step 3: Replace `PinButton` with enhanced `PinDropdown`**

In `apps/web/src/app/cms/(authed)/youtube/videos/video-row-actions.tsx`, replace the entire `PinButton` component (lines 137-205) with:

```typescript
interface PinButtonProps {
  videoId: string
  channelId: string
  pinnedUntil: string | null
  hasExistingPin: boolean
}

export function PinButton({ videoId, channelId, pinnedUntil, hasExistingPin }: PinButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [showDropdown, setShowDropdown] = useState(false)
  const [customDays, setCustomDays] = useState('')
  const isPinned = !!pinnedUntil && new Date(pinnedUntil) > new Date()

  const handlePin = (days: number) => {
    if (days < 1 || days > 90) return
    startTransition(async () => {
      await pinWeeklyPick({ videoId, channelId, durationDays: days })
      setShowDropdown(false)
      setCustomDays('')
    })
  }

  const handleUnpin = () => {
    startTransition(async () => {
      await unpinWeeklyPick({ channelId })
    })
  }

  if (isPinned) {
    const until = new Date(pinnedUntil!).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    const days = Math.ceil((new Date(pinnedUntil!).getTime() - Date.now()) / 86_400_000)
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-amber-900/30 px-2 py-0.5 text-xs font-semibold text-amber-400">
          ★ Pinned until {until}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={handleUnpin}
          className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          Unpin
        </button>
      </div>
    )
  }

  const presets = [7, 15, 30] as const

  function untilDate(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000)
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setShowDropdown(!showDropdown)}
        className="text-xs text-cms-text-dim hover:text-cms-text disabled:opacity-50"
        title="Pin as weekly pick"
      >
        ☆ Pin
      </button>
      {hasExistingPin && !isPinned && (
        <span className="block text-[9px] italic text-cms-text-dim">replaces current</span>
      )}
      {showDropdown && (
        <div className="absolute right-0 top-6 z-10 min-w-[200px] rounded-lg border border-cms-border bg-cms-surface p-1 shadow-lg">
          <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-cms-text-dim">
            Pin Duration
          </div>
          {presets.map(d => (
            <button
              key={d}
              type="button"
              disabled={isPending}
              onClick={() => handlePin(d)}
              className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-xs text-cms-text hover:bg-cms-surface-hover disabled:opacity-50"
            >
              <span>{d} days</span>
              <span className="text-cms-text-dim">until {untilDate(d)}</span>
            </button>
          ))}
          <div className="mt-1 flex items-center gap-1.5 border-t border-cms-border px-2.5 pt-2 pb-1">
            <span className="text-[10px] text-cms-text-dim">Custom:</span>
            <input
              type="number"
              min={1}
              max={90}
              value={customDays}
              onChange={e => setCustomDays(e.target.value)}
              placeholder="days"
              className="w-14 rounded border border-cms-border bg-cms-surface px-1.5 py-0.5 text-[10px] text-cms-text"
            />
            <button
              type="button"
              disabled={isPending || !customDays || Number(customDays) < 1 || Number(customDays) > 90}
              onClick={() => handlePin(Number(customDays))}
              className="rounded bg-cms-accent px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
            >
              Pin
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update `PinButton` usage in `videos-connected.tsx` to pass `hasExistingPin`**

In `apps/web/src/app/cms/(authed)/youtube/videos/videos-connected.tsx`, the `PinButton` usage (around line 296-298) needs to compute `hasExistingPin`. 

Before the table rendering, compute a set of channel IDs that have active pins:
```typescript
const channelsWithPins = useMemo(() => {
  const set = new Set<string>()
  for (const v of videos) {
    if (v.pinnedUntil && new Date(v.pinnedUntil) > new Date()) {
      set.add(v.channelId)
    }
  }
  return set
}, [videos])
```

Then update the `PinButton` call:
```typescript
<PinButton
  videoId={video.id}
  channelId={video.channelId}
  pinnedUntil={video.pinnedUntil}
  hasExistingPin={channelsWithPins.has(video.channelId)}
/>
```

- [ ] **Step 5: Add gold left border to pinned video rows**

In `videos-connected.tsx`, modify the `<tr>` element to have a gold left border when pinned:
```typescript
<tr
  key={video.id}
  className={`border-b border-cms-border last:border-0 hover:bg-cms-surface-hover ${
    video.pinnedUntil && new Date(video.pinnedUntil) > new Date()
      ? 'border-l-[3px] border-l-amber-500'
      : ''
  }`}
>
```

- [ ] **Step 6: Update existing pin action tests**

In `apps/web/test/youtube/pin-actions.test.ts`, update the test for valid pin to use 90 as max:

Add a test case:
```typescript
it('accepts duration up to 90 days', async () => {
  mockSingle.mockResolvedValue({ data: { id: 'v1' }, error: null })
  mockRpc.mockResolvedValue({ data: null, error: null })
  const result = await pinWeeklyPick({
    videoId: '11111111-1111-1111-1111-111111111111',
    channelId: '22222222-2222-2222-2222-222222222222',
    durationDays: 90,
  })
  expect(result.ok).toBe(true)
})

it('rejects duration > 90', async () => {
  const result = await pinWeeklyPick({
    videoId: '11111111-1111-1111-1111-111111111111',
    channelId: '22222222-2222-2222-2222-222222222222',
    durationDays: 91,
  })
  expect(result.ok).toBe(false)
})
```

- [ ] **Step 7: Run tests**

Run: `npm run test:web`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/'(authed)'/youtube/videos/video-row-actions.tsx apps/web/src/app/cms/'(authed)'/youtube/videos/videos-connected.tsx apps/web/src/app/cms/'(authed)'/youtube/videos/actions.ts apps/web/test/youtube/pin-actions.test.ts
git commit -m "feat(youtube): enhanced pin dropdown with 7/15/30/custom presets + max 90 days"
```

---

### Task 8: Dashboard Tests

**Files:**
- Create: `apps/web/test/youtube/dashboard.test.ts`

- [ ] **Step 1: Write dashboard state computation tests**

Create `apps/web/test/youtube/dashboard.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Dashboard pin state', () => {
  function getPinState(pinnedUntil: string | null): 'active' | 'expiring' | 'none' {
    if (!pinnedUntil) return 'none'
    const until = new Date(pinnedUntil)
    const now = new Date()
    if (until <= now) return 'none'
    const daysLeft = Math.ceil((until.getTime() - now.getTime()) / 86_400_000)
    if (daysLeft <= 2) return 'expiring'
    return 'active'
  }

  it('returns "none" when no pin', () => {
    expect(getPinState(null)).toBe('none')
  })

  it('returns "none" when pin is expired', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString()
    expect(getPinState(yesterday)).toBe('none')
  })

  it('returns "active" when >2 days left', () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString()
    expect(getPinState(future)).toBe('active')
  })

  it('returns "expiring" when ≤2 days left', () => {
    const soon = new Date(Date.now() + 1.5 * 86_400_000).toISOString()
    expect(getPinState(soon)).toBe('expiring')
  })

  it('returns "expiring" when exactly 2 days left', () => {
    const twoDays = new Date(Date.now() + 2 * 86_400_000).toISOString()
    expect(getPinState(twoDays)).toBe('expiring')
  })
})

describe('Dashboard formatCount', () => {
  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  it('formats numbers below 1000 as-is', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(999)).toBe('999')
  })

  it('formats thousands with K suffix', () => {
    expect(formatCount(1000)).toBe('1.0K')
    expect(formatCount(15_200)).toBe('15.2K')
  })

  it('formats millions with M suffix', () => {
    expect(formatCount(1_000_000)).toBe('1.0M')
    expect(formatCount(2_500_000)).toBe('2.5M')
  })
})

describe('Dashboard timeAgo', () => {
  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  it('formats minutes', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(timeAgo(fiveMinAgo)).toBe('5m ago')
  })

  it('formats hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
    expect(timeAgo(twoHoursAgo)).toBe('2h ago')
  })

  it('formats days', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString()
    expect(timeAgo(threeDaysAgo)).toBe('3d ago')
  })
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/youtube/dashboard.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/test/youtube/dashboard.test.ts
git commit -m "test(youtube): add dashboard state computation tests"
```

---

### Task 9: Final Integration — Run Full Test Suite

**Files:** None (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: ALL PASS (both api and web)

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify the dev server starts and YouTube pages render**

Run: `cd apps/web && npm run dev`
Navigate to:
- `/cms/youtube` — Dashboard should render
- `/cms/youtube/videos` — Videos tab should be active
- `/cms/youtube/categories` — Categories tab should be active
- `/cms/youtube/comments` — Comments tab should be active
- Sidebar should show YouTube under Content section

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(youtube): final integration fixes"
```
