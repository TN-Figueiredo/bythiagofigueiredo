# Pipeline <> Social Posts Unification

> Design spec for graduating pipeline items into social posts with full metadata inheritance.

**Date:** 2026-05-14
**Status:** Ready
**Sprint:** 5h — Social Hub (phase 3: Pipeline <> Social unification)
**Pre-conditions:** Social Hub operational (social_connections, social_posts, social_deliveries). Content Pipeline operational (content_pipeline with sections JSONB). Social Posts Redesign deployed (source_content_type, pipeline_steps, delivery formats). Blog graduation route functional (`/api/pipeline/items/[id]/graduate`). `Origin` type in `lib/social/types.ts` must be extended to include `'pipeline'` before the DB migration CHECK constraint is applied.

---

## Problem Statement

The content pipeline and the social hub currently operate as disconnected systems:

1. **Pipeline** (`content_pipeline` table) manages the content creation workflow: ideas progress through stages (Idea, Draft, SEO, Images, Publication) until they reach their final "published" stage. Each pipeline item has a `sections` JSONB column that accumulates structured content across all stages — idea hooks, draft content, SEO metadata, image assets, and publication details.

2. **Social Hub** (`social_posts` table) manages the distribution workflow: posts are scheduled for delivery to Facebook, Instagram, Bluesky, and YouTube. Social posts are created either manually via the Composer (`/cms/social/new`) or automatically from CMS content via `createSocialPostFromContent()`.

The gap: when a pipeline item completes its content creation workflow, there is no bridge to the social distribution workflow. The user must manually open the Social Hub Composer, re-enter the content metadata, select platforms, write captions, and schedule. All the rich context accumulated during pipeline stages (the hook, synopsis, SEO keywords, image selections, publication strategy) is lost in this manual handoff.

The existing graduation pattern (pipeline item -> blog post, newsletter, campaign) already solves the "content creation -> CMS entity" bridge. This spec extends that pattern to also bridge "content creation -> social distribution."

---

## Approach: Graduation Model

Pipeline items "graduate" to social posts when they reach the Publication stage, analogous to how pipeline blog items graduate to `blog_posts`. The pipeline represents the content creation workflow; social posts represent the distribution workflow. These are distinct lifecycle phases with different ownership:

- **Pipeline lifecycle:** Idea -> Draft -> SEO -> Images -> Publication (content team)
- **Social lifecycle:** Draft/Scheduled -> OG Scrape -> Delivery -> Published (distribution automation)

At graduation, a **complete snapshot** of all pipeline sections is captured and stored as read-only context in the social post. This snapshot preserves the creative decisions (hook, draft, SEO strategy, image selections) that inform how the content should be promoted socially. The snapshot is immutable — it serves as a reference, not a sync target.

The graduation trigger is **hybrid**: if the pipeline item's `social_config` (platform selection, captions, hashtags) is fully configured at the Publication stage, the social post is created immediately as `scheduled` with the next available queue slot. If the config is incomplete, a `draft` social post is created and the user is notified to complete configuration in the Social Hub.

---

## Architecture

### Database Changes

#### 1. `content_pipeline` — new `social_config` column

The `social_config` JSONB column stores the social distribution configuration that the user fills out in the Publication tab. This is the "social readiness" data that determines whether auto-graduation is possible.

```sql
-- Migration: 20260515100000_pipeline_social_graduation.sql

ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_config JSONB;

COMMENT ON COLUMN public.content_pipeline.social_config IS
  'Social distribution config edited in Publication tab. Shape: SocialConfig from lib/social/types.ts';
```

No default value — `NULL` means "social not configured." This is intentional: the absence of config is a distinct state from "config present but incomplete."

#### 2. `social_posts` — new columns for pipeline provenance

```sql
-- Migration: 20260515100000_pipeline_social_graduation.sql (same file)

-- FK back to the pipeline item that generated this social post
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS source_pipeline_id UUID
    REFERENCES public.content_pipeline(id) ON DELETE SET NULL;

-- Complete snapshot of all pipeline sections at graduation time (read-only context)
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS pipeline_snapshot JSONB;

-- Timestamp when the graduation happened
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;

-- Index for reverse lookup: given a pipeline item, find its social post
CREATE INDEX IF NOT EXISTS idx_social_posts_source_pipeline
  ON public.social_posts(source_pipeline_id)
  WHERE source_pipeline_id IS NOT NULL;

-- Unique partial index: at most 1 active social post per pipeline item
-- Prevents duplicate graduations when pipeline is in progress
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_active_per_pipeline
  ON public.social_posts(site_id, source_pipeline_id)
  WHERE status IN ('draft', 'scheduled', 'publishing')
    AND source_pipeline_id IS NOT NULL;
```

