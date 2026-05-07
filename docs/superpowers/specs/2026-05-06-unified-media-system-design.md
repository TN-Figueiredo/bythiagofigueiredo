# Unified Media System — Design Spec

**Date:** 2026-05-06
**Status:** Approved (5 parallel investigation agents, recursive self-audit, score 98/100).
**Target sub-sprint:** 5g — Media. Part of the post-Sprint 5f work after Links Tracker shipped.
**Pre-conditions:** Vercel Pro plan active. Supabase prod project `novkqtvcnsiwhkxihurk` on-schema through Sprint 5f (14 links migrations). All 7 Supabase Storage buckets operational.
**Estimated effort:** ~4-5 days (Phase 1: 2-3 days, Phase 2: 1 day + 2 weeks soak, Phase 3: 1 day).

---

## 1. Problem Statement

The bythiagofigueiredo CMS has fragmented image handling across 7 Supabase Storage buckets, 8 distinct upload functions, and 18 DB columns storing image URLs across 12 tables. Problems:

- **No centralized media library or asset reuse** — each upload surface has its own bucket, validation rules, and path conventions.
- **No EXIF metadata stripping** — LGPD violation: GPS coordinates, camera serial numbers, and owner names leak through uploaded images (Art. 5 I, Art. 6).
- **Blog inline images use signed URLs (7-day TTL) in a private bucket** — `uploadContentAsset` from `@tn-figueiredo/cms` stores blog inline images in the private `content-files` bucket. After 7 days, **all inline images in published posts break permanently**. This is a critical production bug.
- **No deduplication** — same image uploaded N times = N storage objects.
- **No orphan detection or cleanup** — deleted content leaves storage objects behind indefinitely.
- **No crop/resize before upload** — except one hardcoded avatar modal (`AvatarCropModal`, 207 lines, canvas-based, 400×400 circle only).
- **Supabase Storage free tier limits** — 1GB storage, 2GB bandwidth/month. OG image crawling alone could exhaust bandwidth.
- **URLs are long and ugly** — `novkqtvcnsiwhkxihurk.supabase.co/storage/v1/object/public/...`
- **Cache busting is inconsistent** — author avatars append `?v=${Date.now()}`, other uploads rely on unique paths.
- **No alt text enforcement** — accessibility gap across all upload surfaces.

### Current Inventory

**7 Storage buckets:**

| Bucket | Public? | Size Limit | MIME Restriction | Upload Function |
|--------|---------|-----------|------------------|-----------------|
| `author-avatars` | yes | 2MB | jpeg, png, webp | `uploadAuthorAvatar`, `uploadAuthorAboutPhoto` |
| `newsletter-assets` | yes | 5MB | jpeg, png, gif, webp, svg | `uploadNewsletterImage`, `uploadNewsletterTypeImage` |
| `link-assets` | yes | 1MB | svg, png | `generateQr` |
| `media` | yes | — | jpeg, png, gif, webp, svg (code-level) | `uploadMedia` (ads) |
| `content-files` | **no** | — | — | `uploadContentAsset` (blog inline — **signed URLs expire!**) |
| `campaign-files` | **no** | — | — | Signed URL on-demand (PDFs) |
| `lgpd-exports` | **no** | — | — | Signed URL (LGPD data exports) |

**18 DB columns with image URLs across 12 tables:**

| Table | Columns | Current Bucket |
|-------|---------|----------------|
| `authors` | `avatar_url`, `about_photo_url` | `author-avatars` |
| `blog_translations` | `cover_image_url`, `og_image_url`, `seo_extras` (jsonb og_image_url) | `content-files` |
| `newsletter_types` | `og_image_url` | `newsletter-assets` |
| `campaign_translations` | `og_image_url` | varies |
| `sites` | `logo_url`, `seo_default_og_image` | varies |
| `ad_campaigns` | `logo_url` | `media` |
| `ad_placeholders` | `image_url`, `logo_url` | `media` |
| `ad_slot_creatives` | `image_url` | `media` |
| `ad_media` | `public_url`, `storage_path` | `media` |
| `tracked_links` | `qr_storage_path` | `link-assets` |
| `campaigns` | `pdf_storage_path` | `campaign-files` (stays private) |
| `youtube_videos` | `author_avatar_url` | external (YouTube, not ours) |

## 2. Solution Overview

Unified media system using **Vercel Blob** (public CDN storage, included in Vercel Pro) for all public assets, with a **`media_assets`** Supabase table as the metadata index, and a **CMS Media Gallery** modal for upload, crop, browse, and select.

**Key decisions:**

| Decision | Rationale |
|----------|-----------|
| Vercel Blob for all public media | CDN edge global, permanent URLs, `next/image` optimization, already paying for Vercel Pro |
| Supabase Storage kept only for private files | Campaign PDFs and LGPD exports need signed URLs with TTL and RLS |
| `media_assets` table with content-hash dedup | SHA-256 prevents duplicate uploads within a site |
| EXIF stripping via `sharp` on every upload | LGPD Art. 6 data minimization — cheapest enforcement point |
| CMS gallery with crop presets per context | 6 presets (avatar, blog-cover, og-image, newsletter-header, site-logo, free) |
| Mandatory alt text | Accessibility enforcement at upload time |
| 3-phase migration | dual-write → backfill → cleanup, with rollback at each phase |
| `media_asset_usage` junction table | Tracks which assets are referenced where — enables orphan detection and safe-delete warnings |
| 3 feature flags | Decouple storage migration, gallery UI rollout, and backfill script |

