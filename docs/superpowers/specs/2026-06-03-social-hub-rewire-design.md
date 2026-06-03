# Sprint 5h — Social Hub Publish Flow Rewire

**Date:** 2026-06-03
**Scope:** Fix all integration bugs in the social publish pipeline so every flow works end-to-end: compositor → publish/schedule → tracked link → platform delivery → status feedback.
**Estimate:** 16–24h
**Approach:** Rewire the publish flow (option B) — not surgical patches.

---

## 1. Problem Statement

The social infrastructure is ~90% built (providers, compositor, workflow, DB). But the pieces aren't wired together correctly:

| Bug | Root Cause |
|-----|-----------|
| Facebook post: no image, duplicated text | `formatFacebookContent()` joins title+description (both identical). `media_urls` ignored — only `/{page-id}/feed` used (text+link), never `/{page-id}/photos`. |
| Instagram story: all black | Konva template renders with dark bg. When `cover_image` is null, placeholder becomes semi-transparent gray rect on black — visually all black. No pre-publish validation. |
| No tracked link created | `createSocialPost()` (compositor path) never calls `ensureTrackedLink()`. Only the auto-draft pipeline does. `short_link_id` never set on post row. |
| Per-platform captions lost | `buildPublishPayload()` uses only first destination's caption for both `title` and `description`. Other platform captions discarded. |
| Canvas images not attached | `canvasImages` state in compositor never passed to `createSocialPost()`. Generated images lost. |
| Repost breaks link analytics | `duplicatePost()` copies content (with short URL) but not `short_link_id`, `source_content_id`, or `source_content_type`. |
| Draft can't be published | No `publishDraftPost` action existed (fixed in session, but must be integrated into the rewired flow). |
| Pending deliveries invisible | Delivery cards showed nothing for `pending`/`publishing` status (fixed in session). |
| Zero deliveries = silent auto-complete | Workflow marked posts as `completed` with no actual publication (fixed in session to `failed`). |

---

## 2. Architecture: Rewired Publish Flow

### Current (broken):
```
Compositor → flat payload (title=description=caption) → createSocialPost() → deliveries (same content) → workflow → provider receives raw content
```

### New:
```
Compositor
  → content.description (primary caption)
  → content.captions: { facebook: "...", instagram: "...", bluesky: "..." }
  → content.media_urls: [blob URLs from canvas/gallery/upload]
  → content.url (if applicable)
      ↓
createSocialPost()
  → upload media (blob/data URLs → Vercel Blob → public URLs)
  → ensureTrackedLink() → short_link_id + replace URL in content
  → insert post row + delivery rows with content_override per platform
      ↓
publishSocialPost() workflow (per delivery):
  1. adaptContent(post.content, delivery) → platform-specific payload
  2. prepareStoryDelivery() (if story format)
  3. provider.publish(adaptedContent)
      ↓
Provider receives ready-to-publish payload — no guessing
```

---

## 3. Component Changes

### 3.1 Compositor (`compositor-new.tsx`)

**`buildPublishPayload()` rewrite:**
- `content.description` = focused destination's caption (primary text)
- `content.captions` = `Record<Provider, string>` with all per-platform captions
- `content.media_urls` = array of image URLs from canvas exports + gallery selections
- `content.url` = user-entered URL or CMS content URL (before tracked link replacement)
- Remove `content.title` duplication (title only set if explicitly different from description)
- `storyMode` remains as-is

**Media integration:**
- Add `useMediaGallery()` hook for selecting existing images
- Add inline dropzone for new uploads (drag/drop/paste)
- Canvas-exported images stored in `canvasImages` state → included in `media_urls` on publish
- Both sources feed into `content.media_urls[]`

**Queue mode fix:**
- When `schedMode === 'queue'`, call `getNextQueueSlot()` to compute real `scheduledAt`
- Pass computed `scheduledAt` to `createSocialPost`

**Draft save fix:**
- Respect user's `schedMode` choice when saving draft (not hardcode `'now'`)

### 3.2 createSocialPost (`actions/posts.ts`)

**Tracked links (always when URL exists):**
```
if content.url exists:
  if sourceContentId + sourceContentType → ensureTrackedLink(source_type, source_id)
  else → ensureTrackedLink(source_type='social', source_id=postId)
  set short_link_id on post row
  replace content.url with buildShortUrl(code)
```
Reuses existing link for same content (idempotent). Manual posts get `source_type: 'social'`.

**Media upload:**
- Before insert, scan `content.media_urls` for non-https URLs (blob:, data:)
- Upload each to Vercel Blob via existing `uploadMediaAsset()` pipeline (SHA-256 dedup, EXIF strip)
- Replace with public blob URLs

