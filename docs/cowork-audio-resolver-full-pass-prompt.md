# Audio Resolver Full Pass — Cowork Execution Prompt

> Copy-paste this entire prompt into Cowork to trigger a full audio resolution pass across all pipeline items with `postprod_scenes`.

---

## Prompt

You are performing a **full Audio Resolver pass** across all pipeline items that have `postprod_scenes` content. Your goal is to populate rich `recommendations[]` data for every scene's music AND resolve all SFX entries, taking full advantage of the v6 UI capabilities.

### Authentication & Base URL:

- **Base URL:** `https://bythiagofigueiredo.com`
- **Auth header:** `X-Pipeline-Key: <your pipeline key>` (use the permanent key from your session context)
- Never create or revoke pipeline keys. Use the existing one.
- Do NOT use `Authorization: Bearer` — the pipeline uses `X-Pipeline-Key` exclusively.

### What the UI can now render (and needs from you):

| UI Feature | Required Fields |
|-----------|-----------------|
| Score Gauge (SVG donut on favorite) | `score` + `score_max: 34` |
| Score Breakdown pills (colored per-category) | `score_breakdown: { key: { score, max } }` |
| Energy indicator (gradient dots ⚡ N/5) | `energy: 1-5` |
| Category/BPM/Key chips | `category`, `bpm`, `key` |
| Duration | `duration` as "M:SS" |
| Favorite star + accent card | `favorite_index` + `recommendations[]` |
| Delta vs favorite pills | `delta_vs_favorite: { key: non-zero-diff }` |
| Cowork reasoning (status-tinted) | `reasoning` (string, scene-specific) |
| Artlist download CTA (amber button) | `artlist_url` + `resolve_status: "PENDING_MATCH"` |
| SFX clickable search chips | `search_terms` (COMMA-SEPARATED) + `resolve_status: "NO_MATCH"` |
| SFX category pill (colored badge) | `sfx_category` (UPPERCASE enum) |
| Continuation card (dashed border) | `continuation` matching `/^Continues\b/` or ending `(continues)`/`(continua)` |

### Execution steps:

#### Phase 1: Inventory

1. `GET /api/pipeline/items?format=video` — list all video items (defaults to non-archived)
2. For each item, `GET /api/pipeline/items/:id/sections/postprod_scenes?lang=pt` (and `?lang=en` for bilingual)
3. If the GET returns `data: null` or `meta.exists: false`, skip that item — it has no scenes to resolve
4. From each successful GET response, store:
   - `meta.item_version` → use as `X-Expected-Version` header on PATCH
   - `data.rev` → use as `rev` field in PATCH body (integer; use `0` if creating new section)
   - `data.content.scenes` → the scenes array to read and modify
5. Build a work list of scenes that need resolution (skip scenes where `recommendations[]` already has `score_breakdown` with `{ score, max }` format — those are already done)
6. For bilingual items (those returning valid content for both `?lang=pt` and `?lang=en`): resolve audio ONCE using the PT scenes as canonical. Then copy the SAME music/sfx resolution data (recommendations, scores, etc.) into the EN section. Music choice is language-agnostic — only labels/narratives differ per language.

#### Phase 2: Resolve Music (per scene)

For each scene with `music` that lacks rich `recommendations[]`:

**2a. Build resolver query from scene context:**

Extract search intent from existing `search_terms`, `style`, `edit_notes`, and scene label. Build a structured query:

```json
POST /api/pipeline/audio-library/resolve
{
  "type": "music",
  "category": "<infer from style/mood — see heuristic table below>",
  "tags": ["<extract from search_terms and edit_notes>"],
  "mood": ["<from emotional tone of scene>"],
  "energy": "<1-5 from scene intensity — see heuristic table below>",
  "bpm_range": { "min": "<infer from style>", "max": "<infer>" },
  "duration_range": { "min": "<scene_duration_sec * 0.8>", "max": "<scene_duration_sec * 2>" },
  "instruments": ["<from style description>"],
  "reuse_scenarios": ["<background|intro|outro|highlight|transition>"],
  "description": "<scene label + narrative combined>",
  "limit": 3
}
```

**Inference heuristics (when scene lacks explicit metadata):**

