# CMS Content Blocks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the blog editor from raw MDX to TipTap, add 14 rich block types, and build a frontend HTML renderer with pinboard theme styling.

**Architecture:** Dual-path rendering — new posts store `content_json` (TipTap JSONContent) + compiled `content_html`; legacy posts keep the MDX path. A server-side `compileJsonContent()` function transforms JSON → themed HTML with spacing classes, TOC extraction, and Shiki syntax highlighting. The frontend renders sanitized HTML with `.pb-*` CSS classes.

**Tech Stack:** TipTap 3.22.4, Shiki, Vitest, Next.js 15, Tailwind 4, Supabase PostgreSQL 17

**Design Spec:** `docs/superpowers/specs/2026-05-12-cms-content-blocks-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `apps/web/lib/cms/compile-json.ts` | `compileJsonContent()` — JSON→HTML compiler with TOC/reading-time extraction |
| `apps/web/lib/cms/spacing.ts` | Spacing adjacency matrix + `getSpacingClass()` helper |
| `apps/web/src/styles/pinboard-blocks.css` | All `.pb-*` block theme classes |
| `apps/web/src/app/cms/(authed)/_shared/editor/callout-node.tsx` | TipTap CalloutNode extension (4 variants) |
| `apps/web/src/app/cms/(authed)/_shared/editor/toggle-node.tsx` | TipTap ToggleNode extension (wrapper/title/body) |
| `apps/web/src/app/cms/(authed)/_shared/editor/columns-node.tsx` | TipTap ColumnsNode extension (2-3 cols with ratio) |
| `apps/web/src/components/blog/blog-article-html.tsx` | HTML renderer wrapper (dangerouslySetInnerHTML + theme cascade) |
| `apps/web/src/components/blog/embed-hydrator.tsx` | Client-side embed iframe loader for social embeds |
| `supabase/migrations/YYYYMMDD_content_mdx_nullable.sql` | `ALTER TABLE blog_translations ALTER COLUMN content_mdx DROP NOT NULL` |
| `apps/web/test/unit/compile-json.test.ts` | Tests for JSON→HTML compiler |
| `apps/web/test/unit/spacing.test.ts` | Tests for spacing adjacency matrix |

### Modified files

| File | Changes |
|------|---------|
| `apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx` | Register new extensions (callout, toggle, columns, task-list, task-item, table), H4 in StarterKit, add callbacks for new block insertions |
| `apps/web/src/app/cms/(authed)/_shared/editor/slash-commands.tsx` | Add 6 new commands: H4, Callout, Toggle, Columns, Table, Checklist |
| `apps/web/src/app/cms/(authed)/_shared/editor/bubble-menu.tsx` | Add Highlight button (7th button) |
| `apps/web/src/app/cms/(authed)/_shared/editor/editor-toolbar.tsx` | Add H4 button, callout/table/columns buttons in new toolbar group |
| `apps/web/src/app/cms/(authed)/_shared/editor/editor-styles.css` | CSS for callout, toggle, columns, checklist, table in editor |
| `apps/web/src/app/cms/(authed)/_shared/editor/cta-button-node.tsx` | Multi-button attrs (`buttons[]` array, `style` per button) |
| `apps/web/src/app/cms/(authed)/_shared/editor/social-embed-node.tsx` | 6 new providers in `detectProvider()` |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` | Dual editor: TipTap if content_json, else PostEditor (MDX) |
| `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` | JSON compile path in `savePost()` |
| `apps/web/src/app/cms/(authed)/blog/new/new-post-editor.tsx` | New posts use TipTap by default |
| `apps/web/src/app/(public)/blog/[slug]/page.tsx` | Dual render path: HTML if content_json, else MDX |
| `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx` | Accept `htmlContent` prop for HTML path |
| `apps/web/package.json` | Add `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell` |

---

## Task 1: DB Migration — content_mdx nullable

**Files:**
- Create: `supabase/migrations/20260512000001_content_mdx_nullable.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Allow blog_translations.content_mdx to be NULL for TipTap-only posts
ALTER TABLE blog_translations ALTER COLUMN content_mdx DROP NOT NULL;
```

- [ ] **Step 2: Push to local DB and verify**

Run: `npx supabase migration list`
Expected: New migration appears as pending

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260512000001_content_mdx_nullable.sql
git commit -m "feat(blog): allow content_mdx to be nullable for TipTap posts"
```

---

## Task 2: Spacing System

**Files:**
- Create: `apps/web/lib/cms/spacing.ts`
- Create: `apps/web/test/unit/spacing.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/spacing.test.ts
import { describe, it, expect } from 'vitest'
import { getSpacingClass, SPACING_VALUES } from '@/lib/cms/spacing'

describe('getSpacingClass', () => {
  it('returns sm for paragraph → paragraph', () => {
    expect(getSpacingClass('paragraph', 'paragraph')).toBe('sp-sm')
  })

  it('returns xl for paragraph → heading', () => {
    expect(getSpacingClass('paragraph', 'heading')).toBe('sp-xl')
  })

  it('returns md for paragraph → codeBlock', () => {
    expect(getSpacingClass('paragraph', 'codeBlock')).toBe('sp-md')
  })

  it('returns lg for callout → callout', () => {
    expect(getSpacingClass('callout', 'callout')).toBe('sp-lg')
  })

  it('returns lg for any → divider', () => {
    expect(getSpacingClass('paragraph', 'horizontalRule')).toBe('sp-lg')
  })

  it('returns lg for divider → any', () => {
    expect(getSpacingClass('horizontalRule', 'paragraph')).toBe('sp-lg')
  })

  it('falls back to sm for unknown pairs', () => {
    expect(getSpacingClass('unknownA', 'unknownB')).toBe('sp-sm')
  })

  it('returns empty string for the first block (no previous)', () => {
    expect(getSpacingClass(null, 'paragraph')).toBe('')
  })
})