**Per-delivery content_override:**
- For each delivery row, compute `content_override` JSONB with platform-adapted caption from `content.captions[provider]`
- Store in `social_deliveries.content_override` column (already exists in schema)

### 3.3 Workflow — adaptContent() (`workflows.ts`)

New function inserted at line 479, before story preparation:

```typescript
function adaptContent(
  post: SocialPost,
  delivery: SocialDelivery,
  trackedUrl: string | null,
): SocialPost
```

**Per-provider adaptation:**

| Provider | Format | Transformation |
|----------|--------|---------------|
| **Facebook** | link_share (no image) | `content.description` = fb caption (from captions map or content_override). `content.url` = tracked URL. No title duplication. |
| **Facebook** | link_share (with image) | Switch to `/{page-id}/photos` endpoint. `content.media_urls[0]` as photo URL. Caption in `message`. |
| **Instagram** | image_post | Validate `media_urls[0]` exists and is public URL. Set as `image_url`. Caption from ig-specific override. |
| **Instagram** | story | Existing `prepareStoryDelivery()` flow. Cover image validation: if null, use `media_urls[0]` as fallback. If still null, use gradient background (amber→orange, not black). |
| **Bluesky** | link_card | Caption with facets. URL embed with OG fetch. If `media_urls` present, attach as blob images. |
| **YouTube** | link_share | No change (video_id based). |

**Facebook photo post support:**
- Add `postPhotoToPage(pageId, pageToken, imageUrl, caption)` to meta provider
- Uses `POST /{page-id}/photos` with `url` (image URL) + `message` (caption)
- Decision rule in `adaptContent()`:
  - `media_urls.length > 0` AND no `content.url` → photo post (`/{page-id}/photos`)
  - `media_urls.length > 0` AND `content.url` exists → photo post with link in caption text
  - `media_urls.length === 0` AND `content.url` → link post (`/{page-id}/feed` with OG warming)
  - `media_urls.length === 0` AND no URL → text-only post (`/{page-id}/feed`, message only)

**Story rendering fix:**
- `renderTemplate()`: when `cover_image` is null/invalid, use warm gradient background instead of dark gray
- Pre-render validation: check all placeholder URLs are reachable before rendering
- Sentry breadcrumb for each render step

### 3.4 Facebook Provider (`packages/social/src/providers/meta/index.ts`)

**Changes to `FacebookProvider.publish()`:**
- Check `post.content.media_urls` — if present and non-empty, use photo post endpoint
- New `postPhotoToPage()` function: `POST /{page-id}/photos` with `{ url, message }`
- `formatFacebookContent()` fix: use only description (or fb-specific caption), not title+description concat
- OG warming: still run for link posts, skip for photo posts

### 3.5 duplicatePost() (`actions/posts.ts`)

**Copy missing fields:**
- Copy `source_content_id`, `source_content_type` from original
- Call `ensureTrackedLink()` with copied source fields → returns existing link (idempotent reuse)
- Set `short_link_id` on duplicate row
- Copy `content.captions` if present

### 3.6 publishDraftPost() (already implemented)

Integrated into the rewired flow. No additional changes needed — it triggers `publishSocialPost()` which now runs `adaptContent()`.

---

## 4. Link Strategy

**Rule: always create tracked link when content has a URL.**

| Scenario | Source Type | Source ID | Link Reuse |
|----------|-----------|----------|-----------|
| Blog → social | `blog` | blog post UUID | Yes — same blog = same link |
| Newsletter → social | `newsletter` | edition UUID | Yes |
| Manual post with URL | `social` | social post UUID | No — unique per post |
| Repost (duplicate) | Original's source_type | Original's source_id | Yes — same content = same link |
| Post without URL | — | — | No link created |

`ensureTrackedLink()` handles all idempotency. UTM params: `utm_source=social`, `utm_medium={provider}`, `utm_campaign={post_id}`.

---

## 5. Media Pipeline

```
User action                    → Result
─────────────────────────────────────────
Select from Media Gallery      → public Vercel Blob URL (already uploaded)
Drop/paste new image           → upload to Blob → public URL
Canvas editor export           → blob: URL in state → upload on publish → public URL
CMS content thumbnail          → existing public URL
```

**Validation per platform (pre-publish, in compositor):**

| Platform | Requirement |
|----------|------------|
| Instagram feed | ≥1 image required. JPEG/PNG. 1:1 or 4:5 aspect ratio recommended. |
| Instagram story | ≥1 image required. 9:16 aspect ratio. |
| Facebook | Image optional (text/link posts work). |
| Bluesky | Image optional. Max 4 images, 1MB each. |
| YouTube | N/A (video_id based). |

Show warning in compositor if Instagram is selected but no image attached.

---

## 6. Scheduling Integration

**Three modes in compositor, all fully wired:**

