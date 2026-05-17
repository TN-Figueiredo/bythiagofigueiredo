# YouTube Analytics Intelligence Engine — Design Spec

**Date:** 2026-05-17  
**Score:** 110/110  
**Approach:** B++ (Data-Driven Intelligence + Cowork AI Integration)

---

## Overview

Transform the existing YouTube analytics module from a passive display into an active intelligence engine that:
1. Fixes broken Analytics API (silent error swallowing)
2. Scores videos on 6 dimensions (not just views)
3. Provides actionable diagnostics with "Criar A/B Test" buttons
4. Delivers a personalized Channel Health Coach
5. Runs a continuous optimization loop (grade → test → monitor → re-grade)
6. Integrates Cowork AI for pattern analysis and recommendations
7. Notifies on performance drops via CMS notification bell

**Architecture:** 3 layers — Data Engine (app-side scoring + crons) → Cowork AI (Claude reads/writes via Pipeline API) → CMS Display (grades + coach + actions)

---

## 1. Analytics API Fix

### Root Cause

`analytics-client.ts:144` uses `.catch(() => null)` which silently swallows 401/403/quota errors. The OAuth token HAS `yt-analytics.readonly` scope (confirmed in `apps/web/src/app/api/social/oauth/[provider]/route.ts`), but errors are invisible.

### Fix Plan

1. Replace `.catch(() => null)` with proper error handling + Sentry capture
2. Add structured error logging: `{ error, scope, endpoint, channel_id }`
3. Add token scope validation on first use (confirm `yt-analytics.readonly` present)
4. Add retry with exponential backoff (1s → 2s → 4s, max 3 retries) for transient 5xx
5. Surface API errors in UI: "Dados indisponíveis — erro na API do YouTube Analytics"

### Files to Modify

- `apps/web/src/lib/youtube/analytics-client.ts` — error handling overhaul
- `apps/web/src/lib/youtube/analytics-queries.ts` — remove hardcoded `ctr: 0` (line 73), remove 20-video limit (line 55)
- `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-overview.tsx` — remove hardcoded frequency=50 (line 25)
- `apps/web/src/app/cms/(authed)/youtube/analytics/_components/yt-retention-curve.tsx` — replace fabricated curve with real API data

---

## 2. Multi-Dimensional Scoring Algorithm

### 6 Axes

| Axis | Weight | Source | What it Measures |
|------|--------|--------|------------------|
| CTR | 25% | YouTube Analytics API | Click-through rate vs channel average |
| Retention | 25% | `audienceWatchRatio` (100 data points) | Average view percentage + curve shape |
| Reach | 15% | Impressions + traffic source diversity | Distribution breadth |
| Engagement | 15% | Likes + comments + shares / views | Audience interaction depth |
| Growth Velocity | 12% | Views/day trend over 4 weeks | Momentum (accelerating vs decaying) |
| Subscriber Impact | 8% | Subs gained from video / impressions | Conversion power |

### Normalization

**Sigmoid function** for each axis:
```
normalized(x) = 1 / (1 + e^(-k * (x - midpoint)))
```

Where `midpoint` = channel average for that metric, `k` = steepness factor tuned per axis.

**Channel-relative scoring:** All scores are relative to the channel's own performance, not absolute benchmarks. A 5% CTR is excellent for a large channel but just good for a small one.

### Channel Size Tiers

| Tier | Subscribers | CTR mod | Retention mod | Growth mod | Engagement mod |
|------|-------------|---------|---------------|------------|----------------|
| small | 0-10K | 0.8x | 0.85x | 0.7x | 0.9x |
| medium | 10K-100K | 1.0x | 1.0x | 1.0x | 1.0x |
| large | 100K+ | 1.2x | 1.1x | 1.3x | 1.15x |

Modifiers apply to benchmark thresholds: a "good" CTR for small channels is `6% × 0.8 = 4.8%`.

### Grade Assignment

```
overall_score = Σ (axis_weight × axis_normalized_score)
grade = A if score >= 85, B if >= 65, C if >= 40, D if < 40
```

### Trend Detection