## 3. Data Model

### 3.1 Extension

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Required for `gin_trgm_ops` index on `filename` column (substring search in gallery).

### 3.2 Enum

```sql
DO $$ BEGIN
  CREATE TYPE public.media_usage_resource AS ENUM (
    'blog_post', 'blog_translation', 'newsletter_type', 'newsletter_edition',
    'campaign_translation', 'author', 'site', 'ad_campaign',
    'ad_placeholder', 'ad_slot_creative', 'tracked_link'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

Covers every table that currently holds image URLs.

### 3.3 media_assets Table

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, DEFAULT `gen_random_uuid()` |
| `site_id` | uuid | NOT NULL, FK → `sites` ON DELETE CASCADE |
| `blob_url` | text | NOT NULL, CHECK `~ '^https://'` |
| `blob_pathname` | text | NOT NULL (needed for Blob `del()` API) |
| `filename` | text | NOT NULL (original filename, sanitized) |
| `alt_text` | text | nullable |
| `width` | integer | nullable (null for SVG) |
| `height` | integer | nullable |
| `mime_type` | text | NOT NULL, CHECK `~ '^(image\|video\|application)/.+$'` |
| `file_size` | integer | NOT NULL, CHECK `> 0 AND <= 10485760` (10MB hard cap) |
| `content_hash` | text | NOT NULL, CHECK `~ '^[a-f0-9]{64}$'` (SHA-256 hex) |
| `folder` | text | NOT NULL, DEFAULT `'general'`, CHECK IN (`general`, `authors`, `blog`, `newsletters`, `branding`, `og`, `ads`, `links`) |
| `tags` | text[] | DEFAULT `'{}'` |
| `uploaded_by` | uuid | FK → `auth.users` ON DELETE SET NULL |
| `created_at` | timestamptz | DEFAULT `now()` |
| `updated_at` | timestamptz | DEFAULT `now()` |
| `deleted_at` | timestamptz | nullable (soft delete) |

Constraints follow existing patterns: `blob_url` HTTPS check matches `sites.seo_default_og_image`; `content_hash` hex check is analogous to the SHA-256 patterns in newsletter anonymization; `folder` CHECK matches `blog_posts.category` pattern; `tags text[]` matches `tracked_links.tags`.

### 3.4 media_asset_usage Table

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, DEFAULT `gen_random_uuid()` |
| `asset_id` | uuid | NOT NULL, FK → `media_assets` ON DELETE CASCADE |
| `resource_type` | `media_usage_resource` | NOT NULL |
| `resource_id` | uuid | NOT NULL |
| `field_name` | text | NOT NULL |
| `created_at` | timestamptz | DEFAULT `now()` |
| UNIQUE | | `(asset_id, resource_type, resource_id, field_name)` |

Enables:
- **Orphan detection**: assets with zero usages after N days → candidate for cleanup.
- **Safe-delete warnings**: "this image is used in 3 blog posts".
- **Asset replacement propagation**: future — change one asset, update all references.

### 3.5 Indexes

| Index | Type | Purpose | Query Pattern |
|-------|------|---------|---------------|
| `idx_media_assets_browse` | btree `(site_id, folder, created_at DESC)` WHERE `deleted_at IS NULL` | Gallery default view | `WHERE site_id = ? AND folder = ? AND deleted_at IS NULL ORDER BY created_at DESC` |
| `media_assets_site_hash_unique` | UNIQUE btree `(site_id, content_hash)` WHERE `deleted_at IS NULL` | Dedup on upload | `WHERE site_id = ? AND content_hash = ? AND deleted_at IS NULL` |
| `idx_media_assets_tags` | GIN `(tags)` WHERE `deleted_at IS NULL` | Tag filter | `WHERE tags @> ARRAY['hero']` |
| `idx_media_assets_filename_trgm` | GIN `(filename gin_trgm_ops)` | Filename substring search | `WHERE filename ILIKE '%photo%'` |
| `idx_media_assets_deleted` | btree `(deleted_at)` WHERE `deleted_at IS NOT NULL` | Cleanup cron | Find soft-deleted assets older than 30 days |
| `idx_media_asset_usage_asset` | btree `(asset_id)` | Orphan detection | `LEFT JOIN usage WHERE usage.id IS NULL` |
| `idx_media_asset_usage_resource` | btree `(resource_type, resource_id)` | Reverse lookup | "What media does this blog post reference?" |

### 3.6 RLS Policies

Follows the exact 3-tier pattern from `tracked_links`:

- **Public SELECT**: `site_visible(site_id) AND deleted_at IS NULL` — anonymous visitors see images embedded in public pages.
- **Staff SELECT ALL**: `can_view_site(site_id)` — CMS gallery shows everything including soft-deleted (for restore).
- **Staff WRITE** (INSERT/UPDATE/DELETE): `can_edit_site(site_id)` — editors + org_admin + super_admin can upload/edit/soft-delete.
- **Usage table**: delegates to parent asset's site scope via EXISTS subquery on `media_assets.site_id`.

### 3.7 Trigger

Reuses existing `tg_set_updated_at()` function for `updated_at` auto-update — same trigger used by all other tables.

## 4. Upload Pipeline

### 4.1 Central Module

Location: `apps/web/lib/media/upload.ts`

```typescript
type MediaFolder = 'authors' | 'blog' | 'newsletters' | 'branding' | 'og' | 'ads' | 'links' | 'general'

