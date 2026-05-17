# A/B Lab — YouTube Thumbnail Testing

Sprint 5h Social Hub, Task 16. A/B Lab enables YouTube thumbnail A/B testing via time-sliced rotation using the YouTube Data API v3 `thumbnails.set` endpoint.

**Core behavior:**

- Rotates thumbnail variants on a configurable schedule (ABBA counterbalanced pattern)
- Collects impressions/clicks per cycle, backfills confirmed data from YouTube Analytics API (48-72h delay)
- Statistical engine: **Bayesian P(B>A)** as primary signal, frequentist Z-test as backup
- Integrates with existing `youtube_videos` table and `content_pipeline` (optional source link)
- Auto-resolves when confidence threshold met + 6 validation gates pass
- Three independent crons: rotate → backfill → evaluate (error isolation + timing guarantees)

---

## 1. Database Schema

### `ab_tests`

```sql
CREATE TABLE IF NOT EXISTS public.ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES public.sites(id),
    youtube_video_id UUID NOT NULL REFERENCES public.youtube_videos(id),
    source_pipeline_id UUID REFERENCES public.content_pipeline(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- config schema:
    --   max_duration_days: INTEGER (7-28, default 14)
    --   confidence_threshold: NUMERIC (0.80-0.99, default 0.95)
    --   burn_in_days: INTEGER (0-3, default 2)
    --   auto_apply_winner: BOOLEAN (default true)
    --   rotation_pattern: TEXT (default 'abba')
    winner_variant_id UUID REFERENCES public.ab_test_variants(id),
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_reason TEXT,
    -- values: 'auto_resolve', 'manual_winner', 'manual_archive', 'max_duration', 'inconclusive'
    original_thumbnail_url TEXT NOT NULL,
    confidence_at_completion NUMERIC(5,4),
    consecutive_confident_evals INTEGER NOT NULL DEFAULT 0,
    status_note TEXT,
    result_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one non-terminal test per video at a time
CREATE UNIQUE INDEX IF NOT EXISTS ab_tests_one_active_per_video
    ON public.ab_tests (youtube_video_id)
    WHERE status IN ('draft', 'active', 'paused');

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
```

### `ab_test_variants`

```sql
CREATE TABLE IF NOT EXISTS public.ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    -- values: 'original', 'variant_b', 'variant_c', 'variant_d'
    is_original BOOLEAN NOT NULL DEFAULT false,
    blob_url TEXT,
    blob_key TEXT,
    file_size_bytes INTEGER,
    dimensions TEXT,
    -- e.g. '1280x720'
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;
```

### `ab_test_cycles`

```sql
CREATE TABLE IF NOT EXISTS public.ab_test_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES public.ab_test_variants(id),
    cycle_number INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    -- Metrics from YouTube Analytics API (backfilled ~3 days later)
    impressions INTEGER,
    clicks INTEGER,
    ctr NUMERIC(6,4),
    -- Near-realtime estimates from YouTube Data API v3
    estimated_impressions INTEGER,
    estimated_clicks INTEGER,
    estimated_ctr NUMERIC(6,4),
    backfill_status TEXT DEFAULT 'pending'
        CHECK (backfill_status IN ('pending', 'partial', 'confirmed', 'no_data', 'error')),
    backfill_attempts INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ab_test_cycles_test_id_idx
    ON public.ab_test_cycles (test_id, cycle_number);

ALTER TABLE public.ab_test_cycles ENABLE ROW LEVEL SECURITY;
```

### `updated_at` trigger

```sql
CREATE TRIGGER set_ab_tests_updated_at
    BEFORE UPDATE ON public.ab_tests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
```

### Deferred FK for `winner_variant_id`

```sql
ALTER TABLE public.ab_tests
    ADD CONSTRAINT ab_tests_winner_variant_fk
    FOREIGN KEY (winner_variant_id) REFERENCES public.ab_test_variants(id)
    DEFERRABLE INITIALLY DEFERRED;
```

---

## 2. State Machine

```
draft ──────► active ──────► completed ──────► archived
  │              │                                 ▲
  │              ▼                                 │
  │           paused ──────► completed             │
  │              │                                 │
  │              └──────────► archived ────────────┘
  │
  └──────────────► archived
```

### Transitions

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| `draft` | `active` | User starts test | Set `started_at`, create cycle 0, upload first variant thumbnail via `thumbnails.set` |
| `draft` | `archived` | User discards | Delete uploaded blobs (variant cleanup) |
| `active` | `paused` | Manual pause OR external thumbnail change detected | Set `paused_at`, close current cycle, RESTORE original thumbnail to YouTube |
| `active` | `completed` | Auto-resolve (6 gates pass) OR max_duration reached | Close current cycle, compute winner, set `completed_at` + `completed_reason` + `confidence_at_completion`, apply winner thumbnail if `auto_apply_winner = true` |
| `paused` | `active` | User resumes | Clear `paused_at`, create new cycle, upload current-rotation variant thumbnail |
| `paused` | `completed` | Manual winner selection | Set `winner_variant_id`, `completed_at`, `completed_reason = 'manual_winner'`, apply winner if `auto_apply_winner` |
| `paused` | `archived` | User abandons | Restore original thumbnail, cleanup non-winner blobs |
| `completed` | `archived` | User archives old test | No YouTube side effects, mark for historical record |

