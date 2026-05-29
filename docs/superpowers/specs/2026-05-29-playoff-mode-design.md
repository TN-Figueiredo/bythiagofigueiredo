# Playoff Mode — AB Lab

**Status:** Approved (v3 — post-adversarial audit)  
**Date:** 2026-05-29  
**Scope:** thumbnail + combo tests only (title/description excluded — re-indexing risk)  
**Audit:** 4-agent adversarial review, 31 findings addressed

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

Single transactional function to avoid partial state. Hardened after adversarial audit:

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
  v_copied INT := 0;
BEGIN
  -- [SECURITY] Lock parent row — serializes concurrent calls
  SELECT * INTO v_parent FROM ab_tests WHERE id = p_parent_test_id FOR UPDATE;

  IF v_parent IS NULL THEN RAISE EXCEPTION 'Parent test not found'; END IF;
  IF v_parent.status != 'completed' THEN
    RAISE EXCEPTION 'Parent must be completed (got: %)', v_parent.status;
  END IF;
  IF v_parent.completed_reason != 'inconclusive' THEN
    RAISE EXCEPTION 'Only inconclusive tests spawn playoffs (got: %)', v_parent.completed_reason;
  END IF;
  IF v_parent.playoff_test_id IS NOT NULL THEN
    RAISE EXCEPTION 'Playoff already exists: %', v_parent.playoff_test_id;
  END IF;
  IF v_parent.round_number != 1 THEN
    RAISE EXCEPTION 'Only Round 1 tests can spawn playoffs';
  END IF;

  -- [SECURITY] Validate cardinality
  IF array_length(p_variant_ids, 1) IS NULL OR array_length(p_variant_ids, 1) != 2 THEN
    RAISE EXCEPTION 'Playoff requires exactly 2 variant IDs, got %',
      coalesce(array_length(p_variant_ids, 1), 0);
  END IF;

  -- [SAFETY] Reject if video already has an active/draft/paused test
  IF EXISTS (
    SELECT 1 FROM ab_tests
    WHERE youtube_video_id = v_parent.youtube_video_id
      AND status IN ('draft', 'active', 'paused')
      AND id != p_parent_test_id
  ) THEN
    RAISE EXCEPTION 'Video already has an active/draft/paused test';
  END IF;

  -- [SAFETY] Verify all cycles are in terminal backfill status
  IF EXISTS (
    SELECT 1 FROM ab_test_cycles
    WHERE test_id = p_parent_test_id
      AND backfill_status IN ('pending', 'partial')
  ) THEN
    RAISE EXCEPTION 'Parent test has non-terminal backfill cycles';
  END IF;

  -- Create Round 2 test as draft
  INSERT INTO ab_tests (
    id, site_id, youtube_video_id, source_pipeline_id,
    name, status, config, test_type,
    original_thumbnail_url, original_title, original_description,
    round_number, parent_test_id, playoff_start_after
  ) VALUES (
    v_new_test_id, v_parent.site_id, v_parent.youtube_video_id,
    v_parent.source_pipeline_id,
    v_parent.name || ' — Playoff', 'draft', v_parent.config, v_parent.test_type,
    v_parent.original_thumbnail_url, v_parent.original_title,
    v_parent.original_description,
    2, p_parent_test_id, now() + (p_cooldown_hours * INTERVAL '1 hour')
  );

  -- Copy selected variants — [SECURITY] scoped to parent test
  FOR v_variant IN
    SELECT * FROM ab_test_variants
    WHERE id = ANY(p_variant_ids)
      AND test_id = p_parent_test_id  -- prevents cross-tenant data leak
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
    v_copied := v_copied + 1;
  END LOOP;

  -- [SECURITY] Verify all requested variants were copied (prevents ID spoofing)
  IF v_copied != 2 THEN
    RAISE EXCEPTION 'Expected 2 variants from parent test, found %', v_copied;
  END IF;

  -- Copy tracked links for combo tests (prevents raw {{link:name}} on YouTube)
  INSERT INTO ab_test_tracked_links (ab_test_id, variant_id, link_id, template_name, short_code)
  SELECT v_new_test_id, nv.id, tl.link_id, tl.template_name, tl.short_code
  FROM ab_test_tracked_links tl
  JOIN ab_test_variants nv ON nv.source_variant_id = tl.variant_id
  WHERE tl.ab_test_id = p_parent_test_id
    AND tl.variant_id = ANY(p_variant_ids)
    AND nv.test_id = v_new_test_id;

  -- Link parent → playoff
  UPDATE ab_tests SET playoff_test_id = v_new_test_id WHERE id = p_parent_test_id;

  RETURN v_new_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- [SECURITY] Only service_role can call this RPC
