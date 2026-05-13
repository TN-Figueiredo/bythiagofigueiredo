# Pipeline Category + Cover Image — Design Spec

## Goal

Add `category` and `cover_image_url` fields to pipeline items so they transfer to blog posts on graduation, eliminating the hardcoded `'building'` category and enabling cover image pre-selection during the pipeline workflow.

## Context

- Blog categories: `stories`, `building`, `money`, `bts` (CHECK constraint on `blog_posts.category`)
- Graduate route currently hardcodes `category: 'building'`
- Pipeline has no image field — cover images can only be added after graduation in the blog editor
- `MediaGalleryModal` + `useMediaGallery()` already exist in `_shared/media/`
- `CROP_PRESETS['blog-cover']` = 16:9, max 1200x675

## Schema — Migration

```sql
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

ALTER TABLE public.content_pipeline
  ADD CONSTRAINT content_pipeline_category_check
  CHECK (category IS NULL OR category IN ('stories', 'building', 'money', 'bts'));
```

Both nullable. `category` NULL = not chosen yet (fallback to `'building'` on graduation).

## API — PATCH Schema

Add to `PipelineItemUpdateSchema` in `lib/pipeline/schemas.ts`:

- `category`: `z.enum(['stories', 'building', 'money', 'bts']).nullable().optional()`
- `cover_image_url`: `z.string().url().max(2000).nullable().optional()`

The PATCH endpoint at `api/pipeline/items/[id]/route.ts` already dynamically builds the update object from parsed fields — no changes needed there beyond the schema.

## UI — Pipeline Item Detail

### Cover Image

Position: between breadcrumb and title input (mirroring blog editor layout).

- No image: clickable placeholder "Adicionar capa" with image icon
- Has image: thumbnail with hover overlay showing "Trocar" and "Remover" buttons
- Click opens `MediaGalleryModal` with `folder: 'pipeline'`, `cropPreset: CROP_PRESETS['blog-cover']`
- Save: PATCH `cover_image_url` to pipeline item
- Remove: PATCH `cover_image_url: null`

### Category Dropdown

Position: sidebar "Detalhes" card, after Format field.

- **Only visible when `format === 'blog_post'`**
- Select with 4 options: Stories, Building, Money, BTS
- Placeholder: "Categoria" (shows when NULL)
- Save: PATCH `category` on change (immediate, no debounce needed for select)

## Graduation — Transfer

### Graduate API Route (`/api/pipeline/items/[id]/graduate`)

```typescript
// Replace hardcoded category:
category: item.category ?? 'building',

// Add cover image to blog_posts insert:
cover_image_url: item.cover_image_url ?? null,
```

Cover image goes to `blog_posts.cover_image_url` only (not per-locale translations). User can set per-locale covers later in the blog editor.

### Server Action (`createPostFromPipeline`)

- Add `category, cover_image_url` to `select()` query
- After `createPost()`, update `blog_posts` with both fields:
  ```typescript
  await svc.from('blog_posts').update({
    category: item.category ?? 'building',
    cover_image_url: item.cover_image_url ?? null,
  }).eq('id', result.postId)
  ```

## Cowork Reference Doc

Update `docs/cowork-pipeline-reference.md`:
- Add `category` to blog_post format fields (values: stories, building, money, bts)
- Add `cover_image_url` as global pipeline item field
- Re-seed after update

## Testing

- Schema: category enum validation, cover_image_url URL validation, nullable
- Graduate: category transferred (custom + fallback), cover_image_url transferred
- createPostFromPipeline: same coverage
- Backward compat: NULL category = 'building' default
