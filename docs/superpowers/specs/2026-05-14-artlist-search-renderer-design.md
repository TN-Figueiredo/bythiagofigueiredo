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
| `apps/web/test/lib/pipeline/artlist-search.test.ts` | Unit tests for the utility (convention: `test/lib/` mirrors `src/lib/`) |

### Modified files

| File | Change |
|------|--------|
| `scene-guide-renderer.tsx` | Render Artlist links in MUSIC notes, music subsection, SFX entries, and TIMING notes with SFX refs |
| `categorize-note.ts` | Add `search artlist` to the MUSIC regex so the new canonical format is also categorized correctly |
| `docs/cowork-pipeline-reference.md` | Standardize format to `Search Artlist:`, document auto-link behavior |

Full paths for renderers: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/`

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

**Field extraction:** After the trigger, take the remainder of the string. Split by `|`. Each segment is `FieldName: value1, value2`. Field names are case-insensitive. Whitespace around names and values is trimmed.

Recognized fields and their behavior:
- `Mood` — each comma-separated value is looked up in the mood table first, then synonym table. Resolved IDs go into the mood pool.
- `Genre` — same logic: genre table first, then synonym table. Resolved IDs go into the genre pool.
- `Instrument` — instrument table first, then synonym table.
- `BPM` — parsed as range or single value (see BPM Parsing below)
- `Duration` — parsed as minimum seconds (see Duration Parsing below)
- `Theme` — video theme table first, then synonym table.
- `Track`, `Style`, and any unrecognized field — silently ignored (author suggestions, not filters)

**Field-context-aware resolution:** When a term like "Cinematic" appears under `Mood:`, the parser first checks the mood table. If not found there, it checks the synonym table. The synonym table declares a canonical category (genre, mood, instrument), and the ID goes into THAT category's pool regardless of which field it appeared in. This ensures the ID priority algorithm respects Artlist's actual taxonomy.

Example: `Mood: Cinematic, Dark` → "Cinematic" not in mood table → synonym says genre (62) → goes to genre pool. "Dark" found in mood table (92) → goes to mood pool.

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

Maps common spec terms (case-insensitive) to their canonical Artlist slug and category:

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

The category determines which priority tier the ID falls into, regardless of which field the term was written in.

### ID Priority Algorithm

Max 4 IDs per URL. Algorithm (pseudocode):

```
pools = { genres: [...], moods: [...], instruments: [...], themes: [...] }
deduplicate all pools (remove duplicate IDs)
result = []
remaining = 4

# Tier 1: genres (up to min(2, remaining))
take = min(len(pools.genres), 2, remaining)
result += pools.genres[0:take]
remaining -= take

# Tier 2: moods (up to min(2, remaining))
take = min(len(pools.moods), 2, remaining)
result += pools.moods[0:take]
remaining -= take

# Tier 3: instruments (up to min(1, remaining))
take = min(len(pools.instruments), 1, remaining)
result += pools.instruments[0:take]
remaining -= take

# Tier 4: themes (up to remaining)
take = min(len(pools.themes), remaining)
result += pools.themes[0:take]
remaining -= take

# If still remaining > 0, backfill from largest unused pool
# (e.g., 0 genres → moods can take up to 4 total)
if remaining > 0:
  for pool in [moods, genres, instruments, themes]:
    available = pool items not already in result
    take = min(len(available), remaining)
    result += available[0:take]
    remaining -= take
    if remaining == 0: break

