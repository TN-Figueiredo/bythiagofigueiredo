# Social Hub — Visual Design & UI Spec

**Date:** 2026-05-13
**Status:** Draft
**Sprint:** 5h — Social Hub (UI Layer)
**Companion to:** `2026-05-12-sprint-5h-social-hub-design.md` (infrastructure)
**Wireframes:** `.superpowers/brainstorm/23194-1778675695/content/` (4 HTML files, 22 screens)

---

## 1. Overview

This spec defines the complete UI layer for the Social Hub. All backend infrastructure is already built: `@tn-figueiredo/social` package (4 providers, token vault, media validator, content adapter, quota manager), server actions, OAuth flows, cron publishing, and Supabase Realtime hooks. This document covers what the user sees and interacts with.

### 1.1 Design Principles

- **Draft-first workflow:** AI/Cowork generates drafts → human reviews in Composer → schedule/publish. No auto-publish without explicit opt-in.
- **Platform-aware previews:** every selected platform gets a live preview reflecting its rendering rules.
- **Short links everywhere:** every URL shared via Social auto-creates a go.bythiagofigueiredo.com short link with UTM tags.
- **Scalability through automation:** 8 configurable rules reduce manual work as content volume grows.

### 1.2 Platforms

| Provider | Content Types | Limits |
|----------|--------------|--------|
| YouTube | Video, Short | Title 100, Desc 5000, Quota 10K/day |
| Facebook | Text/Link, Photo, Video, Multi-photo | Body 63,206 chars |
| Instagram | Feed, Story, Reel, Carousel | Caption 2,200, 30 hashtags, image required |
| Bluesky | Post, Thread, Image, Link Card | 300 chars, 4 images max (1MB each) |

---

## 2. Navigation & Information Architecture

### 2.1 Sidebar Changes

YouTube moves from CONTENT to SOCIAL section. Accounts replaces Settings > Social.

```
SOCIAL (new section, replaces Calendar + New Post)
├── 🎬 YouTube          → /cms/youtube (existing, enhanced)
├── 📡 Posts             → /cms/social (replaces Calendar page)
├── ✏️ Composer          → /cms/social/new (replaces New Post page)
├── 📊 Insights          → /cms/social/insights (new)
└── 🔗 Accounts          → /cms/social/accounts (new, replaces Settings > Social)
```

**Badge behavior:** Posts shows count of failed + pending AI drafts. Accounts shows connection count with health indicator.

### 2.2 Page Structure Per Nav Item

| Nav Item | Tabs / Sub-views |
|----------|-----------------|
| YouTube | Dashboard, Videos, A/B Lab, Comments, Categories, Content |
| Posts | Feed, Calendar, Queue, Drafts |
| Composer | Text/Link Mode, Image Mode, Video Mode (+ Template Picker, Bilingual, Draft Review) |
| Insights | Overview, Best Of, Platform Health |
| Accounts | Connections, Automations |

---

## 3. Screens — Composer

### 3.1 Text/Link Mode

**Layout:** Horizontal split. Left = editor, right = platform preview tabs, bottom = schedule bar.

**Left Panel (Editor):**
- Content textarea with per-platform character counter
- URL field with auto-generated short link (`go.bythiagofigueiredo.com/{slug}`) and UTM display (`utm_source=auto, utm_medium=social`)
- Media attachment via Media Gallery picker
- Hashtag input with autocomplete
- Evergreen toggle — marks post for periodic re-share (every N weeks)
- Platform selector chips — Facebook, Instagram, Bluesky (YouTube greyed: "Video mode only")
- "Draft from Cowork" badge when AI-originated

**Right Panel (Preview Tabs):**
- Facebook: OG link card with avatar, page name, caption, action bar
- Instagram: feed post with avatar, image, caption, hashtags
- Bluesky: AT Protocol post with link card embed, facets auto-detected
- "Override text" per-platform — replaces main content for one platform only

**Bottom Schedule Bar:**
- Mode toggle: Now / Schedule / Queue
- Datetime picker with timezone (default: São Paulo)
- Smart Schedule chip: "Best: Tue 14:00 (2.3× avg)"
- Primary action: "Schedule Post →"

