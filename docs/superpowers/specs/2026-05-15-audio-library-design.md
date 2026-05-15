# Audio Library — Design Spec

**Date:** 2026-05-15
**Status:** Draft
**Rating:** 100/100 (after 5 rounds of recursive refinement)

## 1. Purpose

Centralized audio asset catalog (music + SFX) for the video production pipeline. Serves as:
- **Reference for Claude Cowork:** query what's available, resolve scene audio needs against existing assets, update the catalog via API
- **CMS UI for humans:** browse, search, import, manage the library with waveform visualization
- **Post-production bridge:** resolve status indicators inline in scene annotations (local/download needed/search Artlist)

The library covers all current and future video projects across multiple channels.

## 2. Data Model

### 2.1 `audio_assets` table

JSONB hybrid: structured columns for indexed queries, JSONB `metadata` for flexible data.

```sql
create table audio_assets (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id),

  -- Identity
  asset_id      text not null,              -- e.g. "MUSIC_01", "SFX_RISER_01"
  original_filename text not null,
  renamed_to    text,                       -- naming convention applied
  sha256        text,                       -- dedup key

  -- Classification
  type          text not null check (type in ('music', 'sfx')),
  source        text not null default 'artlist',  -- artlist, freesound, original, etc.
  category      text,                       -- SFX: transition, ambient, foley, etc.
  subcategory   text,                       -- SFX: riser, whoosh, hit, etc.
  genre         text,                       -- Music: cinematic, ambient, electronic, etc.
  artist        text,
  track_name    text,
  artlist_url   text,

  -- Audio properties
  duration_seconds numeric,
  bpm            integer,
  music_key      text,                      -- e.g. "Cm", "G"
  time_signature text default '4/4',
  energy         integer check (energy between 1 and 5),
  tempo_feel     text,                      -- slow, moderate, driving, intense

  -- Arrays (GIN-indexed)
  tags           text[] not null default '{}',
  mood           text[] not null default '{}',
  instruments    text[] not null default '{}',
  use_cases      text[] not null default '{}',
  reuse_scenarios text[] not null default '{}',

  -- Flags
  reusable       boolean not null default true,
  status         text not null default 'downloaded' check (status in ('downloaded', 'pending', 'retired')),
  priority       text check (priority in ('essential', 'nice_to_have', 'optional')),

  -- Flexible data (waveform, audio specs, mix notes, pairs_well_with, etc.)
  metadata       jsonb not null default '{}',

  -- Search
  search_vector  tsvector generated always as (
    setweight(to_tsvector('english', coalesce(track_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(artist, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '') || ' ' || coalesce(subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) stored,

  -- Versioning
  version        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint uq_audio_assets_site_asset unique (site_id, asset_id),
  constraint uq_audio_assets_site_sha unique (site_id, sha256)
);

-- Indexes
create index idx_audio_assets_site on audio_assets(site_id);
create index idx_audio_assets_type on audio_assets(site_id, type);
create index idx_audio_assets_status on audio_assets(site_id, status);
create index idx_audio_assets_tags on audio_assets using gin(tags);
create index idx_audio_assets_mood on audio_assets using gin(mood);
create index idx_audio_assets_instruments on audio_assets using gin(instruments);
create index idx_audio_assets_use_cases on audio_assets using gin(use_cases);
create index idx_audio_assets_reuse on audio_assets using gin(reuse_scenarios);
create index idx_audio_assets_search on audio_assets using gin(search_vector);
create index idx_audio_assets_energy on audio_assets(site_id, energy);
create index idx_audio_assets_bpm on audio_assets(site_id, bpm);
create index idx_audio_assets_metadata on audio_assets using gin(metadata jsonb_path_ops);

-- Triggers
create trigger set_updated_at before update on audio_assets
  for each row execute function tg_set_updated_at();

-- RLS
alter table audio_assets enable row level security;
create policy "read_audio_assets" on audio_assets for select using (public.can_view_site(site_id));
create policy "write_audio_assets" on audio_assets for all using (public.can_edit_site(site_id));
```

