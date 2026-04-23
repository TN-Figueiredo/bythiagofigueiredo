# OneCMS Redesign — Design Specification

**Date:** 2026-04-22
**Scope:** Default CMS consumed by all `@tn-figueiredo/*` ecosystem clients
**Rating:** 98/100 (iterative improvement across 9 screens + spec document)
**Mockups:** `.superpowers/brainstorm/52761-1776906453/content/01–09*.html`

---

## 1. Executive Summary

Complete redesign of the CMS sidebar, dashboard, and all 9 core screens. The current CMS scored 30/100 — disorganized sidebar, broken items, weak design, no analytics, no schedule view, no settings. This spec defines the **default OneCMS** that ships with the `@tn-figueiredo/admin` package's `createAdminLayout()` factory — not a bythiagofigueiredo-specific customization.

**Key decisions:**
- 9 sidebar items grouped into 4 semantic sections (Content, People, Insights, Settings)
- 3 responsive breakpoints: desktop (>=1280px), tablet (768–1279px), mobile (<768px)
- Light + dark theme via CSS custom properties (`[data-theme]` + `localStorage`)
- Consistent color coding: post=indigo, newsletter=green, campaign=amber
- Every screen includes: desktop, tablet, mobile, skeleton, empty state, light theme, behavior spec
- No chart library — inline SVG sparklines, CSS conic-gradient donuts, SVG area charts
- RBAC-aware: reporter sees restricted views; export/admin actions gated by role

---

## 2. Information Architecture

### Sidebar Items (9)

| Section | Item | Badge | Role Access |
|---------|------|-------|-------------|
| **Overview** | Dashboard | — | all |
| | Schedule | — | all |
| **Content** | Posts | draft count (amber) | all |
| | Newsletters | ready/queued count (blue) | editor+ |
| | Campaigns | — | editor+ |
| **People** | Authors | — | editor+ |
| | Subscribers | total count (green) | editor+ |
| **Insights** | Analytics | — | editor+ |
| *(divider)* | Settings | — | admin+ |

**Reporter role** sees only: Dashboard, Posts (own only), Schedule. All other items hidden.

### Section Grouping

Labeled section headers (10px uppercase, letter-spacing 1.5px, dim color). Settings separated by a divider line, visually de-emphasized. Header area contains site brand + `+New` quick-create button.

---

## 3. Design System

### 3.1 Theme Tokens

| Token | Dark | Light |
|-------|------|-------|
| `--bg` | `#0f1117` | `#f8f9fb` |
| `--surface` | `#1a1d27` | `#ffffff` |
| `--surface-hover` | `#1f2330` | `#f3f4f6` |
| `--border` | `#2a2d3a` | `#e5e7eb` |
| `--border-subtle` | `#22252f` | `#f0f0f3` |
| `--text` | `#e4e4e7` | `#1f2937` |
| `--text-muted` | `#71717a` | `#6b7280` |
| `--text-dim` | `#52525b` | `#9ca3af` |
| `--accent` | `#6366f1` | `#6366f1` |
| `--accent-hover` | `#818cf8` | `#4f46e5` |
| `--accent-subtle` | `rgba(99,102,241,.12)` | `rgba(99,102,241,.08)` |

Semantic colors (identical across themes):

| Token | Value | Subtle (dark) | Subtle (light) |
|-------|-------|---------------|-----------------|
| `--green` | `#22c55e` | `rgba(34,197,94,.12)` | `rgba(34,197,94,.08)` |
| `--amber` | `#f59e0b` | `rgba(245,158,11,.12)` | `rgba(245,158,11,.08)` |
| `--red` | `#ef4444` | `rgba(239,68,68,.12)` | `rgba(239,68,68,.08)` |
| `--cyan` | `#06b6d4` | `rgba(6,182,212,.12)` | `rgba(6,182,212,.08)` |
| `--rose` | `#f43f5e` | — | — |
| `--purple` | `#8b5cf6` | `rgba(139,92,246,.12)` | `rgba(139,92,246,.08)` |

Layout tokens: `--radius: 8px`, `--sidebar-w: 230px`.

Theme stored in `localStorage`, toggled via header button, applied via `[data-theme="dark"]` / `[data-theme="light"]` on `<html>`.

### 3.2 Color Coding

| Content Type | Color | Hex | Used In |
|-------------|-------|-----|---------|
| Post | Indigo | `#6366f1` | Borders, badges, dots, calendar items |
| Newsletter | Green | `#22c55e` | Borders, badges, dots, calendar items |
| Campaign | Amber | `#f59e0b` | Borders, badges, dots, calendar items |

Status badges: Draft (amber), Review (yellow), Ready (blue), Queued (violet), Published/Live (green), Archived (muted gray), Scheduled (cyan), Sent (green), Failed (red), Pending (amber), Bounced (red), Complained (rose).

### 3.3 Typography

| Element | Size | Weight |
|---------|------|--------|
| Page heading | 18px | 600 |
| Section label | 10–11px | uppercase, 1.5px letter-spacing |
| Nav item | 13px | 400 |
| KPI value | 18–24px | 600 |
| KPI label | 11px | 400 |
| Table cell | 12–13px | 400 |
| Badge/chip | 10–11px | 500 |

