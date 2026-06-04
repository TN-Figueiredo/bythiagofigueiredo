# Blog Post Editor — Complete Rewrite Design

**Date:** 2026-06-04
**Status:** Draft
**Scope:** Blog post editor only (editorial kanban, other CMS modules out of scope)
**Source:** `design_handoff_blog_editor/` — high-fidelity prototype with reference JSX, CSS, and data mocks

## Context

The current blog editor (`post-edition-editor.tsx`, 1427 lines) is a monolithic component with 23+ useState variables, no stage-based workflow, and a linear scroll layout. The design handoff specifies a fundamentally different UX: a **stage-based canvas** (Ideia → Rascunho → Imagens → SEO → Publicação) with an **inspector sidebar**, **focus mode**, **publish gate**, and **inline image blocks**. This rewrite unifies the "pipeline item" and "blog post" concepts — the pipeline item IS the post.

Posts support independent **PT-BR and EN versions** (not auto-translations), and published posts can be **edited and re-published** with an "updated" indicator.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Strategy | Complete rewrite | Clean break from monolith, pixel-accurate handoff fidelity |
| Rich text editor | Keep TipTap 100% | All extensions preserved (callouts, toggles, columns, embeds, tables, etc), full power retained, only toolbar UI adapts |
| Image blocks | Hybrid — placeholders in TipTap + MediaGallery + Images tab dashboard | Best of both: contextual placeholders in body, existing gallery for selection, centralized dashboard for overview |
| Architecture | useReducer + Context | React-pure, consistent with CMS, no new deps, natural for state machines |

## Architecture

### Component Tree

```
BlogEditorShell (EditorProvider context + layout)
├── ActionBar (breadcrumb, lang toggle, status badge, focus toggle, save)
├── StageBar (5 segmented tabs — hidden in focus mode)
├── MainGrid (grid-template-columns: minmax(0,1fr) 340px)
│   ├── DocumentCanvas (max-width 720px centered, stage-routed content)
│   │   ├── StageIdeia (read-only briefing: hook, synopsis, editable title)
│   │   ├── StageRascunho (TipTap editor + inline image blocks)
│   │   ├── StageImagens (cover + inline image dashboard)
│   │   ├── StageSeo (meta fields + SERP preview)
│   │   └── StagePublicacao (publish gate + actions + update flow)
│   └── Inspector (sidebar — hidden in focus mode, drawer on mobile)
│       ├── InspDetalhes (slug, excerpt, category, tags)
│       ├── InspDistribuicao (status, URL, dates, update button)
│       ├── InspHistorico (stage transitions timeline)
│       └── InspArquivar (archive action)
└── FocusModePill (floating exit pill + Esc)
```

### State Model (useReducer)

```typescript
interface EditorState {
  postId: string | null          // null = ephemeral (not yet created)
  code: string                   // pipeline code, e.g. "tg-07"
  activeStage: Stage             // "ideia" | "rascunho" | "imagens" | "seo" | "publicacao"
  activeLang: "pt" | "en"
  focus: boolean
  content: Partial<Record<"pt" | "en", VersionContent>>  // only existing versions
  shared: SharedFields
  saveStatus: SaveStatus
}

interface VersionContent {
  title: string
  slug: string
  slugTouched: boolean
  excerpt: string
  body: JSONContent                // TipTap JSON
  bodyHtml: string                 // compiled HTML
  published: boolean
  publishedAt: string | null
  updatedAt: string | null
  dirty: boolean                   // edited since last publish
  coverImageUrl: string | null
  coverReady: boolean
  metaTitle: string
  metaDesc: string
  ogImageUrl: string | null
  words: number
  readTime: string
  titleAlts: string[]
}

interface SharedFields {
  status: PostStatus             // idea|draft|ready|scheduled|published|archived
  category: string | null
  tagId: string | null
  tags: string[]
  hashtags: string[]
  hook: string
  synopsis: string
  priority: string
  previousPostId: string | null
  continuesInNext: boolean
  keyPoints: string[]
  pullQuote: string
  notes: string[]
  colophon: string
  history: Array<{ to: string; date: string }>
}

type Stage = "ideia" | "rascunho" | "imagens" | "seo" | "publicacao"
type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline"
```