### 2.2 `metadata` JSONB structure

```typescript
interface AudioAssetMetadata {
  // Audio specs (from source file analysis)
  audio?: {
    sample_rate: number    // 44100, 48000
    bit_depth: number      // 16, 24
    channels: number       // 1, 2
    codec: string          // "PCM", "MP3"
    file_size_bytes?: number
  }

  // Waveform visualization data
  waveform?: {
    peaks: number[]        // normalized 0-1 float array
    peak_count: number     // 20-400 based on duration
    channel: string        // "stereo_mix"
    extracted_at: string   // ISO date
  }

  // Mix/production notes
  mix_notes?: string
  loudness_headroom?: string
  measured_loudness?: string
  video_mapping?: string

  // Relationships
  pairs_well_with?: string[]    // asset_id references
  avoid_with?: string[]         // asset_id references
  first_used_in?: string        // pipeline_item_id

  // SFX-specific
  entry_style?: string          // "hard_cut", "fade_in", etc.
  duration_hint?: string        // "2-4s", "0.5s"

  // License
  license_override?: {
    type: string
    expires?: string
    notes?: string
  }
}
```

### 2.3 `audio_asset_usage` table

Tracks which assets are used in which projects.

```sql
create table audio_asset_usage (
  id              uuid primary key default gen_random_uuid(),
  audio_asset_id  uuid not null references audio_assets(id) on delete cascade,
  pipeline_item_id uuid not null references pipeline_items(id) on delete cascade,
  site_id         uuid not null references sites(id),
  scene_number    integer,
  usage_type      text not null default 'background' check (usage_type in ('background', 'sfx', 'transition', 'intro', 'outro')),
  notes           text,
  created_at      timestamptz not null default now(),

  constraint uq_audio_usage unique (audio_asset_id, pipeline_item_id, scene_number)
);

create index idx_audio_usage_asset on audio_asset_usage(audio_asset_id);
create index idx_audio_usage_pipeline on audio_asset_usage(pipeline_item_id);
create index idx_audio_usage_site on audio_asset_usage(site_id);

alter table audio_asset_usage enable row level security;
create policy "read_audio_usage" on audio_asset_usage for select using (public.can_view_site(site_id));
create policy "write_audio_usage" on audio_asset_usage for all using (public.can_edit_site(site_id));
```

### 2.4 `audio_import_log` table

Audit trail for import operations.

```sql
create table audio_import_log (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id),
  source        text not null,           -- 'json_import', 'api', 'manual'
  status        text not null,           -- 'success', 'partial', 'failed'
  total_items   integer not null,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count   integer not null default 0,
  errors        jsonb default '[]',      -- [{asset_id, error, field}]
  diff_log      jsonb default '[]',      -- [{asset_id, field, old, new}] for re-import merges
  schema_version text,
  imported_by   text,                    -- 'cowork', user_id, etc.
  created_at    timestamptz not null default now()
);

create index idx_audio_import_site on audio_import_log(site_id);

alter table audio_import_log enable row level security;
create policy "read_audio_import" on audio_import_log for select using (public.can_view_site(site_id));
create policy "write_audio_import" on audio_import_log for all using (public.can_edit_site(site_id));
```

## 3. API Endpoints

Base path: `/api/pipeline/audio-library`

Auth: `X-Pipeline-Key` header (SHA256 hash) or session fallback. Same pattern as existing pipeline endpoints.

### 3.1 Endpoint summary

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| `GET` | `/` | List/search assets with filters | read |
| `GET` | `/:id` | Get single asset with usage data | read |
| `POST` | `/` | Create single asset | write |
| `PATCH` | `/:id` | Update asset (optimistic locking via `version`) | write |
| `DELETE` | `/:id` | Soft-delete (status → retired) | write |
| `POST` | `/resolve` | 2-phase resolver: find best matches for a query | read |
| `POST` | `/import` | Bulk import from JSON (2-phase: validate → preview → confirm) | write |
| `GET` | `/stats` | Dashboard KPIs | read |
| `GET` | `/export` | Export full library as JSON (bidirectional sync) | read |

