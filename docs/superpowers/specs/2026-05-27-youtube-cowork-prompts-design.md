# YouTube Cowork Prompt System

**Date:** 2026-05-27
**Revision:** 6 (textarea-first paradigm shift — post-32-critic audit, 4 rounds × 8 critics)
**Status:** Under review

## Problem

The YouTube CMS section has rich analytics infrastructure (150+ metrics, 6-axis scoring, A/B testing with 4 types, intelligence API with 12 action types, optimization cycle state machine) but **no way to generate AI-ready prompts** from this data. The Reference page has "Copy Cowork Prompt" but it's generic — it points to pipeline docs, not YouTube-specific context.

Users copy prompts to Claude.ai/ChatGPT where the AI **cannot call the pipeline API directly**. API-reference-only prompts are useless in this context.

## Solution

**Textarea-first prompt system** matching the existing `CoworkRequestPanel` pattern:

1. User writes **what they want** in a textarea (free-form instructions)
2. System auto-appends **YouTube data context** (channel health, grades, analytics)
3. The 3 prompt "types" are **context presets** — they determine WHICH data is included, not what the AI does
4. Optional **MODE 2 API appendix** for write-back (when AI has HTTP tools)

This mirrors the pipeline's `buildPrompt(userInstructions, context)` pattern exactly. The user drives the question; the system provides the data.

## Blocking Prerequisites

Before Phase 1 implementation, the following codebase reconciliations MUST be completed. These are not "nice to have" — they are functional blockers. Without them, every MODE 2 PATCH will fail with 422.

### P0: Reconcile `action_type` enums

**Current state (3 values overlap out of 12):**

| Canonical (intelligence-types.ts) | Zod schema (intelligence-schemas.ts) |
|---|---|
| `thumbnail_redesign` | `thumbnail_test` |
| `title_rewrite` | `title_test` |
| `description_seo` | `description_test` |
| `ab_test_thumb` | `combo_test` |
| `ab_test_title` | _(missing)_ |
| `retention_fix` | `retention_fix` ✓ |
| `content_strategy` | `content_series` |
| `publish_timing` | `publish_timing` ✓ |
| `series_opportunity` | `seo_optimization` |
| `chapters_add` | `engagement_boost` |
| `end_screen_optimize` | `end_screen_optimize` ✓ |
| `pinned_comment` | `community_post` |
| _(missing)_ | `distribution_expand` |

**Resolution:** Update Zod schema to match TypeScript types (canonical source). ~30 min.

### P0: Reconcile `notification` types

**Current state (2 values overlap out of 8-9):**

| TypeScript `NotificationTrigger` (9) | Zod `NotificationSchema.type` (8) |
|---|---|
| `ctr_drop` | `ctr_drop` ✓ |
| `grade_drop` | `grade_drop` ✓ |
| `stagnant_after_test` | `retest_suggested` |
| `optimization_opportunity` | `optimization_available` |
| `viral_detection` | `trending_viral` |
| `retention_cliff` | `monitoring_alert` |
| `search_surge` | _(missing)_ |
| `milestone_approaching` | _(missing)_ |
| `ab_test_ready` | `ab_test_completed` |
| _(missing)_ | `optimization_resolved` |

**Resolution:** Update Zod schema to match TypeScript types. Add `optimization_resolved` to TypeScript type (valid new trigger for resolved optimization cycles). ~30 min.

### P0: Reconcile PATCH payload structure

The Zod `PatchPayloadSchema` uses a **flat, simplified** structure. The TypeScript `IntelligencePatchPayload` uses a **nested, rich** structure. These serve different purposes:

- **Zod schema = AI input contract** (what the AI sends via PATCH)
- **TypeScript types = internal storage** (server transforms AI input to rich storage)

This spec documents the **Zod schema** as the PATCH contract since that is what validates at runtime. The server is responsible for enriching flat input into the nested TypeScript structures.

**Key structural differences to preserve (not bugs):**

| Dimension | Zod (AI input) | TypeScript (storage) |
|---|---|---|
| Recommendations | Flat `{ video_id, action_type, ... }[]` | Nested `VideoRecommendationGroup[] → recommendations[]` |
| Coaching priorities | `{ axis, score, diagnosis, action }` | `{ rank, action, impact, effort, estimated_lift, timeline }` |
| Notifications | `{ type, video_id, priority(1-5), title, message }` | `{ trigger, severity, video_id, message, suggested_action, data }` |
| Channel insights | `{ patterns_detected, analysis_text }` | `{ patterns_detected, strengths[], weaknesses[], opportunities[] }` |

**Resolution:** Server PATCH handler transforms flat input → rich storage. No Zod structural changes needed — only enum values. ~1h for transform layer.

### P1: Tighten Zod validation

Current Zod schema has loose `z.string()` where enums/regex are needed:

```typescript
// intelligence-schemas.ts — changes needed:
category: z.string(),       // → z.enum([...PatternCategory values])
pattern_id: z.string(),     // → z.string().regex(/^pat_[a-z0-9]{8}$/)
sample_size: z.number().int(), // → z.number().int().min(0).max(1000)
// Add to PatchPayloadSchema:
prompt_version: z.string().regex(/^yt-[a-z]{2}-v\d+$/).optional(),
```

### P1: Add `youtube_videos.version` column

CMS notes concurrency uses optimistic locking via a `version` integer:

```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS cms_notes text;
```

Migration via `npm run db:new youtube-videos-version-notes`. ~15 min.

### P1: Document health score axis mismatch

**Scoring engine** (`scoring-types.ts`): 6 axes — `ctr | retention | reach | engagement | growth | sub_impact`
**Intelligence GET response** (`intelligence-types.ts`): 5 axes — `ctr | retention | growth | engagement | frequency`

Missing in intelligence GET: `reach`, `sub_impact`. Extra in intelligence GET: `frequency`.
The intelligence GET uses `HealthGrade = 'excellent' | 'good' | 'average' | 'below_average' | 'critical'` while video grades use `Grade = 'A' | 'B' | 'C' | 'D'`.

**For prompts:** Use the 6-axis system from scoring-types.ts (canonical scoring engine). The prompt builder computes scores from raw data, not from the intelligence GET health_score breakdown. Channel Health context shows letter grades (A/B/C/D) per axis, matching the video grade system for consistency.

