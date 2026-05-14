# Implementation Plan: Pipeline <> Social Unification

> Step-by-step plan derived from the design spec at `../specs/2026-05-14-pipeline-social-unification-design.md`

## Overview

Bridge the content pipeline and social hub so that pipeline items can "graduate" to social posts — inheriting all accumulated metadata (hook, SEO, images, captions) — either automatically when advancing to the final stage with a complete social config, or as drafts requiring manual completion in the Social Hub.

## Pre-conditions

- Social Hub is operational: `social_connections`, `social_posts`, `social_deliveries` tables exist (migration `20260513100000_social_hub.sql`)
- Social Posts Redesign deployed: `source_content_type`, `pipeline_steps`, delivery formats present (migration `20260514100000_social_posts_redesign.sql`)
- Content Pipeline operational: `content_pipeline` with `sections` JSONB, all graduation routes for blog/newsletter/campaign functional
- Blog graduation route works: `POST /api/pipeline/items/[id]/graduate` with target `blog_post | newsletter | campaign`
- `createSocialPostFromContent()` in `apps/web/src/lib/social/create-from-content.ts` is tested and working
- `getNextQueueSlot()` in `apps/web/src/lib/social/queue.ts` is tested and working

---

## Phase 1: Database & Types (~2.5h)

### Step 1.1: Migration — `pipeline_social_graduation.sql`

**File**: `supabase/migrations/20260515100000_pipeline_social_graduation.sql` (new)

**What it does**: Adds 3 columns to `content_pipeline` (`social_config JSONB`, `social_post_id UUID FK`), adds 3 columns to `social_posts` (`source_pipeline_id UUID FK`, `pipeline_snapshot JSONB`, `graduated_at TIMESTAMPTZ`), creates indexes, extends the `origin` CHECK constraint to include `'pipeline'`.

**Concrete changes**:
```sql
BEGIN;

-- 1. content_pipeline additions
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_config JSONB;

ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS social_post_id UUID
    REFERENCES public.social_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_social_post
  ON public.content_pipeline(social_post_id)
  WHERE social_post_id IS NOT NULL;

-- 2. social_posts additions
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

-- 3. Extend origin CHECK (drop + recreate for idempotency)
ALTER TABLE public.social_posts
  DROP CONSTRAINT IF EXISTS social_posts_origin_check;

ALTER TABLE public.social_posts
  ADD CONSTRAINT social_posts_origin_check
    CHECK (origin IN ('manual', 'auto', 'publish_modal', 'pipeline'));

COMMIT;
```

**Dependencies**: None (first step)
**Estimated time**: 30 min
**Acceptance criteria**:
- `npm run db:push:prod` applies cleanly
- `\d content_pipeline` shows `social_config` (jsonb, nullable) and `social_post_id` (uuid, nullable, FK to social_posts)
- `\d social_posts` shows `source_pipeline_id` (uuid, nullable, FK to content_pipeline), `pipeline_snapshot` (jsonb), `graduated_at` (timestamptz)
- Unique partial index prevents two active social posts per pipeline item
- Existing rows unaffected (all new columns NULL)

### Step 1.2: Update TypeScript types — `social/types.ts`

**File**: `apps/web/src/lib/social/types.ts` (modify)

**What it does**: Adds `'pipeline'` to the `Origin` type. Adds the `PipelineSnapshot` interface. Adds the `PIPELINE_FORMAT_TO_CONTENT_TYPE` mapping constant.

**Concrete changes**:
1. Change `Origin` line from `'manual' | 'auto' | 'publish_modal'` to `'manual' | 'auto' | 'publish_modal' | 'pipeline'`
2. Add `PipelineSnapshot` interface (matches the spec: identity fields, content summary, sections copy, format metadata, linked entity IDs, graduation metadata)
3. Add `PIPELINE_FORMAT_TO_CONTENT_TYPE` constant mapping `blog_post -> 'blog'`, `newsletter -> 'newsletter'`, `campaign -> 'campaign'`, `video -> 'video'`

**Dependencies**: Step 1.1 (origin CHECK must already accept `'pipeline'`)
**Estimated time**: 20 min
**Acceptance criteria**:
- TypeScript compiles with no errors
- `Origin` type includes `'pipeline'`
- `PipelineSnapshot` is importable from `@/lib/social/types`