Notes:
- `source_pipeline_id` uses `ON DELETE SET NULL` so that archiving/deleting a pipeline item does not cascade-delete the social post. The social post has a standalone lifecycle after graduation.
- `pipeline_snapshot` is intentionally denormalized. Even if the pipeline item is later modified, the social post retains the exact state at graduation time.
- The unique partial index mirrors the existing `idx_social_posts_active_per_content` pattern from migration `20260514100000`.

#### 3. `content_pipeline` — new `social_post_id` FK (reverse link)

```sql
-- Same migration: 20260515100000_pipeline_social_graduation.sql

ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_post_id UUID
    REFERENCES public.social_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_social_post
  ON public.content_pipeline(social_post_id)
  WHERE social_post_id IS NOT NULL;
```

This follows the existing pattern: `content_pipeline` already has `blog_post_id`, `newsletter_edition_id`, and `campaign_id` FK columns set during graduation. `social_post_id` completes the set.

#### 4. Update `PipelineItemUpdateSchema`

Add `social_config` and `social_post_id` to the Zod schema in `apps/web/src/lib/pipeline/schemas.ts`:

```typescript
// Add to PipelineItemUpdateSchema
social_config: z.object({
  enabled: z.boolean(),
  platforms: z.array(z.enum(['youtube', 'facebook', 'instagram', 'bluesky'])),
  captions: z.record(z.record(z.string())).optional(),
  hashtags: z.array(z.string().max(100)).max(30).optional(),
  image_source: z.enum(['og_image', 'cover_image', 'custom']).optional(),
  ig_template: z.enum(['minimal', 'card', 'bold']).optional(),
  formats: z.record(z.string()).optional(),
}).nullable().optional(),
social_post_id: z.string().uuid().nullable().optional(),
```

---

### Social Config Schema

The `social_config` JSONB stored in `content_pipeline.social_config` reuses the existing `SocialConfig` interface from `apps/web/src/lib/social/types.ts`:

```typescript
// Already defined in apps/web/src/lib/social/types.ts
export interface SocialConfig {
  enabled: boolean
  platforms: Provider[]                                    // e.g. ['facebook', 'instagram', 'bluesky']
  captions: Partial<Record<Provider, Partial<Record<'pt' | 'en', string>>>>
  hashtags: string[]
  image_source: 'og_image' | 'cover_image' | 'custom'
  ig_template: 'minimal' | 'card' | 'bold'
  formats: Partial<Record<Provider, DeliveryFormat>>       // override default format map
}
```

This is the same schema already used in `blog_posts.social_config`, `newsletter_editions.social_config`, and `campaigns.social_config` (added in migration `20260514100000`). Reusing it keeps format negotiation consistent: `createSocialPostFromContent()` already knows how to interpret this shape.

**Completeness check for auto-graduation:**

```typescript
function isSocialConfigComplete(config: SocialConfig | null): boolean {
  if (!config) return false
  if (!config.enabled) return false
  if (config.platforms.length === 0) return false

  // At least one caption per selected platform
  for (const platform of config.platforms) {
    const captions = config.captions[platform]
    if (!captions) return false
    const hasAnyCaption = Object.values(captions).some(
      (c) => c !== undefined && c !== null && c.trim().length > 0,
    )
    if (!hasAnyCaption) return false
  }

  return true
}
```

---

### Pipeline Snapshot Schema

The `pipeline_snapshot` JSONB captures the complete state of the pipeline item at graduation time. It includes all sections, metadata, and key fields:

```typescript
interface PipelineSnapshot {
  // Identity
  pipeline_id: string
  code: string
  format: string                       // 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  stage: string                        // stage at graduation time (e.g., 'published', 'scheduled')
  language: string

  // Content summary
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  tags: string[]
  category: string | null              // blog category if applicable
  cover_image_url: string | null

  // All sections at graduation time (complete copy)
  sections: Record<string, SectionData>

  // Format-specific metadata
  format_metadata: Record<string, unknown>

  // Linked entities (for context)
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  youtube_video_id: string | null

  // Graduation metadata
  graduated_at: string                 // ISO 8601
  graduated_by: string                 // user ID
  version: number                      // pipeline item version at graduation time
}
```

This snapshot is **read-only** in the social post. The UI renders it as reference context for the social distribution team (which, in this single-user CMS, is the same person — but the separation still provides valuable context when reviewing scheduled posts).