**Estimated prerequisite effort:** ~3.5h total (P0 + P1).

## Phased Delivery (revised: ~25h MVP)

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **Phase 1 (MVP)** | Textarea + 3 context presets + drawer | **~25h** | 80% of value |
| Phase 2 | Analytics preset (merged) + A/B Generator (gated) | ~12h | 15% |
| Phase 3 | Direct AI API integration (replace copy-paste) | ~15h | Evolution |

**Why 25h, not 33h:** The textarea-first pattern eliminates complex multi-step prompt builders. Instead of 3 deterministic prompt generators with step-by-step analysis instructions, we have: `userInstructions + separator + JSON.stringify(contextData)`. The builder functions shrink from ~200 lines each to ~50 lines (context serialization only).

This spec covers Phase 1 fully and Phase 2 as a design sketch. Phase 3 is deferred but has a defined trigger (see Phase 3 section).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  User writes instructions in textarea                     │
│  "Por que meu CTR caiu essa semana?"                     │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  buildYoutubePrompt(instructions, contextPreset, data)   │
│  = instructions + separator + persona + context JSON      │
│    + guardrails + optional MODE 2 appendix               │
└──────────────┬───────────────────────────────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Content    Channel        Video        ← context presets
 Calendar   Health         Optimizer       (which data to include)
    Phase 1 ──────────────────
    ┌──────────┬──────────────┐
    ▼          ▼              (Phase 2)
 Analytics   A/B Test
 Deep Dive   Generator
```

### Core Pattern: Instructions + Context (matching CoworkRequestPanel)

The prompt is built in TWO parts, separated by a clear delimiter:

```
{userInstructions}

---

# Contexto do Canal (dados inline — use apenas estes dados para responder)

# IDIOMA: PT-BR obrigatorio
Responda 100% em portugues brasileiro.
Se o usuario escreveu em ingles: entenda em ingles, responda em PT-BR.

# Persona
Voce e um analista de YouTube especializado em otimizacao de canais pequenos/medios.
Comportamento: data-driven, sem especulacao. Toda afirmacao deve ser rastreavel aos dados abaixo.

## Dados de Analise (input — nao modifique)
{contextJSON}

## Guardrails
[hallucination prevention rules]

## Guia de Confianca
[confidence ranges]

=== PARE AQUI SE MODO 1 ===
Se voce NAO tem acesso a ferramentas HTTP: ignore tudo abaixo desta linha.

---

## MODO 2 — API Write-Back (OPCIONAL)
[API workflow + PATCH schema]

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

**Key differences from pipeline `buildPrompt`:**
- Pipeline appends ~200-400 chars of context. YouTube appends 1,000-5,000 chars of JSON data.
- Pipeline uses flat labeled lines. YouTube uses JSON blocks with explicit `## Dados de Analise` delimiter (critical for small model portability — prevents JSON being treated as instructions).
- `=== PARE AQUI SE MODO 1 ===` hard separator prevents small models (Llama 3.1, Gemini Flash) from bleeding MODE 2 into MODE 1.

### Empty Instructions Gate

**No instructions = no prompt = no copy.** Matching `CoworkRequestPanel`:

```typescript
const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt(instructions.trim(), contextPreset, data) : '',
  [instructions, contextPreset, data]
)
// Copy button disabled when !prompt
```

### Data Strategy: Context Presets (Inline-First)

Each preset determines WHICH data is included as context. The user's instructions determine WHAT the AI does with it.

| Preset | Data Included | Token Cost (context only) |
|--------|---------------|--------------------------|
| **Content Calendar** | Search terms, categories, outliers, timing, recent uploads | ~800-1,200 tokens |
| **Channel Health** | Health score, 6 axes, top/bottom videos, demographics, search terms, outliers, A/B results | ~1,200-1,500 tokens |
| **Video Optimizer** | Per-video grade, retention curve, traffic sources, optimization state, channel baseline | ~700-1,000 tokens |
| **User instructions** | Free-form (capped at 2,000 chars / ~570 tokens) | ~200-570 tokens |
| **Shared base** | Persona, guardrails, confidence guide, language directive | ~400 tokens |
| **MODE 2 appendix** | API workflow, PATCH schema, validation checklist (Channel Health + Video Optimizer only) | ~800 tokens |

### Two Modes (Critical for cross-model portability)

MODE 1 is the DEFAULT and ONLY mode for most users. MODE 2 is a labeled OPTIONAL appendix separated by a hard stop line.

**Every prompt MUST include `NAO tente fazer requisicoes HTTP` in the persona block**, even if it has no MODE 2. This prevents models from attempting API calls if URL-like text appears in channel data.

The `=== PARE AQUI SE MODO 1 ===` line is critical for Llama 3.1 8B and Gemini Flash 1.5, which frequently prime on HTTP patterns and attempt mock API calls even when labeled optional.

### System Persona (all prompts)

Embedded in the context block (after the separator, not in user instructions):

```
# Persona
Voce e um analista de YouTube especializado em otimizacao de canais pequenos/medios.
Seu papel: responder a pergunta do usuario usando APENAS os dados abaixo.
Comportamento: data-driven, sem especulacao. Toda afirmacao deve ser rastreavel aos dados inline.
NAO tente fazer requisicoes HTTP.
```

### Thumbnail Handling

Thumbnails are handled in TWO places — a UI callout (for the human) and a data reference (for the AI):

**In the modal (UI element, NOT in the prompt text):**
A callout box below the textarea:
> "Para analise de thumbnail: abra a URL do thumbnail e cole como imagem no chat antes de colar o prompt. Sem imagem? O prompt funciona sem — baseia-se nos dados de CTR."

**In the context JSON (for the AI):**
```json
{ "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcY/hqdefault.jpg" }
```

URLs validated using `new URL(url).hostname === 'i.ytimg.com'` + strict path regex `/^\/vi\/[A-Za-z0-9_-]{11}\/[a-z]+\.jpg$/` + try-catch. YouTube video ID in URL path must match `video.youtube_video_id` (YouTube-assigned ID like `dQw4w9WgXcY`), NOT `video.id` (internal UUID). Query params and fragments stripped.

