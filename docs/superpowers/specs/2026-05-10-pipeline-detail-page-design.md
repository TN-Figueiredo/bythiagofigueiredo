# Pipeline Item Detail Page — Redesign Spec

**Date:** 2026-05-10
**Status:** Approved
**Scope:** Complete redesign of `pipeline/items/[id]/page.tsx` — from flat form (15/100) to tabbed, bilateral, section-based editor (98/100)
**Mockup:** `.superpowers/brainstorm/58663-1778444961/content/detail-v6.html`
**Parent spec:** `2026-05-10-pipeline-frontend-redesign-design.md` (Gem System)

## Context

The current detail page shows a flat form: title, hook, synopsis, a raw `<pre>` dump of `body_content` (first 2000 chars), and a basic sidebar. All content lives in a single `body_content text` column. The producer skill generates rich, structured content (scenes, b-rolls, cross-references, speed ramps, publication plans) that is rendered as raw text.

The redesign introduces a tabbed, bilateral interface where each content section has its own editor, revision tracking, edit mode, Cowork integration, and per-language content support.

## Database Schema Changes & Data Model

### Column changes to `content_pipeline`

| Column | Action | Type | Purpose |
|--------|--------|------|---------|
| `sections` | **ADD** | `jsonb DEFAULT '{}'::jsonb` | Structured section storage, replaces `body_content` |
| `body_content` | **KEEP (read-only)** | `text` | Backwards-compat fallback during migration; no new writes |
| `body_compiled` | **DROP later** | `text` | Already unused, remove in post-launch cleanup migration |

### Section JSONB structure

Each key follows the pattern `{sectionType}_{lang}` where lang is `pt`, `en`, or `shared` for language-agnostic sections.

```jsonb
{
  "ideia_shared": {
    "rev": 3,
    "cowork_rev": 3,
    "source": "idea-validator",
    "edited": true,
    "content": "...",
    "updated_at": "2026-05-10T14:00:00Z"
  },
  "roteiro_en": {
    "rev": 2,
    "cowork_rev": 1,
    "source": "producer",
    "edited": true,
    "content": "...",
    "updated_at": "2026-05-10T15:30:00Z"
  }
}
```

**Field semantics:**

| Field | Type | Description |
|-------|------|-------------|
| `rev` | `int` | Section revision counter, increments on every save (user or Cowork) |
| `cowork_rev` | `int \| null` | Last revision written by Cowork; `null` if never AI-generated |
| `source` | `string` | Origin: `"producer"`, `"idea-validator"`, `"producer --mode publish"`, or `"user"` |
| `edited` | `boolean` | `true` if user has manually edited since last Cowork write |
| `content` | `string \| object \| array` | Section payload — plain text for scripts, structured object for post-production, array for b-rolls |
| `updated_at` | `ISO 8601` | Last modification timestamp |

### Section types by format

| Format | Shared sections | Bilateral sections (per-lang) |
|--------|----------------|-------------------------------|
| Video | `ideia`, `brolls` | `roteiro`, `postprod_scenes`, `postprod_crossref`, `postprod_speedramps`, `publish` |
| Blog | `ideia`, `images` | `draft`, `seo`, `publish` |
| Newsletter | `ideia` | `content`, `layout`, `audience`, `send` |
| Course | `ideia` | `curriculum`, `lessons`, `material`, `publish` |
| Campaign | `ideia` | `briefing`, `assets`, `metrics`, `publish` |

### Versioning relationship

The item-level `version` column (optimistic lock) increments on **any** write to the row — section saves, stage transitions, metadata changes, checklist toggles. Section-level `rev` is independent and tracks only that section's edit history. A single save operation increments both `version` (by 1) and the target section's `rev` (by 1).

**Conflict detection:** When loading or polling a section, if the server's `rev` is higher than the client's cached `rev` and the user has unsaved local edits, display a conflict banner. The `cowork_rev` field identifies the last AI-written revision for source attribution (badge display), not for conflict detection itself.

### Migration SQL sketch

```sql
-- Migration: add_sections_jsonb
ALTER TABLE content_pipeline
  ADD COLUMN IF NOT EXISTS sections jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN content_pipeline.sections IS
  'Structured section storage keyed by {type}_{lang}. Authoritative after migration.';

-- Backfill: existing items can be repopulated via Cowork on next open.
-- For items with body_content, the detail page renders a read-only
-- fallback when sections is empty.

-- No new RLS policies needed — sections lives on the same row,
-- existing content_pipeline policies cover all access.
```