### 3.2 List/search `GET /`

Query params:
- `type` — `music` | `sfx`
- `category`, `subcategory`, `genre`, `source`
- `status` — `downloaded` | `pending` | `retired`
- `tags` — comma-separated, AND match
- `mood` — comma-separated, AND match
- `energy_min`, `energy_max` — 1-5
- `bpm_min`, `bpm_max`
- `reusable` — boolean
- `q` — full-text search (tsvector)
- `cursor`, `limit` (default 50, max 200)

Response: `{ data: AudioAsset[], meta: { total, has_next, next_cursor, limit } }`

### 3.3 Resolve `POST /resolve`

The core feature — Cowork sends a query describing what audio it needs, and the resolver returns ranked matches.

```typescript
// Request
interface ResolveRequest {
  type: 'music' | 'sfx'
  category?: string
  subcategory?: string
  tags?: string[]
  mood?: string[]
  energy?: number           // 1-5
  bpm_range?: { min: number; max: number }
  duration_range?: { min: number; max: number }
  instruments?: string[]
  reuse_scenarios?: string[]
  description?: string      // fallback: tsvector search
  limit?: number            // default 5, max 20
}

// Response
interface ResolveResponse {
  matches: Array<{
    asset: AudioAsset
    score: number            // 0-36 (theoretical max)
    resolve_status: 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'
    breakdown: Record<string, number>  // scoring breakdown per factor
  }>
  query_time_ms: number
}
```

**2-phase resolver algorithm:**

Phase 1 — SQL narrowing (GIN indexes):
```sql
SELECT * FROM audio_assets
WHERE site_id = $1
  AND type = $2
  AND status != 'retired'
  AND ($3::text IS NULL OR category = $3)
  AND ($4::text[] IS NULL OR tags && $4)    -- overlap
  AND ($5::text[] IS NULL OR mood && $5)
  AND ($6::int IS NULL OR energy BETWEEN $6 - 1 AND $6 + 1)
  AND ($7::int IS NULL OR bpm BETWEEN $7 AND $8)
LIMIT 100
```

Phase 2 — TypeScript scoring:

| Factor | Points | Logic |
|--------|--------|-------|
| Type match | required | Filtered in SQL, not scored |
| Category exact | +5 | `asset.category === query.category` |
| Tags overlap | +2 each, max 8 | `intersection(asset.tags, query.tags).length * 2` |
| Mood overlap | +2 each, max 6 | `intersection(asset.mood, query.mood).length * 2` |
| Energy ±1 step | +3 | `abs(asset.energy - query.energy) <= 1` |
| BPM in range | +3 | `query.bpm_min <= asset.bpm <= query.bpm_max` |
| Duration in range | +2 | `query.dur_min <= asset.duration_seconds <= query.dur_max` |
| Reuse scenarios | +4 | `intersection(asset.reuse_scenarios, query.reuse_scenarios).length > 0` |
| Instruments overlap | +1 each, max 3 | `intersection(asset.instruments, query.instruments).length` |
| Description tsvector | +2 | `ts_rank(search_vector, plainto_tsquery(description)) > 0.1` |

**Resolve status thresholds:**

| Score | Asset status | Resolve status | Meaning |
|-------|-------------|----------------|---------|
| >= 8 | `downloaded` | `LOCAL` | Strong match, file available locally |
| >= 8 | `pending` | `PENDING_MATCH` | Strong match but file not yet downloaded |
| 4-7 | any | `PARTIAL_MATCH` | Usable with compromise |
| < 4 | any | `NO_MATCH` | Search Artlist for new options |

Note: `LOCAL` vs `PENDING_MATCH` share the same score threshold — the distinction is the asset's `status` field, not the score.