---

### Graduation Flow

#### Step-by-step: Happy Path (auto-graduation)

1. **User completes pipeline stages** — Item progresses through Idea, Draft, SEO, Images to the Publication stage.

2. **User configures social_config in Publication tab** — Selects platforms (e.g., Facebook + Instagram + Bluesky), writes per-platform captions, picks hashtags, selects IG story template. The `social_config` is persisted to `content_pipeline.social_config` via `updatePipelineItem()`.

3. **User advances to final stage ("published" or "scheduled")** — Triggers `advancePipelineItem()` in `apps/web/src/app/cms/(authed)/pipeline/actions.ts`.

4. **Graduation check fires** — The advance action detects arrival at a graduatable stage and checks:
   - Is `social_config` present and enabled?
   - Is `social_config` complete? (all platforms have captions)
   - Is there no existing active social post for this pipeline item?

5. **If fully configured (auto-graduate):**
   a. Snapshot all pipeline sections into `PipelineSnapshot`
   b. Determine `ContentType` from pipeline format (see Format Matching below)
   c. Resolve the linked content entity (blog_post_id, newsletter_edition_id, etc.)
   d. Call `createSocialPostFromContent()` with the social_config, passing the resolved content entity as the source
   e. Store `pipeline_snapshot` and `source_pipeline_id` on the created social post
   f. Set `social_post_id` FK on the pipeline item
   g. Record `graduated` event in `content_pipeline_history`
   h. Social post enters the normal publish pipeline: short link creation -> OG scrape -> delivery (via cron or immediate trigger)

6. **If incomplete config (draft graduation):**
   a. Create a `draft` social post with `pipeline_snapshot` and partial `social_config`
   b. Set `social_post_id` FK on the pipeline item
   c. Record `graduated_draft` event in `content_pipeline_history`
   d. The user completes configuration in the Social Hub post editor

#### Step-by-step: Manual Graduation

The user can also trigger graduation manually from the pipeline detail UI via a "Graduate to Social" button, following the same logic as auto-graduation but without requiring the item to be at the final stage. This supports the use case where a user wants to pre-schedule social promotion while the pipeline item is still in progress.

---

### Format Matching

Each pipeline format graduates to its matching content type and delivery formats:

| Pipeline Format | Content Type | Facebook Format | Instagram Format | Bluesky Format |
|----------------|-------------|-----------------|------------------|----------------|
| `blog_post` | `blog` | `link_share` | `story` | `link_card` |
| `newsletter` | `newsletter` | `link_share` | `story` | `link_card` |
| `campaign` | `campaign` | `link_share` | `story` | `link_card` |
| `video` | `video` | `video_share` | `reel` | `link_card` |
| `course` | N/A | Not supported in v1 | Not supported in v1 | Not supported in v1 |

This maps directly to the existing `CONTENT_FORMAT_MAP` in `apps/web/src/lib/social/types.ts`. The pipeline format-to-content-type mapping:

```typescript
const PIPELINE_FORMAT_TO_CONTENT_TYPE: Partial<Record<Format, ContentType>> = {
  blog_post: 'blog',
  newsletter: 'newsletter',
  campaign: 'campaign',
  video: 'video',
}
```

For graduation to work, the pipeline item must have a linked content entity:
- `blog_post` format requires `blog_post_id` (must graduate to blog first)
- `newsletter` format requires `newsletter_edition_id`
- `campaign` format requires `campaign_id`
- `video` format requires `youtube_video_id`

If the content entity link is missing, the graduation creates a draft social post without calling `createSocialPostFromContent()`, and the user must link the content entity first. This handles the case where social config is filled out before the content graduation happens.

---

### Auto-Graduation Logic

Decision tree executed when a pipeline item reaches a graduatable stage:

```
1. Is item.social_config null or .enabled === false?
   YES -> No graduation. Pipeline item reaches final stage normally.
   NO  -> Continue.

2. Does item already have social_post_id?
   YES -> Already graduated. Skip.
   NO  -> Continue.

3. Is the pipeline format supported? (blog_post, newsletter, campaign, video)
   NO  -> Skip graduation. Log warning. Course format not supported in v1.
   YES -> Continue.

4. Does item have a linked content entity? (blog_post_id, newsletter_edition_id, etc.)
   NO  -> Create draft social post with pipeline_snapshot.
          Set origin = 'pipeline'. Status = 'draft'.
          Notify user: "Social post created as draft — link content entity first."
          -> Done.
   YES -> Continue.

5. Is social_config complete? (all platforms have captions, platforms.length > 0)
   NO  -> Create draft social post with pipeline_snapshot.
          Populate from linked content entity via extractContentMetadata().
          Set origin = 'pipeline'. Status = 'draft'.
          Notify user: "Social post created as draft — complete captions."
          -> Done.
   YES -> Continue.

6. Auto-graduate:
   Call createSocialPostFromContent() with:
     - contentType from format mapping
     - contentId from linked entity FK
     - config from social_config
     - origin = 'pipeline'
     - scheduledAt from getNextQueueSlot() or social_config override
   Store pipeline_snapshot on the social post.
   Set social_post_id FK on pipeline item.
   Record 'graduated' event in history.
   -> Done.
```