### Input Sanitization

Three sanitization contexts — **never mix them**:

**For JSON-embedded values — `sanitizeForJson(text: string | null | undefined): string`:**
Returns `JSON.stringify(text ?? '').slice(1, -1)` — the escaped inner content WITHOUT outer quotes. Null/undefined inputs coerce to empty string.

**For markdown prose sections** (video titles in headers) — `sanitizeForMarkdown(text: string, maxLen?: number): string`:
- Replace `#` with `\#`, `` ` `` with `'`, `|` with `\|`
- Replace `---`, `===`, `***` with `- - -`
- Strip `<`, `>`, `{`, `}`, `[`, `]`
- Replace literal `\n` with space
- Strip Unicode format characters (category Cf)
- Enforce max length: titles 100 chars, descriptions 200 chars

**For user instructions — NO sanitization.** User instructions are intentional prose written by the user for their own AI session. They are NOT data fields. Sanitizing them would break legitimate use cases (user typing markdown headers, code snippets, etc.). This matches the pipeline `buildPrompt` which passes `expandedInstructions` verbatim.

**Note on `---` in prompt output:** The sanitizer strips `---` from DATA (titles, descriptions). The prompt BUILDER uses `---` and `===` as structural separators. User instructions may contain `---` — this is acceptable because they appear BEFORE the separator, not inside the context block.

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeForMarkdown(text: string, maxLen?: number): string
export function sanitizeForJson(text: string | null | undefined): string
export function estimateTokens(text: string): number    // chars / 3.5
export function estimateChars(text: string): number     // identity (for display)
```

### Prompt Versioning

Each context preset embeds a version string in the context JSON and PATCH body:

```typescript
// lib/youtube/prompt-types.ts
export const PROMPT_VERSIONS = {
  'channel-health': 'yt-ch-v6',
  'video-optimizer': 'yt-vo-v6',
  'content-calendar': 'yt-cc-v6',
} as const
```

Builders consume from this const object — a typo in a builder will cause a TypeScript error, not a silent 422.

## 3 Context Presets (Phase 1 MVP)

### 1. Content Calendar (default preset)

For small channels, "what should I create next and when?" is the highest-leverage question.

**Context JSON:**
```json
{
  "preset": "content-calendar",
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": {
    "name": "tnfigueiredo",
    "subscribers": 1234,
    "videoCount": 35,
    "tier": "micro"
  },
  "searchTerms": [
    { "term": "bangkok shopping", "views": 1200, "estimatedMinutesWatched": 840 }
  ],
  "topPerformingCategories": [
    { "categorySlug": "tutorials", "categoryName": "Tutoriais", "avgViews": 500, "avgRetention": 48, "videoCount": 8 }
  ],
  "demographics": { "topAge": "25-34", "topCountry": "Brasil", "topDevice": "Mobile" },
  "outlierSuccesses": [
    { "title": "...", "views": 1420, "modifiedZ": 2.8, "axis": "ctr" }
  ],
  "bestPerformingDay": "tuesday",
  "bestPerformingHour": 14,
  "recentUploads": [
    { "title": "...", "publishedAt": "2026-05-20T14:00:00Z", "categorySlug": "tutorials" }
  ],
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-cc-v6"
}
```

**Field mapping to codebase types:**
- `searchTerms` → `IntelligenceTrafficSources.top_search_terms` (views + estimatedMinutesWatched). Note: `estimatedMinutesWatched` is fetched from YouTube Analytics API via `fetchYtSearchTerms()` in analytics-client.ts, NOT from `IntelligenceTrafficSources` type (which has `ctr` instead). The fetch function returns the correct fields.
- `topPerformingCategories` → `IntelligenceContentPatterns.by_category` (mapped from `CategoryPerformance`)
- `outlierSuccesses` → computed via `computeOutliers()` from scoring.ts. Note: `OutlierResult` has `{ videoId, axis, modifiedZ, direction }` — the fetch function joins with `youtube_videos` to get `title` and `view_count`.
- `bestPerformingDay` → `IntelligenceTrends.best_performing_day` (lowercase day name)
- `bestPerformingHour` → `IntelligenceTrends.best_performing_hour` (0-23 integer)
- `current_time` → `formatISO(new Date())` from date-fns (preserves local timezone offset `-03:00`, NOT UTC `Z`)

**No MODE 2 for Content Calendar** — it is a planning tool, not a write-back analysis.

### 2. Channel Health (most comprehensive)

Full channel diagnostic context. Round-trip capable via MODE 2.

**Context JSON:**
```json
{
  "preset": "channel-health",
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": { "name": "tnfigueiredo", "subscribers": 1234, "videoCount": 35, "tier": "micro" },
  "healthScore": { "overall": 63, "axes": [
    { "axis": "ctr", "score": 52, "grade": "C", "benchmark": 50, "weight": 0.25 },
    { "axis": "retention", "score": 38, "grade": "D", "benchmark": 50, "weight": 0.25 },
    { "axis": "reach", "score": 60, "grade": "C", "benchmark": 50, "weight": 0.15 },
    { "axis": "engagement", "score": 70, "grade": "B", "benchmark": 50, "weight": 0.15 },
    { "axis": "growth", "score": 45, "grade": "C", "benchmark": 50, "weight": 0.12 },
    { "axis": "sub_impact", "score": 55, "grade": "C", "benchmark": 50, "weight": 0.08 }
  ]},
  "topVideos": [{ "id": "uuid", "youtubeVideoId": "dQw4w9WgXcY", "title": "...", "score": 80, "grade": "B", "retention": 48, "trend": "up", "lifecycleStage": "maturing" }],
  "bottomVideos": [{ "id": "uuid", "youtubeVideoId": "abc123XYZ-_", "title": "...", "score": 25, "grade": "D", "retention": 22, "trend": "down" }],
  "gradeDistribution": { "A": 0, "B": 5, "C": 18, "D": 12 },
  "demographics": { "topAge": "25-34 (38%)", "topCountry": "Brasil (72%)", "topDevice": "Mobile (65%)" },
  "searchTerms": [{ "term": "...", "views": 1200, "estimatedMinutesWatched": 840 }],
  "outliers": { "positive": [{ "title": "...", "modifiedZ": 2.8, "views": 1420 }], "negative": [{ "title": "...", "modifiedZ": -2.3, "views": 28 }] },
  "abTestResults": [{ "videoTitle": "...", "testType": "thumbnail", "winner": "B", "confidence": 0.96 }],
  "cyclesSummary": { "active": 2, "resolved": 1, "exhausted": 0 },
  "total_videos": 35,
  "showing_top_n": 5,
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-ch-v6"
}
```

**Field mapping:**
- `healthScore.axes` → computed from `scoring-types.ts` `AxisScore[]` (6 axes). `AxisScore` has `{ axis, raw, normalized, weight, weighted }` — the fetch function computes `score` (from `normalized`), `grade` (from `GRADE_THRESHOLDS`), and `benchmark` (sigmoid midpoint). These are NOT direct fields on `AxisScore`.
- `gradeDistribution` → A/B/C/D only. **No Grade "F" exists.**
- `topVideos/bottomVideos` → joined from `youtube_videos` + scoring data. `OutlierResult` has `{ videoId, axis, modifiedZ, direction }` — `title` and `views` require DB join.
- `total_videos` and `showing_top_n` make truncation explicit

**MODE 2 appendix (OPTIONAL — Channel Health + Video Optimizer only):**

Separated by the `=== PARE AQUI SE MODO 1 ===` hard stop. Contains:
1. Claim task (GET /task)
2. Load full snapshot (GET /intelligence)
3. Validation checklist (5 checks + coaching axis check + notification priority 1-5 check)
4. PATCH with schema

**PATCH body schema (MODE 2 only — matches Zod `PatchPayloadSchema`):**
```json
{
  "task_id": "<uuid>",
  "prompt_version": "yt-ch-v6",
  "video_recommendations": [{
    "video_id": "<uuid>",
    "action_type": "thumbnail_redesign | title_rewrite | description_seo | ab_test_thumb | ab_test_title | retention_fix | content_strategy | publish_timing | series_opportunity | chapters_add | end_screen_optimize | pinned_comment",
    "priority": "high | medium | low",
    "confidence": 0.0-1.0,
    "reasoning": "Max 500 chars, PT-BR",
    "suggested_variant_description": "Optional, max 200 chars"
  }],
  "coaching": {
    "summary": "Max 500 chars",
    "priorities": [{
      "axis": "ctr | retention | reach | engagement | growth | sub_impact",
      "score": 0-10,
      "diagnosis": "Max 300 chars",
      "action": "Max 300 chars"
    }]
  },
  "notifications": [{
    "type": "ctr_drop | grade_drop | stagnant_after_test | optimization_opportunity | viral_detection | retention_cliff | search_surge | milestone_approaching | ab_test_ready | optimization_resolved",
    "video_id": "<optional uuid>",
    "priority": 1-5,
    "title": "Max 100 chars",
    "message": "Max 500 chars"
  }],
  "channel_insights": {
    "prompt_version": "yt-ch-v6",
    "patterns_detected": [{
      "pattern_id": "pat_<8 lowercase alphanumeric>",
      "category": "thumbnail_style | title_pattern | content_type | publish_timing | duration_sweet_spot | traffic_source | engagement_driver | retention_pattern | growth_lever",
      "finding": "Max 300 chars",
      "confidence": 0.0-1.0,
      "sample_size": 0-1000
    }],
    "analysis_text": "Max 2000 chars"
  }
}
```

**Minimal PATCH example:**

> Os UUIDs abaixo sao placeholders. Substitua pelo `task_id` real do GET /task e pelos `video_id` reais do GET /intelligence.

```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prompt_version": "yt-ch-v6",
  "video_recommendations": [{
    "video_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "action_type": "thumbnail_redesign",
    "priority": "high",
    "confidence": 0.8,
    "reasoning": "Retencao 22% esta 51% abaixo da mediana do canal (45%)."
  }],
  "coaching": { "summary": "Foco imediato em retencao...", "priorities": [{ "axis": "retention", "score": 4, "diagnosis": "...", "action": "..." }] },
  "notifications": [],
  "channel_insights": { "prompt_version": "yt-ch-v6", "patterns_detected": [], "analysis_text": "..." }
}
```

**Constraints:** Max 25 recommendations, 20 notifications, 6 coaching priorities per PATCH.

### 3. Video Optimizer (per-video context)

Per-video focused context from the Video Optimizer drawer.

**Context JSON:**
```json
{
  "preset": "video-optimizer",
  "current_time": "2026-05-27T16:00:00-03:00",
  "video": {
    "id": "uuid", "youtubeVideoId": "dQw4w9WgXcY",
    "title": "...", "thumbnailUrl": "...",
    "duration": "38:51", "publishedAt": "2026-04-15", "ageDays": 42,
    "lifecycleStage": "maturing", "viewCount": 118
  },
  "grade": {
    "score": 63, "grade": "C",
    "axes": [
      { "axis": "ctr", "score": 52, "channelMedian": 48, "status": "above" },
      { "axis": "retention", "score": 38, "channelMedian": 45, "status": "below" }
    ],
    "trend": "up", "streak": 3
  },
  "retentionCurve": [100, 85, 72, 60, 52, 45, 40, 38, 35, 33],
  "trafficSources": { "browse": 45, "search": 25, "suggested": 20, "other": 10 },
  "optimizationState": "flagged",
  "cycleNumber": 1,
  "maxCycles": 5,
  "cooldownUntil": null,
  "previousDiagnosis": null,
  "channelBaseline": { "medianCtr": 3.6, "medianRetention": 45 },
  "snapshot_at": "2026-05-27T14:30:00-03:00",
  "snapshot_age_hours": 1.5,
  "prompt_version": "yt-vo-v6"
}
```

**MODE 2 appendix:** Same PATCH schema as Channel Health. Same validation checklist. Same hard stop separator.

## Phase 2 Context Presets (design sketch)

### 4. Analytics Deep Dive (merged — was 4 separate variants)

Single context preset with ALL analytics data inline (~600-800 tokens). No need for 4 separate variants.

### 5. A/B Test Generator (gated for micro+ channels)

**Gate condition:** Only enabled when `getChannelTier(subscriberCount) !== 'nano'`.

**Important:** With free-form textarea, a nano user could ASK about A/B testing in their instructions even with the gate active. The gate only controls whether A/B-specific DATA is included in the context. The persona block includes: "Para canais nano (< 1K subs): A/B testing nao e recomendado — foque em Content Calendar." This prevents the AI from generating A/B advice from Channel Health data when the user asks about it.

## Phase 3: Direct AI API (trigger condition)

**Trigger:** when prompt copy events from unique days exceed 3×/week for 4 consecutive weeks (tracked via `logPromptCopy` with day-of-copy dedup). Raw event count would misfire from a single power session — unique-day check ensures sustained demand.

Phase 3 scope: server-side prompt execution via AI SDK, response storage, "This week's insights" dashboard card. Design details deferred.

## Prompt-Wide Standards

### Hallucination Guardrails (embedded in context block)

```
## Guardrails
- APENAS cite numeros que aparecem nos dados inline.
- Se nao tem um dado, diga "dados insuficientes" — NAO estime.
- Toda afirmacao deve ser rastreavel: "Retencao do video X e 38% (inline data)".
- NAO emita padrao com sample_size < 5 videos.
- Se sample_size < 5, confidence DEVE ser <= 0.55 — regra hard, nao guideline.
- NAO infira causalidade de correlacao. Diga "correlacao observada" quando apropriado.
- NAO cite benchmarks externos (ex: "media da industria"). Use APENAS os benchmarks do JSON inline.
- NAO referencie videos que NAO estao nos dados.
- NAO invente video_id, URLs, ou identificadores.
- Se snapshot_age_hours > 48, recomende re-execucao do prompt com dados atualizados.
```

### Confidence Guide (embedded in context block)

```
## Guia de Confianca