**Server actions used:** `createSocialPost`, `updateSocialPost`
**Hooks used:** none (pre-publish)

### 3.2 Image Mode

Same split layout as Text/Link. Key differences:

**Left Panel:**
- Image upload grid — numbered, drag-to-reorder, per-platform max shown
- Auto-detection badges: "IG Carousel" (>1 image), "FB Multi-photo", "BS Image Post (1st only)"
- Crop warning: "Source is 16:9 — IG will crop to 4:5"
- Caption textarea (replaces content textarea)
- Hashtags placed as first comment for IG (best practice indicator shown)

**Right Panel:**
- IG carousel preview with dot indicators, left/right arrows, crop overlay
- FB multi-photo grid preview
- BS single-image post preview

**Constraints:**
- BS limited to 4 images, 1MB each — excess greyed with warning
- IG carousel max 10 images
- First image = cover across all platforms

### 3.3 Video Mode

**Left Panel:**
- Resumable upload zone with progress bar (MB uploaded / total, time remaining)
- Channel selector (multi-channel support)
- Title with inline SEO score and "AI Suggest Variants" link
- Description with timestamp formatting (auto-detected `00:00` patterns)
- Category / Privacy / Playlist dropdowns
- Tags input
- Quota bar: units used / 10,000 with unit breakdown

**Right Panel:**
- **Thumbnail A/B Test:** 2–3 upload slots, rotation period dropdown (24h/48h/72h)
- **Title A/B Test:** variant fields synced with thumbnails, optional 2×2 matrix mode
- **First Comment:** template with variable chips (`{short_link}`, `{newsletter_link}`, `{blog_title}`, `{channel_name}`, `{category}`, `{playlist_name}`)
- **Cross-post toggles:** FB (link+thumbnail), BS (link+OG), IG (greyed: "requires image")
- Yellow note: "Cross-posts go to draft queue for review"

**Server actions used:** `createSocialPost` (type: video)
**API routes used:** `/api/social/youtube/upload-session`, `/api/social/youtube/complete`

### 3.4 Template Picker

Dropdown triggered by "Templates ▾" button in Composer toolbar.

**Presets:** Blog Announcement, Video Launch, Newsletter Share, Link Share, Evergreen Re-share. Each shows: template text with `{variable}` placeholders, compatible platform icons, usage frequency. "+ Create custom" link opens template editor.

Variables resolve at publish time from source content metadata.

### 3.5 Bilingual Workflow

Activated by toggling EN on in Composer. Single editor splits into PT-BR (primary, left) + EN (right).

- "Auto-translate from PT" button (Cowork-powered)
- Publishing strategy radio:
  - Separate posts, same platforms, different times
  - Different accounts per language
  - Primary only (EN saved as draft)

PT-BR is always required. Auto-translate overwrites EN with confirmation if manual edits exist.

### 3.6 Draft Review Mode

Full Composer variant for AI-generated drafts.

- Yellow banner: "AI Draft — needs review" with source attribution and creation time
- Content with yellow highlights on AI-generated portions (all editable)
- Suggested platforms with AI confidence % per platform
- Suggested schedule from Smart Schedule
- Actions: "Approve & Schedule" / "Discard"

---

## 4. Screens — Posts

### 4.1 Feed View

**Layout:** Vertical card list with toolbar.

**Card contents:**
- Thumbnail (if media)
- Status badge: Published (green), Scheduled (blue), Partial Failure (orange), Queued (purple), Draft (yellow)
- Content preview (truncated 2 lines)
- Platform delivery chips: per-platform icon with ✓ or ✕
- Link clicks (from Links Engine `link_clicks` table)
- Engagement summary (likes, comments, shares)
- Actions: Edit, Duplicate, View, Cancel (scheduled), Retry (failed)

**Toolbar:** Status filter, Platform filter, Date range, "+ New Post" button.

**Bulk Actions:** Checkbox per card. Sticky action bar on selection: Reschedule, Retry Failed, Move to Queue, Delete. Delete confirmation: "Published posts removed from CMS only — remain live on platforms."

**Pagination:** numbered pages.