---

## Components

### Publication Tab (social_config editor)

The existing Publication section in the pipeline detail page currently renders video-specific metadata (title, description, tags, cards, end screen, strategy) via `PublishRenderer` in `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx`.

The Publication tab will be extended with a **Social Config panel** that appears for all graduatable formats (blog_post, newsletter, campaign, video). The existing video publication metadata (title, description, cards, etc.) remains — the social config is an additional section below it.

#### Social Config Panel UI

The panel lives within the Publication section and contains:

1. **Enable toggle** — "Distribute on social media when published?" (`social_config.enabled`)
2. **Platform selector** — Checkbox pills for each connected platform. Grayed out if no connection exists for that provider. Shows connection status badge.
3. **Per-platform caption editors** — Expandable section per selected platform with locale tabs (PT / EN). Character count indicator with platform-specific limits:
   - Facebook: 63,206 chars (soft limit at 500)
   - Instagram: 2,200 chars (caption for stories)
   - Bluesky: 300 chars (grapheme limit)
4. **Hashtag input** — Tag-style input with autocomplete from pipeline item tags. Shows hashtag count.
5. **Image source selector** — Radio buttons: "OG Image" / "Cover Image" / "Custom". If custom, shows Media Gallery picker.
6. **IG Story template selector** — Visual thumbnails for "Minimal" / "Card" / "Bold" templates. Only shown when Instagram is selected.
7. **Delivery format overrides** — Advanced collapse panel showing the default format per platform (from `CONTENT_FORMAT_MAP`) with option to override.

The panel saves `social_config` to the pipeline item via `updatePipelineItem()` on blur/change, using the same optimistic locking pattern (version check) as other section edits.

#### Component location

```
apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/social-config-editor.tsx
```

This is a new renderer registered in the section-content renderer map. The `publish` section key in `SECTION_DEFINITIONS` will be split:
- Existing `publish-renderer.tsx` continues to render video publication metadata (title, description, cards, etc.)
- New `social-config-editor.tsx` renders below it as a sub-section, controlled by a separate data path (`item.social_config` rather than `sections.publish_*`)

#### Cowork integration

The social config panel does NOT integrate with the Cowork AI prompt system. Cowork operates on pipeline sections (`sections` JSONB), while social_config is a top-level column. Captions are short enough that AI assistance is not needed in v1. If desired later, a "Generate captions from hook + synopsis" button can be added without architectural changes.

---

### Graduated Post View

When viewing a social post in the Social Hub that was graduated from a pipeline item (`source_pipeline_id IS NOT NULL`), the post detail page shows:

1. **Standard social post view** — Status, deliveries, scheduled time, content preview (existing UI)
2. **Pipeline Context panel** — Collapsible section showing the pipeline snapshot:
   - Pipeline item code and title (linked back to pipeline detail page)
   - Format badge + stage at graduation time
   - Sections rendered as read-only accordion panels using the existing section renderers:
     - Idea (hook, synopsis, context)
     - Draft (content summary)
     - SEO (keywords, meta description)
     - Images (selected assets)
     - Publication (title, description, strategy)
   - Graduation timestamp and user

This panel reuses the existing section renderers (`IdeaRenderer`, `DraftRenderer`, `SeoRenderer`, etc.) in read-only mode (`isEditing=false`). The renderers already support this — they render without contentEditable when `isEditing` is false.

#### Component location

```
apps/web/src/app/cms/(authed)/social/[id]/_components/pipeline-context-panel.tsx
```

---

### Notification System

Notifications for incomplete graduations use the existing toast system (Sonner) and CMS notification patterns:

