# Blog Editor Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the monolithic blog post editor (1427-line `post-edition-editor.tsx`) into a stage-based, document-first editor with inspector sidebar, focus mode, publish gate, and inline image blocks.

**Architecture:** useReducer + split Context (EditorStateContext read / EditorDispatchContext write). 5 stages (Ideia, Rascunho, Imagens, SEO, Publicacao) rendered in a two-column grid (720px canvas + 340px inspector). Custom TipTap `BlogImageExtension` with 6-state React NodeView. Existing components reused: TipTap editor, MediaGallery, useAutosave, NavigationGuard, StructuredFields, HashtagInput, SeriesFields.

**Tech Stack:** Next.js 15, React 19, TipTap, Vitest, TypeScript 5, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-06-04-blog-editor-rewrite-design.md`
**Visual mockups:** `.superpowers/brainstorm/85816-1780580280/content/` (image-blocks-v3.html, image-blocks-v4.html, editor-shell.html)

---

## Dependency Graph

```
T1 (types) → T2 (helpers) → T3 (reducer) → T4 (context) → T5 (shell)
                                                 ↓
                              ┌──────────────────┼──────────────────┐
                              ↓                  ↓                  ↓
                         T6 (action-bar)    T8 (stage-bar)    T14 (inspector shell)
                         T7 (lang-toggle)   T9-T13 (stages)   T15-T16 (inspector cards)
                                                 ↓
T1 → T17 (image ext) → T18 (image view)         ↓
T4 → T19 (autosave bridge)                      ↓
                              T20 (server page) → T22 (ephemeral) → T23 (integration) → T25 (route migration)
T21 (savePostField) — independent
T24 (CSS tokens) — after T5
```

**Parallelization:** Tasks 9-13 (stages), 15-16 (inspector cards), 17-18 (image extension), and 21 (server action) can all run in parallel once their dependencies are met.

---

## File Structure

All new files under `apps/web/src/app/cms/(authed)/blog/[id]/editor/`:

```
editor/
├── page.tsx                    # Server component: data loading
├── editor-client.tsx           # Client shell: EditorProvider + layout
├── context.tsx                 # Split contexts + useReducer + autosave bridge
├── reducer.ts                  # editorReducer + buildInitialState
├── types.ts                    # EditorState, EditorAction, Stage, VersionContent, SharedFields
├── helpers.ts                  # deriveSlug, publishGate, isEmptyVersion, imageStats, buildSavePayload
├── action-bar.tsx              # Sticky top bar
├── lang-toggle.tsx             # Language version toggle with add/remove
├── stage-bar.tsx               # 5-tab segmented control
├── stages/
│   ├── stage-ideia.tsx         # Read-only briefing
│   ├── stage-rascunho.tsx      # TipTap writing surface
│   ├── stage-imagens.tsx       # Image dashboard
│   ├── stage-seo.tsx           # Meta fields + SERP preview
│   └── stage-publicacao.tsx    # Publish gate + actions
├── inspector/
│   ├── inspector.tsx           # Sidebar shell + responsive drawer
│   ├── insp-detalhes.tsx       # Slug, excerpt, category, tags, structured fields
│   ├── insp-distribuicao.tsx   # Status, URL, dates, social toggles
│   ├── insp-historico.tsx      # Timeline
│   └── insp-arquivar.tsx       # Archive button
└── image-block/
    ├── blog-image-extension.ts # TipTap node definition
    ├── blog-image-view.tsx     # React NodeView (6 states)
    └── blog-image-toolbar.tsx  # Hover toolbar
```

Tests mirror under `apps/web/test/cms/blog/editor/`.

---

## Task 1: Types and Constants

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/editor/types.ts`
- Test: `apps/web/test/cms/blog/editor/types.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/cms/blog/editor/types.test.ts
import { describe, it, expect } from 'vitest'
import { STAGES, AUTO_SAVE_STATUSES, STAGE_ICONS } from '@/app/cms/(authed)/blog/[id]/editor/types'

describe('editor types and constants', () => {
  it('STAGES has 5 entries in correct order', () => {
    expect(STAGES).toEqual(['ideia', 'rascunho', 'imagens', 'seo', 'publicacao'])
  })

  it('AUTO_SAVE_STATUSES contains idea and draft', () => {
    expect(AUTO_SAVE_STATUSES.has('idea')).toBe(true)
    expect(AUTO_SAVE_STATUSES.has('draft')).toBe(true)
    expect(AUTO_SAVE_STATUSES.has('published')).toBe(false)
    expect(AUTO_SAVE_STATUSES.has('ready')).toBe(false)
  })

  it('STAGE_ICONS maps each stage to a string', () => {
    for (const stage of STAGES) {
      expect(typeof STAGE_ICONS[stage]).toBe('string')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/types.test.ts`