**Server actions used:** `listSocialPosts`, `cancelSocialPost`, `deleteSocialPost`, `retrySocialDelivery`

### 4.2 Calendar View

Month/week toggle. Day-cell grid with color-coded event blocks:
- Green = published, Blue = scheduled, Purple = queued, Orange = failed, Yellow = draft

Click event → navigate to Post Detail or open in Composer. Legend bar at bottom.

### 4.3 Queue Tab (Buffer-style)

- Smart Schedule slots row (from engagement heatmap): starred peak times, configurable via "Configure slots →"
- Queue items: drag-to-reorder with grip handles, position numbers, platform icons, scheduled time with "in X days"
- Empty slots: dashed outline ("add a post or let automations fill it")
- Queue active/paused toggle
- "+ Add to Queue" button

### 4.4 Drafts Tab

AI-generated drafts awaiting review. Each card shows: source (Blog/Newsletter/Evergreen), creation time, target platforms.

**Actions:** Review → (opens Draft Review in Composer), Quick Approve (schedule at Smart time), Discard.

**Empty state:** "No AI drafts pending" → Configure Automations.

---

## 5. Screens — Post Detail

### 5.1 Status Dashboard

**Layout:** Two-column. Header with back link, status badge, Edit/Duplicate/Delete actions.

**Left Column:**
- Content display (text, URL with short link, media)
- Platform list
- Metadata: created / approved / scheduled / published timestamps with actor

**Right Column:**
- Per-platform delivery cards:
  - **Published:** metrics (likes, comments, shares), link clicks from Links Engine, "View on [Platform] →" external link
  - **Failed:** error message with type classification (auth/permanent/transient), attempt count, Reconnect + Retry buttons
- Links Engine stats: total clicks with per-platform breakdown (horizontal bars)
- Timeline: chronological event log (created → approved → published/failed → retried)

**Hooks used:** `useSocialDeliveries(postId)`, `useSocialPostStatus(postId)` — Supabase Realtime for live status updates.

---

## 6. Screens — Insights

### 6.1 Overview

**KPI Cards (5):** Posts Published, Delivery Success %, Link Clicks, Avg Engagement, AI Drafts Approved. Each with trend vs. previous period.

**Engagement Over Time Chart:**
- Lines: clicks (purple), engagement (green). Bars: post count (blue).
- Period toggle: 7d / 30d / 90d
- Tooltip on hover with exact values. Summary bar below chart.

**Platform Performance:** Horizontal bars — clicks per platform with percentage labels.

**Best Posting Times:** Heatmap (day × time). Green intensity = engagement. Peak time highlighted. Data feeds Smart Schedule algorithm.

**Date range filter:** "Last 30 days ▾" dropdown.

### 6.2 Best Of / Leaderboards

**Podium Lists (3):**
- Top Thumbnails by CTR (with thumbnail previews)
- Top Titles by CTR (with A/B winner badges)
- Top Social Posts by Link Clicks (with platform source)

**A/B Test Results:**
- Active tests: live variant data (CTR, impressions, confidence %)
- Completed tests: winner CTR, loser CTR, improvement %, "auto-applied" indicator

### 6.3 Platform Health

**Health Cards (4):** YouTube, Facebook, Instagram, Bluesky.
- Connection status (✓ healthy / ✕ expired / ⚠ warning)
- Token expiry info
- Quota bar (YouTube only)

**Delivery Success Rate:** Bar chart by week (4 weeks). Annotated dips (e.g., "W3: IG token expiration caused 6 failures").

**Recent Errors:** Log with: platform icon, error type badge (auth/transient), message, occurrence count, date range.

---

## 7. Screens — Accounts

### 7.1 Connections

**Grid of 4 platform cards. Per card:**
- Connected account(s): avatar, display name, handle
- Token status: OK (green) / Expired (red) / Never Expires (grey)
- Quota bar (YouTube only, with daily reset time)
- Actions: + Add account, Manage, Reconnect (when expired)

Multi-account per platform. Reconnect triggers OAuth re-auth (popup window via `postMessage`).

**Server actions used:** `getConnections`, `connectSocial`, `disconnectSocial`
**API routes used:** `/api/social/oauth/[provider]`, `/api/social/oauth/[provider]/callback`