| Scene keywords/mood | energy | category | bpm_range |
|---------------------|--------|----------|-----------|
| intimate, vulnerable, confessional, soft | 1-2 | ambient or cinematic | 60-90 |
| contemplative, reflective, narrative | 2-3 | cinematic | 70-100 |
| energetic, exciting, fast-paced, action | 4-5 | electronic or rock | 120-160 |
| epic, dramatic, climax, powerful | 4-5 | cinematic or orchestral | 80-130 |
| upbeat, fun, playful, light | 3-4 | pop or electronic | 100-130 |
| dark, tense, suspense, ominous | 2-3 | cinematic or ambient | 60-100 |
| transition, bridge, interlude | 2-3 | ambient | 70-110 |

If multiple moods apply, use the dominant one. If unsure, default to `energy: 3`, `category: "cinematic"`, `bpm_range: { "min": 70, "max": 120 }`.

**2b. Transform resolver response into recommendations[]:**

For each match in `response.data.matches[]`:

```json
{
  "track": "match.asset.track_name",
  "artist": "match.asset.artist",
  "original_filename": "match.asset.original_filename",
  "audio_asset_id": "match.asset.id",
  "resolve_status": "match.resolve_status",
  "score": "match.score",
  "score_max": 34,
  "score_breakdown": {
    "category":          { "score": "match.breakdown.category",          "max": 5 },
    "tags":              { "score": "match.breakdown.tags",              "max": 8 },
    "mood":              { "score": "match.breakdown.mood",              "max": 6 },
    "energy":            { "score": "match.breakdown.energy",            "max": 3 },
    "bpm_in_range":      { "score": "match.breakdown.bpm_in_range",     "max": 3 },
    "duration_in_range": { "score": "match.breakdown.duration_in_range", "max": 2 },
    "reuse_scenarios":   { "score": "match.breakdown.reuse_scenarios",   "max": 4 },
    "instruments":       { "score": "match.breakdown.instruments",       "max": 3 }
  },
  "reasoning": "<YOUR editorial reasoning — WHY this specific track fits this scene's emotional arc, pacing, and production needs. Be specific: reference the scene's mood, energy, visual style.>",
  "category": "match.asset.category",
  "energy": "match.asset.energy",
  "bpm": "match.asset.bpm",
  "key": "match.asset.music_key",
  "duration": "formatSeconds(match.asset.duration_seconds)",
  "artlist_url": "match.asset.artlist_url"
}
```

**Notes on transformation:**
- Format `duration` as "M:SS" (e.g., 180 seconds → "3:00", 222 seconds → "3:42")
- The resolver breakdown includes a `description` field (often 0). **Exclude it** from `score_breakdown` — the UI does not render it and `score_max` remains 34.
- Use `score` exactly as returned by the resolver — do not recompute it from breakdown values.

**2c. Set favorite and compute deltas:**

- `favorite_index = 0` (highest score) unless editorial judgment says otherwise
- For each non-favorite recommendation, compute:
  ```
  delta_vs_favorite[key] = this_breakdown_raw[key] - favorite_breakdown_raw[key]
  ```
  Only include keys with **non-zero** delta. Example:
  ```json
  "delta_vs_favorite": { "tags": -2, "mood": -2, "instruments": -1 }
  ```

**2d. Set top-level music object fields:**

```json
{
  "track": "<from favorite recommendation>",
  "artist": "<from favorite recommendation>",
  "original_filename": "<from favorite>",
  "audio_asset_id": "<from favorite>",
  "resolve_status": "<from favorite>",
  "score": "<from favorite>",
  "score_max": 34,
  "search_terms": "<KEEP existing search_terms — never delete. Music uses SPACE-separated keywords (legacy format — do NOT convert to commas)>",
  "reasoning": "<editorial summary of why this is the best pick>",
  "recommendations": ["<all transformed recommendations>"],
  "favorite_index": 0,
  "style": "<keep existing or update>",
  "entry_cue": "<keep existing>",
  "continuation": "<keep if continuation scene>"
}
```

**2e. Handle special cases:**

- **Continuation scenes** (where `music.continuation` matches `/^Continues\b/` OR `music.track` ends with `(continues)` or `(continua)`): Skip resolver. Keep all existing data. Do NOT add recommendations. Do NOT set `resolve_status` (leave as null).
- **0 resolver results**: Set `resolve_status: "NO_MATCH"`, `track: null`, `artist: null`, `original_filename: null`, `audio_asset_id: null`. Build `artlist_url` as `https://artlist.io/search/song?query=<url_encoded_search_terms>`. Set `recommendations: []`. The UI will render in "search mode" showing search_terms as clickable chips.
- **PENDING_MATCH with missing artlist_url**: Use `asset.artlist_url` from the resolver response. If null, construct: `https://artlist.io/search/song?query=<url_encoded_track_name>`. This triggers the amber "Baixar no Artlist" CTA button.

