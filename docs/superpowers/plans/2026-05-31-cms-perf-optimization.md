# CMS Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce CMS navigation latency from 400ms-1.5s+ to <200ms perceived (skeleton visible in ~50ms) by caching middleware, parallelizing layout auth, adding loading skeletons, and fixing SPA navigation.

**Architecture:** 4 sub-phases executed in order. Phase 1 (config + skeletons + quick fixes) is committed separately from Phase 2 (auth refactor + caching + navigation) to enable granular rollback. All changes are application-level code — no DB migrations.

**Tech Stack:** Next.js 15, React 19, Supabase PostgREST, TypeScript 5, Vitest

---

## File Map

### Modified files
| File | Tasks | Purpose |
|------|-------|---------|
| `apps/web/next.config.ts` | 1 | Add staleTimes |
| `apps/web/src/app/cms/(authed)/layout.tsx` | 3, 7, 8 | Narrow notifs select, collapse auth, parallelize queries |
| `apps/web/src/lib/pipeline/load-pipeline-detail.ts` | 4 | Narrow pipeline selects |
| `apps/web/src/middleware.ts` | 6, 9, 10 | Passthrough hoist, site cache, cron skip |
| `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` | 5 | DOMPurify swap |
| `apps/web/src/app/cms/(authed)/_shared/notification-popover.tsx` | 11 | router.push |
| `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx` | 11 | router.push |
| `apps/web/src/app/cms/(authed)/links/_components/short-links-tab.tsx` | 12 | router.push |
| `apps/web/src/app/cms/(authed)/links/_components/analytics-view.tsx` | 12 | router.push |
| `apps/web/src/app/cms/(authed)/links/_components/top-links-table.tsx` | 12 | router.push |
| `apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx` | 12 | router.push |
| `apps/web/src/app/cms/(authed)/contacts/[id]/page.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/linktree/_components/linktree-editor.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/links/_components/linktree/linktree-editor.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/youtube/_components/youtube-shell.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/_components/dashboard-youtube-card.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/social/stories/new/page.tsx` | 13 | <a> → Link |
| `apps/web/src/app/cms/(authed)/subscribers/page.tsx` | 16 | select('*') → select('id') |
| `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-kpis.tsx` | 16 | select('*') → select('id') |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` | 16 | select('*') → select('id') |
| `apps/web/src/lib/notifications/use-notification-channel.ts` | 15 | Use singleton browser client |
| `apps/web/src/lib/social/realtime.ts` | 15 | Use singleton browser client |

### New files
| File | Task | Purpose |
|------|------|---------|
| `apps/web/src/app/cms/(authed)/loading.tsx` | 2 | Top-level CMS skeleton |
| `apps/web/src/lib/supabase/browser.ts` | 15 | Singleton browser Supabase client |
| `apps/web/lib/cms/layout-counts.ts` | 14 | Cached layout count queries |
| `apps/web/lib/cms/accessible-sites.ts` | 8 | React.cache() wrapped RPC |

### Deleted files
| File | Task | Reason |
|------|------|--------|
| `apps/web/src/app/cms/(authed)/analytics/_components/views-trend-chart.tsx` | 4 | Dead code, zero imports |

---

## PHASE 1 — Quick Wins (commit 1)

### Task 1: Add staleTimes to next.config.ts

**Files:**
- Modify: `apps/web/next.config.ts:38-42`

- [ ] **Step 1: Add staleTimes config**

In `apps/web/next.config.ts`, add `staleTimes` inside the existing `experimental` block:

```typescript
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    staleTimes: {
      dynamic: 15,
    },
  },
```

- [ ] **Step 2: Verify config loads**

Run: `cd apps/web && npx next info`
Expected: No config errors

---

### Task 2: Create top-level CMS loading.tsx

**Files:**
- Create: `apps/web/src/app/cms/(authed)/loading.tsx`

- [ ] **Step 1: Create the skeleton file**

Create `apps/web/src/app/cms/(authed)/loading.tsx` following the social/ pattern (`apps/web/src/app/cms/(authed)/social/loading.tsx`):

```tsx
export default function CmsLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 animate-pulse rounded-md bg-cms-border" />
        <div className="h-9 w-28 animate-pulse rounded-md bg-cms-border" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-cms-border" />
        ))}
      </div>
    </div>
  )
}
```

---

### Task 3: Narrow notifications select in layout.tsx

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx:75`

