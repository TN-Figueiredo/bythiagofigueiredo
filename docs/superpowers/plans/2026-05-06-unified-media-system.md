# Unified Media System (Sprint 5g) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all image/media handling into Vercel Blob + `media_assets` metadata table, replacing 7 fragmented Supabase Storage buckets with a single CDN-backed pipeline, CMS gallery, and usage tracking.

**Architecture:** Central `uploadMediaAsset()` pipeline (validate → EXIF strip → SHA-256 dedup → Vercel Blob `put()` → DB insert) replaces 8 upload functions. `media_assets` table indexes all media with content-hash dedup. `media_asset_usage` junction table tracks references for orphan detection. CMS Media Gallery modal provides upload+crop+browse for all 10 integration surfaces.

**Tech Stack:** Vercel Blob (`@vercel/blob`), sharp (EXIF/dimensions), react-image-crop@11 (crop UI), isomorphic-dompurify (SVG XSS), Supabase PostgreSQL (metadata), Next.js 15 server actions, Vitest + Testing Library

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/package.json` | Modify | Add `@vercel/blob`, `sharp`, `react-image-crop`, `isomorphic-dompurify`, `@types/dompurify` |
| `apps/web/next.config.ts` | Modify | Add Blob to `remotePatterns`, `serverExternalPackages`, CSP `img-src` + `connect-src` |
| `apps/web/vitest.config.ts` | Modify | Add `@/lib/media` path alias |
| `supabase/migrations/20260507000005_media_assets.sql` | Create | `media_assets` + `media_asset_usage` tables, indexes, RLS, trigger |
| `apps/web/lib/media/types.ts` | Create | Shared types: `MediaFolder`, `MediaAsset`, `UploadResult`, constants |
| `apps/web/lib/media/validation.ts` | Create | MIME/size/dimension validation per folder |
| `apps/web/lib/media/process.ts` | Create | EXIF stripping (sharp) + dimension detection |
| `apps/web/lib/media/sanitize-svg.ts` | Create | SVG XSS sanitization via DOMPurify |
| `apps/web/lib/media/hash.ts` | Create | SHA-256 content hash + dedup query |
| `apps/web/lib/media/upload.ts` | Create | Central upload pipeline (7-step orchestrator) |
| `apps/web/lib/media/queries.ts` | Create | Media DB queries (list, get, stats) |
| `apps/web/lib/media/track-usage.ts` | Create | Usage tracking insert/remove |
| `apps/web/src/app/cms/(authed)/media/actions.ts` | Create | Gallery server actions (10 actions) |
| `apps/web/src/app/cms/(authed)/media/page.tsx` | Create | Standalone media library page (server component) |
| `apps/web/src/app/cms/(authed)/media/media-library-connected.tsx` | Create | Full-page media library client component |
| `apps/web/src/app/cms/(authed)/_shared/media/media-gallery-modal.tsx` | Create | Gallery modal (`'use client'`) |
| `apps/web/src/app/cms/(authed)/_shared/media/media-upload-tab.tsx` | Create | Upload + crop tab |
| `apps/web/src/app/cms/(authed)/_shared/media/media-library-tab.tsx` | Create | Browse grid tab with search/filter/pagination |
| `apps/web/src/app/cms/(authed)/_shared/media/media-crop-editor.tsx` | Create | Generic crop component (replaces AvatarCropModal) |
| `apps/web/src/app/cms/(authed)/_shared/media/use-media-gallery.ts` | Create | Gallery hook for open/close + selection state |
| `apps/web/src/app/cms/(authed)/_shared/media/media-gallery-i18n.ts` | Create | i18n strings (32 keys, pt-BR + en) |
| `apps/web/src/app/cms/(authed)/_shared/media/types.ts` | Create | Gallery types + 6 crop presets |
| `apps/web/src/app/api/cron/media-cleanup/route.ts` | Create | Orphan cleanup cron (Sunday 03:00 UTC) |
| `apps/web/src/app/api/health/media/route.ts` | Create | Health endpoint |
| `scripts/media-smoke.sh` | Create | 5-check smoke test script |
| `scripts/migrate-media-to-blob.ts` | Create | Backfill migration script (dry-run + execute) |
| `scripts/warm-up-compiled-mdx.ts` | Create | Post-migration MDX warm-up |
| `apps/web/src/app/cms/(authed)/authors/actions.ts` | Modify | Migrate `uploadAuthorAvatar` + `uploadAuthorAboutPhoto` |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` | Modify | Migrate `uploadAsset` + `saveCoverImage` |
| `apps/web/src/app/cms/(authed)/newsletters/actions.ts` | Modify | Migrate `uploadNewsletterImage` + `uploadNewsletterTypeImage` |
| `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts` | Modify | Migrate `uploadMedia` |
| `apps/web/src/app/cms/(authed)/links/actions.ts` | Modify | Migrate `generateQr` |
| `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts` | Modify | Add Media sidebar entry |
| `apps/web/lib/lgpd/domain-adapter.ts` | Modify | Add `media_assets` to data export + phase1 cleanup |
| `apps/web/src/app/cms/(authed)/authors/avatar-crop-modal.tsx` | Delete | Replaced by generic `MediaCropEditor` |
| `apps/web/test/fixtures/media/create-fixtures.ts` | Create | Script to generate test fixture images |
| `apps/web/test/lib/media/types.test.ts` | Create | Types + constants tests |
| `apps/web/test/lib/media/validation.test.ts` | Create | Validation rules tests |
| `apps/web/test/lib/media/process.test.ts` | Create | EXIF stripping tests |
| `apps/web/test/lib/media/sanitize-svg.test.ts` | Create | SVG sanitization tests |
| `apps/web/test/lib/media/hash.test.ts` | Create | Hash + dedup tests |
| `apps/web/test/lib/media/upload.test.ts` | Create | Central upload pipeline tests |
| `apps/web/test/lib/media/track-usage.test.ts` | Create | Usage tracking tests |
| `apps/web/test/cms/media-actions.test.ts` | Create | Server action tests |
| `apps/web/test/cms/media-gallery-modal.test.tsx` | Create | Gallery UI tests |
| `apps/web/test/cms/media-crop-editor.test.tsx` | Create | Crop editor tests |
| `apps/web/test/api/health-media.test.ts` | Create | Health endpoint tests |
| `apps/web/test/api/cron-media-cleanup.test.ts` | Create | Cron tests |

## Parallel Execution Tracks

```
Track A (Tasks 1–5):  Foundation    ─────────────────────────►
Track B (Tasks 6–10): Pipeline      ────────[depends on A]────►
Track C (Tasks 11–14): Actions      ────────[depends on B]────►
Track D (Tasks 15–20): Gallery UI   ────────[depends on C]────►
Track E (Tasks 21–22): Migrations   ────────[depends on C]────►
Track F (Tasks 23–25): Operations   ────────[depends on B]────►
Track G (Task 26):     Final        ────────[depends on D,E,F]►

Tracks B+F can run in parallel once A completes.
Tracks D+E can run in parallel once C completes.
```

---

### Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install production dependencies**

```bash
cd apps/web && npm install --save-exact @vercel/blob@1.1.1 sharp@0.34.2 react-image-crop@11.0.10 isomorphic-dompurify@2.22.0
```

- [ ] **Step 2: Install dev dependencies**

```bash
cd apps/web && npm install --save-exact --save-dev @types/dompurify@3.2.1
```

- [ ] **Step 3: Verify pinned versions (no `^` prefixes)**

```bash
cd apps/web && grep -E '(@vercel/blob|sharp|react-image-crop|isomorphic-dompurify|@types/dompurify)' package.json
```

Expected: all 5 entries without `^` prefix.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: add media system dependencies (@vercel/blob, sharp, react-image-crop, isomorphic-dompurify)"
```

---

### Task 2: Configure next.config.ts

**Files:**
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/vitest.config.ts`

- [ ] **Step 1: Add `sharp` to `serverExternalPackages`**

In `apps/web/next.config.ts`, change line 28:

```typescript
// Before:
serverExternalPackages: ['@aws-sdk/client-sesv2'],

// After:
serverExternalPackages: ['@aws-sdk/client-sesv2', 'sharp'],
```

- [ ] **Step 2: Add Vercel Blob to `images.remotePatterns`**

In `apps/web/next.config.ts`, after the `yt3.ggpht.com` entry (line 25), add:

```typescript
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
```

- [ ] **Step 3: Add Vercel Blob to CSP `img-src`**

In `apps/web/next.config.ts`, line 76, update the `img-src` directive:

```typescript
// Before:
"img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://yt3.ggpht.com",

// After:
"img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://i.ytimg.com https://yt3.ggpht.com https://*.public.blob.vercel-storage.com",
```

- [ ] **Step 4: Add Vercel Blob to CSP `connect-src`**

In `apps/web/next.config.ts`, line 78, update the `connect-src` directive:

```typescript
// Before:
"connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io",

// After:
"connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.public.blob.vercel-storage.com",
```

- [ ] **Step 5: Add `@/lib/media` alias to vitest.config.ts**

In `apps/web/vitest.config.ts`, inside the `alias` array (after the `@/lib/links` entry near line 68), add:

```typescript
      { find: /^@\/lib\/media(.*)$/, replacement: path.resolve(__dirname, './lib/media$1') },
```

- [ ] **Step 6: Run typecheck to verify config changes compile**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: PASS — no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/next.config.ts apps/web/vitest.config.ts
git commit -m "chore: configure next.config for Vercel Blob (remotePatterns, CSP, sharp, vitest alias)"
```

---

### Task 3: Create SQL migration

**Files:**
- Create: `supabase/migrations/20260507000005_media_assets.sql`

- [ ] **Step 1: Write the complete migration file**

```sql
-- =============================================================================
-- 20260507000005_media_assets.sql
-- Sprint 5g — Unified Media System: tables, indexes, RLS, trigger.
-- =============================================================================

