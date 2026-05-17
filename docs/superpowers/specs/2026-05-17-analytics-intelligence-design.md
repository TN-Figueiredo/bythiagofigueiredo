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
3. Add token scope validation at first Analytics API call per session — if 403/insufficient_scope, surface specific error message rather than silent empty
4. Add retry with exponential backoff (1s → 2s → 4s, max 3 retries) for transient 5xx
5. Surface API errors in UI via inline error banner (persistent, not toast): "Dados indisponíveis — erro na API do YouTube Analytics. Detalhes: {error_code}"
6. When API unavailable: show stale data with staleness badge ("Última atualização: X dias atrás") rather than empty state

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
| CTR | 25% | YouTube Analytics API `impressionClickThroughRate` per video | Click-through rate relative to channel's own average |
| Retention | 25% | `audienceWatchRatio` (100 data points) + `averageViewPercentage` | Average view percentage + curve shape quality |
| Reach | 15% | Impressions + traffic source diversity (Shannon entropy) | Distribution breadth beyond algorithm dependency |
| Engagement | 15% | (likes + comments + shares) / views × 100 | Audience interaction depth |
| Growth Velocity | 12% | Daily views from YouTube Analytics API `day` dimension (last 28 days) | Momentum: accelerating vs decaying view trajectory |
| Subscriber Impact | 8% | `subscribersGained` from video / impressions × 1000 | Conversion power (subs per 1K impressions) |

### Normalization — Sigmoid with Per-Axis Steepness

All axis scores normalized to 0–100 using a channel-relative sigmoid:

```
normalized(x) = 100 / (1 + e^(-k * (x - midpoint)))
```

Where:
- `midpoint` = channel's own median for that metric (computed from last 90 days of video data)
- `k` = steepness factor per axis (controls score distribution shape)
- Output clamped to [1, 99]

#### Sigmoid Steepness (`k`) Values

| Axis | k | Rationale | Score at midpoint ± 1 SD |
|------|---|-----------|--------------------------|
| CTR | 1.8 | CTR clusters tightly (SD ~1.5pp). Clear separation at ±1SD | 27 / 73 |
| Retention | 2.0 | Retention varies ±10-15pp. Good quartile separation | 25 / 75 |
| Reach | 1.2 | Impressions vary by orders of magnitude. Lower k prevents extreme polarization | 35 / 65 |
| Engagement | 1.5 | Moderate variance. Balanced sensitivity | 31 / 69 |
| Growth Velocity | 2.5 | Derived slope metric with small absolute range. Higher k amplifies signal | 22 / 78 |
| Subscriber Impact | 2.2 | Often near-zero. Rewards any conversion above baseline | 24 / 76 |

**Design goal:** ~68% of videos score 27–73 (within ±1 SD), ~5% score above 90 or below 10.

#### Input Transformation Before Sigmoid

For heavy-tailed distributions, apply `log₂(x + 1)` before sigmoid:

```typescript
function prepareAxisInput(axis: Axis, rawValue: number): number {
  if (axis === 'reach' || axis === 'growth_velocity') {
    return Math.log2(rawValue + 1)
  }
  return rawValue
}
```

The `midpoint` for log-transformed axes is also `log₂(channel_median + 1)`.

### Channel-Relative vs External Benchmarks — Scope Resolution

These are two SEPARATE scoring contexts:

| Context | Used by | Midpoint source | Purpose |
|---------|---------|-----------------|---------|
| **Video Grade** (A/B/C/D) | Grades tab, outlier detection | Channel's own 90-day median | Rank videos WITHIN the channel |
| **Health Coach** (benchmark) | Coaching cards, Cowork analysis | External niche benchmarks × channel size tier | Compare channel AGAINST similar channels |

A channel with 2% average CTR can still have a video scoring 85 (well above its own average). But the Health Coach will show CTR as "below average" because the external benchmark for its tier is 4.5%. These are complementary: the first optimizes internal allocation ("which videos to fix"), the second drives strategic improvement ("what ceiling to aim for").

#### Channel Size Tier Modifiers (Health Coach ONLY)

| Tier | Subscribers | CTR benchmark | Retention benchmark | Growth benchmark | Engagement benchmark |
|------|-------------|---------------|---------------------|------------------|---------------------|
| small | 0–10K | 4.5% × 0.8 = **3.6%** | 40% × 0.85 = **34%** | +15%/mo × 0.7 = **+10.5%/mo** | 4.0% × 0.9 = **3.6%** |
| medium | 10K–100K | 4.5% × 1.0 = **4.5%** | 40% × 1.0 = **40%** | +15%/mo × 1.0 = **+15%/mo** | 4.0% × 1.0 = **4.0%** |
| large | 100K+ | 4.5% × 1.2 = **5.4%** | 40% × 1.1 = **44%** | +15%/mo × 1.3 = **+19.5%/mo** | 4.0% × 1.15 = **4.6%** |

