# Graduate Draft Content Transfer — Design Spec

## Goal

When a pipeline item graduates to a blog post, transfer the draft section content (Tiptap JSONContent or markdown) into the newly created blog translations, so the blog editor opens with the content already populated.

## Context

Both the pipeline editor and blog editor now use identical Tiptap extensions (headings, lists, tables, columns, embeds, callouts, etc.), making JSONContent directly portable between them.

Currently, both graduation paths create blog translations with **empty content**:
1. **API route** (`/api/pipeline/items/[id]/graduate`) — creates translations with `content_mdx: ''`
2. **Server action** (`createPostFromPipeline` in `blog/actions.ts`) — queries a **non-existent table** `content_pipeline_sections`, always falls back to empty

## Architecture

### Shared utility: `lib/pipeline/draft-to-blog.ts`

Single source of truth for extracting draft content and preparing it for blog storage.

**`extractDraftBody(content: unknown): { json: JSONContent | null, mdx: string | null }`**
- Detects content format: plain string → mdx, JSONContent → json, hybrid `{ body, seo }` → recurse on body
- Returns `{ json: null, mdx: null }` for unrecognized/empty content

**`getDraftForLocale(sections: Record<string, unknown>, locale: string): unknown | null`**
- Maps locale to section key: `pt-br`/`pt` → `draft_pt`, `en` → `draft_en`
- Returns `sections[key].content` or null if missing

**`prepareBlogTranslationPatch(sections, locale): Promise<BlogContentPatch | null>`**
- Orchestrates: getDraftForLocale → extractDraftBody → compile if JSON
- JSON path: calls `compileJsonContent()` → returns `{ content_json, content_html, content_compiled: null, content_toc, reading_time_min, content_mdx: null }`
- MDX path: returns `{ content_mdx, content_json: null, content_html: null, content_compiled: null, content_toc: [], reading_time_min: 0 }`
- Returns null if no draft found (graceful degradation)

### Graduate API route changes

File: `apps/web/src/app/api/pipeline/items/[id]/graduate/route.ts`

- Already does `select('*')` so `sections` JSONB is available
- After creating blog translations, call `prepareBlogTranslationPatch()` for each locale
- Patch `blog_translations` with the result
- Add `hook` → `excerpt` transfer (harmonize with server action)

### Server action changes

File: `apps/web/src/app/cms/(authed)/blog/actions.ts` → `createPostFromPipeline()`

- Add `sections` to the `select()` query
- Remove broken `content_pipeline_sections` table query (lines 938-947)
- Use `prepareBlogTranslationPatch()` for the specified locale
- Keep existing `hook` → `excerpt` logic

### Content format mapping

| Pipeline draft content | Blog translation fields |
|----------------------|------------------------|
| JSONContent `{ type: 'doc', ... }` | `content_json` = JSONContent, `content_html` = compiled HTML, `content_compiled` = null, `content_toc` = compiled TOC, `reading_time_min` = computed |
| Markdown string | `content_mdx` = string, `content_json` = null, `content_html` = null |
| Hybrid `{ body, seo }` | Extract `body`, apply above rules |
| Empty/missing | No patch (blog created with empty content as today) |

### Language mapping

| Pipeline `language` | Draft sections | Blog translations created |
|--------------------|---------------|--------------------------|
| `pt-br` | `draft_pt` | 1 translation (pt-br) with content |
| `en` | `draft_en` | 1 translation (en) with content |
| `both` | `draft_pt` + `draft_en` | 2 translations, each with its own draft content |

### Graceful degradation

- Missing draft section → blog post created with empty content (current behavior preserved)
- `compileJsonContent()` failure → log warning, create with empty content, never fail the graduation
- Malformed content → `extractDraftBody` returns nulls → no patch applied

### Error handling

Content transfer is best-effort. The graduation itself (creating the blog post, linking the FK, recording history) must never fail because of content transfer issues. Wrap the content transfer in try/catch and log on failure.

## Testing

- Unit tests for `extractDraftBody()`: string, JSONContent, `{body,seo}`, nested body, empty, null, array
- Unit tests for `getDraftForLocale()`: pt-br, en, missing key, empty sections object
- Unit tests for `prepareBlogTranslationPatch()`: JSON compile path, MDX path, null path, compile failure
- Existing graduate tests should still pass (backward compatible — empty drafts = same behavior)