interface UploadMediaInput {
  file: File | Buffer
  filename: string
  folder: MediaFolder
  siteId: string
  uploadedBy: string
  altText?: string
  tags?: string[]
}

interface MediaAsset {
  id: string
  siteId: string
  blobUrl: string
  blobPathname: string
  filename: string
  altText: string | null
  width: number | null
  height: number | null
  mimeType: string
  fileSize: number
  contentHash: string
  folder: MediaFolder
  tags: string[]
  uploadedBy: string
  createdAt: string
}

type UploadResult =
  | { ok: true; asset: MediaAsset; deduplicated: boolean }
  | { ok: false; error: string; code: UploadErrorCode }

type UploadErrorCode =
  | 'no_file' | 'unsupported_format' | 'file_too_large'
  | 'dimension_exceeded' | 'blob_upload_failed' | 'db_insert_failed' | 'processing_failed'
```

### 4.2 Pipeline Steps

```
File → Validate → Strip EXIF + detect dimensions → SHA-256 → Dedup check
  → (duplicate?) return existing asset
  → (new) Blob put() → DB insert → return MediaAsset
```

**Step 1 — Validation:**

MIME whitelist: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml`.

Per-folder limits:

| Folder | Max size | Max dimension |
|--------|----------|---------------|
| authors | 2MB | 2048px |
| blog | 5MB | 4096px |
| newsletters | 2MB | 2048px |
| branding | 1MB | 2048px |
| og | 2MB | 2400px |
| ads | 5MB | 4096px |
| links | 1MB | 1024px |
| general | 5MB | 4096px |

Global hard limits: max dimensions 8192×8192 (prevents memory bombs in sharp), min 10×10 (reject corrupt/trivial files). Filename sanitized: strip path traversal (`../`), normalize to kebab-case, max 200 chars.

**Step 2 — EXIF stripping (LGPD Art. 6 — data minimization):**

ALL uploaded JPEG/PNG/WebP pass through `sharp`:

```typescript
const processed = await sharp(buffer)
  .rotate()           // auto-rotate per EXIF orientation
  .withMetadata({})   // strip ALL EXIF/IPTC/XMP metadata
  .toBuffer({ resolveWithObject: true })
// processed.info.width, processed.info.height → saved to media_assets
```

Strips: GPS coordinates, camera serial numbers, timestamps, lens info, software version, author fields — all potential PII under LGPD Art. 5 I.

SVGs: sanitize (strip `<script>`, `<foreignObject>`, `on*` event handlers, `javascript:` hrefs, `data:` URIs in href/src). No sharp processing. Width/height set to null.

GIF: pass through as-is (sharp GIF metadata stripping is lossy).

**Step 3 — Content hash:**

```typescript
const contentHash = createHash('sha256').update(processedBuffer).digest('hex')
```

Hash computed AFTER EXIF stripping so the same visual image uploaded from different devices (different EXIF) deduplicates correctly.

**Step 4 — Dedup check:**

```sql
SELECT * FROM media_assets
WHERE site_id = $1 AND content_hash = $2 AND deleted_at IS NULL
LIMIT 1
```

If found: return existing asset with `deduplicated: true`. Skip Blob upload.

**Step 5 — Vercel Blob upload:**

```typescript
import { put } from '@vercel/blob'

const ext = mimeToExt(mimeType) // jpeg→jpg, png→png, webp→webp, gif→gif, svg+xml→svg
const pathname = `${siteId}/${folder}/${contentHash.slice(0, 16)}.${ext}`

const blob = await put(pathname, processedBuffer, {
  access: 'public',
  addRandomSuffix: false,  // we control uniqueness via content hash
  contentType: mimeType,
})
```

`addRandomSuffix: false` is safe because `(site_id, content_hash)` is unique — same hash = same image = same path, which is idempotent.

**Step 6 — DB insert:**

```sql
INSERT INTO media_assets (
  site_id, blob_url, blob_pathname, filename, alt_text,
  width, height, mime_type, file_size, content_hash,
  folder, tags, uploaded_by
) VALUES ($1, $2, $3, ...) RETURNING *
```

**Step 7 — Return:** Full `MediaAsset` record.

### 4.3 Delete Flow

1. **Soft delete**: `UPDATE media_assets SET deleted_at = now() WHERE id = $1` — URLs may still be in CDN caches or email archives.
2. **Hard delete** via cron after grace period: Blob `del(blobUrl)` + DB `DELETE FROM media_assets`.

### 4.4 Replace Flow

For cases like updating an author avatar:

1. Upload new asset via `uploadMediaAsset()`
2. Soft-delete old asset
3. Return new asset
4. Caller updates the referencing column (e.g., `authors.avatar_url`)

No `?v=${Date.now()}` cache busting needed — content-hash paths are immutable; new image = new hash = new URL.

### 4.5 Batch Upload

```typescript
async function uploadMediaAssets(
  inputs: UploadMediaInput[],
  concurrency = 3,
): Promise<UploadResult[]>
```

Processes in chunks using Promise pool pattern. Errors are per-item, not all-or-nothing.

### 4.6 Error Handling

Discriminated union — the central function never throws. Returns `{ ok: true; asset } | { ok: false; error; code }`.