Health Coach axis score formula:
```
health_axis_score = 100 / (1 + e^(-1.5 * (channel_metric - tier_adjusted_benchmark)))
```

### Growth Velocity — Daily View Data Acquisition

**Problem:** `youtube_videos.view_count` is cumulative. Growth Velocity requires daily granularity.

**Solution:** YouTube Analytics API `day` dimension:

```
GET https://youtubeanalytics.googleapis.com/v2/reports
  ?ids=channel==MINE
  &dimensions=day,video
  &metrics=views
  &startDate={28_days_ago}
  &endDate={today}
  &sort=day
  &maxResults=200
```

Returns daily views per video (up to 200 rows). Paginate for >7 active videos. 1 API unit per request.

#### Velocity Computation (Weighted Linear Regression)

```typescript
function computeGrowthVelocity(dailyViews: DailyViewPoint[], recencyExponent: number): number {
  if (dailyViews.length < 7) return 0
  const n = dailyViews.length
  let sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0, sumW = 0

  for (let i = 0; i < n; i++) {
    const w = Math.pow(i + 1, recencyExponent)
    sumW += w; sumWX += w * i; sumWY += w * dailyViews[i].views
    sumWXX += w * i * i; sumWXY += w * i * dailyViews[i].views
  }

  const slope = (sumW * sumWXY - sumWX * sumWY) / (sumW * sumWXX - sumWX * sumWX)
  const meanViews = sumWY / sumW
  if (meanViews < 1) return 0
  return (slope / meanViews) * 100  // % daily change relative to weighted mean
}
```

Positive = accelerating, negative = decaying.

### Video Age & Lifecycle

| Category | Age | Behavior |
|----------|-----|----------|
| `fresh` | 0–14 days | Growth weight reduced to 4% (redistributed to CTR+Retention). Still in YouTube's distribution testing window. |
| `maturing` | 15–90 days | Standard weights. Full scoring capability. |
| `established` | 91–365 days | Standard weights. Eligible for Evergreen Bonus. |
| `evergreen` | 365+ days | Standard weights + Evergreen Bonus if qualifying. |

#### Dynamic Weight Adjustment

```typescript
function getAxisWeights(videoAgeDays: number): AxisWeights {
  if (videoAgeDays <= 14) {
    return { ctr: 0.29, retention: 0.29, reach: 0.15, engagement: 0.15, growth: 0.04, subImpact: 0.08 }
  }
  return { ctr: 0.25, retention: 0.25, reach: 0.15, engagement: 0.15, growth: 0.12, subImpact: 0.08 }
}
```

#### Freshness-Weighted Trend Exponent

| Video Age | Recency Exponent | Effect |
|-----------|-----------------|--------|
| 0–14 days | 2.0 | Heavily weights most recent days (launch momentum) |
| 15–90 days | 1.5 | Standard balanced trend detection |
| 91+ days | 1.0 | Linear weighting (stable long-term, spikes less impactful) |

#### Evergreen Bonus

Videos >90 days maintaining performance above channel daily mean with low variance (CV < 0.8) receive +3 to +8 bonus points:

```typescript
function computeEvergreenBonus(ageDays: number, dailyViews: number[], channelDailyMean: number): number {
  if (ageDays < 90 || dailyViews.length < 14) return 0
  const videoMean = dailyViews.reduce((a, b) => a + b, 0) / dailyViews.length
  if (videoMean < channelDailyMean) return 0
  const stdDev = Math.sqrt(dailyViews.reduce((sum, v) => sum + Math.pow(v - videoMean, 2), 0) / dailyViews.length)
  if (stdDev / videoMean > 0.8) return 0
  return Math.min(8, Math.max(3, Math.round((videoMean / channelDailyMean) * 2.5)))
}
```

### Grade Assignment

```
overall_score = Σ (axis_weight × axis_normalized_score) + evergreen_bonus
grade = A if score >= 85, B if >= 65, C if >= 40, D if < 40
```

| Grade | Score | Interpretation |
|-------|-------|----------------|
| A | 85–100 | Top performer — protect and replicate |
| B | 65–84 | Above average — minor optimizations possible |
| C | 40–64 | Below average — specific issues identifiable |
| D | 0–39 | Underperforming — needs active intervention |

### Trend Detection

Weighted average of last 4 weekly score deltas (exponential decay favoring recent weeks):

- Weights: [0.4, 0.3, 0.2, 0.1] (most recent = highest)
- **Direction threshold:** ±1.5 pts/week to avoid noise
- **Streak:** 3+ consecutive weeks same direction → labeled trend
- **Velocity:** rate of change. > 5 pts/week = "Acelerando rápido" / "Queda acentuada"
- **Notification trigger:** velocity < -5 for 2+ weeks → `grade_drop` notification