**Derived (computed, not stored):**
- `deriveSlug(title)` — slug from title
- `publishGate(state, lang)` — { passed: boolean, checks: Check[] }
- `isEmptyVersion(version)` — no title + no body + no excerpt + not published
- `imageStats(body, coverReady)` — { done: number, total: number }

### Reducer Actions

```typescript
type EditorAction =
  // Navigation
  | { type: "SET_STAGE"; stage: Stage }
  | { type: "SET_LANG"; lang: "pt" | "en" }
  | { type: "TOGGLE_FOCUS" }
  // Content
  | { type: "SET_TITLE"; title: string }
  | { type: "SET_BODY"; body: JSONContent; html: string; words: number; readTime: string }
  | { type: "SET_SLUG"; slug: string; touched: boolean }
  | { type: "SET_EXCERPT"; excerpt: string }
  | { type: "SET_COVER"; url: string | null; ready: boolean }
  | { type: "SET_FIELD"; field: keyof VersionContent; value: any }
  // Shared
  | { type: "SET_SHARED"; field: keyof SharedFields; value: any }
  // Images
  | { type: "SET_IMAGE_STATUS"; imageId: string; status: "pending" | "done" }
  // Versions
  | { type: "ADD_VERSION"; lang: "pt" | "en" }
  | { type: "REMOVE_VERSION"; lang: "pt" | "en" }
  // Publishing
  | { type: "PUBLISH"; lang: "pt" | "en" }
  | { type: "UPDATE_PUBLISHED" }
  | { type: "MARK_DIRTY" }
  | { type: "CLEAR_DIRTY" }
  // Save
  | { type: "SET_SAVE_STATUS"; status: SaveStatus }
  // Init
  | { type: "INIT"; state: EditorState }
```

## Layout

### Action Bar (`.ed-bar`)

Sticky `position: sticky; top: 0`, blurred background `backdrop-filter: blur(14px)`.

| Region | Elements |
|--------|----------|
| Left | Back button + "Blog" breadcrumb + post code (`tg-07`) |
| Center | Spacer |
| Right | Language toggle · Status badge · Focus toggle · **Salvar** button |

### Stage Bar (`.ed-stages`)

5-segment pill bar: **Ideia · Rascunho · Imagens · SEO · Publicação**

- Free navigation — no locks between stages
- Hidden in Focus mode
- Each tab has an icon (Lucide: Lightbulb, Edit, Image, Search, Upload)
- Imagens tab shows amber dot when images are pending
- Active tab: `background: var(--accent-soft); color: var(--accent)`

### Two-Column Grid

```css
.main-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 0;
}
```

- **Left = Document Canvas** — `max-width: 720px`, centered. Content depends on active stage.
- **Right = Inspector** — `background: var(--elev)`. Cards: Detalhes, Distribuição, Histórico, Arquivar.
- **Responsive:** Below 1080px, collapses to single column. Inspector becomes bottom-sheet drawer (swipe up, handle visible).
- **Focus mode:** Inspector hidden, canvas expands to 760px, stage bar hidden.

## Stage Content

### Ideia (Read-Only Briefing)

- Hook label + hook text (19px)
- Synopsis label + synopsis
- Editable title (`.doc-title`, 38px / 600 weight)
- Meta line (language flag, category, read time, word count)
- Data sourced from pipeline item fields (`hook`, `synopsis`)

### Rascunho (Primary Writing Surface)

- Editable `.doc-title` (38px, 600 weight, -1px tracking, 1.1 line-height)
- Meta line: language flag · category (color dot) · read time · word count
- **Writing toolbar**: Reskinned version of existing `editor-toolbar.tsx` — slim, borderless, matching handoff aesthetics. Shows most-used buttons (B, i, H₂, quote, list, link, image) directly; advanced actions (callout, toggle, columns, CTA, embed, table, merge tag, playlist) remain accessible via TipTap slash commands (`/`) and existing bubble menu on text selection. No functionality removed.
- Editable body (17px / 1.78 line-height)
- Inline `BlogImageBlock` nodes (see Image Blocks section)

