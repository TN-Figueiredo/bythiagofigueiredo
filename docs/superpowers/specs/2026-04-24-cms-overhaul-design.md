# CMS Overhaul — Complete Design Spec

**Date:** 2026-04-24
**Status:** Approved (visual brainstorm validated at 98/100 per screen)
**Scope:** Full redesign of all 10 CMS admin screens for bythiagofigueiredo

## 1. Overview

Redesign every screen in the CMS admin interface (`/cms/*`) with a cohesive dark theme, consistent interaction patterns, full RBAC enforcement, LGPD compliance, mobile responsiveness, and keyboard accessibility. Each screen was designed via visual brainstorm with iterative self-review targeting 98+/100.

### Goals

- Unified visual language across all CMS screens (dark theme, consistent spacing, typography)
- Full RBAC v3 enforcement (super_admin/org_admin/editor/reporter) per screen
- LGPD compliance for subscriber/contact data (anonymization, consent tracking)
- Mobile-first responsive design (< 768px breakpoint)
- Keyboard shortcuts on every screen
- Extraction-ready for `@tn-figueiredo/cms-admin` package

### Tech Stack

- Next.js 15 + React 19 server/client components
- `@tn-figueiredo/cms-admin` for reusable CMS UI components
- `@tn-figueiredo/cms` for data/content operations
- Tailwind 4 dark theme tokens
- URL-persisted state via `searchParams`

---

## 2. Shared Patterns

### 2.1 Visual Theme

