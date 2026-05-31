# AB Lab Observatory — Design Spec

> **Date:** 2026-05-31
> **Status:** Approved
> **Research:** 3 rounds of recursive critique, 42 AI agents, ~800K tokens of analysis
> **Scope:** P1-P4 CORE (~85h) | P5-P6 PROVISIONAL (~35h, decision-gated)

## 1. Overview

The AB Lab Observatory transforms the YouTube AB Lab from a basic A/B testing tool into a complete thumbnail and title optimization system with reliability infrastructure, live data streaming, workflow automation, statistical insights, competitor tracking, and thumbnail intelligence.

**Competitive positioning:** Beats TubeBuddy ($49/mo, 2 variants, z-test) on multi-variant ABBA + Bayesian. Beats ThumbnailTest ($29/mo, Chrome extension dependency) on server-side analytics. Beats vidIQ (no AB testing). Beats ViewStats (observation only, $50/mo). Free, combo testing (title × thumbnail), tracked links.

**Scope:** 6 phases. P1-P4 are CORE (~85h). P5-P6 are PROVISIONAL with explicit decision gates.

## 2. Navigation Restructure

**Current (5 sections):** Overview, Content, Library, Social, People. YouTube config buried in Settings. A/B Lab hidden behind tab.

**New (7 sections):**

| Section | Items | Changes |
|---------|-------|---------|
| **HUB** (4) | Dashboard, Up Next, Schedule, Notificações | Renamed from "Overview" |
| **CONTENT** (6) | Blog, Pipeline, Courses, Newsletters, Campaigns, Playlists | "Video" → "Pipeline" |
| **LIBRARY** (3) | Research, Reference, Media | Audio removed (doesn't exist) |
| **YOUTUBE** (4→6) | Channels, Videos, A/B Lab, Performance | "Analytics" → "Performance". Future: +Competitors (P5), +Thumbnails (P6) |
| **SOCIAL** (2) | Posts, Links | YouTube removed to own section |
| **AUDIENCE** (3) | Authors, Subscribers, Contacts | Renamed from "People" |
| **Settings** | Gear icon in sidebar footer | YouTube/Instagram config removed |

**Key moves:** Categories → inside Channels config. YouTube channel config → Channels page. A/B Lab settings (gear drawer) → Channels page.

---

## Phase 1: Reliability (~28h)

**Goal:** AB tests never break silently again.

### 1.1 Watchdog Cron
- **Primary:** 10:00 UTC (2h after ab-rotate). Checks cron_health. If rotation missed: catch-up inline.
- **Secondary:** 20:00 UTC. Verifies the primary watchdog ran. "Who watches the watchdog."

### 1.2 cron_health Table (Generic)
```sql
CREATE TABLE cron_health (
  cron_name text PRIMARY KEY,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'info')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
All system crons write heartbeats. Dashboard reads for health indicators. Tiered severity: critical (ab-rotate, ab-evaluate) vs info (competitor-sync).

### 1.3 Pre-flight Token Check
Before rotation: `channels.list?part=id&mine=true` (1 quota unit). If 401/403: skip rotation, notify, don't increment failure counter.

### 1.4 Idempotency
- Scheduled: `ab-rotate:{testId}:{YYYY-MM-DD}`
- Manual: `manual:{testId}:{unix_ms}`

### 1.5 Deploy Race Condition Fix
New order: (1) write `last_applied_variant_id` as write-ahead marker → (2) set thumbnail on YouTube → (3) close/open cycles. Watchdog verifies marker matches open cycle.

```sql
ALTER TABLE ab_tests ADD COLUMN last_applied_variant_id uuid;
```

### 1.6 Drift Detection
Watchdog compares current YouTube thumbnail against expected variant. Mismatch → pause test + notify "external change detected."

### 1.7 Force Rotate Button
Active-detail page only. Shows current → next variant preview. Pre-flight check before execution. Logs `trigger: 'manual'`.

### 1.8 Notifications
- Always persist to DB `notifications` table (bell icon works even if email fails)
- Email via Resend for critical failures only
- Extensible payload: `{ type, channel, metadata: JSONB }`

### 1.9 Per-test Health Indicator
Green (<26h cycle age), yellow (26-50h), red (>50h). Dot on dashboard cards.

### 1.10 Token Expiry Warning Banner
Yellow banner in YouTube section header when any token expires within 48h.

### 1.11 Token Refresh Buffer
`ensureFreshToken` threshold: 5min → **30min**.

---

## Phase 2: Live Data + Analytics (~18h)

**Goal:** Eliminate "I don't know if it's working" anxiety during 48-72h YouTube Analytics lag.

### 2.1 Adaptive Polling
Reuses sync-youtube route with `?mode=poll`. Uses `videos.list(statistics)` — 1 unit/50 videos.

| Video state | Interval |
|---|---|
| Active variant, first 48h | 15 min |
| Steady state (active test, >48h) | 60 min |
| Inactive (>30 days, no test) | 6 hours |

Dedup guard: skip if last poll < 5min ago.

### 2.2 Two-Layer Signal Card
- **TOP** (green pulse): live proxy — viewCount delta, likes delta. Label: "Sinal ao vivo"
- **BOTTOM** (gray "Confirmado" badge): CTR, impressions from YouTube Analytics API
- Transition: animated crossfade + "Dados confirmados" pill for 5s when confirmed data arrives

### 2.3 Data Freshness Indicator
Per-metric: `Views: 3 min ago | CTR: 51h ago (confirmed)`. Green dot (<5min), amber (<24h), gray (>24h).

### 2.4 Revenue Range
`R$35-52/ano` not single number. Default RPM [0.5, 4.0] BRL with "faixa padrão" badge. Computed from `youtube_video_analytics` last 28 days.

### 2.5 Outlier Score
Compare views at age T vs median of previous 9 uploads at same age. Snapshots: `views_at_24h`, `views_at_48h`, `views_at_7d`, `views_at_30d`. Badge: blue (2-5x), purple (5-10x), red (>10x). Zero-guard: `Math.max(median, 1)`.

### 2.6 Days Remaining (Decay Model)
Exponential decay fit on last 5 daily impression values. If λ < 0.01 (flat): linear fallback. Before 5 points: "Estimativa indisponível."

### 2.7 Data Model
```sql
CREATE TABLE ab_test_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES ab_test_variants(id),
  polled_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  UNIQUE (test_id, variant_id, polled_at)
);
CREATE INDEX idx_ab_test_polls_test_time ON ab_test_polls (test_id, polled_at DESC);

