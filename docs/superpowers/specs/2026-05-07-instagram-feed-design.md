# Instagram Feed Integration — Design Spec

**Date:** 2026-05-07
**Status:** Draft
**Sprint:** 5d (Vercel deploy hardening) / pre-Sprint 6

## Overview

Add Instagram feed auto-sync and display to the CMS engine. Posts are fetched daily via the Instagram Graph API, cached to Vercel Blob, and displayed on the site as a reusable content-slot component. Each instance of the component is independently configurable: layout type (grid or scatter), post count (1–12), and pin/auto-fill slot assignment with drag-to-reorder.

Follows the **YouTube-mirror pattern** already established in the codebase: dedicated DB tables, cron-based sync, CMS settings UI, and public display component.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Meta Instagram Graph API                                │
│  GET /me/media?fields=...&access_token=...               │
└──────────────┬───────────────────────────────────────────┘
               │  daily cron + manual "Sync Now"
               ▼
┌──────────────────────────────────────────────────────────┐
│  Sync Service  (lib/instagram/sync.ts)                   │
│  • Fetch recent media from API                           │
│  • Upsert into instagram_posts (ON CONFLICT ig_media_id) │
│  • Copy media_url → Vercel Blob (cached_image_url)       │
│  • Update like_count / comments_count on existing posts   │
│  • Log result to instagram_sync_log                      │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  Supabase                                                │
│  ┌─────────────────┐  ┌──────────────────┐               │
│  │instagram_accounts│  │instagram_posts   │               │
│  │ (config, token)  │──│ (synced media)   │               │
│  └────────┬────────┘  └────────┬─────────┘               │
│           │                    │                          │
│  ┌────────┴────────┐          │                          │
│  │instagram_feed_  │──────────┘                          │
│  │slots (pin/auto) │                                     │
│  └─────────────────┘                                     │
│  ┌─────────────────┐                                     │
│  │instagram_sync_  │                                     │
│  │log              │                                     │
│  └─────────────────┘                                     │
└──────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  <InstagramFeed />  (reusable content slot)              │
│  • Server-side slot resolution (pinned + auto-fill)      │
│  • Layout: grid | scatter (per instance)                 │
│  • Count: 1–12 (per instance)                            │
│  • Mobile: staggered 2-col grid fallback                 │
│  • Polaroid card design (tape, grain, organic rotations) │
└──────────────────────────────────────────────────────────┘
```

---

## Database Schema

All tables live in `public` schema. Migration file: `supabase/migrations/<timestamp>_instagram_feed.sql`.

### instagram_accounts

Mirrors `youtube_channels` structure. One account per site+locale.

```sql
CREATE TABLE IF NOT EXISTS public.instagram_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  locale          text NOT NULL DEFAULT 'pt',
  handle          text NOT NULL,
  ig_user_id      text,
  access_token    text,
  token_expires_at timestamptz,
  sync_enabled    boolean NOT NULL DEFAULT true,
  display_slots   int NOT NULL DEFAULT 6,
  layout_type     text NOT NULL DEFAULT 'grid',
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_accounts_display_slots_check
    CHECK (display_slots >= 1 AND display_slots <= 12),
  CONSTRAINT instagram_accounts_layout_type_check
    CHECK (layout_type IN ('grid', 'scatter')),
  CONSTRAINT instagram_accounts_locale_check
    CHECK (locale IN ('pt', 'en')),
  CONSTRAINT instagram_accounts_site_locale_key
    UNIQUE (site_id, locale)
);
```

**Notes:**
- `access_token` is a long-lived token (60-day expiry). Not encrypted via pgcrypto — column is protected by RLS (staff-only read via a view; see RLS section). Stored as plain text in DB, never exposed to the client.
- `ig_user_id` is populated on first successful sync.
- `display_slots` and `layout_type` are defaults — each component instance can override them via props.

### instagram_posts

All posts synced from the API. Kept indefinitely (not purged on unsync).

```sql
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  ig_media_id      text NOT NULL,
  media_type       text NOT NULL,
  media_url        text,
  thumbnail_url    text,
  cached_image_url text,
  caption          text,
  permalink        text NOT NULL,
  like_count       int NOT NULL DEFAULT 0,
  comments_count   int NOT NULL DEFAULT 0,
  ig_timestamp     timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_posts_media_type_check
    CHECK (media_type IN ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')),
  CONSTRAINT instagram_posts_ig_media_id_key
    UNIQUE (ig_media_id)
);