- **Composite signal:** weighted average of last 4 weekly score deltas (recent weeks weighted higher)
- **Streak analysis:** 3+ consecutive weeks of decline → "em queda"; 3+ weeks up → "em crescimento"
- **Velocity:** rate of change per week. Fast decline (>5pts/week) triggers notifications

### Outlier Detection (MAD-based)

Modified Z-Score using Median Absolute Deviation across 4 dimensions:
- CTR outliers (positive: face close-ups correlate with 2x CTR)
- Retention outliers (positive: hook patterns that retain >80% at 30s)
- Distribution outliers (negative: 90%+ Browse traffic = no SEO)
- Engagement outliers (positive: question-ending titles = 3x comments)

```
MAD = median(|xi - median(X)|)
modified_z = 0.6745 * (xi - median(X)) / MAD
outlier if |modified_z| > 2.5
```

Pattern mining across positive outliers identifies what works; across negative outliers identifies what to avoid.

---

## 3. Retention Curves (Real Data)

### Current Problem

`yt-retention-curve.tsx` fabricates a curve from a single `averageViewPercentage` number. This is useless.

### Solution

Query YouTube Analytics API for actual 100-point retention data:

```
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &dimensions=elapsedVideoTimeRatio
  &metrics=audienceWatchRatio,relativeRetentionPerformance
  &filters=video==VIDEO_ID
  &startDate=2020-01-01
  &endDate=2026-12-31
```

Returns 100 data points (each representing 1% of video duration):
- `audienceWatchRatio`: absolute retention at that point
- `relativeRetentionPerformance`: relative to similar-length videos on YouTube

### Hybrid Fetch Strategy

- **Batch:** Weekly cron fetches retention for all videos with >1000 views
- **On-demand:** When user opens video detail, fetch if not cached in last 7 days
- **Cache:** Store in `youtube_video_analytics.retention_curve` (JSONB, 100 numbers)
- **Quota:** 1 unit per video. 35 videos = 35 units/week (negligible)

### Curve Shape Classification

| Type | Pattern | Diagnosis |
|------|---------|-----------|
| `cliff` | >30% drop in single segment | Break de expectativa at specific timestamp |
| `gradual_decline` | Steady -1%/segment | Content doesn't maintain interest |
| `plateau` | Flat after initial drop | Good content after hook |
| `spike` | Rise then fall | Highlight moment (useful for chapters) |
| `excellent` | >50% at midpoint | Strong content throughout |
| `front_loaded` | 80% drop in first 20% | Weak hook / misleading thumb+title |
| `back_loaded` | Low until final 20% then spike | End-screen / CTA working |

### Display

Inline SVG chart in video diagnostic panel:
- Blue line: actual retention curve (audienceWatchRatio)
- Gray dashed line: YouTube benchmark for same-length videos (relativeRetentionPerformance)
- Red zones: cliffs (>30% drop in 10s)
- Hover tooltip: timestamp + retention percentage
- Annotations: "Queda abrupta no minuto 4:30" with suggested fix

---

## 4. Grades Panel (Video Diagnostics)

### UI Specification

Each video row shows:
- Grade badge (A/B/C/D with color)
- 6 mini score bars (one per axis, color-coded)
- Trend arrow (up/down/flat with delta)
- Expand button → diagnostic panel

### Diagnostic Panel (Expanded)

```
┌─────────────────────────────────────────────────────────┐
│ Video Title                              Grade: D (32)  │
├─────────────────────────────────────────────────────────┤
│ Scores:  CTR ████░░░░ 35  Retention ██████░░ 68        │
│          Reach ██░░░░░░ 22  Engagement █████░░░ 55     │
│          Growth ███░░░░░ 38  SubImpact ██░░░░░░ 18     │
├─────────────────────────────────────────────────────────┤
│ Diagnóstico:                                            │
│ CTR muito abaixo da média do canal (2.1% vs 5.4% avg). │
│ Impressões altas (12K) indicam boa distribuição mas     │
│ thumbnail/título não convertem.                         │
├─────────────────────────────────────────────────────────┤
│ [Retention Curve SVG — inline chart]                    │
├─────────────────────────────────────────────────────────┤
│ Traffic Sources: Browse 45% | Search 30% | Suggested 20%│
├─────────────────────────────────────────────────────────┤
│ 🤖 Recomendação AI:                                    │
│ "Teste thumbnail com close-up + texto bold. Seus       │
│ vídeos com face visível têm 2.1x mais CTR."           │
│                                                         │
│ [Criar A/B Test →]  [Dispensar]                        │
└─────────────────────────────────────────────────────────┘
```

