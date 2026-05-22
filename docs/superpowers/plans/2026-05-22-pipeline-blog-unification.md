# Pipeline-Blog Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify Blog and Pipeline into a single editing experience where Pipeline is the hub and blog_translations is a materialized cache.

**Architecture:** Pipeline JSONB sections are the source of truth. blog_translations is generated atomically at stage transitions via Supabase RPC. Stage keys unchanged; only labels change. Blog editor becomes read-only with redirect to pipeline.

**Tech Stack:** Next.js 15, React 19, Tailwind 4, Supabase (PostgreSQL 17), TipTap, Vitest, Zod

**Spec:** `docs/superpowers/specs/2026-05-22-pipeline-blog-unification-design.md`

---

## File Structure

### New files
- `supabase/migrations/YYYYMMDD_pipeline_blog_unification.sql` — category unification, materialized_rev columns, materialize RPC
- `apps/web/test/unit/pipeline/blog-extensions.test.ts` — tests for blog preset
- `apps/web/test/unit/pipeline/blog-validation.test.ts` — tests for blog-specific VVS factors
- `apps/web/test/unit/pipeline/materialize-blog.test.ts` — tests for materialization logic
- `apps/web/test/unit/pipeline/blog-kanban.test.ts` — tests for unified kanban lanes

### Modified files
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts` — add `getBlogExtensions()`
- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx` — expand to 12+ fields
- `apps/web/src/lib/pipeline/validation.ts` — add 4 blog-specific VVS factors
- `apps/web/src/lib/pipeline/draft-to-blog.ts` — expand BlogContentPatch to all fields
- `apps/web/src/lib/pipeline/workflows.ts` — update stage labels, expand PIPELINE_ONLY_STAGES
- `apps/web/src/lib/pipeline/sections.ts` — no changes needed (blog_post sections already defined)
- `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx` — sidebar collapse logic
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts` — 5 lanes pipeline-only
- `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts` — update LaneId type
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/unified-board.tsx` — single card type
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/pipeline-card.tsx` — extend for all stages
- `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/schedule-modal.tsx` — reuse for pipeline
- `apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md` — expand draft schema
- `apps/web/test/unit/pipeline/draft-to-blog.test.ts` — expand existing tests
- `apps/web/test/lib/pipeline-validation.test.ts` — expand existing tests
- `apps/web/test/unit/pipeline-workflows.test.ts` — update for new labels

---

## Phase 1: Database Foundation

### Task 1: Migration — Category Unification + Materialized Rev Columns

**Files:**
- Create: `supabase/migrations/YYYYMMDD_pipeline_blog_unification.sql`

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new pipeline_blog_unification
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- 1. Unify blog_posts category CHECK to accept pipeline values
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category = ANY (ARRAY[
    'stories'::text, 'building'::text, 'money'::text, 'bts'::text,
    -- Keep old values for backward compat during transition
    'tech'::text, 'vida'::text, 'viagem'::text, 'crescimento'::text, 'code'::text, 'negocio'::text
  ]));

-- 2. Migrate existing posts to new category values
UPDATE public.blog_posts SET category = 'building' WHERE category IN ('tech', 'code');
UPDATE public.blog_posts SET category = 'stories' WHERE category IN ('vida', 'viagem');
UPDATE public.blog_posts SET category = 'money' WHERE category = 'negocio';
UPDATE public.blog_posts SET category = 'bts' WHERE category = 'crescimento';

-- 3. Now tighten to only new values
ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_category_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_category_check
  CHECK (category = ANY (ARRAY['stories'::text, 'building'::text, 'money'::text, 'bts'::text]));

-- 4. Add materialized_rev tracking columns
ALTER TABLE public.content_pipeline
  ADD COLUMN IF NOT EXISTS materialized_rev_pt integer,
  ADD COLUMN IF NOT EXISTS materialized_rev_en integer;

COMMENT ON COLUMN public.content_pipeline.materialized_rev_pt IS
  'Draft rev at last materialization for PT locale. NULL = never materialized.';
COMMENT ON COLUMN public.content_pipeline.materialized_rev_en IS
  'Draft rev at last materialization for EN locale. NULL = never materialized.';

-- 5. Update pipeline_workflows label for "ready" stage
UPDATE public.pipeline_workflows
  SET label_pt = 'Entrega', label_en = 'Delivery'
  WHERE stage = 'ready' AND format = 'blog_post';
```

- [ ] **Step 3: Push migration to prod**

```bash
npm run db:push:prod
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(pipeline): migration — category unification + materialized_rev columns"
```

---

## Phase 2: Workflow & Stage Updates

### Task 2: Update PIPELINE_ONLY_STAGES and Stage Labels

**Files:**
- Modify: `apps/web/src/lib/pipeline/workflows.ts:98-100`
- Test: `apps/web/test/unit/pipeline-workflows.test.ts`

- [ ] **Step 1: Write failing tests for expanded stages**

In `apps/web/test/unit/pipeline-workflows.test.ts`, add:

```typescript
describe('blog_post full workflow', () => {
  it('includes all 5 stages for blog_post', () => {
    const stages = WORKFLOWS.blog_post
    expect(stages.map(s => s.stage)).toEqual(['idea', 'draft', 'ready', 'scheduled', 'published'])
  })

  it('getPipelineStages returns all 5 for blog_post', () => {
    const stages = getPipelineStages('blog_post')
    expect(stages).toHaveLength(5)
    expect(stages.map(s => s.stage)).toEqual(['idea', 'draft', 'ready', 'scheduled', 'published'])
  })

  it('ready stage has label Entrega/Delivery', () => {
    const ready = WORKFLOWS.blog_post.find(s => s.stage === 'ready')
    expect(ready?.label_pt).toBe('Entrega')
    expect(ready?.label_en).toBe('Delivery')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/unit/pipeline-workflows.test.ts --reporter=verbose
```

Expected: FAIL — `getPipelineStages` returns only 3 stages, label says "Pronto"

- [ ] **Step 3: Update workflows.ts**

In `apps/web/src/lib/pipeline/workflows.ts`, change the `ready` stage label at line ~22:

```typescript
// Change:
{ stage: 'ready', label_pt: 'Pronto', label_en: 'Ready', position: 3 },
// To:
{ stage: 'ready', label_pt: 'Entrega', label_en: 'Delivery', position: 3 },
```

Then update PIPELINE_ONLY_STAGES at line 98:

```typescript
// Change:
export const PIPELINE_ONLY_STAGES: Partial<Record<Format, string[]>> = {
  blog_post: ['idea', 'draft', 'ready'],
}
// To:
export const PIPELINE_ONLY_STAGES: Partial<Record<Format, string[]>> = {}
```

