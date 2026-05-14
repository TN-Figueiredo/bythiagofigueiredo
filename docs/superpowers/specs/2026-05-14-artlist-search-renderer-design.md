# Artlist Search Link Renderer — Design Spec

Automatically transform `Search Artlist:` text patterns in pipeline postprod scenes into clickable Artlist search URLs. Eliminates manual copy-paste workflow for finding music and SFX on Artlist.

---

## Problem

When editing video content in the pipeline CMS, `postprod_scenes` sections contain music and SFX specs written as free-text notes (e.g., `Search Artist: Mood: Mysterious, Cinematic | Genre: Ambient | BPM: 90-100`). The editor must manually open Artlist, enter each filter parameter, and search. This is repetitive and error-prone.

## Solution

A render-time transformation that parses structured search specs and generates clickable Artlist URLs — primary (all filters) and fallback (fewer filters). Original text is preserved in the database; links are computed on display.

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/pipeline/artlist-search.ts` | Pure utility — parses search specs, maps terms to IDs, generates URLs |
| `apps/web/test/lib/pipeline/artlist-search.test.ts` | Unit tests for the utility |

### Modified files

| File | Change |
|------|--------|
| `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx` | Render Artlist links in MUSIC notes, music subsection, and SFX entries |
| `docs/cowork-pipeline-reference.md` | Standardize format to `Search Artlist:`, document link generation |

---

## Utility Module: `artlist-search.ts`

### Public API

```ts
interface ArtlistSearchResult {
  url: string
  fallbackUrl: string | null
  ids: number[]
  fallbackIds: number[]
}