- Background: `#0f172a` (slate-900) with `rgba(15,23,42,0.97)` surfaces
- Text: `#e2e8f0` (primary), `#94a3b8` (secondary), `#64748b` (muted)
- Accent: `#6366f1` (indigo-500)
- Borders: `rgba(148,163,184,0.1)`
- Status colors: green (#22c55e) success, amber (#f59e0b) warning, red (#ef4444) destructive, gray (#64748b) inactive

### 2.2 RBAC Matrix

| Role | Dashboard | Posts | Newsletters | Campaigns | Authors | Subscribers | Schedule | Analytics | Settings | Contacts |
|------|:---------:|:-----:|:-----------:|:---------:|:-------:|:-----------:|:--------:|:---------:|:--------:|:--------:|
| super_admin | Full | Full | Full | Full | Full | Full | Full | Full | Full + Danger Zone | Full + Anonymize |
| org_admin | Full | Full | Full | Full | Full | Full | Full | Full | Full (no Danger) | Full + Anonymize |
| editor | Full | Full | Full | Full | Full | Read-only | Schedule/Unslot | Full | Read-only | Reply + Export |
| reporter | Read | Own only | Read | Own only | Read | Redirect | View only | Own metrics | Redirect | Read only |

### 2.3 Loading Skeletons

Every screen uses pulse-animated skeleton shimmer (`opacity 0.4→0.8, 1.5s ease-in-out`) during data fetch. Skeletons match exact dimensions of real content to prevent CLS.

### 2.4 Save Pattern

Per-section save buttons with state machine: Default → Saving (spinner, disabled) → Success (green "Salvo", 2s) → Reset. Validation errors: red button with error count. Unsaved changes: amber badge + guard dialog on navigation.

### 2.5 Undo Toast

Fixed-position bottom-center toast with 5s countdown progress bar, undo button, and Z key shortcut. Used for: mark replied, schedule/unslot, and other reversible actions.

### 2.6 Detail Slide-in Panel

Consistent pattern: click row → 380-420px panel slides from right with indigo left border. Table compresses. Close via X or Esc. Mobile: full-screen overlay. Used on: Subscribers, Contacts, Authors.

### 2.7 Keyboard Shortcuts

Every screen has context-specific shortcuts. Common: `?` show help, `Esc` close panel/dialog, `/` focus search. Number keys switch tabs/views.

### 2.8 Mobile Breakpoint (< 768px)

- Tables → card lists
- Side panels → full-screen overlays
- KPI grids: 4-col → 2×2
- Horizontal scrollable pills for filters/tabs
- Sticky bottom save buttons
- Charts hidden or simplified

### 2.9 Empty States

Two variants per screen:
1. **Zero data:** Icon + descriptive message + primary CTA to create content
2. **Filtered empty:** Search term echo + active filter name + "Clear filters" button

---

## 3. Sidebar Navigation

```
OVERVIEW
  Dashboard        /cms
  Schedule         /cms/schedule

CONTENT
  Posts            /cms/blog
  Newsletters      /cms/newsletters
  Campaigns        /cms/campaigns

PEOPLE
  Authors          /cms/authors
  Subscribers      /cms/subscribers      (admin only)
  Contatos [8]     /cms/contacts         (pending badge)

INSIGHTS
  Analytics        /cms/analytics

Settings           /cms/settings          (admin only)
```

Contacts shows amber notification badge with pending submission count.

---

## 4. Screen Specs

### 4.1 Dashboard (`/cms`)

**Score:** 98/100

**Layout:** Topbar → KPI strip (4 cards) → Last Newsletter Banner → 3-column middle (Coming Up + Continue Editing + Recent Activity) → Top Content table.

**KPI Cards (4-col grid):**
- Published Posts: count + 7-day sparkline + delta %
- Subscribers: count + sparkline + net gains
- Avg Open Rate: percentage + sparkline + delta pp
- Unread Messages: count (amber if >0) + sender previews

**Last Newsletter Banner:** Gradient card showing most recent sent edition with delivery/opens/clicks/bounces stats and link to full analytics.

**3-Column Middle:**
- **Coming Up:** Timeline items grouped Today/This Week, colored by type (post=blue, newsletter=green, campaign=purple)
- **Continue Editing:** 3 draft items with progress rings (completion %)
- **Recent Activity:** 5 timeline events with colored dots + descriptions

**Top Content Table:** Tabbed (Posts/Newsletters/Campaigns), 3 rows with author avatar, view count, read time, mini sparklines.

**"+ New Content" button:** Dropdown → New Post / New Newsletter / New Campaign.

**Empty State:** KPIs show "0" with dashed sparklines. 3 onboarding cards replace middle section.

**Mobile:** 2×2 KPIs, sections stack vertically, sparklines hidden in table.

---

### 4.2 Posts (`/cms/blog`)

**Score:** 98/100

**Layout:** Header (title + counts + [+ New Post]) → Filter bar (status pills + search + author dropdown + sort) → Table → Bulk actions bar → Pagination.

**Filter Pills:** All | Draft | Pending Review | Published | Scheduled | Archived. URL-driven `?status=`.

**Table Columns:** Checkbox | Cover (40×28px) | Title (+ subtitle: read time, views) | Author (avatar + name) | Status (badge) | Locale badges (PT/EN, amber if translation missing) | Date (contextual per status) | ⋯ menu.

**Row Variants:**
- Published: green badge, view count, all locale badges
- Scheduled: amber badge with date/time
- Pending Review: amber "Review" badge, submitted by info, amber row tint
- Draft: gray badge, word count, dimmed title
- Empty draft: italic "Sem titulo", 0 words

**⋯ Menu (varies by status):** Edit, Duplicate, View ↗, Send as NL, Archive (published). Edit, Unschedule, Delete (scheduled). Edit, Approve, Reject (pending review). Edit, Delete (draft).

**Bulk Actions:** Publish | Change Author | Archive | Delete (red, drafts only).

**Pagination:** 50/page, server-side.

**Mobile:** Card list with cover bg, tap=edit, long-press=actions sheet. Filters collapse into dropdown.

---

### 4.3 Newsletters (`/cms/newsletters`)

**Score:** 98/100

**Layout:** Last Newsletter Banner → KPI strip (4 cross-type aggregates) → Newsletter Type Cards (horizontal) → Filter buttons → Search + [+ New Edition] → Editions table → Pagination.

**KPI Cards:**
- Unique Subscribers (across all types, with overlap note)
- Editions Sent (30d)
- Avg Open Rate (30d, with delta pp)
- Bounce Rate (with health gauge: <2% green, 2-5% amber, >5% red auto-pause)

**Newsletter Type Cards (3 cards, flex row):**
Each card: color dot, type name, status (Active/Paused/Overdue), cadence text, stats (subs/opens/editions), last/next dates. Click filters edition table. Selected card gets indigo border.

**Editions Table Columns:** Edition (+ type dot) | Type | Delivered | Opens % | Clicks % | Date | ⋯

**Row Variants:**
- Currently Sending: animated dot, progress bar (N/M subscribers, X%)
- Sent (best performer): ★ badge, highlighted open rate
- Scheduled: amber badge with datetime
- Draft from Post: 🔗 source post indicator
- Failed: red bg, error message, [Retry N remaining →]

**⋯ Menu (varies):** Edit/Test/Duplicate/Delete (draft), Edit/Cancel/Reschedule (scheduled), Archive/Analytics/Duplicate (sent), Retry/Edit/Delete (failed).

**Sort:** Click column header toggles ASC/DESC.

**Mobile:** 2×2 KPIs, type cards horizontal scroll, table → cards with mini bars.

---

### 4.4 Campaigns (`/cms/campaigns`)

**Score:** 98/100

Follows same pattern as Posts with campaign-specific adaptations: submission counts, conversion rates, PDF download tracking. Table shows campaign landing pages with lead generation metrics.

---

### 4.5 Authors (`/cms/authors`)

**Score:** 98/100

**Layout:** Header (title + count badge + search + [+ New Author]) → Filter pills (All/Linked/Virtual) → Author cards grid (3-col) → Detail slide-in panel.

**Author Card Contents:** Avatar (with online dot for linked), name + "You" badge (if self), slug (@handle), type badge (Linked/Virtual), bio excerpt, stats grid (Posts/Published/Campaigns), activity indicator (green/amber/gray dot + last post date).

**⋯ Menu:** Edit, View Posts, Set as Default (★), Delete.

**Create/Edit Modal:**
- Type toggle: Virtual / Linked
- Avatar: upload or color gradient picker (6 options)
- Display Name (required), Slug (auto-generated, @-prefixed)
- Bio with locale tabs (PT-BR / EN), 280 chars, markdown
- Social Links: Website, Twitter, GitHub, + add more. SEO note about JSON-LD sameAs
- Linked User dropdown (only for linked type, only unlinked members shown)

**Detail Panel (400px slide-in):** Full profile, multi-locale bio tabs, author page preview card, posts list, social links, danger zone (delete with reassignment).

**Default Author:** Gold ★ badge, one per site, first created = auto-default, drag-to-reorder via sort_order.

**Schema changes needed:** `display_name`, `bio`, `site_id FK`, `UNIQUE(site_id, slug)`, `social_links JSONB`, `avatar_color TEXT`, `sort_order INT`, `is_default BOOL`.

**Mobile:** 1-col cards, full-screen detail, bottom sheet for create modal.

---

### 4.6 Subscribers (`/cms/subscribers`)

**Score:** 98/100
**RBAC:** org_admin/super_admin only (others redirected)

**Layout:** Header (title + [Export CSV] + [← Newsletters]) → KPI strip → Growth chart (stacked bar) → Search + filters → Batch actions bar → Table → Pagination.

**KPI Cards:** Total Active | New (30d) | Churn Rate | Open Rate (avg, last 5 editions).

**Growth Chart:** Stacked bar (30 bars = days), green=gained, red=lost. Period toggle (7d/30d/90d/1y). Tooltip on hover. Desktop only.

**Table Columns:** Checkbox | Email | Status | Newsletter (type dot) | Engagement (5 dots) | Tracking (consent icon) | Since | ⋯

**Engagement Dots (last 5 sends):** Green=opened, cyan=clicked, dim gray=no open, red=bounced, rose=complained.

**Row Variants:**
- Confirmed: normal email, green badge, engagement dots visible
- Pending: dimmed email, amber badge, no engagement data
- Bounced: red email, red badge, bounce event dot visible
- Unsubscribed: gray email, gray badge, pre-unsub history visible, no resubscribe (LGPD)
- Anonymized: `a4f8c2e1...@anon`, lock icon, disabled checkbox, 0.6 opacity

**Detail Panel (420px):** Subscriptions list, tracking consent toggle, consent history timeline, engagement timeline (last 20 events, scrollable), bounce details variant.

**Batch Actions:** Export Selected | Unsubscribe (with confirmation dialog).

**Export CSV:** Loading states (Default→Loading→Exported), rate limit 1/min, excludes anonymized.

**Sort:** Sortable columns (Email, Status, Since) with directional indicators.

**Mobile:** Card layout, sticky batch bar, full-screen detail sheet, growth chart hidden.

---

### 4.7 Schedule (`/cms/schedule`)

**Score:** 98/100

**Layout:** Header (title + view toggle + week nav) → Main area (Calendar/Agenda left + Backlog sidebar right).

**3 Views:**
1. **Week (default desktop):** 7-col calendar grid, current day highlighted, items as colored cards, empty slots as dashed borders (gray=future, red=overdue)
2. **Agenda (default mobile):** Chronological date-grouped list with items and slots
3. **Month (compact):** 30-day dot grid, colored dots per item type, click day → zoom to week. Overdue dots use border-only.

View saved in localStorage, URL param `?view=week|agenda|month`.

**Item Type Indicators:**
- Blog post: square dot, green
- Newsletter: round dot, indigo

**Backlog Sidebar (230px right):**
1. **Week Summary:** 2×2 grid (Published/Scheduled/Open Slots/Overdue)
2. **Cadence Info:** Per-locale/type cadence rules with "Edit →" link. Paused cadences: strikethrough + amber badge
3. **Backlog Items:** Draggable cards with handle, type dot, title, "Schedule →" button. Ordered by `queue_position`. Only `ready` status is schedulable.

**Quick Schedule Dialog:** Content dropdown (ready items only) + slot date chips (overdue first in red, cadence-suggested, custom picker) + publish time input. CAS: `UPDATE SET status='queued', slot_date=? WHERE status='ready'`.

**Conflict Detection:**
- Busy day (2+ items, different locales): amber "Busy: N items" badge
- Same-locale conflict: red "Locale conflict: 2x pt-BR" badge + red cell border
- Quick Schedule warning when scheduling to busy slot

**Drag and Drop:** Backlog → calendar. Optimistic states: Dragging (tilted, dashed border) → Dropped ("Scheduling..." spinner) → Success (solid card) → Failure (snap back + error toast).

**Unslot Confirmation:** "Remove from schedule?" dialog showing item title, date, status change preview (Queued → Ready).

**Undo Toasts:** Schedule (green), Unslot (amber), Publish (irreversible, no undo).

**Keyboard Shortcuts:** ←/→ prev/next week, T today, N new schedule, 1/2/3 switch view, Tab navigate slots, Enter open/confirm, Esc close, Z undo, ? help.

**Data Contracts:**
- Fetches: scheduled items for date range, backlog items (ready + draft), cadence config (blog_cadence + newsletter_types), week summary stats
- Mutations (CAS): `scheduleItem`, `unslotItem`, `publishNow`, `reorderBacklog`

**RBAC:** Editors can schedule/unslot/publish but not edit cadence. Reporters view only.

**Mobile:** Forced agenda view, backlog as bottom sheet, full-screen item detail.

---

### 4.8 Analytics (`/cms/analytics`)

**Score:** 98/100

**Layout:** Topbar (title + "Export Report") → 4 tabs + period selector → Tab content.

**Tabs:** Overview (default) | Newsletters | Campaigns | Content. URL: `?tab=`.

**Period Selector:** 7d / 30d (default) / 90d / 12m. URL: `?period=`. Change triggers skeleton overlay then server re-fetch.

**Tab 1: Overview**
- KPI strip: Total Opens, Total Clicks, Delivery Rate, Campaign Leads
- Area chart: multi-series (Opens/Clicks/Subs) with gradient fill, "Today" marker
- Donut chart: audience segments (High engagement/Re-engagement/New/Inactive)
- Delivery funnel: 4 horizontal bars (Sent→Delivered→Opened→Clicked)
- Top Posts + Top Campaigns: 2-col grid, 5+4 rows
- Heatmap: GitHub-style 8-week grid, desktop only

**Tab 2: Newsletters**
- KPI strip: Editions Sent, Avg Open Rate, Avg Click Rate, Bounce Rate
- Edition performance table (clickable → per-edition analytics)
- Aggregate: Top Clicked Links (all editions) + Email Client Distribution (horizontal bars)

**Tab 3: Campaigns**
- KPI strip: Active Campaigns, Total Submissions, Avg Conversion
- Submissions bar chart (time buckets)

**Tab 4: Content**
- KPI strip: Published, In Queue, Avg Read Time, Locale Split
- Horizontal bar chart: post performance by views

**Chart Interactions:**
- Area chart: vertical crosshair + tooltip with date + series values
- Donut: segment highlight + tooltip with count + % + definition
- Heatmap: cell outline + "Day, Date — N posts, N newsletters" tooltip
- Funnel: tooltip with delta from previous step

**Period Comparison:** Toggle "Compare: previous {period}" → dashed lines (opacity 0.3) overlaid. Disabled for 12m. URL: `?compare=1`.

**Stale Data Indicator:** When `stats_stale=true`: KPI dimmed + amber border + spinner + "Refreshing..." → auto-triggers `refresh_newsletter_stats()` → green flash + "Updated".

**Export Dialog:** Format (PDF/CSV) + section checkboxes + period. Rate limit 1/5min.

**Keyboard:** 1-4 switch tabs, 7/3/9/Y switch period, ←/→ navigate chart points, E export, C toggle comparison, Esc dismiss.

**Components from `@tn-figueiredo/cms-admin`:** AreaChart, DonutChart, DeliveryFunnel, Heatmap, HorizontalBar.

**RBAC:** All roles view. Reporters see own content only. Export: editors+ only.

---

### 4.9 Settings (`/cms/settings`)

**Score:** 98/100

**Layout:** Header → Sidebar tabs (175px, 6 items) + Content area. Only active section renders. URL: `?section=`.

**Sidebar Tabs:**
1. Branding (🎨)
2. SEO (🔍)
3. Newsletters (📬) — amber dot if unsaved
4. Blog Cadence (📅)
5. Localization (🌐)
6. Danger Zone (⚠, red, super_admin only, separated)

**Section 1: Branding & Identity**
- Logo URL: HTTPS input + 48px preview. Validation: must start with `https://`
- Primary Color: hex input + 32px swatch + 6 preset swatches. Validation: `/^#[0-9A-Fa-f]{6}$/`
- Identity Type: Person/Organization toggle buttons. Affects JSON-LD schema
- Twitter Handle: @-prefixed input. Validation: `/^[A-Za-z0-9_]{1,15}$/`
- Server actions: `updateSiteBranding()` + `updateSiteIdentity()`. Cache: `revalidateSiteBranding()`

**Section 2: SEO Defaults**
- Default OG Image: HTTPS URL + 120×63px preview (1200×630 aspect)
- Feature Flags (read-only 2×2 grid): JSON-LD, Dynamic OG, Extended Schemas, AI Crawlers Blocked
- OG Precedence chain info box
- Server action: `updateSiteSeoDefaults()`. Cache: `revalidateTag('seo-config')`

**Section 3: Newsletter Types**
- Per-type accordion cards with: drag handle (sort_order), color dot, editable name (click to inline rename), status badge, subscriber count, expand/collapse
- Expanded fields: cadence_days (select), preferred_send_time, max_bounce_rate_pct, sender_name, sender_email, reply_to, color
- 3-dot menu: Rename, Duplicate, Pause/Resume, Delete (red, type-name confirmation)
- "+ New Newsletter Type": inline card with all fields + Cancel/Create
- Data: `newsletter_types` table

**Section 4: Blog Publishing Cadence**
- Per-locale cards (from `sites.supported_locales`) with enable toggle
- Fields: cadence_days (select), preferred_send_time, cadence_start_date
- Read-only: last published date, next slot date
- Server action: `updateBlogCadence()`. Data: `blog_cadence` table

**Section 5: Localization**
- Default locale dropdown
- Supported locales list with remove buttons (default = "Primary", no remove)
- Add locale: searchable dropdown grouped by region (BCP-47)
- Warning: removing locale archives content, doesn't delete
- Server action: `updateSiteLocales()`. Data: `sites.supported_locales`

**Section 6: Danger Zone (super_admin only)**
- Disable CMS (preserves content)
- Transfer Ownership (preserves memberships)
- Delete Site (slug-confirmation gate, irreversible)

**Inline Validation:** Red borders + error messages below fields. Save button shows error count.

**RBAC:** org_admin+: full edit (no Danger Zone for org_admin). Editors: read-only (disabled inputs, info banner). Reporters: redirect.

**Keyboard:** Cmd+S save, 1-5 switch tabs, 6 Danger Zone, Esc cancel, Enter confirm rename, ? help.

---

### 4.10 Contacts (`/cms/contacts`)

**Score:** 98/100

**Layout:** Topbar (title + Export CSV) → KPI strip (4 cards) → Filters + Search → Table → Pagination → Bulk actions bar (when selected).

**KPI Cards:** Total (+ 30d delta) | Pending (+ oldest age) | Replied (+ reply rate %) | Avg Response Time (hours + monthly delta).

**Filter Tabs:** All | Pendentes | Respondidos | Anonymized. URL: `?status=`.

**Table Columns:** Checkbox | Name (unread amber dot for pending) | Email | Preview (80 chars truncated) | Date | Status badge | Consents (P/M mini badges).

**Row Variants:**
- Pending: bold name, amber tint, amber dot
- Replied: normal gray text
- Anonymized: italic "Anonymous", hash `@anon` email, dimmed (0.6 opacity), disabled checkbox

**Detail Panel (380px slide-in):**
- Name + status + close button
- Email (mailto link) + received timestamp
- Full message (pre-wrapped block)
- Consent details (per category: granted/not, version tracked)
- Metadata (admin-only): IP, User-Agent (parsed), Submission ID
- Actions: Reply email / Expand inline reply textarea, Mark replied, Anonymize (LGPD)

**Quick Reply Inline Textarea:**
- Expands in detail panel with From/To (read-only), editable Subject, textarea body
- "Marcar como respondido ao enviar" checkbox (default checked)
- Sends via Resend API. States: Sending (spinner) → Success (green)

**LGPD Anonymization:**
- Single: confirmation dialog listing exact fields affected (name→Anonymous, email→SHA256, message→redacted, ip/ua→null)
- Bulk: lists affected submissions by name/email, sequential RPC calls with progress bar
- `anonymize_contact_submission(p_id)` RPC. Org_admin+ only

**Optimistic Mark Replied:** Instant badge flip → undo toast (5s, Z key) → server sync. Error: rollback + error toast.

**Retention Banner:** "Submissions auto-anonymized after 730 days (LGPD Art. 15 III)" with next sweep date. Dismissable (localStorage).

**Sidebar Badge:** Amber circle with pending count on "Contatos" menu item. Pulse animation on increment.

**Export CSV:** Dialog with period (30d/90d/all) + status filter. Anonymized rows exported without PII.

**RBAC:** Editors: reply + export, no anonymize, IP/UA redacted. Org_admin+: full + anonymize + metadata. Reporters: read-only.

**Keyboard:** J/K navigate rows, Enter open panel, Esc close, R reply, M mark replied, Z undo, / search, ↑↓ nav in panel, X toggle checkbox, ? help.

---

## 5. Cross-Cutting Concerns

### 5.1 Package Extraction

All new CMS UI components should be built extraction-ready for `@tn-figueiredo/cms-admin`:
- Thin server-component wrappers in `apps/web` that fetch data and pass to client components
- Client components imported from `@tn-figueiredo/cms-admin` (or local equivalents during development)
- Pattern: `page.tsx` (server, data fetch) → `*-connected.tsx` (client, wires package components to app actions)

### 5.2 URL State Management

All screens use URL searchParams for filter/sort/tab/page/view state. Pattern:
- `useSearchParams()` + `router.push()` for client-side updates
- Server components read params for initial data fetch
- Enables deep-linking and browser back/forward

### 5.3 Cache Invalidation

All write actions call appropriate `revalidateTag`/`revalidatePath` after mutation:
- Blog mutations: `revalidateBlogPostSeo()` + `revalidatePath('/cms/blog')`
- Newsletter mutations: `revalidatePath('/cms/newsletters')`
- Settings mutations: section-specific (`revalidateSiteBranding()`, `revalidateTag('seo-config')`)
- Contact mutations: `revalidatePath('/cms/contacts')`

### 5.4 Server Actions Security

All write server actions must:
1. Re-check RBAC inside the action (not rely on page-level check)
2. Use `getSupabaseServiceClient()` only after `canAdminSite()` validation
3. Use CAS patterns for status transitions (`WHERE status=? AND ...`)
4. Tag Sentry errors with action context

### 5.5 Accessibility

- All interactive elements have ARIA labels
- Status badges use `role="status"` with `aria-live="polite"`
- Keyboard navigation follows WAI-ARIA patterns
- Color is never the sole indicator (always paired with text/icon)
- Focus management on panel open/close

---

## 6. Implementation Priority

Recommended implementation order based on dependencies and user impact:

1. **Settings** — blocks other screens (branding/cadence config needed)
2. **Authors** — schema changes needed, blocks Posts author display
3. **Dashboard** — highest visibility, depends on data from other screens
4. **Posts** — core content management, existing implementation needs upgrade
5. **Schedule** — depends on cadence from Settings + posts/editions data
6. **Newsletters** — existing implementation, needs visual overhaul
7. **Contacts** — mostly self-contained, existing implementation
8. **Subscribers** — admin-only, existing implementation
9. **Analytics** — depends on data accumulation, can launch later
10. **Campaigns** — existing implementation, lowest change delta

---

## 7. Open Decisions

1. **Authors table schema migration** — rename `name→display_name`, add `social_links JSONB`, `avatar_color`, `sort_order`, `is_default`. Needs migration + backfill.
2. **Quick reply email template** — use existing contact auto-reply template or create a new "admin reply" template via Resend?
3. **Analytics chart library** — `@tn-figueiredo/cms-admin` AreaChart/DonutChart are thin wrappers over what? Recharts? Custom SVG? Needs decision before implementation.
4. **Drag-and-drop library** — Schedule drag-drop needs a library (dnd-kit recommended for React 19 compatibility).
5. **Month view in Schedule** — compact dot grid is desktop-only. Worth implementing in v1 or defer?