### Imagens (Dashboard)

- Summary bar: `done/total imagens prontas` + breakdown "1 capa · N conteúdo"
- When all done: green checkmark "Tudo pronto"
- When pending: amber "Verificar pendente" button (scrolls to first incomplete)
- **Cover section** (1200×675): thumbnail + status + Galeria/Upload/Trocar
- **Content images section**: rows for each `BlogImageBlock` in body
  - Each row: thumbnail (64×64), img-ID, status badge, alt text (editable inline), paragraph position
  - Actions: Galeria / Trocar / → (navigate to block in Rascunho)
- **Navigation link** (`→`): switches to Rascunho stage, scrolls to + highlights the block (600ms fade-out)
- **Hint**: "Imagens vêm dos blocos do rascunho. Adicione ou remova no editor de Rascunho."

### SEO

- **Meta título** input with char counter (ideal 40–60)
- **Meta descrição** textarea with char counter (ideal 120–160)
- **Google SERP preview** (`.serp`): URL `/blog/<lang>/<slug>`, rendered title, rendered description
- Compact header: mono kicker `SEO · PT-BR`, small subtitle with current title (20px)
- Reuses existing SEO metadata fields from `blog_translations`

### Publicação

- **Título** (read-only mirror of draft title)
- **Title alternatives** (`.title-alt` chips — testable variants)
- **Descrição** textarea (excerpt)
- **Tags** display (chip list)
- **Publish gate** (see Publish Gate section)
- **Publish actions**:
  - Not published: `Agendar` | `Publicar` — disabled if gate fails
  - Published + clean: "Ver post no site" + "Compartilhar nas redes"
  - Published + dirty: Update box "Alterações não publicadas" + "Atualizar no site" + dates

## Image Blocks System

### TipTap Extension: `BlogImageExtension`

Custom TipTap node (`blogImage`) extending base Image with:

**Node attributes:**
- `id: string` — sequential ref (img-1, img-2, etc.)
- `src: string | null` — CDN URL when assigned
- `alt: string` — alt text for SEO/accessibility
- `caption: string` — visible caption (separate from alt)
- `status: "empty" | "uploading" | "processing" | "done"` — drives rendering
- `alignment: "column" | "wide" | "full"` — width mode
- `width: number | null` — explicit width override
- `assetId: string | null` — media_assets FK for usage tracking

### States & Transitions

```
empty → uploading → processing → ready
  ↑         ↓            ↓          ↕
  +----- error ----+     error    swapping
```

**Empty:** Dashed border placeholder, badge (img-N), "Clique para adicionar imagem", alt text warning, Galeria + Upload buttons. Drop zone with pulse animation on drag-over.

**Uploading:** Solid border, spinner, filename + size, progress bar (determinate if available), cancel link.

**Processing:** Blue-tinted border + spinner, "Processando...", step indicators (Upload ✓ → EXIF strip ✓ → Dedup → CDN). Backend pipeline: EXIF strip (LGPD) → SHA-256 dedup → Vercel Blob upload.

**Ready (done):** Full image display with:
- Badge overlay (img-N) with dark backdrop
- Resize handles (left/right, 4px accent bars, visible on hover)
- Hover toolbar: [Column | Wide | Full] | [Replace | Delete] | [More ⋯]
- Caption/alt toggle (Ghost pattern): shared text area, "Alt" button toggles between caption and alt text, amber dot when alt is empty
- Width mode gating: Wide requires ≥ 900px natural, Full requires ≥ 1200px natural

**Swapping:** Via Gallery — modal opens, current image stays visible, crossfade on selection (200ms). Via Upload — dark overlay on current image with spinner, crossfade on completion.

