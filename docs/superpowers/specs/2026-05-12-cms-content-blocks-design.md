# CMS Content Blocks — Design Spec

**Date:** 2026-05-12
**Status:** Draft
**Scope:** Migrate blog editor to TipTap, add 14 block types, build frontend renderer with pinboard theme

---

## 1. Context & Motivation

The blog editor currently uses a raw MDX text editor (`PostEditor` from `@tn-figueiredo/cms`). Content is stored as `content_mdx` in `blog_translations`, compiled via `compileMdx()`, and rendered via `<MdxRunner>` with `blogRegistry`.

The design prototype (`design/cms-showcase.html`) demonstrates rich content blocks (callouts, CTAs, code with syntax highlighting, embeds, tables, columns, toggles) that the current MDX editor cannot produce without hand-writing markup.

**Goal:** Give blog authors a visual block editor (TipTap) that produces structured content, rendered on the frontend with the pinboard theme.

**Non-goal:** Removing MDX support. The MDX path remains for backward compatibility; new posts use TipTap.

---

## 2. Architecture Overview

```
Author writes in TipTap editor (CMS)
         ↓
TipTap JSONContent stored in blog_translations.content_json
         ↓
Compile step: JSONContent → HTML (content_html) + TOC extraction
         ↓
Frontend renders HTML with pinboard theme CSS classes
         ↓
Fallback: if content_json is NULL, use existing MDX path
```

### Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor | TipTap (shared `_shared/editor/`) | Already used for newsletters; 3 custom extensions exist |
| Storage | `content_json` (jsonb) + `content_html` (text) | Columns already exist in `blog_translations`, currently unused |
| Compile | Server-side JSON→HTML on save | Same pattern as MDX compile-on-save; no runtime cost |
| Frontend render | Sanitized HTML with theme CSS | Simpler than hydrating React from JSON; matches MDX output pattern |
| Syntax highlight | Shiki (already in `blogRegistry`) | `ShikiCodeBlock` already exists; generate highlighted HTML at compile |
| Backward compat | Dual-path: JSON preferred, MDX fallback | `content_json IS NOT NULL` → use HTML path; else MDX path |

---

## 3. Database Changes

**No new tables.** The `blog_translations` table already has the required columns:

| Column | Type | Current state | After |
|--------|------|---------------|-------|
| `content_json` | jsonb | NULL (unused) | TipTap JSONContent |
| `content_html` | text | NULL (unused) | Compiled HTML with theme classes |
| `content_mdx` | text NOT NULL | Primary content | Kept for backward compat |
| `content_compiled` | text | MDX JS source | Kept for MDX fallback |
| `content_toc` | jsonb | From MDX headings | Also extracted from JSON |
| `reading_time_min` | integer | From MDX word count | Also computed from JSON |

**Migration needed:** `ALTER TABLE blog_translations ALTER COLUMN content_mdx DROP NOT NULL;` — new TipTap posts won't have MDX.

---

## 4. TipTap Extensions

### 4.1 Existing extensions (no changes needed)

| Extension | Source | Notes |
|-----------|--------|-------|
| StarterKit | @tiptap/starter-kit | h1-h3, p, bulletList, orderedList, blockquote, hr, codeBlock, bold, italic, strike, code |
| Underline | @tiptap/extension-underline | |
| Link | @tiptap/extension-link | rel="noopener noreferrer nofollow" |
| Image | @tiptap/extension-image | Lazy loading, Media Gallery integration |
| TextAlign | @tiptap/extension-text-align | left, center, right |
| Highlight | @tiptap/extension-highlight | multicolor: true — **already supports the Highlight mark** |
| CharacterCount | @tiptap/extension-character-count | |

### 4.2 Extensions to modify

#### Heading — add level 4

```ts
StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } })
```

Slash command: add "Heading 4" item. Toolbar: add H4 button.

#### CTAButton — multi-button support

**Current attrs:** `{ text, url, color, align }`
**New attrs:**
```ts
{
  buttons: Array<{ text: string; url: string; style: 'primary' | 'secondary' | 'ghost' }>  // max 3
  align: 'left' | 'center' | 'right'
}
```

Migration: existing single-button nodes converted to `buttons: [{ text, url, style: 'primary' }]` on load.

