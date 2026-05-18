# Social Composer v6.1 — Instagram Stories Redesign

**Status:** Final
**Date:** 2026-05-18
**Author:** Thiago Figueiredo
**Sprint:** 5h (Social Hub)
**Supersedes:** Section 5 of `2026-05-17-social-composer-stories-templates-design.md`
**Score:** 102/110

---

## 1. Problem Statement

The Social Composer v6 spec designed Instagram Stories as an afterthought — a single-image auto-post with a generic timeline UI. Three critical gaps:

1. **No Story-first UX.** When Instagram is selected, the Composer shows a generic caption + 1:1 preview. Stories (9:16) should be the primary Instagram format, not feed posts.
2. **No multi-slide support.** Instagram Stories are sequences of 1-10 slides. The current pipeline renders exactly 1 image via `prepareStoryDelivery()`.
3. **No entry points.** Creating a Story requires navigating to the Composer, selecting Instagram, and manually configuring everything. No shortcut from the blog editor where content originates.

### What This Spec Changes

This spec replaces Section 5 (Instagram Stories & Notification System) of the v6 spec and adds:

- **Stories Gallery** — dedicated entry point with draft/live/expired views
- **Multi-slide editor** — drag-drop reorder, per-slide layers, duplicate/delete
- **Auto-generation from CMS** — language selector, slide count, content type templates
- **1-click "Criar Story" from blog editor** — 7 steps → 2
- **Per-slide insights** — honestly labeled as "Reach per Slide"
- **Fan scoring** — cross-platform superfan detection via Links Engine
- **Cron-based scheduling** — honest about Instagram API not supporting story scheduling
- **SocialCanvasEditor integration** — 3 new props + ref forwarding

Sections not covered here (Caption Variables, OG Preview, Template Library, Platform Matrix, Queue, etc.) remain as defined in the v6 spec.

---

## 2. Architecture Overview

```
                    ENTRY POINTS
    ┌────────────────────┬─────────────────────┐
    │  Blog Editor       │  Stories Gallery     │
    │  "Criar Story" btn │  /cms/social/stories │
    │  (1-click)         │  (drafts/live/expired)│
    └────────┬───────────┴──────────┬───────────┘
             │                      │
             ▼                      ▼
    ┌─────────────────────────────────────────┐
    │         STORY COMPOSER                   │
    │                                          │
    │  ┌──────────┐  ┌───────────────────────┐│
    │  │ Auto-Gen │  │  Multi-Slide Editor   ││
    │  │ (from    │  │  (SocialCanvasEditor  ││
    │  │  CMS)    │──│   + slide strip)      ││
    │  └──────────┘  └───────────┬───────────┘│
    │                            │             │
    │  ┌─────────────────────────┴───────────┐│
    │  │  Preview & Publish                   ││
    │  │  Phone preview · per-slide progress  ││
    │  │  Schedule (via cron) · Publish now   ││
    │  └──────────────────────────────────────┘│
    └──────────────────┬───────────────────────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
         ┌────────┐ ┌──────┐ ┌──────────┐
         │IG API  │ │Notify│ │ Cron     │
         │(biz)   │ │(pers)│ │(schedule)│
         └────────┘ └──────┘ └──────────┘
```

### Dual Account Paths

| Aspect | Business Account | Personal Account |
|--------|-----------------|------------------|
| **Publish** | Auto-post via IG Graph API `media_type='STORIES'` | Telegram/Push notification with image |
| **Multi-slide** | Sequential container create → publish (2N API calls) | All slides sent as album in notification |
| **Scheduling** | Cron-based: pre-render slides, publish at `scheduled_at` | Cron-based: send notification at `scheduled_at` |
| **Metrics** | IG Insights API polling (reach, impressions, replies) | Manual "Mark as Posted" only |

Detection: `social_connections.account_type = 'business' | 'personal'`. This column must be added via migration (see §19). Set during OAuth connection based on the Graph API `instagram_business_account` field presence. Personal accounts can upgrade — the CMS shows a one-time banner explaining the benefits.

---

## 3. Data Model Changes

### 3.1 `social_posts` — New Column

```sql
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS story_slides jsonb DEFAULT NULL;
-- story_slides: Array of CardComposition objects, max 10
-- NULL = single-image post (backward compatible)
-- Example: [{ version: 1, canvas: {...}, background: {...}, elements: [...] }, ...]

ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS source_locale text DEFAULT NULL;
-- source_locale: e.g. 'pt-BR', 'en'. Which locale of the source content was used
-- for auto-generation. NULL if created from scratch.
```

### 3.2 `social_templates` — New Column

```sql
ALTER TABLE social_templates
  ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT NULL;
-- slides: Array of CardComposition objects for multi-slide templates
-- NULL = single-slide template (backward compatible)
-- When slides IS NOT NULL, composition stores slide 0 (cover)
```

### 3.3 `post_metrics` — New Column

```sql
ALTER TABLE post_metrics
  ADD COLUMN IF NOT EXISTS slide_index integer DEFAULT NULL;
-- slide_index: 0-based index for per-slide metrics
-- NULL = aggregate metrics for the entire post
```