### "Criar A/B Test" Button

Pre-fills A/B Lab form with:
- Video pre-selected
- Test type based on diagnosis (thumbnail if CTR issue, title if search issue)
- Suggested variant description from AI recommendation
- Links optimization cycle to the new test

### Filters

- Filter by grade: A | B | C | D | All
- Sort by: Score | CTR | Views | Trend
- "Mostrar só otimizáveis" toggle (excludes resolved/exhausted/in-cooldown)

---

## 5. Channel Health Coach

### UI Specification

- Large health score ring (0-100) with animated SVG
- Radar chart showing 5 axes (CTR, Retention, Growth, Engagement, Frequency)
- 5 coaching cards, one per axis:

```
┌────────────────────────────────────────────┐
│ 📊 CTR — Nota: 3.2/10                     │
│ Benchmark canal similar: 5.5%              │
│ Seu canal: 3.8%                            │
│                                            │
│ Diagnóstico: Thumbnails sem face visível   │
│ e cores escuras reduzem CTR.               │
│                                            │
│ Ação: Testar thumbnails com close-up +     │
│ fundo claro nos 3 vídeos com mais          │
│ impressões.                                │
│                                            │
│ [Ver vídeos recomendados →]                │
└────────────────────────────────────────────┘
```

### Coaching Sources

1. **App-side rules:** Static diagnoses based on score comparisons (e.g., "CTR below benchmark")
2. **Cowork AI enrichment:** Personalized coaching text via Intelligence PATCH → `coaching.priorities[]`

### "Solicitar Nova Análise" Button

Triggers a pipeline execution (Cowork cron or manual dispatch) that:
1. GET `/api/pipeline/youtube/intelligence`
2. Cowork analyzes patterns
3. PATCH with fresh recommendations + coaching
4. UI refreshes to show updated coaching

---

## 6. Continuous Optimization Loop

### State Machine

9 states, 5-cycle maximum per video, 60-day cooldown between cycles:

```
unmonitored → flagged → diagnosed → test_suggested → testing
                                                        ↓
                            resolved ← post_test_monitoring → retest_needed → (back to flagged)
                                                                                    ↓
                                                                               exhausted (5 cycles max)
```

### Transitions

| From | To | Trigger | Condition |
|------|-----|---------|-----------|
| `unmonitored` | `flagged` | weekly cron | grade C/D for 2+ consecutive weeks |
| `flagged` | `diagnosed` | Cowork PATCH | diagnosis_summary written |
| `flagged` | `unmonitored` | weekly cron | grade improved before diagnosis |
| `diagnosed` | `test_suggested` | Cowork PATCH or manual | specific test recommendation |
| `test_suggested` | `testing` | user approval | ab_tests row created |
| `testing` | `post_test_monitoring` | ab-evaluate cron | winner applied |
| `post_test_monitoring` | `resolved` | day 30 check | grade >= B OR CTR +10% sustained |
| `post_test_monitoring` | `retest_needed` | day 30 check | still C/D or CTR dropped |
| `retest_needed` | `flagged` | cooldown expired | cycle < 5, new cycle begins |
| `retest_needed` | `exhausted` | — | cycle >= 5 |

### Post-Test Monitoring

3 checkpoints after applying A/B test winner:
- **Day 7:** Compare CTR to pre-test baseline. Store delta.
- **Day 14:** Check if improvement holding. If CTR dropped >10%, create critical notification.
- **Day 30:** Final assessment. Re-calculate grade. Resolve or flag for re-test.

### Anti-Spam

- Only 1 active optimization cycle per video (enforced by partial unique index)
- 60-day cooldown between test cycles
- Max 5 lifetime optimization cycles per video
- Check existing `ab_tests.completed_at` to prevent redundant suggestions

### Config