NodeView: renders button group with inline editor panel (style picker, + button, remove button).

#### CodeBlock — language selector

Extend `@tiptap/extension-code-block` attrs with `language: string` (default: `'text'`).

NodeView: `<select>` dropdown in header for language selection. Languages: typescript, javascript, python, bash, css, sql, json, html, go, rust, text.

Content remains monochrome in editor. Syntax highlighting applied at compile time via Shiki.

#### SocialEmbed — 6 additional providers (frontend only)

Editor keeps 6 providers (YouTube, Twitter, Instagram, CodeSandbox, CodePen, GitHub). Frontend EmbedFrame component also renders: Vimeo, Loom, Spotify, SoundCloud, Figma, PDF — these are created by pasting URLs that match extended provider detection.

Add to `detectProvider()`:
- Vimeo: `vimeo.com/`
- Loom: `loom.com/share/`
- Spotify: `open.spotify.com/`
- SoundCloud: `soundcloud.com/`
- Figma: `figma.com/`
- PDF: any URL ending in `.pdf`

### 4.3 New extensions

#### CalloutNode

```ts
Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  attrs: {
    variant: { default: 'info' }  // 'info' | 'warning' | 'tip' | 'error'
  }
})
```

**Editor rendering:**
- Left border color by variant (indigo/yellow/green/red — editor palette)
- SVG Lucide icon: Info (info), AlertTriangle (warning), Lightbulb (tip), XCircle (error)
- Inline panel above block: 4 variant buttons

**Frontend rendering:**
- Warm palette: info=#8B9AAD, warning=#E8C44A, tip=#9AAD6E, error=#C75034
- SVG Lucide icons same shape, warm colors
- Background: variant color at 4-6% opacity
- Border-left: 3px solid variant color

**Slash command:** `/callout` — inserts info variant by default.

#### ChecklistNode

```ts
Node.create({
  name: 'taskList',
  group: 'block',
  content: 'taskItem+',
})

Node.create({
  name: 'taskItem',
  group: 'block',
  content: 'inline*',
  attrs: {
    checked: { default: false }
  }
})
```

Uses `@tiptap/extension-task-list` + `@tiptap/extension-task-item`. Checkboxes clickable in editor, static in frontend.

**Slash command:** `/checklist`

#### ToggleNode

```ts
Node.create({
  name: 'toggleWrapper',
  group: 'block',
  content: 'toggleTitle toggleBody',
})

Node.create({
  name: 'toggleTitle',
  content: 'inline*',  // Summary text (single line)
})

Node.create({
  name: 'toggleBody',
  content: 'block+',   // Block content: paragraphs, code, lists, etc.
})
```

**Editor rendering:** Bordered container with clickable summary. Title and body are separately editable regions.
**Frontend rendering:** `<details>` with `<summary>`. CSS animation via `interpolate-size: allow-keywords` (progressive enhancement; instant fallback on unsupported browsers).

**Slash command:** `/toggle`

#### ColumnsNode

```ts
Node.create({
  name: 'columns',
  group: 'block',
  content: 'column{2,3}',
  attrs: {
    ratio: { default: '1:1' }  // '1:1' | '2:1' | '1:2' | '1:1:1'
  }
})

Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',
})
```

**Editor rendering:** Dashed border per column, ratio label in corner, panel with ratio selector.
**Frontend rendering:** CSS grid with `grid-template-columns` matching ratio. `@media (max-width: 767px)`: stack to single column.

**Slash command:** `/columns`

#### TableNode (enhanced)

Uses `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`.

**Additional attrs on table node:**
```ts
{ caption: { default: '' } }
```

**Editor rendering:** Caption input field above table. Add/remove row/column controls.
**Frontend rendering:** JetBrains Mono uppercase headers, caption as `<caption>`, border styling with theme line token.

**Slash command:** `/table` — inserts 3x3 default.

---

## 5. Spacing System

Applied at compile time (JSON→HTML), not in the editor.

### 5 levels

| Token | Value | Use case |
|-------|-------|----------|
| xs | 0.6em | Adjacent list items, figcaption+p |
| sm | 1.0em | p+p, h+p, list+p |
| md | 1.6em | p+code, p+callout, p+table, p+embed |
| lg | 2.2em | divider+*, *+divider, callout+callout |
| xl | 3.0em | p+h2, p+h3, *+h2 |