### 3.4 `fan_interactions` — New Table

```sql
CREATE TABLE IF NOT EXISTS fan_interactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL,
  -- SHA-256(ip|ua|date) from Links Engine, daily-rotating
  platform     text NOT NULL,
  -- 'instagram', 'facebook', 'bluesky', 'link_click', 'newsletter'
  interaction_type text NOT NULL,
  -- 'story_view', 'story_reply', 'like', 'comment', 'share', 'link_click', 'subscribe'
  post_id      uuid REFERENCES social_posts(id) ON DELETE SET NULL,
  link_id      uuid REFERENCES tracked_links(id) ON DELETE SET NULL,
  raw          jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_fan_interactions_visitor
  ON fan_interactions (site_id, visitor_hash, created_at DESC);

CREATE INDEX idx_fan_interactions_platform
  ON fan_interactions (site_id, platform, created_at DESC);
```

### 3.5 `fan_scores` — Materialized View

```sql
CREATE MATERIALIZED VIEW fan_scores AS
SELECT
  site_id,
  visitor_hash,
  COUNT(*) AS total_interactions,
  COUNT(DISTINCT platform) AS platform_count,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen,
  -- Superfan score: frequency × recency × cross-platform × consistency
  (
    LEAST(COUNT(*), 50) / 50.0 * 25 +                          -- frequency (max 25)
    CASE WHEN MAX(created_at) > NOW() - INTERVAL '7 days'
      THEN 25 ELSE GREATEST(0, 25 - EXTRACT(DAY FROM NOW() - MAX(created_at))) END + -- recency (max 25)
    LEAST(COUNT(DISTINCT platform), 4) / 4.0 * 25 +            -- cross-platform (max 25)
    LEAST(COUNT(DISTINCT DATE(created_at)), 30) / 30.0 * 25    -- consistency (max 25)
  ) AS score
FROM fan_interactions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY site_id, visitor_hash;

CREATE UNIQUE INDEX idx_fan_scores_pk ON fan_scores (site_id, visitor_hash);
```

Refresh schedule: daily via cron (`REFRESH MATERIALIZED VIEW CONCURRENTLY fan_scores`).

---

## 4. Stories Gallery — Entry Point

**Route:** `/cms/social/stories`

### 4.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  Instagram Stories                    [+ Nova Story]  │
│                                                       │
│  [Rascunhos (3)]  [Ao Vivo (1)]  [Expirados]  [Agendados] │
│                                                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │ ░░░░░░░ │ │         │   │
│  │ ░story░ │ │ ░story░ │ │ ░story░ │ │  + New  │   │
│  │ ░░░░░░░ │ │ ░░░░░░░ │ │ ░░░░░░░ │ │  Story  │   │
│  │         │ │         │ │         │ │         │   │
│  │ "Blog:" │ │ "Quote" │ │ "News"  │ │         │   │
│  │ 3 slides│ │ 1 slide │ │ 5 slides│ │         │   │
│  │ Draft   │ │ Draft   │ │ Draft   │ │         │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
└──────────────────────────────────────────────────────┘
```

### 4.2 Tab Filters

| Tab | Filter | Badge |
|-----|--------|-------|
| **Rascunhos** | `status = 'draft'` | Count |
| **Ao Vivo** | `status = 'completed' AND published_at > NOW() - INTERVAL '24 hours'` | Count |
| **Expirados** | `status = 'completed' AND published_at <= NOW() - INTERVAL '24 hours'` | — |
| **Agendados** | `status = 'scheduled'` | Count |

### 4.3 Story Card

Each card shows:
- 9:16 thumbnail (first slide)
- Slide count badge (e.g., "3 slides")
- Source label if from CMS (e.g., "Blog: Title...")
- Status badge (Draft / Live / Expired / Scheduled with datetime)
- Overflow menu: Edit, Duplicate, Delete, View Insights (if published)

### 4.4 "+ Nova Story" Options

Clicking the button or the empty card shows a dropdown:

| Option | Action |
|--------|--------|
| **Do CMS** | Opens content picker (blog posts, newsletters, campaigns) → auto-gen flow |
| **Do Zero** | Opens empty editor with template picker |
| **De Template** | Opens template gallery filtered to 9:16 |

---

## 5. Auto-Generation from CMS Content

### 5.1 Content Picker

When "Do CMS" is selected, a modal lists available content:

```
┌──────────────────────────────────────────┐
│  Selecionar Conteúdo                      │
│                                           │
│  [Blog Posts]  [Newsletters]  [Campanhas] │
│                                           │
│  🔍 Buscar...                             │
│                                           │
│  ┌────────────────────────────────────┐   │
│  │ 📝 I Learned a Language in 30 Days │   │
│  │    Publicado 15 Mai · PT-BR, EN    │   │
│  └────────────────────────────────────┘   │
│  ┌────────────────────────────────────┐   │
│  │ 📝 OAuth 2.0 Guide                │   │
│  │    Publicado 12 Mai · PT-BR        │   │
│  └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### 5.2 Generation Options

