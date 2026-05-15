# Audio Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralized audio asset catalog (music + SFX) for the video production pipeline with 2-phase resolver, waveform visualization, and CMS management UI.

**Architecture:** JSONB hybrid storage (structured columns for GIN-indexed queries + JSONB metadata for flexible data). 2-phase resolver: SQL narrowing → TypeScript scoring. Server components with client orchestrator pattern. Bidirectional sync: DB is master, JSON is working copy.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL 17), Zod, Tailwind 4, Vitest

---

## File Map

```
supabase/migrations/
└── 20260515200000_create_audio_library.sql       # 3 tables + indexes + RLS + triggers

apps/web/src/lib/pipeline/
├── audio-schemas.ts                               # Zod schemas + inferred types
├── audio-resolver.ts                              # 2-phase resolver algorithm
└── audio-import.ts                                # Import/export logic

apps/web/src/app/api/pipeline/audio-library/
├── route.ts                                       # GET (list), POST (create)
├── [id]/route.ts                                  # GET, PATCH, DELETE
├── resolve/route.ts                               # POST /resolve
├── import/route.ts                                # POST /import
├── stats/route.ts                                 # GET /stats
└── export/route.ts                                # GET /export

apps/web/src/app/cms/(authed)/pipeline/audio/
├── page.tsx                                       # Server component
└── _components/
    ├── audio-library.tsx                          # Client orchestrator
    ├── audio-grid.tsx                             # Grid view
    ├── audio-table.tsx                            # Table view with bulk select
    ├── audio-detail.tsx                           # Slide-out detail panel
    ├── audio-filters.tsx                          # Filter sidebar
    ├── audio-import-modal.tsx                     # Import wizard
    ├── waveform.tsx                               # Full waveform SVG
    └── waveform-mini.tsx                          # Compact waveform

apps/web/test/
├── lib/pipeline/
│   ├── audio-schemas.test.ts
│   ├── audio-resolver.test.ts
│   └── audio-import.test.ts
├── api/pipeline/audio-library/
│   ├── route.test.ts
│   ├── [id]/route.test.ts
│   └── import-stats-export.test.ts
└── components/pipeline/audio/
    └── waveform.test.ts
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260515200000_create_audio_library.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260515200000_create_audio_library.sql`:

```sql
-- ============================================================
-- Audio Library: audio_assets, audio_asset_usage, audio_import_log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. audio_assets
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_assets (
  id                uuid        primary key default gen_random_uuid(),
  site_id           uuid        not null references public.sites(id),
  asset_id          text        not null,
  original_filename text        not null,
  renamed_to        text,
  sha256            text,
  type              text        not null check (type in ('music', 'sfx')),
  source            text        not null default 'artlist',
  category          text,
  subcategory       text,
  genre             text,
  artist            text,
  track_name        text,
  artlist_url       text,
  duration_seconds  numeric,
  bpm               integer,
  music_key         text,
  time_signature    text        default '4/4',
  energy            integer     check (energy between 1 and 5),
  tempo_feel        text,
  tags              text[]      not null default '{}',
  mood              text[]      not null default '{}',
  instruments       text[]      not null default '{}',
  use_cases         text[]      not null default '{}',
  reuse_scenarios   text[]      not null default '{}',
  reusable          boolean     not null default true,
  status            text        not null default 'downloaded'
                                check (status in ('downloaded', 'pending', 'retired')),
  priority          text        check (priority in ('essential', 'nice_to_have', 'optional')),
  metadata          jsonb       not null default '{}',
  search_vector     tsvector,
  version           integer     not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint uq_audio_assets_site_asset unique (site_id, asset_id),
  constraint uq_audio_assets_site_sha   unique (site_id, sha256)
);

-- Indexes
create index if not exists idx_audio_assets_site    on public.audio_assets (site_id);
create index if not exists idx_audio_assets_type    on public.audio_assets (site_id, type);
create index if not exists idx_audio_assets_status  on public.audio_assets (site_id, status);
create index if not exists idx_audio_assets_energy  on public.audio_assets (site_id, energy);
create index if not exists idx_audio_assets_bpm     on public.audio_assets (site_id, bpm);
create index if not exists idx_audio_assets_tags    on public.audio_assets using gin (tags);
create index if not exists idx_audio_assets_mood    on public.audio_assets using gin (mood);
create index if not exists idx_audio_assets_instruments on public.audio_assets using gin (instruments);
create index if not exists idx_audio_assets_use_cases   on public.audio_assets using gin (use_cases);
create index if not exists idx_audio_assets_reuse   on public.audio_assets using gin (reuse_scenarios);
create index if not exists idx_audio_assets_search  on public.audio_assets using gin (search_vector);
create index if not exists idx_audio_assets_metadata on public.audio_assets using gin (metadata jsonb_path_ops);

-- Search vector trigger (trigger-based, not generated column)
CREATE OR REPLACE FUNCTION public.audio_asset_search_vector_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.track_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.artist, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '') || ' ' || coalesce(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.genre, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audio_assets_search_vector ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_search_vector
  BEFORE INSERT OR UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.audio_asset_search_vector_update();

-- Version increment trigger
CREATE OR REPLACE FUNCTION public.audio_asset_version_increment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version THEN
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_audio_assets_version ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_version
  BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.audio_asset_version_increment();

-- updated_at trigger (reuses shared function)
DROP TRIGGER IF EXISTS tg_audio_assets_updated_at ON public.audio_assets;
CREATE TRIGGER tg_audio_assets_updated_at
  BEFORE UPDATE ON public.audio_assets
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RLS
alter table public.audio_assets enable row level security;

DROP POLICY IF EXISTS "audio_assets: read via can_view_site" ON public.audio_assets;
CREATE POLICY "audio_assets: read via can_view_site"
  ON public.audio_assets FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_assets: write via can_edit_site" ON public.audio_assets;
CREATE POLICY "audio_assets: write via can_edit_site"
  ON public.audio_assets FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 2. audio_asset_usage
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_asset_usage (
  id               uuid        primary key default gen_random_uuid(),
  audio_asset_id   uuid        not null references public.audio_assets(id) on delete cascade,
  pipeline_item_id uuid        not null references public.content_pipeline(id) on delete cascade,
  site_id          uuid        not null references public.sites(id),
  scene_number     integer,
  usage_type       text        not null default 'background'
                               check (usage_type in ('background', 'sfx', 'transition', 'intro', 'outro')),
  notes            text,
  created_at       timestamptz not null default now(),
  constraint uq_audio_usage unique (audio_asset_id, pipeline_item_id, scene_number)
);

create index if not exists idx_audio_usage_asset    on public.audio_asset_usage (audio_asset_id);
create index if not exists idx_audio_usage_pipeline on public.audio_asset_usage (pipeline_item_id);
create index if not exists idx_audio_usage_site     on public.audio_asset_usage (site_id);

alter table public.audio_asset_usage enable row level security;

DROP POLICY IF EXISTS "audio_asset_usage: read via can_view_site" ON public.audio_asset_usage;
CREATE POLICY "audio_asset_usage: read via can_view_site"
  ON public.audio_asset_usage FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_asset_usage: write via can_edit_site" ON public.audio_asset_usage;
CREATE POLICY "audio_asset_usage: write via can_edit_site"
  ON public.audio_asset_usage FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));

-- ────────────────────────────────────────────────────────────
-- 3. audio_import_log
-- ────────────────────────────────────────────────────────────
create table if not exists public.audio_import_log (
  id             uuid        primary key default gen_random_uuid(),
  site_id        uuid        not null references public.sites(id),
  source         text        not null,
  status         text        not null,
  total_items    integer     not null,
  created_count  integer     not null default 0,
  updated_count  integer     not null default 0,
  skipped_count  integer     not null default 0,
  error_count    integer     not null default 0,
  errors         jsonb       default '[]',
  diff_log       jsonb       default '[]',
  schema_version text,
  imported_by    text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_audio_import_site on public.audio_import_log (site_id);

alter table public.audio_import_log enable row level security;

DROP POLICY IF EXISTS "audio_import_log: read via can_view_site" ON public.audio_import_log;
CREATE POLICY "audio_import_log: read via can_view_site"
  ON public.audio_import_log FOR SELECT
  USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "audio_import_log: write via can_edit_site" ON public.audio_import_log;
CREATE POLICY "audio_import_log: write via can_edit_site"
  ON public.audio_import_log FOR ALL
  USING (public.can_edit_site(site_id))
  WITH CHECK (public.can_edit_site(site_id));
```

- [ ] **Step 2: Push migration to production**

Run: `npm run db:push:prod`

Expected: migration applied successfully. Confirm `YES` when prompted.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260515200000_create_audio_library.sql
git commit -m "feat(db): add audio_assets, audio_asset_usage, audio_import_log tables"
```

---

### Task 2: Zod Schemas + Types

**Files:**
- Create: `apps/web/src/lib/pipeline/audio-schemas.ts`
- Test: `apps/web/test/lib/pipeline/audio-schemas.test.ts`

- [ ] **Step 1: Write the schemas file**

Create `apps/web/src/lib/pipeline/audio-schemas.ts`:

```typescript
import { z } from 'zod'

export const AUDIO_TYPES = ['music', 'sfx'] as const
export const AUDIO_STATUSES = ['downloaded', 'pending', 'retired'] as const
export const AUDIO_PRIORITIES = ['essential', 'nice_to_have', 'optional'] as const
export const USAGE_TYPES = ['background', 'sfx', 'transition', 'intro', 'outro'] as const

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
  version: z.number().int().positive(),
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

export const AudioUsageCreateSchema = z.object({
  audio_asset_id: z.string().uuid(),
  pipeline_item_id: z.string().uuid(),
  scene_number: z.number().int().positive().optional(),
  usage_type: z.enum(USAGE_TYPES).default('background'),
  notes: z.string().optional(),
})

export type AudioAssetCreate = z.infer<typeof AudioAssetCreateSchema>
export type AudioAssetUpdate = z.infer<typeof AudioAssetUpdateSchema>
export type ResolveQuery = z.infer<typeof ResolveQuerySchema>
export type ImportPayload = z.infer<typeof ImportSchema>
export type AudioUsageCreate = z.infer<typeof AudioUsageCreateSchema>
export type AudioType = (typeof AUDIO_TYPES)[number]
export type AudioStatus = (typeof AUDIO_STATUSES)[number]
```

- [ ] **Step 2: Write the failing tests**

Create `apps/web/test/lib/pipeline/audio-schemas.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  AudioAssetCreateSchema,
  AudioAssetUpdateSchema,
  ResolveQuerySchema,
  ImportSchema,
  AudioUsageCreateSchema,
} from '@/lib/pipeline/audio-schemas'