| Event | Notification | Channel |
|-------|-------------|---------|
| Auto-graduation successful | Toast: "Social post scheduled for {time} on {platforms}" | In-app toast |
| Draft graduation (incomplete config) | Toast: "Social post created as draft — complete captions in Social Hub" + link | In-app toast |
| Draft graduation (no content entity) | Toast: "Social post created as draft — link blog post/newsletter first" + link | In-app toast |
| Graduation failed | Toast error: "Failed to create social post: {error}" | In-app toast + Sentry |

No email notifications in v1. The user is always in the CMS when graduation happens (it triggers on stage advance), so in-app toasts are sufficient.

---

## Data Flow

### Happy Path: Auto-Graduation

```
User advances pipeline item to "published" stage
         |
         v
advancePipelineItem() (pipeline/actions.ts)
         |
         v
shouldGraduateToSocial() check
   - social_config.enabled === true
   - social_config is complete
   - no existing social_post_id
   - format is supported
   - linked content entity exists
         |
         v
buildPipelineSnapshot(item)
   - Copies: code, format, stage, titles, hook, synopsis,
     tags, category, cover_image, sections, format_metadata,
     linked entity IDs, version, graduated_at, graduated_by
         |
         v
createSocialPostFromContent() (lib/social/create-from-content.ts)
   - Extracts metadata from linked content entity
   - Creates tracked_links short link
   - Creates social_posts row (status: 'scheduled')
   - Creates social_deliveries per platform
   - Triggers async pipeline (OG scrape + delivery)
         |
         v
Patch social_posts: set pipeline_snapshot, source_pipeline_id, graduated_at
         |
         v
Patch content_pipeline: set social_post_id
         |
         v
Insert content_pipeline_history: event_type = 'graduated', to_value = 'social:{post_id}'
         |
         v
Cron social-publish picks up scheduled post
   - OG scrape (Facebook Debugger)
   - Delivery to each platform (FB, IG, BS)
   - Pipeline steps updated in real-time
```

### Edge Case: Pipeline Graduation Before Content Graduation

```
Pipeline item at "published" stage
   - social_config configured and complete
   - BUT blog_post_id is null (user hasn't graduated to blog yet)
         |
         v
Graduation creates draft social post:
   - pipeline_snapshot captured
   - origin = 'pipeline'
   - status = 'draft'
   - source_content_type = null (no content entity yet)
   - source_content_id = null
         |
   User later graduates pipeline to blog post
         |
         v
Blog graduation sets blog_post_id on pipeline item
         |
         v
Optional: UI shows prompt to update the draft social post
   with the now-available content entity
   (manual action via "Link to blog post" button in social post editor)
```

### Edge Case: Re-graduation

```
Pipeline item already has social_post_id (previously graduated)
   - Existing social post status = 'completed' or 'failed'
         |
         v
User requests re-graduation (explicit action)
   - New social post created (old one remains as history)
   - New pipeline_snapshot captured (may differ from original)
   - social_post_id updated to new post
   - History event: 're_graduated'
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `createSocialPostFromContent()` fails | Log to Sentry. Toast error to user. Pipeline item stays at published stage — no rollback. `social_post_id` remains null. User can retry manually. |
| Snapshot creation fails (missing sections) | Graceful degradation: create social post with `pipeline_snapshot = null`. The post is still functional for distribution, just lacks the context panel. |
| Unique index violation (duplicate active post) | Return `{ ok: false, error: 'Active social post already exists' }`. UI shows link to existing social post. |
| Linked content entity not found | Graduation proceeds as draft. User must link content entity before the social post can be scheduled. |
| Pipeline item archived after graduation | Social post continues independently (`ON DELETE SET NULL` on FK). Social post retains its snapshot. |
| Social connection revoked between graduation and delivery | Handled by existing `publishSocialPost()` logic — delivery is `skipped` with error "Connection has been revoked." |
| Version conflict during graduation | `updatePipelineItem()` uses optimistic locking. If the pipeline item was modified concurrently, the graduation fails with "Version conflict" and the user retries. |

---

## Implementation Plan

### New/Modified Files

| File | Change |
|------|--------|
| `supabase/migrations/20260515100000_pipeline_social_graduation.sql` | New migration: `social_config` on content_pipeline, `source_pipeline_id` + `pipeline_snapshot` + `graduated_at` on social_posts, `social_post_id` on content_pipeline, indexes |
| `apps/web/src/lib/pipeline/schemas.ts` | Add `social_config` and `social_post_id` to `PipelineItemUpdateSchema` |
| `apps/web/src/lib/pipeline/graduation.ts` | New file: `shouldGraduateToSocial()`, `buildPipelineSnapshot()`, `graduateToSocialPost()` |
| `apps/web/src/app/cms/(authed)/pipeline/actions.ts` | Extend `advancePipelineItem()` to check graduation trigger; add `graduateToSocialAction()` for manual trigger |
| `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts` | Extend to support `target: 'social'` in `GraduateSchema` |
| `apps/web/src/lib/social/types.ts` | Add `PipelineSnapshot` interface; extend `Origin` type: `'manual' \| 'auto' \| 'publish_modal' \| 'pipeline'` |
| `apps/web/src/lib/social/create-from-content.ts` | Accept optional `pipelineSnapshot` and `sourcePipelineId` params |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/social-config-editor.tsx` | New component: social config panel for Publication tab |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` | Register social-config-editor in renderer map |
| `apps/web/src/app/cms/(authed)/social/[id]/_components/pipeline-context-panel.tsx` | New component: read-only pipeline snapshot viewer |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Wire social_post_id display + "Graduate to Social" button |

### Server Action: `graduateToSocialAction()`

```typescript
// In apps/web/src/app/cms/(authed)/pipeline/actions.ts

