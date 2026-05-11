# Pipeline Renderer Visual Hierarchy — Script & Scene Guide

**Date:** 2026-05-11
**Status:** Draft
**Scope:** Visual hierarchy improvements for `ScriptRenderer` (roteiro) and `SceneGuideRenderer` (Cena × Cena) in the pipeline item detail page.

## Context

The pipeline renderers display structured editing instructions for video production. Both the Script (roteiro) and Scene Guide (Cena × Cena) sections currently render all content as uniform plain text, making it difficult for the video editor to scan and find critical information quickly.

**Script (roteiro):** Beat text contains inline tags like `[VISUAL: ...]`, `[TOM: ...]`, `[B-ROLL: ...]`, `[CORTE: ...]`, `[PAUSE X.Xs]`, plus structural elements like `MINI-HOOK:`, `TALKING POINTS:`, `TRANSITION:`. Currently rendered as monospace `text-[11px]` via `contentEditable` with zero parsing.

**Scene Guide (Cena × Cena):** `edit_notes: string[]` contains mixed instruction types — music directions, timing marks, style directives, overlay instructions, continuity notes. Currently rendered as identical `<li>` bullet points with no visual differentiation.

### Key Files

| File | Component | Role |
|------|-----------|------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/script-renderer.tsx` | `ScriptRenderer` | Renders beat cards with script text |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx` | `SceneGuideRenderer` | Renders scene cards with edit notes and structured subsections |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/section-content.tsx` | `SectionContent` | Registry that routes section types to renderers |
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/status-badge.tsx` | `StatusBadge` | Shared status badge component |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parsing approach | Regex on render, no data migration | Tags exist as plain text in beat.text and edit_notes strings. Parse visually in the renderer, don't restructure stored data. |
| Tag rendering | Compact pills + colored text | Pill badges with category-specific colors. No emojis — uppercase text is more professional. |
| Narration vs instructions | Distinct visual lanes | Narration (spoken text) gets left-border + gradient bg. Instructions get pill + colored text. Clear at a glance. |
| Timestamp treatment | Monospace chips + timeline (scenes) | Timestamps are critical anchors for the editor. Inline chips in script, vertical timeline in scenes. |
| Negative emphasis | Red highlight | Words like "NÃO", "not" in instructions get red background — these are the most dangerous to miss. |
| Keyword emphasis | Yellow bold | Emphasized words in narration (HAVE, WANT) get yellow bold treatment. |
| Edit mode | Degrade gracefully | When `isEditing=true`, strip HTML rendering and show raw text in the existing contentEditable. Visual parsing is read-only. |
| Category detection (scenes) | Regex heuristic + fallback | Auto-detect category from note content. Unmatched notes get gray "NOTE" pill. |

## 1. Script Renderer — Tag Parsing System

### 1.1 Tag Taxonomy

6 tag types parsed from beat text, each with a distinct color:

| Tag Pattern | Category | Pill Text | Color Family |
|-------------|----------|-----------|-------------|
| `[VISUAL: ...]` | Camera/shot direction | `VISUAL` | Purple (#a78bfa) |
| `[TOM: ...]` | Tone/delivery direction | `TOM` | Cyan (#67e8f9) |
| `[B-ROLL: ...]` | B-roll footage | `B-ROLL` | Emerald (#6ee7b7) |
| `[CORTE: ...]` | Edit cut instruction | `CORTE` | Red (#fca5a5) |
| `[PAUSE X.Xs]` | Pause marker | Inline chip | Amber (#fbbf24) |
| `Text overlay` prefix in VISUAL tag content | Overlay | `OVERLAY` | Pink (#f9a8d4) |

Plus structural sections parsed from beat text:

| Pattern | Treatment |
|---------|-----------|
| `MINI-HOOK:` | Sub-section with label divider |
| `TALKING POINTS:` / bullet lists | Sub-section with structured `<ul>` |
| `TRANSITION:` | `TRANS` pill (amber) |
| `Promessa:` / `Credencial:` | Metadata inline chips |

### 1.2 Parsing Strategy

A `parseScriptTags(text: string)` function splits beat text into an ordered array of typed segments:

```typescript
type ScriptSegment =
  | { type: 'tag'; tag: 'VISUAL' | 'TOM' | 'B-ROLL' | 'CORTE' | 'OVERLAY' | 'TRANS'; content: string }
  | { type: 'narration'; content: string }
  | { type: 'pause'; duration: string }
  | { type: 'section'; label: string; content: string }
  | { type: 'meta'; key: string; value: string }
```

Regex patterns (applied in order):
1. `\[VISUAL:\s*(.+?)\]` → tag segment
2. `\[TOM:\s*(.+?)\]` → tag segment
3. `\[B-ROLL:\s*(.+?)\]` → tag segment (also `\[B-ROLLi?:\s*(.+?)\]` for typos)
4. `\[CORTE:\s*(.+?)\]` → tag segment
5. `\[PAUSE\s+([\d.]+s)\]` → pause segment
6. Quoted text (`"..."`) → narration segment
7. `MINI-HOOK:`, `TALKING POINTS:`, `TRANSITION:` → section segments
8. `Promessa:`, `Credencial:` → meta segments

**VISUAL → OVERLAY promotion:** If a `[VISUAL: ...]` tag's content starts with "Text overlay" or "Lower third", re-classify it as an OVERLAY segment. This handles the common pattern where overlay instructions are written inside VISUAL tags.

Within any segment's content text:
- Timestamps matching `\d{2}:\d{2}` → `<span class="ts">` chip
- `NÃO` / `NOT` (case-insensitive, word boundary) → `<span class="neg">` highlight
- ALL-CAPS words 3+ chars within narration → `<span class="emph">` yellow bold

### 1.3 Visual Layout

```
┌─ Beat Card ──────────────────────────────────┐
│ #0  HOOK — Triple Curiosity Gap    [Gravado] │
├──────────────────────────────────────────────┤
│ ┌ instruction-cluster ─────────────────────┐ │
│ │ [VISUAL] 00:00 3s — montage rápida ...   │ │
│ │ [TOM]    calmo, confiante, NÃO dramático │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ▌ "I lived in Canada for four years.        │
│ ▌  Good job. Good salary. Good life.        │
│ ▌  ⏸ 0.5s  I chose to move back..."        │
│                                              │
│  Promessa  Why each move → the plan → Asia   │
│  Credencial  Implícita — experiência real     │
└──────────────────────────────────────────────┘
```

**Instruction clusters:** Consecutive tag segments group inside a `div` with `border-left: 1px solid var(--gem-border)`. This creates visual grouping without adding weight.

**Narration blocks:** `border-left: 2px solid #475569`, `background: linear-gradient(90deg, #1e293b50, transparent)`. Font-size 13px (larger than instructions at 11.5px) — narration is the primary content.

**Pause chips:** Inline `⏸ 0.5s` in amber, monospace, within narration flow.

### 1.4 Edit Mode Behavior

When `isEditing=true`, the parsed view is replaced with the existing raw `contentEditable` div showing the original text with tags. The visual parsing is read-only. This avoids the complexity of editing structured HTML while maintaining the current edit workflow.

## 2. Scene Guide — Edit Notes Enhancement

### 2.1 Note Category Detection

Auto-categorize each `edit_notes` string by content heuristics:

| Category | Pill | Color | Detection Heuristic |
|----------|------|-------|-------------------|
| Music | `MUSIC` | Purple (#c084fc) | Contains "search artist", "mood:", "genre:", "BPM", "track" |
| Style | `STYLE` | Cyan (#67e8f9) | Contains "style:", "feel", "think", "tone" |
| Timing | `TIMING` or `ENTRY` | Indigo (#a5b4fc) | Starts with timestamp or contains "fade in/out", "entry:" |
| Visual | `VISUAL` | Purple (#a78bfa) | Contains "montage", "Ken Burns", "B-roll", "photo" |
| Overlay | `OVERLAY` | Pink (#f9a8d4) | Contains "text overlay", "lower third", "overlay" |
| Flow | `FLOW` | Amber (#fbbf24) | Contains "continues", "don't change", "same track", "track change" |
| Note | `NOTE` | Gray (#94a3b8) | Fallback — no pattern matched |

Detection order matters — first match wins. "Style" before "Note" ensures style directives aren't swallowed by the fallback.

### 2.2 Inline Token Parsing

Within each note's text, apply inline highlighting:

| Token | Regex | Treatment |
|-------|-------|-----------|
| Timestamps | `\d{2}:\d{2}([-–]\d{2}:\d{2})?` | Monospace chip, indigo bg |
| dB values | `-?\d+dB` | Monospace chip, amber bg |
| Negations | `\bnot\b`, `\bNÃO\b` (word-boundary) | Red bg + bold |
| Optional | Line starts with "Optional" | Gray `OPT` badge prepended |
| Emphasis | ALL-CAPS words 4+ chars (HAVE, WANT) | Yellow bold |

### 2.3 Layout: Non-temporal vs Temporal

Split edit notes into two zones:

**Zone 1 — Context (top):** Notes without timestamps. Style directives, flow/continuity notes, music mood. These set the context before the editor reads the timeline.

**Zone 2 — Timeline (below):** Notes with timestamps, rendered in a vertical timeline:

```
┌─ Scene Card ────────────────────────────────┐
│ 2  Scene 2   Beat 1 · ~1m35    [Done]  ▲   │
├─────────────────────────────────────────────┤
│ Canada chapter — grind, growth, the question│  ← narrative summary (italic)
│                                             │
│ ── Notas de Edição ────────────────────     │
│ [FLOW]  Continue ambient, -20dB under voice │  ← non-temporal
│                                             │
│ ● 00:20 ─────────────────────────────       │  ← timeline starts
│ │ [VISUAL] OPT B-roll Canada, Ken Burns     │
│ │                                           │
│ ● 00:51 ─────────────────────────────       │
│ │ [OVERLAY] "Staples. Restaurants." 3s      │
│ │                                           │
│ ● 01:10 ─────────────────────────────       │
│ │ [OVERLAY] "March 2019 — First Dev Job" 3s │
│ │                                           │
│ ● 01:42 ─────────────────────────────       │
│ │ [TIMING] Drop music to -25dB              │
│ │ [OVERLAY] "Am I here because I HAVE to—"  │
│                                             │
│ ── SFX ────────────────────────────────     │
│ 01:42  Brief silence — dramatic pause       │
│                                             │
│ ── Mix ────────────────────────────────     │
│ Voice  -6dB base, compression 2:1           │
│ Music  -20dB → -25dB at 01:42              │
│                                             │
│ ── Transição ──────────────────────────     │
│ Cross-dissolve — suave, tom reflexivo       │
└─────────────────────────────────────────────┘
```

**Timeline implementation:** CSS `::before` pseudo-element for the vertical line, `::before` circles on each `.tl-point`. Notes at the same timestamp group in a `note-cluster` with shared `border-left`.

### 2.4 Narrative Summary

New optional field rendered at the top of each scene body: `scene.narrative` (already in the data model). If present, render as italic gray text providing quick context. No data migration needed — field already exists.

### 2.5 Structured Subsections (existing — enhanced)

The existing subsections (Music, SFX, Overlays, Mix, Transition) remain and get token parsing applied:
- dB values in Mix grid get `.db` styling
- Timestamps in SFX/Overlays get `.ts` styling
- Consistent with edit_notes token treatment

### 2.6 DECIDE Block (existing — unchanged)

The `decide_items` rendering stays as-is — red background, warning icon. Already effective.

## 3. Shared Token Components

Extract reusable inline token components used by both renderers:

```typescript
// In a shared file: renderers/tokens.tsx

function TimestampChip({ ts }: { ts: string })     // monospace, indigo
function DbChip({ value }: { value: string })       // monospace, amber
function PauseChip({ duration }: { duration: string }) // inline, amber
function NegHighlight({ text }: { text: string })    // red bg + bold
function EmphHighlight({ text }: { text: string })   // yellow bold
function OptionalBadge()                              // gray "OPT"
function TagPill({ tag }: { tag: string })           // colored pill by tag name
```

Color mapping lives in a `TAG_COLORS` record keyed by tag name, returning `{ pill: { bg, color, border }, text: color }`.

## 4. Performance Considerations

- **Regex parsing per render:** Beat texts are typically 200-800 chars. Scene edit_notes are 5-15 items of 50-200 chars each. Regex parsing on every render is acceptable.
- **No memoization needed initially:** The components already re-render only on content change. Add `useMemo` on the parsed output if profiling shows issues.
- **contentEditable switch:** The script renderer already has `isEditing` gating. The parsed view replaces the raw view; switching is a simple conditional.

## 5. Non-Goals

- **No data model changes.** All improvements are renderer-level parsing of existing string data.
- **No new API endpoints.** The data already arrives with the correct shape.
- **No AI-assisted categorization.** Regex heuristics are sufficient and predictable.
- **No edit mode for the parsed view.** Editing stays in raw text mode.

## 6. Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Regex misparses nested brackets | Greedy-to-lazy switch: `(.+?)` not `(.+)`. Test with real beat content. |
| Category detection wrong for ambiguous notes | Fallback "NOTE" category (gray). Detection order is priority-ranked. |
| Timeline too long with 10+ timestamps | Collapsible timeline with "show all N timestamps" toggle if > 6 points. |
| Performance on long scripts | `parseScriptTags` output memoized with `useMemo(fn, [beat.text])`. |
| contentEditable cursor issues | Edit mode shows raw text only — no HTML parsing in edit mode. |

## Visual Mockups

Interactive mockups available at `.superpowers/brainstorm/` (run visual companion server to view):
- `04-roteiro-v4.html` — Final script renderer design (98/100)
- `07-scenes-v3.html` — Final scene guide design (98/100)