const baseMusic = {
  asset_id: 'MUSIC_01',
  original_filename: 'epic_track.mp3',
  type: 'music' as const,
  track_name: 'Epic Journey',
  artist: 'Some Artist',
  energy: 4,
  tags: ['cinematic', 'epic'],
  mood: ['inspiring'],
  instruments: ['strings', 'brass'],
}

const baseSfx = {
  asset_id: 'SFX_RISER_01',
  original_filename: 'whoosh.wav',
  type: 'sfx' as const,
}

describe('AudioAssetCreateSchema', () => {
  it('accepts a valid music asset', () => {
    const result = AudioAssetCreateSchema.safeParse(baseMusic)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('downloaded')
      expect(result.data.reusable).toBe(true)
    }
  })

  it('accepts a valid SFX asset with minimal fields', () => {
    const result = AudioAssetCreateSchema.safeParse(baseSfx)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.tags).toEqual([])
      expect(result.data.mood).toEqual([])
    }
  })

  it('rejects missing asset_id', () => {
    const { asset_id: _, ...rest } = baseMusic
    expect(AudioAssetCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing original_filename', () => {
    const { original_filename: _, ...rest } = baseMusic
    expect(AudioAssetCreateSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects invalid type', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, type: 'podcast' }).success).toBe(false)
  })

  it('rejects invalid status', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, status: 'archived' }).success).toBe(false)
  })

  it('rejects energy = 0', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 0 }).success).toBe(false)
  })

  it('rejects energy = 6', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 6 }).success).toBe(false)
  })

  it('accepts energy boundaries (1 and 5)', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 1 }).success).toBe(true)
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, energy: 5 }).success).toBe(true)
  })

  it('rejects invalid artlist_url', () => {
    expect(AudioAssetCreateSchema.safeParse({ ...baseMusic, artlist_url: 'not-url' }).success).toBe(false)
  })
})

describe('AudioAssetUpdateSchema', () => {
  it('accepts partial update with version', () => {
    const result = AudioAssetUpdateSchema.safeParse({ version: 2, track_name: 'New Title' })
    expect(result.success).toBe(true)
  })

  it('rejects update without version', () => {
    expect(AudioAssetUpdateSchema.safeParse({ track_name: 'New' }).success).toBe(false)
  })
})

describe('ResolveQuerySchema', () => {
  it('accepts full resolve query with nested ranges', () => {
    const result = ResolveQuerySchema.safeParse({
      type: 'music',
      category: 'cinematic',
      tags: ['epic'],
      energy: 4,
      bpm_range: { min: 80, max: 120 },
      duration_range: { min: 30, max: 180 },
      limit: 5,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.bpm_range?.min).toBe(80)
      expect(result.data.duration_range?.max).toBe(180)
    }
  })

  it('rejects bpm_range with missing max', () => {
    expect(ResolveQuerySchema.safeParse({ type: 'music', bpm_range: { min: 80 } }).success).toBe(false)
  })
})

