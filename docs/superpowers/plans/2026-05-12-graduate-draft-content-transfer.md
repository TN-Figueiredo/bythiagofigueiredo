# Graduate Draft Content Transfer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transfer pipeline draft content into blog translations when graduating, so the blog editor opens pre-populated.

**Architecture:** Shared utility `lib/pipeline/draft-to-blog.ts` handles content extraction and compilation. Both graduation paths (API route + server action) consume it. JSONContent transfers directly; markdown goes to `content_mdx`.

**Tech Stack:** TypeScript, Supabase, Tiptap JSONContent, `compileJsonContent()`, Vitest

---

### Task 1: Create shared utility `lib/pipeline/draft-to-blog.ts`

**Files:**
- Create: `apps/web/src/lib/pipeline/draft-to-blog.ts`

- [ ] **Step 1: Create `extractDraftBody` function**

```typescript
import type { JSONContent } from '@tiptap/react'

export interface BlogContentPatch {
  content_json: Record<string, unknown> | null
  content_html: string | null
  content_mdx: string | null
  content_compiled: null
  content_toc: Array<{ level: number; text: string; id: string }> | null
  reading_time_min: number | null
}

function isJSONContent(v: unknown): v is JSONContent {
  return typeof v === 'object' && v !== null && 'type' in v && (v as Record<string, unknown>).type === 'doc'
}

export function extractDraftBody(content: unknown): { json: JSONContent | null; mdx: string | null } {
  if (typeof content === 'string') return { json: null, mdx: content || null }
  if (isJSONContent(content)) return { json: content, mdx: null }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    if ('body' in obj) return extractDraftBody(obj.body)
  }
  return { json: null, mdx: null }
}
```

- [ ] **Step 2: Create `getDraftForLocale` function**

```typescript
interface SectionEntry {
  content?: unknown
  [key: string]: unknown
}

export function getDraftForLocale(sections: Record<string, unknown> | null | undefined, locale: string): unknown | null {
  if (!sections || typeof sections !== 'object') return null
  const key = locale === 'en' ? 'draft_en' : 'draft_pt'
  const section = sections[key] as SectionEntry | undefined
  return section?.content ?? null
}
```

- [ ] **Step 3: Create `prepareBlogTranslationPatch` function**

```typescript
import { compileJsonContent } from '@/lib/cms/compile-json'

export async function prepareBlogTranslationPatch(
  sections: Record<string, unknown> | null | undefined,
  locale: string,
): Promise<BlogContentPatch | null> {
  const raw = getDraftForLocale(sections, locale)
  if (raw == null) return null

  const { json, mdx } = extractDraftBody(raw)

  if (json) {
    try {
      const compiled = await compileJsonContent(json)
      return {
        content_json: json as Record<string, unknown>,
        content_html: compiled.html,
        content_mdx: null,
        content_compiled: null,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
      }
    } catch {
      return null
    }
  }

  if (mdx) {
    return {
      content_json: null,
      content_html: null,
      content_mdx: mdx,
      content_compiled: null,
      content_toc: null,
      reading_time_min: null,
    }
  }

  return null
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/draft-to-blog.ts
git commit -m "feat(pipeline): add draft-to-blog content transfer utility"
```

---

### Task 2: Write tests for the utility

**Files:**
- Create: `apps/web/test/unit/pipeline/draft-to-blog.test.ts`

- [ ] **Step 1: Write tests for `extractDraftBody`**