describe('SPACING_VALUES', () => {
  it('has 5 levels', () => {
    expect(Object.keys(SPACING_VALUES)).toEqual(['xs', 'sm', 'md', 'lg', 'xl'])
  })

  it('values are em units', () => {
    expect(SPACING_VALUES.xs).toBe('0.6em')
    expect(SPACING_VALUES.xl).toBe('3.0em')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/spacing.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement spacing module**

```typescript
// apps/web/lib/cms/spacing.ts

export const SPACING_VALUES = {
  xs: '0.6em',
  sm: '1.0em',
  md: '1.6em',
  lg: '2.2em',
  xl: '3.0em',
} as const

type SpacingLevel = keyof typeof SPACING_VALUES

const SPACING_MATRIX: Record<string, Record<string, SpacingLevel>> = {
  paragraph:      { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', table: 'md', socialEmbed: 'md', toggleWrapper: 'md', columns: 'md', ctaButton: 'md', horizontalRule: 'lg', taskList: 'sm', image: 'md' },
  heading:        { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', image: 'md' },
  codeBlock:      { paragraph: 'md', heading: 'xl' },
  callout:        { paragraph: 'md', callout: 'lg', heading: 'xl' },
  horizontalRule: {},
  blockquote:     { paragraph: 'md', heading: 'xl' },
  ctaButton:      { paragraph: 'md', heading: 'xl' },
  toggleWrapper:  { paragraph: 'md', heading: 'xl' },
  columns:        { paragraph: 'md', heading: 'xl' },
  table:          { paragraph: 'md', heading: 'xl' },
  socialEmbed:    { paragraph: 'md', heading: 'xl' },
  taskList:       { paragraph: 'sm', heading: 'xl' },
  image:          { paragraph: 'md', heading: 'xl' },
}

const DEFAULTS: Record<string, SpacingLevel> = {
  horizontalRule: 'lg',
}

export function getSpacingClass(prevType: string | null, currentType: string): string {
  if (prevType === null) return ''

  if (prevType === 'horizontalRule' || currentType === 'horizontalRule') {
    return 'sp-lg'
  }

  const row = SPACING_MATRIX[prevType]
  if (row) {
    const specific = row[currentType]
    if (specific) return `sp-${specific}`
  }

  const defaultLevel = DEFAULTS[prevType] ?? DEFAULTS[currentType] ?? 'sm'
  return `sp-${defaultLevel}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/spacing.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/cms/spacing.ts apps/web/test/unit/spacing.test.ts
git commit -m "feat(blog): add spacing adjacency matrix for content blocks"
```

---

## Task 3: JSON→HTML Compile Pipeline

**Files:**
- Create: `apps/web/lib/cms/compile-json.ts`
- Create: `apps/web/test/unit/compile-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/web/test/unit/compile-json.test.ts
import { describe, it, expect } from 'vitest'
import { compileJsonContent } from '@/lib/cms/compile-json'
import type { JSONContent } from '@tiptap/core'

function doc(...content: JSONContent[]): JSONContent {
  return { type: 'doc', content }
}

function p(text: string): JSONContent {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function h(level: number, text: string): JSONContent {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] }
}

describe('compileJsonContent', () => {
  it('compiles a paragraph to HTML', async () => {
    const result = await compileJsonContent(doc(p('Hello world')))
    expect(result.html).toContain('<p class="pb-p')
    expect(result.html).toContain('Hello world')
  })

  it('compiles headings with id slugs', async () => {
    const result = await compileJsonContent(doc(h(2, 'My Section')))
    expect(result.html).toContain('<h2')
    expect(result.html).toContain('id="my-section"')
    expect(result.html).toContain('pb-h2')
  })

  it('extracts TOC from h2 and h3', async () => {
    const result = await compileJsonContent(doc(
      h(2, 'Introduction'),
      p('some text'),
      h(3, 'Details'),
    ))
    expect(result.toc).toEqual([
      { slug: 'introduction', text: 'Introduction', depth: 2 },
      { slug: 'details', text: 'Details', depth: 3 },
    ])
  })

  it('computes reading time', async () => {
    const longText = 'word '.repeat(400)
    const result = await compileJsonContent(doc(p(longText)))
    expect(result.readingTimeMin).toBe(2)
  })

  it('applies spacing classes between blocks', async () => {
    const result = await compileJsonContent(doc(p('first'), p('second')))
    expect(result.html).toMatch(/sp-sm/)
  })

  it('does not add spacing class to first block', async () => {
    const result = await compileJsonContent(doc(p('only')))
    expect(result.html).not.toMatch(/sp-/)
  })

  it('compiles bullet list', async () => {
    const result = await compileJsonContent(doc({
      type: 'bulletList',
      content: [{
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
      }],
    }))
    expect(result.html).toContain('<ul class="pb-ul')
    expect(result.html).toContain('<li')
  })

  it('compiles ordered list', async () => {
    const result = await compileJsonContent(doc({
      type: 'orderedList',
      content: [{
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
      }],
    }))
    expect(result.html).toContain('<ol class="pb-ol')
  })

  it('compiles blockquote', async () => {
    const result = await compileJsonContent(doc({
      type: 'blockquote',
      content: [p('quote text')],
    }))
    expect(result.html).toContain('<blockquote class="pb-quote')
  })

  it('compiles horizontal rule', async () => {
    const result = await compileJsonContent(doc({ type: 'horizontalRule' }))
    expect(result.html).toContain('pb-divider')
  })

  it('compiles code block with language attr', async () => {
    const result = await compileJsonContent(doc({
      type: 'codeBlock',
      attrs: { language: 'typescript' },
      content: [{ type: 'text', text: 'const x = 1' }],
    }))
    expect(result.html).toContain('pb-code')
    expect(result.html).toContain('data-lang="typescript"')
  })

  it('compiles callout node', async () => {
    const result = await compileJsonContent(doc({
      type: 'callout',
      attrs: { variant: 'warning' },
      content: [{ type: 'text', text: 'Be careful' }],
    }))
    expect(result.html).toContain('pb-callout')
    expect(result.html).toContain('pb-callout-warning')
  })

  it('compiles CTA button', async () => {
    const result = await compileJsonContent(doc({
      type: 'ctaButton',
      attrs: {
        buttons: [{ text: 'Click', url: 'https://example.com', style: 'primary' }],
        align: 'center',
      },
    }))
    expect(result.html).toContain('pb-cta')
    expect(result.html).toContain('pb-cta-primary')
    expect(result.html).toContain('href="https://example.com"')
  })

  it('compiles task list (checklist)', async () => {
    const result = await compileJsonContent(doc({
      type: 'taskList',
      content: [{
        type: 'taskItem',
        attrs: { checked: true },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done' }] }],
      }],
    }))
    expect(result.html).toContain('pb-checklist')
    expect(result.html).toContain('checked')
  })

  it('compiles toggle node', async () => {
    const result = await compileJsonContent(doc({
      type: 'toggleWrapper',
      content: [
        { type: 'toggleTitle', content: [{ type: 'text', text: 'FAQ' }] },
        { type: 'toggleBody', content: [p('Answer here')] },
      ],
    }))
    expect(result.html).toContain('<details')
    expect(result.html).toContain('pb-toggle')
    expect(result.html).toContain('<summary')
  })

  it('compiles columns node', async () => {
    const result = await compileJsonContent(doc({
      type: 'columns',
      attrs: { ratio: '2:1' },
      content: [
        { type: 'column', content: [p('left')] },
        { type: 'column', content: [p('right')] },
      ],
    }))
    expect(result.html).toContain('pb-columns')
    expect(result.html).toContain('pb-cols-2-1')
  })

  it('compiles table with caption', async () => {
    const result = await compileJsonContent(doc({
      type: 'table',
      attrs: { caption: 'My Table' },
      content: [{
        type: 'tableRow',
        content: [{
          type: 'tableHeader',
          content: [p('Header')],
        }],
      }, {
        type: 'tableRow',
        content: [{
          type: 'tableCell',
          content: [p('Cell')],
        }],
      }],
    }))
    expect(result.html).toContain('pb-table')
    expect(result.html).toContain('<caption')
    expect(result.html).toContain('My Table')
  })

  it('compiles social embed placeholder', async () => {
    const result = await compileJsonContent(doc({
      type: 'socialEmbed',
      attrs: { provider: 'youtube', url: 'https://youtube.com/watch?v=abc' },
    }))
    expect(result.html).toContain('pb-embed')
    expect(result.html).toContain('data-provider="youtube"')
    expect(result.html).toContain('data-url=')
  })

  it('compiles image with alt and caption', async () => {
    const result = await compileJsonContent(doc({
      type: 'image',
      attrs: { src: 'https://img.com/photo.jpg', alt: 'A photo', title: 'Caption text' },
    }))
    expect(result.html).toContain('pb-figure')
    expect(result.html).toContain('alt="A photo"')
    expect(result.html).toContain('Caption text')
  })

  it('compiles inline marks: bold, italic, code, highlight, link', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
        { type: 'text', text: 'highlighted', marks: [{ type: 'highlight' }] },
        { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://ex.com' } }] },
      ],
    }))
    expect(result.html).toContain('<strong>')
    expect(result.html).toContain('<em>')
    expect(result.html).toContain('<code>')
    expect(result.html).toContain('<mark class="pb-mark">')
    expect(result.html).toContain('href="https://ex.com"')
  })

  it('sanitizes javascript: URLs in links', async () => {
    const result = await compileJsonContent(doc({
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'xss',
        marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
      }],
    }))
    expect(result.html).not.toContain('javascript:')
  })

  it('returns empty result for empty doc', async () => {
    const result = await compileJsonContent({ type: 'doc', content: [] })
    expect(result.html).toBe('')
    expect(result.toc).toEqual([])
    expect(result.readingTimeMin).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/unit/compile-json.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement compile-json module**

```typescript
// apps/web/lib/cms/compile-json.ts
import type { JSONContent } from '@tiptap/core'
import { getSpacingClass } from './spacing'
import { slugify } from '@/lib/blog/slugify'

export interface TocEntry {
  slug: string
  text: string
  depth: 2 | 3
}

export interface CompileJsonResult {
  html: string
  toc: TocEntry[]
  readingTimeMin: number
}

const CALLOUT_ICONS: Record<string, string> = {
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isSafeHref(href: string): boolean {
  const lower = href.trim().toLowerCase()
  return !lower.startsWith('javascript:') && !lower.startsWith('data:') && !lower.startsWith('vbscript:')
}

function renderMarks(node: JSONContent): string {
  if (node.type !== 'text' || !node.text) return ''
  let html = escapeHtml(node.text)
  if (!node.marks) return html

  for (const mark of node.marks) {
    switch (mark.type) {
      case 'bold':
        html = `<strong>${html}</strong>`
        break
      case 'italic':
        html = `<em>${html}</em>`
        break
      case 'underline':
        html = `<u>${html}</u>`
        break
      case 'strike':
        html = `<s>${html}</s>`
        break
      case 'code':
        html = `<code>${html}</code>`
        break
      case 'highlight':
        html = `<mark class="pb-mark">${html}</mark>`
        break
      case 'link': {
        const href = mark.attrs?.href ?? ''
        if (isSafeHref(href)) {
          html = `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow">${html}</a>`
        }
        break
      }
    }
  }
  return html
}

