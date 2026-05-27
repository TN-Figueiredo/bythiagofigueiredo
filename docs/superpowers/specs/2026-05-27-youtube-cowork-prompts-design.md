# YouTube Cowork Prompt System

**Date:** 2026-05-27
**Revision:** 7 (26 fixes from Round 5 — 8 critics, avg 66/100)
**Status:** Under review

## Problem

The YouTube CMS section has rich analytics infrastructure (150+ metrics, 6-axis scoring, A/B testing with 4 types, intelligence API with 12 action types, optimization cycle state machine) but **no way to generate AI-ready prompts** from this data. The Reference page has "Copy Cowork Prompt" but it's generic — it points to pipeline docs, not YouTube-specific context.

Users copy prompts to Claude.ai/ChatGPT where the AI **cannot call the pipeline API directly**. API-reference-only prompts are useless in this context.

## Solution

**Textarea-first prompt system** matching the existing `CoworkRequestPanel` pattern:

1. User writes **what they want** in a textarea (free-form instructions)
2. System auto-appends **YouTube data context** (channel health, grades, analytics)
3. The 3 prompt "types" are **context presets** — they determine WHICH data is included, not what the AI does
4. Guardrails, persona, and context appear BEFORE user instructions — positional authority prevents instruction override

This mirrors the pipeline's `buildPrompt(userInstructions, context)` pattern exactly. The user drives the question; the system provides the data.

**MODE 2 (API write-back) is deferred to Phase 2.** Phase 1 prompts are analysis-only — no PATCH schema, no hard stop separator, no Zod reconciliation needed.

## Prerequisites

### Phase 1 Prerequisites (~1h)

**P1: Add `youtube_videos.version` column**

CMS notes concurrency uses optimistic locking via a `version` integer:

```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS cms_notes text;
```

Migration via `npm run db:new youtube-videos-version-notes`. ~15 min.

**P1: Canonicalize SIGMOID_K constants**

`scoring-types.ts` exports `SIGMOID_K` keyed by `Axis` (`growth`, `sub_impact`). `intelligence-types.ts` exports `SIGMOID_STEEPNESS` keyed by mismatched strings (`growth_velocity`, `subscriber_impact`). Canonicalize on `SIGMOID_K` from `scoring-types.ts`, delete the duplicate. ~30 min.

**P1: Document health score axis mismatch**

**Scoring engine** (`scoring-types.ts`): 6 axes — `ctr | retention | reach | engagement | growth | sub_impact`
**Intelligence GET response** (`intelligence-types.ts`): 5 axes — `ctr | retention | growth | engagement | frequency`

Missing in intelligence GET: `reach`, `sub_impact`. Extra in intelligence GET: `frequency`.
The intelligence GET uses `HealthGrade = 'excellent' | 'good' | 'average' | 'below_average' | 'critical'` while video grades use `Grade = 'A' | 'B' | 'C' | 'D'`.

**For prompts:** Use the 6-axis system from scoring-types.ts (canonical scoring engine). The prompt builder computes scores from raw data, not from the intelligence GET health_score breakdown. Channel Health context shows letter grades (A/B/C/D) per axis, matching the video grade system for consistency.

### Phase 2 Prerequisites (~3h — deferred, needed only for MODE 2)

These are NOT Phase 1 blockers. They become blocking when MODE 2 (API write-back) is implemented in Phase 2.

**P0: Reconcile `action_type` enums**

| Canonical (intelligence-types.ts) | Zod schema (intelligence-schemas.ts) |
|---|---|
| `thumbnail_redesign` | `thumbnail_test` |
| `title_rewrite` | `title_test` |
| `description_seo` | `description_test` |
| `ab_test_thumb` | `combo_test` |
| `ab_test_title` | _(missing)_ |
| `retention_fix` | `retention_fix` |
| `content_strategy` | `content_series` |
| `publish_timing` | `publish_timing` |
| `series_opportunity` | `seo_optimization` |
| `chapters_add` | `engagement_boost` |
| `end_screen_optimize` | `end_screen_optimize` |
| `pinned_comment` | `community_post` |
| _(missing)_ | `distribution_expand` |

Resolution: Update Zod schema to match TypeScript types. ~30 min.

**P0: Reconcile `notification` types**

| TypeScript `NotificationTrigger` (9) | Zod `NotificationSchema.type` (8) |
|---|---|
| `ctr_drop` | `ctr_drop` |
| `grade_drop` | `grade_drop` |
| `stagnant_after_test` | `retest_suggested` |
| `optimization_opportunity` | `optimization_available` |
| `viral_detection` | `trending_viral` |
| `retention_cliff` | `monitoring_alert` |
| `search_surge` | _(missing)_ |
| `milestone_approaching` | _(missing)_ |
| `ab_test_ready` | `ab_test_completed` |
| _(missing)_ | `optimization_resolved` |

Resolution: Update Zod schema to match TypeScript types. Add `optimization_resolved` to TypeScript type. ~30 min.

**P0: Add `prompt_version` to Zod PatchPayloadSchema**

```typescript
prompt_version: z.string().regex(/^yt-[a-z]{2}-v\d+$/).optional(),
```

**P1: Tighten Zod validation + PATCH transform layer**

Current Zod schema has loose `z.string()` where enums/regex are needed. Server PATCH handler transforms flat Zod input into nested TypeScript storage structures. ~1.5h total.

