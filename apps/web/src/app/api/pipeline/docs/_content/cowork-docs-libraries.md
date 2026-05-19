## Audio Library

Auth: `X-Pipeline-Key` header (read for queries, write for mutations). **NÃO use `Authorization: Bearer`.**

The Audio Library stores music and SFX assets with rich metadata (tags, mood, energy, BPM, instruments, reuse scenarios). A 2-phase resolver algorithm (SQL narrowing → TypeScript scoring) finds the best matches for any content production context.

### Key concepts

| Concept | Description |
|---------|-------------|
| `type` | `"music"` or `"sfx"` — every asset has exactly one |
| `status` | `"downloaded"` (ready to use), `"pending"` (needs download), `"retired"` (soft-deleted) |
| `asset_id` | Unique vendor ID (e.g. Artlist ID). Used for dedup on import. |
| `energy` | 1–5 scale. 1 = calm/ambient, 5 = intense/epic |
| `resolve_status` | Result quality: `LOCAL` (score ≥ 8, downloaded), `PENDING_MATCH` (score ≥ 8, pending download), `PARTIAL_MATCH` (score ≥ 4), `NO_MATCH` (score < 4) |
| `usage` | Links an asset to a pipeline item (scene_number, usage_type: background/sfx/transition/intro/outro) |

### POST /api/pipeline/audio-library/resolve — Smart audio matching

**This is the primary endpoint for Cowork.** Use it during post-production to find the best audio for each scene/segment.

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library/resolve \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "music",
    "category": "cinematic",
    "tags": ["epic", "motivational"],
    "mood": ["inspiring", "determined"],
    "energy": 4,
    "bpm_range": { "min": 100, "max": 140 },
    "duration_range": { "min": 60, "max": 180 },
    "instruments": ["piano", "strings"],
    "reuse_scenarios": ["intro", "highlight"],
    "description": "background music for tech tutorial intro",
    "limit": 5
  }'
```

**Response:**

```json
{
  "data": {
    "matches": [
      {
        "asset": { "id": "uuid", "asset_id": "artlist-12345", "original_filename": "Epic Rise.mp3", "type": "music", "category": "cinematic", "energy": 4, "bpm": 120, "tags": ["epic", "motivational"], "mood": ["inspiring"], "status": "downloaded", "..." : "..." },
        "score": 18,
        "breakdown": { "category": 5, "tags": 4, "mood": 2, "energy": 3, "bpm_in_range": 3, "duration_in_range": 0, "reuse_scenarios": 0, "instruments": 1, "description": 0 },
        "resolve_status": "LOCAL"
      }
    ],
    "query_time_ms": 12
  }
}
```

**Scoring algorithm (max 34 points):**

| Criterion | Max points | Logic |
|-----------|-----------|-------|
| `category` | 5 | Exact match |
| `tags` | 8 | 2 pts per matching tag (capped at 8) |
| `mood` | 6 | 2 pts per matching mood (capped at 6) |
| `energy` | 3 | ±1 tolerance from query value |
| `bpm_in_range` | 3 | Within min–max range |
| `duration_in_range` | 2 | Within min–max range |
| `reuse_scenarios` | 4 | Any overlap = 4 points |
| `instruments` | 3 | 1 pt per matching instrument (capped at 3) |

Total: **34 points**. The `description` field in the resolver response is for internal full-text ranking only — do NOT include it in `score_breakdown` for the UI. `score_max` is always `34`.

**Resolve status thresholds:**
- `LOCAL` — score ≥ 8 AND status = `downloaded` (ready to use immediately)
- `PENDING_MATCH` — score ≥ 8 AND status = `pending` (good match but needs download)
- `PARTIAL_MATCH` — score ≥ 4 (decent match, review recommended)
- `NO_MATCH` — score < 4 (poor match)

**Query fields (all optional except `type`):**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"music"` \| `"sfx"` | **Required.** Asset type to search |
| `category` | string | Exact category match (e.g. "cinematic", "electronic") |
| `subcategory` | string | Sub-category filter |
| `tags` | string[] | Tag overlap filter |
| `mood` | string[] | Mood overlap filter |
| `energy` | 1–5 | Target energy level (±1 tolerance) |
| `bpm_range` | `{ min, max }` | BPM range filter |
| `duration_range` | `{ min, max }` | Duration in seconds |
| `instruments` | string[] | Instrument overlap filter |
| `reuse_scenarios` | string[] | Reuse context (e.g. "intro", "highlight", "review") |
| `description` | string | Free-text search (uses PostgreSQL websearch) |
| `limit` | 1–20 | Max results (default: 5) |

