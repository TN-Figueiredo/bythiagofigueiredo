# Pipeline ↔ Blog i18n Integration

**Date:** 2026-05-11
**Status:** Draft
**Scope:** 3 features: prompt generator for 2nd language, pipeline search in blog editorial/new post, flag toggle locale selector in blog editor

## Context

The pipeline ↔ blog linking system is complete (15 tasks, 100/100 quality). Three integration gaps remain:

1. **Adding a 2nd language to a pipeline item** requires manual prompt writing for Claude Code. No UI generates the prompt.
2. **Creating a blog post from a pipeline item** requires navigating to the pipeline board, finding the item, and using "Graduate". There's no way to search pipeline items from the Posts page.
3. **Locale management in the blog editor** is buried in the ⋯ MoreMenu. Adding a second language isn't visible. Switching between locales requires a menu click instead of a direct toggle.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Prompt delivery | Copy-to-clipboard textarea | User edits prompt before pasting into Claude Code |
| Pipeline search scope | Editorial tab + New Post page | Both entry points serve different workflows |
| Locale UI | Flag toggle replacing LocalePill | Direct, visible, consistent with pipeline gem colors |
| Prompt content | Context + sections (truncated) + actionable instructions | Claude Code needs specific action paths, not generic "update via API" |
| Search result creation | Click → create directly (no confirmation) | Low-friction; toast with "Abrir →" provides undo-like escape |

## 1. Prompt Generator for 2nd Language

### Purpose

When a pipeline item has content in one language (PT or EN), generate a pre-filled prompt for Claude Code that includes the item's context, current content, and specific instructions to create the missing language version.

### Trigger Points

The "Add [missing language]" button appears wherever the pipeline item's language state is visible:
- Pipeline item detail page — in the language section of the sidebar
- Blog editor toolbar — in the flag toggle (Design 3), as a secondary action on the "+ EN/PT" button

### Modal Spec

**Component:** `PromptGeneratorModal`

**Props:**
```typescript
interface PromptGeneratorModalProps {
  item: {
    id: string
    code: string
    format: string
    stage: string
    priority: number
    language: 'pt-br' | 'en' | 'both'
    title_pt: string | null
    title_en: string | null
  }
  sections: Array<{
    section_type: string
    language: string
    content: string
  }>
  targetLocale: 'pt-br' | 'en'
  onClose: () => void
}
```

**Layout (top to bottom):**

1. **Header** — format icon (from `getFormatIcon`) + "Adicionar versão [English/Português]" + item metadata (code, stage badge, priority badge, "N seções · PT → EN" summary). Close button (✕).

2. **Prompt textarea** — `<textarea>` with monospace font, pre-filled with generated prompt. User can edit before copying. Max-height 200px with overflow scroll.

3. **Footer info** — left: "N seções incluídas (conteúdo > 500 chars truncado)" · right: "~X palavras" word count.

4. **Workflow hint** — indigo box: "💡 Cole no Claude Code — Edite se precisar → Copie → Cole no Claude Code → Item será atualizado para PT+EN"

5. **Actions** — "📋 Copiar prompt" (primary, copies to clipboard + sonner toast "Prompt copiado") + "Cancelar" (secondary).

### Prompt Template

```
# Contexto
Pipeline item {code} ({format}, stage: {stage}, P{priority})
Possui apenas versão {current_lang}.
Item ID: {id}
title_{target}: (vazio)

# Conteúdo {current_lang_label}

Título: {title}
Hook: {hook}
Synopsis: {synopsis}

# Seções ({count})

{section_type}: {content (truncated at 500 chars with "...")}
...

# Instruções
Crie a versão {target_lang_label} deste item de {format}.
Adapte para audiência {target_audience} — não traduza literalmente.
Tom narrativo e pessoal.

# O que atualizar
Use updatePipelineItem() server action:
- title_{target_suffix}: título adaptado
- language: "both"

Use PATCH /api/pipeline/items/{id}/sections:
- Crie seções _{target_suffix} (rascunho_{target_suffix}, seo_{target_suffix})
- Mantenha seções _shared intactas

[Adicione instruções extras aqui]
```