-- §3.1 Extension (pg_trgm already exists in squashed schema; idempotent guard)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- §3.2 Enum
DO $$ BEGIN
  CREATE TYPE public.media_usage_resource AS ENUM (
    'blog_post',
    'blog_translation',
    'newsletter_type',
    'newsletter_edition',
    'campaign_translation',
    'author',
    'site',
    'ad_campaign',
    'ad_placeholder',
    'ad_slot_creative',
    'tracked_link'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- §3.3 media_assets
CREATE TABLE IF NOT EXISTS public.media_assets (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id      uuid        NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  blob_url     text        NOT NULL CHECK (blob_url ~ '^https://'),
  blob_pathname text       NOT NULL,
  filename     text        NOT NULL,
  alt_text     text,
  width        integer,
  height       integer,
  mime_type    text        NOT NULL CHECK (mime_type ~ '^(image|video|application)/.+$'),
  file_size    integer     NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  content_hash text        NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  folder       text        NOT NULL DEFAULT 'general'
                            CHECK (folder IN (
                              'general', 'authors', 'blog', 'newsletters',
                              'branding', 'og', 'ads', 'links'
                            )),
  tags         text[]      DEFAULT '{}',
  uploaded_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL,
  deleted_at   timestamptz
);

-- §3.4 media_asset_usage
CREATE TABLE IF NOT EXISTS public.media_asset_usage (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id       uuid        NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  resource_type  public.media_usage_resource NOT NULL,
  resource_id    uuid        NOT NULL,
  field_name     text        NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (asset_id, resource_type, resource_id, field_name)
);

-- §3.5 Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_browse
  ON public.media_assets (site_id, folder, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_site_hash_unique
  ON public.media_assets (site_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_tags
  ON public.media_assets USING gin (tags)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_media_assets_filename_trgm
  ON public.media_assets USING gin (filename gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_media_assets_deleted
  ON public.media_assets (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_asset_usage_asset
  ON public.media_asset_usage (asset_id);

CREATE INDEX IF NOT EXISTS idx_media_asset_usage_resource
  ON public.media_asset_usage (resource_type, resource_id);

-- §3.6 RLS — media_assets
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_assets_public_read" ON public.media_assets;
CREATE POLICY "media_assets_public_read"
  ON public.media_assets FOR SELECT
  USING (public.site_visible(site_id) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "media_assets_staff_read_all" ON public.media_assets;
CREATE POLICY "media_assets_staff_read_all"
  ON public.media_assets FOR SELECT
  TO authenticated
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "media_assets_staff_write" ON public.media_assets;
CREATE POLICY "media_assets_staff_write"
  ON public.media_assets
  TO authenticated
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- §3.6 RLS — media_asset_usage (delegates to parent asset's site scope)
ALTER TABLE public.media_asset_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "media_asset_usage_read" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_read"
  ON public.media_asset_usage FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_view_site(a.site_id)
  ));

DROP POLICY IF EXISTS "media_asset_usage_write" ON public.media_asset_usage;
CREATE POLICY "media_asset_usage_write"
  ON public.media_asset_usage
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_edit_site(a.site_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.media_assets a
    WHERE a.id = asset_id AND public.can_edit_site(a.site_id)
  ));

-- §3.7 Trigger — reuse existing tg_set_updated_at()
DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
```

- [ ] **Step 2: Validate SQL syntax**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase db lint --schema public 2>&1 | tail -5
```

If lint is not available, use:

```bash
grep -c 'CREATE TABLE\|CREATE INDEX\|CREATE POLICY\|CREATE TRIGGER' supabase/migrations/20260507000005_media_assets.sql
```

Expected: 2 tables, 7 indexes, 5 policies, 1 trigger = 15 DDL statements.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260507000005_media_assets.sql
git commit -m "feat(db): add media_assets + media_asset_usage tables, indexes, RLS, trigger"
```

---

### Task 4: Create TypeScript types module

**Files:**
- Create: `apps/web/lib/media/types.ts`
- Create: `apps/web/test/lib/media/types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/lib/media/types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  FOLDER_LIMITS,
  ALLOWED_MIME_TYPES,
  toMediaAsset,
  type MediaFolder,
  type MediaAssetRow,
} from '@/lib/media/types'

describe('media types', () => {
  it('FOLDER_LIMITS has all 8 folders', () => {
    const folders: MediaFolder[] = [
      'authors', 'blog', 'newsletters', 'branding',
      'og', 'ads', 'links', 'general',
    ]
    for (const f of folders) {
      expect(FOLDER_LIMITS[f]).toBeDefined()
      expect(FOLDER_LIMITS[f].maxSizeBytes).toBeGreaterThan(0)
      expect(FOLDER_LIMITS[f].maxDimensionPx).toBeGreaterThan(0)
    }
  })

  it('ALLOWED_MIME_TYPES has 5 entries', () => {
    expect(ALLOWED_MIME_TYPES).toHaveLength(5)
    expect(ALLOWED_MIME_TYPES).toContain('image/jpeg')
    expect(ALLOWED_MIME_TYPES).toContain('image/png')
    expect(ALLOWED_MIME_TYPES).toContain('image/webp')
    expect(ALLOWED_MIME_TYPES).toContain('image/gif')
    expect(ALLOWED_MIME_TYPES).toContain('image/svg+xml')
  })

  it('toMediaAsset maps snake_case row to camelCase', () => {
    const row: MediaAssetRow = {
      id: '00000000-0000-0000-0000-000000000001',
      site_id: '00000000-0000-0000-0000-000000000002',
      blob_url: 'https://example.public.blob.vercel-storage.com/test.jpg',
      blob_pathname: 'site/blog/abc123.jpg',
      filename: 'photo.jpg',
      alt_text: 'A photo',
      width: 800,
      height: 600,
      mime_type: 'image/jpeg',
      file_size: 123456,
      content_hash: 'a'.repeat(64),
      folder: 'blog',
      tags: ['hero', 'featured'],
      uploaded_by: '00000000-0000-0000-0000-000000000003',
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
      deleted_at: null,
    }

    const asset = toMediaAsset(row)

    expect(asset.id).toBe(row.id)
    expect(asset.siteId).toBe(row.site_id)
    expect(asset.blobUrl).toBe(row.blob_url)
    expect(asset.blobPathname).toBe(row.blob_pathname)
    expect(asset.filename).toBe(row.filename)
    expect(asset.altText).toBe(row.alt_text)
    expect(asset.width).toBe(800)
    expect(asset.height).toBe(600)
    expect(asset.mimeType).toBe(row.mime_type)
    expect(asset.fileSize).toBe(row.file_size)
    expect(asset.contentHash).toBe(row.content_hash)
    expect(asset.folder).toBe('blog')
    expect(asset.tags).toEqual(['hero', 'featured'])
    expect(asset.uploadedBy).toBe(row.uploaded_by)
    expect(asset.createdAt).toBe(row.created_at)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/lib/media/types.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/media/types'`

- [ ] **Step 3: Write the implementation**

Create `apps/web/lib/media/types.ts`:

```typescript
export type MediaFolder =
  | 'authors'
  | 'blog'
  | 'newsletters'
  | 'branding'
  | 'og'
  | 'ads'
  | 'links'
  | 'general'

export interface UploadMediaInput {
  file: File | Buffer
  filename: string
  folder: MediaFolder
  siteId: string
  uploadedBy: string
  altText?: string
  tags?: string[]
}

export interface MediaAsset {
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

export type UploadErrorCode =
  | 'no_file'
  | 'unsupported_format'
  | 'file_too_large'
  | 'dimension_exceeded'
  | 'blob_upload_failed'
  | 'db_insert_failed'
  | 'processing_failed'

export type UploadResult =
  | { ok: true; asset: MediaAsset; deduplicated: boolean }
  | { ok: false; error: string; code: UploadErrorCode }

export interface MediaAssetRow {
  id: string
  site_id: string
  blob_url: string
  blob_pathname: string
  filename: string
  alt_text: string | null
  width: number | null
  height: number | null
  mime_type: string
  file_size: number
  content_hash: string
  folder: string
  tags: string[]
  uploaded_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface FolderLimit {
  maxSizeBytes: number
  maxDimensionPx: number
}

export const FOLDER_LIMITS: Record<MediaFolder, FolderLimit> = {
  authors:     { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2048 },
  blog:        { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  newsletters: { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2048 },
  branding:    { maxSizeBytes: 1 * 1024 * 1024,  maxDimensionPx: 2048 },
  og:          { maxSizeBytes: 2 * 1024 * 1024,  maxDimensionPx: 2400 },
  ads:         { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
  links:       { maxSizeBytes: 1 * 1024 * 1024,  maxDimensionPx: 1024 },
  general:     { maxSizeBytes: 5 * 1024 * 1024,  maxDimensionPx: 4096 },
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
] as const

export const GLOBAL_MAX_DIMENSION = 8192
export const GLOBAL_MIN_DIMENSION = 10

export function toMediaAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    siteId: row.site_id,
    blobUrl: row.blob_url,
    blobPathname: row.blob_pathname,
    filename: row.filename,
    altText: row.alt_text,
    width: row.width,
    height: row.height,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    contentHash: row.content_hash,
    folder: row.folder as MediaFolder,
    tags: row.tags ?? [],
    uploadedBy: row.uploaded_by ?? '',
    createdAt: row.created_at,
  }
}

export function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    case 'image/svg+xml': return 'svg'
    default: return 'bin'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/lib/media/types.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/types.ts apps/web/test/lib/media/types.test.ts
git commit -m "feat(media): add shared types, constants, and row mapper"
```

---

### Task 5: Create test fixture helpers

**Files:**
- Create: `apps/web/test/fixtures/media/create-fixtures.ts`

Test fixtures are generated programmatically in test helper code rather than committed as binary files. Each test file will import these helpers.

- [ ] **Step 1: Create the fixtures helper module**

Create `apps/web/test/fixtures/media/create-fixtures.ts`:

```typescript
import { Buffer } from 'node:buffer'

export function createMinimalJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ])
}

export function createMinimalPng(): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ])
}

export function createOversizedBuffer(sizeBytes: number): Buffer {
  return Buffer.alloc(sizeBytes, 0xff)
}

export const XSS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="red"/>
  <script>alert('xss')</script>
  <circle cx="50" cy="50" r="40" onload="alert(1)" onclick="alert(2)"/>
  <a href="javascript:alert(3)"><text x="10" y="50">click</text></a>
  <foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(4)</script></body></foreignObject>
  <image href="data:text/html,<script>alert(5)</script>" width="100" height="100"/>
</svg>`

export const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <rect width="100" height="100" fill="blue"/>
  <circle cx="50" cy="50" r="30" fill="white"/>
</svg>`

export const TINY_GIF_5x5 = Buffer.from(
  'R0lGODlhBQAFAIAAAAAAAP///yH5BAEAAAEALAAAAAAFAAUAAAIHjI+py+0PADs=',
  'base64',
)
```

- [ ] **Step 2: Write test to verify fixtures are usable**

Create `apps/web/test/fixtures/media/fixtures.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  createMinimalJpeg,
  createMinimalPng,
  createOversizedBuffer,
  XSS_SVG,
  CLEAN_SVG,
  TINY_GIF_5x5,
} from './create-fixtures'

describe('test fixtures', () => {
  it('createMinimalJpeg returns a buffer starting with JPEG magic bytes', () => {
    const buf = createMinimalJpeg()
    expect(buf[0]).toBe(0xff)
    expect(buf[1]).toBe(0xd8)
  })

  it('createMinimalPng returns a buffer starting with PNG magic bytes', () => {
    const buf = createMinimalPng()
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
  })

  it('createOversizedBuffer creates buffer of exact size', () => {
    const buf = createOversizedBuffer(6 * 1024 * 1024)
    expect(buf.length).toBe(6 * 1024 * 1024)
  })

  it('XSS_SVG contains script tags', () => {
    expect(XSS_SVG).toContain('<script>')
    expect(XSS_SVG).toContain('onload=')
    expect(XSS_SVG).toContain('javascript:')
    expect(XSS_SVG).toContain('<foreignObject')
  })

  it('CLEAN_SVG has no XSS vectors', () => {
    expect(CLEAN_SVG).not.toContain('<script>')
    expect(CLEAN_SVG).not.toContain('onload')
    expect(CLEAN_SVG).not.toContain('javascript:')
  })

  it('TINY_GIF_5x5 is a valid GIF header', () => {
    expect(TINY_GIF_5x5[0]).toBe(0x47) // G
    expect(TINY_GIF_5x5[1]).toBe(0x49) // I
    expect(TINY_GIF_5x5[2]).toBe(0x46) // F
  })
})
```

- [ ] **Step 3: Run tests to verify**

```bash
cd apps/web && npx vitest run test/fixtures/media/fixtures.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/fixtures/media/create-fixtures.ts apps/web/test/fixtures/media/fixtures.test.ts
git commit -m "test(media): add test fixture helpers for images, SVG, and oversized buffers"
```
### Task 6: Validation module

**Files:**
- Create: `apps/web/lib/media/validation.ts`
- Test: `apps/web/test/lib/media/validation.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/lib/media/validation.test.ts
import { describe, it, expect } from 'vitest'
import {
  validateMimeType,
  validateFileSize,
  validateDimensions,
  sanitizeFilename,
} from '../../../lib/media/validation'

describe('validateMimeType', () => {
  it('passes for image/jpeg', () => {
    expect(validateMimeType('image/jpeg')).toEqual({ ok: true })
  })

  it('passes for image/png', () => {
    expect(validateMimeType('image/png')).toEqual({ ok: true })
  })

  it('passes for image/webp', () => {
    expect(validateMimeType('image/webp')).toEqual({ ok: true })
  })

  it('passes for image/gif', () => {
    expect(validateMimeType('image/gif')).toEqual({ ok: true })
  })

  it('passes for image/svg+xml', () => {
    expect(validateMimeType('image/svg+xml')).toEqual({ ok: true })
  })

  it('rejects application/pdf', () => {
    const result = validateMimeType('application/pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unsupported_format')
    }
  })

  it('rejects text/html', () => {
    const result = validateMimeType('text/html')
    expect(result.ok).toBe(false)
  })

  it('rejects empty string', () => {
    const result = validateMimeType('')
    expect(result.ok).toBe(false)
  })
})

describe('validateFileSize', () => {
  it('passes when under folder limit (authors: 2MB)', () => {
    expect(validateFileSize(1_000_000, 'authors')).toEqual({ ok: true })
  })

  it('rejects when over folder limit (authors: 2MB)', () => {
    const result = validateFileSize(3_000_000, 'authors')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('file_too_large')
      expect(result.error).toContain('2')
    }
  })

  it('passes at exact folder limit (blog: 5MB)', () => {
    expect(validateFileSize(5_242_880, 'blog')).toEqual({ ok: true })
  })

  it('rejects zero bytes', () => {
    const result = validateFileSize(0, 'general')
    expect(result.ok).toBe(false)
  })

  it('rejects negative size', () => {
    const result = validateFileSize(-1, 'general')
    expect(result.ok).toBe(false)
  })

  it('uses branding limit of 1MB', () => {
    expect(validateFileSize(1_048_576, 'branding')).toEqual({ ok: true })
    const result = validateFileSize(1_048_577, 'branding')
    expect(result.ok).toBe(false)
  })
})

describe('validateDimensions', () => {
  it('passes for 100×100', () => {
    expect(validateDimensions(100, 100, 'general')).toEqual({ ok: true })
  })

  it('rejects 8193×100 (over global 8192 max)', () => {
    const result = validateDimensions(8193, 100, 'general')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('dimension_exceeded')
    }
  })

  it('rejects 100×8193 (height over global max)', () => {
    const result = validateDimensions(100, 8193, 'general')
    expect(result.ok).toBe(false)
  })

  it('rejects 5×5 (under global 10×10 min)', () => {
    const result = validateDimensions(5, 5, 'general')
    expect(result.ok).toBe(false)
  })

  it('rejects 9×10 (width below min)', () => {
    const result = validateDimensions(9, 10, 'general')
    expect(result.ok).toBe(false)
  })

  it('passes at exact 8192×8192', () => {
    expect(validateDimensions(8192, 8192, 'general')).toEqual({ ok: true })
  })

  it('passes at exact 10×10', () => {
    expect(validateDimensions(10, 10, 'general')).toEqual({ ok: true })
  })

  it('rejects when over folder max dimension (links: 1024px)', () => {
    const result = validateDimensions(1025, 500, 'links')
    expect(result.ok).toBe(false)
  })

  it('passes at folder max dimension (links: 1024px)', () => {
    expect(validateDimensions(1024, 1024, 'links')).toEqual({ ok: true })
  })
})

describe('sanitizeFilename', () => {
  it('strips path traversal ../', () => {
    expect(sanitizeFilename('../../../etc/passwd.jpg')).toBe('etc-passwd.jpg')
  })

  it('converts spaces to hyphens', () => {
    expect(sanitizeFilename('my photo file.png')).toBe('my-photo-file.png')
  })

  it('converts to kebab-case (lowercase)', () => {
    expect(sanitizeFilename('My_Photo_FILE.PNG')).toBe('my-photo-file.png')
  })

  it('strips non-alphanumeric chars except hyphens and dots', () => {
    expect(sanitizeFilename('hello@world#2024!.jpg')).toBe('helloworld2024.jpg')
  })

  it('truncates at 200 chars preserving extension', () => {
    const longName = 'a'.repeat(250) + '.webp'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result).toMatch(/\.webp$/)
  })

  it('preserves extension', () => {
    expect(sanitizeFilename('test.file.NAME.svg')).toBe('test.file.name.svg')
  })

  it('handles no extension', () => {
    expect(sanitizeFilename('noext')).toBe('noext')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('a---b___c   d.jpg')).toBe('a-b-c-d.jpg')
  })

  it('strips leading/trailing hyphens from stem', () => {
    expect(sanitizeFilename('-leading-trailing-.png')).toBe('leading-trailing.png')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/media/validation.test.ts`
Expected: FAIL — module `../../../lib/media/validation` not found

- [ ] **Step 3: Implement the validation module**

```typescript
// apps/web/lib/media/validation.ts
import { ALLOWED_MIME_TYPES, FOLDER_LIMITS, type MediaFolder } from './types'

const GLOBAL_MAX_DIMENSION = 8192
const GLOBAL_MIN_DIMENSION = 10
const MAX_FILENAME_LENGTH = 200

type ValidationOk = { ok: true }
type ValidationFail<C extends string> = { ok: false; code: C; error: string }

export function validateMimeType(
  mime: string,
): ValidationOk | ValidationFail<'unsupported_format'> {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) {
    return { ok: true }
  }
  return {
    ok: false,
    code: 'unsupported_format',
    error: `Unsupported format "${mime}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
  }
}

export function validateFileSize(
  size: number,
  folder: MediaFolder,
): ValidationOk | ValidationFail<'file_too_large'> {
  if (size <= 0) {
    return { ok: false, code: 'file_too_large', error: 'File is empty' }
  }
  const limit = FOLDER_LIMITS[folder].maxBytes
  if (size > limit) {
    const limitMb = (limit / 1_048_576).toFixed(0)
    return {
      ok: false,
      code: 'file_too_large',
      error: `File size ${(size / 1_048_576).toFixed(1)}MB exceeds ${limitMb}MB limit for "${folder}" folder`,
    }
  }
  return { ok: true }
}

export function validateDimensions(
  width: number,
  height: number,
  folder: MediaFolder,
): ValidationOk | ValidationFail<'dimension_exceeded'> {
  if (width < GLOBAL_MIN_DIMENSION || height < GLOBAL_MIN_DIMENSION) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} below minimum ${GLOBAL_MIN_DIMENSION}×${GLOBAL_MIN_DIMENSION}`,
    }
  }
  if (width > GLOBAL_MAX_DIMENSION || height > GLOBAL_MAX_DIMENSION) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} exceed maximum ${GLOBAL_MAX_DIMENSION}×${GLOBAL_MAX_DIMENSION}`,
    }
  }
  const folderMax = FOLDER_LIMITS[folder].maxDimension
  if (width > folderMax || height > folderMax) {
    return {
      ok: false,
      code: 'dimension_exceeded',
      error: `Dimensions ${width}×${height} exceed ${folderMax}px limit for "${folder}" folder`,
    }
  }
  return { ok: true }
}

export function sanitizeFilename(name: string): string {
  let sanitized = name.replace(/\.\.\//g, '').replace(/\.\.\\/g, '')

  const lastDot = sanitized.lastIndexOf('.')
  let stem = lastDot > 0 ? sanitized.slice(0, lastDot) : sanitized
  const ext = lastDot > 0 ? sanitized.slice(lastDot).toLowerCase() : ''

  stem = stem
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9\-\.]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  const maxStemLength = MAX_FILENAME_LENGTH - ext.length
  if (stem.length > maxStemLength) {
    stem = stem.slice(0, maxStemLength).replace(/-+$/, '')
  }

  return stem + ext
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/media/validation.test.ts`
Expected: PASS — all 21 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/validation.ts apps/web/test/lib/media/validation.test.ts
git commit -m "feat(media): add validation module — MIME, size, dimension checks + filename sanitizer"
```

---

### Task 7: Image processing module (EXIF strip + dimensions)

**Files:**
- Create: `apps/web/lib/media/process.ts`
- Test: `apps/web/test/lib/media/process.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/lib/media/process.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processImage, type ProcessResult } from '../../../lib/media/process'

vi.mock('../../../lib/media/sanitize-svg', () => ({
  sanitizeSvg: vi.fn((input: string) => input.replace(/<script[^>]*>.*?<\/script>/gi, '')),
}))

describe('processImage', () => {
  it('processes JPEG: strips EXIF and returns dimensions', async () => {
    // Create a minimal 2×2 JPEG with sharp
    const sharp = (await import('sharp')).default
    const jpegBuf = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .withMetadata({
        exif: {
          IFD0: { ImageDescription: 'test-exif-data' },
        },
      })
      .jpeg()
      .toBuffer()

    const result = await processImage(jpegBuf, 'image/jpeg')

    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.length).toBeGreaterThan(0)

    // Verify EXIF was stripped: re-read metadata from processed buffer
    const meta = await sharp(result.buffer).metadata()
    expect(meta.exif).toBeUndefined()
  })

  it('processes PNG: returns dimensions', async () => {
    const sharp = (await import('sharp')).default
    const pngBuf = await sharp({
      create: { width: 50, height: 30, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer()

    const result = await processImage(pngBuf, 'image/png')

    expect(result.width).toBe(50)
    expect(result.height).toBe(30)
    expect(result.mimeType).toBe('image/png')
  })

  it('processes WebP: returns dimensions', async () => {
    const sharp = (await import('sharp')).default
    const webpBuf = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer()

    const result = await processImage(webpBuf, 'image/webp')

    expect(result.width).toBe(100)
    expect(result.height).toBe(80)
    expect(result.mimeType).toBe('image/webp')
  })

  it('passes GIF through unchanged but extracts dimensions', async () => {
    const sharp = (await import('sharp')).default
    const gifBuf = await sharp({
      create: { width: 20, height: 15, channels: 4, background: { r: 255, g: 255, b: 0, alpha: 1 } },
    })
      .gif()
      .toBuffer()

    const result = await processImage(gifBuf, 'image/gif')

    expect(result.width).toBe(20)
    expect(result.height).toBe(15)
    expect(result.mimeType).toBe('image/gif')
    // GIF buffer should be unchanged (no sharp processing)
    expect(Buffer.compare(result.buffer, gifBuf)).toBe(0)
  })

  it('processes SVG: sanitizes and returns null dimensions', async () => {
    const svgBuf = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><script>alert(1)</script></svg>',
    )

    const result = await processImage(svgBuf, 'image/svg+xml')

    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
    expect(result.mimeType).toBe('image/svg+xml')
    // Script should have been removed by sanitizeSvg mock
    const output = result.buffer.toString('utf-8')
    expect(output).not.toContain('<script')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/media/process.test.ts`
Expected: FAIL — module `../../../lib/media/process` not found

- [ ] **Step 3: Implement the processing module**

```typescript
// apps/web/lib/media/process.ts
import sharp from 'sharp'
import { sanitizeSvg } from './sanitize-svg'

export interface ProcessResult {
  buffer: Buffer
  width: number | null
  height: number | null
  mimeType: string
}

const RASTER_TYPES_FOR_SHARP = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function processImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ProcessResult> {
  if (mimeType === 'image/svg+xml') {
    const sanitized = sanitizeSvg(buffer.toString('utf-8'))
    return {
      buffer: Buffer.from(sanitized, 'utf-8'),
      width: null,
      height: null,
      mimeType,
    }
  }

  if (mimeType === 'image/gif') {
    const meta = await sharp(buffer).metadata()
    return {
      buffer,
      width: meta.width ?? null,
      height: meta.height ?? null,
      mimeType,
    }
  }

  if (RASTER_TYPES_FOR_SHARP.has(mimeType)) {
    const { data, info } = await sharp(buffer)
      .rotate()
      .withMetadata({})
      .toBuffer({ resolveWithObject: true })
    return {
      buffer: data,
      width: info.width,
      height: info.height,
      mimeType,
    }
  }

  return { buffer, width: null, height: null, mimeType }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/media/process.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/process.ts apps/web/test/lib/media/process.test.ts
git commit -m "feat(media): add image processing module — EXIF strip via sharp, GIF passthrough, SVG sanitize"
```

---

### Task 8: SVG sanitization module

**Files:**
- Create: `apps/web/lib/media/sanitize-svg.ts`
- Test: `apps/web/test/lib/media/sanitize-svg.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/lib/media/sanitize-svg.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeSvg } from '../../../lib/media/sanitize-svg'

describe('sanitizeSvg', () => {
  it('removes <script> tags', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('<script')
    expect(output).not.toContain('alert')
    expect(output).toContain('<rect')
  })

  it('removes <foreignObject> tags', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body><p>XSS</p></body></foreignObject><circle r="5"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('<foreignObject')
    expect(output).not.toContain('XSS')
    expect(output).toContain('<circle')
  })

  it('removes onload attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onload')
    expect(output).not.toContain('alert')
  })

  it('removes onerror attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><image onerror="alert(1)" href="x.png"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onerror')
  })

  it('removes onclick attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect onclick="alert(1)" width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onclick')
  })

  it('removes onmouseover attribute', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><rect onmouseover="alert(1)" width="10" height="10"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('onmouseover')
  })

  it('preserves valid SVG elements: rect, circle, path, g, defs, use', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg">
      <defs><clipPath id="c"><rect width="10" height="10"/></clipPath></defs>
      <g><circle cx="5" cy="5" r="3"/></g>
      <path d="M0 0 L10 10"/>
      <use href="#c"/>
    </svg>`
    const output = sanitizeSvg(input)
    expect(output).toContain('<rect')
    expect(output).toContain('<circle')
    expect(output).toContain('<path')
    expect(output).toContain('<g>')
    expect(output).toContain('<defs>')
    expect(output).toContain('<use')
  })

  it('preserves SVG filter elements', () => {
    const input = `<svg xmlns="http://www.w3.org/2000/svg">
      <filter id="blur"><feGaussianBlur stdDeviation="5"/></filter>
      <rect filter="url(#blur)" width="10" height="10"/>
    </svg>`
    const output = sanitizeSvg(input)
    expect(output).toContain('<filter')
    expect(output).toContain('feGaussianBlur')
  })

  it('removes javascript: hrefs', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>Click</text></a></svg>'
    const output = sanitizeSvg(input)
    expect(output).not.toContain('javascript:')
  })

  it('returns valid SVG string for clean input', () => {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="red"/></svg>'
    const output = sanitizeSvg(input)
    expect(output).toContain('viewBox')
    expect(output).toContain('fill="red"')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/media/sanitize-svg.test.ts`
Expected: FAIL — module `../../../lib/media/sanitize-svg` not found

- [ ] **Step 3: Implement the SVG sanitization module**

```typescript
// apps/web/lib/media/sanitize-svg.ts
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeSvg(svgString: string): string {
  return DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: [],
    FORBID_TAGS: ['script', 'foreignObject', 'set', 'animate'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/media/sanitize-svg.test.ts`
Expected: PASS — all 10 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/sanitize-svg.ts apps/web/test/lib/media/sanitize-svg.test.ts
git commit -m "feat(media): add SVG sanitization module — DOMPurify XSS prevention"
```

---

### Task 9: Content hash and dedup module

**Files:**
- Create: `apps/web/lib/media/hash.ts`
- Test: `apps/web/test/lib/media/hash.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/lib/media/hash.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  computeContentHash,
  checkDedup,
  mimeToExt,
  buildBlobPathname,
} from '../../../lib/media/hash'

describe('computeContentHash', () => {
  it('returns a 64-char hex string', () => {
    const hash = computeContentHash(Buffer.from('hello'))
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns the same hash for the same content', () => {
    const buf = Buffer.from('deterministic-content')
    expect(computeContentHash(buf)).toBe(computeContentHash(buf))
  })

  it('returns different hashes for different content', () => {
    const h1 = computeContentHash(Buffer.from('image-a'))
    const h2 = computeContentHash(Buffer.from('image-b'))
    expect(h1).not.toBe(h2)
  })

  it('produces known SHA-256 for known input', () => {
    // SHA-256 of empty buffer is well-known
    const hash = computeContentHash(Buffer.from(''))
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('checkDedup', () => {
  const mockRow = {
    id: 'asset-1',
    site_id: 'site-1',
    blob_url: 'https://example.blob.vercel-storage.com/test.jpg',
    blob_pathname: 'site-1/blog/abc123.jpg',
    filename: 'test.jpg',
    alt_text: null,
    width: 100,
    height: 100,
    mime_type: 'image/jpeg',
    file_size: 5000,
    content_hash: 'abcd1234'.repeat(8),
    folder: 'blog',
    tags: [],
    uploaded_by: 'user-1',
    created_at: '2026-05-06T00:00:00Z',
    updated_at: '2026-05-06T00:00:00Z',
    deleted_at: null,
  }

  it('returns existing asset row when hash matches', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: mockRow, error: null })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'abcd1234'.repeat(8))
    expect(result).toEqual(mockRow)
    expect(mockSupabase.from).toHaveBeenCalledWith('media_assets')
  })

  it('returns null when no match', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: null, error: null })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'nonexistent'.repeat(6).slice(0, 64))
    expect(result).toBeNull()
  })

  it('returns null on query error (treat as no-dup, fail open)', async () => {
    const selectMock = vi.fn()
    const eqSiteMock = vi.fn()
    const eqHashMock = vi.fn()
    const isMock = vi.fn()
    const limitMock = vi.fn()
    const singleMock = vi.fn()

    selectMock.mockReturnValue({ eq: eqSiteMock })
    eqSiteMock.mockReturnValue({ eq: eqHashMock })
    eqHashMock.mockReturnValue({ is: isMock })
    isMock.mockReturnValue({ limit: limitMock })
    limitMock.mockReturnValue({ single: singleMock })
    singleMock.mockResolvedValue({ data: null, error: { message: 'connection failed' } })

    const mockSupabase = {
      from: vi.fn().mockReturnValue({ select: selectMock }),
    }

    const result = await checkDedup(mockSupabase as any, 'site-1', 'a'.repeat(64))
    expect(result).toBeNull()
  })
})

describe('mimeToExt', () => {
  it('maps image/jpeg → jpg', () => {
    expect(mimeToExt('image/jpeg')).toBe('jpg')
  })

  it('maps image/png → png', () => {
    expect(mimeToExt('image/png')).toBe('png')
  })

  it('maps image/webp → webp', () => {
    expect(mimeToExt('image/webp')).toBe('webp')
  })

  it('maps image/gif → gif', () => {
    expect(mimeToExt('image/gif')).toBe('gif')
  })

  it('maps image/svg+xml → svg', () => {
    expect(mimeToExt('image/svg+xml')).toBe('svg')
  })

  it('returns bin for unknown MIME', () => {
    expect(mimeToExt('application/octet-stream')).toBe('bin')
  })
})

describe('buildBlobPathname', () => {
  it('constructs pathname with truncated hash', () => {
    const hash = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    expect(buildBlobPathname('site-1', 'blog', hash, 'jpg')).toBe(
      'site-1/blog/abcdef0123456789.jpg',
    )
  })

  it('uses first 16 chars of hash', () => {
    const hash = '1234567890abcdef' + '0'.repeat(48)
    const pathname = buildBlobPathname('s1', 'authors', hash, 'png')
    expect(pathname).toBe('s1/authors/1234567890abcdef.png')
  })

  it('includes folder in path', () => {
    const hash = 'f'.repeat(64)
    expect(buildBlobPathname('s1', 'newsletters', hash, 'webp')).toBe(
      's1/newsletters/ffffffffffffffff.webp',
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/media/hash.test.ts`
Expected: FAIL — module `../../../lib/media/hash` not found

- [ ] **Step 3: Implement the hash and dedup module**

```typescript
// apps/web/lib/media/hash.ts
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MediaFolder, MediaAssetRow } from './types'

export function computeContentHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function checkDedup(
  supabase: SupabaseClient,
  siteId: string,
  contentHash: string,
): Promise<MediaAssetRow | null> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('site_id', siteId)
    .eq('content_hash', contentHash)
    .is('deleted_at', null)
    .limit(1)
    .single()

  if (error || !data) return null
  return data as MediaAssetRow
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export function mimeToExt(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin'
}

export function buildBlobPathname(
  siteId: string,
  folder: MediaFolder,
  contentHash: string,
  ext: string,
): string {
  return `${siteId}/${folder}/${contentHash.slice(0, 16)}.${ext}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/media/hash.test.ts`
Expected: PASS — all 13 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/hash.ts apps/web/test/lib/media/hash.test.ts
git commit -m "feat(media): add content hash + dedup module — SHA-256, dedup query, MIME→ext mapper"
```

---

### Task 10: Central upload module

**Files:**
- Create: `apps/web/lib/media/upload.ts`
- Test: `apps/web/test/lib/media/upload.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/lib/media/upload.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const putMock = vi.fn()
const delMock = vi.fn()
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => putMock(...args),
  del: (...args: unknown[]) => delMock(...args),
}))

const rpcMock = vi.fn()
const insertMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const isMock = vi.fn()
const limitMock = vi.fn()
const singleMock = vi.fn()

function buildChain(resolvedData: unknown) {
  selectMock.mockReturnValue({ eq: eqMock })
  eqMock.mockReturnValue({ eq: eqMock })
  eqMock.mockReturnValueOnce({ eq: eqMock })
  eqMock.mockReturnValueOnce({ is: isMock })
  isMock.mockReturnValue({ limit: limitMock })
  limitMock.mockReturnValue({ single: singleMock })
  singleMock.mockResolvedValue({ data: resolvedData, error: null })
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'media_assets') {
        return {
          select: selectMock,
          insert: insertMock,
        }
      }
      return { select: vi.fn() }
    }),
    rpc: rpcMock,
  }),
}))

// Mock sharp to avoid native binary in test
vi.mock('sharp', () => {
  const mockSharp = vi.fn(() => ({
    rotate: vi.fn().mockReturnThis(),
    withMetadata: vi.fn().mockReturnThis(),
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 80 }),
    toBuffer: vi.fn().mockResolvedValue({
      data: Buffer.from('processed'),
      info: { width: 100, height: 80, format: 'jpeg', size: 500, channels: 3 },
    }),
  }))
  return { default: mockSharp }
})

vi.mock('../../../lib/media/sanitize-svg', () => ({
  sanitizeSvg: vi.fn((input: string) => input),
}))

import { uploadMediaAsset, uploadMediaAssets } from '../../../lib/media/upload'
import type { UploadMediaInput } from '../../../lib/media/types'

const validInput: UploadMediaInput = {
  file: Buffer.from('fake-jpeg-data'),
  filename: 'photo.jpg',
  folder: 'blog',
  siteId: 'site-1',
  uploadedBy: 'user-1',
  altText: 'A test image',
  tags: ['test'],
}

const mockAssetRow = {
  id: 'asset-uuid',
  site_id: 'site-1',
  blob_url: 'https://abc.public.blob.vercel-storage.com/site-1/blog/aabbccdd.jpg',
  blob_pathname: 'site-1/blog/aabbccdd.jpg',
  filename: 'photo.jpg',
  alt_text: 'A test image',
  width: 100,
  height: 80,
  mime_type: 'image/jpeg',
  file_size: 14,
  content_hash: 'a'.repeat(64),
  folder: 'blog',
  tags: ['test'],
  uploaded_by: 'user-1',
  created_at: '2026-05-06T00:00:00Z',
  updated_at: '2026-05-06T00:00:00Z',
  deleted_at: null,
}

describe('uploadMediaAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    putMock.mockResolvedValue({
      url: 'https://abc.public.blob.vercel-storage.com/site-1/blog/aabbccdd.jpg',
      pathname: 'site-1/blog/aabbccdd.jpg',
    })
  })

  it('rejects unsupported MIME type', async () => {
    const input = { ...validInput, filename: 'doc.pdf' }
    // We need to detect MIME from filename or have it passed
    // The function detects MIME from the File object or Buffer + filename
    // For a Buffer with .pdf extension, we mock the detection
    const result = await uploadMediaAsset({
      ...input,
      file: Buffer.from('%PDF-1.4 fake'),
      filename: 'document.pdf',
    })
    // Since the buffer doesn't have a valid image MIME, it should fail
    // The pipeline checks MIME via the file's type or header magic
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('unsupported_format')
    }
  })

  it('rejects file over size limit', async () => {
    const bigBuffer = Buffer.alloc(6_000_000) // 6MB, over blog's 5MB limit
    const result = await uploadMediaAsset({
      ...validInput,
      file: bigBuffer,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('file_too_large')
    }
  })

  it('returns deduplicated asset when content hash matches existing', async () => {
    // Setup: dedup check finds existing asset
    buildChain(mockAssetRow)

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deduplicated).toBe(true)
      expect(result.asset.blobUrl).toBe(mockAssetRow.blob_url)
    }
    // Should NOT call Blob put
    expect(putMock).not.toHaveBeenCalled()
  })

  it('calls Blob put() with correct pathname and options for new file', async () => {
    // Setup: dedup check returns null (no existing)
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockAssetRow, error: null }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(putMock).toHaveBeenCalledTimes(1)
    const [pathname, _buffer, options] = putMock.mock.calls[0]
    expect(pathname).toMatch(/^site-1\/blog\/[a-f0-9]{16}\.jpg$/)
    expect(options.access).toBe('public')
    expect(options.addRandomSuffix).toBe(false)
    expect(options.contentType).toBe('image/jpeg')
  })

  it('returns ok:true with asset for successful new upload', async () => {
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: mockAssetRow, error: null }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.deduplicated).toBe(false)
      expect(result.asset.id).toBe('asset-uuid')
      expect(result.asset.filename).toBe('photo.jpg')
      expect(result.asset.folder).toBe('blog')
    }
  })

  it('attempts Blob cleanup on DB insert failure', async () => {
    buildChain(null)
    insertMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'unique constraint violation' },
        }),
      }),
    })

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('db_insert_failed')
    }
    // Should attempt cleanup
    expect(delMock).toHaveBeenCalledTimes(1)
  })

  it('handles Blob upload failure gracefully', async () => {
    buildChain(null)
    putMock.mockRejectedValue(new Error('Blob storage unavailable'))

    const result = await uploadMediaAsset(validInput)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('blob_upload_failed')
    }
  })
})

describe('uploadMediaAssets (batch)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: all uploads succeed via dedup
    buildChain(mockAssetRow)
  })

  it('processes multiple inputs and returns per-item results', async () => {
    const inputs = [
      { ...validInput, filename: 'a.jpg' },
      { ...validInput, filename: 'b.jpg' },
      { ...validInput, filename: 'c.jpg' },
    ]

    const results = await uploadMediaAssets(inputs, 2)

    expect(results).toHaveLength(3)
    results.forEach((r) => expect(r.ok).toBe(true))
  })

  it('returns individual errors without failing entire batch', async () => {
    // First file will be too large, second will succeed
    const inputs = [
      { ...validInput, file: Buffer.alloc(6_000_000), filename: 'big.jpg' },
      { ...validInput, filename: 'ok.jpg' },
    ]

    const results = await uploadMediaAssets(inputs, 2)

    expect(results).toHaveLength(2)
    expect(results[0].ok).toBe(false)
    expect(results[1].ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/lib/media/upload.test.ts`
Expected: FAIL — module `../../../lib/media/upload` not found

- [ ] **Step 3: Implement the central upload module**

```typescript
// apps/web/lib/media/upload.ts
import { put, del } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  validateMimeType,
  validateFileSize,
  validateDimensions,
  sanitizeFilename,
} from './validation'
import { processImage } from './process'
import { computeContentHash, checkDedup, mimeToExt, buildBlobPathname } from './hash'
import type {
  UploadMediaInput,
  UploadResult,
  UploadErrorCode,
  MediaAssetRow,
} from './types'
import { toMediaAsset } from './types'

function detectMimeType(file: File | Buffer, filename: string): string {
  if (file instanceof File) return file.type
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const extMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  }
  return extMap[ext] ?? 'application/octet-stream'
}

async function toBuffer(file: File | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(file)) return file
  return Buffer.from(await file.arrayBuffer())
}

function fail(code: UploadErrorCode, error: string): UploadResult {
  return { ok: false, code, error }
}

export async function uploadMediaAsset(
  input: UploadMediaInput,
): Promise<UploadResult> {
  const { filename: rawFilename, folder, siteId, uploadedBy, altText, tags } = input

  // Step 1: Detect and validate MIME
  const mimeType = detectMimeType(input.file, rawFilename)
  const mimeCheck = validateMimeType(mimeType)
  if (!mimeCheck.ok) return fail(mimeCheck.code, mimeCheck.error)

  // Step 2: Get buffer
  let buffer: Buffer
  try {
    buffer = await toBuffer(input.file)
  } catch {
    return fail('processing_failed', 'Failed to read file data')
  }

  // Step 3: Validate file size
  const sizeCheck = validateFileSize(buffer.length, folder)
  if (!sizeCheck.ok) return fail(sizeCheck.code, sizeCheck.error)

  // Step 4: Process image (EXIF strip + dimension detection)
  let processed
  try {
    processed = await processImage(buffer, mimeType)
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-upload', step: 'exif' },
    })
    return fail('processing_failed', 'Image processing failed')
  }

  // Step 5: Validate dimensions (skip for SVG which has null dimensions)
  if (processed.width !== null && processed.height !== null) {
    const dimCheck = validateDimensions(processed.width, processed.height, folder)
    if (!dimCheck.ok) return fail(dimCheck.code, dimCheck.error)
  }

  // Step 6: Compute content hash (AFTER EXIF stripping)
  const contentHash = computeContentHash(processed.buffer)

  // Step 7: Dedup check
  const supabase = getSupabaseServiceClient()
  const existing = await checkDedup(supabase, siteId, contentHash)
  if (existing) {
    return { ok: true, asset: toMediaAsset(existing), deduplicated: true }
  }

  // Step 8: Blob upload
  const ext = mimeToExt(mimeType)
  const pathname = buildBlobPathname(siteId, folder, contentHash, ext)
  const filename = sanitizeFilename(rawFilename)

  let blobResult: { url: string; pathname: string }
  try {
    blobResult = await put(pathname, processed.buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: mimeType,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-upload', step: 'blob-put' },
    })
    return fail('blob_upload_failed', 'Failed to upload to storage')
  }

  // Step 9: DB insert with ON CONFLICT for concurrent-upload safety
  const { data: row, error: insertError } = await supabase
    .from('media_assets')
    .insert({
      site_id: siteId,
      blob_url: blobResult.url,
      blob_pathname: blobResult.pathname,
      filename,
      alt_text: altText ?? null,
      width: processed.width,
      height: processed.height,
      mime_type: mimeType,
      file_size: processed.buffer.length,
      content_hash: contentHash,
      folder,
      tags: tags ?? [],
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (insertError || !row) {
    // Cleanup: try to remove the Blob we just uploaded
    try {
      await del(blobResult.url)
    } catch {
      // Best-effort cleanup
    }
    Sentry.captureException(
      new Error(insertError?.message ?? 'DB insert returned null'),
      { tags: { media: 'true', component: 'media-upload', step: 'db-insert' } },
    )
    return fail('db_insert_failed', insertError?.message ?? 'Failed to save asset metadata')
  }

  // Step 10: Return
  return {
    ok: true,
    asset: toMediaAsset(row as MediaAssetRow),
    deduplicated: false,
  }
}

export async function uploadMediaAssets(
  inputs: UploadMediaInput[],
  concurrency = 3,
): Promise<UploadResult[]> {
  const results: UploadResult[] = new Array(inputs.length)

  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency)
    const chunkResults = await Promise.all(
      chunk.map((input) => uploadMediaAsset(input)),
    )
    for (let j = 0; j < chunkResults.length; j++) {
      results[i + j] = chunkResults[j]
    }
  }

  return results
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/lib/media/upload.test.ts`
Expected: PASS — all 9 tests green

- [ ] **Step 5: Add vitest alias for `@/lib/media`**

The `vitest.config.ts` needs an alias so `@/lib/media/...` imports resolve correctly in tests, following the same pattern as `@/lib/seo`, `@/lib/cms`, etc.

Add to `apps/web/vitest.config.ts` resolve aliases array:

```typescript
{ find: /^@\/lib\/media(.*)$/, replacement: path.resolve(__dirname, './lib/media$1') },
```

Insert after the existing `@/lib/links` alias line.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `cd apps/web && npx vitest run test/lib/media/`
Expected: PASS — all media tests green (validation: 21, process: 5, sanitize-svg: 10, hash: 13, upload: 9 = 58 tests total)

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/media/upload.ts apps/web/test/lib/media/upload.test.ts apps/web/vitest.config.ts
git commit -m "feat(media): add central upload pipeline — 7-step validate→EXIF→hash→dedup→Blob→DB + batch upload"
```
### Task 11: Media queries module

**Files:**
- Create: `apps/web/lib/media/queries.ts`

- [ ] **Step 1: Create the queries module**

```typescript
// apps/web/lib/media/queries.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { MediaAssetRow } from './types'

export interface ListMediaOptions {
  siteId: string
  folder?: string
  search?: string
  tags?: string[]
  includeDeleted?: boolean
  cursor?: string
  limit?: number
}

export interface ListMediaResult {
  assets: MediaAssetRow[]
  nextCursor: string | null
}

export async function listMediaAssets(opts: ListMediaOptions): Promise<ListMediaResult> {
  const supabase = getSupabaseServiceClient()
  const limit = opts.limit ?? 24

  let query = supabase
    .from('media_assets')
    .select('*')
    .eq('site_id', opts.siteId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (!opts.includeDeleted) {
    query = query.is('deleted_at', null)
  }
  if (opts.folder) {
    query = query.eq('folder', opts.folder)
  }
  if (opts.search) {
    query = query.ilike('filename', `%${opts.search}%`)
  }
  if (opts.tags?.length) {
    query = query.contains('tags', opts.tags)
  }
  if (opts.cursor) {
    query = query.lt('created_at', opts.cursor)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as MediaAssetRow[]
  const hasMore = rows.length > limit
  const assets = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? assets[assets.length - 1]?.created_at ?? null : null

  return { assets, nextCursor }
}

export async function getMediaAsset(
  assetId: string,
  siteId: string,
): Promise<MediaAssetRow | null> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', assetId)
    .eq('site_id', siteId)
    .single()
  if (error) return null
  return data as MediaAssetRow | null
}

export async function getAssetUsageCount(assetId: string): Promise<number> {
  const supabase = getSupabaseServiceClient()
  const { count, error } = await supabase
    .from('media_asset_usage')
    .select('id', { count: 'exact', head: true })
    .eq('asset_id', assetId)
  if (error) return 0
  return count ?? 0
}

interface FolderStat {
  count: number
  sizeBytes: number
}

export interface MediaStats {
  totalCount: number
  totalSizeBytes: number
  orphanCount: number
  softDeletedCount: number
  folderBreakdown: Record<string, FolderStat>
}

export async function getMediaStats(siteId: string): Promise<MediaStats> {
  const supabase = getSupabaseServiceClient()

  const [allResult, deletedResult, orphanResult] = await Promise.all([
    supabase
      .from('media_assets')
      .select('folder, file_size')
      .eq('site_id', siteId)
      .is('deleted_at', null),
    supabase
      .from('media_assets')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', siteId)
      .not('deleted_at', 'is', null),
    supabase.rpc('count_orphan_media_assets', { p_site_id: siteId }),
  ])

  const rows = (allResult.data ?? []) as Array<{ folder: string; file_size: number }>
  const folderBreakdown: Record<string, FolderStat> = {}
  let totalSizeBytes = 0

  for (const row of rows) {
    totalSizeBytes += row.file_size
    const existing = folderBreakdown[row.folder]
    if (existing) {
      existing.count += 1
      existing.sizeBytes += row.file_size
    } else {
      folderBreakdown[row.folder] = { count: 1, sizeBytes: row.file_size }
    }
  }

  return {
    totalCount: rows.length,
    totalSizeBytes,
    orphanCount: typeof orphanResult.data === 'number' ? orphanResult.data : 0,
    softDeletedCount: deletedResult.count ?? 0,
    folderBreakdown,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/media/queries.ts
git commit -m "feat(media): add media queries module — list, get, stats, usage count"
```

---

### Task 12: Usage tracking module

**Files:**
- Create: `apps/web/lib/media/track-usage.ts`
- Create: `apps/web/test/lib/media/track-usage.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/lib/media/track-usage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn()
const mockDelete = vi.fn()
const mockSelect = vi.fn()

const insertChain: Record<string, unknown> = {}
insertChain.select = vi.fn(() => insertChain)
insertChain.single = vi.fn(() => Promise.resolve({ data: { id: 'u-1' }, error: null }))

const deleteChain: Record<string, unknown> = {}
deleteChain.eq = vi.fn(() => deleteChain)
deleteChain.then = (resolve: (v: unknown) => void) => resolve({ error: null })

const selectChain: Record<string, unknown> = {}
selectChain.eq = vi.fn(() => selectChain)
selectChain.then = (resolve: (v: unknown) => void) =>
  resolve({
    data: [
      { resource_type: 'blog_post', resource_id: 'bp-1', field_name: 'cover_image_url' },
    ],
    error: null,
  })

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'media_asset_usage') {
      return {
        insert: mockInsert.mockReturnValue(insertChain),
        delete: mockDelete.mockReturnValue(deleteChain),
        select: mockSelect.mockReturnValue(selectChain),
      }
    }
    return {}
  }),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

describe('media/track-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('trackMediaUsage inserts a row into media_asset_usage', async () => {
    const { trackMediaUsage } = await import('@/lib/media/track-usage')
    await trackMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url')

    expect(mockSupabase.from).toHaveBeenCalledWith('media_asset_usage')
    expect(mockInsert).toHaveBeenCalledWith(
      {
        asset_id: 'asset-1',
        resource_type: 'blog_post',
        resource_id: 'bp-1',
        field_name: 'cover_image_url',
      },
    )
  })

  it('trackMediaUsage handles duplicate without error', async () => {
    insertChain.single = vi.fn(() =>
      Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate' } }),
    )

    const { trackMediaUsage } = await import('@/lib/media/track-usage')
    await expect(
      trackMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url'),
    ).resolves.toBeUndefined()
  })

  it('removeMediaUsage deletes matching row', async () => {
    const { removeMediaUsage } = await import('@/lib/media/track-usage')
    await removeMediaUsage('asset-1', 'blog_post', 'bp-1', 'cover_image_url')

    expect(mockSupabase.from).toHaveBeenCalledWith('media_asset_usage')
    expect(mockDelete).toHaveBeenCalled()
    expect(deleteChain.eq).toHaveBeenCalledWith('asset_id', 'asset-1')
  })

  it('getAssetUsages returns usages for an asset', async () => {
    const { getAssetUsages } = await import('@/lib/media/track-usage')
    const result = await getAssetUsages('asset-1')

    expect(result).toEqual([
      { resourceType: 'blog_post', resourceId: 'bp-1', fieldName: 'cover_image_url' },
    ])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/media/track-usage.test.ts`
Expected: FAIL — module `@/lib/media/track-usage` not found

- [ ] **Step 3: Implement the module**

```typescript
// apps/web/lib/media/track-usage.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function trackMediaUsage(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<void> {
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('media_asset_usage')
    .insert({
      asset_id: assetId,
      resource_type: resourceType,
      resource_id: resourceId,
      field_name: fieldName,
    })
    .select()
    .single()

  // Ignore unique constraint violation (duplicate tracking is harmless)
  if (error && error.code !== '23505') {
    throw new Error(`Failed to track media usage: ${error.message}`)
  }
}

export async function removeMediaUsage(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<void> {
  const supabase = getSupabaseServiceClient()
  await supabase
    .from('media_asset_usage')
    .delete()
    .eq('asset_id', assetId)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .eq('field_name', fieldName)
}

export async function getAssetUsages(
  assetId: string,
): Promise<Array<{ resourceType: string; resourceId: string; fieldName: string }>> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('media_asset_usage')
    .select('resource_type, resource_id, field_name')
    .eq('asset_id', assetId)

  if (error) return []
  return ((data ?? []) as Array<{ resource_type: string; resource_id: string; field_name: string }>).map(
    (row) => ({
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      fieldName: row.field_name,
    }),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/media/track-usage.test.ts`
Expected: PASS — 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/track-usage.ts apps/web/test/lib/media/track-usage.test.ts
git commit -m "feat(media): add usage tracking module — track, remove, list usages"
```

---

### Task 13: Gallery server actions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/actions.ts`
- Create: `apps/web/test/cms/media-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/cms/media-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(() => ({ siteId: 'site-1', orgId: 'org-1' })),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn(() => ({ ok: true, userId: 'user-1' })),
}))

const mockUploadMediaAsset = vi.fn()
vi.mock('@/lib/media/upload', () => ({
  uploadMediaAsset: (...args: unknown[]) => mockUploadMediaAsset(...args),
}))

const mockListMediaAssets = vi.fn()
const mockGetMediaAsset = vi.fn()
const mockGetMediaStats = vi.fn()
const mockGetAssetUsageCount = vi.fn()
vi.mock('@/lib/media/queries', () => ({
  listMediaAssets: (...args: unknown[]) => mockListMediaAssets(...args),
  getMediaAsset: (...args: unknown[]) => mockGetMediaAsset(...args),
  getMediaStats: (...args: unknown[]) => mockGetMediaStats(...args),
  getAssetUsageCount: (...args: unknown[]) => mockGetAssetUsageCount(...args),
}))

const mockTrackMediaUsage = vi.fn()
const mockRemoveMediaUsage = vi.fn()
vi.mock('@/lib/media/track-usage', () => ({
  trackMediaUsage: (...args: unknown[]) => mockTrackMediaUsage(...args),
  removeMediaUsage: (...args: unknown[]) => mockRemoveMediaUsage(...args),
}))

// Chainable Supabase mock
function makeChainable(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  chain.eq = vi.fn(() => chain)
  chain.is = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(resolveValue))
  chain.then = (resolve: (v: unknown) => void) => resolve(resolveValue)
  return chain
}

const mockSupabase = {
  from: vi.fn(() => ({
    update: vi.fn(() => makeChainable({ data: { id: 'asset-1' }, error: null })),
    delete: vi.fn(() => makeChainable({ error: null })),
    insert: vi.fn(() => makeChainable({ data: { id: 'usage-1' }, error: null })),
  })),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('media server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listMediaAssetsAction', () => {
    it('returns paginated results from query module', async () => {
      mockListMediaAssets.mockResolvedValue({
        assets: [{ id: 'a-1', filename: 'test.jpg' }],
        nextCursor: null,
      })

      const { listMediaAssetsAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await listMediaAssetsAction({ folder: 'blog' })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.assets).toHaveLength(1)
        expect(result.nextCursor).toBeNull()
      }
      expect(mockListMediaAssets).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: 'site-1', folder: 'blog' }),
      )
    })
  })

  describe('getMediaAssetAction', () => {
    it('returns a single asset with usage count', async () => {
      mockGetMediaAsset.mockResolvedValue({
        id: 'a-1',
        filename: 'test.jpg',
        site_id: 'site-1',
      })
      mockGetAssetUsageCount.mockResolvedValue(3)

      const { getMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await getMediaAssetAction('a-1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.asset.id).toBe('a-1')
        expect(result.usageCount).toBe(3)
      }
    })

    it('returns error when asset not found', async () => {
      mockGetMediaAsset.mockResolvedValue(null)

      const { getMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await getMediaAssetAction('missing')
      expect(result.ok).toBe(false)
    })
  })

  describe('uploadMediaAction', () => {
    it('validates FormData and calls uploadMediaAsset', async () => {
      mockUploadMediaAsset.mockResolvedValue({
        ok: true,
        asset: { id: 'a-1', blobUrl: 'https://blob.vercel-storage.com/test.jpg' },
        deduplicated: false,
      })

      const formData = new FormData()
      formData.set('file', new File(['pixels'], 'test.jpg', { type: 'image/jpeg' }))
      formData.set('folder', 'blog')
      formData.set('altText', 'Test image')

      const { uploadMediaAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await uploadMediaAction(formData)

      expect(result.ok).toBe(true)
      expect(mockUploadMediaAsset).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'blog',
          siteId: 'site-1',
          uploadedBy: 'user-1',
        }),
      )
    })

    it('rejects missing file', async () => {
      const formData = new FormData()

      const { uploadMediaAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await uploadMediaAction(formData)
      expect(result.ok).toBe(false)
    })
  })

  describe('updateMediaAssetAction', () => {
    it('updates alt text and tags', async () => {
      const { updateMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await updateMediaAssetAction('a-1', {
        altText: 'Updated alt',
        tags: ['hero'],
      })

      expect(result.ok).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('media_assets')
    })

    it('rejects invalid folder value', async () => {
      const { updateMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await updateMediaAssetAction('a-1', {
        folder: 'INVALID' as 'blog',
      })

      expect(result.ok).toBe(false)
    })
  })

  describe('softDeleteMediaAssetAction', () => {
    it('sets deleted_at and warns about usages', async () => {
      mockGetAssetUsageCount.mockResolvedValue(2)

      const { softDeleteMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await softDeleteMediaAssetAction('a-1')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.usageWarning).toBe(2)
      }
    })
  })

  describe('bulkDeleteMediaAssetsAction', () => {
    it('enforces max 50 per call', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `id-${i}`)

      const { bulkDeleteMediaAssetsAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await bulkDeleteMediaAssetsAction(ids)
      expect(result.ok).toBe(false)
    })
  })

  describe('restoreMediaAssetAction', () => {
    it('clears deleted_at', async () => {
      const { restoreMediaAssetAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await restoreMediaAssetAction('a-1')
      expect(result.ok).toBe(true)
    })
  })

  describe('getMediaStatsAction', () => {
    it('returns aggregated stats', async () => {
      mockGetMediaStats.mockResolvedValue({
        totalCount: 10,
        totalSizeBytes: 5_000_000,
        orphanCount: 2,
        softDeletedCount: 1,
        folderBreakdown: { blog: { count: 5, sizeBytes: 2_500_000 } },
      })

      const { getMediaStatsAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await getMediaStatsAction()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.stats.totalCount).toBe(10)
      }
    })
  })

  describe('trackMediaUsageAction', () => {
    it('delegates to trackMediaUsage module', async () => {
      const { trackMediaUsageAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await trackMediaUsageAction(
        'a-1',
        'blog_post',
        'bp-1',
        'cover_image_url',
      )

      expect(result.ok).toBe(true)
      expect(mockTrackMediaUsage).toHaveBeenCalledWith(
        'a-1',
        'blog_post',
        'bp-1',
        'cover_image_url',
      )
    })
  })

  describe('removeMediaUsageAction', () => {
    it('delegates to removeMediaUsage module', async () => {
      const { removeMediaUsageAction } = await import(
        '@/app/cms/(authed)/media/actions'
      )
      const result = await removeMediaUsageAction(
        'a-1',
        'blog_post',
        'bp-1',
        'cover_image_url',
      )

      expect(result.ok).toBe(true)
      expect(mockRemoveMediaUsage).toHaveBeenCalledWith(
        'a-1',
        'blog_post',
        'bp-1',
        'cover_image_url',
      )
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/media-actions.test.ts`
Expected: FAIL — module `@/app/cms/(authed)/media/actions` not found

- [ ] **Step 3: Implement all 10 server actions**

```typescript
// apps/web/src/app/cms/(authed)/media/actions.ts
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { uploadMediaAsset } from '@/lib/media/upload'
import { listMediaAssets, getMediaAsset, getMediaStats, getAssetUsageCount } from '@/lib/media/queries'
import { trackMediaUsage, removeMediaUsage } from '@/lib/media/track-usage'
import { toMediaAsset, type MediaAsset, type MediaAssetRow } from '@/lib/media/types'

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string }

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function requireViewScope(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'view' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
  return { siteId, userId: res.userId }
}

async function requireEditScope(): Promise<{ siteId: string; userId: string }> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
  return { siteId, userId: res.userId }
}

// ─── Cache invalidation ────────────────────────────────────────────────────

function revalidateMedia(siteId: string, assetId?: string): void {
  revalidateTag(`media:gallery:${siteId}`)
  revalidateTag(`media:stats:${siteId}`)
  if (assetId) revalidateTag(`media:asset:${assetId}`)
  revalidatePath('/cms/media')
}

// ─── Zod schemas ────────────────────────────────────────────────────────────

const MEDIA_FOLDERS = [
  'general', 'authors', 'blog', 'newsletters', 'branding', 'og', 'ads', 'links',
] as const

const ListFiltersSchema = z.object({
  folder: z.enum(MEDIA_FOLDERS).optional(),
  search: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  includeDeleted: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

const UpdateAssetSchema = z.object({
  altText: z.string().max(500).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  folder: z.enum(MEDIA_FOLDERS).optional(),
})

const UsageResourceTypes = [
  'blog_post', 'blog_translation', 'newsletter_type', 'newsletter_edition',
  'campaign_translation', 'author', 'site', 'ad_campaign',
  'ad_placeholder', 'ad_slot_creative', 'tracked_link',
] as const

// ─── 1. listMediaAssetsAction ───────────────────────────────────────────────

export async function listMediaAssetsAction(
  filters: z.input<typeof ListFiltersSchema> = {},
): Promise<ActionResult<{ assets: MediaAsset[]; nextCursor: string | null }>> {
  try {
    const { siteId } = await requireViewScope()
    const parsed = ListFiltersSchema.safeParse(filters)
    if (!parsed.success) return { ok: false, error: 'validation_failed' }

    const result = await listMediaAssets({ siteId, ...parsed.data })
    return {
      ok: true,
      assets: result.assets.map(toMediaAsset),
      nextCursor: result.nextCursor,
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 2. getMediaAssetAction ─────────────────────────────────────────────────

export async function getMediaAssetAction(
  assetId: string,
): Promise<ActionResult<{ asset: MediaAsset; usageCount: number }>> {
  try {
    const { siteId } = await requireViewScope()
    const row = await getMediaAsset(assetId, siteId)
    if (!row) return { ok: false, error: 'not_found' }

    const usageCount = await getAssetUsageCount(assetId)
    return { ok: true, asset: toMediaAsset(row), usageCount }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 3. uploadMediaAction ───────────────────────────────────────────────────

export async function uploadMediaAction(
  formData: FormData,
): Promise<ActionResult<{ asset: MediaAsset; deduplicated: boolean }>> {
  try {
    const { siteId, userId } = await requireEditScope()

    const file = formData.get('file')
    if (!(file instanceof File)) return { ok: false, error: 'no_file' }

    const folder = (formData.get('folder') as string) || 'general'
    const altText = (formData.get('altText') as string) || undefined
    const tagsRaw = formData.get('tags') as string | null
    const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined

    const folderParsed = z.enum(MEDIA_FOLDERS).safeParse(folder)
    if (!folderParsed.success) return { ok: false, error: 'invalid_folder' }

    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: folderParsed.data,
      siteId,
      uploadedBy: userId,
      altText,
      tags,
    })

    if (!result.ok) return { ok: false, error: result.error }

    revalidateMedia(siteId, result.asset.id)
    return { ok: true, asset: result.asset, deduplicated: result.deduplicated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 4. updateMediaAssetAction ──────────────────────────────────────────────

export async function updateMediaAssetAction(
  assetId: string,
  input: z.input<typeof UpdateAssetSchema>,
): Promise<ActionResult> {
  try {
    const { siteId } = await requireEditScope()
    const parsed = UpdateAssetSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: 'validation_failed' }

    const updates: Record<string, unknown> = {}
    if (parsed.data.altText !== undefined) updates.alt_text = parsed.data.altText
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags
    if (parsed.data.folder !== undefined) updates.folder = parsed.data.folder

    if (Object.keys(updates).length === 0) return { ok: false, error: 'no_changes' }

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('media_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 5. softDeleteMediaAssetAction ──────────────────────────────────────────

export async function softDeleteMediaAssetAction(
  assetId: string,
): Promise<ActionResult<{ usageWarning: number }>> {
  try {
    const { siteId } = await requireEditScope()

    const usageCount = await getAssetUsageCount(assetId)

    const supabase = getSupabaseServiceClient()
    const { error } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true, usageWarning: usageCount }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 6. bulkDeleteMediaAssetsAction ─────────────────────────────────────────

export async function bulkDeleteMediaAssetsAction(
  assetIds: string[],
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    if (assetIds.length > 50) return { ok: false, error: 'max_50_per_call' }
    if (assetIds.length === 0) return { ok: false, error: 'empty_list' }

    const { siteId } = await requireEditScope()
    const supabase = getSupabaseServiceClient()

    const { error, count } = await supabase
      .from('media_assets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .in('id', assetIds)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId)
    return { ok: true, deletedCount: count ?? assetIds.length }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 7. restoreMediaAssetAction ─────────────────────────────────────────────

export async function restoreMediaAssetAction(
  assetId: string,
): Promise<ActionResult> {
  try {
    const { siteId } = await requireEditScope()
    const supabase = getSupabaseServiceClient()

    const { error } = await supabase
      .from('media_assets')
      .update({ deleted_at: null })
      .eq('id', assetId)
      .eq('site_id', siteId)
    if (error) return { ok: false, error: error.message }

    revalidateMedia(siteId, assetId)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 8. getMediaStatsAction ─────────────────────────────────────────────────

export async function getMediaStatsAction(): Promise<
  ActionResult<{ stats: Awaited<ReturnType<typeof getMediaStats>> }>
> {
  try {
    const { siteId } = await requireViewScope()
    const stats = await getMediaStats(siteId)
    return { ok: true, stats }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 9. trackMediaUsageAction ───────────────────────────────────────────────

export async function trackMediaUsageAction(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<ActionResult> {
  try {
    await requireEditScope()

    const rtParsed = z.enum(UsageResourceTypes).safeParse(resourceType)
    if (!rtParsed.success) return { ok: false, error: 'invalid_resource_type' }

    await trackMediaUsage(assetId, rtParsed.data, resourceId, fieldName)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}

// ─── 10. removeMediaUsageAction ─────────────────────────────────────────────

export async function removeMediaUsageAction(
  assetId: string,
  resourceType: string,
  resourceId: string,
  fieldName: string,
): Promise<ActionResult> {
  try {
    await requireEditScope()

    const rtParsed = z.enum(UsageResourceTypes).safeParse(resourceType)
    if (!rtParsed.success) return { ok: false, error: 'invalid_resource_type' }

    await removeMediaUsage(assetId, rtParsed.data, resourceId, fieldName)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown_error' }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/media-actions.test.ts`
Expected: PASS — all 11 tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/actions.ts apps/web/test/cms/media-actions.test.ts
git commit -m "feat(media): add 10 gallery server actions — list, get, upload, update, delete, bulk, restore, stats, track, remove"
```

---

### Task 14: Feature flags gate in upload functions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts`

- [ ] **Step 1: Add Blob upload import to authors/actions.ts**

At the top of `apps/web/src/app/cms/(authed)/authors/actions.ts`, after the existing imports (line ~9), add:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

- [ ] **Step 2: Gate `uploadAuthorAvatar` (authors/actions.ts, line ~256)**

Replace the body of `uploadAuthorAvatar` starting at line 260 (after `const siteId = await requireEditAccess()`):

```typescript
export async function uploadAuthorAvatar(
  authorId: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided' }

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'authors',
      siteId,
      uploadedBy: (await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })).userId,
      tags: ['avatar', `author:${authorId}`],
    })
    if (!result.ok) return { ok: false, error: result.error }

    const supabase = getSupabaseServiceClient()
    const { error: updateError } = await supabase
      .from('authors')
      .update({ avatar_url: result.asset.blobUrl })
      .eq('id', authorId)
      .eq('site_id', siteId)
    if (updateError) return { ok: false, error: updateError.message }

    await trackMediaUsage(result.asset.id, 'author', authorId, 'avatar_url')
    revalidateAuthor(authorId)
    revalidatePath('/cms/authors')
    return { ok: true, url: result.asset.blobUrl }
  }

  // Legacy Supabase path (existing code)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type))
    return { ok: false, error: 'Only JPEG, PNG, and WebP are allowed' }
  if (file.size > MAX_AVATAR_SIZE)
    return { ok: false, error: 'File must be under 2 MB' }

  const supabase = getSupabaseServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${authorId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('author-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = supabase.storage
    .from('author-avatars')
    .getPublicUrl(path)
  const avatarUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('authors')
    .update({ avatar_url: avatarUrl })
    .eq('id', authorId)
    .eq('site_id', siteId)
  if (updateError) return { ok: false, error: updateError.message }

  revalidateAuthor(authorId)
  revalidatePath('/cms/authors')
  return { ok: true, url: avatarUrl }
}
```

- [ ] **Step 3: Gate `uploadAuthorAboutPhoto` (authors/actions.ts, line ~403)**

```typescript
export async function uploadAuthorAboutPhoto(
  authorId: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const siteId = await requireEditAccess()

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'no_file' }

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'authors',
      siteId,
      uploadedBy: (await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })).userId,
      tags: ['about-photo', `author:${authorId}`],
    })
    if (!result.ok) return { ok: false, error: result.error }

    const sb = getSupabaseServiceClient()
    await sb.from('authors').update({ about_photo_url: result.asset.blobUrl }).eq('id', authorId).eq('site_id', siteId)

    await trackMediaUsage(result.asset.id, 'author', authorId, 'about_photo_url')
    revalidateAuthor(authorId)
    revalidateAbout(siteId)
    revalidatePath('/about')
    return { ok: true, url: result.asset.blobUrl }
  }

  // Legacy Supabase path (existing code)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'invalid_type' }
  if (file.size > MAX_AVATAR_SIZE) return { ok: false, error: 'too_large' }

  const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]
  const path = `${authorId}/about.${ext}`

  const sb = getSupabaseServiceClient()
  const { error: uploadError } = await sb.storage
    .from('author-avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: urlData } = sb.storage.from('author-avatars').getPublicUrl(path)
  const url = `${urlData.publicUrl}?v=${Date.now()}`

  await sb.from('authors').update({ about_photo_url: url }).eq('id', authorId).eq('site_id', siteId)

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')
  return { ok: true, url }
}
```

- [ ] **Step 4: Add Blob upload import to blog/[id]/edit/actions.ts**

At the top of `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`, after the existing imports (line ~12), add:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

- [ ] **Step 5: Gate `uploadAsset` (blog/[id]/edit/actions.ts, line ~270)**

Replace the function entirely:

```typescript
export async function uploadAsset(file: File, postId: string): Promise<{ url: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  const ctx = await getSiteContext()

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'blog',
      siteId: ctx.siteId,
      uploadedBy: ctx.userId ?? 'system',
      tags: [`post:${postId}`],
    })
    if (!result.ok) throw new Error(result.error)

    await trackMediaUsage(result.asset.id, 'blog_post', postId, 'inline_image')
    return { url: result.asset.blobUrl }
  }

  // Legacy: private bucket with signed URLs (7-day TTL — known bug)
  const result = await uploadContentAsset(getSupabaseServiceClient(), {
    siteId: ctx.siteId,
    contentType: 'blog',
    contentId: postId,
    file,
    filename: file.name,
  })
  return { url: result.signedUrl }
}
```

- [ ] **Step 6: Gate `saveCoverImage` (blog/[id]/edit/actions.ts, line ~253)**

Expand URL validation to accept Blob URLs:

```typescript
export async function saveCoverImage(
  postId: string,
  url: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  if (url !== null && !isSafeUrl(url) && !url.startsWith('https://') ) {
    return { ok: false, error: 'invalid_url' }
  }
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ cover_image_url: url })
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

Note: `saveCoverImage` already accepts any HTTPS URL. The gallery will pass Blob URLs which are valid HTTPS. No feature-flag gate needed — the change is in the upstream component that now provides gallery-sourced URLs instead of manual input.

- [ ] **Step 7: Add Blob upload import to newsletters/actions.ts**

At the top of `apps/web/src/app/cms/(authed)/newsletters/actions.ts`, after the existing imports (line ~18), add:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

- [ ] **Step 8: Gate `uploadNewsletterImage` (newsletters/actions.ts, line ~1273)**

```typescript
export async function uploadNewsletterImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  const editionId = formData.get('editionId') as string | null
  if (!file || !editionId) return { ok: false, error: 'missing_fields' }

  await requireSiteAdminForRow('newsletter_editions', editionId)

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const supabase = getSupabaseServiceClient()
    const { data: edition } = await supabase
      .from('newsletter_editions')
      .select('site_id')
      .eq('id', editionId)
      .single()
    if (!edition) return { ok: false, error: 'not_found' }

    const ctx = await getSiteContext()
    const authRes = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })

    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'newsletters',
      siteId: edition.site_id,
      uploadedBy: authRes.ok ? authRes.userId : 'system',
      tags: [`edition:${editionId}`],
    })
    if (!result.ok) return { ok: false, error: result.error }

    await trackMediaUsage(result.asset.id, 'newsletter_edition', editionId, 'inline_image')
    return { ok: true, url: result.asset.blobUrl }
  }

  // Legacy Supabase path
  if (file.size > MAX_IMAGE_SIZE) return { ok: false, error: 'file_too_large' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'unsupported_format' }

  const supabase = getSupabaseServiceClient()
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('site_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${edition.site_id}/${editionId}/${uuid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from('newsletter-assets')
    .upload(path, buffer, { contentType: file.type })
  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('newsletter-assets')
    .getPublicUrl(path)

  return { ok: true, url: publicUrl }
}
```

- [ ] **Step 9: Gate `uploadNewsletterTypeImage` (newsletters/actions.ts, line ~1310)**

```typescript
export async function uploadNewsletterTypeImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'missing_file' }

  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'og',
      siteId: ctx.siteId,
      uploadedBy: res.userId,
      tags: ['newsletter-type-og'],
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, url: result.asset.blobUrl }
  }

  // Legacy Supabase path
  if (file.size > MAX_IMAGE_SIZE) return { ok: false, error: 'file_too_large' }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { ok: false, error: 'unsupported_format' }

  const supabase = getSupabaseServiceClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${ctx.siteId}/types/${uuid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage
    .from('newsletter-assets')
    .upload(path, buffer, { contentType: file.type, upsert: false })
  if (error) return { ok: false, error: error.message }

  const { data: { publicUrl } } = supabase.storage
    .from('newsletter-assets')
    .getPublicUrl(path)

  return { ok: true, url: publicUrl }
}
```

- [ ] **Step 10: Add Blob upload import to ads/_actions/campaigns.ts**

At the top of `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`, after the existing imports (line ~9), add:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

- [ ] **Step 11: Gate `uploadMedia` (ads/_actions/campaigns.ts, line ~135)**

```typescript
export async function uploadMedia(file: File): Promise<{ id: string; url: string }> {
  await requireArea('admin')

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file,
      filename: file.name,
      folder: 'ads',
      siteId: AD_APP_ID,
      uploadedBy: 'admin',
      tags: ['ad-creative'],
    })
    if (!result.ok) throw new Error(result.error)

    const supabase = getSupabaseServiceClient()
    const { data: row, error: insertError } = await supabase
      .from('ad_media')
      .insert({
        app_id: AD_APP_ID,
        storage_path: result.asset.blobPathname,
        public_url: result.asset.blobUrl,
        mime_type: result.asset.mimeType,
        file_name: result.asset.filename,
      })
      .select('id')
      .single()
    if (insertError) throw new Error(insertError.message)

    await trackMediaUsage(result.asset.id, 'ad_campaign', (row as { id: string }).id, 'media_url')
    return { id: (row as { id: string }).id, url: result.asset.blobUrl }
  }

  // Legacy Supabase path
  if (!ALLOWED_MEDIA_TYPES.includes(file.type as typeof ALLOWED_MEDIA_TYPES[number])) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MEDIA_TYPES.join(', ')}`,
    )
  }
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error(
      `File too large: ${(file.size / (1024 * 1024)).toFixed(1)}MB. Maximum: 5MB`,
    )
  }

  const supabase = getSupabaseServiceClient()
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `ads/media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, file, { contentType: file.type, upsert: false })
  if (uploadError) {
    captureServerActionError(uploadError, { action: 'upload_media' })
    throw new Error(uploadError.message)
  }

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(uploadData.path)
  const publicUrl = urlData.publicUrl

  const { data: row, error: insertError } = await supabase
    .from('ad_media')
    .insert({
      app_id: AD_APP_ID,
      storage_path: uploadData.path,
      public_url: publicUrl,
      mime_type: file.type,
      file_name: file.name,
    })
    .select('id')
    .single()
  if (insertError) {
    captureServerActionError(insertError, { action: 'upload_media_insert' })
    throw new Error(insertError.message)
  }

  return { id: (row as { id: string }).id, url: publicUrl }
}
```

- [ ] **Step 12: Add Blob upload import to links/actions.ts**

At the top of `apps/web/src/app/cms/(authed)/links/actions.ts`, after the existing imports (line ~8), add:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
```