By removing `blog_post` from `PIPELINE_ONLY_STAGES`, `getPipelineStages()` will return the full 5-stage workflow since the filter only applies when an entry exists.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/unit/pipeline-workflows.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/workflows.ts apps/web/test/unit/pipeline-workflows.test.ts
git commit -m "feat(pipeline): expand blog_post to 5 stages, rename ready to Entrega"
```

---

## Phase 3: TipTap Blog Preset

### Task 3: Create getBlogExtensions() Preset

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts:86-91`
- Create: `apps/web/test/unit/pipeline/blog-extensions.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/web/test/unit/pipeline/blog-extensions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getExtensions } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions'

describe('getBlogExtensions', () => {
  it('returns extensions for blog preset', () => {
    const extensions = getExtensions('blog')
    expect(extensions).toBeDefined()
    expect(extensions.length).toBeGreaterThan(0)
  })

  it('includes H1 headings via StarterKit', () => {
    const extensions = getExtensions('blog')
    const starterKit = extensions.find(
      (ext: any) => ext.name === 'starterKit' || ext.options?.heading?.levels?.includes(1)
    )
    expect(starterKit).toBeDefined()
  })

  it('includes MergeTag extension', () => {
    const extensions = getExtensions('blog')
    const names = extensions.map((e: any) => e.name).filter(Boolean)
    expect(names).toContain('mergeTag')
  })

  it('includes CTAButton extension', () => {
    const extensions = getExtensions('blog')
    const names = extensions.map((e: any) => e.name).filter(Boolean)
    expect(names).toContain('ctaButton')
  })

  it('includes PlaylistEmbed extension', () => {
    const extensions = getExtensions('blog')
    const names = extensions.map((e: any) => e.name).filter(Boolean)
    expect(names).toContain('playlistEmbed')
  })

  it('includes SocialEmbed extension', () => {
    const extensions = getExtensions('blog')
    const names = extensions.map((e: any) => e.name).filter(Boolean)
    expect(names).toContain('socialEmbed')
  })

  it('has more extensions than full preset', () => {
    const blog = getExtensions('blog')
    const full = getExtensions('full')
    expect(blog.length).toBeGreaterThan(full.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/unit/pipeline/blog-extensions.test.ts --reporter=verbose
```

Expected: FAIL — `getExtensions('blog')` not recognized