function renderInlineContent(content: JSONContent[] | undefined): string {
  if (!content) return ''
  return content.map((node) => {
    if (node.type === 'text') return renderMarks(node)
    if (node.type === 'hardBreak') return '<br>'
    if (node.type === 'mergeTag') return escapeHtml(node.attrs?.tag ?? '')
    return ''
  }).join('')
}

function getTextContent(content: JSONContent[] | undefined): string {
  if (!content) return ''
  return content.map((node) => {
    if (node.type === 'text') return node.text ?? ''
    if (node.content) return getTextContent(node.content)
    return ''
  }).join('')
}

function renderBlockContent(content: JSONContent[] | undefined): string {
  if (!content) return ''
  return content.map((node) => renderNode(node)).join('')
}

function renderNode(node: JSONContent): string {
  switch (node.type) {
    case 'paragraph': {
      const align = node.attrs?.textAlign
      const style = align && align !== 'left' ? ` style="text-align:${escapeHtml(align)}"` : ''
      return `<p class="pb-p"${style}>${renderInlineContent(node.content)}</p>`
    }

    case 'heading': {
      const level = node.attrs?.level ?? 2
      const text = getTextContent(node.content)
      const slug = slugify(text)
      const align = node.attrs?.textAlign
      const style = align && align !== 'left' ? ` style="text-align:${escapeHtml(align)}"` : ''
      return `<h${level} id="${escapeHtml(slug)}" class="pb-h${level}"${style}>${renderInlineContent(node.content)}</h${level}>`
    }

    case 'bulletList':
      return `<ul class="pb-ul">${renderBlockContent(node.content)}</ul>`

    case 'orderedList':
      return `<ol class="pb-ol">${renderBlockContent(node.content)}</ol>`

    case 'listItem':
      return `<li>${renderBlockContent(node.content)}</li>`

    case 'blockquote':
      return `<blockquote class="pb-quote">${renderBlockContent(node.content)}</blockquote>`

    case 'codeBlock': {
      const lang = node.attrs?.language ?? 'text'
      const code = getTextContent(node.content)
      return `<pre class="pb-code" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(code)}</code></pre>`
    }

    case 'horizontalRule':
      return '<div class="pb-divider"><span class="pb-divider-ornament">&#10043;</span></div>'

    case 'image': {
      const src = node.attrs?.src ?? ''
      const alt = node.attrs?.alt ?? ''
      const title = node.attrs?.title ?? ''
      const imgTag = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`
      if (title) {
        return `<figure class="pb-figure">${imgTag}<figcaption class="pb-figcaption">${escapeHtml(title)}</figcaption></figure>`
      }
      return `<figure class="pb-figure">${imgTag}</figure>`
    }

    case 'callout': {
      const variant = node.attrs?.variant ?? 'info'
      const icon = CALLOUT_ICONS[variant] ?? CALLOUT_ICONS.info
      return `<aside class="pb-callout pb-callout-${escapeHtml(variant)}"><span class="pb-callout-icon">${icon}</span><div class="pb-callout-content">${renderInlineContent(node.content)}</div></aside>`
    }

    case 'ctaButton': {
      const buttons = node.attrs?.buttons ?? [{ text: node.attrs?.text ?? 'Click', url: node.attrs?.url ?? '#', style: 'primary' }]
      const align = node.attrs?.align ?? 'center'
      const btns = (buttons as Array<{ text: string; url: string; style: string }>)
        .map((b) => {
          const href = isSafeHref(b.url) ? b.url : '#'
          return `<a href="${escapeHtml(href)}" class="pb-cta-${escapeHtml(b.style)}" rel="noopener noreferrer">${escapeHtml(b.text)}</a>`
        })
        .join('')
      return `<div class="pb-cta" style="text-align:${escapeHtml(align)}">${btns}</div>`
    }

    case 'taskList':
      return `<ul class="pb-checklist">${renderBlockContent(node.content)}</ul>`

    case 'taskItem': {
      const checked = node.attrs?.checked ?? false
      const checkmark = checked
        ? '<span class="pb-check pb-check-done">&#9745;</span>'
        : '<span class="pb-check">&#9744;</span>'
      return `<li class="pb-checklist-item${checked ? ' pb-checked' : ''}">${checkmark}<span class="pb-checklist-text">${renderBlockContent(node.content)}</span></li>`
    }

    case 'toggleWrapper':
      return `<details class="pb-toggle">${renderBlockContent(node.content)}</details>`

    case 'toggleTitle':
      return `<summary class="pb-toggle-title">${renderInlineContent(node.content)}</summary>`

    case 'toggleBody':
      return `<div class="pb-toggle-body">${renderBlockContent(node.content)}</div>`

    case 'columns': {
      const ratio = (node.attrs?.ratio ?? '1:1').replace(/:/g, '-')
      return `<div class="pb-columns pb-cols-${escapeHtml(ratio)}">${renderBlockContent(node.content)}</div>`
    }

    case 'column':
      return `<div class="pb-column">${renderBlockContent(node.content)}</div>`

    case 'table': {
      const caption = node.attrs?.caption ?? ''
      const captionHtml = caption ? `<caption class="pb-table-caption">${escapeHtml(caption)}</caption>` : ''
      return `<div class="pb-table-wrap"><table class="pb-table">${captionHtml}${renderBlockContent(node.content)}</table></div>`
    }

    case 'tableRow':
      return `<tr>${renderBlockContent(node.content)}</tr>`

    case 'tableHeader':
      return `<th class="pb-th">${renderBlockContent(node.content)}</th>`

    case 'tableCell':
      return `<td class="pb-td">${renderBlockContent(node.content)}</td>`

    case 'socialEmbed': {
      const provider = node.attrs?.provider ?? 'unknown'
      const url = node.attrs?.url ?? ''
      return `<div class="pb-embed" data-provider="${escapeHtml(provider)}" data-url="${escapeHtml(url)}"></div>`
    }

    case 'hardBreak':
      return '<br>'

    default:
      if (node.content) return renderBlockContent(node.content)
      return ''
  }
}

const TOP_LEVEL_BLOCK_TYPES = new Set([
  'paragraph', 'heading', 'bulletList', 'orderedList', 'blockquote',
  'codeBlock', 'horizontalRule', 'image', 'callout', 'ctaButton',
  'taskList', 'toggleWrapper', 'columns', 'table', 'socialEmbed',
])

export async function compileJsonContent(json: JSONContent): Promise<CompileJsonResult> {
  const blocks = json.content ?? []
  if (blocks.length === 0) {
    return { html: '', toc: [], readingTimeMin: 0 }
  }

  const toc: TocEntry[] = []
  let wordCount = 0
  const htmlParts: string[] = []

  let prevType: string | null = null

  for (const block of blocks) {
    const nodeType = block.type ?? 'paragraph'

    if (nodeType === 'heading') {
      const level = block.attrs?.level ?? 2
      const text = getTextContent(block.content)
      if ((level === 2 || level === 3) && text) {
        toc.push({ slug: slugify(text), text, depth: level as 2 | 3 })
      }
    }

    const text = getTextContent(block.content)
    wordCount += text.split(/\s+/).filter(Boolean).length

    const blockType = TOP_LEVEL_BLOCK_TYPES.has(nodeType) ? nodeType : 'paragraph'
    const spacingClass = getSpacingClass(prevType, blockType)
    const rendered = renderNode(block)

    if (spacingClass && rendered) {
      htmlParts.push(`<div class="${spacingClass}">${rendered}</div>`)
    } else {
      htmlParts.push(rendered)
    }

    if (rendered) {
      prevType = blockType
    }
  }

  const readingTimeMin = Math.max(1, Math.round(wordCount / 200))

  return {
    html: htmlParts.join(''),
    toc,
    readingTimeMin: wordCount === 0 ? 0 : readingTimeMin,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run test/unit/compile-json.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/cms/compile-json.ts apps/web/test/unit/compile-json.test.ts
git commit -m "feat(blog): add JSON-to-HTML compile pipeline with TOC and reading time"
```

---

## Task 4: Pinboard Blocks CSS

**Files:**
- Create: `apps/web/src/styles/pinboard-blocks.css`

- [ ] **Step 1: Create the CSS file with all `.pb-*` classes**

```css
/* apps/web/src/styles/pinboard-blocks.css
   Block-level theme classes for compiled blog content.
   Uses CSS custom properties from the pinboard theme (--pb-*). */

/* ═══ Spacing ═══ */
.sp-xs { margin-top: 0.6em; }
.sp-sm { margin-top: 1.0em; }
.sp-md { margin-top: 1.6em; }
.sp-lg { margin-top: 2.2em; }
.sp-xl { margin-top: 3.0em; }

/* ═══ Paragraph ═══ */
.pb-p {
  font-family: var(--font-source-serif), Georgia, serif;
  font-size: var(--blog-body-font-size, 19px);
  line-height: 1.72;
  color: var(--pb-ink);
}

/* ═══ Headings ═══ */
.pb-h1 {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: clamp(36px, 5.5vw, 64px);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -1.28px;
  color: var(--pb-ink);
}

.pb-h2 {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 32px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.64px;
  color: var(--pb-ink);
}

.pb-h3 {
  font-family: var(--font-fraunces), Georgia, serif;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.44px;
  color: var(--pb-ink);
}

.pb-h4 {
  font-family: var(--font-jetbrains), monospace;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.72px;
  text-transform: uppercase;
  color: var(--pb-muted);
}

/* ═══ Lists ═══ */
.pb-ul {
  list-style: none;
  padding-left: 1.5em;
  color: var(--pb-ink);
}

.pb-ul > li {
  position: relative;
  padding-left: 0.25em;
}

.pb-ul > li::before {
  content: '→';
  position: absolute;
  left: -1.5em;
  color: var(--pb-accent);
  font-weight: 600;
}

.pb-ol {
  list-style: none;
  counter-reset: pb-ol-counter;
  padding-left: 2em;
  color: var(--pb-ink);
}

.pb-ol > li {
  counter-increment: pb-ol-counter;
  position: relative;
}

.pb-ol > li::before {
  content: counter(pb-ol-counter, decimal-leading-zero);
  position: absolute;
  left: -2em;
  font-family: var(--font-jetbrains), monospace;
  font-size: 0.75em;
  font-weight: 700;
  color: var(--pb-accent);
  top: 0.3em;
}

/* ═══ Blockquote ═══ */
.pb-quote {
  border-left: 3px solid var(--pb-accent);
  padding-left: 1.25em;
  margin-left: 0;
  font-style: italic;
  font-family: var(--font-source-serif), Georgia, serif;
  color: var(--pb-ink);
}

.pb-quote-cite {
  display: block;
  margin-top: 0.5em;
  font-style: normal;
  font-size: 0.85em;
  color: var(--pb-muted);
}

/* ═══ Code Block ═══ */
.pb-code {
  background: var(--pb-paper2);
  border: 1px solid var(--pb-line);
  border-radius: 8px;
  padding: 1.25em;
  overflow-x: auto;
  font-family: var(--font-jetbrains), monospace;
  font-size: 14px;
  line-height: 1.6;
  color: var(--pb-ink);
}

.pb-code code {
  background: none;
  padding: 0;
  font-size: inherit;
}

.pb-code[data-lang]::before {
  content: attr(data-lang);
  display: block;
  font-family: var(--font-jetbrains), monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pb-muted);
  margin-bottom: 0.75em;
  padding-bottom: 0.5em;
  border-bottom: 1px solid var(--pb-line);
}

/* ═══ Divider ═══ */
.pb-divider {
  text-align: center;
  padding: 0.5em 0;
  color: var(--pb-muted);
  font-size: 1.25em;
  letter-spacing: 0.5em;
}

.pb-divider-ornament {
  opacity: 0.5;
}

/* ═══ Highlight Mark ═══ */
.pb-mark {
  background: rgba(255, 227, 122, 0.22);
  padding: 0.05em 0.15em;
  border-radius: 2px;
}

/* ═══ Callout ═══ */
.pb-callout {
  display: flex;
  gap: 0.75em;
  padding: 1em 1.25em;
  border-radius: 8px;
  border-left: 3px solid;
  font-family: var(--font-source-serif), Georgia, serif;
  color: var(--pb-ink);
}

.pb-callout-icon {
  flex-shrink: 0;
  margin-top: 0.1em;
}

.pb-callout-content {
  flex: 1;
  min-width: 0;
}

.pb-callout-info {
  border-color: #8B9AAD;
  background: rgba(139, 154, 173, 0.06);
}
.pb-callout-info .pb-callout-icon { color: #8B9AAD; }

.pb-callout-warning {
  border-color: #E8C44A;
  background: rgba(232, 196, 74, 0.04);
}
.pb-callout-warning .pb-callout-icon { color: #E8C44A; }

.pb-callout-tip {
  border-color: #9AAD6E;
  background: rgba(154, 173, 110, 0.04);
}
.pb-callout-tip .pb-callout-icon { color: #9AAD6E; }

.pb-callout-error {
  border-color: #C75034;
  background: rgba(199, 80, 52, 0.04);
}
.pb-callout-error .pb-callout-icon { color: #C75034; }

/* ═══ CTA Button ═══ */
.pb-cta {
  padding: 1em 0;
}

.pb-cta a {
  display: inline-block;
  padding: 0.75em 2em;
  border-radius: 6px;
  font-family: var(--font-jetbrains), monospace;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: opacity 0.15s;
  margin: 0 0.35em;
}

.pb-cta a:hover { opacity: 0.85; }

.pb-cta-primary {
  background: var(--pb-accent);
  color: var(--pb-bg);
}

.pb-cta-secondary {
  background: transparent;
  border: 2px solid var(--pb-accent);
  color: var(--pb-accent);
}

.pb-cta-ghost {
  background: transparent;
  color: var(--pb-accent);
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* ═══ Checklist ═══ */
.pb-checklist {
  list-style: none;
  padding-left: 0;
  color: var(--pb-ink);
}

.pb-checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
  padding: 0.2em 0;
}

.pb-check {
  flex-shrink: 0;
  font-size: 1.1em;
  line-height: 1.5;
  color: var(--pb-muted);
}

.pb-check-done { color: var(--pb-accent); }

.pb-checked .pb-checklist-text {
  text-decoration: line-through;
  opacity: 0.6;
}

/* ═══ Toggle (Details/Summary) ═══ */
.pb-toggle {
  border: 1px solid var(--pb-line);
  border-radius: 8px;
  overflow: hidden;
}

.pb-toggle-title {
  padding: 0.85em 1.15em;
  cursor: pointer;
  font-weight: 600;
  color: var(--pb-ink);
  background: var(--pb-paper);
  list-style: none;
}

.pb-toggle-title::-webkit-details-marker { display: none; }

.pb-toggle-title::before {
  content: '▸';
  display: inline-block;
  margin-right: 0.5em;
  transition: transform 0.15s;
  color: var(--pb-accent);
}

.pb-toggle[open] > .pb-toggle-title::before {
  transform: rotate(90deg);
}

.pb-toggle-body {
  padding: 0.85em 1.15em;
  border-top: 1px solid var(--pb-line);
}

@supports (interpolate-size: allow-keywords) {
  .pb-toggle-body {
    interpolate-size: allow-keywords;
    overflow: hidden;
    transition: height 0.2s ease;
  }
}

/* ═══ Columns ═══ */
.pb-columns {
  display: grid;
  gap: 1.5em;
}

.pb-cols-1-1 { grid-template-columns: 1fr 1fr; }
.pb-cols-2-1 { grid-template-columns: 2fr 1fr; }
.pb-cols-1-2 { grid-template-columns: 1fr 2fr; }
.pb-cols-1-1-1 { grid-template-columns: 1fr 1fr 1fr; }

@media (max-width: 767px) {
  .pb-columns { grid-template-columns: 1fr !important; }
}

/* ═══ Table ═══ */
.pb-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.pb-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-source-serif), Georgia, serif;
  font-size: 0.9em;
  color: var(--pb-ink);
}

.pb-table-caption {
  caption-side: bottom;
  font-family: var(--font-jetbrains), monospace;
  font-size: 12px;
  color: var(--pb-muted);
  text-align: left;
  padding-top: 0.75em;
}

.pb-th {
  font-family: var(--font-jetbrains), monospace;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--pb-muted);
  text-align: left;
  padding: 0.75em 1em;
  border-bottom: 2px solid var(--pb-line);
}

.pb-td {
  padding: 0.75em 1em;
  border-bottom: 1px solid var(--pb-line);
  vertical-align: top;
}

/* ═══ Social Embed ═══ */
.pb-embed {
  border-radius: 8px;
  overflow: hidden;
  background: var(--pb-paper2);
  min-height: 200px;
}

.pb-embed iframe {
  width: 100%;
  border: 0;
}

/* ═══ Image / Figure ═══ */
.pb-figure {
  margin: 0;
}

.pb-figure img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

.pb-figcaption {
  font-family: var(--font-jetbrains), monospace;
  font-size: 12px;
  color: var(--pb-muted);
  margin-top: 0.5em;
  text-align: center;
}
```

- [ ] **Step 2: Import the CSS in the blog layout**

In the public blog layout (the file that already imports `reader-pinboard.css`), add:

```typescript
import '@/styles/pinboard-blocks.css'
```

Find the layout that imports `reader-pinboard.css`:

Run: `grep -r "reader-pinboard" apps/web/src --include="*.tsx" --include="*.ts" -l`

Add the import right after the existing reader-pinboard import in that file.

- [ ] **Step 3: Verify visually by starting dev server**

Run: `cd apps/web && npm run dev`

Check that the blog pages still render correctly (no CSS conflicts).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles/pinboard-blocks.css
git commit -m "feat(blog): add pinboard-blocks CSS for all content block types"
```

---

## Task 5: Install TipTap Extensions

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install new TipTap extensions**

Run: `cd apps/web && npm install @tiptap/extension-task-list@3.22.4 @tiptap/extension-task-item@3.22.4 @tiptap/extension-table@3.22.4 @tiptap/extension-table-row@3.22.4 @tiptap/extension-table-header@3.22.4 @tiptap/extension-table-cell@3.22.4`

- [ ] **Step 2: Verify installation**

Run: `ls apps/web/node_modules/@tiptap/extension-task-list apps/web/node_modules/@tiptap/extension-table`
Expected: Both directories exist

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(blog): install TipTap table and task-list extensions"
```

---

## Task 6: CalloutNode Extension

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/editor/callout-node.tsx`

- [ ] **Step 1: Create the CalloutNode extension**

```tsx
// apps/web/src/app/cms/(authed)/_shared/editor/callout-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Info, AlertTriangle, Lightbulb, XCircle } from 'lucide-react'

const VARIANTS = ['info', 'warning', 'tip', 'error'] as const
type CalloutVariant = (typeof VARIANTS)[number]

const VARIANT_CONFIG: Record<CalloutVariant, { icon: typeof Info; color: string; label: string }> = {
  info:    { icon: Info,          color: '#6366f1', label: 'Info' },
  warning: { icon: AlertTriangle, color: '#eab308', label: 'Warning' },
  tip:     { icon: Lightbulb,     color: '#22c55e', label: 'Tip' },
  error:   { icon: XCircle,       color: '#ef4444', label: 'Error' },
}

function CalloutNodeView({ node, updateAttributes }: {
  node: { attrs: { variant: CalloutVariant } }
  updateAttributes: (attrs: Partial<{ variant: CalloutVariant }>) => void
}) {
  const variant = node.attrs.variant
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info
  const Icon = config.icon

  return (
    <NodeViewWrapper>
      <div
        className="callout-editor-block"
        style={{
          borderLeft: `3px solid ${config.color}`,
          background: `${config.color}10`,
          borderRadius: 8,
          padding: '12px 16px',
          margin: '8px 0',
        }}
      >
        <div className="flex items-center gap-1 mb-2">
          {VARIANTS.map((v) => {
            const VIcon = VARIANT_CONFIG[v].icon
            return (
              <button
                key={v}
                type="button"
                onClick={() => updateAttributes({ variant: v })}
                className={`p-1 rounded text-xs ${variant === v ? 'bg-white/20 ring-1 ring-white/30' : 'opacity-40 hover:opacity-70'}`}
                title={VARIANT_CONFIG[v].label}
              >
                <VIcon size={14} style={{ color: VARIANT_CONFIG[v].color }} />
              </button>
            )
          })}
        </div>
        <div className="flex items-start gap-3">
          <Icon size={18} style={{ color: config.color, flexShrink: 0, marginTop: 2 }} />
          <NodeViewContent className="callout-content flex-1 min-w-0 outline-none" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',

  addAttributes() {
    return {
      variant: { default: 'info' },
    }
  },

  parseHTML() {
    return [{ tag: 'aside[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-callout': '', class: `callout callout-${HTMLAttributes.variant ?? 'info'}` }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/callout-node.tsx
git commit -m "feat(editor): add CalloutNode extension with 4 variants"
```

---

## Task 7: ToggleNode Extension

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/editor/toggle-node.tsx`

- [ ] **Step 1: Create the ToggleNode extension (3-node structure)**

```tsx
// apps/web/src/app/cms/(authed)/_shared/editor/toggle-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

function ToggleWrapperView() {
  const [open, setOpen] = useState(true)

  return (
    <NodeViewWrapper>
      <div
        className="toggle-editor-block"
        style={{
          border: '1px solid #1f2937',
          borderRadius: 8,
          margin: '8px 0',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center cursor-pointer px-3 py-2 bg-[#111827] select-none"
          onClick={() => setOpen(!open)}
          contentEditable={false}
        >
          <ChevronRight
            size={14}
            className="text-[#6366f1] transition-transform mr-2"
            style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span className="text-xs text-[#6b7280] uppercase tracking-wider font-semibold">Toggle</span>
        </div>
        <NodeViewContent className={open ? '' : 'hidden'} />
      </div>
    </NodeViewWrapper>
  )
}

export const ToggleWrapperExtension = Node.create({
  name: 'toggleWrapper',
  group: 'block',
  content: 'toggleTitle toggleBody',

  parseHTML() {
    return [{ tag: 'div[data-toggle]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleWrapperView)
  },
})

export const ToggleTitleExtension = Node.create({
  name: 'toggleTitle',
  content: 'inline*',

  parseHTML() {
    return [{ tag: 'div[data-toggle-title]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle-title': '', class: 'toggle-title-editor px-3 py-2 font-semibold text-[#f3f4f6] bg-[#111827] border-b border-[#1f2937]' }), 0]
  },
})

export const ToggleBodyExtension = Node.create({
  name: 'toggleBody',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-toggle-body]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-toggle-body': '', class: 'toggle-body-editor px-3 py-2' }), 0]
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/toggle-node.tsx
git commit -m "feat(editor): add ToggleNode extension with 3-node structure"
```

---

## Task 8: ColumnsNode Extension

**Files:**
- Create: `apps/web/src/app/cms/(authed)/_shared/editor/columns-node.tsx`

- [ ] **Step 1: Create the ColumnsNode extension**

```tsx
// apps/web/src/app/cms/(authed)/_shared/editor/columns-node.tsx
'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'

const RATIOS = ['1:1', '2:1', '1:2', '1:1:1'] as const
type ColumnRatio = (typeof RATIOS)[number]

const GRID_STYLES: Record<ColumnRatio, string> = {
  '1:1': '1fr 1fr',
  '2:1': '2fr 1fr',
  '1:2': '1fr 2fr',
  '1:1:1': '1fr 1fr 1fr',
}

function ColumnsNodeView({ node, updateAttributes }: {
  node: { attrs: { ratio: ColumnRatio } }
  updateAttributes: (attrs: Partial<{ ratio: ColumnRatio }>) => void
}) {
  const ratio = node.attrs.ratio

  return (
    <NodeViewWrapper>
      <div className="columns-editor-block" style={{ margin: '8px 0' }}>
        <div className="flex items-center gap-1 mb-2" contentEditable={false}>
          {RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => updateAttributes({ ratio: r })}
              className={`px-2 py-0.5 rounded text-xs font-mono ${
                ratio === r ? 'bg-[#6366f1]/20 text-[#a5b4fc] ring-1 ring-[#6366f1]/40' : 'text-[#6b7280] hover:text-[#d1d5db]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_STYLES[ratio] ?? '1fr 1fr',
            gap: '12px',
          }}
        >
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  )
}

export const ColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',

  addAttributes() {
    return {
      ratio: { default: '1:1' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-columns]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-columns': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ColumnsNodeView)
  },
})

export const ColumnExtension = Node.create({
  name: 'column',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-column]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-column': '',
      style: 'border: 1px dashed #374151; border-radius: 6px; padding: 8px; min-height: 60px;',
    }), 0]
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/columns-node.tsx
git commit -m "feat(editor): add ColumnsNode extension with ratio control"
```

---

## Task 9: Register Extensions in TipTap Editor

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx`

- [ ] **Step 1: Add imports for new extensions**

At the top of `tiptap-editor.tsx`, after the existing imports (line 22), add:

```typescript
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { CalloutExtension } from './callout-node'
import { ToggleWrapperExtension, ToggleTitleExtension, ToggleBodyExtension } from './toggle-node'
import { ColumnsExtension, ColumnExtension } from './columns-node'
```

- [ ] **Step 2: Update StarterKit heading config to include level 4**

Change line 84-86 from:

```typescript
StarterKit.configure({
  heading: { levels: [1, 2, 3] },
}),
```

To:

```typescript
StarterKit.configure({
  heading: { levels: [1, 2, 3, 4] },
}),
```

- [ ] **Step 3: Register all new extensions in the extensions array**

After `SocialEmbedExtension` (line 105), before `slashCommandExtension`, add:

```typescript
CalloutExtension,
ToggleWrapperExtension,
ToggleTitleExtension,
ToggleBodyExtension,
ColumnsExtension,
ColumnExtension,
TaskList,
TaskItem.configure({ nested: true }),
Table.configure({ resizable: false }),
TableRow,
TableHeader,
TableCell,
```

- [ ] **Step 4: Add new insertion callbacks in slash command config**

Update the `slashCommandExtension` useMemo (around line 61-80) to include new block callbacks:

```typescript
const slashCommandExtension = useMemo(
  () =>
    createSlashCommandExtension({
      onImageUpload: () => fileInputRef.current?.click(),
      onInsertCTAButton: () => {
        editorRef.current?.chain().focus().insertContent({
          type: 'ctaButton',
          attrs: { text: 'Click Here', url: '', color: '#7c3aed', align: 'center' },
        }).run()
      },
      onInsertMergeTag: (tag: string) => {
        editorRef.current?.chain().focus().insertContent({
          type: 'mergeTag',
          attrs: { tag },
        }).run()
      },
      onInsertSocialEmbed: insertEmbed,
      onInsertCallout: () => {
        editorRef.current?.chain().focus().insertContent({
          type: 'callout',
          attrs: { variant: 'info' },
          content: [{ type: 'text', text: '' }],
        }).run()
      },
      onInsertToggle: () => {
        editorRef.current?.chain().focus().insertContent({
          type: 'toggleWrapper',
          content: [
            { type: 'toggleTitle', content: [{ type: 'text', text: 'Click to expand' }] },
            { type: 'toggleBody', content: [{ type: 'paragraph' }] },
          ],
        }).run()
      },
      onInsertColumns: () => {
        editorRef.current?.chain().focus().insertContent({
          type: 'columns',
          attrs: { ratio: '1:1' },
          content: [
            { type: 'column', content: [{ type: 'paragraph' }] },
            { type: 'column', content: [{ type: 'paragraph' }] },
          ],
        }).run()
      },
      onInsertTable: () => {
        editorRef.current?.chain().focus().insertContentAt(
          editorRef.current.state.selection.anchor,
          {
            type: 'table',
            content: Array.from({ length: 3 }, (_, i) => ({
              type: 'tableRow',
              content: Array.from({ length: 3 }, () => ({
                type: i === 0 ? 'tableHeader' : 'tableCell',
                content: [{ type: 'paragraph' }],
              })),
            })),
          },
        )
      },
      onInsertChecklist: () => {
        editorRef.current?.chain().focus().insertContent({
          type: 'taskList',
          content: [{ type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph' }] }],
        }).run()
      },
    }),
  [],
)
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx
git commit -m "feat(editor): register callout, toggle, columns, table, tasklist, H4 extensions"
```

---

## Task 10: Add Slash Commands for New Blocks

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/slash-commands.tsx`

- [ ] **Step 1: Add new Lucide icons import**

At the existing Lucide imports (lines 16-33), add:

```typescript
import { Heading4, MessageSquare, ChevronRight, Columns2, TableIcon, CheckSquare } from 'lucide-react'
```

- [ ] **Step 2: Expand the callbacks interface**

The `getSlashCommands` function and `createSlashCommandExtension` function both accept a callbacks object. Add new properties to both:

```typescript
function getSlashCommands(callbacks: {
  onImageUpload: () => void
  onInsertCTAButton: () => void
  onInsertMergeTag: (tag: string) => void
  onInsertSocialEmbed: (provider: EmbedProvider, url: string) => void
  onInsertCallout: () => void
  onInsertToggle: () => void
  onInsertColumns: () => void
  onInsertTable: () => void
  onInsertChecklist: () => void
}): CommandItem[] {
```

- [ ] **Step 3: Add 6 new commands to the array**

After the existing `GitHub Gist` command (line 194), add:

```typescript
{
  title: 'Heading 4',
  description: 'Label heading',
  icon: <Heading4 size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).setHeading({ level: 4 }).run()
  },
},
{
  title: 'Callout',
  description: 'Info/warning/tip box',
  icon: <MessageSquare size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    callbacks.onInsertCallout()
  },
},
{
  title: 'Toggle',
  description: 'Expandable section',
  icon: <ChevronRight size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    callbacks.onInsertToggle()
  },
},
{
  title: 'Columns',
  description: '2-3 column layout',
  icon: <Columns2 size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    callbacks.onInsertColumns()
  },
},
{
  title: 'Table',
  description: 'Insert a table',
  icon: <TableIcon size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    callbacks.onInsertTable()
  },
},
{
  title: 'Checklist',
  description: 'Task checklist',
  icon: <CheckSquare size={18} />,
  command: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    callbacks.onInsertChecklist()
  },
},
```

- [ ] **Step 4: Update `createSlashCommandExtension` signature to match**

The exported function at line 350 must accept the same extended callbacks interface.

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/slash-commands.tsx
git commit -m "feat(editor): add slash commands for H4, callout, toggle, columns, table, checklist"
```