### Adjacency matrix (compile-time lookup)

The compile step reads block pairs and inserts `margin-top` via CSS class:

```ts
const SPACING: Record<string, Record<string, string>> = {
  paragraph:   { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', table: 'md', embed: 'md', toggle: 'md', columns: 'md', cta: 'md', divider: 'lg', default: 'sm' },
  heading:     { paragraph: 'sm', heading: 'xl', codeBlock: 'md', callout: 'md', default: 'sm' },
  codeBlock:   { paragraph: 'md', heading: 'xl', default: 'md' },
  callout:     { paragraph: 'md', callout: 'lg', heading: 'xl', default: 'md' },
  divider:     { default: 'lg' },
  // ... etc
}
```

CSS classes: `.sp-xs { margin-top: 0.6em }`, `.sp-sm { margin-top: 1.0em }`, etc.

---

## 6. Compile Pipeline: JSON → HTML

New function in `apps/web/lib/cms/`:

```ts
interface CompileJsonResult {
  html: string              // Full HTML with theme classes + spacing
  toc: TocEntry[]           // Extracted h2/h3 headings
  readingTimeMin: number    // Word count estimate
}

function compileJsonContent(json: JSONContent): CompileJsonResult
```

### Processing steps

1. **Walk JSONContent tree** node by node
2. **Map each node type** to HTML with pinboard CSS classes
3. **Apply spacing classes** based on adjacent block pairs
4. **Syntax highlight code blocks** via Shiki (server-side)
5. **Extract TOC** from h2/h3 nodes
6. **Count words** for reading time
7. **Sanitize** output (DOMPurify on server — prevent XSS from link URLs, embed URLs)

### Node → HTML mapping

| TipTap node | HTML output |
|-------------|-------------|
| paragraph | `<p class="pb-p">` |
| heading (1-4) | `<h{n} id="{slug}" class="pb-h{n}">` |
| bulletList | `<ul class="pb-ul">` with `→` markers via CSS |
| orderedList | `<ol class="pb-ol">` with zero-padded counters via CSS |
| blockquote | `<blockquote class="pb-quote">` + optional `<footer class="pb-quote-cite">` |
| codeBlock | `<pre class="pb-code" data-lang="{lang}"><code>{shiki-highlighted}</code></pre>` |
| horizontalRule | `<div class="pb-divider">` with ornament span |
| callout | `<aside class="pb-callout pb-callout-{variant}">` with SVG icon |
| ctaButton | `<div class="pb-cta">` with `<a class="pb-cta-{style}">` per button |
| toggle | `<details class="pb-toggle"><summary>` |
| table | `<div class="pb-table-wrap"><table class="pb-table">` with optional `<caption>` |
| columns | `<div class="pb-columns pb-cols-{ratio}">` |
| taskList | `<ul class="pb-checklist">` with checkbox spans |
| socialEmbed | `<div class="pb-embed" data-provider="{p}">` with iframe or card |
| image | `<figure class="pb-figure"><img>` with optional `<figcaption>` |
| highlight (mark) | `<mark class="pb-mark">` |

### CSS file

New file: `apps/web/src/styles/pinboard-blocks.css` — imported in the blog layout.

Contains all `.pb-*` classes using CSS custom properties from the pinboard theme (`--pb-bg`, `--pb-ink`, `--pb-accent`, `--pb-line`, `--pb-muted`, `--pb-paper`, `--pb-paper2`, `--pb-marker`).

Dark/light theme handled automatically via existing `makePinboardTheme()` token system.

---

## 7. Frontend Rendering

### Dual-path in blog detail page

```tsx
// apps/web/src/app/(public)/blog/[slug]/page.tsx

if (translation.content_json) {
  // New path: render compiled HTML
  return <BlogArticleHtml html={translation.content_html!} toc={toc} />
} else {
  // Legacy path: render compiled MDX
  return <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
}
```

`BlogArticleHtml` is a thin wrapper that:
1. Sets `dangerouslySetInnerHTML` with the sanitized HTML
2. Wraps in `.reader-pinboard .reader-article .blog-body` for theme cascade
3. Adds interactive features: text highlighting, reading progress, AI reader