#### Phase 3: Resolve SFX (per scene)

For each SFX entry in each scene:

**3a. Ensure `sfx_category` is set:**

Assign based on the SFX description:

| Category | Assign when description contains |
|----------|----------------------------------|
| `IMPACT` | impact, hit, punch, slam, sting, logo |
| `RISER` | riser, build, tension, ascending, swell |
| `DROP` | drop, bass, release, sub |
| `TRANSITION` | whoosh, swoosh, swipe, transition |
| `AMBIENT` | ambient, room, wind, rain, atmosphere, loop, tone |
| `FOLEY` | footstep, cloth, typing, door, click, object |

If ambiguous, prefer `IMPACT` for short one-shot sounds and `AMBIENT` for loops/pads.

**3b. Query resolver for each SFX:**

```json
POST /api/pipeline/audio-library/resolve
{
  "type": "sfx",
  "category": "<mapped sfx_category lowercase>",
  "tags": ["<from description keywords>"],
  "description": "<sfx description>",
  "limit": 1
}
```

**3c. Populate SFX fields:**

```json
{
  "timestamp": "<keep existing>",
  "description": "<keep existing>",
  "sfx_category": "<assigned above — UPPERCASE>",
  "search_terms": "<COMMA-SEPARATED phrases for Artlist chips>",
  "resolve_status": "<from resolver>",
  "original_filename": "<from top match if LOCAL/PARTIAL_MATCH>",
  "audio_asset_id": "<from top match>",
  "score": "<from top match>",
  "score_max": 34
}
```

**CRITICAL:** `search_terms` for SFX MUST be **comma-separated phrases**, NOT space-separated words. Each comma-delimited term becomes a separate clickable Artlist search chip. Examples:
- GOOD: `"bass drop,impact hit low,deep sub hit"`
- BAD: `"bass drop impact hit low"`

Generate 2-4 comma-separated search phrases that represent different search strategies for finding this SFX on Artlist.

#### Phase 4: PATCH sections back

**CRITICAL:** When building the updated scenes array, preserve ALL existing fields on each scene. Only ADD or UPDATE the music/sfx-related fields. Never drop: `overlays`, `mix`, `transition`, `decide_items`, `edit_notes`, `narrative`, `status`, `difficulty`, `timestamps`, `duration`, `beat_ref`, `label`, `number`.

For each modified item:

```
PATCH /api/pipeline/items/:id/sections/postprod_scenes?lang=pt
Headers:
  X-Pipeline-Key: <key>
  X-Expected-Version: <meta.item_version from GET>
  Content-Type: application/json

Body:
{
  "content": { "scenes": [<fully updated scenes array with ALL original fields preserved>] },
  "rev": <data.rev from the GET response — integer>,
  "source": "cowork",
  "modified_by": "cowork-claude"
}
```

**Response:** `{ data: { rev, content, ... }, meta: { section_key, item_version } }`

**Optimistic locking works in two layers:**
- `X-Expected-Version` → checks item-level version (412 if mismatch)
- `rev` in body → checks section-level revision (409 if mismatch)

For bilingual items: after PATCHing `?lang=pt`, also PATCH `?lang=en` with the same music/sfx resolution data. You MUST re-GET the EN section first to obtain its own `data.rev` and fresh `meta.item_version` (since the PT PATCH incremented it). Keep the English-specific labels/narratives intact — only copy music/sfx fields.

#### Phase 5: Waveform peaks for Audio Library (OPTIONAL — separate concern)

> This phase is independent of Phases 1-4. Skip if the resolver pass is large (>5 items). It can be run as a separate prompt later. Only do this if you have bandwidth after completing ALL music/sfx resolution.

After resolving all scenes, check which audio assets are missing waveform peaks:

```
GET /api/pipeline/audio-library?status=downloaded&limit=200
```