### Partial updates

Section saves use `jsonb_set(sections, '{roteiro_en}', $1::jsonb)` to avoid clobbering sibling sections. The `version` column's optimistic lock (`WHERE version = $expected`) guards against concurrent full-row conflicts. Application-layer validation via Zod (`PipelineSectionsSchema`) — no DB `CHECK` constraint.

## Tab Architecture & Component Design

### Tab sets by format

| Format | Tabs | Sub-tabs |
|--------|------|----------|
| Video | Ideia · Roteiro · B-Rolls · Pós-Produção · Publicação | Pós-Produção → Cross-Reference, Speed Ramps, Cena×Cena |
| Blog | Ideia · Rascunho · SEO · Imagens · Publicação | — |
| Newsletter | Ideia · Conteúdo · Layout · Audiência · Envio | — |
| Course | Ideia · Currículo · Aulas · Material · Publicação | — |
| Campaign | Ideia · Briefing · Assets · Métricas · Publicação | — |

Tab definitions live in `WORKFLOWS[format].sections` inside `workflows.ts`. Each section entry declares `key`, `label`, `type` (maps to renderer), and `shared: boolean`.

### Component hierarchy

```
PipelineItemDetail (server component — fetches item)
├── DetailHeader (title, hook, synopsis — auto-save 500ms debounce)
├── TabContainer (client component)
│   ├── PrimaryTabBar (tabs from WORKFLOWS[format].sections)
│   ├── LanguageToggle (PT/EN, persisted in URL hash)
│   └── TabPanel (renders active section)
│       ├── SectionToolbar (title + lang indicator, source label, edit toggle, cowork btn, save btn)
│       ├── CoworkRequestPanel (expandable textarea + prompt preview + copy btn)
│       ├── ConflictBanner (when cowork_rev > rev — diff view, keep/accept)
│       ├── SectionContent (format-specific renderer via registry)
│       └── SaveFooter (dirty state, rev indicator, ⌘S hint)
├── SubTabBar (only for postprod — Cross-Ref, Speed, Cenas)
└── Sidebar (server component, sticky)
    ├── StageCard (badge, progress dots, advance/retreat/archive)
    ├── SectionsCard (all sections with rev + dirty indicator)
    ├── ChecklistCard (interactive toggles, progress bar)
    ├── VVSCard (ring SVG, score)
    ├── DetailsCard (format, language, priority, version, tags, collection)
    └── HistoryCard (stage changes, section updates)
```

### Renderer registry

`SectionContent` resolves its child via `SECTION_RENDERERS[sectionType]`:

| Section Type | Renderer | Notes |
|---|---|---|
| ideia | `IdeaRenderer` | Structured cards: premise, angle, VVS, cross-refs |
| roteiro | `ScriptRenderer` | Beat-by-beat editor, divergence badges |
| brolls | `BRollRenderer` | Checklist of shots, clip name inputs, thumbnail concepts |
| postprod_scenes | `SceneGuideRenderer` | Collapsible scenes, music/SFX/overlays/mix/transitions |
| postprod_crossref | `CrossRefRenderer` | Script vs recording comparison table |
| postprod_speedramps | `SpeedRampRenderer` | Speed recommendation table |
| publish | `PublishRenderer` | Title/description/tags/cards/end-screen/strategy |

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘1` – `⌘5` | Jump to tab by index |
| `⌘←` / `⌘→` | Previous / next tab |
| `⌘L` | Toggle language PT/EN |
| `⌘S` | Save current section |
| `⌘E` | Toggle edit mode on active section |

Shortcuts registered in `TabContainer` via `useEffect` keydown listener, suppressed when focus is inside `<input>`/`<textarea>` (except `⌘S` which always fires).

### URL deep linking

Tab + language state as hash fragment: `#roteiro/pt`, `#postprod/scenes/en`. Written via `history.replaceState` on tab/language change. Read on mount to restore state from shared links.

## Cowork Integration, Conflict Resolution & Edit/Save Mechanics

### Cowork integration (clipboard-based)

The CMS never calls Cowork programmatically. Each section toolbar includes a **"🤖 Pedir atualização" button** (purple accent) that opens an inline panel:

1. **Instruction textarea** — freeform user input (placeholder: context-specific examples per section type)
2. **Prompt preview** — monospace block, auto-assembled from React state:
   ```
   Pipeline item: v1 — "Morei 4 Anos no Canadá..."
   Section: Cena×Cena (Post-Production Map)
   Language: EN
   Section revision: rev.1

   Instructions:
   {user's text}

   ---
   Use the pipeline API to:
   1. GET /api/pipeline/items/{id}/sections/{section}?lang={lang}
   2. Apply the instructions above to the current content
   3. PATCH /api/pipeline/items/{id}/sections/{section} with updated content
   ```
3. **Action row** — "📋 Copiar prompt" (copies to clipboard, shows ✓ toast) + "Cancelar"

The user pastes this into Claude Cowork, which independently calls the pipeline API.

### Conflict resolution

When Cowork PATCHes a section while the user has unsaved edits (detected via poll/refetch when `remote_rev > local_rev`):

- **Yellow conflict banner** between toolbar and content:
  - Message: "⚠️ Cowork atualizou esta seção há X min. Você tem edições locais não salvas."
  - 3 buttons: **"Ver diff"** | **"Manter minha versão"** (accent) | **"Aceitar Cowork"**
- **Diff view**: expandable panel — removed lines: red bg + strikethrough, added lines: green bg, context: dim
- **"Manter minha versão"**: PATCHes with local content, sets `rev = remote_rev + 1`
- **"Aceitar Cowork"**: discards local state, loads remote content, clears dirty flag
- If section has **no unsaved local edits**: remote content loads silently with subtle blue toast

### Edit mode

Toggle checkbox in section toolbar: "☐ Editar". When active (`.content-body.editing`):

- Editable regions get dashed borders, hover: solid accent border + subtle bg, focus-within: accent border + outer glow
- `contentEditable="true"` on text regions, `spellCheck={false}`
- Non-editable elements (beat labels, badges, timestamps) have `contentEditable="false"`
- Toggling off while dirty: confirm dialog "Descartar edições não salvas?"

### Save mechanics

- **Trigger**: `⌘S` or toolbar "💾 Salvar" button
- **Scope**: per-section PATCH to `/api/pipeline/items/{id}/sections/{section}`
- **Dirty tracking**: any edit sets `isDirty = true` → yellow pulsing dot in footer + sidebar SectionsCard
- **Optimistic locking**: PATCH sends current `rev`; `409 Conflict` triggers conflict banner flow
- **Success**: spinner → green toast "💾 Seção salva com sucesso" (top-right, 2.5s) → `isDirty` resets, `local_rev++`
- **Failure**: red toast, dirty state preserved, button re-enabled
- **Item version**: server increments `item.version` on any section save

### Source attribution

Toolbar badges after section title:

| Badge | Style | Condition |
|---|---|---|
| `🤖 producer` | purple dim bg | `source` is a Cowork agent |
| `✏️ editado` | yellow dim bg | `edited === true` (user modified Cowork content) |

Both display simultaneously when content was AI-generated then user-edited.

## Content Section Renderers & Bilateral Content Strategy

### Section renderers (video format)

**IdeaRenderer** (`ideia_shared`) — Language-agnostic with "PT+EN compartilhada" chip. Idea cards with: title, body, VVS score, ângulo, validation date. Green-500 left border for validated ideas. Cross-references to other pipeline items as accent-colored links.

**ScriptRenderer** (`roteiro_{lang}`) — Bilateral. Meta grid (canal, formato, ângulos, duração, framework, fonte VVS). Beat-by-beat blocks, monospace, `contenteditable`:

| Badge | Color | Meaning |
|-------|-------|---------|
| RECORDED / GRAVADO | green | Beat recorded as scripted |
| IMPROVISED / IMPROVISADO | orange | Diverged during recording |
| COMPRESSED / EXPANDIDO | cyan | Timing adjusted in post |
| EDITADO MANUALMENTE | yellow | Manual script edit post-recording |

Divergence highlights: orange bg with annotation "↑ Improvised during recording". Manual edits: yellow bg with "↑ Editado manualmente".