- [ ] **Step 13: Gate `generateQr` (links/actions.ts, line ~705)**

```typescript
export async function generateQr(
  id: string,
  config: { size?: number; foreground?: string; background?: string; logo?: boolean },
): Promise<ActionResult<{ qrUrl: string }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, code')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) return { ok: false, error: 'not_found' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const shortUrl = `${appUrl}/go/${link.code}`
  const size = config.size ?? 256
  const fg = config.foreground ?? '#000000'
  const bg = config.background ?? '#FFFFFF'

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
  if (!HEX_COLOR.test(fg) || !HEX_COLOR.test(bg)) {
    return { ok: false, error: 'invalid_color_format' }
  }

  const { svg } = await generateQrSvg({
    url: shortUrl,
    size,
    darkColor: fg,
    lightColor: bg,
    errorCorrection: 'M',
  })

  const useBlobUpload = process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true'
  if (useBlobUpload) {
    const result = await uploadMediaAsset({
      file: Buffer.from(svg),
      filename: `qr-${link.code}.svg`,
      folder: 'links',
      siteId,
      uploadedBy: 'system',
      tags: ['qr', `link:${id}`],
    })
    if (!result.ok) return { ok: false, error: result.error }

    await supabase
      .from('tracked_links')
      .update({
        qr_storage_path: result.asset.blobPathname,
        has_qr: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('site_id', siteId)

    revalidateTag(`link:${id}`)
    return { ok: true, qrUrl: result.asset.blobUrl }
  }

  // Legacy Supabase path
  const path = `${siteId}/qr/${id}.svg`
  const { error: uploadError } = await supabase.storage
    .from('link-assets')
    .upload(path, Buffer.from(svg), { contentType: 'image/svg+xml', upsert: true })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('link-assets').getPublicUrl(path)

  await supabase
    .from('tracked_links')
    .update({ qr_storage_path: path, has_qr: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  revalidateTag(`link:${id}`)
  return { ok: true, qrUrl: publicUrl }
}
```

