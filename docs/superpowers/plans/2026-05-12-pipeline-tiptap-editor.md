# Pipeline Tiptap Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich text editing (Tiptap) to pipeline text sections so AI-generated content renders nearly production-ready.

**Architecture:** New `PipelineEditor` component using `@tiptap/react` directly (not wrapping existing TiptapEditor). Reuses shared Tiptap extensions (callout, toggle) from `_shared/editor/`. Markdown content auto-converted via `marked` → HTML → Tiptap on mount.

**Tech Stack:** @tiptap/react 3.22.4, marked 15.0.12, Lucide React icons, CSS with `--gem-*` variables.

**Spec:** `docs/superpowers/specs/2026-05-12-pipeline-tiptap-editor-design.md`

---

## File Structure

**New files (create):**

| File | Responsibility |
|------|----------------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts` | Extension presets (full/compact) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/paste-sanitizer.ts` | HTML paste cleanup utility |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.css` | Scoped CSS for pipeline editor |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-toolbar.tsx` | Configurable toolbar (full/compact presets) |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.tsx` | Main editor component |
| `apps/web/test/unit/pipeline/pipeline-editor-utils.test.ts` | Unit tests for conversion/extraction utilities |

**Existing files (modify):**

| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx` | Replace textarea with PipelineEditor |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/idea-renderer.tsx` | Replace body contentEditable with PipelineEditor |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/generic-renderer.tsx` | Replace string textarea with PipelineEditor |
| `apps/web/package.json` | Add `marked` as direct dependency |

---

## Parallelism Map

```
Wave 1 (parallel): Tasks 1, 2, 3, 4, 5
Wave 2 (sequential): Task 6 (depends on 1-5)
Wave 3 (parallel): Tasks 7, 8, 9 (depend on 6)
Wave 4 (sequential): Task 10
```

---

### Task 1: Add `marked` dependency

`marked` v15.0.12 exists in node_modules as transitive dep but is not in `apps/web/package.json`. Add it explicitly.

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add marked to apps/web**

```bash
cd apps/web && npm install marked@15.0.12 --save-exact
```

- [ ] **Step 2: Verify import works**

```bash
node -e "import('marked').then(m => console.log(typeof m.parse))"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore: add marked as direct dependency for pipeline editor"
```

---

### Task 2: Extension Presets (pipeline-extensions.ts)

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions.ts`

**Dependencies:** None (can run in parallel with Tasks 1, 3, 4, 5)

- [ ] **Step 1: Create editors directory**

```bash
mkdir -p apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors
```

- [ ] **Step 2: Write pipeline-extensions.ts**

```ts
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { CalloutExtension } from '@/app/cms/(authed)/_shared/editor/callout-node'
import {
  ToggleWrapperExtension,
  ToggleTitleExtension,
  ToggleBodyExtension,
} from '@/app/cms/(authed)/_shared/editor/toggle-node'
import type { Extensions } from '@tiptap/react'

interface ExtensionOptions {
  placeholder?: string
  enableImage?: boolean
}

export function getFullExtensions(options: ExtensionOptions = {}): Extensions {
  const exts: Extensions = [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Escreva o conteúdo do seu rascunho...',
    }),
    CharacterCount,
    TaskList,
    TaskItem.configure({ nested: true }),
    CalloutExtension,
    ToggleWrapperExtension,
    ToggleTitleExtension,
    ToggleBodyExtension,
  ]

  if (options.enableImage) {
    exts.push(Image.configure({ inline: false, HTMLAttributes: { loading: 'lazy' } }))
  }

  return exts
}

export function getCompactExtensions(options: ExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [3, 4] },
    }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    }),
    Placeholder.configure({
      placeholder: options.placeholder ?? 'Descreva a ideia...',
    }),
    CharacterCount,
  ]
}

export function getExtensions(
  preset: 'full' | 'compact',
  options: ExtensionOptions = {},
): Extensions {
  return preset === 'full' ? getFullExtensions(options) : getCompactExtensions(options)
}
```

- [ ] **Step 3: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No errors related to pipeline-extensions.ts

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors/pipeline-extensions.ts
git commit -m "feat(pipeline): add Tiptap extension presets (full/compact)"
```

---

### Task 3: Paste Sanitizer (paste-sanitizer.ts)