### Step 1.3: Update pipeline schemas — `pipeline/schemas.ts`

**File**: `apps/web/src/lib/pipeline/schemas.ts` (modify)

**What it does**: Adds `social_config` and `social_post_id` fields to `PipelineItemUpdateSchema`. Extends `GraduateSchema` to accept `target: 'social'` alongside the existing `'blog_post' | 'newsletter' | 'campaign'`.

**Concrete changes**:
1. Add to `PipelineItemUpdateSchema`:
   ```typescript
   social_config: z.object({
     enabled: z.boolean(),
     platforms: z.array(z.string()),
     captions: z.record(z.record(z.string())).optional(),
     hashtags: z.array(z.string().max(100)).max(30).optional(),
     image_source: z.enum(['og_image', 'cover_image', 'custom']).optional(),
     ig_template: z.enum(['minimal', 'card', 'bold']).optional(),
     formats: z.record(z.string()).optional(),
   }).nullable().optional(),
   social_post_id: z.string().uuid().nullable().optional(),
   ```
2. Change `GraduateSchema.target` from `z.enum(['blog_post', 'newsletter', 'campaign'])` to `z.enum(['blog_post', 'newsletter', 'campaign', 'social'])`

**Dependencies**: None (can be done in parallel with Step 1.1)
**Estimated time**: 20 min
**Acceptance criteria**:
- `PipelineItemUpdateSchema.safeParse({ social_config: { enabled: true, platforms: ['facebook'] } })` succeeds
- `GraduateSchema.safeParse({ target: 'social' })` succeeds
- Existing schema validations still pass (no regressions)

---

## Phase 2: Core Logic (~4h)

### Step 2.1: New file — `graduation.ts`

**File**: `apps/web/src/lib/pipeline/graduation.ts` (new)

**What it does**: Contains the three core functions for social graduation:
1. `isSocialConfigComplete(config)` — validates that a SocialConfig has all required fields for auto-graduation
2. `buildPipelineSnapshot(item, userId)` — creates an immutable snapshot of all pipeline sections and metadata
3. `graduateToSocialPost(supabase, item, siteId)` — orchestrates the full graduation flow (decision tree from spec)

**Implementation details**:

The `graduateToSocialPost` function implements the spec's 6-step decision tree:
1. Check `social_config` is present and enabled
2. Check no existing `social_post_id`
3. Check format is supported (`PIPELINE_FORMAT_TO_CONTENT_TYPE`)
4. Check linked content entity exists (blog_post_id, newsletter_edition_id, campaign_id, youtube_video_id)
5. Check `isSocialConfigComplete()`
6. If all pass: call `createSocialPostFromContent()`, set snapshot, FKs, history. If not: create draft social post.

The function follows the existing pattern from `create-from-content.ts`: it accepts a `SupabaseClient` (service client), not creating its own. It returns `{ ok: true; data: { postId: string; isDraft: boolean } } | { ok: false; error: string }` matching the `ActionResult` pattern used in `pipeline/actions.ts`.

Key implementation notes:
- Uses dynamic `import()` for `createSocialPostFromContent` and `getNextQueueSlot` to match the existing lazy-import pattern in the graduation route
- Snapshot is built before any DB writes to ensure consistency
- Draft path creates the `social_posts` row directly (not via `createSocialPostFromContent`) because no content entity may exist yet
- Records `content_pipeline_history` events: `'graduated'` for auto, `'graduated_draft'` for drafts
- Uses `crypto.randomUUID()` for idempotency key on draft posts

**Dependencies**: Steps 1.2, 1.3
**Estimated time**: 1.5h
**Acceptance criteria**:
- `isSocialConfigComplete(null)` returns false
- `isSocialConfigComplete({ enabled: true, platforms: ['facebook'], captions: { facebook: { pt: 'Hello' } }, ... })` returns true
- `buildPipelineSnapshot()` returns all expected fields from the spec
- `graduateToSocialPost()` compiles and handles all 6 decision paths

### Step 2.2: Extend `create-from-content.ts`

**File**: `apps/web/src/lib/social/create-from-content.ts` (modify)