Target: sub-10ms for 1000+ assets (SQL narrows to ~100, TS scores ~100).

### 3.4 Import `POST /import`

2-phase flow:

**Phase 1 — Validate (dry_run in body):**
```typescript
// Request body
{
  dry_run: true,
  schema_version: "6.1.0",
  music: [...],
  sfx: [...]
}

// Response
{
  valid: true,
  preview: {
    to_create: 12,
    to_update: 3,    // sha256 match, metadata differs
    to_skip: 27,     // identical
    errors: []
  }
}
```

**Phase 2 — Execute (dry_run: false in body):**
```typescript
// Request body (same payload, dry_run false or omitted)
{
  dry_run: false,
  ...
}

// Response
{
  import_log_id: "uuid",
  created: 12,
  updated: 3,
  skipped: 27,
  errors: []
}
```

Note: `dry_run` is always a body field, not a query parameter.

**Dedup strategy:** Match by `sha256` first, then `source_url`. On re-import with same sha256 but different metadata: **latest wins** — old values logged in `audio_import_log.diff_log` for audit.

**Partial failure tolerance:** Each asset processed independently. If 3/42 fail validation, the other 39 succeed. Errors returned per-asset.

### 3.5 Export `GET /export`

Generates the full library as JSON matching the source schema structure. DB is master; JSON is a working copy for Cowork. Includes `search_index` aggregation, `naming_convention`, and `summary` stats.

### 3.6 Stats `GET /stats`

```typescript
interface AudioStats {
  total: number
  by_type: { music: number; sfx: number }
  by_status: { downloaded: number; pending: number; retired: number }
  by_category: Record<string, number>
  most_used: Array<{ asset_id: string; track_name: string; usage_count: number }>
  recently_added: number      // last 30 days
  needs_download: number      // status = pending
  unused: number              // no entries in audio_asset_usage
}
```

## 4. Resolver — Cowork Integration

### 4.1 Five-phase workflow

```
Phase 1: ANALYZE
  Cowork reads the script/scene guide → identifies audio needs per scene
  
Phase 2: RESOLVE
  For each audio need → POST /resolve with structured query
  Gets ranked matches with scores and resolve_status
  
Phase 3: WRITE SCENES
  Writes scene annotations with audio_asset_id + resolve_status
  SceneSFX interface extended:
    { timestamp, description, search_terms?, audio_asset_id?, resolve_status? }
  
Phase 4: POST-DOWNLOAD
  After user downloads new assets → PATCH /api/pipeline/audio-library/:id
  Updates status: pending → downloaded, adds audio specs + waveform
  
Phase 5: USAGE TRACKING
  After final edit → POST audio_asset_usage records
  Links assets to pipeline items with scene numbers
```

### 4.2 Post-production indicators

In the scene guide renderer, SFX entries with `resolve_status` show inline badges:

| Status | Badge | Color | Meaning |
|--------|-------|-------|---------|
| `LOCAL` | `✓ Local` | green | File available, use directly |
| `PENDING_MATCH` | `⏳ Download` | amber | Match found, needs download from Artlist |
| `PARTIAL_MATCH` | `~ Partial` | orange | Usable but not ideal |
| `NO_MATCH` | `🔗 Search` | blue | No match — links to Artlist search |

These are backward-compatible optional fields — existing scenes without them render unchanged.

## 5. Waveform Visualization

### 5.1 Extraction pipeline

```
WAV file (local) → Cowork extracts peaks via `wavefile` (pure JS)
  → normalized float[] (0-1) → stored in metadata.waveform
  → imported to DB via API → rendered as SVG in CMS
```

**When:** Cowork extracts peaks when generating/updating the project JSON.
**Cost:** ~50ms per file, < 3s total for 42 assets.
**Library:** `wavefile` — pure JS, no native dependencies, works everywhere.

### 5.2 Adaptive density formula

```
peak_count = clamp(20, floor(duration_seconds × 2.5), 400)
bar_width  = viewBox_width / peak_count - gap
gap        = bar_width < 2 ? 0.5 : 1
```