### 7.2 Automations

Toggle list of 8 automation rules:

| Rule | Trigger | Default Mode |
|------|---------|-------------|
| Blog Published | Pipeline status → published | Draft |
| Video Published | YouTube upload complete | Auto-publish |
| Newsletter Sent | Resend webhook post-send | Draft |
| Evergreen Timer | Cron (every N weeks per post) | Queue |
| Token Expiring (<7d) | Cron health check | Alert + pause |
| Post Failed | Delivery status → failed | Auto-retry (3x) |
| A/B Test Complete | Confidence ≥ 95% | Notify + auto-apply |
| Playlist Updated | Video added to playlist | Draft |

Per rule: on/off toggle, description, mode indicator, "Configure →" link.

### 7.3 Automation Config Detail (Modal)

- Trigger description (read-only)
- Action Mode: Create Draft vs. Auto-publish (radio)
- Target Platforms: toggle per connected account
- Content Template: editable with `{variable}` chips (title, excerpt, short_link, cover_image, author, category, tags)
- Scheduling: Smart Schedule vs. Fixed delay
- AI Enhancement: toggle (Cowork adapts copy per platform)
- Recent Activity log (last 10 executions)
- Delete / Cancel / Save

---

## 8. Screens — YouTube (moved from CONTENT to SOCIAL)

### 8.1 Dashboard (Enhanced)

Existing dashboard expanded with: avg CTR per channel, A/B Lab badge counts, Smart Schedule suggestion, SEO scores on recent videos.

**Channel cards:** avatar, stats (videos, subs, views, avg CTR), schedule suggestion, sync status.
**Recent Videos:** thumbnail + metadata + CTR badge + SEO badge + A/B status + performance grade (A+/B+/C).
**Quota bar + Smart Schedule suggestion** at bottom.

### 8.2 Videos Tab (New)

**Stats row:** Total Videos, Avg CTR, Avg SEO Score, Active A/B Tests.

**Video list cards:**
- Thumbnail with duration overlay
- Title, metadata (date, views, likes, comments)
- Badge row: CTR (color-coded), SEO score, A/B status, pinned comment, cross-post count
- Performance grade (A+ = CTR >10% + SEO >80, B+ = >8% or >70, C = below)
- Quick actions: Start A/B, Share on Social, Fix SEO

**Filters:** Channel, Sort (Latest/Most Views/Worst SEO).

### 8.3 A/B Lab

**Active test detail:**
- Variants side by side: thumbnail preview, CTR, impressions, clicks, avg watch time
- Confidence progress bar (target: 95%)
- Controls: Stop Test, Apply Winner Now

**Completed tests:** Collapsed rows — winner CTR, loser CTR, improvement %, auto-applied badge.

**New test flow:** Select video → upload 2–3 thumbnail variants → set rotation period → start. Title variants optional.

---

## 9. Cross-cutting Components

### 9.1 Notification Center

Bell icon in CMS header with unread badge count. Dropdown panel with notification types:

| Type | Color | Action |
|------|-------|--------|
| Delivery failure | Red | Reconnect → |
| Token expiring | Yellow | Refresh token → |
| AI drafts ready | Purple | Review drafts → |
| A/B test complete | Green | Auto-applied ✓ or View results → |
| Published success | Dimmed | View → |

"Mark all read" link. Click navigates to relevant screen.

### 9.2 Pipeline "Share on Social"

Button on Blog, Video, Newsletter pipeline items. Dropdown:

1. **Open in Composer** — pre-fills from pipeline item using matching template
2. **Quick Share to All** — auto-schedules at next Smart Schedule slot
3. **AI Generate Drafts** — Cowork creates per-platform optimized drafts

### 9.3 SEO Score Breakdown

Expandable panel in Video Mode Composer. Checklist with point values:
- Title length (30–60 chars optimal): +15
- Description has timestamps: +15
- Keywords in title match tags: +15
- Description length (200+ chars): +10
- Power words in title: -7 if missing
- Sufficient links in description: -5 if missing
- Tag count (8–15 recommended): -10 if too few