### Outlier Detection (MAD-based)

Modified Z-Score across all channel videos with >500 impressions:

```
MAD = median(|xi - median(X)|)
modified_z = 0.6745 * (xi - median(X)) / MAD
outlier if |modified_z| > 2.5
```

| Axis | Positive Outlier Pattern | Negative Outlier Pattern |
|------|--------------------------|--------------------------|
| CTR | Face close-ups, bold text, curiosity gaps | Dark thumbs, generic screenshots |
| Retention | Strong hook (first 30s), clear structure | Front-loaded drop, misleading title |
| Reach | Multi-source traffic (search + suggested + browse) | Single-source dependency (90%+ browse) |
| Engagement | Question-ending titles, call-to-action in first 60s | No CTA, purely informational |
| Growth | Trending topic, SEO-optimized for rising term | Dated content, saturated topic |
| Sub Impact | Clear value proposition, series content | One-off content, no channel identity |

Pattern mining across positive outliers → what works. Negative → what to avoid. Both passed to Cowork for cross-correlation.

### First-Time Experience (Bootstrap)

When `video_grade_history` has < 2 weekly snapshots:

| Day | Capability |
|-----|-----------|
| 0 | Static grades from cumulative metrics. Growth Velocity = 0 (weight redistributed). No trend. |
| 7 | First snapshot. Still no trend (need 2+ points). |
| 14 | Trend detection activates. Growth Velocity available. Bootstrap banner removed. |
| 28 | Full 4-week trend window. All axes at full accuracy. |
| 90 | 90-day rolling midpoints stabilized. Evergreen Bonus eligible. |

**UI banner (day 0-13):**
```
ℹ️ Primeira avaliação — tendências disponíveis após 2 semanas de coleta.
Os scores atuais são baseados em métricas cumulativas. Grades se tornarão mais precisos com o tempo.
```

---

## 3. Retention Curves (Real Data)

### Current Problem

`yt-retention-curve.tsx` fabricates a curve from a single `averageViewPercentage` number.

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
- **Cache:** Stored in `youtube_videos.retention_curve` (JSONB column, 100 numbers)
- **Quota:** 1 unit per video. 35 videos = 5/day batched across the week (negligible)
- **No data available:** Videos with 0 retention data (too new or too few views) show placeholder: "Dados de retenção indisponíveis — mínimo 100 views necessários"

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

### Before/After Comparison

Rendered as a compact card below the diagnostic panel for any video that completed an A/B test.

```
┌─────────────────────────────────────────────────────────────┐
│ Antes / Depois                     Há 23 dias desde mudança │
├───────────────────────────┬─────────────────────────────────┤
│  [old thumbnail]          │  [new thumbnail]                │
│  Título antigo (se mudou) │  Título novo (se mudou)         │
├───────────────────────────┼─────────────────────────────────┤
│  CTR: 2.1%                │  CTR: 3.8%  (+81%)             │
│  Grade: D (32)            │  Grade: B (68)                  │
├───────────────────────────┴─────────────────────────────────┤
│  Estimativa: +1,240 cliques extras desde a mudança          │
│  (baseado em impressões reais × delta CTR)                  │
└─────────────────────────────────────────────────────────────┘
```

**Data sources:**
- Old thumb/title: `ab_tests.original_value` (JSONB)
- CTR before: 4-week avg from `video_grade_history` pre-test
- CTR after: current 4-week avg
- Extra clicks: `SUM(weekly_impressions) × (ctr_after - ctr_before)`

**Visibility:** Only for completed tests with a winner. Most recent test shown; "Ver histórico" link if multiple.

### Filters

- Filter by grade: A | B | C | D | All
- Sort by: Score | CTR | Views | Trend
- "Mostrar só otimizáveis" toggle (excludes resolved/exhausted/in-cooldown)

---

## 5. Channel Health Coach

### UI Specification

- Large health score ring (0-100) with animated SVG
- Radar chart showing **6 axes** matching the scoring algorithm: CTR, Retenção, Alcance, Engajamento, Crescimento, Impacto em Subs
- 6 coaching cards, one per scoring axis

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

### Radar Chart Axes

| Axis | Label (PT-BR) | Weight | Position |
|------|---------------|--------|----------|
| CTR | CTR | 25% | Top |
| Retention | Retenção | 25% | Top-right |
| Reach | Alcance | 15% | Bottom-right |
| Engagement | Engajamento | 15% | Bottom |
| Growth Velocity | Crescimento | 12% | Bottom-left |
| Subscriber Impact | Impacto em Subs | 8% | Top-left |

### Sparse Data Behavior