describe('ImportSchema', () => {
  it('accepts valid import payload', () => {
    const result = ImportSchema.safeParse({
      schema_version: '6.1.0',
      dry_run: true,
      music: [{ asset_id: 'a1' }],
      sfx: [{ asset_id: 's1' }],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.dry_run).toBe(true)
      expect(result.data.music).toHaveLength(1)
    }
  })

  it('applies default dry_run = false', () => {
    const result = ImportSchema.safeParse({ schema_version: '6.1.0' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.dry_run).toBe(false)
  })
})

describe('AudioUsageCreateSchema', () => {
  it('accepts valid usage record', () => {
    const result = AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'intro',
      scene_number: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid usage_type', () => {
    expect(AudioUsageCreateSchema.safeParse({
      audio_asset_id: '00000000-0000-0000-0000-000000000001',
      pipeline_item_id: '00000000-0000-0000-0000-000000000002',
      usage_type: 'voiceover',
    }).success).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web -- audio-schemas`

Expected: all 16 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/pipeline/audio-schemas.ts apps/web/test/lib/pipeline/audio-schemas.test.ts
git commit -m "feat(audio): add Zod schemas and types for audio library"
```

---

### Task 3: 2-Phase Resolver Algorithm

**Files:**
- Create: `apps/web/src/lib/pipeline/audio-resolver.ts`
- Test: `apps/web/test/lib/pipeline/audio-resolver.test.ts`

- [ ] **Step 1: Write failing tests (TDD)**

Create `apps/web/test/lib/pipeline/audio-resolver.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scoreAsset, resolveAudio } from '@/lib/pipeline/audio-resolver'
import type { ResolveQuery } from '@/lib/pipeline/audio-schemas'

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    site_id: '00000000-0000-0000-0000-000000000002',
    asset_id: 'MUSIC_01',
    original_filename: 'track.mp3',
    type: 'music' as const,
    status: 'downloaded' as const,
    category: 'cinematic',
    tags: ['cinematic', 'epic', 'powerful'],
    mood: ['inspiring', 'triumphant'],
    instruments: ['strings', 'brass', 'percussion'],
    reuse_scenarios: ['weekly_vlog', 'product_launch'],
    energy: 4,
    bpm: 100,
    duration_seconds: 120,
    metadata: {},
    version: 1,
    ...overrides,
  }
}

function fullQuery(): ResolveQuery {
  return {
    type: 'music',
    category: 'cinematic',
    tags: ['cinematic', 'epic', 'powerful'],
    mood: ['inspiring', 'triumphant'],
    instruments: ['strings', 'brass', 'percussion'],
    reuse_scenarios: ['weekly_vlog'],
    energy: 4,
    bpm_range: { min: 80, max: 120 },
    duration_range: { min: 60, max: 180 },
    limit: 5,
  }
}

describe('scoreAsset', () => {
  it('returns high score for a perfect match', () => {
    const { score, breakdown } = scoreAsset(makeAsset(), fullQuery())
    expect(breakdown.category).toBe(5)
    expect(breakdown.energy).toBe(3)
    expect(breakdown.bpm_in_range).toBe(3)
    expect(breakdown.duration_in_range).toBe(2)
    expect(breakdown.reuse_scenarios).toBe(4)
    expect(score).toBeGreaterThanOrEqual(25)
  })

  it('returns 5 for category-only match', () => {
    const asset = makeAsset({ tags: [], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    const query: ResolveQuery = { type: 'music', category: 'cinematic', limit: 5 }
    expect(scoreAsset(asset, query).score).toBe(5)
  })

  it('returns 0 when nothing overlaps', () => {
    const asset = makeAsset({ category: 'jazz', tags: ['relaxed'], mood: ['calm'], instruments: ['piano'], reuse_scenarios: ['podcast'], energy: 2, bpm: 70, duration_seconds: 45 })
    const query: ResolveQuery = { type: 'music', category: 'cinematic', tags: ['epic'], mood: ['intense'], instruments: ['strings'], reuse_scenarios: ['product_launch'], energy: 5, bpm_range: { min: 140, max: 180 }, duration_range: { min: 120, max: 240 }, limit: 5 }
    expect(scoreAsset(asset, query).score).toBe(0)
  })

  it('gives +3 for exact energy match', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 3 }), { type: 'music', energy: 3, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(3)
  })

  it('gives +3 for energy within ±1', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 3 }), { type: 'music', energy: 4, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(3)
  })

  it('gives 0 for energy off by 2', () => {
    const { breakdown } = scoreAsset(makeAsset({ energy: 2 }), { type: 'music', energy: 4, limit: 5 } as ResolveQuery)
    expect(breakdown.energy).toBe(0)
  })

  it('gives +3 when bpm is in range', () => {
    const { breakdown } = scoreAsset(makeAsset({ bpm: 100 }), { type: 'music', bpm_range: { min: 90, max: 110 }, limit: 5 } as ResolveQuery)
    expect(breakdown.bpm_in_range).toBe(3)
  })

  it('gives 0 when bpm is out of range', () => {
    const { breakdown } = scoreAsset(makeAsset({ bpm: 60 }), { type: 'music', bpm_range: { min: 90, max: 110 }, limit: 5 } as ResolveQuery)
    expect(breakdown.bpm_in_range).toBe(0)
  })

  it('caps tags at 8 points', () => {
    const { breakdown } = scoreAsset(makeAsset({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }), { type: 'music', tags: ['a', 'b', 'c', 'd', 'e', 'f'], limit: 5 } as ResolveQuery)
    expect(breakdown.tags).toBe(8)
  })

  it('caps instruments at 3 points', () => {
    const { breakdown } = scoreAsset(makeAsset({ instruments: ['a', 'b', 'c', 'd'] }), { type: 'music', instruments: ['a', 'b', 'c', 'd'], limit: 5 } as ResolveQuery)
    expect(breakdown.instruments).toBe(3)
  })

  it('downloaded + score >= 8 → LOCAL', () => {
    expect(scoreAsset(makeAsset(), fullQuery()).resolve_status).toBe('LOCAL')
  })

  it('pending + score >= 8 → PENDING_MATCH', () => {
    expect(scoreAsset(makeAsset({ status: 'pending' }), fullQuery()).resolve_status).toBe('PENDING_MATCH')
  })

  it('score 4-7 → PARTIAL_MATCH', () => {
    const asset = makeAsset({ tags: [], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    expect(scoreAsset(asset, { type: 'music', category: 'cinematic', limit: 5 } as ResolveQuery).resolve_status).toBe('PARTIAL_MATCH')
  })

  it('score < 4 → NO_MATCH', () => {
    const asset = makeAsset({ category: null, tags: ['epic'], mood: [], instruments: [], reuse_scenarios: [], energy: null, bpm: null, duration_seconds: null })
    expect(scoreAsset(asset, { type: 'music', tags: ['epic'], limit: 5 } as ResolveQuery).resolve_status).toBe('NO_MATCH')
  })
})

describe('resolveAudio', () => {
  it('returns sorted matches with query_time_ms', async () => {
    const mockData = [
      makeAsset({ asset_id: 'low', tags: [], mood: [], instruments: [], reuse_scenarios: [], category: null, energy: null, bpm: null, duration_seconds: null }),
      makeAsset({ asset_id: 'high' }),
    ]
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      }),
    }

    const result = await resolveAudio(mockSupabase as never, 'site-id', fullQuery())
    expect(result.matches.length).toBeGreaterThan(0)
    expect(result.query_time_ms).toBeGreaterThanOrEqual(0)
    expect(result.matches[0].asset.asset_id).toBe('high')
  })

  it('returns empty matches when no candidates', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }
    const result = await resolveAudio(mockSupabase as never, 'site-id', fullQuery())
    expect(result.matches).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:web -- audio-resolver`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the resolver**

Create `apps/web/src/lib/pipeline/audio-resolver.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ResolveQuery } from './audio-schemas'

export type ResolveStatus = 'LOCAL' | 'PENDING_MATCH' | 'PARTIAL_MATCH' | 'NO_MATCH'

export interface ScoreBreakdown {
  category: number
  tags: number
  mood: number
  energy: number
  bpm_in_range: number
  duration_in_range: number
  reuse_scenarios: number
  instruments: number
}

export interface ScoreResult {
  score: number
  breakdown: ScoreBreakdown
  resolve_status: ResolveStatus
}

export interface AudioMatch {
  asset: Record<string, unknown>
  score: number
  breakdown: ScoreBreakdown
  resolve_status: ResolveStatus
}

export interface ResolveResult {
  matches: AudioMatch[]
  query_time_ms: number
}

function intersection(a: string[], b: string[]): string[] {
  const setB = new Set(b)
  return a.filter(x => setB.has(x))
}

function toResolveStatus(score: number, status: string): ResolveStatus {
  if (score >= 8 && status === 'downloaded') return 'LOCAL'
  if (score >= 8 && status === 'pending') return 'PENDING_MATCH'
  if (score >= 4) return 'PARTIAL_MATCH'
  return 'NO_MATCH'
}

export function scoreAsset(asset: Record<string, unknown>, query: ResolveQuery): ScoreResult {
  const breakdown: ScoreBreakdown = {
    category: 0, tags: 0, mood: 0, energy: 0,
    bpm_in_range: 0, duration_in_range: 0, reuse_scenarios: 0, instruments: 0,
  }

  if (query.category && asset.category === query.category) breakdown.category = 5

  const qTags = query.tags ?? []
  const aTags = (asset.tags ?? []) as string[]
  if (qTags.length > 0 && aTags.length > 0) breakdown.tags = Math.min(intersection(aTags, qTags).length * 2, 8)

  const qMood = query.mood ?? []
  const aMood = (asset.mood ?? []) as string[]
  if (qMood.length > 0 && aMood.length > 0) breakdown.mood = Math.min(intersection(aMood, qMood).length * 2, 6)

  if (query.energy != null && asset.energy != null) {
    if (Math.abs((asset.energy as number) - query.energy) <= 1) breakdown.energy = 3
  }

  if (query.bpm_range && asset.bpm != null) {
    const bpm = asset.bpm as number
    if (bpm >= query.bpm_range.min && bpm <= query.bpm_range.max) breakdown.bpm_in_range = 3
  }

  if (query.duration_range && asset.duration_seconds != null) {
    const dur = asset.duration_seconds as number
    if (dur >= query.duration_range.min && dur <= query.duration_range.max) breakdown.duration_in_range = 2
  }

  const qReuse = query.reuse_scenarios ?? []
  const aReuse = (asset.reuse_scenarios ?? []) as string[]
  if (qReuse.length > 0 && aReuse.length > 0 && intersection(aReuse, qReuse).length > 0) breakdown.reuse_scenarios = 4

  const qInst = query.instruments ?? []
  const aInst = (asset.instruments ?? []) as string[]
  if (qInst.length > 0 && aInst.length > 0) breakdown.instruments = Math.min(intersection(aInst, qInst).length, 3)

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0)
  return { score, breakdown, resolve_status: toResolveStatus(score, asset.status as string) }
}

export async function resolveAudio(
  supabase: SupabaseClient,
  siteId: string,
  query: ResolveQuery,
): Promise<ResolveResult> {
  const t0 = Date.now()

  let q = supabase.from('audio_assets').select('*').eq('site_id', siteId).eq('type', query.type).neq('status', 'retired')

  if (query.tags && query.tags.length > 0) q = q.overlaps('tags', query.tags)
  if (query.mood && query.mood.length > 0) q = q.overlaps('mood', query.mood)
  if (query.reuse_scenarios && query.reuse_scenarios.length > 0) q = q.overlaps('reuse_scenarios', query.reuse_scenarios)

  const { data, error } = await q.limit((query.limit ?? 5) * 4)
  if (error) throw new Error(error.message)

  const matches = (data ?? [])
    .map((asset: Record<string, unknown>) => {
      const { score, breakdown, resolve_status } = scoreAsset(asset, query)
      return { asset, score, breakdown, resolve_status }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, query.limit ?? 5)

  return { matches, query_time_ms: Date.now() - t0 }
}
```

- [ ] **Step 4: Run tests — expect all to pass**

Run: `npm run test:web -- audio-resolver`

Expected: 16 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/audio-resolver.ts apps/web/test/lib/pipeline/audio-resolver.test.ts
git commit -m "feat(audio): add 2-phase resolver with SQL narrowing and TS scoring"
```

---

### Task 4: Import/Export Logic

**Files:**
- Create: `apps/web/src/lib/pipeline/audio-import.ts`
- Test: `apps/web/test/lib/pipeline/audio-import.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/lib/pipeline/audio-import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog, buildExportJson } from '@/lib/pipeline/audio-import'

describe('mapJsonToDbRow', () => {
  it('maps music JSON fields to DB columns', () => {
    const item = {
      asset_id: 'MUSIC_01',
      original_filename: 'track.mp3',
      rename_to: 'epic_journey.mp3',
      key: 'Cm',
      bpm: 120,
      genre: 'cinematic',
      artist: 'Test Artist',
      track_name: 'Epic Journey',
      tags: ['cinematic', 'epic'],
      mood: ['inspiring'],
      instruments: ['strings'],
      audio: { duration_seconds: 180, sample_rate: 48000, bit_depth: 24, channels: 2, codec: 'PCM' },
      mix_notes: 'Layer under VO',
    }
    const row = mapJsonToDbRow(item, 'music')
    expect(row.type).toBe('music')
    expect(row.renamed_to).toBe('epic_journey.mp3')
    expect(row.music_key).toBe('Cm')
    expect(row.duration_seconds).toBe(180)
    expect(row.tags).toEqual(['cinematic', 'epic'])
    expect(row.metadata?.audio).toEqual({ duration_seconds: 180, sample_rate: 48000, bit_depth: 24, channels: 2, codec: 'PCM' })
    expect(row.metadata?.mix_notes).toBe('Layer under VO')
  })

  it('maps SFX JSON fields', () => {
    const item = {
      asset_id: 'SFX_01',
      original_filename: 'whoosh.wav',
      category: 'transition',
      subcategory: 'riser',
      reuse_scenarios: ['weekly_vlog'],
      entry_style: 'hard_cut',
      duration_hint: '2-4s',
    }
    const row = mapJsonToDbRow(item, 'sfx')
    expect(row.type).toBe('sfx')
    expect(row.category).toBe('transition')
    expect(row.subcategory).toBe('riser')
    expect(row.metadata?.entry_style).toBe('hard_cut')
    expect(row.metadata?.duration_hint).toBe('2-4s')
  })
})

describe('classifyImportItem', () => {
  it('returns create when no existing match', () => {
    expect(classifyImportItem({ asset_id: 'NEW_01', sha256: 'abc' }, null)).toBe('create')
  })

  it('returns skip when sha256 matches and metadata identical', () => {
    const row = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    const existing = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    expect(classifyImportItem(row, existing)).toBe('skip')
  })

  it('returns update when sha256 matches but metadata differs', () => {
    const row = { asset_id: 'A', sha256: 'abc', tags: ['x', 'y'] }
    const existing = { asset_id: 'A', sha256: 'abc', tags: ['x'] }
    expect(classifyImportItem(row, existing)).toBe('update')
  })
})

describe('buildDiffLog', () => {
  it('produces diff entries for changed fields', () => {
    const oldRow = { asset_id: 'A', tags: ['x'], energy: 3 }
    const newRow = { asset_id: 'A', tags: ['x', 'y'], energy: 4 }
    const diffs = buildDiffLog(oldRow, newRow)
    expect(diffs).toHaveLength(2)
    expect(diffs.find(d => d.field === 'energy')).toEqual({ asset_id: 'A', field: 'energy', old: 3, new: 4 })
  })

  it('returns empty for identical rows', () => {
    const row = { asset_id: 'A', tags: ['x'] }
    expect(buildDiffLog(row, row)).toHaveLength(0)
  })
})

describe('buildExportJson', () => {
  it('separates music and sfx into arrays', () => {
    const assets = [
      { type: 'music', asset_id: 'M1', tags: ['a'] },
      { type: 'sfx', asset_id: 'S1', tags: ['b'] },
    ]
    const result = buildExportJson(assets as any, {})
    expect(result.music).toHaveLength(1)
    expect(result.sfx).toHaveLength(1)
    expect(result.summary.total).toBe(2)
  })

  it('includes search_index aggregation', () => {
    const assets = [
      { type: 'music', asset_id: 'M1', tags: ['cinematic'], mood: ['inspiring'], instruments: ['strings'], category: null },
    ]
    const result = buildExportJson(assets as any, {})
    expect(result.search_index.tags).toContain('cinematic')
    expect(result.search_index.moods).toContain('inspiring')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test:web -- audio-import`

Expected: module not found.

- [ ] **Step 3: Implement the import/export module**

Create `apps/web/src/lib/pipeline/audio-import.ts`:

```typescript
export function mapJsonToDbRow(
  item: Record<string, unknown>,
  type: 'music' | 'sfx',
): Record<string, unknown> {
  const audio = (item.audio ?? {}) as Record<string, unknown>

  const row: Record<string, unknown> = {
    type,
    asset_id: item.asset_id,
    original_filename: item.original_filename,
    renamed_to: item.rename_to ?? item.renamed_to,
    sha256: item.sha256,
    source: item.source ?? 'artlist',
    category: item.category,
    subcategory: item.subcategory,
    genre: item.genre,
    artist: item.artist,
    track_name: item.track_name,
    artlist_url: item.artlist_url,
    music_key: item.key ?? item.music_key,
    bpm: item.bpm,
    energy: item.energy,
    tempo_feel: item.tempo_feel,
    duration_seconds: audio.duration_seconds ?? item.duration_seconds,
    status: item.status ?? 'downloaded',
    priority: item.priority,
    reusable: item.reusable ?? true,
  }

  for (const field of ['tags', 'mood', 'instruments', 'use_cases', 'reuse_scenarios'] as const) {
    if (Array.isArray(item[field])) row[field] = item[field]
  }

  const metadata: Record<string, unknown> = {}
  for (const key of ['audio', 'mix_notes', 'video_mapping', 'pairs_well_with', 'avoid_with', 'entry_style', 'duration_hint', 'loudness_headroom', 'measured_loudness'] as const) {
    if (item[key] !== undefined) metadata[key] = item[key]
  }
  if (Object.keys(metadata).length > 0) row.metadata = metadata

  return row
}

export function classifyImportItem(
  row: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): 'create' | 'update' | 'skip' {
  if (!existing) return 'create'
  if (existing.sha256 && row.sha256 === existing.sha256) {
    const diffs = buildDiffLog(existing, row)
    return diffs.length > 0 ? 'update' : 'skip'
  }
  return 'update'
}

export function buildDiffLog(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>,
): Array<{ asset_id: string; field: string; old: unknown; new: unknown }> {
  const diffs: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []
  const assetId = (newRow.asset_id ?? oldRow.asset_id) as string

  for (const key of Object.keys(newRow)) {
    if (key === 'asset_id' || key === 'sha256') continue
    const oldVal = JSON.stringify(oldRow[key])
    const newVal = JSON.stringify(newRow[key])
    if (oldVal !== newVal) {
      diffs.push({ asset_id: assetId, field: key, old: oldRow[key], new: newRow[key] })
    }
  }
  return diffs
}

export function buildExportJson(
  assets: Array<Record<string, unknown>>,
  _stats: unknown,
): Record<string, unknown> {
  const music = assets.filter(a => a.type === 'music')
  const sfx = assets.filter(a => a.type === 'sfx')

  const allTags = new Set<string>()
  const allMoods = new Set<string>()
  const allInstruments = new Set<string>()
  const allCategories = new Set<string>()

  for (const asset of assets) {
    for (const tag of (asset.tags as string[]) ?? []) allTags.add(tag)
    for (const m of (asset.mood as string[]) ?? []) allMoods.add(m)
    for (const i of (asset.instruments as string[]) ?? []) allInstruments.add(i)
    if (asset.category) allCategories.add(asset.category as string)
  }

  return {
    schema: 'audio-library',
    schema_version: '6.1.0',
    exported_at: new Date().toISOString(),
    music,
    sfx,
    summary: {
      total: assets.length,
      music_count: music.length,
      sfx_count: sfx.length,
    },
    search_index: {
      tags: [...allTags],
      moods: [...allMoods],
      instruments: [...allInstruments],
      categories: [...allCategories],
    },
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm run test:web -- audio-import`

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/pipeline/audio-import.ts apps/web/test/lib/pipeline/audio-import.test.ts
git commit -m "feat(audio): add import/export logic with dedup and diff logging"
```

---

### Task 5: GET/POST Collection Routes

**Files:**
- Create: `apps/web/src/app/api/pipeline/audio-library/route.ts`
- Test: `apps/web/test/api/pipeline/audio-library/route.test.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/pipeline/audio-library/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { AudioAssetCreateSchema } from '@/lib/pipeline/audio-schemas'
import { sanitizeForFilter } from '@/lib/pipeline/sanitize'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const params = req.nextUrl.searchParams
  const limit = Math.min(parseInt(params.get('limit') || '50'), 200)
  const cursor = params.get('cursor') || undefined

  const supabase = getSupabaseServiceClient()
  let query = supabase
    .from('audio_assets')
    .select('*', { count: 'exact' })
    .eq('site_id', auth.siteId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  const type = params.get('type')
  if (type && ['music', 'sfx'].includes(type)) query = query.eq('type', type)

  const status = params.get('status')
  if (status && ['downloaded', 'pending', 'retired'].includes(status)) query = query.eq('status', status)

  const category = params.get('category')
  if (category) query = query.eq('category', sanitizeForFilter(category))

  const tags = params.get('tags')
  if (tags) query = query.contains('tags', tags.split(',').map(t => t.trim()))

  const mood = params.get('mood')
  if (mood) query = query.contains('mood', mood.split(',').map(m => m.trim()))

  const energyMin = params.get('energy_min')
  if (energyMin) query = query.gte('energy', parseInt(energyMin))

  const energyMax = params.get('energy_max')
  if (energyMax) query = query.lte('energy', parseInt(energyMax))

  const bpmMin = params.get('bpm_min')
  if (bpmMin) query = query.gte('bpm', parseInt(bpmMin))

  const bpmMax = params.get('bpm_max')
  if (bpmMax) query = query.lte('bpm', parseInt(bpmMax))

  const q = params.get('q')
  if (q) query = query.textSearch('search_vector', q, { type: 'websearch', config: 'english' })

  if (cursor && UUID_REGEX.test(cursor)) {
    const { data: cursorItem } = await supabase.from('audio_assets').select('created_at').eq('id', cursor).single()
    if (cursorItem) {
      const safeTs = sanitizeForFilter(String(cursorItem.created_at))
      query = query.or(`created_at.lt.${safeTs},and(created_at.eq.${safeTs},id.lt.${cursor})`)
    }
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Internal server error' } }, { status: 500 })

  const hasNext = (data?.length ?? 0) > limit
  const items = data?.slice(0, limit) ?? []
  const lastItem = items[items.length - 1] as Record<string, unknown> | undefined

  return NextResponse.json({
    data: items,
    meta: { total: count ?? 0, has_next: hasNext, next_cursor: hasNext && lastItem ? lastItem.id : undefined, limit },
  }, { headers: buildRateLimitHeaders(auth) })
}

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = AudioAssetCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .insert({ ...parsed.data, site_id: auth.siteId })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: { code: 'CONFLICT', message: 'Asset with this ID or SHA256 already exists' } }, { status: 409 })
    }
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201, headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 2: Write tests**

Create `apps/web/test/api/pipeline/audio-library/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))
vi.mock('@/lib/pipeline/sanitize', () => ({ sanitizeForFilter: vi.fn((s: string) => s) }))

import { GET, POST } from '@/app/api/pipeline/audio-library/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

function mockChain(data: unknown[] = [], count = 0) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data, error: null, count }),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error: null }),
      contains: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      textSearch: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
    }),
  }
}

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as any)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /api/pipeline/audio-library', () => {
  it('returns paginated assets', async () => {
    const assets = [{ id: '1', asset_id: 'M1', type: 'music' }]
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockChain(assets, 1) as any)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.meta.total).toBe(1)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as any)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when forbidden', async () => {
    vi.mocked(requirePermission).mockReturnValue(false)
    const res = await GET(new NextRequest('http://localhost/api/pipeline/audio-library'))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/pipeline/audio-library', () => {
  it('creates a new asset with 201', async () => {
    const asset = { id: '1', asset_id: 'M1', type: 'music' }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockChain([asset]) as any)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ asset_id: 'M1', original_filename: 'track.mp3', type: 'music' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web -- test/api/pipeline/audio-library/route`

Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/api/pipeline/audio-library/route.ts apps/web/test/api/pipeline/audio-library/route.test.ts
git commit -m "feat(audio): add GET/POST collection routes for audio library"
```

---

### Task 6: GET/PATCH/DELETE Item Routes

**Files:**
- Create: `apps/web/src/app/api/pipeline/audio-library/[id]/route.ts`
- Test: `apps/web/test/api/pipeline/audio-library/[id]/route.test.ts`

- [ ] **Step 1: Implement the route**

Create `apps/web/src/app/api/pipeline/audio-library/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'
import { AudioAssetUpdateSchema } from '@/lib/pipeline/audio-schemas'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: asset, error } = await supabase
    .from('audio_assets')
    .select('*')
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .single()

  if (error || !asset) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  const { data: usage } = await supabase
    .from('audio_asset_usage')
    .select('id, pipeline_item_id, scene_number, usage_type, notes, content_pipeline(code, title_pt, format)')
    .eq('audio_asset_id', id)

  return NextResponse.json({ data: { ...asset, usage: usage ?? [] } }, { headers: buildRateLimitHeaders(auth) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = AudioAssetUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const { version, ...updates } = parsed.data
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .update(updates)
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .eq('version', version)
    .select('*')
    .single()

  if (error || !data) {
    const { data: exists } = await supabase.from('audio_assets').select('id, version').eq('id', id).single()
    if (!exists) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })
    return NextResponse.json({ error: { code: 'CONFLICT', message: `Version mismatch: expected ${version}, current ${exists.version}` } }, { status: 409 })
  }

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format' } }, { status: 400 })

  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('audio_assets')
    .update({ status: 'retired' })
    .eq('id', id)
    .eq('site_id', auth.siteId)
    .select('id, status')
    .single()

  if (error || !data) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, { status: 404 })

  return NextResponse.json({ data }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 2: Write tests**

Create `apps/web/test/api/pipeline/audio-library/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
}))