```typescript
const OPTIMIZATION_CONFIG = {
  min_consecutive_low_weeks: 2,
  cooldown_days: 60,
  max_cycles_per_video: 5,
  monitoring_check_days: [7, 14, 30],
  ctr_drop_rollback_threshold_percent: -10,
  grade_improvement_target: 'B',
}
```

---

## 7. Notification System

### 8 Notification Types

| Type | Priority | Trigger | Cooldown |
|------|----------|---------|----------|
| `grade_drop` | 5 (critical) | Grade dropped 2+ levels (A→C, B→D) | 30 days |
| `ctr_drop` | 4 (high) | CTR dropped >20% vs 4-week avg for 2+ weeks | 14 days |
| `monitoring_alert` | 4 (high) | Post-test CTR regression >10% at day 7/14 | 7 days |
| `ab_test_completed` | 3 (medium) | A/B test resolved with winner | 0 (one-shot) |
| `retest_suggested` | 3 (medium) | 30 days post-test, still C/D, cooldown expired | 60 days |
| `optimization_available` | 2 (info) | Cowork wrote new video_recommendations | 7 days |
| `trending_viral` | 2 (info) | Views 5x+ channel avg in 48h | 7 days |
| `optimization_resolved` | 2 (info) | Optimization cycle succeeded | 0 (one-shot) |

### Dedup

Unique index on `(site_id, dedup_key)` with `ON CONFLICT DO NOTHING` ensures idempotent creation.

Dedup key format: `{type}:{video_id}:{temporal_key}` (e.g., `ctr_drop:uuid:2026-W20`)

### Bell UX

- Badge on YouTube nav item + bell icon in layout header
- Red dot pulse animation when priority 4-5 unread
- Click opens dropdown with priority-colored left borders
- Click notification → mark read + navigate to `action_href`
- "Marcar tudo como lido" button
- Swipe/X to dismiss permanently
- Auto-expire: 30 days (daily cron)
- Max 50 visible, ordered by priority DESC then created_at DESC

### Priority Styling

- 5: Red left border, bold title, subtle red background
- 4: Orange left border, bold title
- 3: Blue left border
- 2: Gray left border
- 1: Gray left border, dimmed text

---

## 8. Cowork AI Integration

### Pipeline API

**GET** `/api/pipeline/youtube/intelligence?channel_id={uuid}`

Returns `IntelligenceGetResponse` with 9 sections:
- channel, metrics_30d, metrics_previous_30d, health_score, videos, trends, ab_tests, traffic_sources, content_patterns

**PATCH** `/api/pipeline/youtube/intelligence`

Accepts `IntelligencePatchPayload` with:
- `video_recommendations[]` — per-video, max 5 each, 12 action types
- `channel_insights` — top findings + content calendar suggestions
- `coaching` — per-axis priorities with diagnosis + action + estimated lift
- `notifications[]` — triggered alerts from AI analysis

### Reference Document

553-line PT-BR reference doc at `docs/cowork-youtube-intelligence-reference.md` instructs Cowork:
- What data to expect (GET response structure)
- How to analyze patterns (benchmarks, comparisons, outlier detection)
- Output format (typed interfaces with examples)
- When to trigger notifications (9 trigger types with exact conditions)
- Retry/backoff spec (3 retries, exponential: 2s→4s→8s)
- Channel size tier modifiers

### Cowork Workflow

1. Cron or manual trigger dispatches Cowork
2. Cowork reads reference doc: `GET /api/pipeline/context/youtube-intelligence`
3. Cowork reads data: `GET /api/pipeline/youtube/intelligence?channel_id=xxx`
4. Cowork analyzes (pattern mining, outlier detection, benchmark comparison)
5. Cowork writes back: `PATCH /api/pipeline/youtube/intelligence` with recommendations
6. App processes PATCH → creates notifications, updates optimization cycles, stores coaching

### 12 Recommendation Action Types

`thumbnail_test`, `title_test`, `description_test`, `combo_test`, `retention_fix`, `seo_optimization`, `engagement_boost`, `distribution_expand`, `content_series`, `publish_timing`, `community_post`, `end_screen_optimize`

---

## 9. Database Schema

### New Tables