Extract the paste-cleanup logic from `_shared/editor/tiptap-editor.tsx` (the `transformPastedHTML` function) into a reusable utility.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/paste-sanitizer.ts`

**Dependencies:** None

- [ ] **Step 1: Write paste-sanitizer.ts**

```ts
export function transformPastedHTML(html: string): string {
  return html
    .replace(/class="[^"]*"/gi, '')
    .replace(/style="[^"]*mso[^"]*"/gi, '')
    .replace(/<o:p>[\s\S]*?<\/o:p>/gi, '')
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors/paste-sanitizer.ts
git commit -m "feat(pipeline): extract paste sanitizer utility"
```

---

### Task 4: Pipeline CSS (pipeline-editor.css)

Scoped styles for the pipeline editor using `--gem-*` CSS variables. Must NOT conflict with `.newsletter-editor` styles.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.css`

**Dependencies:** None

- [ ] **Step 1: Write pipeline-editor.css**

```css
/* Pipeline Tiptap Editor — scoped to .pipeline-editor */

.pipeline-editor {
  display: flex;
  flex-direction: column;
}

.pipeline-editor .ProseMirror {
  outline: none;
  min-height: 200px;
  padding: 1rem;
  font-size: 0.9375rem;
  line-height: 1.75;
  color: var(--gem-text);
  background: var(--gem-well);
  border: 1px solid var(--gem-border);
  border-radius: 0 0 0.5rem 0.5rem;
}

.pipeline-editor .ProseMirror.compact {
  min-height: 100px;
}

.pipeline-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--gem-dim);
  pointer-events: none;
  height: 0;
}

/* Headings */
.pipeline-editor .ProseMirror h2 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  padding: 0.5rem 0.875rem;
  border-left: 3px solid var(--gem-accent);
  border-radius: 0 0.375rem 0.375rem 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gem-accent) 5%, transparent), transparent 60%);
  color: var(--gem-text);
}

.pipeline-editor .ProseMirror h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  padding: 0.375rem 0.875rem;
  border-left: 3px solid var(--gem-accent);
  border-radius: 0 0.375rem 0.375rem 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gem-accent) 5%, transparent), transparent 60%);
  color: var(--gem-text);
}

.pipeline-editor .ProseMirror h4 {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--gem-dim);
}

/* Paragraphs */
.pipeline-editor .ProseMirror p {
  margin: 0.5rem 0;
  line-height: 1.85;
  color: var(--gem-muted);
}

.pipeline-editor .ProseMirror > p:first-child {
  font-size: 0.9375rem;
  color: var(--gem-text);
}

/* Inline */
.pipeline-editor .ProseMirror strong {
  color: var(--gem-text);
  font-weight: 600;
}

.pipeline-editor .ProseMirror em {
  color: var(--gem-text);
  font-style: italic;
}

.pipeline-editor .ProseMirror a {
  color: var(--gem-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.pipeline-editor .ProseMirror code {
  background: color-mix(in srgb, var(--gem-accent) 10%, transparent);
  color: var(--gem-accent);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
  font-size: 0.85em;
}

/* Blockquotes */
.pipeline-editor .ProseMirror blockquote {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--gem-accent);
  border-radius: 0 0.375rem 0.375rem 0;
  background: linear-gradient(90deg, color-mix(in srgb, var(--gem-accent) 6%, transparent), transparent 70%);
  color: var(--gem-muted);
  font-style: italic;
}

/* Lists */
.pipeline-editor .ProseMirror ul {
  padding-left: 1.25rem;
  margin: 0.75rem 0;
}

.pipeline-editor .ProseMirror ol {
  padding-left: 1.25rem;
  margin: 0.75rem 0;
}

.pipeline-editor .ProseMirror li {
  margin: 0.375rem 0;
  color: var(--gem-muted);
  line-height: 1.75;
}

.pipeline-editor .ProseMirror li p {
  margin: 0;
}

/* Task list */
.pipeline-editor .ProseMirror ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}

.pipeline-editor .ProseMirror ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.pipeline-editor .ProseMirror ul[data-type="taskList"] li > label {
  margin-top: 0.2rem;
}

.pipeline-editor .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
  accent-color: var(--gem-accent);
}

/* Code blocks */
.pipeline-editor .ProseMirror pre {
  background: color-mix(in srgb, var(--gem-well) 80%, black);
  padding: 1rem;
  border-radius: 0.5rem;
  border: 1px solid var(--gem-border);
  overflow-x: auto;
  margin: 0.75rem 0;
}

.pipeline-editor .ProseMirror pre code {
  background: none;
  color: var(--gem-text);
  padding: 0;
  font-size: 0.8125rem;
  line-height: 1.6;
}

/* Horizontal rule */
.pipeline-editor .ProseMirror hr {
  border: none;
  border-top: 1px solid var(--gem-border);
  margin: 1.5rem 0;
}

/* Images */
.pipeline-editor .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.75rem 0;
}

/* Selection */
.pipeline-editor .ProseMirror ::selection {
  background: color-mix(in srgb, var(--gem-accent) 25%, transparent);
}

/* Read-only tweaks */
.pipeline-editor[data-readonly="true"] .ProseMirror {
  border: none;
  background: transparent;
  padding: 0;
}

/* Stats bar */
.pipeline-editor-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0;
  margin-top: 0.375rem;
  font-size: 0.625rem;
  color: var(--gem-dim);
  border-top: 1px solid var(--gem-border);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors/pipeline-editor.css
git commit -m "feat(pipeline): add scoped CSS for pipeline Tiptap editor"
```

---

### Task 5: Pipeline Toolbar (pipeline-toolbar.tsx)

Configurable toolbar with full/compact presets. Uses Lucide React icons.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-toolbar.tsx`

**Dependencies:** None (uses `@tiptap/react` `Editor` type only)

- [ ] **Step 1: Write pipeline-toolbar.tsx**

```tsx
'use client'

import type { Editor } from '@tiptap/react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Link2,
  Heading2,
  Heading3,
  Heading4,
  Pilcrow,
  Code2,
  MessageSquare,
} from 'lucide-react'