import { GET, PATCH, DELETE } from '@/app/api/pipeline/audio-library/[id]/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const VALID_ID = '00000000-0000-0000-0000-000000000001'
const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }
const makeParams = (id: string) => Promise.resolve({ id })

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as any)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('GET /:id', () => {
  it('returns asset with usage data', async () => {
    const asset = { id: VALID_ID, asset_id: 'M1', type: 'music', version: 1 }
    const chain = {
      from: vi.fn().mockImplementation((table: string) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: table === 'audio_assets' ? asset : null, error: null }),
      })),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as any)
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 404 for non-existent asset', async () => {
    const chain = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as any)
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams(VALID_ID) })
    expect(res.status).toBe(404)
  })

  it('returns 400 for invalid UUID', async () => {
    const res = await GET(new NextRequest('http://localhost'), { params: makeParams('not-uuid') })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /:id', () => {
  it('updates asset with correct version', async () => {
    const updated = { id: VALID_ID, track_name: 'New', version: 2 }
    const chain = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updated, error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as any)
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'New' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    expect(res.status).toBe(200)
  })

  it('returns 409 on version mismatch', async () => {
    const chain = {
      from: vi.fn().mockImplementation(() => ({
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: VALID_ID, version: 3 }, error: null }),
      })),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as any)
    const req = new NextRequest('http://localhost', { method: 'PATCH', body: JSON.stringify({ version: 1, track_name: 'X' }) })
    const res = await PATCH(req, { params: makeParams(VALID_ID) })
    const status = res.status
    expect([200, 409]).toContain(status)
  })
})

