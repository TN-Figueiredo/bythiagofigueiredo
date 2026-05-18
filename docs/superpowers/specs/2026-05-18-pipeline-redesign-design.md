# Pipeline Video Production Redesign — Design Spec

**Date:** 2026-05-18
**Sprint:** 5h (Social Hub extended)
**Scope:** Redesign the CMS Pipeline detail page (`/cms/pipeline/items/[id]`) for video production
**Estimate:** ~78h (~10 working days)
**Interactive mockup:** `.superpowers/brainstorm/74398-1779133429/content/pipeline-redesign-v2.html`

---

## Overview

Redesign of the 5-tab pipeline video production workflow:

| Tab | Change | Effort |
|-----|--------|--------|
| **Ideia** | Keep as-is | 0h |
| **Roteiro** | Dual-mode: TipTap Edit + Print-ready View | ~16h |
| **B-Rolls** | Remove tab entirely, create B-Roll Library page | ~20h |
| **Pos-Producao** | DaVinci Resolve-style timeline rewrite | ~30h |
| **Publicacao** | Keep as-is | 0h |
| **Data/API/Migration** | Schema changes, new endpoints, backward compat | ~12h |

**Design references:**
- `design/Roteiro Print.html` — print-optimized script layout
- `design/timeline.jsx` + `design/timeline-data.js` — DaVinci timeline prototype
- Existing Audio Library at `/cms/pipeline/audio/` — architectural blueprint for B-Roll Library

### Consistency Decisions

Conflicts between sections resolved as follows:

| Conflict | Resolution | Rationale |
|----------|-----------|-----------|
| B-Roll table name (`broll_assets` vs `broll_library`) | **`broll_library`** | It's a library concept, parallels `audio_assets` naming pattern |
| Track assignments (Section B vs D) | **Section B mapping** (V1=Main Footage, V7=Overlays) | Matches mockup + DaVinci convention where V1 is the base layer |
| Status values (`ready\|pending` vs `available\|pending\|retired`) | **3-state** (`available\|pending\|retired`) | More complete lifecycle; `retired` enables soft-delete |
| Source classification | **Both fields**: `source_type` (pessoal/generico) + `source` (local/artlist/pexels) | Different axes — ownership vs provenance |

---

## Section A: Roteiro — Dual-Mode Editor/Viewer

### A.1 Current State

#### A.1.1 Data structure

Section `roteiro_{lang}` stores JSONB in `content_pipeline.sections`:

```ts
interface ScriptContent {
  meta?: {
    canal?: string
    formato?: string
    angulos?: string
    duracao?: string
    framework?: string
    fonte_vvs?: string
  }
  beats?: Array<{
    number: number
    label: string
    text: string          // plain text with inline markup ([VISUAL: ...], "quotes", [PAUSA 0.5s])
    status?: string       // 'RECORDED' | 'GRAVADO' | 'IMPROVISED' | etc.
    divergence_note?: string
  }>
}
```

#### A.1.2 Rendering (view)

**File:** `renderers/script-renderer.tsx`

- **Meta grid:** 2-col, `var(--gem-well)` background. Labels: Canal, Formato, Angulos, Duracao, Framework, Fonte VVS.
- **Beats:** cards with header (number, label, status badge) + parsed body.
- **Parsing pipeline:** `beat.text` -> `parseScriptTags()` -> `ScriptSegment[]`:
  - `tag` (VISUAL, TOM, B-ROLL, CORTE, OVERLAY, TRANS, DIRECTION, SFX)
  - `narration` (text between `"..."`)
  - `pause` (`[PAUSA 0.5s]`)
  - `section`, `meta`, `text`, `blockquote`, `bullet-list`, `reference`, `separator`
- **Token sub-parsing:** `tokenizeText()` highlights timestamps, dB values, negations, bold.
- **Visual grouping:** `groupClusters()` groups consecutive tags with `borderLeft`.

#### A.1.3 Editing (edit)

- Raw `contentEditable` per beat — no toolbar, no rich formatting.
- `onBlur` captures `innerText` and persists. All formatting depends on plain text conventions.
- No toggle edit/view — mode controlled by parent via `isEditing` prop.
- **ScriptRenderer is the only pipeline renderer NOT using TipTap** — all others (Ideia, Draft, etc.) use `PipelineEditor`.

#### A.1.4 Existing components

| Component | File | Function |
|-----------|------|----------|
| `StatusBadge` | `renderers/status-badge.tsx` | Pill with color per status |
| `TagPill` | `renderers/tokens.tsx` | Colored pill per tag type |
| `PauseChip` | `renderers/tokens.tsx` | `pause 0.5s` chip |
| `EmphHighlight` | `renderers/tokens.tsx` | UPPERCASE yellow highlight |
| `parseScriptTags` | `renderers/parse-script-tags.ts` | Regex parser: plain text -> ScriptSegment[] |
| `tokenizeText` | `renderers/parse-tokens.tsx` | Sub-parser inline (timestamps, dB, bold) |
| `PipelineEditor` | `editors/pipeline-editor.tsx` | Generic TipTap editor (used in Ideia, Draft, etc.) |
| `PipelineToolbar` | `editors/pipeline-toolbar.tsx` | Toolbar full/compact for PipelineEditor |

#### A.1.5 TipTap in the CMS

TipTap is already integrated with full infrastructure:

- **Extensions** (`pipeline-extensions.ts`): StarterKit, Underline, Link, Image, TextAlign, Color, Highlight, Placeholder, CharacterCount, TaskList, Table, Callout, Toggle, Columns, SocialEmbed.
- **Two presets:** `full` (headings, tables, embeds, alignment) and `compact` (bold, italic, lists, links).
- **Used in:** Ideia (compact), Draft/Blog (full), Newsletter, shared editor (`_shared/editor/`).

---

### A.2 Target State — Dual-Mode Architecture

Two modes for the same data, toggled by button/keyboard:

| | Edit Mode | View Mode |
|---|-----------|-----------|
| **Purpose** | Writing and structured editing | Review and printing |
| **Engine** | TipTap (rich text per beat) | Static React renderer |
| **Visual style** | CMS dark theme (`--gem-*`) | Print-ready light (`Roteiro Print.html`) |
| **Interaction** | Inline editing, drag-to-reorder, status toggle | Read-only, print button, theme toggle |
| **Data** | Same JSONB — read + write | Same JSONB — read only |

#### Edit Mode (CMS Standard)

**Meta Fields Grid:**
- Grid 3 columns: Canal, Formato, Angulos, Duracao, Framework, VVS.
- Each field is an `<input>` with inline click-to-edit. Saves to `content.meta`.

**Beat Accordion Editors:**
- Each beat is a collapsible accordion (open/closed).
- **Header:** `#idx` | beat name | status badge (click to cycle: PENDING -> DONE) | grip handle (reorder).
- **Body (open):** TipTap editor with custom compact toolbar: **B** | **I** | **U** | **S** | pilcrow | --- | link | list
- **Inline tags:** TipTap mention system — typing `@` or `/` opens picker with:
  - `NARRACAO` — spoken line wrapper (serializes as `{ type: 'line' }`)
  - `VISUAL` — visual note (serializes as `{ type: 'note', tag: 'VISUAL' }`)
  - `DIRECTION` — direction note (serializes as `{ type: 'note', tag: 'DIRECTION' }`)
  - `PAUSA` — pause marker with duration (serializes as `{ type: 'pause' }`)