**Error:** Red border, alert icon, error message (file too large / format unsupported / network error), filename shown, "Tentar novamente" + "Escolher outro" buttons.

**Broken (CDN 404):** Image-off icon, "Imagem indisponível", "Substituir" + "Re-upload" buttons. Caption/alt remain editable.

### Snap-to-Peer Resize (Linear Pattern)

When resizing, if width comes within ±20px of another `blogImage` in the same post, snaps magnetically. Brief blue guideline flash (600ms). Tooltip shows current width + "snapped" indicator. Respects `prefers-reduced-motion`.

### MediaGallery Integration

- Opens existing `MediaGalleryModal` with `folder: 'blog'`, `cropPreset: 'free'`
- On selection: `updateAttributes({ src: asset.url, status: 'done', assetId: asset.id })`
- Tracks usage: `trackMediaUsageAction(assetId, 'blog_translation', translationId, 'content_inline')`
- Cover uses `cropPreset: 'blog-cover'` (16:9, 1200×675)

## Core Behaviors

### One Title → Derived Slug

- `.doc-title` (contentEditable H1) is the single source of truth
- `deriveSlug(title)`: lowercase, strip accents/quotes, non-alphanumerics → `-`, trim, max 60 chars
- Auto-derivation stops when user manually edits slug (`slugTouched: true`)
- Inspector's Detalhes card shows slug prefixed with `/blog/<lang>/`
- "↻ regenerar do título" link re-syncs

### Language Versions (PT-BR / EN)

- Post starts with one language (creation language)
- Single version: label (e.g., `🇧🇷 PT-BR`) + discreet `+ EN` affordance
- Two versions: real toggle with two segments
- **Adding EN:** Click `+ EN` → creates fresh, empty EN version, context swaps entirely
- **Removing a version:**
  - Hover reveals `×` button
  - If empty (`isEmptyVersion()`): removes instantly
  - If has content or is published: confirmation popover warns
  - Last remaining version can never be removed

### Publish Gate

Single lock, evaluated on Publicação stage. `publishGate(state, lang)` returns:

**Required:**
- **Título** — non-empty
- **Conteúdo** — body has text content
- **Imagens** — cover ready + all inline `blogImage` nodes have status "done"

**Display:**
- Unmet: `.gate-box` with amber background, failing items as red clickable chips (navigate to relevant stage), Agendar/Publicar buttons disabled
- Passed: green box, all chips green, buttons enabled

### Updating a Published Post

- Editing any field of a published version sets `dirty = true`
- Status badge: **Publicado** (green) → **Alterações pendentes** (amber)
- Publicação stage: update box "Alterações não publicadas" + "Atualizar no site" button + dates
- Re-publishing: clears `dirty`, stamps `updatedAt`, public front-end shows "Atualizado em" indicator
- Inspector Distribuição card mirrors: status, URL, dates, update button while dirty

### Focus Mode

- Toggle hides stage bar + inspector
- Canvas widens to 760px
- Floating `.focus-exit` pill at bottom + **Esc** key to exit
- Focus toggle button highlighted in action bar when active

### Free Stage Navigation

- Any stage tab clickable at any time — no locks
- No readiness meter or checklist (publish gate is the only lock)
- Cross-stage navigation: Images tab → button navigates to Rascunho with scroll + highlight

## Inspector Cards

### Detalhes

- **Slug**: prefix `/blog/<lang>/` + editable value + "↻ regenerar do título"
- **Descrição**: textarea (auto-growing, seeds from excerpt)
- **Categoria**: selector with color dot
- **Tags**: chip list with `+ tag` affordance

### Distribuição

- **Status indicator**: dot + label (Não publicado / Publicado / Alterações pendentes)
- **URL**: full path when published
- **Dates**: Publicado em / Atualizado em
- **Images**: done/total count
- **SEO**: status
- **Update button**: visible when dirty + published

### Histórico

- Timeline of stage transitions: dot + label + relative date
- Sourced from `history` array

### Arquivar