Font: `Inter, -apple-system, system-ui, sans-serif`. Monospace for emails, slugs, code.

### 3.4 Common Components

**KPI Card:** Surface background, border, 8px radius. Label (dim) + value (large, color-coded) + trend arrow + 48×28px SVG sparkline (polyline + endpoint circle). Trend green for improvements (including downward bounce rate).

**Status Badge:** Pill shape, colored background at subtle opacity + matching text. Uppercase 10–11px.

**Button variants:** `btn-primary` (accent bg, white text), `btn-ghost` (transparent bg, border, muted text), `btn-sm` (5px 10px padding, 12px font).

**Context Menu:** Surface bg, border, 10px radius, 4px padding, 8px 24px shadow. Items with icon + label, 8px 12px padding, 6px radius on hover. Danger items in red. Dividers as 1px border lines.

**Dialog/Modal:** Surface bg, 12px radius, 16px 48px shadow. Header + body + footer sections separated by borders.

**Skeleton:** `linear-gradient(90deg, surface 25%, surface-hover 50%, surface 75%)`, `background-size: 200%`, 1.5s infinite animation sliding left-to-right.

**Empty State:** Centered layout with large faded icon (40% opacity), heading, description text (max-width ~420px), primary CTA button + optional secondary, and 3-column hint cards with dashed borders.

### 3.5 Responsive Breakpoints

| Breakpoint | Sidebar | Layout | Navigation |
|-----------|---------|--------|------------|
| >=1280px (desktop) | 230px expanded | Full tables + right panels | Sidebar |
| 768–1279px (tablet) | 48px collapsed icon-only | Condensed tables, panels as drawers | Sidebar icons |
| <768px (mobile) | Hidden | Card layouts, agenda views | Bottom nav (5 tabs) |

**Bottom nav tabs (mobile, canonical 5-tab set):** Home (Dashboard), Schedule, Posts, Analytics, More. "More" opens a full-screen menu with all remaining items (Newsletters, Campaigns, Authors, Subscribers, Settings). Active tab highlighted in accent color.

### 3.6 Accessibility