"AI Fix All Suggestions" button applies all recommendations.

---

## 10. System Architecture

### 10.1 Post Lifecycle (State Machine)

```
draft → scheduled → publishing → completed
                              → partial_failure
                              → failed
                              → cancelled (from draft or scheduled)
```

### 10.2 Delivery Lifecycle (Per Platform)

```
pending → publishing → published
                    → failed → retrying → published
                                       → skipped
```

Error classification drives retry behavior:
- `auth`: attempt token refresh, skip if refresh fails
- `transient` (429, 5xx, network): exponential backoff (5s, 30s, 2min), max 3 attempts
- `permanent` (4xx, validation): fail immediately

### 10.3 A/B Test Lifecycle

```
setup → variant_a_active → variant_b_active → [...variant_n] → analyzing → completed
```

Cron rotates thumbnails/titles every N hours. YouTube Analytics API collects impressions + CTR per period. Winner declared at 95% statistical confidence. Auto-apply optional.

### 10.4 Integration Map

| System | Integration Points |
|--------|-------------------|
| Links Engine | Auto short link per URL in Composer, UTM auto-tag, click tracking attributed to `social_post`, campaign links in videos |
| Media Gallery | `MediaGalleryDialog` in Composer, thumbnail upload, A/B variants stored as media, EXIF strip (LGPD), SHA-256 dedup |
| Pipeline | "Share on Social" button in Blog/Video/Newsletter, pre-fill Composer, Cowork → social drafts via automation |
| Newsletter | Post-send webhook trigger, auto-draft social post, highlights extraction, subscription CTA link |
| Playlists | Reference playlists in social posts, "Playlist updated" automation, performance tracking cross-ref |
| Instagram Settings | Shared token for feed display + posting, feed display settings remain in Settings |

---

## 11. RBAC Permissions

| Action | super_admin | org_admin | editor | reporter |
|--------|:-----------:|:---------:|:------:|:--------:|
| View posts/calendar | ✅ | ✅ | ✅ | ✅ |
| Create draft | ✅ | ✅ | ✅ | own only |
| Schedule/publish | ✅ | ✅ | ✅ | ❌ |
| Manage accounts | ✅ | ✅ | ❌ | ❌ |
| Configure automations | ✅ | ✅ | ❌ | ❌ |
| Run A/B tests | ✅ | ✅ | ✅ | ❌ |
| View insights | ✅ | ✅ | ✅ | ✅ |
| Delete posts | ✅ | ✅ | own only | ❌ |

RLS enforced via existing `can_view_site()` / `can_edit_site()` helpers. Connections require `can_edit_site` for all operations (tokens are sensitive).

---

## 12. Edge Cases & Empty States

### 12.1 Edge Cases

| Scenario | Behavior |
|----------|----------|
| Zero accounts connected | Posts/Composer show CTA: "Connect your first account." Insights shows onboarding checklist. |
| Token expired mid-publish | Delivery → failed (auth). Other platforms continue. UI shows inline "Reconnect." Post → partial_failure. |
| YouTube quota exhausted | Composer shows warning before scheduling. Delivery → failed (transient). Auto-retry next day on quota reset. |
| IG selected but no image | Inline warning. Does not block other platforms — IG delivery marked "skipped (no image)." |
| Bluesky 300-char exceeded | Preview shows real-time truncation. Counter turns red. Option to use `content_override` for BS-specific text. |
| Duplicate post prevention | Idempotency key in DB schema. Cron deduplication. UI warns if content identical to recent post. |

### 12.2 Empty States

| Screen | Message | CTA |
|--------|---------|-----|
| Posts | "No social posts yet" | Connect Accounts / Create First Post |
| A/B Lab | "No A/B tests yet" | Create First Test |
| Insights | "Insights need data" | Go to Composer |
| Drafts | "No AI drafts pending" | Configure Automations |

---

## 13. Migration from Current State

### 13.1 Navigation Changes

- **`cms-sections.ts`:** Remove YouTube from CONTENT items. Replace SOCIAL items (Calendar, New Post) with 5 new items.
- YouTube routes unchanged (`/cms/youtube/*`) — just sidebar section change.

