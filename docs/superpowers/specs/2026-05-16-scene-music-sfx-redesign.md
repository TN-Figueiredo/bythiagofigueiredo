# Scene Music & SFX Recommendation UI Redesign

**Date:** 2026-05-16
**Component:** `scene-guide-renderer.tsx`
**Status:** Design spec

---

## 1. Overview

Transform the Music and SFX sections in the scene-guide renderer from basic status badges into a full recommendation engine UI with editorial reasoning, score breakdowns, alternatives with delta comparisons, and actionable Artlist links.

Key principles:

- Cowork (AI agent) resolves tracks during creation/PATCH and saves recommendations in the scene JSON.
- No live API calls from the renderer. All data is pre-computed by Cowork.
- The renderer is a read-only presentation layer over pre-resolved data.

---

## 2. Data Model Changes

### SceneMusic interface

```typescript
interface SceneMusic {
  track: string
  artist: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status?: 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'
  score?: number
  score_breakdown?: Record<string, { score: number; max: number }>
  // NEW fields:
  reasoning?: string // Cowork's editorial reasoning for this pick
  recommendations?: Array<{
    track: string
    artist: string
    original_filename?: string
    audio_asset_id?: string
    resolve_status: 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'
    score: number
    score_max: number // always 34 for music (description category scores 0)
    score_breakdown?: Record<string, { score: number; max: number }>
    reasoning?: string // one-liner: why consider this alternative
    delta_vs_favorite?: Record<string, number> // e.g. { tags: -2, mood: -2, reuse: -4 }
    category?: string
    energy?: number // 1-5
    bpm?: number
    key?: string
    duration?: string // "3:42"
    artlist_url?: string // direct song URL
  }>
  favorite_index?: number // which recommendation is the starred favorite (default 0)
  search_terms?: string
  artlist_url?: string // fallback search URL
  style?: string
  entry_cue?: string
  continuation?: string
}
```

### SceneSFX interface

```typescript
interface SceneSFX {
  timestamp: string
  description: string
  search_terms?: string
  audio_asset_id?: string
  resolve_status?: 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'
  // NEW fields:
  sfx_category?: 'IMPACT' | 'RISER' | 'DROP' | 'TRANSITION' | 'AMBIENT' | 'FOLEY'
  original_filename?: string
  score?: number
  score_max?: number // always 34 (same scoring engine as music)
  artlist_url?: string
}
```

---

## 3. Component Architecture

### New components

| Component | Purpose |
|-----------|---------|
| `MusicRecommendationCard` | Starred favorite card, expandable with full metadata |
| `MusicAlternativeRow` | Compact row for alternatives with delta notes |
| `SFXItemCard` | SFX row with category pill, score, search chips |
| `ScoreGauge` | SVG donut mini-component (reusable) |
| `EnergyIndicator` | Energy level display (filled/empty dots, 1-5) |
| `CoworkReasoning` | Italic blockquote with tinted background |

### Modified components

| Component | Change |
|-----------|--------|
| `AudioSummary` | Split progress bars (Musica % / SFX %), jump links, no legend |
| Scene music section | Renders recommendation cards instead of flat text |

---

## 4. Visual Design

### Color semantics (strict)

| Status | Color | Hex |
|--------|-------|-----|
| LOCAL | Green | #10b981 |
| PENDING_MATCH | Amber | #f59e0b |
| PARTIAL_MATCH | Orange | #f97316 |
| NO_MATCH badge icon | Blue | #3b82f6 |
| Editorial guidance / Music Artlist CTAs | Purple | #c084fc |
| Accent (timestamps, BPM, key) | Indigo | #818cf8 |
| SFX Artlist search chip links | Amber-gold | #fbbf24 |

### Card states by resolve_status

1. **LOCAL** (green card): Full expanded view with score gauge, reasoning, filename, metadata. Score breakdown with gradient coloring.

2. **PENDING_MATCH** (amber card): Collapsed with download CTA always visible (primary action). Expand for metadata.

3. **PARTIAL_MATCH** (orange card): Similar to LOCAL but lower visual prominence.

4. **NO_MATCH** (purple card): Editorial guidance with inline artist references, clickable search chips, progressive filter CTAs.