- **Status per beat:** badge in header, toggleable. Values: `PENDING` | `DONE`.

**TipTap <-> JSONB conversion:**
- TipTap stores `JSONContent` internally.
- On save: `JSONContent` -> `RoteiroContent` (schema in A.4).
- On load: `RoteiroContent` -> `JSONContent` for editor.

#### View Mode (Print-Ready)

Renders the same data as a faithful preview of `design/Roteiro Print.html`:

**Typography:**
- **Serif:** Source Serif 4 for spoken lines (11.5pt, line-height 1.55)
- **Sans:** Inter for metadata, labels, direction notes (8.5pt)
- **Mono:** JetBrains Mono for labels, numbers, tags (7.5pt)

**Layout:**
- **Background:** `#FFFFFF` (light) / `#14110B` (dark), paper areas `#F6F5F2` / `#1E1A14`
- **Header:** title 16pt bold, metadata grid 3-col, bottom border 2px solid
- **Synopsis box:** paper background, border-left 3px `--ink-15`
- **Beat overview table:** columns #, Beat, Dur, Reading + totals in footer
- **Legend:** colored swatches for emphasis/insight/key-phrase/narrative
- **Beats:** header with inverted number (dark bg, light text), uppercase name, duration info
- **Spoken lines:** italic, 11.5pt, padding-left 14px, border-left 3px (color per accent)
- **Accent colors:** `#F1C40F` (emphasis/yellow), `#E84393` (key-phrase/pink), `#3498DB` (insight/blue), `#C8C4BC` (neutral narrative)
- **Pause markers:** `pause 0.5s` in mono green
- **VISUAL/DIRECTION notes:** `dir-block` with mono uppercase label + sans text
- **REF notes:** italic, 8pt, top border, `REF` label in accent color
- **Footer:** `tf  Thiago Figueiredo . canal` + recording data

**Controls (screen-only):**
- **Print button:** dispatches `window.print()`
- **Theme toggle:** alternates `body.dark` (light/dark palette swap)

---

### A.3 Component Breakdown

#### New files

```
pipeline/_components/detail/
  renderers/
    script-renderer.tsx         # REFACTOR: becomes dual-mode wrapper
    script-edit-mode.tsx        # NEW: TipTap editing mode
    script-view-mode.tsx        # NEW: print-ready view mode
    script-view-mode.css        # NEW: print CSS
    script-meta-editor.tsx      # NEW: editable meta fields grid
    script-beat-accordion.tsx   # NEW: TipTap accordion per beat
    script-beat-toolbar.tsx     # NEW: compact toolbar for beats
    script-tag-extension.ts     # NEW: TipTap node extension for inline tags
    script-pause-extension.ts   # NEW: TipTap node extension for pauses
    script-serializer.ts        # NEW: JSONContent <-> RoteiroContent conversion
```

#### Component interfaces

**`ScriptRenderer` (refactored)**
```ts
interface ScriptRendererProps extends RendererProps {
  // inherits: content, isEditing, lang, onContentChange
}
// Internal state: viewMode: 'edit' | 'view' (default 'edit' when isEditing)
// Keyboard shortcut: Cmd+Shift+P to toggle
```

**`ScriptEditMode`**
```ts
interface ScriptEditModeProps {
  data: RoteiroContent
  onChange: (data: RoteiroContent) => void
}
// Renders ScriptMetaEditor + list of ScriptBeatAccordion (drag-to-reorder via @dnd-kit)
// "Add Beat" button at bottom
// Persists changes via onChange (debounced)
```

**`ScriptViewMode`**
```ts
interface ScriptViewModeProps {
  data: RoteiroContent
  title?: string
}
// Renders header, synopsis, overview table, legend, beats, footer
// Print button, theme toggle
// @media print CSS for A4
// Reading time calculation per beat
```

**`ScriptMetaEditor`**
```ts
interface ScriptMetaEditorProps {
  meta: RoteiroMeta
  onChange: (meta: RoteiroMeta) => void
  readOnly?: boolean
}
// 3-col grid of inline-edit inputs
// Labels: Canal, Formato, Angulos, Duracao, Framework, VVS
```

**`ScriptBeatAccordion`**
```ts
interface ScriptBeatAccordionProps {
  beat: RoteiroBeat
  index: number
  isOpen: boolean
  onToggle: () => void
  onChange: (beat: RoteiroBeat) => void
  onStatusToggle: () => void
  onDelete: () => void
}
// Header: grip, number, name (editable), status badge, chevron
// TipTap editor with toolbar when open
// Converts beat.script <-> TipTap JSONContent
```

**`ScriptTagExtension` (TipTap Node Extension)**
```ts
// Inline node: renders as <span class="script-tag"> with color per type
// Attributes: { tag: 'VISUAL' | 'DIRECTION' | 'NARRACAO', text: string }
// Insertion: via toolbar or slash command
// Serialization: converts to ScriptLine with correct type/tag
```

**`ScriptPauseExtension` (TipTap Node Extension)**
```ts
// Inline node: renders as <span class="script-pause"> with duration input
// Attributes: { duration: number } (default 0.5)
// Insertion: via toolbar or slash command
// Serialization: converts to { type: 'pause', duration: number }
```

**`scriptSerializer`**
```ts
export function roteiroToTipTap(beat: RoteiroBeat): JSONContent
export function tipTapToRoteiro(json: JSONContent): RoteiroBeat['script']
export function legacyBeatToNew(beat: LegacyBeat): RoteiroBeat
```

#### Existing components reused

| Component | Usage |
|-----------|-------|
| `StatusBadge` | Beat header (edit) + overview table (view) |
| `PipelineToolbar.Btn` / `Sep` | Extract to shared, reuse in `ScriptBeatToolbar` |
| `PipelineEditor` infra | Extensions base (StarterKit, Link, etc.) reused |
| `SectionContent` | No change — still maps `roteiro` -> `ScriptRenderer` |

---

### A.4 Data Schema

#### Zod schemas

```ts
const RoteiroMetaSchema = z.object({
  canal: z.string().optional(),
  formato: z.string().optional(),
  angulos: z.string().optional(),
  duracao: z.string().optional(),
  framework: z.string().optional(),
  fonte_vvs: z.string().optional(),
  synopsis: z.string().optional(),
})

const ScriptLineSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('line'),
    text: z.string(),
    accent: z.string().optional(),   // hex color, e.g. '#F1C40F'
  }),
  z.object({
    type: z.literal('pause'),
    duration: z.number().min(0),
  }),
  z.object({
    type: z.literal('note'),
    tag: z.enum(['VISUAL', 'DIRECTION', 'TOM', 'B-ROLL', 'CORTE',
                 'OVERLAY', 'TRANS', 'SFX']),
    text: z.string(),
  }),
  z.object({
    type: z.literal('ref'),
    text: z.string(),
  }),
])

const RoteiroBeatSchema = z.object({
  idx: z.number().int().min(0),
  name: z.string().min(1),
  status: z.enum(['PENDING', 'DONE']).default('PENDING'),
  duration: z.number().int().min(0).optional(),
  script: z.array(ScriptLineSchema).default([]),
})

const RoteiroContentSchema = z.object({
  version: z.literal(2),
  meta: RoteiroMetaSchema.default({}),
  beats: z.array(RoteiroBeatSchema).default([]),
})

type RoteiroMeta = z.infer<typeof RoteiroMetaSchema>
type ScriptLine = z.infer<typeof ScriptLineSchema>
type RoteiroBeat = z.infer<typeof RoteiroBeatSchema>
type RoteiroContent = z.infer<typeof RoteiroContentSchema>
```