---

## 3. RLS Policies

```sql
-- ab_tests
DROP POLICY IF EXISTS "ab_tests_select" ON public.ab_tests;
CREATE POLICY "ab_tests_select"
    ON public.ab_tests FOR SELECT TO authenticated
    USING (public.can_view_site(site_id));

DROP POLICY IF EXISTS "ab_tests_insert" ON public.ab_tests;
CREATE POLICY "ab_tests_insert"
    ON public.ab_tests FOR INSERT TO authenticated
    WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "ab_tests_update" ON public.ab_tests;
CREATE POLICY "ab_tests_update"
    ON public.ab_tests FOR UPDATE TO authenticated
    USING (public.can_edit_site(site_id))
    WITH CHECK (public.can_edit_site(site_id));

DROP POLICY IF EXISTS "ab_tests_delete" ON public.ab_tests;
CREATE POLICY "ab_tests_delete"
    ON public.ab_tests FOR DELETE TO authenticated
    USING (public.is_org_admin(
        (SELECT s.org_id FROM public.sites s WHERE s.id = ab_tests.site_id)
    ));

-- ab_test_variants (access derived from parent test)
DROP POLICY IF EXISTS "ab_test_variants_select" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_select"
    ON public.ab_test_variants FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_variants.test_id
        AND public.can_view_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_variants_insert" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_insert"
    ON public.ab_test_variants FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_variants.test_id
        AND public.can_edit_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_variants_update" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_update"
    ON public.ab_test_variants FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_variants.test_id
        AND public.can_edit_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_variants_delete" ON public.ab_test_variants;
CREATE POLICY "ab_test_variants_delete"
    ON public.ab_test_variants FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_variants.test_id
        AND public.is_org_admin(
            (SELECT s.org_id FROM public.sites s WHERE s.id = t.site_id)
        )
    ));

-- ab_test_cycles (access derived from parent test)
DROP POLICY IF EXISTS "ab_test_cycles_select" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_select"
    ON public.ab_test_cycles FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_cycles.test_id
        AND public.can_view_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_cycles_insert" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_insert"
    ON public.ab_test_cycles FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_cycles.test_id
        AND public.can_edit_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_cycles_update" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_update"
    ON public.ab_test_cycles FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_cycles.test_id
        AND public.can_edit_site(t.site_id)
    ));

DROP POLICY IF EXISTS "ab_test_cycles_delete" ON public.ab_test_cycles;
CREATE POLICY "ab_test_cycles_delete"
    ON public.ab_test_cycles FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ab_tests t
        WHERE t.id = ab_test_cycles.test_id
        AND public.is_org_admin(
            (SELECT s.org_id FROM public.sites s WHERE s.id = t.site_id)
        )
    ));
```

---

## 4. TypeScript Interfaces (`ab-types.ts`)