export async function graduateToSocialAction(
  pipelineId: string,
  version: number,
): Promise<ActionResult> {
  const { siteId } = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { data: item } = await supabase
    .from('content_pipeline')
    .select('*')
    .eq('id', pipelineId)
    .eq('site_id', siteId)
    .eq('version', version)
    .single()

  if (!item) return { ok: false, error: 'Item not found or version conflict' }
  if (item.social_post_id) return { ok: false, error: 'Already graduated to social' }

  const { graduateToSocialPost } = await import('@/lib/pipeline/graduation')
  const result = await graduateToSocialPost(supabase, item, siteId)

  if (!result.ok) return { ok: false, error: result.error }

  revalidatePath('/cms/pipeline')
  revalidatePath('/cms/social')
  return { ok: true, data: result.data }
}
```

### Core Function: `graduateToSocialPost()`

```typescript
// In apps/web/src/lib/pipeline/graduation.ts

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SocialConfig, ContentType } from '@/lib/social/types'
import type { SectionData } from '@/lib/pipeline/sections'
import type { Format } from '@/lib/pipeline/schemas'

const PIPELINE_FORMAT_TO_CONTENT_TYPE: Partial<Record<Format, ContentType>> = {
  blog_post: 'blog',
  newsletter: 'newsletter',
  campaign: 'campaign',
  video: 'video',
}

const CONTENT_ENTITY_FK: Record<string, string> = {
  blog: 'blog_post_id',
  newsletter: 'newsletter_edition_id',
  campaign: 'campaign_id',
  video: 'youtube_video_id',
}

interface PipelineItem {
  id: string
  code: string
  format: string
  stage: string
  language: string
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  tags: string[]
  category: string | null
  cover_image_url: string | null
  sections: Record<string, SectionData> | null
  format_metadata: Record<string, unknown>
  social_config: SocialConfig | null
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  youtube_video_id: string | null
  version: number
  created_by: string | null
}

export function isSocialConfigComplete(config: SocialConfig | null): boolean {
  if (!config) return false
  if (!config.enabled) return false
  if (config.platforms.length === 0) return false

  for (const platform of config.platforms) {
    const captions = config.captions[platform]
    if (!captions) return false
    const hasAnyCaption = Object.values(captions).some(
      (c) => c !== undefined && c !== null && c.trim().length > 0,
    )
    if (!hasAnyCaption) return false
  }

  return true
}

export function buildPipelineSnapshot(
  item: PipelineItem,
  userId: string,
): Record<string, unknown> {
  return {
    pipeline_id: item.id,
    code: item.code,
    format: item.format,
    stage: item.stage,
    language: item.language,
    title_pt: item.title_pt,
    title_en: item.title_en,
    hook: item.hook,
    synopsis: item.synopsis,
    tags: item.tags,
    category: item.category,
    cover_image_url: item.cover_image_url,
    sections: item.sections ?? {},
    format_metadata: item.format_metadata,
    blog_post_id: item.blog_post_id,
    newsletter_edition_id: item.newsletter_edition_id,
    campaign_id: item.campaign_id,
    youtube_video_id: item.youtube_video_id,
    graduated_at: new Date().toISOString(),
    graduated_by: userId,
    version: item.version,
  }
}