```typescript
import { describe, it, expect } from 'vitest'
import { extractDraftBody, getDraftForLocale, prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

describe('extractDraftBody', () => {
  it('returns mdx for plain string', () => {
    expect(extractDraftBody('# Hello')).toEqual({ json: null, mdx: '# Hello' })
  })

  it('returns null mdx for empty string', () => {
    expect(extractDraftBody('')).toEqual({ json: null, mdx: null })
  })

  it('returns json for JSONContent', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const result = extractDraftBody(doc)
    expect(result.json).toEqual(doc)
    expect(result.mdx).toBeNull()
  })

  it('extracts body from hybrid { body, seo } object', () => {
    const doc = { type: 'doc', content: [] }
    const hybrid = { body: doc, seo: { title: 'SEO title' } }
    const result = extractDraftBody(hybrid)
    expect(result.json).toEqual(doc)
    expect(result.mdx).toBeNull()
  })

  it('extracts string body from hybrid object', () => {
    const hybrid = { body: '## Draft content', seo: null }
    expect(extractDraftBody(hybrid)).toEqual({ json: null, mdx: '## Draft content' })
  })

  it('returns nulls for null/undefined', () => {
    expect(extractDraftBody(null)).toEqual({ json: null, mdx: null })
    expect(extractDraftBody(undefined)).toEqual({ json: null, mdx: null })
  })

  it('returns nulls for array', () => {
    expect(extractDraftBody([1, 2, 3])).toEqual({ json: null, mdx: null })
  })
})
```

- [ ] **Step 2: Write tests for `getDraftForLocale`**

```typescript
describe('getDraftForLocale', () => {
  const sections = {
    draft_pt: { content: '# PT content', rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' },
    draft_en: { content: { type: 'doc', content: [] }, rev: 1, source: 'cowork', edited: false, updated_at: '2026-01-01T00:00:00Z' },
    ideia_shared: { content: { premise: 'test' }, rev: 0, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' },
  }

  it('returns draft_pt content for pt-br locale', () => {
    expect(getDraftForLocale(sections, 'pt-br')).toBe('# PT content')
  })

  it('returns draft_pt content for pt locale', () => {
    expect(getDraftForLocale(sections, 'pt')).toBe('# PT content')
  })

  it('returns draft_en content for en locale', () => {
    expect(getDraftForLocale(sections, 'en')).toEqual({ type: 'doc', content: [] })
  })

  it('returns null for missing locale', () => {
    expect(getDraftForLocale(sections, 'fr')).toBeNull()
  })

  it('returns null for null sections', () => {
    expect(getDraftForLocale(null, 'pt-br')).toBeNull()
  })

  it('returns null for empty sections', () => {
    expect(getDraftForLocale({}, 'en')).toBeNull()
  })

  it('returns null when section exists but has no content', () => {
    expect(getDraftForLocale({ draft_pt: { rev: 0 } }, 'pt-br')).toBeNull()
  })
})
```

- [ ] **Step 3: Write tests for `prepareBlogTranslationPatch`**

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/cms/compile-json', () => ({
  compileJsonContent: vi.fn().mockResolvedValue({
    html: '<p>compiled</p>',
    toc: [{ level: 2, text: 'Heading', id: 'heading' }],
    readingTimeMin: 3,
  }),
}))