After content selection:

```
┌──────────────────────────────────────────┐
│  Gerar Story                              │
│                                           │
│  Conteúdo: "I Learned a Language..."      │
│                                           │
│  Idioma:  [PT-BR ▼]  [EN]                │
│  (available locales from source content)   │
│                                           │
│  Slides:  [1]  [3 ✓]  [5]                │
│                                           │
│  Template: [Gradient ✓] [Overlay] [Bold]  │
│                                           │
│  [Gerar e Editar]                         │
└──────────────────────────────────────────┘
```

### 5.3 Slide Generation Logic

| Slide Count | Content Distribution |
|------------|---------------------|
| **1 slide** | Title + cover image + "Swipe up" CTA + logo |
| **3 slides** | Slide 1: Title + cover BG. Slide 2: Key excerpt. Slide 3: CTA + short URL + logo |
| **5 slides** | Slide 1: Title + cover BG. Slides 2-4: 3 key points from excerpt. Slide 5: CTA + short URL + logo |

Content extraction:
- `title` → from blog post title (in selected locale)
- `excerpt` → from `meta_description` or first 160 chars of content
- `cover_image` → from `cover_image_url` (rendered as background, not grey stub)
- `short_url` → generated at publish time, shows `go.domain.com/______` placeholder
- `logo` → from `sites.logo_url`

### 5.4 Language Selector

The selector shows only locales that exist for the selected content. If a blog post has `['pt-BR', 'en']` in its translations, both appear. Single-locale content hides the selector entirely.

Selected locale determines which title/excerpt is pulled. The `source_locale` column on `social_posts` records which locale was used.

### 5.5 Content Type Templates (Beyond Blog)

| Type | Template | Slide Content |
|------|----------|---------------|
| **Quote** | Single slide, large centered text, gradient BG | Quote text + author attribution |
| **Announcement** | 1-2 slides, bold title, accent gradient | Headline + details + CTA |
| **Carousel/Tutorial** | 3-5 slides, numbered steps, consistent style | Step-by-step with numbering dots |
| **Newsletter promo** | 2 slides, edition info + subscribe CTA | Edition title + "Assine" button |
| **Link promo** | 1 slide, destination preview + short URL | URL preview + QR code option |

---

## 6. Multi-Slide Editor

### 6.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│  ┌──────┐  ┌──────────────────────┐  ┌──────────────┐   │
│  │TOOLS │  │                      │  │  INSPECTOR   │   │
│  │      │  │   KONVA CANVAS       │  │              │   │
│  │ Text │  │   (active slide)     │  │  Font/Color  │   │
│  │ Image│  │                      │  │  Position    │   │
│  │ Shape│  │                      │  │  Background  │   │
│  │ QR   │  │                      │  │              │   │
│  │──────│  │                      │  │──────────────│   │
│  │CMS   │  │                      │  │  CMS Data    │   │
│  │Data  │  │                      │  │  {{title}}   │   │
│  │ tab  │  └──────────────────────┘  │  {{excerpt}} │   │
│  └──────┘                            │  {{cover}}   │   │
│                                      │  {{logo}}    │   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  SLIDE STRIP (horizontal, drag-to-reorder)       │   │
│  │  [S1 ✓] [S2 ✓] [S3 ●] [S4] [S5] ... [+Add]     │   │
│  │  ↕ drag   📋dup  🗑del                           │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Slide Strip

- **Max 10 slides** (Instagram limit)
- **Drag-to-reorder** via pointer events (no external DnD library)
- **Active slide** has blue ring, others are dimmed thumbnails
- **Context menu** on right-click: Duplicate, Delete, Move Left/Right
- **"+ Add Slide"** button at end (disabled at 10)
- **Per-slide status indicators**: checkmark (edited), dot (active), empty (untouched)

### 6.3 CMS Data Tab (Inspector Panel)

A new tab in the right inspector panel showing available CMS placeholder values:

```
┌──────────────────┐
│  CMS Data        │
│                  │
│  {{title}}       │
│  "I Learned..."  │
│  [Insert as Text]│
│                  │
│  {{excerpt}}     │
│  "In this post..." │
│  [Insert as Text]│
│                  │
│  {{cover_image}} │
│  [thumbnail]     │
│  [Insert as BG]  │
│  [Insert as Image]│
│                  │
│  {{logo}}        │
│  [thumbnail]     │
│  [Insert as Image]│
│                  │
│  {{short_url}}   │
│  go.btf.com/___  │
│  [Insert as Text]│
│  [Insert as QR]  │
└──────────────────┘
```

Each value has action buttons that insert the placeholder token into the current slide's composition. "Insert as BG" sets the background to an image background with `src: '{{cover_image}}'`. "Insert as Text" adds a text element with `content: '{{title}}'`. "Insert as QR" adds a QR element with `data: '{{short_url}}'`.