REVOKE EXECUTE ON FUNCTION create_playoff_test FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_playoff_test TO service_role;
```

## Combined P(best) + P(top2) — Single Monte Carlo Pass

New function `calculatePlayoffStats()` in `ab-statistics.ts`. Uses a **single MC loop** to compute both P(best) and P(top2) from the same random samples, eliminating disagreement between separate runs and halving compute:

```typescript
export interface PlayoffMcResult {
  bayesian: BayesianResult
  ptop2: Record<string, number>
}

export function calculatePlayoffStats(variants: VariantStats[]): PlayoffMcResult {
  const wins = new Map<string, number>()
  const top2Counts = new Map<string, number>()
  for (const v of variants) {
    wins.set(v.variant_id, 0)
    top2Counts.set(v.variant_id, 0)
  }

  for (let i = 0; i < MC_SAMPLES; i++) {
    const samples: { id: string; val: number }[] = variants.map(v => ({
      id: v.variant_id,
      val: sampleBeta(v.total_clicks + 1, v.total_impressions - v.total_clicks + 1),
    }))
    samples.sort((a, b) => b.val - a.val)

    // P(best): track #1
    wins.set(samples[0]!.id, (wins.get(samples[0]!.id) ?? 0) + 1)

    // P(top2): track #1 and #2
    top2Counts.set(samples[0]!.id, (top2Counts.get(samples[0]!.id) ?? 0) + 1)
    if (samples[1]) {
      top2Counts.set(samples[1].id, (top2Counts.get(samples[1].id) ?? 0) + 1)
    }
  }

  let winnerId = ''
  let maxWins = 0
  const probabilities: Record<string, number> = {}
  for (const v of variants) {
    const w = wins.get(v.variant_id) ?? 0
    probabilities[v.variant_id] = w / MC_SAMPLES
    if (w > maxWins) { maxWins = w; winnerId = v.variant_id }
  }

  const ptop2: Record<string, number> = {}
  for (const v of variants) {
    ptop2[v.variant_id] = (top2Counts.get(v.variant_id) ?? 0) / MC_SAMPLES
  }

  return {
    bayesian: { winnerId, confidence: probabilities[winnerId] ?? 0, probabilities },
    ptop2,
  }
}
```

This eliminates the dual-MC-run disagreement risk where original could be P(best) in one run but not another.

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

### Cron safety: defense in depth (NO advisory lock)

Advisory locks via Supabase PostgREST are a no-op: each `.rpc()` call gets a different pooled connection, so transaction-scoped locks release immediately. **Do not use them.**

Real concurrency protection (layered):
1. **RPC `FOR UPDATE`** on parent row — serializes concurrent `create_playoff_test()` calls
2. **Unique index `ab_tests_one_playoff_per_parent`** — database-level duplicate prevention
3. **Unique index `ab_test_cycles_test_cycle_unique`** — prevents duplicate cycle 0 from start race
4. **Conditional update** in `startAbTestInternal` (`WHERE status = 'draft'`) — prevents double-start
5. **Graceful error handling** — cron catches unique constraint violations and continues

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

Extract core start logic into a **non-server-action module** `apps/web/src/lib/youtube/ab-start.ts` (NOT in the `'use server'` actions file — exported functions from `'use server'` modules become public HTTP endpoints, bypassing auth).

```typescript
// lib/youtube/ab-start.ts — NOT a server action
export async function startAbTestInternal(
  testId: string,
  siteId: string,
): Promise<{ ok: boolean; error?: string }>
```

Uses **conditional update** (optimistic lock) to prevent race between cron auto-start and user manual start:

```typescript
const { count } = await supabase
  .from('ab_tests')
  .update({ status: 'active', started_at: now, paused_at: null, updated_at: now })
  .eq('id', testId)
  .eq('status', 'draft')  // only if still draft — prevents double-start

if (count === 0) return { ok: false, error: 'Test already started or not in draft' }
```

`startAbTest()` in `actions.ts` becomes a thin wrapper: auth check → import and call `startAbTestInternal()`.

### Cycle dedup index

Add to the migration to prevent duplicate cycle 0 from race conditions:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS ab_test_cycles_test_cycle_unique
  ON ab_test_cycles (test_id, cycle_number);
```

## UI Changes

### Test Detail (completed Round 1 with playoff)

When `test.playoff_test_id` exists:
- Indigo info banner: "Playoff criado — as 2 melhores variantes avançaram para o Round 2" with link
- Styled as info banner (blue/indigo), not destructive