interface PipelineToolbarProps {
  editor: Editor
  preset: 'full' | 'compact'
}

function Btn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1 rounded transition-colors ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:bg-white/5'}`}
      style={{
        color: active ? 'var(--gem-accent)' : 'var(--gem-muted)',
        background: active ? 'color-mix(in srgb, var(--gem-accent) 15%, transparent)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div className="w-px h-4 mx-0.5" style={{ background: 'var(--gem-border)' }} />
}

export function PipelineToolbar({ editor, preset }: PipelineToolbarProps) {
  const s = 14

  if (preset === 'compact') {
    return (
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}
      >
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
          <Bold size={s} />
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
          <Italic size={s} />
        </Btn>
        <Sep />
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
          <List size={s} />
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
          <ListOrdered size={s} />
        </Btn>
        <Sep />
        <Btn
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
              return
            }
            const url = window.prompt('URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          title="Link (Ctrl+K)"
        >
          <Link2 size={s} />
        </Btn>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
      style={{ borderBottom: '1px solid var(--gem-border)', background: 'var(--gem-surface)' }}
    >
      {/* Undo / Redo */}
      <Btn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Desfazer">
        <Undo2 size={s} />
      </Btn>
      <Btn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Refazer">
        <Redo2 size={s} />
      </Btn>
      <Sep />

      {/* Block type */}
      <Btn active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Parágrafo">
        <Pilcrow size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Título H2">
        <Heading2 size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Título H3">
        <Heading3 size={s} />
      </Btn>
      <Btn active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="Título H4">
        <Heading4 size={s} />
      </Btn>
      <Sep />

      {/* Inline formatting */}
      <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrito (Ctrl+B)">
        <Bold size={s} />
      </Btn>
      <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Itálico (Ctrl+I)">
        <Italic size={s} />
      </Btn>
      <Btn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Sublinhado (Ctrl+U)">
        <Underline size={s} />
      </Btn>
      <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
        <Strikethrough size={s} />
      </Btn>
      <Sep />

      {/* Lists */}
      <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
        <List size={s} />
      </Btn>
      <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
        <ListOrdered size={s} />
      </Btn>
      <Btn active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Checklist">
        <ListTodo size={s} />
      </Btn>
      <Sep />

      {/* Link */}
      <Btn
        active={editor.isActive('link')}
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run()
            return
          }
          const url = window.prompt('URL:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        title="Link (Ctrl+K)"
      >
        <Link2 size={s} />
      </Btn>
      <Sep />

      {/* Block elements */}
      <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citação">
        <Quote size={s} />
      </Btn>
      <Btn active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloco de código">
        <Code2 size={s} />
      </Btn>
      <Btn
        active={editor.isActive('callout')}
        onClick={() => editor.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'info' }, content: [{ type: 'text', text: ' ' }] }).run()}
        title="Callout"
      >
        <MessageSquare size={s} />
      </Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divisor">
        <Minus size={s} />
      </Btn>
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors/pipeline-toolbar.tsx
git commit -m "feat(pipeline): add configurable toolbar with full/compact presets"
```

---

### Task 6: Pipeline Editor Component (pipeline-editor.tsx)

The main component. Converts markdown→HTML on mount, wraps Tiptap useEditor, emits JSONContent.

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor.tsx`