### GET /api/pipeline/audio-library — List assets

Paginated listing with filtering. Cursor-based pagination.

```
GET /api/pipeline/audio-library?type=music&status=downloaded&limit=50
GET /api/pipeline/audio-library?tags=epic,cinematic&energy_min=3&energy_max=5
GET /api/pipeline/audio-library?category=electronic&bpm_min=120&bpm_max=140
GET /api/pipeline/audio-library?q=ambient+piano&limit=20
GET /api/pipeline/audio-library?cursor=<last-item-uuid>&limit=50
```

**Query params:** `type`, `status`, `category`, `tags` (comma-separated), `mood` (comma-separated), `energy_min`, `energy_max`, `bpm_min`, `bpm_max`, `q` (full-text search), `cursor`, `limit` (1–200, default 50).

**Response includes:** `data` (array), `meta: { total, has_next, next_cursor, limit }`.

### POST /api/pipeline/audio-library — Create single asset

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "artlist-67890",
    "original_filename": "Calm Waters.mp3",
    "type": "music",
    "source": "artlist",
    "category": "ambient",
    "energy": 2,
    "bpm": 80,
    "tags": ["calm", "ambient", "nature"],
    "mood": ["peaceful", "reflective"],
    "instruments": ["piano", "synth pad"],
    "reuse_scenarios": ["background", "outro"],
    "reusable": true,
    "status": "downloaded",
    "metadata": {
      "waveform": { "peaks": [0.1, 0.3, 0.6, 0.9, 0.7, 0.5, 0.2] },
      "mix_notes": "Gentle piano intro, builds with strings at 0:45"
    }
  }'
```

Returns 201 with full asset. Returns 409 on duplicate `asset_id` or `sha256`.

### GET /api/pipeline/audio-library/:id — Asset detail with usage history

Returns full asset data plus `usage` array showing which pipeline items used this asset.

```json
{
  "data": {
    "id": "uuid", "asset_id": "artlist-12345", "...",
    "usage": [
      {
        "id": "uuid",
        "pipeline_item_id": "uuid",
        "scene_number": 3,
        "usage_type": "background",
        "notes": "Used during tech demo section",
        "content_pipeline": { "code": "EP042", "title_pt": "Como criar um agente AI", "format": "youtube_video" }
      }
    ]
  }
}
```

### PATCH /api/pipeline/audio-library/:id — Update asset

Requires `version` field for optimistic locking (from GET response). Returns 409 on version conflict.

```bash
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "tags": ["epic", "motivational", "cinematic"],
    "energy": 5,
    "reuse_scenarios": ["intro", "highlight", "review"]
  }'
```

Updatable fields: all except `asset_id` and `type`. Always include `version`.

### Metadata fields (JSONB `metadata` column)

The `metadata` column stores structured data that enriches the CMS UI. Include these in imports and PATCH updates. Fields are nested inside the `metadata` object.

| Field path | Type | Description | Example |
|-----------|------|-------------|---------|
| `waveform.peaks` | `number[]` (0–1, max 200 values) | Normalized amplitude peaks for visual waveform display. Generate from audio analysis. Values 0.0 (silence) to 1.0 (max amplitude). 40–80 samples ideal for card display, 60–120 for detail. | `[0.1, 0.35, 0.8, 0.6, ...]` |
| `pairs_well_with` | `string[]` | `asset_id`s of complementary tracks (shown in detail panel "Compatibility" section) | `["artlist-123", "artlist-456"]` |
| `avoid_with` | `string[]` | `asset_id`s that clash with this track | `["artlist-789"]` |
| `mix_notes` | `string` | Free-text mixing/usage notes (shown in detail panel) | `"Starts quiet, builds at 0:45. Good for layering under voiceover."` |
| `audio.loudness_lufs` | `number` | Measured loudness in LUFS | `-14.2` |
| `audio.sample_rate` | `number` | Sample rate in Hz | `44100` |
| `audio.bit_depth` | `number` | Bit depth | `24` |
| `audio.channels` | `number` | Channel count (1=mono, 2=stereo) | `2` |
| `video_mapping` | `object` | Scene-to-timestamp mapping for video editors | `{ "intro": "0:00-0:15", "build": "0:15-0:45" }` |
| `entry_style` | `string` | How the track should enter (fade, cut, crossfade) | `"fade"` |
| `duration_hint` | `string` | Recommended usage duration | `"30s-2min"` |

**Waveform peaks generation:**

When importing or updating assets, include waveform peaks for visual display in the CMS grid/table/detail views. Without peaks, the UI shows a shimmer placeholder.

Example in import payload:
```json
{
  "schema_version": "6.1.0",
  "music": [
    {
      "asset_id": "artlist-12345",
      "original_filename": "Epic Rise.mp3",
      "category": "cinematic",
      "energy": 4,
      "waveform": {
        "peaks": [0.12, 0.25, 0.48, 0.72, 0.85, 0.93, 0.78, 0.62, 0.45, 0.3]
      },
      "pairs_well_with": ["artlist-67890"],
      "mix_notes": "Dramatic build starting at 0:30. Layer under voiceover for first 30 seconds."
    }
  ]
}
```

Example PATCH to add waveform data to existing asset:
```bash
curl -X PATCH https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "metadata": {
      "waveform": {
        "peaks": [0.12, 0.25, 0.48, 0.72, 0.85, 0.93, 0.78, 0.62, 0.45, 0.3]
      },
      "pairs_well_with": ["artlist-67890"],
      "mix_notes": "Dramatic build starting at 0:30"
    }
  }'