The existing `reader-pinboard.css` base styles remain. New `.pb-*` classes extend them.

### Embed rendering

Embeds compile to placeholder HTML with `data-provider` and `data-url`. A client component hydrates them:
- YouTube/Vimeo/Loom: lazy iframe with shimmer skeleton
- Twitter/Instagram: static card (rendered server-side from oEmbed cache) OR iframe fallback
- CodeSandbox/CodePen: iframe
- GitHub Gist: iframe with dark srcDoc
- Spotify/SoundCloud: iframe with provider embed URL
- Figma: iframe
- PDF: `<object>` with download fallback

---

## 8. Editor UX

### Blog editor switch

`apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` currently uses `PostEditor` (MDX text editor).

New behavior:
- If `content_json` exists: render TipTap editor, populate from JSON
- If only `content_mdx` exists: render legacy MDX editor (no forced migration)
- New posts: always TipTap
- "Convert to blocks" button: one-time MDX→JSON migration (best-effort parser)

### Save flow changes

```ts
// In savePost server action:
if (input.content_json) {
  const compiled = compileJsonContent(input.content_json)
  await update({
    content_json: input.content_json,
    content_html: compiled.html,
    content_toc: compiled.toc,
    reading_time_min: compiled.readingTimeMin,
    // Keep content_mdx null for new TipTap posts
  })
} else {
  // Existing MDX path unchanged
}
```

### Slash commands additions

Add to existing 17 commands:

| # | Title | Icon | Action |
|---|-------|------|--------|
| 18 | Heading 4 | Heading4 | Set h4 |
| 19 | Callout | MessageSquare | Insert callout node |
| 20 | Toggle | ChevronRight | Insert toggle node |
| 21 | Columns | Columns2 | Insert 2-column layout |
| 22 | Table | Table | Insert 3x3 table |
| 23 | Checklist | CheckSquare | Insert task list |

### Bubble menu addition

Add **Highlight** button (H icon, yellow accent) to the existing 6 inline formatting buttons. The Highlight TipTap extension is already registered with `multicolor: true`.

---

## 9. Implementation Waves

### Wave 1 — Foundation (est. 8h)

1. **Spacing system:** `compileJsonContent()` function with spacing adjacency matrix
2. **H4 extension:** StarterKit config change + slash command + toolbar button
3. **Divider:** Compile `horizontalRule` → ornamental HTML with `pb-divider` class
4. **Highlight mark:** Add to bubble menu (extension already registered)
5. **Checklist:** Install `@tiptap/extension-task-list` + `@tiptap/extension-task-item`
6. **`pinboard-blocks.css`:** All `.pb-*` classes for wave 1 block types
7. **Blog editor switch:** Dual-path rendering in edit page + save action changes
8. **DB migration:** `content_mdx DROP NOT NULL`

### Wave 2 — Interactive blocks (est. 12h)

1. **CalloutNode:** New extension with 4 variants, inline panel, SVG icons
2. **CTAButton overhaul:** Multi-button attrs, style picker (primary/secondary/ghost)
3. **ToggleNode:** New extension with details/summary, CSS animation
4. **CodeBlock enhancement:** Language selector dropdown, Shiki compile integration
5. **Frontend CSS:** All wave 2 `.pb-*` classes
6. **Compile pipeline:** JSON→HTML for callout, CTA, toggle, code with Shiki

### Wave 3 — Rich content (est. 10h)

1. **Table enhancement:** Caption attr, TipTap table extensions, compile to themed HTML
2. **ColumnsNode:** New extension with ratio control, responsive CSS
3. **SocialEmbed expansion:** 6 new provider detectors, frontend embed cards/iframes
4. **Quote improvement:** Citation field in editor (blockquote already exists)
5. **Image/Figure:** Caption field, lightbox integration
6. **Frontend CSS:** All wave 3 `.pb-*` classes
7. **Compile pipeline:** JSON→HTML for table, columns, embeds, figures

---

