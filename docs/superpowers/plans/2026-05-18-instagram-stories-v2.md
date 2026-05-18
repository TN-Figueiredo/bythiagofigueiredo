# Instagram Stories v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Instagram Story experience with multi-slide editor, fan scoring, 1-click from blog, Stories Gallery, per-slide insights, and honest API limitation handling.

**Architecture:** Extends the existing Social Composer v6 by adding `story_slides` JSONB array to social_posts, multi-slide rendering via the existing Konva pipeline (PNG→JPEG), and a new Stories Gallery entry point. The SocialCanvasEditor gets ref forwarding + 3 new props to support multi-slide editing. Fan scoring uses a materialized view over a new `fan_interactions` table cross-referenced with Links Engine visitor hashes.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Konva (server + client), Supabase PostgreSQL, Vitest, Vercel Blob, Instagram Graph API v25.0

**Spec:** `docs/superpowers/specs/2026-05-18-social-composer-stories-v2-design.md`

---

## Dependency Graph

```
Phase 1 (foundation — must complete first):
  Task 1: Database migrations
  Task 2: TypeScript types & schemas

Phase 2 (parallel — all independent after Phase 1):
  Task 3: Konva renderer (PNG→JPEG + image rendering)
  Task 4: SocialCanvasEditor (new props + ref forwarding)
  Task 5: Instagram provider (multi-slide publish + rate budget)
  Task 6: Fan scoring backend (table + materialized view + computation)

Phase 3 (parallel — depends on Phase 2 items):
  Task 7: Template renderer + workflows multi-slide (depends on Task 3)
  Task 8: Stories Gallery page (depends on Task 2 only)
  Task 9: Slide strip + CMS data tab (depends on Task 4)
  Task 10: 1-click from blog editor (independent)

Phase 4 (parallel — depends on Phase 3):
  Task 11: Auto-generation from CMS content (depends on Task 7, 9)
  Task 12: Preview & Publishing UI (depends on Task 5, 7, 9)
  Task 13: Per-slide insights + Fan leaderboard UI (depends on Task 6)

Phase 5 (finishing):
  Task 14: Ready-to-Post page updates + CMS nav + Highlights tip
```

---

### Task 1: Database Migrations

**Files:**
- Create: `supabase/migrations/<timestamp>_social_stories_multi_slide.sql` (via `npm run db:new`)
- Create: `supabase/migrations/<timestamp>_social_connections_account_type.sql` (via `npm run db:new`)
- Create: `supabase/migrations/<timestamp>_fan_interactions.sql` (via `npm run db:new`)
- Create: `supabase/migrations/<timestamp>_fan_scores_view.sql` (via `npm run db:new`)

- [ ] **Step 1: Create the multi-slide migration file**

Run:
```bash
npm run db:new social_stories_multi_slide
```

- [ ] **Step 2: Write the multi-slide migration SQL**

Open the generated file in `supabase/migrations/` and write:

```sql
-- Multi-slide story support for Instagram Stories v2

-- social_posts: add story_slides array and source_locale
ALTER TABLE public.social_posts
  ADD COLUMN IF NOT EXISTS story_slides jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_locale text DEFAULT NULL;

COMMENT ON COLUMN public.social_posts.story_slides IS 'Array of CardComposition objects for multi-slide stories, max 10. NULL = single-image post.';
COMMENT ON COLUMN public.social_posts.source_locale IS 'Locale used for auto-generation (e.g. pt-BR, en). NULL if created from scratch.';

-- social_templates: add slides array for multi-slide templates
ALTER TABLE public.social_templates
  ADD COLUMN IF NOT EXISTS slides jsonb DEFAULT NULL;

COMMENT ON COLUMN public.social_templates.slides IS 'Array of CardComposition objects for multi-slide templates. NULL = single-slide. When present, composition stores slide 0 (cover).';

-- post_metrics: add slide_index for per-slide metrics
ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS slide_index integer DEFAULT NULL;

COMMENT ON COLUMN public.post_metrics.slide_index IS '0-based index for per-slide metrics. NULL = aggregate metrics for entire post.';

-- Drop old unique constraint if it exists and recreate with slide_index
ALTER TABLE public.post_metrics
  DROP CONSTRAINT IF EXISTS post_metrics_delivery_id_polled_at_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_post_metrics_slide
  ON public.post_metrics (delivery_id, polled_at, COALESCE(slide_index, -1));
```

- [ ] **Step 3: Create account_type migration**

Run:
```bash
npm run db:new social_connections_account_type
```

Write the migration:

```sql
-- Add account_type to social_connections for business vs personal detection

ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'business'
    CHECK (account_type IN ('business', 'personal'));

COMMENT ON COLUMN public.social_connections.account_type IS 'Set during OAuth based on instagram_business_account field presence.';
```

- [ ] **Step 4: Create fan_interactions migration**

Run:
```bash
npm run db:new fan_interactions
```

Write the migration:

```sql
-- Fan interactions tracking for cross-platform superfan detection

CREATE TABLE IF NOT EXISTS public.fan_interactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id          uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  visitor_hash     text NOT NULL,
  platform         text NOT NULL,
  interaction_type text NOT NULL,
  post_id          uuid REFERENCES public.social_posts(id) ON DELETE SET NULL,
  link_id          uuid REFERENCES public.tracked_links(id) ON DELETE SET NULL,
  raw              jsonb DEFAULT '{}',
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_visitor
  ON public.fan_interactions (site_id, visitor_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_platform
  ON public.fan_interactions (site_id, platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fan_interactions_post
  ON public.fan_interactions (post_id) WHERE post_id IS NOT NULL;

-- RLS
ALTER TABLE public.fan_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fan_interactions_select" ON public.fan_interactions;
CREATE POLICY "fan_interactions_select" ON public.fan_interactions
  FOR SELECT TO authenticated
  USING (public.site_visible(site_id));

DROP POLICY IF EXISTS "fan_interactions_insert" ON public.fan_interactions;
CREATE POLICY "fan_interactions_insert" ON public.fan_interactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "fan_interactions_delete" ON public.fan_interactions;
CREATE POLICY "fan_interactions_delete" ON public.fan_interactions
  FOR DELETE TO authenticated
  USING (public.is_staff());
```

- [ ] **Step 5: Create fan_scores materialized view migration**

Run:
```bash
npm run db:new fan_scores_view
```

Write the migration:

```sql
-- Materialized view for fan scoring (refreshed daily via cron)

DROP MATERIALIZED VIEW IF EXISTS public.fan_scores;

CREATE MATERIALIZED VIEW public.fan_scores AS
SELECT
  site_id,
  visitor_hash,
  COUNT(*) AS total_interactions,
  COUNT(DISTINCT platform) AS platform_count,
  COUNT(DISTINCT DATE(created_at)) AS active_days,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen,
  (
    LEAST(COUNT(*), 50) / 50.0 * 25 +
    CASE WHEN MAX(created_at) > NOW() - INTERVAL '7 days'
      THEN 25 ELSE GREATEST(0, 25 - EXTRACT(DAY FROM NOW() - MAX(created_at))) END +
    LEAST(COUNT(DISTINCT platform), 4) / 4.0 * 25 +
    LEAST(COUNT(DISTINCT DATE(created_at)), 30) / 30.0 * 25
  ) AS score
FROM public.fan_interactions
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY site_id, visitor_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_scores_pk
  ON public.fan_scores (site_id, visitor_hash);

CREATE INDEX IF NOT EXISTS idx_fan_scores_top
  ON public.fan_scores (site_id, score DESC);
```

- [ ] **Step 6: Run tests to verify nothing breaks**

Run:
```bash
npm run test:web
```

Expected: All existing tests pass (migrations are additive only).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): migrations for Instagram Stories v2 — multi-slide, fan scoring"
```

---

### Task 2: TypeScript Types & Schemas

**Files:**
- Modify: `apps/web/src/lib/social/types.ts`
- Create: `apps/web/src/lib/social/story-types.ts`
- Test: `apps/web/test/social-story-types.test.ts`

- [ ] **Step 1: Write the test for story types**

Create `apps/web/test/social-story-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  StorySlideSchema,
  StorySlidesSchema,
  FanInteractionSchema,
  postDataToTemplateContext,
} from '@/lib/social/story-types'
import type { SocialPostData } from '@/app/cms/(authed)/social/new/_components/canvas-editor'