```

### DELETE /api/pipeline/audio-library/:id — Soft-delete (retire) asset

Sets status to `retired`. Asset remains in DB but excluded from resolve queries and exports.

```bash
curl -X DELETE https://bythiagofigueiredo.com/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

### POST /api/pipeline/audio-library/import — Bulk import

Import multiple assets at once. Supports `dry_run` mode for preview.

```bash
curl -X POST https://bythiagofigueiredo.com/api/pipeline/audio-library/import \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false,
    "schema_version": "1.0",
    "music": [
      { "asset_id": "artlist-100", "original_filename": "Track A.mp3", "category": "cinematic", "tags": ["epic"], "energy": 4, "waveform": { "peaks": [0.1, 0.3, 0.5, 0.8, 0.6, 0.4, 0.2] } },
      { "asset_id": "artlist-101", "original_filename": "Track B.mp3", "category": "electronic", "tags": ["upbeat"], "energy": 3 }
    ],
    "sfx": [
      { "asset_id": "sfx-200", "original_filename": "Whoosh.wav", "category": "transition" }
    ]
  }'
```

**Response (dry_run: true):**
```json
{ "data": { "dry_run": true, "preview": { "to_create": 2, "to_update": 1, "to_skip": 0, "errors": [] } } }
```

**Response (dry_run: false):**
```json
{ "data": { "dry_run": false, "import_log_id": "uuid", "created": 2, "updated": 1, "skipped": 0, "errors": [] } }
```

Max 500 items per type (1000 total). Upserts on `site_id + asset_id`. Each item processed independently; partial failures don't block others. Classification: `create` (new), `update` (exists with changes), `skip` (identical).

### GET /api/pipeline/audio-library/stats — Library statistics

```json
{
  "data": {
    "total": 245,
    "by_type": { "music": 180, "sfx": 65 },
    "by_status": { "downloaded": 200, "pending": 40, "retired": 5 },
    "by_category": { "cinematic": 50, "electronic": 40, "ambient": 30, "..." : "..." },
    "recently_added": 12,
    "needs_download": 40,
    "unused": 85
  }
}
```

### GET /api/pipeline/audio-library/export — Full library export

Downloads all non-retired assets as JSON (Content-Disposition: attachment). Use for backup or cross-system sync.

```bash
curl https://bythiagofigueiredo.com/api/pipeline/audio-library/export \
  -H "X-Pipeline-Key: $KEY" \
  -o audio-library-export.json
```

---

# B-Roll Library

## Endpoints

### GET /api/pipeline/broll-library
List B-roll assets with filters.
Query params: `search`, `status` (active|retired), `tags`, `resolution`, `codec`, `limit` (default 50), `cursor`.

### POST /api/pipeline/broll-library
Create a B-roll asset. Required: `title`, `file_path`. Optional: `tags`, `duration_ms`, `fps`, `resolution`, `codec`, `metadata`.

### GET /api/pipeline/broll-library/:id
Get B-roll asset detail with usage info across pipeline items.

### PATCH /api/pipeline/broll-library/:id
Update B-roll asset. Requires `X-Expected-Version` header.

### DELETE /api/pipeline/broll-library/:id
Retire B-roll asset (soft delete).

### POST /api/pipeline/broll-library/import
Batch import B-roll assets. Supports `dry_run: true` to preview changes.