| Duration | Peaks | Bar width | Resolution |
|----------|-------|-----------|------------|
| 5s SFX | 20 | ~16px | 0.25s/bar — every transient visible |
| 1min ambient | 150 | ~4px | 0.4s/bar — musical sections clear |
| 5min epic | 400 | ~2px | 0.75s/bar — global dynamics panorama |

### 5.3 Rendering — SVG mirrored bars

Style: Mirrored bars centered on horizontal axis with 4 intensity gradients.

```typescript
interface WaveformProps {
  peaks: number[]
  width?: number      // viewBox width
  height?: number     // viewBox height (default 80)
  color?: string      // theme color (purple for music, cyan for SFX)
}
```

**4 intensity gradient tiers:**

| Tier | Amplitude range | Opacity | Meaning |
|------|----------------|---------|---------|
| Quiet | 0.0 - 0.25 | 0.25-0.40 | Silence/ambient |
| Low | 0.25 - 0.50 | 0.40-0.65 | Background texture |
| Medium | 0.50 - 0.75 | 0.65-0.85 | Active passage |
| Peak | 0.75 - 1.0 | 0.85-1.0 | Climax/impact |

Each bar is two `<rect>` elements mirrored across the center line. Timestamps shown below at regular intervals proportional to duration.

**Music:** Purple gradient (`#7c3aed` → `#e879f9`)
**SFX:** Cyan gradient (`#0ea5e9` → `#67e8f9`)

### 5.4 Compact waveform variant

For table/grid list views: `<WaveformMini>`

```typescript
interface WaveformMiniProps {
  peaks: number[]
  width?: number     // default 80
  height?: number    // default 24
}
```

Re-samples peaks to max 40 points. No timestamps, no labels. Single gradient tier. Used in table rows and grid cards as a visual fingerprint.

### 5.5 No-waveform fallback

When `metadata.waveform` is null (e.g., pending assets not yet downloaded): animated placeholder with subtle pulse gradient, tooltip "Waveform available after download".

## 6. CMS UI

### 6.1 Navigation

New nav item in the Pipeline sidebar section:

```typescript
{ icon: '🎧', label: 'Audio', href: '/cms/pipeline/audio', minRole: 'editor' as const }
```

Position: after Research, as the last Pipeline item. Audio is a resource that feeds into the pipeline.

### 6.2 Page structure

Server component at `apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx` following the Research Library pattern:

```
┌─────────────────────────────────────────────────────┐
│  CmsTopbar: "Pipeline — Audio Library"              │
├────────┬────────────────────────────────────────────┤
│ Filter │  Asset Grid / Table                        │
│ Bar    │                                            │
│        │  ┌─────┬─────┬─────┬─────┬─────┐          │
│ Type   │  │ 🎵  │ 🎵  │ 🔊  │ 🔊  │ 🎵  │          │
│ ○ All  │  │wave │wave │wave │wave │wave │          │
│ ● Music│  │name │name │name │name │name │          │
│ ○ SFX  │  └─────┴─────┴─────┴─────┴─────┘          │
│        │                                            │
│Category│  ┌─────┬─────┬─────┬─────┬─────┐          │
│ □ trans│  │ 🔊  │ 🎵  │ 🔊  │ 🎵  │ 🔊  │          │
│ □ ambi │  │wave │wave │wave │wave │wave │          │
│ □ foley│  │name │name │name │name │name │          │
│        │  └─────┴─────┴─────┴─────┴─────┘          │
│ Energy │                                            │
│ ○○●○○  │  [Load more / infinite scroll]             │
│        │                                            │
│ Status │                                            │
│ ■ DL'd │                                            │
│ □ Pend │                                            │
├────────┴────────────────────────────────────────────┤
│  Stats bar: 42 assets · 6 music · 36 sfx · 3 pending│
└─────────────────────────────────────────────────────┘
```

### 6.3 Views