- [ ] **Step 1: Replace select('*') with explicit columns**

In `apps/web/src/app/cms/(authed)/layout.tsx` line 75, replace:

```typescript
    svc.from('notifications').select('*')
```

with:

```typescript
    svc.from('notifications').select('id, site_id, user_id, type, domain, title, message, action_href, suggested_action, priority, read_at, dismissed_at, expired_at, snoozed_until, dedup_key, group_key, created_at')
```

This excludes only `payload` (heavy JSONB column). Column list verified against `INotification` in `apps/web/src/lib/notifications/types.ts`.

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass

---

### Task 4: Narrow pipeline selects + delete dead file

**Files:**
- Modify: `apps/web/src/lib/pipeline/load-pipeline-detail.ts:21-23`
- Delete: `apps/web/src/app/cms/(authed)/analytics/_components/views-trend-chart.tsx`

- [ ] **Step 1: Narrow content_pipeline select**

In `apps/web/src/lib/pipeline/load-pipeline-detail.ts` line 22, replace:

```typescript
    supabase.from('content_pipeline').select('*').eq('id', id).eq('site_id', siteId).single(),
```

with:

```typescript
    supabase.from('content_pipeline').select('id, site_id, code, stage, format, priority, status, language, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata, sections, blog_post_id, scheduled_at, is_archived, version, created_at, updated_at').eq('id', id).eq('site_id', siteId).single(),
```

- [ ] **Step 2: Narrow content_pipeline_history select**

In the same file line 23, replace:

```typescript
    supabase.from('content_pipeline_history').select('*').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
```

with:

```typescript
    supabase.from('content_pipeline_history').select('id, pipeline_id, event_type, from_value, to_value, changed_by, changed_at').eq('pipeline_id', id).order('changed_at', { ascending: false }).limit(20),
```

- [ ] **Step 3: Delete dead ViewsTrendChart**

Delete `apps/web/src/app/cms/(authed)/analytics/_components/views-trend-chart.tsx`.

Verify it is dead:
Run: `grep -rn "ViewsTrendChart\|views-trend-chart" apps/web/src/ --include="*.ts" --include="*.tsx" | grep -v "views-trend-chart.tsx"`
Expected: No output (zero imports)

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass

---