**Content truncation:** Sections with content longer than 500 characters are truncated with `...` appended. The footer shows a note when truncation occurred. Target: keep total prompt under ~500 words.

**Title field awareness:** The prompt explicitly shows `title_{target}: (vazio)` so Claude Code knows the field exists but is empty.

### Data Fetching

The modal needs sections data. Fetch via existing `GET /api/pipeline/items/{id}/sections` endpoint on modal open. Loading state: spinner in the textarea area.

## 2. Pipeline Search in Blog Editorial & New Post

### 2A. Editorial Tab — Pipeline Search Bar

**Location:** Top-right of the editorial tab, between the existing search input and the "+ New idea" button.

**Component:** `PipelineSearchInput`

**Visual:**
- Input with 📋 icon prefix and placeholder "Criar do pipeline... (código ou título)"
- Indigo border when focused
- Min-width: 240px
- Dropdown results appear below on input (debounced 300ms, min 2 chars)

**Search results dropdown:**

Each result row shows:
- Format icon (📝 Blog, 🎬 Video, 📰 Newsletter, 🎓 Course, 📢 Campaign) via `getFormatIcon()`
- Code (monospace, indigo)
- Language badge (PT=green, EN=blue)
- Priority badge (P1-P5 with tier color)
- Stage badge
- Title (primary text)
- Hook preview (secondary text, 1-line clamp)

**Linked items:** Shown with `opacity: 0.4`, `cursor: not-allowed`, text "→ vinculado a '[post title]'" instead of the normal metadata row. Not clickable.

**Empty state:** "Nenhum item encontrado" + hint "Busque por código (ex: tg-01) ou título".

**Keyboard navigation:** Arrow keys move selection, Enter selects, Escape closes dropdown.

**Click behavior:** Click on an available result → immediately creates a blog post via `createPost()` with:
- `status: 'idea'`
- `locale`: from pipeline item's language (`pt-br` → 'pt-br', `en` → 'en', `both` → site's `defaultLocale`)
- `title`: from `title_pt` or `title_en` (matching the locale)
- After creation: call `linkPostToItem(postId, itemId)` to establish the pipeline↔blog link

**Post-creation:**
- Sonner toast (bottom-right, standard position): "Post criado a partir de {code}" with "Abrir →" action link to `/cms/blog/{id}/edit`
- New card appears in the "Ideia" column with indigo highlight border for 3 seconds
- Search input clears and dropdown closes

### 2B. New Post Page — "Do Pipeline" Source

**Location:** `/cms/blog/new` page, as an inline section above the existing form fields.

**Component:** `PipelineSourcePicker`

**Flow (3 steps, all inline on same page):**

**Step 1 — Source selector:**
Two cards side by side:
- ✏️ "Em branco" (default, existing behavior)
- 📋 "Do Pipeline" (reveals steps 2-3 when selected)

Selecting "Em branco" hides steps 2-3 and shows the normal new post form.

**Step 2 — Pipeline item search:**
Same `PipelineSearchInput` component reused from editorial tab, but in "select" mode (click selects item into a card instead of creating a post).

Selected item card shows:
- Format icon + code + language + stage badges
- Title + hook preview
- "✕ trocar" button to deselect and search again
- "Será copiado:" section listing: título → title, hook → excerpt, body → content_mdx, pipeline link

**Step 3 — Locale picker:**
Two cards (generated from `supportedLocales`, not hardcoded):
- 🇧🇷 Português
- 🇺🇸 English

Pre-selected based on pipeline item's language:
- `pt-br` → PT pre-selected
- `en` → EN pre-selected
- `both` → site's `defaultLocale` pre-selected

Note below: "Pré-selecionado pelo idioma do pipeline item · Opções vêm de supportedLocales"

**Create button:** "Criar post a partir de {code}" + "Cancelar" button beside it.

**On create:**
- Calls `createPost()` with selected locale, status 'idea'
- Copies: `title_pt/en` → translation `title`, `hook` → `excerpt`, section body_content → `content_mdx`
- Calls `linkPostToItem(postId, itemId)` for pipeline↔blog link
- Redirects to `/cms/blog/{id}/edit`