**What it does**: Extends the `CreateParams` interface to accept optional `sourcePipelineId` and `pipelineSnapshot` parameters. When provided, these are stored on the created/updated `social_posts` row alongside `graduated_at`.

**Concrete changes**:
1. Add to `CreateParams`:
   ```typescript
   sourcePipelineId?: string
   pipelineSnapshot?: Record<string, unknown>
   ```
2. In both the insert and update paths, include `source_pipeline_id`, `pipeline_snapshot`, and `graduated_at` when `sourcePipelineId` is provided
3. This avoids the two-step "create then patch" pattern from the spec, making it a single atomic write

**Why change the approach**: The spec shows a two-step flow (create social post, then update it with snapshot). A single-step approach is simpler and eliminates a race window. The `graduateToSocialPost()` function in Step 2.1 can then pass these params directly instead of doing a separate update.

**Dependencies**: Step 1.2 (needs `PipelineSnapshot` type)
**Estimated time**: 30 min
**Acceptance criteria**:
- Existing calls to `createSocialPostFromContent()` (without pipeline params) still work unchanged
- When `sourcePipelineId` is provided, the created social post row has `source_pipeline_id`, `pipeline_snapshot`, and `graduated_at` set
- TypeScript compiles cleanly

### Step 2.3: Extend pipeline actions — `advancePipelineItem` + `graduateToSocialAction`

**File**: `apps/web/src/app/cms/(authed)/pipeline/actions.ts` (modify)

**What it does**:
1. Extends `advancePipelineItem()` to check for auto-graduation after a successful stage advance. When the new stage is a "graduatable" stage (final or second-to-last per format) and the item has a complete `social_config`, it triggers `graduateToSocialPost()`.
2. Adds a new `graduateToSocialAction(pipelineId, version)` server action for manual graduation from the UI.

**Concrete changes to `advancePipelineItem()`**:
- After the successful `supabase.update()` that advances the stage, fetch the full item data (currently only fetches `id, format, stage, version`)
- Import `isFinalStage` from `@/lib/pipeline/workflows` (already exists and exported)
- If the new stage is a final stage AND `item.social_config?.enabled`, dynamically import `graduateToSocialPost` and call it
- If graduation succeeds, include the graduation result in the return data
- If graduation fails, the stage advance is NOT rolled back (graduation is best-effort). Log to Sentry and continue.
- Also `revalidatePath('/cms/social')` after graduation

**New `graduateToSocialAction()` function**:
- Follows the exact pattern from the spec (see "Server Action" section)
- Validates: item exists, site-scoped, version matches, no existing social_post_id
- Calls `graduateToSocialPost()` from `@/lib/pipeline/graduation`
- Revalidates both `/cms/pipeline` and `/cms/social`
- Returns `ActionResult` with `{ postId, isDraft }` on success

**Dependencies**: Steps 2.1, 2.2
**Estimated time**: 1h
**Acceptance criteria**:
- Advancing a pipeline item to its final stage with a complete social_config triggers auto-graduation
- Advancing without social_config works as before (no graduation, no errors)
- `graduateToSocialAction()` can be called from a client component
- Graduation failure does not prevent stage advance
- Both `/cms/pipeline` and `/cms/social` are revalidated

### Step 2.4: Extend graduation API route

**File**: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts` (modify)

**What it does**: Adds handling for `target: 'social'` in the POST handler, so the Cowork API can trigger social graduation programmatically.

**Concrete changes**:
- Add an `else if (target === 'social')` branch after the existing `campaign` branch
- This branch imports `graduateToSocialPost` and calls it with the fetched item and `auth.siteId`
- Returns `{ graduated: true, target: 'social', entity_id: postId, is_draft: isDraft }`
- The existing `fkMap` check (line 41-43) needs to handle `social` separately since social uses `social_post_id` not in the current map

**Dependencies**: Step 2.1
**Estimated time**: 30 min
**Acceptance criteria**:
- `POST /api/pipeline/items/{id}/graduate` with `{ target: "social" }` creates a social post (or draft)
- Existing `blog_post`, `newsletter`, `campaign` targets still work
- Returns 409 if already graduated to social
- Returns appropriate error for unsupported formats (course)

---

## Phase 3: UI Components (~5h)

### Step 3.1: Social Config Editor component

**File**: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/social-config-editor.tsx` (new)