**Dependencies:** Tasks 1 (marked), 2 (extensions), 3 (paste-sanitizer), 4 (CSS), 5 (toolbar)

- [ ] **Step 1: Write pipeline-editor.tsx**

```tsx
'use client'

import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import { useMemo, useEffect } from 'react'
import { parse } from 'marked'
import { getExtensions } from './pipeline-extensions'
import { PipelineToolbar } from './pipeline-toolbar'
import { transformPastedHTML } from './paste-sanitizer'
import './pipeline-editor.css'

export type { JSONContent }

export interface PipelineEditorProps {
  content: string | JSONContent | Record<string, unknown> | unknown[] | null
  isEditing: boolean
  onContentChange: (content: JSONContent) => void
  preset: 'full' | 'compact'
  placeholder?: string
}

export function isJSONContent(value: unknown): value is JSONContent {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'doc'
  )
}

export function contentToEditorInput(
  content: PipelineEditorProps['content'],
): JSONContent | string {
  if (!content) return ''
  if (typeof content === 'string') {
    if (!content.trim()) return ''
    return parse(content, { async: false }) as string
  }
  if (isJSONContent(content)) return content
  return ''
}

export function extractHeadings(content: JSONContent | null): string[] {
  if (!content?.content) return []
  return content.content
    .filter((node) => node.type === 'heading')
    .map((node) => node.content?.map((c) => c.text ?? '').join('') ?? '')
    .filter(Boolean)
}

export function PipelineEditor({
  content,
  isEditing,
  onContentChange,
  preset,
  placeholder,
}: PipelineEditorProps) {
  const extensions = useMemo(
    () => getExtensions(preset, { placeholder }),
    [preset, placeholder],
  )

  const initialContent = useMemo(() => contentToEditorInput(content), [])

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: isEditing,
    immediatelyRender: false,
    editorProps: {
      transformPastedHTML,
      attributes: {
        class: preset === 'compact' ? 'compact' : '',
      },
    },
    onUpdate: ({ editor: e }) => {
      onContentChange(e.getJSON())
    },
  })

  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing)
    }
  }, [editor, isEditing])

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const readingMin = Math.max(1, Math.round(wordCount / 200))

  if (!editor) return null

  return (
    <div className="pipeline-editor" data-readonly={!isEditing}>
      {isEditing && <PipelineToolbar editor={editor} preset={preset} />}
      <EditorContent editor={editor} />
      <div className="pipeline-editor-stats">
        <span>{wordCount} palavras · ~{readingMin} min leitura</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the barrel export**

No barrel needed — renderers import directly from `./editors/pipeline-editor`.

- [ ] **Step 3: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/editors/pipeline-editor.tsx
git commit -m "feat(pipeline): add PipelineEditor component with markdown conversion"
```

---

### Task 7: Draft Renderer Integration

Replace `<textarea>` with `<PipelineEditor preset="full">`. Keep SectionOutline (derived from JSONContent) and SeoWarning. Remove custom markdown parsing for edit mode.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/draft-renderer.tsx`

**Dependencies:** Task 6

**Key changes:**
- Lines 317-338 (editing block): replace textarea with PipelineEditor
- Lines 341-372 (read-only block): replace custom BlockRenderer with PipelineEditor `editable={false}`
- Keep SeoWarning, stats bar
- SectionOutline now derives headings from JSONContent instead of markdown blocks
- Much of the markdown parsing code (lines 31-149, 202-303) can be removed

- [ ] **Step 1: Rewrite draft-renderer.tsx**

Replace the entire file with:

```tsx
'use client'