return result  # guaranteed len(result) <= 4
```

The backfill pass handles cascade: if genres are empty, moods can fill all 4 slots. If moods and genres combined fill 3, instruments can fill the 4th.

### Fallback URL Algorithm

- Remove the **last ID** from the primary list (lowest priority by tier + backfill order)
- If primary has ≤ 2 IDs → `fallbackUrl` is `null` (too generic to be useful)

### BPM Parsing

Regex: `/(\d+)\s*[-–]\s*(\d+)|(\d+)/` applied to the BPM field value.

- Range: `90-100` → `bpmMin=90&bpmMax=100`
- Single: `90` → `bpmMin=80&bpmMax=100` (±10)
- Absent → no BPM params in URL

### Duration Parsing

Regex: `/(\d+)(?::(\d{2}))?\s*\+?\s*(?:min|m)\b/i` and `/(\d+)\s*\+?\s*(?:sec|s)\b/i`

- `2+ min` → `durationMin=120`
- `3:30+ min` → `durationMin=210` (3×60 + 30, exact conversion)
- `1:45+ min` → `durationMin=105`
- `90s` or `90+ sec` → `durationMin=90`
- Absent → no duration param in URL

### URL Format

**Music search:**
```
https://artlist.io/royalty-free-music/search?includedIds=57,64,92,320&bpmMin=60&bpmMax=80&durationMin=120
```

Parameters: `includedIds` (comma-joined), `bpmMin`, `bpmMax`, `durationMin`. Only include params that have values. These parameter names come from the Artlist public search URL and are extracted as constants for easy maintenance.

### SFX Reference Parser

**Trigger:** `/Artlist\s+["'“”]([^"'“”]+)["'“”]/i`

Handles straight quotes, curly quotes, and single quotes:
- `SFX impact leve — Artlist "Low Impact Hit"`
- `Artlist 'Cinematic Riser Short'`
- `Artlist “Low Impact Hit”` (curly quotes from rich text)

**URL format:**
```
https://artlist.io/royalty-free-sound-effects?search=Low+Impact+Hit
```

**Note:** This SFX URL pattern is inferred from the Artlist public site structure. If the actual URL differs, it's a single constant to fix in the utility. The link will still navigate to Artlist; worst case the user lands on the SFX homepage.

Returns `{ name: "Low Impact Hit", url: "https://..." }` or `null`.

### Edge Cases

- No trigger pattern found → return `null`
- All terms unmappable → return `null` (no link is better than a filterless link)
- Only 1 ID mapped → return URL with 1 ID, `fallbackUrl: null`
- Multiple `Search Artlist:` in same text → parse the first one only (each edit_note is a separate string, so multiples are rare)
- Duplicate IDs across pools → deduplicate before priority algorithm
- Empty field value (e.g., `Mood: | Genre: Ambient`) → skip the empty field

---

## Code Changes: `categorize-note.ts`

The MUSIC rule regex currently is:

```ts
{ category: 'MUSIC', test: t => /search artist|mood:|genre:|bpm[:\s]|track change|new track/i.test(t) }
```

Update to also match `search artlist`:

```ts
{ category: 'MUSIC', test: t => /search art(?:list|ist)|mood:|genre:|bpm[:\s]|track change|new track/i.test(t) }
```

This ensures notes using the new canonical format `Search Artlist:` are categorized as MUSIC.

---

## Renderer Changes: `scene-guide-renderer.tsx`

### Data sources for Artlist links

There are 3 distinct locations where Artlist links should appear. Each has different data shape:

| Source | Data shape | Parser to use | Location in UI |
|--------|-----------|---------------|----------------|
| `edit_notes[]` categorized as MUSIC | Free text with `Search Artlist:` pattern | `parseArtlistSearch()` | Below the MUSIC note text |
| `sfx[]` structured entries | `{ description, search_terms }` — may contain `Artlist "Track"` | `parseArtlistSfxRef()` | Inline in SFX description |
| `edit_notes[]` categorized as TIMING | Free text, may contain `Artlist "Track"` refs | `parseArtlistSfxRef()` | Inline in TIMING note text |

The `music.search_terms` field (e.g., `"lo-fi ambient introspective"`) is a plain keyword string, NOT the `Search Artlist:` structured format. It does **not** get parsed by `parseArtlistSearch()`. It is left as-is.

### MUSIC notes in edit_notes

The `NoteLine` component renders categorized notes as text with token highlighting. For notes categorized as `MUSIC` where `parseArtlistSearch(note.text)` returns a result:

**Current:**
```
[MUSIC] Search Artist: Mood: Mysterious, Cinematic | Genre: Ambient | BPM: 90-100 | Duration: 2+ min
```

**New:**
```
[MUSIC] Search Artist: Mood: Mysterious, Cinematic | Genre: Ambient | BPM: 90-100 | Duration: 2+ min
         Buscar no Artlist ↗  ·  Menos filtros ↗
```

- After `NoteLine` renders the text, conditionally render `<ArtlistLinks>` below it
- Only for `note.category === 'MUSIC'`
- Links: `<a>` with `target="_blank"`, `rel="noopener noreferrer"`, `aria-label="Buscar música no Artlist (abre em nova aba)"`
- Styling: 9px text, MUSIC purple (`#c084fc`), hover underline, slight left padding to align with note text

### SFX entries (structured)

SFX entries render `description` text. Check with `parseArtlistSfxRef(fx.description)`:

**Current:**
```
00:05  Room tone fade in — Artlist "Room Ambience Quiet"
```

**New:**
```
00:05  Room tone fade in — Artlist "Room Ambience Quiet" ↗
```

Where `"Room Ambience Quiet"` becomes a clickable link. Also check `fx.search_terms` if present.

### TIMING notes with SFX references

TIMING-categorized edit_notes may reference Artlist tracks (e.g., `SFX riser sutil 2s — Artlist "Cinematic Riser Short"`). Apply `parseArtlistSfxRef()` to ALL note text in `NoteLine`, not just TIMING — the SFX ref pattern is rare enough that running it on every note is fine, and catches edge cases where a note is miscategorized.

Implementation: in `NoteLine`, after rendering the tokenized text, check `parseArtlistSfxRef(note.text)`. If match, wrap the track name portion as a link.

### New helper components