For assets where `metadata.waveform.peaks` is null or missing, generate synthetic waveform data (40-80 normalized values between 0.0-1.0) that approximates the audio character:
- **Ambient/calm tracks** (energy 1-2): Low amplitude, gentle variation (0.1-0.4 range)
- **Epic/intense tracks** (energy 4-5): High amplitude, dramatic peaks (0.3-0.95 range)
- **Builds/risers**: Ascending pattern (start 0.1, end 0.8+)
- **Electronic/rhythmic**: Regular pulse pattern with peaks at beat intervals

PATCH each asset (MERGE with existing metadata — do not overwrite):

1. GET the asset detail: `GET /api/pipeline/audio-library/<uuid>`
2. Extract `existing_metadata` from response
3. Build merged payload:
```json
PATCH /api/pipeline/audio-library/<uuid>
{
  "version": "<from GET response>",
  "metadata": {
    "<...all existing metadata fields preserved...>",
    "waveform": { "peaks": ["<40-80 normalized 0.0-1.0 values>"] }
  }
}
```

### Quality checklist:

Before completing each item, verify:
- [ ] Every non-continuation scene has `recommendations[]` (empty array `[]` is valid ONLY for NO_MATCH — UI shows search chips instead)
- [ ] Every recommendation has `score_breakdown` in `{ key: { score, max } }` format (8 categories, NO `description`)
- [ ] Every recommendation has `reasoning` (specific to the scene — not generic like "good match")
- [ ] `favorite_index` is set on every music object with non-empty recommendations
- [ ] Non-favorite recommendations have `delta_vs_favorite` computed (only non-zero keys)
- [ ] All SFX have `sfx_category` assigned (UPPERCASE enum)
- [ ] All SFX `search_terms` are **comma-separated** phrases (not space-separated)
- [ ] Music `search_terms` remain space-separated (legacy — do NOT convert)
- [ ] `score_max` is always `34` (never 36 or any other value)
- [ ] Continuation scenes are untouched (no recommendations, no resolver call, `resolve_status` stays null)
- [ ] PENDING_MATCH recommendations have `artlist_url` populated
- [ ] All non-audio scene fields are preserved in the PATCH (overlays, mix, transition, edit_notes, etc.)

### Formatting rules:

- `duration`: Always "M:SS" format (e.g., "3:42", "1:05", "0:30")
- `key`: Musical key notation (e.g., "Am", "E3", "Bb", "F#m")
- `bpm`: Integer (e.g., 90, 120, 140)
- `energy`: Integer 1-5
- `score_max`: Always 34
- `sfx_category`: UPPERCASE enum value (`IMPACT`, `RISER`, `DROP`, `TRANSITION`, `AMBIENT`, `FOLEY`)
- `search_terms` (SFX): Comma-separated phrases
- `search_terms` (music): Space-separated keywords (legacy format — never change)

### Error handling:

- If resolver returns 0 matches for music: set `resolve_status: "NO_MATCH"`, empty `recommendations: []`, build artlist_url from search_terms
- If resolver returns error/timeout: skip that scene, log it, continue with next
- If PATCH returns **409** (section `rev` conflict): re-GET the section to get fresh `data.rev`, re-apply changes to fresh content, retry once
- If PATCH returns **412** (item `version` mismatch): re-GET section (fresh `meta.item_version`), re-apply, retry once
- If any response returns 429 or `X-RateLimit-Remaining: 0`: pause for duration in `Retry-After` header (or 60s if absent), then resume
- If GET section returns `data: null` / `meta.exists: false`: skip item (no scenes to resolve)
- **Pacing:** max 2 concurrent resolver calls, minimum 200ms between successive calls to avoid rate limits

### Scope & Resume Safety:

Process ALL pipeline items with postprod_scenes. Do not stop at the first item.

If interrupted mid-pass, note the last successfully PATCHed item code. On resume, the Phase 1 skip logic (checking for existing `score_breakdown` with `{ score, max }` format) will naturally skip already-resolved scenes, so a fresh run is safe to retry without duplicating work.

Report progress after each item (e.g., "Resolved EP042: 8 scenes, 12 SFX, 3 PENDING_MATCH tracks identified").

At the end, provide a summary:
- Total items processed
- Total scenes resolved
- Status breakdown (LOCAL / PENDING_MATCH / PARTIAL_MATCH / NO_MATCH counts)
- Any items that need manual attention (resolver errors, 0-match scenes)
- Audio Library assets updated with waveform peaks (if Phase 5 was executed)