| Videos Available | Behavior |
|-----------------|----------|
| 0 | Empty state (see below) |
| 1-2 | Bar chart instead of radar. Label: "Mínimo 3 vídeos para radar" |
| 3-5 | Radar with disclaimer: "Baseado em poucos vídeos — scores podem flutuar". Axes with insufficient data render at 5.0 (neutral) with dashed line |
| 6-9 | Radar with note: "Score se estabiliza com 10+ vídeos" |
| 10+ | Full confidence radar, no disclaimers |

### Empty State (No Cowork Analysis)

```
┌─────────────────────────────────────────────────────────┐
│        [radar chart outline, all axes at 0, gray]       │
│                                                         │
│  Nenhuma análise de inteligência disponível ainda.      │
│  O Health Coach usa dados de performance do canal para  │
│  gerar diagnósticos personalizados. Você pode:         │
│  1. Aguardar a análise automática (próximo ciclo)      │
│  2. Solicitar uma análise agora                        │
│                                                         │
│  [Solicitar Nova Análise →]                            │
└─────────────────────────────────────────────────────────┘
```

### Coaching Sources (Priority)

1. **Cowork AI enrichment (preferred):** Via Intelligence PATCH → `coaching.priorities[]`. Badge: "Análise AI"
2. **App-side rules (fallback):** Static rule-based when no Cowork data exists. Badge: "Diagnóstico básico"

**App-side fallback rules:**

| Axis | Fallback Rule |
|------|--------------|
| CTR | If < 80% of channel avg → "CTR abaixo da média. Considere testar novas thumbnails." |
| Retention | If avg_view_percentage < 40% → "Retenção fraca. Revise os primeiros 30 segundos." |
| Reach | If >80% traffic from Browse → "Alcance limitado. Otimize SEO para diversificar." |
| Engagement | If engagement_rate < 3% → "Engajamento baixo. Experimente perguntas no final." |
| Growth | If declining 3+ weeks → "Crescimento em queda. Considere variar formatos." |
| Sub Impact | If subs/impressions < 0.1% → "Conversão de inscritos baixa. Adicione CTAs claros." |

### "Solicitar Nova Análise" Button

| State | UI Display | Button State |
|-------|-----------|--------------|
| No recent request | "Solicitar Nova Análise" | Enabled (primary blue) |
| Task `pending` (< 24h ago) | "Em fila — solicitado há Xh" | Disabled (gray), clock icon |
| Task `running` | "Analisando..." | Disabled, spinner |
| Cooldown active (< 24h) | "Disponível em Xh" | Disabled with countdown |
| Last request > 24h ago | "Solicitar Nova Análise" | Enabled |
| Request failed | "Última solicitação falhou — tente após 24h" | Disabled with timestamp |

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
| `diagnosed` | `unmonitored` | manual dismiss | user decides not to optimize |
| `test_suggested` | `testing` | user approval | ab_tests row created |
| `test_suggested` | `diagnosed` | user rejects suggestion | wants different approach |
| `testing` | `post_test_monitoring` | ab-evaluate cron | winner applied to YouTube |
| `testing` | `retest_needed` | test inconclusive/archived | no winner after max_duration |
| `post_test_monitoring` | `resolved` | day 30 check | grade >= B OR CTR +10% sustained |
| `post_test_monitoring` | `retest_needed` | day 30 check | still C/D or CTR dropped |
| `retest_needed` | `flagged` | cooldown expired | cycle < 5, new cycle begins |
| `retest_needed` | `exhausted` | — | cycle >= 5 |

### Post-Test Monitoring

3 checkpoints after applying A/B test winner:
- **Day 7:** Compare CTR to pre-test baseline. Store delta.
- **Day 14:** Check if improvement holding. If CTR dropped >10%, create critical notification + suggest revert.
- **Day 30:** Final assessment. Re-calculate grade. Resolve or flag for re-test.

### Cooldown Precision

The 60-day cooldown starts from `test_winner_applied_at` (when the winner was actually applied to YouTube), NOT from `test_completed_at`.

**Timeline:**
```
Day 0:  Test completes (winner determined)         — test_completed_at
Day 1:  Winner applied to YouTube                  — test_winner_applied_at ← COOLDOWN STARTS
Day 8:  Monitoring checkpoint 1 (day 7)
Day 15: Monitoring checkpoint 2 (day 14)
Day 31: Monitoring checkpoint 3 (day 30) — resolved or retest_needed
Day 61: Cooldown expires — eligible for new cycle
```

**Edge case — winner never applied:** If `test_winner_applied_at IS NULL` after 14 days post-completion, cycle transitions to `resolved` with reason `abandoned`. No cooldown applies.

### Anti-Spam