- [ ] **Step 3: Implement getBlogExtensions()**

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts`, add imports at top:

```typescript
import { MergeTagExtension } from '@/app/cms/(authed)/_shared/editor/merge-tag-node'
import { CTAButtonExtension } from '@/app/cms/(authed)/_shared/editor/cta-button-node'
import { PlaylistEmbedExtension } from '@/app/cms/(authed)/_shared/editor/playlist-embed-node'
import { createSlashCommandExtension } from '@/app/cms/(authed)/_shared/editor/slash-commands'
```

Then add the new function after `getCompactExtensions`:

```typescript
export function getBlogExtensions(options: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    PipelineImageExtension.configure({
      inline: false,
      HTMLAttributes: { loading: 'lazy' },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Start writing your post... Type / for commands',
    }),
    CharacterCount,
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutExtension,
    ToggleWrapperExtension,
    ToggleTitleExtension,
    ToggleBodyExtension,
    ColumnsExtension,
    ColumnExtension,
    SocialEmbedExtension,
    MergeTagExtension,
    CTAButtonExtension,
    PlaylistEmbedExtension,
    createSlashCommandExtension({
      onH1: () => {}, onH2: () => {}, onH3: () => {},
      onBulletList: () => {}, onOrderedList: () => {},
      onTaskList: () => {}, onBlockquote: () => {},
      onCallout: () => {}, onToggle: () => {},
      onImage: () => {},
    }),
  ]
}
```

Update the `getExtensions` function:

```typescript
export function getExtensions(
  preset: 'full' | 'compact' | 'blog',
  options: ExtensionOptions = {},
): Extensions {
  if (preset === 'blog') return getBlogExtensions(options)
  return preset === 'full' ? getFullExtensions(options) : getCompactExtensions(options)
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/unit/pipeline/blog-extensions.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts apps/web/test/unit/pipeline/blog-extensions.test.ts
git commit -m "feat(pipeline): add blog TipTap preset with MergeTag, CTA, PlaylistEmbed, H1"
```

---

## Phase 4: VVS Score Rebalancing

### Task 4: Add Blog-Specific VVS Factors

**Files:**
- Modify: `apps/web/src/lib/pipeline/validation.ts:4-69`
- Test: `apps/web/test/lib/pipeline-validation.test.ts`

- [ ] **Step 1: Write failing tests for new factors**

In `apps/web/test/lib/pipeline-validation.test.ts`, add:

```typescript
describe('blog_post format-specific validation', () => {
  const blogBase: ValidationInput = {
    title_pt: 'Test Title',
    title_en: null,
    hook: 'A compelling hook',
    synopsis: 'Synopsis text',
    body_content: 'Some body content here',
    tags: ['tag1'],
    production_checklist: [{ label: 'item', done: true }],
    format_metadata: {},
    format: 'blog_post',
    sections: {
      draft_pt: { rev: 1, content: { slug: 'test-slug', excerpt: 'An excerpt' }, source: 'user', edited: true, updated_at: new Date().toISOString() },
      seo_pt: { rev: 1, content: { meta_title: 'Meta Title', meta_description: 'Meta desc' }, source: 'user', edited: true, updated_at: new Date().toISOString() },
      images_shared: { rev: 1, content: { cover: { image_url: 'https://example.com/img.jpg' } }, source: 'user', edited: true, updated_at: new Date().toISOString() },
    },
  }

  it('includes has_slug factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_slug).toBe(true)
  })

  it('has_slug is false when slug missing', () => {
    const input = {
      ...blogBase,
      sections: {
        ...blogBase.sections,
        draft_pt: { rev: 1, content: {}, source: 'user', edited: true, updated_at: new Date().toISOString() },
      },
    }
    const result = computeValidationScore(input)
    expect(result.breakdown.has_slug).toBe(false)
  })

  it('includes has_excerpt factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_excerpt).toBe(true)
  })

  it('includes has_seo factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_seo).toBe(true)
  })

  it('includes has_cover factor for blog_post', () => {
    const result = computeValidationScore(blogBase)
    expect(result.breakdown.has_cover).toBe(true)
  })

  it('blog_post weights sum to 100', () => {
    const result = computeValidationScore(blogBase)
    expect(result.overall).toBeLessThanOrEqual(100)
    expect(result.overall).toBeGreaterThan(0)
  })

  it('non-blog format does not include blog factors', () => {
    const videoInput = { ...blogBase, format: 'video' as const, sections: undefined }
    const result = computeValidationScore(videoInput)
    expect(result.breakdown).not.toHaveProperty('has_slug')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/lib/pipeline-validation.test.ts --reporter=verbose
```

Expected: FAIL — no `has_slug` in breakdown, `sections` not in ValidationInput

- [ ] **Step 3: Update ValidationInput and computeValidationScore**

In `apps/web/src/lib/pipeline/validation.ts`:

Update the `ValidationInput` interface:

```typescript
interface ValidationInput {
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  format_metadata: Record<string, unknown>
  format: Format
  sections?: Record<string, { rev: number; content: unknown; source: string; edited: boolean; updated_at: string }> | null
}
```

Update the `ValidationScore` breakdown type to include optional blog fields:

```typescript
export interface ValidationScore {
  overall: number
  breakdown: {
    has_title: boolean
    has_hook: boolean
    has_synopsis: boolean
    has_body: boolean
    has_tags: boolean
    checklist_pct: number
    metadata_complete: boolean
    has_slug?: boolean
    has_excerpt?: boolean
    has_seo?: boolean
    has_cover?: boolean
  }
  computed_at: string
}
```

Add blog-specific weight maps and extraction helpers:

```typescript
const WEIGHTS_DEFAULT: Record<string, number> = {
  has_title: 20, has_hook: 15, has_synopsis: 10, has_body: 20,
  has_tags: 10, checklist_pct: 15, metadata_complete: 10,
}

const WEIGHTS_BLOG: Record<string, number> = {
  has_title: 12, has_hook: 10, has_synopsis: 8, has_body: 15,
  has_tags: 10, checklist_pct: 15, metadata_complete: 10,
  has_slug: 5, has_excerpt: 5, has_seo: 5, has_cover: 5,
}

function extractSectionField(sections: ValidationInput['sections'], key: string, field: string): unknown {
  if (!sections) return null
  const section = sections[key]
  if (!section?.content || typeof section.content !== 'object') return null
  return (section.content as Record<string, unknown>)[field] ?? null
}

function hasSectionStringField(sections: ValidationInput['sections'], key: string, field: string): boolean {
  const val = extractSectionField(sections, key, field)
  return typeof val === 'string' && val.trim().length > 0
}
```

Update `computeValidationScore` to check blog factors when `format === 'blog_post'`:

```typescript
export function computeValidationScore(input: ValidationInput): ValidationScore {
  const isBlog = input.format === 'blog_post'
  const weights = isBlog ? WEIGHTS_BLOG : WEIGHTS_DEFAULT

  const has_title = !!(input.title_pt?.trim() || input.title_en?.trim())
  const has_hook = !!input.hook?.trim()
  const has_synopsis = !!input.synopsis?.trim()
  const has_body = !!input.body_content?.trim()
  const has_tags = input.tags.length > 0
  const total = input.production_checklist.length
  const done = input.production_checklist.filter(c => c.done).length
  const checklist_pct = total > 0 ? done / total : 0
  const nonEmpty = Object.values(input.format_metadata).filter(v => v !== null && v !== undefined && v !== '').length
  const metadata_complete = Object.keys(input.format_metadata).length > 0 && nonEmpty === Object.keys(input.format_metadata).length

  const breakdown: ValidationScore['breakdown'] = {
    has_title, has_hook, has_synopsis, has_body, has_tags,
    checklist_pct, metadata_complete,
  }

  let overall = 0
  overall += has_title ? weights.has_title : 0
  overall += has_hook ? weights.has_hook : 0
  overall += has_synopsis ? weights.has_synopsis : 0
  overall += has_body ? weights.has_body : 0
  overall += has_tags ? weights.has_tags : 0
  overall += checklist_pct * weights.checklist_pct
  overall += metadata_complete ? weights.metadata_complete : 0

  if (isBlog) {
    const draftKey = input.sections?.draft_pt ? 'draft_pt' : 'draft_en'
    const seoKey = input.sections?.seo_pt ? 'seo_pt' : 'seo_en'

    const has_slug = hasSectionStringField(input.sections, draftKey, 'slug')
    const has_excerpt = hasSectionStringField(input.sections, draftKey, 'excerpt')
    const meta_title = hasSectionStringField(input.sections, seoKey, 'meta_title')
    const meta_desc = hasSectionStringField(input.sections, seoKey, 'meta_description')
    const has_seo = meta_title && meta_desc

    const coverContent = extractSectionField(input.sections, 'images_shared', 'cover')
    const has_cover = !!(coverContent && typeof coverContent === 'object' && (coverContent as Record<string, unknown>).image_url)

    breakdown.has_slug = has_slug
    breakdown.has_excerpt = has_excerpt
    breakdown.has_seo = has_seo
    breakdown.has_cover = has_cover

    overall += has_slug ? weights.has_slug : 0
    overall += has_excerpt ? weights.has_excerpt : 0
    overall += has_seo ? weights.has_seo : 0
    overall += has_cover ? weights.has_cover : 0
  }

  return {
    overall: Math.round(overall),
    breakdown,
    computed_at: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run test/lib/pipeline-validation.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/validation.ts apps/web/test/lib/pipeline-validation.test.ts
git commit -m "feat(pipeline): blog-specific VVS factors — slug, excerpt, seo, cover"
```

---

## Phase 5: Expand Draft-to-Blog Materialization

### Task 5: Expand BlogContentPatch and prepareBlogTranslationPatch

**Files:**
- Modify: `apps/web/src/lib/pipeline/draft-to-blog.ts:4-71`
- Test: `apps/web/test/unit/pipeline/draft-to-blog.test.ts`

- [ ] **Step 1: Write failing tests for expanded fields**

In `apps/web/test/unit/pipeline/draft-to-blog.test.ts`, add:

```typescript
describe('expanded blog fields', () => {
  const sections = {
    draft_pt: {
      rev: 3,
      content: {
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
        title: 'Meu Post',
        slug: 'meu-post',
        excerpt: 'Um resumo do post',
        key_points: ['ponto 1', 'ponto 2'],
        pull_quote: 'Uma citacao importante',
        notes: ['nota 1'],
        colophon: 'Creditos finais',
        tag_id: '550e8400-e29b-41d4-a716-446655440000',
        hashtag_ids: ['660e8400-e29b-41d4-a716-446655440001'],
        cover_image_url: 'https://example.com/cover.jpg',
      },
      source: 'user',
      edited: true,
      updated_at: new Date().toISOString(),
    },
    seo_pt: {
      rev: 2,
      content: {
        meta_title: 'SEO Title',
        meta_description: 'SEO Description',
        slug: 'meu-post',
        keywords: ['keyword1'],
      },
      source: 'user',
      edited: true,
      updated_at: new Date().toISOString(),
    },
  }

  it('extracts title from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.title).toBe('Meu Post')
  })

  it('extracts slug from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.slug).toBe('meu-post')
  })

  it('extracts excerpt from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.excerpt).toBe('Um resumo do post')
  })

  it('extracts SEO fields from seo section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.meta_title).toBe('SEO Title')
    expect(result?.meta_description).toBe('SEO Description')
  })

  it('extracts structured fields', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.key_points).toEqual(['ponto 1', 'ponto 2'])
    expect(result?.pull_quote).toBe('Uma citacao importante')
    expect(result?.notes).toEqual(['nota 1'])
    expect(result?.colophon).toBe('Creditos finais')
  })

  it('extracts tag_id and cover_image_url', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.tag_id).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result?.cover_image_url).toBe('https://example.com/cover.jpg')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/unit/pipeline/draft-to-blog.test.ts --reporter=verbose