describe('prepareBlogTranslationPatch', () => {
  it('returns null when no draft section exists', async () => {
    expect(await prepareBlogTranslationPatch({}, 'pt-br')).toBeNull()
  })

  it('returns null for null sections', async () => {
    expect(await prepareBlogTranslationPatch(null, 'en')).toBeNull()
  })

  it('returns JSON patch for JSONContent draft', async () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const sections = { draft_pt: { content: doc, rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'pt-br')
    expect(result).not.toBeNull()
    expect(result!.content_json).toEqual(doc)
    expect(result!.content_html).toBe('<p>compiled</p>')
    expect(result!.content_mdx).toBeNull()
    expect(result!.content_compiled).toBeNull()
    expect(result!.content_toc).toEqual([{ level: 2, text: 'Heading', id: 'heading' }])
    expect(result!.reading_time_min).toBe(3)
  })

  it('returns MDX patch for string draft', async () => {
    const sections = { draft_en: { content: '# Hello world', rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'en')
    expect(result).not.toBeNull()
    expect(result!.content_mdx).toBe('# Hello world')
    expect(result!.content_json).toBeNull()
    expect(result!.content_html).toBeNull()
    expect(result!.content_compiled).toBeNull()
  })

  it('handles hybrid { body, seo } content', async () => {
    const doc = { type: 'doc', content: [] }
    const sections = { draft_pt: { content: { body: doc, seo: { title: 'SEO' } }, rev: 1, source: 'cowork', edited: false, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'pt-br')
    expect(result).not.toBeNull()
    expect(result!.content_json).toEqual(doc)
  })

  it('returns null gracefully when compileJsonContent throws', async () => {
    const { compileJsonContent } = await import('@/lib/cms/compile-json')
    vi.mocked(compileJsonContent).mockRejectedValueOnce(new Error('compile failed'))
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    const sections = { draft_en: { content: doc, rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'en')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run test/unit/pipeline/draft-to-blog.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add apps/web/test/unit/pipeline/draft-to-blog.test.ts
git commit -m "test(pipeline): add draft-to-blog utility tests"
```

---

### Task 3: Update graduate API route to transfer draft content

**Files:**
- Modify: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`

- [ ] **Step 1: Import utility and add content transfer after translation creation**

After the `blog_translations` insert (line 82), add content patching:

```typescript
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

// After translations insert, patch each translation with draft content
const sections = item.sections as Record<string, unknown> | null
for (const tx of translations) {
  try {
    const patch = await prepareBlogTranslationPatch(sections, tx.locale)
    if (patch) {
      await supabase.from('blog_translations').update(patch).eq('post_id', post.id).eq('locale', tx.locale)
    }
  } catch {
    // Best-effort: don't fail graduation on content transfer issues
  }
}
```

- [ ] **Step 2: Add `hook` → `excerpt` transfer**

After content patching, transfer excerpt:

```typescript
if (item.hook) {
  for (const tx of translations) {
    await supabase.from('blog_translations').update({ excerpt: item.hook }).eq('post_id', post.id).eq('locale', tx.locale)
  }
}
```

Note: Can be combined into the same update as the content patch for efficiency — merge `excerpt` into the `patch` object before the update call.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts
git commit -m "feat(pipeline): transfer draft content on blog graduation"
```

---

### Task 4: Fix `createPostFromPipeline` server action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/actions.ts` (function `createPostFromPipeline`, lines 909-974)

- [ ] **Step 1: Add `sections` to the select query and import utility**

Change line 924:
```typescript
// Before:
.select('id, code, title_pt, title_en, hook, language, blog_post_id')
// After:
.select('id, code, title_pt, title_en, hook, language, blog_post_id, sections')
```

Add import at top of file:
```typescript
import { prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'
```

- [ ] **Step 2: Replace broken `content_pipeline_sections` query with utility call**

Replace lines 937-947:
```typescript
// Before:
let bodyContent = ''
const { data: sections } = await svc
  .from('content_pipeline_sections')
  .select('section_type, content')
  .eq('pipeline_id', pipelineItemId)
  .or('section_type.ilike.%rascunho%,section_type.ilike.%body%,section_type.ilike.%draft%')
  .limit(1)

if (sections && sections.length > 0) {
  bodyContent = (sections[0] as { content: string }).content
}

// After:
let contentPatch: Record<string, unknown> | null = null
try {
  const itemSections = item.sections as Record<string, unknown> | null
  const patch = await prepareBlogTranslationPatch(itemSections, locale === 'pt-BR' ? 'pt-br' : locale)
  if (patch) contentPatch = patch
} catch {
  // Best-effort
}
```

- [ ] **Step 3: Update the blog_translations update to use the patch**

Replace lines 956-965:
```typescript
// Before:
if (excerpt || bodyContent) {
  await svc
    .from('blog_translations')
    .update({
      ...(excerpt ? { excerpt } : {}),
      ...(bodyContent ? { content_mdx: bodyContent } : {}),
    })
    .eq('post_id', result.postId)
    .eq('locale', locale)
}

// After:
if (excerpt || contentPatch) {
  await svc
    .from('blog_translations')
    .update({
      ...(excerpt ? { excerpt } : {}),
      ...(contentPatch ?? {}),
    })
    .eq('post_id', result.postId)
    .eq('locale', locale)
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors

- [ ] **Step 5: Run full test suite**

Run: `npm run test:web`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/actions.ts
git commit -m "fix(blog): use draft-to-blog utility in createPostFromPipeline, remove broken table query"
```
