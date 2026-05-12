# Pipeline Tiptap Editor — Design Spec

**Date:** 2026-05-12
**Status:** Approved
**Scope:** Add rich text editing (Tiptap) to all text sections in the CMS pipeline

---

## Problem

Pipeline sections (Ideia, Rascunho/Draft, generic text) use plain `<textarea>` and `contentEditable` divs. When AI generates formatted content (headings, bold, lists, blockquotes), the user sees raw markdown that requires manual validation and formatting. A rich text editor would display AI output nearly production-ready.

## Decision: New Component, Not Wrapper

The existing `TiptapEditor` (2,900 lines in `_shared/editor/`) is hardcoded for newsletters/blog:
- 15+ extensions hardcoded (merge tags, CTA buttons, social embeds — irrelevant for pipeline)
- Monolithic toolbar (20+ buttons, zero config)
- CSS scoped to `.newsletter-editor` (conflicts with pipeline `--gem-*` system)
- `onImageUpload` is required (not all sections need images)

**Refactoring it is too risky** — newsletter/blog editors work fine. Instead: a new `PipelineEditor` that uses `@tiptap/react` (`useEditor`) directly, importing only shared extensions that make sense.

```
@tiptap/react (useEditor)
    ├── _shared/editor/tiptap-editor.tsx       ← newsletter/blog (UNTOUCHED)
    │   ├── callout-node.tsx                    ← REUSED ↓
    │   ├── toggle-node.tsx                     ← REUSED ↓
    │   └── editor-styles.css                   ← scoped .newsletter-editor
    │
    └── pipeline/_shared/
        ├── pipeline-editor.tsx                 ← NEW
        ├── pipeline-toolbar.tsx                ← NEW, configurable
        ├── pipeline-editor.css                 ← NEW, scoped --gem-*
        └── markdown-to-tiptap.ts              ← NEW, conversion utility
```

## Architecture

### Extension Presets

**Full** (Rascunho/Draft — long-form content):

| Extension | Source | Purpose |
|-----------|--------|---------|
| StarterKit | @tiptap/starter-kit | H2-H4, bold, italic, strike, code, codeBlock, lists, blockquote, HR |
| Underline | @tiptap/extension-underline | Underline formatting |
| Link | @tiptap/extension-link | Hyperlinks with security attrs |
| Image | @tiptap/extension-image | Inline images (optional, only if onImageUpload provided) |
| TextAlign | @tiptap/extension-text-align | Left/center/right alignment |
| Highlight | @tiptap/extension-highlight | Multi-color highlighting |
| Placeholder | @tiptap/extension-placeholder | Contextual placeholder text |
| CharacterCount | @tiptap/extension-character-count | Word/char counting |
| CalloutExtension | _shared/editor/callout-node | Info/warning/tip callout blocks |
| ToggleExtensions | _shared/editor/toggle-node | Expandable toggle sections |
| TaskList/TaskItem | @tiptap/extension-task-list | Checklist items |

**Compact** (Ideia, Generic text — short-form):

| Extension | Source | Purpose |
|-----------|--------|---------|
| StarterKit | @tiptap/starter-kit | H3-H4, bold, italic, lists |
| Link | @tiptap/extension-link | Hyperlinks |
| Placeholder | @tiptap/extension-placeholder | Contextual placeholder text |
| CharacterCount | @tiptap/extension-character-count | Word/char counting |

### Toolbar Presets

```tsx
interface PipelineToolbarProps {
  editor: Editor | null
  preset: 'full' | 'compact'
}
```

| Preset | Groups |
|--------|--------|
| **full** | Undo/Redo · P/H2/H3/H4 · B/I/U/S · Bullet/Numbered/Task · Link/Image · Quote/Code/Callout · HR · Word count |
| **compact** | B/I · Bullet/Numbered · Link · Word count |

### Component Interface

```tsx
interface PipelineEditorProps {
  content: SectionData['content']    // string (markdown) or JSONContent
  isEditing: boolean
  onContentChange: (content: JSONContent) => void
  preset: 'full' | 'compact'
  placeholder?: string
  onImageUpload?: (file: File) => Promise<string | null>
}
```

Adapts to the existing `RendererProps` interface used by all pipeline renderers.

### CSS Isolation

```css
.pipeline-editor .ProseMirror {
  background: var(--gem-well);
  color: var(--gem-text);
  border: 1px solid var(--gem-border);
  border-radius: 0.5rem;
  min-height: 200px;
  padding: 1rem;
  font-size: 0.9375rem;
  line-height: 1.7;
}
```

Uses `--gem-*` CSS variables from pipeline's existing design system. Zero conflict with `.newsletter-editor`.

## Data Flow

### Storage Format Change