function parseArtlistSearch(text: string): ArtlistSearchResult | null
function parseArtlistSfxRef(text: string): { name: string; url: string } | null
```

### Parser

**Trigger pattern:** `/Search\s+Art(?:list|ist)\s*:/i`
Matches both `Search Artlist:` (canonical) and `Search Artist:` (legacy).

**Field extraction:** After the trigger, split by `|` (or `·`). Each segment is `FieldName: value1, value2`. Field names are case-insensitive.

Recognized fields:
- `Mood` — maps to mood IDs
- `Genre` — maps to genre IDs
- `Instrument` — maps to instrument IDs
- `BPM` — parsed as range or single value
- `Duration` — parsed as minimum seconds
- `Theme` — maps to video theme IDs
- `Track`, `Style`, and any other field — silently ignored (author suggestions, not filters)

### ID Lookup Tables

Source: Artlist Enterprise API Song Dictionaries.

#### Genres

| Slug | ID |
|------|-----|
| ambient | 57 |
| blues | 58 |
| soul-rnb | 59 |
| country | 60 |
| jazz | 61 |
| cinematic | 62 |
| world | 63 |
| electronic | 64 |
| acoustic | 65 |
| indie | 66 |
| rock | 68 |
| pop | 69 |
| singer-songwriter | 70 |
| folk | 71 |
| classical | 72 |
| hip-hop | 85 |
| funk | 89 |
| latin | 91 |
| lofi-chill-beats | 549 |

#### Moods

| Slug | ID |
|------|-----|
| uplifting | 5 |
| powerful | 6 |
| happy | 7 |
| carefree | 8 |
| love | 9 |
| peaceful | 10 |
| serious | 12 |
| dramatic | 13 |
| angry | 14 |
| tense | 15 |
| sad | 16 |
| playful | 35 |
| hopeful | 78 |
| scary | 79 |
| groovy | 83 |
| dark | 92 |
| funny | 101 |
| exciting | 105 |
| epic | 311 |
| mysterious | 320 |

#### Instruments

| Slug | ID |
|------|-----|
| acoustic-guitar | 38 |
| electric-guitar | 39 |
| piano | 40 |
| acoustic-drums | 41 |
| strings | 42 |
| percussion | 43 |
| bells | 48 |
| synth | 49 |
| keys | 80 |
| electronic-drums | 82 |
| orchestra | 86 |
| brass | 98 |
| pads | 322 |
| bass | 548 |

#### Video Themes

| Slug | ID |
|------|-----|
| documentary | 22 |
| travel | 75 |
| trailer | 551 |
| vlog | 553 |
| shorts | 556 |

### Synonym Map

Maps common spec terms (case-insensitive) to canonical slugs:

| Term | Maps to | Category |
|------|---------|----------|
| Mysterious | mysterious | mood |
| Dark | dark | mood |
| Determined | uplifting | mood |
| Building | uplifting | mood |
| Focused | serious | mood |
| Motivational | uplifting | mood |
| Reflective | peaceful | mood |
| Emotional | sad | mood |
| Inspiring | hopeful | mood |
| Warm | peaceful | mood |
| Contemplative | peaceful | mood |
| Adventurous | exciting | mood |
| Suspenseful | tense | mood |
| Energetic | exciting | mood |
| Melancholic | sad | mood |
| Triumphant | epic | mood |
| Nostalgic | sad | mood |
| Lo-fi | lofi-chill-beats | genre |
| Lofi | lofi-chill-beats | genre |
| Lo fi | lofi-chill-beats | genre |
| Piano | piano | instrument |
| Acoustic | acoustic | genre |
| Cinematic | cinematic | genre |
| Ambient | ambient | genre |
| Electronic | electronic | genre |
| Indie | indie | genre |
| World | world | genre |
| Orchestral | orchestra | instrument |
| Strings | strings | instrument |
| Synth | synth | instrument |

When the synonym maps to an instrument, it's included in the instrument pool. When it maps to a genre, it's in the genre pool. The category determines which priority tier it falls into.

### ID Priority Algorithm

Max 4 IDs per URL. When total mapped IDs exceed 4, fill by tiers:

1. **Tier 1:** up to 2 genres (content category — most impactful filter)
2. **Tier 2:** up to 2 moods (emotional context)
3. **Tier 3:** first instrument (if any)
4. **Tier 4:** first video theme (if any)

If a tier is empty, its slots cascade to the next tier. Within a tier, first-mentioned in the spec text = higher priority.

### Fallback URL Algorithm

- Remove the **last ID** from the primary list (lowest priority by tier order)
- If primary has ≤ 2 IDs → `fallbackUrl` is `null` (too generic to be useful)
- Fallback always retains at least 2 IDs

### BPM Parsing

- Range: `90-100` → `bpmMin=90&bpmMax=100`
- Single: `90` → `bpmMin=80&bpmMax=100` (±10)
- Absent → no BPM params

### Duration Parsing

- `2+ min` → `durationMin=120`
- `3:30+ min` → `durationMin=210` (3*60 + 30, no rounding needed since it's exact)
- `1:45+ min` → `durationMin=105`
- `90s` or `90+ sec` → `durationMin=90`
- Absent → no duration param

### URL Format

**Music search:**
```
https://artlist.io/royalty-free-music/search?includedIds=57,64,92,320&bpmMin=60&bpmMax=80&durationMin=120
```

Parameters: `includedIds` (comma-joined), `bpmMin`, `bpmMax`, `durationMin`. Only include params that have values.

### SFX Reference Parser

**Trigger:** `/Artlist\s+["']([^"']+)["']/i`

Matches patterns like:
- `SFX impact leve — Artlist "Low Impact Hit"`
- `Artlist 'Cinematic Riser Short'`

**URL format:**
```
https://artlist.io/royalty-free-sound-effects?search=Low+Impact+Hit
```

Returns `{ name: "Low Impact Hit", url: "https://..." }` or `null`.

### Edge Cases

- No trigger pattern found → return `null`
- All terms unmappable → return `null`
- Only 1 ID mapped → return URL with 1 ID, `fallbackUrl: null`
- Multiple `Search Artlist:` in same text → parse the first one only (each edit_note is a separate string)
- Duplicate IDs (e.g., Mood: Dark and Genre: "dark ambient") → deduplicate

---

## Renderer Changes: `scene-guide-renderer.tsx`

### MUSIC notes in edit_notes

The `NoteLine` component currently renders categorized notes as plain text with token highlighting. For notes categorized as `MUSIC` that match the Artlist search pattern:

**Current rendering:**
```
[MUSIC] Search Artist: Mood: Mysterious, Cinematic | Genre: Ambient | BPM: 90-100 | Duration: 2+ min | Track: "Ember & Stone"
```

**New rendering:**
```
[MUSIC] Search Artist: Mood: Mysterious, Cinematic | Genre: Ambient | BPM: 90-100 | Duration: 2+ min | Track: "Ember & Stone"
         [Buscar no Artlist ↗] · [Menos filtros ↗]