**Data NOT copied:**
- Synopsis is NOT copied (no matching blog field)
- Tags are NOT copied (tag systems are independent)
- Pipeline sections stay in pipeline (only body content is used for content_mdx)

### Shared Search Action

Both 2A and 2B use the same server action:

```typescript
// blog/actions.ts (moved from blog/[id]/edit/actions.ts)
export async function searchPipelineItems(
  siteId: string,
  query: string,
): Promise<SearchResult[]>

interface SearchResult {
  id: string
  code: string
  title: string
  format: string
  stage: string
  language: 'pt-br' | 'en' | 'both'
  priority: number
  hook: string | null
  blog_post_id: string | null
  linked_post_title: string | null  // NEW: title of linked post for "vinculado a" display
}
```

Enhancement needed: the existing `searchPipelineItems` must also return `language`, `priority`, `hook`, and `linked_post_title` (via join on `blog_posts` → `blog_translations`).

The action currently lives in `blog/[id]/edit/actions.ts`. Move to `blog/actions.ts` since it's now used from multiple pages (editorial tab + new post), not just the edit page.

## 3. Flag Toggle + Locale Picker in Blog Editor

### Purpose

Replace the existing `LocalePill` (static badge) and MoreMenu locale options with a visible, interactive flag toggle in the editor toolbar.

### Component: `LocaleToggle`

**Replaces:** `LocalePill` component (lines 274-283 of `post-edition-editor.tsx`)

**Props:**
```typescript
interface LocaleToggleProps {
  currentLocale: string
  existingLocales: string[]
  supportedLocales: string[]
  isPostPersisted: boolean  // false for unsaved new posts
  isSaving: boolean
  onSwitchLocale: (locale: string) => void
  onAddLocale: (locale: string) => void
}
```

### 4 Visual States

**State 0 — New post (not yet saved):**
- Shows only the flag of the current locale (e.g. 🇧🇷 PT with green background)
- No "+" button — post must be saved first to add a second locale
- `isPostPersisted = false`

**State 1 — Single locale (post saved):**
- Active flag badge (🇧🇷 PT green, or 🇺🇸 EN blue)
- "+" button with dashed indigo border showing the missing locale's flag (e.g. "🇺🇸 + EN")
- Click "+" → calls `onAddLocale(missingLocale)` which:
  1. Saves current content (auto-save)
  2. Calls existing `addLocale()` action
  3. Switches to the new locale
  4. Shows loading state during transition

**State 2 — Dual locale (both exist):**
- Both flag badges visible side by side
- Active locale has colored background (PT=green, EN=blue)
- Inactive locale has transparent background, dimmed text
- Click inactive → calls `onSwitchLocale(locale)` which:
  1. Saves current content (auto-save)
  2. Loads the other locale's translation
  3. Shows loading state during transition
- No "+" button (both locales exist)

**State 3 — Loading (switching):**
- Toggle is disabled (pointer-events: none, opacity: 0.5)
- Editor content area shows overlay: semi-transparent background + spinner + "Carregando versão [EN/PT]..."
- If save fails before switch: toast error "Erro ao salvar. Troca de idioma cancelada.", toggle reverts

### Colors

Consistent with pipeline gem cards:
- PT: `#10b981` (green) — background: `rgba(16,185,129,0.1)`
- EN: `#3b82f6` (blue) — background: `rgba(59,130,246,0.1)`

### MoreMenu Changes

**Remove from MoreMenu:**
- "Change to [locale]" options — replaced by toggle click
- "Add [locale]" option (if it exists) — replaced by "+" button on toggle

**Keep in MoreMenu:**
- "Remove this locale" — destructive action stays in menu (not prominently displayed)
- All other existing options unchanged

### Integration with PostEditionEditor

The `LocaleToggle` is rendered in the toolbar at the same position where `LocalePill` currently sits (line ~1074 of `post-edition-editor.tsx`). The `handleChangeLocale` function (lines 895-904) is reused as `onSwitchLocale`. The `addLocale` action is called from `onAddLocale` followed by `handleChangeLocale`.

## 4. File Changes

### New Files (4)

