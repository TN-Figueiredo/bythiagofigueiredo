# Social Accounts Page Redesign — Design Spec

> Visual companion mockups: `.superpowers/brainstorm/50751-1778715868/content/`

**Goal:** Redesign both tabs (Connections + Automations) of `/cms/social/accounts` from ~30/100 to 98/100 quality.

**Architecture:** Enrich OAuth callbacks to fetch richer metadata, then build rich dashboard cards for connections and categorized automation rules with inline config panels.

---

## Part A: Connections Tab Redesign

### A1. Backend — OAuth Data Enrichment

**YouTube (callback/route.ts):**
- Already fetches: `channel_id`, `channel_title`, `custom_url`, `thumbnail_url`, `subscriber_count`
- Add: `video_count`, `view_count` from `statistics` part (already requesting `part=snippet,statistics`)
- Store in metadata: `video_count`, `view_count`

**Facebook (callback/route.ts):**
- Currently fetches: `page_id`, `page_name`
- Add to `fetchMetaPages()`: request `fields=id,name,access_token,picture{url},fan_count,followers_count` 
- Store in metadata: `picture_url`, `fan_count`, `follower_count`

**Instagram (callback/route.ts):**
- Currently fetches: `ig_user_id`, `ig_username`
- After getting IG account, fetch: `GET /{ig_user_id}?fields=profile_picture_url,followers_count,media_count`
- Store in metadata: `profile_picture_url`, `followers_count`, `media_count`

### A2. Summary Bar

Top of Connections tab. Shows: total accounts, active count (green), expiring count (amber), expired count (red), platform count.

### A3. Rich Account Dashboard Card

Each connected account gets a full card with:

**Header row:**
- Avatar (real photo from `thumbnail_url`/`picture_url`/`profile_picture_url`, initials fallback with platform gradient)
- Status indicator dot on avatar (green checkmark = active, red ! = expired)
- Account name (bold)
- Handle as clickable link with ↗ (opens profile in new tab)
- Status badge pill: "● Active" (green), "● Expiring" (amber), "● Expired" (red)
- "Last published: X days ago" + "Connected {date}" subtitle

**Stats grid (3 columns, platform-specific):**
- YouTube: Subscribers / Videos / Total Views
- Facebook: Page Likes / Followers / Posts
- Instagram: Followers / Posts / Eng. Rate

**Token health bar:**
- Green (>30d), amber (7-30d with ⚠), red (expired with 0% bar)

**Expired state:**
- Red border on card + red border on avatar
- Warning banner with ⚠️ icon, "Token expired {date}" message, "Reconnect" button
- Stats grid dimmed (opacity: 0.5)

**Manage mode (toggled by "Manage" button):**
- Expanded details: Account ID, Connected date+time, Token expiry with days remaining, Scope tags
- Action buttons: "↻ Refresh Token" (purple), "Disconnect" (red)
- "+ Add another {platform}" dashed button at bottom

### A4. Meta Linked Card

Facebook and Instagram share a Meta OAuth connection. Group them:
- Platform header shows both FB + IG icons with "Meta" label and "Linked accounts" badge
- Gradient accent bar: blue (left half) → pink/purple (right half)
- Info notice: "🔗 Facebook Page and Instagram share the same Meta connection"
- Facebook sub-card: blue left border, "PAGE" badge
- Instagram sub-card: pink left border, "BUSINESS" badge  
- Shared token bar at bottom (single bar for both)

### A5. Platform Card Structure

Per platform (YouTube, Meta, Bluesky):
- Colored accent bar at top (red=YouTube, blue→pink gradient=Meta, blue=Bluesky)
- Platform icon + name + account count badge
- "+ Add {type}" and "Manage" buttons in header
- Stacked account cards inside
- Hover: translateY(-1px) + subtle shadow

### A6. Bluesky Empty State

- Dashed circle with dimmed Bluesky icon
- "Connect your Bluesky account" title
- "Cross-post to the decentralized social web" subtitle
- Branded blue "+ Connect Bluesky" button

### A7. Skeleton Loading

Card skeleton with shimmer animation matching the rich card layout (avatar circle, name bar, handle bar, 3 stat rectangles, token bar).

---

## Part B: Automations Tab Redesign

### B1. Automation Categories

Group the 8 rules into 3 categories:

**Content Triggers** (📝):
- 📰 Blog Published → Social Draft (draft)
- 🎬 Video Published → Cross-post + First Comment (auto)
- ✉️ Newsletter Sent → Social Draft (draft)
- 🎵 Playlist Updated → Social Draft (draft)

**System Alerts** (🛡️):
- 🔑 Token Expiring (<7d) → Alert + Pause (alert)
- 🔄 Post Failed → Auto-retry (3×) (auto)

**Optimization** (⚡):
- ♻️ Evergreen Timer → Re-share from Queue (auto)
- 🏆 A/B Test Complete → Auto-apply Winner (auto)

### B2. Summary Bar

Top of Automations tab. Shows: total rules, active count, runs in 30d, success rate %.

### B3. Automation Row Card

Each rule is a card with:
- Toggle switch (green=on, gray=off)
- Icon (per rule, in colored background square)
- Title + mode badge (DRAFT purple, AUTO green, ALERT amber)
- Description (one-line explanation)
- Activity: "X runs / Last: Y ago" (right side)
- "Configure ▾" button
- Disabled rows: opacity 0.55, muted colors, muted badge
- Hover: translateY(-1px)

### B4. Category Headers

Each category has:
- Icon + category name (bold)
- Count badge ("4 rules" or "2 active" if any active)
- Horizontal rule extending to edge

### B5. Inline Configure Panel

Replaces the modal. Expands below the row card when "Configure" is clicked:
- Purple border on parent card when open
- "Close ▴" button replaces "Configure ▾"

**Left column:**
- Action Mode: Draft / Auto-publish toggle buttons
- Target Platforms: Clickable platform buttons with icons (✓ when selected)
- Scheduling: Smart Schedule / Fixed Delay / Immediate
- AI Enhance: Toggle with "AI" badge

**Right column:**
- Content Template: Monospace editor with variable highlighting ({title}, {excerpt}, {short_link}, etc.)
- Available variables listed below
- Recent Activity: 3 most recent runs with status dots (green=success, red=fail) and timestamps

**Footer:**
- "Delete Rule" (red, left)
- "Cancel" + "Save Changes" (right)

### B6. Recommended Badge

Disabled automations with high adoption show: "⭐ RECOMMENDED" badge and "Enable" green button (instead of "Configure").

### B7. Skeleton Loading

Row skeleton matching automation card layout (toggle, icon square, name bar, description bar, activity placeholder, button).

---

## Implementation Notes

- All components use existing CMS design tokens: `cms-surface`, `cms-bg`, `cms-border`, `cms-text`, `cms-text-muted`, `cms-accent`
- Platform colors: YouTube #ff0000, Facebook #1877f2, Instagram gradient #f09433→#dc2743→#bc1888, Bluesky #0085ff
- Hover effects: `translateY(-1px)` + `shadow-lg` (subtle, matching GemCard pattern)
- Existing i18n structure in `_i18n/types.ts` already has most keys; add descriptions and new keys
- State is currently local (useState) for automations — no DB persistence yet (future work)
- "Last published" requires querying `social_deliveries` table — show "—" if no data
- Sparklines are stretch goal — show "X runs" text as fallback