## 10. Testing Strategy

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | `compileJsonContent()` — each node type produces correct HTML |
| Unit | Vitest | Spacing adjacency matrix — correct classes for all block pairs |
| Unit | Vitest | Shiki highlighting — correct tokens for TSX, Python, Bash |
| Integration | Vitest + jsdom | TipTap extensions — insert, edit, serialize, parse roundtrip |
| Integration | Vitest | Save action — JSON content persists all columns correctly |
| Visual | Browser | Each block in editor matches mockup (visual approval page) |
| Visual | Browser | Each block in frontend matches mockup (pinboard theme) |
| A11y | axe-core | Contrast ratios, ARIA roles on interactive elements |
| Regression | CI (`npm test`) | Existing MDX path unaffected |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Shiki bundle size | Slow compile | Use `@shikijs/core` with WASM, lazy-load grammars |
| TipTap table complexity | Edge cases in cell editing | Use official `@tiptap/extension-table` — battle-tested |
| MDX→JSON migration lossy | Old posts look different | Keep MDX path; migration is opt-in per post |
| Embed iframe security | XSS via malicious URLs | Allowlist embed domains; sanitize all URLs at compile |
| Toggle animation | No support in older browsers | Progressive enhancement — `interpolate-size` with instant fallback |

---

## 12. Files Changed (estimated)

### New files
- `apps/web/lib/cms/compile-json.ts` — JSON→HTML compile function
- `apps/web/lib/cms/spacing.ts` — Spacing adjacency matrix
- `apps/web/src/styles/pinboard-blocks.css` — All `.pb-*` theme classes
- `apps/web/src/app/cms/(authed)/_shared/editor/callout-node.tsx`
- `apps/web/src/app/cms/(authed)/_shared/editor/toggle-node.tsx`
- `apps/web/src/app/cms/(authed)/_shared/editor/columns-node.tsx`
- `apps/web/src/components/blog/blog-article-html.tsx` — HTML renderer wrapper
- `apps/web/src/components/blog/embed-hydrator.tsx` — Client-side embed iframe loader
- `supabase/migrations/YYYYMMDD_content_mdx_nullable.sql`

### Modified files
- `apps/web/src/app/cms/(authed)/_shared/editor/tiptap-editor.tsx` — Register new extensions
- `apps/web/src/app/cms/(authed)/_shared/editor/slash-commands.tsx` — 6 new commands
- `apps/web/src/app/cms/(authed)/_shared/editor/bubble-menu.tsx` — Add highlight button
- `apps/web/src/app/cms/(authed)/_shared/editor/editor-toolbar.tsx` — H4, callout, table, columns buttons
- `apps/web/src/app/cms/(authed)/_shared/editor/cta-button-node.tsx` — Multi-button overhaul
- `apps/web/src/app/cms/(authed)/_shared/editor/social-embed-node.tsx` — 6 new providers
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/edit-post-client.tsx` — Dual editor switch
- `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` — JSON compile + save
- `apps/web/src/app/(public)/blog/[slug]/page.tsx` — Dual render path
- `apps/web/src/app/(public)/blog/[slug]/blog-article-client.tsx` — Support HTML content

---

## 13. Visual Reference

All block designs approved in the brainstorm visual companion:
- `05-v3-definitive-audit.html` — Color palette, WCAG contrast, spacing system
- `06-block-visual-approval.html` — Side-by-side editor vs frontend for all 14 blocks

### Color palette summary

**Frontend callout variants:**
| Variant | Border/Icon | Background | WCAG ratio |
|---------|-------------|------------|------------|
| info | #8B9AAD | rgba(139,154,173,0.06) | 6.6:1 |
| warning | #E8C44A | rgba(232,196,74,0.04) | 11.3:1 |
| tip | #9AAD6E | rgba(154,173,110,0.04) | 8.2:1 |
| error | #C75034 | rgba(199,80,52,0.04) | 4.5:1 |

**Syntax highlighting tokens (vs #14110B bg):**
| Token | Color | WCAG ratio |
|-------|-------|------------|
| keywords | #E8A87C | 9.3:1 |
| functions | #D4A574 | 8.5:1 |
| strings | #A8B87A | 8.8:1 |
| types | #E8C47C | 11.3:1 |
| comments | #8B7E6C | 4.8:1 |
| operators | #8C8270 | 5.0:1 |
| properties | #C9B99A | 9.8:1 |
| variables | #EFE6D2 | 15.2:1 |
