# CMS Performance Optimization — Design Spec

**Date:** 2026-05-31
**Approach:** Blitz Sprint (single session, all phases)
**Estimated total:** ~6-8 hours

## Problem

Every navigation in the CMS triggers 14+ Supabase calls across 3 blocking layers (middleware → layout → page) before any pixel renders. Combined with zero `loading.tsx` files (69+ routes), `staleTimes: 0` (Next.js 15 default), and 8+ `window.location.href` calls killing SPA navigation, the CMS feels frozen for 400ms-1.5s+ per click.

### Root Causes

1. **CMS layout re-executes ~10 queries on every navigation** — 3 sequential auth calls (requireUser → requireArea with internal getUser → user_accessible_sites) + 5 parallel queries (sidebar badges, contacts count, youtube count, research count, 50 notifications with select('*')). Only sidebar badges is cached (unstable_cache 60s TTL).

2. **Few loading.tsx outside /social** — most CMS routes lack skeletons. Some exist (settings, pipeline, contacts, youtube sub-routes) but the top-level CMS layout has none, meaning the shell itself blocks. No visual feedback while layout queries run.

3. **Middleware runs uncached DB query on every request** — `getSiteByDomain()` hits Supabase on all 168 routes including 42 crons that never use site headers.

### Waterfall (p50 estimates)

```
Middleware:  getSiteByDomain(55ms) → getUser(75ms)                    = ~130ms
Layout:     requireUser(75ms) → requireArea(75ms+55ms) → sites(55ms) = ~260ms
            → Promise.all(badges,contacts,yt,research,notifs)         = ~70ms
Page:       requireSiteScope(40ms) → Promise.all(3-5 queries)        = ~60ms
Total:      ~520ms p50, up to 1.5s+ p95
```

## Phase 1 — Quick Wins (~2h)

### 1.1 Add staleTimes to next.config.ts
**File:** `apps/web/next.config.ts`
**Change:** Add `staleTimes: { dynamic: 15 }` to the existing `experimental` block after `serverActions`.
**Impact:** 15-second client-side Router Cache for dynamic pages. Rapid back/forth navigation becomes instant.
**Risk:** Low-Medium. Stable Next.js 15 config. `router.refresh()` bypasses it after mutations. **However:** server actions that end with `redirect()` do NOT trigger `router.refresh()` — the redirect goes through the Router Cache. Must audit all CMS mutation server actions: those using `redirect()` after mutations need `revalidatePath()` called before the redirect to bust the cache. Without this, users may see stale data for up to 15s after creating/editing content.

### 1.2 Create top-level CMS loading.tsx
**File:** `apps/web/src/app/cms/(authed)/loading.tsx` (new)
**Change:** Generic CMS skeleton with topbar + content placeholder using `animate-pulse` on `bg-cms-border` (matching social/ pattern).
**Impact:** Instant skeleton for all 69+ CMS routes. Single highest-leverage file.
**Risk:** None. New file only.

### 1.3 Narrow notifications select
**File:** `apps/web/src/app/cms/(authed)/layout.tsx` line 75
**Change:** Replace `select('*')` with `select('id, site_id, user_id, type, domain, title, message, action_href, suggested_action, priority, read_at, dismissed_at, expired_at, snoozed_until, dedup_key, group_key, created_at')`. Excludes only `payload` (heavy JSONB column).
**Impact:** Drops JSONB payload column from 50-row response on every navigation.
**Risk:** Low. Column list verified against INotification type. Note: `message` is the correct field name (not `body`). `type` is required by `TYPE_COLORS[n.type]` in notification-center.tsx. `suggested_action` is rendered in notification-row.tsx.