Faixas de confianca (ranges, NAO valores exatos):

- high (>= 0.7): Padrao claro com 5+ data points
  Exemplo: "5 videos com face_close tiveram retencao > 45% vs media 38%" → confidence: 0.85

- medium (>= 0.5 e < 0.7): 2-3 data points
  Exemplo: "2 de 3 videos listicle tiveram views acima da media" → confidence: 0.6

- low (>= 0.3 e < 0.5): 1 data point ou correlacao especulativa
  Exemplo: "Video X teve CTR alto mas e o unico com este formato" → confidence: 0.4

- Abaixo de 0.3: NAO inclua como recomendacao.

IMPORTANTE: Prefira sub-estimar confianca. Se sample_size < 5, confidence DEVE ser <= 0.55.
```

### Language Directive (top AND bottom of context block)

```
# IDIOMA: PT-BR obrigatorio
Responda 100% em portugues brasileiro.
Se o usuario escreveu em ingles: entenda em ingles, responda em PT-BR.
Nomes de campos JSON permanecem em ingles.
Valores string no output DEVEM ser em PT-BR.

[... context block ...]

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

### Reasoning Model Guidance (immediately after persona, before data)

```
## Nota para modelos com raciocinio (o3, Claude thinking)
Use seus passos de raciocinio para cruzar dados dos blocos JSON e calcular metricas derivadas.
NAO gaste raciocinio em instrucoes HTTP que voce nao pode executar.
```