### 6.4 Keyboard Shortcuts (Extended)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo (per-slide) |
| `Delete` / `Backspace` | Delete selected element |
| `Ctrl+D` | Duplicate selected element |
| `Ctrl+L` | Lock/unlock element |
| `Ctrl+]` / `Ctrl+[` | Bring forward / Send backward |
| `Arrow keys` | Nudge 1px (Shift: 10px) |
| `PageUp` / `PageDown` | Previous / Next slide |
| `Ctrl+Shift+D` | Duplicate entire slide |

### 6.5 Auto-Save

Compositions auto-save to the `social_posts.story_slides` column every 30 seconds while editing. Uses debounced `updateSocialPost()` server action. Draft status preserved — no accidental publish.

### 6.6 Text Auto-Sizing

When a text element's content exceeds its bounding box:

1. Konva `measureText()` calculates rendered text dimensions
2. If text overflows, reduce `fontSize` by 2px increments until it fits
3. Minimum font size: 12px (below this, the text is too small to read on a phone)
4. If still overflows at 12px, truncate with ellipsis and show a yellow warning dot on the element

This runs on every text content change and on template application.

---

## 7. SocialCanvasEditor — Required Changes

### 7.1 Current Props (Existing)

```typescript
interface SocialCanvasEditorProps {
  aspectRatio: SocialAspectRatio
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  postData: SocialPostData
  onExport: (blob: Blob, metadata: ExportMetadata) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
}
```

### 7.2 New Props Required

```typescript
interface SocialCanvasEditorProps {
  // ... existing props ...

  // NEW: Load existing composition (for editing drafts or applying templates)
  initialComposition?: CardComposition

  // NEW: Notify parent of every composition change (for auto-save and multi-slide sync)
  onCompositionChange?: (composition: CardComposition) => void

  // NEW: Hide aspect ratio selector when parent controls it (Stories = always 9:16)
  hideAspectRatioSelector?: boolean
}
```

### 7.3 Ref Forwarding

The component must forward a ref with imperative methods:

```typescript
interface SocialCanvasEditorRef {
  getComposition: () => CardComposition
  replaceComposition: (composition: CardComposition) => void
  exportSlide: () => Promise<Blob>
}

const SocialCanvasEditor = forwardRef<SocialCanvasEditorRef, SocialCanvasEditorProps>(
  (props, ref) => {
    // expose via useImperativeHandle
  }
)
```

### 7.4 handleLoadTemplate Fix

Currently an empty stub (lines 182-184). Must:
1. Parse the template's `composition` JSONB
2. Call `replaceComposition()` from `useCardComposition` hook
3. Resolve placeholders against `postData` (replace `{{title}}` with actual title, etc.)
4. Trigger `onCompositionChange` callback

### 7.5 postData Wiring

Currently accepted but never used. Must:
1. Pass `postData` to placeholder resolution when loading templates
2. Make it available in the CMS Data tab for manual insertion
3. Update resolved values if `postData` changes (e.g., user edits title in another tab)

**Field name bridging:** `SocialPostData` uses camelCase (`coverImageUrl`, `logoUrl`, `shortUrl`), while `TemplateContext` and placeholder tokens use snake_case (`cover_image`, `logo`, `short_url`). The bridging function:

```typescript
function postDataToTemplateContext(data: SocialPostData): TemplateContext {
  return {
    title: data.title,
    description: data.description,
    cover_image: data.coverImageUrl,
    logo: data.logoUrl,
    short_url: data.shortUrl,
  }
}
```

This mapping is used both client-side (CMS Data tab) and server-side (Konva renderer).

---

## 8. Render Pipeline Changes

### 8.1 PNG → JPEG Conversion

**Current:** `canvas.toBuffer('image/png')` in `konva-renderer.ts:203` (called indirectly via `template-renderer.ts` from `workflows.ts`)
**Required:** `canvas.toBuffer('image/jpeg', { quality: 0.92 })`

> **Note:** `workflows.ts` → `prepareStoryDelivery()` calls `import('@/lib/social/template-renderer')`, which wraps `konva-renderer.ts`. The JPEG change goes in `konva-renderer.ts` (the actual buffer output), but the multi-slide loop (§8.3) goes in `workflows.ts` where the orchestration happens.

Instagram Stories accept jpg and png, but JPEG is preferred because:
- 8MB file size limit — JPEG at quality 0.92 is ~60% smaller than PNG for photo-heavy content
- Faster upload to IG container endpoint
- `media-validator.ts` already accepts `['jpg', 'png']`

### 8.2 Image Placeholder Rendering

**Current:** `renderImagePlaceholder()` (konva-renderer.ts:134-153) renders a grey rect.
**Required:** Actually download and render the image.

```typescript
async function renderImageElement(
  layer: Konva.Layer,
  element: ImageElement,
  context: TemplateContext,
): Promise<void> {
  let src = element.src
  // Resolve placeholder tokens
  if (src === '{{cover_image}}' && context.cover_image) src = context.cover_image
  if (src === '{{logo}}' && context.logo) src = context.logo

  if (!src || src.startsWith('{{')) return // unresolved placeholder → skip

  const response = await fetch(src)
  const buffer = Buffer.from(await response.arrayBuffer())
  const image = new (await import('canvas')).Image()
  image.src = buffer
  const konvaImage = new Konva.Image({
    image,
    x: element.x, y: element.y,
    width: element.width, height: element.height,
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
  })
  layer.add(konvaImage)
}
```