**BRollRenderer** (`brolls_shared`) — Language-agnostic with "Clips compartilhados entre PT e EN" note. Checklist: checkbox + description + clip name input (monospace) + beat chip + type badge. Captured items: strikethrough + filled checkbox + editable clip field. Uncaptured: normal text + dimmed input. Progress counter: "2/7 capturados · 5 pendentes". Thumbnail concept card: 2-column grid (Option A/B) with layout specs.

**SceneGuideRenderer** (`postprod_scenes_{lang}`) — Bilateral. Collapsible accordion scenes with "Expandir/Colapsar todas" controls. Each scene header: scene number, beat ref, timestamps, duration, status badges, difficulty chip. Expanded body sub-sections:

- 🎯 Narrative Function
- 🎵 Music (search terms, style, entry cue, continuation notes)
- 🔊 SFX (timestamped list with search terms)
- 📑 Overlays / Titles (timestamped instructions)
- 🎚️ Mix Notes (inline chips: "Voice: -6dB", "Music: -20dB")
- ✂️ Transition (cut type + reasoning)

Special state: **⚠ DECIDE** badge (yellow, bold) for pending editorial decisions (e.g., PT Channel Plug — keep or cut?).

| Status Badge | Style | Trigger |
|-------------|-------|---------|
| 100% | green | As scripted |
| 106% / 108% | cyan / yellow | Speed-ramped |
| CUT | red | Section removed |
| IMPROVISED | orange | Unscripted content |
| ⚠ DECIDE | yellow bold | Pending editorial decision |

**CrossRefRenderer** (`postprod_crossref_{lang}`) — Table: Beat (Script) | SRT Timestamp | Duration | Script Est. | Status. Key Divergences callout in red-bordered box listing actionable items.

**SpeedRampRenderer** (`postprod_speedramps_{lang}`) — Table: Section | SRT Range | Timeline | Speed | Rationale. Speed badges: 100% green, 106% cyan, 108% yellow, CUT red.

**PublishRenderer** (`publish_{lang}`) — Bilateral. Sections: Title (chosen + A/B alternatives + char count), Description (full text), Tags (pill badges), Cards (timestamped), End Screen (config), Launch Strategy (numbered). PT variant uses Portuguese labels. PT chapters include conditional notes for ⚠ DECIDE items (e.g., "Channel Plug ⚠ (se mantido)").

### Bilateral content strategy

- **Language toggle** (PT/EN buttons) in tab header — affects all bilateral sections simultaneously
- **Shared sections** (`ideia`, `brolls`): ignore toggle, show "compartilhada" indicator
- **Bilateral sections** (`roteiro`, `postprod_*`, `publish`): independent `lang-content` blocks per language
- **Toolbar language indicator**: dynamic `<span class="toolbar-lang">EN</span>` updates on toggle
- **PT and EN are parallel productions**: different timings, cuts, durations — never translations

## Sidebar Design

The sidebar is `position: sticky; top: 20px` with `max-height: calc(100vh - 40px); overflow-y: auto`. Cards:

| Card | Content |
|------|---------|
| **Stage** | Current stage badge (color-coded), 7-dot progress bar (done/current/pending), Advance/Retreat buttons, Archive button |
| **Seções** | All sections listed with green dot (saved), yellow dot (dirty/unsaved), rev number in monospace |
| **Checklist** | Interactive checkboxes, strikethrough completed items, segmented progress bar |
| **VVS** | SVG ring chart (score/100), label "Validation completeness" |
| **Details** | Format icon, Language badge, Priority badge (color-coded P1-P5), Version counter, Tags (cyan pills), Collection (purple pill) |
| **Histórico** | Timeline of stage changes and section updates with relative dates |

## Accessibility

- Primary tabs: `role="tablist"` container, `role="tab"` items with `aria-selected`, `aria-controls`
- Sub-tabs: same ARIA pattern
- Tab panels: `role="tabpanel"` with `aria-hidden` toggled
- Scene headers: `role="button"`, `tabindex="0"`, keyboard Enter/Space to toggle
- Focus-visible rings on all interactive elements
- `lang="pt-BR"` on document, bilateral content inherits from active language

## Non-Goals

- Real-time collaborative editing (WebSocket sync) — out of scope for v1
- API triggers from CMS to Cowork — clipboard workflow only
- Auto-save on section content (only header fields auto-save)
- Version history / undo (section revisions are append-only counters, not stored snapshots)
- Mobile/responsive layout — CMS is desktop-only