---

## Task 11: Add Highlight to Bubble Menu

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/bubble-menu.tsx`

- [ ] **Step 1: Add Highlighter import**

Add to the Lucide imports at line 5:

```typescript
import { Bold, Italic, Underline, Strikethrough, Link2, Code, Highlighter } from 'lucide-react'
```

- [ ] **Step 2: Add Highlight button after the Code button (line 95)**

After the Code BubbleButton and before the Link BubbleButton, add:

```tsx
<BubbleButton
  onClick={() => editor.chain().focus().toggleHighlight({ color: '#ffe37a' }).run()}
  active={editor.isActive('highlight')}
  title="Highlight"
>
  <Highlighter size={14} />
</BubbleButton>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/bubble-menu.tsx
git commit -m "feat(editor): add highlight button to bubble menu"
```

---

## Task 12: Blog Editor Dual-Path — Edit Page

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx`

- [ ] **Step 1: Add TipTap editor import and content_json state**

At the top of `edit-post-client.tsx`, add:

```typescript
import { TipTapEditor, EditorToolbar, EditorBubbleMenu } from '../../_shared/editor'
import type { JSONContent } from '@tiptap/core'
```

Extend the props interface to accept initial JSON content:

```typescript
interface EditPostClientProps {
  // ... existing props ...
  initialContentJson: Record<string, unknown> | null
  initialContentHtml: string | null
}
```