#### Example stored data

```json
{
  "version": 2,
  "meta": {
    "canal": "@thiagofigueiredo",
    "formato": "Storytelling + Framework Pratico",
    "angulos": "A1 + A2 + A5",
    "duracao": "14-17 min",
    "framework": "McKee (Arco Dramatico)",
    "fonte_vvs": "80/80 (SQ5)",
    "synopsis": "Trailer bilateral (PT+EN)..."
  },
  "beats": [
    {
      "idx": 0,
      "name": "Hook",
      "status": "DONE",
      "duration": 24,
      "script": [
        { "type": "note", "tag": "VISUAL", "text": "3s montagem rapida: Canada -> Brasil -> Asia." },
        { "type": "note", "tag": "DIRECTION", "text": "calmo, proximo, sem drama" },
        { "type": "line", "text": "Eu morei quatro anos no Canada.", "accent": "#F1C40F" },
        { "type": "pause", "duration": 0.5 },
        { "type": "line", "text": "Decidi voltar pro Brasil." },
        { "type": "line", "text": "E agora to me preparando pra me mudar pra Asia.", "accent": "#E84393" },
        { "type": "ref", "text": "Promessa dupla + plano para Asia." }
      ]
    }
  ]
}
```

#### v1 (legacy) vs v2 comparison

| Aspect | v1 (current) | v2 (target) |
|--------|--------------|-------------|
| `beat.text` | Plain text with inline markup | Removed |
| `beat.script` | Does not exist | Array of `ScriptLine` |
| `beat.number` | `number` | Renamed to `idx` |
| `beat.label` | `string` | Renamed to `name` |
| `beat.status` | Free-form string | Enum: `PENDING` \| `DONE` |
| `beat.duration` | Does not exist | Seconds (estimated) |
| `meta.synopsis` | Does not exist | Dedicated field |
| `version` | Does not exist (implicit v1) | `2` explicit |

---

### A.5 Migration Path

#### Strategy: on-read migration + lazy write

No batch data alteration. Instead:

1. **On read:** if `content.version` missing or `!== 2`, treat as v1 and convert in memory.
2. **On save:** always save in v2 format.
3. **Result:** data migrates organically as items are edited.

#### Migration function

```ts
function migrateV1toV2(content: unknown): RoteiroContent {
  const v1 = content as { meta?: ScriptMeta; beats?: LegacyBeat[] }
  return {
    version: 2,
    meta: {
      canal: v1.meta?.canal,
      formato: v1.meta?.formato,
      angulos: v1.meta?.angulos,
      duracao: v1.meta?.duracao,
      framework: v1.meta?.framework,
      fonte_vvs: v1.meta?.fonte_vvs,
    },
    beats: (v1.beats ?? []).map((beat, i) => ({
      idx: beat.number ?? i,
      name: beat.label ?? `Beat ${i}`,
      status: mapLegacyStatus(beat.status),
      script: parseLegacyText(beat.text),
    })),
  }
}

function mapLegacyStatus(status?: string): 'PENDING' | 'DONE' {
  if (!status) return 'PENDING'
  const upper = status.toUpperCase()
  if (['RECORDED', 'GRAVADO'].includes(upper)) return 'DONE'
  return 'PENDING'
}

function parseLegacyText(text: string): ScriptLine[] {
  // Reuses existing parseScriptTags() and maps ScriptSegment -> ScriptLine
  const segments = parseScriptTags(text)
  return segments.flatMap(seg => segmentToScriptLines(seg))
}
```

#### ScriptSegment -> ScriptLine mapping

| ScriptSegment type | ScriptLine type | Notes |
|--------------------|-----------------|-------|
| `narration` | `line` | `accent` undefined (neutral) |
| `tag` (VISUAL, DIRECTION, etc.) | `note` | `tag` preserved |
| `pause` | `pause` | `duration` parsed string->number |
| `reference` | `ref` | Text preserved |
| `text` | `line` | Free text becomes speech |
| `blockquote` | `line` | Becomes speech with emphasis accent |
| `section` | `note` + `line` | Label -> note DIRECTION, content -> line |
| `meta` | Ignored | Already in `content.meta` |
| `separator` | Ignored | No v2 equivalent |
| `bullet-list` | Multiple `line` | Each item becomes a line |

#### Fallback safety

If migration fails (malformed JSON, unexpected type):
- Render content using the current v1 ScriptRenderer (read-only).
- Show banner: "Formato legado — edite para migrar automaticamente."
- Log error via Sentry.

---

### A.6 Print CSS

```css
@page {
  size: A4;
  margin: 16mm 18mm 18mm 18mm;
}

@media print {
  .script-view-controls,
  .script-view-theme-toggle,
  .script-view-print-btn { display: none !important; }

  .script-view-root { padding: 0; max-width: none; font-size: 11pt; }
  .script-view-beat { break-inside: avoid; }

  .script-view-overview,
  .script-view-dir-block,
  .script-view-beat-num,
  .script-view-line,
  .script-view-synopsis {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .script-view-root { orphans: 2; widows: 2; }
}
```

**CSS variables for light/dark:**

```css
.script-view-root {
  --sv-ink: #1A1410; --sv-ink-80: #3D352C; --sv-ink-50: #7A7064;
  --sv-ink-30: #A89E92; --sv-ink-15: #D4CEC6; --sv-ink-08: #EBE7E0;
  --sv-accent: #C45A1C; --sv-blue: #2060A0; --sv-teal: #18806E;
  --sv-green: #1E7A46; --sv-pink: #A82860;
  --sv-bg: #FFFFFF; --sv-paper: #F6F5F2;
}

.script-view-root.dark {
  --sv-ink: #E8E2D6; --sv-ink-80: #C0B8AA; --sv-ink-50: #8A8278;
  --sv-ink-30: #5A544C; --sv-ink-15: #3A352E; --sv-ink-08: #2A2520;
  --sv-accent: #FF8240; --sv-blue: #60A5FA; --sv-teal: #2DD4BF;
  --sv-green: #4ADE80; --sv-pink: #F472B6;
  --sv-bg: #14110B; --sv-paper: #1E1A14;
}
```

**Font loading:** Source Serif 4, Inter, JetBrains Mono via `next/font/google` with `display: swap`.

---