### 8.3 Multi-Slide Rendering

**Current:** `prepareStoryDelivery()` renders exactly 1 image.
**Required:** Loop over `story_slides` array:

```typescript
async function prepareStoryDelivery(post, delivery) {
  const slides = post.story_slides ?? [post.content?.composition]
  const renderedUrls: string[] = []

  for (let i = 0; i < slides.length; i++) {
    const buffer = await renderTemplate(slides[i], context, { width: 1080, height: 1920 })
    const url = await uploadToBlob(buffer, `stories/${post.id}-${i}-${Date.now()}.jpg`)
    renderedUrls.push(url)
  }

  // Update post with all rendered URLs
  return { ...post, content: { ...post.content, media_urls: renderedUrls } }
}
```

### 8.4 Multi-Slide Publishing (Business Account)

Sequential container create → publish for each slide:

```typescript
async function publishMultiSlideStory(igUserId: string, token: string, mediaUrls: string[]) {
  // Check rate budget: need 2 * N calls within 100/24h window
  const budget = await checkRateBudget(igUserId, token)
  if (budget.remaining < mediaUrls.length * 2) {
    throw new RateLimitError(`Need ${mediaUrls.length * 2} calls, only ${budget.remaining} remaining`)
  }

  const results: PlatformResult[] = []
  for (const url of mediaUrls) {
    const result = await publishInstagramMedia(igUserId, token, {
      image_url: url,
      media_type: 'STORIES',
    })
    results.push(result)
  }
  return results
}
```

### 8.5 Token Expiry During Multi-Slide

For a 5-slide story, publishing takes ~50 seconds (10s poll per slide). Token could expire mid-batch.

Mitigation: Before starting the batch, check token expiry. If token expires within 10 minutes, refresh proactively. If a 401 occurs mid-batch:
1. Refresh token
2. Mark already-published slides as `completed` in `story_slides[i].status`
3. Resume from the failed slide
4. Set post status to `partial_failure` if some slides succeeded and others failed

---

## 9. Preview & Publishing Flow

### 9.1 Phone Preview

Before publishing, show a realistic phone-frame preview:

```
┌──────────────────────────────────────────┐
│                                           │
│   ┌─────────────────────┐                │
│   │ ┌─────────────────┐ │  📋 Caption:  │
│   │ │░░░░░░░░░░░░░░░░░│ │  "New post!"  │
│   │ │░ Story Preview ░│ │               │
│   │ │░  Slide 1 of 3 ░│ │  🔗 Short URL:│
│   │ │░░░░░░░░░░░░░░░░░│ │  go.btf.com/  │
│   │ │                 │ │  ______        │
│   │ │ ← [•••] →       │ │               │
│   │ └─────────────────┘ │  📊 Budget:   │
│   │     iPhone 14       │  87/100 calls  │
│   └─────────────────────┘  remaining     │
│                                           │
│   ┌─────────────────┐  ┌──────────────┐  │
│   │   ⚡ Publicar    │  │  📅 Agendar  │  │
│   │      Agora       │  │  (via cron)  │  │
│   └─────────────────┘  └──────────────┘  │
│                                           │
│   Per-slide progress:                     │
│   [S1 ✓] [S2 ⏳] [S3 ○] [S4 ○] [S5 ○]  │
└──────────────────────────────────────────┘
```

### 9.2 Slide Navigation in Preview

- Left/right arrows or swipe to cycle through slides
- Dot indicators showing current position (Instagram-style)
- Each slide rendered at actual 1080x1920, scaled to fit preview frame

### 9.3 Per-Slide Progress During Publishing

Each slide shows its individual status:
- `○` — Pending
- `⏳` — Creating container / Polling
- `✓` — Published successfully
- `✗` — Failed (with retry button for that specific slide)

### 9.4 Scheduling via Cron

**Instagram API does NOT support scheduling Stories natively.** The spec is honest about this.

Flow:
1. User selects date/time in the schedule picker
2. Post saved with `status = 'scheduled'` and `scheduled_at` timestamp
3. All slides pre-rendered and saved as JPEG to Vercel Blob
4. Existing `social-publish` cron (runs every minute) picks up posts where `scheduled_at <= NOW()`
5. Publishes via normal API flow
6. If publish fails: retry with backoff (already implemented)

**UX honesty:** The schedule option shows a tooltip: "Agendamento via nosso servidor (não nativo Instagram)" — `text-amber-500` "Via servidor" label next to the schedule icon.

### 9.5 Publish Options

| Option | Behavior |
|--------|----------|
| **Publicar Agora** | Immediate publish via IG API (business) or notification (personal) |
| **Agendar** | Pre-render slides, save as scheduled, cron publishes at time |
| **Fila** | Assign next available queue slot (from Queue config in Settings) |
| **Salvar Rascunho** | Save to drafts, accessible from Stories Gallery |