```typescript
// ── DB row mirrors ──

export type AbTestStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived'
export type CompletedReason = 'auto_resolve' | 'manual_winner' | 'manual_archive' | 'max_duration' | 'inconclusive'

export interface AbTest {
  id: string
  site_id: string
  youtube_video_id: string          // FK → youtube_videos.id (internal UUID)
  source_pipeline_id: string | null
  name: string
  status: AbTestStatus
  config: AbTestConfig
  original_thumbnail_url: string
  winner_variant_id: string | null
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  completed_reason: CompletedReason | null
  confidence_at_completion: number | null
  consecutive_confident_evals: number
  status_note: string | null
  result_metadata: ResultMetadata | null
  created_at: string
  updated_at: string
}

export interface AbTestConfig {
  max_duration_days: number          // 7-28, default 14
  confidence_threshold: number       // 0.80-0.99, default 0.95
  burn_in_days: number               // 0-3, default 2
  auto_apply_winner: boolean         // default true
  rotation_pattern: 'abba' | 'round_robin'  // default 'abba'
}

export interface AbTestVariant {
  id: string
  test_id: string
  label: string                      // 'original', 'variant_b', 'variant_c', 'variant_d'
  is_original: boolean
  blob_url: string | null
  blob_key: string | null
  file_size_bytes: number | null
  dimensions: string | null
  sort_order: number
  created_at: string
}

export interface AbTestCycle {
  id: string
  test_id: string
  variant_id: string
  cycle_number: number
  started_at: string
  ended_at: string | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  estimated_impressions: number | null
  estimated_clicks: number | null
  estimated_ctr: number | null
  backfill_status: 'pending' | 'partial' | 'confirmed' | 'no_data' | 'error'
  backfill_attempts: number
  created_at: string
}

// ── Joined / enriched types ──

export interface AbTestWithVariants extends AbTest {
  variants: AbTestVariant[]
  current_cycle: AbTestCycle | null
  total_cycles: number
}

// ── Action inputs ──

export interface AbTestCreateInput {
  site_id: string
  youtube_video_id: string           // FK → youtube_videos.id
  name: string
  config?: Partial<AbTestConfig>
}

export interface CreateVariantInput {
  test_id: string
  file: File
  label?: string                     // auto-assigned if omitted
}

// ── Results / display ──

export interface VariantStats {
  variant_id: string
  label: string
  blob_url: string | null
  is_original: boolean
  total_impressions: number
  total_clicks: number
  avg_ctr: number                    // weighted average across confirmed cycles
  cycles_completed: number
}

export interface AbTestResults {
  test: AbTest
  variants: VariantStats[]
  confidence: number
  is_significant: boolean
  suggested_winner_id: string | null
  timeline: AbTestCycle[]
  data_freshness: string             // ISO timestamp of last backfill
}

export interface ResultMetadata {
  ctr_lift_percent: number
  winner_label: string
  total_impressions: number
  estimated_monthly_extra_clicks: number
}

// ── Statistical types ──

export interface BayesianResult {
  winnerId: string
  confidence: number
  probabilities: Record<string, number>
}

export interface ZTestResult {
  zScore: number
  pValue: number
  significant: boolean
}

export interface EvaluationResult {
  confidence: number
  winnerId: string | null
  bayesian: BayesianResult
  zTest: ZTestResult | null
  gates: { name: string; passed: boolean; detail: string }[]
  shouldResolve: boolean
}

// ── Site settings ──

export interface AbTestSiteSettings {
  max_concurrent_tests: number
  default_duration_days: number
  default_confidence: number
  default_auto_apply: boolean
  default_burn_in_days: number
  ctr_drop_trigger: {
    enabled: boolean
    threshold_percent: number
    min_days_below: number
  }
  post_publish_trigger: {
    enabled: boolean
    delay_hours: number
    requires_pipeline_thumbs: boolean
  }
  notifications: {
    test_completed: boolean
    test_auto_paused: boolean
    ctr_drop_alert: boolean
    daily_digest: boolean
  }
}
```

---

## 5. Server Actions (`ab-actions.ts`)

All actions are `'use server'` functions. All write actions call `requireSiteScope({ area: 'cms', siteId, mode: 'edit' })` as first operation. Cron-triggered functions use `getSupabaseServiceClient()`.

### 5.1 `createAbTest(input: AbTestCreateInput)`

```typescript
export async function createAbTest(input: AbTestCreateInput): Promise<{ id: string }>
```

**Validation:**
1. `requireSiteScope({ area: 'cms', siteId: input.site_id, mode: 'edit' })`
2. Fetch `youtube_videos` by `input.youtube_video_id` — error if not found or belongs to different site
3. Assert no existing test with `status IN ('draft', 'active', 'paused')` for same video
4. Assert video `duration_seconds > 60` (reject Shorts)
5. Assert channel has valid `social_connections` record with `youtube.upload` scope

**DB operations:**
- Merge `input.config` with site defaults → full `AbTestConfig`
- INSERT into `ab_tests` with `status = 'draft'`
- INSERT original thumbnail as first `ab_test_variants` record (`is_original = true`, `sort_order = 0`)
- The original's `blob_url` = video's current `thumbnail_hq_url` (no blob upload needed)

### 5.2 `uploadVariant(testId: string, file: File)`

```typescript
export async function uploadVariant(testId: string, file: File): Promise<{ variantId: string }>
```

**Validation:**
1. Load test, `requireSiteScope` with test's `site_id`
2. Assert `test.status === 'draft'`
3. Assert file type is `image/jpeg`, `image/png`, or `image/webp`
4. Assert file size <= 2MB
5. Assert dimensions: minimum 1280x720
6. Count existing non-original variants — assert < 3 (max 4 total including original)

**Blob upload:** Path `ab-test/{testId}/{variantId}.{ext}` via `put()` from `@vercel/blob`.

**DB:** INSERT into `ab_test_variants` with auto-assigned label and `sort_order`.

### 5.3 `startAbTest(testId: string)`

```typescript
export async function startAbTest(testId: string): Promise<void>
```

**Validation:**
1. Load test + variants, `requireSiteScope`
2. Assert `test.status === 'draft'`
3. Assert at least 2 variants exist (original + 1)
4. Get OAuth token via `ensureFreshToken(siteId, 'youtube')`