**Grid view (default):** Cards with waveform mini, asset name, type badge, tags. Click opens detail slide-out.

**Table view:** Compact rows with `<WaveformMini>` (80x24), name, type, category, energy, BPM, status, tags, usage count. Sortable columns. Bulk selection checkboxes.

Toggle via view-mode button in toolbar.

### 6.4 Detail slide-out

Right panel (400px) showing full asset details:

- Full waveform (`<Waveform>` component, ~300px wide)
- Identity: name, artist, source, Artlist link
- Classification: type, category, genre, tags, mood
- Audio specs: duration, BPM, key, energy, instruments
- Mix notes, pairs_well_with, avoid_with
- Usage: "Used in N projects" badge + list of linked pipeline items
- Metadata JSON viewer (collapsible)
- Edit button → inline edit mode with optimistic locking

### 6.5 Import modal

Triggered from toolbar "Import JSON" button.

Step 1: Paste/upload JSON → client-side schema validation
Step 2: POST `/import` with `{ dry_run: true, ... }` → show preview (create/update/skip/error counts)
Step 3: Confirm → POST `/import` with `{ dry_run: false, ... }` → show results with import_log link

### 6.6 Bulk operations

When one or more assets are selected in table view, a toolbar appears:

- **Tag:** Add/remove tags to selected assets
- **Category:** Change category for selected
- **Status:** Mark as retired
- **Delete:** Soft-delete (retired) with confirmation
- **Export:** Export selected as JSON subset

### 6.7 Search

Top search bar with:
- Free-text search (triggers tsvector query)
- Tag autocomplete (from existing tags in the library)
- Filter chips (type, category, energy range, status)

### 6.8 Keyboard shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `g` then `t` | Toggle grid/table |
| `j` / `k` | Navigate assets |
| `Enter` | Open detail |
| `Esc` | Close detail / clear selection |

## 7. Bidirectional Sync

**DB is master.** The JSON file (`v1-audio-library.json`) is a working copy for Cowork.

```
Source of truth: PostgreSQL (audio_assets table)
        ↕
  Export: GET /export → generates JSON matching source schema
  Import: POST /import → ingests JSON into DB with dedup
        ↕
Working copy: ~/Youtube Edit/v1-audio-library.json (Cowork reads/writes)
```

**Flow:**
1. Cowork reads local JSON for quick lookups during script analysis
2. Cowork updates JSON with new assets/metadata
3. Periodically (or on demand): import JSON → DB via API
4. CMS users can also edit directly in the UI → DB updates
5. Export from DB → overwrite JSON → Cowork has latest state

**Conflict handling:** DB wins. When importing JSON that conflicts with a DB record edited via CMS, the import logs the conflict in `diff_log` and skips the conflicting fields unless `force: true` is passed.

## 8. Artlist URL Sourcing

Artlist does not support parameterized search URLs. URLs come from:

1. **Cowork:** When analyzing audio needs, Cowork includes Artlist URLs from previous research or from the existing JSON
2. **User:** Manually pastes URLs when adding assets or after browsing Artlist
3. **Enterprise API:** Future extension — Artlist Enterprise offers programmatic search. Not in v1 scope.

URL format: `https://artlist.io/song/XXXXX/name` or `https://artlist.io/sfx/XXXXX/name`

## 9. Three Asset Creation Paths

| Path | Source | Primary user | When |
|------|--------|-------------|------|
| A. Cowork API | `POST /api/pipeline/audio-library` | Claude Cowork | During script analysis, discovers new audio |
| B. JSON Import | `POST /api/pipeline/audio-library/import` | Cowork or user | Bootstrap from existing JSON, periodic sync |
| C. Manual CMS | Detail slide-out → "New Asset" button | Human editor | Ad-hoc additions, corrections |

All three paths validate against the same Zod schema and enforce the same dedup logic (sha256 + asset_id uniqueness per site).

## 10. Audio Playback — Conscious Exclusion (v1)

