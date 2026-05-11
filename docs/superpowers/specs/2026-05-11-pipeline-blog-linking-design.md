# Pipeline ↔ Blog Post Linking — Design Spec

Link pipeline items to blog posts with optional bidirectional navigation and automatic status sync.

## Principles

- **No new coupling on blog_posts** — blog_posts table stays unchanged
- **Single source of truth** — `content_pipeline.blog_post_id` FK (already exists)
- **Optional, not mandatory** — pipeline items don't need a blog post, posts don't need a pipeline item
- **1:1 cardinality** — one pipeline item maps to at most one blog post (enforced by UNIQUE constraint)

---

## 1. Data Model

### Migration (micro — no changes to blog_posts)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_blog_post_id
  ON public.content_pipeline(blog_post_id)
  WHERE blog_post_id IS NOT NULL;
```

This single index solves three problems:
- **Performance**: O(1) reverse lookup (blog post → pipeline item)
- **1:1 enforcement**: two pipeline items cannot claim the same blog post
- **NULL-safe**: multiple items without a link are allowed (NULLs don't count as duplicates)

### Existing infrastructure (no changes needed)

| What | Where | Status |
|------|-------|--------|
| FK `blog_post_id` | `content_pipeline` → `blog_posts.id` | Exists |
| `ON DELETE SET NULL` | FK cascade behavior | Exists |
| Graduate endpoint | `POST /items/[id]/graduate` | Exists |
| History table | `content_pipeline_history` | Exists |

### Reverse lookup helper

```typescript
// lib/pipeline/blog-link.ts
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export async function getPipelineItemForPost(postId: string) {
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, stage, format, priority')
    .eq('blog_post_id', postId)
    .maybeSingle()
  return data
}
```

Uses service client because: user has access to the blog post (they're in the editor), and pipeline info is provenance metadata. Normal RLS would block if GUC `app.site_id` doesn't match.

### History events

| Event | `event_type` | `from_value` | `to_value` | `changed_by` |
|-------|-------------|-------------|-----------|-------------|
| Graduate | `graduated` | — | `{postId}` | user ID |
| Link existing | `linked` | — | `{postId}` | user ID |
| Unlink | `unlinked` | `{postId}` | — | user ID |
| Auto stage sync | `stage_changed` | previous stage | new stage | `null` (system) |

---

## 2. Graduation & Linking Flows

### Flow 1 — Graduate (pipeline → creates new post)

Existing endpoint `POST /items/[id]/graduate` with refinements:
- **Pre-condition:** `blog_post_id IS NULL` (409 if already linked)
- **Pre-condition:** item has title (`title_pt` or `title_en`)
- Copies **title only** to blog post (status `'draft'`, no body content)
- Slug generated from title
- **Locale handling:** if `language = 'pt'` → one PT translation; if `language = 'en'` → one EN translation; if `language = 'both'` → two translations (PT + EN), each with its respective title
- Records `event_type: 'graduated'`
- No format guard — graduation already accepts `target: 'blog_post'` regardless of item format

### Flow 2 — Link existing post (from pipeline)

**New endpoint:** `POST /items/[id]/link`

```
Body: { blog_post_id: uuid }
Response: 200 { item } | 404 | 409 { error, linked_to_code }
```

- Validates post exists and belongs to same `site_id`
- Validates uniqueness (UNIQUE constraint + friendly error: "Post already linked to item {code}")
- Records `event_type: 'linked'`, `to_value: postId`
- If the post is already published → triggers immediate status sync
- Returns updated item with post info

### Flow 3 — Link from blog editor

**New server actions** in `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`:

```typescript
export async function linkToPipelineItem(
  postId: string,
  pipelineItemId: string
): Promise<{ ok: true } | { ok: false; error: string }>

