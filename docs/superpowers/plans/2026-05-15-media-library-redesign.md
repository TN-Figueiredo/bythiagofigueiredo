# Media Library Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic `/cms/media` page with a Visual & Contextual redesign featuring type-colored cards, detail panel, storage visualization, bulk actions, lightbox, keyboard navigation, and fix the critical `media_asset_usage` tracking gaps.

**Architecture:** New `MediaLibraryPage` client component with `useReducer` state management, 16 focused `_components/` files, shared `MediaCard`/`MediaGrid` reused by both standalone page and `MediaGalleryModal` (via `compact` prop). Data layer extended with usage-aware list query and type resolution. No DB migrations needed.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, TypeScript 5 (strict), Vitest + Testing Library, Supabase (existing schema), `cms-*` design tokens from `@tn-figueiredo/cms-ui`.

---

## File Structure

```
apps/web/src/app/cms/(authed)/media/
├── page.tsx                              # Server component (MODIFY — swap to new page component)
├── actions.ts                            # Server actions (MODIFY — add pipeline_item to UsageResourceTypes, add getAssetUsagesAction)
├── media-library-page.tsx                # CREATE — full-page client component
├── media-library-reducer.ts              # CREATE — useReducer state + actions
└── _components/
    ├── storage-bar.tsx                   # CREATE — storage visualization + legend
    ├── media-toolbar.tsx                 # CREATE — unified toolbar (search, filters, sort, view, density)
    ├── media-grid.tsx                    # CREATE — grid view container
    ├── media-card.tsx                    # CREATE — individual card (type-colored, hover overlay, badges)
    ├── media-list.tsx                    # CREATE — list view + rows
    ├── detail-panel.tsx                  # CREATE — slide-in panel with tabs
    ├── detail-tabs.tsx                   # CREATE — Details/Usage/History tab content
    ├── media-lightbox.tsx                # CREATE — fullscreen lightbox with prev/next
    ├── bulk-action-bar.tsx               # CREATE — bulk operations bar
    ├── delete-confirm-modal.tsx          # CREATE — delete confirmation with usage warning
    ├── context-menu.tsx                  # CREATE — right-click card menu
    ├── drop-overlay.tsx                  # CREATE — drag & drop overlay
    ├── empty-state.tsx                   # CREATE — context-aware empty states
    └── skeleton-grid.tsx                 # CREATE — loading skeleton

> **Deferred to future sprint:** `upload-progress.tsx` (multi-file queue UI) and `keyboard-shortcuts.tsx` (? panel) — spec sections noted as optional/future.

apps/web/src/app/cms/(authed)/_shared/media/
├── types.ts                              # MODIFY — add MediaAssetType, type colors, EnrichedMediaAsset
├── media-gallery-modal.tsx               # MODIFY — refactor to use shared MediaGrid/MediaCard
├── _i18n/types.ts                        # MODIFY — extend MediaGalleryStrings interface
├── _i18n/en.ts                           # MODIFY — add new strings
└── _i18n/pt-BR.ts                        # MODIFY — add new strings

apps/web/lib/media/
├── types.ts                              # MODIFY — add MediaAssetType export
├── queries.ts                            # MODIFY — add listMediaAssetsWithUsage
└── resolve-type.ts                       # CREATE — resolveAssetType logic

apps/web/src/app/cms/(authed)/media/actions.ts                  # MODIFY — add pipeline_item, getAssetUsagesAction
apps/web/src/app/cms/(authed)/posts/_components/tabs/images-tab.tsx    # MODIFY — add trackMediaUsageAction calls
apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx  # MODIFY — add trackMediaUsageAction call
apps/web/src/app/admin/(authed)/sites/gallery-url-field.tsx            # MODIFY — add trackMediaUsageAction calls
apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx # MODIFY — add trackMediaUsageAction calls

apps/web/test/lib/media/resolve-type.test.ts    # CREATE — resolveAssetType unit tests
apps/web/test/cms/media-library-reducer.test.ts  # CREATE — reducer unit tests
apps/web/test/cms/media-card.test.tsx            # CREATE — MediaCard component tests
apps/web/test/cms/media-library-page.test.tsx    # CREATE — full page component tests
```

---

### Task 1: Extend Types — MediaAssetType, Type Colors, EnrichedMediaAsset

**Files:**
- Modify: `apps/web/lib/media/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/_shared/media/types.ts`

- [ ] **Step 1: Add `MediaAssetType` to `lib/media/types.ts`**

At the bottom of `apps/web/lib/media/types.ts`, after the `mimeToExt` function, add:

```typescript
export type MediaAssetType = 'cover' | 'inline' | 'avatar' | 'og' | 'orphan'
```

- [ ] **Step 2: Extend `_shared/media/types.ts` with type colors and EnrichedMediaAsset**

At the bottom of `apps/web/src/app/cms/(authed)/_shared/media/types.ts`, add:

```typescript
import type { MediaAssetType } from '@/lib/media/types'

export type { MediaAssetType }

export const TYPE_COLORS: Record<MediaAssetType, { border: string; badge: string; bg: string; label: string }> = {
  cover:  { border: 'border-l-blue-500',   badge: 'bg-blue-500/15 text-blue-400',   bg: 'bg-blue-500', label: 'Cover' },
  inline: { border: 'border-l-green-500',  badge: 'bg-green-500/15 text-green-400',  bg: 'bg-green-500', label: 'Inline' },
  avatar: { border: 'border-l-purple-500', badge: 'bg-purple-500/15 text-purple-400', bg: 'bg-purple-500', label: 'Avatar' },
  og:     { border: 'border-l-orange-500', badge: 'bg-orange-500/15 text-orange-400', bg: 'bg-orange-500', label: 'OG' },
  orphan: { border: 'border-l-red-500',    badge: 'bg-red-500/15 text-red-400',       bg: 'bg-red-500', label: 'Unused' },
}

export interface EnrichedMediaAsset {
  asset: import('@/lib/media/types').MediaAsset
  type: MediaAssetType
  usageCount: number
  primaryFieldName: string | null
}

export type MediaViewMode = 'grid' | 'list'
export type MediaSortOption = 'newest' | 'oldest' | 'largest' | 'smallest' | 'name'
export type MediaColumnCount = 2 | 3 | 4
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/media/types.ts apps/web/src/app/cms/(authed)/_shared/media/types.ts
git commit -m "feat(media): add MediaAssetType, type colors, and EnrichedMediaAsset types"
```

---

### Task 2: Add `resolveAssetType` with TDD

**Files:**
- Create: `apps/web/lib/media/resolve-type.ts`
- Test: `apps/web/test/lib/media/resolve-type.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/lib/media/resolve-type.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveAssetType } from '@/lib/media/resolve-type'

describe('resolveAssetType', () => {
  it('returns orphan when usageCount is 0', () => {
    expect(resolveAssetType('blog', 0, null)).toBe('orphan')
    expect(resolveAssetType('general', 0, null)).toBe('orphan')
    expect(resolveAssetType('authors', 0, null)).toBe('orphan')
  })

  it('returns avatar for authors folder', () => {
    expect(resolveAssetType('authors', 1, 'avatar')).toBe('avatar')
    expect(resolveAssetType('authors', 3, null)).toBe('avatar')
  })

  it('returns og for og folder', () => {
    expect(resolveAssetType('og', 1, 'og_image')).toBe('og')
    expect(resolveAssetType('og', 2, null)).toBe('og')
  })

  it('returns inline for blog folder with inline_image field', () => {
    expect(resolveAssetType('blog', 1, 'inline_image')).toBe('inline')
    expect(resolveAssetType('blog', 1, 'content_inline')).toBe('inline')
  })

  it('returns cover for blog folder with cover_image field', () => {
    expect(resolveAssetType('blog', 1, 'cover_image')).toBe('cover')
  })

  it('returns cover for blog folder with no field info', () => {
    expect(resolveAssetType('blog', 1, null)).toBe('cover')
  })

  it('returns cover for branding folder', () => {
    expect(resolveAssetType('branding', 1, 'logo_url')).toBe('cover')
  })

  it('returns inline for newsletters folder', () => {
    expect(resolveAssetType('newsletters', 1, 'content_inline')).toBe('inline')
  })

  it('returns inline for pipeline folder', () => {
    expect(resolveAssetType('pipeline', 1, 'cover_image')).toBe('inline')
  })

  it('returns inline for unknown folders', () => {
    expect(resolveAssetType('general', 1, null)).toBe('inline')
    expect(resolveAssetType('ads', 1, null)).toBe('inline')
    expect(resolveAssetType('links', 1, null)).toBe('inline')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/lib/media/resolve-type.test.ts`
Expected: FAIL — module `@/lib/media/resolve-type` not found

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/media/resolve-type.ts`:

```typescript
import type { MediaFolder, MediaAssetType } from './types'

const INLINE_FIELD_NAMES = new Set(['inline_image', 'content_inline'])

const FOLDER_TO_TYPE: Record<string, MediaAssetType> = {
  authors: 'avatar',
  og: 'og',
  branding: 'cover',
  newsletters: 'inline',
  pipeline: 'inline',
  ads: 'inline',
  links: 'inline',
  general: 'inline',
}