- [ ] **Step 2: Add state for TipTap content and image upload handler**

Inside the component, after the existing state declarations, add:

```typescript
const [contentJson, setContentJson] = useState<JSONContent | null>(
  initialContentJson as JSONContent | null
)
const [contentHtml, setContentHtml] = useState<string | null>(initialContentHtml)
const useTipTap = contentJson !== null || !initialContent
```

Add an image upload handler:

```typescript
const handleImageUpload = async (file: File): Promise<string | null> => {
  try {
    const result = await uploadAsset(file, postId)
    return result.url
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Render TipTap editor when useTipTap is true**

Replace the existing `<PostEditor>` block with a conditional:

```tsx
{useTipTap ? (
  <div className="max-w-[780px] mx-auto px-6">
    <TipTapEditor
      content={contentJson}
      onChange={(json, html) => {
        setContentJson(json)
        setContentHtml(html)
      }}
      onImageUpload={handleImageUpload}
      placeholder="Start writing your post... Type / for commands"
    />
  </div>
) : (
  <PostEditor
    postId={postId}
    initialContent={initialContent}
    initialTitle={initialTitle}
    initialSlug={initialSlug}
    initialExcerpt={initialExcerpt}
    initialMetaTitle={initialMetaTitle}
    initialMetaDescription={initialMetaDescription}
    initialOgImageUrl={initialOgImageUrl}
    initialCoverImageUrl={initialCoverImageUrl}
    locale={locale}
    componentNames={componentNames}
    onSave={async (input: SavePostActionInput) => {
      const result = await savePost(postId, locale, {
        ...input,
        key_points: keyPoints.filter(Boolean),
        pull_quote: pullQuote || null,
        notes: notes.filter(Boolean),
        colophon: colophon || null,
        previous_post_id: previousPostId,
        continues_in_next: continuesInNext,
        hashtag_ids: hashtags.map(h => h.id),
      })
      if (!result.ok && result.error === 'invalid_seo_extras') {
        return {
          ok: false as const,
          error: 'validation_failed' as const,
          fields: {
            content_mdx: result.details[0]?.message ?? 'invalid seo_extras frontmatter',
          },
        }
      }
      return result
    }}
    onPreview={async (source: string) => compilePreview(source)}
    onUpload={async (file: File) => uploadAsset(file, postId)}
  />
)}
```

- [ ] **Step 4: Wire up save for TipTap path**

For the TipTap path, add a save button and autosave that calls `savePost` with `content_json` and `content_html`:

```tsx
// Add a save handler for TipTap
const handleTipTapSave = async () => {
  if (!contentJson) return
  const result = await savePost(postId, locale, {
    content_mdx: '',
    title: /* get from title state */,
    slug: /* get from slug state */,
    content_json: contentJson as Record<string, unknown>,
    content_html: contentHtml,
    key_points: keyPoints.filter(Boolean),
    pull_quote: pullQuote || null,
    notes: notes.filter(Boolean),
    colophon: colophon || null,
    previous_post_id: previousPostId,
    continues_in_next: continuesInNext,
    hashtag_ids: hashtags.map(h => h.id),
  })
  return result
}
```

Note: The TipTap path will need title/slug/excerpt inputs that the PostEditor currently handles internally. Extract those into separate controlled inputs above the editor. This is a significant UI change — the PostEditor's built-in title/slug/SEO fields need to be replicated as standalone components for the TipTap path.

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx
git commit -m "feat(blog): dual editor — TipTap for new/JSON posts, MDX fallback for legacy"
```