| File | LOC | Purpose |
|------|-----|---------|
| `pipeline/_components/prompt-generator-modal.tsx` | ~120 | Modal with textarea, prompt generation, copy-to-clipboard. Used from pipeline detail + blog editor. |
| `blog/_shared/pipeline-search-input.tsx` | ~100 | Reusable search input + dropdown (used by editorial tab + new post) |
| `blog/new/pipeline-source-picker.tsx` | ~80 | Source selector + item card + locale picker for new post page |
| `blog/_shared/locale-toggle.tsx` | ~70 | Flag toggle component replacing LocalePill |

### Modified Files (6)

| File | Changes |
|------|---------|
| `blog/_tabs/editorial/editorial-tab.tsx` | Import + render `PipelineSearchInput` in top bar; add `onPostCreated` callback for optimistic kanban update |
| `blog/new/post-edition-editor.tsx` | Replace `LocalePill` with `LocaleToggle`; remove `changeLocaleTargets`/`onChangeLocale` from MoreMenu props; add loading overlay state |
| `blog/new/page.tsx` (new post page) | Import + render `PipelineSourcePicker`; pass `supportedLocales` and `defaultLocale` |
| `blog/actions.ts` | Move + enhance `searchPipelineItems` (add language, priority, hook, linked_post_title); add `createPostFromPipeline()` server action |
| `_shared/editor/more-menu.tsx` | Remove `changeLocaleTargets`/`onChangeLocale` props and menu items; keep `canRemoveLocale`/`onRemoveLocale` |
| `pipeline/_components/pipeline-item-detail.tsx` | Add "Adicionar versão [EN/PT]" button in language section; opens `PromptGeneratorModal` |

### Removed

| Item | Reason |
|------|--------|
| `LocalePill` component (inline in post-edition-editor.tsx) | Replaced by `LocaleToggle` |
| `searchPipelineItems` in `blog/[id]/edit/actions.ts` | Moved to `blog/actions.ts` |

**Total: 4 new + 6 modified = 10 files touched, ~650 estimated LOC**

## 5. Server Action: `createPostFromPipeline`

New server action that encapsulates the full "create post from pipeline item" flow:

```typescript
export async function createPostFromPipeline(
  siteId: string,
  pipelineItemId: string,
  locale: string,
): Promise<{ ok: true; postId: string } | { ok: false; error: string }>
```

**Steps:**
1. Fetch pipeline item (validate exists, not archived, not already linked)
2. Fetch item's sections (for body content)
3. Determine title from `title_pt` or `title_en` based on locale
4. Determine excerpt from item's `hook` field
5. Find body content from sections (first section with `body` or `rascunho` in type)
6. Call existing `createPost()` with locale, title, excerpt, content_mdx
7. Call `linkPostToItem(postId, pipelineItemId)` to establish link
8. Return `{ ok: true, postId }`

This action is called from both the editorial tab search and the new post "Do Pipeline" flow.

## 6. Error Handling

| Scenario | Behavior |
|----------|----------|
| Pipeline search fails | Toast: "Erro ao buscar pipeline". Dropdown closes. |
| Pipeline item already linked | Result shown dimmed with "→ vinculado a [title]". Not clickable. |
| Post creation fails | Toast: "Erro ao criar post". Search stays open for retry. |
| Prompt copy fails (clipboard API) | Toast: "Erro ao copiar. Selecione manualmente." Textarea stays visible. |
| Locale add fails | Toast: "Erro ao adicionar idioma." Toggle reverts to single-locale state. |
| Auto-save fails before locale switch | Toast: "Erro ao salvar. Troca de idioma cancelada." Switch aborted, editor stays on current locale. |
| Sections fetch fails (prompt modal) | Show error in textarea area: "Erro ao carregar seções. Tente novamente." with retry button. |

## 7. Visual References

Mockups in `.superpowers/brainstorm/89167-1778532544/content/`:
- `design-1-final.html` — Prompt generator modal (v4 final)
- `design-2a-final.html` — Editorial tab pipeline search (final)
- `design-2b-final.html` — New post "Do Pipeline" source (final)
- `design-3-final.html` — Flag toggle + locale management (final)