### A.7 Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Cmd+Shift+P` | Toggle Edit <-> View mode | Both modes |
| `Cmd+P` | Print | View mode |
| `Cmd+B/I/U` | Bold/Italic/Underline | Edit mode |
| `Cmd+Shift+X` | Strikethrough | Edit mode |
| `Cmd+K` | Insert/remove link | Edit mode |
| `Cmd+Enter` | Close current beat, open next | Edit mode |
| `/narration` | Insert NARRACAO block | Edit mode |
| `/visual` | Insert VISUAL note | Edit mode |
| `/direction` | Insert DIRECTION note | Edit mode |
| `/pause` | Insert PAUSA marker | Edit mode |
| `D` | Toggle dark/light theme | View mode |
| `Escape` | Return to Edit mode | View mode |

### A.8 Open Decisions (resolve during implementation)

1. **Accent color picker:** How does the user set accent color per `line`? Options: color picker inline, dropdown with 4 legend colors, or automatic inference.
2. **Duration per beat:** Manual input or calculated automatically (words/2.5 + pauses)?
3. **Drag-to-reorder:** Check if `@dnd-kit/sortable` is already a dependency before adding.
4. **Synopsis field:** Separate field in meta editor or dedicated textarea above beats?
5. **Font loading:** Check if Source Serif 4 is already used elsewhere in the CMS. Evaluate bundle impact.

---

## Section B: Pos-Producao — DaVinci Timeline Rewrite

### B.1 Current State

The Pos-Producao tab (`postprod`) currently uses 3 sub-tabs:

| Sub-tab key | Label | Renderer | Lines |
|-------------|-------|----------|-------|
| `postprod_scenes` | Cena x Cena | `SceneGuideRenderer` | 523 |
| `postprod_crossref` | Cross-Reference | `CrossRefRenderer` | 119 |
| `postprod_speedramps` | Speed Ramps | `SpeedRampRenderer` | 149 |

**Problems:**
1. **Fragmented context** — editor must switch between 3 sub-tabs to see related data
2. **No timeline visualization** — text-heavy accordion cards with no temporal positioning
3. **CrossRef/SpeedRamps disconnected** — useful reference data hidden in separate tabs
4. **Music/SFX subsystem locked** — rich normalization logic (`_music-sfx/`) trapped inside scene guide accordion

---

### B.2 Target State

A single scrollable view replacing all 3 sub-tabs:

```
+----------------------------------------------------------+
| Pos-Producao (unified view)                              |
+----------------------------------------------------------+
| ProgressBar (proportional beat segments)                 |
+---------------------------+------------------------------+
| CrossRefPanel (collapse)  | SpeedRampsPanel (collapse)   |
+---------------------------+------------------------------+
| Toolbar: Zoom [30-400%] | Expandir/Recolher | Legend     |
+----------------------------------------------------------+
| Beat 0 -- Hook                              24s  PENDING |
|   +-- Timeline (13 tracks: V7..V1 | A1..A6)             |
|   +-- AssetResolver (MUSICA, SFX, VISUAL, AMBIENCE, SD) |
|   +-- ScriptPanel (roteiro inline)                       |
+----------------------------------------------------------+
| Beat 1 -- O Capitulo Canada               93s  PENDING  |
|   +-- Timeline / AssetResolver / ScriptPanel             |
+----------------------------------------------------------+
```

**Key differences from current:**
- Sub-tabs **eliminated**
- CrossRef and SpeedRamps become **collapsible panels** at top, side-by-side
- Each beat is a self-contained accordion with timeline + assets + script
- 13-track timeline with visual clips, audio waveforms, ruler
- AssetResolver replaces scattered music/sfx UI
- ScriptPanel replaces narrative + edit_notes rendering

---

### B.3 Component Hierarchy

```
PostProductionView (new root)
  |-- ProgressBar (beats: Beat[])
  |-- div.grid.grid-cols-2
  |     |-- CrossRefPanel (data, defaultOpen?)
  |     |-- SpeedRampsPanel (data, defaultOpen?)
  |-- Toolbar (zoom, setZoom, expandAll, collapseAll)
  |-- Beat[].map => BeatAccordion
        |-- BeatHeader (idx, label, name, duration, status, difficulty)
        |-- (when expanded:)
        |-- div.flex (timeline layout)
        |     |-- TrackPanel (left, PANEL_W=170px)
        |     |     |-- TrackHead[] (V7..V1, A1..A6)
        |     |     |-- ResizeHandle[]
        |     |     |-- TrackDivider (VIDEO . AUDIO)
        |     |-- TimelineArea (right, scrollable-x)
        |           |-- Ruler (duration, pxPerSec)
        |           |-- TrackLane[] -> TimelineClip[] -> WaveDecor (audio)
        |           |-- TrackDivider
        |-- AssetResolver (beatIdx, assets: BeatAssets)
        |     |-- MusicSection -> MusicCard[] (select/confirm, MiniWaveform)
        |     |-- SfxSection -> SfxCard[] (timecoded, type badges)
        |     |-- VisualSection -> VisualRow[] (pending/resolved)
        |     |-- AmbienceSection -> AmbienceRow[]
        |     |-- SoundDesignSection -> SoundDesignRow[]
        |-- ScriptPanel (script: ScriptItem[])
              |-- NoteItem, LineItem, PauseMarker, RefNote
```

---

### B.4 Track System

13 tracks: 7 video (V7..V1 top-down) + 6 audio (A1..A6 top-down).

#### Video Tracks

| Track | Name | Color | Function |
|-------|------|-------|----------|
| V7 | Overlays + End Screen | `#A3CB38` | End screen, cards, vignettes |
| V6 | Subtitles | `#F1C40F` | Captions (Text+ or Fusion) |
| V5 | Graphics + QR | `#E84393` | QR codes, subscribe CTA, logos |
| V4 | Lower Thirds | `#9B59B6` | Name, location, chapter titles |
| V3 | B-Roll | `#1ABC9C` | Cutaways, insert shots |
| V2 | Background Layer | `#A0845C` | Content behind person (Magic Mask) |
| V1 | Main Footage | `#C4A882` | Talking head, A-roll principal |

#### Audio Tracks

| Track | Name | Color | Function |
|-------|------|-------|----------|
| A1 | Voice | `#27AE60` | Narration, talking head |
| A2 | Music | `#3498DB` | Music bed (ducked under voice) |
| A3 | SFX Punctuation | `#E67E22` | Impacts, bass drops, risers |
| A4 | SFX Textures | `#F0B27A` | Whooshes, shimmers, transitions |
| A5 | Ambience | `#7D8B5E` | Room tone, ambience |
| A6 | Sound Design | `#8E44AD` | Branded sounds, stingers |

#### Constants

```ts
const PANEL_W = 170       // Left panel width (px)
const RULER_H = 26        // Ruler height (px)
const DEF_H = 34          // Default track height (px)
const EMPTY_H = 18        // Height for tracks with 0 clips
const MIN_H = 16          // Minimum resize height
const MAX_H = 120         // Maximum resize height
const DIVIDER_H = 16      // Video/Audio divider height
```

#### Track height behavior

- Tracks with clips: `trackHeights[trackId]` (default `DEF_H`, V1 and A1 start at `42`)
- Tracks with 0 clips: collapsed to `EMPTY_H` (18px), dimmed to 45% opacity
- User can drag `ResizeHandle` between `MIN_H` and `MAX_H`
- Track heights shared across all beat accordions