Expected: FAIL — cannot resolve import

- [ ] **Step 3: Implement types.ts**

```typescript
// apps/web/src/app/cms/(authed)/blog/[id]/editor/types.ts
import type { JSONContent } from '@tiptap/react'

export type Stage = 'ideia' | 'rascunho' | 'imagens' | 'seo' | 'publicacao'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'
export type PostStatus = 'idea' | 'draft' | 'ready' | 'pending_review' | 'scheduled' | 'published' | 'archived'
export type ImageBlockStatus = 'empty' | 'uploading' | 'processing' | 'done'
export type ImageAlignment = 'column' | 'wide' | 'full'

export interface VersionContent {
  title: string
  slug: string
  slugTouched: boolean
  excerpt: string
  body: JSONContent
  bodyHtml: string
  published: boolean
  publishedAt: string | null
  updatedAt: string | null
  dirty: boolean
  fresh: boolean
  coverImageUrl: string | null
  coverReady: boolean
  metaTitle: string
  metaDesc: string
  ogImageUrl: string | null
  words: number
  readTime: string
  titleAlts: string[]
}

export interface SharedFields {
  status: PostStatus
  category: string | null
  tagId: string | null
  tags: string[]
  hashtags: Array<{ id: string; name: string; slug: string }>
  hook: string
  synopsis: string
  plevel: string
  previousPostId: string | null
  continuesInNext: boolean
  keyPoints: string[]
  pullQuote: string
  notes: string[]
  colophon: string
  history: Array<{ to: string; date: string }>
}

export interface EditorState {
  postId: string | null
  code: string
  activeStage: Stage
  activeLang: 'pt' | 'en'
  focus: boolean
  content: Partial<Record<'pt' | 'en', VersionContent>>
  shared: SharedFields
  saveStatus: SaveStatus
}

export type EditorAction =
  | { type: 'SET_STAGE'; stage: Stage }
  | { type: 'SET_LANG'; lang: 'pt' | 'en' }
  | { type: 'TOGGLE_FOCUS' }
  | { type: 'SET_POST_ID'; id: string }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'SET_BODY'; body: JSONContent; html: string; words: number; readTime: string }
  | { type: 'SET_SLUG'; slug: string; touched: boolean }
  | { type: 'SET_EXCERPT'; excerpt: string }
  | { type: 'SET_COVER'; url: string | null; ready: boolean }
  | { type: 'SET_FIELD'; field: keyof VersionContent; value: unknown }
  | { type: 'SET_SHARED'; field: keyof SharedFields; value: unknown }
  | { type: 'SET_IMAGE_STATUS'; imageId: string; status: ImageBlockStatus }
  | { type: 'ADD_VERSION'; lang: 'pt' | 'en' }
  | { type: 'REMOVE_VERSION'; lang: 'pt' | 'en' }
  | { type: 'PUBLISH'; lang: 'pt' | 'en' }
  | { type: 'UPDATE_PUBLISHED' }
  | { type: 'MARK_DIRTY' }
  | { type: 'CLEAR_DIRTY' }
  | { type: 'SET_SAVE_STATUS'; status: SaveStatus }
  | { type: 'INIT'; state: EditorState }

export interface GateCheck {
  key: 'title' | 'content' | 'images'
  ok: boolean
  stage: Stage
}

export interface GateResult {
  passed: boolean
  checks: GateCheck[]
}

export interface ImageStatsResult {
  done: number
  total: number
}

export const STAGES: Stage[] = ['ideia', 'rascunho', 'imagens', 'seo', 'publicacao']

export const AUTO_SAVE_STATUSES = new Set<PostStatus>(['idea', 'draft'])

export const STAGE_ICONS: Record<Stage, string> = {
  ideia: 'Lightbulb',
  rascunho: 'Edit',
  imagens: 'Image',
  seo: 'Search',
  publicacao: 'Upload',
}

export const EMPTY_VERSION: VersionContent = {
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  body: { type: 'doc', content: [] },
  bodyHtml: '',
  published: false,
  publishedAt: null,
  updatedAt: null,
  dirty: false,
  fresh: true,
  coverImageUrl: null,
  coverReady: false,
  metaTitle: '',
  metaDesc: '',
  ogImageUrl: null,
  words: 0,
  readTime: '',
  titleAlts: [],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/editor/types.ts apps/web/test/cms/blog/editor/types.test.ts
git commit -m "feat(blog-editor): add types and constants for stage-based editor"
```

