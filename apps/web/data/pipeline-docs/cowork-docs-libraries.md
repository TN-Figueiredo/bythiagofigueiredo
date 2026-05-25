# Audio & B-Roll Libraries

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
curl -X POST $BASE_URL/api/pipeline/audio-library/resolve \
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
curl -X POST $BASE_URL/api/pipeline/audio-library \
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
curl -X PATCH $BASE_URL/api/pipeline/audio-library/<uuid> \
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
curl -X PATCH $BASE_URL/api/pipeline/audio-library/<uuid> \
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
curl -X DELETE $BASE_URL/api/pipeline/audio-library/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

### POST /api/pipeline/audio-library/import — Bulk import

Import multiple assets at once. Supports `dry_run` mode for preview.

```bash
curl -X POST $BASE_URL/api/pipeline/audio-library/import \
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
curl $BASE_URL/api/pipeline/audio-library/export \
  -H "X-Pipeline-Key: $KEY" \
  -o audio-library-export.json
```

---

# B-Roll Library

Auth: `X-Pipeline-Key` header (read for queries, write for mutations). **NÃO use `Authorization: Bearer`.**

The B-Roll Library stores video footage, photos, screen recordings, stock clips, graphics, and animations with rich metadata (tags, location, resolution, codec, color profile). Assets are scoped by `source_type` (personal vs. generic) and support optimistic concurrency control on updates.

### Key concepts

| Concept | Description |
|---------|-------------|
| `type` | `"footage"`, `"photo"`, `"screen_recording"`, `"stock"`, `"graphic"`, or `"animation"` |
| `status` | `"available"` (ready to use), `"pending"` (needs processing/download), `"retired"` (soft-deleted) |
| `source_type` | `"pessoal"` (personal/original capture) or `"generico"` (stock/generic) |
| `asset_id` | Unique vendor or local ID. Used for dedup on import. |
| `resolution` | String label (e.g. `"1080p"`, `"4K"`, `"720p"`). `width` × `height` store pixel dimensions. |
| `reusable` | Whether the asset can appear in multiple productions. |
| `usage` | Links an asset to a pipeline item (beat_index, timecode_in, timecode_out, usage_type). |
| `version` | Optimistic concurrency counter. Always pass the current `version` on PATCH. |

### B-Roll asset schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | UUID | auto | — | Asset primary key |
| `asset_id` | string (max 100) | yes | — | Unique vendor/local ID for dedup |
| `original_filename` | string (max 500) | yes | — | Original file name as imported |
| `renamed_to` | string (max 500) | no | null | Renamed file name (post-processing) |
| `sha256` | string (64 hex chars) | no | null | File hash for dedup on import |
| `file_size_bytes` | integer ≥ 0 | no | null | Raw file size |
| `type` | enum | no | `"footage"` | Asset category (see Key concepts) |
| `source` | string (max 200) | no | `"local"` | Origin library (e.g. `"artgrid"`, `"local"`, `"pexels"`) |
| `source_type` | `"pessoal"` \| `"generico"` | no | `"pessoal"` | Personal capture vs. stock |
| `category` | string (max 100) | no | null | Broad category (e.g. `"nature"`, `"technology"`, `"people"`) |
| `subcategory` | string (max 100) | no | null | Refined category |
| `location` | string (max 300) | no | null | Where it was filmed (e.g. `"São Paulo - Paulista"`) |
| `description` | string (max 2000) | no | null | Free-text description |
| `tags` | string[] (max 50 items) | no | `[]` | Searchable tags |
| `codec` | string (max 50) | no | null | Video codec (e.g. `"h264"`, `"prores"`, `"hevc"`) |
| `fps` | integer 1–240 | no | null | Frames per second |
| `resolution` | string (max 20) | no | `"1080p"` | Resolution label |
| `width` | integer > 0 | no | null | Frame width in pixels |
| `height` | integer > 0 | no | null | Frame height in pixels |
| `duration_seconds` | number ≥ 0 | no | null | Clip duration in seconds |
| `bitrate_kbps` | integer > 0 | no | null | Video bitrate in Kbps |
| `has_audio` | boolean | no | `false` | Whether the clip has an audio track |
| `color_profile` | string (max 50) | no | null | Color space (e.g. `"sRGB"`, `"Rec. 709"`, `"Log3G10"`) |
| `storage_url` | URL | no | null | Full-resolution file URL |
| `thumbnail_url` | URL | no | null | Thumbnail image URL |
| `proxy_url` | URL | no | null | Low-res proxy for editing |
| `reusable` | boolean | no | `true` | Can appear in multiple productions |
| `status` | enum | no | `"available"` | Asset lifecycle state |
| `captured_at` | ISO-8601 datetime | no | null | When the footage was captured |
| `metadata` | JSONB object | no | `{}` | Extensible structured metadata (max 64 KB) |
| `version` | integer | auto | 1 | OCC counter — include on PATCH |
| `created_at` | ISO-8601 datetime | auto | — | Creation timestamp |
| `updated_at` | ISO-8601 datetime | auto | — | Last update timestamp |