---

## Task 13: Blog Editor Dual-Path — Save Action

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`

- [ ] **Step 1: Import compileJsonContent**

Add at the top of actions.ts:

```typescript
import { compileJsonContent } from '@/lib/cms/compile-json'
```

- [ ] **Step 2: Add JSON compile path in savePost**

In the `savePost` function, after the existing MDX validation/compile block (around line 68-88), add a branch for when content_json is provided:

```typescript
// After line 62 (URL validation), before MDX parsing:
if (input.content_json && Object.keys(input.content_json).length > 0) {
  // TipTap JSON path — compile JSON to HTML
  const compiled = await compileJsonContent(input.content_json as import('@tiptap/core').JSONContent)

  try {
    await postRepo().update(id, {
      ...(input.cover_image_url !== undefined ? { cover_image_url: input.cover_image_url } : {}),
      translation: {
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: input.content_mdx || null,
        content_compiled: null,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        ...(input.meta_title !== undefined ? { meta_title: input.meta_title } : {}),
        ...(input.meta_description !== undefined ? { meta_description: input.meta_description } : {}),
        ...(input.og_image_url !== undefined ? { og_image_url: input.og_image_url } : {}),
      },
    })
  } catch (e) {
    return { ok: false, error: 'db_error', message: e instanceof Error ? e.message : String(e) }
  }

  // Persist JSON + HTML columns
  {
    const supabase = getSupabaseServiceClient()
    await supabase
      .from('blog_translations')
      .update({
        content_json: input.content_json,
        content_html: compiled.html,
      })
      .eq('post_id', id)
      .eq('locale', locale)
  }

  // Continue with tag, series, hashtag, and SEO extras updates (same as MDX path)
  // ... (the existing code from line 115 onward handles this)

  revalidateBlogPostSeo(siteId, id, locale, input.slug)
  revalidateTag('blog-hub')
  return { ok: true, postId: id }
}