**What it does**: Renders the social distribution configuration panel inside the Publication tab. This is the primary UI for configuring how a pipeline item will be promoted on social media.

**Component structure**:
1. **Enable toggle** — Checkbox: "Distribute on social media?" Controls `social_config.enabled`
2. **Platform selector** — Pill checkboxes for facebook, instagram, bluesky. Each shows connection status (connected/disconnected). Disconnected platforms are visually dimmed but still selectable (user may connect later).
3. **Per-platform caption editors** — For each selected platform, an expandable section with textarea inputs for PT and EN captions. Character count with platform-specific limits (Facebook: 500 soft, Instagram: 2200, Bluesky: 300).
4. **Hashtag input** — Tag-style input. Pre-populated from pipeline item tags. Max 30 tags.
5. **Image source selector** — Radio group: OG Image / Cover Image / Custom
6. **IG Story template picker** — Three visual thumbnails (minimal, card, bold). Only shown when Instagram is selected.
7. **Format override panel** — Collapsible "Advanced" section showing default delivery format per platform with override dropdowns.

**Props interface**: Does NOT follow the `RendererProps` interface from `section-content.tsx`. This component operates on `item.social_config` (a top-level column), not on `sections[key].content`. It will receive:
```typescript
interface SocialConfigEditorProps {
  socialConfig: SocialConfig | null
  onConfigChange: (config: SocialConfig) => void
  tags: string[]                    // pre-populate hashtags
  format: string                    // for format-specific defaults
  coverImageUrl: string | null      // for image source preview
  siteId: string                    // to fetch connections
}
```

**Data flow**: The component calls `onConfigChange()` on blur/change. The parent (`pipeline-item-detail.tsx`) persists via `updatePipelineItem(id, version, { social_config: ... })`.

**Styling**: Follows the gem-design system used by all pipeline renderers: CSS custom properties (`--gem-surface`, `--gem-border`, `--gem-text`, `--gem-dim`, `--gem-accent`), 10-12px text sizes, rounded-lg borders.

**Connections fetch**: Uses a client-side `useEffect` to fetch connections via `getConnections()` from `@/lib/social/actions`. Caches result for the component lifetime.

**Dependencies**: Steps 1.2, 1.3 (needs SocialConfig type and schema)
**Estimated time**: 2h
**Acceptance criteria**:
- Renders all 7 sub-sections described above
- Toggling platforms shows/hides caption editors for those platforms
- Character counts update in real-time
- `onConfigChange` fires with valid `SocialConfig` shape
- Disconnected platforms show visual warning but remain selectable
- IG template picker only visible when Instagram is selected

### Step 3.2: Wire Social Config Editor into pipeline detail

**Files**:
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` (modify)
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` (no change needed — see reasoning below)

**What it does**: Adds the Social Config Editor to the pipeline detail page. The editor appears in the sidebar (below the Blog Post card) as a new sidebar card, NOT inside the section tab system.

**Reasoning for sidebar placement**: The social config is a top-level column (`content_pipeline.social_config`), not a section in the `sections` JSONB. It would be architecturally incorrect to register it in the `REGISTRY` map in `section-content.tsx`, which maps section types to renderers that receive `SectionData['content']`. Instead, it lives in the sidebar alongside other metadata cards (stage, checklist, details, blog post, history).

**Concrete changes to `pipeline-item-detail.tsx`**:
1. Import `SocialConfigEditor` (lazy: `const SocialConfigEditor = dynamic(...)` or direct import)
2. Add `social_config` and `social_post_id` to the `ItemData` interface (lines 37-67)
3. Add state: `const [socialConfig, setSocialConfig] = useState<SocialConfig | null>(item.social_config ?? null)`
4. Add handler: `handleSocialConfigChange` that calls `updatePipelineItem(item.id, item.version, { social_config: config })` with debouncing
5. Add the Social Config Editor card in the sidebar, after the Blog Post card (~line 658), only for formats that support social graduation (blog_post, newsletter, campaign, video — not course)
6. Add a "Graduate to Social" button card below the Social Config Editor, visible when:
   - `social_config?.enabled === true`
   - `item.social_post_id` is null
   - Format is supported