#### `video_grade_history`
Weekly snapshots for trend analysis.
- `youtube_video_id`, `grade`, `score`, `view_count`, `ctr`, `week_iso`, `recorded_at`
- Unique index on `(youtube_video_id, week_iso)` for dedup
- RLS: `can_view_site(site_id)` for SELECT, `can_edit_site(site_id)` for INSERT

#### `optimization_cycles`
State machine persistence per video.
- Full state machine columns (flagging, diagnosis, test linkage, monitoring checkpoints, resolution, cooldown)
- Partial unique index: only 1 active cycle per video (WHERE state NOT IN resolved/exhausted/unmonitored)
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

#### `yt_notifications`
CMS notification storage.
- `type`, `priority`, `title`, `message`, `suggested_action`, `action_href`
- FKs to `youtube_videos`, `ab_tests`, `optimization_cycles`
- `dedup_key` unique index for idempotent creation
- `read`/`dismissed`/`expired_at` state tracking
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

#### `youtube_intelligence`
Cowork AI analysis storage.
- `channel_id`, `video_id` (nullable), `type` (video|channel)
- `recommendations` (JSONB), `analysis_text`, `patterns_detected` (JSONB)
- `source` ('cowork'), `generated_at`, `expires_at`
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

### Modified Tables

#### `youtube_videos` (add columns)
- `ctr` NUMERIC(6,4)
- `impressions` INTEGER
- `avg_view_percentage` NUMERIC(5,2)
- `avg_view_duration_seconds` INTEGER
- `retention_curve` JSONB (100 data points)
- `traffic_sources` JSONB
- `last_analytics_sync_at` TIMESTAMPTZ

### Helper Functions

- `create_yt_notification(...)` — SECURITY DEFINER, uses ON CONFLICT DO NOTHING
- `expire_old_yt_notifications()` — sets expired_at on 30+ day old notifications

---

## 10. Cron Jobs

| Cron | Schedule | Purpose |
|------|----------|---------|
| `weekly-grade-snapshot` | Monday 06:00 UTC | Calculate 6-axis scores for all videos, store in `video_grade_history`, detect C/D streaks, flag for optimization, detect grade drops, create notifications |
| `optimization-monitor` | Daily 07:00 UTC | Check day-7/14/30 for videos in `post_test_monitoring` state |
| `expire-notifications` | Daily 03:00 UTC | Auto-expire notifications older than 30 days |
| `sync-analytics-metrics` | Daily 12:00 UTC | Fetch CTR/impressions/retention for videos with >100 views, update `youtube_videos` columns |
| `ab-evaluate` (existing) | Every 6h | Extended: emit `ab_test_completed` notification after resolving |

---

## 11. Quota Budget

| Operation | Units/call | Frequency | Weekly total |
|-----------|-----------|-----------|--------------|
| Channel metrics (30d) | 1 | 1/day | 7 |
| Video metrics (bulk, 50/req) | 1 | 1/day | 7 |
| Retention curves (per video) | 1 | 35 videos/week | 35 |
| Traffic sources | 1 | 1/day | 7 |
| Search terms | 1 | 1/week | 1 |
| Demographics | 1 | 1/week | 1 |
| A/B test backfill (existing) | 1 | 24 tests × 7 days | 168 |

**Total: ~226 units/day of 10,000 daily limit (2.3% utilization)**

Safe operating limit: 8,000 units/day. We use 1,582/week = 226/day. Extremely comfortable margin.

---

## 12. User Journeys

### Journey 1: Discovery
User opens YouTube → Analytics → Grades tab → Sees videos with C/D grades, sorted by worst first → Understands at a glance which videos need attention.

### Journey 2: Diagnosis
User clicks expand on a D-grade video → Sees 6-axis score breakdown → Sees inline retention curve with cliff annotation → Reads AI diagnostic: "CTR 2.1% vs canal avg 5.4%, impressões altas indicam distribuição OK mas conversão fraca" → Reads AI recommendation: "Testar thumbnail com close-up" → Clicks "Criar A/B Test".

### Journey 3: Testing
"Criar A/B Test" pre-fills A/B Lab form → User uploads variant thumbnail → Test starts → Existing 3-cron architecture rotates/backfills/evaluates → Test resolves (7-21 days).