```

Implementation:
- After the `NoteLine` text, check if note.category === 'MUSIC' and `parseArtlistSearch(note.text)` returns a result
- If yes, render a secondary row with link buttons below the note text
- Links use `target="_blank"` and `rel="noopener noreferrer"`
- Styling: small text (9px), accent color (`#c084fc` — MUSIC color), with a subtle external link indicator

### Music subsection

The separate `music` subsection shows `search_terms`, `style`, `entry_cue`, `continuation`. The `search_terms` field may contain parseable Artlist search specs.

- After rendering the "Busca:" line, check if `parseArtlistSearch(music.search_terms)` returns a result
- If yes, append an inline link: `Busca: lo-fi ambient introspective [↗ Artlist]`

### SFX entries

SFX entries show `description` and optional `search_terms`. The description may contain Artlist track references.

- Check both `description` and `search_terms` for `parseArtlistSfxRef()` matches
- If found, make the track name a clickable link inline
- Example: `Room tone fade in — Artlist "Room Ambience Quiet"` → "Room Ambience Quiet" becomes a link

### Component Structure

Add a helper component inside `scene-guide-renderer.tsx`:

```tsx
function ArtlistLinks({ text }: { text: string }) {
  // Calls parseArtlistSearch, renders link row if match found
  // Returns null if no match
}

function ArtlistSfxLink({ text }: { text: string }) {
  // Calls parseArtlistSfxRef, wraps track name in link if match found
  // Returns original text if no match
}
```

---

## Cowork Reference Doc Update

In `docs/cowork-pipeline-reference.md`, update the `postprod_scenes` section:

1. **Standardize trigger:** Change the example from `Search artist:` to `Search Artlist:`
2. **Add format spec:**

```
### Artlist search format (auto-linked by CMS)

edit_notes entries matching this format are auto-linked to Artlist search:

  Search Artlist: Mood: {moods} | Genre: {genres} | BPM: {bpm_range} | Duration: {duration}

Fields (all optional, pipe-separated, case-insensitive):
- Mood: comma-separated mood terms (Mysterious, Dark, Peaceful, etc.)
- Genre: comma-separated genre terms (Ambient, Electronic, Cinematic, etc.)
- Instrument: comma-separated (Piano, Strings, Synth, etc.)
- BPM: single value (90) or range (90-100)
- Duration: minimum duration (2+ min, 3:30+ min, 90+ sec)
- Track: suggestion only, not used as filter
- Style: description only, not used as filter

SFX references matching `Artlist "Track Name"` are also auto-linked.
```

3. **Update categorization table:** Change `search artist` trigger to include `search artlist`

---

## Testing Strategy

### Unit tests (`artlist-search.test.ts`)

1. **Standard parse** — all fields present, expected IDs and URLs
2. **Missing optional fields** — no BPM, no Duration, no Instrument
3. **Synonym mapping** — Determined → uplifting (5), Melancholic → sad (16)
4. **ID cap** — 6 mapped IDs → truncated to 4 by tier priority
5. **Tier cascade** — 0 genres, 4 moods → uses 4 moods (no genre tier to fill)
6. **Fallback generation** — primary 4 IDs → fallback 3 IDs
7. **No fallback when ≤2** — primary 2 IDs → fallbackUrl null
8. **BPM single value** — `80` → bpmMin=70, bpmMax=90
9. **BPM range** — `90-100` → exact
10. **Duration formats** — `2+ min` (120), `3:30+ min` (210), `90+ sec` (90)
11. **Both trigger patterns** — `Search Artlist:` and `Search Artist:`
12. **Unknown terms** — all unmappable → returns null
13. **Duplicate IDs** — same ID from mood and genre synonym → deduplicated
14. **SFX pattern** — `Artlist "Track Name"` parsed correctly
15. **SFX no match** — text without pattern → returns null
16. **Empty/malformed input** — empty string, no pipe separators, etc.

---

## Out of Scope

- API-side transformation (storing computed URLs in DB)
- Backfill of existing content
- Artlist API integration (we use public search URLs, not API calls)
- SFX category browsing (only text search for specific track names)
- `durationMax` or other undocumented Artlist params