```

Expected: FAIL — no `title`, `slug`, `excerpt`, etc. on patch

- [ ] **Step 3: Expand BlogContentPatch interface**

In `apps/web/src/lib/pipeline/draft-to-blog.ts`, update the interface:

```typescript
export interface BlogContentPatch {
  content_json: Record<string, unknown> | null
  content_html: string | null
  content_mdx: string | null
  content_compiled: null
  content_toc: TocEntry[] | null
  reading_time_min: number | null
  title: string | null
  slug: string | null
  excerpt: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  key_points: string[] | null
  pull_quote: string | null
  notes: string[] | null
  colophon: string | null
  tag_id: string | null
  cover_image_url: string | null
}
```

- [ ] **Step 4: Update prepareBlogTranslationPatch to extract all fields**

Update the function to also extract fields from draft and seo sections:

```typescript
export async function prepareBlogTranslationPatch(
  sections: Record<string, unknown> | null | undefined,
  locale: string,
): Promise<BlogContentPatch | null> {
  const langSuffix = locale === 'pt' || locale === 'pt-br' ? 'pt' : 'en'
  const draftKey = `draft_${langSuffix}`
  const seoKey = `seo_${langSuffix}`

  const draftSection = sections?.[draftKey] as { content?: Record<string, unknown> } | undefined
  const seoSection = sections?.[seoKey] as { content?: Record<string, unknown> } | undefined
  const draft = draftSection?.content
  const seo = seoSection?.content

  if (!draft) return null

  const body = extractDraftBody(draft)
  if (!body) return null

  const basePatch: BlogContentPatch = {
    content_json: null,
    content_html: null,
    content_mdx: null,
    content_compiled: null,
    content_toc: null,
    reading_time_min: null,
    title: typeof draft.title === 'string' ? draft.title : null,
    slug: typeof draft.slug === 'string' ? draft.slug : null,
    excerpt: typeof draft.excerpt === 'string' ? draft.excerpt : null,
    meta_title: typeof seo?.meta_title === 'string' ? seo.meta_title : null,
    meta_description: typeof seo?.meta_description === 'string' ? seo.meta_description : null,
    og_image_url: typeof seo?.og_image_url === 'string' ? seo.og_image_url : null,
    key_points: Array.isArray(draft.key_points) ? draft.key_points : null,
    pull_quote: typeof draft.pull_quote === 'string' ? draft.pull_quote : null,
    notes: Array.isArray(draft.notes) ? draft.notes : null,
    colophon: typeof draft.colophon === 'string' ? draft.colophon : null,
    tag_id: typeof draft.tag_id === 'string' ? draft.tag_id : null,
    cover_image_url: typeof draft.cover_image_url === 'string' ? draft.cover_image_url : null,
  }

  if (typeof body === 'object') {
    try {
      const compiled = await compileJsonContent(body)
      basePatch.content_json = body as Record<string, unknown>
      basePatch.content_html = compiled.html
      basePatch.content_toc = compiled.toc
      basePatch.reading_time_min = compiled.readingTime
    } catch {
      return null
    }
  } else if (typeof body === 'string') {
    basePatch.content_mdx = body
  }

  return basePatch
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run test/unit/pipeline/draft-to-blog.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/pipeline/draft-to-blog.ts apps/web/test/unit/pipeline/draft-to-blog.test.ts
git commit -m "feat(pipeline): expand BlogContentPatch with all blog fields + SEO extraction"
```

---

## Phase 6: Materialization RPC

### Task 6: Create Materialization Server Action

**Files:**
- Create: `apps/web/src/lib/pipeline/materialize-blog.ts`
- Create: `apps/web/test/unit/pipeline/materialize-blog.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/unit/pipeline/materialize-blog.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service-client', () => ({
  getSupabaseServiceClient: vi.fn(() => mockSupabase),
}))

vi.mock('@/lib/pipeline/draft-to-blog', () => ({
  prepareBlogTranslationPatch: vi.fn(),
}))

vi.mock('@/lib/mdx/compile', () => ({
  compileMdx: vi.fn().mockResolvedValue({ code: 'compiled' }),
}))

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  rpc: vi.fn(),
}

import { materializeBlogPost } from '@/lib/pipeline/materialize-blog'
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