7. When `item.social_post_id` is set, show a "Social Post" card (similar to Blog Post card) with status, link to social post detail, and unlink/re-graduate options

**Dependencies**: Step 3.1
**Estimated time**: 1.5h
**Acceptance criteria**:
- Social Config Editor appears in sidebar for blog_post, newsletter, campaign, video formats
- Does NOT appear for course format
- Changes persist via debounced `updatePipelineItem`
- "Graduate to Social" button calls `graduateToSocialAction`
- After graduation, shows linked social post card with status
- Toast notifications match spec (success with link, draft with guidance, error)

### Step 3.3: Pipeline Context Panel for Social Post Detail

**File**: `apps/web/src/app/cms/(authed)/social/[id]/_components/pipeline-context-panel.tsx` (new)

**What it does**: Renders a collapsible panel on the social post detail page showing the pipeline snapshot. This provides full context about the content creation process for the person (same user) managing social distribution.

**Component structure**:
1. Header: Pipeline item code + title, linked back to `/cms/pipeline/{format}/{id}`
2. Badges: Format badge + stage at graduation time
3. Sections accordion: Each pipeline section rendered as a read-only collapsed panel. Uses the existing section renderers (`IdeaRenderer`, `DraftRenderer`, `SeoRenderer`, `ImagesRenderer`, `PublishRenderer`) with `isEditing=false`. These renderers already support read-only mode.
4. Metadata: Tags, category, cover image preview
5. Footer: "Graduated at {datetime}" timestamp

**Props**:
```typescript
interface PipelineContextPanelProps {
  pipelineSnapshot: PipelineSnapshot | null
  sourcePipelineId: string | null
}
```

When `pipelineSnapshot` is null, renders nothing (graceful absence).

**Dependencies**: Step 1.2 (PipelineSnapshot type)
**Estimated time**: 1h
**Acceptance criteria**:
- Renders pipeline snapshot sections in read-only mode
- Collapsible — starts collapsed by default
- Links back to pipeline detail page
- Handles null snapshot gracefully (renders nothing)
- Uses existing section renderers without modification

### Step 3.4: Wire Pipeline Context Panel into Social Post Detail

**Files**:
- `apps/web/src/app/cms/(authed)/social/[id]/page.tsx` (modify)
- `apps/web/src/app/cms/(authed)/social/_components/post-detail.tsx` (modify)
- `apps/web/src/lib/social/actions/posts.ts` (modify — to fetch pipeline columns)

**What it does**: Passes the `pipeline_snapshot`, `source_pipeline_id`, and `graduated_at` data from the social post down to the detail view, and renders the `PipelineContextPanel` component.

**Concrete changes**:
1. In `getSocialPost()` (in `actions/posts.ts`): ensure the select query includes `source_pipeline_id, pipeline_snapshot, graduated_at`
2. In `post-detail.tsx`: add `PipelineContextPanel` below the existing content section (between content and deliveries, or in the sidebar area). Import from `../[id]/_components/pipeline-context-panel`
3. The `SocialPost` type from `@tn-figueiredo/social` may not include the new columns yet. Use type extension: `post as SocialPost & { source_pipeline_id?: string; pipeline_snapshot?: PipelineSnapshot; graduated_at?: string }`

**Dependencies**: Steps 3.3, 2.2
**Estimated time**: 30 min
**Acceptance criteria**:
- Social post detail page shows Pipeline Context Panel when `source_pipeline_id` is not null
- Social post detail page renders normally (no panel) for posts without pipeline provenance
- Pipeline code/title link navigates to correct pipeline detail page

---

## Phase 4: Tests (~3.5h)

### Step 4.1: Unit tests — graduation logic

**File**: `apps/web/test/lib/pipeline/graduation.test.ts` (new)

**What it does**: Tests the three pure/near-pure functions from `graduation.ts`.