ALTER TABLE youtube_video_analytics ADD COLUMN views_at_24h integer, ADD COLUMN views_at_48h integer, ADD COLUMN views_at_7d integer, ADD COLUMN views_at_30d integer;

ALTER TABLE ab_test_cycles ADD COLUMN views integer, ADD COLUMN avd_seconds numeric(8,2), ADD COLUMN subscribers_gained integer, ADD COLUMN estimated_revenue numeric(10,4), ADD COLUMN likes integer;
```

Retention: ab_test_polls pruned after 7 days.

---

## Phase 3: Workflow Automation (~18h)

**Goal:** Zero manual effort for the common test lifecycle.

### 3.1 Auto-Apply Winner with Safety Net

**State machine:**
```
test_completed → grace_pending (24h) → applying → applied | apply_failed
                     ↓                              ↓           ↓
                  user_cancelled              revert_available  retry (3x: 1h/4h/12h)
                                                    ↓           ↓
                                               reverted    permanently_failed → notify
```

- **Grace period:** 24h countdown. User sees "Apply Now" / "Cancel" buttons.
- **Backup:** original already in `ab_tests.original_thumbnail_url` + original variant blob. No new storage.
- **Revert window:** 7 days. Side-by-side preview of original vs current.
- **Combo partial failure:** thumbnail first, then title. Retry only failed part.
- **Blob validation:** HEAD request before apply. 404 → `apply_failed: asset_missing`.

```sql
ALTER TABLE ab_tests ADD COLUMN winner_applied_at timestamptz, applied_by text CHECK (applied_by IN ('auto','manual')), apply_attempts integer DEFAULT 0, last_apply_error text, grace_expires_at timestamptz, revert_expires_at timestamptz;
```

Hard dependency on P1 pre-flight token check.

### 3.2 Auto-Suggest with Quality Filters
Score: `impressions × (1 - CTR/channel_avg_CTR)`. Three DB-level filters: age > 14 days, views >= 1000, no test in last 60 days. P4 fatigue integration: +0.3 priority boost for fatigued videos.

### 3.3 Batch Start with Stagger
Select 2-5 suggested videos → inline errors for ineligible → first starts immediately → remaining get `queue_start_after` staggered 1 day apart.

```sql
ALTER TABLE ab_tests ADD COLUMN queue_start_after timestamptz;
```

ab-rotate cron adds: `WHERE status = 'queued' AND queue_start_after <= now()`.

### What was CUT:
- Drag-and-drop queue (YAGNI)
- Test presets (6 fields take 5 seconds)
- Evergreen scheduler (auto-suggest covers this; defer v2)
- Email digest (single user; defer v2)

---

## Phase 4: Insights + Learnings (~21h)

**Goal:** Transform test results into actionable knowledge.

### 4.1 Fatigue Detector (Hero Feature)
Works with **0 completed tests** — analyzes all videos with 60+ days of analytics.

- **Algorithm:** log-linear regression on `log(CTR)` vs `log(days_since_publish)`. Alert when 7-day rolling z-score < -1.5.
- **Guards:** impressions_7d >= 1000, age >= 30 days, not in active test.
- **Run:** daily, inside sync-youtube cron.
- **UI:** "CTR fadiga" badge on video cards. "Needs Attention" list in AB Lab dashboard with one-click "Create Test."

```sql
CREATE TABLE youtube_fatigue_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES youtube_videos(id),
  site_id uuid NOT NULL,
  detected_at timestamptz DEFAULT now(),
  z_score numeric(5,2) NOT NULL,
  expected_ctr numeric(6,4),
  actual_ctr numeric(6,4),
  status text DEFAULT 'pending' CHECK (status IN ('pending','dismissed','resolved')),
  resolved_by_test_id uuid REFERENCES ab_tests(id)
);
```

### 4.2 Learnings Dashboard
Minimum **3 completed tests** gate. Below: "Coletando dados... (X/3 testes)."

- Wilson score confidence per pattern
- Negative learnings: red pill + strikethrough ("Red backgrounds: lost 3/3, -12% avg")
- Insight text: top 3 positive + top 2 negative patterns in natural language

### 4.3 Per-Channel Learnings
Groups by channel_id when 2+ channels have completed tests. Auto-activates.

### What was CUT:
- Traffic source segmentation (views without CTR = misleading)
- Test comparison side-by-side (needs 5+ tests; defer v2)
- Cowork injection (pipeline not daily workflow; "copy learnings" button for v1)
- Smart suggest feedback loop (wire in v2)

---

## Appendix: Provisional Phases (P5-P6)

**Status: PARKED. Re-evaluate after P1-P4 shipped + 60 days of usage.**

### Phase 5: Competitor Observatory

#### v0 — Competitor Pulse (~9h)
- Add/remove competitor channels (max 15)
- Sync piggybacked on sync-youtube via `playlistItems.list` (1 unit/page)
- Store latest 10 video snapshots per channel (title, description hash, thumbnail URL, viewCount)
- Detect changes: title diff, description hash diff, thumbnail URL change (no pHash in v0)
- Change feed as collapsible drawer panel in YouTube dashboard
- Manual "sync now" button

#### v1 additions (+9h)
- pHash via Sharp (8-byte hash, Hamming distance >5 = change)
- Full-page feed with filters
- Save-to-library bookmark flag
- RSS zero-quota upload detection
- View velocity tracking

```sql
CREATE TABLE competitor_channels (id uuid PK, site_id uuid, channel_id text UNIQUE, channel_name text, added_at timestamptz);
CREATE TABLE competitor_videos (id uuid PK, channel_id uuid FK, video_id text UNIQUE, title text, thumbnail_url text, thumbnail_hash text, view_count bigint, last_checked_at timestamptz);
CREATE TABLE competitor_changes (id uuid PK, video_id uuid FK, change_type text, old_title text, new_title text, old_thumbnail_url text, new_thumbnail_url text, view_count_at_change bigint, detected_at timestamptz, bookmarked boolean DEFAULT false);
```

#### Decision Gate
**Build when ALL true:** 5+ completed tests, 3x/week dashboard visits, user mentions competitors, >30% auto-suggest acceptance.
**Defer if ANY true:** <3 tests in 60 days, <1x/week visits, P1-4 gaps outstanding.

### Phase 6: Thumbnail Intelligence

#### v0 — Library + Longevity (~12h, P5-independent)
- Auto-import winners from completed tests + manual upload
- Collections via tags (no mood board editor)
- Winner longevity: checkpoints at 7/30/60/90 days via existing ab-backfill cron
- Longevity states: "holding" (±20%), "fading" (>20% drop), "growing" (>20% gain)
- Fading triggers P4 fatigue alert

#### v1 additions (+8h, requires P5)
- Competitor thumbnails in library (via P5 bookmark)
- Thumbnail DNA via Claude Vision Batch (~$3.40/1000)
- Niche style analysis

#### What was CUT:
- Thumbnail Brief + Prompt Seed (scored 35/100 — claude.ai/design doesn't accept reference URLs; defer until 20+ tests)
- Mood board editor (YAGNI — tags suffice)
- Click Power score (defer to v2 when Vision infra exists)

#### Decision Gate
**Build when ALL true:** 10+ thumbnails from tests, user seeks references before creating, at least 1 winner shows CTR decay.
**Defer if ANY true:** <5 library entries, user creates without consulting past results, all winners hold.

#### Dependencies
| Feature | Needs P5? | Independent? |
|---------|-----------|-------------|
| Library auto-import | No | P1-4 only |
| Winner longevity | No | P1-4 only |
| Competitor thumbs | YES | Blocked on P5 |
| DNA extraction | No | P1-4 only |
| Niche style | YES | Blocked on P5 |

---

## Cross-Phase Integration Map

| Integration | Status |
|-------------|--------|
| P1 cron_health → generic, all crons | Designed |
| P1 pre-flight → P3 auto-apply uses same path | Designed |
| P1 notifications → extensible (type+channel+payload) | Designed |
| P2 outlier → P3 auto-suggest boosts outliers | Designed |
| P4 fatigue → P3 auto-suggest (fatigued = candidate) | Designed |
| P4 learnings → P6 library (when exists) | Deferred |
| P5 bookmark → P6 library (same flag) | Deferred |
| P6 longevity fading → P4 fatigue alert | Designed |
| No circular dependencies | Verified |