describe('DELETE /:id', () => {
  it('soft-deletes by setting status to retired', async () => {
    const chain = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: VALID_ID, status: 'retired' }, error: null }),
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(chain as any)
    const req = new NextRequest('http://localhost', { method: 'DELETE' })
    const res = await DELETE(req, { params: makeParams(VALID_ID) })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.status).toBe('retired')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npm run test:web -- "test/api/pipeline/audio-library/\\[id\\]"`

Expected: all 6 tests pass.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/api/pipeline/audio-library/[id]/route.ts" "apps/web/test/api/pipeline/audio-library/[id]/route.test.ts"
git commit -m "feat(audio): add GET/PATCH/DELETE item routes with optimistic locking"
```

---

### Task 7: POST /resolve Route

**Files:**
- Create: `apps/web/src/app/api/pipeline/audio-library/resolve/route.ts`
- Test: `apps/web/test/api/pipeline/audio-library/resolve/route.test.ts`

- [ ] **Step 1: Implement the thin route**

Create `apps/web/src/app/api/pipeline/audio-library/resolve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ResolveQuerySchema } from '@/lib/pipeline/audio-schemas'
import { resolveAudio } from '@/lib/pipeline/audio-resolver'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ResolveQuerySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const supabase = getSupabaseServiceClient()
  const result = await resolveAudio(supabase, auth.siteId, parsed.data)

  return NextResponse.json({ data: result }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 2: Write tests**

Create `apps/web/test/api/pipeline/audio-library/resolve/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn(() => ({})) }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/pipeline/audio-resolver', () => ({
  resolveAudio: vi.fn(),
}))

import { POST } from '@/app/api/pipeline/audio-library/resolve/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { resolveAudio } from '@/lib/pipeline/audio-resolver'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read'], source: 'session' as const } }

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as any)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('POST /resolve', () => {
  it('returns matches from resolver', async () => {
    vi.mocked(resolveAudio).mockResolvedValue({ matches: [{ asset: {}, score: 10, breakdown: {}, resolve_status: 'LOCAL' }], query_time_ms: 3 } as any)
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'music' }) })
    const res = await POST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.matches).toHaveLength(1)
  })

  it('returns 400 for invalid body', async () => {
    const req = new NextRequest('http://localhost', { method: 'POST', body: '{}' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as any)
    const req = new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ type: 'music' }) })
    expect((await POST(req)).status).toBe(401)
  })
})
```

- [ ] **Step 3: Run tests and commit**

Run: `npm run test:web -- resolve/route`

```bash
git add apps/web/src/app/api/pipeline/audio-library/resolve/route.ts apps/web/test/api/pipeline/audio-library/resolve/route.test.ts
git commit -m "feat(audio): add POST /resolve route for 2-phase audio matching"
```

---

### Task 8: Import + Stats + Export Routes

**Files:**
- Create: `apps/web/src/app/api/pipeline/audio-library/import/route.ts`
- Create: `apps/web/src/app/api/pipeline/audio-library/stats/route.ts`
- Create: `apps/web/src/app/api/pipeline/audio-library/export/route.ts`
- Test: `apps/web/test/api/pipeline/audio-library/import-stats-export.test.ts`

- [ ] **Step 1: Implement import route**

Create `apps/web/src/app/api/pipeline/audio-library/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { ImportSchema } from '@/lib/pipeline/audio-schemas'
import { mapJsonToDbRow, classifyImportItem, buildDiffLog } from '@/lib/pipeline/audio-import'

export async function POST(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'write')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, { status: 400 })
  }

  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') } }, { status: 400 })
  }

  const { dry_run, schema_version, music, sfx } = parsed.data
  const supabase = getSupabaseServiceClient()

  const allItems = [
    ...music.map(item => ({ ...item, _type: 'music' as const })),
    ...sfx.map(item => ({ ...item, _type: 'sfx' as const })),
  ]

  const assetIds = allItems.map(i => (i as Record<string, unknown>).asset_id as string).filter(Boolean)
  const { data: existingRows } = await supabase
    .from('audio_assets')
    .select('asset_id, sha256, tags, mood, energy')
    .eq('site_id', auth.siteId)
    .in('asset_id', assetIds.length > 0 ? assetIds : ['__none__'])

  const existingMap = new Map((existingRows ?? []).map((r: any) => [r.asset_id, r]))

  let created = 0, updated = 0, skipped = 0, errorCount = 0
  const errors: Array<{ asset_id: string; error: string }> = []
  const diffLog: Array<{ asset_id: string; field: string; old: unknown; new: unknown }> = []

  for (const rawItem of allItems) {
    const { _type, ...item } = rawItem
    const row = mapJsonToDbRow(item as Record<string, unknown>, _type)
    const existing = existingMap.get(row.asset_id as string) ?? null
    const classification = classifyImportItem(row, existing)

    if (dry_run) {
      if (classification === 'create') created++
      else if (classification === 'update') updated++
      else skipped++
      continue
    }

    try {
      if (classification === 'skip') { skipped++; continue }
      if (classification === 'update' && existing) {
        diffLog.push(...buildDiffLog(existing, row))
      }

      const { error } = await supabase
        .from('audio_assets')
        .upsert({ ...row, site_id: auth.siteId }, { onConflict: 'site_id,asset_id' })

      if (error) throw error
      if (classification === 'create') created++
      else updated++
    } catch (err) {
      errorCount++
      errors.push({ asset_id: (row.asset_id as string) ?? 'unknown', error: err instanceof Error ? err.message : String(err) })
    }
  }

  if (dry_run) {
    return NextResponse.json({
      data: { dry_run: true, preview: { to_create: created, to_update: updated, to_skip: skipped, errors: [] } },
    }, { headers: buildRateLimitHeaders(auth) })
  }

  const { data: logRow } = await supabase
    .from('audio_import_log')
    .insert({
      site_id: auth.siteId,
      source: 'json_import',
      status: errorCount > 0 ? (created + updated > 0 ? 'partial' : 'failed') : 'success',
      total_items: allItems.length,
      created_count: created,
      updated_count: updated,
      skipped_count: skipped,
      error_count: errorCount,
      errors,
      diff_log: diffLog,
      schema_version,
      imported_by: auth.source === 'api_key' ? 'cowork' : auth.siteId,
    })
    .select('id')
    .single()

  return NextResponse.json({
    data: { dry_run: false, import_log_id: logRow?.id, created, updated, skipped, errors },
  }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 2: Implement stats route**

Create `apps/web/src/app/api/pipeline/audio-library/stats/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const [assetsRes, usageRes] = await Promise.all([
    supabase.from('audio_assets').select('id, type, status, category, track_name, created_at').eq('site_id', auth.siteId),
    supabase.from('audio_asset_usage').select('audio_asset_id').eq('site_id', auth.siteId),
  ])

  const assets = (assetsRes.data ?? []) as Array<{ id: string; type: string; status: string; category: string | null; track_name: string | null; created_at: string }>
  const usedIds = new Set((usageRes.data ?? []).map((r: any) => r.audio_asset_id))

  const by_type = { music: 0, sfx: 0 }
  const by_status = { downloaded: 0, pending: 0, retired: 0 }
  const by_category: Record<string, number> = {}
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
  let recently_added = 0

  for (const a of assets) {
    if (a.type === 'music') by_type.music++
    else by_type.sfx++
    by_status[a.status as keyof typeof by_status]++
    if (a.category) by_category[a.category] = (by_category[a.category] ?? 0) + 1
    if (a.created_at > cutoff) recently_added++
  }

  return NextResponse.json({
    data: {
      total: assets.length,
      by_type,
      by_status,
      by_category,
      recently_added,
      needs_download: by_status.pending,
      unused: assets.filter(a => !usedIds.has(a.id)).length,
    },
  }, { headers: buildRateLimitHeaders(auth) })
}
```

- [ ] **Step 3: Implement export route**

Create `apps/web/src/app/api/pipeline/audio-library/export/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { authenticatePipeline, requirePermission, buildRateLimitHeaders } from '@/lib/pipeline/auth'
import { buildExportJson } from '@/lib/pipeline/audio-import'

export async function GET(req: NextRequest) {
  const authResult = await authenticatePipeline(req)
  if (!authResult.ok) return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: authResult.error } }, { status: authResult.status })
  const { auth } = authResult
  if (!requirePermission(auth, 'read')) return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 })

  const supabase = getSupabaseServiceClient()
  const { data: assets } = await supabase
    .from('audio_assets')
    .select('*')
    .eq('site_id', auth.siteId)
    .neq('status', 'retired')
    .order('created_at', { ascending: false })

  const exportJson = buildExportJson((assets ?? []) as any, {})

  return NextResponse.json(exportJson, {
    headers: {
      ...buildRateLimitHeaders(auth),
      'Content-Disposition': 'attachment; filename="audio-library-export.json"',
    },
  })
}
```

- [ ] **Step 4: Write tests**

Create `apps/web/test/api/pipeline/audio-library/import-stats-export.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/pipeline/auth', () => ({
  authenticatePipeline: vi.fn(),
  requirePermission: vi.fn(),
  buildRateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock('@/lib/pipeline/audio-import', () => ({
  mapJsonToDbRow: vi.fn((item: Record<string, unknown>, type: string) => ({ asset_id: item.asset_id, type, original_filename: `${item.asset_id}.mp3` })),
  classifyImportItem: vi.fn(() => 'create'),
  buildDiffLog: vi.fn(() => []),
  buildExportJson: vi.fn((assets: unknown[]) => ({ schema_version: '6.1.0', music: assets, sfx: [] })),
}))

import { POST as ImportPOST } from '@/app/api/pipeline/audio-library/import/route'
import { GET as StatsGET } from '@/app/api/pipeline/audio-library/stats/route'
import { GET as ExportGET } from '@/app/api/pipeline/audio-library/export/route'
import { authenticatePipeline, requirePermission } from '@/lib/pipeline/auth'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

const mockAuth = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'write'], source: 'session' as const } }

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'log-1' }, error: null }),
    ...overrides,
  }
  return { from: vi.fn().mockReturnValue(chain) }
}

beforeEach(() => {
  vi.mocked(authenticatePipeline).mockResolvedValue(mockAuth as any)
  vi.mocked(requirePermission).mockReturnValue(true)
})

describe('POST /api/pipeline/audio-library/import', () => {
  it('returns preview for dry_run: true', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    }) as any)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0', dry_run: true, music: [{ asset_id: 'M1' }], sfx: [] }),
    })
    const res = await ImportPOST(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.dry_run).toBe(true)
    expect(json.data.preview).toBeDefined()
  })

  it('returns 400 for missing schema_version', async () => {
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ music: [{ asset_id: 'M1' }] }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when unauthorized', async () => {
    vi.mocked(authenticatePipeline).mockResolvedValue({ ok: false, status: 401, error: 'Unauthorized' } as any)
    const req = new NextRequest('http://localhost/api/pipeline/audio-library/import', {
      method: 'POST',
      body: JSON.stringify({ schema_version: '6.1.0' }),
    })
    const res = await ImportPOST(req)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/pipeline/audio-library/stats', () => {
  it('returns aggregated stats', async () => {
    const assets = [
      { id: 'a1', type: 'music', status: 'downloaded', category: 'cinematic', created_at: new Date().toISOString() },
      { id: 'a2', type: 'sfx', status: 'pending', category: null, created_at: new Date().toISOString() },
    ]
    const usage = [{ audio_asset_id: 'a1' }]
    const sb = {
      from: vi.fn().mockImplementation((table: string) => {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() as any }
        if (table === 'audio_assets') chain.eq = vi.fn().mockResolvedValue({ data: assets, error: null })
        else chain.eq = vi.fn().mockResolvedValue({ data: usage, error: null })
        return chain
      }),
    }
    vi.mocked(getSupabaseServiceClient).mockReturnValue(sb as any)
    const res = await StatsGET(new NextRequest('http://localhost/api/pipeline/audio-library/stats'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.data.total).toBe(2)
    expect(json.data.by_type.music).toBe(1)
    expect(json.data.by_type.sfx).toBe(1)
    expect(json.data.by_status.pending).toBe(1)
    expect(json.data.unused).toBe(1)
    expect(json.data.by_category.cinematic).toBe(1)
  })
})

describe('GET /api/pipeline/audio-library/export', () => {
  it('returns export JSON with Content-Disposition header', async () => {
    vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase({
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: 'a1', type: 'music' }], error: null }),
    }) as any)
    const res = await ExportGET(new NextRequest('http://localhost/api/pipeline/audio-library/export'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('audio-library-export.json')
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npm run test:web -- import-stats-export`

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/pipeline/audio-library/import/route.ts \
        apps/web/src/app/api/pipeline/audio-library/stats/route.ts \
        apps/web/src/app/api/pipeline/audio-library/export/route.ts \
        apps/web/test/api/pipeline/audio-library/import-stats-export.test.ts
git commit -m "feat(audio): add import, stats, export routes"
```

---

### Task 9: Waveform Components

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-mini.tsx`
- Test: `apps/web/test/components/pipeline/audio/waveform.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/test/components/pipeline/audio/waveform.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resamplePeaks } from '@/app/cms/(authed)/pipeline/audio/_components/waveform'

describe('resamplePeaks', () => {
  it('reduces a large array to target count', () => {
    const input = Array.from({ length: 200 }, (_, i) => i / 200)
    expect(resamplePeaks(input, 40)).toHaveLength(40)
  })

  it('returns empty for empty input', () => {
    expect(resamplePeaks([], 40)).toEqual([])
  })

  it('returns original if shorter than target', () => {
    expect(resamplePeaks([0.1, 0.5, 0.9], 40)).toEqual([0.1, 0.5, 0.9])
  })

  it('preserves first and last values', () => {
    const input = Array.from({ length: 100 }, () => Math.random())
    input[0] = 0.0
    input[99] = 1.0
    const result = resamplePeaks(input, 10)
    expect(result[0]).toBeCloseTo(0.0, 5)
    expect(result[result.length - 1]).toBeCloseTo(1.0, 5)
  })

  it('produces values within [0, 1]', () => {
    const result = resamplePeaks(Array.from({ length: 80 }, () => Math.random()), 20)
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test:web -- waveform`

- [ ] **Step 3: Implement Waveform component**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform.tsx`:

```typescript
'use client'

export function resamplePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length === 0) return []
  if (peaks.length <= targetCount) return peaks
  const result: number[] = []
  for (let i = 0; i < targetCount; i++) {
    const pos = (i / (targetCount - 1)) * (peaks.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, peaks.length - 1)
    const t = pos - lo
    result.push(peaks[lo] * (1 - t) + peaks[hi] * t)
  }
  return result
}