**YouTube API:** Determine first non-original variant per ABBA schedule → POST `thumbnails.set`.

**DB (transaction):**
- UPDATE `ab_tests` SET `status = 'active'`, `started_at = now()`
- INSERT first `ab_test_cycles` record (`cycle_number = 1`, `started_at = now()`)

### 5.4 `pauseAbTest(testId: string)`

```typescript
export async function pauseAbTest(testId: string): Promise<void>
```

**Validation:** Assert `test.status === 'active'`, get OAuth token.

**YouTube API:** POST `thumbnails.set` with original thumbnail (restore).

**DB (transaction):**
- UPDATE current open cycle: SET `ended_at = now()`
- UPDATE `ab_tests` SET `status = 'paused'`, `paused_at = now()`

### 5.5 `resumeAbTest(testId: string)`

```typescript
export async function resumeAbTest(testId: string): Promise<void>
```

**Validation:** Assert `test.status === 'paused'`, get OAuth token.

**ABBA resolution:** Determine next variant based on completed cycles.

**YouTube API:** POST `thumbnails.set` with resolved variant's image.

**DB (transaction):**
- INSERT new `ab_test_cycles` record (next `cycle_number`)
- UPDATE `ab_tests` SET `status = 'active'`, `paused_at = NULL`

### 5.6 `endAbTest(testId: string, winnerId?: string)`

```typescript
export async function endAbTest(testId: string, winnerId?: string): Promise<void>
```

**Validation:** Assert `test.status IN ('active', 'paused')`. If `winnerId`: assert it belongs to this test.

**YouTube API:**
- If `winnerId`: POST `thumbnails.set` with winner's image
- If no `winnerId`: POST `thumbnails.set` with original thumbnail

**DB (transaction):**
- Close current cycle if open
- UPDATE `ab_tests` SET `status = 'completed'`, `completed_at = now()`, `completed_reason = 'manual_winner'`, `winner_variant_id = winnerId ?? NULL`

### 5.7 `getTestResults(testId: string)`

```typescript
export async function getTestResults(testId: string): Promise<AbTestResults>
```

**Aggregation:** Load all cycles, group by `variant_id`, sum impressions/clicks, compute weighted CTR per variant, run statistical engine, determine `suggested_winner_id`.

### 5.8 `pullPipelineThumbnails(testId: string, pipelineId: string)`

```typescript
export async function pullPipelineThumbnails(testId: string, pipelineId: string): Promise<{ added: number }>
```

**Validation:** Assert `test.status === 'draft'`. Load pipeline entry, extract thumbnail URLs.

**Operations:** For each pipeline thumbnail (max 3): fetch → upload to Vercel Blob → INSERT `ab_test_variants`.

### 5.9 `getAbTestsForSite(siteId: string)`

```typescript
export async function getAbTestsForSite(siteId: string): Promise<{
  active: AbTestWithVariants[]
  draft: AbTestWithVariants[]
  completed: AbTestWithVariants[]
}>
```

**Query:** SELECT from `ab_tests` WHERE `site_id`, JOIN variants and latest cycle, group by status.

---

## 6. Three-Cron Architecture

Three separate cron jobs instead of one monolithic job:

| Cron | Path | Schedule | Purpose |
|------|------|----------|---------|
| Rotate | `/api/cron/ab-rotate` | `0 8 * * *` | Swap thumbnails (midnight PST) |
| Backfill | `/api/cron/ab-backfill` | `0 11 * * *` | Pull YouTube Analytics data |
| Evaluate | `/api/cron/ab-evaluate` | `0 12 * * *` | Run statistics, auto-resolve |

**Why three:**
1. **Separation of concerns** — Rotation is time-critical. Backfill depends on YouTube data availability. Evaluation depends on backfill completion.
2. **Error isolation** — OAuth failure in rotation must not block evaluation of already-backfilled data.
3. **Timing guarantees** — Rotate at 08:00 UTC (midnight PST, YouTube day boundary). Backfill at 11:00 UTC (3h buffer). Evaluate at 12:00 UTC (after backfill completes).

All three validate `Authorization: Bearer ${CRON_SECRET}`.

### 6.1 Cron 1: Rotation (`/api/cron/ab-rotate`)

**Steps for each active test:**

1. Compute expected current variant from ABBA schedule based on `cycle_number`
2. Call `videos.list` to verify current live thumbnail matches expected variant
3. **If mismatch:** auto-pause test, notify user ("thumbnail changed externally")
4. **If match:** call `thumbnails.set` with next variant per ABBA schedule
5. Close current cycle (`ended_at = now()`)
6. Insert new cycle record for the incoming variant

### ABBA Rotation Pattern

Counterbalanced scheduling eliminates day-of-week bias:

| Variants | Pattern (repeating block) |
|----------|--------------------------|
| 2 | `[A, B, B, A, A, B, B, A, ...]` (4-day block) |
| 3 | `[A, B, C, C, B, A, A, B, C, ...]` (6-day Latin square) |
| 4 | `[A, B, C, D, D, C, B, A, ...]` (8-day reverse second half) |

```typescript
function getVariantForCycle(variantCount: number, cycleNumber: number): number
```

General rule: block size = `2 * variantCount`. First half = forward `[0, 1, ..., n-1]`. Second half = reverse `[n-1, ..., 1, 0]`. Repeating.

### 6.2 Cron 2: Backfill (`/api/cron/ab-backfill`)

**Query:** All cycles WHERE `backfill_status IN ('pending', 'partial')` AND `ended_at < now() - interval '3 days'`.

**For each cycle:**
1. Get OAuth token for channel
2. Call YouTube Analytics API: `reports.query` with `dimensions=day`, `metrics=impressions,impressionClickThroughRate`, `filters=video=={videoId}`, date range = cycle's `started_at` to `ended_at`
3. Compute weighted CTR: `SUM(daily_impressions * daily_ctr) / SUM(daily_impressions)`
4. Derive clicks: `impressions * ctr`
5. Update cycle: set metrics, `backfill_status = 'confirmed'`
6. **No data + attempts < 3:** set `backfill_status = 'partial'`, increment attempts
7. **No data + attempts >= 3:** set `backfill_status = 'no_data'`
8. **API error:** set `backfill_status = 'error'`, capture to Sentry

### 6.3 Cron 3: Evaluate (`/api/cron/ab-evaluate`)

**For each active test:**

1. Get all cycles with `backfill_status = 'confirmed'`
2. Exclude burn-in cycles (first N based on `config.burn_in_days`)
3. Aggregate per variant: `sum(impressions)`, `sum(clicks)`, computed CTR
4. Run statistical engine (Bayesian + Z-test)
5. Check all 6 auto-resolve gates
6. **All gates pass:** call `resolveAbTest()` — applies winning thumbnail permanently
7. **`max_duration` reached and gates don't pass:** set `status = 'completed'`, `completed_reason = 'inconclusive'`

### 6 Auto-Resolve Gates (ALL must pass)

| # | Gate | Default Threshold | Purpose |
|---|------|-------------------|---------|
| 1 | Confidence | >= 95% | Statistical significance |
| 2 | Min impressions | >= 1,000 per variant | Adequate sample size |
| 3 | Min duration | >= 7 days since `started_at` | Avoid day-of-week bias |
| 4 | Min cycles | >= 14 rotation cycles completed | Full ABBA blocks covered |
| 5 | Burn-in excluded | First N cycles removed from analysis | Remove novelty/algorithm effects |
| 6 | Stability | Confidence stable for 3 consecutive evaluations | No flip-flopping allowed |

Gate 6 tracked via `ab_tests.consecutive_confident_evals` counter.

---

## 7. Statistical Engine (`ab-statistics.ts`)

### Primary: Bayesian P(B > A)

Model each variant's CTR as a Beta distribution with uniform prior:

```
CTR_i ~ Beta(clicks_i + 1, impressions_i - clicks_i + 1)
```

For N variants, compute P(X > all others) via Monte Carlo (10,000 draws):
- Draw 10,000 samples from each Beta distribution
- For each draw, record which variant has the highest value
- P(X wins) = count(X was highest) / 10,000

Winner = variant with highest P(X > all others). Confidence = that probability.

```typescript
function calculateBayesianConfidence(variants: VariantStats[]): BayesianResult
```

### Backup: Frequentist Z-test (2-variant only)

```
p_a = clicks_a / impressions_a
p_b = clicks_b / impressions_b
p_pool = (clicks_a + clicks_b) / (impressions_a + impressions_b)
se = sqrt(p_pool * (1 - p_pool) * (1/impressions_a + 1/impressions_b))
z = (p_b - p_a) / se
p_value = 2 * (1 - normalCdf(|z|))
```

```typescript
function calculateZTest(variantA: VariantStats, variantB: VariantStats): ZTestResult
```

### Combined Decision

Bayesian is the primary decision mechanism. Z-test serves as sanity check for 2-variant tests — if Bayesian says resolve but Z-test disagrees, a warning is logged but Bayesian takes precedence.

```typescript
function evaluateAbTest(test: AbTestWithCycles): EvaluationResult
```

---

## 8. YouTube API Integration

### `thumbnails.set` (POST — multipart upload)