### Task 5: Replace isomorphic-dompurify with dompurify

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx:3`

**WARNING:** `isomorphic-dompurify` also appears in `newsletter/archive/[id]/page.tsx` and `blog-article-html.tsx` — those are SERVER components. DO NOT replace in those files.

- [ ] **Step 1: Verify dompurify is available**

Run: `ls apps/web/node_modules/dompurify/package.json 2>/dev/null && echo "OK" || echo "MISSING"`

If MISSING, run: `cd apps/web && npm install dompurify`

- [ ] **Step 2: Replace import**

In `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx`, find:

```typescript
import DOMPurify from 'isomorphic-dompurify'
```

Replace with:

```typescript
import DOMPurify from 'dompurify'
```

---

### Task 6: Move go.* passthrough before getSiteByDomain

**Files:**
- Modify: `apps/web/src/middleware.ts:144-176`

- [ ] **Step 1: Hoist passthrough check**

In `apps/web/src/middleware.ts`, the go.* subdomain block starts at line 137. Currently:
- Line 144: `const code = ...`
- Line 146-148: `getRingContext()` → `ring.getSiteByDomain(baseDomain)` (DB call)
- Lines 173-176: passthrough check for `robots.txt`, `favicon.ico`, etc.

Move the passthrough check to right after `code` is computed, BEFORE the DB call:

```typescript
    const code = pathname === '/' ? '' : pathname.slice(1)

    const passthrough = ['robots.txt', 'favicon.ico', 'manifest.webmanifest', 'icon.svg']
    if (passthrough.includes(code)) {
      return NextResponse.next()
    }

    const ring = getRingContext()
    try {
      const site = await ring.getSiteByDomain(baseDomain)
```

And remove lines 173-176 (the old passthrough check location).

---

### Task 17: Commit Phase 1

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && npm test 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.ts apps/web/src/app/cms/"(authed)"/loading.tsx apps/web/src/app/cms/"(authed)"/layout.tsx apps/web/src/lib/pipeline/load-pipeline-detail.ts apps/web/src/middleware.ts apps/web/src/app/cms/"(authed)"/blog/new/post-edition-editor.tsx
git status
git commit -m "$(cat <<'EOF'
perf(cms): phase 1 quick wins — staleTimes, loading skeleton, select narrowing

- Add staleTimes: { dynamic: 15 } for 15s Router Cache on dynamic pages
- Create top-level cms/(authed)/loading.tsx skeleton for all CMS routes
- Narrow notifications select to exclude heavy payload JSONB column
- Narrow pipeline detail + history selects to needed columns only
- Delete dead ViewsTrendChart (zero imports, removes recharts from graph)
- Move go.* passthrough check before getSiteByDomain DB call
- Replace isomorphic-dompurify with dompurify in client component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## PHASE 2A — Middleware + Layout Auth (commit 2)

### Task 7: Collapse layout auth — 1 getUser + parallel RPCs

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx:1-62`

This is the most security-critical change. The current code calls `requireUser(supabase)` (getUser #1), then `requireArea('cms')` (which internally calls getUser #2 + is_member_staff RPC), then `supabase.rpc('user_accessible_sites')` — all sequentially. We collapse to: 1 getUser → parallel(is_member_staff + user_accessible_sites) → auth check → data queries.

- [ ] **Step 1: Update imports**

In `apps/web/src/app/cms/(authed)/layout.tsx`, replace lines 1-5:

```typescript
import {
  createServerClient,
  requireArea,
  requireUser,
} from '@tn-figueiredo/auth-nextjs'
```

with:

```typescript
import {
  createServerClient,
} from '@tn-figueiredo/auth-nextjs'
import { redirect } from 'next/navigation'
```

- [ ] **Step 2: Replace auth + sites block**

Replace lines 46-61 (from `const user = await requireUser(supabase)` through `const userRole = ...`) with:

```typescript
  // --- Auth gate (inlined from requireArea('cms')) ---
  // Single getUser() round-trip. requireArea internally called getUser() a
  // second time + is_member_staff RPC sequentially. We do both RPCs in parallel.
  // Security: getUser() validates against auth server (not just JWT).
  // If @tn-figueiredo/auth-nextjs updates requireArea semantics, update here.
  const { data: { user: rawUser }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !rawUser) redirect('/cms/login')

  const [staffRes, sitesRes] = await Promise.all([
    supabase.rpc('is_member_staff'),
    supabase.rpc('user_accessible_sites'),
  ])
  if (staffRes.error || !staffRes.data) redirect('/?error=insufficient_access')

  const user = { id: rawUser.id, email: rawUser.email ?? '' }
  const rawSites = (sitesRes.data ?? []) as RpcAccessibleSite[]
  const sites = rawSites.map((s) => ({
    id: s.site_id,
    slug: s.site_slug,
    name: s.site_name,
    primary_domain: s.primary_domain,
    logo_url: null,
  })) as AccessibleSite[]
  const currentSiteId = rawSites[0]?.site_id ?? ''
  const currentSite = rawSites.find((s) => s.site_id === currentSiteId)
  const userDisplayName = rawUser.email ?? 'User'
  const userRole = currentSite?.user_role ?? 'reporter'
```

- [ ] **Step 3: Verify auth security**

Check the flow preserves the security invariant:
1. `supabase.auth.getUser()` → validates token against auth server (same as requireUser)
2. `supabase.rpc('is_member_staff')` → same DB check as requireArea's internal call
3. Redirect on failure → matches requireArea behavior
4. Data queries (Promise.all below) only run AFTER auth check passes

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass

---

### Task 8: Create accessible-sites React.cache wrapper

**Files:**
- Create: `apps/web/lib/cms/accessible-sites.ts`

- [ ] **Step 1: Create the cached wrapper**

Create `apps/web/lib/cms/accessible-sites.ts`:

```typescript
import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RpcAccessibleSite } from '@/components/cms/site-switcher-provider'

export const getAccessibleSites = cache(
  async (supabase: SupabaseClient): Promise<RpcAccessibleSite[]> => {
    const { data } = await supabase.rpc('user_accessible_sites')
    return (data ?? []) as RpcAccessibleSite[]
  }
)
```

This enables any child server component to call `getAccessibleSites(supabase)` without a second RPC. The layout from Task 7 already calls the RPC directly in Promise.all — this wrapper is for future child components.

---

### Task 9: Cache middleware site resolution with in-memory TTL Map

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Add site cache near the top of the file**

After the `getRingContext()` function definition (around line 90), add:

```typescript
const SITE_CACHE_TTL_MS = 60_000
const siteByDomainCache = new Map<string, { site: Awaited<ReturnType<SupabaseRingContext['getSiteByDomain']>>; exp: number }>()

async function getSiteByDomainCached(
  ring: InstanceType<typeof SupabaseRingContext>,
  hostname: string,
) {
  const now = Date.now()
  const hit = siteByDomainCache.get(hostname)
  if (hit && hit.exp > now) return hit.site
  const site = await ring.getSiteByDomain(hostname)
  siteByDomainCache.set(hostname, { site, exp: now + SITE_CACHE_TTL_MS })
  return site
}
```

- [ ] **Step 2: Replace getSiteByDomain calls with cached version**

In the go.* subdomain block (line 148), replace:
```typescript
      const site = await ring.getSiteByDomain(baseDomain)
```
with:
```typescript
      const site = await getSiteByDomainCached(ring, baseDomain)
```

In `resolveSite()` (line 335), replace:
```typescript
    const site = await ring.getSiteByDomain(hostname)
```
with:
```typescript
    const site = await getSiteByDomainCached(ring, hostname)
```

---

### Task 10: Skip site resolution for cron/webhook/auth routes

**Files:**
- Modify: `apps/web/src/middleware.ts`

- [ ] **Step 1: Add early-return after go.* block**

After the go.* subdomain block closes (line 217, after `}`) and before the i18n section (line 219), add:

```typescript
  const isCronOrWebhook =
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/auth/')
  if (isCronOrWebhook) {
    return NextResponse.next()
  }
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npm test -- --reporter=verbose 2>&1 | tail -20`
Expected: All tests pass

---

## PHASE 2B — Navigation + Caching

### Task 11: Replace window.location.href with router.push (notifications + social)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/notification-popover.tsx`
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`

- [ ] **Step 1: Fix notification-popover.tsx**

In `apps/web/src/app/cms/(authed)/_shared/notification-popover.tsx`:

Add import at line 3 (after existing react import):
```typescript
import { useRouter } from 'next/navigation'
```

Add router init inside the component (line 41, after `const [activeFilter, ...`):
```typescript
  const router = useRouter()
```

Replace the `handleAction` callback (lines 134-144):
```typescript
  const handleAction = useCallback(
    (id: string, href: string | null) => {
      if (!href) return
      dispatch({ type: 'MARK_READ', id })
      markRead(id)
      if (href.startsWith('/')) {
        router.push(href)
      } else {
        window.location.href = href
      }
    },
    [dispatch, router],
  )
```

- [ ] **Step 2: Fix compositor-new.tsx**

In `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx`:

Add import (after existing react import on line 1):
```typescript
import { useRouter } from 'next/navigation'
```

Add router init at top of `CompositorNew` component body:
```typescript
  const router = useRouter()
```

Replace line 334:
```typescript
                  router.push('/cms/social?tab=drafts')
```

Replace line 356:
```typescript
                    router.push('/cms/social')
```

---

### Task 12: Replace window.location.href in Links module

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/links/_components/short-links-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/links/_components/analytics-view.tsx`
- Modify: `apps/web/src/app/cms/(authed)/links/_components/top-links-table.tsx`
- Modify: `apps/web/src/app/cms/(authed)/links/[id]/qr/client.tsx`

- [ ] **Step 1: Fix short-links-tab.tsx (4 instances)**

Add `import { useRouter } from 'next/navigation'` and `const router = useRouter()` in the component.

Replace all 4 instances of `window.location.href = ` with `router.push(`:
- Line 129: `onClick={() => router.push(\`/cms/links/${l.id}\`)}`
- Line 246: `onClick={() => router.push(\`/cms/links/${l.id}\`)}`
- Line 247: `onKeyDown={(e) => { if (e.key === 'Enter') router.push(\`/cms/links/${l.id}\`) }}`
- Line 297: `router.push(\`/cms/links/${l.id}/qr\`)`

- [ ] **Step 2: Fix analytics-view.tsx (1 instance)**

Add `import { useRouter } from 'next/navigation'` and `const router = useRouter()`.

Line 262: `onClick={() => router.push('/cms/links?tab=links')}`

- [ ] **Step 3: Fix top-links-table.tsx (1 instance)**

Add `import { useRouter } from 'next/navigation'` and `const router = useRouter()`.

Line 32: `onClick={() => router.push(l.id === 'linktree' ? '/cms/links?tab=tree' : \`/cms/links/${l.id}\`)}`

- [ ] **Step 4: Fix links/[id]/qr/client.tsx (1 instance)**

This file already has `useRouter` imported. Line 40:
```typescript
        router.push(`/cms/links/${link.id}/qr?card=${result.cardId}`)
```

---

### Task 13: Replace raw <a> tags with Link

**Files:** 6 files with raw `<a href="/cms/...">` tags.

- [ ] **Step 1: contacts/[id]/page.tsx**

Add `import Link from 'next/link'` if not present. Line 101: replace `<a href="/cms/contacts"` with `<Link href="/cms/contacts"` and `</a>` with `</Link>`.

- [ ] **Step 2: linktree/_components/linktree-editor.tsx**

Add `import Link from 'next/link'`. Line 74: replace `<a href="/cms/links"` with `<Link href="/cms/links"` and close tag.

- [ ] **Step 3: links/_components/linktree/linktree-editor.tsx (3 instances)**

Add `import Link from 'next/link'`. Lines 81, 90: replace breadcrumb `<a>` tags with `<Link>`. Preserve all inline styles.

- [ ] **Step 4: youtube/_components/youtube-shell.tsx**

This file already imports `Link`. Line 93: replace `<a href="/cms/settings?section=youtube"` with `<Link href="/cms/settings?section=youtube"` and close tag.

- [ ] **Step 5: _components/dashboard-youtube-card.tsx**

Add `import Link from 'next/link'`. Line 17: replace `<a href="/cms/youtube/analytics"` with `<Link href="/cms/youtube/analytics"` and close tag.

- [ ] **Step 6: social/stories/new/page.tsx**

Add `import Link from 'next/link'`. Line 106: replace `<a href="/cms/social/connections"` with `<Link href="/cms/social/connections"` and close tag.

---

### Task 14: Cache layout count queries with unstable_cache

**Files:**
- Create: `apps/web/lib/cms/layout-counts.ts`
- Modify: `apps/web/src/app/cms/(authed)/layout.tsx`

- [ ] **Step 1: Create layout-counts.ts**

Create `apps/web/lib/cms/layout-counts.ts`:

```typescript
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function fetchLayoutCountsInner(siteId: string) {
  const svc = getSupabaseServiceClient()
  const [pendingContactsRes, ytPendingRes, researchUnreadRes] = await Promise.all([
    svc.from('contact_submissions').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).is('replied_at', null).is('anonymized_at', null),
    svc.from('youtube_videos').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('auto_suggested_category_id', 'is', null)
      .is('category_id', null),
    svc.from('research_items').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).eq('status', 'new'),
  ])
  return {
    pendingContacts: pendingContactsRes.count ?? 0,
    ytPending: ytPendingRes.count ?? 0,
    researchUnread: researchUnreadRes.count ?? 0,
  }
}

export const fetchLayoutCounts = unstable_cache(
  fetchLayoutCountsInner,
  ['layout-counts'],
  { tags: ['layout-counts'], revalidate: 60 },
)
```

- [ ] **Step 2: Update layout.tsx to use cached counts**

In the layout's data fetching Promise.all, replace the 3 inline count queries with:

```typescript
  const { siteId: middlewareSiteId, timezone: siteTimezone } = await getSiteContext()
  const svc = getSupabaseServiceClient()
  const [badgeData, layoutCounts, notificationsRes] = await Promise.all([
    fetchSidebarBadges(middlewareSiteId, siteTimezone),
    fetchLayoutCounts(middlewareSiteId),
    svc.from('notifications').select('id, site_id, user_id, type, domain, title, message, action_href, suggested_action, priority, read_at, dismissed_at, expired_at, snoozed_until, dedup_key, group_key, created_at')
      .eq('site_id', middlewareSiteId)
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .is('expired_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const badges: Record<string, number> = {}
  if (layoutCounts.pendingContacts) badges['/cms/contacts'] = layoutCounts.pendingContacts
  if (layoutCounts.ytPending) badges['/cms/youtube'] = layoutCounts.ytPending
  if (layoutCounts.researchUnread) badges['/cms/library/research'] = layoutCounts.researchUnread
```

Add import at top: `import { fetchLayoutCounts } from '@/lib/cms/layout-counts'`

---

### Task 15: Create singleton browser Supabase client

**Files:**
- Create: `apps/web/src/lib/supabase/browser.ts`
- Modify: `apps/web/src/lib/notifications/use-notification-channel.ts`
- Modify: `apps/web/src/lib/social/realtime.ts`

- [ ] **Step 1: Create singleton module**

Create `apps/web/src/lib/supabase/browser.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return _client
}
```

- [ ] **Step 2: Update use-notification-channel.ts**

Find the local `getSupabaseBrowserClient` function and remove it. Replace with:
```typescript
import { getSupabaseBrowserClient } from '@/lib/supabase/browser'
```

- [ ] **Step 3: Update realtime.ts**

Same pattern — remove local factory, import from singleton module.

---

### Task 16: Replace select('*') with select('id') in count-only queries

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/subscribers/page.tsx` (4 instances)
- Modify: `apps/web/src/app/cms/(authed)/subscribers/_components/subscriber-kpis.tsx` (3 instances)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` (2 instances)

- [ ] **Step 1: Fix subscribers/page.tsx**

Lines 89, 94, 99, 104: replace each `.select('*', { count: 'exact', head: true })` with `.select('id', { count: 'exact', head: true })`.

- [ ] **Step 2: Fix subscriber-kpis.tsx**

Lines 47, 53, 60: same replacement.

- [ ] **Step 3: Fix ab-lab/actions.ts**

Lines 929, 1076: same replacement.

---

### Task 18: Commit Phase 2

- [ ] **Step 1: Run full test suite**

Run: `cd apps/web && npm test 2>&1 | tail -5`
Expected: All tests pass

- [ ] **Step 2: Run full build**

Run: `cd apps/web && npx next build 2>&1 | tail -10`
Expected: Build succeeds (this is the same check the pre-commit hook runs)

- [ ] **Step 3: Commit**

```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
perf(cms): phase 2 — middleware cache, auth collapse, SPA navigation, query caching

Middleware:
- Cache getSiteByDomain with 60s in-memory TTL Map
- Skip site resolution for /api/cron/, /api/webhooks/, /auth/ routes

Layout auth:
- Collapse 4 sequential auth calls (requireUser + requireArea + sites RPC)
  into 1 getUser + 2 parallel RPCs. Saves ~130ms per navigation.
- Security invariant preserved: is_member_staff checked before data queries
- Cache layout badge counts with unstable_cache (60s TTL)

Navigation:
- Replace 10 window.location.href with router.push (SPA navigation)
- Replace 8 raw <a> tags with next/link Link component
- Create singleton browser Supabase client (deduplicate WebSocket)

Queries:
- Replace select('*') with select('id') in 9 count-only queries

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Verification

### Post-implementation smoke test

- [ ] **Step 1:** Open `/cms/blog` in browser — skeleton should flash briefly, then content loads
- [ ] **Step 2:** Click a blog post → pipeline page — should show skeleton, then load (no white screen)
- [ ] **Step 3:** Click browser back button — should be INSTANT (staleTimes cache)
- [ ] **Step 4:** Click a notification in the bell — should navigate without full page reload
- [ ] **Step 5:** Go to Links module, click a link row — should navigate without full page reload
- [ ] **Step 6:** Check browser DevTools Network tab — verify no duplicate Supabase auth calls
- [ ] **Step 7:** Log out and try accessing `/cms` — should redirect to `/cms/login`
- [ ] **Step 8:** Log in as non-staff user — should redirect to `/?error=insufficient_access`