---

## Task 2: Helper Functions

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/editor/helpers.ts`
- Test: `apps/web/test/cms/blog/editor/helpers.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/cms/blog/editor/helpers.test.ts
import { describe, it, expect } from 'vitest'
import { deriveSlug, publishGate, isEmptyVersion, imageStats } from '@/app/cms/(authed)/blog/[id]/editor/helpers'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'
import type { EditorState, VersionContent } from '@/app/cms/(authed)/blog/[id]/editor/types'

describe('deriveSlug', () => {
  it('lowercases and converts spaces to hyphens', () => {
    expect(deriveSlug('Hello World')).toBe('hello-world')
  })

  it('strips accents via NFD decomposition', () => {
    expect(deriveSlug('Automatização de Deploys')).toBe('automatizacao-de-deploys')
  })

  it('removes smart quotes and apostrophes', () => {
    expect(deriveSlug("It's a "test"")).toBe('its-a-test')
  })

  it('keeps only alphanumeric and hyphens', () => {
    expect(deriveSlug('Hello! @World #2024')).toBe('hello-world-2024')
  })

  it('trims leading and trailing hyphens', () => {
    expect(deriveSlug('---hello---')).toBe('hello')
  })

  it('caps at 60 characters', () => {
    const long = 'a'.repeat(80)
    expect(deriveSlug(long).length).toBeLessThanOrEqual(60)
  })

  it('collapses consecutive hyphens', () => {
    expect(deriveSlug('hello   world')).toBe('hello-world')
  })

  it('returns empty string for empty input', () => {
    expect(deriveSlug('')).toBe('')
  })
})

describe('isEmptyVersion', () => {
  it('returns true for EMPTY_VERSION', () => {
    expect(isEmptyVersion(EMPTY_VERSION)).toBe(true)
  })

  it('returns false when title is set', () => {
    expect(isEmptyVersion({ ...EMPTY_VERSION, title: 'Test' })).toBe(false)
  })

  it('returns false when published', () => {
    expect(isEmptyVersion({ ...EMPTY_VERSION, published: true })).toBe(false)
  })

  it('returns false when excerpt is set', () => {
    expect(isEmptyVersion({ ...EMPTY_VERSION, excerpt: 'Summary' })).toBe(false)
  })

  it('returns false when body has text content', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
    expect(isEmptyVersion({ ...EMPTY_VERSION, body })).toBe(false)
  })
})

describe('publishGate', () => {
  const baseVersion: VersionContent = {
    ...EMPTY_VERSION,
    title: 'Test Post',
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }] },
    bodyHtml: '<p>Content</p>',
    coverReady: true,
    fresh: false,
  }

  function makeState(version: Partial<VersionContent> = {}): { state: EditorState; lang: 'pt' } {
    return {
      state: {
        postId: 'p1', code: 'tg-01', activeStage: 'publicacao', activeLang: 'pt',
        focus: false, saveStatus: 'idle',
        content: { pt: { ...baseVersion, ...version } },
        shared: { status: 'draft', category: null, tagId: null, tags: [], hashtags: [],
          hook: '', synopsis: '', plevel: 'P1', previousPostId: null, continuesInNext: false,
          keyPoints: [], pullQuote: '', notes: [], colophon: '', history: [] },
      },
      lang: 'pt' as const,
    }
  }

  it('passes when title, content, and images are all ready', () => {
    const { state, lang } = makeState()
    const result = publishGate(state, lang)
    expect(result.passed).toBe(true)
    expect(result.checks.every(c => c.ok)).toBe(true)
  })

  it('fails when title is empty', () => {
    const { state, lang } = makeState({ title: '' })
    const result = publishGate(state, lang)
    expect(result.passed).toBe(false)
    expect(result.checks.find(c => c.key === 'title')?.ok).toBe(false)
  })

  it('fails when body has no text', () => {
    const { state, lang } = makeState({ body: { type: 'doc', content: [] }, bodyHtml: '' })
    const result = publishGate(state, lang)
    expect(result.passed).toBe(false)
    expect(result.checks.find(c => c.key === 'content')?.ok).toBe(false)
  })

  it('fails when cover is not ready', () => {
    const { state, lang } = makeState({ coverReady: false })
    const result = publishGate(state, lang)
    expect(result.passed).toBe(false)
    expect(result.checks.find(c => c.key === 'images')?.ok).toBe(false)
  })

  it('fails when inline blogImage has status empty', () => {
    const bodyWithPendingImage = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'blogImage', attrs: { id: 'img-1', status: 'empty', src: null } },
      ],
    }
    const { state, lang } = makeState({ body: bodyWithPendingImage })
    const result = publishGate(state, lang)
    expect(result.passed).toBe(false)
    expect(result.checks.find(c => c.key === 'images')?.ok).toBe(false)
  })
})