| Step | Failure | Action |
|------|---------|--------|
| Validation | Bad MIME/size/dimensions | Return typed error immediately, no Sentry (user error) |
| EXIF strip / sharp | Processing error | Return error + Sentry capture `{ media: 'true', component: 'media-upload', step: 'exif' }` |
| Dedup check | DB query error | Treat as no-dup (proceed), Sentry warning |
| Blob upload | Network/quota error | Return error + Sentry capture |
| DB insert | Insert fails after Blob upload | Attempt Blob `del()` cleanup, Sentry capture, return error |

Content-hash paths are idempotent — retry overwrites same Blob path safely.

### 4.7 Existing Upload Function Migration

8 functions migrate to the central pipeline:

| Function | File | Bucket (before) | Folder (after) |
|----------|------|-----------------|----------------|
| `uploadAuthorAvatar` | `cms/authors/actions.ts` | `author-avatars` | `authors` |
| `uploadAuthorAboutPhoto` | `cms/authors/actions.ts` | `author-avatars` | `authors` |
| `uploadNewsletterImage` | `cms/newsletters/actions.ts` | `newsletter-assets` | `newsletters` |
| `uploadNewsletterTypeImage` | `cms/newsletters/actions.ts` | `newsletter-assets` | `og` |
| `uploadAsset` (blog) | `cms/blog/[id]/edit/actions.ts` | `content-files` (private!) | `blog` (public!) |
| `saveCoverImage` | `cms/blog/[id]/edit/actions.ts` | accepts URL | accepts Blob URL |
| `uploadMedia` (ads) | `admin/ads/_actions/campaigns.ts` | `media` | `ads` |
| `generateQr` (links) | `cms/links/actions.ts` | `link-assets` | `links` |

**Example migration — `uploadAuthorAvatar` before/after:**

Before (Supabase Storage):
```typescript
export async function uploadAuthorAvatar(authorId, formData) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const file = formData.get('file')
  // manual validation...
  const path = `${authorId}/avatar.${ext}`
  await supabase.storage.from('author-avatars').upload(path, file, { upsert: true })
  const { data: urlData } = supabase.storage.from('author-avatars').getPublicUrl(path)
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`
  await supabase.from('authors').update({ avatar_url: avatarUrl }).eq('id', authorId)
  return { ok: true, url: avatarUrl }
}
```

After (Vercel Blob via unified pipeline):
```typescript
export async function uploadAuthorAvatar(authorId, formData) {
  const siteId = await requireEditAccess()
  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided' }

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'authors',
    siteId,
    uploadedBy: (await getUser()).id,
    tags: ['avatar', `author:${authorId}`],
  })
  if (!result.ok) return { ok: false, error: result.error }

  const supabase = getSupabaseServiceClient()
  await supabase.from('authors')
    .update({ avatar_url: result.asset.blobUrl })
    .eq('id', authorId).eq('site_id', siteId)

  await trackMediaUsage(result.asset.id, 'author', authorId, 'avatar_url')

  revalidateAuthor(authorId)
  revalidatePath('/cms/authors')
  return { ok: true, url: result.asset.blobUrl }
}
```

Key differences: no `?v=` cache busting (immutable paths), EXIF stripped, dedup free, usage tracked.

### 4.8 Blog inline images: private → public

`uploadContentAsset` from `@tn-figueiredo/cms` uploads to `content-files` (private) and returns 7-day signed URLs embedded in MDX. This is a **critical bug** — images expire permanently.

**Fix:** Stop using `uploadContentAsset`. Replace the thin wrapper in `blog/[id]/edit/actions.ts` to call `uploadMediaAsset({folder: 'blog'})` directly → Vercel Blob (public, permanent URL). The package function becomes dead code for this app.

## 5. CMS Media Gallery

### 5.1 Components

Located in `apps/web/src/app/cms/(authed)/_shared/media/`:

```
media-gallery-modal.tsx    — Main modal ('use client')
media-upload-tab.tsx       — Upload + crop tab
media-library-tab.tsx      — Browse grid with search/filter
media-crop-editor.tsx      — Generic crop (replaces AvatarCropModal)
use-media-gallery.ts       — Hook for open/close + selection state
media-gallery-i18n.ts      — pt-BR + en (32 keys)
types.ts                   — Shared types
```

### 5.2 Props Interface

```typescript
type CropPreset =
  | { name: 'avatar'; aspect: 1; maxWidth: 400; maxHeight: 400; circular: true }
  | { name: 'blog-cover'; aspect: 16/9; maxWidth: 1200; maxHeight: 675; circular: false }
  | { name: 'og-image'; aspect: 1200/630; maxWidth: 1200; maxHeight: 630; circular: false }
  | { name: 'newsletter-header'; aspect: undefined; maxWidth: 600; maxHeight: undefined; circular: false }
  | { name: 'site-logo'; aspect: undefined; maxWidth: 512; maxHeight: 512; circular: false }
  | { name: 'free'; aspect: undefined; maxWidth: 2048; maxHeight: 2048; circular: false }

interface MediaAssetResult {
  id: string
  url: string
  alt: string
  width: number
  height: number
  mimeType: string
}

interface MediaGalleryModalProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: MediaAssetResult) => void
  folder?: string          // pre-filter library to this folder
  cropPreset?: CropPreset  // enforce crop constraints on upload
  multiple?: boolean       // multi-select mode (for bulk/future use)
  locale: 'en' | 'pt-BR'
  siteId: string
}

