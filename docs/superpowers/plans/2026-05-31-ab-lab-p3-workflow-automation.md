# AB Lab P3: Workflow Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zero manual effort for the common test lifecycle — winners auto-applied within 25h, relevant suggestions scored and ranked, batch start with stagger.

**Architecture:** State machine for auto-apply (grace_pending → applying → applied/failed). Scoring formula for suggestions with DB-level filters. Queue system with `queue_start_after` for staggered batch starts.

**Tech Stack:** Next.js 15 API routes, Supabase PostgreSQL, YouTube Data API v3, Vitest, existing `ab-evaluate` cron + `setThumbnail`/`updateVideoMetadata` helpers.

---

## Task Overview

| Task | Feature | Files | Independent? |
|------|---------|-------|-------------|
| 1 | Migration (grace columns + queue) | migration SQL | Yes |
| 2 | Auto-apply state machine logic | ab-evaluate cron | Needs 1 |
| 3 | Grace period UI (apply now / cancel) | active-detail.tsx + actions.ts | Needs 1 |
| 4 | Revert action (7-day window) | actions.ts + UI | Needs 2 |
| 5 | Auto-suggest scoring formula | queries.ts | Yes |
| 6 | Batch start with stagger | actions.ts + ab-rotate | Needs 1 |
| 7 | Integration + tests + push | all | Needs all |

**Parallelizable:** Tasks 1, 5 (independent). Then Tasks 2, 3, 6 (need 1). Then Tasks 4, 7.

---

### Task 1: Migration — grace period + queue columns

```sql
-- Auto-apply grace period columns
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS grace_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS winner_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS applied_by text CHECK (applied_by IN ('auto','manual')),
  ADD COLUMN IF NOT EXISTS apply_attempts integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_apply_error text,
  ADD COLUMN IF NOT EXISTS revert_expires_at timestamptz;

-- Batch start queue column
ALTER TABLE ab_tests
  ADD COLUMN IF NOT EXISTS queue_start_after timestamptz;

-- Index for grace period queries
CREATE INDEX IF NOT EXISTS idx_ab_tests_grace_pending
ON ab_tests (grace_expires_at) WHERE status = 'completed' AND grace_expires_at IS NOT NULL AND winner_applied_at IS NULL;

-- Index for queued tests
CREATE INDEX IF NOT EXISTS idx_ab_tests_queued
ON ab_tests (queue_start_after) WHERE status = 'queued' AND queue_start_after IS NOT NULL;
```

---

### Task 2: Auto-apply state machine in ab-evaluate

Modify `src/app/api/cron/ab-evaluate/route.ts`:

When all gates pass + `auto_apply_winner=true`:
1. If `grace_expires_at IS NULL`: set `grace_expires_at = now() + 24h`, send "winner pending" notification, DO NOT apply yet
2. If `grace_expires_at <= now()`: proceed with applying winner (existing logic)
3. If confidence drops during grace (stability resets): clear `grace_expires_at`, resume evaluation

After apply succeeds: set `winner_applied_at`, `applied_by = 'auto'`, `revert_expires_at = now() + 7d`

Retry logic: if YouTube API fails, increment `apply_attempts`. Retry schedule: 1h, 4h, 12h (check `apply_attempts` to determine next retry). After 3 failures: `last_apply_error`, notify "apply_failed".

---

### Task 3: Grace period UI

In `active-detail.tsx` (or a new winner-pending component):
- Show countdown to auto-apply: "Vencedor será aplicado em Xh"
- "Aplicar Agora" button → calls applyWinner action (sets `winner_applied_at`, `applied_by = 'manual'`)
- "Cancelar" button → clears `grace_expires_at`, returns test to completed-no-apply state

---

### Task 4: Revert action (7-day window)

In `actions.ts`:
- `revertWinner(testId)`: restores original thumbnail/title/description from `original_thumbnail_url` + `original_title`/`original_description`
- Only available when `revert_expires_at > now()`
- Uses same `setThumbnail`/`updateVideoMetadata` helpers with pre-flight check
- Sets `winner_applied_at = null`, `revert_expires_at = null`

UI: "Reverter" button on completed test detail, visible only during revert window.

---

### Task 5: Auto-suggest scoring formula

Replace current simple ratio logic in `getSuggestedVideos` with:

```
score = impressions × (1 - CTR / channel_avg_CTR_28d)
```

DB filters:
- `published_at < now() - 14 days` (age > 14d)
- `view_count >= 1000`
- No test in last 60 days (check `ab_tests` for same video)

Boosts:
- P4 fatigue (future): +0.3 priority
- P2 outlier < 0.5x: +0.2 priority

Sort by score DESC, limit 5.

---

### Task 6: Batch start with stagger

New action `batchStartTests(videoIds: string[])`:
- Validates 2-5 videos, checks eligibility per video
- First video starts immediately (calls `startAbTestInternal`)
- Remaining get `status = 'queued'`, `queue_start_after` staggered 1 day apart

In `ab-rotate` cron: add check for queued tests whose `queue_start_after <= now()` → transition to active via `startAbTestInternal`.

UI: "Iniciar Lote" button on suggestions section, multi-select suggested videos.

---

### Task 7: Integration + tests + push

- Tests for auto-apply state machine (grace, retry, apply, revert)
- Tests for new suggestion scoring
- Tests for batch start + stagger
- Full build + push