- Only 1 active optimization cycle per video (enforced by partial unique index)
- 60-day cooldown from `test_winner_applied_at`
- Max 5 lifetime optimization cycles per video
- Check existing `ab_tests.completed_at` to prevent redundant suggestions
- Manual A/B test on a `flagged` video: automatically links to existing cycle (transitions to `testing`)

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

### Viral Detection Timing

`sync-analytics-metrics` runs daily. To detect 48h spikes:

1. Each sync stores `view_count_delta_today = new_count - previous_count`
2. Previous day's delta stored in `view_count_yesterday` (shifted each sync)
3. `views_48h = view_count_delta_today + yesterday's delta`
4. Compare against `channel_avg_views_per_48h`
5. If `views_48h >= 5 × channel_avg` → fire `trending_viral`

### Notification Aggregation

If 3+ notifications of the **same type** fire in the same cron run, consolidate into one group notification:

| Individual Count | Behavior |
|-----------------|----------|
| 1-2 | Create individual notifications normally |
| 3+ | Create ONE group notification, suppress individuals |

**Group format:**
```json
{
  "type": "grade_drop",
  "priority": 5,
  "title": "3 vídeos tiveram queda de grade esta semana",
  "message": "• Video A — A → C\n• Video B — B → D\n• Video C — A → D",
  "dedup_key": "grade_drop:group:2026-W20"
}
```

**Daily cap:** Max 1 notification per type per day (enforced via dedup_key temporal component).

### Dedup

Unique index on `(site_id, dedup_key)` with `ON CONFLICT DO NOTHING`.

Key format: `{type}:{video_id}:{temporal_key}` (e.g., `ctr_drop:uuid:2026-W20`)
Group key: `{type}:group:{temporal_key}` (e.g., `grade_drop:group:2026-W20`)

### Bell UX

- Badge on YouTube nav item + bell icon in layout header
- Red dot pulse animation when priority 4-5 unread
- Click opens dropdown with priority-colored left borders
- Group notifications show expandable list
- Click notification → mark read + navigate to `action_href`
- "Marcar tudo como lido" button
- Swipe/X to dismiss permanently
- Auto-expire: 30 days (daily cron)
- Max 50 visible, ordered by priority DESC then created_at DESC
- Empty state: "Nenhuma notificação. Tudo em ordem!"

### Priority Styling

- 5: Red left border, bold title, subtle red background
- 4: Orange left border, bold title
- 3: Blue left border
- 2: Gray left border
- 1: Gray left border, dimmed text

---

## 8. Cowork AI Integration

### Pipeline Task Model

Cowork is an external Claude AI agent running in the existing pipeline infrastructure. A dedicated task type `youtube-intelligence` coordinates execution.

#### Task Table: `youtube_intelligence_tasks`

```sql
CREATE TABLE youtube_intelligence_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id),
  channel_id      UUID NOT NULL REFERENCES youtube_channels(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stale')),
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN ('manual', 'cron')),
  requested_by    UUID REFERENCES auth.users(id),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  result_summary  JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active task per channel
CREATE UNIQUE INDEX idx_yt_intel_task_active
  ON youtube_intelligence_tasks (site_id, channel_id)
  WHERE status IN ('pending', 'running');
```

#### Task Lifecycle

```
pending → running → completed
   │         │
   │ 7d      │ PATCH fails / error
   ↓         ↓
 stale     failed (retry_count < 3 → back to pending)
```

### Pipeline API

**GET** `/api/pipeline/youtube/intelligence?channel_id={uuid}`

Returns `IntelligenceGetResponse` with 9 sections. Also transitions pending task to `running`.

**GET** `/api/pipeline/youtube/intelligence/task?status=pending`

Returns oldest pending task for Cowork to pick up. 204 if none.

**PATCH** `/api/pipeline/youtube/intelligence`

Accepts `IntelligencePatchPayload` with required `task_id`.

### PATCH Validation Pipeline

#### Step 1: Zod Schema Validation
- All fields validated against `IntelligencePatchPayloadSchema`
- `action_type` must be one of 12 allowed enum values
- `confidence` must be 0.0-1.0
- Max 5 recommendations per video
- Max 20 notifications per PATCH

#### Step 2: Referential Integrity
- Every `video_id` must exist in `youtube_videos` for the given channel
- `task_id` must reference an existing task with status `running`
- `channel_id` must match the task's channel

#### Step 3: Business Rules
- No duplicate recommendation IDs in payload (checked via Set)
- Rate limit: max 10 PATCH calls per task

#### Step 4: Error Response (422)
```json
{
  "error": "validation_failed",
  "details": [{ "path": "video_recommendations[0].video_id", "code": "referential_integrity", "message": "Video not found" }]
}
```

Cowork reads `details[]`, fixes, retries (max 3, backoff 2s→4s→8s).

