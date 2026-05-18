# Social Composer v6 — Stories, Templates & Link Pipeline

**Status:** Draft
**Date:** 2026-05-17
**Author:** Thiago Figueiredo
**Sprint:** 5h (Social Hub)

---

## 1. Overview & Architecture

### Problem

Three gaps block the Social Hub from being a complete publishing tool:

1. **Instagram Stories have no publish path.** The Graph API does not support direct Story posting for non-partnered apps. Users must export an image and post manually, but the current Composer offers no workflow for this.
2. **The link pipeline is invisible.** Short URLs are generated server-side, OG metadata is scraped and cached, but the Composer UI never surfaces any of this. Users cannot preview how a link will render on each platform or confirm resolution before publishing.
3. **No visual template system.** Every post starts from scratch. There is no way to save, reuse, or adapt layouts across platforms.

### Solution

Extend the Composer with five capabilities:

- **Dual-mode Instagram Story publishing** — Quick Mode for automated posting, Design Mode for manual posting with a canvas editor and push notification workflow.
- **Caption variable system** — `{{link}}`, `{{title}}`, `{{url}}` placeholders resolved at publish time, with per-platform defaults.
- **OG preview sidebar** — Live, per-platform previews of how link cards will render, with validation badges and scrape controls.
- **Pre-publish confirmation** — A summary step showing resolved captions, final short URLs, and OG card previews before anything is sent.
- **Cross-platform template library** — Save any post as a reusable template; templates store layout, caption patterns, and platform targets.

### Architecture

```
┌─────────────┐
│  Content CMS │
│  (post/link) │
└──────┬───────┘
       │ content + metadata
       ▼
┌──────────────────────────────────────────────┐
│              COMPOSER                         │
│                                               │
│  ┌─────────────┐      ┌──────────────────┐   │
│  │  Quick Mode  │      │   Design Mode    │   │
│  │  (auto-post) │      │  (canvas editor) │   │
│  └──────┬───────┘      └────────┬─────────┘   │
│         │                       │              │
│         ▼                       ▼              │
│  ┌─────────────────────────────────────────┐  │
│  │  Caption Variables  │  OG Preview Panel │  │
│  └─────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────┘
                   │ resolved content
                   ▼
┌──────────────────────────────────────────────┐
│              PIPELINE                         │
│                                               │
│  platform_prepare ──► validate ──► publish    │
│  (resolve vars,       (OG check,   (API call  │
│   shorten URL,         char limit)  or notify) │
│   render image)                               │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────┼──────────┬────────────┐
        ▼          ▼          ▼            ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
   │   FB   │ │   IG   │ │   BS   │ │    YT    │
   │  Graph │ │  Graph │ │  AT    │ │  Data v3 │
   │  API   │ │  API   │ │ Proto  │ │          │
   └────────┘ └────────┘ └────────┘ └──────────┘
```

### Dual Mode — Instagram Stories

| Aspect | Quick Mode | Design Mode |
|---|---|---|
| **Render** | Konva server-side (Node canvas) | react-konva in-browser canvas editor |
| **Output** | 1080x1920 PNG generated on server | 1080x1920 PNG exported by user |
| **Publishing** | Auto-post via IG Graph API (image endpoint) | Telegram/Push notification with image + caption |
| **Link handling** | Short URL burned into image + "Link in bio" CTA text | User places link sticker manually after notification |
| **User effort** | Zero — fire and forget | Review canvas, export, post from phone with sticker |
| **Best for** | Batch scheduling, consistent branding | Custom layouts, time-sensitive stories, interactive stickers |

Quick Mode uses the same Konva pipeline as thumbnail generation: a predefined template is populated server-side, rendered to PNG, and posted through the IG Content Publishing API as a Story image. The short URL and "link in bio" CTA are composited directly onto the image since Stories do not support clickable links via API.

Design Mode opens the react-konva canvas editor (shared with the future Canvas Studio). The user designs the story visually, exports, and receives a push notification (or Telegram message) on their phone with the image and pre-filled caption. They then post manually from the Instagram app, adding a link sticker.

### Platform Matrix

| Platform | Post Types | Link Handling | Media | Character Limit |
|---|---|---|---|---|
| **Facebook** | `link_share`, `video_share` | Short URL in post body, OG card auto-generated | Image or video attachment | 63,206 |
| **Instagram** | `story`, `reel` | Quick: burned into image; Design: link sticker (manual) | 1080x1920 PNG (story), video (reel) | 2,200 (caption) |
| **Bluesky** | `text` + `link_card` | `app.bsky.embed.external` facet with OG metadata | OG image embedded in card | 300 (graphemes) |
| **YouTube** | `community_post`, `thumbnail` | Link in community post body | Thumbnail image (1280x720) | 500 (community) |

---

## 2. Caption Variable System & OG Preview

### Caption Variables

Three variables are available in any caption textarea:

| Variable | Resolves To | Example |
|---|---|---|
| `{{link}}` | Platform short URL (`go.btf.com/abc123`) | `go.btf.com/s5k2q1` |
| `{{title}}` | Post or link title from CMS | `Como configurar OAuth 2.0` |
| `{{url}}` | Raw destination URL (no shortener) | `https://bythiagofigueiredo.com/blog/oauth-guide` |

Variables are stored as raw template strings in the database. Resolution happens at publish time inside the `platform_prepare` pipeline step, ensuring the short URL reflects the final destination even if edited after draft creation.

### Caption UI

The caption input is a standard `<textarea>` with a synchronized regex overlay layer that highlights variables. Each `{{...}}` match receives a `bg-blue-900/40 rounded px-0.5` highlight rendered in a positioned `<div>` behind the textarea. This is NOT a chip/tag system — the user types freely, and highlights appear and disappear as the text changes.

The regex for detection:

```
/\{\{(link|title|url)\}\}/g
```

Unknown variables (e.g., `{{foo}}`) are ignored — no highlight, no error.

### Per-Platform Defaults

When a platform is toggled on and its caption field is empty, the following default is pre-filled:

| Platform | Default Caption |
|---|---|
| Facebook | `{{title}}\n\n{{link}}` |
| Bluesky | `{{title}}\n\n{{link}}` |
| Instagram | `{{title}}\n\nLink na bio` |
| YouTube | `{{title}}\n\n{{link}}` |

Instagram defaults to "Link na bio" instead of `{{link}}` because IG captions do not support clickable links. Users can override any default.