### 1.4 Narrow pipeline detail selects
**File:** `apps/web/src/lib/pipeline/load-pipeline-detail.ts` lines 22-23
**Change:** Replace both `select('*')` with explicit column lists. Pipeline: `id, site_id, code, stage, format, priority, status, language, title_pt, title_en, hook, synopsis, body_content, tags, production_checklist, format_metadata, sections, blog_post_id, scheduled_at, created_at, updated_at`. History: `id, pipeline_id, changed_at, changed_by, old_stage, new_stage, note`.
**Impact:** Avoids transferring body_compiled (10-50KB compiled MDX) on every pipeline detail load.
**Risk:** Medium. Must verify columns against DB schema and all consumers.

### 1.5 Delete dead ViewsTrendChart
**File:** `apps/web/src/app/cms/(authed)/analytics/_components/views-trend-chart.tsx`
**Change:** Delete file. grep confirms zero imports anywhere.
**Impact:** Removes recharts from module graph.
**Risk:** None.

### 1.6 Move go.* passthrough before getSiteByDomain
**File:** `apps/web/src/middleware.ts`
**Change:** Move passthrough check (robots.txt, favicon.ico, etc.) before the `ring.getSiteByDomain(baseDomain)` call. The `code` variable is already available.
**Impact:** Eliminates unnecessary DB query for static file requests on go.* subdomain.
**Risk:** Low. Pure code reorder, no logic change.

### 1.7 Replace isomorphic-dompurify with dompurify
**File:** `apps/web/src/app/cms/(authed)/blog/new/post-edition-editor.tsx` line 3
**Change:** `import DOMPurify from 'isomorphic-dompurify'` → `import DOMPurify from 'dompurify'`. This is a `'use client'` component.
**Impact:** Reduces client bundle (5MB → 656KB for dompurify). Identical API.
**Risk:** Low. Verify dompurify is in deps (or add it).
**WARNING:** `isomorphic-dompurify` also appears in `newsletter/archive/[id]/page.tsx` and `blog-article-html.tsx` — those are SERVER components where plain `dompurify` will NOT work (needs jsdom). DO NOT replace in those files.

### 1.8 Replace window.location.href with router.push (notifications)
**File:** `apps/web/src/app/cms/(authed)/_shared/notification-popover.tsx` line 141
**Change:** Add `useRouter` import, initialize `router`, replace `window.location.href = href` with guard: internal paths use `router.push(href)`, external use `window.location.href`.
**Impact:** Notification clicks no longer cause full page reload.
**Risk:** Low. Must guard against external URLs in notification hrefs.

### 1.9 Replace window.location.href with router.push (social compositor)
**File:** `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx` lines 334, 356
**Change:** Add `useRouter` import, replace both `window.location.href` assignments with `router.push()`.
**Impact:** Social post creation no longer causes full page reload.
**Risk:** Low. Both are internal CMS paths.

## Phase 2A — Middleware + Layout Auth (~2-3h)

### 2A.1 Cache middleware site resolution with in-memory TTL Map
**File:** `apps/web/src/middleware.ts`
**Change:** Add module-level `Map<string, { site, exp }>` with 60s TTL. Create `getSiteByDomainCached()` wrapper. Replace both `ring.getSiteByDomain()` calls (main path + go.* path).
**Impact:** Eliminates 55ms DB query on 99%+ of requests. Domain mapping changes once/month.
**Risk:** Low. Map lives in process memory. Null entries also cached (prevents scanner hammering).

### 2A.2 Skip site resolution for cron/webhook routes
**File:** `apps/web/src/middleware.ts`
**Change:** Early-return `NextResponse.next()` for paths starting with `/api/cron/`, `/api/webhooks/`, `/auth/`. Place after go.* block, before i18n.
**Impact:** Eliminates middleware DB query + auth for server-only routes.
**Risk:** Low. Verified: no cron/webhook route uses `getSiteContext()`.