---

## 10. 1-Click "Criar Story" from Blog Editor

### 10.1 Blog Editor Button

Add an Instagram-gradient button to the blog post editor toolbar:

```
┌──────────────────────────────────────────────────────┐
│  [Post Title]                                         │
│                         [Salvar] [Publicar] │ [📱 Criar Story] │
└──────────────────────────────────────────────────────┘
```

**File:** `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`

The button:
- Has Instagram gradient background (`linear-gradient(135deg, #f09433, #dc2743)`)
- Only visible when an Instagram connection exists for the current site
- Disabled if post is not yet saved (needs `id` for `source_content_id`)

### 10.2 Click Flow

1. User clicks "Criar Story"
2. Navigate to `/cms/social/stories/new?source=blog&id={postId}&locale={currentLocale}`
3. Auto-gen flow pre-fills: content selected, locale selected, 3 slides, default gradient template
4. Editor opens immediately with slides ready to customize
5. Total: 2 steps instead of 7 (10 seconds vs 2-3 minutes)

### 10.3 Post-Publish Dialog

When a blog post is published (status changes to `published`), show a dialog:

```
┌──────────────────────────────────┐
│  🎉 Blog publicado!              │
│  "I Learned a Language..."       │
│                                  │
│  [Ver post →] [📱 Criar Story] [Compartilhar ↗] │
└──────────────────────────────────┘
```

The "Criar Story" button here uses the same navigation as the toolbar button.

---

## 11. Per-Slide Insights

### 11.1 Honest Metrics Labels

**IMPORTANT:** Instagram Insights API provides per-story metrics, but does NOT track individual viewer retention across slides. The API gives reach/impressions per media object (each slide is a separate media).

| Metric | Label | Source | Honest? |
|--------|-------|--------|---------|
| Reach per slide | "Alcance por Slide" | IG Insights `reach` per media | Yes |
| Impressions per slide | "Impressões por Slide" | IG Insights `impressions` per media | Yes |
| Replies per slide | "Respostas por Slide" | IG Insights `replies` per media | Yes |
| "Retention per slide" | **DO NOT USE** | Not available from API | Misleading |
| Drop-off between slides | "Diferença de Alcance" | Computed: `reach[i] - reach[i+1]` | Honest (disclaimer needed) |

### 11.2 Drop-Off Calculation

```
Slide 1: 1,200 reach
Slide 2: 980 reach    (-18.3%)
Slide 3: 750 reach    (-23.5%)
Slide 4: 720 reach    (-4.0%)
Slide 5: 710 reach    (-1.4%)
```

Display as a bar chart with percentage drop labels. Include disclaimer: "Diferença de alcance entre slides. Nota: nem todos os viewers são os mesmos — novos viewers podem entrar em qualquer slide."

### 11.3 Polling Schedule

| Age | Interval | Rationale |
|-----|----------|-----------|
| < 2h | Every 30 min | Stories are most active in first 2 hours |
| 2-24h | Every 2h | Still live, declining activity |
| 24-48h | Every 6h | Expired but insights still available |
| > 48h | No more polling | IG Insights API stops returning data |

### 11.4 Link Click Attribution

When a story contains a short URL (burned into image or in link-in-bio):
- Track clicks via existing Links Engine (`link_clicks` partitioned table)
- Attribute to the specific `post_id` via `link_id` FK
- Show "Link Clicks" metric alongside reach/impressions
- Cross-reference with `fan_interactions` for superfan detection

---

## 12. Fan Scoring System

### 12.1 Data Sources

| Source | Interaction Type | How Captured |
|--------|-----------------|--------------|
| Instagram Stories | view, reply | IG Insights API polling |
| Instagram Feed | like, comment | IG Insights API polling |
| Link clicks | click | Links Engine `link_clicks` table |
| Newsletter | subscribe, open | Newsletter subscription events |
| Bluesky | like, repost, reply | AT Protocol notifications |
| Facebook | reaction, comment, share | Graph API insights |

### 12.2 Superfan Score Algorithm

Score 0-100, computed from 4 dimensions:

| Dimension | Weight | Formula | Max Points |
|-----------|--------|---------|------------|
| **Frequency** | 25% | `min(interactions, 50) / 50 * 25` | 25 |
| **Recency** | 25% | `25` if last 7 days, decays 1pt/day after | 25 |
| **Cross-platform** | 25% | `min(platforms, 4) / 4 * 25` | 25 |
| **Consistency** | 25% | `min(active_days_in_90d, 30) / 30 * 25` | 25 |

### 12.3 Visitor Identification

Uses existing Links Engine daily-rotating visitor hash: `SHA-256(ip|ua|date)`.

**Limitations (be honest):**
- Hash rotates daily — same person gets different hashes on different days
- Cross-referencing possible only when they interact on the same day
- Newsletter subscribers have email → can link email to visitor hash on subscription day
- Instagram usernames visible in comments/replies → can enrich `fan_interactions.raw`