export function resolveAssetType(
  folder: MediaFolder | string,
  usageCount: number,
  primaryFieldName: string | null,
): MediaAssetType {
  if (usageCount === 0) return 'orphan'
  if (folder === 'authors') return 'avatar'
  if (folder === 'og') return 'og'
  if (folder === 'blog') {
    return primaryFieldName && INLINE_FIELD_NAMES.has(primaryFieldName) ? 'inline' : 'cover'
  }
  return FOLDER_TO_TYPE[folder] ?? 'inline'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/lib/media/resolve-type.test.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/media/resolve-type.ts apps/web/test/lib/media/resolve-type.test.ts
git commit -m "feat(media): add resolveAssetType with TDD"
```

---

### Task 3: Add `listMediaAssetsWithUsage` Query

**Files:**
- Modify: `apps/web/lib/media/queries.ts`

- [ ] **Step 1: Add `ListMediaWithUsageResult` type and query**

At the bottom of `apps/web/lib/media/queries.ts`, add:

```typescript
export interface MediaAssetWithUsage extends MediaAssetRow {
  usage_count: number
  primary_field_name: string | null
}

export interface ListMediaWithUsageResult {
  assets: MediaAssetWithUsage[]
  nextCursor: string | null
}

export async function listMediaAssetsWithUsage(opts: ListMediaOptions): Promise<ListMediaWithUsageResult> {
  const supabase = getSupabaseServiceClient()
  const limit = opts.limit ?? 24

  let query = supabase
    .from('media_assets')
    .select(`
      *,
      media_asset_usage(field_name)
    `)
    .eq('site_id', opts.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (!opts.includeDeleted) {
    query = query.is('deleted_at', null)
  }
  if (opts.folder) {
    query = query.eq('folder', opts.folder)
  }
  if (opts.search) {
    const escaped = opts.search.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('filename', `%${escaped}%`)
  }
  if (opts.tags?.length) {
    query = query.contains('tags', opts.tags)
  }
  if (opts.cursor) {
    const pipeIdx = opts.cursor.indexOf('|')
    if (pipeIdx > 0) {
      const ts = opts.cursor.slice(0, pipeIdx)
      const id = opts.cursor.slice(pipeIdx + 1)
      query = query.or(`created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${id})`)
    } else {
      query = query.lt('created_at', opts.cursor)
    }
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<MediaAssetRow & { media_asset_usage: Array<{ field_name: string }> }>
  const hasMore = rows.length > limit
  const sliced = hasMore ? rows.slice(0, limit) : rows

  const assets: MediaAssetWithUsage[] = sliced.map((row) => {
    const usages = row.media_asset_usage ?? []
    const { media_asset_usage: _, ...rest } = row
    return {
      ...rest,
      usage_count: usages.length,
      primary_field_name: usages.length > 0 ? usages[0].field_name : null,
    }
  })

  const last = hasMore ? assets[assets.length - 1] : null
  const nextCursor = last ? `${last.created_at}|${last.id}` : null

  return { assets, nextCursor }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/media/queries.ts
git commit -m "feat(media): add listMediaAssetsWithUsage query with usage join"
```

---

### Task 4: Add `getAssetUsagesAction` and `pipeline_item` Resource Type

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/media/actions.ts`

- [ ] **Step 1: Add `pipeline_item` to `UsageResourceTypes`**

In `apps/web/src/app/cms/(authed)/media/actions.ts`, find the `UsageResourceTypes` array and add `'pipeline_item'`:

```typescript
const UsageResourceTypes = [
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
  'tracked_link',
  'pipeline_item',
] as const
```

- [ ] **Step 2: Add `listMediaAssetsWithUsageAction` and `getAssetUsagesAction`**

Add new import at the top of `actions.ts`:

```typescript
import { listMediaAssetsWithUsage } from '@/lib/media/queries'
import { getAssetUsages } from '@/lib/media/track-usage'
import { resolveAssetType } from '@/lib/media/resolve-type'
import { toMediaAsset, type MediaAsset, type MediaAssetType } from '@/lib/media/types'
import type { EnrichedMediaAsset } from '../_shared/media/types'
```

Replace the `toMediaAsset` import from `@/lib/media/types` (remove the duplicate). Then add at the bottom:

```typescript
// ─── 11. listMediaAssetsWithUsageAction ────────────────────────────────────

export type { EnrichedMediaAsset } from '../_shared/media/types'

export async function listMediaAssetsWithUsageAction(
  filters: z.input<typeof ListFiltersSchema> = {},
): Promise<ActionResult<{ assets: EnrichedMediaAsset[]; nextCursor: string | null }>> {
  try {
    const { siteId } = await requireViewScope()
    const parsed = ListFiltersSchema.safeParse(filters)
    if (!parsed.success) return { ok: false, error: 'validation_failed' }

    const result = await listMediaAssetsWithUsage({ siteId, ...parsed.data })
    const assets: EnrichedMediaAsset[] = result.assets.map((row) => ({
      asset: toMediaAsset(row),
      type: resolveAssetType(row.folder, row.usage_count, row.primary_field_name),
      usageCount: row.usage_count,
      primaryFieldName: row.primary_field_name,
    }))
    return { ok: true, assets, nextCursor: result.nextCursor }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}

// ─── 12. getAssetUsagesAction ──────────────────────────────────────────────

export async function getAssetUsagesAction(
  assetId: string,
): Promise<ActionResult<{ usages: Array<{ resourceType: string; resourceId: string; fieldName: string }> }>> {
  try {
    if (!z.string().uuid().safeParse(assetId).success) return { ok: false, error: 'invalid_id' }
    await requireViewScope()
    const usages = await getAssetUsages(assetId)
    return { ok: true, usages }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { media: 'true', component: 'media-gallery' },
    })
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'unknown_error',
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/actions.ts
git commit -m "feat(media): add pipeline_item resource type, listWithUsage and getUsages actions"
```

---

### Task 5: Fix Usage Tracking Gaps (7 Call Sites)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/posts/_components/tabs/images-tab.tsx`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx`
- Modify: `apps/web/src/app/admin/(authed)/sites/gallery-url-field.tsx`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`

> **Important:** Each file's `onSelect` callback must call `trackMediaUsageAction` after the asset URL is saved. Follow the established pattern from `edition-editor.tsx`: fire-and-forget with `.catch(() => {})`.

- [ ] **Step 1: Fix `images-tab.tsx` — blog cover_image and og_image**

Find the `onSelect` callback for the cover image gallery. Add the import and tracking call:

Add import at the top:
```typescript
import { trackMediaUsageAction } from '../../../media/actions'
```

In the cover image `handleCoverSelect` (or the inline `onSelect` for cover), after the line that saves the URL, add:
```typescript
trackMediaUsageAction(asset.id, 'blog_post', postId, 'cover_image').catch(() => {})
```

For the OG image gallery's `onSelect`, after the line that saves the OG URL, add:
```typescript
trackMediaUsageAction(asset.id, 'blog_post', postId, 'og_image').catch(() => {})
```

> **Note:** The exact variable names (`postId`, `asset.id`) depend on the callback signature. Read the file to confirm the handler name and available variables. The `postId` comes from the component's props or context. The `asset` has an `id` field from `MediaAssetResult` — but `MediaAssetResult` currently does NOT include `id`. You'll need to map it from the gallery response. If `asset` only has `url`, match by URL in the existing assets list or extend `MediaAssetResult` to include `id`.

- [ ] **Step 2: Fix `type-drawer.tsx` — newsletter type og_image**

Add import at top:
```typescript
import { trackMediaUsageAction } from '../../media/actions'
```

In the OG image gallery's `onSelect` callback (around line 993-996), after setting the OG URL, add:
```typescript
if (editData?.id) {
  trackMediaUsageAction(asset.id, 'newsletter_type', editData.id, 'og_image').catch(() => {})
}
```

- [ ] **Step 3: Fix `gallery-url-field.tsx` — site logo and default OG**

This is a reusable component. Add `onTrackUsage` callback prop:

Add to the component's props interface:
```typescript
onTrackUsage?: (assetId: string) => void
```

In the `onSelect` callback, after setting the URL, add:
```typescript
onTrackUsage?.(asset.id)
```

Then, in the parent component(s) that render `GalleryUrlField` for site logo and OG:
- For logo: `onTrackUsage={(id) => trackMediaUsageAction(id, 'site', siteId, 'logo_url').catch(() => {})}`
- For OG: `onTrackUsage={(id) => trackMediaUsageAction(id, 'site', siteId, 'og_image').catch(() => {})}`

- [ ] **Step 4: Fix `pipeline-item-detail.tsx` — cover_image and thumbnail**

Add import at top:
```typescript
import { trackMediaUsageAction } from '../../../media/actions'
```

In `handleCoverSelect`, after saving the cover URL:
```typescript
trackMediaUsageAction(asset.id, 'pipeline_item', item.id, 'cover_image').catch(() => {})
```

In `handleInlineImageSelect` (or the thumbnail handler), after inserting:
```typescript
trackMediaUsageAction(asset.id, 'pipeline_item', item.id, 'content_inline').catch(() => {})
```

> **Critical note on `MediaAssetResult`:** The current `MediaAssetResult` interface has `id`, `url`, `alt`, `width`, `height`, `mimeType`. The `id` field IS available, so `asset.id` works. Verify at runtime that the gallery modal passes `id` through correctly.

- [ ] **Step 5: Run existing tests to verify no regressions**

Run: `cd apps/web && npx vitest run test/cms/media-actions.test.ts test/cms/media-gallery-modal.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/posts/_components/tabs/images-tab.tsx \
       apps/web/src/app/cms/(authed)/newsletters/_components/type-drawer.tsx \
       apps/web/src/app/admin/(authed)/sites/gallery-url-field.tsx \
       apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "fix(media): add trackMediaUsageAction to 7 missing gallery-select call sites"
```

---

### Task 6: Extend i18n Strings

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/media/_i18n/types.ts`
- Modify: `apps/web/src/app/cms/(authed)/_shared/media/_i18n/en.ts`
- Modify: `apps/web/src/app/cms/(authed)/_shared/media/_i18n/pt-BR.ts`

- [ ] **Step 1: Extend `MediaGalleryStrings` interface**

In `_i18n/types.ts`, replace the interface with:

```typescript
export interface MediaGalleryStrings {
  modal: { title: string; close: string }
  tabs: { upload: string; library: string }
  upload: {
    dragPrompt: string; dropHere: string; selectFile: string
    altLabel: string; altPlaceholder: string; altRequired: string
    folderLabel: string; tagsLabel: string; tagsPlaceholder: string
    uploadButton: string; uploading: string; uploadSuccess: string
    uploadError: string; duplicateNotice: string
    errorCodes?: Record<string, string>
  }
  library: {
    searchPlaceholder: string
    folderAll: string; folderAuthors: string; folderBlog: string; folderPipeline: string
    folderNewsletters: string; folderBranding: string; folderOg: string
    folderAds: string; folderLinks: string; folderGeneral: string
    loadMore: string; noResults: string; emptyLibrary: string
  }
  crop: { cropTitle: string; cropConfirm: string; cropCancel: string }
  delete: { confirmTitle: string; confirmMessage: string; usageWarning: string }
  dimensions: { tooSmall: string }
  toolbar: {
    selectAll: string; deselectAll: string
    searchHint: string; searchCount: string
    filterAll: string; filterCovers: string; filterInline: string
    filterAvatars: string; filterOg: string; filterUnused: string
    sortNewest: string; sortOldest: string; sortLargest: string; sortSmallest: string; sortName: string
    viewGrid: string; viewList: string
    columns: string
  }
  detail: {
    tabDetails: string; tabUsage: string; tabHistory: string
    filename: string; dimensions: string; fileSize: string
    ratio: string; mimeType: string; uploaded: string; uploadedBy: string
    tags: string; addTag: string; altText: string; folder: string
    copyUrl: string; replace: string; deleteAsset: string
    copied: string; noUsages: string
    orphanWarning: string; orphanAutoDelete: string
    historyUpload: string; historyExifStrip: string; historyDedupCheck: string
    usedIn: string
  }
  bulk: {
    selected: string; deselect: string
    download: string; tag: string; deleteSelected: string
  }
  lightbox: {
    counter: string; previous: string; next: string; close: string
  }
  storage: {
    label: string; used: string
    covers: string; inline: string; avatars: string; og: string; unused: string
  }
  context: {
    preview: string; download: string; copyUrl: string
    editAlt: string; moveTo: string; deleteAsset: string
  }
  empty: {
    noAssets: string; noCovers: string; noInline: string
    noAvatars: string; noOg: string; noUnused: string
    noSearchResults: string
  }
  shortcuts: {
    title: string; search: string; navigate: string; openDetail: string
    toggleSelect: string; escape: string; deleteKey: string; showShortcuts: string
    rangeSelect: string; lightboxNav: string
  }
}
```

- [ ] **Step 2: Add English strings**

In `_i18n/en.ts`, add the new sections after the existing `dimensions` key:

```typescript
  toolbar: {
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    searchHint: '⌘K',
    searchCount: '{count} results',
    filterAll: 'All',
    filterCovers: 'Covers',
    filterInline: 'Inline',
    filterAvatars: 'Avatars',
    filterOg: 'OG',
    filterUnused: 'Unused',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortLargest: 'Largest',
    sortSmallest: 'Smallest',
    sortName: 'Name A–Z',
    viewGrid: 'Grid',
    viewList: 'List',
    columns: 'Columns',
  },
  detail: {
    tabDetails: 'Details',
    tabUsage: 'Usage',
    tabHistory: 'History',
    filename: 'Filename',
    dimensions: 'Dimensions',
    fileSize: 'Size',
    ratio: 'Ratio',
    mimeType: 'Type',
    uploaded: 'Uploaded',
    uploadedBy: 'Uploaded by',
    tags: 'Tags',
    addTag: 'Add tag',
    altText: 'Alt text',
    folder: 'Folder',
    copyUrl: 'Copy URL',
    replace: 'Replace',
    deleteAsset: 'Delete',
    copied: 'Copied!',
    noUsages: 'No references found',
    orphanWarning: 'Unused for {days} days',
    orphanAutoDelete: 'Auto-deletes in {days} days',
    historyUpload: 'Uploaded',
    historyExifStrip: 'EXIF metadata stripped',
    historyDedupCheck: 'SHA-256 dedup verified',
    usedIn: 'Referenced in',
  },
  bulk: {
    selected: '{count} selected',
    deselect: 'Deselect all',
    download: 'Download',
    tag: 'Tag',
    deleteSelected: 'Delete',
  },
  lightbox: {
    counter: '{current} / {total}',
    previous: 'Previous',
    next: 'Next',
    close: 'Close',
  },
  storage: {
    label: 'Blob Storage',
    used: '{used} of {total}',
    covers: 'Covers',
    inline: 'Inline',
    avatars: 'Avatars',
    og: 'OG',
    unused: 'Unused',
  },
  context: {
    preview: 'Preview',
    download: 'Download',
    copyUrl: 'Copy URL',
    editAlt: 'Edit alt text',
    moveTo: 'Move to…',
    deleteAsset: 'Delete',
  },
  empty: {
    noAssets: 'No images uploaded yet.',
    noCovers: 'No cover images found.',
    noInline: 'No inline images found.',
    noAvatars: 'No avatars found.',
    noOg: 'No OG images found.',
    noUnused: 'No unused images — great!',
    noSearchResults: 'No images match "{query}".',
  },
  shortcuts: {
    title: 'Keyboard Shortcuts',
    search: '⌘K — Focus search',
    navigate: '↑↓←→ — Navigate cards',
    openDetail: 'Enter — Open detail panel',
    toggleSelect: 'Space — Toggle selection',
    escape: 'Esc — Close / Clear',
    deleteKey: 'Delete — Delete selected',
    showShortcuts: '? — Show shortcuts',
    rangeSelect: 'Shift+Click — Range select',
    lightboxNav: '←→ — Lightbox navigation',
  },
```

- [ ] **Step 3: Add Portuguese strings**

In `_i18n/pt-BR.ts`, add the matching sections:

```typescript
  toolbar: {
    selectAll: 'Selecionar todos',
    deselectAll: 'Desmarcar todos',
    searchHint: '⌘K',
    searchCount: '{count} resultados',
    filterAll: 'Todos',
    filterCovers: 'Capas',
    filterInline: 'Inline',
    filterAvatars: 'Avatares',
    filterOg: 'OG',
    filterUnused: 'Sem uso',
    sortNewest: 'Mais recentes',
    sortOldest: 'Mais antigos',
    sortLargest: 'Maiores',
    sortSmallest: 'Menores',
    sortName: 'Nome A–Z',
    viewGrid: 'Grade',
    viewList: 'Lista',
    columns: 'Colunas',
  },
  detail: {
    tabDetails: 'Detalhes',
    tabUsage: 'Uso',
    tabHistory: 'Histórico',
    filename: 'Nome do arquivo',
    dimensions: 'Dimensões',
    fileSize: 'Tamanho',
    ratio: 'Proporção',
    mimeType: 'Tipo',
    uploaded: 'Enviado em',
    uploadedBy: 'Enviado por',
    tags: 'Tags',
    addTag: 'Adicionar tag',
    altText: 'Texto alternativo',
    folder: 'Pasta',
    copyUrl: 'Copiar URL',
    replace: 'Substituir',
    deleteAsset: 'Excluir',
    copied: 'Copiado!',
    noUsages: 'Nenhuma referência encontrada',
    orphanWarning: 'Sem uso há {days} dias',
    orphanAutoDelete: 'Exclusão automática em {days} dias',
    historyUpload: 'Enviado',
    historyExifStrip: 'Metadados EXIF removidos',
    historyDedupCheck: 'Verificação SHA-256 concluída',
    usedIn: 'Referenciado em',
  },
  bulk: {
    selected: '{count} selecionados',
    deselect: 'Desmarcar todos',
    download: 'Baixar',
    tag: 'Tag',
    deleteSelected: 'Excluir',
  },
  lightbox: {
    counter: '{current} / {total}',
    previous: 'Anterior',
    next: 'Próximo',
    close: 'Fechar',
  },
  storage: {
    label: 'Blob Storage',
    used: '{used} de {total}',
    covers: 'Capas',
    inline: 'Inline',
    avatars: 'Avatares',
    og: 'OG',
    unused: 'Sem uso',
  },
  context: {
    preview: 'Visualizar',
    download: 'Baixar',
    copyUrl: 'Copiar URL',
    editAlt: 'Editar texto alt',
    moveTo: 'Mover para…',
    deleteAsset: 'Excluir',
  },
  empty: {
    noAssets: 'Nenhuma imagem enviada ainda.',
    noCovers: 'Nenhuma imagem de capa encontrada.',
    noInline: 'Nenhuma imagem inline encontrada.',
    noAvatars: 'Nenhum avatar encontrado.',
    noOg: 'Nenhuma imagem OG encontrada.',
    noUnused: 'Nenhuma imagem sem uso — ótimo!',
    noSearchResults: 'Nenhuma imagem corresponde a "{query}".',
  },
  shortcuts: {
    title: 'Atalhos do Teclado',
    search: '⌘K — Focar busca',
    navigate: '↑↓←→ — Navegar cards',
    openDetail: 'Enter — Abrir painel de detalhes',
    toggleSelect: 'Espaço — Alternar seleção',
    escape: 'Esc — Fechar / Limpar',
    deleteKey: 'Delete — Excluir selecionados',
    showShortcuts: '? — Mostrar atalhos',
    rangeSelect: 'Shift+Clique — Seleção em faixa',
    lightboxNav: '←→ — Navegação no lightbox',
  },
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/media/_i18n/
git commit -m "feat(media): extend i18n with toolbar, detail, bulk, lightbox, storage, context, empty, shortcuts strings"
```

---

### Task 7: Media Library Reducer with TDD

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/media-library-reducer.ts`
- Test: `apps/web/test/cms/media-library-reducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/cms/media-library-reducer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  mediaLibraryReducer,
  initialState,
  type MediaLibraryState,
} from '@/app/cms/(authed)/media/media-library-reducer'

describe('mediaLibraryReducer', () => {
  const base: MediaLibraryState = initialState()

  describe('SET_FILTER', () => {
    it('sets filter and resets checked', () => {
      const withChecked = { ...base, checked: new Set(['a', 'b']) }
      const next = mediaLibraryReducer(withChecked, { type: 'SET_FILTER', filter: 'avatar' })
      expect(next.filter).toBe('avatar')
      expect(next.checked.size).toBe(0)
    })
  })

  describe('SET_SEARCH', () => {
    it('sets search string', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_SEARCH', search: 'logo' })
      expect(next.search).toBe('logo')
    })
  })

  describe('SET_SORT', () => {
    it('sets sort option', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_SORT', sort: 'largest' })
      expect(next.sort).toBe('largest')
    })
  })

  describe('SET_VIEW', () => {
    it('sets view mode', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_VIEW', view: 'list' })
      expect(next.view).toBe('list')
    })
  })

  describe('SET_COLS', () => {
    it('sets column count', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_COLS', cols: 2 })
      expect(next.cols).toBe(2)
    })
  })

  describe('SELECT_ITEM', () => {
    it('selects an item and opens detail', () => {
      const next = mediaLibraryReducer(base, { type: 'SELECT_ITEM', id: 'abc' })
      expect(next.selectedId).toBe('abc')
    })

    it('deselects when same item selected', () => {
      const selected = { ...base, selectedId: 'abc' }
      const next = mediaLibraryReducer(selected, { type: 'SELECT_ITEM', id: 'abc' })
      expect(next.selectedId).toBeNull()
    })
  })

  describe('TOGGLE_CHECK', () => {
    it('adds item to checked set', () => {
      const next = mediaLibraryReducer(base, { type: 'TOGGLE_CHECK', id: 'a' })
      expect(next.checked.has('a')).toBe(true)
    })

    it('removes item from checked set', () => {
      const withChecked = { ...base, checked: new Set(['a']) }
      const next = mediaLibraryReducer(withChecked, { type: 'TOGGLE_CHECK', id: 'a' })
      expect(next.checked.has('a')).toBe(false)
    })
  })

  describe('CHECK_RANGE', () => {
    it('adds range of IDs to checked set', () => {
      const next = mediaLibraryReducer(base, { type: 'CHECK_RANGE', ids: ['a', 'b', 'c'] })
      expect(next.checked.size).toBe(3)
      expect(next.checked.has('b')).toBe(true)
    })
  })

  describe('CHECK_ALL / UNCHECK_ALL', () => {
    it('checks all provided IDs', () => {
      const next = mediaLibraryReducer(base, { type: 'CHECK_ALL', ids: ['x', 'y'] })
      expect(next.checked.size).toBe(2)
    })

    it('unchecks all', () => {
      const withChecked = { ...base, checked: new Set(['x', 'y']) }
      const next = mediaLibraryReducer(withChecked, { type: 'UNCHECK_ALL' })
      expect(next.checked.size).toBe(0)
    })
  })

  describe('OPEN_LIGHTBOX / CLOSE_LIGHTBOX', () => {
    it('opens lightbox with asset ID', () => {
      const next = mediaLibraryReducer(base, { type: 'OPEN_LIGHTBOX', id: 'img1' })
      expect(next.lightboxId).toBe('img1')
    })

    it('closes lightbox', () => {
      const withLb = { ...base, lightboxId: 'img1' }
      const next = mediaLibraryReducer(withLb, { type: 'CLOSE_LIGHTBOX' })
      expect(next.lightboxId).toBeNull()
    })
  })

  describe('SET_DETAIL_TAB', () => {
    it('sets detail tab', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_DETAIL_TAB', tab: 'usage' })
      expect(next.detailTab).toBe('usage')
    })
  })

  describe('SET_LOADING', () => {
    it('sets loading state', () => {
      const next = mediaLibraryReducer(base, { type: 'SET_LOADING', loading: true })
      expect(next.isLoading).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/media-library-reducer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `apps/web/src/app/cms/(authed)/media/media-library-reducer.ts`:

```typescript
import type { MediaAssetType } from '@/lib/media/types'
import type { MediaSortOption, MediaViewMode, MediaColumnCount } from '../_shared/media/types'

export interface MediaLibraryState {
  filter: 'all' | MediaAssetType
  search: string
  sort: MediaSortOption
  view: MediaViewMode
  cols: MediaColumnCount
  selectedId: string | null
  checked: Set<string>
  lightboxId: string | null
  detailTab: 'details' | 'usage' | 'history'
  isLoading: boolean
}

export type MediaLibraryAction =
  | { type: 'SET_FILTER'; filter: 'all' | MediaAssetType }
  | { type: 'SET_SEARCH'; search: string }
  | { type: 'SET_SORT'; sort: MediaSortOption }
  | { type: 'SET_VIEW'; view: MediaViewMode }
  | { type: 'SET_COLS'; cols: MediaColumnCount }
  | { type: 'SELECT_ITEM'; id: string }
  | { type: 'TOGGLE_CHECK'; id: string }
  | { type: 'CHECK_RANGE'; ids: string[] }
  | { type: 'CHECK_ALL'; ids: string[] }
  | { type: 'UNCHECK_ALL' }
  | { type: 'OPEN_LIGHTBOX'; id: string }
  | { type: 'CLOSE_LIGHTBOX' }
  | { type: 'SET_DETAIL_TAB'; tab: 'details' | 'usage' | 'history' }
  | { type: 'SET_LOADING'; loading: boolean }

export function initialState(): MediaLibraryState {
  return {
    filter: 'all',
    search: '',
    sort: 'newest',
    view: 'grid',
    cols: 3,
    selectedId: null,
    checked: new Set(),
    lightboxId: null,
    detailTab: 'details',
    isLoading: true,
  }
}

export function mediaLibraryReducer(
  state: MediaLibraryState,
  action: MediaLibraryAction,
): MediaLibraryState {
  switch (action.type) {
    case 'SET_FILTER':
      return { ...state, filter: action.filter, checked: new Set() }
    case 'SET_SEARCH':
      return { ...state, search: action.search }
    case 'SET_SORT':
      return { ...state, sort: action.sort }
    case 'SET_VIEW':
      return { ...state, view: action.view }
    case 'SET_COLS':
      return { ...state, cols: action.cols }
    case 'SELECT_ITEM':
      return {
        ...state,
        selectedId: state.selectedId === action.id ? null : action.id,
        detailTab: 'details',
      }
    case 'TOGGLE_CHECK': {
      const next = new Set(state.checked)
      if (next.has(action.id)) next.delete(action.id)
      else next.add(action.id)
      return { ...state, checked: next }
    }
    case 'CHECK_RANGE': {
      const next = new Set(state.checked)
      for (const id of action.ids) next.add(id)
      return { ...state, checked: next }
    }
    case 'CHECK_ALL':
      return { ...state, checked: new Set(action.ids) }
    case 'UNCHECK_ALL':
      return { ...state, checked: new Set() }
    case 'OPEN_LIGHTBOX':
      return { ...state, lightboxId: action.id }
    case 'CLOSE_LIGHTBOX':
      return { ...state, lightboxId: null }
    case 'SET_DETAIL_TAB':
      return { ...state, detailTab: action.tab }
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/media-library-reducer.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/media-library-reducer.ts \
       apps/web/test/cms/media-library-reducer.test.ts
git commit -m "feat(media): add media library state reducer with TDD"
```

---

### Task 8: MediaCard Component with TDD

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/media-card.tsx`
- Test: `apps/web/test/cms/media-card.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/cms/media-card.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaCard } from '@/app/cms/(authed)/media/_components/media-card'
import type { MediaAsset } from '@/lib/media/types'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img data-testid="next-image" src={props.src as string} alt={props.alt as string} />
  ),
}))