### 2A.3 Collapse layout auth: 1 getUser + parallel RPCs
**File:** `apps/web/src/app/cms/(authed)/layout.tsx`
**Change:** Replace `requireUser(supabase)` + `requireArea('cms')` + `supabase.rpc('user_accessible_sites')` (3 sequential calls, including requireArea's internal getUser) with: single `supabase.auth.getUser()` → `Promise.all([rpc('is_member_staff'), rpc('user_accessible_sites')])`.
**Impact:** Reduces auth from ~260ms (4 sequential calls) to ~130ms (1 sequential + 2 parallel).
**Risk:** Medium. Inlines requireArea gate logic. Must maintain security equivalence. Add comment linking to auth-nextjs package.

### 2A.4 Parallelize layout queries (auth-first, then data)
**File:** `apps/web/src/app/cms/(authed)/layout.tsx`
**Change:** After 2A.3, structure as 3 stages:
1. `getUser()` — single auth round-trip
2. `Promise.all([rpc('is_member_staff'), rpc('user_accessible_sites')])` — auth RPCs in parallel
3. Check `is_member_staff` → redirect if denied
4. `Promise.all([badgeData, contactsRes, ytRes, researchRes, notifsRes])` — data queries only AFTER auth verified

**Security invariant:** No CMS data queries execute for non-staff users. The `is_member_staff` check MUST complete before any service-client queries run. This preserves the same guarantee as the current `requireArea()` → data pattern.
**Impact:** Cuts layout time from 4 sequential calls to 1 sequential + 2 parallel + 5 parallel (two stages). Saves ~130ms vs current.
**Risk:** Low. Security gate maintained before data access. Non-staff users never trigger service-client queries.

### 2A.5 Cache user_accessible_sites with React.cache()
**File:** New `apps/web/lib/cms/accessible-sites.ts`
**Change:** Wrap `supabase.rpc('user_accessible_sites')` in `React.cache()` for per-request dedup. Import in layout.
**Impact:** If any child server component also needs accessible sites, avoids second RPC.
**Risk:** Low. React.cache() is per-request scoped — no cross-user leak.

## Phase 2B — Navigation + Caching (~2-3h)

### 2B.1 Replace window.location.href in Links module (6+ instances)
**Files:** `short-links-tab.tsx` (4), `analytics-view.tsx` (1), `top-links-table.tsx` (1), `links/[id]/qr/client.tsx` (1)
**Change:** Add `useRouter`, replace `window.location.href` with `router.push()` in each.
**Impact:** Every link row click becomes SPA navigation instead of full reload.
**Risk:** Low. All internal CMS paths.

### 2B.2 Replace raw <a> tags with Link (8+ instances)
**Files:** `contacts/[id]/page.tsx`, `linktree-editor.tsx` (2 files, 4 instances), `links/[id]/edit/_form.tsx` (2), `youtube-shell.tsx` (1), `dashboard-youtube-card.tsx` (1), `social/stories/new/page.tsx` (1)
**Change:** Import `Link` from `next/link`, replace `<a href="/cms/...">` with `<Link href="/cms/...">`.
**Impact:** Breadcrumb and back-link navigation becomes SPA.
**Risk:** Low. Link renders <a> underneath — no visual change.

### 2B.3 Cache layout count queries with unstable_cache
**File:** New `apps/web/lib/cms/layout-counts.ts` + layout.tsx update
**Change:** Extract contacts/youtube/research count queries into cached function with 60s TTL and `['layout-counts']` tag. Add `revalidateTag('layout-counts')` to relevant server actions.
**Impact:** Eliminates 3 DB queries on rapid navigation within 60s window.
**Risk:** Low-Medium. Must verify revalidation calls exist in all mutation paths.

### 2B.4 Create singleton browser Supabase client
**File:** New `apps/web/src/lib/supabase/browser.ts`
**Change:** Module-level singleton pattern. Update `use-notification-channel.ts` and `realtime.ts` to import from singleton.
**Impact:** Eliminates duplicate WebSocket connections.
**Risk:** Low. `createBrowserClient` is designed for reuse.

### 2B.5 Add loading.tsx to route segments that lack them
**Change:** Before creating files, verify which routes already have loading.tsx (several already exist for settings, pipeline, contacts, youtube sub-routes). Only create for routes that are MISSING them. Check with: `find apps/web/src/app/cms -name "loading.tsx"` and cross-reference against high-traffic routes.
**Impact:** Fill gaps in loading state coverage.
**Risk:** None. New files only. Do NOT overwrite existing loading.tsx files.

## Phase 2C — Query Optimization (~30min)

### 2C.1 Replace select('*') with select('id') in count-only queries
**Files:** `subscribers/page.tsx` (4 instances), `subscriber-kpis.tsx` (3 instances), `ab-lab/actions.ts` (2 instances), `hub-queries.ts` (where applicable)
**Change:** Find all `select('*', { count: 'exact', head: true })` and replace with `select('id', { count: 'exact', head: true })`. Note: `brolls/page.tsx` and `audio/page.tsx` already use `select('id')`.
**Impact:** Minor per-query (5-20ms), cumulative across pages with 5-6 count queries.
**Risk:** None. `head: true` prevents row data return anyway.

### ~~2C.2 Parallelize contacts page queries~~ REMOVED
Contacts page already uses a single Promise.all for all queries. No sequential latency to eliminate.

### ~~2C.3 Parallelize authors page queries~~ REMOVED
Authors page already parallelizes authors + sites queries via Promise.all. Post-count query is correctly sequential (depends on author IDs result).

## Execution Order (Blitz Sprint)

```
1. Phase 1 Quick Wins (items 1.1-1.9)           ~60 min
   → npm run test:web
   → npm run build:packages (if touched packages)

2. Phase 2A Middleware + Layout (items 2A.1-2A.5) ~90 min
   → npm run test:web
   → Manual smoke: /cms loads, sidebar badges present, auth works

3. Phase 2B Navigation + Caching (items 2B.1-2B.5) ~90 min
   → npm run test:web

4. Phase 2C Query Optimization (items 2C.1-2C.3)  ~30 min
   → npm run test:web
   → npm run build (full next build — pre-commit equivalent)

5. Two commits (Phase 1 separate from Phase 2)     ~10 min
   → Enables granular rollback if Phase 2 auth changes cause issues
```

## Out of Scope (Phase 3 — separate sessions)

- Suspense streaming layout (CmsShell needs API change)
- Client-side notification lazy loading
- DB views/RPCs for unbounded queries (linktree_events, youtube_videos, newsletter_sends)
- Split settings-connected.tsx monolith (3580 lines)
- Extend unstable_cache to YouTube/Links/Pipeline/Contacts
- Lazy-load TipTap editor with next/dynamic
- Migrate 6 files from @supabase/ssr to auth-nextjs

## Risks

| Risk | Mitigation |
|------|-----------|
| Item 2A.3 inlines requireArea logic | Comment linking to package source. Update if package changes. |
| Middleware cache serves stale site | 60s TTL. Domain changes are monthly. |
| Missing revalidateTag for cached counts | Audit all mutation server actions before caching. |
| Pipeline select column list incomplete | Verify against DB migration schema before applying. |
| Item 1.6 response header leak fix is complex | Defer to Phase 3 — mergeSiteHeaders() reads from response headers. |
| staleTimes + redirect() = stale data | Audit all CMS server actions using redirect() after mutations. Add revalidatePath() before redirect(). |
| isomorphic-dompurify in SSR files | DO NOT replace in newsletter/archive or blog-article-html.tsx — SSR requires isomorphic-dompurify. |
| React.cache() dedup lost from requireArea | After inlining 2A.3, child components calling requireArea('cms') lose dedup. Monitor for extra RPC calls. |
| Middleware Map cache per-isolate on Edge | Each Vercel edge isolate has its own Map. Hit rate is modest but correctness is preserved. |

## Success Criteria

- CMS navigation shows skeleton within 100ms (loading.tsx + staleTimes)
- Back/forth navigation within 15s is instant (Router Cache)
- No full page reloads on internal CMS navigation (router.push)
- Layout auth reduced from 4 sequential calls to 1 + 2 parallel
- Middleware site lookup cached (1 DB hit per 60s instead of per-request)
- All existing tests pass
- next build succeeds (pre-commit equivalent)