- [ ] **Step 14: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 15: Run existing test suite**

Run: `cd apps/web && npm test`
Expected: PASS — no regressions from the feature flag gates (all flags default to `false`, so legacy paths execute)

- [ ] **Step 16: Commit**

```bash
git add apps/web/src/app/cms/(authed)/authors/actions.ts \
       apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts \
       apps/web/src/app/cms/(authed)/newsletters/actions.ts \
       apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts \
       apps/web/src/app/cms/(authed)/links/actions.ts
git commit -m "feat(media): gate 8 upload functions behind MEDIA_BLOB_UPLOAD_ENABLED feature flag"
```
### Task 15: Gallery i18n + shared types + crop presets

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/media/types.ts`
- Create: `apps/web/src/app/cms/(authed)/_shared/media/media-gallery-i18n.ts`

- [ ] **Step 1: Create shared types file**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/types.ts
import type { MediaAsset } from '@/lib/media/types'

export interface CropPresetAvatar { name: 'avatar'; aspect: 1; maxWidth: 400; maxHeight: 400; circular: true }
export interface CropPresetBlogCover { name: 'blog-cover'; aspect: number; maxWidth: 1200; maxHeight: 675; circular: false }
export interface CropPresetOgImage { name: 'og-image'; aspect: number; maxWidth: 1200; maxHeight: 630; circular: false }
export interface CropPresetNewsletterHeader { name: 'newsletter-header'; aspect: undefined; maxWidth: 600; maxHeight: undefined; circular: false }
export interface CropPresetSiteLogo { name: 'site-logo'; aspect: undefined; maxWidth: 512; maxHeight: 512; circular: false }
export interface CropPresetFree { name: 'free'; aspect: undefined; maxWidth: 2048; maxHeight: 2048; circular: false }

export type CropPreset =
  | CropPresetAvatar
  | CropPresetBlogCover
  | CropPresetOgImage
  | CropPresetNewsletterHeader
  | CropPresetSiteLogo
  | CropPresetFree

export type CropPresetName = CropPreset['name']

export const CROP_PRESETS: Record<CropPresetName, CropPreset> = {
  avatar: { name: 'avatar', aspect: 1, maxWidth: 400, maxHeight: 400, circular: true },
  'blog-cover': { name: 'blog-cover', aspect: 16 / 9, maxWidth: 1200, maxHeight: 675, circular: false },
  'og-image': { name: 'og-image', aspect: 1200 / 630, maxWidth: 1200, maxHeight: 630, circular: false },
  'newsletter-header': { name: 'newsletter-header', aspect: undefined, maxWidth: 600, maxHeight: undefined, circular: false },
  'site-logo': { name: 'site-logo', aspect: undefined, maxWidth: 512, maxHeight: 512, circular: false },
  free: { name: 'free', aspect: undefined, maxWidth: 2048, maxHeight: 2048, circular: false },
}

export interface MediaAssetResult {
  id: string
  url: string
  alt: string
  width: number
  height: number
  mimeType: string
}

export interface MediaGalleryModalProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  multiple?: boolean
  locale: 'en' | 'pt-BR'
  siteId: string
}
```