## Phased Delivery (~22h MVP)

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **Phase 1 (MVP)** | Textarea + 3 context presets + drawer (analysis-only) | **~22h** | 80% of value |
| Phase 2 | MODE 2 write-back + Analytics preset + A/B Generator | ~15h | 15% |
| Phase 3 | Direct AI API integration (replace copy-paste) | ~15h | Evolution |

**Why 22h, not 25h:** Deferring MODE 2 eliminates 3.5h of Zod prerequisites, the hard stop separator, MODE 2 builder/tests. Dropping Level 2 per-tab pills saves 0.5h. Slight increase in adversarial test coverage (+1h) partially offsets savings.

This spec covers Phase 1 fully and Phase 2/3 as design sketches.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  User writes instructions in textarea                     │
│  "Por que meu CTR caiu essa semana?"                     │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│  buildYoutubePrompt({ preset, data, instructions })      │
│  = persona + guardrails + context JSON + instructions    │
└──────────────┬───────────────────────────────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Content    Channel        Video        ← context presets
 Calendar   Health         Optimizer       (which data to include)
```

### Core Pattern: Guardrails-First, Instructions-Last

The prompt is built with system context BEFORE user instructions. This gives guardrails positional authority — a critical prompt engineering pattern that prevents user instructions from overriding safety rules.

```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

# Idioma: PT-BR obrigatório
Responda 100% em português brasileiro.
Se o usuário escreveu em inglês: entenda em inglês, responda em PT-BR.
Nomes de campos JSON permanecem em inglês.

# Persona
Você é um analista de YouTube especializado em otimização de canais pequenos/médios.
Seu papel: responder à pergunta do usuário usando APENAS os dados abaixo.
Comportamento: data-driven, sem especulação. Toda afirmação deve ser rastreável aos dados inline.
Não tente fazer requisições HTTP.

## Guardrails
[hallucination prevention rules]

## Guia de Confiança
[confidence tiers]

## Dados de Análise (input — não modifique)
```json
{contextJSON}
```

====== CONTEXT_BOUNDARY ======

## Pergunta do Usuário (responda usando os dados acima)
{userInstructions}

## LEMBRETE: resposta em PT-BR. Não mude para inglês.
```

**Key design decisions:**
- **Guardrails before instructions:** Prevents "ignore all previous instructions" attacks. The AI processes persona/rules first, establishing behavioral constraints before seeing user text.
- **JSON in fenced code block:** ```` ```json ``` ```` leverages code-block semantics trained across all models (Claude, GPT-4, Llama, Gemini). Prevents JSON values from being interpreted as instructions.
- **`====== CONTEXT_BOUNDARY ======` unique separator:** Replaces fragile `---` which users could accidentally type. Non-guessable, non-markdown, clearly structural.
- **English meta-instruction for language:** Paradoxically, English meta-instructions about language requirements are MORE reliable cross-model than PT-BR meta-instructions, because English instructions have stronger training signal.
- **Proper Portuguese accents:** `Não`, `Você`, `análise` instead of ASCII `NAO`, `Voce`, `analise` — stronger linguistic signal for models.

### Empty Instructions Gate

**No instructions = no prompt = no copy.** Matching `CoworkRequestPanel`:

```typescript
const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt({ instructions: instructions.trim(), preset, data }) : '',
  [instructions, preset, data]
)
// Copy button disabled when !prompt
```

### Data Strategy: Context Presets (Inline-First)

Each preset determines WHICH data is included as context. The user's instructions determine WHAT the AI does with it.

| Preset | Data Included | Char Cost (context only) |
|--------|---------------|--------------------------|
| **Content Calendar** | Search terms, categories, outliers, timing, recent uploads | ~3,000 chars |
| **Channel Health** | Health score, 6 axes, top/bottom videos, demographics, search terms, outliers, A/B results | ~4,500 chars |
| **Video Optimizer** | Per-video grade, retention curve, traffic sources, optimization state, channel baseline, thumbnail/title metadata | ~3,200 chars |
| **User instructions** | Free-form (capped at 2,000 chars) | up to 2,000 chars |
| **Shared base** | Persona, guardrails, confidence guide, language directive | ~1,750 chars |

### MODE 2: Deferred to Phase 2

Phase 1 prompts are **analysis-only** — the AI reads data and answers questions. No API write-back, no PATCH schema, no hard stop separator.

In Phase 2, MODE 2 is added as an **explicit checkbox** in the modal (default OFF). When checked, the MODE 2 appendix (PATCH schema + API workflow) is appended after the user instructions. When unchecked, it is not generated at all. This eliminates the cross-model portability problem of separator-based approaches — smaller models (Llama 3.1 8B, Gemini Flash) never see MODE 2 content unless the user explicitly opts in.

**Every prompt MUST include `Não tente fazer requisições HTTP` in the persona block**, even in Phase 1. This prevents models from attempting API calls if URL-like text appears in channel data.

### System Persona (all prompts)

Embedded in the context block, BEFORE user instructions:

```
# Persona
Você é um analista de YouTube especializado em otimização de canais pequenos/médios.
Seu papel: responder à pergunta do usuário usando APENAS os dados abaixo.
Comportamento: data-driven, sem especulação. Toda afirmação deve ser rastreável aos dados inline.
Não tente fazer requisições HTTP.
Se você tem capacidade de raciocínio interno, use-a para cruzar dados dos blocos JSON.
```

### Thumbnail Handling

**In the modal (UI element, NOT in the prompt text):**
A callout box below the textarea — **shown only when Video Optimizer preset is selected AND the selected video has a `thumbnailUrl`**:
> "Para análise de thumbnail: abra a URL do thumbnail e cole como imagem no chat antes de colar o prompt. Sem imagem? O prompt funciona sem — baseia-se nos dados de CTR."

**In the context JSON (for the AI):**
```json
{ "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcY/hqdefault.jpg" }
```

URLs validated by parsing with `new URL(url)`, checking `hostname === 'i.ytimg.com'` + strict path regex `/^\/vi\/[A-Za-z0-9_-]{11}\/[a-z]+\.jpg$/`, then **reconstructing** as `https://i.ytimg.com${pathname}` — dropping query/fragment by omission, not stripping. YouTube video ID in URL path must match `video.youtube_video_id` (YouTube-assigned ID like `dQw4w9WgXcY`), NOT `video.id` (internal UUID).

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeThumbnailUrl(url: string, expectedVideoId: string): string | null
```

### Input Sanitization

Three sanitization contexts — **never mix them**:

**For JSON-embedded values — `sanitizeForJson(text: string | null | undefined): string`:**
Returns `JSON.stringify(text ?? '').slice(1, -1)` — the escaped inner content WITHOUT outer quotes. Null/undefined inputs coerce to empty string.

**For markdown prose sections** (video titles in headers) — `sanitizeForMarkdown(text: string, maxLen?: number): string`:
- Replace `#` with `\#`, `` ` `` with `'`, `|` with `\|`
- Replace `---`, `===`, `***`, `====== CONTEXT_BOUNDARY ======` with `- - -`
- Strip `<`, `>`, `{`, `}`, `[`, `]`
- Replace literal `\n` with space
- Strip Unicode format characters (category Cf)
- Enforce max length: titles 100 chars, descriptions 200 chars