### Null Data Handling

When context data sections are null/empty, **omit them entirely** from the JSON. Add a note: `"_missing": ["demographics", "abTestResults"]` so the AI knows the data was absent, not zero.

### Token Budgets (revised for textarea-first)

| Component | Characters | Tokens (est.) |
|-----------|-----------|---------------|
| User instructions (max) | 2,000 chars | ~570 tokens |
| Shared base (persona, guardrails, confidence, language, reasoning note) | ~1,750 chars | ~500 tokens |
| Content Calendar context | ~3,000 chars | ~850 tokens |
| Channel Health context | ~4,500 chars | ~1,300 tokens |
| Video Optimizer context | ~2,800 chars | ~800 tokens |
| MODE 2 appendix | ~2,800 chars | ~800 tokens |
| **Total max (CH + MODE 2 + instructions)** | **~11,050 chars** | **~3,170 tokens** |

**Character count is the primary display metric** — token counts vary 20-35% across models.

**Overflow protection:** If total `estimateChars() > 10,000`, reduce to top 5 + bottom 3 videos, top 5 search terms. Add `"truncated": true` to context JSON.

### Small Channel Calibration

For channels with `getChannelTier(subscriberCount) === 'nano'` (< 1K subs):
- Persona includes: "Canal nano — foque em discoverability via search, long-tail keywords."
- A/B data excluded from context (gated)
- `confidence <= 0.55` hard cap when < 500 impressions

## UI Design

### 3 Levels of Buttons (visually differentiated)

**Level 1 — YouTube Header (primary CTA):**
Large gradient button: "✦ Copy Cowork Prompt" in indigo gradient. Opens main YouTube prompt modal. Always visible.

**Level 2 — Per-Tab Contextual (secondary, consistent placement):**
Smaller pill button, **always top-right of tab content area**:
- Overview: "🏥 Channel Health" → opens modal, pre-selects Channel Health preset
- Videos: "🎬 Video Optimizer" → opens modal, pre-selects Video Optimizer preset
- Analytics: "📊 Analytics Insight" → opens modal, pre-selects Analytics (Phase 2, dimmed)
- Each pill: `border-1 border-indigo-500/30 text-indigo-400 text-xs`
- **Visually distinct from navigation pills** (icon prefix + button styling)

**Level 3 — Per-Item (inline actions):**
- Video table rows: icon button (📋) + (🔍) with **text labels on hover/focus**
- In Video Optimizer drawer: "📋 Copiar Prompt" + "✦ Abrir no Claude" + "🧪 Sugerir A/B"
- Each: `text-[11px] border border-border` (minimum 11px for readability)

### YouTube Prompt Modal (textarea-first)