#### Step 5: Success Processing
1. Upsert in `youtube_intelligence` (by video_id + source)
2. Create `yt_notifications` via `create_yt_notification()` (ON CONFLICT DO NOTHING)
3. Update `optimization_cycles` (flagged → diagnosed)
4. Store coaching
5. Mark task `completed`

### Trigger Mechanisms

**Manual:** "Solicitar Nova Análise" button → creates task with `trigger_type: 'manual'`
- Debounce: if task already pending/running, button disabled
- Cooldown: max 1 manual request per 24h (backend enforced, 429 response)

**Cron:** Monday 08:00 UTC (after grade snapshot at 06:00) → creates task with `trigger_type: 'cron'`

### Cowork Workflow

1. Check for work: `GET /api/pipeline/youtube/intelligence/task?status=pending`
2. Read reference: `GET /api/pipeline/context/youtube-intelligence`
3. Read data: `GET /api/pipeline/youtube/intelligence?channel_id=xxx`
4. Analyze (pattern mining, outlier detection, benchmark comparison)
5. Write back: `PATCH /api/pipeline/youtube/intelligence`
6. On 422: fix issues, retry (max 3). If all fail: report failure.

### Availability & Fallback

| Feature | With Cowork | Without Cowork |
|---------|-------------|----------------|
| Video grades | Full 6-axis scoring | Full 6-axis scoring (independent) |
| Grade history & trends | Works normally | Works normally |
| Retention curves | Works normally | Works normally |
| Health Coach cards | AI-enriched coaching | Static rule-based fallback |
| Video recommendations | Personalized | Section hidden |
| Optimization transitions | Cowork writes diagnosis | Stays in `flagged` until available |
| Notifications (grade/ctr/viral) | Works (cron-driven) | Works (cron-driven) |
| "Criar A/B Test" button | Pre-filled with AI suggestion | Pre-filled with generic template |

**Key principle:** Grades, scoring, notifications, and the optimization state machine operate independently of Cowork. AI enriches but never blocks.

### Staleness Indicators

```
● Verde    — Última análise: < 7 dias
● Amarelo  — Última análise: 7-14 dias
● Vermelho — Última análise: > 14 dias
● Cinza    — Nenhuma análise disponível
```

### Reference Document

553-line PT-BR doc at `docs/cowork-youtube-intelligence-reference.md`:
- GET response structure
- Pattern analysis methodology
- Output format with examples
- Notification trigger conditions
- Retry/backoff spec
- Channel size tier modifiers

### 12 Recommendation Action Types

`thumbnail_test`, `title_test`, `description_test`, `combo_test`, `retention_fix`, `seo_optimization`, `engagement_boost`, `distribution_expand`, `content_series`, `publish_timing`, `community_post`, `end_screen_optimize`

### Auth

All Pipeline API endpoints authenticated via `X-Pipeline-Key` header (permanent key, never rotated per-session). PATCH validates `task_id` ownership.

---

## 9. Database Schema

### New Tables

#### `youtube_video_analytics`
Daily metrics per video for Growth Velocity computation.
- `youtube_video_id`, `site_id`, `date`, `views`, `impressions`, `ctr`, `avg_view_duration_seconds`, `likes`, `comments`, `shares`, `subscribers_gained`
- Unique index on `(youtube_video_id, date)`
- Populated by `sync-analytics-metrics` daily cron
- RLS: `can_view_site(site_id)` SELECT, `can_edit_site(site_id)` INSERT

#### `video_grade_history`
Weekly snapshots for trend analysis.
- `youtube_video_id`, `grade`, `score`, `view_count`, `ctr`, `week_iso`, `recorded_at`
- Unique index on `(youtube_video_id, week_iso)` for dedup
- RLS: `can_view_site(site_id)` SELECT, `can_edit_site(site_id)` INSERT

#### `optimization_cycles`
State machine persistence per video.
- Full state machine columns (flagging, diagnosis, test linkage, monitoring checkpoints, resolution, cooldown)
- Partial unique index: only 1 active cycle per video (WHERE state NOT IN resolved/exhausted/unmonitored)
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

#### `yt_notifications`
CMS notification storage.
- `type`, `priority`, `title`, `message`, `suggested_action`, `action_href`
- FKs to `youtube_videos`, `ab_tests`, `optimization_cycles`
- `dedup_key` unique index `(site_id, dedup_key)` for idempotent creation
- `read`/`dismissed`/`expired_at` state tracking
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

#### `youtube_intelligence`
Cowork AI analysis storage.
- `channel_id`, `video_id` (nullable), `type` (video|channel)
- `recommendations` (JSONB), `analysis_text`, `patterns_detected` (JSONB)
- `source` ('cowork'), `generated_at`, `expires_at`
- **Dedup:** Composite unique on `(site_id, channel_id, video_id, source)`. UPSERT replaces previous analysis. Only latest per scope kept.
- RLS: `can_view_site` SELECT, `can_edit_site` INSERT/UPDATE