5. **Continuation** (gray border-left): Minimal card with return symbol, "continua do Beat X" badge, volume/exit instructions, "ver Beat X" link. No search functionality.

### Score breakdown gradient

| Condition | Color | Hex |
|-----------|-------|-----|
| N/N (full) | Bright green | #10b981 |
| >50% partial | Light green | #34d399 |
| <=66% partial | Amber | #f59e0b |
| 0/N | Dim gray | #4b5563 |

### SFX category colors

| Category | Background | Text |
|----------|-----------|------|
| IMPACT | rgba(239,68,68,0.1) | #f87171 |
| RISER | rgba(16,185,129,0.1) | #34d399 |
| DROP | rgba(245,158,11,0.1) | #fbbf24 |
| TRANSITION | rgba(14,165,233,0.1) | #38bdf8 |
| AMBIENT | rgba(107,114,128,0.1) | #9ca3af |
| FOLEY | rgba(107,114,128,0.1) | #9ca3af |

### AudioSummary redesign

- Split progress bars: "Musica X%" and "SFX Y%" each with segmented bar.
- Segments: green (LOCAL), amber (PENDING), orange (PARTIAL), empty (NO_MATCH).
- Resolved = LOCAL + PENDING + PARTIAL (all have files, varying confidence).
- Stats rendered as jump links: N local, N download, N parcial, N buscar, N cont.

---

## 5. Interaction Model

- Favorite card is COLLAPSED by default. Shows one-line reasoning + score gauge. Click to expand full details.
- Alternatives always show: name, artist, status, category, energy, score bar, one-liner reasoning, delta notes. Click to expand full metadata.
- PENDING_MATCH: Download CTA always visible, never behind an expand toggle.
- NO_MATCH: Chips are clickable Artlist links when the term maps to an Artlist filter ID (suffixed with external-link icon). Static chips for unmapped terms.

---

## 6. API Reference Update Required

After implementation, `docs/cowork-pipeline-reference.md` needs updating with:

- New `recommendations` array fields on music objects
- New `sfx_category` field
- New `reasoning` field
- New `score_breakdown` format
- New `delta_vs_favorite` format
- Updated example JSON blocks

---

## 7. Files to Modify

### Primary

- `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`

### May need updates

- `apps/web/src/lib/pipeline/audio-resolver.ts` (if score_breakdown format changes)
- `apps/web/src/lib/pipeline/audio-schemas.ts` (if new Zod schemas needed)
- `apps/web/src/lib/pipeline/artlist-search.ts` (already has `buildArtlistMusicUrl`, may need `buildArtlistSfxUrl`)
- `docs/cowork-pipeline-reference.md` (API reference for Cowork)

---

## 8. Testing Strategy

- Unit tests for ScoreGauge math (dasharray calculation)
- Unit tests for score gradient color logic
- Unit tests for delta calculation (score_breakdown diff)
- Snapshot/render tests for each card state (LOCAL, PENDING, PARTIAL, NO_MATCH, continuation)
- Integration test: AudioSummary counting logic with split percentages

---

## 9. Out of Scope

- Audio playback in the renderer (future feature)
- Real waveform rendering (no data available)
- Drag-and-drop reordering of recommendations
- Inline editing of Cowork's reasoning

---

## 10. Implementation Notes

- **Max score is 34** (not 36). The `description` category in `scoreAsset()` always yields 0 — it uses full-text search for filtering, not scoring. Breakdown: category(5) + tags(8) + mood(6) + energy(3) + bpm(3) + duration(2) + reuse_scenarios(4) + instruments(3) = 34.
- Expand/collapse uses local React state (`useState` per card).
- Score gauge SVG: `stroke-dasharray = (score/max * 94) (94 - score/max * 94)` where 94 approximates 2*pi*r with r=15 (circumference = 94.2).
- Continuation detection: existing `isContinuationTrack()` regex in the renderer.
- Artlist URL building: existing `buildArtlistMusicUrl()` in `artlist-search.ts`.
- SFX Artlist URLs: `https://artlist.io/royalty-free-sound-effects?search={encoded_terms}`