export async function graduateToSocialPost(
  supabase: SupabaseClient,
  item: PipelineItem,
  siteId: string,
): Promise<{ ok: true; data: { postId: string; isDraft: boolean } } | { ok: false; error: string }> {
  const format = item.format as Format
  const contentType = PIPELINE_FORMAT_TO_CONTENT_TYPE[format]

  if (!contentType) {
    return { ok: false, error: `Format "${format}" does not support social graduation` }
  }

  const userId = item.created_by
  if (!userId) {
    return { ok: false, error: 'Pipeline item has no creator' }
  }

  const config = item.social_config
  const snapshot = buildPipelineSnapshot(item, userId)
  const fkField = CONTENT_ENTITY_FK[contentType]
  const contentEntityId = fkField ? (item[fkField as keyof PipelineItem] as string | null) : null

  const configComplete = isSocialConfigComplete(config)
  const hasContentEntity = contentEntityId !== null

  // Full auto-graduation path
  if (configComplete && hasContentEntity && config) {
    const { createSocialPostFromContent } = await import('@/lib/social/create-from-content')
    const { getNextQueueSlot } = await import('@/lib/social/queue')

    const slot = await getNextQueueSlot(siteId, 'America/Sao_Paulo')
    const scheduledAt = slot?.scheduledAt

    const result = await createSocialPostFromContent({
      supabase,
      siteId,
      contentType,
      contentId: contentEntityId,
      config,
      origin: 'pipeline',
      scheduledAt,
      userId,
    })

    // Attach pipeline provenance to the social post
    await supabase
      .from('social_posts')
      .update({
        source_pipeline_id: item.id,
        pipeline_snapshot: snapshot,
        graduated_at: new Date().toISOString(),
      })
      .eq('id', result.postId)

    // Set FK on pipeline item
    await supabase
      .from('content_pipeline')
      .update({ social_post_id: result.postId })
      .eq('id', item.id)

    // Record history
    await supabase.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'graduated',
      to_value: `social:${result.postId}`,
    })

    return { ok: true, data: { postId: result.postId, isDraft: false } }
  }

  // Draft graduation path
  const idempotencyKey = crypto.randomUUID()
  const postContent = {
    title: item.title_pt || item.title_en || '',
    description: item.hook || item.synopsis || '',
    url: '',
    hashtags: config?.hashtags ?? item.tags ?? [],
    media_urls: item.cover_image_url ? [item.cover_image_url] : [],
    captions: config?.captions ?? {},
  }

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .insert({
      site_id: siteId,
      created_by: userId,
      type: contentType === 'video' ? 'video' : 'link',
      status: 'draft',
      content: postContent,
      user_timezone: 'America/Sao_Paulo',
      idempotency_key: idempotencyKey,
      source_content_type: hasContentEntity ? contentType : null,
      source_content_id: contentEntityId,
      source_pipeline_id: item.id,
      pipeline_snapshot: snapshot,
      graduated_at: new Date().toISOString(),
      origin: 'pipeline',
      pipeline_steps: [],
    })
    .select('id')
    .single()

  if (postError || !post) {
    return { ok: false, error: `Failed to create draft social post: ${postError?.message ?? 'unknown'}` }
  }

  const postId = post.id as string

  // Set FK on pipeline item
  await supabase
    .from('content_pipeline')
    .update({ social_post_id: postId })
    .eq('id', item.id)

  // Record history
  await supabase.from('content_pipeline_history').insert({
    pipeline_id: item.id,
    event_type: 'graduated_draft',
    to_value: `social:${postId}`,
  })

  return { ok: true, data: { postId, isDraft: true } }
}
```

---

## Migration Strategy

### Existing pipeline items

Existing pipeline items in production have no `social_config` or `social_post_id`. After migration:
- `social_config` defaults to `NULL` (no social distribution configured)
- `social_post_id` defaults to `NULL` (not graduated)
- No backfill needed. Existing items continue operating as before.
- Users can retroactively configure `social_config` on any item and manually trigger graduation.

### Existing social posts

Existing social posts have no `source_pipeline_id`, `pipeline_snapshot`, or `graduated_at`. After migration:
- All three columns default to `NULL`
- Existing social posts continue operating as before (they were created via Composer or `createSocialPostFromContent()` from content entities directly)
- No backfill needed.

### Cowork API compatibility

The Cowork pipeline API (`/api/pipeline/items/[id]/sections/...`) operates on the `sections` JSONB column. The new `social_config` column is separate and not exposed via the Cowork API. No changes needed to the Cowork integration.

### Migration SQL

```sql
-- supabase/migrations/20260515100000_pipeline_social_graduation.sql

BEGIN;

-- 1. content_pipeline: social_config + social_post_id
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_config JSONB;