| Mode | Behavior |
|------|---------|
| `now` | `publishNow: true` → status `publishing` → workflow runs via `after()` |
| `schedule` | User picks date+time → `scheduledAt` ISO → status `scheduled` → cron picks up |
| `queue` | Call `getNextQueueSlot()` → compute `scheduledAt` → status `scheduled` → cron picks up |

**Cron flow (already working):** Every minute, `social_publish_fair_batch()` RPC finds posts with `status='scheduled'` and `scheduled_at ≤ now+5min`, runs `publishSocialPost()` workflow.

**Draft save:** Respects user's chosen `schedMode`. Saves `scheduledAt` if set. Status = `draft` regardless.

---

## 7. Error Handling

**Pre-publish validation (compositor, client-side):**
- Instagram selected + no media → block publish with error message
- No platforms selected → block
- Empty caption → block
- Invalid scheduled date (past) → block

**Workflow-level errors:**
- Connection revoked → delivery `skipped`, error shown in card
- Token expired → auto-refresh, retry once
- Transient API error (429, 5xx) → retry with backoff (3 attempts max)
- Permanent error (400, 403) → delivery `failed`, error shown
- Zero deliveries → post `failed` (not auto-completed)

**Story rendering errors:**
- Cover image unreachable → use `media_urls[0]` fallback → gradient bg last resort
- Konva render throws → Sentry capture + delivery `failed` with clear error

---

## 8. Safety: Idempotency, Rate Limiting, Recovery

### 8.1 Idempotent Status Transitions (CAS locks)

All status transitions MUST use compare-and-swap to prevent double-execution:

```typescript
// publishDraftPost: only transition if currently draft
.update({ status: 'publishing' })
.eq('id', postId)
.eq('status', 'draft')        // ← CAS guard
.select('id')
.maybeSingle()
// If null → already transitioned, return early (not an error)

// publishSocialPost workflow: only if not already publishing
.update({ status: 'publishing' })
.eq('id', post.id)
.or('status.eq.draft,status.eq.scheduled')  // ← CAS guard
```

**Apply to:** `publishDraftPost()`, `publishSocialPost()`, cron batch processor.
**UI:** Disable "Publicar agora" button while `isPending` (already done via `useTransition`).

### 8.2 Rate Limiting (activate existing DB infrastructure)

DB columns already exist on `social_connections`: `circuit_open_until`, `rate_window_start`, `rate_window_count`. Currently dead code.