**Test cases for `isSocialConfigComplete()`**:
- Returns `false` for `null`
- Returns `false` for `{ enabled: false, ... }`
- Returns `false` for `{ enabled: true, platforms: [] }`
- Returns `false` for `{ enabled: true, platforms: ['facebook'], captions: {} }` (no caption for selected platform)
- Returns `false` for `{ enabled: true, platforms: ['facebook'], captions: { facebook: { pt: '' } } }` (empty caption)
- Returns `true` for `{ enabled: true, platforms: ['facebook'], captions: { facebook: { pt: 'Hello' } }, ... }`
- Returns `true` for multi-platform with all captions filled

**Test cases for `buildPipelineSnapshot()`**:
- Captures all expected fields from a fully populated item
- Handles null sections gracefully (defaults to `{}`)
- Handles null optional fields (hook, synopsis, category, cover_image)
- Sets `graduated_at` to current ISO timestamp
- Sets `graduated_by` to provided userId
- Sets `version` from item

**Test cases for format mapping**:
- `blog_post` maps to `'blog'`
- `newsletter` maps to `'newsletter'`
- `campaign` maps to `'campaign'`
- `video` maps to `'video'`
- `course` returns undefined (unsupported)

**Dependencies**: Step 2.1
**Estimated time**: 1h
**Acceptance criteria**:
- All tests pass with `npm run test:web`
- Tests cover all branches of `isSocialConfigComplete()`
- No DB required (pure logic tests)

### Step 4.2: Integration tests — graduation flow (DB-gated)

**File**: `apps/web/test/integration/pipeline-social-graduation.test.ts` (new)

**What it does**: Tests the full graduation flow against a local Supabase instance. Gated behind `HAS_LOCAL_DB` per project convention.

**Test cases**:
- **Auto-graduation happy path**: Create pipeline item with complete social_config + linked blog_post_id, call `graduateToSocialPost()`, verify:
  - `social_posts` row created with status `'scheduled'`
  - `pipeline_snapshot` is non-null and contains expected fields
  - `source_pipeline_id` matches pipeline item ID
  - `content_pipeline.social_post_id` is set
  - `content_pipeline_history` has `'graduated'` event
- **Draft graduation (incomplete config)**: Config missing captions, verify draft social post with status `'draft'`
- **Draft graduation (no content entity)**: No blog_post_id set, verify draft without `source_content_type`
- **Duplicate prevention**: Graduate once, try again, verify unique index rejection returns error
- **Re-graduation after completion**: Mark first social post as `'completed'`, graduate again, verify new post created with new snapshot

**Pattern**: Uses `describe.skipIf(skipIfNoLocalDb())` from `test/helpers/db-skip.ts`. Uses seed helpers from `test/helpers/db-seed.ts` for creating test pipeline items.

**Dependencies**: Steps 1.1, 2.1
**Estimated time**: 1.5h
**Acceptance criteria**:
- All tests pass when `HAS_LOCAL_DB=1`
- Tests skip gracefully without local DB
- No test pollution (each test cleans up created rows)

### Step 4.3: Component tests — Social Config Editor

**File**: `apps/web/test/cms/pipeline/social-config-editor.test.tsx` (new)

**What it does**: Tests the Social Config Editor component rendering and interaction.

**Test cases**:
- Renders enable toggle, defaults to unchecked when config is null
- Enabling toggle shows platform selector
- Selecting a platform shows caption editor for that platform
- Caption editor shows character count
- Bluesky caption editor enforces 300 char limit indicator
- `onConfigChange` fires with correct shape when toggle is enabled
- IG template picker appears when Instagram is selected
- IG template picker hidden when Instagram is not selected
- Hashtag input pre-populates from tags prop

**Test approach**: Uses Vitest + React Testing Library (matching existing pattern in `test/cms/social-composer/schedule-bar.test.tsx`).

**Dependencies**: Step 3.1
**Estimated time**: 1h
**Acceptance criteria**:
- All component tests pass
- Tests don't require DB
- Tests verify user interactions, not implementation details

---

## Phase 5: Polish & Review (~2h)

### Step 5.1: Edge cases

**File**: Multiple files (modifications)

**What it does**: Handles the edge cases documented in the spec.

