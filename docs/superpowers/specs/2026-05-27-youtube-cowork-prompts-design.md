# YouTube Cowork Prompt System

**Date:** 2026-05-27
**Revision:** 5 (post-24-critic audit — 3 rounds × 8 critics)
**Status:** Under review

## Problem

The YouTube CMS section has rich analytics infrastructure (150+ metrics, 6-axis scoring, A/B testing with 4 types, intelligence API with 12 action types, optimization cycle state machine) but **no way to generate AI-ready prompts** from this data. The Reference page has "Copy Cowork Prompt" but it's generic — it points to pipeline docs, not YouTube-specific context.

Users copy prompts to Claude.ai/ChatGPT where the AI **cannot call the pipeline API directly**. API-reference-only prompts are useless in this context.

## Solution

Hybrid prompt system with **inline data snapshots** (works in any AI) + **optional API references** (for deeper analysis when AI tools are available) + **write-back instructions** (as optional appendix). The inline analysis mode is the PRIMARY path — not a fallback.

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

CMS notes concurrency uses optimistic locking via a `version` integer. The `youtube_videos` table needs:

```sql
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE youtube_videos ADD COLUMN IF NOT EXISTS cms_notes text;
```

Migration via `npm run db:new youtube-videos-version-notes`. ~15 min.

**Estimated prerequisite effort:** ~3.5h total (P0 + P1).

### P1: Document health score axis mismatch

**Scoring engine** (`scoring-types.ts`): 6 axes — `ctr | retention | reach | engagement | growth | sub_impact`
**Intelligence GET response** (`intelligence-types.ts`): 5 axes — `ctr | retention | growth | engagement | frequency`

Missing in intelligence GET: `reach`, `sub_impact`. Extra in intelligence GET: `frequency`.
The intelligence GET uses `HealthGrade = 'excellent' | 'good' | 'average' | 'below_average' | 'critical'` while video grades use `Grade = 'A' | 'B' | 'C' | 'D'`.

**For prompts:** Use the 6-axis system from scoring-types.ts (canonical scoring engine). The prompt builder computes scores from raw data, not from the intelligence GET health_score breakdown. Channel Health prompt shows letter grades (A/B/C/D) per axis, matching the video grade system for consistency.

## Phased Delivery (revised: ~33h MVP)

| Phase | Scope | Effort | Value |
|-------|-------|--------|-------|
| **Phase 1 (MVP)** | Content Calendar + Channel Health + Video Optimizer | **~33h** | 80% of value |
| Phase 2 | Analytics Deep Dive (merged) + A/B Generator (gated) | ~15h | 15% |
| Phase 3 | Direct AI API integration (replace copy-paste) | ~15h | Evolution |

This spec covers Phase 1 fully and Phase 2 as a design sketch. Phase 3 is deferred but has a defined trigger (see Phase 3 section).

## Architecture

```
┌──────────────────────────────────────────────────┐
│  buildYoutubePromptBase()                        │
│  Persona + Auth + Channel + Guardrails           │
└──────────────┬───────────────────────────────────┘
               │
    ┌──────────┼──────────────┐
    ▼          ▼              ▼
 Content    Channel        Video
 Calendar   Health         Optimizer
 (planning) (full)         (per-video)
    Phase 1 ──────────────────
    ┌──────────┬──────────────┐
    ▼          ▼              (Phase 2)
 Analytics   A/B Test
 Deep Dive   Generator
 (merged)    (gated)
```

### Data Strategy: Hybrid (Inline-First)

| Layer | Content | Token Cost |
|-------|---------|-----------|
| **Inline** (always present) | Channel summary, top 5 grades (JSON), demographics (compact), search terms (top 5) | 400-800 tokens |
| **Extended inline** (type-specific) | Type-specific data (retention curve, traffic sources, outliers) | 200-600 tokens |
| **API refs** (OPTIONAL appendix) | GET intelligence, GET ab-performance, full grade history | ~100 tokens/endpoint |
| **Write-back** (OPTIONAL appendix) | PATCH intelligence with recommendations | ~500 tokens (schema + example + validation) |
| **Total per prompt** | | **MODE 1: 1000-1800 inline. MODE 2: +800 API appendix = 1800-2600** |

### Two Modes (Critical for cross-model portability)

Every prompt is structured in two clearly separated modes:

```
## MODO 1 — Analise Inline (padrao)
[Persona + data + instructions + output format]
Analise os dados abaixo. NAO tente fazer requisicoes HTTP.

## MODO 2 — API Write-Back (OPCIONAL — apenas se voce pode executar HTTP)
Se voce tem acesso a ferramentas de requisicao HTTP, siga o workflow abaixo...
[API steps + PATCH schema + validation]

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

MODE 1 comes FIRST and is the DEFAULT. MODE 2 is a labeled OPTIONAL appendix. The language reminder appears AFTER MODE 2 to prevent English drift from reading English field names. This ensures correct behavior across Claude.ai, ChatGPT, Gemini, Llama, and reasoning models (o3, Claude thinking).

**Every prompt type MUST include the `## MODO 1` header and the `NAO tente fazer requisicoes HTTP` directive, even if it has no MODE 2 (like Content Calendar).** This prevents models from attempting API calls if URL-like text appears in channel data.

### System Persona (all prompts)

Every prompt starts with an explicit persona/role definition:

```
# Persona
Voce e um analista de YouTube especializado em otimizacao de canais pequenos/medios.
Seu papel: diagnosticar performance, identificar padroes nos dados, e recomendar acoes concretas.
Comportamento: data-driven, sem especulacao. Toda afirmacao deve ser rastreavel aos dados inline.
Formato de saida: JSON estruturado conforme especificado abaixo.
```

### Thumbnail Handling

Thumbnails are handled in TWO places — a UI callout (for the human) and a data reference (for the AI):

**In the modal preview (UI element, NOT in the prompt text):**
A callout box above the prompt preview:
> "Para analise de thumbnail: abra a URL do thumbnail e cole como imagem no chat antes de colar o prompt. Sem imagem? O prompt funciona sem — baseia-se nos dados de CTR."

**In the prompt (for the AI):**
```
Thumbnail URL: {thumbnailHqUrl}
(Sem imagem disponivel? Baseie-se nos dados de CTR e padroes vencedores abaixo.)
```

URLs validated using `new URL(url).hostname === 'i.ytimg.com'` with try-catch for malformed URLs. YouTube video ID in URL path (e.g. `/vi/{youtubeVideoId}/hqdefault.jpg`) must match `video.youtube_video_id` (the YouTube-assigned ID like `dQw4w9WgXcY`), NOT `video.id` (which is an internal UUID). Query params stripped.

### Input Sanitization

Two sanitization contexts — **never mix them**:

**For JSON-embedded values — `sanitizeForJson(text: string | null | undefined): string`:**
Returns `JSON.stringify(text ?? '').slice(1, -1)` — the escaped inner content WITHOUT outer quotes. Null/undefined inputs coerce to empty string (NOT `"null"` or thrown error). This allows safe embedding inside template literals that already provide quotes: `` `"title": "${sanitizeForJson(video.title)}"` ``. Handles all special characters (`"`, `\`, `/`, control chars, Unicode).

**For markdown prose sections** (video titles in headers, instructions) — `sanitizeForMarkdown(text: string, maxLen?: number): string`:
- Replace `#` with `\#` (prevents markdown header injection)
- Replace `` ` `` with `'` (prevents code block injection)
- Replace `|` with `\|` in table cells
- Replace `---`, `===`, `***` with `- - -` (prevents section delimiter injection)
- Strip `<` and `>` (prevents XML/tag injection like `<system>`, `<|endoftext|>`)
- Strip `{`, `}`, `[`, `]` outside JSON blocks (prevents JSON context breaking and array injection)
- Replace literal `\n` in input with space (prevents newline injection)
- Strip Unicode format characters (category Cf: U+200B zero-width space, U+202E RTL override, U+FEFF BOM, etc.) — prevents visual confusion in multilingual PT-BR content
- Enforce max length: titles 100 chars, descriptions 200 chars (truncate with `...`)

**Note on `---` in prompt output:** The sanitizer strips `---` from USER INPUT (titles, descriptions). The prompt BUILDER uses `---` as structural separators between MODE 1 and MODE 2. These are different contexts — the sanitizer never touches builder output, only user-generated content embedded within it.

**Scope:** Sanitize channel name, video titles, descriptions, search terms — all user-generated content.

```typescript
// lib/youtube/prompt-sanitize.ts
export function sanitizeForMarkdown(text: string, maxLen?: number): string
export function sanitizeForJson(text: string | null | undefined): string   // JSON.stringify(text ?? '').slice(1, -1)
export function estimateTokens(text: string): number    // character-based heuristic: chars / 3.5
```

### Inline Data Format

Use **JSON** for structured data (grades, axes, patterns) — every model parses JSON reliably. Use `sanitizeForJson()` for all string values within JSON blocks. Add `---` dividers between prose instruction sections and JSON data blocks to prevent Gemini context bleed.

### Prompt Versioning

Each builder embeds a version string in the prompt output and PATCH body:

```
prompt_version: "yt-ch-v4"  // Channel Health v4
prompt_version: "yt-vo-v4"  // Video Optimizer v4
prompt_version: "yt-cc-v4"  // Content Calendar v4
```

PATCH `channel_insights` includes `"prompt_version"` for tracking which prompt version produced which analysis.

## 3 Prompt Types (Phase 1 MVP)

### 1. Content Calendar (highest value for nano creators)

For small channels, "what should I create next and when?" is the highest-leverage question.

**Inline data (JSON):**
```json
{
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": {
    "name": "...",
    "subscribers": 1234,
    "videoCount": 35
  },
  "searchTerms": [
    { "term": "...", "views": 1200, "estimatedMinutesWatched": 840 }
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
  "prompt_version": "yt-cc-v4"
}
```

**Field mapping to codebase types:**
- `searchTerms` → `IntelligenceTrafficSources.top_search_terms` (views + estimatedMinutesWatched only; `ctr` field exists in the type but is NOT available from YouTube Analytics API — omitted intentionally)
- `topPerformingCategories` → `IntelligenceContentPatterns.by_category` (mapped from `CategoryPerformance`)
- `outlierSuccesses` → computed via `computeOutliers()` from `scoring.ts` (uses Modified Z-score with MAD). Field `modifiedZ` maps from `OutlierResult.modifiedZ`
- `bestPerformingDay` → `IntelligenceTrends.best_performing_day` (lowercase day name)
- `bestPerformingHour` → `IntelligenceTrends.best_performing_hour` (0-23 integer, no timezone — prompt builder adds user's timezone context)
- `current_time` → generated at prompt build time via `formatISO(new Date())` (uses `date-fns/formatISO` which preserves local timezone offset, e.g. `2026-05-27T16:00:00-03:00` — NOT `new Date().toISOString()` which returns UTC "Z" suffix)

**Content Calendar guardrails (creative output boundaries):**
```
## Guardrails Especificos — Content Calendar
- Sugira APENAS topicos derivados dos searchTerms e outlierSuccesses inline.
- NAO sugira topicos baseados em trending topics externos (voce nao tem esses dados).
- Para "estimated potential", use APENAS avgViews dos topPerformingCategories como baseline.
- Marque claramente o que e "baseado em dados" vs "extrapolacao criativa".
- Minimo 3 sugestoes. Se dados insuficientes para 3, diga "dados insuficientes para gerar calendario."
- Se dados insuficientes para 8 sugestoes, sugira menos. NAO invente para completar.
```

**MODE 1 instructions (default — inline analysis, all prompts include this framing):**
```
## MODO 1 — Analise Inline (padrao)
Analise os dados abaixo. NAO tente fazer requisicoes HTTP.

## Passo 1 de 3: Analise de Topicos
Cruze searchTerms + outlierSuccesses + topPerformingCategories.
Identifique gaps de conteudo e oportunidades de serie.
Derive minutesPerView (estimatedMinutesWatched / views) para priorizar termos por engajamento.

## Passo 2 de 3: Ideias de Video
Sugira 3-8 ideias baseadas nos dados. Para cada: titulo, keyword alvo, conceito de thumbnail, duracao estimada.

## Passo 3 de 3: Calendario 30 Dias
Monte calendario respeitando bestPerformingDay e bestPerformingHour.
```

**Output:** `{ "videoIdeas": [...], "calendar": [{ "week": 1, "date": "...", "title": "...", "keyword": "...", "thumbnailConcept": "...", "duration": "15-20min", "confidence": 0.7, "basedOn": "search term X + pattern Y" }] }`

**No MODE 2 for Content Calendar** — it is a planning tool, not a write-back analysis. The prompt explicitly includes the `NAO tente fazer requisicoes HTTP` directive.

### 2. Channel Health (Health Coach tab)

The most comprehensive prompt. Round-trip: reads → analyzes → writes back (MODE 2 only).

**Inline data (JSON):**
```json
{
  "current_time": "2026-05-27T16:00:00-03:00",
  "channel": { "name": "...", "subscribers": 1234, "videoCount": 35 },
  "healthScore": { "overall": 63, "axes": [
    { "axis": "ctr", "score": 52, "grade": "C", "benchmark": 50, "weight": 0.25 },
    { "axis": "retention", "score": 38, "grade": "D", "benchmark": 50, "weight": 0.25 },
    { "axis": "reach", "score": 60, "grade": "C", "benchmark": 50, "weight": 0.15 },
    { "axis": "engagement", "score": 70, "grade": "B", "benchmark": 50, "weight": 0.15 },
    { "axis": "growth", "score": 45, "grade": "C", "benchmark": 50, "weight": 0.12 },
    { "axis": "sub_impact", "score": 55, "grade": "C", "benchmark": 50, "weight": 0.08 }
  ]},
  "topVideos": [{ "id": "...", "title": "...", "score": 80, "grade": "B", "retention": 48, "trend": "up", "lifecycleStage": "maturing" }],
  "bottomVideos": [{ "id": "...", "title": "...", "score": 25, "grade": "D", "retention": 22, "trend": "down" }],
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
  "prompt_version": "yt-ch-v4"
}
```

**Field mapping to codebase types:**
- `healthScore.axes` → computed from `scoring-types.ts` `AxisScore[]` (6 axes). Grade is letter grade (A/B/C/D) from `GRADE_THRESHOLDS`, NOT `HealthGrade` from intelligence-types.ts. Weight is decimal (0.25, not "25%").
- `topVideos/bottomVideos.trend` → `TrendData.direction` values: `'up' | 'down' | 'flat'` (mapped from scoring-types.ts)
- `topVideos/bottomVideos.lifecycleStage` → `VideoLifecycle` from scoring-types.ts: `'fresh' | 'maturing' | 'established' | 'evergreen'` (computed from `ageDays`)
- `gradeDistribution` → A/B/C/D only. **No Grade "F" exists** — `scoring-types.ts` defines `Grade = 'A' | 'B' | 'C' | 'D'` with thresholds A≥85, B≥65, C≥40, D<40
- `outliers` → `OutlierResult` from scoring.ts `computeOutliers()`. Field `modifiedZ` is the actual field name.
- `total_videos` and `showing_top_n` make truncation explicit

**Note on searchTerms:** `ctr` per search term is NOT available from the YouTube Analytics API. The `IntelligenceTrafficSources.top_search_terms` type includes a `ctr` field but it is never populated with real data. Only `views` and `estimatedMinutesWatched` are returned from `fetchYtSearchTerms()` in analytics-client.ts.

**MODE 1 instructions (default — inline analysis):**
```
## MODO 1 — Analise Inline (padrao)
Analise os dados abaixo. NAO tente fazer requisicoes HTTP.

## Passo 1 de 4: Diagnostico Geral
Analise o healthScore e os 6 eixos. Identifique os 2 eixos mais fracos.

## Passo 2 de 4: Analise de Videos
Compare topVideos vs bottomVideos. Que padroes separam winners de losers?

## Passo 3 de 4: Recomendacoes
Para cada eixo fraco: 1 acao especifica, executavel em 7 dias.
Para cada bottomVideo: 1 quick win com maior impacto potencial.

## Passo 4 de 4: Output JSON
Estruture sua analise no formato JSON abaixo.
```

**Expected MODE 1 output format:**
```json
{
  "diagnosis": { "summary": "Max 500 chars", "weakestAxes": ["retention", "growth"], "keyInsight": "..." },
  "videoRecommendations": [{ "videoId": "...", "action": "...", "priority": "high|medium|low", "confidence": 0.7, "reasoning": "..." }],
  "patterns": [{ "finding": "...", "confidence": 0.8, "sampleSize": 5, "basedOn": "topVideos vs bottomVideos" }],
  "plan30d": ["Week 1: ...", "Week 2: ..."]
}
```

**MODE 2 appendix (OPTIONAL — only if AI has HTTP tool access):**
```
---
## MODO 2 — API Write-Back (OPCIONAL)
Se voce pode executar requisicoes HTTP, siga os passos abaixo para submeter
sua analise diretamente na API do pipeline.

## Passo 1 de 5: Claim Task
GET {baseUrl}/api/pipeline/youtube/intelligence/task
Header: X-Pipeline-Key: {key}
(204 = nenhuma task pendente. PARE.)

## Passo 2 de 5: Load Full Snapshot
GET {baseUrl}/api/pipeline/youtube/intelligence?channel_id={channelId}

## Passo 3 de 5: Analise (combine inline + GET response)

## Passo 4 de 5: Valide antes de submeter
1. Todos os video_id existem no response do GET? SIM/NAO
2. action_type esta na lista dos 12 tipos validos? SIM/NAO
3. confidence e um numero entre 0.0 e 1.0? SIM/NAO
4. reasoning cita valores numericos concretos? SIM/NAO
5. Nenhum texto excede o limite de caracteres? SIM/NAO
Se qualquer validacao falhar, corrija antes de submeter.

## Passo 5 de 5: Submit PATCH
PATCH {baseUrl}/api/pipeline/youtube/intelligence

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

**PATCH body schema (MODE 2 only — matches Zod `PatchPayloadSchema`):**
```json
{
  "task_id": "<uuid>",
  "prompt_version": "yt-ch-v4",
  "video_recommendations": [{
    "video_id": "<uuid>",
    "action_type": "thumbnail_redesign | title_rewrite | description_seo | ab_test_thumb | ab_test_title | retention_fix | content_strategy | publish_timing | series_opportunity | chapters_add | end_screen_optimize | pinned_comment",
    "priority": "high | medium | low",
    "confidence": 0.0-1.0,
    "reasoning": "Max 500 chars, PT-BR, cite valores concretos do inline data ou GET response",
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
    "prompt_version": "yt-ch-v4",
    "patterns_detected": [{
      "pattern_id": "pat_<8 lowercase alphanumeric chars>",
      "category": "thumbnail_style | title_pattern | content_type | publish_timing | duration_sweet_spot | traffic_source | engagement_driver | retention_pattern | growth_lever",
      "finding": "Max 300 chars",
      "confidence": 0.0-1.0,
      "sample_size": 0-1000
    }],
    "analysis_text": "Max 2000 chars"
  }
}
```

**Note:** `action_type` values match `RecommendationActionType` in `intelligence-types.ts`. `notification.type` values match `NotificationTrigger` plus `optimization_resolved`. The Zod schema must be updated to these values BEFORE implementation (see Blocking Prerequisites).

**Note:** The server transforms this flat PATCH input into the richer `IntelligencePatchPayload` TypeScript structure for storage. The AI does not need to know about the internal nested format (`VideoRecommendationGroup`, `CoachingPriority.rank/impact/effort/estimated_lift/timeline`, `IntelligenceNotification.trigger/severity/suggested_action/data`).

**Minimal PATCH example (embedded in MODE 2):**

> **Nota:** Os UUIDs abaixo sao placeholders. Substitua pelo `task_id` real do GET /task e pelos `video_id` reais do GET /intelligence.

```json
{
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prompt_version": "yt-ch-v4",
  "video_recommendations": [{
    "video_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "action_type": "thumbnail_redesign",
    "priority": "high",
    "confidence": 0.8,
    "reasoning": "Retencao 22% esta 51% abaixo da mediana do canal (45%). Thumbnail sem rosto e sem texto visivel em mobile.",
    "suggested_variant_description": "Close-up do rosto + texto '10 Coisas' em amarelo sobre fundo escuro"
  }],
  "coaching": { "summary": "Foco imediato em retencao...", "priorities": [{ "axis": "retention", "score": 4, "diagnosis": "...", "action": "..." }] },
  "notifications": [{ "type": "optimization_opportunity", "video_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "priority": 3, "title": "Oportunidade de thumbnail", "message": "..." }],
  "channel_insights": { "prompt_version": "yt-ch-v4", "patterns_detected": [], "analysis_text": "..." }
}
```

**Constraints:** Max 25 recommendations, 20 notifications, 6 coaching priorities per PATCH.

**Error handling (MODE 2):**
```
## Tratamento de Erros (MODO 2)
- Se qualquer GET retornar 404, 500, ou erro: PARE. Reporte o status e NAO prossiga.
- Se PATCH retornar 409: re-GET o resource e tente novamente com dados atualizados.
- Se PATCH retornar 422: revise seu JSON contra o schema acima e corrija.
```

### 3. Video Optimizer (Videos tab drawer)

Per-video focused prompt from the Video Optimizer drawer.

**Inline data (JSON):**
```json
{
  "current_time": "2026-05-27T16:00:00-03:00",
  "video": {
    "id": "...", "title": "...", "thumbnailUrl": "...",
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
  "prompt_version": "yt-vo-v4"
}
```

**Field mapping to codebase types:**
- `video.lifecycleStage` → `VideoLifecycle` from scoring-types.ts, computed from `ageDays` via `getVideoLifecycle()`
- `grade.grade` → `Grade` from scoring-types.ts: `'A' | 'B' | 'C' | 'D'`
- `grade.trend` → `TrendData.direction`: `'up' | 'down' | 'flat'` (NOT "stable" or "improving")
- `grade.streak` → `TrendData.streak`: number of consecutive periods in same direction
- `channelBaseline` → subset of `ChannelBaseline` from scoring-types.ts (full type has 9 fields; prompt uses 2 most relevant)

**MODE 1 instructions:**
```
## MODO 1 — Analise Inline (padrao)
Analise os dados abaixo. NAO tente fazer requisicoes HTTP.

## Passo 1 de 3: Diagnostico
Identifique 3 maiores problemas, ordenados por impacto.
- Se retencao < mediana: identifique segmento com maior queda (cite timestamp da curva)
- Se CTR < mediana: sugira A/B thumbnail com descricao da variante
- Se alcance baixo: sugira melhorias de SEO

## Passo 2 de 3: Plano de Acao
Para cada problema: 1 acao especifica executavel em 7 dias.
Priorize por impacto x esforco.

## Passo 3 de 3: Output JSON
```

**Expected MODE 1 output format:**
```json
{
  "diagnosis": [{ "problem": "...", "severity": "high|medium|low", "evidence": "retencao 38% vs mediana 45%" }],
  "actions": [{ "action": "...", "targetAxis": "retention", "expectedImpact": "...", "effort": "low|medium|high", "confidence": 0.7 }],
  "abSuggestion": { "testType": "thumbnail", "variantDescription": "...", "reasoning": "..." }
}
```

**MODE 2 appendix:** Same PATCH schema as Channel Health (video_recommendations + notifications). Same validation checklist. Ends with `## LEMBRETE: resposta em PT-BR.`

## Phase 2 Prompt Types (design sketch)

### 4. Analytics Deep Dive (merged — was 4 separate variants)

Single prompt that includes ALL analytics data inline. For a 35-video channel, the combined data (search terms, demographics, outliers, grades) fits in ~600-800 tokens total. No need for 4 separate variants.

**Inline data:** Channel summary + top 15 search terms + demographics + outliers + grade distribution + 6-axis breakdown.

**Task:** Comprehensive analytics analysis covering intent clusters, audience-content fit, pattern extraction, and weakest-axis targeting. Single JSON output with all sections.

### 5. A/B Test Generator (gated for micro+ channels)

**Gate condition:** Only enabled when `getChannelTier(subscriberCount) !== 'nano'` (uses `ChannelTier` from scoring-types.ts which has 5 tiers: nano/micro/small/medium/large). For nano channels, the button shows a tooltip: "A/B testing requer mais volume. Foque em Content Calendar."

**Note:** `ChannelSizeTier` in intelligence-types.ts has only 3 tiers (small/medium/large). The prompt system uses `ChannelTier` from scoring-types.ts which has 5 tiers. These are different enums for different purposes.

When enabled, includes power analysis with realistic MDE and duration estimates.

## Phase 3: Direct AI API (trigger condition)

Phase 3 replaces copy-paste with server-side AI integration. **Trigger:** when prompt copy events exceed 3×/week for 4 consecutive weeks (tracked via `logPromptCopy` audit). At that point, the manual copy-paste workflow is demonstrably a bottleneck.

Phase 3 scope: server-side prompt execution via AI SDK, response storage, "This week's insights" dashboard card, structured diff between AI recommendations and actual actions taken. Design details deferred.

## Prompt-Wide Standards

### Hallucination Guardrails (all prompts include)

```
## Guardrails
- APENAS cite numeros que aparecem nos dados inline.
- Se nao tem um dado, diga "dados insuficientes" — NAO estime.
- Toda afirmacao deve ser rastreavel: "Retencao do video X e 38% (inline data)".
- NAO emita padrao com sample_size < 5 videos.
- NAO infira causalidade de correlacao. Diga "correlacao observada" quando apropriado.
- NAO cite benchmarks externos (ex: "media da industria"). Use APENAS os benchmarks do JSON inline.
- NAO referencie videos que NAO estao nos dados. Se precisar de mais contexto, diga "dados insuficientes".
- NAO invente video_id, URLs, ou identificadores. Use APENAS os IDs dos dados inline.
- Se snapshot_age_hours > 48, recomende re-execucao do prompt com dados atualizados.
- Output JSON puro, SEM code fences markdown (sem ```json). O output sera parseado diretamente.
```

### Confidence Guide (all prompts include — with examples)

```
## Guia de Confianca (com exemplos)

Faixas de confianca (ranges, NAO valores exatos):

- high (>= 0.7): Padrao claro com 5+ data points, relacao causal plausivel
  Exemplo: "5 videos com face_close tiveram retencao > 45% vs media 38%" → confidence: 0.85

- medium (>= 0.5 e < 0.7): 2-3 data points, conexao logica mas sem prova direta
  Exemplo: "2 de 3 videos listicle tiveram views acima da media" → confidence: 0.6

- low (>= 0.3 e < 0.5): 1 data point ou correlacao especulativa
  Exemplo: "Video X teve CTR alto mas e o unico com este formato" → confidence: 0.4

- Abaixo de 0.3: NAO inclua como recomendacao. Cite como "observacao sem evidencia suficiente".

IMPORTANTE: Prefira sub-estimar confianca. 0.6 e mais util que 0.9 falso.

Mapeamento para prioridade:
- priority "high" requer confidence >= 0.7
- priority "medium" requer confidence >= 0.5 e < 0.7
- priority "low" requer confidence >= 0.3 e < 0.5
- confidence < 0.3: NAO gere recomendacao. Mencione como observacao apenas.
```

### Language Directive (top AND bottom of every prompt, INCLUDING after MODE 2)

```
# IDIOMA: PT-BR obrigatorio
Responda 100% em portugues brasileiro.
Termos tecnicos como CTR, SEO, thumbnail podem ficar em ingles.
Nomes de campos JSON permanecem em ingles.
Valores string dentro do JSON (reasoning, diagnosis, action, finding) DEVEM ser em PT-BR.
Todo o resto em PT-BR.

[... prompt content ...]

## LEMBRETE: resposta em PT-BR. Nao mude para ingles.
```

The bottom reminder MUST appear AFTER MODE 2 (not between MODE 1 and MODE 2) to prevent English drift from reading English field names in the PATCH schema.

### Small Channel Calibration

For channels with `getChannelTier(subscriberCount) === 'nano'` (< 1K subs per scoring-types.ts):
- Focus prompts on search-driven discoverability over browse/suggested
- Target long-tail keywords
- Mark all recommendations with < 500 impressions as `confidence: 0.5` max
- A/B tests: gated (Phase 2). Content Calendar is the primary optimization tool.
- Notification thresholds adjusted: `optimization_opportunity` at > 500 impressions (not 10K), `viral_detection` at 3x avg (not 5x)

### Reasoning Model Guidance (emitted after output format, before MODE 2 separator)

```
## Nota para modelos com raciocinio (o3, Claude thinking)
Use seus passos de raciocinio para:
1. Cruzar dados dos diferentes blocos JSON
2. Calcular metricas derivadas (ex: retencao relativa ao benchmark, minutesPerView)
3. Identificar padroes ANTES de concluir
NAO gaste raciocinio em instrucoes HTTP que voce nao pode executar (MODO 2).
```

### Null Data Handling

When inline data sections are null/empty, **omit them entirely** from the prompt (fewer tokens, cleaner signal). Add a note: `(Dados de {section} indisponiveis nesta snapshot)` so the AI knows the data was absent, not zero.

### Token Budgets (revised with tokenizer variance)

| Prompt Type | MODE 1 (inline only) | MODE 2 (+ API appendix) | Characters |
|-------------|---------------------|------------------------|------------|
| Content Calendar | ~1,200 tokens | N/A (no write-back) | ~4,200 chars |
| Channel Health | ~1,500 tokens | ~2,300 tokens | ~5,200 / ~8,000 chars |
| Video Optimizer | ~1,000 tokens | ~1,800 tokens | ~3,500 / ~6,300 chars |

**Note:** Token counts are approximate for cl100k_base (GPT-4). SentencePiece tokenizers (Llama) use 20-35% more tokens for PT-BR text. Character counts are tokenizer-agnostic and more reliable. Token budgets INCLUDE the shared base (persona, guardrails, confidence guide, language directive) — the builder emits a single complete prompt.

**Overflow protection:** If `estimateTokens() > 2500`, reduce to top 5 + bottom 3 videos, top 5 search terms. Add `"truncated": true` flag to inline JSON.

## UI Design

### 3 Levels of Buttons (visually differentiated)

**Level 1 — YouTube Header (primary CTA):**
Large gradient button: "Copy Cowork Prompt" in indigo gradient. Opens main YouTube prompt modal with type selector. Always visible.

**Level 2 — Per-Tab Contextual (secondary, consistent placement):**
Smaller pill button, **always top-right of tab content area** (consistent placement across all tabs):
- Overview: "Channel Health" → pre-selects Channel Health
- Videos: "Video Optimizer" → pre-selects Video Optimizer (shows video selector)
- Analytics: "Analytics Insight" → pre-selects Analytics (Phase 2)
- Each pill: `border-1 border-indigo-500/30 text-indigo-400 text-xs`
- **Visually distinct from navigation pills** (use icon prefix + button styling, not pill shape)

**Level 3 — Per-Item (inline actions):**
- Video table rows: icon button (copy prompt) + (open drawer) with **text labels on hover/focus**
- In Video Optimizer drawer: "Copy Optimizer Prompt" + "Sugerir A/B"
- Each: `text-[11px] border border-border` (minimum 11px for readability)

### YouTube Prompt Modal

**File:** `apps/web/src/app/cms/(authed)/youtube/_components/youtube-cowork-prompt-modal.tsx`

Independent from the pipeline cowork modal but follows the same patterns:
- Pipeline Key input (sessionStorage: read from `cowork-pipeline-key-${siteId}` with fallback to `cowork-pipeline-key` for migration)
- Shared `usePipelineKey(siteId)` hook consumed by both YouTube and pipeline modals
- Prompt type selector: 3 cards (Phase 1). Content Calendar **highlighted by default** with `border-2 border-indigo-500` + "(recomendado)" badge. Each card shows: icon, name, description, token estimate.
- Video selector (conditional: Video Optimizer only): combobox with `role="combobox"`, `aria-expanded`, thumbnail + title + grade badge per result. Max 50 recent videos sorted by published_at desc. Search debounced 300ms. Use Radix UI `Combobox` or equivalent accessible primitive.
- Syntax-highlighted preview: extract `PromptPreview` from `cowork-prompt-modal.tsx` into `components/prompt-preview.tsx`. Support `variant: 'pipeline' | 'youtube'`.
- **Thumbnail callout** (UI element above preview, NOT in prompt text): "Para analise de thumbnail: abra a URL e cole como imagem no chat."
- Copy to clipboard (Cmd+Enter / Ctrl+Enter shortcut, toast notification, `aria-live="polite"`)
- **"Open in Claude" button**: `window.open('https://claude.ai/new?q=' + encodeURIComponent(prompt))`. For prompts under 2500 tokens (all 3 types fit). Eliminates copy-paste step. Secondary action next to Copy button.
- Token count badge: `"~{N} tokens (~{C} caracteres)"` — show both for cross-model awareness
- **Default: `[SUA-KEY]` placeholder in prompt.** Toggle to embed actual key with amber warning. When copied with real key, toast says "Prompt copiado com sua key real. Nao compartilhe." (differentiated from normal "Prompt copiado!")
- Focus trap + keyboard navigation (Tab wraps, Escape closes, ArrowDown in video selector)
- Focus ring on all interactive elements (type cards, buttons, combobox)

**State management:**
- Type selector: `useState<PromptType>('content-calendar')`
- Video selection: `useState<VideoRow | null>(null)` — reset when type changes to non-video type
- Loading: skeleton placeholders for type cards while channel data loads
- Error: inline banner with retry button
- Empty (no channels): disable all, show "Connect a channel first"

### Video Optimizer Drawer

**File:** `apps/web/src/app/cms/(authed)/youtube/videos/video-optimizer-drawer.tsx`

Custom right-slide **overlay** panel (fixed div with backdrop + 200ms slide transition). Body scroll locked while open. Backdrop click closes (with save guard).

**Decomposed into sub-components (6, reduced from 9):**

```
video-optimizer-drawer.tsx          ← orchestrator (props → data fetch → compose children)
├── _components/
│   ├── drawer-header.tsx           ← title (line-clamp-2) + close button + optimization badge
│   ├── thumbnail-with-grade.tsx    ← 16:9 thumbnail + grade badge overlay
│   ├── video-stats-card.tsx        ← metrics grid (Views|CTR|Retention|Impressions) + retention sparkline + traffic sources text
│   ├── cms-notes-editor.tsx        ← textarea + 800ms debounce auto-save + "Salvando..." / "Salvo" / error indicator
│   ├── drawer-action-buttons.tsx   ← sticky footer: 3 buttons (Copy Prompt, Open in Claude, Sugerir A/B)
│   └── data-freshness-badge.tsx    ← amber badge when lastSyncedAt > 24h
```

**Rationale for 6 vs 9:** `mini-radar-card`, `retention-sparkline`, and `traffic-sources-bar` were 1-3 lines of JSX each — merged into `video-stats-card`. `optimization-state` merged into `drawer-header` (single badge).

**Props (orchestrator):**
```typescript
interface VideoOptimizerDrawerProps {
  video: VideoRow | null        // null = closed
  onClose: () => void
  onCreateAbTest: (videoId: string, testType: string) => void
  onSaveNotes: (videoId: string, notes: string, version: number) => Promise<{ version: number }>
}
```

**Note:** `onSaveNotes` returns `Promise<{ version: number }>` (not `Promise<void>`) so the drawer can update its local version for subsequent saves without re-fetching.

**Data loading:** Per-video endpoint: `fetchVideoOptimizationData(videoId, channelId)` calls a scoped intelligence query (NOT the full channel snapshot). Returns `VideoOptimizationResult`. Cached 5 minutes via `unstable_cache` with key `['yt-optimizer', siteId, channelId, videoId]` and tag `'youtube'` (invalidated on sync).

```typescript
// videos/actions.ts
'use server'

import { unstable_cache } from 'next/cache'

type VideoOptimizationResult =
  | { ok: true; data: VideoOptimizationData }
  | { ok: false; error: PromptDataFetchError }

interface VideoOptimizationData {
  grade: { score: number; grade: Grade; axes: AxisScore[]; trend: TrendDirection; streak: number } | null
  retentionCurve: number[] | null
  trafficSources: { source: string; percentage: number }[] | null
  optimizationState: string | null
  cycleNumber: number | null
  maxCycles: number
  cooldownUntil: string | null
  diagnosis: string | null
  recommendation: string | null
  cmsNotes: string | null
  cmsNotesVersion: number
  lifecycleStage: VideoLifecycle | null
  abTestPatterns: { completedTests: number; titlePatterns: string[]; thumbnailTags: string[] } | null
  lastSyncedAt: string | null
}

// Uses scoring-types.ts canonical types:
// Grade = 'A' | 'B' | 'C' | 'D'
// TrendDirection = 'up' | 'down' | 'flat'
// VideoLifecycle = 'fresh' | 'maturing' | 'established' | 'evergreen'

type PromptDataFetchError =
  | { code: 'NOT_FOUND'; resource: string; id: string }
  | { code: 'UNAUTHORIZED'; message: string }
  | { code: 'SCOPE_ERROR'; scopes: string[] }
  | { code: 'RATE_LIMITED'; retryAfter: number }
  | { code: 'TIMEOUT'; resource: string }
  | { code: 'UNKNOWN'; message: string }

// Channel-level fetch functions:
type ChannelHealthResult =
  | { ok: true; data: ChannelHealthData }
  | { ok: false; error: PromptDataFetchError }

interface ChannelHealthData {
  healthScore: { overall: number; axes: AxisScore[] }
  gradeDistribution: Record<Grade, number>  // { A: 0, B: 5, C: 18, D: 12 }
  demographics: { topAge: string; topCountry: string; topDevice: string } | null
  searchTerms: { term: string; views: number; estimatedMinutesWatched: number }[] | null
  topVideos: VideoGradeRow[]
  bottomVideos: VideoGradeRow[]
  totalVideos: number
  outliers: { positive: OutlierRow[]; negative: OutlierRow[] } | null
  abTestResults: AbTestResultRow[] | null
  cyclesSummary: { active: number; resolved: number; exhausted: number } | null
  snapshotAt: string
}

type ContentCalendarResult =
  | { ok: true; data: ContentCalendarData }
  | { ok: false; error: PromptDataFetchError }

interface ContentCalendarData {
  searchTerms: { term: string; views: number; estimatedMinutesWatched: number }[] | null
  topPerformingCategories: { categorySlug: string; categoryName: string; avgViews: number; avgRetention: number; videoCount: number }[] | null
  demographics: { topAge: string; topCountry: string; topDevice: string } | null
  outlierSuccesses: { title: string; modifiedZ: number; views: number; axis: string }[] | null
  bestPerformingDay: string | null    // lowercase day name from IntelligenceTrends
  bestPerformingHour: number | null   // 0-23 from IntelligenceTrends
  recentUploads: { title: string; publishedAt: string; categorySlug: string | null }[] | null
  snapshotAt: string
}

export async function fetchVideoOptimizationData(videoId: string, channelId: string): Promise<VideoOptimizationResult>
export async function fetchChannelHealthData(channelId: string): Promise<ChannelHealthResult>
export async function fetchContentCalendarData(channelId: string): Promise<ContentCalendarResult>
export async function saveVideoNotes(videoId: string, notes: string, version: number): Promise<{ version: number }>
```

**CMS notes concurrency:** Use `version` integer (matching codebase pattern in `pipeline/actions.ts`), NOT `updated_at` timestamp. On 409: re-fetch, check if remote content differs from local text. If same content → just update version and succeed silently. If different content → preserve user's local text, update version, show "Conflito resolvido" toast, auto-retry.

**Close-while-saving guard:** If `isSaving` is true, show toast "Salvando..." and prevent close. Drawer close waits for pending save.

**Responsive:** Desktop `w-[480px]` overlay, mobile `w-full`. Metrics grid: `grid-cols-2 md:grid-cols-4`. Action buttons: `flex-col-reverse md:flex-row`.

**Prefetch optimization:** `onMouseEnter` on video table rows triggers `prefetch(videoId)` using the same `unstable_cache`. Opening the drawer shows cached data instantly while revalidating in background.

**Button disable logic:**
- "Copy Prompt": disabled if no pipeline key (tooltip: "Configure pipeline key")
- "Open in Claude": disabled if no pipeline key or prompt > URL length limit
- "Sugerir A/B": disabled if grade is null (tooltip: "Aguardando grade") or active A/B test (tooltip: "Teste em andamento")

## Component Architecture

```
apps/web/src/
├── app/cms/(authed)/youtube/
│   ├── _components/
│   │   └── youtube-cowork-prompt-modal.tsx   ← main modal (type selector + preview)
│   ├── videos/
│   │   ├── video-optimizer-drawer.tsx        ← orchestrator
│   │   ├── _components/                     ← 6 sub-components
│   │   └── actions.ts                       ← fetch functions + saveVideoNotes()
│   ├── analytics/_components/               ← per-tab contextual button (Phase 2)
│   └── layout.tsx                           ← + header "Copy Cowork Prompt" button
├── lib/youtube/
│   ├── prompt-builders.ts                   ← 3 builder functions (Phase 1)
│   ├── prompt-types.ts                      ← TypeScript interfaces + error types
│   └── prompt-sanitize.ts                   ← sanitizeForMarkdown(), sanitizeForJson(), estimateTokens()
├── hooks/
│   └── use-pipeline-key.ts                  ← shared hook for both modals (read/write/migration)
└── components/
    └── prompt-preview.tsx                   ← extracted from cowork modal (shared, variant prop)
```

### Prompt Builder Functions

```typescript
// lib/youtube/prompt-types.ts

interface YouTubePromptBaseOptions {
  channelId: string
  channelName: string
  subscriberCount: number
  channelTier: ChannelTier     // from scoring-types.ts: 'nano' | 'micro' | 'small' | 'medium' | 'large'
  baseUrl?: string
  snapshotAt: string           // ISO 8601 timestamp
  currentTime: string          // ISO 8601 timestamp (generated at build time)
}

interface ChannelHealthPromptOptions extends YouTubePromptBaseOptions {
  healthScore: { overall: number; axes: AxisScore[] }      // from scoring-types.ts
  gradeDistribution: Record<Grade, number>                  // { A: 0, B: 5, C: 18, D: 12 } — no F
  demographics?: { topAge: string; topCountry: string; topDevice: string } | null
  searchTerms?: { term: string; views: number; estimatedMinutesWatched: number }[] | null
  topVideos: VideoGradeRow[]
  bottomVideos: VideoGradeRow[]
  totalVideos: number
  outliers?: { positive: OutlierRow[]; negative: OutlierRow[] } | null
  abTestResults?: AbTestResultRow[] | null
  cyclesSummary?: { active: number; resolved: number; exhausted: number } | null
}

interface VideoOptimizerPromptOptions extends YouTubePromptBaseOptions {
  video: { id: string; title: string; thumbnailUrl: string; duration: string; publishedAt: string; viewCount: number; ageDays: number; lifecycleStage: VideoLifecycle }
  grade: { score: number; grade: Grade; axes: AxisScore[]; trend: TrendDirection; streak: number }
  retentionCurve?: number[] | null
  trafficSources?: { source: string; percentage: number }[] | null
  channelBaseline: { medianCtr: number; medianRetention: number }
  optimizationState?: string | null
  cycleNumber?: number | null
  maxCycles?: number
  cooldownUntil?: string | null
  diagnosis?: string | null
}

interface ContentCalendarPromptOptions extends YouTubePromptBaseOptions {
  searchTerms?: { term: string; views: number; estimatedMinutesWatched: number }[] | null
  topPerformingCategories?: { categorySlug: string; categoryName: string; avgViews: number; avgRetention: number; videoCount: number }[] | null
  demographics?: { topAge: string; topCountry: string; topDevice: string } | null
  outlierSuccesses?: { title: string; modifiedZ: number; views: number; axis: string }[] | null
  bestPerformingDay?: string | null      // lowercase day name
  bestPerformingHour?: number | null     // 0-23 integer
  recentUploads?: { title: string; publishedAt: string; categorySlug: string | null }[] | null
}
```

```typescript
// lib/youtube/prompt-builders.ts

export function buildYoutubePromptBase(options: YouTubePromptBaseOptions): string
export function buildChannelHealthPrompt(options: ChannelHealthPromptOptions): string
export function buildVideoOptimizerPrompt(options: VideoOptimizerPromptOptions): string
export function buildContentCalendarPrompt(options: ContentCalendarPromptOptions): string
```

### Shared View Types (prompt-types.ts)

These types are prompt-specific projections — they do NOT exist in scoring-types.ts or intelligence-types.ts. The prompt fetch functions project from DB/scoring data into these shapes.

```typescript
// lib/youtube/prompt-types.ts (alongside the Options interfaces)

interface VideoGradeRow {
  id: string                    // youtube_videos.id (UUID)
  title: string                 // youtube_videos.title
  score: number                 // computed: overall weighted score from AxisScore[]
  grade: Grade                  // computed: from GRADE_THRESHOLDS (A≥85, B≥65, C≥40, D<40)
  retention: number             // youtube_analytics.audience_retention_avg (%)
  trend: TrendDirection         // computed: from last 3 scoring periods
  lifecycleStage?: VideoLifecycle  // computed: from ageDays via getVideoLifecycle()
}

interface OutlierRow {
  title: string                 // youtube_videos.title
  modifiedZ: number             // computed: from computeOutliers() using Modified Z-score with MAD
  views: number                 // youtube_videos.view_count
  axis?: Axis                   // which axis triggered the outlier detection
}

interface AbTestResultRow {
  videoTitle: string            // youtube_videos.title of the test subject
  testType: string              // 'thumbnail' | 'title' | 'description' | 'combo'
  winner: string                // 'A' | 'B' | 'none'
  confidence: number            // 0.0–1.0, from ab_tests.statistical_confidence
}
```

### Computed Field Provenance

Fields in inline JSON that do NOT come directly from DB columns:

| Field | Source | Computation |
|-------|--------|-------------|
| `healthScore.axes[].benchmark` | `ChannelBaseline` + sigmoid | Sigmoid midpoint for the axis at the channel's subscriber count (from `SIGMOID_K` / `SIGMOID_STEEPNESS`) |
| `grade.axes[].channelMedian` | `ChannelBaseline` | Direct mapping: `medianCtr`, `medianRetention` from `ChannelBaseline` (9-field type in scoring-types.ts) |
| `grade.axes[].status` | computed | `score >= channelMedian ? 'above' : 'below'` |
| `snapshot_age_hours` | computed | `(Date.now() - new Date(snapshotAt).getTime()) / 3_600_000`, rounded to 1 decimal |
| `lifecycleStage` | computed | `getVideoLifecycle(ageDays)` from scoring-types.ts |
| `grade` (letter) | computed | `score >= 85 → A, >= 65 → B, >= 40 → C, else D` from `GRADE_THRESHOLDS` |

## Edge Cases

### Prompt Generation
| Case | Handling |
|------|----------|
| No pipeline key | Generate with `[SUA-KEY]` placeholder (default), toast warning on copy |
| No channels configured | Disable all buttons, show "Connect a channel first" |
| 0 videos (new channel) | Omit analytics sections, include note "(Dados de video indisponiveis nesta snapshot)" |
| 1 video (no variance for outliers) | Omit outliers section, note "(Outliers requerem minimo 2 videos)" |
| 50+ videos | `total_videos` shows real count, `showing_top_n` shows truncated count |
| No analytics data (just synced) | Skip grade sections, note "(Analytics ainda nao computado)" |
| No A/B tests completed | Omit winning patterns section entirely |
| Demographics unavailable (scope) | Omit demographics, note "(Scope de analytics nao concedido)" |
| Video title contains injection chars | `sanitizeForMarkdown()` / `sanitizeForJson()` per context |
| Channel name contains injection chars | Same sanitization — channelName IS in scope |
| Prompt exceeds 2500 tokens | Reduce to top 5 + bottom 3 videos, top 5 search terms, `"truncated": true` |
| Deleted video while drawer open | Show "Video removido" badge, disable all actions |
| Channel access revoked | Show error banner, disable prompt buttons |
| snapshot_age_hours > 48 | Prompt includes staleness warning for AI (pre-computed field, avoids ISO date parsing in smaller models) |

### Video Optimizer Drawer
| Case | Handling |
|------|----------|
| Grade not computed | Show "Aguardando grade" badge, disable A/B button |
| Active A/B test | Disable "Sugerir A/B" with tooltip "Teste em andamento" |
| Video hidden | Show "Oculto" badge, allow optimization actions |
| Retention curve unavailable | Show text: "(Dados de retencao indisponiveis)" |
| In cooldown (60 days post-resolved) | Disable new test, show "Cooldown ate {date}" |
| Cycles exhausted (5/5) | Disable new test, show "Video exauriu 5 ciclos" |
| Save notes fails (network error) | Show error below textarea, auto-retry once after 3s |
| Concurrent notes edit (other tab) | `version` integer locking; 409 → re-fetch, compare content, auto-retry with new version |
| Close while saving | Toast "Salvando...", delay close until save completes |
| 0 impressions (video.impressions) | Power analysis shows "Impressoes insuficientes" |
| lastSyncedAt > 24h | Show amber badge "Dados desatualizados (ultima sync: Xh atras)" |

### Accessibility
| Item | Implementation |
|------|---------------|
| Keyboard nav | Focus trap in modal/drawer (Tab wraps first↔last), Escape closes, Cmd+Enter / Ctrl+Enter copies |
| Screen reader | `role="dialog"`, `aria-modal="true"`, `aria-label`, `aria-live="polite"` for toasts |
| Video selector | Use Radix Combobox or equivalent. `role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"` |
| Focus restoration | Save `activeElement` before open, restore on close |
| Focus rings | Visible focus indicator on ALL interactive elements (type cards, buttons, combobox items) |
| Color contrast | Use CMS tokens. Fix red to `#f85149` (≥4.5:1 vs `#0f1419`). No white text on green/orange bars. |
| Clipboard fallback | Try `navigator.clipboard.writeText`, fallback to textarea+execCommand, error toast if both fail |
| Backdrop click | Closes drawer/modal. If unsaved notes, show "Salvando..." and delay close |
| Body scroll lock | `document.body.style.overflow = 'hidden'` while drawer/modal open |
| Min touch target | All interactive elements ≥ 11px font, ≥ 32px touch target |

### Security
| Item | Implementation |
|------|---------------|
| Pipeline key storage | `usePipelineKey(siteId)` hook — reads `cowork-pipeline-key-${siteId}` with fallback to `cowork-pipeline-key` |
| Key in prompt | Default: `[SUA-KEY]` placeholder. Opt-in toggle to embed actual key with amber warning. Differentiated toast when real key copied. |
| Server action auth | `fetchVideoOptimizationData` validates `siteId` matches channel's `site_id` via service client + explicit filter. `?video_id=X` extension MUST maintain channel ownership check. |
| Prompt injection | `sanitizeForMarkdown()` for prose, `sanitizeForJson()` for JSON values. Separate contexts. Unicode Cf stripping. |
| Thumbnail URLs | Validated with `new URL(url).hostname === 'i.ytimg.com'` + try-catch + videoId path match. Query params stripped. |
| Audit logging | Fire-and-forget server action `logPromptCopy(promptType, channelId?)`. On failure: Sentry breadcrumb (does NOT block clipboard). |
| CMS notes concurrency | `version` integer (matches pipeline pattern), NOT `updated_at` timestamp. Auto-retry with divergence check. |
| PATCH validation | Tighten Zod: `.enum()` for `category`/`action_type`/`notification.type`, `.regex(/^pat_[a-z0-9]{8}$/)` for `pattern_id`, `.min(0).max(1000)` for `sample_size`, `.regex(/^yt-[a-z]{2}-v\d+$/)` for `prompt_version` |
| CSP | Pre-existing `unsafe-inline` for script-src and style-src (required by Tailwind 4). Not a new attack surface — same as existing pipeline modal. Accepted risk. |

## Visual Style

Use existing CMS color system (`--cms-*` tokens) throughout. Indigo accent (`#6366f1`) for prompt-related buttons. Fix `#da3633` red → `#f85149` for WCAG AA compliance. No white text on colored bar segments — use dark text or adjust bar colors.

## Implementation Notes

1. **[BLOCKING] Reconcile action_type enums:** Update `intelligence-schemas.ts` `RecommendationSchema.action_type` to match `RecommendationActionType` in `intelligence-types.ts` (12 values, only 3 currently overlap). See Blocking Prerequisites.
2. **[BLOCKING] Reconcile notification type enums:** Update `intelligence-schemas.ts` `NotificationSchema.type` to match `NotificationTrigger` in `intelligence-types.ts` plus `optimization_resolved`. See Blocking Prerequisites.
3. **[BLOCKING] Tighten Zod validation:** Add enums for `category`, regex for `pattern_id`, bounds for `sample_size`, optional `prompt_version` validation.
4. **Add `bestPublishDay/Hour` computation:** Currently defined in `IntelligenceTrends` type but the intelligence endpoint does not compute them. Compute from `published_at` dates grouped by day-of-week. Use metric: average views in first 7 days per day-of-week. Minimum sample size: 3 videos per day to be considered. Hour: mode of publish hour from top 10 performing videos.
5. **Impressions data:** Currently hardcoded to 0 in `analytics-client.ts`. Document that impressions must come from YouTube Data API v3 `statistics` part or periodic YouTube Studio import. Sub_impact axis (8% weight) is effectively dead weight until impressions are real.
6. **Per-video intelligence query:** Add `?video_id=X` param to intelligence GET endpoint to avoid full-channel over-fetch for drawer. MUST maintain `channel_id` ownership check on the video.
7. **Stale sigmoid k values:** `SIGMOID_STEEPNESS` in `intelligence-types.ts` uses `growth_velocity`/`subscriber_impact` while `scoring-types.ts` uses `growth`/`sub_impact`. Reconcile names. Values match.
8. **`IntelligenceTrafficSources.top_search_terms` type includes `ctr: number`** but this data is never populated from the YouTube Analytics API. Consider making it optional (`ctr?: number`) or removing it.
9. **PATCH input → storage transform:** Server handler must transform flat Zod-validated input into nested `IntelligencePatchPayload` TypeScript structures. Map `coaching.priorities[].{axis,score,diagnosis,action}` → `CoachingPriority.{rank,action,impact,effort,estimated_lift,timeline}` with sensible defaults.

## Implementation Estimate (Phase 1 MVP — revised)

| Component | Effort |
|-----------|--------|
| **Prerequisites** (Zod reconciliation + tightening + transform layer + migration) | 3.5h |
| `prompt-builders.ts` + `prompt-types.ts` + `prompt-sanitize.ts` | 5h |
| `youtube-cowork-prompt-modal.tsx` (3 types, Open in Claude, no analytics sub-selector) | 5h |
| `video-optimizer-drawer.tsx` + 6 sub-components | 5h |
| `fetchVideoOptimizationData()` + `fetchChannelHealthData()` + `fetchContentCalendarData()` + `saveVideoNotes()` | 3h |
| `usePipelineKey()` shared hook + migration | 1h |
| Per-tab contextual buttons (Overview, Videos) | 1h |
| Header button + layout integration | 1h |
| `prompt-preview.tsx` extraction + `PromptPreview` shared component | 1h |
| Tests | **8h** |
| **Total Phase 1** | **~33.5h** |

### Test Plan (~147 cases, 8h)

**Prompt sanitization (18 cases, ~45 min):**
- `sanitizeForMarkdown`: `#`, backtick, `|`, `---`, `===`, `***`, `<tag>`, `<|endoftext|>`, `{`, `}`, `[`, `]`, `\n`, combined injection, empty string, Unicode Cf characters, max length truncation, channel name, null input guard
- `sanitizeForJson`: delegates to JSON.stringify().slice(1,-1), special chars, control chars, returns unquoted, null→empty string, undefined→empty string
- `estimateTokens`: empty→0, known string, PT-BR with Unicode, very long string

**Prompt builders (50 cases, ~2h):**
Per builder (base + 3 types):
- Includes persona, guardrails, confidence guide, language directive (top + bottom)
- Correct inline JSON structure with all required fields
- MODE 1 header present with "NAO tente fazer requisicoes HTTP" in ALL prompt types
- MODE 2 separation (Channel Health + Video Optimizer) / absence (Content Calendar)
- `current_time` present in inline JSON
- Null data omission: null demographics → section omitted with note
- Empty videos (0 videos) → minimal prompt with note
- Token budget: `estimateTokens()` within budget per type
- Overflow protection: >2500 tokens triggers truncation + `"truncated": true`
- Sanitization pass-through: title with injection chars properly escaped in both contexts
- Tier calibration: nano vs micro vs large channel differences
- Prompt version string present (`yt-XX-v4`)
- `snapshot_at` timestamp present in all 3 types
- `snapshot_age_hours` pre-computed in all 3 types (avoids Llama/smaller models needing to parse ISO dates)
- `gradeDistribution` uses only A/B/C/D (no F) — negative test for Grade "F"
- Schema validation: embedded JSON examples parse against actual Zod schemas
- Snapshot tests for all 3 builder outputs (detect unintended drift)

**Modal component (30 cases, ~2h):**
- Type selector: 3 types render, Content Calendar default selected
- Video selector: combobox renders for Video Optimizer, hidden for others
- Video selector search debounce (300ms)
- Video selector max 50 items
- State reset: switching types clears video selection
- Copy: Cmd+Enter AND Ctrl+Enter work, toast shown, fire-and-forget audit action called
- Open in Claude: button generates correct URL, opens new tab
- Pipeline key: `usePipelineKey` hook reads/writes site-scoped key with fallback
- Default `[SUA-KEY]` placeholder, opt-in embed toggle
- Differentiated toast when real key copied vs placeholder
- Focus trap: Tab wraps first↔last, Escape closes, focus restored on close
- Focus rings visible on type cards and buttons
- Loading skeleton, error banner, empty state rendering
- Token count + character count badge
- Backdrop click closes
- Body scroll lock
- Clipboard fallback (textarea+execCommand path)

**Drawer component (30 cases, ~2h):**
- Renders nothing when video=null, overlay with backdrop when video provided
- Shows skeleton while loading
- Error banner for each of 6 `PromptDataFetchError` codes
- Button disable: correct per optimization state, grade null, active tests
- Notes auto-save: 800ms debounce, "Salvando..." indicator, "Salvo" indicator, error + retry
- Notes concurrency: version-based locking, 409 → re-fetch + divergence check + auto-retry
- Close guard: prevents close while saving
- `role="dialog"` + `aria-modal="true"` + `aria-label`
- Focus trap within drawer
- Escape key closes drawer
- Backdrop click closes (with save guard)
- Body scroll lock while open
- Data freshness: "Dados desatualizados" badge when lastSyncedAt > 24h
- Prefetch on hover: data available instantly on open
- `onCreateAbTest` callback fires correctly
- `onSaveNotes` returns new version number
- Optimization badge variants (flagged, cooldown, exhausted, resolved)
- Responsive: w-480 vs w-full

**Accessibility (12 cases, ~30 min):**
- Combobox ARIA: `role`, `aria-expanded` toggle, `aria-activedescendant`, keyboard nav (ArrowDown/Up, Enter, Escape)
- Focus restoration: modal close returns focus to trigger button
- Focus restoration: drawer close returns focus to trigger row
- `aria-live` region: toast announcements reach screen reader
- Color contrast: red `#f85149` ≥ 4.5:1 verified
- `role="dialog"` on both modal and drawer
- `aria-modal="true"` on both
- Min touch target 32px on action buttons

**Integration tests (7 cases, ~45 min):**
- Full modal flow: open → select type → copy prompt → validate structure
- Drawer flow: open → fetch data → all sections render → copy prompt
- Error: 403/404/500 responses handled gracefully
- Type switch: Content Calendar → Video Optimizer → verify state reset
- SessionStorage persistence across modal open/close cycles
- Modal → drawer handoff: select Video Optimizer in modal, then open drawer
- `usePipelineKey` migration: reads old unscoped key, writes new scoped key

## Scoring (Post-24-Critic Audit — Rev 5)

| Dimension | R2 avg | R3 avg | Rev 5 Fixes |
|-----------|--------|--------|-------------|
| Prompt engineering | 74 | 72 | Confidence ranges (not exact values), snapshot_age_hours pre-computed, no code fences directive, formatISO for timezone |
| UX/UI design | 62 | 63 | Thumbnail URL uses youtube_video_id not UUID, differentiated key toast |
| Architecture | 88 | 82 | VideoGradeRow/OutlierRow/AbTestResultRow defined, computed field provenance table, youtube_videos.version migration |
| Data completeness | 76 | 74 | Phantom types fully specified with DB column sources, benchmark provenance documented |
| Security | 81 | 78 | sanitizeForJson null guard, `[`/`]` added to sanitizeForMarkdown, thumbnail ID mismatch fixed |
| Testing | 71 | 64 | 147 cases (math fixed), snapshot_age_hours tests, null/undefined sanitize tests, `[`/`]` tests |
| AI portability | 83 | 76 | snapshot_age_hours for Llama, confidence ranges instead of exact 0.5, staleness uses pre-computed field |
| Product strategy | 71 | 59 | 3.5h prerequisites (added migration), PATCH example with valid UUIDs + placeholder note |