### Resolved Preview Panel

Below each caption textarea, a read-only preview panel shows the final resolved text:

```
┌─────────────────────────────────────────────┐
│  Como configurar OAuth 2.0                  │
│                                             │
│  go.btf.com/______                          │
│                                    142/300  │
└─────────────────────────────────────────────┘
```

Key behaviors:

- **Placeholder link:** Before a short URL is generated, the preview shows `go.btf.com/______` (24 characters) as a fixed-width placeholder.
- **Character count uses resolved length.** The counter calculates against the resolved string, not the template. `{{link}}` always counts as 24 characters (short URL length), `{{title}}` counts as the actual title length, `{{url}}` counts as the actual URL length.
- **Platform limit indicator:** The count changes color at 90% of the platform's character limit (amber) and at 100% (red).

### Soft Validation

| Condition | Indicator | Behavior |
|---|---|---|
| Caption contains no `{{link}}` | Yellow warning icon + "No link in caption" | Warning only, never blocks publish |
| Caption exceeds platform limit | Red counter | Blocks publish for that platform |
| Unknown `{{variable}}` | No highlight, rendered literally | No warning — treated as plain text |

Missing `{{link}}` is a soft warning because some posts intentionally omit links (e.g., brand awareness, community engagement). The warning is a `text-yellow-500` inline message below the preview panel with an "Add {{link}}" quick-insert button.

### OG Preview Sidebar

A fixed 380px sidebar sits to the right of the Composer form, sticky-positioned to remain visible during scroll. It renders per-platform previews of how the link card will appear.

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  COMPOSER FORM (flex-1)              │  OG PREVIEW (w-[380px])  │
│                                      │  sticky top-20           │
│  [Platform toggles]                  │                          │
│  [Caption textarea + preview]        │  ┌─ Tabs ─────────────┐ │
│  [Media attachments]                 │  │ FB │ BS │ IG │      │ │
│  [Schedule picker]                   │  ├────────────────────┤ │
│                                      │  │                    │ │
│                                      │  │  [OG Card Preview] │ │
│                                      │  │                    │ │
│                                      │  ├────────────────────┤ │
│                                      │  │  Validation Badges │ │
│                                      │  │  Scrape Status     │ │
│                                      │  └────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

#### Per-Platform Tabs

| Tab | Preview Style |
|---|---|
| **Facebook** | Standard link card: 524px wide, 1.91:1 image ratio, title (bold), description (gray), domain (small caps) |
| **Bluesky** | Embed external card: rounded corners, 2:1 image ratio, title, description truncated at 2 lines, domain with globe icon |
| **Instagram** | Story frame: 9:16 aspect ratio miniature showing how the image + CTA overlay will render in Quick Mode |

YouTube is excluded from OG preview since community posts do not generate link cards.

#### OG Validation Badges

Below the preview card, validation badges flag issues with the destination URL's Open Graph metadata:

| Badge | Condition | Severity |
|---|---|---|
| `og:image missing` | No `og:image` tag found | Red |
| `Image too small` | Image dimensions below 600x314 | Amber |
| `Description too long` | `og:description` exceeds 200 characters | Amber |
| `Title missing` | No `og:title` tag found | Red |
| `All checks passed` | Everything valid | Green |

Red badges block publish with a "Fix OG tags before publishing" message. Amber badges are warnings only.

#### Scrape Status

The sidebar footer shows the current OG cache state:

- **Green badge — "Cached"**: OG metadata was scraped and cached within the last 7 days. Shows timestamp of last scrape.
- **Amber badge — "Not scraped"**: No cached OG data exists, or cache is stale (older than 7 days). Preview uses live-fetched data.
- **"Force Scrape" button**: Triggers an immediate re-scrape of the destination URL, refreshes the preview, and updates the cache. Also requests Facebook's sharing debugger to clear their cache via the `og:url` scrape endpoint.

### Storage Model

Captions are persisted as raw template strings in the `social_posts` table:

| Column | Type | Example Value |
|---|---|---|
| `caption_template` | `text` | `{{title}}\n\n{{link}}` |
| `caption_overrides` | `jsonb` | `{"instagram": "{{title}}\n\nLink na bio"}` |

The `caption_template` field holds the default template. `caption_overrides` holds per-platform overrides keyed by platform slug. At publish time, the pipeline resolves the appropriate template (override if present, default otherwise), substitutes variables, and passes the final string to the platform adapter.

This design ensures that if a post title or short URL changes between drafting and publishing, the published caption always reflects the latest values.

---

## 3. Publish Pipeline & Link Resolution

### 3.1 Pipeline Redesign

The legacy pipeline assumed a single OG scrape step that worked identically for all destinations. The new pipeline replaces the generic scrape with a per-platform preparation phase:

```
OLD:  Post → Short Link → OG Scrape → Deliver
NEW:  Post → Short Link → platform_prepare → Deliver
```

`platform_prepare` is a discriminated union — each platform defines its own preparation logic:

| Platform | `platform_prepare` behavior |
|---|---|
| Facebook | Graph API scrape (`?scrape=true`) to warm the OG cache for the target URL |
| Bluesky | No-op at prepare time; OG fetch + `uploadBlob` happen inline at publish (AT Protocol requires the blob CID in the post record) |
| Instagram Quick | No-op; image/video uploaded directly via Graph API, no link card concept |
| Instagram Design | No-op; notification-only flow, no API call |

### 3.2 Link Creation Timing

Short links are created **just-in-time** when the user clicks "Publicar" in the Composer — not when the post is drafted. Creation uses the existing Links Engine (`/go/${code}`) and completes in ~200ms. This avoids orphan links from abandoned drafts.

### 3.3 Pre-Publish Confirmation Dialog

Clicking "Publicar" triggers a parallel fan-out before the dialog renders:

```
┌─────────────────────────────────────────┐
│          onClick "Publicar"             │
│                                         │
│   ┌──────────────┐  ┌───────────────┐   │
│   │ Create short │  │ Fetch OG meta │   │
│   │    link       │  │  (title, img) │   │
│   └──────┬───────┘  └──────┬────────┘   │
│          └────────┬────────┘            │
│                   ▼                     │
│        Render confirmation dialog       │
└─────────────────────────────────────────┘
```

The dialog displays:

- **Resolved captions per platform** — final text with `{{short_url}}` replaced, character counts, truncation warnings
- **OG card previews** — rendered at each platform's aspect ratio (landscape for FB/BS, square for IG)
- **Platform badges** — green for auto-post, amber for notification-only
- **Warnings** — rate limit proximity, missing images, caption overflow