describe('materializeBlogPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when VVS score below threshold', async () => {
    const result = await materializeBlogPost({
      pipelineItemId: 'item-1',
      targetStage: 'scheduled',
      scheduledFor: new Date().toISOString(),
      userId: 'user-1',
      siteId: 'site-1',
      vvsScore: 60,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VVS_BELOW_THRESHOLD')
  })

  it('requires scheduledFor when targetStage is scheduled', async () => {
    const result = await materializeBlogPost({
      pipelineItemId: 'item-1',
      targetStage: 'scheduled',
      scheduledFor: null,
      userId: 'user-1',
      siteId: 'site-1',
      vvsScore: 85,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SCHEDULE_DATE_REQUIRED')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run test/unit/pipeline/materialize-blog.test.ts --reporter=verbose
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement materializeBlogPost**

Create `apps/web/src/lib/pipeline/materialize-blog.ts`:

```typescript
import { prepareBlogTranslationPatch, type BlogContentPatch } from './draft-to-blog'

interface MaterializeInput {
  pipelineItemId: string
  targetStage: 'scheduled' | 'published'
  scheduledFor: string | null
  userId: string
  siteId: string
  vvsScore: number
  locales?: string[]
}

type MaterializeResult =
  | { ok: true; blogPostId: string }
  | { ok: false; code: string; message: string }

const VVS_THRESHOLD = 80

export async function materializeBlogPost(input: MaterializeInput): Promise<MaterializeResult> {
  if (input.vvsScore < VVS_THRESHOLD) {
    return { ok: false, code: 'VVS_BELOW_THRESHOLD', message: `VVS score ${input.vvsScore} is below required ${VVS_THRESHOLD}` }
  }

  if (input.targetStage === 'scheduled' && !input.scheduledFor) {
    return { ok: false, code: 'SCHEDULE_DATE_REQUIRED', message: 'Scheduled date/time is required' }
  }

  const { getSupabaseServiceClient } = await import('@/lib/supabase/service-client')
  const supabase = getSupabaseServiceClient()

  const { data: item, error: fetchError } = await supabase
    .from('content_pipeline')
    .select('*, blog_post_id')
    .eq('id', input.pipelineItemId)
    .single()

  if (fetchError || !item) {
    return { ok: false, code: 'ITEM_NOT_FOUND', message: 'Pipeline item not found' }
  }

  const activeLocales = input.locales ?? (item.language === 'both' ? ['pt', 'en'] : [item.language === 'pt-br' ? 'pt' : 'en'])
  const patches: Array<{ locale: string; patch: BlogContentPatch }> = []

  for (const locale of activeLocales) {
    const patch = await prepareBlogTranslationPatch(item.sections, locale)
    if (!patch) {
      return { ok: false, code: 'PATCH_FAILED', message: `Failed to prepare patch for locale ${locale}` }
    }
    patches.push({ locale, patch })
  }

  const blogPostStatus = input.targetStage === 'scheduled' ? 'scheduled' : 'published'
  const blogPostData = {
    site_id: input.siteId,
    author_id: input.userId,
    status: blogPostStatus,
    category: item.category,
    cover_image_url: item.cover_image_url ?? patches[0]?.patch.cover_image_url,
    tag_id: patches[0]?.patch.tag_id,
    published_at: input.targetStage === 'published' ? new Date().toISOString() : null,
    scheduled_for: input.scheduledFor,
    slot_date: input.scheduledFor ? input.scheduledFor.split('T')[0] : null,
  }

  if (item.blog_post_id) {
    const { error } = await supabase
      .from('blog_posts')
      .update(blogPostData)
      .eq('id', item.blog_post_id)
    if (error) return { ok: false, code: 'BLOG_UPDATE_FAILED', message: error.message }
  } else {
    const { data: newPost, error } = await supabase
      .from('blog_posts')
      .upsert({ ...blogPostData, owner_user_id: input.userId })
      .select('id')
      .single()
    if (error || !newPost) return { ok: false, code: 'BLOG_INSERT_FAILED', message: error?.message ?? 'Insert failed' }
    item.blog_post_id = newPost.id
  }

  for (const { locale, patch } of patches) {
    const { error } = await supabase
      .from('blog_translations')
      .upsert({
        post_id: item.blog_post_id,
        locale,
        title: patch.title ?? '',
        slug: patch.slug ?? '',
        excerpt: patch.excerpt,
        content_json: patch.content_json,
        content_html: patch.content_html,
        content_mdx: patch.content_mdx ?? '',
        content_compiled: patch.content_compiled,
        content_toc: patch.content_toc,
        reading_time_min: patch.reading_time_min,
        meta_title: patch.meta_title,
        meta_description: patch.meta_description,
        og_image_url: patch.og_image_url,
        key_points: patch.key_points,
        pull_quote: patch.pull_quote,
        notes: patch.notes,
        colophon: patch.colophon,
        cover_image_url: patch.cover_image_url,
      }, { onConflict: 'post_id,locale' })
    if (error) return { ok: false, code: 'TRANSLATION_UPSERT_FAILED', message: error.message }
  }

  const revStamps: Record<string, unknown> = {
    stage: input.targetStage,
    blog_post_id: item.blog_post_id,
  }
  for (const locale of activeLocales) {
    const langSuffix = locale === 'pt' || locale === 'pt-br' ? 'pt' : 'en'
    const draftKey = `draft_${langSuffix}`
    const draftRev = (item.sections?.[draftKey] as { rev?: number })?.rev ?? 0
    revStamps[`materialized_rev_${langSuffix}`] = draftRev
  }

  await supabase
    .from('content_pipeline')
    .update(revStamps)
    .eq('id', input.pipelineItemId)

  return { ok: true, blogPostId: item.blog_post_id! }
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run test/unit/pipeline/materialize-blog.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/materialize-blog.ts apps/web/test/unit/pipeline/materialize-blog.test.ts
git commit -m "feat(pipeline): materializeBlogPost — atomic blog_posts + translations upsert"
```

---

## Phase 7: Kanban Unification

### Task 7: Update LANE_DEFS to 5 Pipeline-Only Lanes

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts:81-95`
- Modify: `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`

- [ ] **Step 1: Update LaneId type**

In `apps/web/src/app/cms/(authed)/blog/_hub/hub-types.ts`, change:

```typescript
// From:
export type LaneId = 'idea' | 'draft' | 'ready' | 'editing' | 'scheduled' | 'published'
// To:
export type LaneId = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published'
```

- [ ] **Step 2: Update LANE_DEFS**

In `apps/web/src/app/cms/(authed)/blog/_hub/hub-utils.ts`, change lines 81-88:

```typescript
// From:
export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#f59e0b', dataSource: 'pipeline' },
  { id: 'draft', label: 'Rascunho', color: '#f97316', dataSource: 'pipeline' },
  { id: 'ready', label: 'Pronto', color: '#06b6d4', dataSource: 'pipeline' },
  { id: 'editing', label: 'Em Edição', color: '#3b82f6', dataSource: 'blog' },
  { id: 'scheduled', label: 'Agendado', color: '#a78bfa', dataSource: 'blog' },
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'blog' },
]
// To:
export const LANE_DEFS: LaneDef[] = [
  { id: 'idea', label: 'Ideia', color: '#f59e0b', dataSource: 'pipeline' },
  { id: 'draft', label: 'Rascunho', color: '#f97316', dataSource: 'pipeline' },
  { id: 'ready', label: 'Entrega', color: '#06b6d4', dataSource: 'pipeline' },
  { id: 'scheduled', label: 'Agendado', color: '#a78bfa', dataSource: 'pipeline' },
  { id: 'published', label: 'Publicado', color: '#22c55e', dataSource: 'pipeline' },
]
```

- [ ] **Step 3: Update KanbanColumnId**

```typescript
// From:
export type KanbanColumnId = 'ready' | 'scheduled' | 'published'
// To:
export type KanbanColumnId = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published'
```

- [ ] **Step 4: Run existing blog hub tests**

```bash
cd apps/web && npx vitest run test/cms/blog-hub --reporter=verbose
```

Fix any failures from the removed 'editing' lane.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/_hub/
git commit -m "feat(blog): unify kanban to 5 pipeline-only lanes, remove editing lane"
```

### Task 8: Update Unified Board to Use Single Card Type

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/unified-board.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/_tabs/editorial/pipeline-card.tsx`

- [ ] **Step 1: Update unified-board.tsx to use PipelineCard for all lanes**

In `unified-board.tsx`, remove the conditional that switches between PipelineCard and PostCard. Replace lines ~626-650 with a single PipelineCard render for all items:

```typescript
{items.map((item) => (
  <PipelineCard
    key={item.id}
    item={item}
    lane={lane.id}
    onDragStart={handleDragStart}
    onClick={() => handleItemClick(item)}
  />
))}
```

- [ ] **Step 2: Remove the PROMOCAO divider rendering**

Remove the divider between pipeline and blog lanes (the `<div>` with "PROMOÇÃO" text between lanes 3 and 4).

- [ ] **Step 3: Update hub-queries.ts to fetch scheduled/published items from pipeline**

Update the query for scheduled and published lanes to fetch from `content_pipeline` instead of `blog_posts`:

```typescript
const { data: scheduledItems } = await supabase
  .from('content_pipeline')
  .select('*')
  .eq('site_id', siteId)
  .eq('format', 'blog_post')
  .eq('stage', 'scheduled')
  .eq('is_archived', false)
  .order('updated_at', { ascending: false })
```

Same pattern for `published` stage.

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run test/cms/blog-hub --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/
git commit -m "feat(blog): unified kanban with PipelineCard for all lanes"
```

---

## Phase 8: Sidebar Collapse

### Task 9: Implement Sidebar Collapse for Draft Mode

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx:463-945`

- [ ] **Step 1: Add sidebar collapse state**

Near the top of the component (around line 465), add state:

```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
```

- [ ] **Step 2: Auto-collapse when draft tab is active**

Add an effect that collapses sidebar when the active tab is 'draft':

```typescript
useEffect(() => {
  setSidebarCollapsed(activeTab === 'draft')
}, [activeTab])
```

- [ ] **Step 3: Update sidebar container classes**

Change the sidebar div at line 633 from:

```tsx
<div className="w-68 sticky top-5 self-start ..."
```

To:

```tsx
<div className={cn(
  'sticky top-5 self-start max-h-[calc(100vh-40px)] overflow-y-auto transition-all duration-200 ease-in-out',
  sidebarCollapsed ? 'w-12' : 'w-68'
)} style={{ scrollbarWidth: 'thin' }}>
```

- [ ] **Step 4: Add collapsed icon rail**

When collapsed, show only icon buttons:

```tsx
{sidebarCollapsed ? (
  <div className="flex flex-col items-center gap-2.5 py-3">
    {/* VVS mini ring */}
    <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold"
      style={{ borderColor: vvsColor, color: vvsColor }}>
      {item.validation_score?.overall ?? 0}
    </div>
    {/* Icon buttons for checklist, stage, details */}
    <button onClick={() => setSidebarCollapsed(false)} title="Checklist" className="w-7 h-7 rounded-md bg-[var(--gem-well)] flex items-center justify-center text-xs">
      📋
    </button>
    <button onClick={() => setSidebarCollapsed(false)} title="Stage" className="w-7 h-7 rounded-md bg-[var(--gem-well)] flex items-center justify-center text-xs">
      ⚡
    </button>
    <button onClick={() => setSidebarCollapsed(false)} title="Details" className="w-7 h-7 rounded-md bg-[var(--gem-well)] flex items-center justify-center text-xs">
      📝
    </button>
    <div className="flex-1" />
    <button onClick={() => setSidebarCollapsed(false)} title="Expandir sidebar" className="w-7 h-7 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs text-indigo-400">
      »
    </button>
  </div>
) : (
  /* existing sidebar content */
)}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run test/cms/pipeline-item-detail.test.tsx --reporter=verbose
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "feat(pipeline): sidebar collapse to 48px icon rail in draft mode"
```

---

## Phase 9: Expanded Draft Renderer

### Task 10: Expand DraftRenderer for Blog Fields

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx`

- [ ] **Step 1: Update extractDraftContent to handle all blog fields**

Expand the function to extract the full blog draft schema:

```typescript
interface BlogDraftContent {
  body: string | JSONContent
  title: string
  slug: string
  excerpt: string
  key_points: string[]
  pull_quote: string
  notes: string[]
  colophon: string
  tag_id: string | null
  hashtag_ids: string[]
  cover_image_url: string | null
  seo: Record<string, unknown> | null
  hasMisplacedSeo: boolean
}

function extractDraftContent(content: RendererProps['content'], format: string): BlogDraftContent {
  const base: BlogDraftContent = {
    body: '', title: '', slug: '', excerpt: '',
    key_points: [], pull_quote: '', notes: [], colophon: '',
    tag_id: null, hashtag_ids: [], cover_image_url: null,
    seo: null, hasMisplacedSeo: false,
  }

  if (!content || typeof content !== 'object' || Array.isArray(content)) return base
  const obj = content as Record<string, unknown>

  base.body = (obj.body as string | JSONContent) ?? ''
  base.title = (obj.title as string) ?? ''
  base.slug = (obj.slug as string) ?? ''
  base.excerpt = (obj.excerpt as string) ?? ''
  base.key_points = Array.isArray(obj.key_points) ? obj.key_points : []
  base.pull_quote = (obj.pull_quote as string) ?? ''
  base.notes = Array.isArray(obj.notes) ? obj.notes : []
  base.colophon = (obj.colophon as string) ?? ''
  base.tag_id = (obj.tag_id as string) ?? null
  base.hashtag_ids = Array.isArray(obj.hashtag_ids) ? obj.hashtag_ids : []
  base.cover_image_url = (obj.cover_image_url as string) ?? null

  if (obj.seo && typeof obj.seo === 'object') {
    base.seo = obj.seo as Record<string, unknown>
    base.hasMisplacedSeo = true
  }

  return base
}
```

- [ ] **Step 2: Update render to show blog fields when format is blog_post**

Add the title, slug, excerpt fields above the TipTap editor, and structured fields below. Use `preset="blog"` for the PipelineEditor when `format === 'blog_post'`:

```tsx
{format === 'blog_post' && (
  <div className="space-y-3 mb-4">
    {/* Title */}
    <input
      className="w-full text-2xl font-bold bg-transparent border-none outline-none text-[var(--foreground)]"
      placeholder="Post title..."
      value={draft.title}
      onChange={e => updateField('title', e.target.value)}
    />
    {/* Slug */}
    <div className="text-xs text-[var(--muted)]">
      /blog/{lang}/{draft.slug || 'slug-here'}
    </div>
    {/* Excerpt */}
    <textarea
      className="w-full text-sm italic text-[var(--muted)] bg-transparent border-l-2 border-amber-500/20 pl-3 resize-none outline-none"
      placeholder="Post excerpt..."
      rows={2}
      value={draft.excerpt}
      onChange={e => updateField('excerpt', e.target.value)}
    />
  </div>
)}

<PipelineEditor
  content={draft.body}
  onChange={body => updateField('body', body)}
  editable={isEditing}
  preset={format === 'blog_post' ? 'blog' : 'full'}
  placeholder="Start writing..."
/>

{format === 'blog_post' && (
  <details className="mt-4 border border-[var(--border)] rounded-lg">
    <summary className="px-3 py-2 text-xs font-semibold cursor-pointer">
      Campos Estruturados
    </summary>
    <div className="p-3 grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-xs text-[var(--muted)] mb-1 block">Key Points</label>
        {draft.key_points.map((kp: string, i: number) => (
          <input key={i} className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 mb-1 text-[var(--foreground)] outline-none"
            value={kp}
            onChange={e => {
              const updated = [...draft.key_points]
              updated[i] = e.target.value
              updateField('key_points', updated)
            }}
          />
        ))}
        <button onClick={() => updateField('key_points', [...draft.key_points, ''])}
          className="text-xs text-indigo-400 mt-1">+ Add key point</button>
      </div>
      <div className="col-span-2">
        <label className="text-xs text-[var(--muted)] mb-1 block">Pull Quote</label>
        <textarea className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 text-[var(--foreground)] outline-none resize-none"
          rows={2} value={draft.pull_quote}
          onChange={e => updateField('pull_quote', e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs text-[var(--muted)] mb-1 block">Tag</label>
        <TagSelector value={draft.tag_id} onChange={v => updateField('tag_id', v)} siteId={siteId} />
      </div>
      <div>
        <label className="text-xs text-[var(--muted)] mb-1 block">Hashtags</label>
        <HashtagSelector value={draft.hashtag_ids} onChange={v => updateField('hashtag_ids', v)} siteId={siteId} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-[var(--muted)] mb-1 block">Notes (internal)</label>
        {draft.notes.map((note: string, i: number) => (
          <input key={i} className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 mb-1 text-[var(--foreground)] outline-none"
            value={note}
            onChange={e => {
              const updated = [...draft.notes]
              updated[i] = e.target.value
              updateField('notes', updated)
            }}
          />
        ))}
        <button onClick={() => updateField('notes', [...draft.notes, ''])}
          className="text-xs text-indigo-400 mt-1">+ Add note</button>
      </div>
      <div className="col-span-2">
        <label className="text-xs text-[var(--muted)] mb-1 block">Colophon</label>
        <input className="w-full text-xs bg-[var(--gem-well)] rounded px-2 py-1 text-[var(--foreground)] outline-none"
          value={draft.colophon}
          onChange={e => updateField('colophon', e.target.value)}
        />
      </div>
    </div>
  </details>
)}
```

- [ ] **Step 3: Wire updateField to propagate changes to onContentChange**

```typescript
function updateField(field: string, value: unknown) {
  const updated = { ...(content as Record<string, unknown>), [field]: value }
  onContentChange(updated)
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx
git commit -m "feat(pipeline): expanded draft renderer with title, slug, excerpt, structured fields"
```

---

## Phase 10: Pending Changes + Re-publicar

### Task 11: Add Pending Changes Detection and Re-publicar Button

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx`

- [ ] **Step 1: Add pending changes detection logic**

First, add `materialized_rev_pt` and `materialized_rev_en` to the `ItemData` interface (around line 38):

```typescript
interface ItemData {
  // ... existing fields ...
  materialized_rev_pt: number | null
  materialized_rev_en: number | null
}
```

Then add the detection function:

```typescript
function hasPendingChanges(item: ItemData): boolean {
  if (!item.sections || item.stage !== 'published') return false
  const draftPt = item.sections.draft_pt as { rev?: number } | undefined
  const draftEn = item.sections.draft_en as { rev?: number } | undefined

  if (draftPt?.rev != null && item.materialized_rev_pt != null && draftPt.rev > item.materialized_rev_pt) return true
  if (draftEn?.rev != null && item.materialized_rev_en != null && draftEn.rev > item.materialized_rev_en) return true
  return false
}
```

- [ ] **Step 2: Add Re-publicar button in the tab bar**

In the section tabs bar (around line 596), add after the language toggle:

```tsx
{hasPendingChanges(item) && (
  <div className="flex items-center gap-2 ml-4">
    <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
      Mudancas pendentes
    </span>
    <button
      onClick={handleRepublish}
      className="text-xs font-bold bg-emerald-500 text-white px-3 py-1 rounded hover:bg-emerald-600 transition-colors"
    >
      Re-publicar
    </button>
  </div>
)}
```

- [ ] **Step 3: Implement handleRepublish**

```typescript
async function handleRepublish() {
  const result = await materializeBlogPost({
    pipelineItemId: item.id,
    targetStage: 'published',
    scheduledFor: null,
    userId: userId,
    siteId: item.site_id,
    vvsScore: item.validation_score?.overall ?? 0,
  })
  if (result.ok) {
    toast.success('Post atualizado no site')
    router.refresh()
  } else {
    toast.error(result.message)
  }
}
```

- [ ] **Step 4: Verify materialized_rev columns are fetched**

The Supabase `select('*')` query already fetches all columns including the new `materialized_rev_pt`/`materialized_rev_en`. Verify the `ItemData` interface update from Step 1 includes these fields, and that the component's existing `select('*')` fetch covers them.

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run test/cms/pipeline-item-detail.test.tsx --reporter=verbose
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/pipeline-item-detail.tsx
git commit -m "feat(pipeline): pending changes detection + Re-publicar button for published posts"
```

---

## Phase 11: Scheduling Integration

### Task 12: Wire Schedule Modal into Pipeline Publish Flow

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx`

- [ ] **Step 1: Import ScheduleModal and materializeBlogPost**

```typescript
import { ScheduleModal } from '@/app/cms/(authed)/blog/_tabs/editorial/schedule-modal'
import { materializeBlogPost } from '@/lib/pipeline/materialize-blog'
```

- [ ] **Step 2: Add scheduling state and UI**

In the publish renderer, add state for the schedule modal:

```typescript
const [showSchedule, setShowSchedule] = useState(false)
const [isPublishing, setIsPublishing] = useState(false)
```

- [ ] **Step 3: Add Agendar and Publicar Agora buttons**

For `blog_post` format, render scheduling controls:

```tsx
{format === 'blog_post' && (
  <div className="space-y-3">
    {/* VVS Gate */}
    <div className={cn(
      'flex items-center gap-2 p-3 rounded-lg border',
      vvsScore >= 80 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'
    )}>
      <span className="text-sm font-bold" style={{ color: vvsScore >= 80 ? '#10b981' : '#ef4444' }}>
        VVS {vvsScore}
      </span>
      <span className="text-xs text-[var(--muted)]">
        {vvsScore >= 80 ? 'Pronto para publicar' : `Precisa de ${80 - vvsScore} pontos mais`}
      </span>
    </div>

    <div className="flex gap-3">
      <button
        onClick={() => setShowSchedule(true)}
        disabled={vvsScore < 80 || isPublishing}
        className="flex-1 py-2 rounded-lg bg-violet-500 text-white text-sm font-bold disabled:opacity-50"
      >
        Agendar
      </button>
      <button
        onClick={() => handlePublishNow()}
        disabled={vvsScore < 80 || isPublishing}
        className="flex-1 py-2 rounded-lg bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
      >
        Publicar Agora
      </button>
    </div>

    <ScheduleModal
      isOpen={showSchedule}
      postTitle={itemTitle}
      siteTimezone="America/Sao_Paulo"
      onConfirm={handleScheduleConfirm}
      onCancel={() => setShowSchedule(false)}
    />
  </div>
)}
```

- [ ] **Step 4: Implement handlers**

```typescript
async function handleScheduleConfirm(scheduledFor: string) {
  setShowSchedule(false)
  setIsPublishing(true)
  const result = await materializeBlogPost({
    pipelineItemId: itemId,
    targetStage: 'scheduled',
    scheduledFor,
    userId, siteId,
    vvsScore,
  })
  setIsPublishing(false)
  if (result.ok) {
    toast.success('Post agendado com sucesso')
    router.refresh()
  } else {
    toast.error(result.message)
  }
}

async function handlePublishNow() {
  setIsPublishing(true)
  const result = await materializeBlogPost({
    pipelineItemId: itemId,
    targetStage: 'published',
    scheduledFor: null,
    userId, siteId,
    vvsScore,
  })
  setIsPublishing(false)
  if (result.ok) {
    toast.success('Post publicado!')
    router.refresh()
  } else {
    toast.error(result.message)
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run --reporter=verbose
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/publish-renderer.tsx
git commit -m "feat(pipeline): schedule modal + publish now in pipeline publish section"
```

---

## Phase 12: Cowork AI Docs Expansion

### Task 13: Expand Cowork Docs with Blog Draft Schema

**Files:**
- Modify: `apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md`

- [ ] **Step 1: Add blog draft section schema**

Append to the docs file:

```markdown
## Blog Post Draft Section Schema

When format is `blog_post`, the `draft_{locale}` section content has this expanded shape:

```json
{
  "body": "<TipTap JSONContent>",
  "title": "string",
  "slug": "string (URL-friendly, auto-generated from title if empty)",
  "excerpt": "string (2-3 sentence summary)",
  "key_points": ["string", "string"],
  "pull_quote": "string (featured quote from post)",
  "notes": ["string (internal notes)"],
  "colophon": "string (credits/attributions)",
  "tag_id": "uuid (FK to blog_tags)",
  "hashtag_ids": ["uuid (FK to hashtags)"],
  "cover_image_url": "string (URL from Media Gallery)"
}
```

When updating a blog draft section via PATCH, include ALL fields you want to set.
The `body` field accepts TipTap JSONContent with the blog preset extensions:
StarterKit (H1-H4), MergeTag, CTAButton, PlaylistEmbed, SocialEmbed, SlashCommand,
Callout, Toggle, Columns, Table, TaskList.

## Blog Post SEO Section Schema

The `seo_{locale}` section content:

```json
{
  "meta_title": "string (ideal: 60 chars, max: 70)",
  "meta_description": "string (ideal: 155 chars, max: 170)",
  "slug": "string (mirrors draft slug)",
  "keywords": ["string"],
  "og_image_url": "string (1200x630)"
}
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/data/pipeline-docs/cowork-docs-items-and-sections.md
git commit -m "docs(pipeline): expand cowork docs with blog draft + SEO section schemas"
```

### Task 14: Add Writer Blog Craft Reference

**Files:**
- Modify: `scripts/seed-pipeline-reference.ts`

- [ ] **Step 1: Add blog-craft reference entry**

In the references array, add:

```typescript
{
  skill: 'writer',
  key: 'blog-craft',
  title: 'Blog Post Craft Guide',
  group: 'craft',
  content: `
# Blog Post Structure
- Hook: 1-2 sentences that grab attention
- Intro: expand the hook, set context (2-3 paragraphs)
- Body: clear H2 sections, each with a single idea
- Key Points: 3-5 actionable takeaways
- Pull Quote: the most shareable sentence
- Conclusion: tie back to the hook, call to action

# Tone & Voice
- First person singular (I, not we)
- Conversational but precise
- Short paragraphs (3-4 sentences max)
- Use subheadings every 200-300 words

# SEO
- Title: include primary keyword, under 60 chars
- Meta description: summarize value proposition, 155 chars
- Slug: 3-5 words max, no stop words
- H1 for title only, H2 for main sections, H3 for subsections
`,
}
```

- [ ] **Step 2: Run seed script**

```bash
npx tsx --env-file apps/web/.env.local scripts/seed-pipeline-reference.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-pipeline-reference.ts
git commit -m "feat(pipeline): add Writer Blog Craft reference for Cowork AI"
```

---

## Phase 13: Blog Editor Read-Only + Redirect

### Task 15: Make Blog Editor Read-Only with Pipeline Link

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`

- [ ] **Step 1: Add pipeline redirect banner in edit-post-client.tsx**

At the top of the editor component, add:

```tsx
{initialPipelineItem && (
  <div className="mb-4 p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-indigo-300">
        Este post é gerenciado pelo Pipeline
      </p>
      <p className="text-xs text-[var(--muted)]">
        Edite no Pipeline para manter o workflow unificado.
      </p>
    </div>
    <Link
      href={`/cms/pipeline/items/${initialPipelineItem.id}`}
      className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600"
    >
      Editar no Pipeline →
    </Link>
  </div>
)}
```

- [ ] **Step 2: Disable editing when pipeline-linked**

Pass `editable={!initialPipelineItem}` to the TipTapEditor and disable form fields when a pipeline item is linked.

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/cms/blog --reporter=verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/
git commit -m "feat(blog): read-only editor with Pipeline redirect for linked posts"
```

---

## Phase 14: Integration Testing

### Task 16: Run Full Test Suite and Fix Breakages

**Files:**
- Test: all existing test files

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

- [ ] **Step 2: Fix any failures from removed 'editing' lane**

Common fixes:
- Tests referencing `LaneId` type with 'editing' value
- Tests asserting 6 lanes instead of 5
- Tests asserting `dataSource: 'blog'` for scheduled/published lanes
- Tests referencing `PostCard` component in unified board

- [ ] **Step 3: Fix any failures from expanded ValidationInput**

Tests that call `computeValidationScore` without the new `sections` field should still work (it's optional). Verify backward compatibility.

- [ ] **Step 4: Fix any failures from blog_post category change**

Tests referencing old category values ('tech', 'vida', etc.) need updating to new values ('stories', 'building', 'money', 'bts').

- [ ] **Step 5: Run full suite again**

```bash
npm test
```

Expected: ALL PASS

- [ ] **Step 6: Commit fixes**

```bash
git add -A
git commit -m "fix: update tests for pipeline-blog unification changes"
```

---

## Phase 15: Slug Validation

### Task 17: Add Async Slug Validation in Draft Renderer

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx`

- [ ] **Step 1: Add slug validation hook**

```typescript
function useSlugValidation(slug: string, siteId: string, blogPostId: string | null) {
  const [conflict, setConflict] = useState(false)
  const [checking, setChecking] = useState(false)

  const checkSlug = useMemo(
    () => debounce(async (s: string) => {
      if (!s.trim()) { setConflict(false); return }
      setChecking(true)
      const res = await fetch(`/api/blog/check-slug?slug=${encodeURIComponent(s)}&site_id=${siteId}&exclude_post_id=${blogPostId ?? ''}`)
      const { exists } = await res.json()
      setConflict(exists)
      setChecking(false)
    }, 500),
    [siteId, blogPostId]
  )

  useEffect(() => { checkSlug(slug) }, [slug, checkSlug])

  return { conflict, checking }
}
```

- [ ] **Step 2: Add slug validation UI**

```tsx
<div className="flex items-center gap-2">
  <span className="text-xs text-[var(--muted)]">/blog/{lang}/</span>
  <input
    className={cn(
      'text-xs bg-transparent border-b outline-none',
      slugConflict ? 'border-red-500 text-red-400' : 'border-transparent text-[var(--muted)]'
    )}
    value={draft.slug}
    onChange={e => updateField('slug', slugify(e.target.value))}
    onBlur={() => {
      if (!draft.slug && draft.title) updateField('slug', slugify(draft.title))
    }}
  />
  {slugConflict && <span className="text-xs text-red-400">Slug ja existe</span>}
</div>
```

- [ ] **Step 3: Create the check-slug API route**

Create `apps/web/src/app/api/blog/check-slug/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireSiteAdmin } from '@/lib/auth/require-site-admin'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  const siteId = req.nextUrl.searchParams.get('site_id')
  const excludePostId = req.nextUrl.searchParams.get('exclude_post_id')

  if (!slug || !siteId) return NextResponse.json({ exists: false })

  await requireSiteAdmin(siteId)

  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('blog_translations')
    .select('post_id, blog_posts!inner(site_id)')
    .eq('slug', slug)
    .eq('blog_posts.site_id', siteId)

  if (excludePostId) query = query.neq('post_id', excludePostId)

  const { data } = await query.limit(1)
  return NextResponse.json({ exists: (data?.length ?? 0) > 0 })
}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run --reporter=verbose
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx apps/web/src/app/api/blog/check-slug/
git commit -m "feat(pipeline): async slug validation with conflict detection in draft renderer"
```

---

## Phase 16: Progressive Tab Disclosure

### Task 18: Disable Tabs Based on Stage

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx`

- [ ] **Step 1: Define stage-to-tab access rules for blog_post**

```typescript
const BLOG_TAB_ACCESS: Record<string, string[]> = {
  idea: ['ideia'],
  draft: ['ideia', 'draft'],
  ready: ['ideia', 'draft', 'seo', 'images'],
  scheduled: ['ideia', 'draft', 'seo', 'images', 'publish'],
  published: ['ideia', 'draft', 'seo', 'images', 'publish'],
}
```

- [ ] **Step 2: Apply disabled state to tabs**

When rendering tabs, check if the tab is accessible for the current stage:

```tsx
const enabledTabs = format === 'blog_post'
  ? BLOG_TAB_ACCESS[stage] ?? Object.keys(BLOG_TAB_ACCESS.published)
  : null // non-blog formats: all tabs enabled

// In tab button rendering:
const isDisabled = enabledTabs && !enabledTabs.includes(tab.key)

<button
  disabled={isDisabled}
  title={isDisabled ? `Avance para ${getStageForTab(tab.key)} para desbloquear` : undefined}
  className={cn(
    'px-3 py-2 text-xs',
    isDisabled && 'opacity-30 cursor-not-allowed'
  )}
>
  {tab.label}
</button>
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/cms/pipeline-item-detail.test.tsx --reporter=verbose
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/pipeline/_components/detail/tab-container.tsx
git commit -m "feat(pipeline): progressive tab disclosure by stage for blog_post format"
```

---

## Deferred to Follow-Up

The following spec features are **not included in this plan** and should be implemented as follow-up tasks:

- **Instagram Story multi-slide editor** — Expanding `social-config-editor.tsx` with hook/key-point/CTA slides, per-slide background image picker, template selector (minimal/card/bold), 280-char text limit. This is a substantial UI feature (~8-12h) that doesn't block the core pipeline-blog unification.
- **Phase 2: Remove blog editor** — After validating pipeline editing works for all blog needs, remove blog editor code and redirect `/cms/blog/[id]/edit` → pipeline item page.

---

## Phase 17: Final Integration

### Task 19: End-to-End Smoke Test

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Start dev server and manually verify**

```bash
npm run dev -w apps/web
```

Test in browser:
1. Navigate to `/cms/blog` — verify 5 lanes, all pipeline-sourced
2. Click a blog_post pipeline item — verify draft mode with sidebar collapsed, TipTap with blog preset
3. Switch to SEO tab — verify sidebar expands
4. Fill all fields, verify VVS score reaches 80+
5. Try scheduling — verify date/time picker modal
6. Verify blog editor (`/cms/blog/[id]/edit`) shows read-only with pipeline redirect

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(pipeline): pipeline-blog unification — complete implementation"
```