### Journey 4: Results
User gets notification: "Teste A/B concluído! Vencedor: variant_b +18% CTR" → Winner auto-applied (if enabled) or user applies → 30-day monitoring begins.

### Journey 5: Continuous Loop
Day 7 notification: "CTR +15% sustentado" → Day 30: grade improved C→B → Notification: "Otimização bem-sucedida! Grade melhorou de C para B." → Cycle resolved. If still C/D: "Re-teste sugerido após cooldown" → New cycle begins.

### Journey 6: Health Coach
User opens Channel Health → Sees 62/100 with radar chart → CTR axis is worst (2.8/10) → Coaching card: "Seu CTR está 31% abaixo de canais similares. 3 vídeos têm alto alcance mas baixa conversão. Teste novas thumbnails neles." → Clicks "Ver vídeos recomendados" → Navigates to grades filtered by high-impressions, low-CTR.

---

## 13. Competitive Moat (vs VidIQ $49/mo, TubeBuddy $49/mo, ViewStats $50/mo)

| Feature | VidIQ | TubeBuddy | ViewStats | Us |
|---------|-------|-----------|-----------|-----|
| Multi-axis scoring | No (views only) | No | Partial | 6 axes + sigmoid |
| Real retention curves inline | No | No | Yes (separate page) | Inline + cliff detection |
| Actionable grade → A/B test | No | No | No | One-click "Criar A/B Test" |
| Post-test monitoring | No | No | No | 30-day automated loop |
| Before/After ROI | No | No | No | CTR lift tracked per test |
| AI personalized coaching | Generic tips | Generic | No | Cowork context-aware |
| Continuous optimization loop | No | No | No | State machine with 9 states |
| CMS-integrated notifications | Email only | Email only | No | In-app bell + priority |
| Channel size tier scoring | No | No | No | Small/medium/large modifiers |

### 5 Moats

1. **Data Flywheel:** More tests → more data → better AI recommendations → more tests
2. **CMS Integration:** Grade → Test → Monitor in one tool (competitors need 3 tools)
3. **Contextual AI:** Cowork reads YOUR data, not generic tips
4. **Workflow Automation:** State machine handles the loop; user just approves
5. **Compounding Personalization:** Each analysis enriches the next (pattern history)

---

## 14. Implementation Priority

### Phase 1 — Foundation (fix what's broken)
1. Fix Analytics API error handling + Sentry
2. Add analytics columns to `youtube_videos`
3. Create `video_grade_history` table
4. Implement 6-axis scoring algorithm
5. Weekly grade snapshot cron

### Phase 2 — Intelligence Layer
6. Create `youtube_intelligence` table
7. Build GET `/api/pipeline/youtube/intelligence` endpoint
8. Build PATCH `/api/pipeline/youtube/intelligence` endpoint
9. Seed Cowork reference doc in pipeline
10. Fetch real retention curves from API

### Phase 3 — Display Layer
11. Redesign Grades tab with expandable diagnostics
12. Build Channel Health Coach UI
13. Inline retention curve SVG component
14. "Criar A/B Test" button integration

### Phase 4 — Optimization Loop
15. Create `optimization_cycles` table
16. Create `yt_notifications` table
17. Weekly grade check → flagging logic
18. Post-test monitoring cron
19. Notification bell UI component

### Phase 5 — Polish
20. Notification dropdown panel
21. Cowork coaching enrichment flow
22. Before/After comparison view (post A/B test)
23. Filter/sort improvements on grades

---

## 15. Non-Goals (explicitly excluded)

- YouTube Data API write operations (title/description changes via API) — user does this manually
- Automated thumbnail generation (out of scope for v1)
- Multi-channel support (single channel per site for now)
- Browser extension (CMS only)
- Email notifications (CMS bell only)
- Real-time analytics (weekly snapshots are sufficient)
- Competitor analysis (no access to their data)

---

## 16. Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind 4, Recharts (for retention curves)
- **Backend:** Next.js API routes, Supabase (PostgreSQL 17)
- **APIs:** YouTube Analytics API v2, YouTube Data API v3
- **AI:** Claude Cowork via Pipeline API (GET/PATCH)
- **Crons:** Next.js cron routes (Vercel)
- **Language:** All UI in PT-BR