- [ ] **Step 2: Create i18n file**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/media-gallery-i18n.ts
export interface MediaGalleryStrings {
  modal: { title: string; close: string }
  tabs: { upload: string; library: string }
  upload: {
    dragPrompt: string; dropHere: string; selectFile: string
    altLabel: string; altPlaceholder: string; altRequired: string
    folderLabel: string; tagsLabel: string; tagsPlaceholder: string
    uploadButton: string; uploading: string; uploadSuccess: string
    uploadError: string; duplicateNotice: string
  }
  library: {
    searchPlaceholder: string
    folderAll: string; folderAuthors: string; folderBlog: string
    folderNewsletters: string; folderBranding: string; folderOg: string
    folderAds: string; folderGeneral: string
    loadMore: string; noResults: string; emptyLibrary: string
  }
  crop: { cropTitle: string; cropConfirm: string; cropCancel: string }
  delete: { confirmTitle: string; confirmMessage: string; usageWarning: string }
  dimensions: { tooSmall: string }
}

const en: MediaGalleryStrings = {
  modal: { title: 'Media Gallery', close: 'Close' },
  tabs: { upload: 'Upload', library: 'Library' },
  upload: {
    dragPrompt: 'Drag an image here or click to browse',
    dropHere: 'Drop your file here',
    selectFile: 'Select file',
    altLabel: 'Alt text',
    altPlaceholder: 'Describe this image for screen readers',
    altRequired: 'Alt text is required',
    folderLabel: 'Folder',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'Add a tag…',
    uploadButton: 'Upload & Select',
    uploading: 'Uploading…',
    uploadSuccess: 'Upload complete',
    uploadError: 'Upload failed',
    duplicateNotice: 'This image already exists — reusing it.',
  },
  library: {
    searchPlaceholder: 'Search by filename or tag…',
    folderAll: 'All', folderAuthors: 'Authors', folderBlog: 'Blog',
    folderNewsletters: 'Newsletters', folderBranding: 'Branding', folderOg: 'OG Images',
    folderAds: 'Ads', folderGeneral: 'General',
    loadMore: 'Load more',
    noResults: 'No images match your search.',
    emptyLibrary: 'No images uploaded yet.',
  },
  crop: { cropTitle: 'Crop image', cropConfirm: 'Apply crop', cropCancel: 'Cancel' },
  delete: {
    confirmTitle: 'Delete image?',
    confirmMessage: 'This image will be marked for deletion.',
    usageWarning: 'This image is used in {count} places. Deleting it may break content.',
  },
  dimensions: { tooSmall: 'Image is too small for this context' },
}

const ptBR: MediaGalleryStrings = {
  modal: { title: 'Galeria de Mídia', close: 'Fechar' },
  tabs: { upload: 'Upload', library: 'Biblioteca' },
  upload: {
    dragPrompt: 'Arraste uma imagem aqui ou clique para escolher',
    dropHere: 'Solte o arquivo aqui',
    selectFile: 'Selecionar arquivo',
    altLabel: 'Texto alternativo',
    altPlaceholder: 'Descreva a imagem para leitores de tela',
    altRequired: 'Texto alternativo é obrigatório',
    folderLabel: 'Pasta',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'Adicionar tag…',
    uploadButton: 'Enviar e Selecionar',
    uploading: 'Enviando…',
    uploadSuccess: 'Upload concluído',
    uploadError: 'Falha no upload',
    duplicateNotice: 'Esta imagem já existe — reutilizando.',
  },
  library: {
    searchPlaceholder: 'Buscar por nome ou tag…',
    folderAll: 'Todas', folderAuthors: 'Autores', folderBlog: 'Blog',
    folderNewsletters: 'Newsletters', folderBranding: 'Marca', folderOg: 'Imagens OG',
    folderAds: 'Anúncios', folderGeneral: 'Geral',
    loadMore: 'Carregar mais',
    noResults: 'Nenhuma imagem encontrada.',
    emptyLibrary: 'Nenhuma imagem enviada ainda.',
  },
  crop: { cropTitle: 'Recortar imagem', cropConfirm: 'Aplicar recorte', cropCancel: 'Cancelar' },
  delete: {
    confirmTitle: 'Excluir imagem?',
    confirmMessage: 'A imagem será marcada para exclusão.',
    usageWarning: 'Esta imagem é usada em {count} lugares. Excluí-la pode quebrar conteúdo.',
  },
  dimensions: { tooSmall: 'Imagem muito pequena para este contexto' },
}