export async function unlinkFromPipeline(
  postId: string
): Promise<{ ok: true } | { ok: false; error: string }>
```

These wrap the pipeline API — the blog editor never talks to pipeline API directly.

### Unlink (either side)

`POST /items/[id]/unlink` — sets `blog_post_id = NULL`, records `event_type: 'unlinked'`.

---

## 3. Status Sync (blog → pipeline, unidirectional)

### Rules

| Blog post status change | Pipeline item action |
|---|---|
| → `published` | Stage set to `published`, history `stage_changed` by system |
| `published` → anything else | Stage retreats to the stage recorded in history `from_value` of the auto-advance event (fallback: `ready`) |
| Post deleted | `ON DELETE SET NULL` — pipeline item loses link, keeps current stage |
| Pipeline item linked to already-published post | Sync fires **immediately** at link time |

### Implementation

```typescript
// lib/pipeline/blog-sync.ts
export async function syncPipelineOnPostStatusChange(
  postId: string,
  newStatus: string,
  oldStatus: string
): Promise<void> {
  const svc = getSupabaseServiceClient()
  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, stage, version')
    .eq('blog_post_id', postId)
    .maybeSingle()

  if (!item) return

  if (newStatus === 'published' && item.stage !== 'published') {
    const { error } = await svc.from('content_pipeline')
      .update({ stage: 'published', version: item.version + 1 })
      .eq('id', item.id)
      .eq('version', item.version) // optimistic lock

    if (error) {
      console.error('[blog-sync] Failed to advance pipeline item', item.id, error)
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: item.stage,
      to_value: 'published',
      changed_by: null,
    })
  }

  if (oldStatus === 'published' && newStatus !== 'published') {
    // Find the stage before auto-advance from history
    const { data: hist } = await svc.from('content_pipeline_history')
      .select('from_value')
      .eq('pipeline_id', item.id)
      .eq('event_type', 'stage_changed')
      .eq('to_value', 'published')
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const retreatTo = hist?.from_value || 'ready'

    const { error } = await svc.from('content_pipeline')
      .update({ stage: retreatTo, version: item.version + 1 })
      .eq('id', item.id)
      .eq('version', item.version)

    if (error) {
      console.error('[blog-sync] Failed to retreat pipeline item', item.id, error)
      return
    }

    await svc.from('content_pipeline_history').insert({
      pipeline_id: item.id,
      event_type: 'stage_changed',
      from_value: 'published',
      to_value: retreatTo,
      changed_by: null,
    })
  }
}
```

### Integration points

- **`movePost()`** — after successful CAS
- **`bulkPublish()`** — loop through each affected postId
- **`linkToPipelineItem()`** — check current post status; if published → sync immediately
- **Never blocks** the main operation — sync errors are logged, never propagated

### What does NOT sync

- Pipeline stage changes do NOT affect blog post status (unidirectional: blog → pipeline)
- Pipeline archive does NOT affect blog post
- This avoids loops and keeps blog as an independent system

---

## 4. UI — Pipeline Side

### Sidebar: "Blog Post" card (position: between Stage and Sections cards)

**State: no link (`blog_post_id IS NULL`)**

- Card shows "Nenhum post vinculado"
- Dropdown button "Vincular" with two options:
  - "Criar novo post" → calls graduate → stays on pipeline detail, shows toast "Blog post criado" with link "Abrir editor →"
  - "Buscar post existente" → opens search dialog

**Search dialog specs:**
- Input with debounce (300ms) queries `blog_translations.title` (`ilike %query%`)
- Results show: title, locale badges (PT/EN), status badge (draft/published), tag color dot
- Posts already linked to another pipeline item: shown **disabled** with tooltip "Vinculado a {code}"
- Max 10 results, scrollable
- Keyboard navigable (arrow keys + enter)
- Empty state: "Nenhum post encontrado. [Criar novo post]"

**State: linked (`blog_post_id` exists)**

- Card shows: post title, locale + status badges
- "Abrir editor →" button → navigates to blog editor (new tab)
- "Desvincular" in overflow menu (···) → confirm dialog: "Desvincular '{title}'? O post continuará existindo independentemente."
- If post published: left border accent green

### Kanban (GemCard): enhance existing graduated badge

`getCardState()` already returns `graduated: true` when `blog_post_id` is set. Enhancement:
- `graduated` + post `published` → green badge with check
- `graduated` + post `draft` → subtle amber badge
- Tooltip: "Blog post: {title} ({status})"
- No new icon — reuses and enriches the existing indicator

### Filter (PipelineFilterBar):

New dropdown **"Vínculo"** next to tags filter:
- Options: "Todos", "Com blog post", "Sem blog post"
- Query: `WHERE blog_post_id IS NOT NULL` / `IS NULL`
- Follows existing dropdown visual pattern

---

## 5. UI — Blog Side

### Editor header (edit-post-client.tsx)

Pipeline pill in the header area (next to locale badges):

**State: no link**
- Subtle pill: `[+ Pipeline]` in muted text — click opens search dialog
- Takes no space when not used

**State: linked**
- Colored pill: `[🔷 blog-meu-post · ready]` with stage color
- Click opens popover with: item title, stage, priority, "Abrir pipeline →", "Desvincular"
- Unlink → confirm dialog → calls `unlinkFromPipeline(postId)`

**Search dialog (same pattern as pipeline side):**
- Search by code or title
- Results show: code, title, format badge, stage badge
- Already-linked items: disabled
- Optimistic update: pill appears immediately, reverts if API fails
- Error: inline toast "Não foi possível vincular — post já associado a outro item"

### Blog hub editorial (kanban)

- Post cards with pipeline link: **small icon** (dot or micro-badge) in card corner
- Color: green if post+item published, amber if draft
- Tooltip: "Pipeline: blog-meu-post (ready)"
- No extra text on card — just the visual icon

### Server page data loading

```typescript
// blog/[id]/edit/page.tsx
const pipelineItem = await getPipelineItemForPost(postId)