// Existing MDX path continues below...
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts
git commit -m "feat(blog): add JSON compile path to savePost action"
```

---

## Task 14: Frontend Dual Render Path

**Files:**
- Create: `apps/web/src/components/blog/blog-article-html.tsx`
- Modify: `apps/web/src/app/(public)/blog/[slug]/page.tsx`

- [ ] **Step 1: Create the BlogArticleHtml wrapper**

```tsx
// apps/web/src/components/blog/blog-article-html.tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { EmbedHydrator } from './embed-hydrator'

interface BlogArticleHtmlProps {
  html: string
  children?: ReactNode
}

export function BlogArticleHtml({ html, children }: BlogArticleHtmlProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!bodyRef.current) return
    const hydrator = new EmbedHydrator(bodyRef.current)
    hydrator.hydrate()
    return () => hydrator.cleanup()
  }, [html])

  return (
    <div className="blog-body reader-article">
      <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: html }} />
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create the EmbedHydrator**

```tsx
// apps/web/src/components/blog/embed-hydrator.tsx

const EMBED_HEIGHTS: Record<string, number> = {
  youtube: 400,
  twitter: 350,
  instagram: 480,
  codesandbox: 500,
  codepen: 400,
  github: 320,
  vimeo: 400,
  loom: 400,
  spotify: 152,
  soundcloud: 166,
  figma: 450,
}

function getEmbedUrl(provider: string, url: string): string | null {
  switch (provider) {
    case 'youtube': {
      const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?/]+)/)
      return match ? `https://www.youtube.com/embed/${match[1]}` : null
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}` : null
    }
    case 'loom': {
      const match = url.match(/loom\.com\/share\/([a-f0-9]+)/)
      return match ? `https://www.loom.com/embed/${match[1]}` : null
    }
    case 'spotify': {
      return url.replace('open.spotify.com/', 'open.spotify.com/embed/')
    }
    case 'soundcloud':
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false`
    case 'codepen': {
      return url.replace('/pen/', '/embed/') + '?default-tab=result&theme-id=dark'
    }
    case 'codesandbox': {
      const match = url.match(/codesandbox\.io\/s\/([^?/]+)/)
      return match ? `https://codesandbox.io/embed/${match[1]}?fontsize=14&theme=dark` : null
    }
    case 'figma':
      return `https://www.figma.com/embed?embed_host=astra&url=${encodeURIComponent(url)}`
    default:
      return null
  }
}

export class EmbedHydrator {
  private container: HTMLElement
  private iframes: HTMLIFrameElement[] = []

  constructor(container: HTMLElement) {
    this.container = container
  }

  hydrate() {
    const embeds = this.container.querySelectorAll<HTMLElement>('.pb-embed[data-provider][data-url]')
    embeds.forEach((el) => {
      const provider = el.dataset.provider ?? ''
      const url = el.dataset.url ?? ''
      if (!url) return

      const embedUrl = getEmbedUrl(provider, url)
      if (!embedUrl) {
        el.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--pb-accent)">${url}</a>`
        return
      }

      const iframe = document.createElement('iframe')
      iframe.src = embedUrl
      iframe.style.width = '100%'
      iframe.style.height = `${EMBED_HEIGHTS[provider] ?? 400}px`
      iframe.style.border = '0'
      iframe.loading = 'lazy'
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups')
      iframe.allowFullscreen = true

      el.innerHTML = ''
      el.appendChild(iframe)
      this.iframes.push(iframe)
    })
  }

  cleanup() {
    this.iframes.forEach((iframe) => iframe.remove())
    this.iframes = []
  }
}
```

- [ ] **Step 3: Update the blog detail page for dual rendering**

In `apps/web/src/app/(public)/blog/[slug]/page.tsx`, modify the rendering section (around line 330-351).

Add import at the top:

```typescript
import { BlogArticleHtml } from '@/components/blog/blog-article-html'
```

Replace the `<BlogArticleClient>` usage to support HTML content:

```tsx
<BlogArticleClient
  sections={toc}
  readingTimeMin={tx.reading_time_min}
  slug={slug}
  locale={locale}
  siteId={ctx.siteId}
  postId={post.id}
  keyPoints={(txExtra as { key_points?: string[] }).key_points ?? undefined}
  mobileInlineAd={/* ... existing ... */}
  midContentAd={/* ... existing ... */}
>
  {(txExtra as { content_html?: string }).content_html ? (
    <BlogArticleHtml html={(txExtra as { content_html: string }).content_html} />
  ) : (
    <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
  )}
</BlogArticleClient>
```

Also update the TOC extraction to use `content_html` when available:

```typescript
// After fetching txStructured (around line 153-169), update TOC:
const htmlContent = (txExtra as { content_html?: string }).content_html
if (htmlContent) {
  toc = extractTocFromHtml(htmlContent)
}
```

- [ ] **Step 4: Export BlogArticleHtml from barrel**

In `apps/web/src/components/blog/index.ts`, add:

```typescript
export { BlogArticleHtml } from './blog-article-html'
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/blog/blog-article-html.tsx apps/web/src/components/blog/embed-hydrator.tsx apps/web/src/app/\(public\)/blog/\[slug\]/page.tsx apps/web/src/components/blog/index.ts
git commit -m "feat(blog): dual render path — HTML for TipTap posts, MDX fallback for legacy"
```

---

## Task 15: New Post Editor — TipTap by Default

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/new-post-editor.tsx`

- [ ] **Step 1: Replace PostEditor with TipTap for new posts**