**Cases to address**:
1. **Snapshot creation with missing sections**: In `buildPipelineSnapshot()`, ensure `sections: item.sections ?? {}` (already in spec code). Add a try-catch around the entire snapshot build that returns `null` on failure, allowing graduation to proceed without snapshot.
2. **Pipeline item archived after graduation**: No code needed — `ON DELETE SET NULL` handles this at DB level. Verify in integration test.
3. **Version conflict during graduation**: Already handled by `updatePipelineItem()` optimistic locking. The `graduateToSocialAction` checks version before calling `graduateToSocialPost`. Add a unit test for this path.
4. **`createSocialPostFromContent()` failure**: In `graduateToSocialPost()`, wrap the auto-graduation path in try-catch. On failure, fall back to draft graduation. Log error to Sentry. Return `{ ok: false }` only if both paths fail.
5. **Batch advance triggering graduation**: In `BulkOperationSchema` handler (if batch advance exists as a server action), add graduation check after each advance. Cap at 5 graduations per batch per spec recommendation.

**Dependencies**: Steps 2.1, 2.3
**Estimated time**: 45 min
**Acceptance criteria**:
- Each edge case has either a code path or a test verifying the behavior
- No unhandled promise rejections from graduation failures
- Stage advance never fails due to graduation failure

### Step 5.2: Accessibility

**File**: `social-config-editor.tsx`, `pipeline-context-panel.tsx` (modifications)

**What it does**: Ensures both new components meet basic accessibility standards.

**Checklist**:
- [ ] All interactive elements have `aria-label` or visible label
- [ ] Platform selector uses `role="group"` with `aria-label="Platform selection"`
- [ ] Caption textareas have `aria-describedby` pointing to character count
- [ ] Enable toggle is a proper `<input type="checkbox">` with label
- [ ] Pipeline Context Panel collapsible uses `aria-expanded` and `aria-controls`
- [ ] Color contrast meets WCAG AA (already handled by gem-design system)
- [ ] Tab order is logical

**Dependencies**: Steps 3.1, 3.3
**Estimated time**: 30 min
**Acceptance criteria**:
- No accessibility warnings in browser devtools
- All controls are keyboard-navigable
- Screen reader announces toggle state correctly

### Step 5.3: Final test pass

**What it does**: Run the complete test suite to verify no regressions.

**Commands**:
```bash
npm run test:web
npm run test:api
```

**Specific suites to verify**:
- `test/lib/social/workflows-enhanced.test.ts` — unchanged behavior
- `test/cms/social-composer/schedule-bar.test.tsx` — unchanged behavior
- `test/lib/pipeline/graduation.test.ts` — new tests pass
- `test/cms/pipeline/social-config-editor.test.tsx` — new tests pass
- All existing pipeline tests
- All existing social tests

**Dependencies**: All previous steps
**Estimated time**: 30 min (running + fixing any issues)
**Acceptance criteria**:
- `npm run test:web` passes with 0 failures
- `npm run test:api` passes with 0 failures
- No TypeScript compilation errors

---

## Dependency Graph

```
Phase 1 (parallel start):
  Step 1.1 (migration) ─────────────────────────┐
  Step 1.2 (types) ──────────────────────────────┤
  Step 1.3 (schemas) ────────────────────────────┘
                                                  │
Phase 2 (sequential on Phase 1):                  ▼
  Step 2.1 (graduation.ts) ──── depends on 1.2, 1.3
  Step 2.2 (create-from-content) ── depends on 1.2
  Step 2.3 (pipeline actions) ──── depends on 2.1, 2.2
  Step 2.4 (graduation route) ──── depends on 2.1, 1.3
                                                  │
Phase 3 (sequential on Phase 2):                  ▼
  Step 3.1 (social-config-editor) ── depends on 1.2, 1.3
  Step 3.2 (wire into detail) ────── depends on 3.1, 2.3
  Step 3.3 (pipeline-context-panel) ── depends on 1.2
  Step 3.4 (wire into social detail) ── depends on 3.3, 2.2
                                                  │
Phase 4 (parallel with Phase 3 where possible):   ▼
  Step 4.1 (unit tests) ──────────── depends on 2.1
  Step 4.2 (integration tests) ──── depends on 1.1, 2.1
  Step 4.3 (component tests) ─────── depends on 3.1
                                                  │
Phase 5 (after all above):                        ▼
  Step 5.1 (edge cases) ──────────── depends on 2.1, 2.3
  Step 5.2 (a11y) ────────────────── depends on 3.1, 3.3
  Step 5.3 (final test pass) ─────── depends on all
```