- **Color contrast:** All text meets WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text/UI). Status badges use background+text pairings tested in both themes.
- **Focus indicators:** Visible focus ring (`2px solid var(--accent)`, `2px offset`) on all interactive elements. Never remove `outline` without replacement.
- **Keyboard navigation:** All screens fully keyboard-navigable. Tab order follows visual order. Modals/dialogs trap focus. Esc closes any overlay.
- **ARIA:** Tables use `role="grid"` with `aria-sort` on sortable headers. Context menus use `role="menu"` + `role="menuitem"`. Dialogs use `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. Status badges include `aria-label` (not just color). Loading skeletons use `aria-busy="true"`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables skeleton shimmer, chart animations, hover transforms. Transitions fall back to instant.
- **Screen readers:** KPI trends include `aria-label="Open rate 38.4%, up 2.1% from prior period"`. Engagement dots include `aria-label="Last 5 sends: opened, opened, clicked, no interaction, bounced"`. Empty states announce via `aria-live="polite"`.

### 3.7 Transitions & Animation

| Element | Timing | Easing |
|---------|--------|--------|
| Button hover/active | 150ms | ease |
| Sidebar item hover | 150ms | ease |
| Context menu open | 100ms | ease-out |
| Dialog open (scale+fade) | 200ms | ease-out |
| Dialog close | 150ms | ease-in |
| Slide-over panel | 250ms | ease-out |
| Bottom sheet | 300ms | cubic-bezier(.32,.72,0,1) |
| Toast appear (slide-up) | 200ms | ease-out |
| Toast dismiss (fade-out) | 150ms | ease-in |
| Skeleton shimmer | 1.5s | linear, infinite |
| Chart tooltip fade | 150ms | ease-out |
| Calendar item hover | 150ms | ease |
| Page transition | none (instant, server components) |

### 3.8 Toast Notifications

Toasts appear bottom-center (mobile) or bottom-right (desktop), stacked with 8px gap. Max 3 visible. Auto-dismiss after 5s (success/info) or persist until dismissed (error/warning).

Variants: success (green left border), error (red left border), warning (amber left border), info (accent left border). Each has icon + message + optional action link + dismiss ✕.

### 3.9 Date Formatting

| Condition | Format | Example |
|-----------|--------|---------|
| < 1 minute | "Just now" | Just now |
| < 1 hour | "Xm ago" | 23m ago |
| < 24 hours | "Xh ago" | 5h ago |
| < 7 days | "Xd ago" | 3d ago |
| Same year | "MMM DD" | Apr 18 |
| Different year | "MMM DD, YYYY" | Dec 15, 2025 |
| Exact (tooltips) | "MMM DD, YYYY HH:mm" | Apr 18, 2026 14:30 |

### 3.10 Pagination

Default page sizes: 20 (Newsletters, Posts, Campaigns), 50 (Subscribers). Mobile uses infinite scroll with intersection observer (Subscribers, Newsletters editions). Format: "Showing X–Y of Z" + Prev/numbered pages/Next. URL state: `?page=N`. Authors: no pagination (full grid, max ~30 per site).

### 3.11 Global Search (Cmd+K)

Modal overlay (max-width 560px, centered). Input with search icon + placeholder "Search posts, newsletters, campaigns...". Results grouped by type with colored section headers (Posts, Newsletters, Campaigns, Authors). Each result: type icon + title + status badge + date. Max 5 per group. Keyboard: arrow keys navigate, Enter opens, Esc closes. Recent searches persisted in `localStorage` (max 5). Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Win), or `/` when no input focused.

---

## 4. Screen Specifications

### 4.1 Dashboard (`/cms`)

**Purpose:** Entry point. At-a-glance health of content, performance, and pending actions.

**Desktop layout:**
- **Continue Editing banner:** Persistent strip showing last-edited post thumbnail + title + timestamp + "Resume" button. Driven by `localStorage` key `cms:lastEdited:{siteId}` set on every editor save. Hidden when no recent edit or when post has been published since last edit.
- **4-column KPI grid:** Blog Posts (total published, trend vs prior 30d), Newsletter Opens (total 30d), Campaign Submissions (total 30d), Subscribers (total active). Each with trend delta + sparkline.
- **Content Performance chart:** Grouped bar chart (weekly), 3 series (post=indigo, NL=green, campaign=amber). Hover tooltip with fade-in 150ms.
- **Coming Up panel:** Right column (3:5 ratio), next 3 items from Schedule (queued posts + scheduled editions). Query: `WHERE slot_date >= CURRENT_DATE ORDER BY slot_date ASC LIMIT 3`. Each with type icon, title, colored left-border, and date.

**Site Switcher:** Dropdown from sidebar brand area. Filter input + scrollable site list (colored initials avatar, name, URL). Current site checkmarked. "Manage sites →" footer link (admin+ only).

**Notification Center:** Bell icon dropdown with unread count badge. Grouped: New (unread) + Earlier (read, 60% opacity). Alert types: red (critical — bounce rate, failed send), amber (warning — overdue slot, draft approaching deadline), blue (info — new subscriber milestone), green (success — edition sent, post published). "View all" → `/cms/notifications` sub-page. Max-width 700px centered, filter tabs (All/Alerts/Info), "Mark all read" link. Notifications stored in `notifications` table (Sprint 7+; initially derived from computed conditions).

**Skeleton:** 4 KPI cards with shimmer (staggered delay 0–0.3s), "Continue Editing" banner block, chart area (full-width 180px height shimmer), "Coming Up" panel (3 row blocks with left-border accents).

**Empty state (first-time):** No KPIs, no chart. Centered welcome: "Welcome to OneCMS" heading, "Start by creating your first post or configuring your publishing cadence" description, two CTAs ("Create First Post" + "Configure Cadence"), 3 hint cards (Write / Schedule / Analyze).

**Tablet:** KPIs in 2×2 grid, chart simplified, Coming Up below chart.
**Mobile:** KPIs as scrollable chips, chart as compact summary, Coming Up as card list.

---

### 4.2 Posts List (`/cms/blog`)

**Purpose:** Browse, filter, search, and bulk-manage all posts.

**Desktop layout:**
- **Status filter tabs:** All / Draft / Review / Ready / Queued / Published / Archived — each with count badge, color-coded
- **Locale filter:** Toggle group (All / pt-BR / en)
- **Author filter:** Dropdown
- **Search:** Inline with `/` keyboard shortcut hint
- **Table (9 columns):** Checkbox, thumbnail (32×22px), title+slug+read-time, status badge, locale badges, author avatar+name, updated timestamp, view count, actions (Edit/Preview/⋯)
- **Locale badges:** Solid for existing translations; dashed for missing (clickable to add)
- **Queued rows:** Calendar icon + scheduled date chip
- **Pagination:** "Showing X–Y of Z" + Prev/numbered/Next

**Bulk actions:** Sticky bar on selection. "Select all N matching" for server-side IDs. Actions: Change status, Reassign author, Add to queue, Archive, Delete (confirmation dialog).

**Keyboard shortcuts:** j/k navigate, Enter open, Space toggle checkbox, p preview, n new, / search, Cmd+A select all, Esc clear.

**Tablet:** 6 columns (drops thumbnail, author, views). Author+views shown inline under title.
**Mobile:** Card layout with horizontal scrollable filter pills. Long-press for selection mode. >=44px touch targets.

**Empty state:** Faint pencil icon, "No posts yet", "Create first post" CTA.
**No results:** Magnifier icon, "No posts matching '[query]'" + "clear filters" link.

---

### 4.3 Post Editor (`/cms/blog/[id]/edit`)

**Purpose:** Full MDX authoring with live preview, media, metadata, versioning, publish workflow.

**Desktop layout:**
- Sidebar collapsed to 48px
- **Top bar:** Back link, status badge, locale switcher (solid existing + dashed "+ en"), auto-save indicator (green/amber/red dot), word count + read time, editor/split/preview toggle, version history, settings gear, Save + Publish buttons
- **Split view:** Editor (flex:1) + Preview (420px fixed)
- **Editor:** Large title input (24px), slug display, MDX toolbar (grouped: formatting, headings, lists, insert, embeds), MDX textarea
- **Preview:** Styled blog output, Georgia serif, real-time mirror

**MDX Toolbar groups:** Inline (B/I/S/Code), Headings (H2/H3/H4), Lists+Quote, Insert (link/image/code/HR), Table+Embed. Overflow via "⋯ More" dropdown.

**Asset Picker modal:** Two tabs — Upload (drag/drop, max 5MB, progress bar) + Media Library (4-column grid, selection ring). Alt text required. Storage: `content-assets/{siteId}/{postId}/`.

**Version History panel:** 320px right panel replacing preview. Version list: timestamp, change summary ("+3 paragraphs"), save type (Autosave/Manual), author avatar. "Restore selected" creates new version (non-destructive). Retention: autosaves grouped by hour after 24h, max 50.

**Unsaved Changes dialog:** Lists specific changes (title, paragraphs, images), 3 buttons: Discard/Cancel/Save & leave. Locale-switch variant: Cancel/Save & switch.

**Schedule Date Picker:** Month calendar. Today outlined, selected solid accent, queue slots purple-tinted (from `generateSlots()`). Time picker (HH:MM) + timezone (America/Sao_Paulo, stored UTC).

**Metadata panel (⚙):** 6 collapsible sections: Cover Image, SEO (title 60-char + description 160-char + SERP preview), Author, Tags (chips + autocomplete, max 10), SEO Extras (FAQ/HowTo/Video), Publishing.

**Publish dropdown (role-sensitive):**
- Editor: Publish now (pre-publish checklist), Schedule, Add to queue, Mark as ready
- Reporter: Save draft + "Submit for review" (`pending_review`)
- Published: "Save changes" + "Update" + "Unpublish"

**Autosave:** 2s debounce. States: green "Saved Xs ago" / amber "Saving..." / amber "Unsaved changes" / red "Save failed" (auto-retry 5s). `localStorage` crash recovery. `beforeunload` guard.

**Tablet:** Toolbar items collapse into "⋯ More" earlier. Version history as bottom sheet.
**Mobile:** Fullscreen single-pane with Editor|Preview segmented control. Toolbar as scrollable strip. Metadata as "Post Settings" overlay. Floating Save/Publish at bottom.

**Keyboard shortcuts:** Cmd+B/I/K/S, Cmd+E preview, Cmd+. metadata, Cmd+Shift+P publish, Cmd+Shift+H history, Cmd+Shift+I image, Cmd+Shift+T table, Cmd+Shift+C code block.

---

### 4.4 Newsletters (`/cms/newsletters`)

**Purpose:** Newsletter editions dashboard. Manage types, editions, delivery lifecycle.

**Desktop layout:**
- **Type cards (horizontal row):** Each with colored top-bar gradient, status badge (Active/Paused), 3-column KPIs (subscribers, avg open rate, last sent), footer (cadence + edition count). Paused types show amber badge with bounce-rate warning tooltip. "Add type" dashed card at end.
- **Filter bar:** Status segments (All/Drafts/Scheduled/Sent/Failed) + type dropdown + count
- **Editions table:** Checkbox, Subject+preheader, Type (colored dot+name), Status badge, Sent count, Open rate (green), Click rate (indigo), Date, Actions (⋯)
- **Sending row:** Purple tint, animated pulsing dot, inline progress bar, sent/total count
- **Failed row:** Red tint, error message inline, partial delivery count

**Context menus (status-specific):**
- Draft: Edit, Duplicate, Preview | Send now, Schedule | Delete
- Scheduled: Edit, Preview, Reschedule | Send now | Unschedule
- Sent: View archive, Analytics, Duplicate as draft, Resend

**Sending state:** Polls every 5s; `sending→sent` auto-refreshes; `sending→failed` shows toast.

**Tablet:** Type cards as compact horizontal scroll strip. Table drops Type and Clicks columns.
**Mobile:** Type cards as scrollable filter chips. Table → card stack. Swipe left reveals View+Delete.

**Skeleton:** Type card row (2 full-width blocks + 1 narrow), filter bar (280px + 100px blocks), table (1 header row 42px + 3 data rows 56px each).

**Empty state:** Envelope icon, "No editions yet", "Create first edition" CTA.

---

### 4.5 Campaigns (`/cms/campaigns`)

**Purpose:** Lead-capture landing page management. PDF gating or external link gating.

**Desktop layout:**
- **4 KPI tiles:** Active campaigns, Total submissions, PDF downloads/30d, Conversion rate
- **Inline sparklines:** 48×18px SVG per published campaign (7-day trend + endpoint dot + delta)
- **Table:** Checkbox, campaign name+slug+PDF filename (40×40px type icon), Type badge (PDF/Link), Locale badges, Status, Submissions+sparkline+delta, Conversion rate, Date, Actions
- **Archived rows:** 50% opacity
- **Draft rows:** Amber "No PDF uploaded" warning

**Context menus (status-specific):**
- Draft: Edit, Preview, Duplicate | Publish, Schedule | Delete
- Published: Edit, View live, Analytics, Duplicate | Export subs | Archive, Unpublish

**Publish pre-checklist:** PDF uploaded, SEO meta set, Turnstile enabled, translation warning (non-blocking).

**Export Submissions dialog:** Format toggle (XLS/CSV), date range, email privacy warning (editor gets masked emails; super_admin gets full data). Download with count.

**Tablet:** KPIs as 2×2 grid. Table drops Locales and Sparkline.
**Mobile:** KPIs as scrollable chips. Campaign cards with thumbnail, badge, stats.

**Skeleton:** 4 KPI tiles (68px height), filter bar (240px + 100px blocks), table (header row 42px + 3 data rows 64px each).

**Empty state:** Target icon, "No campaigns yet", "Create first campaign" CTA.

---

### 4.6 Authors (`/cms/authors`)

**Purpose:** Author directory as persona cards. Profile edit, activity status, role display.

**Desktop layout:**
- **Filter bar:** Search (client-side, instant) + role filter chips (All/Editors/Reporters/Admins) with counts
- **Card grid:** `auto-fill, minmax(340px, 1fr)` — 3 columns. Each card: 56px avatar (gradient-initialed or photo), name, slug (monospace), role badge (Super Admin=green, Admin=indigo, Editor=cyan, Reporter=amber), 2-line bio (clamped), 3-stat grid (Posts/Published/Campaigns), activity dot (green=online <5min, amber=<7d, gray=>7d) + last-seen label, ⋯ menu
- **Edit panel:** Slide-over 400px. Avatar with hover "Change" overlay, fields (Display Name, Slug, Bio markdown max 500, Social Links — Twitter/GitHub/LinkedIn/Website), Recent Content list. Cancel/Save.

**No "create author" button** — authors created via Admin invitation. "Go to Admin → Users" link shown to `can_admin_site_users()`.

**Avatar:** 1:1 crop before upload, max 2MB, `avatars/{author_id}.{ext}`. Gradient fallback from `hash(user_id) % 8 palette presets`.

**Tablet:** 2-column grid, 44px avatars, 1-line bio. Edit as full-width panel.
**Mobile:** Single-column cards. Edit as fullscreen overlay with back arrow.

**Empty state:** "You're the only author" + "Edit my profile" + "Go to Admin → Users".

---

### 4.7 Subscribers (`/cms/subscribers`)

**Purpose:** Full subscriber visibility, engagement history, lifecycle management. PII-heavy — gated by `is_org_admin` or `is_super_admin`.

**Desktop layout:**
- **4 KPI cards:** Total Active (confirmed only), New (30d), Churn Rate (amber >2%, red >5%), Avg Open Rate
- **Growth bar chart:** CSS flex bars (no library), 30 daily bars. Green=gain, red=loss. Period toggle: 7d/30d/90d/1y
- **Filter bar:** Search (debounced 300ms, server-side ILIKE), newsletter type dropdown, status chips (Confirmed/Pending/Bounced/Unsubscribed) with counts
- **Table:** Checkbox, Email (monospace), Newsletter type badge, Status badge, Engagement dots (5 dots: green=opened, cyan=clicked, gray=none, red=bounced, rose=complained), Consent icon, Subscribed date, Actions (⋯)
- **Anonymized rows:** `a4f8c2d1...@anon` in dim italic, all-gray dots + LGPD lock icon, actions disabled

**Context menus (status-specific):**
- Confirmed: View details, Engagement history, Resend welcome, Copy email, Unsubscribe (danger)
- Pending: View details, Resend confirmation, Copy email, Delete expired (danger)
- Bounced: View details, Bounce details, Retry (reset bounce), Remove (danger)
- Unsubscribed/anonymized: View details + Copy email disabled, "PII anonymized per LGPD" note

**Subscriber Detail panel:** Desktop=400px slide-over. Metadata grid (Subscribed, Confirmed, Locale, Tracking Consent, Welcome Email, Consent Version), engagement summary (personal open/click rate, total received), activity timeline (last 20 events from `newsletter_sends`+`newsletter_click_events`).

**Export dialog (RBAC-gated):**
- super_admin/org_admin: CSV Full/XLSX/CSV Emails Only. LGPD warning. Audit-logged.
- editor/reporter: Red blocked state — "requires org_admin or super_admin role."

**Tablet:** Growth chart hidden. KPIs as 2×2. Table drops Consent column.
**Mobile:** Stats as scrollable chips. Growth chart hidden. Cards replace table. Detail as fullscreen page.

---

### 4.8 Analytics (`/cms/analytics`)

**Purpose:** Cross-cutting performance metrics. 4 tabs — Overview, Newsletters, Campaigns, Content — each with independent period selector.

**Desktop layout — Overview tab:**
- **Period selector:** 7d/30d/90d/12m pill group. Active = accent-subtle. Date range label
- **5 KPI cards:** Emails Delivered, Open Rate (green), Click Rate (cyan), Campaign Leads, Bounce Rate (amber). Each with sparkline + trend
- **2-column chart grid:** Engagement Over Time SVG area chart (3 series: opens/clicks/bounces, "Today" marker) + Audience by Newsletter donut (CSS conic-gradient, 120×120px, center=total)
- **Email Delivery Funnel:** 5-step horizontal bars (Sent→Delivered→Opened→Clicked→Bounced), proportional widths, per-step colors
- **Side-by-side tables:** Top Posts by Engagement (rank 1–5, gold/silver/bronze badges, sparklines) + Top Campaigns by Submissions

**Newsletters tab:** 4 KPIs (Editions Sent, Delivered, Open Rate, Click Rate) + sparklines. Edition Performance table + Top Clicked Links (monospace cyan URLs).

**Campaigns tab:** 4 KPIs (Total Submissions, Download Rate, Avg per Campaign, Active). Ranked table with locale split (flag emojis + %).

**Content tab:** 4 KPIs (Published 30d, In Queue, Drafts, Avg Time to Publish). GitHub-style heatmap (12 weeks × 7 days, green opacity=count). Author leaderboard table.

**Data sources:** Newsletter stats from `newsletter_editions.stats_*` (refreshed via `refresh_newsletter_stats()` RPC). Campaign submissions from `campaign_submissions`. Top posts ranked by newsletter engagement (joins via slug). No site pageview tracking until Sprint 7+.

**Export Report:** org_admin+ only. Server-side PDF via `@react-pdf/renderer`.

**Empty states:** Full empty: KPIs show "—" at 50% opacity, chart area replaced by icon + heading + CTAs + 3 hint cards. Partial: progressive disclosure (1 edition → area chart; 2+ → sparklines; 4+ → funnel; 2+ types → donut).

**Tablet:** 3-column KPIs, compact funnel, top tables drop some columns.
**Mobile:** Tabs as scrollable pills. KPIs as 2×2 grid. No charts — funnel as compact horizontal bars. Top posts as stacked cards.

---

### 4.9 Schedule (`/cms/schedule`)

**Purpose:** Editorial calendar bridging the content backlog to the auto-publish pipeline.

**Desktop layout — Week view (default):**
- **Calendar nav:** ←/→ arrows, date range title, "Today" button, color legend (Post/Newsletter/Campaign/Empty slot)
- **Week grid:** CSS grid 8 columns (60px time label + 7 days). 3 slot rows (Slot 1/2/3). Each cell min-height 80px
- **Calendar items:** Color-coded with 3px left border + subtle background. Newsletter items show send time + type + subscriber count. Drafts at 60% opacity with "draft" badge. Hover: brightness(1.1) + 1px translateY
- **Empty slots:** Dashed border, dim text "+ Empty blog/newsletter slot". Hover → accent border + accent text
- **Overdue alert:** Red-subtle banner below calendar. Count + date + "Assign from backlog" link + "Dismiss" button
- **Right panel (300px):**
  - Backlog: "5 ready" + draggable items (type dot + title + status). Drag to calendar triggers Quick Schedule dialog
  - Publishing Cadence: 4 rows (Blog en Mon/Fri, Blog pt-BR Wed, Newsletter main Tue 08:00, Newsletter code Thu 08:00) + "Edit cadence" button
  - This Week: 5-row summary (Posts scheduled, Newsletters queued, Campaigns active, Empty slots, Overdue)

**Month view:**
- 7-column grid, cells min-height 110px. Items truncated. "+N more" link. Overdue slots in red dashed. Other-month cells at 35% opacity. Backlog bar below calendar with 3 inline items + "+N more" link.

**Context menus (3 variants):**
- Scheduled post: Edit / Reschedule / Move earlier / Move later / Preview / Copy link / Unschedule (danger)
- Newsletter: Edit edition / Reschedule send / Preview email / View analytics / Cancel send (danger)
- Empty slot: Assign from backlog (accent) / Create new post / Skip this slot

**Quick Schedule dialog (420px):** Selected item card + mini-calendar (past dates disabled, slot days marked with green dot indicator, today in accent) + slot availability confirmation + "Schedule for [date]" CTA.

**Content queue integration:**
- Slot generation: `generateSlots(config, opts)` from `@tn-figueiredo/newsletter`, extends 4 weeks forward
- Backlog: `status='ready'`, sorted oldest first
- Schedule flow: drag or dialog → `UPDATE SET slot_date=?, status='queued', queue_position=?`
- Auto-publish: cron checks `status='queued' AND slot_date=CURRENT_DATE` → transitions to `published`
- Unschedule: clears `slot_date`, returns to `ready`. Confirmation if within 24h

**Overdue handling:** Cadence slot with `slot_date < today` and no content. Dismiss = `slot_skipped=true`. Skipped slots hidden but counted in analytics (cadence compliance %). Draft on slot: 60% opacity, warning if not promoted to `ready` within 48h.

**Collision detection:** Warn when scheduling to a day with 2+ items (reader fatigue).

**Tablet:** 7-column grid (no time labels), truncated items. Overdue alert as compact single-line. Backlog as collapsible drawer below calendar.
**Mobile:** Agenda/list view (date-grouped chronological feed). Empty slots inline as dashed cards. Overdue alert as red card. Backlog as full-screen sub-page with "Schedule" button per item. No drag-and-drop — scheduling via button + dialog only.

**Empty state — No cadence:** Calendar hidden. Centered icon + "No publishing cadence configured" + "Configure Cadence" + "Create First Post" CTAs + 3 hint cards (Set Cadence / Fill Backlog / Auto-Publish).

### 4.10 Settings (`/cms/settings`) — Deferred

Settings is a sidebar item (admin+ only) but was not mockup-scoped in this design cycle. Expected sections based on existing functionality and ecosystem needs:

- **General:** Site name, logo, primary color, primary domain
- **Email:** Provider config (Resend API key, webhook secret, from domain), sender name/email, reply-to
- **Newsletter Cadence:** Per-type cadence days, preferred send time, pause toggle (mirrors right-panel "Edit cadence" in Schedule)
- **SEO:** Default OG image, identity type (person/org), Twitter handle, AI crawler blocking toggle
- **LGPD:** Feature flag toggles (cookie banner, account delete, export, cron sweep)
- **Integrations:** Turnstile site key, Sentry DSN

Settings screen design will be completed in the implementation phase, following the same mockup process (desktop/tablet/mobile/skeleton/empty/light/behavior spec).

### 4.11 Sub-Pages — Deferred but Referenced

These pages are referenced by context menus and actions in the core screens but are not individually mockup-scoped. They follow the existing patterns from Sprint 5e and this spec's design system.

| Route | Referenced By | Implementation Notes |
|-------|---------------|---------------------|
| `/cms/newsletters/new` | Newsletters "New edition" | Creates draft, redirects to editor. Existing server action. |
| `/cms/newsletters/[id]/edit` | Newsletters context menu "Edit edition" | MDX editor similar to Post Editor (4.3) but for newsletter content. Uses `@tn-figueiredo/newsletter-admin` components. Subject + preheader + MDX body + live email preview via `@react-email/render`. Already partially implemented in Sprint 5e. |
| `/cms/newsletters/[id]/analytics` | Newsletters context menu "View analytics" | Per-edition KPI cards (delivered/opens/clicks/bounces), top clicked links, email client breakdown. Already partially implemented in Sprint 5e via `@tn-figueiredo/newsletter-admin`. |
| `/cms/campaigns/new` | Campaigns "New campaign" | Creates draft, redirects to editor. Existing server action. |
| `/cms/campaigns/[id]/edit` | Campaigns context menu "Edit" | Landing page editor with PDF upload, Turnstile config, locale management. Already implemented in Sprint 3. Redesign follows this spec's design system (theme tokens, button variants, skeleton). |
| `/cms/newsletters/settings` | Schedule "Edit cadence" button | Per-type cadence config. Deferred to Settings (4.10) consolidation. |
| `/cms/notifications` | Dashboard bell "View all" | Full notification history page. Spec in Dashboard section (4.1). |
| `/newsletter/archive/[id]` | Newsletter context menu "View archive" | Public web archive. Already implemented in Sprint 5e. No CMS redesign needed. |

---

## 5. Permissions Matrix

| Action | Reporter | Editor | Org Admin | Super Admin |
|--------|----------|--------|-----------|-------------|
| View Dashboard | ✓ (own stats) | ✓ | ✓ | ✓ |
| View/Edit Posts | own only | all | all | all |
| Publish Posts | ✗ (submit for review) | ✓ | ✓ | ✓ |
| View Newsletters | ✗ | ✓ | ✓ | ✓ |
| Send Newsletters | ✗ | ✓ | ✓ | ✓ |
| View Campaigns | ✗ | ✓ | ✓ | ✓ |
| Export Submissions | ✗ | masked emails | full data | full data |
| View Authors | ✗ | ✓ | ✓ | ✓ |
| Edit Author Profile | own only | own only | any on org | any |
| View Subscribers | ✗ | ✗ | ✓ | ✓ |
| Export Subscribers | ✗ | ✗ | ✓ | ✓ |
| View Analytics | ✗ | ✓ (own in Content) | ✓ | ✓ |
| Export Report | ✗ | ✗ | ✓ | ✓ |
| View Schedule | ✓ (own + public) | ✓ | ✓ | ✓ |
| Schedule Posts | ✗ | own posts | any | any |
| Edit Cadence | ✗ | ✗ | ✓ | ✓ |
| Access Settings | ✗ | ✗ | ✓ | ✓ |
| Site Switcher | ✗ | own sites | org sites | all sites |

---

## 6. Technical Integration

### 6.1 Route Map

| Route | Screen | Sidebar Active | Section |
|-------|--------|----------------|---------|
| `/cms` | Dashboard | Dashboard | 4.1 |
| `/cms/notifications` | Notification Center | Dashboard | 4.1 |
| `/cms/blog` | Posts List | Posts | 4.2 |
| `/cms/blog/new` | Post Editor (new) | Posts | 4.3 |
| `/cms/blog/[id]/edit` | Post Editor | Posts | 4.3 |
| `/cms/newsletters` | Newsletters | Newsletters | 4.4 |
| `/cms/newsletters/new` | Newsletter Editor (new) | Newsletters | 4.11 |
| `/cms/newsletters/[id]/edit` | Newsletter Editor | Newsletters | 4.11 |
| `/cms/newsletters/[id]/analytics` | Newsletter Analytics | Newsletters | 4.11 |
| `/cms/campaigns` | Campaigns | Campaigns | 4.5 |
| `/cms/campaigns/new` | Campaign Editor (new) | Campaigns | 4.11 |
| `/cms/campaigns/[id]/edit` | Campaign Editor | Campaigns | 4.11 |
| `/cms/authors` | Authors | Authors | 4.6 |
| `/cms/subscribers` | Subscribers | Subscribers | 4.7 |
| `/cms/analytics` | Analytics | Analytics | 4.8 |
| `/cms/schedule` | Schedule | Schedule | 4.9 |
| `/cms/settings` | Settings | Settings | 4.10 |

All routes under `/cms/(authed)/` layout group, protected by `requireArea('cms')` from `@tn-figueiredo/auth-nextjs`.

### 6.2 Package Architecture

The OneCMS shell (`createAdminLayout()`) lives in `@tn-figueiredo/admin`. Screen implementations consume:

| Package | Screens |
|---------|---------|
| `@tn-figueiredo/admin` | Sidebar, Dashboard, Settings, Site Switcher |
| `@tn-figueiredo/cms` | Posts List, Post Editor (PostEditor, EditorToolbar, AssetPicker) |
| `@tn-figueiredo/newsletter-admin` | Newsletters, Content Queue |
| `@tn-figueiredo/newsletter` | `generateSlots()` for Schedule |
| `@tn-figueiredo/seo` | SEO metadata panel in Post Editor |
| `@tn-figueiredo/email` | Email preview in Newsletter editor |

### 6.3 Data Sources

| Screen | Primary Data |
|--------|-------------|
| Dashboard | `blog_posts`, `newsletter_editions.stats_*`, `campaign_submissions`, `blog_cadence` |
| Posts List | `blog_posts` + `blog_translations` + `authors` |
| Post Editor | `blog_translations` (MDX), `content-assets` storage bucket |
| Newsletters | `newsletter_types`, `newsletter_editions`, `newsletter_sends` |
| Campaigns | `campaigns`, `campaign_translations`, `campaign_submissions` |
| Authors | `authors`, `site_memberships`, Supabase Realtime (presence) |
| Subscribers | `newsletter_subscriptions`, `newsletter_sends`, `newsletter_click_events` |
| Analytics | Aggregates from `newsletter_editions.stats_*`, `campaign_submissions`, `blog_posts` |
| Schedule | `blog_cadence`, `newsletter_types.cadence_*`, `blog_posts.slot_date`, `newsletter_editions` |

### 6.4 Feature Flag Readiness

All sidebar items configurable per-site via feature flags in the `createAdminLayout()` factory. When a site doesn't use newsletters, the Newsletters + Content Queue items are hidden. When a site doesn't use campaigns, the Campaigns item is hidden. Analytics adapts tabs to available content types.

### 6.5 Charts — No Library

All visualizations are pure CSS/SVG:
- **Sparklines:** 48×28px SVG `<polyline>` + endpoint `<circle>`
- **Area charts:** Full SVG with `<path>` fill areas + `<line>` grid
- **Bar charts:** CSS flex bars or grouped `<rect>` in SVG
- **Donut charts:** CSS `conic-gradient` with center hole
- **Heatmap:** CSS grid with opacity-mapped background colors
- **Funnel:** Proportional-width `<div>` bars

---

## 7. Mockup Index

| # | Screen | File | Score |
|---|--------|------|-------|
| 1 | Dashboard | `01-dashboard-v4.html` | 98/100 |
| 2 | Posts List | `02-posts-list-v4.html` | 98/100 |
| 3 | Post Editor | `03-post-editor-v3.html` | 98/100 |
| 4 | Newsletters | `04-newsletters.html` | 98/100 |
| 5 | Campaigns | `05-campaigns-v2.html` | 98/100 |
| 6 | Authors | `06-authors.html` | 98/100 |
| 7 | Subscribers | `07-subscribers.html` | 98/100 |
| 8 | Analytics | `08-analytics.html` | 98/100 |
| 9 | Schedule | `09-schedule.html` | 98/100 |
| — | Sidebar IA | `sidebar-ia-final.html` | — |
| — | Sidebar Styles | `cms-sidebar-styles.html` | — |

All mockups include: desktop, tablet, mobile, skeleton loading, empty state, light theme variant, and behavior specification.