### GET /api/pipeline/broll-library — List assets

Paginated listing with filtering. Cursor-based pagination.

```
GET /api/pipeline/broll-library?type=footage&status=available&limit=50
GET /api/pipeline/broll-library?tags=urban,timelapse&source_type=pessoal
GET /api/pipeline/broll-library?category=technology&resolution=4K
GET /api/pipeline/broll-library?q=office+desk+aerial&limit=20
GET /api/pipeline/broll-library?location=São+Paulo&has_audio=false
GET /api/pipeline/broll-library?cursor=<last-item-uuid>&limit=50
```

```bash
curl "$BASE_URL/api/pipeline/broll-library?type=footage&status=available&tags=urban,timelapse&limit=20" \
  -H "X-Pipeline-Key: $KEY"
```

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | enum | Filter by asset type: `footage`, `photo`, `screen_recording`, `stock`, `graphic`, `animation` |
| `status` | enum | Filter by status: `available`, `pending`, `retired` |
| `source_type` | enum | `pessoal` or `generico` |
| `category` | string | Exact category match (case-sensitive) |
| `resolution` | string | Exact resolution label match (e.g. `"1080p"`, `"4K"`) |
| `tags` | string (comma-separated) | Filter assets that contain ALL listed tags |
| `has_audio` | `true` \| `false` | Filter by presence of audio track |
| `reusable` | `true` \| `false` | Filter by reusability flag |
| `location` | string | Partial case-insensitive match on location field |
| `q` | string | Full-text search across title, description, tags (PostgreSQL websearch) |
| `cursor` | UUID | Pagination cursor (the `id` of the last item from previous page) |
| `limit` | integer 1–200 | Results per page (default: 50) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "asset_id": "artgrid-88123",
      "original_filename": "urban-timelapse-4k.mp4",
      "renamed_to": "ep042-broll-city-intro.mp4",
      "type": "footage",
      "source": "artgrid",
      "source_type": "generico",
      "category": "urban",
      "subcategory": "timelapse",
      "location": "São Paulo - Paulista",
      "description": "4K timelapse of Paulista Avenue at night",
      "tags": ["urban", "timelapse", "night", "4K", "city"],
      "codec": "h264",
      "fps": 24,
      "resolution": "4K",
      "width": 3840,
      "height": 2160,
      "duration_seconds": 30.0,
      "bitrate_kbps": 40000,
      "has_audio": false,
      "color_profile": "Rec. 709",
      "storage_url": "https://cdn.example.com/broll/urban-timelapse-4k.mp4",
      "thumbnail_url": "https://cdn.example.com/broll/thumbs/urban-timelapse-4k.jpg",
      "proxy_url": "https://cdn.example.com/broll/proxy/urban-timelapse-4k-720p.mp4",
      "reusable": true,
      "status": "available",
      "captured_at": null,
      "metadata": {},
      "version": 1,
      "created_at": "2026-05-01T10:00:00Z",
      "updated_at": "2026-05-01T10:00:00Z"
    }
  ],
  "meta": { "total": 142, "has_next": true, "next_cursor": "uuid", "limit": 20 }
}
```

### POST /api/pipeline/broll-library — Create single asset

```bash
curl -X POST $BASE_URL/api/pipeline/broll-library \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "artgrid-88123",
    "original_filename": "urban-timelapse-4k.mp4",
    "renamed_to": "ep042-broll-city-intro.mp4",
    "type": "footage",
    "source": "artgrid",
    "source_type": "generico",
    "category": "urban",
    "subcategory": "timelapse",
    "location": "São Paulo - Paulista",
    "description": "4K timelapse of Paulista Avenue at night. Wide shot, no audio.",
    "tags": ["urban", "timelapse", "night", "4K", "city"],
    "codec": "h264",
    "fps": 24,
    "resolution": "4K",
    "width": 3840,
    "height": 2160,
    "duration_seconds": 30.0,
    "bitrate_kbps": 40000,
    "has_audio": false,
    "color_profile": "Rec. 709",
    "storage_url": "https://cdn.example.com/broll/urban-timelapse-4k.mp4",
    "thumbnail_url": "https://cdn.example.com/broll/thumbs/urban-timelapse-4k.jpg",
    "proxy_url": "https://cdn.example.com/broll/proxy/urban-timelapse-4k-720p.mp4",
    "reusable": true,
    "status": "available",
    "metadata": {
      "edit_notes": "Good cut point at 0:15. Use slow-motion ramp at end.",
      "pairs_well_with": ["artgrid-88124", "artgrid-88125"]
    }
  }'