#### `youtube_intelligence_tasks`
Pipeline task coordination (see Section 8 for full schema).

### Modified Tables

#### `youtube_videos` (add columns)
- `ctr` NUMERIC(6,4)
- `impressions` INTEGER
- `avg_view_percentage` NUMERIC(5,2)
- `avg_view_duration_seconds` INTEGER
- `retention_curve` JSONB (100 data points)
- `traffic_sources` JSONB
- `last_analytics_sync_at` TIMESTAMPTZ
- `view_count_yesterday` INTEGER DEFAULT 0
- `view_count_delta_today` INTEGER DEFAULT 0

**Backfill strategy:** First `sync-analytics-metrics` run post-migration populates all videos with >100 views. Below-threshold videos remain NULL until crossing 100 views. Expected first-run: ~2 minutes for 50 videos.

### Helper Functions

- `create_yt_notification(...)` — SECURITY DEFINER, ON CONFLICT DO NOTHING
- `expire_old_yt_notifications()` — sets expired_at on 30+ day old notifications

---

## 10. Cron Jobs

| Cron | Schedule | Purpose |
|------|----------|---------|
| `sync-analytics-metrics` | Daily 12:00 UTC | Fetch CTR/impressions/retention/daily views. Update `youtube_videos` + `youtube_video_analytics`. Detect viral (48h spike). |
| `weekly-grade-snapshot` | Monday 06:00 UTC | Calculate 6-axis scores, store in `video_grade_history`, detect C/D streaks, flag for optimization, detect grade drops, create notifications |
| `youtube-intelligence-dispatch` | Monday 08:00 UTC | Create pipeline task for Cowork (after grades are fresh) |
| `optimization-monitor` | Daily 07:00 UTC | Check day-7/14/30 for videos in `post_test_monitoring` state |
| `expire-notifications` | Daily 03:00 UTC | Auto-expire notifications >30 days. Expire stale intelligence tasks >7 days pending. |
| `ab-evaluate` (existing) | Every 6h | Extended: emit `ab_test_completed` notification + trigger optimization state transition |

---

## 11. Quota Budget

| Operation | Units/call | Frequency | Daily total |
|-----------|-----------|-----------|-------------|
| Channel metrics (30d) | 1 | 1/day | 1 |
| Video metrics (bulk, 50/req) | 1 | 1/day | 1 |
| Daily views per video (for velocity) | 1 | 5 videos/day (batched) | 5 |
| Retention curves (per video) | 1 | 5 videos/day (batched) | 5 |
| Traffic sources | 1 | 1/day | 1 |
| Search terms | 1 | 1/week (÷7) | 0.14 |
| Demographics | 1 | 1/week (÷7) | 0.14 |
| A/B test backfill (existing) | 1 | ~24 variants/day | 24 |

**Total: ~37 units/day of 10,000 daily limit (0.37% utilization)**

Extremely comfortable — room for 250x growth before quota concern.

---

## 12. User Journeys

### Journey 1: Discovery
User opens YouTube → Analytics → Grades tab → Sees videos with C/D grades, sorted by worst first → Understands at a glance which videos need attention.

### Journey 2: Diagnosis
User clicks expand on a D-grade video → Sees 6-axis score breakdown → Sees inline retention curve with cliff annotation → Reads AI diagnostic → Reads recommendation → Clicks "Criar A/B Test".

### Journey 3: Testing
"Criar A/B Test" pre-fills A/B Lab → User uploads variant → Test starts → 3-cron architecture rotates/backfills/evaluates → Test resolves (7-21 days).

### Journey 4: Results
Notification: "Teste concluído! Vencedor: variant_b +18% CTR" → Winner applied → 30-day monitoring begins → Before/After card appears in diagnostics.

### Journey 5: Continuous Loop
Day 7: "CTR +15% sustentado" → Day 30: grade C→B → "Otimização bem-sucedida!" → Resolved. If still C/D: "Re-teste sugerido após cooldown" → New cycle after 60 days.

### Journey 6: Health Coach
Channel Health → 62/100 with radar → CTR worst axis → Coaching card with specific action → "Ver vídeos recomendados" → Navigates to grades filtered by high-impressions+low-CTR.

### Journey 7: First-Time (Bootstrap)
New user connects channel → Sees grades based on current data with bootstrap banner → After 2 weeks: trend arrows appear → After first Cowork analysis: AI recommendations populate → Full functionality after 4 weeks.

### Journey 8: Error Recovery
API fails → Error banner with specific error code + stale data shown with staleness badge → User re-authenticates if scope issue → Analytics resume on next cron cycle.