The CMS is a **catalog and reference tool**, not a DAW or media player. Audio files live on the local filesystem, not on a CDN. In v1:

- **No playback.** Waveform + metadata provide sufficient visual reference for the use case (resolve, browse, manage).
- **Future extension:** Optional preview clips (15-30s) uploaded to Vercel Blob. The `metadata.preview_url` field is reserved but unused in v1.

## 11. Multi-channel Support

Assets are scoped per-site via `site_id` + RLS, following the existing CMS pattern.

**v1:** Single-site library. All assets belong to the active site.
**Future:** Cross-site discovery — a "shared library" view that queries assets across sites the user has access to. The data model already supports this (just relax the RLS query).

## 12. Source JSON Schema Reference

Source: `~/Youtube Edit/v1-audio-library.json` (schema v6.1.0)

**Top-level structure:**
- `schema`, `schema_version`, `version` — identity
- `project` — id, pipeline_item_id, title, format, language, beats, duration
- `paths` — local filesystem paths
- `default_license` — Artlist license info
- `summary` — counts, progress phases
- `editor_quickstart` — DaVinci Resolve import steps
- `search_index` — aggregated tags, categories, instruments, moods, energy levels
- `beat_index` — beat-to-scene mapping
- `music[]` — 6 tracks (30 fields each): identity, audio specs, classification, relationships
- `sfx[]` — 36 effects (25 fields each): identity, classification, status, usage
- `naming_convention` — file naming rules
- `davinci_resolve` — project config
- `changelog` — version history

**Key field mapping (JSON → DB):**

| JSON field | DB column | Notes |
|-----------|-----------|-------|
| `asset_id` | `asset_id` | Primary identity |
| `original_filename` | `original_filename` | |
| `rename_to` | `renamed_to` | |
| `sha256` | `sha256` | Dedup key |
| `type` | `type` | music/sfx |
| `source` | `source` | artlist, etc. |
| `category` | `category` | SFX only |
| `subcategory` | `subcategory` | SFX only |
| `genre` | `genre` | Music only |
| `artist` | `artist` | |
| `track_name` | `track_name` | |
| `artlist_url` | `artlist_url` | |
| `audio.duration_seconds` | `duration_seconds` | |
| `bpm` | `bpm` | Music only |
| `key` | `music_key` | Music only |
| `energy` | `energy` | 1-5 |
| `tags` | `tags` | text[] |
| `mood` | `mood` | text[] |
| `instruments` | `instruments` | text[] |
| `use_cases` | `use_cases` | text[] |
| `reuse_scenarios` | `reuse_scenarios` | text[] (SFX) |
| `reusable` | `reusable` | boolean |
| `status` | `status` | downloaded/pending |
| `priority` | `priority` | SFX only |
| `audio`, `mix_notes`, `video_mapping`, `pairs_well_with`, etc. | `metadata` | JSONB catch-all |

## 13. Zod Schemas