const mockAsset: MediaAsset = {
  id: 'asset-1',
  siteId: 'site-1',
  blobUrl: 'https://blob.vercel-storage.com/test.jpg',
  blobPathname: 'media/test.jpg',
  filename: 'hero-banner.jpg',
  altText: 'A hero banner',
  width: 1200,
  height: 675,
  mimeType: 'image/jpeg',
  fileSize: 245000,
  contentHash: 'abc123',
  folder: 'blog',
  tags: ['banner', 'homepage'],
  uploadedBy: 'user-1',
  createdAt: new Date().toISOString(),
}

describe('MediaCard', () => {
  const onSelect = vi.fn()
  const onCheck = vi.fn()
  const onQuickAction = vi.fn()

  it('renders filename and dimensions', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('hero-banner.jpg')).toBeDefined()
    expect(screen.getByText('1200 × 675')).toBeDefined()
  })

  it('applies correct type border color for cover', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('border-l-blue-500')
  })

  it('applies orphan styling', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="orphan"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const card = container.firstElementChild as HTMLElement
    expect(card.className).toContain('border-l-red-500')
  })

  it('shows type badge', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="avatar"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('Avatar')).toBeDefined()
  })

  it('calls onSelect when clicked', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    fireEvent.click(screen.getByTestId('media-card-asset-1'))
    expect(onSelect).toHaveBeenCalledWith('asset-1')
  })

  it('shows checked overlay when checked', () => {
    const { container } = render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={true}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(container.querySelector('[data-checked="true"]')).toBeDefined()
  })

  it('highlights search text in filename', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
        searchQuery="hero"
      />,
    )
    expect(screen.getByTestId('search-highlight')).toBeDefined()
  })

  it('renders SVG with img tag instead of next/image', () => {
    const svgAsset = { ...mockAsset, mimeType: 'image/svg+xml', width: null, height: null }
    render(
      <MediaCard
        item={svgAsset}
        type="inline"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    const img = screen.queryByTestId('next-image')
    expect(img).toBeNull()
  })

  it('formats file size correctly', () => {
    render(
      <MediaCard
        item={mockAsset}
        type="cover"
        checked={false}
        selected={false}
        onSelect={onSelect}
        onCheck={onCheck}
        onQuickAction={onQuickAction}
      />,
    )
    expect(screen.getByText('239.3 KB')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/media-card.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `apps/web/src/app/cms/(authed)/media/_components/media-card.tsx`:

```typescript
'use client'

import { useCallback } from 'react'
import Image from 'next/image'
import type { MediaAsset, MediaAssetType } from '@/lib/media/types'
import { TYPE_COLORS } from '../../_shared/media/types'

export type QuickAction = 'preview' | 'download' | 'copy-url' | 'delete'

interface MediaCardProps {
  item: MediaAsset
  type: MediaAssetType
  checked: boolean
  selected: boolean
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  onQuickAction: (id: string, action: QuickAction) => void
  searchQuery?: string
  compact?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function highlightMatch(text: string, query: string | undefined): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark data-testid="search-highlight" className="bg-cms-accent/30 text-cms-text rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function isNewAsset(createdAt: string): boolean {
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
  return new Date(createdAt).getTime() > threeDaysAgo
}

export function MediaCard({
  item,
  type,
  checked,
  selected,
  onSelect,
  onCheck,
  onQuickAction,
  searchQuery,
  compact,
}: MediaCardProps) {
  const colors = TYPE_COLORS[type]
  const isSvg = item.mimeType === 'image/svg+xml'

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.shiftKey) {
        onCheck(item.id, true)
      } else {
        onSelect(item.id)
      }
    },
    [item.id, onSelect, onCheck],
  )

  const handleCheckbox = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onCheck(item.id, e.shiftKey)
    },
    [item.id, onCheck],
  )

  return (
    <div
      data-testid={`media-card-${item.id}`}
      data-checked={checked}
      onClick={handleClick}
      className={`
        group relative flex flex-col overflow-hidden rounded-lg border-l-4
        bg-cms-surface transition-all duration-150 cursor-pointer
        hover:bg-cms-surface-hover
        ${colors.border}
        ${selected ? 'ring-2 ring-cms-accent shadow-lg shadow-cms-accent/20' : 'border border-cms-border hover:border-cms-border-subtle'}
        ${checked ? 'bg-cms-accent/5' : ''}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-cms-bg">
        {isSvg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.blobUrl}
            alt={item.altText ?? ''}
            className="h-full w-full object-contain p-2"
            loading="lazy"
          />
        ) : (
          <Image
            src={item.blobUrl}
            alt={item.altText ?? ''}
            fill
            sizes={compact ? '150px' : '(min-width: 1200px) 300px, (min-width: 900px) 250px, 50vw'}
            className="object-cover"
          />
        )}

        {/* Checkbox */}
        <div
          onClick={handleCheckbox}
          className={`
            absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-all
            ${checked
              ? 'border-cms-accent bg-cms-accent text-white'
              : 'border-white/40 bg-black/30 opacity-0 group-hover:opacity-100'}
          `}
        >
          {checked && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {/* Hover overlay with quick actions */}
        {!compact && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            {(['preview', 'download', 'copy-url', 'delete'] as const).map((action) => (
              <button
                key={action}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onQuickAction(item.id, action)
                }}
                className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                aria-label={action}
              >
                <QuickActionIcon action={action} />
              </button>
            ))}
          </div>
        )}

        {/* Checked overlay */}
        {checked && (
          <div className="absolute inset-0 bg-cms-accent/15 pointer-events-none" />
        )}
      </div>

      {/* Info section */}
      <div className="flex flex-col gap-1 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
            {colors.label}
          </span>
          {isNewAsset(item.createdAt) && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              NEW
            </span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-cms-text">
          {highlightMatch(item.filename, searchQuery)}
        </p>
        <div className="flex items-center gap-2 text-xs text-cms-text-muted">
          {item.width && item.height ? (
            <span>{item.width} × {item.height}</span>
          ) : (
            <span>SVG</span>
          )}
          <span>·</span>
          <span>{formatBytes(item.fileSize)}</span>
        </div>
      </div>

      {/* Orphan pulse effect */}
      {type === 'orphan' && (
        <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)] animate-pulse pointer-events-none" />
      )}
    </div>
  )
}