---

## 13. Competitive Moat (vs VidIQ $49/mo, TubeBuddy $49/mo, ViewStats $50/mo)

| Feature | VidIQ | TubeBuddy | ViewStats | Us |
|---------|-------|-----------|-----------|-----|
| Multi-axis scoring | No (views only) | No | Partial | 6 axes + sigmoid + age-aware |
| Real retention curves inline | No | No | Yes (separate page) | Inline + cliff detection + annotations |
| Actionable grade → A/B test | No | No | No | One-click "Criar A/B Test" |
| Post-test monitoring | No | No | No | 30-day automated loop |
| Before/After ROI | No | No | No | CTR lift + extra clicks calculated |
| AI personalized coaching | Generic tips | Generic | No | Cowork context-aware + pattern mining |
| Continuous optimization loop | No | No | No | 9-state machine, 5-cycle max |
| CMS-integrated notifications | Email only | Email only | No | In-app bell + priority + aggregation |
| Channel size tier scoring | No | No | No | Small/medium/large modifiers |
| Video lifecycle awareness | No | No | No | Fresh/maturing/established/evergreen |
| Outlier pattern mining | No | No | No | MAD-based across 6 dimensions |

### 5 Moats

1. **Data Flywheel:** More tests → more data → better AI recommendations → more tests
2. **CMS Integration:** Grade → Test → Monitor in one tool (competitors need 3 tools)
3. **Contextual AI:** Cowork reads YOUR data, YOUR patterns, YOUR test history
4. **Workflow Automation:** State machine handles the loop; user just approves
5. **Compounding Personalization:** Each analysis enriches the next (pattern history)

---

## 14. Implementation Priority

### Phase 1 — Foundation (all DB migrations + API fix)
1. Fix Analytics API error handling + Sentry
2. Add 9 analytics columns to `youtube_videos` (migration)
3. Create `youtube_video_analytics` table (migration)
4. Create `video_grade_history` table (migration)
5. Create `optimization_cycles` table (migration)
6. Create `yt_notifications` table (migration)
7. Create `youtube_intelligence` table with composite unique (migration)
8. Create `youtube_intelligence_tasks` table (migration)
9. Create helper functions (migration)

### Phase 2 — Scoring + API Logic
10. Implement 6-axis scoring algorithm (sigmoid, age-aware, evergreen bonus)
11. Build GET `/api/pipeline/youtube/intelligence` endpoint
12. Build PATCH `/api/pipeline/youtube/intelligence` endpoint (Zod validation + processing)
13. Build GET `/api/pipeline/youtube/intelligence/task` endpoint
14. Seed Cowork reference doc in pipeline
15. `sync-analytics-metrics` cron (daily — populates columns + daily analytics + viral detection)

### Phase 3 — Display Layer (UI)
16. Redesign Grades tab with expandable diagnostics + 6 score bars
17. Build Channel Health Coach UI (radar chart + 6 coaching cards + fallback rules)
18. Inline retention curve SVG component
19. "Criar A/B Test" button integration (pre-fills form, links cycle)
20. Before/After comparison card
21. Bootstrap banner component

### Phase 4 — Cron Logic + Optimization Loop
22. `weekly-grade-snapshot` cron (scores + history + C/D streak detection + flagging)
23. `youtube-intelligence-dispatch` cron (auto-creates pipeline tasks)
24. Optimization cycle state transitions (all state changes)
25. `optimization-monitor` cron (day 7/14/30 post-test checks)
26. `expire-notifications` cron (30-day expiry + stale task expiry)
27. Extend `ab-evaluate` to emit notification + trigger state transition

### Phase 5 — Polish
28. Notification bell UI + dropdown panel + aggregation display
29. Filter/sort improvements on grades tab
30. Outlier detection highlighting (surfaced in diagnostics)
31. Staleness indicators across all AI-dependent sections

---

## 15. Non-Goals (explicitly excluded)

- YouTube Data API write operations (title/description changes via API)
- Automated thumbnail generation (out of scope for v1)
- Multi-channel support (single channel per site for now)
- Browser extension (CMS only)
- Email notifications (CMS bell only)
- Real-time analytics (daily sync sufficient)
- Competitor analysis (no access to their data)
- Seasonal adjustment (v2 — requires 1+ year of historical data)

---

## 16. Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind 4, Recharts (retention curves)
- **Backend:** Next.js API routes, Supabase (PostgreSQL 17)
- **APIs:** YouTube Analytics API v2, YouTube Data API v3
- **AI:** Claude Cowork via Pipeline API (GET/PATCH)
- **Crons:** Next.js cron routes (Vercel)
- **Validation:** Zod (PATCH payload)
- **Language:** All UI in PT-BR