**Design:**
- Before each `provider.publish()` in `executeWithRetry()`, check `connection.circuit_open_until > now` → skip with `error_type: 'transient'`
- After publish, increment `rate_window_count`. If window exceeded → set `circuit_open_until = now + cooldown`
- After 429 response, set `circuit_open_until` from `Retry-After` header (Meta's `rate-budget.ts` already parses this)
- Cooldown: Facebook 60s, Instagram 120s, Bluesky 30s

### 8.3 Stuck Post Recovery

Posts in `publishing` for >10 minutes are stuck (workflow died in `after()`).

**Design — add to cron:**
```sql
-- In social_publish_fair_batch() RPC or in the cron route:
SELECT * FROM social_posts
WHERE status = 'publishing'
  AND updated_at < now() - interval '10 minutes'
```
- Cron picks these up alongside `scheduled` posts
- Re-runs `publishSocialPost()` → idempotent (CAS prevents re-transition, but pending deliveries still process)
- Sets `sync_error` on post if delivery already completed (edge case)

### 8.4 content_override → Provider Merge

`content_override` is stored but never read. The workflow must merge it:

```typescript
// In publishSocialPost(), before provider.publish():
const effectiveContent = delivery.content_override
  ? { ...post.content, ...delivery.content_override }
  : post.content
const effectivePost = { ...post, content: effectiveContent }
// Pass effectivePost to provider.publish()
```

This makes per-platform captions actually work.

### 8.5 Backward Compatibility

- `SocialPostContentSchema` has all fields `.optional()` → adding `captions` field is safe
- Add to schema: `captions: z.record(z.string(), z.string()).optional()`
- Existing posts without `captions` field validate and publish as before (description used for all platforms)
- `adaptContent()` checks `content.captions?.[provider]` first, falls back to `content.description`

### 8.6 Bluesky Destination

Missing from `DESTINATIONS` map in `destinations.ts`. Add:
```typescript
bsky_feed: { provider: 'bluesky', label: 'Bluesky', ... }
```

---

## 9. Test Strategy

### Unit Tests (new/updated):

| Test | What it verifies |
|------|-----------------|
| `adaptContent()` per provider | Correct transformation for each provider×format combination |
| `createSocialPost` + tracked link | Link created, `short_link_id` set, URL replaced, reuse on same content |
| Facebook photo post | `postPhotoToPage()` called when `media_urls` present |
| Facebook text formatting | No title+description duplication |
| Instagram feed validation | Rejects publish when `media_urls` empty |
| Story rendering fallback | Gradient bg when cover_image null (not black) |
| `duplicatePost` link reuse | Copies source fields, `ensureTrackedLink` returns existing |
| Queue slot wiring | `getNextQueueSlot()` returns valid UTC datetime |
| `publishDraftPost` CAS | Second call returns early (not error), no double-publish |
| `content_override` merge | Per-platform caption from delivery.content_override used by provider |
| Rate limit circuit breaker | Publish skipped when `circuit_open_until > now` |
| Stuck post recovery | Post in `publishing` for >10min re-processed by cron |

### Integration Tests:

| Test | Flow |
|------|------|
| Compose → publish → verify deliveries | Create post with image + 2 platforms → verify adaptContent output per delivery |
| Schedule → cron → publish | Create scheduled post → simulate cron trigger → verify published |
| Repost → same tracked link | Duplicate post → publish → verify same `short_link_id` |
| Draft → edit → publish | Create draft → update caption → publishDraftPost → verify content |
| Double-publish idempotency | Call publishDraftPost twice concurrently → only 1 publish runs |
| Stuck recovery | Set post to publishing + old updated_at → cron picks it up |

### Manual Verification (before merge):

- [ ] Create post with image → publish to Facebook → verify photo appears
- [ ] Create post with image → publish to Instagram feed → verify image + caption
- [ ] Create story from CMS content → verify rendering (not black)
- [ ] Schedule post for +5min → wait → verify auto-published
- [ ] Duplicate published post → publish again → verify same tracked link in Links page
- [ ] Verify tracked link appears in /cms/links with clicks tracking
- [ ] Double-click "Publicar agora" rapidly → verify only 1 post appears on platform
- [ ] Publish to FB+IG → verify different captions per platform (if set)

---

## 10. Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/social/new/_components/compositor-new.tsx` | Rewrite `buildPublishPayload()`, add media gallery/dropzone, fix queue wiring |
| `apps/web/src/app/cms/(authed)/social/new/_components/dest-compositor.tsx` | Wire media selection to compositor state |
| `apps/web/src/lib/social/actions/posts.ts` | Tracked link creation, media upload, `content_override`, fix `duplicatePost()`, CAS on `publishDraftPost()` |
| `apps/web/src/lib/social/actions/index.ts` | Export new functions |
| `apps/web/src/lib/social/workflows.ts` | `adaptContent()`, `content_override` merge, CAS on status transition, story fallback |
| `apps/web/src/app/api/cron/social-publish/route.ts` | Add stuck post recovery (publishing >10min) |
| `packages/social/src/providers/meta/index.ts` | Fix `formatFacebookContent()`, add photo post support |
| `packages/social/src/providers/meta/facebook.ts` | Add `postPhotoToPage()` API function |
| `packages/social/src/core/types.ts` | Add `captions` to `SocialPostContentSchema` |
| `apps/web/src/lib/social/destinations.ts` | Add `bsky_feed` destination |
| `apps/web/src/lib/social/story-slides.ts` | Gradient fallback for null cover_image |
| `apps/web/src/lib/social/konva-renderer.ts` | Warm gradient instead of dark gray for missing images |
| 12+ test files | New and updated tests per Section 9 |

---

## 11. Out of Scope

- YouTube community posts (API doesn't support; only video publish)
- Instagram carousel (multi-image feed posts) — single image first
- Instagram Reels (video-only format)
- Bluesky thread posts
- AI caption generation improvements
- Real-time WebSocket reconnection logic (works, just needs page refresh on disconnect)
- Canvas editor UI redesign (functional as-is)

---

## 12. Success Criteria

The sprint is done when:

1. **Facebook:** Photo post with image appears correctly, text not duplicated, tracked link included
2. **Instagram feed:** Image post publishes with correct caption and image
3. **Instagram story:** Renders with visible content (cover image or gradient), not black
4. **Bluesky:** Link card with OG preview publishes correctly
5. **Tracked links:** Every social post with URL creates/reuses tracked link visible in /cms/links
6. **Scheduling:** All 3 modes (now/schedule/queue) work end-to-end
7. **Repost:** Duplicate uses same tracked link, publishes successfully
8. **Draft → publish:** "Publicar agora" works from detail page
9. **Per-platform captions:** Each platform gets its own caption text
10. **Idempotent:** Double-click "Publicar" = 1 post on platform, not 2
11. **Recovery:** Post stuck in `publishing` >10min auto-recovered by cron
12. **Bluesky:** Destination available in compositor, publishes with link card
13. **All tests pass:** Unit + integration, 0 regressions
