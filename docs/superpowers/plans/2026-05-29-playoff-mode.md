# Playoff Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically create a focused 2-variant Round 2 A/B test when Round 1 ends as inconclusive, using Monte Carlo P(top2) selection and a 4h cooldown before auto-start.

**Architecture:** Extends the existing `ab-evaluate` cron with two new phases: (1) playoff detection that queries inconclusive Round 1 tests, computes P(top2) via Beta-Binomial MC (single pass with P(best)), and calls a hardened transactional Postgres RPC to atomically create the Round 2 test; (2) playoff auto-start that activates draft Round 2 tests past their cooldown. The core `startAbTest` logic is extracted into `lib/youtube/ab-start.ts` (NOT a server action module) with conditional-update optimistic locking.

**Tech Stack:** PostgreSQL (migration + RPC), TypeScript, Next.js server actions, Vitest

**Spec:** `docs/superpowers/specs/2026-05-29-playoff-mode-design.md` (v3 — post-adversarial audit)

**Adversarial audit:** 4 agents reviewed schema security, race conditions, statistical correctness, and UX gaps. 31 findings addressed in this plan.

---

### Task 1: Migration — schema + RPC

**Files:**
- Create: `supabase/migrations/YYYYMMDD_playoff_mode.sql` (use `npm run db:new playoff_mode`)

- [ ] **Step 1: Generate migration file**

```bash
npm run db:new playoff_mode
```

This creates a timestamped file in `supabase/migrations/`.

- [ ] **Step 2: Write the migration SQL**

Write the full migration into the generated file. This is the **hardened** version from the adversarial audit:

```sql
-- Playoff Mode: Round 2 support for AB Lab

-- ab_tests: new columns
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS parent_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS playoff_test_id UUID REFERENCES ab_tests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS playoff_start_after TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ab_tests_one_playoff_per_parent
  ON ab_tests (parent_test_id) WHERE parent_test_id IS NOT NULL;

-- ab_test_variants: track which Round 1 variant was cloned
ALTER TABLE ab_test_variants
  ADD COLUMN IF NOT EXISTS source_variant_id UUID REFERENCES ab_test_variants(id) ON DELETE SET NULL;

-- Prevent duplicate cycles from race conditions (auto-start + user start)
CREATE UNIQUE INDEX IF NOT EXISTS ab_test_cycles_test_cycle_unique
  ON ab_test_cycles (test_id, cycle_number);

-- Transactional RPC — hardened after adversarial audit
CREATE OR REPLACE FUNCTION create_playoff_test(
  p_parent_test_id UUID,
  p_variant_ids UUID[],
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
  IF array_length(p_variant_ids, 1) IS NULL OR array_length(p_variant_ids, 1) != 2 THEN
    RAISE EXCEPTION 'Playoff requires exactly 2 variant IDs, got %',
      coalesce(array_length(p_variant_ids, 1), 0);
  END IF;
  IF EXISTS (
    SELECT 1 FROM ab_tests
    WHERE youtube_video_id = v_parent.youtube_video_id
      AND status IN ('draft', 'active', 'paused')
      AND id != p_parent_test_id
  ) THEN
    RAISE EXCEPTION 'Video already has an active/draft/paused test';
  END IF;
  IF EXISTS (
    SELECT 1 FROM ab_test_cycles
    WHERE test_id = p_parent_test_id
      AND backfill_status IN ('pending', 'partial')
  ) THEN
    RAISE EXCEPTION 'Parent test has non-terminal backfill cycles';
  END IF;

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

  FOR v_variant IN
    SELECT * FROM ab_test_variants
    WHERE id = ANY(p_variant_ids)
      AND test_id = p_parent_test_id
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

  IF v_copied != 2 THEN
    RAISE EXCEPTION 'Expected 2 variants from parent test, found %', v_copied;
  END IF;

  INSERT INTO ab_test_tracked_links (ab_test_id, variant_id, link_id, template_name, short_code)
  SELECT v_new_test_id, nv.id, tl.link_id, tl.template_name, tl.short_code
  FROM ab_test_tracked_links tl
  JOIN ab_test_variants nv ON nv.source_variant_id = tl.variant_id
  WHERE tl.ab_test_id = p_parent_test_id
    AND tl.variant_id = ANY(p_variant_ids)
    AND nv.test_id = v_new_test_id;

  UPDATE ab_tests SET playoff_test_id = v_new_test_id WHERE id = p_parent_test_id;

  RETURN v_new_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION create_playoff_test FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_playoff_test TO service_role;
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/*playoff_mode*
git commit -m "feat(db): playoff mode migration — columns + RPC"
```

---

### Task 2: Types — extend AbTestRow + notification types

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-types.ts:27-50` (AbTestRow)
- Modify: `apps/web/src/lib/youtube/notification-service.ts:1-2` (NotificationType), `notification-service.ts:14` (NOTIFICATION_PRIORITIES), and add builder case

- [ ] **Step 1: Write the failing test for notification type**

Create file `apps/web/test/ab-playoff-notification.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  buildNotification,
  NOTIFICATION_PRIORITIES,
} from '@/lib/youtube/notification-service'

