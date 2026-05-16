# Music Hero Redesign — Pipeline Post-Production Scene View

**Date:** 2026-05-16  
**Status:** Approved  
**Replaces:** Current `MusicSection` / `MusicRecommendationCard` / `MusicAlternativeRow` implementation

---

## 1. Overview

The music recommendation section in the Pipeline post-production scene view (`SceneGuideRenderer`) is being completely redesigned. In the current implementation, music renders as a `SubSection` titled "Música" that appears **after** "Notas de Edição" in the `SceneCard` body. It shows at most one `MusicRecommendationCard` (the `favorite` derived from `music.favorite_index`) and lists remaining alternatives as secondary rows via `MusicAlternativeRow`. When `music.recommendations` is absent it falls back to a plain text `MusicFallback` block.

The redesign promotes music to a **Music Hero** positioned at the top of each scene's expanded body, immediately after the narrative block and before everything else. It always renders exactly three ranked recommendation slots, padding any missing slots with Artlist search CTAs rather than leaving them empty. Additionally, edit notes that carry categories `MUSIC`, `STYLE`, `ENTRY`, or `FLOW` — currently displayed verbatim in the "Notas de Edição" subsection — are absorbed into the Music Hero card and suppressed from the notes list when `scene.music` is present.

---

## 2. Architecture — Render Order Change

### 2.1 Current Render Order in `SceneCard`

The expanded body of `SceneCard` (`scene-guide-renderer.tsx`, lines 427–529) renders subsections in the following order:

1. **`scene.narrative`** — italic dim text block, separated by a bottom border (lines 429–435)
2. **`scene.edit_notes`** — `<SubSection title="Notas de Edição">` containing `<CategorizedNotes notes={scene.edit_notes} />` (lines 438–441); all note categories rendered unconditionally
3. **`scene.music`** — `<SubSection title="Música">` containing either `<MusicSection>` (when `recommendations` exist) or `<MusicFallback>` (lines 444–458)
4. **`scene.sfx`** — `<SubSection title="SFX">` with per-item `<SFXItemCard>` (lines 460–479)
5. **`scene.overlays`** — `<SubSection title="Overlays">` (lines 481–492)
6. **`scene.mix`** — `<SubSection title="Mix">` (lines 494–506)
7. **`scene.transition`** — `<SubSection title="Transição">` (lines 508–514)
8. **`decide_items`** — red alert block (lines 516–527)

### 2.2 New Render Order

1. **`scene.narrative`** — unchanged
2. **MUSIC HERO** — new top-level `MusicHeroSection` component, rendered when `scene.music` exists; always shows 3 ranked slots, fills empty slots with Artlist search CTAs, inlines absorbed notes
3. **`scene.edit_notes` (filtered)** — `<SubSection title="Notas de Edição">` now receives only notes whose category is **not** in `{ MUSIC, STYLE, ENTRY, FLOW }` when `scene.music` is present; omitted entirely if filtered list is empty
4. **`scene.sfx`** — unchanged
5. **`scene.overlays`** — unchanged
6. **`scene.mix`** — unchanged
7. **`scene.transition`** — unchanged
8. **`decide_items`** — unchanged

### 2.3 Changes in `SceneCard` JSX

- **Remove** the existing `{scene.music && <SubSection title="Música" ...>}` block (lines 444–458)
- **Insert** `<MusicHeroSection music={scene.music} sceneIndex={sceneIndex} />` immediately after the `scene.narrative` block
- **Replace** the `edit_notes` block's `<CategorizedNotes notes={scene.edit_notes} />` with `<CategorizedNotes notes={filteredNotes} />`
- **Gate** the `edit_notes` SubSection on `filteredNotes.length > 0`

### 2.4 Note Absorption Logic

```ts
const MUSIC_ABSORBED_CATEGORIES: NoteCategory[] = ['MUSIC', 'STYLE', 'ENTRY', 'FLOW']

const { filteredNotes, musicNotes } = useMemo(() => {
  if (!scene.edit_notes || !scene.music) {
    return { filteredNotes: scene.edit_notes ?? [], musicNotes: [] }
  }
  const categorized = scene.edit_notes.map(n => ({ raw: n, ...categorizeNote(n) }))
  return {
    filteredNotes: categorized
      .filter(n => !MUSIC_ABSORBED_CATEGORIES.includes(n.category))
      .map(n => n.raw),
    musicNotes: categorized
      .filter(n => MUSIC_ABSORBED_CATEGORIES.includes(n.category))
      .map(n => n.raw),
  }
}, [scene.edit_notes, scene.music])
```