**Parallelization opportunities**:
- Steps 1.1, 1.2, 1.3 can all be done in a single session
- Steps 2.1 and 2.2 are independent of each other
- Steps 3.1 and 3.3 are independent of each other
- Steps 4.1 and 4.2 can start as soon as Step 2.1 is done
- Step 4.3 can start as soon as Step 3.1 is done

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **`SocialPost` type from `@tn-figueiredo/social` package doesn't include new columns** | High | Low | Use type intersection `SocialPost & { source_pipeline_id?: string; ... }` at the call sites. Publish package update later (non-blocking). |
| **Unique partial index blocks legitimate re-graduation** | Medium | Medium | The index only covers `status IN ('draft', 'scheduled', 'publishing')`. Completed/failed/cancelled posts are excluded. Add explicit check in `graduateToSocialPost()` and return clear error message with link to existing post. |
| **`createSocialPostFromContent()` re-publish guard conflicts with pipeline graduation** | Medium | High | The re-publish guard (line 49-57 of create-from-content.ts) checks for existing draft/scheduled posts by `source_content_type + source_content_id`. Pipeline graduation may create a post with the same content entity. Mitigation: pass a flag or check `source_pipeline_id` to skip the re-publish guard for pipeline graduations. |
| **Migration fails on prod due to existing CHECK constraint name mismatch** | Low | High | Use `DROP CONSTRAINT IF EXISTS` before creating. Already in the migration SQL. Test against local Supabase first. |
| **Social connections not available when user configures social_config** | Medium | Low | Platform selector shows all platforms regardless of connection status. User can configure captions before connecting. Disconnected platforms show warning badge. At graduation time, deliveries are only created for connected platforms. |
| **Debounced `social_config` save causes version conflicts** | Medium | Medium | Use the same debounce pattern as existing field saves in `pipeline-item-detail.tsx` (debounced via `debouncedSave` helper). After save, update local version state from response. |
| **Large `pipeline_snapshot` JSONB bloats social_posts table** | Low | Low | Snapshot includes full sections JSONB which can be large for video items with scene guides. Acceptable for a single-user CMS. If needed later, add compression or selective snapshot. |

---

## File Summary

| File | Action | Phase |
|------|--------|-------|
| `supabase/migrations/20260515100000_pipeline_social_graduation.sql` | New | 1 |
| `apps/web/src/lib/social/types.ts` | Modify | 1 |
| `apps/web/src/lib/pipeline/schemas.ts` | Modify | 1 |
| `apps/web/src/lib/pipeline/graduation.ts` | New | 2 |
| `apps/web/src/lib/social/create-from-content.ts` | Modify | 2 |
| `apps/web/src/app/cms/(authed)/pipeline/actions.ts` | Modify | 2 |
| `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts` | Modify | 2 |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/social-config-editor.tsx` | New | 3 |
| `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` | Modify | 3 |
| `apps/web/src/app/cms/(authed)/social/[id]/_components/pipeline-context-panel.tsx` | New | 3 |
| `apps/web/src/app/cms/(authed)/social/_components/post-detail.tsx` | Modify | 3 |
| `apps/web/src/app/cms/(authed)/social/[id]/page.tsx` | Modify (minor) | 3 |
| `apps/web/src/lib/social/actions/posts.ts` | Modify (select columns) | 3 |
| `apps/web/test/lib/pipeline/graduation.test.ts` | New | 4 |
| `apps/web/test/integration/pipeline-social-graduation.test.ts` | New | 4 |
| `apps/web/test/cms/pipeline/social-config-editor.test.tsx` | New | 4 |

---

## Estimated Total: ~17h

| Phase | Estimate |
|-------|----------|
| Phase 1: Database & Types | 1.5h |
| Phase 2: Core Logic | 3.5h |
| Phase 3: UI Components | 5h |
| Phase 4: Tests | 3.5h |
| Phase 5: Polish & Review | 2h |
| **Buffer (unexpected issues)** | **1.5h** |
| **Total** | **~17h** |

For a single developer working in focused sessions, this is roughly 3 full days of work.