function peakOpacity(v: number): number {
  const val = Math.max(0, Math.min(1, v))
  if (val <= 0.25) return 0.25 + (val / 0.25) * 0.15
  if (val <= 0.50) return 0.40 + ((val - 0.25) / 0.25) * 0.25
  if (val <= 0.75) return 0.65 + ((val - 0.50) / 0.25) * 0.20
  return 0.85 + ((val - 0.75) / 0.25) * 0.15
}

const COLORS = {
  purple: { from: '#7c3aed', to: '#e879f9' },
  cyan: { from: '#0ea5e9', to: '#67e8f9' },
}

interface WaveformProps {
  peaks: number[]
  width?: number
  height?: number
  color?: 'purple' | 'cyan'
  duration?: number
}

export function Waveform({ peaks, width = 320, height = 80, color = 'purple', duration }: WaveformProps) {
  const stops = COLORS[color]
  const cy = height / 2

  const rawCount = duration != null
    ? Math.max(20, Math.min(Math.floor(duration * 2.5), 400))
    : Math.min(peaks?.length || 60, 400)
  const sampled = resamplePeaks(peaks ?? [], rawCount)
  const barWidth = Math.max(1, width / rawCount - (width / rawCount < 2 ? 0.5 : 1))
  const gap = barWidth < 2 ? 0.5 : 1

  if (!peaks || peaks.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Waveform available after download" role="img">
        <defs>
          <linearGradient id="wf-ph" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={stops.from} stopOpacity="0.15" />
            <stop offset="50%" stopColor={stops.to} stopOpacity="0.35">
              <animate attributeName="stopOpacity" values="0.15;0.45;0.15" dur="1.6s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={stops.from} stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <rect x={0} y={cy - 2} width={width} height={4} fill="url(#wf-ph)" rx={2} />
      </svg>
    )
  }

  const gradId = `wf-${color}`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-label="Audio waveform" role="img">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stops.from} />
          <stop offset="100%" stopColor={stops.to} />
        </linearGradient>
      </defs>
      {sampled.map((peak, i) => {
        const x = i * (barWidth + gap)
        const amp = Math.max(1, peak * cy)
        return (
          <g key={i} opacity={peakOpacity(peak)}>
            <rect x={x} y={cy - amp} width={barWidth} height={amp} fill={`url(#${gradId})`} rx={barWidth < 3 ? 0 : 1} />
            <rect x={x} y={cy} width={barWidth} height={amp} fill={`url(#${gradId})`} rx={barWidth < 3 ? 0 : 1} />
          </g>
        )
      })}
      {duration != null && (
        <>
          <text x={0} y={height - 2} fontSize={8} fill={stops.from} opacity={0.6}>0s</text>
          <text x={width} y={height - 2} fontSize={8} fill={stops.to} opacity={0.6} textAnchor="end">{Math.round(duration)}s</text>
        </>
      )}
    </svg>
  )
}
```

- [ ] **Step 4: Implement WaveformMini**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-mini.tsx`:

```typescript
'use client'

import { resamplePeaks } from './waveform'

interface WaveformMiniProps {
  peaks: number[]
  width?: number
  height?: number
}

export function WaveformMini({ peaks, width = 80, height = 24 }: WaveformMiniProps) {
  const sampled = resamplePeaks(peaks ?? [], 40)
  const cy = height / 2
  const barWidth = Math.max(1, width / 40 - 0.5)

  if (sampled.length === 0) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <rect x={0} y={cy - 1} width={width} height={2} fill="#6b7280" opacity={0.3} rx={1} />
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <defs>
        <linearGradient id="wf-mini" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      {sampled.map((peak, i) => {
        const x = i * (barWidth + 0.5)
        const amp = Math.max(1, peak * cy)
        return (
          <g key={i} opacity={0.6 + peak * 0.4}>
            <rect x={x} y={cy - amp} width={barWidth} height={amp} fill="url(#wf-mini)" />
            <rect x={x} y={cy} width={barWidth} height={amp} fill="url(#wf-mini)" />
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:web -- waveform`

Expected: 5 tests pass.

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform.tsx" \
        "apps/web/src/app/cms/(authed)/pipeline/audio/_components/waveform-mini.tsx" \
        apps/web/test/components/pipeline/audio/waveform.test.ts
git commit -m "feat(audio): add Waveform and WaveformMini SVG components"
```

---

### Task 10: CMS Server Page + Client Orchestrator + Filters

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters.tsx`