**File:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal.tsx`

**Layout (top to bottom):**

1. **Header**: "YouTube Cowork Prompt" + channel name + close button (✕)
2. **Context preset selector**: 3 cards in a row. Channel Health **highlighted by default** when opened from header/overview. Content Calendar when no specific preset. Each card shows: icon, name, data description, character estimate.
   - Default follows entry point: header button → Channel Health, Videos tab → Video Optimizer, Overview tab → Channel Health
3. **Video selector** (conditional: Video Optimizer only): combobox with `role="combobox"`, thumbnail + title + grade. Max 50 videos, debounced 300ms.
4. **Textarea**: Free-form instructions. Placeholder: "O que voce quer analisar ou melhorar? Ex: 'Por que meu CTR caiu essa semana?'" Max length: 2,000 chars. Character counter below.
   - Persistent hint below textarea (11px, muted): "Contexto do canal será incluído automaticamente abaixo."
5. **Thumbnail callout** (below textarea, amber left border): "💡 Para analise de thumbnail: cole a imagem no chat antes do prompt."
6. **Staleness warning** (conditional, amber badge): "⚠ Dados desatualizados (última sync: Xh atrás)" when `snapshot_age_hours > 24`. Shows in UI BEFORE copy, not delegated to AI.
7. **Prompt preview**: Two-section layout:
   - **Top section** (always visible): user instructions (reflected from textarea, editable in the textarea above)
   - **Bottom section** (collapsible, default collapsed): context JSON + guardrails + MODE 2. Label: "Contexto ({N} caracteres) ▸" / "▾"
8. **Footer**:
   - Left: `"{N} caracteres (~{T} tokens est.)"` — character count primary
   - Right: "Cancelar" (ghost) + "✦ Abrir no Claude" (secondary, disabled when `chars > 6000` or real key embedded) + "⌘↵ Copiar Prompt" (primary indigo gradient, **disabled when textarea is empty**)

**Pipeline Key handling:**
- `usePipelineKey(siteId)` hook — reads `cowork-pipeline-key-${siteId}` with fallback to `cowork-pipeline-key` (migration: read old → write scoped → keep old for pipeline modal)
- Default: `[SUA-KEY]` placeholder in MODE 2 section
- Toggle to embed actual key with amber warning
- **Key-in-clipboard guard**: on copy, scan prompt for strings matching key format (`pk_` prefix). Show amber toast if found regardless of toggle state.
- **Disable "Open in Claude" when real key is embedded** — key would appear in URL query param, visible in browser history and server logs.

**State management:**
```typescript
const [preset, setPreset] = useState<ContextPreset>(initialPreset)
const [instructions, setInstructions] = useState('')
const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)

// Empty gate — matching CoworkRequestPanel
const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt({ instructions: instructions.trim(), preset, data, video: selectedVideo }) : '',
  [instructions, preset, data, selectedVideo]
)
```

### Video Optimizer Drawer

**File:** `apps/web/src/app/cms/(authed)/youtube/videos/video-optimizer-drawer.tsx`

The drawer has a **compact textarea** for quick instructions. Narrower than modal (480px width), so the textarea is smaller (2 lines, expandable) with a focused placeholder: "O que quer melhorar neste video?"

**Decomposed into sub-components (6):**

```
video-optimizer-drawer.tsx          ← orchestrator
├── _components/
│   ├── drawer-header.tsx           ← title (line-clamp-2) + close + optimization badge
│   ├── thumbnail-with-grade.tsx    ← 16:9 thumbnail + grade badge overlay
│   ├── video-stats-card.tsx        ← metrics grid + retention sparkline + traffic sources text
│   ├── cms-notes-editor.tsx        ← textarea + 800ms debounce auto-save + status indicator
│   ├── drawer-prompt-section.tsx   ← compact textarea + copy/claude buttons (replaces drawer-action-buttons)
│   └── data-freshness-badge.tsx    ← amber badge when lastSyncedAt > 24h
```

**Note:** `drawer-action-buttons.tsx` renamed to `drawer-prompt-section.tsx` — it now includes a compact textarea matching the textarea-first pattern, not just buttons.

**Props (orchestrator):**
```typescript
interface VideoOptimizerDrawerProps {
  video: VideoRow | null        // null = closed
  onClose: () => void
  onCreateAbTest: (videoId: string, testType: string) => void
  onSaveNotes: (videoId: string, notes: string, version: number) => Promise<{ version: number }>
}
```

**Data loading, CMS notes concurrency, close-while-saving guard, responsive, prefetch, button disable logic:** All unchanged from Rev 5.

## Component Architecture

```
apps/web/src/
├── app/cms/(authed)/youtube/
│   ├── _components/
│   │   └── youtube-cowork-prompt-modal.tsx   ← main modal (textarea + preset selector + preview)
│   ├── videos/
│   │   ├── video-optimizer-drawer.tsx        ← orchestrator
│   │   ├── _components/                     ← 6 sub-components (incl. drawer-prompt-section)
│   │   └── actions.ts                       ← per-video fetch + saveVideoNotes()
│   ├── _actions/
│   │   └── youtube-actions.ts               ← channel-level fetch (health + calendar)
│   ├── analytics/_components/               ← per-tab contextual button (Phase 2)
│   └── layout.tsx                           ← + header "Copy Cowork Prompt" button
├── lib/youtube/
│   ├── prompt-builders.ts                   ← buildYoutubePrompt() + 3 context serializers
│   ├── prompt-types.ts                      ← TypeScript interfaces + PROMPT_VERSIONS const
│   └── prompt-sanitize.ts                   ← sanitizeForMarkdown(), sanitizeForJson(), estimateTokens()
├── hooks/
│   └── use-pipeline-key.ts                  ← shared hook (read/write/migration)
└── components/
    └── prompt-preview.tsx                   ← simple <pre> (NOT syntax-highlighted — matches CoworkRequestPanel)
```

**Note:** Channel-level fetchers (`fetchChannelHealthData`, `fetchContentCalendarData`) moved to `youtube/_actions/youtube-actions.ts` — separate from per-video fetchers in `videos/actions.ts`. Phase 2 adds `fetchAnalyticsData` to `youtube/_actions/`.

### Prompt Builder Function (single entry point)

```typescript
// lib/youtube/prompt-builders.ts

interface BuildYoutubePromptOptions {
  instructions: string                           // user-written, already trimmed, max 2000 chars
  preset: ContextPreset                          // 'channel-health' | 'video-optimizer' | 'content-calendar'
  data: ChannelHealthData | VideoOptimizationData | ContentCalendarData
  video?: VideoRow | null                        // for video-optimizer preset
  pipelineKey?: string                           // for MODE 2 appendix
  baseUrl?: string
  includeMode2?: boolean                         // default: true for CH + VO, false for CC
}