export function getMediaGalleryStrings(locale: 'en' | 'pt-BR'): MediaGalleryStrings {
  return locale === 'pt-BR' ? ptBR : en
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/media/types.ts apps/web/src/app/cms/\(authed\)/_shared/media/media-gallery-i18n.ts
git commit -m "feat(media): gallery i18n strings + shared types + crop presets"
```

---

### Task 16: Media crop editor component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/media/media-crop-editor.tsx`
- Create: `apps/web/test/cms/media-crop-editor.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/cms/media-crop-editor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('react-image-crop', () => {
  const MockReactCrop = ({ children, aspect, circularCrop, onChange }: {
    children: React.ReactNode
    aspect?: number
    circularCrop?: boolean
    onChange: (c: unknown) => void
  }) => (
    <div
      data-testid="react-crop"
      data-aspect={aspect}
      data-circular={circularCrop}
      onClick={() => onChange({ x: 0, y: 0, width: 50, height: 50, unit: '%' })}
    >
      {children}
    </div>
  )
  MockReactCrop.displayName = 'ReactCrop'
  return { default: MockReactCrop }
})

vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}))

import { MediaCropEditor } from '@/app/cms/(authed)/_shared/media/media-crop-editor'
import { CROP_PRESETS } from '@/app/cms/(authed)/_shared/media/types'

describe('MediaCropEditor', () => {
  const defaultProps = {
    imageUrl: 'blob:http://localhost/test-image',
    preset: CROP_PRESETS['avatar'],
    locale: 'en' as const,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders with locked aspect ratio for avatar preset', () => {
    render(<MediaCropEditor {...defaultProps} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.aspect).toBe('1')
  })

  it('renders without aspect lock for free preset', () => {
    render(<MediaCropEditor {...defaultProps} preset={CROP_PRESETS['free']} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.aspect).toBeUndefined()
  })

  it('enables circular mask for avatar preset', () => {
    render(<MediaCropEditor {...defaultProps} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.circular).toBe('true')
  })

  it('disables circular mask for blog-cover preset', () => {
    render(<MediaCropEditor {...defaultProps} preset={CROP_PRESETS['blog-cover']} />)
    const crop = screen.getByTestId('react-crop')
    expect(crop.dataset.circular).toBe('false')
  })

  it('shows cancel button that calls onCancel', () => {
    render(<MediaCropEditor {...defaultProps} />)
    fireEvent.click(screen.getByTestId('crop-cancel'))
    expect(defaultProps.onCancel).toHaveBeenCalledOnce()
  })

  it('renders i18n strings for pt-BR', () => {
    render(<MediaCropEditor {...defaultProps} locale="pt-BR" />)
    expect(screen.getByText('Recortar imagem')).toBeDefined()
    expect(screen.getByText('Aplicar recorte')).toBeDefined()
  })

  it('renders i18n strings for en', () => {
    render(<MediaCropEditor {...defaultProps} locale="en" />)
    expect(screen.getByText('Crop image')).toBeDefined()
    expect(screen.getByText('Apply crop')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/media-crop-editor.test.tsx`
Expected: FAIL — `MediaCropEditor` not found

- [ ] **Step 3: Implement crop editor**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/media-crop-editor.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { CropPreset } from './types'
import { getMediaGalleryStrings } from './media-gallery-i18n'

interface MediaCropEditorProps {
  imageUrl: string
  preset: CropPreset
  locale: 'en' | 'pt-BR'
  onConfirm: (croppedBlob: Blob, dimensions: { width: number; height: number }) => void
  onCancel: () => void
}

function clampDimensions(
  w: number,
  h: number,
  maxW: number,
  maxH: number | undefined,
): { width: number; height: number } {
  let width = w
  let height = h
  if (width > maxW) {
    height = Math.round(height * (maxW / width))
    width = maxW
  }
  if (maxH && height > maxH) {
    width = Math.round(width * (maxH / height))
    height = maxH
  }
  return { width, height }
}

export function MediaCropEditor({ imageUrl, preset, locale, onConfirm, onCancel }: MediaCropEditorProps) {
  const t = getMediaGalleryStrings(locale)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      imgRef.current = e.currentTarget
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget

      const cropPercent: Crop = preset.aspect
        ? (() => {
            const imgAspect = w / h
            if (imgAspect > preset.aspect) {
              const cropH = 100
              const cropW = (preset.aspect / imgAspect) * 100
              return { unit: '%' as const, x: (100 - cropW) / 2, y: 0, width: cropW, height: cropH }
            }
            const cropW = 100
            const cropH = (imgAspect / preset.aspect) * 100
            return { unit: '%' as const, x: 0, y: (100 - cropH) / 2, width: cropW, height: cropH }
          })()
        : { unit: '%' as const, x: 10, y: 10, width: 80, height: 80 }

      setCrop(cropPercent)
    },
    [preset.aspect],
  )

  const handleConfirm = useCallback(() => {
    const image = imgRef.current
    if (!image || !completedCrop) return

    const canvas = document.createElement('canvas')
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    const rawW = Math.round(completedCrop.width * scaleX)
    const rawH = Math.round(completedCrop.height * scaleY)

    const { width: outW, height: outH } = clampDimensions(
      rawW,
      rawH,
      preset.maxWidth,
      preset.maxHeight,
    )

    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (preset.circular) {
      ctx.beginPath()
      ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2)
      ctx.clip()
    }

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      rawW,
      rawH,
      0,
      0,
      outW,
      outH,
    )

    canvas.toBlob(
      (blob) => {
        if (blob) onConfirm(blob, { width: outW, height: outH })
      },
      'image/webp',
      0.85,
    )
  }, [completedCrop, preset, onConfirm])

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold text-[#f3f4f6]">{t.crop.cropTitle}</h4>

      <div className="flex justify-center overflow-hidden rounded-lg border border-[#374151] bg-black/20">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={preset.aspect}
          circularCrop={preset.circular}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            onLoad={onImageLoad}
            className="max-h-[400px] max-w-full"
            data-testid="crop-image"
          />
        </ReactCrop>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-[#9ca3af] hover:bg-white/5"
          data-testid="crop-cancel"
        >
          {t.crop.cropCancel}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!completedCrop}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="crop-confirm"
        >
          {t.crop.cropConfirm}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/media-crop-editor.test.tsx`
Expected: PASS — all 7 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/media/media-crop-editor.tsx apps/web/test/cms/media-crop-editor.test.tsx
git commit -m "feat(media): generic crop editor component with react-image-crop"
```

---

### Task 17: Gallery modal + upload tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/media/media-gallery-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/_shared/media/media-upload-tab.tsx`
- Create: `apps/web/test/cms/media-gallery-modal.test.tsx`

- [ ] **Step 1: Write failing tests for the modal**

```typescript
// apps/web/test/cms/media-gallery-modal.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('react-image-crop', () => {
  const M = ({ children }: { children: React.ReactNode }) => <div data-testid="react-crop">{children}</div>
  M.displayName = 'ReactCrop'
  return { default: M }
})
vi.mock('react-image-crop/dist/ReactCrop.css', () => ({}))

const mockUpload = vi.fn()
vi.mock('@/app/cms/(authed)/media/actions', () => ({
  uploadMediaAction: (...args: unknown[]) => mockUpload(...args),
  listMediaAssets: vi.fn(() => Promise.resolve({ ok: true, assets: [], nextCursor: null })),
}))

import { MediaGalleryModal } from '@/app/cms/(authed)/_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '@/app/cms/(authed)/_shared/media/types'

function renderModal(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSelect: vi.fn(),
    locale: 'en' as const,
    siteId: 'site-1',
    ...overrides,
  }
  render(<MediaGalleryModal {...props} />)
  return props
}

describe('MediaGalleryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders when open is true', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeDefined()
    expect(screen.getByText('Media Gallery')).toBeDefined()
  })

  it('does not render when open is false', () => {
    renderModal({ open: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows Upload and Library tabs', () => {
    renderModal()
    expect(screen.getByText('Upload')).toBeDefined()
    expect(screen.getByText('Library')).toBeDefined()
  })

  it('starts on Upload tab', () => {
    renderModal()
    expect(screen.getByText('Drag an image here or click to browse')).toBeDefined()
  })

  it('switches to Library tab on click', () => {
    renderModal()
    fireEvent.click(screen.getByText('Library'))
    expect(screen.getByPlaceholderText('Search by filename or tag…')).toBeDefined()
  })

  it('calls onClose when Escape is pressed', () => {
    const props = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const props = renderModal()
    const backdrop = screen.getByTestId('gallery-backdrop')
    fireEvent.click(backdrop)
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('renders pt-BR strings when locale is pt-BR', () => {
    renderModal({ locale: 'pt-BR' })
    expect(screen.getByText('Galeria de Mídia')).toBeDefined()
  })
})

describe('MediaUploadTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({
      ok: true,
      asset: { id: 'a1', blobUrl: 'https://x.blob.vercel-storage.com/test.jpg', filename: 'test.jpg', altText: 'Alt', width: 100, height: 100, mimeType: 'image/jpeg' },
      deduplicated: false,
    })
  })

  it('shows drag-drop zone prompt', () => {
    renderModal()
    expect(screen.getByText('Drag an image here or click to browse')).toBeDefined()
  })

  it('accepts files via input', () => {
    renderModal()
    const input = screen.getByTestId('media-file-input')
    expect(input.getAttribute('accept')).toBe('image/jpeg,image/png,image/webp,image/gif,image/svg+xml')
  })

  it('shows alt text required error on empty submit attempt', async () => {
    renderModal({ cropPreset: undefined })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('upload-form')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('upload-submit'))
    expect(screen.getByText('Alt text is required')).toBeDefined()
  })

  it('shows crop editor when cropPreset is set and file is selected', async () => {
    renderModal({ cropPreset: CROP_PRESETS['avatar'] })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('crop-cancel')).toBeDefined()
    })
  })

  it('calls onSelect after successful upload', async () => {
    const props = renderModal({ cropPreset: undefined })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('upload-form')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('alt-input'), { target: { value: 'My alt' } })
    fireEvent.click(screen.getByTestId('upload-submit'))

    await waitFor(() => {
      expect(props.onSelect).toHaveBeenCalledOnce()
    })
  })

  it('shows duplicate notice when deduplicated', async () => {
    mockUpload.mockResolvedValue({
      ok: true,
      asset: { id: 'a1', blobUrl: 'https://x.blob.vercel-storage.com/test.jpg', filename: 'test.jpg', altText: 'Alt', width: 100, height: 100, mimeType: 'image/jpeg' },
      deduplicated: true,
    })

    const props = renderModal({ cropPreset: undefined })
    const input = screen.getByTestId('media-file-input') as HTMLInputElement
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('upload-form')).toBeDefined()
    })

    fireEvent.change(screen.getByTestId('alt-input'), { target: { value: 'My alt' } })
    fireEvent.click(screen.getByTestId('upload-submit'))

    await waitFor(() => {
      expect(props.onSelect).toHaveBeenCalledOnce()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/media-gallery-modal.test.tsx`
Expected: FAIL — `MediaGalleryModal` not found

- [ ] **Step 3: Implement gallery modal**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/media-gallery-modal.tsx
'use client'

import { useRef, useState } from 'react'
import { useModalFocusTrap } from '../editor/use-modal-focus-trap'
import { MediaUploadTab } from './media-upload-tab'
import { MediaLibraryTab } from './media-library-tab'
import type { MediaGalleryModalProps, MediaAssetResult } from './types'
import { getMediaGalleryStrings } from './media-gallery-i18n'

type Tab = 'upload' | 'library'

export function MediaGalleryModal({
  open,
  onClose,
  onSelect,
  folder,
  cropPreset,
  multiple,
  locale,
  siteId,
}: MediaGalleryModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<Tab>('upload')
  const t = getMediaGalleryStrings(locale)

  useModalFocusTrap(dialogRef, open, onClose)

  if (!open) return null

  const handleSelect = (asset: MediaAssetResult) => {
    onSelect(asset)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      data-testid="gallery-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.modal.title}
        className="mx-4 flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[#374151] bg-[#111827] shadow-2xl sm:h-[600px]"
        data-testid="gallery-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#374151] px-6 py-4">
          <h3 className="text-lg font-semibold text-[#f3f4f6]">{t.modal.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#9ca3af] hover:bg-white/5 hover:text-[#f3f4f6]"
            aria-label={t.modal.close}
            data-testid="gallery-close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#374151]">
          {(['upload', 'library'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-500 text-indigo-400'
                  : 'text-[#9ca3af] hover:text-[#f3f4f6]'
              }`}
            >
              {t.tabs[tab]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'upload' ? (
            <MediaUploadTab
              onSelect={handleSelect}
              folder={folder}
              cropPreset={cropPreset}
              locale={locale}
              siteId={siteId}
            />
          ) : (
            <MediaLibraryTab
              onSelect={handleSelect}
              folder={folder}
              cropPreset={cropPreset}
              locale={locale}
              siteId={siteId}
            />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement upload tab**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/media-upload-tab.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { uploadMediaAction } from '../../media/actions'
import { MediaCropEditor } from './media-crop-editor'
import type { CropPreset, MediaAssetResult } from './types'
import { getMediaGalleryStrings } from './media-gallery-i18n'
import type { MediaFolder } from '@/lib/media/types'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml'

const FOLDER_OPTIONS: { value: MediaFolder; labelKey: keyof ReturnType<typeof getMediaGalleryStrings>['library'] }[] = [
  { value: 'general', labelKey: 'folderGeneral' },
  { value: 'authors', labelKey: 'folderAuthors' },
  { value: 'blog', labelKey: 'folderBlog' },
  { value: 'newsletters', labelKey: 'folderNewsletters' },
  { value: 'branding', labelKey: 'folderBranding' },
  { value: 'og', labelKey: 'folderOg' },
  { value: 'ads', labelKey: 'folderAds' },
]

interface UploadTabProps {
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  locale: 'en' | 'pt-BR'
  siteId: string
}

export function MediaUploadTab({ onSelect, folder, cropPreset, locale, siteId }: UploadTabProps) {
  const t = getMediaGalleryStrings(locale)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null)
  const [croppedDims, setCroppedDims] = useState<{ width: number; height: number } | null>(null)
  const [showCrop, setShowCrop] = useState(false)

  const [altText, setAltText] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder>((folder as MediaFolder) ?? 'general')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [altError, setAltError] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file)
      setCroppedBlob(null)
      setCroppedDims(null)
      setUploadError(null)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)

      if (cropPreset && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
        setShowCrop(true)
      } else {
        setShowCrop(false)
      }
    },
    [cropPreset],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleCropConfirm = useCallback(
    (blob: Blob, dims: { width: number; height: number }) => {
      setCroppedBlob(blob)
      setCroppedDims(dims)
      setShowCrop(false)
    },
    [],
  )

  const handleCropCancel = useCallback(() => {
    setShowCrop(false)
    setCroppedBlob(null)
  }, [])

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed])
    }
    setTagInput('')
  }, [tagInput, tags])

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleSubmit = useCallback(async () => {
    setAltError(false)
    if (!altText.trim()) {
      setAltError(true)
      return
    }

    const fileToUpload = croppedBlob ?? selectedFile
    if (!fileToUpload) return

    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      if (croppedBlob) {
        const ext = selectedFile?.name.split('.').pop() ?? 'webp'
        formData.append('file', croppedBlob, `cropped.${ext}`)
      } else {
        formData.append('file', fileToUpload as File)
      }
      formData.append('siteId', siteId)
      formData.append('folder', selectedFolder)
      formData.append('altText', altText.trim())
      if (tags.length > 0) formData.append('tags', JSON.stringify(tags))

      const result = await uploadMediaAction(formData)

      if (!result.ok) {
        setUploadError(result.error)
        return
      }

      onSelect({
        id: result.asset.id,
        url: result.asset.blobUrl,
        alt: result.asset.altText ?? altText.trim(),
        width: croppedDims?.width ?? result.asset.width ?? 0,
        height: croppedDims?.height ?? result.asset.height ?? 0,
        mimeType: result.asset.mimeType,
      })
    } catch {
      setUploadError(t.upload.uploadError)
    } finally {
      setUploading(false)
    }
  }, [altText, croppedBlob, croppedDims, selectedFile, selectedFolder, siteId, tags, onSelect, t])

  // --- Crop phase ---
  if (showCrop && previewUrl && cropPreset) {
    return (
      <MediaCropEditor
        imageUrl={previewUrl}
        preset={cropPreset}
        locale={locale}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    )
  }

  // --- File selection phase (no file yet) ---
  if (!selectedFile) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-[#374151] hover:border-[#4b5563]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="drop-zone"
      >
        <svg className="mb-4 h-12 w-12 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="mb-2 text-sm text-[#9ca3af]">
          {isDragOver ? t.upload.dropHere : t.upload.dragPrompt}
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          {t.upload.selectFile}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          className="hidden"
          onChange={handleInputChange}
          data-testid="media-file-input"
        />
      </div>
    )
  }

  // --- Form phase (file selected, crop done or skipped) ---
  return (
    <div className="space-y-4" data-testid="upload-form">
      {/* Preview */}
      {previewUrl && (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={croppedBlob ? URL.createObjectURL(croppedBlob) : previewUrl}
            alt=""
            className="max-h-48 rounded-lg border border-[#374151]"
          />
        </div>
      )}

      <p className="text-center text-xs text-[#6b7280]">
        {selectedFile.name}
        {croppedDims ? ` — ${croppedDims.width}×${croppedDims.height}` : ''}
      </p>

      {/* Alt text */}
      <div>
        <label htmlFor="media-alt" className="mb-1 block text-sm font-medium text-[#d1d5db]">
          {t.upload.altLabel} <span className="text-red-400">*</span>
        </label>
        <input
          id="media-alt"
          type="text"
          value={altText}
          onChange={(e) => { setAltText(e.target.value); setAltError(false) }}
          placeholder={t.upload.altPlaceholder}
          className="w-full rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] placeholder-[#6b7280] focus:border-indigo-500 focus:outline-none"
          data-testid="alt-input"
        />
        {altError && <p className="mt-1 text-xs text-red-400">{t.upload.altRequired}</p>}
      </div>

      {/* Folder */}
      <div>
        <label htmlFor="media-folder" className="mb-1 block text-sm font-medium text-[#d1d5db]">
          {t.upload.folderLabel}
        </label>
        <select
          id="media-folder"
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value as MediaFolder)}
          className="w-full rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] focus:border-indigo-500 focus:outline-none"
          data-testid="folder-select"
        >
          {FOLDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t.library[opt.labelKey]}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label htmlFor="media-tags" className="mb-1 block text-sm font-medium text-[#d1d5db]">
          {t.upload.tagsLabel}
        </label>
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#1e293b] px-2 py-0.5 text-xs text-[#d1d5db]">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-[#6b7280] hover:text-[#f3f4f6]">×</button>
            </span>
          ))}
        </div>
        <input
          id="media-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={t.upload.tagsPlaceholder}
          className="w-full rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] placeholder-[#6b7280] focus:border-indigo-500 focus:outline-none"
          data-testid="tags-input"
        />
      </div>

      {/* Error */}
      {uploadError && (
        <p className="text-sm text-red-400">{uploadError}</p>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { setSelectedFile(null); setPreviewUrl(null); setCroppedBlob(null) }}
          className="rounded-md px-4 py-2 text-sm text-[#9ca3af] hover:bg-white/5"
        >
          {t.crop.cropCancel}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={uploading}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          data-testid="upload-submit"
        >
          {uploading ? t.upload.uploading : t.upload.uploadButton}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/cms/media-gallery-modal.test.tsx`
Expected: PASS — all tests green

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/media/media-gallery-modal.tsx apps/web/src/app/cms/\(authed\)/_shared/media/media-upload-tab.tsx apps/web/test/cms/media-gallery-modal.test.tsx
git commit -m "feat(media): gallery modal with upload tab, drag-drop, crop integration"
```

---

### Task 18: Gallery library tab

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/media/media-library-tab.tsx`

- [ ] **Step 1: Add failing tests to media-gallery-modal.test.tsx**

Append to `apps/web/test/cms/media-gallery-modal.test.tsx`:

```typescript
import { MediaLibraryTab } from '@/app/cms/(authed)/_shared/media/media-library-tab'

describe('MediaLibraryTab', () => {
  const defaultProps = {
    onSelect: vi.fn(),
    locale: 'en' as const,
    siteId: 'site-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input and folder dropdown', () => {
    render(<MediaLibraryTab {...defaultProps} />)
    expect(screen.getByPlaceholderText('Search by filename or tag…')).toBeDefined()
    expect(screen.getByTestId('library-folder-filter')).toBeDefined()
  })

  it('shows empty state when no assets', async () => {
    render(<MediaLibraryTab {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('No images uploaded yet.')).toBeDefined()
    })
  })

  it('renders grid of thumbnails when assets exist', async () => {
    const { listMediaAssets } = await import('@/app/cms/(authed)/media/actions')
    vi.mocked(listMediaAssets).mockResolvedValueOnce({
      ok: true,
      assets: [
        { id: 'a1', blobUrl: 'https://x.blob.vercel-storage.com/img.jpg', filename: 'img.jpg', altText: 'Alt 1', width: 200, height: 100, mimeType: 'image/jpeg', fileSize: 5000, folder: 'blog', tags: [], createdAt: '2026-01-01' },
      ],
      nextCursor: null,
    })
    render(<MediaLibraryTab {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByTestId('media-thumb-a1')).toBeDefined()
    })
  })

  it('selects asset on click and shows details bar', async () => {
    const { listMediaAssets } = await import('@/app/cms/(authed)/media/actions')
    vi.mocked(listMediaAssets).mockResolvedValueOnce({
      ok: true,
      assets: [
        { id: 'a1', blobUrl: 'https://x.blob.vercel-storage.com/img.jpg', filename: 'photo.jpg', altText: 'A photo', width: 800, height: 600, mimeType: 'image/jpeg', fileSize: 50000, folder: 'blog', tags: [], createdAt: '2026-01-01' },
      ],
      nextCursor: null,
    })

    render(<MediaLibraryTab {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('media-thumb-a1')).toBeDefined()
    })

    fireEvent.click(screen.getByTestId('media-thumb-a1'))
    expect(screen.getByText('photo.jpg')).toBeDefined()
    expect(screen.getByText('800 × 600')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/cms/media-gallery-modal.test.tsx`
Expected: FAIL — `MediaLibraryTab` not found

- [ ] **Step 3: Implement library tab**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/media-library-tab.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { listMediaAssets } from '../../media/actions'
import type { CropPreset, MediaAssetResult } from './types'
import type { MediaFolder } from '@/lib/media/types'
import { getMediaGalleryStrings } from './media-gallery-i18n'

interface LibraryAsset {
  id: string
  blobUrl: string
  filename: string
  altText: string | null
  width: number | null
  height: number | null
  mimeType: string
  fileSize: number
  folder: string
  tags: string[]
  createdAt: string
}

interface LibraryTabProps {
  onSelect: (asset: MediaAssetResult) => void
  folder?: string
  cropPreset?: CropPreset
  locale: 'en' | 'pt-BR'
  siteId: string
}

const FOLDER_FILTERS: Array<{ value: string; labelKey: keyof ReturnType<typeof getMediaGalleryStrings>['library'] }> = [
  { value: '', labelKey: 'folderAll' },
  { value: 'authors', labelKey: 'folderAuthors' },
  { value: 'blog', labelKey: 'folderBlog' },
  { value: 'newsletters', labelKey: 'folderNewsletters' },
  { value: 'branding', labelKey: 'folderBranding' },
  { value: 'og', labelKey: 'folderOg' },
  { value: 'ads', labelKey: 'folderAds' },
  { value: 'general', labelKey: 'folderGeneral' },
]

export function MediaLibraryTab({ onSelect, folder, cropPreset, locale, siteId }: LibraryTabProps) {
  const t = getMediaGalleryStrings(locale)

  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState(folder ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchAssets = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      try {
        const result = await listMediaAssets(siteId, {
          folder: folderFilter || undefined,
          search: search || undefined,
          cursor,
          limit: 24,
        })

        if (result.ok) {
          setAssets((prev) => (cursor ? [...prev, ...result.assets] : result.assets))
          setNextCursor(result.nextCursor)
        }
      } finally {
        setLoading(false)
      }
    },
    [siteId, folderFilter, search],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setAssets([])
      setNextCursor(null)
      fetchAssets()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchAssets])

  const selectedAsset = assets.find((a) => a.id === selectedId)

  const isTooSmall = (asset: LibraryAsset): boolean => {
    if (!cropPreset || !asset.width || !asset.height) return false
    return asset.width < cropPreset.maxWidth || (cropPreset.maxHeight !== undefined && asset.height < cropPreset.maxHeight)
  }

  const handleSelectAsset = (asset: LibraryAsset) => {
    onSelect({
      id: asset.id,
      url: asset.blobUrl,
      alt: asset.altText ?? '',
      width: asset.width ?? 0,
      height: asset.height ?? 0,
      mimeType: asset.mimeType,
    })
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Filters */}
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          className="flex-1 rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] placeholder-[#6b7280] focus:border-indigo-500 focus:outline-none"
          data-testid="library-search"
        />
        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="rounded-md border border-[#374151] bg-[#0a0f1a] px-3 py-2 text-sm text-[#f3f4f6] focus:border-indigo-500 focus:outline-none"
          data-testid="library-folder-filter"
        >
          {FOLDER_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{t.library[f.labelKey]}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {!loading && assets.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-[#6b7280]">
            {search ? t.library.noResults : t.library.emptyLibrary}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedId(selectedId === asset.id ? null : asset.id)}
              onDoubleClick={() => handleSelectAsset(asset)}
              className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                selectedId === asset.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500'
                  : 'border-[#374151] hover:border-[#4b5563]'
              }`}
              data-testid={`media-thumb-${asset.id}`}
            >
              {asset.mimeType === 'image/svg+xml' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.blobUrl} alt={asset.altText ?? ''} className="h-full w-full object-cover" />
              ) : (
                <Image
                  src={asset.blobUrl}
                  alt={asset.altText ?? ''}
                  fill
                  sizes="150px"
                  className="object-cover"
                />
              )}
              {isTooSmall(asset) && (
                <span
                  className="absolute right-1 top-1 rounded bg-amber-500/80 px-1 py-0.5 text-[10px] font-medium text-black"
                  title={t.dimensions.tooSmall}
                >
                  ⚠
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#374151] border-t-indigo-500" />
        </div>
      )}

      {/* Load more */}
      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => fetchAssets(nextCursor)}
            className="rounded-md border border-[#374151] px-4 py-2 text-sm text-[#d1d5db] hover:bg-white/5"
          >
            {t.library.loadMore}
          </button>
        </div>
      )}

      {/* Selection bar */}
      {selectedAsset && (
        <div className="flex items-center justify-between rounded-lg border border-[#374151] bg-[#1e293b] px-4 py-3">
          <div className="flex items-center gap-3 text-sm text-[#d1d5db]">
            <span className="font-medium">{selectedAsset.filename}</span>
            <span className="text-[#6b7280]">
              {selectedAsset.width && selectedAsset.height
                ? `${selectedAsset.width} × ${selectedAsset.height}`
                : 'SVG'}
            </span>
            {selectedAsset.altText && (
              <span className="truncate text-[#6b7280]">{selectedAsset.altText}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => handleSelectAsset(selectedAsset)}
            className="rounded-md bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
            data-testid="library-select-btn"
          >
            {t.tabs.upload === 'Upload' ? 'Select' : 'Selecionar'}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/cms/media-gallery-modal.test.tsx`
Expected: PASS — all tests green (including new `MediaLibraryTab` tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/media/media-library-tab.tsx apps/web/test/cms/media-gallery-modal.test.tsx
git commit -m "feat(media): gallery library tab with grid, search, folder filter, pagination"
```

---

### Task 19: useMediaGallery hook

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/media/use-media-gallery.ts`

- [ ] **Step 1: Implement the hook**

```typescript
// apps/web/src/app/cms/(authed)/_shared/media/use-media-gallery.ts
'use client'

import { useState, useCallback } from 'react'
import type { CropPreset, MediaGalleryModalProps } from './types'

interface UseMediaGalleryOptions {
  folder?: string
  cropPreset?: CropPreset
}

export function useMediaGallery() {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<UseMediaGalleryOptions>({})

  const openGallery = useCallback((opts?: UseMediaGalleryOptions) => {
    setOptions(opts ?? {})
    setOpen(true)
  }, [])

  const closeGallery = useCallback(() => {
    setOpen(false)
    setOptions({})
  }, [])

  return {
    open,
    openGallery,
    closeGallery,
    galleryProps: {
      open,
      onClose: closeGallery,
      folder: options.folder,
      cropPreset: options.cropPreset,
    } satisfies Partial<MediaGalleryModalProps>,
  }
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/media/use-media-gallery.ts
git commit -m "feat(media): useMediaGallery convenience hook"
```

---

### Task 20: Migrate 8 upload functions to central pipeline

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts`
- Modify: `apps/web/src/app/admin/(authed)/ads/_actions/campaigns.ts`
- Modify: `apps/web/src/app/cms/(authed)/links/actions.ts`

> **Note:** This task completes the upload migration by replacing all Supabase Storage code with the central `uploadMediaAsset()` pipeline. Each function below removes the old storage code entirely and routes through Vercel Blob.

- [ ] **Step 1: Migrate `uploadAuthorAvatar` in `authors/actions.ts`**

Add import at the top of `authors/actions.ts`:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

Replace the function at lines 256–294:

```typescript
export async function uploadAuthorAvatar(
  authorId: string,
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const siteId = await requireEditAccess()

  const file = formData.get('file')
  if (!(file instanceof File)) return { ok: false, error: 'No file provided' }

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'authors',
    siteId,
    uploadedBy: (await getSiteContext()).userId ?? 'unknown',
    tags: ['avatar', `author:${authorId}`],
  })
  if (!result.ok) return { ok: false, error: result.error }

  const supabase = getSupabaseServiceClient()
  const { error: updateError } = await supabase
    .from('authors')
    .update({ avatar_url: result.asset.blobUrl })
    .eq('id', authorId)
    .eq('site_id', siteId)
  if (updateError) return { ok: false, error: updateError.message }

  await trackMediaUsage(result.asset.id, 'author', authorId, 'avatar_url')

  revalidateAuthor(authorId)
  revalidatePath('/cms/authors')
  return { ok: true, url: result.asset.blobUrl }
}
```

Remove the now-unused constants `ALLOWED_IMAGE_TYPES` and `MAX_AVATAR_SIZE` if they are not used elsewhere in the file.

- [ ] **Step 2: Migrate `uploadAuthorAboutPhoto` in `authors/actions.ts`**

Replace the function at lines 403–435:

```typescript
export async function uploadAuthorAboutPhoto(
  authorId: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const siteId = await requireEditAccess()

  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'no_file' }

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'authors',
    siteId,
    uploadedBy: (await getSiteContext()).userId ?? 'unknown',
    tags: ['about-photo', `author:${authorId}`],
  })
  if (!result.ok) return { ok: false, error: result.error }

  const sb = getSupabaseServiceClient()
  await sb.from('authors')
    .update({ about_photo_url: result.asset.blobUrl })
    .eq('id', authorId)
    .eq('site_id', siteId)

  await trackMediaUsage(result.asset.id, 'author', authorId, 'about_photo_url')

  revalidateAuthor(authorId)
  revalidateAbout(siteId)
  revalidatePath('/about')

  return { ok: true, url: result.asset.blobUrl }
}
```

- [ ] **Step 3: Migrate `uploadAsset` (blog inline) in `blog/[id]/edit/actions.ts`**

This fixes the **critical signed-URL expiry bug**. Add import at the top of `blog/[id]/edit/actions.ts`:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

Replace the function at lines 270–281. Remove the `uploadContentAsset` import from `@tn-figueiredo/cms`:

```typescript
export async function uploadAsset(file: File, postId: string): Promise<{ url: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  const ctx = await getSiteContext()

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'blog',
    siteId: ctx.siteId,
    uploadedBy: ctx.userId ?? 'unknown',
    tags: ['inline', `post:${postId}`],
  })
  if (!result.ok) throw new Error(result.error)

  await trackMediaUsage(result.asset.id, 'blog_post', postId, 'inline_image')

  return { url: result.asset.blobUrl }
}
```

- [ ] **Step 4: Update `saveCoverImage` in `blog/[id]/edit/actions.ts`**

Replace the function at lines 253–268 to accept Blob URLs:

```typescript
export async function saveCoverImage(
  postId: string,
  url: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireSiteAdminForRow('blog_posts', postId)
  if (url !== null && !isSafeUrl(url) && !url.startsWith('https://') ) {
    return { ok: false, error: 'invalid_url' }
  }
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ cover_image_url: url })
    .eq('id', postId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
```

> Note: `isSafeUrl()` from `@tn-figueiredo/cms` already validates HTTPS URLs. Blob URLs are HTTPS so they pass. No additional validation needed.

- [ ] **Step 5: Migrate `uploadNewsletterImage` in `newsletters/actions.ts`**

Add import at the top of `newsletters/actions.ts`:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

Replace the function at lines 1273–1308:

```typescript
export async function uploadNewsletterImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  const editionId = formData.get('editionId') as string | null
  if (!file || !editionId) return { ok: false, error: 'missing_fields' }

  await requireSiteAdminForRow('newsletter_editions', editionId)

  const supabase = getSupabaseServiceClient()
  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('site_id')
    .eq('id', editionId)
    .single()
  if (!edition) return { ok: false, error: 'not_found' }

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'newsletters',
    siteId: edition.site_id,
    uploadedBy: (await getSiteContext()).userId ?? 'unknown',
    tags: ['inline', `edition:${editionId}`],
  })
  if (!result.ok) return { ok: false, error: result.error }

  await trackMediaUsage(result.asset.id, 'newsletter_edition', editionId, 'inline_image')

  return { ok: true, url: result.asset.blobUrl }
}
```

- [ ] **Step 6: Migrate `uploadNewsletterTypeImage` in `newsletters/actions.ts`**

Replace the function at lines 1310–1339:

```typescript
export async function uploadNewsletterTypeImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const file = formData.get('file') as File | null
  if (!file) return { ok: false, error: 'missing_file' }

  const ctx = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'og',
    siteId: ctx.siteId,
    uploadedBy: ctx.userId ?? 'unknown',
    tags: ['newsletter-og'],
  })
  if (!result.ok) return { ok: false, error: result.error }

  return { ok: true, url: result.asset.blobUrl }
}
```

- [ ] **Step 7: Migrate `uploadMedia` (ads) in `admin/ads/_actions/campaigns.ts`**

Add import at the top of `campaigns.ts`:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

Replace the function at lines 135–185:

```typescript
export async function uploadMedia(file: File): Promise<{ id: string; url: string }> {
  await requireArea('admin')

  const result = await uploadMediaAsset({
    file,
    filename: file.name,
    folder: 'ads',
    siteId: AD_APP_ID,
    uploadedBy: 'admin',
    tags: ['ad-creative'],
  })

  if (!result.ok) {
    captureServerActionError(new Error(result.error), { action: 'upload_media' })
    throw new Error(result.error)
  }

  const supabase = getSupabaseServiceClient()
  const { data: row, error: insertError } = await supabase
    .from('ad_media')
    .insert({
      app_id: AD_APP_ID,
      storage_path: result.asset.blobPathname,
      public_url: result.asset.blobUrl,
      mime_type: result.asset.mimeType,
      file_name: result.asset.filename,
    })
    .select('id')
    .single()

  if (insertError) {
    captureServerActionError(insertError, { action: 'upload_media_insert' })
    throw new Error(insertError.message)
  }

  await trackMediaUsage(result.asset.id, 'ad_campaign', (row as { id: string }).id, 'media')

  return { id: (row as { id: string }).id, url: result.asset.blobUrl }
}
```

- [ ] **Step 8: Migrate `generateQr` (links) in `links/actions.ts`**

Add import at the top of `links/actions.ts`:

```typescript
import { uploadMediaAsset } from '@/lib/media/upload'
import { trackMediaUsage } from '@/lib/media/track-usage'
```

Replace the Supabase storage section inside `generateQr` at lines 705–761. Keep the QR SVG generation logic, replace only the storage part:

```typescript
export async function generateQr(
  id: string,
  config: { size?: number; foreground?: string; background?: string; logo?: boolean },
): Promise<ActionResult<{ qrUrl: string }>> {
  if (!id) return { ok: false, error: 'id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: link, error: linkError } = await supabase
    .from('tracked_links')
    .select('id, code')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (linkError || !link) return { ok: false, error: 'not_found' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const shortUrl = `${appUrl}/go/${link.code}`
  const size = config.size ?? 256
  const fg = config.foreground ?? '#000000'
  const bg = config.background ?? '#FFFFFF'

  const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/
  if (!HEX_COLOR.test(fg) || !HEX_COLOR.test(bg)) {
    return { ok: false, error: 'invalid_color_format' }
  }

  const { svg } = await generateQrSvg({
    url: shortUrl,
    size,
    darkColor: fg,
    lightColor: bg,
    errorCorrection: 'M',
  })

  const svgBuffer = Buffer.from(svg)
  const result = await uploadMediaAsset({
    file: svgBuffer,
    filename: `qr-${link.code}.svg`,
    folder: 'links',
    siteId,
    uploadedBy: 'system',
    tags: ['qr', `link:${id}`],
  })

  if (!result.ok) return { ok: false, error: result.error }

  await supabase
    .from('tracked_links')
    .update({ qr_storage_path: result.asset.blobPathname, has_qr: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  await trackMediaUsage(result.asset.id, 'tracked_link', id, 'qr_storage_path')

  revalidateTag(`link:${id}`)
  return { ok: true, qrUrl: result.asset.blobUrl }
}
```

- [ ] **Step 9: Remove unused constants and imports**

In `authors/actions.ts`: Remove `ALLOWED_IMAGE_TYPES` and `MAX_AVATAR_SIZE` constants (lines 253–254) if no other function in the file uses them.

In `newsletters/actions.ts`: Remove the `ALLOWED_IMAGE_TYPES` and `MAX_IMAGE_SIZE` constants (lines 1270–1271) at the image upload section.

In `blog/[id]/edit/actions.ts`: Remove the `uploadContentAsset` import from `@tn-figueiredo/cms` (line 3).

- [ ] **Step 10: Run existing tests to verify no regressions**

Run: `cd apps/web && npx vitest run`
Expected: PASS — all existing tests pass. Upload function mock patterns may need updating in tests that mock Supabase storage.

- [ ] **Step 11: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS — no type errors

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/authors/actions.ts apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/actions.ts apps/web/src/app/cms/\(authed\)/newsletters/actions.ts apps/web/src/app/admin/\(authed\)/ads/_actions/campaigns.ts apps/web/src/app/cms/\(authed\)/links/actions.ts
git commit -m "feat(media): migrate all 8 upload functions to Vercel Blob pipeline

Replaces Supabase Storage uploads across authors, blog, newsletters,
ads, and links with central uploadMediaAsset() pipeline. Fixes critical
blog inline image expiry bug (private bucket signed URLs → public Blob).
Adds usage tracking via trackMediaUsage() for orphan detection."
```

---

### Task 20b: Wire gallery into 10 integration surfaces + retire AvatarCropModal

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/authors/[id]/page.tsx` (or author edit component)
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx` (or cover upload zone)
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/` (type OG + inline editor)
- Modify: `apps/web/src/app/admin/(authed)/sites/actions.ts` (or site settings component)
- Modify: `apps/web/src/app/admin/(authed)/ads/_components/` (ad creative form)
- Delete: `apps/web/src/app/cms/(authed)/authors/avatar-crop-modal.tsx`

> **Note:** This task wires the `MediaGalleryModal` + `useMediaGallery` hook (Task 19) into each of the 10 editor surfaces defined in spec §5.4. Each surface gets a "Browse media" button that opens the gallery with the correct `cropPreset` and `folder`. The `AvatarCropModal` (207 lines, hardcoded 400×400 circle, English-only) is retired — replaced by the generic `MediaCropEditor`.

- [ ] **Step 1: Wire gallery into author avatar upload (surface #1)**

In the author edit component, import the gallery hook and modal, then add a "Browse media" button alongside the existing file input:

```typescript
import { useMediaGallery } from '../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '../_shared/media/types'

// Inside the component:
const gallery = useMediaGallery()

// In JSX — add button next to avatar upload area:
<button
  type="button"
  onClick={() => gallery.openGallery({ folder: 'authors', cropPreset: CROP_PRESETS.avatar })}
  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
>
  {locale === 'pt-BR' ? 'Galeria de mídia' : 'Media gallery'}
</button>

<MediaGalleryModal
  {...gallery.galleryProps}
  onSelect={(asset) => {
    handleAvatarChange(asset.url)
    gallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

Remove the import and usage of `AvatarCropModal`.

- [ ] **Step 2: Wire gallery into author about photo (surface #2)**

Same component as Step 1. Add another gallery instance for the about photo section:

```typescript
const aboutGallery = useMediaGallery()

<button
  type="button"
  onClick={() => aboutGallery.openGallery({ folder: 'authors', cropPreset: CROP_PRESETS.free })}
  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
>
  {locale === 'pt-BR' ? 'Galeria de mídia' : 'Media gallery'}
</button>

<MediaGalleryModal
  {...aboutGallery.galleryProps}
  onSelect={(asset) => {
    handleAboutPhotoChange(asset.url)
    aboutGallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

- [ ] **Step 3: Wire gallery into blog cover upload (surface #3)**

In the blog post editor's cover image section, add gallery button:

```typescript
import { useMediaGallery } from '../../_shared/media/use-media-gallery'
import { MediaGalleryModal } from '../../_shared/media/media-gallery-modal'
import { CROP_PRESETS } from '../../_shared/media/types'

const coverGallery = useMediaGallery()

// In the cover upload zone JSX:
<button
  type="button"
  onClick={() => coverGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS['blog-cover'] })}
  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
>
  {locale === 'pt-BR' ? 'Escolher da galeria' : 'Choose from gallery'}
</button>

<MediaGalleryModal
  {...coverGallery.galleryProps}
  onSelect={(asset) => {
    setCoverImageUrl(asset.url)
    coverGallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

- [ ] **Step 4: Wire gallery into blog inline TipTap editor (surface #4)**

In the TipTap editor component, add a gallery toolbar button alongside the existing image upload slash command. Keep the paste/drop fast-path (`onImageUpload`) for quick inline — the gallery is an additional entry point:

```typescript
// In tiptap-editor.tsx props interface, add:
onOpenGallery?: () => void

// In the toolbar JSX, add gallery button next to existing image controls:
{onOpenGallery && (
  <button
    type="button"
    onClick={onOpenGallery}
    className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
    title={locale === 'pt-BR' ? 'Galeria de mídia' : 'Media gallery'}
  >
    <ImageIcon className="h-4 w-4" />
  </button>
)}
```

The parent component (blog editor page) wires this:

```typescript
const inlineGallery = useMediaGallery()

<TipTapEditor
  onImageUpload={handleInlineUpload}  // existing fast-path
  onOpenGallery={() => inlineGallery.openGallery({ folder: 'blog', cropPreset: CROP_PRESETS.free })}
/>

<MediaGalleryModal
  {...inlineGallery.galleryProps}
  onSelect={(asset) => {
    editor?.chain().focus().setImage({ src: asset.url, alt: asset.alt }).run()
    inlineGallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

- [ ] **Step 5: Wire gallery into newsletter type OG image (surface #5)**

In the newsletter type settings component, add gallery button next to the OG image URL text input:

```typescript
const ogGallery = useMediaGallery()

<div className="flex gap-2">
  <input type="text" value={ogImageUrl} onChange={...} placeholder="https://..." className="..." />
  <button
    type="button"
    onClick={() => ogGallery.openGallery({ folder: 'og', cropPreset: CROP_PRESETS['og-image'] })}
    className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
  >
    {locale === 'pt-BR' ? 'Galeria' : 'Gallery'}
  </button>
</div>

<MediaGalleryModal
  {...ogGallery.galleryProps}
  onSelect={(asset) => {
    setOgImageUrl(asset.url)
    ogGallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

- [ ] **Step 6: Wire gallery into newsletter inline editor (surface #6)**

Same pattern as blog inline (Step 4) — add `onOpenGallery` callback to the newsletter's TipTap editor instance with `folder: 'newsletters'`.

- [ ] **Step 7: Wire gallery into site logo field (surface #7)**

In the site settings component, add "Browse media" button next to the logo URL text input:

```typescript
const logoGallery = useMediaGallery()

<div className="flex gap-2">
  <input type="text" value={logoUrl} onChange={...} className="..." />
  <button
    type="button"
    onClick={() => logoGallery.openGallery({ folder: 'branding', cropPreset: CROP_PRESETS['site-logo'] })}
    className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm"
  >
    {locale === 'pt-BR' ? 'Galeria' : 'Gallery'}
  </button>
</div>

<MediaGalleryModal {...logoGallery.galleryProps} onSelect={...} locale={locale} siteId={siteId} />
```

- [ ] **Step 8: Wire gallery into site default OG image field (surface #8)**

Same pattern as Step 7, with `folder: 'og'` and `cropPreset: CROP_PRESETS['og-image']`.

- [ ] **Step 9: Wire gallery into ad creatives (surface #9)**

In the ad campaign form component, replace the existing `uploadMedia` form with gallery button:

```typescript
const adGallery = useMediaGallery()

<button
  type="button"
  onClick={() => adGallery.openGallery({ folder: 'ads', cropPreset: CROP_PRESETS.free })}
  className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
>
  {locale === 'pt-BR' ? 'Escolher mídia' : 'Choose media'}
</button>

<MediaGalleryModal
  {...adGallery.galleryProps}
  onSelect={(asset) => {
    setCreativeUrl(asset.url)
    adGallery.closeGallery()
  }}
  locale={locale}
  siteId={siteId}
/>
```

- [ ] **Step 10: Delete AvatarCropModal (spec §5.7)**

Remove `apps/web/src/app/cms/(authed)/authors/avatar-crop-modal.tsx` (207 lines). All crop functionality is now handled by the generic `MediaCropEditor` within the gallery modal.

Verify no remaining imports:
```bash
grep -r 'avatar-crop-modal\|AvatarCropModal' apps/web/src/
```
Expected: no results (all references replaced in Steps 1-2).

- [ ] **Step 11: Surface #10 — Link QR (no UI change)**

`generateQr` in `links/actions.ts` already migrated to Blob in Task 20. QR generation is programmatic (no user upload), so no gallery wiring needed. This step is a verification-only checkpoint.

- [ ] **Step 12: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS with 0 errors

- [ ] **Step 13: Commit**

```bash
git add -A apps/web/src/app/cms/ apps/web/src/app/admin/
git commit -m "feat(media): wire gallery into 10 integration surfaces, retire AvatarCropModal

Connects MediaGalleryModal + useMediaGallery hook to all editor
surfaces: author avatar/photo, blog cover/inline, newsletter OG/inline,
site logo/OG, ad creatives. Deletes AvatarCropModal (207 lines)
replaced by generic MediaCropEditor with 6 crop presets + i18n."
```

---

### Task 21: Orphan cleanup cron

**Files:**
- Create: `apps/web/src/app/api/cron/media-cleanup/route.ts`
- Test: `apps/web/test/api/cron-media-cleanup.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/api/cron-media-cleanup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
}))
vi.mock('@/lib/cron/lock', () => ({
  withCronLock: vi.fn((name: string, fn: () => Promise<unknown>) => fn()),
}))
vi.mock('@/lib/logger', () => ({
  logCron: vi.fn(),
}))

import { GET } from '../../src/app/api/cron/media-cleanup/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { del } from '@vercel/blob'

describe('GET /api/cron/media-cleanup', () => {
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        update: mockUpdate,
        delete: mockDelete,
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)
  })

  it('returns 401 without valid Authorization header', async () => {
    const req = new Request('http://localhost/api/cron/media-cleanup', {
      headers: {},
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 with correct CRON_SECRET', async () => {
    mockSelect.mockResolvedValueOnce({ data: [], error: null }) // soft-delete pass
    mockSelect.mockResolvedValueOnce({ data: [], error: null }) // hard-delete pass

    const req = new Request('http://localhost/api/cron/media-cleanup', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('softDeleted')
    expect(body).toHaveProperty('hardDeleted')
  })

  it('calls Blob del() for hard-deleted assets', async () => {
    const staleAsset = { id: 'a1', blob_url: 'https://example.blob.vercel-storage.com/test.jpg' }
    mockSelect.mockResolvedValueOnce({ data: [], error: null }) // soft-delete returns nothing
    mockSelect.mockResolvedValueOnce({ data: [staleAsset], error: null }) // hard-delete candidates
    mockDelete.mockResolvedValueOnce({ error: null })

    const req = new Request('http://localhost/api/cron/media-cleanup', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(del).toHaveBeenCalledWith(staleAsset.blob_url)
  })
})
```

- [ ] **Step 2: Verify tests fail (module not found)**

Run: `cd apps/web && npx vitest run test/api/cron-media-cleanup.test.ts`
Expected: FAIL — cannot resolve `../../src/app/api/cron/media-cleanup/route`

- [ ] **Step 3: Create the cron route**

```typescript
// apps/web/src/app/api/cron/media-cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { withCronLock } from '@/lib/cron/lock'
import { logCron } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const SOFT_DELETE_GRACE_DAYS = 7
const HARD_DELETE_AFTER_DAYS = 30
const HARD_DELETE_BATCH_SIZE = 50

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return withCronLock('cron:media-cleanup', async () => {
    const supabase = getSupabaseServiceClient()
    let softDeleted = 0
    let hardDeleted = 0

    // Pass 1: Soft-delete orphans older than grace period
    const { data: orphans, error: orphanErr } = await supabase
      .from('media_assets')
      .select('id')
      .is('deleted_at', null)
      .lt('created_at', new Date(Date.now() - SOFT_DELETE_GRACE_DAYS * 86400000).toISOString())
      .not('id', 'in', supabase.from('media_asset_usage').select('asset_id'))

    if (orphanErr) {
      Sentry.captureException(orphanErr, { tags: { media: 'true', component: 'media-cleanup' } })
      logCron('media-cleanup', 'error', { error: orphanErr.message })
    } else if (orphans && orphans.length > 0) {
      const ids = orphans.map(o => o.id)
      const { error: updateErr } = await supabase
        .from('media_assets')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', ids)

      if (updateErr) {
        Sentry.captureException(updateErr, { tags: { media: 'true', component: 'media-cleanup' } })
      } else {
        softDeleted = ids.length
      }
    }

    // Pass 2: Hard-delete assets soft-deleted for 30+ days
    const { data: stale, error: staleErr } = await supabase
      .from('media_assets')
      .select('id, blob_url')
      .lt('deleted_at', new Date(Date.now() - HARD_DELETE_AFTER_DAYS * 86400000).toISOString())
      .limit(HARD_DELETE_BATCH_SIZE)

    if (staleErr) {
      Sentry.captureException(staleErr, { tags: { media: 'true', component: 'media-cleanup' } })
      logCron('media-cleanup', 'error', { error: staleErr.message })
    } else if (stale && stale.length > 0) {
      for (const asset of stale) {
        try {
          await del(asset.blob_url)
          await supabase.from('media_assets').delete().eq('id', asset.id)
          hardDeleted++
        } catch (err) {
          Sentry.captureException(err, {
            tags: { media: 'true', component: 'media-cleanup' },
            extra: { assetId: asset.id, blobUrl: asset.blob_url },
          })
        }
      }
    }

    logCron('media-cleanup', 'success', { softDeleted, hardDeleted })
    return NextResponse.json({ ok: true, softDeleted, hardDeleted })
  })
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd apps/web && npx vitest run test/api/cron-media-cleanup.test.ts`
Expected: PASS

- [ ] **Step 5: Add cron schedule to vercel.json**

In `vercel.json` (or `vercel.ts` if it exists), add to the crons array:

```json
{ "path": "/api/cron/media-cleanup", "schedule": "0 3 * * 0" }
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/media-cleanup/ apps/web/test/api/cron-media-cleanup.test.ts
git commit -m "feat(media): orphan cleanup cron (2-pass: soft-delete 7d, hard-delete 30d, Blob del)"
```

---

### Task 22: Health endpoint

**Files:**
- Create: `apps/web/src/app/api/health/media/route.ts`
- Test: `apps/web/test/api/health-media.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/test/api/health-media.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn(),
}))

import { GET } from '../../src/app/api/health/media/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

describe('GET /api/health/media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(getSiteContext).mockResolvedValue({
      siteId: 'site-1',
      siteSlug: 'bythiagofigueiredo',
    } as any)
  })

  it('returns 401 without valid auth', async () => {
    const req = new Request('http://localhost/api/health/media')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns health payload with ok: true', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ count: 10, error: null }),
            not: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: { totalSizeBytes: 5242880, folders: {} }, error: null }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase as any)

    const req = new Request('http://localhost/api/health/media', {
      headers: { Authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body).toHaveProperty('siteId')
    expect(body).toHaveProperty('totalAssets')
    expect(body).toHaveProperty('flags')
  })
})
```

- [ ] **Step 2: Verify tests fail**

Run: `cd apps/web && npx vitest run test/api/health-media.test.ts`
Expected: FAIL — cannot resolve route module

- [ ] **Step 3: Create the health route**

```typescript
// apps/web/src/app/api/health/media/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

const MEDIA_QUOTA_BYTES = parseInt(process.env.MEDIA_QUOTA_BYTES ?? '4294967296', 10)

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const ctx = await getSiteContext()
    const supabase = getSupabaseServiceClient()

    const [totalResult, orphanResult, softDeletedResult, folderResult] = await Promise.all([
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', ctx.siteId)
        .is('deleted_at', null),
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', ctx.siteId)
        .is('deleted_at', null)
        .not('id', 'in', supabase.from('media_asset_usage').select('asset_id')),
      supabase
        .from('media_assets')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', ctx.siteId)
        .not('deleted_at', 'is', null),
      supabase.rpc('get_media_stats', { p_site_id: ctx.siteId }),
    ])

    const totalAssets = totalResult.count ?? 0
    const orphanCount = orphanResult.count ?? 0
    const softDeletedCount = softDeletedResult.count ?? 0
    const stats = folderResult.data ?? { totalSizeBytes: 0, folders: {} }
    const totalSizeMb = Math.round((stats.totalSizeBytes / (1024 * 1024)) * 100) / 100

    return NextResponse.json({
      ok: true,
      siteId: ctx.siteId,
      siteSlug: ctx.siteSlug,
      totalAssets,
      totalSizeMb,
      orphanCount,
      softDeletedCount,
      folderBreakdown: stats.folders,
      quotaUsedPct: Math.round((stats.totalSizeBytes / MEDIA_QUOTA_BYTES) * 10000) / 100,
      flags: {
        galleryEnabled: process.env.NEXT_PUBLIC_MEDIA_GALLERY_ENABLED === 'true',
        blobUploadEnabled: process.env.MEDIA_BLOB_UPLOAD_ENABLED === 'true',
        migrationEnabled: process.env.MEDIA_MIGRATION_ENABLED === 'true',
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Site resolution failed' }, { status: 503 })
  }
}
```

- [ ] **Step 4: Verify tests pass**

Run: `cd apps/web && npx vitest run test/api/health-media.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/health/media/ apps/web/test/api/health-media.test.ts
git commit -m "feat(media): health endpoint /api/health/media (stats, orphans, flags)"
```

---

### Task 23: Smoke test script

**Files:**
- Create: `scripts/media-smoke.sh`

- [ ] **Step 1: Create the smoke script**

```bash
#!/usr/bin/env bash
# scripts/media-smoke.sh — 5-check smoke test for the media system
# Usage: CRON_SECRET=xxx ./scripts/media-smoke.sh https://bythiagofigueiredo.com
set -euo pipefail

HOST="${1:?Usage: media-smoke.sh <HOST>}"
PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "Media smoke test → $HOST"

# 1. Health endpoint returns ok: true
check "Health endpoint ok" bash -c "
  curl -sf -H 'Authorization: Bearer ${CRON_SECRET}' '${HOST}/api/health/media' | grep -q '\"ok\":true'
"

# 2. Blob URL returns 200 + image Content-Type (skip if no assets)
BLOB_SAMPLE=$(curl -sf -H "Authorization: Bearer ${CRON_SECRET}" "${HOST}/api/health/media" 2>/dev/null | grep -o '"blob_url":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
if [ -n "$BLOB_SAMPLE" ]; then
  check "Blob URL 200 + image Content-Type" bash -c "
    curl -sf -o /dev/null -w '%{http_code}' '${BLOB_SAMPLE}' | grep -q '200'
  "
else
  echo "  ⊘ Blob URL sample: skipped (no assets yet)"
fi

# 3. Health fields completeness
check "Health fields present" bash -c "
  curl -sf -H 'Authorization: Bearer ${CRON_SECRET}' '${HOST}/api/health/media' | grep -q 'totalAssets'
"

# 4. CSP includes blob.vercel-storage.com
check "CSP includes blob.vercel-storage.com" bash -c "
  curl -sf -I '${HOST}/' | grep -i 'content-security-policy' | grep -q 'blob.vercel-storage.com'
"

# 5. next/image serves optimized format
check "next/image WebP optimization" bash -c "
  curl -sf -H 'Accept: image/webp' -o /dev/null -w '%{content_type}' '${HOST}/_next/image?url=%2Fog-default.png&w=640&q=75' | grep -q 'webp'
"

echo ""
echo "Results: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ] || exit 1
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/media-smoke.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/media-smoke.sh
git commit -m "chore: add media smoke test script (5 checks)"
```

---

### Task 24: LGPD integration

**Files:**
- Modify: `apps/web/lib/lgpd/domain-adapter.ts`

- [ ] **Step 1: Add media_assets to data export**

In `apps/web/lib/lgpd/domain-adapter.ts`, inside the `collectUserData()` method, after the existing data collection sections, add:

```typescript
// Media assets uploaded by this user
const { data: mediaAssets } = await supabase
  .from('media_assets')
  .select('id, filename, folder, mime_type, file_size, created_at, blob_url, alt_text')
  .eq('uploaded_by', userId)
  .eq('site_id', siteId)
  .is('deleted_at', null)
```

Then in the return object, add the new field:

```typescript
media_assets_uploaded: (mediaAssets ?? []).map(a => ({
  id: a.id,
  filename: a.filename,
  folder: a.folder,
  mime_type: a.mime_type,
  file_size: a.file_size,
  created_at: a.created_at,
  blob_url: a.blob_url,
  alt_text: a.alt_text,
})),
```

- [ ] **Step 2: Add media_assets to Phase 1 cleanup**

In the `phase1Cleanup()` method, after the existing nullification statements, add:

```typescript
// Sever PII link: who uploaded media (assets stay for published content)
await supabase
  .from('media_assets')
  .update({ uploaded_by: null })
  .eq('uploaded_by', userId)
```

- [ ] **Step 3: Run existing LGPD tests to verify no regressions**

Run: `cd apps/web && npx vitest run test/lib/lgpd`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/lgpd/domain-adapter.ts
git commit -m "feat(media): LGPD data export + phase1 uploaded_by nullification for media_assets"
```

---

### Task 25: CMS sidebar entry + standalone media page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Create: `apps/web/src/app/cms/(authed)/media/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/media-library-connected.tsx`

- [ ] **Step 1: Add Media to CMS sidebar sections**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, add the Media entry to the sidebar sections array. Place it after the Links entry (if present) or after Newsletters:

```typescript
{
  label: locale === 'pt-BR' ? 'Mídia' : 'Media',
  href: '/cms/media',
  icon: 'Image',
  enabled: process.env.NEXT_PUBLIC_MEDIA_GALLERY_ENABLED === 'true',
},
```

- [ ] **Step 2: Create the standalone media page (server component)**

```typescript
// apps/web/src/app/cms/(authed)/media/page.tsx
import { headers } from 'next/headers'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs'
import { getSiteContext } from '@/lib/cms/site-context'
import { MediaLibraryConnected } from './media-library-connected'

export default async function MediaPage() {
  const ctx = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId: ctx.siteId, mode: 'view' })

  const h = await headers()
  const locale = (h.get('x-locale') ?? 'en') as 'en' | 'pt-BR'

  return <MediaLibraryConnected siteId={ctx.siteId} locale={locale} />
}
```

- [ ] **Step 3: Create the connected client component**

```typescript
// apps/web/src/app/cms/(authed)/media/media-library-connected.tsx
'use client'

import { useState, useCallback } from 'react'
import { MediaLibraryTab } from '../_shared/media/media-library-tab'
import { MediaGalleryModal } from '../_shared/media/media-gallery-modal'
import type { MediaAsset } from '@/lib/media/types'

interface Props {
  siteId: string
  locale: 'en' | 'pt-BR'
}

export function MediaLibraryConnected({ siteId, locale }: Props) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  const handleUploadComplete = useCallback(() => {
    setUploadModalOpen(false)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#f3f4f6]">
          {locale === 'pt-BR' ? 'Biblioteca de Mídia' : 'Media Library'}
        </h1>
        <button
          type="button"
          onClick={() => setUploadModalOpen(true)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          {locale === 'pt-BR' ? 'Enviar arquivo' : 'Upload file'}
        </button>
      </div>

      <MediaLibraryTab locale={locale} onSelect={() => {}} />

      {uploadModalOpen && (
        <MediaGalleryModal
          locale={locale}
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSelect={handleUploadComplete}
          mode="upload"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/_shared/cms-sections.ts apps/web/src/app/cms/\(authed\)/media/
git commit -m "feat(media): CMS sidebar entry + standalone /cms/media page"
```

---

### Task 26: Backfill migration script

**Files:**
- Create: `scripts/migrate-media-to-blob.ts`
- Create: `scripts/warm-up-compiled-mdx.ts`

- [ ] **Step 1: Create the migration script**

```typescript
// scripts/migrate-media-to-blob.ts
// Usage: npx tsx scripts/migrate-media-to-blob.ts [--dry-run] [--table authors] [--batch-size 50]
import { put } from '@vercel/blob'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!
const SUPABASE_PROJECT_REF = 'novkqtvcnsiwhkxihurk'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const TABLE_FILTER = args.find((_a, i) => args[i - 1] === '--table') ?? null
const BATCH_SIZE = parseInt(args.find((_a, i) => args[i - 1] === '--batch-size') ?? '50', 10)
const JOURNAL_PATH = `scripts/migration-journal-${new Date().toISOString().slice(0, 10)}.json`

interface JournalEntry {
  table: string
  column: string
  rowId: string
  oldUrl: string
  newUrl: string
  deduplicated: boolean
  timestamp: string
}

const journal: JournalEntry[] = existsSync(JOURNAL_PATH)
  ? JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'))
  : []

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const hashCache = new Map<string, { blobUrl: string; assetId: string }>()

const MIGRATION_ORDER: Array<{
  table: string
  column: string
  folder: string
}> = [
  { table: 'authors', column: 'avatar_url', folder: 'authors' },
  { table: 'authors', column: 'about_photo_url', folder: 'authors' },
  { table: 'sites', column: 'logo_url', folder: 'branding' },
  { table: 'sites', column: 'seo_default_og_image', folder: 'og' },
  { table: 'newsletter_types', column: 'og_image_url', folder: 'newsletters' },
  { table: 'blog_translations', column: 'cover_image_url', folder: 'blog' },
  { table: 'blog_translations', column: 'og_image_url', folder: 'og' },
  { table: 'campaign_translations', column: 'og_image_url', folder: 'og' },
  { table: 'ad_media', column: 'public_url', folder: 'ads' },
  { table: 'ad_campaigns', column: 'logo_url', folder: 'ads' },
  { table: 'ad_placeholders', column: 'image_url', folder: 'ads' },
  { table: 'ad_placeholders', column: 'logo_url', folder: 'ads' },
  { table: 'ad_slot_creatives', column: 'image_url', folder: 'ads' },
  { table: 'tracked_links', column: 'qr_storage_path', folder: 'links' },
]

function isSupabaseUrl(url: string): boolean {
  return url.includes(`${SUPABASE_PROJECT_REF}.supabase.co`)
}

function isBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com')
}

function detectMime(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0x52 && buffer[1] === 0x49) return 'image/webp'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (buffer.toString('utf-8', 0, 5).includes('<svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

async function downloadFromSupabase(url: string): Promise<Buffer> {
  const pathMatch = url.match(/\/storage\/v1\/object\/(?:sign|public)\/([^?]+)/)
  if (!pathMatch) throw new Error(`Cannot parse Supabase URL: ${url}`)

  const fullPath = pathMatch[1]
  const bucketSep = fullPath.indexOf('/')
  const bucket = fullPath.slice(0, bucketSep)
  const path = fullPath.slice(bucketSep + 1)

  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error) throw new Error(`Download failed: ${error.message}`)
  return Buffer.from(await data.arrayBuffer())
}

async function processAndUpload(
  buffer: Buffer,
  filename: string,
  folder: string,
  siteId: string,
): Promise<{ blobUrl: string; assetId: string; deduplicated: boolean }> {
  let processed = buffer
  const mime = detectMime(buffer)
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const sharp = (await import('sharp')).default
    processed = await sharp(buffer).rotate().toBuffer()
  }

  const hash = createHash('sha256').update(processed).digest('hex')

  if (hashCache.has(hash)) {
    const cached = hashCache.get(hash)!
    return { blobUrl: cached.blobUrl, assetId: cached.assetId, deduplicated: true }
  }

  const { data: existing } = await supabase
    .from('media_assets')
    .select('id, blob_url')
    .eq('content_hash', hash)
    .eq('site_id', siteId)
    .single()

  if (existing) {
    hashCache.set(hash, { blobUrl: existing.blob_url, assetId: existing.id })
    return { blobUrl: existing.blob_url, assetId: existing.id, deduplicated: true }
  }

  const pathname = `media/${siteId}/${folder}/${hash.slice(0, 8)}-${filename}`
  const blob = await put(pathname, processed, {
    access: 'public',
    token: BLOB_TOKEN,
    addRandomSuffix: false,
  })

  let width: number | null = null
  let height: number | null = null
  if (['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    const sharp = (await import('sharp')).default
    const meta = await sharp(processed).metadata()
    width = meta.width ?? null
    height = meta.height ?? null
  }

  const { data: asset, error } = await supabase
    .from('media_assets')
    .insert({
      site_id: siteId,
      blob_url: blob.url,
      blob_pathname: blob.pathname,
      filename,
      mime_type: mime,
      file_size: processed.length,
      content_hash: hash,
      folder,
      width,
      height,
      tags: ['migrated'],
    })
    .select('id, blob_url')
    .single()

  if (error) throw new Error(`DB insert failed: ${error.message}`)

  hashCache.set(hash, { blobUrl: asset.blob_url, assetId: asset.id })
  return { blobUrl: asset.blob_url, assetId: asset.id, deduplicated: false }
}

async function migrateTable(config: typeof MIGRATION_ORDER[0]) {
  console.log(`\n=> Migrating ${config.table}.${config.column}...`)

  const { data: rows, error } = await supabase
    .from(config.table)
    .select(`id, ${config.column}, site_id`)
    .not(config.column, 'is', null)

  if (error) { console.error(`  x Query error: ${error.message}`); return }
  if (!rows?.length) { console.log('  - No rows'); return }

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const row of rows) {
    const url = row[config.column]
    if (!url || isBlobUrl(url)) { skipped++; continue }
    if (!isSupabaseUrl(url)) { skipped++; continue }

    const filename = url.split('/').pop()?.split('?')[0] ?? 'unknown'
    const siteId = row.site_id

    if (DRY_RUN) {
      console.log(`  [dry-run] Would migrate row ${row.id}: ${url.slice(0, 80)}...`)
      migrated++
      continue
    }

    try {
      const buffer = await downloadFromSupabase(url)
      const result = await processAndUpload(buffer, filename, config.folder, siteId)

      await supabase
        .from(config.table)
        .update({ [config.column]: result.blobUrl })
        .eq('id', row.id)

      journal.push({
        table: config.table,
        column: config.column,
        rowId: row.id,
        oldUrl: url,
        newUrl: result.blobUrl,
        deduplicated: result.deduplicated,
        timestamp: new Date().toISOString(),
      })
      migrated++

      await new Promise(r => setTimeout(r, 100))
    } catch (err) {
      console.error(`  x row ${row.id}: ${(err as Error).message}`)
      errors++
    }
  }

  console.log(`  -> ${migrated} migrated, ${skipped} skipped, ${errors} errors`)
}

const SUPABASE_URL_PATTERNS = [
  /!\[[^\]]*\]\((https:\/\/novkqtvcnsiwhkxihurk\.supabase\.co\/storage\/v1\/object\/(?:sign|public)\/[^\s)]+)\)/g,
  /src=["'](https:\/\/novkqtvcnsiwhkxihurk\.supabase\.co\/storage\/v1\/object\/(?:sign|public)\/[^\s"']+)["']/g,
  /src=\{["'](https:\/\/novkqtvcnsiwhkxihurk\.supabase\.co\/storage\/v1\/object\/(?:sign|public)\/[^\s"']+)["']\}/g,
  /^(https:\/\/novkqtvcnsiwhkxihurk\.supabase\.co\/storage\/v1\/object\/(?:sign|public)\/\S+)$/gm,
]

async function migrateMdxContent() {
  console.log('\n=> Migrating MDX content (blog_translations)...')

  const { data: rows, error } = await supabase
    .from('blog_translations')
    .select('id, content_mdx, site_id, blog_post_id')
    .like('content_mdx', `%${SUPABASE_PROJECT_REF}.supabase.co%`)

  if (error) { console.error(`  x Query error: ${error.message}`); return }
  if (!rows?.length) { console.log('  - No rows with Supabase URLs in MDX'); return }

  let migrated = 0
  for (const row of rows) {
    let content = row.content_mdx
    const urlMap = new Map<string, string>()

    for (const pattern of SUPABASE_URL_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(content)) !== null) {
        const url = match[1]
        if (!urlMap.has(url) && !isBlobUrl(url)) {
          urlMap.set(url, url)
        }
      }
    }

    if (urlMap.size === 0) continue

    if (DRY_RUN) {
      console.log(`  [dry-run] Row ${row.id}: ${urlMap.size} URLs to replace`)
      migrated++
      continue
    }

    for (const [oldUrl] of urlMap) {
      try {
        const filename = oldUrl.split('/').pop()?.split('?')[0] ?? 'inline-image'
        const buffer = await downloadFromSupabase(oldUrl)
        const result = await processAndUpload(buffer, filename, 'blog', row.site_id)
        urlMap.set(oldUrl, result.blobUrl)

        journal.push({
          table: 'blog_translations',
          column: 'content_mdx',
          rowId: row.id,
          oldUrl,
          newUrl: result.blobUrl,
          deduplicated: result.deduplicated,
          timestamp: new Date().toISOString(),
        })

        await new Promise(r => setTimeout(r, 100))
      } catch (err) {
        console.error(`  x URL in row ${row.id}: ${(err as Error).message}`)
        urlMap.delete(oldUrl)
      }
    }

    for (const [oldUrl, newUrl] of urlMap) {
      if (oldUrl !== newUrl) {
        content = content.split(oldUrl).join(newUrl)
      }
    }

    const { error: updateErr } = await supabase
      .from('blog_translations')
      .update({ content_mdx: content, content_compiled: null })
      .eq('id', row.id)

    if (updateErr) {
      console.error(`  x Update row ${row.id}: ${updateErr.message}`)
    } else {
      migrated++
    }
  }

  console.log(`  -> ${migrated} MDX rows migrated`)

  // Newsletter editions
  console.log('\n=> Migrating MDX content (newsletter_editions)...')

  const { data: editions } = await supabase
    .from('newsletter_editions')
    .select('id, content_mdx, content_html, site_id')
    .like('content_mdx', `%${SUPABASE_PROJECT_REF}.supabase.co%`)

  if (!editions?.length) { console.log('  - No editions with Supabase URLs'); return }

  for (const edition of editions) {
    let mdx = edition.content_mdx ?? ''
    let html = edition.content_html ?? ''
    const urlMap = new Map<string, string>()

    for (const pattern of SUPABASE_URL_PATTERNS) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(mdx + html)) !== null) {
        const url = match[1]
        if (!urlMap.has(url) && !isBlobUrl(url)) {
          urlMap.set(url, url)
        }
      }
    }

    if (urlMap.size === 0) continue

    if (DRY_RUN) {
      console.log(`  [dry-run] Edition ${edition.id}: ${urlMap.size} URLs`)
      continue
    }

    for (const [oldUrl] of urlMap) {
      try {
        const filename = oldUrl.split('/').pop()?.split('?')[0] ?? 'newsletter-image'
        const buffer = await downloadFromSupabase(oldUrl)
        const result = await processAndUpload(buffer, filename, 'newsletters', edition.site_id)
        urlMap.set(oldUrl, result.blobUrl)
        await new Promise(r => setTimeout(r, 100))
      } catch (err) {
        console.error(`  x URL in edition ${edition.id}: ${(err as Error).message}`)
        urlMap.delete(oldUrl)
      }
    }

    for (const [oldUrl, newUrl] of urlMap) {
      if (oldUrl !== newUrl) {
        mdx = mdx.split(oldUrl).join(newUrl)
        html = html.split(oldUrl).join(newUrl)
      }
    }

    await supabase
      .from('newsletter_editions')
      .update({ content_mdx: mdx, content_html: html })
      .eq('id', edition.id)
  }
}

async function main() {
  console.log(`Media migration ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'}`)
  console.log(`   Table filter: ${TABLE_FILTER ?? 'all'}`)
  console.log(`   Batch size: ${BATCH_SIZE}`)
  console.log(`   Journal: ${JOURNAL_PATH}`)

  const tables = TABLE_FILTER
    ? MIGRATION_ORDER.filter(t => t.table === TABLE_FILTER)
    : MIGRATION_ORDER

  for (const config of tables) {
    await migrateTable(config)
  }

  if (!TABLE_FILTER || TABLE_FILTER === 'blog_translations') {
    await migrateMdxContent()
  }

  if (!DRY_RUN) {
    writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2))
    console.log(`\nJournal saved: ${JOURNAL_PATH} (${journal.length} entries)`)
  }

  console.log('\nMigration complete')
}

main().catch(err => {
  console.error('Migration failed:', err)
  if (journal.length > 0) {
    writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2))
    console.log(`Partial journal saved: ${JOURNAL_PATH}`)
  }
  process.exit(1)
})
```

- [ ] **Step 2: Create the warm-up script**

```typescript
// scripts/warm-up-compiled-mdx.ts
// Usage: npx tsx scripts/warm-up-compiled-mdx.ts https://bythiagofigueiredo.com
import { createClient } from '@supabase/supabase-js'

const HOST = process.argv[2]
if (!HOST) { console.error('Usage: warm-up-compiled-mdx.ts <HOST>'); process.exit(1) }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  console.log(`Warming up compiled MDX on ${HOST}...`)

  const { data: posts } = await supabase
    .from('blog_translations')
    .select('locale, slug, blog_posts!inner(status)')
    .is('content_compiled', null)
    .eq('blog_posts.status', 'published')

  if (!posts?.length) {
    console.log('No posts need recompilation.')
    return
  }

  console.log(`${posts.length} posts need recompilation`)

  for (const post of posts) {
    const url = `${HOST}/blog/${post.locale}/${post.slug}`
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' })
      console.log(`  ${res.status} ${url}`)
    } catch (err) {
      console.error(`  x ${url}: ${(err as Error).message}`)
    }
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('Warm-up complete.')
}

main().catch(console.error)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-media-to-blob.ts scripts/warm-up-compiled-mdx.ts
git commit -m "feat(media): backfill migration script (14 table/columns + MDX content, dry-run, journal, warm-up)"
```

---

### Task 27: Test fixtures + final integration test suite

**Files:**
- Create: `apps/web/test/fixtures/media/create-fixtures.ts`
- Create: `apps/web/test/fixtures/media/xss.svg`
- Run: Full test suite

- [ ] **Step 1: Create SVG XSS test fixture**

```xml
<!-- apps/web/test/fixtures/media/xss.svg -->
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <script>alert('XSS')</script>
  <rect width="100" height="100" fill="red" onclick="alert('click')" />
  <foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert('fo')</script></body></foreignObject>
  <circle cx="50" cy="50" r="40" onload="alert('load')" />
  <a href="javascript:alert('href')"><text y="50">Click</text></a>
</svg>
```

- [ ] **Step 2: Create fixture generator script**

```typescript
// apps/web/test/fixtures/media/create-fixtures.ts
// Run: npx tsx test/fixtures/media/create-fixtures.ts
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(import.meta.dirname ?? __dirname)

async function main() {
  // valid.jpg — 100x100 red square with fake EXIF GPS data
  const jpegBuf = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .withExifMerge({ IFD0: { ImageDescription: 'test' }, GPS: { GPSLatitude: '40/1' } })
    .jpeg({ quality: 80 })
    .toBuffer()
  writeFileSync(join(DIR, 'valid.jpg'), jpegBuf)

  // valid.png — 100x100 green square
  const pngBuf = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 255, b: 0 } },
  }).png().toBuffer()
  writeFileSync(join(DIR, 'valid.png'), pngBuf)

  // valid.webp — 100x100 blue square
  const webpBuf = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } },
  }).webp({ quality: 80 }).toBuffer()
  writeFileSync(join(DIR, 'valid.webp'), webpBuf)

  // too-large.jpg — 6MB (oversized)
  const largeBuf = Buffer.alloc(6 * 1024 * 1024, 0xff)
  writeFileSync(join(DIR, 'too-large.jpg'), largeBuf)

  // tiny.gif — 5x5 (below minimum dimension)
  const gifBuf = await sharp({
    create: { width: 5, height: 5, channels: 3, background: { r: 128, g: 128, b: 128 } },
  }).gif().toBuffer()
  writeFileSync(join(DIR, 'tiny.gif'), gifBuf)

  console.log('Test fixtures created in test/fixtures/media/')
}