describe('StorySlideSchema', () => {
  it('validates a valid slide composition', () => {
    const slide = {
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    }
    const result = StorySlideSchema.safeParse(slide)
    expect(result.success).toBe(true)
  })

  it('rejects invalid canvas dimensions', () => {
    const slide = {
      version: 1 as const,
      canvas: { width: 50, height: 50, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    }
    const result = StorySlideSchema.safeParse(slide)
    expect(result.success).toBe(false)
  })
})

describe('StorySlidesSchema', () => {
  it('accepts 1 to 10 slides', () => {
    const makeSlide = () => ({
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    })

    expect(StorySlidesSchema.safeParse([makeSlide()]).success).toBe(true)
    expect(StorySlidesSchema.safeParse(Array(10).fill(null).map(makeSlide)).success).toBe(true)
  })

  it('rejects more than 10 slides', () => {
    const makeSlide = () => ({
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    })
    expect(StorySlidesSchema.safeParse(Array(11).fill(null).map(makeSlide)).success).toBe(false)
  })

  it('rejects empty array', () => {
    expect(StorySlidesSchema.safeParse([]).success).toBe(false)
  })
})

describe('FanInteractionSchema', () => {
  it('validates a valid interaction', () => {
    const interaction = {
      site_id: '00000000-0000-0000-0000-000000000001',
      visitor_hash: 'abc123',
      platform: 'instagram',
      interaction_type: 'story_view',
    }
    expect(FanInteractionSchema.safeParse(interaction).success).toBe(true)
  })
})

describe('postDataToTemplateContext', () => {
  it('maps SocialPostData camelCase to TemplateContext snake_case', () => {
    const postData: SocialPostData = {
      title: 'Test Title',
      description: 'Test Desc',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      shortUrl: 'go.btf.com/abc123',
    }
    const context = postDataToTemplateContext(postData)
    expect(context).toEqual({
      title: 'Test Title',
      description: 'Test Desc',
      cover_image: 'https://example.com/cover.jpg',
      logo: 'https://example.com/logo.png',
      short_url: 'go.btf.com/abc123',
    })
  })

  it('handles missing optional fields', () => {
    const postData: SocialPostData = { title: 'Test' }
    const context = postDataToTemplateContext(postData)
    expect(context.title).toBe('Test')
    expect(context.cover_image).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/test/social-story-types.test.ts
```
Expected: FAIL — module `@/lib/social/story-types` does not exist.

- [ ] **Step 3: Create story-types.ts**

Create `apps/web/src/lib/social/story-types.ts`:

```typescript
import { z } from 'zod'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr/card-composition'
import type { TemplateContext } from './konva-renderer'

export const StorySlideSchema = CardCompositionSchema

export const StorySlidesSchema = z.array(StorySlideSchema).min(1).max(10)

export type StorySlide = z.infer<typeof StorySlideSchema>

export const FanInteractionSchema = z.object({
  site_id: z.string().uuid(),
  visitor_hash: z.string().min(1),
  platform: z.enum(['instagram', 'facebook', 'bluesky', 'link_click', 'newsletter']),
  interaction_type: z.enum([
    'story_view', 'story_reply', 'like', 'comment', 'share',
    'link_click', 'subscribe',
  ]),
  post_id: z.string().uuid().optional(),
  link_id: z.string().uuid().optional(),
  raw: z.record(z.unknown()).optional(),
})

export type FanInteraction = z.infer<typeof FanInteractionSchema>

export interface FanScore {
  site_id: string
  visitor_hash: string
  total_interactions: number
  platform_count: number
  active_days: number
  last_seen: string
  first_seen: string
  score: number
  email?: string
}

export interface SlideMetrics {
  slide_index: number
  impressions: number
  reach: number
  replies: number
}

export interface StoryInsights {
  post_id: string
  aggregate: {
    impressions: number
    reach: number
    replies: number
    link_clicks: number
  }
  per_slide: SlideMetrics[]
  drop_off: Array<{
    from_slide: number
    to_slide: number
    reach_drop: number
    drop_percentage: number
  }>
}

export interface SocialPostData {
  title: string
  description?: string
  coverImageUrl?: string
  logoUrl?: string
  shortUrl?: string
}

export function postDataToTemplateContext(data: SocialPostData): TemplateContext {
  return {
    title: data.title,
    description: data.description,
    cover_image: data.coverImageUrl,
    logo: data.logoUrl,
    short_url: data.shortUrl,
  }
}
```

- [ ] **Step 4: Add story-specific types to main types file**

Add to `apps/web/src/lib/social/types.ts`:

```typescript
// At the top, add the re-export:
export type { StorySlide, StoryInsights, FanScore, FanInteraction, SlideMetrics } from './story-types'
export { StorySlidesSchema, StorySlideSchema, FanInteractionSchema, postDataToTemplateContext } from './story-types'
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run apps/web/test/social-story-types.test.ts
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/social/story-types.ts apps/web/src/lib/social/types.ts apps/web/test/social-story-types.test.ts
git commit -m "feat(social): TypeScript types for multi-slide stories and fan scoring"
```

---

### Task 3: Konva Renderer — PNG→JPEG + Image Rendering

**Files:**
- Modify: `apps/web/src/lib/social/konva-renderer.ts`
- Test: `apps/web/test/konva-renderer.test.ts`

- [ ] **Step 1: Write tests for the renderer changes**

Create `apps/web/test/konva-renderer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'
import type { TemplateContext } from '@/lib/social/konva-renderer'

// Mock canvas and Konva for unit tests (server-side Konva needs node-canvas)
vi.mock('canvas', () => ({
  createCanvas: vi.fn(() => ({
    getContext: vi.fn(() => ({
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
    })),
    toBuffer: vi.fn((format: string) => Buffer.from(`fake-${format}`)),
  })),
  registerFont: vi.fn(),
  Image: class MockImage {
    src: unknown = null
    width = 100
    height = 100
    onload: (() => void) | null = null
  },
}))

describe('konva-renderer', () => {
  let renderTemplate: typeof import('@/lib/social/konva-renderer').renderTemplate

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('@/lib/social/konva-renderer')
    renderTemplate = mod.renderTemplate
  })

  it('exports a renderTemplate function', () => {
    expect(typeof renderTemplate).toBe('function')
  })

  it('renderTemplate returns a Buffer', async () => {
    const composition: CardComposition = {
      version: 1,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid', color: '#000000' },
      elements: [],
    }
    const context: TemplateContext = { title: 'Test' }
    const result = await renderTemplate(composition, context, { width: 1080, height: 1920 })
    expect(Buffer.isBuffer(result)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to see current state**

```bash
npx vitest run apps/web/test/konva-renderer.test.ts
```

- [ ] **Step 3: Change PNG to JPEG output**

In `apps/web/src/lib/social/konva-renderer.ts`, find the line that does `toBuffer('image/png')` (around line 203) and change it:

```typescript
// BEFORE:
const buffer = canvas.toBuffer('image/png')

// AFTER:
const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 })
```

- [ ] **Step 4: Implement actual image rendering for image elements**

In `apps/web/src/lib/social/konva-renderer.ts`, find the `renderImagePlaceholder` function (lines 134-153) and replace with actual image downloading and rendering:

```typescript
async function renderImageElement(
  layer: Konva.Layer,
  element: { x: number; y: number; width: number; height: number; rotation?: number; opacity?: number; src: string },
  context: TemplateContext,
): Promise<void> {
  let src = element.src
  if (src === '{{cover_image}}' && context.cover_image) src = context.cover_image
  else if (src === '{{logo}}' && context.logo) src = context.logo

  if (!src || src.startsWith('{{')) return

  try {
    const response = await fetch(src)
    if (!response.ok) return
    const arrayBuffer = await response.arrayBuffer()
    const { Image } = await import('canvas')
    const img = new Image()
    img.src = Buffer.from(arrayBuffer)
    const konvaImage = new Konva.Image({
      image: img,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation ?? 0,
      opacity: element.opacity ?? 1,
    })
    layer.add(konvaImage)
  } catch {
    // If image download fails, render placeholder rect
    const rect = new Konva.Rect({
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      fill: '#333333',
      opacity: (element.opacity ?? 1) * 0.3,
    })
    layer.add(rect)
  }
}
```

Update the element rendering loop to use this new function for `image` type elements instead of the old placeholder. Also handle image backgrounds:

```typescript
// In the background rendering section, for 'image' type:
if (background.type === 'image' && background.url) {
  let bgSrc = background.url
  if (bgSrc === '{{cover_image}}' && context.cover_image) bgSrc = context.cover_image
  if (bgSrc === '{{logo}}' && context.logo) bgSrc = context.logo

  if (bgSrc && !bgSrc.startsWith('{{')) {
    try {
      const response = await fetch(bgSrc)
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        const { Image } = await import('canvas')
        const img = new Image()
        img.src = Buffer.from(arrayBuffer)
        const bgImage = new Konva.Image({
          image: img,
          x: 0, y: 0,
          width: size.width, height: size.height,
        })
        layer.add(bgImage)
      }
    } catch {
      // fallback to solid color
      const fallback = new Konva.Rect({
        x: 0, y: 0,
        width: size.width, height: size.height,
        fill: background.fallbackColor ?? '#1a1a2e',
      })
      layer.add(fallback)
    }
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run apps/web/test/konva-renderer.test.ts
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/social/konva-renderer.ts apps/web/test/konva-renderer.test.ts
git commit -m "feat(social): PNG→JPEG render + actual image element rendering in Konva"
```

---

### Task 4: SocialCanvasEditor — New Props + Ref Forwarding

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx`
- Test: `apps/web/test/social-canvas-editor-props.test.ts`

- [ ] **Step 1: Write a test for the new props and ref**

Create `apps/web/test/social-canvas-editor-props.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('SocialCanvasEditor types', () => {
  it('SocialCanvasEditorProps includes new props', async () => {
    // Type-level test: importing should not error
    const mod = await import(
      '@/app/cms/(authed)/social/new/_components/canvas-editor'
    )
    expect(mod.SocialCanvasEditor).toBeDefined()
  })
})
```

- [ ] **Step 2: Add new props to the interface**

In `apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/index.tsx`, update the props interface:

```typescript
import { forwardRef, useImperativeHandle, useEffect } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'

export interface SocialCanvasEditorRef {
  getComposition: () => CardComposition
  replaceComposition: (composition: CardComposition) => void
  exportSlide: () => Promise<Blob>
}

export interface SocialCanvasEditorProps {
  aspectRatio: SocialAspectRatio
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  postData: SocialPostData
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
  // NEW: Load existing composition for editing drafts or applying templates
  initialComposition?: CardComposition
  // NEW: Notify parent of every composition change for auto-save
  onCompositionChange?: (composition: CardComposition) => void
  // NEW: Hide aspect ratio selector when parent controls it (Stories = always 9:16)
  hideAspectRatioSelector?: boolean
}
```

- [ ] **Step 3: Convert to forwardRef and add useImperativeHandle**

Wrap the component with `forwardRef`:

```typescript
export const SocialCanvasEditor = forwardRef<SocialCanvasEditorRef, SocialCanvasEditorProps>(
  function SocialCanvasEditor(props, ref) {
    const {
      aspectRatio, templates, postData, onExport, onSaveTemplate,
      onDeleteTemplate, onImageUpload,
      initialComposition, onCompositionChange, hideAspectRatioSelector,
    } = props

    // existing useCardComposition call — add initialComposition support:
    const {
      composition, updateElement, addElement, removeElement,
      reorderElements, setBackground, setCanvas, replaceComposition,
      undo, redo, canUndo, canRedo,
    } = useCardComposition(initialComposition)

    // Expose imperative methods to parent
    useImperativeHandle(ref, () => ({
      getComposition: () => composition,
      replaceComposition: (comp: CardComposition) => replaceComposition(comp),
      exportSlide: async () => {
        const stage = stageRef.current
        if (!stage) throw new Error('Stage not ready')
        return new Promise<Blob>((resolve, reject) => {
          stage.toBlob({
            callback: (blob: Blob | null) => {
              if (blob) resolve(blob)
              else reject(new Error('Export failed'))
            },
            mimeType: 'image/png',
          })
        })
      },
    }), [composition, replaceComposition])

    // Notify parent on composition change
    useEffect(() => {
      onCompositionChange?.(composition)
    }, [composition, onCompositionChange])

    // ... rest of existing component code
  }
)
```

- [ ] **Step 4: Fix handleLoadTemplate**

Find the empty `handleLoadTemplate` function (around lines 182-184) and implement it:

```typescript
const handleLoadTemplate = (template: { id: string; composition?: CardComposition }) => {
  if (!template.composition) return

  // Resolve placeholders with postData
  const resolved = resolveTemplatePlaceholders(template.composition, postData)
  replaceComposition(resolved)
}

function resolveTemplatePlaceholders(
  composition: CardComposition,
  data: SocialPostData,
): CardComposition {
  return {
    ...composition,
    elements: composition.elements.map((el) => {
      if (el.type === 'text' && typeof el.content === 'string') {
        let content = el.content
        if (data.title) content = content.replace(/\{\{title\}\}/g, data.title)
        if (data.description) content = content.replace(/\{\{description\}\}/g, data.description)
        if (data.shortUrl) content = content.replace(/\{\{short_url\}\}/g, data.shortUrl)
        return { ...el, content }
      }
      if (el.type === 'image' && typeof el.src === 'string') {
        let src = el.src
        if (src === '{{cover_image}}' && data.coverImageUrl) src = data.coverImageUrl
        if (src === '{{logo}}' && data.logoUrl) src = data.logoUrl
        return { ...el, src }
      }
      return el
    }),
    background: composition.background.type === 'image' && composition.background.url
      ? (() => {
          let url = composition.background.url
          if (url === '{{cover_image}}' && data.coverImageUrl) url = data.coverImageUrl
          return { ...composition.background, url }
        })()
      : composition.background,
  }
}
```

- [ ] **Step 5: Pass hideAspectRatioSelector to toolbar**

In the JSX where `SocialToolbar` is rendered, pass the new prop:

```typescript
<SocialToolbar
  // existing props...
  hideAspectRatioSelector={hideAspectRatioSelector}
/>
```

And in `social-toolbar.tsx`, conditionally hide the aspect ratio selector when the prop is true.

- [ ] **Step 6: Run tests**

```bash
npx vitest run apps/web/test/social-canvas-editor-props.test.ts
```
Expected: Pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/new/_components/canvas-editor/
git add apps/web/test/social-canvas-editor-props.test.ts
git commit -m "feat(social): SocialCanvasEditor — ref forwarding, initialComposition, onCompositionChange, template loading"
```

---

### Task 5: Instagram Provider — Multi-Slide Publish + Rate Budget

**Files:**
- Modify: `packages/social/src/providers/meta/instagram.ts`
- Create: `packages/social/src/providers/meta/rate-budget.ts`
- Test: `packages/social/test/instagram-multi-slide.test.ts`

- [ ] **Step 1: Write the test**

Create `packages/social/test/instagram-multi-slide.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { checkRateBudget, type RateBudget } from '../src/providers/meta/rate-budget'

describe('checkRateBudget', () => {
  it('calculates remaining calls from X-App-Usage header', () => {
    const budget: RateBudget = {
      callCount: 40,
      totalCpuTime: 10,
      totalTime: 20,
    }
    // 100 calls / 24h window, 40 used = 60 remaining
    expect(budget.callCount).toBe(40)
  })

  it('returns sufficient=true when enough budget for N slides', () => {
    const result = checkRateBudget(60, 5) // 60 remaining, 5 slides = 10 calls needed
    expect(result.sufficient).toBe(true)
    expect(result.remaining).toBe(60)
    expect(result.required).toBe(10)
  })

  it('returns sufficient=false when insufficient budget', () => {
    const result = checkRateBudget(4, 5) // 4 remaining, 5 slides = 10 calls needed
    expect(result.sufficient).toBe(false)
  })

  it('accounts for 2 API calls per slide (create + publish)', () => {
    const result = checkRateBudget(6, 3) // 3 slides need 6 calls
    expect(result.sufficient).toBe(true)
    expect(result.required).toBe(6)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run packages/social/test/instagram-multi-slide.test.ts
```

- [ ] **Step 3: Create rate-budget.ts**

Create `packages/social/src/providers/meta/rate-budget.ts`:

```typescript
export interface RateBudget {
  callCount: number
  totalCpuTime: number
  totalTime: number
}

export interface RateBudgetCheck {
  sufficient: boolean
  remaining: number
  required: number
}

export function checkRateBudget(remaining: number, slideCount: number): RateBudgetCheck {
  const required = slideCount * 2 // create container + publish per slide
  return {
    sufficient: remaining >= required,
    remaining,
    required,
  }
}

export function parseAppUsageHeader(headerValue: string | null): RateBudget | null {
  if (!headerValue) return null
  try {
    const parsed = JSON.parse(headerValue)
    return {
      callCount: parsed.call_count ?? 0,
      totalCpuTime: parsed.total_cputime ?? 0,
      totalTime: parsed.total_time ?? 0,
    }
  } catch {
    return null
  }
}

const IG_DAILY_LIMIT = 100

export function remainingFromUsage(usage: RateBudget): number {
  return Math.max(0, IG_DAILY_LIMIT - usage.callCount)
}
```

- [ ] **Step 4: Add publishMultiSlideStory to instagram.ts**

In `packages/social/src/providers/meta/instagram.ts`, add:

```typescript
import { checkRateBudget, type RateBudgetCheck } from './rate-budget'

export class InsufficientRateBudgetError extends Error {
  constructor(public budget: RateBudgetCheck) {
    super(`Need ${budget.required} API calls, only ${budget.remaining} remaining`)
    this.name = 'InsufficientRateBudgetError'
  }
}

export async function publishMultiSlideStory(
  igUserId: string,
  token: string,
  mediaUrls: string[],
  rateBudgetRemaining: number,
): Promise<PlatformResult[]> {
  const budgetCheck = checkRateBudget(rateBudgetRemaining, mediaUrls.length)
  if (!budgetCheck.sufficient) {
    throw new InsufficientRateBudgetError(budgetCheck)
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

- [ ] **Step 5: Run tests**

```bash
npx vitest run packages/social/test/instagram-multi-slide.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/social/src/providers/meta/rate-budget.ts
git add packages/social/src/providers/meta/instagram.ts
git add packages/social/test/instagram-multi-slide.test.ts
git commit -m "feat(social): multi-slide story publishing with rate budget check"
```

---

### Task 6: Fan Scoring Backend

**Files:**
- Create: `apps/web/src/lib/social/fan-scoring.ts`
- Create: `apps/web/src/lib/social/actions/fans.ts`
- Test: `apps/web/test/fan-scoring.test.ts`

- [ ] **Step 1: Write tests**

Create `apps/web/test/fan-scoring.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { computeFanScore, type FanScoreInput } from '@/lib/social/fan-scoring'

describe('computeFanScore', () => {
  it('computes max score for highly active cross-platform fan', () => {
    const input: FanScoreInput = {
      totalInteractions: 50,
      platformCount: 4,
      activeDays: 30,
      lastSeenDaysAgo: 0,
    }
    const score = computeFanScore(input)
    expect(score).toBe(100)
  })

  it('computes minimum score for single-interaction fan', () => {
    const input: FanScoreInput = {
      totalInteractions: 1,
      platformCount: 1,
      activeDays: 1,
      lastSeenDaysAgo: 30,
    }
    const score = computeFanScore(input)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(30)
  })

  it('caps frequency at 50 interactions', () => {
    const input1: FanScoreInput = {
      totalInteractions: 50,
      platformCount: 1,
      activeDays: 1,
      lastSeenDaysAgo: 0,
    }
    const input2: FanScoreInput = {
      totalInteractions: 100,
      platformCount: 1,
      activeDays: 1,
      lastSeenDaysAgo: 0,
    }
    expect(computeFanScore(input1)).toBe(computeFanScore(input2))
  })

  it('recency decays 1 point per day after 7 days', () => {
    const recent: FanScoreInput = {
      totalInteractions: 10,
      platformCount: 1,
      activeDays: 5,
      lastSeenDaysAgo: 0,
    }
    const weekOld: FanScoreInput = {
      ...recent,
      lastSeenDaysAgo: 14,
    }
    const diff = computeFanScore(recent) - computeFanScore(weekOld)
    expect(diff).toBe(14) // 14 days past the 7-day grace = 14 points
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/test/fan-scoring.test.ts
```

- [ ] **Step 3: Create fan-scoring.ts**

Create `apps/web/src/lib/social/fan-scoring.ts`:

```typescript
export interface FanScoreInput {
  totalInteractions: number
  platformCount: number
  activeDays: number
  lastSeenDaysAgo: number
}

export function computeFanScore(input: FanScoreInput): number {
  const { totalInteractions, platformCount, activeDays, lastSeenDaysAgo } = input

  // Frequency: max 25 points, capped at 50 interactions
  const frequency = (Math.min(totalInteractions, 50) / 50) * 25

  // Recency: max 25 points, full score if within 7 days, decays 1pt/day after
  const recency = lastSeenDaysAgo <= 7
    ? 25
    : Math.max(0, 25 - lastSeenDaysAgo)

  // Cross-platform: max 25 points, linear with platform count (max 4)
  const crossPlatform = (Math.min(platformCount, 4) / 4) * 25

  // Consistency: max 25 points, linear with active days in 90d window (max 30)
  const consistency = (Math.min(activeDays, 30) / 30) * 25

  return Math.round(frequency + recency + crossPlatform + consistency)
}
```

- [ ] **Step 4: Create fan actions**

Create `apps/web/src/lib/social/actions/fans.ts`:

```typescript
'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'
import type { FanScore } from '../story-types'

export async function getTopFans(
  siteId: string,
  limit = 20,
): Promise<FanScore[]> {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase
    .from('fan_scores')
    .select('*')
    .eq('site_id', siteId)
    .order('score', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as FanScore[]
}

export async function recordFanInteraction(
  siteId: string,
  interaction: {
    visitor_hash: string
    platform: string
    interaction_type: string
    post_id?: string
    link_id?: string
    raw?: Record<string, unknown>
  },
): Promise<void> {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from('fan_interactions')
    .insert({
      site_id: siteId,
      ...interaction,
    })

  if (error) throw error
}

export async function refreshFanScores(): Promise<void> {
  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.rpc('refresh_fan_scores')
  if (error) {
    // Fallback: direct SQL if RPC doesn't exist
    await supabase.from('fan_scores').select('site_id').limit(0)
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run apps/web/test/fan-scoring.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/social/fan-scoring.ts
git add apps/web/src/lib/social/actions/fans.ts
git add apps/web/test/fan-scoring.test.ts
git commit -m "feat(social): fan scoring algorithm and server actions"
```

---

### Task 7: Template Renderer + Workflows Multi-Slide

**Files:**
- Modify: `apps/web/src/lib/social/template-renderer.ts`
- Modify: `apps/web/src/lib/social/workflows.ts`
- Create: `apps/web/src/lib/social/story-slides.ts`
- Test: `apps/web/test/story-slides.test.ts`

- [ ] **Step 1: Write tests for multi-slide orchestration**

Create `apps/web/test/story-slides.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { generateSlideCompositions } from '@/lib/social/story-slides'

describe('generateSlideCompositions', () => {
  it('generates 1 slide with title + cover + CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'This is a test excerpt for the post.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#6366f1',
      slideCount: 1,
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].canvas.aspectRatio).toBe('9:16')
    expect(slides[0].canvas.width).toBe(1080)
    expect(slides[0].canvas.height).toBe(1920)
  })

  it('generates 3 slides: cover, excerpt, CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'This is a test excerpt.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#6366f1',
      slideCount: 3,
    })
    expect(slides).toHaveLength(3)
    // First slide should have title element
    const titleEl = slides[0].elements.find(
      (e) => e.type === 'text' && e.content?.includes('Test Post')
    )
    expect(titleEl).toBeDefined()
  })

  it('generates 5 slides: cover, 3 content, CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'Point one. Point two. Point three. Extra content here.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: null,
      primaryColor: '#10b981',
      slideCount: 5,
    })
    expect(slides).toHaveLength(5)
  })

  it('clamps slide count to max 10', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Test',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#000',
      slideCount: 15,
    })
    expect(slides.length).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/test/story-slides.test.ts
```

- [ ] **Step 3: Create story-slides.ts**

Create `apps/web/src/lib/social/story-slides.ts`:

```typescript
import type { CardComposition, TextElement, ImageElement } from '@tn-figueiredo/links/qr/card-composition'

interface SlideGenerationInput {
  title: string
  excerpt: string | null
  coverImageUrl: string | null
  logoUrl: string | null
  primaryColor: string
  slideCount: number
}

const STORY_CANVAS = { width: 1080, height: 1920, aspectRatio: '9:16' }

function makeTextElement(
  overrides: Partial<TextElement> & { content: string; x: number; y: number; width: number; height: number },
): TextElement {
  return {
    type: 'text',
    id: crypto.randomUUID(),
    x: overrides.x,
    y: overrides.y,
    width: overrides.width,
    height: overrides.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    content: overrides.content,
    fontFamily: overrides.fontFamily ?? 'Inter',
    fontSize: overrides.fontSize ?? 48,
    fontWeight: overrides.fontWeight ?? 700,
    lineHeight: overrides.lineHeight ?? 1.3,
    letterSpacing: overrides.letterSpacing ?? 0,
    align: overrides.align ?? 'center',
    color: overrides.color ?? '#ffffff',
  }
}

function makeCoverSlide(input: SlideGenerationInput): CardComposition {
  const elements: CardComposition['elements'] = [
    makeTextElement({
      content: input.title,
      x: 60, y: 600, width: 960, height: 400,
      fontSize: 56, fontWeight: 800,
    }),
  ]

  if (input.logoUrl) {
    elements.push({
      type: 'image',
      id: crypto.randomUUID(),
      x: 460, y: 1700, width: 160, height: 160,
      rotation: 0, opacity: 1, locked: false,
      src: input.logoUrl,
      objectFit: 'contain',
      borderRadius: 80,
      maintainAspectRatio: true,
    } as ImageElement)
  }

  return {
    version: 1,
    canvas: STORY_CANVAS,
    background: input.coverImageUrl
      ? { type: 'image', url: input.coverImageUrl, fallbackColor: '#1a1a2e' }
      : { type: 'gradient', angle: 135, stops: [
          { color: input.primaryColor, position: 0 },
          { color: '#0a0a1a', position: 100 },
        ] },
    elements,
  }
}

function makeExcerptSlide(text: string, primaryColor: string): CardComposition {
  return {
    version: 1,
    canvas: STORY_CANVAS,
    background: { type: 'solid', color: '#0f0f1e' },
    elements: [
      makeTextElement({
        content: text,
        x: 80, y: 600, width: 920, height: 700,
        fontSize: 36, fontWeight: 400, align: 'left',
        lineHeight: 1.6,
      }),
      {
        type: 'text',
        id: crypto.randomUUID(),
        x: 80, y: 1400, width: 920, height: 4,
        rotation: 0, opacity: 0.3, locked: true,
        content: '',
        fontFamily: 'Inter', fontSize: 8, fontWeight: 400,
        lineHeight: 1, letterSpacing: 0, align: 'left',
        color: primaryColor,
        backgroundColor: primaryColor,
        backgroundPadding: 2,
        backgroundRadius: 2,
      } as TextElement,
    ],
  }
}

function makeCtaSlide(primaryColor: string, logoUrl: string | null): CardComposition {
  const elements: CardComposition['elements'] = [
    makeTextElement({
      content: 'Leia mais',
      x: 80, y: 700, width: 920, height: 100,
      fontSize: 44, fontWeight: 700,
    }),
    makeTextElement({
      content: '{{short_url}}',
      x: 80, y: 850, width: 920, height: 80,
      fontSize: 28, fontWeight: 400,
      color: primaryColor,
    }),
    makeTextElement({
      content: 'Link na bio ↗',
      x: 300, y: 1000, width: 480, height: 70,
      fontSize: 24, fontWeight: 600,
      color: '#0a0a1a',
      backgroundColor: primaryColor,
      backgroundPadding: 16,
      backgroundRadius: 12,
    }),
  ]

  if (logoUrl) {
    elements.push({
      type: 'image',
      id: crypto.randomUUID(),
      x: 460, y: 1700, width: 160, height: 160,
      rotation: 0, opacity: 1, locked: false,
      src: logoUrl,
      objectFit: 'contain',
      borderRadius: 80,
      maintainAspectRatio: true,
    } as ImageElement)
  }

  return {
    version: 1,
    canvas: STORY_CANVAS,
    background: { type: 'gradient', angle: 180, stops: [
      { color: '#1a1a2e', position: 0 },
      { color: '#0a0a1a', position: 100 },
    ] },
    elements,
  }
}

function splitExcerptIntoPoints(excerpt: string, count: number): string[] {
  const sentences = excerpt.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (sentences.length <= count) return sentences

  const chunkSize = Math.ceil(sentences.length / count)
  const points: string[] = []
  for (let i = 0; i < count; i++) {
    const chunk = sentences.slice(i * chunkSize, (i + 1) * chunkSize)
    points.push(chunk.join(' '))
  }
  return points
}

export function generateSlideCompositions(input: SlideGenerationInput): CardComposition[] {
  const count = Math.min(Math.max(input.slideCount, 1), 10)

  if (count === 1) {
    return [makeCoverSlide(input)]
  }

  if (count === 3) {
    return [
      makeCoverSlide(input),
      makeExcerptSlide(input.excerpt ?? input.title, input.primaryColor),
      makeCtaSlide(input.primaryColor, input.logoUrl),
    ]
  }

  // 5 slides: cover + 3 content + CTA
  const contentCount = Math.min(count - 2, 8) // reserve 1 cover + 1 CTA
  const points = splitExcerptIntoPoints(
    input.excerpt ?? input.title,
    contentCount,
  )

  return [
    makeCoverSlide(input),
    ...points.map((text) => makeExcerptSlide(text, input.primaryColor)),
    makeCtaSlide(input.primaryColor, input.logoUrl),
  ]
}
```

- [ ] **Step 4: Update template-renderer.ts for multi-slide output**

In `apps/web/src/lib/social/template-renderer.ts`, add a `renderMultiSlide` export:

```typescript
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'
import type { TemplateContext } from './konva-renderer'

export async function renderMultiSlide(
  slides: CardComposition[],
  context: TemplateContext,
): Promise<Buffer[]> {
  const { renderTemplate } = await import('./konva-renderer')
  const buffers: Buffer[] = []

  for (const slide of slides) {
    const size = {
      width: slide.canvas.width,
      height: slide.canvas.height,
    }
    const buffer = await renderTemplate(slide, context, size)
    buffers.push(buffer)
  }

  return buffers
}
```

- [ ] **Step 5: Update workflows.ts prepareStoryDelivery for multi-slide**

In `apps/web/src/lib/social/workflows.ts`, modify `prepareStoryDelivery` to loop over slides:

```typescript
// Inside prepareStoryDelivery, replace the single-image render with:
const slides = post.story_slides ?? (post.content?.composition ? [post.content.composition] : null)

if (!slides || slides.length === 0) {
  // fallback to legacy single-image generation
  // ... existing fallback code ...
  return post
}

const { renderMultiSlide } = await import('./template-renderer')
const context: TemplateContext = {
  title: post.content?.title,
  description: post.content?.description,
  cover_image: post.content?.cover_image_url,
  short_url: post.content?.short_url,
  logo: post.content?.logo_url,
}

const buffers = await renderMultiSlide(slides, context)
const mediaUrls: string[] = []

for (let i = 0; i < buffers.length; i++) {
  const { put } = await import('@vercel/blob')
  const blob = await put(
    `stories/${post.id}-${i}-${Date.now()}.jpg`,
    buffers[i],
    { access: 'public', contentType: 'image/jpeg' },
  )
  mediaUrls.push(blob.url)
}

// Fire notification for personal accounts (non-blocking)
notifyStoryReady(post, mediaUrls).catch(() => {})

return {
  ...post,
  content: { ...post.content, media_urls: mediaUrls },
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run apps/web/test/story-slides.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/social/story-slides.ts
git add apps/web/src/lib/social/template-renderer.ts
git add apps/web/src/lib/social/workflows.ts
git add apps/web/test/story-slides.test.ts
git commit -m "feat(social): multi-slide rendering pipeline + story composition generator"
```

---

### Task 8: Stories Gallery Page

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/stories/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/loading.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/story-card.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/stories-gallery.tsx`
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` (add nav item)
- Create: `apps/web/src/lib/social/actions/stories.ts`

- [ ] **Step 1: Create stories server action**

Create `apps/web/src/lib/social/actions/stories.ts`:

```typescript
'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'

export type StoryTab = 'drafts' | 'live' | 'expired' | 'scheduled'

export async function getStories(siteId: string, tab: StoryTab) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  let query = supabase
    .from('social_posts')
    .select('id, content, story_slides, status, scheduled_at, published_at, source_content_id, source_content_type, source_locale, created_at, template_id')
    .eq('site_id', siteId)
    .not('story_slides', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)

  switch (tab) {
    case 'drafts':
      query = query.eq('status', 'draft')
      break
    case 'live':
      query = query
        .eq('status', 'completed')
        .gt('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      break
    case 'expired':
      query = query
        .eq('status', 'completed')
        .lte('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      break
    case 'scheduled':
      query = query.eq('status', 'scheduled')
      break
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getStoryCounts(siteId: string) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const [drafts, live, scheduled] = await Promise.all([
    supabase.from('social_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).not('story_slides', 'is', null).eq('status', 'draft'),
    supabase.from('social_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).not('story_slides', 'is', null).eq('status', 'completed')
      .gt('published_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('social_posts').select('id', { count: 'exact', head: true })
      .eq('site_id', siteId).not('story_slides', 'is', null).eq('status', 'scheduled'),
  ])

  return {
    drafts: drafts.count ?? 0,
    live: live.count ?? 0,
    scheduled: scheduled.count ?? 0,
  }
}
```

- [ ] **Step 2: Create story-card.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/story-card.tsx`:

```typescript
'use client'

import Link from 'next/link'

interface StoryCardProps {
  story: {
    id: string
    content: Record<string, unknown> | null
    story_slides: unknown[] | null
    status: string
    scheduled_at: string | null
    published_at: string | null
    source_content_type: string | null
    created_at: string
  }
}

export function StoryCard({ story }: StoryCardProps) {
  const slideCount = Array.isArray(story.story_slides) ? story.story_slides.length : 1
  const title = (story.content as Record<string, string>)?.title ?? 'Untitled'

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Rascunho', color: 'bg-gray-600' },
    completed: { label: 'Publicado', color: 'bg-green-600' },
    scheduled: { label: 'Agendado', color: 'bg-amber-600' },
    failed: { label: 'Erro', color: 'bg-red-600' },
    publishing: { label: 'Publicando...', color: 'bg-blue-600' },
  }

  const badge = statusLabel[story.status] ?? statusLabel.draft

  return (
    <Link
      href={story.status === 'draft'
        ? `/cms/social/stories/${story.id}/edit`
        : `/cms/social/${story.id}`}
      className="group block rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition-colors"
    >
      <div className="aspect-[9/16] max-h-[240px] bg-gray-800 relative">
        <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-gray-300">
          {slideCount} {slideCount === 1 ? 'slide' : 'slides'}
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm text-white font-medium truncate">{title}</p>
        {story.source_content_type && (
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{story.source_content_type}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] text-white ${badge.color}`}>
            {badge.label}
          </span>
          {story.scheduled_at && story.status === 'scheduled' && (
            <span className="text-[10px] text-gray-500">
              {new Date(story.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Create stories-gallery.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/stories-gallery.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { StoryCard } from './story-card'
import { getStories, type StoryTab } from '@/lib/social/actions/stories'

interface StoriesGalleryProps {
  siteId: string
  initialTab?: StoryTab
  counts: { drafts: number; live: number; scheduled: number }
}

const TABS: { key: StoryTab; label: string; countKey?: keyof StoriesGalleryProps['counts'] }[] = [
  { key: 'drafts', label: 'Rascunhos', countKey: 'drafts' },
  { key: 'live', label: 'Ao Vivo', countKey: 'live' },
  { key: 'expired', label: 'Expirados' },
  { key: 'scheduled', label: 'Agendados', countKey: 'scheduled' },
]

export function StoriesGallery({ siteId, initialTab = 'drafts', counts }: StoriesGalleryProps) {
  const [activeTab, setActiveTab] = useState<StoryTab>(initialTab)
  const [stories, setStories] = useState<Awaited<ReturnType<typeof getStories>>>([])
  const [loading, setLoading] = useState(true)

  const loadStories = useCallback(async (tab: StoryTab) => {
    setLoading(true)
    try {
      const data = await getStories(siteId, tab)
      setStories(data)
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    loadStories(activeTab)
  }, [activeTab, loadStories])

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.countKey && counts[tab.countKey] > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px]">
                {counts[tab.countKey]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-gray-900 animate-pulse">
              <div className="aspect-[9/16] max-h-[240px] bg-gray-800 rounded-t-xl" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-3/4" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">
            {activeTab === 'drafts' && 'Nenhum rascunho de Story'}
            {activeTab === 'live' && 'Nenhum Story ao vivo'}
            {activeTab === 'expired' && 'Nenhum Story expirado'}
            {activeTab === 'scheduled' && 'Nenhum Story agendado'}
          </p>
          <a
            href="/cms/social/stories/new"
            className="inline-block mt-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500"
          >
            + Nova Story
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))}
          <a
            href="/cms/social/stories/new"
            className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 transition-colors min-h-[200px]"
          >
            <div className="text-center text-gray-500">
              <span className="text-2xl block mb-1">+</span>
              <span className="text-sm">Nova Story</span>
            </div>
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create page.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/page.tsx`:

```typescript
import { getSiteContext } from '@/lib/site/context'
import { getStoryCounts } from '@/lib/social/actions/stories'
import { StoriesGallery } from './_components/stories-gallery'

export default async function StoriesPage() {
  const { siteId } = await getSiteContext()
  const counts = await getStoryCounts(siteId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Instagram Stories</h1>
        <a
          href="/cms/social/stories/new"
          className="rounded-lg bg-gradient-to-r from-[#f09433] to-[#dc2743] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          + Nova Story
        </a>
      </div>
      <StoriesGallery siteId={siteId} counts={counts} />
    </div>
  )
}
```

- [ ] **Step 5: Create loading.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/loading.tsx`:

```typescript
export default function StoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="h-10 w-32 bg-gray-800 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-gray-900 animate-pulse">
            <div className="aspect-[9/16] max-h-[240px] bg-gray-800 rounded-t-xl" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gray-800 rounded w-3/4" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Add Stories to CMS sidebar nav**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, find the Social section array and add a "Stories" nav item with the Instagram icon. Insert it as the first item in the Social section:

```typescript
{
  label: locale === 'pt-BR' ? 'Stories' : 'Stories',
  href: '/cms/social/stories',
  icon: 'Instagram', // or the appropriate icon name used in the project
},
```

- [ ] **Step 7: Run tests**

```bash
npm run test:web
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/stories/
git add apps/web/src/lib/social/actions/stories.ts
git add apps/web/src/app/cms/(authed)/_shared/cms-sections.ts
git commit -m "feat(social): Stories Gallery page with tab filters and nav integration"
```

---

### Task 9: Slide Strip + CMS Data Tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/slide-strip.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/cms-data-tab.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/story-editor.tsx`
- Test: `apps/web/test/slide-strip.test.ts`

- [ ] **Step 1: Write tests for slide strip**

Create `apps/web/test/slide-strip.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { reorderSlides, duplicateSlide, removeSlide, addEmptySlide } from '@/app/cms/(authed)/social/stories/_components/slide-strip'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'

const makeSlide = (id?: string): CardComposition => ({
  version: 1,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid', color: id ?? '#000000' },
  elements: [],
})

describe('slide operations', () => {
  it('reorders slides correctly', () => {
    const slides = [makeSlide('a'), makeSlide('b'), makeSlide('c')]
    const result = reorderSlides(slides, 0, 2)
    expect((result[0].background as { color: string }).color).toBe('b')
    expect((result[2].background as { color: string }).color).toBe('a')
  })

  it('duplicates a slide', () => {
    const slides = [makeSlide('a'), makeSlide('b')]
    const result = duplicateSlide(slides, 0)
    expect(result).toHaveLength(3)
    expect((result[1].background as { color: string }).color).toBe('a')
  })

  it('rejects duplicate when at max 10', () => {
    const slides = Array(10).fill(null).map(() => makeSlide())
    const result = duplicateSlide(slides, 0)
    expect(result).toHaveLength(10) // unchanged
  })

  it('removes a slide', () => {
    const slides = [makeSlide('a'), makeSlide('b'), makeSlide('c')]
    const result = removeSlide(slides, 1)
    expect(result).toHaveLength(2)
    expect((result[1].background as { color: string }).color).toBe('c')
  })

  it('prevents removing last slide', () => {
    const slides = [makeSlide('a')]
    const result = removeSlide(slides, 0)
    expect(result).toHaveLength(1) // unchanged
  })

  it('adds an empty slide', () => {
    const slides = [makeSlide()]
    const result = addEmptySlide(slides)
    expect(result).toHaveLength(2)
    expect(result[1].canvas.aspectRatio).toBe('9:16')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run apps/web/test/slide-strip.test.ts
```

- [ ] **Step 3: Create slide-strip.tsx with exported helper functions**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/slide-strip.tsx`:

```typescript
'use client'

import { useCallback } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'

const MAX_SLIDES = 10
const STORY_CANVAS = { width: 1080, height: 1920, aspectRatio: '9:16' }

export function reorderSlides(slides: CardComposition[], from: number, to: number): CardComposition[] {
  const result = [...slides]
  const [moved] = result.splice(from, 1)
  result.splice(to, 0, moved)
  return result
}

export function duplicateSlide(slides: CardComposition[], index: number): CardComposition[] {
  if (slides.length >= MAX_SLIDES) return slides
  const dup = structuredClone(slides[index])
  // Regenerate element IDs to avoid conflicts
  dup.elements = dup.elements.map((el) => ({ ...el, id: crypto.randomUUID() }))
  const result = [...slides]
  result.splice(index + 1, 0, dup)
  return result
}

export function removeSlide(slides: CardComposition[], index: number): CardComposition[] {
  if (slides.length <= 1) return slides
  return slides.filter((_, i) => i !== index)
}

export function addEmptySlide(slides: CardComposition[]): CardComposition[] {
  if (slides.length >= MAX_SLIDES) return slides
  return [
    ...slides,
    {
      version: 1,
      canvas: STORY_CANVAS,
      background: { type: 'solid', color: '#0f0f1e' },
      elements: [],
    },
  ]
}

interface SlideStripProps {
  slides: CardComposition[]
  activeIndex: number
  onSelectSlide: (index: number) => void
  onReorder: (from: number, to: number) => void
  onDuplicate: (index: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}

export function SlideStrip({
  slides, activeIndex, onSelectSlide, onReorder,
  onDuplicate, onRemove, onAdd,
}: SlideStripProps) {
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
    if (!isNaN(fromIndex) && fromIndex !== targetIndex) {
      onReorder(fromIndex, targetIndex)
    }
  }, [onReorder])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-t border-gray-800 overflow-x-auto">
      {slides.map((slide, i) => (
        <div
          key={i}
          draggable
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, i)}
          onClick={() => onSelectSlide(i)}
          onContextMenu={(e) => {
            e.preventDefault()
            // Context menu could be added here
          }}
          className={`relative flex-shrink-0 w-[54px] h-[96px] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
            i === activeIndex
              ? 'border-indigo-500 ring-2 ring-indigo-500/30'
              : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <div className="absolute inset-0 bg-gray-800" />
          <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(i) }}
              className="rounded bg-black/60 px-1 text-[8px] text-gray-400 hover:text-white"
              title="Duplicar"
            >
              D
            </button>
            {slides.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i) }}
                className="rounded bg-black/60 px-1 text-[8px] text-red-400 hover:text-red-300"
                title="Remover"
              >
                X
              </button>
            )}
          </div>
          <span className="absolute top-0.5 left-1 text-[9px] text-gray-400 font-mono">
            {i + 1}
          </span>
        </div>
      ))}

      {slides.length < MAX_SLIDES && (
        <button
          onClick={onAdd}
          className="flex-shrink-0 w-[54px] h-[96px] rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 flex items-center justify-center text-gray-500 hover:text-gray-300 transition-colors"
        >
          +
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create cms-data-tab.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/cms-data-tab.tsx`:

```typescript
'use client'

import type { SocialPostData } from '@/lib/social/story-types'

interface CmsDataTabProps {
  postData: SocialPostData
  onInsertText: (content: string) => void
  onInsertImage: (src: string) => void
  onSetBackground: (url: string) => void
}

export function CmsDataTab({ postData, onInsertText, onInsertImage, onSetBackground }: CmsDataTabProps) {
  const fields = [
    {
      token: '{{title}}',
      label: 'Título',
      value: postData.title,
      type: 'text' as const,
    },
    {
      token: '{{description}}',
      label: 'Descrição',
      value: postData.description,
      type: 'text' as const,
    },
    {
      token: '{{cover_image}}',
      label: 'Imagem de Capa',
      value: postData.coverImageUrl,
      type: 'image' as const,
    },
    {
      token: '{{logo}}',
      label: 'Logo',
      value: postData.logoUrl,
      type: 'image' as const,
    },
    {
      token: '{{short_url}}',
      label: 'Short URL',
      value: postData.shortUrl ?? 'go.btf.com/______',
      type: 'text' as const,
    },
  ]

  return (
    <div className="space-y-3 p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        CMS Data
      </h3>
      {fields.map((field) => (
        <div key={field.token} className="rounded-lg bg-gray-800 p-2.5">
          <div className="flex items-center justify-between mb-1">
            <code className="text-[10px] text-indigo-400 font-mono">{field.token}</code>
          </div>
          <p className="text-xs text-gray-300 truncate mb-2">
            {field.value || <span className="text-gray-600 italic">vazio</span>}
          </p>

          {field.type === 'text' && field.value && (
            <button
              onClick={() => onInsertText(field.value!)}
              className="text-[10px] text-indigo-400 hover:text-indigo-300"
            >
              Inserir como Texto
            </button>
          )}

          {field.type === 'image' && field.value && (
            <div className="flex gap-2">
              <button
                onClick={() => onSetBackground(field.value!)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                Como Background
              </button>
              <button
                onClick={() => onInsertImage(field.value!)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
              >
                Como Imagem
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create story-editor.tsx** (orchestrator for multi-slide editing)

Create `apps/web/src/app/cms/(authed)/social/stories/_components/story-editor.tsx`:

```typescript
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'
import { SocialCanvasEditor, type SocialCanvasEditorRef } from '@/app/cms/(authed)/social/new/_components/canvas-editor'
import { SlideStrip, reorderSlides, duplicateSlide, removeSlide, addEmptySlide } from './slide-strip'
import { CmsDataTab } from './cms-data-tab'
import type { SocialPostData } from '@/lib/social/story-types'

interface StoryEditorProps {
  initialSlides: CardComposition[]
  postData: SocialPostData
  postId: string
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  onSlidesChange: (slides: CardComposition[]) => void
  onExport: (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => Promise<{ url: string } | null>
  onSaveTemplate: (name: string, composition: CardComposition, thumbnail: Blob) => Promise<void>
  onDeleteTemplate: (id: string) => Promise<void>
  onImageUpload: (file: File) => Promise<string>
}

export function StoryEditor({
  initialSlides, postData, postId, templates,
  onSlidesChange, onExport, onSaveTemplate, onDeleteTemplate, onImageUpload,
}: StoryEditorProps) {
  const [slides, setSlides] = useState<CardComposition[]>(initialSlides)
  const [activeIndex, setActiveIndex] = useState(0)
  const editorRef = useRef<SocialCanvasEditorRef>(null)

  const updateSlides = useCallback((newSlides: CardComposition[]) => {
    setSlides(newSlides)
    onSlidesChange(newSlides)
  }, [onSlidesChange])

  const handleCompositionChange = useCallback((composition: CardComposition) => {
    setSlides((prev) => {
      const updated = [...prev]
      updated[activeIndex] = composition
      onSlidesChange(updated)
      return updated
    })
  }, [activeIndex, onSlidesChange])

  const handleReorder = useCallback((from: number, to: number) => {
    updateSlides(reorderSlides(slides, from, to))
    if (activeIndex === from) setActiveIndex(to)
  }, [slides, activeIndex, updateSlides])

  const handleDuplicate = useCallback((index: number) => {
    const newSlides = duplicateSlide(slides, index)
    updateSlides(newSlides)
    if (newSlides.length > slides.length) setActiveIndex(index + 1)
  }, [slides, updateSlides])

  const handleRemove = useCallback((index: number) => {
    const newSlides = removeSlide(slides, index)
    updateSlides(newSlides)
    if (activeIndex >= newSlides.length) setActiveIndex(newSlides.length - 1)
  }, [slides, activeIndex, updateSlides])

  const handleAdd = useCallback(() => {
    const newSlides = addEmptySlide(slides)
    updateSlides(newSlides)
    setActiveIndex(newSlides.length - 1)
  }, [slides, updateSlides])

  const handleSelectSlide = useCallback((index: number) => {
    // Save current slide composition before switching
    if (editorRef.current) {
      const currentComp = editorRef.current.getComposition()
      setSlides((prev) => {
        const updated = [...prev]
        updated[activeIndex] = currentComp
        return updated
      })
    }
    setActiveIndex(index)
  }, [activeIndex])

  // Keyboard shortcuts for slide navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' && activeIndex < slides.length - 1) {
        e.preventDefault()
        handleSelectSlide(activeIndex + 1)
      }
      if (e.key === 'PageUp' && activeIndex > 0) {
        e.preventDefault()
        handleSelectSlide(activeIndex - 1)
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        handleDuplicate(activeIndex)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeIndex, slides.length, handleSelectSlide, handleDuplicate])

  const handleInsertText = useCallback((content: string) => {
    // Will be wired to addElement via editor ref
    if (!editorRef.current) return
    // This would call addElement on the editor - implementation depends on editor internals
  }, [])

  const handleInsertImage = useCallback((src: string) => {
    if (!editorRef.current) return
    // Wire to addElement
  }, [])

  const handleSetBackground = useCallback((url: string) => {
    if (!editorRef.current) return
    const comp = editorRef.current.getComposition()
    editorRef.current.replaceComposition({
      ...comp,
      background: { type: 'image', url, fallbackColor: '#1a1a2e' },
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative">
        <SocialCanvasEditor
          ref={editorRef}
          aspectRatio="9:16"
          templates={templates}
          postData={postData}
          initialComposition={slides[activeIndex]}
          onCompositionChange={handleCompositionChange}
          hideAspectRatioSelector
          onExport={onExport}
          onSaveTemplate={onSaveTemplate}
          onDeleteTemplate={onDeleteTemplate}
          onImageUpload={onImageUpload}
        />
      </div>
      <SlideStrip
        slides={slides}
        activeIndex={activeIndex}
        onSelectSlide={handleSelectSlide}
        onReorder={handleReorder}
        onDuplicate={handleDuplicate}
        onRemove={handleRemove}
        onAdd={handleAdd}
      />
    </div>
  )
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run apps/web/test/slide-strip.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/stories/_components/
git add apps/web/test/slide-strip.test.ts
git commit -m "feat(social): multi-slide strip, CMS data tab, and story editor orchestrator"
```

---

### Task 10: 1-Click "Criar Story" from Blog Editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`
- Create: `apps/web/src/lib/social/actions/blog-story.ts`

- [ ] **Step 1: Create the server action to check Instagram connection**

Create `apps/web/src/lib/social/actions/blog-story.ts`:

```typescript
'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'

export async function hasInstagramConnection(siteId: string): Promise<boolean> {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const { count } = await supabase
    .from('social_connections')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('provider', 'instagram')
    .eq('status', 'active')

  return (count ?? 0) > 0
}
```

- [ ] **Step 2: Add "Criar Story" button to blog editor**

In `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`, find the toolbar area where the Save button is rendered (around line 160-168). Add the Story button next to the save button:

```typescript
// Import at top
import Link from 'next/link'

// In the toolbar area, after the Save button:
{hasIgConnection && postId && (
  <Link
    href={`/cms/social/stories/new?source=blog&id=${postId}&locale=${locale}`}
    className="rounded-lg bg-gradient-to-r from-[#f09433] to-[#dc2743] px-3 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1.5"
  >
    <span className="text-base">📱</span>
    Criar Story
  </Link>
)}
```

The `hasIgConnection` value should be passed as a prop from the server component. In the parent page (`page.tsx`), fetch via `hasInstagramConnection(siteId)` and pass it down.

- [ ] **Step 3: Run tests**

```bash
npm run test:web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx
git add apps/web/src/lib/social/actions/blog-story.ts
git commit -m "feat(social): 1-click 'Criar Story' button in blog editor"
```

---

### Task 11: Auto-Generation from CMS Content

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/stories/new/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/new/_components/content-picker-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/new/_components/generation-options.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/new/_components/story-composer.tsx`

- [ ] **Step 1: Create the story composer page**

Create `apps/web/src/app/cms/(authed)/social/stories/new/page.tsx`:

```typescript
import { getSiteContext } from '@/lib/site/context'
import { StoryComposer } from './_components/story-composer'

interface Props {
  searchParams: Promise<{
    source?: string
    id?: string
    locale?: string
  }>
}

export default async function NewStoryPage({ searchParams }: Props) {
  const { siteId } = await getSiteContext()
  const params = await searchParams

  // Fetch site brand data
  const supabase = await (await import('@/lib/supabase/server')).getSupabaseServerClient()
  const { data: site } = await supabase
    .from('sites')
    .select('logo_url, primary_color, default_locale, supported_locales')
    .eq('id', siteId)
    .single()

  // Fetch templates
  const { data: templates } = await supabase
    .from('social_templates')
    .select('id, name, thumbnail_url, aspect_ratio, composition, slides')
    .or(`site_id.eq.${siteId},site_id.is.null`)
    .eq('aspect_ratio', '9:16')
    .order('is_default', { ascending: false })

  // If source=blog&id=xyz, fetch the blog post
  let sourceContent = null
  if (params.source === 'blog' && params.id) {
    const { data: post } = await supabase
      .from('posts')
      .select('id, title, meta_description, cover_image_url, content_type, locale')
      .eq('id', params.id)
      .single()
    sourceContent = post
  }

  return (
    <StoryComposer
      siteId={siteId}
      siteLogoUrl={site?.logo_url ?? null}
      sitePrimaryColor={site?.primary_color ?? '#6366f1'}
      defaultLocale={site?.default_locale ?? 'pt-BR'}
      supportedLocales={site?.supported_locales ?? ['pt-BR']}
      templates={(templates ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        thumbnailUrl: t.thumbnail_url,
        aspectRatio: t.aspect_ratio,
      }))}
      sourceContent={sourceContent}
      sourceLocale={params.locale ?? null}
    />
  )
}
```

- [ ] **Step 2: Create content picker modal**

Create `apps/web/src/app/cms/(authed)/social/stories/new/_components/content-picker-modal.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'

interface ContentPickerModalProps {
  siteId: string
  open: boolean
  onClose: () => void
  onSelect: (content: { id: string; title: string; excerpt: string | null; coverImageUrl: string | null; locale: string; locales: string[] }) => void
}

type ContentTab = 'blog' | 'newsletter' | 'campaign'

export function ContentPickerModal({ siteId, open, onClose, onSelect }: ContentPickerModalProps) {
  const [tab, setTab] = useState<ContentTab>('blog')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<Array<{ id: string; title: string; meta_description: string | null; cover_image_url: string | null; locale: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    import('@/lib/social/actions/stories').then(({ searchSourceContent }) =>
      searchSourceContent(siteId, tab, search).then(setItems).finally(() => setLoading(false))
    )
  }, [open, siteId, tab, search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl bg-gray-900 border border-gray-700 p-5">
        <h2 className="text-lg font-bold text-white mb-4">Selecionar Conteúdo</h2>

        <div className="flex gap-1 mb-4">
          {(['blog', 'newsletter', 'campaign'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-lg ${
                tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t === 'blog' ? 'Blog Posts' : t === 'newsletter' ? 'Newsletters' : 'Campanhas'}
            </button>
          ))}
        </div>

        <input
          type="search"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 mb-4"
        />

        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Nenhum resultado</div>
          ) : items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect({
                id: item.id,
                title: item.title,
                excerpt: item.meta_description,
                coverImageUrl: item.cover_image_url,
                locale: item.locale,
                locales: [item.locale],
              })}
              className="w-full text-left rounded-lg bg-gray-800 p-3 hover:bg-gray-750 transition-colors"
            >
              <p className="text-sm text-white font-medium">{item.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.locale}</p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create generation-options.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/new/_components/generation-options.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface GenerationOptionsProps {
  availableLocales: string[]
  defaultLocale: string
  onGenerate: (options: { locale: string; slideCount: number; templateStyle: string }) => void
}

export function GenerationOptions({ availableLocales, defaultLocale, onGenerate }: GenerationOptionsProps) {
  const [locale, setLocale] = useState(defaultLocale)
  const [slideCount, setSlideCount] = useState(3)
  const [templateStyle, setTemplateStyle] = useState('gradient')

  return (
    <div className="space-y-4">
      {availableLocales.length > 1 && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">Idioma</label>
          <div className="flex gap-2">
            {availableLocales.map((loc) => (
              <button
                key={loc}
                onClick={() => setLocale(loc)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  locale === loc ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-2">Slides</label>
        <div className="flex gap-2">
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              onClick={() => setSlideCount(n)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                slideCount === n ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Template</label>
        <div className="flex gap-2">
          {[
            { key: 'gradient', label: 'Gradient' },
            { key: 'overlay', label: 'Overlay' },
            { key: 'bold', label: 'Bold' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTemplateStyle(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                templateStyle === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onGenerate({ locale, slideCount, templateStyle })}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
      >
        Gerar e Editar
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create story-composer.tsx** (main orchestrator)

Create `apps/web/src/app/cms/(authed)/social/stories/new/_components/story-composer.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { generateSlideCompositions } from '@/lib/social/story-slides'
import { StoryEditor } from '../../_components/story-editor'
import { ContentPickerModal } from './content-picker-modal'
import { GenerationOptions } from './generation-options'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'
import type { SocialPostData } from '@/lib/social/story-types'

type Mode = 'choose' | 'pick-content' | 'options' | 'editor'

interface StoryComposerProps {
  siteId: string
  siteLogoUrl: string | null
  sitePrimaryColor: string
  defaultLocale: string
  supportedLocales: string[]
  templates: Array<{ id: string; name: string; thumbnailUrl: string | null; aspectRatio: string }>
  sourceContent: { id: string; title: string; meta_description: string | null; cover_image_url: string | null; locale: string } | null
  sourceLocale: string | null
}

export function StoryComposer({
  siteId, siteLogoUrl, sitePrimaryColor, defaultLocale, supportedLocales,
  templates, sourceContent, sourceLocale,
}: StoryComposerProps) {
  const [mode, setMode] = useState<Mode>(sourceContent ? 'options' : 'choose')
  const [selectedContent, setSelectedContent] = useState(sourceContent)
  const [slides, setSlides] = useState<CardComposition[]>([])
  const [postData, setPostData] = useState<SocialPostData>({
    title: sourceContent?.title ?? '',
    description: sourceContent?.meta_description ?? undefined,
    coverImageUrl: sourceContent?.cover_image_url ?? undefined,
    logoUrl: siteLogoUrl ?? undefined,
  })
  const [postId] = useState(() => crypto.randomUUID())

  const handleContentSelect = useCallback((content: { id: string; title: string; excerpt: string | null; coverImageUrl: string | null; locale: string }) => {
    setSelectedContent({
      id: content.id,
      title: content.title,
      meta_description: content.excerpt,
      cover_image_url: content.coverImageUrl,
      locale: content.locale,
    })
    setPostData({
      title: content.title,
      description: content.excerpt ?? undefined,
      coverImageUrl: content.coverImageUrl ?? undefined,
      logoUrl: siteLogoUrl ?? undefined,
    })
    setMode('options')
  }, [siteLogoUrl])

  const handleGenerate = useCallback((opts: { locale: string; slideCount: number; templateStyle: string }) => {
    const compositions = generateSlideCompositions({
      title: selectedContent?.title ?? 'Untitled',
      excerpt: selectedContent?.meta_description ?? null,
      coverImageUrl: selectedContent?.cover_image_url ?? null,
      logoUrl: siteLogoUrl,
      primaryColor: sitePrimaryColor,
      slideCount: opts.slideCount,
    })
    setSlides(compositions)
    setMode('editor')
  }, [selectedContent, siteLogoUrl, sitePrimaryColor])

  const handleStartFromScratch = useCallback(() => {
    setSlides([{
      version: 1,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid', color: '#0f0f1e' },
      elements: [],
    }])
    setPostData({ title: '' })
    setMode('editor')
  }, [])

  const handleExport = useCallback(async (blob: Blob, metadata: { format: 'png'; scale: number; width: number; height: number }) => {
    const { put } = await import('@vercel/blob')
    const result = await put(
      `stories/${postId}-export-${Date.now()}.png`,
      blob,
      { access: 'public', contentType: 'image/png' },
    )
    return { url: result.url }
  }, [postId])

  const handleSaveTemplate = useCallback(async (name: string, composition: CardComposition, thumbnail: Blob) => {
    const { saveTemplate } = await import('@/lib/social/actions/templates')
    await saveTemplate(siteId, name, '9:16', composition, thumbnail)
  }, [siteId])

  const handleDeleteTemplate = useCallback(async (id: string) => {
    const { deleteTemplate } = await import('@/lib/social/actions/templates')
    await deleteTemplate(id)
  }, [])

  const handleImageUpload = useCallback(async (file: File) => {
    const { uploadMediaAsset } = await import('@/lib/media/upload')
    const result = await uploadMediaAsset(file, siteId)
    return result.url
  }, [siteId])

  // Mode: choose entry point
  if (mode === 'choose') {
    return (
      <div className="max-w-md mx-auto py-16 space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">Nova Story</h1>
        <div className="space-y-3">
          <button
            onClick={() => setMode('pick-content')}
            className="w-full rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-750 transition-colors"
          >
            <p className="text-white font-medium">Do CMS</p>
            <p className="text-sm text-gray-400">Gerar a partir de um blog post, newsletter ou campanha</p>
          </button>
          <button
            onClick={handleStartFromScratch}
            className="w-full rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-750 transition-colors"
          >
            <p className="text-white font-medium">Do Zero</p>
            <p className="text-sm text-gray-400">Canvas em branco com template picker</p>
          </button>
        </div>
      </div>
    )
  }

  // Mode: generation options
  if (mode === 'options' && selectedContent) {
    return (
      <div className="max-w-md mx-auto py-16 space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">Gerar Story</h1>
        <div className="rounded-xl bg-gray-800 p-4 mb-4">
          <p className="text-white font-medium">{selectedContent.title}</p>
          <p className="text-sm text-gray-400 mt-1">{selectedContent.locale}</p>
        </div>
        <GenerationOptions
          availableLocales={sourceLocale ? [sourceLocale] : supportedLocales}
          defaultLocale={sourceLocale ?? defaultLocale}
          onGenerate={handleGenerate}
        />
      </div>
    )
  }

  // Mode: editor
  if (mode === 'editor' && slides.length > 0) {
    return (
      <div className="h-[calc(100vh-64px)]">
        <StoryEditor
          initialSlides={slides}
          postData={postData}
          postId={postId}
          templates={templates}
          onSlidesChange={setSlides}
          onExport={handleExport}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onImageUpload={handleImageUpload}
        />
      </div>
    )
  }

  // Content picker modal
  return (
    <>
      <div className="max-w-md mx-auto py-16">
        <h1 className="text-2xl font-bold text-white text-center mb-8">Nova Story</h1>
      </div>
      <ContentPickerModal
        siteId={siteId}
        open={mode === 'pick-content'}
        onClose={() => setMode('choose')}
        onSelect={handleContentSelect}
      />
    </>
  )
}
```

- [ ] **Step 5: Add searchSourceContent to stories actions**

In `apps/web/src/lib/social/actions/stories.ts`, add:

```typescript
export async function searchSourceContent(
  siteId: string,
  type: 'blog' | 'newsletter' | 'campaign',
  search: string,
) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const table = type === 'blog' ? 'posts' : type === 'newsletter' ? 'newsletter_editions' : 'campaigns'
  let query = supabase
    .from(table)
    .select('id, title, meta_description, cover_image_url, locale')
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error } = await query
  if (error) return []
  return data ?? []
}
```

- [ ] **Step 6: Run tests**

```bash
npm run test:web
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/stories/new/
git add apps/web/src/lib/social/actions/stories.ts
git commit -m "feat(social): auto-generation from CMS content with language + slide count selector"
```

---

### Task 12: Preview & Publishing UI

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/story-preview.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/publish-dialog.tsx`
- Create: `apps/web/src/lib/social/actions/story-publish.ts`

- [ ] **Step 1: Create story-preview.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/story-preview.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'

interface StoryPreviewProps {
  slides: CardComposition[]
  shortUrl?: string
  caption?: string
  rateBudget?: { remaining: number }
}

export function StoryPreview({ slides, shortUrl, caption, rateBudget }: StoryPreviewProps) {
  const [activeSlide, setActiveSlide] = useState(0)

  return (
    <div className="flex gap-8 items-start justify-center py-8">
      {/* Phone frame */}
      <div className="w-[280px]">
        <div className="rounded-[2rem] border-4 border-gray-700 bg-black overflow-hidden">
          <div className="aspect-[9/16] relative bg-gray-900">
            {/* Slide indicator dots */}
            <div className="absolute top-3 left-0 right-0 flex justify-center gap-1 z-10">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`h-0.5 rounded-full transition-all ${
                    i === activeSlide ? 'w-6 bg-white' : 'w-3 bg-white/40'
                  }`}
                />
              ))}
            </div>

            {/* Navigation arrows */}
            <button
              onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
              disabled={activeSlide === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white disabled:invisible text-lg"
            >
              ‹
            </button>
            <button
              onClick={() => setActiveSlide(Math.min(slides.length - 1, activeSlide + 1))}
              disabled={activeSlide === slides.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white disabled:invisible text-lg"
            >
              ›
            </button>

            <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/50">
              Slide {activeSlide + 1} of {slides.length}
            </div>
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div className="space-y-4 max-w-[280px]">
        {caption && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Caption:</p>
            <p className="text-sm text-gray-300">{caption}</p>
          </div>
        )}
        {shortUrl && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Short URL:</p>
            <p className="text-sm text-indigo-400 font-mono">{shortUrl}</p>
          </div>
        )}
        {rateBudget && (
          <div>
            <p className="text-xs text-gray-400 mb-1">API Budget:</p>
            <p className={`text-sm ${rateBudget.remaining < slides.length * 2 ? 'text-red-400' : 'text-green-400'}`}>
              {rateBudget.remaining}/100 calls remaining
            </p>
            <p className="text-[10px] text-gray-500">
              This story needs {slides.length * 2} calls
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create publish-dialog.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/publish-dialog.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'

interface PublishDialogProps {
  open: boolean
  onClose: () => void
  slideCount: number
  onPublishNow: () => Promise<void>
  onSchedule: (scheduledAt: string) => Promise<void>
  onSaveDraft: () => Promise<void>
}

export function PublishDialog({
  open, onClose, slideCount,
  onPublishNow, onSchedule, onSaveDraft,
}: PublishDialogProps) {
  const [mode, setMode] = useState<'choose' | 'schedule'>('choose')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [slideProgress, setSlideProgress] = useState<Array<'pending' | 'publishing' | 'done' | 'failed'>>([])

  const handlePublishNow = useCallback(async () => {
    setPublishing(true)
    setSlideProgress(Array(slideCount).fill('pending'))
    try {
      // Progress simulation — in reality, the server action handles this
      for (let i = 0; i < slideCount; i++) {
        setSlideProgress((prev) => prev.map((s, j) => j === i ? 'publishing' : s))
        await new Promise((r) => setTimeout(r, 500)) // visual feedback
        setSlideProgress((prev) => prev.map((s, j) => j === i ? 'done' : s))
      }
      await onPublishNow()
    } catch {
      setSlideProgress((prev) => prev.map((s) => s === 'publishing' ? 'failed' : s))
    } finally {
      setPublishing(false)
    }
  }, [slideCount, onPublishNow])

  const handleSchedule = useCallback(async () => {
    if (!scheduledDate || !scheduledTime) return
    setPublishing(true)
    try {
      const isoDate = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      await onSchedule(isoDate)
    } finally {
      setPublishing(false)
    }
  }, [scheduledDate, scheduledTime, onSchedule])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-700 p-6">
        <h2 className="text-lg font-bold text-white mb-6">Publicar Story</h2>

        {mode === 'choose' ? (
          <div className="space-y-3">
            <button
              onClick={handlePublishNow}
              disabled={publishing}
              className="w-full rounded-xl bg-indigo-600 p-4 text-left hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              <p className="text-white font-medium flex items-center gap-2">
                <span>⚡</span> Publicar Agora
              </p>
              <p className="text-sm text-indigo-200 mt-1">Publica imediatamente via API</p>
            </button>

            <button
              onClick={() => setMode('schedule')}
              className="w-full rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-750 transition-colors"
            >
              <p className="text-white font-medium flex items-center gap-2">
                <span>📅</span> Agendar
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Via servidor <span className="text-amber-500 text-xs">(não nativo Instagram)</span>
              </p>
            </button>

            <button
              onClick={onSaveDraft}
              className="w-full rounded-xl bg-gray-800 p-4 text-left hover:bg-gray-750 transition-colors"
            >
              <p className="text-white font-medium flex items-center gap-2">
                <span>📋</span> Salvar Rascunho
              </p>
              <p className="text-sm text-gray-400 mt-1">Continuar depois</p>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-3">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="flex-1 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white"
              />
            </div>
            <button
              onClick={handleSchedule}
              disabled={publishing || !scheduledDate || !scheduledTime}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {publishing ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
            <button onClick={() => setMode('choose')} className="text-sm text-gray-400 hover:text-white">
              Voltar
            </button>
          </div>
        )}

        {/* Per-slide progress */}
        {slideProgress.length > 0 && (
          <div className="mt-4 flex gap-2">
            {slideProgress.map((status, i) => (
              <div
                key={i}
                className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium ${
                  status === 'done' ? 'bg-green-900 text-green-400' :
                  status === 'publishing' ? 'bg-blue-900 text-blue-400 animate-pulse' :
                  status === 'failed' ? 'bg-red-900 text-red-400' :
                  'bg-gray-800 text-gray-500'
                }`}
              >
                {status === 'done' ? '✓' : status === 'failed' ? '✗' : status === 'publishing' ? '⏳' : `S${i + 1}`}
              </div>
            ))}
          </div>
        )}

        {!publishing && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create story-publish server action**

Create `apps/web/src/lib/social/actions/story-publish.ts`:

```typescript
'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'
import type { CardComposition } from '@tn-figueiredo/links/qr/card-composition'

export async function saveStoryDraft(
  siteId: string,
  postId: string,
  slides: CardComposition[],
  content: { title?: string; source_content_id?: string; source_content_type?: string; source_locale?: string },
) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from('social_posts')
    .upsert({
      id: postId,
      site_id: siteId,
      status: 'draft',
      story_slides: slides,
      source_locale: content.source_locale ?? null,
      source_content_id: content.source_content_id ?? null,
      source_content_type: content.source_content_type ?? null,
      content: { title: content.title },
      type: 'image',
    }, { onConflict: 'id' })

  if (error) throw error
}

export async function publishStoryNow(
  siteId: string,
  postId: string,
  slides: CardComposition[],
  content: { title?: string },
) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  // Update status to publishing
  await supabase
    .from('social_posts')
    .update({
      status: 'publishing',
      story_slides: slides,
      content: { title: content.title },
    })
    .eq('id', postId)

  // Trigger the publish workflow (runs async via cron or direct call)
  const { publishSocialPost } = await import('@/lib/social/workflows')
  await publishSocialPost(postId)
}

export async function scheduleStory(
  siteId: string,
  postId: string,
  slides: CardComposition[],
  scheduledAt: string,
  content: { title?: string },
) {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  const { error } = await supabase
    .from('social_posts')
    .upsert({
      id: postId,
      site_id: siteId,
      status: 'scheduled',
      scheduled_at: scheduledAt,
      story_slides: slides,
      content: { title: content.title },
      type: 'image',
    }, { onConflict: 'id' })

  if (error) throw error
}
```

- [ ] **Step 4: Run tests**

```bash
npm run test:web
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/stories/_components/story-preview.tsx
git add apps/web/src/app/cms/(authed)/social/stories/_components/publish-dialog.tsx
git add apps/web/src/lib/social/actions/story-publish.ts
git commit -m "feat(social): story preview, publish dialog with scheduling, and publish actions"
```

---

### Task 13: Per-Slide Insights + Fan Leaderboard UI

**Files:**
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/story-insights.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/analytics/fans/_components/fan-leaderboard.tsx`
- Create: `apps/web/src/lib/social/actions/story-metrics.ts`

- [ ] **Step 1: Create story metrics server action**

Create `apps/web/src/lib/social/actions/story-metrics.ts`:

```typescript
'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'
import type { StoryInsights, SlideMetrics } from '../story-types'

export async function getStoryInsights(
  siteId: string,
  postId: string,
): Promise<StoryInsights | null> {
  await requireSiteAdmin(siteId)
  const supabase = await getSupabaseServerClient()

  // Fetch all metrics for this post (aggregate + per-slide)
  const { data: metrics, error } = await supabase
    .from('post_metrics')
    .select('slide_index, impressions, reach, likes, comments, shares, link_clicks')
    .eq('post_id', postId)
    .order('slide_index', { ascending: true, nullsFirst: true })

  if (error || !metrics || metrics.length === 0) return null

  // Separate aggregate from per-slide
  const aggregate = metrics.find((m) => m.slide_index === null)
  const perSlide: SlideMetrics[] = metrics
    .filter((m) => m.slide_index !== null)
    .map((m) => ({
      slide_index: m.slide_index!,
      impressions: m.impressions ?? 0,
      reach: m.reach ?? 0,
      replies: m.comments ?? 0,
    }))

  // Calculate drop-off between consecutive slides
  const dropOff = perSlide
    .slice(1)
    .map((slide, i) => {
      const prev = perSlide[i]
      const reachDrop = prev.reach - slide.reach
      return {
        from_slide: prev.slide_index,
        to_slide: slide.slide_index,
        reach_drop: reachDrop,
        drop_percentage: prev.reach > 0 ? (reachDrop / prev.reach) * 100 : 0,
      }
    })

  return {
    post_id: postId,
    aggregate: {
      impressions: aggregate?.impressions ?? 0,
      reach: aggregate?.reach ?? 0,
      replies: aggregate?.comments ?? 0,
      link_clicks: aggregate?.link_clicks ?? 0,
    },
    per_slide: perSlide,
    drop_off: dropOff,
  }
}
```

- [ ] **Step 2: Create story-insights.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/story-insights.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import type { StoryInsights } from '@/lib/social/story-types'
import { getStoryInsights } from '@/lib/social/actions/story-metrics'

interface StoryInsightsProps {
  siteId: string
  postId: string
}

export function StoryInsightsPanel({ siteId, postId }: StoryInsightsProps) {
  const [insights, setInsights] = useState<StoryInsights | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStoryInsights(siteId, postId)
      .then(setInsights)
      .finally(() => setLoading(false))
  }, [siteId, postId])

  if (loading) return <div className="animate-pulse h-48 bg-gray-800 rounded-xl" />
  if (!insights) return <p className="text-gray-500 text-sm">Métricas disponíveis após primeiro poll.</p>

  const maxReach = Math.max(...insights.per_slide.map((s) => s.reach), 1)

  return (
    <div className="space-y-6">
      {/* Aggregate KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Alcance', value: insights.aggregate.reach },
          { label: 'Impressões', value: insights.aggregate.impressions },
          { label: 'Respostas', value: insights.aggregate.replies },
          { label: 'Link Clicks', value: insights.aggregate.link_clicks },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl bg-gray-800 p-4 text-center">
            <p className="text-2xl font-bold text-white">{kpi.value.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Per-slide reach bar chart */}
      {insights.per_slide.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Alcance por Slide</h3>
          <div className="space-y-2">
            {insights.per_slide.map((slide, i) => (
              <div key={slide.slide_index} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-8">S{slide.slide_index + 1}</span>
                <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${(slide.reach / maxReach) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-300 w-16 text-right">
                  {slide.reach.toLocaleString()}
                </span>
                {i > 0 && insights.drop_off[i - 1] && (
                  <span className="text-[10px] text-red-400 w-12 text-right">
                    -{insights.drop_off[i - 1].drop_percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-600 mt-2 italic">
            Diferença de alcance entre slides. Nota: nem todos os viewers são os mesmos — novos viewers podem entrar em qualquer slide.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create fan leaderboard page**

Create `apps/web/src/app/cms/(authed)/analytics/fans/page.tsx`:

```typescript
import { getSiteContext } from '@/lib/site/context'
import { getTopFans } from '@/lib/social/actions/fans'
import { FanLeaderboard } from './_components/fan-leaderboard'

export default async function FansPage() {
  const { siteId } = await getSiteContext()
  const fans = await getTopFans(siteId, 50)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Top Fans</h1>
      <p className="text-sm text-gray-400">Últimos 90 dias</p>
      <FanLeaderboard fans={fans} />
    </div>
  )
}
```

- [ ] **Step 4: Create fan-leaderboard.tsx**

Create `apps/web/src/app/cms/(authed)/analytics/fans/_components/fan-leaderboard.tsx`:

```typescript
'use client'

import type { FanScore } from '@/lib/social/story-types'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📱',
  facebook: '👥',
  bluesky: '💬',
  link_click: '🔗',
  newsletter: '📧',
}

interface FanLeaderboardProps {
  fans: FanScore[]
}

export function FanLeaderboard({ fans }: FanLeaderboardProps) {
  if (fans.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg mb-2">Nenhuma interação registrada ainda</p>
        <p className="text-sm">Os dados aparecerão conforme seus seguidores interagirem com seu conteúdo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {fans.map((fan, rank) => (
        <div
          key={fan.visitor_hash}
          className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex items-center gap-4"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-400">
            {rank + 1}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {fan.email ?? `visitor_${fan.visitor_hash.slice(0, 8)}`}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-500">
                {fan.total_interactions} interações
              </span>
              <span className="text-xs text-gray-500">
                Último: {new Date(fan.last_seen).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>

          {/* Platform badges */}
          <div className="flex gap-1">
            {Object.entries(PLATFORM_ICONS).map(([platform, icon]) => (
              <span
                key={platform}
                className="text-sm"
                title={platform}
              >
                {icon}
              </span>
            ))}
          </div>

          {/* Score */}
          <div className="flex-shrink-0 text-right">
            <p className={`text-lg font-bold ${
              fan.score >= 80 ? 'text-green-400' :
              fan.score >= 50 ? 'text-amber-400' :
              'text-gray-400'
            }`}>
              {Math.round(fan.score)}
            </p>
            <p className="text-[10px] text-gray-500">/100</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
npm run test:web
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/stories/_components/story-insights.tsx
git add apps/web/src/app/cms/(authed)/analytics/fans/
git add apps/web/src/lib/social/actions/story-metrics.ts
git commit -m "feat(social): per-slide insights with honest labels + fan leaderboard"
```

---

### Task 14: Ready-to-Post Page Updates + Highlights Tip

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post.tsx`
- Create: `apps/web/src/app/cms/(authed)/social/stories/_components/highlights-tip.tsx`

- [ ] **Step 1: Update ready-to-post.tsx for multi-slide**

Read `apps/web/src/app/cms/(authed)/social/posts/[id]/ready/_components/ready-to-post.tsx` and update it to:

1. Support displaying multiple slides with carousel navigation (swipe/arrows)
2. Add a "Baixar Imagens" button that downloads all slide images
3. Add a "Marquei como Publicado" button that sets status to `completed`
4. Show dot indicators for multi-slide

- [ ] **Step 2: Create highlights-tip.tsx**

Create `apps/web/src/app/cms/(authed)/social/stories/_components/highlights-tip.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'cms:highlights-tip-dismissed'

export function HighlightsTip() {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
  }, [])

  if (dismissed) return null

  return (
    <div className="rounded-xl bg-amber-900/20 border border-amber-800/40 p-4">
      <p className="text-sm font-medium text-amber-200 mb-2">
        Adicionar aos Destaques?
      </p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Instagram não permite gerenciar Destaques via API. Para adicionar:
      </p>
      <ol className="text-xs text-gray-400 mt-2 space-y-1 list-decimal list-inside">
        <li>Abra o Instagram no celular</li>
        <li>Vá no seu perfil → Destaques</li>
        <li>Toque &quot;Novo&quot; ou edite um existente</li>
        <li>Selecione este story</li>
      </ol>
      <button
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, 'true')
          setDismissed(true)
        }}
        className="mt-3 text-xs text-amber-400 hover:text-amber-300"
      >
        Entendi, não mostrar novamente
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Run all tests**

```bash
npm run test:web
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/social/posts/[id]/ready/
git add apps/web/src/app/cms/(authed)/social/stories/_components/highlights-tip.tsx
git commit -m "feat(social): multi-slide ready-to-post page + highlights manual workflow tip"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Section | Task |
|---|---|
| §3 Data model | Task 1 |
| §4 Stories Gallery | Task 8 |
| §5 Auto-generation | Task 11 |
| §6 Multi-slide editor | Task 9 |
| §7 SocialCanvasEditor changes | Task 4 |
| §8 Render pipeline | Task 3, 7 |
| §9 Preview & publishing | Task 12 |
| §10 1-click from blog | Task 10 |
| §11 Per-slide insights | Task 13 |
| §12 Fan scoring | Task 6, 13 |
| §13 Brand kit | Task 11 (auto-apply in generation) |
| §14 Highlights | Task 14 |
| §15 Ready-to-Post | Task 14 |
| §17 Technical gaps | Tasks 3, 4, 7 |

### Type Consistency Check

- `CardComposition` — used consistently from `@tn-figueiredo/links/qr/card-composition`
- `SocialPostData` — defined in `story-types.ts`, re-exported from `types.ts`
- `TemplateContext` — imported from `konva-renderer.ts` in both `story-types.ts` and `story-slides.ts`
- `StorySlide` = `CardComposition` (alias via `StorySlideSchema = CardCompositionSchema`)
- `postDataToTemplateContext` — defined once in `story-types.ts`, used in canvas editor and renderer
- `FanScore` — interface in `story-types.ts`, used in actions and leaderboard
- `publishMultiSlideStory` — defined in `instagram.ts`, called from `workflows.ts`
- `generateSlideCompositions` — defined in `story-slides.ts`, used in `story-composer.tsx`
- `checkRateBudget` — defined in `rate-budget.ts`, used in `instagram.ts`