export function buildYoutubePrompt(options: BuildYoutubePromptOptions): string

// Internal helpers (not exported):
function serializeChannelHealthContext(data: ChannelHealthData): string
function serializeVideoOptimizerContext(data: VideoOptimizationData, video: VideoRow): string
function serializeContentCalendarContext(data: ContentCalendarData): string
function buildSharedBase(channelTier: ChannelTier): string   // persona + guardrails + confidence + language
function buildMode2Appendix(preset: string, pipelineKey: string, baseUrl: string): string
```

**Output structure:**
```
{instructions}

---

{sharedBase}

## Dados de Analise (input — nao modifique)
{contextJSON}

{reasoning model guidance}

=== PARE AQUI SE MODO 1 ===
Se voce NAO tem acesso a ferramentas HTTP: ignore tudo abaixo desta linha.

---

{mode2Appendix}

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

### Shared View Types (prompt-types.ts)

These types are prompt-specific projections — they do NOT exist in scoring-types.ts or intelligence-types.ts. The fetch functions project from DB/scoring data into these shapes.

```typescript
interface VideoGradeRow {
  id: string                    // youtube_videos.id (UUID)
  youtubeVideoId: string        // youtube_videos.youtube_video_id (e.g. "dQw4w9WgXcY")
  title: string                 // youtube_videos.title (JOIN required from OutlierResult)
  score: number                 // computed: weighted sum from AxisScore[].weighted
  grade: Grade                  // computed: GRADE_THRESHOLDS (A≥85, B≥65, C≥40, D<40)
  retention: number             // youtube_analytics.audience_retention_avg (JOIN)
  trend: TrendDirection         // computed: from last 3 scoring periods
  lifecycleStage?: VideoLifecycle  // computed: getVideoLifecycle(ageDays)
}

interface OutlierRow {
  title: string                 // youtube_videos.title (JOIN from OutlierResult.videoId)
  modifiedZ: number             // OutlierResult.modifiedZ
  views: number                 // youtube_videos.view_count (JOIN)
  axis?: Axis                   // OutlierResult.axis
}

interface AbTestResultRow {
  videoTitle: string            // youtube_videos.title (JOIN)
  testType: string              // 'thumbnail' | 'title' | 'description' | 'combo'
  winner: string                // 'A' | 'B' | 'none'
  confidence: number            // ab_tests.statistical_confidence
}
```

### Computed Field Provenance

| Field | Source | Computation |
|-------|--------|-------------|
| `healthScore.axes[].score` | `AxisScore.normalized` | Direct mapping from normalized (0-100) |
| `healthScore.axes[].grade` | computed | `GRADE_THRESHOLDS`: A≥85, B≥65, C≥40, D<40 |
| `healthScore.axes[].benchmark` | `ChannelBaseline` + sigmoid | Sigmoid midpoint at channel's subscriber count |
| `grade.axes[].channelMedian` | `ChannelBaseline` | Direct: `medianCtr`, `medianRetention` fields |
| `grade.axes[].status` | computed | `score >= channelMedian ? 'above' : 'below'` |
| `snapshot_age_hours` | computed | `(Date.now() - new Date(snapshotAt).getTime()) / 3_600_000`, rounded to 1 decimal. `snapshotAt` MUST be raw UTC DB string, not formatted local time. |
| `lifecycleStage` | computed | `getVideoLifecycle(ageDays)` |

## Edge Cases

### Textarea + Prompt Generation
| Case | Handling |
|------|----------|
| Empty textarea | Copy button disabled, preview shows nothing (gate) |
| Whitespace-only textarea | Treated as empty (`.trim()` gate) |
| Instructions > 2,000 chars | `maxLength` on textarea, character counter turns red |
| Instructions contain `---` or `===` | Allowed — user instructions appear before separator |
| Instructions in English | Allowed — persona says "entenda em ingles, responda em PT-BR" |
| Instructions reference videos not in context | AI guardrail: "NAO referencie videos que NAO estao nos dados" |
| No pipeline key | MODE 2 uses `[SUA-KEY]` placeholder. MODE 1 context works fine without key. |
| No channels configured | Disable all buttons, show "Connect a channel first" |
| 0 videos (new channel) | Omit video-related fields, `"_missing": ["topVideos", "bottomVideos"]` |
| 50+ videos | `total_videos` shows real count, `showing_top_n` shows truncated count |
| Prompt exceeds 10,000 chars | Truncate: top 5 + bottom 3 videos, top 5 search terms, `"truncated": true` |
| snapshot_age_hours > 24 | UI amber badge BEFORE copy + context includes `snapshot_age_hours` for AI |
| snapshot_age_hours > 48 | Context guardrail: AI recommends re-running with fresh data |
| Preset switch with non-empty textarea | Instructions persist, context changes. Accepted — user's question stays. |
| Key accidentally in textarea | On copy, scan for `pk_` prefix → amber toast if found |

### Video Optimizer Drawer
Same as Rev 5 — unchanged.

### Accessibility
Same as Rev 5 — unchanged. Plus:
- Textarea in modal: `aria-label="Instruções para o AI"`, auto-focus on open
- Textarea in drawer: `aria-label="O que quer melhorar neste video?"`, not auto-focused (drawer opens showing video data first)
- Character counter: `aria-live="polite"` when approaching limit

### Security
Same as Rev 5 — unchanged. Plus:
- User instructions: NOT sanitized (intentional prose, matches pipeline `buildPrompt`)
- Key-in-clipboard guard: scan for `pk_` prefix on copy
- "Open in Claude" disabled when real key embedded (URL exposure risk)
- Textarea `maxLength=2000` prevents token budget overflow

## Visual Style

Use existing CMS color system (`--cms-*` tokens) throughout. Indigo accent (`#6366f1`) for prompt-related buttons. Fix `#da3633` red → `#f85149` for WCAG AA compliance.

## Implementation Notes