<EditPostClient
  {...existingProps}
  initialPipelineItem={pipelineItem} // { id, code, title, stage, format, priority } | null
/>
```

---

## 6. Testing Strategy

### Unit tests
- `syncPipelineOnPostStatusChange`: mock supabase, test publish→advance, unpublish→retreat, no-link→noop
- `getPipelineItemForPost`: reverse lookup returns item or null
- Search helpers: search by title, filter linked items

### Integration tests (with local DB)
- Graduate → verify blog post created + FK set + history event
- Link → verify UNIQUE constraint (link same post to 2 items → error)
- Unlink → verify FK null + history event
- Status sync e2e: link item → publish post → verify stage changed
- ON DELETE SET NULL: delete post → verify pipeline item.blog_post_id = null
- Retreat: publish post → unpublish → verify pipeline item returns to previous stage

### Edge cases
- Link post that doesn't exist → 404
- Link post from another site → 403
- Graduate without title → 422
- Unlink item without link → noop (idempotent)
- Publish via bulkPublish → all linked items update
- Link to already-published post → immediate sync fires
- Version conflict during sync → logged, not propagated

---

## 7. Files to Create/Modify

### New files
| File | Purpose |
|------|---------|
| `lib/pipeline/blog-link.ts` | `getPipelineItemForPost`, search helpers |
| `lib/pipeline/blog-sync.ts` | `syncPipelineOnPostStatusChange` |
| `app/api/pipeline/items/[id]/link/route.ts` | Link endpoint |
| `app/api/pipeline/items/[id]/unlink/route.ts` | Unlink endpoint |
| `pipeline/_components/detail/blog-post-card.tsx` | Sidebar card component |
| `pipeline/_components/detail/blog-post-search-dialog.tsx` | Search dialog |
| `blog/[id]/edit/pipeline-pill.tsx` | Editor pipeline pill component |
| Migration: `YYYYMMDD_pipeline_blog_post_unique_idx.sql` | Partial unique index |

### Modified files
| File | Change |
|------|--------|
| `app/api/pipeline/items/[id]/graduate/route.ts` | Copy title only, not body_content |
| `app/cms/(authed)/blog/actions.ts` | Add sync call in `movePost()` and `bulkPublish()` |
| `app/cms/(authed)/blog/[id]/edit/actions.ts` | Add `linkToPipelineItem()`, `unlinkFromPipeline()` |
| `app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` | Add `initialPipelineItem` prop, render pipeline pill |
| `app/cms/(authed)/blog/[id]/edit/page.tsx` | Fetch pipeline item, pass as prop |
| `pipeline/_components/pipeline-item-detail.tsx` | Add BlogPostCard to sidebar |
| `pipeline/_components/gem-card.tsx` | Enhance graduated badge with status color |
| `pipeline/_components/pipeline-filter-bar.tsx` | Add "Vínculo" dropdown |
| `lib/pipeline/gem-design.ts` | Update `getCardState()` for linked post status |
| `app/cms/(authed)/blog/_hub/hub-client.tsx` | Add pipeline icon to post cards |

---

## Out of Scope (v1)

- Content sync beyond title (future: text editor in pipeline, full content transfer)
- Pipeline metrics in blog hub overview (conversion rate, etc.)
- Auto-suggest matches by title similarity
- Bulk link/unlink operations
- Newsletter/campaign linking UI (same pattern, separate spec)