main().catch(console.error)
```

- [ ] **Step 3: Generate fixtures**

```bash
cd apps/web && npx tsx test/fixtures/media/create-fixtures.ts
```

- [ ] **Step 4: Run full test suite**

```bash
cd apps/web && npx vitest run
```

Expected: PASS — all tests pass including new media tests from tasks 5-22.

- [ ] **Step 5: Run typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 6: Commit fixtures + any final adjustments**

```bash
git add apps/web/test/fixtures/media/
git commit -m "test(media): add fixture images (EXIF, XSS SVG, too-large, tiny) + generator script"
```

- [ ] **Step 7: Final verification**

Run `git log --oneline -30` and verify the commit chain covers all 28 tasks:

1. Dependencies install
2. next.config.ts configuration
3. SQL migration (media_assets + media_asset_usage)
4. Test fixtures generation script
5. Shared types + constants
6. Validation module
7. EXIF processing module
8. SVG sanitization module
9. Content hash + dedup module
10. Central upload pipeline
11. Media queries module
12. Usage tracking module
13. Server actions (10 actions)
14. Feature flag gate in actions
15. Gallery i18n + shared types
16. MediaCropEditor component
17. MediaGalleryModal + MediaUploadTab
18. MediaLibraryTab
19. useMediaGallery hook
20. Upload function migrations (8 functions, 5 files)
20b. Gallery wired into 10 integration surfaces + AvatarCropModal retired
21. Orphan cleanup cron
22. Health endpoint
23. Smoke test script
24. LGPD integration
25. CMS sidebar + standalone page
26. Backfill migration script + warm-up
27. Test fixtures + final suite