1. **[BLOCKING] Reconcile action_type enums** — see Prerequisites
2. **[BLOCKING] Reconcile notification type enums** — see Prerequisites
3. **[BLOCKING] Tighten Zod validation** — see Prerequisites
4. **Add `bestPublishDay/Hour` computation** from `published_at` dates
5. **Impressions data** currently hardcoded to 0. Sub_impact axis dead weight until real.
6. **Per-video intelligence query** — add `?video_id=X` to GET endpoint
7. **Reconcile SIGMOID_STEEPNESS keys** — `growth_velocity`/`subscriber_impact` vs `growth`/`sub_impact`
8. **`top_search_terms.ctr`** — make optional or remove (never populated)
9. **PATCH input → storage transform** — server handler maps flat → nested
10. **`prompt-preview.tsx`** — use simple `<pre>` like CoworkRequestPanel, NOT syntax-highlighted component. Shared copy-to-clipboard utility hook only.
11. **`logPromptCopy` must record day-of-copy** for Phase 3 unique-day trigger. Server-side PATCH handler should ALSO log `channel_id + prompt_version + task_id` independently of client-side audit.

## Implementation Estimate (Phase 1 MVP — revised for textarea-first)

| Component | Effort |
|-----------|--------|
| **Prerequisites** (Zod reconciliation + tightening + transform + migration) | 3.5h |
| `prompt-builders.ts` + `prompt-types.ts` + `prompt-sanitize.ts` | 2h |
| `youtube-cowork-prompt-modal.tsx` (textarea + 3 presets + preview) | 4h |
| `video-optimizer-drawer.tsx` + 6 sub-components (incl. drawer-prompt-section) | 4h |
| Fetch functions (video + channel-health + content-calendar + saveNotes) | 3h |
| `usePipelineKey()` shared hook + migration | 0.5h |
| Per-tab contextual buttons (Overview, Videos) | 0.5h |
| Header button + layout integration | 0.5h |
| Tests | **7h** |
| **Total Phase 1** | **~25h** |

### Test Plan (~155 cases, 7h)

**Prompt sanitization (20 cases, ~45 min):**
- `sanitizeForMarkdown`: `#`, backtick, `|`, `---`, `===`, `***`, `<tag>`, `<|endoftext|>`, `{`, `}`, `[`, `]`, `\n`, combined injection, empty string, Unicode Cf, max length, channel name, null guard
- `sanitizeForJson`: JSON.stringify delegation, special chars, control chars, unquoted, null→empty, undefined→empty
- `estimateTokens`: empty→0, known string, PT-BR Unicode, very long string

**Prompt builder (36 cases, ~1.5h):**
3 fixtures × 3 presets = 9 snapshot baselines:
- Empty instructions → returns empty string (gate test)
- Short instructions ("analise meu canal") → valid prompt with user text + context
- Instructions with injection chars → user text preserved verbatim, context sanitized

Per preset:
- Context JSON has correct fields and `prompt_version`
- `snapshot_age_hours` present
- Null data → `"_missing"` array
- MODE 2 present for CH + VO, absent for CC
- Hard stop `=== PARE AQUI SE MODO 1 ===` present when MODE 2 included
- Language directive at top and bottom of context block
- Persona includes "NAO tente fazer requisicoes HTTP"
- `PROMPT_VERSIONS` const used (not hardcoded strings)
- Overflow protection: >10,000 chars triggers truncation
- Nano channel calibration differences

**Modal component (38 cases, ~2h):**
- Preset selector: 3 presets render, default follows entry point
- Video selector: combobox for Video Optimizer, hidden for others
- **Textarea: empty = copy disabled, whitespace-only = disabled**
- **Textarea: typing enables copy button**
- **Textarea: persists across preset switches**
- **Textarea: max 2000 chars with counter**
- **Textarea: auto-focus on open**
- Preview: two-section (instructions visible, context collapsed)
- Copy: Cmd+Enter + Ctrl+Enter, toast, audit
- Open in Claude: correct URL, disabled when >6000 chars or real key
- **Key-in-clipboard guard: pk_ prefix scan on copy**
- Pipeline key: shared hook, migration, placeholder default
- Focus trap, focus rings, escape closes
- Loading skeleton, error banner, empty state
- Character count primary + token estimate secondary
- Staleness amber badge when snapshot_age_hours > 24
- Backdrop click closes, body scroll lock, clipboard fallback

**Drawer component (30 cases, ~1.5h):**
Same as Rev 5 plus:
- **Compact textarea in drawer-prompt-section**
- **Empty textarea = copy disabled in drawer too**
- **Drawer textarea placeholder: "O que quer melhorar neste video?"**

**Accessibility (12 cases, ~30 min):**
Same as Rev 5 plus textarea ARIA labels.

**Integration tests (9 cases, ~45 min):**
- Full modal flow: open → select preset → **type instructions** → copy → validate structure
- Drawer flow: open → **type instructions** → copy → validate
- Empty textarea flow: open → try copy → verify disabled
- Preset switch with instructions: type text → switch preset → verify instructions persist + context changes
- Error: 403/404/500 handled gracefully
- SessionStorage persistence
- Modal → drawer handoff
- `usePipelineKey` migration
- Key-in-clipboard detection

## Scoring (Post-32-Critic Audit — Rev 6)

| Dimension | R4 avg | Rev 6 Changes |
|-----------|--------|---------------|
| Prompt engineering | 41 | Textarea-first, instructions + context pattern, empty gate, user drives question |
| UX/UI design | 44 | Two-section preview, textarea placement, preset as data scope selector, staleness badge in UI |
| Architecture | 74 | Single `buildYoutubePrompt()` entry point, channel-level fetchers in own actions file, PROMPT_VERSIONS const |
| Data completeness | 62 | OutlierRow/VideoGradeRow JOIN documented, AxisScore→prompt field mapping clarified, estimatedMinutesWatched source noted |
| Security | 74 | User instructions NOT sanitized (intentional), key-in-clipboard guard, Open in Claude disabled with real key |
| Testing | 41 | 155 cases, 3 fixtures × 3 presets snapshots, empty-gate tests, textarea persistence tests |
| AI portability | 71 | Hard stop `=== PARE AQUI`, `## Dados de Analise` delimiter, English instructions handling, sample_size hard cap |
| Product strategy | 61 | 25h estimate (down from 33.5h), Phase 3 unique-day trigger, A/B gate in persona block |