CREATE INDEX idx_instagram_posts_account_ts
  ON public.instagram_posts (account_id, ig_timestamp DESC);
```

**Notes:**
- `media_url` is the original Meta URL — expires in ~1 hour. Kept for reference, never used for display.
- `cached_image_url` is the permanent Vercel Blob URL. This is what the public component renders.
- `thumbnail_url` is for VIDEO type posts (Meta provides this separately).
- Upsert key: `ig_media_id`. On conflict, update `like_count`, `comments_count`, `media_url`, `updated_at`.

### instagram_feed_slots

Pin/auto-fill slot assignments. One row per slot position per account.

```sql
CREATE TABLE IF NOT EXISTS public.instagram_feed_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.instagram_accounts(id) ON DELETE CASCADE,
  position    int NOT NULL,
  post_id     uuid REFERENCES public.instagram_posts(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_feed_slots_position_check
    CHECK (position >= 1 AND position <= 12),
  CONSTRAINT instagram_feed_slots_account_position_key
    UNIQUE (account_id, position)
);
```

**Slot resolution logic (server-side):**
1. Fetch all slots for the account, ordered by `position ASC`.
2. Collect pinned post IDs (slots where `post_id IS NOT NULL`).
3. Fetch latest N posts (excluding pinned IDs), ordered by `ig_timestamp DESC`.
4. For each slot: if `post_id` is set → use that post; else → pop next from the latest pool.
5. Return resolved array of posts in slot order.

**Drag-to-reorder:**
When the user reorders slots in the CMS UI, the server receives the new ordering and updates `position` values in a single transaction: `UPDATE instagram_feed_slots SET position = $new WHERE id = $id` for each slot.

### instagram_sync_log

Mirrors `youtube_sync_log` structure.

```sql
CREATE TABLE IF NOT EXISTS public.instagram_sync_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  account_id     uuid REFERENCES public.instagram_accounts(id) ON DELETE SET NULL,
  mode           text NOT NULL,
  status         text NOT NULL,
  posts_found    int NOT NULL DEFAULT 0,
  posts_inserted int NOT NULL DEFAULT 0,
  posts_updated  int NOT NULL DEFAULT 0,
  media_cached   int NOT NULL DEFAULT 0,
  error_message  text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT instagram_sync_log_mode_check
    CHECK (mode IN ('daily', 'manual', 'token_refresh')),
  CONSTRAINT instagram_sync_log_status_check
    CHECK (status IN ('started', 'completed', 'failed'))
);

CREATE INDEX idx_instagram_sync_log_recent
  ON public.instagram_sync_log (site_id, created_at DESC);
```

### RLS Policies

Follow the existing YouTube pattern exactly:

```sql
-- instagram_accounts
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_accounts_public_read ON public.instagram_accounts;
CREATE POLICY instagram_accounts_public_read
  ON public.instagram_accounts FOR SELECT
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS instagram_accounts_staff_write ON public.instagram_accounts;
CREATE POLICY instagram_accounts_staff_write
  ON public.instagram_accounts TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- instagram_posts
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_posts_public_read ON public.instagram_posts;
CREATE POLICY instagram_posts_public_read
  ON public.instagram_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_posts_staff_write ON public.instagram_posts;
CREATE POLICY instagram_posts_staff_write
  ON public.instagram_posts TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