import { useMemo, useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, isJSONContent, extractHeadings, contentToEditorInput, type JSONContent } from '../editors/pipeline-editor'

function extractDraftContent(content: RendererProps['content']): {
  body: string | JSONContent
  seo: Record<string, unknown> | null
  hasMisplacedSeo: boolean
} {
  if (typeof content === 'string') return { body: content, seo: null, hasMisplacedSeo: false }
  if (isJSONContent(content)) return { body: content, seo: null, hasMisplacedSeo: false }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    const body = (obj.body ?? '') as string | JSONContent
    const seo = obj.seo && typeof obj.seo === 'object' ? (obj.seo as Record<string, unknown>) : null
    return { body, seo, hasMisplacedSeo: seo !== null }
  }
  return { body: '', seo: null, hasMisplacedSeo: false }
}

function SeoWarning({ message }: { message: string }) {
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-[11px]"
      style={{
        background: 'color-mix(in srgb, var(--gem-warn) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--gem-warn) 25%, transparent)',
        color: 'var(--gem-warn)',
      }}
    >
      {message}
    </div>
  )
}

function SectionOutline({ headings }: { headings: string[] }) {
  if (headings.length < 2) return null

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-md px-3 py-2.5 mb-4"
      style={{ background: 'var(--gem-well)', border: '1px solid var(--gem-border)' }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-widest mr-1"
        style={{ color: 'var(--gem-dim)' }}
      >
        Seções
      </span>
      {headings.map((h, i) => (
        <span key={i} className="contents">
          {i > 0 && <span style={{ color: 'var(--gem-border)' }}>·</span>}
          <span
            className="text-[11px]"
            style={{ color: i === 0 ? 'var(--gem-accent)' : 'var(--gem-muted)' }}
          >
            {h}
          </span>
        </span>
      ))}
    </div>
  )
}