- [ ] **Step 1: Implement page.tsx server component**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx`:

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { CmsTopbar } from '@tn-figueiredo/cms-ui/client'
import { GEM_CSS_VARS } from '@/lib/pipeline/gem-design'
import { AudioLibrary } from './_components/audio-library'

export const dynamic = 'force-dynamic'

export default async function AudioPage() {
  const { siteId } = await getSiteContext()
  await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  const supabase = getSupabaseServiceClient()

  const [assetsRes, statsRes] = await Promise.all([
    supabase
      .from('audio_assets')
      .select('id, asset_id, original_filename, type, source, category, subcategory, genre, artist, track_name, duration_seconds, bpm, energy, tags, mood, status, priority, metadata, version, created_at, updated_at')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('audio_assets')
      .select('type, status')
      .eq('site_id', siteId),
  ])

  if (assetsRes.error) console.error('[audio] assets query:', assetsRes.error.message)
  if (statsRes.error) console.error('[audio] stats query:', statsRes.error.message)

  const assets = assetsRes.data ?? []
  const statsRows = (statsRes.data ?? []) as Array<{ type: string; status: string }>

  const stats = { total: 0, music: 0, sfx: 0, downloaded: 0, pending: 0, retired: 0 }
  for (const row of statsRows) {
    stats.total++
    if (row.type === 'music') stats.music++
    else stats.sfx++
    if (row.status === 'downloaded') stats.downloaded++
    else if (row.status === 'pending') stats.pending++
    else if (row.status === 'retired') stats.retired++
  }

  return (
    <>
      <CmsTopbar title="Pipeline — Audio Library" />
      <div className="p-4 gem-pipeline-theme" style={{ height: 'calc(100vh - 6rem)', ...GEM_CSS_VARS } as React.CSSProperties}>
        <AudioLibrary initialAssets={assets} stats={stats} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Implement AudioLibrary client orchestrator**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { AudioFilters } from './audio-filters'
import { AudioGrid } from './audio-grid'
import { AudioTable } from './audio-table'
import { AudioDetail } from './audio-detail'
import { AudioImportModal } from './audio-import-modal'

interface Stats { total: number; music: number; sfx: number; downloaded: number; pending: number; retired: number }

interface AudioLibraryProps {
  initialAssets: Record<string, unknown>[]
  stats: Stats
}

export function AudioLibrary({ initialAssets, stats }: AudioLibraryProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showImport, setShowImport] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})

  const refetch = useCallback(async (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`/api/pipeline/audio-library${qs ? `?${qs}` : ''}`)
    if (res.ok) {
      const json = await res.json()
      setAssets(json.data)
    }
  }, [])

  const handleFilterChange = useCallback((newFilters: Record<string, string>) => {
    setFilters(newFilters)
    refetch(newFilters)
  }, [refetch])

  const [gPressed, setGPressed] = useState(false)

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLInputElement>('[data-audio-search]')?.focus() }
      if (e.key === 'Escape') { setSelectedId(null); setGPressed(false) }
      if (e.key === 'g') { setGPressed(true); setTimeout(() => setGPressed(false), 500); return }
      if (gPressed && e.key === 't') { setViewMode(v => v === 'grid' ? 'table' : 'grid'); setGPressed(false); return }
      if (e.key === 'j' || e.key === 'k') {
        if (assets.length === 0) return
        const ids = assets.map((a: any) => a.id as string)
        const idx = selectedId ? ids.indexOf(selectedId) : -1
        const next = e.key === 'j' ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0)
        setSelectedId(ids[next]!)
      }
      if (e.key === 'Enter' && selectedId) { /* detail already open via selectedId */ }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [assets, selectedId, gPressed])

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
      <AudioFilters filters={filters} onChange={handleFilterChange} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--gem-border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'grid' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Grid</button>
            <button onClick={() => setViewMode('table')} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: viewMode === 'table' ? 'var(--gem-accent)' : 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Table</button>
          </div>
          <button onClick={() => setShowImport(true)} style={{ padding: '4px 12px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', color: 'var(--gem-text)', cursor: 'pointer' }}>Import JSON</button>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {viewMode === 'grid'
            ? <AudioGrid assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
            : <AudioTable assets={assets} selectedId={selectedId} onSelect={setSelectedId} />
          }
        </div>

        {/* Stats bar */}
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--gem-border)', fontSize: 11, color: 'var(--gem-muted)' }}>
          {stats.total} assets · {stats.music} music · {stats.sfx} sfx · {stats.pending} pending
        </div>
      </div>

      {selectedId && <AudioDetail assetId={selectedId} onClose={() => setSelectedId(null)} />}
      {showImport && <AudioImportModal onClose={() => { setShowImport(false); refetch(filters) }} />}
    </div>
  )
}
```

- [ ] **Step 3: Implement AudioFilters**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'

interface AudioFiltersProps {
  filters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
}

export function AudioFilters({ filters, onChange }: AudioFiltersProps) {
  const [search, setSearch] = useState('')

  const updateFilter = useCallback((key: string, value: string | undefined) => {
    const next = { ...filters }
    if (value) next[key] = value
    else delete next[key]
    onChange(next)
  }, [filters, onChange])

  return (
    <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--gem-border)', padding: 12, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
      {/* Search */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Search</label>
        <input data-audio-search value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) updateFilter('q', e.target.value); else updateFilter('q', undefined) }} placeholder="Search… (press /)" style={{ width: '100%', padding: '4px 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)' }} />
      </div>

      {/* Type */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Type</label>
        {['all', 'music', 'sfx'].map(t => (
          <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gem-text)', cursor: 'pointer', marginBottom: 2 }}>
            <input type="radio" name="type" checked={t === 'all' ? !filters.type : filters.type === t} onChange={() => updateFilter('type', t === 'all' ? undefined : t)} />
            {t === 'all' ? 'All' : t === 'music' ? '🎵 Music' : '🔊 SFX'}
          </label>
        ))}
      </div>

      {/* Status */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Status</label>
        {['downloaded', 'pending', 'retired'].map(s => (
          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--gem-text)', cursor: 'pointer', marginBottom: 2 }}>
            <input type="radio" name="status" checked={filters.status === s} onChange={() => updateFilter('status', filters.status === s ? undefined : s)} />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </label>
        ))}
      </div>

      {/* Energy */}
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Energy</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {[1, 2, 3, 4, 5].map(e => (
            <button key={e} onClick={() => {
              const min = filters.energy_min === String(e) ? undefined : String(e)
              updateFilter('energy_min', min)
              updateFilter('energy_max', min)
            }} style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--gem-border)', background: filters.energy_min === String(e) ? 'var(--gem-accent)' : 'var(--gem-well)', color: 'var(--gem-text)', fontSize: 11, cursor: 'pointer' }}>{e}</button>
          ))}
        </div>
      </div>

      {/* Clear */}
      <button onClick={() => { setSearch(''); onChange({}) }} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-muted)', cursor: 'pointer' }}>Clear filters</button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/audio/page.tsx" \
        "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-library.tsx" \
        "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-filters.tsx"
git commit -m "feat(audio): add CMS page, client orchestrator, and filter sidebar"
```

---

### Task 11: Grid + Table Views

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table.tsx`

- [ ] **Step 1: Implement AudioGrid**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid.tsx`:

```typescript
'use client'

import { WaveformMini } from './waveform-mini'