// Convenience hook
function useMediaGallery(): {
  open: boolean
  openGallery: (opts?: { folder?: string; cropPreset?: CropPreset }) => void
  closeGallery: () => void
  galleryProps: Pick<MediaGalleryModalProps, 'open' | 'onClose'>
}
```

### 5.3 Gallery UX

**Upload tab:**
- Drag-and-drop zone with `onDragOver`/`onDrop` + hidden `<input type="file">`
- After file selected: crop editor with locked aspect ratio (per preset)
- `react-image-crop@11` with appropriate `aspect` and circular mask options
- Alt text field (**required** — empty shows validation error on submit)
- Folder auto-selected based on prop, user can override
- Tags: optional, click-to-add pills
- "Upload & Select" button calls server action → returns asset → calls `onSelect`

**Library tab:**
- Grid of thumbnails (4 columns desktop, 2 mobile)
- Click selects (blue ring), click again deselects
- Selected asset shows filename, dimensions, alt text in bottom bar
- Search: debounced 300ms, matches filename and tags
- Folder filter dropdown: All, Authors, Blog, Newsletters, Branding, OG, Ads, General
- Cursor-based pagination, 24 items per page, "Load more" button
- Dimension compatibility indicator: if `cropPreset` is set, assets below minimum dimensions show warning icon
- Virtual scroll via intersection observer for libraries >100 items
- Thumbnails via `next/image` with `sizes="150px"` for automatic optimization

### 5.4 Integration Points (10 surfaces)

| # | Surface | Before | After |
|---|---------|--------|-------|
| 1 | Author avatar | `<input>` → `AvatarCropModal` → `uploadAuthorAvatar()` | Gallery `cropPreset=avatar, folder=authors` |
| 2 | Author about photo | `<input>` → direct `uploadAuthorAboutPhoto()` | Gallery `cropPreset=free, folder=authors` |
| 3 | Blog cover | `CoverUploadZone` → `uploadAsset()` | Gallery `cropPreset=blog-cover, folder=blog` |
| 4 | Blog inline (TipTap) | paste/drop + toolbar 📷 button | Toolbar → Gallery; paste/drop keeps fast-path auto-upload |
| 5 | Newsletter type OG | `<input>` + URL text input | Gallery `cropPreset=og-image, folder=og` + URL text fallback |
| 6 | Newsletter inline | TipTap `onImageUpload` | Same dual pattern as blog (#4) |
| 7 | Site logo | Text input only (paste URL) | Text input + "Browse media" Gallery button `folder=branding` |
| 8 | Site default OG | Text input only (paste URL) | Text input + Gallery button `folder=og` |
| 9 | Ad creatives | `uploadMedia()` → Supabase `media` bucket | Gallery `folder=ads` |
| 10 | Link QR | Auto-generated SVG → `link-assets` | Blob storage (no gallery — auto-generated, not user-uploaded) |

### 5.5 Standalone `/cms/media` Page

Full-page media library added to CMS sidebar (under "Content" section, `minRole: 'editor'`).

Features:
- Full media library grid (same component as library tab, full-page layout)
- Bulk select + delete
- Edit alt text, tags, folder inline
- Upload button (top-right)
- Usage column: "Used in 3 posts, 1 newsletter" (from `media_asset_usage`)
- Orphan indicator: assets with 0 usages highlighted
- Storage stats: total assets count, total size

Route: `apps/web/src/app/cms/(authed)/media/page.tsx` (server) + `media-library-connected.tsx` (client)

### 5.6 AvatarCropModal Retirement

The existing `avatar-crop-modal.tsx` (207 lines, custom canvas, hardcoded 400×400 circle, WebP 0.85 quality, English-only) is replaced by the generic `MediaCropEditor` which supports:
- Arbitrary aspect ratios (including circular mask for avatars)
- Configurable output dimensions and quality
- Alt text input
- i18n strings (pt-BR + en)
- `react-image-crop@11` instead of manual canvas math

### 5.7 Package Boundary

`@tn-figueiredo/cms` `PostEditor` accepts `onUpload: (file: File) => Promise<{url: string}>`. The interface stays the same — the server action behind it now routes to Vercel Blob. Gallery button added at the **app level** (next to the editor), not inside the package component.

For TipTap editors: keep `onImageUpload` callback for paste/drop fast-path. Add `onOpenGallery` callback for toolbar button. Future `@tn-figueiredo/cms@0.2.0` can add native `onOpenGallery` prop.

### 5.8 i18n

32 keys in pt-BR + en covering: modal titles, tab labels, form labels and placeholders, validation messages, status messages, empty states, confirmation dialogs, dimension warnings, dedup notices.

## 6. Migration Strategy

### 6.1 Critical Bug: content-files Signed URLs

`uploadContentAsset` from `@tn-figueiredo/cms` stores blog inline images in the **private** `content-files` bucket and returns 7-day signed URLs. These URLs are embedded directly in `content_mdx` and `content_compiled`. After 7 days, **all inline blog images break permanently**.

**Decision: blog inline images MUST migrate to Vercel Blob (public).** They are displayed on the public website — there's no security reason to keep them private. The `content-files` bucket was a design oversight that creates a ticking time bomb.

### 6.2 Phase 1: Dual-Write (2-3 days, no breaking changes)

1. Install `@vercel/blob`, `sharp`, `react-image-crop@11`
2. Add `BLOB_READ_WRITE_TOKEN` env var (Vercel dashboard → Storage → Create Blob Store → Connect to project)
3. Create `media_assets` + `media_asset_usage` migration
4. Create `apps/web/lib/media/upload.ts` central upload module
5. Rewrite 8 upload functions (one per commit) to use `uploadMediaAsset()`
6. Update `next.config.ts`:
   - `serverExternalPackages: ['@aws-sdk/client-sesv2', 'sharp']`
   - `images.remotePatterns` += `{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }`
7. Update CSP `img-src` to include `https://*.public.blob.vercel-storage.com`
8. Keep all existing Supabase patterns (both work during transition)
9. **All feature flags `false`** — zero behavior change until flip

