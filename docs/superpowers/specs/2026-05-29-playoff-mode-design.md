# Playoff Mode — AB Lab

**Status:** Approved  
**Date:** 2026-05-29  
**Scope:** thumbnail + combo tests only (title/description excluded — re-indexing risk)

## Problem

When an A/B test reaches `max_duration_days` without statistical confidence, it completes as `inconclusive`. The user must manually create a new test with fewer variants. Playoff Mode automates this: it picks the top 2 performers from Round 1, creates a focused Round 2 test, and auto-starts it after a cooldown.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Automation level | Fully automatic | No manual confirmation needed |
| Finalists | Top 2 only | Faster convergence, cleaner data |
| Max rounds | 1 playoff (Round 2) | If still inconclusive → variants are equivalent |
| Eligible test types | thumbnail, combo | title/description risk YouTube re-indexing |
| Data carry-forward | Fresh (Round 2 starts from zero) | Avoids bias from prior rotation imbalance |
| Auto-start | 4h cooldown | YouTube algorithm stabilization window |
| Variant selection | P(top2) via Monte Carlo | Eliminates winner's curse from raw CTR |

## Schema Changes (1 migration)

### `ab_tests` — new columns

```sql
ALTER TABLE ab_tests
  ADD COLUMN parent_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN playoff_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN playoff_start_after TIMESTAMPTZ;

CREATE UNIQUE INDEX ab_tests_one_playoff_per_parent
  ON ab_tests (parent_test_id) WHERE parent_test_id IS NOT NULL;
```

- `parent_test_id`: Round 2 → points to Round 1 test. NULL for Round 1.
- `round_number`: 1 (default) or 2.
- `playoff_test_id`: Round 1 → points to the created Round 2 test. NULL until playoff created.
- `playoff_start_after`: Round 2 tests created as `draft` with this timestamp. Cron activates when `now() > playoff_start_after`.

### `ab_test_variants` — new column

```sql
ALTER TABLE ab_test_variants
  ADD COLUMN source_variant_id UUID REFERENCES ab_test_variants(id) ON DELETE SET NULL;
```

- `source_variant_id`: Round 2 variant → points to the Round 1 variant it was cloned from.

### Postgres RPC: `create_playoff_test()`

Single transactional function to avoid partial state:

```sql
CREATE OR REPLACE FUNCTION create_playoff_test(
  p_parent_test_id UUID,
  p_variant_ids UUID[],  -- exactly 2 variant IDs from Round 1
  p_cooldown_hours INTEGER DEFAULT 4
) RETURNS UUID AS $$
DECLARE
  v_parent ab_tests%ROWTYPE;
  v_new_test_id UUID := gen_random_uuid();
  v_variant RECORD;
  v_new_variant_id UUID;
  v_sort INT := 0;
BEGIN
  -- Lock parent row
  SELECT * INTO v_parent FROM ab_tests WHERE id = p_parent_test_id FOR UPDATE;

  IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent test not found';
  END IF;
  IF v_parent.playoff_test_id IS NOT NULL THEN RAISE EXCEPTION 'Playoff already exists';
  END IF;
  IF v_parent.round_number != 1 THEN RAISE EXCEPTION 'Only Round 1 tests can spawn playoffs';
  END IF;

  -- Create Round 2 test as draft
  INSERT INTO ab_tests (
    id, site_id, youtube_video_id, source_pipeline_id,
    name, status, config, test_type,
    original_thumbnail_url, original_title, original_description,
    round_number, parent_test_id, playoff_start_after
  ) VALUES (
    v_new_test_id, v_parent.site_id, v_parent.youtube_video_id, v_parent.source_pipeline_id,
    v_parent.name || ' — Playoff', 'draft', v_parent.config, v_parent.test_type,
    v_parent.original_thumbnail_url, v_parent.original_title, v_parent.original_description,
    2, p_parent_test_id, now() + (p_cooldown_hours || ' hours')::INTERVAL
  );

  -- Copy selected variants
  FOR v_variant IN
    SELECT * FROM ab_test_variants
    WHERE id = ANY(p_variant_ids)
    ORDER BY sort_order
  LOOP
    v_new_variant_id := gen_random_uuid();
    INSERT INTO ab_test_variants (
      id, test_id, label, is_original, blob_url, blob_key,
      file_size_bytes, dimensions, title_text, description_text,
      metadata, sort_order, source_variant_id
    ) VALUES (
      v_new_variant_id, v_new_test_id, v_variant.label, v_variant.is_original,
      v_variant.blob_url, v_variant.blob_key, v_variant.file_size_bytes,
      v_variant.dimensions, v_variant.title_text, v_variant.description_text,
      v_variant.metadata, v_sort, v_variant.id
    );
    v_sort := v_sort + 1;
  END LOOP;

  -- Link parent → playoff
  UPDATE ab_tests SET playoff_test_id = v_new_test_id WHERE id = p_parent_test_id;

  RETURN v_new_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## P(top2) — Monte Carlo Variant Selection

New function `calculatePTop2()` in `ab-statistics.ts`:

```typescript
export function calculatePTop2(variants: VariantStats[]): Record<string, number> {
  const top2Counts = new Map<string, number>()
  for (const v of variants) top2Counts.set(v.variant_id, 0)

  for (let i = 0; i < MC_SAMPLES; i++) {
    const samples: { id: string; val: number }[] = variants.map(v => ({
      id: v.variant_id,
      val: sampleBeta(v.total_clicks + 1, v.total_impressions - v.total_clicks + 1),
    }))
    samples.sort((a, b) => b.val - a.val)
    top2Counts.set(samples[0].id, (top2Counts.get(samples[0].id) ?? 0) + 1)
    top2Counts.set(samples[1].id, (top2Counts.get(samples[1].id) ?? 0) + 1)
  }

  const result: Record<string, number> = {}
  for (const v of variants) {
    result[v.variant_id] = (top2Counts.get(v.variant_id) ?? 0) / MC_SAMPLES
  }
  return result
}
```

## Eligibility Conditions (ALL must pass)

| # | Condition | Rationale |
|---|-----------|-----------|
| 1 | `completed_reason = 'inconclusive'` | Only inconclusive tests get playoffs |
| 2 | `test_type IN ('thumbnail', 'combo')` | No title/desc (re-indexing risk) |
| 3 | `≥ 3 non-original variants` with confirmed cycle data | Need enough to meaningfully narrow |
| 4 | `round_number = 1 AND parent_test_id IS NULL AND playoff_test_id IS NULL` | No cascading playoffs |
| 5 | Avg daily impressions ≥ 500 | Low-traffic videos won't converge anyway |
| 6 | Original is NOT the P(best) winner | If original wins, no optimization needed |
| 7 | P(top2) gap between 2nd and 3rd ≥ 5pp | If 2nd/3rd are indistinguishable, playoff won't help |
| 8 | All cycles in terminal backfill status | Wait for complete data before deciding |
| 9 | Every variant has ≥ 2 confirmed cycles AND ≥ 200 impressions | Minimum data for reliable P(top2) |

## Evaluation Flow (ab-evaluate cron)

### Current flow (unchanged)
1. Fetch active tests → aggregate stats → calculate Bayesian → check 6 gates
2. If all pass + stability → auto-resolve with winner
3. If max_duration exceeded → mark `inconclusive`

### New: Playoff detection (runs AFTER existing evaluation loop)

```
1. Query: completed tests WHERE:
   - completed_reason = 'inconclusive'
   - test_type IN ('thumbnail', 'combo')
   - round_number = 1
   - parent_test_id IS NULL
   - playoff_test_id IS NULL