### 12.4 Fan Leaderboard UI

**Route:** `/cms/analytics/fans` (dedicated page, linked from Stories insights via "Ver todos os fãs →")

```
┌──────────────────────────────────────────────┐
│  Top Fans                    Last 90 days    │
│                                               │
│  1. visitor_abc123    Score: 87/100           │
│     📱 IG  💬 BS  📧 Newsletter  🔗 Links    │
│     42 interactions · Last seen: today        │
│     ────────────────────────────────────────   │
│  2. visitor_def456    Score: 72/100           │
│     📱 IG  🔗 Links                          │
│     28 interactions · Last seen: 2 days ago   │
│     ────────────────────────────────────────   │
│  3. visitor_ghi789    Score: 65/100           │
│     📧 Newsletter  🔗 Links                  │
│     19 interactions · Last seen: 5 days ago   │
└──────────────────────────────────────────────┘
```

When a visitor hash has an associated newsletter email (from cross-reference), display the email instead of the hash.

---

## 13. Brand Kit Integration

### 13.1 Available Brand Data

From `sites` table:
- `logo_url` — site logo (used in `{{logo}}` placeholder)
- `primary_color` — hex color (used for template accents, CTAs)

### 13.2 Auto-Application

When generating slides from CMS content:
1. Template backgrounds use `primary_color` for gradient stops/accents
2. CTA buttons use `primary_color` as background
3. Logo inserted via `{{logo}}` placeholder at consistent position (bottom-right, 80x80px)
4. If `primary_color` is light (luminance > 0.5), text defaults to dark; otherwise white

### 13.3 Brand Kit Expansion (v2)

Future `site_brand_kit` table with: secondary_color, font_family, font_url, brand_colors array. For v1, `primary_color` + `logo_url` is sufficient.

---

## 14. Highlights — Manual Workflow

Instagram Graph API does **not** support Highlights management (no create, no add-to, no list endpoint).

### 14.1 CMS Guidance

After a story is published, show a tip card in the Stories Gallery:

```
┌──────────────────────────────────────────┐
│  💡 Adicionar aos Destaques?             │
│                                          │
│  Instagram não permite gerenciar         │
│  Destaques via API. Para adicionar:      │
│                                          │
│  1. Abra o Instagram no celular          │
│  2. Vá no seu perfil → Destaques        │
│  3. Toque "Novo" ou edite um existente  │
│  4. Selecione este story                │
│                                          │
│  [Entendi, não mostrar novamente]        │
└──────────────────────────────────────────┘
```

Dismissible via user preference stored in `localStorage` key `cms:highlights-tip-dismissed`.

---

## 15. "Ready to Post" Mobile Page

### 15.1 Route

`/cms/social/posts/[id]/ready`

### 15.2 Layout (Mobile-First)

```
┌────────────────────────┐
│  Story Ready!          │
│                        │
│  ┌──────────────────┐  │
│  │                  │  │
│  │  9:16 Preview    │  │
│  │  Slide 1 of 3    │  │
│  │                  │  │
│  │  ← [•••] →      │  │
│  └──────────────────┘  │
│                        │
│  🔗 go.btf.com/abc123  │
│  [📋 Copiar Link]      │
│                        │
│  Como postar:          │
│  1. Abra o Instagram   │
│  2. Crie um novo Story │
│  3. Envie as imagens   │
│  4. Adicione Link      │
│     Sticker com a URL  │
│     copiada acima      │
│                        │
│  [✅ Marquei como      │
│      Publicado]        │
│                        │
│  [📥 Baixar Imagens]   │
└────────────────────────┘
```

### 15.3 Behavior

- Slide carousel with swipe navigation
- "Copiar Link" copies short URL to clipboard with toast feedback
- "Baixar Imagens" downloads all slides as individual JPEGs (or ZIP if > 1)
- "Marquei como Publicado" sets `status = 'completed'`, `published_at = now()`
- No CMS navigation chrome — focused single-purpose page
- Requires authenticated CMS session. The Telegram notification includes a link to this page — the user must already be logged into the CMS on their phone's browser. If not authenticated, the standard auth redirect flow kicks in (Supabase Auth → redirect back to `/ready` page after login)

---

## 16. Instagram API Limitations — Honest Summary

| Feature | API Support | Our Approach |
|---------|------------|--------------|
| Post Stories (image) | Yes (`STORIES` media type) | Auto-post for business accounts |
| Post Stories (video) | Yes (mp4/mov, max 60s) | Auto-post for business accounts |
| Schedule Stories | **No** | Cron-based: pre-render + publish at time |
| Link Stickers | **No** | Burn URL into image + link-in-bio page |
| Interactive Elements (polls, questions) | **No** | Not supported — manual only |
| Highlights | **No** | Manual workflow guide |
| Story Insights | Yes (reach, impressions, replies) | Poll every 2h while live |
| Per-Viewer Retention | **No** | Use reach drop-off as proxy (with disclaimer) |
| Edit Published Story | **No** | Read-only after publish |
| Delete Published Story | Yes | Supported via `DELETE /{media-id}` |