**Mixed mode** is the norm: a single confirmation dialog can show Facebook auto-post (green badge) alongside Instagram Design notification (amber badge). The user sees exactly what will happen on each platform before confirming.

**Cancel** = soft-delete the short link (sets `deleted_at`, link returns 410). **Confirm** = dispatch to all enabled platforms.

### 3.4 Per-Platform Delivery

On confirm, delivery dispatches concurrently per platform:

| Platform | Delivery method |
|---|---|
| **Facebook** | Auto-post via Graph API (`POST /{page-id}/feed`). Link card rendered from pre-warmed OG cache. |
| **Instagram Quick** | Auto-post via Graph API (`POST /{ig-user-id}/media` + `POST /{ig-user-id}/media_publish`). Link-in-Bio entry updated to point to the short URL. |
| **Instagram Design** | CMS notification sent to user with export instructions. No API call. |
| **Bluesky** | Auto-post via AT Protocol. Full sequence: fetch OG → download OG image → `com.atproto.repo.uploadBlob` → create post record with `app.bsky.embed.external` containing the blob ref, URL, title, and description. |

### 3.5 Error Handling

Delivery failures follow a **3-retry exponential backoff** schedule:

| Attempt | Delay | Cumulative wait |
|---|---|---|
| 1st retry | 5 seconds | 5s |
| 2nd retry | 30 seconds | 35s |
| 3rd retry | 2 minutes | 2m 35s |

**Permanent errors** (4xx responses except 429) fail immediately — no retries. Examples: deleted page, revoked permissions, invalid media format.

**Token expiry** (401/403 from any platform) sets `status = 'token_expired'` on the connection and surfaces a "Reconnect" banner in the Composer header. The banner links directly to the OAuth re-auth flow for that platform.

### 3.6 Rate Limiting

Each platform connection tracks a **rolling 24-hour counter** (`rate_window_start` + `rate_window_count` on `social_connections`). The counter is checked in `createSocialPost` before the row is inserted — if the limit is hit, the insert is rejected and the user sees an inline error.

The Composer displays a pill badge next to the platform icon:

| Threshold | Badge | Behavior |
|---|---|---|
| **80%** of daily limit | Yellow pill | Warning only |
| **95%** of daily limit | Red pill | Urgent warning |
| **100%** of daily limit | Red pill + disabled | Platform checkbox disabled, tooltip explains |

---

## 4. Template System

### 4.1 Aspect Ratio Taxonomy

Templates are organized by **aspect ratio**, not platform. A single template can serve multiple platforms that share the same ratio:

| Aspect ratio | Canonical size | Platforms served |
|---|---|---|
| **9:16 Vertical** | 1080 x 1920 | Instagram Story, Facebook Story |
| **1:1 Square** | 1080 x 1080 | Instagram Feed |
| **16:9 Landscape** | 1280 x 720 | YouTube Thumbnail, Facebook Post, Bluesky Card |

Landscape templates render at the canonical 1280x720 and downscale to 1200x630 for OG-card contexts (Facebook, Bluesky). The downscale is a CSS transform at render time — no duplicate template needed.

### 4.2 Template Library

**Route:** `/cms/social/templates`

The library displays a responsive grid of template thumbnails, organized by tabs:

```
[ 9:16 Vertical ]  [ 1:1 Square ]  [ 16:9 Landscape ]
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│         │ │         │ │         │ │         │
│  thumb  │ │  thumb  │ │  thumb  │ │  + New  │
│         │ │         │ │         │ │         │
│ "Bold"  │ │"Overlay"│ │"Minimal"│ │         │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

Each card shows: thumbnail preview, template name, star icon if `is_default`, and an overflow menu (Edit, Duplicate, Delete, Set as Default).

### 4.3 Data Model

```sql
create table social_templates (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid references sites(id) on delete cascade,  -- NULL = system default
  name          text not null,
  aspect_ratio  text not null check (aspect_ratio in ('9:16', '1:1', '16:9')),
  composition   jsonb not null,           -- CardComposition schema
  thumbnail_url text,                     -- Vercel Blob URL
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Only one default per site per aspect ratio
create unique index social_templates_default_unique
  on social_templates (coalesce(site_id, '00000000-0000-0000-0000-000000000000'), aspect_ratio)
  where is_default = true;
```

The `composition` column stores a `CardComposition` JSONB object — the same schema used by the Canvas editor. Layers, positions, fonts, colors, and opacity are all serialized here.

### 4.4 Placeholders

Templates support **5 placeholders** that resolve at application time (when the user selects a template in the Composer):

| Placeholder | Layer type | Resolves to |
|---|---|---|
| `{{title}}` | Text | Post title or first line of caption |
| `{{description}}` | Text | Post excerpt or meta description |
| `{{cover_image}}` | Image | Post cover image URL |
| `{{short_url}}` | Text | Generated short link (available after "Publicar") |
| `{{logo}}` | Image | Site logo from `sites.logo_url` |

Text layers reference text placeholders; image layers reference `{{cover_image}}` or `{{logo}}`. Placeholders that cannot resolve (e.g., no cover image set) render as empty — the layer is hidden, not broken.

### 4.5 System Defaults

The system ships **9 default templates** — 3 per aspect ratio:

| Style | Description |
|---|---|
| **Bold** | Large title text, high contrast background, minimal imagery. Text-heavy. |
| **Overlay** | Full-bleed `{{cover_image}}` with semi-transparent gradient overlay, title and logo layered on top. |
| **Minimal** | Clean white/dark background, small centered title, subtle logo placement. |

System defaults have `site_id = NULL` and are available to all sites. Site-specific templates override system defaults when `is_default = true` for that aspect ratio.

### 4.6 "Save as Template" Flow

From the Canvas editor overflow menu:

1. User clicks **"Save as Template"**
2. Modal appears with a name input field (pre-filled with "Untitled Template")
3. Aspect ratio is **auto-detected** from the current canvas dimensions
4. Thumbnail generated via `canvas.toDataURL('image/png')`, uploaded to Vercel Blob
5. `composition` serialized from current canvas state
6. Row inserted into `social_templates`
7. Toast confirmation, template appears in library

### 4.7 Template Carousel in Composer

The Composer includes a horizontal template carousel rendered below the caption textarea:

```
Caption textarea
┌──────────────────────────────────────────────┐
│ ◀  [tmpl1] [tmpl2] [tmpl3] [tmpl4] [tmpl5]  ▶ │
└──────────────────────────────────────────────┘
```

- **CSS composite preview** — static thumbnail image with placeholder text overlaid via CSS, not a live canvas render. Keeps the carousel lightweight.
- **Arrow keys** cycle through templates. Click to apply. **Blue ring** on the selected template.
- Carousel filters to templates compatible with the active platform's aspect ratio.
- Selecting a template populates the Canvas editor with that composition and resolves placeholders against the current post data.

### 4.8 Settings Matrix

**Route:** Settings > Social

A `content_type x platform` grid where each cell is a dropdown selecting the default template for that combination:

|  | Facebook | Instagram | Bluesky |
|---|---|---|---|
| **Blog Post** | Overlay (16:9) | Bold (1:1) | Minimal (16:9) |
| **Newsletter** | Minimal (16:9) | Overlay (1:1) | Bold (16:9) |
| **Link Share** | Bold (16:9) | Minimal (1:1) | Overlay (16:9) |

Each dropdown is **filtered by compatible aspect ratio** for that platform. The matrix is stored as a JSON object in `sites.social_defaults`:

```json
{
  "blog_post": {
    "facebook": "uuid-of-template",
    "instagram": "uuid-of-template",
    "bluesky": "uuid-of-template"
  },
  "newsletter": { "..." : "..." },
  "link_share": { "..." : "..." }
}
```

### 4.9 Per-Post Override

The post editor sidebar includes an expandable **"Customize sharing"** section:

- Shows a thumbnail preview per enabled platform, using the template resolved from the Settings matrix
- Click any thumbnail to open a **popover picker** with the template carousel filtered to that platform's aspect ratio
- Override is stored on the `social_posts` row (`template_id` column), not on the post itself
- If no override is set, the Settings matrix default applies. If no matrix default exists, the system default for that aspect ratio is used

---

## 5. Instagram Stories & Notification System

### 5.1 Quick Mode (Auto-Generate)

Server-side story generation using Konva (Node.js `konva` + `canvas` packages). A template JSON definition is hydrated with blog/newsletter/campaign data at publish time:

```
Template JSON → hydrate(title, excerpt, cover_image, short_url) → Konva Stage (1080x1920) → stage.toBuffer('image/png') → Vercel Blob
```

The generated image includes the short URL rendered as text (e.g., `go.domain.com/abc`) and a "Link na bio" CTA near the top of the frame. Published via Instagram Graph API with `media_type='STORIES'` pointing to the Blob URL.

Templates are stored in the `social_templates` table with a `composition JSONB` column containing layer definitions (background color/gradient, text positions, image slots, brand elements). The system ships with 3-5 built-in templates; users select a default per site in Settings > Social > Instagram.

### 5.2 Design Mode (Canvas Editor)

Full canvas editor reusing approximately 90% of the QR Card Builder infrastructure (`react-konva`, same drag/drop/selection system, same export pipeline).

**Three-panel layout:**

| Panel | Position | Contents |
|-------|----------|----------|
| Tools Sidebar | Left, 240px | Text tool, Image tool, QR code, Shapes (rect, circle, line), Template gallery (scrollable grid of thumbnails) |
| Canvas | Center, flex | 1080x1920 artboard with selection handles, snap guides (center/edge), optional grid overlay (toggle), zoom controls |
| Inspector | Right, 280px | Context-sensitive properties: font family/size/weight/color, fill/stroke, position (x, y), size (w, h), rotation, opacity, layer order (bring forward/send back) |

Export flow: canvas renders to PNG via `stage.toDataURL()`, uploads to Vercel Blob, then follows the same publish or notification path as Quick Mode.

### 5.3 Instagram API Limitations

Hard constraints that shape the entire Stories architecture:

- **No link stickers via API.** The `media_type='STORIES'` endpoint accepts only `image_url` or `video_url`. No interactive elements (polls, quizzes, sliders, link stickers) can be added programmatically.
- **Stories expire after 24 hours.** No API endpoint to add stories to Highlights.
- **No editing published stories.** Once posted, a story cannot be modified.
- **Rate limit:** 100 API calls per 24-hour window per user (shared across all Instagram Graph API calls).

These limitations are why the notification system exists: the user must manually add the link sticker in the Instagram app.

### 5.4 Link-in-Bio Page (`/go/ig`)

A mobile-first landing page built on the existing Links Engine. The URL is fixed and never changes (set once in Settings > Social > Instagram as the profile bio link).

**Layout:**
- Avatar + display name + one-line bio (pulled from site settings)
- List of the last 20 links from Story posts, newest first
- Each link row: title, optional thumbnail, tracked short URL
- Auto-updated when a Story is published (new entry prepended)
- Auto-prune entries older than 30 days via the existing Links Engine cron
- Every click tracked through the standard Links Engine click pipeline (daily-rotating visitor ID, `link_clicks` partitioned table, hourly aggregation)

The page uses the site's brand colors and is fully responsive. No authentication required.

### 5.5 Notification System

When a Story is generated (Quick or Design mode) and requires manual link sticker attachment, the system notifies the user through a tiered delivery chain:

| Priority | Channel | Delivery Rate | Build Effort |
|----------|---------|---------------|--------------|
| Primary | Telegram Bot | ~98% | ~2h |
| Secondary | Web Push (PWA) | 85% iOS / 95% Android | ~6h |
| Fallback | Email | ~99% (delayed) | ~1h (Resend template) |

The system attempts delivery in priority order. If Telegram is connected, it sends there. Web Push fires regardless (if subscribed). Email sends only if neither Telegram nor Web Push is configured.

### 5.6 Telegram Bot Integration

**Onboarding flow:**

1. User navigates to Settings > Notifications > "Connect Telegram"
2. CMS renders a deep link: `t.me/BotName?start={user_uuid}`
3. User taps link, opens Telegram, sends `/start`
4. Bot receives the update, extracts `user_uuid` from the start parameter
5. Bot sends confirmation message: "Connected! You'll receive notifications here."
6. Bot saves `chat_id` to `user_notification_channels` table
7. CMS polls or receives webhook, updates UI to show "Connected" with a green checkmark

**Telegram message format (Story ready):**

- Story image sent as a photo attachment (Telegram Bot `sendPhoto`)
- Caption: "Story ready! Paste this link sticker URL:" followed by the short URL on its own line (tap-to-copy)
- Inline keyboard button: "Open in CMS" linking to the Ready to Post page

### 5.7 "Ready to Post" Page (`/cms/social/posts/[id]/ready`)

A focused, single-purpose page designed for mobile use (the user will likely be on their phone when posting to Instagram).

**Layout:**
- Full-bleed Story preview (the generated 1080x1920 image, scaled to viewport)
- Short URL displayed prominently with a copy button (copies to clipboard with haptic feedback on mobile)
- Three numbered steps:
  1. "Open Instagram and create a new Story"
  2. "Upload the image from your gallery" (the notification already delivered it)
  3. "Add a Link Sticker and paste the URL"
- "Mark as Posted" button at the bottom (updates `social_posts.status` to `published`, records `published_at`)

The page is accessible without full CMS navigation chrome to minimize friction.

### 5.8 Multi-Story Support

Up to 10 slides per story batch. Each slide is a separate Instagram API call following the container/publish pattern:

```
For N slides (max 10):
  1. POST /{ig-user-id}/media  (create container for slide 1)
  2. POST /{ig-user-id}/media  (create container for slide 2)
  ...
  N. POST /{ig-user-id}/media  (create container for slide N)
  N+1..2N. POST /{ig-user-id}/media_publish (publish each container)
```

For 3 slides this means 6 API calls total. The system checks remaining rate limit budget before starting a batch and rejects if insufficient (requires `2 * N` calls available within the 100/24h window).

### 5.9 Video Stories

Supported formats: MP4, MOV. Constraints: up to 60 seconds, max 8MB, 9:16 aspect ratio.

For videos longer than 60 seconds, the system offers auto-segmentation:
- Detect total duration via `ffprobe` (or browser `video.duration` for client-side preview)
- Propose cut points at 60s intervals with a preview UI showing each segment's start/end frame
- User can drag cut points to adjust (snaps to nearest keyframe when possible)
- Each segment becomes a separate story slide (uses multi-story flow above)

---

## 6. Platform-Specific Flows & Post Lifecycle

### 6.1 Platform Matrix

| Platform | Post Types | Caption Limit | Edit | Delete | Auth Method |
|----------|-----------|---------------|------|--------|-------------|
| Facebook | link_share, video_share | 63,206 chars | Caption only | Yes | Pages API (long-lived page token) |
| Bluesky | text + link card | 300 chars | Caption only | Yes | AT Protocol (lazy JWT refresh) |
| Instagram | Stories, Feed (1:1), Reels (3-90s video) | 2,200 chars | No | Yes | Graph API (long-lived token) |
| YouTube | Community posts (text + image), Thumbnails (16:9) | 5,000 chars | No | No | YouTube Data API v3 (OAuth2) |

### 6.2 Facebook

Auto-post via Pages API. Two share types based on content:

- **link_share:** For blog posts, newsletters, and campaigns. Posts the URL as the message attachment; Facebook auto-renders the OG card (title, description, image).
- **video_share:** For video content. Uploads video file directly, caption in the description field.

Caption is composed from the post template (customizable per site). Editing published posts is supported for caption text only (no media swap). Delete calls `DELETE /{post-id}`.

### 6.3 Bluesky

Text post with auto-embedded link card. The 300-character limit applies to the text body only (the link card is a separate embed and does not count toward the limit).

**Authentication:** Lazy refresh strategy. The system stores the JWT and its expiry timestamp. Before any API call, it checks if the token expires within the next 5 minutes. If so, it refreshes using the stored refresh token. This avoids unnecessary refresh calls while preventing mid-publish token expiry.

**Publish flow:**
1. Fetch OG tags from the target URL (title, description, og:image)
2. Download the `og:image` to a buffer
3. Upload image via `com.atproto.repo.uploadBlob` (returns a blob ref)
4. Create post via `com.atproto.repo.createRecord` with `app.bsky.embed.external` containing the URL, title, description, and blob ref thumbnail

**Delete:** `com.atproto.repo.deleteRecord` using the AT URI stored at publish time in `social_posts.platform_post_id`.

No image template generation needed; Bluesky renders its own link card from OG tags.

### 6.4 Instagram

Three content types, each with distinct constraints:

- **Stories:** Quick Mode (auto-post) or Design Mode (notification workflow). See Section 5 for full details.
- **Feed posts:** Square 1:1 images. The template system auto-crops/pads cover images to 1080x1080. Published via `media_type='IMAGE'`.
- **Reels:** Video content, 3-90 seconds, 9:16 aspect ratio. Published via `media_type='REELS'`.

Caption supports up to 2,200 characters. **No post editing is supported by the Instagram Graph API.** The CMS displays a "Does not support editing" badge on published Instagram posts. Delete is supported via `DELETE /{ig-media-id}`.

### 6.5 YouTube

Two integration points:

- **Community posts:** Text + optional image via YouTube Data API v3. Limited to channels that have the Community tab enabled (typically channels with 500+ subscribers). Published via `activities.insert` or the community post endpoint.
- **Thumbnail editing:** The existing template system renders 16:9 (1280x720) thumbnails. Users can generate thumbnails from templates, then upload via `thumbnails.set` for a specific video ID.

### 6.6 Auto-Share Flow

After any content is published (blog post, newsletter edition, campaign, video), a post-publish dialog appears:

```
┌─────────────────────────────────────────┐
│  Share to Social                        │
│                                         │
│  [x] Facebook    [x] Instagram Stories  │
│  [x] Bluesky    [ ] Instagram Feed      │
│                                         │
│  Caption preview:                       │
│  ┌─────────────────────────────────┐    │
│  │ New post: "Title Here"          │    │
│  │ Read more: go.domain.com/abc    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Share Now]  [Customize]  [Skip]       │
└─────────────────────────────────────────┘
```

- **Platform checkboxes** pre-checked from site defaults (Settings > Social > Default Platforms)
- **Caption preview** is editable inline, truncated per platform limits with character count
- **"Share Now"** publishes to all checked platforms in one click
- **"Customize in Composer"** opens the full Composer with content pre-filled
- **"Skip"** dismisses without posting

**Zero-friction mode:** Site setting `auto_share_on_publish` (boolean per platform). When enabled, the dialog is skipped entirely and posts are created automatically on publish. A toast confirms: "Shared to Facebook, Bluesky" with an "Undo" action (30s window, cancels pending jobs).

### 6.7 Schedule Calendar Integration

Social posts appear on the unified `/cms/schedule` calendar as **indigo pills** (distinct from blog = blue, newsletter = green, campaign = amber). Each pill shows the platform icon and a truncated caption.

Clicking a social post pill opens a slide-over panel with:
- Read-only preview of the post (rendered caption + media thumbnail)
- Platform badge and scheduled time
- "Edit in Composer" button (navigates to `/cms/social/composer?post={id}`)
- "Remove from Schedule" with confirmation

### 6.8 Duplicate Detection

The Composer checks for existing social posts linked to the same content:

- **Same content, any platform:** Warning banner: "This content already has 1 active social post" with a link to view the existing post(s).
- **Same content, same platform:** Confirmation dialog: "A Facebook post for this content was already published on May 15. Create another?" Requires explicit confirmation.
- **Same content, different platform:** Allowed without confirmation (cross-posting is the normal use case).

Detection is based on `social_posts.source_type` + `social_posts.source_id` + `social_posts.platform` with a query at Composer load time.

### 6.9 Queue (Fila)

FIFO auto-scheduling with configurable time slots. Instead of picking a specific date/time, the user clicks "Add to Queue" and the system assigns the next available slot.

**Configuration** (Settings > Social > Horarios):
- Define recurring time slots per day of week (e.g., Tuesday 10:00, Thursday 10:00, Saturday 14:00)
- Separate slot configurations per platform (optional; defaults to shared slots)
- Holiday/blackout dates (optional)

**Queue behavior:**
- "Add to Queue" button in the Composer shows the next available slot before confirming
- Posts are assigned slots in FIFO order
- If a slot is manually occupied (a post was scheduled to that exact time), the queue skips to the next slot
- Queue view (`/cms/social/queue`) shows upcoming posts in order with drag-to-reorder

### 6.10 Analytics MVP

Lightweight engagement tracking with cron-based polling. No real-time analytics in v1.

**Posts list view:** Each row shows a summary line: "47 engagements . 12 link clicks" (engagements = likes + comments + shares aggregated across platforms).

**Detail modal:** Breaks down metrics per platform with the last-fetched timestamp:
- Facebook: reactions, comments, shares, link clicks
- Instagram: impressions, reach, replies (stories), likes (feed/reels)
- Bluesky: likes, reposts, replies
- YouTube: likes, comments (community posts)

**Polling schedule:**
- Posts less than 7 days old: every 6 hours
- Stories less than 48 hours old: every 2 hours (stories expire at 24h but insights available for 48h)
- Posts older than 7 days: no further polling (final snapshot stored)

**Storage:** `post_metrics` table with one row per poll, preserving the time series. The latest row per post/platform is used for display. Old rows can be pruned after 90 days (keeping first, last, and daily snapshots).

### 6.11 Post Editing

Editing rules enforced at the Composer level:

| Platform | Editable Fields | Behavior |
|----------|----------------|----------|
| Facebook | Caption text | `POST /{post-id}` with updated `message` field |
| Bluesky | Caption text | Delete old record + create new record (AT Protocol has no edit endpoint) |
| Instagram | None | Read-only view with "Instagram does not support editing" badge |
| YouTube | None | Read-only in v1 |

**Critical rule:** Editing never re-generates the template image or swaps media. Only the caption/text is updated. If the user needs a different image, they must delete and create a new post.

For Bluesky "edit" (delete + recreate): the system warns that this resets engagement metrics and requires confirmation.

### 6.12 Post Status & Error Handling

The Composer shows an inline status banner after publish attempts:

```
┌────────────────────────────────────────────┐
│  OK Facebook    OK Bluesky    X Instagram  │
│                              [Retry]       │
└────────────────────────────────────────────┘
```

- **Per-platform status:** Checkmark for success, X for failure, spinner for in-progress
- **Retry button:** Per failed platform. Re-attempts the publish with the same parameters.
- **Token errors:** "Reconnect" link replaces the retry button when the failure is an auth/token issue. Links to Settings > Social > Connections for re-authorization.
- **Posts list:** The `/cms/social/posts` list shows status badges (published, scheduled, failed, draft) with filter tabs. Failed posts are surfaced prominently with a red badge and retry action.

The `social_deliveries` table tracks per-platform delivery status with `last_error` (text) and `error_type` (permanent/transient/auth) for debugging. The parent `social_posts.status` reflects the aggregate outcome across all deliveries. State transitions are enforced at the action level to prevent invalid moves (e.g., completed cannot go back to draft).

---

## 7. Canvas Editor & Media Integration

### Architecture

The Canvas Editor reuses approximately 90% of the QR Card Builder (`packages/links-admin/src/components/qr-card-builder/`). Same rendering engine (`react-konva`), same composition hooks (`useCardComposition`, `useCanvasInteraction`), same data model (`CardComposition` JSON with an `elements` array, max 20 elements per canvas).

**Key differences from QR Card Builder:**

| Aspect | QR Card Builder | Social Canvas Editor |
|--------|----------------|---------------------|
| Aspect ratio | Free-form, user-defined | Fixed per template type (`9:16`, `1:1`, `16:9`) |
| Templates | Generic card layouts | Story/post-specific, organized by category |
| Content population | Manual only | Auto-populate from CMS content fields |
| Output destination | Download / print | Publish integration via social delivery pipeline |

### Three-Panel Layout

```
┌──────────────┬──────────────────────────┬──────────────┐
│   TOOLS &    │                          │  INSPECTOR   │
│  TEMPLATES   │     KONVA CANVAS         │              │
│              │                          │  Properties  │
│  Text        │  ┌──────────────────┐    │  Font        │
│  Image       │  │                  │    │  Color       │
│  QR Code     │  │   Live Preview   │    │  Position    │
│  Shape       │  │                  │    │  Size        │
│              │  │   snap guides    │    │  Background  │
│  ──────────  │  │   grid overlay   │    │  presets     │
│  Template    │  └──────────────────┘    │              │
│  Gallery     │                          │              │
│  (by category)│  selection + resize     │              │
│              │  handles                 │              │
└──────────────┴──────────────────────────┴──────────────┘
```

- **Left panel:** Element tools (text, image, QR, shape) and template gallery organized by category (e.g., blog announcement, video promo, quote card).
- **Center panel:** Konva canvas with selection, resize handles, snap guides, and grid toggle.
- **Right panel:** Inspector showing properties for selected element -- font, color, position, size, and background presets.

### Keyboard Shortcuts

Inherited from the QR builder without modification:

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo |
| `Delete` / `Backspace` | Delete selected element |
| `Ctrl+D` | Duplicate selected |
| `Ctrl+L` | Lock/unlock element |
| `Ctrl+]` / `Ctrl+[` | Bring forward / Send backward |
| `Arrow keys` | Nudge 1px (hold Shift for 10px) |

### Smart Snapping

- 5px activation threshold.
- Center-to-center alignment between elements.
- Edge-to-edge alignment between elements.
- Canvas-center horizontal and vertical guides.
- Visual guide lines rendered as dashed blue lines during drag.

### Media Gallery Integration

The "Images" button in the left tools sidebar opens the existing `MediaGalleryDialog` as a modal. On selection:

1. Creates a `KonvaImage` element at canvas center.
2. Scales the image to fit within the canvas bounds while preserving aspect ratio.
3. Direct upload from the editor uses the existing `uploadMediaAsset()` function.
4. The `{{cover_image}}` placeholder in templates resolves at template application time by pulling the post's `cover_image` URL from CMS content.

### Image Element Properties

```typescript
interface CanvasImageElement {
  src: string;
  mediaId: string | null;       // FK to media library
  objectFit: 'cover' | 'contain' | 'fill';
  cornerRadius: number;         // 0 = square
  opacity: number;              // 0-1
  cropRect: { x: number; y: number; width: number; height: number } | null;
  filters: ('grayscale' | 'brightness' | 'blur')[];
  filterValues: {
    grayscale?: number;          // 0-1
    brightness?: number;         // -1 to 1
    blur?: number;               // 0-20px
  };
  locked: boolean;
}
```

### Export

**Client-side (full editor):** `stage.toBlob({ pixelRatio })` at 1x, 2x, or 3x resolution. The resulting PNG is uploaded to Vercel Blob at `stories/{post.id}-{timestamp}.png`.

**Server-side Quick Mode:** Uses `konva` + `canvas` (node-canvas) on Node.js. No Puppeteer dependency.

1. `registerFont()` for any custom fonts used in the template.
2. Load template JSON from `social_templates.composition`.
3. Hydrate placeholders with content data (`{{title}}`, `{{cover_image}}`, `{{author_name}}`, etc.).
4. Render via `stage.toBuffer('image/png')`.
5. Target render time: under 1 second.

This enables the pipeline to auto-generate images for scheduled posts without opening the editor.

---

## 8. Database Schema & Migration

All migrations follow the project's idempotent pattern: `DROP ... IF EXISTS` before `CREATE`. Created via `npm run db:new`.

### New Tables

#### `social_templates`

Stores reusable canvas compositions for social media content generation.

```sql
CREATE TABLE IF NOT EXISTS social_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       uuid REFERENCES sites(id) ON DELETE CASCADE,  -- NULL = global default
  name          text NOT NULL,
  aspect_ratio  text NOT NULL CHECK (aspect_ratio IN ('9:16', '1:1', '16:9')),
  composition   jsonb NOT NULL,         -- CardComposition JSON
  thumbnail_url text,
  is_default    boolean DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

RLS: Site-scoped read via `site_visible(site_id)` for rows with non-null `site_id`; global defaults (`site_id IS NULL`) readable by all authenticated users. Staff write via `is_staff()`.

#### `post_metrics`

Stores platform-specific engagement metrics fetched periodically.

```sql
CREATE TABLE IF NOT EXISTS post_metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  platform    text NOT NULL,
  fetched_at  timestamptz NOT NULL,
  data        jsonb NOT NULL,           -- platform-specific metrics blob
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT uq_post_metrics_snapshot UNIQUE (post_id, platform, fetched_at)
);
```

#### `link_in_bio_entries`

Manages the ordered set of links displayed on the Link-in-Bio page.

```sql
CREATE TABLE IF NOT EXISTS link_in_bio_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  link_id     uuid NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);
```

Max 20 entries per site, enforced by an auto-prune trigger that removes the oldest entry when inserting beyond the limit.

### Altered Tables

#### `social_posts`

```sql
-- caption variable system (Section 2)
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS caption_template text,
  ADD COLUMN IF NOT EXISTS caption_overrides jsonb DEFAULT '{}';

-- template + link-in-bio tracking
-- NOTE: template_id already exists as TEXT; migrate to UUID FK
ALTER TABLE social_posts
  ALTER COLUMN template_id TYPE uuid USING template_id::uuid,
  ADD CONSTRAINT fk_social_posts_template
    FOREIGN KEY (template_id) REFERENCES social_templates(id) ON DELETE SET NULL;

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS link_in_bio_updated boolean DEFAULT false;

-- add 'queued' status for Fila (Section 6.9)
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_status_check;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_status_check
  CHECK (status IN ('draft', 'queued', 'scheduled', 'publishing', 'completed', 'partial_failure', 'failed', 'cancelled'));
```

#### `social_deliveries`

```sql
ALTER TABLE social_deliveries
  ADD COLUMN IF NOT EXISTS format text
    CHECK (format IN ('link_share', 'image_post', 'story', 'reel', 'link_card', 'video_share'));
```

#### `sites`

```sql
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS social_defaults jsonb DEFAULT '{}';
```

The `social_defaults` JSONB stores content-type-to-platform template mappings, e.g.:

```json
{
  "blog:instagram_story": "template-uuid-1",
  "blog:facebook_post": "template-uuid-2",
  "video:instagram_story": "template-uuid-3"
}
```

#### `social_connections`

```sql
ALTER TABLE social_connections
  ADD COLUMN IF NOT EXISTS bluesky_did text,
  ADD COLUMN IF NOT EXISTS bluesky_access_jwt_enc text,
  ADD COLUMN IF NOT EXISTS bluesky_refresh_jwt_enc text,
  ADD COLUMN IF NOT EXISTS bluesky_jwt_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS rate_window_start timestamptz,
  ADD COLUMN IF NOT EXISTS rate_window_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS circuit_open_until timestamptz;
```

### Pipeline Step Rename

Rename the `og_scrape` value to `platform_prepare` in the `social_posts.pipeline_steps` JSONB array (note: pipeline steps are stored in `social_posts.pipeline_steps`, NOT as a column on `social_deliveries`):

```sql
-- Update existing JSONB pipeline_steps arrays
UPDATE social_posts
SET pipeline_steps = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'name' = 'og_scrape'
      THEN jsonb_set(elem, '{name}', '"platform_prepare"')
      ELSE elem
    END
  )
  FROM jsonb_array_elements(pipeline_steps) AS elem
)
WHERE pipeline_steps::text LIKE '%og_scrape%';

-- Update the RPC validation function
CREATE OR REPLACE FUNCTION update_pipeline_step(...)
  -- Validate step_name IN ('post_created', 'short_link', 'platform_prepare', 'deliver')
```

> **Note:** `social_deliveries` has NO `step` column. The `status` column on `social_deliveries` tracks delivery state (`pending`/`publishing`/`published`/`failed`/`retrying`/`skipped`). Pipeline progress is tracked in `social_posts.pipeline_steps` JSONB.

### Seed Data

9 default templates seeded with `is_default = true` and `site_id = NULL` (global):

| Name | Aspect Ratio | Description |
|------|-------------|-------------|
| `blog-announce-story` | 9:16 | Blog post announcement for Stories |
| `quote-card-story` | 9:16 | Pull-quote overlay on gradient background |
| `video-promo-story` | 9:16 | YouTube video thumbnail with play button overlay |
| `blog-announce-square` | 1:1 | Blog post card for feed posts |
| `quote-card-square` | 1:1 | Centered quote with author attribution |
| `video-promo-square` | 1:1 | Video thumbnail with title and channel branding |
| `blog-announce-landscape` | 16:9 | Blog post banner for Facebook/Bluesky |
| `quote-card-landscape` | 16:9 | Wide quote card for Twitter/Bluesky |
| `video-promo-landscape` | 16:9 | YouTube-style thumbnail with text overlay |

Each template ships with a `composition` JSONB containing placeholder elements (`{{title}}`, `{{cover_image}}`, `{{author_name}}`, `{{excerpt}}`) that hydrate at application time.

> **Bluesky JWT encryption:** `bluesky_access_jwt_enc` and `bluesky_refresh_jwt_enc` are encrypted at rest using the same `encrypt()`/`decrypt()` envelope as other provider tokens (`access_token_enc`, `refresh_token_enc`). Never store JWTs in plaintext.

> **CardComposition schema:** Defined in `@tn-figueiredo/links/qr` (exported as `CardCompositionSchema` Zod validator and `CardComposition` TypeScript type). Structure: `{ version: 1, canvas: { width, height }, background: { type, color/stops/angle }, elements: Array<TextElement | ImageElement | QrElement> }`. Each element has `x, y, width, height, rotation, opacity` plus type-specific properties. The same schema drives both the QR Card Builder and the Social Template system.

> **Caption vs template variables:** Caption variables (`{{link}}`, `{{title}}`, `{{url}}`) are resolved at **publish time** in the caption text. Template placeholders (`{{title}}`, `{{short_url}}`, `{{cover_image}}`, `{{logo}}`, `{{description}}`) are resolved at **template render time** for the visual image. `{{link}}` (caption) and `{{short_url}}` (template) both resolve to the tracked short URL but operate in different contexts.

> **Konva server-side deployment:** Server-side Konva uses the `canvas` npm package (node-canvas) which ships prebuilt binaries for linux-x64 (Vercel Functions runtime). The `canvas` package must be added to `apps/web/package.json` as a production dependency. No native build step required.

---

## 9. UI States

Every async boundary requires three states. Components MUST handle:

**Loading:** Skeleton/spinner while data loads.
- OG sidebar: shimmer placeholder while scraping
- Template carousel: skeleton cards while loading templates
- Confirmation dialog: disabled "Publicar" button + spinner during fan-out
- Canvas editor: loading overlay while exporting

**Empty:** Zero-data guidance.
- Template library (no custom templates): "Create your first template" CTA
- Queue (no scheduled posts): "No posts in queue" with link to Composer
- Post metrics (no data yet): "Metrics will appear after first poll"
- Link-in-Bio (no entries): "No stories shared yet" message

**Error:** Actionable error display.
- OG scrape failure: "Could not load preview" with Retry button
- Template render failure: fallback to @vercel/og generator, show warning toast
- Publish failure: per-platform error badges in confirmation dialog
- Telegram connection failure: "Could not connect" with retry link

---

## 10. Accessibility

- **Canvas editor** (react-konva): inherently not screen-reader accessible. Provide keyboard shortcuts overlay and ensure toolbar/inspector panels are fully keyboard-navigable with proper ARIA labels.
- **Template carousel:** Horizontal scroll with keyboard arrow navigation. Each template card has `role="option"` with `aria-selected`.
- **OG preview sidebar:** Tab panels use `role="tablist"` / `role="tab"` / `role="tabpanel"` pattern.
- **Confirmation dialog:** Focus trap with `aria-modal="true"`, Escape to close, auto-focus on primary action.

---

## 11. Resilience

**Circuit breaker:** After 3 consecutive failures to the same platform connection within a 30-minute window, the system sets `circuit_open_until` on `social_connections` and skips deliveries to that connection until the cooldown expires. The CMS shows a "Platform temporarily unavailable — retrying at HH:MM" banner. This prevents burning rate limits and compute on known-broken connections. The circuit resets automatically when the cooldown expires, or manually via the "Retry Now" button.

---

## Non-Goals & Deferred Items

The following are explicitly out of scope for v1 and will not be implemented in Sprint 5h.

| Item | Reason | Target |
|------|--------|--------|
| **Evergreen re-share** (periodic auto-repost of top-performing content) | Requires engagement history and decay algorithms | v2 |
| **Bilingual automation** (auto-generate EN captions from PT content) | Needs LLM integration and translation review workflow | v2 |
| **Smart Schedule heatmap** (optimal posting times based on engagement) | Requires 30+ days of engagement data to be statistically meaningful | v2 |
| **Queue pause/resume toggle** | Low priority; manual control via individual post scheduling suffices for v1 | v2 |
| **Canvas editor mobile responsiveness** | Desktop-first tool; mobile editing adds significant complexity for minimal gain | Deferred |
| **Instagram Highlights management** | Not supported by Meta's Graph API | Blocked |
| **Link stickers via API** | Not supported by Meta's Content Publishing API; workaround is the notification-based flow (user manually adds sticker after receiving push notification) | Blocked |
| **Private/unofficial Instagram API** (e.g., Storrito-style browser automation) | Rejected — violates Instagram Terms of Service, risks account suspension | Won't do |