```

Returns 201 with the full asset object. Returns 409 on duplicate `asset_id` or `sha256`.

### GET /api/pipeline/broll-library/:id — Asset detail with usage history

Returns full asset data plus a `usage` array showing which pipeline items used this asset.

```bash
curl $BASE_URL/api/pipeline/broll-library/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

**Response:**

```json
{
  "data": {
    "id": "uuid",
    "asset_id": "artgrid-88123",
    "original_filename": "urban-timelapse-4k.mp4",
    "type": "footage",
    "category": "urban",
    "tags": ["urban", "timelapse", "night"],
    "resolution": "4K",
    "duration_seconds": 30.0,
    "status": "available",
    "version": 2,
    "...",
    "usage": [
      {
        "id": "uuid",
        "pipeline_item_id": "uuid",
        "beat_index": 3,
        "timecode_in": "00:00:05:00",
        "timecode_out": "00:00:20:00",
        "usage_type": "cutaway",
        "notes": "Used as cutaway during product demo section",
        "content_pipeline": { "code": "EP042", "title_pt": "Como criar um agente AI", "format": "youtube_video" }
      }
    ]
  }
}
```

**Usage types:** `cutaway`, `overlay`, `background`, `transition`, `intro`, `outro`.

### PATCH /api/pipeline/broll-library/:id — Update asset

Requires `version` field for optimistic concurrency control (from GET response). Returns 409 on version conflict.

```bash
curl -X PATCH $BASE_URL/api/pipeline/broll-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "tags": ["urban", "timelapse", "night", "paulista", "4K"],
    "description": "4K timelapse of Paulista Avenue at night. Wide establishing shot. No audio. Good entry for city sequences.",
    "reusable": true,
    "metadata": {
      "edit_notes": "Good cut point at 0:15. Use slow-motion ramp at end.",
      "pairs_well_with": ["artgrid-88124"]
    }
  }'
```

Updatable fields: all except `asset_id` and `type`. Always include `version`.

Returns 200 with the updated asset. Returns 409 if `version` does not match the current DB value. Returns 404 if the asset does not exist.

### DELETE /api/pipeline/broll-library/:id — Soft-delete (retire) asset