- Single "Arquivar post" button with archive icon
- Hover: danger color
- Requires confirmation

## Data Model Mapping

### Existing DB → New Editor State

| DB Field (blog_posts / blog_translations) | Editor State Path |
|-------------------------------------------|-------------------|
| `blog_posts.status` | `shared.status` (mapped to stage) |
| `blog_posts.cover_image_url` | `content[lang].coverImageUrl` |
| `blog_posts.category` | `shared.category` |
| `blog_posts.tag_id` | `shared.tagId` |
| `blog_translations.title` | `content[lang].title` |
| `blog_translations.slug` | `content[lang].slug` |
| `blog_translations.excerpt` | `content[lang].excerpt` |
| `blog_translations.content_json` | `content[lang].body` |
| `blog_translations.content_html` | `content[lang].bodyHtml` |
| `blog_translations.meta_title` | `content[lang].metaTitle` |
| `blog_translations.meta_description` | `content[lang].metaDesc` |
| `blog_translations.og_image_url` | `content[lang].ogImageUrl` |
| `blog_translations.reading_time_min` | `content[lang].readTime` |
| `blog_translations.key_points` | `shared.keyPoints` |
| `blog_translations.pull_quote` | `shared.pullQuote` |
| `blog_translations.notes` | `shared.notes` |
| `blog_translations.colophon` | `shared.colophon` |

### No DB Schema Changes Required

The existing `blog_posts` + `blog_translations` tables fully support the new editor. Client-side computed fields:
- `dirty` — true if any field changed since `publishedAt` timestamp
- `slugTouched` — persisted in local editor state (reset on fresh load, set on manual slug edit)
- `coverReady` — computed as `coverImageUrl !== null`
- `words` / `readTime` — computed on each body change via `compileJsonContent()`

No migrations needed.

### Route Migration

New route: `/cms/blog/[id]/editor/` (the stage-based editor). Old route `/cms/blog/[id]/edit/` remains temporarily as fallback. Editorial kanban links updated to point to `/editor/`. Old route removed after validation period.

## Reusable Components from Current Codebase

| Component | Current Path | Reuse |
|-----------|-------------|-------|
| TipTapEditor + all extensions | `_shared/editor/tiptap-editor.tsx` | Full reuse, adapt toolbar UI |
| All custom TipTap nodes | `_shared/editor/*-node.tsx` | Full reuse (callout, CTA, columns, embed, toggle, merge tag, playlist) |
| useAutosave hook | `_shared/editor/use-autosave.ts` | Full reuse with mode switching |
| AutosaveIndicator | `_shared/editor/autosave-indicator.tsx` | Full reuse |
| SaveBar | `_shared/editor/save-bar.tsx` | Full reuse |
| NavigationGuard | `_shared/editor/navigation-guard.tsx` | Full reuse |
| MediaGalleryModal | `_shared/media/media-gallery-modal.tsx` | Full reuse |
| MediaCropEditor | `_shared/media/media-crop-editor.tsx` | Full reuse |
| useMediaGallery hook | `_shared/media/use-media-gallery.ts` | Full reuse |
| SlashCommands | `_shared/editor/slash-commands.tsx` | Full reuse |
| BubbleMenu | `_shared/editor/bubble-menu.tsx` | Full reuse |
| StructuredFields | `blog/_shared/structured-fields.tsx` | Move to inspector or stage |
| HashtagInput | `blog/_shared/hashtag-input.tsx` | Move to inspector |
| SeriesFields | `blog/_shared/series-fields.tsx` | Move to inspector |
| LocaleToggle | `blog/_shared/locale-toggle.tsx` | Adapt for action bar |
| SlugField | `blog/_shared/slug-field.tsx` | Adapt for inspector |

## Server Actions (Reuse Existing)

All 16 existing server actions in `blog/actions.ts` are reused as-is:
- `createPost`, `savePost`, `movePost`, `deleteHubPost`
- `addLocale`, `removeTranslationLocale`
- `duplicatePost`, `reassignTag`
- `bulkPublish`, `bulkArchive`, `bulkDelete`
- Pipeline integration actions