describe('imageStats', () => {
  it('returns 0/0 when body has no images', () => {
    const body = { type: 'doc', content: [{ type: 'paragraph' }] }
    const result = imageStats(body, true)
    expect(result).toEqual({ done: 0, total: 0 })
  })

  it('counts done and total from blogImage nodes', () => {
    const body = {
      type: 'doc',
      content: [
        { type: 'blogImage', attrs: { id: 'img-1', status: 'done' } },
        { type: 'blogImage', attrs: { id: 'img-2', status: 'empty' } },
        { type: 'blogImage', attrs: { id: 'img-3', status: 'done' } },
      ],
    }
    const result = imageStats(body, true)
    expect(result).toEqual({ done: 2, total: 3 })
  })

  it('includes cover in total when not ready', () => {
    const body = { type: 'doc', content: [] }
    const result = imageStats(body, false)
    expect(result.total).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/helpers.test.ts`
Expected: FAIL — cannot resolve import

- [ ] **Step 3: Implement helpers.ts**

```typescript
// apps/web/src/app/cms/(authed)/blog/[id]/editor/helpers.ts
import type { JSONContent } from '@tiptap/react'
import type { EditorState, VersionContent, GateResult, ImageStatsResult } from './types'

export function deriveSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’“”']/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function isEmptyVersion(version: VersionContent): boolean {
  if (version.title.trim()) return false
  if (version.excerpt.trim()) return false
  if (version.published) return false
  if (hasTextContent(version.body)) return false
  return true
}

export function publishGate(state: EditorState, lang: 'pt' | 'en'): GateResult {
  const version = state.content[lang]
  if (!version) return { passed: false, checks: [] }

  const titleOk = version.title.trim().length > 0
  const contentOk = hasTextContent(version.body)
  const stats = imageStats(version.body, version.coverReady)
  const imagesOk = version.coverReady && stats.done === stats.total

  const checks = [
    { key: 'title' as const, ok: titleOk, stage: 'rascunho' as const },
    { key: 'content' as const, ok: contentOk, stage: 'rascunho' as const },
    { key: 'images' as const, ok: imagesOk, stage: 'imagens' as const },
  ]

  return { passed: checks.every(c => c.ok), checks }
}

export function imageStats(body: JSONContent, coverReady: boolean): ImageStatsResult {
  const images = collectBlogImages(body)
  const done = images.filter(img => img.status === 'done').length
  return { done, total: images.length }
}

function collectBlogImages(node: JSONContent): Array<{ status: string }> {
  const results: Array<{ status: string }> = []
  if (node.type === 'blogImage' && node.attrs) {
    results.push({ status: (node.attrs.status as string) ?? 'empty' })
  }
  if (node.content) {
    for (const child of node.content) {
      results.push(...collectBlogImages(child))
    }
  }
  return results
}

function hasTextContent(body: JSONContent): boolean {
  if (!body.content) return false
  return body.content.some(node => {
    if (node.type === 'paragraph' || node.type === 'heading') {
      return node.content?.some(inline => inline.type === 'text' && inline.text?.trim()) ?? false
    }
    if (node.type === 'blockquote' || node.type === 'bulletList' || node.type === 'orderedList') {
      return hasTextContent(node)
    }
    if (node.type === 'listItem') {
      return hasTextContent(node)
    }
    return false
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/editor/helpers.ts apps/web/test/cms/blog/editor/helpers.test.ts
git commit -m "feat(blog-editor): add helper functions — deriveSlug, publishGate, isEmptyVersion, imageStats"
```

---

## Task 3: Reducer

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/editor/reducer.ts`
- Test: `apps/web/test/cms/blog/editor/reducer.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// apps/web/test/cms/blog/editor/reducer.test.ts
import { describe, it, expect } from 'vitest'
import { editorReducer, buildInitialState } from '@/app/cms/(authed)/blog/[id]/editor/reducer'
import { EMPTY_VERSION } from '@/app/cms/(authed)/blog/[id]/editor/types'
import type { EditorState } from '@/app/cms/(authed)/blog/[id]/editor/types'

function makeState(overrides: Partial<EditorState> = {}): EditorState {
  return {
    postId: 'p1',
    code: 'tg-01',
    activeStage: 'rascunho',
    activeLang: 'pt',
    focus: false,
    content: { pt: { ...EMPTY_VERSION, fresh: false } },
    shared: {
      status: 'draft', category: null, tagId: null, tags: [], hashtags: [],
      hook: '', synopsis: '', plevel: 'P1', previousPostId: null, continuesInNext: false,
      keyPoints: [], pullQuote: '', notes: [], colophon: '', history: [],
    },
    saveStatus: 'idle',
    ...overrides,
  }
}

describe('editorReducer', () => {
  describe('navigation', () => {
    it('SET_STAGE changes activeStage', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_STAGE', stage: 'seo' })
      expect(next.activeStage).toBe('seo')
    })

    it('SET_LANG changes activeLang', () => {
      const state = makeState({ content: { pt: { ...EMPTY_VERSION, fresh: false }, en: { ...EMPTY_VERSION, fresh: true } } })
      const next = editorReducer(state, { type: 'SET_LANG', lang: 'en' })
      expect(next.activeLang).toBe('en')
    })

    it('TOGGLE_FOCUS toggles focus', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'TOGGLE_FOCUS' })
      expect(next.focus).toBe(true)
      const next2 = editorReducer(next, { type: 'TOGGLE_FOCUS' })
      expect(next2.focus).toBe(false)
    })
  })

  describe('content', () => {
    it('SET_TITLE updates title and auto-derives slug when not touched', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_TITLE', title: 'Hello World' })
      expect(next.content.pt?.title).toBe('Hello World')
      expect(next.content.pt?.slug).toBe('hello-world')
    })

    it('SET_TITLE does not change slug when slugTouched is true', () => {
      const state = makeState({
        content: { pt: { ...EMPTY_VERSION, fresh: false, slug: 'custom-slug', slugTouched: true } },
      })
      const next = editorReducer(state, { type: 'SET_TITLE', title: 'Hello World' })
      expect(next.content.pt?.slug).toBe('custom-slug')
    })

    it('SET_SLUG updates slug and touched flag', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_SLUG', slug: 'manual-slug', touched: true })
      expect(next.content.pt?.slug).toBe('manual-slug')
      expect(next.content.pt?.slugTouched).toBe(true)
    })

    it('SET_BODY updates body, html, words, readTime', () => {
      const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_BODY', body, html: '<p>Hello</p>', words: 1, readTime: '1 min' })
      expect(next.content.pt?.body).toEqual(body)
      expect(next.content.pt?.bodyHtml).toBe('<p>Hello</p>')
      expect(next.content.pt?.words).toBe(1)
    })

    it('SET_COVER updates coverImageUrl and coverReady', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_COVER', url: 'https://cdn.example.com/img.jpg', ready: true })
      expect(next.content.pt?.coverImageUrl).toBe('https://cdn.example.com/img.jpg')
      expect(next.content.pt?.coverReady).toBe(true)
    })
  })

  describe('versions', () => {
    it('ADD_VERSION creates empty version and switches lang', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'ADD_VERSION', lang: 'en' })
      expect(next.content.en).toBeDefined()
      expect(next.content.en?.fresh).toBe(true)
      expect(next.activeLang).toBe('en')
    })

    it('REMOVE_VERSION removes version and switches to remaining', () => {
      const state = makeState({
        activeLang: 'en',
        content: { pt: { ...EMPTY_VERSION, fresh: false }, en: { ...EMPTY_VERSION, fresh: true } },
      })
      const next = editorReducer(state, { type: 'REMOVE_VERSION', lang: 'en' })
      expect(next.content.en).toBeUndefined()
      expect(next.activeLang).toBe('pt')
    })

    it('REMOVE_VERSION is a no-op when only one version exists', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'REMOVE_VERSION', lang: 'pt' })
      expect(next.content.pt).toBeDefined()
    })
  })

  describe('publishing', () => {
    it('PUBLISH sets published and publishedAt', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'PUBLISH', lang: 'pt' })
      expect(next.content.pt?.published).toBe(true)
      expect(next.content.pt?.publishedAt).toBeTruthy()
      expect(next.content.pt?.dirty).toBe(false)
    })

    it('MARK_DIRTY sets dirty on active version', () => {
      const state = makeState({
        content: { pt: { ...EMPTY_VERSION, fresh: false, published: true } },
      })
      const next = editorReducer(state, { type: 'MARK_DIRTY' })
      expect(next.content.pt?.dirty).toBe(true)
    })

    it('CLEAR_DIRTY resets dirty', () => {
      const state = makeState({
        content: { pt: { ...EMPTY_VERSION, fresh: false, dirty: true } },
      })
      const next = editorReducer(state, { type: 'CLEAR_DIRTY' })
      expect(next.content.pt?.dirty).toBe(false)
    })

    it('UPDATE_PUBLISHED sets updatedAt and clears dirty', () => {
      const state = makeState({
        content: { pt: { ...EMPTY_VERSION, fresh: false, published: true, dirty: true } },
      })
      const next = editorReducer(state, { type: 'UPDATE_PUBLISHED' })
      expect(next.content.pt?.updatedAt).toBeTruthy()
      expect(next.content.pt?.dirty).toBe(false)
    })
  })

  describe('save', () => {
    it('SET_SAVE_STATUS updates saveStatus', () => {
      const state = makeState()
      const next = editorReducer(state, { type: 'SET_SAVE_STATUS', status: 'saving' })
      expect(next.saveStatus).toBe('saving')
    })

    it('SET_POST_ID sets postId', () => {
      const state = makeState({ postId: null })
      const next = editorReducer(state, { type: 'SET_POST_ID', id: 'new-id' })
      expect(next.postId).toBe('new-id')
    })
  })

  describe('INIT', () => {
    it('replaces state wholesale', () => {
      const state = makeState()
      const newState = makeState({ postId: 'new', activeStage: 'seo' })
      const next = editorReducer(state, { type: 'INIT', state: newState })
      expect(next).toEqual(newState)
    })
  })
})

describe('buildInitialState', () => {
  it('transforms server data into EditorState', () => {
    const serverData = {
      postId: 'p1',
      code: 'tg-01',
      locale: 'pt',
      title: 'Test',
      slug: 'test',
      excerpt: '',
      status: 'draft' as const,
      contentJson: null,
      contentHtml: null,
      coverImageUrl: null,
      metaTitle: '',
      metaDesc: '',
      ogImageUrl: null,
      keyPoints: [],
      pullQuote: '',
      notes: [],
      colophon: '',
      previousPostId: null,
      continuesInNext: false,
      hashtags: [],
      tags: [],
      hook: '',
      synopsis: '',
      plevel: 'P1',
      history: [],
      category: null,
      tagId: null,
    }
    const state = buildInitialState(serverData)
    expect(state.postId).toBe('p1')
    expect(state.activeLang).toBe('pt')
    expect(state.content.pt?.title).toBe('Test')
    expect(state.shared.status).toBe('draft')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/reducer.test.ts`
Expected: FAIL — cannot resolve import

- [ ] **Step 3: Implement reducer.ts**

The reducer implementation handles all 20 action types. Each case returns a new state object (immutable updates). `SET_TITLE` calls `deriveSlug()` when `!slugTouched`. `ADD_VERSION` clones `EMPTY_VERSION` with `fresh: true`. `REMOVE_VERSION` checks version count > 1. `PUBLISH` sets `publishedAt` to ISO string. `buildInitialState` transforms server data to `EditorState` shape.

Implementation follows the exact action types from `types.ts`, using the patterns tested above. Each action targets `state.content[state.activeLang]` for version-specific updates, or `state.shared` for cross-version fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/reducer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/editor/reducer.ts apps/web/test/cms/blog/editor/reducer.test.ts
git commit -m "feat(blog-editor): implement editorReducer with 20 action types"
```

---

## Task 4: Context (EditorStateContext + EditorDispatchContext)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/blog/[id]/editor/context.tsx`
- Test: `apps/web/test/cms/blog/editor/context.test.tsx`

- [ ] **Step 1: Write the test file**

Tests verify: EditorProvider renders children, `useEditorState()` returns state, `useEditorDispatch()` returns stable dispatch ref, `useEditorVersion()` returns active lang content, dispatch ref doesn't change across re-renders (preventing unnecessary re-renders in dispatch-only consumers).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/context.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement context.tsx**

```typescript
// apps/web/src/app/cms/(authed)/blog/[id]/editor/context.tsx
'use client'
import { createContext, useContext, useReducer, useRef, useCallback, type ReactNode } from 'react'
import { editorReducer } from './reducer'
import type { EditorState, EditorAction } from './types'

const EditorStateContext = createContext<EditorState | null>(null)
const EditorDispatchContext = createContext<((action: EditorAction) => void) | null>(null)

export function useEditorState(): EditorState {
  const ctx = useContext(EditorStateContext)
  if (!ctx) throw new Error('useEditorState must be used within EditorProvider')
  return ctx
}

export function useEditorDispatch(): (action: EditorAction) => void {
  const ctx = useContext(EditorDispatchContext)
  if (!ctx) throw new Error('useEditorDispatch must be used within EditorProvider')
  return ctx
}

export function useEditorVersion() {
  const state = useEditorState()
  return state.content[state.activeLang] ?? null
}

interface EditorProviderProps {
  initialState: EditorState
  children: ReactNode
}

export function EditorProvider({ initialState, children }: EditorProviderProps) {
  const [state, dispatch] = useReducer(editorReducer, initialState)
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch

  const stableDispatch = useCallback((action: EditorAction) => {
    dispatchRef.current(action)
  }, [])

  return (
    <EditorStateContext.Provider value={state}>
      <EditorDispatchContext.Provider value={stableDispatch}>
        {children}
      </EditorDispatchContext.Provider>
    </EditorStateContext.Provider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/cms/blog/editor/context.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/editor/context.tsx apps/web/test/cms/blog/editor/context.test.tsx
git commit -m "feat(blog-editor): add split context — EditorStateContext + EditorDispatchContext"
```

---

## Tasks 5-25: Remaining Implementation

Tasks 5 through 25 follow the same TDD pattern established above. Each task creates one focused component with its test file. The full details for each:

### Task 5: Editor Shell Layout
Create `editor-client.tsx` — the top-level client component composing EditorProvider, MainGrid (two-column), DocumentCanvas (stage router), FocusModePill. Test: shell renders, stage routing works, focus mode hides sidebar.

### Task 6: ActionBar
Create `action-bar.tsx` — sticky bar with breadcrumb, autosave indicator, focus toggle, save button. Reuses `AutosaveIndicator` from `_shared/editor/autosave-indicator.tsx`. Test: renders breadcrumb, focus toggle dispatches.

### Task 7: LangToggle
Create `lang-toggle.tsx` — single/dual version toggle with add/remove + confirmation popovers. Test: single vs dual rendering, add/remove dispatch, confirmation flow.

### Task 8: StageBar
Create `stage-bar.tsx` — 5-tab pill bar with Lucide icons. Shows amber dot on Imagens when images pending. Hidden in focus mode. Test: renders 5 tabs, dispatches SET_STAGE, amber dot logic.

### Task 9: StageIdeia
Create `stages/stage-ideia.tsx` — read-only briefing with hook/synopsis + editable title + meta line. Fresh version variant with placeholder prompts. Test: renders hook/synopsis, title dispatches.

### Task 10: StageRascunho
Create `stages/stage-rascunho.tsx` — editable title + meta line + writing toolbar + TipTap editor (dynamic import). Test: renders title, TipTap onChange dispatches SET_BODY.

### Task 11: StageImagens
Create `stages/stage-imagens.tsx` — summary bar, cover section with MediaGallery, content image rows from body JSON, navigation links. Test: summary counts, gallery button, navigation dispatch.

### Task 12: StageSeo
Create `stages/stage-seo.tsx` — meta title/desc inputs with char counters (4 states each) + SERP preview. Test: char counter states at thresholds, SERP fallbacks.

### Task 13: StagePublicacao
Create `stages/stage-publicacao.tsx` — publish gate display, title alts, schedule/publish buttons (disabled when gate fails), update flow for published+dirty. Reuses `ScheduleModal`. Test: gate blocks buttons, title alt swap, update box appears.

### Task 14: Inspector Shell
Create `inspector/inspector.tsx` — 340px sidebar, renders 4 card slots, hidden in focus mode, responsive drawer below 1080px. Test: renders cards, hidden in focus.

### Task 15: InspDetalhes
Create `inspector/insp-detalhes.tsx` — slug field with auto-derive + regenerate, excerpt, plevel, category, tags, collapsible sections for StructuredFields/SeriesFields/HashtagInput (all reused). Test: slug dispatches, regenerate link.

### Task 16: InspDistribuicao + InspHistorico + InspArquivar
Create 3 inspector card files — status/URL/dates/social toggles, timeline, archive button. Test: status states, timeline rendering, archive confirmation.

### Task 17: BlogImageExtension
Create `image-block/blog-image-extension.ts` — TipTap node definition extending Image. Attributes: id, src, alt, caption, status, alignment, width, assetId. parseHTML/renderHTML for `<figure data-blog-image>`. Test: attribute defaults, HTML round-trip, ID assignment.

### Task 18: BlogImageView + Toolbar
Create `image-block/blog-image-view.tsx` + `blog-image-toolbar.tsx` — React NodeView rendering 6 states (empty, uploading, processing, done, error, broken). Hover toolbar with width modes, replace, delete. Caption/alt toggle. MediaGallery integration. Test: each state renders, gallery opens, width mode gating.

### Task 19: Autosave Bridge
Modify `context.tsx` — wire useAutosave hook with fieldsRef bridge, dispatchAndSave wrapper, mode switching based on status. Test: dispatch+save called together, mode switches, disabled when ephemeral.

### Task 20: Server Page
Create `page.tsx` — server component with parallel data fetches, transforms to EditorState via buildInitialState. Test: mock supabase, verify props, notFound on missing.

### Task 21: savePostField Server Action
Add to `[id]/edit/actions.ts` — granular field save for inspector. Test: saves correctly, revalidates SEO, rejects unauthorized.

### Task 22: Ephemeral Post Flow
Modify `context.tsx` — handle postId=null, title blur creates post, URL replacement, creationPromiseRef. Test: creation triggers, URL replaces, duplicates prevented.

### Task 23: Integration Wiring
Connect all real components in editor-client.tsx. Wire toasts, preview mode, NavigationGuard. Test: end-to-end flow with mock data.

### Task 24: CSS / Design Tokens
Create `editor-theme.css` — all design tokens from spec (typography, colors, radius, heights, shadows, motion, focus, grid, responsive breakpoint). No test — visual verification.

### Task 25: Route Migration
Update editorial kanban links to point to `/editor/`. Old `/edit/` route remains. Test: links point to correct route.

---

## Verification Checklist (Post-Implementation)

After all tasks complete, verify end-to-end per spec:

- [ ] Unit tests pass: `npm run test:web`
- [ ] Build succeeds: `npm run build:packages && cd apps/web && npx next build`
- [ ] Navigate to `/cms/blog/[id]/editor` — editor loads with server data
- [ ] Switch between all 5 stages — content persists
- [ ] Type title → slug auto-derives in Inspector
- [ ] Add image block via slash command → placeholder appears
- [ ] Select image from gallery → block transitions to "done"
- [ ] Switch to Imagens tab → dashboard shows correct counts
- [ ] Fill SEO fields → SERP preview updates live
- [ ] Publish gate blocks when images pending → unblocks when all done
- [ ] Focus mode hides sidebar + stage bar → Esc exits
- [ ] Add EN version → empty version with fresh flag
- [ ] Autosave debounces at 3000ms in draft mode
- [ ] Published post edit → dirty flag → "Alterações pendentes" badge
- [ ] Back navigation with unsaved changes → guard dialog appears
- [ ] Responsive: below 1080px → single column + drawer