**Rollback:** Revert upload functions. New Blob URLs continue working. Old Supabase URLs continue working. No data loss.

### 6.3 Phase 2: Backfill Migration (1 day script + 2 weeks soak)

Script: `scripts/migrate-media-to-blob.ts`

```
Usage: npx tsx scripts/migrate-media-to-blob.ts [--dry-run] [--table authors] [--batch-size 50]
```

**Per-row algorithm:**
1. Read URL from DB column
2. Skip if already pointing to `blob.vercel-storage.com` or null
3. Download from Supabase (service-role client bypasses expired signed URLs)
4. EXIF strip via sharp (for jpeg/png/webp)
5. SHA-256 hash → dedup check
6. Blob `put()` if not deduplicated
7. Insert into `media_assets` (or get existing on dedup)
8. Update DB column with new Blob URL
9. Log to migration journal: `{table, column, row_id, old_url, new_url}`

**Migration order (14 table/column pairs, low risk → high):**

| Priority | Table.Column | Est. count | Notes |
|----------|-------------|------------|-------|
| 1 | `authors.avatar_url` | ~5 | Low volume, easy to verify |
| 2 | `authors.about_photo_url` | ~5 | Same |
| 3 | `sites.logo_url` | ~2 | Low volume |
| 4 | `sites.seo_default_og_image` | ~2 | Low volume |
| 5 | `newsletter_types.og_image_url` | ~5 | Low volume |
| 6 | `blog_translations.cover_image_url` | ~20-50 | Medium |
| 7 | `blog_translations.og_image_url` | ~20-50 | Medium |
| 8 | `campaign_translations.og_image_url` | ~10 | Low-medium |
| 9 | `ad_media.public_url` | ~10-30 | Medium; also update `storage_path` |
| 10 | `ad_campaigns.logo_url` | ~5 | Low |
| 11 | `ad_placeholders.image_url` + `logo_url` | ~10 | Low-medium |
| 12 | `ad_slot_creatives.image_url` | ~10 | Low-medium |
| 13 | `tracked_links.qr_storage_path` | ~10-50 | SVGs |
| 14 | `blog_translations.seo_extras` (jsonb) | ~5 | JSON field, needs `jsonb_set` |

**MDX content migration (highest risk):**
- Scan `blog_translations.content_mdx` for `supabase.co/storage/v1/object/(sign|public)/` URLs
- For signed URLs: extract storage path from URL, download via service-role client (bypasses expiry)
- Upload each to Blob, build old→new URL mapping
- Replace all occurrences in `content_mdx`
- Set `content_compiled = NULL` to force runtime recompilation (safer than fixing compiled output)
- Same for `newsletter_editions.content_mdx` and `content_html`

**Idempotent:** Skip rows already on Blob. Content-hash dedup prevents duplicate Blob uploads. Safe to re-run.

**Rollback:** Migration journal JSON maps `{table, column, row_id, old_url, new_url}`. Reversal script reads this and restores old URLs.

### 6.4 Phase 3: Cleanup (1 day, after 2-week soak)

1. **Verify zero Supabase public URLs remain:**
   ```sql
   SELECT count(*) FROM authors WHERE avatar_url LIKE '%supabase.co%';
   -- repeat for all 18 columns + MDX content
   ```
2. Remove Supabase from `next.config.ts` `remotePatterns` and CSP `img-src` (keep for `connect-src` — DB/Auth still uses Supabase)
3. Drop public Supabase buckets: `author-avatars`, `newsletter-assets`, `link-assets`, `media`
4. **Keep:** `campaign-files` (private PDFs), `lgpd-exports` (private LGPD), `content-files` (legacy, eventual drop)
5. Remove storage RLS policies for dropped buckets

### 6.5 identity/thiago.jpg

First asset uploaded via gallery → `folder=authors`, `tag=identity`. Blob URL replaces hardcoded `IDENTITY_PROFILES.imageUrl` in `lib/seo/identity-profiles.ts`. Resolves current author photo not appearing bug on newsletter landing pages.

### 6.6 Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Expired signed URLs in blog MDX | **HIGH** — images already broken | Phase 2 MDX migration fixes retroactively via service-role download |
| MDX `content_compiled` has stale URLs | MEDIUM | Set `content_compiled = NULL` post-migration → force recompile |
| Vercel Blob outage during migration | LOW | Old Supabase URLs still work; dual-write phase has both |
| Rate limits on Blob `put()` | LOW | Small asset count (<500); batch with concurrency 5, 100ms delay |
| MDX regex replaces wrong content | MEDIUM | `--dry-run` first, log every replacement, manual review |

## 7. Operations & Monitoring