```tsx
function ArtlistLinks({ text }: { text: string }) {
  const result = parseArtlistSearch(text)
  if (!result) return null
  return (
    <div className="flex items-center gap-1.5 pl-[58px] -mt-0.5">
      <a href={result.url} target="_blank" rel="noopener noreferrer"
         aria-label="Buscar música no Artlist (abre em nova aba)"
         className="text-[9px] font-medium transition-colors hover:underline"
         style={{ color: '#c084fc' }}>
        Buscar no Artlist ↗
      </a>
      {result.fallbackUrl && (
        <>
          <span className="text-[9px]" style={{ color: 'var(--gem-dim)' }}>·</span>
          <a href={result.fallbackUrl} target="_blank" rel="noopener noreferrer"
             aria-label="Buscar no Artlist com menos filtros"
             className="text-[9px] transition-colors hover:underline"
             style={{ color: 'var(--gem-dim)' }}>
            Menos filtros ↗
          </a>
        </>
      )}
    </div>
  )
}
```

`pl-[58px]` aligns with the note text (accounting for the TagPill width + gap).

---

## Cowork Reference Doc Update

In `docs/cowork-pipeline-reference.md`, update the `postprod_scenes` section:

### 1. Fix the example edit_note

```diff
-  "Search artist: Lo-fi ambient, mood: introspective, BPM: 70-80"
+  "Search Artlist: Mood: Introspective | Genre: Lo-fi | BPM: 70-80 | Duration: 2+ min"
```

### 2. Update the categorization table

```diff
-| MUSIC | `search artist`, `mood:`, `genre:`, `bpm:`, `track change`, `new track` |
+| MUSIC | `search artlist`, `search artist`, `mood:`, `genre:`, `bpm:`, `track change`, `new track` |
```

### 3. Add Artlist format reference (new subsection after categorization table)

```markdown
### Artlist search format (auto-linked by CMS)

edit_notes entries matching this format are auto-linked to Artlist music search:

    Search Artlist: Mood: {moods} | Genre: {genres} | BPM: {bpm_range} | Duration: {duration}

Fields (all optional, pipe-separated, case-insensitive):
- **Mood:** comma-separated terms — Mysterious, Dark, Peaceful, Energetic, etc.
- **Genre:** comma-separated terms — Ambient, Electronic, Cinematic, Lo-fi, etc.
- **Instrument:** comma-separated — Piano, Strings, Synth, etc.
- **BPM:** single value (90) or range (90-100)
- **Duration:** minimum duration — 2+ min, 3:30+ min, 90+ sec
- **Track:** suggestion for the editor, NOT used as search filter
- **Style:** description, NOT used as filter

SFX references using `Artlist "Track Name"` in edit_notes or sfx.description are also auto-linked to Artlist SFX search.

**Canonical format:** Always use `Search Artlist:` (not `Search Artist:`). The renderer supports both for backward compatibility.
```

---

## Testing Strategy

### Unit tests (`apps/web/test/lib/pipeline/artlist-search.test.ts`)

**parseArtlistSearch:**

1. Standard parse — all fields present, expected IDs and URL params
2. Missing optional fields — no BPM, no Duration → URL has only `includedIds`
3. Synonym mapping — `Determined` → uplifting (5), `Melancholic` → sad (16)
4. Cross-category synonym — `Mood: Cinematic` → Cinematic is a genre in Artlist → goes to genre pool (62)
5. ID cap — 6 terms mapped → truncated to 4 by tier priority
6. Tier cascade — 0 genres, 4 moods → backfill gives moods all 4 slots
7. Fallback generation — primary 4 IDs → fallback 3 IDs (last removed)
8. No fallback when ≤2 — primary 2 IDs → `fallbackUrl: null`
9. BPM single value — `80` → `bpmMin=70&bpmMax=90`
10. BPM range — `90-100` → exact min/max
11. Duration formats — `2+ min` (120), `3:30+ min` (210), `90+ sec` (90)
12. Both trigger patterns — `Search Artlist:` and `Search Artist:` both work
13. Unknown terms only — all unmappable → returns `null`
14. Duplicate IDs — same ID from multiple terms → deduplicated in URL
15. Empty field value — `Mood: | Genre: Ambient` → skips empty, parses Genre
16. Malformed input — empty string, no pipes, no trigger → returns `null`

**parseArtlistSfxRef:**

17. Standard match — `Artlist "Low Impact Hit"` → name + URL
18. Single quotes — `Artlist 'Cinematic Riser Short'` → works
19. Curly quotes — `Artlist “Track”` → works
20. Embedded in sentence — `SFX riser 2s — Artlist "Riser"` → extracts "Riser"
21. No match — `SFX riser 2s from library` → returns `null`

**categorize-note update:**

22. Add test in `test/app/cms/pipeline/renderers/categorize-note.test.ts`: `Search Artlist: Mood: X` → `MUSIC`

---

## Out of Scope

- API-side transformation (storing computed URLs in DB)
- Backfilling existing content (renderer handles both formats already)
- Artlist API integration (we use public search URLs, not API calls)
- Parsing `music.search_terms` as Artlist search (different format: plain keywords)
- `durationMax` or other undocumented Artlist URL params