| Field | Value |
|-------|-------|
| Endpoint | `https://www.googleapis.com/upload/youtube/v3/thumbnails/set` |
| Method | POST |
| Content-Type | `image/png` or `image/jpeg` |
| Query params | `videoId={youtube_video_id}&uploadType=media` |
| Auth | `Authorization: Bearer {access_token}` |
| Scope required | `https://www.googleapis.com/auth/youtube.upload` |
| Quota cost | **50 units** per call |
| File constraints | JPEG or PNG, max 2MB, recommended 1280x720 |
| CDN propagation | 2-60 minutes |

### `videos.list` (GET — thumbnail verification)

| Field | Value |
|-------|-------|
| Endpoint | `https://www.googleapis.com/youtube/v3/videos` |
| Params | `part=snippet&id={videoId}` |
| Auth | OAuth Bearer or API key |
| Quota cost | **1 unit** |
| Response path | `items[0].snippet.thumbnails.high.url` |

Used pre-rotation for external change detection.

### YouTube Analytics `reports.query` (GET — cycle backfill)

| Field | Value |
|-------|-------|
| Endpoint | `https://youtubeanalytics.googleapis.com/v2/reports` |
| Params | `ids=channel==MINE`, `startDate`, `endDate`, `dimensions=day`, `filters=video=={videoId}` |
| Auth | `Authorization: Bearer {access_token}` |
| Scope | `https://www.googleapis.com/auth/yt-analytics.readonly` |
| Metrics | `impressions,impressionClickThroughRate` |
| Data delay | **48-72 hours** |

**Key constraints:**
- No hourly data — rotations must be ≥ 24h
- 48-72h delay — backfill waits 3 days
- Day boundary alignment — cycles start/end at midnight UTC

### Token Management

```
ab_tests.youtube_video_id
  → youtube_videos.channel_id
    → youtube_channels
      → social_connections WHERE provider='youtube' AND revoked_at IS NULL
        → ensureFreshToken(site_id, 'youtube')
```

Existing `ensureFreshToken()` handles decrypt + Google OAuth2 refresh. No changes needed.

**Error handling:**
- `401 Unauthorized` → refresh token once, retry
- Refresh fails (revoked) → auto-pause test, `status_note = 'token revoked'`, notify user
- `403 quotaExceeded` → auto-pause all tests for channel, resume next day

---

## 9. File Structure

```
apps/web/src/app/cms/(authed)/youtube/
├── ab-lab/
│   ├── page.tsx                    -- Server page (fetch tests, render AbLabDashboard)
│   ├── [testId]/
│   │   └── page.tsx                -- Server page (fetch test detail)
│   └── _components/
│       ├── ab-lab-dashboard.tsx     -- Main dashboard
│       ├── ab-test-card.tsx         -- Active test card
│       ├── ab-test-completed-row.tsx -- Completed test row
│       ├── ab-create-wizard.tsx     -- 3-step modal wizard
│       ├── ab-video-picker.tsx      -- Video selection modal
│       ├── ab-test-detail.tsx       -- Full detail view
│       ├── ab-confidence-trend.tsx  -- Confidence trend chart
│       ├── ab-rotation-timeline.tsx -- ABBA rotation visual
│       ├── ab-variant-card.tsx      -- Variant comparison card
│       ├── ab-settings-panel.tsx    -- Settings/automation config
│       ├── ab-end-test-dialog.tsx   -- End test + manual winner dialog
│       └── ab-pause-dialog.tsx      -- Pause confirmation dialog
├── videos/
│   ├── videos-connected.tsx        -- MODIFIED: add A/B column + expandable rows
│   └── video-row-actions.tsx       -- MODIFIED: add AbStatusBadge component
```

---

## 10. Component Specifications

### 10.1 AbLabDashboard

Server page fetches all tests → passes as props.

**Sections (top to bottom):**

1. **Summary strip** — 4 KPI cards: Active Tests, Avg Confidence, Win Rate, Avg CTR Lift
2. **Drafts** — Collapsed accordion (only if drafts exist)
3. **Active tests** — Grid of `AbTestCard` (max 2 columns)
4. **Completed list** — Table of `AbTestCompletedRow` with date range/outcome filters

**Header:** Title "A/B Lab" + active count badge + quota badge (e.g. "2/5 slots") + settings gear + "+ New Test" button.

**Empty state:** Beaker icon + "No thumbnail tests yet" + description + "New Test" CTA + "Go to Videos" link.

### 10.2 AbTestCard

Active/paused test card in the dashboard grid.

**Content:**
- Status badge (green "Active" / amber "Paused") + day counter + health indicator (`↑`/`≈`/`↓`)
- Video title + channel handle
- Confidence bar: red (<80%) → amber (80-94%) → green (>=95%)
- 2-4 mini `AbVariantCard` instances: thumbnail + CTR
- Footer: next rotation date, ABBA cycle progress dots

**Actions:** "Pause" button, "Details" link.

### 10.3 AbCreateWizard

3-step modal (max-w-[640px], centered, backdrop blur).