---

## 3. Component Design — Music Hero

### 3.1 New Components

#### `MusicHeroSection`

Top-level wrapper replacing current `MusicSection`.

```ts
interface MusicHeroSectionProps {
  music: SceneMusic
  sceneIndex: number
}
```

Render tree:
- Header row: ♪ icon + "Música" label + entry_cue badge + FillIndicator + Re-resolve CTA
- Style context line (when `music.style` is set)
- Slot area: MusicHeroCard (slot #1) + MusicAlternativeSlot (slots #2, #3)
- When `music.continuation` is set: replaces slot area with MusicContinuationCard

#### `MusicHeroCard`

Hero treatment for the #1 recommended track.

```ts
interface MusicHeroCardProps {
  recommendation: MusicRecommendation
  music: SceneMusic
}
```

Visual spec:
- Border: `3px solid left` using `RESOLVE_COLORS[status].color`
- Background: `linear-gradient(135deg, status.bg@0.06, status.bg@0.01)`
- Row 1: ★ badge + track (13px bold) + artist (11px) + status badge + **score percentage (28px)**
- Row 2: WaveformMini (width=120, height=32) + duration badge
- Metadata chips: category, energy, BPM, key
- Flow indicator: "→ continua na cena N" (when `music.flow_to` is set)
- Collapsible reasoning with "mais" toggle
- Expandable ScoreBreakdown panel

Score percentage color thresholds (from `getScoreColor`):
- ≥75% → `#10b981` (green)
- ≥50% → `#f59e0b` (amber)
- ≥25% → `#f97316` (orange)
- <25% → `#6b7280` (gray)

#### `MusicAlternativeSlot`

Compact card for slots #2 and #3. Handles both filled and empty states.

```ts
interface MusicAlternativeSlotProps {
  recommendation: MusicRecommendation  // always present; check rec.is_empty_slot for state
  slotIndex: 2 | 3                     // 1-indexed display number (slot #2, #3)
  searchTier: 'narrow' | 'medium' | 'broad'
  searchUrl?: string
  searchTerms?: string
}
```

> **Note on indexing:** Components use 1-indexed display labels (#1, #2, #3) for user-facing text. The resolver uses 0-indexed `slot_index` (0, 1, 2) internally. Mapping: display = slot_index + 1.

**Filled state** (recommendation !== null):
- Row: index + track (11px) + artist (10px) + status badge + **percentage (16px)**
- Delta vs #1 below row (collapsed)
- Download CTA when `PENDING_MATCH`
- Expandable: reasoning + metadata + ScoreBreakdown

**Empty state** (`recommendation.is_empty_slot === true`):
- Dashed border: `1px dashed rgba(59,130,246,0.25)`
- Tier label badge (narrow="mesmos filtros", medium="sem BPM", broad="filtros amplos")
- Search terms hint in italic monospace
- Artlist search link CTA
- Workflow steps: ① Baixar → ② Importar → ③ Re-resolver

#### `MusicContinuationCard`

For scenes where track continues from a previous scene.

```ts
interface MusicContinuationCardProps {
  music: SceneMusic
  sourceSceneLabel: string  // e.g., "cena 1" — derived from music.continuation
  sourceSceneIndex: number  // numeric index for display (parsed from label)
}
```

- ↩ icon + track name + artist + "✓ Local" badge
- "score da cena N" context line
- Continuation reasoning in italic

#### `ScoreBreakdown`

Expandable 8-category score breakdown panel.

```ts
interface ScoreBreakdownProps {
  breakdown: Record<string, { score: number; max: number }>
}
```

- 2-column CSS grid with progress bars
- Categories: category(5), tags(8), mood(6), energy(3), bpm(3), duration(2), reuse(4), instruments(3)
- Color from `getBreakdownColor(score, max)`
- Total bar at bottom with gradient fill

#### `FillIndicator`

Three-dot completion indicator.

```ts
interface FillIndicatorProps {
  filled: number  // 0-3
  total: 3
  status: 'green' | 'amber' | 'red' | 'dim'
}
```

- 3 dots (8px circles, gap-3px)
- Filled: colored per status. Empty: `rgba(255,255,255,0.08)` with dashed border
- `role="img"` + `aria-label="{filled} de 3 slots preenchidos"`

### 3.2 Removed Components

| Component | Replaced by |
|-----------|------------|
| `MusicSection` (scene-guide-renderer.tsx) | `MusicHeroSection` |
| `MusicRecommendationCard` | `MusicHeroCard` |
| `MusicAlternativeRow` | `MusicAlternativeSlot` |
| `ScoreGauge` | Large percentage text (28px) |
| `ScoreBar` | Percentage text (16px) in alternatives |

Retained unchanged: `score-utils.ts`, `energy-indicator.tsx`, `cowork-reasoning.tsx`

### 3.3 Visual Hierarchy

| Element | Hero (#1) | Alternative (#2, #3) | Empty Slot |
|---------|-----------|---------------------|------------|
| Score | 28px bold | 16px bold | — |
| Track name | 13px bold | 11px medium | — |
| Border | 3px left colored | 1px solid subtle | 1px dashed blue |
| Background | gradient | flat 0.02 | flat 0.01 |
| Waveform | Yes (32px) | No | No |
| Metadata | Full chips | Inline compact | — |

---

## 4. Data Model Changes

### 4.1 `SceneMusic` interface

```ts
export interface ArtlistSearchTiers {
  narrow: string   // all filters: genres + moods + instruments + BPM + duration
  medium: string   // genres + moods + instruments (no BPM, no duration)
  broad: string    // genres + moods only
}

export interface SceneMusic {
  track?: string
  artist?: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status?: ResolveStatus
  score?: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  recommendations: [MusicRecommendation, MusicRecommendation, MusicRecommendation]
  favorite_index: 0 | 1 | 2
  fill_count: number              // 0-3
  search_tiers: ArtlistSearchTiers
  flow_to?: string                // e.g., "cena 2"
  search_terms?: string
  artlist_url?: string
  style?: string
  entry_cue?: string
  continuation?: string
}
```

### 4.2 `MusicRecommendation` interface

```ts
export type ArtlistSearchTier = 'narrow' | 'medium' | 'broad'

export interface MusicRecommendation {
  track: string
  artist: string
  original_filename?: string
  audio_asset_id?: string
  resolve_status: ResolveStatus
  score: number
  score_max: number
  score_breakdown?: Record<string, ScoreBreakdownEntry>
  reasoning?: string
  delta_vs_favorite?: Record<string, number>
  category?: string
  energy?: number
  bpm?: number
  key?: string
  duration?: string
  artlist_url?: string
  // --- new fields ---
  is_empty_slot: boolean
  slot_label?: string
  artlist_search_url?: string
  artlist_search_tier: ArtlistSearchTier
}
```

Empty slots use: `track: '', artist: '', resolve_status: 'NO_MATCH', score: 0, score_max: SCORE_MAX, is_empty_slot: true`.

### 4.3 Artlist 3-Tier Search URLs

Filter removal priority: **duration → BPM → instruments → themes** (genres and moods never removed).

| Tier | Filters applied | Slot usage |
|------|----------------|------------|
| `narrow` | all (genres + moods + instruments + BPM + duration) | Slot 1 primary |
| `medium` | genres + moods + instruments (no BPM/duration) | Slot 2 |
| `broad` | genres + moods only | Slot 3 |

New export in `artlist-search.ts`:

```ts
export function buildArtlistTierUrls(params: {
  pools: Pools
  bpm: { bpmMin: number; bpmMax: number } | null
  duration: number | null
}): ArtlistSearchTiers
```

### 4.4 Resolver Output Contract

```ts
export interface ResolvedSlot {
  slot_index: 0 | 1 | 2
  tier: ArtlistSearchTier
  match: AudioMatch | null
  is_empty_slot: boolean
  artlist_search_url: string
  slot_label: string
}

export interface ResolveResult {
  slots: [ResolvedSlot, ResolvedSlot, ResolvedSlot]
  fill_count: number
  search_tiers: ArtlistSearchTiers
  query_time_ms: number
}
```

Assignment (0-indexed internally, display as #1/#2/#3):
- Slot 0 (#1 hero) = highest-scoring match from `narrow`-tier query
- Slot 1 (#2 alt) = second-highest from `narrow`, or first from `medium` if unavailable
- Slot 2 (#3 alt) = next available from `medium` or `broad`
- Any unfilled slot gets `is_empty_slot: true` with the tier-appropriate `artlist_search_url`

---

## 5. Cowork Reference Schema Update

### 5.1 New cowork output format for music

Cowork outputs only the music profile. Resolver fields are excluded from cowork's responsibility.

```json
{
  "music": {
    "track": "Ocean Depth",
    "artist": "Vyacheslav Draganov",
    "entry_cue": "00:00",
    "style": "Minimal dark pads, subtle low drone. Not dramatic. Think opening of a documentary.",
    "continuation": null,
    "search_terms": "cinematic ambient mysterious",
    "flow_to": "cena 2",
    "reasoning": "Minimal dark pads com low drone sutil. Deliberado e cinematográfico."
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `track` | string \| null | No | Track suggestion (null = let resolver find) |
| `artist` | string \| null | No | Artist (null = no preference) |
| `entry_cue` | string | **Yes** | Timecode when music enters (e.g., "00:00") |
| `style` | string | **Yes** | Musical profile description |
| `continuation` | string \| null | No | Source scene label if continuing (e.g., "cena 1") |
| `search_terms` | string | **Yes** | Keywords for resolver/Artlist search |
| `flow_to` | string \| null | No | Target scene label if track continues |
| `reasoning` | string | **Yes** | Why this music profile fits |

### 5.2 What resolver adds (NOT cowork's job)

`recommendations[0..2]`, `fill_count`, `search_tiers`, `favorite_index`, `audio_asset_id`, `original_filename`, `resolve_status`, `score`, `artlist_url`, `score_breakdown`, `delta_vs_favorite`.

### 5.3 Notes cowork must NO LONGER emit as edit_notes

| Old pattern | New field |
|-------------|-----------|
| `"search artlist: cinematic dark"` | `music.search_terms` |
| `"entry: 00:15"` | `music.entry_cue` |
| `"Style: needs to feel intimate"` | `music.style` |
| `"continues"` / `"same track"` | `music.continuation` |
| `"track flows into next scene"` | `music.flow_to` |

### 5.4 Update mechanism

```bash
PUT /api/pipeline/context/cowork-section-schemas
Header: X-Pipeline-Key: $PIPELINE_COWORK_KEY
Body: { "title": "...", "content_md": "<updated markdown>" }
```

Do NOT use the seed script — update the online reference directly via API.

---

## 6. Accessibility & Keyboard Navigation

ARIA labels follow the UI language (pt-BR) since the app is Portuguese:

| Element | ARIA | Value |
|---------|------|-------|
| Music Hero wrapper | `role="region"` + `aria-label` | `"Recomendações de música para cena {n}"` |
| Filled card | `aria-label` | `"{track}, {score}%, {status em pt}"` |
| Empty slot CTA | `aria-label` | `"Slot {n} vazio, buscar no Artlist"` |
| Fill indicator | `role="img"` + `aria-label` | `"{filled} de 3 slots preenchidos"` |
| Expand toggle | `aria-expanded` | `"true"` / `"false"` |

Keyboard: Tab between cards, Enter/Space expands, Escape collapses.

---

## 7. Responsive Behavior

| Breakpoint | Change |
|-----------|--------|
| >640px | Full layout: score beside waveform, metadata inline |
| <640px | Percentage stacks above waveform, metadata wraps 2 lines |
| <480px | Waveform hidden, CTAs full-width, breakdown 1-column |

Mobile-first Tailwind: `sm:` = ≥640px. Waveform: `hidden sm:block`.

---

## 8. Implementation Order

### Phase 1 — Types & Resolver (no UI)
1. Update `types.ts` — new fields
2. Update `artlist-search.ts` — 3-tier URL generation
3. Update `audio-resolver.ts` — always 3 slots, fill_count, search_tiers

### Phase 2 — New Components
4. `MusicHeroSection`
5. `MusicHeroCard`
6. `MusicAlternativeSlot`
7. `MusicContinuationCard`
8. `ScoreBreakdown`
9. `FillIndicator`

### Phase 3 — Integration
10. Reorder music before edit_notes in `scene-guide-renderer.tsx`, filter absorbed notes
11. Delete deprecated components

### Phase 4 — Cowork Reference (parallel with Phase 2/3)
12. PUT updated schema to online reference API
13. Manual validation with 1 pipeline run

### Phase 5 — Tests
14. Unit tests for new components (all 6 states)
15. Unit tests for 3-tier Artlist URLs
16. Integration test for resolver 3-slot output
17. Visual regression in browser

### Dependency Graph

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 5
Phase 4 (independent, parallel with 2/3)
```

---

## Visual Reference

Mockups available at: `.superpowers/brainstorm/33716-1778971661/content/music-hero-v3-final.html`

States covered:
- **A** — 3/3 filled (LOCAL + PENDING + PARTIAL)
- **B** — 1/3 filled (hero + 2 empty progressive CTAs)
- **C** — 0/3 empty (all slots with tiered Artlist search)
- **D** — Continuation (inherited track + "caso queira trocar")
- **E** — Expanded (score breakdown + full reasoning)
- **F** — Note absorption (before/after filtering)