Sets `status` to `retired`. Asset remains in DB but is excluded from listings by default.

```bash
curl -X DELETE $BASE_URL/api/pipeline/broll-library/<uuid> \
  -H "X-Pipeline-Key: $KEY"
```

**Response:**

```json
{ "data": { "id": "uuid", "status": "retired" } }
```

### POST /api/pipeline/broll-library/import — Bulk import

Import up to 500 assets in a single request. Supports `dry_run` mode to preview changes without persisting anything. Upserts on `site_id + asset_id`.

```bash
curl -X POST $BASE_URL/api/pipeline/broll-library/import \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dry_run": false,
    "schema_version": "1.0.0",
    "items": [
      {
        "asset_id": "artgrid-88123",
        "original_filename": "urban-timelapse-4k.mp4",
        "type": "footage",
        "source": "artgrid",
        "source_type": "generico",
        "category": "urban",
        "tags": ["urban", "timelapse", "night"],
        "resolution": "4K",
        "width": 3840,
        "height": 2160,
        "fps": 24,
        "codec": "h264",
        "duration_seconds": 30.0,
        "has_audio": false,
        "status": "available"
      },
      {
        "asset_id": "local-cap-001",
        "original_filename": "desk-setup-closeup.mp4",
        "type": "footage",
        "source": "local",
        "source_type": "pessoal",
        "category": "technology",
        "tags": ["desk", "closeup", "setup", "keyboard"],
        "resolution": "1080p",
        "fps": 60,
        "duration_seconds": 12.5,
        "has_audio": true,
        "status": "available",
        "captured_at": "2026-05-10T14:30:00Z"
      }
    ]
  }'
```

**Response (dry_run: true):**

```json
{ "data": { "dry_run": true, "preview": { "to_create": 1, "to_update": 1, "to_skip": 0, "errors": [] } } }
```

**Response (dry_run: false):**

```json
{ "data": { "dry_run": false, "import_log_id": "uuid", "created": 1, "updated": 1, "skipped": 0, "errors": [] } }
```

Max 500 items per request. Each item is processed independently — partial failures do not block others. Classification:
- `create` — `asset_id` not found in DB
- `update` — `asset_id` exists and at least one field changed
- `skip` — `asset_id` exists, `sha256` matches, and no fields changed

### Metadata fields (JSONB `metadata` column)

The `metadata` column stores structured data for enriching the CMS UI and editor workflow. Fields are nested inside the `metadata` object.

| Field path | Type | Description | Example |
|-----------|------|-------------|---------|
| `edit_notes` | `string` | Free-text editing guidance (shown in detail panel) | `"Good cut point at 0:15. Ramp to slow-mo at end."` |
| `pairs_well_with` | `string[]` | `asset_id`s of complementary clips (shown in "Compatibility" section) | `["artgrid-88124", "local-cap-001"]` |
| `avoid_with` | `string[]` | `asset_id`s that clash visually or tonally | `["artgrid-99001"]` |
| `color_grade_preset` | `string` | LUT or color grade preset name | `"Cinematic Teal-Orange"` |
| `scene_mapping` | `object` | Suggested beat positions for this clip | `{ "intro": "0:00-0:10", "transition": "0:10-0:15" }` |
| `transcript` | `string` | Audio transcript (for screen recordings with voiceover) | `"In this section we'll look at..."` |
| `storyboard_notes` | `string` | Notes from the storyboard/shot list | `"Wide establishing shot before zoom-in"` |

**Example PATCH to add metadata to an existing asset:**

```bash
curl -X PATCH $BASE_URL/api/pipeline/broll-library/<uuid> \
  -H "X-Pipeline-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "metadata": {
      "edit_notes": "Strong establishing shot. Ramp to slow-mo in the last 5s.",
      "pairs_well_with": ["artgrid-88124"],
      "color_grade_preset": "Cinematic Teal-Orange",
      "scene_mapping": { "intro": "0:00-0:10", "highlight": "0:10-0:25" }
    }
  }'
```