-- instagram_feed_slots
ALTER TABLE public.instagram_feed_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_feed_slots_public_read ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_public_read
  ON public.instagram_feed_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.site_visible(a.site_id)
    )
  );

DROP POLICY IF EXISTS instagram_feed_slots_staff_write ON public.instagram_feed_slots;
CREATE POLICY instagram_feed_slots_staff_write
  ON public.instagram_feed_slots TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instagram_accounts a
      WHERE a.id = account_id AND public.can_edit_site(a.site_id)
    )
  );

-- instagram_sync_log (staff read only — no public access)
ALTER TABLE public.instagram_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS instagram_sync_log_staff_read ON public.instagram_sync_log;
CREATE POLICY instagram_sync_log_staff_read
  ON public.instagram_sync_log FOR SELECT TO authenticated
  USING (public.can_edit_site(site_id));
```

**Token security:** The `access_token` column on `instagram_accounts` is readable via the `instagram_accounts_public_read` policy. To prevent exposure:
- Create a **view** `instagram_accounts_public` that selects all columns except `access_token` and `token_expires_at`.
- Public components query the view. CMS settings queries the full table (staff-only context via service client).
- Alternatively, the public component fetches posts + slots directly — it never needs account-level data.

---

## API Layer

### Sync Service — `lib/instagram/sync.ts`

```typescript
interface SyncResult {
  postsFound: number
  postsInserted: number
  postsUpdated: number
  mediaCached: number
}

async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow
): Promise<SyncResult>
```

**Flow:**
1. Call `GET https://graph.instagram.com/v21.0/{ig_user_id}/media?fields=id,media_type,media_url,thumbnail_url,caption,permalink,like_count,comments_count,timestamp&access_token={token}&limit=50`
2. Parse response. Handle pagination if needed (cursor-based).
3. For each post:
   a. Check if `ig_media_id` exists in `instagram_posts`.
   b. If new: insert row, then upload `media_url` to Vercel Blob → set `cached_image_url`.
   c. If existing: update `like_count`, `comments_count`, `media_url`, `updated_at`.
4. Update `instagram_accounts.last_synced_at`.
5. Log result to `instagram_sync_log`.

**Media caching:**
- Use `@vercel/blob` `put()` with path `instagram/{account_id}/{ig_media_id}.jpg`.
- Fetch the `media_url` (which expires in ~1h) and stream it to Blob.
- For VIDEO type: cache the `thumbnail_url` instead of the video.
- For CAROUSEL_ALBUM: cache only the first image (the `media_url` for carousels is the cover).

### Token Refresh Service — `lib/instagram/token-refresh.ts`

```typescript
async function refreshInstagramToken(
  supabase: SupabaseClient,
  account: InstagramAccountRow
): Promise<{ newToken: string; expiresAt: Date }>
```

**Flow:**
1. Call `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token={token}`
2. Response: `{ access_token, token_type, expires_in }` (expires_in is in seconds, typically 5184000 = 60 days).
3. Update `instagram_accounts` with new `access_token` and `token_expires_at`.
4. Log to `instagram_sync_log` with `mode = 'token_refresh'`.

### Slot Resolution — `lib/instagram/slots.ts`

```typescript
interface ResolvedSlot {
  position: number
  post: InstagramPostRow
  pinned: boolean
}

async function resolveInstagramSlots(
  supabase: SupabaseClient,
  accountId: string,
  count?: number  // override display_slots
): Promise<ResolvedSlot[]>
```

This is the core function used by the public component. See slot resolution logic in Database Schema section.

### Server Actions — `lib/instagram/actions.ts`

CMS settings UI calls these via server actions:

```typescript
async function updateInstagramAccount(data: {
  accountId: string
  handle?: string
  syncEnabled?: boolean
  displaySlots?: number
  layoutType?: 'grid' | 'scatter'
}): Promise<ActionResult>

async function setInstagramToken(data: {
  accountId: string
  accessToken: string
}): Promise<ActionResult>

async function triggerInstagramSync(data: {
  accountId: string
}): Promise<ActionResult>

async function updateInstagramSlots(data: {
  accountId: string
  slots: { position: number; postId: string | null }[]
}): Promise<ActionResult>

async function addInstagramAccount(data: {
  siteId: string
  handle: string
  locale: string
}): Promise<ActionResult>

async function removeInstagramAccount(data: {
  accountId: string
}): Promise<ActionResult>
```

All write actions must call `requireSiteAdmin()` or equivalent guard before proceeding.

---

## CMS UI

### Settings Page Addition

Add an **"Instagram"** section to `apps/web/src/app/cms/(authed)/settings/settings-connected.tsx`, positioned after the YouTube section.

**Section ID:** `'instagram'`
**Section label:** `'Instagram'`

### InstagramSection Component

```
┌─────────────────────────────────────────────────────┐
│  Instagram Feed                                     │
│                                                     │
│  ┌─ Account ──────────────────────────────────────┐ │
│  │  Handle: @bythiagofigueiredo                   │ │
│  │  Status: ● Connected · last sync 2h ago        │ │
│  │  [Sync Now]  [Remove Account]                  │ │
│  └────────────────────────────────────────────────┘ │
│                                                     │
│  ┌─ Display Settings ────────────────────────────┐  │
│  │  Slots: [====●======] 6                       │  │
│  │  Layout: (●) Grid  ( ) Scatter                │  │
│  │  Sync: [✓] Auto-sync enabled                  │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Token ───────────────────────────────────────┐  │
│  │  [Paste access token _______________] [Save]  │  │
│  │  Expires: Jun 28, 2026 (52 days left)         │  │
│  │  Auto-refresh: enabled                        │  │
│  └────────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ Pin Management ─────────────────────────────┐   │
│  │  Drag to reorder · Click to pin/unpin         │   │
│  │  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐              │   │
│  │  │📌│ │📌│ │⟳ │ │⟳ │ │📌│ │⟳ │              │   │
│  │  │ 1│ │ 2│ │ 3│ │ 4│ │ 5│ │ 6│              │   │
│  │  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘              │   │
│  │  Legend: 📌 Pinned  ⟳ Auto-fill (latest)     │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Sync Log ───────────────────────────────────┐   │
│  │  May 07, 09:00 — completed · 3 new, 12 updated│  │
│  │  May 06, 09:00 — completed · 0 new, 15 updated│  │
│  │  May 05, 09:00 — failed · token expired        │  │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Pin Management — Drag-to-Reorder

**Implementation:** Use `@dnd-kit/core` + `@dnd-kit/sortable` (already standard in React DnD ecosystems, lightweight, accessible).

Behavior:
- Grid of slot cards, each showing: position number, thumbnail, pin/auto badge.
- **Drag** a slot card to reorder → updates `position` values on drop.
- **Click** a slot card → opens a post picker modal to pin a specific post, or unpins if already pinned.
- **Post picker modal:** shows recent posts as thumbnails in a scrollable grid. Clicking one pins it to the selected slot.
- Changes are saved immediately (optimistic UI with server confirmation).
- Slots adjust dynamically when `display_slots` count changes (add/remove from the end).

### "No Account" State

If no `instagram_accounts` row exists for the current site:

```
┌─────────────────────────────────────────────────────┐
│  Instagram Feed                                     │
│                                                     │
│  No Instagram account configured.                   │
│  [Add Instagram Account]                            │
│                                                     │
│  Handle: [@________________]                        │
│  Locale: [pt ▾]                                     │
│  [Connect]                                          │
└─────────────────────────────────────────────────────┘
```

---

## Public Component

### `<InstagramFeed />`

**Location:** `apps/web/src/components/instagram/instagram-feed.tsx`

This is a **reusable content-slot component** — it can be placed on any page, similar to a hero section or newsletter CTA. Each instance is independently configurable.

```typescript
interface InstagramFeedProps {
  accountId?: string      // explicit account; if omitted, resolved from site context
  layout?: 'grid' | 'scatter'  // overrides account default
  count?: number          // overrides account's display_slots (1–12)
  className?: string
}
```

**Server Component:** Fetches resolved slots server-side (no client-side data fetching). Uses `resolveInstagramSlots()` from `lib/instagram/slots.ts`.

### Rendering

**Polaroid Card** — matches existing Pinboard design (`design/pinboard.jsx`):
- Paper-colored background with subtle grain texture (CSS `::before` with SVG noise)
- Translucent tape strip at top (3 color variants: yellow, blue, red)
- Square photo (aspect-ratio: 1/1) with inner vignette shadow
- Handwritten caption (Caveat font)
- Date + like count in monospace
- Organic rotation per card (seeded pseudo-random from post ID)
- Push-pin badge on pinned posts (optional, CMS toggle)

**Grid Layout:**
- CSS Grid with columns based on count: 3→3col, 5→6col asymmetric (3+2), 6→3col, 8→4col, 12→4col.
- `gap` scales down for higher counts (26px→16px).
- Padding, caption font size, tape height scale via CSS custom properties per grid class.
- Organic Y-offset per card (`nth-child` translateY) to break perfect grid symmetry.

**Scatter Layout (desktop only):**
- Absolute-positioned polaroids on a relative canvas.
- Hand-tuned position arrays per count (3, 5, 6, 8, 12).
- Subtle float animation (CSS `@keyframes float`) with per-card duration/delay/amplitude.
- Hover pauses float, lifts card (-8px translateY), and nearly eliminates rotation.

**Mobile Fallback (all layouts):**
- Always renders as a **staggered 2-column grid** regardless of layout_type.
- Even-indexed cards shift down 14px, odd-indexed cards shift up 4px — creates organic stagger.
- Tailwind responsive: `grid-cols-2` at mobile breakpoint.

### Section Header

Matches the existing Pinboard section style:
- Handwritten label ("últimos cliques" / "latest shots") in Caveat font, accent color, slight rotation
- Serif heading ("do iPhone, sem filtro") in Fraunces
- Monospace metadata (`@handle · atualizado automaticamente`)
- "Siga no Instagram" / "Follow on Instagram" button (ink background, monospace uppercase)

### Integration Point — Pinboard

In `apps/web/src/app/(public)/page.tsx` (or wherever `<PinboardHome />` lives), add:

```tsx
<InstagramFeed layout="scatter" count={5} />
```

This replaces the static mock data currently in the Pinboard design.

---

## Cron Jobs

### GET /api/cron/instagram-sync

**File:** `apps/web/src/app/api/cron/instagram-sync/route.ts`

```typescript
export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET
  // 2. Query all instagram_accounts where sync_enabled = true
  // 3. For each account: call syncInstagramAccount()
  // 4. revalidateTag('instagram-feed')
  // 5. Return summary
}
```

**Schedule:** `0 8 * * *` (daily at 08:00 UTC, which is 05:00 BRT)

**Manual trigger:** Same endpoint with `?mode=manual` query param. Called from the "Sync Now" button in CMS settings.

### GET /api/cron/instagram-token-refresh

**File:** `apps/web/src/app/api/cron/instagram-token-refresh/route.ts`

```typescript
export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req: NextRequest) {
  // 1. Verify CRON_SECRET
  // 2. Query instagram_accounts where token_expires_at < now() + interval '7 days'
  // 3. For each: call refreshInstagramToken()
  // 4. Return summary
}
```

**Schedule:** `0 6 * * 1` (weekly, Mondays at 06:00 UTC)

### vercel.json Addition

```json
{ "path": "/api/cron/instagram-sync", "schedule": "0 8 * * *" },
{ "path": "/api/cron/instagram-token-refresh", "schedule": "0 6 * * 1" }
```

---

## Environment Variables

**No new environment variables required for MVP.**

- Tokens are stored per-account in the `instagram_accounts` table, not as env vars.
- The Instagram Graph API `refresh_access_token` endpoint only requires the existing access token — no App Secret needed.
- `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` — only needed if implementing OAuth flow later (out of scope for MVP).

**If OAuth flow is added later**, add:

| Variable | Where | Purpose |
|----------|-------|---------|
| `INSTAGRAM_APP_ID` | Vercel (public) | Meta App ID for OAuth redirect |
| `INSTAGRAM_APP_SECRET` | Vercel (secret) | Meta App Secret for code → token exchange |

---

## Testing Strategy

### Unit Tests

**`apps/web/test/unit/instagram/sync.test.ts`**
- Mock Instagram Graph API responses (success, pagination, rate limit, expired token)
- Verify correct upsert behavior (new posts inserted, existing posts updated)
- Verify media caching calls to Vercel Blob
- Verify error handling (API down, invalid token, malformed response)

**`apps/web/test/unit/instagram/slots.test.ts`**
- Slot resolution with all pinned
- Slot resolution with all auto
- Slot resolution with mixed (pinned + auto)
- Slot resolution with fewer posts than slots (some slots empty)
- Slot resolution with deleted pinned post (ON DELETE SET NULL → falls back to auto)
- Drag-to-reorder: verify position updates

**`apps/web/test/unit/instagram/token-refresh.test.ts`**
- Successful token refresh
- Failed refresh (revoked token)
- Token not yet expiring (no-op)

### Integration Tests (gated on `HAS_LOCAL_DB`)

**`apps/web/test/integration/instagram/`**
- Cron endpoint returns 401 without CRON_SECRET
- Cron endpoint with valid secret triggers sync
- Server action: add account, set token, trigger sync, update slots
- RLS: anonymous user can read posts but not access_token
- RLS: staff can write, non-staff cannot

### Component Tests

**`apps/web/test/unit/instagram/instagram-feed.test.tsx`**
- Renders correct number of cards
- Grid layout applies correct CSS class
- Scatter layout renders absolute-positioned cards
- Pin badge shows on pinned posts
- Empty state (no posts)

---

## Migration Plan

### Single Migration File

`supabase/migrations/<next_timestamp>_instagram_feed.sql`

Contains:
1. All four `CREATE TABLE` statements
2. All indexes
3. All RLS `ENABLE` + policy statements
4. Idempotent: uses `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`

### Rollout Steps

1. **Merge migration** → `npm run db:push:prod`
2. **Deploy code** — new cron endpoints, lib/instagram/, CMS settings section, `<InstagramFeed />` component
3. **Configure account** — via CMS settings: add handle, paste token
4. **First sync** — hit "Sync Now" to populate posts + cache media
5. **Configure slots** — pin desired posts, set count + layout
6. **Add to Pinboard** — wire `<InstagramFeed />` into the homepage
7. **Add crons to vercel.json** — enable daily sync + weekly token refresh

### Dependencies

- `@dnd-kit/core` + `@dnd-kit/sortable` — for drag-to-reorder in CMS settings (new dependency)
- `@vercel/blob` — already installed (used by Media System)
- No other new dependencies required.

---

## Out of Scope

- **OAuth flow** for initial token acquisition — MVP uses paste-token. OAuth can be added later.
- **Carousel image gallery** — only the cover image is cached and shown. Expanding to show all carousel items is a future enhancement.
- **Instagram Stories** — the Graph API for stories is separate and ephemeral. Not included.
- **Comment display** — `comments_count` is stored but individual comments are not synced.
- **Video playback** — videos show as thumbnail with a play icon linking to Instagram.
- **Instagram Reels** — treated as VIDEO type, thumbnail displayed.