**For user instructions — NO sanitization.** User instructions are intentional prose written by the user for their own AI session. They are NOT data fields. Sanitizing them would break legitimate use cases (user typing markdown headers, code snippets, etc.). This matches the pipeline `buildPrompt` which passes `expandedInstructions` verbatim.

**Builder-level length validation (defense-in-depth):**
```typescript
function buildYoutubePrompt(options: BuildYoutubePromptOptions): string {
  const instructions = options.instructions.slice(0, 2000) // hard cap even if client bypasses maxLength
  // ...
}
```

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeForMarkdown(text: string, maxLen?: number): string
export function sanitizeForJson(text: string | null | undefined): string
export function sanitizeThumbnailUrl(url: string, expectedVideoId: string): string | null
export function estimateTokens(text: string): number    // chars / 3.5
export function estimateChars(text: string): number     // identity (for display)
```

### Prompt Versioning

Each context preset embeds a version string in the context JSON:

```typescript
// lib/youtube/prompt-types.ts
export const PROMPT_VERSIONS = {
  'channel-health': 'yt-ch-v7',
  'video-optimizer': 'yt-vo-v7',
  'content-calendar': 'yt-cc-v7',
} as const
```

Builders consume from this const object — a typo in a builder will cause a TypeScript error, not a silent mismatch.

## 3 Context Presets (Phase 1 MVP)

### 1. Content Calendar (default preset)

For small channels, "what should I create next and when?" is the highest-leverage question.

**Context JSON:**
```json
{
  "_idioma": "pt-br",
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
  "prompt_version": "yt-cc-v7"
}
```

**Field mapping to codebase types:**
- `searchTerms` → `IntelligenceTrafficSources.top_search_terms` (views + estimatedMinutesWatched). Note: `estimatedMinutesWatched` is fetched from YouTube Analytics API via `fetchYtSearchTerms()` in analytics-client.ts, NOT from `IntelligenceTrafficSources` type (which has `ctr` instead). **The Content Calendar fetcher must call `fetchYtSearchTerms()` directly** — this field cannot come from the intelligence GET endpoint.
- `topPerformingCategories` → `IntelligenceContentPatterns.by_category` (mapped from `CategoryPerformance`)
- `outlierSuccesses` → computed via `computeOutliers()` from scoring.ts. Note: `OutlierResult` has `{ videoId, axis, modifiedZ, direction }` — the fetch function joins with `youtube_videos` to get `title` and `view_count`.
- `bestPerformingDay` → `IntelligenceTrends.best_performing_day` (lowercase day name)
- `bestPerformingHour` → `IntelligenceTrends.best_performing_hour` (0-23 integer)
- `current_time` → `formatISO(new Date())` from date-fns (preserves local timezone offset `-03:00`, NOT UTC `Z`)

### 2. Channel Health (most comprehensive)

Full channel diagnostic context.

**Context JSON:**
```json
{
  "_idioma": "pt-br",
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
  "prompt_version": "yt-ch-v7"
}
```

**Field mapping:**
- `healthScore.axes` → computed from `scoring-types.ts` `AxisScore[]` (6 axes). `AxisScore` has `{ axis, raw, normalized, weight, weighted }` — the fetch function computes `score` (from `normalized`), `grade` (from `GRADE_THRESHOLDS`), and `benchmark` (sigmoid midpoint via `SIGMOID_K`). These are NOT direct fields on `AxisScore`.
- `gradeDistribution` → A/B/C/D only. **No Grade "F" exists.**
- `topVideos/bottomVideos` → joined from `youtube_videos` + scoring data. `OutlierResult` has `{ videoId, axis, modifiedZ, direction }` — `title` and `views` require DB join.
- `total_videos` and `showing_top_n` make truncation explicit

### 3. Video Optimizer (per-video context)

Per-video focused context from the Video Optimizer drawer.

**Context JSON:**
```json
{
  "_idioma": "pt-br",
  "preset": "video-optimizer",
  "current_time": "2026-05-27T16:00:00-03:00",
  "video": {
    "id": "uuid", "youtubeVideoId": "dQw4w9WgXcY",
    "title": "...", "thumbnailUrl": "...",
    "duration": "38:51", "publishedAt": "2026-04-15", "ageDays": 42,
    "lifecycleStage": "maturing", "viewCount": 118,
    "thumbnailTags": ["face_close", "text_overlay", "bright_colors"],
    "titlePattern": "how_to"
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
  "prompt_version": "yt-vo-v7"
}
```

**New fields vs Rev 6:**
- `thumbnailTags` → from `IntelligenceVideo.thumbnail_metadata` (face detection, text overlay, dominant colors). Available when intelligence data exists.
- `titlePattern` → from `IntelligenceVideo.title_metadata.pattern` (how_to, listicle, question, etc.). Highly valuable for title optimization prompts.

## Phase 2 Design Sketches

### 4. Analytics Deep Dive (merged — was 4 separate variants)

Single context preset with ALL analytics data inline (~600-800 tokens). No need for 4 separate variants.

### 5. A/B Test Generator

No explicit gate needed. If `abTestResults` is empty for a channel, it is simply omitted from the context JSON via the null-data handling rule. The AI naturally cannot generate A/B advice without A/B data. The persona block includes a soft note: "Para canais sem dados de A/B testing: foque em Content Calendar e otimização de conteúdo existente."

### MODE 2: API Write-Back (Phase 2)

Added as an **explicit checkbox** in the modal (default OFF, label: "Incluir instruções de API write-back"). When checked, the MODE 2 appendix is appended after user instructions. When unchecked, it is not generated.

**PATCH body schema (post-reconciliation target — Phase 2 prerequisites must be completed first):**
```json
{
  "task_id": "<uuid>",
  "prompt_version": "yt-ch-v7",
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
    "prompt_version": "yt-ch-v7",
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

**Constraints:** Max 25 recommendations, 20 notifications, 6 coaching priorities per PATCH.

**Zod/TypeScript reconciliation tables** (Reconcile action_type, Reconcile notification types, PATCH payload structure): See Phase 2 Prerequisites section above.

## Phase 3: Direct AI API (trigger condition)

**Trigger:** when prompt copy events from unique days exceed 2x/week for 2 consecutive weeks (tracked via `logPromptCopy` with day-of-copy dedup). Previous threshold (3x/week for 4 weeks) was unreachable for a solo creator uploading 1-2 videos/week.

Phase 3 scope: server-side prompt execution via AI SDK, response storage, "This week's insights" dashboard card. Design details deferred.

## Prompt-Wide Standards

### Hallucination Guardrails (embedded in context block)

```
## Guardrails
- APENAS cite números que aparecem nos dados inline.
- Se não tem um dado, diga "dados insuficientes" — NÃO estime.
- Toda afirmação deve ser rastreável: "Retenção do vídeo X é 38% (inline data)".
- NÃO emita padrão com sample_size < 5 vídeos.
- Se sample_size < 5, confiança DEVE ser medium ou low (nunca high).
- NÃO infira causalidade de correlação. Diga "correlação observada" quando apropriado.
- NÃO cite benchmarks externos (ex: "média da indústria"). Use APENAS os benchmarks do JSON inline.
- NÃO referencie vídeos que NÃO estão nos dados.
- NÃO invente video_id, URLs, ou identificadores.
- Se snapshot_age_hours > 48, recomende re-execução do prompt com dados atualizados.
```

### Confidence Guide (embedded in context block)

```
## Guia de Confiança

Três faixas de confiança (use categorias, NÃO valores exatos):

- high (0.7–0.9): Padrão claro com 5+ data points. Se sample_size < 5: nunca use high.
- medium (0.4–0.6): 2-3 data points ou correlação observada.
- low (0.2–0.3): 1 data point ou especulação baseada em dado único.
- Abaixo de 0.2: NÃO inclua como recomendação.

Arredonde confiança para incrementos de 0.1. NÃO use valores como 0.85 ou 0.73 — use 0.8 ou 0.7.
Prefira sub-estimar confiança.
```

### Language Directive (top AND bottom of context block)

```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

# Idioma: PT-BR obrigatório
Responda 100% em português brasileiro.
Se o usuário escreveu em inglês: entenda em inglês, responda em PT-BR.
Nomes de campos JSON permanecem em inglês.
Valores string no output DEVEM ser em PT-BR.

[... context block ...]

## LEMBRETE: resposta em PT-BR. Não mude para inglês.
```

### Null Data Handling

When context data sections are null/empty, **omit them entirely** from the JSON. Models naturally handle missing keys — the guardrail "Se não tem um dado, diga dados insuficientes" already covers this. No `_missing` meta-field needed.

### Token Budgets (revised for Phase 1 — no MODE 2)

| Component | Characters | Tokens (est.) |
|-----------|-----------|---------------|
| User instructions (max) | 2,000 chars | ~570 tokens |
| Shared base (persona, guardrails, confidence, language) | ~1,750 chars | ~500 tokens |
| Content Calendar context | ~3,000 chars | ~850 tokens |
| Channel Health context | ~4,500 chars | ~1,300 tokens |
| Video Optimizer context | ~3,200 chars | ~910 tokens |
| **Total max (CH + instructions)** | **~8,250 chars** | **~2,370 tokens** |

**Character count is the primary display metric** — shown only when total exceeds 6,000 chars. Below that, no counter in the footer.

**Overflow protection:** Applied in the **fetch layer** (server actions), NOT the prompt builder. Server actions cap data at: top 5 + bottom 3 videos, top 5 search terms when the serialized context would exceed 5,000 chars. The server action adds `"truncated": true` to the returned data. The prompt builder is a **pure serializer** that never mutates its input.

### Small Channel Calibration

For channels with `getChannelTier(subscriberCount) === 'nano'` (< 1K subs):
- Persona includes: "Canal nano — foque em discoverability via search, long-tail keywords."
- Confidence hard cap: `sample_size < 5 → medium or low only` (same for all tiers, but nano channels hit this more often)

## UI Design

### 2 Levels of Buttons

**Level 1 — YouTube Header (primary CTA):**
Large gradient button: "Copy Cowork Prompt" in indigo gradient. Opens main YouTube prompt modal. Always visible.

**Level 2 — Per-Item (inline actions):**
- Video table rows: icon button with **text labels on hover/focus**
- In Video Optimizer drawer: "Copiar Prompt" + "Abrir no Claude"
- Each: `text-[11px] border border-border` (minimum 11px for readability)

Per-tab contextual pills (Overview, Videos, Analytics) are removed. The modal's preset selector already handles preset switching — redundant entry points created cognitive overload.

### YouTube Prompt Modal (textarea-first)

**File:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal.tsx`

**Layout (top to bottom):**

1. **Header**: "YouTube Cowork Prompt" + channel name + close button
2. **Context preset selector**: 3 cards in a row. Channel Health **highlighted by default**. Each card shows: icon, name, data description, character estimate.
3. **Video selector** (conditional: Video Optimizer only): combobox with `role="combobox"`, thumbnail + title + grade. Max 50 videos, debounced 300ms.
4. **Textarea**: Free-form instructions. Placeholder: "O que você quer analisar ou melhorar? Ex: 'Por que meu CTR caiu essa semana?'" Max length: 2,000 chars.
   - Persistent hint below textarea (11px, muted): "Contexto do canal será incluído automaticamente abaixo."
5. **Thumbnail callout** (conditional: Video Optimizer preset AND selected video has `thumbnailUrl`, amber left border): "Para análise de thumbnail: cole a imagem no chat antes do prompt."
6. **Staleness warning** (conditional, amber badge): "Dados desatualizados (última sync: Xh atrás)" when `snapshot_age_hours > 24`. Shows in UI BEFORE copy, not delegated to AI.
7. **Prompt preview**: Two-section layout:
   - **Top section** (always visible): user instructions (reflected from textarea)
   - **Bottom section** (collapsible, **expanded on first use per-session**, collapsed after): context JSON + guardrails. Label: "Contexto ({N} caracteres)"
8. **Footer**:
   - Left: character count shown **only when > 6,000 chars** (approaching overflow). Below that, empty.
   - Right: "Cancelar" (ghost) + "Abrir no Claude" (secondary, disabled when `chars > 6000` or real key embedded) + "Copiar Prompt" (primary indigo gradient, **disabled when textarea is empty**, keyboard shortcut `Cmd+Enter` / `Ctrl+Enter`)

**Pipeline Key handling:**
- `usePipelineKey(siteId)` hook — reads `cowork-pipeline-key-${siteId}`. Migration: read old unscoped key → write scoped → **delete old unscoped key** (no lingering cross-tab risk).
- Default: `[SUA-KEY]` placeholder in MODE 2 section (Phase 2)
- Toggle to embed actual key with amber warning (Phase 2)
- **Key-in-clipboard guard**: on copy, scan prompt for strings matching key format (`pk_` prefix). Show amber toast if found regardless of toggle state.
- **Disable "Open in Claude" when real key is embedded** — key would appear in URL query param, visible in browser history.

**State management:**
```typescript
const [preset, setPreset] = useState<ContextPreset>(initialPreset)
const [instructions, setInstructions] = useState('')
const [selectedVideo, setSelectedVideo] = useState<VideoRow | null>(null)

// Empty gate — matching CoworkRequestPanel
const prompt = useMemo(
  () => instructions.trim() ? buildYoutubePrompt({ preset, data, instructions: instructions.trim() }) : '',
  [instructions, preset, data]
)
```

### Video Optimizer Drawer

**File:** `apps/web/src/app/cms/(authed)/youtube/videos/video-optimizer-drawer.tsx`

The drawer has a **compact textarea** for quick instructions. Narrower than modal (480px width), so the textarea is **3 lines minimum** (`min-h-[72px]`), expandable to 5 lines max before scrolling. Focused placeholder: "O que quer melhorar neste vídeo? Ex: O CTR caiu de 5% para 3%"

**Decomposed into sub-components (6):**

```
video-optimizer-drawer.tsx          <- orchestrator
├── _components/
│   ├── drawer-header.tsx           <- title (line-clamp-2) + close + optimization badge
│   ├── thumbnail-with-grade.tsx    <- 16:9 thumbnail + grade badge overlay
│   ├── video-stats-card.tsx        <- metrics grid + retention sparkline + traffic sources text
│   ├── cms-notes-editor.tsx        <- textarea + 800ms debounce auto-save + status indicator
│   ├── drawer-prompt-section.tsx   <- compact textarea + copy/claude buttons
│   └── data-freshness-badge.tsx    <- amber badge when lastSyncedAt > 24h
```

**Props (orchestrator):**
```typescript
interface VideoOptimizerDrawerProps {
  video: VideoRow | null        // null = closed
  onClose: () => void
  onCreateAbTest: (videoId: string, testType: string) => void
  onSaveNotes: (videoId: string, notes: string, version: number) => Promise<{ version: number }>
}
```

**Data loading, CMS notes concurrency, close-while-saving guard, responsive, prefetch, button disable logic:** All unchanged from Rev 5/6.

## Component Architecture

```
apps/web/src/
├── app/cms/(authed)/youtube/
│   ├── _components/
│   │   └── youtube-cowork-prompt-modal.tsx   <- main modal (textarea + preset selector + preview)
│   ├── videos/
│   │   ├── video-optimizer-drawer.tsx        <- orchestrator
│   │   ├── _components/                     <- 6 sub-components (incl. drawer-prompt-section)
│   │   └── actions.ts                       <- per-video fetch + saveVideoNotes()
│   ├── _actions/
│   │   └── youtube-actions.ts               <- channel-level fetch (health + calendar) + truncation
│   └── layout.tsx                           <- + header "Copy Cowork Prompt" button
├── lib/youtube/
│   ├── prompt-builders.ts                   <- buildYoutubePrompt() + 3 context serializers
│   ├── prompt-types.ts                      <- TypeScript interfaces + PROMPT_VERSIONS const
│   └── prompt-sanitize.ts                   <- sanitizeForMarkdown(), sanitizeForJson(), sanitizeThumbnailUrl()
├── hooks/
│   └── use-pipeline-key.ts                  <- shared hook (read/write/migration + cleanup)
└── components/
    └── prompt-preview.tsx                   <- simple <pre> (NOT syntax-highlighted)
```

### Prompt Builder Function (single entry point — discriminated union)

```typescript
// lib/youtube/prompt-builders.ts

type BuildYoutubePromptOptions =
  | { preset: 'channel-health'; data: ChannelHealthData; instructions: string }
  | { preset: 'video-optimizer'; data: VideoOptimizationData; video: VideoRow; instructions: string }
  | { preset: 'content-calendar'; data: ContentCalendarData; instructions: string }

export function buildYoutubePrompt(options: BuildYoutubePromptOptions): string

// Internal helpers (not exported):
function serializeChannelHealthContext(data: ChannelHealthData): string
function serializeVideoOptimizerContext(data: VideoOptimizationData, video: VideoRow): string
function serializeContentCalendarContext(data: ContentCalendarData): string
function buildSharedBase(channelTier: ChannelTier): string
```

**Output structure (Phase 1 — no MODE 2):**
```
LANGUAGE REQUIREMENT: All output MUST be in Brazilian Portuguese (PT-BR). No exceptions.

{sharedBase}

## Dados de Análise (input — não modifique)
```json
{contextJSON}
```

====== CONTEXT_BOUNDARY ======

## Pergunta do Usuário (responda usando os dados acima)
{instructions}

## LEMBRETE: resposta em PT-BR. Não mude para inglês.
```

**Type safety:** The discriminated union on `preset` ensures TypeScript rejects mismatches at compile time — passing `preset: 'video-optimizer'` with `ChannelHealthData` is a type error, not a runtime crash.

### Shared View Types (prompt-types.ts)

These types are prompt-specific projections. The fetch functions project from DB/scoring data into these shapes.

```typescript
interface VideoGradeRow {
  id: string                    // youtube_videos.id (UUID)
  youtubeVideoId: string        // youtube_videos.youtube_video_id (e.g. "dQw4w9WgXcY")
  title: string                 // youtube_videos.title (JOIN required from OutlierResult)
  score: number                 // computed: weighted sum from AxisScore[].weighted
  grade: Grade                  // computed: GRADE_THRESHOLDS (A>=85, B>=65, C>=40, D<40)
  retention: number             // youtube_analytics.audience_retention_avg (JOIN)
  trend: TrendDirection         // computed: from last 3 scoring periods
  lifecycleStage?: VideoLifecycle  // computed: getVideoLifecycle(ageDays)
  thumbnailTags?: string[]      // from IntelligenceVideo.thumbnail_metadata
  titlePattern?: string         // from IntelligenceVideo.title_metadata.pattern
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
| `healthScore.axes[].grade` | computed | `GRADE_THRESHOLDS`: A>=85, B>=65, C>=40, D<40 |
| `healthScore.axes[].benchmark` | `ChannelBaseline` + `SIGMOID_K` | Sigmoid midpoint at channel's subscriber count |
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
| Instructions > 2,000 chars | `maxLength` on textarea + builder-level `slice(0, 2000)` defense-in-depth |
| Instructions contain boundary separator | Allowed — instructions appear AFTER the `====== CONTEXT_BOUNDARY ======` in a labeled section |
| Instructions in English | Allowed — persona says "entenda em inglês, responda em PT-BR" |
| Instructions reference videos not in context | AI guardrail: "NÃO referencie vídeos que NÃO estão nos dados" |
| No pipeline key | MODE 2 deferred to Phase 2. Phase 1 works without any key. |
| No channels configured | Disable all buttons, show "Connect a channel first" |
| 0 videos (new channel) | Omit video-related fields (null-data handling) |
| 50+ videos | `total_videos` shows real count, `showing_top_n` shows truncated count. Truncation applied in fetch layer. |
| Prompt exceeds overflow threshold | Fetch layer already capped data. Builder adds `"truncated": true` note if present in data. |
| snapshot_age_hours > 24 | UI amber badge BEFORE copy + context includes `snapshot_age_hours` for AI |
| snapshot_age_hours > 48 | Context guardrail: AI recommends re-running with fresh data |
| Preset switch with non-empty textarea | Instructions persist, context changes. User's question stays. |
| Key accidentally in textarea | On copy, scan for `pk_` prefix -> amber toast if found |

### Video Optimizer Drawer
Same as Rev 5/6 — unchanged.

### Accessibility
- Textarea in modal: `aria-label="Instruções para o AI"`, auto-focus on open
- Textarea in drawer: `aria-label="O que quer melhorar neste vídeo?"`, not auto-focused (drawer opens showing video data first)
- Character counter: `aria-live="polite"` when approaching limit
- Focus trap in modal, focus rings, Escape closes
- Combobox: `role="combobox"`, `aria-expanded`, keyboard navigation
- Preset selector: `role="radiogroup"`, arrow key navigation

### Security
- User instructions: NOT sanitized (intentional prose, matches pipeline `buildPrompt`)
- **Builder-level length cap:** `instructions.slice(0, 2000)` regardless of client `maxLength`
- **Unique boundary separator:** `====== CONTEXT_BOUNDARY ======` instead of `---` — prevents instruction spoofing where user types `---\n## Dados de Análise` to inject fake context
- **Thumbnail URL reconstruction:** Parse with `new URL()`, validate hostname+pathname, reconstruct from components (drops query/fragment by omission)
- Key-in-clipboard guard: scan for `pk_` prefix on copy
- "Open in Claude" disabled when real key embedded (URL exposure risk)
- **Key migration cleanup:** Delete unscoped `cowork-pipeline-key` after migrating to scoped `cowork-pipeline-key-${siteId}`
- Privacy note on "Open in Claude": tooltip "Prompt aparecerá no histórico do navegador"

## Visual Style

Use existing CMS color system (`--cms-*` tokens) throughout. Indigo accent (`#6366f1`) for prompt-related buttons. Fix `#da3633` red -> `#f85149` for WCAG AA compliance.

## Implementation Notes

1. **Canonicalize SIGMOID_K** — delete `SIGMOID_STEEPNESS` from intelligence-types.ts, re-export from scoring-types.ts
2. **Add `bestPublishDay/Hour` computation** from `published_at` dates
3. **Impressions data** currently hardcoded to 0. Sub_impact axis dead weight until real.
4. **Per-video intelligence query** — add `?video_id=X` to GET endpoint
5. **`top_search_terms.ctr`** — make optional or remove (never populated)
6. **Content Calendar fetcher** must call `fetchYtSearchTerms()` directly for `estimatedMinutesWatched` (not available from intelligence GET)
7. **`prompt-preview.tsx`** — use simple `<pre>` like CoworkRequestPanel, NOT syntax-highlighted component
8. **`logPromptCopy` must record day-of-copy** for Phase 3 unique-day trigger
9. **Truncation in fetch layer** — server actions cap data, builder is pure serializer
10. **`_idioma` as first JSON key** — `"_idioma": "pt-br"` in every context JSON for cross-model language signal

## Implementation Estimate (Phase 1 MVP — ~22h)

| Component | Effort |
|-----------|--------|
| **Prerequisites** (version column + SIGMOID_K canonicalization) | 1h |
| `prompt-builders.ts` + `prompt-types.ts` + `prompt-sanitize.ts` | 2h |
| `youtube-cowork-prompt-modal.tsx` (textarea + 3 presets + preview) | 3.5h |
| `video-optimizer-drawer.tsx` + 6 sub-components (incl. drawer-prompt-section) | 4h |
| Fetch functions (video + channel-health + content-calendar + saveNotes + truncation) | 3h |
| `usePipelineKey()` shared hook + migration + cleanup | 0.5h |
| Header button + layout integration | 0.5h |
| Per-row video buttons (Level 2) | 0.5h |
| Tests | **8h** |
| **Total Phase 1** | **~23h** |

### Test Plan (~170 cases, 8h)

**Prompt sanitization (30 cases, ~1h):**
- `sanitizeForMarkdown`: `#`, backtick, `|`, `---`, `===`, `***`, `<tag>`, `<|endoftext|>`, `{`, `}`, `[`, `]`, `\n`, combined injection, empty string, Unicode Cf, max length, null guard
- `sanitizeForMarkdown` adversarial: separator forgery (`====== CONTEXT_BOUNDARY ======`), Unicode RTL override, zero-width space, surrogate pairs, nested escape sequences, video title containing "Ignore all previous instructions"
- `sanitizeForJson`: JSON.stringify delegation, special chars, control chars, unquoted, null->empty, undefined->empty
- `sanitizeThumbnailUrl`: valid URL, wrong hostname, path traversal, query injection, `javascript:` protocol, data URI, hostname spoofing (`i.ytimg.com.evil.com`), video ID mismatch, malformed URL
- `estimateTokens`: empty->0, known string, PT-BR Unicode, very long string

**Prompt builder (30 cases, ~1.5h):**
3 presets, value-assertion tests (NOT snapshots):
- Empty instructions -> returns empty string (gate test)
- Short instructions -> valid prompt with user text in labeled `## Pergunta do Usuário` section
- Instructions with injection chars -> user text preserved verbatim, context sanitized
- Builder-level `slice(0, 2000)` enforcement

Per preset (value assertions, not snapshots):
- Given fixture `normalized=52`, assert `score=52, grade="C"` in context JSON
- Context JSON has correct fields and `prompt_version` from `PROMPT_VERSIONS` const
- `_idioma` is first key in context JSON
- `snapshot_age_hours` present and correctly computed from fixture timestamp
- Null data -> field omitted (no `_missing` array)
- Language directive at top (English meta) and bottom (PT-BR LEMBRETE)
- Persona includes "Não tente fazer requisições HTTP"
- Persona before context, context before instructions (positional order)
- Guardrails before user instructions
- `====== CONTEXT_BOUNDARY ======` separator present between context and instructions
- JSON wrapped in fenced code block
- Nano channel calibration differences
- `thumbnailTags` and `titlePattern` present when intelligence data available

**Discriminated union type tests (3 cases):**
- Correct preset + data combination compiles
- Mismatched preset + data is a compile-time error (type-level assertion)
- Video Optimizer requires `video` field

**Modal component (35 cases, ~1.5h):**
- Preset selector: 3 presets render, Channel Health default
- Video selector: combobox for Video Optimizer, hidden for others
- **Textarea: empty = copy disabled, whitespace-only = disabled**
- **Textarea: typing enables copy button**
- **Textarea: persists across preset switches**
- **Textarea: max 2000 chars**
- **Textarea: auto-focus on open**
- Preview: two-section (instructions visible, context expanded on first use, collapsed after)
- Copy: Cmd+Enter + Ctrl+Enter, toast, audit
- Open in Claude: correct URL, disabled when >6000 chars or real key
- **Key-in-clipboard guard: pk_ prefix scan on copy**
- Pipeline key: shared hook, migration, **old key deleted after migration**
- Focus trap, focus rings, escape closes
- Loading skeleton, error banner, empty state
- Character count shown only when > 6,000 chars
- Staleness amber badge when snapshot_age_hours > 24
- Thumbnail callout: shown only for Video Optimizer with thumbnailUrl
- Backdrop click closes, body scroll lock, clipboard fallback
- "Open in Claude" privacy tooltip present

**Security test suite (12 cases, ~30 min):**
- Thumbnail URL validation: valid, wrong hostname, path traversal, query params stripped, `javascript:` blocked, data URI blocked, hostname spoofing blocked
- Key detection: `pk_` in instructions (amber toast), `pk_` substring in video title (false positive check), partial key match
- Builder enforces 2000 char cap independently of client maxLength
- "Open in Claude" disabled when key embedded

**Drawer component (28 cases, ~1.5h):**
Same as Rev 5/6 plus:
- **Compact textarea: 3 lines min, 5 lines max**
- **Empty textarea = copy disabled in drawer too**
- **Drawer textarea placeholder with example**

**Accessibility (12 cases, ~30 min):**
- Textarea ARIA labels (modal + drawer)
- Character counter `aria-live="polite"`
- Focus trap + keyboard navigation
- Combobox + radiogroup roles
- Escape closes modal
- Focus rings visible

**Integration tests (14 cases, ~1h):**
- Full modal flow: open -> select preset -> type instructions -> copy -> validate structure
- Drawer flow: open -> type instructions -> copy -> validate
- Empty textarea flow: open -> try copy -> verify disabled
- Preset switch with instructions: type -> switch preset -> verify instructions persist + context changes
- Error: 403/404/500 handled gracefully
- SessionStorage persistence
- Modal -> drawer handoff
- `usePipelineKey` migration + old key cleanup
- Key-in-clipboard detection
- Concurrent save conflict (409 response from saveVideoNotes)
- Rapid preset switching (stale data guard)
- Context preview: expanded on first use, collapsed after
- Staleness badge appears at threshold
- Truncation indicator when fetch layer capped data

**Concurrency tests (5 cases, ~30 min):**
- `saveVideoNotes` optimistic locking: version conflict returns 409
- Concurrent modal + drawer open (same video): independent state
- Rapid preset toggling: no stale useMemo closure
- Key migration: concurrent tabs don't race

## Scoring (Round 5 — 8 Critics, avg 66/100)

| Dimension | R5 Score | Rev 7 Changes |
|-----------|----------|---------------|
| Prompt engineering | 72 | Instructions after guardrails, unique boundary separator, confidence simplified, JSON in code fence |
| UX/UI design | 72 | Drop Level 2 pills, context expanded first use, thumbnail callout conditional, no token estimate, drawer 3-line min |
| Architecture | 72 | Discriminated union, truncation in fetch layer, SIGMOID_K canonicalized |
| Data completeness | 78 | fetchYtSearchTerms direct call documented, thumbnailTags/titlePattern added, prompt_version to P0 |
| Security | 72 | Builder-level length cap, URL reconstruction, unique separator, key migration cleanup, privacy tooltip |
| Test coverage | 52 | +30 adversarial/security tests, value assertions over snapshots, concurrency tests, 170 total cases |
| AI portability | 58 | Conditional MODE 2 exclusion, accents in PT-BR, English meta-instruction, code fence, no model-naming |
| Product strategy | 52 | MODE 2 deferred to Phase 2, Phase 3 trigger lowered, A/B gate removed, 22h estimate |