2. For each candidate:
   a. Verify all cycles in terminal backfill status
   b. Aggregate variant stats from confirmed cycles
   c. Check: ≥3 non-original variants with data
   d. Check: every variant has ≥2 cycles AND ≥200 impressions
   e. Calculate avg daily impressions → must be ≥500
   f. Calculate P(best) → original must NOT be the winner
   g. Calculate P(top2) for all variants
   h. Sort by P(top2) descending
   i. Check gap: P(top2)[1] - P(top2)[2] ≥ 0.05
   j. Select top 2 variant IDs
   k. Tiebreaker: (1) more impressions, (2) lower sort_order
   l. Call RPC create_playoff_test(test_id, [variant_id_1, variant_id_2], 4)
   m. Emit notification 'playoff_created'
```

### New: Playoff auto-start (runs BEFORE evaluation loop)

```
1. Query: draft tests WHERE:
   - round_number = 2
   - parent_test_id IS NOT NULL
   - playoff_start_after IS NOT NULL
   - playoff_start_after <= now()

2. For each: call startAbTestInternal(test_id)
   - Internal version of startAbTest without auth check (cron uses service-role)
   - Sets status='active', creates first cycle, applies first variant thumbnail
```

### Cron safety: `cron_try_lock`

Add advisory lock to prevent concurrent ab-evaluate runs from creating duplicate playoffs:

```sql
SELECT pg_try_advisory_xact_lock(hashtext('ab-evaluate'));
```

## Notification

New notification type `playoff_created`:

```typescript
interface PlayoffCreatedInput {
  type: 'playoff_created'
  videoId: string
  videoTitle: string
  testName: string
  variant1Label: string
  variant2Label: string
  weekIso: string
}
```

Message: `"Playoff criado: {variant1Label} vs {variant2Label}. Início em 4h."`

## startAbTestInternal

Extract core start logic from `startAbTest()` into a shared function without auth check:

```typescript
export async function startAbTestInternal(
  testId: string,
  siteId: string,
): Promise<{ ok: boolean; error?: string }>
```

`startAbTest()` becomes a thin wrapper: auth check + `startAbTestInternal()`.

## UI Changes

### Test Detail (completed Round 1 with playoff)

When `test.playoff_test_id` exists:
- Banner: "Playoff criado — {variant1} vs {variant2}" with link to Round 2 test
- Styled as info banner (blue/indigo), not destructive

### Test Detail (Round 2 test)

When `test.parent_test_id` exists:
- Badge "Round 2" next to status badge
- Link "Ver Round 1 →" below test name
- Same detail layout — no special treatment

### Dashboard

- Completed tests show "Round" column: "1/2" (has playoff) or "2/2" (is playoff) or "-" (normal)
- Tests with playoff_test_id get visual grouping (indented Round 2 under Round 1)

### Types

```typescript
// Add to AbTestRow
parent_test_id: string | null
round_number: number
playoff_test_id: string | null
playoff_start_after: string | null
```

## File Changes Summary

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_playoff_mode.sql` | Schema + RPC |
| `apps/web/src/lib/youtube/ab-types.ts` | New fields on AbTestRow, new notification type |
| `apps/web/src/lib/youtube/ab-statistics.ts` | Add `calculatePTop2()`, export `sampleBeta()` |
| `apps/web/src/lib/youtube/notification-service.ts` | Add `playoff_created` type + builder |
| `apps/web/src/app/api/cron/ab-evaluate/route.ts` | Playoff detection + auto-start + advisory lock |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` | Extract `startAbTestInternal()`, update `getAbTestsForSite()` query |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx` | Playoff banner, Round 2 badge/link |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx` | Round column, playoff grouping |
| `apps/web/test/` | Tests for P(top2), eligibility, RPC, notification |

## Invariants

1. A Round 1 test can have AT MOST one playoff (unique index on parent_test_id)
2. Round 2 tests NEVER spawn playoffs (round_number check in RPC)
3. If Round 2 is also inconclusive → completed as-is, variants deemed equivalent
4. Playoff creation is atomic (Postgres RPC transaction)
5. Advisory lock prevents duplicate playoff creation from concurrent cron runs
6. 4h cooldown between Round 1 completion and Round 2 start
7. Original variant enters Round 2 by merit only (no hardcoded inclusion)
8. P(top2) Monte Carlo uses same Beta-Binomial model as existing Bayesian confidence