describe('playoff_created notification', () => {
  it('has priority 3', () => {
    expect(NOTIFICATION_PRIORITIES.playoff_created).toBe(3)
  })

  it('builds correct payload', () => {
    const payload = buildNotification({
      type: 'playoff_created',
      videoId: 'vid-1',
      videoTitle: 'My Video Title',
      testName: 'Test: My Video',
      variant1Label: 'B',
      variant2Label: 'C',
      weekIso: '2026-W22',
    })

    expect(payload.type).toBe('playoff_created')
    expect(payload.priority).toBe(3)
    expect(payload.title).toContain('Playoff')
    expect(payload.message).toContain('B')
    expect(payload.message).toContain('C')
    expect(payload.message).toContain('4h')
    expect(payload.dedup_key).toBe('playoff_created:vid-1:2026-W22')
    expect(payload.action_href).toBe('/cms/youtube/ab-lab')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/ab-playoff-notification.test.ts
```

Expected: FAIL — `playoff_created` not in NotificationType.

- [ ] **Step 3: Add playoff fields to AbTestRow**

In `apps/web/src/lib/youtube/ab-types.ts`, add after line 49 (`updated_at: string`):

```typescript
  parent_test_id: string | null
  round_number: number
  playoff_test_id: string | null
  playoff_start_after: string | null
```

- [ ] **Step 4: Add playoff_created to notification-service.ts**

In `apps/web/src/lib/youtube/notification-service.ts`:

Add `'playoff_created'` to the `NotificationType` union (line 2).

Add `playoff_created: 3,` to `NOTIFICATION_PRIORITIES` (after `ab_test_completed`).

Add the interface to `NotificationInput`:

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

Add `| PlayoffCreatedInput` to the `NotificationInput` union.

Add the case in `buildNotification`:

```typescript
    case 'playoff_created':
      return {
        type: input.type,
        priority,
        title: `Playoff criado: ${input.testName}`,
        message: `Playoff: ${input.variant1Label} vs ${input.variant2Label}. Início em 4h.`,
        dedup_key: dedupKey,
        video_id: input.videoId,
        action_href: `/cms/youtube/ab-lab`,
      }
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/web && npx vitest run test/ab-playoff-notification.test.ts
```

Expected: PASS

- [ ] **Step 6: Run existing notification tests to confirm no regression**

```bash
cd apps/web && npx vitest run test/analytics-notification-service.test.ts
```

Expected: all existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/youtube/ab-types.ts apps/web/src/lib/youtube/notification-service.ts apps/web/test/ab-playoff-notification.test.ts
git commit -m "feat(ab-lab): add playoff fields to AbTestRow + playoff_created notification"
```

---

### Task 3: Statistics — calculatePlayoffStats (single MC loop)

**Files:**
- Modify: `apps/web/src/lib/youtube/ab-statistics.ts` (add `calculatePlayoffStats` function)
- Create: test in `apps/web/test/ab-statistics.test.ts` (add new describe block)

The key audit fix: use a **single MC loop** for both P(best) and P(top2), eliminating disagreement risk.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/ab-statistics.test.ts`:

```typescript
import { calculatePlayoffStats } from '@/lib/youtube/ab-statistics'

// ... add after existing describe blocks:

describe('calculatePlayoffStats', () => {
  it('returns both bayesian and ptop2 from same MC samples', () => {
    const variants = [
      makeVariant('A', 3000, 150),
      makeVariant('B', 3000, 210),
      makeVariant('C', 3000, 120),
    ]
    const result = calculatePlayoffStats(variants)

    expect(result.bayesian.winnerId).toBe('B')
    expect(result.bayesian.confidence).toBeGreaterThan(0.5)
    expect(Object.keys(result.ptop2)).toHaveLength(3)

    const ptop2Sum = Object.values(result.ptop2).reduce((a, b) => a + b, 0)
    expect(ptop2Sum).toBeCloseTo(2, 0)
  })

  it('P(best) winner always has highest P(top2)', () => {
    const variants = [
      makeVariant('A', 5000, 500),
      makeVariant('B', 5000, 250),
      makeVariant('C', 5000, 200),
      makeVariant('D', 5000, 150),
    ]
    const result = calculatePlayoffStats(variants)
    expect(result.bayesian.winnerId).toBe('A')
    expect(result.ptop2['A']).toBeGreaterThan(0.95)
  })

  it('weakest variant has lowest P(top2)', () => {
    const variants = [
      makeVariant('A', 5000, 300),
      makeVariant('B', 5000, 350),
      makeVariant('C', 5000, 200),
      makeVariant('D', 5000, 150),
    ]
    const result = calculatePlayoffStats(variants)
    const sorted = Object.entries(result.ptop2).sort((a, b) => a[1] - b[1])
    expect(sorted[0]![0]).toBe('D')
  })

  it('bayesian probabilities sum to 1, ptop2 sums to 2', () => {
    const variants = [
      makeVariant('A', 1000, 50),
      makeVariant('B', 1000, 60),
      makeVariant('C', 1000, 55),
      makeVariant('D', 1000, 45),
    ]
    const result = calculatePlayoffStats(variants)
    const bayesianSum = Object.values(result.bayesian.probabilities).reduce((a, b) => a + b, 0)
    const ptop2Sum = Object.values(result.ptop2).reduce((a, b) => a + b, 0)
    expect(bayesianSum).toBeCloseTo(1, 1)
    expect(ptop2Sum).toBeCloseTo(2, 0)
  })

  it('handles 2 variants — both get P(top2) = 1.0', () => {
    const variants = [
      makeVariant('A', 1000, 50),
      makeVariant('B', 1000, 60),
    ]
    const result = calculatePlayoffStats(variants)
    expect(result.ptop2['A']).toBeCloseTo(1, 1)
    expect(result.ptop2['B']).toBeCloseTo(1, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/ab-statistics.test.ts
```

Expected: FAIL — `calculatePlayoffStats` is not exported from ab-statistics.

- [ ] **Step 3: Implement calculatePlayoffStats**

Add to `apps/web/src/lib/youtube/ab-statistics.ts` after the `calculateBayesianConfidence` function (after line 93). Also add the `PlayoffMcResult` interface export:

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

    wins.set(samples[0]!.id, (wins.get(samples[0]!.id) ?? 0) + 1)
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

Note: `sampleBeta` is already defined as a module-private function in the same file — no export needed. Single MC loop computes both P(best) and P(top2) from same random samples.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/ab-statistics.test.ts
```

Expected: all tests PASS (existing + new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/ab-statistics.ts apps/web/test/ab-statistics.test.ts
git commit -m "feat(ab-lab): add calculatePlayoffStats — single MC loop for P(best)+P(top2)"
```

---

### Task 4: Extract startAbTestInternal to lib/youtube/ab-start.ts

**Files:**
- Create: `apps/web/src/lib/youtube/ab-start.ts` (NOT in `'use server'` module — audit finding #8)
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts:504-576` (startAbTest wraps it)

The core start logic lives in a **non-server-action module** so it's not exposed as a public HTTP endpoint. Uses **conditional update** (`WHERE status = 'draft'`) to prevent race between cron and user.

- [ ] **Step 1: Write the test for startAbTestInternal**

Create file `apps/web/test/ab-start-internal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-rotation', () => ({
  getVariantForCycle: vi.fn(),
}))

import { startAbTestInternal } from '@/lib/youtube/ab-start'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'

beforeEach(() => {
  vi.clearAllMocks()
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 'tok' })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(getVariantForCycle as ReturnType<typeof vi.fn>).mockReturnValue(1)
})

function buildMock(testOverrides: Record<string, unknown> = {}) {
  const updates: { table: string; data: unknown }[] = []
  const inserts: { table: string; data: unknown }[] = []

  const test = {
    id: 'test-1',
    site_id: 'site-1',
    status: 'draft',
    youtube_video_id: 'vid-1',
    ...testOverrides,
  }

  const variants = [
    { id: 'v1', label: 'original', is_original: true, sort_order: 0, blob_url: 'https://blob/a.jpg' },
    { id: 'v2', label: 'B', is_original: false, sort_order: 1, blob_url: 'https://blob/b.jpg' },
  ]

  const fromMock = vi.fn((table: string) => {
    if (table === 'ab_tests') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: test, error: null }),
          }),
        }),
        update: vi.fn((data: unknown) => {
          updates.push({ table, data })
          return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
        }),
      }
    }
    if (table === 'ab_test_variants') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: variants, error: null }),
          }),
        }),
      }
    }
    if (table === 'ab_test_cycles') {
      return {
        insert: vi.fn((data: unknown) => {
          inserts.push({ table, data })
          return { error: null }
        }),
      }
    }
    if (table === 'youtube_videos') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { youtube_video_id: 'YT_ABC' },
              error: null,
            }),
          }),
        }),
      }
    }
    return {}
  })

  const client = { from: fromMock }
  ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue(client)
  return { updates, inserts }
}

describe('startAbTestInternal', () => {
  it('starts a draft test without auth check', async () => {
    const { updates, inserts } = buildMock()
    const result = await startAbTestInternal('test-1', 'site-1')

    expect(result.ok).toBe(true)
    expect(updates.some(u => (u.data as Record<string, unknown>).status === 'active')).toBe(true)
    expect(inserts.some(i => i.table === 'ab_test_cycles')).toBe(true)
  })

  it('returns error if test is not draft', async () => {
    buildMock({ status: 'active' })
    const result = await startAbTestInternal('test-1', 'site-1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('draft')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/ab-start-internal.test.ts
```

Expected: FAIL — `startAbTestInternal` is not exported.

- [ ] **Step 3: Create lib/youtube/ab-start.ts**

Create new file `apps/web/src/lib/youtube/ab-start.ts` (NOT a server action):

```typescript
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { setThumbnail, fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { getVariantForCycle } from '@/lib/youtube/ab-rotation'
import type { AbTestVariantRow } from '@/lib/youtube/ab-types'

async function resolveYouTubeVideoId(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  internalVideoId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('youtube_videos')
    .select('youtube_video_id')
    .eq('id', internalVideoId)
    .single()
  return (data?.youtube_video_id as string | null) ?? null
}

export async function startAbTestInternal(
  testId: string,
  siteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseServiceClient()

  const { data: variants, error: variantsError } = await supabase
    .from('ab_test_variants')
    .select('id, label, is_original, blob_url, sort_order')
    .eq('test_id', testId)
    .order('sort_order', { ascending: true })

  if (variantsError) return { ok: false, error: variantsError.message }
  if (!variants || variants.length < 2) {
    return { ok: false, error: 'A test needs at least 2 variants (original + 1) to start' }
  }

  const firstIndex = getVariantForCycle(variants.length, 0)
  if (firstIndex < 0 || firstIndex >= variants.length) {
    return { ok: false, error: 'Invalid variant rotation index' }
  }
  const firstVariant = variants[firstIndex] as AbTestVariantRow

  // Fetch test and resolve YouTube video ID
  const { data: test } = await supabase
    .from('ab_tests')
    .select('id, site_id, status, youtube_video_id')
    .eq('id', testId)
    .single()

  if (!test) return { ok: false, error: 'Test not found' }
  if (test.status !== 'draft') return { ok: false, error: 'Only draft tests can be started' }
  if ((test.site_id as string) !== siteId) return { ok: false, error: 'site_id mismatch' }

  try {
    const { accessToken } = await ensureFreshToken(siteId, 'youtube')
    const youtubeVideoId = await resolveYouTubeVideoId(supabase, test.youtube_video_id as string)
    if (!youtubeVideoId) return { ok: false, error: 'YouTube video ID not found' }

    if (!firstVariant.is_original && firstVariant.blob_url) {
      const { buffer, contentType } = await fetchVariantImageBuffer(firstVariant.blob_url)
      await setThumbnail(youtubeVideoId, buffer, contentType, accessToken)
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const now = new Date().toISOString()

  // Conditional update: only if still draft (prevents race with concurrent start)
  const { data: updated, count } = await supabase
    .from('ab_tests')
    .update({ status: 'active', started_at: now, paused_at: null, updated_at: now })
    .eq('id', testId)
    .eq('status', 'draft')

  if ((count ?? 0) === 0) return { ok: false, error: 'Test already started or not in draft' }

  const { error: cycleError } = await supabase.from('ab_test_cycles').insert({
    test_id: testId,
    variant_id: firstVariant.id,
    cycle_number: 0,
    started_at: now,
  })

  if (cycleError) return { ok: false, error: cycleError.message }

  return { ok: true }
}
```

- [ ] **Step 3b: Update actions.ts to wrap startAbTestInternal**

In `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts`, replace the `startAbTest` function (lines 504-576) with:

```typescript
import { startAbTestInternal } from '@/lib/youtube/ab-start'

export async function startAbTest(
  testId: string,
): Promise<{ ok: boolean; error?: string }> {
  let siteId: string
  try {
    siteId = await requireEditAccess()
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const result = await startAbTestInternal(testId, siteId)
  if (result.ok) revalidateTag('youtube')
  return result
}
```

Also remove the `resolveYouTubeVideoId` private function from actions.ts (it's now in ab-start.ts). Keep it in actions.ts too if other functions still use it — check for other callers first.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/ab-start-internal.test.ts
```

Expected: PASS

- [ ] **Step 5: Run existing ab-cron tests to confirm no regression**

```bash
cd apps/web && npx vitest run test/ab-cron-evaluate.test.ts
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/youtube/ab-start.ts apps/web/src/app/cms/\(authed\)/youtube/ab-lab/actions.ts apps/web/test/ab-start-internal.test.ts
git commit -m "refactor(ab-lab): extract startAbTestInternal to lib/youtube/ab-start.ts (not server action)"
```

---

### Task 5: Playoff eligibility logic + detection in ab-evaluate

**Files:**
- Create: `apps/web/src/lib/youtube/ab-playoff.ts` (new module: eligibility check + top 2 selection)
- Modify: `apps/web/src/app/api/cron/ab-evaluate/route.ts` (add playoff phases)

This is the core business logic. Keeping it in a separate module makes it testable without mocking the full cron handler.

- [ ] **Step 1: Write the failing tests for playoff eligibility**

Create file `apps/web/test/ab-playoff.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import type { VariantStats } from '@/lib/youtube/ab-types'

function makeVariant(
  id: string,
  impressions: number,
  clicks: number,
  opts: { is_original?: boolean; cycles?: number } = {},
): VariantStats {
  return {
    variant_id: id,
    label: id,
    blob_url: null,
    title_text: null,
    description_text: null,
    metadata: {},
    is_original: opts.is_original ?? false,
    total_impressions: impressions,
    total_clicks: clicks,
    avg_ctr: impressions > 0 ? clicks / impressions : 0,
    cycles_completed: opts.cycles ?? 4,
  }
}

describe('checkPlayoffEligibility', () => {
  const baseTest = {
    completed_reason: 'inconclusive' as const,
    test_type: 'thumbnail' as const,
    round_number: 1,
    parent_test_id: null,
    playoff_test_id: null,
    started_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  }

  const baseVariants = [
    makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
    makeVariant('B', 3000, 210, { cycles: 4 }),
    makeVariant('C', 3000, 180, { cycles: 4 }),
    makeVariant('D', 3000, 120, { cycles: 4 }),
  ]

  it('returns eligible for valid inconclusive thumbnail test', () => {
    const result = checkPlayoffEligibility(baseTest, baseVariants, true)
    expect(result.eligible).toBe(true)
  })

  it('rejects non-inconclusive test', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, completed_reason: 'auto_resolve' as const },
      baseVariants,
      true,
    )
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('inconclusive')
  })

  it('rejects title-only test type', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, test_type: 'title' as const },
      baseVariants,
      true,
    )
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('type')
  })

  it('rejects round 2 test', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, round_number: 2, parent_test_id: 'parent-1' },
      baseVariants,
      true,
    )
    expect(result.eligible).toBe(false)
  })

  it('rejects when playoff already exists', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, playoff_test_id: 'existing-playoff' },
      baseVariants,
      true,
    )
    expect(result.eligible).toBe(false)
  })

  it('rejects fewer than 3 non-original variants with data', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 3000, 180, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('3 non-original')
  })

  it('rejects when avg daily impressions < 500', () => {
    const lowTraffic = [
      makeVariant('orig', 300, 15, { is_original: true, cycles: 4 }),
      makeVariant('B', 300, 21, { cycles: 4 }),
      makeVariant('C', 300, 18, { cycles: 4 }),
      makeVariant('D', 300, 12, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, lowTraffic, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('impressions')
  })

  it('rejects when cycles not fully backfilled', () => {
    const result = checkPlayoffEligibility(baseTest, baseVariants, false)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('backfill')
  })

  it('rejects when any variant has < 2 cycles', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 3000, 180, { cycles: 1 }),
      makeVariant('D', 3000, 120, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('cycles')
  })

  it('rejects when any variant has < 200 impressions', () => {
    const variants = [
      makeVariant('orig', 3000, 150, { is_original: true, cycles: 4 }),
      makeVariant('B', 3000, 210, { cycles: 4 }),
      makeVariant('C', 150, 10, { cycles: 4 }),
      makeVariant('D', 3000, 120, { cycles: 4 }),
    ]
    const result = checkPlayoffEligibility(baseTest, variants, true)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('200 impressions')
  })

  it('accepts combo test type', () => {
    const result = checkPlayoffEligibility(
      { ...baseTest, test_type: 'combo' as const },
      baseVariants,
      true,
    )
    expect(result.eligible).toBe(true)
  })
})