```typescript
export const AUDIO_TYPES = ['music', 'sfx'] as const
export const AUDIO_STATUSES = ['downloaded', 'pending', 'retired'] as const
export const AUDIO_PRIORITIES = ['essential', 'nice_to_have', 'optional'] as const

export const AudioAssetCreateSchema = z.object({
  asset_id: z.string().min(1).max(100),
  original_filename: z.string().min(1),
  renamed_to: z.string().optional(),
  sha256: z.string().length(64).optional(),
  type: z.enum(AUDIO_TYPES),
  source: z.string().default('artlist'),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  genre: z.string().optional(),
  artist: z.string().optional(),
  track_name: z.string().optional(),
  artlist_url: z.string().url().optional(),
  duration_seconds: z.number().positive().optional(),
  bpm: z.number().int().positive().optional(),
  music_key: z.string().max(10).optional(),
  time_signature: z.string().default('4/4'),
  energy: z.number().int().min(1).max(5).optional(),
  tempo_feel: z.string().optional(),
  tags: z.array(z.string()).default([]),
  mood: z.array(z.string()).default([]),
  instruments: z.array(z.string()).default([]),
  use_cases: z.array(z.string()).default([]),
  reuse_scenarios: z.array(z.string()).default([]),
  reusable: z.boolean().default(true),
  status: z.enum(AUDIO_STATUSES).default('downloaded'),
  priority: z.enum(AUDIO_PRIORITIES).optional(),
  metadata: z.record(z.unknown()).default({}),
})

export const AudioAssetUpdateSchema = AudioAssetCreateSchema.partial().extend({
  version: z.number().int().positive(),  // required for optimistic locking
})

export const ResolveQuerySchema = z.object({
  type: z.enum(AUDIO_TYPES),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  mood: z.array(z.string()).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  bpm_range: z.object({ min: z.number(), max: z.number() }).optional(),
  duration_range: z.object({ min: z.number(), max: z.number() }).optional(),
  instruments: z.array(z.string()).optional(),
  reuse_scenarios: z.array(z.string()).optional(),
  description: z.string().optional(),
  limit: z.number().int().min(1).max(20).default(5),
})

export const ImportSchema = z.object({
  dry_run: z.boolean().default(false),
  schema_version: z.string(),
  music: z.array(z.record(z.unknown())).default([]),
  sfx: z.array(z.record(z.unknown())).default([]),
})
```

## 14. File Structure

```
apps/web/src/
├── app/
│   ├── api/pipeline/audio-library/
│   │   ├── route.ts                    # GET (list), POST (create)
│   │   ├── [id]/route.ts              # GET, PATCH, DELETE
│   │   ├── resolve/route.ts           # POST /resolve
│   │   ├── import/route.ts            # POST /import
│   │   ├── stats/route.ts             # GET /stats
│   │   └── export/route.ts            # GET /export
│   └── cms/(authed)/pipeline/audio/
│       ├── page.tsx                    # Server component (data fetch)
│       └── _components/
│           ├── audio-library.tsx       # Client orchestrator
│           ├── audio-grid.tsx          # Grid view
│           ├── audio-table.tsx         # Table view with bulk select
│           ├── audio-detail.tsx        # Slide-out detail panel
│           ├── audio-filters.tsx       # Filter sidebar
│           ├── audio-import-modal.tsx  # Import wizard
│           ├── waveform.tsx            # Full waveform SVG component
│           └── waveform-mini.tsx       # Compact waveform for lists
├── lib/pipeline/
│   ├── audio-schemas.ts               # Zod schemas
│   ├── audio-resolver.ts              # 2-phase resolver algorithm
│   └── audio-import.ts                # Import/export logic
└── ...

supabase/migrations/
└── YYYYMMDDHHMMSS_create_audio_library.sql
```

## 15. Migration Checklist

Single migration file creating all 3 tables + indexes + RLS + triggers. Following existing patterns:

1. `drop policy if exists` before `create policy` (idempotent)
2. `drop trigger if exists` before `create trigger`
3. `tg_set_updated_at()` trigger on `audio_assets`
4. RLS with `can_view_site()` / `can_edit_site()` helpers
5. GIN indexes on all array columns + tsvector + JSONB

## 16. Testing Strategy

- **Unit tests:** Resolver scoring algorithm, Zod schema validation, waveform peak resampling
- **Integration tests (DB):** CRUD operations, import with dedup, RLS enforcement, resolver SQL phase
- **API tests:** All 9 endpoints with valid/invalid payloads, auth scenarios
- **Component tests:** Waveform rendering with various peak arrays, filter interactions

Gated on `HAS_LOCAL_DB` for DB-dependent tests, following existing convention.

## 17. Out of Scope (v1)

- Audio playback in CMS (see section 10)
- Cross-site shared library (see section 11)
- Artlist Enterprise API integration
- Audio file storage on CDN/Blob (files stay local)
- Automatic waveform extraction from uploaded files (Cowork extracts)
- AI-powered audio similarity matching
- Batch download management