**Step 1 — Upload Variants:**
- 2x2 grid of thumbnail slots. Slot 1: current (locked, "Original A"). Slots 2-4: upload zones.
- Minimum 1 variant required. Max 2MB, JPEG/PNG/WebP, min 1280x720.
- "From Pipeline" button opens sub-modal listing pipeline outputs with thumbnails.

**Step 2 — Configure:**

| Setting | Control | Default |
|---------|---------|---------|
| Duration | Select (7/14/21/28 days) | 14 |
| Confidence threshold | Slider 80-99% | 95% |
| Auto-apply winner | Toggle | On |
| Burn-in period | Toggle + tooltip | On (48h) |
| Pipeline link | Optional select | None |

**Step 3 — Review:**
- Side-by-side thumbnail comparison
- Config summary table
- "What happens" explainer box
- Footer: "Back" + "Save as Draft" + "Launch Test"

### 10.4 AbVideoPickerDialog

Modal for selecting which video to test.

**Eligibility rules:**
- Eligible: non-Short videos without active test
- Ineligible: Shorts (labeled), videos with active test (labeled)
- Previously tested: "Tested" badge + previous lift result

On select → closes picker → opens `AbCreateWizard`.

### 10.5 AbTestDetail

Full-page detail view.

**Layout:**
- Breadcrumb: "A/B Lab" > video title
- Header: status badge, date range, action buttons (contextual per status)

**Sections:**

1. **Confidence hero** — Large percentage + trend arrow + `AbConfidenceTrend` chart + p-value
2. **Data signal toggle** — "Confirmed" (solid) vs "Live estimate" (dashed)
3. **Variant comparison** — Side-by-side cards: thumbnail, CTR, impressions, clicks, days shown
4. **Rotation timeline** — `AbRotationTimeline` ABBA visualization
5. **Daily CTR chart** — Bar chart per day per variant
6. **YouTube verification** — Badge: verified/propagating/error

**Completed state:** Winner banner (green) + final stats + "Applied on [date]" note.

**Inconclusive state:** Amber banner + explanation + "Re-test" / "Apply Anyway" / "Archive" buttons.

### 10.6 AbConfidenceTrend

SVG chart (100% width, 160px height).

- Solid blue line connecting evaluation dots
- Projected dashed line (dimmed)
- Horizontal dashed green line at threshold
- Current value: highlighted dot with label

### 10.7 AbRotationTimeline

Horizontal visualization of ABBA pattern.

- Day blocks colored per variant: Original = gray, B = blue, C = purple, D = teal
- Today: gold border ring
- Future days: dashed border, 40% opacity
- Legend row below
- Horizontally scrollable if >28 days

### 10.8 AbVariantCard

| Visual State | Style |
|-------------|-------|
| Winner | Green left border + "Winner" badge |
| Leading (active) | Subtle green tint |
| Trailing | No special styling |
| Estimate mode | Dashed border |

### 10.9 AbSettingsPanel

Slide-over panel. Sections:

1. **Automation:** CTR drop trigger (toggle + threshold), post-publish auto-test toggle
2. **Defaults:** Duration, max concurrent, confidence threshold, auto-apply
3. **Notifications:** Test completed, auto-paused, CTR drop alert, draft ready

Persisted to `sites.settings.ab_test` JSONB.

### 10.10 AbEndTestDialog

- Warning if confidence < threshold
- Radio group: "Apply leading variant" / "Keep original" / "Archive"
- Each option shows inline thumbnail + CTR

### 10.11 AbPauseDialog

- Explanation: restores original immediately, cycle closed, data preserved
- "Cancel" + "Pause Test" (amber)

---

## 11. Videos Tab Modifications

### New A/B Column

Inserted between "Hidden" and "Pick" columns. Header: "A/B" (centered, 70px).

| State | Display | Interaction |
|-------|---------|-------------|
| Ineligible (Short) | `—` | None |
| Eligible, no test | "Start A/B" button (small, outlined) | Opens wizard with video pre-selected |
| Active test | Colored dot + "D9" + health arrow | Click → test detail |
| Paused | Amber pill: "Paused" | Click → test detail |
| Completed (winner) | Green text: "+32%" | Click → test detail |
| Completed (no lift) | Muted text: "= Original" | Click → test detail |

### Expandable Row

Clicking any video row expands inline detail panel:

**Left column:** Larger thumbnail (240x135), full title, description preview, tags.

**Right column:**
- A/B panel: "Start A/B Test" or status summary + "View Details"
- Pipeline badge: linked/unlinked + "View in Pipeline"
- Quick actions row

### Context Menu (⋯ button)

| Action | Condition |
|--------|-----------|
| Start A/B | Eligible, no active test |
| View Test | Has active/completed test |
| Pause Test | Has active test |
| End Test | Has active test |
| View Pipeline | Has source_pipeline_id |
| Open YouTube | Always |