Sections that use PipelineEditor store content as `JSONContent` (Tiptap's AST format) instead of plain strings.

### AI Cowork Path

```
AI writes markdown → PATCH /sections { content: "## Heading\n..." }
  → useSection receives string
  → On editor mount: markdownToTiptapJSON(content) → JSONContent
  → Auto-save with JSONContent (lazy migration, no user interaction)
  → Editor renders natively
```

### Human Edit Path

```
User types in Tiptap → onChange emits JSONContent
  → useSection marks dirty
  → Save: PATCH /sections { content: JSONContent }
  → Stored as JSONContent
```

### Conversion Utility

```tsx
// markdown-to-tiptap.ts
import { marked } from 'marked'           // already in deps
import { generateJSON } from '@tiptap/html' // Tiptap built-in

export function markdownToTiptapJSON(markdown: string): JSONContent {
  const html = marked.parse(markdown, { async: false })
  return generateJSON(html, pipelineExtensions)
}
```

`generateJSON` is from Tiptap core — converts HTML to JSONContent using the registered extension list. Zero extra dependencies.

### Migration Strategy

**Lazy migration** — converts on first open:

```tsx
function normalizeContent(content: SectionData['content']): JSONContent | null {
  if (typeof content === 'string' && content.trim()) {
    return markdownToTiptapJSON(content)
  }
  if (isJSONContent(content)) {
    return content as JSONContent
  }
  return null  // empty or complex object — renderer handles
}
```

## Renderer Changes

| Renderer | Change | Notes |
|----------|--------|-------|
| `draft-renderer.tsx` | Replace `<textarea>` with `<PipelineEditor preset="full">` | Main beneficiary. Keeps word count/reading time in read-only view |
| `idea-renderer.tsx` | Replace `contentEditable` for `body` field with `<PipelineEditor preset="compact">` | `premise` stays as single-line input (1-2 sentences). `angle`, `vvs` stay as-is. |
| `generic-renderer.tsx` | Replace `contentEditable` (strings) with `<PipelineEditor preset="compact">` | JSON objects stay as textarea |
| `script-renderer.tsx` | **NO CHANGE** | Special syntax `[TAGS]`, `[PAUSE]`, beats — not suitable for rich text |
| `seo-renderer.tsx` | **NO CHANGE** | Structured fields (title, description) — textarea is appropriate |
| `images-renderer.tsx` | **NO CHANGE** | Image gallery, not text |
| `publish-renderer.tsx` | **NO CHANGE** | Publication metadata form |

### DraftRenderer Content Extraction

DraftRenderer content can be `string` or `{ body: string, seo: {...} }`. Before conversion:

```tsx
function extractDraftBody(content: SectionData['content']): string {
  if (typeof content === 'string') return content
  if (typeof content === 'object' && content !== null && 'body' in content) {
    return (content as { body: string }).body
  }
  return ''
}
```

After PipelineEditor edit, save back in the same structure (preserve `seo` if it exists).

### IdeaRenderer Field Strategy

IdeaRenderer stores structured JSON: `{ premise, body, angle, vvs, validated_at, cross_refs }`.

- `body` (multi-paragraph): `<PipelineEditor preset="compact">`
- `premise` (1-2 sentences): stays as `contentEditable` or single-line input
- `angle`, `vvs`, `validated_at`, `cross_refs`: unchanged (structured data, not free text)

Each field saves independently back to the parent JSON object via `onContentChange`.

### Lazy Migration Auto-Save

When the editor detects string content and converts to JSONContent, it marks the section as dirty but does NOT auto-save silently. The user sees the Save button enabled and can review the converted content before persisting. This prevents surprise writes.

## Read-Only Rendering

When `isEditing=false`:
- Tiptap renders in `editable={false}` mode (native read-only)
- Overlay shows: word count, reading time (~200 words/min)
- Section outline extracted from JSONContent AST (parse heading nodes)
- Preserves existing visual hierarchy (lead paragraph styling, heading borders)

## Edge Cases

### Paste Handling
Extract `transformPastedHTML` from tiptap-editor.tsx into a reusable `_shared/editor/paste-sanitizer.ts`. Strips Office/Word markup, removes class attributes.

### Keyboard Shortcuts
Each `useEditor()` instance has its own shortcut scope — no conflict between sections or with newsletter editor.

### Tab Switching
Each section tab creates its own editor instance. Content prop ensures restore on remount. Undo history resets on tab switch (acceptable — sections are independent units).

### Empty State
Contextual placeholders per preset:
- **full**: "Escreva o conteudo do seu rascunho..."
- **compact**: "Descreva a ideia..."

### Fallback
If `markdownToTiptapJSON` throws (malformed content), fall back to `<textarea>` display. Never lose content.

## Not In Scope

- Refactoring existing TiptapEditor
- Touching newsletter/blog editors
- Changing pipeline API format
- Autosave (uses existing `useSection.save()`)
- Collaborative real-time editing (cowork_rev exists but is a separate feature)
- Slash commands (can be added later if needed)

## Dependencies

All already installed — zero new packages:
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*` (in use by newsletter/blog)
- `marked` (v15.0.12, in package.json)
- `@tiptap/html` (`generateJSON`) — part of Tiptap core

## Testing

- Unit: `markdownToTiptapJSON` conversion (headings, lists, bold, links, code blocks)
- Unit: `normalizeContent` migration (string → JSONContent, passthrough for existing JSONContent)
- Integration: PipelineEditor renders content, emits onChange with JSONContent
- Integration: Section save/load round-trip with JSONContent format
- Visual: Verify read-only rendering matches current visual hierarchy