### Test Detail (Round 2 test)

When `test.parent_test_id` exists:
- Badge "Round 2" (indigo) next to status badge
- Link "← Ver Round 1" below test name
- Winner banner (if Round 2 completed): includes "Round 2 winner" label + link back to Round 1

### Dashboard — Drafts section

Round 2 drafts in cooldown (`round_number = 2 AND playoff_start_after`):
- Show "Playoff — início em Xh Ym" instead of "Continue Setup" button
- User cannot edit Round 2 drafts via wizard (already configured by cron)

### Dashboard — Active cards

When `test.round_number === 2`: show indigo "Round 2" badge on `AbTestCard`

### Dashboard — Stats cards

**Exclude Round 1 tests that have a playoff** from stats computation:
- `completedForStats = completed.filter(t => !t.playoff_test_id)`
- Prevents double-counting when both Round 1 (inconclusive) and Round 2 (resolved) exist
- Cross-Test Insights also exclude Round 1 with playoff_test_id

### Dashboard — Completed rows

- "Round" indicator: "1/2" (has playoff) or "2/2" (is playoff) or no indicator (normal)
- Tests with playoff_test_id get visual grouping (Round 2 indented under Round 1)

### Video Picker

When video has a Round 2 draft/active test blocking new test creation:
- Show "Playoff Pending" badge (indigo) instead of generic "Active Test"
- Disable button with tooltip explaining the playoff

### Archive guard

When archiving Round 1 that has a playoff:
- Show confirmation: "Este teste tem um Round 2 associado. Arquivar Round 1 não afeta o Round 2."

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
| `supabase/migrations/YYYYMMDD_playoff_mode.sql` | Schema + RPC + REVOKE + cycle unique index |
| `apps/web/src/lib/youtube/ab-types.ts` | New fields on AbTestRow, PlayoffMcResult type |
| `apps/web/src/lib/youtube/ab-statistics.ts` | Add `calculatePlayoffStats()` (single MC loop for P(best)+P(top2)) |
| `apps/web/src/lib/youtube/ab-playoff.ts` | New module: eligibility check + variant selection |
| `apps/web/src/lib/youtube/ab-start.ts` | New module: `startAbTestInternal()` (NOT in 'use server') |
| `apps/web/src/lib/youtube/notification-service.ts` | Add `playoff_created` type + builder |
| `apps/web/src/app/api/cron/ab-evaluate/route.ts` | Playoff detection + auto-start (no advisory lock) |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` | `startAbTest` wraps `startAbTestInternal`, update `getAbTestsForSite` grouping |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx` | Playoff banner, Round 2 badge/link, winner round context |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard.tsx` | Stats exclude playoff parents, draft cooldown display |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-card.tsx` | Round 2 badge on active cards |
| `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-completed-row.tsx` | Round indicator column |
| `apps/web/test/` | Tests for PlayoffStats, eligibility, selection, notification, start race |

## Invariants

1. A Round 1 test can have AT MOST one playoff (unique index on `parent_test_id`)
2. Round 2 tests NEVER spawn playoffs (`round_number` check in RPC + eligibility)
3. If Round 2 is also inconclusive → completed as-is, variants deemed equivalent
4. Playoff creation is atomic (Postgres RPC transaction with `FOR UPDATE` row lock)
5. No advisory locks — concurrency guarded by unique indexes + conditional updates + `FOR UPDATE`
6. 4h cooldown between Round 1 completion and Round 2 start (~4h-4h05m due to cron interval)
7. Original variant enters Round 2 by merit only (no hardcoded inclusion)
8. P(best) and P(top2) computed from same MC samples (single pass, no disagreement)
9. `startAbTestInternal` lives in `lib/youtube/ab-start.ts`, NOT in a `'use server'` module
10. RPC validates variant ownership (`test_id = p_parent_test_id`) — prevents cross-tenant data leak
11. RPC is `SECURITY DEFINER SET search_path = public` with `REVOKE FROM public/anon/authenticated`
12. Tracked links are copied for combo tests — prevents raw `{{link:name}}` on YouTube
13. Unique index on `(test_id, cycle_number)` prevents duplicate cycles from start race
14. Dashboard stats exclude Round 1 tests with `playoff_test_id` to prevent double-counting

## Known Acceptable Limitations

- Winner's curse: ~0.5pp regression expected in Round 2 (mitigated by Bayesian posterior shrinkage + ABBA rotation)
- Cooldown jitter: 0-5min overshoot due to cron interval (negligible for YouTube algorithm stability)
- Advisory locks not usable via Supabase PostgREST (each request gets a different pooled connection)