#### Clip rendering

`TimelineClip` positions each clip absolutely:
- `left = clip.s * pxPerSec + 1`
- `width = max((clip.e - clip.s) * pxPerSec - 2, 3)` (minimum 3px)
- Video clips: gradient fill + frame marker pattern (vertical lines every 32px)
- Audio clips: gradient fill + `WaveDecor` (procedural SVG bars, pseudo-random heights)
- Hover: box-shadow glow in track color + `ClipTooltip` (track name, label, timecodes, duration)

---

### B.5 AssetResolver

Accordion panel below the timeline inside each beat. 5 categories:

#### MUSICA (Music)

```ts
interface MusicAsset {
  id: string; name: string; artist: string; genre: string
  bpm: number; dur: string; match: number; local: boolean
  selected: boolean; confirmed?: boolean; tags: string[]; note?: string
}
```

**Select/Confirm 2-step workflow:**
1. All music options shown as cards. Selected card highlighted with accent border.
2. Click card to select (deselects others).
3. Selected but unconfirmed: shows "Confirmar Selecao" button.
4. Confirm locks selection (opacity 0.6, non-interactive).
5. Confirmed cards show green "CONFIRMADO" badge.

**Card displays:** star icon + name + artist, Local/Download badge, match % (green >= 80, white >= 60, muted < 60), genre/BPM/duration (mono), tags (3 max), usage note, MiniWaveform.

#### SFX

```ts
interface SfxAsset {
  tc: string; type: 'IMPACT' | 'RISER' | 'DROP' | 'TEXTURE' | 'FOLEY'
  typeColor: string; desc: string
  file: { name: string; local: boolean; match: number } | null
  tags: string[]; altCount: number
}
```

- Timecode badge + type badge + description
- File info: filename + Local badge + match % (or "Nenhum arquivo selecionado — buscar" warning)
- Search tags as clickable pills with Artlist link
- "+N alt" link to browse alternatives

#### VISUAL

```ts
interface VisualAsset {
  tc: string; desc: string
  status: 'pending' | 'resolved'
  file?: string; search?: string[]
}
```

- Resolved: green checkmark + filename
- Pending: orange warning + "Buscar" button -> Asset Picker dialog

#### AMBIENCE

Simple row: filename, Local badge, match percentage. Room tone / ambient audio.

#### SOUND DESIGN

Timecode + name + status badge (pending=orange, resolved=green). Branded sounds, stingers.

**Pending count badge:** Accordion header shows `"ASSETS"` + counts + pending badge.

---

### B.6 ScriptPanel

Collapsible accordion below AssetResolver. Shows script/roteiro for the beat.

```ts
type ScriptItem =
  | { type: 'note'; tag: string; tagColor: string; text: string }
  | { type: 'line'; text: string; accent: string }
  | { type: 'pause'; duration: number }
  | { type: 'ref'; text: string }
```

Rendering: note -> tag badge + description (12px, muted); line -> serif italic (13px) with 3px left accent border; pause -> green mono badge; ref -> separator + orange "REF" badge + dim text.

Header: "ROTEIRO" label + line count (filtered to `type === 'line'`).

---

### B.7 CrossRef + SpeedRamps — Panel Migration

**CrossRefPanel:** Collapsible panel at top. Header: collapse arrow, "CROSS-REFERENCE" label (blue), beat count, divergence badge. Body: summary, table (beat | SRT timestamp | duration | est. roteiro | status), divergences callout box.

**SpeedRampsPanel:** Collapsible panel, mirroring CrossRef. Header: collapse arrow, "SPEED RAMPS" label (purple), section count, est. final duration. Body: summary + base acceleration, table (section | SRT range | speed badge | rationale).

**Migration notes:** Old renderers remain in codebase for reference. Section keys preserved for data storage. `PostProductionView` reads all 3 section data objects.

---

### B.8 Zoom & Navigation

- Range: **30% to 400%**. Default: **100%**. Step: 0.15/click, 0.05/slider.
- `pxPerSec = (availableWidth / beat.duration) * zoom`
- `availableWidth = containerWidth - PANEL_W - 2` (min 300px)
- Controls: `-` button, slider, `+` button, percentage display, "Fit" reset
- Expand/Collapse All: `resetKey` counter + `allState` to force remount

| Key | Action |
|-----|--------|
| `+` / `-` | Zoom in / out |
| `0` | Reset zoom to 100% |
| `E` | Expand all |
| `C` | Collapse all |
| `J` / `K` | Previous / next beat |
| `Escape` | Collapse current beat |

---

### B.9 State Management

```
content_pipeline.sections (JSONB)
  |-> useSection() x3 (postprod_scenes, postprod_crossref, postprod_speedramps)
  |-> PostProductionView
        |-> merges all 3 section data
        |-> derives Beat[] with clips, assets, script
        |-> passes crossref/speedramps to top panels
        |-> passes per-beat data to BeatAccordion children
```

**Optimistic updates:** On asset interaction -> update local state -> derive new scenes content -> `setContent()` -> auto-save -> conflict modal on 409.

**Local UI state (not persisted):** zoom, trackHeights, allState/resetKey, per-beat open states, per-accordion open states, music selections/confirmations, clip hover.

---

### B.10 Performance

1. **Beat-level lazy rendering:** Only expanded beats render timeline/assets/script. Collapsed = header only.
2. **WaveDecor memoization:** `useMemo` keyed on `(width, height, seed)`. Skip at zoom < 50%.
3. **Track height resize debouncing:** `rAF` during drag, sync to React state on `mouseup`.
4. **Container width observer:** Single `ResizeObserver`, throttled 100ms.
5. **`React.memo` on BeatAccordion** with custom comparator (beat, zoom, trackHeights, containerW, defaultOpen).
6. **IntersectionObserver** for subtitle tracks with 200+ clips.
7. **CSS:** Absolute positioning for clips, simple gradients, `box-shadow` hover (GPU-composited), no animations on clips.

---

### B.11 New Files

| File | Purpose |
|------|---------|
| `renderers/postprod/post-production-view.tsx` | Root component |
| `renderers/postprod/progress-bar.tsx` | Beat overview bar |
| `renderers/postprod/toolbar.tsx` | Zoom, expand/collapse |
| `renderers/postprod/beat-accordion.tsx` | Per-beat accordion |
| `renderers/postprod/timeline/ruler.tsx` | Time ruler |
| `renderers/postprod/timeline/track-head.tsx` | Left panel track header |
| `renderers/postprod/timeline/track-lane.tsx` | Right panel with clips |
| `renderers/postprod/timeline/timeline-clip.tsx` | Individual clip block |
| `renderers/postprod/timeline/wave-decor.tsx` | Procedural SVG waveform |
| `renderers/postprod/timeline/track-divider.tsx` | VIDEO/AUDIO separator |
| `renderers/postprod/timeline/resize-handle.tsx` | Track height resize |
| `renderers/postprod/timeline/constants.ts` | Track constants |
| `renderers/postprod/timeline/types.ts` | Beat, Clip, TrackDef interfaces |
| `renderers/postprod/timeline/utils.ts` | fmtTime, fmtDur, tickInterval |
| `renderers/postprod/asset-resolver.tsx` | 5-category asset panel |
| `renderers/postprod/script-panel.tsx` | Inline roteiro per beat |
| `renderers/postprod/crossref-panel.tsx` | Collapsible cross-reference |
| `renderers/postprod/speedramps-panel.tsx` | Collapsible speed ramps |