### 13.2 Placeholder Pages to Replace

| Current Page | Becomes |
|-------------|---------|
| `/cms/social/page.tsx` (Calendar placeholder) | Posts page (Feed/Calendar/Queue/Drafts) |
| `/cms/social/new/page.tsx` (New Post placeholder) | Composer page (Text/Image/Video modes) |
| `/cms/social/[id]/page.tsx` (Status placeholder) | Post Detail page |
| `/cms/settings/social/page.tsx` (Connections placeholder) | Accounts page (or redirect to `/cms/social/accounts`) |

### 13.3 New Pages to Create

- `/cms/social/insights/page.tsx` — Insights (Overview, Best Of, Platform Health)
- `/cms/social/accounts/page.tsx` — Accounts (Connections, Automations)

### 13.4 YouTube Enhancements

Existing tabs preserved. New additions:
- **A/B Lab tab** (new)
- **Videos tab** enhanced with CTR, SEO score, performance grade badges
- **Dashboard** enhanced with avg CTR, Smart Schedule suggestion

---

## 14. Data Model Reference

4 tables already created in `20260513100000_social_hub.sql`:

- **`social_connections`** — OAuth tokens (AES-256-GCM encrypted), provider metadata. Unique per (site, provider, account). RLS: `can_edit_site`.
- **`social_posts`** — Post content (JSONB), status state machine, scheduling, idempotency key. RLS: `can_view_site` read, `can_edit_site` write.
- **`social_deliveries`** — Per-platform delivery tracking, retry config, platform post IDs. RLS: read-only via post join. Supabase Realtime enabled.
- **`youtube_quota_usage`** — Daily quota tracking, composite PK (site, date). RLS: read-only.

Key indexes: partial index on `scheduled_at` for cron, partial index on delivery status for retry, composite index on `(site_id, status)` for listing.

---

## 15. Backend API Reference

### Server Actions (`lib/social/actions.ts`)

| Action | Purpose |
|--------|---------|
| `connectSocial(provider, tokens)` | Store encrypted OAuth connection |
| `disconnectSocial(connectionId)` | Soft-revoke connection |
| `getConnections(siteId)` | List active connections (tokens stripped) |
| `createSocialPost(data)` | Create draft or scheduled post + deliveries |
| `updateSocialPost(postId, data)` | Update draft/scheduled post |
| `cancelSocialPost(postId)` | Cancel + skip all pending deliveries |
| `deleteSocialPost(postId)` | Hard-delete + attempt platform deletion |
| `retrySocialDelivery(deliveryId)` | Reset failed delivery to pending |
| `getSocialPost(postId)` | Fetch post + deliveries |
| `listSocialPosts(siteId, filters)` | List with status/date filters |

### API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/social/oauth/[provider]` | Initiate OAuth with HMAC-signed state |
| `GET /api/social/oauth/[provider]/callback` | Exchange code, store tokens, postMessage to parent |
| `POST /api/social/youtube/upload-session` | Start resumable YouTube upload |
| `POST /api/social/youtube/complete` | Finalize upload, link to post |
| `POST /api/cron/social-publish` | Every-minute cron: publish scheduled posts |

### Realtime Hooks

| Hook | Purpose |
|------|---------|
| `useSocialDeliveries(postId)` | Subscribe to delivery status changes |
| `useSocialPostStatus(postId)` | Subscribe to post status changes |

---

## 16. Wireframe Index

All wireframes in `.superpowers/brainstorm/23194-1778675695/content/`:

| File | Screens |
|------|---------|
| `wireframes-all.html` | Composer Text/Link, Posts (Feed/Calendar/Drafts), Post Detail, Insights, Accounts, YouTube Dashboard, A/B Lab, Empty States |
| `wireframes-supplementary.html` | Video Mode, Queue Tab, Templates, Bilingual, Notifications, Platform Health, Content Types, SEO Breakdown, Pipeline Share |
| `wireframes-final-fixes.html` | Image Mode, Engagement Chart, Automation Config, Bulk Actions, YouTube Videos Tab |
| `system-architecture.html` | Navigation, Automations, Integrations, State Machines, RBAC, Edge Cases |