### Pipeline Badge

After video title when `source_pipeline_id` present:
- Style: `bg-purple-900/30 text-purple-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium`
- Text: "Pipeline"

---

## 12. Infrastructure & Integration

### 12.1 Vercel Blob Storage

**Upload flow:**
1. Client-side validation (type, size, dimensions)
2. Server action `uploadVariant` → `put()` to Vercel Blob
3. Store URL + key in `ab_test_variants`
4. Path: `ab-test/{testId}/{variantLabel}.{ext}`

**Lifecycle:**

| Status | Retention |
|--------|-----------|
| active/paused | indefinite |
| completed | 90 days after `completed_at` |
| archived | 30 days after archived |

Cleanup via existing `/api/cron/media-cleanup`.

### 12.2 Pipeline Integration

- `ab_tests.source_pipeline_id` → direct FK to `content_pipeline`
- `pullPipelineThumbnails()` reads `social_config.thumbnail_alternatives` from pipeline entry
- "From Pipeline" button in wizard visible when video has linked pipeline entry

### 12.3 Quota Management

- Daily YouTube quota: 10,000 units
- Per test per day: ~51 units (1 rotation + 1 verification)
- Practical cap: `sites.settings.ab_test.max_concurrent_tests` (default 3)
- On `403 quotaExceeded`: auto-pause all tests, notify, resume next cron window

### 12.4 Sentry Integration

| Event | Severity |
|-------|----------|
| Cron execution failure | error (immediate) |
| YouTube API 4xx/5xx | warning (after 2 consecutive) |
| Token refresh failure | error (immediate) |
| Bayesian vs Z-test disagreement | info (logged) |

Health endpoint: `/api/cron/ab-health` (protected by `CRON_SECRET`).

### 12.5 Cross-Test Insights

Available after 3+ completed tests with declared winner. Displayed at bottom of dashboard:

- Cumulative impact card: total estimated extra clicks/month
- Average CTR lift across tests
- Channel breakdown (if multiple channels)

Computed at `finalizeTest()` time → stored in `result_metadata` JSONB.

### 12.6 Notification Integration

Events appear in CMS notification bell:

| Event | Message |
|-------|---------|
| Test completed (winner) | "Variant B wins (+18% CTR)" |
| Test auto-paused | "external thumbnail change detected" |
| CTR drop alert | "CTR dropped -25% since change" |

### 12.7 Vercel Cron Configuration

```json
{
  "crons": [
    { "path": "/api/cron/ab-rotate", "schedule": "0 8 * * *" },
    { "path": "/api/cron/ab-backfill", "schedule": "0 11 * * *" },
    { "path": "/api/cron/ab-evaluate", "schedule": "0 12 * * *" }
  ]
}
```

### 12.8 Environment Variables

No new env vars required. All already exist: `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `YOUTUBE_API_KEY`, OAuth tokens in `social_connections`.

---

## 13. Responsive Design

### Desktop (>1024px)
- Full table with all columns including A/B
- Dashboard: summary strip 4-column, test cards 2-column grid
- Wizard: centered 640px modal
- Detail: 2-column layout

### Tablet (768-1024px)
- A/B column: icon-only (colored dot + arrow)
- Dashboard: test cards full-width stack
- Wizard: 90vw modal
- Detail: single column

### Mobile (<768px)
- A/B column hidden (access via row expansion)
- Dashboard: summary strip 2x2, cards full-width
- Wizard: full-screen modal
- Charts: horizontally scrollable with touch inertia

---

## 14. Testing Strategy

**Unit tests:**
- Statistical engine: known CTR inputs → expected confidence, winner declarations
- ABBA rotation algorithm: sequence correctness for 2/3/4 variants
- Burn-in logic: verify exclusion
- Quota calculation helpers

**Integration tests (gated on `HAS_LOCAL_DB`):**

```typescript
describe.skipIf(skipIfNoLocalDb())('ab-tests CRUD', () => {
  // State machine transitions: draft → active → paused → active → completed
  // Variant management: add/remove/reorder
  // Pipeline thumbnail pull (mocked blob)
  // Settings inheritance from site defaults
});
```

**Mocking:**
- YouTube API: `vi.mock` on wrapper
- Vercel Blob: mock `put()` and `del()`
- OAuth refresh: mock token endpoint
- No real external API calls in any test

---

## 15. Migration Notes

- Create via `npm run db:new ab_testing`
- `DROP POLICY IF EXISTS` before `CREATE POLICY` (idempotency)
- Use existing `public.set_updated_at()` trigger
- Create `ab_test_variants` BEFORE adding `winner_variant_id` FK (deferred constraint)
- Partial unique index enforces single-active-test-per-video at DB level
- No `ON DELETE CASCADE` from `youtube_videos` → `ab_tests` (explicit archival required)