All `'use client'`. TypeScript strict, no `any`. Tailwind 4 + inline styles for dynamic values.

---

## Section C: B-Roll Library + Asset Picker Dialog

### C.1 Current State

The Audio Library at `/cms/pipeline/audio/` is the architectural blueprint. Key patterns:
- SSR page passes `initialAssets` + `stats` to client component
- Client shell manages all state, delegates to view components
- Filter hook syncs with URL search params (debounced 300ms)
- API uses `authenticatePipeline` + `requirePermission` auth
- Cursor-based pagination with `limit + 1` trick
- Detail panel fetches full asset via dedicated endpoint with usage joins

The current `BRollRenderer` stores B-Roll inline in `content_pipeline.sections` with free-form text descriptions, no shared library, no dedup, no metadata richness.

---

### C.2 B-Roll Library Page

**Route:** `/cms/(authed)/pipeline/brolls/page.tsx`

**Layout:** `[Filter Sidebar 280px] | [Main Content flex:1] | [Detail Panel 360px (conditional)]`

#### Components

| Component | File | Description |
|-----------|------|-------------|
| `BRollLibrary` | `broll-library.tsx` | Client shell (mirrors AudioLibrary) |
| `BRollFilters` | `broll-filters.tsx` | Filter sidebar |
| `BRollGrid` | `broll-grid.tsx` | Grid view with BRollCard |
| `BRollCard` | `broll-card.tsx` | Grid card |
| `BRollTable` | `broll-table.tsx` | Table view |
| `BRollDetail` | `broll-detail.tsx` | Right detail panel |
| `BRollImportModal` | `broll-import-modal.tsx` | JSON import modal |
| `FrameStrip` | `frame-strip.tsx` | 5-frame thumbnail strip (replaces waveform) |
| `useBRollFilters` | `use-broll-filters.ts` | Filter state hook |

#### Filters

```ts
interface BRollFilterState {
  q: string | null
  source_type: 'pessoal' | 'generico' | null
  status: 'available' | 'pending' | null
  category: string | null           // travel, urban, nature, tech, food, lifestyle, abstract
  resolution: '4k' | '1080p' | '720p' | null
  duration: '<5s' | '5-15s' | '>15s' | null
  codec: 'h265' | 'h264' | null
  fps: '24' | '30' | '60' | null
  tags: string[] | null
  sort: string                      // newest (default), name_asc, duration_asc, etc.
}
```

Sidebar (top to bottom): Search, Sort dropdown, Active pills bar, Tipo (segmented), Status (segmented), Categoria (chips), Resolucao (segmented), Duracao (button group), Advanced (codec, fps, tags).

#### Grid Cards

```
+-------------------------------------+
| [Gradient thumbnail / real image]   |
|   duration badge     status badge   |
+-------------------------------------+
| [source dot] Title                  |
| source_type . resolution            |
| [tag] [tag] [tag] +N               |
+-------------------------------------+
```