describe('selectPlayoffVariants', () => {
  it('selects top 2 by P(top2)', () => {
    const variants = [
      makeVariant('orig', 5000, 250, { is_original: true }),
      makeVariant('B', 5000, 350, {}),
      makeVariant('C', 5000, 300, {}),
      makeVariant('D', 5000, 200, {}),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).not.toBeNull()
    expect(result!.variantIds).toHaveLength(2)
    // B should always be selected (highest CTR)
    expect(result!.variantIds).toContain('B')
  })

  it('returns null when original is P(best)', () => {
    const variants = [
      makeVariant('orig', 5000, 500, { is_original: true }),
      makeVariant('B', 5000, 250, {}),
      makeVariant('C', 5000, 200, {}),
      makeVariant('D', 5000, 150, {}),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).toBeNull()
  })

  it('returns null when P(top2) gap between 2nd and 3rd < 5pp', () => {
    // All very similar CTRs — gap will be small
    const variants = [
      makeVariant('orig', 5000, 250, { is_original: true }),
      makeVariant('B', 5000, 255, {}),
      makeVariant('C', 5000, 253, {}),
      makeVariant('D', 5000, 252, {}),
    ]
    const result = selectPlayoffVariants(variants)
    expect(result).toBeNull()
  })

  it('includes original in top 2 if it earns its way', () => {
    // orig is 2nd best
    const variants = [
      makeVariant('orig', 5000, 350, { is_original: true }),
      makeVariant('B', 5000, 400, {}),
      makeVariant('C', 5000, 200, {}),
      makeVariant('D', 5000, 150, {}),
    ]
    const result = selectPlayoffVariants(variants)
    if (result) {
      // orig should NOT be P(best), so playoff is valid
      // But orig might be top 2
      expect(result.variantIds).toContain('B')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/ab-playoff.test.ts
```

Expected: FAIL — module `@/lib/youtube/ab-playoff` does not exist.

- [ ] **Step 3: Implement the playoff eligibility module**

Create `apps/web/src/lib/youtube/ab-playoff.ts`:

```typescript
import type { VariantStats, CompletedReason, TestType } from './ab-types'
import { calculatePlayoffStats } from './ab-statistics'

interface PlayoffTestInfo {
  completed_reason: CompletedReason | null
  test_type: TestType
  round_number: number
  parent_test_id: string | null
  playoff_test_id: string | null
  started_at: string | null
}

interface EligibilityResult {
  eligible: boolean
  reason?: string
}

export function checkPlayoffEligibility(
  test: PlayoffTestInfo,
  variants: VariantStats[],
  allCyclesBackfilled: boolean,
): EligibilityResult {
  if (test.completed_reason !== 'inconclusive') {
    return { eligible: false, reason: 'Only inconclusive tests are eligible' }
  }

  if (test.test_type !== 'thumbnail' && test.test_type !== 'combo') {
    return { eligible: false, reason: 'Only thumbnail/combo type eligible' }
  }

  if (test.round_number !== 1 || test.parent_test_id !== null) {
    return { eligible: false, reason: 'Only Round 1 tests can spawn playoffs' }
  }

  if (test.playoff_test_id !== null) {
    return { eligible: false, reason: 'Playoff already exists' }
  }

  if (!allCyclesBackfilled) {
    return { eligible: false, reason: 'All cycles must be in terminal backfill status' }
  }

  const nonOriginalWithData = variants.filter(v => !v.is_original && v.total_impressions > 0)
  if (nonOriginalWithData.length < 3) {
    return { eligible: false, reason: 'Need ≥ 3 non-original variants with data' }
  }

  for (const v of variants) {
    if (v.cycles_completed < 2) {
      return { eligible: false, reason: `Variant ${v.label} has < 2 confirmed cycles` }
    }
    if (v.total_impressions < 200) {
      return { eligible: false, reason: `Variant ${v.label} has < 200 impressions` }
    }
  }

  const totalImpressions = variants.reduce((s, v) => s + v.total_impressions, 0)
  const startedAt = test.started_at ? new Date(test.started_at) : null
  const daysSinceStart = startedAt
    ? (Date.now() - startedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 1
  const avgDailyImpressions = daysSinceStart > 0 ? totalImpressions / daysSinceStart : 0
  if (avgDailyImpressions < 500) {
    return { eligible: false, reason: `Avg daily impressions ${Math.round(avgDailyImpressions)} < 500` }
  }

  return { eligible: true }
}

interface PlayoffSelection {
  variantIds: [string, string]
  labels: [string, string]
  ptop2: Record<string, number>
}

export function selectPlayoffVariants(
  variants: VariantStats[],
): PlayoffSelection | null {
  if (variants.length < 4) return null

  const { bayesian, ptop2 } = calculatePlayoffStats(variants)
  const originalVariant = variants.find(v => v.is_original)

  if (originalVariant && bayesian.winnerId === originalVariant.variant_id) {
    return null
  }

  const sorted = [...variants]
    .sort((a, b) => {
      const diff = (ptop2[b.variant_id] ?? 0) - (ptop2[a.variant_id] ?? 0)
      if (Math.abs(diff) > 0.0001) return diff
      if (a.total_impressions !== b.total_impressions) {
        return b.total_impressions - a.total_impressions
      }
      return (a.is_original ? 999 : 0) - (b.is_original ? 999 : 0)
    })

  const top2 = sorted.slice(0, 2)
  const third = sorted[2]

  if (!top2[0] || !top2[1] || !third) return null

  const secondPtop2 = ptop2[top2[1].variant_id] ?? 0
  const thirdPtop2 = ptop2[third.variant_id] ?? 0

  if (secondPtop2 - thirdPtop2 < 0.05) {
    return null
  }

  return {
    variantIds: [top2[0].variant_id, top2[1].variant_id],
    labels: [top2[0].label, top2[1].label],
    ptop2,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run test/ab-playoff.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/youtube/ab-playoff.ts apps/web/test/ab-playoff.test.ts
git commit -m "feat(ab-lab): playoff eligibility + P(top2) variant selection"
```

---

### Task 6: Wire playoff phases into ab-evaluate cron

**Files:**
- Modify: `apps/web/src/app/api/cron/ab-evaluate/route.ts`

This task adds three things to the cron:
1. Advisory lock at the top
2. Playoff auto-start phase (before evaluation loop)
3. Playoff detection phase (after evaluation loop)

- [ ] **Step 1: Write the tests for playoff cron phases**

Create file `apps/web/test/ab-cron-playoff.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase/service', () => ({ getSupabaseServiceClient: vi.fn() }))
vi.mock('@/lib/social/token-refresh', () => ({ ensureFreshToken: vi.fn() }))
vi.mock('@/lib/youtube/ab-statistics', () => ({
  calculateBayesianConfidence: vi.fn(),
  calculatePTop2: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-youtube', () => ({
  setThumbnail: vi.fn(),
  fetchVariantImageBuffer: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-metadata', () => ({ updateVideoMetadata: vi.fn() }))
vi.mock('@/lib/youtube/ab-templates', () => ({ resolveTemplates: vi.fn() }))
vi.mock('@/lib/youtube/notification-service', () => ({
  buildNotification: vi.fn(() => ({
    type: 'playoff_created',
    priority: 3,
    title: 'Playoff',
    message: 'B vs C',
    dedup_key: 'k',
    video_id: null,
    action_href: null,
  })),
}))
vi.mock('@/lib/youtube/analytics-sync', () => ({ getIsoWeek: vi.fn(() => '2026-W22') }))
vi.mock('@/lib/youtube/ab-playoff', () => ({
  checkPlayoffEligibility: vi.fn(),
  selectPlayoffVariants: vi.fn(),
}))
vi.mock('@/lib/youtube/ab-start', () => ({
  startAbTestInternal: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

import { GET } from '@/app/api/cron/ab-evaluate/route'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { ensureFreshToken } from '@/lib/social/token-refresh'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { calculateBayesianConfidence } from '@/lib/youtube/ab-statistics'
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import { startAbTestInternal } from '@/lib/youtube/ab-start'

function createCronRequest() {
  return new NextRequest(new URL('http://localhost:3000/api/cron/ab-evaluate'), {
    headers: { authorization: 'Bearer test-secret' },
  })
}

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.clearAllMocks()
  ;(ensureFreshToken as ReturnType<typeof vi.fn>).mockResolvedValue({ accessToken: 'tok' })
  ;(fetchVariantImageBuffer as ReturnType<typeof vi.fn>).mockResolvedValue({
    buffer: Buffer.from('img'),
    contentType: 'image/jpeg',
  })
  ;(calculateBayesianConfidence as ReturnType<typeof vi.fn>).mockReturnValue({
    winnerId: 'v2',
    confidence: 0.65,
    probabilities: { v1: 0.35, v2: 0.65 },
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('ab-evaluate: playoff auto-start', () => {
  it('starts Round 2 drafts past their cooldown', async () => {
    const playoffDraft = {
      id: 'playoff-1',
      site_id: 'site-1',
      status: 'draft',
      round_number: 2,
      parent_test_id: 'parent-1',
      playoff_start_after: new Date(Date.now() - 60000).toISOString(),
    }

    const rpcMock = vi.fn().mockResolvedValue({ data: true, error: null })
    const fromCalls: Record<string, unknown[]> = {}

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols.includes('round_number')) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockReturnValue({
                      not: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({
                          data: [playoffDraft],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }
            }
            return {
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    })
    ;(startAbTestInternal as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })

    const req = createCronRequest()
    const res = await GET(req)
    const body = await res.json()

    expect(startAbTestInternal).toHaveBeenCalledWith('playoff-1', 'site-1')
    expect(body.playoffs_started).toBe(1)
  })
})

describe('ab-evaluate: playoff detection', () => {
  it('creates playoff when eligibility passes and variants selected', async () => {
    const inconclusiveTest = {
      id: 'test-1',
      site_id: 'site-1',
      youtube_video_id: 'vid-1',
      name: 'Test: Video',
      completed_reason: 'inconclusive',
      test_type: 'thumbnail',
      round_number: 1,
      parent_test_id: null,
      playoff_test_id: null,
      started_at: new Date(Date.now() - 15 * 86400000).toISOString(),
      variants: [
        { id: 'v1', label: 'original', is_original: true, sort_order: 0 },
        { id: 'v2', label: 'B', is_original: false, sort_order: 1 },
        { id: 'v3', label: 'C', is_original: false, sort_order: 2 },
        { id: 'v4', label: 'D', is_original: false, sort_order: 3 },
      ],
      cycles: Array.from({ length: 20 }, (_, i) => ({
        id: `c${i}`,
        variant_id: ['v1', 'v2', 'v3', 'v4'][i % 4],
        cycle_number: i,
        backfill_status: 'confirmed',
        impressions: 2000,
        clicks: [100, 140, 120, 80][i % 4],
        ended_at: new Date().toISOString(),
      })),
    }

    ;(checkPlayoffEligibility as ReturnType<typeof vi.fn>).mockReturnValue({ eligible: true })
    ;(selectPlayoffVariants as ReturnType<typeof vi.fn>).mockReturnValue({
      variantIds: ['v2', 'v3'],
      labels: ['B', 'C'],
      ptop2: { v1: 0.3, v2: 0.9, v3: 0.6, v4: 0.2 },
    })

    const rpcMock = vi.fn().mockResolvedValue({ data: 'new-playoff-id', error: null })

    const fromMock = vi.fn((table: string) => {
      if (table === 'ab_tests') {
        return {
          select: vi.fn().mockImplementation((cols: string) => {
            if (cols.includes('round_number')) {
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockReturnValue({
                      not: vi.fn().mockReturnValue({
                        lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              }
            }
            if (cols.includes('variants')) {
              return {
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }
            }
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      is: vi.fn().mockReturnValue({
                        is: vi.fn().mockResolvedValue({
                          data: [inconclusiveTest],
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }
          }),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      }
    })

    ;(getSupabaseServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: fromMock,
      rpc: rpcMock,
    })

    const req = createCronRequest()
    const res = await GET(req)
    const body = await res.json()

    expect(rpcMock).toHaveBeenCalledWith('create_playoff_test', {
      p_parent_test_id: 'test-1',
      p_variant_ids: ['v2', 'v3'],
      p_cooldown_hours: 4,
    })
    expect(body.playoffs_created).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/web && npx vitest run test/ab-cron-playoff.test.ts
```

Expected: FAIL — cron doesn't have playoff phases yet.

- [ ] **Step 3: Modify the ab-evaluate cron handler**

In `apps/web/src/app/api/cron/ab-evaluate/route.ts`, add the new imports and phases. The full modified file structure:

**New imports (add at the top):**

```typescript
import { checkPlayoffEligibility, selectPlayoffVariants } from '@/lib/youtube/ab-playoff'
import { startAbTestInternal } from '@/lib/youtube/ab-start'
import type { AbTestVariantRow, AbTestCycleRow, VariantStats, AbTestConfig, BackfillStatus } from '@/lib/youtube/ab-types'
```

(The `BackfillStatus` import is new; the rest are already imported.)

**NO advisory lock** — per audit, advisory locks via Supabase PostgREST are no-ops (each HTTP request gets a different pooled connection). Concurrency is guarded by the RPC's `FOR UPDATE` + unique index + conditional updates.

**Phase 1: Playoff auto-start (BEFORE the active tests loop, after lock):**

```typescript
  // Phase 1: Auto-start Round 2 drafts past cooldown
  let playoffsStarted = 0
  {
    const { data: pendingPlayoffs } = await supabase
      .from('ab_tests')
      .select('id, site_id, round_number, parent_test_id, playoff_start_after')
      .eq('status', 'draft')
      .eq('round_number', 2)
      .not('parent_test_id', 'is', null)
      .not('playoff_start_after', 'is', null)
      .lte('playoff_start_after', new Date().toISOString())

    for (const playoff of pendingPlayoffs ?? []) {
      try {
        const result = await startAbTestInternal(playoff.id as string, playoff.site_id as string)
        if (result.ok) playoffsStarted++
      } catch (err) {
        Sentry.captureException(err, {
          tags: { cron: 'ab-evaluate', phase: 'playoff-start' },
          extra: { testId: playoff.id },
        })
      }
    }
  }
```

**Phase 3: Playoff detection (AFTER the existing evaluation loop, before the final return):**

```typescript
  // Phase 3: Detect inconclusive Round 1 tests eligible for playoff
  let playoffsCreated = 0
  {
    const { data: candidates } = await supabase
      .from('ab_tests')
      .select(`
        *,
        variants:ab_test_variants!test_id(*),
        cycles:ab_test_cycles(*)
      `)
      .eq('status', 'completed')
      .eq('completed_reason', 'inconclusive')
      .in('test_type', ['thumbnail', 'combo'])
      .eq('round_number', 1)
      .is('parent_test_id', null)
      .is('playoff_test_id', null)

    for (const candidate of candidates ?? []) {
      try {
        const variants = (candidate.variants as AbTestVariantRow[]).sort(
          (a, b) => a.sort_order - b.sort_order,
        )
        const allCycles = (candidate.cycles as AbTestCycleRow[])
        const terminalStatuses: BackfillStatus[] = ['confirmed', 'no_data', 'error']
        const allBackfilled = allCycles.every(c =>
          terminalStatuses.includes(c.backfill_status),
        )

        const confirmedCycles = allCycles.filter(c => c.backfill_status === 'confirmed')
        const variantStats: VariantStats[] = variants.map(v => {
          const vCycles = confirmedCycles.filter(c => c.variant_id === v.id)
          const totalImpressions = vCycles.reduce((s, c) => s + (c.impressions ?? 0), 0)
          const totalClicks = vCycles.reduce((s, c) => s + (c.clicks ?? 0), 0)
          return {
            variant_id: v.id,
            label: v.label,
            blob_url: v.blob_url,
            title_text: v.title_text ?? null,
            description_text: v.description_text ?? null,
            metadata: v.metadata ?? {},
            is_original: v.is_original,
            total_impressions: totalImpressions,
            total_clicks: totalClicks,
            avg_ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
            cycles_completed: vCycles.length,
          }
        })

        const eligibility = checkPlayoffEligibility(
          {
            completed_reason: candidate.completed_reason,
            test_type: candidate.test_type,
            round_number: candidate.round_number ?? 1,
            parent_test_id: candidate.parent_test_id ?? null,
            playoff_test_id: candidate.playoff_test_id ?? null,
            started_at: candidate.started_at,
          },
          variantStats,
          allBackfilled,
        )

        if (!eligibility.eligible) continue

        const selection = selectPlayoffVariants(variantStats)
        if (!selection) continue

        const { error: rpcError } = await supabase.rpc('create_playoff_test', {
          p_parent_test_id: candidate.id,
          p_variant_ids: selection.variantIds,
          p_cooldown_hours: 4,
        })

        if (rpcError) {
          Sentry.captureException(new Error(rpcError.message), {
            tags: { cron: 'ab-evaluate', phase: 'playoff-create' },
            extra: { testId: candidate.id },
          })
          continue
        }

        const weekIso = getIsoWeek(new Date())
        const notifPayload = buildNotification({
          type: 'playoff_created',
          videoId: candidate.youtube_video_id as string,
          videoTitle: candidate.name ?? 'Vídeo',
          testName: candidate.name ?? 'A/B Test',
          variant1Label: selection.labels[0],
          variant2Label: selection.labels[1],
          weekIso,
        })

        await supabase.rpc('create_yt_notification', {
          p_site_id: candidate.site_id,
          p_type: notifPayload.type,
          p_priority: notifPayload.priority,
          p_title: notifPayload.title,
          p_message: notifPayload.message,
          p_dedup_key: notifPayload.dedup_key,
          p_video_id: notifPayload.video_id ?? null,
          p_ab_test_id: candidate.id,
          p_action_href: notifPayload.action_href ?? null,
        })

        playoffsCreated++
      } catch (err) {
        Sentry.captureException(err, {
          tags: { cron: 'ab-evaluate', phase: 'playoff-detect' },
          extra: { testId: candidate.id },
        })
      }
    }
  }
```

**Update the return statement:**

```typescript
  return Response.json({ status: 'ok', evaluated, resolved, playoffs_started: playoffsStarted, playoffs_created: playoffsCreated })
```

- [ ] **Step 4: Run the new playoff cron tests**

```bash
cd apps/web && npx vitest run test/ab-cron-playoff.test.ts
```

Expected: PASS

- [ ] **Step 5: Run existing cron tests to confirm no regression**

```bash
cd apps/web && npx vitest run test/ab-cron-evaluate.test.ts
```

Expected: all PASS (existing tests should still pass — they don't query for playoff candidates).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/api/cron/ab-evaluate/route.ts apps/web/test/ab-cron-playoff.test.ts
git commit -m "feat(ab-lab): wire playoff detection + auto-start into ab-evaluate cron"
```

---

### Task 7: UI — playoff banner on test detail

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-detail.tsx`

- [ ] **Step 1: Add playoff banner for Round 1 tests with playoff**

In `ab-test-detail.tsx`, add after the status badges section (after the `<div className="flex flex-wrap items-center gap-3">...</div>` block, around line 280):

```tsx
      {/* Playoff banner: Round 1 completed with playoff created */}
      {test.playoff_test_id && (
        <div className="flex items-center gap-3 rounded-[var(--cms-radius)] border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400 shrink-0" aria-hidden="true">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6.5 6 6.5 6S7 4 9.5 4a2.5 2.5 0 0 1 0 5H8" />
            <path d="M6 9h12l-1.5 8H7.5L6 9z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-300">Playoff criado</p>
            <p className="text-xs text-indigo-400/70">As 2 melhores variantes avançaram para o Round 2</p>
          </div>
          <Link
            href={`/cms/youtube/ab-lab/${test.playoff_test_id}`}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 shrink-0"
          >
            Ver Round 2 →
          </Link>
        </div>
      )}

      {/* Round 2 badge + link back to Round 1 */}
      {test.parent_test_id && (
        <div className="flex items-center gap-3 rounded-[var(--cms-radius)] border border-cms-border bg-cms-surface px-4 py-2">
          <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">
            Round 2
          </span>
          <Link
            href={`/cms/youtube/ab-lab/${test.parent_test_id}`}
            className="text-xs text-cms-text-muted hover:text-cms-text"
          >
            ← Ver Round 1
          </Link>
        </div>
      )}
```

- [ ] **Step 2: Verify in browser**

Start the dev server and navigate to an A/B test detail page. The banners won't appear on existing tests (since no playoffs exist yet), but the code should not break the existing layout.

```bash
cd apps/web && npm run dev
```

Navigate to `/cms/youtube/ab-lab/{any-test-id}` and verify the page loads without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/_components/ab-test-detail.tsx
git commit -m "feat(ab-lab): playoff banner + Round 2 badge on test detail"
```

---

### Task 8: UI — Round column on dashboard completed rows

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/ab-test-completed-row.tsx`

- [ ] **Step 1: Add Round indicator to completed row**

In `ab-test-completed-row.tsx`, add a round indicator in the right-side stats area. After the Confidence column (around line 79), add:

```tsx
        {(test.playoff_test_id || test.parent_test_id) && (
          <div className="text-right">
            <p className="text-xs text-cms-text-muted">Round</p>
            <p className="text-xs font-medium text-indigo-400">
              {test.parent_test_id ? '2/2' : '1/2'}
            </p>
          </div>
        )}
```

Note: The `AbTestWithVariants` type extends `AbTestRow` which now has `parent_test_id`, `playoff_test_id`, `round_number`. No prop changes needed.

- [ ] **Step 2: Verify in browser**

Navigate to `/cms/youtube/ab-lab` and verify the completed tests section renders without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/_components/ab-test-completed-row.tsx
git commit -m "feat(ab-lab): round indicator on completed test rows"
```

---

### Task 9: Update getAbTestsForSite to group playoffs

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/ab-lab/actions.ts` (getAbTestsForSite)

- [ ] **Step 1: Update the query to include playoff fields**

The existing Supabase `select('*')` already includes all columns, so the new `parent_test_id`, `round_number`, `playoff_test_id`, and `playoff_start_after` fields will be returned automatically. No query change needed — just verify the TypeScript types are satisfied (they will be, since we updated `AbTestRow` in Task 2).

- [ ] **Step 2: Sort completed tests to group playoffs under their parent**

In `getAbTestsForSite`, modify the completed list to sort Round 2 tests immediately after their parent. Replace the `return` statement:

```typescript
  const active = all.filter(t => t.status === 'active')
  const drafts = all.filter(t => t.status === 'draft')
  const completedRaw = all.filter(t => t.status === 'completed' || t.status === 'paused')

  const completedGrouped: AbTestWithVariants[] = []
  const round2Map = new Map<string, AbTestWithVariants>()
  for (const t of completedRaw) {
    if (t.parent_test_id) {
      round2Map.set(t.parent_test_id, t)
    }
  }
  for (const t of completedRaw) {
    if (t.parent_test_id) continue
    completedGrouped.push(t)
    const playoff = round2Map.get(t.id)
    if (playoff) completedGrouped.push(playoff)
  }

  return { active, draft: drafts, completed: completedGrouped }
```

- [ ] **Step 3: Run existing tests**

```bash
cd apps/web && npx vitest run test/ab-cron-evaluate.test.ts test/ab-start-internal.test.ts
```

Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/cms/\(authed\)/youtube/ab-lab/actions.ts
git commit -m "feat(ab-lab): group playoff tests under parent in dashboard"
```

---

### Task 10: Build verification + push

**Files:** None (verification only)

- [ ] **Step 1: Build workspace packages**

```bash
npm run build:packages
```

Expected: success

- [ ] **Step 2: Run all AB Lab tests**

```bash
cd apps/web && npx vitest run test/ab-statistics.test.ts test/ab-cron-evaluate.test.ts test/ab-playoff.test.ts test/ab-cron-playoff.test.ts test/ab-playoff-notification.test.ts test/ab-start-internal.test.ts test/analytics-notification-service.test.ts
```

Expected: all PASS

- [ ] **Step 3: Run full web test suite**

```bash
npm run test:web
```

Expected: all PASS

- [ ] **Step 4: Run Next.js build**

```bash
cd apps/web && npx next build
```

Expected: success

- [ ] **Step 5: Push migration to prod**

```bash
npm run db:push:prod
```

Type `YES` when prompted. Expected: migration applied successfully.

- [ ] **Step 6: Final commit (if any fixups needed) + push**

```bash
git push origin main
```