---

## 17. Technical Gaps & Solutions Summary

| # | Gap | Impact | Solution |
|---|-----|--------|----------|
| 1 | SocialCanvasEditor missing `initialComposition` prop | Can't load drafts or apply templates | Add prop + `replaceComposition` call |
| 2 | SocialCanvasEditor missing `onCompositionChange` callback | Can't auto-save or sync multi-slide | Add prop + call on every composition update |
| 3 | SocialCanvasEditor no ref forwarding | Parent can't read composition or trigger export | Add `forwardRef` + `useImperativeHandle` |
| 4 | `handleLoadTemplate` is empty stub | Templates don't actually load | Implement with `replaceComposition` + placeholder resolution |
| 5 | `postData` accepted but never used | CMS data not wired to canvas | Wire to placeholder resolution + CMS Data tab |
| 6 | PNG export instead of JPEG | Larger files, risk hitting 8MB limit | Change `toBuffer('image/jpeg', { quality: 0.92 })` |
| 7 | `renderImagePlaceholder` is grey rect stub | Cover images don't render in server-side pipeline | Implement actual image download + render |
| 8 | `prepareStoryDelivery` renders 1 image only | No multi-slide support | Loop over `story_slides` array |
| 9 | No `slide_index` on `post_metrics` | Can't store per-slide insights | Add column |
| 10 | No `story_slides` on `social_posts` | No multi-slide data model | Add JSONB column |
| 11 | No `source_locale` on `social_posts` | Can't track which locale was used | Add text column |
| 12 | `social_templates.composition` is single object | Templates can't define multi-slide layouts | Add `slides` JSONB column |

---

## 18. Non-Goals (v2 / Deferred)

| Item | Reason | Target |
|------|--------|--------|
| Video Stories | Requires ffprobe integration, segment UI, video upload pipeline | v2 |
| Interactive Elements (polls, quiz) | Not supported by IG API | Blocked |
| Content Calendar view | Separate feature, not Story-specific | v2 |
| A/B testing Story thumbnails | Needs engagement comparison infrastructure | v2 |
| AI-generated captions | LLM integration deferred | v2 |
| Canvas editor mobile responsiveness | Desktop-first, mobile editing too complex | Deferred |
| Highlights management via API | Not supported by Meta | Blocked |
| Private/unofficial IG API | Violates ToS, risks account ban | Won't do |
| Brand kit expansion (fonts, secondary color) | Current `primary_color` + `logo_url` sufficient for v1 | v2 |

---

## 19. Migration Plan

All migrations created via `npm run db:new <name>` (never manually). Execute in order:

1. **`social_stories_multi_slide`** — Add `story_slides`, `source_locale` to `social_posts`; add `slides` to `social_templates`; add `slide_index` to `post_metrics`
2. **`social_connections_account_type`** — Add `account_type text CHECK (account_type IN ('business', 'personal')) DEFAULT 'business'` to `social_connections`
3. **`fan_interactions`** — Create `fan_interactions` table + indexes
4. **`fan_scores_view`** — Create `fan_scores` materialized view

---

## 20. File Map (Key Files to Create/Modify)

### New Files

| Path | Purpose |
|------|---------|
| `apps/web/src/app/cms/(authed)/social/stories/page.tsx` | Stories Gallery |
| `apps/web/src/app/cms/(authed)/social/stories/new/page.tsx` | New Story (auto-gen + editor) |
| `apps/web/src/app/cms/(authed)/social/stories/_components/slide-strip.tsx` | Multi-slide strip component |
| `apps/web/src/app/cms/(authed)/social/stories/_components/cms-data-tab.tsx` | CMS Data inspector tab |
| `apps/web/src/app/cms/(authed)/social/stories/_components/story-preview.tsx` | Phone-frame preview |
| `apps/web/src/app/cms/(authed)/social/stories/_components/story-card.tsx` | Gallery card component |
| `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/page.tsx` | Mobile Ready-to-Post page |
| `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx` | Fan Leaderboard |
| `apps/web/src/lib/social/fan-scoring.ts` | Fan score computation |
| `apps/web/src/lib/social/story-slides.ts` | Multi-slide render orchestration |

### Modified Files

| Path | Changes |
|------|---------|
| `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx` | Add `initialComposition`, `onCompositionChange`, `hideAspectRatioSelector`, ref forwarding, fix `handleLoadTemplate`, wire `postData` |
| `apps/web/src/lib/social/konva-renderer.ts` | PNG→JPEG, implement `renderImageElement`, placeholder resolution |
| `apps/web/src/lib/social/template-renderer.ts` | Update to support multi-slide output (called by workflows.ts) |
| `apps/web/src/lib/social/workflows.ts` | Multi-slide `prepareStoryDelivery`, token refresh mid-batch |
| `packages/social/src/providers/meta/instagram.ts` | Multi-slide sequential publish, rate budget check |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` | Add "Criar Story" button |
| `apps/web/src/lib/social/types.ts` | Add `StorySlide` type, extend `SocialPost` type |