-- Forward-declare: social_post_id added after social_posts columns exist
-- (social_posts table already exists from 20260513100000_social_hub.sql)
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_post_id UUID
    REFERENCES public.social_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_social_post
  ON public.content_pipeline(social_post_id)
  WHERE social_post_id IS NOT NULL;

-- 2. social_posts: pipeline provenance columns
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS source_pipeline_id UUID
    REFERENCES public.content_pipeline(id) ON DELETE SET NULL;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS pipeline_snapshot JSONB;

ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS graduated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_social_posts_source_pipeline
  ON public.social_posts(source_pipeline_id)
  WHERE source_pipeline_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_active_per_pipeline
  ON public.social_posts(site_id, source_pipeline_id)
  WHERE status IN ('draft', 'scheduled', 'publishing')
    AND source_pipeline_id IS NOT NULL;

-- 3. Extend origin CHECK to include 'pipeline'
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_origin_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_origin_check
    CHECK (origin IN ('manual', 'auto', 'publish_modal', 'pipeline'));

-- 4. Add 'social' to GraduateSchema targets (application-level, not DB constraint)

COMMIT;
```

---

## Testing Strategy

### Unit Tests

| Test | File | Description |
|------|------|-------------|
| `isSocialConfigComplete()` | `test/lib/pipeline/graduation.test.ts` | Null config, disabled, no platforms, missing captions, complete config |
| `buildPipelineSnapshot()` | `test/lib/pipeline/graduation.test.ts` | Full item with all fields, item with null sections, item with minimal fields |
| Format mapping | `test/lib/pipeline/graduation.test.ts` | All supported formats map correctly, unsupported format returns error |

### Integration Tests (DB-gated)

| Test | File | Description |
|------|------|-------------|
| Auto-graduation happy path | `test/integration/pipeline-social-graduation.test.ts` | Create pipeline item with complete social_config + linked blog_post, advance to published, verify social_post created with snapshot |
| Draft graduation (incomplete config) | Same file | Config missing captions, verify draft social post created |
| Draft graduation (no content entity) | Same file | No blog_post_id, verify draft social post without source_content_id |
| Duplicate prevention | Same file | Graduate twice, verify unique index rejects second active post |
| Re-graduation after completion | Same file | First social post completed, graduate again, verify new post created |
| Version conflict | Same file | Concurrent update to pipeline item, verify graduation fails cleanly |

### Component Tests

| Test | File | Description |
|------|------|-------------|
| Social config editor renders | `test/cms/pipeline/social-config-editor.test.tsx` | Renders platform selector, caption editors, hashtag input |
| Social config editor saves | Same file | Verify `updatePipelineItem` called with correct social_config shape |
| Pipeline context panel renders | `test/cms/social/pipeline-context-panel.test.tsx` | Renders snapshot sections in read-only mode |
| Pipeline context panel handles null snapshot | Same file | Graceful rendering when pipeline_snapshot is null |

### Existing Test Suites

The following existing test suites must continue to pass:
- `test/lib/social/workflows-enhanced.test.ts` — Social publish pipeline
- `test/cms/social-composer/schedule-bar.test.tsx` — Schedule bar
- All existing pipeline action tests (if any)
- Graduate route tests for blog/newsletter/campaign targets

---

## Decisions (resolved from initial open questions)

1. **Queue slot timezone** — Hardcoded `'America/Sao_Paulo'` for v1. This is a single-user CMS; configurable timezone is out of scope. If needed later, add `timezone` to `social_config`.

2. **Course format** — Not supported in v1. Courses are not publicly published yet. The graduation logic explicitly rejects `course` format with a clear error message. No fallback to generic link share -- that would require a content entity that doesn't exist for courses.

3. **Re-graduation UX** — Yes. When the existing social post has a terminal status (`completed`, `failed`, `cancelled`), the pipeline detail shows a "Promote again" button with a confirmation dialog. Re-graduation creates a new social post (the old one remains as history), updates `social_post_id` on the pipeline item, and records a `re_graduated` history event.

4. **Batch graduation** — Yes, but capped at 5 per batch operation. If a batch advance affects more than 5 graduatable items, the first 5 graduate automatically and the remaining get draft social posts with a toast: "Graduation limit reached -- complete remaining posts in Social Hub." This prevents queue flooding.

5. **Social config inheritance** — Pipeline's `social_config` takes precedence over the content entity's `social_config`. The pipeline represents the most recently edited intent. If the pipeline's `social_config` is null but the content entity has one, the content entity's config is NOT inherited -- the user must explicitly configure social distribution in the pipeline Publication tab.