**New server action needed:** `savePostField(postId, locale, field, value)` — granular field save for inspector edits (slug, excerpt, category, tags) without triggering full autosave payload. Uses existing `getSupabaseServiceClient()` with `requireSiteAdmin(postId)` guard. Single update to the relevant column, followed by `revalidateBlogPostSeo()` if SEO-related field changed.

## Design Tokens

All tokens from `design_handoff_blog_editor/reference/styles.css`:

- **Typography:** Title 38px/600/-1px/1.1lh · Prose 17px/1.78lh · Labels 11px uppercase
- **Colors:** Dark default, coral accent (`#fb7a52`), semantic ok/warn/danger/info
- **Radius:** Cards 14px, controls 9px
- **Heights:** Inputs 38px, bar buttons 30-32px, toggle segments 26-30px
- **Shadows:** Cards `--shadow`, popovers `--shadow-pop`
- **Motion:** Fast 130ms, normal 200ms, ease + ease-back curves
- **Focus:** `outline: 2px solid var(--accent); outline-offset: 2px`
- **Icons:** Lucide React (drop-in match for handoff's inline SVGs)

## File Structure (New)

```
apps/web/src/app/cms/(authed)/blog/
├── [id]/
│   └── editor/                          # NEW route
│       ├── page.tsx                      # Server: loads post data
│       ├── editor-client.tsx             # Client: EditorProvider + Shell
│       ├── context.tsx                   # EditorContext + useReducer
│       ├── reducer.ts                    # EditorState + actions
│       ├── types.ts                      # Stage, VersionContent, etc.
│       ├── helpers.ts                    # deriveSlug, publishGate, isEmptyVersion
│       ├── action-bar.tsx               # Top bar
│       ├── stage-bar.tsx                # Stage tabs
│       ├── stages/
│       │   ├── stage-ideia.tsx
│       │   ├── stage-rascunho.tsx
│       │   ├── stage-imagens.tsx
│       │   ├── stage-seo.tsx
│       │   └── stage-publicacao.tsx
│       ├── inspector/
│       │   ├── inspector.tsx            # Shell with cards
│       │   ├── insp-detalhes.tsx
│       │   ├── insp-distribuicao.tsx
│       │   ├── insp-historico.tsx
│       │   └── insp-arquivar.tsx
│       └── image-block/
│           ├── blog-image-extension.ts  # TipTap node definition
│           ├── blog-image-view.tsx      # React node view (all states)
│           └── blog-image-toolbar.tsx   # Hover toolbar
```

## Accessibility

- All blocks focusable via Tab
- `aria-live="polite"` announces state transitions
- Status uses color + text (never color alone)
- Caption uses semantic `<figcaption>`
- Focus-visible: `outline: 2px solid var(--accent); outline-offset: 2px`
- All animations respect `prefers-reduced-motion: reduce`
- Keyboard shortcuts: Enter/Space (gallery), U (upload), ⌥A (alt text), ⌥C (caption), ⌫ (clear), ⌘⌫ (delete block), Esc (deselect/exit focus)

## Verification Plan

1. **Unit tests:** `deriveSlug()`, `publishGate()`, `isEmptyVersion()`, reducer actions
2. **Component tests:** Each stage renders correctly with mock state
3. **Integration tests:** Full editor flow — create post → write → add images → fill SEO → publish
4. **Visual regression:** Compare mockups (`.superpowers/brainstorm/`) with implemented UI
5. **Accessibility:** Screen reader testing for image blocks, keyboard-only navigation
6. **Responsive:** Test at 1080px breakpoint — grid collapse, inspector drawer
7. **Autosave:** Verify debounce, mode switching, offline recovery
8. **Publish gate:** All 3 checks block/unblock correctly
9. **Language versions:** Add/remove/switch, independent content per version
10. **Focus mode:** Toggle hides/shows correctly, Esc exits