The new post editor currently uses `PostEditor` (MDX). Replace it to use TipTap by default. New posts should always start with content_json, never content_mdx.

Import TipTapEditor and create a wrapper that handles the ephemeral post creation flow (create on first save, navigate to edit page) while using TipTap instead of PostEditor.

The key changes:
1. Replace `PostEditor` with `TipTapEditor`
2. Store JSON + HTML content instead of MDX
3. On save: call `createPost` then `savePost` with `content_json`
4. Add standalone title/slug inputs above the TipTap editor

- [ ] **Step 2: Verify new post creation flow**

Run: `cd apps/web && npm run dev`
Navigate to `/cms/blog/new` and verify:
1. TipTap editor renders
2. Slash commands work (type /)
3. First save creates post and redirects to edit page

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/(authed)/blog/new/new-post-editor.tsx
git commit -m "feat(blog): new posts use TipTap editor by default"
```

---

## Task 16: CTA Button Multi-Button Overhaul

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/cta-button-node.tsx`

- [ ] **Step 1: Update CTAButtonExtension attrs**

Change the node attributes from single-button (`text`, `url`, `color`, `align`) to multi-button:

```typescript
addAttributes() {
  return {
    buttons: {
      default: [{ text: 'Click Here', url: '', style: 'primary' }],
      parseHTML: (element: HTMLElement) => {
        try { return JSON.parse(element.getAttribute('data-buttons') ?? '[]') }
        catch { return [{ text: 'Click Here', url: '', style: 'primary' }] }
      },
      renderHTML: (attributes: { buttons: Array<{ text: string; url: string; style: string }> }) => ({
        'data-buttons': JSON.stringify(attributes.buttons),
      }),
    },
    align: { default: 'center' },
  }
}
```

- [ ] **Step 2: Update the NodeView to render button group**

Update the React component to show multiple buttons with style picker (primary/secondary/ghost), add/remove button controls, inline editing per button.

- [ ] **Step 3: Handle backward compat for old single-button nodes**

In `parseHTML`, detect old-format nodes (with `text`/`url`/`color` attrs instead of `buttons` array) and convert:

```typescript
parseHTML() {
  return [{
    tag: 'div.cta-wrapper',
    getAttrs: (element: HTMLElement) => {
      const dataButtons = element.getAttribute('data-buttons')
      if (dataButtons) {
        try { return { buttons: JSON.parse(dataButtons) } }
        catch { /* fall through */ }
      }
      const text = element.querySelector('.cta-button')?.textContent ?? 'Click Here'
      const url = element.querySelector('a')?.getAttribute('href') ?? ''
      return { buttons: [{ text, url, style: 'primary' }] }
    },
  }]
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/cta-button-node.tsx
git commit -m "feat(editor): CTA button multi-button support with style picker"
```

---

## Task 17: Social Embed — 6 New Providers

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/social-embed-node.tsx`

- [ ] **Step 1: Add new providers to detectProvider()**

In the `detectProvider` function, add URL pattern matching for:

```typescript
if (url.includes('vimeo.com/')) return 'vimeo'
if (url.includes('loom.com/share/')) return 'loom'
if (url.includes('open.spotify.com/')) return 'spotify'
if (url.includes('soundcloud.com/')) return 'soundcloud'
if (url.includes('figma.com/')) return 'figma'
if (url.endsWith('.pdf')) return 'pdf'
```

- [ ] **Step 2: Add provider metadata for new providers**

```typescript
// In PROVIDER_META:
vimeo: { label: 'Vimeo', color: '#1ab7ea', height: 400 },
loom: { label: 'Loom', color: '#625df5', height: 400 },
spotify: { label: 'Spotify', color: '#1db954', height: 152 },
soundcloud: { label: 'SoundCloud', color: '#ff5500', height: 166 },
figma: { label: 'Figma', color: '#f24e1e', height: 450 },
pdf: { label: 'PDF', color: '#ff0000', height: 600 },
```

- [ ] **Step 3: Update EmbedProvider type**

```typescript
export type EmbedProvider = 'youtube' | 'twitter' | 'instagram' | 'codesandbox' | 'codepen' | 'github' | 'vimeo' | 'loom' | 'spotify' | 'soundcloud' | 'figma' | 'pdf'
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/social-embed-node.tsx
git commit -m "feat(editor): add 6 new embed providers — Vimeo, Loom, Spotify, SoundCloud, Figma, PDF"
```

---

## Task 18: Editor Toolbar Updates

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/editor-toolbar.tsx`

- [ ] **Step 1: Add H4 button to heading group**

After the H3 button, add:

```tsx
<ToolbarButton
  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
  active={editor.isActive('heading', { level: 4 })}
  title="Heading 4"
>
  <Heading4 size={16} />
</ToolbarButton>
```

Add `Heading4` to the Lucide imports.

- [ ] **Step 2: Add new block buttons group**

After the existing toolbar groups, add callout, table, and columns buttons:

```tsx
<ToolbarDivider />
<ToolbarButton
  onClick={() => props.onInsertCallout?.()}
  title="Callout"
>
  <MessageSquare size={16} />
</ToolbarButton>
<ToolbarButton
  onClick={() => props.onInsertTable?.()}
  title="Table"
>
  <TableIcon size={16} />
</ToolbarButton>
<ToolbarButton
  onClick={() => props.onInsertColumns?.()}
  title="Columns"
>
  <Columns2 size={16} />
</ToolbarButton>
```

Extend the `EditorToolbarProps` interface with the new callbacks:

```typescript
onInsertCallout?: () => void
onInsertTable?: () => void
onInsertColumns?: () => void
```

- [ ] **Step 3: Wire callbacks from tiptap-editor.tsx**

In `tiptap-editor.tsx`, pass the new callbacks to `<EditorToolbar>`:

```tsx
onInsertCallout={() => { /* same as slash command callout insertion */ }}
onInsertTable={() => { /* same as slash command table insertion */ }}
onInsertColumns={() => { /* same as slash command columns insertion */ }}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/editor-toolbar.tsx apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx
git commit -m "feat(editor): add H4, callout, table, columns buttons to toolbar"
```

---

## Task 19: Editor CSS for New Blocks

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/editor/editor-styles.css`

- [ ] **Step 1: Add CSS for new block types in the editor**

Append to `editor-styles.css`:

```css
/* ═══ Callout Block ═══ */
.newsletter-editor .callout-editor-block .callout-content p {
  margin: 0;
}

/* ═══ Toggle Block ═══ */
.newsletter-editor .toggle-title-editor {
  outline: none;
}

.newsletter-editor .toggle-body-editor {
  min-height: 40px;
}

/* ═══ Columns Block ═══ */
.newsletter-editor [data-column] {
  min-height: 60px;
}

/* ═══ Task List (Checklist) ═══ */
.newsletter-editor ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

.newsletter-editor ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5em;
}

.newsletter-editor ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 4px;
}

.newsletter-editor ul[data-type="taskList"] li > label input[type="checkbox"] {
  accent-color: #6366f1;
  cursor: pointer;
}

/* ═══ Table ═══ */
.newsletter-editor table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
}

.newsletter-editor th,
.newsletter-editor td {
  border: 1px solid #1f2937;
  padding: 8px 12px;
  text-align: left;
  min-width: 80px;
}

.newsletter-editor th {
  background: #111827;
  font-weight: 600;
  color: #f3f4f6;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.newsletter-editor td {
  color: #d1d5db;
}

.newsletter-editor .selectedCell {
  background: rgba(99, 102, 241, 0.15);
}

/* ═══ H4 in editor ═══ */
.newsletter-editor .ProseMirror h4 {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #6b7280;
  margin: 16px 0 8px;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/(authed)/_shared/editor/editor-styles.css
git commit -m "feat(editor): add CSS for callout, toggle, columns, table, checklist, H4 blocks"
```

---

## Task 20: Run Full Test Suite

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (existing + new spacing/compile-json tests)

- [ ] **Step 2: Fix any failures**

If tests fail, investigate and fix. Common issues:
- Import path mismatches in new test files
- Missing `@/lib/blog/slugify` mock
- TypeScript strict errors

- [ ] **Step 3: Visual verification**

Run: `cd apps/web && npm run dev`

Test in browser:
1. Open `/cms/blog/new` — TipTap editor should render
2. Type `/` — 23 slash commands should appear
3. Select text — bubble menu with 7 buttons (including highlight)
4. Insert callout, toggle, columns, table, checklist — each should render in editor
5. Save a post — verify `content_json` and `content_html` stored in DB
6. Open the published post at `/blog/{slug}` — verify HTML renders with pinboard theme

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(blog): address test failures and visual issues in content blocks"
```