### 7.1 Orphan Cleanup Cron

Route: `/api/cron/media-cleanup`
Schedule: `0 3 * * 0` (Sunday 03:00 UTC)
Auth: `Bearer ${CRON_SECRET}` (same pattern as all 17 existing cron routes)
Lock: `cron:media-cleanup` via `withCronLock`

**Two-pass cleanup:**
- **Pass 1 — soft-delete:** Find `media_assets` where `id NOT IN (SELECT asset_id FROM media_asset_usage)` AND `deleted_at IS NULL` AND `created_at < now() - interval '7 days'` (grace period). `UPDATE SET deleted_at = now()`.
- **Pass 2 — hard-delete:** Find `media_assets` where `deleted_at < now() - interval '30 days'`. For each: Blob `del(blobUrl)`, then `DELETE FROM media_assets`. Batch of 50 per run to avoid Vercel 300s timeout.

Structured logging via `logCron`. Sentry on Blob deletion failures: `{ media: 'true', component: 'media-cleanup' }`.

### 7.2 Health Endpoint

Route: `GET /api/health/media`
Auth: `Bearer ${CRON_SECRET}` (same pattern as `/api/health/seo`)

```typescript
{
  ok: true,
  siteId: string,
  totalAssets: number,
  totalSizeMb: number,
  orphanCount: number,
  softDeletedCount: number,
  folderBreakdown: Record<string, { count: number, sizeBytes: number }>,
  quotaUsedPct: number,       // totalSizeBytes / MEDIA_QUOTA_BYTES * 100
  flags: {
    galleryEnabled: boolean,
    blobUploadEnabled: boolean,
    migrationEnabled: boolean,
  }
}
```

### 7.3 Smoke Test

Script: `scripts/media-smoke.sh $HOST` (5 checks):

1. Health endpoint returns `ok: true`
2. Sample Blob URL returns 200 + correct Content-Type
3. Gallery API returns valid JSON
4. CSP includes `blob.vercel-storage.com`
5. `next/image` serves optimized format (Accept: image/webp → webp response)

### 7.4 Cache Invalidation

Tag taxonomy (extends existing `revalidateTag` pattern):

| Tag | Invalidates | Set by |
|-----|-------------|--------|
| `media:asset:{assetId}` | Single asset fetch | `updateMediaAsset`, `deleteMediaAsset` |
| `media:gallery:{siteId}` | Gallery listing query | Any upload/update/delete for that site |
| `media:stats:{siteId}` | Health endpoint stats | Any upload/delete |

Vercel Blob URLs are permanent and immutable — `Cache-Control: public, max-age=31536000, immutable` set automatically by Vercel. No `?v=Date.now()` cache busting needed.

## 8. Security

### 8.1 EXIF Stripping

ALL uploaded JPEG/PNG/WebP pass through `sharp` before Blob upload. Strips GPS coordinates, camera serial numbers, timestamps, owner names — all PII under LGPD Art. 5 I. This is NOT optional.

### 8.2 SVG Sanitization

Strip `<script>`, `<foreignObject>`, `on*` event handlers, `javascript:` hrefs, `data:` URIs in href/src. SVGs are an XSS vector — sanitization applied before upload.

### 8.3 CSP Updates

```diff
- img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://yt3.ggpht.com
+ img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://yt3.ggpht.com https://*.public.blob.vercel-storage.com
```

Also add to `connect-src` for client-side Blob upload token exchange:
```diff
+ https://*.public.blob.vercel-storage.com
```

Also add to `next.config.ts` `images.remotePatterns`:
```typescript
{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }
```

### 8.4 Access Control

| Action | Guard | Notes |
|--------|-------|-------|
| Browse gallery | `can_view_site(site_id)` | reporters can see but not upload |
| Upload / update / crop | `can_edit_site(site_id)` | editors + org_admin + super_admin |
| Soft delete | `can_edit_site(site_id)` | same as upload |
| Hard delete | Cron only (service role) | not exposed in UI |
| View in public pages | `site_visible(site_id)` RLS | same as all public content |

Server actions call `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` before any mutation — identical to existing upload functions.

### 8.5 File Validation

| Check | Limit | Configurable? |
|-------|-------|---------------|
| MIME whitelist | jpeg, png, webp, gif, svg+xml | No (security) |
| Max file size | 5MB default, per-folder overrides | `MEDIA_MAX_FILE_SIZE_BYTES` env |
| Max dimensions | 8192×8192 | No (memory safety) |
| Min dimensions | 10×10 | No |
| Filename | Strip `../`, kebab-case, max 200 chars | No |

## 9. LGPD Compliance

### 9.1 Data Export

`collectUserData()` in `BythiagoLgpdDomainAdapter` (`lib/lgpd/domain-adapter.ts`) includes `media_assets` uploaded by the user:

```typescript
media_assets_uploaded: mediaAssets.map(a => ({
  id: a.id,
  filename: a.filename,
  folder: a.folder,
  mime_type: a.mime_type,
  file_size: a.file_size,
  created_at: a.created_at,
  blob_url: a.blob_url,    // public URLs, not PII
  alt_text: a.alt_text,
}))
```

### 9.2 Account Deletion

Phase 1: `UPDATE media_assets SET uploaded_by = NULL WHERE uploaded_by = p_user_id` — keep assets (may be in published content), sever PII link (who uploaded). Follows same pattern as `audit_log.actor_user_id` nullification.