function QuickActionIcon({ action }: { action: QuickAction }) {
  switch (action) {
    case 'preview':
      return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" /></svg>
    case 'download':
      return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'copy-url':
      return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" /><path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'delete':
      return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m2 0v8a2 2 0 01-2 2H6a2 2 0 01-2-2V4h8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/media-card.test.tsx`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/media-card.tsx \
       apps/web/test/cms/media-card.test.tsx
git commit -m "feat(media): add MediaCard component with type-colored borders, badges, and quick actions"
```

---

### Task 9: StorageBar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/storage-bar.tsx`

- [ ] **Step 1: Write implementation**

Create `apps/web/src/app/cms/(authed)/media/_components/storage-bar.tsx`:

```typescript
'use client'

import { useMemo } from 'react'
import { TYPE_COLORS, type MediaAssetType } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface FolderStat {
  count: number
  sizeBytes: number
}

interface StorageBarProps {
  folderBreakdown: Record<string, FolderStat>
  totalSizeBytes: number
  orphanCount: number
  t: MediaGalleryStrings
}

const FOLDER_TO_TYPE: Record<string, MediaAssetType> = {
  authors: 'avatar',
  og: 'og',
  blog: 'cover',
  branding: 'cover',
  newsletters: 'inline',
  pipeline: 'inline',
  ads: 'inline',
  links: 'inline',
  general: 'inline',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function StorageBar({ folderBreakdown, totalSizeBytes, orphanCount, t }: StorageBarProps) {
  const segments = useMemo(() => {
    const byType: Record<MediaAssetType, number> = { cover: 0, inline: 0, avatar: 0, og: 0, orphan: 0 }

    for (const [folder, stat] of Object.entries(folderBreakdown)) {
      const assetType = FOLDER_TO_TYPE[folder] ?? 'inline'
      byType[assetType] += stat.sizeBytes
    }

    const total = totalSizeBytes || 1
    return (Object.entries(byType) as Array<[MediaAssetType, number]>)
      .filter(([, bytes]) => bytes > 0)
      .map(([assetType, bytes]) => ({
        type: assetType,
        pct: (bytes / total) * 100,
        bytes,
      }))
  }, [folderBreakdown, totalSizeBytes])

  const storageLabel = t.storage.label
  const usedLabel = formatBytes(totalSizeBytes)

  return (
    <div className="rounded-lg border border-cms-border bg-cms-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-cms-text-muted">{storageLabel}</span>
        <span className="text-xs font-semibold text-cms-text tabular-nums">{usedLabel}</span>
      </div>

      {/* Bar */}
      <div className="flex h-2 overflow-hidden rounded-full bg-cms-bg">
        {segments.map((seg) => (
          <div
            key={seg.type}
            className={`${TYPE_COLORS[seg.type].bg} transition-all duration-700 ease-out`}
            style={{ width: `${seg.pct}%` }}
            role="meter"
            aria-label={seg.type}
            aria-valuenow={seg.pct}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3">
        {segments.map((seg) => (
          <div key={seg.type} className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${TYPE_COLORS[seg.type].bg}`} />
            <span className="text-[10px] text-cms-text-muted">
              {t.storage[seg.type === 'cover' ? 'covers' : seg.type === 'avatar' ? 'avatars' : seg.type] as string}
            </span>
            <span className="text-[10px] text-cms-text-dim tabular-nums">{formatBytes(seg.bytes)}</span>
          </div>
        ))}
        {orphanCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-cms-text-muted">{t.storage.unused}</span>
            <span className="text-[10px] text-cms-text-dim">{orphanCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/storage-bar.tsx
git commit -m "feat(media): add StorageBar with animated type-colored segments and legend"
```

---

### Task 10: MediaToolbar Component

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/media-toolbar.tsx`

- [ ] **Step 1: Write implementation**

Create `apps/web/src/app/cms/(authed)/media/_components/media-toolbar.tsx`:

```typescript
'use client'

import { useRef, useCallback } from 'react'
import type { MediaAssetType } from '@/lib/media/types'
import type { MediaSortOption, MediaViewMode, MediaColumnCount } from '../../_shared/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface FilterCount {
  all: number
  cover: number
  inline: number
  avatar: number
  og: number
  orphan: number
}

interface MediaToolbarProps {
  filter: 'all' | MediaAssetType
  search: string
  sort: MediaSortOption
  view: MediaViewMode
  cols: MediaColumnCount
  resultCount: number
  totalCount: number
  checkedCount: number
  filterCounts: FilterCount
  onFilterChange: (filter: 'all' | MediaAssetType) => void
  onSearchChange: (search: string) => void
  onSortChange: (sort: MediaSortOption) => void
  onViewChange: (view: MediaViewMode) => void
  onColsChange: (cols: MediaColumnCount) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  t: MediaGalleryStrings
}

const FILTER_OPTIONS: Array<{ key: 'all' | MediaAssetType; tKey: keyof MediaGalleryStrings['toolbar'] }> = [
  { key: 'all', tKey: 'filterAll' },
  { key: 'cover', tKey: 'filterCovers' },
  { key: 'inline', tKey: 'filterInline' },
  { key: 'avatar', tKey: 'filterAvatars' },
  { key: 'og', tKey: 'filterOg' },
  { key: 'orphan', tKey: 'filterUnused' },
]

const SORT_OPTIONS: Array<{ value: MediaSortOption; tKey: keyof MediaGalleryStrings['toolbar'] }> = [
  { value: 'newest', tKey: 'sortNewest' },
  { value: 'oldest', tKey: 'sortOldest' },
  { value: 'largest', tKey: 'sortLargest' },
  { value: 'smallest', tKey: 'sortSmallest' },
  { value: 'name', tKey: 'sortName' },
]

export function MediaToolbar({
  filter,
  search,
  sort,
  view,
  cols,
  resultCount,
  totalCount,
  checkedCount,
  filterCounts,
  onFilterChange,
  onSearchChange,
  onSortChange,
  onViewChange,
  onColsChange,
  onSelectAll,
  onDeselectAll,
  t,
}: MediaToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  const handleSearchClear = useCallback(() => {
    onSearchChange('')
    searchRef.current?.focus()
  }, [onSearchChange])

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-cms-border bg-cms-surface px-3 py-2">
      {/* Select-all checkbox */}
      <button
        type="button"
        onClick={checkedCount > 0 ? onDeselectAll : onSelectAll}
        className="flex h-5 w-5 items-center justify-center rounded border border-cms-border transition-colors hover:border-cms-accent"
        aria-label={checkedCount > 0 ? t.toolbar.deselectAll : t.toolbar.selectAll}
        data-testid="select-all-checkbox"
      >
        {checkedCount > 0 && checkedCount < totalCount && (
          <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor" className="text-cms-accent" /></svg>
        )}
        {checkedCount > 0 && checkedCount === totalCount && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-cms-accent" /></svg>
        )}
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-cms-border" />

      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-[320px]">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cms-text-dim" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.library.searchPlaceholder}
          className="w-full rounded-md border border-cms-border bg-cms-bg py-1.5 pl-8 pr-16 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
          role="searchbox"
          data-testid="media-search"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {search && (
            <>
              <span className="text-[10px] text-cms-text-muted tabular-nums">
                {t.toolbar.searchCount.replace('{count}', String(resultCount))}
              </span>
              <button
                type="button"
                onClick={handleSearchClear}
                className="rounded p-0.5 text-cms-text-dim hover:text-cms-text"
                aria-label="Clear search"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </button>
            </>
          )}
          {!search && (
            <kbd className="rounded border border-cms-border bg-cms-bg px-1 py-0.5 text-[10px] text-cms-text-dim">
              {t.toolbar.searchHint}
            </kbd>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-cms-border" />

      {/* Filter pills */}
      <div className="flex gap-1">
        {FILTER_OPTIONS.map(({ key, tKey }) => {
          const count = filterCounts[key as keyof FilterCount] ?? 0
          const isActive = filter === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterChange(key)}
              className={`
                flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all
                ${isActive
                  ? 'bg-cms-accent text-white shadow-sm'
                  : 'bg-cms-bg text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'}
              `}
              data-testid={`filter-${key}`}
            >
              {t.toolbar[tKey]}
              <span className={`tabular-nums ${isActive ? 'text-white/70' : 'text-cms-text-dim'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Sort */}
      <select
        value={sort}
        onChange={(e) => onSortChange(e.target.value as MediaSortOption)}
        className="rounded-md border border-cms-border bg-cms-bg px-2 py-1 text-xs text-cms-text focus:border-cms-accent focus:outline-none"
        data-testid="media-sort"
      >
        {SORT_OPTIONS.map(({ value, tKey }) => (
          <option key={value} value={value}>{t.toolbar[tKey]}</option>
        ))}
      </select>

      {/* Column density */}
      <div className="flex gap-0.5 rounded-md border border-cms-border bg-cms-bg p-0.5">
        {([2, 3, 4] as const).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onColsChange(n)}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              cols === n ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'
            }`}
            aria-label={`${n} ${t.toolbar.columns}`}
          >
            {n}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex gap-0.5 rounded-md border border-cms-border bg-cms-bg p-0.5">
        <button
          type="button"
          onClick={() => onViewChange('grid')}
          className={`rounded p-1 transition-colors ${view === 'grid' ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
          aria-label={t.toolbar.viewGrid}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button
          type="button"
          onClick={() => onViewChange('list')}
          className={`rounded p-1 transition-colors ${view === 'list' ? 'bg-cms-accent text-white' : 'text-cms-text-muted hover:text-cms-text'}`}
          aria-label={t.toolbar.viewList}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/media-toolbar.tsx
git commit -m "feat(media): add MediaToolbar with search, filter pills, sort, density, and view toggle"
```

---

### Task 11: MediaGrid, MediaList, SkeletonGrid, and EmptyState

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/media-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/media-list.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/skeleton-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/empty-state.tsx`

- [ ] **Step 1: Create `media-grid.tsx`**

```typescript
'use client'

import { MediaCard, type QuickAction } from './media-card'
import type { EnrichedMediaAsset, MediaColumnCount } from '../../_shared/media/types'

interface MediaGridProps {
  items: EnrichedMediaAsset[]
  checked: Set<string>
  selectedId: string | null
  cols: MediaColumnCount
  searchQuery: string
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
  onQuickAction: (id: string, action: QuickAction) => void
  onContextMenu?: (id: string, x: number, y: number) => void
  compact?: boolean
}

const COL_CLASSES: Record<MediaColumnCount, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export function MediaGrid({
  items,
  checked,
  selectedId,
  cols,
  searchQuery,
  onSelect,
  onCheck,
  onQuickAction,
  onContextMenu,
  compact,
}: MediaGridProps) {
  return (
    <div
      role="grid"
      aria-label="Media assets"
      className={`grid gap-3 ${COL_CLASSES[cols]}`}
    >
      {items.map((enriched) => (
        <div
          key={enriched.asset.id}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault()
              onContextMenu(enriched.asset.id, e.clientX, e.clientY)
            }
          }}
        >
          <MediaCard
            item={enriched.asset}
            type={enriched.type}
            checked={checked.has(enriched.asset.id)}
            selected={selectedId === enriched.asset.id}
            onSelect={onSelect}
            onCheck={onCheck}
            onQuickAction={onQuickAction}
            searchQuery={searchQuery}
            compact={compact}
          />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `media-list.tsx`**

```typescript
'use client'

import Image from 'next/image'
import type { EnrichedMediaAsset } from '../../_shared/media/types'
import { TYPE_COLORS } from '../../_shared/media/types'

interface MediaListProps {
  items: EnrichedMediaAsset[]
  checked: Set<string>
  selectedId: string | null
  onSelect: (id: string) => void
  onCheck: (id: string, shiftKey: boolean) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaList({ items, checked, selectedId, onSelect, onCheck }: MediaListProps) {
  return (
    <div role="list" className="flex flex-col gap-1">
      {items.map((enriched) => {
        const { asset, type } = enriched
        const colors = TYPE_COLORS[type]
        const isChecked = checked.has(asset.id)
        const isSelected = selectedId === asset.id
        const isSvg = asset.mimeType === 'image/svg+xml'

        return (
          <div
            key={asset.id}
            role="listitem"
            onClick={() => onSelect(asset.id)}
            className={`
              flex items-center gap-3 rounded-lg border-l-4 px-3 py-2 cursor-pointer transition-colors
              ${colors.border}
              ${isSelected ? 'bg-cms-accent/10 ring-1 ring-cms-accent' : 'bg-cms-surface hover:bg-cms-surface-hover'}
              ${isChecked ? 'bg-cms-accent/5' : ''}
            `}
          >
            <div
              onClick={(e) => { e.stopPropagation(); onCheck(asset.id, e.shiftKey) }}
              className={`
                flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors
                ${isChecked ? 'border-cms-accent bg-cms-accent text-white' : 'border-cms-border hover:border-cms-accent'}
              `}
            >
              {isChecked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>

            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-cms-bg">
              {isSvg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.blobUrl} alt="" className="h-full w-full object-contain p-0.5" />
              ) : (
                <Image src={asset.blobUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-cms-text">{asset.filename}</p>
            </div>

            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.badge}`}>
              {colors.label}
            </span>

            <span className="shrink-0 text-xs text-cms-text-muted tabular-nums w-24 text-right">
              {asset.width && asset.height ? `${asset.width}×${asset.height}` : 'SVG'}
            </span>

            <span className="shrink-0 text-xs text-cms-text-dim tabular-nums w-16 text-right">
              {formatBytes(asset.fileSize)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `skeleton-grid.tsx`**

```typescript
'use client'

import type { MediaColumnCount } from '../../_shared/media/types'

interface SkeletonGridProps {
  cols: MediaColumnCount
  count?: number
}

const COL_CLASSES: Record<MediaColumnCount, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

export function SkeletonGrid({ cols, count = 12 }: SkeletonGridProps) {
  return (
    <div className={`grid gap-3 ${COL_CLASSES[cols]}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-cms-border bg-cms-surface">
          <div className="aspect-[4/3] bg-cms-bg" />
          <div className="flex flex-col gap-2 px-3 py-2">
            <div className="h-3 w-12 rounded bg-cms-bg" />
            <div className="h-3.5 w-3/4 rounded bg-cms-bg" />
            <div className="h-3 w-1/2 rounded bg-cms-bg" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create `empty-state.tsx`**

```typescript
'use client'

import type { MediaAssetType } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface EmptyStateProps {
  filter: 'all' | MediaAssetType
  searchQuery: string
  t: MediaGalleryStrings
}

const FILTER_EMPTY_KEY: Record<string, keyof MediaGalleryStrings['empty']> = {
  all: 'noAssets',
  cover: 'noCovers',
  inline: 'noInline',
  avatar: 'noAvatars',
  og: 'noOg',
  orphan: 'noUnused',
}

export function EmptyState({ filter, searchQuery, t }: EmptyStateProps) {
  const message = searchQuery
    ? t.empty.noSearchResults.replace('{query}', searchQuery)
    : t.empty[FILTER_EMPTY_KEY[filter] ?? 'noAssets']

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-cms-text-dim">
        <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
        <circle cx="18" cy="22" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M6 32l10-8 6 4 10-10 10 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-sm text-cms-text-muted">{message}</p>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/media-grid.tsx \
       apps/web/src/app/cms/(authed)/media/_components/media-list.tsx \
       apps/web/src/app/cms/(authed)/media/_components/skeleton-grid.tsx \
       apps/web/src/app/cms/(authed)/media/_components/empty-state.tsx
git commit -m "feat(media): add MediaGrid, MediaList, SkeletonGrid, and EmptyState components"
```

---

### Task 12: DetailPanel and DetailTabs Components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/detail-panel.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/detail-tabs.tsx`

- [ ] **Step 1: Create `detail-tabs.tsx`**

```typescript
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface UsageEntry {
  resourceType: string
  resourceId: string
  fieldName: string
}

interface DetailTabsProps {
  tab: 'details' | 'usage' | 'history'
  asset: MediaAsset
  usages: UsageEntry[]
  onUpdateAltText: (altText: string) => void
  onUpdateTags: (tags: string[]) => void
  onUpdateFolder: (folder: string) => void
  t: MediaGalleryStrings
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).catch(() => {})
}

function CopyableValue({ label, value, t }: { label: string; value: string; t: MediaGalleryStrings }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    copyToClipboard(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-cms-text-dim">{label}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="group flex items-center gap-1 text-xs text-cms-text hover:text-cms-accent"
      >
        <span className="tabular-nums">{value}</span>
        <span className="text-[10px] text-cms-accent opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? t.detail.copied : ''}
        </span>
      </button>
    </div>
  )
}

export function DetailTabs({ tab, asset, usages, onUpdateAltText, onUpdateTags, onUpdateFolder, t }: DetailTabsProps) {
  if (tab === 'details') {
    return (
      <DetailsTab
        asset={asset}
        onUpdateAltText={onUpdateAltText}
        onUpdateTags={onUpdateTags}
        onUpdateFolder={onUpdateFolder}
        t={t}
      />
    )
  }
  if (tab === 'usage') {
    return <UsageTab usages={usages} t={t} />
  }
  return <HistoryTab asset={asset} t={t} />
}

function DetailsTab({
  asset,
  onUpdateAltText,
  onUpdateTags,
  onUpdateFolder,
  t,
}: {
  asset: MediaAsset
  onUpdateAltText: (v: string) => void
  onUpdateTags: (v: string[]) => void
  onUpdateFolder: (v: string) => void
  t: MediaGalleryStrings
}) {
  const [altText, setAltText] = useState(asset.altText ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    setAltText(asset.altText ?? '')
  }, [asset.id, asset.altText])

  const handleAltChange = useCallback(
    (value: string) => {
      setAltText(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onUpdateAltText(value), 500)
    },
    [onUpdateAltText],
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onUpdateTags(asset.tags.filter((t) => t !== tag))
    },
    [asset.tags, onUpdateTags],
  )

  const [newTag, setNewTag] = useState('')
  const handleAddTag = useCallback(() => {
    const trimmed = newTag.trim()
    if (trimmed && !asset.tags.includes(trimmed)) {
      onUpdateTags([...asset.tags, trimmed])
    }
    setNewTag('')
  }, [newTag, asset.tags, onUpdateTags])

  const ratio = asset.width && asset.height
    ? `${(asset.width / asset.height).toFixed(2)}:1`
    : '—'

  return (
    <div className="flex flex-col gap-4">
      {/* Metadata grid */}
      <div className="flex flex-col gap-2 rounded-lg border border-cms-border bg-cms-bg p-3">
        <CopyableValue label={t.detail.filename} value={asset.filename} t={t} />
        <CopyableValue
          label={t.detail.dimensions}
          value={asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'SVG'}
          t={t}
        />
        <CopyableValue label={t.detail.fileSize} value={formatBytes(asset.fileSize)} t={t} />
        <CopyableValue label={t.detail.ratio} value={ratio} t={t} />
        <CopyableValue label={t.detail.mimeType} value={asset.mimeType} t={t} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-cms-text-dim">{t.detail.uploaded}</span>
          <span className="text-xs text-cms-text">{new Date(asset.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Alt text */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.altText}</label>
        <textarea
          value={altText}
          onChange={(e) => handleAltChange(e.target.value)}
          rows={2}
          className="rounded-md border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none resize-none"
          placeholder={t.upload.altPlaceholder}
        />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.tags}</label>
        <div className="flex flex-wrap gap-1.5">
          {asset.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded-full bg-cms-bg px-2 py-0.5 text-xs text-cms-text">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="ml-0.5 text-cms-text-dim hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder={t.detail.addTag}
              className="w-20 rounded border border-cms-border bg-cms-bg px-1.5 py-0.5 text-xs text-cms-text placeholder:text-cms-text-dim focus:border-cms-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Folder */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-cms-text-muted">{t.detail.folder}</label>
        <select
          value={asset.folder}
          onChange={(e) => onUpdateFolder(e.target.value)}
          className="rounded-md border border-cms-border bg-cms-bg px-2.5 py-1.5 text-sm text-cms-text focus:border-cms-accent focus:outline-none"
        >
          {['general', 'authors', 'blog', 'pipeline', 'newsletters', 'branding', 'og', 'ads', 'links'].map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function UsageTab({ usages, t }: { usages: UsageEntry[]; t: MediaGalleryStrings }) {
  if (usages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-red-400">
          <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="2" />
          <path d="M12 12l8 8M20 12l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-sm text-cms-text-muted">{t.detail.noUsages}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-cms-text-muted">{t.detail.usedIn}</p>
      {usages.map((u, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md border border-cms-border bg-cms-bg px-3 py-2">
          <span className="rounded-full bg-cms-accent/15 px-2 py-0.5 text-[10px] font-semibold text-cms-accent">
            {u.resourceType.replace('_', ' ')}
          </span>
          <span className="text-xs text-cms-text truncate">{u.fieldName}</span>
        </div>
      ))}
    </div>
  )
}

function HistoryTab({ asset, t }: { asset: MediaAsset; t: MediaGalleryStrings }) {
  const events = [
    { label: t.detail.historyUpload, date: asset.createdAt },
    { label: t.detail.historyExifStrip, date: asset.createdAt },
    { label: t.detail.historyDedupCheck, date: asset.createdAt },
  ]

  return (
    <div className="flex flex-col gap-0 pl-3">
      {events.map((ev, i) => (
        <div key={i} className="flex items-start gap-3 pb-4">
          <div className="relative flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-cms-accent" />
            {i < events.length - 1 && <div className="absolute top-3 h-full w-px bg-cms-border" />}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-cms-text">{ev.label}</span>
            <span className="text-[10px] text-cms-text-dim">{new Date(ev.date).toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `detail-panel.tsx`**

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'
import { DetailTabs } from './detail-tabs'

interface UsageEntry {
  resourceType: string
  resourceId: string
  fieldName: string
}

interface DetailPanelProps {
  asset: MediaAsset | null
  tab: 'details' | 'usage' | 'history'
  usages: UsageEntry[]
  onTabChange: (tab: 'details' | 'usage' | 'history') => void
  onClose: () => void
  onUpdateAsset: (assetId: string, updates: { altText?: string; tags?: string[]; folder?: string }) => void
  onCopyUrl: (url: string) => void
  onReplace: (id: string) => void
  onDelete: (id: string) => void
  onOpenLightbox: (id: string) => void
  t: MediaGalleryStrings
}

export function DetailPanel({
  asset,
  tab,
  usages,
  onTabChange,
  onClose,
  onUpdateAsset,
  onCopyUrl,
  onReplace,
  onDelete,
  onOpenLightbox,
  t,
}: DetailPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (asset) {
      requestAnimationFrame(() => setIsOpen(true))
    } else {
      setIsOpen(false)
    }
  }, [asset])

  const handleUpdateAltText = useCallback(
    (altText: string) => { if (asset) onUpdateAsset(asset.id, { altText }) },
    [asset, onUpdateAsset],
  )
  const handleUpdateTags = useCallback(
    (tags: string[]) => { if (asset) onUpdateAsset(asset.id, { tags }) },
    [asset, onUpdateAsset],
  )
  const handleUpdateFolder = useCallback(
    (folder: string) => { if (asset) onUpdateAsset(asset.id, { folder }) },
    [asset, onUpdateAsset],
  )

  if (!asset) return null

  const isSvg = asset.mimeType === 'image/svg+xml'
  const tabs = ['details', 'usage', 'history'] as const
  const tabLabels: Record<string, string> = {
    details: t.detail.tabDetails,
    usage: t.detail.tabUsage,
    history: t.detail.tabHistory,
  }

  return (
    <div
      role="complementary"
      aria-label="Asset details"
      className={`
        fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-cms-border bg-cms-surface shadow-2xl
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
      style={{ marginTop: 'var(--cms-topbar-height, 0px)' }}
    >
      {/* Preview */}
      <div
        className="relative aspect-[16/10] w-full cursor-pointer bg-cms-bg"
        onClick={() => onOpenLightbox(asset.id)}
      >
        {isSvg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.blobUrl} alt={asset.altText ?? ''} className="h-full w-full object-contain p-4" />
        ) : (
          <Image src={asset.blobUrl} alt={asset.altText ?? ''} fill className="object-contain" />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white backdrop-blur-sm hover:bg-black/60"
          aria-label={t.modal.close}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cms-border">
        {tabs.map((t2) => (
          <button
            key={t2}
            type="button"
            onClick={() => onTabChange(t2)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              tab === t2
                ? 'border-b-2 border-cms-accent text-cms-accent'
                : 'text-cms-text-muted hover:text-cms-text'
            }`}
          >
            {tabLabels[t2]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4">
        <DetailTabs
          tab={tab}
          asset={asset}
          usages={usages}
          onUpdateAltText={handleUpdateAltText}
          onUpdateTags={handleUpdateTags}
          onUpdateFolder={handleUpdateFolder}
          t={t}
        />
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 border-t border-cms-border px-4 py-3">
        <button
          type="button"
          onClick={() => onCopyUrl(asset.blobUrl)}
          className="flex-1 rounded-md bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cms-accent/90"
        >
          {t.detail.copyUrl}
        </button>
        <button
          type="button"
          onClick={() => onReplace(asset.id)}
          className="rounded-md border border-cms-border px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface-hover"
        >
          {t.detail.replace}
        </button>
        <button
          type="button"
          onClick={() => onDelete(asset.id)}
          className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
        >
          {t.detail.deleteAsset}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/detail-panel.tsx \
       apps/web/src/app/cms/(authed)/media/_components/detail-tabs.tsx
git commit -m "feat(media): add DetailPanel with slide-in animation and tabbed content"
```

---

### Task 13: Lightbox, BulkActionBar, ContextMenu, DeleteConfirmModal, and DropOverlay

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/_components/media-lightbox.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/bulk-action-bar.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/context-menu.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/delete-confirm-modal.tsx`
- Create: `apps/web/src/app/cms/(authed)/media/_components/drop-overlay.tsx`

- [ ] **Step 1: Create `media-lightbox.tsx`**

```typescript
'use client'

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import type { MediaAsset } from '@/lib/media/types'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface MediaLightboxProps {
  asset: MediaAsset | null
  currentIndex: number
  totalCount: number
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  t: MediaGalleryStrings
}

export function MediaLightbox({
  asset,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onClose,
  t,
}: MediaLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && currentIndex > 0) onPrev()
      if (e.key === 'ArrowRight' && currentIndex < totalCount - 1) onNext()
    },
    [onClose, onPrev, onNext, currentIndex, totalCount],
  )

  useEffect(() => {
    if (!asset) return
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [asset, handleKeyDown])

  if (!asset) return null

  const isSvg = asset.mimeType === 'image/svg+xml'
  const counter = t.lightbox.counter
    .replace('{current}', String(currentIndex + 1))
    .replace('{total}', String(totalCount))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
      style={{ background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #0e0e1a 0% 50%) 0 0 / 20px 20px' }}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Image */}
      <div
        className="relative z-10 max-h-[85vh] max-w-[85vw] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {isSvg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.blobUrl}
            alt={asset.altText ?? ''}
            className="max-h-[85vh] max-w-[85vw] object-contain"
          />
        ) : (
          <Image
            src={asset.blobUrl}
            alt={asset.altText ?? ''}
            width={asset.width ?? 800}
            height={asset.height ?? 600}
            className="max-h-[85vh] max-w-[85vw] object-contain"
            priority
          />
        )}
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm tabular-nums">
          {counter}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.close}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Prev */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 z-20 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.previous}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Next */}
      {currentIndex < totalCount - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 z-20 rounded-full bg-black/50 p-3 text-white backdrop-blur-sm hover:bg-black/70"
          aria-label={t.lightbox.next}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Info bar */}
      <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm">
        <p className="text-xs text-white">
          {asset.filename}
          {asset.width && asset.height && (
            <span className="ml-2 text-white/60">{asset.width} × {asset.height}</span>
          )}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `bulk-action-bar.tsx`**

```typescript
'use client'

import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface BulkActionBarProps {
  count: number
  onDeselect: () => void
  onDownload: () => void
  onDelete: () => void
  t: MediaGalleryStrings
}

export function BulkActionBar({ count, onDeselect, onDownload, onDelete, t }: BulkActionBarProps) {
  if (count === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-cms-border bg-cms-surface px-4 py-2.5 shadow-2xl">
        <span className="text-sm font-medium text-cms-text tabular-nums">
          {t.bulk.selected.replace('{count}', String(count))}
        </span>
        <button
          type="button"
          onClick={onDeselect}
          className="text-xs text-cms-accent hover:underline"
        >
          {t.bulk.deselect}
        </button>

        <div className="h-4 w-px bg-cms-border" />

        <button
          type="button"
          onClick={onDownload}
          className="rounded-md bg-cms-bg px-3 py-1.5 text-xs font-medium text-cms-text hover:bg-cms-surface-hover"
        >
          {t.bulk.download}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
        >
          {t.bulk.deleteSelected}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `context-menu.tsx`**

```typescript
'use client'

import { useEffect, useRef } from 'react'
import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface ContextMenuProps {
  x: number
  y: number
  assetId: string
  onAction: (action: string) => void
  onClose: () => void
  t: MediaGalleryStrings
}

export function ContextMenu({ x, y, assetId, onAction, onClose, t }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const items = [
    { action: 'preview', label: t.context.preview },
    { action: 'download', label: t.context.download },
    { action: 'copy-url', label: t.context.copyUrl },
    { action: 'edit-alt', label: t.context.editAlt },
    { action: 'move-to', label: t.context.moveTo },
    { action: 'divider', label: '' },
    { action: 'delete', label: t.context.deleteAsset },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[160px] rounded-lg border border-cms-border bg-cms-surface py-1 shadow-xl animate-in fade-in zoom-in-95 duration-150"
      style={{ left: x, top: y }}
      data-asset-id={assetId}
    >
      {items.map((item, i) =>
        item.action === 'divider' ? (
          <div key={i} className="my-1 h-px bg-cms-border" />
        ) : (
          <button
            key={item.action}
            type="button"
            onClick={() => { onAction(item.action); onClose() }}
            className={`
              w-full px-3 py-1.5 text-left text-xs transition-colors
              ${item.action === 'delete' ? 'text-red-400 hover:bg-red-500/10' : 'text-cms-text hover:bg-cms-surface-hover'}
            `}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `delete-confirm-modal.tsx`**

```typescript
'use client'

import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface DeleteConfirmModalProps {
  open: boolean
  count: number
  usageCount: number
  onConfirm: () => void
  onCancel: () => void
  t: MediaGalleryStrings
}

export function DeleteConfirmModal({ open, count, usageCount, onConfirm, onCancel, t }: DeleteConfirmModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-xl border border-cms-border bg-cms-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-cms-text">{t.delete.confirmTitle}</h3>
        <p className="mt-2 text-sm text-cms-text-muted">{t.delete.confirmMessage}</p>
        {usageCount > 0 && (
          <div className="mt-3 rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2">
            <p className="text-xs text-orange-400">
              {t.delete.usageWarning.replace('{count}', String(usageCount))}
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-cms-border px-3 py-1.5 text-sm text-cms-text hover:bg-cms-surface-hover"
          >
            {t.crop.cropCancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
          >
            {t.detail.deleteAsset}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `drop-overlay.tsx`**

```typescript
'use client'

import type { MediaGalleryStrings } from '../../_shared/media/_i18n/types'

interface DropOverlayProps {
  active: boolean
  t: MediaGalleryStrings
}

export function DropOverlay({ active, t }: DropOverlayProps) {
  if (!active) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cms-accent/10 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-cms-accent bg-cms-surface/90 px-12 py-10">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-cms-accent">
          <path d="M24 8v24m0 0l-8-8m8 8l8-8M8 36h32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-lg font-medium text-cms-text">{t.upload.dropHere}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/_components/media-lightbox.tsx \
       apps/web/src/app/cms/(authed)/media/_components/bulk-action-bar.tsx \
       apps/web/src/app/cms/(authed)/media/_components/context-menu.tsx \
       apps/web/src/app/cms/(authed)/media/_components/delete-confirm-modal.tsx \
       apps/web/src/app/cms/(authed)/media/_components/drop-overlay.tsx
git commit -m "feat(media): add Lightbox, BulkActionBar, ContextMenu, DeleteConfirmModal, and DropOverlay"
```

---

### Task 14: MediaLibraryPage — Wire All Components Together

**Files:**
- Create: `apps/web/src/app/cms/(authed)/media/media-library-page.tsx`

- [ ] **Step 1: Write the main page component**

Create `apps/web/src/app/cms/(authed)/media/media-library-page.tsx`:

```typescript
'use client'

import { useReducer, useEffect, useCallback, useRef, useState, useTransition } from 'react'
import { mediaLibraryReducer, initialState } from './media-library-reducer'
import {
  listMediaAssetsWithUsageAction,
  getMediaStatsAction,
  getAssetUsagesAction,
  softDeleteMediaAssetAction,
  bulkDeleteMediaAssetsAction,
  updateMediaAssetAction,
} from './actions'
import { getMediaGalleryStrings } from '../_shared/media/_i18n/types'
import type { MediaAssetResult } from '../_shared/media/types'
import type { EnrichedMediaAsset, MediaSortOption, MediaViewMode, MediaColumnCount } from '../_shared/media/types'
import type { MediaStats } from '@/lib/media/queries'

import { StorageBar } from './_components/storage-bar'
import { MediaToolbar } from './_components/media-toolbar'
import { MediaGrid } from './_components/media-grid'
import { MediaList } from './_components/media-list'
import { SkeletonGrid } from './_components/skeleton-grid'
import { EmptyState } from './_components/empty-state'
import { DetailPanel } from './_components/detail-panel'
import { MediaLightbox } from './_components/media-lightbox'
import { BulkActionBar } from './_components/bulk-action-bar'
import { ContextMenu } from './_components/context-menu'
import { DeleteConfirmModal } from './_components/delete-confirm-modal'
import { DropOverlay } from './_components/drop-overlay'
import { MediaUploadTab } from '../_shared/media/media-upload-tab'

interface Props {
  locale: 'en' | 'pt-BR'
  siteId: string
}

export function MediaLibraryPage({ locale, siteId }: Props) {
  const t = getMediaGalleryStrings(locale)
  const [state, dispatch] = useReducer(mediaLibraryReducer, undefined, initialState)
  const [, startTransition] = useTransition()

  const [items, setItems] = useState<EnrichedMediaAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [stats, setStats] = useState<MediaStats | null>(null)
  const [usages, setUsages] = useState<Array<{ resourceType: string; resourceId: string; fieldName: string }>>([])
  const [showUpload, setShowUpload] = useState(false)
  const [deleteModal, setDeleteModal] = useState<{ ids: string[]; usageCount: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const lastCheckRef = useRef<string | null>(null)

  // ─── Data fetching ────────────────────────────────────────────────────────

  const sortItems = useCallback((arr: EnrichedMediaAsset[]): EnrichedMediaAsset[] => {
    const sorted = [...arr]
    switch (state.sort) {
      case 'newest': sorted.sort((a, b) => b.asset.createdAt.localeCompare(a.asset.createdAt)); break
      case 'oldest': sorted.sort((a, b) => a.asset.createdAt.localeCompare(b.asset.createdAt)); break
      case 'largest': sorted.sort((a, b) => b.asset.fileSize - a.asset.fileSize); break
      case 'smallest': sorted.sort((a, b) => a.asset.fileSize - b.asset.fileSize); break
      case 'name': sorted.sort((a, b) => a.asset.filename.localeCompare(b.asset.filename)); break
    }
    return sorted
  }, [state.sort])

  const fetchAssets = useCallback(
    async (cursor?: string) => {
      dispatch({ type: 'SET_LOADING', loading: true })

      const result = await listMediaAssetsWithUsageAction({
        search: state.search || undefined,
        cursor,
        limit: 24,
      })

      if (result.ok) {
        const enriched: EnrichedMediaAsset[] = result.assets.map((a) => ({
          asset: a.asset,
          type: a.type,
          usageCount: a.usageCount,
          primaryFieldName: a.primaryFieldName,
        }))

        if (cursor) {
          setItems((prev) => sortItems([...prev, ...enriched]))
        } else {
          setItems(sortItems(enriched))
        }
        setNextCursor(result.nextCursor)
      }
      dispatch({ type: 'SET_LOADING', loading: false })
    },
    [state.search, sortItems],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setItems([])
      setNextCursor(null)
      fetchAssets()
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [fetchAssets])

  useEffect(() => {
    getMediaStatsAction().then((res) => {
      if (res.ok) setStats(res.stats)
    }).catch(() => {})
  }, [])

  // Fetch usages for selected asset
  useEffect(() => {
    if (!state.selectedId) { setUsages([]); return }
    getAssetUsagesAction(state.selectedId).then((res) => {
      if (res.ok) setUsages(res.usages)
    }).catch(() => {})
  }, [state.selectedId])

  // ─── Filter counts ────────────────────────────────────────────────────────

  const filterCounts = {
    all: items.length,
    cover: items.filter((i) => i.type === 'cover').length,
    inline: items.filter((i) => i.type === 'inline').length,
    avatar: items.filter((i) => i.type === 'avatar').length,
    og: items.filter((i) => i.type === 'og').length,
    orphan: items.filter((i) => i.type === 'orphan').length,
  }

  const filteredItems = state.filter === 'all' ? items : items.filter((i) => i.type === state.filter)
  const selectedAsset = items.find((i) => i.asset.id === state.selectedId)?.asset ?? null

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string) => {
    dispatch({ type: 'SELECT_ITEM', id })
  }, [])

  const handleCheck = useCallback((id: string, shiftKey: boolean) => {
    if (shiftKey && lastCheckRef.current) {
      const ids = filteredItems.map((i) => i.asset.id)
      const start = ids.indexOf(lastCheckRef.current)
      const end = ids.indexOf(id)
      if (start !== -1 && end !== -1) {
        const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1)
        dispatch({ type: 'CHECK_RANGE', ids: range })
        lastCheckRef.current = id
        return
      }
    }
    dispatch({ type: 'TOGGLE_CHECK', id })
    lastCheckRef.current = id
  }, [filteredItems])

  const handleQuickAction = useCallback((id: string, action: string) => {
    const asset = items.find((i) => i.asset.id === id)?.asset
    if (!asset) return

    switch (action) {
      case 'preview':
        dispatch({ type: 'OPEN_LIGHTBOX', id })
        break
      case 'download':
        window.open(asset.blobUrl, '_blank')
        break
      case 'copy-url':
        navigator.clipboard.writeText(asset.blobUrl).catch(() => {})
        break
      case 'delete':
        setDeleteModal({ ids: [id], usageCount: 0 })
        break
    }
  }, [items])

  const handleContextAction = useCallback((action: string) => {
    if (!contextMenu) return
    handleQuickAction(contextMenu.id, action)
    if (action === 'edit-alt') {
      dispatch({ type: 'SELECT_ITEM', id: contextMenu.id })
    }
  }, [contextMenu, handleQuickAction])

  const handleUpdateAsset = useCallback(
    (assetId: string, updates: { altText?: string; tags?: string[]; folder?: string }) => {
      startTransition(async () => {
        await updateMediaAssetAction(assetId, updates)
        fetchAssets()
      })
    },
    [fetchAssets],
  )

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal) return
    if (deleteModal.ids.length === 1) {
      await softDeleteMediaAssetAction(deleteModal.ids[0])
    } else {
      await bulkDeleteMediaAssetsAction(deleteModal.ids)
    }
    setDeleteModal(null)
    dispatch({ type: 'UNCHECK_ALL' })
    fetchAssets()
    getMediaStatsAction().then((res) => { if (res.ok) setStats(res.stats) }).catch(() => {})
  }, [deleteModal, fetchAssets])

  const handleBulkDelete = useCallback(() => {
    setDeleteModal({ ids: [...state.checked], usageCount: 0 })
  }, [state.checked])

  const handleBulkDownload = useCallback(() => {
    for (const id of state.checked) {
      const asset = items.find((i) => i.asset.id === id)?.asset
      if (asset) window.open(asset.blobUrl, '_blank')
    }
  }, [state.checked, items])

  const handleUploadComplete = useCallback((_asset: MediaAssetResult) => {
    setShowUpload(false)
    setItems([])
    setNextCursor(null)
    fetchAssets()
    getMediaStatsAction().then((res) => { if (res.ok) setStats(res.stats) }).catch(() => {})
  }, [fetchAssets])

  // Lightbox navigation
  const lightboxAsset = state.lightboxId ? items.find((i) => i.asset.id === state.lightboxId)?.asset ?? null : null
  const lightboxIndex = state.lightboxId ? filteredItems.findIndex((i) => i.asset.id === state.lightboxId) : -1

  const handleLightboxPrev = useCallback(() => {
    if (lightboxIndex > 0) {
      dispatch({ type: 'OPEN_LIGHTBOX', id: filteredItems[lightboxIndex - 1].asset.id })
    }
  }, [lightboxIndex, filteredItems])

  const handleLightboxNext = useCallback(() => {
    if (lightboxIndex < filteredItems.length - 1) {
      dispatch({ type: 'OPEN_LIGHTBOX', id: filteredItems[lightboxIndex + 1].asset.id })
    }
  }, [lightboxIndex, filteredItems])

  // Focused card index for arrow navigation
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('[data-testid="media-search"]')?.focus()
      }
      if (e.key === 'Escape') {
        if (state.lightboxId) dispatch({ type: 'CLOSE_LIGHTBOX' })
        else if (state.selectedId) dispatch({ type: 'SELECT_ITEM', id: state.selectedId })
        else if (state.search) dispatch({ type: 'SET_SEARCH', search: '' })
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.checked.size > 0) handleBulkDelete()
      }

      // Arrow key grid navigation (column-aware)
      const cols = state.view === 'list' ? 1 : state.cols
      if (e.key === 'ArrowRight' && focusedIndex < filteredItems.length - 1) {
        e.preventDefault(); setFocusedIndex((i) => Math.min(i + 1, filteredItems.length - 1))
      }
      if (e.key === 'ArrowLeft' && focusedIndex > 0) {
        e.preventDefault(); setFocusedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setFocusedIndex((i) => Math.min(i + cols, filteredItems.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); setFocusedIndex((i) => Math.max(i - cols, 0))
      }
      if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
        dispatch({ type: 'SELECT_ITEM', id: filteredItems[focusedIndex].asset.id })
      }
      if (e.key === ' ' && focusedIndex >= 0 && focusedIndex < filteredItems.length) {
        e.preventDefault()
        dispatch({ type: 'TOGGLE_CHECK', id: filteredItems[focusedIndex].asset.id })
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.lightboxId, state.selectedId, state.search, state.checked.size, state.view, state.cols, handleBulkDelete, focusedIndex, filteredItems])

  // Drag & drop
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e: DragEvent) => { e.preventDefault(); setIsDragging(false); setShowUpload(true) }

    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDrop)
    }
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 px-6 py-4 motion-reduce:*:!transition-none motion-reduce:*:!animate-none">
      {/* Screen reader announcements */}
      <div aria-live="polite" className="sr-only" id="media-announcements" />

      {/* Upload panel (collapsible) */}
      {showUpload && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-cms-text">{t.tabs.upload}</h3>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-xs text-cms-text-muted hover:text-cms-text"
            >
              {t.modal.close}
            </button>
          </div>
          <MediaUploadTab
            onSelect={handleUploadComplete}
            locale={locale}
            siteId={siteId}
          />
        </div>
      )}

      {/* Storage bar */}
      {stats && (
        <StorageBar
          folderBreakdown={stats.folderBreakdown}
          totalSizeBytes={stats.totalSizeBytes}
          orphanCount={stats.orphanCount}
          t={t}
        />
      )}

      {/* Toolbar */}
      <MediaToolbar
        filter={state.filter}
        search={state.search}
        sort={state.sort}
        view={state.view}
        cols={state.cols}
        resultCount={filteredItems.length}
        totalCount={items.length}
        checkedCount={state.checked.size}
        filterCounts={filterCounts}
        onFilterChange={(f) => dispatch({ type: 'SET_FILTER', filter: f })}
        onSearchChange={(s) => dispatch({ type: 'SET_SEARCH', search: s })}
        onSortChange={(s) => dispatch({ type: 'SET_SORT', sort: s })}
        onViewChange={(v) => dispatch({ type: 'SET_VIEW', view: v })}
        onColsChange={(c) => dispatch({ type: 'SET_COLS', cols: c })}
        onSelectAll={() => dispatch({ type: 'CHECK_ALL', ids: filteredItems.map((i) => i.asset.id) })}
        onDeselectAll={() => dispatch({ type: 'UNCHECK_ALL' })}
        t={t}
      />

      {/* Upload button */}
      {!showUpload && (
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="self-start rounded-md bg-cms-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cms-accent/90"
        >
          {t.tabs.upload}
        </button>
      )}

      {/* Content area */}
      <div className={`flex-1 ${state.selectedId ? 'mr-[396px]' : ''} transition-all duration-300`}>
        {state.isLoading && items.length === 0 ? (
          <SkeletonGrid cols={state.cols} />
        ) : filteredItems.length === 0 ? (
          <EmptyState filter={state.filter} searchQuery={state.search} t={t} />
        ) : state.view === 'grid' ? (
          <MediaGrid
            items={filteredItems}
            checked={state.checked}
            selectedId={state.selectedId}
            cols={state.cols}
            searchQuery={state.search}
            onSelect={handleSelect}
            onCheck={handleCheck}
            onQuickAction={handleQuickAction}
            onContextMenu={(id, x, y) => setContextMenu({ id, x, y })}
          />
        ) : (
          <MediaList
            items={filteredItems}
            checked={state.checked}
            selectedId={state.selectedId}
            onSelect={handleSelect}
            onCheck={handleCheck}
          />
        )}

        {/* Load more */}
        {nextCursor && !state.isLoading && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={() => fetchAssets(nextCursor)}
              className="rounded-md border border-cms-border px-4 py-2 text-sm text-cms-text-muted hover:bg-cms-surface-hover"
            >
              {t.library.loadMore}
            </button>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <DetailPanel
        asset={selectedAsset}
        tab={state.detailTab}
        usages={usages}
        onTabChange={(tab) => dispatch({ type: 'SET_DETAIL_TAB', tab })}
        onClose={() => state.selectedId && dispatch({ type: 'SELECT_ITEM', id: state.selectedId })}
        onUpdateAsset={handleUpdateAsset}
        onCopyUrl={(url) => navigator.clipboard.writeText(url).catch(() => {})}
        onReplace={() => setShowUpload(true)}
        onDelete={(id) => setDeleteModal({ ids: [id], usageCount: usages.length })}
        onOpenLightbox={(id) => dispatch({ type: 'OPEN_LIGHTBOX', id })}
        t={t}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        count={state.checked.size}
        onDeselect={() => dispatch({ type: 'UNCHECK_ALL' })}
        onDownload={handleBulkDownload}
        onDelete={handleBulkDelete}
        t={t}
      />

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          assetId={contextMenu.id}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
          t={t}
        />
      )}

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={deleteModal !== null}
        count={deleteModal?.ids.length ?? 0}
        usageCount={deleteModal?.usageCount ?? 0}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModal(null)}
        t={t}
      />

      {/* Lightbox */}
      <MediaLightbox
        asset={lightboxAsset}
        currentIndex={lightboxIndex}
        totalCount={filteredItems.length}
        onPrev={handleLightboxPrev}
        onNext={handleLightboxNext}
        onClose={() => dispatch({ type: 'CLOSE_LIGHTBOX' })}
        t={t}
      />

      {/* Drop overlay */}
      <DropOverlay active={isDragging} t={t} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/media-library-page.tsx
git commit -m "feat(media): add MediaLibraryPage wiring all components together"
```

---

### Task 15: Update `page.tsx` — Swap to New Component

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/media/page.tsx`

- [ ] **Step 1: Update imports and render**

Replace the content of `apps/web/src/app/cms/(authed)/media/page.tsx`:

```typescript
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { MediaLibraryPage as MediaLibraryClient } from './media-library-page'

export default async function MediaPage() {
  const { siteId, defaultLocale } = await getSiteContext()
  const locale = (defaultLocale === 'pt-BR' ? 'pt-BR' : 'en') as 'en' | 'pt-BR'

  return (
    <div>
      <CmsTopbar title={locale === 'pt-BR' ? 'Mídia' : 'Media'} />
      <MediaLibraryClient locale={locale} siteId={siteId} />
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

Run: `cd apps/web && npx vitest run test/cms/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/media/page.tsx
git commit -m "feat(media): swap page.tsx to use new MediaLibraryPage component"
```

---

### Task 16: Refactor MediaGalleryModal to Use Shared Components

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/media/media-gallery-modal.tsx`

- [ ] **Step 1: Update modal to use shared MediaGrid and MediaCard**

Replace the library tab section in the modal to use the new `MediaGrid` component in compact mode. The modal keeps its existing `MediaUploadTab` and `MediaLibraryTab` but the library tab will be updated to import `MediaGrid` from the standalone page's `_components/` directory.

In `media-gallery-modal.tsx`, update the library tab import:

```typescript
import { MediaLibraryTab } from './media-library-tab'
```

> **Note:** The `MediaLibraryTab` already works. The goal here is visual consistency: updating the card rendering inside `MediaLibraryTab` to use the new `MediaCard` component. However, `MediaLibraryTab` is tightly coupled to the modal's select/crop flow. The refactor should be minimal:
>
> 1. Import `MediaCard` into `media-library-tab.tsx`
> 2. Replace the bare thumbnail buttons with `<MediaCard compact />` inside the grid
> 3. Pass `onSelect` that feeds into the crop workflow

This is a targeted refactor of `media-library-tab.tsx`'s grid rendering, not a full rewrite. The crop flow, double-click selection, and dimension warnings remain unchanged.

- [ ] **Step 2: Run existing modal tests**

Run: `cd apps/web && npx vitest run test/cms/media-gallery-modal.test.tsx test/cms/media-crop-editor.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/media/
git commit -m "refactor(media): update MediaGalleryModal to use shared MediaCard for visual consistency"
```

---

### Task 17: Cleanup and Full Test Suite

**Files:**
- Delete: `apps/web/src/app/cms/(authed)/media/media-library-connected.tsx`

- [ ] **Step 1: Remove old component**

Delete `apps/web/src/app/cms/(authed)/media/media-library-connected.tsx`. The `page.tsx` no longer imports it.

- [ ] **Step 2: Check for any remaining imports of the old component**

Run: `grep -r "media-library-connected" apps/web/src/`
Expected: No results

Run: `grep -r "MediaLibraryConnected" apps/web/src/`
Expected: No results

- [ ] **Step 3: Run full test suite**

Run: `cd apps/web && npx vitest run`
Expected: PASS (all tests)

- [ ] **Step 4: Run TypeScript type check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git rm apps/web/src/app/cms/(authed)/media/media-library-connected.tsx
git commit -m "chore(media): remove old MediaLibraryConnected component"
```

- [ ] **Step 6: Start dev server and verify in browser**

Run: `cd apps/web && npm run dev`

Open `http://localhost:3000/cms/media` in browser. Verify:
- Storage bar renders with color-coded segments
- Grid view shows type-colored cards with left borders
- Search works with live result count
- Filter pills work and show counts
- Sort, column density, and view toggle work
- Clicking a card opens the detail panel
- Detail panel shows metadata, tags, alt text editor
- Lightbox opens on preview quick action with prev/next
- Bulk select with checkboxes and shift-click range selection
- Context menu on right-click
- Delete confirmation modal with usage warning
- Drag & drop shows overlay
- Keyboard shortcuts (⌘K, Escape, arrows)
- All text matches locale (test both en and pt-BR)