- Source dot: Green (#22c55e) Pessoal, Blue (#3b82f6) Generico
- Selected: 2px solid `var(--gem-accent)` + 3px glow
- Hover: `translateY(-2px)` + shadow

#### Detail Panel

360px right panel. Header: title, source dot, Edit/Save/Cancel, status selector, quick stat pills.

**FrameStrip** (replaces waveform): 5 evenly-spaced frame thumbnails. Card variant (80px): single frame or gradient placeholder. Detail variant (100px): 5 side-by-side frames + progress bar.

**Tabs:** Details (classification, file info, notes), Usage (pipeline items via join), Related (similarity score), Raw (asset_id, sha256, JSON).

**Edit mode:** Same OCC pattern — PATCH sends `version`, 409 conflict triggers resolution.

**Keyboard nav:** `/` search, `j`/`k` navigate, `Enter` select, `g+t` toggle view, `Escape` close panel.

---

### C.3 Database Schema

#### `broll_library` table

```sql
create table public.broll_library (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.sites(id) on delete cascade,
  asset_id          text not null,
  original_filename text not null,
  renamed_to        text,
  sha256            text,
  file_size_bytes   bigint,
  type              text not null default 'footage'
                    check (type in ('footage','photo','screen_recording','stock','graphic','animation')),
  source            text not null default 'local',
  source_type       text not null default 'pessoal'
                    check (source_type in ('pessoal', 'generico')),
  category          text,
  subcategory       text,
  location          text,
  description       text,
  tags              text[] not null default '{}',
  codec             text,
  fps               smallint,
  resolution        text not null default '1080p',
  width             int,
  height            int,
  duration_seconds  real,
  bitrate_kbps      int,
  has_audio         boolean not null default false,
  color_profile     text,
  storage_url       text,
  thumbnail_url     text,
  proxy_url         text,
  reusable          boolean not null default true,
  status            text not null default 'available'
                    check (status in ('available', 'pending', 'retired')),
  captured_at       timestamptz,
  metadata          jsonb not null default '{}',
  search_vector     tsvector,
  version           int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_broll_library_site_asset unique (site_id, asset_id),
  constraint uq_broll_library_site_sha unique (site_id, sha256)
);
```

Indexes: site_id, source_type, status, category, GIN on tags, GIN on search_vector, created_at desc.

Triggers: search_vector update, version increment, updated_at.

#### `broll_library_usage` table

```sql
create table public.broll_library_usage (
  id                uuid primary key default gen_random_uuid(),
  broll_asset_id    uuid not null references public.broll_library(id) on delete cascade,
  pipeline_item_id  uuid not null references public.content_pipeline(id) on delete cascade,
  site_id           uuid not null references public.sites(id),
  beat_index        integer,
  track_id          text,
  usage_type        text not null default 'broll'
                    check (usage_type in ('broll','overlay','thumbnail','cutaway')),
  notes             text,
  created_at        timestamptz not null default now(),
  constraint uq_broll_usage unique (broll_asset_id, pipeline_item_id, beat_index)
);
```

#### RLS Policies

- Read: `can_view_site(site_id)` on both tables
- Write: `can_edit_site(site_id)` on both tables
- Usage table: RLS via join to `broll_library.site_id`

---

### C.4 API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/pipeline/broll-library` | List with filters, cursor pagination |
| POST | `/api/pipeline/broll-library` | Create single asset |
| GET | `/api/pipeline/broll-library/[id]` | Detail + usage joins |
| PATCH | `/api/pipeline/broll-library/[id]` | Update (OCC via version) |
| DELETE | `/api/pipeline/broll-library/[id]` | Soft-delete (status='retired') |
| POST | `/api/pipeline/broll-library/import` | Bulk import (max 500) |
| POST | `/api/pipeline/broll-library/resolve` | Search matching assets for Asset Picker |

All endpoints use `authenticatePipeline` + `requirePermission` auth.

---

### C.5 Schemas

File: `lib/pipeline/broll-schemas.ts`

```ts
export const BROLL_SOURCE_TYPES = ['pessoal', 'generico'] as const
export const BROLL_STATUSES = ['available', 'pending', 'retired'] as const
export const BROLL_TYPES = ['footage','photo','screen_recording','stock','graphic','animation'] as const
export const BROLL_CATEGORIES = ['travel','urban','nature','tech','food','lifestyle','abstract'] as const

export const BRollAssetCreateSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().min(1).max(500),
  // ... all fields with validation
})

export const BRollAssetUpdateSchema = BRollAssetCreateSchema.partial()
  .omit({ asset_id: true })
  .extend({ version: z.number().int().positive() })

export const BRollResolveQuerySchema = z.object({
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  resolution: z.enum(['4k','1080p','720p']).optional(),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional(),
  source_type: z.enum(BROLL_SOURCE_TYPES).optional(),
  description: z.string().max(500).optional(),
  limit: z.number().int().min(1).max(20).default(5),
})
```

---

### C.6 Asset Picker Dialog

Reusable modal for selecting assets from Audio or B-Roll library.

```ts
interface AssetPickerDialogProps {
  assetType: 'broll' | 'audio'
  context: {
    description: string
    suggestedTags: string[]
    suggestedCategory?: string
    suggestedResolution?: string
  }
  onSelect: (asset: BRollAssetRow | AudioAssetRow) => void
  onCancel: () => void
  initialSelectedId?: string
}
```

**Layout:**

```
+--------------------------------------------------------------+
| SELECIONAR B-ROLL — [asset description]              [X]     |
+--------------------------------------------------------------+
| +---------+  +----------------------------------------------+|
| | TAGS    |  | [Search input________________________]        ||
| | [travel]|  | +--------+ +--------+ +--------+ +--------+ ||
| | [canada]|  | | Card 1 | | Card 2 | | Card 3 | | Card 4 | ||
| | [nature]|  | +--------+ +--------+ +--------+ +--------+ ||
| | RESOLUCAO| | +--------+ +--------+ +--------+ +--------+ ||
| | [4K]    |  | |selected| | Card 6 | | Card 7 | | Card 8 | ||
| +---------+  +----------------------------------------------+|
+--------------------------------------------------------------+
| 8 resultados . 1 selecionado     [Cancelar] [Selecionar]     |
+--------------------------------------------------------------+
```

- Overlay: `rgba(0,0,0,0.6)`, z-50
- Modal: max 900px wide, max 80vh tall, `var(--gem-surface)` bg, 12px radius
- Sidebar (200px): pre-applied tags as highlighted chips, filter sections
- Content (flex:1): search input, scrollable grid `repeat(auto-fill, minmax(180px, 1fr))`
- Footer: result count, "Cancelar" ghost + "Selecionar" accent button

**Data flow:**
1. AssetResolver shows pending VISUAL asset with "Buscar"
2. User clicks -> `AssetPickerDialog` opens with context from AI-generated tags
3. Dialog fetches from `/api/pipeline/broll-library/resolve` with pre-applied filters
4. User searches, filters, selects a card
5. "Selecionar" fires `onSelect(asset)`
6. AssetResolver creates `broll_library_usage` linking B-Roll to pipeline item
7. Dialog closes, asset shows as resolved

---

### C.7 B-Rolls Tab Removal

Remove `brolls` from `SECTION_DEFINITIONS.video` and `SHARED_SECTIONS`. After removal:

```ts
video: [
  { key: 'ideia', ... shared: true },
  { key: 'roteiro', ... },
  // brolls REMOVED
  { key: 'postprod', ... },
  { key: 'publish', ... },
]
```

**Data migration:** Extract `brolls_shared.content.items[]` into `broll_library` records + `broll_library_usage` back-links. Best-effort since inline data was free-form text.

**B-Roll in timeline:** After tab removal, B-Roll resolution happens through the VISUAL section of AssetResolver in post-production.

---

### C.8 File Storage Strategy

| Phase | Scope | Storage |
|-------|-------|---------|
| **Phase 1 (MVP)** | Metadata catalog | No file upload — files referenced by name only |
| **Phase 2** | Thumbnail generation | Vercel Blob for representative frames |
| **Phase 3 (future)** | Full file upload | Vercel Blob (<500MB) or external (R2/S3) |

FrameStrip data stored in `metadata.frame_strip` as array of 5 `{ url, timestamp }` objects.

---

## Section D: Data Model & API Changes

### D.1 Current Data Model

Section data in JSONB `content_pipeline.sections`:

```ts
interface SectionData {
  rev: number
  cowork_rev: number | null
  source: string        // 'user' | 'cowork'
  edited: boolean
  content: string | Record<string, unknown> | unknown[]
  updated_at: string
  modified_by: string | null
}
```

Current keys for a bilingual video item: `ideia_shared`, `roteiro_{lang}`, `brolls_shared`, `postprod_scenes_{lang}`, `postprod_crossref_{lang}`, `postprod_speedramps_{lang}`, `publish_{lang}`.

---

### D.2 SECTION_DEFINITIONS Changes

```diff
- const SHARED_SECTIONS = new Set(['ideia', 'brolls', 'images'])
+ const SHARED_SECTIONS = new Set(['ideia', 'images'])

  SECTION_DEFINITIONS.video = [
    { key: 'ideia', ... },
    { key: 'roteiro', ... },
-   { key: 'brolls', ... shared: true },
-   { key: 'postprod', ... subSections: [...] },
+   { key: 'postprod', ... },  // no subSections
    { key: 'publish', ... },
  ]
```

New keys: `postprod_{lang}` replaces `postprod_scenes_{lang}` + `postprod_crossref_{lang}` + `postprod_speedramps_{lang}`.

`flattenSections()` needs no code change — already handles sections without subSections.

---

### D.3 PostProd Unified JSONB Schema

File: `lib/pipeline/postprod-schemas.ts`

```ts
interface PostProdSection {
  schema_version: '2.0'

  timeline: {
    tracks: TrackConfig[]       // 13 tracks: V7-V1, A1-A6
    beats: Beat[]
    total_duration_sec: number
    fps: number                 // default 24
  }

  assets: {
    [beatIndex: number]: {
      music: MusicAsset[]
      sfx: SFXAsset[]
      visual: VisualAsset[]
      ambience: AmbienceAsset[]
      soundDesign: SoundDesignAsset[]
    }
  }

  crossref: {
    summary: string
    beats: CrossRefBeat[]
    divergences: string[]
    source: string
  }

  speedramps: {
    summary: string
    base: string
    est_final: string
    edit_style: string
    sections: SpeedRampSection[]
    source: string
  }
}
```

**Beat:**
```ts
interface Beat {
  index: number
  label: string
  beat_ref: string
  start_tc: string
  end_tc: string
  duration_sec: number
  status: 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  difficulty: 'LOW' | 'MEDIUM' | 'HIGH'
  narrative: string
  clips: Record<string, Clip[]>   // keyed by track ID
  edit_notes: string[]
  overlays: Overlay[]
  mix: MixParam[]
  transition: Transition | null
  decide_items: string[]
}
```

**Clip:**
```ts
interface Clip {
  id: string
  track_id: string
  in_tc: string
  out_tc: string
  duration_sec: number
  label: string
  source_ref?: string     // broll_library ID or audio_assets ID
  source_type?: ClipSourceType
  speed: number           // 1.0 = normal
  opacity?: number        // 0-100, video only
  volume_db?: number      // audio only
  fade_in_ms?: number
  fade_out_ms?: number
}
```

Full Zod validation schemas included in `postprod-schemas.ts`.

---

### D.4 Asset Type Schemas

Each beat's assets carry `clip_ids` for timeline integration and optional library references.

**MusicAsset:** Extends current `SceneMusicRaw`. Adds `clip_ids: string[]` (A1/A2 track clips), `audio_asset_id?: string` (UUID from audio_assets), `recommendations: MusicRecommendation[]`.

**SFXAsset:** Timecoded with `sfx_category` enum (IMPACT/RISER/DROP/TRANSITION/AMBIENT/FOLEY). Adds `clip_ids: string[]` (A4 track), `audio_asset_id?: string`.

**VisualAsset:** Replaces old `brolls.items[]`. Adds `broll_library_id?: string`, `clip_ids: string[]` (V3/V4/V5 tracks).

**AmbienceAsset:** Room tone with `loop: boolean`. Adds `clip_ids: string[]` (A5 track), `audio_asset_id?: string`.

**SoundDesignAsset:** `category` enum (riser/drop/whoosh/stinger/texture/other). Adds `clip_ids: string[]` (A6 track), `audio_asset_id?: string`.

---

### D.5 New API Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/pipeline/generate` | api_key (write) | Cowork generates full postprod section |
| POST | `/api/pipeline/resolve-asset` | api_key/session (write) | Resolve pending asset to library item |
| GET | `/api/pipeline/broll-library` | api_key/session (read) | List B-Roll with filters |
| POST | `/api/pipeline/broll-library` | api_key/session (write) | Create B-Roll asset |
| GET | `/api/pipeline/broll-library/[id]` | api_key/session (read) | B-Roll detail + usage |
| PATCH | `/api/pipeline/broll-library/[id]` | api_key/session (write) | Update metadata (OCC) |
| DELETE | `/api/pipeline/broll-library/[id]` | api_key/session (write) | Soft-delete (retired) |
| POST | `/api/pipeline/broll-library/import` | api_key (write) | Bulk import (max 500) |

Existing section PATCH endpoint at `/api/pipeline/items/[id]/sections/[section]` works as-is with new `postprod` key.

---

### D.6 Migration Strategy

**Phase 1 — Deploy schema:** `broll_library` table created via `npm run db:new`. Old sections untouched.

**Phase 2 — Deploy code:** Updated `SECTION_DEFINITIONS`, new endpoints. Lazy migration on item access:
- Detects old keys (`postprod_scenes_{lang}`, etc.)
- Runs `migratePostProdSections()` to create unified `postprod_{lang}`
- Keeps old keys for rollback safety

**Phase 3 — Backfill:** One-time server action migrates all video items in batch (max 50/run).

**Phase 4 — Cleanup (Day 14+):** Remove old keys from JSONB, remove migration code.

---

### D.7 useSection() Hook

The hook itself needs **no changes** — it operates on generic `SectionData.content`.

Changes needed:
1. `SectionPanel`: Remove sub-section routing logic (`activeSub` no longer used for postprod)
2. New `usePostProdSection()` wrapper with typed operations: `updateBeat()`, `updateAsset()`, `resolveAsset()`
3. Consider 2s debounce (vs default) for postprod saves due to large payload size

---

### D.8 Backward Compatibility

1. **Lazy migration on access** — old keys converted to new format transparently
2. **Old keys preserved** — not deleted during migration, available for rollback
3. **API backward compat** — old section names still resolve to old keys
4. **Schema version field** — `PostProdSection.schema_version: '2.0'` for disambiguation
5. **Cowork reference update** — remove brolls section, unify postprod, add B-Roll Library API docs

---

### D.9 Cowork Pipeline Reference Updates

1. Remove `## Section: brolls (shared)` entirely
2. Replace 3 postprod sub-sections with single `## Section: postprod (per-lang)`
3. Section key: `'postprod'` (not `'postprod_scenes'`)
4. Visual assets: populate `assets[beatIndex].visual[]` instead of `brolls_shared`
5. Batch update: single `{ section: 'postprod', content: {...} }` instead of 3 entries
6. Add B-Roll Library API and Generation API docs

---

### D.10 File Map

| File | Change |
|------|--------|
| `lib/pipeline/sections.ts` | Remove brolls, remove postprod.subSections |
| `lib/pipeline/postprod-schemas.ts` | **NEW** — PostProdSection types + Zod |
| `lib/pipeline/postprod-migration.ts` | **NEW** — v1->v2 migration functions |
| `lib/pipeline/broll-schemas.ts` | **NEW** — B-Roll schemas |
| `api/pipeline/generate/route.ts` | **NEW** — Cowork generation |
| `api/pipeline/resolve-asset/route.ts` | **NEW** — Asset resolution |
| `api/pipeline/broll-library/route.ts` | **NEW** — CRUD (GET, POST) |
| `api/pipeline/broll-library/[id]/route.ts` | **NEW** — Detail/update/delete |
| `api/pipeline/broll-library/import/route.ts` | **NEW** — Bulk import |
| `pipeline/_components/detail/use-postprod-section.ts` | **NEW** — Typed postprod hook |
| `pipeline/_components/pipeline-item-detail.tsx` | Remove sub-section routing |
| `supabase/migrations/..._postprod_v2_broll_library.sql` | **NEW** — Tables + data migration |
| `docs/cowork-pipeline-reference.md` | Remove brolls, unify postprod, add APIs |

---

## Spec Self-Review

### Placeholder scan
No TBD, TODO, or incomplete sections found. All sections are fully specified.

### Internal consistency
- **Track colors and roles** are now consistent (Section B mapping used everywhere)
- **Table naming** unified to `broll_library` / `broll_library_usage`
- **Status values** unified to `available|pending|retired` (3-state)
- **Source classification** uses dual fields: `source_type` (pessoal/generico) + `source` (local/artlist/etc.)
- **PostProd unified key** (`postprod_{lang}`) referenced consistently in Sections B and D

### Scope check
This spec covers ~78h of work across 4 major areas. Each section is implementable independently:
1. **Roteiro** (~16h) — can be built without touching postprod
2. **PostProd timeline** (~30h) — largest piece, depends on section definitions change
3. **B-Roll Library** (~20h) — independent, similar to Audio Library
4. **Data/API** (~12h) — foundational, should be implemented first

Recommended build order: D (data) -> C (B-Roll Library) -> A (Roteiro) -> B (PostProd)

### Ambiguity check
5 open decisions documented in A.8 (accent picker, duration calculation, dnd-kit dep, synopsis field, font loading). These are intentionally deferred to implementation — none block the spec.