export function DraftRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const { body, seo, hasMisplacedSeo } = useMemo(() => extractDraftContent(content), [content])

  const headings = useMemo(() => {
    if (isJSONContent(body)) return extractHeadings(body)
    return []
  }, [body])

  const handleChange = useCallback(
    (json: JSONContent) => {
      if (seo) {
        onContentChange({ body: json, seo })
      } else {
        onContentChange(json)
      }
    },
    [seo, onContentChange],
  )

  const isEmpty =
    !body || (typeof body === 'string' && !body.trim()) || (isJSONContent(body) && !body.content?.length)

  if (!isEditing && isEmpty) {
    return (
      <div className="p-5 text-[11px] text-center py-8" style={{ color: 'var(--gem-dim)' }}>
        Nenhum rascunho ainda.
      </div>
    )
  }

  return (
    <div className="p-5">
      {hasMisplacedSeo && (
        <SeoWarning
          message={isEditing ? 'Dados SEO detectados nesta seção. Mova-os para a aba SEO.' : 'Dados SEO detectados nesta seção — verifique a aba SEO.'}
        />
      )}
      {!isEditing && <SectionOutline headings={headings} />}
      <PipelineEditor
        content={body}
        isEditing={isEditing}
        onContentChange={handleChange}
        preset="full"
        placeholder="Escreva o conteúdo do seu rascunho..."
      />
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "draft-renderer\|error" | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/draft-renderer.tsx
git commit -m "feat(pipeline): replace draft textarea with PipelineEditor"
```

---

### Task 8: Idea Renderer Integration

Replace `body` contentEditable with `<PipelineEditor preset="compact">`. Keep `premise` as contentEditable (single line). Keep metadata and cross-refs unchanged.

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/idea-renderer.tsx`

**Dependencies:** Task 6

- [ ] **Step 1: Rewrite idea-renderer.tsx**

Replace the entire file with:

```tsx
'use client'

import { useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, type JSONContent } from '../editors/pipeline-editor'

interface CrossRef {
  code: string
  title: string
  note: string
}

interface IdeaContent {
  premise: string
  body: string | JSONContent
  angle?: string
  vvs?: number
  validated_at?: string
  cross_refs?: CrossRef[]
}

function parseContent(content: RendererProps['content']): IdeaContent {
  if (typeof content === 'string') return { premise: '', body: content }
  if (Array.isArray(content) || content === null) return { premise: '', body: '' }
  return content as unknown as IdeaContent
}

export function IdeaRenderer({ content, isEditing, onContentChange }: RendererProps) {
  const data = parseContent(content)

  const handleBodyChange = useCallback(
    (json: JSONContent) => {
      onContentChange({ ...data, body: json })
    },
    [data, onContentChange],
  )

  return (
    <div className={`p-5 space-y-2 ${isEditing ? 'editing' : ''}`}>
      <div
        className="p-3 rounded-md"
        style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-done)' }}
      >
        {/* Premise — stays as single-line contentEditable */}
        <div
          className={`text-sm font-semibold mb-1 rounded px-1 -mx-1 ${
            isEditing
              ? 'hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-[var(--gem-accent)] focus:bg-[var(--gem-well)]'
              : ''
          }`}
          style={{ color: 'var(--gem-text)' }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) =>
            isEditing && onContentChange({ ...data, premise: e.currentTarget.innerText ?? '' })
          }
        >
          {data.premise || 'Sem título'}
        </div>

        {/* Body — PipelineEditor compact */}
        <div className="mt-1">
          <PipelineEditor
            content={data.body}
            isEditing={isEditing}
            onContentChange={handleBodyChange}
            preset="compact"
            placeholder="Descreva a ideia..."
          />
        </div>

        {/* Metadata */}
        <div
          className="flex gap-2 flex-wrap mt-1.5 text-[9px]"
          style={{ color: 'var(--gem-dim)' }}
        >
          {data.vvs != null && <span>VVS: {data.vvs}/100</span>}
          {data.angle && <span>Ângulo: {data.angle}</span>}
          {data.validated_at && (
            <span>Validado: {new Date(data.validated_at).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
      </div>

      {data.cross_refs && data.cross_refs.length > 0 && (
        <div
          className="p-3 rounded-md"
          style={{ background: 'var(--gem-well)', borderLeft: '3px solid var(--gem-accent)' }}
        >
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--gem-text)' }}>
            Cross-referências
          </div>
          <ul
            className="pl-3.5 m-0 text-[11px] space-y-0.5"
            style={{ color: 'var(--gem-muted)' }}
          >
            {data.cross_refs.map((ref, i) => (
              <li key={i}>
                <strong style={{ color: 'var(--gem-accent)' }}>{ref.code}</strong> {ref.title} —{' '}
                {ref.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "idea-renderer\|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/idea-renderer.tsx
git commit -m "feat(pipeline): replace idea body with PipelineEditor compact"
```

---

### Task 9: Generic Renderer Integration

Replace string textarea/contentEditable with `<PipelineEditor preset="compact">`. JSON objects stay as textarea (no change).

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/generic-renderer.tsx`

**Dependencies:** Task 6

- [ ] **Step 1: Rewrite generic-renderer.tsx**

Replace the entire file with:

```tsx
'use client'

import { useCallback } from 'react'
import type { RendererProps } from '../section-content'
import { PipelineEditor, type JSONContent, isJSONContent } from '../editors/pipeline-editor'

export function GenericRenderer({ content, isEditing, onContentChange }: RendererProps) {
  if (content === null) return null

  const handleChange = useCallback(
    (json: JSONContent) => onContentChange(json),
    [onContentChange],
  )

  if (typeof content === 'string' || isJSONContent(content)) {
    return (
      <div className="p-5">
        <PipelineEditor
          content={content}
          isEditing={isEditing}
          onContentChange={handleChange}
          preset="compact"
          placeholder="Escreva aqui..."
        />
      </div>
    )
  }

  const formatted = JSON.stringify(content, null, 2)

  return (
    <div className="p-5">
      {isEditing ? (
        <textarea
          value={formatted}
          onChange={(e) => {
            try {
              onContentChange(JSON.parse(e.target.value) as RendererProps['content'])
            } catch {
              /* keep current value until valid JSON */
            }
          }}
          className="w-full min-h-[200px] text-[11px] p-3 rounded-md resize-y font-mono"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-text)',
          }}
          spellCheck={false}
        />
      ) : (
        <pre
          className="text-[11px] p-3 rounded-md overflow-x-auto"
          style={{
            background: 'var(--gem-well)',
            border: '1px solid var(--gem-border)',
            color: 'var(--gem-muted)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {formatted}
        </pre>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type check**

```bash
cd apps/web && npx tsc --noEmit --pretty 2>&1 | grep -i "generic-renderer\|error" | head -20
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/pipeline/_components/detail/renderers/generic-renderer.tsx
git commit -m "feat(pipeline): replace generic string renderer with PipelineEditor compact"
```

---

### Task 10: Tests + Type Check + Visual Verification

**Files:**
- Create: `apps/web/test/unit/pipeline/pipeline-editor-utils.test.ts`

**Dependencies:** All previous tasks

- [ ] **Step 1: Write unit tests for utility functions**

```ts
import { describe, it, expect } from 'vitest'
import { isJSONContent, contentToEditorInput, extractHeadings } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-editor'

describe('isJSONContent', () => {
  it('returns true for valid Tiptap doc', () => {
    expect(isJSONContent({ type: 'doc', content: [] })).toBe(true)
  })

  it('returns false for plain string', () => {
    expect(isJSONContent('hello')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isJSONContent(null)).toBe(false)
  })

  it('returns false for array', () => {
    expect(isJSONContent([{ type: 'doc' }])).toBe(false)
  })

  it('returns false for object without type=doc', () => {
    expect(isJSONContent({ type: 'paragraph' })).toBe(false)
  })
})

describe('contentToEditorInput', () => {
  it('returns empty string for null', () => {
    expect(contentToEditorInput(null)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(contentToEditorInput('')).toBe('')
  })

  it('returns empty string for whitespace-only', () => {
    expect(contentToEditorInput('   ')).toBe('')
  })

  it('converts markdown to HTML string', () => {
    const result = contentToEditorInput('## Hello **world**')
    expect(typeof result).toBe('string')
    expect(result).toContain('<h2>')
    expect(result).toContain('<strong>')
    expect(result).toContain('world')
  })

  it('converts bullet list markdown', () => {
    const result = contentToEditorInput('- item 1\n- item 2')
    expect(typeof result).toBe('string')
    expect(result).toContain('<li>')
  })

  it('passes through JSONContent unchanged', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    expect(contentToEditorInput(doc)).toBe(doc)
  })

  it('returns empty string for non-doc objects', () => {
    expect(contentToEditorInput({ foo: 'bar' })).toBe('')
  })
})

describe('extractHeadings', () => {
  it('returns empty array for null', () => {
    expect(extractHeadings(null)).toEqual([])
  })

  it('returns empty array for doc with no headings', () => {
    expect(extractHeadings({ type: 'doc', content: [{ type: 'paragraph' }] })).toEqual([])
  })

  it('extracts heading text', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Section B' }] },
      ],
    }
    expect(extractHeadings(doc)).toEqual(['Section A', 'Section B'])
  })

  it('handles headings with mixed inline content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', text: 'world', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    expect(extractHeadings(doc)).toEqual(['Hello world'])
  })
})
```

- [ ] **Step 2: Run tests**

```bash
cd apps/web && npx vitest run test/unit/pipeline/pipeline-editor-utils.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Run full type check**

```bash
cd apps/web && npx tsc --noEmit --pretty
```

Expected: No errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: All existing tests still pass.

- [ ] **Step 5: Commit tests**

```bash
git add apps/web/test/unit/pipeline/pipeline-editor-utils.test.ts
git commit -m "test(pipeline): add unit tests for pipeline editor utilities"
```

- [ ] **Step 6: Visual verification**

Start the dev server and verify in the browser:

```bash
cd apps/web && npm run dev
```

Open `localhost:3000/cms/pipeline/items/<any-item-id>` and verify:

1. **Draft tab (Rascunho):** Rich text editor with full toolbar (undo/redo, headings, bold/italic, lists, links, blockquote, code, callout, divider). Content renders formatted, not as raw markdown.
2. **Idea tab (Ideia):** Premise still renders as a simple editable line. Body shows compact PipelineEditor (bold, italic, lists, links only).
3. **Generic sections:** String content shows in compact PipelineEditor. JSON content still shows in textarea.
4. **Edit toggle:** Clicking "Editor" checkbox enables/disables editing. Toolbar appears/disappears.
5. **Save:** After editing, clicking Save persists content. Reload shows saved content.
6. **Read-only:** With editing off, content renders styled (headings have accent border, blockquotes have gradient, etc).
7. **Section outline:** On Draft tab with 2+ headings, section navigation bar appears above the editor.
8. **Stats:** Word count and reading time show below the editor.