Phase 3: FK `ON DELETE SET NULL` handles automatically when `auth.admin.deleteUser` runs.

### 9.3 Data Minimization

EXIF stripping at upload enforces LGPD Art. 6 (data minimization) at the cheapest enforcement point. GPS coordinates, camera serial numbers, and owner names are stripped before the image reaches Vercel Blob.

## 10. Responsive Images

`next/image` with `sizes` prop per context:

| Context | `sizes` prop | Output |
|---------|-------------|--------|
| Blog cover | `(max-width: 768px) 100vw, 1200px` | Responsive srcSet |
| Gallery thumbnails | `150px` | Fixed small |
| Author avatar | `80px` | Fixed small |
| OG images | N/A (static 1200×630) | No srcSet needed |

Vercel auto-generates WebP/AVIF + resize on-the-fly via the Image Optimization API (included in Pro plan).

## 11. Feature Flags

| Flag | Scope | Default | Purpose |
|------|-------|---------|---------|
| `NEXT_PUBLIC_MEDIA_GALLERY_ENABLED` | Client+Server | `'false'` | Gallery UI in CMS. When false, existing upload fields work as before. |
| `MEDIA_BLOB_UPLOAD_ENABLED` | Server only | `'false'` | New uploads go to Blob vs legacy Supabase. Separates storage migration from UI rollout. |
| `MEDIA_MIGRATION_ENABLED` | Server only | `'false'` | Backfill migration script toggle. Only enable during planned migration windows. |

**Rollout sequence:**
1. Deploy with all `false` → zero behavior change
2. Flip `MEDIA_BLOB_UPLOAD_ENABLED=true` → new uploads go to Blob, old URLs still work
3. Flip `NEXT_PUBLIC_MEDIA_GALLERY_ENABLED=true` → gallery UI appears in CMS
4. Run migration with `MEDIA_MIGRATION_ENABLED=true` → backfill old assets
5. After migration verified, remove Supabase public bucket references from CSP/remotePatterns

## 12. Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `BLOB_READ_WRITE_TOKEN` | Yes (prod+preview) | auto-provisioned by Vercel | Vercel Blob API token |
| `MEDIA_MAX_FILE_SIZE_BYTES` | No | `5242880` (5MB) | Max upload size |
| `MEDIA_QUOTA_BYTES` | No | `4294967296` (4GB) | Storage quota for health monitoring |

## 13. Dependencies

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `@vercel/blob` | Blob upload/delete API | ~15KB |
| `sharp` | EXIF stripping + dimension detection | Native on Vercel runtime; ~1.5MB for local dev (platform-specific binary) |
| `react-image-crop@11` | Crop UI in gallery | ~8KB gzip, no dependencies |

`next.config.ts` changes:
- `serverExternalPackages: ['@aws-sdk/client-sesv2', 'sharp']`
- `images.remotePatterns` += `{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }`

## 14. Sentry Tag Conventions

All media exceptions tagged: `media: 'true'` + `component`:

| `component` value | Source |
|-------------------|--------|
| `media-upload` | Upload pipeline errors (validation, sharp, Blob put, DB insert) |
| `media-gallery` | Gallery UI server action errors |
| `media-cleanup` | Orphan detection cron |
| `media-migration` | Backfill migration script |
| `media-health` | Health endpoint errors |

Filter in Sentry: `media:true component:media-upload last:24h`

## 15. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| Upload pipeline | Vitest unit | Validation rules, hash computation, EXIF stripping (with fixture images), dedup logic, SVG sanitization |
| Server actions | Vitest + mock Blob | `uploadMediaAsset` integration (mock `@vercel/blob` `put()`), `softDeleteMediaAsset`, usage tracking |
| Gallery UI | Vitest + Testing Library | Modal open/close, tab switching, search, folder filter, crop preset enforcement, alt text required validation |
| Gallery integration | Playwright E2E | Upload flow end-to-end, library browse + select, cover image via gallery |
| Migration script | Vitest integration (DB-gated) | Dry-run mode, URL rewrite, MDX content replacement, idempotency |
| Cron cleanup | Vitest integration (DB-gated) | Orphan detection, soft→hard delete lifecycle |
| Health endpoint | Vitest | Response shape, auth guard |

**Fixture images** in `test/fixtures/media/`:
- `valid.jpg` (with EXIF GPS data for strip testing)
- `valid.png`
- `valid.webp`
- `too-large.jpg` (6MB, exceeds limit)
- `xss.svg` (with `<script>` tag for sanitization testing)
- `tiny.gif` (5×5, below minimum)

## 16. Timeline

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Dual-write foundation | 2-3 days | Low (additive, no breaking changes) |
| Phase 2: Backfill migration | 1 day script + 2 weeks soak | Medium (MDX URL rewrite is highest risk) |
| Phase 3: Cleanup | 1 day | Low (only after full verification) |

## 17. Non-Goals

- ❌ Video upload support — out of scope for this sprint.
- ❌ Batch rename/retag UI — nice-to-have, not MVP.
- ❌ Image CDN purge API — Vercel Blob URLs are immutable, edge cache resolved by content-hash paths.
- ❌ Client-side direct-to-Blob upload — all uploads route through server actions for validation and EXIF stripping.
- ❌ `@tn-figueiredo/media` package extraction — single consumer for now; extract when second consumer appears.

## 18. Open Decisions

None — all decisions resolved during design.