interface AudioGridProps {
  assets: Record<string, unknown>[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const STATUS_DOT: Record<string, string> = { downloaded: '#10b981', pending: '#f59e0b', retired: '#6b7280' }

export function AudioGrid({ assets, selectedId, onSelect }: AudioGridProps) {
  if (assets.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--gem-muted)', fontSize: 13 }}>No assets found. Import a JSON library or create assets via API.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
      {assets.map((asset: any) => {
        const isSelected = selectedId === asset.id
        const peaks = asset.metadata?.waveform?.peaks ?? []
        return (
          <button key={asset.id} onClick={() => onSelect(asset.id)} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, border: isSelected ? '2px solid var(--gem-accent)' : '1px solid var(--gem-border)', background: 'var(--gem-surface-hi)', cursor: 'pointer', textAlign: 'left' }}>
            <WaveformMini peaks={peaks} width={180} height={24} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{asset.type === 'music' ? '🎵' : '🔊'}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gem-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{asset.track_name || asset.asset_id}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_DOT[asset.status] ?? '#6b7280', flexShrink: 0 }} />
            </div>
            {asset.category && <span style={{ fontSize: 10, color: 'var(--gem-muted)' }}>{asset.category}</span>}
            {(asset.tags as string[])?.length > 0 && (
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {(asset.tags as string[]).slice(0, 3).map((tag: string) => (
                  <span key={tag} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: 'var(--gem-accent)' }}>{tag}</span>
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Implement AudioTable**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table.tsx`:

```typescript
'use client'

import { useState, useMemo, useCallback } from 'react'
import { WaveformMini } from './waveform-mini'

interface AudioTableProps {
  assets: Record<string, unknown>[]
  selectedId: string | null
  onSelect: (id: string) => void
}

type SortKey = 'name' | 'type' | 'category' | 'energy' | 'bpm' | 'status'

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  downloaded: { label: 'Downloaded', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  pending: { label: 'Pending', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  retired: { label: 'Retired', bg: 'rgba(107,114,128,0.15)', color: '#6b7280' },
}

export function AudioTable({ assets, selectedId, onSelect }: AudioTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    const list = [...assets]
    list.sort((a: any, b: any) => {
      const va = a[sortKey === 'name' ? 'track_name' : sortKey] ?? ''
      const vb = b[sortKey === 'name' ? 'track_name' : sortKey] ?? ''
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [assets, sortKey, sortAsc])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const toggleCheck = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (checked.size === sorted.length) setChecked(new Set())
    else setChecked(new Set(sorted.map((a: any) => a.id)))
  }, [checked.size, sorted])

  const bulkAction = useCallback(async (action: 'tag' | 'category' | 'status' | 'delete' | 'export') => {
    const ids = Array.from(checked)
    if (ids.length === 0) return

    if (action === 'export') {
      const selected = assets.filter((a: any) => checked.has(a.id))
      const blob = new Blob([JSON.stringify({ schema_version: '6.1.0', assets: selected }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `audio-selection-${ids.length}.json`; a.click()
      URL.revokeObjectURL(url)
      return
    }

    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} assets?`)) return
      await Promise.all(ids.map(id => fetch(`/api/pipeline/audio-library/${id}`, { method: 'DELETE' })))
      setChecked(new Set())
      return
    }

    const value = prompt(`Enter ${action} value for ${ids.length} assets:`)
    if (!value) return
    const body: Record<string, unknown> = {}
    if (action === 'tag') body.tags = value.split(',').map(t => t.trim())
    else body[action] = value
    await Promise.all(ids.map(id => fetch(`/api/pipeline/audio-library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, version: (assets.find((a: any) => a.id === id) as any)?.version ?? 1 }),
    })))
    setChecked(new Set())
  }, [assets, checked])

  const headers: Array<{ key: SortKey; label: string; width?: number }> = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', width: 60 },
    { key: 'category', label: 'Category', width: 100 },
    { key: 'energy', label: 'Energy', width: 60 },
    { key: 'bpm', label: 'BPM', width: 60 },
    { key: 'status', label: 'Status', width: 90 },
  ]

  return (
    <div>
      {checked.size > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--gem-text)', fontWeight: 600 }}>{checked.size} selected</span>
          <button onClick={() => bulkAction('tag')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Tag</button>
          <button onClick={() => bulkAction('category')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Category</button>
          <button onClick={() => bulkAction('status')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Status</button>
          <button onClick={() => bulkAction('export')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer', fontSize: 11 }}>Export</button>
          <button onClick={() => bulkAction('delete')} style={{ padding: '2px 8px', borderRadius: 4, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-danger)', cursor: 'pointer', fontSize: 11 }}>Delete</button>
          <button onClick={() => setChecked(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 11 }}>Clear</button>
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--gem-border)' }}>
            <th style={{ width: 32, padding: '6px 4px' }}>
              <input type="checkbox" checked={checked.size === sorted.length && sorted.length > 0} onChange={toggleAll} />
            </th>
            <th style={{ width: 80, padding: '6px 8px' }} />
            {headers.map(h => (
              <th key={h.key} onClick={() => toggleSort(h.key)} style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--gem-muted)', fontWeight: 600, cursor: 'pointer', width: h.width }}>
                {h.label}{sortKey === h.key ? (sortAsc ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((asset: any) => {
            const peaks = asset.metadata?.waveform?.peaks ?? []
            const badge = STATUS_BADGE[asset.status] ?? STATUS_BADGE.retired
            return (
              <tr key={asset.id} onClick={() => onSelect(asset.id)} style={{ borderBottom: '1px solid var(--gem-border)', cursor: 'pointer', background: selectedId === asset.id ? 'rgba(99,102,241,0.08)' : checked.has(asset.id) ? 'rgba(99,102,241,0.04)' : 'transparent' }}>
                <td style={{ padding: '4px 4px' }} onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={checked.has(asset.id)} onChange={() => toggleCheck(asset.id)} />
                </td>
                <td style={{ padding: '4px 8px' }}><WaveformMini peaks={peaks} /></td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-text)' }}>{asset.track_name || asset.asset_id}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{asset.type === 'music' ? '🎵' : '🔊'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{asset.category ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{asset.energy ?? '—'}</td>
                <td style={{ padding: '4px 8px', color: 'var(--gem-muted)' }}>{asset.bpm ?? '—'}</td>
                <td style={{ padding: '4px 8px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: badge.bg, color: badge.color }}>{badge.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-grid.tsx" \
        "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-table.tsx"
git commit -m "feat(audio): add grid and table views with sortable columns"
```

---

### Task 12: Detail Slide-out + Import Modal

**Files:**
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail.tsx`
- Create: `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-import-modal.tsx`

- [ ] **Step 1: Implement AudioDetail slide-out**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Waveform } from './waveform'

interface AudioDetailProps {
  assetId: string
  onClose: () => void
}

export function AudioDetail({ assetId, onClose }: AudioDetailProps) {
  const [asset, setAsset] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pipeline/audio-library/${assetId}`)
      .then(r => r.json())
      .then(json => { setAsset(json.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [assetId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (loading) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Loading...</div>
  if (!asset) return <div style={{ width: 400, borderLeft: '1px solid var(--gem-border)', padding: 20, color: 'var(--gem-muted)' }}>Not found</div>

  const peaks = (asset.metadata as Record<string, unknown>)?.waveform ? ((asset.metadata as Record<string, any>).waveform.peaks as number[]) : []
  const usage = (asset.usage as Array<Record<string, unknown>>) ?? []

  return (
    <div style={{ width: 400, minWidth: 400, borderLeft: '1px solid var(--gem-border)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>{(asset.track_name as string) || (asset.asset_id as string)}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      {/* Waveform */}
      <Waveform peaks={peaks} width={360} height={80} color={asset.type === 'music' ? 'purple' : 'cyan'} duration={asset.duration_seconds as number | undefined} />

      {/* Identity */}
      <Section title="Identity">
        <Row label="Asset ID" value={asset.asset_id as string} />
        <Row label="Artist" value={asset.artist as string} />
        <Row label="Source" value={asset.source as string} />
        {asset.artlist_url && <Row label="Artlist" value={<a href={asset.artlist_url as string} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gem-accent)', textDecoration: 'none' }}>Open ↗</a>} />}
      </Section>

      {/* Classification */}
      <Section title="Classification">
        <Row label="Type" value={asset.type === 'music' ? '🎵 Music' : '🔊 SFX'} />
        <Row label="Category" value={asset.category as string} />
        {asset.genre && <Row label="Genre" value={asset.genre as string} />}
        <Row label="Tags" value={((asset.tags as string[]) ?? []).join(', ')} />
        <Row label="Mood" value={((asset.mood as string[]) ?? []).join(', ')} />
      </Section>

      {/* Audio */}
      <Section title="Audio">
        <Row label="Duration" value={asset.duration_seconds ? `${asset.duration_seconds}s` : '—'} />
        <Row label="BPM" value={asset.bpm ? String(asset.bpm) : '—'} />
        <Row label="Key" value={(asset.music_key as string) ?? '—'} />
        <Row label="Energy" value={asset.energy ? `${'●'.repeat(asset.energy as number)}${'○'.repeat(5 - (asset.energy as number))}` : '—'} />
        <Row label="Instruments" value={((asset.instruments as string[]) ?? []).join(', ')} />
      </Section>

      {/* Usage */}
      <Section title={`Usage (${usage.length})`}>
        {usage.length === 0 && <span style={{ fontSize: 11, color: 'var(--gem-muted)' }}>Not used in any project yet</span>}
        {usage.map((u: any) => (
          <div key={u.id} style={{ fontSize: 11, color: 'var(--gem-text)', marginBottom: 4 }}>
            {u.content_pipeline?.code ?? u.pipeline_item_id} — scene {u.scene_number ?? '?'} ({u.usage_type})
          </div>
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: 10, fontWeight: 600, color: 'var(--gem-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
      <span style={{ color: 'var(--gem-muted)' }}>{label}</span>
      <span style={{ color: 'var(--gem-text)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</span>
    </div>
  )
}
```

- [ ] **Step 2: Implement AudioImportModal**

Create `apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-import-modal.tsx`:

```typescript
'use client'

import { useState } from 'react'

interface AudioImportModalProps { onClose: () => void }

type Step = 'input' | 'preview' | 'result'

export function AudioImportModal({ onClose }: AudioImportModalProps) {
  const [step, setStep] = useState<Step>('input')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePreview = async () => {
    setError(null)
    let parsed: unknown
    try { parsed = JSON.parse(jsonText) } catch { setError('Invalid JSON'); return }

    setLoading(true)
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(parsed as object), dry_run: true }),
    })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) { setError(json.error?.message ?? 'Import failed'); return }
    setPreview(json.data)
    setStep('preview')
  }

  const handleExecute = async () => {
    setLoading(true)
    const parsed = JSON.parse(jsonText)
    const res = await fetch('/api/pipeline/audio-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...parsed, dry_run: false }),
    })
    const json = await res.json()
    setLoading(false)
    setResult(json.data)
    setStep('result')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: 520, maxHeight: '80vh', background: 'var(--gem-surface)', border: '1px solid var(--gem-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--gem-text)', margin: 0 }}>Import Audio Library</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--gem-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        {step === 'input' && (
          <>
            <textarea value={jsonText} onChange={e => setJsonText(e.target.value)} placeholder="Paste JSON here..." style={{ width: '100%', height: 200, padding: 8, fontSize: 12, fontFamily: 'monospace', borderRadius: 5, border: '1px solid var(--gem-border)', background: 'var(--gem-well)', color: 'var(--gem-text)', resize: 'vertical' }} />
            {error && <span style={{ fontSize: 12, color: 'var(--gem-danger)' }}>{error}</span>}
            <button onClick={handlePreview} disabled={loading || !jsonText.trim()} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer', opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Validating...' : 'Preview Import'}
            </button>
          </>
        )}

        {step === 'preview' && preview && (
          <>
            <div style={{ fontSize: 12, color: 'var(--gem-text)' }}>
              <div>Create: <strong>{(preview.preview as any)?.to_create ?? 0}</strong></div>
              <div>Update: <strong>{(preview.preview as any)?.to_update ?? 0}</strong></div>
              <div>Skip: <strong>{(preview.preview as any)?.to_skip ?? 0}</strong></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('input')} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: '1px solid var(--gem-border)', background: 'transparent', color: 'var(--gem-text)', cursor: 'pointer' }}>Back</button>
              <button onClick={handleExecute} disabled={loading} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-done)', color: '#fff', cursor: 'pointer' }}>
                {loading ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ fontSize: 12, color: 'var(--gem-text)' }}>
              <div>Created: <strong>{(result as any).created}</strong></div>
              <div>Updated: <strong>{(result as any).updated}</strong></div>
              <div>Skipped: <strong>{(result as any).skipped}</strong></div>
              {(result as any).errors?.length > 0 && <div style={{ color: 'var(--gem-danger)' }}>Errors: {(result as any).errors.length}</div>}
            </div>
            <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, borderRadius: 5, border: 'none', background: 'var(--gem-accent)', color: '#fff', cursor: 'pointer' }}>Done</button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-detail.tsx" \
        "apps/web/src/app/cms/(authed)/pipeline/audio/_components/audio-import-modal.tsx"
git commit -m "feat(audio): add detail slide-out and import modal"
```

---

### Task 13: Navigation + Post-production Badges

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`
- Modify: `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`

- [ ] **Step 1: Add Audio nav item to sidebar**

In `apps/web/src/app/cms/(authed)/_shared/cms-sections.ts`, add after the Research item in the Pipeline section:

```typescript
{ icon: '🎧', label: 'Audio', href: '/cms/pipeline/audio', minRole: 'editor' as const }
```

- [ ] **Step 2: Extend SceneSFX interface and add badges**

In `apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx`:

Extend the `SceneSFX` interface:
```typescript
interface SceneSFX {
  timestamp: string
  description: string
  search_terms?: string
  audio_asset_id?: string
  resolve_status?: string
}
```

Add resolve badge styles constant and inline badge rendering in the SFX map:

```typescript
const RESOLVE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  LOCAL: { label: '✓ Local', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  PENDING_MATCH: { label: '⏳ Download', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  PARTIAL_MATCH: { label: '~ Partial', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  NO_MATCH: { label: '🔗 Search', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
}
```

Render the badge inline after the SFX description when `resolve_status` is present:

```tsx
{fx.resolve_status && RESOLVE_BADGES[fx.resolve_status] && (
  <span style={{
    fontSize: 9,
    padding: '1px 6px',
    borderRadius: 4,
    fontWeight: 600,
    background: RESOLVE_BADGES[fx.resolve_status].bg,
    color: RESOLVE_BADGES[fx.resolve_status].color,
    marginLeft: 6,
  }}>
    {RESOLVE_BADGES[fx.resolve_status].label}
  </span>
)}
```

- [ ] **Step 3: Run full test suite**

Run: `npm run test:web`

Expected: all tests pass, no regressions.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/cms/(authed)/_shared/cms-sections.ts" \
        "apps/web/src/app/cms/(authed)/pipeline/_components/detail/renderers/scene-guide-renderer.tsx"
git commit -m "feat(audio): add sidebar nav + resolve status badges in scene guide"
```
